import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Note, Task, TaskPriority, TaskStatus, TaskStore } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(__dirname, '../../migrations')

const MIGRATIONS = [
  '0001_initial.sql',
  '0002_priority_tags_updated_at.sql',
  '0003_priority_color_codes.sql',
]

function applyMigrations(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `)
  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all().map((r) => (r as { name: string }).name),
  )
  for (const name of MIGRATIONS) {
    if (applied.has(name)) continue
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf-8')
    db.exec(sql)
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(name)
  }
}

export class SqliteTaskStore implements TaskStore {
  private db: DatabaseSync

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath)
    this.db.exec('PRAGMA journal_mode = WAL')
    applyMigrations(this.db)
  }

  getAllTasks(): Task[] {
    return this.db
      .prepare('SELECT * FROM tasks ORDER BY created_at DESC')
      .all() as unknown as Task[]
  }

  createTask(title: string): Task {
    const today = new Date().toISOString().slice(0, 10)
    const result = this.db
      .prepare("INSERT INTO tasks (title, date, priority) VALUES (?, ?, 'default')")
      .run(title, today)
    return this.db
      .prepare('SELECT * FROM tasks WHERE id = ?')
      .get(result.lastInsertRowid) as unknown as Task
  }

  deleteTask(id: number): void {
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  }

  setTaskStatus(id: number, status: TaskStatus): void {
    this.db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, id)
  }

  setTaskPriority(id: number, priority: TaskPriority): void {
    this.db
      .prepare('UPDATE tasks SET priority = ? WHERE id = ?')
      .run(priority, id)
  }

  setTaskTags(id: number, tags: string): void {
    this.db.prepare('UPDATE tasks SET tags = ? WHERE id = ?').run(tags, id)
  }

  startTaskTimer(id: number): number {
    const now = Date.now()
    this.db
      .prepare(
        "UPDATE tasks SET running_since = ?, status = 'in_progress' WHERE id = ? AND running_since IS NULL",
      )
      .run(now, id)
    return now
  }

  stopTaskTimer(id: number): void {
    const task = this.db
      .prepare('SELECT * FROM tasks WHERE id = ?')
      .get(id) as unknown as Task | undefined
    if (!task || task.running_since === null) return
    const elapsed = Math.floor((Date.now() - task.running_since) / 1000)
    this.db
      .prepare(
        'UPDATE tasks SET seconds = seconds + ?, running_since = NULL WHERE id = ?',
      )
      .run(elapsed, id)
  }

  resetTaskTimer(id: number): void {
    this.db
      .prepare(
        'UPDATE tasks SET seconds = 0, running_since = NULL WHERE id = ?',
      )
      .run(id)
  }

  getNotesForTask(taskId: number): Note[] {
    return this.db
      .prepare('SELECT * FROM notes WHERE task_id = ? ORDER BY created_at ASC')
      .all(taskId) as unknown as Note[]
  }

  upsertTaskNote(taskId: number, content: string): Note {
    const now = Math.floor(Date.now() / 1000)
    const existing = this.getNotesForTask(taskId)
    if (existing.length > 0) {
      this.db
        .prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ?')
        .run(content, now, existing[0].id)
      return { ...existing[0], content, updated_at: now }
    }
    const today = new Date().toISOString().slice(0, 10)
    const result = this.db
      .prepare(
        'INSERT INTO notes (task_id, content, date, updated_at) VALUES (?, ?, ?, ?)',
      )
      .run(taskId, content, today, now)
    return {
      id: Number(result.lastInsertRowid),
      task_id: taskId,
      content,
      date: today,
      created_at: now,
      updated_at: now,
    }
  }
}
