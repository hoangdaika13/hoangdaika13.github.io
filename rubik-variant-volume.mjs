const degree = Math.PI / 180;
const ringStart = -75;
const corners = [[0, 1], [3, 4], [6, 7], [9, 10], [13, 14], [16, 17], [19, 20], [22, 23]];
const wedgeCorner = new Map(corners.flatMap(([a, b]) => [[a, a], [b, a]]));
const wingColors = ["#e74654", "#3475eb", "#fa802c", "#2eb96b"];
const wedgeSides = [
  0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 0, 0,
  0, 0, 3, 3, 3, 2, 2, 2, 1, 1, 1, 0
];
const gold = "#ffd740";
const light = "#f4f7ff";
const shell = "#202d43";
const dark = "#152034";
const halfTurnFront = [
  ["#f8842c", "#2eb96b", "#2eb96b", "#e74654", "#e74654", "#f8842c"],
  ["#f8842c", "#3475eb", "#3475eb", "#e74654", "#f8842c", "#f8842c"]
];

const mod = (number, count) => ((number % count) + count) % count;
const radial = (angle, radius = 1) => [Math.cos(angle * degree) * radius, Math.sin(angle * degree) * radius];

function node(tag, className, styles) {
  const element = document.createElement(tag);
  element.className = className;
  if (styles) Object.assign(element.style, styles);
  return element;
}

export function clockProjection(pattern) {
  const { DIALS, FACES, HOUR_MARKS } = pattern.patternData;
  return [0, 1].map((side) => ({
    side: FACES.pieces[side * 9] >= 9 ? "B" : "A",
    dials: DIALS.orientation.slice(side * 9, side * 9 + 9).map((turn, i) => {
      const hoursTurn = HOUR_MARKS.orientation[side * 9 + i];
      return { turn, hoursTurn, hour: mod(turn - hoursTurn * 3, 12) || 12 };
    })
  }));
}

// There are twelve 30° slots per ring. Two adjacent slots can hold one
// corner. The lower ring runs in reverse when looking from above.
export function squareRings(pattern) {
  const { WEDGES, EQUATOR } = pattern.patternData;
  const layers = [0, 1].map((side) => {
    const ring = WEDGES.pieces.slice(side * 12, side * 12 + 12);
    const direction = side ? -1 : 1;
    const identity = (id) => wedgeCorner.get(id) ?? id;
    const pieces = [];
    for (const [slot, id] of ring.entries()) {
      const key = identity(id);
      if (identity(ring[mod(slot - 1, 12)]) === key) continue;
      const width = identity(ring[mod(slot + 1, 12)]) === key ? 2 : 1;
      const angle = ringStart + direction * 30 * slot;
      const angles = width === 2 ? [angle, angle + direction * 30, angle + direction * 60] : [angle, angle + direction * 30];
      const outer = angles.map((value, i) => radial(value, width === 2 && i === 1 ? Math.SQRT2 : 1 / Math.cos(15 * degree)));
      pieces.push({
        slot, width, key, outer,
        cap: id < 12 ? gold : light,
        colors: Array.from({ length: width }, (_, i) => wingColors[wedgeSides[ring[mod(slot + i, 12)]]])
      });
    }
    return pieces;
  });
  return { layers, equator: EQUATOR.pieces.map((piece, slot) => ({ piece, turn: EQUATOR.orientation[slot] })) };
}

function clockVolume(scene) {
  const thick = 11;
  const bodyShape = "polygon(19% 0,81% 0,81% 10%,90% 10%,90% 19%,100% 19%,100% 81%,90% 81%,90% 90%,81% 90%,81% 100%,19% 100%,19% 90%,10% 90%,10% 81%,0 81%,0 19%,10% 19%,10% 10%,19% 10%)";
  const diameter = 192;
  const center = diameter / 2;
  const shape = [[19,0],[81,0],[81,10],[90,10],[90,19],[100,19],[100,81],[90,81],
    [90,90],[81,90],[81,100],[19,100],[19,90],[10,90],[10,81],[0,81],[0,19],[10,19],[10,10],[19,10]];
  for (const [index, start] of shape.entries()) {
    const end = shape[(index + 1) % shape.length];
    const a = start.map((value) => diameter * value / 100 - center);
    const b = end.map((value) => diameter * value / 100 - center);
    const [ax, ay] = a, [bx, by] = b;
    const width = Math.hypot(bx - ax, by - ay) + 0.4;
    const turn = Math.atan2(by - ay, bx - ax) / degree;
    scene.append(node("span", "rb-variant-clock-wall", {
      width: width + "px", height: thick * 2 + "px", marginLeft: -width / 2 + "px", marginTop: -thick + "px",
      transform: "translate3d(" + (ax + bx) / 2 + "px," + (ay + by) / 2 + "px,0) rotateZ(" + turn + "deg) rotateX(-90deg)"
    }));
  }
  const views = [0, 1].map((side) => {
    const face = node("div", "rb-variant-clock-face", {
      width: diameter + "px", height: diameter + "px", clipPath: bodyShape,
      marginLeft: -center + "px", marginTop: -center + "px",
      transform: "rotateY(" + (side ? 180 : 0) + "deg) translateZ(" + thick + "px)"
    });
    const dials = Array.from({ length: 9 }, () => {
      const dial = node("span", "rb-variant-dial");
      const numbers = node("span", "rb-variant-dial-marks");
      for (const label of ["12", "3", "6", "9"]) {
        const index = node("span", "rb-variant-hour");
        index.textContent = label;
        numbers.append(index);
      }
      const hand = node("i", "rb-variant-hand");
      dial.append(numbers, hand, node("i", "rb-variant-hand-hub"));
      face.append(dial);
      return { dial, numbers, hand, angle: null };
    });
    for (const [horizontal, vertical] of [[34, 34], [66, 34], [34, 66], [66, 66]]) {
      face.append(node("span", "rb-variant-clock-pin", { left: horizontal + "%", top: vertical + "%" }));
    }
    scene.append(face);
    return { face, dials };
  });
  return (pattern) => {
    const faces = clockProjection(pattern);
    for (const [side, { side: key, dials }] of faces.entries()) {
      const view = views[side];
      view.face.dataset.clockSide = key;
      for (const [index, { turn, hoursTurn, hour }] of dials.entries()) {
        const item = view.dials[index];
        const previous = item.angle ?? turn * 30;
        item.angle = previous + mod(turn * 30 - previous + 180, 360) - 180;
        item.hand.style.transform = "rotate(" + item.angle + "deg)";
        item.numbers.style.transform = "rotate(" + hoursTurn * 90 + "deg)";
        item.dial.dataset.hour = String(hour);
      }
    }
    return "Clock 3D. Mặt phía trước " + faces[0].side + ": " + faces[0].dials.map(({ hour }) => hour).join(", ") +
      " giờ. Mặt phía sau " + faces[1].side + ": " + faces[1].dials.map(({ hour }) => hour).join(", ") + " giờ.";
  };
}

const squareScale = 77;
const capSize = 240;
const pathPoint = ([x, z], flip) => (capSize / 2 + x * squareScale) + "px " + (capSize / 2 + z * squareScale * flip) + "px";
const planeWidth = capSize + "px";

function capFace(points, y, direction, fill) {
  return node("span", "rb-variant-square-plane", {
    width: planeWidth, height: planeWidth, backgroundColor: fill,
    marginLeft: -capSize / 2 + "px", marginTop: -capSize / 2 + "px",
    clipPath: "polygon(" + points.map((point) => pathPoint(point, direction)).join(",") + ")",
    transform: "translateY(" + y + "px) rotateX(" + direction * 90 + "deg)"
  });
}

function verticalFace(a, b, hi, lo, fill, textured) {
  const [x, z] = a, [u, v] = b;
  const width = Math.hypot(u - x, v - z) * squareScale + 0.35;
  const yaw = -Math.atan2(v - z, u - x) / degree;
  const wall = node("span", "rb-variant-square-wall", {
    width: width + "px", height: lo - hi + "px", backgroundColor: fill,
    marginLeft: -width / 2 + "px", marginTop: (hi - lo) / 2 + "px",
    transform: "translate3d(" + (x + u) * squareScale / 2 + "px," + (hi + lo) / 2 + "px," +
      (z + v) * squareScale / 2 + "px) rotateY(" + yaw + "deg)"
  });
  if (textured) wall.dataset.sticker = "";
  return wall;
}

function inset(points, amount) {
  const center = points.reduce(([x, z], [a, b]) => [x + a / points.length, z + b / points.length], [0, 0]);
  return points.map(([x, z]) => [x + (center[0] - x) * amount, z + (center[1] - z) * amount]);
}

function prism(container, polygon, hi, lo, outer, colors, coloredTop, coloredBottom) {
  container.append(capFace(polygon, hi, 1, shell), capFace(polygon, lo, -1, shell));
  if (coloredTop) container.append(capFace(inset(polygon, 0.048), hi - 0.2, 1, coloredTop));
  if (coloredBottom) container.append(capFace(inset(polygon, 0.048), lo + 0.2, -1, coloredBottom));
  for (const [index, a] of polygon.entries()) {
    const b = polygon[(index + 1) % polygon.length];
    const at = outer.findIndex((point, i) => point === a && outer[i + 1] === b);
    container.append(verticalFace(a, b, hi, lo, at >= 0 ? colors[at] : dark, at >= 0));
  }
}

function halfSquare(side) {
  const axis = radial(ringStart);
  const points = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const offset = ([x, z]) => side * (axis[0] * z - axis[1] * x);
  return points.flatMap((a, index) => {
    const b = points[(index + 1) % 4], u = offset(a), v = offset(b);
    const result = u >= 0 ? [a] : [];
    if (u * v < 0) result.push(a.map((value, i) => value + (b[i] - value) * u / (u - v)));
    return result;
  });
}

function equatorVolume(container, parts) {
  const reflectionAxis = radial(ringStart + 90);
  for (const [slot, { piece, turn }] of parts.entries()) {
    const solid = halfSquare(slot === 0 ? 1 : -1).map(([x, z]) => {
      if (mod(turn, 6) !== 3) return [x, z];
      const scalar = 2 * (x * reflectionAxis[0] + z * reflectionAxis[1]);
      return [scalar * reflectionAxis[0] - x, scalar * reflectionAxis[1] - z];
    });
    const order = solid.concat([solid[0]]);
    prism(container, solid, -10, 10, order, order.map((_, i) => halfTurnFront[piece][mod(turn + i, 6)]), null, null);
  }
}

function squareVolume(scene) {
  return (pattern) => {
    const { layers, equator } = squareRings(pattern);
    const surfaces = document.createDocumentFragment();
    equatorVolume(surfaces, equator);
    for (const [ring, pieces] of layers.entries()) {
      for (const { outer, colors, cap } of pieces) {
        prism(surfaces, [[0, 0], ...outer], ring === 0 ? -44 : 12,
          ring === 0 ? -12 : 44, outer, colors, ring === 0 ? cap : null, ring === 1 ? cap : null);
      }
    }
    scene.replaceChildren(surfaces);
    return "Square-1 3D. Tầng trên có " + layers[0].length + " mảnh, tầng dưới có " +
      layers[1].length + " mảnh. Lát giữa " + (equator[1].turn ? "đã lật." : "đang thẳng.");
  };
}

export function mountVariantVolume(host, puzzle, pattern) {
  if (puzzle !== "clock" && puzzle !== "square1") throw new Error("Khối này chưa dùng trình xem 3D này.");
  const stage = node("div", "rb-variant-stage");
  const scene = node("div", "rb-variant-scene");
  scene.setAttribute("aria-hidden", "true");
  stage.dataset.variant = puzzle;
  stage.tabIndex = 0;
  stage.setAttribute("role", "img");
  stage.append(scene);
  host.replaceChildren(stage);
  const home = puzzle === "clock" ? [12, -21] : [-27, -25];
  let [pitch, yaw] = home;
  let pointer = null;
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  function camera() {
    const factor = Math.min(1.32, stage.clientWidth / 255, stage.clientHeight / 244);
    scene.style.transform = "rotateX(" + pitch + "deg) rotateY(" + yaw + "deg) scale3d(" +
      [factor, factor, factor].join(",") + ")";
  }
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(camera) : null;
  observer?.observe(stage);
  const paint = puzzle === "clock" ? clockVolume(scene) : squareVolume(scene);
  function update(current) {
    const description = paint(current);
    stage.setAttribute("aria-label", description + " Kéo hoặc dùng phím mũi tên để đổi góc. Home đặt lại góc nhìn, End xem mặt sau.");
  }
  stage.addEventListener("keydown", (event) => {
    if (!["Home", "End", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") [pitch, yaw] = home;
    if (event.key === "End") { pitch = home[0]; yaw = home[1] + 180; }
    if (event.key === "ArrowUp") pitch = Math.max(-84, pitch - 14);
    if (event.key === "ArrowDown") pitch = Math.min(84, pitch + 14);
    if (event.key === "ArrowLeft") yaw -= 18;
    if (event.key === "ArrowRight") yaw += 18;
    camera();
  }, { signal });
  stage.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    const { pointerId, clientX: x, clientY: y } = event;
    pointer = { pointerId, x, y };
    stage.setPointerCapture(pointerId);
    stage.dataset.dragging = "";
  }, { signal });
  stage.addEventListener("pointermove", (event) => {
    if (pointer?.pointerId !== event.pointerId) return;
    yaw += (event.clientX - pointer.x) * 0.6;
    pitch = Math.max(-84, Math.min(84, pitch - (event.clientY - pointer.y) * 0.6));
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    camera();
  }, { signal });
  function release(event) {
    if (pointer?.pointerId !== event.pointerId) return;
    pointer = null;
    delete stage.dataset.dragging;
  }
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    stage.addEventListener(type, release, { signal });
  }
  camera();
  update(pattern);
  return { update, destroy() { lifecycle.abort(); observer?.disconnect(); stage.remove(); } };
}
