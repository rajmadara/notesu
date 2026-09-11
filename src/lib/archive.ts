import type { Item, Space, Task } from './types'

/** Matches ARCHIVE_AFTER_DAYS on the server. */
export const ARCHIVE_AFTER_DAYS = 7
const DAY = 86_400

/**
 * Why something is out of the active lists. Archiving is inherited rather than
 * copied — a task inside an archived item is hidden without its own flag being
 * set — so the reason matters: it decides where the Archived view files it, and
 * what unarchiving restores.
 */
export type ArchiveReason = 'task' | 'item' | 'space' | null

export function archiveReason(
  task: Task,
  items: Map<number, Item>,
  spaces: Map<number, Space>,
): ArchiveReason {
  if (task.archived) return 'task'
  if (task.item_id === null) return null
  const item = items.get(task.item_id)
  if (!item) return null
  if (item.archived) return 'item'
  return spaces.get(item.space_id)?.archived ? 'space' : null
}

export const byId = <T extends { id: number }>(rows: T[]): Map<number, T> =>
  new Map(rows.map((row) => [row.id, row]))

/**
 * Days until a finished task is swept away, or null when it isn't counting
 * down. Zero means today — the warning the user asked for lands at 1.
 */
export function daysUntilArchived(task: Task, now = Date.now()): number | null {
  if (task.archived || task.status !== 'done' || task.done_at === null) return null
  const elapsed = (now / 1000 - task.done_at) / DAY
  return Math.max(0, Math.ceil(ARCHIVE_AFTER_DAYS - elapsed))
}

/** Whether to warn on the row: the last day before it goes. */
export const archivingSoon = (task: Task, now = Date.now()): boolean => {
  const days = daysUntilArchived(task, now)
  return days !== null && days <= 1
}
