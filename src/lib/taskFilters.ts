import type { Task } from './types'

/** Tags travel as one comma-separated string on the task. */
export function tagsOf(task: Task): string[] {
  return task.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

/** A task matches if no tags are selected, or it carries any one of them. */
export function matchesTags(task: Task, selectedTags: string[]): boolean {
  if (selectedTags.length === 0) return true
  return tagsOf(task).some((t) => selectedTags.includes(t))
}
