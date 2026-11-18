import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { CATALOG_BY_ID, DEFAULT_APPEARANCE, FREE_COSMETICS, rankTier } from '../../dist/platform/catalog.mjs';

export class ApiError extends Error {
  constructor(code, status = 400, details = undefined) { super(code); this.code = code; this.status = status; this.details = details; }
}
export const fail = (code, status = 400, details) => { throw new ApiError(code, status, details); };
export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function exactKeys(value, allowed, required = []) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(value, key))) fail('invalid_payload');
  return value;
}
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const isUuid = value => typeof value === 'string' && /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value);
export const validateUuid = value => { if (!isUuid(value)) fail('invalid_id'); return value; };
export function friendCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...randomBytes(12)].map(value => alphabet[value % alphabet.length]).join('');
}
export function nickname(value) {
  if (typeof value !== 'string') fail('invalid_nickname');
  const normalized = value.normalize('NFKC').trim();
  if ([...normalized].length < 2 || [...normalized].length > 24 || /[\p{Cc}\p{Cf}<>]/u.test(normalized)) fail('invalid_nickname');
  return normalized;
}
export function requestKey(request) {
  const value = request.headers.get('idempotency-key');
  if (!value || !/^[\w:.-]{8,100}$/.test(value)) fail('idempotency_key_required');
  return value;
}
export function entitlement(row, now = Date.now()) {
  const plus = Boolean(row?.plan === 'snowrealm_plus' && row.status === 'active' && row.expires_at && new Date(row.expires_at).getTime() > now);
  return { plus, customImages: plus, plan: plus ? 'snowrealm_plus' : 'free', expiresAt: row?.expires_at || null, billingAvailable: false };
}
export function rank(row = {}) {
  const rating = Number(row.rating ?? 1000), games = Number(row.games ?? 0);
  return { rating, games, wins: Number(row.wins || 0), losses: Number(row.losses || 0), draws: Number(row.draws || 0), tier: rankTier(rating), provisional: games < 5, placementGames: 5 };
}
export function appearancePatch(current, patch, owned, plus) {
  exactKeys(patch, Object.keys(DEFAULT_APPEARANCE));
  const result = { ...DEFAULT_APPEARANCE, ...current };
  const available = new Set([...FREE_COSMETICS, ...owned]);
  for (const category of ['theme', 'blocks', 'board', 'background']) {
    if (!Object.hasOwn(patch, category)) continue;
    const id = `${category}:${patch[category]}`;
    if (!CATALOG_BY_ID[id] || CATALOG_BY_ID[id].kind !== 'cosmetic') fail('invalid_appearance');
    if (!available.has(id)) fail('cosmetic_not_owned', 403, { itemId: id });
    result[category] = patch[category];
  }
  if (Object.hasOwn(patch, 'boardOverlay')) {
    if (typeof patch.boardOverlay !== 'number' || !Number.isFinite(patch.boardOverlay) || patch.boardOverlay < 0.45 || patch.boardOverlay > 0.95) fail('invalid_appearance');
    result.boardOverlay = Math.round(patch.boardOverlay * 100) / 100;
  }
  if (Object.hasOwn(patch, 'customTarget')) {
    if (!['background', 'board'].includes(patch.customTarget)) fail('invalid_appearance');
    result.customTarget = patch.customTarget;
  }
  if (Object.hasOwn(patch, 'customBackgroundEnabled')) {
    if (typeof patch.customBackgroundEnabled !== 'boolean') fail('invalid_appearance');
    if (patch.customBackgroundEnabled && !plus) fail('subscription_required', 403);
    result.customBackgroundEnabled = patch.customBackgroundEnabled;
  }
  if (!plus) result.customBackgroundEnabled = false;
  return result;
}
export function eloPair(a, b, outcomeA, k = 32) {
  if (![0, 0.5, 1].includes(outcomeA) || !Number.isFinite(a) || !Number.isFinite(b)) throw new TypeError('Invalid Elo inputs');
  const delta = Math.round(k * (outcomeA - 1 / (1 + 10 ** ((b - a) / 400))));
  return { a: Math.max(0, a + delta), b: Math.max(0, b - delta) };
}
export function publicGame(game) {
  return { board: game.board, active: game.active, held: game.held, canHold: game.canHold, queue: game.queue.slice(0, 5), status: game.status, stats: game.stats, ghost: game.ghost(), cells: game.cells() };
}
export function publicMatch(match, row, userId, players = {}, now = Date.now()) {
  if (!match.playerIds.includes(userId)) fail('match_not_found', 404);
  return {
    id: row.id, mode: 'ranked', status: match.status, you: userId, players,
    startedAt: row.started_at, serverNow: new Date(now).toISOString(), countdownMs: Math.max(0, new Date(row.started_at).getTime() - now),
    tick: match.tick, remainingMs: match.remainingMs, elapsedMs: match.elapsedMs,
    games: Object.fromEntries(match.playerIds.map(id => [id, publicGame(match.games[id])])),
    incoming: match.incoming, totals: match.totals, lastAcceptedSeq: match.lastAcceptedSeq, lastAppliedSeq: match.lastAppliedSeq,
    result: match.result, settlement: row.settlement || null, rules: { gravity: match.rules.gravity, lockDelay: match.rules.lockDelay, durationMs: 120000, itemsAllowed: false },
    pollAfterMs: match.status === 'running' ? 250 : 0,
  };
}
// This is a server-to-server adapter, not a payment provider or checkout service.
// The future payment adapter must verify the provider event before signing it.
export function verifyEntitlementSignature(raw, header, secret, now = Date.now()) {
  if (!secret || secret.length < 32) fail('billing_unavailable', 503);
  const match = /^t=(\d{10}),v1=([a-f0-9]{64})$/.exec(header || '');
  if (!match || Math.abs(now / 1000 - Number(match[1])) > 300) fail('invalid_webhook_signature', 401);
  const expected = createHmac('sha256', secret).update(`${match[1]}.${raw}`).digest();
  const supplied = Buffer.from(match[2], 'hex');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) fail('invalid_webhook_signature', 401);
}
export async function readBody(request, limit = 32768) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) fail('json_required', 415);
  if (Number(request.headers.get('content-length') || 0) > limit) fail('payload_too_large', 413);
  const reader = request.body?.getReader();
  if (!reader) fail('invalid_payload');
  const chunks = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) { await reader.cancel(); fail('payload_too_large', 413); }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  let data;
  try { data = JSON.parse(raw); } catch { fail('invalid_json'); }
  return { raw, data };
}
