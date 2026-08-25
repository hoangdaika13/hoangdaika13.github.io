(function (root, factory) {
  "use strict";
  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHEonWildWorldAtlas = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createWorldAtlas(runtime) {
  "use strict";

  const VERSION = "1.0.0";
  const FORMAT = "hh-eonwild-world-atlas-v1";
  const PLANET_RADIUS_METERS = 6371000;
  const PLANET_CIRCUMFERENCE_METERS = Math.PI * 2 * PLANET_RADIUS_METERS;
  const SECTOR_SIZE_METERS = 1048576;
  const MAX_LOCAL_COORDINATE_METERS = SECTOR_SIZE_METERS - 0.000001;
  const CHUNK_SIZE_METERS = 256;
  const DEFAULT_REBASE_THRESHOLD_METERS = 4096;
  const MAX_STREAM_RADIUS = 8;
  const MAX_TILE_BYTES = 1024 * 1024;
  const CACHE_NAME = "hh.eonwild.world-atlas.v1";

  const freeze = (value) => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(freeze);
    return value;
  };
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, finite(value, minimum)));
  const integer = (value, fallback = 0) => Math.trunc(finite(value, fallback));
  const safeId = (value, fallback = "atlas") => String(value == null ? "" : value)
    .normalize("NFKC").replace(/[^a-z0-9_.:-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 96) || fallback;

  const REALM_META = freeze({
    paleozoic: { id: "paleozoic", label: "Đại Cổ sinh", accent: "#54e8ce" },
    mesozoic: { id: "mesozoic", label: "Đại Trung sinh", accent: "#ffb65f" },
    "ice-age": { id: "ice-age", label: "Đại Tân sinh", accent: "#c8efff" },
    modern: { id: "modern", label: "Trái Đất hiện đại", accent: "#72ef9d" },
    convergence: { id: "convergence", label: "Eon Convergence", accent: "#da83ff" }
  });

  // These records are references for the Atlas index only. No external GIS
  // tiles are fetched at runtime and the active 16 km renderer remains
  // procedural until a separately reviewed, version-pinned dataset is added.
  const SOURCE_REGISTRY = freeze({
    "ics-chart": {
      id: "ics-chart",
      title: "International Chronostratigraphic Chart",
      publisher: "International Commission on Stratigraphy",
      url: "https://stratigraphy.org/chart/",
      usage: "geological-age-boundary-reference",
      assetImported: false,
      reviewedAt: "2026-08-25"
    },
    "earthbyte-gplates": {
      id: "earthbyte-gplates",
      title: "EarthByte GPlates data and paleogeography catalog",
      publisher: "EarthByte Group, University of Sydney",
      url: "https://www.earthbyte.org/resources-page/",
      usage: "plate-reconstruction-reference",
      assetImported: false,
      reviewedAt: "2026-08-25"
    },
    "natural-earth": {
      id: "natural-earth",
      title: "Natural Earth physical map catalog",
      publisher: "Natural Earth / NACIS",
      url: "https://www.naturalearthdata.com/downloads/",
      usage: "modern-geography-reference",
      assetImported: false,
      reviewedAt: "2026-08-25"
    },
    "noaa-etopo-2022": {
      id: "noaa-etopo-2022",
      title: "ETOPO 2022 Global Relief Model",
      publisher: "NOAA National Centers for Environmental Information",
      url: "https://www.ncei.noaa.gov/products/etopo-global-relief-model",
      usage: "modern-relief-and-bathymetry-reference",
      assetImported: false,
      reviewedAt: "2026-08-25"
    }
  });

  const MAP_ROWS = [
    ["cambrian-shelf", "paleozoic", "Cambri", "541–485 triệu năm", [541, 485], "hypothesis", ["Thềm biển nông", "Rạn vi sinh", "Biển sâu thiếu oxy"]],
    ["ordovician-oceans", "paleozoic", "Ordovic", "485–444 triệu năm", [485, 444], "medium", ["Biển nhiệt đới", "Rạn san hô cổ", "Biển Gondwana"]],
    ["silurian-coasts", "paleozoic", "Silur", "444–419 triệu năm", [444, 419], "medium", ["Bờ biển Laurentia", "Đầm triều", "Biển nông Baltica"]],
    ["devonian-world", "paleozoic", "Devon", "419–359 triệu năm", [419, 359], "medium", ["Rạn biển Devon", "Cửa sông cá vây thùy", "Rừng nguyên thủy"]],
    ["carboniferous-wetlands", "paleozoic", "Carbon", "359–299 triệu năm", [359, 299], "medium", ["Đầm lầy than", "Rừng lycophyte", "Cao nguyên khô"]],
    ["permian-pangaea", "paleozoic", "Permi", "299–252 triệu năm", [299, 252], "medium", ["Nội địa Pangaea", "Dãy Ural cổ", "Biển Tethys"]],
    ["triassic-pangaea", "mesozoic", "Trias", "252–201 triệu năm", [252, 201], "medium", ["Nội địa Pangaea", "Bờ Tethys", "Thung lũng gió mùa"]],
    ["jurassic-archipelagos", "mesozoic", "Jura", "201–145 triệu năm", [201, 145], "medium", ["Rừng dương xỉ", "Quần đảo Tethys", "Đồng bằng sauropod"]],
    ["early-cretaceous", "mesozoic", "Phấn Trắng sớm", "145–100 triệu năm", [145, 100], "medium", ["Đồng bằng ngập nước", "Rừng hạt kín sớm", "Biển nội địa"]],
    ["late-cretaceous", "mesozoic", "Phấn Trắng muộn", "100–66 triệu năm", [100, 66], "high", ["Laramidia", "Châu Á cổ", "Bắc Phi sông ngòi"]],
    ["paleogene-recovery", "ice-age", "Paleogene", "66–23 triệu năm", [66, 23], "medium", ["Rừng Eocene", "Biển Tethys muộn", "Đồng bằng Oligocene"]],
    ["neogene-grasslands", "ice-age", "Neogene", "23–2,58 triệu năm", [23, 2.58], "medium", ["Đồng cỏ Miocene", "Rừng ven sông", "Bờ biển giàu dinh dưỡng"]],
    ["pleistocene-steppe", "ice-age", "Pleistocene", "2,58 triệu–11.700 năm", [2.58, 0.0117], "high", ["Mammoth Steppe", "Rừng băng hà", "Hành lang Beringia"]],
    ["last-glacial-maximum", "ice-age", "Cực đại băng hà", "26.500–19.000 năm", [0.0265, 0.019], "high", ["Chỏm băng", "Tundra khô", "Thềm lục địa lộ ra"]],
    ["modern-africa", "modern", "Châu Phi", "Hiện tại", [0, 0], "high", ["Savanna", "Rừng Congo", "Sahara", "Rift Valley"]],
    ["modern-asia", "modern", "Châu Á", "Hiện tại", [0, 0], "high", ["Rừng nhiệt đới", "Taiga", "Himalaya", "Thảo nguyên"]],
    ["modern-europe", "modern", "Châu Âu", "Hiện tại", [0, 0], "high", ["Rừng ôn đới", "Alps", "Địa Trung Hải", "Tundra"]],
    ["modern-north-america", "modern", "Bắc Mỹ", "Hiện tại", [0, 0], "high", ["Rockies", "Prairie", "Taiga", "Everglades"]],
    ["modern-south-america", "modern", "Nam Mỹ", "Hiện tại", [0, 0], "high", ["Amazon", "Andes", "Pampas", "Pantanal"]],
    ["modern-australia", "modern", "Australia", "Hiện tại", [0, 0], "high", ["Outback", "Rừng mưa Queensland", "Rạn san hô", "Rừng bạch đàn"]],
    ["modern-arctic", "modern", "Bắc Cực", "Hiện tại", [0, 0], "high", ["Băng biển", "Tundra", "Bờ đá", "Taiga cực bắc"]],
    ["modern-antarctica", "modern", "Nam Cực", "Hiện tại", [0, 0], "high", ["Thềm băng", "Biển Ross", "Núi băng", "Đảo cận Nam Cực"]],
    ["modern-pacific", "modern", "Thái Bình Dương", "Hiện tại", [0, 0], "high", ["Biển khơi", "Rạn san hô", "Rãnh sâu", "Rừng tảo bẹ"]],
    ["modern-atlantic", "modern", "Đại Tây Dương", "Hiện tại", [0, 0], "high", ["Dòng Gulf Stream", "Biển Sargasso", "Sống núi giữa đại dương", "Bờ lục địa"]],
    ["modern-indian-ocean", "modern", "Ấn Độ Dương", "Hiện tại", [0, 0], "high", ["Biển gió mùa", "Rạn Maldives", "Vực sâu Java", "Rừng ngập mặn"]],
    ["eon-convergence", "convergence", "Eon Convergence", "Sandbox hư cấu", [541, 0], "fictional", ["Giao thoa thời đại", "Phòng thử sinh khối", "Observer Lab"]]
  ];

  // Only these Atlas entries currently have a renderer time-slice with a
  // compatible active-region contract. Other entries remain selectable as
  // sourced Atlas references, but are not silently mapped onto a wrong era.
  const ACTIVE_REGION_BY_MAP = freeze({
    "cambrian-shelf": { timeSliceId: "cambrian-shelf", regionId: "cambrian-shallow-sea" },
    "devonian-world": { timeSliceId: "devonian-reef", regionId: "devonian-reef-belt" },
    "carboniferous-wetlands": { timeSliceId: "carboniferous-swamp", regionId: "carboniferous-wetland" },
    "permian-pangaea": { timeSliceId: "permian-basin", regionId: "permian-floodplain" },
    "triassic-pangaea": { timeSliceId: "triassic-valley", regionId: "triassic-rift-valley" },
    "jurassic-archipelagos": { timeSliceId: "jurassic-forest", regionId: "jurassic-conifer-basin" },
    "late-cretaceous": { timeSliceId: "cretaceous-laramidia", regionId: "late-cretaceous-floodplain" },
    "neogene-grasslands": { timeSliceId: "late-cenozoic-pampas", regionId: "south-american-grassland" },
    "pleistocene-steppe": { timeSliceId: "mammoth-steppe", regionId: "eurasian-steppe" },
    "last-glacial-maximum": { timeSliceId: "mammoth-steppe", regionId: "eurasian-steppe" },
    "modern-africa": { timeSliceId: "modern-land", regionId: "savanna" },
    "modern-asia": { timeSliceId: "modern-land", regionId: "taiga-tundra" },
    "modern-europe": { timeSliceId: "modern-land", regionId: "taiga-tundra" },
    "modern-north-america": { timeSliceId: "modern-land", regionId: "wetland" },
    "modern-south-america": { timeSliceId: "modern-land", regionId: "rainforest" },
    "modern-australia": { timeSliceId: "modern-land", regionId: "savanna" },
    "modern-arctic": { timeSliceId: "modern-land", regionId: "taiga-tundra" },
    "modern-antarctica": { timeSliceId: "modern-ocean", regionId: "polar-sea" },
    "modern-pacific": { timeSliceId: "modern-ocean", regionId: "open-ocean" },
    "modern-atlantic": { timeSliceId: "modern-ocean", regionId: "open-ocean" },
    "modern-indian-ocean": { timeSliceId: "modern-ocean", regionId: "coral-reef" }
  });

  const MAPS = freeze(MAP_ROWS.map(([id, realmId, label, range, ageMya, confidence, regions]) => {
    const fictional = confidence === "fictional";
    const modern = realmId === "modern";
    const activeRegion = ACTIVE_REGION_BY_MAP[id] || null;
    return {
      id, realmId, label, range, ageMya, confidence,
      reconstruction: fictional ? "fictional-sandbox" : "source-indexed-reference",
      evidenceStatus: fictional ? "fictional" : "reference-only-no-derived-tiles",
      confidenceScope: fictional
        ? "sandbox hư cấu; không phải tái dựng khoa học"
        : modern
          ? "khung khu vực hiện đại; địa hình gameplay vẫn procedural"
          : "niên đại và vùng sinh thái tham khảo; chưa có tile GIS tái dựng",
      sourceIds: fictional ? [] : modern ? ["natural-earth", "noaa-etopo-2022"] : ["ics-chart", "earthbyte-gplates"],
      gameplayStatus: fictional ? "fictional-sandbox" : activeRegion ? "active-region" : "atlas-reference-only",
      rendererTimeSliceId: activeRegion?.timeSliceId || null,
      rendererRegionId: activeRegion?.regionId || null,
      accent: REALM_META[realmId]?.accent || "#72ef9d",
      regions: regions.map((name, index) => ({ id: `${id}-region-${index + 1}`, name, index }))
    };
  }));
  const MAP_BY_ID = freeze(Object.fromEntries(MAPS.map((map) => [map.id, map])));

  function listMaps(filter = {}) {
    const realmId = filter && filter.realmId ? safeId(filter.realmId) : "";
    const confidence = filter && filter.confidence ? safeId(filter.confidence) : "";
    return MAPS.filter((map) => (!realmId || map.realmId === realmId) && (!confidence || map.confidence === confidence));
  }

  function getMap(mapId) {
    return MAP_BY_ID[safeId(mapId, "missing")] || null;
  }

  function defaultMapForRealm(realmId) {
    return MAPS.find((map) => map.realmId === safeId(realmId, "modern")) || MAP_BY_ID["modern-africa"];
  }

  function normalizeAddress(input = {}) {
    const map = getMap(input.mapId) || defaultMapForRealm(input.realmId);
    const regionId = map.regions.some((region) => region.id === input.regionId) ? input.regionId : map.regions[0].id;
    return freeze({
      format: FORMAT,
      mapId: map.id,
      realmId: map.realmId,
      regionId,
      sectorX: integer(clamp(input.sectorX, -64, 64)),
      sectorZ: integer(clamp(input.sectorZ, -64, 64)),
      localX: clamp(input.localX, 0, MAX_LOCAL_COORDINATE_METERS),
      localZ: clamp(input.localZ, 0, MAX_LOCAL_COORDINATE_METERS),
      altitudeM: clamp(input.altitudeM == null ? 0 : input.altitudeM, -12000, 16000)
    });
  }

  function addressToWorld(address) {
    const value = normalizeAddress(address);
    return freeze({
      x: value.sectorX * SECTOR_SIZE_METERS + value.localX,
      y: value.altitudeM,
      z: value.sectorZ * SECTOR_SIZE_METERS + value.localZ,
      mapId: value.mapId,
      regionId: value.regionId
    });
  }

  function worldToAddress(input = {}) {
    const x = clamp(input.x, -PLANET_CIRCUMFERENCE_METERS, PLANET_CIRCUMFERENCE_METERS);
    const z = clamp(input.z, -PLANET_CIRCUMFERENCE_METERS / 2, PLANET_CIRCUMFERENCE_METERS / 2);
    const sectorX = Math.floor(x / SECTOR_SIZE_METERS);
    const sectorZ = Math.floor(z / SECTOR_SIZE_METERS);
    return normalizeAddress({
      ...input,
      sectorX,
      sectorZ,
      localX: x - sectorX * SECTOR_SIZE_METERS,
      localZ: z - sectorZ * SECTOR_SIZE_METERS,
      altitudeM: input.y == null ? input.altitudeM : input.y
    });
  }

  class FloatingOrigin {
    constructor(options = {}) {
      this.threshold = clamp(options.thresholdM || DEFAULT_REBASE_THRESHOLD_METERS, 512, 32768);
      this.snap = clamp(options.snapM || CHUNK_SIZE_METERS, 64, 2048);
      this.originX = finite(options.originX);
      this.originY = finite(options.originY);
      this.originZ = finite(options.originZ);
      this.sequence = 0;
    }
    toLocal(world = {}) {
      return { x: finite(world.x) - this.originX, y: finite(world.y) - this.originY, z: finite(world.z) - this.originZ };
    }
    toWorld(local = {}) {
      return { x: finite(local.x) + this.originX, y: finite(local.y) + this.originY, z: finite(local.z) + this.originZ };
    }
    update(world = {}) {
      const x = finite(world.x); const y = finite(world.y); const z = finite(world.z);
      const distance = Math.hypot(x - this.originX, z - this.originZ);
      if (distance < this.threshold) return freeze({ rebased: false, sequence: this.sequence, delta: { x: 0, y: 0, z: 0 }, origin: this.snapshot().origin });
      const nextX = Math.round(x / this.snap) * this.snap;
      const nextY = Math.round(y / this.snap) * this.snap;
      const nextZ = Math.round(z / this.snap) * this.snap;
      const delta = { x: nextX - this.originX, y: nextY - this.originY, z: nextZ - this.originZ };
      this.originX = nextX; this.originY = nextY; this.originZ = nextZ; this.sequence += 1;
      return freeze({ rebased: true, sequence: this.sequence, delta, origin: this.snapshot().origin });
    }
    snapshot() {
      return freeze({ threshold: this.threshold, snap: this.snap, sequence: this.sequence, origin: { x: this.originX, y: this.originY, z: this.originZ } });
    }
  }

  class ChunkStreamPlanner {
    constructor(options = {}) {
      this.chunkSize = clamp(options.chunkSizeM || CHUNK_SIZE_METERS, 64, 2048);
      this.maximum = integer(clamp(options.maximum || 96, 9, 256));
      this.generation = 0;
    }
    plan(input = {}) {
      const radius = integer(clamp(input.radius == null ? 4 : input.radius, 1, MAX_STREAM_RADIUS));
      const centerX = Math.floor(finite(input.worldX) / this.chunkSize);
      const centerZ = Math.floor(finite(input.worldZ) / this.chunkSize);
      const magnitude = Math.hypot(finite(input.directionX), finite(input.directionZ)) || 1;
      const directionX = finite(input.directionX) / magnitude;
      const directionZ = finite(input.directionZ) / magnitude;
      const loaded = new Set(Array.isArray(input.loadedKeys) ? input.loadedKeys.map(String).slice(0, 512) : []);
      const mapId = getMap(input.mapId)?.id || "modern-africa";
      const candidates = [];
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const distance = Math.hypot(dx, dz);
          if (distance > radius + 0.25) continue;
          const forward = distance ? (dx / distance) * directionX + (dz / distance) * directionZ : 1;
          const chunkX = centerX + dx; const chunkZ = centerZ + dz;
          const key = `${mapId}:${chunkX}:${chunkZ}`;
          candidates.push({ key, mapId, chunkX, chunkZ, distance, priority: Math.round((1000 - distance * 100 + forward * 55) * 100) / 100, loaded: loaded.has(key) });
        }
      }
      candidates.sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key));
      const wanted = candidates.slice(0, this.maximum);
      const wantedKeys = new Set(wanted.map((row) => row.key));
      this.generation += 1;
      return freeze({
        generation: this.generation,
        center: { chunkX: centerX, chunkZ: centerZ },
        wanted,
        load: wanted.filter((row) => !row.loaded),
        retain: wanted.filter((row) => row.loaded),
        cancel: Array.from(loaded).filter((key) => !wantedKeys.has(key)).sort()
      });
    }
  }

  function tileKey(input = {}) {
    const map = getMap(input.mapId) || MAP_BY_ID["modern-africa"];
    const layer = ["biome", "height", "water", "food", "migration", "territory", "scent", "fog"].includes(input.layer) ? input.layer : "biome";
    const zoom = integer(clamp(input.zoom, 0, 16));
    const x = integer(clamp(finite(input.x, 0), -65536, 65536));
    const y = integer(clamp(finite(input.y, 0), -65536, 65536));
    return `${map.id}:${layer}:${zoom}:${x}:${y}`;
  }

  class AtlasTileCache {
    constructor(options = {}) {
      this.indexedDB = options.indexedDB || runtime.indexedDB || null;
      this.name = safeId(options.name || CACHE_NAME, CACHE_NAME);
      this.database = null;
      this.openPromise = null;
      this.closed = false;
      this.generation = 0;
    }
    open() {
      if (this.closed) return Promise.resolve(null);
      if (!this.indexedDB || typeof this.indexedDB.open !== "function") return Promise.resolve(null);
      if (this.database) return Promise.resolve(this.database);
      if (this.openPromise) return this.openPromise;
      const generation = ++this.generation;
      this.openPromise = new Promise((resolve, reject) => {
        const request = this.indexedDB.open(this.name, 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains("tiles")) database.createObjectStore("tiles", { keyPath: "key" });
        };
        request.onsuccess = () => {
          const database = request.result;
          if (this.closed || generation !== this.generation) {
            try { database?.close?.(); } catch {}
            resolve(null);
            return;
          }
          this.database = database;
          resolve(this.database);
        };
        request.onerror = () => reject(request.error || new Error("Atlas cache could not be opened"));
      }).finally(() => { this.openPromise = null; });
      return this.openPromise;
    }
    async get(input) {
      const database = await this.open(); if (!database) return null;
      const key = typeof input === "string" ? input : tileKey(input);
      return new Promise((resolve, reject) => {
        const request = database.transaction("tiles", "readonly").objectStore("tiles").get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error("Atlas tile read failed"));
      });
    }
    async put(input, payload) {
      const database = await this.open(); if (!database) return false;
      const key = typeof input === "string" ? input : tileKey(input);
      const serialized = JSON.stringify(payload == null ? null : payload);
      if (serialized.length > MAX_TILE_BYTES) throw new RangeError("Atlas tile exceeds the bounded cache budget");
      const record = { key, payload: JSON.parse(serialized), updatedAt: Date.now(), format: FORMAT };
      return new Promise((resolve, reject) => {
        const request = database.transaction("tiles", "readwrite").objectStore("tiles").put(record);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error || new Error("Atlas tile write failed"));
      });
    }
    close() {
      this.closed = true;
      this.generation += 1;
      try { this.database?.close?.(); } catch {}
      this.database = null;
      return true;
    }
  }

  function validateAtlas() {
    const errors = [];
    const ids = new Set();
    const allowedConfidence = new Set(["high", "medium", "hypothesis", "fictional"]);
    MAPS.forEach((map) => {
      if (ids.has(map.id)) errors.push(`Duplicate map id: ${map.id}`);
      ids.add(map.id);
      if (!REALM_META[map.realmId]) errors.push(`Unknown realm: ${map.realmId}`);
      if (!map.regions.length) errors.push(`Map has no region: ${map.id}`);
      if (!Array.isArray(map.ageMya) || map.ageMya.length !== 2 || map.ageMya.some((value) => !Number.isFinite(value))) errors.push(`Invalid age range: ${map.id}`);
      if (!allowedConfidence.has(map.confidence)) errors.push(`Invalid confidence: ${map.id}`);
      if (map.realmId === "convergence" && map.confidence !== "fictional") errors.push("Convergence must remain explicitly fictional");
      if (map.confidence === "fictional" && map.sourceIds.length) errors.push(`Fictional map cannot claim scientific sources: ${map.id}`);
      if (map.confidence !== "fictional") {
        if (!Array.isArray(map.sourceIds) || map.sourceIds.length < 2) errors.push(`Map requires two scientific references: ${map.id}`);
        map.sourceIds.forEach((sourceId) => {
          const source = SOURCE_REGISTRY[sourceId];
          if (!source) errors.push(`Unknown map source ${sourceId}: ${map.id}`);
          else if (!/^https:\/\//.test(source.url) || source.assetImported !== false || !/^\d{4}-\d{2}-\d{2}$/.test(source.reviewedAt)) errors.push(`Invalid source record ${sourceId}: ${map.id}`);
        });
        if (map.evidenceStatus !== "reference-only-no-derived-tiles" || !map.confidenceScope) errors.push(`Map evidence scope is not truthful: ${map.id}`);
      }
      if (map.gameplayStatus === "active-region" && (!map.rendererTimeSliceId || !map.rendererRegionId)) errors.push(`Active map lacks renderer address: ${map.id}`);
      if (map.gameplayStatus === "atlas-reference-only" && (map.rendererTimeSliceId || map.rendererRegionId)) errors.push(`Reference-only map claims renderer address: ${map.id}`);
    });
    return freeze({ valid: errors.length === 0, errors, mapCount: MAPS.length, realmCount: Object.keys(REALM_META).length });
  }

  const VALIDATION = validateAtlas();
  return freeze({
    VERSION, FORMAT, PLANET_RADIUS_METERS, PLANET_CIRCUMFERENCE_METERS, SECTOR_SIZE_METERS, MAX_LOCAL_COORDINATE_METERS,
    CHUNK_SIZE_METERS, DEFAULT_REBASE_THRESHOLD_METERS, MAX_STREAM_RADIUS, MAX_TILE_BYTES,
    REALM_META, SOURCE_REGISTRY, ACTIVE_REGION_BY_MAP, MAPS, MAP_BY_ID, VALIDATION,
    listMaps, getMap, defaultMapForRealm, normalizeAddress, addressToWorld, worldToAddress,
    tileKey, validateAtlas, FloatingOrigin, ChunkStreamPlanner, AtlasTileCache
  });
});
