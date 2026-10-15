const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const composer = require("../graphic-design-composer.js");

test("Universal Composer starts with a multi-engine anime scene", () => {
  const scene = composer.createStarterScene();
  assert.equal(scene.format, composer.FORMAT);
  for (const type of ["scene3d", "vector", "character", "ui", "audio", "animation"]) {
    assert.ok(scene.layers.some((layer) => layer.type === type), `missing ${type}`);
  }
  assert.ok(scene.artboards.length >= 2);
  assert.ok(scene.stateMachine.transitions.length >= 2);
});

test("Composer imports actual current-frame layers while preserving payload and reporting proxies", () => {
  const document = { id: "doc-a", name: "Actual design", activeFrameId: "f1", canvas: { background: "#111111" }, frames: [{ id: "f1", x: 100, y: 80, width: 800, height: 600 }], layers: [{ id: "rect-real", frameId: "f1", type: "rect", x: 120, y: 90, width: 200, height: 80, fill: "#123456", stroke: "none" }, { id: "image-real", frameId: "f1", type: "image", assetId: "original" }, { id: "other", frameId: "f2", type: "rect" }] };
  const scene = composer.sceneFromDocument(document);
  assert.deepEqual(scene.layers.map((item) => item.id), ["rect-real", "image-real"]);
  assert.equal(scene.layers[0].transform.x, 20); assert.equal(scene.layers[0].transform.y, 10);
  assert.equal(scene.layers[0].source.payload.frameId, "f1");
  const coverage = composer.renderCapabilities(scene);
  assert.deepEqual(coverage.native, ["rect-real"]); assert.equal(coverage.proxy[0].id, "image-real");
  assert.equal(coverage.complete, false);
  scene.layers[0].source.payload.x = -100;
  assert.equal(document.layers[0].x, 120);
  assert.equal(composer.sceneFromDocument(null), null);
  const starter = composer.renderCapabilities(composer.createStarterScene());
  assert.ok(starter.proxy.length > 0); assert.ok(starter.dataOnly.length > 0);
});

test("Composer evaluates keyframes and data bindings", () => {
  let scene = composer.createStarterScene();
  const character = scene.layers.find((layer) => layer.type === "character");
  scene.timeline.keyframes = scene.timeline.keyframes.filter((key) => key.layerId !== character.id);
  scene.timeline.keyframes.push(
    { id: "k1", layerId: character.id, property: "x", time: 0, value: 10 },
    { id: "k2", layerId: character.id, property: "x", time: 2, value: 110 }
  );
  scene = composer.normalizeScene(scene);
  assert.equal(composer.evaluateLayer(scene, character, 1).transform.x, 60);
  const bound = composer.applyBinding(scene, "dialogue", "Xin chào vũ trụ");
  assert.ok(bound.layers.some((layer) => layer.content === "Xin chào vũ trụ"));
});

test("Composer dispatches state transitions and creates handoff payloads", () => {
  const scene = composer.createStarterScene();
  const initial = scene.stateMachine.current;
  const transition = scene.stateMachine.transitions.find((item) => item.from === initial);
  const result = composer.dispatchEvent(scene, transition.event, transition.targetId || "");
  assert.equal(result.changed, true);
  assert.equal(result.scene.stateMachine.current, transition.to);
  const layer = scene.layers.find((item) => item.type === "character");
  const handoff = composer.handoffPayload(scene, layer.id);
  assert.equal(handoff.targetModule, "HHGraphicCharacter");
  assert.equal(handoff.format, "hh-creative-handoff");
});

test("Composer exports a portable project and controllable Web Component", () => {
  const scene = composer.createStarterScene();
  scene.layers.find((layer) => layer.type === "ui").content = '<img src=x onerror="globalThis.pwned=1">';
  const project = JSON.parse(composer.exportScene(scene));
  assert.equal(project.extension, ".hhscene");
  const html = composer.exportWebComponent(scene);
  assert.match(html, /customElements\.define\('hh-universal-scene'/);
  assert.match(html, /setBinding\(name,value\)/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /innerHTML/);
  assert.match(html, /el\.textContent=l\.content\|\|l\.name/);
  assert.match(html, /disconnectedCallback\(\)\{this\.pause/);
  assert.match(html, /renderFrame\(\)/);
});

test("Waveform generation is bounded", () => {
  const values = composer.createWaveform(Float32Array.from([0, .2, -.8, 1, -.4, .1]), 16);
  assert.equal(values.length, 16);
  assert.ok(values.every((value) => value >= 0 && value <= 1));
});

function audioLifecycleHarness(decode) {
  const nodes = new Map();
  const node = () => ({ style: {}, dataset: {}, innerHTML: "", textContent: "", clientWidth: 1000, clientHeight: 700, events: new Map(), classList: { add() {}, remove() {} }, setAttribute() {}, removeAttribute() {}, addEventListener(type, handler) { this.events.set(type, handler); }, removeEventListener(type) { this.events.delete(type); } });
  const context2d = { setTransform() {}, fillRect() {} };
  const root = node();
  root.querySelector = (selector) => { if (!nodes.has(selector)) { const next = node(); next.parentElement = node(); next.getContext = () => context2d; nodes.set(selector, next); } return nodes.get(selector); };
  let created = 0, closed = 0, urls = 0;
  const document = node(); document.getElementById = () => ({});
  const scope = { document, performance: { now: () => 0 }, setTimeout, clearTimeout, URL: { createObjectURL() { urls += 1; return "blob:qa-audio"; }, revokeObjectURL() {} }, localStorage: { getItem: () => null, setItem() {} }, AudioContext: class { constructor() { created += 1; } decodeAudioData() { return decode(); } close() { closed += 1; return Promise.resolve(); } } };
  vm.runInNewContext(fs.readFileSync(require.resolve("../graphic-design-composer.js"), "utf8"), scope);
  const controller = scope.HHGraphicComposer.mount(root, { format: scope.HHGraphicComposer.FORMAT, layers: [] });
  const input = root.querySelector('[data-hhc-file="audio"]');
  return { controller, root, input, start(file) { input.files = [file]; input.events.get("change")({ target: input }); }, metrics: () => ({ created, closed, urls }) };
}

test("audio import unmounted before arrayBuffer resolves creates no context or Blob URL", async () => {
  let resolveBuffer;
  const pending = new Promise((resolve) => { resolveBuffer = resolve; });
  const fixture = audioLifecycleHarness(() => { throw new Error("must not decode"); });
  fixture.start({ name: "late.wav", type: "audio/wav", arrayBuffer: () => pending });
  fixture.controller.unmount(); resolveBuffer(new ArrayBuffer(8));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fixture.metrics(), { created: 0, closed: 0, urls: 0 });
  assert.equal(fixture.root.innerHTML, "");
});

test("audio import unmounted during decode closes context once and ignores late decoded data", async () => {
  let resolveDecode;
  const pending = new Promise((resolve) => { resolveDecode = resolve; });
  const fixture = audioLifecycleHarness(() => pending);
  fixture.start({ name: "late.wav", type: "audio/wav", arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fixture.metrics().created, 1);
  fixture.controller.unmount();
  assert.equal(fixture.metrics().closed, 1);
  resolveDecode({ duration: 10, getChannelData: () => Float32Array.of(0, 1) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fixture.metrics(), { created: 1, closed: 1, urls: 0 });
  assert.equal(fixture.root.innerHTML, "");
});

test("decode failure closes its AudioContext through finally without creating Blob URLs", async () => {
  const fixture = audioLifecycleHarness(() => Promise.reject(new Error("invalid audio")));
  fixture.start({ name: "bad.wav", type: "audio/wav", arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fixture.metrics(), { created: 1, closed: 1, urls: 0 });
  fixture.controller.unmount();
  assert.equal(fixture.metrics().closed, 1);
});
