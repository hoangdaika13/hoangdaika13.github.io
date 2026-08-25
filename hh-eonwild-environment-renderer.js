(function (root, factory) {
  "use strict";

  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHEonWildEnvironmentRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createHHEonWildEnvironmentRenderer(runtime) {
  "use strict";

  /*
   * Optional Babylon adapter for the renderer-agnostic EonWild landscape and
   * vegetation kernels. It deliberately performs no asset I/O and owns no
   * frame loop. A host supplies a scene and calls update; without a complete
   * Babylon thin-instance surface, the same deterministic chunk descriptors
   * remain available in fail-open descriptor mode.
   */
  const VERSION = "1.1.0";
  const FORMAT = "hh-eonwild-environment-renderer-v1";
  const MATRIX_STRIDE = 16;
  const ATTRIBUTE_STRIDE = 4;
  const MAX_SOURCES = 17;
  const TWO_PI = Math.PI * 2;
  const MAX_CHUNK_BUILDS_PER_UPDATE = 1;
  const COLLISION_SNAPSHOT_FORMAT = "hh-eonwild-environment-colliders-v1";
  const COLLIDER_CATEGORIES = Object.freeze(["mature-tree", "dead-tree", "sapling", "root", "log", "rock"]);
  const COLLIDER_CATEGORY_SET = new Set(COLLIDER_CATEGORIES);
  const DEFAULT_COLLIDER_RADIUS = 192;
  const MAX_COLLIDER_RADIUS = 384;
  const DEFAULT_COLLIDER_BUDGET = 384;
  const MAX_COLLIDERS_PER_SNAPSHOT = 512;
  const MAX_COLLIDER_SCAN_PLACEMENTS = 8192;
  const DEFAULT_COLLIDER_CELL_SIZE = 16;
  const DEFAULT_QUEUE_DIRECTION_RESET_RADIANS = Math.PI / 8;
  const LOD_DENSITY = Object.freeze([1, 0.78, 0.5, 0.24, 0]);
  const NATURAL_LIGHT_FLOOR = Object.freeze({ ambientFactor: 0.46, emissiveFactor: 0.34 });

  function optionalModule(globalName, path) {
    if (runtime && runtime[globalName]) return runtime[globalName];
    if (typeof require === "function") {
      try { return require(path); }
      catch (_) { /* Browser globals and descriptor fallback remain valid. */ }
    }
    return null;
  }

  const DEFAULT_VEGETATION = optionalModule("HHEonWildVegetation", "./hh-eonwild-vegetation-system.js");
  const DEFAULT_LANDSCAPE = optionalModule("HHEonWildLandscapeCore", "./hh-eonwild-landscape-core.js");

  const FALLBACK_TYPES = Object.freeze([
    ["grass-fine", "grass"], ["grass-tuft", "grass"], ["grass-tall", "grass"], ["grass-dry", "grass"],
    ["reed", "reed"], ["fern", "fern"], ["shrub-low", "shrub"], ["shrub-flowering", "shrub"],
    ["shrub-dry", "shrub"], ["sapling", "sapling"], ["tree-mature-deciduous", "mature-tree"],
    ["tree-mature-conifer", "mature-tree"], ["tree-dead", "dead-tree"], ["root-exposed", "root"],
    ["log-fallen", "log"], ["fungi-cluster", "fungi"], ["moss-patch", "moss"]
  ].map((entry) => Object.freeze({ id: entry[0], category: entry[1] })));

  const FALLBACK_BUDGETS = Object.freeze({
    static: Object.freeze({ id: "static", maxInstancesPerChunk: 64, maxActiveInstances: 3000, lodDistances: Object.freeze([18, 48, 90, 150]), ditherMeters: 3, hysteresisMeters: 4 }),
    light: Object.freeze({ id: "light", maxInstancesPerChunk: 128, maxActiveInstances: 7000, lodDistances: Object.freeze([26, 75, 150, 260]), ditherMeters: 5, hysteresisMeters: 6 }),
    balanced: Object.freeze({ id: "balanced", maxInstancesPerChunk: 280, maxActiveInstances: 18000, lodDistances: Object.freeze([36, 110, 240, 430]), ditherMeters: 7, hysteresisMeters: 8 }),
    high: Object.freeze({ id: "high", maxInstancesPerChunk: 480, maxActiveInstances: 34000, lodDistances: Object.freeze([52, 165, 360, 650]), ditherMeters: 10, hysteresisMeters: 12 }),
    ultra: Object.freeze({ id: "ultra", maxInstancesPerChunk: 760, maxActiveInstances: 58000, lodDistances: Object.freeze([70, 230, 510, 900]), ditherMeters: 14, hysteresisMeters: 16 }),
    cinematic: Object.freeze({ id: "cinematic", maxInstancesPerChunk: 1050, maxActiveInstances: 84000, lodDistances: Object.freeze([92, 310, 680, 1200]), ditherMeters: 18, hysteresisMeters: 20 }),
    personal: Object.freeze({ id: "personal", maxInstancesPerChunk: 1400, maxActiveInstances: 110000, lodDistances: Object.freeze([110, 380, 820, 1450]), ditherMeters: 22, hysteresisMeters: 24 })
  });
  const QUALITY_LIMITS = Object.freeze({
    static: Object.freeze({ maxChunks: 12, maxQueued: 18 }),
    light: Object.freeze({ maxChunks: 24, maxQueued: 32 }),
    balanced: Object.freeze({ maxChunks: 42, maxQueued: 54 }),
    high: Object.freeze({ maxChunks: 58, maxQueued: 72 }),
    ultra: Object.freeze({ maxChunks: 76, maxQueued: 92 }),
    cinematic: Object.freeze({ maxChunks: 92, maxQueued: 112 }),
    personal: Object.freeze({ maxChunks: 112, maxQueued: 128 })
  });
  const TYPE_WEIGHTS = Object.freeze({
    grass: 7, reed: 4, fern: 6, shrub: 5, sapling: 6, "mature-tree": 5,
    "dead-tree": 3, root: 3, log: 3, fungi: 4, moss: 4
  });
  const MATERIAL_PALETTES = Object.freeze({
    grass: Object.freeze({ color: "#477d36", group: "grass" }),
    reed: Object.freeze({ color: "#80933f", group: "wetland" }),
    fern: Object.freeze({ color: "#2d7144", group: "understory" }),
    shrub: Object.freeze({ color: "#386a35", group: "shrub" }),
    sapling: Object.freeze({ color: "#417637", group: "canopy" }),
    "mature-tree": Object.freeze({ color: "#315c31", group: "canopy" }),
    "dead-tree": Object.freeze({ color: "#755d42", group: "wood" }),
    root: Object.freeze({ color: "#664930", group: "wood" }),
    log: Object.freeze({ color: "#5d442e", group: "wood" }),
    fungi: Object.freeze({ color: "#9a6242", group: "fungi" }),
    moss: Object.freeze({ color: "#456839", group: "moss" })
  });

  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, finite(value, minimum)));
  const clamp01 = (value) => clamp(value, 0, 1);

  function hashText(value) {
    const text = String(value == null ? "HH-EONWILD-ENVIRONMENT" : value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 2246822507);
    return (hash ^ (hash >>> 13)) >>> 0;
  }

  function mix32(value) {
    let mixed = value >>> 0;
    mixed ^= mixed >>> 16;
    mixed = Math.imul(mixed, 2246822507);
    mixed ^= mixed >>> 13;
    mixed = Math.imul(mixed, 3266489909);
    return (mixed ^ (mixed >>> 16)) >>> 0;
  }

  function random01(seed, a, b, c) {
    let value = hashText(seed);
    value = mix32(value ^ Math.imul((a | 0) + 1, 374761393));
    value = mix32(value ^ Math.imul((b | 0) + 1, 668265263));
    value = mix32(value ^ Math.imul((c | 0) + 1, 2147483647));
    return value / 4294967296;
  }

  function safeColliderId(chunk, placement, index) {
    const chunkKey = String(chunk && chunk.key || "0:0").replace(/[^a-z0-9:._-]/gi, "").slice(0, 24) || "0:0";
    const sourceId = String(placement && placement.id || placement && placement.typeId || "placement")
      .replace(/[^a-z0-9:._-]/gi, "-").slice(0, 52) || "placement";
    return `env:${chunkKey}:${Math.max(0, Math.trunc(finite(index)))}:${sourceId}`.slice(0, 96);
  }

  function colliderDescriptor(chunk, placement, index, categoryOverride) {
    const category = String(categoryOverride || placement && placement.category || "").toLowerCase();
    if (!COLLIDER_CATEGORY_SET.has(category)) return null;
    const scale = clamp(placement.scale, 0.05, 20);
    const x = finite(placement.x);
    const y = finite(placement.y);
    const z = finite(placement.z);
    const rotationY = finite(placement.rotationY);
    const descriptor = {
      id: safeColliderId(chunk, placement, index),
      source: "procedural-environment",
      typeId: String(placement.typeId || category).slice(0, 64),
      category,
      type: category === "mature-tree" || category === "dead-tree" || category === "sapling" ? "tree" : category,
      x, y, z, scale, rotationY,
      minY: y,
      chunkKey: String(chunk && chunk.key || "")
    };
    if (category === "root" || category === "log") {
      const halfLength = (category === "log" ? 2.25 : 1.2) * scale;
      const halfWidth = 0.24 * scale;
      const cosine = Math.abs(Math.cos(rotationY));
      const sine = Math.abs(Math.sin(rotationY));
      const extentX = cosine * halfLength + sine * halfWidth;
      const extentZ = sine * halfLength + cosine * halfWidth;
      descriptor.shape = "aabb";
      descriptor.minX = x - extentX;
      descriptor.maxX = x + extentX;
      descriptor.minZ = z - extentZ;
      descriptor.maxZ = z + extentZ;
      descriptor.radius = Math.hypot(extentX, extentZ);
      descriptor.height = Math.max(0.24, 0.42 * scale);
    } else {
      const baseRadius = category === "mature-tree" ? 0.36 : category === "sapling" ? 0.225 : category === "dead-tree" ? 0.225 : 0.72;
      const baseHeight = category === "mature-tree" ? 7.5 : category === "sapling" ? 3.2 : category === "dead-tree" ? 5.6 : 1.35;
      descriptor.shape = "circle";
      descriptor.radius = Math.max(category === "sapling" ? 0.14 : 0.2, baseRadius * scale);
      descriptor.height = Math.max(0.35, baseHeight * scale);
    }
    descriptor.maxY = y + descriptor.height;
    return descriptor;
  }

  function colliderToken(collider) {
    const number = (value) => Math.round(finite(value) * 1000);
    return [
      collider.id, collider.category, collider.shape,
      number(collider.x), number(collider.y), number(collider.z),
      number(collider.radius), number(collider.height),
      number(collider.minX), number(collider.maxX), number(collider.minZ), number(collider.maxZ)
    ].join("|");
  }

  function normalizeQuality(moduleLike, input) {
    if (moduleLike && typeof moduleLike.normalizeQuality === "function") {
      try {
        const candidate = moduleLike.normalizeQuality(input);
        if (candidate && typeof candidate.id === "string" && Array.isArray(candidate.lodDistances) && candidate.lodDistances.length >= 4 && Number.isFinite(candidate.maxInstancesPerChunk) && Number.isFinite(candidate.maxActiveInstances)) return candidate;
      }
      catch (_) { /* Use immutable local budgets. */ }
    }
    const raw = String(input || "balanced").toLowerCase().replace(/[^a-z]/g, "");
    const aliases = { low: "light", medium: "balanced", default: "balanced", veryhigh: "ultra", film: "cinematic" };
    return FALLBACK_BUDGETS[raw] || FALLBACK_BUDGETS[aliases[raw]] || FALLBACK_BUDGETS.balanced;
  }

  function createFallbackLandscape(options) {
    const seed = options.seed || "HH-EONWILD-FALLBACK-LANDSCAPE";
    const worldSize = Math.round(clamp(options.worldSize || 16384, 2048, 65536));
    const chunkSize = Math.round(clamp(options.chunkSize || 256, 32, 1024));
    return {
      config: { worldSize, chunkSize, chunksPerAxis: Math.ceil(worldSize / chunkSize), seaLevel: -4 },
      sample(x, z) {
        const elevation = Math.sin((finite(x) + hashText(seed) % 997) * 0.0021) * 2.2 + Math.cos((finite(z) - hashText(seed) % 577) * 0.0017) * 1.7;
        return { height: elevation, slopeDegrees: 4, moisture: 0.48, waterDistance: 256, primaryBiome: "grassland", biomeId: "grassland", ridge: 0.1 };
      },
      dispose() { return true; }
    };
  }

  function createFallbackVegetation(options, types) {
    const seed = options.seed || "HH-EONWILD-FALLBACK-VEGETATION";
    const chunkSize = Math.round(clamp(options.chunkSize || 256, 32, 1024));
    const state = { wetness: 0, burn: 0, snow: 0, mud: 0 };
    let quality = normalizeQuality(null, options.quality);
    let paused = false;
    let disposed = false;
    return {
      get quality() { return quality; },
      planChunk(input) {
        const cx = Math.trunc(finite(input.cx));
        const cz = Math.trunc(finite(input.cz));
        const count = Math.min(Math.max(0, Math.trunc(finite(input.maxInstances, quality.maxInstancesPerChunk))), quality.maxInstancesPerChunk, 48);
        const placements = [];
        for (let index = 0; index < count; index += 1) {
          const x = cx * chunkSize + random01(seed, cx, cz, index * 5 + 1) * chunkSize;
          const z = cz * chunkSize + random01(seed, cx, cz, index * 5 + 2) * chunkSize;
          const terrain = typeof input.terrainSampler === "function" ? input.terrainSampler(x, z, {}) : { height: 0 };
          const type = types[Math.floor(random01(seed, cx, cz, index * 5 + 3) * types.length) % types.length];
          placements.push({
            id: `fallback-${cx}-${cz}-${index}-${type.id}`,
            typeId: type.id, category: type.category, x, y: finite(terrain && terrain.height), z,
            rotationY: random01(seed, cx, cz, index * 5 + 4) * TWO_PI,
            scale: 0.72 + random01(seed, cx, cz, index * 5 + 5) * 0.58,
            lodBias: 0, moisture: finite(terrain && terrain.moisture, 0.45)
          });
        }
        return { ok: true, seed: hashText(seed), biomeId: input.biomeId || "grassland", quality: quality.id, chunk: { cx, cz, size: chunkSize }, placements, stats: { attempts: count, accepted: count, rejected: 0 }, lodPlan: quality };
      },
      configure(patch) {
        if (patch.quality || patch.qualityPreset) quality = normalizeQuality(null, patch.quality || patch.qualityPreset);
        for (const key of ["wetness", "burn", "snow", "mud"]) if (patch[key] != null) state[key] = clamp01(patch[key]);
        return !disposed;
      },
      update(frame, out) {
        const target = out || {};
        target.status = disposed ? "disposed" : (paused ? "paused" : "running");
        target.paused = paused;
        target.timeSeconds = finite(frame.timeSeconds);
        target.wind = target.wind || { layers: [] };
        const phase = finite(frame.timeSeconds) * 0.7 + hashText(seed) * 0.00001;
        target.wind.x = Math.cos(phase) * 5;
        target.wind.z = Math.sin(phase) * 5;
        target.wind.speed = 5;
        target.wind.normalizedSpeed = 5 / 60;
        target.wind.bend = 0.14 + Math.sin(phase) * 0.06;
        target.wind.gust = 0;
        return target;
      },
      sampleStateInto(_x, _z, _now, out) {
        const target = out || {};
        target.wetness = state.wetness;
        target.burn = state.burn;
        target.snow = state.snow;
        target.mud = state.mud;
        target.compression = 0;
        target.health = 1 - state.burn * 0.88;
        target.activeInfluences = 0;
        return target;
      },
      disturb(input) { if (input && /fire|burn/.test(String(input.type))) state.burn = clamp01(input.strength == null ? 0.9 : input.strength); return disposed ? null : hashText(JSON.stringify(input || {})); },
      pause() { paused = true; return !disposed; },
      resume() { paused = false; return !disposed; },
      dispose() { if (disposed) return false; disposed = true; paused = true; return true; }
    };
  }

  function colorFromHex(BABYLON, hex) {
    if (!BABYLON || typeof BABYLON.Color3 !== "function") return null;
    try {
      if (typeof BABYLON.Color3.FromHexString === "function") return BABYLON.Color3.FromHexString(hex);
      const value = parseInt(String(hex).replace("#", ""), 16);
      return new BABYLON.Color3(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
    } catch (_) { return null; }
  }

  const PROCEDURAL_GROUND_CATEGORIES = Object.freeze(new Set(["grass", "reed", "fern", "shrub", "fungi", "moss"]));

  function pushVertex(positions, x, y, z) {
    positions.push(x, y, z);
    return positions.length / 3 - 1;
  }

  function pushTriangle(indices, a, b, c) { indices.push(a, b, c); }

  function addTaperedBlade(geometry, options) {
    const angle = finite(options.angle);
    const centerX = finite(options.x);
    const centerZ = finite(options.z);
    const width = Math.max(0.008, finite(options.width, 0.04));
    const height = Math.max(0.04, finite(options.height, 0.7));
    const lean = finite(options.lean, height * 0.12);
    const sideX = Math.cos(angle) * width;
    const sideZ = Math.sin(angle) * width;
    const forwardX = -Math.sin(angle);
    const forwardZ = Math.cos(angle);
    const midX = centerX + forwardX * lean * 0.38;
    const midZ = centerZ + forwardZ * lean * 0.38;
    const tipX = centerX + forwardX * lean;
    const tipZ = centerZ + forwardZ * lean;
    const baseLeft = pushVertex(geometry.positions, centerX - sideX, 0, centerZ - sideZ);
    const baseRight = pushVertex(geometry.positions, centerX + sideX, 0, centerZ + sideZ);
    const midLeft = pushVertex(geometry.positions, midX - sideX * 0.62, height * 0.58, midZ - sideZ * 0.62);
    const midRight = pushVertex(geometry.positions, midX + sideX * 0.62, height * 0.58, midZ + sideZ * 0.62);
    const tip = pushVertex(geometry.positions, tipX, height, tipZ);
    pushTriangle(geometry.indices, baseLeft, baseRight, midLeft);
    pushTriangle(geometry.indices, baseRight, midRight, midLeft);
    pushTriangle(geometry.indices, midLeft, midRight, tip);
  }

  function addFacetedCanopy(geometry, x, y, z, radiusX, radiusY, radiusZ, sides = 7) {
    const top = pushVertex(geometry.positions, x, y + radiusY, z);
    const bottom = pushVertex(geometry.positions, x, Math.max(0.025, y - radiusY * 0.82), z);
    const ring = [];
    for (let side = 0; side < sides; side += 1) {
      const angle = side / sides * TWO_PI;
      const irregularity = 0.86 + ((side * 37 + sides * 11) % 9) / 50;
      ring.push(pushVertex(geometry.positions, x + Math.cos(angle) * radiusX * irregularity, y, z + Math.sin(angle) * radiusZ * irregularity));
    }
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides;
      pushTriangle(geometry.indices, top, ring[next], ring[side]);
      pushTriangle(geometry.indices, bottom, ring[side], ring[next]);
    }
  }

  function addMushroom(geometry, x, z, scale, sides = 6) {
    const stemBottom = [];
    const stemTop = [];
    const stemHeight = 0.2 * scale;
    const stemRadius = 0.028 * scale;
    for (let side = 0; side < sides; side += 1) {
      const angle = side / sides * TWO_PI;
      stemBottom.push(pushVertex(geometry.positions, x + Math.cos(angle) * stemRadius, 0, z + Math.sin(angle) * stemRadius));
      stemTop.push(pushVertex(geometry.positions, x + Math.cos(angle) * stemRadius * 0.72, stemHeight, z + Math.sin(angle) * stemRadius * 0.72));
    }
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides;
      pushTriangle(geometry.indices, stemBottom[side], stemBottom[next], stemTop[side]);
      pushTriangle(geometry.indices, stemBottom[next], stemTop[next], stemTop[side]);
    }
    const capTop = pushVertex(geometry.positions, x, stemHeight + 0.095 * scale, z);
    const capRing = [];
    const capRadius = 0.13 * scale;
    for (let side = 0; side < sides; side += 1) {
      const angle = side / sides * TWO_PI;
      capRing.push(pushVertex(geometry.positions, x + Math.cos(angle) * capRadius, stemHeight, z + Math.sin(angle) * capRadius));
    }
    for (let side = 0; side < sides; side += 1) pushTriangle(geometry.indices, capTop, capRing[(side + 1) % sides], capRing[side]);
  }

  function computeNormals(positions, indices) {
    const normals = new Array(positions.length).fill(0);
    for (let index = 0; index < indices.length; index += 3) {
      const a = indices[index] * 3;
      const b = indices[index + 1] * 3;
      const c = indices[index + 2] * 3;
      const abX = positions[b] - positions[a];
      const abY = positions[b + 1] - positions[a + 1];
      const abZ = positions[b + 2] - positions[a + 2];
      const acX = positions[c] - positions[a];
      const acY = positions[c + 1] - positions[a + 1];
      const acZ = positions[c + 2] - positions[a + 2];
      const nx = abY * acZ - abZ * acY;
      const ny = abZ * acX - abX * acZ;
      const nz = abX * acY - abY * acX;
      for (const offset of [a, b, c]) { normals[offset] += nx; normals[offset + 1] += ny; normals[offset + 2] += nz; }
    }
    for (let offset = 0; offset < normals.length; offset += 3) {
      const length = Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2]) || 1;
      normals[offset] /= length; normals[offset + 1] /= length; normals[offset + 2] /= length;
    }
    return normals;
  }

  function createProceduralGroundGeometry(definition) {
    const geometry = { positions: [], indices: [], normals: [], uvs: [], kind: definition.category, baseHeight: 0 };
    const salt = hashText(definition.id);
    const category = definition.category;
    if (category === "grass" || category === "reed") {
      const isReed = category === "reed";
      const isTall = definition.id.includes("tall");
      const isTuft = definition.id.includes("tuft");
      const bladeCount = isReed ? 7 : (isTuft ? 9 : 7);
      for (let blade = 0; blade < bladeCount; blade += 1) {
        const angle = blade / bladeCount * TWO_PI + random01(salt, blade, 7, 1) * 0.48;
        const radius = random01(salt, blade, 7, 2) * (isReed ? 0.24 : 0.18);
        const height = (isReed ? 1.65 : (isTall ? 1.18 : 0.68)) * (0.78 + random01(salt, blade, 7, 3) * 0.38);
        addTaperedBlade(geometry, {
          angle,
          x: Math.cos(angle * 1.7) * radius,
          z: Math.sin(angle * 1.7) * radius,
          width: (isReed ? 0.028 : 0.035) * (0.72 + random01(salt, blade, 7, 4) * 0.5),
          height,
          lean: height * (0.06 + random01(salt, blade, 7, 5) * (isReed ? 0.08 : 0.2))
        });
        if (isReed && blade < 4) {
          const seedY = height * 0.82;
          addFacetedCanopy(geometry, Math.cos(angle) * radius * 0.6, seedY, Math.sin(angle) * radius * 0.6, 0.055, 0.16, 0.055, 5);
        }
      }
    } else if (category === "fern") {
      const fronds = 8;
      for (let frond = 0; frond < fronds; frond += 1) {
        const angle = frond / fronds * TWO_PI + random01(salt, frond, 11, 1) * 0.18;
        const length = 0.72 + random01(salt, frond, 11, 2) * 0.32;
        const sideX = -Math.sin(angle) * 0.12;
        const sideZ = Math.cos(angle) * 0.12;
        const directionX = Math.cos(angle);
        const directionZ = Math.sin(angle);
        const base = pushVertex(geometry.positions, 0, 0.08, 0);
        const left = pushVertex(geometry.positions, directionX * length * 0.42 + sideX, 0.32, directionZ * length * 0.42 + sideZ);
        const right = pushVertex(geometry.positions, directionX * length * 0.42 - sideX, 0.32, directionZ * length * 0.42 - sideZ);
        const shoulderLeft = pushVertex(geometry.positions, directionX * length * 0.72 + sideX * 0.45, 0.24, directionZ * length * 0.72 + sideZ * 0.45);
        const shoulderRight = pushVertex(geometry.positions, directionX * length * 0.72 - sideX * 0.45, 0.24, directionZ * length * 0.72 - sideZ * 0.45);
        const tip = pushVertex(geometry.positions, directionX * length, 0.12, directionZ * length);
        pushTriangle(geometry.indices, base, left, right);
        pushTriangle(geometry.indices, left, shoulderLeft, right);
        pushTriangle(geometry.indices, right, shoulderLeft, shoulderRight);
        pushTriangle(geometry.indices, shoulderLeft, tip, shoulderRight);
      }
    } else if (category === "shrub") {
      addFacetedCanopy(geometry, -0.3, 0.48, 0.02, 0.58, 0.46, 0.5, 7);
      addFacetedCanopy(geometry, 0.34, 0.4, 0.18, 0.5, 0.38, 0.44, 7);
      addFacetedCanopy(geometry, 0.08, 0.36, -0.38, 0.46, 0.34, 0.4, 7);
    } else if (category === "fungi") {
      addMushroom(geometry, -0.18, 0.06, 1.1, 6);
      addMushroom(geometry, 0.12, -0.1, 0.82, 6);
      addMushroom(geometry, 0.27, 0.16, 0.64, 5);
      addMushroom(geometry, -0.31, -0.19, 0.58, 5);
    } else if (category === "moss") {
      const center = pushVertex(geometry.positions, 0, 0.035, 0);
      const points = 12;
      const ring = [];
      for (let point = 0; point < points; point += 1) {
        const angle = point / points * TWO_PI;
        const radius = 0.55 + random01(salt, point, 19, 1) * 0.34;
        ring.push(pushVertex(geometry.positions, Math.cos(angle) * radius, 0.018 + random01(salt, point, 19, 2) * 0.045, Math.sin(angle) * radius * (0.7 + random01(salt, point, 19, 3) * 0.24)));
      }
      for (let point = 0; point < points; point += 1) pushTriangle(geometry.indices, center, ring[(point + 1) % points], ring[point]);
    } else return null;
    geometry.normals = computeNormals(geometry.positions, geometry.indices);
    geometry.uvs = new Array(geometry.positions.length / 3 * 2).fill(0);
    return geometry;
  }

  function createProceduralGroundMesh(BABYLON, scene, name, definition) {
    if (!BABYLON || typeof BABYLON.Mesh !== "function" || typeof BABYLON.VertexData !== "function") return null;
    const geometry = createProceduralGroundGeometry(definition);
    if (!geometry || geometry.positions.length < 9 || geometry.indices.length < 3) return null;
    let mesh = null;
    try {
      mesh = new BABYLON.Mesh(name, scene);
      const vertexData = new BABYLON.VertexData();
      vertexData.positions = geometry.positions;
      vertexData.indices = geometry.indices;
      vertexData.normals = geometry.normals;
      vertexData.uvs = geometry.uvs;
      vertexData.applyToMesh(mesh, false);
      mesh.metadata = mesh.metadata && typeof mesh.metadata === "object" ? mesh.metadata : {};
      mesh.metadata.hhEonWildGeometry = {
        kind: geometry.kind,
        vertexCount: geometry.positions.length / 3,
        triangleCount: geometry.indices.length / 3,
        opaqueSilhouette: true,
        alphaCard: false
      };
      return mesh;
    } catch (_) {
      try { mesh?.dispose?.(); } catch (_) { /* Fail open. */ }
      return null;
    }
  }

  function categoryShape(category) {
    if (category === "mature-tree" || category === "dead-tree" || category === "sapling") return "cylinder";
    if (category === "root" || category === "log") return "box";
    if (PROCEDURAL_GROUND_CATEGORIES.has(category)) return "procedural-ground";
    return "unsupported";
  }

  function createSourceMesh(BABYLON, scene, definition, index) {
    const builders = BABYLON && BABYLON.MeshBuilder;
    if (!builders) return null;
    const name = `hh-eonwild-vegetation-source-${index}-${definition.id}`;
    const shape = categoryShape(definition.category);
    let mesh = null;
    let baseHeight = 1;
    try {
      if (shape === "procedural-ground") {
        baseHeight = 0;
        mesh = createProceduralGroundMesh(BABYLON, scene, name, definition);
      } else if (shape === "cylinder" && typeof builders.CreateCylinder === "function") {
        const height = definition.category === "mature-tree" ? 7.5 : (definition.category === "sapling" ? 3.2 : 5.6);
        baseHeight = height;
        mesh = builders.CreateCylinder(name, { height, diameterTop: 0.18, diameterBottom: definition.category === "mature-tree" ? 0.72 : 0.45, tessellation: 7 }, scene);
        if ((definition.category === "mature-tree" || definition.category === "sapling") && typeof builders.CreateSphere === "function" && typeof BABYLON.Mesh?.MergeMeshes === "function") {
          const crowns = [];
          try {
            mesh.position.y = height * 0.5;
            const crownSize = definition.category === "mature-tree" ? 4.8 : 2.15;
            const crownA = builders.CreateSphere(`${name}-crown-a`, { diameter: crownSize, segments: 6 }, scene);
            crownA.position.y = height * 0.82;
            crownA.scaling.y = definition.id.includes("conifer") ? 1.35 : 0.78;
            crowns.push(crownA);
            const crownB = builders.CreateSphere(`${name}-crown-b`, { diameter: crownSize * 0.72, segments: 6 }, scene);
            crownB.position.y = height * 1.08;
            crownB.position.x = crownSize * 0.16;
            crownB.scaling.y = definition.id.includes("conifer") ? 1.18 : 0.72;
            crowns.push(crownB);
            const merged = BABYLON.Mesh.MergeMeshes([mesh, ...crowns], true, true, undefined, false, true);
            if (merged) { mesh = merged; baseHeight = 0; }
          } catch (_) {
            for (const crown of crowns) { try { crown.dispose?.(); } catch (_) {} }
            if (mesh?.position) mesh.position.y = 0;
          }
        }
      } else if (shape === "box" && typeof builders.CreateBox === "function") {
        baseHeight = 0.42;
        mesh = builders.CreateBox(name, { width: definition.category === "log" ? 4.5 : 2.4, height: 0.42, depth: 0.48 }, scene);
      }
    } catch (_) { mesh = null; }
    if (!mesh || typeof mesh.thinInstanceSetBuffer !== "function") {
      try { if (mesh && typeof mesh.dispose === "function") mesh.dispose(); }
      catch (_) { /* Fail open. */ }
      return null;
    }
    mesh.isPickable = false;
    if (mesh.position) {
      mesh.position.y = baseHeight * 0.5;
      if (typeof mesh.bakeCurrentTransformIntoVertices === "function") {
        try { mesh.bakeCurrentTransformIntoVertices(); mesh.position.y = 0; }
        catch (_) { /* Keeping the shared source offset is an equivalent fallback. */ }
      }
    }
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.thinInstanceCount = 0;
    mesh.metadata = mesh.metadata && typeof mesh.metadata === "object" ? mesh.metadata : {};
    mesh.metadata.hhEonWild = {
      sourceOnly: true, typeId: definition.id, category: definition.category,
      lod: { levels: 4, hysteresis: true, dither: true },
      wind: { time: 0, x: 0, z: 0, bend: 0, gust: 0 },
      environment: { wetness: 0, burn: 0, snow: 0, mud: 0 }
    };
    return mesh;
  }

  function writeMatrix(buffer, offset, placement, renderOffsetX = 0, renderOffsetZ = 0, visual = null) {
    const scale = clamp(placement.scale, 0.05, 20);
    const compression = clamp01(visual && visual.compression);
    const horizontalScale = scale * (1 + compression * 0.07);
    const verticalScale = scale * (1 - compression * 0.58);
    const angle = finite(placement.rotationY);
    const cosine = Math.cos(angle) * horizontalScale;
    const sine = Math.sin(angle) * horizontalScale;
    const phase = finite(visual && visual.phase);
    const bend = clamp01(visual && visual.bend);
    const gust = clamp01(visual && visual.gust);
    const flexibility = clamp(visual && visual.flexibility, 0, 1);
    const sway = visual && visual.reducedMotion ? 0 : Math.sin(finite(visual && visual.time) * 1.37 + phase) * (bend * 0.16 + gust * 0.09) * flexibility;
    const leanX = finite(visual && visual.directionX, 1) * sway * verticalScale;
    const leanZ = finite(visual && visual.directionZ, 0) * sway * verticalScale;
    buffer[offset] = cosine; buffer[offset + 1] = 0; buffer[offset + 2] = -sine; buffer[offset + 3] = 0;
    buffer[offset + 4] = leanX; buffer[offset + 5] = verticalScale; buffer[offset + 6] = leanZ; buffer[offset + 7] = 0;
    buffer[offset + 8] = sine; buffer[offset + 9] = 0; buffer[offset + 10] = cosine; buffer[offset + 11] = 0;
    buffer[offset + 12] = finite(placement.x) + renderOffsetX; buffer[offset + 13] = finite(placement.y); buffer[offset + 14] = finite(placement.z) + renderOffsetZ; buffer[offset + 15] = 1;
  }

  function createLodEvaluator(quality) {
    return function evaluate(distance, previousLod, out) {
      const thresholds = quality.lodDistances;
      let lod = distance <= thresholds[0] ? 0 : distance <= thresholds[1] ? 1 : distance <= thresholds[2] ? 2 : distance <= thresholds[3] ? 3 : 4;
      const previous = Number.isInteger(previousLod) ? clamp(previousLod, 0, 4) : lod;
      if (lod > previous && previous < 4 && distance <= thresholds[previous] + quality.hysteresisMeters) lod = previous;
      else if (lod < previous && previous > 0 && distance >= thresholds[previous - 1] - quality.hysteresisMeters) lod = previous;
      let transitionIndex = -1;
      let nearest = Infinity;
      for (let index = 0; index < thresholds.length; index += 1) {
        const delta = Math.abs(distance - thresholds[index]);
        if (delta < nearest) { nearest = delta; transitionIndex = index; }
      }
      if (nearest > quality.ditherMeters * 0.5) transitionIndex = -1;
      const dither = transitionIndex < 0 ? 0 : clamp01((distance - (thresholds[transitionIndex] - quality.ditherMeters * 0.5)) / quality.ditherMeters);
      const target = out || {};
      target.lod = lod;
      target.nextLod = Math.min(4, lod + 1);
      target.visible = lod < 4;
      target.dither = dither;
      target.transitionIndex = transitionIndex;
      return target;
    };
  }

  class ProceduralVegetationRenderer {
    constructor(options = {}) {
      this.version = VERSION;
      this.format = FORMAT;
      this.seed = options.seed == null ? "HH-EONWILD-ENVIRONMENT-541" : options.seed;
      this.vegetationModule = options.vegetationModule || DEFAULT_VEGETATION;
      this.landscapeModule = options.landscapeModule || DEFAULT_LANDSCAPE;
      const moduleTypes = this.vegetationModule && this.vegetationModule.VEGETATION_TYPES;
      this.types = (Array.isArray(moduleTypes) && moduleTypes.length ? moduleTypes : FALLBACK_TYPES).slice(0, MAX_SOURCES);
      this.quality = normalizeQuality(this.vegetationModule, options.quality || options.qualityPreset);
      const suppliedLandscape = options.landscape || options.landscapeCore;
      const suppliedVegetation = options.vegetationSystem || options.vegetation;
      this._ownedLandscape = !suppliedLandscape;
      this._ownedVegetation = !suppliedVegetation;
      this.landscape = suppliedLandscape || this._createLandscape(options);
      this.chunkSize = Math.round(clamp(options.chunkSize || (this.landscape && this.landscape.config && this.landscape.config.chunkSize) || 256, 32, 1024));
      this.vegetation = suppliedVegetation || this._createVegetation(options);
      this.scene = options.scene || null;
      this.BABYLON = options.BABYLON || options.Babylon || options.babylon || (runtime && runtime.BABYLON) || null;
      this.mode = "descriptor";
      this.paused = false;
      this.pauseReason = "";
      this.disposed = false;
      this.timeSeconds = 0;
      this.playerX = finite(options.playerX, (this.landscape && this.landscape.config && this.landscape.config.worldSize || 16384) * 0.5);
      this.playerZ = finite(options.playerZ, (this.landscape && this.landscape.config && this.landscape.config.worldSize || 16384) * 0.5);
      this.renderOffsetX = finite(options.renderOffsetX, 0);
      this.renderOffsetZ = finite(options.renderOffsetZ, 0);
      this.forwardX = 0;
      this.forwardZ = 1;
      this.fovRadians = clamp(options.fovRadians == null ? Math.PI * 0.7 : options.fovRadians, Math.PI / 6, Math.PI * 1.9);
      this.reducedMotion = Boolean(options.reducedMotion);
      this.environment = { wetness: clamp01(options.wetness), burn: clamp01(options.burn), snow: clamp01(options.snow), mud: clamp01(options.mud) };
      this.chunks = new Map();
      this.queue = [];
      this.queuedKeys = new Set();
      this._desiredKeys = new Set();
      this._candidates = [];
      this._candidatePool = [];
      this._sortedChunks = [];
      this._freeQueueJobs = [];
      this._sourceMeshes = [];
      this._materials = [];
      this._materialByGroup = new Map();
      this._buckets = [];
      this._bucketByType = new Map();
      this._systemFrame = { timeSeconds: 0, deltaSeconds: 0, cameraX: 0, cameraZ: 0 };
      this._runtimeFrame = this.vegetationModule && typeof this.vegetationModule.createRuntimeFrame === "function" ? this.vegetationModule.createRuntimeFrame() : { wind: { layers: [] } };
      this._stateSample = this.vegetationModule && typeof this.vegetationModule.createVegetationStateSample === "function" ? this.vegetationModule.createVegetationStateSample() : { compression: 0, wetness: 0, burn: 0, snow: 0, mud: 0, health: 1 };
      this._matrixVisual = { compression: 0, phase: 0, bend: 0, gust: 0, flexibility: 1, directionX: 1, directionZ: 0, time: 0, reducedMotion: false };
      this._envPatch = { wetness: 0, burn: 0, snow: 0, mud: 0 };
      this._frameResult = {
        status: "idle", mode: "descriptor", buildsThisUpdate: 0, builtChunk: null,
        buildBudget: { limit: MAX_CHUNK_BUILDS_PER_UPDATE, used: 0, remaining: MAX_CHUNK_BUILDS_PER_UPDATE, deferred: 0 },
        telemetry: {}
      };
      this._buffersDirty = true;
      this._stateDirty = true;
      this._descriptorDigest = "00000000";
      this.collisionRadius = clamp(options.collisionRadius == null ? DEFAULT_COLLIDER_RADIUS : options.collisionRadius, 24, MAX_COLLIDER_RADIUS);
      this.maxCollisionColliders = Math.round(clamp(options.maxCollisionColliders == null ? DEFAULT_COLLIDER_BUDGET : options.maxCollisionColliders, 1, MAX_COLLIDERS_PER_SNAPSHOT));
      this.collisionCellSize = Math.round(clamp(options.collisionCellSize == null ? DEFAULT_COLLIDER_CELL_SIZE : options.collisionCellSize, 8, 64));
      this._renderedColliderIds = new Set();
      this._nextRenderedColliderIds = new Set();
      this._collisionChunkScratch = [];
      this._collisionCandidateScratch = [];
      this._collisionDigest = "0:00000000:00000000";
      this._collisionRevision = 0;
      this._collisionSnapshotCacheKey = "";
      this._collisionSnapshot = Object.freeze({
        supported: true,
        format: COLLISION_SNAPSHOT_FORMAT,
        mode: "descriptor",
        cellKey: "",
        revision: 0,
        digest: this._collisionDigest,
        center: Object.freeze({ x: this.playerX, z: this.playerZ }),
        radius: this.collisionRadius,
        coverageRadius: this.collisionRadius,
        budget: this.maxCollisionColliders,
        count: 0,
        tracked: 0,
        scanned: 0,
        truncated: false,
        colliders: Object.freeze([])
      });
      this._activeInstances = 0;
      this._renderedInstances = 0;
      this._droppedInstances = 0;
      this._chunkBuilds = 0;
      this._chunkPlanCalls = 0;
      this._lastBuiltChunk = "";
      this._lastPlayerChunk = "";
      this._queueRevision = 1;
      this._queueDirectionReady = false;
      this._queueForwardX = 0;
      this._queueForwardZ = 1;
      this._queueDirectionResetCosine = Math.cos(clamp(options.queueDirectionResetRadians == null ? DEFAULT_QUEUE_DIRECTION_RESET_RADIANS : options.queueDirectionResetRadians, Math.PI / 18, Math.PI * 0.75));
      this._queueDirectionInvalidations = 0;
      this._staleQueuedChunksDiscarded = 0;
      this._staleQueuedChunksDiscardedThisUpdate = 0;
      this._staleDirectionChunksDiscarded = 0;
      this._staleVisibilityChunksDiscarded = 0;
      this._queueHighWaterMark = 0;
      this._queueJobAllocations = 0;
      this._desiredUnqueuedChunks = 0;
      this._buildBudgetUsedThisUpdate = 0;
      this._buildBudgetDeferredThisUpdate = 0;
      this._nextInteractionBufferAt = 0;
      this._configureBudget(options);
      this._terrainSampler = (x, z, out) => this._sampleTerrain(x, z, out);
      this._initializeRendering();
      this._allocateBuckets();
    }

    _createLandscape(options) {
      if (this.landscapeModule && typeof this.landscapeModule.createLandscapeCore === "function") {
        try { return this.landscapeModule.createLandscapeCore({ ...options, seed: this.seed }); }
        catch (_) { /* Deterministic fallback below. */ }
      }
      return createFallbackLandscape({ ...options, seed: this.seed });
    }

    _createVegetation(options) {
      if (this.vegetationModule && typeof this.vegetationModule.create === "function") {
        try { return this.vegetationModule.create({ ...options, seed: this.seed, chunkSize: this.chunkSize, quality: this.quality.id, bindVisibility: false }); }
        catch (_) { /* Deterministic fallback below. */ }
      }
      return createFallbackVegetation({ ...options, seed: this.seed, chunkSize: this.chunkSize, quality: this.quality.id }, this.types);
    }

    _configureBudget(options) {
      const limits = QUALITY_LIMITS[this.quality.id] || QUALITY_LIMITS.balanced;
      this.maxActiveInstances = Math.round(clamp(options.maxActiveInstances == null ? this.quality.maxActiveInstances : options.maxActiveInstances, this.types.length, this.quality.maxActiveInstances));
      this.maxInstancesPerChunk = Math.round(clamp(options.maxInstancesPerChunk == null ? this.quality.maxInstancesPerChunk : options.maxInstancesPerChunk, 1, this.quality.maxInstancesPerChunk));
      this.maxActiveChunks = Math.round(clamp(options.maxActiveChunks == null ? limits.maxChunks : options.maxActiveChunks, 1, limits.maxChunks));
      this.maxQueuedChunks = Math.round(clamp(options.maxQueuedChunks == null ? limits.maxQueued : options.maxQueuedChunks, 1, limits.maxQueued));
      this.viewDistance = clamp(options.viewDistance == null ? this.quality.lodDistances[3] : options.viewDistance, this.chunkSize * 0.55, this.quality.lodDistances[3]);
      this.frustumCulling = options.frustumCulling !== false;
      this.nearOmnidirectionalDistance = clamp(options.nearOmnidirectionalDistance == null ? this.chunkSize * 1.45 : options.nearOmnidirectionalDistance, this.chunkSize * 0.5, this.viewDistance);
      this._lodEvaluate = createLodEvaluator(this.quality);
    }

    _initializeRendering() {
      if (!this.scene || !this.BABYLON || !this.BABYLON.MeshBuilder) return;
      const createdMeshes = [];
      try {
        for (let index = 0; index < this.types.length; index += 1) {
          const definition = this.types[index];
          const mesh = createSourceMesh(this.BABYLON, this.scene, definition, index);
          if (!mesh) throw new Error("Thin instances unavailable");
          const palette = MATERIAL_PALETTES[definition.category] || MATERIAL_PALETTES.grass;
          let material = this._materialByGroup.get(palette.group) || null;
          if (!material && typeof this.BABYLON.StandardMaterial === "function") {
            material = new this.BABYLON.StandardMaterial(`hh-eonwild-vegetation-${palette.group}`, this.scene);
            const color = colorFromHex(this.BABYLON, palette.color);
            if (color) material.diffuseColor = color;
            // Preserve directional shading but provide a restrained light
            // floor while the optional HDR environment is still loading.
            if (color && "emissiveColor" in material) {
              material.emissiveColor = new this.BABYLON.Color3(color.r * NATURAL_LIGHT_FLOOR.emissiveFactor, color.g * NATURAL_LIGHT_FLOOR.emissiveFactor, color.b * NATURAL_LIGHT_FLOOR.emissiveFactor);
            }
            if (color && "ambientColor" in material) material.ambientColor = new this.BABYLON.Color3(color.r * NATURAL_LIGHT_FLOOR.ambientFactor, color.g * NATURAL_LIGHT_FLOOR.ambientFactor, color.b * NATURAL_LIGHT_FLOOR.ambientFactor);
            material.backFaceCulling = false;
            material.alpha = 1;
            material.useAlphaFromDiffuseTexture = false;
            if (this.BABYLON.Material && Number.isFinite(this.BABYLON.Material.MATERIAL_OPAQUE)) material.transparencyMode = this.BABYLON.Material.MATERIAL_OPAQUE;
            material.specularPower = 18;
            material.metadata = { hhEonWildShared: true, environment: { wetness: 0, burn: 0, snow: 0, mud: 0 } };
            if (color) material.metadata.baseColor = [finite(color.r), finite(color.g), finite(color.b)];
            this._materialByGroup.set(palette.group, material);
            this._materials.push(material);
          }
          if (material) mesh.material = material;
          createdMeshes.push(mesh);
        }
        this._sourceMeshes = createdMeshes;
        this.mode = "babylon-thin-instances";
      } catch (_) {
        for (const mesh of createdMeshes) {
          try { if (mesh && typeof mesh.dispose === "function") mesh.dispose(); }
          catch (_) { /* Fail open. */ }
        }
        for (const material of this._materials) {
          try { if (material && typeof material.dispose === "function") material.dispose(); }
          catch (_) { /* Fail open. */ }
        }
        this._sourceMeshes = [];
        this._materials = [];
        this._materialByGroup.clear();
        this.mode = "descriptor";
      }
    }

    _failOpenRendering() {
      if (this.mode === "descriptor" && !this._sourceMeshes.length && !this._materials.length) return false;
      for (const bucket of this._buckets) {
        if (!bucket.mesh) continue;
        try { bucket.mesh.thinInstanceCount = 0; } catch (_) { /* Disposal below is authoritative. */ }
        try { if (typeof bucket.mesh.dispose === "function") bucket.mesh.dispose(); } catch (_) { /* Continue cleanup. */ }
        bucket.mesh = null;
      }
      for (const mesh of this._sourceMeshes) {
        try { if (mesh && typeof mesh.dispose === "function" && !mesh.disposed) mesh.dispose(); } catch (_) { /* Continue cleanup. */ }
      }
      for (const material of this._materials) {
        try { if (material && typeof material.dispose === "function") material.dispose(); } catch (_) { /* Continue cleanup. */ }
      }
      this._sourceMeshes.length = 0;
      this._materials.length = 0;
      this._materialByGroup.clear();
      this.mode = "descriptor";
      return true;
    }

    _capacityPlan() {
      let weightTotal = 0;
      const weights = new Array(this.types.length);
      for (let index = 0; index < this.types.length; index += 1) {
        const weight = TYPE_WEIGHTS[this.types[index].category] || 3;
        weights[index] = weight;
        weightTotal += weight;
      }
      const capacities = new Int32Array(this.types.length);
      let assigned = 0;
      for (let index = 0; index < capacities.length; index += 1) {
        capacities[index] = Math.max(1, Math.floor(this.maxActiveInstances * weights[index] / weightTotal));
        assigned += capacities[index];
      }
      for (let index = 0; assigned < this.maxActiveInstances; index = (index + 1) % capacities.length) { capacities[index] += 1; assigned += 1; }
      for (let index = capacities.length - 1; assigned > this.maxActiveInstances && index >= 0; index -= 1) {
        const reduction = Math.min(capacities[index] - 1, assigned - this.maxActiveInstances);
        capacities[index] -= reduction;
        assigned -= reduction;
      }
      return capacities;
    }

    _allocateBuckets() {
      const capacities = this._capacityPlan();
      this._buckets = new Array(this.types.length);
      this._bucketByType.clear();
      for (let index = 0; index < this.types.length; index += 1) {
        const capacity = capacities[index];
        const bucket = {
          definition: this.types[index], mesh: this._sourceMeshes[index] || null, capacity, count: 0,
          matrices: new Float32Array(capacity * MATRIX_STRIDE),
          lodData: new Float32Array(capacity * ATTRIBUTE_STRIDE),
          stateData: new Float32Array(capacity * ATTRIBUTE_STRIDE),
          windData: new Float32Array(capacity * ATTRIBUTE_STRIDE)
        };
        this._buckets[index] = bucket;
        this._bucketByType.set(bucket.definition.id, bucket);
      }
      this._buffersDirty = true;
    }

    _sampleTerrain(x, z, out) {
      const target = out || {};
      let sample = null;
      try { sample = this.landscape && typeof this.landscape.sample === "function" ? this.landscape.sample(x, z) : null; }
      catch (_) { sample = null; }
      const seaLevel = finite(this.landscape && this.landscape.config && this.landscape.config.seaLevel, -4);
      const height = finite(sample && sample.height, 0);
      target.height = height;
      target.slopeDegrees = clamp(sample && (sample.slopeDegrees == null ? finite(sample.slope) * 90 : sample.slopeDegrees), 0, 90);
      target.waterDepth = height <= seaLevel ? Math.max(0.01, seaLevel - height) : 0;
      target.distanceToWater = sample && sample.waterDistance != null ? Math.max(0, finite(sample.waterDistance)) : Infinity;
      target.rockMask = clamp01(sample && sample.rockMask != null ? sample.rockMask : (sample && sample.ridge != null ? finite(sample.ridge) * 0.35 : 0));
      target.rockDistance = target.rockMask > 0.72 ? 0.1 : Infinity;
      target.moisture = clamp01(sample && (sample.moisture == null ? sample.wetness : sample.moisture));
      target.valid = Number.isFinite(height);
      return target;
    }

    _chunkKey(cx, cz) { return `${cx}:${cz}`; }

    _chunkSurfaceDistance(centerX, centerZ) {
      return Math.max(0, Math.hypot(centerX - this.playerX, centerZ - this.playerZ) - this.chunkSize * Math.SQRT1_2);
    }

    _candidateScore(key, distance, facing, hasForward) {
      const surfaceDistance = Math.max(0, distance - this.chunkSize * Math.SQRT1_2);
      const distanceRatio = clamp01(distance / Math.max(this.chunkSize, this.viewDistance));
      const directionPenalty = hasForward
        ? (1 - clamp(facing, -1, 1)) * this.chunkSize * (0.58 + distanceRatio * 0.34)
        : 0;
      const retentionBonus = this.chunks.has(key)
        ? this.chunkSize * 0.12
        : (this.queuedKeys.has(key) ? this.chunkSize * 0.04 : 0);
      // Quantization prevents sub-millimetre camera jitter from shuffling jobs;
      // chunk coordinates remain the deterministic final tie breaker.
      return Math.round((surfaceDistance + directionPenalty - retentionBonus) * 256) / 256;
    }

    _acquireQueueJob(candidate) {
      let job = this._freeQueueJobs.pop();
      if (!job) {
        job = {};
        this._queueJobAllocations += 1;
      }
      job.cx = candidate.cx;
      job.cz = candidate.cz;
      job.key = candidate.key;
      job.distance = candidate.distance;
      job.facing = candidate.facing;
      job.score = candidate.score;
      job.revision = this._queueRevision;
      return job;
    }

    _releaseQueueJob(job) {
      if (!job) return;
      job.key = "";
      job.revision = 0;
      if (this._freeQueueJobs.length < this.maxQueuedChunks) this._freeQueueJobs.push(job);
    }

    _recordStaleQueueDiscard(count, reason) {
      const discarded = Math.max(0, Math.trunc(finite(count)));
      if (!discarded) return;
      this._staleQueuedChunksDiscarded += discarded;
      this._staleQueuedChunksDiscardedThisUpdate += discarded;
      if (reason === "direction") this._staleDirectionChunksDiscarded += discarded;
      else this._staleVisibilityChunksDiscarded += discarded;
    }

    _discardQueuedJobAt(index, reason = "visibility") {
      const job = this.queue[index];
      if (!job) return false;
      this.queuedKeys.delete(job.key);
      for (let cursor = index + 1; cursor < this.queue.length; cursor += 1) this.queue[cursor - 1] = this.queue[cursor];
      this.queue.length -= 1;
      this._releaseQueueJob(job);
      this._recordStaleQueueDiscard(1, reason);
      return true;
    }

    _clearQueuedJobsAsStale(reason = "visibility") {
      const discarded = this.queue.length;
      for (let index = 0; index < this.queue.length; index += 1) this._releaseQueueJob(this.queue[index]);
      this.queue.length = 0;
      this.queuedKeys.clear();
      this._recordStaleQueueDiscard(discarded, reason);
      return discarded;
    }

    _resetQueuedJobs() {
      for (let index = 0; index < this.queue.length; index += 1) this._releaseQueueJob(this.queue[index]);
      this.queue.length = 0;
      this.queuedKeys.clear();
      this._desiredUnqueuedChunks = 0;
      this._queueRevision += 1;
      this._queueDirectionReady = false;
    }

    _currentStaleQueuedCount() {
      if (!this.queue.length) return 0;
      const forwardLength = Math.hypot(this.forwardX, this.forwardZ);
      if (this._queueDirectionReady && forwardLength > 0.01) {
        const alignment = clamp((this._queueForwardX * this.forwardX + this._queueForwardZ * this.forwardZ) / forwardLength, -1, 1);
        if (alignment < this._queueDirectionResetCosine) return this.queue.length;
      }
      let stale = 0;
      for (let index = 0; index < this.queue.length; index += 1) {
        const job = this.queue[index];
        if (job.revision !== this._queueRevision || !this._desiredKeys.has(job.key)) stale += 1;
      }
      return stale;
    }

    _updateQueueDirection(hasForward, fx, fz) {
      if (!hasForward) return false;
      if (!this._queueDirectionReady) {
        this._queueForwardX = fx;
        this._queueForwardZ = fz;
        this._queueDirectionReady = true;
        return false;
      }
      const alignment = clamp(this._queueForwardX * fx + this._queueForwardZ * fz, -1, 1);
      if (alignment >= this._queueDirectionResetCosine) return false;
      this._queueDirectionInvalidations += 1;
      this._queueRevision += 1;
      this._clearQueuedJobsAsStale("direction");
      this._queueForwardX = fx;
      this._queueForwardZ = fz;
      return true;
    }

    _withinWorld(cx, cz) {
      const config = this.landscape && this.landscape.config;
      if (!config || !Number.isFinite(config.chunksPerAxis)) return true;
      return cx >= 0 && cz >= 0 && cx < config.chunksPerAxis && cz < config.chunksPerAxis;
    }

    _refreshDesiredChunks(frame) {
      this._desiredKeys.clear();
      let candidateCount = 0;
      const centerX = Math.floor(this.playerX / this.chunkSize);
      const centerZ = Math.floor(this.playerZ / this.chunkSize);
      const radius = Math.ceil((this.viewDistance + this.chunkSize * 0.72) / this.chunkSize);
      const hasForward = Math.hypot(this.forwardX, this.forwardZ) > 0.01;
      const forwardLength = hasForward ? Math.hypot(this.forwardX, this.forwardZ) : 1;
      const fx = this.forwardX / forwardLength;
      const fz = this.forwardZ / forwardLength;
      const fovCosine = Math.cos(Math.min(Math.PI, this.fovRadians * 0.62));
      this._updateQueueDirection(hasForward, fx, fz);
      for (let cz = centerZ - radius; cz <= centerZ + radius; cz += 1) {
        for (let cx = centerX - radius; cx <= centerX + radius; cx += 1) {
          if (!this._withinWorld(cx, cz)) continue;
          const chunkCenterX = (cx + 0.5) * this.chunkSize;
          const chunkCenterZ = (cz + 0.5) * this.chunkSize;
          const dx = chunkCenterX - this.playerX;
          const dz = chunkCenterZ - this.playerZ;
          const distance = Math.hypot(dx, dz);
          if (distance > this.viewDistance + this.chunkSize * 0.72) continue;
          const facing = hasForward ? (dx * fx + dz * fz) / Math.max(0.001, distance) : 1;
          if (this.frustumCulling && hasForward && distance > this.nearOmnidirectionalDistance) {
            if (facing < fovCosine) continue;
          }
          let candidate = this._candidatePool[candidateCount];
          if (!candidate) {
            candidate = {};
            this._candidatePool[candidateCount] = candidate;
          }
          const key = this._chunkKey(cx, cz);
          candidate.cx = cx;
          candidate.cz = cz;
          candidate.key = key;
          candidate.distance = distance;
          candidate.facing = facing;
          candidate.score = this._candidateScore(key, distance, facing, hasForward);
          this._candidates[candidateCount] = candidate;
          candidateCount += 1;
        }
      }
      this._candidates.length = candidateCount;
      this._candidates.sort((a, b) => a.score - b.score || a.distance - b.distance || b.facing - a.facing || a.cx - b.cx || a.cz - b.cz);
      const desiredCount = Math.min(this.maxActiveChunks, candidateCount);
      for (let index = 0; index < desiredCount; index += 1) this._desiredKeys.add(this._candidates[index].key);

      for (const [key, chunk] of this.chunks) {
        if (!this._desiredKeys.has(key)) {
          this._activeInstances -= chunk.placements.length;
          this.chunks.delete(key);
          this._buffersDirty = true;
        }
      }
      for (let index = this.queue.length - 1; index >= 0; index -= 1) {
        const job = this.queue[index];
        if (job.revision !== this._queueRevision || !this._desiredKeys.has(job.key)) this._discardQueuedJobAt(index, "visibility");
      }

      for (let index = 0; index < this.queue.length; index += 1) {
        const job = this.queue[index];
        const dx = (job.cx + 0.5) * this.chunkSize - this.playerX;
        const dz = (job.cz + 0.5) * this.chunkSize - this.playerZ;
        job.distance = Math.hypot(dx, dz);
        job.facing = hasForward ? (dx * fx + dz * fz) / Math.max(0.001, job.distance) : 1;
        job.score = this._candidateScore(job.key, job.distance, job.facing, hasForward);
      }

      this._desiredUnqueuedChunks = 0;
      for (let index = 0; index < desiredCount; index += 1) {
        const candidate = this._candidates[index];
        if (!this.chunks.has(candidate.key) && !this.queuedKeys.has(candidate.key)) {
          if (this.queue.length < this.maxQueuedChunks) {
            const job = this._acquireQueueJob(candidate);
            this.queue.push(job);
            this.queuedKeys.add(job.key);
          } else this._desiredUnqueuedChunks += 1;
        }
      }
      this.queue.sort((a, b) => a.score - b.score || a.distance - b.distance || b.facing - a.facing || a.cx - b.cx || a.cz - b.cz);
      this._queueHighWaterMark = Math.max(this._queueHighWaterMark, this.queue.length);
      this._lastPlayerChunk = `${centerX}:${centerZ}`;
      void frame;
    }

    _sampleBiome(x, z) {
      try {
        const sample = this.landscape && typeof this.landscape.sample === "function" ? this.landscape.sample(x, z) : null;
        return String(sample && (sample.primaryBiome || sample.biomeId || sample.biome) || "grassland");
      } catch (_) { return "grassland"; }
    }

    _buildOneChunk() {
      if (!this.queue.length || this.chunks.size >= this.maxActiveChunks) return null;
      const job = this.queue.shift();
      this.queuedKeys.delete(job.key);
      const jobKey = job.key;
      const jobCx = job.cx;
      const jobCz = job.cz;
      if (job.revision !== this._queueRevision || !this._desiredKeys.has(jobKey)) {
        this._releaseQueueJob(job);
        this._recordStaleQueueDiscard(1, "visibility");
        return null;
      }
      const remaining = Math.max(0, this.maxActiveInstances - this._activeInstances);
      const maximum = Math.min(this.maxInstancesPerChunk, remaining);
      const centerX = (jobCx + 0.5) * this.chunkSize;
      const centerZ = (jobCz + 0.5) * this.chunkSize;
      let plan = null;
      this._chunkPlanCalls += 1;
      try {
        plan = this.vegetation.planChunk({
          cx: jobCx, cz: jobCz, biomeId: this._sampleBiome(centerX, centerZ), quality: this.quality.id,
          terrainSampler: this._terrainSampler, maxInstances: maximum
        });
      } catch (_) { plan = null; }
      const plannedPlacements = plan && plan.ok !== false && Array.isArray(plan.placements) ? plan.placements : null;
      const placements = !plannedPlacements
        ? []
        : (plannedPlacements.length > maximum ? plannedPlacements.slice(0, maximum) : plannedPlacements);
      const distance = this._chunkSurfaceDistance(centerX, centerZ);
      const lod = this._lodEvaluate(distance, null);
      const chunk = { key: jobKey, cx: jobCx, cz: jobCz, centerX, centerZ, distance, lod, placements, stats: plan && plan.stats || null };
      this.chunks.set(jobKey, chunk);
      this._activeInstances += placements.length;
      this._chunkBuilds += 1;
      this._lastBuiltChunk = jobKey;
      this._buffersDirty = true;
      this._releaseQueueJob(job);
      return jobKey;
    }

    _refreshChunkLods() {
      for (const chunk of this.chunks.values()) {
        const distance = this._chunkSurfaceDistance(chunk.centerX, chunk.centerZ);
        const previousLod = chunk.lod && chunk.lod.lod;
        const previousTransition = chunk.lod && chunk.lod.transitionIndex;
        const previousDither = chunk.lod && chunk.lod.dither;
        const next = this._lodEvaluate(distance, previousLod, chunk.lod);
        if (next.lod !== previousLod || next.transitionIndex !== previousTransition || Math.abs(next.dither - previousDither) >= 0.08) this._buffersDirty = true;
        chunk.distance = distance;
        chunk.lod = next;
      }
    }

    _stateAt(x, z) {
      if (this.vegetation && typeof this.vegetation.sampleStateInto === "function") {
        try { return this.vegetation.sampleStateInto(x, z, this.timeSeconds * 1000, this._stateSample) || this._stateSample; }
        catch (_) { /* Use global environment. */ }
      }
      this._stateSample.wetness = this.environment.wetness;
      this._stateSample.burn = this.environment.burn;
      this._stateSample.snow = this.environment.snow;
      this._stateSample.mud = this.environment.mud;
      this._stateSample.compression = 0;
      this._stateSample.health = 1 - this.environment.burn * 0.88;
      return this._stateSample;
    }

    _uploadBucket(bucket) {
      if (this.mode !== "babylon-thin-instances" || !bucket.mesh) return;
      try {
        bucket.mesh.thinInstanceSetBuffer("matrix", bucket.matrices, MATRIX_STRIDE, false);
        try { bucket.mesh.thinInstanceSetBuffer("lodData", bucket.lodData, ATTRIBUTE_STRIDE, false); } catch (_) { /* Shader metadata remains available. */ }
        try { bucket.mesh.thinInstanceSetBuffer("stateData", bucket.stateData, ATTRIBUTE_STRIDE, false); } catch (_) { /* Shader metadata remains available. */ }
        try { bucket.mesh.thinInstanceSetBuffer("windData", bucket.windData, ATTRIBUTE_STRIDE, false); } catch (_) { /* Shader metadata remains available. */ }
        bucket.mesh.thinInstanceCount = bucket.count;
        if (typeof bucket.mesh.thinInstanceBufferUpdated === "function") {
          bucket.mesh.thinInstanceBufferUpdated("matrix");
          try { bucket.mesh.thinInstanceBufferUpdated("lodData"); bucket.mesh.thinInstanceBufferUpdated("stateData"); bucket.mesh.thinInstanceBufferUpdated("windData"); } catch (_) { /* Optional custom attributes. */ }
        }
      } catch (_) {
        this._failOpenRendering();
      }
    }

    _commitRenderedColliderTracking(renderedColliderIds, count, digestA, digestB) {
      const nextDigest = `${count}:${(digestA >>> 0).toString(16).padStart(8, "0")}:${(digestB >>> 0).toString(16).padStart(8, "0")}`;
      const previousIds = this._renderedColliderIds;
      this._renderedColliderIds = renderedColliderIds;
      this._nextRenderedColliderIds = previousIds;
      this._nextRenderedColliderIds.clear();
      if (nextDigest === this._collisionDigest) return false;
      this._collisionDigest = nextDigest;
      this._collisionRevision += 1;
      this._collisionSnapshotCacheKey = "";
      return true;
    }

    _clearCollisionTracking(forceRevision = false) {
      const changed = this._renderedColliderIds.size > 0 || this._collisionDigest !== "0:00000000:00000000";
      this._renderedColliderIds.clear();
      this._nextRenderedColliderIds.clear();
      this._collisionDigest = "0:00000000:00000000";
      if (changed || forceRevision) this._collisionRevision += 1;
      this._collisionSnapshotCacheKey = "";
      this._collisionChunkScratch.length = 0;
      this._collisionCandidateScratch.length = 0;
      return changed;
    }

    _insertCollisionCandidate(candidate, budget) {
      const list = this._collisionCandidateScratch;
      let low = 0;
      let high = list.length;
      while (low < high) {
        const middle = (low + high) >>> 1;
        const current = list[middle];
        if (current.distance < candidate.distance || (current.distance === candidate.distance && current.collider.id <= candidate.collider.id)) low = middle + 1;
        else high = middle;
      }
      list.splice(low, 0, candidate);
      if (list.length > budget) list.pop();
    }

    getCollisionSnapshot(options = {}) {
      if (this.disposed) return this._collisionSnapshot;
      const radius = clamp(options.radius == null ? this.collisionRadius : options.radius, 24, MAX_COLLIDER_RADIUS);
      const budget = Math.round(clamp(options.budget == null ? this.maxCollisionColliders : options.budget, 1, MAX_COLLIDERS_PER_SNAPSHOT));
      const queryX = finite(options.x == null ? options.playerX : options.x, this.playerX);
      const queryZ = finite(options.z == null ? options.playerZ : options.z, this.playerZ);
      const cellX = Math.floor(queryX / this.collisionCellSize);
      const cellZ = Math.floor(queryZ / this.collisionCellSize);
      const centerX = (cellX + 0.5) * this.collisionCellSize;
      const centerZ = (cellZ + 0.5) * this.collisionCellSize;
      const coverageRadius = radius + this.collisionCellSize * Math.SQRT1_2;
      const cellKey = `${cellX}:${cellZ}:${this.quality.id}:${radius}:${budget}`;
      const cacheKey = `${cellKey}:${this._collisionRevision}:${this.mode}`;
      if (cacheKey === this._collisionSnapshotCacheKey) return this._collisionSnapshot;

      const chunks = this._collisionChunkScratch;
      chunks.length = 0;
      const chunkReach = coverageRadius + this.chunkSize * Math.SQRT1_2 + 4;
      for (const chunk of this.chunks.values()) {
        const distance = Math.hypot(chunk.centerX - centerX, chunk.centerZ - centerZ);
        if (distance <= chunkReach) chunks.push(chunk);
      }
      chunks.sort((left, right) => Math.hypot(left.centerX - centerX, left.centerZ - centerZ) - Math.hypot(right.centerX - centerX, right.centerZ - centerZ) || left.cx - right.cx || left.cz - right.cz);

      const candidates = this._collisionCandidateScratch;
      candidates.length = 0;
      let eligible = 0;
      let scanned = 0;
      let scanLimitReached = false;
      outer: for (const chunk of chunks) {
        for (let index = 0; index < chunk.placements.length; index += 1) {
          scanned += 1;
          if (scanned > MAX_COLLIDER_SCAN_PLACEMENTS) { scanLimitReached = true; break outer; }
          const placement = chunk.placements[index];
          const category = String(placement.category || this._bucketByType.get(placement.typeId)?.definition?.category || "").toLowerCase();
          if (!COLLIDER_CATEGORY_SET.has(category)) continue;
          const id = safeColliderId(chunk, placement, index);
          if (!this._renderedColliderIds.has(id)) continue;
          const collider = colliderDescriptor(chunk, placement, index, category);
          if (!collider) continue;
          const distance = Math.hypot(collider.x - centerX, collider.z - centerZ);
          if (distance > coverageRadius + collider.radius) continue;
          eligible += 1;
          this._insertCollisionCandidate({ distance, collider }, budget);
        }
      }

      const colliders = Object.freeze(candidates.map((candidate) => Object.freeze(candidate.collider)));
      let digestA = hashText(`collision-snapshot-a:${cellKey}`);
      let digestB = hashText(`collision-snapshot-b:${cellKey}`);
      for (const collider of colliders) {
        const token = colliderToken(collider);
        digestA = mix32(digestA ^ hashText(token));
        digestB = mix32(digestB ^ hashText(`${token}:${digestA}`));
      }
      const digest = `${colliders.length}:${digestA.toString(16).padStart(8, "0")}:${digestB.toString(16).padStart(8, "0")}`;
      this._collisionSnapshot = Object.freeze({
        supported: true,
        format: COLLISION_SNAPSHOT_FORMAT,
        mode: this.mode,
        cellKey,
        revision: this._collisionRevision,
        digest,
        center: Object.freeze({ x: centerX, z: centerZ }),
        radius,
        coverageRadius,
        budget,
        count: colliders.length,
        tracked: this._renderedColliderIds.size,
        scanned: Math.min(scanned, MAX_COLLIDER_SCAN_PLACEMENTS),
        truncated: scanLimitReached || eligible > budget,
        colliders
      });
      this._collisionSnapshotCacheKey = cacheKey;
      candidates.length = 0;
      chunks.length = 0;
      return this._collisionSnapshot;
    }

    _rebuildBuffers() {
      if (!this._buffersDirty || this.disposed) return false;
      for (const bucket of this._buckets) bucket.count = 0;
      let digest = 2166136261;
      let collisionDigestA = hashText("rendered-colliders-a");
      let collisionDigestB = hashText("rendered-colliders-b");
      let renderedColliderCount = 0;
      const renderedColliderIds = this._nextRenderedColliderIds;
      renderedColliderIds.clear();
      let rendered = 0;
      let dropped = 0;
      this._sortedChunks.length = 0;
      for (const chunk of this.chunks.values()) this._sortedChunks.push(chunk);
      this._sortedChunks.sort((a, b) => a.cx - b.cx || a.cz - b.cz);
      for (const chunk of this._sortedChunks) {
        digest = mix32(digest ^ hashText(chunk.key));
        for (let index = 0; index < chunk.placements.length; index += 1) {
          const placement = chunk.placements[index];
          const bucket = this._bucketByType.get(placement.typeId) || this._bucketByType.get(this.types[0].id);
          if (!bucket || bucket.count >= bucket.capacity || !chunk.lod.visible) { dropped += 1; continue; }
          const currentDensity = LOD_DENSITY[chunk.lod.lod] == null ? 0 : LOD_DENSITY[chunk.lod.lod];
          const nextDensity = LOD_DENSITY[chunk.lod.nextLod] == null ? currentDensity : LOD_DENSITY[chunk.lod.nextLod];
          const density = chunk.lod.transitionIndex < 0 ? currentDensity : currentDensity + (nextDensity - currentDensity) * clamp01(chunk.lod.dither);
          const visibilityRoll = random01(this.seed, chunk.cx, chunk.cz, index + 4099);
          if (visibilityRoll > density) { dropped += 1; continue; }
          const instanceIndex = bucket.count;
          const attributeOffset = instanceIndex * ATTRIBUTE_STRIDE;
          const state = this._stateAt(placement.x, placement.z);
          const phase = random01(this.seed, chunk.cx, chunk.cz, index) * TWO_PI;
          const wind = this._runtimeFrame && this._runtimeFrame.wind || {};
          this._matrixVisual.compression = state.compression;
          this._matrixVisual.phase = phase;
          this._matrixVisual.bend = wind.bend;
          this._matrixVisual.gust = wind.gust;
          this._matrixVisual.flexibility = /tree|sapling/.test(bucket.definition.category) ? 0.38 : 1;
          this._matrixVisual.directionX = wind.directionX;
          this._matrixVisual.directionZ = wind.directionZ;
          this._matrixVisual.time = this.timeSeconds;
          this._matrixVisual.reducedMotion = this.reducedMotion;
          writeMatrix(bucket.matrices, instanceIndex * MATRIX_STRIDE, placement, this.renderOffsetX, this.renderOffsetZ, this._matrixVisual);
          bucket.lodData[attributeOffset] = chunk.lod.lod;
          bucket.lodData[attributeOffset + 1] = chunk.lod.nextLod;
          bucket.lodData[attributeOffset + 2] = chunk.lod.dither;
          bucket.lodData[attributeOffset + 3] = chunk.distance;
          bucket.stateData[attributeOffset] = clamp01(state.wetness);
          bucket.stateData[attributeOffset + 1] = clamp01(state.burn);
          bucket.stateData[attributeOffset + 2] = clamp01(state.snow);
          bucket.stateData[attributeOffset + 3] = clamp01(state.compression);
          bucket.windData[attributeOffset] = phase;
          bucket.windData[attributeOffset + 1] = /tree|sapling/.test(placement.category) ? 0.38 : 1;
          bucket.windData[attributeOffset + 2] = clamp01(state.health == null ? 1 : state.health);
          bucket.windData[attributeOffset + 3] = clamp01(state.mud);
          bucket.count += 1;
          rendered += 1;
          digest = mix32(digest ^ hashText(placement.id));
          digest = mix32(digest ^ hashText(placement.typeId));
          digest = mix32(digest ^ (Math.round(finite(placement.x) * 1000) >>> 0));
          digest = mix32(digest ^ (Math.round(finite(placement.z) * 1000) >>> 0));
          const category = String(placement.category || bucket.definition.category || "").toLowerCase();
          if (COLLIDER_CATEGORY_SET.has(category)) {
            const collider = colliderDescriptor(chunk, placement, index, category);
            if (collider) {
              const token = colliderToken(collider);
              renderedColliderIds.add(collider.id);
              renderedColliderCount += 1;
              collisionDigestA = mix32(collisionDigestA ^ hashText(token));
              collisionDigestB = mix32(collisionDigestB ^ hashText(`${token}:${collisionDigestA}`));
            }
          }
        }
      }
      for (const bucket of this._buckets) this._uploadBucket(bucket);
      this._renderedInstances = rendered;
      this._droppedInstances = dropped;
      this._descriptorDigest = digest.toString(16).padStart(8, "0");
      this._commitRenderedColliderTracking(renderedColliderIds, renderedColliderCount, collisionDigestA, collisionDigestB);
      this._buffersDirty = false;
      this._stateDirty = false;
      return true;
    }

    _updateWindAndMaterials() {
      const wind = this._runtimeFrame && this._runtimeFrame.wind || {};
      for (let index = 0; index < this._buckets.length; index += 1) {
        const bucket = this._buckets[index];
        const mesh = bucket.mesh;
        if (!mesh) continue;
        const metadata = mesh.metadata && mesh.metadata.hhEonWild;
        if (metadata) {
          metadata.wind.time = this.timeSeconds;
          metadata.wind.x = finite(wind.x);
          metadata.wind.z = finite(wind.z);
          metadata.wind.bend = this.reducedMotion ? 0 : clamp01(wind.bend);
          metadata.wind.gust = clamp01(wind.gust);
          Object.assign(metadata.environment, this.environment);
        }
        if (mesh.rotation && typeof mesh.rotation === "object") {
          const flexibility = /tree|sapling/.test(bucket.definition.category) ? 0.006 : 0.024;
          const bend = this.reducedMotion ? 0 : clamp01(wind.bend);
          mesh.rotation.z = Math.sin(this.timeSeconds * 0.73 + index * 1.93) * bend * flexibility;
          mesh.rotation.x = Math.cos(this.timeSeconds * 0.51 + index * 0.71) * bend * flexibility * 0.45;
        }
      }
      for (const material of this._materials) {
        if (!material.metadata) material.metadata = {};
        if (!material.metadata.environment) material.metadata.environment = {};
        Object.assign(material.metadata.environment, this.environment);
        if ("specularPower" in material) material.specularPower = 18 + this.environment.wetness * 70;
        const baseColor = material.metadata.baseColor;
        if (baseColor && material.diffuseColor) {
          const wetShade = 1 - this.environment.wetness * 0.2;
          const burnMix = this.environment.burn * 0.72;
          const snowMix = this.environment.snow * 0.68;
          const mudMix = this.environment.mud * 0.24;
          material.diffuseColor.r = clamp(baseColor[0] * wetShade * (1 - burnMix - mudMix) + 0.17 * burnMix + 0.24 * mudMix, 0.025, 0.92);
          material.diffuseColor.g = clamp(baseColor[1] * wetShade * (1 - burnMix - mudMix) + 0.12 * burnMix + 0.17 * mudMix, 0.025, 0.94);
          material.diffuseColor.b = clamp(baseColor[2] * wetShade * (1 - burnMix - mudMix) + 0.09 * burnMix + 0.1 * mudMix, 0.02, 0.96);
          material.diffuseColor.r = material.diffuseColor.r * (1 - snowMix) + 0.78 * snowMix;
          material.diffuseColor.g = material.diffuseColor.g * (1 - snowMix) + 0.82 * snowMix;
          material.diffuseColor.b = material.diffuseColor.b * (1 - snowMix) + 0.84 * snowMix;
          if (material.emissiveColor) {
            material.emissiveColor.r = material.diffuseColor.r * NATURAL_LIGHT_FLOOR.emissiveFactor;
            material.emissiveColor.g = material.diffuseColor.g * NATURAL_LIGHT_FLOOR.emissiveFactor;
            material.emissiveColor.b = material.diffuseColor.b * NATURAL_LIGHT_FLOOR.emissiveFactor;
          }
          if (material.ambientColor) {
            material.ambientColor.r = material.diffuseColor.r * NATURAL_LIGHT_FLOOR.ambientFactor;
            material.ambientColor.g = material.diffuseColor.g * NATURAL_LIGHT_FLOOR.ambientFactor;
            material.ambientColor.b = material.diffuseColor.b * NATURAL_LIGHT_FLOOR.ambientFactor;
          }
        }
      }
    }

    _applyWeather(weather, wetness) {
      const source = weather && typeof weather === "object" ? weather : {};
      const name = typeof weather === "string" ? weather.toLowerCase() : String(source.type || "").toLowerCase();
      const nextWetness = wetness == null
        ? (source.wetness == null ? (source.rain == null && !/rain|storm/.test(name) ? this.environment.wetness : clamp01(source.rain == null ? 0.78 : source.rain)) : clamp01(source.wetness))
        : clamp01(wetness);
      const nextSnow = source.snow == null ? (/snow|blizzard/.test(name) ? 0.76 : this.environment.snow) : clamp01(source.snow);
      const nextBurn = source.burn == null ? (/fire|wildfire/.test(name) ? 0.72 : this.environment.burn) : clamp01(source.burn);
      const nextMud = source.mud == null ? Math.max(this.environment.mud, nextWetness * 0.38) : clamp01(source.mud);
      if (nextWetness !== this.environment.wetness || nextSnow !== this.environment.snow || nextBurn !== this.environment.burn || nextMud !== this.environment.mud) {
        this.environment.wetness = nextWetness;
        this.environment.snow = nextSnow;
        this.environment.burn = nextBurn;
        this.environment.mud = nextMud;
        this._envPatch.wetness = nextWetness;
        this._envPatch.snow = nextSnow;
        this._envPatch.burn = nextBurn;
        this._envPatch.mud = nextMud;
        try { if (this.vegetation && typeof this.vegetation.configure === "function") this.vegetation.configure(this._envPatch); } catch (_) { /* Renderer remains usable. */ }
        this._buffersDirty = true;
        this._stateDirty = true;
      }
    }

    configure(options = {}) {
      if (this.disposed) return false;
      const requestedQuality = options.quality || options.qualityPreset;
      const previousQuality = this.quality.id;
      if (requestedQuality) this.quality = normalizeQuality(this.vegetationModule, requestedQuality);
      if (options.reducedMotion != null) this.reducedMotion = Boolean(options.reducedMotion);
      if (options.collisionRadius != null) this.collisionRadius = clamp(options.collisionRadius, 24, MAX_COLLIDER_RADIUS);
      if (options.maxCollisionColliders != null) this.maxCollisionColliders = Math.round(clamp(options.maxCollisionColliders, 1, MAX_COLLIDERS_PER_SNAPSHOT));
      if (options.collisionCellSize != null) this.collisionCellSize = Math.round(clamp(options.collisionCellSize, 8, 64));
      if (options.collisionRadius != null || options.maxCollisionColliders != null || options.collisionCellSize != null) this._collisionSnapshotCacheKey = "";
      if (options.queueDirectionResetRadians != null) {
        this._queueDirectionResetCosine = Math.cos(clamp(options.queueDirectionResetRadians, Math.PI / 18, Math.PI * 0.75));
      }
      if (this.vegetation && typeof this.vegetation.configure === "function") {
        try { this.vegetation.configure(options); } catch (_) { /* Fail open. */ }
      }
      if (requestedQuality || options.maxActiveInstances != null || options.maxInstancesPerChunk != null || options.maxActiveChunks != null || options.maxQueuedChunks != null || options.viewDistance != null || options.frustumCulling != null || options.nearOmnidirectionalDistance != null || options.queueDirectionResetRadians != null) {
        const mergedBudget = {
          ...options,
          maxActiveInstances: options.maxActiveInstances == null && !requestedQuality ? this.maxActiveInstances : options.maxActiveInstances,
          maxInstancesPerChunk: options.maxInstancesPerChunk == null && !requestedQuality ? this.maxInstancesPerChunk : options.maxInstancesPerChunk,
          maxActiveChunks: options.maxActiveChunks == null && !requestedQuality ? this.maxActiveChunks : options.maxActiveChunks,
          maxQueuedChunks: options.maxQueuedChunks == null && !requestedQuality ? this.maxQueuedChunks : options.maxQueuedChunks,
          viewDistance: options.viewDistance == null && !requestedQuality ? this.viewDistance : options.viewDistance,
          frustumCulling: options.frustumCulling == null ? this.frustumCulling : options.frustumCulling,
          nearOmnidirectionalDistance: options.nearOmnidirectionalDistance == null && !requestedQuality ? this.nearOmnidirectionalDistance : options.nearOmnidirectionalDistance
        };
        this._configureBudget(mergedBudget);
        this._resetQueuedJobs();
        if (this._freeQueueJobs.length > this.maxQueuedChunks) this._freeQueueJobs.length = this.maxQueuedChunks;
        this.chunks.clear();
        this._candidates.length = 0;
        this._candidatePool.length = 0;
        this._sortedChunks.length = 0;
        this._activeInstances = 0;
        this._lastBuiltChunk = "";
        this._clearCollisionTracking();
        if (previousQuality !== this.quality.id || options.maxActiveInstances != null) this._allocateBuckets();
        else this._buffersDirty = true;
      }
      this._applyWeather(options.weather == null ? options : options.weather, options.wetness);
      return true;
    }

    disturb(input = {}) {
      if (this.disposed) return null;
      let result = null;
      try { result = this.vegetation && typeof this.vegetation.disturb === "function" ? this.vegetation.disturb(input) : null; }
      catch (_) { result = null; }
      this._buffersDirty = true;
      this._stateDirty = true;
      return result;
    }

    pause(reason = "manual") {
      if (this.disposed) return false;
      this.paused = true;
      this.pauseReason = String(reason || "manual");
      try { if (this.vegetation && typeof this.vegetation.pause === "function") this.vegetation.pause(this.pauseReason); } catch (_) { /* Local pause is sufficient. */ }
      return true;
    }

    resume(reason = "manual") {
      if (this.disposed) return false;
      this.paused = false;
      this.pauseReason = "";
      try { if (this.vegetation && typeof this.vegetation.resume === "function") this.vegetation.resume(reason); } catch (_) { /* Local resume is sufficient. */ }
      return true;
    }

    update(frame = {}) {
      this._frameResult.buildsThisUpdate = 0;
      this._frameResult.builtChunk = null;
      this._staleQueuedChunksDiscardedThisUpdate = 0;
      this._buildBudgetUsedThisUpdate = 0;
      this._buildBudgetDeferredThisUpdate = this.queue.length + this._desiredUnqueuedChunks;
      this._frameResult.buildBudget.used = 0;
      this._frameResult.buildBudget.remaining = MAX_CHUNK_BUILDS_PER_UPDATE;
      this._frameResult.buildBudget.deferred = this._buildBudgetDeferredThisUpdate;
      if (this.disposed) {
        this._frameResult.status = "disposed";
        this._frameResult.mode = "descriptor";
        this.getTelemetry(this._frameResult.telemetry);
        return this._frameResult;
      }
      if (frame.playerX != null) this.playerX = finite(frame.playerX, this.playerX);
      if (frame.playerZ != null) this.playerZ = finite(frame.playerZ, this.playerZ);
      if (frame.forwardX != null || frame.forwardZ != null) {
        this.forwardX = finite(frame.forwardX, this.forwardX);
        this.forwardZ = finite(frame.forwardZ, this.forwardZ);
      }
      if (frame.fovRadians != null) this.fovRadians = clamp(frame.fovRadians, Math.PI / 6, Math.PI * 1.9);
      this.timeSeconds = Math.max(0, finite(frame.time == null ? frame.timeSeconds : frame.time, this.timeSeconds));
      this._applyWeather(frame.weather, frame.wetness);
      if (this.paused) {
        this._frameResult.status = "paused";
        this._frameResult.mode = this.mode;
        this.getTelemetry(this._frameResult.telemetry);
        return this._frameResult;
      }
      this._systemFrame.timeSeconds = this.timeSeconds;
      this._systemFrame.deltaSeconds = clamp(frame.deltaSeconds == null ? frame.delta : frame.deltaSeconds, 0, 0.25);
      this._systemFrame.cameraX = this.playerX;
      this._systemFrame.cameraZ = this.playerZ;
      try { if (this.vegetation && typeof this.vegetation.update === "function") this.vegetation.update(this._systemFrame, this._runtimeFrame); } catch (_) { /* Descriptor planning can continue. */ }
      let activeInfluences = 0;
      try { activeInfluences = Math.max(0, Math.trunc(finite(this.vegetation?.getStatus?.().activeInfluences))); } catch (_) { activeInfluences = 0; }
      if (activeInfluences > 0 && this.timeSeconds >= this._nextInteractionBufferAt) {
        this._buffersDirty = true;
        this._nextInteractionBufferAt = this.timeSeconds + 0.4;
      } else if (activeInfluences === 0) this._nextInteractionBufferAt = this.timeSeconds;
      this._refreshDesiredChunks(frame);
      let built = null;
      if (this._buildBudgetUsedThisUpdate < MAX_CHUNK_BUILDS_PER_UPDATE) built = this._buildOneChunk();
      if (built) {
        this._buildBudgetUsedThisUpdate += 1;
        this._frameResult.buildsThisUpdate = this._buildBudgetUsedThisUpdate;
        this._frameResult.builtChunk = built;
      }
      this._buildBudgetDeferredThisUpdate = this.queue.length + this._desiredUnqueuedChunks;
      this._frameResult.buildBudget.used = this._buildBudgetUsedThisUpdate;
      this._frameResult.buildBudget.remaining = MAX_CHUNK_BUILDS_PER_UPDATE - this._buildBudgetUsedThisUpdate;
      this._frameResult.buildBudget.deferred = this._buildBudgetDeferredThisUpdate;
      this._refreshChunkLods();
      this._rebuildBuffers();
      this._updateWindAndMaterials();
      this._frameResult.status = "running";
      this._frameResult.mode = this.mode;
      this.getTelemetry(this._frameResult.telemetry);
      return this._frameResult;
    }

    getTelemetry(out) {
      const target = out || {};
      let bufferFloats = 0;
      let instanceCapacity = 0;
      let thinBuffers = 0;
      for (const bucket of this._buckets) {
        bufferFloats += bucket.matrices.length + bucket.lodData.length + bucket.stateData.length + bucket.windData.length;
        instanceCapacity += bucket.capacity;
        if (bucket.mesh) thinBuffers += 1;
      }
      target.version = VERSION;
      target.format = FORMAT;
      target.status = this.disposed ? "disposed" : (this.paused ? "paused" : "ready");
      target.mode = this.disposed ? "descriptor" : this.mode;
      target.quality = this.quality.id;
      target.paused = this.paused;
      target.pauseReason = this.pauseReason;
      target.reducedMotion = this.reducedMotion;
      target.activeChunks = this.chunks.size;
      target.queuedChunks = this.queue.length;
      target.staleQueuedChunks = this._currentStaleQueuedCount();
      target.staleQueuedChunksDiscarded = this._staleQueuedChunksDiscarded;
      target.staleQueuedChunksDiscardedThisUpdate = this._staleQueuedChunksDiscardedThisUpdate;
      target.staleDirectionChunksDiscarded = this._staleDirectionChunksDiscarded;
      target.staleVisibilityChunksDiscarded = this._staleVisibilityChunksDiscarded;
      target.queueRevision = this._queueRevision;
      target.queueDirectionInvalidations = this._queueDirectionInvalidations;
      target.queueHighWaterMark = this._queueHighWaterMark;
      target.queueHeadScore = this.queue.length ? this.queue[0].score : null;
      target.queueHeadFacing = this.queue.length ? this.queue[0].facing : null;
      target.desiredUnqueuedChunks = this._desiredUnqueuedChunks;
      target.pendingDesiredChunks = this.queue.length + this._desiredUnqueuedChunks;
      target.candidatePoolSize = this._candidatePool.length;
      target.queueJobAllocations = this._queueJobAllocations;
      target.maxActiveChunks = this.maxActiveChunks;
      target.maxQueuedChunks = this.maxQueuedChunks;
      target.activeInstances = this._activeInstances;
      target.renderedInstances = this._renderedInstances;
      target.droppedInstances = this._droppedInstances;
      target.maxActiveInstances = this.maxActiveInstances;
      target.maxInstancesPerChunk = this.maxInstancesPerChunk;
      target.instanceBufferCapacity = instanceCapacity;
      target.bufferFloats = bufferFloats;
      target.sourceMeshes = this._sourceMeshes.length;
      target.materials = this._materials.length;
      target.thinInstanceSources = thinBuffers;
      target.visualStateConsumer = this.mode === "babylon-thin-instances" ? "cpu-build-matrix-wind-compression+density-lod+shared-live-sway" : "descriptor";
      target.chunkBuilds = this._chunkBuilds;
      target.chunkPlanCalls = this._chunkPlanCalls;
      target.chunkBuildBudgetPerUpdate = MAX_CHUNK_BUILDS_PER_UPDATE;
      target.chunkBuildBudgetUsed = this._buildBudgetUsedThisUpdate;
      target.chunkBuildBudgetRemaining = MAX_CHUNK_BUILDS_PER_UPDATE - this._buildBudgetUsedThisUpdate;
      target.chunkBuildsDeferred = this._buildBudgetDeferredThisUpdate;
      target.lastBuiltChunk = this._lastBuiltChunk;
      target.playerChunk = this._lastPlayerChunk;
      target.descriptorDigest = this._descriptorDigest;
      target.collisionSnapshotFormat = COLLISION_SNAPSHOT_FORMAT;
      target.collisionRevision = this._collisionRevision;
      target.collisionDigest = this._collisionDigest;
      target.trackedColliders = this._renderedColliderIds.size;
      target.collisionRadius = this.collisionRadius;
      target.maxCollisionColliders = this.maxCollisionColliders;
      target.environment = target.environment || {};
      Object.assign(target.environment, this.environment);
      target.disposed = this.disposed;
      return target;
    }

    dispose() {
      if (this.disposed) return false;
      this.paused = true;
      this.pauseReason = "disposed";
      this._resetQueuedJobs();
      this._freeQueueJobs.length = 0;
      this._desiredKeys.clear();
      this._candidates.length = 0;
      this._candidatePool.length = 0;
      this._sortedChunks.length = 0;
      this.chunks.clear();
      for (const bucket of this._buckets) {
        if (bucket.mesh) {
          try { bucket.mesh.thinInstanceSetBuffer("matrix", null); } catch (_) { /* Dispose below is authoritative. */ }
          try { if (typeof bucket.mesh.dispose === "function") bucket.mesh.dispose(); } catch (_) { /* Continue cleanup. */ }
        }
        bucket.mesh = null;
        bucket.capacity = 0;
        bucket.count = 0;
        bucket.matrices = new Float32Array(0);
        bucket.lodData = new Float32Array(0);
        bucket.stateData = new Float32Array(0);
        bucket.windData = new Float32Array(0);
      }
      for (const material of this._materials) {
        try { if (material && typeof material.dispose === "function") material.dispose(); } catch (_) { /* Continue cleanup. */ }
      }
      this._sourceMeshes.length = 0;
      this._materials.length = 0;
      this._materialByGroup.clear();
      this._bucketByType.clear();
      if (this._ownedVegetation) {
        try { if (this.vegetation && typeof this.vegetation.dispose === "function") this.vegetation.dispose(); } catch (_) { /* Continue cleanup. */ }
      }
      if (this._ownedLandscape) {
        try { if (this.landscape && typeof this.landscape.dispose === "function") this.landscape.dispose(); } catch (_) { /* Continue cleanup. */ }
      }
      this._activeInstances = 0;
      this._renderedInstances = 0;
      this._droppedInstances = 0;
      this._desiredUnqueuedChunks = 0;
      this._buildBudgetUsedThisUpdate = 0;
      this._buildBudgetDeferredThisUpdate = 0;
      this.mode = "descriptor";
      this.disposed = true;
      this._clearCollisionTracking(true);
      this._collisionSnapshot = Object.freeze({
        supported: false,
        format: COLLISION_SNAPSHOT_FORMAT,
        mode: "descriptor",
        cellKey: "disposed",
        revision: this._collisionRevision,
        digest: this._collisionDigest,
        center: Object.freeze({ x: this.playerX, z: this.playerZ }),
        radius: 0,
        coverageRadius: 0,
        budget: 0,
        count: 0,
        tracked: 0,
        scanned: 0,
        truncated: false,
        colliders: Object.freeze([])
      });
      this._collisionSnapshotCacheKey = "disposed";
      return true;
    }
  }

  function create(options) { return new ProceduralVegetationRenderer(options); }

  return Object.freeze({
    VERSION,
    version: VERSION,
    FORMAT,
    MAX_SOURCES,
    MAX_CHUNK_BUILDS_PER_UPDATE,
    COLLISION_SNAPSHOT_FORMAT,
    COLLIDER_CATEGORIES,
    DEFAULT_COLLIDER_RADIUS,
    MAX_COLLIDER_RADIUS,
    DEFAULT_COLLIDER_BUDGET,
    MAX_COLLIDERS_PER_SNAPSHOT,
    MAX_COLLIDER_SCAN_PLACEMENTS,
    MATRIX_STRIDE,
    ATTRIBUTE_STRIDE,
    NATURAL_LIGHT_FLOOR,
    QUALITY_LIMITS,
    ProceduralVegetationRenderer,
    create
  });
});
