-- Archiving, as a state rather than a place.
--
-- Nothing ever moves. A task keeps its item_id forever; archiving only sets a
-- flag that hides it from the active lists. The Archived view reads the same
-- space -> item -> task structure the sidebar does.
--
-- Spaces and items get their own flag, and it is INHERITED, not copied: a task
-- is hidden when its own flag is set, or its item's, or its space's. So
-- archiving an item writes one row instead of a thousand, and unarchiving it
-- restores every task to exactly the state it was in -- the ones archived
-- individually stay archived.
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE items ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- When a task was completed, so "done for a week" is answerable. Backfilled
-- for tasks already done: their created_at is the best guess available, which
-- means long-finished tasks sweep on the next load rather than never.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS done_at BIGINT;

UPDATE tasks SET done_at = created_at
 WHERE status = 'done' AND done_at IS NULL AND archived = false;

CREATE INDEX IF NOT EXISTS tasks_sweep_idx ON tasks (user_id, done_at)
 WHERE status = 'done' AND archived = false;
