'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { games, internals } = require('../all-game-pack-casual.js');
const copy = value => JSON.parse(JSON.stringify(value));
const cell = index => ({ type: 'cell', index });
function advance(game, state, duration) { let remaining = duration; while (remaining > 1e-9 && state.status === 'playing') { const dt = Math.min(.05, remaining); state = game.step(state, 'tick', dt); remaining -= dt; } return state; }
function waitFor(game, state, condition, maxSeconds) { for (let steps = 0; !condition(state) && state.status === 'playing' && steps < (maxSeconds || 100) * 100; steps++) state = game.step(state, 'tick', .01); return state; }

test('casual pack provides sixteen distinct original game engines', () => {
  assert.equal(Object.keys(games).length, 16);
  assert.deepEqual(Object.keys(games), ['simon-sequence', 'reaction-stop', 'rhythm-tap', 'whack-orb', 'aim-trainer', 'math-sprint', 'color-word', 'odd-one-out', 'pattern-recall', 'treasure-grid', 'lock-timing', 'stack-tower', 'constellation-trace', 'pixel-painter', 'garden-care', 'cafe-orders']);
});

test('each casual engine is deterministic, immutable, versioned and keyboard-described', () => {
  for (const game of Object.values(games)) {
    const original = game.create({ seed: 'casual-repeat' }), snapshot = copy(original);
    let state = original, mirror = game.create({ seed: 'casual-repeat' });
    for (const action of [cell(0), 'tick', 'left', cell(3), 'action']) {
      const previous = copy(state), source = state; state = game.step(state, action, .05); mirror = game.step(mirror, action, .05); assert.deepEqual(source, previous, game.id + ': no mutation');
    }
    assert.deepEqual(state, mirror); assert.deepEqual(original, snapshot); assert.equal(state.version, 1); assert.equal(state.id, game.id);
    const description = game.describe(state); assert.ok(description.summary.length > 10); assert.ok(description.columns >= 1);
    assert.equal(new Set(description.cells.map(item => item.index)).size, description.cells.length);
    for (const item of description.cells) { assert.equal(item.label, item.description); assert.ok(item.text.length > 0); assert.ok(item.label.length > 0); assert.equal(typeof item.disabled, 'boolean'); }
  }
});

test('simon plays a real timed sequence, blocks premature input, and wins after four remembered sequences', () => {
  const game = games['simon-sequence']; let state = game.create({ seed: 8 });
  assert.deepEqual(game.step(state, cell(state.sequence[0])), state);
  state = advance(game, state, .1); assert.ok(state.active >= 0); assert.ok(game.describe(state).cells.some(item => item.pressed && item.background));
  for (let round = 1; round <= 4; round++) {
    state = waitFor(game, state, current => current.phase === 'input'); assert.equal(state.round, round);
    const sequence = state.sequence.slice(); for (const index of sequence) state = game.step(state, cell(index));
  }
  assert.equal(state.status, 'won'); assert.equal(state.score, (3 + 4 + 5 + 6) * 20);
  let wrong = game.create(); wrong = waitFor(game, wrong, current => current.phase === 'input'); wrong = game.step(wrong, cell((wrong.sequence[0] + 1) % 4)); assert.equal(wrong.status, 'lost');
});

test('reaction rejects early clicks, times actual active frames and needs three valid signals', () => {
  const game = games['reaction-stop']; assert.equal(game.step(game.create(), 'action').status, 'lost');
  let state = game.create({ seed: 'reaction' });
  for (let round = 0; round < 3; round++) { state = waitFor(game, state, value => value.phase === 'go'); state = advance(game, state, .2); state = game.step(state, 'action'); }
  assert.equal(state.status, 'won'); assert.equal(state.results.length, 3); assert.ok(state.results.every(time => Math.abs(time - .2) < .0001));
  let slow = game.create(); slow = waitFor(game, slow, value => value.phase === 'go'); slow = advance(game, slow, 1.3); assert.equal(slow.status, 'lost');
});

test('rhythm has twelve real time windows, rewards nine-plus hits and rejects spam', () => {
  const game = games['rhythm-tap']; let state = game.create();
  for (let beat = 0; beat < 12; beat++) { state = waitFor(game, state, current => Math.abs(current.elapsed - current.nextBeat) <= .015); state = game.step(state, 'action'); }
  assert.equal(state.status, 'won'); assert.equal(state.hits, 12); assert.equal(state.score, 1200);
  let spam = game.create(); for (let i = 0; i < 4; i++) spam = game.step(spam, 'action'); assert.equal(spam.status, 'lost');
  assert.equal(advance(game, game.create(), 13).status, 'lost');
});

test('whack uses expiring targets, real hits and four-error loss', () => {
  const game = games['whack-orb']; let state = game.create({ seed: 15 });
  for (let i = 0; i < 12; i++) state = game.step(state, cell(state.target));
  assert.equal(state.status, 'won'); assert.equal(state.hits, 12);
  let wrong = game.create(); for (let i = 0; i < 4; i++) wrong = game.step(wrong, cell((wrong.target + 1) % 9)); assert.equal(wrong.status, 'lost');
  assert.equal(advance(game, game.create(), 6).status, 'lost');
});

test('aim requires fifteen different reachable targets and honestly expires', () => {
  const game = games['aim-trainer']; let state = game.create({ seed: 'aim' });
  for (let i = 0; i < 15; i++) { const target = state.target; state = game.step(state, cell(target)); if (state.status === 'playing') assert.notEqual(state.target, target); }
  assert.equal(state.status, 'won'); assert.equal(state.score, 1500);
  assert.equal(advance(game, game.create(), 26).status, 'lost');
  let bad = game.create(); for (let i = 0; i < 8; i++) bad = game.step(bad, cell((bad.target + 1) % 20)); assert.equal(bad.status, 'lost');
});

test('math creates valid unique distractors and requires ten correct arithmetic answers', () => {
  const game = games['math-sprint']; let state = game.create({ seed: 'math' });
  for (let round = 0; round < 10; round++) {
    const q = state.question; assert.equal(new Set(q.options).size, 4); assert.ok(q.options.includes(q.answer));
    const match = q.prompt.match(/^(\d+) ([+−×]) (\d+)$/); assert.ok(match); const a = +match[1], b = +match[3]; assert.equal(q.answer, match[2] === '+' ? a + b : match[2] === '−' ? a - b : a * b);
    state = game.step(state, cell(q.options.indexOf(q.answer)));
  }
  assert.equal(state.status, 'won'); assert.equal(state.score, 1000);
  let wrong = game.create(); const badIndex = wrong.question.options.findIndex(value => value !== wrong.question.answer); for (let i = 0; i < 3; i++) wrong = game.step(wrong, cell(badIndex)); assert.equal(wrong.status, 'lost');
});

test('color-word checks ink instead of word and preserves non-color cues', () => {
  const game = games['color-word']; let state = game.create({ seed: 99 });
  for (let i = 0; i < 12; i++) { assert.notEqual(state.ink, state.word); const info = game.describe(state); assert.match(info.summary, /màu mực/); assert.equal(info.summary.includes(internals.COLOR_NAMES[state.ink]), false); assert.equal(info.visualCue.text, internals.COLOR_NAMES[state.word]); assert.equal(info.visualCue.color, internals.COLORS[state.ink]); assert.ok(info.visualCue.label.includes(internals.COLOR_NAMES[state.ink])); state = game.step(state, cell(state.ink)); }
  assert.equal(state.status, 'won'); let wrong = game.create(); for (let i = 0; i < 4; i++) wrong = game.step(wrong, cell(wrong.word)); assert.equal(wrong.status, 'lost');
});

test('odd-one-out displays exactly one different symbol and resolves eight rounds', () => {
  const game = games['odd-one-out']; let state = game.create();
  for (let round = 0; round < 8; round++) { const cells = game.describe(state).cells; const rare = cells[state.target].text; assert.equal(cells.filter(item => item.text === rare).length, 1); state = game.step(state, cell(state.target)); }
  assert.equal(state.status, 'won'); let wrong = game.create(); for (let i = 0; i < 3; i++) wrong = game.step(wrong, cell((wrong.target + 1) % 16)); assert.equal(wrong.status, 'lost');
});

test('pattern recall hides its preview, toggles selections and supports a real submit cell', () => {
  const game = games['pattern-recall']; let state = game.create();
  assert.equal(game.describe(state).cells.filter(item => item.pressed).length, 4); assert.deepEqual(game.step(state, cell(0)), state);
  for (let round = 1; round <= 3; round++) { state = waitFor(game, state, value => value.phase === 'recall'); assert.equal(game.describe(state).cells.filter(item => item.pressed).length, 0); const indices = state.pattern.slice(); for (const index of indices) state = game.step(state, cell(index)); state = game.step(state, cell(16)); }
  assert.equal(state.status, 'won');
  let wrong = game.create(); wrong = waitFor(game, wrong, value => value.phase === 'recall'); wrong = game.step(wrong, 'action'); assert.equal(wrong.status, 'lost');
});

function treasureSolution(state) {
  const queue = [{ index: 0, mask: 0, path: [] }], seen = new Set(['0:0']);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor]; if (current.index === 35 && current.mask === 7) return current.path;
    for (const next of internals.neighbors(current.index, 6, 36)) {
      if (state.traps.includes(next)) continue;
      const treasure = state.treasures.indexOf(next), mask = current.mask | (treasure >= 0 ? 1 << treasure : 0), key = next + ':' + mask;
      if (!seen.has(key)) { seen.add(key); queue.push({ index: next, mask, path: [...current.path, next] }); }
    }
  }
  return null;
}
test('treasure generator keeps traps avoidable and every seeded board has a finite real winning path', () => {
  const game = games['treasure-grid'];
  for (let seed = 0; seed < 30; seed++) { let state = game.create({ seed }); const path = treasureSolution(state); assert.ok(path && path.length < 80); assert.equal(state.traps.length, 4); assert.equal(new Set([...state.treasures, ...state.traps]).size, 7); for (const index of path) state = game.step(state, cell(index)); assert.equal(state.status, 'won'); assert.equal(state.collected.length, 3); assert.equal(state.lives, 3); }
});

test('treasure rejects distant cells, has honest shield damage and no row wrapping', () => {
  const game = games['treasure-grid']; let state = game.create(); assert.deepEqual(game.step(state, cell(35)), state); assert.deepEqual(game.step(state, 'left'), state);
  state.player = 5; assert.deepEqual(game.step(state, 'right'), state);
  state.player = 0; state.traps = [1, 2, 3]; state = game.step(state, cell(1)); assert.equal(state.lives, 2); state = game.step(state, cell(0)); state = game.step(state, cell(1)); assert.equal(state.lives, 2); state = game.step(state, cell(2)); state = game.step(state, cell(3)); assert.equal(state.status, 'lost');
});

test('lock timing wins only inside five shrinking actual angular windows', () => {
  const game = games['lock-timing']; let state = game.create({ seed: 'lock' }), width = 1;
  for (let round = 0; round < 5; round++) { assert.ok(state.window < width); width = state.window; state = waitFor(game, state, value => internals.angularDistance(value.phase, value.target) < value.window / 3); state = game.step(state, 'action'); }
  assert.equal(state.status, 'won');
  let wrong = game.create(); wrong.phase = (wrong.target + .5) % 1; for (let i = 0; i < 3; i++) wrong = game.step(wrong, 'action'); assert.equal(wrong.status, 'lost');
});

test('stack tower uses real overlap trimming and ten time-aligned drops can win', () => {
  const game = games['stack-tower']; let state = game.create();
  for (let floor = 0; floor < 10; floor++) { state = waitFor(game, state, value => Math.abs(value.moving.x - value.tower.at(-1).x) < 2); state = game.step(state, 'action'); }
  assert.equal(state.status, 'won'); assert.equal(state.tower.length, 11); assert.ok(state.tower.at(-1).width > 300);
  let cut = game.create(); cut.moving.x = 260; cut = game.step(cut, 'action'); assert.equal(cut.tower.at(-1).width, 280); assert.equal(cut.tower.at(-1).x, 260);
  const miss = game.step(game.create(), 'action'); assert.equal(miss.status, 'playing'); // First 0..360 overlaps base180..540.
  let lost = game.create(); lost.moving.width = 40; lost.moving.x = 0; lost = game.step(lost, 'action'); assert.equal(lost.status, 'lost');
});

test('constellation requires its actual ordered path across three distinct original shapes', () => {
  const game = games['constellation-trace']; let state = game.create(); const orders = [];
  for (let round = 0; round < 3; round++) { orders.push(state.order.join(',')); assert.equal(new Set(state.order).size, 8); const order = state.order.slice(); for (const index of order) state = game.step(state, cell(index)); }
  assert.equal(state.status, 'won'); assert.ok(new Set(orders).size > 1);
  let wrong = game.create(); const wrongIndex = (wrong.order[0] + 1) % 8; for (let i = 0; i < 3; i++) wrong = game.step(wrong, cell(wrongIndex)); assert.equal(wrong.status, 'lost');
});

test('pixel painter has three original targets, real palette painting, erase and checked completion', () => {
  const game = games['pixel-painter']; assert.equal(internals.PIXEL_PATTERNS.length, 3);
  for (let seed = 0; seed < 8; seed++) { let state = game.create({ seed }); const initial = copy(state); state = game.step(state, cell(64 + 2)); state = game.step(state, cell(0)); assert.equal(state.pixels[0], 2); state = game.step(state, { ...cell(0), alternate: true }); assert.equal(state.pixels[0], 0);
    state = game.step(state, 'action'); assert.equal(state.status, 'playing'); assert.ok(state.score < 640);
    for (let index = 0; index < 64; index++) { state = game.step(state, cell(64 + state.target[index])); state = game.step(state, cell(index)); }
    assert.equal(state.status, 'playing'); state = game.step(state, cell(68)); assert.equal(state.status, 'won'); assert.equal(state.score, 640); assert.ok(initial.pixels.every(value => value === 0));
  }
});

test('garden actually grows, consumes water, refills with cooldown and all three plants can be harvested', () => {
  const game = games['garden-care']; let state = game.create();
  for (let frame = 0; frame < 1400 && state.status === 'playing'; frame++) {
    for (let i = 0; i < 3; i++) { const plant = state.plants[i]; if (!plant.harvested && (plant.growth >= 1 || (plant.water < .35 && state.reservoir > 0))) state = game.step(state, cell(i)); }
    if (state.status === 'playing' && !state.reservoir && !state.refillCooldown) state = game.step(state, 'action');
    state = game.step(state, 'tick', .05);
  }
  assert.equal(state.status, 'won'); assert.equal(state.harvested, 3); assert.ok(state.score > 250);
  let dry = advance(game, game.create(), 45); assert.equal(dry.status, 'lost'); assert.ok(dry.plants.some(plant => plant.health <= 0));
  let refill = game.step(game.create(), 'action'); assert.equal(refill.refillCooldown, 8); refill = game.step(refill, cell(0)); const remaining = refill.reservoir; refill = game.step(refill, 'action'); assert.equal(refill.reservoir, remaining);
});

test('cafe requires ordered ingredient recipes, provides reset and serves eight real cups', () => {
  const game = games['cafe-orders']; let state = game.create({ seed: 'cafe' });
  for (let order = 0; order < 8; order++) { const recipe = internals.RECIPES[state.order]; for (const ingredient of recipe.parts) state = game.step(state, cell(ingredient)); state = game.step(state, cell(7)); }
  assert.equal(state.status, 'won'); assert.equal(state.served, 8); assert.ok(state.score >= 800);
  let wrong = game.create(); for (let i = 0; i < 3; i++) wrong = game.step(wrong, 'action'); assert.equal(wrong.status, 'lost');
  let reset = game.step(game.create(), cell(0)); reset = game.step(reset, cell(6)); assert.equal(reset.cup.length, 0);
  assert.equal(advance(game, game.create(), 49).status, 'lost');
});

test('all timers clamp oversized deltas and terminal states remain frozen', () => {
  for (const game of Object.values(games)) {
    const initial = game.create({ seed: 'clamp' }); assert.deepEqual(game.step(initial, 'tick', 20), game.step(initial, 'tick', .05), game.id);
    const terminal = { ...initial, status: 'won' }; assert.deepEqual(game.step(terminal, cell(0)), terminal); assert.deepEqual(game.step(terminal, 'tick', .05), terminal);
    assert.deepEqual(game.step(initial, cell(10000)), initial, game.id + ' ignores out-of-range cells');
  }
});

test('difficulty changes real time, treasure and constellation budgets; essential scenes are exposed', () => {
  for (const game of Object.values(games)) {
    const easy = game.create({ difficulty: 'easy' }), hard = game.create({ difficulty: 'hard' });
    if (easy.timeLeft !== null) assert.ok(easy.timeLeft > hard.timeLeft, game.id + ' changes time allowance');
  }
  assert.ok(games['treasure-grid'].create({ difficulty: 'easy' }).maxMoves > games['treasure-grid'].create({ difficulty: 'hard' }).maxMoves);
  assert.ok(games['treasure-grid'].create({ difficulty: 'easy' }).lives > games['treasure-grid'].create({ difficulty: 'hard' }).lives);
  assert.ok(games['constellation-trace'].create({ difficulty: 'easy' }).mistakeLimit > games['constellation-trace'].create({ difficulty: 'hard' }).mistakeLimit);
  for (const id of ['rhythm-tap', 'color-word', 'lock-timing', 'stack-tower', 'constellation-trace', 'pixel-painter', 'garden-care', 'cafe-orders']) assert.equal(games[id].describe(games[id].create()).showCanvas, true);
});

test('all sixteen renderers are canvas-only, scalable and leave state unchanged', () => {
  const context = new Proxy({ createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) }, { get(target, name) { if (!(name in target)) target[name] = () => {}; return target[name]; }, set(target, name, value) { target[name] = value; return true; } });
  for (const game of Object.values(games)) { const state = game.create(), original = copy(state); game.draw(context, state, { width: 720, height: 480, reducedMotion: false }); game.draw(context, state, { width: 375, height: 250, reducedMotion: true }); assert.deepEqual(state, original); }
});

test('all sixteen renderers preserve individualized scene callbacks without filling over the background', () => {
  for (const game of Object.values(games)) {
    const state = game.create(), original = copy(state), calls = [], fills = [];
    const context = new Proxy({ createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), fillRect(...args) { fills.push(args); } }, { get(target, key) { if (!(key in target)) target[key] = () => {}; return target[key]; }, set(target, key, value) { target[key] = value; return true; } });
    game.draw(context, state, { width: 720, height: 480, reducedMotion: true, paintScene(ctx, id, current) { calls.push({ ctx, id, current }); } });
    assert.equal(calls.length, 1); assert.equal(calls[0].ctx, context); assert.equal(calls[0].id, game.id); assert.equal(calls[0].current, state);
    assert.equal(fills.filter(args => args[0] === 0 && args[1] === 0 && args[2] === 720 && args[3] === 480).length, 0); assert.deepEqual(state, original);
  }
});

test('casual engines own no network, device, storage, DOM, RAF or background timers', () => {
  const source = require('node:fs').readFileSync(require.resolve('../all-game-pack-casual.js'), 'utf8');
  assert.doesNotMatch(source, /\b(?:setTimeout|setInterval|requestAnimationFrame|fetch|localStorage|sessionStorage|document|AudioContext)\s*[.(]/);
  assert.doesNotMatch(source, /Math\.random\s*\(/);
});
