import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  createIdentityAuthority, verifyBrickduelLinkToken,
  ISSUER, PLAYER_AUDIENCE, LINK_SCOPE
} from '../../identity/authority.mjs';
import { createPublicIdentityApp } from '../../identity/app.mjs';

const playerId = '7c033f11-b127-4822-bebe-ef31e7e1645c';
const now = Date.UTC(2026,10,20,12);
const key1 = generateKeyPairSync('ed25519');
const key2 = generateKeyPairSync('ed25519');
function signer(pair,kid,extra={}) {
  return createIdentityAuthority({
    privateKeyPem: pair.privateKey.export({type:'pkcs8',format:'pem'}),
    kid,clock:()=>now,...extra
  });
}
const authority = signer(key1,'identity-test-key-01');
const issue = (server=authority,fields={}) => server.issuePlayerToken({
  playerId,audience:PLAYER_AUDIENCE,scope:LINK_SCOPE,...fields
});
const verify = (token,opts={}) => verifyBrickduelLinkToken(token,{
  jwks:authority.publicJwks(),checkStatus:async()=>true,
  clock:()=>now,...opts
});
function mutate(token,index,value) {
  const parts = token.split('.');
  parts[index] = Buffer.from(JSON.stringify(value)).toString('base64url');
  return parts.join('.');
}

test('public JWKS exports only Ed25519 signing keys without private d',()=>{
  const keys=authority.publicJwks().keys;
  assert.equal(keys.length,1);
  assert.equal(keys[0].kty,'OKP');
  assert.equal(keys[0].crv,'Ed25519');
  assert.equal(keys[0].alg,'EdDSA');
  assert.equal(keys[0].d,undefined);
});

test('short-lived signed JWT contains platform UUID and unique jti',async()=>{
  const first=issue(),second=issue();
  const payload=JSON.parse(Buffer.from(first.split('.')[1],'base64url'));
  const next=JSON.parse(Buffer.from(second.split('.')[1],'base64url'));
  assert.equal(payload.iss,ISSUER);
  assert.equal(payload.sub,playerId);
  assert.equal(payload.exp-payload.iat,300);
  assert.notEqual(payload.jti,next.jti);
  assert.equal((await verify(first)).playerId,playerId);
});

test('signer refuses another audience, admin scope, Neon subject, and long lifetime',()=>{
  assert.throws(()=>issue(authority,{audience:'snowrealm:spinrealm:api'}),/unsupported_purpose/);
  assert.throws(()=>issue(authority,{scope:'brickduel:admin:read'}),/unsupported_purpose/);
  assert.throws(()=>issue(authority,{playerId:'neon-user-123456'}),/invalid_platform_uuid/);
  assert.throws(()=>issue(authority,{lifetimeSeconds:601}),/invalid_lifetime/);
});

test('verifier rejects algorithm downgrade, untrusted kid, payload tampering',async()=>{
  const token=issue();
  const [header,payload]=token.split('.').map(p=>JSON.parse(Buffer.from(p,'base64url')));
  await assert.rejects(verify(mutate(token,0,{...header,alg:'none'})),/invalid_algorithm/);
  await assert.rejects(verify(mutate(token,0,{...header,kid:'untrusted-key-11'})),/unknown_kid/);
  await assert.rejects(verify(mutate(token,1,{...payload,aud:'other'})),/invalid_signature/);
  await assert.rejects(verify(token.slice(0,-1)+'!'),/invalid_token/);
});

test('expiry and future issued-at cannot evade bounded skew',async()=>{
  const token=issue();
  await assert.rejects(verify(token,{clock:()=>now+361000}),/invalid_time/);
  await assert.rejects(verify(token,{clock:()=>now-61000}),/invalid_time/);
});

test('high-risk verification fails closed on revoked, absent or broken status',async()=>{
  const token=issue();
  await assert.rejects(verify(token,{checkStatus:undefined}),/status_unavailable/);
  await assert.rejects(verify(token,{checkStatus:async()=>false}),/revoked_or_suspended/);
  await assert.rejects(verify(token,{checkStatus:async()=>{throw Error('offline');}}),/status_unavailable/);
});

test('key rotation publishes both keys; duplicate kid and private JWK are rejected',async()=>{
  const next=signer(key2,'identity-test-key-02',{previousPublicJwks:authority.publicJwks().keys});
  const jwks=next.publicJwks();
  assert.equal(jwks.keys.length,2);
  assert.equal((await verify(issue(),{jwks})).playerId,playerId);
  assert.equal((await verify(issue(next),{jwks})).playerId,playerId);
  assert.throws(()=>signer(key2,'identity-test-key-02',{previousPublicJwks:[jwks.keys[0]]}),/duplicate_kid/);
  assert.throws(()=>signer(key2,'identity-test-key-03',{previousPublicJwks:[{...jwks.keys[1],d:'not-public'}]}),/invalid_jwk/);
});

test('no public login or token minting endpoint; readiness is fail closed',async()=>{
  const app=createPublicIdentityApp(authority);
  let r=await app.fetch(new Request(ISSUER+'/.well-known/jwks.json'));
  assert.equal(r.status,200);
  assert.equal((await r.json()).keys[0].d,undefined);
  r=await app.fetch(new Request(ISSUER+'/health/ready'));
  assert.equal(r.status,503);
  r=await app.fetch(new Request(ISSUER+'/oauth/token',{method:'POST'}));
  assert.equal(r.status,404);
  r=await app.fetch(new Request(ISSUER+'/health/live'));
  assert.equal((await r.json()).authorizationAvailable,false);
});
