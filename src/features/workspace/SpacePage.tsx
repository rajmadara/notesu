import { useState } from 'react'
import { Calendar, Ellipsis, Plus, Share2, Trash2 } from 'lucide-react'
import type { Item, Space, Task } from '../../lib/types'
import { dueLabel, dueTone } from '../../lib/date'
import { HeaderTitle } from '../shell/HeaderSlot'
import { EntityIcon } from './EntityIcon'
import { IconPicker } from './IconPicker'
import { ShareDialog } from './ShareDialog'
import { DEFAULT_ITEM_ICON, DEFAULT_SPACE_ICON } from '../../lib/icons'

interface Props {
  space: Space
  /** 'owner' for your own; a shared space is 'edit' or 'view'. */
  permission: 'owner' | 'edit' | 'view'
  items: Item[]
  tasks: Task[]
  onOpenItem: (itemId: number) => void
  onCreateItem: (name: string) => Promise<void>
  onUpdateSpace: (name: string, icon: string) => Promise<void>
  onDeleteSpace: () => Promise<void>
}

/** A space's front page: its items, and where new ones are made. */
export function SpacePage({
  space,
  permission,
  items,
  tasks,
  onOpenItem,
  onCreateItem,
  onUpdateSpace,
  onDeleteSpace,
}: Props) {
  const isOwner = permission === 'owner'
  const canEdit = permission !== 'view'
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickingIcon, setPickingIcon] = useState(false)
  const [sharing, setSharing] = useState(false)

  const remaining = (itemId: number) =>
    tasks.filter((t) => t.item_id === itemId && !t.archived && t.status !== 'done').length

  async function create(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    await onCreateItem(trimmed)
    setName('')
    setCreating(false)
    setBusy(false)
  }

  return (
    <div className="space-page">
      <HeaderTitle>
        <div className="menu-anchor">
          <button
            type="button"
            className="header-icon-btn"
            onClick={() => isOwner && setPickingIcon((v) => !v)}
            disabled={!isOwner}
            aria-label="Change icon"
            title={isOwner ? 'Change icon' : undefined}
            aria-expanded={pickingIcon}
          >
            <EntityIcon icon={space.icon} fallback={DEFAULT_SPACE_ICON} size={22} />
          </button>
          {pickingIcon && isOwner && (
            <IconPicker
              value={space.icon}
              defaultIcon={DEFAULT_SPACE_ICON}
              onChange={(icon) => onUpdateSpace(space.name, icon)}
              onClose={() => setPickingIcon(false)}
            />
          )}
        </div>
        <input
          key={space.id}
          className="header-title header-title--input"
          defaultValue={space.name}
          readOnly={!isOwner}
          onBlur={(e) => {
            const next = e.target.value.trim()
            if (next && next !== space.name) onUpdateSpace(next, space.icon)
            else e.target.value = space.name
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          aria-label="Space name"
        />
        {isOwner ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSharing(true)}>
            <Share2 size={14} /> <span className="workspace__share-label">Share</span>
          </button>
        ) : (
          <span className="workspace__shared-by">Shared · can {permission}</span>
        )}
        <div className="menu-anchor">
          <button
            type="button"
            className="icon-btn"
            onClick={() => isOwner && setMenuOpen((v) => !v)}
            disabled={!isOwner}
            aria-label="Space options"
            aria-expanded={menuOpen}
            hidden={!isOwner}
          >
            <Ellipsis size={16} />
          </button>
          {menuOpen && isOwner && (
            <div className="menu" onMouseLeave={() => setMenuOpen(false)}>
              <button
                type="button"
                className="menu__item menu__item--danger"
                onClick={() => {
                  setMenuOpen(false)
                  if (confirm(`Delete “${space.name}” and everything in it?`)) onDeleteSpace()
                }}
              >
                <Trash2 size={14} /> Delete space
              </button>
            </div>
          )}
        </div>
      </HeaderTitle>

      {sharing && isOwner && (
        <ShareDialog
          kind="space"
          id={space.id}
          name={space.name}
          onClose={() => setSharing(false)}
          onChanged={() => {}}
        />
      )}

      <ul className="space-page__items">
        {items.map((item) => {
          const left = remaining(item.id)
          return (
            <li key={item.id}>
              <button type="button" className="space-item" onClick={() => onOpenItem(item.id)}>
                <span className="space-item__label">
                  <EntityIcon icon={item.icon} fallback={DEFAULT_ITEM_ICON} size={17} />
                  <span className="space-item__name">{item.name}</span>
                </span>
                <span className="space-item__meta">
                  {item.date && (
                    <span className={`due-chip is-${dueTone(item.date)}`}>
                      <Calendar size={11} /> {dueLabel(item.date)}
                    </span>
                  )}
                  {left > 0 && <span className="space-item__remaining">{left} open</span>}
                </span>
              </button>
            </li>
          )
        })}
        {items.length === 0 && !canEdit && <li className="empty-state">Nothing in this space yet.</li>}
        <li hidden={!canEdit}>
          {creating ? (
            <form className="space-item space-item--form" onSubmit={create}>
              <input
                className="input"
                placeholder={`New in ${space.name}...`}
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setCreating(false)
                }}
              />
              <button type="submit" className="btn btn--primary btn--sm" disabled={!name.trim() || busy}>
                Create
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCreating(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <button type="button" className="space-item space-item--new" onClick={() => setCreating(true)}>
              <Plus size={15} /> New
            </button>
          )}
        </li>
      </ul>
    </div>
  )
}
