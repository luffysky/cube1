import {createHmac, timingSafeEqual} from 'node:crypto';
import {createBrowserAuthorization} from './browser-authorization.mjs';
import {parsePortalSsoIntent} from '../../dist/sso-flow.mjs';

const portal = 'https://games.snowrealm.pet';
const cookie = '__Host-snowrealm-portal-session';
const maxAge = 300;
const cors = {
  'Access-Control-Allow-Origin': portal,
  'Access-Control-Allow-Credentials': 'true',
  'Cache-Control': 'no-store',
  Vary: 'Origin',
};

export function createProductionAuthorization({issuer, clients, authorize, authenticate, secret}) {
  const hmac = value => createHmac('sha256', secret).update('production-portal-session:').update(value).digest();
  const browser = createBrowserAuthorization({
    issuer, clients, authorize, loginUrl: portal, secret, staging: false,
    onReject: reason => console.warn('identity_consent_rejected', reason),
    authenticate(request) {
      const proof = request.headers.get('cookie')?.split(/;\s*/).find(part =>
        part.startsWith(cookie + '='))?.slice(cookie.length + 1);
      if (!proof || !/^[A-Za-z0-9_-]{1,768}\.[A-Za-z0-9_-]{43}$/.test(proof)) return null;
      const [value, mac] = proof.split('.');
      if (!timingSafeEqual(hmac(value), Buffer.from(mac, 'base64url'))) return null;
      const {subject, expires} = JSON.parse(Buffer.from(value, 'base64url').toString());
      return expires > Date.now() ? subject : null;
    },
  });
  return async request => {
    const url = new URL(request.url);
    if (url.origin !== issuer) return new Response(null, {status: 400});
    if (request.method === 'POST' && request.headers.get('origin') === portal && !url.search) {
      let subject;
      try { subject = await authenticate(request); }
      catch (error) { return new Response(null, {status: error?.status === 503 ? 503 : 401, headers: cors}); }
      if (typeof subject !== 'string' || !subject || subject.length > 128) {
        return new Response(null, {status: 401, headers: cors});
      }
      const value = Buffer.from(JSON.stringify({subject, expires: Date.now() + maxAge * 1000})).toString('base64url');
      return new Response(null, {status: 204, headers: {
        ...cors,
        'Set-Cookie': `${cookie}=${value}.${hmac(value).toString('base64url')}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`,
      }});
    }
    if (request.method === 'OPTIONS' && request.headers.get('origin') === portal) {
      return new Response(null, {status: 204, headers: {
        ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Authorization',
      }});
    }
    const response = await browser(request);
    if (request.method === 'GET' && response.status === 303 &&
        new URL(response.headers.get('Location')).origin === portal) {
      const destination = new URL(portal);
      destination.search = url.search;
      destination.searchParams.set('sso', 'brickduel');
      if (!parsePortalSsoIntent(destination.href)) return new Response(null, {status: 400});
      return new Response(null, {status: 303, headers: {
        Location: destination.href, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
      }});
    }
    return response;
  };
}
