// Engineering foundation only: deterministic match rules, with no network transport.
import { Game, WIDTH, HEIGHT, SHAPES } from '../dist/games/spinrealm/engine.mjs';
import { resolveExchange } from '../dist/games/spinrealm/combat.mjs';

export const SNAPSHOT_VERSION = 1;
export const RULES_VERSION = 'spinrealm-match-prototype-1';
export const TICK_HZ = 120;
export const TICK_MS = 1000 / TICK_HZ;
export const DURATION_TICKS = 120 * TICK_HZ;
export const GARBAGE_DELAY_MS = 1500;
export const MAX_INPUTS_PER_PLAYER_PER_TICK = 32;
export const INPUT_ACTIONS = Object.freeze(['left', 'right', 'soft', 'hard', 'cw', 'ccw', 'hold']);

const ACTIONS = new Set(INPUT_ACTIONS);
const PIECES = new Set(Object.keys(SHAPES));
const clone = value => JSON.parse(JSON.stringify(value));
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, min = 0) => Number.isSafeInteger(value) && value >= min;
const validSeed = seed => (typeof seed === 'string' && seed.length > 0 && seed.length <= 256) || Number.isSafeInteger(seed);
const invariant = (condition, message) => { if (!condition) throw new TypeError(`Invalid match snapshot: ${message}`); };
const sameKeys = (value, keys) => isObject(value) && Object.keys(value).length === keys.length && keys.every(key => own(value, key));
const sampleGame = new Game({ seed: 1 });
const GAME_KEYS = Object.keys(sampleGame);
const TURN_KEYS = Object.keys(sampleGame._turnStart);

function validateTurn(state, context) {
  invariant(isObject(state), `${context} must be an object`);
  invariant(Array.isArray(state.board) && state.board.length === HEIGHT && state.board.every(row =>
    Array.isArray(row) && row.length === WIDTH && row.every(cell => cell === null || cell === 'G' || PIECES.has(cell))), `${context}.board`);
  invariant(isObject(state.active) && PIECES.has(state.active.type) && integer(state.active.rotation) &&
    state.active.rotation < 4 && Number.isSafeInteger(state.active.x) && Number.isSafeInteger(state.active.y), `${context}.active`);
  invariant(Array.isArray(state.queue) && state.queue.length >= 7 && state.queue.every(piece => PIECES.has(piece)), `${context}.queue`);
  invariant(state.held === null || PIECES.has(state.held), `${context}.held`);
  invariant(typeof state.canHold === 'boolean' && typeof state._groundedEver === 'boolean', `${context}.flags`);
  invariant(['playing', 'over'].includes(state.status) && validSeed(state.seed), `${context}.status / seed`);
  invariant(sameKeys(state.stats, ['score', 'lines', 'pieces', 'combo', 'b2b', 'spins', 'attack']) &&
    Object.entries(state.stats).every(([key, value]) => integer(value, key === 'combo' ? -1 : 0)), `${context}.stats`);
  for (const key of ['_rng', '_garbageRng']) invariant(Number.isSafeInteger(state[key]) &&
    state[key] >= -2147483648 && state[key] <= 4294967295, `${context}.${key}`);
  for (const key of ['_gravityTimer', '_lockTimer']) invariant(Number.isFinite(state[key]) && state[key] >= 0, `${context}.${key}`);
  invariant(integer(state._resetCount) && state._resetCount <= 15, `${context}._resetCount`);
  invariant(state._lastRotation === null || (sameKeys(state._lastRotation, ['from', 'to', 'kickIndex']) &&
    integer(state._lastRotation.from) && state._lastRotation.from < 4 && integer(state._lastRotation.to) &&
    state._lastRotation.to < 4 && integer(state._lastRotation.kickIndex) && state._lastRotation.kickIndex < 5), `${context}._lastRotation`);
}

function validateGame(state, rules, context) {
  // Exact required fields prevent silently restoring a board without its RNG/timers.
  invariant(sameKeys(state, GAME_KEYS), `${context}: incomplete or unknown Game fields`);
  validateTurn(state, context);
  invariant(sameKeys(state.settings, ['gravity', 'lockDelay']) && state.settings.gravity === rules.gravity &&
    state.settings.lockDelay === rules.lockDelay, `${context}.settings must match shared rules`);
  invariant(Array.isArray(state.events), `${context}.events`);
  invariant(Array.isArray(state._history) && state._history.length <= 64, `${context}._history`);
  invariant(sameKeys(state._turnStart, TURN_KEYS), `${context}._turnStart fields`);
  validateTurn(state._turnStart, `${context}._turnStart`);
  state._history.forEach((turn, index) => {
    invariant(sameKeys(turn, TURN_KEYS), `${context}._history[${index}] fields`);
    validateTurn(turn, `${context}._history[${index}]`);
  });
}

/**
 * The owning server calls receiveInput() in receive order, then step() on a fixed
 * tick scheduler. acceptedTick is assigned here; clients never choose it.
 * No sockets, room service, persistence, authentication or wall clock is included.
 */
export class MatchSimulation {
  constructor({ seed, playerIds = ['p1', 'p2'], rules = {} } = {}) {
    if (!validSeed(seed)) throw new TypeError('A deterministic string or integer seed is required.');
    if (!Array.isArray(playerIds) || playerIds.length !== 2 || new Set(playerIds).size !== 2 ||
      playerIds.some(id => typeof id !== 'string' || !id.length || id.length > 128 || ['__proto__', 'constructor', 'prototype'].includes(id))) {
      throw new TypeError('Exactly two distinct player IDs are required.');
    }
    if (!isObject(rules) || Object.keys(rules).some(key => !['gravity', 'lockDelay'].includes(key))) throw new TypeError('Unknown match rule.');
    this.rules = { gravity: rules.gravity ?? 700, lockDelay: rules.lockDelay ?? 500 };
    if (!Number.isFinite(this.rules.gravity) || this.rules.gravity < 1 || this.rules.gravity > 60000 ||
      !Number.isFinite(this.rules.lockDelay) || this.rules.lockDelay < 200 || this.rules.lockDelay > 1000) throw new TypeError('Invalid shared gravity or lock delay.');
    this.seed = seed;
    this.playerIds = [...playerIds];
    this.games = Object.fromEntries(playerIds.map(id => [id, new Game({ seed, ...this.rules })]));
    this.incoming = Object.fromEntries(playerIds.map(id => [id, []]));
    this.totals = Object.fromEntries(playerIds.map(id => [id, { sent: 0, cancelled: 0 }]));
    this.lastAcceptedSeq = Object.fromEntries(playerIds.map(id => [id, 0]));
    this.lastAppliedSeq = Object.fromEntries(playerIds.map(id => [id, 0]));
    this.inputQueue = [];
    this.nextOrder = 1;
    this.tick = 0;
    this.status = 'running';
    this.result = null;
  }

  get elapsedMs() { return this.tick * 1000 / TICK_HZ; }
  get remainingMs() { return Math.max(0, 120000 - this.elapsedMs); }

  receiveInput(payload) {
    const reject = error => ({ ok: false, error });
    if (this.status !== 'running') return reject('match_ended');
    if (!sameKeys(payload, ['playerId', 'seq', 'action'])) return reject('invalid_payload');
    const { playerId, seq, action } = payload;
    if (typeof playerId !== 'string' || !own(this.games, playerId)) return reject('unknown_player');
    if (!integer(seq, 1)) return reject('invalid_seq');
    if (seq <= this.lastAcceptedSeq[playerId]) return reject('duplicate_or_stale_seq');
    if (!ACTIONS.has(action)) return reject('invalid_action');
    if (this.inputQueue.filter(input => input.playerId === playerId).length >= MAX_INPUTS_PER_PLAYER_PER_TICK) return reject('tick_input_limit');
    const input = { playerId, seq, action, acceptedTick: this.tick + 1, order: this.nextOrder++ };
    this.lastAcceptedSeq[playerId] = seq;
    this.inputQueue.push(input);
    return { ok: true, input: clone(input) };
  }

  _apply(game, action) {
    if (game.status !== 'playing') return false;
    switch (action) {
      case 'left': return game.move(-1);
      case 'right': return game.move(1);
      case 'soft': return game.softDrop();
      case 'hard': return game.hardDrop();
      case 'cw': return game.rotate(1);
      case 'ccw': return game.rotate(-1);
      case 'hold': return game.hold();
      default: throw new Error('Unvalidated action reached the simulation.');
    }
  }

  _deliverReady(id) {
    const game = this.games[id], queue = this.incoming[id];
    while (queue.length && queue[0].at <= this.elapsedMs + 1e-7 && game.status === 'playing') {
      game.addGarbage(queue.shift().n);
    }
  }

  _finish(reason, winnerId = null) {
    this.status = 'ended';
    this.result = {
      reason, winnerId, kind: winnerId === null ? 'tie' : 'win', tick: this.tick, elapsedMs: this.elapsedMs,
      netSent: Object.fromEntries(this.playerIds.map(id => [id, this.totals[id].sent])),
    };
  }

  /** Advance whole simulation ticks. Returns only the last tick's report. */
  step(count = 1) {
    if (!integer(count, 1) || count > DURATION_TICKS) throw new TypeError('step(count) requires 1–14400 whole ticks.');
    let report = null;
    for (let n = 0; n < count && this.status === 'running'; n++) {
      this.tick++;
      const inputs = this.inputQueue;
      this.inputQueue = [];
      const applied = inputs.map(input => {
        if (input.acceptedTick !== this.tick) throw new Error('Input tick did not match the authoritative queue.');
        const changed = this._apply(this.games[input.playerId], input.action);
        this.lastAppliedSeq[input.playerId] = input.seq;
        return { ...input, changed };
      });
      // Neither player's attacks can alter the other board before both reach this tick.
      for (const id of this.playerIds) this.games[id].step(TICK_MS);
      const events = Object.fromEntries(this.playerIds.map(id => [id, this.games[id].drainEvents()]));
      const locks = Object.fromEntries(this.playerIds.map(id => [id, events[id].filter(event => event.type === 'lock')]));
      const [a, b] = this.playerIds;
      const exchange = resolveExchange({
        playerQueue: this.incoming[a], cpuQueue: this.incoming[b],
        playerAttack: locks[a].reduce((sum, event) => sum + event.attack, 0),
        cpuAttack: locks[b].reduce((sum, event) => sum + event.attack, 0),
        now: this.elapsedMs, delay: GARBAGE_DELAY_MS,
      });
      this.totals[a].sent += exchange.playerSent;
      this.totals[b].sent += exchange.cpuSent;
      this.totals[a].cancelled += exchange.playerCancelled;
      this.totals[b].cancelled += exchange.cpuCancelled;
      for (const id of this.playerIds) {
        // Ready garbage enters only after a placement; that placement counters first.
        if (locks[id].length) this._deliverReady(id);
        events[id].push(...this.games[id].drainEvents());
      }
      const lost = this.playerIds.filter(id => this.games[id].status === 'over');
      if (lost.length) this._finish(lost.length === 2 ? 'double_topout' : 'topout', lost.length === 2 ? null : this.playerIds.find(id => id !== lost[0]));
      else if (this.tick >= DURATION_TICKS) this._finish('timeout', this.totals[a].sent === this.totals[b].sent ? null : this.totals[a].sent > this.totals[b].sent ? a : b);
      report = { tick: this.tick, elapsedMs: this.elapsedMs, applied, events, exchange, status: this.status, result: clone(this.result) };
    }
    return report;
  }

  snapshot() {
    // Copy every enumerable Game field, including history/turnStart. Board-only
    // snapshots lose bag/RNG/hold/lock state and cannot resume this ruleset correctly.
    return clone({
      schemaVersion: SNAPSHOT_VERSION, rulesVersion: RULES_VERSION,
      tickHz: TICK_HZ, durationTicks: DURATION_TICKS, garbageDelayMs: GARBAGE_DELAY_MS,
      seed: this.seed, playerIds: this.playerIds, rules: this.rules,
      tick: this.tick, elapsedMs: this.elapsedMs, status: this.status, result: this.result,
      games: Object.fromEntries(this.playerIds.map(id => [id, { ...this.games[id] }])),
      incoming: this.incoming, totals: this.totals, lastAcceptedSeq: this.lastAcceptedSeq,
      lastAppliedSeq: this.lastAppliedSeq, nextOrder: this.nextOrder, inputQueue: this.inputQueue,
    });
  }

  static restore(snapshot) {
    invariant(isObject(snapshot) && snapshot.schemaVersion === SNAPSHOT_VERSION && snapshot.rulesVersion === RULES_VERSION, 'unsupported schema or rules version');
    invariant(snapshot.tickHz === TICK_HZ && snapshot.durationTicks === DURATION_TICKS && snapshot.garbageDelayMs === GARBAGE_DELAY_MS, 'fixed timing rules');
    const match = new MatchSimulation({ seed: snapshot.seed, playerIds: snapshot.playerIds, rules: snapshot.rules });
    invariant(integer(snapshot.tick) && snapshot.tick <= DURATION_TICKS && snapshot.elapsedMs === snapshot.tick * 1000 / TICK_HZ, 'clock');
    invariant(['running', 'ended'].includes(snapshot.status), 'status');
    invariant(snapshot.status === 'ended' ? isObject(snapshot.result) : snapshot.result === null, 'result');
    invariant(snapshot.status === 'ended' || snapshot.tick < DURATION_TICKS, 'running beyond deadline');
    for (const field of ['games', 'incoming', 'totals', 'lastAcceptedSeq', 'lastAppliedSeq']) invariant(sameKeys(snapshot[field], match.playerIds), field);
    invariant(integer(snapshot.nextOrder, 1) && Array.isArray(snapshot.inputQueue), 'input queue / order');
    let priorOrder = 0;
    const queuedSeq = { ...snapshot.lastAppliedSeq };
    for (const input of snapshot.inputQueue) {
      invariant(sameKeys(input, ['playerId', 'seq', 'action', 'acceptedTick', 'order']) && own(match.games, input.playerId) &&
        integer(input.seq, 1) && input.seq > queuedSeq[input.playerId] && ACTIONS.has(input.action) && input.acceptedTick === snapshot.tick + 1 &&
        integer(input.order, 1) && input.order > priorOrder && input.order < snapshot.nextOrder, 'queued input');
      queuedSeq[input.playerId] = input.seq;priorOrder = input.order;
    }
    for (const id of match.playerIds) {
      validateGame(snapshot.games[id], match.rules, `games.${id}`);
      invariant(Array.isArray(snapshot.incoming[id]) && snapshot.incoming[id].every((packet, index, queue) =>
        sameKeys(packet, ['n', 'at']) && integer(packet.n, 1) && Number.isFinite(packet.at) && packet.at >= 0 &&
        (index === 0 || packet.at >= queue[index - 1].at)), `incoming.${id}`);
      invariant(sameKeys(snapshot.totals[id], ['sent', 'cancelled']) && Object.values(snapshot.totals[id]).every(value => integer(value)), `totals.${id}`);
      invariant(integer(snapshot.lastAppliedSeq[id]) && integer(snapshot.lastAcceptedSeq[id]) &&
        snapshot.lastAcceptedSeq[id] === queuedSeq[id], `sequence.${id}`);
      invariant(snapshot.inputQueue.filter(input => input.playerId === id).length <= MAX_INPUTS_PER_PLAYER_PER_TICK, `queued input limit.${id}`);
      Object.assign(match.games[id], clone(snapshot.games[id]));
    }
    for (const field of ['tick', 'status', 'result', 'incoming', 'totals', 'lastAcceptedSeq', 'lastAppliedSeq', 'nextOrder', 'inputQueue']) match[field] = clone(snapshot[field]);
    return match;
  }

  /** Replay trusted accepted records from a new match; this is not a client API. */
  static replay({ seed, playerIds = ['p1', 'p2'], rules = {}, inputs, untilTick }) {
    if (!Array.isArray(inputs) || !integer(untilTick) || untilTick > DURATION_TICKS) throw new TypeError('Invalid replay input list or target tick.');
    const match = new MatchSimulation({ seed, playerIds, rules });
    let cursor = 0;
    while (match.tick < untilTick && match.status === 'running') {
      while (cursor < inputs.length && inputs[cursor].acceptedTick === match.tick + 1) {
        const recorded = inputs[cursor++];
        if (!sameKeys(recorded, ['playerId', 'seq', 'action', 'acceptedTick', 'order'])) throw new TypeError('Invalid replay record.');
        const accepted = match.receiveInput({ playerId: recorded.playerId, seq: recorded.seq, action: recorded.action });
        if (!accepted.ok || accepted.input.order !== recorded.order) throw new TypeError(`Invalid replay sequence: ${accepted.error || 'receive order'}`);
      }
      if (cursor < inputs.length && (!integer(inputs[cursor].acceptedTick, 1) || inputs[cursor].acceptedTick <= match.tick)) throw new TypeError('Replay records are not ordered by accepted tick.');
      match.step();
    }
    if (cursor !== inputs.length || match.tick !== untilTick) throw new TypeError('Replay has unused inputs or an unreachable target tick.');
    return match;
  }
}
