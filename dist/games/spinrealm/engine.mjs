// Original, dependency-free prototype engine. Screen coordinates increase downward.
// The 90-degree SRS kick data is defined in MIT Hardness Group et al.,
// "Tetris with Few Piece Types" (FUN 2024), Tables 2–3.
// Scoring and attack values below are this prototype's rules, not Battle's tuning.
export const WIDTH = 10;
export const HEIGHT = 22;
export const HIDDEN = 2;
export const COLORS = Object.freeze({
  I: '#62e9ed', O: '#f5d769', T: '#bf91ff', S: '#91e5a1',
  Z: '#ff7e95', J: '#7b9cff', L: '#ffb373', G: '#58677a',
});

const SPAWN = {
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
};
export const SHAPES = Object.fromEntries(Object.entries(SPAWN).map(([type, cells]) => {
  const states = [cells];
  for (let r = 1; r < 4; r++) {
    states.push(type === 'O' ? cells.map(c => [...c]) : states[r - 1].map(([x, y]) => [
      (type === 'I' ? 3 : 2) - y, x,
    ]));
  }
  return [type, states];
}));

// These offsets already convert the paper's positive-up y axis to screen y.
const KICKS = {
  '0>1': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '1>0': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  '1>2': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  '2>1': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '2>3': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  '3>2': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '3>0': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '0>3': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
};
const I_KICKS = {
  '0>1': [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
  '1>0': [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
  '1>2': [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
  '2>1': [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
  '2>3': [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
  '3>2': [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
  '3>0': [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
  '0>3': [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
};

const blankBoard = () => Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null));
const clone = value => JSON.parse(JSON.stringify(value));
const seedNumber = value => {
  if (typeof value === 'number') return (value >>> 0) || 1;
  let result = 2166136261;
  for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return (result >>> 0) || 1;
};

export class Game {
  constructor({ seed = Date.now(), gravity = 700, lockDelay = 500 } = {}) {
    this.settings = { gravity, lockDelay };
    this.reset(seed);
  }

  reset(seed = this.seed) {
    this.seed = seed;
    this._rng = seedNumber(seed);
    // Garbage randomness has its own stream so attacks cannot change the piece bag.
    this._garbageRng = this._rng ^ 0x9e3779b9;
    this.board = blankBoard();
    this.queue = [];
    this.held = null;
    this.canHold = true;
    this.status = 'playing';
    this.stats = { score: 0, lines: 0, pieces: 0, combo: -1, b2b: 0, spins: 0, attack: 0 };
    this.events = [];
    this._history = [];
    this._fillQueue();
    this._spawn();
    this._turnStart = this._snapshot();
    return this;
  }

  _random(garbage = false) {
    const key = garbage ? '_garbageRng' : '_rng';
    let x = this[key] || 1;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this[key] = x >>> 0;
    return this[key] / 4294967296;
  }

  _fillQueue() {
    while (this.queue.length < 7) {
      const bag = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(this._random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      this.queue.push(...bag);
    }
  }

  _spawn(type = null) {
    // Prototype rule: spawn immediately inside the visible field so gravity never
    // delays the player's first view of a new piece. Two buffer rows remain above.
    this.active = { type: type || this.queue.shift(), x: 3, y: HIDDEN, rotation: 0 };
    this._fillQueue();
    this._gravityTimer = 0;
    this._lockTimer = 0;
    this._resetCount = 0;
    this._groundedEver = false;
    this._lastRotation = null;
    if (this.collides(this.active)) this._over();
  }

  cells(piece = this.active) {
    if (!piece) return [];
    return SHAPES[piece.type][piece.rotation].map(([x, y]) => [piece.x + x, piece.y + y]);
  }

  collides(piece) {
    return this.cells(piece).some(([x, y]) => x < 0 || x >= WIDTH || y >= HEIGHT || y < -4 ||
      (y >= 0 && Boolean(this.board[y][x])));
  }

  _grounded(piece = this.active) {
    return this.collides({ ...piece, y: piece.y + 1 });
  }

  _resetLock(wasGrounded) {
    if ((wasGrounded || this._groundedEver) && this._resetCount < 15) {
      this._lockTimer = 0;
      this._resetCount++;
    }
    if (this._grounded()) this._groundedEver = true;
  }

  move(dx) {
    if (this.status !== 'playing' || !Number.isFinite(dx) || dx === 0) return false;
    const next = { ...this.active, x: this.active.x + Math.sign(dx) };
    if (this.collides(next)) return false;
    const wasGrounded = this._grounded();
    this.active = next;
    this._lastRotation = null;
    this._resetLock(wasGrounded);
    return true;
  }

  _rotationResult(piece, dir) {
    if (!piece || ![1, -1].includes(dir)) return null;
    const rotation = (piece.rotation + dir + 4) % 4;
    const table = piece.type === 'I' ? I_KICKS : KICKS;
    const tests = piece.type === 'O' ? [[0, 0]] : table[`${piece.rotation}>${rotation}`];
    for (let kickIndex = 0; kickIndex < tests.length; kickIndex++) {
      const [dx, dy] = tests[kickIndex];
      const next = { ...piece, x: piece.x + dx, y: piece.y + dy, rotation };
      if (!this.collides(next)) return { piece: next, kickIndex };
    }
    return null;
  }

  // Pure query for the bot/path planner: no timers, state, events or RNG are changed.
  rotationCandidate(piece, dir = 1) {
    return this._rotationResult(piece, dir)?.piece || null;
  }

  rotate(dir = 1) {
    if (this.status !== 'playing') return false;
    const result = this._rotationResult(this.active, dir);
    if (!result) return false;
    const wasGrounded = this._grounded();
    const from = this.active.rotation;
    this.active = result.piece;
    this._lastRotation = { from, to: this.active.rotation, kickIndex: result.kickIndex };
    this._resetLock(wasGrounded);
    return true;
  }

  _down(soft = false) {
    const next = { ...this.active, y: this.active.y + 1 };
    if (this.collides(next)) return false;
    this.active = next;
    this._lastRotation = null;
    if (soft) this.stats.score++;
    if (this._grounded()) this._groundedEver = true;
    return true;
  }

  softDrop() {
    if (this.status !== 'playing') return false;
    const moved = this._down(true);
    if (moved) this._gravityTimer = 0;
    return moved;
  }

  ghost() {
    const piece = { ...this.active };
    while (!this.collides({ ...piece, y: piece.y + 1 })) piece.y++;
    return piece;
  }

  hardDrop() {
    if (this.status !== 'playing') return false;
    const target = this.ghost();
    const distance = target.y - this.active.y;
    if (distance > 0) this._lastRotation = null;
    this.stats.score += distance * 2;
    this.active = target;
    this._lock();
    return true;
  }

  hold() {
    if (this.status !== 'playing' || !this.canHold) return false;
    const prior = this.held;
    this.held = this.active.type;
    this._spawn(prior);
    this.canHold = false;
    return true;
  }

  step(dt) {
    if (this.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    // Integration uses short slices so a delayed render never tunnels through blocks.
    let remaining = Math.min(dt, 60000);
    while (remaining > 0 && this.status === 'playing') {
      const slice = Math.min(remaining, 8);
      remaining -= slice;
      if (this._grounded()) {
        this._groundedEver = true;
        this._lockTimer += slice;
        if (this._lockTimer >= Math.max(0, this.settings.lockDelay)) this._lock();
      } else {
        this._gravityTimer += slice;
        const gravity = Math.max(1, this.settings.gravity);
        while (this._gravityTimer >= gravity && this.status === 'playing') {
          this._gravityTimer -= gravity;
          if (!this._down()) break;
        }
      }
    }
  }

  _spin() {
    if (this.active.type !== 'T' || !this._lastRotation) return null;
    const { x, y, rotation } = this.active;
    const filled = (cx, cy) => cx < 0 || cx >= WIDTH || cy >= HEIGHT ||
      (cy >= 0 && Boolean(this.board[cy][cx]));
    const corners = [filled(x, y), filled(x + 2, y), filled(x + 2, y + 2), filled(x, y + 2)];
    if (corners.filter(Boolean).length < 3) return null;
    const front = [[0, 1], [1, 2], [2, 3], [3, 0]][rotation];
    return (corners[front[0]] && corners[front[1]]) || this._lastRotation.kickIndex === 4 ? 'full' : 'mini';
  }

  _lock() {
    const cells = this.cells();
    if (cells.some(([, y]) => y < 0)) { this._over(); return; }
    this._history.push(clone(this._turnStart));
    if (this._history.length > 64) this._history.shift();
    const placedType = this.active.type;
    const spin = this._spin();
    for (const [x, y] of cells) this.board[y][x] = placedType;
    const clearedRows = [];
    for (let y = 0; y < HEIGHT; y++) if (this.board[y].every(Boolean)) clearedRows.push(y);
    const lines = clearedRows.length;
    this.board = this.board.filter(row => !row.every(Boolean));
    while (this.board.length < HEIGHT) this.board.unshift(Array(WIDTH).fill(null));
    const perfectClear = lines > 0 && this.board.every(row => row.every(cell => !cell));
    const difficult = lines > 0 && (Boolean(spin) || lines === 4);
    const backToBack = difficult && this.stats.b2b > 0;
    if (lines > 0) {
      this.stats.combo++;
      this.stats.b2b = difficult ? this.stats.b2b + 1 : 0;
    } else {
      this.stats.combo = -1;
    }
    let attack = spin === 'full' ? [0, 2, 4, 6][lines] : spin === 'mini' ? [0, 0, 1][lines] : [0, 0, 1, 2, 4][lines];
    attack = attack || 0;
    if (lines > 0) {
      if (backToBack) attack++;
      attack += Math.min(4, Math.floor(Math.max(0, this.stats.combo) / 2));
      if (perfectClear) attack += 10;
    }
    const points = spin === 'full' ? [400, 800, 1200, 1600][lines] : spin === 'mini' ? [100, 200, 400][lines] : [0, 100, 300, 500, 800][lines];
    this.stats.score += (points || 0) * (backToBack ? 1.5 : 1) + Math.max(0, this.stats.combo) * 50 + (perfectClear ? 3500 : 0);
    this.stats.lines += lines;
    this.stats.pieces++;
    if (spin) this.stats.spins++;
    this.stats.attack += attack;
    this.events.push({ type: 'lock', lines, spin, attack, combo: this.stats.combo, b2b: this.stats.b2b,
      perfectClear, cells, placedType, clearedRows });
    this.canHold = true;
    if (lines === 0 && cells.every(([, y]) => y < HIDDEN)) {
      this._over();
      return;
    }
    this._spawn();
    this._turnStart = this._snapshot();
  }

  addGarbage(n, hole) {
    if (this.status !== 'playing') return false;
    n = Math.min(HEIGHT, Math.max(0, Math.floor(n)));
    if (!n) return false;
    const chosenHole = Number.isInteger(hole) ? Math.max(0, Math.min(WIDTH - 1, hole)) : Math.floor(this._random(true) * WIDTH);
    const overflow = this.board.slice(0, n).some(row => row.some(Boolean));
    this.board.splice(0, n);
    for (let i = 0; i < n; i++) this.board.push(Array.from({ length: WIDTH }, (_, x) => x === chosenHole ? null : 'G'));
    // Intended battle integration: deliver between locks. If used mid-piece, lift only
    // on collision so incoming rows cannot silently overwrite the falling piece.
    if (this.collides(this.active)) this.active.y -= n;
    if (overflow || this.collides(this.active)) this._over();
    return true;
  }

  _over() {
    if (this.status === 'over') return;
    this.status = 'over';
    this.events.push({ type: 'over' });
  }

  drainEvents() {
    const result = this.events;
    this.events = [];
    return result;
  }

  _snapshot() {
    return clone({ board: this.board, active: this.active, queue: this.queue, held: this.held,
      canHold: this.canHold, status: this.status, stats: this.stats, seed: this.seed, _rng: this._rng,
      _garbageRng: this._garbageRng, _gravityTimer: this._gravityTimer, _lockTimer: this._lockTimer,
      _resetCount: this._resetCount, _groundedEver: this._groundedEver, _lastRotation: this._lastRotation });
  }

  undo() {
    if (!this._history.length) return false;
    const state = this._history.pop();
    Object.assign(this, clone(state));
    this.events = [];
    this._turnStart = this._snapshot();
    return true;
  }

  loadDrill(name = 'double') {
    if (name !== 'double') throw new Error(`Unknown drill: ${name}`);
    this.reset('spinrealm-tspin-double');
    for (let x = 0; x < WIDTH; x++) {
      if (![4, 5].includes(x)) this.board[19][x] = 'G';
      if (![3, 4, 5].includes(x)) this.board[20][x] = 'G';
      if (x !== 4) this.board[21][x] = 'G';
    }
    this.active = { type: 'T', x: 3, y: 19, rotation: 1 };
    this._groundedEver = true;
    this._turnStart = this._snapshot();
    return this;
  }
}
