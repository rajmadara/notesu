import { Router, type RequestHandler } from 'express'
import { normalizeTags } from '../tags.js'
import type {
  ColumnType,
  PageColumn,
  PageKind,
  SharePermission,
  TaskPriority,
  TaskStatus,
  TaskStore,
} from '../store/types.js'

// Express 4 doesn't catch rejected promises from async handlers on its own.
function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

const PAGE_KINDS: PageKind[] = ['overview', 'notes', 'tasks', 'itinerary', 'people']
const PERMISSIONS: SharePermission[] = ['view', 'edit']
const STATUSES: TaskStatus[] = ['not_started', 'in_progress', 'done']
const PRIORITIES: TaskPriority[] = [
  'urgent_important',
  'urgent_not_important',
  'important_not_urgent',
  'none',
]

function id(value: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`Invalid id: ${value}`)
  return parsed
}

function name(value: unknown): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) throw new Error('Name is required')
  return trimmed.slice(0, 200)
}

const str = (value: unknown, max = 2000) => (typeof value === 'string' ? value.slice(0, max) : '')

const COLUMN_TYPES: ColumnType[] = ['text', 'number', 'select']
const MAX_COLUMNS = 20
const MAX_OPTIONS = 30

/**
 * The user-defined columns on a page. Anything unrecognised is dropped rather
 * than stored, and a column without a usable name is skipped entirely — the
 * client generates the ids, so they're treated as opaque and length-capped.
 */
function columns(value: unknown): PageColumn[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: PageColumn[] = []
  for (const raw of value.slice(0, MAX_COLUMNS)) {
    if (typeof raw !== 'object' || raw === null) continue
    const col = raw as Record<string, unknown>
    const columnId = str(col.id, 40).trim()
    const columnName = str(col.name, 60).trim()
    if (!columnId || !columnName || seen.has(columnId)) continue
    seen.add(columnId)
    const type: ColumnType = COLUMN_TYPES.includes(col.type as ColumnType)
      ? (col.type as ColumnType)
      : 'text'
    out.push({
      id: columnId,
      name: columnName,
      type,
      description: str(col.description, 200),
      options:
        type === 'select' && Array.isArray(col.options)
          ? col.options
              .slice(0, MAX_OPTIONS)
              .map((o) => str(o, 60).trim())
              .filter(Boolean)
          : [],
    })
  }
  return out
}

/** A row's values for those columns. Everything is stored as text. */
function fields(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value).slice(0, MAX_COLUMNS)) {
    const columnId = key.slice(0, 40)
    if (!columnId) continue
    out[columnId] = typeof raw === 'number' ? String(raw) : str(raw, 500)
  }
  return out
}

/**
 * A space icon is either a short emoji string or a small inline image the
 * client already shrank to 64px. Anything else — a huge upload, a non-image
 * data URL — is dropped rather than stored.
 */
function icon(value: unknown): string {
  if (typeof value !== 'string') return ''
  if (value.startsWith('data:')) {
    const ok = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)
    return ok && value.length <= 24_000 ? value : ''
  }
  return value.slice(0, 8)
}

/** 'YYYY-MM-DD' or null; anything else is treated as "no date". */
function dateOrNull(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

/** Normalised share recipient, or null when it isn't a usable address. */
function shareEmail(value: unknown): string | null {
  const email = String(value ?? '')
    .trim()
    .toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

export function createWorkspaceRouter(store: TaskStore): Router {
  const router = Router()

  // --- Spaces ---

  router.get(
    '/spaces',
    asyncHandler(async (req, res) => {
      res.json(await store.getSpaces(req.userId))
    }),
  )

  router.get(
    '/spaces/shared',
    asyncHandler(async (req, res) => {
      res.json(await store.getSharedSpaces(req.userId))
    }),
  )

  router.post(
    '/spaces',
    asyncHandler(async (req, res) => {
      res.status(201).json(await store.createSpace(req.userId, name(req.body?.name), icon(req.body?.icon)))
    }),
  )

  router.put(
    '/spaces/:id',
    asyncHandler(async (req, res) => {
      await store.updateSpace(req.userId, id(req.params.id), name(req.body?.name), icon(req.body?.icon))
      res.status(204).end()
    }),
  )

  router.put(
    '/spaces/:id/archived',
    asyncHandler(async (req, res) => {
      await store.setSpaceArchived(req.userId, id(req.params.id), Boolean(req.body?.archived))
      res.status(204).end()
    }),
  )

  router.delete(
    '/spaces/:id',
    asyncHandler(async (req, res) => {
      await store.deleteSpace(req.userId, id(req.params.id))
      res.status(204).end()
    }),
  )

  router.get(
    '/spaces/:id/shares',
    asyncHandler(async (req, res) => {
      res.json(await store.getSpaceShares(req.userId, id(req.params.id)))
    }),
  )

  router.post(
    '/spaces/:id/shares',
    asyncHandler(async (req, res) => {
      const email = shareEmail(req.body?.email)
      if (!email) {
        res.status(400).json({ error: 'Enter a valid email address' })
        return
      }
      const permission: SharePermission = PERMISSIONS.includes(req.body?.permission)
        ? req.body.permission
        : 'view'
      res.status(201).json(await store.shareSpace(req.userId, id(req.params.id), email, permission))
    }),
  )

  router.delete(
    '/space-shares/:id',
    asyncHandler(async (req, res) => {
      await store.unshareSpace(req.userId, id(req.params.id))
      res.status(204).end()
    }),
  )

  // --- Items ---

  router.get(
    '/items',
    asyncHandler(async (req, res) => {
      res.json(await store.getItems(req.userId))
    }),
  )

  router.get(
    '/items/shared',
    asyncHandler(async (req, res) => {
      res.json(await store.getSharedItems(req.userId))
    }),
  )

  router.post(
    '/spaces/:id/items',
    asyncHandler(async (req, res) => {
      res.status(201).json(await store.createItem(req.userId, id(req.params.id), name(req.body?.name)))
    }),
  )

  router.get(
    '/items/:id',
    asyncHandler(async (req, res) => {
      const detail = await store.getItemDetail(req.userId, id(req.params.id))
      if (!detail) {
        res.status(404).json({ error: 'Item not found' })
        return
      }
      res.json(detail)
    }),
  )

  router.get(
    '/items/:id/read',
    asyncHandler(async (req, res) => {
      const view = await store.getItemReadView(req.userId, id(req.params.id))
      if (!view) {
        res.status(404).json({ error: 'Item not found' })
        return
      }
      res.json(view)
    }),
  )

  router.put(
    '/items/:id',
    asyncHandler(async (req, res) => {
      const body = req.body ?? {}
      await store.updateItem(req.userId, id(req.params.id), {
        ...(typeof body.name === 'string' ? { name: name(body.name) } : {}),
        ...(typeof body.icon === 'string' ? { icon: icon(body.icon) } : {}),
        ...('date' in body ? { date: dateOrNull(body.date) } : {}),
        ...(typeof body.location === 'string' ? { location: str(body.location, 300) } : {}),
        ...(typeof body.description === 'string' ? { description: str(body.description, 5000) } : {}),
      })
      res.status(204).end()
    }),
  )

  router.put(
    '/items/:id/archived',
    asyncHandler(async (req, res) => {
      await store.setItemArchived(req.userId, id(req.params.id), Boolean(req.body?.archived))
      res.status(204).end()
    }),
  )

  router.delete(
    '/items/:id',
    asyncHandler(async (req, res) => {
      await store.deleteItem(req.userId, id(req.params.id))
      res.status(204).end()
    }),
  )

  // --- Pages ---

  router.post(
    '/items/:id/pages',
    asyncHandler(async (req, res) => {
      const kind: PageKind = PAGE_KINDS.includes(req.body?.kind) ? req.body.kind : 'notes'
      res.status(201).json(await store.createPage(req.userId, id(req.params.id), name(req.body?.name), kind))
    }),
  )

  router.put(
    '/pages/:id/name',
    asyncHandler(async (req, res) => {
      await store.renamePage(req.userId, id(req.params.id), name(req.body?.name))
      res.status(204).end()
    }),
  )

  router.put(
    '/pages/:id/content',
    asyncHandler(async (req, res) => {
      await store.setPageContent(req.userId, id(req.params.id), str(req.body?.content, 200_000))
      res.status(204).end()
    }),
  )

  router.put(
    '/pages/:id/columns',
    asyncHandler(async (req, res) => {
      await store.setPageColumns(req.userId, id(req.params.id), columns(req.body?.columns))
      res.status(204).end()
    }),
  )

  router.delete(
    '/pages/:id',
    asyncHandler(async (req, res) => {
      await store.deletePage(req.userId, id(req.params.id))
      res.status(204).end()
    }),
  )

  // --- Tasks inside an item ---

  router.get(
    '/items/:id/tasks',
    asyncHandler(async (req, res) => {
      res.json(await store.getItemTasks(req.userId, id(req.params.id)))
    }),
  )

  router.post(
    '/pages/:id/tasks',
    asyncHandler(async (req, res) => {
      res
        .status(201)
        .json(
          await store.createPageTask(
            req.userId,
            id(req.params.id),
            name(req.body?.title),
            dateOrNull(req.body?.due_date),
          ),
        )
    }),
  )

  router.get(
    '/tasks/:id/notes',
    asyncHandler(async (req, res) => {
      res.json(await store.getItemTaskNotes(req.userId, id(req.params.id)))
    }),
  )

  router.put(
    '/tasks/:id/notes',
    asyncHandler(async (req, res) => {
      const content = str(req.body?.content, 200_000)
      res.json(await store.upsertItemTaskNote(req.userId, id(req.params.id), content))
    }),
  )

  router.put(
    '/tasks/:id',
    asyncHandler(async (req, res) => {
      const body = req.body ?? {}
      await store.updateItemTask(req.userId, id(req.params.id), {
        ...(typeof body.title === 'string' ? { title: name(body.title) } : {}),
        ...(STATUSES.includes(body.status) ? { status: body.status } : {}),
        ...(PRIORITIES.includes(body.priority) ? { priority: body.priority } : {}),
        ...('due_date' in body ? { due_date: dateOrNull(body.due_date) } : {}),
        ...('tags' in body ? { tags: normalizeTags(body.tags) } : {}),
      })
      res.status(204).end()
    }),
  )

  router.delete(
    '/tasks/:id',
    asyncHandler(async (req, res) => {
      await store.deleteItemTask(req.userId, id(req.params.id))
      res.status(204).end()
    }),
  )

  // --- Itinerary entries ---

  router.get(
    '/pages/:id/entries',
    asyncHandler(async (req, res) => {
      res.json(await store.getPageEntries(req.userId, id(req.params.id)))
    }),
  )

  router.post(
    '/pages/:id/entries',
    asyncHandler(async (req, res) => {
      const body = req.body ?? {}
      res.status(201).json(
        await store.createPageEntry(req.userId, id(req.params.id), {
          day: dateOrNull(body.day),
          time: str(body.time, 10),
          title: name(body.title),
          note: str(body.note, 2000),
        }),
      )
    }),
  )

  router.put(
    '/entries/:id',
    asyncHandler(async (req, res) => {
      const body = req.body ?? {}
      await store.updatePageEntry(req.userId, id(req.params.id), {
        ...('day' in body ? { day: dateOrNull(body.day) } : {}),
        ...(typeof body.time === 'string' ? { time: str(body.time, 10) } : {}),
        ...(typeof body.title === 'string' ? { title: name(body.title) } : {}),
        ...(typeof body.note === 'string' ? { note: str(body.note, 2000) } : {}),
      })
      res.status(204).end()
    }),
  )

  router.delete(
    '/entries/:id',
    asyncHandler(async (req, res) => {
      await store.deletePageEntry(req.userId, id(req.params.id))
      res.status(204).end()
    }),
  )

  // --- People ---

  router.get(
    '/pages/:id/people',
    asyncHandler(async (req, res) => {
      res.json(await store.getPeople(req.userId, id(req.params.id)))
    }),
  )

  router.post(
    '/pages/:id/people',
    asyncHandler(async (req, res) => {
      const body = req.body ?? {}
      res.status(201).json(
        await store.createPerson(req.userId, id(req.params.id), {
          name: name(body.name),
          role: str(body.role, 200),
          contact: str(body.contact, 300),
          note: str(body.note, 2000),
          fields: fields(body.fields),
        }),
      )
    }),
  )

  router.put(
    '/people/:id',
    asyncHandler(async (req, res) => {
      const body = req.body ?? {}
      await store.updatePerson(req.userId, id(req.params.id), {
        ...(typeof body.name === 'string' ? { name: name(body.name) } : {}),
        ...(typeof body.role === 'string' ? { role: str(body.role, 200) } : {}),
        ...(typeof body.contact === 'string' ? { contact: str(body.contact, 300) } : {}),
        ...(typeof body.note === 'string' ? { note: str(body.note, 2000) } : {}),
        ...('fields' in body ? { fields: fields(body.fields) } : {}),
      })
      res.status(204).end()
    }),
  )

  router.delete(
    '/people/:id',
    asyncHandler(async (req, res) => {
      await store.deletePerson(req.userId, id(req.params.id))
      res.status(204).end()
    }),
  )

  // --- Sharing ---

  router.get(
    '/items/:id/shares',
    asyncHandler(async (req, res) => {
      res.json(await store.getItemShares(req.userId, id(req.params.id)))
    }),
  )

  router.post(
    '/items/:id/shares',
    asyncHandler(async (req, res) => {
      const email = shareEmail(req.body?.email)
      if (!email) {
        res.status(400).json({ error: 'Enter a valid email address' })
        return
      }
      const permission: SharePermission = PERMISSIONS.includes(req.body?.permission)
        ? req.body.permission
        : 'view'
      res.status(201).json(await store.shareItem(req.userId, id(req.params.id), email, permission))
    }),
  )

  router.delete(
    '/shares/:id',
    asyncHandler(async (req, res) => {
      await store.unshareItem(req.userId, id(req.params.id))
      res.status(204).end()
    }),
  )

  return router
}
