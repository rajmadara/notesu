import { useEffect, useState } from 'react'
import { Calendar, Check, Clock, MapPin } from 'lucide-react'
import type { ItemDetail, PageEntry, PageKind, Task } from '../../../lib/types'
import { getPageEntries } from '../../../lib/workspace'
import { dueLabel, dueTone, formatLongDate, formatShortDate, todayISO } from '../../../lib/date'
import { ListChecks, Route, FileText, Users } from 'lucide-react'

const PAGE_ICONS: Record<PageKind, typeof FileText> = {
  overview: FileText,
  notes: FileText,
  tasks: ListChecks,
  itinerary: Route,
  people: Users,
}

interface Props {
  detail: ItemDetail
  tasks: Task[]
  readOnly: boolean
  onPatchItem: (patch: { date?: string | null; location?: string; description?: string }) => void
  onOpenPage: (pageId: number) => void
  onToggleTask: (task: Task) => void
}

/**
 * The item's front page: its key facts, the tasks that matter most, what's
 * coming up in any itinerary, and links into the other pages.
 */
export function OverviewPage({ detail, tasks, readOnly, onPatchItem, onOpenPage, onToggleTask }: Props) {
  const { item, pages } = detail
  const [description, setDescription] = useState(item.description)
  const [upcoming, setUpcoming] = useState<(PageEntry & { pageName: string })[]>([])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setDescription(item.description), [item.id, item.description])

  // Pull the next few dated entries from every itinerary page on the item.
  useEffect(() => {
    const itineraries = pages.filter((p) => p.kind === 'itinerary')
    if (itineraries.length === 0) {
      setUpcoming([])
      return
    }
    let cancelled = false
    Promise.all(
      itineraries.map((p) => getPageEntries(p.id).then((rows) => rows.map((e) => ({ ...e, pageName: p.name })))),
    ).then((groups) => {
      if (cancelled) return
      const today = todayISO()
      setUpcoming(
        groups
          .flat()
          .filter((e) => e.day && e.day >= today)
          .sort((a, b) => `${a.day}${a.time}`.localeCompare(`${b.day}${b.time}`))
          .slice(0, 5),
      )
    })
    return () => {
      cancelled = true
    }
  }, [pages])

  const open = tasks.filter((t) => t.status !== 'done')
  const important = [...open]
    .sort((a, b) => {
      const rank = (t: Task) =>
        (t.priority === 'urgent_important' ? 0 : t.priority === 'urgent_not_important' ? 1 : t.priority === 'important_not_urgent' ? 2 : 3)
      const byPriority = rank(a) - rank(b)
      if (byPriority) return byPriority
      return (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
    })
    .slice(0, 6)
  const otherPages = pages.filter((p) => p.kind !== 'overview')

  return (
    <div className="overview">
      <div className="overview__facts">
        <label className="fact">
          <Calendar size={15} />
          {readOnly ? (
            <span className="fact__value">{item.date ? formatLongDate(item.date) : 'No date'}</span>
          ) : (
            <input
              type="date"
              className="fact__input"
              value={item.date ?? ''}
              onChange={(e) => onPatchItem({ date: e.target.value || null })}
              aria-label="Date"
            />
          )}
        </label>
        <label className="fact">
          <MapPin size={15} />
          <input
            className="fact__input"
            defaultValue={item.location}
            placeholder={readOnly ? 'No location' : 'Add a location'}
            readOnly={readOnly}
            onBlur={(e) => e.target.value.trim() !== item.location && onPatchItem({ location: e.target.value.trim() })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            aria-label="Location"
          />
        </label>
      </div>

      <textarea
        className="overview__description"
        value={description}
        placeholder={readOnly ? '' : 'What is this about?'}
        readOnly={readOnly}
        rows={3}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => description !== item.description && onPatchItem({ description })}
        aria-label="Description"
      />

      <div className="overview__grid">
        <section className="overview__section">
          <h3 className="overview__heading">
            Tasks{' '}
            {open.length > 0 && <span className="overview__count">{open.length} open</span>}
          </h3>
          {important.length === 0 ? (
            <p className="empty-state empty-state--tight">
              {tasks.length === 0 ? 'No tasks yet.' : 'All done.'}
            </p>
          ) : (
            <ul className="overview__tasks">
              {important.map((task) => {
                const tone = task.due_date ? dueTone(task.due_date) : null
                return (
                  <li key={task.id} className="overview__task">
                    <button
                      type="button"
                      className="check-row__box"
                      onClick={() => !readOnly && onToggleTask(task)}
                      disabled={readOnly}
                      aria-label="Mark done"
                    >
                      {task.status === 'done' && <Check size={12} strokeWidth={3} />}
                    </button>
                    <span className="overview__task-title">{task.title}</span>
                    {task.due_date && (
                      <span className={`due-chip is-${tone}`}>{dueLabel(task.due_date)}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="overview__section">
          <h3 className="overview__heading">Coming up</h3>
          {upcoming.length === 0 ? (
            <p className="empty-state empty-state--tight">
              {pages.some((p) => p.kind === 'itinerary') ? 'Nothing scheduled ahead.' : 'Add an Itinerary page to plan days.'}
            </p>
          ) : (
            <ul className="overview__upcoming">
              {upcoming.map((entry) => (
                <li key={entry.id} className="overview__entry">
                  <span className="overview__entry-when">
                    <Clock size={12} />
                    {formatShortDate(entry.day!)}
                    {entry.time && ` · ${entry.time}`}
                  </span>
                  <span className="overview__entry-title">{entry.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {otherPages.length > 0 && (
        <section className="overview__section">
          <h3 className="overview__heading">Pages</h3>
          <div className="overview__links">
            {otherPages.map((page) => {
              const Icon = PAGE_ICONS[page.kind]
              return (
                <button key={page.id} type="button" className="page-link" onClick={() => onOpenPage(page.id)}>
                  <Icon size={15} />
                  {page.name}
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
