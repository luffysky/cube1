import { randomUUID } from 'node:crypto';
import { ApiError, exactKeys, fail, hash, readBody, requestKey, verifyEntitlementSignature } from './domain.mjs';
import { Ranked, validateInputs } from './ranked.mjs';
import { assertAdmin, adminAllowlist, adminRead } from './admin.mjs';
import { adsEnabled, checkAdapterSignature, validateAdapterEvent, rewardedAdsConfig } from './rewarded-ads.mjs';

export function createApp({ store, authenticate, allowedOrigins = [], adminSubjects = '', adminStore = null, platformIdentity = null, entitlementWebhookSecret = '', rewardedAdSecret = '', rewardedAdUnit = '', rewardedAdsReady = false, expectedDatabase = 'cube1', logger = console }) {
  const origins = new Set(allowedOrigins.filter(Boolean).map(origin => new URL(origin).origin));
  const ranked = new Ranked(store);
  const admins = adminAllowlist(adminSubjects);
  let readinessCache = null, readinessPending = null;
  const readiness = async () => {
    if (readinessCache && readinessCache.until > store.clock()) return readinessCache.ready;
    if (!readinessPending) readinessPending = (async () => {
      let ready = false;
      try { ready = await store.readiness(expectedDatabase); } catch { /* Never expose connection or SQL details. */ }
      readinessCache = { ready, until: store.clock() + 5000 };
      return ready;
    })().finally(() => { readinessPending = null; });
    return readinessPending;
  };
  return {
    async fetch(request) {
      const requestId = randomUUID(), origin = request.headers.get('origin');
      const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff', 'X-Request-Id': requestId });
      if (origin && origins.has(origin)) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Authorization,Content-Type,Idempotency-Key');
        headers.set('Access-Control-Expose-Headers', 'Retry-After,X-Request-Id');
        headers.set('Access-Control-Max-Age', '600');
      }
      const respond = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
      try {
        if (origin && !origins.has(origin)) fail('origin_not_allowed', 403);
        const url = new URL(request.url), path = url.pathname.replace(/\/$/, '') || '/', method = request.method;
        if (method === 'OPTIONS') return new Response(null, { status: 204, headers });
        if (method === 'GET' && (path === '/health' || path === '/')) return respond({ ok: true, service: 'snowrealm-games', apiVersion: '1', ranked: 'authoritative-polling-beta', billingAvailable: false });
        if (method === 'GET' && path === '/health/ready') {
          const ready = await readiness();
          return respond({ ready }, ready ? 200 : 503);
        }
        if (method === 'GET' && path === '/v1/catalog') return respond(store.catalog());
        if (method === 'POST' && path === '/v1/webhooks/entitlement') {
          if (!entitlementWebhookSecret || entitlementWebhookSecret.length < 32) fail('billing_unavailable', 503);
          const { raw, data } = await readBody(request);
          verifyEntitlementSignature(raw, request.headers.get('x-snowrealm-signature'), entitlementWebhookSecret, store.clock());
          return respond(await store.entitlementEvent(data, hash(raw)));
        }
        if (path === '/v1/webhooks/rewarded-ad' && method === 'POST') {
          if (!adsEnabled({secret:rewardedAdSecret,publisherReady:rewardedAdsReady})||!rewardedAdUnit) fail('ads_unavailable',503);
          const {raw,data}=await readBody(request);
          checkAdapterSignature(raw,request.headers.get('x-snowrealm-ad-signature'),rewardedAdSecret,store.clock());
          const event=validateAdapterEvent(data);
          if(event.adUnit!==rewardedAdUnit)fail('invalid_ad_event',403);
          return respond(await store.acceptRewardedAdEvent(event));
        }
        const userId = await authenticate(request);
        if (typeof userId !== 'string' || !userId.length || userId.length > 128 || ['__proto__', 'constructor', 'prototype'].includes(userId)) fail('unauthorized', 401);
        if(path==='/v1/identity/me' && method==='GET'){
          if(!platformIdentity)fail('identity_unavailable',503);
          // Unlike a Neon auth ID, this UUID is portable across SnowRealm games.
          // Querying identity must not create a profile, wallet or UUID mapping.
          const platformPlayerId=await platformIdentity.find(userId);
          return respond({platformPlayerId,linked:Boolean(platformPlayerId),source:'snowrealm-identity-mapping',readyForBrickduel:false});
        }
        if(path==='/v1/identity/register' && method==='POST'){
          if(!platformIdentity)fail('identity_unavailable',503);
          exactKeys((await readBody(request)).data,[]);
          await store.limit(userId,'identity_register',10);
          const platformPlayerId=await platformIdentity.ensure(userId);
          // This endpoint does NOT issue link tokens. Brickduel's flag remains OFF.
          return respond({platformPlayerId,linked:true,source:'snowrealm-identity-mapping',readyForBrickduel:false});
        }
        if(path.startsWith('/v1/admin/')){
          assertAdmin(userId,admins);
          if(!adminStore)fail('admin_unavailable',503);
          await store.limit(userId,'admin_read',60);
          return respond(await adminRead(path,method,adminStore));
        }
        await store.limit(userId, 'all', 1800);
        await store.ensureUser(userId);
        if (path === '/v1/profile' && method === 'GET') return respond(await store.profile(userId));
        if (path === '/v1/profile' && method === 'PATCH') {
          await store.limit(userId, 'profile_write', 20);
          return respond(await store.patchProfile(userId, (await readBody(request)).data));
        }
        if (path === '/v1/ads/rewarded/status' && method === 'GET') {
          const cfg=rewardedAdsConfig({publisherReady:rewardedAdsReady&&Boolean(rewardedAdUnit),secret:rewardedAdSecret});
          return respond({...cfg,...await store.rewardedAdStatus(userId,{enabled:cfg.enabled})});
        }
        if (path === '/v1/ads/rewarded/plus-claim' && method === 'POST') {
          await store.limit(userId, 'wallet_write', 30);
          exactKeys((await readBody(request)).data, []);
          return respond(await store.claimPlusReward(userId, requestKey(request)));
        }
        if (path === '/v1/ads/rewarded/start' && method === 'POST') {
          if(!adsEnabled({secret:rewardedAdSecret,publisherReady:rewardedAdsReady})||!rewardedAdUnit)fail('ads_unavailable',503);
          await store.limit(userId,'reward_ad_start',8,60000);
          exactKeys((await readBody(request)).data,[]);
          return respond(await store.startRewardedAd(userId,rewardedAdUnit));
        }
        if (path === '/v1/quests/daily' && method === 'GET') {
          await store.limit(userId,'quest_read',40);
          return respond(await store.dailyQuests(userId));
        }
        if (path === '/v1/quests/daily/claim' && method === 'POST') {
          await store.limit(userId,'quest_claim',20);
          const {data}=await readBody(request);exactKeys(data,['questId'],['questId']);
          return respond(await store.claimDailyQuest(userId,data.questId,requestKey(request)));
        }
        if (path === '/v1/wallet/history' && method === 'GET') return respond(await store.walletHistory(userId));
        if (path === '/v1/wallet/daily' && method === 'POST') {
          await store.limit(userId, 'wallet_write', 30);
          const { data } = await readBody(request); exactKeys(data, []);
          return respond(await store.daily(userId, requestKey(request)));
        }
        if (path === '/v1/shop/purchase' && method === 'POST') {
          await store.limit(userId, 'wallet_write', 30);
          return respond(await store.purchase(userId, requestKey(request), (await readBody(request)).data));
        }
        if (path === '/v1/inventory/use' && method === 'POST') {
          await store.limit(userId, 'inventory_write', 30);
          return respond(await store.useItem(userId, requestKey(request), (await readBody(request)).data));
        }
        if (path === '/v1/friends' && method === 'GET') {
          await store.limit(userId, 'friend_read', 60);
          return respond(await store.friends(userId));
        }
        if (path === '/v1/friends/lookup' && method === 'GET') {
          await store.limit(userId, 'friend_lookup', 15);
          return respond({ friend: await store.findFriend(userId, url.searchParams.get('code')) });
        }
        if (path === '/v1/friends/requests' && method === 'POST') {
          await store.limit(userId, 'friend_write', 20);
          return respond(await store.requestFriend(userId, (await readBody(request)).data));
        }
        const friendAction = /^\/v1\/friends\/requests\/([^/]+)\/(accept|decline|remove)$/.exec(path);
        if (friendAction && method === 'POST') {
          await store.limit(userId, 'friend_write', 20);
          exactKeys((await readBody(request)).data, []);
          return respond(await store.friendAction(userId, friendAction[1], friendAction[2]));
        }
        if (path === '/v1/friends/block' && ['POST', 'DELETE'].includes(method)) {
          await store.limit(userId, 'friend_write', 20);
          return respond(await store.block(userId, (await readBody(request)).data, method === 'DELETE'));
        }
        if (path === '/v1/ranked/queue' && ['GET', 'POST', 'DELETE'].includes(method)) {
          await store.limit(userId, 'ranked_queue', 45);
          if (method !== 'GET') exactKeys((await readBody(request)).data, []);
          return respond(await ranked.queue(userId, method));
        }
        if (path === '/v1/matches/history' && method === 'GET') {
          await store.limit(userId, 'match_history', 30);
          return respond(await store.matchHistory(userId));
        }
        const matchRoute = /^\/v1\/matches\/([^/]+)(?:\/(inputs|forfeit))?$/.exec(path);
        if (matchRoute && method === 'GET' && !matchRoute[2]) {
          await store.limit(userId, 'match_poll', 12, 1000);
          return respond(await ranked.match(userId, matchRoute[1]));
        }
        if (matchRoute && method === 'POST' && matchRoute[2] === 'inputs') {
          await store.limit(userId, 'match_input_requests', 15, 1000);
          const inputs = validateInputs((await readBody(request)).data);
          await store.limit(userId, 'match_input_actions', 120, 1000, inputs.length);
          return respond(await ranked.match(userId, matchRoute[1], { inputs }));
        }
        if (matchRoute && method === 'POST' && matchRoute[2] === 'forfeit') {
          await store.limit(userId, 'match_forfeit', 10);
          exactKeys((await readBody(request)).data, []);
          return respond(await ranked.match(userId, matchRoute[1], { forfeit: true }));
        }
        if (path === '/v1/leaderboard' && method === 'GET') { await store.limit(userId, 'leaderboard', 30); return respond(await store.leaderboard()); }
        if (path === '/v1/billing/checkout' && method === 'POST') fail('billing_unavailable', 503);
        fail('route_not_found', 404);
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 429 || error.details?.retryAfter) headers.set('Retry-After', String(error.details?.retryAfter || 1));
          return respond({ error: { code: error.code, ...(error.details ? { details: error.details } : {}) }, requestId }, error.status);
        }
        const unavailable = ['53300', '57P01', '57014', '55P03', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'].includes(error?.code);
        // Never log JWTs, raw input, email addresses, or database connection strings.
        logger.error?.('snowrealm_api_error', { requestId, code: error?.code || 'internal' });
        if (unavailable) headers.set('Retry-After', '2');
        return respond({ error: { code: unavailable ? 'service_unavailable' : 'internal_error' }, requestId }, unavailable ? 503 : 500);
      }
    },
  };
}
