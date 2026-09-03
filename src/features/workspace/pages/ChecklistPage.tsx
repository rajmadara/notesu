import { useState } from 'react'
import { Calendar, Check, Trash2 } from 'lucide-react'
import type { Page, Task } from '../../../lib/types'
import { createPageTask, deleteItemTask, updateItemTask } from '../../../lib/workspace'
import { dueLabel, dueTone } from '../../../lib/date'

interface Props {
  page: Page
  tasks: Task[]
  readOnly: boolean
  onChanged: () => Promise<void>
}

/**
 * A focused task list scoped to one page. Tasks made here also belong to the
 * item owner's global Tasks list — pages organise information, tasks organise
 * actions, and the same task can be reached from either side.
 */
export function ChecklistPage({ page, tasks, readOnly, onChanged }: Props) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)

  const open = tasks.filter((t) => t.status !== 'done')
  const done = tasks.filter((t) => t.status === 'done')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || busy) return
    setBusy(true)
    await createPageTask(page.id, trimmed, due || null).catch(() => null)
    setTitle('')
    setDue('')
    setBusy(false)
    await onChanged()
  }

  async function toggle(task: Task) {
    await updateItemTask(task.id, { status: task.status === 'done' ? 'not_started' : 'done' }).catch(
      () => null,
    )
    await onChanged()
  }

  async function rename(task: Task, next: string) {
    const trimmed = next.trim()
    if (!trimmed || trimmed === task.title) return
    await updateItemTask(task.id, { title: trimmed }).catch(() => null)
    await onChanged()
  }

  async function setDueDate(task: Task, value: string) {
    await updateItemTask(task.id, { due_date: value || null }).catch(() => null)
    await onChanged()
  }

  async function remove(task: Task) {
    await deleteItemTask(task.id).catch(() => null)
    await onChanged()
  }

  const row = (task: Task) => {
    const tone = task.due_date ? dueTone(task.due_date) : null
    return (
      <li key={task.id} className={`check-row${task.status === 'done' ? ' is-done' : ''}`}>
        <button
          type="button"
          className="check-row__box"
          onClick={() => !readOnly && toggle(task)}
          disabled={readOnly}
          aria-label={task.status === 'done' ? 'Mark not done' : 'Mark done'}
        >
          {task.status === 'done' && <Check size={12} strokeWidth={3} />}
        </button>
        <input
          className="check-row__title"
          defaultValue={task.title}
          readOnly={readOnly}
          onBlur={(e) => rename(task, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          aria-label="Task title"
        />
        <label className={`check-row__due${tone ? ` is-${tone}` : ''}`} title="Due date">
          <Calendar size={13} />
          <span>{task.due_date ? dueLabel(task.due_date) : readOnly ? '' : 'Date'}</span>
          {!readOnly && (
            <input
              type="date"
              value={task.due_date ?? ''}
              onChange={(e) => setDueDate(task, e.target.value)}
              aria-label="Due date"
            />
          )}
        </label>
        {!readOnly && (
          <button
            type="button"
            className="check-row__delete"
            onClick={() => remove(task)}
            aria-label="Delete task"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        )}
      </li>
    )
  }

  return (
    <div className="page-checklist">
      {!readOnly && (
        <form className="check-add" onSubmit={add}>
          <span className="check-add__box" aria-hidden="true" />
          <input
            className="check-add__title"
            placeholder="Add a task..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="check-add__due" title="Due date">
            <Calendar size={14} />
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
          </label>
          <button type="submit" className="check-add__submit" disabled={!title.trim() || busy}>
            Add
          </button>
        </form>
      )}

      {tasks.length === 0 ? (
        <p className="empty-state">
          {readOnly ? 'Nothing on this checklist yet.' : 'Nothing here yet — add the first task above.'}
        </p>
      ) : (
        <>
          <ul className="check-list">{open.map(row)}</ul>
          {done.length > 0 && (
            <>
              <p className="check-list__divider">
                Completed <span>{done.length}</span>
              </p>
              <ul className="check-list">{done.map(row)}</ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
