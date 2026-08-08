CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'done')),
    seconds INTEGER NOT NULL DEFAULT 0,
    running_since BIGINT,
    date TEXT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint,
    priority TEXT NOT NULL DEFAULT 'default',
    tags TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks (date);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id INTEGER REFERENCES tasks (id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint,
    updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint
);

CREATE INDEX IF NOT EXISTS idx_notes_date ON notes (date);
CREATE INDEX IF NOT EXISTS idx_notes_task_id ON notes (task_id);
