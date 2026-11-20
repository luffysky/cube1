import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createApp } from '../../server/api/app.mjs';
import { checkAdapterSignature, adsEnabled, validateAdapterEvent, rewardedAdsConfig } from '../../server/api/rewarded-ads.mjs';

const secret='test-only-adapter-secret-of-more-than-32-chars';
function signed(raw,now=Date.now()){
 const ts=Math.floor(now/1000);
 return 't='+ts+',v1='+createHmac('sha256',secret).update(ts+'.'+raw).digest('hex');
}
test('verified adapter signature is required; forged signature, replay window and short secret fail',()=>{
 const now=Date.now(),raw=JSON.stringify({eventId:'event:0001'});
 checkAdapterSignature(raw,signed(raw,now),secret,now);
 assert.throws(()=>checkAdapterSignature(raw+' ',signed(raw,now),secret,now),e=>e.code==='invalid_ad_signature');
 assert.throws(()=>checkAdapterSignature(raw,'t=1000000000,v1='+'a'.repeat(64),secret,now),e=>e.code==='invalid_ad_signature');
 assert.throws(()=>checkAdapterSignature(raw,signed(raw,now),'short',now),e=>e.code==='ad_verification_unavailable');
});
test('only trusted configured provider and exact callback format can credit',()=>{
 const valid={eventId:'event:00001',attemptId:'d397f3b8-08e4-43e8-b139-ab63fe50b68a',provider:'google-ad-manager-web',verified:true,adUnit:'/12345/spinrealm'};
 assert.deepEqual(validateAdapterEvent(valid),valid);
 assert.throws(()=>validateAdapterEvent({...valid,verified:false}),e=>e.code==='invalid_ad_event');
 assert.throws(()=>validateAdapterEvent({...valid,coins:999999}),e=>e.code==='invalid_payload');
 assert.equal(adsEnabled({secret,publisherReady:false}),false);
 assert.equal(adsEnabled({secret:'bad',publisherReady:true}),false);
 assert.equal(rewardedAdsConfig().enabled,false);
 assert.equal(rewardedAdsConfig().limitPerUTCDate,30);
 assert.equal(rewardedAdsConfig().coins*rewardedAdsConfig().limitPerUTCDate,450);
});
test('unauthorized users cannot claim ad rewards; disabled status shows zero availability',async()=>{
 let credit=0;
 const store={clock:Date.now,limit:async()=>{},ensureUser:async()=>{},rewardedAdStatus:async()=>({enabled:false,remaining:0,claimedToday:0}),acceptRewardedAdEvent:async()=>{credit++;}};
 const app=createApp({store,authenticate:async()=>{throw new Error('no credentials');}});
 const missing=await app.fetch(new Request('https://api.example/v1/webhooks/rewarded-ad',{method:'POST',body:'{}'}));
 assert.equal(missing.status,503);
 const unsupported=await app.fetch(new Request('https://api.example/v1/ads/rewarded/claim',{method:'POST',body:'{}'}));
 assert.notEqual(unsupported.status,200);
 assert.equal(credit,0);
});
test('disabled reward provider never starts, even for authenticated users',async()=>{
 const store={clock:Date.now,limit:async()=>{},ensureUser:async()=>{},rewardedAdStatus:async()=>({enabled:false,remaining:0,claimedToday:0})};
 const app=createApp({store,authenticate:async()=> 'player-0001'});
 const res=await app.fetch(new Request('https://api.example/v1/ads/rewarded/start',{method:'POST',body:'{}'}));
 assert.equal(res.status,503);
 const status=await app.fetch(new Request('https://api.example/v1/ads/rewarded/status'));
 assert.equal(status.status,200);
 const obj=await status.json();assert.equal(obj.enabled,false);assert.equal(obj.remaining,0);
});
test('even configured provider ignores client grant flags without signed adapter header',async()=>{
 let grants=0;
 const store={clock:Date.now,limit:async()=>{},ensureUser:async()=>{},acceptRewardedAdEvent:async()=>{grants++;return{accepted:true};}};
 const app=createApp({store,authenticate:async()=> 'player-0001',rewardedAdsReady:true,rewardedAdUnit:'/12345/spinrealm',rewardedAdSecret:secret});
 const res=await app.fetch(new Request('https://api.example/v1/webhooks/rewarded-ad',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({eventId:'event:0001',verified:true})}));
 assert.equal(res.status,401);assert.equal(grants,0);
});

test('member grants verify entitlement and share the UTC ledger quota with ad events', async () => {
  const {Store} = await import('../../server/api/store.mjs');
  const {testPool} = await import('./pglite-helper.mjs');
  const pool = await testPool();
  let now = Date.parse('2026-11-20T23:58:00Z');
  const store = new Store(pool, {clock: () => now});
  const user = 'plus-player';
  try {
    await store.ensureUser(user);
    const app = createApp({store, authenticate: async () => user});
    const request = (key, data = {}) => app.fetch(new Request('https://api.example/v1/ads/rewarded/plus-claim', {
      method: 'POST', headers: {'Content-Type':'application/json', 'Idempotency-Key':key}, body: JSON.stringify(data)
    }));
    assert.equal((await request('test-free-claim')).status,403);
    assert.equal((await request('test-forged-claim',{plus:true,coins:450})).status,400);

    async function ad() {
      const {attemptId} = await store.startRewardedAd(user,'/test/spinrealm');
      return {attemptId, provider:'google-ad-manager-web', adUnit:'/test/spinrealm', eventId:'test:'+attemptId, verified:true};
    }
    const first = await ad();
    assert.equal((await store.acceptRewardedAdEvent(first)).applied,true);
    assert.equal((await store.acceptRewardedAdEvent(first)).applied,false);
    const pending = await ad();
    const expiration = new Date(now + 86400000);
    await store.entitlementEvent({eventId:'test:membership',userId:user,occurredAt:new Date(now),plan:'snowrealm_plus',status:'active',expiresAt:expiration},'signed-event-hash');
    const claim = await request('test-first-plus');
    assert.equal(claim.status,200);
    assert.equal((await claim.json()).granted,15);
    assert.equal((await request('test-first-plus')).status,200);
    assert.equal((await store.rewardedAdStatus(user)).claimedToday,2);
    for(let i=0;i<27;i++) await store.claimPlusReward(user,'plus-tap-'+i);
    const last = await Promise.allSettled([store.acceptRewardedAdEvent(pending), store.claimPlusReward(user,'plus-last-slot')]);
    assert.equal(last.filter(r => r.status==='fulfilled').length,1);
    assert.equal(last.find(r => r.status==='rejected').reason.code,'ad_daily_limit');
    const status = await store.rewardedAdStatus(user);
    assert.equal(status.canClaimPlus,true);
    assert.equal(status.enabled,false);
    assert.equal(status.claimedToday,30);
    assert.equal(status.remaining,0);
    await assert.rejects(store.startRewardedAd(user,'/test/spinrealm'), e => e.code==='ad_daily_limit');
    const totals = await pool.query("SELECT sum(delta)::int AS coins FROM sr_wallet_ledger WHERE user_id=$1 AND reason IN ('rewarded_ad','plus_reward')",[user]);
    assert.equal(totals.rows[0].coins,450);

    now = Date.parse('2026-11-21T00:00:00Z');
    assert.equal((await store.rewardedAdStatus(user)).remaining,30);
    assert.equal((await store.claimPlusReward(user,'plus-next-day')).granted,15);
    await store.entitlementEvent({eventId:'test:revocation',userId:user,occurredAt:new Date(now),plan:'snowrealm_plus',status:'revoked',expiresAt:null},'revoke-event-hash');
    await assert.rejects(store.claimPlusReward(user,'plus-revoked'), e => e.code==='plus_required');
    assert.equal((await store.rewardedAdStatus(user)).canClaimPlus,false);
  } finally { await pool.end(); }
});
