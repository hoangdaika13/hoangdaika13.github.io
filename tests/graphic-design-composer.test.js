const test = require("node:test");
const assert = require("node:assert/strict");
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
});

test("Waveform generation is bounded", () => {
  const values = composer.createWaveform(Float32Array.from([0, .2, -.8, 1, -.4, .1]), 16);
  assert.equal(values.length, 16);
  assert.ok(values.every((value) => value >= 0 && value <= 1));
});
