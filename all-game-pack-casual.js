(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HHAllGamePackCasual = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Original small games. Their host owns DOM, persistence and the single clock.
  const clone = state => JSON.parse(JSON.stringify(state));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const inputOf = input => typeof input === 'string' ? { type: input } : (input || { type: 'tick' });
  const COLORS = ['#65deef', '#bd8aff', '#ff90bc', '#ffe088'];
  const COLOR_NAMES = ['Xanh ngọc', 'Tím', 'Hồng', 'Vàng'];
  const CANVAS_CUES = new Set(['rhythm-tap', 'color-word', 'lock-timing', 'stack-tower', 'constellation-trace', 'pixel-painter', 'garden-care', 'cafe-orders']);
  function seedValue(seed) { let value = 2166136261; for (const char of String(seed === undefined ? 'hh-casual' : seed)) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0; return value || 1; }
  function random(state) { let x = state.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; state.rng = x >>> 0; return state.rng / 4294967296; }
  const integer = (state, count) => Math.floor(random(state) * count);
  function shuffle(state, array) { const result = array.slice(); for (let i = result.length - 1; i > 0; i--) { const j = integer(state, i + 1); [result[i], result[j]] = [result[j], result[i]]; } return result; }
  function base(id, options, duration) { const difficulty = options && options.difficulty || 'normal'; return { version: 1, id, status: 'playing', score: 0, level: 1, elapsed: 0, timeLeft: duration === undefined ? null : duration * (difficulty === 'easy' ? 1.25 : difficulty === 'hard' ? .8 : 1), rng: seedValue(options && options.seed), difficulty, message: '' }; }
  function cell(index, text, label, disabled, pressed, color) { return { index, text: String(text), label, description: label, disabled: !!disabled, pressed: !!pressed, color }; }
  function finish(state, message) { state.status = 'won'; state.message = message; }
  function lose(state, message) { state.status = 'lost'; state.message = message; }
  function mistake(state, limit, message) { state.mistakes = (state.mistakes || 0) + 1; state.message = message; if (state.mistakes >= limit) lose(state, message + ' Đã hết lượt thử.'); }
  function tickClock(state, delta) { state.elapsed += delta; if (state.timeLeft !== null) { state.timeLeft = Math.max(0, state.timeLeft - delta); if (state.timeLeft <= 0) lose(state, 'Hết thời gian của ván chơi.'); } }
  function makeGame(config) {
    return {
      id: config.id,
      create(options) { const state = base(config.id, options, config.duration); config.init(state); return state; },
      step(source, input, dt) {
        const state = clone(source), action = inputOf(input); if (state.status !== 'playing') return state;
        const delta = clamp(Number.isFinite(dt) ? dt : 1 / 60, 0, .05);
        if (action.type === 'tick') { tickClock(state, delta); if (state.status === 'playing' && config.tick) config.tick(state, delta, action); }
        else if (config.action) config.action(state, action);
        return state;
      },
      describe(state) { const info = config.describe(state); return { ...info, showCanvas: CANVAS_CUES.has(config.id), summary: info.summary + (state.message ? ' ' + state.message : '') }; },
      draw(ctx, state, options) { drawGame(ctx, state, options || {}, config); }
    };
  }
  function isTap(action) { return action.type === 'action' || (action.type === 'cell' && action.index === 0); }
  function numberedCells(count, label, selected, disabled) { return Array.from({ length: count }, (_, index) => cell(index, index + 1, label + ' ' + (index + 1), disabled, index === selected, COLORS[index % COLORS.length])); }

  function simonShow(state) { state.phase = 'show'; state.showTime = 0; state.cursor = 0; state.active = -1; }
  const simon = makeGame({
    id: 'simon-sequence', duration: 150,
    init(state) { state.sequence = [integer(state, 4), integer(state, 4), integer(state, 4)]; state.round = 1; simonShow(state); state.message = 'Quan sát thứ tự sáng, rồi chọn lại đúng các ô.'; },
    tick(state, dt) { if (state.phase !== 'show') return; state.showTime += dt; const beat = Math.floor(state.showTime / .65); state.active = beat < state.sequence.length && state.showTime % .65 < .46 ? state.sequence[beat] : -1; if (state.showTime >= state.sequence.length * .65 + .3) { state.phase = 'input'; state.active = -1; state.message = 'Đến lượt bạn lặp lại dãy sáng.'; } },
    action(state, action) {
      if (state.phase !== 'input' || action.type !== 'cell' || !Number.isInteger(action.index) || action.index < 0 || action.index > 3) return;
      if (action.index !== state.sequence[state.cursor]) { lose(state, 'Thứ tự chưa đúng. Bạn đã nhớ được ' + state.cursor + ' ô của vòng này.'); return; }
      state.cursor++; state.score += 20;
      if (state.cursor === state.sequence.length) { if (state.round === 4) finish(state, 'Đã giải chính xác 4 dãy tín hiệu!'); else { state.round++; state.level = state.round; state.sequence.push(integer(state, 4)); simonShow(state); state.message = 'Đúng cả dãy! Dãy tiếp theo dài hơn một ô.'; } }
    },
    describe(state) { return { summary: 'Dãy tín hiệu: vòng ' + state.round + '/4, ' + state.sequence.length + ' ô. ' + (state.phase === 'show' ? 'Đang trình chiếu.' : 'Đã nhập ' + state.cursor + ' ô.'), columns: 2, cells: numberedCells(4, 'Ô tín hiệu', state.active, state.phase !== 'input' || state.status !== 'playing').map(item => ({ ...item, background: item.pressed ? item.color : '#15213a', color: item.pressed ? '#0b1025' : item.color, label: item.label + (item.pressed ? ', đang sáng' : ', đang tắt'), description: item.description + (item.pressed ? ', đang sáng' : ', đang tắt') })) }; }
  });

  function reactionWait(state) { state.phase = 'wait'; state.wait = 1.1 + random(state) * 1.8; state.responseTime = 0; }
  const reaction = makeGame({
    id: 'reaction-stop', duration: 30,
    init(state) { state.round = 1; state.results = []; reactionWait(state); state.message = 'Chờ tín hiệu xanh rồi mới chạm. Chạm sớm sẽ thua.'; },
    tick(state, dt) { if (state.phase === 'wait') { state.wait -= dt; if (state.wait <= 0) { state.phase = 'go'; state.responseTime = 0; state.message = 'XANH — chạm ngay!'; } } else { state.responseTime += dt; if (state.responseTime > 1.2) lose(state, 'Đã quá cửa sổ phản xạ 1,2 giây.'); } },
    action(state, action) { if (!isTap(action)) return; if (state.phase !== 'go') { lose(state, 'Bạn chạm trước khi tín hiệu xanh xuất hiện.'); return; } state.results.push(state.responseTime); state.score += Math.max(1, Math.round(1200 - state.responseTime * 1000)); if (state.round === 3) finish(state, 'Đã bắt đúng cả 3 tín hiệu. Thời gian đo theo nhịp khung hình đang chạy.'); else { state.round++; state.level = state.round; reactionWait(state); state.message = 'Bắt đúng! Chờ tín hiệu kế tiếp.'; } },
    describe(state) { return { summary: 'Phản xạ: tín hiệu ' + state.round + '/3. ' + (state.phase === 'go' ? 'ĐÃ XANH.' : 'Đang chờ, chưa được chạm.'), columns: 1, cells: [cell(0, state.phase === 'go' ? 'CHẠM NGAY' : 'CHỜ', 'Nút phản xạ, ' + (state.phase === 'go' ? 'đã xanh' : 'đang chờ'), state.status !== 'playing', false, state.phase === 'go' ? '#8bf3b2' : '#ffba79')] }; }
  });

  function rhythmAdvance(state) { state.beat++; state.nextBeat += state.period; if (state.beat > 12) { if (state.hits >= 9) finish(state, 'Đạt ' + state.hits + '/12 nhịp, vượt mục tiêu 9 nhịp!'); else lose(state, 'Kết thúc bản nhịp: cần ít nhất 9/12 nhịp đúng.'); } }
  const rhythm = makeGame({
    id: 'rhythm-tap', duration: 13,
    init(state) { state.period = 2 / 3; state.beat = 1; state.nextBeat = 1; state.hits = 0; state.mistakes = 0; state.message = 'Chạm khi con trỏ tới vạch giữa, sai số tối đa 0,17 giây.'; },
    tick(state) { if (state.elapsed > state.nextBeat + .17) { state.message = 'Bỏ lỡ một nhịp.'; rhythmAdvance(state); } },
    action(state, action) { if (!isTap(action)) return; if (Math.abs(state.elapsed - state.nextBeat) <= .17) { state.hits++; state.score += 100; state.message = 'Đúng nhịp!'; rhythmAdvance(state); } else { mistake(state, 4, 'Chạm ngoài cửa sổ nhịp.'); } },
    describe(state) { return { summary: 'Nhịp sao 90 BPM: nhịp ' + Math.min(12, state.beat) + '/12, đúng ' + state.hits + ', chạm lệch ' + state.mistakes + '/4.', columns: 1, cells: [cell(0, 'CHẠM NHỊP', 'Chạm theo nhịp, mục tiêu ít nhất 9 trên 12', state.status !== 'playing', false, '#bd8aff')] }; }
  });

  function newWhack(state) { const previous = state.target; do { state.target = integer(state, 9); } while (state.target === previous); state.targetTime = Math.max(.6, 1.2 - state.hits * .035); }
  const whack = makeGame({
    id: 'whack-orb', duration: 30,
    init(state) { state.hits = 0; state.mistakes = 0; state.target = -1; newWhack(state); state.message = 'Chọn đúng quả cầu trước khi nó biến mất; cần 12 lần trúng.'; },
    tick(state, dt) { state.targetTime -= dt; if (state.targetTime <= 0) { mistake(state, 4, 'Quả cầu đã biến mất.'); if (state.status === 'playing') newWhack(state); } },
    action(state, action) { if (action.type !== 'cell' || !Number.isInteger(action.index) || action.index < 0 || action.index >= 9) return; if (action.index !== state.target) { mistake(state, 4, 'Bạn chọn ô trống.'); return; } state.hits++; state.score += 50; state.message = 'Bắt trúng quả cầu!'; if (state.hits === 12) finish(state, 'Đã bắt đủ 12 quả cầu chuyển động!'); else newWhack(state); },
    describe(state) { return { summary: 'Bắt quả cầu: ' + state.hits + '/12, lỗi ' + state.mistakes + '/4.', columns: 3, cells: Array.from({ length: 9 }, (_, i) => cell(i, i === state.target ? '●' : '·', 'Ô ' + (i + 1) + (i === state.target ? ', có quả cầu' : ', trống'), state.status !== 'playing', i === state.target, '#ff90bc')) }; }
  });

  function nextAim(state) { const before = state.target; do { state.target = integer(state, 20); } while (state.target === before); }
  const aim = makeGame({
    id: 'aim-trainer', duration: 25,
    init(state) { state.hits = 0; state.mistakes = 0; state.target = -1; nextAim(state); state.message = 'Chọn tâm mục tiêu nhỏ; hoàn thành 15 mục tiêu trong 25 giây.'; },
    action(state, action) { if (action.type !== 'cell' || !Number.isInteger(action.index) || action.index < 0 || action.index >= 20) return; if (action.index !== state.target) { mistake(state, 8, 'Chưa trúng ô mục tiêu.'); return; } state.hits++; state.score += 100; if (state.hits === 15) finish(state, 'Đã nhắm trúng đủ 15 mục tiêu!'); else { nextAim(state); state.message = 'Trúng tâm. Mục tiêu đã chuyển vị trí.'; } },
    describe(state) { return { summary: 'Nhắm sao: ' + state.hits + '/15, trượt ' + state.mistakes + '/8.', columns: 5, cells: Array.from({ length: 20 }, (_, i) => cell(i, i === state.target ? '⊙' : '·', 'Vị trí ' + (i + 1) + (i === state.target ? ', tâm mục tiêu' : ', không có mục tiêu'), state.status !== 'playing', i === state.target, '#65deef')) }; }
  });

  function nextMath(state) {
    const a = 2 + integer(state, 10), b = 1 + integer(state, 9), operation = integer(state, 3);
    const answer = operation === 0 ? a + b : operation === 1 ? a - b : a * b;
    const options = [answer]; while (options.length < 4) { const value = answer + integer(state, 15) - 7; if (!options.includes(value)) options.push(value); }
    state.question = { prompt: a + [' + ', ' − ', ' × '][operation] + b, answer, options: shuffle(state, options) };
  }
  const math = makeGame({
    id: 'math-sprint', duration: 75,
    init(state) { state.round = 1; state.mistakes = 0; nextMath(state); state.message = 'Chọn kết quả phép tính; hoàn thành 10 câu.'; },
    action(state, action) { if (action.type !== 'cell' || !Number.isInteger(action.index) || action.index < 0 || action.index > 3) return; if (state.question.options[action.index] !== state.question.answer) { mistake(state, 3, 'Kết quả chưa đúng. Thử tính lại câu hiện tại.'); return; } state.score += 100; if (state.round === 10) finish(state, 'Đã giải đúng 10 phép tính!'); else { state.round++; state.level = state.round; nextMath(state); state.message = 'Chính xác!'; } },
    describe(state) { return { summary: 'Toán nhanh: câu ' + state.round + '/10. ' + state.question.prompt + ' = ? Lỗi ' + state.mistakes + '/3.', columns: 2, cells: state.question.options.map((answer, i) => cell(i, answer, 'Đáp án ' + answer, state.status !== 'playing', false, COLORS[i])) }; }
  });

  function nextColor(state) { state.ink = integer(state, 4); state.word = (state.ink + 1 + integer(state, 3)) % 4; }
  const colorWord = makeGame({
    id: 'color-word', duration: 60,
    init(state) { state.round = 1; state.mistakes = 0; nextColor(state); state.message = 'Chọn màu mực, không chọn nghĩa của từ. Hỗ trợ đọc màu qua mô tả cho chế độ tương phản cao.'; },
    action(state, action) { if (action.type !== 'cell' || !Number.isInteger(action.index) || action.index < 0 || action.index > 3) return; if (action.index !== state.ink) { mistake(state, 4, 'Đó chưa phải màu mực đang hiển thị.'); return; } state.score += 80; if (state.round === 12) finish(state, 'Đã phân biệt đúng 12 màu mực!'); else { state.round++; state.level = state.round; nextColor(state); state.message = 'Đúng màu mực!'; } },
    describe(state) { return { summary: 'Màu và chữ: câu ' + state.round + '/12, từ “' + COLOR_NAMES[state.word] + '”. Hãy chọn màu mực, không chọn nghĩa của từ. Lỗi ' + state.mistakes + '/4.', visualCue: { text: COLOR_NAMES[state.word], color: COLORS[state.ink], label: 'Chữ ' + COLOR_NAMES[state.word] + ' được in bằng mực ' + COLOR_NAMES[state.ink] }, columns: 2, cells: COLOR_NAMES.map((name, i) => cell(i, name, 'Chọn màu mực ' + name, state.status !== 'playing', false, COLORS[i])) }; }
  });

  const SYMBOL_PAIRS = [['○', '◇', 'vòng tròn', 'hình thoi'], ['□', '△', 'hình vuông', 'tam giác'], ['+', '×', 'dấu cộng', 'dấu nhân']];
  function nextOdd(state) { state.pair = integer(state, SYMBOL_PAIRS.length); state.target = integer(state, 16); }
  const odd = makeGame({
    id: 'odd-one-out', duration: 45,
    init(state) { state.round = 1; state.mistakes = 0; nextOdd(state); state.message = 'Tìm biểu tượng khác với 15 biểu tượng còn lại.'; },
    action(state, action) { if (action.type !== 'cell' || !Number.isInteger(action.index) || action.index < 0 || action.index >= 16) return; if (action.index !== state.target) { mistake(state, 3, 'Biểu tượng này giống số đông.'); return; } state.score += 100; if (state.round === 8) finish(state, 'Đã tìm đúng cả 8 biểu tượng khác biệt!'); else { state.round++; state.level = state.round; nextOdd(state); state.message = 'Đã tìm đúng biểu tượng khác biệt.'; } },
    describe(state) { const pair = SYMBOL_PAIRS[state.pair]; return { summary: 'Khác biệt: lượt ' + state.round + '/8, lỗi ' + state.mistakes + '/3.', columns: 4, cells: Array.from({ length: 16 }, (_, i) => cell(i, pair[i === state.target ? 1 : 0], 'Ô ' + (i + 1) + ': ' + pair[i === state.target ? 3 : 2], state.status !== 'playing', false, '#c8b8ff')) }; }
  });

  function newPattern(state) { state.pattern = shuffle(state, Array.from({ length: 16 }, (_, i) => i)).slice(0, state.round + 3); state.selected = []; state.phase = 'show'; state.preview = 2.5; }
  const pattern = makeGame({
    id: 'pattern-recall', duration: 100,
    init(state) { state.round = 1; newPattern(state); state.message = 'Nhớ các ô sáng. Khi lưới tắt, chọn lại rồi bấm Hành động để kiểm tra.'; },
    tick(state, dt) { if (state.phase === 'show') { state.preview -= dt; if (state.preview <= 0) { state.phase = 'recall'; state.message = 'Chọn lại đúng các ô đã sáng rồi kiểm tra.'; } } },
    action(state, action) {
      if (state.phase !== 'recall') return;
      if (action.type === 'cell' && Number.isInteger(action.index) && action.index >= 0 && action.index < 16) { const selected = state.selected.indexOf(action.index); if (selected >= 0) state.selected.splice(selected, 1); else state.selected.push(action.index); }
      if (action.type === 'action' || (action.type === 'cell' && action.index === 16)) { const correct = state.selected.length === state.pattern.length && state.pattern.every(index => state.selected.includes(index)); if (!correct) lose(state, 'Mẫu được chọn chưa khớp với mẫu đã trình chiếu.'); else { state.score += state.pattern.length * 50; if (state.round === 3) finish(state, 'Đã tái tạo chính xác 3 mẫu sao!'); else { state.round++; state.level = state.round; newPattern(state); state.message = 'Đúng mẫu! Quan sát mẫu tiếp theo.'; } } }
    },
    describe(state) { return { summary: 'Nhớ mẫu: vòng ' + state.round + '/3, ' + state.pattern.length + ' ô. ' + (state.phase === 'show' ? 'Đang trình chiếu.' : 'Đã chọn ' + state.selected.length + ' ô. Chọn Kiểm tra hoặc Hành động để nộp mẫu.'), columns: 4, cells: [...Array.from({ length: 16 }, (_, i) => { const lit = state.phase === 'show' ? state.pattern.includes(i) : state.selected.includes(i); return { ...cell(i, lit ? '●' : '·', 'Ô ' + (i + 1) + (lit ? ', sáng' : ', tắt'), state.phase === 'show' || state.status !== 'playing', lit, lit ? '#0b1025' : '#85e8c3'), background: lit ? '#85e8c3' : '#15213a' }; }), cell(16, 'Kiểm tra', 'Kiểm tra mẫu đã chọn', state.phase === 'show' || state.status !== 'playing', false, '#ffe088')] }; }
  });

  function neighbors(index, width, count) { return [index - width, index + width, index % width ? index - 1 : -1, index % width < width - 1 ? index + 1 : -1].filter(i => i >= 0 && i < count); }
  function connectedWithout(traps) { const seen = new Set([0]), queue = [0]; for (let n = 0; n < queue.length; n++) for (const next of neighbors(queue[n], 6, 36)) if (!traps.includes(next) && !seen.has(next)) { seen.add(next); queue.push(next); } return seen.size === 36 - traps.length; }
  const treasure = makeGame({
    id: 'treasure-grid',
    init(state) { const candidates = shuffle(state, Array.from({ length: 34 }, (_, i) => i + 1)); state.treasures = candidates.slice(0, 3); state.traps = []; for (const index of candidates.slice(3)) { if (connectedWithout([...state.traps, index])) state.traps.push(index); if (state.traps.length === 4) break; } state.player = 0; state.revealed = [0]; state.collected = []; state.triggered = []; state.lives = state.difficulty === 'easy' ? 4 : state.difficulty === 'hard' ? 2 : 3; state.maxMoves = state.difficulty === 'easy' ? 100 : state.difficulty === 'hard' ? 65 : 80; state.moves = 0; state.message = 'Tìm 3 kho báu rồi tới cổng ở ô 36. Chỉ đi ô liền kề; tối đa ' + state.maxMoves + ' bước.'; },
    action(state, action) {
      let index = action.type === 'cell' ? action.index : null;
      const movement = { left: -1, right: 1, up: -6, down: 6 };
      if (Object.hasOwn(movement, action.type)) index = state.player + movement[action.type];
      if (!Number.isInteger(index) || !neighbors(state.player, 6, 36).includes(index)) return;
      state.player = index; state.moves++; if (!state.revealed.includes(index)) state.revealed.push(index);
      if (state.traps.includes(index) && !state.triggered.includes(index)) { state.triggered.push(index); state.lives--; state.message = 'Gặp hố sao! Ô này đã được đánh dấu an toàn cho lần đi sau.'; }
      else if (state.treasures.includes(index) && !state.collected.includes(index)) { state.collected.push(index); state.score += 100; state.message = 'Đã tìm được một kho báu!'; }
      else state.message = 'Tín hiệu: ' + neighbors(index, 6, 36).filter(i => state.treasures.includes(i) && !state.collected.includes(i)).length + ' kho báu chưa lấy trong các ô liền kề.';
      if (state.lives <= 0) lose(state, 'Đã dùng hết lá chắn.');
      else if (index === 35 && state.collected.length === 3) { state.score += state.maxMoves - state.moves; finish(state, 'Đã mang đủ 3 kho báu về cổng!'); }
      else if (state.moves >= state.maxMoves) lose(state, 'Đã hết giới hạn ' + state.maxMoves + ' bước.');
    },
    describe(state) { return { summary: 'Bản đồ kho báu: ' + state.collected.length + '/3 kho báu, ' + state.lives + ' lá chắn, ' + state.moves + '/' + state.maxMoves + ' bước.', columns: 6, cells: Array.from({ length: 36 }, (_, index) => { const known = state.revealed.includes(index); const label = index === state.player ? 'bạn đang ở đây' : index === 35 ? 'cổng về' : known && state.traps.includes(index) ? 'hố đã khám phá' : known && state.treasures.includes(index) ? 'kho báu đã lấy' : known ? 'đã khám phá' : 'chưa khám phá'; return cell(index, index === state.player ? '●' : index === 35 ? '⌂' : known && state.traps.includes(index) ? '×' : known && state.treasures.includes(index) ? '◆' : known ? '·' : '?', 'Ô ' + (index + 1) + ', ' + label, state.status !== 'playing' || !neighbors(state.player, 6, 36).includes(index), index === state.player, '#ffe088'); }) }; }
  });

  const angularDistance = (a, b) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));
  function newLock(state) { state.target = .12 + random(state) * .76; state.window = .25 - (state.level - 1) * .025; state.phase = 0; }
  const lock = makeGame({
    id: 'lock-timing', duration: 50,
    init(state) { state.mistakes = 0; newLock(state); state.message = 'Chạm khi kim chạy vào cung sáng. Mở đủ 5 vòng khóa.'; },
    tick(state, dt) { state.phase = (state.phase + dt * (.32 + state.level * .06)) % 1; },
    action(state, action) { if (!isTap(action)) return; if (angularDistance(state.phase, state.target) > state.window / 2) { mistake(state, 3, 'Kim đang ngoài vùng mở khóa.'); return; } state.score += 100; if (state.level === 5) finish(state, 'Đã mở đủ 5 vòng khóa quỹ đạo!'); else { state.level++; newLock(state); state.message = 'Mở được một vòng khóa. Cung sáng tiếp theo hẹp hơn.'; } },
    describe(state) { return { summary: 'Khóa quỹ đạo: vòng ' + state.level + '/5, lỗi ' + state.mistakes + '/3. Kim ' + Math.round(state.phase * 360) + ' độ; tâm cung ' + Math.round(state.target * 360) + ' độ, rộng ' + Math.round(state.window * 360) + ' độ.', columns: 1, cells: [cell(0, 'DỪNG KIM', 'Dừng kim trong cung sáng', state.status !== 'playing', false, '#ffe088')] }; }
  });

  const stack = makeGame({
    id: 'stack-tower', duration: 90,
    init(state) { state.tower = [{ x: 180, width: 360 }]; state.moving = { x: 0, width: 360, direction: 1 }; state.message = 'Thả tầng đang chạy lên tầng dưới. Phần không chồng khít sẽ bị cắt; mục tiêu 10 tầng.'; },
    tick(state, dt) { const block = state.moving; block.x += block.direction * (130 + state.level * 14) * dt; const bound = 720 - block.width; if (block.x > bound) { block.x = bound - (block.x - bound); block.direction = -1; } if (block.x < 0) { block.x = -block.x; block.direction = 1; } },
    action(state, action) { if (!isTap(action)) return; const previous = state.tower.at(-1), moving = state.moving; const x = Math.max(previous.x, moving.x), end = Math.min(previous.x + previous.width, moving.x + moving.width), width = end - x; if (width < 14) { lose(state, 'Tầng vừa thả không đủ bề mặt đỡ.'); return; } state.tower.push({ x, width }); state.score += Math.round(width); if (state.tower.length === 11) { finish(state, 'Đã xây xong tháp 10 tầng!'); return; } state.level++; state.moving = { x: state.level % 2 ? 0 : 720 - width, width, direction: state.level % 2 ? 1 : -1 }; state.message = 'Tầng ' + (state.tower.length - 1) + ' đã đặt. Còn rộng ' + Math.round(width) + ' đơn vị.'; },
    describe(state) { return { summary: 'Tháp neon: ' + (state.tower.length - 1) + '/10 tầng, bề rộng còn ' + Math.round(state.tower.at(-1).width) + '.', columns: 1, cells: [cell(0, 'THẢ TẦNG', 'Thả tầng đang chạy', state.status !== 'playing', false, '#9ee7d6')] }; }
  });

  function nextConstellation(state) { state.order = shuffle(state, Array.from({ length: 8 }, (_, i) => i)); state.path = []; state.nodes = Array.from({ length: 8 }, (_, i) => { const angle = i * Math.PI / 4 - Math.PI / 2; return { x: 360 + Math.cos(angle) * (140 + integer(state, 20)), y: 253 + Math.sin(angle) * (130 + integer(state, 20)) }; }); }
  const constellation = makeGame({
    id: 'constellation-trace',
    init(state) { state.mistakes = 0; state.mistakeLimit = state.difficulty === 'easy' ? 4 : state.difficulty === 'hard' ? 2 : 3; nextConstellation(state); state.message = 'Nối các ngôi sao theo dãy đã cho. Mỗi sao chỉ chọn một lần trong hình.'; },
    action(state, action) { if (action.type !== 'cell' || !Number.isInteger(action.index) || action.index < 0 || action.index >= 8 || state.path.includes(action.index)) return; if (action.index !== state.order[state.path.length]) { mistake(state, state.mistakeLimit, 'Ngôi sao này chưa tới lượt trong dãy.'); return; } state.path.push(action.index); state.score += 20; if (state.path.length === 8) { if (state.level === 3) finish(state, 'Đã vẽ hoàn chỉnh 3 chòm sao gốc!'); else { state.level++; nextConstellation(state); state.message = 'Chòm sao hoàn thành! Theo dãy mới để vẽ hình tiếp theo.'; } } },
    describe(state) { return { summary: 'Nối chòm sao ' + state.level + '/3. Dãy: ' + state.order.map(i => i + 1).join(' → ') + '. Tiếp theo: ' + (state.order[state.path.length] === undefined ? 'xong' : state.order[state.path.length] + 1) + '. Lỗi ' + state.mistakes + '/' + state.mistakeLimit + '.', columns: 4, cells: Array.from({ length: 8 }, (_, i) => cell(i, '✦ ' + (i + 1), 'Ngôi sao ' + (i + 1) + (state.path.includes(i) ? ', đã nối' : ', chưa nối'), state.path.includes(i) || state.status !== 'playing', state.path.includes(i), COLORS[i % 4])) }; }
  });

  const PIXEL_PATTERNS = [
    ['00011000', '00133100', '00133100', '01133110', '21133112', '21111112', '00022000', '00022000'],
    ['00022000', '00222200', '02233220', '02233220', '00222200', '00011000', '00111000', '00011000'],
    ['00000000', '00011110', '00111310', '01113100', '01131000', '01310000', '01100000', '01000000']
  ];
  const PAINT_COLORS = ['#15233c', '#65deef', '#ff90bc', '#ffe088'];
  const painter = makeGame({
    id: 'pixel-painter',
    init(state) { state.targetId = integer(state, PIXEL_PATTERNS.length); state.target = PIXEL_PATTERNS[state.targetId].join('').split('').map(Number); state.pixels = Array(64).fill(0); state.ink = 1; state.attempts = 0; state.message = 'Chọn mực 0–3, tô lại mẫu bên trái. Trái/phải đổi mực; Hành động kiểm tra; thao tác phụ xóa ô.'; },
    action(state, action) {
      if (action.type === 'left') state.ink = (state.ink + 3) % 4;
      if (action.type === 'right') state.ink = (state.ink + 1) % 4;
      if (action.type === 'cell' && Number.isInteger(action.index)) { if (action.index >= 64 && action.index < 68) state.ink = action.index - 64; else if (action.index >= 0 && action.index < 64) state.pixels[action.index] = action.alternate ? 0 : state.ink; }
      if (action.type === 'action' || (action.type === 'cell' && action.index === 68)) { state.attempts++; const correct = state.pixels.filter((value, i) => value === state.target[i]).length; state.score = correct * 10; if (correct === 64) finish(state, 'Bức tranh khớp đủ 64 ô!'); else state.message = 'Đã khớp ' + correct + '/64 ô. Có thể sửa tiếp, không bị trừ lượt.'; }
    },
    describe(state) { return { summary: 'Họa sĩ pixel: mẫu ' + ['Tên lửa', 'Bông hoa', 'Chiếc lá'][state.targetId] + ', đang chọn mực ' + state.ink + '. Chọn mực, tô ô rồi Kiểm tra hoặc Hành động để nộp tranh. Mẫu từng hàng: ' + PIXEL_PATTERNS[state.targetId].join(' / ') + '.', columns: 8, cells: [...state.pixels.map((color, index) => ({ ...cell(index, String(color), 'Ô hàng ' + (Math.floor(index / 8) + 1) + ', cột ' + (index % 8 + 1) + ', mực ' + color + ', mẫu cần ' + state.target[index], state.status !== 'playing', false, color ? '#0b1025' : '#eef4ff'), background: PAINT_COLORS[color] })), ...PAINT_COLORS.map((color, index) => ({ ...cell(64 + index, 'Mực ' + index, 'Chọn mực ' + index, state.status !== 'playing', state.ink === index, index ? '#0b1025' : '#eef4ff'), background: color })), cell(68, 'Kiểm tra', 'Kiểm tra tranh đã tô có khớp mẫu', state.status !== 'playing', false, '#ffe088')] }; }
  });

  const PLANT_NAMES = ['Mầm bạc hà', 'Hoa sao', 'Cây ngọc'];
  const garden = makeGame({
    id: 'garden-care', duration: 70,
    init(state) { state.plants = [0, 1, 2].map(() => ({ water: .5, growth: 0, health: 1, harvested: false })); state.reservoir = 6; state.refillCooldown = 0; state.harvested = 0; state.message = 'Giữ nước trong khoảng 25–80%. Chọn cây để tưới, chọn cây trưởng thành để thu hoạch. Hành động nạp bình (nghỉ 8 giây).'; },
    tick(state, dt) { state.refillCooldown = Math.max(0, state.refillCooldown - dt); state.plants.forEach((plant, i) => { if (plant.harvested) return; plant.water = Math.max(0, plant.water - [.035, .028, .04][i] * dt); if (plant.water >= .25 && plant.water <= .8) plant.growth = Math.min(1, plant.growth + [.04, .033, .028][i] * dt); else plant.health = Math.max(0, plant.health - .07 * dt); if (plant.health <= 0) lose(state, PLANT_NAMES[i] + ' đã héo do thiếu nước hoặc úng kéo dài.'); }); },
    action(state, action) {
      if (action.type === 'action' || (action.type === 'cell' && action.index === 3)) { if (state.refillCooldown > 0) { state.message = 'Bình đang nạp; còn ' + Math.ceil(state.refillCooldown) + ' giây.'; return; } state.reservoir = 6; state.refillCooldown = 8; state.message = 'Đã nạp bình đủ 6 lượt tưới.'; return; }
      if (action.type !== 'cell' || !Number.isInteger(action.index) || action.index < 0 || action.index > 2) return;
      const plant = state.plants[action.index]; if (plant.harvested) return;
      if (plant.growth >= 1) { plant.harvested = true; state.harvested++; state.score += Math.round(plant.health * 100); if (state.harvested === 3) finish(state, 'Đã chăm và thu hoạch đủ 3 cây!'); else state.message = 'Đã thu hoạch ' + PLANT_NAMES[action.index] + '.'; }
      else if (action.alternate) { plant.water = Math.max(0, plant.water - .15); state.message = 'Đã thoát bớt nước cho cây.'; }
      else if (state.reservoir > 0) { plant.water = Math.min(1, plant.water + .23); state.reservoir--; state.message = 'Đã tưới ' + PLANT_NAMES[action.index] + '. Tránh tưới quá 80%.'; }
      else state.message = 'Bình đã hết nước. Chọn Nạp bình hoặc Hành động.';
    },
    describe(state) { return { summary: 'Khu vườn: thu hoạch ' + state.harvested + '/3, bình còn ' + state.reservoir + '/6. Nạp lại sau ' + Math.ceil(state.refillCooldown) + ' giây.', columns: 2, cells: [...state.plants.map((plant, i) => cell(i, plant.harvested ? '✓ Đã hái' : plant.growth >= 1 ? 'Thu hoạch' : 'Tưới cây ' + (i + 1), PLANT_NAMES[i] + ': nước ' + Math.round(plant.water * 100) + '%, lớn ' + Math.round(plant.growth * 100) + '%, sức sống ' + Math.round(plant.health * 100) + '%', state.status !== 'playing' || plant.harvested, plant.harvested, '#94e8b0')), cell(3, 'Nạp bình', 'Nạp 6 lượt nước, chờ 8 giây giữa hai lần', state.status !== 'playing' || state.refillCooldown > 0, false, '#65deef')] }; }
  });

  const INGREDIENTS = ['Cà phê', 'Sữa', 'Trà', 'Nước', 'Đá', 'Siro'];
  const RECIPES = [{ name: 'Cà phê sữa', parts: [0, 1] }, { name: 'Trà đá', parts: [2, 3, 4] }, { name: 'Latte mát', parts: [0, 1, 4] }, { name: 'Trà ngọt', parts: [2, 3, 5] }, { name: 'Cà phê ngọt', parts: [0, 5] }, { name: 'Trà sữa đá', parts: [2, 1, 4] }];
  function nextOrder(state) { state.order = integer(state, RECIPES.length); state.cup = []; state.patience = 16; }
  function serveOrder(state) { const recipe = RECIPES[state.order]; if (recipe.parts.length !== state.cup.length || !recipe.parts.every((part, i) => state.cup[i] === part)) { mistake(state, 3, 'Cốc chưa đúng nguyên liệu hoặc thứ tự công thức.'); state.cup = []; return; } state.served++; state.score += 100 + Math.floor(state.patience); if (state.served === 8) finish(state, 'Đã phục vụ đúng đủ 8 đơn!'); else { state.level = state.served + 1; nextOrder(state); state.message = 'Khách đã nhận đúng món. Chuẩn bị đơn tiếp theo.'; } }
  const cafe = makeGame({
    id: 'cafe-orders', duration: 100,
    init(state) { state.served = 0; state.mistakes = 0; nextOrder(state); state.message = 'Thêm nguyên liệu theo đúng thứ tự công thức, rồi Giao món. Cần 8 đơn đúng; tối đa 3 lỗi.'; },
    tick(state, dt) { state.patience -= dt; if (state.patience <= 0) { mistake(state, 3, 'Khách đã chờ quá 16 giây.'); if (state.status === 'playing') nextOrder(state); } },
    action(state, action) { if (action.type === 'action' || (action.type === 'cell' && action.index === 7)) { serveOrder(state); return; } if (action.type !== 'cell' || !Number.isInteger(action.index)) return; if (action.index === 6) { state.cup = []; state.message = 'Đã đổ cốc để pha lại.'; } else if (action.index >= 0 && action.index < 6) { if (state.cup.length >= 5) state.message = 'Cốc đã đầy. Hãy giao món hoặc pha lại.'; else { state.cup.push(action.index); state.message = 'Đã thêm ' + INGREDIENTS[action.index] + '.'; } } },
    describe(state) { const recipe = RECIPES[state.order]; return { summary: 'Quầy cà phê: đã giao ' + state.served + '/8, lỗi ' + state.mistakes + '/3. Món: ' + recipe.name + '. Công thức: ' + recipe.parts.map(i => INGREDIENTS[i]).join(' → ') + '. Cốc: ' + (state.cup.map(i => INGREDIENTS[i]).join(' → ') || 'trống') + '. Khách chờ ' + Math.ceil(state.patience) + ' giây.', columns: 4, cells: [...INGREDIENTS.map((name, index) => cell(index, name, 'Thêm ' + name, state.status !== 'playing', false, COLORS[index % 4])), cell(6, 'Pha lại', 'Đổ cốc hiện tại để pha lại', state.status !== 'playing', false, '#ffb1a9'), cell(7, 'Giao món', 'Giao cốc hiện tại cho khách', state.status !== 'playing', false, '#94e8b0')] }; }
  });

  function rounded(ctx, x, y, width, height, fill, stroke, radius) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, width, height, radius || 8); else ctx.rect(x, y, width, height); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); } }
  function label(ctx, text, x, y, size, color, align) { ctx.font = '600 ' + size + 'px system-ui, sans-serif'; ctx.fillStyle = color || '#edf4ff'; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y); }
  const NAMES = { 'simon-sequence': 'DÃY TÍN HIỆU', 'reaction-stop': 'BẮT TÍN HIỆU XANH', 'rhythm-tap': 'NHỊP SAO', 'whack-orb': 'BẮT QUẢ CẦU', 'aim-trainer': 'NHẮM SAO', 'math-sprint': 'TOÁN NHANH', 'color-word': 'MÀU VÀ CHỮ', 'odd-one-out': 'TÌM KHÁC BIỆT', 'pattern-recall': 'NHỚ MẪU SAO', 'treasure-grid': 'BẢN ĐỒ KHO BÁU', 'lock-timing': 'KHÓA QUỸ ĐẠO', 'stack-tower': 'THÁP NEON', 'constellation-trace': 'NỐI CHÒM SAO', 'pixel-painter': 'HỌA SĨ PIXEL', 'garden-care': 'KHU VƯỜN NHỎ', 'cafe-orders': 'QUẦY CÀ PHÊ' };
  function drawGame(ctx, state, options, config) {
    ctx.save(); ctx.scale((options.width || 720) / 720, (options.height || 480) / 480);
    if (typeof options.paintScene === 'function') options.paintScene(ctx, state.id, state);
    else {
      ctx.fillStyle = '#0b1025'; ctx.fillRect(0, 0, 720, 480);
      for (let i = 0; i < 44; i++) { ctx.fillStyle = i % 2 ? '#394263' : '#263b5c'; ctx.fillRect((i * 137 + 29) % 720, (i * 71 + 10) % 480, 2, 2); }
    }
    rounded(ctx, 16, 14, 688, 52, '#141d36', '#4b527b', 12); label(ctx, NAMES[state.id], 32, 39, 21, '#d6c6ff'); label(ctx, state.score + ' điểm' + (state.timeLeft === null ? '' : ' · ' + Math.ceil(state.timeLeft) + 's'), 687, 39, 17, '#b6efe6', 'right');
    const info = config.describe(state);
    if (state.id === 'lock-timing') drawLock(ctx, state);
    else if (state.id === 'stack-tower') drawStack(ctx, state);
    else if (state.id === 'constellation-trace') drawConstellation(ctx, state);
    else if (state.id === 'pixel-painter') drawPainter(ctx, state);
    else if (state.id === 'garden-care') drawGarden(ctx, state);
    else if (state.id === 'cafe-orders') drawCafe(ctx, state, options);
    else if (state.id === 'rhythm-tap') drawRhythm(ctx, state);
    else {
      let top = 105;
      if (state.id === 'math-sprint') { label(ctx, state.question.prompt + ' = ?', 360, 116, 38, '#ffe088', 'center'); top = 175; }
      if (state.id === 'color-word') { label(ctx, COLOR_NAMES[state.word], 360, 116, 42, COLORS[state.ink], 'center'); label(ctx, 'Chọn màu mực, không chọn nghĩa của chữ', 360, 154, 14, '#bec9e2', 'center'); top = 185; }
      drawCells(ctx, info.cells || [], info.columns || 1, top, state.id === 'aim-trainer');
    }
    label(ctx, state.message.slice(0, 86), 360, 459, 13, '#c4cfe6', 'center'); ctx.restore();
  }
  function drawCells(ctx, cells, columns, top, tinyTarget) {
    const rows = Math.ceil(cells.length / columns), cellSize = Math.min(116, 570 / columns, 300 / Math.max(1, rows)), gap = 8;
    const total = columns * cellSize, left = (720 - total) / 2;
    cells.forEach((item, i) => {
      const x = left + i % columns * cellSize, y = top + Math.floor(i / columns) * cellSize;
      rounded(ctx, x + gap / 2, y + gap / 2, cellSize - gap, cellSize - gap, item.pressed ? (item.color || '#b78aff') + '55' : '#15213a', item.pressed ? item.color || '#b78aff' : '#3b4d72', 9);
      if (tinyTarget && item.pressed) { ctx.beginPath(); ctx.arc(x + cellSize / 2, y + cellSize / 2, 9, 0, Math.PI * 2); ctx.strokeStyle = '#91f2e8'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + cellSize / 2 - 1, y + cellSize / 2 - 1, 2, 2); }
      else label(ctx, item.text, x + cellSize / 2, y + cellSize / 2, Math.min(24, cellSize * .28, (cellSize - gap - 12) / Math.max(1, item.text.length * .6)), item.color || '#e0ebff', 'center');
    });
  }
  function drawLock(ctx, state) {
    const cx = 360, cy = 255, radius = 125;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.strokeStyle = '#2b3e61'; ctx.lineWidth = 22; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, radius, (state.target - state.window / 2) * Math.PI * 2 - Math.PI / 2, (state.target + state.window / 2) * Math.PI * 2 - Math.PI / 2); ctx.strokeStyle = '#98e8ba'; ctx.lineWidth = 22; ctx.stroke();
    const angle = state.phase * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(angle) * 145, cy + Math.sin(angle) * 145); ctx.strokeStyle = '#ffdc8c'; ctx.lineWidth = 6; ctx.stroke(); label(ctx, state.level + ' / 5', cx, cy + 30, 28, '#fff0c0', 'center');
  }
  function drawStack(ctx, state) { state.tower.forEach((block, i) => rounded(ctx, block.x, 423 - i * 29, block.width, 27, COLORS[i % 4], '#ffffff70', 4)); if (state.status === 'playing') rounded(ctx, state.moving.x, 423 - state.tower.length * 29, state.moving.width, 27, '#ecf4ff', '#ffdc8c', 4); }
  function drawConstellation(ctx, state) {
    const points = state.nodes.map(point => ({ x: 360 + (point.x - 360) * .95, y: 263 + (point.y - 253) * .82 }));
    rounded(ctx, 151, 109, 418, 314, '#10213a8c', '#6e84b366', 24);
    ctx.beginPath(); ctx.ellipse(360, 260, 184, 143, 0, 0, Math.PI * 2); ctx.strokeStyle = '#91aad026'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(180, 260); ctx.lineTo(540, 260); ctx.moveTo(360, 119); ctx.lineTo(360, 405); ctx.stroke();
    for (const lineWidth of [10, 3]) { ctx.strokeStyle = lineWidth === 10 ? '#a18fff28' : '#c4b5ff'; ctx.lineWidth = lineWidth; ctx.beginPath(); state.path.forEach((index, n) => { const point = points[index]; if (n) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y); }); ctx.stroke(); }
    points.forEach((point, index) => {
      const visited = state.path.includes(index), next = state.order[state.path.length] === index;
      if (next) { ctx.beginPath(); ctx.arc(point.x, point.y, 24, 0, Math.PI * 2); ctx.strokeStyle = '#97ece5'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.beginPath();
      for (let tip = 0; tip < 8; tip++) { const angle = tip * Math.PI / 4 - Math.PI / 2, radius = tip % 2 ? 7 : 18; const x = point.x + Math.cos(angle) * radius, y = point.y + Math.sin(angle) * radius; if (tip) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.closePath(); ctx.fillStyle = visited ? '#ffe088' : '#c6d4ef'; ctx.fill();
      rounded(ctx, point.x - 10, point.y + 19, 20, 19, '#13213ae8', visited ? '#e4be69' : '#5b739e', 5); label(ctx, index + 1, point.x, point.y + 29, 13, visited ? '#ffe088' : '#e0ebff', 'center');
    });
    rounded(ctx, 168, 80, 384, 27, '#141e36ed', '#57618a', 9); label(ctx, state.order.map(i => i + 1).join(' → '), 360, 94, 18, '#bceee9', 'center');
    // An original small observatory prop; it does not introduce another control.
    ctx.save(); ctx.translate(78, 357); ctx.rotate(-.5); rounded(ctx, -29, -12, 82, 25, '#8495bd', '#dbe2ff', 5); rounded(ctx, 40, -17, 16, 35, '#233858', '#97d3ee', 4); ctx.restore();
    ctx.beginPath(); ctx.moveTo(77, 369); ctx.lineTo(54, 421); ctx.moveTo(77, 369); ctx.lineTo(101, 421); ctx.moveTo(77, 369); ctx.lineTo(77, 424); ctx.strokeStyle = '#8a9bc2'; ctx.lineWidth = 4; ctx.stroke();
    label(ctx, state.path.length + '/8 sao', 630, 396, 16, '#e6d7ff', 'center'); label(ctx, 'Hình ' + state.level + '/3', 630, 419, 15, '#a7c9e8', 'center');
  }
  function drawPainter(ctx, state) {
    rounded(ctx, 25, 369, 670, 71, '#3e3852e8', '#88749d', 14);
    label(ctx, 'BẢN MẪU', 198, 94, 17, '#d6c6ff', 'center'); label(ctx, 'XƯỞNG PIXEL', 518, 94, 17, '#b4f2e8', 'center');
    [state.target, state.pixels].forEach((pixels, group) => {
      const left = 69 + group * 320;
      rounded(ctx, left, 112, 258, 258, '#d3d4e1', '#eef0ff', 10); rounded(ctx, left + 7, 119, 244, 244, '#1e2d48', '#7689ad', 6);
      pixels.forEach((value, index) => rounded(ctx, 82 + group * 320 + index % 8 * 29, 130 + Math.floor(index / 8) * 29, 27, 27, PAINT_COLORS[value], '#4a5981', 2));
      for (let mark = 0; mark < 8; mark++) { ctx.fillStyle = '#72809c'; ctx.fillRect(left + 20 + mark * 29, 114, 2, 4); }
      rounded(ctx, left + 109, 365, 40, 17, '#7e849e', '#a1abc4', 3);
    });
    PAINT_COLORS.forEach((color, index) => { rounded(ctx, 236 + index * 65, 389, 53, 35, '#1c2c48', state.ink === index ? '#ffffff' : '#7c7191', 8); ctx.beginPath(); ctx.arc(262 + index * 65, 407, 13, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); label(ctx, index, 262 + index * 65, 407, 15, index ? '#101b30' : '#eef3ff', 'center'); });
    ctx.save(); ctx.translate(126, 408); ctx.rotate(-.35); rounded(ctx, -42, -5, 76, 10, '#bc9fe8', '#eddcff', 3); ctx.beginPath(); ctx.moveTo(34, -5); ctx.lineTo(48, 0); ctx.lineTo(34, 5); ctx.fillStyle = '#fff1cc'; ctx.fill(); ctx.restore();
    label(ctx, 'Mực ' + state.ink, 581, 407, 17, '#e8daff', 'center');
  }
  function drawGarden(ctx, state) {
    rounded(ctx, 29, 346, 662, 21, '#876d54', '#c6a47c', 7); rounded(ctx, 49, 365, 25, 67, '#695443', '#a18261', 5); rounded(ctx, 648, 365, 25, 67, '#695443', '#a18261', 5);
    state.plants.forEach((plant, index) => {
      const x = 150 + index * 210;
      ctx.beginPath(); ctx.ellipse(x, 351, 65, 10, 0, 0, Math.PI * 2); ctx.fillStyle = '#152b304f'; ctx.fill();
      rounded(ctx, x - 45, 292, 90, 58, ['#be8174', '#8d91b8', '#9f8a65'][index], '#f0ceae', 12);
      rounded(ctx, x - 52, 285, 104, 18, '#cba88c', '#e8d0af', 7);
      ctx.beginPath(); ctx.ellipse(x, 290, 43, 7, 0, 0, Math.PI * 2); ctx.fillStyle = '#503e39'; ctx.fill();
      for (let grain = 0; grain < 7; grain++) { ctx.fillStyle = '#967466'; ctx.fillRect(x - 33 + grain * 10, 289 + grain % 2 * 2, 3, 2); }
      const height = plant.harvested ? 27 : 31 + plant.growth * 139;
      ctx.strokeStyle = plant.health > .35 ? '#95c888' : '#b59e6d'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, 289); ctx.bezierCurveTo(x - 11, 263, x + 7, 289 - height + 20, x, 289 - height); ctx.stroke();
      const leafCount = plant.harvested ? 2 : 2 + Math.floor(plant.growth * 5);
      for (let leaf = 0; leaf < leafCount; leaf++) {
        const y = 282 - height * (leaf + 1) / (leafCount + 1), sign = leaf % 2 ? 1 : -1, spread = 13 + plant.growth * 16;
        ctx.beginPath(); ctx.ellipse(x + sign * spread * .6, y - 2, spread, 9 + index * 2, sign * -.5, 0, Math.PI * 2); ctx.fillStyle = plant.health > .35 ? ['#80bf90', '#8ac3a9', '#7ab8a7'][index] : '#a49c66'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x + sign * spread * 1.2, y - 8); ctx.strokeStyle = '#d0e8b477'; ctx.lineWidth = 1; ctx.stroke();
      }
      if (plant.growth >= 1 && !plant.harvested) {
        for (let petal = 0; petal < 6; petal++) { const angle = petal * Math.PI / 3; ctx.beginPath(); ctx.ellipse(x + Math.cos(angle) * 11, 285 - height + Math.sin(angle) * 11, 11, 7, angle, 0, Math.PI * 2); ctx.fillStyle = COLORS[index]; ctx.fill(); }
        ctx.beginPath(); ctx.arc(x, 285 - height, 7, 0, Math.PI * 2); ctx.fillStyle = '#ffe6aa'; ctx.fill();
      }
      rounded(ctx, x - 30, 315, 60, 22, '#f4e2bc', '#fef0d3', 5); label(ctx, index + 1, x, 327, 14, '#604d4d', 'center');
      label(ctx, PLANT_NAMES[index], x, 98, 16, '#e8f3d3', 'center');
      rounded(ctx, x - 55, 379, 110, 9, '#18384a', '#6b9eb5', 4); rounded(ctx, x - 54, 380, Math.max(1, 108 * plant.water), 7, plant.water > .8 || plant.water < .25 ? '#efb783' : '#93dfea', null, 3);
      label(ctx, 'Nước ' + Math.round(plant.water * 100) + '%', x, 404, 15, '#d1eef5', 'center'); label(ctx, plant.harvested ? '✓ Đã thu hoạch' : 'Lớn ' + Math.round(plant.growth * 100) + '%', x, 427, 15, '#d9edd5', 'center');
    });
  }
  function drawCafe(ctx, state, options) {
    const recipe = RECIPES[state.order], ingredientColors = ['#715148', '#f2dfbc', '#9c9e67', '#95cddd', '#c5eef3', '#c995b2'];
    rounded(ctx, 29, 86, 314, 228, '#263b3aee', '#bb9d7a', 13); rounded(ctx, 37, 94, 298, 212, '#193536', '#7f9183', 7);
    label(ctx, recipe.name, 186, 124, 25, '#ffe8bd', 'center'); label(ctx, 'PHA ĐÚNG THỨ TỰ', 186, 157, 13, '#b3d3c7', 'center');
    recipe.parts.forEach((part, i) => { rounded(ctx, 62, 181 + i * 34, 25, 24, '#405b52', '#8da893', 6); label(ctx, i + 1, 75, 193 + i * 34, 13, '#f0e6c6', 'center'); label(ctx, INGREDIENTS[part], 103, 193 + i * 34, 19, '#e4eee2'); });
    rounded(ctx, 408, 104, 233, 120, '#737e8de8', '#dce1e8', 14); rounded(ctx, 426, 120, 93, 43, '#203f48', '#a4bec5', 6); label(ctx, 'HH CAFÉ', 472, 142, 16, '#b5ece6', 'center');
    for (let light = 0; light < 3; light++) { ctx.beginPath(); ctx.arc(553 + light * 25, 140, 5, 0, Math.PI * 2); ctx.fillStyle = COLORS[light]; ctx.fill(); }
    rounded(ctx, 482, 181, 79, 15, '#394f60', '#b0c6d0', 4); rounded(ctx, 511, 194, 20, 21, '#c0c8d1', '#e6f5f4', 4);
    rounded(ctx, 20, 348, 680, 61, '#9a755bd9', '#e1bd99', 10); ctx.fillStyle = '#e3c09c'; ctx.fillRect(22, 349, 676, 7);
    for (let grain = 0; grain < 12; grain++) { ctx.fillStyle = '#735f4a66'; ctx.fillRect(42 + grain * 54, 375 + grain % 2 * 10, 32, 2); }
    ctx.beginPath(); ctx.ellipse(523, 349, 77, 12, 0, 0, Math.PI * 2); ctx.fillStyle = '#cfd7d4'; ctx.fill();
    rounded(ctx, 474, 235, 98, 107, '#f0e8d7', '#fff6e7', 13); rounded(ctx, 565, 255, 30, 45, '#92a8af33', '#f9f0e1', 10);
    const layers = state.cup.length;
    state.cup.forEach((part, i) => rounded(ctx, 484, 325 - i * 15, 78, 13, ingredientColors[part], null, 3));
    if (!layers) label(ctx, 'Trống', 523, 291, 17, '#8e8b83', 'center');
    if (layers && !state.cup.includes(4) && (state.cup.includes(0) || state.cup.includes(2))) {
      for (let steam = 0; steam < 3; steam++) { const drift = options.reducedMotion ? 0 : Math.sin(state.elapsed + steam) * 3; const x = 502 + steam * 20; ctx.beginPath(); ctx.moveTo(x, 228); ctx.bezierCurveTo(x - 8 + drift, 214, x + 10 + drift, 204, x, 191); ctx.strokeStyle = '#e2f0ed66'; ctx.lineWidth = 2; ctx.stroke(); }
    }
    label(ctx, 'Cốc: ' + layers + ' nguyên liệu', 523, 425, 16, '#f9e9cb', 'center');
    label(ctx, 'Khách chờ ' + Math.ceil(state.patience) + 's', 186, 334, 17, state.patience < 5 ? '#ffb7a2' : '#d1eee1', 'center');
    for (let cup = 0; cup < 8; cup++) rounded(ctx, 44 + cup * 33, 421, 22, 16, cup < state.served ? '#a0d5bc' : '#354c50', cup < state.served ? '#d5f2d9' : '#758f83', 4);
  }
  function drawRhythm(ctx, state) {
    rounded(ctx, 48, 89, 624, 335, '#16213de3', '#8d84b8', 25); rounded(ctx, 99, 117, 522, 112, '#091831', '#6a6d9f', 14);
    const left = 120, width = 480, relative = clamp((state.elapsed - state.nextBeat + .45) / .9, 0, 1), inside = Math.abs(state.elapsed - state.nextBeat) <= .17;
    rounded(ctx, left + width * (.5 - .17 / .9), 137, width * .34 / .9, 70, inside ? '#518d83' : '#315e62', '#82dbbd', 8);
    ctx.strokeStyle = '#8592c3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(360, 128); ctx.lineTo(360, 219); ctx.stroke();
    for (let dash = 0; dash < 9; dash++) { ctx.fillStyle = '#8fa6c933'; ctx.fillRect(left + dash * width / 8, 149, 1, 47); }
    const x = left + relative * width;
    ctx.beginPath(); ctx.arc(x, 171, 16, 0, Math.PI * 2); ctx.fillStyle = '#ffe099'; ctx.fill(); ctx.beginPath(); ctx.arc(x, 171, 23, 0, Math.PI * 2); ctx.strokeStyle = '#ffe09955'; ctx.lineWidth = 4; ctx.stroke();
    for (const speakerX of [127, 593]) { rounded(ctx, speakerX - 41, 260, 82, 126, '#233451', '#6f7e9f', 12); for (const [y, r] of [[289, 17], [344, 26]]) { ctx.beginPath(); ctx.arc(speakerX, y, r, 0, Math.PI * 2); ctx.fillStyle = '#0e1a31'; ctx.fill(); ctx.strokeStyle = '#9e98bf'; ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.arc(speakerX, y, r * .42, 0, Math.PI * 2); ctx.fillStyle = inside ? '#8fc7c1' : '#4e6086'; ctx.fill(); } }
    rounded(ctx, 237, 268, 246, 102, '#30365a', inside ? '#b9eadb' : '#8580b3', 20); label(ctx, inside ? 'CHẠM ĐÚNG VÙNG' : 'THEO CON TRỎ', 360, 301, 19, inside ? '#bdf5d9' : '#d6cff3', 'center'); label(ctx, 'Nhịp ' + Math.min(12, state.beat) + ' / 12', 360, 339, 24, '#ffe2a1', 'center');
    for (let beat = 0; beat < 12; beat++) rounded(ctx, 227 + beat * 23, 393, 15, 8, beat < state.hits ? '#a5ebca' : '#415272', null, 3);
  }

  const list = [simon, reaction, rhythm, whack, aim, math, colorWord, odd, pattern, treasure, lock, stack, constellation, painter, garden, cafe];
  return { games: Object.fromEntries(list.map(game => [game.id, game])), internals: { COLORS, COLOR_NAMES, PIXEL_PATTERNS, PAINT_COLORS, PLANT_NAMES, INGREDIENTS, RECIPES, neighbors, angularDistance } };
});
