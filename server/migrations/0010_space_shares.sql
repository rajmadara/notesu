-- Sharing a whole space, alongside the existing per-item sharing.
--
-- A share on a space cascades to every item in it. When someone holds both a
-- space share and an item share, the more permissive of the two wins — that
-- rule lives in one place (PostgresTaskStore.itemAccess) so the two paths
-- can't drift apart.
--
-- Keyed by email like item_shares, so a space can be shared before the other
-- person has ever signed in.
CREATE TABLE IF NOT EXISTS space_shares (
    id BIGSERIAL PRIMARY KEY,
    space_id BIGINT NOT NULL REFERENCES spaces (id) ON DELETE CASCADE,
    owner_id uuid NOT NULL REFERENCES auth.users (id),
    email TEXT NOT NULL,
    permission TEXT NOT NULL DEFAULT 'view',
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint,
    UNIQUE (space_id, email)
);

CREATE INDEX IF NOT EXISTS idx_space_shares_email ON space_shares (email);

ALTER TABLE space_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY space_shares_owner ON space_shares
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
