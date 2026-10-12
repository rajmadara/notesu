-- Checklist pages.
--
-- A checklist item is a page entry with no day or time and a done flag, so a
-- Checklist and an Itinerary are the same element shown two ways -- one set of
-- endpoints behind both.
--
-- Deliberately NOT tasks: a checklist item has no due date, no priority and no
-- notes, and must never appear in the main task list.
ALTER TABLE page_entries ADD COLUMN IF NOT EXISTS done BOOLEAN NOT NULL DEFAULT false;
