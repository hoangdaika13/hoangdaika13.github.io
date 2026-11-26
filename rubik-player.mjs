import * as engine from "./rubik-engine.mjs?v=3";

export const defaultPuzzle = "3x3x3";
export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
export const cubeSize = (puzzle) => puzzle === "mirror" ? 3 : Number(/^([2-9])x\1x\1$/.exec(puzzle)?.[1] || 0);
export const normalize = (value) => String(value || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/đ/g, "d").replace(/’/g, "'").trim();
export const faceNames = { U: "Trên", R: "Phải", F: "Trước", D: "Dưới", L: "Trái", B: "Sau" };
const oppositeDisplay = { U: "D", D: "U", F: "B", B: "F" };
export const whiteBottomSticker = (color) => oppositeDisplay[color] || color;
export const whiteBottomState = (state) => state.replace(/[UDFB]/g, whiteBottomSticker);

export function describeCubeMove(move) {
  const parsed = /^(\d+)?([URFDLBMESxyz])(w)?(2|')?$/.exec(move);
  if (!parsed) return "";
  const [, depth, key, wide, suffix] = parsed;
  const axes = { M: "L", E: "D", S: "F", x: "R", y: "U", z: "F" };
  const lower = (face) => faceNames[face].toLowerCase();
  let action;
  if ("xyz".includes(key)) action = "Xoay cả khối quanh trục " + key;
  else if ("MES".includes(key)) action = "Xoay lớp giữa " + key;
  else if (wide) action = "Xoay cùng lúc " + (depth || "2") + " lớp tính từ mặt " + lower(key);
  else if (depth) action = "Xoay lớp thứ " + depth + " tính từ mặt " + lower(key);
  else action = "Xoay mặt " + lower(key);
  if (suffix === "2") return action + " 180°.";
  return action + " 90° " + (suffix === "'" ? "ngược" : "thuận") +
    " chiều kim đồng hồ khi nhìn thẳng mặt " + (axes[key] || key) + ".";
}

export function snapshot(puzzle, notation = "", facelets) {
  const size = cubeSize(puzzle);
  return size ? engine.applyMoves(facelets || engine.solvedFaces(size), notation, size) : null;
}

export function defaultScramble(puzzle) {
  const size = cubeSize(puzzle);
  if (size) return engine.scramble(size);
  if (typeof engine.scramblePuzzle === "function") return engine.scramblePuzzle(puzzle);
  return "";
}

export function diagram(facelets, size, { labels = false, focusLayer = false, description = "", mirror = false, changed, whiteBottom = false } = {}) {
  if (!facelets || !size) return "";
  if (mirror) {
    const holder = document.createElement("div");
    engine.renderCube2D(holder, facelets, size, { labels, mirror: true });
    if (description) holder.firstElementChild.setAttribute("aria-label", description + " · Mirror Cube");
    return holder.innerHTML;
  }
  return '<span class="rb-net" role="img" aria-label="' + esc(description || "Sơ đồ sáu mặt theo thứ tự trên, phải, trước, dưới, trái, sau") + '">' +
    [...engine.FACE_ORDER].map((face, i) => {
      const start = i * size ** 2;
      return '<span class="rb-face rb-face-' + face + '" style="--rb-n:' + size + '"><span class="rb-face-label">' + face + '</span>' +
        [...facelets.slice(start, start + size ** 2)].map((color, tile) => {
          const dim = focusLayer && (face === "D" || (face !== "U" && tile >= size));
          const styles = [dim && "rb-dim", changed?.has(start + tile) && "rb-changed"].filter(Boolean);
          const display = whiteBottom ? whiteBottomSticker(color) : color;
          return '<i class="' + styles.join(" ") + '" data-color="' + esc(display) + '">' + (labels ? esc(engine.COLOR_LABELS[display]) : "") + '</i>';
        }).join("") + '</span>';
    }).join("") + '</span>';
}

export function mountFormulaPreview(host, item, { labels = false, fallback } = {}) {
  const size = cubeSize(item.puzzle);
  if (!size) return engine.mountSpecialPreview(host, { ...item, fallback });
  const mirror = item.puzzle === "mirror";
  const state = snapshot(item.puzzle, item.setup || "");
  const facelets = !mirror && !item.nativePalette ? whiteBottomState(state) : state;
  const view = engine.renderCube3D(host, facelets, size, { labels, mirror });
  return () => view.destroy();
}

function control(text, action, label = "") {
  return '<button type="button" data-player="' + action + '"' + (label ? ' aria-label="' + label + '"' : "") + '>' + text + '</button>';
}

export function mountPlayer(host, { puzzle, setup = "", algorithm = "", facelets, free = false, labels = false, twoD = false, whiteBottom = false, onPreference, goal, goalAlgorithm, onGoal } = {}) {
  const size = cubeSize(puzzle);
  if (!size) {
    if (typeof engine.mountSpecialPuzzle === "function") return engine.mountSpecialPuzzle(host, { puzzle, setup, algorithm, free, labels, twoD, goalAlgorithm, onGoal });
    host.innerHTML = '<p class="rb-note">Khối này có hướng dẫn bằng chữ và video. Bạn có thể dùng Rubik thật để làm theo.</p>';
    return () => {};
  }

  let initial;
  let moves;
  let extraMoves = [];
  try {
    initial = snapshot(puzzle, setup, facelets);
    moves = engine.parseMoves(algorithm, size);
    if (free && goalAlgorithm) {
      const required = engine.parseMoves(goalAlgorithm, size);
      goal ??= engine.applyMoves(initial, required, size);
      extraMoves = [...new Set(required)].filter((move) => !/^[URFDLB](?:'|2)?$/.test(move));
    }
  } catch {
    host.innerHTML = '<p class="rb-note" role="status">Chưa mở được mô phỏng cho chuỗi xoay này. Bạn vẫn có thể đọc công thức và làm theo trên khối thật.</p>';
    return () => {};
  }

  let states = [initial];
  if (!free) for (const move of moves) states.push(engine.applyMoves(states.at(-1), move, size));
  let index = 0;
  let clock = 0;
  let view;
  let speed = 1;
  let reachedGoal = false;
  const mirror = puzzle === "mirror";
  const displayState = (state) => whiteBottom && !mirror ? whiteBottomState(state) : state;
  const abort = new AbortController();
  const keyHelp = "Chọn nút mặt để xoay. Có thể dùng phím U, R, F, D, L, B. Giữ Shift để đảo chiều.";
  host.innerHTML = '<div class="rb-board" tabindex="0" aria-label="' + esc(free ? keyHelp : "Mô hình Rubik") + '"></div>' +
    '<p class="rb-note" data-rb-view-help></p><div class="rb-controls">' + control(twoD ? "Xem 3D" : "Xem 2D", "mode") + control(mirror ? "Ký hiệu viên" : "Ký hiệu màu", "labels") +
    (free && !goal ? control("Xáo khối", "shuffle") : "") + '</div>' +
    '<div class="rb-controls">' + control("Đặt lại", "reset") + control("Lùi", "back", free ? "Hoàn tác" : "Lùi một nước") +
    (!free ? control("Phát", "play") : "") + control(free ? "Làm lại" : "Tiến một nước", "next") +
    (!free ? '<label class="rb-inline">Tốc độ <select data-player-speed><option value="0.25">0,25×</option><option value="0.5">0,5×</option><option value="1" selected>1×</option><option value="1.5">1,5×</option></select></label>' : "") + '</div>' +
    (free ? '<div class="rb-move-pad" aria-label="Xoay mặt Rubik">' + [...engine.FACE_ORDER].map((face) =>
      '<span>' + [face, face + "'", face + "2"].map((move) => '<button type="button" data-move="' + move + '">' + move + '</button>').join("") + '</span>'
    ).join("") + '</div>' + (extraMoves.length ? '<div class="rb-controls" aria-label="Xoay nhiều lớp và đổi hướng">' +
      extraMoves.map((move) => '<button type="button" data-move="' + esc(move) + '">' + esc(move) + '</button>').join("") + '</div>' : "") +
      '<p class="rb-note">' + keyHelp + '</p><details class="rb-move-controls"><summary>Xoay lớp trong, nhiều lớp hoặc cả khối</summary>' +
      '<div class="rb-filters"><label class="rb-field">Kiểu xoay<select data-rb-move-kind>' +
      (size > 2 ? '<option value="inner">Một lớp trong</option><option value="wide">Nhiều lớp liền nhau</option>' : '') +
      (size % 2 === 1 ? '<option value="slice">Lớp giữa M / E / S</option>' : '') +
      '<option value="axis">Cả khối x / y / z</option></select></label><label class="rb-field">Mặt hoặc trục<select data-rb-move-face></select></label>' +
      '<label class="rb-field" data-rb-depth-label>Vị trí hoặc số lớp<select data-rb-move-depth></select></label></div>' +
      '<div class="rb-controls" data-rb-move-extra></div></details>' : '<div class="rb-token-list" aria-label="Các nước đi"></div>') +
    '<p class="rb-player-status" role="status"></p>';
  const find = (selector) => host.querySelector(selector);
  const board = find(".rb-board");
  const status = find(".rb-player-status");
  const type = find("[data-rb-move-kind]");
  const face = find("[data-rb-move-face]");
  const depth = find("[data-rb-move-depth]");

  function showExtra(kindChanged = false) {
    if (!type) return;
    const kind = type.value;
    const layered = kind === "inner" || kind === "wide";
    if (kindChanged) {
      const faces = kind === "axis" ? "xyz" : kind === "slice" ? "MES" : engine.FACE_ORDER;
      face.replaceChildren(...[...faces].map((key) => new Option(faceNames[key] ? key + " · " + faceNames[key] : key, key)));
      depth.replaceChildren(...Array.from({ length: Math.max(size - 2, 0) }, (_, i) => new Option(i + 2, i + 2)));
    }
    find("[data-rb-depth-label]").hidden = !layered;
    const head = kind === "inner" ? depth.value + face.value : kind === "wide" ? (depth.value === "2" ? "" : depth.value) + face.value + "w" : face.value;
    find("[data-rb-move-extra]").innerHTML = ["", "'", "2"].map((tail) =>
      '<button type="button" data-move="' + esc(head + tail) + '">' + esc(head + tail) + '</button>').join("");
  }

  function createView() {
    view?.destroy();
    board.replaceChildren();
    try {
      const render = twoD ? engine.renderCube2D : engine.renderCube3D;
      view = render(board, displayState(states[index]), size, { labels, mirror });
    } catch {
      view = engine.renderCube2D(board, displayState(states[index]), size, { labels, mirror });
      twoD = true;
    }
    find('[data-player="mode"]').textContent = twoD ? "Xem 3D" : "Xem 2D";
    find('[data-player="labels"]').setAttribute("aria-pressed", String(labels));
    const viewHelp = twoD ? "Sơ đồ mở phẳng sáu mặt." : "Kéo trên khối hoặc dùng phím mũi tên để đổi góc nhìn.";
    const colorKey = labels && !mirror ? " Tr là trắng, V là vàng, Đ là đỏ, Ca là cam, Xl là xanh lá, Xd là xanh dương." : "";
    find("[data-rb-view-help]").textContent = viewHelp + colorKey;
  }

  function update(move) {
    view.update(displayState(states[index]), { move });
    find('[data-player="back"]').disabled = index === 0;
    find('[data-player="next"]').disabled = index === states.length - 1;
    if (free) {
      const solved = engine.isSolved(states[index], size);
      const meetsGoal = goal && [...goal].every((color, i) => color === "." || color === states[index][i]);
      status.textContent = meetsGoal ? "Đã hoàn thành mục tiêu." : solved ? "Khối đã về trạng thái giải." : index + " nước đã xoay.";
      if (meetsGoal && !reachedGoal && index > 0) {
        reachedGoal = true;
        onGoal?.();
      }
    } else {
      status.textContent = index + "/" + moves.length + " nước" + (index && moves.length ?
        " · " + moves[index - 1] + " · " + describeCubeMove(moves[index - 1]) : "");
      const list = find(".rb-token-list");
      list.innerHTML = moves.map((token, i) =>
        '<span' + (i === index - 1 ? ' aria-current="step"' : "") + '>' + esc(token) + '</span>'
      ).join("");
    }
  }

  function stop() {
    clearTimeout(clock);
    clock = 0;
    if (!free) find('[data-player="play"]').textContent = "Phát";
  }

  function turn(notation) {
    stop();
    states = states.slice(0, index + 1);
    states.push(engine.applyMoves(states[index], notation, size));
    index++;
    update(notation);
  }

  function tick() {
    if (index < states.length - 1) {
      index++;
      update(moves[index - 1]);
    }
    if (index < states.length - 1) clock = setTimeout(tick, 680 / speed);
    else stop();
  }

  host.addEventListener("click", (event) => {
    const turnButton = event.target.closest("[data-move]");
    if (turnButton) {
      turn(turnButton.dataset.move);
      return;
    }
    const button = event.target.closest("[data-player]");
    if (!button) return;
    const action = button.dataset.player;
    if (action === "play") {
      if (clock) stop();
      else if (moves.length) {
        if (index === moves.length) index = 0;
        button.textContent = "Tạm dừng";
        tick();
      }
      return;
    }
    stop();
    if (action === "reset") {
      index = 0;
      if (free) states = [initial];
    } else if (action === "back" && index > 0) {
      index--;
    } else if (action === "next" && index + 1 < states.length) {
      index++;
    } else if (action === "shuffle") {
      initial = snapshot(puzzle, defaultScramble(puzzle));
      states = [initial];
      index = 0;
    } else if (action === "mode" || action === "labels") {
      if (action === "mode") twoD = !twoD;
      else labels = !labels;
      createView();
      onPreference?.({ labels, twoD });
    }
    update(action === "next" && !free ? moves[index - 1] : undefined);
  }, { signal: abort.signal });
  host.addEventListener("change", (event) => {
    if (event.target.matches("[data-player-speed]")) speed = Number(event.target.value);
    if ([type, face, depth].includes(event.target)) showExtra(event.target === type);
  }, { signal: abort.signal });
  board.addEventListener("keydown", (event) => {
    const letter = event.key.toUpperCase();
    if (!free || letter.length !== 1 || !engine.FACE_ORDER.includes(letter) || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    turn(letter + (event.shiftKey ? "'" : ""));
  }, { signal: abort.signal });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); }, { signal: abort.signal });

  createView();
  showExtra(true);
  update();
  return () => {
    abort.abort();
    stop();
    view.destroy();
  };
}
