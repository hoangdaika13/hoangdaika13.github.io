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

test("module is UMD/CommonJS, renderer-only and exposes the requested lifecycle API", () => {
  assert.equal(rendererApi.VERSION, "1.0.0");
  assert.equal(rendererApi.FORMAT, "hh-eonwild-environment-renderer-v1");
  assert.equal(rendererApi.MAX_SOURCES, 17);
  assert.equal(typeof rendererApi.create, "function");
  assert.equal(typeof rendererApi.ProceduralVegetationRenderer, "function");

  const sandbox = {};
  vm.runInNewContext(source, sandbox, { filename: "hh-eonwild-environment-renderer.js" });
  assert.equal(sandbox.HHEonWildEnvironmentRenderer.VERSION, rendererApi.VERSION);
  assert.equal(typeof sandbox.HHEonWildEnvironmentRenderer.create, "function");
  assert.doesNotMatch(source, /createElement|requestAnimationFrame|setInterval|\bfetch\s*\(/, "adapter must not own DOM, network or frame loops");

  const renderer = rendererApi.create({ landscape: createLandscape(), quality: "static", chunkSize: 64, frustumCulling: false });
  for (const method of ["update", "configure", "disturb", "pause", "resume", "getTelemetry", "dispose"]) assert.equal(typeof renderer[method], "function", method);
  renderer.dispose();
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
