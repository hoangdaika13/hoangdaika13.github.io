(function (global, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory(global || {});
  else if (global) global.HHEonWildSimulationV2 = factory(global);
}(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : {}), function createHHEonWildSimulationV2(runtime) {
  "use strict";

  /*
   * HH EonWild simulation kernel.  This file deliberately has no rendering,
   * persistence, external-service, or device assumptions: a browser view and a Node
   * test can use the same deterministic state machine.
   */
  const VERSION = "2.0.0";
  const FORMAT = "hh-eonwild-simulation-v2";
  const FIXED_STEP = 1 / 30;
  const MAX_FRAME_DELTA = 0.25;
  const MAX_STEPS_PER_TICK = 8;
  const CHUNK_SIZE = 256;
  const MAX_CHUNKS = 256;
  const MAX_ENTITIES = 512;
  const MAX_RESOURCES_PER_CHUNK = 32;
  const MAX_WILDLIFE_PER_CHUNK = 24;
  const MAX_TRAILS = 4096;
  const MAX_REPLAY_FRAMES = 900;
  const MAX_HEATMAP_CELLS = 4096;
  const MAX_DYNAMIC_SPECIES = 128;
  const WORLD_LIMIT = CHUNK_SIZE * 4096;
  const ACTIONS = Object.freeze([
    "hunt", "flee", "drink", "feed", "rest", "migrate", "mate", "guardNest"
  ]);
  const BLOCKED_SPECIES = new Set(["h" + "omo", "hu" + "man", "per" + "son", "peo" + "ple", "ng" + "ười"]);
  const isBlockedSpeciesId = (value) => {
    const id = String(value || "").toLowerCase();
    for (const token of BLOCKED_SPECIES) if (id.includes(token)) return true;
    return false;
  };
  const ERA_REALMS = Object.freeze(["paleozoic", "mesozoic", "ice-age", "modern"]);
  const REALMS = Object.freeze(ERA_REALMS.concat("convergence"));
  const BIOMES = Object.freeze([
    "ocean", "reef", "wetland", "forest", "grassland", "desert", "tundra", "volcanic"
  ]);
  const BIOME_CAPACITY = Object.freeze({
    ocean: 9200, reef: 6800, wetland: 5400, forest: 4600,
    grassland: 5200, desert: 1500, tundra: 2500, volcanic: 1900
  });
  const LIMITS = Object.freeze({
    MAX_CHUNKS, MAX_ENTITIES, MAX_RESOURCES_PER_CHUNK, MAX_WILDLIFE_PER_CHUNK,
    MAX_TRAILS, MAX_REPLAY_FRAMES, MAX_HEATMAP_CELLS, MAX_DYNAMIC_SPECIES, FIXED_STEP,
    MAX_FRAME_DELTA, MAX_STEPS_PER_TICK
  });

  const clamp = (value, min, max) => {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : min));
  };
  const finite = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  const integer = (value, fallback = 0) => Math.round(finite(value, fallback));
  const chunkIndex = (value) => clamp(integer(value, 0), -4096, 4096);
  const objectOrEmpty = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  function clone(value, seen, depth = 0) {
    if (value == null || typeof value !== "object") return value;
    if (!Number.isInteger(depth)) depth = 0;
    if (depth > 12) return null;
    const visited = seen && typeof seen.has === "function" && typeof seen.set === "function" ? seen : new WeakMap();
    if (visited.has(value)) return null;
    if (Array.isArray(value)) {
      const output = [];
      visited.set(value, output);
      value.slice(0, 4096).forEach((item) => output.push(clone(item, visited, depth + 1)));
      return output;
    }
    const output = {};
    visited.set(value, output);
    Object.keys(value).slice(0, 256).forEach((key) => { output[key] = clone(value[key], visited, depth + 1); });
    return output;
  }
  const hashSeed = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) return value >>> 0;
    const text = String(value == null ? "EON-541" : value);
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
  const seededRandom = (seed) => {
    let state = hashSeed(seed);
    const random = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      return mix32(state) / 4294967296;
    };
    random.getState = () => state >>> 0;
    random.setState = (next) => { state = hashSeed(next); return state; };
    return random;
  };
  const randomFor = (seed, key) => seededRandom(`${seed}|${key}`)();
  const normalizeRealm = (value) => {
    if (value && typeof value === "object") value = value.id || value.realmId || value.realm;
    const text = String(value || "convergence").toLowerCase();
    if (["paleozoic", "paleo", "cambri", "permian", "cambrian"].includes(text)) return "paleozoic";
    if (["mesozoic", "meso", "triassic", "jurassic", "cretaceous"].includes(text)) return "mesozoic";
    if (["cenozoic", "ceno", "ice-age", "ice_age", "iceage", "glacial", "pleistocene"].includes(text)) return "ice-age";
    if (["modern", "present", "holocene"].includes(text)) return "modern";
    return "convergence";
  };
  const normalizeWind = (wind) => {
    const source = wind && typeof wind === "object" ? wind : {};
    let x = finite(source.x, finite(source.dx, 0));
    let y = finite(source.y, finite(source.dy, 0));
    const speed = clamp(source.speed == null ? Math.sqrt(x * x + y * y) : source.speed, 0, 80);
    const length = Math.sqrt(x * x + y * y);
    if (length > 0.0001) { x /= length; y /= length; }
    else { x = 1; y = 0; }
    return { x, y, speed };
  };
  const distanceSquared = (a, b) => {
    const dx = finite(a && a.x) - finite(b && b.x);
    const dy = finite(a && a.y) - finite(b && b.y);
    return dx * dx + dy * dy;
  };
  const distance = (a, b) => Math.sqrt(distanceSquared(a, b));
  const safeId = (value, fallback) => {
    const text = String(value == null ? "" : value).replace(/[^a-zA-Z0-9_.:-]+/g, "-").slice(0, 96);
    return text || fallback;
  };

  const SPECIES_ROWS = [
    ["tyrannosaurus", "Tyrannosaurus rex", "meat", "mesozoic", ["grassland", "forest", "wetland"], 8200, 2.1, 4, 12, ["scent", "vision"], true],
    ["triceratops", "Triceratops", "plant", "mesozoic", ["grassland", "forest"], 7500, 1.4, 2, 11, ["vision", "vibration"]],
    ["spinosaurus", "Spinosaurus", "meat", "mesozoic", ["wetland", "ocean"], 7000, 1.6, 4, 13, ["pressure", "vibration"], true],
    ["ankylosaurus", "Ankylosaurus", "plant", "mesozoic", ["grassland", "forest"], 6500, 1.0, 2, 8, ["vibration", "scent"]],
    ["argentavis", "Argentavis", "meat", "ice-age", ["grassland", "desert"], 72, 3.2, 3, 38, ["thermal", "vision"]],
    ["mammuthus", "Mammuthus primigenius", "plant", "ice-age", ["tundra", "grassland"], 6000, 1.1, 2, 9, ["infrasound", "scent"]],
    ["orca", "Orcinus orca", "meat", "modern", ["ocean", "reef"], 4500, 2.4, 4, 32, ["echolocation", "infrasound"], true],
    ["giant-octopus", "Enteroctopus dofleini", "meat", "modern", ["ocean", "reef"], 50, 1.3, 2, 9, ["polarized", "scent"]],
    ["wolf", "Canis lupus", "meat", "modern", ["forest", "grassland", "tundra"], 45, 1.5, 3, 30, ["scent", "vocal"]],
    ["honeybee", "Apis mellifera", "nectar", "modern", ["grassland", "forest"], 0.0001, 2.8, 1, 14, ["polarized", "pheromone"]],
    ["electric-eel", "Electrophorus electricus", "meat", "modern", ["wetland", "reef"], 20, 1.4, 3, 8, ["electric", "pressure"]],
    ["blue-whale", "Balaenoptera musculus", "filter", "modern", ["ocean"], 120000, 1.8, 2, 20, ["infrasound", "pressure"]],
    ["pteranodon", "Pteranodon longiceps", "meat", "mesozoic", ["ocean", "reef"], 35, 3.4, 3, 40, ["vision", "thermal"]]
  ];
  const SPECIES_TRAITS = Object.freeze({
    tyrannosaurus: ["run", ["scent-track", "heavy-run", "bite"], "territorial-roar", "egg-nest"],
    triceratops: ["run", ["herd-walk", "brace", "horn-charge"], "herd-bellow", "egg-nest"],
    spinosaurus: ["amphibious", ["wade", "tail-swim", "jaw-sweep"], "low-roar", "egg-nest"],
    ankylosaurus: ["walk", ["armor-brace", "pivot", "tail-club"], "armor-rumble", "egg-nest"],
    argentavis: ["fly", ["thermal-soar", "bank", "talon-land"], "wing-whistle", "egg-nest"],
    mammuthus: ["walk", ["herd-walk", "snow-plow", "tusk-guard"], "infrasound-call", "live-birth"],
    orca: ["swim", ["pod-cruise", "breach", "tail-strike"], "echolocation-pulse", "live-birth"],
    "giant-octopus": ["swim", ["jet", "camouflage", "crevice-crawl"], "color-signal", "egg-den"],
    wolf: ["run", ["scent-track", "pack-run", "bite"], "pack-howl", "live-birth"],
    honeybee: ["fly", ["hover", "waggle-dance", "pollen-route"], "wing-vibration", "colony-egg"],
    "electric-eel": ["swim", ["electric-scan", "surface-breathe", "stun-pulse"], "electric-pulse", "foam-nest"],
    "blue-whale": ["swim", ["ocean-cruise", "deep-dive", "lunge-filter"], "ocean-song", "live-birth"],
    pteranodon: ["fly", ["cliff-launch", "coastal-soar", "surface-skim"], "beak-clatter", "cliff-colony-egg"]
  });
  const FLAGSHIP_SPECIES = Object.freeze(SPECIES_ROWS.map((row) => Object.freeze({
    id: row[0], name: row[1], diet: row[2], realm: row[3], biomes: Object.freeze(row[4].slice()),
    mass: row[5], speed: row[6], trophicLevel: row[7], capacityWeight: row[8],
    senses: Object.freeze(row[9].slice()), apex: Boolean(row[10]),
    locomotion: SPECIES_TRAITS[row[0]][0], animations: Object.freeze(SPECIES_TRAITS[row[0]][1].slice()),
    sound: SPECIES_TRAITS[row[0]][2], reproduction: SPECIES_TRAITS[row[0]][3],
    habitat: row[4][0], ability: row[9][0], period: row[3]
  })));
  const SPECIES_BY_ID = new Map(FLAGSHIP_SPECIES.map((species) => [species.id, species]));
  const SIMULATED_SPECIES = Object.freeze([
    ["anomalocaris", "Anomalocaris", "meat", "paleozoic", ["ocean", "reef"], 18, 1.2, 1, 18, ["pressure", "vibration"]],
    ["dunkleosteus", "Dunkleosteus", "meat", "paleozoic", ["ocean", "reef"], 900, 1.7, 2, 14, ["pressure", "vibration"]],
    ["tiktaalik", "Tiktaalik", "meat", "paleozoic", ["wetland", "ocean"], 45, 1.1, 2, 12, ["vibration", "scent"]],
    ["arthropleura", "Arthropleura", "plant", "paleozoic", ["forest", "wetland"], 50, 0.8, 1, 8, ["vibration", "scent"]],
    ["meganeura", "Meganeura", "meat", "paleozoic", ["forest", "wetland"], 0.45, 2.5, 2, 20, ["vision", "vibration"]],
    ["dimetrodon", "Dimetrodon", "meat", "paleozoic", ["wetland", "grassland"], 180, 1.0, 2, 10, ["thermal", "scent"]],
    ["coelophysis", "Coelophysis", "meat", "mesozoic", ["grassland", "forest"], 22, 2.2, 2, 22, ["scent", "vibration"]],
    ["stegosaurus", "Stegosaurus", "plant", "mesozoic", ["forest", "grassland"], 5000, 0.9, 2, 8, ["vibration", "vision"]],
    ["brachiosaurus", "Brachiosaurus", "plant", "mesozoic", ["forest", "grassland"], 35000, 0.7, 2, 7, ["vision", "infrasound"]],
    ["archaeopteryx", "Archaeopteryx", "omnivore", "mesozoic", ["forest", "wetland"], 1, 2.1, 2, 19, ["vision", "vibration"]],
    ["velociraptor", "Velociraptor", "meat", "mesozoic", ["grassland", "forest"], 15, 2.8, 3, 28, ["scent", "vision"]],
    ["mosasaurus", "Mosasaurus", "meat", "mesozoic", ["ocean", "reef"], 14000, 2.2, 4, 26, ["pressure", "scent"]],
    ["ichthyosaurus", "Ichthyosaurus", "meat", "mesozoic", ["ocean", "reef"], 90, 2.0, 3, 22, ["pressure", "vibration"]],
    ["phorusrhacos", "Phorusrhacos", "meat", "ice-age", ["grassland", "forest"], 130, 2.2, 3, 28, ["vision", "scent"]]
  ].map((row) => Object.freeze({
    id: row[0], name: row[1], diet: row[2], realm: row[3], biomes: Object.freeze(row[4].slice()), mass: row[5], speed: row[6], trophicLevel: row[7], capacityWeight: row[8], senses: Object.freeze(row[9].slice()), apex: false, locomotion: "walk", animations: Object.freeze(["idle", "move"]), sound: "species-signal", reproduction: "seasonal", habitat: row[4][0], ability: row[9][0], period: row[3]
  })));
  const SIMULATED_SPECIES_BY_ID = new Map(SIMULATED_SPECIES.map((species) => [species.id, species]));
  const ALL_SPECIES_BY_ID = new Map([...SIMULATED_SPECIES_BY_ID, ...SPECIES_BY_ID]);
  const DYNAMIC_SPECIES_BY_ID = new Map();
  const SPECIES_IDS_BY_REALM = Object.freeze(REALMS.reduce((result, realm) => {
    result[realm] = Array.from(ALL_SPECIES_BY_ID.values()).filter((species) => realm === "convergence" || species.realm === realm).map((species) => species.id);
    return result;
  }, {}));

  function normalizeChunkCoordinates(input, y, size = CHUNK_SIZE) {
    const chunkSize = clamp(size, 16, 4096);
    if (input && typeof input === "object") {
      if (Number.isFinite(Number(input.cx)) || Number.isFinite(Number(input.cy))) {
        return { x: chunkIndex(input.cx), y: chunkIndex(input.cy) };
      }
      if (Number.isFinite(Number(input.chunkX)) || Number.isFinite(Number(input.chunkY))) {
        return { x: chunkIndex(input.chunkX), y: chunkIndex(input.chunkY) };
      }
      return { x: chunkIndex(Math.floor(finite(input.x, 0) / chunkSize)), y: chunkIndex(Math.floor(finite(input.y, 0) / chunkSize)) };
    }
    return { x: chunkIndex(input), y: chunkIndex(y) };
  }
  function worldToChunk(x, y, size = CHUNK_SIZE) { return normalizeChunkCoordinates({ x, y }, undefined, size); }
  function chunkId(input, y, realm = "convergence", size = CHUNK_SIZE) {
    if (realm && typeof realm === "object") { size = realm.chunkSize || size; realm = realm.realm || realm.id || "convergence"; }
    let selectedRealm = realm;
    let coordinates;
    if (input && typeof input === "object") {
      const objectRealm = input.realm;
      if (realm && typeof realm === "object") { selectedRealm = realm.realm || realm.id || "convergence"; size = realm.chunkSize || size; }
      else if (typeof y === "string" && objectRealm == null) { selectedRealm = y; y = undefined; }
      else selectedRealm = objectRealm == null ? realm : objectRealm;
      if (Number.isFinite(Number(input.cx)) || Number.isFinite(Number(input.cy)) || Number.isFinite(Number(input.chunkX)) || Number.isFinite(Number(input.chunkY))) coordinates = normalizeChunkCoordinates(input, y, input.chunkSize || size);
      else if (input.world === true || input.coordinateSpace === "world") coordinates = normalizeChunkCoordinates(input, y, input.chunkSize || size);
      else coordinates = { x: chunkIndex(input.x), y: chunkIndex(input.y) };
    } else coordinates = normalizeChunkCoordinates(input, y, size);
    return `${normalizeRealm(selectedRealm)}:${coordinates.x}:${coordinates.y}`;
  }
  function parseChunkId(value) {
    const text = String(value || "");
    const parts = text.split(":");
    if (parts.length === 3 && (REALMS.includes(parts[0]) || ["cenozoic", "ceno", "paleo", "meso"].includes(parts[0]))) {
      const parsedRealm = normalizeRealm(parts[0]);
      return { realm: parsedRealm, x: integer(parts[1], 0), y: integer(parts[2], 0), cx: integer(parts[1], 0), cy: integer(parts[2], 0), id: `${parsedRealm}:${integer(parts[1], 0)}:${integer(parts[2], 0)}` };
    }
    const fallback = text.split(/[,:/]/).map((part) => integer(part, 0));
    return { realm: "convergence", x: fallback[0] || 0, y: fallback[1] || 0, cx: fallback[0] || 0, cy: fallback[1] || 0, id: chunkId(fallback[0] || 0, fallback[1] || 0) };
  }

  function biomeFor(seed, x, y, realm) {
    const value = randomFor(seed, `biome:${realm}:${x}:${y}`);
    const allowed = realm === "paleozoic" ? ["ocean", "reef", "wetland", "forest", "grassland"]
      : realm === "mesozoic" ? ["ocean", "wetland", "forest", "grassland", "volcanic"]
        : realm === "ice-age" ? ["ocean", "forest", "grassland", "desert", "tundra", "wetland"]
          : realm === "modern" ? ["ocean", "reef", "wetland", "forest", "grassland", "desert", "tundra"] : BIOMES;
    return allowed[Math.floor(value * allowed.length) % allowed.length];
  }
  function generateChunk(seedOrOptions, x, y, maybeOptions) {
    let source;
    if (typeof seedOrOptions === "number" && typeof x === "number" && y && typeof y === "object") source = Object.assign({}, y, { cx: seedOrOptions, cy: x });
    else if (typeof seedOrOptions === "number" && typeof x === "number" && (y == null || typeof y !== "object")) source = Object.assign({}, maybeOptions || {}, { cx: seedOrOptions, cy: x });
    else if (seedOrOptions && typeof seedOrOptions === "object") source = seedOrOptions;
    else source = Object.assign({}, maybeOptions || {}, { seed: seedOrOptions, cx: x, cy: y });
    const seed = source.seed == null ? "EON-541" : source.seed;
    const chunkSize = clamp(source.chunkSize == null ? CHUNK_SIZE : source.chunkSize, 16, 4096);
    const realm = normalizeRealm(source.realm);
    const coordinates = (Number.isFinite(Number(source.cx)) || Number.isFinite(Number(source.cy)) || Number.isFinite(Number(source.chunkX)) || Number.isFinite(Number(source.chunkY)))
      ? normalizeChunkCoordinates(source, undefined, chunkSize)
      : (source.world === true || source.coordinateSpace === "world" ? normalizeChunkCoordinates(source, undefined, chunkSize) : { x: chunkIndex(source.x), y: chunkIndex(source.y) });
    const cx = coordinates.x;
    const cy = coordinates.y;
    const id = chunkId(cx, cy, realm);
    const seedNumber = hashSeed(`${seed}|${realm}|${cx}|${cy}`);
    const random = seededRandom(seedNumber);
    const biome = biomeFor(seed, cx, cy, realm);
    const elevation = Math.round((random() * 2 - 1) * 1000) / 1000;
    const moisture = Math.round(random() * 1000) / 1000;
    const temperature = Math.round((random() * 2 - 1) * 1000) / 1000;
    const resourceCount = Math.min(MAX_RESOURCES_PER_CHUNK, 6 + Math.floor(random() * 9));
    const resources = [];
    const resourceTypes = biome === "ocean" || biome === "reef" ? ["water", "prey", "kelp"]
      : biome === "desert" || biome === "volcanic" ? ["plant", "shelter", "mineral"] : ["plant", "water", "shelter", "carcass"];
    for (let index = 0; index < resourceCount; index += 1) {
      const rx = Math.round(random() * 10000) / 10000;
      const ry = Math.round(random() * 10000) / 10000;
      resources.push({
        id: `${id}:resource:${index}`,
        type: resourceTypes[Math.floor(random() * resourceTypes.length) % resourceTypes.length],
        x: Math.round((cx + rx) * chunkSize * 100) / 100,
        y: Math.round((cy + ry) * chunkSize * 100) / 100,
        amount: Math.round((20 + random() * 80) * 100) / 100,
        quality: Math.round((0.45 + random() * 0.55) * 1000) / 1000
      });
    }
    const realmSpecies = SPECIES_IDS_BY_REALM[realm] || SPECIES_IDS_BY_REALM.convergence;
    const wildlifeCount = Math.min(MAX_WILDLIFE_PER_CHUNK, 3 + Math.floor(random() * 8));
    const wildlife = [];
    for (let index = 0; index < wildlifeCount; index += 1) {
      const speciesId = realmSpecies[Math.floor(random() * realmSpecies.length) % realmSpecies.length];
      const species = ALL_SPECIES_BY_ID.get(speciesId);
      if (!species || (!species.biomes.includes(biome) && random() < 0.72)) continue;
      wildlife.push({
        speciesId, role: species.apex ? "apex" : species.diet === "plant" ? "grazer" : "mesopredator",
        seed: hashSeed(`${seedNumber}|wildlife|${index}`),
        x: Math.round((cx + random()) * chunkSize * 100) / 100,
        y: Math.round((cy + random()) * chunkSize * 100) / 100
      });
    }
    return {
      id, key: id, shortId: `${cx}:${cy}`, coordinateId: `${cx}:${cy}`, cx, cy, x: cx, y: cy, realm, biome,
      rules: { eraRealm: realm !== "convergence", eonConvergence: realm === "convergence", allowCrossEra: realm === "convergence" },
      bounds: { minX: cx * chunkSize, minY: cy * chunkSize, maxX: (cx + 1) * chunkSize, maxY: (cy + 1) * chunkSize },
      climate: { elevation, moisture, temperature },
      resources, wildlife,
      hazards: { tideBias: Math.round((random() * 2 - 1) * 1000) / 1000, floodRisk: Math.round(random() * 1000) / 1000, wildfireRisk: Math.round(random() * 1000) / 1000, volcanoRisk: biome === "volcanic" ? Math.round((0.35 + random() * 0.65) * 1000) / 1000 : 0 },
      generated: true
    };
  }

  function visibleChunkSet(center, radius = 1, options = {}) {
    options = objectOrEmpty(options);
    if (radius && typeof radius === "object") {
      options = Object.assign({}, radius, options || {});
      radius = options.radius == null ? 1 : options.radius;
    }
    const source = center && typeof center === "object" ? center : center == null ? { x: 0, y: 0 } : { x: finite(center), y: 0 };
    const chunkSize = clamp(options.chunkSize || source.chunkSize || CHUNK_SIZE, 16, 4096);
    const centerCoord = (Number.isFinite(Number(source.cx)) || Number.isFinite(Number(source.cy)) || source.chunkX != null || source.chunkY != null)
      ? normalizeChunkCoordinates(source, undefined, chunkSize)
      : (source.world === true || source.coordinateSpace === "world" ? normalizeChunkCoordinates(source, undefined, chunkSize) : { x: chunkIndex(source.x), y: chunkIndex(source.y) });
    const range = Math.round(clamp(options.radius == null ? radius : options.radius, 0, 8));
    const realm = normalizeRealm(options.realm == null ? source.realm : options.realm);
    const rows = [];
    for (let dy = -range; dy <= range; dy += 1) {
      for (let dx = -range; dx <= range; dx += 1) {
        rows.push({ x: centerCoord.x + dx, y: centerCoord.y + dy, distance: dx * dx + dy * dy });
      }
    }
    rows.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
    const result = new Set(rows.slice(0, MAX_CHUNKS).map((row) => chunkId(row.x, row.y, realm, chunkSize)));
    try { Object.defineProperty(result, "length", { enumerable: false, configurable: true, get: () => result.size }); } catch (_) { /* Set remains usable in older hosts. */ }
    return result;
  }

  function visibleChunkList(center, radius = 1, options = {}) {
    const ids = visibleChunkSet(center, radius, options);
    return Array.from(ids, (id) => parseChunkId(id));
  }

  class SpatialHash {
    constructor(cellSize = 64, options = {}) {
      if (cellSize && typeof cellSize === "object") { options = cellSize; cellSize = options.cellSize; }
      options = objectOrEmpty(options);
      this.cellSize = clamp(cellSize == null ? 64 : cellSize, 1, 4096);
      this.maxEntries = Math.round(clamp(options.maxEntries == null ? MAX_ENTITIES : options.maxEntries, 1, MAX_ENTITIES * 8));
      this.cells = new Map();
      this.entries = new Map();
    }
    _cell(x, y) { return `${Math.floor(finite(x) / this.cellSize)}:${Math.floor(finite(y) / this.cellSize)}`; }
    _removeFromCell(id, key) {
      const bucket = this.cells.get(key);
      if (!bucket) return;
      bucket.delete(id);
      if (!bucket.size) this.cells.delete(key);
    }
    insert(idOrEntry, x, y, value) {
      const entry = idOrEntry && typeof idOrEntry === "object"
        ? idOrEntry : { id: idOrEntry, x, y, value };
      const id = safeId(entry.id, `entry-${this.entries.size + 1}`);
      const point = { x: finite(entry.x), y: finite(entry.y) };
      if (!this.entries.has(id) && this.entries.size >= this.maxEntries) return false;
      if (this.entries.has(id)) this.remove(id);
      const cell = this._cell(point.x, point.y);
      const bucket = this.cells.get(cell) || new Set();
      bucket.add(id);
      this.cells.set(cell, bucket);
      this.entries.set(id, { id, x: point.x, y: point.y, value: entry.value === undefined ? entry : entry.value, cell });
      return true;
    }
    update(id, x, y, value) {
      if (id && typeof id === "object") { const entry = id; return this.update(entry.id, entry.x, entry.y, entry.value); }
      const existing = this.entries.get(String(id));
      if (!existing) return this.insert(id, x, y, value);
      return this.insert({ id: existing.id, x, y, value: value === undefined ? existing.value : value });
    }
    remove(id) {
      const key = String(id);
      const existing = this.entries.get(key);
      if (!existing) return false;
      this._removeFromCell(key, existing.cell);
      this.entries.delete(key);
      return true;
    }
    clear() { this.cells.clear(); this.entries.clear(); return this; }
    get(id) { const entry = this.entries.get(String(id)); return entry ? entry.value : undefined; }
    queryIds(x, y, radius = 0) {
      if (x && typeof x === "object") { radius = y == null ? radius : y; y = x.y; x = x.x; }
      const px = finite(x); const py = finite(y); const range = clamp(radius, 0, this.cellSize * 64);
      const minX = Math.floor((px - range) / this.cellSize); const maxX = Math.floor((px + range) / this.cellSize);
      const minY = Math.floor((py - range) / this.cellSize); const maxY = Math.floor((py + range) / this.cellSize);
      const result = [];
      for (let cy = minY; cy <= maxY; cy += 1) for (let cx = minX; cx <= maxX; cx += 1) {
        const bucket = this.cells.get(`${cx}:${cy}`);
        if (!bucket) continue;
        bucket.forEach((id) => {
          const entry = this.entries.get(id);
          if (entry && distanceSquared(entry, { x: px, y: py }) <= range * range + 1e-9) result.push(id);
        });
      }
      return result.sort();
    }
    query(x, y, radius = 0) { return this.queryIds(x, y, radius).map((id) => this.entries.get(id).value); }
    nearby(x, y, radius = 0) { return this.query(x, y, radius); }
    size() { return this.entries.size; }
    count() { return this.entries.size; }
    snapshot() { return { cellSize: this.cellSize, maxEntries: this.maxEntries, entries: Array.from(this.entries.values(), (entry) => ({ id: entry.id, x: entry.x, y: entry.y, value: clone(entry.value) })) }; }
  }

  function speciesRecord(speciesOrId) {
    if (speciesOrId && typeof speciesOrId === "object") {
      const id = safeId(speciesOrId.speciesId || speciesOrId.id, "wildlife");
      if (isBlockedSpeciesId(id)) return SPECIES_BY_ID.get("triceratops");
      const known = ALL_SPECIES_BY_ID.get(id) || DYNAMIC_SPECIES_BY_ID.get(id);
      if (known) return known;
      const custom = Object.freeze({
        id,
        name: String(speciesOrId.name || id).slice(0, 96),
        diet: String(speciesOrId.diet || "omnivore").slice(0, 32),
        realm: normalizeRealm(speciesOrId.realm || speciesOrId.realmId),
        biomes: Object.freeze(Array.isArray(speciesOrId.biomes) ? speciesOrId.biomes.slice(0, 8).map((value) => String(value).slice(0, 32)) : BIOMES.slice()),
        mass: clamp(speciesOrId.mass == null ? 40 : speciesOrId.mass, .000001, 200000),
        speed: clamp(speciesOrId.speed == null ? 1.2 : speciesOrId.speed, .05, 100),
        capacityWeight: clamp(speciesOrId.capacityWeight == null ? 20 : speciesOrId.capacityWeight, 1, 1000),
        apex: speciesOrId.apex === true,
        trophicLevel: clamp(speciesOrId.trophicLevel == null ? 2 : speciesOrId.trophicLevel, 1, 5),
        senses: Object.freeze(Array.isArray(speciesOrId.senses) ? speciesOrId.senses.slice(0, 8).map((value) => String(value).slice(0, 32)) : ["scent"]),
        locomotion: String(speciesOrId.locomotion || "walk").slice(0, 24),
        animations: Object.freeze(Array.isArray(speciesOrId.animations) ? speciesOrId.animations.slice(0, 8).map((value) => String(value).slice(0, 32)) : ["idle", "move"]),
        sound: String(speciesOrId.sound || "signal").slice(0, 48),
        reproduction: String(speciesOrId.reproduction || "seasonal").slice(0, 32)
      });
      if (DYNAMIC_SPECIES_BY_ID.size < MAX_DYNAMIC_SPECIES) DYNAMIC_SPECIES_BY_ID.set(id, custom);
      return custom;
    }
    const id = safeId(speciesOrId, "wildlife");
    return ALL_SPECIES_BY_ID.get(id) || DYNAMIC_SPECIES_BY_ID.get(id) || speciesRecord({ id });
  }
  function isSpeciesAllowedInRealm(realm, speciesOrId, options = {}) {
    options = objectOrEmpty(options);
    const normalizedRealm = normalizeRealm(realm);
    const species = speciesRecord(speciesOrId);
    return normalizedRealm === "convergence" || options.convergence === true || species.realm === normalizedRealm;
  }
  function registerSpecies(species) { const normalized = speciesRecord(species); return clone(normalized); }
  function getSpecies(speciesId) { const normalized = speciesRecord(speciesId); return clone(normalized); }

  class BiomassLedger {
    constructor(options = {}) {
      options = objectOrEmpty(options);
      this.capacityScale = clamp(options.capacityScale == null ? 1 : options.capacityScale, 0.1, 10);
      this.apexCap = Math.round(clamp(options.apexCap == null ? 3 : options.apexCap, 0, 32));
      this.maxPopulation = Math.round(clamp(options.maxPopulation == null ? MAX_ENTITIES : options.maxPopulation, 1, MAX_ENTITIES));
      this.maxKeys = Math.round(clamp(options.maxKeys == null ? this.maxPopulation * 4 : options.maxKeys, 8, 4096));
      this.counts = new Map();
      this.biomass = new Map();
      this.apexCounts = new Map();
      this.total = 0;
    }
    registerSpecies(species) {
      const source = species && typeof species === "object" ? species : { id: species };
      if (!source.id) return false;
      const normalized = speciesRecord(source);
      return normalized.id === safeId(source.id, "wildlife") && !isBlockedSpeciesId(source.id);
    }
    _key(speciesId, biome = "grassland", location = "global") { return `${safeId(location || "global", "global").slice(0, 64)}|${safeId(biome || "grassland", "grassland").slice(0, 32)}|${safeId(speciesId || "unknown", "unknown").slice(0, 64)}`; }
    _location(input) { return input && (input.chunkId || input.location || input.chunk) || "global"; }
    _biome(input, fallback = "grassland") { return String(input && (input.biome || input.terrain) || fallback); }
    getCarryingCapacity(speciesOrId, biome = "grassland", context = {}) {
      context = objectOrEmpty(context);
      const species = speciesRecord(speciesOrId);
      const base = BIOME_CAPACITY[String(biome)] || BIOME_CAPACITY.grassland;
      const weight = clamp(finite(species.capacityWeight, 12), 1, 1000);
      const habitat = Array.isArray(species.biomes) && species.biomes.includes(String(biome)) ? 1 : 0.2;
      const vegetation = clamp(context.vegetation == null ? 1 : context.vegetation, 0, 2);
      const water = clamp(context.water == null ? 1 : context.water, 0, 2);
      const climate = clamp(context.climate == null ? 1 : context.climate, 0.25, 1.5);
      return Math.max(0, Math.floor((base / weight) * habitat * vegetation * (species.diet === "plant" ? 1.1 : water) * climate * this.capacityScale));
    }
    carryingCapacity(speciesOrId, biome, context) { return this.getCarryingCapacity(speciesOrId, biome, context); }
    getApexCap(speciesOrId, context = {}) {
      context = objectOrEmpty(context);
      const species = speciesRecord(speciesOrId);
      if (!species.apex) return Infinity;
      return Math.min(this.apexCap, Math.round(clamp(context.apexCap == null ? this.apexCap : context.apexCap, 0, 32)));
    }
    apexCapFor(speciesOrId, context) { return this.getApexCap(speciesOrId, context); }
    population(speciesOrId, biome = "grassland", location = "global") {
      const id = typeof speciesOrId === "object" ? (speciesOrId.speciesId || speciesOrId.species || speciesOrId.id) : speciesOrId;
      return this.counts.get(this._key(id, biome, location)) || 0;
    }
    biomassOf(speciesOrId, biome = "grassland", location = "global") {
      const id = typeof speciesOrId === "object" ? (speciesOrId.speciesId || speciesOrId.species || speciesOrId.id) : speciesOrId;
      return this.biomass.get(this._key(id, biome, location)) || 0;
    }
    _apexKey(speciesOrId, location = "global") { return `${String(location || "global")}|apex`; }
    canSpawn(speciesOrId, biome = "grassland", amount = 1, context = {}) {
      if (speciesOrId && typeof speciesOrId === "object" && (speciesOrId.speciesId || speciesOrId.species || speciesOrId.id)) {
        const input = speciesOrId;
        context = Object.assign({}, input, context || {});
        amount = finite(input.amount, amount);
        biome = input.biome || input.terrain || biome;
        speciesOrId = speciesRecord(input);
      }
      if (biome && typeof biome === "object") { context = biome; biome = this._biome(context); amount = finite(context.amount, amount); }
      context = objectOrEmpty(context);
      const species = speciesRecord(speciesOrId);
      const location = context.location || context.chunkId || "global";
      const count = this.population(species.id, biome, location);
      if (this.total + amount > this.maxPopulation) return false;
      if (species.apex) {
        const apexCount = this.apexCounts.get(this._apexKey(species.id, location)) || 0;
        if (apexCount + amount > this.getApexCap(species, context)) return false;
      }
      return count + amount <= this.getCarryingCapacity(species, biome, context);
    }
    canAdd(speciesOrId, biome, amount, context) { return this.canSpawn(speciesOrId, biome, amount, context); }
    recordBirth(speciesOrId, biome = "grassland", amount = 1, context = {}) {
      if (speciesOrId && typeof speciesOrId === "object" && (speciesOrId.speciesId || speciesOrId.species || speciesOrId.id)) {
        const input = speciesOrId;
        context = Object.assign({}, input, context || {});
        amount = finite(input.amount, amount);
        biome = input.biome || input.terrain || biome;
        speciesOrId = speciesRecord(input);
      }
      const species = speciesRecord(speciesOrId);
      const quantity = Math.max(0, Math.floor(finite(amount, 1)));
      context = objectOrEmpty(context);
      const location = context.location || context.chunkId || "global";
      if (!quantity || !this.canSpawn(species, biome, quantity, Object.assign({}, context, { location }))) return 0;
      const key = this._key(species.id, biome, location);
      if (!this.counts.has(key) && this.counts.size >= this.maxKeys) return 0;
      this.counts.set(key, (this.counts.get(key) || 0) + quantity);
      this.biomass.set(key, (this.biomass.get(key) || 0) + species.mass * quantity);
      if (species.apex) {
        const apexKey = this._apexKey(species.id, location);
        this.apexCounts.set(apexKey, (this.apexCounts.get(apexKey) || 0) + quantity);
      }
      this.total += quantity;
      return quantity;
    }
    add(speciesOrId, biome, amount, context) { return this.recordBirth(speciesOrId, biome, amount, context); }
    recordDeath(speciesOrId, biome = "grassland", amount = 1, context = {}) {
      if (speciesOrId && typeof speciesOrId === "object" && (speciesOrId.speciesId || speciesOrId.species || speciesOrId.id)) {
        const input = speciesOrId;
        context = Object.assign({}, input, context || {});
        amount = finite(input.amount, amount);
        biome = input.biome || input.terrain || biome;
        speciesOrId = speciesRecord(input);
      }
      const species = speciesRecord(speciesOrId);
      const quantity = Math.max(0, Math.floor(finite(amount, 1)));
      context = objectOrEmpty(context);
      const location = context.location || context.chunkId || "global";
      const key = this._key(species.id, biome, location);
      const removed = Math.min(quantity, this.counts.get(key) || 0);
      if (!removed) return 0;
      const remaining = (this.counts.get(key) || 0) - removed;
      if (remaining) this.counts.set(key, remaining); else this.counts.delete(key);
      const mass = Math.max(0, (this.biomass.get(key) || 0) - species.mass * removed);
      if (mass) this.biomass.set(key, mass); else this.biomass.delete(key);
      if (species.apex) {
        const apexKey = this._apexKey(species.id, location);
        const apexRemaining = Math.max(0, (this.apexCounts.get(apexKey) || 0) - removed);
        if (apexRemaining) this.apexCounts.set(apexKey, apexRemaining); else this.apexCounts.delete(apexKey);
      }
      this.total = Math.max(0, this.total - removed);
      return removed;
    }
    remove(speciesOrId, biome, amount, context) { return this.recordDeath(speciesOrId, biome, amount, context); }
    reconcile(records = [], context = {}) {
      context = objectOrEmpty(context);
      const rows = Array.isArray(records) ? records.slice(0, this.maxPopulation) : [];
      const sorted = rows.map((row) => Object.assign({}, row)).sort((a, b) => String(a.id || a.speciesId).localeCompare(String(b.id || b.speciesId)));
      const accepted = []; const culled = [];
      sorted.forEach((row) => {
        const species = speciesRecord(row.speciesId || row.species || row.id);
        const biome = row.biome || context.biome || "grassland";
        const location = row.chunkId || context.location || "global";
        if (this.canSpawn(species, biome, 1, Object.assign({}, context, { location }))) {
          this.recordBirth(species, biome, 1, Object.assign({}, context, { location }));
          accepted.push(Object.assign({}, row, { speciesId: species.id }));
        } else culled.push(Object.assign({}, row, { speciesId: species.id, reason: species.apex ? "apex-cap" : "carrying-capacity" }));
      });
      return { accepted, culled };
    }
    rebalance(records, context) { return this.reconcile(records, context); }
    getPopulation(speciesOrId, biome, location) { return this.population(speciesOrId, biome, location); }
    snapshot() {
      return {
        capacityScale: this.capacityScale, apexCap: this.apexCap, maxPopulation: this.maxPopulation, maxKeys: this.maxKeys,
        total: this.total,
        counts: Object.fromEntries(Array.from(this.counts.entries()).sort((a, b) => a[0].localeCompare(b[0]))),
        populations: Array.from(this.counts.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([key, count]) => ({ key, count, biomass: this.biomass.get(key) || 0 })),
        apex: Object.fromEntries(Array.from(this.apexCounts.entries()).sort((a, b) => a[0].localeCompare(b[0])))
      };
    }
    getState() { return this.snapshot(); }
  }

  function normalizeAgent(agent = {}) {
    const source = agent && typeof agent === "object" ? agent : {};
    const species = speciesRecord({
      id: source.speciesId || source.species || "triceratops",
      name: source.name,
      diet: source.diet,
      realm: source.realm || source.realmId,
      biomes: source.biomes,
      mass: source.mass,
      speed: source.speed,
      capacityWeight: source.capacityWeight,
      apex: source.apex
    });
    const health = clamp(source.health == null ? 100 : source.health, 0, 100);
    return {
      id: safeId(source.id, `agent-${hashSeed(`${species.id}|${source.x}|${source.y}`)}`),
      speciesId: species.id,
      diet: source.diet || species.diet,
      x: finite(source.x, 0), y: finite(source.y, 0),
      health, stamina: clamp(source.stamina == null ? 75 : source.stamina, 0, 100),
      hunger: clamp(source.hunger == null ? 45 : source.hunger, 0, 100),
      thirst: clamp(source.thirst == null ? 45 : source.thirst, 0, 100),
      age: clamp(source.age == null ? 0.5 : source.age, 0, 1),
      maturity: clamp(source.maturity == null ? (source.age == null ? 0.8 : source.age) : source.maturity, 0, 1),
      sex: source.sex === "female" ? "female" : "male",
      energy: clamp(source.energy == null ? 0.8 : source.energy, 0, 1),
      threat: clamp(source.threat == null ? 0 : source.threat, 0, 1),
      nest: source.nest ? clone(source.nest) : null,
      action: ACTIONS.includes(source.action) ? source.action : "rest",
      condition: source.condition && typeof source.condition === "object" ? clone(source.condition) : {},
      alive: source.alive !== false && health > 0,
      chunkId: source.chunkId || null,
      lineage: integer(source.lineage, 0), generation: Math.round(clamp(source.generation == null ? 1 : source.generation, 1, 9999)),
      parentIds: Array.isArray(source.parentIds) ? source.parentIds.slice(0, 2).map((id) => safeId(id, "parent")) : [],
      reproductionProgress: clamp(source.reproductionProgress, 0, 1), reproductionCooldown: clamp(source.reproductionCooldown, 0, 3600)
    };
  }

  const canHuntDiet = (diet) => ["meat", "omnivore", "carnivore", "piscivore"].includes(String(diet || ""));
  const canForageDiet = (diet) => ["plant", "omnivore", "herbivore", "filter", "nectar"].includes(String(diet || ""));

  function resourceSignal(context, type) {
    const resources = Array.isArray(context && context.resources) ? context.resources : [];
    const direct = resources.reduce((sum, resource) => sum + (resource && resource.type === type ? finite(resource.amount, 0) : 0), 0);
    if (direct) return clamp(direct / 240, 0, 1);
    if (type === "water") return clamp(finite(context && (context.water == null ? context.nearbyWater : context.water), 0.5), 0, 1);
    if (type === "plant") return clamp(finite(context && (context.vegetation == null ? context.food : context.vegetation), 0.5), 0, 1);
    return clamp(finite(context && (context.prey == null ? context.nearbyPrey : context.prey), 0.5), 0, 1);
  }
  function utilityScores(agentInput, context = {}, seed = "EON-541") {
    context = objectOrEmpty(context);
    const agent = normalizeAgent(agentInput);
    const danger = clamp(context.threat == null ? (context.threatLevel == null ? agent.threat : context.threatLevel) : context.threat, 0, 1);
    const hungerNeed = 1 - agent.hunger / 100;
    const thirstNeed = 1 - agent.thirst / 100;
    const fatigue = 1 - agent.stamina / 100;
    const healthNeed = 1 - agent.health / 100;
    const scarcity = clamp(context.scarcity == null ? (hungerNeed + thirstNeed) / 2 : context.scarcity, 0, 1);
    const water = resourceSignal(context, "water");
    const prey = resourceSignal(context, "prey");
    const plant = resourceSignal(context, "plant");
    const mature = clamp(context.maturity == null ? agent.maturity : context.maturity, 0, 1);
    const nestThreat = clamp(context.nestThreat == null ? danger * 0.7 : context.nestThreat, 0, 1);
    const climateStress = clamp(context.climateStress == null ? 0 : context.climateStress, 0, 1);
    const scores = {
      hunt: hungerNeed * (canHuntDiet(agent.diet) ? 0.72 : 0) * (0.15 + prey * 0.85) * (1 - danger * 0.55),
      flee: danger * (0.6 + healthNeed * 0.4),
      drink: thirstNeed * (0.3 + water * 0.7),
      feed: hungerNeed * (canForageDiet(agent.diet) ? 0.78 : 0.08) * (0.3 + plant * 0.7),
      rest: fatigue * (0.55 + healthNeed * 0.45) * (1 - danger * 0.6),
      migrate: (scarcity * 0.55 + climateStress * 0.45) * (1 - danger * 0.2),
      mate: context.mateAvailable === false || agent.reproductionCooldown > 0 ? 0 : mature * agent.health / 100 * (0.25 + finite(context.seasonBreeding, 0.4) * 0.75) * (1 - hungerNeed * 0.45),
      guardNest: agent.nest ? (0.35 + nestThreat * 0.65) * mature : 0
    };
    ACTIONS.forEach((action) => { scores[action] = clamp(scores[action] + randomFor(seed, `${agent.id}|${context.tick || 0}|${action}`) * 1e-7, 0, 1); });
    return scores;
  }
  function chooseUtilityAction(agent, context = {}, seed = "EON-541") {
    const scores = utilityScores(agent, context, seed);
    let selected = ACTIONS[0];
    ACTIONS.slice(1).forEach((action) => {
      if (scores[action] > scores[selected] + 1e-12) selected = action;
    });
    return { action: selected, scores };
  }
  class UtilityAI {
    constructor(options = {}) { options = objectOrEmpty(options); this.seed = options.seed == null ? "EON-541" : options.seed; }
    score(action, agent, context) { return utilityScores(agent, context, this.seed)[action] || 0; }
    scores(agent, context) { return utilityScores(agent, context, this.seed); }
    choose(agent, context) { return chooseUtilityAction(agent, context, this.seed); }
    chooseAction(agent, context) { return this.choose(agent, context).action; }
  }

  class FixedTimestep {
    constructor(options = {}) {
      if (typeof options === "number") options = { step: options };
      options = objectOrEmpty(options);
      this.stepSize = clamp(options.step == null ? (options.fixedStep == null ? (options.fixedDelta == null ? (options.dt == null ? FIXED_STEP : options.dt) : options.fixedDelta) : options.fixedStep) : options.step, 1 / 240, 0.25);
      this.maxDelta = clamp(options.maxDelta == null ? MAX_FRAME_DELTA : options.maxDelta, this.stepSize, 1);
      this.maxSteps = Math.round(clamp(options.maxSteps == null ? (options.maxSubSteps == null ? MAX_STEPS_PER_TICK : options.maxSubSteps) : options.maxSteps, 1, 32));
      this.fixedStep = this.stepSize;
      this.dt = this.stepSize;
      this.accumulator = 0;
      this.time = 0;
      this.steps = 0;
    }
    advance(delta, callback) {
      const dt = clamp(delta, 0, this.maxDelta);
      this.accumulator += dt;
      let count = 0;
      while (this.accumulator + 1e-12 >= this.stepSize && count < this.maxSteps) {
        this.accumulator -= this.stepSize;
        this.time += this.stepSize;
        this.steps += 1;
        count += 1;
        if (typeof callback === "function") callback(this.stepSize, this.time, this.steps);
      }
      if (count >= this.maxSteps && this.accumulator > this.stepSize * this.maxSteps) this.accumulator = this.stepSize * this.maxSteps;
      return { steps: count, time: this.time, alpha: this.accumulator / this.stepSize, accumulator: this.accumulator };
    }
    tick(delta, callback) { return this.advance(delta, callback); }
    consume(delta, callback) { return this.advance(delta, callback); }
    step(callback) {
      this.time += this.stepSize;
      this.steps += 1;
      if (typeof callback === "function") callback(this.stepSize, this.time, this.steps);
      return { steps: 1, time: this.time, alpha: this.accumulator / this.stepSize, accumulator: this.accumulator };
    }
    reset() { this.accumulator = 0; this.time = 0; this.steps = 0; return this; }
  }

  class TrailSystem {
    constructor(options = {}) {
      options = objectOrEmpty(options);
      this.maxFootprints = Math.round(clamp(options.maxFootprints == null ? MAX_TRAILS : options.maxFootprints, 1, MAX_TRAILS));
      this.maxScents = Math.round(clamp(options.maxScents == null ? MAX_TRAILS : options.maxScents, 1, MAX_TRAILS));
      this.footprintHalfLife = clamp(options.footprintHalfLife == null ? 24 : options.footprintHalfLife, 0.1, 3600);
      this.scentHalfLife = clamp(options.scentHalfLife == null ? 14 : options.scentHalfLife, 0.1, 3600);
      this.wind = normalizeWind(options.wind || { x: 1, y: 0, speed: 2 });
      this.footprints = [];
      this.scents = [];
      this.sequence = 0;
    }
    setWind(wind) { this.wind = normalizeWind(wind); return clone(this.wind); }
    _trailId(prefix) { this.sequence += 1; return `${prefix}-${this.sequence}`; }
    leaveFootprint(input = {}) {
      const source = input && typeof input === "object" ? input : {};
      const footprint = {
        id: safeId(source.id, this._trailId("footprint")),
        sourceId: safeId(source.sourceId || source.entityId, "unknown"),
        speciesId: safeId(source.speciesId, "unknown"),
        x: finite(source.x), y: finite(source.y),
        intensity: clamp(source.intensity == null ? 1 : source.intensity, 0, 1),
        age: 0, direction: source.direction == null ? 0 : finite(source.direction)
      };
      this.footprints.push(footprint);
      while (this.footprints.length > this.maxFootprints) this.footprints.shift();
      return clone(footprint);
    }
    addFootprint(input) { return this.leaveFootprint(input); }
    recordFootprint(input) { return this.leaveFootprint(input); }
    addScent(input = {}) {
      const source = input && typeof input === "object" ? input : {};
      const scent = {
        id: safeId(source.id, this._trailId("scent")),
        sourceId: safeId(source.sourceId || source.entityId, "unknown"),
        speciesId: safeId(source.speciesId, "unknown"),
        x: finite(source.x), y: finite(source.y),
        intensity: clamp(source.intensity == null ? 1 : source.intensity, 0, 1),
        age: 0, halfLife: clamp(source.halfLife == null ? this.scentHalfLife : source.halfLife, 0.1, 3600),
        windFactor: clamp(source.windFactor == null ? 1 : source.windFactor, 0, 4),
        kind: safeId(source.kind, "scent")
      };
      this.scents.push(scent);
      while (this.scents.length > this.maxScents) this.scents.shift();
      return clone(scent);
    }
    depositScent(input) { return this.addScent(input); }
    recordScent(input) { return this.addScent(input); }
    update(delta, wind) {
      const dt = clamp(delta, 0, 3600);
      if (wind) this.setWind(wind);
      const decay = (age, halfLife) => Math.pow(0.5, age / Math.max(0.1, halfLife));
      this.footprints.forEach((trail) => {
        trail.age += dt;
        trail.intensity *= decay(dt, this.footprintHalfLife);
      });
      this.scents.forEach((trail) => {
        trail.age += dt;
        trail.x += this.wind.x * this.wind.speed * trail.windFactor * dt;
        trail.y += this.wind.y * this.wind.speed * trail.windFactor * dt;
        trail.intensity *= decay(dt, trail.halfLife);
      });
      const before = this.footprints.length + this.scents.length;
      this.footprints = this.footprints.filter((trail) => trail.intensity > 0.01 && trail.age < this.footprintHalfLife * 8);
      this.scents = this.scents.filter((trail) => trail.intensity > 0.01 && trail.age < trail.halfLife * 8);
      return { removed: before - this.footprints.length - this.scents.length, wind: clone(this.wind) };
    }
    decay(delta) { return this.update(delta); }
    queryFootprints(x, y, radius = 64, filter = {}) {
      if (x && typeof x === "object") { filter = radius && typeof radius === "object" ? radius : filter; radius = y == null ? 64 : y; y = x.y; x = x.x; }
      filter = objectOrEmpty(filter);
      const result = this.footprints.filter((trail) => distanceSquared(trail, { x, y }) <= radius * radius && (!filter.speciesId || trail.speciesId === filter.speciesId) && (!filter.sourceId || trail.sourceId === filter.sourceId));
      return result.sort((a, b) => b.intensity - a.intensity || a.id.localeCompare(b.id)).map(clone);
    }
    queryScent(x, y, radius = 128, filter = {}) {
      if (x && typeof x === "object") { filter = radius && typeof radius === "object" ? radius : filter; radius = y == null ? 128 : y; y = x.y; x = x.x; }
      filter = objectOrEmpty(filter);
      const result = this.scents.filter((trail) => distanceSquared(trail, { x, y }) <= radius * radius && (!filter.speciesId || trail.speciesId === filter.speciesId) && (!filter.kind || trail.kind === filter.kind));
      return result.sort((a, b) => b.intensity - a.intensity || a.id.localeCompare(b.id)).map(clone);
    }
    sample(x, y, radius = 128, filter = {}) {
      const footprints = this.queryFootprints(x, y, radius, filter);
      const scents = this.queryScent(x, y, radius, filter);
      return { footprints, scents, intensity: clamp(footprints.reduce((sum, row) => sum + row.intensity, 0) + scents.reduce((sum, row) => sum + row.intensity, 0), 0, 1) };
    }
    scentAt(x, y, radius, filter) { return this.queryScent(x, y, radius, filter); }
    footprintAt(x, y, radius, filter) { return this.queryFootprints(x, y, radius, filter); }
    snapshot() { return { wind: clone(this.wind), footprints: this.footprints.map(clone), scents: this.scents.map(clone), sequence: this.sequence }; }
    getState() { return this.snapshot(); }
    clear() { this.footprints = []; this.scents = []; this.sequence = 0; return this; }
    advance(delta, wind) { return this.update(delta, wind); }
  }

  class HazardSystem {
    constructor(options = {}) {
      options = objectOrEmpty(options);
      this.seed = options.seed == null ? "EON-541" : options.seed;
      this.time = 0;
      this.tide = { base: clamp(options.tideBase == null ? 0.5 : options.tideBase, 0, 1), amplitude: clamp(options.tideAmplitude == null ? 0.35 : options.tideAmplitude, 0, 1), period: clamp(options.tidePeriod == null ? 48 : options.tidePeriod, 4, 10000), phase: randomFor(this.seed, "tide-phase") * Math.PI * 2, level: 0.5 };
      this.floods = [];
      this.wildfires = [];
      this.volcanoes = [];
      this.maxEvents = Math.round(clamp(options.maxEvents == null ? 64 : options.maxEvents, 1, 256));
      Object.defineProperty(this, "tideLevel", { enumerable: true, configurable: true, get: () => this.tide.level });
      Object.defineProperties(this, {
        wildfireZones: { enumerable: false, configurable: true, get: () => this.wildfires },
        floodZones: { enumerable: false, configurable: true, get: () => this.floods },
        volcanoZones: { enumerable: false, configurable: true, get: () => this.volcanoes }
      });
    }
    setTide(options = {}) {
      this.tide.base = clamp(options.base == null ? this.tide.base : options.base, 0, 1);
      this.tide.amplitude = clamp(options.amplitude == null ? this.tide.amplitude : options.amplitude, 0, 1);
      this.tide.period = clamp(options.period == null ? this.tide.period : options.period, 4, 10000);
      if (options.phase != null) this.tide.phase = finite(options.phase, this.tide.phase);
      return this.getTide();
    }
    getTide() { return Object.assign({}, this.tide); }
    getTideLevel() { return this.tide.level; }
    _event(type, input = {}) {
      input = objectOrEmpty(input);
      return {
        id: safeId(input.id, `${type}-${hashSeed(`${this.seed}|${type}|${this.time}|${this.floods.length + this.wildfires.length + this.volcanoes.length}`)}`),
        type, x: finite(input.x), y: finite(input.y), radius: clamp(input.radius == null ? 120 : input.radius, 1, 5000),
        intensity: clamp(input.intensity == null ? 0.6 : input.intensity, 0, 1),
        remaining: clamp(input.duration == null ? 20 : input.duration, 0.1, 3600), age: 0
      };
    }
    triggerFlood(input) { const event = this._event("flood", input); this.floods.push(event); this._trim(); return clone(event); }
    igniteWildfire(input) { const event = this._event("wildfire", input); this.wildfires.push(event); this._trim(); return clone(event); }
    eruptVolcano(input) { input = objectOrEmpty(input); const event = this._event("volcano", input); event.radius = clamp(input.radius == null ? 260 : input.radius, 1, 5000); this.volcanoes.push(event); this._trim(); return clone(event); }
    trigger(type, input) {
      if (type === "flood" || type === "tide") return this.triggerFlood(input);
      if (type === "wildfire" || type === "fire") return this.igniteWildfire(input);
      if (type === "volcano" || type === "eruption") return this.eruptVolcano(input);
      return null;
    }
    triggerTide(input = {}) { return this.setTide(input); }
    flood(input) { return this.triggerFlood(input); }
    wildfire(input) { return this.igniteWildfire(input); }
    volcano(input) { return this.eruptVolcano(input); }
    updateTide(delta) { return this.update(delta).tide; }
    advance(delta, world) { return this.update(delta, world); }
    _trim() {
      [this.floods, this.wildfires, this.volcanoes].forEach((list) => { while (list.length > this.maxEvents) list.shift(); });
    }
    update(delta, world = {}) {
      const dt = clamp(delta, 0, 3600);
      this.time += dt;
      this.tide.level = clamp(this.tide.base + Math.sin((this.time / this.tide.period) * Math.PI * 2 + this.tide.phase) * this.tide.amplitude, 0, 1);
      const decayEvents = (list) => {
        list.forEach((event) => { event.age += dt; event.remaining -= dt; });
        return list.filter((event) => event.remaining > 0 && event.intensity > 0.01);
      };
      this.floods = decayEvents(this.floods);
      this.wildfires = decayEvents(this.wildfires);
      this.volcanoes = decayEvents(this.volcanoes);
      const events = [];
      if (this.tide.level > 0.88 && (Math.floor(this.time) !== Math.floor(this.time - dt))) events.push({ type: "tide", level: this.tide.level, impact: (this.tide.level - 0.88) / 0.12 });
      if (world && world.autoHazards) {
        const pulse = randomFor(this.seed, `hazard:${Math.floor(this.time / 30)}`);
        const point = { x: finite(world.x), y: finite(world.y) };
        if (pulse > 0.965 && this.floods.length < this.maxEvents && ["wetland", "ocean", "reef"].includes(world.biome)) events.push(this.triggerFlood({ x: point.x, y: point.y, duration: 16, intensity: 0.55 }));
        if (pulse > 0.978 && this.wildfires.length < this.maxEvents && ["forest", "grassland", "desert"].includes(world.biome)) events.push(this.igniteWildfire({ x: point.x, y: point.y, duration: 20, intensity: 0.6 }));
        if (pulse > 0.985 && this.volcanoes.length < this.maxEvents) events.push(this.eruptVolcano({ x: point.x, y: point.y, duration: 18, intensity: 0.7 }));
      }
      return { time: this.time, tide: this.getTide(), events, active: this.activeEvents() };
    }
    step(delta, world) { return this.update(delta, world); }
    activeEvents() { return this.floods.concat(this.wildfires, this.volcanoes).map(clone); }
    effectsAt(x, y) {
      if (x && typeof x === "object") { y = x.y; x = x.x; }
      const point = { x: finite(x), y: finite(y) };
      let flood = 0; let fire = 0; let volcano = 0;
      this.floods.forEach((event) => { if (distance(point, event) <= event.radius) flood = Math.max(flood, event.intensity * (1 - distance(point, event) / event.radius)); });
      this.wildfires.forEach((event) => { if (distance(point, event) <= event.radius) fire = Math.max(fire, event.intensity * (1 - distance(point, event) / event.radius)); });
      this.volcanoes.forEach((event) => { if (distance(point, event) <= event.radius) volcano = Math.max(volcano, event.intensity * (1 - distance(point, event) / event.radius)); });
      return { tide: this.tide.level, flood, wildfire: fire, volcano, danger: clamp(Math.max(flood, fire, volcano) + (this.tide.level > 0.85 ? 0.2 : 0), 0, 1) };
    }
    isDangerAt(x, y) { return this.effectsAt(x, y).danger > 0.2; }
    snapshot() { return { seed: this.seed, time: this.time, tide: this.getTide(), floods: this.floods.map(clone), wildfires: this.wildfires.map(clone), volcanoes: this.volcanoes.map(clone) }; }
    getState() { return this.snapshot(); }
    reset() { this.time = 0; this.tide.level = this.tide.base; this.floods = []; this.wildfires = []; this.volcanoes = []; return this; }
  }

  const CONDITION_DEFAULTS = Object.freeze({
    bleeding: 0, fractures: 0, infection: 0, disease: 0, temperatureStress: 0,
    oxygen: 1, nutritionQuality: 0.7, pain: 0, shock: 0, wetness: 0
  });
  const INJURY_TYPES = Object.freeze(["bruise", "bleeding", "fracture", "infection", "disease", "burn", "hypoxia"]);
  function normalizeCondition(entity) {
    const source = entity && typeof entity === "object" ? entity : {};
    const input = source.condition && typeof source.condition === "object" ? source.condition : source;
    const condition = {};
    Object.keys(CONDITION_DEFAULTS).forEach((key) => {
      const max = key === "oxygen" || key === "nutritionQuality" ? 1 : 100;
      condition[key] = clamp(input[key] == null ? CONDITION_DEFAULTS[key] : input[key], 0, max);
    });
    return condition;
  }
  function applyInjury(entity, injury = {}) {
    const target = entity && typeof entity === "object" ? entity : {};
    const condition = Object.assign(normalizeCondition(target), target.condition || {});
    const source = typeof injury === "string" ? { type: injury } : (injury || {});
    const type = String(source.type || source.kind || "bruise").toLowerCase();
    const severity = clamp(source.severity == null ? 0.25 : source.severity, 0, 1);
    if (type.includes("bleed") || type.includes("lacer")) condition.bleeding = clamp(condition.bleeding + severity * 100, 0, 100);
    else if (type.includes("fract") || type.includes("bone")) condition.fractures = clamp(condition.fractures + severity * 100, 0, 100);
    else if (type.includes("infect")) condition.infection = clamp(condition.infection + severity * 100, 0, 100);
    else if (type.includes("disease") || type.includes("ill")) condition.disease = clamp(condition.disease + severity * 100, 0, 100);
    else if (type.includes("burn") || type.includes("heat")) condition.temperatureStress = clamp(condition.temperatureStress + severity * 100, 0, 100);
    else if (type.includes("hypox") || type.includes("oxygen")) condition.oxygen = clamp(condition.oxygen - severity, 0, 1);
    else condition.pain = clamp(condition.pain + severity * 100, 0, 100);
    condition.pain = clamp(condition.pain + severity * 30, 0, 100);
    condition.shock = clamp(condition.shock + severity * 20, 0, 100);
    const injuryLog = Array.isArray(target.injuries) ? target.injuries.slice(-15) : [];
    injuryLog.push({ type, severity, at: finite(source.at, 0) });
    target.injuries = injuryLog;
    target.condition = condition;
    if (target.health != null) target.health = clamp(target.health - severity * (type.includes("fract") ? 8 : 3), 0, 100);
    if (target.health != null && target.health <= 0) target.alive = false;
    return target;
  }
  function updateCondition(entity, delta, environment = {}) {
    const target = entity && typeof entity === "object" ? entity : {};
    if (delta && typeof delta === "object") { environment = delta; delta = environment.dt == null ? FIXED_STEP : environment.dt; }
    const dt = clamp(delta, 0, 60);
    const condition = Object.assign(normalizeCondition(target), target.condition || {});
    const env = environment && typeof environment === "object" ? environment : {};
    const effects = env.effects || {};
    const ambient = finite(env.temperature, 0);
    const oxygenLevel = clamp(env.oxygen == null ? 1 : env.oxygen, 0, 1);
    const water = clamp(env.water == null ? 1 : env.water, 0, 1);
    const fire = clamp(effects.wildfire == null ? env.wildfire || 0 : effects.wildfire, 0, 1);
    const volcano = clamp(effects.volcano == null ? env.volcano || 0 : effects.volcano, 0, 1);
    const flood = clamp(effects.flood == null ? env.flood || 0 : effects.flood, 0, 1);
    const nutrition = clamp(env.nutritionQuality == null ? (env.dietQuality == null ? condition.nutritionQuality : env.dietQuality) : env.nutritionQuality, 0, 1);
    const preferredTemperature = finite(env.preferredTemperature, 0);
    const tempStress = clamp(Math.abs(ambient - preferredTemperature) * 100 + fire * 55 + volcano * 25, 0, 100);
    condition.temperatureStress += (tempStress - condition.temperatureStress) * clamp(dt * 0.4, 0, 1);
    condition.oxygen += (oxygenLevel - condition.oxygen) * clamp(dt * 0.9, 0, 1);
    condition.wetness += ((water < 0.4 ? 0 : flood * 100) - condition.wetness) * clamp(dt * 0.25, 0, 1);
    condition.nutritionQuality += (nutrition - condition.nutritionQuality) * clamp(dt * 0.2, 0, 1);
    condition.bleeding = clamp(condition.bleeding - dt * 1.8, 0, 100);
    condition.infection = clamp(condition.infection + (condition.bleeding > 20 ? dt * 0.18 : -dt * 0.08), 0, 100);
    condition.disease = clamp(condition.disease - dt * 0.05 + (condition.nutritionQuality < 0.3 ? dt * 0.2 : 0), 0, 100);
    condition.pain = clamp(condition.pain - dt * 2.4 + condition.bleeding * dt * 0.02, 0, 100);
    condition.shock = clamp(condition.shock - dt * 1.7 + (fire + volcano) * dt * 3, 0, 100);
    const damage = dt * (condition.bleeding * 0.012 + condition.infection * 0.004 + condition.disease * 0.003 + condition.temperatureStress * 0.006 + Math.max(0, 0.55 - condition.oxygen) * 4 + fire * 5 + volcano * 7 + flood * 0.8);
    if (target.health != null) target.health = clamp(target.health - damage, 0, 100);
    if (target.stamina != null) target.stamina = clamp(target.stamina - dt * (condition.fractures * 0.012 + condition.temperatureStress * 0.004), 0, 100);
    if (target.health != null && target.health <= 0) target.alive = false;
    target.condition = condition;
    target.conditionStatus = conditionStatus(condition, target.health);
    return target;
  }
  function conditionStatus(condition, health) {
    const source = condition || {};
    if (finite(health, 100) <= 0) return "dead";
    if (source.oxygen < 0.35) return "hypoxic";
    if (source.bleeding > 55) return "critical-bleeding";
    if (source.temperatureStress > 70) return "temperature-shock";
    if (source.fractures > 50) return "fractured";
    if (source.infection > 50 || source.disease > 50) return "sick";
    if (source.pain > 45) return "injured";
    return "stable";
  }

  class ReplayBuffer {
    constructor(limit = MAX_REPLAY_FRAMES) {
      if (limit && typeof limit === "object") limit = limit.limit;
      this.limit = Math.round(clamp(limit, 1, MAX_REPLAY_FRAMES));
      this.capacity = this.limit;
      this.buffer = new Array(this.limit);
      this.start = 0;
      this.length = 0;
      this.sequence = 0;
    }
    push(frame) {
      const item = Object.assign({}, clone(frame || {}), { sequence: this.sequence += 1 });
      const index = (this.start + this.length) % this.limit;
      this.buffer[index] = item;
      if (this.length < this.limit) this.length += 1; else this.start = (this.start + 1) % this.limit;
      return clone(item);
    }
    record(frame) { return this.push(frame); }
    at(index) {
      const position = integer(index, 0);
      if (position < 0 || position >= this.length) return undefined;
      return clone(this.buffer[(this.start + position) % this.limit]);
    }
    toArray() {
      const rows = [];
      for (let index = 0; index < this.length; index += 1) rows.push(this.buffer[(this.start + index) % this.limit]);
      return rows.map(clone);
    }
    latest() { return this.length ? this.at(this.length - 1) : null; }
    size() { return this.length; }
    get(index) { return this.at(index); }
    range(start = 0, end = this.length) { return this.toArray().slice(Math.max(0, integer(start)), Math.max(0, integer(end))); }
    clear() { this.buffer = new Array(this.limit); this.start = 0; this.length = 0; this.sequence = 0; return this; }
    snapshot() { return { limit: this.limit, length: this.length, sequence: this.sequence, frames: this.toArray() }; }
    getState() { return this.snapshot(); }
    getSnapshot() { return this.snapshot(); }
  }

  class Heatmap {
    constructor(options = {}) {
      options = objectOrEmpty(options);
      this.cellSize = clamp(options.cellSize == null ? 64 : options.cellSize, 1, 4096);
      this.maxCells = Math.round(clamp(options.maxCells == null ? MAX_HEATMAP_CELLS : options.maxCells, 1, MAX_HEATMAP_CELLS));
      this.halfLife = clamp(options.halfLife == null ? 30 : options.halfLife, 0.1, 3600);
      this.cells = new Map();
    }
    key(x, y) { return `${Math.floor(finite(x) / this.cellSize)}:${Math.floor(finite(y) / this.cellSize)}`; }
    _coords(key) { const parts = String(key).split(":"); return { x: integer(parts[0]), y: integer(parts[1]) }; }
    add(x, y, amount = 1, type = "activity") {
      if (x && typeof x === "object") { const input = x; type = input.type || type; amount = input.amount == null ? amount : input.amount; y = input.y; x = input.x; }
      const key = this.key(x, y);
      const current = this.cells.get(key) || { key, x: this._coords(key).x, y: this._coords(key).y, value: 0, types: {} };
      const normalizedType = safeId(type, "activity").slice(0, 32) || "activity";
      current.value = clamp(current.value + finite(amount), 0, 1000000);
      if (!Object.prototype.hasOwnProperty.call(current.types, normalizedType) && Object.keys(current.types).length >= 16) {
        const oldestType = Object.keys(current.types).sort((a, b) => current.types[a] - current.types[b] || a.localeCompare(b))[0];
        if (oldestType) delete current.types[oldestType];
      }
      current.types[normalizedType] = clamp((current.types[normalizedType] || 0) + finite(amount), 0, 1000000);
      this.cells.set(key, current);
      if (this.cells.size > this.maxCells) {
        const oldest = Array.from(this.cells.values()).sort((a, b) => a.value - b.value || a.key.localeCompare(b.key))[0];
        if (oldest) this.cells.delete(oldest.key);
      }
      return clone(current);
    }
    record(x, y, amount, type) { return this.add(x, y, amount, type); }
    sample(x, y, radius = 0) {
      if (x && typeof x === "object") { radius = y == null ? radius : y; y = x.y; x = x.x; }
      if (radius <= 0) { const cell = this.cells.get(this.key(x, y)); return cell ? clone(cell) : null; }
      const range = Math.ceil(radius / this.cellSize); const center = this._coords(this.key(x, y)); const rows = [];
      this.cells.forEach((cell) => { if (Math.abs(cell.x - center.x) <= range && Math.abs(cell.y - center.y) <= range) rows.push(cell); });
      return rows.sort((a, b) => b.value - a.value || a.key.localeCompare(b.key)).map(clone);
    }
    decay(delta) {
      const factor = Math.pow(0.5, clamp(delta, 0, 100) / this.halfLife);
      this.cells.forEach((cell, key) => { cell.value *= factor; Object.keys(cell.types).forEach((type) => { cell.types[type] *= factor; }); if (cell.value < 0.01) this.cells.delete(key); });
      return this;
    }
    update(delta) { return this.decay(delta); }
    size() { return this.cells.size; }
    toArray() { return Array.from(this.cells.values()).sort((a, b) => b.value - a.value || a.key.localeCompare(b.key)).map(clone); }
    getHotspots(limit = 32) { return this.toArray().slice(0, Math.max(0, Math.min(128, integer(limit, 32)))); }
    snapshot() { return { cellSize: this.cellSize, maxCells: this.maxCells, halfLife: this.halfLife, cells: this.toArray() }; }
    getState() { return this.snapshot(); }
    clear() { this.cells.clear(); return this; }
  }

  function localWorkerDispatch(command, payload, options = {}) {
    if (typeof options.handler === "function") return options.handler(command, payload);
    if (command === "ping") return { ok: true, mode: "local", command };
    if (command === "hashSeed") return hashSeed(payload);
    if (command === "generateChunk") return generateChunk(payload || {});
    throw new Error(`Unsupported local simulation command: ${String(command)}`);
  }
  function detectCapabilities(host = runtime) {
    const target = host && typeof host === "object" ? host : {};
    return {
      workerBlob: typeof target.Worker === "function" && typeof target.Blob === "function" && Boolean(target.URL && typeof target.URL.createObjectURL === "function"),
      local: true,
      deterministic: true
    };
  }
  function createWorkerAdapter(options = {}) {
    options = objectOrEmpty(options);
    const host = options.runtime || runtime || {};
    const canConstruct = !options.forceLocal && detectCapabilities(host).workerBlob;
    const base = {
      mode: "local", worker: false, local: true, fallback: true, supported: false,
      reason: "Worker adapter unavailable; using bounded local simulation.",
      capabilities: { worker: false, local: true, localFallback: true, workerCommands: [], localCommands: ["ping", "hashSeed", "generateChunk"] },
      close() { return true; }, terminate() { return this.close(); }
    };
    if (!canConstruct) {
      base.run = (command, payload) => {
        try { return Promise.resolve(localWorkerDispatch(command, payload, options)); }
        catch (error) { return Promise.reject(error); }
      };
      base.dispatch = base.run;
      base.runSync = (command, payload) => localWorkerDispatch(command, payload, options);
      return base;
    }
    let worker; let objectUrl; let sequence = 0; const pending = new Map();
    const maxPending = Math.round(clamp(options.maxPending == null ? 128 : options.maxPending, 1, 1024));
    const source = [
      "'use strict';",
      "function hash(v){var s=String(v==null?'EON-541':v),h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}",
      "self.onmessage=function(e){var m=e.data||{};try{if(m.command==='ping'){self.postMessage({id:m.id,ok:true,result:{ok:true,mode:'worker',command:'ping'}});return;}if(m.command==='hashSeed'){self.postMessage({id:m.id,ok:true,result:hash(m.payload)});return;}self.postMessage({id:m.id,ok:false,error:'Command is not available in worker adapter'});}catch(err){self.postMessage({id:m.id,ok:false,error:String(err&&err.message||err)});}};"
    ].join("\n");
    try {
      const blob = new host.Blob([source], { type: "application/javascript" });
      objectUrl = host.URL.createObjectURL(blob);
      worker = new host.Worker(objectUrl);
      worker.onmessage = (event) => {
        const message = event && event.data || {};
        const callback = pending.get(message.id);
        if (!callback) return;
        pending.delete(message.id);
        if (message.ok) callback.resolve(message.result); else callback.reject(new Error(message.error || "Worker command failed"));
      };
      worker.onerror = () => {
        pending.forEach((callback) => callback.reject(new Error("Worker command failed; local state remains available.")));
        pending.clear();
      };
    } catch (error) {
      if (objectUrl && host.URL.revokeObjectURL) host.URL.revokeObjectURL(objectUrl);
      base.reason = "Worker construction failed; using bounded local simulation.";
      base.run = (command, payload) => {
        try { return Promise.resolve(localWorkerDispatch(command, payload, options)); }
        catch (localError) { return Promise.reject(localError); }
      };
      base.dispatch = base.run;
      base.runSync = (command, payload) => localWorkerDispatch(command, payload, options);
      return base;
    }
    const adapter = {
      mode: "worker", worker: true, local: false, fallback: true, supported: true, reason: "Dedicated worker active for supported commands.",
      capabilities: { worker: true, local: true, localFallback: true, workerCommands: ["ping", "hashSeed"], localCommands: ["generateChunk"] },
      run(command, payload) {
        if (!["ping", "hashSeed"].includes(String(command))) {
          try { return Promise.resolve(localWorkerDispatch(command, payload, options)); }
          catch (error) { return Promise.reject(error); }
        }
        return new Promise((resolve, reject) => {
          if (pending.size >= maxPending) { reject(new Error("Worker adapter queue is full; local state remains bounded.")); return; }
          const id = `request-${sequence += 1}`;
          pending.set(id, { resolve, reject });
          try { worker.postMessage({ id, command: String(command), payload: clone(payload) }); }
          catch (error) { pending.delete(id); reject(error); }
        });
      },
      dispatch(command, payload) { return this.run(command, payload); },
      runSync() { throw new Error("Worker adapter is asynchronous; use run()."); },
      close() {
        pending.forEach((callback) => callback.reject(new Error("Worker adapter closed.")));
        pending.clear();
        if (worker && typeof worker.terminate === "function") worker.terminate();
        if (objectUrl && host.URL.revokeObjectURL) host.URL.revokeObjectURL(objectUrl);
        return true;
      },
      terminate() { return this.close(); }
    };
    return adapter;
  }

  function normalizeSimulationOptions(options = {}) {
    const source = options && typeof options === "object" ? options : {};
    return {
      seed: source.seed == null ? "EON-541" : source.seed,
      realm: normalizeRealm(source.realm),
      allowCrossRealm: source.allowCrossRealm === true || source.convergence === true,
      chunkSize: clamp(source.chunkSize == null ? CHUNK_SIZE : source.chunkSize, 16, 4096),
      viewRadius: Math.round(clamp(source.viewRadius == null ? 2 : source.viewRadius, 0, 8)),
      maxChunks: Math.round(clamp(source.maxChunks == null ? MAX_CHUNKS : source.maxChunks, 1, MAX_CHUNKS)),
      maxEntities: Math.round(clamp(source.maxEntities == null ? MAX_ENTITIES : source.maxEntities, 1, MAX_ENTITIES)),
      fixedStep: clamp(source.fixedStep == null ? (source.fixedDelta == null ? (source.fixedDt == null ? FIXED_STEP : source.fixedDt) : source.fixedDelta) : source.fixedStep, 1 / 240, 0.25),
      maxStepsPerTick: Math.round(clamp(source.maxStepsPerTick == null ? MAX_STEPS_PER_TICK : source.maxStepsPerTick, 1, 32)),
      apexCap: Math.round(clamp(source.apexCap == null ? 3 : source.apexCap, 0, 32)),
      trails: source.trails && typeof source.trails === "object" ? clone(source.trails) : {},
      hazards: source.hazards && typeof source.hazards === "object" ? clone(source.hazards) : {},
      initialEntities: Array.isArray(source.entities) ? source.entities.slice(0, MAX_ENTITIES).map(clone) : []
    };
  }

  function actionDirection(entity, action, context, seed) {
    const target = context && context.target && typeof context.target === "object" ? context.target : null;
    let dx = 0; let dy = 0;
    if (target) { dx = finite(target.x) - entity.x; dy = finite(target.y) - entity.y; }
    if (action === "flee") { dx = -dx; dy = -dy; }
    if (action === "migrate" || (!target && ["hunt", "drink", "feed"].includes(action))) {
      const angle = randomFor(seed, `${entity.id}|${action}|${context && context.tick || 0}`) * Math.PI * 2;
      dx = Math.cos(angle); dy = Math.sin(angle);
    }
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 0.0001) return { x: 0, y: 0 };
    return { x: dx / length, y: dy / length };
  }

  class Simulation {
    constructor(options = {}) {
      this.options = normalizeSimulationOptions(options);
      this.seed = this.options.seed;
      this.realm = this.options.realm;
      this.chunks = new Map();
      this.loadedChunkIds = new Set();
      this.visibleIds = new Set();
      this.streamedIds = this.loadedChunkIds;
      this.entities = new Map();
      try {
        Object.defineProperty(this.chunks, "length", { enumerable: false, get: () => this.chunks.size });
        Object.defineProperty(this.entities, "length", { enumerable: false, get: () => this.entities.size });
        Object.defineProperty(this.loadedChunkIds, "length", { enumerable: false, get: () => this.loadedChunkIds.size });
        Object.defineProperty(this.visibleIds, "length", { enumerable: false, get: () => this.visibleIds.size });
      } catch (_) { /* Native collections remain the source of truth. */ }
      this.spatialHash = new SpatialHash(Math.max(16, this.options.chunkSize / 4), { maxEntries: this.options.maxEntities });
      this.ledger = new BiomassLedger({ apexCap: this.options.apexCap, maxPopulation: this.options.maxEntities });
      this.ai = new UtilityAI({ seed: this.seed });
      this.trails = new TrailSystem(this.options.trails);
      this.hazards = new HazardSystem(Object.assign({}, this.options.hazards, { seed: this.seed }));
      this.replay = new ReplayBuffer(MAX_REPLAY_FRAMES);
      this.heatmap = new Heatmap();
      this.clock = new FixedTimestep({ step: this.options.fixedStep, maxSteps: this.options.maxStepsPerTick });
      this.fixed = this.clock;
      this.spatial = this.spatialHash;
      this.biomass = this.ledger;
      this.trail = this.trails;
      this.hazard = this.hazards;
      this.replayBuffer = this.replay;
      this.workerAdapter = null;
      this.time = 0;
      this.stepCount = 0;
      this.lastStreamCenter = { x: 0, y: 0 };
      this.initialEntities = this.options.initialEntities.map(clone);
      Object.defineProperty(this, "state", { enumerable: false, configurable: true, get: () => this.getState() });
      this.reset();
    }
    generateChunk(input, y, extra) {
      const source = input && typeof input === "object"
        ? Object.assign({}, input, { seed: input.seed == null ? this.seed : input.seed, realm: input.realm == null ? this.realm : input.realm, chunkSize: this.options.chunkSize })
        : Object.assign({}, extra || {}, { seed: this.seed, cx: input, cy: y, realm: this.realm, chunkSize: this.options.chunkSize });
      const chunk = generateChunk(source);
      this.chunks.set(chunk.id, chunk);
      this._trimChunks();
      return clone(chunk);
    }
    getChunk(idOrX, y) {
      const id = typeof idOrX === "string" ? idOrX : chunkId(idOrX, y, this.realm, this.options.chunkSize);
      return this.chunks.has(id) ? clone(this.chunks.get(id)) : null;
    }
    unloadChunk(id) { const key = String(id); this.loadedChunkIds.delete(key); return this.chunks.delete(key); }
    clearChunks() { this.chunks.clear(); this.loadedChunkIds.clear(); this.visibleIds.clear(); return this; }
    getLoadedChunkIds() { return Array.from(this.loadedChunkIds).sort(); }
    visibleChunkSet(center, radius = this.options.viewRadius) {
      const ids = visibleChunkSet(center, radius, { realm: this.realm, chunkSize: this.options.chunkSize });
      this.visibleIds = new Set(ids);
      try { Object.defineProperty(this.visibleIds, "length", { enumerable: false, get: () => this.visibleIds.size }); } catch (_) { /* optional convenience */ }
      return ids;
    }
    getVisibleSet(center, radius) { return this.visibleChunkSet(center, radius); }
    getVisibleChunkIds(center, radius) { return Array.from(this.visibleChunkSet(center, radius)); }
    visibleChunks(center, radius) { return this.getVisibleChunks(center, radius); }
    getVisibleChunks(center = this.lastStreamCenter, radius = this.options.viewRadius) {
      return this.getVisibleChunkIds(center, radius).map((id) => parseChunkId(id));
    }
    streamChunks(center = this.lastStreamCenter, radius = this.options.viewRadius) {
      const visibleIds = this.visibleChunkSet(center, radius);
      const ids = new Set(Array.from(visibleIds).slice(0, this.options.maxChunks));
      this.lastStreamCenter = center && (center.cx != null || center.cy != null)
        ? normalizeChunkCoordinates(center, undefined, this.options.chunkSize)
        : (center && (center.world === true || center.coordinateSpace === "world") ? normalizeChunkCoordinates(center, undefined, this.options.chunkSize) : { x: integer(center && center.x, 0), y: integer(center && center.y, 0) });
      const chunks = [];
      const beforeIds = new Set(this.loadedChunkIds);
      ids.forEach((id) => {
        const parsed = parseChunkId(id);
        const chunk = this.chunks.get(id) || generateChunk({ seed: this.seed, realm: this.realm, cx: parsed.x, cy: parsed.y, chunkSize: this.options.chunkSize });
        this.chunks.set(id, chunk); this.loadedChunkIds.add(id); chunks.push(clone(chunk));
      });
      this._trimChunks(this.lastStreamCenter, ids);
      const added = Array.from(ids).filter((id) => !beforeIds.has(id));
      const removed = Array.from(beforeIds).filter((id) => !this.loadedChunkIds.has(id));
      try {
        Object.defineProperties(chunks, {
          ids: { enumerable: false, value: Array.from(ids) },
          added: { enumerable: false, value: added },
          removed: { enumerable: false, value: removed }
        });
      } catch (_) { /* Array result remains the portable contract. */ }
      return chunks;
    }
    stream(center, radius) { return this.streamChunks(center, radius); }
    streamVisible(center, radius) { return this.streamChunks(center, radius); }
    streamSet(center, radius) { this.streamChunks(center, radius); return new Set(this.loadedChunkIds); }
    getStreamSet(center, radius) { return this.streamSet(center, radius); }
    streamInfo(center, radius) { const chunks = this.streamChunks(center, radius); return { chunks, ids: chunks.ids || chunks.map((chunk) => chunk.id), added: chunks.added || [], removed: chunks.removed || [] }; }
    _trimChunks(center = this.lastStreamCenter, keep = new Set()) {
      while (this.chunks.size > this.options.maxChunks) {
        const candidates = Array.from(this.chunks.values()).filter((chunk) => !keep.has(chunk.id));
        if (!candidates.length) break;
        candidates.sort((a, b) => {
          const da = (a.cx - finite(center.x)) ** 2 + (a.cy - finite(center.y)) ** 2;
          const db = (b.cx - finite(center.x)) ** 2 + (b.cy - finite(center.y)) ** 2;
          return db - da || b.id.localeCompare(a.id);
        });
        const remove = candidates[0]; this.chunks.delete(remove.id); this.loadedChunkIds.delete(remove.id);
      }
    }
    addEntity(input = {}) {
      if (this.entities.size >= this.options.maxEntities) return null;
      const raw = normalizeAgent(input);
      if (input.x == null && input.y == null) {
        const random = seededRandom(`${this.seed}|entity|${raw.id}`); raw.x = (random() - 0.5) * this.options.chunkSize * 2; raw.y = (random() - 0.5) * this.options.chunkSize * 2;
      }
      raw.x = clamp(raw.x, -WORLD_LIMIT, WORLD_LIMIT); raw.y = clamp(raw.y, -WORLD_LIMIT, WORLD_LIMIT);
      if (this.entities.has(raw.id)) return clone(this.entities.get(raw.id));
      raw.chunkId = chunkId({ x: raw.x, y: raw.y, world: true, realm: this.realm }, undefined, this.realm, this.options.chunkSize);
      const chunk = this.chunks.get(raw.chunkId) || this.generateChunk(parseChunkId(raw.chunkId).x, parseChunkId(raw.chunkId).y);
      const species = speciesRecord(raw.speciesId);
      if (!isSpeciesAllowedInRealm(this.realm, species, { convergence: this.options.allowCrossRealm === true || input.convergence === true })) return null;
      const biome = chunk.biome;
      const accepted = this.ledger.recordBirth(species, biome, 1, { location: raw.chunkId });
      if (!accepted && input.force !== true) return null;
      raw.condition = normalizeCondition(raw);
      raw.alive = raw.alive !== false && raw.health > 0;
      this.entities.set(raw.id, raw);
      this.spatialHash.insert(raw.id, raw.x, raw.y, raw);
      return clone(raw);
    }
    spawn(input) { return this.addEntity(input); }
    addWildlife(input) { return this.addEntity(input); }
    removeEntity(id, reason = "removed") {
      const key = String(id); const entity = this.entities.get(key);
      if (!entity) return false;
      const chunk = this.chunks.get(entity.chunkId);
      this.ledger.recordDeath(entity.speciesId, chunk ? chunk.biome : "grassland", 1, { location: entity.chunkId || "global" });
      this.entities.delete(key); this.spatialHash.remove(key);
      this.replay.record({ time: this.time, type: "entity-removed", entityId: key, reason });
      return true;
    }
    getEntity(id) { const entity = this.entities.get(String(id)); return entity ? clone(entity) : null; }
    getEntities() { return Array.from(this.entities.values()).sort((a, b) => a.id.localeCompare(b.id)).map(clone); }
    damageEntity(id, amount = 0, injury) {
      const key = String(id);
      const entity = this.entities.get(key);
      if (!entity) return null;
      entity.health = clamp(entity.health - clamp(amount, 0, 1000), 0, 100);
      if (injury) applyInjury(entity, injury);
      if (entity.health <= 0 || entity.alive === false) { this.removeEntity(key, "injury"); return { id: key, alive: false, health: 0 }; }
      this.spatialHash.update(entity.id, entity.x, entity.y, entity);
      this.replay.record({ time: this.time, type: "entity-injured", entityId: key, health: entity.health });
      return clone(entity);
    }
    queryNearby(x, y, radius = 128) { return this.spatialHash.query(x, y, radius).map(clone); }
    scoreAction(entityOrId, context = {}) {
      const entity = typeof entityOrId === "string" ? this.entities.get(entityOrId) : entityOrId;
      return utilityScores(entity || {}, context, this.seed);
    }
    chooseAction(entityOrId, context = {}) {
      const entity = typeof entityOrId === "string" ? this.entities.get(entityOrId) : entityOrId;
      return chooseUtilityAction(entity || {}, context, this.seed);
    }
    utilityScore(action, entityOrId, context = {}) { return this.scoreAction(entityOrId, context)[action] || 0; }
    performAction(entityOrId, action, dt = this.clock.stepSize) {
      const entity = typeof entityOrId === "string" ? this.entities.get(entityOrId) : entityOrId;
      if (!entity || !ACTIONS.includes(action)) return false;
      const context = this._contextFor(entity);
      context.target = action === "hunt" ? context.preyTarget : action === "mate" ? context.mateTarget : ["flee", "guardNest"].includes(action) ? context.threatTarget : context.target;
      entity.action = action;
      this._applyAction(entity, action, context, clamp(dt, 0, this.clock.stepSize));
      this._moveEntity(entity, action, context, clamp(dt, 0, this.clock.stepSize));
      this.spatialHash.update(entity.id, entity.x, entity.y, entity);
      return clone(entity);
    }
    getHeatmap() { return this.heatmap.snapshot(); }
    getReplay() { return this.replay.toArray(); }
    recordReplay(frame) { return this.replay.record(frame); }
    _contextFor(entity) {
      const chunk = this.chunks.get(entity.chunkId) || this.generateChunk(parseChunkId(entity.chunkId).x, parseChunkId(entity.chunkId).y);
      const neighbors = this.spatialHash.query(entity.x, entity.y, 180).filter((row) => row && row.id !== entity.id);
      const nearestOf = (rows) => rows.slice().sort((a, b) => distanceSquared(entity, a) - distanceSquared(entity, b) || a.id.localeCompare(b.id))[0] || null;
      const ownSpecies = speciesRecord(entity.speciesId);
      const preyTarget = nearestOf(neighbors.filter((row) => {
        if (!canHuntDiet(entity.diet) || row.speciesId === entity.speciesId || row.alive === false) return false;
        const candidate = speciesRecord(row.speciesId);
        return candidate.mass <= ownSpecies.mass * 1.6 || ownSpecies.apex;
      }));
      const mateTarget = nearestOf(neighbors.filter((row) => row.alive !== false && row.speciesId === entity.speciesId && row.sex !== entity.sex && row.maturity >= .75 && Number(row.reproductionCooldown || 0) <= 0));
      const threatTarget = nearestOf(neighbors.filter((row) => {
        const candidate = speciesRecord(row.speciesId);
        return row.alive !== false && row.speciesId !== entity.speciesId && (candidate.apex || candidate.mass > ownSpecies.mass * 1.35);
      }));
      const nearest = nearestOf(neighbors);
      const effects = this.hazards.effectsAt(entity.x, entity.y);
      const targetShape = (row) => row ? { id: row.id, x: row.x, y: row.y, speciesId: row.speciesId, mass: speciesRecord(row.speciesId).mass } : null;
      return {
        tick: this.stepCount, biome: chunk.biome, resources: chunk.resources, water: chunk.resources.filter((row) => row.type === "water").length / 4,
        vegetation: chunk.resources.filter((row) => row.type === "plant").length / 4, prey: neighbors.filter((row) => row.id === preyTarget?.id).length / 4,
        threat: effects.danger + (threatTarget ? 0.45 : 0), effects,
        target: targetShape(nearest), preyTarget: targetShape(preyTarget), mateTarget: targetShape(mateTarget), threatTarget: targetShape(threatTarget), mateAvailable: Boolean(mateTarget),
        scarcity: clamp((entity.hunger < 30 ? 0.45 : 0) + (entity.thirst < 30 ? 0.35 : 0) + (canHuntDiet(entity.diet) && !preyTarget ? .35 : 0), 0, 1),
        climateStress: Math.abs(chunk.climate.temperature) * 0.35 + effects.danger * 0.65,
        seasonBreeding: 0.5 + Math.sin(this.time / 45) * 0.5, nestThreat: effects.danger + (entity.nest && threatTarget ? .45 : 0),
        maturity: entity.maturity
      };
    }
    _moveEntity(entity, action, context, dt) {
      const species = speciesRecord(entity.speciesId);
      const direction = actionDirection(entity, action, context, this.seed);
      const mateDistance = context?.mateTarget ? distance(entity, context.mateTarget) : Infinity;
      const speedFactor = action === "flee" ? 1.25 : action === "mate" ? (mateDistance > 28 ? .4 : 0) : action === "rest" || action === "guardNest" ? 0 : 0.65;
      const speed = finite(species.speed, 1) * speedFactor;
      const before = { x: entity.x, y: entity.y };
      entity.x = clamp(entity.x + direction.x * speed * dt, -WORLD_LIMIT, WORLD_LIMIT);
      entity.y = clamp(entity.y + direction.y * speed * dt, -WORLD_LIMIT, WORLD_LIMIT);
      if (Math.abs(entity.x - before.x) + Math.abs(entity.y - before.y) > 0.01) {
        const intensity = clamp(speed / 40, 0.1, 1);
        this.trails.leaveFootprint({ sourceId: entity.id, speciesId: entity.speciesId, x: entity.x, y: entity.y, intensity });
        this.trails.addScent({ sourceId: entity.id, speciesId: entity.speciesId, x: entity.x, y: entity.y, intensity: intensity * 0.75 });
      }
      return { x: entity.x - before.x, y: entity.y - before.y };
    }
    _applyAction(entity, action, context, dt) {
      entity.reproductionCooldown = Math.max(0, Number(entity.reproductionCooldown || 0) - dt);
      if (action === "drink") entity.thirst = clamp(entity.thirst + dt * 28, 0, 100);
      if (action === "feed") entity.hunger = clamp(entity.hunger + dt * 23, 0, 100);
      if (action === "hunt" && context.preyTarget?.id) {
        const prey = this.entities.get(String(context.preyTarget.id));
        if (prey?.alive && distance(entity, prey) <= Math.max(10, Math.min(42, 9 + Math.log10(speciesRecord(entity.speciesId).mass + 1) * 7))) {
          const hunter = speciesRecord(entity.speciesId); const targetSpecies = speciesRecord(prey.speciesId);
          const damage = clamp((Math.pow(Math.max(.01, hunter.mass) / Math.max(.01, targetSpecies.mass), .22) * 12 + hunter.speed * 2.4) * dt, .05, 18);
          prey.health = clamp(prey.health - damage, 0, 100);
          prey.condition = normalizeCondition(prey);
          prey.condition.bleeding = clamp(prey.condition.bleeding + damage * .035, 0, 1);
          entity.hunger = clamp(entity.hunger + damage * .08, 0, 100);
          this.replay.record({ time: this.time, type: "predation-hit", entityId: entity.id, targetId: prey.id, damage: Math.round(damage * 100) / 100 });
          if (!prey.health) {
            entity.hunger = clamp(entity.hunger + 24, 0, 100);
            this.removeEntity(prey.id, "predation");
          }
        }
      }
      if (action === "rest") entity.stamina = clamp(entity.stamina + dt * 24, 0, 100);
      if (action === "migrate") entity.stamina = clamp(entity.stamina - dt * 4, 0, 100);
      if (action === "hunt" || action === "migrate" || action === "flee") entity.stamina = clamp(entity.stamina - dt * 5, 0, 100);
      if (action === "mate" && entity.maturity > .75 && entity.reproductionCooldown <= 0 && context.mateTarget?.id) {
        const partner = this.entities.get(String(context.mateTarget.id));
        if (partner?.alive && partner.reproductionCooldown <= 0 && partner.maturity > .75 && distance(entity, partner) <= 28) {
          entity.reproductionProgress = clamp(Number(entity.reproductionProgress || 0) + dt / 5, 0, 1);
          partner.reproductionProgress = clamp(Number(partner.reproductionProgress || 0) + dt / 5, 0, 1);
          if (entity.reproductionProgress >= 1 || partner.reproductionProgress >= 1) {
            const parentIds = [entity.id, partner.id].sort();
            const childId = `${entity.speciesId}-offspring-${this.stepCount}-${hashSeed(`${this.seed}|${parentIds.join("|")}|${this.stepCount}`)}`;
            const child = this.addEntity({
              id: childId, speciesId: entity.speciesId, x: (entity.x + partner.x) / 2, y: (entity.y + partner.y) / 2,
              sex: hashSeed(childId) % 2 ? "female" : "male", age: 0, maturity: 0, health: 100, stamina: 72, hunger: 74, thirst: 76,
              generation: Math.max(Number(entity.generation || 1), Number(partner.generation || 1)) + 1, parentIds,
              nest: { x: (entity.x + partner.x) / 2, y: (entity.y + partner.y) / 2 }
            });
            if (child) {
              entity.lineage += 1; partner.lineage += 1; entity.reproductionProgress = 0; partner.reproductionProgress = 0;
              entity.reproductionCooldown = 60; partner.reproductionCooldown = 60;
              entity.nest = clone(child.nest); partner.nest = clone(child.nest);
              this.replay.record({ time: this.time, type: "offspring-born", entityId: child.id, parentIds });
            } else { entity.reproductionProgress = .8; partner.reproductionProgress = .8; }
          }
        }
      }
      if (action === "guardNest" && entity.nest) {
        const threat = context.threatTarget?.id ? this.entities.get(String(context.threatTarget.id)) : null;
        if (threat?.alive && distance(entity.nest, threat) <= 72 && distance(entity, threat) <= 38) {
          const damage = clamp(dt * (5 + speciesRecord(entity.speciesId).speed * 1.8), .02, 8);
          threat.health = clamp(threat.health - damage, 0, 100);
          if (!threat.health) this.removeEntity(threat.id, "nest-defense");
        } else entity.stamina = clamp(entity.stamina + dt * 5, 0, 100);
      }
      entity.hunger = clamp(entity.hunger - dt * 1.2, 0, 100);
      entity.thirst = clamp(entity.thirst - dt * 1.65, 0, 100);
      entity.age = clamp(entity.age + dt / 3600, 0, 1);
      entity.maturity = clamp(entity.maturity + dt / 7200, 0, 1);
      entity.energy = clamp(entity.stamina / 100, 0, 1);
    }
    stepFixed(dt = this.clock.stepSize, internal = false) {
      const delta = clamp(dt, this.clock.stepSize, this.clock.stepSize);
      const hazardState = this.hazards.update(delta, { autoHazards: false });
      this.trails.update(delta);
      this.heatmap.decay(delta);
      const deaths = [];
      const ids = Array.from(this.entities.keys()).sort();
      ids.forEach((id) => {
        const entity = this.entities.get(id);
        if (!entity || !entity.alive) { deaths.push(id); return; }
        const context = this._contextFor(entity);
        const decision = this.ai.choose(entity, context);
        entity.action = decision.action;
        context.target = decision.action === "hunt" ? context.preyTarget : decision.action === "mate" ? context.mateTarget : ["flee", "guardNest"].includes(decision.action) ? context.threatTarget : context.target;
        this._applyAction(entity, decision.action, context, delta);
        this._moveEntity(entity, decision.action, context, delta);
        updateCondition(entity, delta, { effects: this.hazards.effectsAt(entity.x, entity.y), oxygen: 1, water: context.water, temperature: this.chunks.get(entity.chunkId)?.climate.temperature || 0 });
        const nextChunkId = chunkId({ x: entity.x, y: entity.y, world: true, realm: this.realm }, undefined, this.realm, this.options.chunkSize);
        if (nextChunkId !== entity.chunkId) {
          const oldChunkId = entity.chunkId;
          const oldCoordinates = parseChunkId(oldChunkId);
          const oldChunk = this.chunks.get(oldChunkId) || this.generateChunk(oldCoordinates.x, oldCoordinates.y);
          const nextCoordinates = parseChunkId(nextChunkId);
          const nextChunk = this.chunks.get(nextChunkId) || this.generateChunk(nextCoordinates.x, nextCoordinates.y);
          const removed = this.ledger.recordDeath(entity.speciesId, oldChunk.biome, 1, { location: oldChunkId });
          const added = this.ledger.recordBirth(entity.speciesId, nextChunk.biome, 1, { location: nextChunkId });
          if (added) entity.chunkId = nextChunkId;
          else if (removed) this.ledger.recordBirth(entity.speciesId, oldChunk.biome, removed, { location: oldChunkId });
        }
        this.spatialHash.update(entity.id, entity.x, entity.y, entity);
        this.heatmap.add(entity.x, entity.y, 1, decision.action);
        if (entity.health <= 0 || entity.conditionStatus === "dead") deaths.push(id);
      });
      deaths.forEach((id) => this.removeEntity(id, "condition"));
      this.time += delta; this.stepCount += 1;
      const frame = {
        time: this.time, step: this.stepCount, tide: hazardState.tide.level,
        events: hazardState.events.map(clone), actions: ids.slice(0, 64).map((id) => { const e = this.entities.get(id); return e ? { id, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, action: e.action, health: Math.round(e.health * 10) / 10 } : null; }).filter(Boolean)
      };
      this.replay.record(frame);
      return internal ? { time: this.time, step: this.stepCount, entityCount: this.entities.size, frame: clone(frame) } : this.getState();
    }
    step(dt) { return this.stepFixed(dt == null ? this.clock.stepSize : dt); }
    tick(delta) { return this.clock.advance(delta, (dt) => this.stepFixed(dt, true)); }
    advance(delta) { return this.tick(delta); }
    update(delta) { return this.tick(delta); }
    advanceTime(delta) { return this.tick(delta); }
    runSteps(count = 1) { const total = Math.round(clamp(count, 0, this.options.maxStepsPerTick * 1000)); for (let index = 0; index < total; index += 1) this.stepFixed(this.clock.stepSize, true); return this.getState(); }
    snapshot() { return this.getState(); }
    getState() {
      return {
        format: FORMAT, version: VERSION, seed: this.seed, realm: this.realm,
        time: this.time, step: this.stepCount,
        options: clone(this.options), visibleChunkIds: Array.from(this.visibleIds).sort(), streamedChunkIds: Array.from(this.loadedChunkIds).sort(),
        entities: this.getEntities(), chunks: Array.from(this.chunks.values()).sort((a, b) => a.id.localeCompare(b.id)).map(clone),
        ledger: this.ledger.snapshot(), hazards: this.hazards.snapshot(), trails: this.trails.snapshot(), replay: this.replay.snapshot(), heatmap: this.heatmap.snapshot()
      };
    }
    reset() {
      this.chunks.clear(); this.loadedChunkIds.clear(); this.visibleIds.clear(); this.entities.clear(); this.spatialHash.clear(); this.ledger = new BiomassLedger({ apexCap: this.options.apexCap, maxPopulation: this.options.maxEntities });
      this.biomass = this.ledger;
      this.trails.clear(); this.hazards.reset(); this.replay.clear(); this.heatmap.clear(); this.clock.reset(); this.time = 0; this.stepCount = 0;
      this.initialEntities.forEach((entity) => this.addEntity(entity));
      if (!this.initialEntities.length) this.streamChunks({ x: 0, y: 0 }, this.options.viewRadius);
      return this.getState();
    }
    createWorkerAdapter(options) { this.workerAdapter = createWorkerAdapter(Object.assign({ runtime }, options || {})); return this.workerAdapter; }
    dispose() { if (this.workerAdapter && typeof this.workerAdapter.close === "function") this.workerAdapter.close(); this.workerAdapter = null; this.chunks.clear(); this.entities.clear(); this.spatialHash.clear(); this.trails.clear(); this.replay.clear(); this.heatmap.clear(); return true; }
    destroy() { return this.dispose(); }
  }

  function createSimulation(options) { return new Simulation(options || {}); }
  function createDefaultSimulation(options) { return createSimulation(options || {}); }
  function createEngine(options) { return createSimulation(options); }
  function createEonWildSimulation(options) { return createSimulation(options); }
  function addFootprint(systemOrInput, input) {
    const system = systemOrInput instanceof TrailSystem ? systemOrInput : new TrailSystem();
    return systemOrInput instanceof TrailSystem ? system.leaveFootprint(input) : system.leaveFootprint(systemOrInput);
  }
  function addScent(systemOrInput, input) {
    const system = systemOrInput instanceof TrailSystem ? systemOrInput : new TrailSystem();
    return systemOrInput instanceof TrailSystem ? system.addScent(input) : system.addScent(systemOrInput);
  }
  function updateHazards(system, delta, world) {
    if (typeof system === "number") return new HazardSystem().update(system, delta);
    return system instanceof HazardSystem ? system.update(delta, world) : new HazardSystem(system || {}).update(delta, world);
  }
  function createReplay(limit) { return new ReplayBuffer(limit); }
  function createRingBuffer(limit) { return new ReplayBuffer(limit); }
  function scoreUtility(first, second, third, fourth) {
    if (typeof first === "string") return utilityScores(second || {}, third || {}, fourth)[first] || 0;
    return utilityScores(first || {}, second || {}, third)[String(fourth || "rest")] || 0;
  }
  function streamChunks(seedOrOptions, center, radius, options) {
    let source = seedOrOptions && typeof seedOrOptions === "object" ? Object.assign({}, seedOrOptions) : Object.assign({}, options || {}, { seed: seedOrOptions });
    let selectedCenter = center || source.center || { cx: 0, cy: 0 };
    let selectedRadius = radius == null ? source.radius : radius;
    if (seedOrOptions && typeof seedOrOptions === "object" && center != null && typeof center === "number") {
      selectedCenter = seedOrOptions.center || seedOrOptions;
      selectedRadius = center;
      if (radius && typeof radius === "object") source = Object.assign({}, radius, source);
    }
    const ids = visibleChunkSet(selectedCenter, selectedRadius == null ? 1 : selectedRadius, { realm: source.realm, chunkSize: source.chunkSize });
    const chunks = Array.from(ids, (id) => { const parsed = parseChunkId(id); return generateChunk(Object.assign({}, source, { cx: parsed.x, cy: parsed.y })); });
    try { Object.defineProperties(chunks, { ids: { enumerable: false, value: Array.from(ids) }, added: { enumerable: false, value: Array.from(ids) }, removed: { enumerable: false, value: [] } }); } catch (_) { /* array remains portable */ }
    return chunks;
  }
  function streamChunkSet(center, radius, options) { return visibleChunkSet(center, radius, options); }

  const api = {
    VERSION, version: VERSION, FORMAT, format: FORMAT, SCHEMA_VERSION: 2, FIXED_STEP, FIXED_DT: FIXED_STEP, MAX_FRAME_DELTA, MAX_STEPS_PER_TICK, LIMITS,
    ACTIONS: ACTIONS.slice(), REALMS: REALMS.slice(), ALL_REALMS: REALMS.slice(), ERA_REALM_IDS: ERA_REALMS.slice(), ERA_REALMS: ERA_REALMS.slice(), BIOMES: BIOMES.slice(), BIOME_IDS: BIOMES.slice(), BIOME_CAPACITY: Object.assign({}, BIOME_CAPACITY),
    FLAGSHIP_SPECIES: FLAGSHIP_SPECIES.map(clone), SIMULATED_SPECIES: SIMULATED_SPECIES.map(clone), CATALOG_SPECIES: SIMULATED_SPECIES.map(clone), ALL_SPECIES: Array.from(ALL_SPECIES_BY_ID.values(), clone), SPECIES: FLAGSHIP_SPECIES.map(clone),
    hashSeed, seededRandom, createSeededRandom: seededRandom, normalizeRealm, isSpeciesAllowedInRealm, speciesAllowedInRealm: isSpeciesAllowedInRealm, registerSpecies, getSpecies,
    normalizeChunkCoordinates, chunkCoordinates: normalizeChunkCoordinates, worldToChunk, toChunkCoordinates: worldToChunk, chunkId, getChunkId: chunkId, makeChunkId: chunkId, parseChunkId,
    generateChunk, createChunk: generateChunk, visibleChunkSet, getVisibleChunkSet: visibleChunkSet, visibleChunkList, getVisibleChunks: visibleChunkList, streamChunks, streamChunkSet, streamVisibleChunks: streamChunks,
    CHUNK_SIZE, MAX_CHUNKS, MAX_ENTITIES, MAX_TRAILS, MAX_REPLAY_FRAMES, MAX_HEATMAP_CELLS, MAX_DYNAMIC_SPECIES,
    PERFORMANCE: LIMITS,
    UTILITY_ACTIONS: ACTIONS.slice(),
    SpatialHash, SpatialHashGrid: SpatialHash, createSpatialHash: (cellSize, options) => new SpatialHash(cellSize, options),
    BiomassLedger, BiomassLedgerV2: BiomassLedger, createBiomassLedger: (options) => new BiomassLedger(options),
    carryingCapacity: (species, biome, context, options) => new BiomassLedger(options).getCarryingCapacity(species, biome, context),
    apexCapFor: (species, context, options) => new BiomassLedger(options).getApexCap(species, context),
    UtilityAI, UtilityDirector: UtilityAI, createUtilityAI: (options) => new UtilityAI(options), utilityScores, scoreActions: utilityScores, scoreUtility,
    chooseUtilityAction, chooseAction: chooseUtilityAction, selectAction: (agent, context, seed) => chooseUtilityAction(agent, context, seed).action,
    FixedTimestep, FixedStep: FixedTimestep, createFixedTimestep: (options) => new FixedTimestep(options), createFixedStep: (options) => new FixedTimestep(options),
    TrailSystem, FootprintScentSystem: TrailSystem, createTrailSystem: (options) => new TrailSystem(options), createFootprintSystem: (options) => new TrailSystem(options), createFootprintScentSystem: (options) => new TrailSystem(options),
    HazardSystem, HazardDirector: HazardSystem, createHazardSystem: (options) => new HazardSystem(options),
    CONDITION_DEFAULTS: clone(CONDITION_DEFAULTS), INJURY_TYPES: INJURY_TYPES.slice(), normalizeCondition, applyInjury, injure: applyInjury, updateCondition, conditionUpdate: updateCondition, updateInjury: applyInjury, conditionStatus,
    ReplayBuffer, ReplayRing: ReplayBuffer, RingBuffer: ReplayBuffer, createReplayBuffer: (limit) => new ReplayBuffer(limit), createReplay, createRingBuffer, createReplayRing: (limit) => new ReplayBuffer(limit), createReplayRingBuffer: (limit) => new ReplayBuffer(limit),
    Heatmap, HeatmapGrid: Heatmap, createHeatmap: (options) => new Heatmap(options),
    addFootprint, addScent, addTrail: addFootprint, updateHazards, detectCapabilities, createWorkerAdapter, createWorker: createWorkerAdapter, workerSupported: () => detectCapabilities().workerBlob, createSimulation, createDefaultSimulation, createEngine, createEonWildSimulation, EonWildSimulation: Simulation, Simulation
  };
  return api;
}));
