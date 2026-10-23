(function (scope, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (scope) scope.HHAllGamePackPuzzles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Original implementations and procedural boards. The host owns storage and timing.
  var games = {}, DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function seed(value) { var n = 2166136261; String(value == null ? 1 : value).split('').forEach(function (c) { n = Math.imul(n ^ c.charCodeAt(0), 16777619); }); return n >>> 0 || 1; }
  function rand(s) { var n = s.rng; n ^= n << 13; n ^= n >>> 17; n ^= n << 5; s.rng = n >>> 0 || 1; return s.rng / 4294967296; }
  function shuffle(a, s) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand(s) * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function indexOK(i, n) { return Number.isInteger(i) && i >= 0 && i < n; }
  function direction(type) { return ['up', 'right', 'down', 'left'].indexOf(type); }
  function neighbor(i, d, cols, rows) { var x = i % cols + DIRS[d][0], y = Math.floor(i / cols) + DIRS[d][1]; return x >= 0 && x < cols && y >= 0 && y < rows ? y * cols + x : -1; }
  function remember(s, before) { var snapshot = clone(before); delete snapshot.history; s.history.push(snapshot); if (s.history.length > 128) s.history.shift(); }
  function finish(s, score) { s.status = 'won'; s.score = Math.max(1, Math.round(score)); }
  function base(id, options) { return { version: 1, id: id, status: 'playing', score: 0, level: 1, moves: 0, selected: 0, initialSeed: String(options && options.seed != null ? options.seed : 1), rng: seed(options && options.seed), difficulty: options && ['easy', 'normal', 'hard'].includes(options.difficulty) ? options.difficulty : 'normal', history: [], message: '' }; }
  function cell(index, text, description, disabled, pressed) { return { index: index, text: String(text), label: description, description: description, disabled: !!disabled, pressed: !!pressed }; }
  function desc(s, summary, columns, cells) { return { summary: summary + (s.message ? ' ' + s.message : ''), columns: columns, cells: cells }; }
  var MATERIALS = {
    'lights-out': ['#304b87', '#ffe1a3'], 'slide-tiles': ['#4776ff', '#d4faff'], 'peg-solitaire': ['#9361ff', '#ffe0a3'],
    'n-queens': ['#414d93', '#ffe195'], nonogram: ['#f3eafa', '#9158ca'], 'towers-hanoi': ['#613d78', '#ffb57f'],
    'maze-path': ['#2b6e78', '#a4ffd0'], 'connect-four': ['#4776ff', '#ffd166'], 'tic-tac-toe': ['#225a70', '#90ffe4'],
    'reversi-mini': ['#169c88', '#fff2d6'], 'word-search': ['#f0e9ff', '#40306a'], 'number-order': ['#3c5b96', '#bcf3ff'],
    'sudoku-mini': ['#faf2ff', '#443564'], 'color-flood': ['#5863ba', '#ffdc89'], 'pipe-link': ['#3d5896', '#6ef2ea'],
    'code-breaker': ['#774fc5', '#edc6ff'], 'knights-tour': ['#5f66aa', '#ffe09a']
  };
  function material(ctx,x,y,w,h,color){
    if(!/^#[a-f0-9]{6}$/i.test(color))return color;
    var gradient=ctx.createLinearGradient(x,y,x+w,y+h);
    gradient.addColorStop(0,color);gradient.addColorStop(.65,color);gradient.addColorStop(1,'#252d4b');
    return gradient;
  }
  function surface(ctx, x, y, w, h, fill, edge, radius) {
    ctx.beginPath(); if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, radius || 0); else ctx.rect(x, y, w, h);
    ctx.fillStyle = material(ctx,x,y,w,h,fill); ctx.fill(); if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function circle(ctx, x, y, radius, fill, edge) { ctx.beginPath(); ctx.arc(x, y, Math.max(.1, radius), 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke(); } }
  function beam(ctx, points, color, width) { if (!points.length) return; ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]); points.slice(1).forEach(function (p) { ctx.lineTo(p[0], p[1]); }); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); }
  function lettering(ctx, value, x, y, size, color, maxWidth) { ctx.font = '700 ' + size + 'px system-ui,sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(value), x, y, maxWidth); }
  function keycap(ctx, x, y, size, fill, accent) {
    var gap = Math.max(2, size * .045), radius = Math.min(10, size * .12);
    surface(ctx, x + gap, y + gap + 3, size - gap * 2, size - gap * 2, '#03081966', null, radius);
    surface(ctx, x + gap, y + gap, size - gap * 2, size - gap * 2 - 2, fill, '#ffffff26', radius);
    beam(ctx, [[x + gap + radius, y + gap + 2], [x + size - gap - radius, y + gap + 2]], '#ffffff60', 1);
    beam(ctx, [[x+gap+4,y+size-gap-5],[x+size-gap-4,y+size-gap-5]], '#0c1c3c66', 2);
    if (accent) surface(ctx, x + gap + 2, y + gap + 2, size - gap * 2 - 4, size - gap * 2 - 6, '#ffffff06', accent, Math.max(0, radius - 1));
  }
  function drawHanoi(ctx, s, w, h) {
    var base = h * .78, spacing = w / 3, diskH = Math.min(30, h * .07), colors = ['#a47bff', '#25d9f8', '#64e4ae', '#ffd166', '#ff77bd'];
    surface(ctx, w * .05, base, w * .9, 17, '#735548', '#d7ad83', 6);
    s.towers.forEach(function (stack, tower) {
      var cx = spacing * (tower + .5); surface(ctx, cx - 5, base - diskH * (s.count + 1.4), 10, diskH * (s.count + 1.4), '#a57d58', '#f1c990', 4);
      stack.forEach(function (disk, i) { var dw = spacing * (.24 + disk / s.count * .58), y = base - (i + 1) * diskH; surface(ctx, cx - dw / 2, y + 2, dw, diskH - 3, colors[(disk - 1) % colors.length], s.anchor === tower && i === stack.length - 1 ? '#fff3b2' : '#ffffff55', diskH * .25); lettering(ctx, disk, cx, y + diskH / 2, diskH * .6, '#101c2e', dw - 6); });
      lettering(ctx, String.fromCharCode(65 + tower), cx, base + 42, 22, s.anchor === tower ? '#ffe8ac' : '#eee5eb', spacing - 10);
    });
  }
  function drawPuzzleCell(ctx, s, c, x, y, size) {
    var id = s.id, i = c.index, cx = x + size / 2, cy = y + size / 2, material = MATERIALS[id], fill = c.background || material[0], ink = c.color || '#f6efff', accent = material[1], font = Math.min(30, size * .42), value = s.board && s.board[i];
    if (id === 'peg-solitaire') {
      if (value < 0) return;
      keycap(ctx, x, y, size, '#785d94'); circle(ctx, cx, cy + 1, size * .31, '#322744', '#b18a60');
      if (value) { circle(ctx, cx, cy - size * .025, size * .23, '#ffd166', c.pressed ? '#fff1b1' : '#f7d8a3'); circle(ctx, cx - size * .065, cy - size * .09, size * .055, '#ffffff65'); } return;
    }
    if (id === 'n-queens' || id === 'knights-tour') {
      surface(ctx, x + 1, y + 1, size - 2, size - 2, (Math.floor(i / s.columns) + i % s.columns) % 2 ? '#4758a5' : '#b8a2e2', '#c5cfda26', 2);
      ink = c.pressed || c.text.includes('♛') ? '#ffe2a4' : '#e9edf5'; if (c.text.includes('!')) ink = '#ffb6b6';
      if (c.pressed) surface(ctx, x + 4, y + 4, size - 8, size - 8, '#ffe0a01c', '#ffe0a0', 5);
      lettering(ctx, c.text, cx, cy, font, ink, size - 7); return;
    }
    if (id === 'connect-four' || id === 'reversi-mini') {
      surface(ctx, x + 1, y + 1, size - 2, size - 2, fill, '#ffffff18', 3);
      if (id === 'connect-four') { circle(ctx, cx, cy + 1, size * .34, '#0a1937', '#91c3ef55'); if (value) { circle(ctx, cx, cy, size * .29, value === 1 ? '#ffd166' : '#ff78b2', '#ffffff66'); circle(ctx, cx, cy, size * .21, value === 1 ? '#e5a43d' : '#db4b94', '#ffffff35'); } }
      else if (value) { circle(ctx, cx, cy + 2, size * .33, '#071a1d', null); circle(ctx, cx, cy, size * .32, value === 1 ? '#12262c' : '#e8ecdf', value === 1 ? '#82968a' : '#ffffff'); circle(ctx, cx - size * .09, cy - size * .1, size * .07, value === 1 ? '#ffffff16' : '#ffffff90', null); }
      else if (!c.disabled) circle(ctx, cx, cy, size * .07, '#bdeac58a', null);
      return;
    }
    if (id === 'maze-path') {
      if (value) keycap(ctx, x, y, size, '#428e9a'); else surface(ctx, x + 1, y + 1, size - 2, size - 2, '#08262caa', null, 2);
      if (i === s.player) { circle(ctx, cx, cy, size * .27, '#46e9df', '#f2ffeb'); circle(ctx, cx - size * .065, cy - size * .08, size * .06, '#ffffff', null); }
      else if (i === s.exit) lettering(ctx, '★', cx, cy, size * .7, '#ffe5a2', size - 4);
      else if (s.visited.includes(i)) circle(ctx, cx, cy, size * .055, '#8fe2cb99', null);
      return;
    }
    if (id === 'pipe-link') {
      keycap(ctx, x, y, size, '#263b4d'); var segments = [];
      for (var d = 0; d < 4; d++) if (value & 1 << d) segments.push([[cx, cy], [cx + DIRS[d][0] * size * .5, cy + DIRS[d][1] * size * .5]]);
      segments.forEach(function (points) { beam(ctx, points, '#091d2e', size * .28); beam(ctx, points, c.pressed ? '#9ce5de' : '#7f94be', size * .16); beam(ctx, points, c.pressed ? '#e0fff7' : '#a7b6c5', Math.max(1, size * .025)); });
      if (i === 0 || i === 24) circle(ctx, cx, cy, size * .12, i === 0 ? '#ffe39b' : '#eeb4df', '#ffffff99'); return;
    }
    if (id === 'nonogram' || id === 'word-search' || id === 'sudoku-mini') {
      var paper = id === 'sudoku-mini' && (Math.floor(Math.floor(i / 4) / 2) + Math.floor(i % 4 / 2)) % 2 ? '#d8d4e2' : material[0];
      surface(ctx, x + 1, y + 1, size - 2, size - 2, id === 'nonogram' && value === 1 ? '#985dcc' : c.pressed && id === 'word-search' ? '#c4b0db' : paper, '#32294b3a', 3);
      ink = id === 'nonogram' && value === 1 ? '#fff5ff' : c.text.includes('!') ? '#96354f' : accent;
      if (id === 'sudoku-mini') font = Math.min(32, size * .46);
      if (id === 'nonogram' && value === 1) surface(ctx, x + size * .2, y + size * .2, size * .6, size * .6, '#cb8ce8', '#e3d3f166', 2);
      else lettering(ctx, c.text, cx, cy, font, ink, size - 7);
      if (id === 'sudoku-mini') { if (i % 4 === 1) beam(ctx, [[x + size - 1, y], [x + size - 1, y + size]], '#625276', 2); if (Math.floor(i / 4) === 1) beam(ctx, [[x, y + size - 1], [x + size, y + size - 1]], '#625276', 2); }
      return;
    }
    if (id === 'tic-tac-toe') {
      surface(ctx, x + 3, y + 3, size - 6, size - 6, '#173b42d9', '#96d1be77', 7);
      if (value === 1) { beam(ctx, [[x + size * .3, y + size * .3], [x + size * .7, y + size * .7]], '#f6d48d', Math.max(3, size * .055)); beam(ctx, [[x + size * .7, y + size * .3], [x + size * .3, y + size * .7]], '#f6d48d', Math.max(3, size * .055)); }
      else if (value === 2) { ctx.beginPath(); ctx.arc(cx, cy, size * .24, 0, Math.PI * 2); ctx.lineWidth = Math.max(3, size * .055); ctx.strokeStyle = '#9ae3d1'; ctx.stroke(); } return;
    }
    if (id === 'lights-out') { keycap(ctx, x, y, size, value ? '#b38c46' : '#2d3f65', value ? '#ffe7a8' : null); circle(ctx, cx, cy, size * .23, value ? '#ffe082' : '#102438', value ? '#fff5cb' : '#687c8e'); if (value) circle(ctx, cx - size * .06, cy - size * .07, size * .06, '#fff7d9', null); return; }
    if (id === 'slide-tiles' && !value) { surface(ctx, x + 4, y + 4, size - 8, size - 8, '#0b1f35aa', '#b3d8f328', 8); return; }
    if (id === 'number-order' && c.pressed) { fill = '#22755f'; ink = '#bce7c9'; }
    keycap(ctx, x, y, size, fill, id === 'color-flood' && c.pressed ? '#ffffff99' : null);
    if (id === 'code-breaker' && i < 4) { circle(ctx, cx, cy - size * .08, size * .22, fill, '#ffffff55'); font = Math.min(23, size * .24); }
    lettering(ctx, c.text, cx, cy + (id === 'code-breaker' && i < 4 ? size * .25 : 0), font, ink, size - 7);
  }
  function attach(id, create, play, describe) {
    games[id] = {
      id: id,
      create: function (options) { var s = base(id, options || {}); create(s); return s; },
      step: function (state, action) {
        var s = clone(state), a = typeof action === 'string' ? { type: action } : action || {};
        if (a.type === 'undo') { var prior = s.history.pop(); return prior ? Object.assign(prior, { history: s.history }) : s; }
        if (a.type === 'reset-level') return games[id].create({ seed: state.initialSeed || state.rng, difficulty: state.difficulty });
        if (s.status !== 'playing') return s;
        var d = direction(a.type);
        if (d >= 0 && id !== 'maze-path' && id !== 'slide-tiles') { var length = s.board ? s.board.length : s.cellCount || 16, n = neighbor(s.selected, d, s.columns || 4, Math.ceil(length / (s.columns || 4))); if (n >= 0 && n < length) s.selected = n; return s; }
        if (a.type === 'action') a = { type: 'cell', index: s.selected, alternate: !!a.alternate };
        play(s, a, state); return s;
      },
      describe: describe,
      draw: function (ctx, state, options) {
        options = options || {}; var w = options.width || 720, h = options.height || 480, data = describe(state), cols = data.columns, rows = Math.ceil(data.cells.length / cols), size = Math.min((w - 20) / cols, (h - 20) / rows), left = (w - size * cols) / 2, top = (h - size * rows) / 2;
        ctx.save();
        if (typeof options.paintScene === 'function') options.paintScene(ctx, state.id, state);
        else { ctx.fillStyle = '#0a1025'; ctx.fillRect(0, 0, w, h); }
        if (id === 'towers-hanoi') drawHanoi(ctx, state, w, h);
        else { surface(ctx, left - 5, top - 5, size * cols + 10, size * rows + 10, '#091124b8', '#d2e4ff36', 12); data.cells.forEach(function (c, i) { drawPuzzleCell(ctx, state, c, left + i % cols * size, top + Math.floor(i / cols) * size, size); }); }
        ctx.restore();
      }
    };
  }

  function toggleLights(board, index) { [index].concat(DIRS.map(function (_, d) { return neighbor(index, d, 5, 5); })).filter(function (i) { return i >= 0; }).forEach(function (i) { board[i] = 1 - board[i]; }); }
  attach('lights-out', function (s) {
    s.columns = 5; s.board = Array(25).fill(0); s.solution = [];
    for (var i = 0; i < 12; i++) { var n = Math.floor(rand(s) * 25); s.solution.push(n); toggleLights(s.board, n); }
    if (s.board.every(function (v) { return !v; })) { toggleLights(s.board, 12); s.solution.push(12); }
  }, function (s, a, before) {
    if (a.type !== 'cell' || !indexOK(a.index, 25)) return; remember(s, before); s.selected = a.index; toggleLights(s.board, a.index); s.moves++;
    if (s.board.every(function (v) { return !v; })) finish(s, Math.max(100, 1500 - s.moves * 20));
  }, function (s) { return desc(s, 'Tắt toàn bộ đèn. Bấm một ô đổi trạng thái ô đó và bốn ô kề cạnh. ' + s.moves + ' lượt.', 5, s.board.map(function (v, i) { return cell(i, v ? '☀' : '·', 'Đèn ' + (i + 1) + ': ' + (v ? 'đang sáng' : 'đã tắt'), s.status !== 'playing', v); })); });

  function slideSolved(board) { return board.every(function (v, i) { return v === (i + 1) % 9; }); }
  attach('slide-tiles', function (s) {
    s.columns = 3; s.board = [1, 2, 3, 4, 5, 6, 7, 8, 0]; s.blank = 8; s.solution = []; var previous = -1;
    for (var i = 0; i < 60; i++) { var choices = DIRS.map(function (_, d) { return neighbor(s.blank, d, 3, 3); }).filter(function (n) { return n >= 0 && n !== previous; }), n = choices[Math.floor(rand(s) * choices.length)]; s.solution.unshift(s.blank); previous = s.blank; s.board[s.blank] = s.board[n]; s.board[n] = 0; s.blank = n; }
    if (slideSolved(s.board)) { var n = neighbor(s.blank, 0, 3, 3); s.solution.unshift(s.blank); s.board[s.blank] = s.board[n]; s.board[n] = 0; s.blank = n; }
    s.selected = s.blank;
  }, function (s, a, before) {
    var d = direction(a.type), n = d >= 0 ? neighbor(s.blank, d, 3, 3) : a.type === 'cell' ? a.index : -1;
    if (!indexOK(n, 9) || Math.abs(n % 3 - s.blank % 3) + Math.abs(Math.floor(n / 3) - Math.floor(s.blank / 3)) !== 1) return;
    remember(s, before); s.board[s.blank] = s.board[n]; s.board[n] = 0; s.blank = n; s.selected = n; s.moves++; if (slideSolved(s.board)) finish(s, Math.max(100, 2000 - s.moves * 10));
  }, function (s) { return desc(s, 'Xếp 1–8 theo hàng, ô trống ở cuối. Bấm ô cạnh chỗ trống hoặc dùng mũi tên. ' + s.moves + ' bước.', 3, s.board.map(function (v, i) { return cell(i, v || '·', v ? 'Mảnh số ' + v : 'Ô trống', s.status !== 'playing' || Math.abs(i % 3 - s.blank % 3) + Math.abs(Math.floor(i / 3) - Math.floor(s.blank / 3)) !== 1, false); })); });

  function pegValid(i) { var x = i % 7, y = Math.floor(i / 7); return x >= 2 && x <= 4 || y >= 2 && y <= 4; }
  function pegJumps(s, reverse) {
    var result = [];
    for (var i = 0; i < 49; i++) if (pegValid(i) && s.board[i] === 1) for (var d = 0; d < 4; d++) { var mid = neighbor(i, d, 7, 7), to = mid >= 0 ? neighbor(mid, d, 7, 7) : -1; if (to >= 0 && pegValid(mid) && pegValid(to) && s.board[to] === 0 && s.board[mid] === (reverse ? 0 : 1)) result.push({ from: i, mid: mid, to: to }); }
    return result;
  }
  attach('peg-solitaire', function (s) {
    s.columns = 7; s.board = Array.from({ length: 49 }, function (_, i) { return pegValid(i) ? 0 : -1; }); s.board[24] = 1; s.anchor = -1; s.solution = [];
    for (var i = 0; i < 16; i++) { var moves = pegJumps(s, true); if (!moves.length) break; var m = moves[Math.floor(rand(s) * moves.length)]; s.board[m.from] = 0; s.board[m.mid] = 1; s.board[m.to] = 1; s.solution.unshift({ from: m.to, to: m.from }); }
  }, function (s, a, before) {
    if (a.type !== 'cell' || !indexOK(a.index, 49) || !pegValid(a.index)) return; s.selected = a.index;
    if (s.board[a.index] === 1) { s.anchor = a.index; return; }
    var m = pegJumps(s, false).find(function (move) { return move.from === s.anchor && move.to === a.index; });
    if (!m) { s.message = 'Chọn một quân rồi ô trống cách đúng hai ô; ở giữa phải có một quân.'; return; }
    remember(s, before); s.board[m.from] = 0; s.board[m.mid] = 0; s.board[m.to] = 1; s.anchor = -1; s.moves++; s.message = ''; s.score = s.moves * 100;
    if (s.board.filter(function (v) { return v === 1; }).length === 1) finish(s, s.score + 500); else if (!pegJumps(s, false).length) s.status = 'lost';
  }, function (s) { return desc(s, 'Nhảy qua một quân để bỏ quân đó. Mục tiêu chỉ còn một quân ở bất kỳ ô hợp lệ. Có thể hoàn tác.', 7, s.board.map(function (v, i) { return cell(i, v < 0 ? '' : v ? '●' : '○', 'Ô ' + (i + 1) + ': ' + (v < 0 ? 'ngoài bàn' : v ? 'có quân' : 'trống'), v < 0 || s.status !== 'playing', s.anchor === i); })); });

  function queenConflicts(board, i) { return board.some(function (v, j) { return v && j !== i && (j % 6 === i % 6 || Math.floor(j / 6) === Math.floor(i / 6) || Math.abs(j % 6 - i % 6) === Math.abs(Math.floor(j / 6) - Math.floor(i / 6))); }); }
  attach('n-queens', function (s) { s.columns = 6; s.board = Array(36).fill(0); }, function (s, a, before) {
    if (a.type !== 'cell' || !indexOK(a.index, 36)) return; remember(s, before); s.selected = a.index;
    var on = s.board[a.index]; for (var i = Math.floor(a.index / 6) * 6; i < Math.floor(a.index / 6) * 6 + 6; i++) s.board[i] = 0;
    s.board[a.index] = on ? 0 : 1; s.moves++; var queens = s.board.filter(Boolean).length, conflicts = s.board.filter(function (v, i) { return v && queenConflicts(s.board, i); }).length; s.score = Math.max(0, queens - conflicts) * 100;
    if (queens === 6 && !conflicts) finish(s, 1200);
  }, function (s) { return desc(s, 'Đặt 6 hậu: không chung hàng, cột hoặc đường chéo. Bấm lại để bỏ; mỗi hàng chỉ có một hậu.', 6, s.board.map(function (v, i) { return cell(i, v ? queenConflicts(s.board, i) ? '♛!' : '♛' : '·', 'Hàng ' + (Math.floor(i / 6) + 1) + ', cột ' + (i % 6 + 1) + (v ? queenConflicts(s.board, i) ? ': hậu đang xung đột' : ': hậu an toàn' : ': trống'), s.status !== 'playing', v); })); });

  function runs(values) { var result = [], count = 0; values.concat(0).forEach(function (v) { if (v === 1) count++; else if (count) { result.push(count); count = 0; } }); return result.length ? result : [0]; }
  function nonogramClues(board) { return { rows: Array.from({ length: 5 }, function (_, y) { return runs(board.slice(y * 5, y * 5 + 5)); }), columns: Array.from({ length: 5 }, function (_, x) { return runs(Array.from({ length: 5 }, function (_, y) { return board[y * 5 + x]; })); }) }; }
  attach('nonogram', function (s) { s.columns = 5; s.target = Array.from({ length: 25 }, function () { return rand(s) < .55 ? 1 : 0; }); s.target[0] = 1; s.target[24] = 0; s.clues = nonogramClues(s.target); s.board = Array(25).fill(0); }, function (s, a, before) {
    if (a.type !== 'cell' || !indexOK(a.index, 25)) return; remember(s, before); s.selected = a.index; s.board[a.index] = a.alternate ? s.board[a.index] === 2 ? 0 : 2 : s.board[a.index] === 1 ? 0 : 1; s.moves++;
    var current = nonogramClues(s.board); if (JSON.stringify(current) === JSON.stringify(s.clues)) finish(s, 1500);
  }, function (s) { return desc(s, 'Tô các đoạn ô liên tiếp theo gợi ý; giữa hai đoạn phải có ô trống. Chuột phải đánh dấu ×. Hàng: ' + s.clues.rows.map(function (a) { return a.join('-'); }).join(' / ') + '. Cột: ' + s.clues.columns.map(function (a) { return a.join('-'); }).join(' / ') + '.', 5, s.board.map(function (v, i) { return cell(i, v === 1 ? '■' : v === 2 ? '×' : '·', 'Hàng ' + (Math.floor(i / 5) + 1) + ', cột ' + (i % 5 + 1) + ': ' + (v === 1 ? 'đã tô' : v === 2 ? 'đánh dấu trống' : 'chưa đánh dấu'), s.status !== 'playing', v === 1); })); });

  attach('towers-hanoi', function (s) { s.columns = 3; s.cellCount = 3; s.count = s.difficulty === 'easy' ? 3 : s.difficulty === 'hard' ? 5 : 4; s.towers = [Array.from({ length: s.count }, function (_, i) { return s.count - i; }), [], []]; s.anchor = -1; }, function (s, a, before) {
    if (a.type !== 'cell' || !indexOK(a.index, 3)) return; s.selected = a.index;
    if (s.anchor < 0) { if (s.towers[a.index].length) s.anchor = a.index; else s.message = 'Trụ trống, hãy chọn trụ có đĩa.'; return; }
    if (s.anchor === a.index) { s.anchor = -1; return; }
    var from = s.towers[s.anchor], to = s.towers[a.index], disk = from[from.length - 1];
    if (to.length && to[to.length - 1] < disk) { s.message = 'Không đặt đĩa lớn lên đĩa nhỏ.'; return; }
    remember(s, before); to.push(from.pop()); s.anchor = -1; s.moves++; s.message = ''; if (s.towers[2].length === s.count) finish(s, Math.max(100, 2000 - (s.moves - (Math.pow(2, s.count) - 1)) * 20));
  }, function (s) { return desc(s, 'Chuyển toàn bộ ' + s.count + ' đĩa từ trụ A sang C. Chọn trụ lấy rồi trụ đặt; số nhỏ là đĩa nhỏ. ' + s.moves + ' bước; tối ưu ' + (Math.pow(2, s.count) - 1) + '.', 3, s.towers.map(function (tower, i) { return cell(i, String.fromCharCode(65 + i) + ': ' + (tower.slice().reverse().join(' ') || '·'), 'Trụ ' + String.fromCharCode(65 + i) + ', từ trên xuống: ' + (tower.slice().reverse().join(', ') || 'trống'), s.status !== 'playing', s.anchor === i); })); });

  attach('maze-path', function (s) {
    s.columns = 9; s.board = Array(81).fill(1); s.player = 10; s.exit = 70; var pending = [10]; s.board[10] = 0;
    while (pending.length) { var at = pending[pending.length - 1], choices = shuffle([0, 1, 2, 3], s).map(function (d) { var mid = neighbor(at, d, 9, 9), to = mid >= 0 ? neighbor(mid, d, 9, 9) : -1; return { mid: mid, to: to }; }).filter(function (m) { return m.to >= 0 && m.to % 9 > 0 && m.to % 9 < 8 && Math.floor(m.to / 9) > 0 && Math.floor(m.to / 9) < 8 && s.board[m.to]; });
      if (choices.length) { var m = choices[0]; s.board[m.mid] = s.board[m.to] = 0; pending.push(m.to); } else pending.pop();
    } s.visited = [10]; s.selected = 10;
  }, function (s, a, before) {
    var d = direction(a.type), n = d >= 0 ? neighbor(s.player, d, 9, 9) : a.type === 'cell' ? a.index : -1;
    if (!indexOK(n, 81) || s.board[n] || Math.abs(n % 9 - s.player % 9) + Math.abs(Math.floor(n / 9) - Math.floor(s.player / 9)) !== 1) return;
    remember(s, before); s.player = n; s.selected = n; s.moves++; if (!s.visited.includes(n)) s.visited.push(n); if (n === s.exit) finish(s, Math.max(100, 2000 - s.moves * 10));
  }, function (s) { return desc(s, 'Tìm đường từ ● đến ★. Mũi tên hoặc bấm ô trống liền kề; không xuyên tường.', 9, s.board.map(function (v, i) { return cell(i, i === s.player ? '●' : i === s.exit ? '★' : v ? '▧' : s.visited.includes(i) ? '·' : '', 'Ô ' + (i + 1) + ': ' + (i === s.player ? 'bạn đang ở đây' : i === s.exit ? 'lối ra' : v ? 'tường' : 'đường đi'), s.status !== 'playing' || !!v, i === s.player); })); });

  function lineWinner(board, columns, rows, need) { for (var i = 0; i < board.length; i++) if (board[i]) for (var d = 0; d < 4; d++) { var delta = [[1, 0], [0, 1], [1, 1], [-1, 1]][d], count = 1; for (var k = 1; k < need; k++) { var x = i % columns + delta[0] * k, y = Math.floor(i / columns) + delta[1] * k; if (x >= 0 && x < columns && y >= 0 && y < rows && board[y * columns + x] === board[i]) count++; else break; } if (count === need) return board[i]; } return 0; }
  function outcome(s, winner) { if (winner) { s.result = winner === 1 ? 'player' : 'computer'; s.status = winner === 1 ? 'won' : 'lost'; s.score = winner === 1 ? 1000 : 0; return true; } if (s.board.every(Boolean)) { s.status = 'lost'; s.result = 'draw'; s.message = 'Ván hòa: không còn ô trống và không bên nào thắng.'; return true; } return false; }
  function drop(board, column, value) { for (var row = 5; row >= 0; row--) if (!board[row * 7 + column]) { board[row * 7 + column] = value; return row * 7 + column; } return -1; }
  attach('connect-four', function (s) { s.columns = 7; s.board = Array(42).fill(0); s.result = ''; }, function (s, a, before) {
    if (a.type !== 'cell' || !indexOK(a.index, 42)) return; var column = a.index % 7; if (s.board[column]) return;
    remember(s, before); drop(s.board, column, 1); s.moves++; s.selected = a.index; if (outcome(s, lineWinner(s.board, 7, 6, 4))) return;
    var choices = [3, 2, 4, 1, 5, 0, 6].filter(function (c) { return !s.board[c]; }), chosen = choices[0];
    for (var player = 2; player >= 1; player--) { var winning = choices.find(function (c) { var b = s.board.slice(); drop(b, c, player); return lineWinner(b, 7, 6, 4) === player; }); if (winning !== undefined) { chosen = winning; break; } }
    drop(s.board, chosen, 2); outcome(s, lineWinner(s.board, 7, 6, 4));
  }, function (s) { return desc(s, 'Bạn là ●, máy cục bộ là ○. Chọn một cột; quân rơi xuống ô thấp nhất. Nối bốn quân theo hàng, cột hoặc chéo. ' + (s.result === 'draw' ? 'Kết quả hòa.' : s.result === 'computer' ? 'Máy đã nối bốn quân.' : s.status === 'won' ? 'Bạn đã nối bốn quân!' : ''), 7, s.board.map(function (v, i) { return cell(i, v === 1 ? '●' : v === 2 ? '○' : '·', 'Cột ' + (i % 7 + 1) + ', hàng ' + (Math.floor(i / 7) + 1) + ': ' + (v === 1 ? 'quân của bạn' : v === 2 ? 'quân máy' : 'trống'), s.status !== 'playing' || !!s.board[i % 7], v === 1); })); });

  function ticValue(board, player) { var winner = lineWinner(board, 3, 3, 3); if (winner) return winner === 2 ? 10 : -10; if (board.every(Boolean)) return 0; var values = []; for (var i = 0; i < 9; i++) if (!board[i]) { board[i] = player; values.push(ticValue(board, 3 - player)); board[i] = 0; } return player === 2 ? Math.max.apply(Math, values) : Math.min.apply(Math, values); }
  attach('tic-tac-toe', function (s) { s.columns = 3; s.board = Array(9).fill(0); s.result = ''; }, function (s, a, before) {
    if (a.type !== 'cell' || !indexOK(a.index, 9) || s.board[a.index]) return; remember(s, before); s.board[a.index] = 1; s.moves++; s.selected = a.index;
    if (outcome(s, lineWinner(s.board, 3, 3, 3))) return;
    var best = -Infinity, chosen = -1; [4, 0, 2, 6, 8, 1, 3, 5, 7].forEach(function (i) { if (!s.board[i]) { s.board[i] = 2; var value = ticValue(s.board, 1); s.board[i] = 0; if (value > best) { best = value; chosen = i; } } });
    s.board[chosen] = 2; outcome(s, lineWinner(s.board, 3, 3, 3));
  }, function (s) { return desc(s, 'Cờ ca-rô 3×3. Bạn là X, máy tính cục bộ là O. Nối ba quân để thắng; máy tìm nước bằng minimax. ' + (s.result === 'draw' ? 'Hai bên hòa.' : s.result === 'computer' ? 'Máy thắng ván này.' : s.status === 'won' ? 'Bạn đã thắng.' : ''), 3, s.board.map(function (v, i) { return cell(i, v === 1 ? 'X' : v === 2 ? 'O' : '·', 'Ô ' + (i + 1) + ': ' + (v === 1 ? 'X của bạn' : v === 2 ? 'O của máy' : 'trống'), !!v || s.status !== 'playing', v === 1); })); });

  var ALL_DIRS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  function reversiFlips(board, index, player) { if (board[index]) return []; var all = []; ALL_DIRS.forEach(function (d) { var x = index % 6 + d[0], y = Math.floor(index / 6) + d[1], captured = []; while (x >= 0 && x < 6 && y >= 0 && y < 6 && board[y * 6 + x] === 3 - player) { captured.push(y * 6 + x); x += d[0]; y += d[1]; } if (captured.length && x >= 0 && x < 6 && y >= 0 && y < 6 && board[y * 6 + x] === player) all.push.apply(all, captured); }); return all; }
  function reversiMoves(board, player) { return board.flatMap(function (_, i) { var flips = reversiFlips(board, i, player); return flips.length ? [{ index: i, flips: flips }] : []; }); }
  function reversiPlace(board, move, player) { board[move.index] = player; move.flips.forEach(function (i) { board[i] = player; }); }
  attach('reversi-mini', function (s) { s.columns = 6; s.board = Array(36).fill(0); s.board[14] = s.board[21] = 2; s.board[15] = s.board[20] = 1; s.result = ''; }, function (s, a, before) {
    if (a.type !== 'cell' || !indexOK(a.index, 36)) return; var flips = reversiFlips(s.board, a.index, 1); if (!flips.length) return;
    remember(s, before); reversiPlace(s.board, { index: a.index, flips: flips }, 1); s.moves++; s.selected = a.index; s.message = '';
    var safety = 40;
    while (safety--) { var options = reversiMoves(s.board, 2); if (options.length) { options.sort(function (a, b) { return (b.flips.length + ([0, 5, 30, 35].includes(b.index) ? 50 : 0)) - (a.flips.length + ([0, 5, 30, 35].includes(a.index) ? 50 : 0)); }); reversiPlace(s.board, options[0], 2); }
      if (reversiMoves(s.board, 1).length) { if (!options.length) s.message = 'Máy không có nước hợp lệ và bỏ lượt.'; break; }
      if (!reversiMoves(s.board, 2).length) { var yours = s.board.filter(function (v) { return v === 1; }).length, theirs = s.board.filter(function (v) { return v === 2; }).length; s.status = yours > theirs ? 'won' : 'lost'; s.result = yours === theirs ? 'draw' : yours > theirs ? 'player' : 'computer'; break; }
      s.message = 'Bạn không có nước hợp lệ nên máy đi tiếp.';
    } s.score = s.board.filter(function (v) { return v === 1; }).length * 25;
  }, function (s) { var legal = reversiMoves(s.board, 1); return desc(s, 'Bạn là ●, máy cục bộ là ○. Chọn ô kẹp quân đối thủ giữa hai quân của bạn để lật; không có nước thì bỏ lượt. Hết nước cả hai bên: nhiều quân hơn thắng. ' + (s.result === 'draw' ? 'Kết quả hòa.' : '') + ' Quân bạn ' + s.board.filter(function (v) { return v === 1; }).length + ', quân máy ' + s.board.filter(function (v) { return v === 2; }).length + '.', 6, s.board.map(function (v, i) { var valid = legal.some(function (m) { return m.index === i; }); return cell(i, v === 1 ? '●' : v === 2 ? '○' : valid ? '+' : '·', 'Ô ' + (i + 1) + ': ' + (v === 1 ? 'quân bạn' : v === 2 ? 'quân máy' : valid ? 'có thể đặt quân' : 'không có nước'), !valid || s.status !== 'playing', v === 1); })); });

  attach('word-search', function (s) {
    s.columns = 8; s.board = Array.from({ length: 64 }, function () { return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(rand(s) * 26)]; }); s.words = []; s.found = []; s.foundPaths = {}; s.anchor = -1;
    var rows = shuffle([0, 1, 2, 3, 4, 5, 6, 7], s);
    ['SAO', 'TRANG', 'NANG', 'MAY', 'BIEN', 'GIO'].forEach(function (word, n) { var reverse = rand(s) < .5, start = Math.floor(rand(s) * (9 - word.length)), path = []; for (var k = 0; k < word.length; k++) { var i = rows[n] * 8 + start + (reverse ? word.length - 1 - k : k); s.board[i] = word[k]; path.push(i); } s.words.push({ word: word, path: path }); });
  }, function (s, a, before) {
    if (a.type !== 'cell' || !indexOK(a.index, 64)) return; s.selected = a.index; if (s.anchor < 0) { s.anchor = a.index; return; }
    var dx = a.index % 8 - s.anchor % 8, dy = Math.floor(a.index / 8) - Math.floor(s.anchor / 8), length = Math.max(Math.abs(dx), Math.abs(dy));
    if (!length || dx && dy && Math.abs(dx) !== Math.abs(dy)) { s.anchor = -1; s.message = 'Chọn hai đầu một hàng, cột hoặc đường chéo.'; return; }
    var path = Array.from({ length: length + 1 }, function (_, k) { return s.anchor + k * Math.sign(dx) + k * Math.sign(dy) * 8; }), word = path.map(function (i) { return s.board[i]; }).join(''), target = s.words.find(function (w) { return w.word === word || w.word === word.split('').reverse().join(''); });
    if (target && !s.found.includes(target.word)) { remember(s, before); s.found.push(target.word); s.foundPaths[target.word] = path; s.moves++; s.score = s.found.length * 100; s.message = 'Đã tìm thấy ' + target.word + '.'; if (s.found.length === s.words.length) finish(s, 1200); } else s.message = 'Đoạn đã chọn chưa phải từ cần tìm mới.'; s.anchor = -1;
  }, function (s) { var foundCells = Object.values(s.foundPaths).flat(); return desc(s, 'Tìm từ không dấu; bấm chữ đầu và chữ cuối, có thể chọn ngược. Cần tìm: ' + s.words.map(function (w) { return (s.found.includes(w.word) ? '✓' : '') + w.word; }).join(', ') + '.', 8, s.board.map(function (v, i) { return cell(i, v, 'Hàng ' + (Math.floor(i / 8) + 1) + ', cột ' + (i % 8 + 1) + ': chữ ' + v + (foundCells.includes(i) ? ', thuộc từ đã tìm' : ''), s.status !== 'playing', s.anchor === i || foundCells.includes(i)); })); });

  attach('number-order', function (s) { s.columns = 4; s.board = shuffle(Array.from({ length: 16 }, function (_, i) { return i + 1; }), s); s.next = 1; s.lives = 3; }, function (s, a, before) {
    if (a.type !== 'cell' || !indexOK(a.index, 16) || s.board[a.index] < s.next) return; remember(s, before); s.selected = a.index; s.moves++;
    if (s.board[a.index] === s.next) { s.next++; s.score += 50; if (s.next === 17) finish(s, s.score + s.lives * 100); } else { s.lives--; s.message = 'Hãy tìm số ' + s.next + ', không bỏ số.'; if (!s.lives) s.status = 'lost'; }
  }, function (s) { return desc(s, 'Bấm lần lượt 1 → 16. Cần tìm ' + Math.min(s.next, 16) + '; còn ' + s.lives + ' lượt sai. Không giới hạn thời gian.', 4, s.board.map(function (v, i) { return cell(i, v, 'Số ' + v + (v < s.next ? ', đã chọn đúng' : ''), s.status !== 'playing' || v < s.next, v < s.next); })); });

  function sudokuAllowed(board, at, value) { var row = Math.floor(at / 4), col = at % 4; return !board.some(function (n, i) { return i !== at && n === value && (Math.floor(i / 4) === row || i % 4 === col || Math.floor(Math.floor(i / 4) / 2) === Math.floor(row / 2) && Math.floor(i % 4 / 2) === Math.floor(col / 2)); }); }
  function sudokuCount(board, limit) { var at = board.indexOf(0); if (at < 0) return 1; var count = 0; for (var n = 1; n <= 4; n++) if (sudokuAllowed(board, at, n)) { board[at] = n; count += sudokuCount(board, limit - count); board[at] = 0; if (count >= limit) return count; } return count; }
  attach('sudoku-mini', function (s) {
    s.columns = 4; var digits = shuffle([1, 2, 3, 4], s), rows = shuffle([0, 1], s).flatMap(function (band) { return shuffle([band * 2, band * 2 + 1], s); }), cols = shuffle([0, 1], s).flatMap(function (stack) { return shuffle([stack * 2, stack * 2 + 1], s); });
    s.solution = rows.flatMap(function (r) { return cols.map(function (c) { return digits[(r * 2 + Math.floor(r / 2) + c) % 4]; }); }); s.board = s.solution.slice();
    shuffle(Array.from({ length: 16 }, function (_, i) { return i; }), s).forEach(function (i) { if (s.board.filter(Boolean).length <= 7) return; var value = s.board[i]; s.board[i] = 0; if (sudokuCount(s.board, 2) !== 1) s.board[i] = value; }); s.givens = s.board.map(Boolean);
  }, function (s, a, before) {
    if (a.type !== 'cell' || !indexOK(a.index, 16) || s.givens[a.index]) return; remember(s, before); s.selected = a.index; s.board[a.index] = a.alternate ? 0 : (s.board[a.index] + 1) % 5; s.moves++;
    if (s.board.every(function (v, i) { return v && sudokuAllowed(s.board, i, v); })) finish(s, 1200);
  }, function (s) { return desc(s, 'Điền 1–4: không trùng trong hàng, cột hoặc khối 2×2. Bấm ô để đổi ·→1→2→3→4; chuột phải xóa. Dấu ! là số xung đột.', 4, s.board.map(function (v, i) { var invalid = v && !sudokuAllowed(s.board, i, v); return cell(i, (v || '·') + (invalid ? '!' : ''), 'Hàng ' + (Math.floor(i / 4) + 1) + ', cột ' + (i % 4 + 1) + ': ' + (v || 'trống') + (s.givens[i] ? ', số cho sẵn' : invalid ? ', xung đột' : ', có thể sửa'), s.givens[i] || s.status !== 'playing', s.givens[i]); })); });

  var COLORS = ['Tím', 'Lam', 'Lục', 'Vàng', 'Hồng'], PALETTE = ['#8b5ed1', '#3476c8', '#208563', '#ffd166', '#b94386', '#d56c41'];
  function floodRegion(board) { var found = new Set([0]), pending = [0], color = board[0]; while (pending.length) { var i = pending.pop(); DIRS.forEach(function (_, d) { var n = neighbor(i, d, 8, 8); if (n >= 0 && !found.has(n) && board[n] === color) { found.add(n); pending.push(n); } }); } return Array.from(found); }
  function floodApply(board, color) { floodRegion(board).forEach(function (i) { board[i] = color; }); }
  attach('color-flood', function (s) {
    s.columns = 8; s.board = Array.from({ length: 64 }, function () { return Math.floor(rand(s) * 5); }); s.solution = []; var working = s.board.slice();
    while (floodRegion(working).length < 64 && s.solution.length < 64) { var best = -1, growth = -1; for (var color = 0; color < 5; color++) if (color !== working[0]) { var candidate = working.slice(); floodApply(candidate, color); var size = floodRegion(candidate).length; if (size > growth) { growth = size; best = color; } } floodApply(working, best); s.solution.push(best); } s.limit = s.solution.length + (s.difficulty === 'hard' ? 0 : s.difficulty === 'easy' ? 8 : 4);
  }, function (s, a, before) {
    if (a.type !== 'cell' || !indexOK(a.index, 64)) return; var color = s.board[a.index]; if (color === s.board[0]) return; remember(s, before); s.selected = a.index; floodApply(s.board, color); s.moves++; s.score = floodRegion(s.board).length * 10;
    if (floodRegion(s.board).length === 64) finish(s, 1000 + Math.max(0, s.limit - s.moves) * 20); else if (s.moves >= s.limit) s.status = 'lost';
  }, function (s) { var region = floodRegion(s.board); return desc(s, 'Từ góc trên trái, chọn màu bất kỳ trên bàn để lan vùng liên thông. Màu: 1 Tím, 2 Lam, 3 Lục, 4 Vàng, 5 Hồng. Phủ một màu toàn bàn trong ' + s.limit + ' lượt. Đã dùng ' + s.moves + '; vùng hiện tại ' + region.length + '/64 ô.', 8, s.board.map(function (v, i) { return Object.assign(cell(i, v + 1, 'Ô ' + (i + 1) + ', màu ' + COLORS[v] + ', ký hiệu ' + (v + 1) + (region.includes(i) ? ', thuộc vùng đã phủ' : ''), s.status !== 'playing', region.includes(i)), { color: v === 3 || v === 5 ? '#111827' : '#ffffff', background: PALETTE[v] }); })); });

  function rotate(mask) { return (mask << 1 & 15) | (mask >> 3 & 1); }
  function connectedPipes(board) { var found = new Set([0]), queue = [0]; while (queue.length) { var i = queue.pop(); for (var d = 0; d < 4; d++) if (board[i] & 1 << d) { var n = neighbor(i, d, 5, 5); if (n >= 0 && board[n] & 1 << (d + 2) % 4 && !found.has(n)) { found.add(n); queue.push(n); } } } return Array.from(found); }
  var PIPE_GLYPHS = { 1: '╵', 2: '╶', 4: '╷', 8: '╴', 5: '│', 10: '─', 3: '└', 6: '┌', 12: '┐', 9: '┘' };
  attach('pipe-link', function (s) {
    s.columns = 5; s.solution = Array(25).fill(0); var path = [];
    for (var y = 0; y < 5; y++) for (var x = 0; x < 5; x++) path.push(y * 5 + (y % 2 ? 4 - x : x));
    path.forEach(function (at, k) { [path[k - 1], path[k + 1]].forEach(function (other) { if (other === undefined) return; var dx = other % 5 - at % 5, dy = Math.floor(other / 5) - Math.floor(at / 5), d = dx === 1 ? 1 : dx === -1 ? 3 : dy === 1 ? 2 : 0; s.solution[at] |= 1 << d; }); });
    s.board = s.solution.map(function (mask) { var count = Math.floor(rand(s) * 4); while (count--) mask = rotate(mask); return mask; }); if (connectedPipes(s.board).length === 25) s.board[0] = rotate(s.board[0]);
  }, function (s, a, before) {
    if (a.type !== 'cell' || !indexOK(a.index, 25)) return; remember(s, before); s.selected = a.index; s.board[a.index] = rotate(s.board[a.index]); s.moves++; s.score = connectedPipes(s.board).length * 25;
    if (connectedPipes(s.board).length === 25) finish(s, 1500);
  }, function (s) { var region = connectedPipes(s.board); return desc(s, 'Bấm để xoay ống 90° theo chiều kim đồng hồ. Nối nguồn ô 1 tới đích ô 25 qua đủ 25 ống; hai đầu cạnh nhau phải khớp hướng. Đã nối ' + region.length + '/25.', 5, s.board.map(function (v, i) { return cell(i, PIPE_GLYPHS[v], 'Ống ' + (i + 1) + (i === 0 ? ', nguồn' : i === 24 ? ', đích' : '') + ': nối hướng ' + ['lên', 'phải', 'xuống', 'trái'].filter(function (_, d) { return v & 1 << d; }).join(', '), s.status !== 'playing', region.includes(i)); })); });

  function codeFeedback(secret, guess) { var exact = 0, a = [], b = []; for (var i = 0; i < 4; i++) if (secret[i] === guess[i]) exact++; else { a.push(secret[i]); b.push(guess[i]); } var near = 0; b.forEach(function (v) { var at = a.indexOf(v); if (at >= 0) { near++; a.splice(at, 1); } }); return { exact: exact, near: near }; }
  var CODE_NAMES = ['Tím', 'Lam', 'Lục', 'Vàng', 'Hồng', 'Cam'];
  attach('code-breaker', function (s) { s.columns = 4; s.cellCount = 6; s.secret = Array.from({ length: 4 }, function () { return Math.floor(rand(s) * 6); }); s.guess = [0, 0, 0, 0]; s.attempts = []; s.limit = 8; }, function (s, a, before) {
    if (a.type !== 'cell' || !indexOK(a.index, 6)) return; s.selected = a.index;
    if (a.index < 4) { s.guess[a.index] = (s.guess[a.index] + (a.alternate ? 5 : 1)) % 6; return; }
    if (a.index === 5) { s.guess = [0, 0, 0, 0]; return; }
    remember(s, before); var feedback = codeFeedback(s.secret, s.guess); s.attempts.push({ guess: s.guess.slice(), exact: feedback.exact, near: feedback.near }); s.moves++;
    if (feedback.exact === 4) finish(s, (9 - s.attempts.length) * 150); else if (s.attempts.length >= s.limit) { s.status = 'lost'; s.message = 'Mật mã là ' + s.secret.map(function (n) { return CODE_NAMES[n]; }).join(' / ') + '.'; }
  }, function (s) { return desc(s, 'Đoán 4 màu trong 8 lượt, màu được phép lặp. Bấm từng vị trí để đổi qua 6 màu, rồi Chốt. Đúng = đúng màu và vị trí; lệch = đúng màu sai vị trí, không đếm trùng. ' + s.attempts.map(function (a, i) { return 'Lượt ' + (i + 1) + ': ' + a.guess.map(function (n) { return CODE_NAMES[n]; }).join('-') + ' → ' + a.exact + ' đúng, ' + a.near + ' lệch'; }).join('; '), 4, s.guess.map(function (v, i) { return Object.assign(cell(i, CODE_NAMES[v], 'Vị trí ' + (i + 1) + ': ' + CODE_NAMES[v] + ', bấm để đổi màu', s.status !== 'playing', false), { color: v === 3 || v === 5 ? '#111827' : '#ffffff', background: PALETTE[v] }); }).concat([cell(4, 'Chốt', 'Chốt lần đoán, còn ' + (8 - s.attempts.length) + ' lượt', s.status !== 'playing', false), cell(5, 'Xóa', 'Đặt bốn vị trí về màu Tím', s.status !== 'playing', false)])); });

  function knightLegal(from, to) { var dx = Math.abs(from % 5 - to % 5), dy = Math.abs(Math.floor(from / 5) - Math.floor(to / 5)); return dx * dy === 2; }
  attach('knights-tour', function (s) {
    s.columns = 5; var turn = Math.floor(rand(s) * 4), mirror = rand(s) < .5;
    s.solution = [0, 7, 4, 13, 24, 17, 20, 11, 2, 5, 16, 23, 14, 3, 6, 15, 22, 19, 8, 1, 10, 21, 18, 9, 12].map(function (i) { var x = i % 5, y = Math.floor(i / 5); if (mirror) x = 4 - x; for (var k = 0; k < turn; k++) { var t = x; x = 4 - y; y = t; } return y * 5 + x; });
    s.board = Array(25).fill(0); s.player = s.solution[0]; s.board[s.player] = 1; s.visited = 1; s.selected = s.player;
  }, function (s, a, before) {
    if (a.type !== 'cell' || !indexOK(a.index, 25) || s.board[a.index] || !knightLegal(s.player, a.index)) return; remember(s, before); s.player = s.selected = a.index; s.visited++; s.board[a.index] = s.visited; s.moves++; s.score = s.visited * 50;
    if (s.visited === 25) finish(s, 2000); else if (!s.board.some(function (v, i) { return !v && knightLegal(s.player, i); })) s.status = 'lost';
  }, function (s) { return desc(s, 'Mã đi chữ L: hai ô theo một trục và một ô theo trục kia. Đi qua đủ 25 ô, không lặp ô. Dấu + là nước hợp lệ; có hoàn tác. Đã đi ' + s.visited + '/25.', 5, s.board.map(function (v, i) { var legal = !v && knightLegal(s.player, i); return cell(i, i === s.player ? '♞' : v ? v : legal ? '+' : '·', 'Ô ' + (i + 1) + ': ' + (i === s.player ? 'vị trí mã' : v ? 'đã đi ở bước ' + v : legal ? 'có thể tới' : 'chưa đi, không tới trực tiếp được'), !legal || s.status !== 'playing', i === s.player); })); });

  return { games: games };
});
