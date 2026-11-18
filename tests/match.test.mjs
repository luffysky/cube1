import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../dist/games/spinrealm/engine.mjs';
import {
  MatchSimulation, TICK_HZ, TICK_MS, DURATION_TICKS, SNAPSHOT_VERSION, MAX_INPUTS_PER_PLAYER_PER_TICK,
} from '../server/match-simulation.mjs';

const send = (match, id, action) => {
  const result = match.receiveInput({ playerId: id, seq: match.lastAcceptedSeq[id] + 1, action });
  assert.equal(result.ok, true, result.error);
  return result.input;
};
const jsonCopy = value => JSON.parse(JSON.stringify(value));
const setupDrill = (match, id) => match.games[id].loadDrill('double');
const spinDouble = (match, id) => { send(match, id, 'cw');send(match, id, 'hard'); };

test('same seed and accepted input log replay to the complete identical state', () => {
  const seed = 'recorded-match';
  const original = new MatchSimulation({ seed, playerIds: ['luffy', 'mica'] });
  const inputs = [];
  while (original.tick < 600 && original.status === 'running') {
    if (original.tick % 28 === 0) for (const [index, id] of original.playerIds.entries()) {
      if (original.tick % 84 === 0) inputs.push(send(original, id, 'hold'));
      inputs.push(send(original, id, index ? 'ccw' : 'cw'));
      const direction = (Math.floor(original.tick / 28) + index) % 2 ? 'left' : 'right';
      for (let i = 0; i < 3; i++) inputs.push(send(original, id, direction));
      inputs.push(send(original, id, 'hard'));
    }
    original.step();
  }
  assert.ok(inputs.length > 60);
  assert.ok(original.games.luffy.stats.pieces >= 8);
  const replayed = MatchSimulation.replay({ seed, playerIds: ['luffy', 'mica'], inputs: jsonCopy(inputs), untilTick: original.tick });
  assert.deepEqual(replayed.snapshot(), original.snapshot());
});

test('JSON snapshot restores RNG, bag queue, hold, active lock timers, pending garbage and unprocessed input', () => {
  const original = new MatchSimulation({ seed: 'checkpoint' });
  setupDrill(original, 'p1');spinDouble(original, 'p1');
  send(original, 'p2', 'hold');
  for (let i = 0; i < 22; i++) send(original, 'p2', 'soft');
  original.step(12);
  assert.equal(original.incoming.p2[0].n, 4);
  assert.ok(original.games.p2._lockTimer > 0);
  assert.equal(original.games.p2.canHold, false);
  send(original, 'p2', 'left');
  const checkpoint = jsonCopy(original.snapshot());
  const restored = MatchSimulation.restore(checkpoint);
  assert.ok(restored.games.p1 instanceof Game);
  assert.deepEqual(restored.snapshot(), checkpoint);
  assert.equal(restored.inputQueue.length, 1);
  for (let tick = original.tick; tick < 640 && original.status === 'running'; tick++) {
    for (const match of [original, restored]) {
      if (tick >= 190 && (tick - 190) % 40 === 0) {
        const direction = Math.floor((tick - 190) / 40) % 2 ? 'left' : 'right';
        send(match, 'p2', 'hold');
        for (const id of match.playerIds) {
          for(let shift=0;shift<3;shift++)send(match,id,direction);
          send(match,id,'hard');
        }
      }
      match.step();
    }
  }
  assert.deepEqual(restored.snapshot(), original.snapshot());
  assert.notEqual(original.games.p2._garbageRng, checkpoint.games.p2._garbageRng);
  assert.notEqual(original.games.p1._rng, checkpoint.games.p1._rng, 'continuation must consume enough pieces to draw a new bag');
  assert.ok(original.games.p1._history.length > checkpoint.games.p1._history.length);
  checkpoint.games.p1.board[21][0] = 'Z';
  assert.deepEqual(restored.snapshot(), original.snapshot(), 'restored state must not alias the supplied snapshot');
});

test('equal same-tick T-spin attacks cancel symmetrically regardless of receive order', () => {
  const a = new MatchSimulation({ seed: 'symmetry' }), b = new MatchSimulation({ seed: 'symmetry' });
  for (const match of [a, b]) for (const id of match.playerIds) setupDrill(match, id);
  spinDouble(a, 'p1');spinDouble(a, 'p2');
  spinDouble(b, 'p2');spinDouble(b, 'p1');
  const ra = a.step(), rb = b.step();
  assert.deepEqual(ra.exchange, rb.exchange);
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.deepEqual(a.totals, { p1: {sent:0,cancelled:4}, p2: {sent:0,cancelled:4} });
  assert.deepEqual(a.incoming, {p1:[],p2:[]});
});

test('unequal simultaneous attacks produce the same remainder when player sides are mirrored', () => {
  function ordinaryDouble(match,id) {
    const game=match.games[id];
    for(const y of [20,21])for(let x=0;x<10;x++)if(![4,5].includes(x))game.board[y][x]='G';
    game.board[19][0]='G'; // Prevent a perfect-clear bonus.
    game.active={type:'O',x:3,y:20,rotation:0};
    game._turnStart=game._snapshot();
  }
  const a=new MatchSimulation({seed:'mirror'}),b=new MatchSimulation({seed:'mirror'});
  setupDrill(a,'p1');ordinaryDouble(a,'p2');
  ordinaryDouble(b,'p1');setupDrill(b,'p2');
  spinDouble(a,'p1');send(a,'p2','hard');
  send(b,'p1','hard');spinDouble(b,'p2');
  a.step();b.step();
  assert.deepEqual(a.totals.p1,{sent:3,cancelled:1});
  assert.deepEqual(a.totals.p2,{sent:0,cancelled:1});
  assert.deepEqual(a.totals.p1,b.totals.p2);
  assert.deepEqual(a.totals.p2,b.totals.p1);
  assert.deepEqual(a.incoming.p2,b.incoming.p1);
  assert.deepEqual(a.snapshot().games.p1,b.snapshot().games.p2);
  assert.deepEqual(a.snapshot().games.p2,b.snapshot().games.p1);
});

test('garbage waits 1.5 seconds and then waits for the receiving player to lock', () => {
  const match = new MatchSimulation({ seed: 'garbage-time' });
  setupDrill(match, 'p1');spinDouble(match, 'p1');
  match.step();
  const arrival = match.incoming.p2[0].at;
  assert.equal(arrival, TICK_MS + 1500);
  send(match, 'p2', 'hard');match.step();
  assert.equal(match.incoming.p2.length, 1, 'early lock must not deliver');
  match.step(180);
  assert.ok(match.elapsedMs >= arrival);
  assert.equal(match.incoming.p2.length, 1, 'expiry alone must not deliver');
  send(match, 'p2', 'hard');match.step();
  assert.equal(match.incoming.p2.length, 0);
  assert.equal(match.games.p2.board.flat().filter(cell => cell === 'G').length, 36);
  assert.equal(match.totals.p1.sent, 4);
});

test('120-second deadline uses the exact integer tick count and net sent winner', () => {
  const match = new MatchSimulation({ seed: 'deadline', rules: { gravity: 10000 } });
  setupDrill(match, 'p1');spinDouble(match, 'p1');match.step();
  match.step(DURATION_TICKS - 2);
  assert.equal(match.status, 'running');
  assert.equal(match.tick, 120 * TICK_HZ - 1);
  match.step();
  assert.equal(match.status, 'ended');
  assert.equal(match.elapsedMs, 120000);
  assert.equal(match.result.reason, 'timeout');
  assert.equal(match.result.winnerId, 'p1');
  assert.deepEqual(match.result.netSent, {p1:4,p2:0});
  assert.equal(match.step(), null);
  assert.equal(match.tick, DURATION_TICKS);
  assert.equal(match.receiveInput({playerId:'p1',seq:99,action:'left'}).error, 'match_ended');
});

test('both players finish the tick before a simultaneous topout is declared a tie', () => {
  const match = new MatchSimulation({ seed: 'topout' });
  for (const id of match.playerIds) {
    const game = match.games[id];
    game.active = {type:'O',x:0,y:20,rotation:0};
    for (const y of [2,3]) for (const x of [3,4,5,6]) game.board[y][x] = 'G';
    send(match, id, 'hard');
  }
  const report = match.step();
  assert.equal(report.applied.length, 2);
  assert.equal(match.games.p1.stats.pieces, 1);
  assert.equal(match.games.p2.stats.pieces, 1);
  assert.equal(match.result.reason, 'double_topout');
  assert.equal(match.result.winnerId, null);
});

test('invalid action/seq/player/tick injection is rejected without consuming sequence or mutating the queue', () => {
  const match = new MatchSimulation({ seed: 'validation' });
  for (const payload of [
    null, {}, {playerId:'outsider',seq:1,action:'left'}, {playerId:'p1',seq:0,action:'left'},
    {playerId:'p1',seq:-1,action:'left'}, {playerId:'p1',seq:1.5,action:'left'},
    {playerId:'p1',seq:'1',action:'left'}, {playerId:'p1',seq:1,action:'undo'},
    {playerId:'p1',seq:1,action:'pause'}, {playerId:'p1',seq:1,action:'left',acceptedTick:0},
  ]) assert.equal(match.receiveInput(payload).ok, false);
  assert.equal(match.lastAcceptedSeq.p1, 0);
  assert.equal(match.inputQueue.length, 0);
  const input = send(match, 'p1', 'hold');
  assert.equal(input.acceptedTick, 1);
  assert.equal(match.receiveInput({playerId:'p1',seq:1,action:'hard'}).error, 'duplicate_or_stale_seq');
  match.step();
  assert.equal(match.receiveInput({playerId:'p1',seq:1,action:'hard'}).error, 'duplicate_or_stale_seq');
  assert.equal(match.lastAppliedSeq.p1, 1);
  assert.equal(match.games.p1.stats.pieces, 0);
  assert.equal(match.games.p1.canHold, false);
});

test('bounded queued input cannot overflow one player tick and rejected seq can be retried', () => {
  const match = new MatchSimulation({ seed: 'bounded' });
  for (let i=0;i<MAX_INPUTS_PER_PLAYER_PER_TICK;i++)send(match,'p1','left');
  const seq=match.lastAcceptedSeq.p1+1;
  assert.equal(match.receiveInput({playerId:'p1',seq,action:'right'}).error,'tick_input_limit');
  match.step();
  assert.equal(match.receiveInput({playerId:'p1',seq,action:'right'}).ok,true);
});

test('restore rejects incompatible snapshots and missing hidden engine state', () => {
  const saved = new MatchSimulation({ seed: 'schema' }).snapshot();
  assert.equal(saved.schemaVersion, SNAPSHOT_VERSION);
  for (const mutate of [
    value=>value.schemaVersion++, value=>value.rulesVersion='unknown',
    value=>delete value.games.p1._rng, value=>delete value.games.p2._turnStart,
    value=>value.elapsedMs=1, value=>value.games.p1.settings.lockDelay=900,
    value=>value.lastAcceptedSeq.p1=20,
  ]) {
    const invalid=jsonCopy(saved);mutate(invalid);
    assert.throws(()=>MatchSimulation.restore(invalid), /Invalid match snapshot/);
  }
});
