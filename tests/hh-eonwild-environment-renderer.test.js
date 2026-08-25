"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "hh-eonwild-environment-renderer.js");
const source = fs.readFileSync(sourcePath, "utf8");
const rendererApi = require(sourcePath);

function createLandscape(chunkSize = 64) {
  return {
    config: { worldSize: 4096, chunkSize, chunksPerAxis: 64, seaLevel: -4 },
    sample(x, z) {
      return {
        height: 8 + Math.sin(x * 0.002) * 0.2 + Math.cos(z * 0.0025) * 0.2,
        slopeDegrees: 3,
        moisture: 0.58,
        waterDistance: 240,
        ridge: 0.04,
        primaryBiome: "grassland",
        biomeId: "grassland"
      };
    },
    dispose() { this.disposed = true; return true; }
  };
}

function createBabylonMock() {
  const state = {
    meshes: [],
    materials: [],
    builderCalls: 0,
    builderKinds: [],
    vertexDataApplications: 0,
    forbiddenPerInstanceCalls: 0
  };

  class MockMesh {
    constructor(name, shape) {
      this.name = name;
      this.shape = typeof shape === "string" ? shape : "procedural";
      this.position = { x: 0, y: 0, z: 0 };
      this.rotation = { x: 0, y: 0, z: 0 };
      this.buffers = new Map();
      this.bufferCalls = [];
      this.thinInstanceCount = 0;
      this.disposed = false;
      state.meshes.push(this);
    }

    thinInstanceSetBuffer(kind, data, stride, isStatic) {
      this.bufferCalls.push({ kind, data, stride, isStatic });
      if (data == null) this.buffers.delete(kind);
      else this.buffers.set(kind, { data, stride, isStatic });
    }

    thinInstanceBufferUpdated(kind) { this.lastUpdated = kind; }
    createInstance() { state.forbiddenPerInstanceCalls += 1; throw new Error("per-instance meshes are forbidden"); }
    clone() { state.forbiddenPerInstanceCalls += 1; throw new Error("cloned instances are forbidden"); }
    dispose() { this.disposed = true; }
  }
  MockMesh.DOUBLESIDE = 2;

  const makeMesh = (shape) => (name) => {
    state.builderCalls += 1;
    state.builderKinds.push(shape);
    return new MockMesh(name, shape);
  };

  class VertexData {
    applyToMesh(mesh) {
      state.vertexDataApplications += 1;
      mesh.geometry = {
        positions: Array.from(this.positions || []),
        indices: Array.from(this.indices || []),
        normals: Array.from(this.normals || []),
        uvs: Array.from(this.uvs || [])
      };
    }
  }

  class StandardMaterial {
    constructor(name) {
      this.name = name;
      this.emissiveColor = null;
      this.ambientColor = null;
      this.disposed = false;
      state.materials.push(this);
    }
    dispose() { this.disposed = true; }
  }

  class Color3 {
    constructor(r, g, b) { this.r = r; this.g = g; this.b = b; }
    static FromHexString(hex) {
      const value = parseInt(hex.slice(1), 16);
      return new Color3(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
    }
  }

  return {
    state,
    BABYLON: {
      Mesh: MockMesh,
      VertexData,
      MeshBuilder: {
        CreatePlane: makeMesh("plane"),
        CreateCylinder: makeMesh("cylinder"),
        CreateBox: makeMesh("box")
      },
      StandardMaterial,
      Color3,
      Material: { MATERIAL_OPAQUE: 0 }
    }
  };
}

function runFrames(renderer, count, start = 0, framePatch = {}) {
  const results = [];
  for (let index = 0; index < count; index += 1) {
    results.push(renderer.update({
      playerX: 1024,
      playerZ: 1024,
      time: start + index * 0.016,
      deltaSeconds: 0.016,
      forwardX: 0,
      forwardZ: 1,
      ...framePatch
    }));
  }
  return results;
}

const COLLIDER_TEST_TYPES = Object.freeze([
  Object.freeze({ id: "tree-mature-deciduous", category: "mature-tree" }),
  Object.freeze({ id: "tree-dead", category: "dead-tree" }),
  Object.freeze({ id: "sapling", category: "sapling" }),
  Object.freeze({ id: "root-exposed", category: "root" }),
  Object.freeze({ id: "log-fallen", category: "log" })
]);

function createColliderVegetation() {
  let planCalls = 0;
  return {
    get planCalls() { return planCalls; },
    planChunk(input) {
      planCalls += 1;
      const placements = COLLIDER_TEST_TYPES.slice(0, Math.max(0, input.maxInstances)).map((type, index) => ({
        id: `${input.cx}:${input.cz}:${type.id}`,
        typeId: type.id,
        category: type.category,
        x: input.cx * 64 + 12 + index * 7,
        y: 8,
        z: input.cz * 64 + 14 + index * 5,
        rotationY: index * 0.31,
        scale: 0.9 + index * 0.08
      }));
      return { ok: true, placements, stats: { accepted: placements.length } };
    },
    configure() { return true; },
    update(_frame, out) {
      out.wind = out.wind || { layers: [] };
      Object.assign(out.wind, { x: 1, z: 0, directionX: 1, directionZ: 0, bend: 0, gust: 0 });
      return out;
    },
    sampleStateInto(_x, _z, _time, out) { return Object.assign(out, { wetness: 0, burn: 0, snow: 0, mud: 0, compression: 0, health: 1 }); },
    getStatus() { return { activeInfluences: 0 }; },
    pause() { return true; },
    resume() { return true; },
    dispose() { return true; }
  };
}

function collisionRendererOptions(vegetationSystem, patch = {}) {
  return {
    landscape: createLandscape(),
    vegetationModule: { VEGETATION_TYPES: COLLIDER_TEST_TYPES },
    vegetationSystem,
    seed: "COLLIDER-SNAPSHOT-2026",
    quality: "static",
    chunkSize: 64,
    viewDistance: 110,
    maxActiveChunks: 4,
    maxQueuedChunks: 5,
    maxActiveInstances: 60,
    maxInstancesPerChunk: 5,
    collisionRadius: 128,
    maxCollisionColliders: 12,
    frustumCulling: false,
    ...patch
  };
}

test("module is UMD/CommonJS, renderer-only and exposes the requested lifecycle API", () => {
  assert.equal(rendererApi.VERSION, "1.1.0");
  assert.equal(rendererApi.FORMAT, "hh-eonwild-environment-renderer-v1");
  assert.equal(rendererApi.MAX_SOURCES, 17);
  assert.equal(rendererApi.MAX_CHUNK_BUILDS_PER_UPDATE, 1);
  assert.equal(typeof rendererApi.create, "function");
  assert.equal(typeof rendererApi.ProceduralVegetationRenderer, "function");

  const sandbox = {};
  vm.runInNewContext(source, sandbox, { filename: "hh-eonwild-environment-renderer.js" });
  assert.equal(sandbox.HHEonWildEnvironmentRenderer.VERSION, rendererApi.VERSION);
  assert.equal(typeof sandbox.HHEonWildEnvironmentRenderer.create, "function");
  assert.doesNotMatch(source, /createElement|requestAnimationFrame|setInterval|\bfetch\s*\(/, "adapter must not own DOM, network or frame loops");

  const renderer = rendererApi.create({ landscape: createLandscape(), quality: "static", chunkSize: 64, frustumCulling: false });
  for (const method of ["update", "configure", "disturb", "pause", "resume", "getCollisionSnapshot", "getTelemetry", "dispose"]) assert.equal(typeof renderer[method], "function", method);
  renderer.dispose();
});

test("collision snapshots reuse actually rendered placements with stable cell revisions and strict budgets", () => {
  const vegetation = createColliderVegetation();
  const renderer = rendererApi.create(collisionRendererOptions(vegetation, { maxCollisionColliders: 3 }));
  renderer.update({ playerX: 1024, playerZ: 1024, time: 0, deltaSeconds: 0.016 });
  const first = renderer.getCollisionSnapshot({ x: 1024, z: 1024 });
  const planCallsAfterFirstBuild = vegetation.planCalls;
  assert.equal(first.format, rendererApi.COLLISION_SNAPSHOT_FORMAT);
  assert.equal(first.supported, true);
  assert.ok(first.count > 0 && first.count <= 3);
  assert.equal(first.colliders.length, first.count);
  assert.equal(first.truncated, true);
  assert.ok(first.tracked >= first.count);
  assert.ok(first.radius <= rendererApi.MAX_COLLIDER_RADIUS && first.coverageRadius >= first.radius);
  assert.ok(first.colliders.every((collider) => rendererApi.COLLIDER_CATEGORIES.includes(collider.category)));
  assert.ok(first.colliders.every((collider) => collider.radius > 0 && collider.height > 0));
  assert.ok(Object.isFrozen(first) && Object.isFrozen(first.center) && Object.isFrozen(first.colliders));
  assert.ok(first.colliders.every(Object.isFrozen));
  assert.equal(renderer.getCollisionSnapshot({ x: 1025, z: 1025 }), first, "queries inside the same collision cell must reuse the immutable snapshot");
  assert.equal(vegetation.planCalls, planCallsAfterFirstBuild, "collision queries must never run the vegetation planner a second time");

  renderer.update({ playerX: 1024, playerZ: 1024, time: 0.016, deltaSeconds: 0.016 });
  const second = renderer.getCollisionSnapshot({ x: 1024, z: 1024 });
  assert.ok(second.revision > first.revision, "a newly rendered chunk must invalidate colliders even when the player cell is unchanged");
  assert.equal(second.cellKey, first.cellKey);
  assert.notEqual(second.digest, first.digest);
  assert.ok(second.count <= rendererApi.MAX_COLLIDERS_PER_SNAPSHOT);
  assert.ok(second.scanned <= rendererApi.MAX_COLLIDER_SCAN_PLACEMENTS);
  renderer.dispose();
});

test("descriptor and Babylon modes publish identical procedural collider geometry and clean it on dispose", () => {
  const descriptorVegetation = createColliderVegetation();
  const babylonVegetation = createColliderVegetation();
  const descriptor = rendererApi.create(collisionRendererOptions(descriptorVegetation));
  const mock = createBabylonMock();
  const babylon = rendererApi.create(collisionRendererOptions(babylonVegetation, { BABYLON: mock.BABYLON, scene: {} }));
  runFrames(descriptor, 4);
  runFrames(babylon, 4);
  const descriptorSnapshot = descriptor.getCollisionSnapshot({ x: 1024, z: 1024 });
  const babylonSnapshot = babylon.getCollisionSnapshot({ x: 1024, z: 1024 });
  assert.equal(descriptorSnapshot.mode, "descriptor");
  assert.equal(babylonSnapshot.mode, "babylon-thin-instances");
  assert.equal(descriptorSnapshot.cellKey, babylonSnapshot.cellKey);
  assert.equal(descriptorSnapshot.revision, babylonSnapshot.revision);
  assert.equal(descriptorSnapshot.digest, babylonSnapshot.digest);
  assert.deepEqual(descriptorSnapshot.colliders, babylonSnapshot.colliders);
  assert.equal(descriptorVegetation.planCalls, babylonVegetation.planCalls);
  assert.ok(descriptorSnapshot.colliders.some((collider) => collider.shape === "circle"));
  assert.ok(descriptorSnapshot.colliders.some((collider) => collider.shape === "aabb"));

  descriptor.dispose();
  babylon.dispose();
  for (const renderer of [descriptor, babylon]) {
    const disposed = renderer.getCollisionSnapshot();
    assert.equal(disposed.supported, false);
    assert.equal(disposed.count, 0);
    assert.equal(disposed.tracked, 0);
    assert.deepEqual(disposed.colliders, []);
    assert.equal(renderer.getTelemetry().trackedColliders, 0);
  }
});

test("complete Babylon surface uses shared source meshes and thin-instance buffers, never a mesh per placement", () => {
  const mock = createBabylonMock();
  const renderer = rendererApi.create({
    BABYLON: mock.BABYLON,
    scene: {},
    landscape: createLandscape(),
    seed: "THIN-INSTANCE-541",
    quality: "static",
    chunkSize: 64,
    viewDistance: 150,
    maxActiveChunks: 6,
    maxQueuedChunks: 8,
    maxActiveInstances: 85,
    frustumCulling: false
  });

  assert.equal(renderer.getTelemetry().mode, "babylon-thin-instances");
  assert.equal(mock.state.meshes.length, 17, "one bounded source mesh is allowed for each vegetation type");
  assert.equal(mock.state.vertexDataApplications, 11, "every ground-cover type must receive procedural vertex geometry");
  assert.ok(mock.state.materials.length > 0 && mock.state.materials.length <= 17, "materials must be shared by vegetation family");

  const results = runFrames(renderer, 7);
  assert.ok(results.every((frame) => frame.buildsThisUpdate === 0 || frame.buildsThisUpdate === 1), "at most one chunk may build per update");
  const telemetry = renderer.getTelemetry();
  assert.ok(telemetry.activeInstances > 0);
  assert.ok(telemetry.renderedInstances > 0);
  assert.equal(telemetry.sourceMeshes, 17);
  assert.equal(telemetry.thinInstanceSources, 17);
  assert.equal(mock.state.meshes.length, 17, "streaming must not create further meshes");
  assert.equal(mock.state.forbiddenPerInstanceCalls, 0);

  const matrixBuffers = mock.state.meshes.map((mesh) => mesh.buffers.get("matrix")).filter(Boolean);
  assert.equal(matrixBuffers.length, 17);
  assert.ok(matrixBuffers.every((entry) => entry.data instanceof Float32Array && entry.stride === 16));
  assert.ok(mock.state.meshes.some((mesh) => mesh.thinInstanceCount > 0));
  assert.ok(mock.state.meshes.every((mesh) => mesh.buffers.has("lodData") && mesh.buffers.has("stateData") && mesh.buffers.has("windData")));
  assert.ok(mock.state.meshes.some((mesh) => mesh.metadata.hhEonWild.wind.time > 0));
  assert.equal(telemetry.visualStateConsumer, "cpu-build-matrix-wind-compression+density-lod+shared-live-sway");
  const animatedMesh = mock.state.meshes.find((mesh) => mesh.thinInstanceCount > 0);
  const matrices = animatedMesh.buffers.get("matrix").data.slice(0, animatedMesh.thinInstanceCount * 16);
  assert.ok(Array.from(matrices).some((value, index) => (index % 16 === 4 || index % 16 === 6) && Math.abs(value) > 0.000001), "per-instance wind phase must lean visible thin-instance matrices at build time");
  renderer.dispose();
});

test("grass, reeds, fern, shrubs, fungi and moss use opaque low-poly silhouettes instead of solid alpha rectangles", () => {
  const mock = createBabylonMock();
  const renderer = rendererApi.create({
    BABYLON: mock.BABYLON,
    scene: {},
    landscape: createLandscape(),
    seed: "PROCEDURAL-SILHOUETTES-2026",
    quality: "static",
    chunkSize: 64,
    maxActiveInstances: 51,
    frustumCulling: false
  });
  const groundCategories = new Set(["grass", "reed", "fern", "shrub", "fungi", "moss"]);
  const groundMeshes = mock.state.meshes.filter((mesh) => groundCategories.has(mesh.metadata?.hhEonWild?.category));
  assert.equal(groundMeshes.length, 11);
  assert.equal(mock.state.builderKinds.includes("plane"), false, "renderer must never create opaque rectangular vegetation cards");
  assert.doesNotMatch(source, /builders\.CreatePlane|MeshBuilder\.CreatePlane/, "production adapter must not retain a plane fallback");

  for (const mesh of groundMeshes) {
    const descriptor = mesh.metadata.hhEonWildGeometry;
    assert.equal(mesh.shape, "procedural");
    assert.equal(mesh.position.y, 0, "ground-cover geometry must stay rooted at terrain height");
    assert.equal(descriptor.opaqueSilhouette, true);
    assert.equal(descriptor.alphaCard, false);
    assert.ok(descriptor.vertexCount >= 7);
    assert.ok(descriptor.triangleCount >= 5);
    assert.equal(mesh.geometry.positions.length, descriptor.vertexCount * 3);
    assert.equal(mesh.geometry.indices.length, descriptor.triangleCount * 3);
    assert.equal(mesh.geometry.normals.length, mesh.geometry.positions.length);
    assert.notEqual(mesh.geometry.positions.length, 12, "a four-corner rectangle is forbidden");
    assert.notEqual(mesh.geometry.indices.length, 6, "a two-triangle rectangle is forbidden");
    assert.equal(mesh.material.alpha, 1);
    assert.equal(mesh.material.useAlphaFromDiffuseTexture, false);
    assert.equal(mesh.material.transparencyMode, 0);
    assert.ok(mesh.material.diffuseColor.r <= 0.71 && mesh.material.diffuseColor.g <= 0.71 && mesh.material.diffuseColor.b <= 0.71, "palette must remain natural rather than neon");
    assert.ok(mesh.material.emissiveColor.r >= mesh.material.diffuseColor.r * 0.33);
    assert.ok(mesh.material.emissiveColor.g >= mesh.material.diffuseColor.g * 0.33);
    assert.ok(mesh.material.emissiveColor.b >= mesh.material.diffuseColor.b * 0.33);
    assert.ok(mesh.material.ambientColor.r >= mesh.material.diffuseColor.r * 0.45);
    assert.equal(rendererApi.NATURAL_LIGHT_FLOOR.emissiveFactor, 0.34);
  }

  const grass = groundMeshes.find((mesh) => mesh.metadata.hhEonWild.category === "grass");
  const fern = groundMeshes.find((mesh) => mesh.metadata.hhEonWild.category === "fern");
  const shrub = groundMeshes.find((mesh) => mesh.metadata.hhEonWild.category === "shrub");
  const fungi = groundMeshes.find((mesh) => mesh.metadata.hhEonWild.category === "fungi");
  const moss = groundMeshes.find((mesh) => mesh.metadata.hhEonWild.category === "moss");
  const maximumY = (mesh) => Math.max(...mesh.geometry.positions.filter((_value, index) => index % 3 === 1));
  const averageNormalY = (mesh) => {
    const values = mesh.geometry.normals.filter((_value, index) => index % 3 === 1);
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };
  assert.ok(maximumY(grass) > 0.45, "grass must have tapered upright blades");
  assert.ok(averageNormalY(fern) > 0.2, "fern fronds must face the sky instead of shading black");
  assert.ok(maximumY(shrub) > 0.7, "shrubs must form a low faceted canopy");
  assert.ok(maximumY(fungi) > 0.15 && maximumY(fungi) < 0.5, "fungi must remain recognizable and ground-scale");
  assert.ok(maximumY(moss) < 0.1, "moss must hug terrain instead of becoming a wall");
  assert.ok(averageNormalY(moss) > 0.8, "moss normals must face the sky instead of shading black");
  renderer.dispose();
});

test("chunk queues, active chunks and typed instance storage stay inside configured quality budgets", () => {
  const renderer = rendererApi.create({
    landscape: createLandscape(),
    BABYLON: { MeshBuilder: {} },
    scene: {},
    seed: "BOUNDED-STREAMING-2026",
    quality: "static",
    chunkSize: 64,
    viewDistance: 150,
    maxActiveChunks: 2,
    maxQueuedChunks: 3,
    maxActiveInstances: 34,
    maxInstancesPerChunk: 20,
    frustumCulling: false
  });

  for (let index = 0; index < 16; index += 1) {
    const result = renderer.update({ playerX: 900 + index * 18, playerZ: 900 + index * 7, time: index, deltaSeconds: 0.25 });
    const telemetry = result.telemetry;
    assert.ok(result.buildsThisUpdate <= 1);
    assert.ok(telemetry.activeChunks <= 2);
    assert.ok(telemetry.queuedChunks <= 3);
    assert.ok(telemetry.activeInstances <= 34);
    assert.equal(telemetry.instanceBufferCapacity, 34);
    assert.equal(telemetry.bufferFloats, 34 * (16 + 4 + 4 + 4));
  }
  const telemetry = renderer.getTelemetry();
  assert.equal(telemetry.mode, "descriptor");
  assert.ok(telemetry.chunkBuilds <= 16);
  renderer.dispose();
});

test("streaming score prioritizes the camera-forward hemisphere with deterministic ties and reuses hot-path storage", () => {
  const renderer = rendererApi.create({
    landscape: createLandscape(),
    seed: "FORWARD-SCORE-2026",
    quality: "static",
    chunkSize: 64,
    playerX: 1024,
    playerZ: 1024,
    viewDistance: 150,
    maxActiveChunks: 5,
    maxQueuedChunks: 5,
    maxActiveInstances: 85,
    maxInstancesPerChunk: 3,
    frustumCulling: false
  });

  const first = renderer.update({ playerX: 1024, playerZ: 1024, forwardX: 0, forwardZ: 1, time: 0, deltaSeconds: 0.016 });
  const [, firstCz] = first.builtChunk.split(":").map(Number);
  const firstCenterZ = (firstCz + 0.5) * 64;
  assert.ok(firstCenterZ > 1024, "an equidistant chunk in front of the camera must build before a rear chunk");
  assert.equal(first.buildBudget.limit, 1);
  assert.equal(first.buildBudget.used, 1);
  assert.equal(first.buildBudget.remaining, 0);
  assert.equal(first.telemetry.queueHeadFacing >= 0, true);
  assert.equal(first.telemetry.staleQueuedChunks, 0);

  runFrames(renderer, 8, 0.016, { playerX: 1024, playerZ: 1024, forwardX: 0, forwardZ: 1 });
  const warmed = renderer.getTelemetry();
  const candidatePoolSize = warmed.candidatePoolSize;
  const queueJobAllocations = warmed.queueJobAllocations;
  runFrames(renderer, 20, 1, { playerX: 1024, playerZ: 1024, forwardX: 0, forwardZ: 1 });
  const settled = renderer.getTelemetry();
  assert.equal(settled.candidatePoolSize, candidatePoolSize, "candidate objects must be pooled after warm-up");
  assert.equal(settled.queueJobAllocations, queueJobAllocations, "settled streaming must not allocate new queue jobs");
  assert.equal(settled.queueHeadScore, null);
  assert.doesNotMatch(source, /const densityByLod\s*=|Array\.from\(this\.chunks\.values\(\)\)/, "per-instance density arrays and per-rebuild chunk arrays must not remain on hot paths");
  renderer.dispose();
});

test("a material camera turn invalidates stale queued chunks and never spends more than one build budget", () => {
  const renderer = rendererApi.create({
    landscape: createLandscape(),
    seed: "STALE-DIRECTION-QUEUE-2026",
    quality: "static",
    chunkSize: 64,
    playerX: 1024,
    playerZ: 1024,
    viewDistance: 150,
    maxActiveChunks: 5,
    maxQueuedChunks: 5,
    maxActiveInstances: 85,
    maxInstancesPerChunk: 3,
    frustumCulling: false
  });

  const forward = renderer.update({ playerX: 1024, playerZ: 1024, forwardX: 0, forwardZ: 1, time: 0, deltaSeconds: 0.016 });
  const queuedBeforeTurn = forward.telemetry.queuedChunks;
  const allocationsBeforeTurn = forward.telemetry.queueJobAllocations;
  assert.equal(queuedBeforeTurn, 4);

  const reverse = renderer.update({ playerX: 1024, playerZ: 1024, forwardX: 0, forwardZ: -1, time: 0.016, deltaSeconds: 0.016 });
  const [, reverseCz] = reverse.builtChunk.split(":").map(Number);
  assert.ok((reverseCz + 0.5) * 64 < 1024, "the first replacement build must follow the new camera direction");
  assert.equal(reverse.buildsThisUpdate, 1);
  assert.equal(reverse.telemetry.chunkBuildBudgetPerUpdate, 1);
  assert.equal(reverse.telemetry.chunkBuildBudgetUsed, 1);
  assert.equal(reverse.telemetry.chunkBuildBudgetRemaining, 0);
  assert.equal(reverse.telemetry.chunkPlanCalls, 2, "one and only one planner call is allowed per update");
  assert.equal(reverse.telemetry.queueDirectionInvalidations, 1);
  assert.equal(reverse.telemetry.staleQueuedChunksDiscardedThisUpdate, queuedBeforeTurn);
  assert.equal(reverse.telemetry.staleDirectionChunksDiscarded, queuedBeforeTurn);
  assert.equal(reverse.telemetry.staleQueuedChunks, 0, "no invalid job may survive the refresh");
  assert.equal(reverse.telemetry.queueJobAllocations, allocationsBeforeTurn, "replacement jobs must reuse the discarded queue pool");

  let planCalls = reverse.telemetry.chunkPlanCalls;
  for (let index = 0; index < 12; index += 1) {
    const frame = renderer.update({
      playerX: 1024 + index * 7,
      playerZ: 1024 - index * 5,
      forwardX: index % 2 ? 1 : -1,
      forwardZ: index % 3 ? -0.25 : 0.25,
      time: 0.032 + index * 0.016,
      deltaSeconds: 0.016
    });
    assert.ok(frame.buildsThisUpdate <= 1);
    assert.ok(frame.telemetry.chunkPlanCalls - planCalls <= 1);
    assert.equal(frame.telemetry.chunkBuildBudgetUsed + frame.telemetry.chunkBuildBudgetRemaining, 1);
    assert.equal(frame.telemetry.chunkBuildsDeferred, frame.telemetry.pendingDesiredChunks);
    planCalls = frame.telemetry.chunkPlanCalls;
  }
  renderer.dispose();
});

test("incomplete Babylon mocks fail open to deterministic pure descriptors", () => {
  const options = {
    landscape: createLandscape(),
    BABYLON: { MeshBuilder: { CreatePlane() { return { dispose() {} }; } } },
    scene: {},
    seed: "DETERMINISTIC-DESCRIPTOR-17",
    quality: "static",
    chunkSize: 64,
    viewDistance: 140,
    maxActiveChunks: 5,
    maxQueuedChunks: 6,
    maxActiveInstances: 70,
    frustumCulling: false
  };
  const first = rendererApi.create(options);
  const second = rendererApi.create({ ...options, landscape: createLandscape() });
  runFrames(first, 6, 2);
  runFrames(second, 6, 2);
  const firstTelemetry = first.getTelemetry();
  const secondTelemetry = second.getTelemetry();
  assert.equal(firstTelemetry.mode, "descriptor");
  assert.equal(firstTelemetry.sourceMeshes, 0);
  assert.equal(firstTelemetry.descriptorDigest, secondTelemetry.descriptorDigest);
  assert.equal(firstTelemetry.activeInstances, secondTelemetry.activeInstances);
  assert.equal(firstTelemetry.activeChunks, secondTelemetry.activeChunks);
  assert.equal(firstTelemetry.lastBuiltChunk, secondTelemetry.lastBuiltChunk);
  first.dispose();
  second.dispose();
});

test("pause, environment disturbance and dispose are bounded, observable and idempotent", () => {
  const mock = createBabylonMock();
  const renderer = rendererApi.create({
    BABYLON: mock.BABYLON,
    scene: {},
    landscape: createLandscape(),
    seed: "LIFECYCLE-991",
    quality: "static",
    chunkSize: 64,
    maxActiveInstances: 51,
    frustumCulling: false
  });
  runFrames(renderer, 2);
  const buildsBeforePause = renderer.getTelemetry().chunkBuilds;
  assert.equal(renderer.pause("test"), true);
  const paused = renderer.update({ playerX: 1400, playerZ: 1400, time: 4, deltaSeconds: 0.016 });
  assert.equal(paused.status, "paused");
  assert.equal(renderer.getTelemetry().chunkBuilds, buildsBeforePause);
  assert.equal(renderer.resume("test"), true);
  renderer.configure({ weather: { rain: 0.9, snow: 0.25 } });
  renderer.disturb({ type: "fire", x: 1024, z: 1024, radius: 4, strength: 0.7, startMs: 4000, durationMs: 1000 });
  renderer.update({ playerX: 1024, playerZ: 1024, time: 4.1, deltaSeconds: 0.1 });
  const environment = renderer.getTelemetry().environment;
  assert.ok(environment.wetness >= 0.9);
  assert.equal(environment.snow, 0.25);

  assert.equal(renderer.dispose(), true);
  assert.equal(renderer.dispose(), false);
  assert.ok(mock.state.meshes.every((mesh) => mesh.disposed));
  assert.ok(mock.state.materials.every((material) => material.disposed));
  const disposed = renderer.getTelemetry();
  assert.equal(disposed.status, "disposed");
  assert.equal(disposed.sourceMeshes, 0);
  assert.equal(disposed.activeChunks, 0);
  assert.equal(disposed.queuedChunks, 0);
  assert.equal(disposed.activeInstances, 0);
  assert.equal(disposed.bufferFloats, 0);
  assert.equal(renderer.update({ time: 5 }).status, "disposed");
});
