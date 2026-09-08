import { Users } from 'lucide-react'
import type { Item, Task } from '../../lib/types'
import { tagsOf, type Filters } from '../../lib/taskFilters'

interface Props {
  /** The unfiltered tasks the bar is describing — the options come from these. */
  tasks: Task[]
  items: Item[]
  filters: Filters
  onChange: (filters: Filters) => void
}

/**
 * Item chips and a tag dropdown over a task list. The options are derived from
 * the tasks in front of the user rather than from everything that exists, so
 * the bar never offers a choice that would empty the list.
 */
export function TaskFilters({ tasks, items, filters, onChange }: Props) {
  // Items are ordered by how much is outstanding, so the busy ones lead.
  const counts = new Map<number, number>()
  for (const task of tasks) {
    if (task.item_id !== null) counts.set(task.item_id, (counts.get(task.item_id) ?? 0) + 1)
  }
  const present = items
    .filter((item) => counts.has(item.id))
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.name.localeCompare(b.name))

  const tags = [...new Set(tasks.flatMap(tagsOf))].sort((a, b) => a.localeCompare(b))

  // An item filter that no longer matches anything would strand the user on an
  // empty list with no obvious way back, so keep the chip visible in that case.
  const activeItem = filters.item !== 'all' ? items.find((i) => i.id === filters.item) : undefined
  const chips = activeItem && !present.some((i) => i.id === activeItem.id)
    ? [activeItem, ...present]
    : present

  if (chips.length < 2 && tags.length === 0) return null

  // A shared item's tasks are someone else's, so its chip says whose.
  const ownerOf = (itemId: number) =>
    tasks.find((t) => t.item_id === itemId && t.owner_name)?.owner_name

  return (
    <div className="task-filters">
      <div className="task-filters__chips">
        <button
          type="button"
          className={`filter-chip${filters.item === 'all' ? ' is-active' : ''}`}
          onClick={() => onChange({ ...filters, item: 'all' })}
        >
          All items
        </button>
        {chips.map((item) => {
          const owner = ownerOf(item.id)
          return (
            <button
              key={item.id}
              type="button"
              className={`filter-chip${filters.item === item.id ? ' is-active' : ''}`}
              onClick={() =>
                onChange({ ...filters, item: filters.item === item.id ? 'all' : item.id })
              }
              title={owner ? `Shared with you by ${owner}` : undefined}
            >
              {owner && <Users size={11} className="filter-chip__shared" />}
              {item.name}
              <span className="filter-chip__count">{counts.get(item.id) ?? 0}</span>
            </button>
          )
        })}
      </div>

      {tags.length > 0 && (
        <select
          className="task-filters__tag"
          value={filters.tag}
          onChange={(e) => onChange({ ...filters, tag: e.target.value })}
          aria-label="Filter by tag"
        >
          <option value="all">All tags</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
