import test from 'node:test';
import assert from 'node:assert/strict';
import {testPool} from './pglite-helper.mjs';
import {createApp} from '../../server/api/app.mjs';
import {GamesOwnerStore} from '../../server/api/games-owner.mjs';
import {AdminStore} from '../../server/api/admin.mjs';

const owner='owner-test-id', operator='operator-test-id', player='player-test-id';
const secret='t'.repeat(48);

test('Games operators share operational permissions while the owner controls private notes',async()=>{
 const calls=[];
 const app=createApp({
  store:{limit:async()=>{}},
  authenticate:async request=>request.headers.get('x-test-actor'),
  ownerSubject:owner,adminSubjects:operator,ownerGatewaySecret:secret,
  ownerStore:{apply:async(...args)=>{calls.push(args);return {ok:true};},
   audit:async privateNotes=>({privateNotes})}
 });
 const send=(actor,gateway,body,path='coins')=>app.fetch(new Request('https://api.example/v1/admin/owner/'+path,{
  method:body?'POST':'GET',
  headers:{'content-type':'application/json','idempotency-key':'request-1234',
   'x-snowrealm-owner-gateway':gateway,'x-test-actor':actor},
  body:body&&JSON.stringify(body)
 }));
 const gift={targetId:player,delta:100};
 assert.equal((await send(player,secret,gift)).status,403);
 assert.equal((await send(owner,'wrong',gift)).status,403);
 assert.equal((await send(operator,secret,{...gift,note:'internal'})).status,403);
 assert.equal((await send(operator,secret,{...gift,targetId:owner})).status,403);
 assert.equal((await send(operator,secret,gift)).status,200);
 assert.equal((await send(owner,secret,{...gift,reason:'Activity bonus',note:'Internal'})).status,200);
 assert.deepEqual(await (await send(operator,secret,null,'audit')).json(),{privateNotes:false});
 assert.deepEqual(await (await send(owner,secret,null,'audit')).json(),{privateNotes:true});
 assert.equal(calls.length,2);
});

test('Games owner writes preserve audit privacy, rollback and idempotency',async()=>{
 const pool=await testPool({ownerOperations:true});
 const ops=new GamesOwnerStore(pool);
 try{
  const opponent='second-test-id', matchId='375c330c-e7c4-404c-8ca1-8c55931cac74';
  await pool.query('INSERT INTO sr_profiles(user_id,nickname,friend_code) VALUES ($1,$2,$3),($4,$5,$6)',
   [player,'Player','AAAAAAAAAAAA',opponent,'Other','BBBBBBBBBBBB']);
  await pool.query('INSERT INTO sr_wallets(user_id,balance) VALUES($1,10)',[player]);
  const gift={targetId:player,delta:50,reason:'Activity bonus',note:'Private campaign note'};
  assert.equal((await ops.apply(owner,'gift-0001','coins',gift)).balance,60);
  assert.equal((await ops.apply(owner,'gift-0001','coins',gift)).balance,60);
  await assert.rejects(ops.apply(owner,'gift-0001','coins',{...gift,delta:51}),{code:'idempotency_conflict'});
  await assert.rejects(ops.apply(owner,'debit-0001','coins',{targetId:player,delta:-61}),{code:'insufficient_coins'});
  assert.equal((await ops.apply(owner,'debit-0002','coins',{targetId:player,delta:-20})).balance,40);
  await ops.apply(owner,'suspend-0001','suspension',{targetId:player,suspended:true});
  assert.equal((await ops.suspendStatus(player)).suspended,true);
  await ops.apply(owner,'restore-0001','suspension',{targetId:player,suspended:false});
  assert.equal((await ops.suspendStatus(player)).suspended,false);
  await pool.query(`INSERT INTO sr_ranked_matches(id,player_one,player_two,status,snapshot,
   started_at,heartbeat_one,heartbeat_two,result) VALUES($1,$2,$3,'ended','{}',now(),now(),now(),'{"winnerId":null}')`,
   [matchId,player,opponent]);
  await ops.apply(owner,'match-0001','match-correction',{targetId:matchId,outcome:'player-one',reason:'Reviewed'});
  const notices=(await ops.playerNotices(player)).items;
  assert.equal(notices.length,5);
  assert.ok(notices.some(row=>row.reason==='Activity bonus'));
  assert.ok(notices.some(row=>row.change.outcome==='player-one'));
  assert.equal((await ops.playerNotices(opponent)).items.length,1);
  assert.doesNotMatch(JSON.stringify(notices),/Private campaign note/);
  assert.doesNotMatch(JSON.stringify(await ops.audit(false)),/Private campaign note/);
  assert.ok((await ops.audit(false)).items.some(row=>row.actorId===owner));
  assert.match(JSON.stringify(await ops.audit(true)),/Private campaign note/);
  const rows=(await pool.query('SELECT result FROM sr_ranked_matches WHERE id=$1',[matchId])).rows;
  assert.equal(rows[0].result.winnerId,null);
 }finally{await pool.end();}
});

test('homepage entry returns the configured path only to verified Games managers',async()=>{
 const path='/srg-console-'+'x'.repeat(24)+'/';
 const makeApp=adminEntryPath=>createApp({
  store:{limit:async()=>{}},
  authenticate:async request=>request.headers.get('x-test-actor'),
  ownerSubject:owner,adminSubjects:operator,adminEntryPath
 });
 const request=(app,actor)=>app.fetch(new Request('https://api.example/v1/admin/entry',{
  headers:actor?{'x-test-actor':actor}:{}
 }));
 const app=makeApp(path);
 for(const actor of [owner,operator]){
  const response=await request(app,actor);
  assert.equal(response.status,200);
  assert.match(response.headers.get('cache-control'),/no-store/);
  assert.deepEqual(await response.json(),{path});
 }
 assert.equal((await request(app,player)).status,403);
 assert.equal((await request(app,null)).status,401);
 assert.equal((await request(makeApp('//other.example/'),owner)).status,503);
});

test('player details require manager authorization and preserve unlinked and zero values',async()=>{
 const pool=await testPool({platformIdentity:true});
 try{
  await pool.query('INSERT INTO sr_profiles(user_id,nickname,friend_code) VALUES ($1,$2,$3)',[player,'Test Player','ABCD23456789']);
  await pool.query('INSERT INTO sr_wallets(user_id,balance) VALUES ($1,0)',[player]);
  const app=createApp({store:{limit:async()=>{}},adminStore:new AdminStore(pool),
   authenticate:async request=>request.headers.get('x-test-actor'),ownerSubject:owner,adminSubjects:operator});
  const fetchWallets=(actor,method='GET')=>app.fetch(new Request('https://api.example/v1/admin/wallets',{
   method,headers:actor?{'x-test-actor':actor}:{}
  }));
  assert.equal((await fetchWallets(null)).status,401);
  assert.equal((await fetchWallets(player)).status,403);
  assert.equal((await fetchWallets(owner,'POST')).status,405);
  const wallets=await (await fetchWallets(operator)).json();
  assert.equal(wallets.scope,'cube1');
  assert.equal(wallets.items[0].playerId,player);
  assert.equal(wallets.items[0].balance,'0');
  const fetchPlayer=(actor,id=player)=>app.fetch(new Request('https://api.example/v1/admin/players/'+id,{
   headers:actor?{'x-test-actor':actor}:{}
  }));
  assert.equal((await fetchPlayer(null)).status,401);
  assert.equal((await fetchPlayer(player)).status,403);
  assert.equal((await fetchPlayer(owner,'unknown-player')).status,404);
  const response=await fetchPlayer(operator);
  assert.equal(response.status,200);
  const {profile,ledger,matches}=await response.json();
  assert.equal(profile.platformPlayerId,null);
  assert.equal(profile.coins,'0');
  assert.equal(profile.nickname,'Test Player');
  assert.deepEqual(ledger,[]);
  assert.deepEqual(matches,[]);
 }finally{await pool.end();}
});
