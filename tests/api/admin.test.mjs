import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../server/api/app.mjs';
import { adminAllowlist, AdminStore } from '../../server/api/admin.mjs';

test('admin allowlist is deny-by-default and rejects malformed subjects',()=>{
 assert.equal(adminAllowlist('').size,0);
 assert.deepEqual([...adminAllowlist('valid-user-id, , !evil, another-unique-sub')],['valid-user-id','another-unique-sub']);
});

test('unauthorized logged-in players receive 403 without invoking any management or profile queries',async()=>{
 let ensured=0,adminReads=0;
 const store={clock:Date.now,ensureUser:()=>{ensured++;},limit:async()=>{},};
 const app=createApp({store,authenticate:async()=> 'unlisted-player-id',
  adminSubjects:'approved-player-id',
  adminStore:{overview:async()=>{adminReads++;return {players:3};}},
  allowedOrigins:['https://games.snowrealm.pet']});
 const request=new Request('https://api.example/v1/admin/overview',{headers:{origin:'https://games.snowrealm.pet'}});
 const response=await app.fetch(request);
 assert.equal(response.status,403);assert.equal((await response.json()).error.code,'forbidden');
 assert.equal(adminReads,0);assert.equal(ensured,0);
 assert.equal(response.headers.get('access-control-allow-origin'),'https://games.snowrealm.pet');
});

test('approved admin can view data only by GET and without creating a player profile',async()=>{
 let ensured=0,limited=0;
 const store={clock:Date.now,ensureUser:()=>{ensured++;},limit:async()=>{limited++;}};
 const app=createApp({store,authenticate:async()=> 'approved-player-id',
  adminSubjects:'approved-player-id',adminStore:{overview:async()=>({players:1,readOnly:true})},
  allowedOrigins:['https://games.snowrealm.pet']});
 const url='https://api.example/v1/admin/overview';
 const get=await app.fetch(new Request(url));assert.equal(get.status,200);assert.equal((await get.json()).readOnly,true);
 const post=await app.fetch(new Request(url,{method:'POST'}));assert.equal(post.status,405);
 assert.equal(ensured,0);assert.equal(limited,2);
});

test('unknown admin routes reject, and missing allowlist never leaks backend availability',async()=>{
 const store={clock:Date.now,limit:async()=>{}};
 const make=(subjects,adminStore)=>createApp({store,authenticate:async()=> 'approved-player-id',adminSubjects:subjects,adminStore});
 const forbidden=await make('',null).fetch(new Request('https://api.example/v1/admin/overview'));
 assert.equal(forbidden.status,403);
 const unavailable=await make('approved-player-id',null).fetch(new Request('https://api.example/v1/admin/overview'));
 assert.equal(unavailable.status,503);
 const missing=await make('approved-player-id',{overview:async()=>({})}).fetch(new Request('https://api.example/v1/admin/other'));
 assert.equal(missing.status,404);
});

test('admin store only returns bounded, preselected data without password or email queries',async()=>{
 const sql=[];
 const pool={query:async(statement,values=[])=>{
   sql.push({statement,values});
   if(statement.includes('coalesce(sum(balance)'))return {rows:[{n:1,balance:'200'}]};
   if(statement.includes('ranked_matches')&&!statement.includes('ORDER BY'))return {rows:[{total:2,running:1}]};
   if(statement.includes('FROM sr_profiles')&&!statement.includes('ORDER BY'))return {rows:[{n:3}]};
   if(statement.includes('FROM sr_ranked_queue'))return {rows:[{n:1}]};
   if(statement.includes('FROM sr_rank_settlements'))return {rows:[{n:2}]};
   return {rows:[]};
 }};
 const admin=new AdminStore(pool);
 const o=await admin.overview();
 assert.deepEqual([o.players,o.outstandingCoins,o.rankedMatches,o.readOnly],[3,'200',2,true]);
 await admin.players(999);await admin.ledger(999);await admin.matches(999);
 assert.equal(sql.filter(x=>x.values.length).length,3);
 assert.ok(sql.filter(x=>x.values.length).every(x=>x.values[0]===50));
 assert.ok(sql.every(x=>!/password|neon_auth|session_token/i.test(x.statement)));
});
