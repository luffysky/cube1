// Rewarded-ad economy bridge. Client callbacks are NEVER proof of ad completion.
// A trusted adapter first validates the ad network's SSV payload, and only then
// sends this service a short-lived signed event. Disabled by default.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { fail, exactKeys } from './domain.mjs';

export const AD_REWARD=Object.freeze({coins:15,limitPerUTCDate:30,maxPending:1,ttlMs:10*60*1000,provider:'google-ad-manager-web'});
export function adsEnabled({secret='',publisherReady=false}={}){
 return publisherReady===true&&typeof secret==='string'&&secret.length>=32;
}
export function checkAdapterSignature(raw,header,secret,now=Date.now()){
 if(typeof raw!=='string'||!secret||secret.length<32)fail('ad_verification_unavailable',503);
 const match=/^t=(\d{10}),v1=([0-9a-f]{64})$/.exec(header||'');
 if(!match)fail('invalid_ad_signature',401);
 const timestamp=Number(match[1])*1000;
 if(!Number.isSafeInteger(timestamp)||Math.abs(now-timestamp)>5*60000)fail('invalid_ad_signature',401);
 const computed=createHmac('sha256',secret).update(match[1]+'.'+raw).digest();
 const provided=Buffer.from(match[2],'hex');
 if(provided.length!==computed.length||!timingSafeEqual(provided,computed))fail('invalid_ad_signature',401);
}
export function validateAdapterEvent(payload){
 exactKeys(payload,['eventId','attemptId','provider','verified','adUnit'],['eventId','attemptId','provider','verified','adUnit']);
 if(typeof payload.eventId!=='string'||!/^[-_a-zA-Z0-9:.]{8,128}$/.test(payload.eventId))fail('invalid_ad_event');
 if(typeof payload.attemptId!=='string'||!/^[a-f0-9-]{36}$/i.test(payload.attemptId))fail('invalid_ad_event');
 if(payload.provider!==AD_REWARD.provider||payload.verified!==true)fail('invalid_ad_event');
 if(typeof payload.adUnit!=='string'||!/^[A-Za-z0-9\/_-]{3,160}$/.test(payload.adUnit))fail('invalid_ad_event');
 return payload;
}
export function rewardedAdsConfig({publisherReady=false,secret=''}={}){
 return {enabled:adsEnabled({publisherReady,secret}),provider:AD_REWARD.provider,coins:AD_REWARD.coins,
   limitPerUTCDate:AD_REWARD.limitPerUTCDate,requiresVerifiedServerCallback:true,
   note:'Rewards never depend on browser video timers or client-granted events.'};
}
