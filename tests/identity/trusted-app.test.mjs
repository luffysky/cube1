import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {createIdentityAuthority} from '../../identity/authority.mjs';
import {createTrustedIdentityApp} from '../../identity/neon/trusted-app.mjs';
const kp=generateKeyPairSync('ed25519');
const authority=createIdentityAuthority({privateKeyPem:kp.privateKey.export({format:'pem',type:'pkcs8'}),kid:'test-entry-20261121'});
const base='https://identity.snowrealm.pet';
const secret='s'.repeat(48);
const app=createTrustedIdentityApp({
  authority,
  verifyToken:async token=>{if(token!=='verified')throw Error();return {playerId:'test-player'};},
  dbReady:async()=>true,clientSecret:secret
});
const req=(p,body,headers={})=>new Request(base+p,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('JWKS never includes private key',async()=>{
 const r=await app.fetch(new Request(base+'/.well-known/jwks.json'));
 assert.equal(r.status,200);assert.equal((await r.json()).keys[0].d,undefined);
});
test('client-supplied consent cannot enable authorization or token exchange',async()=>{
  const headers={origin:'https://games.snowrealm.pet',authorization:'Bearer verified-neon'};
  const authorize=await app.fetch(req('/oauth/authorize',{consent:true},headers));
  assert.equal(authorize.status,503);
  assert.equal((await authorize.json()).error,'authorization_unavailable');
  const exchange=await app.fetch(req('/oauth/token',{}, {'x-snowrealm-client-secret':'a'.repeat(48)}));
  assert.equal(exchange.status,503);
  const crossOrigin=await app.fetch(req('/oauth/authorize',{consent:true},{origin:'https://untrusted.invalid'}));
  assert.equal(crossOrigin.status,403);
});
test('revocation status only accepts valid signed token',async()=>{
 const status=(token,headers={})=>app.fetch(req('/v1/token/status',{},{
   authorization:'Bearer '+token,...headers
 }));
 const client={'x-snowrealm-client-secret':secret};
 let r=await status('verified');assert.equal(r.status,401);
 r=await status('verified',{'x-snowrealm-client-secret':'x'.repeat(48)});assert.equal(r.status,401);
 r=await status('verified',{...client,origin:'https://games.snowrealm.pet'});assert.equal(r.status,401);
 r=await status('verified',client);
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{active:true});
 r=await status('invalid',client);
 assert.equal(r.status,401);
});
test('readiness is measured, never equated with Brickduel BFF integration',async()=>{
 const r=await app.fetch(new Request(base+'/health/ready'));
 assert.equal(r.status,503);
 assert.deepEqual(await r.json(),{ready:false,databaseReady:true,brickduelBffReady:false});
});

test('Admin JWKS publishes only independently configured public keys and fails closed when absent',async()=>{
 const configure=adminPublicKeys=>createTrustedIdentityApp({authority,adminPublicKeys,verifyToken:async()=>false,dbReady:async()=>true});
 const request=()=>new Request(base+'/.well-known/admin-jwks.json');
 const player=authority.publicJwks().keys[0];
 const admin={...player,kid:'admin-test-20261121',x:generateKeyPairSync('ed25519').publicKey.export({format:'jwk'}).x};
 assert.equal((await app.fetch(request())).status,503);
 const configured=configure([admin]);
 const response=await configured.fetch(request());
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{keys:[admin]});
 assert.deepEqual(await (await configured.fetch(new Request(base+'/.well-known/jwks.json'))).json(),{keys:[player]});
 for(const key of [{...admin,kid:player.kid},{...admin,x:player.x},{...admin,d:'private'}]){
  assert.throws(()=>configure([key]));
 }
});

test('internal Admin signer requires a distinct service credential and denies browser requests', async()=>{
 let calls=0;
 const adminSecret='a'.repeat(48);
 const options={authority,verifyToken:async()=>false,dbReady:async()=>true,clientSecret:secret,
  issueAdminToken:async()=>{calls++;if(calls>1)throw Error('revoked');return {token:'synthetic'};}};
 const staging=createTrustedIdentityApp({...options,adminServiceSecret:adminSecret});
 const path='/internal/admin-token',header='x-snowrealm-admin-service-secret';
 assert.equal((await app.fetch(req(path,{}))).status,404);
 assert.equal((await staging.fetch(req(path,{}))).status,401);
 assert.equal((await staging.fetch(req(path,{}, {[header]:secret}))).status,401);
 assert.equal((await staging.fetch(req(path,{}, {[header]:adminSecret,origin:'https://games.snowrealm.pet'}))).status,401);
 assert.equal(calls,0);
 const response=await staging.fetch(req(path,{}, {[header]:adminSecret}));
 assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal((await staging.fetch(req(path,{}, {[header]:adminSecret}))).status,503);
 assert.throws(()=>createTrustedIdentityApp({...options,adminServiceSecret:secret}),/identity_service_secret_overlap/);
});

test('staging token HTTP exchange authenticates the BFF and forwards only its complete grant',async()=>{
 const grant={clientId:'brickduel-bff-staging',redirectUri:'https://brickduel-staging.snowrealm.pet/api/auth/callback',
  code:'fixture-code',codeVerifier:'fixture-verifier',state:'fixture-state',nonce:'fixture-nonce'};
 const seen=[];
 const app=createTrustedIdentityApp({authority,dbReady:async()=>true,verifyToken:async()=>false,clientSecret:secret,
  exchangeCode:async value=>{seen.push(value);return {token_type:'Bearer',expires_in:300};}});
 const headers={'x-snowrealm-client-secret':secret};
 const exchange=(body=grant,extra=headers)=>app.fetch(req('/oauth/token',body,extra));
 assert.equal((await exchange(grant,{})).status,401);
 assert.equal((await exchange(grant,{...headers,origin:'https://games.snowrealm.pet'})).status,401);
 assert.equal((await exchange({...grant,nonce:undefined})).status,400);
 assert.equal((await exchange({...grant,consent:true})).status,400);
 assert.equal((await exchange({...grant,code:'a'.repeat(4200)})).status,413);
 assert.deepEqual(seen,[]);
 const response=await exchange();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(seen,[grant]);
});
