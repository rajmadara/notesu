import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { TaskPriority } from '../../lib/types'
import { PRIORITY_OPTIONS, priorityLabel } from '../../lib/priority'
import { useDismiss } from '../../lib/useDismiss'
import { PriorityDot } from './PriorityDot'

interface Props {
  value: TaskPriority
  onChange: (priority: TaskPriority) => void
}

/**
 * Priority as a dropdown instead of four pills, so it can sit on one row with
 * the due date and tags. It opens upward, right-aligned, because it lives at
 * the bottom-right of a scrolling panel — down would be clipped, and
 * left-aligned would run off the edge.
 */
export function PriorityPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))

  return (
    <div className="menu-anchor" ref={ref}>
      <button
        type="button"
        className="field-select"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <PriorityDot value={value} />
        {priorityLabel(value)}
        <ChevronDown size={13} className="field-select__chevron" />
      </button>
      {open && (
        <div className="menu menu--above" role="listbox">
          {PRIORITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`menu__item${option.value === value ? ' is-selected' : ''}`}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              <PriorityDot value={option.value} />
              <span className="menu__item-label">{option.label}</span>
              {option.value === value && <Check size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
