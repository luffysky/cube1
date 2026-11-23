import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync} from 'node:crypto';
import {createIdentityAuthority} from '../../identity/authority.mjs';
import {createOAuthCore,normalizeClients,pkceS256} from '../../identity/oauth-core.mjs';
import {OAuthStore} from '../../identity/oauth-store.mjs';
const uuid='7c033f11-b127-4822-bebe-ef31e7e1645c';
const verifier='abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
const params={verifiedSubject:'neon-sub-verified-12345',consentGranted:true,
 clientId:'brickduel-bff',redirectUri:'https://brickduel.snowrealm.pet/api/auth/callback',
 state:'state-0123456789abcdefghijklmnopqrstuvwxyz',nonce:'nonce-0123456789abcdefghijklmnopqrstuvwxyz',
 codeChallenge:pkceS256(verifier)};
function makeHarness(){
 const records=new Map();let active=true,keyActive=true;
 const store={
  saveCode:async r=>{if(records.has(r.codeHash))throw Error('duplicate');records.set(r.codeHash,{...r,used:false});},
  consumeCode:async ({codeHash,clientId,redirectUri,codeChallenge,stateHash,nonceHash})=>{
   const r=records.get(codeHash);
   if(!r||r.used||r.clientId!==clientId||r.redirectUri!==redirectUri||r.codeChallenge!==codeChallenge||r.stateHash!==stateHash||r.nonceHash!==nonceHash)return null;
   r.used=true;return r.playerId;
  },
  isActive:async()=>active,
  canIssue:async()=>keyActive
 };
 const pair=generateKeyPairSync('ed25519');
 const signer=createIdentityAuthority({privateKeyPem:pair.privateKey.export({type:'pkcs8',format:'pem'}),
  kid:'identity-oauth-test-01'});
 const oauth=createOAuthCore({store,signer,identityMapping:{ensure:async()=>uuid},
  clients:[{clientId:params.clientId,redirectUri:params.redirectUri}]});
 return {oauth,records,setActive:value=>active=value,setKeyActive:value=>keyActive=value};
}
test('exact HTTPS callback registration rejects wildcard, query and duplicates',()=>{
 for(const redirectUri of ['https://evil.test/cb','https://brickduel.snowrealm.pet/cb?next=evil',
   'https://brickduel.snowrealm.pet/']){
  assert.throws(()=>normalizeClients([{clientId:'brickduel-bff',redirectUri}]),/invalid_client_configuration/);
 }
 assert.throws(()=>normalizeClients([{clientId:'brickduel-bff',redirectUri:params.redirectUri},
  {clientId:'brickduel-bff',redirectUri:params.redirectUri}]),/invalid_client_configuration/);
});
test('authorization requires verified subject, explicit consent and S256',async()=>{
 const {oauth}=makeHarness();
 await assert.rejects(oauth.authorize({...params,verifiedSubject:null}),/login_required/);
 await assert.rejects(oauth.authorize({...params,consentGranted:false}),/consent_required/);
 await assert.rejects(oauth.authorize({...params,codeChallenge:'plain'}),/invalid_authorization_request/);
 await assert.rejects(oauth.authorize({...params,redirectUri:'https://brickduel.snowrealm.pet/evil'}),/invalid_client_or_redirect/);
});
test('short code is bound to PKCE and redeemable only once',async()=>{
 const {oauth,records}=makeHarness();
 const auth=await oauth.authorize(params);
 assert.equal(auth.code.length,43);assert.equal(auth.state,params.state);
 await assert.rejects(oauth.exchange({state:params.state,nonce:params.nonce,clientId:params.clientId,redirectUri:params.redirectUri,
  code:auth.code,codeVerifier:verifier+'BAD'}),/invalid_grant/);
 await assert.rejects(oauth.exchange({...params,nonce:undefined,code:auth.code,codeVerifier:verifier}),/invalid_grant/);
 for (const field of ['state','nonce']) {
  await assert.rejects(oauth.exchange({
   ...params,code:auth.code,codeVerifier:verifier,[field]:'x'.repeat(43)
  }),/invalid_grant/);
 }
 const [record]=records.values();
 assert.equal(record.used,false);
 assert.equal(record.nonceHash,createHash('sha256').update(params.nonce).digest('hex'));
 assert.equal(JSON.stringify(record).includes(params.nonce),false);
 const grant=await oauth.exchange({state:params.state,nonce:params.nonce,clientId:params.clientId,redirectUri:params.redirectUri,
  code:auth.code,codeVerifier:verifier});
 assert.equal(grant.token_type,'Bearer');assert.equal(grant.expires_in,300);
 const claims=JSON.parse(Buffer.from(grant.access_token.split('.')[1],'base64url').toString());
 assert.equal(claims.nonce,params.nonce);
 assert.equal(claims.sub,uuid);assert.equal(claims.aud,'snowrealm:brickduel:api');
 await assert.rejects(oauth.exchange({state:params.state,nonce:params.nonce,clientId:params.clientId,redirectUri:params.redirectUri,
  code:auth.code,codeVerifier:verifier}),/invalid_grant/);
});
test('suspension blocks both issuance and pending code redemption',async()=>{
 const {oauth,setActive}=makeHarness();setActive(false);
 await assert.rejects(oauth.authorize(params),/account_disabled/);
 setActive(true);const auth=await oauth.authorize(params);setActive(false);
 await assert.rejects(oauth.exchange({state:params.state,nonce:params.nonce,clientId:params.clientId,redirectUri:params.redirectUri,
  code:auth.code,codeVerifier:verifier}),/account_disabled/);
});
test('persistent store parameterizes writes, locks code via UPDATE and checks revocation',async()=>{
 let consumed=false;
 const calls=[];
 const pool={query:async(sql,params=[])=>{
  calls.push({sql,params});
  if(sql.startsWith('UPDATE sr_identity_authorization_codes'))return {rows:consumed?[]:[{player_id:uuid}]};
  if(sql.includes('identity_exists'))return {rows:[{identity_exists:true,suspended:false,jti_revoked:false,kid_revoked:false,revoked_after:null}]};
  return {rows:[]};
 }};
 const store=new OAuthStore(pool);
 await store.saveCode({codeHash:'a'.repeat(64),clientId:'brickduel-bff',redirectUri:params.redirectUri,
  codeChallenge:params.codeChallenge,playerId:uuid,stateHash:'b'.repeat(64),nonceHash:'c'.repeat(64),expiresAt:new Date()});
 assert.equal(calls[0].params.length,8);
 assert.equal(await store.consumeCode({codeHash:'a'.repeat(64),clientId:'brickduel-bff',
  redirectUri:params.redirectUri,codeChallenge:params.codeChallenge}),uuid);
 consumed=true;
 assert.equal(await store.consumeCode({codeHash:'a'.repeat(64),clientId:'brickduel-bff',
  redirectUri:params.redirectUri,codeChallenge:params.codeChallenge}),null);
 assert.equal(await store.isTokenActive({playerId:uuid,jti:uuid,kid:'identity-oauth-test-01',issuedAt:100}),true);
 assert.equal(await store.isTokenActive({playerId:uuid,jti:uuid,kid:'identity-oauth-test-01'}),false);
});

test('revoked or unavailable active kid denies authorization code token issuance',async()=>{
 const {oauth,setKeyActive}=makeHarness();
 const grant=await oauth.authorize(params);
 setKeyActive(false);
 await assert.rejects(oauth.exchange({state:params.state,nonce:params.nonce,clientId:params.clientId,redirectUri:params.redirectUri,
  code:grant.code,codeVerifier:verifier}),/signing_key_revoked_or_unavailable/);
});
