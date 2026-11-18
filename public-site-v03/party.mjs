// Party-mode rules only. Classic duel does not call this module.
// All timers use the caller's simulation elapsed time in milliseconds. Do not pass
// Date.now()/performance.now(): pausing must leave effects and cooldowns unchanged.
// State helpers are immutable; the only Game mutation is a successful cleanse,
// which atomically replaces game.board. It never changes scoring, RNG, SRS,
// active-piece position, lock timers, queued events, history, Hold or NEXT.
import { WIDTH, HEIGHT, SHAPES } from './engine.mjs';

export const PARTY_RULES = Object.freeze({
  version: 1, startingEnergy: 40, maxEnergy: 100, cooldownMs: 8000,
  energyPerLock: 5, energyPerLine: 8, energyPerSpin: 8,
});

export const ITEMS = Object.freeze({
  shield: Object.freeze({ id:'shield', name:'護盾', cost:35, durationMs:8000, rows:4,
    description:'8 秒內，吸收接下來入場的垃圾行，合計最多 4 行。' }),
  cleanse: Object.freeze({ id:'cleanse', name:'淨化', cost:50, rows:2,
    description:'由底部往上，移除最多 2 個純垃圾列；不加分、不產生攻擊。' }),
  pulse: Object.freeze({ id:'pulse', name:'震波', cost:45, attack:2,
    description:'送出 2 行攻擊，沿用 1.5 秒預警、互相抵消與護盾規則。' }),
});

export const PARTY_REASON_TEXT = Object.freeze({
  unknown_item:'沒有這個道具', invalid_state:'道具狀態無效', invalid_time:'對局時間無效',
  cooldown:'道具冷卻中', energy:'能量不足', game_over:'本局已結束', invalid_game:'棋盤狀態無效',
  game_required:'需要目前的棋盤', no_garbage:'棋盤上沒有可淨化的垃圾列',
  active_blocked:'先固定目前方塊，再使用淨化', invalid_limit:'淨化行數無效', shield_active:'護盾仍在生效',
});

const PIECES = new Set(Object.keys(SHAPES));
const finiteTime = value => Number.isFinite(value) && value >= 0;
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const isState = state => !!state && typeof state === 'object' && state.version === PARTY_RULES.version &&
  integer(state.energy, 0, PARTY_RULES.maxEnergy) && integer(state.shieldRemaining, 0, ITEMS.shield.rows) &&
  finiteTime(state.cooldownUntil) && finiteTime(state.shieldUntil) && finiteTime(state.updatedAt);
const validNow = (state, now) => finiteTime(now) && now >= state.updatedAt;
const assertState = state => { if (!isState(state)) throw new TypeError('Invalid party state.'); };
const assertNow = (state, now) => { if (!validNow(state, now)) throw new TypeError('Simulation elapsed time must be finite, nonnegative and monotonic.'); };

export function createPartyState() {
  return { version:PARTY_RULES.version, energy:PARTY_RULES.startingEnergy,
    cooldownUntil:0, shieldRemaining:0, shieldUntil:0, updatedAt:0 };
}

/** Consume each actual Game lock event exactly once, after drainEvents(). */
export function chargeEnergy(state, event) {
  assertState(state);
  if (!event || event.type !== 'lock' || !integer(event.lines, 0, 4)) return state;
  const spin = event.spin ?? null;
  if (![null, 'full', 'mini'].includes(spin) || (spin && event.lines > 3) ||
    (event.placedType !== undefined && !PIECES.has(event.placedType)) ||
    (spin && event.placedType !== undefined && event.placedType !== 'T')) return state;
  const gain = PARTY_RULES.energyPerLock + event.lines * PARTY_RULES.energyPerLine + (spin ? PARTY_RULES.energyPerSpin : 0);
  return { ...state, energy:Math.min(PARTY_RULES.maxEnergy, state.energy + gain) };
}

/** UI status: Remaining durations and expiry timestamps are milliseconds. */
export function getPartyStatus(state, now) {
  assertState(state);assertNow(state, now);
  const shieldRemainingMs = state.shieldRemaining > 0 ? Math.max(0, state.shieldUntil - now) : 0;
  return {
    energy:state.energy, energyMax:PARTY_RULES.maxEnergy,
    cooldownRemaining:Math.max(0, state.cooldownUntil - now), cooldownUntil:state.cooldownUntil,
    shieldRemaining:shieldRemainingMs > 0 ? state.shieldRemaining : 0,
    shieldRemainingMs, shieldExpiresAt:state.shieldUntil,
  };
}

function atTime(state, now) {
  const next = { ...state, updatedAt:now };
  if (next.shieldUntil <= now || next.shieldRemaining === 0) {
    next.shieldUntil = 0;next.shieldRemaining = 0;
  }
  return next;
}

const validBoard = board => Array.isArray(board) && board.length === HEIGHT && board.every(row =>
  Array.isArray(row) && row.length === WIDTH && row.every(cell => cell === null || cell === 'G' || PIECES.has(cell)));
const pureGarbage = row => row.some(cell => cell === 'G') && row.every(cell => cell === null || cell === 'G');

/** A genuine garbage row has G as its only nonempty cell type. Mixed-color rows are never removed. */
export function countGarbageRows(game) {
  return validBoard(game?.board) ? game.board.filter(pureGarbage).length : 0;
}

function legalActive(game, board) {
  try {
    const cells = game.cells(game.active);
    return cells.length === 4 && cells.every(([x,y]) => Number.isInteger(x) && Number.isInteger(y) &&
      x >= 0 && x < WIDTH && y >= -4 && y < HEIGHT && (y < 0 || !board[y][x]));
  } catch { return false; }
}

function cleansePlan(game, maxRows = ITEMS.cleanse.rows) {
  const fail = reason => ({ ok:false, reason, removed:0, rows:[] });
  if (!integer(maxRows, 1, ITEMS.cleanse.rows)) return fail('invalid_limit');
  if (!game) return fail('game_required');
  if (game.status === 'over') return fail('game_over');
  if (game.status !== 'playing' || !validBoard(game.board) || !game.active || typeof game.cells !== 'function') return fail('invalid_game');
  if (!legalActive(game, game.board)) return fail('active_blocked');
  const candidates = [];
  for (let y=HEIGHT-1;y>=0 && candidates.length<maxRows;y--) if (pureGarbage(game.board[y])) candidates.push(y);
  if (!candidates.length) return fail('no_garbage');
  // Removing rows drops the stack above them. Try two rows, then one, and refuse
  // the action if that stack would overlap the unchanged active piece.
  for (let count=candidates.length;count>0;count--) {
    const rows = candidates.slice(0,count);
    const board = game.board.filter((_,y) => !rows.includes(y)).map(row => row.slice());
    while (board.length < HEIGHT) board.unshift(Array(WIDTH).fill(null));
    if (legalActive(game,board)) return { ok:true, reason:null, removed:count, rows, board };
  }
  return fail('active_blocked');
}

/**
 * Safe standalone mutation. HEIGHT is 22 in this engine, already including its
 * two hidden rows. No extra rows are added beyond that exact original height.
 * The CPU notices the changed board stamp and replans on its next update.
 */
export function cleanseGarbage(game, maxRows = ITEMS.cleanse.rows) {
  const plan = cleansePlan(game,maxRows);
  if (!plan.ok) return plan;
  game.board = plan.board;
  return { ok:true, reason:null, removed:plan.removed, rows:plan.rows };
}

export function canUseItem(state, itemId, now, { game } = {}) {
  const item = ITEMS[itemId];
  const result = (ok,reason=null,extra={}) => ({ ok,reason,cost:item?.cost ?? 0,...extra });
  if (!Object.prototype.hasOwnProperty.call(ITEMS,itemId)) return result(false,'unknown_item');
  if (!isState(state)) return result(false,'invalid_state');
  if (!validNow(state,now)) return result(false,'invalid_time');
  if (game && game.status !== 'playing') return result(false,game.status === 'over'?'game_over':'invalid_game');
  if (state.cooldownUntil > now) return result(false,'cooldown',{cooldownRemaining:state.cooldownUntil-now});
  if (state.energy < item.cost) return result(false,'energy');
  if (itemId === 'shield' && getPartyStatus(state,now).shieldRemaining > 0) return result(false,'shield_active');
  if (itemId === 'cleanse') {
    const plan = cleansePlan(game,item.rows);
    if (!plan.ok) return result(false,plan.reason);
    return result(true,null,{removed:plan.removed});
  }
  return result(true);
}

/**
 * Returns {ok,reason,state,attack,removed,...}. Assign the returned state.
 * Pulse's attack must enter the same resolveExchange pass as BOTH players'
 * ordinary attacks. Do not directly append garbage or grant score/lock events.
 */
export function useItem(state, itemId, now, { game } = {}) {
  const check = canUseItem(state,itemId,now,{game});
  const fail = reason => ({ok:false,reason,cost:check.cost,state,attack:0,removed:0});
  if (!check.ok) return fail(check.reason);
  let removed = 0;
  if (itemId === 'cleanse') {
    const cleaned = cleanseGarbage(game,ITEMS.cleanse.rows);
    if (!cleaned.ok) return fail(cleaned.reason);
    removed = cleaned.removed;
  }
  const next = atTime(state,now);
  next.energy -= check.cost;
  next.cooldownUntil = now + PARTY_RULES.cooldownMs;
  if (itemId === 'shield') {
    next.shieldRemaining = ITEMS.shield.rows;
    next.shieldUntil = now + ITEMS.shield.durationMs;
  }
  return {ok:true,reason:null,itemId,cost:check.cost,state:next,
    attack:itemId === 'pulse'?ITEMS.pulse.attack:0,removed,
    shieldGranted:itemId === 'shield'?ITEMS.shield.rows:0};
}

/** Call AFTER ordinary counters, immediately before due garbage enters a board. */
export function absorbGarbage(state, rows, now) {
  assertState(state);assertNow(state,now);
  if (!integer(rows,0,Number.MAX_SAFE_INTEGER)) throw new TypeError('Garbage rows must be a nonnegative safe integer.');
  const next = atTime(state,now);
  const absorbed = Math.min(rows,next.shieldRemaining);
  next.shieldRemaining -= absorbed;
  if (!next.shieldRemaining) next.shieldUntil = 0;
  return {state:next,absorbed,remaining:rows-absorbed};
}

/** Deterministic CPU policy. It uses the exact same availability/cost rules. */
export function chooseCpuItem(state, now, { game, incoming = [] } = {}) {
  if (!isState(state) || !validNow(state,now) || !game || game.status !== 'playing' || !validBoard(game.board)) return null;
  const status = getPartyStatus(state,now);
  if (status.cooldownRemaining > 0) return null;
  const upcoming = Array.isArray(incoming) ? incoming.filter(packet => packet && integer(packet.n,1,Number.MAX_SAFE_INTEGER) &&
    finiteTime(packet.at) && packet.at <= now+2500).reduce((sum,packet) => sum+packet.n,0) : 0;
  const first = game.board.findIndex(row => row.some(Boolean));
  const height = first < 0 ? 0 : HEIGHT-first;
  const garbage = countGarbageRows(game);
  const available = itemId => canUseItem(state,itemId,now,{game}).ok;
  if (garbage > 0 && height >= 12 && available('cleanse')) return 'cleanse';
  if (upcoming >= 2 && status.shieldRemaining === 0 && available('shield')) return 'shield';
  if (garbage >= 2 && available('cleanse')) return 'cleanse';
  if (state.energy >= 65 && upcoming < 2 && available('pulse')) return 'pulse';
  return null;
}
