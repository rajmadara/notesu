import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
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

/**
 * Categories aren't stored separately — they're whatever distinct values are
 * in use, ordered by the newest task carrying each one, so the one you reached
 * for most recently comes first.
 */
function categoriesByRecentUse(tasks: Task[]): string[] {
  const newest = new Map<string, number>()
  for (const task of tasks) {
    const category = task.category?.trim()
    if (!category) continue
    const seen = newest.get(category) ?? 0
    if (task.created_at > seen) newest.set(category, task.created_at)
  }
  return [...newest.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
}

export function DailyTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

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
    await createTask(title, newCategory.trim())
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

  const categories = useMemo(() => categoriesByRecentUse(tasks), [tasks])

  // A filtered-away category shouldn't leave the list stuck showing nothing.
  useEffect(() => {
    if (activeCategory && !categories.includes(activeCategory)) {
      setActiveCategory(null)
    }
  }, [categories, activeCategory])

  const visibleTasks = activeCategory
    ? tasks.filter((t) => t.category?.trim() === activeCategory)
    : tasks

  const doneCount = visibleTasks.filter((t) => t.status === 'done').length
  const donePercent =
    visibleTasks.length === 0 ? 0 : Math.round((doneCount / visibleTasks.length) * 100)
  const sortedTasks = [...visibleTasks].sort(
    (a, b) => Number(a.status === 'done') - Number(b.status === 'done'),
  )
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null

  return (
    <div className="daily-tasks">
      <form className="daily-tasks__add" onSubmit={handleAddTask}>
        <input
          type="text"
          className="daily-tasks__add-title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task..."
        />
        <input
          type="text"
          className="daily-tasks__add-category"
          list="task-categories"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="Tag"
          aria-label="Tag"
        />
        <datalist id="task-categories">
          {categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
        <button type="submit">Add</button>
      </form>

      <div className="daily-tasks__stats">
        <div className="daily-tasks__categories">
          <button
            type="button"
            className={`daily-tasks__category${activeCategory === null ? ' is-active' : ''}`}
            onClick={() => setActiveCategory(null)}
          >
            All tags
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={`daily-tasks__category${activeCategory === category ? ' is-active' : ''}`}
              onClick={() =>
                setActiveCategory((current) => (current === category ? null : category))
              }
            >
              {category}
            </button>
          ))}
        </div>

        <span className="daily-tasks__count">
          {visibleTasks.length === 0
            ? 'No tasks yet'
            : `${doneCount} of ${visibleTasks.length} done · ${donePercent}%`}
        </span>
      </div>

      <div className="daily-tasks__progress" role="presentation">
        <span className="daily-tasks__progress-fill" style={{ width: `${donePercent}%` }} />
      </div>

      {loading ? (
        <p className="daily-tasks__empty">Loading...</p>
      ) : sortedTasks.length === 0 ? (
        <p className="daily-tasks__empty">
          {activeCategory ? `No tasks in ${activeCategory}.` : 'No tasks yet.'}
        </p>
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
