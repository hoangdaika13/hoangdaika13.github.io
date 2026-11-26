import * as engine from "./rubik-engine.mjs?v=1";
import { CASES, CASE_GROUPS } from "./rubik-cases.mjs?v=1";
import { averageOf, changeReview, formatTime, inspectionPenalty, mergeRecords, solveScore, validRecord } from "./rubik-progress.mjs?v=1";
import { cubeSize, defaultScramble, diagram, mountPlayer, snapshot } from "./rubik-player.mjs?v=1";

const RANDOM = (length) => Math.floor(Math.random() * length);
const scramblePuzzles = new Set(["pyraminx", "megaminx", "skewb", "square1", "square-1", "clock"]);
const paintFaces = { U: "Trên", R: "Phải", F: "Trước", D: "Dưới", L: "Trái", B: "Sau" };
const colorNames = { U: "Trắng", R: "Đỏ", F: "Xanh lá", D: "Vàng", L: "Cam", B: "Xanh dương" };
const paintOrder = ["F", "R", "B", "L", "U", "D"];

function solver(container, context) {
  const { esc, link, signal } = context;
  let palette = "U";
  const tiles = [...engine.solvedFaces(3)].map((color, i) => i % 9 === 4 ? color : "");
  let pending;
  let rendered;
  container.innerHTML = '<div class="rb-study"><form class="rb-panel rb-stack"><label class="rb-field">Cách nhập<select data-which>' +
    '<option value="color">Tô màu sáu mặt</option><option value="scramble">Dán chuỗi xáo</option></select></label>' +
    '<div data-paint><p>Đặt tâm trắng ở trên và tâm xanh lá ở trước. Nhìn trực diện khi tô từng mặt. Giữ trắng ở trên khi chuyển qua bốn mặt bên. ' +
    'Khi nhìn mặt U hoặc D, giữ cạnh giáp mặt F tương ứng ở dưới hoặc ở trên sơ đồ. Các tâm cố định theo bảng màu này.</p>' +
    '<div class="rb-palette" role="group" aria-label="Chọn màu tô">' + [...engine.FACE_ORDER].map((face) =>
      '<button type="button" aria-pressed="' + (face === palette) + '" data-palette="' + face + '"><i data-color="' + face +
      '" aria-hidden="true"></i>' + colorNames[face] + '</button>'
    ).join("") + '</div><div class="rb-paint-grid">' + paintOrder.map((face) => {
      const ix = engine.FACE_ORDER.indexOf(face) * 9;
      return '<fieldset><legend>' + paintFaces[face] + ' (' + face + ')</legend><div>' + Array.from({ length: 9 }, (_, j) =>
        '<button type="button" data-tile="' + (ix + j) + '"' + (j === 4 ? ' disabled data-color="' + face + '"' : "") +
        ' aria-label="' + paintFaces[face] + ', ô ' + (j + 1) + (j === 4 ? ": " + colorNames[face] : ": chưa tô") + '">' +
        (j === 4 ? face : "·") + '</button>'
      ).join("") + '</div></fieldset>';
    }).join("") + '</div><div class="rb-controls"><button class="rb-btn" type="button" data-fill>Xếp sẵn khối đã giải</button>' +
    '<button class="rb-btn" type="button" data-clear>Xóa màu đã tô</button></div></div>' +
    '<div data-scramble-form hidden><label class="rb-field">Chuỗi xáo<textarea rows="3" maxlength="600" placeholder="R U R\' U\'"></textarea></label>' +
    '<button class="rb-btn" type="button" data-sample>Tạo chuỗi xáo</button></div>' +
    '<div class="rb-controls"><button type="submit" class="rb-primary">Tìm lời giải</button>' +
    '<button type="button" data-cancel hidden>Hủy</button></div><p class="rb-result" role="status" data-solver-note></p>' +
    '</form><aside class="rb-panel rb-stack" data-result><h3>Lời giải từng nước</h3><p>Kết quả hiện ở đây sau khi kiểm tra trạng thái khối.</p>' +
    link("/rubik/hoc/notation", "Học phương pháp cơ bản") + '</aside></div>';
  const get = (selector) => container.querySelector(selector);
  const form = get("form");
  const note = get("[data-solver-note]");
  const result = get("[data-result]");
  const cancel = get("[data-cancel]");
  const submit = get("[type=submit]");
  const input = get("textarea");
  const which = get("[data-which]");

  function repaint() {
    for (const button of container.querySelectorAll("[data-tile]")) {
      const i = Number(button.dataset.tile);
      const tile = tiles[i];
      button.textContent = tile || "·";
      button.dataset.color = tile;
      button.setAttribute("aria-label", paintFaces[engine.FACE_ORDER[Math.floor(i / 9)]] + ", ô " + (1 + i % 9) + ": " + (colorNames[tile] || "chưa tô"));
    }
  }
  function setBusy(busy) {
    submit.disabled = busy;
    cancel.hidden = !busy;
    form.setAttribute("aria-busy", String(busy));
  }
  function stop() {
    pending?.abort();
    pending = undefined;
    setBusy(false);
  }
  function clearResult() {
    rendered?.();
    rendered = undefined;
    result.innerHTML = '<h3>Lời giải từng nước</h3><p>Kết quả sẽ hiện sau khi bạn bấm “Tìm lời giải”.</p>';
  }
  function changed() {
    stop();
    clearResult();
    note.textContent = "";
  }

  form.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-palette")) {
      palette = button.dataset.palette;
      for (const tile of form.querySelectorAll("[data-palette]")) tile.setAttribute("aria-pressed", String(tile === button));
    } else if (button.hasAttribute("data-tile")) {
      tiles[Number(button.dataset.tile)] = palette;
      changed();
      repaint();
    } else if (button.matches("[data-fill], [data-clear]")) {
      const fill = button.hasAttribute("data-fill");
      for (const i of tiles.keys()) tiles[i] = fill || i % 9 === 4 ? engine.FACE_ORDER[Math.floor(i / 9)] : "";
      changed();
      repaint();
    } else if (button.hasAttribute("data-sample")) {
      input.value = engine.scramble(3);
      changed();
    } else if (button === cancel) {
      stop();
      note.textContent = "Đã hủy tính lời giải.";
      submit.focus();
    }
  }, { signal });
  which.addEventListener("change", () => {
    get("[data-paint]").hidden = which.value !== "color";
    get("[data-scramble-form]").hidden = which.value !== "scramble";
    changed();
  }, { signal });
  input.addEventListener("input", changed, { signal });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (pending) return;
    clearResult();
    let facelets;
    try {
      if (which.value === "color") {
        const blank = tiles.findIndex((color) => !color);
        if (blank >= 0) {
          note.textContent = "Còn ô chưa tô ở mặt " + paintFaces[engine.FACE_ORDER[Math.floor(blank / 9)]].toLowerCase() + ".";
          get('[data-tile="' + blank + '"]').focus();
          return;
        }
        facelets = tiles.join("");
      } else {
        if (!input.value.trim()) {
          note.textContent = "Hãy nhập chuỗi xáo để bắt đầu.";
          input.focus();
          return;
        }
        facelets = engine.applyMoves(engine.solvedFaces(3), input.value, 3);
      }
      const validity = engine.validateFacelets(facelets);
      if (!validity.ok) {
        note.textContent = validity.error || "Khối không hợp lệ. Hãy kiểm tra cách tô và hướng cầm.";
        return;
      }
    } catch (error) {
      note.textContent = error.message || "Chuỗi xáo chưa hợp lệ.";
      return;
    }
    const request = new AbortController();
    pending = request;
    setBusy(true);
    note.textContent = "Đang tính lời giải…";
    try {
      const solution = await engine.solve3x3(facelets, { signal: request.signal });
      if (pending !== request || signal.aborted) return;
      const moves = engine.parseMoves(solution, 3);
      if (engine.applyMoves(facelets, solution, 3) !== engine.solvedFaces(3)) throw new Error("Không thể xác nhận kết quả.");
      note.textContent = moves.length ? "Đã kiểm tra lời giải trên trạng thái vừa nhập." : "Khối của bạn đã được giải.";
      result.innerHTML = '<h3>Lời giải bộ giải 3×3</h3><p>' + moves.length + ' nước xoay</p>' +
        (moves.length ? '<code class="rb-notation">' + esc(solution) + '</code><button type="button" class="rb-btn" data-copy>Sao chép lời giải</button>' : "") +
        '<div data-rb-solver-player></div>' + link("/rubik/hoc/notation", "Học phương pháp cơ bản");
      result.querySelector("[data-copy]")?.addEventListener("click", () => navigator.clipboard.writeText(solution).then(
        () => context.say("Đã sao chép lời giải."), () => context.say("Bạn có thể chọn và sao chép chuỗi nước đi.")
      ), { signal });
      rendered = mountPlayer(get("[data-rb-solver-player]"), { puzzle: "3x3x3", facelets, algorithm: solution, labels: context.value.labels, twoD: context.value.twoD });
    } catch (error) {
      if (!request.signal.aborted && !signal.aborted) note.textContent = error.message || "Chưa tìm được lời giải. Hãy thử lại.";
    } finally {
      if (pending === request) stop();
    }
  }, { signal });
  context.cleanups.push(() => { pending?.abort(); rendered?.(); });
}

function trainer(container, context) {
  const { esc, selectPuzzle, signal, value, store } = context;
  const cases = CASES.filter((row) => row.puzzle === context.puzzle && row.setup && cubeSize(row.puzzle));
  const groups = CASE_GROUPS.filter((group) => cases.some((item) => group.id === item.group));
  container.innerHTML = '<div class="rb-panel rb-stack"><div class="rb-filters">' + selectPuzzle(context.puzzle) +
    '<label class="rb-field">Bộ công thức<select data-set><option value="">Tất cả</option>' +
    groups.map((group) => '<option value="' + esc(group.id) + '">' + esc(group.name) + '</option>').join("") + '</select></label>' +
    '<label class="rb-field">Chế độ<select data-exercise><option value="recognize">Nhìn hình đoán trường hợp</option>' +
    '<option value="step">Chọn nước tiếp theo</option><option value="recall">Nhớ công thức</option>' +
    '<option value="turn">Tự xoay để hoàn thành</option></select></label>' +
    '<label class="rb-field">Ưu tiên<select data-priority><option value="due">Đến hạn hoặc hay sai</option><option value="all">Ngẫu nhiên</option>' +
    '<option value="favorite">Yêu thích</option></select></label></div>' +
    '<div data-trainer-body></div><p role="status" data-trainer-feedback></p><div class="rb-controls">' +
    '<button type="button" data-new-exercise class="rb-primary">Đổi trường hợp</button><span data-trainer-source></span></div></div>';
  let cleanup;
  let selected;
  let answered = false;
  let moves = [];
  let start = null;
  let correctChoice = "";
  let expected = "";
  const body = container.querySelector("[data-trainer-body]");
  const feedback = container.querySelector("[data-trainer-feedback]");
  const source = container.querySelector("[data-trainer-source]");
  const get = (selector) => container.querySelector(selector);
  function check(correct) {
    if (answered || !selected) return;
    answered = true;
    changeReview(value, selected.id, { correct });
    store.save();
    feedback.textContent = (correct ? "Đúng. " : "Hãy thử lại ở lượt sau. ") + selected.name + " · " + selected.algorithm +
      (selected.tip ? " · " + selected.tip : "");
    source.innerHTML = context.link(context.casePath(selected.id), "Xem ảnh và video");
    for (const button of body.querySelectorAll("[data-answer], [data-check-recall]")) button.disabled = true;
  }
  function exercise() {
    cleanup?.();
    cleanup = undefined;
    const set = get("[data-set]").value;
    const mode = get("[data-exercise]").value;
    const priority = get("[data-priority]").value;
    let pool = cases.filter((item) => (!set || item.group === set) && (priority !== "favorite" || value.reviews[item.id]?.favorite));
    if (priority === "due") {
      const score = (caseId) => {
        const row = value.reviews[caseId] || {};
        return (row.due <= Date.now() ? 100 : 0) + (row.wrong || 0) * 2 - (row.streak || 0);
      };
      pool = pool.sort((a, b) => score(b.id) - score(a.id)).slice(0, Math.max(6, Math.ceil(pool.length / 4)));
    }
    const choices = pool.filter((item) => item.id !== selected?.id);
    selected = choices.length ? choices[RANDOM(choices.length)] : pool[0];
    feedback.textContent = "";
    source.innerHTML = "";
    answered = false;
    if (!selected) {
      body.textContent = "Chưa có trường hợp phù hợp với bộ lọc luyện tập này.";
      return;
    }
    const size = cubeSize(selected.puzzle);
    try {
      start = snapshot(selected.puzzle, selected.setup);
      moves = engine.parseMoves(selected.algorithm, size);
      expected = snapshot(selected.puzzle, selected.algorithm, start);
    } catch {
      body.textContent = "Chưa dựng được trạng thái cho trường hợp này.";
      return;
    }
    if (mode === "turn") {
      body.innerHTML = '<h3>' + esc(selected.name) + '</h3><p>Đưa khối đến trạng thái mục tiêu. Bạn có thể dùng cách xoay khác để đạt cùng kết quả.</p>' +
        '<details><summary>Xem hình mục tiêu</summary>' + diagram(expected, size) + '</details><div data-turn-practice></div>';
      cleanup = mountPlayer(get("[data-turn-practice]"), {
        puzzle: selected.puzzle, facelets: start, free: true, goal: expected,
        labels: value.labels, twoD: value.twoD, onGoal: () => check(true)
      });
      return;
    }
    const net = diagram(start, size, { labels: value.labels, description: "Trạng thái khối cần nhận diện" });
    if (mode === "recall") {
      body.innerHTML = '<h3>Viết chuỗi nước đi cho ' + esc(selected.name) + '</h3><div class="rb-practice-net">' + net +
        '</div><label class="rb-field">Công thức của bạn<input data-recall maxlength="600" autocomplete="off"></label>' +
        '<button type="button" class="rb-btn" data-check-recall>Kiểm tra</button>';
      return;
    }
    const names = mode === "step" ? [...new Set([moves[0], "R", "U'", "F", "R2", "U2"])] :
      [...new Set([selected.name, ...cases.filter((item) => item.group === selected.group && item.id !== selected.id)
        .sort(() => Math.random() - 0.5).slice(0, 3).map((row) => row.name)])];
    correctChoice = mode === "step" ? moves[0] : selected.name;
    const options = names.slice(0, 4);
    for (let i = options.length - 1; i > 0; i--) {
      const j = RANDOM(i + 1);
      [options[i], options[j]] = [options[j], options[i]];
    }
    body.innerHTML = '<h3>' + (mode === "step" ? "Nước xoay đầu tiên là gì?" : "Đây là trường hợp nào?") +
      '</h3><div class="rb-practice-net">' + net + '</div><div class="rb-controls">' + options.map((name) =>
        '<button type="button" class="rb-btn" data-answer="' + esc(name) + '">' + esc(name) + '</button>'
      ).join("") + '</div>';
  }
  container.addEventListener("change", (event) => { if (event.target.matches("[data-set], [data-exercise], [data-priority]")) exercise(); }, { signal });
  container.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-new-exercise")) exercise();
    else if (button.hasAttribute("data-answer")) check(button.dataset.answer === correctChoice);
    else if (button.hasAttribute("data-check-recall")) {
      try {
        check(snapshot(selected.puzzle, get("[data-recall]").value, start) === expected);
      } catch (error) {
        feedback.textContent = error.message || "Chuỗi vừa nhập chưa hợp lệ.";
      }
    }
  }, { signal });
  exercise();
  context.cleanups.push(() => cleanup?.());
}

function timer(container, context) {
  const { esc, selectPuzzle, signal, value, store } = context;
  const puzzle = context.puzzle;
  container.innerHTML = '<div class="rb-stack"><div class="rb-panel rb-stack"><div class="rb-filters">' + selectPuzzle(puzzle) +
    '<label class="rb-check"><input type="checkbox" data-inspection> Có thời gian quan sát 15 giây</label></div>' +
    '<span class="rb-eyebrow">Chuỗi xáo luyện tập</span><code class="rb-notation" data-timer-scramble></code>' +
    '<div class="rb-clock" tabindex="0" aria-label="Đồng hồ. Dùng phím cách để bắt đầu hoặc dừng." data-clock>0,00 s</div><p class="rb-note" data-timer-phase>Bấm nút hoặc phím cách khi đặt tiêu điểm ở đồng hồ.</p>' +
    '<div class="rb-controls"><button class="rb-primary" type="button" data-start>Bắt đầu</button><button type="button" data-new-scramble>Xáo mới</button></div></div>' +
    '<section class="rb-panel rb-stack" data-history></section></div>';
  const get = (selector) => container.querySelector(selector);
  const readout = get("[data-clock]");
  const phase = get("[data-timer-phase]");
  const startButton = get("[data-start]");
  const refresh = get("[data-new-scramble]");
  const check = get("[data-inspection]");
  let scramble = "";
  let started = 0;
  let status = "idle";
  let penalty = "ok";
  let frame = 0;
  let request = 0;
  const supported = cubeSize(puzzle) || scramblePuzzles.has(puzzle);

  async function newScramble() {
    const token = ++request;
    scramble = "";
    startButton.disabled = true;
    const sequence = get("[data-timer-scramble]");
    sequence.textContent = "Đang tạo chuỗi…";
    try {
      const next = supported ? await defaultScramble(puzzle) : "";
      if (token !== request || signal.aborted) return;
      scramble = next || "";
    } catch { /* An unsupported type remains gated. */ }
    if (token !== request || signal.aborted) return;
    sequence.textContent = scramble || "Khối này chưa hỗ trợ tạo chuỗi xáo.";
    startButton.disabled = !scramble;
  }

  function history() {
    const rows = value.records.filter((row) => row.puzzle === puzzle);
    const best = rows.length ? Math.min(...rows.map(solveScore)) : null;
    get("[data-history]").innerHTML = '<h3>Lịch sử lượt giải</h3><div class="rb-stats">' + [
      ["Kỷ lục", best], ["ao5", averageOf(rows, 5)], ["ao12", averageOf(rows, 12)]
    ].map(([label, ms]) => '<div><strong>' + formatTime(ms) + '</strong><span>' + label + '</span></div>').join("") +
      '</div><p class="rb-note">ao5 và ao12 lấy các lượt gần nhất, bỏ một lượt nhanh nhất và một lượt chậm nhất, rồi tính trung bình. ' +
      '+2 cộng hai giây. DNF còn lại sau khi bỏ lượt tệ nhất làm trung bình thành DNF.</p><div class="rb-controls">' +
      '<button type="button" data-export>Xuất lịch sử</button><label class="rb-file">Nhập lịch sử<input type="file" accept=".json,application/json" data-import></label></div>' +
      (rows.length ? '<ul class="rb-timer-list">' + rows.slice(0, 60).map((row) => (
        '<li><div><strong>' + formatTime(solveScore(row)) + '</strong> <time datetime="' + new Date(row.time).toISOString() + '">' +
        esc(new Date(row.time).toLocaleString("vi-VN")) + '</time><code>' + esc(row.scramble) + '</code></div>' +
        '<label>Phạt <select data-penalty="' + esc(row.id) + '">' + [["ok", "Không"], ["+2", "+2"], ["DNF", "DNF"]].map(([key, label]) =>
          '<option value="' + key + '"' + (key === row.penalty ? " selected" : "") + '>' + label + '</option>'
        ).join("") + '</select></label></li>'
      )).join("") + '</ul>' : '<p>Hoàn thành một lượt giải để có thống kê.</p>');
  }

  function tick(now) {
    const ms = Math.max(0, now - started);
    if (status === "running") readout.textContent = formatTime(ms);
    else if (status === "inspection") {
      readout.textContent = ms >= 17000 ? "DNF" : ms >= 15000 ? "+2" : formatTime(15000 - ms);
    }
    if (status !== "idle") frame = requestAnimationFrame(tick);
  }

  function action() {
    if (!scramble) return;
    const now = performance.now();
    if (status === "idle") {
      started = now;
      status = check.checked ? "inspection" : "running";
      penalty = "ok";
      refresh.disabled = true;
      check.disabled = true;
      phase.textContent = check.checked ? "Quan sát khối. Nhấn bắt đầu giải khi sẵn sàng." : "Đang bấm giờ.";
      startButton.textContent = check.checked ? "Bắt đầu giải" : "Dừng và lưu";
      frame = requestAnimationFrame(tick);
    } else if (status === "inspection") {
      penalty = inspectionPenalty(now - started);
      started = now;
      status = "running";
      phase.textContent = "Đang bấm giờ" + (penalty !== "ok" ? " · " + penalty : "") + ".";
      startButton.textContent = "Dừng và lưu";
    } else {
      status = "idle";
      cancelAnimationFrame(frame);
      const row = { id: crypto.randomUUID(), puzzle, ms: Math.round(now - started), time: Date.now(), scramble, penalty };
      if (validRecord(row)) {
        value.records = mergeRecords(value.records, [row]);
        store.save();
        readout.textContent = formatTime(solveScore(row));
        phase.textContent = "Đã ghi lượt giải.";
        history();
      } else {
        phase.textContent = "Lượt vừa rồi vượt thời lượng có thể lưu.";
      }
      startButton.textContent = "Bắt đầu";
      refresh.disabled = false;
      check.disabled = false;
      newScramble();
    }
  }
  startButton.addEventListener("click", action, { signal });
  readout.addEventListener("keydown", (event) => {
    if (event.code !== "Space") return;
    event.preventDefault();
    if (!event.repeat) action();
  }, { signal });
  refresh.addEventListener("click", newScramble, { signal });
  get("[data-history]").addEventListener("change", async (event) => {
    const target = event.target;
    if (target.matches("[data-penalty]")) {
      const row = value.records.find((item) => item.id === target.dataset.penalty);
      if (row && ["ok", "+2", "DNF"].includes(target.value)) {
        row.penalty = target.value;
        store.save();
        history();
        [...container.querySelectorAll("[data-penalty]")].find((input) => input.dataset.penalty === row.id)?.focus();
      }
    } else if (target.matches("[data-import]")) {
      try {
        const file = target.files[0];
        if (!file || file.size > 2_500_000) throw new Error("Tệp vượt quá giới hạn.");
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data.records) || data.version !== 1 || !data.records.every(validRecord)) throw new Error("Dữ liệu lịch sử chưa hợp lệ.");
        if (signal.aborted) return;
        value.records = mergeRecords(value.records, data.records);
        store.save();
        history();
        context.say("Đã nhập lịch sử.");
      } catch (error) {
        context.say(error.message);
      }
    }
  }, { signal });
  get("[data-history]").addEventListener("click", (event) => {
    if (!event.target.closest("[data-export]")) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, records: value.records }, null, 2)], { type: "application/json" }));
    const file = document.createElement("a");
    file.href = url;
    file.download = "rubik-lich-su.json";
    file.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }, { signal });
  newScramble();
  history();
  context.cleanups.push(() => cancelAnimationFrame(frame));
}

export function mountTool(container, page, context) {
  if (page === "giai-khoi") solver(container, context);
  if (page === "luyen-tap") trainer(container, context);
  if (page === "dong-ho") timer(container, context);
}
