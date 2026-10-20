'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const arcade = require('../all-game-arcade.js');
const { snake, breakout, 'star-guard': shooter } = arcade.games;

function freeze(value) {
  Object.freeze(value);
  Object.values(value).forEach((item) => { if (item && typeof item === 'object' && !Object.isFrozen(item)) freeze(item); });
  return value;
}

function advance(engine, state, ticks, held = {}) {
  for (let index = 0; index < ticks; index += 1) state = engine.step(state, { type: 'tick', held }, 0.05);
  return state;
}

function rectBrick(id, x = 300, hp = 1) { return { id, x, y: 100, w: 60, h: 20, hp, color: '#fff' }; }
function oneEnemy(kind = 'scout', hp = 1) { return { id: kind, kind, x: 360, y: 100, baseX: 360, baseY: 100, r: kind === 'boss' ? 42 : 18, hp, maxHp: hp, phase: 0, cooldown: 99 }; }

test('three original engines expose the host contract without needing a DOM', () => {
  assert.deepEqual(Object.keys(arcade.games), ['snake', 'breakout', 'star-guard']);
  assert.equal(arcade.WIDTH, 720);
  assert.equal(arcade.HEIGHT, 480);
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../all-game-arcade.js'), 'utf8'), sandbox);
  assert.equal(typeof sandbox.HHAllGameArcade.games.snake.step, 'function');
  for (const game of Object.values(arcade.games)) {
    for (const method of ['create', 'step', 'draw', 'describe']) assert.equal(typeof game[method], 'function');
    const state = game.create({ seed: 123 });
    assert.equal(state.id, game.id);
    assert.equal(state.status, 'playing');
    assert.equal(state.version, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
    assert.match(game.describe(state).summary, /[àáạảãâăđêếệờơưứựộố]/i);
  }
});

for (const game of Object.values(arcade.games)) {
  test(game.id + ' is deterministic for a seed, difficulty and input sequence', () => {
    let first = game.create({ seed: 'same-class', difficulty: 'hard' });
    let second = game.create({ seed: 'same-class', difficulty: 'hard' });
    for (let index = 0; index < 180; index += 1) {
      const action = { type: 'tick', held: { left: index % 80 > 40, right: index % 80 <= 40, action: true } };
      first = game.step(first, action, 0.05);
      second = game.step(second, action, 0.05);
    }
    assert.deepEqual(first, second);
  });

  test(game.id + ' step does not mutate frozen input or actions', () => {
    const state = freeze(game.create({ seed: 32 }));
    const before = JSON.stringify(state);
    const action = freeze({ type: 'tick', held: { right: true, action: true } });
    const next = game.step(state, action, 0.05);
    assert.notEqual(next, state);
    assert.equal(JSON.stringify(state), before);
    assert.deepEqual(action, { type: 'tick', held: { right: true, action: true } });
  });

  test(game.id + ' bounds delta time and normalizes unknown difficulty', () => {
    const state = game.create({ difficulty: 'unbounded' });
    assert.equal(state.difficulty, 'normal');
    assert.deepEqual(game.step(state, 'tick', 1000), game.step(state, 'tick', 0.05));
    assert.deepEqual(game.step(state, 'tick', -1), game.step(state, 'tick', 0));
    assert.deepEqual(game.step(state, 'tick', Infinity), game.step(state, 'tick', 0.05));
  });

  test(game.id + ' terminal states cannot earn more score or restart themselves', () => {
    for (const status of ['won', 'lost']) {
      const state = freeze({ ...game.create(), status, score: 1234 });
      assert.deepEqual(game.step(state, { type: 'tick', held: { action: true, right: true } }, 0.05), state);
    }
  });
}

test('snake advances on its cell interval rather than on render count', () => {
  let state = snake.create({ difficulty: 'easy' });
  state = advance(snake, state, 3);
  assert.equal(state.moves, 0);
  state = advance(snake, state, 1);
  assert.equal(state.moves, 1);
  assert.deepEqual(state.body[0], { x: 10, y: 9 });
});

test('snake rejects reverse input, including two queued turns before a cell move', () => {
  let state = snake.create();
  state = snake.step(state, 'left');
  assert.equal(state.queuedDirection, 'right');
  state = snake.step(state, 'up');
  state = snake.step(state, 'left');
  assert.equal(state.queuedDirection, 'up');
  state.elapsed = state.interval;
  state = snake.step(state, 'tick');
  assert.deepEqual(state.body[0], { x: 9, y: 8 });
});

test('snake grows, scores, accelerates and spawns fruit outside its body', () => {
  const previous = snake.create({ seed: 120 });
  previous.food = { x: 10, y: 9 };
  previous.elapsed = previous.interval - 0.02;
  const state = snake.step(previous, 'tick', 0.05);
  assert.equal(state.fruits, 1);
  assert.equal(state.score, 100);
  assert.equal(state.body.length, 4);
  assert.ok(state.interval < previous.interval);
  assert.equal(state.body.some((part) => part.x === state.food.x && part.y === state.food.y), false);
  assert.equal(previous.fruits, 0);
});

test('snake food always occupies a valid unused cell across seeds', () => {
  const cells = new Set();
  for (let index = 0; index < 100; index += 1) {
    const state = snake.create({ seed: index });
    assert.ok(state.food.x >= 0 && state.food.x < state.cols && state.food.y >= 0 && state.food.y < state.rows);
    assert.equal(state.body.some((part) => part.x === state.food.x && part.y === state.food.y), false);
    cells.add(state.food.x + ',' + state.food.y);
  }
  assert.ok(cells.size > 70);
});

test('snake may enter the tail cell which leaves on that same move', () => {
  const state = snake.create();
  state.body = [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 }];
  state.direction = 'up';
  state.queuedDirection = 'right';
  state.food = { x: 10, y: 10 };
  state.elapsed = state.interval;
  const next = snake.step(state, 'tick');
  assert.equal(next.status, 'playing');
  assert.deepEqual(next.body[0], { x: 2, y: 1 });
  assert.equal(next.body.length, 4);
});

test('snake loses on real wall and body collisions', () => {
  let wall = snake.create();
  wall.body = [{ x: 27, y: 9 }, { x: 26, y: 9 }, { x: 25, y: 9 }];
  wall.elapsed = wall.interval;
  wall = snake.step(wall, 'tick');
  assert.equal(wall.status, 'lost');
  let self = snake.create();
  self.body = [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 1 }];
  self.direction = 'up';
  self.queuedDirection = 'left';
  self.elapsed = self.interval;
  self = snake.step(self, 'tick');
  assert.equal(self.status, 'lost');
});

test('snake wins from reaching its visible finite fruit objective', () => {
  const state = snake.create({ difficulty: 'easy' });
  state.fruits = state.target - 1;
  state.food = { x: 10, y: 9 };
  state.elapsed = state.interval;
  const next = snake.step(state, 'tick');
  assert.equal(next.status, 'won');
  assert.equal(next.fruits, next.target);
  assert.match(snake.describe(next).summary, /hoàn thành/);
});

test('breakout waits for an explicit launch and supports pointer/keyboard paddle input', () => {
  const state = breakout.create({ seed: 1 });
  const idle = advance(breakout, state, 20);
  assert.equal(idle.launched, false);
  assert.equal(idle.ball.y, state.ball.y);
  let moved = breakout.step(state, { type: 'pointer', x: 80 });
  assert.equal(moved.paddle.x + moved.paddle.w / 2, 80);
  assert.equal(moved.ball.x, 80);
  moved = breakout.step(moved, 'right');
  assert.equal(moved.ball.x, 114);
  const launched = breakout.step(moved, 'action');
  assert.equal(launched.launched, true);
  assert.ok(launched.ball.vy < 0);
  assert.equal(state.launched, false);
});

test('breakout walls and paddle produce real rebounds', () => {
  let wall = breakout.create();
  wall.launched = true;
  wall.ball = { x: 20, y: 300, vx: -350, vy: 0, r: 7 };
  wall = breakout.step(wall, 'tick', 0.05);
  assert.ok(wall.ball.vx > 0);
  assert.ok(wall.ball.x >= 19);
  const state = breakout.create();
  state.launched = true;
  state.ball = { x: state.paddle.x + state.paddle.w * 0.8, y: 430, vx: 0, vy: 350, r: 7 };
  const bounced = breakout.step(state, 'tick', 0.05);
  assert.ok(bounced.ball.vy < 0);
  assert.ok(bounced.ball.vx > 0, 'right-side paddle hit angles the ball right');
  assert.equal(bounced.lives, 3);
});

test('breakout substeps hit a fast ball, decrement durable bricks, and remove destroyed ones', () => {
  let state = breakout.create();
  state.launched = true;
  state.ball = { x: 330, y: 139, vx: 0, vy: -420, r: 7 };
  state.bricks = [rectBrick(1, 300, 2), rectBrick(2, 80)];
  state = breakout.step(state, 'tick', 0.05);
  assert.equal(state.bricks[0].hp, 1);
  assert.equal(state.score, 10);
  assert.ok(state.ball.vy > 0);
  state.ball = { x: 330, y: 139, vx: 0, vy: -420, r: 7 };
  state = breakout.step(state, 'tick', 0.05);
  assert.deepEqual(state.bricks.map((brick) => brick.id), [2]);
  assert.equal(state.score, 45);
  assert.equal(state.broken, 1);
});

test('breakout progresses through all three distinct levels and ends in a win', () => {
  let state = breakout.create();
  assert.equal(state.bricks.length, 30);
  for (let level = 1; level <= 3; level += 1) {
    state.bricks = [rectBrick(1)];
    state.launched = true;
    state.ball = { x: 330, y: 139, vx: 0, vy: -325, r: 7 };
    state = breakout.step(state, 'tick', 0.05);
    if (level < 3) {
      assert.equal(state.level, level + 1);
      assert.equal(state.status, 'playing');
      assert.equal(state.bricks.length, (level + 3) * 10);
      assert.equal(state.launched, false, 'each new level waits for a new launch');
    }
  }
  assert.equal(state.level, 3);
  assert.equal(state.status, 'won');
  assert.equal(state.broken, 3);
});

test('breakout misses consume one life and the last miss is a loss', () => {
  let state = breakout.create();
  for (let lives = 2; lives >= 0; lives -= 1) {
    state.launched = true;
    state.ball = { x: 40, y: 489, vx: 0, vy: 300, r: 7 };
    state = breakout.step(state, 'tick', 0.05);
    assert.equal(state.lives, lives);
    assert.equal(state.status, lives ? 'playing' : 'lost');
    if (lives) assert.equal(state.launched, false);
  }
});

test('shooter never auto-fires and holding action uses a real bounded firing cooldown', () => {
  const state = shooter.create();
  const idle = advance(shooter, state, 5);
  assert.equal(idle.shots, 0);
  let fired = shooter.step(state, 'action');
  assert.equal(fired.shots, 1);
  assert.equal(fired.bullets.length, 1);
  fired = shooter.step(fired, 'action');
  assert.equal(fired.shots, 1);
  fired = advance(shooter, fired, 20, { action: true });
  assert.ok(fired.shots >= 5 && fired.shots <= 7);
  assert.equal(state.shots, 0);
});

test('shooter movement is bounded and diagonal movement is not faster', () => {
  const state = shooter.create();
  const next = shooter.step(state, { type: 'tick', held: { right: true, up: true } }, 0.05);
  assert.ok(Math.abs(Math.hypot(next.player.x - state.player.x, next.player.y - state.player.y) - 15.75) < 1e-7);
  const edge = shooter.step(state, { type: 'pointer', x: -500 });
  assert.equal(edge.player.x, 28);
  const top = advance(shooter, edge, 100, { up: true, left: true });
  assert.equal(top.player.x, 28);
  assert.equal(top.player.y, 270);
});

test('shooter projectiles hit enemies, score only actual hits and advance the finite wave', () => {
  let state = shooter.create();
  state.enemies = [oneEnemy()];
  state.bullets = [{ x: 360, y: 130, vx: 0, vy: -560, r: 4 }];
  state = shooter.step(state, 'tick', 0.05);
  assert.equal(state.enemies.length, 0);
  assert.equal(state.bullets.length, 0);
  assert.equal(state.score, 100);
  assert.equal(state.defeated, 1);
  state = advance(shooter, state, 17);
  assert.equal(state.wave, 2);
  assert.equal(state.level, 2);
  assert.equal(state.enemies.length, 8);
});

test('shooter enemy volleys are real aimed projectiles; boss fires a five-shot fan', () => {
  let state = shooter.create();
  state.enemies = [oneEnemy()];
  state.enemies[0].cooldown = 0;
  state = shooter.step(state, 'tick', 0.01);
  assert.equal(state.enemyBullets.length, 1);
  assert.ok(state.enemyBullets[0].vy > 0);
  state.enemies = [oneEnemy('boss', 40)];
  state.enemies[0].cooldown = 0;
  state.enemyBullets = [];
  state = shooter.step(state, 'tick', 0.01);
  assert.equal(state.enemyBullets.length, 5);
  assert.ok(new Set(state.enemyBullets.map((bullet) => bullet.vx)).size === 5);
});

test('shooter collision damage respects invulnerability and zero health ends the game', () => {
  let state = shooter.create();
  state.enemyBullets = Array.from({ length: 2 }, () => ({ x: state.player.x, y: state.player.y, vx: 0, vy: 0, r: 4 }));
  state = shooter.step(state, 'tick', 0.01);
  assert.equal(state.health, 2);
  assert.equal(state.enemyBullets.length, 0);
  state.enemyBullets = [{ x: state.player.x, y: state.player.y, vx: 0, vy: 0, r: 4 }];
  state = shooter.step(state, 'tick', 0.01);
  assert.equal(state.health, 2);
  state.health = 1;
  state.invulnerable = 0;
  state.enemyBullets = [{ x: state.player.x, y: state.player.y, vx: 0, vy: 0, r: 4 }];
  state = shooter.step(state, 'tick', 0.01);
  assert.equal(state.health, 0);
  assert.equal(state.status, 'lost');
});

test('shooter spawns a final boss and defeating it produces a true win', () => {
  let state = shooter.create();
  state.wave = 3;
  state.level = 3;
  state.enemies = [];
  state.transition = 0.84;
  state = shooter.step(state, 'tick', 0.02);
  assert.equal(state.wave, 4);
  assert.equal(state.enemies.length, 1);
  assert.equal(state.enemies[0].kind, 'boss');
  assert.equal(state.enemies[0].maxHp, 40);
  state.enemies = [oneEnemy('boss')];
  state.bullets = [{ x: 360, y: 130, vx: 0, vy: -560, r: 4 }];
  state = shooter.step(state, 'tick', 0.01);
  assert.equal(state.status, 'won');
  assert.equal(state.enemies.length, 0);
  assert.equal(state.score, 1010);
  assert.match(shooter.describe(state).summary, /hạ tàu chỉ huy/);
});

test('all draw functions balance canvas saves, tolerate reduced motion, and never mutate state', () => {
  let depth = 0;
  let drawCalls = 0;
  const target = {
    save() { depth += 1; }, restore() { depth -= 1; },
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; }
  };
  const context = new Proxy(target, { get(object, key) { if (key in object) return object[key]; return () => { drawCalls += 1; }; } });
  for (const game of Object.values(arcade.games)) {
    const state = freeze(game.create({ seed: 56 }));
    const before = JSON.stringify(state);
    game.draw(context, state, { width: 375, height: 250, reducedMotion: true });
    game.draw(context, state, { width: 720, height: 480, reducedMotion: false });
    assert.equal(depth, 0, game.id + ' balances save/restore');
    assert.equal(JSON.stringify(state), before);
  }
  assert.ok(drawCalls > 200);
});

test('original arcade renderers paint the optional scene first without a second opaque backdrop', () => {
  for (const game of Object.values(arcade.games)) {
    let depth = 0, callbackCalls = 0, painted = false, fullCoverAfterScene = 0;
    const ctx = new Proxy({
      save() { depth += 1; }, restore() { depth -= 1; },
      fillRect(x, y, width, height) { if (painted && x === 0 && y === 0 && width === 720 && height === 480) fullCoverAfterScene += 1; },
      createRadialGradient() { return { addColorStop() {} }; }, createLinearGradient() { return { addColorStop() {} }; }
    }, { get(object, key) { return key in object ? object[key] : () => {}; } });
    const state = freeze(game.create({ seed: 7 }));
    const before = JSON.stringify(state);
    game.draw(ctx, state, { width: 375, height: 250, reducedMotion: true, paintScene(context, id, current) {
      assert.equal(context, ctx); assert.equal(id, game.id); assert.equal(current, state);
      assert.equal(depth, 2); callbackCalls += 1; painted = true;
    } });
    assert.equal(callbackCalls, 1); assert.equal(fullCoverAfterScene, 0); assert.equal(depth, 0); assert.equal(JSON.stringify(state), before);
  }
});
