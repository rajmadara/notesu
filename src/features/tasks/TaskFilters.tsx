import { useState } from 'react'
import { Calendar, ChevronDown, Users } from 'lucide-react'
import type { Item, Task, TaskPriority } from '../../lib/types'
import { tagsOf } from '../../lib/taskFilters'
import { todayISO } from '../../lib/date'
import { PRIORITY_OPTIONS } from '../../lib/priority'
import { useDismiss } from '../../lib/useDismiss'
import { PriorityDot } from './PriorityDot'

interface Props {
  /** Everything due by the chosen scope, before the item/tag checkboxes narrow
   *  it further — so an option's checkbox never disappears just because it's
   *  unchecked. */
  tasks: Task[]
  items: Item[]
  hiddenItemIds: number[]
  onToggleItem: (itemId: number) => void
  selectedTags: string[]
  onToggleTag: (tag: string) => void
  selectedPriorities: TaskPriority[]
  onTogglePriority: (priority: TaskPriority) => void
  /** 'today' | 'tomorrow' | an ISO date. */
  scope: string
  scopeLabel: string
  onChangeScope: (scope: string) => void
}

/**
 * The Today row's own controls: which day to look at, which items to include,
 * which tags to include — three dropdowns in place of a heading, so there's
 * no separate filter bar taking its own line. Items and tags are checkboxes
 * (several at once), the day is one choice.
 */
export function TaskFilters({
  tasks,
  items,
  hiddenItemIds,
  onToggleItem,
  selectedTags,
  onToggleTag,
  selectedPriorities,
  onTogglePriority,
  scope,
  scopeLabel,
  onChangeScope,
}: Props) {
  const [scopeOpen, setScopeOpen] = useState(false)
  const [itemsOpen, setItemsOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [priorityOpen, setPriorityOpen] = useState(false)
  const scopeRef = useDismiss(scopeOpen, () => setScopeOpen(false))
  const itemsRef = useDismiss(itemsOpen, () => setItemsOpen(false))
  const tagsRef = useDismiss(tagsOpen, () => setTagsOpen(false))
  const priorityRef = useDismiss(priorityOpen, () => setPriorityOpen(false))

  const counts = new Map<number, number>()
  for (const task of tasks) {
    if (task.item_id !== null) counts.set(task.item_id, (counts.get(task.item_id) ?? 0) + 1)
  }
  // Busiest first — and a hidden item stays listed (with a 0 count) even once
  // none of its tasks are showing, so it's never impossible to bring back.
  const present = items
    .filter((item) => counts.has(item.id))
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.name.localeCompare(b.name))
  const alsoHidden = items.filter((item) => hiddenItemIds.includes(item.id) && !counts.has(item.id))
  const itemOptions = [...present, ...alsoHidden]

  const tags = [...new Set(tasks.flatMap(tagsOf))].sort((a, b) => a.localeCompare(b))

  const priorityCounts = new Map<TaskPriority, number>()
  for (const task of tasks) {
    priorityCounts.set(task.priority, (priorityCounts.get(task.priority) ?? 0) + 1)
  }
  // Pointless to offer when every task is unprioritised — unless something is
  // already ticked, which must stay reachable so it can be cleared.
  const showPriority =
    selectedPriorities.length > 0 ||
    PRIORITY_OPTIONS.some((o) => o.value !== 'none' && priorityCounts.has(o.value))

  // A shared item's tasks are someone else's, so its row says whose.
  const ownerOf = (itemId: number) =>
    tasks.find((t) => t.item_id === itemId && t.owner_name)?.owner_name

  return (
    <div className="task-page__controls">
      <div className="menu-anchor" ref={scopeRef}>
        <button
          type="button"
          className="section-title section-title--btn"
          onClick={() => setScopeOpen((v) => !v)}
          aria-expanded={scopeOpen}
        >
          {scopeLabel}
          <ChevronDown size={14} className={scopeOpen ? 'is-open' : undefined} />
        </button>
        {scopeOpen && (
          <div className="menu menu--left">
            <button
              type="button"
              className={`menu__item${scope === 'today' ? ' is-selected' : ''}`}
              onClick={() => {
                onChangeScope('today')
                setScopeOpen(false)
              }}
            >
              Today
            </button>
            <button
              type="button"
              className={`menu__item${scope === 'tomorrow' ? ' is-selected' : ''}`}
              onClick={() => {
                onChangeScope('tomorrow')
                setScopeOpen(false)
              }}
            >
              Tomorrow
            </button>
            <label className="menu__item menu__item--date">
              <Calendar size={14} />
              Pick a date
              <input
                type="date"
                className="menu__date-input"
                value={scope !== 'today' && scope !== 'tomorrow' ? scope : todayISO()}
                onChange={(e) => {
                  if (!e.target.value) return
                  onChangeScope(e.target.value)
                  setScopeOpen(false)
                }}
              />
            </label>
          </div>
        )}
      </div>

      {itemOptions.length > 0 && (
        <div className="menu-anchor" ref={itemsRef}>
          <button
            type="button"
            className={`filter-trigger${hiddenItemIds.length > 0 ? ' is-active' : ''}`}
            onClick={() => setItemsOpen((v) => !v)}
            aria-expanded={itemsOpen}
          >
            Items
            {hiddenItemIds.length > 0 && (
              <span className="filter-trigger__count">{hiddenItemIds.length} hidden</span>
            )}
            <ChevronDown size={12} />
          </button>
          {itemsOpen && (
            <div className="menu menu--left">
              {itemOptions.map((item) => {
                const owner = ownerOf(item.id)
                return (
                  <label key={item.id} className="menu__item menu__item--checkbox">
                    <input
                      type="checkbox"
                      checked={!hiddenItemIds.includes(item.id)}
                      onChange={() => onToggleItem(item.id)}
                    />
                    {owner && (
                      <span className="filter-chip__shared" title={`Shared with you by ${owner}`}>
                        <Users size={11} />
                      </span>
                    )}
                    <span className="menu__item-label">{item.name}</span>
                    <span className="menu__item-count">{counts.get(item.id) ?? 0}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tags.length > 0 && (
        <div className="menu-anchor" ref={tagsRef}>
          <button
            type="button"
            className={`filter-trigger${selectedTags.length > 0 ? ' is-active' : ''}`}
            onClick={() => setTagsOpen((v) => !v)}
            aria-expanded={tagsOpen}
          >
            Tags
            {selectedTags.length > 0 && (
              <span className="filter-trigger__count">{selectedTags.length}</span>
            )}
            <ChevronDown size={12} />
          </button>
          {tagsOpen && (
            <div className="menu menu--left">
              {tags.map((tag) => (
                <label key={tag} className="menu__item menu__item--checkbox">
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag)}
                    onChange={() => onToggleTag(tag)}
                  />
                  <span className="menu__item-label">{tag}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {showPriority && (
        <div className="menu-anchor" ref={priorityRef}>
          <button
            type="button"
            className={`filter-trigger${selectedPriorities.length > 0 ? ' is-active' : ''}`}
            onClick={() => setPriorityOpen((v) => !v)}
            aria-expanded={priorityOpen}
          >
            Priority
            {selectedPriorities.length > 0 && (
              <span className="filter-trigger__count">{selectedPriorities.length}</span>
            )}
            <ChevronDown size={12} />
          </button>
          {priorityOpen && (
            <div className="menu menu--left">
              {PRIORITY_OPTIONS.map((option) => (
                <label key={option.value} className="menu__item menu__item--checkbox">
                  <input
                    type="checkbox"
                    checked={selectedPriorities.includes(option.value)}
                    onChange={() => onTogglePriority(option.value)}
                  />
                  <PriorityDot value={option.value} />
                  <span className="menu__item-label">{option.label}</span>
                  <span className="menu__item-count">{priorityCounts.get(option.value) ?? 0}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
