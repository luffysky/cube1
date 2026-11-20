// Server-side integration example. The resolver comes from trusted server configuration.
import { createRemoteJWKSet, jwtVerify } from 'jose';

const issuer = 'https://identity.snowrealm.pet';
const audience = 'snowrealm:brickduel:api';
const platformUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const keys = createRemoteJWKSet(new URL('/.well-known/jwks.json', issuer), {
  timeoutDuration: 3000,
  cooldownDuration: 30000,
  cacheMaxAge: 300000,
});

// Call once per service. Tests may use jose.createLocalJWKSet with a disposable public key.
export function makeBrickduelPlayerVerifier(resolveKey = keys) {
  return async function verifyPlayer(token, requiredScope) {
    if (typeof requiredScope !== 'string' || !/^brickduel:[a-z0-9:-]+$/.test(requiredScope)
        || requiredScope.startsWith('brickduel:admin:')) {
      throw new TypeError('Expected a player scope from server-side route configuration');
    }
    if (typeof token !== 'string' || token.length > 16384) throw new Error('Invalid token');
    const { payload, protectedHeader } = await jwtVerify(token, resolveKey, {
      issuer, audience, algorithms: ['EdDSA'], clockTolerance: 60,
      requiredClaims: ['sub', 'iat', 'exp', 'jti', 'scope'],
    });
    const { sub, iat, exp, nbf, jti, scope } = payload;
    if (typeof protectedHeader.kid !== 'string' || !protectedHeader.kid.trim()
        || payload.aud !== audience || typeof sub !== 'string' || !platformUuid.test(sub)
        || typeof jti !== 'string' || !jti.trim()
        || !Number.isSafeInteger(iat) || !Number.isSafeInteger(exp)
        || iat > Math.floor(Date.now() / 1000) + 60 || exp <= iat || exp - iat > 600
        || (nbf !== undefined && (!Number.isSafeInteger(nbf) || nbf >= exp))) {
      throw new Error('Invalid player identity claims');
    }
    if (typeof scope !== 'string' || !scope.split(' ').includes(requiredScope)) {
      throw new Error('Missing required player scope');
    }
    return { snowrealmPlayerId: sub, jti, kid: protectedHeader.kid, expiresAt: exp };
  };
}
