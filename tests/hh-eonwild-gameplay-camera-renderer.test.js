const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const renderer = require("../hh-eonwild-renderer-3d.js");
const source = fs.readFileSync(path.join(__dirname, "..", "hh-eonwild-renderer-3d.js"), "utf8");

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  normalize() {
    const length = Math.hypot(this.x, this.y, this.z) || 1;
    this.x /= length;
    this.y /= length;
    this.z /= length;
    return this;
  }
}

class Ray {
  constructor(origin, direction, length) {
    this.origin = origin;
    this.direction = direction;
    this.length = length;
  }
}

test("gameplay camera profiles and ArcRotate mapping are bounded and deterministic", () => {
  assert.deepEqual(renderer.GAMEPLAY_CAMERA_PROFILE_IDS, ["ground", "heavy", "small", "bird", "aquatic", "climbing", "burrow"]);
  assert.ok(Object.isFrozen(renderer.GAMEPLAY_CAMERA_PROFILES));
  for (const id of renderer.GAMEPLAY_CAMERA_PROFILE_IDS) {
    const profile = renderer.GAMEPLAY_CAMERA_PROFILES[id];
    assert.ok(Object.isFrozen(profile));
    assert.ok(profile.minDistance < profile.distance && profile.distance < profile.maxDistance);
    assert.ok(profile.minPitch < profile.maxPitch);
  }

  const state = renderer.normalizeGameplayCamera({
    yaw: 0,
    pitch: 0,
    distance: 7,
    fov: 70,
    profileId: "ground",
    firstPerson: false,
    cameraShake: 0.25,
    smoothing: 9
  });
  const arc = renderer.gameplayCameraToArc(state);
  assert.ok(Math.abs(arc.alpha + Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(arc.beta - Math.PI / 2) < 1e-12);
  assert.equal(arc.radius, 7);
  assert.ok(Math.abs(arc.fovRadians - 70 * Math.PI / 180) < 1e-12);

  const clamped = renderer.normalizeGameplayCamera({ profileId: "small", pitch: 99, distance: 999, fov: 999, cameraShake: 9, smoothing: -1 });
  assert.equal(clamped.pitch, renderer.GAMEPLAY_CAMERA_PROFILES.small.maxPitch);
  assert.equal(clamped.distance, renderer.GAMEPLAY_CAMERA_PROFILES.small.maxDistance);
  assert.equal(clamped.fov, 120);
  assert.equal(clamped.cameraShake, 1);
  assert.equal(clamped.smoothing, 0);

  const configured = renderer.createRenderer({ speciesId: "tyrannosaurus", gameplayCamera: { profile: "bird" } });
  const configuredState = configured.getGameplayCamera();
  assert.equal(configuredState.active, true);
  assert.equal(configuredState.profileId, "bird");
  assert.equal(configuredState.distance, renderer.GAMEPLAY_CAMERA_PROFILES.bird.distance);
  assert.equal(configuredState.fov, renderer.GAMEPLAY_CAMERA_PROFILES.bird.fov);
  configured.dispose();
});

test("public gameplay camera takes sole input ownership and follows stable baseY", () => {
  const adapter = renderer.createRenderer({ speciesId: "tyrannosaurus" });
  let detachCalls = 0;
  const camera = {
    alpha: 0,
    beta: 0,
    radius: 20,
    fov: 0,
    target: new Vector3(0, 0, 0),
    detachControl() { detachCalls += 1; },
    setTarget(value) { this.target = value; }
  };
  adapter._Babylon = { Vector3 };
  adapter._camera = camera;
  adapter._proxies.set("tyrannosaurus", {
    id: "tyrannosaurus",
    baseY: 12,
    root: { position: new Vector3(4, 999, 6) },
    parts: [],
    materials: []
  });

  const result = adapter.setGameplayCamera({ yaw: 0, pitch: 0, distance: 7, fov: 70, profileId: "ground", smoothing: 0, cameraShake: 0 });
  assert.equal(result.ok, true);
  assert.equal(detachCalls, 1);
  assert.ok(Math.abs(camera.alpha + Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(camera.beta - Math.PI / 2) < 1e-12);
  assert.equal(camera.radius, 7);
  assert.ok(Math.abs(camera.fov - 70 * Math.PI / 180) < 1e-12);
  assert.equal(camera.target.x, 4);
  assert.equal(camera.target.y, 12 + renderer.GAMEPLAY_CAMERA_PROFILES.ground.targetHeight, "camera target must use stable baseY, never animated proxy Y");
  assert.equal(camera.target.z, 6);

  const snapshot = adapter.getGameplayCamera();
  assert.equal(snapshot.active, true);
  assert.equal(snapshot.inputOwner, "route");
  assert.equal(snapshot.profileId, "ground");
  assert.equal(snapshot.effectiveDistance, 7);
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.collision));

  adapter._camera = null;
  adapter._Babylon = null;
  adapter._proxies.clear();
  adapter.dispose();
});

test("terrain ray collision reports capability truthfully and resolves padding", () => {
  const adapter = renderer.createRenderer();
  let observedRay = null;
  adapter._Babylon = { Vector3, Ray };
  adapter._camera = { target: new Vector3(0, 3, 0) };
  adapter._scene = {
    pickWithRay(ray, predicate, fastCheck) {
      observedRay = ray;
      assert.equal(fastCheck, false, "camera collision must select the nearest obstruction");
      assert.equal(predicate({ metadata: { cameraObstruction: true, kind: "terrain-chunk" } }), true);
      assert.equal(predicate({ metadata: { cameraObstruction: false, kind: "species-proxy-part" } }), false);
      return { hit: true, distance: 4, pickedMesh: { metadata: { kind: "terrain-chunk" } } };
    }
  };
  adapter.setGameplayCamera({ profileId: "ground", yaw: 0, pitch: 0, distance: 10, smoothing: 0 });
  const query = adapter.queryCameraObstructionDistance({ desiredDistance: 10 });
  assert.equal(query.supported, true);
  assert.equal(query.mode, "terrain-ray");
  assert.equal(query.terrainOnly, true);
  assert.equal(query.hit, true);
  assert.equal(query.distance, 4);
  assert.equal(observedRay.length, 10);
  assert.ok(Math.abs(observedRay.direction.z + 1) < 1e-12);

  const resolved = adapter.resolveGameplayCameraCollision({ desiredDistance: 10, hitDistance: 4, padding: 0.5, commit: false });
  assert.equal(resolved.supported, true);
  assert.equal(resolved.mode, "provided");
  assert.equal(resolved.resolvedDistance, 3.5);

  adapter._scene = null;
  adapter._camera = null;
  adapter._Babylon = null;
  adapter.dispose();
});

test("animal highlight covers procedural and imported meshes and restores prior state", () => {
  const adapter = renderer.createRenderer();
  const originalColor = { r: 0.1, g: 0.2, b: 0.3 };
  const procedural = { renderOverlay: false, overlayColor: originalColor, overlayAlpha: 0.1 };
  const imported = { renderOverlay: true, overlayColor: originalColor, overlayAlpha: 0.15 };
  adapter._Babylon = { Color3: { FromHexString: () => ({ r: 0.475, g: 0.949, b: 0.753 }) } };
  adapter._proxies.set("triceratops", {
    parts: [procedural],
    root: { getChildMeshes: () => [procedural, imported] },
    materials: []
  });

  const highlighted = adapter.setHighlightedTarget({ id: "animal-7", speciesId: "triceratops", alpha: 0.3 });
  assert.equal(highlighted.ok, true);
  assert.equal(highlighted.meshCount, 2);
  assert.equal(procedural.renderOverlay, true);
  assert.equal(imported.renderOverlay, true);
  assert.equal(procedural.overlayAlpha, 0.3);
  assert.equal(imported.overlayAlpha, 0.3);

  const cleared = adapter.clearHighlightedTarget();
  assert.equal(cleared.ok, true);
  assert.equal(cleared.cleared, true);
  assert.equal(procedural.renderOverlay, false);
  assert.equal(procedural.overlayColor, originalColor);
  assert.equal(procedural.overlayAlpha, 0.1);
  assert.equal(imported.renderOverlay, true);
  assert.equal(imported.overlayColor, originalColor);
  assert.equal(imported.overlayAlpha, 0.15);

  adapter._Babylon = null;
  adapter._proxies.clear();
  adapter.dispose();
});

test("center ray targeting returns only the first visible allow-listed animal", () => {
  const adapter = renderer.createRenderer({ speciesId: "tyrannosaurus" });
  const ray = { length: 60 };
  adapter._camera = { getForwardRay: (length) => ({ ...ray, length }) };
  adapter._scene = {
    pickWithRay(observed, predicate, fastCheck) {
      assert.equal(observed.length, 60);
      assert.equal(fastCheck, false);
      assert.equal(predicate({ metadata: { targetable: true, targetType: "animal", speciesId: "triceratops" } }), true);
      assert.equal(predicate({ metadata: { targetable: true, targetType: "animal", speciesId: "tyrannosaurus" } }), false, "player mesh must be ignored");
      assert.equal(predicate({ metadata: { cameraObstruction: true, kind: "terrain-chunk" } }), true, "terrain must participate in the same LOS ray");
      return { hit: true, distance: 8.4, pickedMesh: { id: "mesh-7", metadata: { targetable: true, targetType: "animal", speciesId: "triceratops", kind: "species-proxy-part" } } };
    }
  };
  const picked = adapter.pickCenter({ maxDistance: 60, allowedTypes: ["animal"], excludePlayer: true });
  assert.equal(picked.id, "triceratops");
  assert.equal(picked.distance, 8.4);
  assert.equal(picked.lineOfSight, true);
  adapter._scene = null;
  adapter._camera = null;
  adapter.dispose();
});

test("renderer source keeps route-owned input, terrain-only collision and cleanup explicit", () => {
  for (const method of [
    "setGameplayCamera", "getGameplayCamera", "queryCameraObstructionDistance",
    "resolveGameplayCameraCollision", "pickCenter", "setHighlightedTarget", "clearHighlightedTarget"
  ]) assert.equal(typeof renderer.EonWild3DAdapter.prototype[method], "function", `${method} must be public`);

  assert.match(source, /options\.controls\s*===\s*true/);
  assert.doesNotMatch(source, /options\.controls\s*!==\s*false[\s\S]*?camera\.attachControl/);
  assert.match(source, /stableBaseY\s*=\s*finite\(proxy\.baseY/);
  assert.match(source, /pickWithRay\(ray[\s\S]*?cameraObstruction/);
  assert.match(source, /terrainOnly:\s*true/);
  assert.match(source, /_clearHighlightedTargetInternal\(\)[\s\S]*?_teardownGraphics\(\)/);
});
