const SPECIAL_MOVES = {
  pyraminx: ["U", "R", "L", "B", "u", "r", "l", "b", "U'", "R'", "L'", "B'", "u'", "r'", "l'", "b'"],
  megaminx: ["U", "U'", "R", "R'", "F", "F'", "L", "L'", "R++", "R--", "D++", "D--"],
  skewb: ["R", "L", "U", "B", "R'", "L'", "U'", "B'"],
  square1: ["(1,0)", "(-1,0)", "(0,1)", "(0,-1)", "/"],
  clock: ["UR1+", "DR1+", "DL1+", "UL1+", "U1+", "R1+", "D1+", "L1+", "ALL1+", "UR1-", "DR1-", "DL1-", "UL1-", "U1-", "R1-", "D1-", "L1-", "ALL1-", "y2"]
};
const NAMES = { pyraminx: "Pyraminx", megaminx: "Megaminx", skewb: "Skewb", square1: "Square-1", clock: "Clock" };
// The Square-1 model divides each corner into two wedges. A slice is
// physically possible only if all four cut lines fall between pieces.
const WEDGE_PAIRS = [[0, 1], [3, 4], [6, 7], [9, 10], [13, 14], [16, 17], [19, 20], [22, 23]];
const WEDGE_CUTS = [[11, 0], [5, 6], [23, 12], [17, 18]];
const canSlice = (wedges) => WEDGE_CUTS.every(([a, b]) => WEDGE_PAIRS.every(
  ([left, right]) => !(wedges[a] === left && wedges[b] === right || wedges[a] === right && wedges[b] === left)
));
const choose = (choices, random) => choices[Math.floor(random() * choices.length)];
const rotateRing = (ring, amount) => ring.map((_, i) => ring[(i + ring.length - amount) % ring.length]);
const turns = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];

export function scramblePuzzle(puzzle, random = Math.random) {
  if (puzzle === "megaminx") {
    return Array.from({ length: 7 }, () => {
      const pairs = Array.from({ length: 5 }, () =>
        choose(["R++", "R--"], random) + " " + choose(["D++", "D--"], random)
      );
      return pairs.join(" ") + " " + choose(["U", "U'"], random);
    }).join("\n");
  }
  if (puzzle === "clock") {
    function dial(name) {
      const amount = choose([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6], random);
      return name + Math.abs(amount) + (amount < 0 ? "-" : "+");
    }
    return ["UR", "DR", "DL", "UL", "U", "R", "D", "L", "ALL"].map(dial).join(" ")
      + " y2 " + ["U", "R", "D", "L", "ALL"].map(dial).join(" ");
  }
  if (puzzle === "square1") {
    let wedges = Array.from({ length: 24 }, (_, i) => i);
    const pairs = [];
    for (let i = 0; i < 12; i++) {
      const choices = [];
      for (const upper of turns) {
        const top = rotateRing(wedges.slice(0, 12), upper);
        for (const lower of turns) {
          if (!upper && !lower) continue;
          const next = top.concat(rotateRing(wedges.slice(12), lower));
          if (canSlice(next)) choices.push({ upper, lower, next });
        }
      }
      if (!choices.length) break;
      const { upper, lower, next } = choose(choices, random);
      pairs.push("(" + upper + "," + lower + ") /");
      wedges = next.slice(0, 6).concat(next.slice(12, 18), next.slice(6, 12), next.slice(18, 24));
    }
    return pairs.join(" ");
  }
  if (puzzle === "pyraminx" || puzzle === "skewb") {
    const outline = [];
    let previous = "";
    for (let i = 0; i < 11; i++) {
      previous = choose([..."URLB"].filter((face) => face !== previous), random);
      outline.push(previous + choose(["", "'"], random));
    }
    if (puzzle === "pyraminx") {
      for (const tip of "urlb") {
        const turn = choose([null, "", "'"], random);
        if (turn !== null) outline.push(tip + turn);
      }
    }
    return outline.join(" ");
  }
  return "";
}

function notationMoves(Alg, notation) {
  if (notation.length > 4096 || /\d{4,}/u.test(notation)) throw new Error("Công thức quá dài.");
  const result = [];
  const leaves = Alg.fromString(notation.replace(/[’‘′]/gu, "'")).experimentalLeafMoves();
  for (const move of leaves) {
    if (result.length >= 600) throw new Error("Công thức có quá nhiều nước.");
    if (move.family === "U_SQ_") result.push("(" + move.amount + ",0)");
    else if (move.family === "D_SQ_") {
      const previous = /^\((-?\d+),0\)$/u.exec(result.at(-1));
      if (previous) result[result.length - 1] = "(" + previous[1] + "," + move.amount + ")";
      else result.push("(0," + move.amount + ")");
    } else result.push(move.toString());
  }
  return result;
}

function applyPuzzle(pattern, moves, puzzle) {
  for (const move of moves) {
    if (puzzle === "square1" && move === "/" && !canSlice(pattern.patternData.WEDGES.pieces)) {
      throw new Error("Hai tầng đang chắn đường cắt. Xoay tầng trên hoặc dưới đến khi đường cắt thông.");
    }
    pattern = pattern.applyAlg(move);
  }
  return pattern;
}

export async function loadSpecialPractice(puzzle, setup = "", algorithm = "") {
  if (!Object.hasOwn(SPECIAL_MOVES, puzzle)) throw new Error("Loại khối này chưa hỗ trợ luyện công thức.");
  const { Alg, puzzles } = await import("./vendor/rubik-cubing/special.mjs?v=1");
  const model = await puzzles[puzzle].kpuzzle();
  const initial = applyPuzzle(model.defaultPattern(), notationMoves(Alg, setup), puzzle);
  const moves = notationMoves(Alg, algorithm);
  const goal = applyPuzzle(initial, moves, puzzle);
  return {
    moves,
    matches(candidateNotation) {
      try {
        return applyPuzzle(initial, notationMoves(Alg, candidateNotation), puzzle).isIdentical(goal);
      } catch {
        return false;
      }
    }
  };
}

function makeButton(text, onClick, signal) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.addEventListener("click", onClick, { signal });
  return button;
}

let webGLAvailable;
function canDraw3D() {
  if (webGLAvailable === undefined) {
    try {
      const context = document.createElement("canvas").getContext("webgl2");
      webGLAvailable = Boolean(context);
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webGLAvailable = false;
    }
  }
  return webGLAvailable;
}

const nativeVolume = (puzzle) => puzzle === "clock" || puzzle === "square1";

function createTwistyViewer(TwistyPlayer, { puzzle, setup, isFlat = () => false, signal }) {
  const home = { latitude: 26, longitude: -29 };
  const player = new TwistyPlayer({
    puzzle, experimentalSetupAlg: setup, background: "none",
    cameraLatitude: home.latitude, cameraLongitude: home.longitude,
    visualization: isFlat() ? "2D" : "3D", controlPanel: "none", viewerLink: "none",
    hintFacelets: "none", experimentalDragInput: "auto"
  });
  player.setAttribute("aria-label", "Mô phỏng " + NAMES[puzzle]);
  player.tabIndex = 0;
  player.addEventListener("keydown", async (event) => {
    const key = event.key;
    if (isFlat() || event.altKey || event.ctrlKey || event.metaKey ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(key)) return;
    event.preventDefault();
    const scene = player.experimentalModel.twistySceneModel;
    if (key === "Home") {
      scene.orbitCoordinatesRequest.set(home);
      return;
    }
    const { latitude, longitude } = await scene.orbitCoordinates.get();
    if (signal.aborted) return;
    const dy = key === "ArrowUp" ? 12 : key === "ArrowDown" ? -12 : 0;
    const dx = key === "ArrowRight" ? 12 : key === "ArrowLeft" ? -12 : 0;
    scene.orbitCoordinatesRequest.set({ latitude: Math.max(-85, Math.min(85, latitude + dy)), longitude: longitude + dx });
  }, { signal });
  return player;
}

export function mountSpecialPreview(host, { puzzle, setup = "", fallback }) {
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  let view;
  async function mount() {
    const { Alg, puzzles, TwistyPlayer } = await import("./vendor/rubik-cubing/special.mjs?v=1");
    if (signal.aborted) return;
    if (nativeVolume(puzzle)) {
      const [{ mountVariantVolume }, model] = await Promise.all([
        import("./rubik-variant-volume.mjs?v=1"), puzzles[puzzle].kpuzzle()
      ]);
      if (signal.aborted) return;
      view = mountVariantVolume(host, puzzle, applyPuzzle(model.defaultPattern(), notationMoves(Alg, setup), puzzle));
      return;
    }
    if (!canDraw3D()) { fallback(); return; }
    const viewer = createTwistyViewer(TwistyPlayer, { puzzle, setup, signal });
    host.replaceChildren(viewer);
    view = { destroy: () => viewer.remove() };
  }
  mount().catch(() => { if (!signal.aborted) fallback(); });
  return () => {
    lifecycle.abort();
    view?.destroy();
  };
}

export function mountSpecialPuzzle(host, {
  puzzle, setup = "", algorithm = "", free = false, twoD = false, goalAlgorithm, onGoal
} = {}) {
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  const status = document.createElement("p");
  status.className = "rb-note rb-player-status";
  status.setAttribute("role", "status");
  status.textContent = "Đang tải mô phỏng " + (NAMES[puzzle] || "khối") + "…";
  host.replaceChildren(status);
  if (!Object.hasOwn(SPECIAL_MOVES, puzzle)) {
    status.textContent = "Bài này có hướng dẫn chữ và video cho khối thật.";
    return () => lifecycle.abort();
  }
  let player;
  let volume;
  let timer = 0;
  let play;
  function stop() {
    clearTimeout(timer);
    timer = 0;
    if (play) play.textContent = "Phát";
    player?.pause();
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); }, { signal });
  async function mount() {
    const { Alg, puzzles, TwistyPlayer } = await import("./vendor/rubik-cubing/special.mjs?v=1");
    const model = await puzzles[puzzle].kpuzzle();
    const native = nativeVolume(puzzle) ? await import("./rubik-variant-volume.mjs?v=1") : null;
    if (signal.aborted) return;
    const solved = model.defaultPattern();
    let setupMoves = notationMoves(Alg, setup);
    let initial = applyPuzzle(solved, setupMoves, puzzle);
    let moves = free ? [] : notationMoves(Alg, algorithm);
    let patterns = [initial];
    for (const move of moves) patterns.push(applyPuzzle(patterns.at(-1), [move], puzzle));
    const goalMoves = free && goalAlgorithm != null ? notationMoves(Alg, goalAlgorithm) : [];
    const goal = free && goalAlgorithm != null
      ? applyPuzzle(initial, goalMoves, puzzle)
      : null;
    let reachedGoal = false;
    let index = 0;
    let speed = 1;
    const has3D = !native && canDraw3D();
    let show2D = twoD || !has3D;
    const viewerHost = document.createElement("div");
    if (!native) {
      player = createTwistyViewer(TwistyPlayer, { puzzle, setup: setupMoves.join(" "), isFlat: () => show2D, signal });
      player.style.width = "100%";
      player.style.maxWidth = "27rem";
      player.style.height = "clamp(12rem,55vw,22rem)";
      player.style.marginInline = "auto";
      viewerHost.append(player);
    }
    const actions = document.createElement("div");
    actions.className = "rb-controls";
    const tokens = document.createElement("div");
    tokens.className = "rb-token-list";
    tokens.setAttribute("aria-label", "Các nước đi");
    function refresh() {
      if (volume) volume.update(patterns[index]);
      else {
        player.alg = moves.slice(0, index).join(" ");
        player.jumpToEnd();
      }
      back.disabled = index === 0;
      next.disabled = index >= moves.length;
      if (!free && play) play.disabled = moves.length === 0;
      const meetsGoal = goal && patterns[index]?.isIdentical(goal);
      if (meetsGoal) status.textContent = "Đã hoàn thành mục tiêu.";
      else if (free) {
        status.textContent = patterns[index].isIdentical(solved)
          ? "Khối đã về trạng thái giải." : index + " nước đã xoay.";
      } else {
        status.textContent = index + "/" + moves.length + " nước" + (index ? " · Vừa xoay " + moves[index - 1] : "");
      }
      tokens.replaceChildren(...moves.map((notation, offset) => {
        const span = document.createElement("span");
        span.textContent = notation;
        if (offset === index - 1) span.setAttribute("aria-current", "step");
        return span;
      }));
      if (meetsGoal && !reachedGoal && index > 0) {
        reachedGoal = true;
        onGoal?.();
      }
    }
    function advance(delta) {
      stop();
      index = Math.max(0, Math.min(moves.length, index + delta));
      refresh();
    }
    const back = makeButton(free ? "Hoàn tác" : "Lùi một nước", () => advance(-1), signal);
    const next = makeButton(free ? "Làm lại" : "Tiến một nước", () => advance(1), signal);
    actions.append(makeButton("Đặt lại", () => {
      stop();
      index = 0;
      if (free) {
        moves = [];
        patterns = [initial];
      }
      refresh();
    }, signal), back, next);
    if (has3D) {
      const toggle = makeButton(show2D ? "Xem 3D" : "Xem 2D", () => {
        show2D = !show2D;
        player.visualization = show2D ? "2D" : "3D";
        toggle.textContent = show2D ? "Xem 3D" : "Xem 2D";
      }, signal);
      actions.prepend(toggle);
    }
    const additions = [];
    if (free) {
      if (!goal) actions.append(makeButton("Xáo khối", () => {
        stop();
        setupMoves = notationMoves(Alg, scramblePuzzle(puzzle));
        initial = applyPuzzle(solved, setupMoves, puzzle);
        if (player) player.experimentalSetupAlg = setupMoves.join(" ");
        index = 0;
        moves = [];
        patterns = [initial];
        refresh();
      }, signal));
      const keys = document.createElement("div");
      keys.className = "rb-controls";
      keys.setAttribute("role", "group");
      keys.setAttribute("aria-label", "Nước xoay hợp lệ");
      const available = new Set([...SPECIAL_MOVES[puzzle], ...goalMoves]);
      for (const notation of available) {
        const move = makeButton(notation, () => {
          stop();
          try {
            const nextPattern = applyPuzzle(patterns[index], [notation], puzzle);
            moves = moves.slice(0, index).concat(notation);
            patterns = patterns.slice(0, index + 1).concat(nextPattern);
            index++;
          } catch (error) {
            status.textContent = error?.message?.startsWith("Hai tầng") ? error.message : "Nước xoay này chưa thực hiện được.";
            return;
          }
          refresh();
        }, signal);
        move.dataset.specialMove = notation;
        keys.append(move);
      }
      additions.push(keys);
    } else {
      function tick() {
        index++;
        refresh();
        if (index < moves.length) timer = setTimeout(tick, 680 / speed);
        else stop();
      }
      play = makeButton("Phát", () => {
        if (timer) stop();
        else if (moves.length) {
          if (index >= moves.length) index = 0;
          play.textContent = "Tạm dừng";
          tick();
        }
      }, signal);
      const label = document.createElement("label");
      label.className = "rb-inline";
      const options = document.createElement("select");
      for (const [value, name] of [[0.25, "0,25×"], [0.5, "0,5×"], [1, "1×"], [1.5, "1,5×"]]) {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = name;
        options.append(option);
      }
      options.value = "1";
      options.addEventListener("change", () => { speed = Number(options.value); }, { signal });
      label.append("Tốc độ ", options);
      actions.append(play, label);
    }
    const hint = document.createElement("p");
    hint.className = "rb-note";
    if (native || has3D) hint.textContent = "Kéo trên khối hoặc dùng phím mũi tên để đổi góc nhìn.";
    host.replaceChildren(viewerHost, hint, actions, ...additions, tokens, status);
    if (native) volume = native.mountVariantVolume(viewerHost, puzzle, initial);
    refresh();
  }
  mount().catch(() => {
    if (!signal.aborted) status.textContent = "Chưa mở được mô phỏng. Bạn vẫn có thể làm theo hình và hướng dẫn.";
  });
  return () => {
    lifecycle.abort();
    stop();
    volume?.destroy();
    player?.remove();
  };
}
