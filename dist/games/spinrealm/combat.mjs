// Resolve one simulation tick symmetrically. Queues contain incoming attacks;
// scoring counts only the remainder actually enqueued for the other side.
const attackCount = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

function cancelIncoming(queue, attack) {
  let remaining = attack;
  let cancelled = 0;
  while (remaining > 0 && queue.length > 0) {
    const amount = Math.min(remaining, queue[0].n);
    remaining -= amount;
    queue[0].n -= amount;
    cancelled += amount;
    if (queue[0].n === 0) queue.shift();
  }
  return { remaining, cancelled };
}

/**
 * Mutates the two incoming queues in place:
 * 1. Each side counters its previously queued incoming attacks.
 * 2. Both new outgoing remainders counter each other simultaneously.
 * 3. Only the final remainder is sent, with a fresh arrival timestamp.
 */
export function resolveExchange({
  playerQueue, cpuQueue, playerAttack = 0, cpuAttack = 0, now, delay = 1500,
}) {
  if (!Number.isFinite(now)) throw new TypeError('Combat time must be finite.');
  const wait = Number.isFinite(delay) ? Math.max(0, delay) : 1500;
  const player = cancelIncoming(playerQueue, attackCount(playerAttack));
  const cpu = cancelIncoming(cpuQueue, attackCount(cpuAttack));
  const mutual = Math.min(player.remaining, cpu.remaining);
  const playerSent = player.remaining - mutual;
  const cpuSent = cpu.remaining - mutual;

  if (playerSent > 0) cpuQueue.push({ n: playerSent, at: now + wait });
  if (cpuSent > 0) playerQueue.push({ n: cpuSent, at: now + wait });

  return {
    playerSent,
    cpuSent,
    playerCancelled: player.cancelled + mutual,
    cpuCancelled: cpu.cancelled + mutual,
  };
}
