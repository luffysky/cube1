import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { jwtAuthenticator } from '../../server/api/auth.mjs';
const require = createRequire(new URL('../../server/api/package.json', import.meta.url));
const { generateKeyPair, exportJWK, SignJWT } = await import(require.resolve('jose'));

test('Managed Auth verifier checks EdDSA signature, issuer, expiry and subject', async t => {
  const { privateKey, publicKey } = await generateKeyPair('EdDSA');
  const jwk = { ...await exportJWK(publicKey), kid: 'test-key', alg: 'EdDSA', use: 'sig' };
  const server = createServer((request, response) => { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ keys: [jwk] })); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const issuer = `http://127.0.0.1:${server.address().port}`;
  const authenticate = jwtAuthenticator({ jwksUrl: `${issuer}/.well-known/jwks.json`, authBaseUrl: `${issuer}/cube1/auth` });
  const token = async ({ iss = issuer, expiration = '15m', subject = 'alice' } = {}) => new SignJWT({}).setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' }).setIssuer(iss).setSubject(subject).setIssuedAt().setExpirationTime(expiration).sign(privateKey);
  const request = signed => new Request('https://api.example/v1/profile', { headers: { authorization: `Bearer ${signed}` } });
  assert.equal(await authenticate(request(await token())), 'alice');
  await assert.rejects(authenticate(request(await token({ iss: `${issuer}/cube1/auth` }))), error => error.code === 'unauthorized');
  await assert.rejects(authenticate(request(await token({ expiration: '-1s' }))), error => error.code === 'unauthorized');
  const valid = await token(); const parts = valid.split('.'); parts[2] = (parts[2][0] === 'a' ? 'b' : 'a') + parts[2].slice(1);
  await assert.rejects(authenticate(request(parts.join('.'))), error => error.code === 'unauthorized');
  await assert.rejects(authenticate(new Request('https://api.example/v1/profile')), error => error.code === 'unauthorized');
  await assert.rejects(authenticate(request(await token({ subject: '' }))), error => error.code === 'unauthorized');
});
