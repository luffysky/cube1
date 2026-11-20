-- SnowRealm platform UUID mapping; additive, no changes to game profiles or wallet data.
-- Run once using the existing cube1 database deployment pipeline after backing up.
BEGIN;
CREATE TABLE IF NOT EXISTS sr_platform_identities (
  neon_subject text PRIMARY KEY CHECK (length(neon_subject) BETWEEN 8 AND 128),
  platform_player_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON sr_platform_identities FROM PUBLIC;
ALTER TABLE sr_platform_identities ENABLE ROW LEVEL SECURITY;
COMMIT;
