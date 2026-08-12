import { Router, type RequestHandler } from 'express'
import type { TaskPriority, TaskStatus, TaskStore } from '../store/types.js'

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
      res.json(await store.getAllTasks(req.userId))
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
      const category = String(req.body.category ?? '').trim()
      res.status(201).json(await store.createTask(req.userId, title, category))
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
    '/:id/tags',
    asyncHandler(async (req, res) => {
      const tags = String(req.body.tags ?? '')
      await store.setTaskTags(req.userId, Number(req.params.id), tags)
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
