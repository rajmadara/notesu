import { Router, type RequestHandler } from 'express'
import type { TaskPriority, TaskStatus, TaskStore } from '../store/types.js'
import { normalizeTags } from '../tags.js'

// Express 4 doesn't catch rejected promises from async handlers on its own.
function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

export function createTasksRouter(store: TaskStore): Router {
  const router = Router()

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      // Sweep before reading, so the list the client gets is already settled.
      // Cheap: one indexed UPDATE that usually matches nothing.
      await store.sweepArchive(req.userId)
      res.json(await store.getAllTasks(req.userId))
    }),
  )

  router.get(
    '/search',
    asyncHandler(async (req, res) => {
      const query = String(req.query.q ?? '').trim()
      if (!query) {
        res.json([])
        return
      }
      res.json(await store.searchTasks(req.userId, query))
    }),
  )

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const title = String(req.body.title ?? '').trim()
      if (!title) {
        res.status(400).json({ error: 'title is required' })
        return
      }
      const dueDate = req.body.due_date
      const itemId = Number(req.body.item_id)
      res.status(201).json(
        await store.createTask(req.userId, title, {
          due_date:
            typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
          // The store checks the caller may actually write to this item.
          item_id: Number.isInteger(itemId) && itemId > 0 ? itemId : null,
        }),
      )
    }),
  )

  router.put(
    '/:id/due-date',
    asyncHandler(async (req, res) => {
      const value = req.body.due_date
      const dueDate =
        typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
      await store.setTaskDueDate(req.userId, Number(req.params.id), dueDate)
      res.status(204).end()
    }),
  )

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      await store.deleteTask(req.userId, Number(req.params.id))
      res.status(204).end()
    }),
  )

  router.put(
    '/:id/title',
    asyncHandler(async (req, res) => {
      const title = String(req.body.title ?? '').trim()
      if (!title) {
        res.status(400).json({ error: 'title is required' })
        return
      }
      await store.setTaskTitle(req.userId, Number(req.params.id), title)
      res.status(204).end()
    }),
  )

  router.put(
    '/:id/status',
    asyncHandler(async (req, res) => {
      const status = req.body.status as TaskStatus
      await store.setTaskStatus(req.userId, Number(req.params.id), status)
      res.status(204).end()
    }),
  )

  router.put(
    '/:id/priority',
    asyncHandler(async (req, res) => {
      const priority = req.body.priority as TaskPriority
      await store.setTaskPriority(req.userId, Number(req.params.id), priority)
      res.status(204).end()
    }),
  )

  router.put(
    '/:id/category',
    asyncHandler(async (req, res) => {
      const category = String(req.body.category ?? '').trim()
      await store.setTaskCategory(req.userId, Number(req.params.id), category)
      res.status(204).end()
    }),
  )

  router.put(
    '/:id/archive',
    asyncHandler(async (req, res) => {
      const archived = Boolean(req.body.archived)
      await store.setTaskArchived(req.userId, Number(req.params.id), archived)
      res.status(204).end()
    }),
  )

  router.put(
    '/:id/tags',
    asyncHandler(async (req, res) => {
      await store.setTaskTags(req.userId, Number(req.params.id), normalizeTags(req.body.tags))
      res.status(204).end()
    }),
  )

  router.post(
    '/:id/timer/start',
    asyncHandler(async (req, res) => {
      const startedAt = await store.startTaskTimer(req.userId, Number(req.params.id))
      res.json({ running_since: startedAt })
    }),
  )

  router.post(
    '/:id/timer/stop',
    asyncHandler(async (req, res) => {
      await store.stopTaskTimer(req.userId, Number(req.params.id))
      res.status(204).end()
    }),
  )

  router.post(
    '/:id/timer/reset',
    asyncHandler(async (req, res) => {
      await store.resetTaskTimer(req.userId, Number(req.params.id))
      res.status(204).end()
    }),
  )

  router.get(
    '/:id/notes',
    asyncHandler(async (req, res) => {
      res.json(await store.getNotesForTask(req.userId, Number(req.params.id)))
    }),
  )

  router.put(
    '/:id/notes',
    asyncHandler(async (req, res) => {
      const content = String(req.body.content ?? '')
      res.json(await store.upsertTaskNote(req.userId, Number(req.params.id), content))
    }),
  )

  return router
}
