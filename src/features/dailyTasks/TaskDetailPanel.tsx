import { useEffect, useState } from 'react'
import type { Note, Task, TaskPriority } from '../../lib/types'
import { formatNote, getNotesForTask, upsertTaskNote } from '../../lib/db'
import { formatTimestamp } from '../../lib/date'
import { htmlToPlainText, plainTextToHtml } from '../../lib/richText'
import { NotesEditor, type NoteAction } from './NotesEditor'

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'amber', label: 'Amber' },
  { value: 'red', label: 'Red' },
]

interface Props {
  task: Task
  onClose: () => void
  onDelete: (task: Task) => void
  onChangePriority: (task: Task, priority: TaskPriority) => void
  onRename: (task: Task, title: string) => void
}

export function TaskDetailPanel({ task, onClose, onDelete, onChangePriority, onRename }: Props) {
  const [titleValue, setTitleValue] = useState(task.title)
  const [notes, setNotes] = useState('')
  const [note, setNote] = useState<Note | null>(null)
  const [notesLoaded, setNotesLoaded] = useState(false)

  // Deliberately keyed on task.id only — this resets the draft fields when
  // switching to a different task, not on every update to this task's own
  // title (which would wipe out an in-progress edit).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setTitleValue(task.title)
    setNotes('')
    setNote(null)
    setNotesLoaded(false)
  }, [task.id])

  useEffect(() => {
    if (notesLoaded) return
    getNotesForTask(task.id).then((rows) => {
      setNotes(rows[0]?.content ?? '')
      setNote(rows[0] ?? null)
      setNotesLoaded(true)
    })
  }, [notesLoaded, task.id])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function commitTitle() {
    const trimmed = titleValue.trim()
    if (trimmed && trimmed !== task.title) {
      onRename(task, trimmed)
    } else {
      setTitleValue(task.title)
    }
  }

  async function handleNotesBlur() {
    const saved = await upsertTaskNote(task.id, notes)
    setNote(saved)
  }

  const [aiBusy, setAiBusy] = useState<NoteAction | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [previousNotes, setPreviousNotes] = useState<string | null>(null)

  async function handleNoteAction(action: NoteAction) {
    if (aiBusy) return
    // The AI works on prose, so send the text and put the result back as
    // paragraphs. Formatting is dropped by design — these actions rewrite the
    // wording anyway — and Undo restores the original markup exactly.
    const plain = htmlToPlainText(notes)
    if (!plain) {
      setAiError('Write a note first, then rewrite it.')
      return
    }
    setAiBusy(action)
    setAiError(null)
    try {
      const transformed = await formatNote(plain, action)
      const html = plainTextToHtml(transformed)
      setPreviousNotes(notes)
      setNotes(html)
      const saved = await upsertTaskNote(task.id, html)
      setNote(saved)
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI request failed.')
    } finally {
      setAiBusy(null)
    }
  }

  async function handleUndoNoteAction() {
    if (previousNotes === null) return
    const restored = previousNotes
    setPreviousNotes(null)
    setNotes(restored)
    const saved = await upsertTaskNote(task.id, restored)
    setNote(saved)
  }

  function handleDelete() {
    onDelete(task)
    onClose()
  }

  return (
    <div className="task-detail-panel__backdrop" onClick={onClose}>
      <div className="task-detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="task-detail-panel__header">
          <input
            type="text"
            className="task-detail-panel__title-input"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            aria-label="Task title"
          />
          <button
            type="button"
            className="task-detail-panel__close"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="task-detail-panel__body">
          <div className="task-detail-panel__field task-detail-panel__field--notes">
            <label className="task-detail-panel__label">Notes</label>
            <NotesEditor
              value={notes}
              onChange={setNotes}
              onBlur={handleNotesBlur}
              aiBusy={aiBusy}
              canUndo={previousNotes !== null}
              onAiAction={handleNoteAction}
              onUndoAiAction={handleUndoNoteAction}
            />
            {aiError && <div className="task-item__note-error">{aiError}</div>}
          </div>

          <div className="task-detail-panel__field">
            <label className="task-detail-panel__label">Priority</label>
            <div className="task-item__priority-picker">
              {PRIORITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`task-item__priority-swatch task-item__priority-swatch--${option.value}${task.priority === option.value ? ' is-selected' : ''}`}
                  onClick={() => onChangePriority(task, option.value)}
                  title={option.label}
                  aria-label={`Set priority to ${option.label}`}
                />
              ))}
            </div>
          </div>

          <div className="task-detail-panel__meta">
            <span>Created {formatTimestamp(task.created_at)}</span>
            {note && <span>Note updated {formatTimestamp(note.updated_at)}</span>}
          </div>
        </div>

        <div className="task-detail-panel__footer">
          <button type="button" className="task-detail-panel__delete" onClick={handleDelete}>
            Delete
          </button>
          <button type="button" className="task-detail-panel__done" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
