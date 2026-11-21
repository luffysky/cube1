BEGIN;
CREATE TABLE sr_games_suspensions (
 user_id text PRIMARY KEY REFERENCES sr_profiles(user_id),
 reason text,
 suspended_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sr_games_owner_actions (
 owner_subject text NOT NULL,
 request_key text NOT NULL,
 operation text NOT NULL CHECK (operation IN ('suspension','coins','match-correction')),
 target_id text NOT NULL,
 payload_hash text NOT NULL,
 public_reason text,
 internal_note text,
 result jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (owner_subject,request_key)
);
CREATE INDEX sr_games_owner_target ON sr_games_owner_actions(target_id,created_at DESC);
CREATE TABLE sr_ranked_match_corrections (
 match_id uuid PRIMARY KEY REFERENCES sr_ranked_matches(id),
 outcome text NOT NULL CHECK (outcome IN ('player-one','player-two','draw','void')),
 public_reason text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sr_games_suspensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_games_owner_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_ranked_match_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sr_games_suspensions,sr_games_owner_actions,sr_ranked_match_corrections FROM PUBLIC;
COMMIT;
