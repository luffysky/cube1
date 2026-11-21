import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readdir} from 'node:fs/promises';

test('the standalone admin build exposes only allowlisted assets behind Access',async()=>{
 const directory=new URL('../../internal/admin-console/',import.meta.url);
 execFileSync(process.execPath,['build.mjs'],{cwd:directory});
 const {default:worker}=await import(new URL('build/worker.mjs',directory));
 assert.deepEqual((await readdir(new URL('build/assets/',directory))).sort(),
  ['admin.css','admin.mjs','index.html','realm-mark.svg']);
 const entry='/srg-console-test-only-abcdefghijklmnop/';
 const env={ACCESS_ISSUER:'https://example.cloudflareaccess.com',ACCESS_AUDIENCE:'test-aud',
  ADMIN_ENTRY_PATH:entry,ASSETS:{fetch(){throw Error('unauthorized asset fetch');}}};
 for(const path of [entry,entry+'admin.mjs',entry+'admin.css',entry+'v1/admin/overview','/admin.mjs']){
  const response=await worker.fetch(new Request('https://games.snowrealm.pet'+path),env);
  assert.equal(response.status,403);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
 }
 const malformed=await worker.fetch(new Request('https://games.snowrealm.pet'+entry,{
  headers:{'cf-access-jwt-assertion':'not-a-jwt'}
 }),env);
 assert.equal(malformed.status,403);
});
