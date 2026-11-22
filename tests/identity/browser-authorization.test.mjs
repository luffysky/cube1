import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserAuthorization} from '../../identity/neon/browser-authorization.mjs';
import {STAGING_CLIENT} from '../../identity/staging-config.mjs';

const issuer = 'https://identity-staging.snowrealm.pet';
const path = issuer + '/oauth/authorize';
const query = new URLSearchParams({
  client_id: STAGING_CLIENT.clientId, redirect_uri: STAGING_CLIENT.redirectUri,
  response_type: 'code', code_challenge_method: 'S256', code_challenge: 'a'.repeat(43),
  state: 'b'.repeat(32), nonce: 'c'.repeat(32),
});

test('browser consent requires the same verified account and a matching CSRF transaction', async () => {
  let subject, authorized;
  const handle = createBrowserAuthorization({issuer, clients: [STAGING_CLIENT],
    loginUrl: issuer + '/login', secret: 'test-only'.repeat(4),
    authenticate: async () => subject,
    authorize: async grant => {authorized = grant; return {code: 'test-code'};},
  });
  const start = new Request(path + '?' + query);
  assert.equal((await handle(start)).status, 303);
  subject = 'staging-account-one';
  const consent = await handle(start);
  assert.equal(consent.status, 200);
  const cookie = consent.headers.get('set-cookie').split(';')[0];
  const csrf = (await consent.text()).match(/name="csrf" value="([^"]+)"/)[1];
  const post = (origin, value) => new Request(path, {method: 'POST', headers: {origin, cookie},
    body: new URLSearchParams({csrf: value, decision: 'allow'})});
  assert.equal((await handle(post('https://other.snowrealm.pet', csrf))).status, 400);
  assert.equal((await handle(post(issuer, 'wrong'))).status, 400);
  subject = 'staging-account-two';
  assert.equal((await handle(post(issuer, csrf))).status, 400);
  assert.equal(authorized, undefined);
  subject = 'staging-account-one';
  const callback = await handle(post(issuer, csrf));
  assert.equal(callback.status, 303);
  const location = new URL(callback.headers.get('location'));
  assert.equal(location.origin + location.pathname, STAGING_CLIENT.redirectUri);
  assert.equal(location.searchParams.get('state'), query.get('state'));
  assert.equal(authorized.verifiedSubject, subject);
  assert.equal(authorized.nonce, query.get('nonce'));
});
