import test from 'node:test';
import assert from 'node:assert/strict';
import {testPool} from './pglite-helper.mjs';
import {createApp} from '../../server/api/app.mjs';
import {GamesOwnerStore} from '../../server/api/games-owner.mjs';

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
  assert.match(JSON.stringify(await ops.audit(true)),/Private campaign note/);
  const rows=(await pool.query('SELECT result FROM sr_ranked_matches WHERE id=$1',[matchId])).rows;
  assert.equal(rows[0].result.winnerId,null);
 }finally{await pool.end();}
});
