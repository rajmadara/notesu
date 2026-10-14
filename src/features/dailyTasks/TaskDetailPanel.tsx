import { useEffect, useState } from 'react'
import type { Note, Task, TaskPriority } from '../../lib/types'
import { formatNote, getNotesForTask, upsertTaskNote } from '../../lib/db'
import { formatTimestamp } from '../../lib/date'
import { htmlToPlainText, plainTextToHtml } from '../../lib/richText'
import { NotesEditor, type NoteAction } from './NotesEditor'
import { TagPicker } from '../tasks/TagPicker'
import { PriorityPicker } from '../tasks/PriorityPicker'
import { PomodoroButton, TaskTimerProvider } from '../tasks/TaskTimer'

interface Props {
  task: Task
  onClose: () => void
  onDelete: (task: Task) => void
  onChangePriority: (task: Task, priority: TaskPriority) => void
  onChangeDueDate: (task: Task, dueDate: string | null) => void
  onChangeTags: (task: Task, tags: string[]) => void
  onRename: (task: Task, title: string) => void
  /** Offered where the row has no menu of its own; omitted inside an item. */
  onArchive?: (task: Task) => void
  /**
   * How notes are read and written. Defaults to the personal task endpoints;
   * a task inside an item passes the workspace ones, which authorise through
   * the item so collaborators can use them too.
   */
  loadNotes?: (taskId: number) => Promise<Note[]>
  saveNotes?: (taskId: number, content: string) => Promise<Note>
  /** Time tracking for the task. Omit it and the panel simply has no timer. */
  timer?: TimerHandlers
}

export interface TimerHandlers {
  onStart: (task: Task) => Promise<void>
  onStop: (task: Task, at?: number) => Promise<void>
  onReset: (task: Task) => Promise<void>
}

export function TaskDetailPanel({
  task,
  onClose,
  onDelete,
  onChangePriority,
  onChangeDueDate,
  onChangeTags,
  onRename,
  onArchive,
  loadNotes = getNotesForTask,
  saveNotes = upsertTaskNote,
  timer,
}: Props) {
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
    loadNotes(task.id).then((rows) => {
      setNotes(rows[0]?.content ?? '')
      setNote(rows[0] ?? null)
      setNotesLoaded(true)
    })
  }, [notesLoaded, task.id, loadNotes])

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
    const saved = await saveNotes(task.id, notes)
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
      const saved = await saveNotes(task.id, html)
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
    const saved = await saveNotes(task.id, restored)
    setNote(saved)
  }

  function handleDelete() {
    onDelete(task)
    onClose()
  }

  const notesField = (
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
        toolbarExtra={timer ? <PomodoroButton /> : undefined}
      />
      {aiError && <div className="task-item__note-error">{aiError}</div>}
    </div>
  )

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
          {/* The timer draws its card above the notes when opened (from the
              Pomodoro button in the notes toolbar), pushing them down. Keyed by
              task so switching tasks starts a fresh timer rather than carrying
              the last one's countdown over. */}
          {timer ? (
            <TaskTimerProvider key={task.id} task={task} {...timer}>
              {notesField}
            </TaskTimerProvider>
          ) : (
            notesField
          )}

          {/* Three short fields share a row rather than each taking a full-width
              line; they wrap onto their own lines when the panel is narrow. */}
          <div className="task-detail-panel__props">
            <div className="task-detail-panel__field">
              <label className="task-detail-panel__label" htmlFor="task-due-date">
                Due date
              </label>
              <input
                id="task-due-date"
                type="date"
                className="task-detail-panel__date"
                value={task.due_date ?? ''}
                onChange={(e) => onChangeDueDate(task, e.target.value || null)}
              />
            </div>

            <div className="task-detail-panel__field task-detail-panel__field--grow">
              <label className="task-detail-panel__label">Tags</label>
              <TagPicker value={task.tags} onChange={(tags) => onChangeTags(task, tags)} />
            </div>

            <div className="task-detail-panel__field">
              <label className="task-detail-panel__label">Priority</label>
              <PriorityPicker
                value={task.priority}
                onChange={(priority) => onChangePriority(task, priority)}
              />
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
          {onArchive && (
            <button
              type="button"
              className="task-detail-panel__archive"
              onClick={() => onArchive(task)}
            >
              {task.archived ? 'Unarchive' : 'Archive'}
            </button>
          )}
          <button type="button" className="task-detail-panel__done" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
