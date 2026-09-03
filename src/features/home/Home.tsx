import { useState } from 'react'
import { ArrowRight, Check, Plus } from 'lucide-react'
import type { Item, Space, Task } from '../../lib/types'
import { dueLabel, dueTone, formatShortDate, greeting, todayISO } from '../../lib/date'
import { HeaderTitle } from '../shell/HeaderSlot'
import { EntityIcon } from '../workspace/EntityIcon'
import { DEFAULT_ITEM_ICON } from '../../lib/icons'

interface Props {
  name: string
  tasks: Task[]
  items: Item[]
  spaces: Space[]
  onAddTask: (title: string) => Promise<void>
  onToggleTask: (task: Task) => Promise<void>
  onOpenItem: (itemId: number) => void
  onOpenTasks: () => void
}

/**
 * The command centre: today's tasks first, then what's coming up across the
 * user's items. Deliberately a list, not a dashboard.
 */
export function Home({ name, tasks, items, spaces, onAddTask, onToggleTask, onOpenItem, onOpenTasks }: Props) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const today = todayISO()
  const active = tasks.filter((t) => !t.archived)
  // "Today" = anything due by today, plus everything with no date at all —
  // i.e. the actionable set. Dated-for-later tasks wait on the Tasks page.
  const todays = active
    .filter((t) => !t.due_date || t.due_date <= today)
    .sort((a, b) => {
      if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1
      return (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || b.created_at - a.created_at
    })
  const doneCount = todays.filter((t) => t.status === 'done').length

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

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || busy) return
    setBusy(true)
    await onAddTask(trimmed)
    setTitle('')
    setBusy(false)
  }

  return (
    <div className="home">
      <HeaderTitle>
        {/* Grouped so the date sits on the greeting's baseline rather than
            being centred against a much larger line box. */}
        <span className="header-title-group">
          <h1 className="header-title">
            {greeting()}
            {name ? `, ${name}` : ''}
          </h1>
          <span className="header-sub">{formatShortDate(today)}</span>
        </span>
      </HeaderTitle>

      <section className="home__section">
        <div className="home__section-head">
          <h2 className="section-title">Today</h2>
          <span className="home__stat">
            {todays.length} {todays.length === 1 ? 'task' : 'tasks'}
            {doneCount > 0 && ` · ${doneCount} done`}
          </span>
        </div>

        <form className="home__add" onSubmit={add}>
          <Plus size={16} className="home__add-icon" />
          <input
            className="home__add-input"
            placeholder="Add a task..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </form>

        {todays.length === 0 ? (
          <p className="empty-state">Nothing on your plate. Add something above, or enjoy the quiet.</p>
        ) : (
          <ul className="home__tasks">
            {todays.map((task) => {
              const tone = task.due_date ? dueTone(task.due_date) : null
              const itemName = task.item_id !== null ? items.find((i) => i.id === task.item_id)?.name : null
              return (
                <li key={task.id} className={`home__task${task.status === 'done' ? ' is-done' : ''}`}>
                  <button type="button" className="check-row__box" onClick={() => onToggleTask(task)} aria-label="Toggle done">
                    {task.status === 'done' && <Check size={12} strokeWidth={3} />}
                  </button>
                  <span className="home__task-title">{task.title}</span>
                  {itemName && (
                    <button type="button" className="home__task-context" onClick={() => onOpenItem(task.item_id!)}>
                      {itemName}
                    </button>
                  )}
                  {task.due_date && tone !== 'today' && (
                    <span className={`due-chip is-${tone}`}>{dueLabel(task.due_date)}</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {active.length > todays.length && (
          <button type="button" className="home__more" onClick={onOpenTasks}>
            {active.length - todays.length} more scheduled later <ArrowRight size={14} />
          </button>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="home__section">
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
                      {item.date && <span className={`due-chip is-${dueTone(item.date)}`}>{dueLabel(item.date)}</span>}
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
    </div>
  )
}
