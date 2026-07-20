const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "graphic-design-3d.js"), "utf8");
const studio = require(path.join(root, "graphic-design-3d.js"));

test("Graphic Design 3D exposes an independent idempotent mount contract", () => {
  assert.match(source, /window\.HHGraphic3D\.mount|global\.HHGraphic3D/);
  assert.match(source, /function mount\(root\)/);
  assert.match(source, /root\.__hhGraphic3DController/);
  assert.match(source, /querySelectorAll\("\[data-graphic-3d\]"\)/);
  assert.equal(typeof studio.mount, "function");
});

test("Scene graph supports cube, sphere, plane and truthful model placeholder", () => {
  const scene = studio.createDefaultScene();
  assert.deepEqual(Object.keys(studio.constants.TYPE_LABELS), ["cube", "sphere", "plane", "model"]);
  for (const type of Object.keys(studio.constants.TYPE_LABELS)) {
    const object = studio.makeObject(type);
    assert.equal(object.type, type);
    assert.ok(object.transform.position);
    assert.ok(object.material.color);
    if (type === "model") assert.equal(object.asset.status, "required");
  }
  assert.ok(scene.objects.length >= 2);
  assert.equal(scene.timeline.playing, false);
});

test("Scene normalization limits data and preserves camera, transforms, materials and keyframes", () => {
  const raw = {
    name: "  Studio  ",
    camera: { yaw: 999, pitch: -1, zoom: 99, distance: 0 },
    grid: { visible: false, snap: true, size: 99 },
    objects: [{ id: "cube-1", type: "cube", name: "Hero", transform: { position: { x: 2 } }, material: { color: "#123456" } }],
    timeline: { currentTime: 9, duration: 2, keyframes: [{ objectId: "cube-1", time: 1, transform: { position: { x: 4 } } }] }
  };
  const scene = studio.normalizeScene(raw);
  assert.equal(scene.name, "Studio");
  assert.equal(scene.camera.yaw, 180);
  assert.equal(scene.camera.pitch, 10);
  assert.equal(scene.camera.zoom, 2.5);
  assert.equal(scene.camera.distance, 2);
  assert.equal(scene.grid.visible, false);
  assert.equal(scene.grid.size, 5);
  assert.equal(scene.objects[0].material.color, "#123456");
  assert.equal(scene.timeline.duration, 2);
  assert.equal(scene.timeline.keyframes[0].transform.position.x, 4);
});

test("Grid snap and projected coordinates are deterministic", () => {
  assert.equal(studio.snapValue(1.24, true, 0.5), 1);
  assert.equal(studio.snapValue(1.26, true, 0.5), 1.5);
  assert.equal(studio.snapValue(1.26, false, 0.5), 1.26);
  const point = studio.projectPoint({ x: 0, y: 0, z: 0 }, { yaw: 45, pitch: 30, zoom: 1 }, 800, 400);
  assert.deepEqual(point, { x: 400, y: 200 });
});

test("Timeline interpolates transform between keyframes", () => {
  const scene = studio.createDefaultScene();
  const object = scene.objects[1];
  scene.timeline.keyframes = [
    { objectId: object.id, time: 0, transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } } },
    { objectId: object.id, time: 2, transform: { position: { x: 4, y: 2, z: -2 }, rotation: { x: 0, y: 90, z: 0 }, scale: { x: 2, y: 2, z: 2 } } }
  ];
  const half = studio.transformAt(object, scene, 1);
  assert.equal(half.position.x, 2);
  assert.equal(half.position.y, 1);
  assert.equal(half.position.z, -1);
  assert.equal(half.rotation.y, 45);
  assert.equal(half.scale.x, 1.5);
});

test("Studio contains real local actions and explicit non-fake asset boundaries", () => {
  for (const token of ["data-g3d-action=\"save\"", "data-g3d-action=\"load-json\"", "data-g3d-scene-file", "FileReader", "data-g3d-action=\"export\"", "data-g3d-add=\"model\"", "data-g3d-action=\"keyframe\"", "data-g3d-light", "localStorage.setItem", "new Blob", "Canvas 2D / isometric preview", "needs import", "engine GLTF/OBJ"]) {
    assert.ok(source.includes(token), `missing token: ${token}`);
  }
  assert.doesNotMatch(source, /three\.js|babylon|pretend|fake render/i);
});

test("Studio is accessible, responsive and motion-safe without dependencies", () => {
  assert.match(source, /role=\"application\"/);
  assert.match(source, /aria-label=\"Scene graph\"/);
  assert.match(source, /@media \(max-width:700px\)/);
  assert.match(source, /prefers-reduced-motion:reduce/);
  assert.match(source, /const runtime = typeof globalThis/);
  assert.doesNotMatch(source, /\bglobal\.(devicePixelRatio|requestAnimationFrame|cancelAnimationFrame)/);
  assert.doesNotMatch(source, /from\s+["'](three|babylon|fabric|pixi)/i);
});
