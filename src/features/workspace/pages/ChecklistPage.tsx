import { useCallback, useEffect, useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import type { Page, PageEntry } from '../../../lib/types'
import {
  createPageEntry,
  deletePageEntry,
  getPageEntries,
  updatePageEntry,
} from '../../../lib/workspace'

interface Props {
  page: Page
  readOnly: boolean
}

/**
 * A plain checklist: tick a box and the line stays exactly as written — no
 * strike-through, and nothing to open. Deliberately not the task list: these
 * rows have no due date, no priority and no notes, and they never appear among
 * the user's tasks. They are page entries with no day or time.
 */
export function ChecklistPage({ page, readOnly }: Props) {
  const [entries, setEntries] = useState<PageEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')

  const load = useCallback(async () => {
    setEntries(await getPageEntries(page.id).catch(() => []))
    setLoading(false)
  }, [page.id])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setTitle('')
    await createPageEntry(page.id, {
      day: null,
      time: '',
      title: trimmed,
      note: '',
      done: false,
    }).catch(() => null)
    await load()
  }

  async function patch(entry: PageEntry, next: { title?: string; done?: boolean }) {
    if (next.title !== undefined && !next.title.trim()) return
    // Ticking is the common action, so reflect it immediately and let the
    // request catch up rather than making the box wait for a round trip.
    setEntries((rows) => rows.map((r) => (r.id === entry.id ? { ...r, ...next } : r)))
    await updatePageEntry(entry.id, next).catch(() => null)
    await load()
  }

  async function remove(entry: PageEntry) {
    await deletePageEntry(entry.id).catch(() => null)
    await load()
  }

  if (loading) return <p className="empty-state">Loading...</p>

  const doneCount = entries.filter((e) => e.done).length
  const percent = entries.length === 0 ? 0 : Math.round((doneCount / entries.length) * 100)

  return (
    <div className="page-checklist">
      <div className="checklist__head">
        <span className="checklist__stat">
          {entries.length === 0
            ? 'Nothing on the list'
            : `${doneCount} of ${entries.length} ticked · ${percent}%`}
        </span>
      </div>

      {entries.length > 0 && (
        <div className="checklist__progress" role="presentation">
          <span className="checklist__progress-fill" style={{ width: `${percent}%` }} />
        </div>
      )}

      {entries.length === 0 ? (
        <p className="empty-state">
          {readOnly ? 'Nothing on this list yet.' : 'Add the first thing to tick off.'}
        </p>
      ) : (
        <ul className="checklist">
          {entries.map((entry) => (
            <li key={entry.id} className={`check-item${entry.done ? ' is-done' : ''}`}>
              <button
                type="button"
                className="check-row__box"
                onClick={() => !readOnly && patch(entry, { done: !entry.done })}
                disabled={readOnly}
                aria-label={entry.done ? `Untick ${entry.title}` : `Tick ${entry.title}`}
                aria-pressed={entry.done}
              >
                {entry.done && <Check size={12} strokeWidth={3} />}
              </button>
              <input
                className="check-item__title"
                defaultValue={entry.title}
                readOnly={readOnly}
                onBlur={(e) => {
                  const next = e.target.value.trim()
                  if (!next) {
                    e.target.value = entry.title
                    return
                  }
                  if (next !== entry.title) patch(entry, { title: next })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                }}
                aria-label="Item"
              />
              {!readOnly && (
                <button
                  type="button"
                  className="icon-btn icon-btn--xs check-item__remove"
                  onClick={() => remove(entry)}
                  aria-label={`Remove ${entry.title}`}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <form className="task-add" onSubmit={add}>
          <Plus size={16} className="task-add__icon" />
          <input
            className="task-add__input"
            placeholder="Add an item..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </form>
      )}
    </div>
  )
}
