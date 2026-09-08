import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { ColumnType, PageColumn } from '../../lib/types'

const TYPES: { type: ColumnType; label: string; hint: string }[] = [
  { type: 'text', label: 'Text', hint: 'Anything you can type' },
  { type: 'number', label: 'Number', hint: 'Counts, amounts, sizes' },
  { type: 'select', label: 'Dropdown', hint: 'Pick from your own options' },
]

/** Ids are opaque and permanent — renaming a column keeps every row's value. */
function newId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

interface Props {
  /** The column being edited, or null when adding a new one. */
  column: PageColumn | null
  onSave: (column: PageColumn) => void
  onCancel: () => void
}

export function ColumnDialog({ column, onSave, onCancel }: Props) {
  const [name, setName] = useState(column?.name ?? '')
  const [type, setType] = useState<ColumnType>(column?.type ?? 'text')
  const [description, setDescription] = useState(column?.description ?? '')
  const [options, setOptions] = useState<string[]>(column?.options.length ? column.options : [''])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onSave({
      id: column?.id ?? newId(),
      name: trimmed,
      type,
      description: description.trim(),
      options: type === 'select' ? options.map((o) => o.trim()).filter(Boolean) : [],
    })
  }

  return (
    <div className="dialog__backdrop" onMouseDown={onCancel}>
      <form
        className="dialog dialog--compact"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
        aria-label={column ? 'Edit column' : 'New column'}
      >
        <header className="dialog__head">
          <h2 className="dialog__title">{column ? 'Edit column' : 'New column'}</h2>
          <button type="button" className="icon-btn" onClick={onCancel} aria-label="Cancel">
            <X size={16} />
          </button>
        </header>

        <div className="add-task__fields">
          <label className="add-task__field">
            <span className="add-task__label">Name</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dietary needs"
              autoFocus
            />
          </label>

          <div className="add-task__field">
            <span className="add-task__label">Type</span>
            <div className="kind-chips">
              {TYPES.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  className={`kind-chip${type === t.type ? ' is-active' : ''}`}
                  onClick={() => setType(t.type)}
                  title={t.hint}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {type === 'select' && (
            <div className="add-task__field">
              <span className="add-task__label">Options</span>
              {options.map((option, index) => (
                <div key={index} className="option-row">
                  <input
                    className="input"
                    value={option}
                    placeholder={`Option ${index + 1}`}
                    onChange={(e) =>
                      setOptions(options.map((o, i) => (i === index ? e.target.value : o)))
                    }
                  />
                  {options.length > 1 && (
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm"
                      onClick={() => setOptions(options.filter((_, i) => i !== index))}
                      aria-label={`Remove option ${index + 1}`}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="btn btn--ghost btn--sm option-row__add"
                onClick={() => setOptions([...options, ''])}
              >
                <Plus size={14} /> Add option
              </button>
            </div>
          )}

          <label className="add-task__field">
            <span className="add-task__label">Description</span>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this column is for (optional)"
            />
          </label>
        </div>

        <div className="add-task__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
            {column ? 'Save' : 'Add column'}
          </button>
        </div>
      </form>
    </div>
  )
}
