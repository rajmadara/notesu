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
}

export interface Note {
  id: number
  task_id: number | null
  content: string
  date: string
  created_at: number
  updated_at: number
}

export interface Habit {
  id: number
  name: string
  target_frequency: number
  created_at: number
}

export interface HabitEntry {
  id: number
  habit_id: number
  date: string
  completed: number
}
