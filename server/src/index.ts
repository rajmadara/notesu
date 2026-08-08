import express from 'express'
import cors from 'cors'
import { loadEnv } from './env.js'
import { createPostgresTaskStore } from './store/PostgresTaskStore.js'
import { createTasksRouter } from './routes/tasks.js'
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
app.use('/api/tasks', createTasksRouter(store))
app.use('/api/ai', createAiRouter())

app.listen(PORT, () => {
  console.log(`Notesu API listening on http://localhost:${PORT}`)
})
