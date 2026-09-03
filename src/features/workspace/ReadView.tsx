import { Calendar, Check, Clock, MapPin } from 'lucide-react'
import type { ItemReadView, ReadPage } from '../../lib/types'
import { dueLabel, dueTone, formatLongDate } from '../../lib/date'
import { normalizeNoteContent } from '../../lib/richText'
import { EntityIcon } from './EntityIcon'
import { DEFAULT_ITEM_ICON } from '../../lib/icons'

const UNDATED = '__undated__'

/** Rich-text page content, rendered rather than edited. */
function Prose({ html }: { html: string }) {
  // Content is authored in this app's own editor, which has no link mark and
  // no HTML input, so what's stored is the editor's own tag set.
  return <div className="read__prose" dangerouslySetInnerHTML={{ __html: normalizeNoteContent(html) }} />
}

function PageSection({ page }: { page: ReadPage }) {
  if (page.kind === 'checklist') {
    if (page.tasks.length === 0) return null
    const done = page.tasks.filter((t) => t.done).length
    return (
      <section className="read__section">
        <h2 className="read__heading">
          {page.name}
          <span className="read__count">
            {done} of {page.tasks.length} done
          </span>
        </h2>
        <ul className="read__checklist">
          {page.tasks.map((task) => (
            <li key={task.id} className={`read__check${task.done ? ' is-done' : ''}`}>
              <span className="read__check-box" aria-hidden="true">
                {task.done && <Check size={11} strokeWidth={3} />}
              </span>
              <span className="read__check-title">{task.title}</span>
              {task.due_date && (
                <span className={`due-chip is-${dueTone(task.due_date)}`}>
                  {dueLabel(task.due_date)}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (page.kind === 'itinerary') {
    if (page.entries.length === 0) return null
    const days = [...new Set(page.entries.map((e) => e.day ?? UNDATED))]
    return (
      <section className="read__section">
        <h2 className="read__heading">{page.name}</h2>
        {days.map((day, index) => (
          <div key={day} className="read__day">
            <h3 className="read__day-head">
              {day === UNDATED ? 'Unscheduled' : `Day ${index + 1}`}
              {day !== UNDATED && <span className="read__day-date">{formatLongDate(day)}</span>}
            </h3>
            <ul className="read__timeline">
              {page.entries
                .filter((e) => (e.day ?? UNDATED) === day)
                .map((entry) => (
                  <li key={entry.id} className="read__event">
                    <span className="read__event-time">
                      {entry.time || <Clock size={12} aria-hidden="true" />}
                    </span>
                    <span className="read__event-dot" aria-hidden="true" />
                    <span className="read__event-title">{entry.title}</span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>
    )
  }

  if (page.kind === 'people') {
    if (page.people.length === 0) return null
    return (
      <section className="read__section">
        <h2 className="read__heading">{page.name}</h2>
        <ul className="read__people">
          {page.people.map((person) => (
            <li key={person.id} className="read__person">
              <span className="read__person-name">{person.name}</span>
              {person.role && <span className="read__person-role">{person.role}</span>}
              {person.contact && <span className="read__person-contact">{person.contact}</span>}
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (page.kind === 'notes') {
    if (!page.content.trim()) return null
    return (
      <section className="read__section">
        <h2 className="read__heading">{page.name}</h2>
        <Prose html={page.content} />
      </section>
    )
  }

  return null
}

interface Props {
  view: ItemReadView
}

/**
 * The whole item as one readable document — what a view-only collaborator
 * sees instead of a workspace full of disabled inputs. Empty pages are left
 * out entirely rather than shown as blank headings.
 */
export function ReadView({ view }: Props) {
  const { item, space, owner_name, pages } = view
  const sections = pages.filter((p) => p.kind !== 'overview')
  const hasBody = sections.some(
    (p) =>
      (p.kind === 'checklist' && p.tasks.length > 0) ||
      (p.kind === 'itinerary' && p.entries.length > 0) ||
      (p.kind === 'people' && p.people.length > 0) ||
      (p.kind === 'notes' && p.content.trim()),
  )

  return (
    <article className="read">
      <header className="read__head">
        <p className="read__eyebrow">
          <EntityIcon icon={space.icon} fallback="📁" size={14} />
          {space.name} · shared by {owner_name}
        </p>
        <h1 className="read__title">
          <EntityIcon icon={item.icon} fallback={DEFAULT_ITEM_ICON} size={28} />
          {item.name}
        </h1>
        {(item.date || item.location) && (
          <p className="read__facts">
            {item.date && (
              <span className="read__fact">
                <Calendar size={14} /> {formatLongDate(item.date)}
              </span>
            )}
            {item.location && (
              <span className="read__fact">
                <MapPin size={14} /> {item.location}
              </span>
            )}
          </p>
        )}
        {item.description && <p className="read__lede">{item.description}</p>}
      </header>

      {sections.map((page) => (
        <PageSection key={page.id} page={page} />
      ))}

      {!hasBody && !item.description && (
        <p className="empty-state">Nothing has been added to this yet.</p>
      )}
    </article>
  )
}
