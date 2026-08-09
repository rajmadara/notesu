ALTER TABLE tasks ADD COLUMN user_id uuid REFERENCES auth.users (id);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks (user_id);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_owner ON tasks
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY notes_owner ON notes
  USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = notes.task_id AND tasks.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = notes.task_id AND tasks.user_id = auth.uid()));
