'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { games } = require('../all-game-puzzles.js');

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); Object.values(value).forEach(freeze);
  }
  return value;
}
function boardState(board, extra = {}) {
  return { ...games.merge.create({ seed: 'fixture' }), board: board.concat(Array(16 - board.length).fill(0)), history: [], ...extra };
}

test('puzzles publish identical browser/CommonJS engines without ambient services', () => {
  const source = fs.readFileSync(path.join(__dirname, '../all-game-puzzles.js'), 'utf8');
  const context = vm.createContext({}); vm.runInContext(source, context);
  assert.deepEqual(Object.keys(context.HHAllGamePuzzles.games), ['merge', 'mines', 'memory']);
  assert.equal(/\b(?:localStorage|indexedDB|fetch|setTimeout|setInterval|requestAnimationFrame)\b/.test(source), false);
  for (const [id, engine] of Object.entries(games)) {
    const state = engine.create({ seed: 'same', difficulty: 'normal' });
    assert.equal(state.version, 1); assert.equal(state.id, id); assert.equal(state.status, 'playing');
    assert.deepEqual(state, engine.create({ seed: 'same', difficulty: 'normal' }));
    assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
    assert.ok(engine.describe(state).summary.length > 20);
  }
});

test('merge initial board contains exactly two seeded tiles', () => {
  const state = games.merge.create({ seed: 7 });
  assert.equal(state.board.filter(Boolean).length, 2);
  assert.ok(state.board.every(value => [0, 2, 4].includes(value)));
  assert.notDeepEqual(state.board, games.merge.create({ seed: 8 }).board);
});

test('merge combines once per tile per move and counts actual merged score', () => {
  const first = games.merge.step(boardState([2, 2, 2, 2]), { type: 'left' });
  assert.deepEqual(first.board.slice(0, 2), [4, 4]); assert.equal(first.score, 8);
  assert.equal(first.board.filter(Boolean).length, 3); assert.equal(first.moves, 1);
  const second = games.merge.step(boardState([4, 4, 8]), { type: 'left' });
  assert.deepEqual(second.board.slice(0, 2), [8, 8]); assert.equal(second.score, 8);
});

test('merge supports right/up/down orientations', () => {
  const right = games.merge.step(boardState([2, 2]), { type: 'right' });
  assert.equal(right.board[3], 4);
  const up = games.merge.step(boardState([2, 0, 0, 0, 2]), { type: 'up' });
  assert.equal(up.board[0], 4);
  const down = games.merge.step(boardState([2, 0, 0, 0, 2]), { type: 'down' });
  assert.equal(down.board[12], 4);
});

test('merge no-op does not spawn, consume RNG, add history, moves or score', () => {
  const state = boardState([2, 4, 8, 16]);
  const next = games.merge.step(freeze(state), { type: 'left' });
  assert.notEqual(next, state); assert.deepEqual(next, state);
});

test('merge undo restores full seeded pre-move state and replays identically', () => {
  const state = boardState([2, 2]);
  const moved = games.merge.step(freeze(state), { type: 'left' });
  const undone = games.merge.step(freeze(moved), { type: 'undo' });
  assert.deepEqual(undone, state);
  assert.deepEqual(games.merge.step(undone, { type: 'left' }), moved);
  assert.deepEqual(games.merge.step(state, { type: 'undo' }), state);
});

test('merge victory pauses progression until continue and loss is real', () => {
  const won = games.merge.step(boardState([1024, 1024]), { type: 'left' });
  assert.equal(won.status, 'won'); assert.equal(won.board[0], 2048); assert.equal(won.score, 2048);
  assert.deepEqual(games.merge.step(won, { type: 'right' }), won);
  const continued = games.merge.step(won, { type: 'continue' });
  assert.equal(continued.status, 'playing'); assert.equal(continued.keepPlaying, true);
  const lost = games.merge.step(boardState([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2]), { type: 'left' });
  assert.equal(lost.status, 'lost'); assert.equal(lost.moves, 0);
});

test('merge retains a bounded undo history', () => {
  let state = games.merge.create({ seed: 'bounded' });
  state.history = Array.from({ length: 50 }, () => ({ board: state.board.slice(), rng: state.rng, score: 0, moves: 0, level: 1, status: 'playing', keepPlaying: false }));
  state = games.merge.step(state, { type: 'down' });
  assert.ok(state.history.length <= 50);
});

test('mines difficulties are bounded and invalid difficulty falls back safely', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const state = games.mines.create({ seed: 1, difficulty });
    assert.ok(state.columns >= 8 && state.columns <= 12); assert.equal(state.board.length, state.columns * state.rows);
    assert.equal(state.board.filter(cell => cell.mine).length, 0); assert.equal(state.minesPlaced, false);
  }
  assert.equal(games.mines.create({ difficulty: '__proto__' }).difficulty, 'easy');
});

test('mines first reveal and neighboring area are safe for every difficulty', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) for (let seed = 0; seed < 12; seed++) {
    const state = games.mines.create({ seed, difficulty }), index = Math.floor(state.board.length / 2) + 3;
    const revealed = games.mines.step(freeze(state), { type: 'cell', index });
    assert.equal(revealed.minesPlaced, true); assert.equal(revealed.board[index].mine, false);
    assert.equal(revealed.board[index].adjacent, 0); assert.equal(revealed.board[index].revealed, true);
    assert.ok(revealed.revealed > 1); assert.equal(revealed.status, 'playing');
    assert.equal(revealed.board.filter(cell => cell.mine).length, revealed.mineCount);
    assert.deepEqual(revealed, games.mines.step(state, { type: 'cell', index }));
  }
});

test('mines flags toggle without placing mines and are limited to the actual count', () => {
  let state = games.mines.create({ seed: 'flags' });
  for (let i = 0; i < state.mineCount + 2; i++) state = games.mines.step(freeze(state), { type: 'cell', index: i, alternate: true });
  assert.equal(state.flags, state.mineCount); assert.equal(state.minesPlaced, false);
  assert.equal(state.board[state.mineCount].flagged, false);
  const blocked = games.mines.step(state, { type: 'cell', index: 0 });
  assert.deepEqual(blocked.board, state.board); assert.equal(blocked.flags, state.flags); assert.equal(blocked.minesPlaced, false);
  state = games.mines.step(state, { type: 'cell', index: 0, alternate: true });
  assert.equal(state.flags, state.mineCount - 1); assert.equal(state.board[0].flagged, false);
});

test('mines flood reveal never opens flagged cells and loss exposes actual bombs', () => {
  let state = games.mines.create({ seed: 'flood' });
  state = games.mines.step(state, { type: 'cell', index: 1, alternate: true });
  state = games.mines.step(state, { type: 'cell', index: 0 });
  assert.equal(state.board[1].revealed, false); assert.equal(state.board[1].flagged, true);
  const mineIndex = state.board.findIndex(cell => cell.mine && !cell.flagged);
  const lost = games.mines.step(freeze(state), { type: 'cell', index: mineIndex });
  assert.equal(lost.status, 'lost'); assert.equal(lost.exploded, mineIndex);
  assert.ok(lost.board.filter(cell => cell.mine).every(cell => cell.revealed));
  assert.equal(lost.score, state.score);
  assert.equal(games.mines.describe(lost).cells.every(cell => cell.disabled), true);
});

test('mines win requires every safe cell, not merely flags', () => {
  let state = games.mines.step(games.mines.create({ seed: 'win' }), { type: 'cell', index: 0 });
  for (let i = 0; i < state.board.length; i++) if (!state.board[i].mine && !state.board[i].revealed) state = games.mines.step(state, { type: 'cell', index: i });
  assert.equal(state.status, 'won'); assert.equal(state.revealed, state.board.length - state.mineCount);
  assert.equal(state.flags, state.mineCount); assert.equal(state.score, state.revealed * 10);
  assert.equal(state.board.filter(cell => cell.mine).every(cell => cell.flagged), true);
});

test('mines rejects out-of-bounds indices and keyboard selection stays in board', () => {
  const state = games.mines.create({ seed: 1 });
  for (const index of [-1, 1.5, 10000, undefined, '2']) assert.deepEqual(games.mines.step(state, { type: 'cell', index }), state);
  assert.equal(games.mines.step(state, { type: 'left' }).selected, 0);
  const selected = games.mines.step(state, { type: 'right' });
  assert.equal(selected.selected, 1);
  assert.equal(games.mines.step(selected, { type: 'action' }).board[1].revealed, true);
});

test('memory difficulties contain exactly two cards per pair and hide unopened answers', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const state = games.memory.create({ seed: 'deck', difficulty });
    assert.equal(state.board.length, state.pairs * 2);
    for (let face = 0; face < state.pairs; face++) assert.equal(state.board.filter(card => card.face === face).length, 2);
    const description = games.memory.describe(state);
    assert.ok(description.cells.every(cell => cell.label === '?' && cell.description.includes('đang úp')));
    assert.ok(state.board.length <= 24);
  }
});

test('memory matching pair advances once and cannot be selected again', () => {
  let state = games.memory.create({ seed: 'match' });
  const first = 0, second = state.board.findIndex((card, index) => index > 0 && card.face === state.board[first].face);
  state = games.memory.step(freeze(state), { type: 'cell', index: first });
  assert.deepEqual(state.open, [first]); assert.equal(state.moves, 0);
  assert.deepEqual(games.memory.step(state, { type: 'cell', index: first }), state);
  state = games.memory.step(freeze(state), { type: 'cell', index: second });
  assert.equal(state.matchedPairs, 1); assert.equal(state.moves, 1); assert.equal(state.score, 100); assert.deepEqual(state.open, []);
  assert.deepEqual(games.memory.step(state, { type: 'cell', index: first }), state);
});

test('memory mismatches resolve from deterministic tick and block a third card', () => {
  let state = games.memory.create({ seed: 'mismatch' });
  const second = state.board.findIndex(card => card.face !== state.board[0].face);
  state = games.memory.step(state, { type: 'cell', index: 0 });
  state = games.memory.step(state, { type: 'cell', index: second });
  assert.equal(state.mismatchRemaining, 0.85); assert.equal(state.moves, 1);
  assert.deepEqual(games.memory.step(state, { type: 'cell', index: 5 }), state);
  state = games.memory.step(freeze(state), { type: 'tick' }, 0.4); assert.equal(state.open.length, 2);
  state = games.memory.step(freeze(state), { type: 'tick' }, 0.45);
  assert.deepEqual(state.open, []); assert.equal(state.mismatchRemaining, 0); assert.ok(Math.abs(state.elapsed - 0.85) < 1e-10);
});

test('memory completion uses real matches and stops elapsed time after winning', () => {
  let state = games.memory.create({ seed: 'complete' });
  for (let face = 0; face < state.pairs; face++) {
    const indices = state.board.flatMap((card, index) => card.face === face ? [index] : []);
    for (const index of indices) state = games.memory.step(state, { type: 'cell', index });
  }
  assert.equal(state.status, 'won'); assert.equal(state.moves, state.pairs); assert.equal(state.score, state.pairs * 100);
  assert.deepEqual(games.memory.step(state, { type: 'tick' }, 1), state);
  assert.equal(games.memory.describe(state).cells.every(cell => cell.disabled), true);
});

test('memory invalid actions cannot uncover cards or advance the clock', () => {
  const state = games.memory.create({ seed: 4 });
  for (const index of [-1, 2000, 1.2, '1', undefined]) assert.deepEqual(games.memory.step(state, { type: 'cell', index }), state);
  assert.deepEqual(games.memory.step(state, { type: 'cell', index: 1, alternate: true }), state);
  assert.deepEqual(games.memory.step(state, { type: 'tick' }, -1), state);
  assert.equal(games.memory.step(state, { type: 'right' }).selected, 1);
  assert.deepEqual(games.memory.step(state, { type: 'action' }).open, [0]);
});

test('every engine step and canvas draw preserve deeply frozen input state', () => {
  const ctx = new Proxy({ createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) }, { get: (target, key) => key in target ? target[key] : () => {}, set: (target, key, value) => { target[key] = value; return true; } });
  for (const engine of Object.values(games)) {
    const state = freeze(engine.create({ seed: 'immutable' })), snapshot = JSON.stringify(state);
    for (const action of [{ type: 'left' }, { type: 'right' }, { type: 'up' }, { type: 'down' }, { type: 'action' }, { type: 'cell', index: 4 }, { type: 'cell', index: 4, alternate: true }, { type: 'tick', held: {} }, { type: 'undo' }, { type: 'continue' }]) {
      const next = engine.step(state, action, 0.2); assert.notEqual(next, state); assert.equal(JSON.stringify(state), snapshot);
    }
    engine.draw(ctx, state, { width: 375, height: 480, reducedMotion: true });
    assert.equal(JSON.stringify(state), snapshot);
  }
});

test('three puzzle renderers paint the shared individual scene once without covering it', () => {
  for (const engine of Object.values(games)) {
    const state = freeze(engine.create({ seed: 'materials' })), before = JSON.stringify(state), calls = [];
    const ctx = new Proxy({ createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) }, { get: (target, name) => name in target ? target[name] : (...args) => calls.push({ name, args }), set: (target, name, value) => (target[name] = value, true) });
    let painted = 0;
    engine.draw(ctx, state, { width: 375, height: 480, reducedMotion: true, paintScene: (context, id, source) => { painted++; assert.equal(context, ctx); assert.equal(id, engine.id); assert.equal(source, state); context.fillRect(0, 0, 375, 480); } });
    assert.equal(painted, 1); assert.equal(JSON.stringify(state), before);
    assert.equal(calls.filter(c => c.name === 'fillRect' && c.args.join(',') === '0,0,375,480').length, 1, 'no opaque background over the supplied scene');
    assert.ok(calls.some(c => c.name === 'roundRect'), 'rounded material tiles are rendered');
    assert.ok(calls.some(c => c.name === 'stroke'), 'light-catching tile contours are rendered');
    calls.length = 0; engine.draw(ctx, state, { width: 375, height: 480 });
    assert.equal(calls.filter(c => c.name === 'fillRect' && c.args.join(',') === '0,0,375,480').length, 1, 'standalone fallback still paints a complete background');
    assert.equal(JSON.stringify(state), before);
  }
});
