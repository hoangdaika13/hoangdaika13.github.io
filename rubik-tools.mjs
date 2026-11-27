import * as engine from "./rubik-engine.mjs?v=4";
import { mountTrainer } from "./rubik-trainer.mjs?v=3";
import { averageOf, formatTime, inspectionPenalty, mergeRecords, solveScore, validRecord } from "./rubik-progress.mjs?v=2";
import { cubeSize, defaultScramble, mountPlayer, whiteBottomSticker } from "./rubik-player.mjs?v=4";

const scramblePuzzles = new Set(["pyraminx", "megaminx", "skewb", "square1", "square-1", "clock"]);
const paintFaces = { U: "Trên", R: "Phải", F: "Trước", D: "Dưới", L: "Trái", B: "Sau" };
const colorNames = { U: "Vàng", R: "Đỏ", F: "Xanh dương", D: "Trắng", L: "Cam", B: "Xanh lá" };
const paintOrder = ["F", "R", "B", "L", "U", "D"];

function solver(container, context) {
  const { esc, link, signal } = context;
  let palette = "U";
  const tiles = [...engine.solvedFaces(3)].map((color, i) => i % 9 === 4 ? color : "");
  let pending;
  let rendered;
  const resultHelp = '<div class="rb-solve-empty"><strong>Chuẩn bị khối để giải</strong>' +
    '<p>Tô màu sáu mặt hoặc nhập chuỗi xáo để xem lời giải trên mô hình tương tác.</p>' +
    link("/rubik/hoc/notation", "Học cách đọc ký hiệu") + '</div>';
  const emptyResult = '<h3>Lời giải từng nước</h3>' + resultHelp;
  container.innerHTML = '<div class="rb-study rb-tool-solver"><form class="rb-panel rb-stack rb-solve-input"><div class="rb-tool-heading">' +
    '<h3>Nhập khối 3×3</h3><label class="rb-field">Cách nhập<select data-which>' +
    '<option value="color">Tô màu sáu mặt</option><option value="scramble">Dán chuỗi xáo</option></select></label></div>' +
    '<div class="rb-stack rb-paint-workspace" data-paint><p class="rb-paint-orientation"><span><b>D</b> Trắng dưới</span><span><b>U</b> Vàng trên</span><span><b>F</b> Xanh dương trước</span></p>' +
    '<details class="rb-paint-directions"><summary>Cách cầm khối khi tô</summary><p>Nhìn trực diện vào từng mặt. Giữ vàng ở trên khi chuyển qua bốn mặt bên. ' +
    'Khi nhìn mặt trên U, đặt cạnh giáp mặt F ở dưới sơ đồ. Khi nhìn mặt dưới D, đặt cạnh giáp mặt F ở trên sơ đồ. Các ô tâm đã có màu cố định.</p></details>' +
    '<div><h4>Chọn màu rồi chạm vào ô</h4><div class="rb-palette" role="group" aria-label="Chọn màu tô">' + [...engine.FACE_ORDER].map((face) =>
      '<button type="button" aria-pressed="' + (face === palette) + '" data-palette="' + face + '"><i data-color="' + whiteBottomSticker(face) +
      '" aria-hidden="true"></i>' + colorNames[face] + '</button>'
    ).join("") + '</div></div><div class="rb-paint-meter" data-paint-meter><progress max="48" value="0" aria-label="Số ô đã tô"></progress><span data-paint-count>0/48 ô đã tô</span></div>' +
    '<div class="rb-paint-grid">' + paintOrder.map((face) => {
      const ix = engine.FACE_ORDER.indexOf(face) * 9;
      return '<fieldset><legend>' + paintFaces[face] + ' (' + face + ')</legend><div>' + Array.from({ length: 9 }, (_, j) =>
        '<button type="button" data-tile="' + (ix + j) + '"' + (j === 4 ? ' disabled data-color="' + whiteBottomSticker(face) + '"' : "") +
        ' aria-label="' + paintFaces[face] + ', ô ' + (j + 1) + (j === 4 ? ": " + colorNames[face] : ": chưa tô") + '">' +
        (j === 4 ? face : "·") + '</button>'
      ).join("") + '</div></fieldset>';
    }).join("") + '</div><div class="rb-controls"><button class="rb-btn" type="button" data-fill>Xếp sẵn khối đã giải</button>' +
    '<button class="rb-btn" type="button" data-clear>Xóa màu đã tô</button></div></div>' +
    '<div class="rb-stack" data-scramble-form hidden><label class="rb-field">Chuỗi xáo<textarea rows="3" maxlength="600" autocapitalize="off" spellcheck="false" placeholder="R U R\' U\'"></textarea></label>' +
    '<div class="rb-controls"><button class="rb-btn" type="button" data-sample>Tạo chuỗi xáo</button></div></div>' +
    '<div class="rb-solve-footer"><div class="rb-controls"><button type="submit" class="rb-primary">Tìm lời giải</button>' +
    '<button type="button" data-cancel hidden>Hủy</button></div><p class="rb-solve-status" role="status" data-solver-note></p></div>' +
    '</form><aside class="rb-panel rb-stack rb-solve-result" data-result>' + emptyResult + '</aside></div>';
  const get = (selector) => container.querySelector(selector);
  const form = get("form");
  const note = get("[data-solver-note]");
  const result = get("[data-result]");
  const cancel = get("[data-cancel]");
  const submit = get("[type=submit]");
  const input = get("textarea");
  const which = get("[data-which]");
  const meter = get("[data-paint-meter]");
  const paintedCount = get("[data-paint-count]");
  const paintProgress = meter.querySelector("progress");

  function setNote(text, tone = "") {
    note.textContent = text;
    note.dataset.tone = tone;
  }

  function repaint() {
    paintProgress.value = tiles.filter(Boolean).length - 6;
    paintedCount.textContent = paintProgress.value + "/48 ô đã tô";
    meter.toggleAttribute("data-complete", paintProgress.value === 48);
    for (const button of container.querySelectorAll("[data-tile]")) {
      const i = Number(button.dataset.tile);
      const tile = tiles[i];
      const displayColor = whiteBottomSticker(tile);
      button.textContent = i % 9 === 4 ? tile : engine.COLOR_LABELS[displayColor] || "·";
      button.dataset.color = displayColor;
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
    delete result.dataset.solved;
    result.innerHTML = emptyResult;
  }
  function changed() {
    stop();
    clearResult();
    setNote("");
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
      setNote("Đã hủy tính lời giải.");
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
          setNote("Còn ô chưa tô ở mặt " + paintFaces[engine.FACE_ORDER[Math.floor(blank / 9)]].toLowerCase() + ".", "error");
          get('[data-tile="' + blank + '"]').focus();
          return;
        }
        facelets = tiles.join("");
      } else {
        if (!input.value.trim()) {
          setNote("Hãy nhập chuỗi xáo để bắt đầu.", "error");
          input.focus();
          return;
        }
        facelets = engine.applyMoves(engine.solvedFaces(3), input.value, 3);
      }
      const validity = engine.validateFacelets(facelets);
      if (!validity.ok) {
        setNote(validity.error || "Khối không hợp lệ. Hãy kiểm tra cách tô và hướng cầm.", "error");
        return;
      }
    } catch (error) {
      setNote(error.message || "Chuỗi xáo chưa hợp lệ.", "error");
      return;
    }
    const request = new AbortController();
    pending = request;
    setBusy(true);
    setNote("Đang tính lời giải…");
    try {
      const solution = await engine.solve3x3(facelets, { signal: request.signal });
      if (pending !== request || signal.aborted) return;
      const moves = engine.parseMoves(solution, 3);
      if (engine.applyMoves(facelets, solution, 3) !== engine.solvedFaces(3)) throw new Error("Không thể xác nhận kết quả.");
      setNote(moves.length ? "Đã kiểm tra lời giải trên trạng thái vừa nhập." : "Khối của bạn đã được giải.", "success");
      result.dataset.solved = "";
      result.innerHTML = '<div class="rb-tool-heading"><h3>Lời giải từng nước</h3><span class="rb-tool-label">' + moves.length + ' nước xoay</span></div>' +
        '<div data-rb-solver-player></div>' +
        (moves.length ? '<code class="rb-notation">' + esc(solution) + '</code><div class="rb-controls"><button type="button" class="rb-btn" data-copy>Sao chép lời giải</button></div>' : "") +
        '<div class="rb-controls">' + link("/rubik/hoc/notation", "Học cách đọc ký hiệu") + '</div>';
      result.querySelector("[data-copy]")?.addEventListener("click", () => navigator.clipboard.writeText(solution).then(
        () => context.say("Đã sao chép lời giải."), () => context.say("Bạn có thể chọn và sao chép chuỗi nước đi.")
      ), { signal });
      rendered = mountPlayer(get("[data-rb-solver-player]"), {
        puzzle: "3x3x3", facelets, algorithm: solution, labels: context.value.labels, twoD: context.value.twoD, whiteBottom: true
      });
    } catch (error) {
      if (!request.signal.aborted && !signal.aborted) setNote(error.message || "Chưa tìm được lời giải. Hãy thử lại.", "error");
    } finally {
      if (pending === request) stop();
    }
  }, { signal });
  context.cleanups.push(() => { pending?.abort(); rendered?.(); });
}

function timer(container, context) {
  const { esc, selectPuzzle, signal, value, store } = context;
  const puzzle = context.puzzle;
  container.innerHTML = '<div class="rb-tool-timer"><section class="rb-panel rb-stack rb-timer-session" aria-label="Lượt giải">' +
    '<div class="rb-filters">' + selectPuzzle(puzzle) +
    '<label class="rb-check rb-inspection-toggle"><input type="checkbox" data-inspection> Quan sát khối 15 giây</label></div>' +
    '<div class="rb-scramble"><h3>Chuỗi xáo</h3><code class="rb-notation" data-timer-scramble></code></div>' +
    '<div class="rb-clock-station" data-timer-state="idle"><div class="rb-clock" role="timer" tabindex="0" aria-label="Đồng hồ. Dùng phím cách để bắt đầu hoặc dừng." data-clock>0,00 s</div>' +
    '<p class="rb-note" data-timer-phase>Bấm nút hoặc phím cách khi đặt tiêu điểm ở đồng hồ.</p>' +
    '<div class="rb-inspection-track" aria-hidden="true"></div></div>' +
    '<div class="rb-controls"><button class="rb-primary" type="button" data-start>Bắt đầu</button><button type="button" data-new-scramble>Xáo mới</button></div>' +
    '<p class="rb-timer-feedback" role="status" data-timer-feedback hidden></p></section>' +
    '<section class="rb-panel rb-stack rb-timer-history" data-history></section></div>';
  const get = (selector) => container.querySelector(selector);
  const readout = get("[data-clock]");
  const phase = get("[data-timer-phase]");
  const station = get("[data-timer-state]");
  const feedback = get("[data-timer-feedback]");
  const startButton = get("[data-start]");
  const refresh = get("[data-new-scramble]");
  const check = get("[data-inspection]");
  let scramble = "";
  let started = 0;
  let status = "idle";
  let penalty = "ok";
  let frame = 0;
  let request = 0;
  let lastRecord;
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
    get("[data-history]").innerHTML = '<div class="rb-tool-heading"><h3>Lịch sử lượt giải</h3>' +
      '<span class="rb-tool-label">' + rows.length + ' lượt</span></div><div class="rb-stats">' + [
      ["Kỷ lục", best], ["ao5", averageOf(rows, 5)], ["ao12", averageOf(rows, 12)]
    ].map(([label, ms]) => '<div><strong>' + formatTime(ms) + '</strong><span>' + label + '</span></div>').join("") +
      '</div><details class="rb-timer-help"><summary>Cách tính ao5 và ao12</summary><p class="rb-note">Lấy 5 hoặc 12 lượt gần nhất, bỏ lượt nhanh nhất và chậm nhất, rồi tính trung bình. ' +
      '+2 cộng hai giây. Nếu còn lượt DNF sau khi bỏ lượt chậm nhất, kết quả trung bình là DNF.</p></details>' +
      (rows.length ? '<ul class="rb-timer-list">' + rows.slice(0, 60).map((row) => (
        '<li><div><strong>' + formatTime(solveScore(row)) + '</strong> <time datetime="' + new Date(row.time).toISOString() + '">' +
        esc(new Date(row.time).toLocaleString("vi-VN")) + '</time><code>' + esc(row.scramble) + '</code></div>' +
        '<label class="rb-field">Phạt<select data-penalty="' + esc(row.id) + '">' + [["ok", "Không"], ["+2", "+2"], ["DNF", "DNF"]].map(([key, label]) =>
          '<option value="' + key + '"' + (key === row.penalty ? " selected" : "") + '>' + label + '</option>'
        ).join("") + '</select></label></li>'
      )).join("") + '</ul>' : '<p class="rb-history-empty">Hoàn thành một lượt giải để có thống kê.</p>') +
      '<div class="rb-controls"><button type="button" data-export>Xuất lịch sử</button>' +
      '<label class="rb-file">Nhập lịch sử<input type="file" accept=".json,application/json" data-import aria-label="Nhập lịch sử"></label></div>';
  }

  function tick(now) {
    const ms = Math.max(0, now - started);
    if (status === "running") readout.textContent = formatTime(ms);
    else if (status === "inspection") {
      readout.textContent = ms >= 17000 ? "DNF" : ms >= 15000 ? "+2" : formatTime(15000 - ms);
      station.style.setProperty("--rb-time-remaining", String(Math.max(0, 1 - ms / 15000)));
    }
    if (status !== "idle") frame = requestAnimationFrame(tick);
  }

  function refreshRecordFeedback(saved) {
    if (status !== "idle" || feedback.hidden || !lastRecord) return;
    const row = value.records.find((entry) => entry.id === lastRecord);
    if (row) announceRecord(row, saved);
  }

  function announceRecord(row, saved) {
    const score = solveScore(row);
    const previous = value.records.filter((entry) => entry.id !== row.id && entry.puzzle === puzzle && Number.isFinite(solveScore(entry)));
    const best = Number.isFinite(score) && previous.every((entry) => solveScore(entry) > score);
    const title = best ? (previous.length ? "Kỷ lục mới" : "Lượt giải đầu tiên") : "Đã ghi lượt giải";
    readout.textContent = formatTime(score);
    feedback.dataset.tone = best ? "best" : "success";
    feedback.textContent = title + " · " + formatTime(score) + (saved ? "" : ". Kết quả được giữ trong phiên này.");
    feedback.hidden = false;
  }

  function action() {
    if (!scramble) return;
    const now = performance.now();
    if (status === "idle") {
      feedback.hidden = true;
      station.style.removeProperty("--rb-time-remaining");
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
      lastRecord = undefined;
      const row = { id: crypto.randomUUID(), puzzle, ms: Math.round(now - started), time: Date.now(), scramble, penalty };
      if (validRecord(row)) {
        lastRecord = row.id;
        value.records = mergeRecords(value.records, [row]);
        announceRecord(row, store.save());
        phase.textContent = "Bắt đầu lượt giải tiếp theo khi sẵn sàng.";
        history();
      } else {
        phase.textContent = "Sẵn sàng cho lượt mới.";
        feedback.dataset.tone = "error";
        feedback.textContent = "Lượt vừa rồi vượt thời lượng có thể lưu.";
        feedback.hidden = false;
      }
      startButton.textContent = "Bắt đầu";
      refresh.disabled = false;
      check.disabled = false;
      newScramble();
    }
    station.dataset.timerState = status;
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
        const saved = store.save();
        refreshRecordFeedback(saved);
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
        refreshRecordFeedback(store.save());
        history();
        context.say("Đã nhập lịch sử.");
      } catch (error) {
        if (!signal.aborted) context.say(error.message);
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
  if (page === "luyen-tap") mountTrainer(container, context);
  if (page === "dong-ho") timer(container, context);
}
