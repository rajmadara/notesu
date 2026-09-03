-- The three-level workspace: spaces -> boards -> columns -> cards.
--
-- Spaces are the top-level "parent pages" (Notes, Shared Notes). Boards are
-- the sub-pages inside them (Event, Itinerary, To do, ...). Boards hold
-- columns, columns hold cards -- the Trello shape.
--
-- 'kind' on a space is personal | shared. It carries no enforcement yet: a
-- shared space is still owned by one user_id. It exists now so the UI can be
-- built against the real shape, and so adding a space_members table later is
-- a pure addition rather than a restructure.

CREATE TABLE IF NOT EXISTS spaces (
    id BIGSERIAL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users (id),
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'personal',
    position INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint
);

-- 'kind' picks which starter columns a new board gets. After creation it's
-- only a label -- every board behaves identically regardless of kind.
CREATE TABLE IF NOT EXISTS boards (
    id BIGSERIAL PRIMARY KEY,
    space_id BIGINT NOT NULL REFERENCES spaces (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users (id),
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'todo',
    position INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint
);

-- Named board_columns, not columns: bare "columns" collides with
-- information_schema.columns and reads badly in every query that joins it.
CREATE TABLE IF NOT EXISTS board_columns (
    id BIGSERIAL PRIMARY KEY,
    board_id BIGINT NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users (id),
    name TEXT NOT NULL,
    position INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint
);

-- position is a plain int, densely renumbered on every move. Trello uses
-- sparse/fractional ordering to avoid rewriting siblings; at one user's card
-- counts a renumber is a single cheap UPDATE and keeps the ordering
-- impossible to corrupt.
CREATE TABLE IF NOT EXISTS cards (
    id BIGSERIAL PRIMARY KEY,
    column_id BIGINT NOT NULL REFERENCES board_columns (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users (id),
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    due_date TEXT,
    done BOOLEAN NOT NULL DEFAULT false,
    labels TEXT NOT NULL DEFAULT '',
    position INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint
);

CREATE INDEX IF NOT EXISTS idx_spaces_user ON spaces (user_id, position);
CREATE INDEX IF NOT EXISTS idx_boards_space ON boards (space_id, position);
CREATE INDEX IF NOT EXISTS idx_board_columns_board ON board_columns (board_id, position);
CREATE INDEX IF NOT EXISTS idx_cards_column ON cards (column_id, position);

ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY spaces_owner ON spaces
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY boards_owner ON boards
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY board_columns_owner ON board_columns
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY cards_owner ON cards
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
