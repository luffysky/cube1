import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {createPublicHandler} from '../../identity/neon/public-index.mjs';
const pair=generateKeyPairSync('ed25519');
const app=createPublicHandler({
  privateKeyBase64:pair.privateKey.export({format:'der',type:'pkcs8'}).toString('base64'),
  kid:'test-jwks-20261121'
});
test('public live JWKS endpoint returns Ed25519 public key only',async()=>{
 const r=await app.fetch(new Request('https://identity.snowrealm.pet/.well-known/jwks.json'));
 assert.equal(r.status,200);const j=await r.json();
 assert.equal(j.keys.length,1);assert.equal(j.keys[0].crv,'Ed25519');
 assert.equal(j.keys[0].alg,'EdDSA');assert.equal(j.keys[0].kid,'test-jwks-20261121');
 assert.equal(j.keys[0].d,undefined);assert.match(r.headers.get('cache-control'),/max-age=60/);
});
test('live route does not falsely claim auth; readiness is 503',async()=>{
 let r=await app.fetch(new Request('https://identity.snowrealm.pet/health/live'));
 assert.equal(r.status,200);assert.equal((await r.json()).authorizationAvailable,false);
 r=await app.fetch(new Request('https://identity.snowrealm.pet/health/ready'));
 assert.equal(r.status,503);assert.equal((await r.json()).ready,false);
});
test('authorization, token, admin and metadata routes all return 404',async()=>{
 for(const path of ['/oauth/authorize','/oauth/token','/api/admin','/.well-known/openid-configuration']){
 const r=await app.fetch(new Request('https://identity.snowrealm.pet'+path,{method:'POST'}));
 assert.equal(r.status,404);
 }
});
test('no signing key fails closed rather than returning a JWKS placeholder',()=>{
 assert.throws(()=>createPublicHandler({privateKeyBase64:'',kid:'kid-12345678'}),/configuration_missing/);
 assert.throws(()=>createPublicHandler({privateKeyBase64:'A'.repeat(100),kid:'kid-12345678'}),/configuration_invalid/);
});
