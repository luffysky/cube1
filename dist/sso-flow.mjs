export const BRICKDUEL_CALLBACK='https://brickduel.snowrealm.pet/api/auth/callback';
export const BRICKDUEL_CLIENT='brickduel-bff';
const token=/^[A-Za-z0-9._~-]{22,256}$/;
const challenge=/^[A-Za-z0-9_-]{43}$/;

// SSO intent is an untrusted URL. Never accept arbitrary redirects or clients.
export function parsePortalSsoIntent(url){
  const u=new URL(url,'https://games.snowrealm.pet/');
  if(u.origin!=='https://games.snowrealm.pet'||u.searchParams.get('sso')!=='brickduel')return null;
  if(u.searchParams.get('client_id')!==BRICKDUEL_CLIENT||
     u.searchParams.get('redirect_uri')!==BRICKDUEL_CALLBACK||
     u.searchParams.get('code_challenge_method')!=='S256')return null;
  const state=u.searchParams.get('state'),nonce=u.searchParams.get('nonce'),codeChallenge=u.searchParams.get('code_challenge');
  if(!token.test(state||'')||!token.test(nonce||'')||!challenge.test(codeChallenge||''))return null;
  if(u.searchParams.has('code')||u.searchParams.has('access_token')||u.searchParams.has('refresh_token'))return null;
  return {clientId:BRICKDUEL_CLIENT,redirectUri:BRICKDUEL_CALLBACK,
    state,nonce,codeChallenge};
}
