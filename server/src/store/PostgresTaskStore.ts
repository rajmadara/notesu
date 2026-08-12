import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import type { Note, Task, TaskPriority, TaskStatus, TaskStore } from './types.js'

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

export class PostgresTaskStore implements TaskStore {
  constructor(private pool: pg.Pool) {}

  async getAllTasks(userId: string): Promise<Task[]> {
    const { rows } = await this.pool.query<Task>(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    )
    return rows
  }

  async createTask(userId: string, title: string, category: string): Promise<Task> {
    const today = new Date().toISOString().slice(0, 10)
    const { rows } = await this.pool.query<Task>(
      `INSERT INTO tasks (title, date, priority, user_id, category)
       VALUES ($1, $2, 'none', $3, $4) RETURNING *`,
      [title, today, userId, category],
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
      throw new Error('Task not found or not owned by this user')
    }
    return rows[0]
  }
}
