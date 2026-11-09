// Distances, sizes and orbital speeds here are deliberately illustrative.
// Scientific measurements are in the separate, on-demand fact catalogue.
const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const HOME = Object.freeze({
  yaw: -0.43,
  tilt: 0.9,
  zoom: 1,
  x: 0,
  y: 0,
  z: 0,
  panX: 0,
  panY: 0,
  detail: 0
});
export const SYSTEMS = [
  {
    id: "sol",
    name: "Hệ Mặt Trời",
    center: [2.05, 0.82, 0.15],
    tint: "#ffd291",
    bodies: [
      {
        id: "mercury",
        name: "Sao Thủy",
        orbit: 0.27,
        phase: 2.5,
        size: 0.043,
        kind: 3,
        color: "#b4a39a",
        accent: "#bda99c"
      },
      {
        id: "venus",
        name: "Sao Kim",
        orbit: 0.44,
        phase: -0.32,
        size: 0.062,
        kind: 1,
        color: "#ecc28d",
        accent: "#fff0c5"
      },
      {
        id: "earth",
        name: "Trái Đất",
        orbit: 0.63,
        phase: -1.72,
        size: 0.066,
        kind: 0,
        color: "#72a875",
        accent: "#599fdc",
        moon: "Mặt Trăng"
      },
      {
        id: "mars",
        name: "Sao Hỏa",
        orbit: 0.82,
        phase: 1.3,
        size: 0.051,
        kind: 3,
        color: "#df815d",
        accent: "#b34738"
      },
      {
        id: "jupiter",
        name: "Sao Mộc",
        orbit: 1.02,
        phase: 3.03,
        size: 0.101,
        kind: 1,
        color: "#e0a279",
        accent: "#f8d5aa"
      },
      {
        id: "saturn",
        name: "Sao Thổ",
        orbit: 1.22,
        phase: 0.57,
        size: 0.085,
        kind: 1,
        color: "#eac792",
        accent: "#f5ddae",
        ring: true,
        moon: "Titan"
      },
      {
        id: "uranus",
        name: "Sao Thiên Vương",
        orbit: 1.42,
        phase: -2.28,
        size: 0.072,
        kind: 1,
        color: "#84d8dc",
        accent: "#a1e4e2"
      },
      {
        id: "neptune",
        name: "Sao Hải Vương",
        orbit: 1.63,
        phase: -1.03,
        size: 0.071,
        kind: 1,
        color: "#557dda",
        accent: "#859beb"
      }
    ]
  },
  {
    id: "trappist",
    name: "TRAPPIST-1",
    center: [-2.36, -1.42, -0.21],
    tint: "#ff9678",
    bodies: ["b", "c", "d", "e", "f", "g", "h"].map((letter, i) => ({
      id: "trappist-" + letter,
      name: "TRAPPIST-1 " + letter,
      orbit: 0.31 + i * 0.185,
      phase: [0.55, 2.82, -1.24, 1.75, -2.3, 0.09, -0.85][i],
      size: [0.066, 0.065, 0.052, 0.059, 0.063, 0.067, 0.05][i],
      kind: 3,
      color: ["#b98369", "#ca947e", "#ac927f", "#8ca4aa", "#adb4aa", "#a6a7bf", "#bcb1a9"][i],
      accent: "#d4ab93"
    }))
  }
];
export const getSystem = (id) => SYSTEMS.find((system) => system.id === id);
export const getBody = (id) => SYSTEMS.flatMap((system) => system.bodies).find((body) => body.id === id);
const spreadFor = (state, system) => state.globalSpread * state.localSpread[system.id];
const extent = (width, height) => Math.max(11.85, (7.25 * width) / height);
export function newMap() {
  return {
    camera: { ...HOME },
    globalSpread: 1,
    localSpread: { sol: 1, trappist: 1 },
    system: null,
    savedAngle: null,
    travel: null,
    elapsed: 0,
    selected: null,
    pointed: null
  };
}
// Rotate the disc about Z, incline about X, then roll slightly in the sky plane.
// Both the Three.js matrix and the accessible hit targets use these same rows.
export function basis(yaw, tilt, roll = 0.19) {
  const c = Math.cos(yaw),
    s = Math.sin(yaw),
    a = Math.cos(tilt),
    b = Math.sin(tilt),
    u = Math.cos(roll),
    v = Math.sin(roll);
  return [
    u * c - v * a * s,
    -u * s - v * a * c,
    v * b,
    v * c + u * a * s,
    -v * s + u * a * c,
    -u * b,
    b * s,
    b * c,
    a
  ];
}
function dot(row, i, p) {
  return row[i] * p[0] + row[i + 1] * p[1] + row[i + 2] * p[2];
}
export function projection(state, width, height) {
  width = Math.max(1, width);
  height = Math.max(1, height);
  const c = state.camera,
    axes = basis(c.yaw, c.tilt);
  const center = [c.x, c.y, c.z],
    scale = (width * c.zoom) / extent(width, height);
  return {
    axes,
    width,
    height,
    scale,
    offsetX: c.panX - dot(axes, 0, center),
    offsetY: c.panY - dot(axes, 3, center)
  };
}
export function screen(p, fr) {
  return {
    x: fr.width / 2 + (dot(fr.axes, 0, p) + fr.offsetX) * fr.scale,
    y: fr.height / 2 - (dot(fr.axes, 3, p) + fr.offsetY) * fr.scale,
    depth: dot(fr.axes, 6, p)
  };
}
function hostPosition(state, system) {
  return system.center.map((v) => v * state.globalSpread);
}
function fitZoom(state, width, height, system, yaw, tilt) {
  const aspect = width / height,
    base = extent(width, height);
  if (system) {
    const r = system.bodies.at(-1).orbit * spreadFor(state, system);
    return base / Math.max(2 * r + 0.51, (2 * r * Math.max(0.68, Math.cos(tilt)) + 0.56) * aspect);
  }
  const axes = basis(yaw, tilt);
  let halfWidth = base / 2;
  for (const sys of SYSTEMS) {
    const pos = hostPosition(state, sys);
    const r = sys.bodies.at(-1).orbit * spreadFor(state, sys) + 0.25;
    halfWidth = Math.max(halfWidth, Math.abs(dot(axes, 0, pos)) + r, (Math.abs(dot(axes, 3, pos)) + r) * aspect);
  }
  return base / (2 * halfWidth * 1.07);
}
function fly(state, to, instant) {
  if (instant) {
    Object.assign(state.camera, to);
    state.travel = null;
  } else state.travel = { from: { ...state.camera }, to, age: 0 };
}
export function settle(state) {
  if (state.travel) Object.assign(state.camera, state.travel.to);
  state.travel = null;
}
export function visit(state, id, w, h, instant = false) {
  const sys = getSystem(id);
  if (!sys) return;
  if (!state.system) state.savedAngle = { yaw: state.camera.yaw, tilt: state.camera.tilt };
  state.system = id;
  state.selected = null;
  state.pointed = null;
  const [x, y, z] = hostPosition(state, sys),
    tilt = 0.48,
    yaw = -0.18;
  fly(state, { ...HOME, x, y, z, yaw, tilt, detail: 1, zoom: fitZoom(state, w, h, sys, yaw, tilt) }, instant);
}
export function overview(state, w, h, instant = false, reset = false) {
  const current = reset ? HOME : state.savedAngle || state.camera;
  const yaw = current.yaw,
    tilt = current.tilt;
  state.system = null;
  state.selected = null;
  state.pointed = null;
  state.savedAngle = null;
  fly(state, { ...HOME, yaw, tilt, zoom: fitZoom(state, w, h, null, yaw, tilt) }, instant);
}
export function setSpread(state, scope, value) {
  settle(state);
  const v = clamp(Number.isFinite(value) ? value : 1, 0.7, 2.4);
  if (scope === "local" && state.system) state.localSpread[state.system] = v;
  else state.globalSpread = v;
  if (state.system)
    [state.camera.x, state.camera.y, state.camera.z] = hostPosition(state, getSystem(state.system));
}
export function orbit(state, dx, dy) {
  settle(state);
  state.camera.yaw += dx * 0.009;
  state.camera.tilt = clamp(state.camera.tilt + dy * 0.007, -1.37, 1.37);
}
export function pan(state, dx, dy, fr) {
  settle(state);
  state.camera.panX += dx / fr.scale;
  state.camera.panY -= dy / fr.scale;
}
export function zoomAt(state, factor, x, y, w, h) {
  settle(state);
  const before = projection(state, w, h).scale;
  state.camera.zoom = clamp(state.camera.zoom * factor, 0.15, 26);
  const after = projection(state, w, h).scale;
  state.camera.panX += (x - w / 2) * (1 / after - 1 / before);
  state.camera.panY -= (y - h / 2) * (1 / after - 1 / before);
}
export function advance(state, seconds, playing) {
  if (playing) state.elapsed += seconds;
  const t = state.travel;
  if (!t) return;
  t.age += seconds;
  const ratio = Math.min(1, t.age / 0.72),
    eased = 1 - (1 - ratio) ** 3;
  for (const key of Object.keys(HOME)) state.camera[key] = t.from[key] + (t.to[key] - t.from[key]) * eased;
  if (ratio === 1) state.travel = null;
}
export function entries(state, fr) {
  return SYSTEMS.map((system, si) => {
    const pos = hostPosition(state, system),
      anchor = screen(pos, fr),
      expansion = spreadFor(state, system);
    const detail = state.system === system.id ? state.camera.detail : 0;
    const near = clamp((state.camera.zoom - 1.8) / 1.2, 0, 1);
    const opacity = state.system ? detail : near;
    const planets = system.bodies.map((body, i) => {
      const r = body.orbit * expansion,
        phase = body.phase + state.elapsed * (0.036 / (1 + i * 0.29));
      const inclination = 0.045 * Math.sin(1.8 * i + si),
        sin = Math.sin(phase);
      const p = [
        pos[0] + r * Math.cos(phase),
        pos[1] + r * sin * Math.cos(inclination),
        pos[2] + r * sin * Math.sin(inclination)
      ];
      const pt = screen(p, fr);
      const radius = Math.max(1.2 + opacity * 3.5, Math.min(22, body.size * fr.scale));
      const moonAngle = phase * 2 + state.elapsed * 0.16;
      const moon = body.moon
        ? [
            p[0] + 0.155 * expansion * Math.cos(moonAngle),
            p[1] + 0.155 * expansion * Math.sin(moonAngle),
            p[2] + 0.035 * expansion * Math.sin(moonAngle)
          ]
        : null;
      return { body, p, pt, r, radius, inclination, moon, moonScreen: moon ? screen(moon, fr) : null };
    });
    return { system, pos, anchor, opacity, planets };
  });
}
