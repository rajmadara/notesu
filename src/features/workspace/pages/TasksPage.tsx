import { Suspense, lazy, useState } from 'react'
import { Plus } from 'lucide-react'
import type { Page, Task, TaskPriority } from '../../../lib/types'
import {
  createPageTask,
  deleteItemTask,
  getItemTaskNotes,
  updateItemTask,
  upsertItemTaskNote,
} from '../../../lib/workspace'
import { TaskRow } from '../../tasks/TaskRow'
import { AddTaskDialog } from '../../tasks/AddTaskDialog'

// Same panel and same lazy chunk as the main list.
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
 * An item's Tasks page. Deliberately the same rows, add flow and detail panel
 * as the main task list — a task added in either place shows up in the other,
 * so they should look and behave the same. Writes go through the workspace
 * endpoints, which authorise via the item, so collaborators can use it too.
 */
export function TasksPage({ page, tasks, readOnly, onChanged }: Props) {
  const [title, setTitle] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  function startAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setPending(trimmed)
  }

  async function patch(task: Task, change: Parameters<typeof updateItemTask>[1]) {
    await updateItemTask(task.id, change).catch(() => null)
    await onChanged()
  }

  async function remove(task: Task) {
    await deleteItemTask(task.id).catch(() => null)
    await onChanged()
  }

  const sorted = [...tasks].sort((a, b) => {
    if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1
    return (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || b.created_at - a.created_at
  })
  const doneCount = tasks.filter((t) => t.status === 'done').length
  const donePercent = tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100)
  const selected = tasks.find((t) => t.id === selectedId) ?? null

  return (
    <div className="task-page">
      <section className="task-page__section">
        <div className="task-page__section-head">
          <h2 className="section-title">{page.name}</h2>
          <span className="task-page__stat">
            {tasks.length === 0
              ? 'No tasks yet'
              : `${doneCount} of ${tasks.length} done · ${donePercent}%`}
          </span>
        </div>

        {!readOnly && (
          <form className="task-add" onSubmit={startAdd}>
            <Plus size={16} className="task-add__icon" />
            <input
              className="task-add__input"
              placeholder="Add a task..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </form>
        )}

        {tasks.length > 0 && (
          <div className="task-page__progress" role="presentation">
            <span className="task-page__progress-fill" style={{ width: `${donePercent}%` }} />
          </div>
        )}

        {tasks.length === 0 ? (
          <p className="empty-state">
            {readOnly ? 'Nothing on this list yet.' : 'Nothing here yet — add the first task above.'}
          </p>
        ) : (
          <ul className="task-rows">
            {sorted.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                readOnly={readOnly}
                onToggle={(t) => patch(t, { status: t.status === 'done' ? 'not_started' : 'done' })}
                onOpen={(t) => setSelectedId(t.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* No Space or Item to choose — this page already settles both. */}
      {pending !== null && (
        <AddTaskDialog
          title={pending}
          onCancel={() => setPending(null)}
          onConfirm={async ({ dueDate }) => {
            await createPageTask(page.id, pending, dueDate).catch(() => null)
            setPending(null)
            setTitle('')
            await onChanged()
          }}
        />
      )}

      {selected && (
        <Suspense fallback={null}>
          <TaskDetailPanel
            task={selected}
            onClose={() => setSelectedId(null)}
            onChangePriority={(t, priority: TaskPriority) => patch(t, { priority })}
            onChangeDueDate={(t, due_date) => patch(t, { due_date })}
            onChangeTags={(t, tags) => patch(t, { tags })}
            onRename={(t, title) => patch(t, { title })}
            onDelete={async (t) => {
              await remove(t)
              setSelectedId(null)
            }}
            loadNotes={getItemTaskNotes}
            saveNotes={upsertItemTaskNote}
          />
        </Suspense>
      )}
    </div>
  )
}
