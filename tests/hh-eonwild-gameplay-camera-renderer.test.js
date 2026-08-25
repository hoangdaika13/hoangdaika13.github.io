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

test("authoritative center direction includes pitch and sphere intersections stay bounded", () => {
  const level = renderer.gameplayLookDirection(0, 0);
  assert.deepEqual(level, { x: 0, y: 0, z: 1 });
  const pitched = renderer.gameplayLookDirection(Math.PI / 2, 0.5);
  assert.ok(Math.abs(pitched.x - Math.cos(0.5)) < 1e-12);
  assert.ok(Math.abs(pitched.y - Math.sin(0.5)) < 1e-12);
  assert.ok(Math.abs(pitched.z) < 1e-12);
  assert.equal(renderer.raySphereIntersectionDistance({ x: 0, y: 0, z: 0 }, level, { x: 0, y: 0, z: 5 }, 1, 10), 4);
  assert.equal(renderer.raySphereIntersectionDistance({ x: 0, y: 0, z: 0 }, level, { x: 5, y: 0, z: 5 }, 1, 10), null);
});

test("public gameplay camera takes sole input ownership and follows stable baseY", () => {
  const adapter = renderer.createRenderer({ speciesId: "tyrannosaurus" });
  let detachCalls = 0;
  let collisionQueries = 0;
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
  adapter.resolveGameplayCameraCollision = (options = {}) => {
    collisionQueries += 1;
    return { supported: true, hit: false, desiredDistance: options.desiredDistance, resolvedDistance: options.desiredDistance };
  };
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
  assert.equal(collisionQueries, 1, "activation performs one immediate collision placement");

  const snapshot = adapter.getGameplayCamera();
  assert.equal(snapshot.active, true);
  assert.equal(snapshot.inputOwner, "route");
  assert.equal(snapshot.profileId, "ground");
  assert.equal(snapshot.effectiveDistance, 7);
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.collision));

  adapter.setGameplayCamera({ yaw: 0.4, pitch: 0.1, distance: 8, fov: 72, profileId: "ground", smoothing: 0, cameraShake: 0 });
  assert.equal(collisionQueries, 1, "steady-state input must wait for the render loop instead of repeating the ray bundle");
  adapter._followPlayer(1 / 60);
  assert.equal(collisionQueries, 2, "one rendered camera frame performs one collision query");

  adapter._camera = null;
  adapter._Babylon = null;
  adapter._proxies.clear();
  adapter.dispose();
});

test("terrain ray collision reports capability truthfully and resolves padding", () => {
  const adapter = renderer.createRenderer();
  const observedRays = [];
  adapter._Babylon = { Vector3, Ray };
  adapter._camera = { target: new Vector3(0, 3, 0) };
  adapter._scene = {
    pickWithRay(ray, predicate, fastCheck) {
      observedRays.push(ray);
      assert.equal(fastCheck, false, "camera collision must select the nearest obstruction");
      assert.equal(predicate({ metadata: { cameraObstruction: true, kind: "terrain-chunk" } }), true);
      assert.equal(predicate({ metadata: { cameraObstruction: true, cameraObstructionKind: "tree" } }), true);
      assert.equal(predicate({ metadata: { cameraObstruction: false, kind: "species-proxy-part" } }), false);
      return { hit: true, distance: 4, pickedMesh: { metadata: { kind: "terrain-chunk" } } };
    }
  };
  adapter.setGameplayCamera({ profileId: "ground", yaw: 0, pitch: 0, distance: 10, smoothing: 0 });
  const query = adapter.queryCameraObstructionDistance({ desiredDistance: 10 });
  assert.equal(query.supported, true);
  assert.equal(query.mode, "terrain-multi-ray");
  assert.equal(query.terrainOnly, true);
  assert.equal(query.approximate, true, "five rays approximate a camera volume even with terrain-only coverage");
  assert.equal(query.rayCount, 5);
  assert.deepEqual(query.blockerCoverage, ["terrain-mesh"]);
  assert.equal(query.hit, true);
  assert.equal(query.distance, 4);
  assert.equal(observedRays.length, 5);
  assert.equal(observedRays[0].length, 10);
  assert.ok(Math.abs(observedRays[0].direction.z + 1) < 1e-12);

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
  const proxy = {
    id: "triceratops",
    entityId: "",
    identityExact: false,
    isPlayer: false,
    parts: [procedural],
    root: { metadata: {}, position: { x: 0, y: 0, z: 0 }, rotation: { y: 0 }, getChildMeshes: () => [procedural, imported], setEnabled() {} },
    materials: []
  };
  adapter._proxies.set("triceratops", proxy);
  const updated = adapter.updateFlagship("triceratops", { entityId: "animal-7", x: renderer.WORLD_SIZE / 2, z: renderer.WORLD_SIZE / 2, visible: true });
  assert.equal(updated.ok, true);
  assert.equal(updated.entityId, "animal-7");
  assert.equal(updated.identityExact, true);
  assert.equal(procedural.metadata.targetId, "animal-7");

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

  adapter.setHighlightedTarget({ id: "animal-7", speciesId: "triceratops" });
  adapter._syncProxyIdentity(proxy, "animal-8", false, true);
  assert.equal(adapter._highlightedTarget, null, "identity replacement must clear a stale highlight");
  assert.equal(procedural.renderOverlay, false);

  adapter._Babylon = null;
  adapter._proxies.clear();
  adapter.dispose();
});

test("resource targets keep exact identity through pick, highlight, LOS and teardown", () => {
  const adapter = renderer.createRenderer();
  const createdMeshes = [];
  class Color3 {
    constructor(r = 0, g = 0, b = 0) { this.r = r; this.g = g; this.b = b; }
    static FromHexString() { return new Color3(0.475, 0.949, 0.753); }
  }
  class StandardMaterial {
    constructor(name) { this.name = name; this.disposed = false; }
    dispose() { this.disposed = true; }
  }
  const makeMesh = (name) => {
    const mesh = {
      name,
      position: new Vector3(),
      metadata: {},
      isVisible: true,
      enabled: true,
      disposed: false,
      renderOverlay: false,
      overlayColor: null,
      overlayAlpha: 0,
      setEnabled(value) { this.enabled = value; },
      dispose() { this.disposed = true; }
    };
    createdMeshes.push(mesh);
    return mesh;
  };
  adapter._Babylon = {
    Vector3,
    Ray,
    Color3,
    StandardMaterial,
    MeshBuilder: {
      CreateCylinder: (name) => makeMesh(name),
      CreateSphere: (name) => makeMesh(name)
    }
  };
  let pickedMesh = null;
  adapter._camera = { position: new Vector3(0, 2, 0) };
  adapter._scene = {
    pickWithRay(ray, predicate, fastCheck) {
      assert.equal(fastCheck, false);
      if (!pickedMesh || !predicate(pickedMesh)) return { hit: false, distance: null, pickedMesh: null };
      return { hit: true, distance: 8, pickedMesh };
    }
  };

  const resourceId = "water-source-7";
  const synced = adapter.syncResources([{
    id: resourceId,
    type: "water",
    amount: 3,
    x: renderer.WORLD_SIZE / 2,
    z: renderer.WORLD_SIZE / 2 + 8
  }]);
  assert.equal(synced.ok, true);
  assert.equal(synced.visible, 1);
  const marker = adapter._resourceMarkers.get(resourceId);
  assert.ok(marker?.mesh);
  assert.equal(marker.mesh.metadata.targetId, resourceId);
  assert.equal(marker.mesh.metadata.entityId, resourceId);
  assert.equal(marker.mesh.metadata.identityExact, true);
  assert.equal(marker.mesh.metadata.targetType, "water");

  const capabilities = adapter.getGameplayCapabilities();
  assert.equal(capabilities.resourceMarkers.supported, true);
  assert.equal(capabilities.resourceMarkers.active, 1);
  assert.equal(capabilities.resourceMarkers.exactIdentities, 1);
  assert.equal(capabilities.resourceMarkers.identityCoverageComplete, true);
  assert.equal(capabilities.targeting.resourceMarkers, true);
  assert.ok(capabilities.targeting.supportedTypes.includes("water"));

  pickedMesh = marker.mesh;
  const exactPick = adapter.pickCenter({ maxDistance: 20, allowedTypes: ["water"], yaw: 0, pitch: 0 });
  assert.equal(exactPick.id, resourceId);
  assert.equal(exactPick.type, "water");
  assert.equal(exactPick.identityExact, true);

  pickedMesh = { metadata: { ...marker.mesh.metadata, targetId: "", entityId: "", identityExact: false } };
  assert.equal(adapter.pickCenter({ maxDistance: 20, allowedTypes: ["water"], yaw: 0, pitch: 0 }), null, "anonymous resources must fail closed");
  pickedMesh = { metadata: { ...marker.mesh.metadata, targetType: "food" } };
  assert.equal(adapter.pickCenter({ maxDistance: 20, allowedTypes: ["water"], yaw: 0, pitch: 0 }), null, "the allow-list must reject a wrong resource type");
  pickedMesh = { metadata: { ...marker.mesh.metadata, targetId: "water-source-other", entityId: "water-source-other" } };
  assert.equal(adapter.pickCenter({ maxDistance: 20, allowedTypes: ["water"], yaw: 0, pitch: 0 }), null, "an unregistered resource ID must fail closed");
  pickedMesh = { metadata: { ...marker.mesh.metadata, entityId: "water-source-other" } };
  assert.equal(adapter.pickCenter({ maxDistance: 20, allowedTypes: ["water"], yaw: 0, pitch: 0 }), null, "conflicting target and entity IDs must fail closed");

  const highlighted = adapter.setHighlightedTarget({ id: resourceId, type: "water", alpha: 0.3 });
  assert.equal(highlighted.ok, true);
  assert.equal(highlighted.target.entityId, resourceId);
  assert.equal(highlighted.target.type, "water");
  assert.equal(marker.mesh.renderOverlay, true);
  assert.equal(adapter.setHighlightedTarget({ id: resourceId, type: "food" }).ok, false);
  assert.equal(adapter.setHighlightedTarget({ id: "water-source-other", type: "water" }).ok, false);

  pickedMesh = marker.mesh;
  const visible = adapter.queryTargetLineOfSight({ entityId: resourceId, type: "water" });
  assert.equal(visible.supported, true);
  assert.equal(visible.visible, true);
  assert.equal(visible.entityId, resourceId);
  assert.equal(visible.type, "water");
  assert.equal(adapter.queryTargetLineOfSight({ entityId: resourceId, type: "animal" }).reason, "exact-rendered-proxy-unavailable");
  assert.equal(adapter.queryTargetLineOfSight({ entityId: resourceId, type: "food" }).reason, "exact-rendered-target-unavailable");
  assert.equal(adapter.queryTargetLineOfSight({ entityId: "water-source-other", type: "water" }).reason, "exact-rendered-target-unavailable");

  const sharedMaterial = marker.mesh.material;
  const staleMesh = marker.mesh;
  adapter.syncResources([]);
  assert.equal(adapter._resourceMarkers.size, 0);
  assert.equal(adapter._highlightedTarget, null, "removing a resource must clear its stale highlight");
  assert.equal(staleMesh.disposed, true);
  assert.equal(staleMesh.metadata.targetable, false);
  assert.equal(staleMesh.metadata.targetId, "");
  assert.equal(staleMesh.metadata.identityExact, false);
  assert.equal(sharedMaterial.disposed, false, "shared material remains alive until renderer teardown");

  adapter.syncResources([{
    id: "water-source-8",
    type: "water",
    amount: 1,
    x: renderer.WORLD_SIZE / 2,
    z: renderer.WORLD_SIZE / 2 + 6
  }]);
  const teardownMesh = adapter._resourceMarkers.get("water-source-8").mesh;
  adapter.dispose();
  assert.equal(teardownMesh.disposed, true);
  assert.equal(sharedMaterial.disposed, true);
  assert.equal(adapter._resourceMarkers.size, 0);
  assert.equal(adapter._resourceMaterials.size, 0);
  assert.ok(createdMeshes.every((mesh) => mesh.disposed), "all resource marker meshes must be released");
});

test("center ray targeting returns only the first visible allow-listed animal", () => {
  const adapter = renderer.createRenderer({ speciesId: "tyrannosaurus" });
  let observedRay = null;
  adapter._Babylon = { Vector3, Ray };
  adapter._camera = { position: new Vector3(0, 2, 0), getForwardRay: () => { throw new Error("explicit yaw/pitch ray must be authoritative"); } };
  adapter._scene = {
    pickWithRay(observed, predicate, fastCheck) {
      observedRay = observed;
      assert.equal(observed.length, 60);
      assert.equal(fastCheck, false);
      assert.equal(predicate({ metadata: { targetable: true, targetType: "animal", speciesId: "tyrannosaurus", targetId: "animal-7", identityExact: true, isPlayer: false } }), true, "same-species wildlife must remain targetable by exact identity");
      assert.equal(predicate({ metadata: { targetable: true, targetType: "animal", speciesId: "tyrannosaurus", targetId: "player", identityExact: true, isPlayer: true } }), false, "only the actual player entity is ignored");
      assert.equal(predicate({ metadata: { targetable: true, targetType: "animal", speciesId: "triceratops", targetId: "", identityExact: false, isPlayer: false } }), false, "anonymous proxies cannot claim an exact target ID");
      assert.equal(predicate({ metadata: { cameraObstruction: true, kind: "terrain-chunk" } }), true, "terrain must participate in the same LOS ray");
      assert.equal(predicate({ metadata: { cameraObstruction: true, cameraObstructionKind: "tree" } }), true, "tree blockers must participate in the same LOS ray");
      return { hit: true, distance: 8.4, pickedMesh: { id: "mesh-7", metadata: { targetable: true, targetType: "animal", targetId: "animal-7", entityId: "animal-7", identityExact: true, isPlayer: false, speciesId: "tyrannosaurus", kind: "species-proxy-part" } } };
    }
  };
  const picked = adapter.pickCenter({ maxDistance: 60, allowedTypes: ["animal"], excludePlayer: true, yaw: 0, pitch: 0.4 });
  assert.equal(picked.id, "animal-7");
  assert.equal(picked.entityId, "animal-7");
  assert.equal(picked.identityExact, true);
  assert.equal(picked.distance, 8.4);
  assert.equal(picked.lineOfSight, true);
  assert.ok(Math.abs(observedRay.direction.y - Math.sin(0.4)) < 1e-12, "center ray must include authoritative pitch");
  assert.ok(Math.abs(observedRay.direction.z - Math.cos(0.4)) < 1e-12);
  adapter._scene = null;
  adapter._camera = null;
  adapter._Babylon = null;
  adapter.dispose();
});

test("locked-target LOS requires an exact rendered identity and rejects nearer blockers", () => {
  const adapter = renderer.createRenderer();
  const targetMetadata = { targetable: true, targetType: "animal", targetId: "animal-locked", entityId: "animal-locked", identityExact: true, isPlayer: false, speciesId: "triceratops", kind: "species-proxy-part" };
  const proxy = {
    id: "triceratops",
    entityId: "animal-locked",
    identityExact: true,
    isPlayer: false,
    baseY: 0,
    root: { position: new Vector3(0, 0, 10) },
    parts: [],
    materials: []
  };
  adapter._Babylon = { Vector3, Ray };
  adapter._camera = { position: new Vector3(0, 2.1, 0) };
  adapter._proxyByEntityId.set(proxy.entityId, proxy);

  let nextPick = { hit: true, distance: 10, pickedMesh: { metadata: targetMetadata } };
  adapter._scene = {
    pickWithRay(ray, predicate, fastCheck) {
      assert.equal(fastCheck, false, "LOS must resolve the nearest matching target or blocker");
      assert.ok(Math.abs(ray.direction.z - 1) < 1e-12);
      assert.equal(predicate({ metadata: targetMetadata }), true, "the exact target identity participates in LOS");
      assert.equal(predicate({ metadata: { ...targetMetadata, targetId: "animal-other", entityId: "animal-other" } }), false, "another animal identity cannot satisfy the lock");
      assert.equal(predicate({ metadata: { ...targetMetadata, targetId: "", entityId: "", identityExact: false } }), false, "anonymous animal meshes cannot satisfy the lock");
      assert.equal(predicate({ metadata: { cameraObstruction: true, cameraObstructionKind: "terrain" } }), true, "terrain/environment blockers participate in LOS");
      return nextPick;
    }
  };

  const visible = adapter.queryTargetLineOfSight({ entityId: "animal-locked" });
  assert.equal(visible.supported, true);
  assert.equal(visible.visible, true);
  assert.equal(visible.entityId, "animal-locked");
  assert.equal(visible.identityExact, true);
  assert.equal(visible.reason, "visible");

  for (const blockerKind of ["terrain", "tree"]) {
    nextPick = { hit: true, distance: 4, pickedMesh: { metadata: { cameraObstruction: true, cameraObstructionKind: blockerKind } } };
    const blocked = adapter.queryTargetLineOfSight("animal-locked");
    assert.equal(blocked.supported, true);
    assert.equal(blocked.visible, false);
    assert.equal(blocked.reason, "occluded");
    assert.equal(blocked.blockerDistance, 4);
    assert.equal(blocked.blockerKind, blockerKind);
  }

  assert.deepEqual(adapter.queryTargetLineOfSight({}), {
    supported: false,
    visible: false,
    entityId: "",
    reason: "entity-id-required",
    approximate: false,
    blockerCoverage: ["terrain-mesh"],
    distance: null,
    blockerKind: null
  });
  assert.equal(adapter.queryTargetLineOfSight("animal-other").supported, false, "an unrendered identity must fail closed");
  assert.equal(adapter.queryTargetLineOfSight("animal-other").visible, false);
  assert.equal(adapter.queryTargetLineOfSight("animal-other").reason, "exact-rendered-proxy-unavailable");

  adapter._scene = null;
  adapter._camera = null;
  adapter._Babylon = null;
  adapter._proxyByEntityId.clear();
  adapter.dispose();
});

test("rendered tree descriptors conservatively block center LOS and camera sphere rays", () => {
  const adapter = renderer.createRenderer();
  adapter._Babylon = { Vector3, Ray };
  adapter._camera = { position: new Vector3(0, 2, 0), target: new Vector3(0, 3, 0) };
  const matrices = new Float32Array(16);
  matrices[0] = 1; matrices[5] = 1; matrices[10] = 1; matrices[15] = 1;
  matrices[12] = 0; matrices[13] = 0; matrices[14] = 4;
  adapter._environmentRenderer = { mode: "babylon-thin-instances", _buckets: [{ definition: { category: "mature-tree" }, count: 1, matrices }] };
  adapter._scene = {
    pickWithRay(ray) {
      return { hit: true, distance: 8, pickedMesh: { metadata: { targetable: true, targetType: "animal", targetId: "animal-behind-tree", entityId: "animal-behind-tree", identityExact: true, isPlayer: false, speciesId: "triceratops", kind: "species-proxy-part" } } };
    }
  };
  assert.equal(adapter.pickCenter({ maxDistance: 20, yaw: 0, pitch: 0, allowedTypes: ["animal"] }), null, "analytic tree sphere must occlude a farther target");

  matrices[14] = -4;
  adapter._scene.pickWithRay = () => ({ hit: false, distance: 0, pickedMesh: null });
  const collision = adapter.queryCameraObstructionDistance({ origin: new Vector3(0, 3, 0), desiredDistance: 10, yaw: 0, pitch: 0 });
  assert.equal(collision.supported, true);
  assert.equal(collision.terrainOnly, false);
  assert.equal(collision.mode, "terrain-environment-multi-ray");
  assert.ok(collision.blockerCoverage.includes("rock-tree-sphere-approximation"));
  assert.equal(collision.hit, true);
  assert.match(collision.meshKind, /tree/);
  const capabilities = adapter.getGameplayCapabilities();
  assert.equal(capabilities.cameraCollision.environmentApproximation, true);
  assert.equal(capabilities.targeting.environmentApproximate, true);
  adapter._scene = null;
  adapter._camera = null;
  adapter._Babylon = null;
  adapter._environmentRenderer = null;
  adapter.dispose();
});

test("exact pickable environment meshes bypass the expensive analytic instance scan", () => {
  const adapter = renderer.createRenderer();
  adapter._Babylon = { Vector3, Ray };
  adapter._camera = { position: new Vector3(0, 2, 0), target: new Vector3(0, 3, 0) };
  adapter._environmentBlockerMeshes.add({ disposed: false });
  let analyticScans = 0;
  adapter._queryEnvironmentBlockerDistance = () => {
    analyticScans += 1;
    return { hit: false, distance: null, kind: null, tested: 0, approximate: false };
  };
  adapter._scene = {
    pickWithRay() {
      return { hit: true, distance: 8, pickedMesh: { metadata: { targetable: true, targetType: "animal", targetId: "animal-visible", entityId: "animal-visible", identityExact: true, isPlayer: false, speciesId: "triceratops", kind: "species-proxy-part" } } };
    }
  };

  const picked = adapter.pickCenter({ maxDistance: 20, yaw: 0, pitch: 0, allowedTypes: ["animal"] });
  assert.equal(picked.id, "animal-visible");
  adapter.queryCameraObstructionDistance({ origin: new Vector3(0, 3, 0), desiredDistance: 10, yaw: 0, pitch: 0 });
  assert.equal(analyticScans, 0, "Babylon thin-instance/mesh picking is authoritative when blocker meshes are registered");
  adapter._scene = null;
  adapter._camera = null;
  adapter._Babylon = null;
  adapter.dispose();
});

test("creature clips cross-fade before retiring the previous group and far LOD stops skeleton work", () => {
  const events = [];
  const group = (name) => ({
    name,
    targetedAnimations: [{ animation: {} }],
    weights: [],
    start() { events.push(`${name}:start`); },
    stop() { events.push(`${name}:stop`); },
    setWeightForAllAnimatables(value) { this.weights.push(value); events.push(`${name}:weight:${value.toFixed(2)}`); }
  });
  const idle = group("idle");
  const walk = group("walk");
  const adapter = { _reducedMotion: false, _camera: { position: { x: 0, z: 0 } }, _emitStatus() {}, _proxies: new Map() };
  const manager = new renderer.CreaturePrototypeManager(adapter, {}, {}, { animationCrossFadeMs: 180 });
  const entry = {
    definition: { trustedObjectUrl: false },
    activeClip: "",
    animationLodActive: true,
    lod: 0,
    groups: [idle, walk],
    clipMap: new Map([["idle", idle], ["walk", walk]]),
    wrapper: { setEnabled() {} }
  };

  manager._applyClip(entry, "idle");
  events.length = 0;
  manager._applyClip(entry, "walk");
  assert.equal(events[0], "walk:start", "new clip must start before the old clip is retired");
  assert.equal(events.includes("idle:stop"), false, "old clip remains alive during the bounded cross-fade");
  const transition = manager.clipTransitions.get(entry);
  assert.ok(transition);
  assert.equal(walk.targetedAnimations[0].animation.enableBlending, true);
  assert.ok(walk.targetedAnimations[0].animation.blendingSpeed > 0);
  manager._advanceClipTransitions(transition.startedAt + transition.durationMs);
  assert.equal(events.includes("idle:stop"), true);
  assert.equal(manager.clipTransitions.has(entry), false);

  events.length = 0;
  manager.lodEntries.set("triceratops", new Map([[0, entry]]));
  manager.activeLods.set("triceratops", 0);
  manager._selectLod("triceratops", renderer.WORLD_SIZE / 2 + 1000, renderer.WORLD_SIZE / 2 + 1000, "run");
  assert.equal(entry.animationLodActive, false);
  assert.equal(entry.activeClip, "");
  assert.ok(events.includes("walk:stop"), "far LOD must stop the active skeleton clip");
  const status = manager.getStatus();
  assert.deepEqual(status.footIk, { supported: false, active: false, reason: "asset-contract-unavailable" });
  manager.dispose();
});

test("renderer source keeps route-owned input, truthful blocker coverage and cleanup explicit", () => {
  for (const method of [
    "setGameplayCamera", "getGameplayCamera", "queryCameraObstructionDistance",
    "resolveGameplayCameraCollision", "getGameplayCapabilities", "pickCenter", "queryTargetLineOfSight", "setHighlightedTarget", "clearHighlightedTarget",
    "syncResources", "planProceduralLakes", "queryLandscapeWater", "queryWorldWater"
  ]) assert.equal(typeof renderer.EonWild3DAdapter.prototype[method], "function", `${method} must be public`);

  assert.match(source, /options\.controls\s*===\s*true/);
  assert.doesNotMatch(source, /options\.controls\s*!==\s*false[\s\S]*?camera\.attachControl/);
  assert.match(source, /stableBaseY\s*=\s*finite\(proxy\.baseY/);
  assert.match(source, /CAMERA_COLLISION_RAY_OFFSETS/);
  assert.match(source, /this\._gameplayCamera\.active\s*&&\s*!previous\.active\)\s*this\._followPlayer\(0, true\)/);
  assert.match(source, /pickWithRay\(ray[\s\S]*?cameraObstruction/);
  assert.match(source, /rock-tree-sphere-approximation/);
  assert.match(source, /identityExact/);
  const applyClipStart = source.indexOf("    _applyClip(entry, clip");
  const applyClipEnd = source.indexOf("\n    _selectLod(", applyClipStart);
  const applyClip = source.slice(applyClipStart, applyClipEnd);
  assert.doesNotMatch(applyClip, /for \(const group of entry\.groups\)[\s\S]*?group\.stop/);
  assert.match(applyClip, /group\.start\(true\)[\s\S]*?clipTransitions\.set/);
  assert.match(source, /_clearHighlightedTargetInternal\(\)[\s\S]*?_teardownGraphics\(\)/);
});
