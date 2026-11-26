import * as engine from "./rubik-engine.mjs?v=1";

export const defaultPuzzle = "3x3x3";
export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
export const cubeSize = (puzzle) => puzzle === "mirror" ? 3 : Number(/^([2-7])x\1x\1$/.exec(puzzle)?.[1] || 0);
export const normalize = (value) => String(value || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/đ/g, "d").replace(/’/g, "'").trim();
export const faceNames = { U: "Trên", R: "Phải", F: "Trước", D: "Dưới", L: "Trái", B: "Sau" };

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

export function diagram(facelets, size, { labels = false, focusLayer = false, description = "" } = {}) {
  if (!facelets || !size) return "";
  return '<span class="rb-net" role="img" aria-label="' + esc(description || "Sơ đồ sáu mặt theo thứ tự trên, phải, trước, dưới, trái, sau") + '">' +
    [...engine.FACE_ORDER].map((face, i) => {
      const start = i * size ** 2;
      return '<span class="rb-face rb-face-' + face + '" style="--rb-n:' + size + '"><span class="rb-face-label">' + face + '</span>' +
        [...facelets.slice(start, start + size ** 2)].map((color, tile) => {
          const dim = focusLayer && (face === "D" || (face !== "U" && tile >= size));
          return '<i class="' + (dim ? "rb-dim" : "") + '" data-color="' + esc(color) + '">' + (labels ? esc(color) : "") + '</i>';
        }).join("") + '</span>';
    }).join("") + '</span>';
}

function control(text, action, label = "") {
  return '<button type="button" data-player="' + action + '"' + (label ? ' aria-label="' + label + '"' : "") + '>' + text + '</button>';
}

export function mountPlayer(host, { puzzle, setup = "", algorithm = "", facelets, free = false, labels = false, twoD = false, onPreference, goal, onGoal } = {}) {
  const size = cubeSize(puzzle);
  if (!size) {
    if (typeof engine.mountSpecialPuzzle === "function") return engine.mountSpecialPuzzle(host, { puzzle, setup, algorithm, free, labels, twoD });
    host.innerHTML = '<p class="rb-note">Khối này có hướng dẫn bằng chữ và video. Bạn có thể dùng Rubik thật để làm theo.</p>';
    return () => {};
  }

  let initial;
  let moves;
  try {
    initial = snapshot(puzzle, setup, facelets);
    moves = engine.parseMoves(algorithm, size);
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
  const abort = new AbortController();
  const keyHelp = "Chọn nút mặt để xoay. Có thể dùng phím U, R, F, D, L, B. Giữ Shift để đảo chiều.";
  host.innerHTML = '<div class="rb-board" tabindex="0" aria-label="' + esc(free ? keyHelp : "Mô hình Rubik") + '"></div>' +
    '<div class="rb-controls">' + control(twoD ? "Xem 3D" : "Xem 2D", "mode") + control(labels ? "Ẩn ký hiệu" : "Hiện ký hiệu", "labels") +
    (free && !goal ? control("Xáo khối", "shuffle") : "") + '</div>' +
    '<div class="rb-controls">' + control("Đặt lại", "reset") + control("Lùi", "back", free ? "Hoàn tác" : "Lùi một nước") +
    (!free ? control("Phát", "play") : "") + control(free ? "Làm lại" : "Tiến một nước", "next") +
    (!free ? '<label class="rb-inline">Tốc độ <select data-player-speed><option value="0.25">0,25×</option><option value="0.5">0,5×</option><option value="1" selected>1×</option><option value="1.5">1,5×</option></select></label>' : "") + '</div>' +
    (free ? '<div class="rb-move-pad" aria-label="Xoay mặt Rubik">' + [...engine.FACE_ORDER].map((face) =>
      '<span>' + [face, face + "'", face + "2"].map((move) => '<button type="button" data-move="' + move + '">' + move + '</button>').join("") + '</span>'
    ).join("") + '</div><p class="rb-note">' + keyHelp + '</p>' : '<div class="rb-token-list" aria-label="Các nước đi"></div>') +
    '<p class="rb-player-status" role="status"></p>';
  const find = (selector) => host.querySelector(selector);
  const board = find(".rb-board");
  const status = find(".rb-player-status");

  function createView() {
    view?.destroy();
    board.replaceChildren();
    try {
      const render = twoD ? engine.renderCube2D : engine.renderCube3D;
      view = render(board, states[index], size, { labels, mirror: puzzle === "mirror" });
    } catch {
      view = engine.renderCube2D(board, states[index], size, { labels, mirror: puzzle === "mirror" });
      twoD = true;
    }
    find('[data-player="mode"]').textContent = twoD ? "Xem 3D" : "Xem 2D";
    find('[data-player="labels"]').textContent = labels ? "Ẩn ký hiệu" : "Hiện ký hiệu";
  }

  function update(move) {
    view.update(states[index], { move });
    find('[data-player="back"]').disabled = index === 0;
    find('[data-player="next"]').disabled = index === states.length - 1;
    if (free) {
      const solved = states[index] === engine.solvedFaces(size);
      const meetsGoal = goal && [...goal].every((color, i) => color === "." || color === states[index][i]);
      status.textContent = meetsGoal ? "Đã hoàn thành mục tiêu." : solved ? "Khối đã về trạng thái giải." : index + " nước đã xoay.";
      if (meetsGoal && !reachedGoal && index > 0) {
        reachedGoal = true;
        onGoal?.();
      }
    } else {
      status.textContent = index + "/" + moves.length + " nước" + (index && moves.length ? " · Vừa xoay " + moves[index - 1] : "");
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
  }, { signal: abort.signal });
  board.addEventListener("keydown", (event) => {
    const letter = event.key.toUpperCase();
    if (!free || letter.length !== 1 || !engine.FACE_ORDER.includes(letter) || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    turn(letter + (event.shiftKey ? "'" : ""));
  }, { signal: abort.signal });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); }, { signal: abort.signal });

  createView();
  update();
  return () => {
    abort.abort();
    stop();
    view.destroy();
  };
}
