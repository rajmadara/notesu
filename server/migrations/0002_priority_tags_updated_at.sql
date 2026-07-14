ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE tasks ADD COLUMN tags TEXT NOT NULL DEFAULT '';
ALTER TABLE notes ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
UPDATE notes SET updated_at = created_at WHERE updated_at = 0;
