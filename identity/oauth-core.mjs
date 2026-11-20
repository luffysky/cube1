import {createHash,randomBytes} from 'node:crypto';
import {ISSUER,LINK_SCOPE,PLAYER_AUDIENCE} from './authority.mjs';

const CLIENT_ID=/^[a-z0-9][a-z0-9_-]{2,79}$/;
const CHALLENGE=/^[A-Za-z0-9_-]{43}$/;
const VERIFIER=/^[A-Za-z0-9._~-]{43,128}$/;
const STATE=/^[A-Za-z0-9._~-]{22,256}$/;
const CODE=/^[A-Za-z0-9_-]{43}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash=value=>createHash('sha256').update(value,'utf8').digest('hex');
const deny=(code,status=400)=>{const e=new Error(code);e.code=code;e.status=status;throw e;};
export const pkceS256=verifier=>createHash('sha256').update(verifier,'ascii').digest('base64url');

export function normalizeClients(clients=[]){
 const allowed=new Map();
 for(const {clientId,redirectUri} of clients){
  if(!CLIENT_ID.test(clientId||'')||typeof redirectUri!=='string'||allowed.has(clientId))deny('invalid_client_configuration',500);
  let uri;try{uri=new URL(redirectUri);}catch{deny('invalid_client_configuration',500);}
  if(uri.protocol!=='https:'||!uri.hostname.endsWith('.snowrealm.pet')||
    uri.username||uri.password||uri.hash||uri.search||uri.port||
    uri.pathname==='/'||uri.href!==redirectUri)deny('invalid_client_configuration',500);
  allowed.set(clientId,redirectUri);
 }
 return allowed;
}

/** Trusted backend-only authorization core. Caller MUST first verify Neon session,
 * explicit account-link consent, CSRF defenses, and rate limits. No HTTP routes
 * are provided here. This is not a finished OIDC provider or BFF. */
export function createOAuthCore({store,identityMapping,signer,clients=[],clock=Date.now}){
 if(!store||!identityMapping||typeof signer?.issuePlayerToken!=='function')deny('oauth_dependencies_unavailable',503);
 const allowed=normalizeClients(clients);
 const checkClient=(id,uri)=>{
  if(!allowed.has(id)||allowed.get(id)!==uri)deny('invalid_client_or_redirect');
 };
 return {
  async authorize({verifiedSubject,consentGranted,clientId,redirectUri,codeChallenge,state,nonce}){
   if(typeof verifiedSubject!=='string'||verifiedSubject.length<8||verifiedSubject.length>128)
    deny('login_required',401);
   if(consentGranted!==true)deny('consent_required',403);
   checkClient(clientId,redirectUri);
   if(!CHALLENGE.test(codeChallenge||'')||!STATE.test(state||'')||!STATE.test(nonce||''))
    deny('invalid_authorization_request');
   const playerId=await identityMapping.ensure(verifiedSubject);
   if(!UUID.test(playerId||''))deny('invalid_platform_identity',503);
   if((await store.isActive(playerId))!==true)deny('account_disabled',403);
   const code=randomBytes(32).toString('base64url');
   await store.saveCode({codeHash:hash(code),clientId,redirectUri,codeChallenge,
    playerId,stateHash:hash(state),nonceHash:hash(nonce),expiresAt:new Date(clock()+90000)});
   return {code,state,issuer:ISSUER,redirectUri};
  },
  async exchange({clientId,redirectUri,code,codeVerifier,state,nonce}){
   checkClient(clientId,redirectUri);
   if(!CODE.test(code||'')||!VERIFIER.test(codeVerifier||'')||
      typeof state!=='string'||!STATE.test(state)||typeof nonce!=='string'||!STATE.test(nonce))deny('invalid_grant');
   const playerId=await store.consumeCode({codeHash:hash(code),clientId,redirectUri,
    codeChallenge:pkceS256(codeVerifier),stateHash:hash(state),nonceHash:hash(nonce)});
   if(!UUID.test(playerId||''))deny('invalid_grant');
   if((await store.isActive(playerId))!==true)deny('account_disabled',403);
   // A compromised signer must NEVER mint tokens after its kid is revoked.
   const kid=signer.publicJwks?.().keys?.[0]?.kid;
   if(!kid||typeof store.canIssue!=='function'||(await store.canIssue(kid))!==true)
     deny('signing_key_revoked_or_unavailable',503);
   const accessToken=signer.issuePlayerToken({playerId,audience:PLAYER_AUDIENCE,
    scope:LINK_SCOPE,lifetimeSeconds:300});
   return {access_token:accessToken,token_type:'Bearer',expires_in:300,scope:LINK_SCOPE};
  }
 };
}
