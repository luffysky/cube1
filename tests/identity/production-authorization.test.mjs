import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductionAuthorization} from '../../identity/neon/production-authorization.mjs';
import {BRICKDUEL_CLIENT, BRICKDUEL_CALLBACK} from '../../dist/sso-flow.mjs';

test('production portal verifies login and requires a separate Identity consent POST', async () => {
  const issuer = 'https://identity.snowrealm.pet';
  const portal = 'https://games.snowrealm.pet';
  const path = issuer + '/oauth/authorize';
  let issued = 0;
  const authorize = createProductionAuthorization({
    issuer, clients:[{clientId:BRICKDUEL_CLIENT,redirectUri:BRICKDUEL_CALLBACK}], secret:'s'.repeat(32),
    authenticate(request) {
      return request.headers.get('authorization') === 'Bearer fixture' ? 'verified-account' : null;
    },
    authorize(grant) {
      assert.equal(grant.verifiedSubject, 'verified-account');
      assert.equal(grant.consentGranted, true);
      issued++;
      return {code:'c'.repeat(43)};
    },
  });
  const query = new URLSearchParams({
    client_id:BRICKDUEL_CLIENT,redirect_uri:BRICKDUEL_CALLBACK,response_type:'code',
    code_challenge_method:'S256',code_challenge:'a'.repeat(43),state:'b'.repeat(43),nonce:'n'.repeat(43)
  });
  const start = await authorize(new Request(path + '?' + query));
  assert.equal(new URL(start.headers.get('location')).origin, portal);
  const bootstrap = (origin, authorization) => authorize(new Request(path, {
    method:'POST',headers:{origin,authorization},
  }));
  assert.equal((await bootstrap(portal, 'Bearer bad')).status, 401);
  assert.equal((await bootstrap('https://other.snowrealm.pet','Bearer fixture')).status, 400);
  const session = await bootstrap(portal,'Bearer fixture');
  assert.equal(session.status, 204);
  const sessionCookie = session.headers.get('set-cookie').split(';')[0];
  const consent = await authorize(new Request(path + '?' + query,{headers:{cookie:sessionCookie}}));
  assert.equal(consent.status, 200);
  assert.equal(issued, 0);
  const cookies = sessionCookie + '; ' + consent.headers.get('set-cookie').split(';')[0];
  const csrf = (await consent.text()).match(/name="csrf" value="([^"]+)"/)[1];
  async function decide(value) {
    return authorize(new Request(path,{
      method:'POST',headers:{cookie:cookies,origin:issuer},
      body:new URLSearchParams({decision:'allow',csrf:value}),
    }));
  }
  assert.equal((await decide('wrong')).status, 400);
  const approved = await decide(csrf);
  assert.equal(approved.status, 303);
  const callback = new URL(approved.headers.get('location'));
  assert.equal(callback.origin + callback.pathname, BRICKDUEL_CALLBACK);
  assert.equal(callback.searchParams.get('state'), query.get('state'));
  assert.equal(issued, 1);
});
