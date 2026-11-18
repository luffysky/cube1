import { randomBytes, randomUUID } from 'node:crypto';
import { MatchSimulation, DURATION_TICKS, TICK_HZ, INPUT_ACTIONS } from '../match-simulation.mjs';
import { ECONOMY } from '../../dist/platform/catalog.mjs';
import { eloPair, exactKeys, fail, publicMatch, validateUuid } from './domain.mjs';
import { ledger, lockUser } from './store.mjs';

export const COUNTDOWN_MS = 3000;
export const QUEUE_TIMEOUT_MS = 15000;
export const DISCONNECT_MS = 20000;
const actions = new Set(INPUT_ACTIONS);
const millis = value => new Date(value).getTime();
const utcDay = time => new Date(new Date(time).toISOString().slice(0, 10));

export function validateInputs(body) {
  exactKeys(body, ['inputs'], ['inputs']);
  if (!Array.isArray(body.inputs) || body.inputs.length < 1 || body.inputs.length > 32) fail('invalid_inputs');
  let previous = 0;
  for (const input of body.inputs) {
    exactKeys(input, ['seq', 'action'], ['seq', 'action']);
    if (!Number.isSafeInteger(input.seq) || input.seq <= previous || input.seq > 2147483647 || !actions.has(input.action)) fail('invalid_inputs');
    previous = input.seq;
  }
  return body.inputs;
}
// No client clock, score, seed, board, or outcome enters this function.
export function advanceMatch(match, row, now) {
  if (match.status !== 'running' || now < millis(row.started_at)) return;
  const deadlines = [millis(row.heartbeat_one), millis(row.heartbeat_two)].map(time => Math.max(millis(row.started_at), time) + DISCONNECT_MS);
  const stale = deadlines.map(deadline => now > deadline);
  const until = stale.some(Boolean) ? Math.min(now, ...deadlines.filter((_, index) => stale[index])) : now;
  const target = Math.min(DURATION_TICKS, Math.max(0, Math.floor((until - millis(row.started_at)) * TICK_HZ / 1000)));
  if (target > match.tick) match.step(target - match.tick);
  if (match.status === 'running' && stale.some(Boolean)) {
    match._finish(stale.every(Boolean) ? 'double_disconnect' : 'disconnect', stale.every(Boolean) ? null : match.playerIds[stale[0] ? 1 : 0]);
  }
}
export function checkpoint(match) {
  // Undo is disabled in ranked. Preserve turn/RNG/timers but omit unused history.
  for (const game of Object.values(match.games)) game._history = [];
  return match.snapshot();
}

export class Ranked {
  constructor(store) { this.store = store; this.clock = store.clock; }
  async queue(userId, method) {
    return this.store.tx(async client => {
      // One short cross-isolate lock makes matchmaking and duplicate joins atomic.
      await client.query('SELECT pg_advisory_xact_lock(741924117)');
      const now = new Date(this.clock());
      await client.query('DELETE FROM sr_ranked_queue WHERE heartbeat_at<$1', [new Date(this.clock() - QUEUE_TIMEOUT_MS)]);
      const seat = (await client.query('SELECT s.match_id,m.status FROM sr_ranked_seats s JOIN sr_ranked_matches m ON m.id=s.match_id WHERE s.user_id=$1', [userId])).rows[0];
      if (seat?.status === 'running') return { status: 'matched', matchId: seat.match_id };
      if (seat) await client.query('DELETE FROM sr_ranked_seats WHERE user_id=$1', [userId]);
      if (method === 'DELETE') { await client.query('DELETE FROM sr_ranked_queue WHERE user_id=$1', [userId]); return { status: 'idle' }; }
      const existing = (await client.query('SELECT joined_at FROM sr_ranked_queue WHERE user_id=$1', [userId])).rows[0];
      if (!existing && method === 'GET') return { status: 'idle' };
      const rating = (await client.query('SELECT rating FROM sr_ratings WHERE user_id=$1', [userId])).rows[0].rating;
      await client.query(`INSERT INTO sr_ranked_queue(user_id,rating,joined_at,heartbeat_at) VALUES($1,$2,$3,$3)
        ON CONFLICT(user_id) DO UPDATE SET heartbeat_at=EXCLUDED.heartbeat_at,rating=EXCLUDED.rating`, [userId, rating, now]);
      const ownJoined = existing?.joined_at || now;
      const opponent = (await client.query(`SELECT q.user_id,q.rating,q.joined_at FROM sr_ranked_queue q
        WHERE q.user_id<>$1 AND NOT EXISTS(SELECT 1 FROM sr_ranked_seats s WHERE s.user_id=q.user_id)
        AND NOT EXISTS(SELECT 1 FROM sr_blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=q.user_id) OR (b.blocked_id=$1 AND b.blocker_id=q.user_id))
        AND abs(q.rating-$2)<=LEAST(1000,GREATEST(250,EXTRACT(EPOCH FROM ($3::timestamptz-LEAST(q.joined_at,$4::timestamptz)))*10))
        ORDER BY q.joined_at,q.user_id LIMIT 1 FOR UPDATE OF q SKIP LOCKED`, [userId, rating, now, ownJoined])).rows[0];
      if (!opponent) return { status: 'queued', queuedAt: ownJoined, pollAfterMs: 2000, ratingWindow: Math.min(1000, Math.max(250, (this.clock() - millis(ownJoined)) / 100)) };
      const id = randomUUID(), startedAt = new Date(this.clock() + COUNTDOWN_MS);
      const match = new MatchSimulation({ seed: randomBytes(16).toString('hex'), playerIds: [opponent.user_id, userId] });
      await client.query('INSERT INTO sr_ranked_matches(id,player_one,player_two,snapshot,started_at,heartbeat_one,heartbeat_two) VALUES($1,$2,$3,$4,$5,$6,$6)', [id, opponent.user_id, userId, checkpoint(match), startedAt, now]);
      await client.query('INSERT INTO sr_ranked_seats(user_id,match_id) VALUES($1,$3),($2,$3)', [opponent.user_id, userId, id]);
      await client.query('DELETE FROM sr_ranked_queue WHERE user_id=$1 OR user_id=$2', [opponent.user_id, userId]);
      return { status: 'matched', matchId: id };
    });
  }
  async match(userId, id, { inputs, forfeit = false } = {}) {
    validateUuid(id);
    return this.store.tx(async client => {
      const row = (await client.query('SELECT * FROM sr_ranked_matches WHERE id=$1 AND (player_one=$2 OR player_two=$2) FOR UPDATE', [id, userId])).rows[0];
      if (!row) fail('match_not_found', 404);
      const now = this.clock();
      const match = MatchSimulation.restore(row.snapshot);
      advanceMatch(match, row, now);
      const inputResults = [];
      if (inputs && match.status === 'running' && now < millis(row.started_at)) fail('countdown_active', 409, { retryAfter: Math.max(1, Math.ceil((millis(row.started_at) - now) / 1000)) });
      if (forfeit && match.status === 'running') match._finish('forfeit', match.playerIds.find(id => id !== userId));
      if (inputs && match.status === 'running') {
        for (const input of inputs) {
          const accepted = match.receiveInput({ playerId: userId, ...input });
          inputResults.push({ seq: input.seq, ok: accepted.ok, ...(accepted.ok ? {} : { error: accepted.error }) });
          if (accepted.ok) {
            await client.query('INSERT INTO sr_match_inputs(match_id,user_id,seq,action,accepted_tick,receive_order) VALUES($1,$2,$3,$4,$5,$6)', [id, userId, input.seq, input.action, accepted.input.acceptedTick, accepted.input.order]);
          }
        }
      } else if (inputs) for (const input of inputs) inputResults.push({ seq: input.seq, ok: false, error: 'match_ended' });
      if (match.status === 'running') {
        if (row.player_one === userId) row.heartbeat_one = new Date(now); else row.heartbeat_two = new Date(now);
      }
      if (match.status === 'ended' && !row.settled_at) row.settlement = await this.settle(client, match, row, now);
      row.snapshot = checkpoint(match);
      await client.query('UPDATE sr_ranked_matches SET snapshot=$2,status=$3,result=$4,heartbeat_one=$5,heartbeat_two=$6,updated_at=now() WHERE id=$1', [id, row.snapshot, match.status, match.result, row.heartbeat_one, row.heartbeat_two]);
      const profiles = (await client.query('SELECT user_id,nickname,friend_code FROM sr_profiles WHERE user_id=$1 OR user_id=$2', match.playerIds)).rows;
      const players = Object.fromEntries(profiles.map(profile => [profile.user_id, { nickname: profile.nickname, friendCode: profile.friend_code }]));
      return { ...publicMatch(match, row, userId, players, now), ...(inputs ? { inputResults } : {}) };
    });
  }
  async settle(client, match, row, now) {
    const ids = [...match.playerIds].sort();
    for (const id of ids) await lockUser(client, id);
    const ratingRows = (await client.query('SELECT * FROM sr_ratings WHERE user_id=$1 OR user_id=$2 ORDER BY user_id FOR UPDATE', ids)).rows;
    const ratings = Object.fromEntries(ratingRows.map(rating => [rating.user_id, rating]));
    const [a, b] = match.playerIds;
    const winner = match.result.winnerId;
    const isVoid = match.result.reason === 'double_disconnect' || (match.games[a].stats.pieces === 0 && match.games[b].stats.pieces === 0);
    const resultA = winner === null ? 0.5 : winner === a ? 1 : 0;
    const updated = isVoid ? { a: ratings[a].rating, b: ratings[b].rating } : eloPair(ratings[a].rating, ratings[b].rating, resultA);
    const finalRating = { [a]: updated.a, [b]: updated.b };
    const activePlay = match.elapsedMs >= ECONOMY.minimumRewardMs && match.games[a].stats.pieces >= 5 && match.games[b].stats.pieces >= 5;
    const dayStart = utcDay(now), dayEnd = new Date(dayStart.getTime() + 86400000);
    const settlement = {};
    for (const userId of ids) {
      const opponent = userId === a ? b : a;
      const outcome = isVoid ? 'void' : winner === null ? 'draw' : winner === userId ? 'win' : 'loss';
      const prior = (await client.query(`SELECT count(*) FILTER(WHERE coins>0)::integer AS total,
        count(*) FILTER(WHERE coins>0 AND opponent_id=$2)::integer AS same_opponent
        FROM sr_rank_settlements WHERE user_id=$1 AND created_at >=$3 AND created_at<$4`, [userId, opponent, dayStart, dayEnd])).rows[0];
      let rewardReason = isVoid ? 'void_match' : !activePlay ? 'minimum_play_not_met' : prior.total >= ECONOMY.rewardedMatchesPerDay ? 'daily_reward_limit' : prior.same_opponent >= ECONOMY.rewardedSameOpponentPerDay ? 'opponent_reward_limit' : 'earned';
      const coins = rewardReason === 'earned' ? outcome === 'win' ? ECONOMY.rankedWin : outcome === 'draw' ? ECONOMY.rankedDraw : ECONOMY.rankedLoss : 0;
      if (!isVoid) await client.query('UPDATE sr_ratings SET rating=$2,games=games+1,wins=wins+$3,losses=losses+$4,draws=draws+$5,updated_at=now() WHERE user_id=$1', [userId, finalRating[userId], outcome === 'win' ? 1 : 0, outcome === 'loss' ? 1 : 0, outcome === 'draw' ? 1 : 0]);
      await client.query('INSERT INTO sr_rank_settlements(match_id,user_id,opponent_id,outcome,rating_before,rating_after,coins,reward_reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [row.id, userId, opponent, outcome, ratings[userId].rating, finalRating[userId], coins, rewardReason]);
      if (coins) await ledger(client, userId, coins, 'ranked_reward', `ranked:${row.id}`, { matchId: row.id, outcome });
      settlement[userId] = { outcome, ratingBefore: ratings[userId].rating, ratingAfter: finalRating[userId], coins, rewardReason };
    }
    await client.query('UPDATE sr_ranked_matches SET settlement=$2,settled_at=now() WHERE id=$1', [row.id, settlement]);
    await client.query('DELETE FROM sr_ranked_seats WHERE match_id=$1', [row.id]);
    return settlement;
  }
}
