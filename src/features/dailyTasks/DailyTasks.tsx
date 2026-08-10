import { lazy, Suspense, useEffect, useState } from 'react'
import type { Task, TaskPriority } from '../../lib/types'
import {
  createTask,
  deleteTask,
  getAllTasks,
  setTaskPriority,
  setTaskStatus,
  setTaskTitle,
} from '../../lib/db'
import { TaskItem } from './TaskItem'

// The panel pulls in the rich-text editor (~600kB), which nothing else needs —
// loading it on first open keeps it out of the initial page bundle.
const TaskDetailPanel = lazy(() =>
  import('./TaskDetailPanel').then((m) => ({ default: m.TaskDetailPanel })),
)

export function DailyTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)

  async function refresh() {
    const rows = await getAllTasks()
    setTasks(rows)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    await createTask(title)
    setNewTitle('')
    await refresh()
  }

  async function handleToggleDone(task: Task) {
    await setTaskStatus(task.id, task.status === 'done' ? 'not_started' : 'done')
    await refresh()
  }

  async function handleChangePriority(task: Task, priority: TaskPriority) {
    await setTaskPriority(task.id, priority)
    await refresh()
  }

  async function handleRename(task: Task, title: string) {
    await setTaskTitle(task.id, title)
    await refresh()
  }

  async function handleDelete(task: Task) {
    await deleteTask(task.id)
    await refresh()
  }

  const doneCount = tasks.filter((t) => t.status === 'done').length
  const sortedTasks = [...tasks].sort(
    (a, b) => Number(a.status === 'done') - Number(b.status === 'done'),
  )
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null

  return (
    <div className="daily-tasks">
      <form className="daily-tasks__add" onSubmit={handleAddTask}>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task..."
        />
        <button type="submit">Add</button>
      </form>

      <div className="daily-tasks__stats">
        <span className="daily-tasks__count">
          {tasks.length === 0 ? 'No tasks yet' : `${doneCount} / ${tasks.length} done`}
        </span>
      </div>

      {loading ? (
        <p className="daily-tasks__empty">Loading...</p>
      ) : tasks.length === 0 ? (
        <p className="daily-tasks__empty">No tasks yet.</p>
      ) : (
        <ul className="task-list">
          {sortedTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggleDone={handleToggleDone}
              onDelete={handleDelete}
              onSelect={(t) => setSelectedTaskId(t.id)}
            />
          ))}
        </ul>
      )}

      {selectedTask && (
        <Suspense fallback={null}>
          <TaskDetailPanel
            task={selectedTask}
            onClose={() => setSelectedTaskId(null)}
            onChangePriority={handleChangePriority}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        </Suspense>
      )}
    </div>
  )
}
