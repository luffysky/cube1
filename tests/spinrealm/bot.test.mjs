import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, WIDTH, HEIGHT } from '../../dist/games/spinrealm/engine.mjs';
import { Bot, findPlan } from '../../dist/games/spinrealm/bot.mjs';

function playPlan(game, plan) {
  assert.equal(plan.at(-1), 'drop');
  for (const action of plan) {
    if (action === 'drop') game.hardDrop();
    else if (action === 'left') assert.equal(game.move(-1), true);
    else if (action === 'right') assert.equal(game.move(1), true);
    else if (action === 'cw') assert.equal(game.rotate(1), true);
    else if (action === 'ccw') assert.equal(game.rotate(-1), true);
    else assert.fail(`Unknown bot action ${action}`);
  }
}

test('planning leaves all engine state and events unchanged', () => {
  const game = new Game({ seed: 723 });
  game.addGarbage(4, 6);
  const before = JSON.stringify(game);
  const plan = findPlan(game);
  assert.deepEqual(findPlan(game), plan, 'same state gives the same plan');
  assert.equal(JSON.stringify(game), before);
  assert.ok(plan.length > 0 && plan.length <= 19);
});

test('plans use legal ordinary controls across hundreds of placements', () => {
  let totalPlaced = 0;
  let totalCleared = 0;
  for (const seed of [19, 723, 9182]) {
    const game = new Game({ seed });
    for (let i = 0; i < 180 && game.status === 'playing'; i++) {
      const before = game.stats.pieces;
      playPlan(game, findPlan(game));
      assert.equal(game.stats.pieces, before + 1);
      assert.equal(game.board.length, HEIGHT);
      assert.ok(game.board.every(row => row.length === WIDTH));
      assert.ok(!game.active || game.status !== 'playing' || !game.collides(game.active));
    }
    totalPlaced += game.stats.pieces;
    totalCleared += game.stats.lines;
  }
  assert.ok(totalPlaced >= 300, `CPU placed only ${totalPlaced} pieces`);
  assert.ok(totalCleared > 30, `CPU cleared only ${totalCleared} lines`);
});

test('visible controller waits for its pace and leaves lock events for caller', () => {
  const game = new Game({ seed: 234, gravity: 100000 });
  const bot = new Bot(game, { pps: 1 });
  for (let i = 0; i < 20; i++) bot.update(25);
  assert.equal(game.stats.pieces, 0);
  for (let i = 0; i < 22; i++) bot.update(25);
  assert.equal(game.stats.pieces, 1);
  assert.ok(game.events.some(event => event.type === 'lock'));
});

test('controller replans after gravity and garbage without illegal placement', () => {
  const game = new Game({ seed: 99, gravity: 200 });
  const bot = new Bot(game, { pps: 1.8 });
  for (let i = 0; i < 1800 && game.status === 'playing'; i++) {
    if (i === 70 || i === 310) game.addGarbage(1, 4);
    game.step(16);
    bot.update(16);
    if (game.status === 'playing') assert.equal(game.collides(game.active), false);
  }
  assert.ok(game.stats.pieces >= 20);
  assert.ok(game.stats.lines > 0);
});
