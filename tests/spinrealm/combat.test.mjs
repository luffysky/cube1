import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveExchange } from '../../dist/games/spinrealm/combat.mjs';

test('equal simultaneous attacks cancel with no first-player score advantage', () => {
  const playerQueue = [], cpuQueue = [];
  const result = resolveExchange({ playerQueue, cpuQueue, playerAttack: 4, cpuAttack: 4, now: 1000 });
  assert.deepEqual(result, { playerSent: 0, cpuSent: 0, playerCancelled: 4, cpuCancelled: 4 });
  assert.deepEqual(playerQueue, []);
  assert.deepEqual(cpuQueue, []);
});

test('existing incoming attacks are cancelled FIFO and partial packets retain their time', () => {
  const playerQueue = [{ n: 3, at: 100 }, { n: 5, at: 200 }];
  const cpuQueue = [{ n: 2, at: 150 }];
  const result = resolveExchange({ playerQueue, cpuQueue, playerAttack: 4, cpuAttack: 1, now: 1000 });
  assert.deepEqual(result, { playerSent: 0, cpuSent: 0, playerCancelled: 4, cpuCancelled: 1 });
  assert.deepEqual(playerQueue, [{ n: 4, at: 200 }]);
  assert.deepEqual(cpuQueue, [{ n: 1, at: 150 }]);
});

test('new remainders counter each other only after each side counters existing incoming', () => {
  const playerQueue = [{ n: 2, at: 900 }];
  const cpuQueue = [{ n: 1, at: 800 }];
  const result = resolveExchange({ playerQueue, cpuQueue, playerAttack: 8, cpuAttack: 4, now: 1000 });
  assert.deepEqual(result, { playerSent: 3, cpuSent: 0, playerCancelled: 5, cpuCancelled: 4 });
  assert.deepEqual(playerQueue, []);
  assert.deepEqual(cpuQueue, [{ n: 3, at: 2500 }]);
});

test('one-sided attack is sent to the opponent with the specified delay', () => {
  const playerQueue = [], cpuQueue = [];
  const result = resolveExchange({ playerQueue, cpuQueue, playerAttack: 0, cpuAttack: 6, now: 3450, delay: 750 });
  assert.deepEqual(result, { playerSent: 0, cpuSent: 6, playerCancelled: 0, cpuCancelled: 0 });
  assert.deepEqual(playerQueue, [{ n: 6, at: 4200 }]);
  assert.deepEqual(cpuQueue, []);
});

test('sending new packets preserves previously queued attacks and packet order', () => {
  const playerQueue = [];
  const cpuQueue = [{ n: 2, at: 2000 }];
  const result = resolveExchange({ playerQueue, cpuQueue, playerAttack: 3, cpuAttack: 0, now: 1000 });
  assert.equal(result.playerSent, 3);
  assert.deepEqual(cpuQueue, [{ n: 2, at: 2000 }, { n: 3, at: 2500 }]);
});

test('swapping the two sides preserves the complete mirrored outcome', () => {
  for (const [pAttack, cAttack, pIncoming, cIncoming] of [
    [4, 4, 0, 0], [8, 4, 2, 1], [1, 7, 4, 2], [0, 9, 3, 6], [10, 1, 7, 9],
  ]) {
    const initialPlayer = pIncoming ? [{ n: pIncoming, at: 900 }] : [];
    const initialCpu = cIncoming ? [{ n: cIncoming, at: 950 }] : [];
    const playerQueue = structuredClone(initialPlayer), cpuQueue = structuredClone(initialCpu);
    const mirroredPlayer = structuredClone(initialCpu), mirroredCpu = structuredClone(initialPlayer);
    const direct = resolveExchange({ playerQueue, cpuQueue, playerAttack: pAttack, cpuAttack: cAttack, now: 1000 });
    const mirrored = resolveExchange({ playerQueue: mirroredPlayer, cpuQueue: mirroredCpu, playerAttack: cAttack, cpuAttack: pAttack, now: 1000 });
    assert.equal(direct.playerSent, mirrored.cpuSent);
    assert.equal(direct.cpuSent, mirrored.playerSent);
    assert.equal(direct.playerCancelled, mirrored.cpuCancelled);
    assert.equal(direct.cpuCancelled, mirrored.playerCancelled);
    assert.deepEqual(playerQueue, mirroredCpu);
    assert.deepEqual(cpuQueue, mirroredPlayer);
    assert.equal(direct.playerSent + direct.playerCancelled, pAttack);
    assert.equal(direct.cpuSent + direct.cpuCancelled, cAttack);
  }
});
