import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ApiError, fail, readBody } from './domain.mjs';
import { parseBrickduelSnapshot } from './brickduel-saves.mjs';

const audience = 'snowrealm:games:save-sync';
export function brickduelSyncVerifier({staging = false} = {}) {
  const issuer = staging ? 'https://brickduel-staging.snowrealm.pet' : 'https://brickduel.snowrealm.pet';
  const keys = createRemoteJWKSet(new URL('/.well-known/sync-jwks.json', issuer), {timeoutDuration:5000});
  return async request => {
    const authorization = request.headers.get('authorization');
    if (!authorization || authorization.length > 8192 || !/^Bearer [\w.-]+$/.test(authorization)) fail('invalid_service_token',401);
    let payload;
    try {
      ({payload} = await jwtVerify(authorization.slice(7), keys, {
        issuer, audience, subject:'svc:brickduel', algorithms:['EdDSA'],
        requiredClaims:['iat','exp','jti'], maxTokenAge:300,
      }));
    } catch (error) {
      if (error?.code === 'ERR_JWKS_TIMEOUT' || error?.code === 'ERR_JWKS_INVALID' ||
          error?.code === 'ERR_JOSE_GENERIC' || error instanceof TypeError) fail('sync_keys_unavailable',503);
      fail('invalid_service_token',401);
    }
    if (!Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp) ||
        payload.exp <= payload.iat || payload.exp - payload.iat > 300 || payload.aud !== audience ||
        typeof payload.jti !== 'string' || !/^[\w.-]{8,128}$/.test(payload.jti)) fail('invalid_service_token',401);
    if (payload.scope !== 'save:write') fail('invalid_service_scope',403);
  };
}

export function createBrickduelSync({store, verify}) {
  return async (request, platformId) => {
    const reply = (status, data) => Response.json(data, {status,headers:{'Cache-Control':'no-store'}});
    try {
      if (request.method !== 'PUT') return new Response(null,{status:405,headers:{Allow:'PUT'}});
      if (request.headers.has('origin')) fail('origin_denied',403);
      await verify(request);
      const {data} = await readBody(request, 128 * 1024);
      return reply(200,{result:await store.put(parseBrickduelSnapshot(platformId,data))});
    } catch (error) {
      if (error instanceof ApiError) return reply(error.status,{error:error.code});
      if (['23503','40001','55P03','57014'].includes(error?.code)) return reply(503,{error:'save_sync_retry'});
      return reply(500,{error:'save_sync_unavailable'});
    }
  };
}

export function createStagingBrickduelSaveRead({store, authenticate}) {
  return async request => {
    const reply = (status, data) => Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
    if (request.method !== 'GET') return new Response(null,{status:405,headers:{Allow:'GET'}});
    if (request.headers.has('origin') && request.headers.get('origin') !== new URL(request.url).origin) {
      return reply(403,{error:'origin_denied'});
    }
    try {
      const subject = await authenticate(request);
      if (!subject) return reply(401,{error:'unauthorized'});
      return reply(200,{save:await store.getForPlayer(subject)});
    } catch {
      return reply(503,{error:'brickduel_save_unavailable'});
    }
  };
}
