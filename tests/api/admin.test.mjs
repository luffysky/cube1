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

test('admin trends are gated by the same explicit allowlist and remain read-only',async()=>{
 let called=0;
 const store={clock:Date.now,limit:async()=>{}};
 const trends=async()=>{called++;return {scope:'cube1',readOnly:true,days:7,items:[]};};
 const make=id=>createApp({store,authenticate:async()=>id,
   adminSubjects:'approved-player-id',adminStore:{trends}});
 const denied=await make('ordinary-player-id').fetch(new Request('https://api.test/v1/admin/trends'));
 assert.equal(denied.status,403);assert.equal(called,0);
 const allowed=await make('approved-player-id').fetch(new Request('https://api.test/v1/admin/trends'));
 assert.equal(allowed.status,200);
 assert.equal((await allowed.json()).readOnly,true);assert.equal(called,1);
 const writing=await make('approved-player-id').fetch(new Request('https://api.test/v1/admin/trends',{method:'POST'}));
 assert.equal(writing.status,405);assert.equal(called,1);
});
test('seven-day admin trends are UTC-aligned, sparse days become zeros and queries never touch credentials',async()=>{
 const statements=[];
 const pool={query:async(statement)=>{
  statements.push(statement);
  if(statement.includes('FROM sr_profiles'))return {rows:[{day:'2026-11-20',amount:2}]};
  if(statement.includes('FROM sr_ranked_matches'))return {rows:[{day:'2026-11-20',amount:3}]};
  if(statement.includes('FROM sr_wallet_ledger'))return {rows:[{day:'2026-11-20',earned:'100',spent:'35'}]};
  throw Error('unexpected query');
 }};
 const original=globalThis.Date;
 const fixed=new Date('2026-11-20T12:00:00Z');
 class FixedDate extends Date{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed.getTime();}}
 globalThis.Date=FixedDate;
 try{
  const data=await new AdminStore(pool).trends();
  assert.equal(data.scope,'cube1');assert.equal(data.readOnly,true);
  assert.equal(data.timezone,'UTC');assert.equal(data.items.length,7);
  assert.equal(data.items[0].day,'2026-11-14');
  assert.deepEqual(data.items[0],{day:'2026-11-14',newPlayers:0,rankedMatches:0,coinsEarned:'0',coinsSpent:'0'});
  assert.deepEqual(data.items.at(-1),{day:'2026-11-20',newPlayers:2,rankedMatches:3,coinsEarned:'100',coinsSpent:'35'});
  assert.equal(statements.length,3);
  assert.ok(statements.every(q=>!/(neon_auth|password|session_token|delete|update|truncate)/i.test(q)));
  assert.ok(statements.every(q=>q.includes("AT TIME ZONE 'UTC'")));
 }finally{globalThis.Date=original;}
});
