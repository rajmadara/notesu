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
  ItemReadView,
  ItemShare,
  Note,
  Page,
  PageColumn,
  PageEntry,
  PageKind,
  Person,
  PersonPatch,
  ReadEntry,
  ReadPerson,
  SharePermission,
  SharedItem,
  SharedSpace,
  Space,
  SpaceShare,
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
  '0010_space_shares.sql',
  '0011_tasks_page_kind.sql',
  '0012_page_columns.sql',
  '0013_archive_cascade.sql',
]

/**
 * How long a finished task stays on the list before it's archived. The client
 * warns on the last day, so this is also what that countdown is measured from.
 */
const ARCHIVE_AFTER_DAYS = 7

/** Most-permissive wins when someone holds both a space and an item share. */
function bestPermission(...grants: (string | null)[]): 'edit' | 'view' | null {
  if (grants.includes('edit')) return 'edit'
  if (grants.includes('view')) return 'view'
  return null
}

// Every new item starts with these. Overview is special — it's the item's
// front page and can't be removed; the rest are ordinary pages.
const STARTER_PAGES: { name: string; kind: PageKind }[] = [
  { name: 'Overview', kind: 'overview' },
  { name: 'Tasks', kind: 'tasks' },
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

/**
 * Every task $1 can see: their own, plus anything on an item shared with them
 * directly or through its space. Columns are listed rather than starred so no
 * other person's user_id travels to the client. Callers append their own
 * further conditions and an ORDER BY.
 */
const VISIBLE_TASKS_SQL = `
  SELECT t.id, t.title, t.status, t.seconds, t.running_since, t.date, t.created_at,
         t.priority, t.tags, t.category, t.archived, t.done_at, t.due_date, t.item_id, t.page_id,
         CASE WHEN t.user_id = $1 THEN '' ELSE ${OWNER_NAME_SQL} END AS owner_name
    FROM tasks t
    JOIN auth.users u ON u.id = t.user_id
    LEFT JOIN items i ON i.id = t.item_id
    CROSS JOIN (SELECT lower(email) AS email FROM auth.users WHERE id = $1) me
   WHERE (t.user_id = $1
          OR EXISTS (SELECT 1 FROM item_shares s
                      WHERE s.item_id = i.id AND s.email = me.email)
          OR EXISTS (SELECT 1 FROM space_shares sp
                      WHERE sp.space_id = i.space_id AND sp.email = me.email))`

export class PostgresTaskStore implements TaskStore {
  constructor(private pool: pg.Pool) {}

  /**
   * The caller's own tasks, plus the tasks on any item shared with them — the
   * two together are what a person actually has to do, so the main list shows
   * both. Someone else's task carries owner_name so it can be labelled;
   * the caller's own comes back blank.
   */
  async getAllTasks(userId: string): Promise<Task[]> {
    const { rows } = await this.pool.query<Task>(
      `${VISIBLE_TASKS_SQL}
       ORDER BY t.created_at DESC`,
      [userId],
    )
    return rows
  }

  async searchTasks(userId: string, query: string): Promise<Task[]> {
    const { rows } = await this.pool.query<Task>(
      `${VISIBLE_TASKS_SQL}
         AND (t.title ILIKE $2 OR EXISTS (
               SELECT 1 FROM notes n WHERE n.task_id = t.id AND n.content ILIKE $2))
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
          `SELECT id FROM pages WHERE item_id = $1 AND kind = 'tasks'
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

  /**
   * Writes go through taskAccess, not `WHERE user_id = ...`. The main list now
   * shows tasks on shared items, so ticking one there has to reach a row the
   * caller doesn't own — a user_id filter would silently update nothing.
   */
  private async writeTaskField(
    userId: string,
    id: number,
    column: 'title' | 'status' | 'priority' | 'tags' | 'category' | 'archived' | 'due_date',
    value: unknown,
  ): Promise<void> {
    this.requireWrite(await this.taskAccess(userId, id))
    await this.pool.query(`UPDATE tasks SET ${column} = $1 WHERE id = $2`, [value, id])
  }

  async deleteTask(userId: string, id: number): Promise<void> {
    this.requireWrite(await this.taskAccess(userId, id))
    await this.pool.query('DELETE FROM tasks WHERE id = $1', [id])
  }

  async setTaskTitle(userId: string, id: number, title: string): Promise<void> {
    await this.writeTaskField(userId, id, 'title', title)
  }

  /**
   * Stamps done_at alongside the status, so "finished a week ago" is a fact
   * about the task rather than a guess. Re-opening a task clears it, which also
   * takes it out of the sweep.
   */
  async setTaskStatus(userId: string, id: number, status: TaskStatus): Promise<void> {
    this.requireWrite(await this.taskAccess(userId, id))
    await this.pool.query(
      `UPDATE tasks SET status = $1,
              done_at = CASE WHEN $1 = 'done' THEN COALESCE(done_at, $2) ELSE NULL END
        WHERE id = $3`,
      [status, Math.floor(Date.now() / 1000), id],
    )
  }

  /**
   * Archives the caller's own tasks finished more than a week ago. Tasks inside
   * an already-archived item or space are skipped — they're hidden by
   * inheritance, so flipping their own flag would change what unarchiving
   * restores.
   */
  async sweepArchive(userId: string): Promise<number> {
    const cutoff = Math.floor(Date.now() / 1000) - ARCHIVE_AFTER_DAYS * 86_400
    const { rowCount } = await this.pool.query(
      `UPDATE tasks t SET archived = true
        WHERE t.user_id = $1
          AND t.status = 'done'
          AND t.archived = false
          AND t.done_at IS NOT NULL
          AND t.done_at <= $2
          AND NOT EXISTS (
                SELECT 1 FROM items i JOIN spaces sp ON sp.id = i.space_id
                 WHERE i.id = t.item_id AND (i.archived OR sp.archived))`,
      [userId, cutoff],
    )
    return rowCount ?? 0
  }

  async setTaskPriority(userId: string, id: number, priority: TaskPriority): Promise<void> {
    await this.writeTaskField(userId, id, 'priority', priority)
  }

  async setTaskTags(userId: string, id: number, tags: string): Promise<void> {
    await this.writeTaskField(userId, id, 'tags', tags)
  }

  async setTaskCategory(userId: string, id: number, category: string): Promise<void> {
    await this.writeTaskField(userId, id, 'category', category)
  }

  async setTaskArchived(userId: string, id: number, archived: boolean): Promise<void> {
    await this.writeTaskField(userId, id, 'archived', archived)
  }

  async setTaskDueDate(userId: string, id: number, dueDate: string | null): Promise<void> {
    await this.writeTaskField(userId, id, 'due_date', dueDate)
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

  // Notes are authorised the same way as the task itself, so a note can be
  // read and written on a shared task opened from the main list.
  async getNotesForTask(userId: string, taskId: number): Promise<Note[]> {
    return this.getItemTaskNotes(userId, taskId)
  }

  async upsertTaskNote(userId: string, taskId: number, content: string): Promise<Note> {
    return this.upsertItemTaskNote(userId, taskId, content)
  }

  /**
   * The tags in use across the caller's tasks, so the picker can offer them
   * without any separate bookkeeping — typing a new one makes it available
   * everywhere next time.
   */
  async getAllTags(userId: string): Promise<string[]> {
    const { rows } = await this.pool.query<{ tag: string }>(
      `SELECT DISTINCT btrim(tag) AS tag
       FROM tasks, unnest(string_to_array(tags, ',')) AS tag
       WHERE user_id = $1 AND btrim(tag) <> ''
       ORDER BY tag`,
      [userId],
    )
    return rows.map((r) => r.tag)
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
  /**
   * The single place access is resolved. A share on the item's parent space
   * cascades to the item, and if someone holds both, the more permissive one
   * wins. Everything below funnels through here, so sharing can't leak.
   */
  private async itemAccess(userId: string, itemId: number): Promise<Access> {
    const { rows } = await this.pool.query<{
      user_id: string
      item_permission: string | null
      space_permission: string | null
    }>(
      `SELECT i.user_id,
              (SELECT s.permission FROM item_shares s
                WHERE s.item_id = i.id AND s.email = me.email) AS item_permission,
              (SELECT sp.permission FROM space_shares sp
                WHERE sp.space_id = i.space_id AND sp.email = me.email) AS space_permission
       FROM items i
       CROSS JOIN (SELECT lower(email) AS email FROM auth.users WHERE id = $2) me
       WHERE i.id = $1`,
      [itemId, userId],
    )
    const row = rows[0]
    if (!row) throw notFound('Item')
    if (row.user_id === userId) return { access: 'owner', ownerId: row.user_id, itemId }
    const granted = bestPermission(row.item_permission, row.space_permission)
    if (!granted) throw notFound('Item')
    return { access: granted, ownerId: row.user_id, itemId }
  }

  /** The same resolution, for operations that act on a space itself. */
  private async spaceAccess(
    userId: string,
    spaceId: number,
  ): Promise<{ access: 'owner' | 'edit' | 'view'; ownerId: string }> {
    const { rows } = await this.pool.query<{ user_id: string; permission: string | null }>(
      `SELECT s.user_id,
              (SELECT sp.permission FROM space_shares sp
                WHERE sp.space_id = s.id
                  AND sp.email = (SELECT lower(email) FROM auth.users WHERE id = $2)) AS permission
       FROM spaces s WHERE s.id = $1`,
      [spaceId, userId],
    )
    const row = rows[0]
    if (!row) throw notFound('Space')
    if (row.user_id === userId) return { access: 'owner', ownerId: row.user_id }
    const granted = bestPermission(row.permission)
    if (!granted) throw notFound('Space')
    return { access: granted, ownerId: row.user_id }
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

  private requireWrite<T extends { access: string }>(access: T): T {
    if (access.access === 'view') throw forbidden()
    return access
  }

  private requireOwner<T extends { access: string }>(access: T): T {
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

  async getSharedSpaces(userId: string): Promise<SharedSpace[]> {
    const { rows } = await this.pool.query<SharedSpace>(
      `SELECT s.*, sh.permission, ${OWNER_NAME_SQL} AS owner_name
       FROM space_shares sh
       JOIN spaces s ON s.id = sh.space_id
       JOIN auth.users u ON u.id = s.user_id
       WHERE sh.email = (SELECT lower(email) FROM auth.users WHERE id = $1)
         AND s.user_id <> $1
       ORDER BY s.name, s.id`,
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

  async setSpaceArchived(userId: string, id: number, archived: boolean): Promise<void> {
    this.requireOwner(await this.spaceAccess(userId, id))
    await this.pool.query('UPDATE spaces SET archived = $1 WHERE id = $2', [archived, id])
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

  /**
   * Items reachable through a share — either shared directly, or sitting in a
   * shared space. The sidebar nests the ones whose space is also shared and
   * lists the rest flat.
   */
  async getSharedItems(userId: string): Promise<SharedItem[]> {
    const { rows } = await this.pool.query<SharedItem>(
      `SELECT i.*, ${OWNER_NAME_SQL} AS owner_name,
              CASE WHEN ish.permission = 'edit' OR ssh.permission = 'edit'
                   THEN 'edit' ELSE 'view' END AS permission
       FROM items i
       JOIN auth.users u ON u.id = i.user_id
       CROSS JOIN (SELECT lower(email) AS email FROM auth.users WHERE id = $1) me
       LEFT JOIN item_shares ish ON ish.item_id = i.id AND ish.email = me.email
       LEFT JOIN space_shares ssh ON ssh.space_id = i.space_id AND ssh.email = me.email
       WHERE (ish.id IS NOT NULL OR ssh.id IS NOT NULL) AND i.user_id <> $1
       ORDER BY i.space_id, i.position, i.id`,
      [userId],
    )
    return rows
  }

  async createItem(userId: string, spaceId: number, name: string): Promise<Item> {
    // Anyone who can edit the space can add to it; the item belongs to the
    // space's owner, so it lands in their tree rather than the editor's.
    const { ownerId } = this.requireWrite(await this.spaceAccess(userId, spaceId))
    return this.transaction(async (client) => {
      const { rows } = await client.query<Item>(
        `INSERT INTO items (space_id, user_id, name, position)
         VALUES ($1, $2, $3,
                 COALESCE((SELECT MAX(position) + 1 FROM items WHERE space_id = $1), 0))
         RETURNING *`,
        [spaceId, ownerId, name],
      )
      const item = rows[0]
      for (const [index, page] of STARTER_PAGES.entries()) {
        await client.query(
          'INSERT INTO pages (item_id, user_id, name, kind, position) VALUES ($1, $2, $3, $4, $5)',
          [item.id, ownerId, page.name, page.kind, index],
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

  async setItemArchived(userId: string, id: number, archived: boolean): Promise<void> {
    this.requireWrite(await this.itemAccess(userId, id))
    await this.pool.query('UPDATE items SET archived = $1 WHERE id = $2', [archived, id])
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

  async setPageColumns(userId: string, id: number, columns: PageColumn[]): Promise<void> {
    this.requireWrite(await this.pageAccess(userId, id))
    await this.pool.query('UPDATE pages SET columns = $1 WHERE id = $2', [
      JSON.stringify(columns),
      id,
    ])
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

  /**
   * Notes on a task belonging to an item. Authorised through the item rather
   * than task ownership, so someone editing a shared item can use them — the
   * personal getNotesForTask filters on tasks.user_id and would find nothing.
   */
  async getItemTaskNotes(userId: string, taskId: number): Promise<Note[]> {
    await this.taskAccess(userId, taskId)
    const { rows } = await this.pool.query<Note>(
      'SELECT * FROM notes WHERE task_id = $1 ORDER BY created_at ASC',
      [taskId],
    )
    return rows
  }

  async upsertItemTaskNote(userId: string, taskId: number, content: string): Promise<Note> {
    this.requireWrite(await this.taskAccess(userId, taskId))
    const now = Math.floor(Date.now() / 1000)
    const existing = await this.pool.query<Note>(
      'SELECT * FROM notes WHERE task_id = $1 ORDER BY created_at ASC LIMIT 1',
      [taskId],
    )
    if (existing.rows[0]) {
      const { rows } = await this.pool.query<Note>(
        'UPDATE notes SET content = $1, updated_at = $2 WHERE id = $3 RETURNING *',
        [content, now, existing.rows[0].id],
      )
      return rows[0]
    }
    const today = new Date().toISOString().slice(0, 10)
    const { rows } = await this.pool.query<Note>(
      'INSERT INTO notes (task_id, content, date, updated_at) VALUES ($1, $2, $3, $4) RETURNING *',
      [taskId, content, today, now],
    )
    return rows[0]
  }

  async updateItemTask(userId: string, taskId: number, patch: TaskPatch): Promise<void> {
    this.requireWrite(await this.taskAccess(userId, taskId))
    const sets: string[] = []
    const values: unknown[] = []
    for (const key of ['title', 'status', 'priority', 'due_date', 'tags'] as const) {
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
      `INSERT INTO people (page_id, user_id, name, role, contact, note, fields, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               COALESCE((SELECT MAX(position) + 1 FROM people WHERE page_id = $1), 0))
       RETURNING *`,
      [pageId, ownerId, person.name, person.role, person.contact, person.note, JSON.stringify(person.fields)],
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
    // Merged rather than replaced, so saving one cell can't drop the others.
    if (patch.fields !== undefined) {
      values.push(JSON.stringify(patch.fields))
      sets.push(`fields = fields || $${values.length}::jsonb`)
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

  async getSpaceShares(userId: string, spaceId: number): Promise<SpaceShare[]> {
    this.requireOwner(await this.spaceAccess(userId, spaceId))
    const { rows } = await this.pool.query<SpaceShare>(
      'SELECT * FROM space_shares WHERE space_id = $1 ORDER BY created_at',
      [spaceId],
    )
    return rows
  }

  async shareSpace(
    userId: string,
    spaceId: number,
    email: string,
    permission: SharePermission,
  ): Promise<SpaceShare> {
    this.requireOwner(await this.spaceAccess(userId, spaceId))
    const { rows } = await this.pool.query<SpaceShare>(
      `INSERT INTO space_shares (space_id, owner_id, email, permission)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (space_id, email) DO UPDATE SET permission = EXCLUDED.permission
       RETURNING *`,
      [spaceId, userId, email.trim().toLowerCase(), permission],
    )
    return rows[0]
  }

  async unshareSpace(userId: string, shareId: number): Promise<void> {
    await this.pool.query('DELETE FROM space_shares WHERE id = $1 AND owner_id = $2', [
      shareId,
      userId,
    ])
  }

  /**
   * Everything an item's reader view needs, in one round trip and with the
   * fields listed explicitly — no user ids, no share lists, nothing internal
   * that a spread of the raw rows would quietly carry along.
   */
  async getItemReadView(userId: string, itemId: number): Promise<ItemReadView | null> {
    let access: Access
    try {
      access = await this.itemAccess(userId, itemId)
    } catch {
      return null
    }

    const { rows: itemRows } = await this.pool.query<{
      id: number
      name: string
      icon: string
      date: string | null
      location: string
      description: string
      space_name: string
      space_icon: string
      owner_name: string
    }>(
      `SELECT i.id, i.name, i.icon, i.date, i.location, i.description,
              sp.name AS space_name, sp.icon AS space_icon,
              ${OWNER_NAME_SQL} AS owner_name
       FROM items i
       JOIN spaces sp ON sp.id = i.space_id
       JOIN auth.users u ON u.id = i.user_id
       WHERE i.id = $1`,
      [itemId],
    )
    const row = itemRows[0]
    if (!row) return null

    const { rows: pages } = await this.pool.query<Page>(
      'SELECT * FROM pages WHERE item_id = $1 ORDER BY position, id',
      [itemId],
    )
    const { rows: tasks } = await this.pool.query<{
      id: number
      page_id: number | null
      title: string
      status: TaskStatus
      due_date: string | null
    }>(
      `SELECT id, page_id, title, status, due_date FROM tasks
       WHERE item_id = $1 AND archived = false ORDER BY created_at`,
      [itemId],
    )
    // Columns listed explicitly — page_entries carries a user_id that must
    // not travel with the payload.
    const { rows: entries } = await this.pool.query<ReadEntry & { page_id: number }>(
      `SELECT e.id, e.page_id, e.day, e.time, e.title, e.note
       FROM page_entries e JOIN pages p ON p.id = e.page_id
       WHERE p.item_id = $1 ORDER BY e.day NULLS LAST, e.time, e.position, e.id`,
      [itemId],
    )
    const { rows: people } = await this.pool.query<ReadPerson & { page_id: number }>(
      `SELECT pe.id, pe.page_id, pe.name, pe.role, pe.contact, pe.note, pe.fields
       FROM people pe JOIN pages p ON p.id = pe.page_id
       WHERE p.item_id = $1 ORDER BY pe.position, pe.id`,
      [itemId],
    )

    return {
      item: {
        id: row.id,
        name: row.name,
        icon: row.icon,
        date: row.date,
        location: row.location,
        description: row.description,
      },
      space: { name: row.space_name, icon: row.space_icon },
      owner_name: row.owner_name,
      access: access.access,
      pages: pages.map((page) => ({
        id: page.id,
        name: page.name,
        kind: page.kind,
        content: page.content,
        columns: page.columns,
        tasks: tasks
          .filter((t) => t.page_id === page.id)
          .map((t) => ({
            id: t.id,
            title: t.title,
            done: t.status === 'done',
            due_date: t.due_date,
          })),
        entries: entries
          .filter((e) => e.page_id === page.id)
          .map(({ id, day, time, title, note }) => ({ id, day, time, title, note })),
        people: people
          .filter((p) => p.page_id === page.id)
          .map(({ id, name, role, contact, note, fields }) => ({ id, name, role, contact, note, fields })),
      })),
    }
  }
}
