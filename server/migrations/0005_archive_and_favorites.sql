ALTER TABLE tasks ADD COLUMN archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tasks_user_archived ON tasks (user_id, archived);

-- Which tags a user has starred is standalone preference, not implied by
-- any task, so unlike tags themselves this needs a real table.
CREATE TABLE IF NOT EXISTS favorite_tags (
    user_id uuid NOT NULL REFERENCES auth.users (id),
    name TEXT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint,
    PRIMARY KEY (user_id, name)
);

ALTER TABLE favorite_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY favorite_tags_owner ON favorite_tags
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
