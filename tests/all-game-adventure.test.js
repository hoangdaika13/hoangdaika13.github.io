'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { games, internals } = require('../all-game-adventure.js');
const { blockCells, blockFits, CRATE_LEVELS, parseCrates, RUNNER_COURSES } = internals;
const copy = value => JSON.parse(JSON.stringify(value));

function solveCrate(rows) {
  const board = parseCrates(rows), width = board.width, walls = new Set(board.walls), goals = new Set(board.goals);
  const queue = [{ player: board.player, crates: board.crates, path: '' }], visited = new Set();
  const key = state => state.player + ':' + state.crates.slice().sort((a, b) => a - b).join(',');
  visited.add(key(queue[0]));
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const state = queue[cursor];
    if (state.crates.every(crate => goals.has(crate))) return state.path;
    for (const [letter, dx, dy] of [['L', -1, 0], ['R', 1, 0], ['U', 0, -1], ['D', 0, 1]]) {
      const x = state.player % width + dx, y = Math.floor(state.player / width) + dy, target = y * width + x;
      if (x < 0 || x >= width || y < 0 || y >= board.height || walls.has(target)) continue;
      const crates = state.crates.slice(), crateIndex = crates.indexOf(target);
      if (crateIndex >= 0) {
        const destination = target + dy * width + dx;
        if (walls.has(destination) || crates.includes(destination)) continue;
        crates[crateIndex] = destination;
      }
      const next = { player: target, crates, path: state.path + letter }, identity = key(next);
      if (!visited.has(identity)) { visited.add(identity); queue.push(next); }
    }
    assert.ok(queue.length < 300000, 'Original puzzle exceeds test search budget');
  }
  return null;
}

test('all three adventure games expose deterministic immutable engines', () => {
  for (const game of Object.values(games)) {
    const initial = game.create({ seed: 'repeat', difficulty: 'normal' }), original = copy(initial);
    const actions = ['left', 'up', { type: 'tick', held: { right: true } }, 'down', 'action'];
    let a = initial, b = game.create({ seed: 'repeat', difficulty: 'normal' });
    for (const action of actions) { const previous = copy(a); const old = a; a = game.step(a, action, .03); assert.deepEqual(old, previous); b = game.step(b, action, .03); }
    assert.deepEqual(a, b); assert.deepEqual(initial, original);
    assert.equal(a.version, 1); assert.equal(a.id, game.id); assert.match(game.describe(a).summary, /\S/);
  }
});

test('block bag contains exactly seven different pieces before repeating', () => {
  let state = games['block-drop'].create({ seed: 'bag' });
  const kinds = [];
  for (let i = 0; i < 7; i++) {
    kinds.push(state.piece.kind);
    state.board = Array.from({ length: 20 }, () => Array(10).fill(null));
    state = games['block-drop'].step(state, 'action');
  }
  assert.equal(new Set(kinds).size, 7);
  assert.notDeepEqual(games['block-drop'].create({ seed: 'one' }).bag, games['block-drop'].create({ seed: 'two' }).bag);
});

test('block horizontal bounds, rotations and ghost collision geometry stay valid', () => {
  const engine = games['block-drop']; let state = engine.create({ seed: 'rotation' });
  for (let i = 0; i < 30; i++) state = engine.step(state, 'left');
  assert.equal(Math.min(...blockCells(state.piece).map(cell => cell[0])), 0);
  for (let i = 0; i < 20; i++) { state = engine.step(state, 'up'); assert.equal(blockFits(state, state.piece), true); }
  for (let i = 0; i < 30; i++) state = engine.step(state, 'right');
  assert.equal(Math.max(...blockCells(state.piece).map(cell => cell[0])), 9);
  for (let i = 0; i < 20; i++) { state = engine.step(state, 'up'); assert.equal(blockFits(state, state.piece), true); }
  const original = copy(state); engine.step(state, 'action'); assert.deepEqual(state, original);
});

test('block hard drop really clears rows, scores and increments levels', () => {
  const engine = games['block-drop']; let state = engine.create({ seed: 7 });
  state.board[19] = Array(10).fill('J'); state.board[19][4] = null; state.board[19][5] = null;
  state.board[18] = Array(10).fill('J'); state.board[18][4] = null; state.board[18][5] = null;
  state.piece = { kind: 'O', rotation: 0, x: 3, y: 0 }; state.lines = 8;
  state = engine.step(state, 'action');
  assert.equal(state.lines, 10); assert.equal(state.level, 2); assert.equal(state.blocks, 1);
  assert.equal(state.board.flat().filter(Boolean).length, 0); assert.ok(state.score >= 300);
});

test('block immediate horizontal input is not repeated by the next held tick', () => {
  const engine = games['block-drop'], initial = engine.create({ seed: 31 });
  let state = engine.step(initial, 'left'); assert.equal(state.piece.x, initial.piece.x - 1);
  state = engine.step(state, { type: 'tick', held: { left: true } }, .05); assert.equal(state.piece.x, initial.piece.x - 1);
  state = engine.step(state, { type: 'tick', held: { left: true } }, .05); assert.equal(state.piece.x, initial.piece.x - 1);
  state = engine.step(state, { type: 'tick', held: { left: true } }, .03); assert.equal(state.piece.x, initial.piece.x - 2);
  state = engine.step(state, { type: 'tick', held: {} }, .01);
  state = engine.step(state, 'right'); assert.equal(state.piece.x, initial.piece.x - 1);
});

test('block spawn obstruction loses, terminal ticks cannot change score', () => {
  const engine = games['block-drop']; let state = engine.create({ seed: 1 });
  state.next = 'O'; state.board[0][4] = 'J'; state.board[0][5] = 'J'; state.board[1][4] = 'J'; state.board[1][5] = 'J';
  state.piece = { kind: 'I', rotation: 0, x: 0, y: 17 };
  state = engine.step(state, 'action'); assert.equal(state.status, 'lost');
  assert.deepEqual(engine.step(state, { type: 'tick', held: { action: true } }, 100), state);
});

test('block clamps elapsed time, held action is edge-triggered, gravity really drops', () => {
  const engine = games['block-drop'], initial = engine.create({ seed: 31 });
  assert.deepEqual(engine.step(initial, { type: 'tick' }, 400), engine.step(initial, { type: 'tick' }, .05));
  let state = engine.step(initial, { type: 'tick', held: { action: true } }, .01); assert.equal(state.blocks, 1);
  for (let i = 0; i < 5; i++) state = engine.step(state, { type: 'tick', held: { action: true } }, .05);
  assert.equal(state.blocks, 1);
  for (let i = 0; i < 20; i++) state = engine.step(state, { type: 'tick', held: {} }, .05);
  assert.ok(state.piece.y >= 1);
});

test('all seven original crate boards are rectangular, enclosed and demonstrably solvable', () => {
  assert.equal(CRATE_LEVELS.length, 7);
  for (const [index, rows] of CRATE_LEVELS.entries()) {
    const board = parseCrates(rows);
    assert.ok(rows.every(row => row.length === board.width)); assert.ok(rows[0].split('').every(char => char === '#'));
    assert.ok(rows.at(-1).split('').every(char => char === '#')); assert.ok(rows.every(row => row[0] === '#' && row.at(-1) === '#'));
    assert.equal(board.goals.length, board.crates.length); assert.ok(board.player >= 0);
    assert.ok(solveCrate(rows), 'Trạm ' + (index + 1) + ' must have a real solution');
  }
});

test('crate moves, pushes, undo and reset are real and immutable', () => {
  const engine = games['crate-lab'], initial = engine.create(); let state = engine.step(initial, 'right');
  assert.equal(state.player, initial.player + 1); assert.equal(state.crates[0], initial.crates[0] + 1); assert.equal(state.moves, 1);
  state = engine.step(state, 'undo'); assert.equal(state.player, initial.player); assert.deepEqual(state.crates, initial.crates); assert.equal(state.moves, 0);
  state = engine.step(engine.step(initial, 'down'), 'reset-level'); assert.equal(state.player, initial.player); assert.equal(state.history.length, 0);
  assert.equal(initial.moves, 0);
  const illegal = engine.step(initial, { type: 'cell', index: initial.player + 3 }); assert.equal(illegal.player, initial.player);
  const adjacent = engine.step(initial, { type: 'cell', index: initial.player + initial.width }); assert.equal(adjacent.player, initial.player + initial.width);
});

test('crate inaccessible walls and blocked pushes never wrap around the board', () => {
  const engine = games['crate-lab']; let state = engine.create();
  for (let i = 0; i < 15; i++) state = engine.step(state, 'left');
  assert.equal(state.player % state.width, 1);
  for (let i = 0; i < 15; i++) state = engine.step(state, 'up');
  assert.equal(Math.floor(state.player / state.width), 1);
  const snapshot = copy(state); state = engine.step(state, 'up'); assert.deepEqual(state, snapshot);
  const description = engine.describe(state); assert.equal(description.columns, state.width); assert.equal(description.cells.length, state.width * state.height);
  assert.equal(description.cells.filter(cell => cell.pressed).length, 1); assert.ok(description.cells.every(cell => /Hàng \d+, cột \d+/.test(cell.label)));
  assert.ok(description.cells.every(cell => cell.description === cell.label && cell.text.length === 1));
  assert.equal(description.cells.find(cell => cell.pressed).text, '●');
  assert.equal(description.cells.find(cell => state.walls.includes(cell.index)).text, '▰');
  assert.equal(description.cells.find(cell => state.goals.includes(cell.index)).text, '◎');
});

test('crate solving each board advances exactly once and final board wins', () => {
  const engine = games['crate-lab']; let state = engine.create();
  const directions = { L: 'left', R: 'right', U: 'up', D: 'down' };
  for (let index = 0; index < CRATE_LEVELS.length; index++) {
    assert.equal(state.level, index + 1);
    for (const letter of solveCrate(CRATE_LEVELS[index])) state = engine.step(state, directions[letter]);
    assert.equal(state.solved, index + 1);
    if (index < CRATE_LEVELS.length - 1) { assert.equal(state.status, 'playing'); assert.equal(state.moves, 0); assert.equal(state.history.length, 0); }
  }
  assert.equal(state.status, 'won'); assert.ok(state.score > 0);
  assert.deepEqual(engine.step(state, 'undo'), state);
});

test('runner physics supports grounded jumps, gravity, immutable collision and time clamp', () => {
  const engine = games['orbit-runner'], initial = engine.create();
  let state = engine.step(initial, 'up'); state = engine.step(state, { type: 'tick', held: { right: true } }, .05);
  assert.ok(state.player.y < initial.player.y); assert.ok(state.player.vy < 0); assert.ok(state.player.x > initial.player.x);
  for (let i = 0; i < 40; i++) state = engine.step(state, { type: 'tick', held: {} }, .025);
  assert.equal(state.player.y, 384); assert.equal(state.player.grounded, true); assert.equal(initial.player.x, 52);
  assert.deepEqual(engine.step(initial, { type: 'tick', held: { right: true } }, 1000), engine.step(initial, { type: 'tick', held: { right: true } }, .05));
});

test('runner hazards and gaps consume lives; checkpoints restore the correct safe place', () => {
  const engine = games['orbit-runner']; let state = engine.create();
  state.player.x = 1100; state = engine.step(state, { type: 'tick', held: {} }, .01);
  assert.equal(state.checkpoint.activated, true);
  state.player.x = 1485; state.player.y = 384; state.invulnerable = 0;
  state = engine.step(state, { type: 'tick', held: {} }, .01);
  assert.equal(state.lives, 2); assert.equal(state.player.x, 1100); assert.equal(state.invulnerable, 1);
  state.player.y = 540; state = engine.step(state, { type: 'tick', held: {} }, .01); assert.equal(state.lives, 1);
  state.player.y = 540; state = engine.step(state, { type: 'tick', held: {} }, .01); assert.equal(state.status, 'lost');
  assert.deepEqual(engine.step(state, 'action'), state);
});

test('runner coins cannot be farmed by dying; reset discards the current-stage score', () => {
  const engine = games['orbit-runner']; let state = engine.create();
  state.player.x = 192; state.player.y = 348; state = engine.step(state, { type: 'tick' }, .01);
  assert.equal(state.totalCoins, 1); assert.equal(state.score, 10);
  state.player.y = 540; state = engine.step(state, { type: 'tick' }, .01);
  state.player.x = 192; state.player.y = 348; state = engine.step(state, { type: 'tick' }, .01); assert.equal(state.score, 10);
  state = engine.step(state, 'reset-level'); assert.equal(state.totalCoins, 0); assert.equal(state.score, 0); assert.equal(state.collected.length, 0);
});

for (const difficulty of ['easy', 'normal', 'hard']) test('runner courses have a reachable real finish in ' + difficulty + ' difficulty', () => {
  const engine = games['orbit-runner']; let state = engine.create({ difficulty });
  let previousLevel = 1, frames = 0;
  while (state.status === 'playing' && frames++ < 16000) {
    const course = RUNNER_COURSES[state.level - 1], player = state.player;
    const floor = course.platforms.find(([x, y, w]) => y === 420 && player.x + player.width > x && player.x < x + w);
    const gapAhead = floor && floor[0] + floor[2] < course.width && floor[0] + floor[2] - (player.x + player.width) < 24;
    const hazardAhead = course.hazards.some(([x]) => x >= player.x + player.width && x - (player.x + player.width) < 39);
    const jump = player.grounded && (gapAhead || hazardAhead);
    if (jump) state = engine.step(state, 'up');
    state = engine.step(state, { type: 'tick', held: { right: true } }, 1 / 60);
    if (state.level !== previousLevel) { assert.equal(state.level, previousLevel + 1); assert.equal(state.player.x, 52); previousLevel = state.level; }
  }
  assert.equal(state.status, 'won', 'Autopilot must be able to complete original courses without teleporting; ' + JSON.stringify({ level: state.level, x: state.player.x, y: state.player.y, lives: state.lives, frames }));
  assert.equal(state.completed, 3); assert.ok(state.score >= 450); assert.ok(state.lives > 0);
});

test('runner cannot finish by falling underneath a portal', () => {
  const engine = games['orbit-runner']; let state = engine.create();
  state.player.x = RUNNER_COURSES[0].goal; state.player.y = 470; state.player.vy = 0;
  state = engine.step(state, { type: 'tick', held: {} }, .01);
  assert.equal(state.level, 1); assert.equal(state.completed, 0);
});

test('draw functions are canvas-only, support reduced motion and never mutate game state', () => {
  const gradient = { addColorStop() {} };
  const context = new Proxy({ createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) }, { get(target, property) { if (String(property).startsWith('create')) return () => gradient; if (!(property in target)) target[property] = () => {}; return target[property]; }, set(target, property, value) { target[property] = value; return true; } });
  for (const engine of Object.values(games)) {
    const state = engine.create(), original = copy(state);
    engine.draw(context, state, { width: 720, height: 480, reducedMotion: false });
    engine.draw(context, state, { width: 375, height: 250, reducedMotion: true });
    assert.deepEqual(state, original);
  }
});

test('every adventure renderer delegates the scene once without an opaque fallback overpaint', () => {
  for (const engine of Object.values(games)) {
    const state = engine.create(), original = copy(state), fills = [], calls = [];
    const context = new Proxy({ createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), fillRect(...args) { fills.push(args); } }, { get(target, key) { if (!(key in target)) target[key] = () => {}; return target[key]; }, set(target, key, value) { target[key] = value; return true; } });
    engine.draw(context, state, { width: 720, height: 480, reducedMotion: true, paintScene(ctx, id, current) { calls.push({ ctx, id, current }); } });
    assert.equal(calls.length, 1); assert.equal(calls[0].ctx, context); assert.equal(calls[0].id, engine.id); assert.equal(calls[0].current, state);
    assert.equal(fills.filter(args => args[0] === 0 && args[1] === 0 && args[2] === 720 && args[3] === 480).length, 0);
    assert.deepEqual(state, original);
  }
});

test('adventure source has no autonomous timer, network, DOM or storage dependencies', () => {
  const source = require('node:fs').readFileSync(require.resolve('../all-game-adventure.js'), 'utf8');
  assert.doesNotMatch(source, /\b(?:setTimeout|setInterval|requestAnimationFrame|fetch|localStorage|sessionStorage|document|AudioContext)\s*[.(]/);
  assert.doesNotMatch(source, /Math\.random\s*\(/);
});
