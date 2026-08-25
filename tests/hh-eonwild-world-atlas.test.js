"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const atlas = require(path.join(__dirname, "..", "hh-eonwild-world-atlas.js"));

test("World Atlas exposes bounded, truthful geological and modern maps", () => {
  assert.equal(atlas.FORMAT, "hh-eonwild-world-atlas-v1");
  assert.equal(atlas.VALIDATION.valid, true, atlas.VALIDATION.errors.join("\n"));
  assert.equal(atlas.MAPS.length, 26);
  assert.deepEqual(new Set(atlas.MAPS.map((map) => map.realmId)), new Set(["paleozoic", "mesozoic", "ice-age", "modern", "convergence"]));
  assert.equal(atlas.getMap("eon-convergence").confidence, "fictional");
  assert.equal(atlas.getMap("eon-convergence").reconstruction, "fictional-sandbox");
  assert.equal(atlas.getMap("late-cretaceous").reconstruction, "source-indexed-reference");
  assert.equal(atlas.getMap("late-cretaceous").evidenceStatus, "reference-only-no-derived-tiles");
  assert.deepEqual(atlas.getMap("late-cretaceous").sourceIds, ["ics-chart", "earthbyte-gplates"]);
  assert.deepEqual(atlas.getMap("modern-pacific").sourceIds, ["natural-earth", "noaa-etopo-2022"]);
  assert.equal(atlas.getMap("late-cretaceous").rendererTimeSliceId, "cretaceous-laramidia");
  assert.equal(atlas.getMap("ordovician-oceans").gameplayStatus, "atlas-reference-only");
  assert.equal(atlas.getMap("ordovician-oceans").rendererTimeSliceId, null);
  assert.equal(Object.values(atlas.SOURCE_REGISTRY).every((source) => source.assetImported === false && source.url.startsWith("https://")), true);
  assert.ok(atlas.listMaps({ realmId: "modern" }).length >= 11);
  assert.ok(atlas.MAPS.filter((map) => map.confidence === "high").length >= 10);
});

test("planet addresses keep large logical coordinates outside renderer-local space", () => {
  const points = [
    { x: -40000000, y: -11000, z: -19000000, mapId: "modern-pacific" },
    { x: -1, y: 0, z: -1, mapId: "modern-asia" },
    { x: 0, y: 2210, z: 0, mapId: "late-cretaceous" },
    { x: 40000000, y: 8849, z: 19000000, mapId: "modern-asia" }
  ];
  points.forEach((point) => {
    const address = atlas.worldToAddress(point);
    const restored = atlas.addressToWorld(address);
    assert.ok(Math.abs(restored.x - point.x) < 0.001);
    assert.ok(Math.abs(restored.y - point.y) < 0.001);
    assert.ok(Math.abs(restored.z - point.z) < 0.001);
    assert.equal(restored.mapId, point.mapId);
  });
  const edge = atlas.normalizeAddress({ mapId: "modern-asia", localX: atlas.SECTOR_SIZE_METERS, localZ: Number.MAX_VALUE });
  assert.ok(edge.localX < atlas.SECTOR_SIZE_METERS);
  assert.ok(edge.localZ < atlas.SECTOR_SIZE_METERS);
  assert.equal(edge.localX, atlas.MAX_LOCAL_COORDINATE_METERS);

  for (const coordinate of [atlas.SECTOR_SIZE_METERS, -atlas.SECTOR_SIZE_METERS]) {
    const boundary = atlas.worldToAddress({ mapId: "modern-asia", x: coordinate, y: 0, z: coordinate });
    const expectedSector = coordinate > 0 ? 1 : -1;
    assert.equal(boundary.sectorX, expectedSector);
    assert.equal(boundary.sectorZ, expectedSector);
    assert.equal(boundary.localX, 0);
    assert.equal(boundary.localZ, 0);
    assert.deepEqual(atlas.addressToWorld(boundary), {
      x: coordinate,
      y: 0,
      z: coordinate,
      mapId: "modern-asia",
      regionId: boundary.regionId
    });
  }
});

test("floating origin rebases only after the configured threshold", () => {
  const origin = new atlas.FloatingOrigin({ thresholdM: 4096, snapM: 256 });
  assert.equal(origin.update({ x: 100, y: 0, z: 100 }).rebased, false);
  const result = origin.update({ x: 5000, y: 21, z: -5000 });
  assert.equal(result.rebased, true);
  assert.equal(result.sequence, 1);
  const local = origin.toLocal({ x: 5000, y: 21, z: -5000 });
  assert.ok(Math.abs(local.x) <= 128);
  assert.ok(Math.abs(local.z) <= 128);
  assert.deepEqual(origin.toWorld(local), { x: 5000, y: 21, z: -5000 });
});

test("chunk stream planning prioritizes the view direction and cancels stale work", () => {
  const planner = new atlas.ChunkStreamPlanner({ maximum: 32, chunkSizeM: 256 });
  const first = planner.plan({ mapId: "modern-africa", worldX: 0, worldZ: 0, directionX: 1, directionZ: 0, radius: 3 });
  assert.ok(first.wanted.length <= 32);
  assert.equal(first.load.length, first.wanted.length);
  assert.ok(first.wanted.find((row) => row.chunkX > 0).priority > first.wanted.find((row) => row.chunkX < 0).priority);
  const stale = "modern-africa:99:99";
  const second = planner.plan({ mapId: "modern-africa", worldX: 0, worldZ: 0, directionX: 1, directionZ: 0, radius: 3, loadedKeys: [first.wanted[0].key, stale] });
  assert.ok(second.retain.some((row) => row.key === first.wanted[0].key));
  assert.deepEqual(second.cancel, [stale]);
  assert.equal(second.generation, first.generation + 1);
});

test("atlas tile keys are normalized and cache payloads stay bounded", async () => {
  assert.equal(atlas.tileKey({ mapId: "modern-africa", layer: "height", zoom: 4, x: 2, y: 3 }), "modern-africa:height:4:2:3");
  assert.equal(atlas.tileKey({ mapId: "../../bad", layer: "script", zoom: 99, x: Infinity, y: -Infinity }), "modern-africa:biome:16:0:0");
  const cache = new atlas.AtlasTileCache({ indexedDB: null });
  assert.equal(await cache.get("missing"), null);
  assert.equal(await cache.put("missing", { safe: true }), false);
  assert.equal(cache.close(), true);
});

test("closing AtlasTileCache while IndexedDB opens cannot resurrect a leaked connection", async () => {
  let request;
  let closed = 0;
  const database = { close() { closed += 1; }, objectStoreNames: { contains: () => true } };
  const cache = new atlas.AtlasTileCache({
    indexedDB: { open() { request = { result: database, error: null, onupgradeneeded: null, onsuccess: null, onerror: null }; return request; } }
  });
  const pending = cache.open();
  assert.equal(cache.close(), true);
  request.onsuccess();
  assert.equal(await pending, null);
  assert.equal(closed, 1);
  assert.equal(cache.database, null);
  assert.equal(await cache.open(), null);
});
