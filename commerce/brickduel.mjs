import { createPrivateKey, createPublicKey, randomUUID, sign } from 'node:crypto';

const targets = {
  staging: ['https://identity-staging.snowrealm.pet', 'https://brickduel-staging.snowrealm.pet'],
  production: ['https://identity.snowrealm.pet', 'https://brickduel.snowrealm.pet'],
};
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');

export function createBrickduelCommerceSender({environment, privateKeyPem, kid, fetchImpl = fetch, clock = Date.now}) {
  if (!Object.hasOwn(targets, environment) || !/^[A-Za-z0-9_-]{8,80}$/.test(kid ?? '')) {
    throw new Error('invalid_commerce_configuration');
  }
  const [issuer, origin] = targets[environment];
  const privateKey = createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('invalid_commerce_signer');
  const {kty, crv, x} = createPublicKey(privateKey).export({format:'jwk'});

  return {
    publicJwks: () => ({keys:[{kty, crv, x, kid, use:'sig', alg:'EdDSA'}]}),
    async deliver(event) {
      const iat = Math.floor(clock()/1000);
      const unsigned = encode({alg:'EdDSA', typ:'JWT', kid}) + '.' + encode({
        iss:issuer, aud:'snowrealm:brickduel:entitlements', sub:'svc:snowrealm-commerce',
        scope:'entitlements:write', iat, exp:iat+300, jti:randomUUID(),
      });
      const jwt = unsigned + '.' + sign(null, Buffer.from(unsigned), privateKey).toString('base64url');
      try {
        const response = await fetchImpl(origin + '/internal/entitlements/v1/events',{
          method:'POST', redirect:'error', signal:AbortSignal.timeout(8000),
          headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},
          body:JSON.stringify(event),
        });
        if (response.status === 200) {
          const body = await response.json().catch(()=>null);
          if (['applied','duplicate','stale'].includes(body?.result)) return {status:'delivered', result:body.result};
          return {status:'retry'};
        }
        return {status:response.status === 429 || response.status >= 500 ? 'retry' : 'review', httpStatus:response.status};
      } catch {
        return {status:'retry'};
      }
    },
  };
}
