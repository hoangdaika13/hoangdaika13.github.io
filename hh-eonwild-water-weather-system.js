(function (global, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory(global || {});
  else if (global) global.HHEonWildWaterWeather = factory(global);
}(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : {}), function createHHEonWildWaterWeather(runtime) {
  "use strict";

  /*
   * HH EonWild water, weather and atmosphere kernel.
   *
   * The simulation is deterministic and descriptor-first. Babylon.js is an
   * optional view adapter; deleting every cinematic asset still leaves a complete
   * procedural representation for WebGL2, Canvas Lite and Node-based tests.
   * Transient effects use fixed object pools. No splash, rain drop, ripple, wake,
   * footprint or disturbance creates its own Babylon mesh.
   */
  const VERSION = "1.0.0";
  const FORMAT = "hh-eonwild-water-weather-v1";
  const WEATHER_TYPES = Object.freeze(["clear", "mist", "rain", "storm", "snow", "ash", "dust"]);
  const WATER_TYPES = Object.freeze(["ocean", "lake", "river", "waterfall"]);
  const QUALITY_ORDER = Object.freeze(["lite", "high", "ultra", "cinematic"]);
  const HARD_LIMITS = Object.freeze({
    waterBodies: 192,
    meshes: 192,
    materials: 4,
    foam: 512,
    ripples: 768,
    wakes: 256,
    rainLayers: 4,
    weatherSplashes: 384,
    weatherRipples: 384,
    thunder: 12,
    footprints: 1024,
    interactionSplashes: 256,
    disturbances: 512,
    wetnessPatches: 512,
    riverPoints: 512,
    rivers: 256,
    basins: 256,
    fogLayers: 6
  });
  const QUALITY_PROFILES = Object.freeze({
    lite: Object.freeze({
      waterBodies: 24, foam: 32, ripples: 48, wakes: 16,
      weatherSplashes: 24, weatherRipples: 32, rainLayers: 1,
      footprints: 96, interactionSplashes: 32, disturbances: 48, wetnessPatches: 48,
      fogLayers: 2, cloudMode: "gradient-dome", volumetricSteps: 0,
      reflection: "sky-color", refraction: false, caustics: false
    }),
    high: Object.freeze({
      waterBodies: 64, foam: 96, ripples: 144, wakes: 48,
      weatherSplashes: 72, weatherRipples: 96, rainLayers: 2,
      footprints: 256, interactionSplashes: 80, disturbances: 128, wetnessPatches: 128,
      fogLayers: 4, cloudMode: "layered-noise", volumetricSteps: 0,
      reflection: "planar-bounded", refraction: true, caustics: "analytic"
    }),
    ultra: Object.freeze({
      waterBodies: 112, foam: 192, ripples: 288, wakes: 96,
      weatherSplashes: 160, weatherRipples: 192, rainLayers: 3,
      footprints: 512, interactionSplashes: 144, disturbances: 256, wetnessPatches: 256,
      fogLayers: 5, cloudMode: "volumetric-limited", volumetricSteps: 24,
      reflection: "ssr-with-probe-fallback", refraction: true, caustics: "projected"
    }),
    cinematic: Object.freeze({
      waterBodies: 160, foam: 384, ripples: 512, wakes: 192,
      weatherSplashes: 288, weatherRipples: 320, rainLayers: 3,
      footprints: 768, interactionSplashes: 224, disturbances: 384, wetnessPatches: 384,
      fogLayers: 6, cloudMode: "volumetric-personal", volumetricSteps: 40,
      reflection: "ssr-probe-planar", refraction: true, caustics: "temporal-projected"
    })
  });
  const WEATHER_PROFILES = Object.freeze({
    clear: Object.freeze({ precipitation: 0, wetRate: 0, dryRate: 0.018, wind: 0.18, cloud: 0.12, visibility: 1, temperatureOffset: 1 }),
    mist: Object.freeze({ precipitation: 0, wetRate: 0, dryRate: 0.004, wind: 0.05, cloud: 0.5, visibility: 0.52, temperatureOffset: -1 }),
    rain: Object.freeze({ precipitation: 0.68, wetRate: 0.09, dryRate: 0, wind: 0.42, cloud: 0.82, visibility: 0.68, temperatureOffset: -2 }),
    storm: Object.freeze({ precipitation: 1, wetRate: 0.15, dryRate: 0, wind: 1, cloud: 1, visibility: 0.42, temperatureOffset: -4 }),
    snow: Object.freeze({ precipitation: 0.42, wetRate: 0.028, dryRate: 0, wind: 0.35, cloud: 0.75, visibility: 0.62, temperatureOffset: -7 }),
    ash: Object.freeze({ precipitation: 0, wetRate: 0, dryRate: 0.01, wind: 0.46, cloud: 0.86, visibility: 0.38, temperatureOffset: 2 }),
    dust: Object.freeze({ precipitation: 0, wetRate: 0, dryRate: 0.032, wind: 0.72, cloud: 0.48, visibility: 0.35, temperatureOffset: 4 })
  });

  const finite = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, finite(value, min)));
  const integer = (value, fallback = 0) => Math.round(finite(value, fallback));
  const safeId = (value, fallback = "item") => {
    const text = String(value == null ? "" : value).replace(/[^a-zA-Z0-9_.:-]+/g, "-").slice(0, 96);
    return text || fallback;
  };
  const normalizeQuality = (value) => {
    const quality = String(value || "high").toLowerCase();
    if (quality === "personal" || quality === "cinematic-personal") return "cinematic";
    const alias = { static: "lite", low: "lite", light: "lite", balanced: "high" }[quality] || quality;
    return QUALITY_PROFILES[alias] ? alias : "high";
  };
  const normalizeWeather = (value) => WEATHER_TYPES.includes(String(value || "").toLowerCase()) ? String(value).toLowerCase() : "clear";
  const normalizeWaterType = (value) => WATER_TYPES.includes(String(value || "").toLowerCase()) ? String(value).toLowerCase() : "lake";
  const vec3 = (value, fallbackY = 0) => ({
    x: finite(value && value.x, 0),
    y: finite(value && value.y, fallbackY),
    z: finite(value && value.z, finite(value && value.y, 0))
  });
  const clonePoint = (value) => ({ x: finite(value && value.x), y: finite(value && value.y), z: finite(value && value.z) });
  const distance2D = (a, b) => {
    const dx = finite(a && a.x) - finite(b && b.x);
    const dz = finite(a && a.z) - finite(b && b.z);
    return Math.sqrt(dx * dx + dz * dz);
  };
  const freezeShallow = (value) => Object.freeze(Object.assign({}, value));
  const hashSeed = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) return value >>> 0;
    const text = String(value == null ? "EON-WATER-541" : value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };
  const mix32 = (value) => {
    let next = (value >>> 0) + 0x6d2b79f5;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return (next ^ (next >>> 14)) >>> 0;
  };
  function createRandom(seed) {
    let state = hashSeed(seed);
    const random = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      return mix32(state) / 4294967296;
    };
    random.getState = () => state >>> 0;
    random.setState = (next) => { state = hashSeed(next); };
    return random;
  }
  const randomFor = (seed, key) => createRandom(`${seed}|${key}`)();
  function safeClone(value, depth = 0) {
    if (value == null || typeof value !== "object") return value;
    if (depth > 8) return null;
    if (Array.isArray(value)) return value.slice(0, 2048).map((item) => safeClone(item, depth + 1));
    const output = {};
    Object.keys(value).slice(0, 128).forEach((key) => { output[key] = safeClone(value[key], depth + 1); });
    return output;
  }
  function budgetValue(options, key, profileKey, hardKey) {
    const requested = options && options.budgets && options.budgets[key];
    const fallback = QUALITY_PROFILES[profileKey][key];
    return clamp(integer(requested == null ? fallback : requested, fallback), 0, HARD_LIMITS[hardKey || key]);
  }

  class Lifecycle {
    constructor(options = {}) {
      this._disposed = false;
      this._manualPaused = false;
      this._hiddenPaused = false;
      this._pauseReason = null;
      this._visibilityTarget = options.visibilityTarget || (runtime && runtime.document) || null;
      this._visibilityHandler = null;
      if (options.autoVisibility !== false && this._visibilityTarget && typeof this._visibilityTarget.addEventListener === "function") {
        this._visibilityHandler = () => this.setVisible(!Boolean(this._visibilityTarget.hidden));
        this._visibilityTarget.addEventListener("visibilitychange", this._visibilityHandler);
        this._hiddenPaused = Boolean(this._visibilityTarget.hidden);
      }
    }
    get state() {
      if (this._disposed) return "disposed";
      return this._manualPaused || this._hiddenPaused ? "paused" : "running";
    }
    get paused() { return this.state === "paused"; }
    get disposed() { return this._disposed; }
    get isActive() { return this.state === "running"; }
    pause(reason = "manual") {
      if (this._disposed) return false;
      this._manualPaused = true;
      this._pauseReason = safeId(reason, "manual");
      return true;
    }
    resume() {
      if (this._disposed) return false;
      this._manualPaused = false;
      this._pauseReason = this._hiddenPaused ? "hidden" : null;
      return !this._hiddenPaused;
    }
    setVisible(visible) {
      if (this._disposed) return false;
      this._hiddenPaused = !Boolean(visible);
      if (this._hiddenPaused) this._pauseReason = "hidden";
      else if (!this._manualPaused) this._pauseReason = null;
      return !this._hiddenPaused;
    }
    setVisibility(visible) { return this.setVisible(visible); }
    handleVisibilityChange(hidden) { return this.setVisible(!Boolean(hidden)); }
    _disposeLifecycle() {
      if (this._visibilityHandler && this._visibilityTarget && typeof this._visibilityTarget.removeEventListener === "function") {
        this._visibilityTarget.removeEventListener("visibilitychange", this._visibilityHandler);
      }
      this._visibilityHandler = null;
      this._visibilityTarget = null;
      this._disposed = true;
      this._manualPaused = true;
      this._hiddenPaused = true;
      this._pauseReason = "disposed";
    }
  }

  class FixedObjectPool {
    constructor(capacity, factory) {
      this.capacity = Math.max(0, integer(capacity, 0));
      this._factory = typeof factory === "function" ? factory : (() => ({}));
      this._items = new Array(this.capacity);
      this._free = [];
      this._active = [];
      this._sequence = 0;
      this.created = 0;
      this.reused = 0;
      this.evicted = 0;
      for (let index = 0; index < this.capacity; index += 1) {
        const item = this._factory(index) || {};
        item._poolIndex = index;
        item.active = false;
        this._items[index] = item;
        this._free.push(index);
      }
    }
    get activeCount() { return this._active.length; }
    acquire(initializer, evictOldest = true) {
      if (!this.capacity) return null;
      let index;
      if (this._free.length) {
        index = this._free.pop();
        this.created += 1;
      } else if (evictOldest && this._active.length) {
        index = this._active.shift();
        this.evicted += 1;
        this.reused += 1;
      } else return null;
      const item = this._items[index];
      item.active = true;
      item._sequence = ++this._sequence;
      if (typeof initializer === "function") initializer(item);
      this._active.push(index);
      return item;
    }
    release(itemOrIndex) {
      const index = typeof itemOrIndex === "number" ? itemOrIndex : itemOrIndex && itemOrIndex._poolIndex;
      if (!Number.isInteger(index) || index < 0 || index >= this.capacity) return false;
      const item = this._items[index];
      if (!item.active) return false;
      item.active = false;
      const activeIndex = this._active.indexOf(index);
      if (activeIndex >= 0) this._active.splice(activeIndex, 1);
      this._free.push(index);
      return true;
    }
    update(deltaSeconds, callback) {
      for (let offset = this._active.length - 1; offset >= 0; offset -= 1) {
        const index = this._active[offset];
        const item = this._items[index];
        if (callback(item, deltaSeconds) === false) {
          item.active = false;
          this._active.splice(offset, 1);
          this._free.push(index);
        }
      }
    }
    activeItems(copy = true) {
      const result = this._active.map((index) => this._items[index]);
      return copy ? result.map((item) => safeClone(item)) : result;
    }
    clear() {
      this._active.forEach((index) => { this._items[index].active = false; });
      this._active.length = 0;
      this._free.length = 0;
      for (let index = this.capacity - 1; index >= 0; index -= 1) this._free.push(index);
    }
    dispose() {
      this.clear();
      this._items.length = 0;
      this._free.length = 0;
      this.capacity = 0;
    }
    telemetry() {
      return { capacity: this.capacity, active: this.activeCount, acquired: this.created, reused: this.reused, evicted: this.evicted };
    }
  }

  function terrainHeight(sampler, x, z) {
    let sampled;
    try {
      if (typeof sampler === "function") sampled = sampler(x, z);
      else if (sampler && typeof sampler.sampleHeight === "function") sampled = sampler.sampleHeight(x, z);
      else if (sampler && typeof sampler.getHeight === "function") sampled = sampler.getHeight(x, z);
      else if (sampler && typeof sampler.sample === "function") sampled = sampler.sample(x, z);
    } catch (_) { sampled = 0; }
    if (sampled && typeof sampled === "object") sampled = sampled.height == null ? sampled.y : sampled.height;
    return finite(sampled, 0);
  }

  class RiverNetworkSystem extends Lifecycle {
    constructor(options = {}) {
      super(options);
      this.seed = options.seed == null ? "EON-RIVERS-541" : options.seed;
      this.chunkSize = clamp(options.chunkSize == null ? 256 : options.chunkSize, 32, 4096);
      this.step = clamp(options.step == null ? this.chunkSize / 8 : options.step, 2, this.chunkSize / 2);
      this.seaLevel = finite(options.seaLevel, 0);
      this.minimumDrop = clamp(options.minimumDrop == null ? 0.001 : options.minimumDrop, 0.000001, 10);
      this.mergeDistance = clamp(options.mergeDistance == null ? this.step * 0.75 : options.mergeDistance, 0, this.step * 3);
      this.maxPointsPerRiver = clamp(integer(options.maxPointsPerRiver, 192), 4, HARD_LIMITS.riverPoints);
      this.maxRivers = clamp(integer(options.maxRivers, 96), 1, HARD_LIMITS.rivers);
      this.maxBasins = clamp(integer(options.maxBasins, 96), 1, HARD_LIMITS.basins);
      this.worldBounds = this._normalizeBounds(options.worldBounds);
      this._sampler = options.terrainSampler || options.sampler || (() => 0);
      this._rivers = new Map();
      this._basins = new Map();
      this._sourceKeys = new Set();
      this._pointIndex = new Map();
      this._generationCount = 0;
      this._sampleCount = 0;
      this._lastGenerationMs = null;
    }
    _normalizeBounds(bounds) {
      const source = bounds && typeof bounds === "object" ? bounds : {};
      return {
        minX: finite(source.minX, -32768), maxX: finite(source.maxX, 32768),
        minZ: finite(source.minZ, -32768), maxZ: finite(source.maxZ, 32768)
      };
    }
    setTerrainSampler(sampler) {
      if (this._disposed || (!sampler || (typeof sampler !== "function" && typeof sampler !== "object"))) return false;
      this._sampler = sampler;
      return true;
    }
    sampleHeight(x, z) {
      this._sampleCount += 1;
      return terrainHeight(this._sampler, finite(x), finite(z));
    }
    worldToChunk(x, z) {
      return { x: Math.floor(finite(x) / this.chunkSize), z: Math.floor(finite(z) / this.chunkSize) };
    }
    _insideBounds(x, z) {
      return x >= this.worldBounds.minX && x <= this.worldBounds.maxX && z >= this.worldBounds.minZ && z <= this.worldBounds.maxZ;
    }
    _cellKey(x, z) {
      const resolution = Math.max(0.5, this.step * 0.35);
      return `${Math.round(x / resolution)},${Math.round(z / resolution)}`;
    }
    _connectionCellKey(x, z) {
      const resolution = Math.max(1, this.mergeDistance || this.step * 0.75);
      return `${Math.round(x / resolution)},${Math.round(z / resolution)}`;
    }
    _indexPoint(riverId, pointIndex, point) {
      this._pointIndex.set(this._connectionCellKey(point.x, point.z), { riverId, pointIndex, y: point.y, x: point.x, z: point.z });
    }
    _findConnection(x, z, maximumY, ownId) {
      if (this.mergeDistance <= 0) return null;
      const resolution = Math.max(1, this.mergeDistance);
      const cx = Math.round(x / resolution);
      const cz = Math.round(z / resolution);
      let best = null;
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const candidate = this._pointIndex.get(`${cx + dx},${cz + dz}`);
          if (!candidate || candidate.riverId === ownId || candidate.y > maximumY) continue;
          const distance = Math.hypot(candidate.x - x, candidate.z - z);
          if (distance <= this.mergeDistance && (!best || distance < best.distance)) best = Object.assign({ distance }, candidate);
        }
      }
      return best;
    }
    _directions(sourceKey) {
      const offset = Math.floor(randomFor(this.seed, `${sourceKey}|direction-offset`) * 8);
      const diagonal = Math.SQRT1_2;
      const base = [[1, 0], [diagonal, diagonal], [0, 1], [-diagonal, diagonal], [-1, 0], [-diagonal, -diagonal], [0, -1], [diagonal, -diagonal]];
      return base.map((_, index) => base[(index + offset) % base.length]);
    }
    _makePoint(x, z, height, index, previous) {
      const chunk = this.worldToChunk(x, z);
      const slope = previous ? Math.max(0, (previous.y - height) / Math.max(0.0001, distance2D(previous, { x, z }))) : 0;
      return {
        x, y: height, z, chunkX: chunk.x, chunkZ: chunk.z, index,
        slope, width: 1 + Math.sqrt(index + 1) * 0.35, flow: clamp(0.18 + index * 0.018 + slope * 2, 0.18, 4)
      };
    }
    traceDownhill(source, options = {}) {
      if (!this.isActive || this._rivers.size >= this.maxRivers) return null;
      const start = vec3(source);
      start.y = this.sampleHeight(start.x, start.z);
      if (!this._insideBounds(start.x, start.z)) return null;
      const sourceKey = safeId(options.sourceKey || `${start.x.toFixed(3)}:${start.z.toFixed(3)}`, "source");
      if (options.dedupe !== false && this._sourceKeys.has(sourceKey)) {
        const duplicate = Array.from(this._rivers.values()).find((river) => river.sourceKey === sourceKey);
        return duplicate ? safeClone(duplicate) : null;
      }
      const riverId = safeId(options.id || `river-${hashSeed(`${this.seed}|${sourceKey}`).toString(16)}`, `river-${this._rivers.size + 1}`);
      if (this._rivers.has(riverId)) return this._rivers.get(riverId);
      const points = [this._makePoint(start.x, start.z, start.y, 0, null)];
      const visited = new Set([this._cellKey(start.x, start.z)]);
      const directions = this._directions(sourceKey);
      const pointLimit = clamp(integer(options.maxPoints, this.maxPointsPerRiver), 2, this.maxPointsPerRiver);
      const step = clamp(options.step == null ? this.step : options.step, 1, this.chunkSize);
      let endReason = start.y <= this.seaLevel ? "ocean" : "local-minimum";
      let connection = null;
      while (points.length < pointLimit && points[points.length - 1].y > this.seaLevel) {
        const current = points[points.length - 1];
        let next = null;
        for (let index = 0; index < directions.length; index += 1) {
          const direction = directions[index];
          const x = current.x + direction[0] * step;
          const z = current.z + direction[1] * step;
          if (!this._insideBounds(x, z)) continue;
          const key = this._cellKey(x, z);
          if (visited.has(key)) continue;
          const y = this.sampleHeight(x, z);
          const drop = current.y - y;
          if (drop < this.minimumDrop) continue;
          const score = y - drop * 0.05 + randomFor(this.seed, `${sourceKey}|${points.length}|${index}`) * 1e-7;
          if (!next || score < next.score) next = { x, y, z, key, score };
        }
        if (!next) { endReason = "local-minimum"; break; }
        const nextPoint = this._makePoint(next.x, next.z, next.y, points.length, current);
        points.push(nextPoint);
        visited.add(next.key);
        connection = this._findConnection(next.x, next.z, next.y, riverId);
        if (connection) {
          const target = this._rivers.get(connection.riverId);
          const targetPoint = target && target.points[connection.pointIndex];
          if (targetPoint && distance2D(nextPoint, targetPoint) > 0.001 && targetPoint.y <= nextPoint.y) {
            points.push(this._makePoint(targetPoint.x, targetPoint.z, targetPoint.y, points.length, nextPoint));
          }
          endReason = "tributary-merge";
          break;
        }
        if (next.y <= this.seaLevel) { endReason = "ocean"; break; }
        if (!this._insideBounds(next.x + directions[0][0] * step, next.z + directions[0][1] * step)) { endReason = "world-boundary"; break; }
        endReason = points.length >= pointLimit ? "point-budget" : endReason;
      }
      if (points.length >= pointLimit && points[points.length - 1].y > this.seaLevel && endReason !== "tributary-merge") endReason = "point-budget";
      const end = points[points.length - 1];
      let basinType = endReason === "ocean" ? "ocean" : (endReason === "tributary-merge" ? "network" : "lake");
      let basinId = endReason === "tributary-merge" && connection ? `network-${connection.riverId}` : `basin-${hashSeed(`${this.seed}|${Math.round(end.x)}|${Math.round(end.z)}|${basinType}`).toString(16)}`;
      if (!this._basins.has(basinId) && this._basins.size < this.maxBasins) {
        this._basins.set(basinId, { id: basinId, type: basinType, x: end.x, y: end.y, z: end.z, riverIds: [] });
      }
      const basin = this._basins.get(basinId);
      if (basin && !basin.riverIds.includes(riverId)) basin.riverIds.push(riverId);
      const crossedChunks = [];
      const chunkSet = new Set();
      points.forEach((point) => {
        const key = `${point.chunkX}:${point.chunkZ}`;
        if (!chunkSet.has(key)) { chunkSet.add(key); crossedChunks.push({ x: point.chunkX, z: point.chunkZ }); }
      });
      const river = {
        id: riverId, sourceKey, seed: hashSeed(`${this.seed}|${sourceKey}`), points,
        basinId, endReason, connectedTo: connection ? connection.riverId : null,
        crossedChunks, totalDrop: Math.max(0, points[0].y - end.y),
        length: points.slice(1).reduce((sum, point, index) => sum + distance2D(points[index], point), 0)
      };
      this._rivers.set(riverId, river);
      this._sourceKeys.add(sourceKey);
      points.forEach((point, index) => this._indexPoint(riverId, index, point));
      this._generationCount += 1;
      return safeClone(river);
    }
    generateRiver(source, options) { return this.traceDownhill(source, options); }
    _chunkSource(cx, cz, sourceIndex) {
      const key = `${cx}:${cz}:${sourceIndex}`;
      const inset = this.chunkSize * 0.12;
      const span = this.chunkSize - inset * 2;
      let best = null;
      const candidates = 6;
      for (let index = 0; index < candidates; index += 1) {
        const x = cx * this.chunkSize + inset + randomFor(this.seed, `${key}|x|${index}`) * span;
        const z = cz * this.chunkSize + inset + randomFor(this.seed, `${key}|z|${index}`) * span;
        const y = this.sampleHeight(x, z);
        if (!best || y > best.y) best = { x, y, z };
      }
      return best;
    }
    generateForChunk(chunkX, chunkZ, options = {}) {
      if (chunkX && typeof chunkX === "object") {
        options = chunkZ && typeof chunkZ === "object" ? chunkZ : options;
        chunkZ = chunkX.z == null ? chunkX.y : chunkX.z;
        chunkX = chunkX.x;
      }
      const cx = integer(chunkX, 0);
      const cz = integer(chunkZ, 0);
      const count = clamp(integer(options.sourcesPerChunk, 1), 1, 4);
      const results = [];
      for (let index = 0; index < count && this._rivers.size < this.maxRivers; index += 1) {
        const source = this._chunkSource(cx, cz, index);
        if (!source || source.y <= finite(options.minimumSourceHeight, this.seaLevel + 1)) continue;
        const river = this.traceDownhill(source, Object.assign({}, options, { sourceKey: `chunk-${cx}-${cz}-${index}` }));
        if (river) results.push(river);
      }
      return results;
    }
    generateForChunks(chunks, options = {}) {
      if (!Array.isArray(chunks) || !this.isActive) return [];
      const started = Date.now();
      const normalized = chunks.slice(0, 4096).map((chunk) => ({
        x: integer(chunk && (chunk.x == null ? chunk.cx : chunk.x), 0),
        z: integer(chunk && (chunk.z == null ? (chunk.cz == null ? chunk.y : chunk.cz) : chunk.z), 0)
      })).sort((a, b) => a.x - b.x || a.z - b.z);
      const result = [];
      normalized.forEach((chunk) => { result.push(...this.generateForChunk(chunk.x, chunk.z, options)); });
      this._lastGenerationMs = Date.now() - started;
      return result;
    }
    generateNetwork(chunks, options) { return this.generateForChunks(chunks, options); }
    getRiver(id) { const river = this._rivers.get(String(id)); return river ? safeClone(river) : null; }
    getRivers() { return Array.from(this._rivers.values()).map((river) => safeClone(river)); }
    getBasins() { return Array.from(this._basins.values()).map((basin) => safeClone(basin)); }
    getNetwork() { return { rivers: this.getRivers(), basins: this.getBasins() }; }
    getChunkSegments(chunkX, chunkZ) {
      const cx = integer(chunkX, 0);
      const cz = integer(chunkZ, 0);
      const segments = [];
      this._rivers.forEach((river) => {
        for (let index = 1; index < river.points.length; index += 1) {
          const a = river.points[index - 1];
          const b = river.points[index];
          if ((a.chunkX === cx && a.chunkZ === cz) || (b.chunkX === cx && b.chunkZ === cz)) {
            segments.push({ riverId: river.id, index: index - 1, a: safeClone(a), b: safeClone(b) });
          }
        }
      });
      return segments;
    }
    clear() {
      if (this._disposed) return false;
      this._rivers.clear();
      this._basins.clear();
      this._sourceKeys.clear();
      this._pointIndex.clear();
      return true;
    }
    getTelemetry() {
      let points = 0;
      this._rivers.forEach((river) => { points += river.points.length; });
      return {
        format: FORMAT, version: VERSION, subsystem: "river-network", state: this.state,
        riverCount: this._rivers.size, basinCount: this._basins.size, pointCount: points,
        generatedRiverCount: this._generationCount, terrainSamples: this._sampleCount,
        lastGenerationMs: this._lastGenerationMs,
        limits: { rivers: this.maxRivers, basins: this.maxBasins, pointsPerRiver: this.maxPointsPerRiver },
        fps: null, drawCalls: null, gpuMemoryBytes: null, measuredRendering: false
      };
    }
    dispose() {
      if (this._disposed) return false;
      this.clear();
      this._sampler = null;
      this._disposeLifecycle();
      return true;
    }
  }

  function effectItem(index) {
    return { _poolIndex: index, active: false, id: "", type: "", age: 0, lifetime: 1, x: 0, y: 0, z: 0, radius: 0, strength: 0 };
  }
  function initializeEffect(item, type, input, defaults) {
    const position = vec3(input && (input.position || input));
    item.id = safeId(input && input.id, `${type}-${item._sequence}`);
    item.type = type;
    item.age = 0;
    item.lifetime = clamp(input && input.lifetime == null ? defaults.lifetime : input.lifetime, 0.05, 120);
    item.x = position.x; item.y = position.y; item.z = position.z;
    item.radius = clamp(input && input.radius == null ? defaults.radius : input.radius, 0.01, 100);
    item.strength = clamp(input && input.strength == null ? defaults.strength : input.strength, 0, 4);
    item.velocityX = finite(input && input.velocityX, 0);
    item.velocityY = finite(input && input.velocityY, 0);
    item.velocityZ = finite(input && input.velocityZ, 0);
    item.bodyId = safeId(input && input.bodyId, "world");
    item.surface = safeId(input && input.surface, defaults.surface || "water");
    return item;
  }

  class WaterRenderingSystem extends Lifecycle {
    constructor(options = {}) {
      super(options);
      this.quality = normalizeQuality(options.quality || options.qualityPreset);
      this.profile = QUALITY_PROFILES[this.quality];
      this._Babylon = options.Babylon || options.BABYLON || (runtime && runtime.BABYLON) || null;
      this._scene = options.scene || null;
      this._backend = this._Babylon && this._scene ? "babylon" : "procedural-descriptor";
      this._bodyLimit = budgetValue(options, "waterBodies", this.quality, "waterBodies");
      this._bodies = new Map();
      this._meshes = new Map();
      this._materials = new Map();
      this._foam = new FixedObjectPool(budgetValue(options, "foam", this.quality, "foam"), effectItem);
      this._ripples = new FixedObjectPool(budgetValue(options, "ripples", this.quality, "ripples"), effectItem);
      this._wakes = new FixedObjectPool(budgetValue(options, "wakes", this.quality, "wakes"), effectItem);
      this._time = 0;
      this._updates = 0;
      this._createdMeshes = 0;
      this._disposedMeshes = 0;
      this._createdMaterials = 0;
      this._disposedMaterials = 0;
      this._weather = { wetness: 0, riverLevel: 1, wind: 0, weather: "clear" };
    }
    _descriptor(input) {
      const source = input && typeof input === "object" ? input : {};
      const type = normalizeWaterType(source.type);
      const id = safeId(source.id, `${type}-${this._bodies.size + 1}`);
      const position = vec3(source.position || source);
      const points = Array.isArray(source.points) ? source.points.slice(0, 512).map(clonePoint) : [];
      const descriptor = {
        id, type, position, points,
        width: clamp(source.width == null ? (type === "river" ? 8 : 64) : source.width, 0.25, 16384),
        length: clamp(source.length == null ? 64 : source.length, 0.25, 32768),
        depth: clamp(source.depth == null ? (type === "ocean" ? 200 : 4) : source.depth, 0.05, 12000),
        level: finite(source.level, position.y),
        flowSpeed: clamp(source.flowSpeed == null ? (type === "river" ? 1.2 : 0.15) : source.flowSpeed, 0, 25),
        sediment: clamp(source.sediment, 0, 1),
        clarity: clamp(source.clarity == null ? 0.7 : source.clarity, 0, 1),
        enabled: source.enabled !== false,
        render: {
          reflection: this.profile.reflection,
          refraction: this.profile.refraction,
          fresnel: true,
          depthColor: true,
          caustics: this.profile.caustics,
          normals: this.quality === "lite" ? 1 : 2,
          meshMode: points.length > 1 ? "shared-ribbon" : "bounded-surface"
        },
        simulation: {
          fresnelIor: 1.333,
          absorption: type === "ocean" ? { r: 0.015, g: 0.006, b: 0.002 } : { r: 0.028, g: 0.012, b: 0.006 },
          depthColor: type === "ocean" ? "deep-blue-to-coastal-teal" : (source.sediment > 0.55 ? "sediment-brown-green" : "freshwater-blue-green"),
          waveLayers: type === "ocean" ? (this.quality === "lite" ? 1 : 3) : (type === "lake" ? 2 : 1),
          tideAmplitude: type === "ocean" ? clamp(source.tideAmplitude == null ? 0.55 : source.tideAmplitude, 0, 8) : 0,
          velocityProfile: type === "river" ? { bank: 0.34, center: 1, bendOuter: 1.18 } : null,
          waterfall: type === "waterfall" ? { sprayBatch: true, mistBatch: true, plungeFoam: true, wetRockInfluence: 1 } : null,
          lake: type === "lake" ? { morningSurfaceMist: true, ecologyClarity: true, microRipples: true } : null,
          ocean: type === "ocean" ? { shoreFoam: true, creatureFoam: true, underwaterFog: true, suspendedMatter: true, caustics: Boolean(this.profile.caustics) } : null,
          sound: { spatial: true, gainFromFlow: type === "river" || type === "waterfall", assetRequired: false }
        },
        currentLevel: finite(source.level, position.y),
        currentFlowSpeed: clamp(source.flowSpeed == null ? (type === "river" ? 1.2 : 0.15) : source.flowSpeed, 0, 25),
        surfaceRoughness: type === "ocean" ? 0.18 : 0.26,
        surfaceWetness: 0
      };
      return descriptor;
    }
    _materialFor(type) {
      if (this._materials.has(type)) return this._materials.get(type);
      if (!this._Babylon || !this._scene || this._materials.size >= HARD_LIMITS.materials) return null;
      const B = this._Babylon;
      let material = null;
      try {
        if (typeof B.PBRMaterial === "function") {
          material = new B.PBRMaterial(`hwe-water-${type}`, this._scene);
          const palette = type === "ocean" ? [0.018, 0.18, 0.27] : type === "waterfall" ? [0.34, 0.62, 0.7] : type === "swamp" ? [0.12, 0.24, 0.17] : [0.035, 0.29, 0.34];
          if (typeof B.Color3 === "function") {
            material.albedoColor = new B.Color3(palette[0], palette[1], palette[2]);
            material.emissiveColor = new B.Color3(palette[0] * 0.035, palette[1] * 0.045, palette[2] * 0.055);
          }
          material.metallic = 0;
          material.roughness = type === "ocean" ? 0.18 : 0.26;
          material.alpha = type === "waterfall" ? 0.72 : 0.86;
          material.environmentIntensity = type === "waterfall" ? 0.72 : 1.05;
          material.backFaceCulling = false;
          if ("indexOfRefraction" in material) material.indexOfRefraction = 1.333;
          if (material.clearCoat) {
            material.clearCoat.isEnabled = true;
            material.clearCoat.intensity = type === "waterfall" ? 0.2 : 0.48;
            material.clearCoat.roughness = type === "ocean" ? 0.12 : 0.18;
          }
          if (material.subSurface) {
            material.subSurface.isRefractionEnabled = Boolean(this.profile.refraction);
            material.subSurface.indexOfRefraction = 1.333;
          }
        } else if (typeof B.StandardMaterial === "function") {
          material = new B.StandardMaterial(`hwe-water-${type}`, this._scene);
          const palette = type === "ocean" ? [0.03, 0.25, 0.34] : type === "waterfall" ? [0.46, 0.72, 0.8] : [0.08, 0.38, 0.42];
          if (typeof B.Color3 === "function") {
            material.diffuseColor = new B.Color3(palette[0], palette[1], palette[2]);
            material.specularColor = new B.Color3(0.45, 0.58, 0.62);
          }
          material.alpha = 0.82;
          material.specularPower = 96;
          material.backFaceCulling = false;
        }
      } catch (_) { material = null; }
      if (material) {
        this._materials.set(type, material);
        this._createdMaterials += 1;
      }
      return material;
    }
    _createBabylonMesh(descriptor) {
      const B = this._Babylon;
      if (!B || !this._scene || !B.MeshBuilder || this._meshes.size >= HARD_LIMITS.meshes) return null;
      let mesh = null;
      try {
        if ((descriptor.type === "river" || descriptor.type === "waterfall") && descriptor.points.length >= 2 && typeof B.MeshBuilder.CreateRibbon === "function" && typeof B.Vector3 === "function") {
          const half = descriptor.width * 0.5;
          const left = [];
          const right = [];
          for (let index = 0; index < descriptor.points.length; index += 1) {
            const point = descriptor.points[index];
            const before = descriptor.points[Math.max(0, index - 1)];
            const after = descriptor.points[Math.min(descriptor.points.length - 1, index + 1)];
            const dx = after.x - before.x;
            const dz = after.z - before.z;
            const length = Math.max(0.0001, Math.hypot(dx, dz));
            const nx = -dz / length;
            const nz = dx / length;
            left.push(new B.Vector3(point.x + nx * half, point.y, point.z + nz * half));
            right.push(new B.Vector3(point.x - nx * half, point.y, point.z - nz * half));
          }
          mesh = B.MeshBuilder.CreateRibbon(`hwe-water-${descriptor.id}`, { pathArray: [left, right], updatable: false, closeArray: false, closePath: false }, this._scene);
        } else if (typeof B.MeshBuilder.CreateGround === "function") {
          mesh = B.MeshBuilder.CreateGround(`hwe-water-${descriptor.id}`, { width: descriptor.width, height: descriptor.length, subdivisions: this.quality === "lite" ? 1 : 4, updatable: false }, this._scene);
          if (mesh.position) {
            mesh.position.x = descriptor.position.x;
            mesh.position.y = descriptor.level;
            mesh.position.z = descriptor.position.z;
          }
        }
        if (mesh) {
          mesh.material = this._materialFor(descriptor.type);
          mesh.metadata = Object.assign({}, mesh.metadata, { hhEonWildWater: true, bodyId: descriptor.id, type: descriptor.type });
          mesh.isPickable = false;
          this._createdMeshes += 1;
        }
      } catch (_) {
        if (mesh && typeof mesh.dispose === "function") { try { mesh.dispose(); } catch (_) {} }
        mesh = null;
      }
      return mesh;
    }
    upsertBody(input) {
      if (this._disposed) return null;
      const descriptor = this._descriptor(input);
      const existing = this._bodies.get(descriptor.id);
      if (!existing && this._bodies.size >= this._bodyLimit) return null;
      if (existing && this._meshes.has(descriptor.id)) {
        const oldMesh = this._meshes.get(descriptor.id);
        if (oldMesh && typeof oldMesh.dispose === "function") { try { oldMesh.dispose(); } catch (_) {} }
        this._meshes.delete(descriptor.id);
        this._disposedMeshes += 1;
      }
      this._bodies.set(descriptor.id, descriptor);
      const mesh = this._createBabylonMesh(descriptor);
      if (mesh) this._meshes.set(descriptor.id, mesh);
      return safeClone(descriptor);
    }
    addBody(input) { return this.upsertBody(input); }
    addOcean(input = {}) { return this.upsertBody(Object.assign({}, input, { type: "ocean" })); }
    addLake(input = {}) { return this.upsertBody(Object.assign({}, input, { type: "lake" })); }
    addRiver(input = {}) { return this.upsertBody(Object.assign({}, input, { type: "river" })); }
    addWaterfall(input = {}) { return this.upsertBody(Object.assign({}, input, { type: "waterfall" })); }
    syncRiverNetwork(network) {
      const rivers = Array.isArray(network) ? network : (network && Array.isArray(network.rivers) ? network.rivers : []);
      const result = [];
      rivers.slice(0, this._bodyLimit).forEach((river) => {
        const averageWidth = river.points && river.points.length ? river.points.reduce((sum, point) => sum + finite(point.width, 1), 0) / river.points.length : 4;
        const body = this.addRiver({ id: `water-${river.id}`, points: river.points, width: averageWidth, flowSpeed: river.points && river.points.length ? river.points.reduce((sum, point) => sum + finite(point.flow), 0) / river.points.length : 1, depth: Math.max(0.5, averageWidth * 0.22) });
        if (body) result.push(body);
        if (river.points) {
          for (let index = 1; index < river.points.length; index += 1) {
            const a = river.points[index - 1];
            const b = river.points[index];
            if (a.y - b.y > Math.max(2, averageWidth * 0.5)) {
              const waterfall = this.addWaterfall({ id: `fall-${river.id}-${index}`, points: [a, b], width: averageWidth, depth: 0.5, flowSpeed: finite(b.flow, 1.5) });
              if (waterfall) {
                result.push(waterfall);
                this.emitFoam({ id: `plunge-foam-${river.id}-${index}`, x: b.x, y: b.y, z: b.z, radius: averageWidth * 0.8, strength: 1.4, lifetime: 5, bodyId: waterfall.id });
              }
            } else if (finite(b.slope) > 0.08) {
              this.emitFoam({ id: `rapid-foam-${river.id}-${index}`, x: b.x, y: b.y, z: b.z, radius: averageWidth * 0.35, strength: clamp(b.slope * 3, 0.3, 1.2), lifetime: 3.5, bodyId: `water-${river.id}` });
            }
          }
        }
      });
      return result;
    }
    removeBody(id) {
      const key = String(id);
      const descriptor = this._bodies.get(key);
      if (!descriptor) return false;
      const mesh = this._meshes.get(key);
      if (mesh && typeof mesh.dispose === "function") { try { mesh.dispose(); } catch (_) {} }
      if (mesh) this._disposedMeshes += 1;
      this._meshes.delete(key);
      this._bodies.delete(key);
      return true;
    }
    _emit(pool, type, input, defaults) {
      if (!this.isActive) return null;
      const item = pool.acquire((slot) => initializeEffect(slot, type, input || {}, defaults));
      return item ? safeClone(item) : null;
    }
    emitFoam(input) { return this._emit(this._foam, "foam", input, { lifetime: 3, radius: 0.8, strength: 1, surface: "water" }); }
    emitRipple(input) { return this._emit(this._ripples, "ripple", input, { lifetime: 1.5, radius: 0.25, strength: 0.6, surface: "water" }); }
    emitWake(input) { return this._emit(this._wakes, "wake", input, { lifetime: 4, radius: 1.4, strength: 1, surface: "water" }); }
    setWeatherState(state = {}) {
      if (this._disposed) return false;
      this._weather.wetness = clamp(state.wetness, 0, 1);
      this._weather.riverLevel = clamp(state.riverLevel == null ? 1 : state.riverLevel, 0.5, 3);
      const windObject = state.wind && typeof state.wind === "object";
      const windSpeed = windObject ? state.wind.speed : state.wind;
      this._weather.wind = clamp(windObject ? finite(windSpeed) / 20 : finite(windSpeed), 0, 1.5);
      this._weather.weather = normalizeWeather(state.weather || state.type);
      this._bodies.forEach((body) => {
        body.surfaceWetness = this._weather.wetness;
        body.surfaceRoughness = clamp((body.type === "ocean" ? 0.18 : 0.26) - this._weather.wetness * 0.045 + this._weather.wind * 0.035, 0.08, 0.42);
        body.currentFlowSpeed = body.flowSpeed * (body.type === "river" || body.type === "waterfall" ? this._weather.riverLevel : 1);
      });
      this._materials.forEach((material, type) => {
        if (material && "roughness" in material) {
          let roughness = null;
          for (const body of this._bodies.values()) {
            if (body.type === type) { roughness = body.surfaceRoughness; break; }
          }
          if (roughness != null) material.roughness = roughness;
        }
      });
      return true;
    }
    update(deltaSeconds) {
      if (!this.isActive) return false;
      const dt = clamp(deltaSeconds, 0, 0.25);
      this._time += dt;
      this._bodies.forEach((body) => {
        if (body.type === "ocean") body.currentLevel = body.level + Math.sin(this._time * 0.000145 + hashSeed(body.id) * 1e-6) * body.simulation.tideAmplitude;
        else if (body.type === "lake") body.currentLevel = body.level + Math.sin(this._time * 0.7 + hashSeed(body.id) * 1e-5) * 0.012 * (1 + this._weather.wind);
        else body.currentLevel = body.level + (this._weather.riverLevel - 1) * Math.min(body.depth * 0.6, 2.5);
        const mesh = this._meshes.get(body.id);
        if (mesh && mesh.position && body.points.length < 2) mesh.position.y = body.currentLevel;
      });
      const advance = (item, delta) => {
        item.age += delta;
        item.x += item.velocityX * delta;
        item.y += item.velocityY * delta;
        item.z += item.velocityZ * delta;
        item.radius += item.type === "ripple" ? delta * (0.4 + item.strength) : delta * 0.08;
        return item.age < item.lifetime;
      };
      this._foam.update(dt, advance);
      this._ripples.update(dt, advance);
      this._wakes.update(dt, advance);
      this._updates += 1;
      return true;
    }
    getBody(id) { const body = this._bodies.get(String(id)); return body ? safeClone(body) : null; }
    getRenderDescriptors() {
      return {
        backend: this._backend,
        quality: this.quality,
        bodies: Array.from(this._bodies.values()).map((body) => safeClone(body)),
        effects: { foam: this._foam.activeItems(), ripples: this._ripples.activeItems(), wakes: this._wakes.activeItems() },
        weather: safeClone(this._weather)
      };
    }
    setQuality(quality) {
      if (this._disposed) return false;
      this.quality = normalizeQuality(quality);
      this.profile = QUALITY_PROFILES[this.quality];
      this._bodies.forEach((body) => {
        body.render.reflection = this.profile.reflection;
        body.render.refraction = this.profile.refraction;
        body.render.caustics = this.profile.caustics;
      });
      return true;
    }
    getTelemetry() {
      return {
        format: FORMAT, version: VERSION, subsystem: "water-rendering", state: this.state,
        backend: this._backend, quality: this.quality, waterBodies: this._bodies.size,
        meshCount: this._meshes.size, materialCount: this._materials.size,
        createdMeshes: this._createdMeshes, disposedMeshes: this._disposedMeshes,
        createdMaterials: this._createdMaterials, disposedMaterials: this._disposedMaterials,
        foam: this._foam.telemetry(), ripples: this._ripples.telemetry(), wakes: this._wakes.telemetry(),
        updateCount: this._updates, limits: { waterBodies: this._bodyLimit, meshes: HARD_LIMITS.meshes, materials: HARD_LIMITS.materials },
        drawCalls: null, triangles: null, gpuParticles: null, gpuMemoryBytes: null, measuredRendering: false
      };
    }
    dispose() {
      if (this._disposed) return false;
      Array.from(this._bodies.keys()).forEach((id) => this.removeBody(id));
      this._materials.forEach((material) => {
        if (material && typeof material.dispose === "function") { try { material.dispose(); } catch (_) {} }
        this._disposedMaterials += 1;
      });
      this._materials.clear();
      this._foam.dispose(); this._ripples.dispose(); this._wakes.dispose();
      this._Babylon = null; this._scene = null;
      this._disposeLifecycle();
      return true;
    }
  }

  function weatherEffect(index) {
    return {
      _poolIndex: index, active: false, id: "", type: "", age: 0, lifetime: 1,
      x: 0, y: 0, z: 0, radius: 0, strength: 0, layer: "near", surface: "ground"
    };
  }

  class WeatherSimulationSystem extends Lifecycle {
    constructor(options = {}) {
      super(options);
      this.seed = options.seed == null ? "EON-WEATHER-541" : options.seed;
      this.quality = normalizeQuality(options.quality || options.qualityPreset);
      this.profile = QUALITY_PROFILES[this.quality];
      this._random = createRandom(this.seed);
      this._weather = normalizeWeather(options.weather || options.type);
      this._intensity = clamp(options.intensity == null ? 1 : options.intensity, 0, 1);
      this._temperatureC = clamp(options.temperatureC == null ? 18 : options.temperatureC, -80, 70);
      this._humidity = clamp(options.humidity == null ? 0.62 : options.humidity, 0, 1);
      this._wind = {
        x: finite(options.wind && options.wind.x, 1),
        z: finite(options.wind && options.wind.z, finite(options.wind && options.wind.y, 0)),
        speed: clamp(options.wind && options.wind.speed, 0, 80)
      };
      this._wetness = clamp(options.wetness, 0, 1);
      this._puddleCoverage = clamp(options.puddleCoverage, 0, 1);
      this._riverLevel = clamp(options.riverLevel == null ? 1 : options.riverLevel, 0.5, 3);
      this._snowCover = clamp(options.snowCover, 0, 1);
      this._ashCover = clamp(options.ashCover, 0, 1);
      this._dustLoad = clamp(options.dustLoad, 0, 1);
      this._time = 0;
      this._weatherTime = 0;
      this._precipitationAccumulator = 0;
      this._weatherChangeCount = 0;
      this._updates = 0;
      this._droppedSeconds = 0;
      this._spawnedSplashes = 0;
      this._spawnedRipples = 0;
      this._skippedSheltered = 0;
      this._splashes = new FixedObjectPool(budgetValue(options, "weatherSplashes", this.quality, "weatherSplashes"), weatherEffect);
      this._ripples = new FixedObjectPool(budgetValue(options, "weatherRipples", this.quality, "weatherRipples"), weatherEffect);
      this._rainLayerLimit = budgetValue(options, "rainLayers", this.quality, "rainLayers");
      this._layers = [];
      this._thunder = [];
      this._thunderLimit = clamp(integer(options.thunderLimit, 6), 0, HARD_LIMITS.thunder);
      this._lastLightningAt = -Infinity;
      this._nextLightningAt = 4 + this._random() * 5;
      this._minimumFlashInterval = clamp(options.minimumFlashInterval == null ? 3.5 : options.minimumFlashInterval, 2.5, 30);
      this._flashDuration = clamp(options.flashDuration == null ? 0.085 : options.flashDuration, 0.02, 0.12);
      this._flashEnabled = options.flashEffects !== false && options.reducedMotion !== true;
      this._flash = { active: false, remaining: 0, intensity: 0, count: 0 };
      this._waterSystem = options.waterSystem && typeof options.waterSystem.emitRipple === "function" ? options.waterSystem : null;
      this._terrainSampler = options.terrainSampler || options.sampler || null;
      this._lastState = null;
      this._rebuildLayers();
    }
    _profile() { return WEATHER_PROFILES[this._weather]; }
    _effectiveWindSpeed() {
      return clamp(Math.max(this._wind.speed, this._profile().wind * this._intensity * 24), 0, 80);
    }
    _rebuildLayers() {
      this._layers.length = 0;
      if (!this._rainLayerLimit || !["rain", "storm", "snow", "ash", "dust"].includes(this._weather)) return;
      const layerTypes = this._weather === "rain" || this._weather === "storm"
        ? ["near-streaks", "far-curtain", "precipitation-mist"]
        : [`near-${this._weather}`, `far-${this._weather}`, `${this._weather}-haze`];
      for (let index = 0; index < Math.min(this._rainLayerLimit, layerTypes.length); index += 1) {
        this._layers.push({
          id: `weather-layer-${index}`, type: layerTypes[index],
          precipitation: this._weather, density: this._intensity * (index === 0 ? 1 : 0.65),
          batchMode: this.quality === "lite" ? "canvas-batch" : "gpu-or-instanced-batch",
          particleMeshes: 0, enabled: this.isActive
        });
      }
    }
    setWeather(type, options = {}) {
      if (this._disposed) return false;
      const next = normalizeWeather(type);
      if (next !== this._weather) {
        this._weather = next;
        this._weatherTime = 0;
        this._weatherChangeCount += 1;
        this._precipitationAccumulator = 0;
      }
      if (options.intensity != null) this._intensity = clamp(options.intensity, 0, 1);
      if (options.temperatureC != null) this._temperatureC = clamp(options.temperatureC, -80, 70);
      if (options.humidity != null) this._humidity = clamp(options.humidity, 0, 1);
      if (options.wind && typeof options.wind === "object") this.setWind(options.wind);
      this._rebuildLayers();
      return this.getState();
    }
    configure(options = {}) {
      if (this._disposed) return false;
      if (options.weather || options.type) this.setWeather(options.weather || options.type, options);
      else {
        if (options.intensity != null) this._intensity = clamp(options.intensity, 0, 1);
        if (options.temperatureC != null) this._temperatureC = clamp(options.temperatureC, -80, 70);
        if (options.humidity != null) this._humidity = clamp(options.humidity, 0, 1);
        if (options.wind) this.setWind(options.wind);
        this._rebuildLayers();
      }
      if (options.flashEffects != null) this._flashEnabled = Boolean(options.flashEffects) && options.reducedMotion !== true;
      return this.getState();
    }
    setWind(wind = {}) {
      let x = finite(wind.x, 1);
      let z = finite(wind.z, finite(wind.y, 0));
      const length = Math.hypot(x, z);
      if (length > 0.0001) { x /= length; z /= length; } else { x = 1; z = 0; }
      this._wind.x = x;
      this._wind.z = z;
      this._wind.speed = clamp(wind.speed, 0, 80);
      return safeClone(this._wind);
    }
    _cameraBasis(context) {
      const camera = vec3(context && (context.camera || context.position));
      const forwardInput = context && (context.forward || (context.camera && context.camera.forward));
      let fx = finite(forwardInput && forwardInput.x, 0);
      let fz = finite(forwardInput && forwardInput.z, 1);
      const length = Math.max(0.0001, Math.hypot(fx, fz));
      fx /= length; fz /= length;
      return { camera, fx, fz, rx: fz, rz: -fx };
    }
    _isSheltered(x, y, z, context) {
      if (context && context.isSheltered === true) return true;
      const sampler = context && (context.rainOcclusionSampler || context.isShelteredAt);
      if (typeof sampler === "function") {
        try { return Boolean(sampler(x, y, z)); } catch (_) { return false; }
      }
      return false;
    }
    _groundHeight(x, z, context) {
      const sampler = context && context.terrainSampler ? context.terrainSampler : this._terrainSampler;
      return terrainHeight(sampler, x, z);
    }
    _emitPrecipitationEvents(dt, context, precipitation) {
      if (precipitation <= 0 || !["rain", "storm"].includes(this._weather)) return;
      const rate = (this.quality === "lite" ? 8 : this.quality === "high" ? 18 : this.quality === "ultra" ? 32 : 44) * precipitation;
      this._precipitationAccumulator += rate * dt;
      let count = Math.min(12, Math.floor(this._precipitationAccumulator));
      this._precipitationAccumulator -= count;
      const basis = this._cameraBasis(context);
      while (count > 0) {
        count -= 1;
        const forwardDistance = 1.5 + this._random() * 24;
        const lateralDistance = (this._random() * 2 - 1) * 18;
        const x = basis.camera.x + basis.fx * forwardDistance + basis.rx * lateralDistance;
        const z = basis.camera.z + basis.fz * forwardDistance + basis.rz * lateralDistance;
        const y = this._groundHeight(x, z, context);
        if (this._isSheltered(x, y + 12, z, context)) { this._skippedSheltered += 1; continue; }
        const surfaceSampler = context && context.surfaceSampler;
        let surface = "ground";
        if (typeof surfaceSampler === "function") {
          try { surface = safeId(surfaceSampler(x, y, z), "ground"); } catch (_) { surface = "ground"; }
        }
        const onWater = /water|river|lake|ocean|swamp/.test(surface);
        if (onWater) {
          const ripple = this._ripples.acquire((slot) => initializeEffect(slot, "rain-ripple", { x, y, z, radius: 0.08 + this._random() * 0.15, strength: 0.25 + precipitation * 0.35, lifetime: 0.7 + this._random() * 0.8, surface }, { lifetime: 1, radius: 0.1, strength: 0.4, surface: "water" }));
          if (ripple) {
            this._spawnedRipples += 1;
            if (this._waterSystem && this._waterSystem.isActive !== false) this._waterSystem.emitRipple({ x, y, z, radius: ripple.radius, strength: ripple.strength, lifetime: ripple.lifetime });
          }
        } else {
          const splash = this._splashes.acquire((slot) => initializeEffect(slot, "rain-splash", { x, y, z, radius: 0.04 + this._random() * 0.1, strength: 0.2 + precipitation * 0.4, lifetime: 0.18 + this._random() * 0.22, surface }, { lifetime: 0.3, radius: 0.08, strength: 0.3, surface: "ground" }));
          if (splash) this._spawnedSplashes += 1;
        }
      }
    }
    triggerLightning(distanceMeters, options = {}) {
      if (this._disposed || this._weather !== "storm") return null;
      if (this._time - this._lastLightningAt < this._minimumFlashInterval) return null;
      const distance = clamp(distanceMeters, 0, 100000);
      this._lastLightningAt = this._time;
      const flashAllowed = this._flashEnabled && options.flash !== false;
      if (flashAllowed) {
        this._flash.active = true;
        this._flash.remaining = this._flashDuration;
        this._flash.intensity = clamp(options.intensity == null ? 1.25 : options.intensity, 0, 1.6);
        this._flash.count += 1;
      }
      const event = {
        id: `thunder-${hashSeed(`${this.seed}|${this._time}|${distance}`).toString(16)}`,
        lightningAt: this._time, dueAt: this._time + distance / 343,
        delaySeconds: distance / 343, distanceMeters: distance,
        flashShown: flashAllowed, delivered: false
      };
      if (this._thunder.length >= this._thunderLimit) this._thunder.shift();
      if (this._thunderLimit) this._thunder.push(event);
      return safeClone(event);
    }
    consumeDueThunder() {
      const due = [];
      this._thunder.forEach((event) => {
        if (!event.delivered && event.dueAt <= this._time) { event.delivered = true; due.push(safeClone(event)); }
      });
      this._thunder = this._thunder.filter((event) => !event.delivered || this._time - event.dueAt < 1);
      return due;
    }
    update(deltaSeconds, context = {}) {
      if (!this.isActive) return false;
      const raw = Math.max(0, finite(deltaSeconds));
      const dt = Math.min(raw, 0.25);
      if (raw > dt) this._droppedSeconds += raw - dt;
      this._time += dt;
      this._weatherTime += dt;
      const profile = this._profile();
      const precipitation = profile.precipitation * this._intensity;
      const exposure = clamp(context.exposure == null ? 1 : context.exposure, 0, 1);
      const drainage = clamp(context.drainage == null ? 0.35 : context.drainage, 0, 1);
      const lowlandFraction = clamp(context.lowlandFraction == null ? 0.25 : context.lowlandFraction, 0, 1);
      const wetGain = profile.wetRate * precipitation * exposure * dt;
      const temperatureDrying = Math.max(0.25, 1 + (this._temperatureC - 18) * 0.025);
      const effectiveWindSpeed = this._effectiveWindSpeed();
      const windDrying = 1 + clamp(effectiveWindSpeed / 30, 0, 1);
      const dryLoss = profile.dryRate * temperatureDrying * windDrying * (1 - this._humidity * 0.55) * dt;
      this._wetness = clamp(this._wetness + wetGain - dryLoss, 0, 1);
      const puddleTarget = clamp((this._wetness - 0.48) / 0.52, 0, 1) * lowlandFraction * (1 - drainage * 0.55);
      const puddleRate = puddleTarget > this._puddleCoverage ? 0.13 : 0.035 + drainage * 0.08;
      this._puddleCoverage += (puddleTarget - this._puddleCoverage) * Math.min(1, dt * puddleRate);
      const riverTarget = 1 + precipitation * 0.26 + this._wetness * 0.16 + this._puddleCoverage * 0.2;
      this._riverLevel += (riverTarget - this._riverLevel) * Math.min(1, dt * (precipitation > 0 ? 0.045 : 0.012));
      if (this._weather === "snow") this._snowCover = clamp(this._snowCover + precipitation * dt * 0.018 - Math.max(0, this._temperatureC) * dt * 0.0008, 0, 1);
      else this._snowCover = clamp(this._snowCover - Math.max(0.001, this._temperatureC + 2) * dt * 0.0005, 0, 1);
      this._ashCover = clamp(this._ashCover + (this._weather === "ash" ? this._intensity * dt * 0.008 : -dt * (precipitation > 0 ? 0.006 : 0.00015)), 0, 1);
      this._dustLoad = clamp(this._dustLoad + (this._weather === "dust" ? this._intensity * dt * 0.015 : -dt * (precipitation > 0 ? 0.03 : 0.002)), 0, 1);
      this._emitPrecipitationEvents(dt, context, precipitation);
      const decayEffect = (item, delta) => {
        item.age += delta;
        item.radius += delta * (item.type === "rain-ripple" ? 0.75 : 0.18);
        return item.age < item.lifetime;
      };
      this._splashes.update(dt, decayEffect);
      this._ripples.update(dt, decayEffect);
      if (this._flash.active) {
        this._flash.remaining -= dt;
        if (this._flash.remaining <= 0) { this._flash.active = false; this._flash.remaining = 0; this._flash.intensity = 0; }
      }
      if (this._weather === "storm" && this._weatherTime >= this._nextLightningAt) {
        const distance = 300 + this._random() * 4200;
        this.triggerLightning(distance);
        this._nextLightningAt = this._weatherTime + 4 + this._random() * 8;
      }
      this._layers.forEach((layer) => {
        layer.enabled = true;
        layer.density = this._intensity * (layer.id.endsWith("0") ? 1 : 0.65);
        layer.windX = this._wind.x * effectiveWindSpeed;
        layer.windZ = this._wind.z * effectiveWindSpeed;
      });
      this._updates += 1;
      this._lastState = this.getState();
      return this._lastState;
    }
    pause(reason) {
      const result = super.pause(reason);
      this._layers.forEach((layer) => { layer.enabled = false; });
      return result;
    }
    resume() {
      const result = super.resume();
      if (result) this._layers.forEach((layer) => { layer.enabled = true; });
      return result;
    }
    setVisible(visible) {
      const result = super.setVisible(visible);
      this._layers.forEach((layer) => { layer.enabled = result && !this._manualPaused; });
      return result;
    }
    getState() {
      const profile = this._profile();
      return {
        type: this._weather, weather: this._weather, intensity: this._intensity,
        elapsedSeconds: this._weatherTime, temperatureC: this._temperatureC + profile.temperatureOffset,
        humidity: this._humidity, wind: { x: this._wind.x, z: this._wind.z, speed: this._effectiveWindSpeed(), gustFactor: clamp(1 + profile.wind * this._intensity * 0.65, 1, 1.65) }, precipitation: profile.precipitation * this._intensity,
        wetness: this._wetness, terrainRoughnessMultiplier: 1 - this._wetness * 0.42,
        terrainDarkening: this._wetness * 0.28, puddleCoverage: this._puddleCoverage,
        riverLevel: this._riverLevel, snowCover: this._snowCover, ashCover: this._ashCover, dustLoad: this._dustLoad,
        cloudCover: profile.cloud * this._intensity, visibility: 1 - (1 - profile.visibility) * this._intensity,
        flash: safeClone(this._flash), layers: this._layers.map((layer) => safeClone(layer)),
        dueThunder: this._thunder.filter((event) => !event.delivered && event.dueAt <= this._time).map((event) => safeClone(event))
      };
    }
    getRenderDescriptors() {
      return {
        layers: this._layers.map((layer) => safeClone(layer)),
        splashes: this._splashes.activeItems(), ripples: this._ripples.activeItems(),
        flash: safeClone(this._flash), meshPerParticle: false
      };
    }
    getTelemetry() {
      return {
        format: FORMAT, version: VERSION, subsystem: "weather-simulation", state: this.state,
        weather: this._weather, quality: this.quality, simulatedSeconds: this._time,
        updateCount: this._updates, weatherChanges: this._weatherChangeCount,
        activeRainLayers: this._layers.filter((layer) => layer.enabled).length,
        splashes: this._splashes.telemetry(), ripples: this._ripples.telemetry(),
        spawnedSplashes: this._spawnedSplashes, spawnedRipples: this._spawnedRipples,
        shelteredEventsSkipped: this._skippedSheltered, thunderQueued: this._thunder.filter((event) => !event.delivered).length,
        lightningFlashesShown: this._flash.count, droppedSimulationSeconds: this._droppedSeconds,
        flashSafety: { minimumIntervalSeconds: this._minimumFlashInterval, maximumDurationSeconds: 0.12, maximumIntensity: 1.6, enabled: this._flashEnabled },
        drawCalls: null, particleCountMeasured: false, gpuMemoryBytes: null, onlinePlayers: null
      };
    }
    dispose() {
      if (this._disposed) return false;
      this._splashes.dispose(); this._ripples.dispose();
      this._layers.length = 0; this._thunder.length = 0;
      this._waterSystem = null; this._terrainSampler = null;
      this._disposeLifecycle();
      return true;
    }
  }

  function mixColor(a, b, amount) {
    const t = clamp(amount, 0, 1);
    return {
      r: a.r + (b.r - a.r) * t,
      g: a.g + (b.g - a.g) * t,
      b: a.b + (b.b - a.b) * t
    };
  }
  const SKY_COLORS = Object.freeze({
    night: Object.freeze({ r: 0.012, g: 0.02, b: 0.055 }),
    twilight: Object.freeze({ r: 0.48, g: 0.18, b: 0.14 }),
    day: Object.freeze({ r: 0.34, g: 0.57, b: 0.82 }),
    overcast: Object.freeze({ r: 0.39, g: 0.43, b: 0.47 }),
    moon: Object.freeze({ r: 0.38, g: 0.44, b: 0.54 })
  });

  class AtmosphereSystem extends Lifecycle {
    constructor(options = {}) {
      super(options);
      this.quality = normalizeQuality(options.quality || options.qualityPreset);
      this.profile = QUALITY_PROFILES[this.quality];
      this.latitude = clamp(options.latitude == null ? 12 : options.latitude, -89, 89);
      this.dayOfYear = clamp(integer(options.dayOfYear, 172), 1, 366);
      this.timeOfDay = ((finite(options.timeOfDay, 9) % 24) + 24) % 24;
      this.timeScale = clamp(options.timeScale == null ? 0 : options.timeScale, 0, 2400);
      this.humidity = clamp(options.humidity == null ? 0.62 : options.humidity, 0, 1);
      this.temperatureC = clamp(options.temperatureC == null ? 18 : options.temperatureC, -80, 70);
      this.weather = normalizeWeather(options.weather);
      this.weatherIntensity = clamp(options.weatherIntensity == null ? 1 : options.weatherIntensity, 0, 1);
      this.wind = { x: 1, z: 0, speed: 0 };
      if (options.wind) this.setWind(options.wind);
      this.waterLevel = finite(options.waterLevel, 0);
      this._Babylon = options.Babylon || options.BABYLON || (runtime && runtime.BABYLON) || null;
      this._scene = options.scene || null;
      this._sunLight = options.sunLight || null;
      this._moonLight = options.moonLight || null;
      this._ownedLights = [];
      this._fogLayers = [];
      this._state = null;
      this._updates = 0;
      this._calculationCount = 0;
      this._createLights = Boolean(options.createLights);
      this._ensureLights();
      this._recalculate(options.context || {});
    }
    _ensureLights() {
      if (!this._createLights || !this._Babylon || !this._scene) return;
      const B = this._Babylon;
      try {
        if (!this._sunLight && typeof B.DirectionalLight === "function" && typeof B.Vector3 === "function") {
          this._sunLight = new B.DirectionalLight("hwe-atmosphere-sun", new B.Vector3(0, -1, 0), this._scene);
          this._ownedLights.push(this._sunLight);
        }
        if (!this._moonLight && typeof B.DirectionalLight === "function" && typeof B.Vector3 === "function") {
          this._moonLight = new B.DirectionalLight("hwe-atmosphere-moon", new B.Vector3(0, 1, 0), this._scene);
          this._ownedLights.push(this._moonLight);
        }
      } catch (_) {
        this._ownedLights.forEach((light) => { if (light && typeof light.dispose === "function") { try { light.dispose(); } catch (_) {} } });
        this._ownedLights.length = 0;
        this._sunLight = null;
        this._moonLight = null;
      }
    }
    setWind(wind = {}) {
      let x = finite(wind.x, 1);
      let z = finite(wind.z, finite(wind.y, 0));
      const length = Math.hypot(x, z);
      if (length > 0.0001) { x /= length; z /= length; } else { x = 1; z = 0; }
      this.wind = { x, z, speed: clamp(wind.speed, 0, 80) };
      return safeClone(this.wind);
    }
    setEnvironment(options = {}) {
      if (this._disposed) return false;
      if (options.quality || options.qualityPreset) this.setQuality(options.quality || options.qualityPreset);
      if (options.latitude != null) this.latitude = clamp(options.latitude, -89, 89);
      if (options.dayOfYear != null) this.dayOfYear = clamp(integer(options.dayOfYear), 1, 366);
      if (options.timeOfDay != null) this.timeOfDay = ((finite(options.timeOfDay) % 24) + 24) % 24;
      if (options.timeScale != null) this.timeScale = clamp(options.timeScale, 0, 2400);
      if (options.humidity != null) this.humidity = clamp(options.humidity, 0, 1);
      if (options.temperatureC != null) this.temperatureC = clamp(options.temperatureC, -80, 70);
      if (options.weather || options.type) this.weather = normalizeWeather(options.weather || options.type);
      if (options.weatherIntensity != null || options.intensity != null) this.weatherIntensity = clamp(options.weatherIntensity == null ? options.intensity : options.weatherIntensity, 0, 1);
      if (options.wind) this.setWind(options.wind);
      if (options.waterLevel != null) this.waterLevel = finite(options.waterLevel);
      return this._recalculate(options.context || {});
    }
    configure(options) { return this.setEnvironment(options); }
    setQuality(value) {
      if (this._disposed) return false;
      this.quality = normalizeQuality(value);
      this.profile = QUALITY_PROFILES[this.quality];
      return true;
    }
    _solarState() {
      const radians = Math.PI / 180;
      const latitude = this.latitude * radians;
      const declination = 23.44 * radians * Math.sin((2 * Math.PI / 365) * (284 + this.dayOfYear));
      const hourAngle = (this.timeOfDay - 12) * 15 * radians;
      const sinElevation = clamp(Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle), -1, 1);
      const elevation = Math.asin(sinElevation);
      const azimuth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(latitude) - Math.tan(declination) * Math.cos(latitude));
      const cosElevation = Math.cos(elevation);
      const vector = { x: Math.sin(azimuth) * cosElevation, y: sinElevation, z: Math.cos(azimuth) * cosElevation };
      const daylight = clamp((sinElevation + 0.08) / 0.35, 0, 1);
      const twilight = clamp(1 - Math.abs(sinElevation) / 0.18, 0, 1) * (1 - daylight * 0.4);
      return { elevationRadians: elevation, azimuthRadians: azimuth, elevationDegrees: elevation / radians, azimuthDegrees: azimuth / radians, direction: vector, daylight, twilight };
    }
    _moonState(sun) {
      const phase = ((this.dayOfYear % 29.53059) / 29.53059 + 1) % 1;
      const phaseAngle = phase * Math.PI * 2;
      const y = clamp(-sun.direction.y + Math.sin(phaseAngle) * 0.18, -1, 1);
      let x = -sun.direction.x + Math.cos(phaseAngle) * 0.12;
      let z = -sun.direction.z + Math.sin(phaseAngle) * 0.12;
      const length = Math.max(0.0001, Math.hypot(x, y, z));
      x /= length; z /= length;
      const normalizedY = y / length;
      return { phase, illumination: (1 - Math.cos(phaseAngle)) * 0.5, direction: { x, y: normalizedY, z }, elevationDegrees: Math.asin(clamp(normalizedY, -1, 1)) * 180 / Math.PI };
    }
    _buildFogLayers(context, sky) {
      const layers = [];
      const weatherProfile = WEATHER_PROFILES[this.weather];
      const weatherFog = (1 - weatherProfile.visibility) * this.weatherIntensity;
      const valleyFactor = clamp(context.valleyFactor == null ? 0.35 : context.valleyFactor, 0, 1);
      const distanceToWater = Math.max(0, finite(context.distanceToWater, 1000));
      const waterFactor = Math.exp(-distanceToWater / 90) * clamp(this.humidity * 1.2, 0, 1);
      const dawn = clamp(1 - Math.abs(this.timeOfDay - 6) / 3, 0, 1);
      const night = 1 - sky.daylight;
      const baseHeightDensity = clamp(0.002 + this.humidity * 0.006 + weatherFog * 0.012, 0, 0.035);
      layers.push({ id: "height", type: "height", density: baseHeightDensity, baseHeight: finite(context.groundHeight, 0), falloff: 0.018, colorInfluence: 0.55 });
      if (valleyFactor > 0.05) layers.push({ id: "valley", type: "valley", density: clamp(valleyFactor * this.humidity * (0.004 + dawn * 0.012), 0, 0.025), baseHeight: finite(context.valleyFloor, context.groundHeight), ceiling: finite(context.valleyFloor, context.groundHeight) + 42 + this.humidity * 90, falloff: 0.035, colorInfluence: 0.65 });
      if (waterFactor > 0.03) layers.push({ id: "water", type: "water-surface", density: clamp(waterFactor * (0.004 + dawn * 0.015 + night * 0.003), 0, 0.024), baseHeight: finite(context.waterLevel, this.waterLevel), ceiling: finite(context.waterLevel, this.waterLevel) + 3 + this.humidity * 9, falloff: 0.11, colorInfluence: 0.72 });
      if (["mist", "rain", "storm"].includes(this.weather)) layers.push({ id: "weather", type: this.weather === "mist" ? "suspended-mist" : "rain-mist", density: clamp(weatherFog * 0.026 + (this.weather === "mist" ? 0.008 : 0), 0, 0.04), baseHeight: finite(context.groundHeight, 0), falloff: this.weather === "mist" ? 0.012 : 0.005, colorInfluence: 0.8 });
      if (this.weather === "ash" || this.weather === "dust") layers.push({ id: this.weather, type: `${this.weather}-haze`, density: clamp(weatherFog * 0.035, 0, 0.05), baseHeight: finite(context.groundHeight, 0), falloff: 0.003, colorInfluence: 0.9 });
      return layers.slice(0, Math.min(this.profile.fogLayers, HARD_LIMITS.fogLayers));
    }
    _recalculate(context = {}) {
      const sun = this._solarState();
      const moon = this._moonState(sun);
      const weatherProfile = WEATHER_PROFILES[this.weather];
      const cloudCover = weatherProfile.cloud * this.weatherIntensity;
      let skyColor = mixColor(SKY_COLORS.night, SKY_COLORS.day, sun.daylight);
      skyColor = mixColor(skyColor, SKY_COLORS.twilight, sun.twilight * 0.7);
      skyColor = mixColor(skyColor, SKY_COLORS.overcast, cloudCover * 0.72);
      const rayleigh = { x: 5.8e-6, y: 13.5e-6, z: 33.1e-6 };
      const mie = clamp(1.2e-5 + this.humidity * 1.8e-5 + cloudCover * 1.5e-5, 0.000008, 0.00006);
      const exposure = clamp(0.22 + sun.daylight * 0.83 + moon.illumination * (1 - sun.daylight) * 0.12, 0.16, 1.15);
      this._fogLayers = this._buildFogLayers(context, sun);
      this._state = {
        timeOfDay: this.timeOfDay, dayOfYear: this.dayOfYear,
        sun: Object.assign({}, sun, { intensity: clamp(sun.daylight * (1 - cloudCover * 0.68), 0, 1.05), colorTemperatureK: 2900 + sun.daylight * 3100 }),
        moon: Object.assign({}, moon, { intensity: clamp((1 - sun.daylight) * moon.illumination * 0.16, 0.008, 0.16) }),
        sky: {
          model: this.quality === "lite" ? "physical-gradient-approximation" : "rayleigh-mie-approximation",
          color: skyColor, rayleigh, mie, turbidity: 1.6 + this.humidity * 2.1 + cloudCover * 4,
          exposure, stars: clamp((1 - sun.daylight) * (1 - cloudCover), 0, 1),
          cloudMode: this.profile.cloudMode, cloudCover, volumetricSteps: this.profile.volumetricSteps,
          cloudShadowStrength: clamp(cloudCover * (this.quality === "lite" ? 0 : 0.55), 0, 0.55)
        },
        ambient: { color: mixColor(SKY_COLORS.moon, skyColor, 0.7), intensity: clamp(0.16 + sun.daylight * 0.46, 0.14, 0.62) },
        fogLayers: this._fogLayers.map((layer) => safeClone(layer)), wind: safeClone(this.wind),
        quality: this.quality, fallback: this.quality === "lite" ? "depth-height-billboard" : (this.profile.volumetricSteps ? "bounded-volumetric-with-layered-fallback" : "layered-depth-height")
      };
      this._applyBabylonState();
      this._calculationCount += 1;
      return this.getRenderState();
    }
    _applyBabylonState() {
      if (!this._state) return;
      const B = this._Babylon;
      const setDirection = (light, vector) => {
        if (!light) return;
        if (B && typeof B.Vector3 === "function") light.direction = new B.Vector3(-vector.x, -vector.y, -vector.z);
        else if (light.direction) { light.direction.x = -vector.x; light.direction.y = -vector.y; light.direction.z = -vector.z; }
        light.intensity = finite(vector === this._state.sun.direction ? this._state.sun.intensity : this._state.moon.intensity, 0);
      };
      setDirection(this._sunLight, this._state.sun.direction);
      setDirection(this._moonLight, this._state.moon.direction);
      if (this._scene) {
        const color = this._state.sky.color;
        if (this._scene.clearColor && typeof this._scene.clearColor === "object") {
          this._scene.clearColor.r = color.r; this._scene.clearColor.g = color.g; this._scene.clearColor.b = color.b;
          if ("a" in this._scene.clearColor) this._scene.clearColor.a = 1;
        }
        if (this._scene.imageProcessingConfiguration) this._scene.imageProcessingConfiguration.exposure = this._state.sky.exposure;
      }
    }
    getFogDensityAt(position, context = {}) {
      const point = vec3(position);
      let density = 0;
      this._fogLayers.forEach((layer) => {
        if (layer.ceiling != null && point.y > layer.ceiling) return;
        const height = Math.max(0, point.y - finite(layer.baseHeight, 0));
        let contribution = layer.density * Math.exp(-height * finite(layer.falloff, 0.01));
        if (layer.type === "water-surface" && context.distanceToWater != null) contribution *= Math.exp(-Math.max(0, finite(context.distanceToWater)) / 90);
        density += contribution;
      });
      return clamp(density, 0, 0.12);
    }
    update(deltaSeconds, context = {}) {
      if (!this.isActive) return false;
      const dt = clamp(deltaSeconds, 0, 0.25);
      if (this.timeScale > 0) this.timeOfDay = (this.timeOfDay + dt * this.timeScale / 3600) % 24;
      if (context.weatherState) {
        const weather = context.weatherState;
        this.weather = normalizeWeather(weather.weather || weather.type);
        this.weatherIntensity = clamp(weather.intensity == null ? 1 : weather.intensity, 0, 1);
        if (weather.humidity != null) this.humidity = clamp(weather.humidity, 0, 1);
        if (weather.temperatureC != null) this.temperatureC = clamp(weather.temperatureC, -80, 70);
        if (weather.wind) this.setWind(weather.wind);
      }
      this._updates += 1;
      return this._recalculate(context);
    }
    getRenderState() { return safeClone(this._state); }
    getTelemetry() {
      return {
        format: FORMAT, version: VERSION, subsystem: "atmosphere", state: this.state,
        quality: this.quality, fogLayerCount: this._fogLayers.length,
        cloudMode: this.profile.cloudMode, volumetricSteps: this.profile.volumetricSteps,
        calculationCount: this._calculationCount, updateCount: this._updates,
        ownedLightCount: this._ownedLights.length, attachedLightCount: Number(Boolean(this._sunLight)) + Number(Boolean(this._moonLight)),
        drawCalls: null, cloudRenderTimeMs: null, gpuMemoryBytes: null, measuredRendering: false
      };
    }
    dispose() {
      if (this._disposed) return false;
      this._ownedLights.forEach((light) => { if (light && typeof light.dispose === "function") { try { light.dispose(); } catch (_) {} } });
      this._ownedLights.length = 0;
      this._sunLight = null; this._moonLight = null; this._scene = null; this._Babylon = null;
      this._fogLayers.length = 0; this._state = null;
      this._disposeLifecycle();
      return true;
    }
  }

  function interactionItem(index) {
    return {
      _poolIndex: index, active: false, id: "", type: "", age: 0, lifetime: 1,
      x: 0, y: 0, z: 0, radius: 0, strength: 0, opacity: 1,
      entityId: "", speciesId: "", surface: "ground", wetness: 0
    };
  }

  class EnvironmentalInteractionSystem extends Lifecycle {
    constructor(options = {}) {
      super(options);
      this.quality = normalizeQuality(options.quality || options.qualityPreset);
      this._footprints = new FixedObjectPool(budgetValue(options, "footprints", this.quality, "footprints"), interactionItem);
      this._splashes = new FixedObjectPool(budgetValue(options, "interactionSplashes", this.quality, "interactionSplashes"), interactionItem);
      this._disturbances = new FixedObjectPool(budgetValue(options, "disturbances", this.quality, "disturbances"), interactionItem);
      this._wetness = new FixedObjectPool(budgetValue(options, "wetnessPatches", this.quality, "wetnessPatches"), interactionItem);
      this._time = 0;
      this._updates = 0;
      this._eventCounts = { footprints: 0, splashes: 0, disturbances: 0, wetness: 0 };
    }
    _surfaceLifetime(surface, baseLifetime, weatherWetness) {
      const id = safeId(surface, "ground");
      let multiplier = 1;
      if (/snow/.test(id)) multiplier = 3.2;
      else if (/mud/.test(id)) multiplier = 2.6;
      else if (/sand/.test(id)) multiplier = 1.8;
      else if (/rock|water/.test(id)) multiplier = 0.35;
      return clamp(baseLifetime * multiplier * (1 + clamp(weatherWetness, 0, 1) * 0.7), 0.2, 900);
    }
    _add(pool, type, input, defaults, counter) {
      if (!this.isActive) return null;
      const source = input && typeof input === "object" ? input : {};
      const position = vec3(source.position || source);
      const item = pool.acquire((slot) => {
        slot.id = safeId(source.id, `${type}-${slot._sequence}`);
        slot.type = type; slot.age = 0;
        slot.x = position.x; slot.y = position.y; slot.z = position.z;
        slot.radius = clamp(source.radius == null ? defaults.radius : source.radius, 0.01, 40);
        slot.strength = clamp(source.strength == null ? defaults.strength : source.strength, 0, 4);
        slot.opacity = 1;
        slot.entityId = safeId(source.entityId, "environment");
        slot.speciesId = safeId(source.speciesId, "unknown-species");
        slot.surface = safeId(source.surface, defaults.surface);
        slot.wetness = clamp(source.wetness == null ? (defaults.wetness == null ? defaults.strength : defaults.wetness) : source.wetness, 0, 1);
        const baseLifetime = clamp(source.lifetime == null ? defaults.lifetime : source.lifetime, 0.05, 900);
        slot.lifetime = type === "footprint" ? this._surfaceLifetime(slot.surface, baseLifetime, slot.wetness) : baseLifetime;
        slot.directionX = finite(source.direction && source.direction.x, finite(source.directionX, 0));
        slot.directionZ = finite(source.direction && source.direction.z, finite(source.directionZ, 1));
        slot.side = source.side === "right" ? "right" : (source.side === "left" ? "left" : "center");
        slot.compression = clamp(source.compression == null ? defaults.compression || 0 : source.compression, 0, 1);
      });
      if (item) {
        this._eventCounts[counter] += 1;
        return safeClone(item);
      }
      return null;
    }
    addFootprint(input) {
      return this._add(this._footprints, "footprint", input, { radius: 0.28, strength: 0.65, lifetime: 42, surface: "soil", compression: 0.55 }, "footprints");
    }
    recordFootprint(input) { return this.addFootprint(input); }
    addSplash(input) {
      return this._add(this._splashes, "splash", input, { radius: 0.45, strength: 0.8, lifetime: 1.1, surface: "water" }, "splashes");
    }
    emitSplash(input) { return this.addSplash(input); }
    addDisturbance(input) {
      return this._add(this._disturbances, "vegetation-disturbance", input, { radius: 1.2, strength: 0.55, lifetime: 5, surface: "vegetation", compression: 0.45 }, "disturbances");
    }
    disturbVegetation(input) { return this.addDisturbance(input); }
    addWetness(input) {
      const source = input && typeof input === "object" ? input : {};
      const position = vec3(source.position || source);
      const mergeRadius = clamp(source.mergeRadius == null ? 0.75 : source.mergeRadius, 0, 10);
      let merged = null;
      this._wetness.activeItems(false).some((item) => {
        if (item.surface !== safeId(source.surface, "ground") || distance2D(item, position) > mergeRadius) return false;
        item.wetness = clamp(Math.max(item.wetness, finite(source.wetness, 0.5)), 0, 1);
        item.strength = item.wetness;
        item.age = 0;
        item.lifetime = clamp(source.lifetime == null ? item.lifetime : source.lifetime, 0.1, 900);
        merged = safeClone(item);
        return true;
      });
      if (merged) return merged;
      return this._add(this._wetness, "wetness", source, { radius: 0.8, strength: clamp(source.wetness == null ? 0.5 : source.wetness, 0, 1), lifetime: 24, surface: "ground" }, "wetness");
    }
    applyWetness(input) { return this.addWetness(input); }
    update(deltaSeconds, context = {}) {
      if (!this.isActive) return false;
      const dt = clamp(deltaSeconds, 0, 0.25);
      this._time += dt;
      const weatherWetness = clamp(context.wetness == null ? (context.weatherState && context.weatherState.wetness) : context.wetness, 0, 1);
      const temperatureC = finite(context.temperatureC == null ? (context.weatherState && context.weatherState.temperatureC) : context.temperatureC, 18);
      const windSpeed = clamp(context.windSpeed == null ? (context.weatherState && context.weatherState.wind && context.weatherState.wind.speed) : context.windSpeed, 0, 80);
      const decay = (item, delta) => {
        const persistence = item.type === "footprint" && weatherWetness > 0.55 ? 0.42 : 1;
        item.age += delta * persistence;
        item.opacity = clamp(1 - item.age / item.lifetime, 0, 1);
        return item.age < item.lifetime;
      };
      this._footprints.update(dt, decay);
      this._splashes.update(dt, (item, delta) => {
        item.age += delta; item.radius += delta * (0.5 + item.strength); item.opacity = clamp(1 - item.age / item.lifetime, 0, 1);
        return item.age < item.lifetime;
      });
      this._disturbances.update(dt, (item, delta) => {
        item.age += delta; item.strength *= Math.max(0, 1 - delta * 1.4); item.opacity = clamp(item.strength, 0, 1);
        return item.age < item.lifetime && item.strength > 0.01;
      });
      this._wetness.update(dt, (item, delta) => {
        const dryRate = (0.008 + Math.max(0, temperatureC) * 0.00035 + windSpeed * 0.00025) * (1 - weatherWetness * 0.88);
        item.age += delta;
        item.wetness = clamp(item.wetness - dryRate * delta, 0, 1);
        item.strength = item.wetness; item.opacity = item.wetness;
        return item.age < item.lifetime && item.wetness > 0.005;
      });
      this._updates += 1;
      return true;
    }
    query(position, radius = 10, type) {
      const center = vec3(position);
      const limit = clamp(radius, 0, 10000);
      const pools = type === "footprint" ? [this._footprints]
        : type === "splash" ? [this._splashes]
          : type === "disturbance" || type === "vegetation-disturbance" ? [this._disturbances]
            : type === "wetness" ? [this._wetness]
              : [this._footprints, this._splashes, this._disturbances, this._wetness];
      const result = [];
      pools.forEach((pool) => pool.activeItems(false).forEach((item) => {
        if (distance2D(item, center) <= limit) result.push(safeClone(item));
      }));
      return result.sort((a, b) => distance2D(a, center) - distance2D(b, center));
    }
    getRenderDescriptors() {
      return {
        footprints: this._footprints.activeItems(), splashes: this._splashes.activeItems(),
        disturbances: this._disturbances.activeItems(), wetnessPatches: this._wetness.activeItems(),
        rendererContract: { decalsBatched: true, splashesPooled: true, vegetationFieldInput: true, individualMeshes: false }
      };
    }
    clear() {
      if (this._disposed) return false;
      this._footprints.clear(); this._splashes.clear(); this._disturbances.clear(); this._wetness.clear();
      return true;
    }
    getTelemetry() {
      return {
        format: FORMAT, version: VERSION, subsystem: "environmental-interaction", state: this.state,
        quality: this.quality, simulatedSeconds: this._time, updateCount: this._updates,
        footprints: this._footprints.telemetry(), splashes: this._splashes.telemetry(),
        disturbances: this._disturbances.telemetry(), wetnessPatches: this._wetness.telemetry(),
        eventsRecorded: safeClone(this._eventCounts),
        meshCount: 0, drawCalls: null, gpuMemoryBytes: null, measuredRendering: false
      };
    }
    dispose() {
      if (this._disposed) return false;
      this._footprints.dispose(); this._splashes.dispose(); this._disturbances.dispose(); this._wetness.dispose();
      this._disposeLifecycle();
      return true;
    }
  }

  class WaterWeatherEnvironment extends Lifecycle {
    constructor(options = {}) {
      super(options);
      const childOptions = Object.assign({}, options, { autoVisibility: false });
      this.rivers = options.rivers instanceof RiverNetworkSystem ? options.rivers : new RiverNetworkSystem(childOptions);
      this.water = options.water instanceof WaterRenderingSystem ? options.water : new WaterRenderingSystem(childOptions);
      this.weather = options.weatherSystem instanceof WeatherSimulationSystem
        ? options.weatherSystem
        : new WeatherSimulationSystem(Object.assign({}, childOptions, { waterSystem: this.water, weather: typeof options.weather === "string" ? options.weather : options.weatherType }));
      this.atmosphere = options.atmosphere instanceof AtmosphereSystem ? options.atmosphere : new AtmosphereSystem(childOptions);
      this.interactions = options.interactions instanceof EnvironmentalInteractionSystem ? options.interactions : new EnvironmentalInteractionSystem(childOptions);
      this._updates = 0;
      this._time = 0;
    }
    configure(options = {}) {
      if (this._disposed) return false;
      if (options.weather || options.weatherType) this.weather.setWeather(options.weather || options.weatherType, options);
      if (options.atmosphere || options.timeOfDay != null || options.dayOfYear != null) this.atmosphere.setEnvironment(Object.assign({}, options.atmosphere || {}, options));
      if (options.weatherState) this.water.setWeatherState(options.weatherState);
      if (options.quality || options.qualityPreset) {
        const quality = options.quality || options.qualityPreset;
        this.water.setQuality(quality);
        this.atmosphere.setQuality(quality);
      }
      return this.getState();
    }
    update(deltaSeconds, context = {}) {
      if (!this.isActive) return false;
      const dt = clamp(deltaSeconds, 0, 0.25);
      const weatherState = this.weather.update(dt, context) || this.weather.getState();
      this.water.setWeatherState(weatherState);
      this.water.update(dt);
      this.interactions.update(dt, { weatherState, wetness: weatherState.wetness, temperatureC: weatherState.temperatureC, windSpeed: weatherState.wind && weatherState.wind.speed });
      const atmosphereState = this.atmosphere.update(dt, Object.assign({}, context, { weatherState }));
      this._time += dt;
      this._updates += 1;
      if (context && context.collectState === false) return true;
      return { weather: weatherState, atmosphere: atmosphereState, water: this.water.getRenderDescriptors(), interactions: this.interactions.getRenderDescriptors() };
    }
    getState() {
      return {
        state: this.state, rivers: this.rivers.getNetwork(), water: this.water.getRenderDescriptors(),
        weather: this.weather.getState(), atmosphere: this.atmosphere.getRenderState(),
        interactions: this.interactions.getRenderDescriptors()
      };
    }
    pause(reason) {
      const result = super.pause(reason);
      this.rivers.pause(reason); this.water.pause(reason); this.weather.pause(reason); this.atmosphere.pause(reason); this.interactions.pause(reason);
      return result;
    }
    resume() {
      if (this._disposed) return false;
      super.resume();
      this.rivers.resume(); this.water.resume(); this.weather.resume(); this.atmosphere.resume(); this.interactions.resume();
      return this.isActive;
    }
    setVisible(visible) {
      if (this._disposed) return false;
      super.setVisible(visible);
      this.rivers.setVisible(visible); this.water.setVisible(visible); this.weather.setVisible(visible); this.atmosphere.setVisible(visible); this.interactions.setVisible(visible);
      return this.isActive;
    }
    getTelemetry() {
      return {
        format: FORMAT, version: VERSION, subsystem: "water-weather-environment", state: this.state,
        simulatedSeconds: this._time, updateCount: this._updates,
        rivers: this.rivers.getTelemetry(), water: this.water.getTelemetry(), weather: this.weather.getTelemetry(),
        atmosphere: this.atmosphere.getTelemetry(), interactions: this.interactions.getTelemetry(),
        fps: null, frameTimeP95Ms: null, drawCalls: null, gpuMemoryBytes: null, measuredRendering: false
      };
    }
    dispose() {
      if (this._disposed) return false;
      this.rivers.dispose(); this.water.dispose(); this.weather.dispose(); this.atmosphere.dispose(); this.interactions.dispose();
      this._disposeLifecycle();
      return true;
    }
  }

  function create(options) { return new WaterWeatherEnvironment(options); }
  function createRiverNetworkSystem(options) { return new RiverNetworkSystem(options); }
  function createWaterRenderingSystem(options) { return new WaterRenderingSystem(options); }
  function createWeatherSimulationSystem(options) { return new WeatherSimulationSystem(options); }
  function createAtmosphereSystem(options) { return new AtmosphereSystem(options); }
  function createEnvironmentalInteractionSystem(options) { return new EnvironmentalInteractionSystem(options); }

  return Object.freeze({
    VERSION, FORMAT, WEATHER_TYPES, WATER_TYPES, QUALITY_ORDER, QUALITY_PROFILES, WEATHER_PROFILES, HARD_LIMITS,
    RiverNetworkSystem, WaterRenderingSystem, WeatherSimulationSystem, AtmosphereSystem, EnvironmentalInteractionSystem,
    WaterWeatherEnvironment, FixedObjectPool,
    create, createRiverNetworkSystem, createWaterRenderingSystem, createWeatherSimulationSystem,
    createAtmosphereSystem, createEnvironmentalInteractionSystem,
    utilities: Object.freeze({ finite, clamp, hashSeed, createRandom, terrainHeight, normalizeQuality, normalizeWeather })
  });
}));
