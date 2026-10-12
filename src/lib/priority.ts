import type { TaskPriority } from './types'

/**
 * The four Eisenhower quadrants, in the order they read best: most pressing
 * first. The names matter — a colour alone can't tell "urgent, not important"
 * from "important, not urgent".
 */
export const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'urgent_important', label: 'Urgent & important' },
  { value: 'urgent_not_important', label: 'Urgent, not important' },
  { value: 'important_not_urgent', label: 'Important, not urgent' },
  { value: 'none', label: 'None' },
]

export const priorityLabel = (value: TaskPriority) =>
  PRIORITY_OPTIONS.find((o) => o.value === value)?.label ?? 'None'
