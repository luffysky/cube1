-- Run as the table owner after 003 and 004. Apply first to an isolated DB.
-- This is a group role. Provision a separate login through Neon with only
-- this membership. Never grant the owner role to the application login.
BEGIN;
CREATE ROLE sr_identity_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO sr_identity_runtime;
GRANT SELECT ON public.sr_platform_identities, public.sr_identity_authorization_codes,
  public.sr_identity_account_status, public.sr_identity_revoked_jti,
  public.sr_identity_revoked_kids TO sr_identity_runtime;
GRANT INSERT (neon_subject, platform_player_id)
  ON public.sr_platform_identities TO sr_identity_runtime;
GRANT INSERT (code_hash, client_id, redirect_uri, code_challenge, player_id, state_hash, nonce_hash, expires_at),
  UPDATE (consumed_at) ON public.sr_identity_authorization_codes TO sr_identity_runtime;

CREATE POLICY identity_runtime_select ON public.sr_platform_identities
  FOR SELECT TO sr_identity_runtime USING (true);
CREATE POLICY identity_runtime_insert ON public.sr_platform_identities
  FOR INSERT TO sr_identity_runtime WITH CHECK (true);
CREATE POLICY identity_runtime_select ON public.sr_identity_authorization_codes
  FOR SELECT TO sr_identity_runtime USING (true);
CREATE POLICY identity_runtime_insert ON public.sr_identity_authorization_codes
  FOR INSERT TO sr_identity_runtime WITH CHECK (consumed_at IS NULL);
CREATE POLICY identity_runtime_consume ON public.sr_identity_authorization_codes
  FOR UPDATE TO sr_identity_runtime
  USING (consumed_at IS NULL AND expires_at > now())
  WITH CHECK (consumed_at IS NOT NULL);
CREATE POLICY identity_runtime_select ON public.sr_identity_account_status
  FOR SELECT TO sr_identity_runtime USING (true);
CREATE POLICY identity_runtime_select ON public.sr_identity_revoked_jti
  FOR SELECT TO sr_identity_runtime USING (true);
CREATE POLICY identity_runtime_select ON public.sr_identity_revoked_kids
  FOR SELECT TO sr_identity_runtime USING (true);
COMMIT;
