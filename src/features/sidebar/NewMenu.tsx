import { useEffect, useRef, useState } from 'react'
import { FileText, Folder, LayoutGrid, SquareCheck } from 'lucide-react'
import type { Route } from '../../App'
import type { Item, Space } from '../../lib/types'
import { ICON_EMOJI } from '../../lib/icons'

// The creation form shows the first row of the picker; the full set (and
// image upload) lives on the space's page once it exists.
const SPACE_ICONS = ICON_EMOJI.slice(0, 12)

interface Props {
  spaces: Space[]
  route: Route
  onCreateTask: (title: string) => Promise<void>
  onCreateSpace: (name: string, icon: string) => Promise<Space>
  onCreateItem: (spaceId: number, name: string) => Promise<Item>
  onNewPage: () => void
  onNavigate: (route: Route) => void
  onClose: () => void
}

type Choice = 'task' | 'page' | 'item' | 'space'

/**
 * The "+ New" popover. What it offers first depends on where you are: inside
 * an item, a task or a page is the likely next thing; elsewhere, a task or an
 * item. Each choice becomes a one-line form in place — no dialogs.
 */
export function NewMenu({ spaces, route, onCreateTask, onCreateSpace, onCreateItem, onNewPage, onNavigate, onClose }: Props) {
  const inItem = route.kind === 'item'
  const currentSpaceId =
    route.kind === 'space' ? route.spaceId : null
  const [choice, setChoice] = useState<Choice | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(SPACE_ICONS[0])
  const [spaceId, setSpaceId] = useState<number | ''>(currentSpaceId ?? spaces[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const choices: { id: Choice; label: string; icon: typeof FileText; hint: string }[] = [
    { id: 'task', label: 'Task', icon: SquareCheck, hint: 'Something to do' },
    ...(inItem ? [{ id: 'page' as Choice, label: 'Page', icon: FileText, hint: 'In this item' }] : []),
    { id: 'item', label: 'Item', icon: LayoutGrid, hint: 'An event, a project, a goal' },
    { id: 'space', label: 'Space', icon: Folder, hint: 'An area of your life' },
  ]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      if (choice === 'task') {
        await onCreateTask(trimmed)
      } else if (choice === 'space') {
        const space = await onCreateSpace(trimmed, icon)
        onNavigate({ kind: 'space', spaceId: space.id })
      } else if (choice === 'item' && spaceId !== '') {
        const item = await onCreateItem(spaceId, trimmed)
        onNavigate({ kind: 'item', itemId: item.id, pageId: null })
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }

  function pick(next: Choice) {
    if (next === 'page') {
      onNewPage()
      onClose()
      return
    }
    if (next === 'item' && spaces.length === 0) {
      // Can't put an item anywhere yet — make the space first.
      setChoice('space')
      return
    }
    setChoice(next)
    setName('')
  }

  return (
    <div className="new-menu" ref={ref} role="dialog" aria-label="New">
      {choice === null ? (
        <ul className="new-menu__list">
          {choices.map(({ id, label, icon: Icon, hint }) => (
            <li key={id}>
              <button type="button" className="new-menu__choice" onClick={() => pick(id)}>
                <Icon size={16} />
                <span className="new-menu__label">
                  {label}
                  <span className="new-menu__hint">{hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <form className="new-menu__form" onSubmit={submit}>
          <p className="new-menu__title">
            New {choice}
            <button type="button" className="new-menu__back" onClick={() => setChoice(null)}>
              Back
            </button>
          </p>
          {choice === 'space' && (
            <div className="icon-row" role="radiogroup" aria-label="Icon">
              {SPACE_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  role="radio"
                  aria-checked={icon === emoji}
                  className={`icon-row__option${icon === emoji ? ' is-active' : ''}`}
                  onClick={() => setIcon(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          {choice === 'item' && (
            <select className="input input--select" value={spaceId} onChange={(e) => setSpaceId(Number(e.target.value))} aria-label="Space">
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon ? `${s.icon} ` : ''}
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <input
            className="input"
            placeholder={choice === 'task' ? 'What needs doing?' : choice === 'space' ? 'Events, Career, Travel...' : 'Name'}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="btn btn--primary btn--sm" disabled={!name.trim() || busy}>
            Create
          </button>
        </form>
      )}
    </div>
  )
}
