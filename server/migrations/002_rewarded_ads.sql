-- SnowRealm Games rewarded ad claims. Apply ONLY after ad adapter review.
-- Client cannot write these tables; server processes signed trusted SSV events.
BEGIN;
CREATE TABLE IF NOT EXISTS sr_reward_ad_attempts (
 id uuid PRIMARY KEY,
 user_id text NOT NULL REFERENCES sr_profiles(user_id),
 provider text NOT NULL CHECK (provider='google-ad-manager-web'),
 ad_unit text NOT NULL CHECK (char_length(ad_unit) BETWEEN 3 AND 160),
 reward_coins integer NOT NULL CHECK (reward_coins BETWEEN 1 AND 100),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','granted','expired')),
 issued_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 granted_at timestamptz,
 provider_event_id text UNIQUE,
 CONSTRAINT reward_grant_consistency CHECK (
  (status='granted' AND granted_at IS NOT NULL AND provider_event_id IS NOT NULL)
   OR (status<>'granted' AND granted_at IS NULL AND provider_event_id IS NULL)
 )
);
CREATE INDEX IF NOT EXISTS sr_reward_ad_user_status ON sr_reward_ad_attempts(user_id,status,issued_at DESC);
CREATE INDEX IF NOT EXISTS sr_reward_ad_granted ON sr_reward_ad_attempts(user_id,granted_at DESC) WHERE status='granted';
REVOKE ALL ON sr_reward_ad_attempts FROM PUBLIC;
ALTER TABLE sr_reward_ad_attempts ENABLE ROW LEVEL SECURITY;
COMMIT;
