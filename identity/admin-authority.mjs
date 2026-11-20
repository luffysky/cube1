import { createPrivateKey, createPublicKey, randomUUID, sign } from 'node:crypto';
import { ISSUER } from './authority.mjs';

export function createAdminAuthority({ privateKeyPem, kid, canIssue, clock = Date.now }) {
  if (typeof kid !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(kid) || typeof canIssue !== 'function')
    throw new Error('admin_signing_unavailable');
  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('admin_signing_unavailable');
  const { kty, crv, x } = createPublicKey(key).export({ format: 'jwk' });
  const jwk = { kty, crv, x, kid, use: 'sig', alg: 'EdDSA' };
  const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url');
  return {
    publicJwks: () => ({ keys: [{ ...jwk }] }),
    async issueAdminToken() {
      if (await canIssue(kid) !== true) throw new Error('admin_signing_unavailable');
      const iat = Math.floor(clock() / 1000);
      const jti = randomUUID();
      const claims = {
        iss: ISSUER, aud: 'snowrealm:brickduel:admin',
        scope: 'brickduel:admin:read', sub: 'svc:snowrealm-games-admin',
        iat, nbf: iat, exp: iat + 300, jti,
      };
      const input = encode({ alg: 'EdDSA', typ: 'JWT', kid }) + '.' + encode(claims);
      return { token: input + '.' + sign(null, Buffer.from(input), key).toString('base64url'), jti };
    },
  };
}
