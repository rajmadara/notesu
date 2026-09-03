import { Suspense, lazy, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import type { Item, Space, Task, TaskPriority } from '../../lib/types'
import type { TaskView } from '../../App'
import { dueLabel, dueTone, formatShortDate, greeting, todayISO } from '../../lib/date'
import { HeaderTitle } from '../shell/HeaderSlot'
import { EntityIcon } from '../workspace/EntityIcon'
import { DEFAULT_ITEM_ICON } from '../../lib/icons'
import { AddTaskDialog } from '../tasks/AddTaskDialog'
import { TaskRow } from '../tasks/TaskRow'

// ~390kB of editor, only once someone opens a task.
const TaskDetailPanel = lazy(() =>
  import('../dailyTasks/TaskDetailPanel').then((m) => ({ default: m.TaskDetailPanel })),
)

interface Props {
  name: string
  tasks: Task[]
  items: Item[]
  spaces: Space[]
  view: TaskView
  searchResults: Task[] | null
  onAddTask: (title: string, itemId: number | null, dueDate: string | null) => Promise<void>
  onToggleTask: (task: Task) => Promise<void>
  onRenameTask: (task: Task, title: string) => Promise<void>
  onChangePriority: (task: Task, priority: TaskPriority) => Promise<void>
  onChangeDueDate: (task: Task, dueDate: string | null) => Promise<void>
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
  spaces,
  view,
  searchResults,
  onAddTask,
  onToggleTask,
  onRenameTask,
  onChangePriority,
  onChangeDueDate,
  onArchiveTask,
  onDeleteTask,
  onOpenItem,
}: Props) {
  const [title, setTitle] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [showLater, setShowLater] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const searching = searchResults !== null
  const archived = view === 'archived'
  const today = todayISO()

  const active = tasks.filter((t) => !t.archived)
  const byUrgency = (a: Task, b: Task) => {
    if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1
    return (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || b.created_at - a.created_at
  }
  // "Today" is the actionable set: anything due by today, plus everything with
  // no date at all. Dated-for-later waits behind the toggle.
  const todays = active.filter((t) => !t.due_date || t.due_date <= today).sort(byUrgency)
  const later = active.filter((t) => t.due_date && t.due_date > today).sort(byUrgency)
  const doneCount = todays.filter((t) => t.status === 'done').length

  const listed = searching
    ? [...searchResults].sort(byUrgency)
    : archived
      ? tasks.filter((t) => t.archived).sort(byUrgency)
      : todays

  const remainingByItem = new Map<number, number>()
  for (const t of active) {
    if (t.item_id !== null && t.status !== 'done') {
      remainingByItem.set(t.item_id, (remainingByItem.get(t.item_id) ?? 0) + 1)
    }
  }
  const upcoming = items
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
      itemName={task.item_id !== null ? items.find((i) => i.id === task.item_id)?.name : undefined}
      hideTodayChip={!archived && !searching}
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
            {searching ? 'Search' : archived ? 'Archived' : `${greeting()}${name ? `, ${name}` : ''}`}
          </h1>
          {!searching && !archived && <span className="header-sub">{formatShortDate(today)}</span>}
        </span>
      </HeaderTitle>

      <section className="task-page__section">
        <div className="task-page__section-head">
          <h2 className="section-title">{searching ? 'Results' : archived ? 'Archived' : 'Today'}</h2>
          <span className="task-page__stat">
            {searching || archived
              ? `${listed.length} ${listed.length === 1 ? 'task' : 'tasks'}`
              : `${todays.length} ${todays.length === 1 ? 'task' : 'tasks'}${doneCount > 0 ? ` · ${doneCount} done` : ''}`}
          </span>
        </div>

        {!searching && !archived && (
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
            {searching
              ? 'No matches for your search.'
              : archived
                ? 'Nothing archived.'
                : 'Nothing on your plate. Add something above, or enjoy the quiet.'}
          </p>
        ) : (
          <ul className="task-rows">{listed.map(row)}</ul>
        )}

        {!searching && !archived && later.length > 0 && (
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

      {!searching && !archived && upcoming.length > 0 && (
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
