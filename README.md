# Notesu

A personal daily task manager — checklist, per-task timers, and notes — built as a learning project for a standard full-stack web app architecture.

## Stack

```
React + TypeScript (frontend, Vite)
        ↓ REST API (fetch)
Express + TypeScript (backend, Node.js)
        ↓ TaskStore interface
Node's built-in SQLite (server/Notesu.db — a real file on disk)
```

- **Frontend**: React 19 + TypeScript, bundled with Vite
- **Backend**: Node.js + Express, also TypeScript
- **Database**: SQLite, accessed via Node's built-in `node:sqlite` module (no native compilation required — no `better-sqlite3`, no C++ build tools needed)
- **Storage is swappable**: the backend talks to the database only through a `TaskStore` interface ([server/src/store/types.ts](server/src/store/types.ts)). Today's implementation (`SqliteTaskStore`) reads/writes a local file. A future cloud-backed implementation (e.g. Postgres/Supabase) can be dropped in behind the same interface without touching the API routes or the frontend.

All data currently lives locally on this machine, in `server/Notesu.db`. Nothing is sent to the cloud.

## Running it locally

Two things need to run together: the Vite dev server (frontend) and the Express API (backend). One command starts both:

```bash
npm install
npm --prefix server install
npm run dev
```

Then open the URL Vite prints (typically `http://localhost:5173`). The API listens on `http://localhost:3001`.

## Project layout

```
Notesu/
├── src/                        Frontend (React + TypeScript)
│   ├── App.tsx                 Page shell
│   ├── features/dailyTasks/    Task list UI, per-task timer, notes panel
│   └── lib/
│       ├── types.ts            Task/Note types shared by the UI
│       └── db.ts               Thin fetch() client for the backend API
│
├── server/                     Backend (Express + TypeScript)
│   ├── migrations/             SQL schema migrations, applied automatically on startup
│   └── src/
│       ├── index.ts            Express app entry point
│       ├── routes/tasks.ts     REST endpoints
│       └── store/
│           ├── types.ts        TaskStore interface (the local/cloud swap point)
│           └── SqliteTaskStore.ts   Local SQLite implementation
│
└── Notesu.db (generated)       The actual database file, created on first run
```

## Current features (v1)

**Daily Tasks**
- Add tasks to a single running list
- Cycle status: Not Started → In Progress → Done
- Set priority (Low / Medium / High) per task
- Free-text tags per task (comma-separated), stored for future filtering
- Per-task timer — Start/Pause, survives page reloads and server restarts (it's a real DB row, not browser state)
- Expandable notes per task, showing when the task was created and when the note was last edited
- Delete tasks

## Database schema

```sql
tasks (
  id, title, status, seconds, running_since,
  date, created_at, priority, tags
)

notes (
  id, task_id, content, date, created_at, updated_at
)

habits (
  id, name, target_frequency, created_at
)

habit_entries (
  id, habit_id, date, completed
)
```

Migrations live in [server/migrations/](server/migrations/) and are applied automatically, tracked in a `_migrations` table so each one runs exactly once.

## Roadmap / designed but not built

- **Local ↔ cloud storage switch** — the `TaskStore` interface exists for this; needs a second implementation (e.g. Postgres) and a config flag to choose between them
- **Standalone Notes** and **Habit Tracker** — schema already supports both, no UI yet
- **Weather widget** — deferred
- **Sharing with friends / multi-user accounts** — deferred; would need auth and real hosting
- **AI assistant over notes** (v2 idea) — summarize notes / answer questions via an LLM API; the notes schema and query layer were kept flexible with this in mind
