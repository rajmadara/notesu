export type TaskStatus = 'not_started' | 'in_progress' | 'done'
export type TaskPriority = 'default' | 'amber' | 'red'

export interface Task {
  id: number
  title: string
  status: TaskStatus
  seconds: number
  running_since: number | null
  date: string
  created_at: number
  priority: TaskPriority
  tags: string
}

export interface Note {
  id: number
  task_id: number | null
  content: string
  date: string
  created_at: number
  updated_at: number
}

// Storage-agnostic contract. Implement this once per backend (local SQLite
// today, a cloud DB like Postgres/Supabase later) and the routes layer never
// has to change.
export interface TaskStore {
  getAllTasks(): Task[]
  createTask(title: string): Task
  deleteTask(id: number): void
  setTaskStatus(id: number, status: TaskStatus): void
  setTaskPriority(id: number, priority: TaskPriority): void
  setTaskTags(id: number, tags: string): void
  startTaskTimer(id: number): number
  stopTaskTimer(id: number): void
  resetTaskTimer(id: number): void
  getNotesForTask(taskId: number): Note[]
  upsertTaskNote(taskId: number, content: string): Note
}
