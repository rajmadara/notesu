import { useEffect, useState } from 'react'
import {
  Archive,
  ChevronDown,
  ChevronRight,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  SquareCheck,
  Sun,
} from 'lucide-react'
import { NotesuMark } from './NotesuMark'
import { NewMenu } from './NewMenu'
import { EntityIcon } from '../workspace/EntityIcon'
import { DEFAULT_ITEM_ICON, DEFAULT_SPACE_ICON } from '../../lib/icons'
import type { Theme } from '../../lib/theme'
import type { Item, SharedItem, SharedSpace, Space } from '../../lib/types'
import type { Route, TaskView } from '../../App'

const COLLAPSED_SPACES_KEY = 'notesu-collapsed-spaces'

interface Props {
  mobileOpen: boolean
  onCloseMobile: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
  theme: Theme
  onChangeTheme: (theme: Theme) => void
  spaces: Space[]
  items: Item[]
  sharedSpaces: SharedSpace[]
  sharedItems: SharedItem[]
  route: Route
  view: TaskView
  onChangeView: (view: TaskView) => void
  /** Live drag width; the parent clamps and decides when to collapse. */
  onResize: (width: number) => void
  onNavigate: (route: Route) => void
  onCreateTask: (title: string) => Promise<void>
  onCreateSpace: (name: string, icon: string) => Promise<Space>
  onCreateItem: (spaceId: number, name: string) => Promise<Item>
  onNewPage: () => void
  onSignOut: () => void
  /** Set by the mobile bottom bar to open the drawer straight onto "+ New". */
  openNewNonce: number
}

function loadCollapsed(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_SPACES_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

export function Sidebar({
  mobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapsed,
  theme,
  onChangeTheme,
  spaces,
  items,
  sharedSpaces,
  sharedItems,
  route,
  view,
  onChangeView,
  onResize,
  onNavigate,
  onCreateTask,
  onCreateSpace,
  onCreateItem,
  onNewPage,
  onSignOut,
  openNewNonce,
}: Props) {
  const [collapsedSpaces, setCollapsedSpaces] = useState<Set<number>>(loadCollapsed)
  const [resizing, setResizing] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Which space has its inline "new item" row open.
  const [addingIn, setAddingIn] = useState<number | null>(null)
  const [draftItem, setDraftItem] = useState('')

  useEffect(() => {
    localStorage.setItem(COLLAPSED_SPACES_KEY, JSON.stringify([...collapsedSpaces]))
  }, [collapsedSpaces])

  useEffect(() => {
    if (openNewNonce > 0) setNewOpen(true)
  }, [openNewNonce])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseMobile()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCloseMobile])

  const isItemActive = (id: number) => route.kind === 'item' && route.itemId === id
  const onTasks = route.kind === 'tasks'
  // Items reached through a shared space are nested under it; the rest —
  // shared individually — are listed on their own so nothing appears twice.
  const sharedSpaceIds = new Set(sharedSpaces.map((s) => s.id))
  const looseSharedItems = sharedItems.filter((i) => !sharedSpaceIds.has(i.space_id))

  /**
   * Drag the right edge to resize. Tracking pointermove on the document (not
   * the handle) keeps the drag alive when the cursor outruns the 5px strip.
   */
  function startResize(e: React.PointerEvent) {
    e.preventDefault()
    setResizing(true)
    function onMove(ev: PointerEvent) {
      onResize(ev.clientX)
    }
    function onUp() {
      setResizing(false)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  function toggleSpace(id: number) {
    setCollapsedSpaces((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submitItem(spaceId: number) {
    const name = draftItem.trim()
    if (!name) return
    const item = await onCreateItem(spaceId, name)
    setDraftItem('')
    setAddingIn(null)
    setCollapsedSpaces((prev) => {
      const next = new Set(prev)
      next.delete(spaceId)
      return next
    })
    onNavigate({ kind: 'item', itemId: item.id, pageId: null })
  }

  const themeIcon = theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />
  const collapseIcon = collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />

  return (
    <>
      <div className={`sidebar__backdrop${mobileOpen ? ' is-open' : ''}`} onClick={onCloseMobile} />
      <aside
        className={`sidebar${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-mobile-open' : ''}${resizing ? ' is-resizing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sidebar__resize"
          onPointerDown={startResize}
          onDoubleClick={onToggleCollapsed}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          title="Drag to resize"
        />
        {collapsed ? (
          <div className="sidebar-rail">
            {/* The mark is the way home — there's no separate Home entry. */}
            <button
              type="button"
              className={`sidebar-rail__brand${route.kind === 'home' ? ' is-active' : ''}`}
              onClick={() => onNavigate({ kind: 'home' })}
              aria-label="Home"
              title="Notesu — Home"
            >
              <NotesuMark size={22} />
            </button>
            <button type="button" className="sidebar-rail__icon" onClick={onToggleCollapsed} aria-label="Expand sidebar" title="Expand sidebar">
              {collapseIcon}
            </button>
            <span className="sidebar-rail__divider" />
            <button
              type="button"
              className={`sidebar-rail__icon${onTasks && view === 'active' ? ' is-active' : ''}`}
              onClick={() => {
                onChangeView('active')
                onNavigate({ kind: 'tasks' })
              }}
              aria-label="Tasks"
              title="Tasks"
            >
              <SquareCheck size={17} />
            </button>
            <button
              type="button"
              className={`sidebar-rail__icon${onTasks && view === 'archived' ? ' is-active' : ''}`}
              onClick={() => {
                onChangeView('archived')
                onNavigate({ kind: 'tasks' })
              }}
              aria-label="Archived"
              title="Archived"
            >
              <Archive size={17} />
            </button>
            <button
              type="button"
              className="sidebar-rail__icon"
              onClick={() => {
                onToggleCollapsed()
                setNewOpen(true)
              }}
              aria-label="New"
              title="New"
            >
              <Plus size={17} />
            </button>
            <span className="sidebar-rail__divider" />
            <button
              type="button"
              className="sidebar-rail__icon"
              onClick={() => onChangeTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title="Theme"
            >
              {themeIcon}
            </button>
          </div>
        ) : (
          <>
            <div className="sidebar__top">
              {/* The brand is the way home — there's no separate Home entry. */}
              <button
                type="button"
                className={`sidebar__brand${route.kind === 'home' ? ' is-active' : ''}`}
                onClick={() => onNavigate({ kind: 'home' })}
                aria-label="Home"
                title="Home"
              >
                <NotesuMark size={21} />
                <span className="sidebar__brand-text">
                  Notes<span className="app__logo-accent">u</span>
                </span>
              </button>
              <button type="button" className="icon-btn icon-btn--sm" onClick={onToggleCollapsed} aria-label="Collapse sidebar" title="Collapse sidebar">
                {collapseIcon}
              </button>
            </div>

            <nav className="sidebar__nav" aria-label="Primary">
              <button
                type="button"
                className={`sidebar__nav-item${onTasks && view === 'active' ? ' is-active' : ''}`}
                onClick={() => {
                  onChangeView('active')
                  onNavigate({ kind: 'tasks' })
                }}
              >
                <SquareCheck size={15} /> Tasks
              </button>
            </nav>

            <div className="sidebar__scroll">
              <section className="sidebar__section">
                <div className="sidebar__section-head">
                  <span className="sidebar__section-label">My spaces</span>
                  <button
                    type="button"
                    className="icon-btn icon-btn--xs"
                    onClick={() => setNewOpen(true)}
                    aria-label="New space"
                    title="New"
                  >
                    <Plus size={13} />
                  </button>
                </div>

                {spaces.length === 0 && (
                  <p className="sidebar__empty">
                    No spaces yet.{' '}
                    <button type="button" className="link" onClick={() => setNewOpen(true)}>
                      Create one
                    </button>
                  </p>
                )}

                {spaces.map((space) => {
                  const spaceItems = items.filter((i) => i.space_id === space.id)
                  const open = !collapsedSpaces.has(space.id)
                  const active = route.kind === 'space' && route.spaceId === space.id
                  return (
                    <div key={space.id} className="tree">
                      <div className={`tree__space${active ? ' is-active' : ''}`}>
                        <button
                          type="button"
                          className="tree__toggle"
                          onClick={() => toggleSpace(space.id)}
                          aria-label={open ? `Collapse ${space.name}` : `Expand ${space.name}`}
                          aria-expanded={open}
                        >
                          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                        <button type="button" className="tree__space-name" onClick={() => onNavigate({ kind: 'space', spaceId: space.id })}>
                          <EntityIcon
                            icon={space.icon}
                            fallback={DEFAULT_SPACE_ICON}
                            size={15}
                            className="tree__icon"
                          />
                          {space.name}
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn--xs tree__add"
                          onClick={() => {
                            setAddingIn(space.id)
                            setDraftItem('')
                            setCollapsedSpaces((prev) => {
                              const next = new Set(prev)
                              next.delete(space.id)
                              return next
                            })
                          }}
                          aria-label={`New in ${space.name}`}
                          title="New item"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      {open && (
                        <div className="tree__items">
                          {spaceItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className={`tree__item${isItemActive(item.id) ? ' is-active' : ''}`}
                              onClick={() => onNavigate({ kind: 'item', itemId: item.id, pageId: null })}
                            >
                              <EntityIcon icon={item.icon} fallback={DEFAULT_ITEM_ICON} size={14} />
                              <span className="tree__item-text">{item.name}</span>
                            </button>
                          ))}
                          {addingIn === space.id && (
                            <input
                              className="tree__input"
                              placeholder="Name"
                              value={draftItem}
                              autoFocus
                              onChange={(e) => setDraftItem(e.target.value)}
                              onBlur={() => !draftItem.trim() && setAddingIn(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') submitItem(space.id)
                                if (e.key === 'Escape') setAddingIn(null)
                              }}
                              aria-label={`New item in ${space.name}`}
                            />
                          )}
                          {spaceItems.length === 0 && addingIn !== space.id && (
                            <button
                              type="button"
                              className="tree__item tree__item--ghost"
                              onClick={() => {
                                setAddingIn(space.id)
                                setDraftItem('')
                              }}
                            >
                              <Plus size={13} /> Add
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </section>

              {(sharedSpaces.length > 0 || looseSharedItems.length > 0) && (
                <section className="sidebar__section">
                  <div className="sidebar__section-head">
                    <span className="sidebar__section-label">Shared with me</span>
                  </div>

                  {/* A shared space nests its items, exactly like your own. */}
                  {sharedSpaces.map((space) => {
                    const spaceItems = sharedItems.filter((i) => i.space_id === space.id)
                    const open = !collapsedSpaces.has(space.id)
                    const active = route.kind === 'space' && route.spaceId === space.id
                    return (
                      <div key={space.id} className="tree">
                        <div className={`tree__space${active ? ' is-active' : ''}`}>
                          <button
                            type="button"
                            className="tree__toggle"
                            onClick={() => toggleSpace(space.id)}
                            aria-label={open ? `Collapse ${space.name}` : `Expand ${space.name}`}
                            aria-expanded={open}
                          >
                            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </button>
                          <button
                            type="button"
                            className="tree__space-name"
                            onClick={() => onNavigate({ kind: 'space', spaceId: space.id })}
                            title={`Shared by ${space.owner_name} · can ${space.permission}`}
                          >
                            <EntityIcon
                              icon={space.icon}
                              fallback={DEFAULT_SPACE_ICON}
                              size={15}
                              className="tree__icon"
                            />
                            {space.name}
                          </button>
                        </div>
                        {open && (
                          <div className="tree__items">
                            {spaceItems.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className={`tree__item${isItemActive(item.id) ? ' is-active' : ''}`}
                                onClick={() => onNavigate({ kind: 'item', itemId: item.id, pageId: null })}
                              >
                                <EntityIcon icon={item.icon} fallback={DEFAULT_ITEM_ICON} size={14} />
                                <span className="tree__item-text">{item.name}</span>
                              </button>
                            ))}
                            {spaceItems.length === 0 && <p className="tree__empty">Nothing here yet</p>}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Items shared on their own, without their space. */}
                  {looseSharedItems.length > 0 && (
                    <div className="tree__items tree__items--flat">
                      {looseSharedItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`tree__item${isItemActive(item.id) ? ' is-active' : ''}`}
                          onClick={() => onNavigate({ kind: 'item', itemId: item.id, pageId: null })}
                          title={`Shared by ${item.owner_name}`}
                        >
                          <EntityIcon icon={item.icon} fallback={DEFAULT_ITEM_ICON} size={14} />
                          <span className="tree__item-text">
                            {item.owner_name.split(' ')[0]}'s {item.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}

              <section className="sidebar__section">
                <div className="sidebar__section-head">
                  <span className="sidebar__section-label">Archive</span>
                </div>
                <button
                  type="button"
                  className={`sidebar__nav-item${onTasks && view === 'archived' ? ' is-active' : ''}`}
                  onClick={() => {
                    onChangeView('archived')
                    onNavigate({ kind: 'tasks' })
                  }}
                >
                  <Archive size={15} /> Archived
                </button>
              </section>
            </div>

            <div className="sidebar__footer">
              <div className="menu-anchor menu-anchor--up">
                <button type="button" className="sidebar__new" onClick={() => setNewOpen((v) => !v)} aria-expanded={newOpen}>
                  <Plus size={15} /> New
                </button>
                {newOpen && (
                  <NewMenu
                    spaces={spaces}
                    route={route}
                    onCreateTask={onCreateTask}
                    onCreateSpace={onCreateSpace}
                    onCreateItem={onCreateItem}
                    onNewPage={onNewPage}
                    onNavigate={onNavigate}
                    onClose={() => setNewOpen(false)}
                  />
                )}
              </div>

              <div className="menu-anchor menu-anchor--up">
                <button type="button" className="sidebar__nav-item" onClick={() => setSettingsOpen((v) => !v)} aria-expanded={settingsOpen}>
                  <Settings size={15} /> Settings
                </button>
                {settingsOpen && (
                  <div className="menu menu--up" onMouseLeave={() => setSettingsOpen(false)}>
                    <button type="button" className="menu__item" onClick={() => onChangeTheme(theme === 'dark' ? 'light' : 'dark')}>
                      {themeIcon} {theme === 'dark' ? 'Light theme' : 'Dark theme'}
                    </button>
                    <button
                      type="button"
                      className="menu__item"
                      onClick={() => {
                        setSettingsOpen(false)
                        onSignOut()
                      }}
                    >
                      <LogOut size={15} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
