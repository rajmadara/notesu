import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Page, PageEntry } from '../../../lib/types'
import {
  createPageEntry,
  deletePageEntry,
  getPageEntries,
  updatePageEntry,
} from '../../../lib/workspace'
import { formatLongDate, todayISO } from '../../../lib/date'

interface Props {
  page: Page
  readOnly: boolean
}

const UNDATED = '__undated__'

/**
 * Entries grouped by day, each a time + title. A day exists as soon as it
 * has an entry; "Add a day" opens an empty group that's kept client-side
 * until its first entry is saved.
 */
export function ItineraryPage({ page, readOnly }: Props) {
  const [entries, setEntries] = useState<PageEntry[]>([])
  const [loading, setLoading] = useState(true)
  // Days the user opened that don't have a saved entry yet.
  const [draftDays, setDraftDays] = useState<string[]>([])
  const [drafts, setDrafts] = useState<Record<string, { time: string; title: string }>>({})
  const [pickingDay, setPickingDay] = useState(false)
  const [newDay, setNewDay] = useState(todayISO())

  const load = useCallback(async () => {
    setEntries(await getPageEntries(page.id).catch(() => []))
    setLoading(false)
  }, [page.id])

  useEffect(() => {
    setLoading(true)
    setDraftDays([])
    load()
  }, [load])

  const days = [
    ...new Set([...entries.map((e) => e.day ?? UNDATED), ...draftDays]),
  ].sort((a, b) => (a === UNDATED ? 1 : b === UNDATED ? -1 : a.localeCompare(b)))

  async function addEntry(dayKey: string) {
    const draft = drafts[dayKey]
    const title = draft?.title.trim()
    if (!title) return
    await createPageEntry(page.id, {
      day: dayKey === UNDATED ? null : dayKey,
      time: draft.time,
      title,
      note: '',
    }).catch(() => null)
    setDrafts((d) => ({ ...d, [dayKey]: { time: '', title: '' } }))
    setDraftDays((d) => d.filter((x) => x !== dayKey))
    await load()
  }

  async function patch(entry: PageEntry, next: { time?: string; title?: string; note?: string }) {
    if (next.title !== undefined && !next.title.trim()) return
    await updatePageEntry(entry.id, next).catch(() => null)
    await load()
  }

  async function remove(entry: PageEntry) {
    await deletePageEntry(entry.id).catch(() => null)
    await load()
  }

  function openDay() {
    const key = newDay || UNDATED
    if (!days.includes(key)) setDraftDays((d) => [...d, key])
    setPickingDay(false)
  }

  if (loading) return <p className="empty-state">Loading...</p>

  return (
    <div className="page-itinerary">
      {days.length === 0 && (
        <p className="empty-state">
          {readOnly ? 'No itinerary yet.' : 'Plan it out day by day — add the first day below.'}
        </p>
      )}

      {days.map((dayKey, index) => {
        const dayEntries = entries.filter((e) => (e.day ?? UNDATED) === dayKey)
        const draft = drafts[dayKey] ?? { time: '', title: '' }
        return (
          <section key={dayKey} className="itin-day">
            <header className="itin-day__head">
              <span className="itin-day__index">
                {dayKey === UNDATED ? 'Unscheduled' : `Day ${index + 1}`}
              </span>
              {dayKey !== UNDATED && (
                <span className="itin-day__date">{formatLongDate(dayKey)}</span>
              )}
            </header>

            <ul className="itin-list">
              {dayEntries.map((entry) => (
                <li key={entry.id} className="itin-row">
                  <input
                    className="itin-row__time"
                    type="time"
                    defaultValue={entry.time}
                    readOnly={readOnly}
                    onBlur={(e) => e.target.value !== entry.time && patch(entry, { time: e.target.value })}
                    aria-label="Time"
                  />
                  <span className="itin-row__dot" aria-hidden="true" />
                  <input
                    className="itin-row__title"
                    defaultValue={entry.title}
                    readOnly={readOnly}
                    onBlur={(e) => e.target.value.trim() !== entry.title && patch(entry, { title: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
                    aria-label="Entry"
                  />
                  {!readOnly && (
                    <button
                      type="button"
                      className="itin-row__delete"
                      onClick={() => remove(entry)}
                      aria-label="Remove entry"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}

              {!readOnly && (
                <li className="itin-row itin-row--add">
                  <input
                    className="itin-row__time"
                    type="time"
                    value={draft.time}
                    onChange={(e) => setDrafts((d) => ({ ...d, [dayKey]: { ...draft, time: e.target.value } }))}
                    aria-label="Time"
                  />
                  <span className="itin-row__dot itin-row__dot--add" aria-hidden="true" />
                  <input
                    className="itin-row__title"
                    placeholder="What's happening?"
                    value={draft.title}
                    onChange={(e) => setDrafts((d) => ({ ...d, [dayKey]: { ...draft, title: e.target.value } }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addEntry(dayKey)
                      }
                    }}
                    aria-label="New entry"
                  />
                  <button
                    type="button"
                    className="itin-row__add"
                    onClick={() => addEntry(dayKey)}
                    disabled={!draft.title.trim()}
                    aria-label="Add entry"
                  >
                    <Plus size={14} />
                  </button>
                </li>
              )}
            </ul>
          </section>
        )
      })}

      {!readOnly &&
        (pickingDay ? (
          <div className="itin-add-day">
            <input
              type="date"
              value={newDay}
              onChange={(e) => setNewDay(e.target.value)}
              autoFocus
              aria-label="Day"
            />
            <button type="button" className="btn btn--primary" onClick={openDay}>
              Add day
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setPickingDay(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--ghost itin-add-day-btn" onClick={() => setPickingDay(true)}>
            <Plus size={14} /> Add a day
          </button>
        ))}
    </div>
  )
}
