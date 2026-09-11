import { Suspense, lazy, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import type { Item, Space, Task, TaskPriority } from '../../lib/types'
import { dueLabel, dueTone, formatShortDate, greeting, todayISO } from '../../lib/date'
import { HeaderTitle } from '../shell/HeaderSlot'
import { EntityIcon } from '../workspace/EntityIcon'
import { DEFAULT_ITEM_ICON } from '../../lib/icons'
import { AddTaskDialog } from '../tasks/AddTaskDialog'
import { TaskRow } from '../tasks/TaskRow'
import { TaskFilters } from '../tasks/TaskFilters'
import { NO_FILTERS, isFiltering, matchesFilters, type Filters } from '../../lib/taskFilters'

// ~390kB of editor, only once someone opens a task.
const TaskDetailPanel = lazy(() =>
  import('../dailyTasks/TaskDetailPanel').then((m) => ({ default: m.TaskDetailPanel })),
)

interface Props {
  name: string
  tasks: Task[]
  items: Item[]
  /** Items shared with the user — needed to name the item a shared task sits on. */
  sharedItems: Item[]
  spaces: Space[]
  searchResults: Task[] | null
  onAddTask: (title: string, itemId: number | null, dueDate: string | null) => Promise<void>
  onToggleTask: (task: Task) => Promise<void>
  onRenameTask: (task: Task, title: string) => Promise<void>
  onChangePriority: (task: Task, priority: TaskPriority) => Promise<void>
  onChangeDueDate: (task: Task, dueDate: string | null) => Promise<void>
  onChangeTags: (task: Task, tags: string[]) => Promise<void>
  onArchiveTask: (task: Task) => Promise<void>
  onDeleteTask: (task: Task) => Promise<void>
  onOpenItem: (itemId: number) => void
}

/**
 * The one task surface. Today's work first, then what's coming up across the
 * user's items. Archived and search reuse the same list rather than living on
 * a separate page that looked almost identical.
 */
export function Home({
  name,
  tasks,
  items,
  sharedItems,
  spaces,
  searchResults,
  onAddTask,
  onToggleTask,
  onRenameTask,
  onChangePriority,
  onChangeDueDate,
  onChangeTags,
  onArchiveTask,
  onDeleteTask,
  onOpenItem,
}: Props) {
  const [title, setTitle] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [showLater, setShowLater] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)

  const searching = searchResults !== null
  const today = todayISO()

  // App hands over only what belongs on the list; the archive is its own view.
  const active = tasks
  const byUrgency = (a: Task, b: Task) => {
    if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1
    return (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || b.created_at - a.created_at
  }
  // "Today" is the actionable set: anything due by today, plus everything with
  // no date at all. Dated-for-later waits behind the toggle.
  const todays = active.filter((t) => !t.due_date || t.due_date <= today).sort(byUrgency)
  const later = active
    .filter((t) => t.due_date && t.due_date > today)
    .filter((t) => matchesFilters(t, filters))
    .sort(byUrgency)
  const doneCount = todays.filter((t) => matchesFilters(t, filters) && t.status === 'done').length

  // The bar's options come from the unfiltered set, so choosing one filter
  // never hides the others.
  const inScope = searching ? searchResults : todays
  const listed = inScope.filter((t) => matchesFilters(t, filters)).sort(byUrgency)

  const remainingByItem = new Map<number, number>()
  for (const t of active) {
    if (t.item_id !== null && t.status !== 'done') {
      remainingByItem.set(t.item_id, (remainingByItem.get(t.item_id) ?? 0) + 1)
    }
  }
  const allItems = [...items, ...sharedItems]
  const upcoming = allItems
    .filter((i) => (i.date && i.date >= today) || (remainingByItem.get(i.id) ?? 0) > 0)
    .sort((a, b) => {
      if (a.date && b.date) return a.date.localeCompare(b.date)
      if (a.date) return -1
      if (b.date) return 1
      return (remainingByItem.get(b.id) ?? 0) - (remainingByItem.get(a.id) ?? 0)
    })
    .slice(0, 6)
  const spaceName = (id: number) => spaces.find((s) => s.id === id)?.name ?? ''
  const selected = tasks.find((t) => t.id === selectedId) ?? null

  function startAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setPending(trimmed)
  }

  const row = (task: Task) => (
    <TaskRow
      key={task.id}
      task={task}
      itemName={task.item_id !== null ? allItems.find((i) => i.id === task.item_id)?.name : undefined}
      hideTodayChip={!searching}
      onToggle={onToggleTask}
      onOpen={(t) => setSelectedId(t.id)}
      onOpenItem={onOpenItem}
    />
  )

  return (
    <div className="task-page">
      <HeaderTitle>
        <span className="header-title-group">
          <h1 className="header-title">
            {searching ? 'Search' : `${greeting()}${name ? `, ${name}` : ''}`}
          </h1>
          {!searching && <span className="header-sub">{formatShortDate(today)}</span>}
        </span>
      </HeaderTitle>

      <section className="task-page__section">
        <div className="task-page__section-head">
          <h2 className="section-title">{searching ? 'Results' : 'Today'}</h2>
          <span className="task-page__stat">
            {searching
              ? `${listed.length} ${listed.length === 1 ? 'task' : 'tasks'}`
              : `${listed.length} ${listed.length === 1 ? 'task' : 'tasks'}${doneCount > 0 ? ` · ${doneCount} done` : ''}`}
          </span>
        </div>

        <TaskFilters
          tasks={inScope}
          items={allItems}
          filters={filters}
          onChange={setFilters}
        />

        {!searching && (
          <form className="task-add" onSubmit={startAdd}>
            <Plus size={16} className="task-add__icon" />
            <input
              className="task-add__input"
              placeholder="Add a task..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </form>
        )}

        {listed.length === 0 ? (
          <p className="empty-state">
            {isFiltering(filters)
              ? 'Nothing matches these filters.'
              : searching
                ? 'No matches for your search.'
                : 'Nothing on your plate. Add something above, or enjoy the quiet.'}
          </p>
        ) : (
          <ul className="task-rows">{listed.map(row)}</ul>
        )}

        {!searching && later.length > 0 && (
          <>
            <button
              type="button"
              className="home__more"
              onClick={() => setShowLater((v) => !v)}
              aria-expanded={showLater}
            >
              <ChevronDown size={14} className={showLater ? 'home__more-icon is-open' : 'home__more-icon'} />
              {showLater ? 'Hide' : `${later.length} more`} scheduled later
            </button>
            {showLater && <ul className="task-rows task-rows--later">{later.map(row)}</ul>}
          </>
        )}
      </section>

      {!searching && upcoming.length > 0 && (
        <section className="task-page__section">
          <h2 className="section-title">Upcoming</h2>
          <ul className="home__upcoming">
            {upcoming.map((item) => {
              const remaining = remainingByItem.get(item.id) ?? 0
              return (
                <li key={item.id}>
                  <button type="button" className="home__item" onClick={() => onOpenItem(item.id)}>
                    <span className="home__item-space">{spaceName(item.space_id)}</span>
                    <span className="home__item-name">
                      <EntityIcon icon={item.icon} fallback={DEFAULT_ITEM_ICON} size={16} />
                      {item.name}
                    </span>
                    <span className="home__item-meta">
                      {item.date && (
                        <span className={`due-chip is-${dueTone(item.date)}`}>{dueLabel(item.date)}</span>
                      )}
                      {remaining > 0 && (
                        <span className="home__item-remaining">
                          {remaining} {remaining === 1 ? 'task' : 'tasks'} remaining
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {pending !== null && (
        <AddTaskDialog
          title={pending}
          spaces={spaces}
          items={items}
          onCancel={() => setPending(null)}
          onConfirm={async ({ itemId, dueDate }) => {
            await onAddTask(pending, itemId, dueDate)
            setPending(null)
            setTitle('')
          }}
        />
      )}

      {selected && (
        <Suspense fallback={null}>
          <TaskDetailPanel
            task={selected}
            onClose={() => setSelectedId(null)}
            onChangePriority={onChangePriority}
            onChangeDueDate={onChangeDueDate}
            onChangeTags={onChangeTags}
            onRename={onRenameTask}
            onDelete={async (t) => {
              await onDeleteTask(t)
              setSelectedId(null)
            }}
            onArchive={async (t) => {
              await onArchiveTask(t)
              setSelectedId(null)
            }}
          />
        </Suspense>
      )}
    </div>
  )
}
