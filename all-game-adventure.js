(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HHAllGameAdventure = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Original, deterministic canvas games. The host owns input, timing and storage.
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const command = action => typeof action === 'string' ? { type: action } : (action || { type: 'tick' });
  const seconds = dt => clamp(Number.isFinite(dt) ? dt : 1 / 60, 0, .05);
  function seedNumber(seed) {
    let value = 2166136261;
    for (const char of String(seed === undefined ? 'hh-adventure' : seed)) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
    return value || 1;
  }
  function random(state) {
    let value = state.rng >>> 0;
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    state.rng = value >>> 0;
    return state.rng / 4294967296;
  }
  function background(ctx, width, height, accent, options, state) {
    if (options && typeof options.paintScene === 'function') { options.paintScene(ctx, state.id, state); return; }
    ctx.fillStyle = '#080d24'; ctx.fillRect(0, 0, width, height);
    const gradient = ctx.createRadialGradient(width * .6, height * .3, 4, width * .6, height * .3, width * .8);
    gradient.addColorStop(0, accent + '28'); gradient.addColorStop(1, '#080d2400');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#d7ecff';
    for (let i = 0; i < 54; i++) { ctx.globalAlpha = .16 + (i % 4) * .1; ctx.fillRect((i * 137 + 31) % width, (i * 73 + 17) % height, 1.5, 1.5); }
    ctx.globalAlpha = 1;
  }
  function text(ctx, content, x, y, size, color, align) {
    ctx.font = '750 ' + size + 'px system-ui, sans-serif'; ctx.fillStyle = color || '#e9f3ff';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(content, x, y);
  }
  function box(ctx, x, y, w, h, fill, stroke, radius) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, radius || 5); else ctx.rect(x, y, w, h);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
  function gemBlock(ctx, x, y, size, color) {
    const material=ctx.createLinearGradient(x,y,x+size,y+size);
    material.addColorStop(0,color);material.addColorStop(.65,color);material.addColorStop(1,'#22375b');
    box(ctx,x,y,size,size,material,'#ffffffb0',Math.min(6,size*.13));
    ctx.beginPath();ctx.moveTo(x+size*.12,y+size*.15);ctx.lineTo(x+size*.45,y+size*.15);ctx.lineTo(x+size*.15,y+size*.45);ctx.closePath();ctx.fillStyle='#ffffff48';ctx.fill();
    ctx.fillStyle = '#ffffff4d'; ctx.fillRect(x + 3, y + 3, size - 6, 3);
    ctx.fillStyle = '#09162b42'; ctx.fillRect(x + 3, y + size - 5, size - 6, 2);
    ctx.beginPath(); ctx.moveTo(x + 3, y + 7); ctx.lineTo(x + 3, y + size - 4); ctx.strokeStyle = '#ffffff4d'; ctx.lineWidth = 1; ctx.stroke();
  }

  const SHAPES = {
    I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]],
    T: [[1, 0], [0, 1], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]],
    L: [[2, 0], [0, 1], [1, 1], [2, 1]], S: [[1, 0], [2, 0], [0, 1], [1, 1]],
    Z: [[0, 0], [1, 0], [1, 1], [2, 1]]
  };
  const BLOCK_COLORS = { I: '#25d9f8', O: '#ffd166', T: '#a684ff', J: '#4776ff', L: '#ff997f', S: '#68edaf', Z: '#ff78b2' };
  function blockCells(piece) {
    let cells = SHAPES[piece.kind].map(cell => cell.slice());
    if (piece.kind !== 'O') for (let i = 0; i < piece.rotation; i++) cells = cells.map(([x, y]) => [(piece.kind === 'I' ? 3 : 2) - y, x]);
    return cells.map(([x, y]) => [x + piece.x, y + piece.y]);
  }
  function blockFits(state, piece) {
    return blockCells(piece).every(([x, y]) => x >= 0 && x < 10 && y < 20 && (y < 0 || !state.board[y][x]));
  }
  function nextBlock(state) {
    if (!state.bag.length) {
      state.bag = Object.keys(SHAPES);
      for (let i = state.bag.length - 1; i > 0; i--) { const j = Math.floor(random(state) * (i + 1)); [state.bag[i], state.bag[j]] = [state.bag[j], state.bag[i]]; }
    }
    return state.bag.shift();
  }
  function spawnBlock(state) {
    state.piece = { kind: state.next, rotation: 0, x: 3, y: 0 };
    state.next = nextBlock(state); state.gravity = 0;
    if (!blockFits(state, state.piece)) { state.status = 'lost'; state.message = 'Bảng đã đầy. Bạn có thể bắt đầu một ván mới.'; }
  }
  function lockBlock(state) {
    const cells = blockCells(state.piece);
    if (cells.some(([, y]) => y < 0)) { state.status = 'lost'; state.message = 'Khối vượt đỉnh bảng.'; return; }
    cells.forEach(([x, y]) => { state.board[y][x] = state.piece.kind; });
    const remaining = state.board.filter(row => !row.every(Boolean));
    const cleared = 20 - remaining.length;
    while (remaining.length < 20) remaining.unshift(Array(10).fill(null));
    state.board = remaining; state.blocks++;
    if (cleared) { state.score += [0, 100, 300, 500, 800][cleared] * state.level; state.lines += cleared; state.message = 'Đã xóa ' + cleared + ' hàng!'; }
    else state.message = 'Xếp kín một hàng để ghi điểm.';
    state.level = 1 + Math.floor(state.lines / 10); spawnBlock(state);
  }
  function moveBlock(state, dx, dy) {
    const candidate = { ...state.piece, x: state.piece.x + dx, y: state.piece.y + dy };
    if (blockFits(state, candidate)) { state.piece = candidate; return true; }
    return false;
  }
  function rotateBlock(state) {
    const rotation = (state.piece.rotation + 1) % 4;
    for (const dy of [0, -1]) for (const dx of [0, -1, 1, -2, 2]) {
      const candidate = { ...state.piece, rotation, x: state.piece.x + dx, y: state.piece.y + dy };
      if (blockFits(state, candidate)) { state.piece = candidate; return true; }
    }
    return false;
  }
  function blockInput(state, type) {
    if (type === 'left') moveBlock(state, -1, 0);
    if (type === 'right') moveBlock(state, 1, 0);
    if (type === 'up') rotateBlock(state);
    if (type === 'down') { if (moveBlock(state, 0, 1)) state.score++; else lockBlock(state); }
    if (type === 'action') { let distance = 0; while (distance < 24 && moveBlock(state, 0, 1)) distance++; state.score += distance * 2; lockBlock(state); }
  }
  const blockDrop = {
    id: 'block-drop',
    create(options) {
      options = options || {};
      const state = { version: 1, id: 'block-drop', status: 'playing', score: 0, level: 1, lines: 0, blocks: 0, rng: seedNumber(options.seed), difficulty: options.difficulty || 'normal', board: Array.from({ length: 20 }, () => Array(10).fill(null)), bag: [], piece: null, next: '', gravity: 0, repeat: 0, held: {}, message: 'Xếp kín một hàng để ghi điểm.' };
      state.next = nextBlock(state); spawnBlock(state); return state;
    },
    step(source, action, dt) {
      const state = clone(source); const input = command(action);
      if (state.status !== 'playing') return state;
      if (input.type !== 'tick') {
        blockInput(state, input.type);
        if (input.type === 'left' || input.type === 'right') { state.held[input.type] = true; state.repeat = 0; }
      }
      else {
        const delta = seconds(dt); const held = input.held || {};
        const direction = held.left && !held.right ? 'left' : held.right && !held.left ? 'right' : '';
        state.repeat += delta;
        if (direction && (!state.held[direction] || state.repeat >= .12)) { blockInput(state, direction); state.repeat = 0; }
        if (!direction) state.repeat = .12;
        if (held.up && !state.held.up) blockInput(state, 'up');
        if (held.action && !state.held.action) blockInput(state, 'action');
        state.held = { left: !!held.left, right: !!held.right, up: !!held.up, action: !!held.action };
        const base = state.difficulty === 'easy' ? 1 : state.difficulty === 'hard' ? .5 : .75;
        const interval = held.down ? .04 : Math.max(.08, base * Math.pow(.85, state.level - 1));
        state.gravity += delta;
        while (state.gravity >= interval && state.status === 'playing') {
          state.gravity -= interval;
          if (!moveBlock(state, 0, 1)) lockBlock(state); else if (held.down) state.score++;
        }
      }
      return state;
    },
    draw(ctx, state, options) {
      const width = options && options.width || 720, height = options && options.height || 480;
      ctx.save(); ctx.scale(width / 720, height / 480); background(ctx, 720, 480, '#a283ff', options, state);
      const size = 21, ox = 168, oy = 28;
      box(ctx, 400, 23, 292, 421, '#10182dde', '#7970ad', 16);
      box(ctx, 37, 86, 95, 315, '#111a2ad9', '#4b537d', 12);
      text(ctx, 'HÀNG', 84, 111, 13, '#a7b9e0', 'center'); text(ctx, state.lines, 84, 149, 28, '#e4cdff', 'center');
      for (let i = 0; i < 10; i++) box(ctx, 63, 190 + i * 16, 42, 7, i < state.lines % 10 ? '#ba97ff' : '#2c3653', null, 3);
      text(ctx, 'KHỐI', 84, 368, 12, '#a7b9e0', 'center'); text(ctx, state.blocks, 84, 388, 17, '#c9f3f2', 'center');
      box(ctx, ox - 8, oy - 8, size * 10 + 16, size * 20 + 16, '#07101d', '#8e72df');
      for (let y = 0; y < 20; y++) for (let x = 0; x < 10; x++) {
        if (state.board[y][x]) gemBlock(ctx, ox + x * size + 1, oy + y * size + 1, size - 2, BLOCK_COLORS[state.board[y][x]]);
        else box(ctx, ox + x * size + 1, oy + y * size + 1, size - 2, size - 2, '#101a2b', '#172239', 3);
      }
      if (state.piece) {
        const ghost = { ...state.piece }; while (blockFits(state, { ...ghost, y: ghost.y + 1 })) ghost.y++;
        for (const [x, y] of blockCells(ghost)) if (y >= 0) box(ctx, ox + x * size + 2, oy + y * size + 2, size - 4, size - 4, '#ffffff09', '#7788aa', 2);
        for (const [x, y] of blockCells(state.piece)) if (y >= 0) gemBlock(ctx, ox + x * size + 1, oy + y * size + 1, size - 2, BLOCK_COLORS[state.piece.kind]);
      }
      text(ctx, 'KHỐI QUỸ ĐẠO', 418, 54, 21, '#d7beff'); text(ctx, 'Tiếp theo', 420, 106, 15, '#aabbd2');
      box(ctx, 420, 121, 244, 70, '#071425', '#354969', 10);
      SHAPES[state.next].forEach(([x, y]) => gemBlock(ctx, 426 + x * 22, 130 + y * 22, 20, BLOCK_COLORS[state.next]));
      text(ctx, 'Điểm: ' + state.score, 420, 220, 22); text(ctx, 'Cấp: ' + state.level, 420, 258, 18); text(ctx, 'Hàng: ' + state.lines, 420, 291, 18);
      text(ctx, '← → Di chuyển', 420, 348, 15, '#aabbd2'); text(ctx, '↑ Xoay · ↓ Hạ chậm', 420, 377, 15, '#aabbd2'); text(ctx, 'Hành động: thả nhanh', 420, 406, 15, '#aabbd2'); ctx.restore();
    },
    describe(state) { return { summary: 'Khối quỹ đạo. Điểm ' + state.score + ', cấp ' + state.level + ', đã xóa ' + state.lines + ' hàng. ' + state.message }; }
  };

  // These compact boards are original compositions, not imported puzzle maps.
  const CRATE_LEVELS = [
    ['#######', '#     #', '# @$ .#', '#     #', '#######'],
    ['#######', '#  .  #', '#  $  #', '#  @  #', '#     #', '#######'],
    ['########', '#  .   #', '#  $   #', '# @$ . #', '#      #', '########'],
    ['########', '# . .  #', '# $ $  #', '#   @  #', '#      #', '########'],
    ['#########', '#  . .  #', '#  $ $  #', '#   #   #', '# @     #', '#       #', '#########'],
    ['#########', '#       #', '# . # . #', '# $   $ #', '#   @   #', '#       #', '#########'],
    ['#########', '#  . .  #', '#       #', '#  $ $  #', '#   #   #', '#  @    #', '#       #', '#########']
  ];
  function parseCrates(rows) {
    const width = rows[0].length, walls = [], goals = [], crates = []; let player = -1;
    rows.forEach((row, y) => Array.from(row).forEach((char, x) => {
      const index = y * width + x;
      if (char === '#') walls.push(index);
      if (char === '.' || char === '*' || char === '+') goals.push(index);
      if (char === '$' || char === '*') crates.push(index);
      if (char === '@' || char === '+') player = index;
    }));
    return { width, height: rows.length, walls, goals, crates, player };
  }
  function loadCrateLevel(state) {
    Object.assign(state, parseCrates(CRATE_LEVELS[state.level - 1])); state.history = []; state.moves = 0;
  }
  function crateMove(state, dx, dy) {
    const px = state.player % state.width, py = Math.floor(state.player / state.width), x = px + dx, y = py + dy;
    if (x < 0 || x >= state.width || y < 0 || y >= state.height) return;
    const target = y * state.width + x; if (state.walls.includes(target)) return;
    const index = state.crates.indexOf(target); let destination;
    if (index >= 0) {
      const nx = x + dx, ny = y + dy; destination = ny * state.width + nx;
      if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height || state.walls.includes(destination) || state.crates.includes(destination)) return;
    }
    state.history.push({ player: state.player, crates: state.crates.slice(), moves: state.moves });
    if (state.history.length > 200) state.history.shift();
    state.player = target; if (index >= 0) state.crates[index] = destination; state.moves++;
    state.message = 'Đẩy tất cả kiện hàng tới vòng sáng. Có thể hoàn tác nếu bị kẹt.';
    if (state.goals.every(goal => state.crates.includes(goal))) {
      state.totalMoves += state.moves; state.solved++; state.score += Math.max(30, 150 - state.moves);
      if (state.level === CRATE_LEVELS.length) { state.status = 'won'; state.message = 'Đã hoàn thành cả 7 trạm vận chuyển!'; }
      else { state.level++; loadCrateLevel(state); state.message = 'Hoàn thành trạm trước! Bắt đầu trạm ' + state.level + ' / ' + CRATE_LEVELS.length + '.'; }
    }
  }
  const crateLab = {
    id: 'crate-lab',
    create(options) { const state = { version: 1, id: 'crate-lab', status: 'playing', score: 0, level: 1, solved: 0, moves: 0, totalMoves: 0, message: 'Đẩy tất cả kiện hàng tới vòng sáng. Không thể kéo kiện hàng.' }; loadCrateLevel(state); return state; },
    step(source, action) {
      const state = clone(source), input = command(action);
      if (state.status !== 'playing') return state;
      if (input.type === 'undo' && state.history.length) { const previous = state.history.pop(); Object.assign(state, previous); state.message = 'Đã hoàn tác một bước.'; }
      else if (input.type === 'reset-level') { loadCrateLevel(state); state.message = 'Đã đặt lại trạm hiện tại; các trạm đã qua được giữ.'; }
      else if (input.type === 'left') crateMove(state, -1, 0);
      else if (input.type === 'right') crateMove(state, 1, 0);
      else if (input.type === 'up') crateMove(state, 0, -1);
      else if (input.type === 'down') crateMove(state, 0, 1);
      else if (input.type === 'cell' && Number.isInteger(input.index)) {
        const dx = input.index % state.width - state.player % state.width;
        const dy = Math.floor(input.index / state.width) - Math.floor(state.player / state.width);
        if (Math.abs(dx) + Math.abs(dy) === 1) crateMove(state, dx, dy);
      }
      return state;
    },
    draw(ctx, state, options) {
      const width = options && options.width || 720, height = options && options.height || 480;
      ctx.save(); ctx.scale(width / 720, height / 480); background(ctx, 720, 480, '#55f0bb', options, state);
      text(ctx, 'TRẠM VẬN CHUYỂN ' + state.level + ' / ' + CRATE_LEVELS.length, 360, 30, 21, '#a8ffdc', 'center');
      const size = Math.min(47, 350 / state.height), ox = (720 - size * state.width) / 2, oy = 70;
      box(ctx, ox - 14, oy - 14, size * state.width + 28, size * state.height + 28, '#132735e6', '#688b92', 14);
      for (const side of [-1, 1]) { const sx = side < 0 ? ox - 68 : ox + state.width * size + 24; box(ctx, sx, oy + 54, 42, 138, '#172c3ada', '#3c626e', 9); for (let light = 0; light < 5; light++) box(ctx, sx + 12, oy + 70 + light * 22, 18, 5, light < state.solved ? '#89efc4' : '#395564', null, 2); }
      for (let index = 0; index < state.width * state.height; index++) {
        const x = ox + index % state.width * size, y = oy + Math.floor(index / state.width) * size;
        box(ctx, x + 1, y + 1, size - 2, size - 2, state.walls.includes(index) ? '#263c52' : '#0e2130', state.walls.includes(index) ? '#46627d' : '#173b46', 4);
        if (state.walls.includes(index)) { ctx.fillStyle = '#587081'; ctx.fillRect(x + 5, y + 5, size - 10, 3); ctx.fillStyle = '#162938'; ctx.fillRect(x + 4, y + size - 8, size - 8, 4); }
        else { ctx.fillStyle = '#49726c'; ctx.fillRect(x + 5, y + 5, 2, 2); ctx.fillRect(x + size - 7, y + size - 7, 2, 2); }
        if (state.goals.includes(index)) { ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size * .29, 0, Math.PI * 2); ctx.strokeStyle = '#8df3bf'; ctx.lineWidth = 3; ctx.stroke(); ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size * .37, 0, Math.PI * 2); ctx.strokeStyle = '#8df3bf33'; ctx.lineWidth = 2; ctx.stroke(); }
        if (state.crates.includes(index)) {
          box(ctx, x + 7, y + 7, size - 14, size - 14, state.goals.includes(index) ? '#a1f8b3' : '#f2bd71', '#fce5b2', 5);
          ctx.fillStyle = '#fff0c795'; ctx.fillRect(x + 10, y + 10, size - 20, 3);
          ctx.beginPath(); ctx.moveTo(x + 12, y + 12); ctx.lineTo(x + size - 12, y + size - 12); ctx.moveTo(x + size - 12, y + 12); ctx.lineTo(x + 12, y + size - 12); ctx.strokeStyle = '#80623b'; ctx.lineWidth = 2; ctx.stroke();
        }
        if (state.player === index) {
          ctx.beginPath(); ctx.ellipse(x + size / 2, y + size * .76, size * .27, size * .09, 0, 0, Math.PI * 2); ctx.fillStyle = '#0000005c'; ctx.fill();
          box(ctx, x + size * .23, y + size * .24, size * .54, size * .49, '#8bd8ff', '#d7f5ff', 8);
          box(ctx, x + size * .32, y + size * .38, size * .36, size * .15, '#123152', null, 2);
          ctx.beginPath(); ctx.moveTo(x + size / 2, y + size * .25); ctx.lineTo(x + size / 2, y + size * .13); ctx.strokeStyle = '#c7f5ff'; ctx.lineWidth = 2; ctx.stroke();
          box(ctx, x + size * .45, y + size * .09, size * .1, size * .08, '#9af4ca', null, 2);
        }
      }
      text(ctx, 'Bước: ' + state.moves + '   ·   Trạm xong: ' + state.solved + '   ·   Điểm: ' + state.score, 360, 434, 16, '#d8eee8', 'center');
      text(ctx, 'Mũi tên hoặc chọn ô liền kề · Hoàn tác · Đặt lại trạm', 360, 460, 14, '#aabbd2', 'center'); ctx.restore();
    },
    describe(state) {
      const cells = Array.from({ length: state.width * state.height }, (_, index) => {
        const dx = index % state.width - state.player % state.width, dy = Math.floor(index / state.width) - Math.floor(state.player / state.width);
        const wall = state.walls.includes(index), crate = state.crates.includes(index), goal = state.goals.includes(index), player = state.player === index;
        const label = 'Hàng ' + (Math.floor(index / state.width) + 1) + ', cột ' + (index % state.width + 1) + ': ' + (wall ? 'tường' : player ? 'bạn đang ở đây' : crate ? 'kiện hàng' : 'ô trống') + (goal ? ', đích đến' : '');
        return { index, tone: wall ? 'wall' : player ? 'player' : crate ? goal ? 'crate-docked' : 'crate' : goal ? 'goal' : 'floor', text: wall ? '▰' : player ? '●' : crate ? (goal ? '▣' : '□') : goal ? '◎' : '·', description: label, label, disabled: state.status !== 'playing' || wall || Math.abs(dx) + Math.abs(dy) !== 1, pressed: player };
      });
      return { summary: 'Trạm ' + state.level + ' trên ' + CRATE_LEVELS.length + '. ' + state.moves + ' bước. ' + state.message, cells, columns: state.width };
    }
  };

  const RUNNER_COURSES = [
    { name: 'Bến sao', width: 2080, platforms: [[0, 420, 520, 60], [610, 420, 650, 60], [1360, 420, 720, 60], [290, 337, 115, 14], [890, 330, 120, 14], [1580, 334, 130, 14]], hazards: [[750, 402, 38, 18], [1480, 402, 45, 18]], coins: [[200, 373], [345, 300], [565, 321], [820, 362], [945, 293], [1309, 315], [1640, 295], [1860, 367]], checkpoint: [1100, 384], goal: 1990 },
    { name: 'Cầu tinh vân', width: 2460, platforms: [[0, 420, 430, 60], [530, 420, 600, 60], [1230, 420, 570, 60], [1905, 420, 555, 60], [620, 334, 105, 14], [1460, 333, 120, 14], [2080, 325, 120, 14]], hazards: [[790, 402, 45, 18], [1645, 402, 42, 18], [2280, 402, 42, 18]], coins: [[180, 374], [480, 315], [680, 297], [920, 368], [1180, 314], [1520, 294], [1854, 317], [2140, 288], [2370, 368]], checkpoint: [1320, 384], goal: 2375 },
    { name: 'Vườn cực quang', width: 2780, platforms: [[0, 420, 470, 60], [575, 420, 545, 60], [1225, 420, 590, 60], [1920, 420, 860, 60], [230, 334, 135, 14], [800, 330, 145, 14], [1450, 331, 145, 14], [2150, 325, 150, 14]], hazards: [[660, 402, 43, 18], [1360, 402, 46, 18], [2030, 402, 48, 18], [2470, 402, 48, 18]], coins: [[290, 296], [522, 313], [870, 293], [1170, 315], [1510, 294], [1867, 314], [2210, 288], [2380, 371], [2645, 364]], checkpoint: [1630, 384], goal: 2695 }
  ];
  function loadRunnerLevel(state) {
    state.player = { x: 52, y: 384, vx: 0, vy: 0, width: 24, height: 36, grounded: true };
    state.checkpoint = { x: 52, y: 384, activated: false }; state.collected = []; state.camera = 0;
    state.coyote = .1; state.jumpBuffer = 0; state.invulnerable = 0; state.held = {}; state.levelScore = state.score;
  }
  const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  function runnerDeath(state) {
    state.lives--; state.deaths++;
    if (state.lives <= 0) { state.status = 'lost'; state.message = 'Đã hết lượt. Bắt đầu lại để thử lộ trình khác.'; return; }
    Object.assign(state.player, { x: state.checkpoint.x, y: state.checkpoint.y, vx: 0, vy: 0, grounded: true });
    state.coyote = .1; state.jumpBuffer = 0; state.invulnerable = 1; state.message = 'Trở lại điểm an toàn. Còn ' + state.lives + ' lượt.';
  }
  function runnerPhysics(state, held, dt) {
    const course = RUNNER_COURSES[state.level - 1], player = state.player;
    const speed = state.difficulty === 'easy' ? 180 : state.difficulty === 'hard' ? 210 : 200;
    const direction = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    const desired = direction * speed;
    player.vx += (desired - player.vx) * Math.min(1, dt * 15);
    if (!direction && Math.abs(player.vx) < .1) player.vx = 0;
    state.jumpBuffer = Math.max(0, state.jumpBuffer - dt); state.coyote = Math.max(0, state.coyote - dt); state.invulnerable = Math.max(0, state.invulnerable - dt);
    if (player.grounded) state.coyote = .1;
    if (state.jumpBuffer > 0 && state.coyote > 0) { player.vy = -440; player.grounded = false; state.jumpBuffer = 0; state.coyote = 0; }
    const oldX = player.x, oldY = player.y;
    player.x = clamp(player.x + player.vx * dt, 0, course.width - player.width);
    for (const [x, y, width, height] of course.platforms) {
      const platform = { x, y, width, height };
      if (intersects(player, platform)) { if (player.vx > 0 && oldX + player.width <= x + .5) player.x = x - player.width; else if (player.vx < 0 && oldX >= x + width - .5) player.x = x + width; }
    }
    player.vy = Math.min(600, player.vy + 1150 * dt); player.y += player.vy * dt; player.grounded = false;
    for (const [x, y, width, height] of course.platforms) {
      if (!intersects(player, { x, y, width, height })) continue;
      if (player.vy >= 0 && oldY + player.height <= y + .5) { player.y = y - player.height; player.vy = 0; player.grounded = true; }
      else if (player.vy < 0 && oldY >= y + height - .5) { player.y = y + height; player.vy = 0; }
    }
    if (player.y > 535 || (!state.invulnerable && course.hazards.some(([x, y, width, height]) => intersects(player, { x, y, width, height })))) { runnerDeath(state); return; }
    course.coins.forEach(([x, y], index) => {
      if (!state.collected.includes(index) && intersects(player, { x: x - 11, y: y - 11, width: 22, height: 22 })) { state.collected.push(index); state.totalCoins++; state.score += 10; }
    });
    if (!state.checkpoint.activated && Math.abs(player.x - course.checkpoint[0]) < 36 && player.grounded) {
      state.checkpoint = { x: course.checkpoint[0], y: course.checkpoint[1], activated: true }; state.message = 'Đã mở điểm an toàn giữa chặng.';
    }
    state.camera = clamp(player.x - 220, 0, course.width - 720);
    if (intersects(player, { x: course.goal, y: 331, width: 38, height: 89 })) {
      state.score += 150; state.completed++;
      if (state.level === RUNNER_COURSES.length) { state.status = 'won'; state.message = 'Đã tới cổng đích của cả 3 chặng!'; }
      else { state.level++; loadRunnerLevel(state); state.message = 'Qua cổng! Chặng ' + state.level + ': ' + RUNNER_COURSES[state.level - 1].name + '.'; }
    }
  }
  const orbitRunner = {
    id: 'orbit-runner',
    create(options) {
      options = options || {}; const difficulty = options.difficulty || 'normal';
      const state = { version: 1, id: 'orbit-runner', status: 'playing', score: 0, level: 1, completed: 0, totalCoins: 0, deaths: 0, lives: difficulty === 'easy' ? 5 : difficulty === 'hard' ? 2 : 3, difficulty, elapsed: 0, message: 'Đi tới cổng sáng. Nhảy qua khe hở và gai; thu thập tinh thể nếu muốn.' };
      loadRunnerLevel(state); return state;
    },
    step(source, action, dt) {
      const state = clone(source), input = command(action);
      if (state.status !== 'playing') return state;
      if (input.type === 'reset-level') { state.score = state.levelScore; state.totalCoins -= state.collected.length; loadRunnerLevel(state); state.message = 'Đã trở về đầu chặng hiện tại.'; return state; }
      if (input.type === 'up' || input.type === 'action') state.jumpBuffer = .15;
      if (input.type === 'tick') {
        const held = input.held || {}, delta = seconds(dt);
        if ((held.up && !state.held.up) || (held.action && !state.held.action)) state.jumpBuffer = .15;
        state.elapsed += delta; state.held = { up: !!held.up, action: !!held.action };
        runnerPhysics(state, held, delta);
      } else if (input.type === 'left' || input.type === 'right') runnerPhysics(state, { [input.type]: true }, .05);
      return state;
    },
    draw(ctx, state, options) {
      const width = options && options.width || 720, height = options && options.height || 480;
      const course = RUNNER_COURSES[state.level - 1], camera = state.camera;
      ctx.save(); ctx.scale(width / 720, height / 480); background(ctx, 720, 480, '#69d8f4', options, state);
      for (let i = 0; i < 8; i++) { const x = (i * 190 - camera * .18) % 900; ctx.fillStyle = ['#23435572', '#34466a72', '#245d5872'][state.level - 1]; ctx.beginPath(); ctx.moveTo(x - 170, 420); ctx.lineTo(x, 230 + i % 3 * 35); ctx.lineTo(x + 200, 420); ctx.fill(); }
      ctx.save(); ctx.translate(-camera, 0);
      // Landmarks sit behind the collision platforms; every walkable edge stays crisp.
      for (let marker = 0; marker < 6; marker++) {
        const x = 180 + marker * 430;
        box(ctx, x - 13, 288 + marker % 2 * 20, 26, 118 - marker % 2 * 20, '#41647755', '#77c0d530', 5);
        box(ctx, x - 28, 288 + marker % 2 * 20, 56, 8, '#7190bb66', null, 3);
        ctx.beginPath(); ctx.arc(x, 274 + marker % 2 * 20, 10, 0, Math.PI * 2); ctx.strokeStyle = '#8eece860'; ctx.lineWidth = 2; ctx.stroke();
      }
      course.platforms.forEach(([x, y, w, h]) => {
        box(ctx, x, y, w, h, ['#285377', '#514878', '#287a68'][state.level - 1], '#7bffe6', 3);
        ctx.fillStyle = '#b1ffe5'; ctx.fillRect(x, y, w, 3);
        ctx.fillStyle = '#041e3380'; ctx.fillRect(x + 2, y + h - 7, w - 4, 5);
        for (let tile = 12; tile < w - 10; tile += 44) { ctx.fillStyle = '#72e3db33'; ctx.fillRect(x + tile, y + 7, 18, 2); if (h > 20) { ctx.fillStyle = '#092a3a'; ctx.fillRect(x + tile + 8, y + 24, 2, h - 28); } }
        if (h <= 20) { ctx.beginPath(); ctx.moveTo(x + 10, y + h); ctx.lineTo(x + 20, y + h + 11); ctx.lineTo(x + w - 20, y + h + 11); ctx.lineTo(x + w - 10, y + h); ctx.fillStyle = '#193447'; ctx.fill(); }
      });
      course.hazards.forEach(([x, y, w, h]) => { box(ctx, x - 3, y + h - 3, w + 6, 4, '#ff7a9f66', null, 2); ctx.beginPath(); ctx.moveTo(x, y + h); for (let i = 0; i < 3; i++) { ctx.lineTo(x + (i + .5) * w / 3, y); ctx.lineTo(x + (i + 1) * w / 3, y + h); } ctx.fillStyle = '#ff7a9f'; ctx.fill(); ctx.strokeStyle = '#ffe0d9'; ctx.lineWidth = 1; ctx.stroke(); });
      course.coins.forEach(([x, y], index) => {
        if (state.collected.includes(index)) return;
        const bob = options && options.reducedMotion ? 0 : Math.sin(state.elapsed * 2 + index) * 3;
        ctx.beginPath(); ctx.arc(x, y + bob, 15, 0, Math.PI * 2); ctx.strokeStyle = '#ffdf7b39'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y - 10 + bob); ctx.lineTo(x + 7, y + bob); ctx.lineTo(x, y + 10 + bob); ctx.lineTo(x - 7, y + bob); ctx.closePath(); ctx.fillStyle = '#ffdf7b'; ctx.fill(); ctx.strokeStyle = '#fff3cb'; ctx.lineWidth = 1; ctx.stroke();
      });
      const checkpointX = course.checkpoint[0]; ctx.strokeStyle = state.checkpoint.activated ? '#a7ffb8' : '#8293b0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(checkpointX, 420); ctx.lineTo(checkpointX, 345); ctx.stroke(); box(ctx, checkpointX, 345, 34, 21, state.checkpoint.activated ? '#82e7a4' : '#43576f', '#d8f7ec', 3); text(ctx, '✓', checkpointX + 17, 355, 15, '#112b32', 'center');
      box(ctx, checkpointX - 11, 411, 22, 9, '#9ddccd', '#d0f3e5', 3);
      box(ctx, course.goal - 6, 325, 50, 95, '#1c284ce8', '#a7f6fa', 21);
      box(ctx, course.goal, 331, 38, 89, '#44dbe42e', '#a7f6fa', 17); ctx.strokeStyle = '#d7b0ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(course.goal + 19, 375, 15, 36, 0, 0, Math.PI * 2); ctx.stroke();
      for (let spark = 0; spark < 5; spark++) { const sy = 344 + spark * 14; box(ctx, course.goal - 4, sy, 3, 4, '#f5dcff', null, 1); box(ctx, course.goal + 39, sy, 3, 4, '#a1f3ee', null, 1); }
      const player = state.player;
      ctx.beginPath(); ctx.ellipse(player.x + 12, player.y + 39, player.grounded ? 18 : 11, 4, 0, 0, Math.PI * 2); ctx.fillStyle = '#07152266'; ctx.fill();
      ctx.globalAlpha = state.invulnerable && !(options && options.reducedMotion) ? .65 : 1;
      const stride = options && options.reducedMotion ? 0 : Math.sin(state.elapsed * 19) * Math.min(2.5, Math.abs(player.vx) / 80);
      box(ctx, player.x + 2, player.y, 20, 23, '#e1f4ff', '#ffffff', 8); box(ctx, player.x + 4, player.y + 7, 16, 10, '#203756', '#59eaf8', 4);
      box(ctx, player.x + 5, player.y + 22, 14, 10, '#7aacef', '#e1f4ff', 3);
      box(ctx, player.x + 3 + stride, player.y + 31, 8, 5, '#e1f4ff', '#ffffff', 2); box(ctx, player.x + 13 - stride, player.y + 31, 8, 5, '#e1f4ff', '#ffffff', 2);
      ctx.fillStyle = '#ffffffb3'; ctx.fillRect(player.x + 7, player.y + 9, 4, 2);
      ctx.globalAlpha = 1; ctx.restore();
      box(ctx, 15, 14, 690, 49, '#080f21e8', '#3b5a77', 10);
      text(ctx, 'CHẶNG ' + state.level + '/3 · ' + course.name, 30, 38, 17, '#c0f2ff'); text(ctx, state.lives + ' lượt  ·  ' + state.score + ' điểm', 690, 38, 17, '#ffe6a3', 'right');
      text(ctx, '← → Di chuyển · ↑ / Hành động: nhảy · Cờ là điểm hồi sinh', 360, 460, 15, '#c2d5e8', 'center'); ctx.restore();
    },
    describe(state) { return { summary: 'Chặng ' + state.level + '/3: ' + RUNNER_COURSES[state.level - 1].name + '. Còn ' + state.lives + ' lượt, ' + state.totalCoins + ' tinh thể, ' + state.score + ' điểm. ' + state.message }; }
  };
  return { games: { 'block-drop': blockDrop, 'crate-lab': crateLab, 'orbit-runner': orbitRunner }, internals: { blockCells, blockFits, CRATE_LEVELS, parseCrates, RUNNER_COURSES } };
});
