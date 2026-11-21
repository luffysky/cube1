import { generateKeyPairSync, verify } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminAuthority } from '../../identity/admin-authority.mjs';

test('admin signer fixes scope and audience and stops issuing for revoked keys', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  let allowed = true;
  const authority = createAdminAuthority({
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    kid: 'admin-test-01', canIssue: async () => allowed,
  });
  const { token, jti } = await authority.issueAdminToken();
  const [header, payload, signature] = token.split('.');
  assert.ok(verify(null, Buffer.from(header + '.' + payload), publicKey, Buffer.from(signature, 'base64url')));
  const claims = JSON.parse(Buffer.from(payload, 'base64url'));
  assert.equal(claims.aud, 'snowrealm:brickduel:admin');
  assert.equal(claims.iss, 'https://identity.snowrealm.pet');
  assert.equal(claims.scope, 'brickduel:admin:read');
  assert.equal(claims.sub, 'svc:snowrealm-games-admin');
  assert.equal(claims.exp - claims.iat, 300);
  assert.equal(claims.nbf, claims.iat);
  assert.equal(claims.jti, jti);
  assert.equal(authority.publicJwks().keys[0].d, undefined);
  allowed = false;
  await assert.rejects(authority.issueAdminToken(), /admin_signing_unavailable/);
});

test('admin signer rejects invalid configuration and fails closed on revocation-store errors',async()=>{
 const pem=algorithm=>generateKeyPairSync(algorithm).privateKey.export({type:'pkcs8',format:'pem'});
 const privateKeyPem=pem('ed25519');
 const options={privateKeyPem,kid:'admin-test-02',canIssue:async()=>{throw Error('offline');}};
 for(const overrides of [{privateKeyPem:'invalid'},{privateKeyPem:pem('x25519')},{kid:undefined},{kid:'bad!kid'},{canIssue:undefined}]){
  assert.throws(()=>createAdminAuthority({...options,...overrides}),/admin_signing_unavailable/);
 }
 await assert.rejects(createAdminAuthority(options).issueAdminToken(),/admin_signing_unavailable/);
 const available={...options,canIssue:async()=>true};
 const boundary=createAdminAuthority({...available,clock:()=>1999});
 const {token}=await boundary.issueAdminToken();
 assert.equal(JSON.parse(Buffer.from(token.split('.')[1],'base64url')).iat,1);
 await assert.rejects(createAdminAuthority({...available,clock:()=>NaN}).issueAdminToken(),/admin_signing_unavailable/);
});

test('separate player key cannot verify an admin signature',async()=>{
 const admin=generateKeyPairSync('ed25519');
 const player=generateKeyPairSync('ed25519');
 const authority=createAdminAuthority({
  privateKeyPem:admin.privateKey.export({type:'pkcs8',format:'pem'}),
  kid:'admin-test-02',canIssue:async()=>true
 });
 const [header,payload,signature]=(await authority.issueAdminToken()).token.split('.');
 const input=Buffer.from(header+'.'+payload), bytes=Buffer.from(signature,'base64url');
 assert.equal(verify(null,input,player.publicKey,bytes),false);
 assert.equal(verify(null,input,admin.publicKey,bytes),true);
 assert.notEqual(authority.publicJwks().keys[0].x,player.publicKey.export({format:'jwk'}).x);
});
