-- P0 Identity: additive schema only. REVIEW on isolated DB before production.
-- DO NOT install into cube2. DO NOT delete game data. No automatic cleanup job.
BEGIN;
CREATE TABLE IF NOT EXISTS public.sr_identity_authorization_codes (
 code_hash char(64) PRIMARY KEY,
 client_id text NOT NULL CHECK (length(client_id) BETWEEN 3 AND 80),
 redirect_uri text NOT NULL CHECK (length(redirect_uri) BETWEEN 15 AND 512),
 code_challenge char(43) NOT NULL,
 player_id uuid NOT NULL REFERENCES public.sr_platform_identities(platform_player_id),
 state_hash char(64) NOT NULL,
 nonce_hash char(64) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 CONSTRAINT identity_code_expiry CHECK (expires_at>created_at AND expires_at<=created_at+interval '90 seconds'),
 CONSTRAINT identity_code_consumed CHECK (consumed_at IS NULL OR consumed_at>=created_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS sr_identity_code_unique_state ON public.sr_identity_authorization_codes(client_id,state_hash);
CREATE INDEX IF NOT EXISTS sr_identity_code_expiry ON public.sr_identity_authorization_codes(expires_at);
CREATE TABLE IF NOT EXISTS public.sr_identity_account_status (
 player_id uuid PRIMARY KEY REFERENCES public.sr_platform_identities(platform_player_id),
 suspended boolean NOT NULL DEFAULT false,
 revoked_after timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.sr_identity_revoked_jti (
 jti uuid PRIMARY KEY,
 player_id uuid NOT NULL REFERENCES public.sr_platform_identities(platform_player_id),
 revoked_at timestamptz NOT NULL DEFAULT now(),
 reason_code text NOT NULL CHECK(length(reason_code) BETWEEN 3 AND 64)
);
CREATE TABLE IF NOT EXISTS public.sr_identity_revoked_kids (
 kid text PRIMARY KEY CHECK(length(kid) BETWEEN 8 AND 80),
 revoked_at timestamptz NOT NULL DEFAULT now(),
 reason_code text NOT NULL CHECK(length(reason_code) BETWEEN 3 AND 64)
);
REVOKE ALL ON public.sr_identity_authorization_codes,public.sr_identity_account_status,
 public.sr_identity_revoked_jti,public.sr_identity_revoked_kids FROM PUBLIC;
ALTER TABLE public.sr_identity_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sr_identity_account_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sr_identity_revoked_jti ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sr_identity_revoked_kids ENABLE ROW LEVEL SECURITY;
COMMIT;
