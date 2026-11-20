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
