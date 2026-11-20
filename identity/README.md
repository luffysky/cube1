# SnowRealm Identity: Ed25519 / JWKS foundation

**State: source implementation only, NOT deployed or suitable for account linking.**

This module implements a server-only Ed25519 signer, the public JWK set, a
strict player-link token verifier, and fail-closed HTTP metadata endpoints.
There is NO public signing endpoint, login, authorization-code flow, PKCE,
BFF, refresh session, persistent revocation store or account migration
in this phase. Its live readiness response intentionally returns HTTP 503.

The approved issuer is https://identity.snowrealm.pet, the Brickduel player
audience is snowrealm:brickduel:api, and link scope brickduel:account:link.
Signing only accepts a platform UUID and expires within 600 seconds.
For high-risk linking, the caller MUST supply a live account/jti/kid status
check. Missing or failing status denies verification. The future account-link
transaction must additionally consume one-time identifiers atomically.

The signing private key must come from a trusted secrets manager, never
source control, client storage, GitHub logs or chat. The module takes a
PKCS#8 PEM Ed25519 private key and emits ONLY public JWK fields. For key
rotation, publish new public keys before issuing new tokens and retain old
public keys through expiry plus caching and clock-skew intervals. Revocation
of a compromised kid requires a trusted live status backend.

Tests: npm run test:identity (Node.js 24 in CI, no external test credentials).

Next gates: integrate verified Neon session and existing permanent platform
UUID, transactional OAuth code + PKCE S256 with a precisely registered cube2
BFF callback, HttpOnly secure BFF sessions, replay prevention, durable
suspension/revocation store, secure secret provisioning and DNS/TLS, followed
by two-user cross-device/conflict/offline and revocation end-to-end tests.

Do not enable cube2 IDENTITY_LINK_ENABLED before both teams approve actual
deployment evidence. This PR performs no database writes, deletion, purchases
or production setup. The separate 30-day Brickduel deletion policy is still
Claude/cube2's engineering responsibility.
