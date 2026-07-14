import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SqliteTaskStore } from './store/SqliteTaskStore.js'
import { createTasksRouter } from './routes/tasks.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '../notesu.db')
const PORT = 3001

const store = new SqliteTaskStore(DB_PATH)

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api/tasks', createTasksRouter(store))

app.listen(PORT, () => {
  console.log(`Notesu API listening on http://localhost:${PORT}`)
})
