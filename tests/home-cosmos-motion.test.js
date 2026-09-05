const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const api = require("../home-cosmos-motion.js");
const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("particles are deterministic, finite and different for each independent layer", () => {
  const first = api.makeParticles(1700, "galaxy");
  assert.equal(first.length, 1700 * 8);
  assert.ok([...first].every(Number.isFinite));
  assert.deepEqual(first, api.makeParticles(1700, "galaxy"));
  assert.notDeepEqual(first, api.makeParticles(1700, "platform"));
  for (let i = 0; i < 1700; i++) for (let channel = 3; channel < 6; channel++) assert.ok(first[i * 8 + channel] >= 0 && first[i * 8 + channel] <= 1);
});

test("motion respects quiet/static, system reduction and bounded weak-device budgets", () => {
  for (const mode of ["quiet", "static", "off"]) assert.equal(api.quality({mode}).static, true);
  assert.equal(api.quality({mode: "rich", reduced: true}).static, true);
  assert.equal(api.quality({mode: "rich", saveData: true}).count, 500);
  assert.equal(api.quality({memory: 4}).dpr, 1);
  assert.equal(api.quality({cores: 2}).fps, 24);
  assert.equal(api.quality({mode: "rich", memory: 8, cores: 8}).count, 2600);
});

function fixture({ webgl = true, reduced = false } = {}) {
  class Node {
    constructor() { this.dataset = {}; this.children = []; this.listeners = new Map(); this.hidden = false; this.attrs = {}; this.style = { setProperty() {}, removeProperty() {} }; }
    addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn); }
    removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
    fire(name, event = {}) { [...(this.listeners.get(name) || [])].forEach(fn => fn(event)); }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    removeAttribute(name) { delete this.attrs[name]; }
    appendChild(child) { child.parent = this; this.children.push(child); return child; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
    querySelector(name) { if (name === "span" || name === "b") return this[name] ||= new Node(); return anchor; }
    querySelectorAll() { return []; }
    getBoundingClientRect() { return {left: 0, top: 0, width: 1200, height: 700}; }
  }
  let draws = 0, deletions = 0, rafId = 0;
  const pending = new Map();
  const gl = new Proxy({
    createProgram: () => ({}), createShader: () => ({}), createBuffer: () => ({}),
    getShaderParameter: () => true, getProgramParameter: () => true, getAttribLocation: () => 0,
    getUniformLocation: () => ({}), drawArrays: () => { draws++; },
    deleteBuffer: () => { deletions++; }, deleteShader: () => { deletions++; }, deleteProgram: () => { deletions++; },
    getExtension: () => null
  }, { get(target, name) { return name in target ? target[name] : /^[A-Z_]+$/.test(name) ? 1 : () => {}; } });
  const doc = new Node(), anchor = new Node();
  anchor.getBoundingClientRect = () => ({left: 500, top: 250, width: 150, height: 150});
  doc.createElement = () => { const node = new Node(); node.ownerDocument = doc; node.getContext = () => webgl ? gl : null; return node; };
  const root = doc.createElement(), stage = doc.createElement();
  root.appendChild(stage);
  const media = new Node(); media.matches = reduced;
  const scope = new Node();
  Object.assign(scope, { document: doc, navigator: {deviceMemory: 8, hardwareConcurrency: 8}, devicePixelRatio: 2,
    matchMedia: (query) => query.includes("reduced") ? media : { matches: false },
    requestAnimationFrame: (fn) => { pending.set(++rafId, fn); return rafId; },
    cancelAnimationFrame: (id) => pending.delete(id)
  });
  vm.runInNewContext(read("home-cosmos-motion.js"), scope);
  const instance = scope.HHHomeCosmosMotion.mount(root, {stage, variant: "platform", mode: () => "balanced"});
  const effects = stage.children[0], canvas = effects.children[0], button = stage.children[1];
  const flush = (now) => { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(fn => fn(now)); };
  return {scope, root, stage, instance, doc, canvas, button, media, pending, flush, draws: () => draws, deletions: () => deletions};
}

test("one animation owner ticks continuously and pauses/resumes without duplicate RAFs", () => {
  const f = fixture();
  assert.equal(f.instance.getState().renderer, "webgl");
  assert.equal(f.pending.size, 1);
  f.flush(100); f.flush(150); assert.ok(f.draws() >= 3); assert.equal(f.pending.size, 1);
  f.instance.sync(); f.instance.sync(); assert.equal(f.pending.size, 1);
  f.button.fire("click"); assert.equal(f.pending.size, 0); assert.equal(f.root.dataset.hchPaused, "true");
  f.button.fire("click"); assert.equal(f.pending.size, 1);
  f.doc.hidden = true; f.doc.fire("visibilitychange"); assert.equal(f.pending.size, 0);
  f.doc.hidden = false; f.doc.fire("visibilitychange"); assert.equal(f.pending.size, 1);
  f.instance.destroy(); assert.equal(f.pending.size, 0); assert.equal(f.stage.children.length, 0); assert.ok(f.deletions() >= 4);
  f.doc.fire("visibilitychange"); assert.equal(f.pending.size, 0);
  f.instance.destroy();
});

test("WebGL-unavailable and reduced-motion states stay usable without a render loop", () => {
  const fallback = fixture({webgl: false});
  assert.equal(fallback.instance.getState().renderer, "css"); assert.equal(fallback.canvas.hidden, true); assert.equal(fallback.pending.size, 0);
  fallback.instance.destroy();
  const staticView = fixture({reduced: true});
  assert.equal(staticView.pending.size, 0); assert.equal(staticView.button.disabled, true); assert.equal(staticView.root.dataset.hchMotion, "static");
  staticView.media.matches = false; staticView.media.fire("change"); assert.equal(staticView.pending.size, 1);
  staticView.instance.destroy();
});

test("lost GPU context recovers only while mounted and remount releases old resources", () => {
  const f = fixture();
  f.canvas.fire("webglcontextlost", {preventDefault() {}}); assert.equal(f.pending.size, 0); assert.equal(f.canvas.hidden, true);
  f.canvas.fire("webglcontextrestored"); assert.equal(f.pending.size, 1); assert.equal(f.canvas.hidden, false);
  const replacement = f.scope.HHHomeCosmosMotion.mount(f.root, {stage:f.stage});
  assert.equal(f.stage.children.length, 2); assert.equal(f.pending.size, 1);
  f.instance.destroy(); assert.equal(f.pending.size, 1);
  replacement.destroy(); assert.equal(f.pending.size, 0);
});

test("presentation never reads user stores or changes routes and ships with both homes", () => {
  const source = read("home-cosmos-motion.js"), css = read("home-cosmos-motion.css"), loader = read("performance-loader.js");
  assert.doesNotMatch(source, /localStorage|sessionStorage|fetch\(|XMLHttpRequest|location\.hash|\.navigate\(/);
  assert.match(source, /IntersectionObserver/); assert.match(source, /1_800_000/);
  assert.match(css, /pointer-events:none !important/); assert.match(css, /prefers-reduced-motion:reduce/); assert.match(css, /forced-colors:active/);
  assert.match(css, /data-hch-paused="true"/); assert.match(css, /rotateX\(66deg\)/);
  assert.ok(loader.includes('"home-cosmos-motion.css?v=2"')); assert.ok(read("sw.js").includes('"./home-cosmos-motion.js?v=1"'));
  assert.match(read("platform-home.js"), /cosmos\?\.destroy/);
  assert.match(read("galaxy-home-ai.js"), /runtime\.cosmos\?\.destroy/);
});
