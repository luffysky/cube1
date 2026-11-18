/**
 * A transparent, local CPU opponent. It evaluates reachable placements, then
 * plays ordinary controls one at a time; it never writes blocks into a board.
 */
import { WIDTH, HEIGHT } from './engine.mjs';

const POSITION_LIMIT = 480;
const PATH_LIMIT = 18;
const stamp = p => p ? `${p.type}:${p.x}:${p.y}:${p.rotation}` : '';
const boardStamp = board => board.map(row => row.map(v => v || '.').join('')).join('/');

function landingPosition(game, piece) {
  let landed = { ...piece };
  // The guard also bounds work on malformed input without touching game state.
  for (let i = 0; i < HEIGHT + 8; i++) {
    const next = { ...landed, y: landed.y + 1 };
    if (game.collides(next)) break;
    landed = next;
  }
  return landed;
}

function placementScore(game, piece) {
  const board = game.board.map(row => row.slice());
  for (const [x, y] of game.cells(piece)) {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || board[y][x]) return -Infinity;
    board[y][x] = piece.type;
  }

  const kept = board.filter(row => !row.every(Boolean));
  const lines = HEIGHT - kept.length;
  while (kept.length < HEIGHT) kept.unshift(Array(WIDTH).fill(null));

  const heights = [];
  let holes = 0;
  let coveredHoles = 0;
  for (let x = 0; x < WIDTH; x++) {
    let first = HEIGHT;
    let solids = 0;
    for (let y = 0; y < HEIGHT; y++) {
      if (kept[y][x]) {
        if (first === HEIGHT) first = y;
        solids++;
      } else if (first !== HEIGHT) {
        holes++;
        coveredHoles += solids;
      }
    }
    heights.push(HEIGHT - first);
  }

  const aggregate = heights.reduce((a, b) => a + b, 0);
  const peak = Math.max(...heights);
  let unevenness = 0;
  for (let x = 1; x < WIDTH; x++) unevenness += Math.abs(heights[x] - heights[x - 1]);
  const danger = Math.max(0, peak - 12);

  // These are prototype difficulty heuristics, not a claim to reproduce any
  // existing game's AI. Surviving, keeping access to holes, and clearing lines
  // take precedence over spectacular but fragile setups.
  return lines * 1.7 + (lines === 4 ? 2 : 0)
    - aggregate * 0.48 - holes * 2.7 - coveredHoles * 0.06
    - unevenness * 0.24 - danger * danger * 0.16;
}

/**
 * Find a short, legally reachable sequence from the active piece.
 * This search is read-only: it calls the engine's collision and SRS candidate
 * methods and never advances time, changes the randomizer, or consumes events.
 */
export function findPlan(game) {
  if (!game.active || game.status !== 'playing') return [];
  const initial = { ...game.active };
  const nodes = [{ piece: initial, path: [] }];
  const seen = new Set([stamp(initial)]);
  let bestPath = ['drop'];
  let bestScore = -Infinity;

  for (let cursor = 0; cursor < nodes.length && cursor < POSITION_LIMIT; cursor++) {
    const { piece, path } = nodes[cursor];
    const landed = landingPosition(game, piece);
    const score = placementScore(game, landed) - path.length * 0.0005;
    if (score > bestScore) {
      bestScore = score;
      bestPath = [...path, 'drop'];
    }
    if (path.length >= PATH_LIMIT) continue;

    const successors = [
      ['left', { ...piece, x: piece.x - 1 }],
      ['right', { ...piece, x: piece.x + 1 }],
      ['cw', game.rotationCandidate(piece, 1)],
      ['ccw', game.rotationCandidate(piece, -1)],
    ];
    for (const [action, next] of successors) {
      if (!next || next.y < -4 || next.y >= HEIGHT || game.collides(next)) continue;
      const key = stamp(next);
      if (seen.has(key)) continue;
      seen.add(key);
      nodes.push({ piece: next, path: [...path, action] });
      if (nodes.length >= POSITION_LIMIT) break;
    }
  }
  return bestPath;
}

/** Visible-input CPU controller; the caller owns gravity and event handling. */
export class Bot {
  constructor(game, { pps = 1.1 } = {}) {
    this.game = game;
    this.pps = Math.max(0.15, Math.min(8, Number(pps) || 1.1));
    this.reset();
  }

  reset() {
    this._plan = [];
    this._pieces = null;
    this._expected = '';
    this._board = '';
    this._elapsed = 0;
    this._actionClock = 0;
    this._actionInterval = 45;
  }

  _replan() {
    this._plan = findPlan(this.game);
    this._expected = stamp(this.game.active);
    this._board = boardStamp(this.game.board);
    this._actionClock = 0;
    this._actionInterval = Math.min(45, (1000 / this.pps) / (this._plan.length + 2));
  }

  update(dt) {
    const game = this.game;
    if (game.status !== 'playing' || !game.active) return;
    const elapsed = Math.max(0, Math.min(250, Number(dt) || 0));
    const newPiece = this._pieces !== game.stats.pieces;
    if (newPiece) {
      this._pieces = game.stats.pieces;
      this._elapsed = 0;
      this._replan();
    } else if (this._expected !== stamp(game.active) || this._board !== boardStamp(game.board)) {
      // Gravity, an injected garbage row, or an external reset can invalidate a
      // planned path. Recompute before attempting the next ordinary control.
      this._replan();
    }
    this._elapsed += elapsed;
    this._actionClock += elapsed;
    const action = this._plan[0];
    if (!action) return;

    if (action === 'drop') {
      if (this._elapsed < 1000 / this.pps) return;
      game.hardDrop();
      this._plan.shift();
      this._expected = stamp(game.active);
      return;
    }
    if (this._actionClock < this._actionInterval) return;
    this._actionClock -= this._actionInterval;
    const ok = action === 'left' ? game.move(-1)
      : action === 'right' ? game.move(1)
      : game.rotate(action === 'cw' ? 1 : -1);
    if (!ok) {
      this._replan();
      return;
    }
    this._plan.shift();
    this._expected = stamp(game.active);
  }
}
