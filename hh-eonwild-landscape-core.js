(function (root, factory) {
  "use strict";

  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHEonWildLandscapeCore = api;
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function createHHEonWildLandscapeCore(runtime) {
  "use strict";

  /*
   * Deterministic, renderer-agnostic landscape kernel for HH EonWild.
   * The kernel intentionally creates no DOM, Babylon, WebGL, timer or Worker
   * objects. Its jobs and descriptors are structured-clone friendly so a view
   * may execute expensive geometry work in a dedicated Worker.
   */
  const VERSION = "1.0.0";
  const FORMAT = "hh-eonwild-landscape-core-v1";
  const WORKER_JOB_FORMAT = "hh-eonwild-landscape-job-v1";
  const GEOMETRY_FORMAT = "hh-eonwild-terrain-geometry-v1";
  const UINT32_MAX = 0xffffffff;
  const REALM_IDS = Object.freeze(["paleozoic", "mesozoic", "ice-age", "modern", "convergence"]);
  const BIOME_IDS = Object.freeze([
    "ocean", "reef", "wetland", "rainforest", "forest",
    "grassland", "desert", "tundra", "alpine", "volcanic"
  ]);
  const WORLD_DEFAULTS = Object.freeze({
    worldSize: 16384,
    chunkSize: 256,
    seaLevel: -4,
    riverCount: 4,
    riverIndexCellSize: 512,
    coordinateLimit: 1048576
  });
  const LIMITS = Object.freeze({
    MIN_WORLD_SIZE: 2048,
    MAX_WORLD_SIZE: 65536,
    MIN_CHUNK_SIZE: 64,
    MAX_CHUNK_SIZE: 1024,
    MAX_CHUNKS_PER_AXIS: 512,
    MAX_RIVERS: 12,
    MAX_RIVER_POINTS: 192,
    MAX_RIVER_SEGMENTS: 2048,
    MAX_RIVER_INDEX_REFERENCES: 32768,
    MAX_RIVER_SEGMENTS_PER_CHUNK: 512,
    MAX_SHELTERS_PER_CHUNK: 8,
    MAX_GEOMETRY_RESOLUTION: 129,
    MAX_VERTICES_PER_CHUNK: 16641,
    MAX_INDICES_PER_CHUNK: 98304,
    MAX_QUEUE_SIZE: 96,
    MAX_BUILDS_PER_TICK: 8,
    MAX_BUILD_BUDGET_MS: 25,
    MAX_LOD_STATES: 512,
    MAX_WORKER_JOB_BYTES: 8192
  });
  const LOD_PROFILES = Object.freeze([
    Object.freeze({ lod: 0, resolution: 65, maximumDistance: 420, label: "near" }),
    Object.freeze({ lod: 1, resolution: 33, maximumDistance: 1280, label: "middle" }),
    Object.freeze({ lod: 2, resolution: 17, maximumDistance: 3600, label: "far" }),
    Object.freeze({ lod: 3, resolution: 9, maximumDistance: Infinity, label: "horizon" })
  ]);
  const DEFAULT_LOD_THRESHOLDS = Object.freeze(LOD_PROFILES.slice(0, -1).map((profile) => profile.maximumDistance));
  const REALM_BIOME_MULTIPLIERS = Object.freeze({
    paleozoic: Object.freeze({ ocean: 1.16, reef: 1.2, wetland: 1.24, rainforest: 1.08, forest: 1.04, grassland: 0.45, desert: 0.72, tundra: 0.22, alpine: 0.65, volcanic: 1.12 }),
    mesozoic: Object.freeze({ ocean: 1.02, reef: 1.08, wetland: 1.14, rainforest: 1.18, forest: 1.12, grassland: 1.04, desert: 0.96, tundra: 0.25, alpine: 0.82, volcanic: 1.1 }),
    "ice-age": Object.freeze({ ocean: 0.94, reef: 0.38, wetland: 0.88, rainforest: 0.35, forest: 0.92, grassland: 1.22, desert: 0.76, tundra: 1.5, alpine: 1.35, volcanic: 0.82 }),
    modern: Object.freeze({ ocean: 1, reef: 1, wetland: 1, rainforest: 1, forest: 1, grassland: 1, desert: 1, tundra: 1, alpine: 1, volcanic: 1 }),
    convergence: Object.freeze({ ocean: 1, reef: 1, wetland: 1, rainforest: 1, forest: 1, grassland: 1, desert: 1, tundra: 1, alpine: 1, volcanic: 1 })
  });

  const finite = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, finite(value, minimum)));
  const clamp01 = (value) => clamp(value, 0, 1);
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const smoothstep = (edge0, edge1, value) => {
    if (edge0 === edge1) return value < edge0 ? 0 : 1;
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  };
  const smootherstep = (value) => {
    const t = clamp01(value);
    return t * t * t * (t * (t * 6 - 15) + 10);
  };
  const safeId = (value, fallback = "landscape") => {
    const text = String(value == null ? "" : value)
      .normalize("NFKC")
      .replace(/[^a-zA-Z0-9_.:-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96);
    return text || fallback;
  };
  const safeSeed = (value) => {
    const text = String(value == null ? "eonwild-landscape" : value)
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .slice(0, 64);
    return text || "eonwild-landscape";
  };
  const freezeArray = (rows) => Object.freeze(rows.map((row) => Object.freeze(row)));

  function hashSeed(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value >>> 0;
    const text = String(value == null ? "eonwild-landscape" : value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mix32(value) {
    let next = value >>> 0;
    next ^= next >>> 16;
    next = Math.imul(next, 0x7feb352d);
    next ^= next >>> 15;
    next = Math.imul(next, 0x846ca68b);
    next ^= next >>> 16;
    return next >>> 0;
  }

  function latticeHash(x, z, seed) {
    const xi = Math.trunc(x) | 0;
    const zi = Math.trunc(z) | 0;
    return mix32((seed >>> 0) ^ Math.imul(xi, 0x1f123bb5) ^ Math.imul(zi, 0x5f356495));
  }

  function noise2D(x, z, seed = 0) {
    const px = clamp(finite(x), -WORLD_DEFAULTS.coordinateLimit, WORLD_DEFAULTS.coordinateLimit);
    const pz = clamp(finite(z), -WORLD_DEFAULTS.coordinateLimit, WORLD_DEFAULTS.coordinateLimit);
    const x0 = Math.floor(px);
    const z0 = Math.floor(pz);
    const tx = smootherstep(px - x0);
    const tz = smootherstep(pz - z0);
    const scalar = 1 / 2147483647.5;
    const h00 = latticeHash(x0, z0, seed) * scalar - 1;
    const h10 = latticeHash(x0 + 1, z0, seed) * scalar - 1;
    const h01 = latticeHash(x0, z0 + 1, seed) * scalar - 1;
    const h11 = latticeHash(x0 + 1, z0 + 1, seed) * scalar - 1;
    return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
  }

  function fractalNoise2D(x, z, seed = 0, options = {}) {
    const octaves = Math.trunc(clamp(options.octaves == null ? 5 : options.octaves, 1, 8));
    let frequency = clamp(options.frequency == null ? 1 : options.frequency, 0.000001, 64);
    const lacunarity = clamp(options.lacunarity == null ? 2.03 : options.lacunarity, 1.25, 4);
    const gain = clamp(options.gain == null ? 0.5 : options.gain, 0.1, 0.85);
    let amplitude = 1;
    let sum = 0;
    let amplitudeSum = 0;
    for (let octave = 0; octave < octaves; octave += 1) {
      sum += noise2D(x * frequency, z * frequency, mix32((seed >>> 0) + octave * 0x9e3779b9)) * amplitude;
      amplitudeSum += amplitude;
      frequency *= lacunarity;
      amplitude *= gain;
    }
    return amplitudeSum > 0 ? sum / amplitudeSum : 0;
  }

  function ridgedNoise2D(x, z, seed = 0, options = {}) {
    const octaves = Math.trunc(clamp(options.octaves == null ? 5 : options.octaves, 1, 8));
    let frequency = clamp(options.frequency == null ? 1 : options.frequency, 0.000001, 64);
    const lacunarity = clamp(options.lacunarity == null ? 2 : options.lacunarity, 1.25, 4);
    const gain = clamp(options.gain == null ? 0.53 : options.gain, 0.1, 0.85);
    let amplitude = 1;
    let sum = 0;
    let amplitudeSum = 0;
    for (let octave = 0; octave < octaves; octave += 1) {
      let ridge = 1 - Math.abs(noise2D(x * frequency, z * frequency, mix32((seed >>> 0) + octave * 0x85ebca6b)));
      ridge *= ridge;
      sum += ridge * amplitude;
      amplitudeSum += amplitude;
      frequency *= lacunarity;
      amplitude *= gain;
    }
    return amplitudeSum > 0 ? clamp01(sum / amplitudeSum) : 0;
  }

  function domainWarp2D(x, z, seed = 0, options = {}) {
    const frequency = clamp(options.frequency == null ? 1 / 2800 : options.frequency, 0.000001, 0.05);
    const amplitude = clamp(options.amplitude == null ? 420 : options.amplitude, 0, 2048);
    const first = fractalNoise2D(x, z, mix32(seed ^ 0x68bc21eb), { frequency, octaves: 4, gain: 0.52 });
    const second = fractalNoise2D(x + 1137, z - 947, mix32(seed ^ 0x02e5be93), { frequency, octaves: 4, gain: 0.52 });
    return Object.freeze({ x: x + first * amplitude, z: z + second * amplitude, offsetX: first * amplitude, offsetZ: second * amplitude });
  }

  function createSeededRandom(seed) {
    let state = hashSeed(seed) || 1;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      return mix32(state) / 4294967296;
    };
  }

  function normalizeRealm(value) {
    const candidate = String(value || "modern").toLowerCase();
    return REALM_IDS.includes(candidate) ? candidate : "modern";
  }

  function normalizeAddress(value = {}) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const realmId = normalizeRealm(source.realmId || source.realm || source.eraRealm);
    return Object.freeze({
      seed: safeSeed(source.seed),
      realmId,
      timeSliceId: safeId(source.timeSliceId || source.timeSlice || `${realmId}-default`, `${realmId}-default`).toLowerCase(),
      regionId: safeId(source.regionId || source.region || `${realmId}-wilds`, `${realmId}-wilds`).toLowerCase()
    });
  }

  function normalizeConfig(options = {}) {
    const worldSize = Math.trunc(clamp(options.worldSize ?? WORLD_DEFAULTS.worldSize, LIMITS.MIN_WORLD_SIZE, LIMITS.MAX_WORLD_SIZE));
    let chunkSize = Math.trunc(clamp(options.chunkSize ?? WORLD_DEFAULTS.chunkSize, LIMITS.MIN_CHUNK_SIZE, LIMITS.MAX_CHUNK_SIZE));
    if (worldSize / chunkSize > LIMITS.MAX_CHUNKS_PER_AXIS) chunkSize = Math.ceil(worldSize / LIMITS.MAX_CHUNKS_PER_AXIS);
    const chunksPerAxis = Math.max(1, Math.floor(worldSize / chunkSize));
    const normalizedWorldSize = chunksPerAxis * chunkSize;
    return Object.freeze({
      worldSize: normalizedWorldSize,
      chunkSize,
      chunksPerAxis,
      seaLevel: clamp(options.seaLevel ?? options.waterLevel ?? WORLD_DEFAULTS.seaLevel, -250, 250),
      riverCount: Math.trunc(clamp(options.riverCount ?? WORLD_DEFAULTS.riverCount, 1, LIMITS.MAX_RIVERS)),
      riverIndexCellSize: Math.trunc(clamp(options.riverIndexCellSize ?? WORLD_DEFAULTS.riverIndexCellSize, chunkSize, 2048))
    });
  }

  function timeSliceBias(timeSliceId) {
    const id = String(timeSliceId || "").toLowerCase();
    const result = Object.fromEntries(BIOME_IDS.map((biomeId) => [biomeId, 1]));
    if (/cambrian|devonian|seaway|ocean|reef/.test(id)) { result.ocean *= 1.45; result.reef *= 1.5; result.wetland *= 1.12; }
    if (/carboniferous|swamp|wetland|kem-kem/.test(id)) { result.wetland *= 1.7; result.rainforest *= 1.35; result.desert *= 0.45; }
    if (/permian|triassic/.test(id)) { result.desert *= 1.38; result.volcanic *= 1.32; result.rainforest *= 0.65; }
    if (/jurassic|cretaceous|laramidia/.test(id)) { result.forest *= 1.25; result.rainforest *= 1.18; result.wetland *= 1.16; }
    if (/mammoth|glacial|pleistocene|ice/.test(id)) { result.tundra *= 1.52; result.grassland *= 1.22; result.rainforest *= 0.25; }
    if (/rainforest/.test(id)) { result.rainforest *= 1.75; result.forest *= 1.25; }
    if (/volcan|ash/.test(id)) result.volcanic *= 1.8;
    return result;
  }

  function cubicBezier(a, b, c, d, t) {
    const inv = 1 - t;
    const inv2 = inv * inv;
    const t2 = t * t;
    return {
      x: inv2 * inv * a.x + 3 * inv2 * t * b.x + 3 * inv * t2 * c.x + t2 * t * d.x,
      z: inv2 * inv * a.z + 3 * inv2 * t * b.z + 3 * inv * t2 * c.z + t2 * t * d.z
    };
  }

  function pointSegmentDistanceSquared(px, pz, ax, az, bx, bz) {
    const dx = bx - ax;
    const dz = bz - az;
    const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared > 0 ? clamp01(((px - ax) * dx + (pz - az) * dz) / lengthSquared) : 0;
    const closestX = ax + dx * t;
    const closestZ = az + dz * t;
    const offsetX = px - closestX;
    const offsetZ = pz - closestZ;
    return { distanceSquared: offsetX * offsetX + offsetZ * offsetZ, t, x: closestX, z: closestZ };
  }

  function normalizeLOD(value) {
    return Math.trunc(clamp(value, 0, LOD_PROFILES.length - 1));
  }

  function normalizeResolution(value, lod = 0) {
    const fallback = LOD_PROFILES[normalizeLOD(lod)].resolution;
    const resolution = Math.trunc(finite(value, fallback));
    if (resolution < 3 || resolution > LIMITS.MAX_GEOMETRY_RESOLUTION) throw new RangeError(`Terrain resolution must stay in [3, ${LIMITS.MAX_GEOMETRY_RESOLUTION}]`);
    const vertices = resolution * resolution;
    const indices = (resolution - 1) * (resolution - 1) * 6;
    if (vertices > LIMITS.MAX_VERTICES_PER_CHUNK || indices > LIMITS.MAX_INDICES_PER_CHUNK) throw new RangeError("Terrain geometry allocation exceeds the safe chunk budget");
    return resolution;
  }

  function normalizeThresholds(input) {
    const source = Array.isArray(input) ? input : DEFAULT_LOD_THRESHOLDS;
    if (source.length !== LOD_PROFILES.length - 1) return Array.from(DEFAULT_LOD_THRESHOLDS);
    const values = [];
    for (let index = 0; index < source.length; index += 1) {
      const minimum = index === 0 ? 32 : values[index - 1] + 1;
      values.push(clamp(source[index], minimum, 100000));
    }
    for (let index = 1; index < values.length; index += 1) if (values[index] <= values[index - 1]) return Array.from(DEFAULT_LOD_THRESHOLDS);
    return values;
  }

  function selectTerrainLOD(distance, previousLod, thresholds = DEFAULT_LOD_THRESHOLDS, hysteresis = 0.12) {
    const safeThresholds = normalizeThresholds(thresholds);
    const safeDistance = Math.max(0, finite(distance));
    const band = clamp(hysteresis, 0, 0.45);
    if (previousLod == null || !Number.isFinite(Number(previousLod))) {
      let initial = 0;
      while (initial < safeThresholds.length && safeDistance > safeThresholds[initial]) initial += 1;
      return initial;
    }
    let target = normalizeLOD(previousLod);
    while (target < safeThresholds.length && safeDistance > safeThresholds[target] * (1 + band)) target += 1;
    while (target > 0 && safeDistance < safeThresholds[target - 1] * (1 - band)) target -= 1;
    return target;
  }

  function createDitherTransition(fromLod, toLod, startedAt, duration, now = startedAt) {
    const from = normalizeLOD(fromLod);
    const to = normalizeLOD(toLod);
    const start = Math.max(0, finite(startedAt));
    const milliseconds = clamp(duration, 50, 3000);
    const progress = from === to ? 1 : clamp01((Math.max(start, finite(now, start)) - start) / milliseconds);
    return Object.freeze({
      fromLod: from,
      toLod: to,
      progress,
      fromWeight: from === to ? 0 : 1 - progress,
      toWeight: from === to ? 1 : progress,
      dithering: from !== to && progress < 1,
      completed: from === to || progress >= 1
    });
  }

  class TerrainLODController {
    constructor(options = {}) {
      this.thresholds = Object.freeze(normalizeThresholds(options.thresholds));
      this.hysteresis = clamp(options.hysteresis == null ? 0.12 : options.hysteresis, 0, 0.45);
      this.transitionMs = clamp(options.transitionMs == null ? 320 : options.transitionMs, 50, 3000);
      this.maxEntries = Math.trunc(clamp(options.maxEntries == null ? 256 : options.maxEntries, 1, LIMITS.MAX_LOD_STATES));
      this._states = new Map();
      this._clock = 0;
      this.disposed = false;
    }

    update(key, distance, now = 0) {
      if (this.disposed) throw new Error("TerrainLODController is disposed");
      const id = safeId(key, "chunk");
      const timestamp = Math.max(0, finite(now));
      let state = this._states.get(id);
      const previous = state ? state.lod : null;
      const target = selectTerrainLOD(distance, previous, this.thresholds, this.hysteresis);
      if (!state) {
        state = { lod: target, fromLod: target, toLod: target, startedAt: timestamp, touched: ++this._clock };
        this._states.set(id, state);
        this._evict();
      } else {
        if (target !== state.lod) {
          state.fromLod = state.lod;
          state.toLod = target;
          state.lod = target;
          state.startedAt = timestamp;
        }
        state.touched = ++this._clock;
      }
      const transition = createDitherTransition(state.fromLod, state.toLod, state.startedAt, this.transitionMs, timestamp);
      if (transition.completed) { state.fromLod = state.lod; state.toLod = state.lod; }
      return Object.freeze({ key: id, lod: state.lod, distance: Math.max(0, finite(distance)), ...transition });
    }

    _evict() {
      while (this._states.size > this.maxEntries) {
        let oldestKey = null;
        let oldestTouch = Infinity;
        for (const [key, value] of this._states) {
          if (value.touched < oldestTouch) { oldestKey = key; oldestTouch = value.touched; }
        }
        if (oldestKey == null) break;
        this._states.delete(oldestKey);
      }
    }

    forget(key) { return this._states.delete(safeId(key, "chunk")); }
    clear() { const size = this._states.size; this._states.clear(); return size; }
    get size() { return this._states.size; }
    dispose() { if (this.disposed) return false; this.disposed = true; this._states.clear(); return true; }
  }

  function normalizeWorkerJob(input) {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const errors = [];
    if (source.format !== WORKER_JOB_FORMAT) errors.push("Unsupported landscape Worker job format");
    if (source.type !== "build-terrain-chunk") errors.push("Unsupported landscape Worker job type");
    const address = normalizeAddress(source.address || source);
    const config = normalizeConfig(source.config || {});
    const chunkX = Math.trunc(finite(source.chunkX, -1));
    const chunkZ = Math.trunc(finite(source.chunkZ, -1));
    if (chunkX < 0 || chunkZ < 0 || chunkX >= config.chunksPerAxis || chunkZ >= config.chunksPerAxis) errors.push("Chunk coordinates are outside the bounded world");
    const lod = normalizeLOD(source.lod);
    let resolution = LOD_PROFILES[lod].resolution;
    try { resolution = normalizeResolution(source.resolution, lod); }
    catch (error) { errors.push(error.message); }
    const normalized = {
      format: WORKER_JOB_FORMAT,
      type: "build-terrain-chunk",
      id: safeId(source.id, `${address.seed}:${chunkX}:${chunkZ}:lod${lod}`),
      address,
      config,
      chunkX,
      chunkZ,
      lod,
      resolution,
      includeNormals: source.includeNormals !== false,
      includeBiomeWeights: source.includeBiomeWeights === true,
      priority: Math.trunc(clamp(source.priority, -100, 100))
    };
    try {
      const bytes = JSON.stringify(normalized).length;
      if (bytes > LIMITS.MAX_WORKER_JOB_BYTES) errors.push("Landscape Worker job exceeds its serialization budget");
    } catch { errors.push("Landscape Worker job is not serializable"); }
    const valid = errors.length === 0;
    return { valid, ok: valid, error: valid ? "" : errors.join("; ").slice(0, 480), errors: Object.freeze(errors), job: Object.freeze(normalized) };
  }

  function createWorkerJob(input = {}) {
    const address = normalizeAddress(input.address || input);
    const config = normalizeConfig(input.config || input);
    const lod = normalizeLOD(input.lod);
    const candidate = {
      format: WORKER_JOB_FORMAT,
      type: "build-terrain-chunk",
      id: input.id,
      address,
      config,
      chunkX: input.chunkX,
      chunkZ: input.chunkZ,
      lod,
      resolution: input.resolution == null ? LOD_PROFILES[lod].resolution : input.resolution,
      includeNormals: input.includeNormals !== false,
      includeBiomeWeights: input.includeBiomeWeights === true,
      priority: input.priority
    };
    const validation = normalizeWorkerJob(candidate);
    if (!validation.valid) throw new TypeError(validation.errors.join("; "));
    return validation.job;
  }

  function validateWorkerJob(input) {
    return normalizeWorkerJob(input);
  }

  class GeometryBuildQueue {
    constructor(options = {}) {
      this.maxQueued = Math.trunc(clamp(options.maxQueued == null ? 48 : options.maxQueued, 1, LIMITS.MAX_QUEUE_SIZE));
      this.defaultMaxJobs = Math.trunc(clamp(options.maxJobsPerTick == null ? 2 : options.maxJobsPerTick, 1, LIMITS.MAX_BUILDS_PER_TICK));
      this.defaultBudgetMs = clamp(options.budgetMs == null ? 8 : options.budgetMs, 1, LIMITS.MAX_BUILD_BUDGET_MS);
      this._executor = typeof options.executor === "function" ? options.executor : null;
      this._queue = [];
      this._ids = new Set();
      this.disposed = false;
      this.processed = 0;
      this.failed = 0;
    }

    enqueue(input) {
      if (this.disposed) return false;
      const validation = validateWorkerJob(input);
      if (!validation.valid) throw new TypeError(validation.errors.join("; "));
      const job = validation.job;
      if (this._ids.has(job.id)) return false;
      if (this._queue.length >= this.maxQueued) {
        let lowestIndex = 0;
        for (let index = 1; index < this._queue.length; index += 1) {
          if (this._queue[index].priority < this._queue[lowestIndex].priority) lowestIndex = index;
        }
        if (job.priority <= this._queue[lowestIndex].priority) return false;
        this._ids.delete(this._queue[lowestIndex].id);
        this._queue.splice(lowestIndex, 1);
      }
      this._queue.push(job);
      this._ids.add(job.id);
      this._queue.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
      return true;
    }

    process(executor, budget = {}) {
      if (this.disposed) return Object.freeze({ built: 0, failed: 0, remaining: 0, elapsedMs: 0, results: Object.freeze([]) });
      const build = typeof executor === "function" ? executor : this._executor;
      if (typeof build !== "function") throw new TypeError("GeometryBuildQueue requires a synchronous job executor");
      const maxJobs = Math.trunc(clamp(budget.maxJobs ?? this.defaultMaxJobs, 1, LIMITS.MAX_BUILDS_PER_TICK));
      const maxMilliseconds = clamp(budget.maxMilliseconds ?? this.defaultBudgetMs, 1, LIMITS.MAX_BUILD_BUDGET_MS);
      const clock = typeof budget.now === "function" ? budget.now : (() => runtime.performance?.now?.() ?? Date.now());
      const started = finite(clock());
      const results = [];
      let built = 0;
      let failed = 0;
      while (built + failed < maxJobs && this._queue.length) {
        if (built + failed > 0 && finite(clock(), started) - started >= maxMilliseconds) break;
        const job = this._queue.shift();
        this._ids.delete(job.id);
        try {
          const value = build(job);
          if (value && typeof value.then === "function") throw new TypeError("GeometryBuildQueue executor must be synchronous; run async Worker messaging outside the queue");
          results.push(Object.freeze({ id: job.id, ok: true, value }));
          built += 1;
          this.processed += 1;
        } catch (error) {
          results.push(Object.freeze({ id: job.id, ok: false, error: String(error?.message || error).slice(0, 240) }));
          failed += 1;
          this.failed += 1;
        }
      }
      const elapsedMs = Math.max(0, finite(clock(), started) - started);
      return Object.freeze({ built, failed, remaining: this._queue.length, elapsedMs, results: Object.freeze(results) });
    }

    cancel(id) {
      const safe = safeId(id, "job");
      const index = this._queue.findIndex((job) => job.id === safe);
      if (index < 0) return false;
      this._queue.splice(index, 1);
      this._ids.delete(safe);
      return true;
    }

    clear() { const size = this._queue.length; this._queue.length = 0; this._ids.clear(); return size; }
    get size() { return this._queue.length; }
    getStatus() { return Object.freeze({ queued: this.size, maxQueued: this.maxQueued, processed: this.processed, failed: this.failed, disposed: this.disposed }); }
    dispose() { if (this.disposed) return false; this.clear(); this._executor = null; this.disposed = true; return true; }
  }

  class ProceduralLandscapeCore {
    constructor(options = {}) {
      this.address = normalizeAddress(options.address || options);
      this.config = normalizeConfig(options.config || options);
      this.seed = this.address.seed;
      this.seedHash = hashSeed(`${this.seed}|${this.address.realmId}|${this.address.timeSliceId}|${this.address.regionId}`);
      this.disposed = false;
      this._riverIndex = new Map();
      this._segments = [];
      this._riverById = new Map();
      this._network = this._buildRiverNetwork();
      this._buildRiverSpatialIndex();
    }

    _assertActive() {
      if (this.disposed) throw new Error("ProceduralLandscapeCore is disposed");
    }

    _coordinate(value, label) {
      const number = Number(value);
      if (!Number.isFinite(number)) throw new TypeError(`${label} must be a finite world coordinate`);
      return clamp(number, 0, this.config.worldSize);
    }

    _chunkIndex(value, label) {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 0 || number >= this.config.chunksPerAxis) throw new RangeError(`${label} is outside the bounded chunk grid`);
      return number;
    }

    _baseFieldsAt(worldX, worldZ) {
      const size = this.config.worldSize;
      const edgeDistance = Math.min(worldX, worldZ, size - worldX, size - worldZ);
      const edgeMask = smoothstep(0.018, 0.19, edgeDistance / size);
      const warpXNoise = fractalNoise2D(worldX, worldZ, mix32(this.seedHash ^ 0xa53a9b4d), { frequency: 1 / 2900, octaves: 4, gain: 0.52 });
      const warpZNoise = fractalNoise2D(worldX + 733, worldZ - 1193, mix32(this.seedHash ^ 0x7f4a7c15), { frequency: 1 / 2900, octaves: 4, gain: 0.52 });
      const warpedX = worldX + warpXNoise * 430;
      const warpedZ = worldZ + warpZNoise * 430;
      const continental = fractalNoise2D(warpedX, warpedZ, mix32(this.seedHash ^ 0xc2b2ae35), { frequency: 1 / 5900, octaves: 5, gain: 0.55 });
      const landSignal = continental * 0.68 + edgeMask * 0.78 - 0.28;
      const land = smoothstep(-0.22, 0.24, landSignal);
      const ridge = ridgedNoise2D(warpedX, warpedZ, mix32(this.seedHash ^ 0x27d4eb2f), { frequency: 1 / 1800, octaves: 5, gain: 0.5 });
      const ridgeMask = Math.pow(smoothstep(0.38, 0.86, ridge), 1.35) * smoothstep(0.25, 0.72, land);
      const hills = fractalNoise2D(warpedX, warpedZ, mix32(this.seedHash ^ 0x165667b1), { frequency: 1 / 740, octaves: 4, gain: 0.48 });
      const detail = fractalNoise2D(warpedX, warpedZ, mix32(this.seedHash ^ 0xd3a2646c), { frequency: 1 / 105, octaves: 4, gain: 0.43 });
      const drainageNoise = 1 - Math.abs(fractalNoise2D(warpedX, warpedZ, mix32(this.seedHash ^ 0x9e3779b9), { frequency: 1 / 980, octaves: 3, gain: 0.46 }));
      const drainage = Math.pow(smoothstep(0.72, 0.985, drainageNoise), 1.6) * land;
      const erosion = drainage * (7 + ridgeMask * 34 + Math.max(0, hills) * 9);
      const plateau = smoothstep(0.38, 0.72, fractalNoise2D(warpedX, warpedZ, mix32(this.seedHash ^ 0x94d049bb), { frequency: 1 / 2400, octaves: 3 })) * land;
      const relief = 13 + continental * 28 + hills * 31 + ridgeMask * 164 + plateau * 24 + detail * 4.2 - erosion;
      const height = lerp(this.config.seaLevel - 76 + continental * 14, this.config.seaLevel + relief, land);
      return { height, continental, ridge: ridgeMask, hills, detail, drainage, erosion, land, warpX: warpXNoise, warpZ: warpZNoise };
    }

    _rawHeightAt(worldX, worldZ) {
      return this._baseFieldsAt(worldX, worldZ).height;
    }

    _chooseSource(random, mouth, riverIndex) {
      const size = this.config.worldSize;
      let best = { x: size * 0.5, z: size * 0.5, score: -Infinity, height: this.config.seaLevel + 72 };
      for (let candidate = 0; candidate < 28; candidate += 1) {
        const margin = size * 0.19;
        const x = margin + random() * (size - margin * 2);
        const z = margin + random() * (size - margin * 2);
        const height = this._rawHeightAt(x, z);
        const mouthDistance = Math.hypot(x - mouth.x, z - mouth.z) / size;
        const separation = Math.sin((riverIndex + 1) * 1.71 + x / size * 4 + z / size * 3) * 3;
        const score = height + mouthDistance * 58 + separation;
        if (score > best.score) best = { x, z, score, height };
      }
      return best;
    }

    _makeRiver(id, source, mouth, random, options = {}) {
      const size = this.config.worldSize;
      const dx = mouth.x - source.x;
      const dz = mouth.z - source.z;
      const length = Math.max(1, Math.hypot(dx, dz));
      const perpendicularX = -dz / length;
      const perpendicularZ = dx / length;
      const bendA = (random() - 0.5) * Math.min(length * 0.34, size * 0.14);
      const bendB = (random() - 0.5) * Math.min(length * 0.3, size * 0.12);
      const controlA = {
        x: clamp(source.x + dx * 0.31 + perpendicularX * bendA, 0, size),
        z: clamp(source.z + dz * 0.31 + perpendicularZ * bendA, 0, size)
      };
      const controlB = {
        x: clamp(source.x + dx * 0.68 + perpendicularX * bendB, 0, size),
        z: clamp(source.z + dz * 0.68 + perpendicularZ * bendB, 0, size)
      };
      const pointCount = Math.trunc(clamp(Math.ceil(length / 96) + 1, 12, LIMITS.MAX_RIVER_POINTS));
      const targetEndBed = finite(options.endBed, this.config.seaLevel - 1.5);
      const rawStart = this._rawHeightAt(source.x, source.z);
      const startBed = Math.max(targetEndBed + 12, clamp(finite(options.startBed, rawStart - 2), this.config.seaLevel + 18, 250));
      const startWidth = clamp(options.startWidth ?? 4.5 + random() * 3, 2, 20);
      const endWidth = clamp(options.endWidth ?? 24 + random() * 13, startWidth + 1, 64);
      const points = [];
      for (let index = 0; index < pointCount; index += 1) {
        const t = index / (pointCount - 1);
        const curve = cubicBezier(source, controlA, controlB, mouth, t);
        const descent = Math.pow(1 - t, 1.18);
        const bedHeight = targetEndBed + (startBed - targetEndBed) * descent;
        points.push(Object.freeze({
          x: clamp(curve.x, 0, size),
          z: clamp(curve.z, 0, size),
          bedHeight,
          width: lerp(startWidth, endWidth, smoothstep(0, 1, t)),
          discharge: lerp(0.16, 1, Math.pow(t, 0.72)),
          t
        }));
      }
      return Object.freeze({
        id: safeId(id, "river"),
        basinId: safeId(options.basinId || id, "basin"),
        parentId: options.parentId ? safeId(options.parentId, "river") : null,
        kind: options.parentId ? "tributary" : "primary",
        source: Object.freeze({ x: points[0].x, z: points[0].z, elevation: points[0].bedHeight }),
        mouth: Object.freeze({ x: points[points.length - 1].x, z: points[points.length - 1].z, elevation: points[points.length - 1].bedHeight }),
        points: Object.freeze(points)
      });
    }

    _buildRiverNetwork() {
      const random = createSeededRandom(`${this.seedHash}:river-network`);
      const size = this.config.worldSize;
      const rivers = [];
      for (let index = 0; index < this.config.riverCount; index += 1) {
        const edge = (index + Math.floor(random() * 4)) % 4;
        const along = size * (0.08 + random() * 0.84);
        const mouth = edge === 0 ? { x: 0, z: along }
          : edge === 1 ? { x: size, z: along }
            : edge === 2 ? { x: along, z: 0 }
              : { x: along, z: size };
        const source = this._chooseSource(random, mouth, index);
        const primary = this._makeRiver(`river-${index + 1}`, source, mouth, random, { basinId: `basin-${index + 1}` });
        rivers.push(primary);
        if (rivers.length >= LIMITS.MAX_RIVERS || index % 2 !== 0) continue;
        const junctionIndex = Math.trunc(clamp(Math.floor(primary.points.length * (0.48 + random() * 0.22)), 3, primary.points.length - 3));
        const junction = primary.points[junctionIndex];
        const previous = primary.points[junctionIndex - 1];
        const vx = junction.x - previous.x;
        const vz = junction.z - previous.z;
        const length = Math.max(1, Math.hypot(vx, vz));
        const side = random() < 0.5 ? -1 : 1;
        const reach = size * (0.1 + random() * 0.08);
        const sourceBranch = {
          x: clamp(junction.x + (-vz / length) * reach * side + (random() - 0.5) * reach * 0.35, size * 0.08, size * 0.92),
          z: clamp(junction.z + (vx / length) * reach * side + (random() - 0.5) * reach * 0.35, size * 0.08, size * 0.92)
        };
        const tributary = this._makeRiver(`river-${index + 1}-tributary`, sourceBranch, { x: junction.x, z: junction.z }, random, {
          basinId: primary.basinId,
          parentId: primary.id,
          endBed: junction.bedHeight,
          startBed: Math.max(junction.bedHeight + 14, this._rawHeightAt(sourceBranch.x, sourceBranch.z) - 1),
          endWidth: Math.max(7, junction.width * 0.58),
          startWidth: 3.2 + random() * 2
        });
        rivers.push(tributary);
      }
      const bounded = rivers.slice(0, LIMITS.MAX_RIVERS);
      bounded.forEach((river) => this._riverById.set(river.id, river));
      return Object.freeze(bounded);
    }

    _buildRiverSpatialIndex() {
      const cellSize = this.config.riverIndexCellSize;
      let references = 0;
      for (const river of this._network) {
        for (let index = 0; index < river.points.length - 1; index += 1) {
          if (this._segments.length >= LIMITS.MAX_RIVER_SEGMENTS) break;
          const a = river.points[index];
          const b = river.points[index + 1];
          const segment = Object.freeze({
            id: `${river.id}:${index}`,
            riverId: river.id,
            basinId: river.basinId,
            parentId: river.parentId,
            index,
            a,
            b,
            maximumWidth: Math.max(a.width, b.width)
          });
          this._segments.push(segment);
          const expansion = segment.maximumWidth * 3.2;
          const minimumCellX = Math.floor((Math.min(a.x, b.x) - expansion) / cellSize);
          const maximumCellX = Math.floor((Math.max(a.x, b.x) + expansion) / cellSize);
          const minimumCellZ = Math.floor((Math.min(a.z, b.z) - expansion) / cellSize);
          const maximumCellZ = Math.floor((Math.max(a.z, b.z) + expansion) / cellSize);
          for (let cellZ = minimumCellZ; cellZ <= maximumCellZ && references < LIMITS.MAX_RIVER_INDEX_REFERENCES; cellZ += 1) {
            for (let cellX = minimumCellX; cellX <= maximumCellX && references < LIMITS.MAX_RIVER_INDEX_REFERENCES; cellX += 1) {
              const key = `${cellX}:${cellZ}`;
              let bucket = this._riverIndex.get(key);
              if (!bucket) { bucket = []; this._riverIndex.set(key, bucket); }
              bucket.push(segment);
              references += 1;
            }
          }
        }
      }
      this._segments = Object.freeze(this._segments);
    }

    _nearestRiver(worldX, worldZ, maximumDistance = 640) {
      const distanceLimit = clamp(maximumDistance, 0, this.config.worldSize * 1.5);
      const cellSize = this.config.riverIndexCellSize;
      const cellX = Math.floor(worldX / cellSize);
      const cellZ = Math.floor(worldZ / cellSize);
      const radius = Math.trunc(clamp(Math.ceil(distanceLimit / cellSize), 0, 4));
      let best = null;
      let bestDistanceSquared = distanceLimit * distanceLimit;
      const inspect = (segment) => {
        const projection = pointSegmentDistanceSquared(worldX, worldZ, segment.a.x, segment.a.z, segment.b.x, segment.b.z);
        if (projection.distanceSquared > bestDistanceSquared) return;
        bestDistanceSquared = projection.distanceSquared;
        best = { segment, projection };
      };
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const bucket = this._riverIndex.get(`${cellX + dx}:${cellZ + dz}`);
          if (bucket) for (const segment of bucket) inspect(segment);
        }
      }
      if (!best && distanceLimit > cellSize * 4) for (const segment of this._segments) inspect(segment);
      if (!best) return null;
      const amount = best.projection.t;
      return {
        segment: best.segment,
        distance: Math.sqrt(bestDistanceSquared),
        x: best.projection.x,
        z: best.projection.z,
        t: amount,
        width: lerp(best.segment.a.width, best.segment.b.width, amount),
        bedHeight: lerp(best.segment.a.bedHeight, best.segment.b.bedHeight, amount),
        discharge: lerp(best.segment.a.discharge, best.segment.b.discharge, amount)
      };
    }

    _heightAt(worldX, worldZ) {
      const raw = this._rawHeightAt(worldX, worldZ);
      const river = this._nearestRiver(worldX, worldZ, 220);
      if (!river) return raw;
      const outerWidth = river.width * 3.15;
      if (river.distance >= outerWidth) return raw;
      const influence = 1 - smoothstep(river.width * 0.72, outerWidth, river.distance);
      const bankFactor = clamp01(river.distance / Math.max(1, river.width));
      const targetHeight = river.bedHeight + bankFactor * bankFactor * (4.5 + river.discharge * 2.5);
      return lerp(raw, targetHeight, influence);
    }

    sampleHeight(x, z) {
      this._assertActive();
      return this._heightAt(this._coordinate(x, "x"), this._coordinate(z, "z"));
    }

    sampleNormal(x, z, spacing = 3) {
      this._assertActive();
      const worldX = this._coordinate(x, "x");
      const worldZ = this._coordinate(z, "z");
      const step = clamp(spacing, 0.25, 32);
      const leftX = Math.max(0, worldX - step);
      const rightX = Math.min(this.config.worldSize, worldX + step);
      const backZ = Math.max(0, worldZ - step);
      const frontZ = Math.min(this.config.worldSize, worldZ + step);
      const dxDistance = Math.max(0.001, rightX - leftX);
      const dzDistance = Math.max(0.001, frontZ - backZ);
      const derivativeX = (this._heightAt(rightX, worldZ) - this._heightAt(leftX, worldZ)) / dxDistance;
      const derivativeZ = (this._heightAt(worldX, frontZ) - this._heightAt(worldX, backZ)) / dzDistance;
      const length = Math.hypot(derivativeX, 1, derivativeZ) || 1;
      return Object.freeze({ x: -derivativeX / length, y: 1 / length, z: -derivativeZ / length });
    }

    _climateAt(worldX, worldZ, height, slope, waterDistance) {
      const latitude = Math.abs(worldZ / this.config.worldSize * 2 - 1);
      let temperature = 0.92 - latitude * 0.58 - Math.max(0, height - this.config.seaLevel) / 520;
      if (this.address.realmId === "ice-age") temperature -= 0.25;
      else if (this.address.realmId === "mesozoic") temperature += 0.08;
      else if (this.address.realmId === "paleozoic") temperature += 0.04;
      temperature += fractalNoise2D(worldX, worldZ, mix32(this.seedHash ^ 0x6a09e667), { frequency: 1 / 3600, octaves: 3 }) * 0.13;
      temperature = clamp01(temperature);
      let moisture = 0.5 + fractalNoise2D(worldX, worldZ, mix32(this.seedHash ^ 0xbb67ae85), { frequency: 1 / 2300, octaves: 4 }) * 0.34;
      moisture += (1 - smoothstep(0, 620, waterDistance)) * 0.32;
      moisture -= slope * 0.16;
      if (/swamp|wetland|rainforest|carboniferous|kem-kem/.test(this.address.timeSliceId)) moisture += 0.16;
      if (/permian|triassic|desert/.test(this.address.timeSliceId)) moisture -= 0.17;
      return { temperature, moisture: clamp01(moisture) };
    }

    _biomeWeights(height, slope, moisture, temperature, waterDistance, fields) {
      const sea = this.config.seaLevel;
      const aboveSea = height - sea;
      const weights = {
        ocean: smoothstep(5, -18, aboveSea) * (0.75 + (1 - fields.land) * 0.5),
        reef: smoothstep(-42, -2, aboveSea) * smoothstep(3, -1, aboveSea) * smoothstep(0.28, 0.78, temperature) * (1 - slope) * 0.75,
        wetland: smoothstep(260, 0, waterDistance) * smoothstep(0.5, 0.9, moisture) * smoothstep(0.35, 0.04, slope) * smoothstep(-2, 13, aboveSea),
        rainforest: smoothstep(0.64, 0.94, moisture) * smoothstep(0.58, 0.88, temperature) * smoothstep(0.58, 0.08, slope) * smoothstep(0, 18, aboveSea),
        forest: smoothstep(0.4, 0.76, moisture) * smoothstep(0.22, 0.68, temperature) * smoothstep(0.68, 0.1, slope) * smoothstep(-1, 13, aboveSea),
        grassland: smoothstep(0.2, 0.48, moisture) * smoothstep(0.76, 0.42, moisture) * smoothstep(0.16, 0.62, temperature) * smoothstep(0.48, 0.05, slope) * smoothstep(0, 12, aboveSea),
        desert: smoothstep(0.34, 0.04, moisture) * smoothstep(0.44, 0.78, temperature) * smoothstep(0.58, 0.06, slope) * smoothstep(0, 16, aboveSea),
        tundra: smoothstep(0.39, 0.08, temperature) * smoothstep(0.56, 0.08, slope) * smoothstep(-1, 12, aboveSea),
        alpine: smoothstep(92, 195, aboveSea) * smoothstep(0.14, 0.62, slope) * (0.55 + (1 - temperature) * 0.45),
        volcanic: smoothstep(0.62, 0.92, fractalNoise2D(height + fields.warpX * 10, fields.warpZ * 10, mix32(this.seedHash ^ 0x3c6ef372), { frequency: 1 / 110, octaves: 3 })) * smoothstep(0.28, 0.8, slope) * smoothstep(16, 86, aboveSea)
      };
      const realmMultipliers = REALM_BIOME_MULTIPLIERS[this.address.realmId] || REALM_BIOME_MULTIPLIERS.modern;
      const sliceMultipliers = timeSliceBias(this.address.timeSliceId);
      let total = 0;
      for (const biomeId of BIOME_IDS) {
        weights[biomeId] = Math.max(0.000001, finite(weights[biomeId]) * realmMultipliers[biomeId] * sliceMultipliers[biomeId]);
        total += weights[biomeId];
      }
      if (!(total > 0)) { weights.grassland = 1; total = 1; }
      for (const biomeId of BIOME_IDS) weights[biomeId] /= total;
      return weights;
    }

    sample(x, z) {
      this._assertActive();
      const worldX = this._coordinate(x, "x");
      const worldZ = this._coordinate(z, "z");
      const fields = this._baseFieldsAt(worldX, worldZ);
      const river = this._nearestRiver(worldX, worldZ, 2048);
      const height = this._heightAt(worldX, worldZ);
      const normal = this.sampleNormal(worldX, worldZ, 3);
      // Horizontal normal magnitude is a stable, renderer-friendly 0..1 slope
      // measure (sin of the slope angle). It preserves much more useful range
      // than 1-normal.y on ordinary hills.
      const slope = clamp01(Math.hypot(normal.x, normal.z));
      const edgeWaterDistance = Math.min(worldX, worldZ, this.config.worldSize - worldX, this.config.worldSize - worldZ);
      const waterDistance = height <= this.config.seaLevel ? 0 : Math.min(edgeWaterDistance, river?.distance ?? this.config.worldSize);
      const climate = this._climateAt(worldX, worldZ, height, slope, waterDistance);
      const biomeWeights = this._biomeWeights(height, slope, climate.moisture, climate.temperature, waterDistance, fields);
      let primaryBiome = BIOME_IDS[0];
      for (const biomeId of BIOME_IDS) if (biomeWeights[biomeId] > biomeWeights[primaryBiome]) primaryBiome = biomeId;
      return Object.freeze({
        x: worldX,
        z: worldZ,
        height,
        normal,
        slope,
        slopeDegrees: Math.acos(clamp(normal.y, -1, 1)) * 180 / Math.PI,
        moisture: climate.moisture,
        temperature: climate.temperature,
        waterDistance,
        continental: fields.continental,
        ridge: fields.ridge,
        detail: fields.detail,
        drainage: fields.drainage,
        erosion: fields.erosion,
        domainWarp: Object.freeze({ x: fields.warpX, z: fields.warpZ }),
        biomeWeights: Object.freeze(biomeWeights),
        primaryBiome,
        biomeId: primaryBiome,
        biome: primaryBiome,
        heat: climate.temperature,
        wetness: climate.moisture,
        macroVariation: clamp01(fields.detail * 0.5 + 0.5),
        river: river && river.distance <= river.width * 3.15 ? Object.freeze({ riverId: river.segment.riverId, basinId: river.segment.basinId, distance: river.distance, width: river.width, discharge: river.discharge, bedHeight: river.bedHeight }) : null
      });
    }

    getBiomeWeights(x, z) { return this.sample(x, z).biomeWeights; }

    queryRiverAt(x, z, maximumDistance = 1024) {
      this._assertActive();
      const worldX = this._coordinate(x, "x");
      const worldZ = this._coordinate(z, "z");
      const river = this._nearestRiver(worldX, worldZ, maximumDistance);
      if (!river) return null;
      const segment = river.segment;
      const sourceRiver = this._riverById.get(segment.riverId);
      const downstreamPoint = river.t >= 0.999999 && sourceRiver?.points[segment.index + 2]
        ? sourceRiver.points[segment.index + 2]
        : segment.b;
      const directionX = downstreamPoint.x - river.x;
      const directionZ = downstreamPoint.z - river.z;
      const length = Math.hypot(directionX, directionZ) || 1;
      return Object.freeze({
        riverId: segment.riverId,
        basinId: segment.basinId,
        segmentId: segment.id,
        segmentIndex: segment.index,
        distance: river.distance,
        nearest: Object.freeze({ x: river.x, z: river.z }),
        downstream: Object.freeze({ x: downstreamPoint.x, z: downstreamPoint.z, bedHeight: downstreamPoint.bedHeight }),
        direction: Object.freeze({ x: directionX / length, z: directionZ / length }),
        bedHeight: river.bedHeight,
        width: river.width,
        discharge: river.discharge,
        inChannel: river.distance <= river.width
      });
    }

    queryRiverBasin(x, z) {
      this._assertActive();
      const worldX = this._coordinate(x, "x");
      const worldZ = this._coordinate(z, "z");
      const river = this._nearestRiver(worldX, worldZ, this.config.worldSize * 1.5);
      if (river) {
        const info = this.queryRiverAt(worldX, worldZ, this.config.worldSize * 1.5);
        return Object.freeze({
          basinId: info.basinId,
          riverId: info.riverId,
          distanceToRiver: info.distance,
          elevation: this._heightAt(worldX, worldZ),
          downstream: info.downstream,
          flowDirection: info.direction,
          terminal: this._riverById.get(info.riverId)?.parentId ? "confluence" : "ocean"
        });
      }
      const step = 48;
      const currentHeight = this._heightAt(worldX, worldZ);
      let best = { x: worldX, z: worldZ, height: currentHeight };
      for (let direction = 0; direction < 8; direction += 1) {
        const angle = direction / 8 * Math.PI * 2;
        const px = clamp(worldX + Math.cos(angle) * step, 0, this.config.worldSize);
        const pz = clamp(worldZ + Math.sin(angle) * step, 0, this.config.worldSize);
        const height = this._heightAt(px, pz);
        if (height < best.height) best = { x: px, z: pz, height };
      }
      const length = Math.hypot(best.x - worldX, best.z - worldZ) || 1;
      return Object.freeze({
        basinId: `local-${Math.floor(worldX / 2048)}-${Math.floor(worldZ / 2048)}`,
        riverId: null,
        distanceToRiver: Infinity,
        elevation: currentHeight,
        downstream: Object.freeze(best),
        flowDirection: Object.freeze({ x: (best.x - worldX) / length, z: (best.z - worldZ) / length }),
        terminal: best.height < currentHeight ? "drainage" : "closed-basin"
      });
    }

    getRiverNetwork() {
      this._assertActive();
      return this._network;
    }

    getRiversForChunk(chunkX, chunkZ) {
      this._assertActive();
      const cx = this._chunkIndex(chunkX, "chunkX");
      const cz = this._chunkIndex(chunkZ, "chunkZ");
      const minimumX = cx * this.config.chunkSize;
      const maximumX = minimumX + this.config.chunkSize;
      const minimumZ = cz * this.config.chunkSize;
      const maximumZ = minimumZ + this.config.chunkSize;
      const rows = [];
      for (const segment of this._segments) {
        const expansion = segment.maximumWidth * 3.15;
        if (Math.max(segment.a.x, segment.b.x) + expansion < minimumX || Math.min(segment.a.x, segment.b.x) - expansion > maximumX) continue;
        if (Math.max(segment.a.z, segment.b.z) + expansion < minimumZ || Math.min(segment.a.z, segment.b.z) - expansion > maximumZ) continue;
        rows.push(Object.freeze({ id: segment.id, riverId: segment.riverId, basinId: segment.basinId, a: segment.a, b: segment.b, maximumWidth: segment.maximumWidth }));
        if (rows.length >= LIMITS.MAX_RIVER_SEGMENTS_PER_CHUNK) break;
      }
      return Object.freeze(rows);
    }

    getSheltersForChunk(chunkX, chunkZ) {
      this._assertActive();
      const cx = this._chunkIndex(chunkX, "chunkX");
      const cz = this._chunkIndex(chunkZ, "chunkZ");
      const random = createSeededRandom(`${this.seedHash}:shelter:${cx}:${cz}`);
      const rows = [];
      for (let candidate = 0; candidate < 7 && rows.length < LIMITS.MAX_SHELTERS_PER_CHUNK; candidate += 1) {
        const x = (cx + 0.08 + random() * 0.84) * this.config.chunkSize;
        const z = (cz + 0.08 + random() * 0.84) * this.config.chunkSize;
        const sample = this.sample(x, z);
        const cavity = ridgedNoise2D(x, z, mix32(this.seedHash ^ 0x510e527f), { frequency: 1 / 92, octaves: 3 });
        const caveEligible = sample.slope > 0.22 && sample.height > this.config.seaLevel + 9 && cavity > 0.64;
        const shelterEligible = sample.slope > 0.11 && sample.height > this.config.seaLevel + 4 && cavity > 0.53;
        if (!caveEligible && !shelterEligible) continue;
        const type = caveEligible && sample.slope > 0.34 ? "cave" : "rock-shelter";
        const normal = sample.normal;
        const radius = type === "cave" ? 2.8 + random() * 7.2 : 1.8 + random() * 4.6;
        rows.push(Object.freeze({
          id: `shelter-${cx}-${cz}-${candidate}`,
          type,
          position: Object.freeze({ x, y: sample.height + radius * 0.18, z }),
          entranceNormal: Object.freeze({ x: normal.x, y: Math.max(0.08, normal.y * 0.25), z: normal.z }),
          radius,
          depth: type === "cave" ? radius * (1.8 + random() * 2.4) : radius * (0.7 + random() * 0.7),
          ceiling: radius * (0.65 + random() * 0.55),
          rainOcclusion: type === "cave" ? clamp(0.72 + random() * 0.24, 0, 1) : clamp(0.38 + random() * 0.38, 0, 1),
          proceduralDescriptorOnly: true
        }));
      }
      return Object.freeze(rows);
    }

    describeChunk(chunkX, chunkZ, options = {}) {
      this._assertActive();
      const cx = this._chunkIndex(chunkX, "chunkX");
      const cz = this._chunkIndex(chunkZ, "chunkZ");
      const lod = normalizeLOD(options.lod);
      const resolution = normalizeResolution(options.resolution, lod);
      const originX = cx * this.config.chunkSize;
      const originZ = cz * this.config.chunkSize;
      let minimumHeight = Infinity;
      let maximumHeight = -Infinity;
      const biomeTotals = Object.fromEntries(BIOME_IDS.map((id) => [id, 0]));
      for (let zIndex = 0; zIndex < 5; zIndex += 1) {
        for (let xIndex = 0; xIndex < 5; xIndex += 1) {
          const sample = this.sample(originX + xIndex / 4 * this.config.chunkSize, originZ + zIndex / 4 * this.config.chunkSize);
          minimumHeight = Math.min(minimumHeight, sample.height);
          maximumHeight = Math.max(maximumHeight, sample.height);
          for (const biomeId of BIOME_IDS) biomeTotals[biomeId] += sample.biomeWeights[biomeId];
        }
      }
      const dominantBiomes = BIOME_IDS.map((id) => ({ id, weight: biomeTotals[id] / 25 }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
        .map((row) => Object.freeze(row));
      return Object.freeze({
        format: FORMAT,
        key: `${this.address.timeSliceId}:${cx}:${cz}`,
        chunkX: cx,
        chunkZ: cz,
        lod,
        resolution,
        origin: Object.freeze({ x: originX, z: originZ }),
        bounds: Object.freeze({ minimumX: originX, maximumX: originX + this.config.chunkSize, minimumZ: originZ, maximumZ: originZ + this.config.chunkSize, minimumHeight, maximumHeight }),
        estimatedVertices: resolution * resolution,
        estimatedIndices: (resolution - 1) * (resolution - 1) * 6,
        dominantBiomes: Object.freeze(dominantBiomes),
        rivers: this.getRiversForChunk(cx, cz),
        shelters: this.getSheltersForChunk(cx, cz),
        address: this.address
      });
    }

    createWorkerJob(options = {}, chunkZ, workerOptions = {}) {
      this._assertActive();
      let source = options;
      if (Number.isFinite(Number(options)) && Number.isFinite(Number(chunkZ))) {
        const requested = workerOptions && typeof workerOptions === "object" && !Array.isArray(workerOptions) ? workerOptions : {};
        const segments = requested.segments == null ? null : Math.trunc(clamp(requested.segments, 2, LIMITS.MAX_GEOMETRY_RESOLUTION - 1));
        const derivedLod = segments == null ? normalizeLOD(requested.lod)
          : segments >= 49 ? 0 : segments >= 25 ? 1 : segments >= 13 ? 2 : 3;
        source = {
          ...requested,
          chunkX: Math.trunc(Number(options)),
          chunkZ: Math.trunc(Number(chunkZ)),
          lod: derivedLod,
          resolution: segments == null ? requested.resolution : segments + 1
        };
      }
      return createWorkerJob({
        ...(source && typeof source === "object" ? source : {}),
        address: this.address,
        config: this.config
      });
    }

    buildChunkGeometry(chunkX, chunkZ, options = {}) {
      this._assertActive();
      const descriptor = this.describeChunk(chunkX, chunkZ, options);
      const resolution = descriptor.resolution;
      const vertexCount = resolution * resolution;
      const indexCount = (resolution - 1) * (resolution - 1) * 6;
      const positions = new Float32Array(vertexCount * 3);
      const normals = options.includeNormals === false ? null : new Float32Array(vertexCount * 3);
      const uvs = new Float32Array(vertexCount * 2);
      const biomeWeights = options.includeBiomeWeights === true ? new Float32Array(vertexCount * BIOME_IDS.length) : null;
      const indices = vertexCount <= 65535 ? new Uint16Array(indexCount) : new Uint32Array(indexCount);
      const step = this.config.chunkSize / (resolution - 1);
      let vertex = 0;
      for (let zIndex = 0; zIndex < resolution; zIndex += 1) {
        const worldZ = descriptor.origin.z + zIndex * step;
        for (let xIndex = 0; xIndex < resolution; xIndex += 1) {
          const worldX = descriptor.origin.x + xIndex * step;
          const positionOffset = vertex * 3;
          positions[positionOffset] = xIndex * step - this.config.chunkSize / 2;
          positions[positionOffset + 1] = this._heightAt(worldX, worldZ);
          positions[positionOffset + 2] = zIndex * step - this.config.chunkSize / 2;
          const uvOffset = vertex * 2;
          uvs[uvOffset] = xIndex / (resolution - 1);
          uvs[uvOffset + 1] = zIndex / (resolution - 1);
          if (normals) {
            const normal = this.sampleNormal(worldX, worldZ, Math.min(4, step * 0.25));
            normals[positionOffset] = normal.x;
            normals[positionOffset + 1] = normal.y;
            normals[positionOffset + 2] = normal.z;
          }
          if (biomeWeights) {
            const weights = this.sample(worldX, worldZ).biomeWeights;
            const biomeOffset = vertex * BIOME_IDS.length;
            for (let biomeIndex = 0; biomeIndex < BIOME_IDS.length; biomeIndex += 1) biomeWeights[biomeOffset + biomeIndex] = weights[BIOME_IDS[biomeIndex]];
          }
          vertex += 1;
        }
      }
      let cursor = 0;
      for (let zIndex = 0; zIndex < resolution - 1; zIndex += 1) {
        for (let xIndex = 0; xIndex < resolution - 1; xIndex += 1) {
          const topLeft = zIndex * resolution + xIndex;
          const topRight = topLeft + 1;
          const bottomLeft = topLeft + resolution;
          const bottomRight = bottomLeft + 1;
          indices[cursor++] = topLeft;
          indices[cursor++] = bottomLeft;
          indices[cursor++] = topRight;
          indices[cursor++] = topRight;
          indices[cursor++] = bottomLeft;
          indices[cursor++] = bottomRight;
        }
      }
      return {
        format: GEOMETRY_FORMAT,
        id: descriptor.key,
        coordinateSpace: "chunk-centered",
        chunkX: descriptor.chunkX,
        chunkZ: descriptor.chunkZ,
        lod: descriptor.lod,
        resolution,
        origin: descriptor.origin,
        bounds: descriptor.bounds,
        biomeIds: BIOME_IDS,
        positions,
        normals,
        uvs,
        biomeWeights,
        indices,
        biomeSummary: descriptor.dominantBiomes,
        rivers: descriptor.rivers,
        shelters: descriptor.shelters
      };
    }

    executeWorkerJob(input) {
      this._assertActive();
      const validation = validateWorkerJob(input);
      if (!validation.valid) throw new TypeError(validation.errors.join("; "));
      const job = validation.job;
      if (job.address.seed !== this.address.seed || job.address.realmId !== this.address.realmId || job.address.timeSliceId !== this.address.timeSliceId || job.address.regionId !== this.address.regionId) {
        throw new Error("Worker job address does not match this landscape core");
      }
      if (job.config.worldSize !== this.config.worldSize || job.config.chunkSize !== this.config.chunkSize) throw new Error("Worker job world configuration does not match this landscape core");
      return this.buildChunkGeometry(job.chunkX, job.chunkZ, job);
    }

    getStatus() {
      return Object.freeze({
        version: VERSION,
        seed: this.seed,
        address: this.address,
        config: this.config,
        rivers: this._network.length,
        riverSegments: this._segments.length,
        riverIndexCells: this._riverIndex.size,
        disposed: this.disposed
      });
    }

    dispose() {
      if (this.disposed) return false;
      this.disposed = true;
      this._riverIndex.clear();
      this._riverById.clear();
      this._segments = Object.freeze([]);
      this._network = Object.freeze([]);
      return true;
    }
  }

  function createLandscapeCore(options = {}) {
    return new ProceduralLandscapeCore(options);
  }

  function executeWorkerJob(input) {
    const validation = validateWorkerJob(input);
    if (!validation.valid) throw new TypeError(validation.errors.join("; "));
    const core = new ProceduralLandscapeCore({ address: validation.job.address, config: validation.job.config });
    try { return core.executeWorkerJob(validation.job); }
    finally { core.dispose(); }
  }

  function geometryTransferables(geometry) {
    const buffers = [];
    for (const key of ["positions", "normals", "uvs", "biomeWeights", "indices"]) {
      const value = geometry?.[key];
      if (ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer && value.buffer.byteLength > 0 && !buffers.includes(value.buffer)) buffers.push(value.buffer);
    }
    return buffers;
  }

  return Object.freeze({
    VERSION,
    FORMAT,
    WORKER_JOB_FORMAT,
    GEOMETRY_FORMAT,
    UINT32_MAX,
    WORLD_DEFAULTS,
    LIMITS,
    REALM_IDS,
    BIOME_IDS,
    LOD_PROFILES,
    DEFAULT_LOD_THRESHOLDS,
    hashSeed,
    mix32,
    noise2D,
    fractalNoise2D,
    ridgedNoise2D,
    domainWarp2D,
    normalizeAddress,
    normalizeConfig,
    selectTerrainLOD,
    createDitherTransition,
    createWorkerJob,
    validateWorkerJob,
    executeWorkerJob,
    geometryTransferables,
    TerrainLODController,
    GeometryBuildQueue,
    ProceduralLandscapeCore,
    createLandscapeCore
  });
});
