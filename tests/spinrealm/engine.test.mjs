import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, WIDTH, HEIGHT, HIDDEN } from '../../dist/games/spinrealm/engine.mjs';

const empty = () => Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null));
const sequence = seed => {
  const game = new Game({ seed });
  const result = [];
  for (let i = 0; i < 35; i++) {
    result.push(game.active.type);
    game.hardDrop();
    game.board = empty();
  }
  return result;
};

test('same seed reproduces pieces; every seven-piece bag has each piece once', () => {
  const pieces = sequence('replay-test');
  assert.deepEqual(pieces, sequence('replay-test'));
  assert.notDeepEqual(pieces, sequence('another-seed'));
  for (let i = 0; i < pieces.length; i += 7) assert.equal(new Set(pieces.slice(i, i + 7)).size, 7);
});

test('every newly spawned piece is immediately inside the 20 visible rows', () => {
  const game = new Game({ seed: 'visible-spawn' });
  for (let i = 0; i < 14; i++) {
    assert.equal(game.active.y, HIDDEN);
    assert.equal(game.cells().every(([, y]) => y >= HIDDEN && y < HEIGHT), true);
    game.hardDrop();
    game.board = empty();
  }
  game.hold();
  assert.equal(game.cells().every(([, y]) => y >= HIDDEN && y < HEIGHT), true);
});

test('T floor rotation uses ordered SRS kick instead of failing or clipping', () => {
  const game = new Game({ seed: 1 });
  game.active = { type: 'T', x: 3, y: 20, rotation: 0 };
  assert.equal(game.collides(game.active), false);
  assert.equal(game.rotate(1), true);
  assert.deepEqual(game.active, { type: 'T', x: 2, y: 19, rotation: 1 });
  assert.equal(game.collides(game.active), false);
});

test('I piece uses its own two-cell wall kick', () => {
  const game = new Game({ seed: 1 });
  game.active = { type: 'I', x: -2, y: 6, rotation: 1 };
  assert.equal(game.collides(game.active), false);
  assert.equal(game.rotate(-1), true);
  assert.deepEqual(game.active, { type: 'I', x: 0, y: 6, rotation: 0 });
});

test('T-spin drill is a legal single CW rotation followed by double clear', () => {
  const game = new Game({ seed: 1 }).loadDrill('double');
  assert.equal(game.collides(game.active), false);
  assert.equal(game.rotate(1), true);
  assert.equal(game.collides(game.active), false);
  game.hardDrop();
  const event = game.drainEvents().find(e => e.type === 'lock');
  assert.equal(event.spin, 'full');
  assert.equal(event.lines, 2);
  assert.equal(event.attack, 4);
  assert.equal(event.perfectClear, false);
  assert.equal(game.stats.spins, 1);
  assert.equal(game.stats.b2b, 1);
});

test('dropping the unrotated drill piece does not invent a T-spin', () => {
  const game = new Game({ seed: 1 }).loadDrill('double');
  game.hardDrop();
  assert.equal(game.drainEvents().find(e => e.type === 'lock').spin, null);
});

test('lock delay allows last-moment rotation, and caps grounded resets at 15', () => {
  const game = new Game({ seed: 1, lockDelay: 500 }).loadDrill('double');
  game.step(490);
  assert.equal(game.stats.pieces, 0);
  assert.equal(game.rotate(1), true);
  game.step(490);
  assert.equal(game.stats.pieces, 0);
  game.step(10);
  assert.equal(game.stats.pieces, 1);

  const capped = new Game({ seed: 2, lockDelay: 500 });
  capped.active = { type: 'O', x: 3, y: 20, rotation: 0 };
  for (let i = 0; i < 15; i++) {
    capped.step(400);
    assert.equal(capped.move(i % 2 ? -1 : 1), true);
  }
  capped.step(400);
  assert.equal(capped.move(-1), true);
  capped.step(100);
  assert.equal(capped.stats.pieces, 1);
});

test('failed movement does not reset the lock timer', () => {
  const game = new Game({ seed: 1, lockDelay: 500 });
  game.active = { type: 'O', x: -1, y: 20, rotation: 0 };
  game.step(490);
  assert.equal(game.move(-1), false);
  game.step(10);
  assert.equal(game.stats.pieces, 1);
});

test('hold is once per piece and re-enabled only after placement', () => {
  const game = new Game({ seed: 'hold' });
  const first = game.active.type;
  const next = game.queue[0];
  assert.equal(game.hold(), true);
  assert.equal(game.active.type, next);
  assert.equal(game.held, first);
  assert.equal(game.hold(), false);
  game.hardDrop();
  assert.equal(game.hold(), true);
  assert.equal(game.active.type, first);
});

test('an occupied hold swaps only with HOLD and never consumes or rerolls NEXT', () => {
  const game = new Game({ seed: 'hold-queue' });
  const first = game.active.type;
  const next = game.queue[0];
  game.hold();
  assert.equal(game.active.type, next);
  const afterFirstHold = JSON.stringify({active:game.active, held:game.held, queue:game.queue, stats:game.stats});
  for (let i = 0; i < 8; i++) assert.equal(game.hold(), false);
  assert.equal(JSON.stringify({active:game.active, held:game.held, queue:game.queue, stats:game.stats}), afterFirstHold);
  game.hardDrop();
  const current = game.active.type;
  const queue = [...game.queue];
  assert.equal(game.hold(), true);
  assert.equal(game.active.type, first);
  assert.equal(game.held, current);
  assert.deepEqual(game.queue, queue);
});

test('holding the T in a drill does not count as a T-spin or a placement', () => {
  const game = new Game({ seed: 1 }).loadDrill('double');
  assert.equal(game.hold(), true);
  assert.equal(game.held, 'T');
  assert.equal(game.stats.pieces, 0);
  assert.equal(game.stats.spins, 0);
  assert.equal(game.stats.lines, 0);
  assert.deepEqual(game.drainEvents(), []);
});

test('undo restores the entire pre-turn drill and reproduces the same outcome', () => {
  const game = new Game({ seed: 1 }).loadDrill('double');
  const before = JSON.stringify({ board: game.board, active: game.active, queue: game.queue, stats: game.stats });
  game.rotate(1);
  game.hardDrop();
  const result = game.drainEvents();
  assert.equal(game.undo(), true);
  assert.equal(JSON.stringify({ board: game.board, active: game.active, queue: game.queue, stats: game.stats }), before);
  game.rotate(1);
  game.hardDrop();
  assert.deepEqual(game.drainEvents(), result);
});

test('garbage has one hole per row and never changes the seven-bag stream', () => {
  const a = new Game({ seed: 900 });
  const b = new Game({ seed: 900 });
  a.addGarbage(3, 4);
  for (const row of a.board.slice(-3)) {
    assert.equal(row.filter(Boolean).length, 9);
    assert.equal(row[4], null);
  }
  assert.deepEqual(a.queue, b.queue);
  a.board = empty();
  for (let i = 0; i < 20; i++) {
    a.addGarbage(1);
    a.board = empty();
    a.hardDrop(); b.hardDrop();
    a.board = empty(); b.board = empty();
    assert.equal(a.active.type, b.active.type);
  }
});

test('garbage overflow triggers a single game-over event', () => {
  const game = new Game({ seed: 1 });
  game.board[0][0] = 'G';
  game.addGarbage(1, 4);
  assert.equal(game.status, 'over');
  game.addGarbage(1, 4);
  assert.equal(game.drainEvents().filter(e => e.type === 'over').length, 1);
});

test('rotationCandidate is pure and returns the same legal result as rotate', () => {
  const game = new Game({ seed: 1 });
  game.active = { type: 'I', x: -2, y: 6, rotation: 1 };
  const before = JSON.stringify(game);
  const candidate = game.rotationCandidate(game.active, -1);
  assert.equal(JSON.stringify(game), before);
  game.rotate(-1);
  assert.deepEqual(game.active, candidate);
});
