import { Archive, Check, Users } from 'lucide-react'
import type { Task } from '../../lib/types'
import { dueLabel, dueTone } from '../../lib/date'
import { archivingSoon, daysUntilArchived } from '../../lib/archive'

const PRIORITY_LABEL: Record<string, string> = {
  urgent_important: 'Urgent & important',
  urgent_not_important: 'Urgent, not important',
  important_not_urgent: 'Important, not urgent',
}

interface Props {
  task: Task
  /** Name of the item this belongs to. Omitted on an item's own page, where
   *  every task obviously belongs to it. */
  itemName?: string
  /** An ISO date whose due-chip is redundant here — the row is already inside
   *  that day's section, so repeating it on every line adds nothing. */
  hideChipForDate?: string
  readOnly?: boolean
  onToggle: (task: Task) => void
  onOpen: (task: Task) => void
  onOpenItem?: (itemId: number) => void
}

/**
 * One task, shared by the main list and an item's Tasks page so both read
 * identically — and so a task added in either place looks the same in the
 * other, which is where it also appears.
 */
export function TaskRow({
  task,
  itemName,
  hideChipForDate,
  readOnly = false,
  onToggle,
  onOpen,
  onOpenItem,
}: Props) {
  const tone = task.due_date ? dueTone(task.due_date) : null
  const showDue = task.due_date && task.due_date !== hideChipForDate

  return (
    <li className={`task-row${task.status === 'done' ? ' is-done' : ''}`}>
      <button
        type="button"
        className="check-row__box"
        onClick={() => !readOnly && onToggle(task)}
        disabled={readOnly}
        aria-label="Toggle done"
      >
        {task.status === 'done' && <Check size={12} strokeWidth={3} />}
      </button>

      {task.priority !== 'none' && (
        <span
          className={`task-row__priority is-${task.priority}`}
          title={PRIORITY_LABEL[task.priority]}
          aria-label={PRIORITY_LABEL[task.priority]}
        />
      )}

      <button type="button" className="task-row__title" onClick={() => onOpen(task)} title="Open task">
        {task.title}
      </button>

      {task.owner_name && (
        <span className="task-row__owner" title={`Shared with you by ${task.owner_name}`}>
          <Users size={11} />
          {task.owner_name}
        </span>
      )}

      {itemName && task.item_id !== null && (
        <button
          type="button"
          className="task-row__context"
          onClick={() => onOpenItem?.(task.item_id!)}
          title={`Open ${itemName}`}
        >
          {itemName}
        </button>
      )}

      {showDue && <span className={`due-chip is-${tone}`}>{dueLabel(task.due_date!)}</span>}

      {archivingSoon(task) && (
        <span
          className="task-row__sweep"
          title="Finished tasks are archived a week after you tick them"
        >
          <Archive size={11} />
          {daysUntilArchived(task) === 0 ? 'Archiving today' : 'Archiving tomorrow'}
        </span>
      )}
    </li>
  )
}
