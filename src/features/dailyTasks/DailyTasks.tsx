import { lazy, Suspense, useState } from 'react'
import type { Item, Task, TaskPriority } from '../../lib/types'
import type { TaskView } from '../../App'
import {
  createTask,
  deleteTask,
  setTaskArchived,
  setTaskDueDate,
  setTaskPriority,
  setTaskStatus,
  setTaskTitle,
} from '../../lib/db'
import { TaskItem } from './TaskItem'
import { HeaderTitle } from '../shell/HeaderSlot'

// The panel pulls in the rich-text editor (~600kB), which nothing else needs —
// loading it on first open keeps it out of the initial page bundle.
const TaskDetailPanel = lazy(() =>
  import('./TaskDetailPanel').then((m) => ({ default: m.TaskDetailPanel })),
)

interface Props {
  tasks: Task[]
  loading: boolean
  items: Item[]
  view: TaskView
  searchResults: Task[] | null
  onRefresh: () => Promise<void>
  onOpenItem: (itemId: number) => void
}

export function DailyTasks({ tasks, loading, items, view, searchResults, onRefresh, onOpenItem }: Props) {
  const [newTitle, setNewTitle] = useState('')
  // '' = no item, so the task lands in the plain Tasks list.
  const [newItemId, setNewItemId] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    await createTask(title, newItemId ? Number(newItemId) : null)
    setNewTitle('')
    await onRefresh()
  }

  async function handleChangeDueDate(task: Task, dueDate: string | null) {
    await setTaskDueDate(task.id, dueDate)
    await onRefresh()
  }

  async function handleToggleDone(task: Task) {
    await setTaskStatus(task.id, task.status === 'done' ? 'not_started' : 'done')
    await onRefresh()
  }

  async function handleChangePriority(task: Task, priority: TaskPriority) {
    await setTaskPriority(task.id, priority)
    await onRefresh()
  }

  async function handleRename(task: Task, title: string) {
    await setTaskTitle(task.id, title)
    await onRefresh()
  }

  async function handleToggleArchive(task: Task) {
    await setTaskArchived(task.id, !task.archived)
    await onRefresh()
  }

  async function handleDelete(task: Task) {
    await deleteTask(task.id)
    await onRefresh()
  }

  const searching = searchResults !== null
  const archived = view === 'archived'

  const visibleTasks = tasks.filter((t) => t.archived === archived)
  const doneCount = visibleTasks.filter((t) => t.status === 'done').length
  const donePercent =
    visibleTasks.length === 0 ? 0 : Math.round((doneCount / visibleTasks.length) * 100)
  const sortedTasks = (searching ? [...searchResults] : [...visibleTasks]).sort(
    (a, b) => Number(a.status === 'done') - Number(b.status === 'done'),
  )
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null

  return (
    <div className="daily-tasks">
      <HeaderTitle>
        <h1 className="header-title">{searching ? 'Search' : archived ? 'Archived' : 'Tasks'}</h1>
      </HeaderTitle>

      {!archived && !searching && (
        <form className="daily-tasks__add" onSubmit={handleAddTask}>
          <input
            type="text"
            className="daily-tasks__add-title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a task..."
          />
          {/* Picks an existing item to file this under; the task then shows on
              that item's list too. Items are made in a space, not here. */}
          {items.length > 0 && (
            <select
              className="daily-tasks__add-item"
              value={newItemId}
              onChange={(e) => setNewItemId(e.target.value)}
              aria-label="Item"
              title="File this task under an item"
            >
              <option value="">No item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          )}
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
        {searching && <span className="daily-tasks__archived-label">Search results</span>}
        <span className="daily-tasks__count">
          {searching
            ? `${sortedTasks.length} result${sortedTasks.length === 1 ? '' : 's'}`
            : visibleTasks.length === 0
              ? 'No tasks yet'
              : `${doneCount} of ${visibleTasks.length} done · ${donePercent}%`}
        </span>
      </div>

      {!archived && !searching && (
        <div className="daily-tasks__progress" role="presentation">
          <span className="daily-tasks__progress-fill" style={{ width: `${donePercent}%` }} />
        </div>
      )}

      {loading ? (
        <p className="daily-tasks__empty">Loading...</p>
      ) : sortedTasks.length === 0 ? (
        <p className="daily-tasks__empty">
          {searching
            ? 'No matches for your search.'
            : archived
              ? 'No archived tasks.'
              : 'No tasks yet.'}
        </p>
      ) : (
        <ul className="task-list">
          {sortedTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              itemName={
                task.item_id !== null ? items.find((i) => i.id === task.item_id)?.name : undefined
              }
              showArchivedBadge={searching}
              onToggleDone={handleToggleDone}
              onToggleArchive={handleToggleArchive}
              onDelete={handleDelete}
              onSelect={(t) => setSelectedTaskId(t.id)}
              onOpenItem={onOpenItem}
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
            onChangeDueDate={handleChangeDueDate}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        </Suspense>
      )}
    </div>
  )
}
