(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHEonWildCollisionSystem = api;
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function createHHEonWildCollisionSystem() {
  "use strict";

  /*
   * Renderer-neutral collision and terrain-contact kernel for HH EonWild.
   *
   * Positions passed to resolveMovement use the base of the animal collision
   * cylinder (feet / belly contact), not the mesh pivot. The kernel owns no DOM,
   * renderer, worker or persistence state. It is designed to run once after each
   * proposed fixed-timestep controller step.
   */
  const VERSION = "1.0.0";
  const FORMAT = "hh-eonwild-collision-system-v1";
  const EPSILON = 1e-8;

  const LIMITS = Object.freeze({
    MIN_CELL_SIZE: 1,
    MAX_CELL_SIZE: 512,
    MAX_STATIC_OBSTACLES: 16384,
    MAX_CELLS_PER_OBSTACLE: 256,
    MAX_QUERY_CELLS: 2048,
    MAX_QUERY_RESULTS: 1024,
    MAX_RESOLVE_ITERATIONS: 8,
    MAX_DEPENETRATION_ITERATIONS: 4,
    MAX_GROUND_BINARY_STEPS: 16,
    MAX_WATER_BINARY_STEPS: 16,
    GROUND_SAMPLE_COUNT: 9,
    MAX_WORLD_COORDINATE: 1000000000,
    MAX_AGENT_RADIUS: 64,
    MAX_AGENT_HEIGHT: 128,
    MAX_MOVE_DISTANCE: 64,
    MAX_STEP_HEIGHT: 8,
    MAX_DEPENETRATION_DISTANCE: 4,
    MAX_OBSTACLE_ID_LENGTH: 96
  });

  const OBSTACLE_TYPES = Object.freeze(["tree", "rock", "cliff", "static"]);
  const OBSTACLE_SHAPES = Object.freeze(["circle", "aabb"]);
  const WATER_RULES = Object.freeze(["wade", "allow", "block", "require", "ignore"]);

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
    return value;
  }

  const LOCOMOTION_PROFILES = deepFreeze({
    terrestrial: locomotionProfile("terrestrial", true, true, "wade", 0.65, 0, 48, 0.75, 1.2, 0.75, 0.35),
    heavy: locomotionProfile("heavy", true, true, "wade", 0.9, 0, 42, 0.65, 1, 0.65, 0.3),
    amphibious: locomotionProfile("amphibious", true, true, "allow", Infinity, 0, 50, 0.65, 1.1, 0.65, 0.4),
    aquatic: locomotionProfile("aquatic", false, true, "require", Infinity, 0.25, 89, 0, 0, 0, 0),
    flying: locomotionProfile("flying", false, true, "ignore", Infinity, 0, 89, 0, 0, 0, 0),
    climbing: locomotionProfile("climbing", true, true, "block", 0, 0, 72, 1.25, 1.5, 1.25, 0.55),
    burrowing: locomotionProfile("burrowing", true, true, "block", 0, 0, 35, 0.4, 0.6, 0.4, 0.25)
  });

  const CAPABILITIES = deepFreeze({
    rendererNeutral: true,
    fixedStepIntegration: true,
    allocationAwareOptionalOutputs: true,
    broadPhase: {
      type: "bounded-uniform-spatial-hash-xz",
      staticOnly: true,
      failClosedWhenTruncated: true
    },
    narrowPhase: {
      shapes: ["vertical-cylinder", "axis-aligned-box"],
      continuousHorizontalSweep: true,
      stableSlideWithoutVelocityReflection: true,
      triangleMeshes: false,
      orientedBoxes: false,
      dynamicRigidBodies: false
    },
    terrain: {
      deterministicSamples: LIMITS.GROUND_SAMPLE_COUNT,
      pattern: "center-cardinals-diagonals",
      slopeRejection: true,
      boundedStepAndSnap: true,
      meshRaycast: false
    },
    water: {
      locomotionBoundaryRules: true,
      pointSampled: true,
      buoyancy: false,
      hydrodynamics: false
    }
  });

  function locomotionProfile(id, grounding, collidesStatic, waterRule, maxWaterDepth, minWaterDepth, maxSlopeDegrees, maxStepUp, maxStepDown, maxSnapUp, maxSnapDown) {
    return {
      id,
      grounding,
      collidesStatic,
      waterRule,
      maxWaterDepth,
      minWaterDepth,
      maxSlopeDegrees,
      maxStepUp,
      maxStepDown,
      maxSnapUp,
      maxSnapDown
    };
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function finiteOrNaN(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : NaN;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, finite(value, minimum)));
  }

  function optionNumber(value, fallback, minimum, maximum) {
    return Number.isFinite(Number(value)) ? clamp(Number(value), minimum, maximum) : fallback;
  }

  function safeId(value, fallback = "") {
    const id = String(value == null ? "" : value)
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, LIMITS.MAX_OBSTACLE_ID_LENGTH);
    return id || fallback;
  }

  function checkedCoordinate(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite`);
    if (Math.abs(number) > LIMITS.MAX_WORLD_COORDINATE) throw new RangeError(`${label} is outside supported world coordinates`);
    return number;
  }

  function normalizeLocomotionId(value) {
    const id = safeId(typeof value === "object" && value ? (value.id || value.mode) : value, "terrestrial").toLowerCase();
    const aliases = {
      ground: "terrestrial",
      land: "terrestrial",
      quadruped: "terrestrial",
      biped: "terrestrial",
      semi_aquatic: "amphibious",
      "semi-aquatic": "amphibious",
      bird: "flying",
      flight: "flying",
      fish: "aquatic",
      marine: "aquatic",
      climb: "climbing",
      burrow: "burrowing"
    };
    const canonical = aliases[id] || id;
    return LOCOMOTION_PROFILES[canonical] ? canonical : "terrestrial";
  }

  function resolveLocomotionProfile(input = "terrestrial") {
    const source = input && typeof input === "object" ? input : null;
    const base = LOCOMOTION_PROFILES[normalizeLocomotionId(input)];
    if (!source) return base;
    const waterRule = safeId(source.waterRule, base.waterRule).toLowerCase();
    return Object.freeze({
      id: base.id,
      grounding: typeof source.grounding === "boolean" ? source.grounding : base.grounding,
      collidesStatic: typeof source.collidesStatic === "boolean" ? source.collidesStatic : base.collidesStatic,
      waterRule: WATER_RULES.includes(waterRule) ? waterRule : base.waterRule,
      maxWaterDepth: source.maxWaterDepth === Infinity ? Infinity : optionNumber(source.maxWaterDepth, base.maxWaterDepth, 0, 10000),
      minWaterDepth: optionNumber(source.minWaterDepth, base.minWaterDepth, 0, 10000),
      maxSlopeDegrees: optionNumber(source.maxSlopeDegrees, base.maxSlopeDegrees, 0, 89.9),
      maxStepUp: optionNumber(source.maxStepUp, base.maxStepUp, 0, LIMITS.MAX_STEP_HEIGHT),
      maxStepDown: optionNumber(source.maxStepDown, base.maxStepDown, 0, LIMITS.MAX_STEP_HEIGHT),
      maxSnapUp: optionNumber(source.maxSnapUp, base.maxSnapUp, 0, LIMITS.MAX_STEP_HEIGHT),
      maxSnapDown: optionNumber(source.maxSnapDown, base.maxSnapDown, 0, LIMITS.MAX_STEP_HEIGHT)
    });
  }

  function normalizeObstacle(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("obstacle must be an object");
    const id = safeId(input.id || input.obstacleId);
    if (!id) throw new TypeError("obstacle.id is required");
    const bounds = input.bounds && typeof input.bounds === "object" ? input.bounds : {};
    const requestedShape = safeId(input.shape || input.collider, "").toLowerCase();
    const shape = requestedShape === "box" || requestedShape === "rectangle"
      ? "aabb"
      : (requestedShape === "cylinder" ? "circle" : requestedShape);
    const normalizedShape = OBSTACLE_SHAPES.includes(shape)
      ? shape
      : (Number.isFinite(Number(input.radius)) ? "circle" : "aabb");

    let minX;
    let maxX;
    let minZ;
    let maxZ;
    let x;
    let z;
    let radius = 0;
    if (normalizedShape === "circle") {
      x = checkedCoordinate(input.x ?? input.position?.x, "obstacle.x");
      z = checkedCoordinate(input.z ?? input.position?.z, "obstacle.z");
      radius = optionNumber(input.radius ?? input.collisionRadius, NaN, 0.01, 512);
      if (!Number.isFinite(radius)) throw new TypeError("circle obstacle.radius must be finite and positive");
      minX = x - radius;
      maxX = x + radius;
      minZ = z - radius;
      maxZ = z + radius;
    } else {
      const centerX = finiteOrNaN(input.x ?? input.position?.x);
      const centerZ = finiteOrNaN(input.z ?? input.position?.z);
      const halfWidth = finiteOrNaN(input.halfWidth ?? (Number(input.width) / 2));
      const halfDepth = finiteOrNaN(input.halfDepth ?? (Number(input.depth) / 2));
      minX = finiteOrNaN(input.minX ?? bounds.minX);
      maxX = finiteOrNaN(input.maxX ?? bounds.maxX);
      minZ = finiteOrNaN(input.minZ ?? bounds.minZ);
      maxZ = finiteOrNaN(input.maxZ ?? bounds.maxZ);
      if ((!Number.isFinite(minX) || !Number.isFinite(maxX)) && Number.isFinite(centerX) && Number.isFinite(halfWidth)) {
        minX = centerX - Math.abs(halfWidth);
        maxX = centerX + Math.abs(halfWidth);
      }
      if ((!Number.isFinite(minZ) || !Number.isFinite(maxZ)) && Number.isFinite(centerZ) && Number.isFinite(halfDepth)) {
        minZ = centerZ - Math.abs(halfDepth);
        maxZ = centerZ + Math.abs(halfDepth);
      }
      minX = checkedCoordinate(minX, "obstacle.minX");
      maxX = checkedCoordinate(maxX, "obstacle.maxX");
      minZ = checkedCoordinate(minZ, "obstacle.minZ");
      maxZ = checkedCoordinate(maxZ, "obstacle.maxZ");
      if (!(maxX > minX) || !(maxZ > minZ)) throw new RangeError("aabb obstacle bounds must have positive area");
      x = (minX + maxX) / 2;
      z = (minZ + maxZ) / 2;
    }

    const rawY = finiteOrNaN(input.y ?? input.position?.y);
    let minY = finiteOrNaN(input.minY ?? bounds.minY);
    let maxY = finiteOrNaN(input.maxY ?? bounds.maxY);
    if (!Number.isFinite(minY) && Number.isFinite(rawY)) minY = rawY;
    if (!Number.isFinite(maxY) && Number.isFinite(rawY) && Number.isFinite(Number(input.height))) maxY = rawY + Math.max(0.01, Number(input.height));
    if (!Number.isFinite(minY)) minY = -LIMITS.MAX_WORLD_COORDINATE;
    if (!Number.isFinite(maxY)) maxY = LIMITS.MAX_WORLD_COORDINATE;
    minY = checkedCoordinate(minY, "obstacle.minY");
    maxY = checkedCoordinate(maxY, "obstacle.maxY");
    if (!(maxY > minY)) throw new RangeError("obstacle vertical bounds must have positive height");

    const rawType = safeId(input.type || input.category, "static").toLowerCase();
    return {
      id,
      type: OBSTACLE_TYPES.includes(rawType) ? rawType : "static",
      shape: normalizedShape,
      x,
      z,
      radius,
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
      enabled: input.enabled !== false && input.solid !== false,
      queryStamp: 0,
      cells: null
    };
  }

  class StaticSpatialHash {
    constructor(options = {}) {
      this.cellSize = optionNumber(options.cellSize, 16, LIMITS.MIN_CELL_SIZE, LIMITS.MAX_CELL_SIZE);
      this.maxObstacles = Math.trunc(optionNumber(options.maxObstacles, 4096, 1, LIMITS.MAX_STATIC_OBSTACLES));
      this.maxCellsPerObstacle = Math.trunc(optionNumber(options.maxCellsPerObstacle, 64, 1, LIMITS.MAX_CELLS_PER_OBSTACLE));
      this.maxQueryCells = Math.trunc(optionNumber(options.maxQueryCells, 512, 1, LIMITS.MAX_QUERY_CELLS));
      this.maxQueryResults = Math.trunc(optionNumber(options.maxQueryResults, 256, 1, LIMITS.MAX_QUERY_RESULTS));
      this._obstacles = new Map();
      this._buckets = new Map();
      this._queryStamp = 0;
      this._range = { firstX: 0, lastX: 0, firstZ: 0, lastZ: 0, count: 0 };
      this._queries = 0;
      this._truncatedQueries = 0;
      this._disposed = false;
    }

    _assertActive() {
      if (this._disposed) throw new Error("StaticSpatialHash is disposed");
    }

    _cellRange(minX, minZ, maxX, maxZ, output = this._range) {
      const firstX = Math.floor(minX / this.cellSize);
      const lastX = Math.floor(maxX / this.cellSize);
      const firstZ = Math.floor(minZ / this.cellSize);
      const lastZ = Math.floor(maxZ / this.cellSize);
      const width = lastX - firstX + 1;
      const depth = lastZ - firstZ + 1;
      output.firstX = firstX;
      output.lastX = lastX;
      output.firstZ = firstZ;
      output.lastZ = lastZ;
      output.count = width * depth;
      return output;
    }

    _key(cellX, cellZ) {
      return `${cellX},${cellZ}`;
    }

    _detach(obstacle) {
      if (!obstacle || !Array.isArray(obstacle.cells)) return;
      for (const key of obstacle.cells) {
        const bucket = this._buckets.get(key);
        if (!bucket) continue;
        const index = bucket.indexOf(obstacle);
        if (index >= 0) bucket.splice(index, 1);
        if (bucket.length === 0) this._buckets.delete(key);
      }
      obstacle.cells.length = 0;
    }

    upsert(input) {
      this._assertActive();
      const obstacle = normalizeObstacle(input);
      const range = this._cellRange(obstacle.minX, obstacle.minZ, obstacle.maxX, obstacle.maxZ);
      if (range.count > this.maxCellsPerObstacle) {
        throw new RangeError(`obstacle spans ${range.count} cells; limit is ${this.maxCellsPerObstacle}`);
      }
      const previous = this._obstacles.get(obstacle.id);
      if (!previous && this._obstacles.size >= this.maxObstacles) throw new RangeError("static obstacle limit reached");
      if (previous) this._detach(previous);
      obstacle.cells = [];
      for (let cellZ = range.firstZ; cellZ <= range.lastZ; cellZ += 1) {
        for (let cellX = range.firstX; cellX <= range.lastX; cellX += 1) {
          const key = this._key(cellX, cellZ);
          let bucket = this._buckets.get(key);
          if (!bucket) {
            bucket = [];
            this._buckets.set(key, bucket);
          }
          bucket.push(obstacle);
          obstacle.cells.push(key);
        }
      }
      this._obstacles.set(obstacle.id, obstacle);
      return obstacle;
    }

    add(input) {
      return this.upsert(input);
    }

    remove(id) {
      this._assertActive();
      const key = safeId(id);
      const obstacle = this._obstacles.get(key);
      if (!obstacle) return false;
      this._detach(obstacle);
      this._obstacles.delete(key);
      return true;
    }

    clear() {
      this._assertActive();
      const changed = this._obstacles.size > 0 || this._buckets.size > 0;
      this._obstacles.clear();
      this._buckets.clear();
      return changed;
    }

    get(id) {
      this._assertActive();
      return this._obstacles.get(safeId(id)) || null;
    }

    queryAABB(minXValue, minZValue, maxXValue, maxZValue, output = [], metadata = null) {
      this._assertActive();
      if (!Array.isArray(output)) throw new TypeError("query output must be an array");
      output.length = 0;
      const minX = Math.min(checkedCoordinate(minXValue, "query.minX"), checkedCoordinate(maxXValue, "query.maxX"));
      const maxX = Math.max(checkedCoordinate(minXValue, "query.minX"), checkedCoordinate(maxXValue, "query.maxX"));
      const minZ = Math.min(checkedCoordinate(minZValue, "query.minZ"), checkedCoordinate(maxZValue, "query.maxZ"));
      const maxZ = Math.max(checkedCoordinate(minZValue, "query.minZ"), checkedCoordinate(maxZValue, "query.maxZ"));
      const range = this._cellRange(minX, minZ, maxX, maxZ);
      this._queries += 1;
      let truncated = range.count > this.maxQueryCells;
      let visitedCells = 0;
      let candidateCount = 0;
      if (!truncated) {
        this._queryStamp += 1;
        if (this._queryStamp >= Number.MAX_SAFE_INTEGER) {
          this._queryStamp = 1;
          for (const obstacle of this._obstacles.values()) obstacle.queryStamp = 0;
        }
        outer: for (let cellZ = range.firstZ; cellZ <= range.lastZ; cellZ += 1) {
          for (let cellX = range.firstX; cellX <= range.lastX; cellX += 1) {
            visitedCells += 1;
            const bucket = this._buckets.get(this._key(cellX, cellZ));
            if (!bucket) continue;
            for (const obstacle of bucket) {
              if (obstacle.queryStamp === this._queryStamp) continue;
              obstacle.queryStamp = this._queryStamp;
              if (!obstacle.enabled || obstacle.maxX < minX || obstacle.minX > maxX || obstacle.maxZ < minZ || obstacle.minZ > maxZ) continue;
              candidateCount += 1;
              if (output.length >= this.maxQueryResults) {
                truncated = true;
                break outer;
              }
              output.push(obstacle);
            }
          }
        }
      }
      if (truncated) this._truncatedQueries += 1;
      if (metadata && typeof metadata === "object") {
        metadata.truncated = truncated;
        metadata.visitedCells = visitedCells;
        metadata.candidateCount = candidateCount;
        metadata.resultCount = output.length;
      }
      return output;
    }

    getDiagnostics(output = {}) {
      output.format = FORMAT;
      output.obstacles = this._obstacles.size;
      output.buckets = this._buckets.size;
      output.queries = this._queries;
      output.truncatedQueries = this._truncatedQueries;
      output.disposed = this._disposed;
      output.limits = output.limits && typeof output.limits === "object" ? output.limits : {};
      output.limits.maxObstacles = this.maxObstacles;
      output.limits.maxCellsPerObstacle = this.maxCellsPerObstacle;
      output.limits.maxQueryCells = this.maxQueryCells;
      output.limits.maxQueryResults = this.maxQueryResults;
      return output;
    }

    get size() {
      return this._obstacles.size;
    }

    get bucketCount() {
      return this._buckets.size;
    }

    dispose() {
      if (this._disposed) return false;
      this._obstacles.clear();
      this._buckets.clear();
      this._disposed = true;
      return true;
    }
  }

  function resetGroundOutput(output) {
    const out = output && typeof output === "object" ? output : {};
    out.available = false;
    out.x = 0;
    out.z = 0;
    out.height = 0;
    out.centerHeight = 0;
    out.averageHeight = 0;
    out.minHeight = 0;
    out.maxHeight = 0;
    out.spread = 0;
    out.slopeRadians = 0;
    out.slopeDegrees = 0;
    out.gradientSlopeDegrees = 0;
    out.sampleCount = 0;
    out.normal = out.normal && typeof out.normal === "object" ? out.normal : {};
    out.normal.x = 0;
    out.normal.y = 1;
    out.normal.z = 0;
    return out;
  }

  function resetWaterOutput(output) {
    const out = output && typeof output === "object" ? output : {};
    out.available = false;
    out.isWater = false;
    out.type = "dry";
    out.surfaceHeight = 0;
    out.depth = 0;
    out.depthKnown = false;
    out.walkable = false;
    out.allowed = null;
    return out;
  }

  function clipPlanarVelocity(velocityX, velocityZ, normalX, normalZ, output = {}) {
    const vx = finite(velocityX, 0);
    const vz = finite(velocityZ, 0);
    const nxRaw = finite(normalX, 0);
    const nzRaw = finite(normalZ, 0);
    const length = Math.hypot(nxRaw, nzRaw);
    if (length <= EPSILON) {
      output.x = vx;
      output.z = vz;
      output.clipped = false;
      return output;
    }
    const nx = nxRaw / length;
    const nz = nzRaw / length;
    const inward = vx * nx + vz * nz;
    if (inward >= 0) {
      output.x = vx;
      output.z = vz;
      output.clipped = false;
      return output;
    }
    output.x = vx - nx * inward;
    output.z = vz - nz * inward;
    output.clipped = true;
    return output;
  }

  class CollisionSystem {
    constructor(options = {}) {
      const suppliedHash = options.spatialHash instanceof StaticSpatialHash ? options.spatialHash : null;
      this.spatialHash = suppliedHash || new StaticSpatialHash(options);
      this._ownsSpatialHash = !suppliedHash;
      this._terrainSampler = options.terrainSampler || options.terrain || null;
      this._waterSampler = options.waterSampler || options.water || null;
      this._query = [];
      this._queryMeta = {};
      this._hit = { hit: false, t: 1, nx: 0, nz: 0, obstacle: null };
      this._probeHit = { hit: false, t: 1, nx: 0, nz: 0, obstacle: null };
      this._penetration = { hit: false, depth: 0, nx: 0, nz: 0, obstacle: null };
      this._groundA = resetGroundOutput({});
      this._groundB = resetGroundOutput({});
      this._groundC = resetGroundOutput({});
      this._waterA = resetWaterOutput({});
      this._waterB = resetWaterOutput({});
      this._waterC = resetWaterOutput({});
      this._heightSamples = new Float64Array(LIMITS.GROUND_SAMPLE_COUNT);
      this._groundOptions = { radius: 0.45, fallbackHeight: 0 };
      this._config = {};
      this._motion = { x: 0, z: 0 };
      this._velocity = { x: 0, z: 0, clipped: false };
      this._disposed = false;
      this._resolveCount = 0;
      this._terrainSampleCount = 0;
      this._waterSampleCount = 0;
      this._failedTerrainSamples = 0;
      this._failedWaterSamples = 0;
    }

    _assertActive() {
      if (this._disposed) throw new Error("CollisionSystem is disposed");
    }

    setTerrainSampler(sampler) {
      this._assertActive();
      if (sampler != null && typeof sampler !== "function" && typeof sampler !== "object") throw new TypeError("terrain sampler must be a function, object or null");
      this._terrainSampler = sampler || null;
      return this;
    }

    setWaterSampler(sampler) {
      this._assertActive();
      if (sampler != null && typeof sampler !== "function" && typeof sampler !== "object") throw new TypeError("water sampler must be a function, object or null");
      this._waterSampler = sampler || null;
      return this;
    }

    upsertObstacle(input) {
      return this.spatialHash.upsert(input);
    }

    addObstacle(input) {
      return this.upsertObstacle(input);
    }

    removeObstacle(id) {
      return this.spatialHash.remove(id);
    }

    clearObstacles() {
      return this.spatialHash.clear();
    }

    queryObstacles(minX, minZ, maxX, maxZ, output = [], metadata = null) {
      return this.spatialHash.queryAABB(minX, minZ, maxX, maxZ, output, metadata);
    }

    _readTerrainHeight(x, z) {
      const sampler = this._terrainSampler;
      if (!sampler) return NaN;
      this._terrainSampleCount += 1;
      try {
        let value;
        if (typeof sampler === "function") value = sampler(x, z);
        else if (typeof sampler.sampleHeight === "function") value = sampler.sampleHeight(x, z);
        else if (typeof sampler.sample === "function") value = sampler.sample(x, z);
        else {
          this._failedTerrainSamples += 1;
          return NaN;
        }
        if (value && typeof value === "object") value = value.height ?? value.y ?? value.elevation;
        const height = Number(value);
        if (Number.isFinite(height)) return height;
      } catch (_) {
        // A failed external sampler must disable grounding for this probe, not
        // silently turn the terrain into height zero.
      }
      this._failedTerrainSamples += 1;
      return NaN;
    }

    sampleGround(xValue, zValue, options = {}, output = {}) {
      this._assertActive();
      const out = resetGroundOutput(output);
      const x = finite(xValue, 0);
      const z = finite(zValue, 0);
      const radius = optionNumber(options.radius ?? options.footprintRadius, 0.45, 0.05, LIMITS.MAX_AGENT_RADIUS);
      const diagonal = radius * Math.SQRT1_2;
      const fallback = finite(options.fallbackHeight, 0);
      const center = this._readTerrainHeight(x, z);
      const east = this._readTerrainHeight(x + radius, z);
      const west = this._readTerrainHeight(x - radius, z);
      const north = this._readTerrainHeight(x, z + radius);
      const south = this._readTerrainHeight(x, z - radius);
      const northEast = this._readTerrainHeight(x + diagonal, z + diagonal);
      const northWest = this._readTerrainHeight(x - diagonal, z + diagonal);
      const southEast = this._readTerrainHeight(x + diagonal, z - diagonal);
      const southWest = this._readTerrainHeight(x - diagonal, z - diagonal);
      const values = this._heightSamples;
      values[0] = center; values[1] = east; values[2] = west;
      values[3] = north; values[4] = south;
      values[5] = northEast; values[6] = northWest;
      values[7] = southEast; values[8] = southWest;
      let validCount = 0;
      let sum = 0;
      let minimum = Infinity;
      let maximum = -Infinity;
      for (let index = 0; index < values.length; index += 1) {
        const height = values[index];
        if (!Number.isFinite(height)) continue;
        validCount += 1;
        sum += height;
        if (height < minimum) minimum = height;
        if (height > maximum) maximum = height;
      }
      const available = validCount === LIMITS.GROUND_SAMPLE_COUNT;
      const safeCenter = Number.isFinite(center) ? center : (validCount ? sum / validCount : fallback);
      const safeMinimum = validCount ? minimum : safeCenter;
      const safeMaximum = validCount ? maximum : safeCenter;
      const dx = available ? (east - west) / (radius * 2) : 0;
      const dz = available ? (north - south) / (radius * 2) : 0;
      const normalLength = Math.hypot(dx, 1, dz) || 1;
      const normalX = -dx / normalLength;
      const normalY = 1 / normalLength;
      const normalZ = -dz / normalLength;
      const gradientSlope = Math.atan(Math.hypot(dx, dz));
      const roughnessSlope = Math.atan2(Math.max(0, safeMaximum - safeMinimum), radius * 2);
      const slopeRadians = Math.max(gradientSlope, roughnessSlope);
      out.available = available;
      out.x = x;
      out.z = z;
      out.height = safeMaximum;
      out.centerHeight = safeCenter;
      out.averageHeight = validCount ? sum / validCount : safeCenter;
      out.minHeight = safeMinimum;
      out.maxHeight = safeMaximum;
      out.spread = safeMaximum - safeMinimum;
      out.slopeRadians = slopeRadians;
      out.slopeDegrees = slopeRadians * 180 / Math.PI;
      out.gradientSlopeDegrees = gradientSlope * 180 / Math.PI;
      out.sampleCount = validCount;
      out.normal.x = normalX;
      out.normal.y = normalY;
      out.normal.z = normalZ;
      return out;
    }

    sampleWater(xValue, zValue, groundHeightValue = NaN, output = {}) {
      this._assertActive();
      const out = resetWaterOutput(output);
      const sampler = this._waterSampler;
      if (!sampler) return out;
      const x = finite(xValue, 0);
      const z = finite(zValue, 0);
      const groundHeight = finiteOrNaN(groundHeightValue);
      this._waterSampleCount += 1;
      let value;
      try {
        if (typeof sampler === "function") value = sampler(x, z);
        else if (typeof sampler.sampleWater === "function") value = sampler.sampleWater(x, z);
        else if (typeof sampler.queryWaterAt === "function") value = sampler.queryWaterAt(x, z);
        else if (typeof sampler.sample === "function") value = sampler.sample(x, z);
        else {
          this._failedWaterSamples += 1;
          return out;
        }
      } catch (_) {
        this._failedWaterSamples += 1;
        return out;
      }

      out.available = true;
      if (value == null || value === false) return out;
      if (value === true) {
        out.isWater = true;
        out.type = "water";
        return out;
      }
      if (Number.isFinite(Number(value))) {
        out.surfaceHeight = Number(value);
        out.isWater = !Number.isFinite(groundHeight) || groundHeight <= out.surfaceHeight + EPSILON;
        out.type = out.isWater ? "water" : "dry";
        if (Number.isFinite(groundHeight)) {
          out.depth = Math.max(0, out.surfaceHeight - groundHeight);
          out.depthKnown = true;
        }
        return out;
      }
      if (!value || typeof value !== "object") {
        this._failedWaterSamples += 1;
        out.available = false;
        return out;
      }
      const type = safeId(value.type || value.surface || value.kind, "water").toLowerCase();
      const explicitInside = value.isWater ?? value.inside ?? value.water;
      const explicitDepth = finiteOrNaN(value.depth);
      const surfaceHeight = finiteOrNaN(value.surfaceHeight ?? value.waterLevel ?? value.level ?? value.y);
      out.isWater = typeof explicitInside === "boolean"
        ? explicitInside
        : (Number.isFinite(explicitDepth) ? explicitDepth > 0 : /water|river|lake|ocean|sea|swamp/.test(type));
      out.type = out.isWater ? type : "dry";
      out.surfaceHeight = Number.isFinite(surfaceHeight) ? surfaceHeight : 0;
      if (Number.isFinite(explicitDepth)) {
        out.depth = Math.max(0, explicitDepth);
        out.depthKnown = true;
      } else if (Number.isFinite(surfaceHeight) && Number.isFinite(groundHeight)) {
        out.depth = Math.max(0, surfaceHeight - groundHeight);
        out.depthKnown = true;
      }
      out.walkable = value.walkable === true;
      return out;
    }

    _verticalOverlap(obstacle, baseY, targetY, height) {
      const agentMinY = Math.min(baseY, targetY);
      const agentMaxY = Math.max(baseY, targetY) + height;
      return obstacle.maxY > agentMinY + EPSILON && obstacle.minY < agentMaxY - EPSILON;
    }

    _penetrationFor(obstacle, x, z, radius, skin, output) {
      output.hit = false;
      output.depth = 0;
      output.nx = 0;
      output.nz = 0;
      output.obstacle = obstacle;
      if (obstacle.shape === "circle") {
        const dx = x - obstacle.x;
        const dz = z - obstacle.z;
        const minimumDistance = radius + obstacle.radius + skin;
        const distance = Math.hypot(dx, dz);
        if (distance >= minimumDistance - EPSILON) return output;
        output.hit = true;
        output.depth = minimumDistance - distance;
        if (distance > EPSILON) {
          output.nx = dx / distance;
          output.nz = dz / distance;
        } else {
          let hash = 2166136261;
          for (let index = 0; index < obstacle.id.length; index += 1) hash = Math.imul(hash ^ obstacle.id.charCodeAt(index), 16777619);
          const angle = (hash >>> 0) / 4294967296 * Math.PI * 2;
          output.nx = Math.cos(angle);
          output.nz = Math.sin(angle);
        }
        return output;
      }
      const minX = obstacle.minX - radius - skin;
      const maxX = obstacle.maxX + radius + skin;
      const minZ = obstacle.minZ - radius - skin;
      const maxZ = obstacle.maxZ + radius + skin;
      if (!(x > minX && x < maxX && z > minZ && z < maxZ)) return output;
      const left = x - minX;
      const right = maxX - x;
      const back = z - minZ;
      const front = maxZ - z;
      output.hit = true;
      output.depth = left;
      output.nx = -1;
      if (right < output.depth) { output.depth = right; output.nx = 1; output.nz = 0; }
      if (back < output.depth) { output.depth = back; output.nx = 0; output.nz = -1; }
      if (front < output.depth) { output.depth = front; output.nx = 0; output.nz = 1; }
      return output;
    }

    _sweepFor(obstacle, startX, startZ, deltaX, deltaZ, radius, skin, output) {
      output.hit = false;
      output.t = 1;
      output.nx = 0;
      output.nz = 0;
      output.obstacle = obstacle;
      if (obstacle.shape === "circle") {
        const expanded = radius + obstacle.radius + skin;
        const fx = startX - obstacle.x;
        const fz = startZ - obstacle.z;
        const a = deltaX * deltaX + deltaZ * deltaZ;
        const c = fx * fx + fz * fz - expanded * expanded;
        if (c <= EPSILON) {
          const distance = Math.hypot(fx, fz);
          const nx = distance > EPSILON ? fx / distance : 1;
          const nz = distance > EPSILON ? fz / distance : 0;
          if (deltaX * nx + deltaZ * nz >= -EPSILON) return output;
          output.hit = true;
          output.t = 0;
          output.nx = nx;
          output.nz = nz;
          return output;
        }
        if (a <= EPSILON) return output;
        const b = 2 * (fx * deltaX + fz * deltaZ);
        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0) return output;
        const time = (-b - Math.sqrt(discriminant)) / (2 * a);
        if (time < -EPSILON || time > 1 + EPSILON) return output;
        const t = clamp(time, 0, 1);
        const hitX = startX + deltaX * t;
        const hitZ = startZ + deltaZ * t;
        const normalLength = Math.hypot(hitX - obstacle.x, hitZ - obstacle.z) || 1;
        output.hit = true;
        output.t = t;
        output.nx = (hitX - obstacle.x) / normalLength;
        output.nz = (hitZ - obstacle.z) / normalLength;
        return output;
      }

      const minX = obstacle.minX - radius - skin;
      const maxX = obstacle.maxX + radius + skin;
      const minZ = obstacle.minZ - radius - skin;
      const maxZ = obstacle.maxZ + radius + skin;
      const inside = startX > minX && startX < maxX && startZ > minZ && startZ < maxZ;
      if (inside) {
        this._penetrationFor(obstacle, startX, startZ, radius, skin, this._penetration);
        if (deltaX * this._penetration.nx + deltaZ * this._penetration.nz >= -EPSILON) return output;
        output.hit = true;
        output.t = 0;
        output.nx = this._penetration.nx;
        output.nz = this._penetration.nz;
        return output;
      }
      let enter = 0;
      let exit = 1;
      let normalX = 0;
      let normalZ = 0;
      if (Math.abs(deltaX) <= EPSILON) {
        if (startX < minX || startX > maxX) return output;
      } else {
        let first = (minX - startX) / deltaX;
        let second = (maxX - startX) / deltaX;
        let enteringNormal = -1;
        if (first > second) {
          const swap = first; first = second; second = swap;
          enteringNormal = 1;
        }
        if (first > enter) { enter = first; normalX = enteringNormal; normalZ = 0; }
        exit = Math.min(exit, second);
        if (enter > exit) return output;
      }
      if (Math.abs(deltaZ) <= EPSILON) {
        if (startZ < minZ || startZ > maxZ) return output;
      } else {
        let first = (minZ - startZ) / deltaZ;
        let second = (maxZ - startZ) / deltaZ;
        let enteringNormal = -1;
        if (first > second) {
          const swap = first; first = second; second = swap;
          enteringNormal = 1;
        }
        if (first > enter) { enter = first; normalX = 0; normalZ = enteringNormal; }
        exit = Math.min(exit, second);
        if (enter > exit) return output;
      }
      if (enter < -EPSILON || enter > 1 + EPSILON) return output;
      output.hit = true;
      output.t = clamp(enter, 0, 1);
      output.nx = normalX;
      output.nz = normalZ;
      return output;
    }

    _depenetrate(x, z, baseY, targetY, config, result) {
      let resolvedX = x;
      let resolvedZ = z;
      let remainingCorrection = config.maxDepenetration;
      for (let iteration = 0; iteration < config.maxDepenetrationIterations && remainingCorrection > EPSILON; iteration += 1) {
        this.spatialHash.queryAABB(
          resolvedX - config.radius - config.skin,
          resolvedZ - config.radius - config.skin,
          resolvedX + config.radius + config.skin,
          resolvedZ + config.radius + config.skin,
          this._query,
          this._queryMeta
        );
        if (this._queryMeta.truncated) {
          result.broadPhaseTruncated = true;
          break;
        }
        let best = null;
        let bestDepth = 0;
        let bestX = 0;
        let bestZ = 0;
        for (const obstacle of this._query) {
          if (!this._verticalOverlap(obstacle, baseY, targetY, config.height)) continue;
          const penetration = this._penetrationFor(obstacle, resolvedX, resolvedZ, config.radius, config.skin, this._penetration);
          if (!penetration.hit) continue;
          const winsTie = Math.abs(penetration.depth - bestDepth) <= EPSILON && best && obstacle.id < best.id;
          if (penetration.depth > bestDepth + EPSILON || winsTie) {
            best = obstacle;
            bestDepth = penetration.depth;
            bestX = penetration.nx;
            bestZ = penetration.nz;
          }
        }
        if (!best) break;
        const correction = Math.min(bestDepth + EPSILON * 4, remainingCorrection);
        resolvedX += bestX * correction;
        resolvedZ += bestZ * correction;
        remainingCorrection -= correction;
        result.depenetrationDistance += correction;
        result.depenetrated = true;
        if (!result.obstacleId) result.obstacleId = best.id;
        result.contactNormalX = bestX;
        result.contactNormalZ = bestZ;
      }
      this._motion.x = resolvedX;
      this._motion.z = resolvedZ;
      return this._motion;
    }

    _resolveStatic(currentX, currentY, currentZ, targetX, targetY, targetZ, config, result) {
      if (!config.collidesStatic || this.spatialHash.size === 0) {
        this._motion.x = targetX;
        this._motion.z = targetZ;
        return this._motion;
      }
      const requestedDeltaX = targetX - currentX;
      const requestedDeltaZ = targetZ - currentZ;
      const depenetrated = this._depenetrate(currentX, currentZ, currentY, targetY, config, result);
      if (result.broadPhaseTruncated) {
        this._motion.x = currentX;
        this._motion.z = currentZ;
        return this._motion;
      }
      let positionX = depenetrated.x;
      let positionZ = depenetrated.z;
      let remainingX = requestedDeltaX;
      let remainingZ = requestedDeltaZ;
      let completed = false;
      for (let iteration = 0; iteration < config.maxResolveIterations; iteration += 1) {
        result.collisionIterations = iteration + 1;
        if (Math.hypot(remainingX, remainingZ) <= EPSILON) { completed = true; break; }
        const endX = positionX + remainingX;
        const endZ = positionZ + remainingZ;
        this.spatialHash.queryAABB(
          Math.min(positionX, endX) - config.radius - config.skin,
          Math.min(positionZ, endZ) - config.radius - config.skin,
          Math.max(positionX, endX) + config.radius + config.skin,
          Math.max(positionZ, endZ) + config.radius + config.skin,
          this._query,
          this._queryMeta
        );
        if (this._queryMeta.truncated) {
          result.broadPhaseTruncated = true;
          remainingX = 0;
          remainingZ = 0;
          completed = true;
          break;
        }
        this._hit.hit = false;
        this._hit.t = 1;
        this._hit.obstacle = null;
        for (const obstacle of this._query) {
          if (!this._verticalOverlap(obstacle, currentY, targetY, config.height)) continue;
          const hit = this._sweepFor(obstacle, positionX, positionZ, remainingX, remainingZ, config.radius, config.skin, this._probeHit);
          if (!hit.hit) continue;
          const earlier = hit.t < this._hit.t - EPSILON;
          const tied = Math.abs(hit.t - this._hit.t) <= EPSILON && (!this._hit.obstacle || obstacle.id < this._hit.obstacle.id);
          if (earlier || tied) {
            this._hit.hit = true;
            this._hit.t = hit.t;
            this._hit.nx = hit.nx;
            this._hit.nz = hit.nz;
            this._hit.obstacle = obstacle;
          }
        }
        if (!this._hit.hit) {
          positionX = endX;
          positionZ = endZ;
          remainingX = 0;
          remainingZ = 0;
          completed = true;
          break;
        }
        const safeTime = Math.max(0, this._hit.t - 0.000001);
        positionX += remainingX * safeTime;
        positionZ += remainingZ * safeTime;
        const remainderScale = Math.max(0, 1 - this._hit.t);
        remainingX *= remainderScale;
        remainingZ *= remainderScale;
        const inward = remainingX * this._hit.nx + remainingZ * this._hit.nz;
        if (inward < 0) {
          remainingX -= this._hit.nx * inward;
          remainingZ -= this._hit.nz * inward;
        }
        result.blockedByObstacle = true;
        result.collisionCount += 1;
        if (!result.obstacleId) result.obstacleId = this._hit.obstacle.id;
        result.contactNormalX = this._hit.nx;
        result.contactNormalZ = this._hit.nz;
      }
      if (!completed && Math.hypot(remainingX, remainingZ) > EPSILON) result.iterationLimitReached = true;
      this._motion.x = positionX;
      this._motion.z = positionZ;
      return this._motion;
    }

    _groundAccepted(sample, currentGround, currentY, config) {
      if (!sample.available || !currentGround.available) return true;
      const slopeImprovesUnsafeStart = currentGround.slopeDegrees > config.maxSlopeDegrees + EPSILON
        && sample.slopeDegrees < currentGround.slopeDegrees - 0.25;
      const slopeAllowed = sample.slopeDegrees <= config.maxSlopeDegrees + EPSILON || slopeImprovesUnsafeStart;
      const elevation = sample.height - currentGround.height;
      const riseFromCurrent = sample.height - currentY;
      return slopeAllowed
        && elevation <= config.maxStepUp + EPSILON
        && elevation >= -config.maxStepDown - EPSILON
        && riseFromCurrent <= config.maxSnapUp + EPSILON;
    }

    _constrainGround(currentX, currentZ, currentY, targetX, targetZ, config, result) {
      this._groundOptions.radius = config.radius;
      this._groundOptions.fallbackHeight = currentY;
      const currentGround = this.sampleGround(currentX, currentZ, this._groundOptions, this._groundA);
      const targetGround = this.sampleGround(targetX, targetZ, this._groundOptions, this._groundB);
      result.terrainAvailable = currentGround.available && targetGround.available;
      if (!result.terrainAvailable || this._groundAccepted(targetGround, currentGround, currentY, config)) {
        this._motion.x = targetX;
        this._motion.z = targetZ;
        return this._motion;
      }

      const targetElevation = targetGround.height - currentGround.height;
      result.blockedBySlope = targetGround.slopeDegrees > config.maxSlopeDegrees + EPSILON
        && !(currentGround.slopeDegrees > config.maxSlopeDegrees + EPSILON && targetGround.slopeDegrees < currentGround.slopeDegrees - 0.25);
      result.blockedByStepUp = targetElevation > config.maxStepUp + EPSILON || targetGround.height - currentY > config.maxSnapUp + EPSILON;
      result.blockedByStepDown = targetElevation < -config.maxStepDown - EPSILON;
      let lower = 0;
      let upper = 1;
      const deltaX = targetX - currentX;
      const deltaZ = targetZ - currentZ;
      for (let iteration = 0; iteration < config.groundBinarySteps; iteration += 1) {
        const middle = (lower + upper) / 2;
        const probeX = currentX + deltaX * middle;
        const probeZ = currentZ + deltaZ * middle;
        const probe = this.sampleGround(probeX, probeZ, this._groundOptions, this._groundC);
        if (this._groundAccepted(probe, currentGround, currentY, config)) lower = middle;
        else upper = middle;
      }
      const resolvedX = currentX + deltaX * lower;
      const resolvedZ = currentZ + deltaZ * lower;
      this.sampleGround(resolvedX, resolvedZ, this._groundOptions, this._groundB);
      this._motion.x = resolvedX;
      this._motion.z = resolvedZ;
      return this._motion;
    }

    _waterAllowed(sample, config) {
      if (!sample.available || config.waterRule === "allow" || config.waterRule === "ignore") return true;
      if (config.waterRule === "block") return !sample.isWater;
      if (config.waterRule === "require") return sample.isWater && (!sample.depthKnown || sample.depth + EPSILON >= config.minWaterDepth);
      if (!sample.isWater || sample.walkable) return true;
      if (!sample.depthKnown) return config.unknownWaterIsBlocked === false;
      return sample.depth <= config.maxWaterDepth + EPSILON;
    }

    _groundHeightForWater(x, z) {
      return this._readTerrainHeight(x, z);
    }

    _constrainWater(currentX, currentZ, targetX, targetZ, config, result) {
      if (!this._waterSampler || config.waterRule === "allow" || config.waterRule === "ignore") {
        result.waterBoundaryApplied = false;
        this._motion.x = targetX;
        this._motion.z = targetZ;
        return this._motion;
      }
      const currentWater = this.sampleWater(currentX, currentZ, this._groundHeightForWater(currentX, currentZ), this._waterA);
      const targetWater = this.sampleWater(targetX, targetZ, this._groundHeightForWater(targetX, targetZ), this._waterB);
      result.waterBoundaryApplied = currentWater.available || targetWater.available;
      const targetAllowed = this._waterAllowed(targetWater, config);
      targetWater.allowed = targetAllowed;
      if (!targetWater.available || targetAllowed) {
        this._motion.x = targetX;
        this._motion.z = targetZ;
        return this._motion;
      }
      result.blockedByWater = true;
      const currentAllowed = this._waterAllowed(currentWater, config);
      currentWater.allowed = currentAllowed;
      if (!currentWater.available || !currentAllowed) {
        this._motion.x = currentX;
        this._motion.z = currentZ;
        return this._motion;
      }
      let lower = 0;
      let upper = 1;
      const deltaX = targetX - currentX;
      const deltaZ = targetZ - currentZ;
      for (let iteration = 0; iteration < config.waterBinarySteps; iteration += 1) {
        const middle = (lower + upper) / 2;
        const probeX = currentX + deltaX * middle;
        const probeZ = currentZ + deltaZ * middle;
        const probeWater = this.sampleWater(probeX, probeZ, this._groundHeightForWater(probeX, probeZ), this._waterC);
        if (probeWater.available && this._waterAllowed(probeWater, config)) lower = middle;
        else upper = middle;
      }
      const resolvedX = currentX + deltaX * lower;
      const resolvedZ = currentZ + deltaZ * lower;
      this.sampleWater(resolvedX, resolvedZ, this._groundHeightForWater(resolvedX, resolvedZ), this._waterB);
      this._waterB.allowed = this._waterAllowed(this._waterB, config);
      this._motion.x = resolvedX;
      this._motion.z = resolvedZ;
      return this._motion;
    }

    _resolutionConfig(options, profile) {
      const grounding = typeof options.grounding === "boolean" ? options.grounding : profile.grounding;
      const config = this._config;
      config.radius = optionNumber(options.radius ?? options.collisionRadius, 0.45, 0.05, LIMITS.MAX_AGENT_RADIUS);
      config.height = optionNumber(options.height ?? options.collisionHeight, 1.8, 0.1, LIMITS.MAX_AGENT_HEIGHT);
      config.skin = optionNumber(options.skin, 0.025, 0, 0.5);
      config.maxMoveDistance = optionNumber(options.maxMoveDistance, 16, 0.01, LIMITS.MAX_MOVE_DISTANCE);
      config.maxDepenetration = optionNumber(options.maxDepenetration, 0.5, 0, LIMITS.MAX_DEPENETRATION_DISTANCE);
      config.maxResolveIterations = Math.trunc(optionNumber(options.maxResolveIterations, 4, 1, LIMITS.MAX_RESOLVE_ITERATIONS));
      config.maxDepenetrationIterations = Math.trunc(optionNumber(options.maxDepenetrationIterations, 2, 1, LIMITS.MAX_DEPENETRATION_ITERATIONS));
      config.groundBinarySteps = Math.trunc(optionNumber(options.groundBinarySteps, 12, 1, LIMITS.MAX_GROUND_BINARY_STEPS));
      config.waterBinarySteps = Math.trunc(optionNumber(options.waterBinarySteps, 12, 1, LIMITS.MAX_WATER_BINARY_STEPS));
      config.grounding = grounding && options.airborne !== true;
      config.collidesStatic = typeof options.collidesStatic === "boolean" ? options.collidesStatic : profile.collidesStatic;
      const requestedWaterRule = safeId(options.waterRule, profile.waterRule).toLowerCase();
      config.waterRule = WATER_RULES.includes(requestedWaterRule) ? requestedWaterRule : profile.waterRule;
      config.maxWaterDepth = options.maxWaterDepth === Infinity ? Infinity : optionNumber(options.maxWaterDepth, profile.maxWaterDepth, 0, 10000);
      config.minWaterDepth = optionNumber(options.minWaterDepth, profile.minWaterDepth, 0, 10000);
      config.unknownWaterIsBlocked = options.unknownWaterIsBlocked !== false;
      config.maxSlopeDegrees = optionNumber(options.maxSlopeDegrees, profile.maxSlopeDegrees, 0, 89.9);
      config.maxStepUp = optionNumber(options.maxStepUp, profile.maxStepUp, 0, LIMITS.MAX_STEP_HEIGHT);
      config.maxStepDown = optionNumber(options.maxStepDown, profile.maxStepDown, 0, LIMITS.MAX_STEP_HEIGHT);
      config.maxSnapUp = optionNumber(options.maxSnapUp, profile.maxSnapUp, 0, LIMITS.MAX_STEP_HEIGHT);
      config.maxSnapDown = optionNumber(options.maxSnapDown, profile.maxSnapDown, 0, LIMITS.MAX_STEP_HEIGHT);
      return config;
    }

    _resetResolution(output) {
      const out = output && typeof output === "object" ? output : {};
      out.x = 0; out.y = 0; out.z = 0;
      out.position = out.position && typeof out.position === "object" ? out.position : {};
      out.position.x = 0; out.position.y = 0; out.position.z = 0;
      out.displacementX = 0; out.displacementY = 0; out.displacementZ = 0;
      out.requestedDistance = 0; out.resolvedDistance = 0; out.movementFraction = 0;
      out.movementClamped = false;
      out.blocked = false;
      out.blockedByObstacle = false;
      out.blockedBySlope = false;
      out.blockedByStepUp = false;
      out.blockedByStepDown = false;
      out.blockedByWater = false;
      out.broadPhaseTruncated = false;
      out.iterationLimitReached = false;
      out.collisionCount = 0;
      out.collisionIterations = 0;
      out.obstacleId = null;
      out.contactNormalX = 0;
      out.contactNormalZ = 0;
      out.depenetrated = false;
      out.depenetrationDistance = 0;
      out.grounded = false;
      out.terrainAvailable = false;
      out.waterBoundaryApplied = false;
      out.resolvedVelocityX = 0;
      out.resolvedVelocityZ = 0;
      out.velocityClipped = false;
      out.ground = resetGroundOutput(out.ground);
      out.water = resetWaterOutput(out.water);
      return out;
    }

    _copyGround(source, target) {
      target.available = source.available;
      target.x = source.x; target.z = source.z;
      target.height = source.height; target.centerHeight = source.centerHeight; target.averageHeight = source.averageHeight;
      target.minHeight = source.minHeight; target.maxHeight = source.maxHeight; target.spread = source.spread;
      target.slopeRadians = source.slopeRadians; target.slopeDegrees = source.slopeDegrees; target.gradientSlopeDegrees = source.gradientSlopeDegrees;
      target.sampleCount = source.sampleCount;
      target.normal.x = source.normal.x; target.normal.y = source.normal.y; target.normal.z = source.normal.z;
      return target;
    }

    _copyWater(source, target) {
      target.available = source.available; target.isWater = source.isWater; target.type = source.type;
      target.surfaceHeight = source.surfaceHeight; target.depth = source.depth; target.depthKnown = source.depthKnown;
      target.walkable = source.walkable; target.allowed = source.allowed;
      return target;
    }

    resolveMovement(current = {}, desired = {}, options = {}, output = {}) {
      this._assertActive();
      const result = this._resetResolution(output);
      const profileInput = options.locomotionProfile || options.locomotion || options.mode || "terrestrial";
      const profile = resolveLocomotionProfile(profileInput);
      const config = this._resolutionConfig(options, profile);
      const currentX = finite(current.x, 0);
      const currentZ = finite(current.z, 0);
      let currentY = finiteOrNaN(current.y);
      if (!Number.isFinite(currentY) && config.grounding) {
        this._groundOptions.radius = config.radius;
        this._groundOptions.fallbackHeight = 0;
        const ground = this.sampleGround(currentX, currentZ, this._groundOptions, this._groundA);
        currentY = ground.available ? ground.height : 0;
      }
      if (!Number.isFinite(currentY)) currentY = 0;
      let targetX = finite(desired.x, currentX);
      let targetY = finite(desired.y, currentY);
      let targetZ = finite(desired.z, currentZ);
      const rawDeltaX = targetX - currentX;
      const rawDeltaY = targetY - currentY;
      const rawDeltaZ = targetZ - currentZ;
      const requestedDistance = Math.hypot(rawDeltaX, rawDeltaY, rawDeltaZ);
      if (requestedDistance > config.maxMoveDistance) {
        const scale = config.maxMoveDistance / requestedDistance;
        targetX = currentX + rawDeltaX * scale;
        targetY = currentY + rawDeltaY * scale;
        targetZ = currentZ + rawDeltaZ * scale;
        result.movementClamped = true;
      }

      const staticMotion = this._resolveStatic(currentX, currentY, currentZ, targetX, targetY, targetZ, config, result);
      targetX = staticMotion.x;
      targetZ = staticMotion.z;
      if (config.grounding) {
        const groundMotion = this._constrainGround(currentX, currentZ, currentY, targetX, targetZ, config, result);
        targetX = groundMotion.x;
        targetZ = groundMotion.z;
      }
      const waterMotion = this._constrainWater(currentX, currentZ, targetX, targetZ, config, result);
      targetX = waterMotion.x;
      targetZ = waterMotion.z;

      if (config.grounding) {
        this._groundOptions.radius = config.radius;
        this._groundOptions.fallbackHeight = currentY;
        const finalGround = this.sampleGround(targetX, targetZ, this._groundOptions, this._groundB);
        this._copyGround(finalGround, result.ground);
        result.terrainAvailable = result.terrainAvailable && finalGround.available;
        if (result.terrainAvailable && finalGround.available) {
          const groundDelta = finalGround.height - currentY;
          if (groundDelta >= -config.maxSnapDown - EPSILON) {
            targetY = finalGround.height;
            result.grounded = true;
          } else {
            targetY = currentY - config.maxSnapDown;
            result.grounded = false;
          }
        } else {
          targetY = finite(desired.y, currentY);
        }
      } else {
        result.terrainAvailable = false;
        targetY = finite(targetY, currentY);
      }
      const finalWaterGroundHeight = this._waterSampler ? this._groundHeightForWater(targetX, targetZ) : NaN;
      this.sampleWater(targetX, targetZ, finalWaterGroundHeight, this._waterB);
      this._waterB.allowed = this._waterB.available ? this._waterAllowed(this._waterB, config) : null;
      this._copyWater(this._waterB, result.water);

      const displacementX = targetX - currentX;
      const displacementY = targetY - currentY;
      const displacementZ = targetZ - currentZ;
      const resolvedDistance = Math.hypot(displacementX, displacementY, displacementZ);
      const requestedPlanarSquared = rawDeltaX * rawDeltaX + rawDeltaZ * rawDeltaZ;
      const projectedProgress = requestedPlanarSquared > EPSILON
        ? (displacementX * rawDeltaX + displacementZ * rawDeltaZ) / requestedPlanarSquared
        : (requestedDistance <= EPSILON ? 1 : 0);
      result.x = targetX; result.y = targetY; result.z = targetZ;
      result.position.x = targetX; result.position.y = targetY; result.position.z = targetZ;
      result.displacementX = displacementX; result.displacementY = displacementY; result.displacementZ = displacementZ;
      result.requestedDistance = requestedDistance;
      result.resolvedDistance = resolvedDistance;
      result.movementFraction = clamp(projectedProgress, 0, 1);
      result.blocked = result.blockedByObstacle || result.blockedBySlope || result.blockedByStepUp
        || result.blockedByStepDown || result.blockedByWater || result.broadPhaseTruncated || result.iterationLimitReached;
      const sourceVelocityX = finite(options.velocityX ?? options.velocity?.x, rawDeltaX);
      const sourceVelocityZ = finite(options.velocityZ ?? options.velocity?.z, rawDeltaZ);
      if (result.blockedByObstacle) {
        const velocity = clipPlanarVelocity(sourceVelocityX, sourceVelocityZ, result.contactNormalX, result.contactNormalZ, this._velocity);
        result.resolvedVelocityX = velocity.x;
        result.resolvedVelocityZ = velocity.z;
        result.velocityClipped = velocity.clipped;
      } else {
        result.resolvedVelocityX = sourceVelocityX;
        result.resolvedVelocityZ = sourceVelocityZ;
      }
      this._resolveCount += 1;
      return result;
    }

    getCapabilities() {
      return CAPABILITIES;
    }

    getDiagnostics(output = {}) {
      output.format = FORMAT;
      output.version = VERSION;
      output.state = this._disposed ? "disposed" : "active";
      output.resolveCount = this._resolveCount;
      output.terrainSampleCount = this._terrainSampleCount;
      output.failedTerrainSamples = this._failedTerrainSamples;
      output.waterSampleCount = this._waterSampleCount;
      output.failedWaterSamples = this._failedWaterSamples;
      output.terrainSamplerAvailable = Boolean(this._terrainSampler);
      output.waterSamplerAvailable = Boolean(this._waterSampler);
      output.spatialHash = this.spatialHash.getDiagnostics(output.spatialHash && typeof output.spatialHash === "object" ? output.spatialHash : {});
      return output;
    }

    dispose() {
      if (this._disposed) return false;
      this._query.length = 0;
      this._terrainSampler = null;
      this._waterSampler = null;
      if (this._ownsSpatialHash) this.spatialHash.dispose();
      this._disposed = true;
      return true;
    }
  }

  function createCollisionSystem(options) {
    return new CollisionSystem(options);
  }

  return Object.freeze({
    VERSION,
    FORMAT,
    LIMITS,
    CAPABILITIES,
    OBSTACLE_TYPES,
    OBSTACLE_SHAPES,
    LOCOMOTION_PROFILES,
    normalizeObstacle,
    resolveLocomotionProfile,
    clipPlanarVelocity,
    StaticSpatialHash,
    CollisionSystem,
    createCollisionSystem
  });
});
