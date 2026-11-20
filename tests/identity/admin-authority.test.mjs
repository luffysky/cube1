import { generateKeyPairSync, verify } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminAuthority } from '../../identity/admin-authority.mjs';

test('admin signer fixes scope and audience and stops issuing for revoked keys', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  let allowed = true;
  const authority = createAdminAuthority({
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    kid: 'admin-test-01', canIssue: async () => allowed,
  });
  const { token, jti } = await authority.issueAdminToken();
  const [header, payload, signature] = token.split('.');
  assert.ok(verify(null, Buffer.from(header + '.' + payload), publicKey, Buffer.from(signature, 'base64url')));
  const claims = JSON.parse(Buffer.from(payload, 'base64url'));
  assert.equal(claims.aud, 'snowrealm:brickduel:admin');
  assert.equal(claims.iss, 'https://identity.snowrealm.pet');
  assert.equal(claims.scope, 'brickduel:admin:read');
  assert.equal(claims.sub, 'svc:snowrealm-games-admin');
  assert.equal(claims.exp - claims.iat, 300);
  assert.equal(claims.nbf, claims.iat);
  assert.equal(claims.jti, jti);
  assert.equal(authority.publicJwks().keys[0].d, undefined);
  allowed = false;
  await assert.rejects(authority.issueAdminToken(), /admin_signing_unavailable/);
});
