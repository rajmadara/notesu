import type { Task, TaskStatus } from '../../lib/types'

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

interface Props {
  task: Task
  onCycleStatus: (task: Task) => void
  onToggleDone: (task: Task) => void
  onDelete: (task: Task) => void
  onSelect: (task: Task) => void
}

export function TaskItem({ task, onCycleStatus, onToggleDone, onDelete, onSelect }: Props) {
  return (
    <li className={`task-item task-item--${task.status} task-item--priority-${task.priority}`}>
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

        <span
          className="task-item__title"
          onClick={() => onSelect(task)}
          title="Click for details"
        >
          {task.title}
        </span>

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
    </li>
  )
}

export { NEXT_STATUS }
