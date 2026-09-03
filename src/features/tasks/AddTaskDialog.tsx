import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { Item, Space } from '../../lib/types'

interface Props {
  title: string
  /** Omitted on an item's own Tasks page, where the destination is already
   *  settled — then the dialog asks only for a due date. */
  spaces?: Space[]
  items?: Item[]
  onCancel: () => void
  onConfirm: (options: { itemId: number | null; dueDate: string | null }) => Promise<void>
}

/**
 * Where a task goes, asked after the fact. The add row stays a single field;
 * everything optional lives here. Submitting without touching anything files
 * a plain task, so the quick path is still just Enter, Enter.
 */
export function AddTaskDialog({ title, spaces, items, onCancel, onConfirm }: Props) {
  const canFile = spaces !== undefined && items !== undefined
  // A space only narrows the item list — a task attaches to an item, not a
  // space — so picking one alone still files a plain task.
  const [spaceId, setSpaceId] = useState<number | ''>('')
  const [itemId, setItemId] = useState<number | ''>('')
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)

  const visibleItems = useMemo(
    () => (spaceId === '' ? (items ?? []) : (items ?? []).filter((i) => i.space_id === spaceId)),
    [items, spaceId],
  )

  // Narrowing to a space shouldn't leave an item from a different one selected.
  useEffect(() => {
    if (itemId !== '' && !visibleItems.some((i) => i.id === itemId)) setItemId('')
  }, [visibleItems, itemId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const spaceName = (id: number) => (spaces ?? []).find((s) => s.id === id)?.name ?? ''

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    await onConfirm({ itemId: itemId === '' ? null : itemId, dueDate: dueDate || null })
  }

  return (
    <div className="dialog__backdrop" onMouseDown={onCancel}>
      <form
        className="dialog dialog--compact"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
        aria-label="Add task"
      >
        <header className="dialog__head">
          <h2 className="dialog__title">Add task</h2>
          <button type="button" className="icon-btn" onClick={onCancel} aria-label="Cancel">
            <X size={16} />
          </button>
        </header>

        <p className="add-task__title">{title}</p>
        <p className="dialog__hint">
          All optional — hit Continue to file it as a plain task.
        </p>

        <div className="add-task__fields">
          {canFile && (
            <>
              <label className="add-task__field">
                <span className="add-task__label">Space</span>
                <select
                  className="input input--select"
                  value={spaceId}
                  autoFocus
                  onChange={(e) => setSpaceId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">No space</option>
                  {(spaces ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="add-task__field">
                <span className="add-task__label">Item</span>
                <select
                  className="input input--select"
                  value={itemId}
                  disabled={visibleItems.length === 0}
                  onChange={(e) => setItemId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">
                    {visibleItems.length === 0 ? 'Nothing to file under' : 'No item'}
                  </option>
                  {visibleItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {spaceId === '' && spaceName(i.space_id) ? `${spaceName(i.space_id)} · ` : ''}
                      {i.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className="add-task__field">
            <span className="add-task__label">Due date</span>
            <input
              type="date"
              className="input"
              value={dueDate}
              autoFocus={!canFile}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
        </div>

        <div className="add-task__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Adding...' : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  )
}
