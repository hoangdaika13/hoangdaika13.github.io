const test = require("node:test");
const assert = require("node:assert/strict");
const studio = require("../graphic-design-3d.js");

test("3D Studio creates a normalized editable scene", () => {
  const scene = studio.createDefaultScene();
  assert.equal(scene.version, 2);
  assert.ok(scene.objects.length >= 2);
  assert.ok(scene.lights.some((light) => light.type === "directional"));
  assert.equal(scene.renderer.toneMapping, "aces");
  const normalized = studio.normalizeScene({ objects: Array.from({ length: 300 }, () => ({ type: "cube" })) });
  assert.ok(normalized.objects.length <= studio.constants.MAX_OBJECTS);
});

test("3D transforms, camera paths and snapping are deterministic", () => {
  const scene = studio.createDefaultScene();
  const object = scene.objects.find((item) => item.type === "torus");
  scene.timeline.keyframes = [
    { id: "a", objectId: object.id, time: 0, transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } } },
    { id: "b", objectId: object.id, time: 2, transform: { position: { x: 10, y: 4, z: 0 }, rotation: { x: 0, y: 90, z: 0 }, scale: { x: 2, y: 2, z: 2 } } }
  ];
  const value = studio.transformAt(object, scene, 1);
  assert.equal(value.position.x, 5);
  assert.equal(value.rotation.y, 45);
  assert.equal(studio.snapValue(1.26, true, 0.5), 1.5);
});

test("3D Studio exports embedded primitive geometry as glTF 2.0", () => {
  const scene = studio.createDefaultScene();
  const gltf = studio.buildGltf(scene);
  assert.equal(gltf.asset.version, "2.0");
  assert.ok(gltf.meshes.length >= 2);
  assert.match(gltf.buffers[0].uri, /^data:application\/octet-stream;base64,/);
  assert.ok(studio.primitiveGeometry("sphere").positions.length > 30);
});

test("3D capability report is truthful", () => {
  const capabilities = studio.detectCapabilities({ navigator: {} });
  assert.equal(capabilities.webgpu, false);
  assert.equal(typeof capabilities.webgl2, "boolean");
  assert.match(studio.constants.THREE_MODULE_PATH, /vendor\/three\.module\.min\.js/);
});
