# BrickDuel commerce delivery

Keep the v1 envelope and enum values defined in cube2's handoff. For active or canceled paid tiers, send the paid through UTC timestamp. An effective entitlement is versioned by platformId and game. Orders are versioned by orderId. Keep platformId, sku and purchase platform immutable for an order. Record only server-confirmed payment transitions.

Staging issuer: https://identity-staging.snowrealm.pet
Staging JWKS target: https://identity-staging.snowrealm.pet/.well-known/commerce-jwks.json
Production issuer: https://identity.snowrealm.pet
Production JWKS target: https://identity.snowrealm.pet/.well-known/commerce-jwks.json

These are deployment targets. Publish only public keys and use independent keys for each environment. Vercel staging needs ENTITLE_TEST_ISSUER and ENTITLE_JWKS_URL set to the staging values.

Persist the immutable event in an outbox in the same transaction as the verified order or membership change. Each attempt uses a new JWT jti and the same eventId and version. Acknowledge applied, duplicate and stale. Retry network, 429 and 5xx with exponential backoff and jitter. Hold other responses for review and retain exhausted events for controlled redelivery. The sender determines the outcome of one attempt. The outbox and dispatcher still need integration with the payment service.

Receiver acceptance must verify atomic deduplication and application, including a failure after recording eventId but before settling the order or membership. A duplicate acknowledgement must only mean the event is durably applied, durably queued for settlement, or safely obsolete.

Keep push delivery for v1. A read-only reconciliation API can follow after the central ledger is authoritative. Plus and Pro benefits are pending product approval. No live charges or production entitlement enablement.
