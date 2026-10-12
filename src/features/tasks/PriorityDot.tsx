import type { TaskPriority } from '../../lib/types'

/** The quadrant's colour as a dot. Pair it with the name — see lib/priority. */
export function PriorityDot({ value }: { value: TaskPriority }) {
  return <span className={`priority-dot priority-dot--${value}`} aria-hidden="true" />
}
