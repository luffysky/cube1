-- SnowRealm Games: additive application schema. Run on its dedicated project.
BEGIN;
CREATE TABLE IF NOT EXISTS sr_profiles (
  user_id text PRIMARY KEY CHECK (length(user_id) BETWEEN 1 AND 128),
  nickname text NOT NULL CHECK (char_length(nickname) BETWEEN 2 AND 24),
  friend_code text NOT NULL UNIQUE CHECK (friend_code ~ '^[A-Z2-9]{12}$'),
  locale text NOT NULL DEFAULT 'zh-Hant' CHECK (locale IN ('zh-Hant','zh-Hans','en','ja','ko')),
  appearance jsonb NOT NULL DEFAULT '{"theme":"obsidian","blocks":"classic","board":"grid","background":"solid","boardOverlay":0.72,"customBackgroundEnabled":false,"customTarget":"background"}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sr_wallets (
  user_id text PRIMARY KEY REFERENCES sr_profiles(user_id), balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sr_wallet_ledger (
  id uuid PRIMARY KEY, user_id text NOT NULL REFERENCES sr_profiles(user_id), event_key text NOT NULL,
  delta integer NOT NULL, balance_after integer NOT NULL CHECK (balance_after >= 0), reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,event_key)
);
CREATE INDEX IF NOT EXISTS sr_wallet_history ON sr_wallet_ledger(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS sr_owned_cosmetics (
  user_id text NOT NULL REFERENCES sr_profiles(user_id), item_id text NOT NULL, acquired_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,item_id)
);
CREATE TABLE IF NOT EXISTS sr_inventory (
  user_id text NOT NULL REFERENCES sr_profiles(user_id), item_id text NOT NULL, quantity integer NOT NULL DEFAULT 0 CHECK (quantity BETWEEN 0 AND 999), PRIMARY KEY(user_id,item_id)
);
CREATE TABLE IF NOT EXISTS sr_idempotency (
  user_id text NOT NULL REFERENCES sr_profiles(user_id), request_key text NOT NULL CHECK(length(request_key) BETWEEN 8 AND 100),
  operation text NOT NULL, payload_hash text NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,request_key)
);
CREATE TABLE IF NOT EXISTS sr_entitlements (
  user_id text PRIMARY KEY REFERENCES sr_profiles(user_id), plan text NOT NULL DEFAULT 'none', status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','revoked')),
  expires_at timestamptz, source text, last_event_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sr_entitlement_events (
  event_id text PRIMARY KEY, payload_hash text NOT NULL, user_id text NOT NULL REFERENCES sr_profiles(user_id), occurred_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sr_friendships (
  user_low text NOT NULL REFERENCES sr_profiles(user_id), user_high text NOT NULL REFERENCES sr_profiles(user_id),
  request_id uuid NOT NULL UNIQUE, requester_id text NOT NULL REFERENCES sr_profiles(user_id),
  status text NOT NULL CHECK (status IN ('pending','accepted')), created_at timestamptz NOT NULL DEFAULT now(), accepted_at timestamptz,
  PRIMARY KEY(user_low,user_high), CHECK(user_low < user_high), CHECK(requester_id IN (user_low,user_high))
);
CREATE TABLE IF NOT EXISTS sr_blocks (
  blocker_id text NOT NULL REFERENCES sr_profiles(user_id), blocked_id text NOT NULL REFERENCES sr_profiles(user_id), created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(blocker_id,blocked_id), CHECK(blocker_id <> blocked_id)
);
CREATE TABLE IF NOT EXISTS sr_ratings (
  user_id text PRIMARY KEY REFERENCES sr_profiles(user_id), rating integer NOT NULL DEFAULT 1000 CHECK(rating >= 0),
  games integer NOT NULL DEFAULT 0 CHECK(games >= 0), wins integer NOT NULL DEFAULT 0, losses integer NOT NULL DEFAULT 0, draws integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sr_rating_leaderboard ON sr_ratings(rating DESC, games DESC);
CREATE TABLE IF NOT EXISTS sr_ranked_matches (
  id uuid PRIMARY KEY, player_one text NOT NULL REFERENCES sr_profiles(user_id), player_two text NOT NULL REFERENCES sr_profiles(user_id),
  status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','ended')), snapshot jsonb NOT NULL,
  started_at timestamptz NOT NULL, heartbeat_one timestamptz NOT NULL, heartbeat_two timestamptz NOT NULL,
  result jsonb, settlement jsonb, settled_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(player_one <> player_two)
);
CREATE TABLE IF NOT EXISTS sr_ranked_seats (
  user_id text PRIMARY KEY REFERENCES sr_profiles(user_id), match_id uuid NOT NULL REFERENCES sr_ranked_matches(id)
);
CREATE TABLE IF NOT EXISTS sr_ranked_queue (
  user_id text PRIMARY KEY REFERENCES sr_profiles(user_id), rating integer NOT NULL, joined_at timestamptz NOT NULL DEFAULT now(), heartbeat_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sr_match_inputs (
  match_id uuid NOT NULL REFERENCES sr_ranked_matches(id), user_id text NOT NULL REFERENCES sr_profiles(user_id), seq integer NOT NULL CHECK(seq > 0),
  action text NOT NULL CHECK(action IN ('left','right','soft','hard','cw','ccw','hold')), accepted_tick integer NOT NULL, receive_order integer NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(match_id,user_id,seq), UNIQUE(match_id,receive_order)
);
CREATE TABLE IF NOT EXISTS sr_rank_settlements (
  match_id uuid NOT NULL REFERENCES sr_ranked_matches(id), user_id text NOT NULL REFERENCES sr_profiles(user_id), opponent_id text NOT NULL REFERENCES sr_profiles(user_id),
  outcome text NOT NULL CHECK(outcome IN ('win','loss','draw','void')), rating_before integer NOT NULL, rating_after integer NOT NULL,
  coins integer NOT NULL CHECK(coins >= 0), reward_reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(match_id,user_id)
);
CREATE INDEX IF NOT EXISTS sr_rank_reward_limits ON sr_rank_settlements(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS sr_rate_limits (
  user_id text NOT NULL, scope text NOT NULL, window_started timestamptz NOT NULL, used integer NOT NULL, PRIMARY KEY(user_id,scope)
);
-- App tables are backend-only. No direct browser Data API policies are created.
REVOKE ALL ON sr_profiles,sr_wallets,sr_wallet_ledger,sr_owned_cosmetics,sr_inventory,sr_idempotency,sr_entitlements,sr_entitlement_events,sr_friendships,sr_blocks,sr_ratings,sr_ranked_matches,sr_ranked_seats,sr_ranked_queue,sr_match_inputs,sr_rank_settlements,sr_rate_limits FROM PUBLIC;
ALTER TABLE sr_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_owned_cosmetics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_entitlement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_ranked_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_ranked_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_ranked_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_match_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_rank_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_rate_limits ENABLE ROW LEVEL SECURITY;
COMMIT;
