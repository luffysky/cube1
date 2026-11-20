import test from 'node:test';
import assert from 'node:assert/strict';
import { PlatformIdentityStore } from '../../server/api/platform-identity.mjs';
import { createApp } from '../../server/api/app.mjs';

test('platform registration retains one UUID across repeated and concurrent calls',async()=>{
 const records=new Map();
 const pool={query:async(sql,values=[])=>{
  if(sql.startsWith('INSERT INTO sr_platform_identities')){
    if(!records.has(values[0]))records.set(values[0],values[1]);
    return {rows:[],rowCount:1};
  }
  if(sql.startsWith('SELECT platform_player_id FROM sr_platform_identities')){
    return {rows:records.has(values[0])?[{platform_player_id:records.get(values[0])}]:[]};
  }
  throw Error('unexpected query');
 }};
 const store=new PlatformIdentityStore(pool),subject='neon-existing-user-1234';
 const ids=await Promise.all(Array.from({length:8},()=>store.ensure(subject)));
 assert.equal(new Set(ids).size,1);
 assert.match(ids[0],/^[0-9a-f]{8}-/);
 assert.equal(await store.find(subject),ids[0]);
 assert.equal(await store.find('other-player-45678'),null);
 assert.equal(records.size,1);
});

test('player ID requires verified authentication; empty request never creates an identity',async()=>{
 let created=0,reads=0;
 const identity={
  ensure:async()=>{created++;return '7c033f11-b127-4822-bebe-ef31e7e1645c';},
  find:async()=>{reads++;return null;}
 };
 const store={clock:Date.now,limit:async()=>{}};
 const app=createApp({store,authenticate:async req=>req.headers.get('authorization')==='Bearer legit'?'verified-player-sub':null,platformIdentity:identity});
 let response=await app.fetch(new Request('https://api.example/v1/identity/register',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}));
 assert.equal(response.status,401);assert.equal(created,0);
 response=await app.fetch(new Request('https://api.example/v1/identity/me',{headers:{authorization:'Bearer legit'}}));
 assert.equal(response.status,200);
 assert.equal((await response.json()).readyForBrickduel,false);
 assert.equal(reads,1);assert.equal(created,0);
 response=await app.fetch(new Request('https://api.example/v1/identity/register',{method:'POST',headers:{authorization:'Bearer legit','content-type':'application/json'},body:'{}'}));
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.readyForBrickduel,false);
 assert.equal(created,1);
});

test('platform identities validate source subjects and never take email as the primary key',async()=>{
 const store=new PlatformIdentityStore({query:async()=>{throw Error('should not query');}});
 await assert.rejects(store.ensure('tiny'),/invalid_identity_subject/);
 await assert.rejects(store.find('invalid\nsubject'),/invalid_identity_subject/);
});
