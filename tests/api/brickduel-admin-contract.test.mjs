import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(new URL('../../server/api/package.json', import.meta.url));
const { createLocalJWKSet, jwtVerify } = await import(require.resolve('jose'));
const fixture = JSON.parse(await readFile(new URL('./fixtures/brickduel-admin-jwt.json', import.meta.url), 'utf8'));
const keys = createLocalJWKSet(fixture.jwks);
const options = {
  algorithms: ['EdDSA'],
  issuer: 'https://admin-fixture.snowrealm.invalid',
  subject: 'svc:test-snowrealm-games-admin',
  audience: 'snowrealm:brickduel:admin',
  requiredClaims: ['sub', 'scope', 'iat', 'nbf', 'exp', 'jti'],
  currentDate: new Date(fixture.verificationTime),
  clockTolerance: 60,
};

test('published public key verifies the machine token at its fixture clock', async () => {
  const [jwk] = fixture.jwks.keys;
  assert.equal(jwk.kty, 'OKP');
  assert.equal(jwk.crv, 'Ed25519');
  assert.equal('d' in jwk, false);
  const { protectedHeader, payload } = await jwtVerify(fixture.token, keys, options);
  assert.equal(protectedHeader.kid, jwk.kid);
  assert.equal(payload.iss, fixture.issuer);
  assert.equal(payload.sub, fixture.subject);
  assert.equal(payload.scope, 'brickduel:admin:read');
  assert.ok([payload.iat, payload.nbf, payload.exp].every(Number.isSafeInteger));
  assert.ok(payload.exp > payload.iat && payload.exp - payload.iat <= 600);
  assert.ok(payload.jti.length > 0);
});

test('fixture is expired outside its window and cannot stand in for player or production identity', async () => {
  for (const changes of [
    { currentDate: new Date('2025-01-01T00:06:01Z') },
    { currentDate: new Date('2024-12-31T23:58:59Z') },
    { audience: 'snowrealm:brickduel:api' },
    { issuer: 'https://identity.snowrealm.pet' },
    { subject: 'svc:snowrealm-games-admin' },
  ]) {
    await assert.rejects(jwtVerify(fixture.token, keys, { ...options, ...changes }),
      error => ['ERR_JWT_EXPIRED', 'ERR_JWT_CLAIM_VALIDATION_FAILED'].includes(error.code));
  }
});
