(function (root, factory) {
  "use strict";

  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHEonWildVegetation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createEonWildVegetation(global) {
  "use strict";

  const VERSION = "1.0.0";
  const DEFAULT_SEED = "HH-EONWILD-VEGETATION-541";
  const UINT32_SCALE = 1 / 4294967296;
  const DEG_TO_RAD = Math.PI / 180;

  const LIMITS = Object.freeze({
    minimumChunkSize: 32,
    maximumChunkSize: 1024,
    maximumCandidatesPerChunk: 4096,
    maximumInstancesPerChunk: 2048,
    maximumInfluences: 512,
    maximumInfluenceRadius: 96,
    maximumInfluenceDurationMs: 600000,
    maximumPoolCapacity: 4096,
    maximumWindSpeed: 60,
    maximumDeltaSeconds: 0.25
  });

  const freezeRecord = (record) => Object.freeze(record);
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number.isFinite(Number(value)) ? Number(value) : minimum));
  const clamp01 = (value) => clamp(value, 0, 1);
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const positiveModulo = (value, modulus) => ((value % modulus) + modulus) % modulus;
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const smoothstep = (edge0, edge1, value) => {
    if (edge0 === edge1) return value < edge0 ? 0 : 1;
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  };

  function hashSeed(value) {
    const text = String(value == null ? DEFAULT_SEED : value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 2246822507);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 3266489909);
    return (hash ^ (hash >>> 16)) >>> 0;
  }

  function mix32(value) {
    let mixed = value >>> 0;
    mixed ^= mixed >>> 16;
    mixed = Math.imul(mixed, 2246822507);
    mixed ^= mixed >>> 13;
    mixed = Math.imul(mixed, 3266489909);
    return (mixed ^ (mixed >>> 16)) >>> 0;
  }

  function random01(seed, a = 0, b = 0, c = 0) {
    let value = typeof seed === "number" && Number.isFinite(seed) ? seed >>> 0 : hashSeed(seed);
    value = mix32(value ^ Math.imul((a | 0) + 1, 374761393));
    value = mix32(value ^ Math.imul((b | 0) + 1, 668265263));
    value = mix32(value ^ Math.imul((c | 0) + 1, 2147483647));
    return value * UINT32_SCALE;
  }

  function createSeededRandom(seed) {
    let state = hashSeed(seed);
    return function nextRandom() {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) * UINT32_SCALE;
    };
  }

  function latticeNoise(seed, x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx);
    const uz = fz * fz * (3 - 2 * fz);
    const a = random01(seed, ix, iz, 11) * 2 - 1;
    const b = random01(seed, ix + 1, iz, 11) * 2 - 1;
    const c = random01(seed, ix, iz + 1, 11) * 2 - 1;
    const d = random01(seed, ix + 1, iz + 1, 11) * 2 - 1;
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
  }

  function fractalNoise(seed, x, z) {
    let amplitude = 0.56;
    let frequency = 1;
    let sum = 0;
    let normalizer = 0;
    for (let octave = 0; octave < 4; octave += 1) {
      sum += latticeNoise(seed + octave * 977, x * frequency, z * frequency) * amplitude;
      normalizer += amplitude;
      amplitude *= 0.5;
      frequency *= 2.03;
    }
    return sum / normalizer;
  }

  const VEGETATION_TYPES = Object.freeze([
    freezeRecord({ id: "grass-fine", category: "grass", label: "Fine grass", biomes: "grassland,savanna,forest,wetland,taiga,tundra,riparian", maxSlope: 42, minRockDistance: 0.2, minMoisture: 0.08, maxMoisture: 1, nearWaterMax: Infinity, clusterBias: 0.45, scaleMin: 0.65, scaleMax: 1.25, lodBias: 0 }),
    freezeRecord({ id: "grass-tuft", category: "grass", label: "Tussock grass", biomes: "grassland,savanna,wetland,tundra,taiga,riparian", maxSlope: 38, minRockDistance: 0.35, minMoisture: 0.12, maxMoisture: 0.94, nearWaterMax: Infinity, clusterBias: 0.7, scaleMin: 0.72, scaleMax: 1.35, lodBias: 0 }),
    freezeRecord({ id: "grass-tall", category: "grass", label: "Tall meadow grass", biomes: "grassland,savanna,forest,wetland,riparian", maxSlope: 32, minRockDistance: 0.45, minMoisture: 0.3, maxMoisture: 1, nearWaterMax: 36, clusterBias: 0.82, scaleMin: 0.78, scaleMax: 1.42, lodBias: 0 }),
    freezeRecord({ id: "grass-dry", category: "grass", label: "Dry bunchgrass", biomes: "desert,savanna,grassland", maxSlope: 36, minRockDistance: 0.35, minMoisture: 0.015, maxMoisture: 0.42, nearWaterMax: Infinity, clusterBias: 0.62, scaleMin: 0.55, scaleMax: 1.2, lodBias: 0 }),
    freezeRecord({ id: "reed", category: "reed", label: "River reed", biomes: "wetland,swamp,riparian,forest", maxSlope: 18, minRockDistance: 0.3, minMoisture: 0.62, maxMoisture: 1, nearWaterMax: 14, clusterBias: 0.95, scaleMin: 0.8, scaleMax: 1.5, lodBias: 0 }),
    freezeRecord({ id: "fern", category: "fern", label: "Understory fern", biomes: "forest,rainforest,wetland,swamp,taiga,riparian", maxSlope: 34, minRockDistance: 0.4, minMoisture: 0.48, maxMoisture: 1, nearWaterMax: Infinity, clusterBias: 0.84, scaleMin: 0.7, scaleMax: 1.35, lodBias: 0 }),
    freezeRecord({ id: "shrub-low", category: "shrub", label: "Low shrub", biomes: "grassland,savanna,forest,taiga,tundra,riparian", maxSlope: 36, minRockDistance: 0.75, minMoisture: 0.12, maxMoisture: 0.94, nearWaterMax: Infinity, clusterBias: 0.68, scaleMin: 0.65, scaleMax: 1.28, lodBias: 0 }),
    freezeRecord({ id: "shrub-flowering", category: "shrub", label: "Flowering shrub", biomes: "grassland,savanna,forest,riparian", maxSlope: 31, minRockDistance: 0.8, minMoisture: 0.28, maxMoisture: 0.9, nearWaterMax: Infinity, clusterBias: 0.78, scaleMin: 0.72, scaleMax: 1.3, lodBias: 0 }),
    freezeRecord({ id: "shrub-dry", category: "shrub", label: "Dryland shrub", biomes: "desert,savanna,grassland", maxSlope: 34, minRockDistance: 0.7, minMoisture: 0.015, maxMoisture: 0.48, nearWaterMax: Infinity, clusterBias: 0.6, scaleMin: 0.62, scaleMax: 1.25, lodBias: 0 }),
    freezeRecord({ id: "sapling", category: "sapling", label: "Tree sapling", biomes: "forest,rainforest,taiga,wetland,riparian", maxSlope: 31, minRockDistance: 1.1, minMoisture: 0.25, maxMoisture: 0.96, nearWaterMax: Infinity, clusterBias: 0.76, scaleMin: 0.78, scaleMax: 1.22, lodBias: 0 }),
    freezeRecord({ id: "tree-mature-deciduous", category: "mature-tree", label: "Mature deciduous tree", biomes: "forest,rainforest,wetland,riparian", maxSlope: 29, minRockDistance: 2.4, minMoisture: 0.32, maxMoisture: 0.96, nearWaterMax: Infinity, clusterBias: 0.62, scaleMin: 0.82, scaleMax: 1.28, lodBias: -18 }),
    freezeRecord({ id: "tree-mature-conifer", category: "mature-tree", label: "Mature conifer", biomes: "forest,taiga,tundra", maxSlope: 33, minRockDistance: 2.2, minMoisture: 0.2, maxMoisture: 0.86, nearWaterMax: Infinity, clusterBias: 0.58, scaleMin: 0.8, scaleMax: 1.35, lodBias: -22 }),
    freezeRecord({ id: "tree-dead", category: "dead-tree", label: "Standing dead tree", biomes: "forest,rainforest,taiga,wetland,swamp,savanna", maxSlope: 32, minRockDistance: 1.8, minMoisture: 0.08, maxMoisture: 1, nearWaterMax: Infinity, clusterBias: 0.38, scaleMin: 0.75, scaleMax: 1.3, lodBias: -14 }),
    freezeRecord({ id: "root-exposed", category: "root", label: "Exposed root", biomes: "forest,rainforest,wetland,swamp,taiga,riparian", maxSlope: 30, minRockDistance: 0.6, minMoisture: 0.32, maxMoisture: 1, nearWaterMax: 28, clusterBias: 0.8, scaleMin: 0.7, scaleMax: 1.4, lodBias: -6 }),
    freezeRecord({ id: "log-fallen", category: "log", label: "Fallen log", biomes: "forest,rainforest,wetland,swamp,taiga,riparian", maxSlope: 25, minRockDistance: 1.2, minMoisture: 0.24, maxMoisture: 1, nearWaterMax: Infinity, clusterBias: 0.72, scaleMin: 0.76, scaleMax: 1.45, lodBias: -10 }),
    freezeRecord({ id: "fungi-cluster", category: "fungi", label: "Fungi cluster", biomes: "forest,rainforest,wetland,swamp,taiga,riparian", maxSlope: 36, minRockDistance: 0.18, minMoisture: 0.58, maxMoisture: 1, nearWaterMax: Infinity, clusterBias: 0.94, scaleMin: 0.55, scaleMax: 1.25, lodBias: 0 }),
    freezeRecord({ id: "moss-patch", category: "moss", label: "Moss patch", biomes: "forest,rainforest,wetland,swamp,taiga,riparian,tundra", maxSlope: 44, minRockDistance: 0, minMoisture: 0.52, maxMoisture: 1, nearWaterMax: Infinity, clusterBias: 0.88, scaleMin: 0.65, scaleMax: 1.45, lodBias: 0 })
  ]);

  const TYPE_BY_ID = Object.freeze(VEGETATION_TYPES.reduce((map, type) => {
    map[type.id] = type;
    return map;
  }, Object.create(null)));
  const TYPE_BIOME_LOOKUP = VEGETATION_TYPES.reduce((map, type) => {
    map[type.id] = new Set(type.biomes.split(","));
    return map;
  }, Object.create(null));

  const BIOME_PROFILES = Object.freeze({
    generic: freezeRecord({ moisture: 0.45, density: 0.5, grass: 1, reed: 0.05, fern: 0.25, shrub: 0.45, sapling: 0.2, "mature-tree": 0.2, "dead-tree": 0.04, root: 0.04, log: 0.04, fungi: 0.04, moss: 0.1 }),
    grassland: freezeRecord({ moisture: 0.42, density: 1, grass: 2.2, reed: 0.04, fern: 0.08, shrub: 0.42, sapling: 0.04, "mature-tree": 0.025, "dead-tree": 0.012, root: 0.01, log: 0.012, fungi: 0.015, moss: 0.045 }),
    savanna: freezeRecord({ moisture: 0.32, density: 0.75, grass: 1.9, reed: 0.03, fern: 0.025, shrub: 0.38, sapling: 0.06, "mature-tree": 0.08, "dead-tree": 0.025, root: 0.015, log: 0.012, fungi: 0.008, moss: 0.02 }),
    forest: freezeRecord({ moisture: 0.67, density: 0.9, grass: 0.72, reed: 0.1, fern: 1.2, shrub: 0.64, sapling: 0.55, "mature-tree": 0.5, "dead-tree": 0.07, root: 0.12, log: 0.11, fungi: 0.2, moss: 0.38 }),
    rainforest: freezeRecord({ moisture: 0.9, density: 1.08, grass: 0.4, reed: 0.16, fern: 1.45, shrub: 0.72, sapling: 0.7, "mature-tree": 0.62, "dead-tree": 0.05, root: 0.2, log: 0.13, fungi: 0.28, moss: 0.54 }),
    wetland: freezeRecord({ moisture: 0.88, density: 0.95, grass: 1.2, reed: 1.5, fern: 0.76, shrub: 0.25, sapling: 0.18, "mature-tree": 0.13, "dead-tree": 0.06, root: 0.1, log: 0.08, fungi: 0.14, moss: 0.32 }),
    swamp: freezeRecord({ moisture: 0.96, density: 0.9, grass: 0.6, reed: 1.35, fern: 1.05, shrub: 0.32, sapling: 0.34, "mature-tree": 0.34, "dead-tree": 0.13, root: 0.2, log: 0.18, fungi: 0.24, moss: 0.48 }),
    riparian: freezeRecord({ moisture: 0.78, density: 1, grass: 1.05, reed: 1.1, fern: 0.85, shrub: 0.42, sapling: 0.36, "mature-tree": 0.34, "dead-tree": 0.045, root: 0.18, log: 0.1, fungi: 0.14, moss: 0.32 }),
    taiga: freezeRecord({ moisture: 0.52, density: 0.72, grass: 0.65, reed: 0.03, fern: 0.42, shrub: 0.48, sapling: 0.45, "mature-tree": 0.52, "dead-tree": 0.09, root: 0.09, log: 0.12, fungi: 0.13, moss: 0.42 }),
    tundra: freezeRecord({ moisture: 0.34, density: 0.5, grass: 1.2, reed: 0.01, fern: 0.04, shrub: 0.4, sapling: 0.015, "mature-tree": 0.005, "dead-tree": 0.012, root: 0.01, log: 0.008, fungi: 0.03, moss: 0.52 }),
    desert: freezeRecord({ moisture: 0.07, density: 0.08, grass: 0.18, reed: 0, fern: 0, shrub: 0.3, sapling: 0, "mature-tree": 0, "dead-tree": 0.008, root: 0, log: 0.002, fungi: 0, moss: 0.008 }),
    ocean: freezeRecord({ moisture: 1, density: 0, grass: 0, reed: 0, fern: 0, shrub: 0, sapling: 0, "mature-tree": 0, "dead-tree": 0, root: 0, log: 0, fungi: 0, moss: 0 })
  });

  const QUALITY_BUDGETS = Object.freeze({
    static: freezeRecord({ id: "static", densityScale: 0.12, maxCandidatesPerChunk: 128, maxInstancesPerChunk: 64, maxActiveInstances: 3000, lodDistances: Object.freeze([18, 48, 90, 150]), ditherMeters: 3, hysteresisMeters: 4, shadowDistance: 0, windUpdateHz: 10, maxInfluences: 24 }),
    light: freezeRecord({ id: "light", densityScale: 0.24, maxCandidatesPerChunk: 256, maxInstancesPerChunk: 128, maxActiveInstances: 7000, lodDistances: Object.freeze([26, 75, 150, 260]), ditherMeters: 5, hysteresisMeters: 6, shadowDistance: 55, windUpdateHz: 15, maxInfluences: 48 }),
    balanced: freezeRecord({ id: "balanced", densityScale: 0.42, maxCandidatesPerChunk: 512, maxInstancesPerChunk: 280, maxActiveInstances: 18000, lodDistances: Object.freeze([36, 110, 240, 430]), ditherMeters: 7, hysteresisMeters: 8, shadowDistance: 90, windUpdateHz: 20, maxInfluences: 96 }),
    high: freezeRecord({ id: "high", densityScale: 0.64, maxCandidatesPerChunk: 900, maxInstancesPerChunk: 480, maxActiveInstances: 34000, lodDistances: Object.freeze([52, 165, 360, 650]), ditherMeters: 10, hysteresisMeters: 12, shadowDistance: 145, windUpdateHz: 30, maxInfluences: 160 }),
    ultra: freezeRecord({ id: "ultra", densityScale: 0.86, maxCandidatesPerChunk: 1400, maxInstancesPerChunk: 760, maxActiveInstances: 58000, lodDistances: Object.freeze([70, 230, 510, 900]), ditherMeters: 14, hysteresisMeters: 16, shadowDistance: 220, windUpdateHz: 45, maxInfluences: 256 }),
    cinematic: freezeRecord({ id: "cinematic", densityScale: 1, maxCandidatesPerChunk: 1900, maxInstancesPerChunk: 1050, maxActiveInstances: 84000, lodDistances: Object.freeze([92, 310, 680, 1200]), ditherMeters: 18, hysteresisMeters: 20, shadowDistance: 320, windUpdateHz: 60, maxInfluences: 384 }),
    personal: freezeRecord({ id: "personal", densityScale: 1.15, maxCandidatesPerChunk: 2400, maxInstancesPerChunk: 1400, maxActiveInstances: 110000, lodDistances: Object.freeze([110, 380, 820, 1450]), ditherMeters: 22, hysteresisMeters: 24, shadowDistance: 420, windUpdateHz: 60, maxInfluences: 512, ownerOnly: true })
  });

  const QUALITY_ALIASES = Object.freeze({ low: "light", medium: "balanced", default: "balanced", veryhigh: "ultra", film: "cinematic" });

  function normalizeQuality(quality) {
    const requested = String(quality || "balanced").toLowerCase().replace(/[^a-z]/g, "");
    const id = QUALITY_BUDGETS[requested] ? requested : (QUALITY_ALIASES[requested] || "balanced");
    return QUALITY_BUDGETS[id];
  }

  function normalizeBiome(biome) {
    const raw = typeof biome === "object" && biome ? biome.id : biome;
    const id = String(raw || "generic").toLowerCase().replace(/[^a-z-]/g, "");
    if (BIOME_PROFILES[id]) return id;
    if (id.includes("rain")) return "rainforest";
    if (id.includes("swamp") || id.includes("marsh")) return "swamp";
    if (id.includes("wet")) return "wetland";
    if (id.includes("river") || id.includes("flood")) return "riparian";
    if (id.includes("forest") || id.includes("wood")) return "forest";
    if (id.includes("grass") || id.includes("steppe") || id.includes("meadow")) return "grassland";
    if (id.includes("savanna")) return "savanna";
    if (id.includes("taiga")) return "taiga";
    if (id.includes("tundra")) return "tundra";
    if (id.includes("desert") || id.includes("dune")) return "desert";
    if (id.includes("ocean") || id.includes("reef") || id.includes("sea")) return "ocean";
    return "generic";
  }

  function typeSupportsBiome(type, biomeId) {
    return TYPE_BIOME_LOOKUP[type.id].has(biomeId) || (biomeId === "generic" && type.category !== "reed");
  }

  function createEcologySample() {
    return { cluster: 0, clearing: 0, moistureVariation: 0, canopyOpportunity: 0 };
  }

  function sampleEcologyFields(seed, x, z, biome, out) {
    const target = out || createEcologySample();
    const seedNumber = typeof seed === "number" && Number.isFinite(seed) ? seed >>> 0 : hashSeed(seed);
    const biomeId = normalizeBiome(biome);
    const biomeOffset = hashSeed(biomeId);
    const warpX = fractalNoise(seedNumber ^ 0x92A5, x * 0.00072, z * 0.00072) * 88;
    const warpZ = fractalNoise(seedNumber ^ 0xB741, x * 0.00072 + 19.7, z * 0.00072 - 8.4) * 88;
    const px = x + warpX;
    const pz = z + warpZ;
    target.cluster = clamp01(fractalNoise(seedNumber ^ biomeOffset, px * 0.0042, pz * 0.0042) * 0.5 + 0.5);
    const clearingNoise = fractalNoise(seedNumber ^ 0xCE11, px * 0.00165, pz * 0.00165) * 0.5 + 0.5;
    target.clearing = smoothstep(0.58, 0.82, clearingNoise);
    target.moistureVariation = clamp(fractalNoise(seedNumber ^ 0xA117, px * 0.0021, pz * 0.0021) * 0.22, -0.22, 0.22);
    target.canopyOpportunity = clamp01(target.cluster * (1 - target.clearing) * 1.2);
    return target;
  }

  function resetTerrainSample(target, biomeId) {
    const profile = BIOME_PROFILES[biomeId] || BIOME_PROFILES.generic;
    target.height = 0;
    target.slopeDegrees = 0;
    target.waterDepth = 0;
    target.distanceToWater = Infinity;
    target.rockDistance = Infinity;
    target.rockMask = 0;
    target.moisture = profile.moisture;
    target.valid = true;
    return target;
  }

  function normalizeTerrainSample(sample, target, biomeId) {
    const source = sample && typeof sample === "object" ? sample : target;
    const profile = BIOME_PROFILES[biomeId] || BIOME_PROFILES.generic;
    target.height = finite(source.height, finite(source.y, 0));
    target.slopeDegrees = clamp(source.slopeDegrees == null ? finite(source.slope, 0) : source.slopeDegrees, 0, 90);
    target.waterDepth = Math.max(0, finite(source.waterDepth, source.isWater ? 1 : 0));
    target.distanceToWater = source.distanceToWater == null ? Infinity : Math.max(0, finite(source.distanceToWater, Infinity));
    target.rockDistance = source.rockDistance == null ? Infinity : Math.max(0, finite(source.rockDistance, Infinity));
    target.rockMask = clamp01(source.rockMask == null ? (source.isRock ? 1 : 0) : source.rockMask);
    target.moisture = clamp01(source.moisture == null ? profile.moisture : source.moisture);
    target.valid = source.valid !== false && Number.isFinite(target.height);
    return target;
  }

  function isPlacementAllowed(typeOrId, terrain, ecology, biome) {
    const type = typeof typeOrId === "string" ? TYPE_BY_ID[typeOrId] : typeOrId;
    if (!type || !terrain || terrain.valid === false) return false;
    const biomeId = normalizeBiome(biome);
    if (!typeSupportsBiome(type, biomeId)) return false;
    if (finite(terrain.waterDepth, terrain.isWater ? 1 : 0) > 0) return false;
    if (finite(terrain.slopeDegrees, terrain.slope) > type.maxSlope) return false;
    if (finite(terrain.rockMask, terrain.isRock ? 1 : 0) >= 0.5) return false;
    const rockDistance = terrain.rockDistance == null ? Infinity : finite(terrain.rockDistance, Infinity);
    if (rockDistance < type.minRockDistance) return false;
    const profile = BIOME_PROFILES[biomeId] || BIOME_PROFILES.generic;
    const moisture = clamp01(terrain.moisture == null ? profile.moisture : terrain.moisture);
    if (moisture < type.minMoisture || moisture > type.maxMoisture) return false;
    const waterDistance = terrain.distanceToWater == null ? Infinity : Math.max(0, finite(terrain.distanceToWater, Infinity));
    if (waterDistance > type.nearWaterMax) return false;
    if (ecology && ecology.clearing > 0.76 && ["mature-tree", "sapling", "fern", "root", "log"].includes(type.category)) return false;
    return true;
  }

  function ecologicalWeight(type, biomeId, terrain, ecology) {
    if (!isPlacementAllowed(type, terrain, ecology, biomeId)) return 0;
    const profile = BIOME_PROFILES[biomeId] || BIOME_PROFILES.generic;
    let weight = finite(profile[type.category], 0);
    if (weight <= 0) return 0;
    const cluster = ecology.cluster;
    weight *= 0.32 + Math.pow(cluster, 0.7 + type.clusterBias) * 1.18;
    if (type.category === "grass") weight *= 0.7 + ecology.clearing * 1.6;
    if (type.category === "mature-tree" || type.category === "sapling") weight *= 0.3 + ecology.canopyOpportunity * 1.4;
    if (type.category === "fungi" || type.category === "moss") weight *= 0.5 + terrain.moisture;
    if (type.category === "reed") weight *= 1.15 - Math.min(1, terrain.distanceToWater / type.nearWaterMax) * 0.7;
    return Math.max(0, weight);
  }

  class VegetationPlanner {
    constructor(options = {}) {
      this.seed = options.seed == null ? DEFAULT_SEED : options.seed;
      this.seedNumber = hashSeed(this.seed);
      this.chunkSize = Math.round(clamp(options.chunkSize == null ? 256 : options.chunkSize, LIMITS.minimumChunkSize, LIMITS.maximumChunkSize));
      this.quality = normalizeQuality(options.quality || options.qualityPreset);
      this._terrain = resetTerrainSample({}, "generic");
      this._ecology = createEcologySample();
      this._weights = new Float64Array(VEGETATION_TYPES.length);
      this._disposed = false;
    }

    setQuality(quality) {
      if (this._disposed) return false;
      this.quality = normalizeQuality(quality);
      return true;
    }

    planChunk(input = {}) {
      if (this._disposed) return { ok: false, reason: "disposed", placements: [], stats: { accepted: 0, rejected: 0 } };
      const cx = Math.trunc(finite(input.cx, finite(input.x, 0)));
      const cz = Math.trunc(finite(input.cz, finite(input.z, 0)));
      const biomeId = normalizeBiome(input.biomeId || input.biome);
      const profile = BIOME_PROFILES[biomeId] || BIOME_PROFILES.generic;
      const quality = normalizeQuality(input.quality || this.quality.id);
      const sampler = typeof input.terrainSampler === "function" ? input.terrainSampler : null;
      const requestedDensity = clamp(input.density == null ? 1 : input.density, 0, 2);
      const density = quality.densityScale * profile.density * requestedDensity;
      const attemptLimit = Math.min(LIMITS.maximumCandidatesPerChunk, quality.maxCandidatesPerChunk);
      const attempts = Math.max(0, Math.round(attemptLimit * density));
      const maximumPlacements = Math.min(LIMITS.maximumInstancesPerChunk, quality.maxInstancesPerChunk, Math.max(0, Math.trunc(finite(input.maxInstances, quality.maxInstancesPerChunk))));
      const placements = [];
      const stats = { attempts, accepted: 0, rejected: 0, waterRejected: 0, slopeRejected: 0, rockRejected: 0, invalidTerrain: 0, densityRejected: 0 };
      if (!attempts || !maximumPlacements) return { ok: true, seed: this.seedNumber, biomeId, quality: quality.id, chunk: { cx, cz, size: this.chunkSize }, placements, stats, lodPlan: quality };

      const side = Math.ceil(Math.sqrt(attempts));
      const cellSize = this.chunkSize / side;
      const originX = cx * this.chunkSize;
      const originZ = cz * this.chunkSize;
      for (let candidate = 0; candidate < attempts && placements.length < maximumPlacements; candidate += 1) {
        const gridX = candidate % side;
        const gridZ = Math.floor(candidate / side);
        const jitterX = random01(this.seedNumber, cx, cz, candidate * 4 + 1);
        const jitterZ = random01(this.seedNumber, cx, cz, candidate * 4 + 2);
        const worldX = originX + (gridX + jitterX) * cellSize;
        const worldZ = originZ + (gridZ + jitterZ) * cellSize;
        resetTerrainSample(this._terrain, biomeId);
        if (sampler) {
          try {
            const result = sampler(worldX, worldZ, this._terrain);
            normalizeTerrainSample(result || this._terrain, this._terrain, biomeId);
          } catch (_) {
            this._terrain.valid = false;
          }
        }
        if (!this._terrain.valid) { stats.invalidTerrain += 1; stats.rejected += 1; continue; }
        if (this._terrain.waterDepth > 0) { stats.waterRejected += 1; stats.rejected += 1; continue; }
        if (this._terrain.slopeDegrees > 44) { stats.slopeRejected += 1; stats.rejected += 1; continue; }
        if (this._terrain.rockMask >= 0.5 || this._terrain.rockDistance < 0.18) { stats.rockRejected += 1; stats.rejected += 1; continue; }

        sampleEcologyFields(this.seedNumber, worldX, worldZ, biomeId, this._ecology);
        this._terrain.moisture = clamp01(this._terrain.moisture + this._ecology.moistureVariation);
        const localDensity = clamp01((0.32 + this._ecology.cluster * 0.84) * (1 - this._ecology.clearing * 0.18));
        if (random01(this.seedNumber, cx, cz, candidate * 4 + 3) > localDensity) { stats.densityRejected += 1; stats.rejected += 1; continue; }

        let totalWeight = 0;
        for (let typeIndex = 0; typeIndex < VEGETATION_TYPES.length; typeIndex += 1) {
          const weight = ecologicalWeight(VEGETATION_TYPES[typeIndex], biomeId, this._terrain, this._ecology);
          this._weights[typeIndex] = weight;
          totalWeight += weight;
        }
        if (totalWeight <= 0) {
          if (this._terrain.slopeDegrees > 18) stats.slopeRejected += 1;
          else if (this._terrain.rockDistance < 2.4) stats.rockRejected += 1;
          stats.rejected += 1;
          continue;
        }
        let selection = random01(this.seedNumber, cx, cz, candidate * 4 + 4) * totalWeight;
        let selected = VEGETATION_TYPES[0];
        for (let typeIndex = 0; typeIndex < VEGETATION_TYPES.length; typeIndex += 1) {
          const type = VEGETATION_TYPES[typeIndex];
          selection -= this._weights[typeIndex];
          if (selection <= 0) { selected = type; break; }
        }
        if (!isPlacementAllowed(selected, this._terrain, this._ecology, biomeId)) { stats.rejected += 1; continue; }
        const rotationY = random01(this.seedNumber, cx, cz, candidate * 4 + 5) * Math.PI * 2;
        const scale = lerp(selected.scaleMin, selected.scaleMax, random01(this.seedNumber, cx, cz, candidate * 4 + 6));
        placements.push({
          id: `veg-${cx}-${cz}-${candidate}-${selected.id}`,
          typeId: selected.id,
          category: selected.category,
          x: Math.round(worldX * 1000) / 1000,
          y: Math.round(this._terrain.height * 1000) / 1000,
          z: Math.round(worldZ * 1000) / 1000,
          rotationY,
          scale,
          lodBias: selected.lodBias,
          cluster: this._ecology.cluster,
          clearing: this._ecology.clearing,
          moisture: this._terrain.moisture
        });
        stats.accepted += 1;
      }
      return { ok: true, seed: this.seedNumber, biomeId, quality: quality.id, chunk: { cx, cz, size: this.chunkSize }, placements, stats, lodPlan: quality };
    }

    dispose() {
      if (this._disposed) return false;
      this._disposed = true;
      return true;
    }
  }

  const WIND_LAYERS = Object.freeze([
    freezeRecord({ id: "macro", order: 0, spatialFrequency: 0.00055, temporalFrequency: 0.11, amplitude: 0.38, bendScale: 1 }),
    freezeRecord({ id: "canopy", order: 1, spatialFrequency: 0.0022, temporalFrequency: 0.36, amplitude: 0.28, bendScale: 0.72 }),
    freezeRecord({ id: "branch", order: 2, spatialFrequency: 0.0085, temporalFrequency: 0.98, amplitude: 0.2, bendScale: 0.42 }),
    freezeRecord({ id: "leaf", order: 3, spatialFrequency: 0.033, temporalFrequency: 2.65, amplitude: 0.14, bendScale: 0.2 })
  ]);

  const GUST_DEFAULTS = freezeRecord({ spacingMeters: 420, widthMeters: 62, speedMetersPerSecond: 19, strength: 0.62 });

  function createWindSample() {
    return {
      x: 0, z: 0, speed: 0, normalizedSpeed: 0, directionX: 1, directionZ: 0, gust: 0, bend: 0,
      layers: WIND_LAYERS.map((layer) => ({ id: layer.id, order: layer.order, value: 0, contribution: 0 }))
    };
  }

  function prepareWindSample(out) {
    const target = out || createWindSample();
    if (!Array.isArray(target.layers) || target.layers.length !== WIND_LAYERS.length) target.layers = WIND_LAYERS.map((layer) => ({ id: layer.id, order: layer.order, value: 0, contribution: 0 }));
    for (let index = 0; index < WIND_LAYERS.length; index += 1) {
      if (!target.layers[index] || typeof target.layers[index] !== "object") target.layers[index] = { id: WIND_LAYERS[index].id, order: index, value: 0, contribution: 0 };
    }
    return target;
  }

  class WindField {
    constructor(options = {}) {
      this.seed = options.seed == null ? DEFAULT_SEED : options.seed;
      this.seedNumber = hashSeed(this.seed);
      this.baseSpeed = clamp(options.baseSpeed == null ? 6.5 : options.baseSpeed, 0, LIMITS.maximumWindSpeed);
      const angle = Number.isFinite(Number(options.directionRadians)) ? Number(options.directionRadians) : random01(this.seedNumber, 41, 17, 3) * Math.PI * 2;
      this.directionX = Math.cos(angle);
      this.directionZ = Math.sin(angle);
      this.gustSpacing = clamp(options.gustSpacing == null ? GUST_DEFAULTS.spacingMeters : options.gustSpacing, 120, 1200);
      this.gustWidth = clamp(options.gustWidth == null ? GUST_DEFAULTS.widthMeters : options.gustWidth, 12, this.gustSpacing * 0.45);
      this.gustSpeed = clamp(options.gustSpeed == null ? GUST_DEFAULTS.speedMetersPerSecond : options.gustSpeed, 2, 50);
      this.gustStrength = clamp01(options.gustStrength == null ? GUST_DEFAULTS.strength : options.gustStrength);
      this.gustOffset = random01(this.seedNumber, 7, 29, 101) * this.gustSpacing;
      this._layerPhase = new Float64Array(WIND_LAYERS.length);
      for (let index = 0; index < WIND_LAYERS.length; index += 1) this._layerPhase[index] = random01(this.seedNumber, index, 773, 31) * Math.PI * 2;
      this._sample = createWindSample();
      this._disposed = false;
    }

    configure(options = {}) {
      if (this._disposed) return false;
      if (options.baseSpeed != null || options.baseWindSpeed != null) this.baseSpeed = clamp(options.baseSpeed == null ? options.baseWindSpeed : options.baseSpeed, 0, LIMITS.maximumWindSpeed);
      if (options.directionRadians != null || options.windDirectionRadians != null) {
        const angle = finite(options.directionRadians == null ? options.windDirectionRadians : options.directionRadians, 0);
        this.directionX = Math.cos(angle);
        this.directionZ = Math.sin(angle);
      }
      if (options.gustSpacing != null) this.gustSpacing = clamp(options.gustSpacing, 120, 1200);
      if (options.gustWidth != null) this.gustWidth = clamp(options.gustWidth, 12, this.gustSpacing * 0.45);
      if (options.gustSpeed != null) this.gustSpeed = clamp(options.gustSpeed, 2, 50);
      if (options.gustStrength != null) this.gustStrength = clamp01(options.gustStrength);
      return true;
    }

    sampleInto(x, z, timeSeconds, out) {
      const target = prepareWindSample(out || this._sample);
      if (this._disposed) {
        target.x = 0; target.z = 0; target.speed = 0; target.normalizedSpeed = 0; target.gust = 0; target.bend = 0;
        return target;
      }
      const worldX = finite(x, 0);
      const worldZ = finite(z, 0);
      const time = Math.max(0, finite(timeSeconds, 0));
      const crossX = -this.directionZ;
      const crossZ = this.directionX;
      const along = worldX * this.directionX + worldZ * this.directionZ;
      const across = worldX * crossX + worldZ * crossZ;
      let combined = 0;
      let bend = 0;
      for (let index = 0; index < WIND_LAYERS.length; index += 1) {
        const layer = WIND_LAYERS[index];
        const phaseOffset = this._layerPhase[index];
        const phase = along * layer.spatialFrequency + across * layer.spatialFrequency * 0.61 + time * layer.temporalFrequency + phaseOffset;
        const value = Math.sin(phase) * 0.72 + Math.sin(phase * 1.731 + phaseOffset * 0.37) * 0.28;
        const contribution = value * layer.amplitude;
        const layerOut = target.layers[index];
        layerOut.id = layer.id;
        layerOut.order = layer.order;
        layerOut.value = value;
        layerOut.contribution = contribution;
        combined += contribution;
        bend += Math.abs(contribution) * layer.bendScale;
      }
      const projected = worldX * this.directionX + worldZ * this.directionZ;
      const relative = (projected - time * this.gustSpeed + this.gustOffset) / this.gustSpacing;
      const nearestFront = Math.round(relative);
      const distanceToFront = Math.abs(relative - nearestFront) * this.gustSpacing;
      const frontEnvelope = 1 - smoothstep(0, this.gustWidth, distanceToFront);
      const frontVariation = 0.62 + random01(this.seedNumber, nearestFront, 909, 17) * 0.38;
      const gust = clamp01(frontEnvelope * this.gustStrength * frontVariation);
      const speed = clamp(this.baseSpeed * (1 + combined * 0.42 + gust), 0, LIMITS.maximumWindSpeed);
      const lateral = target.layers[2].contribution * 0.16 + target.layers[3].contribution * 0.08;
      target.x = this.directionX * speed + crossX * speed * lateral;
      target.z = this.directionZ * speed + crossZ * speed * lateral;
      target.speed = Math.hypot(target.x, target.z);
      target.normalizedSpeed = clamp01(target.speed / LIMITS.maximumWindSpeed);
      target.directionX = target.speed > 0 ? target.x / target.speed : this.directionX;
      target.directionZ = target.speed > 0 ? target.z / target.speed : this.directionZ;
      target.gust = gust;
      target.bend = clamp01(bend + gust * 0.56);
      return target;
    }

    sample(x, z, timeSeconds, out) { return this.sampleInto(x, z, timeSeconds, out); }

    getGustFrontSchedule(x, z, timeSeconds, count = 4) {
      const total = Math.round(clamp(count, 1, 16));
      const projected = finite(x, 0) * this.directionX + finite(z, 0) * this.directionZ;
      const now = Math.max(0, finite(timeSeconds, 0));
      const cycleAtNow = (now * this.gustSpeed - projected - this.gustOffset) / this.gustSpacing;
      let frontIndex = Math.ceil(cycleAtNow - 1e-9);
      const schedule = new Array(total);
      for (let index = 0; index < total; index += 1) {
        const arrival = (projected + this.gustOffset + frontIndex * this.gustSpacing) / this.gustSpeed;
        schedule[index] = { index: frontIndex, arrivalSeconds: arrival, etaSeconds: Math.max(0, arrival - now), strength: this.gustStrength * (0.62 + random01(this.seedNumber, frontIndex, 909, 17) * 0.38) };
        frontIndex += 1;
      }
      return schedule;
    }

    dispose() {
      if (this._disposed) return false;
      this._disposed = true;
      return true;
    }
  }

  class BoundedObjectPool {
    constructor(options = {}) {
      const requested = typeof options === "number" ? options : options.capacity;
      this.capacity = Math.round(clamp(requested == null ? 64 : requested, 1, LIMITS.maximumPoolCapacity));
      this._create = typeof options.create === "function" ? options.create : (() => ({}));
      this._reset = typeof options.reset === "function" ? options.reset : null;
      this._items = new Array(this.capacity);
      this._indexes = new Map();
      this._active = new Uint8Array(this.capacity);
      this._free = new Int32Array(this.capacity);
      this._freeCount = this.capacity;
      this._disposed = false;
      for (let index = 0; index < this.capacity; index += 1) {
        const item = this._create(index);
        if (!item || (typeof item !== "object" && typeof item !== "function")) throw new TypeError("Pool factory must return an object");
        this._items[index] = item;
        this._indexes.set(item, index);
        this._free[index] = this.capacity - index - 1;
      }
    }

    get activeCount() { return this.capacity - this._freeCount; }
    get availableCount() { return this._freeCount; }
    get disposed() { return this._disposed; }

    acquire() {
      if (this._disposed || this._freeCount <= 0) return null;
      const index = this._free[--this._freeCount];
      this._active[index] = 1;
      return this._items[index];
    }

    release(item) {
      if (this._disposed) return false;
      const index = this._indexes.get(item);
      if (index == null || this._active[index] === 0) return false;
      if (this._reset) this._reset(item, index);
      this._active[index] = 0;
      this._free[this._freeCount++] = index;
      return true;
    }

    clear() {
      if (this._disposed) return false;
      this._freeCount = 0;
      for (let index = 0; index < this.capacity; index += 1) {
        if (this._active[index] && this._reset) this._reset(this._items[index], index);
        this._active[index] = 0;
        this._free[this._freeCount++] = index;
      }
      return true;
    }

    dispose() {
      if (this._disposed) return false;
      this.clear();
      this._disposed = true;
      this._indexes.clear();
      return true;
    }
  }

  function createVegetationStateSample() {
    return { compression: 0, wetness: 0, burn: 0, snow: 0, mud: 0, health: 1, activeInfluences: 0 };
  }

  class InfluencePool {
    constructor(capacity = 96) {
      this.capacity = Math.round(clamp(capacity, 1, LIMITS.maximumInfluences));
      this._slots = new Array(this.capacity);
      this._sequence = 0;
      this._activeCount = 0;
      this._sample = createVegetationStateSample();
      this._disposed = false;
      for (let index = 0; index < this.capacity; index += 1) this._slots[index] = { active: false, id: 0, sequence: 0, x: 0, z: 0, radius: 1, startMs: 0, durationMs: 1, compression: 0, wetness: 0, burn: 0, snow: 0, mud: 0 };
    }

    get activeCount() { return this._activeCount; }
    get disposed() { return this._disposed; }

    add(input = {}) {
      if (this._disposed) return null;
      let slot = null;
      for (let index = 0; index < this.capacity; index += 1) {
        if (!this._slots[index].active) { slot = this._slots[index]; break; }
      }
      if (!slot) {
        slot = this._slots[0];
        for (let index = 1; index < this.capacity; index += 1) if (this._slots[index].sequence < slot.sequence) slot = this._slots[index];
      } else this._activeCount += 1;
      const sequence = ++this._sequence;
      slot.active = true;
      slot.id = sequence;
      slot.sequence = sequence;
      slot.x = finite(input.x, 0);
      slot.z = finite(input.z, 0);
      slot.radius = clamp(input.radius == null ? 1.2 : input.radius, 0.05, LIMITS.maximumInfluenceRadius);
      slot.startMs = Math.max(0, finite(input.startMs == null ? input.timeMs : input.startMs, 0));
      slot.durationMs = Math.round(clamp(input.durationMs == null ? 8000 : input.durationMs, 1, LIMITS.maximumInfluenceDurationMs));
      slot.compression = clamp01(input.compression);
      slot.wetness = clamp01(input.wetness);
      slot.burn = clamp01(input.burn);
      slot.snow = clamp01(input.snow);
      slot.mud = clamp01(input.mud);
      return slot.id;
    }

    decay(nowMs) {
      if (this._disposed) return 0;
      const now = Math.max(0, finite(nowMs, 0));
      let removed = 0;
      for (let index = 0; index < this.capacity; index += 1) {
        const slot = this._slots[index];
        if (slot.active && now >= slot.startMs + slot.durationMs) {
          slot.active = false;
          this._activeCount -= 1;
          removed += 1;
        }
      }
      return removed;
    }

    sampleInto(x, z, nowMs, out) {
      const target = out || this._sample;
      target.compression = 0; target.wetness = 0; target.burn = 0; target.snow = 0; target.mud = 0; target.health = 1; target.activeInfluences = 0;
      if (this._disposed) return target;
      const worldX = finite(x, 0);
      const worldZ = finite(z, 0);
      const now = Math.max(0, finite(nowMs, 0));
      for (let index = 0; index < this.capacity; index += 1) {
        const slot = this._slots[index];
        if (!slot.active || now < slot.startMs || now >= slot.startMs + slot.durationMs) continue;
        const dx = worldX - slot.x;
        const dz = worldZ - slot.z;
        const distanceSquared = dx * dx + dz * dz;
        if (distanceSquared >= slot.radius * slot.radius) continue;
        const radial = 1 - smoothstep(0, slot.radius, Math.sqrt(distanceSquared));
        const progress = clamp01((now - slot.startMs) / slot.durationMs);
        const temporal = (1 - progress) * (1 - progress);
        const strength = radial * temporal;
        target.compression = Math.max(target.compression, slot.compression * strength);
        target.wetness = Math.max(target.wetness, slot.wetness * strength);
        target.burn = Math.max(target.burn, slot.burn * strength);
        target.snow = Math.max(target.snow, slot.snow * strength);
        target.mud = Math.max(target.mud, slot.mud * strength);
        target.activeInfluences += 1;
      }
      target.health = clamp01(1 - target.burn * 0.88 - target.compression * 0.06);
      return target;
    }

    clear() {
      if (this._disposed) return false;
      for (let index = 0; index < this.capacity; index += 1) this._slots[index].active = false;
      this._activeCount = 0;
      return true;
    }

    dispose() {
      if (this._disposed) return false;
      this.clear();
      this._disposed = true;
      return true;
    }
  }

  class VegetationStateSystem {
    constructor(options = {}) {
      const quality = normalizeQuality(options.quality);
      this.influences = new InfluencePool(options.capacity == null ? quality.maxInfluences : options.capacity);
      this.current = { wetness: clamp01(options.wetness), burn: clamp01(options.burn), snow: clamp01(options.snow), mud: clamp01(options.mud) };
      this.target = { wetness: this.current.wetness, burn: this.current.burn, snow: this.current.snow, mud: this.current.mud };
      this.responseRate = clamp(options.responseRate == null ? 0.72 : options.responseRate, 0.02, 12);
      this._local = createVegetationStateSample();
      this._sample = createVegetationStateSample();
      this._disposed = false;
    }

    setEnvironment(input = {}) {
      if (this._disposed) return false;
      if (input.wetness != null) this.target.wetness = clamp01(input.wetness);
      if (input.burn != null) this.target.burn = clamp01(input.burn);
      if (input.snow != null) this.target.snow = clamp01(input.snow);
      if (input.mud != null) this.target.mud = clamp01(input.mud);
      return true;
    }

    snapEnvironment(input) {
      if (!this.setEnvironment(input)) return false;
      this.current.wetness = this.target.wetness;
      this.current.burn = this.target.burn;
      this.current.snow = this.target.snow;
      this.current.mud = this.target.mud;
      return true;
    }

    update(deltaSeconds) {
      if (this._disposed) return false;
      const delta = clamp(deltaSeconds, 0, LIMITS.maximumDeltaSeconds);
      const blend = 1 - Math.exp(-this.responseRate * delta);
      this.current.wetness = lerp(this.current.wetness, this.target.wetness, blend);
      this.current.burn = lerp(this.current.burn, this.target.burn, blend);
      this.current.snow = lerp(this.current.snow, this.target.snow, blend);
      this.current.mud = lerp(this.current.mud, this.target.mud, blend);
      return true;
    }

    addInfluence(input) { return this._disposed ? null : this.influences.add(input); }

    disturb(input = {}) {
      if (this._disposed) return null;
      const type = String(input.type || "compression").toLowerCase();
      const mapped = { x: input.x, z: input.z, radius: input.radius, startMs: input.startMs == null ? input.timeMs : input.startMs, durationMs: input.durationMs };
      if (type === "footstep") { mapped.compression = input.strength == null ? 0.84 : input.strength; mapped.mud = input.mud == null ? 0.28 : input.mud; }
      else if (type === "body" || type === "compression") mapped.compression = input.strength == null ? 0.68 : input.strength;
      else if (type === "rain" || type === "wet") { mapped.wetness = input.strength == null ? 0.75 : input.strength; mapped.mud = input.mud == null ? 0.35 : input.mud; }
      else if (type === "fire" || type === "burn") mapped.burn = input.strength == null ? 0.9 : input.strength;
      else if (type === "snow" || type === "snowfall") { mapped.snow = input.strength == null ? 0.8 : input.strength; mapped.wetness = input.wetness == null ? 0.15 : input.wetness; }
      else if (type === "mud") { mapped.mud = input.strength == null ? 0.8 : input.strength; mapped.compression = input.compression == null ? 0.2 : input.compression; }
      else mapped.compression = input.strength == null ? 0.5 : input.strength;
      return this.influences.add(mapped);
    }

    decay(nowMs) { return this._disposed ? 0 : this.influences.decay(nowMs); }

    sampleInto(x, z, nowMs, out) {
      const target = out || this._sample;
      this.influences.sampleInto(x, z, nowMs, this._local);
      target.compression = this._local.compression;
      target.wetness = Math.max(this.current.wetness, this._local.wetness);
      target.burn = Math.max(this.current.burn, this._local.burn);
      target.snow = Math.max(this.current.snow, this._local.snow);
      target.mud = Math.max(this.current.mud, this._local.mud);
      target.health = clamp01(1 - target.burn * 0.88 - target.compression * 0.06);
      target.activeInfluences = this._local.activeInfluences;
      return target;
    }

    clear() { return this._disposed ? false : this.influences.clear(); }

    dispose() {
      if (this._disposed) return false;
      this.influences.dispose();
      this._disposed = true;
      return true;
    }
  }

  function createLodSample() { return { lod: 0, nextLod: 1, visible: true, dither: 0, transitionIndex: -1 }; }

  function rawLodForDistance(distance, thresholds) {
    if (distance <= thresholds[0]) return 0;
    if (distance <= thresholds[1]) return 1;
    if (distance <= thresholds[2]) return 2;
    if (distance <= thresholds[3]) return 3;
    return 4;
  }

  class LodController {
    constructor(options = {}) {
      this.quality = normalizeQuality(options.quality || options.qualityPreset);
      this.hysteresisMeters = clamp(options.hysteresisMeters == null ? this.quality.hysteresisMeters : options.hysteresisMeters, 0, 128);
      this.ditherMeters = clamp(options.ditherMeters == null ? this.quality.ditherMeters : options.ditherMeters, 0.1, 128);
      this._sample = createLodSample();
      this._disposed = false;
    }

    setQuality(quality) {
      if (this._disposed) return false;
      this.quality = normalizeQuality(quality);
      this.hysteresisMeters = this.quality.hysteresisMeters;
      this.ditherMeters = this.quality.ditherMeters;
      return true;
    }

    evaluate(distance, previousLod, out) {
      const target = out || this._sample;
      const meters = Math.max(0, finite(distance, 0));
      const thresholds = this.quality.lodDistances;
      let lod = rawLodForDistance(meters, thresholds);
      const previous = Number.isInteger(previousLod) && previousLod >= 0 && previousLod <= 4 ? previousLod : lod;
      if (!this._disposed && lod > previous && previous < 4) {
        const outwardBoundary = thresholds[previous];
        if (meters <= outwardBoundary + this.hysteresisMeters) lod = previous;
      } else if (!this._disposed && lod < previous && previous > 0) {
        const inwardBoundary = thresholds[previous - 1];
        if (meters >= inwardBoundary - this.hysteresisMeters) lod = previous;
      }
      let nearestIndex = -1;
      let nearestDistance = Infinity;
      for (let index = 0; index < thresholds.length; index += 1) {
        const delta = Math.abs(meters - thresholds[index]);
        if (delta < nearestDistance) { nearestDistance = delta; nearestIndex = index; }
      }
      const halfDither = this.ditherMeters * 0.5;
      target.transitionIndex = nearestDistance <= halfDither ? nearestIndex : -1;
      target.dither = target.transitionIndex < 0 ? 0 : clamp01((meters - (thresholds[nearestIndex] - halfDither)) / this.ditherMeters);
      target.lod = this._disposed ? 4 : lod;
      target.nextLod = Math.min(4, target.transitionIndex < 0 ? lod + 1 : nearestIndex + 1);
      target.visible = target.lod < 4;
      return target;
    }

    select(distance, previousLod) { return this.evaluate(distance, previousLod, this._sample).lod; }

    dispose() {
      if (this._disposed) return false;
      this._disposed = true;
      return true;
    }
  }

  function createRuntimeFrame() {
    return { status: "idle", paused: false, timeSeconds: 0, wind: createWindSample() };
  }

  class VegetationSystem {
    constructor(options = {}) {
      this.quality = normalizeQuality(options.quality || options.qualityPreset);
      this.planner = new VegetationPlanner({ seed: options.seed, chunkSize: options.chunkSize, quality: this.quality.id });
      this.wind = new WindField({ seed: options.seed, baseSpeed: options.baseWindSpeed, directionRadians: options.windDirectionRadians, gustSpacing: options.gustSpacing, gustWidth: options.gustWidth, gustSpeed: options.gustSpeed, gustStrength: options.gustStrength });
      this.states = new VegetationStateSystem({ quality: this.quality.id, capacity: options.influenceCapacity, wetness: options.wetness, snow: options.snow, mud: options.mud });
      this.lod = new LodController({ quality: this.quality.id });
      this.paused = false;
      this.pauseReason = "";
      this.disposed = false;
      this._frame = createRuntimeFrame();
      this._visibilityDocument = null;
      this._onVisibilityChange = () => {
        if (!this._visibilityDocument || this.disposed) return;
        if (this._visibilityDocument.hidden) this.pause("visibility");
        else if (this.pauseReason === "visibility") this.resume("visibility");
      };
      if (options.bindVisibility !== false && global.document) this.bindVisibility(global.document);
    }

    setQuality(quality) {
      if (this.disposed) return false;
      this.quality = normalizeQuality(quality);
      this.planner.setQuality(this.quality.id);
      this.lod.setQuality(this.quality.id);
      return true;
    }

    configure(options = {}) {
      if (this.disposed) return false;
      if (options.quality != null || options.qualityPreset != null) this.setQuality(options.quality == null ? options.qualityPreset : options.quality);
      this.wind.configure(options);
      if (options.wetness != null || options.burn != null || options.snow != null || options.mud != null) this.states.setEnvironment(options);
      return true;
    }

    bindVisibility(documentLike) {
      if (this.disposed || !documentLike || typeof documentLike.addEventListener !== "function" || typeof documentLike.removeEventListener !== "function") return false;
      this.unbindVisibility();
      this._visibilityDocument = documentLike;
      documentLike.addEventListener("visibilitychange", this._onVisibilityChange);
      this._onVisibilityChange();
      return true;
    }

    unbindVisibility() {
      if (!this._visibilityDocument) return false;
      this._visibilityDocument.removeEventListener("visibilitychange", this._onVisibilityChange);
      this._visibilityDocument = null;
      return true;
    }

    pause(reason = "manual") {
      if (this.disposed) return false;
      if (this.paused && reason === "visibility" && this.pauseReason !== "visibility") return true;
      this.paused = true;
      this.pauseReason = String(reason || "manual");
      return true;
    }

    resume(reason = "manual") {
      if (this.disposed) return false;
      if (this._visibilityDocument && this._visibilityDocument.hidden) return false;
      if (reason === "visibility" && this.pauseReason !== "visibility") return false;
      this.paused = false;
      this.pauseReason = "";
      return true;
    }

    planChunk(input) { return this.planner.planChunk(input); }

    disturb(input) { return this.disposed ? null : this.states.disturb(input); }

    sampleStateInto(x, z, nowMs, out) { return this.states.sampleInto(x, z, nowMs, out); }

    update(frame = {}, out) {
      const target = out || this._frame;
      if (!target.wind) target.wind = createWindSample();
      const timeSeconds = Math.max(0, finite(frame.timeSeconds == null ? frame.time : frame.timeSeconds, 0));
      target.timeSeconds = timeSeconds;
      target.paused = this.paused;
      if (this.disposed) { target.status = "disposed"; target.paused = true; this.wind.sampleInto(0, 0, 0, target.wind); return target; }
      if (this.paused) { target.status = "paused"; return target; }
      this.states.update(frame.deltaSeconds == null ? frame.delta : frame.deltaSeconds);
      this.states.decay(timeSeconds * 1000);
      this.wind.sampleInto(frame.cameraX == null ? frame.x : frame.cameraX, frame.cameraZ == null ? frame.z : frame.cameraZ, timeSeconds, target.wind);
      target.status = "running";
      return target;
    }

    animate(frame, out) { return this.update(frame, out); }

    getStatus(out) {
      const target = out || {};
      target.version = VERSION;
      target.status = this.disposed ? "disposed" : (this.paused ? "paused" : "ready");
      target.quality = this.quality.id;
      target.paused = this.paused;
      target.pauseReason = this.pauseReason;
      target.activeInfluences = this.disposed ? 0 : this.states.influences.activeCount;
      target.maxInfluences = this.quality.maxInfluences;
      target.maxInstancesPerChunk = this.quality.maxInstancesPerChunk;
      return target;
    }

    dispose() {
      if (this.disposed) return false;
      this.unbindVisibility();
      this.planner.dispose();
      this.wind.dispose();
      this.states.dispose();
      this.lod.dispose();
      this.paused = true;
      this.pauseReason = "disposed";
      this.disposed = true;
      return true;
    }
  }

  function createVegetationPlanner(options) { return new VegetationPlanner(options); }
  function createWindField(options) { return new WindField(options); }
  function createVegetationStateSystem(options) { return new VegetationStateSystem(options); }
  function createLodController(options) { return new LodController(options); }
  function createVegetationSystem(options) { return new VegetationSystem(options); }
  function getVegetationType(id) { return TYPE_BY_ID[String(id || "")] || null; }

  return {
    VERSION,
    version: VERSION,
    DEFAULT_SEED,
    LIMITS,
    VEGETATION_TYPES,
    TYPES: VEGETATION_TYPES,
    TYPE_BY_ID,
    BIOME_PROFILES,
    QUALITY_BUDGETS,
    WIND_LAYERS,
    GUST_DEFAULTS,
    hashSeed,
    random01,
    createSeededRandom,
    normalizeBiome,
    normalizeQuality,
    getVegetationType,
    createEcologySample,
    sampleEcologyFields,
    isPlacementAllowed,
    createWindSample,
    createVegetationStateSample,
    createLodSample,
    createRuntimeFrame,
    VegetationPlanner,
    WindField,
    BoundedObjectPool,
    InfluencePool,
    VegetationStateSystem,
    LodController,
    VegetationSystem,
    createVegetationPlanner,
    createWindField,
    createVegetationStateSystem,
    createLodController,
    createVegetationSystem,
    create: createVegetationSystem
  };
});
