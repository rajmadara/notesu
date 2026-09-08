import type { Task } from './types'

export interface Filters {
  /** An item id, or 'all'. */
  item: number | 'all'
  /** A tag name, or 'all'. */
  tag: string | 'all'
}

export const NO_FILTERS: Filters = { item: 'all', tag: 'all' }

/** Tags travel as one comma-separated string on the task. */
export function tagsOf(task: Task): string[] {
  return task.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

/** Whether a task survives the current filters. */
export function matchesFilters(task: Task, filters: Filters): boolean {
  if (filters.item !== 'all' && task.item_id !== filters.item) return false
  if (filters.tag !== 'all' && !tagsOf(task).some((t) => t === filters.tag)) return false
  return true
}

export const isFiltering = (filters: Filters) => filters.item !== 'all' || filters.tag !== 'all'
