import { ISSUER } from './authority.mjs';

export const STAGING_CLIENT = Object.freeze({
  clientId: 'brickduel-bff-staging',
  redirectUri: 'https://brickduel-staging.snowrealm.pet/api/auth/callback',
});

export function stagingIdentityConfig(issuer) {
  const url = new URL(issuer);
  if (issuer !== url.origin || url.protocol !== 'https:' || issuer === ISSUER ||
      url.port || !url.hostname.includes('.') || url.hostname.endsWith('.localhost'))
    throw new Error('invalid_staging_issuer');
  return Object.freeze({ issuer, clients: Object.freeze([STAGING_CLIENT]) });
}
