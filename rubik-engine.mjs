export const FACE_ORDER = "URFDLB";
export { mountSpecialPreview, mountSpecialPuzzle, scramblePuzzle } from "./rubik-special.mjs?v=5";
export const COLORS = Object.freeze({
  U: "#f6f5ec", R: "#ee4256", F: "#1ec589",
  D: "#f8cf45", L: "#ff8544", B: "#3b83ee"
});
const FACES = {
  U: [1, 1], R: [0, 1], F: [2, 1], D: [1, -1], L: [0, -1], B: [2, -1]
};
const SLICES = { M: "L", E: "D", S: "F" };
const ROTATIONS = { x: "R", y: "U", z: "F" };
const boards = new Map();
const permutations = new Map();
const MAX_MOVES = 1536;

function checkSize(size) {
  if (!Number.isInteger(size) || size < 2 || size > 9) {
    throw new Error("Chọn khối từ 2×2 đến 9×9.");
  }
}

export function solvedFaces(size = 3) {
  checkSize(size);
  return [...FACE_ORDER].map((face) => face.repeat(size * size)).join("");
}

export function isSolved(facelets, size = 3) {
  checkSize(size);
  if (typeof facelets !== "string" || facelets.length !== 6 * size * size) return false;
  const sideLength = size * size;
  const centers = new Set();
  for (let i = 0; i < facelets.length; i += sideLength) {
    const color = facelets[i];
    if (!FACE_ORDER.includes(color) || facelets.slice(i, i + sideLength) !== color.repeat(sideLength)) return false;
    centers.add(color);
  }
  return centers.size === 6;
}

function decodeMove(token, size) {
  const match = /^(\d{1,2})?([URFDLBMESxyzurfdlb])(w)?(2'?|'2?|2)?$/.exec(token);
  if (!match) throw new Error("Nước xoay không hợp lệ: " + token);
  const [, depthText, faceChar, wideSuffix, suffix = ""] = match;
  const depth = depthText ? Number(depthText) : null;
  const amount = suffix.includes("2") ? 2 : suffix === "'" ? -1 : 1;
  const tail = amount === 2 ? "2" : amount === -1 ? "'" : "";
  let face = faceChar.toUpperCase();
  const wide = Boolean(wideSuffix) || "urfdlb".includes(faceChar);
  let start = 0;
  let width = 1;
  let name = face;
  if (Object.hasOwn(ROTATIONS, faceChar)) {
    if (depth !== null || wide) throw new Error("Xoay cả khối bằng x, y hoặc z.");
    face = ROTATIONS[faceChar];
    width = size;
    name = faceChar;
  } else if (Object.hasOwn(SLICES, face)) {
    if (depth !== null || wide || size % 2 === 0) {
      throw new Error("Ký hiệu " + face + " cần khối có một lớp giữa; với khối chẵn, hãy chỉ rõ lớp.");
    }
    start = (size - 1) / 2;
    face = SLICES[face];
  } else if (wide) {
    width = depth ?? 2;
    if (width < 2 || width > size) throw new Error("Số lớp vượt phạm vi của khối: " + token);
    name = (width === 2 ? "" : width) + face + "w";
  } else if (depth !== null) {
    if (depth < 1 || depth > size) throw new Error("Lớp nằm ngoài khối: " + token);
    start = depth - 1;
    if (depth > 1) name = depth + face;
  }
  const [axis, sign] = FACES[face];
  return { token: name + tail, axis, sign, amount, start, width };
}

function reverseTokens(moves) {
  return moves.slice().reverse().map((token) =>
    token.endsWith("2") ? token : token.endsWith("'") ? token.slice(0, -1) : token + "'"
  );
}

// Parentheses are repetitions; brackets express commutators [A,B] and
// conjugates [A:B]. Bounds keep pasted notation cheap to expand.
export function parseMoves(text, size = 3) {
  checkSize(size);
  const notation = String(Array.isArray(text) ? text.join(" ") : text ?? "")
    .replace(/[’‘′‛]/gu, "'").replace(/\/\/[^\r\n]*/gu, "").trim();
  if (notation.length > 4096) throw new Error("Công thức quá dài. Hãy chia thành các đoạn ngắn hơn.");
  let cursor = 0;
  const skipSpace = () => { while (/\s/u.test(notation[cursor] ?? "")) cursor++; };
  function repeat(moves) {
    const repetition = /^(\d{1,2})?(')?/u.exec(notation.slice(cursor));
    cursor += repetition[0].length;
    const count = Number(repetition[1] || 1);
    if (count < 1 || count * moves.length > MAX_MOVES) throw new Error("Số lần lặp vượt giới hạn.");
    return Array.from({ length: count }, () => repetition[2] ? reverseTokens(moves) : moves).flat();
  }
  function sequence(stops, depth) {
    if (depth > 8) throw new Error("Công thức lồng quá nhiều nhóm.");
    const result = [];
    while (cursor < notation.length) {
      skipSpace();
      const char = notation[cursor];
      if (!char || stops.includes(char)) break;
      if (char === "(" || char === "[") {
        cursor++;
        const first = sequence(char === "(" ? ")" : ",:]", depth + 1);
        let group = first;
        if (char === "[") {
          const separator = notation[cursor++];
          if (separator !== "," && separator !== ":") throw new Error("Dùng [A,B] hoặc [A:B].");
          const second = sequence("]", depth + 1);
          if (!first.length || !second.length) throw new Error("Cần hai vế trong dấu ngoặc vuông.");
          group = [...first, ...second, ...reverseTokens(first)];
          if (separator === ",") group.push(...reverseTokens(second));
        }
        if (notation[cursor++] !== (char === "(" ? ")" : "]") || !group.length) {
          throw new Error("Nhóm công thức bị trống hoặc thiếu dấu đóng.");
        }
        result.push(...repeat(group));
      } else {
        const move = /^(?:\d{1,2})?[URFDLBMESxyzurfdlb]w?(?:2'?|'2?)?/u.exec(notation.slice(cursor));
        if (!move) throw new Error("Ký hiệu không hợp lệ gần: " + notation.slice(cursor, cursor + 14));
        result.push(decodeMove(move[0], size).token);
        cursor += move[0].length;
      }
      if (result.length > MAX_MOVES) throw new Error("Công thức có quá nhiều nước xoay.");
    }
    return result;
  }
  return sequence("", 0);
}

export function inverseMoves(text, size = 3) {
  return reverseTokens(parseMoves(text, size)).join(" ");
}

function board(size) {
  if (boards.has(size)) return boards.get(size);
  const k = size - 1;
  // Row-major from each face's outside view. The front edge is at the
  // bottom of U and at the top of D.
  const position = {
    U: (r, c) => [c, k, r], R: (r, c) => [k, k - r, k - c],
    F: (r, c) => [c, k - r, k], D: (r, c) => [c, 0, k - r],
    L: (r, c) => [0, k - r, c], B: (r, c) => [k - c, k - r, 0]
  };
  const stickers = [];
  const index = new Map();
  for (const face of FACE_ORDER) {
    const [axis, sign] = FACES[face];
    const normal = [0, 0, 0];
    normal[axis] = sign;
    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) {
        const point = position[face](row, column);
        index.set(point.join(",") + "/" + normal.join(","), stickers.length);
        stickers.push({ point, normal, face, row, column });
      }
    }
  }
  const value = { stickers, index };
  boards.set(size, value);
  return value;
}

function rotate(vector, axis, count, center) {
  const copy = vector.slice();
  const a = (axis + 1) % 3;
  const b = (axis + 2) % 3;
  for (let i = 0; i < count; i++) {
    const first = copy[a];
    copy[a] = 2 * center - copy[b];
    copy[b] = first;
  }
  return copy;
}

function inLayer({ point }, move, size) {
  const fromFace = move.sign === 1 ? size - 1 - point[move.axis] : point[move.axis];
  return fromFace >= move.start && fromFace < move.start + move.width;
}

function permutation(token, size) {
  const key = size + "/" + token;
  if (permutations.has(key)) return permutations.get(key);
  const move = decodeMove(token, size);
  const count = (4 - move.sign * move.amount) % 4;
  const { stickers, index } = board(size);
  const result = stickers.map((sticker, i) => {
    if (!inLayer(sticker, move, size)) return i;
    const point = rotate(sticker.point, move.axis, count, (size - 1) / 2);
    const normal = rotate(sticker.normal, move.axis, count, 0);
    return index.get(point.join(",") + "/" + normal.join(","));
  });
  permutations.set(key, result);
  return result;
}

export function applyMoves(facelets, moves, size = 3) {
  const steps = parseMoves(moves, size);
  if (typeof facelets !== "string" || facelets.length !== 6 * size * size) {
    throw new Error("Số ô màu không khớp kích thước khối.");
  }
  let current = facelets.split("");
  for (const token of steps) {
    const next = Array(current.length);
    permutation(token, size).forEach((to, from) => { next[to] = current[from]; });
    current = next;
  }
  return current.join("");
}

export function scramble(size = 3, length = [0, 0, 11, 25, 40, 60, 80, 100, 120, 140][size], random = Math.random) {
  checkSize(size);
  const moves = [];
  let previousAxis = -1;
  for (let i = 0; i < Math.min(180, Math.max(0, Number(length))); i++) {
    const faces = [...FACE_ORDER].filter((face) => FACES[face][0] !== previousAxis);
    const face = faces[Math.floor(random() * faces.length)];
    previousAxis = FACES[face][0];
    const width = size < 4 ? 1 : 1 + Math.floor(random() * Math.floor(size / 2));
    const move = (width > 2 ? width : "") + face + (width > 1 ? "w" : "");
    moves.push(move + ["", "'", "2"][Math.floor(random() * 3)]);
  }
  return moves.join(" ");
}

const CORNERS = ["URF", "UFL", "ULB", "UBR", "DFR", "DLF", "DBL", "DRB"];
const EDGES = ["UR", "UF", "UL", "UB", "DR", "DF", "DL", "DB", "FR", "FL", "BL", "BR"];

function pieceStickers(piece) {
  const point = [1, 1, 1];
  for (const name of piece) {
    const [axis, sign] = FACES[name];
    point[axis] = sign === 1 ? 2 : 0;
  }
  return [...piece].map((face) => board(3).stickers.findIndex((sticker) =>
    sticker.face === face && sticker.point.every((position, i) => point[i] === position)
  ));
}

function comparePieces(facelets, pieces, orbit) {
  let orientation = 0;
  const permutation = [];
  for (const position of pieces) {
    const stickers = pieceStickers(position).map((index) => facelets[index]).join("");
    let index = -1;
    let shift = 0;
    for (; shift < stickers.length; shift++) {
      index = pieces.indexOf(stickers.slice(shift) + stickers.slice(0, shift));
      if (index >= 0) break;
    }
    if (index < 0) return { error: "Kiểm tra màu và hướng của viên " + orbit + " tại " + position + "." };
    if (permutation.includes(index)) {
      return { error: "Viên " + orbit + " " + pieces[index] + " xuất hiện hai lần. Kiểm tra ô màu tại " + position + "." };
    }
    permutation.push(index);
    orientation += shift;
  }
  let parity = 0;
  permutation.forEach((value, i) => {
    for (let j = i + 1; j < permutation.length; j++) parity ^= Number(value > permutation[j]);
  });
  return { orientation, parity };
}

export function validateFacelets(input) {
  const original = String(Array.isArray(input) ? input.join("") : input ?? "").toUpperCase().replace(/\s/gu, "");
  const fail = (error) => ({ ok: false, error });
  if (original.length !== 54 || /[^URFDLB]/u.test(original)) return fail("Hãy tô đủ 54 ô của sáu mặt.");
  const centers = [...FACE_ORDER].map((_, i) => original[9 * i + 4]);
  if (new Set(centers).size !== 6) return fail("Mỗi mặt cần có một màu tâm khác nhau.");
  for (const color of FACE_ORDER) {
    const count = [...original].filter((sticker) => sticker === color).length;
    if (count !== 9) return fail("Màu " + color + " có " + count + " ô. Mỗi màu cần đúng 9 ô.");
  }
  // Center colors describe the way the user holds their individual cube.
  // The search worker receives canonical face names in that frame.
  const facelets = [...original].map((color) => FACE_ORDER[centers.indexOf(color)]).join("");
  const corners = comparePieces(facelets, CORNERS, "góc");
  if (corners.error) return fail(corners.error);
  const edges = comparePieces(facelets, EDGES, "cạnh");
  if (edges.error) return fail(edges.error);
  if (corners.orientation % 3) return fail("Tổng góc xoắn không hợp lệ. Kiểm tra các viên góc và hướng nhập mặt.");
  if (edges.orientation % 2) return fail("Số cạnh bị lật không hợp lệ. Kiểm tra các viên cạnh và hướng nhập mặt.");
  if (corners.parity !== edges.parity) return fail("Hoán vị cạnh và góc không khớp. Kiểm tra lại các viên đổi vị trí.");
  return { ok: true, facelets, original };
}

export function solve3x3(input, { signal, timeout = 30000 } = {}) {
  const validated = validateFacelets(input);
  if (!validated.ok) return Promise.reject(new Error(validated.error));
  const aborted = () => new DOMException("Đã hủy tính lời giải.", "AbortError");
  if (signal?.aborted) return Promise.reject(aborted());
  if (isSolved(validated.original)) return Promise.resolve("");
  if (typeof Worker !== "function") return Promise.reject(new Error("Trình duyệt này chưa hỗ trợ bộ giải nền."));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./rubik-solver-worker.js?v=1", import.meta.url));
    const finish = (error, result) => {
      clearTimeout(deadline);
      signal?.removeEventListener("abort", cancel);
      worker.terminate();
      if (error) reject(error);
      else resolve(result);
    };
    const cancel = () => finish(aborted());
    const deadline = setTimeout(() => finish(new Error("Tính lời giải quá lâu. Hãy thử lại.")), timeout);
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onmessage = ({ data }) => {
      try {
        if (data?.error || typeof data?.solution !== "string") throw new Error("Chưa tìm được lời giải. Hãy thử lại.");
        const solution = parseMoves(data.solution).join(" ");
        if (!isSolved(applyMoves(validated.original, solution))) throw new Error("Lời giải không khớp với khối đã nhập.");
        finish(null, solution);
      } catch (error) { finish(error); }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      finish(new Error("Không tải được bộ giải 3×3. Hãy thử lại."));
    };
    worker.postMessage(validated.facelets);
  });
}

const NET = { U: [1, 2], L: [2, 1], F: [2, 2], R: [2, 3], B: [2, 4], D: [3, 2] };
const COLOR_NAMES = { U: "trắng", R: "đỏ", F: "xanh lá", D: "vàng", L: "cam", B: "xanh dương" };
export const COLOR_LABELS = Object.freeze({ U: "Tr", R: "Đ", F: "Xl", D: "V", L: "Ca", B: "Xd" });
const FACE_ANGLES = {
  U: "rotateX(90deg)", D: "rotateX(-90deg)", R: "rotateY(90deg)",
  L: "rotateY(-90deg)", F: "", B: "rotateY(180deg)"
};
const FACE_SPANS = {
  U: [0, 1, 2, 1], R: [2, -1, 1, -1], F: [0, 1, 1, -1],
  D: [0, 1, 2, -1], L: [2, 1, 1, -1], B: [0, -1, 1, -1]
};
const MIRROR_COLOR = {
  U: "#e2e6eb", R: "#98a6ba", F: "#bcc7d7",
  D: "#8494a8", L: "#aebacf", B: "#b4c0d1"
};
// The mechanical cubie grid stays symmetric. The six external surfaces sit
// at different distances from it, making each outer piece a unique size.
const MIRROR_EXTENT = { U: 0.66, R: 0.19, F: 0.37, D: 0.22, L: 0.69, B: 0.51 };
const mirrorPieces = new Map();
board(3).stickers.forEach((sticker, index) => {
  const key = sticker.point.join(",");
  if (!mirrorPieces.has(key)) mirrorPieces.set(key, { point: sticker.point, surfaces: {} });
  mirrorPieces.get(key).surfaces[sticker.face] = index;
});

export function mirrorBounds(state) {
  return [...mirrorPieces.values()].map(({ point, surfaces }) => {
    const low = point.map((p) => p - 1.5);
    const high = point.map((p) => p - 0.5);
    for (const [face, i] of Object.entries(surfaces)) {
      const [axis, sign] = FACES[face];
      const extent = MIRROR_EXTENT[state[i]] || 0;
      if (sign > 0) high[axis] += extent;
      else low[axis] -= extent;
    }
    return { point, surfaces, low, high };
  });
}

function mirrorStickerMap(state) {
  const parts = [];
  for (const piece of mirrorBounds(state)) {
    for (const index of Object.values(piece.surfaces)) parts[index] = piece;
  }
  return parts;
}

function element(tag, className, style = {}) {
  const node = document.createElement(tag);
  node.className = className;
  Object.assign(node.style, style);
  return node;
}

function paintCell(node, color, labels, mirror = false) {
  node.style.background = COLORS[color] || "#696e82";
  node.dataset.color = color || "";
  node.textContent = labels ? (mirror ? color : COLOR_LABELS[color]) || "" : "";
}

function describe(root, state, size, mirror) {
  if (mirror) {
    root.setAttribute("aria-label", "Mirror Cube. Các viên cùng màu, có độ dày và kích thước khác nhau. Vị trí chữ U, R, F, D, L, B dùng để nhận diện viên khi bật ký hiệu.");
    return;
  }
  const count = size * size;
  const faces = [...FACE_ORDER].map((face, i) => {
    const arranged = [...state.slice(i * count, (i + 1) * count)].map((sticker) => COLOR_NAMES[sticker] || "trống");
    return "mặt " + face + ": " + arranged.join(", ");
  });
  root.setAttribute("aria-label", "Rubik " + size + "×" + size + ". " + faces.join("; "));
}

export function renderCube2D(container, initial, size = 3, options = {}) {
  checkSize(size);
  const mirror = options.mirror && size === 3;
  const root = element("div", "rubik-cube-net", {
    display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))",
    gap: "clamp(3px,1vw,8px)", width: "100%", maxWidth: "25rem", marginInline: "auto"
  });
  root.setAttribute("role", "img");
  const cells = [];
  for (const face of FACE_ORDER) {
    const [row, col] = NET[face];
    const faceBlock = element("div", "rubik-net-face", { gridColumn: String(col), gridRow: String(row), minWidth: "0" });
    faceBlock.dataset.face = face;
    faceBlock.setAttribute("aria-hidden", "true");
    if (options.faceLabels !== false) {
      const label = element("small", "rubik-net-label", {
        display: "block", textAlign: "center", lineHeight: "1.2", fontSize: ".67rem", marginBottom: "2px"
      });
      label.textContent = face;
      faceBlock.append(label);
    }
    const grid = element("div", "rubik-net-grid", {
      display: "grid", gridTemplateColumns: "repeat(" + size + ",minmax(0,1fr))",
      gap: "1.4px", padding: "2px", background: "#111522", borderRadius: "5px"
    });
    if (mirror) Object.assign(grid.style, { display: "block", position: "relative", aspectRatio: "1" });
    for (let i = 0; i < size * size; i++) {
      const cell = element("span", "rubik-cube-cell", {
        display: "grid", placeItems: "center", aspectRatio: "1", borderRadius: "2px",
        color: "#161922", font: "700 clamp(5px,1.4vw,11px)/1 system-ui", minWidth: "0"
      });
      grid.append(cell);
      cells.push(cell);
    }
    faceBlock.append(grid);
    root.append(faceBlock);
  }
  function update(state, { labels = options.labels, move = "" } = {}) {
    describe(root, state, size, mirror);
    let turning;
    try { if (move) turning = decodeMove(parseMoves(move, size)[0], size); } catch { /* Only highlight valid turns. */ }
    const { stickers } = board(size);
    const parts = mirror ? mirrorStickerMap(state) : null;
    cells.forEach((cell, i) => {
      paintCell(cell, state[i], labels, mirror);
      if (parts) {
        const face = stickers[i].face;
        const { low, high } = parts[i];
        const [horizontal, right, vertical, down] = FACE_SPANS[face];
        Object.assign(cell.style, {
          background: MIRROR_COLOR[face], border: "1px solid #1b2330",
          position: "absolute", aspectRatio: "auto", boxSizing: "border-box",
          left: (50 + 20 * (right > 0 ? low[horizontal] : -high[horizontal])) + "%",
          top: (50 + 20 * (down > 0 ? low[vertical] : -high[vertical])) + "%",
          width: (20 * (high[horizontal] - low[horizontal])) + "%",
          height: (20 * (high[vertical] - low[vertical])) + "%"
        });
      }
      cell.classList.toggle("rb-turn-target", Boolean(turning && inLayer(stickers[i], turning, size)));
    });
  }
  container.replaceChildren(root);
  update(initial);
  return { update, destroy: () => root.remove() };
}

function spanLength(value, unit) {
  return "calc(" + value + " * " + unit + ")";
}

const CUBE_CAMERAS = {
  standard: [-29, -33],
  hero: [-27, -36],
  top: [-53, -29],
  pair: [-20, -39],
  mirror: [-32, -41]
};

export function renderCube3D(container, initial, size = 3, options = {}) {
  checkSize(size);
  const mirror = options.mirror && size === 3;
  const root = element("div", "rubik-cube-stage", {
    display: "grid", placeItems: "center", width: "100%", maxWidth: "27rem",
    aspectRatio: "1.28", marginInline: "auto", perspective: "760px",
    overflow: "hidden", touchAction: "pan-y", userSelect: "none", cursor: "grab"
  });
  root.tabIndex = 0;
  root.setAttribute("role", "img");
  root.dataset.camera = Object.hasOwn(CUBE_CAMERAS, options.camera) ? options.camera : "standard";
  const scene = element("div", "rubik-cube-volume", {
    position: "relative", width: mirror ? "35%" : "46%", aspectRatio: "1",
    transformStyle: "preserve-3d", pointerEvents: "none"
  });
  scene.setAttribute("aria-hidden", "true");
  root.append(scene);
  const { stickers } = board(size);
  const mid = (size - 1) / 2;
  const cells = mirror ? createMirrorSlots(scene) : stickers.map(({ normal, point, face }) => {
    const slot = element("div", "rubik-3d-slot", {
      position: "absolute", width: 100 / size + "%", height: 100 / size + "%",
      inset: (50 - 50 / size) + "% auto auto " + (50 - 50 / size) + "%",
      display: "grid", padding: size > 4 ? "1px" : "1.5px",
      boxSizing: "border-box", background: "#0c0e15", backfaceVisibility: "hidden",
      transform: "translate3d(" + [
        (point[0] - mid + normal[0] / 2) * 100 + "%",
        (-point[1] + mid - normal[1] / 2) * 100 + "%",
        spanLength(point[2] - mid + normal[2] / 2, "var(--rubik-sticker-size)")
      ].join(",") + ") " + FACE_ANGLES[face]
    });
    const cell = element("span", "rubik-cube-cell", {
      display: "grid", placeItems: "center", minWidth: "0",
      borderRadius: size > 4 ? "3px" : "9%", color: "#161922",
      boxShadow: "inset 0 1px 4px #ffffff52, inset 0 -3px 7px #11182721",
      font: "700 clamp(6px,1.7vw,13px)/1 system-ui"
    });
    slot.append(cell);
    scene.append(slot);
    return { slot, cell, point };
  });
  const resize = () => {
    scene.style.setProperty("--rubik-sticker-size", scene.offsetWidth / size + "px");
  };
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  observer?.observe(root);
  const home = CUBE_CAMERAS[root.dataset.camera];
  let [pitch, yaw] = options.angle || home;
  let pointer = null;
  let previous = "";
  let turn;
  let spin;
  let phaseTimer;
  let finish;
  let highlighted = [];
  const motion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  function camera() {
    scene.style.transform = "rotateX(" + pitch + "deg) rotateY(" + yaw + "deg)";
  }
  function resetCamera() {
    [pitch, yaw] = home;
    camera();
  }
  function clearTurn() {
    clearTimeout(phaseTimer);
    if (spin) {
      spin.onfinish = null;
      spin.cancel();
    }
    if (turn) {
      for (const { slot } of cells) scene.append(slot);
      turn.remove();
    }
    highlighted.forEach(({ cell }) => cell.classList.remove("rb-turn-target"));
    highlighted = [];
    delete root.dataset.turnPhase;
    spin = turn = finish = undefined;
  }
  function finishTurn() {
    finish?.();
  }
  function onMotionChange() {
    if (motion.matches) finishTurn();
  }
  motion?.addEventListener?.("change", onMotionChange);
  function update(state, { labels = options.labels, move = "", duration = 300, preview = 90 } = {}) {
    finishTurn();
    clearTurn();
    describe(root, state, size, mirror);
    const paint = (facelets) => {
      if (mirror) paintMirrorSlots(cells, facelets, labels);
      else cells.forEach(({ cell }, i) => paintCell(cell, facelets[i], labels));
    };
    try {
      const moves = move ? parseMoves(move, size) : [];
      const spec = moves.length === 1 && decodeMove(moves[0], size);
      if (spec) {
        highlighted = cells.filter(({ point }) => inLayer({ point }, spec, size));
        highlighted.forEach(({ cell }) => cell.classList.add("rb-turn-target"));
      }
      if (!spec || motion?.matches || !duration || !previous ||
        applyMoves(previous, moves, size) !== state || typeof scene.animate !== "function") {
        paint(state);
        previous = state;
        return;
      }
      turn = element("div", "rubik-cube-turn", {
        position: "absolute", inset: "0", transformStyle: "preserve-3d"
      });
      scene.append(turn);
      highlighted.forEach(({ slot }) => turn.append(slot));
      const degrees = -spec.sign * spec.amount * 90 * (spec.axis === 1 ? 1 : -1);
      const axis = "XYZ"[spec.axis];
      root.dataset.turnPhase = preview ? "prepare" : "moving";
      if (preview) phaseTimer = setTimeout(() => { root.dataset.turnPhase = "moving"; }, preview);
      spin = turn.animate([{ transform: "rotate" + axis + "(0deg)" }, {
        transform: "rotate" + axis + "(" + degrees + "deg)"
      }], { delay: preview, duration, easing: "cubic-bezier(.32,.02,.24,1)", fill: "both" });
      finish = () => {
        clearTurn();
        paint(state);
        previous = state;
      };
      spin.onfinish = finish;
    } catch {
      clearTurn();
      paint(state);
      previous = state;
    }
  }
  root.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    root.setPointerCapture(event.pointerId);
    root.style.cursor = "grabbing";
  });
  root.addEventListener("pointermove", (event) => {
    if (pointer?.id !== event.pointerId) return;
    yaw += (event.clientX - pointer.x) * 0.6;
    pitch = Math.max(-80, Math.min(80, pitch - (event.clientY - pointer.y) * 0.6));
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    camera();
  });
  function release(event) {
    if (pointer?.id !== event.pointerId) return;
    pointer = null;
    root.style.cursor = "grab";
  }
  root.addEventListener("pointerup", release);
  root.addEventListener("pointercancel", release);
  root.addEventListener("lostpointercapture", release);
  root.addEventListener("keydown", (event) => {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") resetCamera();
    if (event.key === "ArrowLeft") yaw -= 12;
    if (event.key === "ArrowRight") yaw += 12;
    if (event.key === "ArrowUp") pitch = Math.max(-80, pitch - 12);
    if (event.key === "ArrowDown") pitch = Math.min(80, pitch + 12);
    camera();
  });
  container.replaceChildren(root);
  resize();
  camera();
  update(initial);
  return {
    update, resetCamera, finishTurn,
    getCamera: () => [pitch, yaw],
    destroy() {
      observer?.disconnect();
      motion?.removeEventListener?.("change", onMotionChange);
      clearTurn();
      root.remove();
    }
  };
}

function createMirrorSlots(scene) {
  const cells = [];
  [...mirrorPieces.values()].forEach(({ point, surfaces }, pieceIndex) => {
    for (const face of FACE_ORDER) {
      const stickerIndex = surfaces[face];
      const slot = element("div", "rubik-mirror-slot", {
        position: "absolute", top: "50%", left: "50%", display: "grid",
        padding: stickerIndex === undefined ? "0" : "1.5px", boxSizing: "border-box",
        backfaceVisibility: "hidden", background: "#222b39"
      });
      const cell = element("span", "rubik-mirror-cell", {
        display: "grid", placeItems: "center", borderRadius: "4px", color: "#1b2737",
        font: "700 clamp(6px,1.6vw,13px)/1 system-ui",
        boxShadow: stickerIndex === undefined ? "none" : "inset 0 1px 4px #ffffff88, inset 0 -2px 5px #21344b38"
      });
      slot.append(cell);
      scene.append(slot);
      cells.push({ slot, cell, face, point, pieceIndex, stickerIndex });
    }
  });
  return cells;
}

function paintMirrorSlots(cells, state, labels) {
  const parts = mirrorBounds(state);
  const length = (units) => spanLength(units.toFixed(4), "var(--rubik-sticker-size)");
  for (const { slot, cell, face, pieceIndex, stickerIndex } of cells) {
    const { low, high } = parts[pieceIndex];
    const [axis, sign] = FACES[face];
    const [horizontal, , vertical] = FACE_SPANS[face];
    const center = low.map((edge, i) => (edge + high[i]) / 2);
    center[axis] = sign > 0 ? high[axis] : low[axis];
    slot.style.width = length(high[horizontal] - low[horizontal]);
    slot.style.height = length(high[vertical] - low[vertical]);
    slot.style.transform = "translate(-50%,-50%) translate3d(" +
      [center[0], -center[1], center[2]].map(length).join(",") + ") " + FACE_ANGLES[face];
    if (stickerIndex !== undefined) {
      cell.style.background = MIRROR_COLOR[face];
      cell.dataset.color = state[stickerIndex];
      cell.textContent = labels ? state[stickerIndex] : "";
    }
  }
}
