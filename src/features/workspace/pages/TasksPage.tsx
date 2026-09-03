import { Suspense, lazy, useState } from 'react'
import { Calendar } from 'lucide-react'
import type { Page, Task, TaskPriority } from '../../../lib/types'
import {
  createPageTask,
  deleteItemTask,
  getItemTaskNotes,
  updateItemTask,
  upsertItemTaskNote,
} from '../../../lib/workspace'
import { TaskItem } from '../../dailyTasks/TaskItem'

// Same panel the main Tasks list uses, and the same lazy chunk.
const TaskDetailPanel = lazy(() =>
  import('../../dailyTasks/TaskDetailPanel').then((m) => ({ default: m.TaskDetailPanel })),
)

interface Props {
  page: Page
  tasks: Task[]
  readOnly: boolean
  onChanged: () => Promise<void>
}

/**
 * A Tasks page inside an item. Deliberately the same rows and detail panel as
 * the main Tasks section — priority colouring, due dates, notes — just scoped
 * to this page. Writes go through the workspace endpoints, which authorise via
 * the item, so a collaborator on a shared item can use it too.
 */
export function TasksPage({ page, tasks, readOnly, onChanged }: Props) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

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

  async function patch(task: Task, change: Parameters<typeof updateItemTask>[1]) {
    await updateItemTask(task.id, change).catch(() => null)
    await onChanged()
  }

  async function remove(task: Task) {
    await deleteItemTask(task.id).catch(() => null)
    await onChanged()
  }

  const sorted = [...tasks].sort(
    (a, b) => Number(a.status === 'done') - Number(b.status === 'done'),
  )
  const doneCount = tasks.filter((t) => t.status === 'done').length
  const donePercent = tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100)
  const selected = tasks.find((t) => t.id === selectedId) ?? null

  return (
    <div className="daily-tasks">
      {!readOnly && (
        <form className="daily-tasks__add" onSubmit={add}>
          <input
            type="text"
            className="daily-tasks__add-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a task..."
          />
          <label className="check-add__due" title="Due date">
            <Calendar size={14} />
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              aria-label="Due date"
            />
          </label>
          <button type="submit" className="daily-tasks__add-btn" aria-label="Add task">
            <span className="daily-tasks__add-btn-label">Add</span>
            <svg
              className="daily-tasks__add-btn-icon"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </form>
      )}

      <div className="daily-tasks__stats">
        <span className="daily-tasks__count">
          {tasks.length === 0
            ? 'No tasks yet'
            : `${doneCount} of ${tasks.length} done · ${donePercent}%`}
        </span>
      </div>

      {tasks.length > 0 && (
        <div className="daily-tasks__progress" role="presentation">
          <span className="daily-tasks__progress-fill" style={{ width: `${donePercent}%` }} />
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="daily-tasks__empty">
          {readOnly ? 'Nothing on this list yet.' : 'Nothing here yet — add the first task above.'}
        </p>
      ) : (
        <ul className="task-list">
          {sorted.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              readOnly={readOnly}
              onToggleDone={(t) =>
                patch(t, { status: t.status === 'done' ? 'not_started' : 'done' })
              }
              onDelete={remove}
              onSelect={(t) => setSelectedId(t.id)}
            />
          ))}
        </ul>
      )}

      {selected && (
        <Suspense fallback={null}>
          <TaskDetailPanel
            task={selected}
            onClose={() => setSelectedId(null)}
            onChangePriority={(t, priority: TaskPriority) => patch(t, { priority })}
            onChangeDueDate={(t, due_date) => patch(t, { due_date })}
            onRename={(t, title) => patch(t, { title })}
            onDelete={remove}
            loadNotes={getItemTaskNotes}
            saveNotes={upsertItemTaskNote}
          />
        </Suspense>
      )}
    </div>
  )
}
