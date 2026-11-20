import { randomUUID } from 'node:crypto';
import { CATALOG, CATALOG_BY_ID, CATALOG_VERSION, DEFAULT_APPEARANCE, ECONOMY, FREE_COSMETICS, MEMBERSHIP } from '../../dist/platform/catalog.mjs';
import { appearancePatch, entitlement, exactKeys, fail, friendCode, hash, nickname, rank, validateUuid } from './domain.mjs';
import { AD_REWARD } from './rewarded-ads.mjs';
import { DAILY_QUESTS, getDailyQuest } from './quests.mjs';

export async function transaction(pool, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '8000ms'");
    await client.query("SET LOCAL lock_timeout = '4000ms'");
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}
export async function lockUser(client, userId) {
  const result = await client.query('SELECT user_id FROM sr_profiles WHERE user_id=$1 FOR UPDATE', [userId]);
  if (!result.rowCount) fail('profile_not_found', 404);
}
export async function ledger(client, userId, delta, reason, eventKey, metadata = {}, createdAt = null) {
  const wallet = (await client.query('SELECT balance FROM sr_wallets WHERE user_id=$1 FOR UPDATE', [userId])).rows[0];
  if (!wallet) fail('profile_not_found', 404);
  const existing = await client.query('SELECT id FROM sr_wallet_ledger WHERE user_id=$1 AND event_key=$2', [userId, eventKey]);
  if (existing.rowCount) return { balance: wallet.balance, applied: false };
  const next = wallet.balance + delta;
  if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(next) || next < 0 || next > 2147483647) fail('insufficient_coins', 409);
  await client.query('UPDATE sr_wallets SET balance=$2,updated_at=now() WHERE user_id=$1', [userId, next]);
  await client.query('INSERT INTO sr_wallet_ledger(id,user_id,event_key,delta,balance_after,reason,metadata,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz,now()))', [randomUUID(), userId, eventKey, delta, next, reason, metadata, createdAt]);
  return { balance: next, applied: true };
}
export async function idempotent(client, userId, key, operation, payload, callback) {
  // All callers hold the same user's profile lock before this lookup.
  const payloadHash = hash(payload);
  const prior = (await client.query('SELECT operation,payload_hash,response FROM sr_idempotency WHERE user_id=$1 AND request_key=$2', [userId, key])).rows[0];
  if (prior) {
    if (prior.operation !== operation || prior.payload_hash !== payloadHash) fail('idempotency_conflict', 409);
    return prior.response;
  }
  const result = await callback();
  await client.query('INSERT INTO sr_idempotency(user_id,request_key,operation,payload_hash,response) VALUES($1,$2,$3,$4,$5)', [userId, key, operation, payloadHash, result]);
  return result;
}

// Both reward sources write the wallet ledger under the same profile lock.
// Counting ledger credits also includes ad grants issued before Plus claims existed.
async function rewardSlots(client, userId, now) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86400000);
  const {rows} = await client.query(`SELECT count(*)::integer AS claimed FROM sr_wallet_ledger
    WHERE user_id=$1 AND reason IN ('rewarded_ad','plus_reward')
      AND created_at >= $2 AND created_at < $3`, [userId, start, end]);
  const claimedToday = rows[0].claimed;
  return {claimedToday, remaining: Math.max(0, AD_REWARD.limitPerUTCDate - claimedToday)};
}
async function requireRewardSlot(client, userId, now) {
  const {remaining} = await rewardSlots(client, userId, now);
  if (!remaining) fail('ad_daily_limit', 429);
}
async function activePlus(client, userId, now) {
  const {rows} = await client.query('SELECT plan,status,expires_at FROM sr_entitlements WHERE user_id=$1', [userId]);
  return entitlement(rows[0], now.getTime()).plus;
}

export class Store {
  constructor(pool, { clock = Date.now } = {}) { this.pool = pool; this.clock = clock; }
  tx(callback) { return transaction(this.pool, callback); }
  async readiness(expectedDatabase = 'cube1') {
    const row = (await this.pool.query("SELECT current_database()=$1 AS database_matches,to_regclass('public.sr_profiles') IS NOT NULL AS schema_ready", [expectedDatabase])).rows[0];
    return row?.database_matches === true && row?.schema_ready === true;
  }
  async ensureUser(userId) {
    return this.tx(async client => {
      const code = friendCode();
      const inserted = await client.query('INSERT INTO sr_profiles(user_id,nickname,friend_code) VALUES($1,$2,$3) ON CONFLICT(user_id) DO NOTHING RETURNING user_id', [userId, `Player ${code.slice(0, 5)}`, code]);
      if (!inserted.rowCount) return;
      await client.query('INSERT INTO sr_wallets(user_id,balance) VALUES($1,0)', [userId]);
      await client.query('INSERT INTO sr_ratings(user_id) VALUES($1)', [userId]);
      await client.query('INSERT INTO sr_entitlements(user_id) VALUES($1)', [userId]);
      await ledger(client, userId, ECONOMY.initialCoins, 'initial_grant', 'initial:v1');
    });
  }
  async limit(userId, scope, limit, periodMs = 60000, cost = 1) {
    const now = new Date(this.clock()), cutoff = new Date(this.clock() - periodMs);
    const result = await this.pool.query(`INSERT INTO sr_rate_limits(user_id,scope,window_started,used) VALUES($1,$2,$3,$4)
      ON CONFLICT(user_id,scope) DO UPDATE SET
      used=CASE WHEN sr_rate_limits.window_started <= $5 THEN $4 ELSE sr_rate_limits.used+$4 END,
      window_started=CASE WHEN sr_rate_limits.window_started <= $5 THEN $3 ELSE sr_rate_limits.window_started END
      RETURNING used,window_started`, [userId, scope, now, cost, cutoff]);
    const row = result.rows[0];
    if (row.used > limit) fail('rate_limited', 429, { retryAfter: Math.max(1, Math.ceil((new Date(row.window_started).getTime() + periodMs - this.clock()) / 1000)) });
  }
  async profile(userId, client = this.pool) {
    const profile = (await client.query('SELECT user_id,nickname,friend_code,locale,appearance,created_at FROM sr_profiles WHERE user_id=$1', [userId])).rows[0];
    if (!profile) fail('profile_not_found', 404);
    const wallet = (await client.query('SELECT balance FROM sr_wallets WHERE user_id=$1', [userId])).rows[0];
    const inventory = (await client.query('SELECT item_id,quantity FROM sr_inventory WHERE user_id=$1 AND quantity > 0 ORDER BY item_id', [userId])).rows.map(row => ({ itemId: row.item_id, quantity: row.quantity }));
    const owned = (await client.query('SELECT item_id FROM sr_owned_cosmetics WHERE user_id=$1 ORDER BY item_id', [userId])).rows.map(row => row.item_id);
    const access = entitlement((await client.query('SELECT * FROM sr_entitlements WHERE user_id=$1', [userId])).rows[0], this.clock());
    const rating = (await client.query('SELECT * FROM sr_ratings WHERE user_id=$1', [userId])).rows[0];
    const today = new Date(this.clock()).toISOString().slice(0, 10);
    const daily = (await client.query('SELECT 1 FROM sr_wallet_ledger WHERE user_id=$1 AND event_key=$2', [userId, `daily:${today}`])).rowCount > 0;
    return { profile: { id: userId, nickname: profile.nickname, friendCode: profile.friend_code, locale: profile.locale, createdAt: profile.created_at },
      wallet, inventory, ownedCosmetics: [...new Set([...FREE_COSMETICS, ...owned])],
      appearance: { ...DEFAULT_APPEARANCE, ...profile.appearance, customBackgroundEnabled: access.plus && Boolean(profile.appearance.customBackgroundEnabled) },
      entitlement: access, rank: rank(rating), daily: { claimed: daily, coins: ECONOMY.dailyCoins, nextClaimAt: `${new Date(this.clock() + 86400000).toISOString().slice(0, 10)}T00:00:00.000Z` } };
  }
  async patchProfile(userId, body) {
    exactKeys(body, ['nickname', 'locale', 'appearance']);
    if (!Object.keys(body).length) fail('invalid_payload');
    if (body.locale === 'zh-TW') body = { ...body, locale: 'zh-Hant' };
    if (body.locale === 'zh-CN') body = { ...body, locale: 'zh-Hans' };
    if (Object.hasOwn(body, 'nickname')) nickname(body.nickname);
    if (Object.hasOwn(body, 'locale') && !['zh-Hant', 'zh-Hans', 'en', 'ja', 'ko'].includes(body.locale)) fail('invalid_locale');
    return this.tx(async client => {
      await lockUser(client, userId);
      const current = await this.profile(userId, client);
      const appearance = Object.hasOwn(body, 'appearance') ? appearancePatch(current.appearance, body.appearance, current.ownedCosmetics, current.entitlement.plus) : current.appearance;
      await client.query('UPDATE sr_profiles SET nickname=$2,locale=$3,appearance=$4,updated_at=now() WHERE user_id=$1', [userId, Object.hasOwn(body, 'nickname') ? nickname(body.nickname) : current.profile.nickname, body.locale || current.profile.locale, appearance]);
      return this.profile(userId, client);
    });
  }
  catalog() { return { version: CATALOG_VERSION, items: CATALOG, economy: ECONOMY, membership: MEMBERSHIP, rankedItemsAllowed: false }; }
  async daily(userId, key) {
    return this.tx(async client => {
      await lockUser(client, userId);
      return idempotent(client, userId, key, 'daily', {}, async () => {
        const day = new Date(this.clock()).toISOString().slice(0, 10);
        const result = await ledger(client, userId, ECONOMY.dailyCoins, 'daily_grant', `daily:${day}`);
        return { wallet: { balance: result.balance }, granted: result.applied ? ECONOMY.dailyCoins : 0, alreadyClaimed: !result.applied, day };
      });
    });
  }
  async dailyQuests(userId,client=this.pool) {
    const today=new Date(this.clock()).toISOString().slice(0,10);
    const [matches,claims]=await Promise.all([
      client.query(`SELECT count(*)::integer AS completed,
         count(*) FILTER(WHERE outcome='win')::integer AS wins
         FROM sr_rank_settlements WHERE user_id=$1 AND created_at >= $2::date
           AND created_at < ($2::date + interval '1 day')
           AND outcome IN ('win','draw','loss')`,[userId,today]),
      client.query(`SELECT event_key FROM sr_wallet_ledger WHERE user_id=$1 AND reason='quest_reward'
         AND event_key LIKE $2`,[userId,`quest:${today}:%`])
    ]);
    const stats=matches.rows[0]||{completed:0,wins:0};
    const claimed=new Set(claims.rows.map(row=>row.event_key));
    return {date:today,quests:DAILY_QUESTS.map(q=>{
      const progress=Math.max(0,Number(stats[q.kind]||0));
      return {id:q.id,coins:q.coins,target:q.target,progress:Math.min(progress,q.target),
       completed:progress>=q.target,claimed:claimed.has(`quest:${today}:${q.id}`)};
    })};
  }
  async claimDailyQuest(userId,questId,idempotencyKey){
    const quest=getDailyQuest(questId);
    if(!quest)fail('invalid_quest',400);
    return this.tx(async client=>{
      await lockUser(client,userId);
      return idempotent(client,userId,idempotencyKey,'quest_claim',{questId},async()=>{
        const status=await this.dailyQuests(userId,client);
        const current=status.quests.find(item=>item.id===questId);
        if(!current?.completed)fail('quest_not_completed',409);
        const award=await ledger(client,userId,quest.coins,'quest_reward',`quest:${status.date}:${questId}`,{questId});
        return {questId,granted:award.applied?quest.coins:0,alreadyClaimed:!award.applied,
         wallet:{balance:award.balance}};
      });
    });
  }
  async rewardedAdStatus(userId,{enabled=false}={}){
    const now=new Date(this.clock());
    const canClaimPlus=await activePlus(this.pool,userId,now);
    const slots=await rewardSlots(this.pool,userId,now);
    return {enabled,canClaimPlus,coins:AD_REWARD.coins,limit:AD_REWARD.limitPerUTCDate,
      claimedToday:slots.claimedToday,remaining:enabled||canClaimPlus?slots.remaining:0};
  }
  async claimPlusReward(userId, key) {
    return this.tx(async client => {
      await lockUser(client, userId);
      return idempotent(client, userId, key, 'plus_reward', {}, async () => {
        const now = new Date(this.clock());
        if (!await activePlus(client, userId, now)) fail('plus_required', 403);
        await requireRewardSlot(client, userId, now);
        const result = await ledger(client, userId, AD_REWARD.coins, 'plus_reward', 'plus_reward:'+key, {}, now);
        return {granted: result.applied ? AD_REWARD.coins : 0, wallet: {balance: result.balance}};
      });
    });
  }
  async startRewardedAd(userId,adUnit){
    return this.tx(async client=>{
      await lockUser(client,userId);
      const now=new Date(this.clock());
      await requireRewardSlot(client,userId,now);
      const existing=(await client.query(`SELECT id FROM sr_reward_ad_attempts WHERE user_id=$1 AND status='pending'
        AND expires_at>$2 ORDER BY issued_at DESC LIMIT 1`,[userId,now])).rows[0];
      if(existing)fail('ad_attempt_in_progress',409);
      const id=randomUUID(),expires=new Date(now.getTime()+AD_REWARD.ttlMs);
      await client.query(`INSERT INTO sr_reward_ad_attempts(id,user_id,provider,ad_unit,reward_coins,expires_at,issued_at)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,userId,AD_REWARD.provider,adUnit,AD_REWARD.coins,expires,now]);
      return {attemptId:id,expiresAt:expires.toISOString(),provider:AD_REWARD.provider,coins:AD_REWARD.coins};
    });
  }
  async acceptRewardedAdEvent(event){
    // The HTTP handler MUST check adapter signature BEFORE this method.
    // Provider callbacks are untrusted until validated upstream.
    const ref=(await this.pool.query('SELECT user_id FROM sr_reward_ad_attempts WHERE id=$1',[event.attemptId])).rows[0];
    if(!ref)fail('ad_attempt_not_found',404);
    return this.tx(async client=>{
      await lockUser(client,ref.user_id);
      const row=(await client.query('SELECT * FROM sr_reward_ad_attempts WHERE id=$1 FOR UPDATE',[event.attemptId])).rows[0];
      if(!row)fail('ad_attempt_not_found',404);
      if(row.status==='granted')return {accepted:true,applied:false};
      if(row.status!=='pending'||new Date(row.expires_at).getTime()<this.clock())fail('ad_attempt_expired',409);
      if(row.ad_unit!==event.adUnit||row.provider!==event.provider)fail('invalid_ad_event',403);
      const now=new Date(this.clock());
      await requireRewardSlot(client,ref.user_id,now);
      const credit=await ledger(client,ref.user_id,row.reward_coins,'rewarded_ad','rewarded_ad:'+event.attemptId,{provider:event.provider},now);
      await client.query(`UPDATE sr_reward_ad_attempts SET status='granted',granted_at=$2,provider_event_id=$3
        WHERE id=$1`,[event.attemptId,now,event.eventId]);
      return {accepted:true,applied:credit.applied};
    });
  }
  async purchase(userId, key, body) {
    exactKeys(body, ['itemId', 'quantity'], ['itemId']);
    const item = CATALOG_BY_ID[body.itemId], quantity = body.quantity ?? 1;
    if (!item || item.free) fail('invalid_item');
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10 || (item.kind === 'cosmetic' && quantity !== 1)) fail('invalid_quantity');
    return this.tx(async client => {
      await lockUser(client, userId);
      return idempotent(client, userId, key, 'purchase', { itemId: item.id, quantity }, async () => {
        if (item.kind === 'cosmetic') {
          if ((await client.query('SELECT 1 FROM sr_owned_cosmetics WHERE user_id=$1 AND item_id=$2', [userId, item.id])).rowCount) fail('already_owned', 409);
        } else {
          const owned = (await client.query('SELECT quantity FROM sr_inventory WHERE user_id=$1 AND item_id=$2', [userId, item.id])).rows[0]?.quantity || 0;
          if (owned + quantity > 999) fail('inventory_full', 409);
        }
        const changed = await ledger(client, userId, -item.price * quantity, 'shop_purchase', `purchase:${key}`, { itemId: item.id, quantity, catalogVersion: CATALOG_VERSION });
        if (item.kind === 'cosmetic') await client.query('INSERT INTO sr_owned_cosmetics(user_id,item_id) VALUES($1,$2)', [userId, item.id]);
        else await client.query('INSERT INTO sr_inventory(user_id,item_id,quantity) VALUES($1,$2,$3) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=sr_inventory.quantity+EXCLUDED.quantity', [userId, item.id, quantity]);
        return { purchased: { itemId: item.id, quantity, spent: item.price * quantity }, wallet: { balance: changed.balance } };
      });
    });
  }
  async useItem(userId, key, body) {
    exactKeys(body, ['itemId', 'mode'], ['itemId', 'mode']);
    const item = CATALOG_BY_ID[body.itemId];
    if (!item || item.kind !== 'consumable') fail('invalid_item');
    if (body.mode !== 'party') fail('items_not_allowed', 403);
    return this.tx(async client => {
      await lockUser(client, userId);
      return idempotent(client, userId, key, 'inventory_use', body, async () => {
        if ((await client.query('SELECT 1 FROM sr_ranked_seats WHERE user_id=$1', [userId])).rowCount) fail('items_not_allowed', 403);
        const changed = await client.query('UPDATE sr_inventory SET quantity=quantity-1 WHERE user_id=$1 AND item_id=$2 AND quantity>0 RETURNING quantity', [userId, item.id]);
        if (!changed.rowCount) fail('item_not_owned', 409);
        return { used: item.id, quantity: changed.rows[0].quantity, effect: item.effect, mode: 'party', trustedMatchReward: false };
      });
    });
  }
  async walletHistory(userId) {
    return { entries: (await this.pool.query('SELECT id,delta,balance_after,reason,metadata,created_at FROM sr_wallet_ledger WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50', [userId])).rows.map(row => ({ id: row.id, delta: row.delta, balanceAfter: row.balance_after, reason: row.reason, metadata: row.metadata, createdAt: row.created_at })) };
  }
  async findFriend(userId, code, client = this.pool) {
    if (typeof code !== 'string' || !/^[A-Z2-9]{12}$/.test(code.toUpperCase())) fail('invalid_friend_code');
    const other = (await client.query(`SELECT user_id,nickname,friend_code FROM sr_profiles p WHERE friend_code=$1
      AND NOT EXISTS(SELECT 1 FROM sr_blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=p.user_id) OR (b.blocked_id=$2 AND b.blocker_id=p.user_id))`, [code.toUpperCase(), userId])).rows[0];
    if (!other) fail('friend_not_found', 404);
    if (other.user_id === userId) fail('cannot_friend_self');
    return { id: other.user_id, nickname: other.nickname, friendCode: other.friend_code };
  }
  async friends(userId) {
    const rows = (await this.pool.query(`SELECT f.request_id,f.requester_id,f.status,f.created_at,p.user_id,p.nickname,p.friend_code FROM sr_friendships f
      JOIN sr_profiles p ON p.user_id=CASE WHEN f.user_low=$1 THEN f.user_high ELSE f.user_low END
      WHERE f.user_low=$1 OR f.user_high=$1 ORDER BY f.created_at DESC LIMIT 200`, [userId])).rows;
    const peers = rows.map(row => ({ requestId: row.request_id, id: row.user_id, nickname: row.nickname, friendCode: row.friend_code, direction: row.requester_id === userId ? 'outgoing' : 'incoming', status: row.status, createdAt: row.created_at }));
    const blocked = (await this.pool.query('SELECT p.user_id,p.nickname,p.friend_code FROM sr_blocks b JOIN sr_profiles p ON p.user_id=b.blocked_id WHERE b.blocker_id=$1 ORDER BY b.created_at DESC LIMIT 200', [userId])).rows.map(row => ({ id: row.user_id, nickname: row.nickname, friendCode: row.friend_code }));
    return { friends: peers.filter(row => row.status === 'accepted'), requests: peers.filter(row => row.status === 'pending'), blocked };
  }
  async requestFriend(userId, body) {
    exactKeys(body, ['friendCode'], ['friendCode']);
    return this.tx(async client => {
      const other = await this.findFriend(userId, body.friendCode, client);
      const [low, high] = [userId, other.id].sort();
      // A shared pair lock serializes block, request, and accept races.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`friend:${low}:${high}`]);
      // Lock both profiles in a stable order so different pairs cannot overflow
      // either person's combined pending/accepted list concurrently.
      await lockUser(client, low);
      await lockUser(client, high);
      await this.findFriend(userId, body.friendCode, client);
      const existing = (await client.query('SELECT request_id,status,requester_id FROM sr_friendships WHERE user_low=$1 AND user_high=$2', [low, high])).rows[0];
      if (existing) return { requestId: existing.request_id, status: existing.status, direction: existing.requester_id === userId ? 'outgoing' : 'incoming', friend: other };
      const capacity = (await client.query(`SELECT
        count(*) FILTER(WHERE user_low=$1 OR user_high=$1)::integer AS mine,
        count(*) FILTER(WHERE user_low=$2 OR user_high=$2)::integer AS theirs
        FROM sr_friendships WHERE user_low IN ($1,$2) OR user_high IN ($1,$2)`, [userId, other.id])).rows[0];
      if (capacity.mine >= 200 || capacity.theirs >= 200) fail('friend_limit', 409);
      const requestId = randomUUID();
      await client.query('INSERT INTO sr_friendships(user_low,user_high,request_id,requester_id,status) VALUES($1,$2,$3,$4,\'pending\')', [low, high, requestId, userId]);
      return { requestId, status: 'pending', direction: 'outgoing', friend: other };
    });
  }
  async friendAction(userId, requestId, action) {
    validateUuid(requestId);
    if (!['accept', 'decline', 'remove'].includes(action)) fail('invalid_action');
    return this.tx(async client => {
      const peek = (await client.query('SELECT * FROM sr_friendships WHERE request_id=$1 AND (user_low=$2 OR user_high=$2)', [requestId, userId])).rows[0];
      if (!peek) fail('friend_request_not_found', 404);
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`friend:${peek.user_low}:${peek.user_high}`]);
      const row = (await client.query('SELECT * FROM sr_friendships WHERE request_id=$1 AND (user_low=$2 OR user_high=$2) FOR UPDATE', [requestId, userId])).rows[0];
      if (!row) fail('friend_request_not_found', 404);
      if (action === 'accept') {
        if (row.requester_id === userId || row.status !== 'pending') fail('friend_action_not_allowed', 403);
        const blocked = await client.query('SELECT 1 FROM sr_blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)', [row.user_low, row.user_high]);
        if (blocked.rowCount) fail('friend_not_found', 404);
        await client.query("UPDATE sr_friendships SET status='accepted',accepted_at=now() WHERE request_id=$1", [requestId]);
      } else await client.query('DELETE FROM sr_friendships WHERE request_id=$1', [requestId]);
      return { requestId, status: action === 'accept' ? 'accepted' : 'removed' };
    });
  }
  async block(userId, body, unblock = false) {
    exactKeys(body, ['userId'], ['userId']);
    if (typeof body.userId !== 'string' || body.userId.length > 128 || body.userId === userId) fail('invalid_user');
    return this.tx(async client => {
      const [low, high] = [userId, body.userId].sort();
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`friend:${low}:${high}`]);
      const target = await client.query('SELECT 1 FROM sr_profiles WHERE user_id=$1', [body.userId]);
      if (!target.rowCount) fail('friend_not_found', 404);
      if (unblock) await client.query('DELETE FROM sr_blocks WHERE blocker_id=$1 AND blocked_id=$2', [userId, body.userId]);
      else {
        const count = (await client.query('SELECT count(*)::integer AS count FROM sr_blocks WHERE blocker_id=$1', [userId])).rows[0].count;
        if (count >= 200) fail('block_limit', 409);
        await client.query('INSERT INTO sr_blocks(blocker_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [userId, body.userId]);
        await client.query('DELETE FROM sr_friendships WHERE user_low=$1 AND user_high=$2', [low, high]);
      }
      return { blocked: !unblock };
    });
  }
  async leaderboard() {
    const rows = (await this.pool.query('SELECT r.*,p.nickname FROM sr_ratings r JOIN sr_profiles p USING(user_id) WHERE r.games>=5 ORDER BY r.rating DESC,r.games DESC,r.user_id LIMIT 50')).rows;
    return { season: 'open-beta-1', placementGames: 5, entries: rows.map((row, index) => ({ position: index + 1, id: row.user_id, nickname: row.nickname, ...rank(row) })) };
  }
  async matchHistory(userId) {
    const rows = (await this.pool.query(`SELECT s.*,p.nickname,m.result,
      m.snapshot->'games'->($1::text)->'stats' AS stats
      FROM sr_rank_settlements s JOIN sr_profiles p ON p.user_id=s.opponent_id
      JOIN sr_ranked_matches m ON m.id=s.match_id WHERE s.user_id=$1
      ORDER BY s.created_at DESC,s.match_id DESC LIMIT 30`, [userId])).rows;
    return { matches: rows.map(row => ({ id: row.match_id, opponent: { id: row.opponent_id, nickname: row.nickname },
      outcome: row.outcome, reason: row.result?.reason, elapsedMs: row.result?.elapsedMs || 0,
      score: row.stats?.score || 0, lines: row.stats?.lines || 0, spins: row.stats?.spins || 0, attack: row.stats?.attack || 0,
      ratingBefore: row.rating_before, ratingAfter: row.rating_after, coins: row.coins, rewardReason: row.reward_reason, createdAt: row.created_at })) };
  }
  async entitlementEvent(body, payloadHash) {
    exactKeys(body, ['eventId', 'userId', 'occurredAt', 'plan', 'status', 'expiresAt'], ['eventId', 'userId', 'occurredAt', 'plan', 'status', 'expiresAt']);
    if (typeof body.eventId !== 'string' || !/^[\w:.-]{8,160}$/.test(body.eventId) || typeof body.userId !== 'string' || body.userId.length > 128) fail('invalid_webhook_event');
    if (body.plan !== 'snowrealm_plus' || !['active', 'revoked', 'inactive'].includes(body.status)) fail('invalid_webhook_event');
    const occurred = new Date(body.occurredAt), expires = body.expiresAt === null ? null : new Date(body.expiresAt);
    if (!Number.isFinite(occurred.getTime()) || occurred.getTime() > this.clock() + 300000 || (expires && !Number.isFinite(expires.getTime())) || (body.status === 'active' && (!expires || expires.getTime() <= occurred.getTime() || expires.getTime() > this.clock() + 400 * 86400000))) fail('invalid_webhook_event');
    return this.tx(async client => {
      await lockUser(client, body.userId);
      const prior = (await client.query('SELECT payload_hash FROM sr_entitlement_events WHERE event_id=$1', [body.eventId])).rows[0];
      if (prior) { if (prior.payload_hash !== payloadHash) fail('webhook_event_conflict', 409); return { received: true, duplicate: true }; }
      await client.query('INSERT INTO sr_entitlement_events(event_id,payload_hash,user_id,occurred_at) VALUES($1,$2,$3,$4)', [body.eventId, payloadHash, body.userId, occurred]);
      const changed = await client.query(`UPDATE sr_entitlements SET plan=$2,status=$3,expires_at=$4,source='verified_payment_adapter',last_event_at=$5,updated_at=now()
        WHERE user_id=$1 AND (last_event_at IS NULL OR last_event_at<$5)`, [body.userId, body.plan, body.status, expires, occurred]);
      return { received: true, duplicate: false, applied: changed.rowCount === 1 };
    });
  }
}
