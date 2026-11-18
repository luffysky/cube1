import { createRemoteJWKSet, jwtVerify } from 'jose';
import { fail } from './domain.mjs';

export function jwtAuthenticator({ jwksUrl, authBaseUrl, audience } = {}) {
  if (!jwksUrl || !authBaseUrl) return async () => fail('auth_unavailable', 503);
  const jwks = createRemoteJWKSet(new URL(jwksUrl), { timeoutDuration: 5000, cooldownDuration: 30000 });
  // Managed Better Auth's issuer is the origin, not its /database/auth path.
  const issuer = new URL(authBaseUrl).origin;
  return async request => {
    const authorization = request.headers.get('authorization');
    if (!authorization || !/^Bearer [^\s]+$/i.test(authorization) || authorization.length > 16384) fail('unauthorized', 401);
    try {
      const { payload } = await jwtVerify(authorization.slice(7), jwks, { issuer, algorithms: ['EdDSA'], ...(audience ? { audience } : {}), requiredClaims: ['sub', 'exp', 'iat'] });
      if (typeof payload.sub !== 'string' || !payload.sub.length || payload.sub.length > 128) fail('unauthorized', 401);
      return payload.sub;
    } catch (error) {
      if (error?.code === 'ERR_JWKS_TIMEOUT' || error?.code === 'ERR_JWKS_INVALID' || error instanceof TypeError) fail('auth_unavailable', 503);
      fail('unauthorized', 401);
    }
  };
}
