(function (scope, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (scope) scope.HHAllGamePuzzles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Original, deterministic rules and procedural graphics. No remote assets or services.
  function initialSeed(value) {
    var text = String(value == null ? 1 : value), seed = 2166136261;
    for (var i = 0; i < text.length; i++) { seed ^= text.charCodeAt(i); seed = Math.imul(seed, 16777619); }
    return seed >>> 0 || 1;
  }
  function random(state) {
    var x = state.rng >>> 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    state.rng = x >>> 0 || 1;
    return state.rng / 4294967296;
  }
  function shuffled(values, state) {
    var result = values.slice();
    for (var i = result.length - 1; i > 0; i--) {
      var j = Math.floor(random(state) * (i + 1)), item = result[i];
      result[i] = result[j]; result[j] = item;
    }
    return result;
  }
  function finiteTime(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }
  function validIndex(index, length) { return Number.isInteger(index) && index >= 0 && index < length; }
  function copyCells(cells) { return cells.map(function (cell) { return Object.assign({}, cell); }); }
  function directions(type) { return type === 'left' || type === 'right' || type === 'up' || type === 'down'; }
  function moveSelection(index, columns, length, type) {
    var row = Math.floor(index / columns), column = index % columns, rows = Math.ceil(length / columns);
    if (type === 'left') column = Math.max(0, column - 1);
    if (type === 'right') column = Math.min(columns - 1, column + 1);
    if (type === 'up') row = Math.max(0, row - 1);
    if (type === 'down') row = Math.min(rows - 1, row + 1);
    return Math.min(length - 1, row * columns + column);
  }
  function background(ctx, width, height, options, state) {
    if (options && typeof options.paintScene === 'function') { options.paintScene(ctx, state.id, state); return; }
    ctx.fillStyle = '#0b1026'; ctx.fillRect(0, 0, width, height);
  }
  function tile(ctx, x, y, width, height, color) {
    var inset = Math.max(2, width * .035), radius = Math.min(14, width * .12);
    ctx.save(); ctx.shadowColor = '#030615'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 3;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x + inset, y + inset, width - inset * 2, height - inset * 2, radius);
    else ctx.rect(x + inset, y + inset, width - inset * 2, height - inset * 2);
    ctx.fillStyle = color; ctx.fill(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = '#ffffff30'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + inset + radius, y + inset + 2); ctx.lineTo(x + width - inset - radius, y + inset + 2); ctx.strokeStyle = '#ffffff38'; ctx.stroke();
    ctx.restore();
  }
  function text(ctx, value, x, y, size, color) {
    ctx.fillStyle = color || '#f4f7ff'; ctx.font = '700 ' + size + 'px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(value), x, y);
  }
  function boardLayout(width, height, columns, rows) {
    var size = Math.min((width - 24) / columns, (height - 24) / rows);
    return { size: size, x: (width - columns * size) / 2, y: (height - rows * size) / 2 };
  }

  function mergeSpawn(state) {
    var empty = [];
    state.board.forEach(function (value, index) { if (!value) empty.push(index); });
    if (empty.length) state.board[empty[Math.floor(random(state) * empty.length)]] = random(state) < 0.9 ? 2 : 4;
  }
  function mergeCanMove(board) {
    for (var i = 0; i < board.length; i++) {
      if (!board[i]) return true;
      if (i % 4 < 3 && board[i] === board[i + 1]) return true;
      if (i < 12 && board[i] === board[i + 4]) return true;
    }
    return false;
  }
  function mergeSnapshot(state) {
    return { board: state.board.slice(), rng: state.rng, score: state.score, moves: state.moves, level: state.level, status: state.status, keepPlaying: state.keepPlaying };
  }
  var merge = {
    id: 'merge',
    create: function (options) {
      options = options || {};
      var state = { version: 1, id: 'merge', status: 'playing', score: 0, level: 1, rng: initialSeed(options.seed), board: Array(16).fill(0), moves: 0, history: [], keepPlaying: false };
      mergeSpawn(state); mergeSpawn(state);
      return state;
    },
    step: function (state, action) {
      action = action || {};
      var next = Object.assign({}, state, { board: state.board.slice(), history: state.history.slice() });
      if (action.type === 'undo') {
        var previous = next.history.pop();
        return previous ? Object.assign(next, previous, { board: previous.board.slice(), history: next.history }) : next;
      }
      if (action.type === 'continue' && state.status === 'won') {
        next.keepPlaying = true; next.status = mergeCanMove(next.board) ? 'playing' : 'lost'; return next;
      }
      if (state.status !== 'playing' || !directions(action.type)) return next;
      var gain = 0, output = state.board.slice();
      for (var line = 0; line < 4; line++) {
        var indices = [];
        for (var position = 0; position < 4; position++) {
          indices.push(action.type === 'left' ? line * 4 + position : action.type === 'right' ? line * 4 + 3 - position : action.type === 'up' ? position * 4 + line : (3 - position) * 4 + line);
        }
        var values = indices.map(function (index) { return state.board[index]; }).filter(Boolean), merged = [];
        for (var v = 0; v < values.length; v++) {
          if (v + 1 < values.length && values[v] === values[v + 1]) { merged.push(values[v] * 2); gain += values[v] * 2; v++; }
          else merged.push(values[v]);
        }
        indices.forEach(function (index, offset) { output[index] = merged[offset] || 0; });
      }
      if (output.every(function (value, index) { return value === state.board[index]; })) {
        if (!mergeCanMove(output)) next.status = 'lost';
        return next;
      }
      next.history.push(mergeSnapshot(state));
      if (next.history.length > 50) next.history.shift();
      next.board = output; next.score += gain; next.moves++;
      mergeSpawn(next);
      var largest = Math.max.apply(Math, next.board);
      next.level = Math.max(1, Math.round(Math.log2(largest)) - 1);
      next.status = largest >= 2048 && !next.keepPlaying ? 'won' : mergeCanMove(next.board) ? 'playing' : 'lost';
      return next;
    },
    describe: function (state) {
      var message = state.status === 'won' ? 'Đã ghép được 2048! Bạn có thể tiếp tục hoặc hoàn tác.' : state.status === 'lost' ? 'Hết nước đi. Hoàn tác để thử hướng khác hoặc chơi lại.' : 'Dùng bốn phím mũi tên hoặc nút hướng để ghép các ô cùng số. Mỗi ô chỉ ghép một lần trong một lượt.';
      return { summary: message + ' Điểm ' + state.score + ', ' + state.moves + ' lượt. Mục tiêu 2048.', columns: 4, cells: state.board.map(function (value, index) { return { index: index, label: value ? String(value) : 'Trống', disabled: true, pressed: false }; }) };
    },
    draw: function (ctx, state, options) {
      options = options || {}; var width = options.width || 720, height = options.height || 480;
      ctx.save(); background(ctx, width, height, options, state); var layout = boardLayout(width, height, 4, 4);
      state.board.forEach(function (value, index) {
        var x = layout.x + index % 4 * layout.size, y = layout.y + Math.floor(index / 4) * layout.size;
        var hue = value ? (Math.log2(value) * 29 + 155) % 360 : 230;
        tile(ctx, x, y, layout.size, layout.size, value ? 'hsl(' + hue + ', 62%, 36%)' : '#19223f');
        if (value) { ctx.save(); ctx.shadowColor = '#050817'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 2; text(ctx, value, x + layout.size / 2, y + layout.size / 2, Math.max(14, layout.size * (value >= 1000 ? 0.27 : 0.36))); ctx.restore(); }
      }); ctx.restore();
    }
  };

  var MINE_LEVELS = { easy: { columns: 8, rows: 8, mines: 10 }, normal: { columns: 10, rows: 10, mines: 18 }, hard: { columns: 12, rows: 12, mines: 30 } };
  function neighbors(index, columns, rows) {
    var result = [], row = Math.floor(index / columns), column = index % columns;
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && row + dy >= 0 && row + dy < rows && column + dx >= 0 && column + dx < columns) result.push((row + dy) * columns + column + dx);
    }
    return result;
  }
  function placeMines(state, safeIndex) {
    var safe = new Set([safeIndex].concat(neighbors(safeIndex, state.columns, state.rows))), candidates = [];
    state.board.forEach(function (_, index) { if (!safe.has(index)) candidates.push(index); });
    shuffled(candidates, state).slice(0, state.mineCount).forEach(function (index) { state.board[index].mine = true; });
    state.board.forEach(function (cell, index) { cell.adjacent = neighbors(index, state.columns, state.rows).filter(function (neighbor) { return state.board[neighbor].mine; }).length; });
    state.minesPlaced = true;
  }
  function revealMines(state, start) {
    var pending = [start], visited = new Set();
    while (pending.length) {
      var index = pending.pop(), cell = state.board[index];
      if (visited.has(index) || cell.revealed || cell.flagged || cell.mine) continue;
      visited.add(index); cell.revealed = true; state.revealed++;
      if (!cell.adjacent) pending.push.apply(pending, neighbors(index, state.columns, state.rows));
    }
  }
  var mines = {
    id: 'mines',
    create: function (options) {
      options = options || {}; var difficulty = Object.prototype.hasOwnProperty.call(MINE_LEVELS, options.difficulty) ? options.difficulty : 'easy', preset = MINE_LEVELS[difficulty];
      return { version: 1, id: 'mines', status: 'playing', score: 0, level: 1, rng: initialSeed(options.seed), difficulty: difficulty, columns: preset.columns, rows: preset.rows, mineCount: preset.mines, minesPlaced: false, flags: 0, revealed: 0, moves: 0, selected: 0, board: Array.from({ length: preset.columns * preset.rows }, function () { return { mine: false, adjacent: 0, revealed: false, flagged: false }; }) };
    },
    step: function (state, action) {
      action = action || {}; var next = Object.assign({}, state);
      if (directions(action.type)) { next.selected = moveSelection(state.selected, state.columns, state.board.length, action.type); return next; }
      if (state.status !== 'playing' || (action.type !== 'cell' && action.type !== 'action')) return next;
      var index = action.type === 'action' ? state.selected : action.index;
      if (!validIndex(index, state.board.length)) return next;
      next.selected = index;
      if (state.board[index].revealed) return next;
      next.board = copyCells(state.board); var cell = next.board[index];
      if (action.alternate) {
        if (!cell.flagged && next.flags >= next.mineCount) return next;
        cell.flagged = !cell.flagged; next.flags += cell.flagged ? 1 : -1; return next;
      }
      if (cell.flagged) return next;
      if (!next.minesPlaced) placeMines(next, index);
      next.moves++;
      if (cell.mine) {
        next.status = 'lost'; next.exploded = index;
        next.board.forEach(function (item) { if (item.mine) item.revealed = true; });
        return next;
      }
      revealMines(next, index); next.score = next.revealed * 10;
      if (next.revealed === next.board.length - next.mineCount) {
        next.status = 'won'; next.flags = next.mineCount;
        next.board.forEach(function (item) { if (item.mine) item.flagged = true; });
      }
      return next;
    },
    describe: function (state) {
      var summary = state.status === 'won' ? 'Đã tìm hết ô an toàn!' : state.status === 'lost' ? 'Bạn chạm mìn. Các vị trí mìn đã được mở để xem lại.' : !state.minesPlaced ? 'Mở ô đầu tiên: ô đó và các ô xung quanh luôn an toàn.' : 'Số trên ô cho biết có bao nhiêu mìn trong tám ô xung quanh.';
      summary += ' ' + state.revealed + '/' + (state.board.length - state.mineCount) + ' ô an toàn, ' + state.flags + '/' + state.mineCount + ' cờ. Dùng chế độ Cắm cờ hoặc chuột phải để đánh dấu.';
      return { summary: summary, columns: state.columns, cells: state.board.map(function (cell, index) {
        return { index: index, label: cell.flagged ? '⚑' : cell.revealed ? cell.mine ? '✹' : cell.adjacent ? String(cell.adjacent) : '·' : '□', description: 'Hàng ' + (Math.floor(index / state.columns) + 1) + ', cột ' + (index % state.columns + 1) + ': ' + (cell.flagged ? 'đã cắm cờ' : cell.revealed ? cell.mine ? 'mìn' : cell.adjacent ? cell.adjacent + ' mìn xung quanh' : 'an toàn, không có mìn xung quanh' : 'chưa mở'), disabled: state.status !== 'playing' || cell.revealed, pressed: cell.flagged };
      }) };
    },
    draw: function (ctx, state, options) {
      options = options || {}; var width = options.width || 720, height = options.height || 480;
      ctx.save(); background(ctx, width, height, options, state); var layout = boardLayout(width, height, state.columns, state.rows);
      state.board.forEach(function (cell, index) {
        var x = layout.x + index % state.columns * layout.size, y = layout.y + Math.floor(index / state.columns) * layout.size;
        tile(ctx, x, y, layout.size, layout.size, cell.revealed ? cell.mine ? '#82364c' : '#142d32' : '#34466b');
        if (!cell.revealed && !cell.flagged) { ctx.beginPath(); ctx.moveTo(x + layout.size * .5, y + layout.size * .34); ctx.lineTo(x + layout.size * .65, y + layout.size * .5); ctx.lineTo(x + layout.size * .5, y + layout.size * .66); ctx.lineTo(x + layout.size * .35, y + layout.size * .5); ctx.closePath(); ctx.strokeStyle = '#bcdcff24'; ctx.lineWidth = 1; ctx.stroke(); }
        if (cell.flagged || cell.revealed && (cell.mine || cell.adjacent)) text(ctx, cell.flagged ? '⚑' : cell.mine ? '✹' : cell.adjacent, x + layout.size / 2, y + layout.size / 2, Math.max(12, layout.size * 0.5), cell.flagged ? '#ffda7a' : cell.adjacent > 2 ? '#f4bdcf' : '#b3f2ef');
        if (index === state.selected && state.status === 'playing') { ctx.strokeStyle = '#f8d87a'; ctx.lineWidth = 2; ctx.strokeRect(x + 3, y + 3, layout.size - 6, layout.size - 6); }
      }); ctx.restore();
    }
  };

  var MEMORY_FACES = ['☀', '☾', '★', '◆', '♥', '♣', '☁', '✿', '♪', '▲', '●', '✦'];
  var memory = {
    id: 'memory',
    create: function (options) {
      options = options || {}; var difficulty = options.difficulty === 'hard' ? 'hard' : options.difficulty === 'normal' ? 'normal' : 'easy', pairs = difficulty === 'hard' ? 12 : difficulty === 'normal' ? 8 : 6;
      var state = { version: 1, id: 'memory', status: 'playing', score: 0, level: 1, rng: initialSeed(options.seed), difficulty: difficulty, columns: difficulty === 'hard' ? 6 : 4, pairs: pairs, moves: 0, elapsed: 0, selected: 0, matchedPairs: 0, open: [], mismatchRemaining: 0 };
      var faces = []; for (var i = 0; i < pairs; i++) faces.push(i, i);
      state.board = shuffled(faces, state).map(function (face) { return { face: face, matched: false }; });
      return state;
    },
    step: function (state, action, dtSeconds) {
      action = action || {}; var next = Object.assign({}, state, { open: state.open.slice() });
      if (directions(action.type)) { next.selected = moveSelection(state.selected, state.columns, state.board.length, action.type); return next; }
      if (state.status !== 'playing') return next;
      if (action.type === 'tick') {
        var dt = finiteTime(dtSeconds); next.elapsed += dt;
        if (state.mismatchRemaining > 0) {
          next.mismatchRemaining = Math.max(0, state.mismatchRemaining - dt);
          if (next.mismatchRemaining < 0.000001) { next.mismatchRemaining = 0; next.open = []; }
        }
        return next;
      }
      if (action.type !== 'cell' && action.type !== 'action' || state.mismatchRemaining > 0) return next;
      var index = action.type === 'action' ? state.selected : action.index;
      if (!validIndex(index, state.board.length) || state.board[index].matched || state.open.indexOf(index) !== -1 || action.alternate) return next;
      next.selected = index; next.open.push(index);
      if (next.open.length === 2) {
        next.moves++;
        if (state.board[next.open[0]].face === state.board[index].face) {
          next.board = copyCells(state.board); next.open.forEach(function (opened) { next.board[opened].matched = true; });
          next.open = []; next.matchedPairs++; next.score = next.matchedPairs * 100;
          if (next.matchedPairs === next.pairs) next.status = 'won';
        } else next.mismatchRemaining = 0.85;
      }
      return next;
    },
    describe: function (state) {
      var summary = state.status === 'won' ? 'Bạn đã tìm đủ các cặp!' : state.mismatchRemaining > 0 ? 'Hai thẻ khác nhau. Quan sát trước khi chúng úp lại.' : 'Lật hai thẻ để tìm cặp biểu tượng giống nhau. Không giới hạn thời gian.';
      return { summary: summary + ' Đã ghép ' + state.matchedPairs + '/' + state.pairs + ' cặp, ' + state.moves + ' lượt.', columns: state.columns, cells: state.board.map(function (card, index) {
        var open = card.matched || state.open.indexOf(index) !== -1;
        return { index: index, label: open ? MEMORY_FACES[card.face] : '?', description: 'Thẻ ' + (index + 1) + ': ' + (card.matched ? 'đã ghép, ' + MEMORY_FACES[card.face] : open ? MEMORY_FACES[card.face] : 'đang úp'), disabled: card.matched || state.status !== 'playing' || state.mismatchRemaining > 0, pressed: open };
      }) };
    },
    draw: function (ctx, state, options) {
      options = options || {}; var width = options.width || 720, height = options.height || 480;
      ctx.save(); background(ctx, width, height, options, state); var layout = boardLayout(width, height, state.columns, Math.ceil(state.board.length / state.columns));
      state.board.forEach(function (card, index) {
        var open = card.matched || state.open.indexOf(index) !== -1, x = layout.x + index % state.columns * layout.size, y = layout.y + Math.floor(index / state.columns) * layout.size;
        tile(ctx, x, y, layout.size, layout.size, card.matched ? '#23635e' : open ? '#604885' : '#263555');
        if (!open) {
          ctx.beginPath(); ctx.arc(x + layout.size / 2, y + layout.size / 2, layout.size * .27, 0, Math.PI * 2); ctx.strokeStyle = '#c4b1ef45'; ctx.lineWidth = 1; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + layout.size * .5, y + layout.size * .18); ctx.lineTo(x + layout.size * .82, y + layout.size * .5); ctx.lineTo(x + layout.size * .5, y + layout.size * .82); ctx.lineTo(x + layout.size * .18, y + layout.size * .5); ctx.closePath(); ctx.strokeStyle = '#85d7ef45'; ctx.stroke();
        }
        text(ctx, open ? MEMORY_FACES[card.face] : '✦', x + layout.size / 2, y + layout.size / 2, Math.max(16, layout.size * 0.42), card.matched ? '#a6f3c7' : '#f5e8ff');
        if (index === state.selected && state.status === 'playing') { ctx.strokeStyle = '#ffda7a'; ctx.lineWidth = 2; ctx.strokeRect(x + 3, y + 3, layout.size - 6, layout.size - 6); }
      }); ctx.restore();
    }
  };

  return { games: { merge: merge, mines: mines, memory: memory } };
});
