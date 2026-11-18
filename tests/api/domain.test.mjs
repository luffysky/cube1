import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { ApiError, appearancePatch, eloPair, entitlement, publicMatch, verifyEntitlementSignature } from '../../server/api/domain.mjs';
import { advanceMatch, checkpoint, validateInputs } from '../../server/api/ranked.mjs';
import { MatchSimulation } from '../../server/match-simulation.mjs';

test('appearance cannot self-grant purchases or subscriptions', () => {
  assert.throws(() => appearancePatch({}, { theme: 'cyber' }, [], false), error => error.code === 'cosmetic_not_owned');
  assert.throws(() => appearancePatch({}, { customBackgroundEnabled: true }, [], false), error => error.code === 'subscription_required');
  assert.throws(() => appearancePatch({}, { imageUrl: 'https://tracker.invalid/x' }, [], true), error => error.code === 'invalid_payload');
  assert.equal(appearancePatch({}, { theme: 'snow', blocks: 'flat' }, [], false).theme, 'snow');
  assert.equal(appearancePatch({}, { theme: 'cyber' }, ['theme:cyber'], false).theme, 'cyber');
  assert.equal(entitlement({ plan: 'snowrealm_plus', status: 'active', expires_at: new Date(1) }, 2).plus, false);
});
test('Elo is symmetric and rewards an underdog more', () => {
  assert.deepEqual(eloPair(1000, 1000, 1), { a: 1016, b: 984 });
  assert.deepEqual(eloPair(1000, 1000, 0.5), { a: 1000, b: 1000 });
  const underdog = eloPair(800, 1400, 1);
  assert.ok(underdog.a - 800 > 16);
  assert.equal(underdog.a + underdog.b, 2200);
});
test('ranked input rejects user, score, clock and checkpoint injection', () => {
  for (const input of [{ seq: 1, action: 'hard', playerId: 'victim' }, { seq: 1, action: 'pause' }, { seq: 1, action: 'undo' }, { seq: -1, action: 'hard' }, { seq: 1, action: 'hard', acceptedTick: 1 }]) {
    assert.throws(() => validateInputs({ inputs: [input] }), ApiError);
  }
  assert.throws(() => validateInputs({ inputs: [{ seq: 2, action: 'left' }, { seq: 1, action: 'hard' }] }), ApiError);
  assert.throws(() => validateInputs({ inputs: [{ seq: 1, action: 'hard' }], score: 999999 }), ApiError);
  assert.equal(validateInputs({ inputs: [{ seq: 1, action: 'cw' }] }).length, 1);
});
test('server time caps simulation, supports reconnection, resolves stale seats', () => {
  const start = Date.now(), row = { started_at: new Date(start), heartbeat_one: new Date(start), heartbeat_two: new Date(start) };
  const match = new MatchSimulation({ seed: 'test', playerIds: ['alice', 'bob'] });
  advanceMatch(match, row, start + 5000);
  assert.equal(match.tick, 600);
  advanceMatch(match, row, start + 5000);
  assert.equal(match.tick, 600);
  row.heartbeat_one = new Date(start + 19000);
  advanceMatch(match, row, start + 21000);
  assert.equal(match.status, 'ended');
  assert.equal(match.result.reason, 'disconnect');
  assert.equal(match.result.winnerId, 'alice');
  assert.equal(match.elapsedMs, 20000);
});
test('public snapshot contains render data, never future RNG, checkpoint or input log', () => {
  const match = new MatchSimulation({ seed: 'secret_seed', playerIds: ['alice', 'bob'] });
  const row = { id: 'match', started_at: new Date() };
  const data = publicMatch(match, row, 'alice');
  assert.equal(data.games.alice.queue.length, 5);
  assert.equal(data.games.alice.board.length, 22);
  const encoded = JSON.stringify(data);
  for (const field of ['_rng', '_history', '_turnStart', 'secret_seed', 'inputQueue']) assert.equal(encoded.includes(field), false);
  assert.throws(() => publicMatch(match, row, 'stranger'), error => error.code === 'match_not_found');
  assert.deepEqual(MatchSimulation.restore(checkpoint(match)).snapshot(), checkpoint(match));
});
test('entitlement adapter verifies exact raw payload, timestamp and HMAC', () => {
  const secret = 'a-long-server-only-key-for-test-1234567890', now = Date.now(), t = Math.floor(now / 1000), raw = '{"eventId":"event1234"}';
  const signed = `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')}`;
  verifyEntitlementSignature(raw, signed, secret, now);
  assert.throws(() => verifyEntitlementSignature(raw + ' ', signed, secret, now), error => error.code === 'invalid_webhook_signature');
  assert.throws(() => verifyEntitlementSignature(raw, signed, secret, now + 301000), error => error.code === 'invalid_webhook_signature');
  assert.throws(() => verifyEntitlementSignature(raw, signed, '', now), error => error.code === 'billing_unavailable');
});
