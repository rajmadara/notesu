-- Custom columns on a page.
--
-- A People page is really a small table: it ships with Name / Role / Contact /
-- About, and from here the user can add their own columns on top. The column
-- definitions live on the page (so every row shares them) and each row keeps
-- its own values in a JSON blob keyed by column id.
--
-- Both columns default to empty, so existing pages and rows need no backfill.

-- [{ id, name, type: 'text' | 'number' | 'select', description, options[] }]
ALTER TABLE pages ADD COLUMN IF NOT EXISTS columns JSONB NOT NULL DEFAULT '[]'::jsonb;

-- { "<column id>": "<value as text>" }. Numbers are stored as text too and
-- cast when read, so a column's type can change without rewriting rows.
ALTER TABLE people ADD COLUMN IF NOT EXISTS fields JSONB NOT NULL DEFAULT '{}'::jsonb;
