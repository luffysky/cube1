import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {createIdentityAuthority} from '../../identity/authority.mjs';
import {createTrustedIdentityApp} from '../../identity/neon/trusted-app.mjs';
const kp=generateKeyPairSync('ed25519');
const authority=createIdentityAuthority({privateKeyPem:kp.privateKey.export({format:'pem',type:'pkcs8'}),kid:'test-entry-20261121'});
const callback='https://brickduel.snowrealm.pet/api/auth/callback';
const base='https://identity.snowrealm.pet';
const clientSecret='a'.repeat(48);
const fakeOauth={
  authorize:async()=>({code:'c'.repeat(43),state:'state-'+('x'.repeat(40)),redirectUri:callback}),
  exchange:async()=>({access_token:'signed-token',token_type:'Bearer',expires_in:300})
};
const app=createTrustedIdentityApp({
  authority,authenticate:async request=>request.headers.get('authorization')==='Bearer verified-neon'?'neon-player-test-123':null,
  oauth:fakeOauth,verifyToken:async token=>{if(token!=='verified')throw Error();return {playerId:'test-player'};},
  dbReady:async()=>true,clientSecret
});
const req=(p,body,headers={})=>new Request(base+p,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('JWKS never includes private key',async()=>{
 const r=await app.fetch(new Request(base+'/.well-known/jwks.json'));
 assert.equal(r.status,200);assert.equal((await r.json()).keys[0].d,undefined);
});
test('authorization requires signed Neon identity, exact origin and explicit consent',async()=>{
 const body={consent:true,clientId:'brickduel-bff',redirectUri:callback,codeChallenge:'a'.repeat(43),state:'b'.repeat(43),nonce:'c'.repeat(43)};
 let r=await app.fetch(req('/oauth/authorize',body));
 assert.equal(r.status,401);
 r=await app.fetch(req('/oauth/authorize',body,{origin:'https://evil.invalid',authorization:'Bearer verified-neon'}));
 assert.equal(r.status,403);
 r=await app.fetch(req('/oauth/authorize',{...body,consent:false},{origin:'https://games.snowrealm.pet',authorization:'Bearer verified-neon'}));
 assert.equal(r.status,403);
 r=await app.fetch(req('/oauth/authorize',body,{origin:'https://games.snowrealm.pet',authorization:'Bearer verified-neon'}));
 assert.equal(r.status,200);assert.equal((await r.json()).redirectUri,callback);
});
test('token exchange requires confidential BFF client secret',async()=>{
 const data={clientId:'brickduel-bff',redirectUri:callback,code:'x'.repeat(43),codeVerifier:'v'.repeat(50)};
 let r=await app.fetch(req('/oauth/token',data));assert.equal(r.status,401);
 r=await app.fetch(req('/oauth/token',data,{'x-snowrealm-client-secret':'bad'}));assert.equal(r.status,401);
 r=await app.fetch(req('/oauth/token',data,{'x-snowrealm-client-secret':clientSecret}));
 assert.equal(r.status,200);assert.equal((await r.json()).expires_in,300);
});
test('revocation status only accepts valid signed token',async()=>{
 let r=await app.fetch(new Request(base+'/v1/token/status',{method:'POST'}));assert.equal(r.status,401);
 r=await app.fetch(new Request(base+'/v1/token/status',{method:'POST',headers:{authorization:'Bearer verified'}}));
 assert.equal(r.status,200);assert.equal((await r.json()).active,true);
 r=await app.fetch(new Request(base+'/v1/token/status',{method:'POST',headers:{authorization:'Bearer invalid'}}));
 assert.equal(r.status,401);
});
test('readiness is measured, never equated with Brickduel BFF integration',async()=>{
 const r=await app.fetch(new Request(base+'/health/ready'));
 assert.equal(r.status,200);assert.equal((await r.json()).brickduelBffReady,false);
});
