-- Restructure the workspace around Space -> Item -> Pages.
--
--   Space  = an area of life (Events, Career, Travel ...), user-created.
--   Item   = one thing inside a space (My Event, Scrum Certification).
--   Page   = information belonging to an item (Overview, Checklist, Notes ...).
--
-- The previous model (two fixed spaces holding kanban "boards") is retired.
-- The existing boards were named Events / Travel / Career and held no cards,
-- so they are promoted straight into spaces; the two seeded spaces and the
-- empty kanban tables are dropped.

-- 1. Spaces become life areas. The old personal/shared kind is meaningless
--    now that sharing happens per item, so it's dropped.
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT '';

INSERT INTO spaces (user_id, name, kind, position, created_at)
SELECT b.user_id, b.name, 'personal', b.position, b.created_at
FROM boards b;

DELETE FROM spaces WHERE name IN ('My Notes', 'Shared Notes');

DROP TABLE IF EXISTS cards;
DROP TABLE IF EXISTS board_columns;
DROP TABLE IF EXISTS boards;

ALTER TABLE spaces DROP COLUMN IF EXISTS kind;

-- 2. Items. date / location / description feed the item's Overview page.
CREATE TABLE IF NOT EXISTS items (
    id BIGSERIAL PRIMARY KEY,
    space_id BIGINT NOT NULL REFERENCES spaces (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users (id),
    name TEXT NOT NULL,
    date TEXT,
    location TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    position INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint
);

-- 3. Pages. kind picks the editor: overview | notes | checklist | itinerary |
--    people. content holds rich text for notes pages; other kinds keep their
--    rows in the tables below.
CREATE TABLE IF NOT EXISTS pages (
    id BIGSERIAL PRIMARY KEY,
    item_id BIGINT NOT NULL REFERENCES items (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users (id),
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'notes',
    content TEXT NOT NULL DEFAULT '',
    position INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint
);

-- Itinerary rows: a day (YYYY-MM-DD, or null for undated) and a time.
CREATE TABLE IF NOT EXISTS page_entries (
    id BIGSERIAL PRIMARY KEY,
    page_id BIGINT NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users (id),
    day TEXT,
    time TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    position INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint
);

CREATE TABLE IF NOT EXISTS people (
    id BIGSERIAL PRIMARY KEY,
    page_id BIGINT NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users (id),
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    contact TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    position INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint
);

-- 4. Sharing is per item, keyed by the recipient's email so an item can be
--    shared before the other person has ever signed in. The item is never
--    copied: the recipient reads the owner's rows through this table.
CREATE TABLE IF NOT EXISTS item_shares (
    id BIGSERIAL PRIMARY KEY,
    item_id BIGINT NOT NULL REFERENCES items (id) ON DELETE CASCADE,
    owner_id uuid NOT NULL REFERENCES auth.users (id),
    email TEXT NOT NULL,
    permission TEXT NOT NULL DEFAULT 'view',
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint,
    UNIQUE (item_id, email)
);

-- 5. Tasks can now belong to an item / page, and carry a due date. Deleting
--    the item or page releases the task back to the global list rather than
--    destroying it.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS item_id BIGINT REFERENCES items (id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS page_id BIGINT REFERENCES pages (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_items_space ON items (space_id, position);
CREATE INDEX IF NOT EXISTS idx_items_user ON items (user_id);
CREATE INDEX IF NOT EXISTS idx_pages_item ON pages (item_id, position);
CREATE INDEX IF NOT EXISTS idx_page_entries_page ON page_entries (page_id, day, position);
CREATE INDEX IF NOT EXISTS idx_people_page ON people (page_id, position);
CREATE INDEX IF NOT EXISTS idx_item_shares_email ON item_shares (email);
CREATE INDEX IF NOT EXISTS idx_tasks_item ON tasks (item_id);
CREATE INDEX IF NOT EXISTS idx_tasks_page ON tasks (page_id);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY items_owner ON items USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY pages_owner ON pages USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY page_entries_owner ON page_entries USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY people_owner ON people USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY item_shares_owner ON item_shares USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
