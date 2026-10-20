'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const pack = require('../all-game-pack-arcade.js');
const games = pack.games;
const ids = ['paddle-duel', 'sky-glider', 'meteor-dodge', 'coin-catcher', 'road-rush', 'river-cross', 'asteroid-drift', 'gravity-flip', 'ball-balance', 'jump-tower', 'laser-dash', 'orbit-collect', 'shield-defense', 'target-range', 'penalty-kick', 'mini-golf', 'basket-shot'];
function freeze(value) { Object.freeze(value); for (const item of Object.values(value)) if (item && typeof item === 'object' && !Object.isFrozen(item)) freeze(item); return value; }
function step(id, state, action = 'tick', seconds = 0.02) { return games[id].step(state, action, seconds); }
function tick(id, state, seconds = 0.02) { return step(id, state, { type: 'tick' }, seconds); }
function finite(value) { if (typeof value === 'number') assert.ok(Number.isFinite(value)); else if (value && typeof value === 'object') Object.values(value).forEach(finite); }

test('pack registers seventeen independent game IDs and can load without browser globals', () => {
  assert.deepEqual(Object.keys(games), ids);
  const source = fs.readFileSync(path.join(__dirname, '../all-game-pack-arcade.js'), 'utf8');
  const sandbox = {};
  vm.runInNewContext(source, sandbox);
  assert.equal(typeof sandbox.HHAllGamePackArcade.games['mini-golf'].create, 'function');
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|requestAnimationFrame|setInterval|setTimeout|localStorage|sessionStorage|AudioContext)\b/);
});

for (const id of ids) {
  test(id + ': JSON-safe state, deterministic seed and pure immutable updates', () => {
    const game = games[id];
    let first = game.create({ seed: 'hh-arcade', difficulty: 'hard' });
    let second = game.create({ seed: 'hh-arcade', difficulty: 'hard' });
    assert.equal(first.version, 1);
    assert.equal(first.id, id);
    assert.equal(first.status, 'playing');
    assert.ok(first.target > 0);
    const before = JSON.stringify(first);
    freeze(first);
    first = game.step(first, { type: 'action' }, 0);
    assert.equal(JSON.stringify(second), before);
    second = game.step(second, { type: 'action' }, 0);
    for (let index = 0; index < 180; index += 1) {
      const command = freeze({ type: 'tick', held: { action: index % 30 < 10, left: index % 80 < 40, right: index % 80 >= 40, up: index % 60 < 30, down: index % 60 >= 30 } });
      const previous = JSON.stringify(first);
      freeze(first);
      const old = first;
      first = game.step(first, command, 0.05);
      assert.equal(JSON.stringify(old), previous);
      second = game.step(second, command, 0.05);
      finite(first);
    }
    assert.deepEqual(first, second);
    assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
    assert.ok(game.describe(first).summary.length > 25);
  });

  test(id + ': clamps physics delta and preserves terminal results', () => {
    const state = games[id].create({ difficulty: 'unknown' });
    assert.equal(state.difficulty, 'normal');
    assert.deepEqual(games[id].step(state, 'tick', 1000), games[id].step(state, 'tick', 0.05));
    assert.deepEqual(games[id].step(state, 'tick', -4), games[id].step(state, 'tick', 0));
    for (const status of ['won', 'lost']) {
      const end = freeze({ ...state, status, score: 777 });
      assert.deepEqual(games[id].step(end, { type: 'tick', held: { action: true, right: true } }, 0.05), end);
    }
  });
}

test('paddle duel explicitly serves, physically rebounds, scores and supports either terminal outcome', () => {
  let s = games['paddle-duel'].create();
  assert.equal(tick('paddle-duel', s).serving, true);
  s = step('paddle-duel', s, 'action', 0);
  assert.equal(s.serving, false);
  assert.ok(s.ball.vx > 0);
  s.ball = { x: 50, y: s.player.y + 12, vx: -400, vy: 0, r: 8 };
  s = tick('paddle-duel', s, 0.03);
  assert.ok(s.ball.vx > 0);
  s.progress = 4;
  s.ball = { x: 730, y: 100, vx: 300, vy: 0, r: 8 };
  assert.equal(tick('paddle-duel', s).status, 'won');
  s.progress = 0;
  s.opponent = 4;
  s.ball = { x: -10, y: 100, vx: -300, vy: 0, r: 8 };
  assert.equal(tick('paddle-duel', s).status, 'lost');
});

test('sky glider has flap acceleration, passed-gate counting, physical walls and a finite win', () => {
  let s = games['sky-glider'].create();
  const flap = step('sky-glider', s, 'action');
  assert.ok(flap.player.vy < 0);
  assert.ok(flap.player.y < s.player.y);
  s.progress = 7;
  s.gates = [{ x: 70, gap: 240, counted: false }];
  assert.equal(tick('sky-glider', s, 0.01).status, 'won');
  s.progress = 0;
  s.player.y = 460;
  assert.equal(tick('sky-glider', s, 0.01).status, 'lost');
});

test('glider action is edge-triggered while held rather than reflapping each frame', () => {
  let s = games['sky-glider'].create();
  s = step('sky-glider', s, { type: 'tick', held: { action: true } }, 0.02);
  const firstVy = s.player.vy;
  s = step('sky-glider', s, { type: 'tick', held: { action: true } }, 0.02);
  assert.ok(s.player.vy > firstVy);
  s = step('sky-glider', s, { type: 'tick', held: { action: false } }, 0);
  s = step('sky-glider', s, { type: 'tick', held: { action: true } }, 0);
  assert.equal(s.player.vy, -245);
});

test('meteor dodge has actual damage, free movement and thirty-second completion', () => {
  let s = games['meteor-dodge'].create();
  assert.ok(step('meteor-dodge', s, 'left', 0).player.x < s.player.x);
  s.health = 1;
  s.meteors = [{ x: s.player.x, y: s.player.y, vx: 0, vy: 0, r: 18 }];
  assert.equal(tick('meteor-dodge', s).status, 'lost');
  s = games['meteor-dodge'].create();
  s.time = 29.99;
  assert.equal(tick('meteor-dodge', s).status, 'won');
});

test('coin catcher distinguishes good catches, stones and missed coins', () => {
  let s = games['coin-catcher'].create();
  s.items = [{ x: s.player.x, y: 417, vy: 200, r: 10, kind: 'coin' }];
  s = tick('coin-catcher', s);
  assert.equal(s.progress, 1);
  s.items = [{ x: s.player.x, y: 417, vy: 200, r: 10, kind: 'stone' }];
  s = tick('coin-catcher', s);
  assert.equal(s.health, 3);
  s.progress = 11;
  s.items = [{ x: s.player.x, y: 417, vy: 200, r: 10, kind: 'coin' }];
  assert.equal(tick('coin-catcher', s).status, 'won');
  s.progress = 0;
  s.health = 1;
  s.items = [{ x: 40, y: 494, vy: 200, r: 10, kind: 'coin' }];
  assert.equal(tick('coin-catcher', s).status, 'lost');
});

test('road rush brakes reduce distance speed, lanes change, actual car hits damage, finish wins', () => {
  const start = games['road-rush'].create();
  const full = tick('road-rush', start, 0.05);
  const braked = step('road-rush', start, { type: 'tick', held: { action: true } }, 0.05);
  assert.ok(full.progress > braked.progress);
  assert.equal(step('road-rush', start, 'left', 0).lane, 0);
  start.health = 1;
  start.cars = [{ x: start.player.x, y: start.player.y, w: 55, h: 82, extra: 0 }];
  assert.equal(tick('road-rush', start).status, 'lost');
  start.cars = [];
  start.health = 3;
  start.progress = start.target - 1;
  assert.equal(tick('road-rush', start).status, 'won');
});

test('river crossing moves by cells, carries on logs, drowns in gaps and counts the far bank', () => {
  let s = games['river-cross'].create();
  assert.equal(step('river-cross', s, 'up', 0).player.row, 7);
  s.player = { x: 250, row: 2 };
  s = tick('river-cross', s, 0.05);
  assert.ok(s.player.x > 250, 'moving log carries the player');
  s.player = { x: 150, row: 2 };
  s.health = 1;
  s.invulnerable = 0;
  assert.equal(tick('river-cross', s, 0).status, 'lost');
  s = games['river-cross'].create();
  s.player.row = 0;
  s.progress = 2;
  assert.equal(tick('river-cross', s, 0).status, 'won');
});

test('asteroid drift uses inertia and projectiles; large rocks fragment and actual contacts damage', () => {
  let s = games['asteroid-drift'].create();
  const thrust = step('asteroid-drift', s, { type: 'tick', held: { up: true } }, 0.05);
  assert.ok(thrust.player.vy < 0);
  assert.ok(tick('asteroid-drift', thrust).player.y < thrust.player.y);
  s.rocks = [{ x: 80, y: 100, vx: 0, vy: 0, r: 28, hp: 1, small: false }];
  s.bullets = [{ x: 80, y: 100, vx: 0, vy: 0, ttl: 1, r: 3 }];
  s = tick('asteroid-drift', s);
  assert.equal(s.progress, 1);
  assert.equal(s.rocks.filter((r) => r.small).length, 2);
  s.progress = 14;
  s.rocks = [{ x: 80, y: 100, vx: 0, vy: 0, r: 13, hp: 1, small: true }];
  s.bullets = [{ x: 80, y: 100, vx: 0, vy: 0, ttl: 1, r: 3 }];
  assert.equal(tick('asteroid-drift', s).status, 'won');
  s = games['asteroid-drift'].create();
  s.invulnerable = 0;
  s.health = 1;
  s.rocks = [{ x: s.player.x, y: s.player.y, vx: 0, vy: 0, r: 28, hp: 2, small: false }];
  assert.equal(tick('asteroid-drift', s).status, 'lost');
});

test('gravity flip changes acceleration, collides with solids and completes a finite corridor', () => {
  let s = games['gravity-flip'].create();
  const flipped = step('gravity-flip', s, 'action');
  assert.equal(flipped.gravity, -1);
  assert.ok(flipped.player.vy < 0);
  s.obstacles = [{ x: 140, y: 400, w: 40, h: 40 }];
  assert.equal(tick('gravity-flip', s).status, 'lost');
  s.obstacles = [];
  s.progress = s.target - 1;
  assert.equal(tick('gravity-flip', s).status, 'won');
});

test('ball balance tilt has momentum, a brake, sequential goals and real holes', () => {
  let s = games['ball-balance'].create();
  s.player.vx = 200;
  assert.ok(tick('ball-balance', s, 0.05).player.vx > step('ball-balance', s, { type: 'tick', held: { action: true } }, 0.05).player.vx);
  s.player.x = s.checkpoints[0].x;
  s.player.y = s.checkpoints[0].y;
  s.player.vx = 0;
  s = tick('ball-balance', s);
  assert.equal(s.progress, 1);
  s.progress = 3;
  s.player.x = s.checkpoints[3].x;
  s.player.y = s.checkpoints[3].y;
  assert.equal(tick('ball-balance', s).status, 'won');
  s.progress = 0;
  s.health = 1;
  s.player.x = s.holes[0].x;
  s.player.y = s.holes[0].y;
  assert.equal(tick('ball-balance', s).status, 'lost');
});

test('jump tower is ballistic, lands on one-way platforms and ends at the real top platform', () => {
  let s = games['jump-tower'].create();
  const jumping = step('jump-tower', s, 'action');
  assert.ok(jumping.player.vy < 0);
  assert.equal(jumping.player.grounded, false);
  const top = s.platforms[12];
  s.player = { x: top.x + 50, y: top.y - 16, vy: 200, grounded: false };
  s = tick('jump-tower', s);
  assert.equal(s.status, 'won');
  assert.equal(s.progress, 12);
  s = games['jump-tower'].create();
  s.health = 1;
  s.player.y = 600;
  s.player.grounded = false;
  assert.equal(tick('jump-tower', s).status, 'lost');
});

test('jump tower cannot jump after walking off the side of its supporting platform', () => {
  let s = games['jump-tower'].create();
  const item = s.platforms[1];
  s.player = { x: item.x + item.w + 10, y: item.y - 14, vy: 0, grounded: true };
  s = step('jump-tower', s, 'right', 0);
  assert.equal(s.player.grounded, false);
  s = step('jump-tower', s, 'action', 0);
  assert.equal(s.player.vy, 0);
});

test('laser dash has a timed dash/cooldown and only active beams hurt unprotected players', () => {
  let s = games['laser-dash'].create();
  const dash = step('laser-dash', s, 'action');
  assert.ok(dash.player.x > s.player.x);
  assert.ok(dash.dash > 0 && dash.cooldown > 0);
  s.player.x = 200;
  s.health = 1;
  assert.equal(tick('laser-dash', s).status, 'lost');
  s = games['laser-dash'].create();
  s.player.x = 674;
  assert.equal(tick('laser-dash', s).status, 'won');
  s = games['laser-dash'].create();
  s.player.x = 200;
  assert.equal(step('laser-dash', s, 'action').health, 3);
});

test('orbit collect changes radius/direction, collects real positions and collides with orbital debris', () => {
  let s = games['orbit-collect'].create();
  assert.ok(step('orbit-collect', s, 'up', 0).player.radius < s.player.radius);
  assert.equal(step('orbit-collect', s, 'action', 0).direction, -1);
  s.player.angle = s.stars[0].angle;
  s.player.radius = s.stars[0].radius;
  s = tick('orbit-collect', s, 0);
  assert.equal(s.progress, 1);
  s.progress = 7;
  s.stars = [{ angle: s.player.angle, radius: s.player.radius, taken: false }];
  assert.equal(tick('orbit-collect', s, 0).status, 'won');
  s = games['orbit-collect'].create();
  s.health = 1;
  s.player.angle = 115;
  s.player.radius = 115;
  assert.equal(tick('orbit-collect', s, 0).status, 'lost');
});

test('shield defense intercepts only the shield arc and protects the base for a finite target', () => {
  let s = games['shield-defense'].create();
  s.player.angle = 0;
  s.meteors = [{ x: 432, y: 240, vx: -100, vy: 0, r: 9 }];
  s = tick('shield-defense', s);
  assert.equal(s.progress, 1);
  assert.equal(s.meteors.length, 0);
  s.progress = 17;
  s.meteors = [{ x: 432, y: 240, vx: -100, vy: 0, r: 9 }];
  assert.equal(tick('shield-defense', s).status, 'won');
  s = games['shield-defense'].create();
  s.health = 1;
  s.meteors = [{ x: 360, y: 240, vx: 0, vy: 0, r: 9 }];
  assert.equal(tick('shield-defense', s).status, 'lost');
  const burst = step('shield-defense', games['shield-defense'].create(), 'action');
  assert.ok(burst.burst > 0 && burst.cooldown > 0);
});

test('target range does not shoot on mere pointer movement; hits, misses and expiry are real', () => {
  let s = games['target-range'].create();
  assert.equal(step('target-range', s, { type: 'pointer', x: 360, y: 240, phase: 'move' }, 0).progress, 0);
  s = step('target-range', s, { type: 'pointer', x: 360, y: 240, phase: 'down' }, 0);
  assert.equal(s.progress, 1);
  s.targets = [{ id: 1, x: 360, y: 240, r: 30, ttl: 2 }];
  s.progress = 14;
  assert.equal(step('target-range', s, 'action', 0).status, 'won');
  s.progress = 0;
  s.misses = 6;
  s.player = { x: 10, y: 10 };
  assert.equal(step('target-range', s, 'action', 0).status, 'lost');
  s.player = { x: 360, y: 240 };
  s.targets[0].ttl = 0.01;
  assert.equal(tick('target-range', s).status, 'lost');
});

test('penalty kick animates a real shot and resolves against the keeper position at arrival', () => {
  let s = games['penalty-kick'].create();
  s = step('penalty-kick', s, 'action');
  assert.equal(s.attempts, 1);
  assert.ok(s.flight && s.ball.y < 418);
  s.flight = { x: 155, y: 75, elapsed: 0.715 };
  s.progress = 2;
  assert.equal(tick('penalty-kick', s, 0.01).status, 'won');
  s = games['penalty-kick'].create();
  s.attempts = 5;
  s.flight = { x: 360, y: 155, elapsed: 0.715 };
  s = tick('penalty-kick', s, 0.01);
  assert.equal(s.progress, 0);
  assert.equal(s.status, 'lost');
});

test('mini golf applies stroke inertia, reflects walls, captures low-speed cups and enforces strokes', () => {
  let s = games['mini-golf'].create();
  const hit = step('mini-golf', s, 'action');
  assert.equal(hit.strokes, 1);
  assert.ok(Math.hypot(hit.player.vx, hit.player.vy) > 0);
  s.player = { x: 33, y: 120, vx: -200, vy: 0, r: 8 };
  s = tick('mini-golf', s);
  assert.ok(s.player.vx > 0);
  s.player = { x: s.hole.x, y: s.hole.y, vx: 0, vy: 0, r: 8 };
  s = tick('mini-golf', s);
  assert.equal(s.progress, 1);
  assert.equal(s.level, 2);
  assert.equal(s.blocks.length, 2);
  s.progress = 2;
  s.level = 3;
  s.player = { x: s.hole.x, y: s.hole.y, vx: 0, vy: 0, r: 8 };
  assert.equal(tick('mini-golf', s).status, 'won');
  s = games['mini-golf'].create();
  s.strokes = 8;
  assert.equal(tick('mini-golf', s, 0).status, 'lost');
});

test('basket shot counts only a downward rim crossing; upward passes are not baskets', () => {
  let s = games['basket-shot'].create();
  const shot = step('basket-shot', s, 'action');
  assert.equal(shot.attempts, 1);
  assert.equal(shot.flying, true);
  assert.ok(shot.player.vy < 0);
  s.player = { x: s.hoop.x, y: s.hoop.y + 1, vx: 0, vy: -150, r: 10 };
  s.flying = true;
  s = tick('basket-shot', s);
  assert.equal(s.progress, 0);
  s.progress = 2;
  s.player = { x: s.hoop.x, y: s.hoop.y - 1, vx: 0, vy: 150, r: 10 };
  assert.equal(tick('basket-shot', s).status, 'won');
  s = games['basket-shot'].create();
  s.attempts = 8;
  s.flying = true;
  s.player.y = 470;
  assert.equal(tick('basket-shot', s).status, 'lost');
});

test('basket shot can complete all three changing hoop positions using full simulated flights', () => {
  const game = games['basket-shot'];
  let s = game.create();
  for (const power of [0.8, 0.825, 0.775]) {
    // These are ordinary aim/power settings, not altered ball positions or velocity.
    s.angle = -0.945;
    s.power = power;
    while (s.cooldown > 0) s = game.step(s, 'tick', 0.025);
    s = game.step(s, 'action', 0);
    for (let i = 0; i < 260 && s.flying; i += 1) s = game.step(s, 'tick', 0.025);
  }
  assert.equal(s.status, 'won');
  assert.equal(s.progress, 3);
  assert.equal(s.attempts, 3);
});

test('target range can complete an entire round through real pointer hits and natural spawns', () => {
  const game = games['target-range'];
  let s = game.create({ seed: 42 });
  for (let i = 0; i < 1500 && s.status === 'playing'; i += 1) {
    if (s.targets.length) s = game.step(s, { type: 'pointer', x: s.targets[0].x, y: s.targets[0].y, phase: 'down' }, 0);
    if (s.status === 'playing') s = game.step(s, 'tick', 0.025);
  }
  assert.equal(s.status, 'won');
  assert.equal(s.progress, 15);
  assert.equal(s.misses, 0);
  assert.ok(s.time > 15 && s.time < 30);
});

test('penalty kick can win a full five-attempt round through ordinary aiming and shot actions', () => {
  const game = games['penalty-kick'];
  let s = game.create({ seed: 42 });
  for (let i = 0; i < 400 && s.status === 'playing'; i += 1) {
    if (!s.flight && s.cooldown <= 0) {
      s = game.step(s, { type: 'pointer', x: 155, y: 75 }, 0);
      s = game.step(s, 'action', 0);
    }
    if (s.status === 'playing') s = game.step(s, 'tick', 0.025);
  }
  assert.equal(s.status, 'won');
  assert.equal(s.progress, 3);
  assert.equal(s.attempts, 3);
});

test('shield defense can finish a full natural meteor sequence using shield aiming only', () => {
  const game = games['shield-defense'];
  let s = game.create({ seed: 42, difficulty: 'easy' });
  for (let i = 0; i < 2000 && s.status === 'playing'; i += 1) {
    if (s.meteors.length) {
      const m = s.meteors.slice().sort((a, b) => Math.hypot(a.x - 360, a.y - 240) - Math.hypot(b.x - 360, b.y - 240))[0];
      s = game.step(s, { type: 'pointer', x: m.x, y: m.y }, 0);
    }
    if (s.status === 'playing') s = game.step(s, 'tick', 0.025);
  }
  assert.equal(s.status, 'won');
  assert.equal(s.progress, 18);
  assert.equal(s.health, 3);
});

test('sky glider can finish all eight seeded gates through flap actions and unmodified physics', () => {
  const game = games['sky-glider'];
  let s = game.create({ seed: 42, difficulty: 'easy' });
  for (let i = 0; i < 2000 && s.status === 'playing'; i += 1) {
    const gate = s.gates.find((item) => item.x + 44 >= s.player.x - s.player.r);
    const targetY = gate ? gate.gap : 240;
    if (s.player.y > targetY + 5 && s.player.vy > -130) s = game.step(s, 'action', 0);
    s = game.step(s, 'tick', 0.025);
  }
  assert.equal(s.status, 'won');
  assert.equal(s.progress, 8);
  assert.ok(s.time > 15);
});

test('every renderer works at mobile scale without mutating state or leaking save/restore depth', () => {
  let depth = 0, calls = 0;
  const ctx = new Proxy({ save() { depth += 1; }, restore() { depth -= 1; }, createRadialGradient() { return { addColorStop() {} }; }, createLinearGradient() { return { addColorStop() {} }; } }, { get(object, key) { return key in object ? object[key] : () => { calls += 1; }; } });
  for (const id of ids) {
    const state = freeze(games[id].create({ seed: 99 }));
    const before = JSON.stringify(state);
    games[id].draw(ctx, state, { width: 375, height: 250, reducedMotion: true });
    games[id].draw(ctx, state, { width: 720, height: 480, reducedMotion: false });
    assert.equal(depth, 0, id);
    assert.equal(JSON.stringify(state), before);
  }
  assert.ok(calls > 1000);
});

test('each of the seventeen actual game worlds uses its optional scene painter before foreground art', () => {
  for (const id of ids) {
    let depth = 0, callbackCalls = 0, painted = false, fullCoverAfterScene = 0;
    const ctx = new Proxy({
      save() { depth += 1; }, restore() { depth -= 1; },
      fillRect(x, y, width, height) { if (painted && x === 0 && y === 0 && width === 720 && height === 480) fullCoverAfterScene += 1; },
      createRadialGradient() { return { addColorStop() {} }; }, createLinearGradient() { return { addColorStop() {} }; }
    }, { get(object, key) { return key in object ? object[key] : () => {}; } });
    const state = freeze(games[id].create({ seed: 7 }));
    const before = JSON.stringify(state);
    games[id].draw(ctx, state, { width: 375, height: 250, reducedMotion: true, paintScene(context, gameId, current) {
      assert.equal(context, ctx); assert.equal(gameId, id); assert.equal(current, state); assert.equal(depth, 2); callbackCalls += 1; painted = true;
    } });
    assert.equal(callbackCalls, 1); assert.equal(fullCoverAfterScene, 0); assert.equal(depth, 0); assert.equal(JSON.stringify(state), before);
  }
});
