/* Original HH Canvas2D arcade engines. No DOM, storage, network or render loop. */
(function (scope) {
  'use strict';
  const WIDTH = 720;
  const HEIGHT = 480;
  const DIRECTIONS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const delta = (seconds) => clamp(seconds, 0, 0.05);
  const input = (action) => typeof action === 'string' ? { type: action } : action || { type: 'tick' };
  const difficulty = (value) => ['easy', 'normal', 'hard'].includes(value) ? value : 'normal';

  function seedValue(seed) {
    const text = String(seed == null ? 1 : seed);
    let value = 2166136261;
    for (let index = 0; index < text.length; index += 1) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
    return (value >>> 0) || 1;
  }

  function random(state) {
    state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
    return state.rng / 4294967296;
  }

  function base(id, options) {
    const seed = seedValue(options.seed);
    return { version: 1, id, status: 'playing', score: 0, level: 1, difficulty: difficulty(options.difficulty), seed, rng: seed, time: 0 };
  }

  function rounded(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function background(ctx, options, accent, state) {
    const width = Number(options && options.width) || WIDTH;
    const height = Number(options && options.height) || HEIGHT;
    ctx.save();
    ctx.scale(width / WIDTH, height / HEIGHT);
    if (typeof options.paintScene === 'function') {
      ctx.save();
      try { options.paintScene(ctx, state.id, state); } finally { ctx.restore(); }
      return;
    }
    ctx.fillStyle = '#07101f';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const glow = ctx.createRadialGradient(360, 160, 20, 360, 200, 460);
    glow.addColorStop(0, accent);
    glow.addColorStop(1, '#07101f');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function grid(ctx, spacing, opacity) {
    ctx.strokeStyle = 'rgba(160,205,255,' + opacity + ')';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 24; x <= 696; x += spacing) { ctx.moveTo(x, 24); ctx.lineTo(x, 456); }
    for (let y = 24; y <= 456; y += spacing) { ctx.moveTo(24, y); ctx.lineTo(696, y); }
    ctx.stroke();
  }

  // Snake: 28 x 18 cells, a finite fruit objective, and a uniformly selected free cell.
  function snakeFood(state) {
    const used = new Set(state.body.map((part) => part.x + ',' + part.y));
    const free = [];
    for (let y = 0; y < state.rows; y += 1) for (let x = 0; x < state.cols; x += 1) if (!used.has(x + ',' + y)) free.push({ x, y });
    return free.length ? free[Math.floor(random(state) * free.length)] : null;
  }

  function snakeCreate(options = {}) {
    const state = Object.assign(base('snake', options), {
      cols: 28, rows: 18, body: [{ x: 9, y: 9 }, { x: 8, y: 9 }, { x: 7, y: 9 }],
      direction: 'right', queuedDirection: 'right', elapsed: 0, fruits: 0, moves: 0, food: null
    });
    state.target = { easy: 10, normal: 14, hard: 18 }[state.difficulty];
    state.interval = { easy: 0.18, normal: 0.145, hard: 0.115 }[state.difficulty];
    state.food = snakeFood(state);
    return state;
  }

  function snakeStep(previous, action, seconds = 0) {
    const state = clone(previous);
    if (state.status !== 'playing') return state;
    const command = input(action);
    let nextDirection = DIRECTIONS[command.type] ? command.type : null;
    if (command.type === 'tick' && command.held) nextDirection = ['up', 'down', 'left', 'right'].find((name) => command.held[name] && name !== OPPOSITE[state.direction]) || null;
    if (nextDirection && nextDirection !== OPPOSITE[state.direction]) state.queuedDirection = nextDirection;
    const dt = delta(seconds);
    state.time += dt;
    state.elapsed += dt;
    while (state.status === 'playing' && state.elapsed + 1e-9 >= state.interval) {
      state.elapsed = Math.max(0, state.elapsed - state.interval);
      state.direction = state.queuedDirection;
      const vector = DIRECTIONS[state.direction];
      let head = { x: state.body[0].x + vector.x, y: state.body[0].y + vector.y };
      const portal = (state.portals || []).find(item => item.from.x === head.x && item.from.y === head.y); if (portal) head = { x: portal.to.x, y: portal.to.y };
      const eats = !!state.food && head.x === state.food.x && head.y === state.food.y;
      const collisionBody = eats ? state.body : state.body.slice(0, -1);
      if (head.x < 0 || head.y < 0 || head.x >= state.cols || head.y >= state.rows || (state.obstacles || []).some(part => part.x === head.x && part.y === head.y) || collisionBody.some((part) => part.x === head.x && part.y === head.y)) {
        state.status = 'lost';
        break;
      }
      state.body.unshift(head);
      state.moves += 1;
      if (eats) {
        state.fruits += 1;
        state.score += { easy: 80, normal: 100, hard: 125 }[state.difficulty];
        state.level = Math.floor(state.fruits / 4) + 1;
        state.interval = Math.max(0.065, state.interval * 0.975);
        state.food = snakeFood(state);
        if (!state.food || state.fruits >= state.target) state.status = 'won';
      } else state.body.pop();
    }
    return state;
  }

  function snakeDraw(ctx, state, options = {}) {
    background(ctx, options, '#13293c', state);
    grid(ctx, 24, 0.12);
    ctx.strokeStyle = '#b1ffe8';
    ctx.lineWidth = 2;
    rounded(ctx, 23, 23, 674, 434, 8);
    ctx.stroke();
    if (state.food) {
      const x = 36 + state.food.x * 24;
      const y = 36 + state.food.y * 24;
      const apple = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, 10);
      apple.addColorStop(0, '#fff2be'); apple.addColorStop(0.3, '#ff806f'); apple.addColorStop(1, '#c94175');
      ctx.fillStyle = apple;
      ctx.shadowColor = '#f55291';
      ctx.shadowBlur = options.reducedMotion ? 0 : 16;
      ctx.beginPath();
      ctx.ellipse(x, y, 9, 9, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffe4a3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 8); ctx.quadraticCurveTo(x + 4, y - 14, x + 8, y - 12); ctx.stroke();
      ctx.fillStyle = '#79f3a1'; ctx.beginPath(); ctx.ellipse(x + 6, y - 10, 4.5, 2.2, -0.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineWidth = 19; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#24599b';
    ctx.beginPath(); state.body.forEach((part, index) => { const x = 36 + part.x * 24, y = 36 + part.y * 24; if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke();
    state.body.slice().reverse().forEach((part, reverseIndex) => {
      const index = state.body.length - reverseIndex - 1;
      const x = 36 + part.x * 24, y = 36 + part.y * 24;
      const skin = ctx.createRadialGradient(x - 3, y - 5, 1, x, y, 13);
      skin.addColorStop(0, index === 0 ? '#c0ffd6' : '#8bffd0'); skin.addColorStop(0.55, index === 0 ? '#51e6a2' : '#25d9b2'); skin.addColorStop(1, '#127169');
      ctx.fillStyle = skin;
      rounded(ctx, 26 + part.x * 24, 26 + part.y * 24, 20, 20, 8);
      ctx.fill();
      if (index > 0) { ctx.strokeStyle = 'rgba(29,85,68,.36)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x - 2, y, 4, 0.1, 2.7); ctx.stroke(); }
    });
    const head = state.body[0];
    if (head) {
      const vector = DIRECTIONS[state.direction];
      const centerX = 36 + head.x * 24;
      const centerY = 36 + head.y * 24;
      ctx.fillStyle = '#071d26';
      [-1, 1].forEach((side) => {
        ctx.beginPath();
        ctx.arc(centerX + vector.x * 5 + vector.y * side * 4, centerY + vector.y * 5 + vector.x * side * 4, 2.1, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
  }

  function snakeDescribe(state) {
    return { summary: 'Rắn: ' + state.fruits + '/' + state.target + ' quả; đầu ở cột ' + (state.body[0].x + 1) + ', hàng ' + (state.body[0].y + 1) + '. ' + (state.status === 'won' ? 'Đã hoàn thành mục tiêu.' : state.status === 'lost' ? 'Đã va vào tường hoặc thân rắn.' : 'Điều khiển bằng bốn phím mũi tên. Không quay ngược ngay lập tức.') };
  }

  // Breakout: bounded substeps keep a fast ball from tunneling through the bricks.
  function breakoutBricks(level) {
    const result = [];
    const colors = ['#ff66b3', '#9361ff', '#25d9f8', '#64e4ae', '#ffd166'];
    for (let row = 0; row < level + 2; row += 1) {
      for (let col = 0; col < 10; col += 1) {
        result.push({ id: row * 10 + col, x: 36 + col * 65.4, y: 48 + row * 27, w: 59.4, h: 20, hp: level >= 2 && row === 0 ? 2 : 1, color: colors[row] });
      }
    }
    return result;
  }

  function breakoutSpeed(state) { return { easy: 285, normal: 325, hard: 365 }[state.difficulty] + (state.level - 1) * 28; }

  function breakoutAttach(state) {
    state.launched = false;
    state.ball = { x: state.paddle.x + state.paddle.w / 2, y: state.paddle.y - 9, vx: 0, vy: 0, r: 7 };
  }

  function breakoutCreate(options = {}) {
    const state = Object.assign(base('breakout', options), {
      paddle: { x: 306, y: 442, w: 108, h: 14 }, ball: null, launched: false,
      lives: 3, bricks: breakoutBricks(1), broken: 0, hits: 0
    });
    state.paddle.w = { easy: 126, normal: 108, hard: 90 }[state.difficulty];
    state.paddle.x = (WIDTH - state.paddle.w) / 2;
    breakoutAttach(state);
    return state;
  }

  function circleRect(ball, rect) {
    const x = clamp(ball.x, rect.x, rect.x + rect.w);
    const y = clamp(ball.y, rect.y, rect.y + rect.h);
    return (ball.x - x) ** 2 + (ball.y - y) ** 2 <= ball.r ** 2;
  }

  function breakoutLaunch(state) {
    if (state.launched) return;
    const speed = breakoutSpeed(state);
    const direction = random(state) > 0.5 ? 1 : -1;
    state.launched = true;
    state.ball.vx = direction * speed * 0.33;
    state.ball.vy = -Math.sqrt(speed ** 2 - state.ball.vx ** 2);
  }

  function breakoutStep(previous, action, seconds = 0) {
    const state = clone(previous);
    if (state.status !== 'playing') return state;
    const command = input(action);
    const dt = delta(seconds);
    const held = command.held || {};
    const paddle = state.paddle;
    if (command.type === 'pointer' && Number.isFinite(command.x)) paddle.x = clamp(command.x - paddle.w / 2, 12, WIDTH - paddle.w - 12);
    if (command.type === 'left' || command.type === 'right') paddle.x = clamp(paddle.x + (command.type === 'left' ? -34 : 34), 12, WIDTH - paddle.w - 12);
    if (held.left || held.right) paddle.x = clamp(paddle.x + ((held.right ? 1 : 0) - (held.left ? 1 : 0)) * 550 * dt, 12, WIDTH - paddle.w - 12);
    if (!state.launched) {
      state.ball.x = paddle.x + paddle.w / 2;
      state.ball.y = paddle.y - state.ball.r - 2;
    }
    if (command.type === 'action' || held.action) breakoutLaunch(state);
    state.time += dt;
    if (!state.launched || !dt) return state;
    const count = Math.ceil(dt / (1 / 160));
    const step = dt / count;
    for (let index = 0; index < count && state.status === 'playing' && state.launched; index += 1) {
      const ball = state.ball;
      const previousX = ball.x;
      const previousY = ball.y;
      ball.x += ball.vx * step;
      ball.y += ball.vy * step;
      if (ball.x < 12 + ball.r) { ball.x = 12 + ball.r; ball.vx = Math.abs(ball.vx); }
      if (ball.x > WIDTH - 12 - ball.r) { ball.x = WIDTH - 12 - ball.r; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < 16 + ball.r) { ball.y = 16 + ball.r; ball.vy = Math.abs(ball.vy); }
      if (ball.vy > 0 && previousY + ball.r <= paddle.y + 3 && circleRect(ball, paddle)) {
        const relative = clamp((ball.x - paddle.x - paddle.w / 2) / (paddle.w / 2), -1, 1);
        const angle = relative * Math.PI / 3;
        const speed = breakoutSpeed(state);
        ball.x = clamp(ball.x, paddle.x - ball.r + 1, paddle.x + paddle.w + ball.r - 1);
        ball.y = paddle.y - ball.r - 0.1;
        ball.vx = Math.sin(angle) * speed;
        ball.vy = -Math.cos(angle) * speed;
      }
      const brick = state.bricks.find((candidate) => circleRect(ball, candidate));
      if (brick) {
        if (previousY + ball.r <= brick.y + 0.01) { ball.y = brick.y - ball.r - 0.1; ball.vy = -Math.abs(ball.vy); }
        else if (previousY - ball.r >= brick.y + brick.h - 0.01) { ball.y = brick.y + brick.h + ball.r + 0.1; ball.vy = Math.abs(ball.vy); }
        else if (previousX + ball.r <= brick.x + 0.01) { ball.x = brick.x - ball.r - 0.1; ball.vx = -Math.abs(ball.vx); }
        else if (previousX - ball.r >= brick.x + brick.w - 0.01) { ball.x = brick.x + brick.w + ball.r + 0.1; ball.vx = Math.abs(ball.vx); }
        else {
          const distances = [Math.abs(ball.y + ball.r - brick.y), Math.abs(ball.y - ball.r - brick.y - brick.h), Math.abs(ball.x + ball.r - brick.x), Math.abs(ball.x - ball.r - brick.x - brick.w)];
          const side = distances.indexOf(Math.min(...distances));
          if (side === 0) { ball.y = brick.y - ball.r - 0.1; ball.vy = -Math.abs(ball.vy); }
          else if (side === 1) { ball.y = brick.y + brick.h + ball.r + 0.1; ball.vy = Math.abs(ball.vy); }
          else if (side === 2) { ball.x = brick.x - ball.r - 0.1; ball.vx = -Math.abs(ball.vx); }
          else { ball.x = brick.x + brick.w + ball.r + 0.1; ball.vx = Math.abs(ball.vx); }
        }
        brick.hp -= 1;
        state.hits += 1;
        state.score += 10;
        if (brick.hp <= 0) { state.bricks = state.bricks.filter((candidate) => candidate.id !== brick.id); state.broken += 1; state.score += 25; }
        if (!state.bricks.length) {
          if (state.singleField || state.level >= 3) state.status = 'won';
          else { state.level += 1; state.bricks = breakoutBricks(state.level); breakoutAttach(state); }
        }
      }
      if (ball.y - ball.r > HEIGHT) {
        state.lives -= 1;
        if (state.lives <= 0) state.status = 'lost';
        else breakoutAttach(state);
      }
    }
    return state;
  }

  function breakoutDraw(ctx, state, options = {}) {
    background(ctx, options, '#271e47', state);
    grid(ctx, 48, 0.07);
    ctx.strokeStyle = '#8b9de0';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(12, 464); ctx.lineTo(12, 16); ctx.lineTo(708, 16); ctx.lineTo(708, 464); ctx.stroke();
    state.bricks.forEach((brick) => {
      ctx.fillStyle = 'rgba(1,6,15,.6)'; rounded(ctx, brick.x + 2, brick.y + 4, brick.w, brick.h, 5); ctx.fill();
      const material = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.h);
      material.addColorStop(0, '#fff1f8'); material.addColorStop(0.18, brick.color); material.addColorStop(1, '#39447e');
      ctx.fillStyle = material;
      rounded(ctx, brick.x, brick.y, brick.w, brick.h, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      rounded(ctx, brick.x + 4, brick.y + 3, brick.w - 8, 3, 1);
      ctx.fill();
      if (brick.hp > 1) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4;
        rounded(ctx, brick.x + 3, brick.y + 3, brick.w - 6, brick.h - 6, 3); ctx.stroke();
        ctx.fillStyle = '#33465d'; [brick.x + 7, brick.x + brick.w - 7].forEach((x) => { ctx.beginPath(); ctx.arc(x, brick.y + brick.h / 2, 2, 0, Math.PI * 2); ctx.fill(); });
      }
    });
    const paddle = state.paddle;
    ctx.fillStyle = '#89ffe4';
    ctx.shadowColor = '#41edce';
    ctx.shadowBlur = options.reducedMotion ? 0 : 14;
    rounded(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 7); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#194754';
    rounded(ctx, paddle.x + 9, paddle.y + 4, paddle.w - 18, 3, 2); ctx.fill();
    ctx.fillStyle = '#d2f6ec'; rounded(ctx, paddle.x + 3, paddle.y + 2, 7, paddle.h - 4, 3); ctx.fill(); rounded(ctx, paddle.x + paddle.w - 10, paddle.y + 2, 7, paddle.h - 4, 3); ctx.fill();
    if (state.launched && !options.reducedMotion) {
      const speed = Math.hypot(state.ball.vx, state.ball.vy) || 1;
      ctx.strokeStyle = 'rgba(255,219,152,.25)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(state.ball.x, state.ball.y); ctx.lineTo(state.ball.x - state.ball.vx / speed * 28, state.ball.y - state.ball.vy / speed * 28); ctx.stroke();
    }
    ctx.fillStyle = '#fff1c7';
    ctx.shadowColor = '#ffde85';
    ctx.shadowBlur = options.reducedMotion ? 0 : 14;
    ctx.beginPath(); ctx.arc(state.ball.x, state.ball.y, state.ball.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function breakoutDescribe(state) {
    return { needsFrame: state.status === 'playing' && state.launched, summary: 'Phá gạch: màn ' + state.level + '/3, còn ' + state.bricks.length + ' viên gạch và ' + state.lives + ' mạng. ' + (state.status === 'won' ? 'Đã vượt qua ba màn.' : state.status === 'lost' ? 'Đã hết mạng.' : state.launched ? 'Di chuyển thanh đỡ bằng trái/phải hoặc con trỏ.' : 'Nhấn nút hành động hoặc phím Space để thả bóng.') };
  }

  // Star Guard: three finite formations and one boss, using real projectiles/collisions.
  function shooterWave(state, wave) {
    state.wave = wave;
    state.level = wave;
    state.waveAge = 0;
    state.transition = 0;
    state.bullets = [];
    state.enemyBullets = [];
    state.enemies = [];
    if (wave === 4) {
      const health = { easy: 28, normal: 40, hard: 52 }[state.difficulty];
      state.enemies.push({ id: 'boss', kind: 'boss', x: 360, y: 102, baseX: 360, baseY: 102, r: 42, hp: health, maxHp: health, phase: 0, cooldown: 1.2 });
      return;
    }
    const count = 4 + wave * 2;
    for (let index = 0; index < count; index += 1) {
      const col = index % 5;
      const row = Math.floor(index / 5);
      const baseX = 110 + col * 124;
      const baseY = 76 + row * 66;
      const hp = wave >= 3 || (wave === 2 && index % 3 === 0) ? 2 : 1;
      state.enemies.push({ id: wave + '-' + index, kind: index % 3 === 0 ? 'kite' : 'scout', x: baseX, y: baseY, baseX, baseY, r: 18, hp, maxHp: hp, phase: random(state) * Math.PI * 2, cooldown: 1.2 + random(state) * 1.9 });
    }
  }

  function shooterCreate(options = {}) {
    const state = Object.assign(base('star-guard', options), {
      player: { x: 360, y: 420, r: 13 }, health: 3, maxHealth: 3, invulnerable: 0,
      wave: 1, waveAge: 0, transition: 0, fireCooldown: 0, bullets: [], enemyBullets: [], enemies: [], defeated: 0, shots: 0
    });
    if (state.difficulty === 'easy') state.health = state.maxHealth = 4;
    shooterWave(state, 1);
    return state;
  }

  function circles(a, b) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= (a.r + b.r) ** 2; }

  function shooterFire(state) {
    if (state.fireCooldown > 0 || state.bullets.length >= 96) return;
    state.bullets.push({ x: state.player.x, y: state.player.y - 19, vx: 0, vy: -560, r: 4 });
    state.shots += 1;
    state.fireCooldown = { easy: 0.17, normal: 0.19, hard: 0.21 }[state.difficulty];
  }

  function enemyFire(state, enemy) {
    const speed = { easy: 142, normal: 176, hard: 210 }[state.difficulty];
    const count = enemy.firePattern === 'fan' ? 3 : enemy.kind === 'boss' ? 5 : 1;
    const aim = clamp((state.player.x - enemy.x) / 600, -0.5, 0.5);
    for (let index = 0; index < count && state.enemyBullets.length < 128; index += 1) {
      const angle = aim + (index - (count - 1) / 2) * 0.23;
      state.enemyBullets.push({ x: enemy.x, y: enemy.y + enemy.r + 4, vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed, r: enemy.kind === 'boss' ? 5 : 4 });
    }
    enemy.cooldown = enemy.kind === 'boss' ? { easy: 1.1, normal: 0.9, hard: 0.72 }[state.difficulty] : 2.3 + random(state) * 1.8 - state.wave * 0.12;
  }

  function shooterStep(previous, action, seconds = 0) {
    const state = clone(previous);
    if (state.status !== 'playing') return state;
    const command = input(action);
    const held = command.held || {};
    const dt = delta(seconds);
    if (command.type === 'pointer' && Number.isFinite(command.x)) state.player.x = clamp(command.x, 28, WIDTH - 28);
    if (DIRECTIONS[command.type]) {
      state.player.x = clamp(state.player.x + DIRECTIONS[command.type].x * 24, 28, WIDTH - 28);
      state.player.y = clamp(state.player.y + DIRECTIONS[command.type].y * 24, 270, HEIGHT - 26);
    }
    if (command.type === 'action') shooterFire(state);
    if (!dt) return state;
    const count = Math.ceil(dt / 0.01);
    const step = dt / count;
    for (let index = 0; index < count && state.status === 'playing'; index += 1) {
      state.time += step;
      state.waveAge += step;
      state.fireCooldown = Math.max(0, state.fireCooldown - step);
      state.invulnerable = Math.max(0, state.invulnerable - step);
      let dx = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      let dy = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
      state.player.x = clamp(state.player.x + dx * 315 * step, 28, WIDTH - 28);
      state.player.y = clamp(state.player.y + dy * 315 * step, 270, HEIGHT - 26);
      if (held.action && state.enemies.length) shooterFire(state);
      state.enemies.forEach((enemy) => {
        enemy.x = enemy.baseX + Math.sin(state.waveAge * (enemy.kind === 'boss' ? 0.65 : 1.05) + enemy.phase) * (enemy.motion === 'sweep' ? 95 : enemy.kind === 'boss' ? 228 : 28);
        enemy.y = enemy.baseY + (enemy.motion === 'dive' ? Math.abs(Math.sin(state.waveAge * .6 + enemy.phase)) * 145 : Math.sin(state.waveAge * 1.1 + enemy.phase) * 10);
        enemy.cooldown -= step;
        if (enemy.cooldown <= 0) enemyFire(state, enemy);
      });
      state.bullets.forEach((bullet) => { bullet.x += bullet.vx * step; bullet.y += bullet.vy * step; });
      state.enemyBullets.forEach((bullet) => { bullet.x += bullet.vx * step; bullet.y += bullet.vy * step; });
      state.bullets = state.bullets.filter((bullet) => {
        if (bullet.y < -12) return false;
        const enemy = state.enemies.find((candidate) => candidate.hp > 0 && circles(bullet, candidate));
        if (!enemy) return true;
        if (enemy.shield && (state.waveAge + enemy.phase) % 3 < 1.1) { state.shieldBlocks = (state.shieldBlocks || 0) + 1; return false; }
        enemy.hp -= 1;
        state.score += 10;
        if (enemy.hp <= 0) { state.defeated += 1; state.score += enemy.kind === 'boss' ? 1000 : 90; }
        return false;
      });
      state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
      state.enemyBullets = state.enemyBullets.filter((bullet) => {
        if (bullet.y > HEIGHT + 20 || bullet.x < -20 || bullet.x > WIDTH + 20) return false;
        if (!circles(bullet, state.player)) return true;
        if (state.invulnerable <= 0) { state.health -= 1; state.invulnerable = 1.3; }
        return false;
      });
      if (state.health <= 0) state.status = 'lost';
      if (state.status === 'playing' && !state.enemies.length) {
        state.enemyBullets = [];
        state.bullets = [];
        if (state.singleWave || state.wave >= 4) state.status = 'won';
        else {
          state.transition += step;
          if (state.transition + 1e-9 >= 0.85) shooterWave(state, state.wave + 1);
        }
      }
    }
    return state;
  }

  function starField(ctx, state, reducedMotion) {
    let rng = state.seed;
    ctx.fillStyle = '#b6cee9';
    for (let index = 0; index < 65; index += 1) {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      const x = rng % WIDTH;
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      const y = ((rng % HEIGHT) + (reducedMotion ? 0 : state.time * (2 + index % 3))) % HEIGHT;
      ctx.globalAlpha = 0.2 + (index % 4) * 0.12;
      ctx.beginPath(); ctx.arc(x, y, index % 7 === 0 ? 1.4 : 0.7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function shooterDraw(ctx, state, options = {}) {
    background(ctx, options, '#242044', state);
    starField(ctx, state, options.reducedMotion);
    state.enemies.forEach((enemy) => {
      const boss = enemy.kind === 'boss';
      if (enemy.shield && (state.waveAge + enemy.phase) % 3 < 1.1) { ctx.strokeStyle = '#b9f4ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.r + 9, 0, Math.PI * 2); ctx.stroke(); }
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      const hull = ctx.createLinearGradient(-52, -25, 52, 25);
      hull.addColorStop(0, boss ? '#efceff' : '#ffd6a3'); hull.addColorStop(0.4, boss ? '#9361ff' : enemy.kind === 'kite' ? '#ff66b3' : '#ff8066'); hull.addColorStop(1, '#4c397a');
      ctx.fillStyle = hull;
      ctx.strokeStyle = '#fff0fa';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (boss) { ctx.moveTo(-52, 6); ctx.lineTo(-33, -17); ctx.lineTo(-17, -9); ctx.lineTo(0, -30); ctx.lineTo(17, -9); ctx.lineTo(33, -17); ctx.lineTo(52, 6); ctx.lineTo(28, 24); ctx.lineTo(0, 17); ctx.lineTo(-28, 24); }
      else { ctx.moveTo(0, 20); ctx.lineTo(-21, -7); ctx.lineTo(-10, -15); ctx.lineTo(0, -6); ctx.lineTo(10, -15); ctx.lineTo(21, -7); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(30,40,65,.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-enemy.r, -6); ctx.lineTo(-8, 7); ctx.lineTo(8, 7); ctx.lineTo(enemy.r, -6); ctx.stroke();
      const cockpit = ctx.createRadialGradient(-3, -2, 1, 0, 1, boss ? 18 : 8); cockpit.addColorStop(0, '#d5f6fb'); cockpit.addColorStop(0.3, '#32bbec'); cockpit.addColorStop(1, '#163147'); ctx.fillStyle = cockpit;
      ctx.beginPath(); ctx.ellipse(0, 1, boss ? 17 : 6, boss ? 9 : 4, 0, 0, Math.PI * 2); ctx.fill();
      [-1, 1].forEach((side) => { ctx.fillStyle = '#ffbf79'; rounded(ctx, side * (boss ? 32 : 13) - 3, boss ? 8 : -10, 6, boss ? 10 : 5, 2); ctx.fill(); });
      if (boss) { ctx.strokeStyle = '#d4b4ff'; ctx.beginPath(); ctx.moveTo(-31, -10); ctx.lineTo(-20, 4); ctx.moveTo(31, -10); ctx.lineTo(20, 4); ctx.stroke(); }
      if (enemy.hp < enemy.maxHp || boss) {
        ctx.fillStyle = '#253049'; ctx.fillRect(-enemy.r, -enemy.r - 12, enemy.r * 2, 4);
        ctx.fillStyle = '#70ffdc'; ctx.fillRect(-enemy.r, -enemy.r - 12, enemy.r * 2 * enemy.hp / enemy.maxHp, 4);
      }
      ctx.restore();
    });
    ctx.fillStyle = '#8fffe0';
    state.bullets.forEach((bullet) => { rounded(ctx, bullet.x - 2, bullet.y - 8, 4, 14, 2); ctx.fill(); });
    ctx.fillStyle = '#ff9bb8';
    state.enemyBullets.forEach((bullet) => { ctx.beginPath(); ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2); ctx.fill(); });
    const player = state.player;
    ctx.save(); ctx.translate(player.x, player.y);
    if (state.invulnerable > 0) {
      ctx.strokeStyle = '#b3f9ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.stroke();
    }
    const playerHull = ctx.createLinearGradient(-22, -20, 22, 20); playerHull.addColorStop(0, '#e0eced'); playerHull.addColorStop(0.45, '#25d9f8'); playerHull.addColorStop(1, '#2d518a');
    ctx.fillStyle = playerHull; ctx.strokeStyle = '#e1fffa'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(12, -1); ctx.lineTo(21, 15); ctx.lineTo(7, 11); ctx.lineTo(0, 16); ctx.lineTo(-7, 11); ctx.lineTo(-21, 15); ctx.lineTo(-12, -1); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#28465f';
    ctx.beginPath(); ctx.ellipse(0, -3, 4.5, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c8dfdb'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-14, 9); ctx.lineTo(-5, -3); ctx.moveTo(14, 9); ctx.lineTo(5, -3); ctx.stroke();
    ctx.fillStyle = '#ffd499';
    ctx.beginPath(); ctx.moveTo(-4, 16); ctx.lineTo(0, 26); ctx.lineTo(4, 16); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function shooterDescribe(state) {
    return { summary: 'Vệ binh sao: đợt ' + state.wave + '/4' + (state.wave === 4 ? ' — tàu chỉ huy' : '') + ', còn ' + state.enemies.length + ' đối thủ, ' + state.health + '/' + state.maxHealth + ' giáp. ' + (state.status === 'won' ? 'Đã bảo vệ trạm sao và hạ tàu chỉ huy.' : state.status === 'lost' ? 'Tàu đã hết giáp.' : 'Mũi tên di chuyển; giữ Space hoặc nút hành động để bắn.') };
  }

  const api = {
    WIDTH, HEIGHT,
    games: {
      snake: { id: 'snake', create: snakeCreate, step: snakeStep, draw: snakeDraw, describe: snakeDescribe },
      breakout: { id: 'breakout', create: breakoutCreate, step: breakoutStep, draw: breakoutDraw, describe: breakoutDescribe },
      'star-guard': { id: 'star-guard', create: shooterCreate, step: shooterStep, draw: shooterDraw, describe: shooterDescribe }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.HHAllGameArcade = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
