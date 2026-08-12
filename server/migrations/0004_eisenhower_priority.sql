-- Priority moves from a colour scale (default/amber/red) to Eisenhower
-- quadrants. Existing rows are mapped by how pressing the old colour was:
-- red was the top of the scale, amber the middle, default the absence of one.
UPDATE tasks SET priority = CASE priority
  WHEN 'red' THEN 'urgent_important'
  WHEN 'amber' THEN 'important_not_urgent'
  WHEN 'default' THEN 'none'
  ELSE priority
END;

ALTER TABLE tasks ALTER COLUMN priority SET DEFAULT 'none';
