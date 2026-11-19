import test from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_QUESTS, QUEST_LIMIT_COINS, getDailyQuest } from '../../server/api/quests.mjs';
import { createApp } from '../../server/api/app.mjs';

test('three ranked quests have bounded non-advertising reward budget',()=>{
 assert.deepEqual(DAILY_QUESTS.map(q=>[q.id,q.target,q.coins]),[
  ['ranked_play_1',1,10],['ranked_play_3',3,20],['ranked_win_1',1,20]
 ]);
 assert.equal(QUEST_LIMIT_COINS,50);
 assert.equal(getDailyQuest('not_real'),undefined);
});
test('unknown quest cannot generate money even with authenticated token',async()=>{
 let claims=0;
 const store={clock:Date.now,limit:async()=>{},ensureUser:async()=>{},claimDailyQuest:async()=>{claims++;}};
 const app=createApp({store,authenticate:async()=> 'player-0001'});
 const resp=await app.fetch(new Request('https://api.example/v1/quests/daily/claim',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'quest-test-unique-0001'},body:JSON.stringify({questId:'not_real',coins:99999})}));
 assert.equal(resp.status,400);
 assert.equal(claims,0);
});
test('quest endpoints use the server verified user id, never a browser supplied player id',async()=>{
 let user=null;
 const store={clock:Date.now,limit:async()=>{},ensureUser:async()=>{},dailyQuests:async(id)=>{user=id;return {date:'2026-11-20',quests:[]};}};
 const app=createApp({store,authenticate:async()=> 'verified-user'});
 const response=await app.fetch(new Request('https://api.example/v1/quests/daily',{headers:{Origin:'https://example.org'}}));
 assert.equal(response.status,200);
 assert.equal(user,'verified-user');
 assert.deepEqual((await response.json()).quests,[]);
});
