import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { forbidden, notFound } from './errors.js'
import type {
  CreateTaskOptions,
  EntryPatch,
  Item,
  ItemAccess,
  ItemDetail,
  ItemPatch,
  ItemShare,
  Note,
  Page,
  PageEntry,
  PageKind,
  Person,
  PersonPatch,
  SharePermission,
  SharedItem,
  Space,
  Task,
  TaskPatch,
  TaskPriority,
  TaskStatus,
  TaskStore,
} from './types.js'

const { Pool } = pg

// BIGINT columns (created_at, updated_at, running_since) hold epoch ms/s well
// within Number.MAX_SAFE_INTEGER — parse them as numbers instead of pg's
// default string, to match the TaskStore types and the app's timer arithmetic.
pg.types.setTypeParser(20, (val: string) => parseInt(val, 10))

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(__dirname, '../../migrations')

const MIGRATIONS = [
  '0001_init.sql',
  '0002_add_user_id.sql',
  '0003_add_category.sql',
  '0004_eisenhower_priority.sql',
  '0005_archive_and_favorites.sql',
  '0006_workspace_boards.sql',
  '0007_rename_personal_space.sql',
  '0008_spaces_items_pages.sql',
  '0009_item_icons.sql',
]

// Every new item starts with these. Overview is special — it's the item's
// front page and can't be removed; the rest are ordinary pages.
const STARTER_PAGES: { name: string; kind: PageKind }[] = [
  { name: 'Overview', kind: 'overview' },
  { name: 'Checklist', kind: 'checklist' },
  { name: 'Notes', kind: 'notes' },
]

async function applyMigrations(pool: pg.Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint
    )
  `)
  const { rows } = await pool.query<{ name: string }>('SELECT name FROM _migrations')
  const applied = new Set(rows.map((r) => r.name))
  for (const name of MIGRATIONS) {
    if (applied.has(name)) continue
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf-8')
    await pool.query(sql)
    await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [name])
  }
}

export async function createPostgresTaskStore(connectionString: string): Promise<PostgresTaskStore> {
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  await applyMigrations(pool)
  return new PostgresTaskStore(pool)
}

/** Who owns an item and what the caller may do with it. */
interface Access {
  access: Exclude<ItemAccess, null>
  ownerId: string
  itemId: number
}

const OWNER_NAME_SQL = `COALESCE(u.raw_user_meta_data->>'full_name', u.email, 'Someone')`

export class PostgresTaskStore implements TaskStore {
  constructor(private pool: pg.Pool) {}

  async getAllTasks(userId: string): Promise<Task[]> {
    const { rows } = await this.pool.query<Task>(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    )
    return rows
  }

  async searchTasks(userId: string, query: string): Promise<Task[]> {
    const { rows } = await this.pool.query<Task>(
      `SELECT DISTINCT t.* FROM tasks t
       LEFT JOIN notes n ON n.task_id = t.id
       WHERE t.user_id = $1 AND (t.title ILIKE $2 OR n.content ILIKE $2)
       ORDER BY t.created_at DESC`,
      [userId, `%${query}%`],
    )
    return rows
  }

  async createTask(userId: string, title: string, options: CreateTaskOptions): Promise<Task> {
    const itemId = options.item_id ?? null
    let pageId = options.page_id ?? null
    // A task belongs to whoever owns the item, so it lands in that person's
    // list — same rule as a task added from the item's own checklist.
    let owner = userId

    if (itemId !== null) {
      const access = this.requireWrite(await this.itemAccess(userId, itemId))
      owner = access.ownerId
      if (pageId === null) {
        // Put it on the item's task list rather than leaving it loose on the
        // item, so it shows up where someone would go looking for it.
        const { rows } = await this.pool.query<{ id: number }>(
          `SELECT id FROM pages WHERE item_id = $1 AND kind = 'checklist'
           ORDER BY position, id LIMIT 1`,
          [itemId],
        )
        pageId = rows[0]?.id ?? null
      }
    }

    const today = new Date().toISOString().slice(0, 10)
    const { rows } = await this.pool.query<Task>(
      `INSERT INTO tasks (title, date, priority, user_id, category, due_date, item_id, page_id)
       VALUES ($1, $2, 'none', $3, $4, $5, $6, $7) RETURNING *`,
      [title, today, owner, options.category ?? '', options.due_date ?? null, itemId, pageId],
    )
    return rows[0]
  }

  async deleteTask(userId: string, id: number): Promise<void> {
    await this.pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [id, userId])
  }

  async setTaskTitle(userId: string, id: number, title: string): Promise<void> {
    await this.pool.query('UPDATE tasks SET title = $1 WHERE id = $2 AND user_id = $3', [
      title,
      id,
      userId,
    ])
  }

  async setTaskStatus(userId: string, id: number, status: TaskStatus): Promise<void> {
    await this.pool.query('UPDATE tasks SET status = $1 WHERE id = $2 AND user_id = $3', [
      status,
      id,
      userId,
    ])
  }

  async setTaskPriority(userId: string, id: number, priority: TaskPriority): Promise<void> {
    await this.pool.query('UPDATE tasks SET priority = $1 WHERE id = $2 AND user_id = $3', [
      priority,
      id,
      userId,
    ])
  }

  async setTaskTags(userId: string, id: number, tags: string): Promise<void> {
    await this.pool.query('UPDATE tasks SET tags = $1 WHERE id = $2 AND user_id = $3', [
      tags,
      id,
      userId,
    ])
  }

  async setTaskCategory(userId: string, id: number, category: string): Promise<void> {
    await this.pool.query('UPDATE tasks SET category = $1 WHERE id = $2 AND user_id = $3', [
      category,
      id,
      userId,
    ])
  }

  async setTaskArchived(userId: string, id: number, archived: boolean): Promise<void> {
    await this.pool.query('UPDATE tasks SET archived = $1 WHERE id = $2 AND user_id = $3', [
      archived,
      id,
      userId,
    ])
  }

  async setTaskDueDate(userId: string, id: number, dueDate: string | null): Promise<void> {
    await this.pool.query('UPDATE tasks SET due_date = $1 WHERE id = $2 AND user_id = $3', [
      dueDate,
      id,
      userId,
    ])
  }

  async startTaskTimer(userId: string, id: number): Promise<number> {
    const now = Date.now()
    // Starting the timer no longer touches status — status is the user's to set.
    await this.pool.query(
      'UPDATE tasks SET running_since = $1 WHERE id = $2 AND user_id = $3 AND running_since IS NULL',
      [now, id, userId],
    )
    return now
  }

  async stopTaskTimer(userId: string, id: number): Promise<void> {
    const { rows } = await this.pool.query<Task>(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [id, userId],
    )
    const task = rows[0]
    if (!task || task.running_since === null) return
    const elapsed = Math.floor((Date.now() - Number(task.running_since)) / 1000)
    await this.pool.query(
      'UPDATE tasks SET seconds = seconds + $1, running_since = NULL WHERE id = $2 AND user_id = $3',
      [elapsed, id, userId],
    )
  }

  async resetTaskTimer(userId: string, id: number): Promise<void> {
    await this.pool.query(
      'UPDATE tasks SET seconds = 0, running_since = NULL WHERE id = $1 AND user_id = $2',
      [id, userId],
    )
  }

  async getNotesForTask(userId: string, taskId: number): Promise<Note[]> {
    const { rows } = await this.pool.query<Note>(
      `SELECT n.* FROM notes n
       JOIN tasks t ON t.id = n.task_id
       WHERE n.task_id = $1 AND t.user_id = $2
       ORDER BY n.created_at ASC`,
      [taskId, userId],
    )
    return rows
  }

  async upsertTaskNote(userId: string, taskId: number, content: string): Promise<Note> {
    const now = Math.floor(Date.now() / 1000)
    const existing = await this.getNotesForTask(userId, taskId)
    if (existing.length > 0) {
      const { rows } = await this.pool.query<Note>(
        'UPDATE notes SET content = $1, updated_at = $2 WHERE id = $3 RETURNING *',
        [content, now, existing[0].id],
      )
      return rows[0]
    }
    const today = new Date().toISOString().slice(0, 10)
    const { rows } = await this.pool.query<Note>(
      `INSERT INTO notes (task_id, content, date, updated_at)
       SELECT $1, $2, $3, $4 WHERE EXISTS (SELECT 1 FROM tasks WHERE id = $1 AND user_id = $5)
       RETURNING *`,
      [taskId, content, today, now, userId],
    )
    if (!rows[0]) {
      throw notFound('Task')
    }
    return rows[0]
  }

  async getFavoriteTags(userId: string): Promise<string[]> {
    const { rows } = await this.pool.query<{ name: string }>(
      'SELECT name FROM favorite_tags WHERE user_id = $1 ORDER BY created_at ASC',
      [userId],
    )
    return rows.map((r) => r.name)
  }

  async addFavoriteTag(userId: string, name: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO favorite_tags (user_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, name],
    )
  }

  async removeFavoriteTag(userId: string, name: string): Promise<void> {
    await this.pool.query('DELETE FROM favorite_tags WHERE user_id = $1 AND name = $2', [
      userId,
      name,
    ])
  }

  // ---------------------------------------------------------------------
  // Workspace: Space -> Item -> Pages
  // ---------------------------------------------------------------------

  private async transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  /**
   * Resolve what the caller may do with an item: own it, or hold a share on
   * it (matched by the email they signed in with). Everything below funnels
   * through this, so sharing can't leak an item to anyone else.
   */
  private async itemAccess(userId: string, itemId: number): Promise<Access> {
    const { rows } = await this.pool.query<{ user_id: string; permission: string | null }>(
      `SELECT i.user_id,
              (SELECT s.permission FROM item_shares s
                WHERE s.item_id = i.id
                  AND s.email = (SELECT lower(email) FROM auth.users WHERE id = $2)) AS permission
       FROM items i WHERE i.id = $1`,
      [itemId, userId],
    )
    const row = rows[0]
    if (!row) throw notFound('Item')
    if (row.user_id === userId) return { access: 'owner', ownerId: row.user_id, itemId }
    if (row.permission === 'edit' || row.permission === 'view') {
      return { access: row.permission, ownerId: row.user_id, itemId }
    }
    throw notFound('Item')
  }

  private async pageAccess(userId: string, pageId: number): Promise<Access & { page: Page }> {
    const { rows } = await this.pool.query<Page>('SELECT * FROM pages WHERE id = $1', [pageId])
    const page = rows[0]
    if (!page) throw notFound('Page')
    return { ...(await this.itemAccess(userId, page.item_id)), page }
  }

  private async entryAccess(userId: string, entryId: number): Promise<Access> {
    const { rows } = await this.pool.query<{ page_id: number }>(
      'SELECT page_id FROM page_entries WHERE id = $1',
      [entryId],
    )
    if (!rows[0]) throw notFound('Entry')
    return this.pageAccess(userId, rows[0].page_id)
  }

  private async personAccess(userId: string, personId: number): Promise<Access> {
    const { rows } = await this.pool.query<{ page_id: number }>(
      'SELECT page_id FROM people WHERE id = $1',
      [personId],
    )
    if (!rows[0]) throw notFound('Person')
    return this.pageAccess(userId, rows[0].page_id)
  }

  private requireWrite<T extends Access>(access: T): T {
    if (access.access === 'view') throw forbidden()
    return access
  }

  private requireOwner<T extends Access>(access: T): T {
    if (access.access !== 'owner') throw forbidden('Only the owner can do this')
    return access
  }

  // --- Spaces ---

  async getSpaces(userId: string): Promise<Space[]> {
    const { rows } = await this.pool.query<Space>(
      'SELECT * FROM spaces WHERE user_id = $1 ORDER BY position, id',
      [userId],
    )
    return rows
  }

  async createSpace(userId: string, name: string, icon: string): Promise<Space> {
    const { rows } = await this.pool.query<Space>(
      `INSERT INTO spaces (user_id, name, icon, position)
       VALUES ($1, $2, $3, COALESCE((SELECT MAX(position) + 1 FROM spaces WHERE user_id = $1), 0))
       RETURNING *`,
      [userId, name, icon],
    )
    return rows[0]
  }

  async updateSpace(userId: string, id: number, name: string, icon: string): Promise<void> {
    await this.pool.query(
      'UPDATE spaces SET name = $1, icon = $2 WHERE id = $3 AND user_id = $4',
      [name, icon, id, userId],
    )
  }

  async deleteSpace(userId: string, id: number): Promise<void> {
    await this.pool.query('DELETE FROM spaces WHERE id = $1 AND user_id = $2', [id, userId])
  }

  // --- Items ---

  async getItems(userId: string): Promise<Item[]> {
    const { rows } = await this.pool.query<Item>(
      'SELECT * FROM items WHERE user_id = $1 ORDER BY space_id, position, id',
      [userId],
    )
    return rows
  }

  async getSharedItems(userId: string): Promise<SharedItem[]> {
    const { rows } = await this.pool.query<SharedItem>(
      `SELECT i.*, s.permission, ${OWNER_NAME_SQL} AS owner_name
       FROM item_shares s
       JOIN items i ON i.id = s.item_id
       JOIN auth.users u ON u.id = i.user_id
       WHERE s.email = (SELECT lower(email) FROM auth.users WHERE id = $1)
       ORDER BY i.name, i.id`,
      [userId],
    )
    return rows
  }

  async createItem(userId: string, spaceId: number, name: string): Promise<Item> {
    return this.transaction(async (client) => {
      const { rows } = await client.query<Item>(
        `INSERT INTO items (space_id, user_id, name, position)
         SELECT $1, $2, $3,
                COALESCE((SELECT MAX(position) + 1 FROM items WHERE space_id = $1), 0)
         WHERE EXISTS (SELECT 1 FROM spaces WHERE id = $1 AND user_id = $2)
         RETURNING *`,
        [spaceId, userId, name],
      )
      const item = rows[0]
      if (!item) throw notFound('Space')
      for (const [index, page] of STARTER_PAGES.entries()) {
        await client.query(
          'INSERT INTO pages (item_id, user_id, name, kind, position) VALUES ($1, $2, $3, $4, $5)',
          [item.id, userId, page.name, page.kind, index],
        )
      }
      return item
    })
  }

  async getItemDetail(userId: string, itemId: number): Promise<ItemDetail | null> {
    let access: Access
    try {
      access = await this.itemAccess(userId, itemId)
    } catch {
      return null
    }
    const { rows: itemRows } = await this.pool.query<Item & { owner_name: string }>(
      `SELECT i.*, ${OWNER_NAME_SQL} AS owner_name
       FROM items i JOIN auth.users u ON u.id = i.user_id WHERE i.id = $1`,
      [itemId],
    )
    const { owner_name, ...item } = itemRows[0]
    const { rows: spaceRows } = await this.pool.query<Space>('SELECT * FROM spaces WHERE id = $1', [
      item.space_id,
    ])
    const { rows: pages } = await this.pool.query<Page>(
      'SELECT * FROM pages WHERE item_id = $1 ORDER BY position, id',
      [itemId],
    )
    return { item, space: spaceRows[0], pages, access: access.access, owner_name }
  }

  async updateItem(userId: string, id: number, patch: ItemPatch): Promise<void> {
    this.requireWrite(await this.itemAccess(userId, id))
    const sets: string[] = []
    const values: unknown[] = []
    for (const key of ['name', 'icon', 'date', 'location', 'description'] as const) {
      if (patch[key] === undefined) continue
      values.push(patch[key])
      sets.push(`${key} = $${values.length}`)
    }
    if (sets.length === 0) return
    values.push(id)
    await this.pool.query(`UPDATE items SET ${sets.join(', ')} WHERE id = $${values.length}`, values)
  }

  async deleteItem(userId: string, id: number): Promise<void> {
    this.requireOwner(await this.itemAccess(userId, id))
    await this.pool.query('DELETE FROM items WHERE id = $1', [id])
  }

  // --- Pages ---

  async createPage(userId: string, itemId: number, name: string, kind: PageKind): Promise<Page> {
    const { ownerId } = this.requireWrite(await this.itemAccess(userId, itemId))
    if (kind === 'overview') throw forbidden('An item has one Overview')
    const { rows } = await this.pool.query<Page>(
      `INSERT INTO pages (item_id, user_id, name, kind, position)
       VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(position) + 1 FROM pages WHERE item_id = $1), 0))
       RETURNING *`,
      [itemId, ownerId, name, kind],
    )
    return rows[0]
  }

  async renamePage(userId: string, id: number, name: string): Promise<void> {
    this.requireWrite(await this.pageAccess(userId, id))
    await this.pool.query('UPDATE pages SET name = $1 WHERE id = $2', [name, id])
  }

  async setPageContent(userId: string, id: number, content: string): Promise<void> {
    this.requireWrite(await this.pageAccess(userId, id))
    await this.pool.query('UPDATE pages SET content = $1 WHERE id = $2', [content, id])
  }

  async deletePage(userId: string, id: number): Promise<void> {
    const { page } = this.requireWrite(await this.pageAccess(userId, id))
    if (page.kind === 'overview') throw forbidden('The Overview page can’t be removed')
    await this.pool.query('DELETE FROM pages WHERE id = $1', [id])
  }

  // --- Tasks inside an item ---
  // These belong to the item's owner (so they land in the owner's global
  // Tasks), but anyone with edit access can work on them from the checklist.

  async getItemTasks(userId: string, itemId: number): Promise<Task[]> {
    await this.itemAccess(userId, itemId)
    const { rows } = await this.pool.query<Task>(
      'SELECT * FROM tasks WHERE item_id = $1 AND archived = false ORDER BY created_at ASC',
      [itemId],
    )
    return rows
  }

  async createPageTask(
    userId: string,
    pageId: number,
    title: string,
    dueDate: string | null,
  ): Promise<Task> {
    const { ownerId, itemId } = this.requireWrite(await this.pageAccess(userId, pageId))
    const today = new Date().toISOString().slice(0, 10)
    const { rows } = await this.pool.query<Task>(
      `INSERT INTO tasks (title, date, priority, user_id, category, due_date, item_id, page_id)
       VALUES ($1, $2, 'none', $3, '', $4, $5, $6) RETURNING *`,
      [title, today, ownerId, dueDate, itemId, pageId],
    )
    return rows[0]
  }

  private async taskAccess(userId: string, taskId: number): Promise<Access> {
    const { rows } = await this.pool.query<{ item_id: number | null; user_id: string }>(
      'SELECT item_id, user_id FROM tasks WHERE id = $1',
      [taskId],
    )
    const task = rows[0]
    if (!task) throw notFound('Task')
    if (task.item_id === null) {
      if (task.user_id !== userId) throw notFound('Task')
      return { access: 'owner', ownerId: userId, itemId: 0 }
    }
    return this.itemAccess(userId, task.item_id)
  }

  async updateItemTask(userId: string, taskId: number, patch: TaskPatch): Promise<void> {
    this.requireWrite(await this.taskAccess(userId, taskId))
    const sets: string[] = []
    const values: unknown[] = []
    for (const key of ['title', 'status', 'priority', 'due_date'] as const) {
      if (patch[key] === undefined) continue
      values.push(patch[key])
      sets.push(`${key} = $${values.length}`)
    }
    if (sets.length === 0) return
    values.push(taskId)
    await this.pool.query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = $${values.length}`, values)
  }

  async deleteItemTask(userId: string, taskId: number): Promise<void> {
    this.requireWrite(await this.taskAccess(userId, taskId))
    await this.pool.query('DELETE FROM tasks WHERE id = $1', [taskId])
  }

  // --- Itinerary entries ---

  async getPageEntries(userId: string, pageId: number): Promise<PageEntry[]> {
    await this.pageAccess(userId, pageId)
    const { rows } = await this.pool.query<PageEntry>(
      `SELECT * FROM page_entries WHERE page_id = $1
       ORDER BY day NULLS LAST, time, position, id`,
      [pageId],
    )
    return rows
  }

  async createPageEntry(
    userId: string,
    pageId: number,
    entry: Required<EntryPatch>,
  ): Promise<PageEntry> {
    const { ownerId } = this.requireWrite(await this.pageAccess(userId, pageId))
    const { rows } = await this.pool.query<PageEntry>(
      `INSERT INTO page_entries (page_id, user_id, day, time, title, note, position)
       VALUES ($1, $2, $3, $4, $5, $6,
               COALESCE((SELECT MAX(position) + 1 FROM page_entries WHERE page_id = $1), 0))
       RETURNING *`,
      [pageId, ownerId, entry.day, entry.time, entry.title, entry.note],
    )
    return rows[0]
  }

  async updatePageEntry(userId: string, id: number, patch: EntryPatch): Promise<void> {
    this.requireWrite(await this.entryAccess(userId, id))
    const sets: string[] = []
    const values: unknown[] = []
    for (const key of ['day', 'time', 'title', 'note'] as const) {
      if (patch[key] === undefined) continue
      values.push(patch[key])
      sets.push(`${key} = $${values.length}`)
    }
    if (sets.length === 0) return
    values.push(id)
    await this.pool.query(
      `UPDATE page_entries SET ${sets.join(', ')} WHERE id = $${values.length}`,
      values,
    )
  }

  async deletePageEntry(userId: string, id: number): Promise<void> {
    this.requireWrite(await this.entryAccess(userId, id))
    await this.pool.query('DELETE FROM page_entries WHERE id = $1', [id])
  }

  // --- People ---

  async getPeople(userId: string, pageId: number): Promise<Person[]> {
    await this.pageAccess(userId, pageId)
    const { rows } = await this.pool.query<Person>(
      'SELECT * FROM people WHERE page_id = $1 ORDER BY position, id',
      [pageId],
    )
    return rows
  }

  async createPerson(
    userId: string,
    pageId: number,
    person: Required<PersonPatch>,
  ): Promise<Person> {
    const { ownerId } = this.requireWrite(await this.pageAccess(userId, pageId))
    const { rows } = await this.pool.query<Person>(
      `INSERT INTO people (page_id, user_id, name, role, contact, note, position)
       VALUES ($1, $2, $3, $4, $5, $6,
               COALESCE((SELECT MAX(position) + 1 FROM people WHERE page_id = $1), 0))
       RETURNING *`,
      [pageId, ownerId, person.name, person.role, person.contact, person.note],
    )
    return rows[0]
  }

  async updatePerson(userId: string, id: number, patch: PersonPatch): Promise<void> {
    this.requireWrite(await this.personAccess(userId, id))
    const sets: string[] = []
    const values: unknown[] = []
    for (const key of ['name', 'role', 'contact', 'note'] as const) {
      if (patch[key] === undefined) continue
      values.push(patch[key])
      sets.push(`${key} = $${values.length}`)
    }
    if (sets.length === 0) return
    values.push(id)
    await this.pool.query(`UPDATE people SET ${sets.join(', ')} WHERE id = $${values.length}`, values)
  }

  async deletePerson(userId: string, id: number): Promise<void> {
    this.requireWrite(await this.personAccess(userId, id))
    await this.pool.query('DELETE FROM people WHERE id = $1', [id])
  }

  // --- Sharing (owner only) ---

  async getItemShares(userId: string, itemId: number): Promise<ItemShare[]> {
    this.requireOwner(await this.itemAccess(userId, itemId))
    const { rows } = await this.pool.query<ItemShare>(
      'SELECT * FROM item_shares WHERE item_id = $1 ORDER BY created_at',
      [itemId],
    )
    return rows
  }

  async shareItem(
    userId: string,
    itemId: number,
    email: string,
    permission: SharePermission,
  ): Promise<ItemShare> {
    this.requireOwner(await this.itemAccess(userId, itemId))
    const { rows } = await this.pool.query<ItemShare>(
      `INSERT INTO item_shares (item_id, owner_id, email, permission)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (item_id, email) DO UPDATE SET permission = EXCLUDED.permission
       RETURNING *`,
      [itemId, userId, email.trim().toLowerCase(), permission],
    )
    return rows[0]
  }

  async unshareItem(userId: string, shareId: number): Promise<void> {
    await this.pool.query('DELETE FROM item_shares WHERE id = $1 AND owner_id = $2', [
      shareId,
      userId,
    ])
  }
}
