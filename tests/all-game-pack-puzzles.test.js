'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { games } = require('../all-game-pack-puzzles.js');
const IDS = ['lights-out', 'slide-tiles', 'peg-solitaire', 'n-queens', 'nonogram', 'towers-hanoi', 'maze-path', 'connect-four', 'tic-tac-toe', 'reversi-mini', 'word-search', 'number-order', 'sudoku-mini', 'color-flood', 'pipe-link', 'code-breaker', 'knights-tour'];
const click = (engine, state, index, alternate = false) => engine.step(state, { type: 'cell', index, alternate });
function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function mustWin(state) { assert.equal(state.status, 'won'); assert.ok(state.score > 0); }

test('17 original puzzle APIs match browser/CommonJS and have no ambient services', () => {
  assert.deepEqual(Object.keys(games), IDS);
  const source = fs.readFileSync(path.join(__dirname, '../all-game-pack-puzzles.js'), 'utf8'), context = vm.createContext({});
  vm.runInContext(source, context); assert.deepEqual(Object.keys(context.HHAllGamePackPuzzles.games), IDS);
  assert.equal(/\b(?:localStorage|indexedDB|fetch|setTimeout|setInterval|requestAnimationFrame|document|window)\b/.test(source), false);
});

for (const [id, engine] of Object.entries(games)) {
  test(id + ': seeded serializable state, truthful board controls, immutability and reset', () => {
    const state = freeze(engine.create({ seed: 'same', difficulty: 'normal' })), json = JSON.stringify(state);
    assert.equal(state.version, 1); assert.equal(state.id, id); assert.equal(state.status, 'playing'); assert.deepEqual(state, engine.create({ seed: 'same', difficulty: 'normal' }));
    assert.deepEqual(state, JSON.parse(json));
    const description = engine.describe(state); assert.ok(description.summary.length > 30); assert.ok(description.columns >= 3 && description.columns <= 9);
    assert.ok(description.cells.length >= 3 && description.cells.length <= 81);
    assert.ok(description.cells.every(c => Number.isInteger(c.index) && typeof c.text === 'string' && typeof c.description === 'string' && c.description === c.label && typeof c.disabled === 'boolean' && typeof c.pressed === 'boolean'));
    for (const action of [{ type: 'tick' }, { type: 'left' }, { type: 'right' }, { type: 'up' }, { type: 'down' }, { type: 'action' }, { type: 'cell', index: 0 }, { type: 'cell', index: 0, alternate: true }, { type: 'cell', index: -1 }, { type: 'cell', index: 1000 }, { type: 'undo' }]) {
      const next = engine.step(state, action, .05); assert.notEqual(next, state); assert.equal(JSON.stringify(state), json);
      assert.deepEqual(engine.step(next, { type: 'reset-level' }), state);
    }
    const ctx = new Proxy({}, { get: (t, p) => p in t ? t[p] : () => {}, set: (t, p, v) => (t[p] = v, true) });
    engine.draw(ctx, state, { width: 375, height: 480, reducedMotion: true }); assert.equal(JSON.stringify(state), json);
  });
}

test('lights-out generated toggle sequence always solves and undo restores the turn', () => {
  const engine = games['lights-out'];
  for (let seed = 0; seed < 20; seed++) {
    let state = engine.create({ seed }), original = state;
    state = click(engine, state, 12); assert.equal(state.moves, 1); assert.deepEqual(engine.step(state, { type: 'undo' }), original);
    state = original; for (const index of original.solution) { state = click(engine, state, index); if (state.status === 'won') break; } mustWin(state); assert.ok(state.board.every(v => v === 0));
  }
});

test('sliding tiles are solvable by reversed legal scramble, reject nonadjacent cells', () => {
  const engine = games['slide-tiles'];
  for (let seed = 0; seed < 20; seed++) {
    let state = engine.create({ seed }), original = state;
    const invalid = state.board.findIndex((v, i) => Math.abs(i % 3 - state.blank % 3) + Math.abs(Math.floor(i / 3) - Math.floor(state.blank / 3)) > 1);
    assert.deepEqual(click(engine, state, invalid), state);
    for (const index of original.solution) { state = click(engine, state, index); if (state.status === 'won') break; }
    mustWin(state); assert.deepEqual(state.board, [1, 2, 3, 4, 5, 6, 7, 8, 0]);
  }
});

test('peg solitaire reverse-generated board has real forward solution and losing rule', () => {
  const engine = games['peg-solitaire'];
  for (let seed = 0; seed < 20; seed++) {
    let state = engine.create({ seed }); const solution = state.solution;
    assert.ok(solution.length >= 4);
    for (const move of solution) { state = click(engine, state, move.from); state = click(engine, state, move.to); }
    mustWin(state); assert.equal(state.board.filter(v => v === 1).length, 1);
  }
  let state = engine.create({ seed: 2 }); state.board = state.board.map(v => v < 0 ? -1 : 0); state.board[22] = state.board[23] = state.board[2] = 1;
  state = click(engine, state, 22); state = click(engine, state, 24); assert.equal(state.status, 'lost');
});

test('six queens enforces rows, columns and diagonals; completed valid placement wins', () => {
  const engine = games['n-queens']; let state = engine.create({ seed: 1 });
  state = click(engine, state, 0); state = click(engine, state, 7); assert.ok(engine.describe(state).cells[0].text.includes('!')); assert.equal(state.status, 'playing');
  state = engine.create({ seed: 1 }); [1, 3, 5, 0, 2, 4].forEach((column, row) => { state = click(engine, state, row * 6 + column); }); mustWin(state);
  state = engine.step(state, { type: 'undo' }); assert.equal(state.status, 'playing'); assert.equal(state.board.filter(Boolean).length, 5);
});

test('nonogram completes from public row/column clues; crosses do not count as painted', () => {
  const engine = games.nonogram;
  for (let seed = 0; seed < 12; seed++) {
    let state = engine.create({ seed }); const target = state.target.slice();
    const empty = target.indexOf(0); state = click(engine, state, empty, true); assert.equal(state.board[empty], 2); assert.equal(state.status, 'playing');
    target.forEach((v, i) => { if (v) state = click(engine, state, i); }); mustWin(state);
  }
});

test('Hanoi rejects larger-on-smaller and solves all bounded difficulties optimally', () => {
  const engine = games['towers-hanoi'];
  for (const difficulty of ['easy', 'normal', 'hard']) {
    let state = engine.create({ seed: 1, difficulty });
    state = click(engine, state, 0); state = click(engine, state, 1); state = click(engine, state, 0); const before = state.towers.map(x => x.slice());
    state = click(engine, state, 1); assert.deepEqual(state.towers, before); assert.equal(state.moves, 1);
    state = engine.create({ seed: 1, difficulty });
    function move(n, from, to, spare) { if (!n) return; move(n - 1, from, spare, to); state = click(engine, state, from); state = click(engine, state, to); move(n - 1, spare, to, from); }
    move(state.count, 0, 2, 1); mustWin(state); assert.equal(state.moves, 2 ** state.count - 1);
  }
});

function mazeSolution(state) {
  const queue = [state.player], previous = new Map([[state.player, -1]]);
  while (queue.length) { const at = queue.shift(); if (at === state.exit) break; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = at % 9 + dx, y = Math.floor(at / 9) + dy, next = y * 9 + x; if (x >= 0 && x < 9 && y >= 0 && y < 9 && !state.board[next] && !previous.has(next)) { previous.set(next, at); queue.push(next); } } }
  assert.ok(previous.has(state.exit)); const path = []; for (let at = state.exit; at !== state.player; at = previous.get(at)) path.unshift(at); return path;
}
test('generated perfect mazes all have BFS path; walls and nonadjacent jumps are rejected', () => {
  const engine = games['maze-path'];
  for (let seed = 0; seed < 20; seed++) { let state = engine.create({ seed }); assert.deepEqual(click(engine, state, 0), state); assert.deepEqual(click(engine, state, state.exit), state); for (const at of mazeSolution(state)) state = click(engine, state, at); mustWin(state); assert.equal(state.player, state.exit); }
});

test('connect-four drops by column, blocks threats, and resolves player/computer wins', () => {
  const engine = games['connect-four']; let state = engine.create({ seed: 1 });
  state = click(engine, state, 0); assert.equal(state.board[35], 1); assert.equal(state.board[38], 2); assert.equal(state.moves, 1);
  assert.deepEqual(engine.step(state, { type: 'undo' }), engine.create({ seed: 1 }));
  state = engine.create({ seed: 1 }); state.board[35] = state.board[36] = state.board[37] = 1;
  const blocked = click(engine, state, 6); assert.equal(blocked.board[38], 2);
  state = click(engine, state, 3); mustWin(state);
  state = engine.create({ seed: 1 }); state.board[35] = state.board[36] = state.board[37] = 2; state = click(engine, state, 6); assert.equal(state.status, 'lost'); assert.equal(state.result, 'computer');
});

test('tic-tac-toe rejects occupied cells and minimax prevents player wins from a new game', () => {
  const engine = games['tic-tac-toe']; let visited = 0;
  function branch(state) { visited++; assert.notEqual(state.status, 'won'); if (state.status !== 'playing') return; for (let i = 0; i < 9; i++) if (!state.board[i]) branch(click(engine, state, i)); }
  branch(engine.create({ seed: 1 })); assert.ok(visited > 50);
  let state = click(engine, engine.create({ seed: 1 }), 0); assert.deepEqual(click(engine, state, 0), state);
  state = engine.create({ seed: 1 }); state.board = [1, 1, 0, 2, 0, 0, 2, 0, 0]; state = click(engine, state, 2); mustWin(state);
});

test('Reversi uses only bracketed legal flips, whole-turn undo and real terminal counts', () => {
  const engine = games['reversi-mini']; let state = engine.create({ seed: 1 });
  assert.deepEqual(click(engine, state, 0), state);
  const legal = engine.describe(state).cells.find(c => !c.disabled).index, first = click(engine, state, legal);
  assert.ok(first.board.filter(Boolean).length >= 6); assert.deepEqual(engine.step(first, { type: 'undo' }), state);
  let loops = 0; while (state.status === 'playing' && loops++ < 40) { const move = engine.describe(state).cells.find(c => !c.disabled); assert.ok(move, 'player has a legal move or game already ended'); state = click(engine, state, move.index); }
  assert.notEqual(state.status, 'playing'); assert.ok(loops < 40);
  state = engine.create({ seed: 1 }); state.board = Array(36).fill(1); state.board[0] = 0; state.board[1] = 2; state = click(engine, state, 0); mustWin(state); assert.ok(state.board.every(v => v === 1));
  state = engine.create({ seed: 1 }); state.board = Array(36).fill(2); state.board[0] = 0; state.board[2] = 1; state = click(engine, state, 0); assert.equal(state.status, 'lost'); assert.equal(state.result, 'computer');
});

test('word search preserves placed words and accepts forward/reverse endpoints', () => {
  const engine = games['word-search'];
  for (let seed = 0; seed < 20; seed++) { let state = engine.create({ seed }); const words = state.words;
    for (let w = 0; w < words.length; w++) { const path = words[w].path; assert.equal(path.map(i => state.board[i]).join(''), words[w].word); const from = w % 2 ? path.at(-1) : path[0], to = w % 2 ? path[0] : path.at(-1); state = click(engine, state, from); state = click(engine, state, to); }
    mustWin(state); assert.equal(state.found.length, 6);
  }
});

test('number-order counts actual correct selections and three wrong choices lose', () => {
  const engine = games['number-order']; let state = engine.create({ seed: 3 });
  for (let n = 1; n <= 16; n++) state = click(engine, state, state.board.indexOf(n)); mustWin(state); assert.equal(state.next, 17);
  state = engine.create({ seed: 3 }); for (let n = 0; n < 3; n++) state = click(engine, state, state.board.indexOf(16)); assert.equal(state.status, 'lost'); assert.equal(state.lives, 0); assert.equal(state.score, 0);
});

test('Sudoku4×4 givens are protected, generated solution obeys constraints and cycles solve', () => {
  const engine = games['sudoku-mini'];
  for (let seed = 0; seed < 30; seed++) {
    let state = engine.create({ seed }), target = state.solution;
    for (let r = 0; r < 4; r++) assert.equal(new Set(target.slice(r * 4, r * 4 + 4)).size, 4);
    for (let c = 0; c < 4; c++) assert.equal(new Set([target[c], target[c + 4], target[c + 8], target[c + 12]]).size, 4);
    for (let r = 0; r < 4; r += 2) for (let c = 0; c < 4; c += 2) assert.equal(new Set([target[r * 4 + c], target[r * 4 + c + 1], target[(r + 1) * 4 + c], target[(r + 1) * 4 + c + 1]]).size, 4);
    const given = state.givens.indexOf(true); assert.deepEqual(click(engine, state, given), state);
    for (let i = 0; i < 16; i++) if (!state.givens[i]) for (let v = 0; v < target[i]; v++) state = click(engine, state, i); mustWin(state); assert.deepEqual(state.board, target);
  }
});

test('color flood generated constructive route fits real limit and no-op color is ignored', () => {
  const engine = games['color-flood'];
  for (let seed = 0; seed < 20; seed++) {
    let state = engine.create({ seed, difficulty: 'hard' }), solution = state.solution;
    assert.deepEqual(click(engine, state, 0), state);
    for (const color of solution) { const at = state.board.indexOf(color); assert.ok(at >= 0); state = click(engine, state, at); }
    mustWin(state); assert.equal(new Set(state.board).size, 1); assert.ok(state.moves <= state.limit);
  }
  let lost = engine.create({ seed: 4 }); lost.limit = 1; const choice = lost.board.findIndex(v => v !== lost.board[0]); lost = click(engine, lost, choice); assert.equal(lost.status, 'lost');
});

test('pipe link rotations recover a complete25-cell compatible network', () => {
  const engine = games['pipe-link'];
  for (let seed = 0; seed < 20; seed++) {
    let state = engine.create({ seed }), solution = state.solution;
    for (let at = 0; at < 25 && state.status === 'playing'; at++) { let count = 0; while (state.board[at] !== solution[at] && state.status === 'playing' && count++ < 4) state = click(engine, state, at); assert.ok(count <= 4); }
    mustWin(state); assert.ok(engine.describe(state).summary.includes('25/25'));
  }
});

test('code-breaker duplicate-aware feedback, real winning guess and8-attempt loss', () => {
  const engine = games['code-breaker']; let state = engine.create({ seed: 1 }); state.secret = [0, 0, 1, 1]; state.guess = [0, 1, 0, 2];
  state = click(engine, state, 4); assert.deepEqual(state.attempts[0], { guess: [0, 1, 0, 2], exact: 1, near: 2 });
  state = engine.create({ seed: 2 }); for (let i = 0; i < 4; i++) for (let count = 0; count < state.secret[i]; count++) state = click(engine, state, i); state = click(engine, state, 4); mustWin(state);
  state = engine.create({ seed: 2 }); state.secret = [1, 2, 3, 4]; for (let i = 0; i < 8; i++) state = click(engine, state, 4); assert.equal(state.status, 'lost'); assert.equal(state.attempts.length, 8); assert.ok(state.message.includes('Mật mã'));
});

test('knights tour seeded symmetries retain valid25-cell path, invalid jumps ignored and undo works', () => {
  const engine = games['knights-tour'];
  for (let seed = 0; seed < 24; seed++) {
    let state = engine.create({ seed }), solution = state.solution;
    assert.equal(new Set(solution).size, 25); assert.deepEqual(click(engine, state, state.player), state);
    for (const at of solution.slice(1)) state = click(engine, state, at); mustWin(state); assert.equal(state.visited, 25);
    state = engine.step(state, { type: 'undo' }); assert.equal(state.status, 'playing'); assert.equal(state.visited, 24);
  }
});

test('17 scene-aware material renderers invoke background once, retain standalone fallback and never mutate games', () => {
  const renderSignatures = new Set();
  for (const engine of Object.values(games)) {
    const state = freeze(engine.create({ seed: 'art-direction' })), before = JSON.stringify(state), calls = [];
    const ctx = new Proxy({}, { get: (target, name) => name in target ? target[name] : (...args) => calls.push([name, args, target.fillStyle, target.strokeStyle]), set: (target, name, value) => (target[name] = value, true) });
    let painted = 0;
    engine.draw(ctx, state, { width: 375, height: 480, reducedMotion: true, paintScene: (context, id, source) => { painted++; assert.equal(context, ctx); assert.equal(id, engine.id); assert.equal(source, state); context.fillRect(0, 0, 375, 480); } });
    assert.equal(painted, 1); assert.equal(JSON.stringify(state), before);
    assert.equal(calls.filter(c => c[0] === 'fillRect' && c[1].join(',') === '0,0,375,480').length, 1);
    assert.ok(calls.some(c => c[0] === 'fill'), 'procedural materials are drawn');
    renderSignatures.add(JSON.stringify(calls));
    calls.length = 0; engine.draw(ctx, state, { width: 375, height: 480 });
    assert.equal(calls.filter(c => c[0] === 'fillRect' && c[1].join(',') === '0,0,375,480').length, 1);
    assert.equal(JSON.stringify(state), before);
  }
  assert.equal(renderSignatures.size, 17, 'all games produce individually different board materials and layouts');
});
