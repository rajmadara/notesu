import { Router, type RequestHandler } from 'express'
import type { TaskStore } from '../store/types.js'

// Express 4 doesn't catch rejected promises from async handlers on its own.
function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

export function createTagsRouter(store: TaskStore): Router {
  const router = Router()

  // Every tag the caller has used, for the task panel's dropdown.
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json(await store.getAllTags(req.userId))
    }),
  )

  router.get(
    '/favorites',
    asyncHandler(async (req, res) => {
      res.json(await store.getFavoriteTags(req.userId))
    }),
  )

  router.put(
    '/favorites/:name',
    asyncHandler(async (req, res) => {
      await store.addFavoriteTag(req.userId, req.params.name)
      res.status(204).end()
    }),
  )

  router.delete(
    '/favorites/:name',
    asyncHandler(async (req, res) => {
      await store.removeFavoriteTag(req.userId, req.params.name)
      res.status(204).end()
    }),
  )

  return router
}
