import { useEffect, useState } from 'react'
import type { Task, TaskPriority } from '../../lib/types'
import {
  createTask,
  deleteTask,
  getAllTasks,
  resetTaskTimer,
  setTaskPriority,
  setTaskStatus,
  startTaskTimer,
  stopTaskTimer,
} from '../../lib/db'
import { TaskItem, NEXT_STATUS } from './TaskItem'

export function DailyTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(true)

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

  async function handleCycleStatus(task: Task) {
    await setTaskStatus(task.id, NEXT_STATUS[task.status])
    await refresh()
  }

  async function handleToggleDone(task: Task) {
    if (task.running_since !== null) {
      await stopTaskTimer(task.id)
    }
    await setTaskStatus(task.id, task.status === 'done' ? 'not_started' : 'done')
    await refresh()
  }

  async function handleChangePriority(task: Task, priority: TaskPriority) {
    await setTaskPriority(task.id, priority)
    await refresh()
  }

  async function handleToggleTimer(task: Task) {
    if (task.running_since !== null) {
      await stopTaskTimer(task.id)
    } else {
      await startTaskTimer(task.id)
    }
    await refresh()
  }

  async function handleResetTimer(task: Task) {
    await resetTaskTimer(task.id)
    await refresh()
  }

  async function handleDelete(task: Task) {
    await deleteTask(task.id)
    await refresh()
  }

  const doneCount = tasks.filter((t) => t.status === 'done').length

  return (
    <div className="daily-tasks">
      <div className="daily-tasks__stats">
        <span className="daily-tasks__count">
          {tasks.length === 0 ? 'No tasks yet' : `${doneCount} / ${tasks.length} done`}
        </span>
      </div>

      <form className="daily-tasks__add" onSubmit={handleAddTask}>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task..."
        />
        <button type="submit">Add</button>
      </form>

      {loading ? (
        <p className="daily-tasks__empty">Loading...</p>
      ) : tasks.length === 0 ? (
        <p className="daily-tasks__empty">No tasks yet.</p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onCycleStatus={handleCycleStatus}
              onToggleDone={handleToggleDone}
              onChangePriority={handleChangePriority}
              onToggleTimer={handleToggleTimer}
              onResetTimer={handleResetTimer}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
