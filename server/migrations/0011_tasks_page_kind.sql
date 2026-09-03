-- The Checklist page was a weaker duplicate of the Tasks mechanism: no
-- priority, no notes, no detail panel. It becomes a real Tasks page backed by
-- the same rows and the same components as the main Tasks section.
--
-- The underlying data doesn't move — these pages already own their tasks via
-- tasks.page_id. Only the page's kind (and its default name) changes.

UPDATE pages SET kind = 'tasks', name = 'Tasks'
 WHERE kind = 'checklist' AND name = 'Checklist';

-- A page someone renamed keeps its name; only the kind changes.
UPDATE pages SET kind = 'tasks' WHERE kind = 'checklist';
