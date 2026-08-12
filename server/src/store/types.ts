export type TaskStatus = 'not_started' | 'in_progress' | 'done'
export type TaskPriority =
  | 'urgent_important'
  | 'urgent_not_important'
  | 'important_not_urgent'
  | 'none'

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
  category: string
  user_id: string
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
// Every method takes the caller's userId first, so no implementation can
// accidentally return or mutate another user's data.
export interface TaskStore {
  getAllTasks(userId: string): Promise<Task[]>
  createTask(userId: string, title: string, category: string): Promise<Task>
  deleteTask(userId: string, id: number): Promise<void>
  setTaskTitle(userId: string, id: number, title: string): Promise<void>
  setTaskStatus(userId: string, id: number, status: TaskStatus): Promise<void>
  setTaskPriority(userId: string, id: number, priority: TaskPriority): Promise<void>
  setTaskTags(userId: string, id: number, tags: string): Promise<void>
  startTaskTimer(userId: string, id: number): Promise<number>
  stopTaskTimer(userId: string, id: number): Promise<void>
  resetTaskTimer(userId: string, id: number): Promise<void>
  getNotesForTask(userId: string, taskId: number): Promise<Note[]>
  upsertTaskNote(userId: string, taskId: number, content: string): Promise<Note>
}
