"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "hh-eonwild-collision-system.js");
const source = fs.readFileSync(sourcePath, "utf8");
const collision = require(sourcePath);
const desktop = require(path.join(root, "hh-eonwild-desktop-controller.js"));
const renderer3d = require(path.join(root, "hh-eonwild-renderer-3d.js"));
const gameplayPath = path.join(root, "hh-eonwild-game.js");
const gameplaySource = fs.readFileSync(gameplayPath, "utf8");
const gameplay = require(gameplayPath);

const flatTerrain = () => 0;

const extractFunctionSource = (sourceText, name) => {
  const start = sourceText.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const openingBrace = sourceText.indexOf("{", start);
  let depth = 0;
  for (let index = openingBrace; index < sourceText.length; index += 1) {
    if (sourceText[index] === "{") depth += 1;
    else if (sourceText[index] === "}") {
      depth -= 1;
      if (depth === 0) return sourceText.slice(start, index + 1);
    }
  }
  throw new Error(`unterminated function ${name}`);
};

test("world boot creates the landscape before habitat spawn and collision physics", () => {
  const initWorld = extractFunctionSource(gameplaySource, "initWorld");
  const landscapeAt = initWorld.indexOf("initializeCollisionLandscape(instance)");
  const spawnAt = initWorld.indexOf("ensureValidPlayerSpawn(instance");
  const collisionAt = initWorld.indexOf("initializeWorldCollision(instance)");
  assert.ok(landscapeAt >= 0 && landscapeAt < spawnAt, "habitat selection must sample the active Landscape, not legacy terrain");
  assert.ok(spawnAt < collisionAt, "the collision world must be created after the final spawn coordinates are known");
  const initializeWorldCollision = extractFunctionSource(gameplaySource, "initializeWorldCollision");
  assert.match(initializeWorldCollision, /if \(!instance\.collisionLandscape\) initializeCollisionLandscape\(instance\)/);
});

test("spawn validation rejects river or ocean starts for terrestrial animals and requires real water for aquatic animals", () => {
  const state = { realmId: "modern", settings: { seed: "spawn-water-regression" }, worldAddress: { timeSliceId: "present", regionId: "test" } };
  const makeInstance = (sample) => ({
    state,
    collisionLakes: Object.freeze([]),
    collisionLandscape: {
      config: { seaLevel: 3.5 },
      sample() { return { slopeDegrees: 2, moisture: .7, biomeId: "wetland", ...sample }; }
    }
  });
  const terrestrial = { locomotion: "run", mass: 45 };
  const aquatic = { locomotion: "swim", mass: 90 };
  const shallowRiver = makeInstance({ height: 9, river: { distance: .2, width: 2, bedHeight: 8.9 } });
  const dryGround = makeInstance({ height: 9, river: null });
  const ocean = makeInstance({ height: 1, river: null });

  assert.equal(gameplay.collisionHabitatAccepts(shallowRiver, terrestrial, 1000, 1000), false);
  assert.equal(gameplay.collisionHabitatAccepts(dryGround, terrestrial, 1000, 1000), true);
  assert.equal(gameplay.collisionHabitatAccepts(shallowRiver, aquatic, 1000, 1000), false, "a shallow stream is not a safe aquatic spawn");
  assert.equal(gameplay.collisionHabitatAccepts(ocean, aquatic, 1000, 1000), true);
});

test("environment collision digest changes when async asset placements appear in the same cell", () => {
  const initial = [];
  const loaded = [
    { id: "rock:1", assetId: "rock", x: 10, y: 3, z: 20, scale: 1.2 },
    { id: "quiver:1", assetId: "quiver", x: 30, y: 4, z: 40, scale: 2.4 }
  ];
  const initialDigest = gameplay.environmentCollisionDigest(initial);
  const loadedDigest = gameplay.environmentCollisionDigest(loaded);
  assert.notEqual(loadedDigest, initialDigest, "late GLB placement must invalidate the collider snapshot without a 52 m cell change");
  assert.equal(gameplay.environmentCollisionDigest(loaded.slice().reverse()), loadedDigest, "renderer ordering must not cause collider churn");
  assert.notEqual(gameplay.environmentCollisionDigest([{ ...loaded[0], y: 4 }]), gameplay.environmentCollisionDigest([loaded[0]]), "terrain-height changes must invalidate collider placement");
  assert.equal(gameplay.environmentCollisionDigest([{ id: "fern:1", assetId: "fern", x: 1, y: 2, z: 3, scale: 1 }]), initialDigest, "non-blocking foliage must not rebuild static collision");

  const refresh = extractFunctionSource(gameplaySource, "refreshStaticCollision");
  assert.ok(refresh.indexOf("const placements = snapshot.placements") < refresh.indexOf("cellKey === instance.collisionCellKey"), "the live placement digest must be computed before the unchanged-cell early return");
  assert.match(refresh, /environmentCollisionDigest\(placements\)/);
  assert.match(refresh, /snapshot\.revision \?\? snapshot\.digest/);

  const refreshStaticCollision = Function(
    "environmentCollisionDigest", "environmentCollisionObstacle",
    `"use strict"; return (${refresh});`
  )(gameplay.environmentCollisionDigest, gameplay.environmentCollisionObstacle);
  let snapshot = { supported: true, cellKey: "10:10:balanced", placements: initial };
  let clears = 0;
  const inserted = [];
  const instance = {
    state: { player: { x: 540, y: 540 } },
    collisionSystem: {
      clearObstacles() { clears += 1; },
      upsertObstacle(obstacle) { inserted.push(obstacle); }
    },
    renderer3d: { getEnvironmentCollisionPlacements() { return snapshot; } },
    collisionCellKey: ""
  };
  assert.equal(refreshStaticCollision(instance), true);
  assert.equal(clears, 1);
  snapshot = { ...snapshot, placements: loaded };
  assert.equal(refreshStaticCollision(instance), true);
  assert.equal(clears, 2, "late placements in the unchanged renderer cell must rebuild colliders immediately");
  assert.deepEqual(inserted.map((obstacle) => obstacle.id), ["rock:1", "quiver:1"]);
  assert.equal(refreshStaticCollision(instance), true);
  assert.equal(clears, 2, "an identical revision/digest must not rebuild colliders every frame");
});

test("rendered procedural vegetation and imported props share one bounded collision snapshot", () => {
  const proceduralTree = {
    id: "env:4:4:2:tree",
    source: "procedural-environment",
    category: "mature-tree",
    type: "tree",
    shape: "circle",
    x: 1010,
    y: 6,
    z: 1030,
    radius: .42,
    height: 8.4
  };
  const proceduralLog = {
    id: "env:4:4:3:log",
    source: "procedural-environment",
    category: "log",
    type: "log",
    shape: "aabb",
    x: 1020,
    y: 6,
    z: 1040,
    minX: 1018,
    maxX: 1022,
    minY: 6,
    maxY: 6.5,
    minZ: 1039.5,
    maxZ: 1040.5,
    radius: 2.1,
    height: .5
  };
  const treeObstacle = gameplay.environmentCollisionObstacle(proceduralTree);
  const logObstacle = gameplay.environmentCollisionObstacle(proceduralLog);
  assert.deepEqual(treeObstacle, { id: proceduralTree.id, type: "tree", shape: "circle", x: 1010, y: 6, z: 1030, radius: .42, height: 8.4 });
  assert.deepEqual(logObstacle, { id: proceduralLog.id, type: "static", shape: "aabb", minX: 1018, maxX: 1022, minY: 6, maxY: 6.5, minZ: 1039.5, maxZ: 1040.5 });
  assert.notEqual(gameplay.environmentCollisionDigest([proceduralTree, proceduralLog]), gameplay.environmentCollisionDigest([]));

  const adapter = renderer3d.create({ playerX: 1024, playerZ: 1024 });
  adapter._environmentRenderer = {
    getCollisionSnapshot() {
      return { supported: true, cellKey: "64:64:balanced", revision: 7, digest: "2:abc:def", colliders: Object.freeze([proceduralTree, proceduralLog]), truncated: false };
    },
    dispose() {}
  };
  adapter._environmentAssets = {
    getCollisionPlacements() {
      return { supported: true, cellKey: "19:19:balanced", placements: Object.freeze([{ id: "rock:cc0", assetId: "rock", x: 1000, y: 5, z: 1004, scale: 1 }]) };
    },
    dispose() {}
  };
  const snapshot = adapter.getEnvironmentCollisionPlacements({ x: 1024, z: 1024 });
  assert.equal(snapshot.supported, true);
  assert.equal(snapshot.procedural, 2);
  assert.equal(snapshot.imported, 1);
  assert.equal(snapshot.placements.length, 3);
  assert.match(snapshot.digest, /^v2:3:/);
  adapter.dispose();
});

test("collision kernel exposes honest renderer-neutral UMD/CommonJS capabilities", () => {
  assert.equal(collision.VERSION, "1.0.0");
  assert.equal(collision.FORMAT, "hh-eonwild-collision-system-v1");
  assert.equal(collision.CAPABILITIES.broadPhase.staticOnly, true);
  assert.equal(collision.CAPABILITIES.narrowPhase.continuousHorizontalSweep, true);
  assert.equal(collision.CAPABILITIES.narrowPhase.triangleMeshes, false);
  assert.equal(collision.CAPABILITIES.narrowPhase.dynamicRigidBodies, false);
  assert.equal(collision.CAPABILITIES.water.buoyancy, false);
  assert.equal(collision.CAPABILITIES.terrain.deterministicSamples, 9);
  for (const name of ["normalizeObstacle", "resolveLocomotionProfile", "clipPlanarVelocity", "createCollisionSystem"]) {
    assert.equal(typeof collision[name], "function", `${name} must be exported`);
  }
  for (const name of ["StaticSpatialHash", "CollisionSystem"]) assert.equal(typeof collision[name], "function");

  const sandbox = {};
  vm.runInNewContext(source, sandbox, { filename: "hh-eonwild-collision-system.js" });
  assert.equal(sandbox.HHEonWildCollisionSystem.FORMAT, collision.FORMAT);
  assert.equal(typeof sandbox.HHEonWildCollisionSystem.createCollisionSystem, "function");
  assert.doesNotMatch(source, /BABYLON|createElement|getContext\s*\(|requestAnimationFrame/, "collision kernel must not own renderer or DOM work");
});

test("bounded spatial hash indexes tree, rock and cliff colliders without returning distant cells", () => {
  const hash = new collision.StaticSpatialHash({
    cellSize: 4,
    maxObstacles: 4,
    maxCellsPerObstacle: 4,
    maxQueryCells: 16,
    maxQueryResults: 4
  });
  hash.add({ id: "tree-1", type: "tree", shape: "circle", x: 1, z: 1, radius: 0.7 });
  hash.add({ id: "rock-1", type: "rock", shape: "aabb", minX: 6, maxX: 8, minZ: 0, maxZ: 2 });
  hash.add({ id: "cliff-1", type: "cliff", minX: 20, maxX: 22, minZ: 20, maxZ: 22 });

  const output = ["stale"];
  const metadata = {};
  assert.equal(hash.queryAABB(-1, -1, 3, 3, output, metadata), output, "caller-owned result array must be reused");
  assert.deepEqual(output.map((item) => item.id), ["tree-1"]);
  assert.equal(metadata.truncated, false);
  assert.ok(metadata.visitedCells <= 4);
  assert.equal(hash.get("rock-1").shape, "aabb");

  hash.upsert({ id: "tree-1", type: "tree", x: 10, z: 10, radius: 0.7 });
  hash.queryAABB(-1, -1, 3, 3, output, metadata);
  assert.equal(output.length, 0, "upsert must detach stale spatial cells");
  assert.equal(hash.remove("rock-1"), true);
  assert.equal(hash.remove("rock-1"), false);
  assert.throws(() => hash.add({ id: "too-large", minX: 0, maxX: 40, minZ: 0, maxZ: 40 }), /spans .* cells/);
  assert.doesNotThrow(() => hash.queryAABB(-100, -100, 100, 100, output, metadata));
  assert.equal(metadata.truncated, true, "oversized broad-phase queries must be bounded and declared truncated");
  assert.equal(output.length, 0);
  assert.equal(hash.dispose(), true);
  assert.equal(hash.dispose(), false, "dispose must be idempotent");
  assert.throws(() => hash.queryAABB(0, 0, 1, 1), /disposed/);
});

test("spatial hash enforces obstacle and query-result budgets", () => {
  const hash = new collision.StaticSpatialHash({ cellSize: 8, maxObstacles: 2, maxQueryResults: 1 });
  hash.add({ id: "tree-a", x: 0, z: 0, radius: 1 });
  hash.add({ id: "tree-b", x: 2, z: 0, radius: 1 });
  assert.throws(() => hash.add({ id: "tree-c", x: 4, z: 0, radius: 1 }), /obstacle limit/);
  const rows = [];
  const meta = {};
  hash.queryAABB(-2, -2, 4, 2, rows, meta);
  assert.equal(rows.length, 1);
  assert.equal(meta.truncated, true);
  hash.dispose();
});

test("nine-point terrain grounding is deterministic, slope-aware and allocation-aware", () => {
  let samples = 0;
  const terrain = (x, z) => {
    samples += 1;
    return 2 + x * 0.25 - z * 0.1;
  };
  const system = collision.createCollisionSystem({ terrainSampler: terrain });
  const reusable = { normal: {} };
  const first = system.sampleGround(10, 20, { radius: 2 }, reusable);
  assert.equal(first, reusable);
  assert.equal(first.normal, reusable.normal);
  assert.equal(first.available, true);
  assert.equal(first.sampleCount, collision.LIMITS.GROUND_SAMPLE_COUNT);
  assert.equal(samples, 9);
  assert.ok(Math.abs(first.centerHeight - 2.5) < 1e-12);
  assert.ok(Math.abs(first.height - 3) < 1e-12, "support height uses the highest footprint contact");
  assert.ok(Math.abs(first.gradientSlopeDegrees - Math.atan(Math.hypot(0.25, 0.1)) * 180 / Math.PI) < 1e-10);
  const snapshot = JSON.parse(JSON.stringify(first));
  const second = system.sampleGround(10, 20, { radius: 2 }, reusable);
  assert.deepEqual(second, snapshot);
  assert.equal(samples, 18);
  system.dispose();
});

test("failed or absent terrain samplers never masquerade as valid height zero", () => {
  const missing = collision.createCollisionSystem();
  const unavailable = missing.sampleGround(5, 7, {}, {});
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.sampleCount, 0);
  const broken = collision.createCollisionSystem({ terrainSampler: () => { throw new Error("chunk missing"); } });
  const brokenGround = broken.sampleGround(5, 7, {}, {});
  assert.equal(brokenGround.available, false);
  assert.equal(broken.getDiagnostics({}).failedTerrainSamples, 9);
  const partial = collision.createCollisionSystem({ terrainSampler: (x) => x < 1 ? NaN : 100 });
  const crossingMissingChunk = partial.resolveMovement(
    { x: 0, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { radius: 0.1, maxMoveDistance: 4 },
    {}
  );
  assert.equal(crossingMissingChunk.terrainAvailable, false);
  assert.equal(crossingMissingChunk.y, 0, "partial terrain data cannot snap the animal upward by an unbounded amount");
  missing.dispose();
  broken.dispose();
  partial.dispose();
});

test("continuous circle sweep prevents tunneling and clips inward velocity without bouncing", () => {
  const system = collision.createCollisionSystem({ terrainSampler: flatTerrain });
  system.addObstacle({ id: "tree-trunk", type: "tree", x: 5, z: 0, radius: 1 });
  const output = {};
  const resolved = system.resolveMovement(
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    { radius: 0.5, height: 2, maxMoveDistance: 20, velocityX: 10, velocityZ: 0 },
    output
  );
  assert.equal(resolved, output);
  assert.equal(resolved.blockedByObstacle, true);
  assert.equal(resolved.obstacleId, "tree-trunk");
  assert.ok(resolved.x > 3.46 && resolved.x < 3.48, `unexpected contact x ${resolved.x}`);
  assert.equal(resolved.z, 0);
  assert.equal(resolved.contactNormalX, -1);
  assert.ok(Math.abs(resolved.resolvedVelocityX) < 1e-10);
  assert.equal(resolved.resolvedVelocityZ, 0);
  assert.equal(resolved.velocityClipped, true);
  assert.ok(resolved.displacementX >= 0, "collision response cannot reflect movement backward");

  const stable = system.resolveMovement(
    { x: resolved.x, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    { radius: 0.5, height: 2, maxMoveDistance: 20 },
    output
  );
  assert.ok(stable.x >= resolved.x - 1e-6, "repeated contact must not kick the animal backward");
  assert.ok(stable.x < 3.48);
  system.dispose();
});

test("AABB collision slides tangentially and thin cliffs cannot be tunneled through", () => {
  const system = collision.createCollisionSystem({ terrainSampler: flatTerrain });
  system.addObstacle({ id: "thin-cliff", type: "cliff", minX: 5, maxX: 5.08, minZ: -2, maxZ: 2 });
  const result = system.resolveMovement(
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 3 },
    { radius: 0.5, maxMoveDistance: 20, maxResolveIterations: 4 },
    {}
  );
  assert.equal(result.blockedByObstacle, true);
  assert.ok(result.x > 4.46 && result.x < 4.49);
  assert.ok(result.z > 2.9, "remaining tangential movement should slide along the cliff");
  assert.ok(result.resolvedDistance <= result.requestedDistance + 1e-6, "slide cannot add kinetic displacement");
  system.dispose();
});

test("steep slopes, tall steps and unsafe drops are rejected while bounded steps remain usable", () => {
  const steep = collision.createCollisionSystem({ terrainSampler: (x) => x * 2 });
  const steepResult = steep.resolveMovement(
    { x: 0, y: 0.2, z: 0 },
    { x: 1, y: 0.2, z: 0 },
    { radius: 0.1, maxSlopeDegrees: 30, maxMoveDistance: 4 },
    {}
  );
  assert.equal(steepResult.blockedBySlope, true);
  assert.ok(steepResult.x < 0.001);
  steep.dispose();

  const tallStep = collision.createCollisionSystem({ terrainSampler: (x) => x >= 2 ? 1 : 0 });
  const tall = tallStep.resolveMovement(
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { radius: 0.1, maxStepUp: 0.4, maxSnapUp: 0.4, maxMoveDistance: 8 },
    {}
  );
  assert.equal(tall.blockedByStepUp, true);
  assert.ok(tall.x < 2, "controller must stop before a step above its profile limit");
  assert.ok(tall.y <= 0.4 + 1e-8);
  tallStep.dispose();

  const smallStep = collision.createCollisionSystem({ terrainSampler: (x) => x >= 2 ? 0.25 : 0 });
  const small = smallStep.resolveMovement(
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { radius: 0.1, maxStepUp: 0.4, maxSnapUp: 0.4, maxMoveDistance: 8 },
    {}
  );
  assert.equal(small.blockedByStepUp, false);
  assert.equal(small.x, 4);
  assert.equal(small.y, 0.25);
  assert.equal(small.grounded, true);
  smallStep.dispose();

  const dropSystem = collision.createCollisionSystem({ terrainSampler: (x) => x < 2 ? 1 : 0 });
  const drop = dropSystem.resolveMovement(
    { x: 0, y: 1, z: 0 },
    { x: 4, y: 1, z: 0 },
    { radius: 0.1, maxStepDown: 0.35, maxSnapDown: 0.2, maxMoveDistance: 8 },
    {}
  );
  assert.equal(drop.blockedByStepDown, true);
  assert.ok(drop.x < 2);
  assert.ok(drop.y >= 0.8, "vertical correction must remain bounded");
  dropSystem.dispose();
});

test("water boundaries vary by locomotion instead of applying one global rule", () => {
  const waterSampler = (x) => x >= 2 ? { inside: true, type: "river", depth: 2 } : null;
  const system = collision.createCollisionSystem({ terrainSampler: flatTerrain, waterSampler });
  const terrestrial = system.resolveMovement(
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { locomotion: "terrestrial", radius: 0.2, maxMoveDistance: 8 },
    {}
  );
  assert.equal(terrestrial.blockedByWater, true);
  assert.ok(terrestrial.x > 1.99 && terrestrial.x < 2);
  assert.equal(terrestrial.waterBoundaryApplied, true);

  const amphibious = system.resolveMovement(
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { locomotion: "amphibious", radius: 0.2, maxMoveDistance: 8 },
    {}
  );
  assert.equal(amphibious.blockedByWater, false);
  assert.equal(amphibious.x, 4);

  const aquatic = system.resolveMovement(
    { x: 3, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { locomotion: "aquatic", radius: 0.2, maxMoveDistance: 8 },
    {}
  );
  assert.equal(aquatic.blockedByWater, true);
  assert.ok(aquatic.x >= 2 && aquatic.x < 2.01, `aquatic boundary was ${aquatic.x}`);

  const shallow = collision.createCollisionSystem({
    terrainSampler: flatTerrain,
    waterSampler: (x) => x >= 2 ? { inside: true, type: "stream", depth: 0.3 } : null
  });
  const wading = shallow.resolveMovement(
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { locomotion: "terrestrial", maxWaterDepth: 0.5, maxMoveDistance: 8 },
    {}
  );
  assert.equal(wading.blockedByWater, false);
  assert.equal(wading.x, 4);
  system.dispose();
  shallow.dispose();
});

test("missing water data is reported honestly and never creates an invisible wall", () => {
  const system = collision.createCollisionSystem({ terrainSampler: flatTerrain });
  const result = system.resolveMovement(
    { x: 0, y: 0, z: 0 },
    { x: 3, y: 0, z: 0 },
    { locomotion: "terrestrial", maxMoveDistance: 8 },
    {}
  );
  assert.equal(result.x, 3);
  assert.equal(result.blockedByWater, false);
  assert.equal(result.waterBoundaryApplied, false);
  assert.equal(result.water.available, false);
  assert.equal(result.water.allowed, null);
  system.dispose();
});

test("movement and initial-overlap correction are bounded instead of teleporting", () => {
  const system = collision.createCollisionSystem({ terrainSampler: flatTerrain });
  const reusable = { position: {}, ground: { normal: {} }, water: {} };
  const clamped = system.resolveMovement(
    { x: 0, y: 0, z: 0 },
    { x: 1000, y: 0, z: 0 },
    { maxMoveDistance: 2, collidesStatic: false },
    reusable
  );
  assert.equal(clamped, reusable);
  assert.equal(clamped.position, reusable.position);
  assert.equal(clamped.movementClamped, true);
  assert.ok(clamped.resolvedDistance <= 2 + 1e-8);

  system.addObstacle({ id: "spawn-rock", type: "rock", x: 0, z: 0, radius: 1 });
  const overlap = system.resolveMovement(
    { x: 0, y: 0, z: 0 },
    { x: 0.1, y: 0, z: 0 },
    { radius: 0.5, maxMoveDistance: 2, maxDepenetration: 0.25 },
    reusable
  );
  assert.equal(overlap.depenetrated, true);
  assert.ok(overlap.depenetrationDistance <= 0.25 + 1e-8);
  assert.ok(overlap.resolvedDistance <= 0.35 + 1e-6);
  system.dispose();
});

test("truncated broad phase fails closed and lifecycle diagnostics remain truthful", () => {
  const system = collision.createCollisionSystem({
    terrainSampler: flatTerrain,
    cellSize: 8,
    maxQueryResults: 1,
    maxObstacles: 4
  });
  system.addObstacle({ id: "tree-a", x: 2, z: 0, radius: 1 });
  system.addObstacle({ id: "tree-b", x: 4, z: 0, radius: 1 });
  const result = system.resolveMovement(
    { x: 0, y: 0, z: 0 },
    { x: 6, y: 0, z: 0 },
    { radius: 0.4, maxMoveDistance: 8 },
    {}
  );
  assert.equal(result.broadPhaseTruncated, true);
  assert.equal(result.blocked, true);
  assert.equal(result.x, 0, "incomplete candidate sets must not permit tunneling");
  const diagnostics = system.getDiagnostics({ spatialHash: {} });
  assert.equal(diagnostics.state, "active");
  assert.equal(diagnostics.resolveCount, 1);
  assert.ok(diagnostics.spatialHash.truncatedQueries >= 1);
  assert.equal(system.dispose(), true);
  assert.equal(system.dispose(), false);
  assert.throws(() => system.resolveMovement({}, {}), /disposed/);
});

test("pure velocity clipping removes only inward normal velocity", () => {
  const output = {};
  assert.equal(collision.clipPlanarVelocity(3, 4, 1, 0, output), output);
  assert.equal(output.x, 3, "velocity pointing away from the wall is preserved");
  assert.equal(output.z, 4);
  assert.equal(output.clipped, false);
  collision.clipPlanarVelocity(3, 4, -1, 0, output);
  assert.equal(output.x, 0);
  assert.equal(output.z, 4);
  assert.equal(output.clipped, true);
});

test("fixed-step integration cannot tunnel across a deep water boundary during a catch-up frame", () => {
  const system = collision.createCollisionSystem({
    terrainSampler: flatTerrain,
    waterSampler: (_x, z) => z >= 0.08
      ? { inside: true, surfaceHeight: 3, depth: 3, type: "water" }
      : null
  });
  const controller = new desktop.FixedTimestepController({
    stepSeconds: 1 / 120,
    maxFrameSeconds: 0.2,
    maxSubSteps: 24,
    maxSpeed: 24,
    acceleration: 1000,
    deceleration: 1000,
    initialState: { x: 0, z: 0 }
  });
  const reusable = {};
  let resolvedSteps = 0;
  const frame = controller.advance(0.2, { x: 0, y: 1, cameraYaw: 0 }, (proposed, current) => {
    resolvedSteps += 1;
    const result = system.resolveMovement(
      { x: current.x, y: 0, z: current.z },
      { x: proposed.x, y: 0, z: proposed.z },
      { locomotion: "terrestrial", radius: 0.2, height: 1, velocityX: proposed.velocityX, velocityZ: proposed.velocityZ },
      reusable
    );
    return {
      ...proposed,
      x: result.x,
      z: result.z,
      velocityX: result.blockedByWater ? 0 : result.resolvedVelocityX,
      velocityZ: result.blockedByWater ? 0 : result.resolvedVelocityZ
    };
  });

  assert.equal(frame.steps, 24);
  assert.equal(resolvedSteps, frame.steps);
  assert.ok(frame.state.z < 0.08, `animal crossed the deep-water boundary at z=${frame.state.z}`);
  assert.equal(frame.state.velocityZ, 0);
  system.dispose();
});
