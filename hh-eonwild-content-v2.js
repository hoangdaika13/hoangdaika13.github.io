(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHEonWildContentV2 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createEonWildContentV2() {
  "use strict";

  const VERSION = "2.0.0";
  const SCHEMA_VERSION = 2;
  const LIMITS = Object.freeze({
    realms: 4,
    flagshipSpecies: 13,
    catalogSpecies: 64,
    speciesPerRealm: 48,
    biomesPerRealm: 16,
    eventsPerRealm: 16,
    traitsPerFlagship: 6,
    validationErrors: 128,
    seedLength: 128
  });

  function isPlainObject(value) {
    if (!value || Object.prototype.toString.call(value) !== "[object Object]") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || Object.getPrototypeOf(prototype) === null;
  }

  function deepFreeze(value, seen) {
    if (!value || (typeof value !== "object" && typeof value !== "function")) return value;
    const visited = seen || new Set();
    if (visited.has(value)) return value;
    visited.add(value);
    Reflect.ownKeys(value).forEach(function (key) {
      deepFreeze(value[key], visited);
    });
    return Object.freeze(value);
  }

  function clamp(value, minimum, maximum, fallback) {
    const number = Number(value);
    const safe = Number.isFinite(number) ? number : fallback;
    return Math.min(maximum, Math.max(minimum, safe));
  }

  function rounded(value, digits) {
    const scale = Math.pow(10, digits || 0);
    return Math.round((value + Number.EPSILON) * scale) / scale;
  }

  function hasDuplicates(values) {
    return new Set(values).size !== values.length;
  }

  function validationResult(errors) {
    return deepFreeze({
      valid: errors.length === 0,
      errors: errors.slice(0, LIMITS.validationErrors)
    });
  }

  function indexById(rows) {
    return rows.reduce(function (index, row) {
      index[row.id] = row;
      return index;
    }, Object.create(null));
  }

  const REALM_IDS = deepFreeze(["paleozoic", "mesozoic", "ice-age", "modern"]);

  const BIOMES = deepFreeze([
    {
      id: "cambrian-shelf",
      label: "Thềm biển Cambri",
      medium: "water",
      temperatureC: [10, 28],
      resources: ["soft-prey", "plankton", "shelter"],
      hazards: ["low-oxygen", "current"]
    },
    {
      id: "paleozoic-reef",
      label: "Rạn biển Cổ sinh",
      medium: "water",
      temperatureC: [12, 30],
      resources: ["armored-prey", "algae", "shelter"],
      hazards: ["anoxia", "storm"]
    },
    {
      id: "devonian-estuary",
      label: "Cửa sông Devon",
      medium: "mixed",
      temperatureC: [8, 29],
      resources: ["fish", "detritus", "shallow-water"],
      hazards: ["tide", "low-oxygen"]
    },
    {
      id: "carboniferous-swamp",
      label: "Đầm rừng Carbon",
      medium: "mixed",
      temperatureC: [18, 34],
      resources: ["ferns", "arthropods", "fresh-water"],
      hazards: ["wildfire", "flood"]
    },
    {
      id: "permian-floodplain",
      label: "Đồng lũ Permi",
      medium: "land",
      temperatureC: [4, 39],
      resources: ["seed-ferns", "small-prey", "water-hole"],
      hazards: ["drought", "heat"]
    },
    {
      id: "mesozoic-conifer-forest",
      label: "Rừng hạt trần Trung sinh",
      medium: "land",
      temperatureC: [4, 33],
      resources: ["conifers", "cycads", "small-prey"],
      hazards: ["wildfire", "fallen-tree"]
    },
    {
      id: "fern-prairie",
      label: "Thảo nguyên dương xỉ",
      medium: "land",
      temperatureC: [10, 36],
      resources: ["ferns", "cycads", "nest-cover"],
      hazards: ["drought", "stampede"]
    },
    {
      id: "cretaceous-floodplain",
      label: "Đồng lũ Phấn Trắng",
      medium: "mixed",
      temperatureC: [12, 38],
      resources: ["river-fish", "herds", "fresh-water"],
      hazards: ["flash-flood", "mud"]
    },
    {
      id: "mesozoic-coastal-wetland",
      label: "Đầm ven biển Trung sinh",
      medium: "mixed",
      temperatureC: [16, 36],
      resources: ["fish", "reeds", "carcass"],
      hazards: ["storm-surge", "deep-mud"]
    },
    {
      id: "mesozoic-shallow-sea",
      label: "Biển nông Trung sinh",
      medium: "water",
      temperatureC: [9, 31],
      resources: ["fish-school", "cephalopods", "air-pocket"],
      hazards: ["current", "storm"]
    },
    {
      id: "mesozoic-volcanic-upland",
      label: "Cao địa núi lửa Trung sinh",
      medium: "land",
      temperatureC: [-2, 31],
      resources: ["conifers", "mineral-water", "cliff-nest"],
      hazards: ["ash", "rockfall"]
    },
    {
      id: "late-cenozoic-grassland",
      label: "Đồng cỏ Tân sinh muộn",
      medium: "land",
      temperatureC: [2, 35],
      resources: ["grazers", "thermal-current", "carcass"],
      hazards: ["drought", "crosswind"]
    },
    {
      id: "mammoth-steppe",
      label: "Thảo nguyên ma mút",
      medium: "land",
      temperatureC: [-35, 14],
      resources: ["cold-grass", "shrubs", "snow-water"],
      hazards: ["blizzard", "thin-ice"]
    },
    {
      id: "glacial-tundra",
      label: "Băng nguyên Pleistocene",
      medium: "land",
      temperatureC: [-48, 8],
      resources: ["lichen", "sedge", "wind-shelter"],
      hazards: ["whiteout", "frost"]
    },
    {
      id: "ice-age-boreal-forest",
      label: "Rừng lá kim Kỷ băng hà",
      medium: "land",
      temperatureC: [-28, 19],
      resources: ["bark", "prey", "den"],
      hazards: ["deep-snow", "fallen-tree"]
    },
    {
      id: "ice-age-coast",
      label: "Duyên hải băng hà",
      medium: "mixed",
      temperatureC: [-24, 12],
      resources: ["fish", "shellfish", "cliff-nest"],
      hazards: ["sea-ice-break", "storm"]
    },
    {
      id: "modern-temperate-forest",
      label: "Rừng ôn đới hiện đại",
      medium: "land",
      temperatureC: [-8, 31],
      resources: ["prey", "fruit", "den"],
      hazards: ["storm", "wildfire"]
    },
    {
      id: "modern-savanna",
      label: "Savanna hiện đại",
      medium: "land",
      temperatureC: [10, 43],
      resources: ["grass", "herds", "water-hole"],
      hazards: ["drought", "wildfire"]
    },
    {
      id: "modern-river",
      label: "Sông nhiệt đới hiện đại",
      medium: "water",
      temperatureC: [18, 34],
      resources: ["fish", "crustaceans", "air-surface"],
      hazards: ["flood", "low-oxygen"]
    },
    {
      id: "pelagic-ocean",
      label: "Đại dương khơi xa",
      medium: "water",
      temperatureC: [-2, 29],
      resources: ["krill", "fish-school", "breathing-lane"],
      hazards: ["storm", "low-food"]
    },
    {
      id: "kelp-forest",
      label: "Rừng tảo bẹ",
      medium: "water",
      temperatureC: [3, 20],
      resources: ["crustaceans", "fish", "rock-den"],
      hazards: ["surge", "entangling-kelp"]
    },
    {
      id: "coral-reef",
      label: "Rạn san hô hiện đại",
      medium: "water",
      temperatureC: [20, 31],
      resources: ["reef-fish", "mollusks", "crevice"],
      hazards: ["heat-event", "current"]
    },
    {
      id: "polar-sea",
      label: "Biển vùng cực",
      medium: "water",
      temperatureC: [-2, 8],
      resources: ["krill", "fish-school", "ice-edge"],
      hazards: ["sea-ice", "whiteout"]
    },
    {
      id: "flower-meadow",
      label: "Đồng hoa",
      medium: "land",
      temperatureC: [7, 34],
      resources: ["nectar", "pollen", "hive-site"],
      hazards: ["heavy-rain", "heat"]
    }
  ]);
  const BIOME_CATALOG = deepFreeze(indexById(BIOMES));

  const EVENTS = deepFreeze([
    {
      id: "cambrian-bloom",
      realmId: "paleozoic",
      label: "Bùng nổ sinh vật phù du",
      durationMinutes: [8, 40],
      intensity: [20, 80],
      biomeIds: ["cambrian-shelf", "paleozoic-reef"],
      effects: { foodMultiplier: 1.45, visibilityMultiplier: 0.82 }
    },
    {
      id: "paleozoic-anoxia",
      realmId: "paleozoic",
      label: "Thiếu oxy cục bộ",
      durationMinutes: [4, 25],
      intensity: [30, 95],
      biomeIds: ["paleozoic-reef", "devonian-estuary"],
      effects: { oxygenMultiplier: 0.58, foodMultiplier: 0.75 }
    },
    {
      id: "carboniferous-storm",
      realmId: "paleozoic",
      label: "Bão rừng Carbon",
      durationMinutes: [5, 35],
      intensity: [25, 90],
      biomeIds: ["carboniferous-swamp"],
      effects: { visibilityMultiplier: 0.45, waterLevelDelta: 22 }
    },
    {
      id: "permian-drought",
      realmId: "paleozoic",
      label: "Hạn Permi",
      durationMinutes: [20, 180],
      intensity: [25, 100],
      biomeIds: ["permian-floodplain"],
      effects: { waterMultiplier: 0.45, temperatureDeltaC: 8 }
    },
    {
      id: "mesozoic-monsoon",
      realmId: "mesozoic",
      label: "Gió mùa Trung sinh",
      durationMinutes: [8, 70],
      intensity: [20, 90],
      biomeIds: ["cretaceous-floodplain", "mesozoic-coastal-wetland"],
      effects: { waterLevelDelta: 30, scentMultiplier: 0.55 }
    },
    {
      id: "mesozoic-wildfire",
      realmId: "mesozoic",
      label: "Cháy thảm dương xỉ",
      durationMinutes: [5, 55],
      intensity: [35, 100],
      biomeIds: ["fern-prairie", "mesozoic-conifer-forest"],
      effects: { foodMultiplier: 0.52, temperatureDeltaC: 12 }
    },
    {
      id: "volcanic-ashfall",
      realmId: "mesozoic",
      label: "Tro núi lửa",
      durationMinutes: [8, 90],
      intensity: [20, 95],
      biomeIds: ["mesozoic-volcanic-upland", "cretaceous-floodplain"],
      effects: { visibilityMultiplier: 0.32, oxygenMultiplier: 0.78 }
    },
    {
      id: "mesozoic-coastal-storm",
      realmId: "mesozoic",
      label: "Bão biển Trung sinh",
      durationMinutes: [6, 60],
      intensity: [25, 95],
      biomeIds: ["mesozoic-shallow-sea", "mesozoic-coastal-wetland"],
      effects: { currentMultiplier: 1.7, visibilityMultiplier: 0.48 }
    },
    {
      id: "ice-age-blizzard",
      realmId: "ice-age",
      label: "Bão tuyết",
      durationMinutes: [5, 75],
      intensity: [25, 100],
      biomeIds: ["mammoth-steppe", "glacial-tundra", "ice-age-boreal-forest"],
      effects: { temperatureDeltaC: -18, visibilityMultiplier: 0.2 }
    },
    {
      id: "glacial-thaw",
      realmId: "ice-age",
      label: "Băng tan theo mùa",
      durationMinutes: [20, 180],
      intensity: [15, 75],
      biomeIds: ["glacial-tundra", "ice-age-coast"],
      effects: { waterLevelDelta: 26, foodMultiplier: 1.18 }
    },
    {
      id: "steppe-migration",
      realmId: "ice-age",
      label: "Xung di cư thảo nguyên",
      durationMinutes: [15, 150],
      intensity: [20, 85],
      biomeIds: ["mammoth-steppe", "late-cenozoic-grassland"],
      effects: { herdMultiplier: 1.6, foodMultiplier: 1.22 }
    },
    {
      id: "ice-age-drought",
      realmId: "ice-age",
      label: "Khô hạn thảo nguyên",
      durationMinutes: [20, 180],
      intensity: [20, 90],
      biomeIds: ["late-cenozoic-grassland", "mammoth-steppe"],
      effects: { waterMultiplier: 0.5, foodMultiplier: 0.7 }
    },
    {
      id: "modern-river-flood",
      realmId: "modern",
      label: "Lũ sông theo mùa",
      durationMinutes: [8, 100],
      intensity: [20, 95],
      biomeIds: ["modern-river"],
      effects: { waterLevelDelta: 35, currentMultiplier: 1.5 }
    },
    {
      id: "ocean-upwelling",
      realmId: "modern",
      label: "Nước trồi đại dương",
      durationMinutes: [25, 180],
      intensity: [15, 80],
      biomeIds: ["pelagic-ocean", "polar-sea"],
      effects: { foodMultiplier: 1.7, temperatureDeltaC: -4 }
    },
    {
      id: "modern-wildfire",
      realmId: "modern",
      label: "Cháy rừng theo mùa",
      durationMinutes: [5, 80],
      intensity: [25, 100],
      biomeIds: ["modern-temperate-forest", "modern-savanna"],
      effects: { foodMultiplier: 0.5, visibilityMultiplier: 0.4 }
    },
    {
      id: "flowering-pulse",
      realmId: "modern",
      label: "Đợt hoa nở",
      durationMinutes: [20, 180],
      intensity: [20, 85],
      biomeIds: ["flower-meadow", "modern-temperate-forest"],
      effects: { nectarMultiplier: 1.8, foodMultiplier: 1.25 }
    },
    {
      id: "modern-ocean-storm",
      realmId: "modern",
      label: "Bão đại dương",
      durationMinutes: [6, 90],
      intensity: [20, 100],
      biomeIds: ["pelagic-ocean", "kelp-forest", "coral-reef"],
      effects: { currentMultiplier: 1.8, visibilityMultiplier: 0.42 }
    }
  ]);
  const EVENT_CATALOG = deepFreeze(indexById(EVENTS));

  const FLAGSHIP_IDS = deepFreeze([
    "tyrannosaurus",
    "triceratops",
    "argentavis",
    "orca",
    "giant-octopus",
    "spinosaurus",
    "mammuthus",
    "wolf",
    "honeybee",
    "electric-eel",
    "ankylosaurus",
    "blue-whale",
    "pteranodon"
  ]);

  const SIMULATED_SPECIES_IDS = deepFreeze([
    "anomalocaris",
    "dunkleosteus",
    "tiktaalik",
    "arthropleura",
    "meganeura",
    "dimetrodon",
    "coelophysis",
    "stegosaurus",
    "brachiosaurus",
    "archaeopteryx",
    "velociraptor",
    "mosasaurus",
    "ichthyosaurus",
    "phorusrhacos",
    "smilodon",
    "megatherium",
    "doedicurus",
    "thylacoleo",
    "elephant",
    "lion",
    "tiger",
    "polar-bear",
    "giraffe",
    "kangaroo",
    "komodo",
    "crocodile",
    "golden-eagle",
    "emperor-penguin",
    "axolotl",
    "mantis-shrimp"
  ]);

  const CODEX_SPECIES_IDS = deepFreeze([
    "opabinia",
    "hallucigenia",
    "titanoboa",
    "basilosaurus",
    "paraceratherium",
    "panda"
  ]);

  const CATALOG_TIERS = deepFreeze({
    flagship: FLAGSHIP_IDS,
    simulated: SIMULATED_SPECIES_IDS,
    codex: CODEX_SPECIES_IDS
  });

  const CATALOG_TIER_META = deepFreeze({
    flagship: {
      id: "flagship",
      label: "Flagship playable",
      capabilities: ["play", "simulate", "codex"]
    },
    simulated: {
      id: "simulated",
      label: "Wildlife simulated",
      capabilities: ["simulate", "codex"]
    },
    codex: {
      id: "codex",
      label: "Codex reference",
      capabilities: ["codex"]
    }
  });

  const REALMS = deepFreeze([
    {
      id: "paleozoic",
      label: "Cambri–Permi",
      rangeMya: [541, 252],
      periods: ["Cambri", "Ordovic", "Silur", "Devon", "Carbon", "Permi"],
      speciesIds: [
        "anomalocaris",
        "dunkleosteus",
        "tiktaalik",
        "arthropleura",
        "meganeura",
        "dimetrodon"
      ],
      biomeIds: [
        "cambrian-shelf",
        "paleozoic-reef",
        "devonian-estuary",
        "carboniferous-swamp",
        "permian-floodplain"
      ],
      eventIds: [
        "cambrian-bloom",
        "paleozoic-anoxia",
        "carboniferous-storm",
        "permian-drought"
      ]
    },
    {
      id: "mesozoic",
      label: "Đại Trung sinh",
      rangeMya: [252, 66],
      periods: ["Trias", "Jura", "Phấn Trắng"],
      speciesIds: [
        "coelophysis",
        "stegosaurus",
        "brachiosaurus",
        "archaeopteryx",
        "spinosaurus",
        "tyrannosaurus",
        "triceratops",
        "velociraptor",
        "ankylosaurus",
        "pteranodon",
        "mosasaurus",
        "ichthyosaurus"
      ],
      biomeIds: [
        "mesozoic-conifer-forest",
        "fern-prairie",
        "cretaceous-floodplain",
        "mesozoic-coastal-wetland",
        "mesozoic-shallow-sea",
        "mesozoic-volcanic-upland"
      ],
      eventIds: [
        "mesozoic-monsoon",
        "mesozoic-wildfire",
        "volcanic-ashfall",
        "mesozoic-coastal-storm"
      ]
    },
    {
      id: "ice-age",
      label: "Tân sinh muộn & Kỷ băng hà",
      rangeMya: [23, 0.0117],
      periods: ["Miocene muộn", "Pliocene", "Pleistocene"],
      speciesIds: [
        "argentavis",
        "phorusrhacos",
        "smilodon",
        "mammuthus",
        "megatherium",
        "doedicurus",
        "thylacoleo"
      ],
      biomeIds: [
        "late-cenozoic-grassland",
        "mammoth-steppe",
        "glacial-tundra",
        "ice-age-boreal-forest",
        "ice-age-coast"
      ],
      eventIds: [
        "ice-age-blizzard",
        "glacial-thaw",
        "steppe-migration",
        "ice-age-drought"
      ]
    },
    {
      id: "modern",
      label: "Trái Đất hiện đại",
      rangeMya: [0.0117, 0],
      periods: ["Holocene", "Hiện tại"],
      speciesIds: [
        "elephant",
        "lion",
        "tiger",
        "wolf",
        "polar-bear",
        "giraffe",
        "kangaroo",
        "komodo",
        "crocodile",
        "golden-eagle",
        "orca",
        "blue-whale",
        "giant-octopus",
        "emperor-penguin",
        "axolotl",
        "honeybee",
        "mantis-shrimp",
        "electric-eel"
      ],
      biomeIds: [
        "modern-temperate-forest",
        "modern-savanna",
        "modern-river",
        "pelagic-ocean",
        "kelp-forest",
        "coral-reef",
        "polar-sea",
        "flower-meadow"
      ],
      eventIds: [
        "modern-river-flood",
        "ocean-upwelling",
        "modern-wildfire",
        "flowering-pulse",
        "modern-ocean-storm"
      ]
    }
  ]);
  const REALMS_BY_ID = deepFreeze(indexById(REALMS));
  const REALM_POLICY = deepFreeze({
    defaultMode: "era-realm",
    convergenceMode: "eon-convergence",
    crossRealmRequiresConvergence: true,
    codexTierMaySpawn: false
  });

  const COMMUNICATION_CHANNELS = deepFreeze([
    "acoustic",
    "infrasonic",
    "vibration",
    "scent",
    "posture",
    "color",
    "electric"
  ]);

  const COMMUNICATION_CALL_LIST = deepFreeze([
    {
      id: "contact",
      label: "Liên lạc",
      intent: "Giữ đội hình hoặc tìm cá thể gần",
      channelIds: ["acoustic", "infrasonic", "vibration"],
      radiusMeters: 6000,
      energyCost: 5,
      cooldownSeconds: 4
    },
    {
      id: "alarm",
      label: "Cảnh báo",
      intent: "Báo nguy hiểm và hướng thoát",
      channelIds: ["acoustic", "vibration", "scent", "posture", "color"],
      radiusMeters: 1800,
      energyCost: 8,
      cooldownSeconds: 6
    },
    {
      id: "territorial",
      label: "Lãnh thổ",
      intent: "Giảm xung đột bằng tín hiệu khoảng cách",
      channelIds: ["acoustic", "infrasonic", "scent", "posture", "color", "electric"],
      radiusMeters: 5000,
      energyCost: 12,
      cooldownSeconds: 18
    },
    {
      id: "courtship",
      label: "Kết đôi",
      intent: "Báo trạng thái sinh sản tương thích",
      channelIds: ["acoustic", "vibration", "scent", "posture", "color", "electric"],
      radiusMeters: 2500,
      energyCost: 10,
      cooldownSeconds: 16
    },
    {
      id: "rally",
      label: "Tập hợp",
      intent: "Gom đàn về điểm an toàn",
      channelIds: ["acoustic", "infrasonic", "posture"],
      radiusMeters: 4200,
      energyCost: 9,
      cooldownSeconds: 10
    },
    {
      id: "parent-young",
      label: "Cha mẹ–con non",
      intent: "Nhận diện và dẫn con non",
      channelIds: ["acoustic", "infrasonic", "vibration", "scent"],
      radiusMeters: 1200,
      energyCost: 4,
      cooldownSeconds: 3
    },
    {
      id: "distress",
      label: "Nguy cấp",
      intent: "Báo mắc kẹt hoặc bị thương nặng",
      channelIds: ["acoustic", "vibration", "electric", "color"],
      radiusMeters: 2200,
      energyCost: 15,
      cooldownSeconds: 12
    },
    {
      id: "hunt",
      label: "Phối hợp săn",
      intent: "Đồng bộ hướng và thời điểm áp sát",
      channelIds: ["acoustic", "infrasonic", "posture"],
      radiusMeters: 3500,
      energyCost: 7,
      cooldownSeconds: 5
    },
    {
      id: "navigation",
      label: "Chỉ hướng",
      intent: "Chia sẻ hướng nguồn thức ăn hoặc đường di cư",
      channelIds: ["acoustic", "infrasonic", "vibration", "posture", "electric"],
      radiusMeters: 9000,
      energyCost: 6,
      cooldownSeconds: 8
    },
    {
      id: "colony-task",
      label: "Nhiệm vụ đàn",
      intent: "Phân phối tìm thức ăn, phòng vệ và chăm tổ",
      channelIds: ["vibration", "scent", "posture"],
      radiusMeters: 120,
      energyCost: 3,
      cooldownSeconds: 2
    },
    {
      id: "migration",
      label: "Di cư",
      intent: "Giữ liên kết trên hành trình dài",
      channelIds: ["acoustic", "infrasonic", "vibration"],
      radiusMeters: 50000,
      energyCost: 8,
      cooldownSeconds: 20
    },
    {
      id: "echolocation",
      label: "Dội âm",
      intent: "Định vị mục tiêu và địa hình trong nước",
      channelIds: ["acoustic"],
      radiusMeters: 7000,
      energyCost: 7,
      cooldownSeconds: 2
    }
  ]);
  const COMMUNICATION_CALLS = deepFreeze(indexById(COMMUNICATION_CALL_LIST));

  const DIET_NUTRIENTS = deepFreeze([
    "protein",
    "fat",
    "carbohydrate",
    "fiber",
    "micronutrients",
    "hydration"
  ]);

  const DIETS = deepFreeze([
    {
      id: "carnivore",
      label: "Ăn thịt",
      legacyId: "meat",
      foodTags: ["meat", "carcass", "organ", "bone"],
      targets: {
        protein: 70,
        fat: 52,
        carbohydrate: 5,
        fiber: 5,
        micronutrients: 34,
        hydration: 45
      },
      toxinTolerance: 24,
      spoilageTolerance: 38
    },
    {
      id: "herbivore",
      label: "Ăn thực vật",
      legacyId: "plant",
      foodTags: ["grass", "leaf", "fern", "bark", "fruit"],
      targets: {
        protein: 24,
        fat: 12,
        carbohydrate: 58,
        fiber: 72,
        micronutrients: 52,
        hydration: 48
      },
      toxinTolerance: 42,
      spoilageTolerance: 18
    },
    {
      id: "omnivore",
      label: "Ăn tạp",
      legacyId: "omnivore",
      foodTags: ["meat", "egg", "fruit", "seed", "root"],
      targets: {
        protein: 42,
        fat: 32,
        carbohydrate: 42,
        fiber: 28,
        micronutrients: 48,
        hydration: 46
      },
      toxinTolerance: 34,
      spoilageTolerance: 30
    },
    {
      id: "piscivore",
      label: "Ăn cá",
      legacyId: "meat",
      foodTags: ["fish", "cephalopod", "crustacean"],
      targets: {
        protein: 66,
        fat: 36,
        carbohydrate: 5,
        fiber: 5,
        micronutrients: 48,
        hydration: 62
      },
      toxinTolerance: 20,
      spoilageTolerance: 26
    },
    {
      id: "filter-feeder",
      label: "Lọc thức ăn",
      legacyId: "filter",
      foodTags: ["krill", "plankton", "small-school"],
      targets: {
        protein: 48,
        fat: 30,
        carbohydrate: 14,
        fiber: 8,
        micronutrients: 66,
        hydration: 80
      },
      toxinTolerance: 16,
      spoilageTolerance: 20
    },
    {
      id: "nectar-pollen",
      label: "Mật và phấn hoa",
      legacyId: "nectar",
      foodTags: ["nectar", "pollen", "honey"],
      targets: {
        protein: 22,
        fat: 10,
        carbohydrate: 82,
        fiber: 14,
        micronutrients: 48,
        hydration: 44
      },
      toxinTolerance: 18,
      spoilageTolerance: 12
    }
  ]);
  const DIET_CATALOG = deepFreeze(indexById(DIETS));
  const DEFAULT_DIET_INTAKE = deepFreeze({
    protein: 50,
    fat: 50,
    carbohydrate: 50,
    fiber: 50,
    micronutrients: 50,
    hydration: 50,
    toxins: 0,
    spoilage: 0
  });
  const DIET_QUALITY_GRADES = deepFreeze({
    excellent: [85, 100],
    adequate: [65, 84.9999],
    poor: [40, 64.9999],
    critical: [0, 39.9999]
  });

  const INJURIES = deepFreeze([
    {
      id: "bleeding",
      label: "Chảy máu",
      severity: [0, 100],
      naturalRecoveryPerMinute: 0.35,
      healthDrainAtMaxPerMinute: 5,
      movementMultiplierAtMax: 0.72,
      staminaMultiplierAtMax: 0.6,
      infectionRiskAtMax: 0.55
    },
    {
      id: "fracture",
      label: "Gãy xương",
      severity: [0, 100],
      naturalRecoveryPerMinute: 0.05,
      healthDrainAtMaxPerMinute: 0.5,
      movementMultiplierAtMax: 0.28,
      staminaMultiplierAtMax: 0.48,
      infectionRiskAtMax: 0.08
    },
    {
      id: "infection",
      label: "Nhiễm trùng",
      severity: [0, 100],
      naturalRecoveryPerMinute: 0.08,
      healthDrainAtMaxPerMinute: 2.8,
      movementMultiplierAtMax: 0.7,
      staminaMultiplierAtMax: 0.5,
      infectionRiskAtMax: 0
    },
    {
      id: "disease",
      label: "Bệnh",
      severity: [0, 100],
      naturalRecoveryPerMinute: 0.1,
      healthDrainAtMaxPerMinute: 2.2,
      movementMultiplierAtMax: 0.74,
      staminaMultiplierAtMax: 0.42,
      infectionRiskAtMax: 0
    },
    {
      id: "hypothermia",
      label: "Hạ thân nhiệt",
      severity: [0, 100],
      naturalRecoveryPerMinute: 0.2,
      healthDrainAtMaxPerMinute: 3.4,
      movementMultiplierAtMax: 0.46,
      staminaMultiplierAtMax: 0.38,
      infectionRiskAtMax: 0
    },
    {
      id: "hyperthermia",
      label: "Quá nhiệt",
      severity: [0, 100],
      naturalRecoveryPerMinute: 0.25,
      healthDrainAtMaxPerMinute: 3.6,
      movementMultiplierAtMax: 0.58,
      staminaMultiplierAtMax: 0.32,
      infectionRiskAtMax: 0
    },
    {
      id: "hypoxia",
      label: "Thiếu oxy",
      severity: [0, 100],
      naturalRecoveryPerMinute: 0.65,
      healthDrainAtMaxPerMinute: 6,
      movementMultiplierAtMax: 0.5,
      staminaMultiplierAtMax: 0.25,
      infectionRiskAtMax: 0
    }
  ]);
  const INJURY_CATALOG = deepFreeze(indexById(INJURIES));
  const INJURY_STATE_BOUNDS = deepFreeze({
    temperatureC: [-90, 70],
    oxygen: [0, 100],
    severity: [0, 100]
  });
  const DEFAULT_INJURY_STATE = deepFreeze({
    temperatureC: 20,
    oxygen: 100,
    bleeding: 0,
    fracture: 0,
    infection: 0,
    disease: 0,
    hypothermia: 0,
    hyperthermia: 0,
    hypoxia: 0
  });

  const GENE_SCHEMA = deepFreeze({
    bodyScale: {
      label: "Tầm vóc",
      min: 0.8,
      max: 1.2,
      default: 1,
      mutationScale: 0.18,
      precision: 4
    },
    endurance: {
      label: "Sức bền",
      min: 0.7,
      max: 1.3,
      default: 1,
      mutationScale: 0.16,
      precision: 4
    },
    thermalTolerance: {
      label: "Chịu nhiệt",
      min: 0.65,
      max: 1.35,
      default: 1,
      mutationScale: 0.14,
      precision: 4
    },
    oxygenEfficiency: {
      label: "Hiệu quả oxy",
      min: 0.75,
      max: 1.25,
      default: 1,
      mutationScale: 0.12,
      precision: 4
    },
    sensoryAcuity: {
      label: "Độ nhạy giác quan",
      min: 0.75,
      max: 1.3,
      default: 1,
      mutationScale: 0.14,
      precision: 4
    },
    diseaseResistance: {
      label: "Kháng bệnh",
      min: 0.7,
      max: 1.3,
      default: 1,
      mutationScale: 0.14,
      precision: 4
    },
    metabolism: {
      label: "Trao đổi chất",
      min: 0.75,
      max: 1.25,
      default: 1,
      mutationScale: 0.12,
      precision: 4
    },
    pigment: {
      label: "Sắc tố",
      min: 0,
      max: 1,
      default: 0.5,
      mutationScale: 0.1,
      precision: 4
    },
    sociability: {
      label: "Tính xã hội",
      min: 0,
      max: 1,
      default: 0.5,
      mutationScale: 0.1,
      precision: 4
    },
    parentalCare: {
      label: "Chăm con",
      min: 0,
      max: 1,
      default: 0.5,
      mutationScale: 0.1,
      precision: 4
    }
  });
  const GENE_KEYS = deepFreeze(Object.keys(GENE_SCHEMA));
  const DEFAULT_GENES = deepFreeze(GENE_KEYS.reduce(function (genes, key) {
    genes[key] = GENE_SCHEMA[key].default;
    return genes;
  }, Object.create(null)));

  const FLAGSHIPS = deepFreeze([
    {
      id: "tyrannosaurus",
      scientificName: "Tyrannosaurus rex",
      realmId: "mesozoic",
      signature: "scent-plume-ambush",
      locomotion: {
        mode: "bipedal-run",
        habitats: ["land"],
        cruiseSpeed: 34,
        burstSpeed: 58,
        staminaCost: 18,
        special: {
          id: "momentum-stride",
          label: "Sải bước tích động lượng",
          cooldownSeconds: 7,
          cost: 20
        }
      },
      sense: {
        mode: "windborne-scent",
        rangeMeters: 4200,
        coneDegrees: 110,
        special: "Đọc vệt mùi theo hướng gió và tuổi dấu chân"
      },
      defense: {
        mode: "bone-crushing-bite",
        power: 96,
        cooldownSeconds: 9,
        staminaCost: 28,
        special: "Khóa hàm mạnh hơn khi tiếp cận đúng hướng mùi"
      },
      diet: {
        profileId: "carnivore",
        foodTags: ["meat", "carcass", "organ"],
        feedingMode: "tear-and-rest",
        qualityBonus: "fresh-large-prey"
      },
      reproduction: {
        mode: "egg",
        offspring: [1, 4],
        maturityCycles: 14,
        care: "guarded-ground-nest",
        nestBiomeIds: ["cretaceous-floodplain", "mesozoic-conifer-forest"]
      },
      audio: {
        voice: "procedural-low-rumble",
        channels: ["infrasonic", "acoustic"],
        callIds: ["territorial", "courtship", "parent-young"],
        rangeMeters: 3800,
        procedural: true
      },
      traits: [
        { id: "scent-memory", label: "Nhớ tuyến mùi", value: 92 },
        { id: "jaw-force", label: "Lực hàm", value: 98 },
        { id: "turn-inertia", label: "Quán tính xoay", value: 32 }
      ]
    },
    {
      id: "triceratops",
      scientificName: "Triceratops horridus",
      realmId: "mesozoic",
      signature: "herd-shield-charge",
      locomotion: {
        mode: "quadruped-charge",
        habitats: ["land"],
        cruiseSpeed: 28,
        burstSpeed: 54,
        staminaCost: 22,
        special: {
          id: "herd-draft",
          label: "Núp luồng đàn",
          cooldownSeconds: 6,
          cost: 12
        }
      },
      sense: {
        mode: "panoramic-herd-alert",
        rangeMeters: 1800,
        coneDegrees: 300,
        special: "Chia sẻ hướng nguy hiểm qua tư thế đầu"
      },
      defense: {
        mode: "frill-horn-charge",
        power: 92,
        cooldownSeconds: 11,
        staminaCost: 30,
        special: "Xếp vòng che cá thể non rồi phản kích bằng sừng"
      },
      diet: {
        profileId: "herbivore",
        foodTags: ["fern", "leaf", "cycad"],
        feedingMode: "low-browser",
        qualityBonus: "mixed-fibrous-plants"
      },
      reproduction: {
        mode: "egg",
        offspring: [2, 6],
        maturityCycles: 13,
        care: "communal-nest-guard",
        nestBiomeIds: ["fern-prairie", "cretaceous-floodplain"]
      },
      audio: {
        voice: "procedural-resonant-bellow",
        channels: ["acoustic", "vibration"],
        callIds: ["alarm", "rally", "parent-young"],
        rangeMeters: 2400,
        procedural: true
      },
      traits: [
        { id: "herd-cohesion", label: "Kết đàn", value: 90 },
        { id: "frill-guard", label: "Khiên cổ", value: 88 },
        { id: "charge-control", label: "Giữ hướng xung phong", value: 72 }
      ]
    },
    {
      id: "argentavis",
      scientificName: "Argentavis magnificens",
      realmId: "ice-age",
      signature: "thermal-soaring-scavenger",
      locomotion: {
        mode: "thermal-soar",
        habitats: ["air", "land"],
        cruiseSpeed: 63,
        burstSpeed: 82,
        staminaCost: 8,
        special: {
          id: "thermal-bank",
          label: "Tích độ cao trong cột nhiệt",
          cooldownSeconds: 4,
          cost: 4
        }
      },
      sense: {
        mode: "high-altitude-vision",
        rangeMeters: 9000,
        coneDegrees: 170,
        special: "Đánh dấu xác và luồng khí từ độ cao lớn"
      },
      defense: {
        mode: "talon-pass",
        power: 64,
        cooldownSeconds: 8,
        staminaCost: 22,
        special: "Lướt qua thay vì dừng trên mặt đất nguy hiểm"
      },
      diet: {
        profileId: "carnivore",
        foodTags: ["carcass", "meat", "organ"],
        feedingMode: "land-and-tear",
        qualityBonus: "fresh-carcass"
      },
      reproduction: {
        mode: "egg",
        offspring: [1, 2],
        maturityCycles: 12,
        care: "cliff-nest-guard",
        nestBiomeIds: ["late-cenozoic-grassland", "ice-age-coast"]
      },
      audio: {
        voice: "procedural-rasp-and-wingbeat",
        channels: ["acoustic", "vibration"],
        callIds: ["contact", "courtship", "distress"],
        rangeMeters: 1900,
        procedural: true
      },
      traits: [
        { id: "soar-efficiency", label: "Hiệu suất lượn", value: 98 },
        { id: "thermal-reading", label: "Đọc cột nhiệt", value: 94 },
        { id: "ground-vulnerability", label: "An toàn khi đáp", value: 38 }
      ]
    },
    {
      id: "orca",
      scientificName: "Orcinus orca",
      realmId: "modern",
      signature: "pod-echolocation-hunt",
      locomotion: {
        mode: "pod-burst-swim",
        habitats: ["water"],
        cruiseSpeed: 58,
        burstSpeed: 88,
        staminaCost: 14,
        special: {
          id: "wake-draft",
          label: "Lướt theo dòng đàn",
          cooldownSeconds: 5,
          cost: 8
        }
      },
      sense: {
        mode: "active-echolocation",
        rangeMeters: 7000,
        coneDegrees: 75,
        special: "Dựng ảnh dội âm và chia sẻ mục tiêu với đàn"
      },
      defense: {
        mode: "pod-body-check",
        power: 84,
        cooldownSeconds: 8,
        staminaCost: 21,
        special: "Đồng bộ va ép và quất đuôi theo vai trò đàn"
      },
      diet: {
        profileId: "piscivore",
        foodTags: ["fish", "cephalopod", "meat"],
        feedingMode: "coordinated-pod-hunt",
        qualityBonus: "diverse-marine-prey"
      },
      reproduction: {
        mode: "live-birth",
        offspring: [1, 1],
        maturityCycles: 18,
        care: "pod-calf-care",
        nestBiomeIds: ["pelagic-ocean", "polar-sea"]
      },
      audio: {
        voice: "procedural-click-whistle-pulse",
        channels: ["acoustic"],
        callIds: ["contact", "hunt", "echolocation", "parent-young"],
        rangeMeters: 9000,
        procedural: true
      },
      traits: [
        { id: "pod-learning", label: "Học chiến thuật đàn", value: 96 },
        { id: "echo-resolution", label: "Phân giải dội âm", value: 94 },
        { id: "breath-planning", label: "Lập nhịp thở", value: 88 }
      ]
    },
    {
      id: "giant-octopus",
      scientificName: "Enteroctopus dofleini",
      realmId: "modern",
      signature: "camouflage-squeeze-escape",
      locomotion: {
        mode: "jet-crawl-squeeze",
        habitats: ["water"],
        cruiseSpeed: 28,
        burstSpeed: 72,
        staminaCost: 24,
        special: {
          id: "crevice-squeeze",
          label: "Luồn khe theo kích thước mỏ",
          cooldownSeconds: 3,
          cost: 10
        }
      },
      sense: {
        mode: "polarized-vision-chemoreception",
        rangeMeters: 320,
        coneDegrees: 310,
        special: "Nếm dấu hóa học bằng giác hút và đọc ánh sáng phân cực"
      },
      defense: {
        mode: "chromatic-ink-decoy",
        power: 48,
        cooldownSeconds: 14,
        staminaCost: 26,
        special: "Đổi màu, tạo mồi nhử mực rồi chui khe"
      },
      diet: {
        profileId: "piscivore",
        foodTags: ["crustacean", "fish", "cephalopod"],
        feedingMode: "den-ambush",
        qualityBonus: "hard-shell-prey"
      },
      reproduction: {
        mode: "egg",
        offspring: [20, 100],
        maturityCycles: 9,
        care: "den-egg-guard",
        nestBiomeIds: ["kelp-forest", "coral-reef"]
      },
      audio: {
        voice: "procedural-water-jet-pulse",
        channels: ["vibration", "color"],
        callIds: ["alarm", "territorial", "courtship"],
        rangeMeters: 90,
        procedural: true
      },
      traits: [
        { id: "camouflage-match", label: "Khớp nền", value: 98 },
        { id: "problem-solving", label: "Giải bài toán môi trường", value: 92 },
        { id: "soft-body-access", label: "Tiếp cận khe hẹp", value: 96 }
      ]
    },
    {
      id: "spinosaurus",
      scientificName: "Spinosaurus aegyptiacus",
      realmId: "mesozoic",
      signature: "river-pressure-piscivore",
      locomotion: {
        mode: "amphibious-wade-swim",
        habitats: ["land", "water"],
        cruiseSpeed: 38,
        burstSpeed: 62,
        staminaCost: 16,
        special: {
          id: "current-brace",
          label: "Giữ thân trong dòng chảy",
          cooldownSeconds: 6,
          cost: 9
        }
      },
      sense: {
        mode: "water-pressure-sense",
        rangeMeters: 850,
        coneDegrees: 190,
        special: "Nhận rung động cá qua mõm khi đứng trong nước"
      },
      defense: {
        mode: "forelimb-swipe",
        power: 82,
        cooldownSeconds: 8,
        staminaCost: 24,
        special: "Quét móng để tạo khoảng trống rồi rút xuống nước"
      },
      diet: {
        profileId: "piscivore",
        foodTags: ["fish", "carcass", "meat"],
        feedingMode: "riverbank-ambush",
        qualityBonus: "fresh-fish"
      },
      reproduction: {
        mode: "egg",
        offspring: [2, 7],
        maturityCycles: 14,
        care: "raised-floodplain-nest",
        nestBiomeIds: ["mesozoic-coastal-wetland", "cretaceous-floodplain"]
      },
      audio: {
        voice: "procedural-water-boom-hiss",
        channels: ["acoustic", "vibration"],
        callIds: ["territorial", "courtship", "distress"],
        rangeMeters: 2200,
        procedural: true
      },
      traits: [
        { id: "river-control", label: "Kiểm soát dòng nước", value: 91 },
        { id: "pressure-reading", label: "Đọc áp lực nước", value: 94 },
        { id: "shore-turning", label: "Xoay trở trên bờ", value: 45 }
      ]
    },
    {
      id: "mammuthus",
      scientificName: "Mammuthus primigenius",
      realmId: "ice-age",
      signature: "herd-thermal-shelter",
      locomotion: {
        mode: "snow-plow-walk",
        habitats: ["land"],
        cruiseSpeed: 30,
        burstSpeed: 48,
        staminaCost: 12,
        special: {
          id: "snow-trail",
          label: "Mở đường tuyết cho đàn",
          cooldownSeconds: 7,
          cost: 11
        }
      },
      sense: {
        mode: "infrasonic-seismic",
        rangeMeters: 12000,
        coneDegrees: 360,
        special: "Cảm nhận tiếng trầm và chấn động xuyên mặt đất"
      },
      defense: {
        mode: "tusk-herd-wall",
        power: 88,
        cooldownSeconds: 10,
        staminaCost: 22,
        special: "Tạo thành chắn gió và tường ngà quanh con non"
      },
      diet: {
        profileId: "herbivore",
        foodTags: ["grass", "bark", "root"],
        feedingMode: "snow-dig-graze",
        qualityBonus: "mixed-cold-fiber"
      },
      reproduction: {
        mode: "live-birth",
        offspring: [1, 1],
        maturityCycles: 20,
        care: "matriarch-nursery",
        nestBiomeIds: ["mammoth-steppe", "ice-age-boreal-forest"]
      },
      audio: {
        voice: "procedural-infrasonic-rumble",
        channels: ["infrasonic", "vibration", "acoustic"],
        callIds: ["contact", "rally", "parent-young", "migration"],
        rangeMeters: 14000,
        procedural: true
      },
      traits: [
        { id: "cold-cohesion", label: "Giữ ấm theo đàn", value: 97 },
        { id: "snow-foraging", label: "Đào thức ăn dưới tuyết", value: 89 },
        { id: "route-memory", label: "Nhớ tuyến di cư", value: 95 }
      ]
    },
    {
      id: "wolf",
      scientificName: "Canis lupus",
      realmId: "modern",
      signature: "pack-scent-endurance",
      locomotion: {
        mode: "endurance-pack-run",
        habitats: ["land"],
        cruiseSpeed: 52,
        burstSpeed: 76,
        staminaCost: 10,
        special: {
          id: "relay-pursuit",
          label: "Đổi vai truy đuổi",
          cooldownSeconds: 5,
          cost: 8
        }
      },
      sense: {
        mode: "scent-track-hearing",
        rangeMeters: 3500,
        coneDegrees: 220,
        special: "So tuổi dấu chân, hướng gió và tiếng động trong đàn"
      },
      defense: {
        mode: "pack-feint",
        power: 62,
        cooldownSeconds: 6,
        staminaCost: 14,
        special: "Một cá thể nhử hướng để cá thể khác mở đường thoát"
      },
      diet: {
        profileId: "carnivore",
        foodTags: ["meat", "organ", "carcass"],
        feedingMode: "pack-share",
        qualityBonus: "fresh-varied-cuts"
      },
      reproduction: {
        mode: "live-birth",
        offspring: [2, 8],
        maturityCycles: 10,
        care: "cooperative-den-care",
        nestBiomeIds: ["modern-temperate-forest", "modern-savanna"]
      },
      audio: {
        voice: "procedural-howl-bark-growl",
        channels: ["acoustic"],
        callIds: ["contact", "alarm", "hunt", "rally", "parent-young"],
        rangeMeters: 8000,
        procedural: true
      },
      traits: [
        { id: "pack-role", label: "Vai trò bầy", value: 94 },
        { id: "track-persistence", label: "Bám dấu", value: 93 },
        { id: "endurance", label: "Sức bền đường dài", value: 90 }
      ]
    },
    {
      id: "honeybee",
      scientificName: "Apis mellifera",
      realmId: "modern",
      signature: "colony-waggle-pollination",
      locomotion: {
        mode: "six-axis-flight",
        habitats: ["air", "land"],
        cruiseSpeed: 42,
        burstSpeed: 68,
        staminaCost: 15,
        special: {
          id: "flower-route",
          label: "Tối ưu tuyến hoa",
          cooldownSeconds: 2,
          cost: 3
        }
      },
      sense: {
        mode: "polarized-light-pheromone",
        rangeMeters: 1200,
        coneDegrees: 280,
        special: "Đọc trời phân cực, mùi đàn và điện tích hoa"
      },
      defense: {
        mode: "colony-heat-sting",
        power: 36,
        cooldownSeconds: 20,
        staminaCost: 45,
        special: "Gọi cụm phòng vệ; ngòi là tài nguyên một lần"
      },
      diet: {
        profileId: "nectar-pollen",
        foodTags: ["nectar", "pollen", "honey"],
        feedingMode: "forage-and-store",
        qualityBonus: "mixed-flower-route"
      },
      reproduction: {
        mode: "colony-egg",
        offspring: [20, 100],
        maturityCycles: 5,
        care: "queen-worker-brood",
        nestBiomeIds: ["flower-meadow", "modern-temperate-forest"]
      },
      audio: {
        voice: "procedural-wing-buzz",
        channels: ["vibration", "scent", "posture"],
        callIds: ["navigation", "alarm", "colony-task"],
        rangeMeters: 120,
        procedural: true
      },
      traits: [
        { id: "waggle-vector", label: "Mã hóa hướng bằng điệu nhảy", value: 98 },
        { id: "colony-logistics", label: "Hậu cần đàn", value: 97 },
        { id: "pollination-memory", label: "Nhớ mùa hoa", value: 91 }
      ]
    },
    {
      id: "electric-eel",
      scientificName: "Electrophorus electricus",
      realmId: "modern",
      signature: "electric-field-hunter",
      locomotion: {
        mode: "anguilliform-swim-air-gulp",
        habitats: ["water"],
        cruiseSpeed: 31,
        burstSpeed: 57,
        staminaCost: 13,
        special: {
          id: "surface-breath-cycle",
          label: "Lập chu kỳ ngoi thở",
          cooldownSeconds: 8,
          cost: 6
        }
      },
      sense: {
        mode: "active-electroreception",
        rangeMeters: 45,
        coneDegrees: 360,
        special: "Dựng trường điện yếu để nhận vật cản và con mồi"
      },
      defense: {
        mode: "high-voltage-discharge",
        power: 90,
        cooldownSeconds: 13,
        staminaCost: 38,
        special: "Nạp điện theo thời gian; phóng mạnh làm cạn dự trữ"
      },
      diet: {
        profileId: "piscivore",
        foodTags: ["fish", "crustacean", "meat"],
        feedingMode: "electric-stun",
        qualityBonus: "fresh-river-prey"
      },
      reproduction: {
        mode: "egg",
        offspring: [10, 100],
        maturityCycles: 8,
        care: "foam-nest-guard",
        nestBiomeIds: ["modern-river"]
      },
      audio: {
        voice: "procedural-electric-pulse",
        channels: ["electric", "vibration"],
        callIds: ["territorial", "courtship", "navigation"],
        rangeMeters: 55,
        procedural: true
      },
      traits: [
        { id: "charge-capacity", label: "Dung lượng điện", value: 96 },
        { id: "field-resolution", label: "Phân giải điện trường", value: 93 },
        { id: "air-gulp-timing", label: "Nhịp ngoi thở", value: 86 }
      ]
    },
    {
      id: "ankylosaurus",
      scientificName: "Ankylosaurus magniventris",
      realmId: "mesozoic",
      signature: "armor-tail-zone-control",
      locomotion: {
        mode: "armored-low-walk",
        habitats: ["land"],
        cruiseSpeed: 23,
        burstSpeed: 38,
        staminaCost: 9,
        special: {
          id: "brace-and-pivot",
          label: "Trụ thấp xoay giáp",
          cooldownSeconds: 6,
          cost: 10
        }
      },
      sense: {
        mode: "ground-vibration-smell",
        rangeMeters: 1100,
        coneDegrees: 360,
        special: "Cảm rung bước chân ngoài vùng nhìn"
      },
      defense: {
        mode: "tail-club-arc",
        power: 94,
        cooldownSeconds: 12,
        staminaCost: 27,
        special: "Giữ đối thủ trong cung đuôi, giáp giảm sát thương bên sườn"
      },
      diet: {
        profileId: "herbivore",
        foodTags: ["fern", "leaf", "fruit"],
        feedingMode: "low-selective-browser",
        qualityBonus: "ferns-and-fruit"
      },
      reproduction: {
        mode: "egg",
        offspring: [1, 5],
        maturityCycles: 15,
        care: "concealed-armored-nest",
        nestBiomeIds: ["fern-prairie", "mesozoic-conifer-forest"]
      },
      audio: {
        voice: "procedural-low-thump-huff",
        channels: ["vibration", "acoustic"],
        callIds: ["alarm", "territorial", "parent-young"],
        rangeMeters: 1300,
        procedural: true
      },
      traits: [
        { id: "osteoderm-armor", label: "Giáp xương", value: 98 },
        { id: "tail-zone", label: "Kiểm soát cung đuôi", value: 95 },
        { id: "turn-speed", label: "Tốc độ xoay", value: 46 }
      ]
    },
    {
      id: "blue-whale",
      scientificName: "Balaenoptera musculus",
      realmId: "modern",
      signature: "ocean-song-lunge-filter",
      locomotion: {
        mode: "ocean-cruise-lunge-dive",
        habitats: ["water"],
        cruiseSpeed: 47,
        burstSpeed: 70,
        staminaCost: 11,
        special: {
          id: "dive-glide",
          label: "Lướt sâu tiết kiệm oxy",
          cooldownSeconds: 9,
          cost: 7
        }
      },
      sense: {
        mode: "low-frequency-hearing",
        rangeMeters: 50000,
        coneDegrees: 360,
        special: "Theo tiếng trầm, dòng nước và mật độ đàn nhuyễn thể"
      },
      defense: {
        mode: "mass-tail-escape",
        power: 78,
        cooldownSeconds: 10,
        staminaCost: 18,
        special: "Dùng khối lượng và quất đuôi để mở hành lang thoát"
      },
      diet: {
        profileId: "filter-feeder",
        foodTags: ["krill", "plankton", "small-school"],
        feedingMode: "lunge-filter",
        qualityBonus: "dense-krill-patch"
      },
      reproduction: {
        mode: "live-birth",
        offspring: [1, 1],
        maturityCycles: 22,
        care: "migratory-calf-care",
        nestBiomeIds: ["pelagic-ocean", "polar-sea"]
      },
      audio: {
        voice: "procedural-low-frequency-call",
        channels: ["infrasonic", "acoustic"],
        callIds: ["contact", "courtship", "migration", "parent-young"],
        rangeMeters: 50000,
        procedural: true
      },
      traits: [
        { id: "oxygen-reserve", label: "Dự trữ oxy", value: 96 },
        { id: "lunge-efficiency", label: "Hiệu suất lọc lao", value: 94 },
        { id: "ocean-navigation", label: "Định hướng đại dương", value: 97 }
      ]
    },
    {
      id: "pteranodon",
      scientificName: "Pteranodon longiceps",
      realmId: "mesozoic",
      signature: "coastal-thermal-wave-skimmer",
      locomotion: {
        mode: "cliff-launch-thermal-soar",
        habitats: ["air", "land"],
        cruiseSpeed: 67,
        burstSpeed: 91,
        staminaCost: 9,
        special: {
          id: "wave-lift-skimming",
          label: "Lướt sóng tích lực nâng",
          cooldownSeconds: 4,
          cost: 5
        }
      },
      sense: {
        mode: "long-range-coastal-vision",
        rangeMeters: 7600,
        coneDegrees: 210,
        special: "Đọc đàn cá, mặt sóng và cột khí ven biển từ độ cao lớn"
      },
      defense: {
        mode: "beak-feint-wing-burst",
        power: 54,
        cooldownSeconds: 7,
        staminaCost: 19,
        special: "Đánh mỏ giả hướng rồi bung cánh thoát lên luồng khí biển"
      },
      diet: {
        profileId: "piscivore",
        foodTags: ["fish", "cephalopod", "coastal-carcass"],
        feedingMode: "surface-fish-skim",
        qualityBonus: "fresh-shoaling-fish"
      },
      reproduction: {
        mode: "egg",
        offspring: [1, 2],
        maturityCycles: 11,
        care: "coastal-cliff-colony",
        nestBiomeIds: ["mesozoic-coastal-wetland", "mesozoic-volcanic-upland"]
      },
      audio: {
        voice: "procedural-beak-clatter-wing-rush",
        channels: ["acoustic", "vibration", "posture"],
        callIds: ["contact", "alarm", "courtship", "navigation", "parent-young"],
        rangeMeters: 2300,
        procedural: true
      },
      traits: [
        { id: "coastal-soaring", label: "Lượn dọc bờ biển", value: 97 },
        { id: "fish-spotting", label: "Phát hiện đàn cá", value: 94 },
        { id: "cliff-launch", label: "Cất cánh từ vách đá", value: 92 },
        { id: "ground-mobility", label: "Cơ động trên mặt đất", value: 41 }
      ]
    }
  ]);
  const FLAGSHIP_MECHANICS = deepFreeze(indexById(FLAGSHIPS));

  const ALL_CATALOG_IDS = deepFreeze(
    FLAGSHIP_IDS.concat(SIMULATED_SPECIES_IDS, CODEX_SPECIES_IDS)
  );

  const SPECIES_CATALOG = deepFreeze(ALL_CATALOG_IDS.map(function (id) {
    let tier = "codex";
    if (FLAGSHIP_IDS.includes(id)) tier = "flagship";
    else if (SIMULATED_SPECIES_IDS.includes(id)) tier = "simulated";
    const realmIds = REALMS.filter(function (realm) {
      return realm.speciesIds.includes(id);
    }).map(function (realm) {
      return realm.id;
    });
    return {
      id: id,
      tier: tier,
      realmIds: realmIds,
      capabilities: CATALOG_TIER_META[tier].capabilities
    };
  }));
  const SPECIES_CATALOG_BY_ID = deepFreeze(indexById(SPECIES_CATALOG));

  function getRealm(realmId) {
    return REALMS_BY_ID[String(realmId || "")] || null;
  }

  function getFlagshipMechanic(speciesId) {
    return FLAGSHIP_MECHANICS[String(speciesId || "")] || null;
  }

  function getSpeciesCatalogEntry(speciesId) {
    return SPECIES_CATALOG_BY_ID[String(speciesId || "")] || null;
  }

  function getCatalogTier(speciesId) {
    const entry = getSpeciesCatalogEntry(speciesId);
    return entry ? entry.tier : null;
  }

  function isKnownSpecies(speciesId) {
    return Boolean(getSpeciesCatalogEntry(speciesId));
  }

  function convergenceEnabled(options) {
    return options === true || Boolean(isPlainObject(options) && options.convergence === true);
  }

  function isSpeciesAllowedInRealm(realmId, speciesId, options) {
    const realm = getRealm(realmId);
    const entry = getSpeciesCatalogEntry(speciesId);
    if (!realm || !entry) return false;
    if (realm.speciesIds.includes(entry.id)) return true;
    return convergenceEnabled(options) && entry.tier !== "codex";
  }

  function listAllowedSpecies(realmId, options) {
    const realm = getRealm(realmId);
    if (!realm) return deepFreeze([]);
    if (convergenceEnabled(options)) {
      return deepFreeze(FLAGSHIP_IDS.concat(SIMULATED_SPECIES_IDS));
    }
    return deepFreeze(realm.speciesIds.slice());
  }

  function canSpeciesCoexist(firstSpeciesId, secondSpeciesId, options) {
    const first = getSpeciesCatalogEntry(firstSpeciesId);
    const second = getSpeciesCatalogEntry(secondSpeciesId);
    if (!first || !second || first.tier === "codex" || second.tier === "codex") return false;
    const sameRealm = first.realmIds.some(function (realmId) {
      return second.realmIds.includes(realmId);
    });
    return sameRealm || convergenceEnabled(options);
  }

  function validateRealmSelection(realmId, speciesIds, options) {
    const errors = [];
    const realm = getRealm(realmId);
    const ids = Array.isArray(speciesIds) ? speciesIds.slice(0, LIMITS.catalogSpecies + 1) : [];
    if (!realm) errors.push("Unknown realm: " + String(realmId || ""));
    if (!Array.isArray(speciesIds)) errors.push("speciesIds must be an array");
    if (ids.length > LIMITS.speciesPerRealm) errors.push("Realm selection exceeds species limit");
    if (hasDuplicates(ids)) errors.push("Realm selection contains duplicate species");
    ids.forEach(function (id) {
      if (!isKnownSpecies(id)) errors.push("Unknown species: " + String(id));
      else if (!isSpeciesAllowedInRealm(realmId, id, options)) {
        errors.push("Species is not allowed in realm: " + String(id));
      }
    });
    return validationResult(errors);
  }

  function normalizeGenes(value) {
    const source = isPlainObject(value) ? value : {};
    const result = Object.create(null);
    GENE_KEYS.forEach(function (key) {
      const schema = GENE_SCHEMA[key];
      result[key] = rounded(
        clamp(source[key], schema.min, schema.max, schema.default),
        schema.precision
      );
    });
    return deepFreeze(result);
  }

  function seedHash(value) {
    const text = String(value === undefined ? "eonwild-v2" : value).slice(0, LIMITS.seedLength);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash = Math.imul(hash ^ text.charCodeAt(index), 16777619) >>> 0;
    }
    return hash || 1;
  }

  function createSeededRandom(seed) {
    let state = seedHash(seed);
    return function nextRandom() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
  }

  function mutateGenes(genes, options) {
    const source = normalizeGenes(genes);
    const config = isPlainObject(options) ? options : {};
    const rate = clamp(config.rate, 0, 1, 0.08);
    const strength = clamp(config.strength, 0, 1, 0.2);
    const random = createSeededRandom(config.seed);
    const result = Object.create(null);
    GENE_KEYS.forEach(function (key) {
      const schema = GENE_SCHEMA[key];
      let value = source[key];
      if (random() < rate) {
        const span = schema.max - schema.min;
        value += (random() * 2 - 1) * span * schema.mutationScale * strength;
      }
      result[key] = rounded(clamp(value, schema.min, schema.max, schema.default), schema.precision);
    });
    return deepFreeze(result);
  }

  function inheritGenes(firstParent, secondParent, options) {
    const first = normalizeGenes(firstParent);
    const second = normalizeGenes(secondParent);
    const config = isPlainObject(options) ? options : {};
    const dominance = clamp(config.firstParentDominance, 0, 1, 0.5);
    const random = createSeededRandom(config.seed);
    const inherited = Object.create(null);
    GENE_KEYS.forEach(function (key) {
      const schema = GENE_SCHEMA[key];
      const jitter = (random() - 0.5) * 0.3;
      const firstWeight = clamp(dominance + jitter, 0.2, 0.8, 0.5);
      inherited[key] = rounded(
        clamp(first[key] * firstWeight + second[key] * (1 - firstWeight), schema.min, schema.max, schema.default),
        schema.precision
      );
    });
    return mutateGenes(inherited, {
      seed: String(config.seed === undefined ? "eonwild-v2" : config.seed) + ":mutation",
      rate: clamp(config.mutationRate, 0, 1, 0.03),
      strength: clamp(config.mutationStrength, 0, 1, 0.12)
    });
  }

  function validateGeneProfile(genes) {
    const errors = [];
    if (!isPlainObject(genes)) return validationResult(["Gene profile must be an object"]);
    const unknown = Object.keys(genes).filter(function (key) {
      return !Object.hasOwn(GENE_SCHEMA, key);
    });
    if (unknown.length) errors.push("Unknown genes: " + unknown.slice(0, 8).join(", "));
    GENE_KEYS.forEach(function (key) {
      const schema = GENE_SCHEMA[key];
      if (!Object.hasOwn(genes, key)) errors.push("Missing gene: " + key);
      else if (!Number.isFinite(Number(genes[key]))) errors.push("Gene is not finite: " + key);
      else if (Number(genes[key]) < schema.min || Number(genes[key]) > schema.max) {
        errors.push("Gene out of bounds: " + key);
      }
    });
    return validationResult(errors);
  }

  function isValidGeneProfile(genes) {
    return validateGeneProfile(genes).valid;
  }

  function normalizeInjuryState(value) {
    const source = isPlainObject(value) ? value : {};
    const result = {
      temperatureC: rounded(
        clamp(
          source.temperatureC,
          INJURY_STATE_BOUNDS.temperatureC[0],
          INJURY_STATE_BOUNDS.temperatureC[1],
          DEFAULT_INJURY_STATE.temperatureC
        ),
        2
      ),
      oxygen: rounded(
        clamp(
          source.oxygen,
          INJURY_STATE_BOUNDS.oxygen[0],
          INJURY_STATE_BOUNDS.oxygen[1],
          DEFAULT_INJURY_STATE.oxygen
        ),
        2
      )
    };
    INJURIES.forEach(function (injury) {
      result[injury.id] = rounded(
        clamp(source[injury.id], injury.severity[0], injury.severity[1], 0),
        2
      );
    });
    return deepFreeze(result);
  }

  function applyInjury(state, injuryId, severityDelta) {
    const next = Object.assign({}, normalizeInjuryState(state));
    const definition = INJURY_CATALOG[String(injuryId || "")];
    if (!definition) return deepFreeze(next);
    next[definition.id] = rounded(
      clamp(
        next[definition.id] + clamp(severityDelta, -100, 100, 0),
        definition.severity[0],
        definition.severity[1],
        next[definition.id]
      ),
      2
    );
    return deepFreeze(next);
  }

  function getInjuryEffects(state) {
    const source = normalizeInjuryState(state);
    let healthDrainPerMinute = 0;
    let movementMultiplier = 1;
    let staminaMultiplier = 1;
    let infectionRisk = 0;
    INJURIES.forEach(function (injury) {
      const ratio = source[injury.id] / 100;
      healthDrainPerMinute += injury.healthDrainAtMaxPerMinute * ratio;
      movementMultiplier *= 1 - (1 - injury.movementMultiplierAtMax) * ratio;
      staminaMultiplier *= 1 - (1 - injury.staminaMultiplierAtMax) * ratio;
      infectionRisk += injury.infectionRiskAtMax * ratio;
    });
    if (source.oxygen < 70) {
      const oxygenRatio = (70 - source.oxygen) / 70;
      staminaMultiplier *= 1 - oxygenRatio * 0.55;
      healthDrainPerMinute += Math.max(0, 35 - source.oxygen) / 7;
    }
    return deepFreeze({
      healthDrainPerMinute: rounded(clamp(healthDrainPerMinute, 0, 50, 0), 4),
      movementMultiplier: rounded(clamp(movementMultiplier, 0.1, 1, 1), 4),
      staminaMultiplier: rounded(clamp(staminaMultiplier, 0.1, 1, 1), 4),
      infectionRisk: rounded(clamp(infectionRisk, 0, 1, 0), 4)
    });
  }

  function validateInjuryState(state) {
    const errors = [];
    if (!isPlainObject(state)) return validationResult(["Injury state must be an object"]);
    const allowed = ["temperatureC", "oxygen"].concat(INJURIES.map(function (injury) {
      return injury.id;
    }));
    Object.keys(state).forEach(function (key) {
      if (!allowed.includes(key)) errors.push("Unknown injury field: " + key);
    });
    allowed.forEach(function (key) {
      if (!Object.hasOwn(state, key)) errors.push("Missing injury field: " + key);
      else if (!Number.isFinite(Number(state[key]))) errors.push("Injury field is not finite: " + key);
    });
    if (Number(state.temperatureC) < INJURY_STATE_BOUNDS.temperatureC[0] ||
        Number(state.temperatureC) > INJURY_STATE_BOUNDS.temperatureC[1]) {
      errors.push("temperatureC out of bounds");
    }
    if (Number(state.oxygen) < 0 || Number(state.oxygen) > 100) errors.push("oxygen out of bounds");
    INJURIES.forEach(function (injury) {
      const severity = Number(state[injury.id]);
      if (severity < injury.severity[0] || severity > injury.severity[1]) {
        errors.push("Injury severity out of bounds: " + injury.id);
      }
    });
    return validationResult(errors);
  }

  function normalizeDietIntake(value) {
    const source = isPlainObject(value) ? value : {};
    const result = Object.create(null);
    DIET_NUTRIENTS.forEach(function (key) {
      result[key] = rounded(clamp(source[key], 0, 100, DEFAULT_DIET_INTAKE[key]), 2);
    });
    result.toxins = rounded(clamp(source.toxins, 0, 100, 0), 2);
    result.spoilage = rounded(clamp(source.spoilage, 0, 100, 0), 2);
    return deepFreeze(result);
  }

  function dietGrade(score) {
    if (score >= DIET_QUALITY_GRADES.excellent[0]) return "excellent";
    if (score >= DIET_QUALITY_GRADES.adequate[0]) return "adequate";
    if (score >= DIET_QUALITY_GRADES.poor[0]) return "poor";
    return "critical";
  }

  function evaluateDietQuality(profileId, intake) {
    const profile = DIET_CATALOG[String(profileId || "")];
    if (!profile) {
      return deepFreeze({
        valid: false,
        score: 0,
        grade: "critical",
        deficiencies: DIET_NUTRIENTS.slice(),
        errors: ["Unknown diet profile"]
      });
    }
    const normalized = normalizeDietIntake(intake);
    const deficiencies = [];
    let adequacy = 0;
    DIET_NUTRIENTS.forEach(function (key) {
      const target = profile.targets[key];
      const ratio = Math.min(1, normalized[key] / Math.max(1, target));
      adequacy += ratio;
      if (ratio < 0.65) deficiencies.push(key);
    });
    const baseScore = adequacy / DIET_NUTRIENTS.length * 100;
    const toxinPenalty = Math.max(0, normalized.toxins - profile.toxinTolerance) * 0.55;
    const spoilagePenalty = Math.max(0, normalized.spoilage - profile.spoilageTolerance) * 0.4;
    const score = rounded(clamp(baseScore - toxinPenalty - spoilagePenalty, 0, 100, 0), 2);
    return deepFreeze({
      valid: true,
      profileId: profile.id,
      score: score,
      grade: dietGrade(score),
      deficiencies: deficiencies,
      penalties: {
        toxins: rounded(toxinPenalty, 2),
        spoilage: rounded(spoilagePenalty, 2)
      },
      intake: normalized,
      errors: []
    });
  }

  function validateDietProfile(profile) {
    const errors = [];
    if (!isPlainObject(profile)) return validationResult(["Diet profile must be an object"]);
    if (typeof profile.id !== "string" || !profile.id) errors.push("Diet profile requires id");
    if (!Array.isArray(profile.foodTags) || profile.foodTags.length < 1 || profile.foodTags.length > 12) {
      errors.push("Diet profile foodTags must contain 1–12 values");
    }
    if (!isPlainObject(profile.targets)) errors.push("Diet profile requires targets");
    else {
      DIET_NUTRIENTS.forEach(function (key) {
        if (!Number.isFinite(Number(profile.targets[key]))) errors.push("Invalid diet target: " + key);
        else if (Number(profile.targets[key]) < 0 || Number(profile.targets[key]) > 100) {
          errors.push("Diet target out of bounds: " + key);
        }
      });
    }
    if (Number(profile.toxinTolerance) < 0 || Number(profile.toxinTolerance) > 100) {
      errors.push("toxinTolerance out of bounds");
    }
    if (Number(profile.spoilageTolerance) < 0 || Number(profile.spoilageTolerance) > 100) {
      errors.push("spoilageTolerance out of bounds");
    }
    return validationResult(errors);
  }

  function validateCommunicationCall(callOrId) {
    const call = typeof callOrId === "string" ? COMMUNICATION_CALLS[callOrId] : callOrId;
    const errors = [];
    if (!isPlainObject(call)) return validationResult(["Communication call must be an object or known id"]);
    if (typeof call.id !== "string" || !call.id) errors.push("Communication call requires id");
    if (!Array.isArray(call.channelIds) || call.channelIds.length < 1) {
      errors.push("Communication call requires channels");
    } else {
      call.channelIds.forEach(function (channelId) {
        if (!COMMUNICATION_CHANNELS.includes(channelId)) {
          errors.push("Unknown communication channel: " + String(channelId));
        }
      });
    }
    if (!Number.isFinite(Number(call.radiusMeters)) || Number(call.radiusMeters) < 0 ||
        Number(call.radiusMeters) > 50000) errors.push("Communication radius out of bounds");
    if (!Number.isFinite(Number(call.energyCost)) || Number(call.energyCost) < 0 ||
        Number(call.energyCost) > 100) errors.push("Communication energy cost out of bounds");
    if (!Number.isFinite(Number(call.cooldownSeconds)) || Number(call.cooldownSeconds) < 0 ||
        Number(call.cooldownSeconds) > 600) errors.push("Communication cooldown out of bounds");
    return validationResult(errors);
  }

  function isCommunicationCallAllowed(speciesId, callId) {
    const flagship = getFlagshipMechanic(speciesId);
    return Boolean(flagship && flagship.audio.callIds.includes(String(callId || "")));
  }

  function validateRealm(realm) {
    const errors = [];
    if (!isPlainObject(realm)) return validationResult(["Realm must be an object"]);
    if (!REALM_IDS.includes(realm.id)) errors.push("Unknown realm id: " + String(realm.id));
    if (!Array.isArray(realm.rangeMya) || realm.rangeMya.length !== 2 ||
        !realm.rangeMya.every(function (value) { return Number.isFinite(Number(value)); })) {
      errors.push("Realm requires a two-value rangeMya");
    }
    if (!Array.isArray(realm.periods) || realm.periods.length < 1 || realm.periods.length > 8) {
      errors.push("Realm periods must contain 1–8 values");
    }
    if (!Array.isArray(realm.speciesIds) || realm.speciesIds.length > LIMITS.speciesPerRealm) {
      errors.push("Realm species allowlist is invalid");
    } else {
      if (hasDuplicates(realm.speciesIds)) errors.push("Realm species allowlist has duplicates");
      realm.speciesIds.forEach(function (id) {
        if (!ALL_CATALOG_IDS.includes(id)) errors.push("Unknown realm species: " + String(id));
        if (CODEX_SPECIES_IDS.includes(id)) errors.push("Codex-only species cannot spawn: " + String(id));
      });
    }
    if (!Array.isArray(realm.biomeIds) || realm.biomeIds.length > LIMITS.biomesPerRealm) {
      errors.push("Realm biome allowlist is invalid");
    } else {
      if (hasDuplicates(realm.biomeIds)) errors.push("Realm biome allowlist has duplicates");
      realm.biomeIds.forEach(function (id) {
        if (!BIOME_CATALOG[id]) errors.push("Unknown realm biome: " + String(id));
      });
    }
    if (!Array.isArray(realm.eventIds) || realm.eventIds.length > LIMITS.eventsPerRealm) {
      errors.push("Realm event allowlist is invalid");
    } else {
      if (hasDuplicates(realm.eventIds)) errors.push("Realm event allowlist has duplicates");
      realm.eventIds.forEach(function (id) {
        const event = EVENT_CATALOG[id];
        if (!event) errors.push("Unknown realm event: " + String(id));
        else if (event.realmId !== realm.id) errors.push("Event belongs to another realm: " + id);
        else if (event.biomeIds.some(function (biomeId) { return !realm.biomeIds.includes(biomeId); })) {
          errors.push("Event uses a biome outside realm: " + id);
        }
      });
    }
    return validationResult(errors);
  }

  function validateFlagship(flagship) {
    const errors = [];
    if (!isPlainObject(flagship)) return validationResult(["Flagship mechanic must be an object"]);
    if (!FLAGSHIP_IDS.includes(flagship.id)) errors.push("Unknown flagship id: " + String(flagship.id));
    if (!getRealm(flagship.realmId)) errors.push("Unknown flagship realm: " + String(flagship.realmId));
    else if (!getRealm(flagship.realmId).speciesIds.includes(flagship.id)) {
      errors.push("Flagship is absent from its realm allowlist: " + String(flagship.id));
    }
    if (typeof flagship.signature !== "string" || !flagship.signature) {
      errors.push("Flagship requires a unique signature");
    }
    ["locomotion", "sense", "defense", "diet", "reproduction", "audio"].forEach(function (key) {
      if (!isPlainObject(flagship[key])) errors.push("Flagship requires " + key);
    });
    if (isPlainObject(flagship.locomotion)) {
      if (!Array.isArray(flagship.locomotion.habitats) || !flagship.locomotion.habitats.length) {
        errors.push("Flagship locomotion requires habitats");
      }
      ["cruiseSpeed", "burstSpeed", "staminaCost"].forEach(function (key) {
        const value = Number(flagship.locomotion[key]);
        if (!Number.isFinite(value) || value < 0 || value > 100) {
          errors.push("Flagship locomotion value out of bounds: " + key);
        }
      });
      if (!isPlainObject(flagship.locomotion.special) ||
          typeof flagship.locomotion.special.id !== "string") {
        errors.push("Flagship locomotion requires special mechanic");
      }
    }
    if (isPlainObject(flagship.sense)) {
      if (!Number.isFinite(Number(flagship.sense.rangeMeters)) ||
          Number(flagship.sense.rangeMeters) < 0 || Number(flagship.sense.rangeMeters) > 50000) {
        errors.push("Flagship sense range out of bounds");
      }
      if (!Number.isFinite(Number(flagship.sense.coneDegrees)) ||
          Number(flagship.sense.coneDegrees) < 0 || Number(flagship.sense.coneDegrees) > 360) {
        errors.push("Flagship sense cone out of bounds");
      }
    }
    if (isPlainObject(flagship.defense)) {
      ["power", "staminaCost"].forEach(function (key) {
        const value = Number(flagship.defense[key]);
        if (!Number.isFinite(value) || value < 0 || value > 100) {
          errors.push("Flagship defense value out of bounds: " + key);
        }
      });
      if (!Number.isFinite(Number(flagship.defense.cooldownSeconds)) ||
          Number(flagship.defense.cooldownSeconds) < 0 ||
          Number(flagship.defense.cooldownSeconds) > 120) {
        errors.push("Flagship defense cooldown out of bounds");
      }
    }
    if (isPlainObject(flagship.diet) && !DIET_CATALOG[flagship.diet.profileId]) {
      errors.push("Unknown flagship diet: " + String(flagship.diet.profileId));
    }
    if (isPlainObject(flagship.reproduction)) {
      if (!Array.isArray(flagship.reproduction.offspring) ||
          flagship.reproduction.offspring.length !== 2 ||
          flagship.reproduction.offspring.some(function (value) {
            return !Number.isInteger(value) || value < 1 || value > 100;
          }) ||
          flagship.reproduction.offspring[0] > flagship.reproduction.offspring[1]) {
        errors.push("Flagship offspring bounds are invalid");
      }
      if (!Array.isArray(flagship.reproduction.nestBiomeIds) ||
          flagship.reproduction.nestBiomeIds.some(function (id) {
            return !getRealm(flagship.realmId) || !getRealm(flagship.realmId).biomeIds.includes(id);
          })) {
        errors.push("Flagship reproduction uses an invalid biome");
      }
    }
    if (isPlainObject(flagship.audio)) {
      if (flagship.audio.procedural !== true) errors.push("Flagship audio must be procedural");
      if (!Array.isArray(flagship.audio.channels) ||
          flagship.audio.channels.some(function (channel) {
            return !COMMUNICATION_CHANNELS.includes(channel);
          })) errors.push("Flagship audio has invalid channels");
      if (!Array.isArray(flagship.audio.callIds) ||
          flagship.audio.callIds.some(function (id) { return !COMMUNICATION_CALLS[id]; })) {
        errors.push("Flagship audio has invalid calls");
      }
      if (!Number.isFinite(Number(flagship.audio.rangeMeters)) ||
          Number(flagship.audio.rangeMeters) < 0 ||
          Number(flagship.audio.rangeMeters) > 50000) {
        errors.push("Flagship audio range out of bounds");
      }
    }
    if (!Array.isArray(flagship.traits) || flagship.traits.length < 2 ||
        flagship.traits.length > LIMITS.traitsPerFlagship) {
      errors.push("Flagship traits must contain 2–" + LIMITS.traitsPerFlagship + " values");
    } else {
      flagship.traits.forEach(function (trait) {
        if (!isPlainObject(trait) || typeof trait.id !== "string" ||
            !Number.isFinite(Number(trait.value)) ||
            Number(trait.value) < 0 || Number(trait.value) > 100) {
          errors.push("Flagship has an invalid trait");
        }
      });
    }
    return validationResult(errors);
  }

  function validateCatalog() {
    const errors = [];
    if (ALL_CATALOG_IDS.length > LIMITS.catalogSpecies) errors.push("Catalog exceeds species limit");
    if (hasDuplicates(ALL_CATALOG_IDS)) errors.push("Catalog species appear in multiple tiers");
    Object.keys(CATALOG_TIERS).forEach(function (tier) {
      if (!CATALOG_TIER_META[tier]) errors.push("Unknown catalog tier: " + tier);
    });
    SPECIES_CATALOG.forEach(function (entry) {
      if (!CATALOG_TIERS[entry.tier].includes(entry.id)) {
        errors.push("Catalog tier mismatch: " + entry.id);
      }
      if (entry.tier === "codex" && entry.realmIds.length) {
        errors.push("Codex-only species has a spawn realm: " + entry.id);
      }
    });
    return validationResult(errors);
  }

  function validateContent() {
    const errors = [];
    if (REALMS.length !== LIMITS.realms) errors.push("Content must define exactly four realms");
    if (FLAGSHIPS.length !== LIMITS.flagshipSpecies) {
      errors.push("Content must define exactly thirteen flagship species");
    }
    if (hasDuplicates(REALMS.map(function (realm) { return realm.id; }))) {
      errors.push("Realm ids must be unique");
    }
    if (hasDuplicates(FLAGSHIPS.map(function (flagship) { return flagship.signature; }))) {
      errors.push("Flagship signatures must be unique");
    }
    if (hasDuplicates(FLAGSHIPS.map(function (flagship) {
      return flagship.locomotion.special.id;
    }))) errors.push("Flagship locomotion mechanics must be unique");
    REALMS.forEach(function (realm) {
      const result = validateRealm(realm);
      result.errors.forEach(function (error) {
        errors.push(realm.id + ": " + error);
      });
    });
    FLAGSHIPS.forEach(function (flagship) {
      const result = validateFlagship(flagship);
      result.errors.forEach(function (error) {
        errors.push(flagship.id + ": " + error);
      });
    });
    DIETS.forEach(function (profile) {
      const result = validateDietProfile(profile);
      result.errors.forEach(function (error) {
        errors.push(profile.id + ": " + error);
      });
    });
    COMMUNICATION_CALL_LIST.forEach(function (call) {
      const result = validateCommunicationCall(call);
      result.errors.forEach(function (error) {
        errors.push(call.id + ": " + error);
      });
    });
    const catalogResult = validateCatalog();
    catalogResult.errors.forEach(function (error) {
      errors.push("catalog: " + error);
    });
    return validationResult(errors);
  }

  const CONTENT_VALIDATION = validateContent();

  return deepFreeze({
    VERSION: VERSION,
    version: VERSION,
    SCHEMA_VERSION: SCHEMA_VERSION,
    LIMITS: LIMITS,
    REALM_IDS: REALM_IDS,
    REALMS: REALMS,
    REALMS_BY_ID: REALMS_BY_ID,
    REALM_POLICY: REALM_POLICY,
    BIOMES: BIOMES,
    BIOME_CATALOG: BIOME_CATALOG,
    EVENTS: EVENTS,
    EVENT_CATALOG: EVENT_CATALOG,
    FLAGSHIP_IDS: FLAGSHIP_IDS,
    FLAGSHIPS: FLAGSHIPS,
    FLAGSHIP_MECHANICS: FLAGSHIP_MECHANICS,
    DIET_NUTRIENTS: DIET_NUTRIENTS,
    DIETS: DIETS,
    DIET_CATALOG: DIET_CATALOG,
    DIET_QUALITY_GRADES: DIET_QUALITY_GRADES,
    DEFAULT_DIET_INTAKE: DEFAULT_DIET_INTAKE,
    INJURIES: INJURIES,
    INJURY_CATALOG: INJURY_CATALOG,
    INJURY_STATE_BOUNDS: INJURY_STATE_BOUNDS,
    DEFAULT_INJURY_STATE: DEFAULT_INJURY_STATE,
    GENE_SCHEMA: GENE_SCHEMA,
    GENE_KEYS: GENE_KEYS,
    DEFAULT_GENES: DEFAULT_GENES,
    COMMUNICATION_CHANNELS: COMMUNICATION_CHANNELS,
    COMMUNICATION_CALL_LIST: COMMUNICATION_CALL_LIST,
    COMMUNICATION_CALLS: COMMUNICATION_CALLS,
    CATALOG_TIERS: CATALOG_TIERS,
    CATALOG_TIER_META: CATALOG_TIER_META,
    SPECIES_CATALOG: SPECIES_CATALOG,
    SPECIES_CATALOG_BY_ID: SPECIES_CATALOG_BY_ID,
    CONTENT_VALIDATION: CONTENT_VALIDATION,
    getRealm: getRealm,
    getFlagshipMechanic: getFlagshipMechanic,
    getSpeciesCatalogEntry: getSpeciesCatalogEntry,
    getCatalogTier: getCatalogTier,
    isKnownSpecies: isKnownSpecies,
    isSpeciesAllowedInRealm: isSpeciesAllowedInRealm,
    isSpeciesAllowed: isSpeciesAllowedInRealm,
    listAllowedSpecies: listAllowedSpecies,
    canSpeciesCoexist: canSpeciesCoexist,
    validateRealmSelection: validateRealmSelection,
    normalizeGenes: normalizeGenes,
    mutateGenes: mutateGenes,
    mutateGeneProfile: mutateGenes,
    inheritGenes: inheritGenes,
    inheritGeneProfile: inheritGenes,
    validateGeneProfile: validateGeneProfile,
    validateGenes: validateGeneProfile,
    isValidGeneProfile: isValidGeneProfile,
    normalizeInjuryState: normalizeInjuryState,
    applyInjury: applyInjury,
    getInjuryEffects: getInjuryEffects,
    validateInjuryState: validateInjuryState,
    normalizeDietIntake: normalizeDietIntake,
    evaluateDietQuality: evaluateDietQuality,
    validateDietProfile: validateDietProfile,
    validateCommunicationCall: validateCommunicationCall,
    isCommunicationCallAllowed: isCommunicationCallAllowed,
    validateRealm: validateRealm,
    validateFlagship: validateFlagship,
    validateFlagshipMechanic: validateFlagship,
    validateCatalog: validateCatalog,
    validateContent: validateContent,
    isValidContent: function isValidContent() {
      return validateContent().valid;
    }
  });
});
