import express, { type ErrorRequestHandler } from 'express'
import cors from 'cors'
import { loadEnv } from './env.js'
import { createAuthMiddleware } from './auth.js'
import { StoreError } from './store/errors.js'
import { createPostgresTaskStore } from './store/PostgresTaskStore.js'
import { createTasksRouter } from './routes/tasks.js'
import { createTagsRouter } from './routes/tags.js'
import { createWorkspaceRouter } from './routes/workspace.js'
import { createAiRouter } from './routes/ai.js'

loadEnv()

const PORT = process.env.PORT ?? 3001

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Add it to server/.env (see server/.env.example).')
}

const store = await createPostgresTaskStore(process.env.DATABASE_URL)

const app = express()
// CORS_ORIGIN is a comma-separated allowlist (set on the host once the
// frontend's real domain is known). Unset -> allow all, for local dev.
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true }))
app.use(express.json())
const requireAuth = createAuthMiddleware()
app.use('/api/tasks', requireAuth, createTasksRouter(store))
app.use('/api/tags', requireAuth, createTagsRouter(store))
app.use('/api/workspace', requireAuth, createWorkspaceRouter(store))
app.use('/api/ai', createAiRouter())

// The store signals "not yours" / "not found" / "view only" as StoreErrors so
// the client gets a real status instead of a 500 for a permissions miss.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof StoreError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Something went wrong' })
}
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Notesu API listening on http://localhost:${PORT}`)
})
