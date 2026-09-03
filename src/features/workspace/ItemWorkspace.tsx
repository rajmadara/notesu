import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Ellipsis, FileText, ListChecks, Pencil, Plus, Route, Share2, Trash2, Users, X } from 'lucide-react'
import type { ItemDetail, ItemReadView, Page, PageKind, Task } from '../../lib/types'
import {
  createPage,
  deleteItem,
  deletePage,
  getItemDetail,
  getItemReadView,
  getItemTasks,
  renamePage,
  updateItem,
  updateItemTask,
  type ItemPatch,
} from '../../lib/workspace'
import { ReadView } from './ReadView'
import { OverviewPage } from './pages/OverviewPage'
import { NotesPage } from './pages/NotesPage'
import { TasksPage } from './pages/TasksPage'
import { ItineraryPage } from './pages/ItineraryPage'
import { PeoplePage } from './pages/PeoplePage'
import { ShareDialog } from './ShareDialog'
import { EntityIcon } from './EntityIcon'
import { IconPicker } from './IconPicker'
import { HeaderTitle } from '../shell/HeaderSlot'
import { DEFAULT_ITEM_ICON } from '../../lib/icons'

// The page kinds a user can add. Overview isn't here — every item has exactly
// one, made with the item. Gallery / Schedule / Table are next in line.
const PAGE_KINDS: { kind: PageKind; label: string; hint: string; icon: typeof FileText }[] = [
  { kind: 'notes', label: 'Notes', hint: 'Free-form writing', icon: FileText },
  { kind: 'tasks', label: 'Tasks', hint: 'A task list, like the main one', icon: ListChecks },
  { kind: 'itinerary', label: 'Itinerary', hint: 'Day-by-day plan', icon: Route },
  { kind: 'people', label: 'People', hint: 'Who is involved', icon: Users },
]

interface Props {
  itemId: number
  pageId: number | null
  /** Bumped by "+ New → Page" so the add-page form opens on arrival. */
  addPageNonce: number
  onSelectPage: (pageId: number | null) => void
  onItemChanged: () => void
  onDeleted: () => void
  onTasksChanged: () => void
}

/**
 * One item, opened. The primary sidebar stays put; this supplies the second
 * level of navigation — the item's pages as tabs — and renders the chosen one.
 */
export function ItemWorkspace({
  itemId,
  pageId,
  addPageNonce,
  onSelectPage,
  onItemChanged,
  onDeleted,
  onTasksChanged,
}: Props) {
  const [detail, setDetail] = useState<ItemDetail | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  // View-only collaborators always get the reader; owners and editors can
  // switch into it to see exactly what those collaborators see.
  const [reading, setReading] = useState(false)
  const [readView, setReadView] = useState<ItemReadView | null>(null)
  const [adding, setAdding] = useState(false)
  const [newKind, setNewKind] = useState<PageKind>('notes')
  const [newName, setNewName] = useState('')
  const [sharing, setSharing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickingIcon, setPickingIcon] = useState(false)
  const [renamingPage, setRenamingPage] = useState<number | null>(null)

  const load = useCallback(async () => {
    const [next, nextTasks] = await Promise.all([
      getItemDetail(itemId).catch(() => null),
      getItemTasks(itemId).catch(() => []),
    ])
    setDetail(next)
    setTasks(nextTasks)
    setLoading(false)
  }, [itemId])

  useEffect(() => {
    setLoading(true)
    setReading(false)
    load()
  }, [load])

  // The reader needs entries and people that the editing pages fetch lazily,
  // so it comes from its own endpoint — refetched whenever it's opened.
  const showReader = detail?.access === 'view' || reading
  useEffect(() => {
    if (!showReader) return
    let cancelled = false
    getItemReadView(itemId)
      .then((v) => !cancelled && setReadView(v))
      .catch(() => !cancelled && setReadView(null))
    return () => {
      cancelled = true
    }
  }, [showReader, itemId, tasks, detail])

  useEffect(() => {
    if (addPageNonce > 0) {
      setAdding(true)
      setNewName('')
    }
  }, [addPageNonce])

  const refreshTasks = useCallback(async () => {
    setTasks(await getItemTasks(itemId).catch(() => []))
    onTasksChanged()
  }, [itemId, onTasksChanged])

  if (loading) return <p className="empty-state">Loading...</p>
  if (!detail) return <p className="empty-state">This item isn't available. It may have been deleted or unshared.</p>

  const { item, pages, access, owner_name } = detail
  const readOnly = access === 'view'
  const shared = access !== 'owner'
  const overview = pages.find((p) => p.kind === 'overview')
  const current = (pageId !== null && pages.find((p) => p.id === pageId)) || overview || pages[0]

  async function patchItem(patch: ItemPatch) {
    setDetail((d) => (d ? { ...d, item: { ...d.item, ...patch } } : d))
    await updateItem(item.id, patch).catch(load)
    onItemChanged()
  }

  async function addPage(e: React.FormEvent) {
    e.preventDefault()
    const kind = PAGE_KINDS.find((k) => k.kind === newKind)!
    const name = newName.trim() || kind.label
    const page = await createPage(item.id, name, newKind).catch(() => null)
    setAdding(false)
    setNewName('')
    if (!page) return
    await load()
    onSelectPage(page.id)
  }

  async function removePage(page: Page) {
    if (!confirm(`Remove the “${page.name}” page?`)) return
    await deletePage(page.id).catch(() => null)
    if (current?.id === page.id) onSelectPage(null)
    await load()
  }

  async function rename(page: Page, next: string) {
    setRenamingPage(null)
    const trimmed = next.trim()
    if (!trimmed || trimmed === page.name) return
    await renamePage(page.id, trimmed).catch(() => null)
    await load()
  }

  async function toggleTask(task: Task) {
    await updateItemTask(task.id, { status: task.status === 'done' ? 'not_started' : 'done' }).catch(() => null)
    await refreshTasks()
  }

  return (
    <div className="workspace">
      <HeaderTitle>
        {/* Just the item's icon and name — the sidebar already shows which
            space it sits in, so repeating it here was redundant. */}
        <div className="menu-anchor">
          <button
            type="button"
            className="header-icon-btn"
            onClick={() => !readOnly && setPickingIcon((v) => !v)}
            disabled={readOnly}
            aria-label="Change icon"
            title={readOnly ? undefined : 'Change icon'}
            aria-expanded={pickingIcon}
          >
            <EntityIcon icon={item.icon} fallback={DEFAULT_ITEM_ICON} size={22} />
          </button>
          {pickingIcon && (
            <IconPicker
              value={item.icon}
              defaultIcon={DEFAULT_ITEM_ICON}
              onChange={(icon) => patchItem({ icon })}
              onClose={() => setPickingIcon(false)}
            />
          )}
        </div>
        <input
          key={item.id}
          className="header-title header-title--input"
          defaultValue={item.name}
          readOnly={readOnly}
          onBlur={(e) => {
            const next = e.target.value.trim()
            if (next && next !== item.name) patchItem({ name: next })
            else e.target.value = item.name
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          aria-label="Item name"
        />

        <div className="workspace__actions">
          {shared ? (
            <span className="workspace__shared-by">
              Shared by {owner_name} · {readOnly ? 'can view' : 'can edit'}
            </span>
          ) : (
            <>
              <button
                type="button"
                className={`btn btn--ghost btn--sm${reading ? ' is-active' : ''}`}
                onClick={() => setReading((v) => !v)}
                title={reading ? 'Back to editing' : 'See what view-only people see'}
                aria-pressed={reading}
              >
                {reading ? <Pencil size={14} /> : <BookOpen size={14} />}
                <span className="workspace__share-label">{reading ? 'Edit' : 'Reader'}</span>
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSharing(true)}>
                <Share2 size={14} /> <span className="workspace__share-label">Share</span>
              </button>
              <div className="menu-anchor">
                <button type="button" className="icon-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Item options" aria-expanded={menuOpen}>
                  <Ellipsis size={16} />
                </button>
                {menuOpen && (
                  <div className="menu" onMouseLeave={() => setMenuOpen(false)}>
                    <button
                      type="button"
                      className="menu__item menu__item--danger"
                      onClick={() => {
                        setMenuOpen(false)
                        if (!confirm(`Delete “${item.name}” and all of its pages?`)) return
                        deleteItem(item.id).then(onDeleted).catch(load)
                      }}
                    >
                      <Trash2 size={14} /> Delete item
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </HeaderTitle>

      {showReader ? (
        readView ? (
          <ReadView view={readView} />
        ) : (
          <p className="empty-state">Loading...</p>
        )
      ) : (
        <>
      <nav className="tabs" aria-label="Pages">
        {pages.map((page) => {
          const active = page.id === current?.id
          const Icon = page.kind === 'overview' ? null : PAGE_KINDS.find((k) => k.kind === page.kind)?.icon ?? FileText
          return renamingPage === page.id ? (
            <input
              key={page.id}
              className="tab tab--input"
              defaultValue={page.name}
              autoFocus
              onBlur={(e) => rename(page, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') setRenamingPage(null)
              }}
              aria-label="Page name"
            />
          ) : (
            <button
              key={page.id}
              type="button"
              className={`tab${active ? ' is-active' : ''}`}
              onClick={() => onSelectPage(page.kind === 'overview' ? null : page.id)}
              onDoubleClick={() => !readOnly && page.kind !== 'overview' && setRenamingPage(page.id)}
              title={page.kind !== 'overview' && !readOnly ? 'Double-click to rename' : undefined}
            >
              {Icon && <Icon size={14} />}
              {page.name}
              {active && !readOnly && page.kind !== 'overview' && (
                <span
                  role="button"
                  tabIndex={0}
                  className="tab__remove"
                  onClick={(e) => {
                    e.stopPropagation()
                    removePage(page)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation()
                      removePage(page)
                    }
                  }}
                  aria-label={`Remove ${page.name}`}
                >
                  <X size={12} />
                </span>
              )}
            </button>
          )
        })}
        {!readOnly && !adding && (
          <button type="button" className="tab tab--add" onClick={() => setAdding(true)}>
            <Plus size={14} /> Add page
          </button>
        )}
      </nav>

      {adding && (
        <form className="add-page" onSubmit={addPage}>
          <div className="add-page__kinds">
            {PAGE_KINDS.map(({ kind, label, hint, icon: Icon }) => (
              <button
                key={kind}
                type="button"
                className={`kind-chip${newKind === kind ? ' is-active' : ''}`}
                onClick={() => setNewKind(kind)}
                title={hint}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          <div className="add-page__row">
            <input
              className="input"
              placeholder={`${PAGE_KINDS.find((k) => k.kind === newKind)?.label} (page name)`}
              value={newName}
              autoFocus
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setAdding(false)
              }}
            />
            <button type="submit" className="btn btn--primary btn--sm">
              Add
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="workspace__body">
        {current?.kind === 'overview' && (
          <OverviewPage
            detail={detail}
            tasks={tasks}
            readOnly={readOnly}
            onPatchItem={patchItem}
            onOpenPage={onSelectPage}
            onToggleTask={toggleTask}
          />
        )}
        {current?.kind === 'notes' && (
          <NotesPage
            key={current.id}
            page={current}
            readOnly={readOnly}
            onSaved={(content) =>
              setDetail((d) => (d ? { ...d, pages: d.pages.map((p) => (p.id === current.id ? { ...p, content } : p)) } : d))
            }
          />
        )}
        {current?.kind === 'tasks' && (
          <TasksPage
            key={current.id}
            page={current}
            tasks={tasks.filter((t) => t.page_id === current.id)}
            readOnly={readOnly}
            onChanged={refreshTasks}
          />
        )}
        {current?.kind === 'itinerary' && <ItineraryPage key={current.id} page={current} readOnly={readOnly} />}
        {current?.kind === 'people' && <PeoplePage key={current.id} page={current} readOnly={readOnly} />}
      </div>
        </>
      )}

      {sharing && (
        <ShareDialog
          kind="item"
          id={item.id}
          name={item.name}
          onClose={() => setSharing(false)}
          onChanged={onItemChanged}
        />
      )}
    </div>
  )
}
