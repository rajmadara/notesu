-- Categories are stored inline on the task rather than in their own table:
-- the set of categories is simply the distinct values in use, and "recently
-- used" falls out of each category's newest task.
ALTER TABLE tasks ADD COLUMN category TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks (user_id, category);
