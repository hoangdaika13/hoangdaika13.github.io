import { createAutoPlayback, createLoopControl, createSpeedControl, createStepTimeline, createTurnGuide, turnTiming } from "./rubik-playback.mjs?v=2";

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

const TWISTY_HOME = { latitude: 26, longitude: -29 };

function createTwistyViewer(TwistyPlayer, { puzzle, setup, isFlat = () => false, signal }) {
  const player = new TwistyPlayer({
    puzzle, experimentalSetupAlg: setup, background: "none",
    cameraLatitude: TWISTY_HOME.latitude, cameraLongitude: TWISTY_HOME.longitude,
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
      scene.orbitCoordinatesRequest.set(TWISTY_HOME);
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
        import("./rubik-variant-volume.mjs?v=2"), puzzles[puzzle].kpuzzle()
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

export function describeSpecialMove(puzzle, move) {
  if (puzzle === "square1") {
    if (move === "/") return "Lật nửa khối qua lát cắt 180° để đổi mảnh giữa hai tầng.";
    const angles = /^\((-?\d+),\s*(-?\d+)\)$/.exec(move);
    if (angles) {
      const layers = ["tầng trên", "tầng dưới"].flatMap((name, i) => {
        const amount = Number(angles[i + 1]);
        return amount ? [name + " " + Math.abs(amount) * 30 + "° theo chiều " + (amount > 0 ? "+" : "−")] : [];
      });
      return layers.length ? "Xoay " + layers.join(", ") + "." : "Giữ nguyên hai tầng.";
    }
  }
  if (puzzle === "clock") {
    if (/^y2'?$/u.test(move)) return "Lật Clock 180° quanh trục dọc để xem mặt kia.";
    const dial = /^([A-Z]+)(\d+)([+-])$/u.exec(move);
    if (dial) return "Xoay nhóm " + dial[1] + " " + dial[2] + " nấc " +
      (dial[3] === "+" ? "thuận" : "ngược") + " chiều kim đồng hồ khi nhìn mặt trước.";
  }
  if (puzzle === "pyraminx" && /^[a-z]/u.test(move)) return "Xoay chóp " + move[0].toUpperCase() +
    " theo ký hiệu " + move + ".";
  return "Thực hiện nước " + move + " trên " + NAMES[puzzle] + ".";
}

export function movingStickerMask(model, pattern, move) {
  try {
    const { transformationData } = model.moveToTransformation(move);
    let moved = false;
    const masks = model.definition.orbits.map(({ orbitName, numPieces }) => {
      const { permutation, orientationDelta } = transformationData[orbitName];
      const { pieces } = pattern.patternData[orbitName];
      const mask = Array(numPieces).fill("D");
      for (const [position, piece] of pieces.entries()) {
        if (permutation[position] === position && !orientationDelta[position]) continue;
        mask[piece] = "-";
        moved = true;
      }
      return orbitName + ":" + mask.join("");
    });
    return moved ? masks.join(",") : null;
  } catch {
    return null;
  }
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
  let playback;
  let frame;
  let revision = 0;
  let play;
  let finishTurn = () => {};

  function stop() {
    playback?.stop();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { stop(); finishTurn(); }
  }, { signal });

  async function mount() {
    const { Alg, puzzles, TwistyPlayer } = await import("./vendor/rubik-cubing/special.mjs?v=1");
    const model = await puzzles[puzzle].kpuzzle();
    const native = nativeVolume(puzzle) ? await import("./rubik-variant-volume.mjs?v=2") : null;
    if (signal.aborted) return;
    const solved = model.defaultPattern();
    let setupMoves = notationMoves(Alg, setup);
    let initial = applyPuzzle(solved, setupMoves, puzzle);
    let moves = free ? [] : notationMoves(Alg, algorithm);
    let patterns = [initial];
    for (const move of moves) patterns.push(applyPuzzle(patterns.at(-1), [move], puzzle));
    const goalMoves = free && goalAlgorithm != null ? notationMoves(Alg, goalAlgorithm) : [];
    const goal = free && goalAlgorithm != null ? applyPuzzle(initial, goalMoves, puzzle) : null;
    let reachedGoal = false;
    let index = 0;
    let speed = 1;
    let synced;
    const motion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
    const has3D = !native && canDraw3D();
    let show2D = twoD || !has3D;
    const viewerHost = document.createElement("div");
    viewerHost.className = "rb-board rb-variant-board";
    if (!native) {
      player = createTwistyViewer(TwistyPlayer, { puzzle, setup: setupMoves.join(" "), isFlat: () => show2D, signal });
      player.style.width = "100%";
      player.style.maxWidth = "27rem";
      player.style.height = "clamp(12rem,55vw,22rem)";
      player.style.marginInline = "auto";
      viewerHost.append(player);
    }

    async function syncTwisty(previous, move = "") {
      cancelAnimationFrame(frame);
      const token = ++revision;
      const destination = index;
      const mask = move && !show2D ? movingStickerMask(model, patterns[previous], move) : null;
      delete viewerHost.dataset.turnPhase;
      player.experimentalStickeringMaskOrbits = null;
      if (synced !== moves) {
        player.alg = moves.join(" ");
        synced = moves;
      }
      try {
        const indexer = await player.experimentalModel.indexer.get();
        if (signal.aborted || token !== revision) return;
        const end = indexer.indexToMoveStartTimestamp(destination);
        const start = indexer.indexToMoveStartTimestamp(previous);
        if (!move || motion?.matches || start === end) {
          player.timestamp = end;
          player.experimentalStickeringMaskOrbits = mask;
          return;
        }
        player.experimentalStickeringMaskOrbits = mask;
        const { duration, preview } = turnTiming(speed);
        const startAt = performance.now() + preview;
        player.timestamp = start;
        viewerHost.dataset.turnPhase = "prepare";
        function render(now) {
          if (signal.aborted || token !== revision) return;
          const distance = Math.max(0, Math.min(1, (now - startAt) / duration));
          if (distance > 0) viewerHost.dataset.turnPhase = "moving";
          player.timestamp = start + (end - start) * distance * distance * (3 - 2 * distance);
          if (distance < 1) frame = requestAnimationFrame(render);
          else {
            delete viewerHost.dataset.turnPhase;
            player.experimentalStickeringMaskOrbits = null;
          }
        }
        frame = requestAnimationFrame(render);
      } catch {
        if (signal.aborted || token !== revision) return;
        player.alg = moves.slice(0, destination).join(" ");
        player.jumpToEnd();
        synced = undefined;
      }
    }

    finishTurn = () => {
      if (volume) volume.finishTurn();
      else void syncTwisty(index);
    };
    motion?.addEventListener?.("change", () => { if (motion.matches) finishTurn(); }, { signal });

    const actions = document.createElement("div");
    actions.className = "rb-controls rb-player-controls";
    const settings = document.createElement("div");
    settings.className = "rb-controls rb-player-settings";
    const guide = createTurnGuide();
    playback = free ? null : createAutoPlayback(moves.length, {
      position: () => index, range: () => loop?.range, speed: () => speed,
      advance() {
        const previous = index++;
        refresh(previous, moves[previous]);
      },
      rewind(destination) { index = destination; refresh(); },
      onPlaying(playing) {
        if (!play) return;
        play.textContent = playing ? "Tạm dừng" : "Phát";
        play.setAttribute("aria-pressed", String(playing));
      }
    });
    const timeline = !free && createStepTimeline(moves, seek, signal);
    const loop = playback && createLoopControl(moves, playback.setLoopStart, signal);
    const hint = document.createElement("p");
    hint.className = "rb-note";

    function refresh(previous = index, move) {
      if (volume) volume.update(patterns[index], { move, ...turnTiming(speed) });
      else void syncTwisty(previous, move);
      back.disabled = index === 0;
      next.disabled = index >= moves.length;
      if (play) play.disabled = !moves.length;
      const activeMove = move || moves[index - 1];
      guide.show(activeMove || "", activeMove ? describeSpecialMove(puzzle, activeMove) :
        free ? "Chọn một nước xoay để thực hành." : "Chọn một ký hiệu hoặc nút Tiến để xem nước đầu tiên.");
      timeline?.select?.(index);

      const meetsGoal = goal && patterns[index].isIdentical(goal);
      if (meetsGoal) status.textContent = "Đã hoàn thành mục tiêu.";
      else if (free) status.textContent = patterns[index].isIdentical(solved)
        ? "Khối đã về trạng thái giải." : index + " nước đã xoay.";
      else status.textContent = index + "/" + moves.length + " nước" +
        (index ? " · " + moves[index - 1] : "");
      if (meetsGoal && !reachedGoal && index > 0) {
        reachedGoal = true;
        onGoal?.();
      }
    }

    function seek(destination) {
      stop();
      index = destination;
      refresh();
    }

    function advance(delta) {
      stop();
      const previous = index;
      const move = delta > 0 ? moves[index]
        : notationMoves(Alg, Alg.fromString(moves[index - 1]).invert().toString())[0];
      index += delta;
      refresh(previous, move);
    }

    const back = makeButton(free ? "Hoàn tác" : "Lùi một nước", () => advance(-1), signal);
    back.dataset.player = "back";
    const next = makeButton(free ? "Làm lại" : "Tiến một nước", () => advance(1), signal);
    next.dataset.player = "next";
    const reset = makeButton("Đặt lại", () => {
      if (free) {
        moves = [];
        patterns = [initial];
      }
      seek(0);
    }, signal);
    reset.dataset.player = "reset";
    actions.append(reset, back);
    if (!free) {
      play = makeButton("Phát", playback.toggle, signal);
      play.dataset.player = "play";
      play.setAttribute("aria-pressed", "false");
      actions.append(play);
    }
    actions.append(next);
    if (!free) actions.append(createSpeedControl((value) => { speed = value; }, signal));

    const camera = makeButton("Về góc chuẩn", () => {
      if (volume) volume.resetCamera();
      else player.experimentalModel.twistySceneModel.orbitCoordinatesRequest.set(TWISTY_HOME);
    }, signal);
    camera.dataset.player = "camera";
    function updateViewHelp() {
      camera.hidden = !native && show2D;
      hint.textContent = camera.hidden ? "Sơ đồ mở phẳng của khối."
        : "Kéo trên khối hoặc dùng phím mũi tên để đổi góc nhìn.";
    }
    settings.append(camera);
    if (has3D) {
      const toggle = makeButton(show2D ? "Xem 3D" : "Xem 2D", () => {
        stop();
        finishTurn();
        show2D = !show2D;
        player.visualization = show2D ? "2D" : "3D";
        toggle.textContent = show2D ? "Xem 3D" : "Xem 2D";
        updateViewHelp();
      }, signal);
      toggle.dataset.player = "mode";
      settings.append(toggle);
    }
    let keys;
    if (free) {
      if (!goal) settings.append(makeButton("Xáo khối", () => {
        setupMoves = notationMoves(Alg, scramblePuzzle(puzzle));
        initial = applyPuzzle(solved, setupMoves, puzzle);
        if (player) player.experimentalSetupAlg = setupMoves.join(" ");
        moves = [];
        patterns = [initial];
        seek(0);
      }, signal));
      keys = document.createElement("div");
      keys.className = "rb-controls";
      keys.setAttribute("role", "group");
      keys.setAttribute("aria-label", "Nước xoay hợp lệ");
      for (const notation of new Set([...SPECIAL_MOVES[puzzle], ...goalMoves])) {
        const move = makeButton(notation, () => {
          stop();
          try {
            const nextPattern = applyPuzzle(patterns[index], [notation], puzzle);
            moves = moves.slice(0, index).concat(notation);
            patterns = patterns.slice(0, index + 1).concat(nextPattern);
          } catch (error) {
            status.textContent = error?.message?.startsWith("Hai tầng") ? error.message : "Nước xoay này chưa thực hiện được.";
            return;
          }
          const previous = index++;
          refresh(previous, notation);
        }, signal);
        move.dataset.specialMove = notation;
        keys.append(move);
      }
    }
    host.replaceChildren(viewerHost, actions, guide.guide, ...(timeline ? [timeline.timeline] : []),
      ...(loop ? [loop.panel] : []), ...(settings.children.length ? [settings] : []), hint, ...(keys ? [keys] : []), status);
    if (native) volume = native.mountVariantVolume(viewerHost, puzzle, initial);
    updateViewHelp();
    refresh();
  }

  mount().catch(() => {
    if (!signal.aborted) status.textContent = "Chưa mở được mô phỏng. Bạn vẫn có thể làm theo hình và hướng dẫn.";
  });
  return () => {
    lifecycle.abort();
    stop();
    cancelAnimationFrame(frame);
    volume?.destroy();
    player?.remove();
  };
}
