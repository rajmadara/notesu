import { useEffect, useState } from 'react'
import type { Note, Task, TaskPriority, TaskStatus } from '../../lib/types'
import {
  formatNote,
  getNotesForTask,
  setTaskTags,
  upsertTaskNote,
} from '../../lib/db'
import { formatTimestamp } from '../../lib/date'
import { formatDuration, useTaskTimer } from './useTaskTimer'

const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  done: 'Done',
}

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  not_started: 'in_progress',
  in_progress: 'done',
  done: 'not_started',
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'amber', label: 'Amber' },
  { value: 'red', label: 'Red' },
]

type NoteAction = 'formal' | 'informal' | 'summarize'

const NOTE_ACTIONS: { value: NoteAction; label: string }[] = [
  { value: 'formal', label: 'Formal' },
  { value: 'informal', label: 'Informal' },
  { value: 'summarize', label: 'Summarize' },
]

interface Props {
  task: Task
  onCycleStatus: (task: Task) => void
  onToggleDone: (task: Task) => void
  onToggleTimer: (task: Task) => void
  onResetTimer: (task: Task) => void
  onDelete: (task: Task) => void
  onChangePriority: (task: Task, priority: TaskPriority) => void
  onRename: (task: Task, title: string) => void
}

export function TaskItem({
  task,
  onCycleStatus,
  onToggleDone,
  onToggleTimer,
  onResetTimer,
  onDelete,
  onChangePriority,
  onRename,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes] = useState('')
  const [note, setNote] = useState<Note | null>(null)
  const [notesLoaded, setNotesLoaded] = useState(false)
  const [tagList, setTagList] = useState<string[]>(() =>
    task.tags
      ? task.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [],
  )
  const [tagInput, setTagInput] = useState('')
  const elapsed = useTaskTimer(task)

  useEffect(() => {
    if (!expanded || notesLoaded) return
    getNotesForTask(task.id).then((rows) => {
      setNotes(rows[0]?.content ?? '')
      setNote(rows[0] ?? null)
      setNotesLoaded(true)
    })
  }, [expanded, notesLoaded, task.id])

  async function handleNotesBlur() {
    const saved = await upsertTaskNote(task.id, notes)
    setNote(saved)
  }

  const [aiBusy, setAiBusy] = useState<NoteAction | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [previousNotes, setPreviousNotes] = useState<string | null>(null)

  async function handleNoteAction(action: NoteAction) {
    if (aiBusy) return
    if (!notes.trim()) {
      setAiError('Write a note first, then format it.')
      return
    }
    setAiBusy(action)
    setAiError(null)
    try {
      const transformed = await formatNote(notes, action)
      setPreviousNotes(notes)
      setNotes(transformed)
      const saved = await upsertTaskNote(task.id, transformed)
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

  const [titleDraft, setTitleDraft] = useState<string | null>(null)

  function commitTitle() {
    if (titleDraft === null) return
    const trimmed = titleDraft.trim()
    setTitleDraft(null)
    if (trimmed && trimmed !== task.title) {
      onRename(task, trimmed)
    }
  }

  function persistTags(newList: string[]) {
    setTagList(newList)
    setTaskTags(task.id, newList.join(', '))
  }

  function handleTagInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const value = tagInput.trim()
    setTagInput('')
    if (!value || tagList.includes(value)) return
    persistTags([...tagList, value])
  }

  function handleRemoveTag(tag: string) {
    persistTags(tagList.filter((t) => t !== tag))
  }

  const isRunning = task.running_since !== null

  return (
    <li
      className={`task-item task-item--${task.status} task-item--priority-${task.priority}${expanded ? ' task-item--expanded' : ''}`}
    >
      <div className="task-item__row">
        <button
          type="button"
          className={`task-item__checkbox${task.status === 'done' ? ' task-item__checkbox--done' : ''}`}
          onClick={() => onToggleDone(task)}
          title={task.status === 'done' ? 'Mark as not started' : 'Mark as done'}
          aria-label="Toggle task done"
        >
          {task.status === 'done' && (
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path
                d="M2.5 8.5 L6 12 L13.5 4"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        {titleDraft !== null ? (
          <input
            type="text"
            className="task-item__title-input"
            value={titleDraft}
            autoFocus
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle()
              if (e.key === 'Escape') setTitleDraft(null)
            }}
          />
        ) : (
          <span
            className="task-item__title"
            onClick={() => setExpanded((e) => !e)}
            onDoubleClick={() => setTitleDraft(task.title)}
            title="Click to expand, double-click to rename"
          >
            {task.title}
          </span>
        )}

        <button
          type="button"
          className={`task-item__status-label task-item__status-label--${task.status}`}
          onClick={() => onCycleStatus(task)}
          title="Click to cycle status"
        >
          {STATUS_LABEL[task.status]}
        </button>

        <button
          type="button"
          className="task-item__delete"
          onClick={() => onDelete(task)}
          aria-label="Delete task"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="task-item__notes">
          <div className="task-item__meta">
            <span>Created {formatTimestamp(task.created_at)}</span>
            {note && <span>Note updated {formatTimestamp(note.updated_at)}</span>}
          </div>

          <div className="task-item__toolbar">
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

            <div className="task-item__timer-group">
              <span className="task-item__timer">{formatDuration(elapsed)}</span>

              <button
                type="button"
                className={`task-item__icon-btn${isRunning ? ' task-item__icon-btn--running' : ''}`}
                onClick={() => onToggleTimer(task)}
                aria-label={isRunning ? 'Pause timer' : 'Start timer'}
                title={isRunning ? 'Pause' : 'Start'}
              >
                {isRunning ? (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M7 4.5v15l13-7.5z" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                className="task-item__icon-btn task-item__icon-btn--stop"
                onClick={() => onResetTimer(task)}
                aria-label="Stop and reset timer"
                title="Reset"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
              </button>
            </div>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Notes for this task..."
            rows={4}
          />

          <div className="task-item__note-actions">
            {NOTE_ACTIONS.map((action) => (
              <button
                key={action.value}
                type="button"
                className="task-item__note-action"
                onClick={() => handleNoteAction(action.value)}
                disabled={aiBusy !== null}
              >
                {aiBusy === action.value ? 'Working…' : action.label}
              </button>
            ))}
            {previousNotes !== null && aiBusy === null && (
              <button
                type="button"
                className="task-item__note-action task-item__note-action--undo"
                onClick={handleUndoNoteAction}
              >
                Undo
              </button>
            )}
          </div>
          {aiError && <div className="task-item__note-error">{aiError}</div>}

          <div className="task-item__tags">
            {tagList.map((tag) => (
              <span key={tag} className="task-item__tag-chip">
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  aria-label={`Remove tag ${tag}`}
                >
                  &times;
                </button>
              </span>
            ))}
            <input
              type="text"
              className="task-item__tag-input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagInputKeyDown}
              placeholder={tagList.length === 0 ? 'Add a tag and press Enter...' : ''}
            />
          </div>
        </div>
      )}
    </li>
  )
}

export { NEXT_STATUS }
