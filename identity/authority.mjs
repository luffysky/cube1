import { createPrivateKey, createPublicKey, randomUUID, sign, verify } from 'node:crypto';

export const ISSUER = 'https://identity.snowrealm.pet';
export const PLAYER_AUDIENCE = 'snowrealm:brickduel:api';
export const LINK_SCOPE = 'brickduel:account:link';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KID = /^[a-zA-Z0-9_-]{8,80}$/;
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const error = message => { throw new Error(message); };

function parse(part) {
  if (typeof part !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(part) || part.length > 12000) error('invalid_token');
  try {
    const value = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) error('invalid_token');
    return value;
  } catch { error('invalid_token'); }
}

function validateJwk(value) {
  if (!value || value.kty !== 'OKP' || value.crv !== 'Ed25519' ||
      value.use !== 'sig' || value.alg !== 'EdDSA' || !KID.test(value.kid || '') ||
      typeof value.x !== 'string' || Object.hasOwn(value, 'd')) error('invalid_jwk');
  try { createPublicKey({key:{kty:'OKP',crv:'Ed25519',x:value.x},format:'jwk'}); }
  catch { error('invalid_jwk'); }
  return { kty:'OKP', crv:'Ed25519', x:value.x, use:'sig', alg:'EdDSA', kid:value.kid };
}
function checkPurpose(audience, scope) {
  if (audience !== PLAYER_AUDIENCE || scope !== LINK_SCOPE) error('unsupported_purpose');
}

// Internal trusted-server signer ONLY. Not a public login or token-issuance route.
// Upstream session validation, platform UUID ownership and revocation checks are
// prerequisites handled by the future BFF. Never supply client-claimed playerId.
export function createIdentityAuthority({ privateKeyPem, kid, previousPublicJwks = [], clock = Date.now }) {
  if (typeof privateKeyPem !== 'string' || !KID.test(kid || '')) error('signing_not_configured');
  let privateKey;
  try { privateKey = createPrivateKey(privateKeyPem); }
  catch { error('signing_not_configured'); }
  if (privateKey.asymmetricKeyType !== 'ed25519') error('wrong_key_type');
  const own = createPublicKey(privateKey).export({format:'jwk'});
  const keys = [validateJwk({kty:'OKP',crv:'Ed25519',use:'sig',alg:'EdDSA',kid,x:own.x}),
    ...previousPublicJwks.map(validateJwk)];
  if (new Set(keys.map(key=>key.kid)).size !== keys.length) error('duplicate_kid');
  return {
    publicJwks: () => ({keys:keys.map(key=>({...key}))}),
    issuePlayerToken({playerId,audience,scope,lifetimeSeconds=300}) {
      if (!UUID.test(playerId || '')) error('invalid_platform_uuid');
      checkPurpose(audience,scope);
      if (!Number.isSafeInteger(lifetimeSeconds) || lifetimeSeconds < 1 || lifetimeSeconds > 600)
        error('invalid_lifetime');
      const iat = Math.floor(clock()/1000);
      const payload = { iss:ISSUER, sub:playerId, aud:audience, scope,
        iat, nbf:iat, exp:iat+lifetimeSeconds, jti:randomUUID() };
      const input = encode({alg:'EdDSA',typ:'JWT',kid}) + '.' + encode(payload);
      return input + '.' + sign(null,Buffer.from(input),privateKey).toString('base64url');
    }
  };
}

// Sensitive linking must consult live account + jti + kid revocation state.
// Missing or failed status checks DENY; atomic single-use jti consumption
// remains the caller's responsibility and is NOT provided by this module.
export async function verifyBrickduelLinkToken(token,{jwks,checkStatus,clock=Date.now}={}) {
  if (typeof token !== 'string' || token.length > 16384) error('invalid_token');
  const parts = token.split('.');
  if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[2])) error('invalid_token');
  const header = parse(parts[0]), payload = parse(parts[1]);
  if (header.alg !== 'EdDSA' || header.typ !== 'JWT' || !KID.test(header.kid || ''))
    error('invalid_algorithm');
  const jwk = jwks?.keys?.find(key=>key.kid === header.kid);
  if (!jwk) error('unknown_kid');
  const pub = validateJwk(jwk);
  const key = createPublicKey({key:{kty:'OKP',crv:'Ed25519',x:pub.x},format:'jwk'});
  const input = parts[0] + '.' + parts[1];
  if (!verify(null,Buffer.from(input),key,Buffer.from(parts[2],'base64url')))
    error('invalid_signature');
  checkPurpose(payload.aud,payload.scope);
  if (payload.iss !== ISSUER || !UUID.test(payload.sub || '') || !UUID.test(payload.jti || ''))
    error('invalid_claims');
  const now = Math.floor(clock()/1000);
  if (!Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.nbf) ||
      !Number.isSafeInteger(payload.exp) || payload.iat > now + 60 ||
      payload.nbf > now + 60 || payload.nbf > payload.exp ||
      payload.exp <= now - 60 || payload.exp <= payload.iat ||
      payload.exp-payload.iat > 600) error('invalid_time');
  if (typeof checkStatus !== 'function') error('status_unavailable');
  let active = false;
  try { active = (await checkStatus({playerId:payload.sub,jti:payload.jti,kid:header.kid}))===true; }
  catch { error('status_unavailable'); }
  if (!active) error('revoked_or_suspended');
  return {playerId:payload.sub,jti:payload.jti,kid:header.kid,expiresAt:payload.exp};
}
