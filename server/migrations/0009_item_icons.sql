-- Items get an icon of their own, same shape as a space's: either a short
-- emoji string or a small inline image the client already shrank. Empty means
-- "use the default glyph", so existing rows need no backfill.
ALTER TABLE items ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT '';
