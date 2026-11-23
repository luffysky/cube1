import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { createIdentityAuthority, ISSUER, LINK_SCOPE, PLAYER_AUDIENCE, verifyBrickduelLinkToken } from '../../identity/authority.mjs';
import { createAdminAuthority } from '../../identity/admin-authority.mjs';
import { stagingIdentityConfig } from '../../identity/staging-config.mjs';
import { normalizeClients } from '../../identity/oauth-core.mjs';

test('staging uses the exact callback and tokens do not verify under the production issuer', async () => {
  const issuer = 'https://identity-staging.example.test';
  const config = stagingIdentityConfig(issuer);
  assert.throws(() => stagingIdentityConfig(ISSUER), /invalid_staging_issuer/);
  assert.throws(() => stagingIdentityConfig(issuer + '/oauth'), /invalid_staging_issuer/);
  assert.deepEqual([...normalizeClients(config.clients)], [
    ['brickduel-bff-staging', 'https://brickduel-staging.snowrealm.pet/api/auth/callback'],
  ]);
  const key = () => generateKeyPairSync('ed25519').privateKey.export({ type:'pkcs8', format:'pem' });
  const player = createIdentityAuthority({ privateKeyPem:key(), kid:'staging-player', issuer });
  const token = player.issuePlayerToken({
    playerId:'7c033f11-b127-4822-bebe-ef31e7e1645c', audience:PLAYER_AUDIENCE, scope:LINK_SCOPE, nonce:'n'.repeat(32),
  });
  const verifyOptions = { jwks:player.publicJwks(), checkStatus:async () => true };
  await assert.rejects(verifyBrickduelLinkToken(token, verifyOptions), /invalid_claims/);
  await verifyBrickduelLinkToken(token, {...verifyOptions, issuer});
  const admin = createAdminAuthority({ privateKeyPem:key(), kid:'staging-admin', issuer, canIssue:async () => true });
  const issued = await admin.issueAdminToken();
  const claims = JSON.parse(Buffer.from(issued.token.split('.')[1], 'base64url'));
  assert.equal(claims.iss, issuer);
  assert.equal(claims.exp - claims.iat, 300);
});
