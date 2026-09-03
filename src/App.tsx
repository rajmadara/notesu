import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Archive, Home as HomeIcon, Menu, Plus } from 'lucide-react'
import { supabase } from './lib/supabase'
import { applyTheme, getInitialTheme, type Theme } from './lib/theme'
import type { Item, SharedItem, SharedSpace, Space, Task, TaskPriority } from './lib/types'
import {
  createTask,
  deleteTask,
  getAllTasks,
  searchTasks,
  setTaskArchived,
  setTaskDueDate,
  setTaskPriority,
  setTaskStatus,
  setTaskTitle,
} from './lib/db'
import {
  createItem,
  createSpace,
  deleteSpace,
  getItems,
  getSharedItems,
  getSharedSpaces,
  getSpaces,
  updateSpace,
} from './lib/workspace'
import { Home } from './features/home/Home'
import { ItemWorkspace } from './features/workspace/ItemWorkspace'
import { SpacePage } from './features/workspace/SpacePage'
import { Sidebar } from './features/sidebar/Sidebar'
import { SearchBox } from './features/search/SearchBox'
import { AccountMenu } from './features/account/AccountMenu'
import { HeaderSlotContext } from './features/shell/headerSlotContext'
import './App.css'
import './features/workspace/workspace.css'

export type TaskView = 'active' | 'archived'

/**
 * Where the main pane is. Home and Tasks are the two fixed destinations;
 * spaces and items are whatever the user has made. An item route with no
 * pageId shows the item's Overview.
 */
export type Route =
  | { kind: 'home' }
  | { kind: 'space'; spaceId: number }
  | { kind: 'item'; itemId: number; pageId: number | null }

const SIDEBAR_COLLAPSED_KEY = 'notesu-sidebar-collapsed'
const SIDEBAR_WIDTH_KEY = 'notesu-sidebar-width'

// The rail is the floor: dragging narrower than SNAP_AT collapses to it
// rather than leaving an unusably thin panel.
const RAIL_WIDTH = 64
const MIN_WIDTH = 200
const MAX_WIDTH = 420
const SNAP_AT = 150

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  // Mobile-only: whether the drawer is open at all (fully hidden otherwise).
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false)
  // Desktop-only: whether the always-visible sidebar is the narrow icon rail.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  )
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY))
    return Number.isFinite(stored) && stored >= MIN_WIDTH && stored <= MAX_WIDTH ? stored : 260
  })
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [route, setRoute] = useState<Route>({ kind: 'home' })

  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)
  const [view, setView] = useState<TaskView>('active')
  // null = not searching; the Tasks page falls back to its normal view.
  const [searchResults, setSearchResults] = useState<Task[] | null>(null)

  const [spaces, setSpaces] = useState<Space[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [sharedSpaces, setSharedSpaces] = useState<SharedSpace[]>([])
  const [sharedItems, setSharedItems] = useState<SharedItem[]>([])
  // Bumped by "+ New → Page" so the workspace opens its add-page form.
  const [addPageNonce, setAddPageNonce] = useState(0)
  // Bumped by the mobile bar's "+" to open the drawer onto the New menu.
  const [openNewNonce, setOpenNewNonce] = useState(0)
  // The header's title area; the current page portals its heading in here.
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed))
  }, [sidebarCollapsed])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth))
  }, [sidebarWidth])

  /** `x` is the pointer's viewport position — the sidebar starts at 0. */
  function handleResizeSidebar(x: number) {
    if (x < SNAP_AT) {
      setSidebarCollapsed(true)
      return
    }
    setSidebarCollapsed(false)
    setSidebarWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(x))))
  }

  const refreshTasks = useCallback(async () => {
    setTasks(await getAllTasks())
    setTasksLoading(false)
  }, [])

  const refreshWorkspace = useCallback(async () => {
    const [nextSpaces, nextItems, nextSharedSpaces, nextShared] = await Promise.all([
      getSpaces(),
      getItems(),
      getSharedSpaces().catch(() => []),
      getSharedItems().catch(() => []),
    ])
    setSpaces(nextSpaces)
    setItems(nextItems)
    setSharedSpaces(nextSharedSpaces)
    setSharedItems(nextShared)
  }, [])

  useEffect(() => {
    if (!session) return
    refreshTasks()
    refreshWorkspace()
  }, [session, refreshTasks, refreshWorkspace])

  async function handleSearch(query: string) {
    if (!query) {
      setSearchResults(null)
      return
    }
    setSearchResults(await searchTasks(query))
    setRoute({ kind: 'home' })
  }

  async function handleAddTask(title: string, itemId: number | null, dueDate: string | null) {
    await createTask(title, itemId, dueDate)
    await refreshTasks()
    // A task filed under an item lands on that item's Tasks page too.
    if (itemId !== null) await refreshWorkspace()
  }

  /** The sidebar's "New → Task" stays a one-liner; no dialog there. */
  async function handleQuickTask(title: string) {
    await createTask(title)
    await refreshTasks()
  }

  async function handleToggleTask(task: Task) {
    await setTaskStatus(task.id, task.status === 'done' ? 'not_started' : 'done')
    await refreshTasks()
  }

  async function handleRenameTask(task: Task, title: string) {
    await setTaskTitle(task.id, title)
    await refreshTasks()
  }

  async function handleChangePriority(task: Task, priority: TaskPriority) {
    await setTaskPriority(task.id, priority)
    await refreshTasks()
  }

  async function handleChangeDueDate(task: Task, dueDate: string | null) {
    await setTaskDueDate(task.id, dueDate)
    await refreshTasks()
  }

  async function handleArchiveTask(task: Task) {
    await setTaskArchived(task.id, !task.archived)
    await refreshTasks()
  }

  async function handleDeleteTask(task: Task) {
    await deleteTask(task.id)
    await refreshTasks()
  }

  async function handleCreateSpace(name: string, icon: string) {
    const space = await createSpace(name, icon)
    await refreshWorkspace()
    return space
  }

  async function handleCreateItem(spaceId: number, name: string) {
    const item = await createItem(spaceId, name)
    await refreshWorkspace()
    return item
  }

  function navigate(next: Route) {
    setRoute(next)
    setSidebarMobileOpen(false)
    setSearchResults(null)
  }

  const meta = (session?.user.user_metadata ?? {}) as { full_name?: string }
  const firstName = (meta.full_name ?? '').split(' ')[0] ?? ''
  const wide = route.kind === 'item'

  return (
    <div
      className="app-shell"
      style={
        {
          '--sidebar-width': `${sidebarCollapsed ? RAIL_WIDTH : sidebarWidth}px`,
        } as React.CSSProperties
      }
    >
      {session && (
        <Sidebar
          mobileOpen={sidebarMobileOpen}
          onCloseMobile={() => setSidebarMobileOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
          theme={theme}
          onChangeTheme={setTheme}
          spaces={spaces}
          items={items}
          sharedSpaces={sharedSpaces}
          sharedItems={sharedItems}
          route={route}
          view={view}
          onChangeView={setView}
          onResize={handleResizeSidebar}
          onNavigate={navigate}
          onCreateTask={handleQuickTask}
          onCreateSpace={handleCreateSpace}
          onCreateItem={handleCreateItem}
          onNewPage={() => setAddPageNonce((n) => n + 1)}
          onSignOut={() => supabase.auth.signOut()}
          openNewNonce={openNewNonce}
        />
      )}

      <div className={`app${session ? (wide ? ' app--wide' : '') : ' app--centered'}`}>
        {session && (
          <header className="app__header">
            <button type="button" className="app__menu-btn" onClick={() => setSidebarMobileOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <div className="app__title" ref={setHeaderSlot} />
            <div className="app__header-right">
              <SearchBox onSearch={handleSearch} />
              <AccountMenu session={session} />
            </div>
          </header>
        )}

        <main>
          <HeaderSlotContext.Provider value={headerSlot}>
          {session === undefined ? null : session === null ? (
            <div className="welcome">
              <div className="welcome__card">
                <h1 className="welcome__title">
                  Welcome to Notes<span className="app__logo-accent">u</span>
                </h1>
                <p className="welcome__subtitle">Your life, organised around what matters.</p>
                <div className="welcome__actions">
                  <button type="button" className="welcome__google" onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}>
                    <span className="welcome__google-icon">
                      <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                      </svg>
                    </span>
                    Sign in with Google
                  </button>
                </div>
              </div>
            </div>
          ) : route.kind === 'item' ? (
            <ItemWorkspace
              key={route.itemId}
              itemId={route.itemId}
              pageId={route.pageId}
              addPageNonce={addPageNonce}
              onSelectPage={(pageId) => setRoute({ kind: 'item', itemId: route.itemId, pageId })}
              onItemChanged={refreshWorkspace}
              onDeleted={() => {
                navigate({ kind: 'home' })
                refreshWorkspace()
                refreshTasks()
              }}
              onTasksChanged={refreshTasks}
            />
          ) : route.kind === 'space' ? (
            (() => {
              const owned = spaces.find((s) => s.id === route.spaceId)
              const shared = sharedSpaces.find((s) => s.id === route.spaceId)
              const space = owned ?? shared
              if (!space) return <p className="empty-state">That space is gone.</p>
              // Someone else's space: no renaming, sharing or deleting, and
              // view-only people can't add items either.
              const permission = owned ? 'owner' : (shared?.permission ?? 'view')
              return (
                <SpacePage
                  space={space}
                  permission={permission}
                  items={(owned ? items : sharedItems).filter((i) => i.space_id === space.id)}
                  tasks={tasks}
                  onOpenItem={(itemId) => navigate({ kind: 'item', itemId, pageId: null })}
                  onCreateItem={async (name) => {
                    const item = await handleCreateItem(space.id, name)
                    navigate({ kind: 'item', itemId: item.id, pageId: null })
                  }}
                  onUpdateSpace={async (name, icon) => {
                    await updateSpace(space.id, name, icon)
                    await refreshWorkspace()
                  }}
                  onDeleteSpace={async () => {
                    await deleteSpace(space.id)
                    navigate({ kind: 'home' })
                    await refreshWorkspace()
                    await refreshTasks()
                  }}
                />
              )
            })()
          ) : tasksLoading ? (
            <p className="empty-state">Loading...</p>
          ) : (
            <Home
              name={firstName}
              tasks={tasks}
              items={items}
              spaces={spaces}
              view={view}
              searchResults={searchResults}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onRenameTask={handleRenameTask}
              onChangePriority={handleChangePriority}
              onChangeDueDate={handleChangeDueDate}
              onArchiveTask={handleArchiveTask}
              onDeleteTask={handleDeleteTask}
              onOpenItem={(itemId) => navigate({ kind: 'item', itemId, pageId: null })}
            />
          )}
          </HeaderSlotContext.Provider>
        </main>
      </div>

      {session && (
        <nav className="bottom-nav" aria-label="Mobile">
          <button
            type="button"
            className={`bottom-nav__item${route.kind === 'home' && view === 'active' ? ' is-active' : ''}`}
            onClick={() => {
              setView('active')
              navigate({ kind: 'home' })
            }}
          >
            <HomeIcon size={20} />
            Home
          </button>
          <button
            type="button"
            className={`bottom-nav__item${route.kind === 'home' && view === 'archived' ? ' is-active' : ''}`}
            onClick={() => {
              setView('archived')
              navigate({ kind: 'home' })
            }}
          >
            <Archive size={20} />
            Archived
          </button>
          <button
            type="button"
            className="bottom-nav__item"
            onClick={() => {
              setSidebarMobileOpen(true)
              setOpenNewNonce((n) => n + 1)
            }}
          >
            <Plus size={20} />
            New
          </button>
          <button type="button" className={`bottom-nav__item${route.kind === 'space' || route.kind === 'item' ? ' is-active' : ''}`} onClick={() => setSidebarMobileOpen(true)}>
            <Menu size={20} />
            Spaces
          </button>
        </nav>
      )}
    </div>
  )
}

export default App
