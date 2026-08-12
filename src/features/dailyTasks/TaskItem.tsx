import { useEffect, useRef, useState } from 'react'
import type { Task } from '../../lib/types'

interface Props {
  task: Task
  categories: string[]
  onToggleDone: (task: Task) => void
  onChangeCategory: (task: Task, category: string) => void
  onDelete: (task: Task) => void
  onSelect: (task: Task) => void
}

export function TaskItem({
  task,
  categories,
  onToggleDone,
  onChangeCategory,
  onDelete,
  onSelect,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [view, setView] = useState<'main' | 'tag'>('main')
  const [newTag, setNewTag] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenu()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  function closeMenu() {
    setMenuOpen(false)
    setView('main')
    setNewTag('')
  }

  function applyTag(category: string) {
    closeMenu()
    if (category !== (task.category ?? '')) onChangeCategory(task, category)
  }

  function handleNewTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const value = newTag.trim()
    if (value) applyTag(value)
  }

  const current = task.category?.trim() ?? ''

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

        <span className="task-item__title" onClick={() => onSelect(task)} title="Click for details">
          {task.title}
        </span>

        <div className="task-item__menu" ref={menuRef}>
          <button
            type="button"
            className="task-item__menu-trigger"
            onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
            aria-label="Task options"
            aria-expanded={menuOpen}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <circle cx="12" cy="5" r="1.75" />
              <circle cx="12" cy="12" r="1.75" />
              <circle cx="12" cy="19" r="1.75" />
            </svg>
          </button>

          {menuOpen && view === 'main' && (
            <div className="task-item__menu-dropdown">
              {/* More options land here in future. */}
              <button
                type="button"
                className="task-item__menu-item"
                onClick={() => setView('tag')}
              >
                Tag
                <span className="task-item__menu-value">{current || 'None'}</span>
              </button>
              <button
                type="button"
                className="task-item__menu-item task-item__menu-item--danger"
                onClick={() => {
                  closeMenu()
                  onDelete(task)
                }}
              >
                Delete
              </button>
            </div>
          )}

          {menuOpen && view === 'tag' && (
            <div className="task-item__menu-dropdown">
              <button
                type="button"
                className="task-item__menu-back"
                onClick={() => setView('main')}
              >
                <span aria-hidden="true">&lsaquo;</span> Tag
              </button>

              <div className="task-item__menu-list">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`task-item__menu-item${category === current ? ' is-selected' : ''}`}
                    onClick={() => applyTag(category)}
                  >
                    {category}
                  </button>
                ))}
                {current && (
                  <button
                    type="button"
                    className="task-item__menu-item task-item__menu-item--muted"
                    onClick={() => applyTag('')}
                  >
                    Remove tag
                  </button>
                )}
              </div>

              <input
                type="text"
                className="task-item__menu-input"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleNewTagKeyDown}
                placeholder="New tag..."
                aria-label="New tag"
                autoFocus
              />
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
