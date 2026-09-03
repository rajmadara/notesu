import { Router, type RequestHandler } from 'express'
import type { PageKind, SharePermission, TaskPriority, TaskStatus, TaskStore } from '../store/types.js'

// Express 4 doesn't catch rejected promises from async handlers on its own.
function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

const PAGE_KINDS: PageKind[] = ['overview', 'notes', 'checklist', 'itinerary', 'people']
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

export function createWorkspaceRouter(store: TaskStore): Router {
  const router = Router()

  // --- Spaces ---

  router.get(
    '/spaces',
    asyncHandler(async (req, res) => {
      res.json(await store.getSpaces(req.userId))
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

  router.delete(
    '/spaces/:id',
    asyncHandler(async (req, res) => {
      await store.deleteSpace(req.userId, id(req.params.id))
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

  router.put(
    '/tasks/:id',
    asyncHandler(async (req, res) => {
      const body = req.body ?? {}
      await store.updateItemTask(req.userId, id(req.params.id), {
        ...(typeof body.title === 'string' ? { title: name(body.title) } : {}),
        ...(STATUSES.includes(body.status) ? { status: body.status } : {}),
        ...(PRIORITIES.includes(body.priority) ? { priority: body.priority } : {}),
        ...('due_date' in body ? { due_date: dateOrNull(body.due_date) } : {}),
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
      const email = String(req.body?.email ?? '')
        .trim()
        .toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
