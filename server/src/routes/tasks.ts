import { Router } from 'express'
import type { TaskPriority, TaskStatus, TaskStore } from '../store/types.js'

export function createTasksRouter(store: TaskStore): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    res.json(store.getAllTasks())
  })

  router.post('/', (req, res) => {
    const title = String(req.body.title ?? '').trim()
    if (!title) {
      res.status(400).json({ error: 'title is required' })
      return
    }
    res.status(201).json(store.createTask(title))
  })

  router.delete('/:id', (req, res) => {
    store.deleteTask(Number(req.params.id))
    res.status(204).end()
  })

  router.put('/:id/status', (req, res) => {
    const status = req.body.status as TaskStatus
    store.setTaskStatus(Number(req.params.id), status)
    res.status(204).end()
  })

  router.put('/:id/priority', (req, res) => {
    const priority = req.body.priority as TaskPriority
    store.setTaskPriority(Number(req.params.id), priority)
    res.status(204).end()
  })

  router.put('/:id/tags', (req, res) => {
    const tags = String(req.body.tags ?? '')
    store.setTaskTags(Number(req.params.id), tags)
    res.status(204).end()
  })

  router.post('/:id/timer/start', (req, res) => {
    const startedAt = store.startTaskTimer(Number(req.params.id))
    res.json({ running_since: startedAt })
  })

  router.post('/:id/timer/stop', (req, res) => {
    store.stopTaskTimer(Number(req.params.id))
    res.status(204).end()
  })

  router.post('/:id/timer/reset', (req, res) => {
    store.resetTaskTimer(Number(req.params.id))
    res.status(204).end()
  })

  router.get('/:id/notes', (req, res) => {
    res.json(store.getNotesForTask(Number(req.params.id)))
  })

  router.put('/:id/notes', (req, res) => {
    const content = String(req.body.content ?? '')
    res.json(store.upsertTaskNote(Number(req.params.id), content))
  })

  return router
}
