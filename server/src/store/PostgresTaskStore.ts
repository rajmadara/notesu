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

const MIGRATIONS = ['0001_init.sql']

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

  async getAllTasks(): Promise<Task[]> {
    const { rows } = await this.pool.query<Task>('SELECT * FROM tasks ORDER BY created_at DESC')
    return rows
  }

  async createTask(title: string): Promise<Task> {
    const today = new Date().toISOString().slice(0, 10)
    const { rows } = await this.pool.query<Task>(
      "INSERT INTO tasks (title, date, priority) VALUES ($1, $2, 'default') RETURNING *",
      [title, today],
    )
    return rows[0]
  }

  async deleteTask(id: number): Promise<void> {
    await this.pool.query('DELETE FROM tasks WHERE id = $1', [id])
  }

  async setTaskTitle(id: number, title: string): Promise<void> {
    await this.pool.query('UPDATE tasks SET title = $1 WHERE id = $2', [title, id])
  }

  async setTaskStatus(id: number, status: TaskStatus): Promise<void> {
    await this.pool.query('UPDATE tasks SET status = $1 WHERE id = $2', [status, id])
  }

  async setTaskPriority(id: number, priority: TaskPriority): Promise<void> {
    await this.pool.query('UPDATE tasks SET priority = $1 WHERE id = $2', [priority, id])
  }

  async setTaskTags(id: number, tags: string): Promise<void> {
    await this.pool.query('UPDATE tasks SET tags = $1 WHERE id = $2', [tags, id])
  }

  async startTaskTimer(id: number): Promise<number> {
    const now = Date.now()
    await this.pool.query(
      "UPDATE tasks SET running_since = $1, status = 'in_progress' WHERE id = $2 AND running_since IS NULL",
      [now, id],
    )
    return now
  }

  async stopTaskTimer(id: number): Promise<void> {
    const { rows } = await this.pool.query<Task>('SELECT * FROM tasks WHERE id = $1', [id])
    const task = rows[0]
    if (!task || task.running_since === null) return
    const elapsed = Math.floor((Date.now() - Number(task.running_since)) / 1000)
    await this.pool.query(
      'UPDATE tasks SET seconds = seconds + $1, running_since = NULL WHERE id = $2',
      [elapsed, id],
    )
  }

  async resetTaskTimer(id: number): Promise<void> {
    await this.pool.query('UPDATE tasks SET seconds = 0, running_since = NULL WHERE id = $1', [id])
  }

  async getNotesForTask(taskId: number): Promise<Note[]> {
    const { rows } = await this.pool.query<Note>(
      'SELECT * FROM notes WHERE task_id = $1 ORDER BY created_at ASC',
      [taskId],
    )
    return rows
  }

  async upsertTaskNote(taskId: number, content: string): Promise<Note> {
    const now = Math.floor(Date.now() / 1000)
    const existing = await this.getNotesForTask(taskId)
    if (existing.length > 0) {
      const { rows } = await this.pool.query<Note>(
        'UPDATE notes SET content = $1, updated_at = $2 WHERE id = $3 RETURNING *',
        [content, now, existing[0].id],
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
}
