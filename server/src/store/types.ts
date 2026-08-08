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

// Storage-agnostic contract. Implement this once per backend (Postgres/Supabase
// today, something else later) and the routes layer never has to change.
export interface TaskStore {
  getAllTasks(): Promise<Task[]>
  createTask(title: string): Promise<Task>
  deleteTask(id: number): Promise<void>
  setTaskTitle(id: number, title: string): Promise<void>
  setTaskStatus(id: number, status: TaskStatus): Promise<void>
  setTaskPriority(id: number, priority: TaskPriority): Promise<void>
  setTaskTags(id: number, tags: string): Promise<void>
  startTaskTimer(id: number): Promise<number>
  stopTaskTimer(id: number): Promise<void>
  resetTaskTimer(id: number): Promise<void>
  getNotesForTask(taskId: number): Promise<Note[]>
  upsertTaskNote(taskId: number, content: string): Promise<Note>
}
