import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {OAuthStore} from '../../identity/oauth-store.mjs';
import {identityDatabaseReady} from '../../identity/neon/database-readiness.mjs';
import {PlatformIdentityStore} from '../../server/api/platform-identity.mjs';
const require=createRequire(new URL('../../server/api/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const uuid='7c033f11-b127-4822-bebe-ef31e7e1645c';
const jti='f37193eb-e9f1-4524-bb74-e4df9ba3a521';
const code={codeHash:'a'.repeat(64),clientId:'brickduel-bff',
 redirectUri:'https://brickduel.snowrealm.pet/api/auth/callback',
 codeChallenge:'b'.repeat(43),playerId:uuid,stateHash:'c'.repeat(64),
 nonceHash:'d'.repeat(64),expiresAt:new Date(Date.now()+60000)};
test('004: actual Postgres schema supports one-time PKCE code and fail-closed revocation',async()=>{
 const db=new PGlite();
 try{
  for(const file of ['003_platform_identity.sql','004_identity_authorization.sql']){
   await db.exec(await readFile(new URL('../../server/migrations/'+file,import.meta.url),'utf8'));
  }
  const pool={query:(text,params)=>db.query(text,params)};
  const store=new OAuthStore(pool);
  await db.query('INSERT INTO sr_platform_identities(neon_subject,platform_player_id) VALUES($1,$2)',
   ['verified-neon-test-user',uuid]);
  assert.equal(await store.isActive(uuid),true);
  await store.saveCode(code);
  const values={codeHash:code.codeHash,clientId:code.clientId,redirectUri:code.redirectUri,
   codeChallenge:code.codeChallenge};
  assert.equal(await store.consumeCode({...values,codeChallenge:'x'.repeat(43)}),null);
  assert.equal(await store.consumeCode(values),uuid);
  assert.equal(await store.consumeCode(values),null,'replay must fail');
  assert.equal(await store.canIssue('test-kid-000001'),true);
  assert.equal(await store.isTokenActive({playerId:uuid,jti,kid:'test-kid-000001',issuedAt:Math.floor(Date.now()/1000)}),true);
  await db.query('INSERT INTO sr_identity_revoked_jti(jti,player_id,reason_code) VALUES ($1,$2,$3)',
   [jti,uuid,'test_revoke']);
  assert.equal(await store.isTokenActive({playerId:uuid,jti,kid:'test-kid-000001',issuedAt:Math.floor(Date.now()/1000)}),false);
  await db.query('UPDATE sr_identity_account_status SET suspended=true WHERE player_id=$1',[uuid]);
  await db.query('INSERT INTO sr_identity_account_status(player_id,suspended) VALUES($1,true) ON CONFLICT(player_id) DO UPDATE SET suspended=true',[uuid]);
  assert.equal(await store.isActive(uuid),false);
  await db.query('INSERT INTO sr_identity_revoked_kids(kid,reason_code) VALUES ($1,$2)', ['test-kid-000001','key_retired']);
  assert.equal(await store.canIssue('test-kid-000001'),false);
  const flags=await db.query("SELECT relname,relrowsecurity FROM pg_class WHERE relname LIKE 'sr_identity_%' AND relkind='r'");
  assert.equal(flags.rows.length,4);
  assert.ok(flags.rows.every(row=>row.relrowsecurity===true));
  const count=await db.query('SELECT COUNT(*)::int AS c FROM sr_platform_identities');
  assert.equal(count.rows[0].c,1);
 } finally {await db.close();}
});

test('Identity runtime consumes codes under RLS and cannot modify revocations or game wallets', async () => {
 const db = new PGlite();
 try {
  for (const file of ['server/migrations/003_platform_identity.sql',
    'server/migrations/004_identity_authorization.sql', 'identity/neon/sql/runtime-role.sql']) {
   await db.exec(await readFile(new URL('../../' + file, import.meta.url), 'utf8'));
  }
  await db.exec('CREATE TABLE sr_wallets (balance integer)');
  const store = new OAuthStore(db);
  const kid = 'test-kid-000001';
  assert.equal(await identityDatabaseReady(db, store, kid), false, 'rejects the table owner');
  await db.exec('SET ROLE sr_identity_runtime');
  assert.equal(await identityDatabaseReady(db, store, kid), true);
  const playerId = await new PlatformIdentityStore(db).ensure('verified-neon-test-user');
  const issuedCode = {...code, playerId, expiresAt: new Date(Date.now() + 60000)};
  await store.saveCode(issuedCode);
  assert.equal(await store.consumeCode(issuedCode), playerId);
  assert.equal(await store.consumeCode(issuedCode), null);
  await assert.rejects(db.query('DELETE FROM sr_identity_authorization_codes'), {code: '42501'});
  await assert.rejects(db.query("INSERT INTO sr_identity_revoked_kids VALUES ('test-kid-000001', now(), 'retired')"), {code: '42501'});
  await assert.rejects(db.query('SELECT balance FROM sr_wallets'), {code: '42501'});
  await db.exec("RESET ROLE; INSERT INTO sr_identity_revoked_kids VALUES ('test-kid-000001', now(), 'retired'); SET ROLE sr_identity_runtime");
  assert.equal(await identityDatabaseReady(db, store, kid), false, 'rejects revoked signing key');
 } finally {
  await db.close();
 }
});
