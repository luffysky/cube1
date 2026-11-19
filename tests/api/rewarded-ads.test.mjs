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
