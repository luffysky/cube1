BEGIN;
CREATE TABLE public.sr_brickduel_save_snapshots (
  platform_id uuid PRIMARY KEY REFERENCES public.sr_platform_identities(platform_player_id) ON DELETE CASCADE,
  generation bigint NOT NULL CHECK (generation > 0),
  game_user_id uuid NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  event text NOT NULL CHECK (event IN ('upsert', 'hide', 'purge')),
  public_tag text,
  state jsonb,
  source_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  fingerprint text NOT NULL,
  CHECK ((event = 'upsert') = (state IS NOT NULL AND public_tag IS NOT NULL AND source_at IS NOT NULL))
);
REVOKE ALL ON public.sr_brickduel_save_snapshots FROM PUBLIC;
ALTER TABLE public.sr_brickduel_save_snapshots ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.sr_brickduel_save_snapshots TO sr_identity_runtime;
CREATE POLICY identity_sync_read ON public.sr_brickduel_save_snapshots FOR SELECT TO sr_identity_runtime USING (true);
CREATE POLICY identity_sync_insert ON public.sr_brickduel_save_snapshots FOR INSERT TO sr_identity_runtime WITH CHECK (true);
CREATE POLICY identity_sync_update ON public.sr_brickduel_save_snapshots FOR UPDATE TO sr_identity_runtime USING (true) WITH CHECK (true);
COMMIT;
