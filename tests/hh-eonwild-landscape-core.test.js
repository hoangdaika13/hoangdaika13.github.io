"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "hh-eonwild-landscape-core.js");
const source = fs.readFileSync(sourcePath, "utf8");
const landscape = require(sourcePath);

const sumWeights = (weights) => landscape.BIOME_IDS.reduce((sum, id) => sum + weights[id], 0);
const heightAtVertex = (geometry, xIndex, zIndex) => geometry.positions[(zIndex * geometry.resolution + xIndex) * 3 + 1];
const normalAtVertex = (geometry, xIndex, zIndex) => {
  const offset = (zIndex * geometry.resolution + xIndex) * 3;
  return Array.from(geometry.normals.slice(offset, offset + 3));
};

test("landscape core is a UMD/CommonJS module with a browser global and renderer-safe exports", () => {
  assert.equal(landscape.VERSION, "1.0.0");
  assert.equal(landscape.FORMAT, "hh-eonwild-landscape-core-v1");
  assert.equal(landscape.WORKER_JOB_FORMAT, "hh-eonwild-landscape-job-v1");
  assert.equal(landscape.BIOME_IDS.length, 10);
  assert.equal(landscape.LOD_PROFILES.length, 4);
  for (const name of [
    "noise2D", "fractalNoise2D", "ridgedNoise2D", "domainWarp2D",
    "createLandscapeCore", "createWorkerJob", "validateWorkerJob",
    "executeWorkerJob", "geometryTransferables", "selectTerrainLOD"
  ]) assert.equal(typeof landscape[name], "function", `${name} must be exported`);
  for (const name of ["ProceduralLandscapeCore", "TerrainLODController", "GeometryBuildQueue"]) {
    assert.equal(typeof landscape[name], "function", `${name} must be exported`);
  }

  const sandbox = {};
  vm.runInNewContext(source, sandbox, { filename: "hh-eonwild-landscape-core.js" });
  assert.equal(sandbox.HHEonWildLandscapeCore.VERSION, landscape.VERSION);
  assert.equal(typeof sandbox.HHEonWildLandscapeCore.createLandscapeCore, "function");
  assert.doesNotMatch(source, /BABYLON|createElement|getContext\s*\(/, "landscape kernel must not create renderer or DOM objects");
});

test("noise fields, terrain samples and river networks are deterministic per complete world address", () => {
  const options = {
    seed: "DETERMINISTIC-EON-42",
    realmId: "mesozoic",
    timeSliceId: "cretaceous-laramidia",
    regionId: "late-cretaceous-floodplain"
  };
  const first = landscape.createLandscapeCore(options);
  const second = landscape.createLandscapeCore(options);
  const different = landscape.createLandscapeCore({ ...options, seed: "DETERMINISTIC-EON-43" });
  const points = [[0, 0], [128, 512], [4096.25, 8192.75], [16384, 16384], [9500, 2750]];

  for (const [x, z] of points) {
    assert.deepEqual(first.sample(x, z), second.sample(x, z));
    assert.equal(first.sampleHeight(x, z), second.sampleHeight(x, z));
  }
  assert.deepEqual(first.getRiverNetwork(), second.getRiverNetwork());
  assert.notDeepEqual(first.getRiverNetwork(), different.getRiverNetwork());
  assert.notEqual(first.sampleHeight(4096.25, 8192.75), different.sampleHeight(4096.25, 8192.75));
  assert.equal(landscape.noise2D(1.25, -3.5, 99), landscape.noise2D(1.25, -3.5, 99));
  assert.notEqual(landscape.noise2D(1.25, -3.5, 99), landscape.noise2D(1.25, -3.5, 100));
  first.dispose();
  second.dispose();
  different.dispose();
});

test("adjacent geometry chunks share exact edge heights and normals without cracks", () => {
  const core = landscape.createLandscapeCore({ seed: "NO-SEAM-2026", realmId: "modern", timeSliceId: "modern-land" });
  const resolution = 17;
  const left = core.buildChunkGeometry(23, 19, { lod: 2, resolution, includeNormals: true });
  const right = core.buildChunkGeometry(24, 19, { lod: 2, resolution, includeNormals: true });
  const top = core.buildChunkGeometry(23, 20, { lod: 2, resolution, includeNormals: true });

  for (let index = 0; index < resolution; index += 1) {
    assert.equal(heightAtVertex(left, resolution - 1, index), heightAtVertex(right, 0, index), `east/west height seam at row ${index}`);
    assert.deepEqual(normalAtVertex(left, resolution - 1, index), normalAtVertex(right, 0, index), `east/west normal seam at row ${index}`);
    assert.equal(heightAtVertex(left, index, resolution - 1), heightAtVertex(top, index, 0), `north/south height seam at column ${index}`);
    assert.deepEqual(normalAtVertex(left, index, resolution - 1), normalAtVertex(top, index, 0), `north/south normal seam at column ${index}`);
  }
  assert.equal(left.positions.length, resolution * resolution * 3);
  assert.equal(left.indices.length, (resolution - 1) ** 2 * 6);
  core.dispose();
});

test("global river polylines flow downhill, join tributaries and stay continuous across chunk boundaries", () => {
  const core = landscape.createLandscapeCore({ seed: "RIVER-BASIN-17", riverCount: 5 });
  const network = core.getRiverNetwork();
  assert.ok(network.length >= 5 && network.length <= landscape.LIMITS.MAX_RIVERS);
  const primaries = network.filter((river) => river.kind === "primary");
  const tributaries = network.filter((river) => river.kind === "tributary");
  assert.equal(primaries.length, 5);
  assert.ok(tributaries.length >= 2);

  for (const river of network) {
    assert.ok(river.points.length >= 12 && river.points.length <= landscape.LIMITS.MAX_RIVER_POINTS);
    for (let index = 1; index < river.points.length; index += 1) {
      const previous = river.points[index - 1];
      const current = river.points[index];
      assert.ok(current.bedHeight < previous.bedHeight, `${river.id} bed must descend at ${index}`);
      assert.ok(Math.hypot(current.x - previous.x, current.z - previous.z) > 0, `${river.id} cannot contain zero-length segments`);
      assert.ok(Math.abs(core.sampleHeight(current.x, current.z) - current.bedHeight) < 1e-8, `${river.id} carved centerline must match its bed`);
    }
    const midpoint = river.points[Math.floor(river.points.length / 2)];
    const query = core.queryRiverAt(midpoint.x, midpoint.z, 64);
    assert.equal(query.riverId, river.id);
    assert.equal(query.inChannel, true);
    assert.ok(query.downstream.bedHeight < query.bedHeight);
  }

  for (const tributary of tributaries) {
    const parent = network.find((river) => river.id === tributary.parentId);
    assert.ok(parent, `${tributary.id} needs a parent river`);
    const mouth = tributary.points.at(-1);
    const junction = parent.points.find((point) => Math.hypot(point.x - mouth.x, point.z - mouth.z) < 1e-8);
    assert.ok(junction, `${tributary.id} must end exactly on its parent centerline`);
    assert.ok(Math.abs(junction.bedHeight - mouth.bedHeight) < 1e-8);
    assert.equal(tributary.basinId, parent.basinId);
  }

  let sharedBoundarySegment = null;
  for (let z = 0; z < core.config.chunksPerAxis && !sharedBoundarySegment; z += 1) {
    for (let x = 0; x < core.config.chunksPerAxis - 1 && !sharedBoundarySegment; x += 1) {
      const leftIds = new Set(core.getRiversForChunk(x, z).map((segment) => segment.id));
      const shared = core.getRiversForChunk(x + 1, z).find((segment) => leftIds.has(segment.id));
      if (shared) sharedBoundarySegment = { segment: shared, leftChunkX: x, chunkZ: z };
    }
  }
  assert.ok(sharedBoundarySegment, "at least one immutable river segment must be shared across adjacent chunk descriptors");
  const midpoint = {
    x: (sharedBoundarySegment.segment.a.x + sharedBoundarySegment.segment.b.x) / 2,
    z: (sharedBoundarySegment.segment.a.z + sharedBoundarySegment.segment.b.z) / 2
  };
  const basin = core.queryRiverBasin(midpoint.x, midpoint.z);
  assert.equal(basin.basinId, sharedBoundarySegment.segment.basinId);
  assert.ok(basin.downstream.bedHeight < basin.elevation + 1e-7);
  core.dispose();
});

test("terrain samples expose bounded climate and normalized biome weights influenced by era and time slice", () => {
  const modern = landscape.createLandscapeCore({ seed: "BIOME-ATLAS", realmId: "modern", timeSliceId: "modern-land" });
  const carboniferous = landscape.createLandscapeCore({ seed: "BIOME-ATLAS", realmId: "paleozoic", timeSliceId: "carboniferous-swamp" });
  const glacial = landscape.createLandscapeCore({ seed: "BIOME-ATLAS", realmId: "ice-age", timeSliceId: "mammoth-steppe" });
  const coordinates = [[1024, 1024], [4096, 3072], [8192, 8192], [12288, 5376], [15360, 14000]];

  for (const core of [modern, carboniferous, glacial]) {
    for (const [x, z] of coordinates) {
      const sample = core.sample(x, z);
      assert.ok(Number.isFinite(sample.height));
      assert.ok(sample.slope >= 0 && sample.slope <= 1);
      assert.ok(sample.moisture >= 0 && sample.moisture <= 1);
      assert.ok(sample.temperature >= 0 && sample.temperature <= 1);
      assert.ok(sample.waterDistance >= 0);
      assert.ok(landscape.BIOME_IDS.includes(sample.primaryBiome));
      assert.equal(sample.biomeId, sample.primaryBiome);
      assert.equal(sample.biome, sample.primaryBiome);
      assert.equal(sample.heat, sample.temperature);
      assert.equal(sample.wetness, sample.moisture);
      assert.ok(Math.abs(sumWeights(sample.biomeWeights) - 1) < 1e-10);
      for (const biomeId of landscape.BIOME_IDS) {
        assert.ok(Number.isFinite(sample.biomeWeights[biomeId]));
        assert.ok(sample.biomeWeights[biomeId] >= 0 && sample.biomeWeights[biomeId] <= 1);
      }
    }
  }
  assert.notDeepEqual(modern.getBiomeWeights(8192, 8192), carboniferous.getBiomeWeights(8192, 8192));
  assert.notDeepEqual(modern.getBiomeWeights(8192, 8192), glacial.getBiomeWeights(8192, 8192));
  modern.dispose();
  carboniferous.dispose();
  glacial.dispose();
});

test("chunk descriptors bound cave and rock-shelter data and remain JSON serializable", () => {
  const core = landscape.createLandscapeCore({ seed: "CAVE-DESCRIPTORS", realmId: "mesozoic", timeSliceId: "jurassic-forest" });
  let shelterCount = 0;
  for (let z = 18; z < 23; z += 1) {
    for (let x = 18; x < 23; x += 1) {
      const descriptor = core.describeChunk(x, z, { lod: 1 });
      assert.equal(descriptor.estimatedVertices, landscape.LOD_PROFILES[1].resolution ** 2);
      assert.ok(descriptor.rivers.length <= landscape.LIMITS.MAX_RIVER_SEGMENTS_PER_CHUNK);
      assert.ok(descriptor.shelters.length <= landscape.LIMITS.MAX_SHELTERS_PER_CHUNK);
      assert.doesNotThrow(() => JSON.stringify(descriptor));
      for (const shelter of descriptor.shelters) {
        shelterCount += 1;
        assert.ok(["cave", "rock-shelter"].includes(shelter.type));
        assert.equal(shelter.proceduralDescriptorOnly, true);
        assert.ok(shelter.radius > 0 && shelter.depth > 0 && shelter.ceiling > 0);
        assert.ok(shelter.rainOcclusion >= 0 && shelter.rainOcclusion <= 1);
      }
    }
  }
  assert.ok(shelterCount > 0, "representative mountain chunks should expose at least one shelter descriptor");
  core.dispose();
});

test("terrain LOD uses hysteresis and bounded dither transitions instead of boundary flicker", () => {
  const controller = new landscape.TerrainLODController({
    thresholds: [100, 200, 400],
    hysteresis: 0.1,
    transitionMs: 300,
    maxEntries: 3
  });
  assert.equal(controller.update("main", 90, 0).lod, 0);
  assert.equal(controller.update("main", 105, 10).lod, 0, "distance inside outer hysteresis band must not downgrade");
  const downgrade = controller.update("main", 111, 20);
  assert.equal(downgrade.lod, 1);
  assert.equal(downgrade.fromLod, 0);
  assert.equal(downgrade.toLod, 1);
  assert.equal(downgrade.dithering, true);
  assert.equal(downgrade.progress, 0);
  assert.equal(controller.update("main", 95, 100).lod, 1, "distance inside inner hysteresis band must not upgrade");
  const completed = controller.update("main", 95, 350);
  assert.equal(completed.lod, 1);
  assert.equal(completed.completed, true);
  const upgrade = controller.update("main", 89, 400);
  assert.equal(upgrade.lod, 0);
  assert.equal(upgrade.dithering, true);
  assert.ok(upgrade.fromWeight >= 0 && upgrade.fromWeight <= 1);
  assert.ok(upgrade.toWeight >= 0 && upgrade.toWeight <= 1);

  controller.update("a", 50, 500);
  controller.update("b", 150, 500);
  controller.update("c", 250, 500);
  controller.update("d", 450, 500);
  assert.equal(controller.size, 3, "LOD state cache must evict beyond its configured bound");
  assert.equal(controller.dispose(), true);
  assert.equal(controller.size, 0);
  assert.equal(controller.dispose(), false);
  assert.throws(() => controller.update("after-dispose", 10, 600), /disposed/);
});

test("Worker jobs are validated, serializable, bounded and produce transferable renderer-neutral geometry", () => {
  const core = landscape.createLandscapeCore({ seed: "WORKER-GEOMETRY", realmId: "modern", timeSliceId: "modern-land" });
  const job = core.createWorkerJob({ chunkX: 12, chunkZ: 15, lod: 2, includeNormals: true, includeBiomeWeights: true, priority: 7 });
  const cloned = JSON.parse(JSON.stringify(job));
  const validation = landscape.validateWorkerJob(cloned);
  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.equal(validation.ok, true);
  assert.deepEqual(cloned, job);
  assert.equal(Object.values(job).some((value) => typeof value === "function"), false);
  assert.doesNotMatch(JSON.stringify(job), /BABYLON|WebGL|HTMLCanvas/i);

  const geometry = core.executeWorkerJob(cloned);
  const vertexCount = job.resolution ** 2;
  assert.equal(geometry.format, landscape.GEOMETRY_FORMAT);
  assert.equal(geometry.coordinateSpace, "chunk-centered");
  assert.equal(geometry.positions.length, vertexCount * 3);
  assert.equal(geometry.normals.length, vertexCount * 3);
  assert.equal(geometry.uvs.length, vertexCount * 2);
  assert.equal(geometry.biomeWeights.length, vertexCount * landscape.BIOME_IDS.length);
  assert.equal(geometry.indices.length, (job.resolution - 1) ** 2 * 6);
  assert.deepEqual(landscape.geometryTransferables(geometry), [
    geometry.positions.buffer,
    geometry.normals.buffer,
    geometry.uvs.buffer,
    geometry.biomeWeights.buffer,
    geometry.indices.buffer
  ]);

  const rendererStyleJob = core.createWorkerJob(12, 15, { segments: 48, includeNormals: true });
  assert.equal(rendererStyleJob.chunkX, 12);
  assert.equal(rendererStyleJob.chunkZ, 15);
  assert.equal(rendererStyleJob.resolution, 49, "renderer segment count must map to vertex resolution");
  assert.equal(rendererStyleJob.lod, 1);

  const independent = landscape.executeWorkerJob(cloned);
  assert.deepEqual(Array.from(independent.positions), Array.from(geometry.positions));
  assert.equal(landscape.validateWorkerJob({ ...cloned, chunkX: 9999 }).valid, false);
  assert.equal(landscape.validateWorkerJob({ ...cloned, resolution: landscape.LIMITS.MAX_GEOMETRY_RESOLUTION + 1 }).valid, false);
  assert.throws(() => core.buildChunkGeometry(0, 0, { resolution: landscape.LIMITS.MAX_GEOMETRY_RESOLUTION + 1 }), /resolution|allocation/i);
  core.dispose();
});

test("geometry queue enforces capacity, per-tick build budgets, priority replacement and disposal", () => {
  const core = landscape.createLandscapeCore({ seed: "QUEUE-BUDGET" });
  const queue = new landscape.GeometryBuildQueue({ maxQueued: 3, maxJobsPerTick: 2, budgetMs: 8 });
  const makeJob = (id, chunkX, priority = 0) => core.createWorkerJob({ id, chunkX, chunkZ: 4, lod: 3, resolution: 9, priority });
  assert.equal(queue.enqueue(makeJob("low", 1, -5)), true);
  assert.equal(queue.enqueue(makeJob("normal-a", 2, 0)), true);
  assert.equal(queue.enqueue(makeJob("normal-b", 3, 0)), true);
  assert.equal(queue.enqueue(makeJob("rejected-low", 4, -6)), false);
  assert.equal(queue.enqueue(makeJob("urgent", 5, 10)), true, "higher priority work may replace the lowest queued job");
  assert.equal(queue.size, 3);
  assert.equal(queue.enqueue(makeJob("urgent", 5, 10)), false, "duplicate job IDs must be deduplicated");

  let clock = 0;
  const firstTick = queue.process((job) => ({ id: job.id, resolution: job.resolution }), {
    maxJobs: 2,
    maxMilliseconds: 8,
    now: () => { const value = clock; clock += 1; return value; }
  });
  assert.equal(firstTick.built, 2);
  assert.equal(firstTick.failed, 0);
  assert.equal(firstTick.remaining, 1);
  assert.equal(firstTick.results[0].id, "urgent");
  assert.ok(firstTick.built <= landscape.LIMITS.MAX_BUILDS_PER_TICK);

  const secondTick = queue.process(() => { throw new Error("synthetic build failure"); }, { maxJobs: 8 });
  assert.equal(secondTick.built, 0);
  assert.equal(secondTick.failed, 1);
  assert.equal(queue.size, 0);
  assert.equal(queue.getStatus().failed, 1);
  assert.equal(queue.dispose(), true);
  assert.equal(queue.size, 0);
  assert.equal(queue.enqueue(makeJob("after-dispose", 6)), false);
  assert.equal(queue.dispose(), false);
  core.dispose();
});

test("core validates coordinates and releases all bounded indexes on idempotent disposal", () => {
  const core = new landscape.ProceduralLandscapeCore({ seed: "DISPOSE-LANDSCAPE", worldSize: 999999, chunkSize: 1, riverCount: 9999 });
  const status = core.getStatus();
  assert.ok(status.config.worldSize <= landscape.LIMITS.MAX_WORLD_SIZE);
  assert.ok(status.config.chunkSize >= landscape.LIMITS.MIN_CHUNK_SIZE);
  assert.ok(status.config.chunksPerAxis <= landscape.LIMITS.MAX_CHUNKS_PER_AXIS);
  assert.ok(status.rivers <= landscape.LIMITS.MAX_RIVERS);
  assert.ok(status.riverSegments <= landscape.LIMITS.MAX_RIVER_SEGMENTS);
  assert.throws(() => core.sample(Number.NaN, 10), /finite world coordinate/);
  assert.throws(() => core.describeChunk(-1, 0), /outside/);
  assert.equal(core.dispose(), true);
  const disposed = core.getStatus();
  assert.equal(disposed.disposed, true);
  assert.equal(disposed.rivers, 0);
  assert.equal(disposed.riverSegments, 0);
  assert.equal(disposed.riverIndexCells, 0);
  assert.equal(core.dispose(), false);
  assert.throws(() => core.sample(1, 1), /disposed/);
  assert.throws(() => core.getRiverNetwork(), /disposed/);

  const rendererAliases = landscape.createLandscapeCore({ seed: "ALIASES", waterLevel: -9, eraRealm: "ice-age", timeSlice: "mammoth-steppe" });
  assert.equal(rendererAliases.config.seaLevel, -9);
  assert.equal(rendererAliases.address.realmId, "ice-age");
  assert.equal(rendererAliases.address.timeSliceId, "mammoth-steppe");
  rendererAliases.dispose();
});
