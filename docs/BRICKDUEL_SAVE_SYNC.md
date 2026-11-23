# BrickDuel save sync receiver

BrickDuel owns the save. The SnowRealm Games player center reads a private copy using the authenticated player's existing platform mapping.

## Sender contract

- Production PUT `https://identity.snowrealm.pet/v1/games/brickduel/saves/{platformId}`. Staging uses `identity-staging.snowrealm.pet`.
- Send a fresh Ed25519 service JWT with `kid`, `iss` equal to the BrickDuel environment's HTTPS origin, `aud=snowrealm:games:save-sync`, `sub=svc:brickduel`, `scope=save:write`, `iat`, `exp` and unique `jti`. Maximum token lifetime is 300 seconds. Publish environment-specific public keys at `/.well-known/sync-jwks.json` on the matching BrickDuel origin. Identity must be able to fetch it over HTTPS.
- All events include `schema: "brickduel.save.v1"`, `platformId` (same UUID as the path), `gameUserId` (save UUID), `generation` and `ver` (positive safe integers), `at` (UTC RFC 3339 timestamp), and `event`.
- `event: "upsert"` also requires eight-character `publicTag` and the full 30-field `state` from the server's normalized BrickDuel save. Refer to the receiver schema and test fixture for allowed top-level fields. Body limit is 128 KiB. Keep timestamps stable when resending the same snapshot. Omit device credentials, auth data, `srv`, and file contents.
- `event: "hide"` and `event: "purge"` omit both `publicTag` and `state`. Restoring a hidden save uses an `upsert` with a higher version. Purge permanently terminates that generation. A replacement save uses its own save UUID and a higher generation, after the prior generation's purge is acknowledged.
- The first generation can start at 1. Reserve a strictly increasing version for each event within a generation, including hide and purge. Coalesce updates within a generation only. Persist terminal events until acknowledged, including after the game save has been deleted.
- HTTP 200 returns `result: "applied" | "duplicate" | "stale"`. HTTP 409 signals a conflicting version or binding and needs reconciliation. Retry transport failures, 429 and 5xx with backoff. Retain exhausted jobs for investigation and replay.

## Verification

Apply migration 005 after the Identity roles and migrations 003–004 are installed in isolated staging. Enable `BRICKDUEL_SAVE_INGEST_ENABLED` in Identity and `BRICKDUEL_SAVE_READ_ENABLED` in the member API for that environment. Verify the sender's initially bound save, updates, retries, hide, restore, purge, replacement, and anonymous exclusion. Validate the dashboard with the matching and a different player. Production configuration remains gated on joint verification and Owner approval.
