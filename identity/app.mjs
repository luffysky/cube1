import { ISSUER } from './authority.mjs';

// Until session login, OAuth+PKCE and persistent revocation exist, expose
// strictly public metadata and diagnostics. There is NO token signing API.
export function createPublicIdentityApp(authority) {
  if (typeof authority?.publicJwks !== 'function') throw Error('identity_authority_required');
  return {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      const headers = new Headers({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      if (request.method === 'GET' && path === '/.well-known/jwks.json') {
        headers.set('Cache-Control', 'public, max-age=60');
        return new Response(JSON.stringify(authority.publicJwks()), { status: 200, headers });
      }
      if (request.method === 'GET' && path === '/health/live') {
        return new Response(JSON.stringify({
          service: 'snowrealm-identity', issuer: ISSUER,
          phase: 'jwks-foundation', authorizationAvailable: false,
          crossGameLinkingAvailable: false
        }), { status: 200, headers });
      }
      if (request.method === 'GET' && path === '/health/ready')
        return new Response(JSON.stringify({
          ready: false, reason: 'oauth_and_revocation_not_deployed'
        }), { status: 503, headers });
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers });
    }
  };
}
