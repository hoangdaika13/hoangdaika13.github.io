const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const gameSource = read("hh-eonwild-game.js");
const contentSource = read("hh-eonwild-content-v2.js");
const simulationSource = read("hh-eonwild-simulation-v2.js");
const core3dSource = read("hh-eonwild-3d-core.js");
const renderer3dSource = read("hh-eonwild-renderer-3d.js");
const css = read("hh-eonwild-game.css");
const router = read("script.js");
const loader = read("performance-loader.js");
const worker = read("sw.js");
const html = read("index.html");

const game = require(path.join(root, "hh-eonwild-game.js"));
const content = require(path.join(root, "hh-eonwild-content-v2.js"));
const simulation = require(path.join(root, "hh-eonwild-simulation-v2.js"));
const core3d = require(path.join(root, "hh-eonwild-3d-core.js"));
const renderer3d = require(path.join(root, "hh-eonwild-renderer-3d.js"));
const worldAtlas = require(path.join(root, "hh-eonwild-world-atlas.js"));
const speciesRegistry = require(path.join(root, "hh-eonwild-species-registry.js"));
const assetManifest = JSON.parse(read("assets/eonwild/asset-manifest.v1.json"));

const FLAGSHIP_IDS = [
  "tyrannosaurus", "triceratops", "argentavis", "orca", "giant-octopus", "spinosaurus",
  "mammuthus", "wolf", "honeybee", "electric-eel", "ankylosaurus", "blue-whale", "pteranodon"
];
const ERA_REALMS = ["paleozoic", "mesozoic", "ice-age", "modern"];
const UTILITY_ACTIONS = ["hunt", "flee", "drink", "feed", "rest", "migrate", "mate", "guardNest"];
const HUMAN_TAXON = /(?:\bhomo\b|\bhuman\b|\bperson\b|\bpeople\b|người)/iu;

const extractFunctionSource = (source, name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = source.indexOf("\n  function ", start + `function ${name}(`.length);
  return source.slice(start, end < 0 ? source.length : end).trim();
};

const extractConditionalBody = (source, condition) => {
  const conditionIndex = source.indexOf(condition);
  assert.notEqual(conditionIndex, -1, `missing condition ${condition}`);
  const openingBrace = source.indexOf("{", conditionIndex + condition.length);
  assert.notEqual(openingBrace, -1, `missing block for ${condition}`);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openingBrace + 1, index);
    }
  }
  assert.fail(`unterminated block for ${condition}`);
};

test("Codex exposes 346 unique species and documents exactly three source overlaps", () => {
  const normalized = (name) => String(name || "").trim().toLocaleLowerCase("en");
  const legacyNames = new Map(game.SPECIES.map((species) => [normalized(species.name), species.name]));
  const registryNames = new Set(speciesRegistry.species.map((species) => normalized(species.scientificName)));
  const overlaps = [...legacyNames]
    .filter(([name]) => registryNames.has(name))
    .map(([, name]) => name)
    .sort((left, right) => left.localeCompare(right, "en"));
  const mergedNames = [
    ...game.SPECIES.map((species) => normalized(species.name)),
    ...speciesRegistry.species.map((species) => normalized(species.scientificName))
  ];

  assert.deepEqual(overlaps, ["Apis mellifera", "Loxodonta africana", "Macropus giganteus"]);
  assert.equal(new Set(mergedNames).size, 346);
  assert.equal(game.MERGED_SPECIES_COUNT, 346);
  assert.equal(game.MERGED_DUPLICATE_COUNT, 3);
  assert.equal(game.IMPORTED_SPECIES.length, 297);
  assert.equal(
    game.IMPORTED_SPECIES.every((species) => !legacyNames.has(normalized(species.scientificName))),
    true,
    "the runtime registry must exclude every documented overlap"
  );
});

test("paused input consumes buffered gameplay actions without invoking them", () => {
  const processInputActions = Function(
    "performance", "global", "setPhotoMode", "setCommunicationWheel", "closeGameOverlay", "pauseGame", "openGameOverlay", "toggleViewMode", "toggleTargetLock", "isGameplayActive",
    "interact", "sense", "useFlagshipAbility", "defend",
    `"use strict"; return (${extractFunctionSource(gameSource, "processInputActions")});`
  )(
    { now: () => 0 }, { location: { hash: "#/game/world" } }, () => {}, () => {}, () => {}, (instance) => { instance.paused = true; }, () => {}, () => {}, () => {}, () => true,
    () => calls.push("interact"), () => calls.push("sense"),
    () => calls.push("ability"), () => calls.push("jump")
  );
  const gameplayActions = ["interact", "sense", "ability", "jump"];
  const calls = [];
  const run = ({ paused, includePause = false }) => {
    const queued = new Set([...gameplayActions, ...(includePause ? ["pause"] : [])]);
    const instance = {
      paused,
      photoMode: false,
      inputSystem: {
        disposed: false,
        wasPressed(actionId) {
          if (!queued.has(actionId)) return false;
          queued.delete(actionId);
          return true;
        }
      },
      root: {
        querySelector(selector) {
          if (selector === "[data-hwe-communication-wheel]") return { hidden: true };
          if (selector === "[data-hwe-pause]") return { click() { instance.paused = !instance.paused; } };
          return null;
        }
      }
    };
    processInputActions(instance, 10);
    return { instance, queued };
  };

  run({ paused: true });
  assert.deepEqual(calls, [], "an already-paused frame must not invoke gameplay actions");

  const sameFrame = run({ paused: false, includePause: true });
  assert.equal(sameFrame.instance.paused, true);
  assert.deepEqual(calls, [], "pressing pause must block actions buffered in the same frame");
  assert.equal(gameplayActions.every((actionId) => !sameFrame.queued.has(actionId)), true);

  run({ paused: false });
  assert.deepEqual(calls, gameplayActions, "unpaused gameplay actions must remain usable");
});

test("the Babylon render loop owns camera collision without a duplicate route raycast", () => {
  const cameraUpdate = extractFunctionSource(gameSource, "updateGameplayCamera");
  assert.match(gameSource, /cameraCollisionOwner:\s*"renderer"/);
  assert.match(cameraUpdate, /rendererOwnsCameraCollision\s*=\s*instance\.renderer3d\?\.cameraCollisionOwner\s*===\s*"renderer"/);
  assert.match(cameraUpdate, /rendererOwnsCameraCollision\s*\?\s*null\s*:\s*instance\.renderer3d\?\.resolveCameraCollision/);
});

test("Atlas telemetry describes planner candidates as prioritized, never loaded", () => {
  const updateHudSource = extractFunctionSource(gameSource, "updateHud");
  assert.match(updateHudSource, /const atlasChunks\s*=\s*instance\.atlasStreamPlan\?\.wanted\?\.length\s*\|\|\s*0/);
  assert.match(updateHudSource, /\$\{atlasChunks\}\s+atlas\s+(?:ưu tiên|planned|prioritized)/iu);
  assert.doesNotMatch(updateHudSource, /\$\{atlasChunks\}\s+(?:atlas\s+)?(?:đã tải|đã nạp|loaded|rendered)/iu);
});

test("reference-only Atlas selections and world mounts always route to Eon Atlas", () => {
  const assignment = 'global.location.hash = "#/game/timeline"';
  const contracts = [
    {
      label: "selection guard",
      source: extractConditionalBody(
        extractFunctionSource(gameSource, "selectAtlasMap"),
        'if (map.gameplayStatus === "atlas-reference-only")'
      )
    },
    {
      label: "world mount guard",
      source: extractConditionalBody(
        extractFunctionSource(gameSource, "mount"),
        'if (selectedMap?.gameplayStatus === "atlas-reference-only")'
      )
    }
  ];

  for (const contract of contracts) {
    const assignmentIndex = contract.source.indexOf(assignment);
    assert.notEqual(assignmentIndex, -1, `${contract.label} must assign the canonical timeline route`);
    const prefix = contract.source.slice(0, assignmentIndex);
    assert.doesNotMatch(
      prefix,
      /instance\.view\s*===|global\.location\?\.hash|global\.location\.hash\s*(?:===|!==)/,
      `${contract.label} must not make the route assignment depend on the stale view/hash`
    );
  }
});

const assertRange = (value, minimum, maximum, label) => {
  assert.ok(Number.isFinite(value), `${label} must be finite`);
  assert.ok(value >= minimum && value <= maximum, `${label} must stay in [${minimum}, ${maximum}]`);
};

const assertVitalsBounded = (player) => {
  for (const key of ["health", "hunger", "thirst", "stamina", "growth", "temperature", "oxygen", "nutrition", "dietQuality", "immunity"]) {
    assertRange(player[key], 0, 100, key);
  }
  for (const key of ["bleeding", "fracture", "infection", "disease"]) {
    assertRange(player.injuries[key], 0, 100, `injuries.${key}`);
  }
};

const assertGeneBounds = (genes) => {
  assert.deepEqual(Object.keys(genes), Array.from(content.GENE_KEYS));
  for (const key of content.GENE_KEYS) {
    const schema = content.GENE_SCHEMA[key];
    assertRange(genes[key], schema.min, schema.max, `gene.${key}`);
  }
  assert.equal(content.validateGenes(genes).valid, true);
};

test("EonWild v4 game composes versioned ecology and cinematic 3D APIs", () => {
  assert.equal(game.VERSION, "4.3.2");
  assert.equal(game.version, game.VERSION);
  assert.equal(game.SCHEMA_VERSION, 4);
  assert.equal(game.STORAGE_KEY, "hh.game.eonwild.v4");
  assert.equal(game.LEGACY_STORAGE_KEY, "hh.game.eonwild.v3");
  assert.equal(game.WORLD_SIZE, 16384);

  assert.equal(content.VERSION, "2.0.0");
  assert.equal(content.SCHEMA_VERSION, 2);
  assert.equal(content.CONTENT_VALIDATION.valid, true, content.CONTENT_VALIDATION.errors.join("\n"));
  assert.equal(content.isValidContent(), true);

  assert.equal(simulation.VERSION, "2.0.0");
  assert.equal(simulation.SCHEMA_VERSION, 2);
  assert.equal(simulation.FIXED_STEP, 1 / 30);
  assert.equal(core3d.VERSION, "3.1.1");
  assert.equal(renderer3d.VERSION, "1.5.2");
  assert.equal(core3d.BABYLON_VERSION, "9.22.1");
  assert.equal(renderer3d.BABYLON_VERSION, "9.22.1");
  for (const name of ["normalizeState", "stepVitals", "terrainAt", "createWorld", "createFramePacingState", "recordFramePacing", "evaluateAdaptivePacing", "mount", "unmount"]) {
    assert.equal(typeof game[name], "function", `${name} must remain public and testable`);
  }
});

test("frame pacing telemetry is sample-derived, bounded and reports a real 1% low", () => {
  const pacing = game.createFramePacingState(0);
  for (let index = 0; index < 99; index += 1) game.recordFramePacing(pacing, 10, index * 10);
  game.recordFramePacing(pacing, 100, 1000);

  assert.ok(pacing.averageMs > 10 && pacing.averageMs < 12);
  assert.equal(pacing.p95Ms, 10);
  assert.equal(pacing.p99Ms, 100);
  assert.equal(pacing.onePercentLowFps, 10);
  assert.equal(pacing.fps, Math.round(1000 / pacing.averageMs));

  for (let index = 0; index < 500; index += 1) game.recordFramePacing(pacing, 16, 3000 + index * 16);
  assert.ok(pacing.samples.length <= 126, "the two-second window must not grow with play time");
  assert.ok(pacing.samples.every((sample) => sample.at >= pacing.samples.at(-1).at - 2000));
});

test("Lite adaptive pacing uses two slow and four stable windows instead of flapping", () => {
  const pacing = game.createFramePacingState(0);
  pacing.p95Ms = 40;
  assert.equal(game.evaluateAdaptivePacing(pacing, 45), 0);
  assert.equal(game.evaluateAdaptivePacing(pacing, 45), -1);

  pacing.p95Ms = 10;
  assert.equal(game.evaluateAdaptivePacing(pacing, 45), 0);
  assert.equal(game.evaluateAdaptivePacing(pacing, 45), 0);
  assert.equal(game.evaluateAdaptivePacing(pacing, 45), 0);
  assert.equal(game.evaluateAdaptivePacing(pacing, 45), 1);

  pacing.p95Ms = 22;
  assert.equal(game.evaluateAdaptivePacing(pacing, 45), 0);
  assert.equal(pacing.slowWindows, 0);
  assert.equal(pacing.fastWindows, 0);
});

test("ready and paused gaps reset gameplay pacing instead of causing a false downgrade", () => {
  const instance = {
    framePacing: game.createFramePacingState(0),
    lastFrame: 10,
    fpsAt: 10,
    frameCount: 99
  };
  game.recordFramePacing(instance.framePacing, 250, 12000);
  assert.ok(instance.framePacing.samples.length > 0);
  assert.equal(game.resetGameplayFramePacing(instance, 15000), true);
  assert.equal(instance.framePacing.samples.length, 0);
  assert.equal(instance.framePacing.warmupUntil, 23000);
  assert.equal(instance.lastFrame, 15000);
  assert.equal(instance.fpsAt, 15000);
  assert.equal(instance.frameCount, 0);

  const loop = extractFunctionSource(gameSource, "loop");
  assert.match(loop, /const gameplayActive = !global\.document\?\.hidden && isGameplayActive\(instance\)/);
  assert.ok(loop.indexOf("const gameplayActive") < loop.indexOf("if (!global.document?.hidden)"), "gameplayActive must remain in scope for the once-per-second adaptive pacing branch");
  assert.match(loop, /if \(gameplayActive\) recordFramePacing\(instance\.framePacing, frameMs, now\)/);
  assert.match(loop, /if \(gameplayActive\) evaluateLiteAdaptiveQuality\(instance, now, instance\.framePacing\)/);
});

test("content v2 defines four isolated realms and exactly thirteen expected flagship animals", () => {
  assert.deepEqual(Array.from(content.REALM_IDS), ERA_REALMS);
  assert.equal(content.REALMS.length, 4);
  assert.equal(content.LIMITS.realms, 4);
  assert.equal(new Set(content.REALMS.map((realm) => realm.id)).size, 4);
  for (const realm of content.REALMS) {
    assert.ok(realm.speciesIds.length > 0, `${realm.id} needs species`);
    assert.ok(realm.biomeIds.length > 0, `${realm.id} needs biomes`);
    assert.ok(realm.eventIds.length > 0, `${realm.id} needs natural events`);
    assert.equal(content.validateRealm(realm).valid, true, `${realm.id} is invalid`);
  }

  assert.deepEqual(Array.from(content.FLAGSHIP_IDS), FLAGSHIP_IDS);
  assert.equal(content.LIMITS.flagshipSpecies, 13);
  assert.deepEqual(content.FLAGSHIPS.map((species) => species.id), FLAGSHIP_IDS);
  assert.deepEqual(simulation.FLAGSHIP_SPECIES.map((species) => species.id).sort(), FLAGSHIP_IDS.slice().sort());
  assert.equal(new Set(content.FLAGSHIPS.map((species) => species.signature)).size, 13);
  assert.equal(new Set(content.FLAGSHIPS.map((species) => species.locomotion.special.id)).size, 13);

  assert.equal(content.CATALOG_TIERS.flagship.length, 13);
  assert.equal(content.CATALOG_TIERS.simulated.length, 30);
  assert.equal(content.CATALOG_TIERS.codex.length, 6);
  assert.equal(content.SPECIES_CATALOG.length, 49);

  const pteranodon = content.getFlagshipMechanic("pteranodon");
  assert.equal(content.getCatalogTier("pteranodon"), "flagship");
  assert.equal(content.CATALOG_TIERS.simulated.includes("pteranodon"), false);
  assert.equal(content.validateFlagship(pteranodon).valid, true);
  assert.equal(pteranodon.realmId, "mesozoic");
  assert.equal(pteranodon.locomotion.mode, "cliff-launch-thermal-soar");
  assert.deepEqual(Array.from(pteranodon.reproduction.nestBiomeIds), ["mesozoic-coastal-wetland", "mesozoic-volcanic-upland"]);
  assert.ok(pteranodon.audio.callIds.includes("navigation"));
});

test("era realm isolation is the default and convergence is an explicit fictional opt-in", () => {
  for (const realm of content.REALMS) {
    const allowed = content.listAllowedSpecies(realm.id);
    assert.deepEqual(Array.from(allowed), Array.from(realm.speciesIds));
    for (const speciesId of allowed) {
      assert.equal(content.isSpeciesAllowedInRealm(realm.id, speciesId), true, `${speciesId} should be allowed in ${realm.id}`);
    }
    assert.equal(content.validateRealmSelection(realm.id, allowed).valid, true);
  }

  assert.equal(content.isSpeciesAllowedInRealm("modern", "tyrannosaurus"), false);
  assert.equal(content.canSpeciesCoexist("tyrannosaurus", "orca"), false);
  assert.equal(content.isSpeciesAllowedInRealm("modern", "tyrannosaurus", { convergence: true }), true);
  assert.equal(content.canSpeciesCoexist("tyrannosaurus", "orca", { convergence: true }), true);

  const convergence = content.listAllowedSpecies("modern", { convergence: true });
  assert.ok(convergence.includes("tyrannosaurus"));
  assert.ok(convergence.includes("orca"));
  for (const codexOnlyId of content.CATALOG_TIERS.codex) {
    assert.equal(content.isSpeciesAllowedInRealm("modern", codexOnlyId, { convergence: true }), false);
    assert.ok(!convergence.includes(codexOnlyId), `${codexOnlyId} is Codex-only and must never spawn`);
  }
});

test("all game, content and simulation taxonomy remains animal-only", () => {
  assert.ok(game.SPECIES.length >= 40);
  const taxonomyRows = [
    ...game.SPECIES.map((species) => [species.id, species.name, species.vietnamese]),
    ...content.SPECIES_CATALOG.map((species) => [species.id]),
    ...content.FLAGSHIPS.map((species) => [species.id, species.scientificName]),
    ...simulation.FLAGSHIP_SPECIES.map((species) => [species.id, species.name])
  ];
  for (const fields of taxonomyRows) {
    const taxonomy = fields.filter(Boolean).join(" ");
    assert.doesNotMatch(taxonomy, HUMAN_TAXON, `human taxon leaked into catalog: ${taxonomy}`);
  }

  const ledger = simulation.createBiomassLedger();
  for (const blocked of ["homo", "human", "person", "people", "người"]) {
    assert.equal(ledger.registerSpecies(blocked), false, `${blocked} must be rejected by simulation`);
  }
});

test("v2 gene normalization, mutation and inheritance are deterministic and bounded", () => {
  const hostile = {
    bodyScale: 999,
    endurance: -999,
    thermalTolerance: Infinity,
    oxygenEfficiency: Number.NaN,
    sensoryAcuity: "1.25",
    diseaseResistance: null,
    metabolism: 4,
    pigment: -1,
    sociability: 5,
    parentalCare: 0.75,
    injected: 123
  };
  const hostileSnapshot = { ...hostile };
  const normalized = content.normalizeGenes(hostile);
  assert.deepEqual(hostile, hostileSnapshot, "gene normalization must be pure");
  assertGeneBounds(normalized);
  assert.equal(Object.hasOwn(normalized, "injected"), false);

  const mutationA = content.mutateGenes(normalized, { seed: "GENE-42", rate: 1, strength: 1 });
  const mutationB = content.mutateGenes(normalized, { seed: "GENE-42", rate: 1, strength: 1 });
  assert.deepEqual(mutationA, mutationB);
  assertGeneBounds(mutationA);

  const inheritedA = content.inheritGenes(content.DEFAULT_GENES, mutationA, { seed: "NEST-7", mutationRate: 1 });
  const inheritedB = content.inheritGenes(content.DEFAULT_GENES, mutationA, { seed: "NEST-7", mutationRate: 1 });
  assert.deepEqual(inheritedA, inheritedB);
  assertGeneBounds(inheritedA);
  assert.equal(content.validateGeneProfile({ bodyScale: 9 }).valid, false);
});

test("a fresh save selects an active Atlas region compatible with its default playable animal", () => {
  const fresh = game.normalizeState();
  const map = worldAtlas.getMap(fresh.atlasMapId);
  assert.equal(fresh.speciesId, "triceratops");
  assert.equal(map?.gameplayStatus, "active-region");
  assert.equal(map?.rendererTimeSliceId, fresh.worldAddress.timeSliceId);
  assert.equal(map?.rendererRegionId, fresh.worldAddress.regionId);
  assert.equal(core3d.isSpeciesAllowedAtAddress(fresh.speciesId, fresh.worldAddress, false), true);

  const deliberateObserverMap = game.normalizeState({ atlasMapId: "triassic-pangaea" });
  assert.equal(deliberateObserverMap.atlasMapId, "triassic-pangaea", "an explicit Atlas choice must remain user-owned");
});

test("game save v4 migrates old coordinates once and bounds world address, renderer, vitals and history", () => {
  const records = Array.from({ length: 40 }, (_, index) => ({
    id: `generation<>-${index}`,
    generation: index + 1,
    speciesId: "mammuthus",
    genes: { bodyScale: 99, endurance: -10 },
    bornAt: index,
    survived: 999
  }));
  const normalized = game.normalizeState({
    schemaVersion: 1,
    speciesId: "mammuthus",
    realmId: "invalid-realm",
    player: {
      x: -99999,
      y: Infinity,
      health: 500,
      hunger: -25,
      thirst: "55",
      stamina: Number.NaN,
      growth: 101,
      lineage: 1000000,
      temperature: -50,
      oxygen: 800,
      nutrition: -4,
      dietQuality: 900,
      immunity: Infinity,
      generation: 100000,
      injuries: { bleeding: 500, fracture: -1, infection: Infinity, disease: 50 },
      genes: { size: 100, endurance: -50, sense: 80, immunity: 90, pigmentation: 20 }
    },
    settings: {
      difficulty: "impossible",
      motion: "cinematic",
      density: "high",
      sound: "yes",
      soundVolume: 1000,
      convergence: false,
      worker: false,
      adaptiveQuality: false,
      photoUi: false,
      seed: "../ EON seed <script> 123456789012345678901234567890"
    },
    discoveries: ["mammuthus", "mammuthus", "missing"],
    completed: ["first-water", "first-water", "missing"],
    activeExpedition: "missing",
    lineage: records,
    replay: Array.from({ length: 300 }, (_, index) => ({ x: index * 100, y: -index, t: index, health: 200, event: "x".repeat(80) })),
    eventJournal: Array.from({ length: 60 }, (_, index) => ({ id: `event-${index}`, label: "y".repeat(120), at: index }))
  });

  assert.equal(normalized.schemaVersion, 4);
  assert.equal(normalized.speciesId, "mammuthus");
  assert.equal(normalized.realmId, "ice-age");
  assert.equal(normalized.player.x, 80);
  assert.equal(normalized.player.y, game.WORLD_SIZE - 80);
  assert.equal(normalized.player.lineage, 9999);
  assert.equal(normalized.player.generation, 9999);
  assertVitalsBounded(normalized.player);
  assertGeneBounds(normalized.player.genes);
  assert.equal(normalized.lineage.length, 24);
  assert.equal(normalized.replay.length, 240);
  assert.equal(normalized.eventJournal.length, 40);
  assert.ok(normalized.lineage.every((record) => record.survived >= 0 && record.survived <= 100));
  assert.ok(normalized.replay.every((sample) => sample.x >= 0 && sample.x <= game.WORLD_SIZE && sample.event.length <= 32));
  assert.ok(normalized.eventJournal.every((event) => event.id.length <= 32 && event.label.length <= 80));
  assert.deepEqual(normalized.discoveries, ["mammuthus"]);
  assert.deepEqual(normalized.completed, ["first-water"]);
  assert.equal(normalized.activeExpedition, "first-water");
  assert.equal(normalized.settings.difficulty, "balanced");
  assert.equal(normalized.settings.motion, "cinematic");
  assert.equal(normalized.settings.density, "high");
  assert.equal(normalized.settings.renderer, "auto");
  assert.equal(normalized.settings.quality, "balanced");
  assert.equal(normalized.settings.sound, false);
  assert.equal(normalized.settings.soundVolume, 100);
  assert.equal(normalized.settings.convergence, false);
  assert.equal(normalized.settings.worker, false);
  assert.equal(normalized.settings.adaptiveQuality, false);
  assert.equal(normalized.settings.photoUi, false);
  assert.equal(normalized.settings.photoFov, 62);
  assert.equal(normalized.settings.photoExposure, 100);
  assert.match(normalized.settings.seed, /^[a-z0-9-]{1,24}$/i);
  assert.equal(normalized.worldAddress.realmId, "ice-age");
  assert.ok(core3d.TIME_SLICES.some((slice) => slice.id === normalized.worldAddress.timeSliceId));
  assert.equal(normalized.mode, "one-life");

  const migrated = game.normalizeState({
    schemaVersion: 3,
    speciesId: "triceratops",
    realmId: "mesozoic",
    worldAddress: { realmId: "mesozoic", timeSliceId: "cretaceous-laramidia", regionId: "late-cretaceous-floodplain", biomeId: "forest", chunkX: 8, chunkZ: 12, seed: "legacy" },
    player: { x: 1024, y: 2048, spawnPending: false },
    replay: [{ x: 512, y: 768, t: 1, health: 90 }],
    heatmap: [{ x: 256, y: 320, value: 2 }],
    heatmapCellSize: 64
  });
  assert.equal(migrated.player.x, 4096);
  assert.equal(migrated.player.y, 8192);
  assert.equal(migrated.replay[0].x, 2048);
  assert.equal(migrated.heatmap[0].y, 1280);
  assert.equal(migrated.heatmapCellSize, 64);
  assert.equal(migrated.worldAddress.chunkX, 32);
  assert.equal(migrated.worldAddress.chunkZ, 48);
  const normalizedAgain = game.normalizeState(migrated);
  assert.equal(normalizedAgain.player.x, migrated.player.x, "schema v4 coordinates must not be scaled twice");
  assert.equal(normalizedAgain.replay[0].x, migrated.replay[0].x, "replay coordinates must not be scaled twice");
  assert.equal(normalizedAgain.worldAddress.chunkX, migrated.worldAddress.chunkX, "world address must not be scaled twice");
});

test("save normalization keeps Time Slice authoritative unless Convergence is explicit", () => {
  const incompatible = {
    realmId: "mesozoic",
    timeSliceId: "cretaceous-north-africa",
    regionId: "kem-kem-wetland",
    seed: "SLICE-GUARD"
  };
  const isolated = game.normalizeState({
    speciesId: "tyrannosaurus",
    realmId: "mesozoic",
    worldAddress: incompatible,
    settings: { seed: "SLICE-GUARD", convergence: false }
  });
  assert.equal(core3d.isSpeciesAllowedAtAddress("tyrannosaurus", isolated.worldAddress, false), true);
  assert.equal(isolated.worldAddress.timeSliceId, "cretaceous-laramidia");

  const convergence = game.normalizeState({
    speciesId: "tyrannosaurus",
    realmId: "mesozoic",
    worldAddress: incompatible,
    settings: { seed: "SLICE-GUARD", convergence: true }
  });
  assert.equal(convergence.worldAddress.timeSliceId, "cretaceous-north-africa");
  assert.equal(convergence.worldAddress.regionId, "kem-kem-wetland");
});

test("v2 vitals update is pure, difficulty-aware and bounds conditions", () => {
  const initial = Object.freeze({
    health: 80, hunger: 82, thirst: 78, stamina: 100, growth: 18,
    temperature: 50, oxygen: 100, nutrition: 72, dietQuality: 64, immunity: 82,
    injuries: Object.freeze({ bleeding: 25, fracture: 15, infection: 5, disease: 2 })
  });
  const snapshot = JSON.parse(JSON.stringify(initial));
  const balanced = game.stepVitals(initial, 5, "balanced", true, true, { temperature: 80, oxygenDrain: 3 });
  const sanctuary = game.stepVitals(initial, 5, "sanctuary", false, false);
  const wild = game.stepVitals(initial, 5, "wild", false, false);
  assert.deepEqual(initial, snapshot, "stepVitals must not mutate input or nested injuries");
  assert.ok(balanced.hunger < initial.hunger);
  assert.ok(balanced.stamina < initial.stamina);
  assert.ok(balanced.temperature > initial.temperature);
  assert.ok(balanced.oxygen < initial.oxygen);
  assert.ok(wild.hunger < sanctuary.hunger);
  assertVitalsBounded(balanced);
  assertVitalsBounded(sanctuary);
  assertVitalsBounded(wild);

  const exhausted = game.stepVitals({ ...initial, health: 1, hunger: 0, thirst: 0, injuries: { bleeding: 100, infection: 100, fracture: 100, disease: 100 } }, 100000, "wild", true, true, { oxygenDrain: 100 });
  assertVitalsBounded(exhausted);
  assert.equal(exhausted.health, 0);
  assert.equal(exhausted.oxygen, 0);
});

test("new lives spawn in a habitat compatible with the selected locomotion", () => {
  const seed = game.createWorld("EON-541", "balanced", "mesozoic").seed;
  const tyrannosaurus = game.SPECIES.find((species) => species.id === "tyrannosaurus");
  const tyrannosaurusSpawn = game.findHabitatSpawn(tyrannosaurus, seed, "mesozoic");
  const tyrannosaurusTerrain = game.terrainForRealm(game.terrainAt(tyrannosaurusSpawn.x, tyrannosaurusSpawn.y, seed), "mesozoic", tyrannosaurusSpawn.x, tyrannosaurusSpawn.y);
  assert.ok(!["ocean", "reef"].includes(tyrannosaurusTerrain), `land Flagship spawned in ${tyrannosaurusTerrain}`);

  const modernSeed = game.createWorld("EON-541", "balanced", "modern").seed;
  const orca = game.SPECIES.find((species) => species.id === "orca");
  const orcaSpawn = game.findHabitatSpawn(orca, modernSeed, "modern");
  const orcaTerrain = game.terrainForRealm(game.terrainAt(orcaSpawn.x, orcaSpawn.y, modernSeed), "modern", orcaSpawn.x, orcaSpawn.y);
  assert.ok(["ocean", "reef"].includes(orcaTerrain), `water Flagship spawned in ${orcaTerrain}`);
});

test("chunk generation is deterministic, bounded and realm-isolated", () => {
  const speciesRealm = new Map(simulation.ALL_SPECIES.map((species) => [species.id, species.realm]));
  for (const realm of ERA_REALMS) {
    for (const [cx, cy] of [[0, 0], [2, -3], [-7, 5], [12, 9]]) {
      const input = { seed: "CHUNK-541", realm, cx, cy, chunkSize: simulation.CHUNK_SIZE };
      const first = simulation.generateChunk(input);
      const second = simulation.generateChunk(input);
      assert.deepEqual(first, second, `${realm}:${cx}:${cy} must be reproducible`);
      assert.equal(first.realm, realm);
      assert.equal(first.id, `${realm}:${cx}:${cy}`);
      assert.ok(simulation.BIOMES.includes(first.biome));
      assert.ok(first.resources.length <= simulation.LIMITS.MAX_RESOURCES_PER_CHUNK);
      assert.ok(first.wildlife.length <= simulation.LIMITS.MAX_WILDLIFE_PER_CHUNK);
      for (const animal of first.wildlife) {
        assert.equal(speciesRealm.get(animal.speciesId), realm, `${animal.speciesId} crossed into ${realm}`);
        assert.doesNotMatch(animal.speciesId, HUMAN_TAXON);
      }
      for (const resource of first.resources) {
        assertRange(resource.x, first.bounds.minX, first.bounds.maxX, `${resource.id}.x`);
        assertRange(resource.y, first.bounds.minY, first.bounds.maxY, `${resource.id}.y`);
        assertRange(resource.amount, 0, 100, `${resource.id}.amount`);
        assertRange(resource.quality, 0, 1, `${resource.id}.quality`);
      }
    }
  }
  assert.notDeepEqual(
    simulation.generateChunk({ seed: "CHUNK-A", realm: "modern", cx: 2, cy: 3 }),
    simulation.generateChunk({ seed: "CHUNK-B", realm: "modern", cx: 2, cy: 3 })
  );

  const visible = simulation.visibleChunkSet({ cx: 0, cy: 0 }, 2, { realm: "mesozoic" });
  assert.equal(visible.size, 25);
  assert.ok(visible.size <= simulation.MAX_CHUNKS);
  assert.ok(Array.from(visible).every((id) => id.startsWith("mesozoic:")));
});

test("world-space streaming resolves the player position to nearby chunk coordinates", () => {
  const engine = simulation.createSimulation({ seed: "STREAM-WORLD", realm: "mesozoic", viewRadius: 1, maxChunks: 9 });
  const chunks = engine.streamChunks({ x: 2048, y: 2048, world: true });
  assert.equal(chunks.length, 9);
  assert.ok(chunks.some((chunk) => chunk.id === "mesozoic:8:8"));
  assert.ok(chunks.every((chunk) => Math.abs(chunk.cx - 8) <= 1 && Math.abs(chunk.cy - 8) <= 1));
  assert.ok(!chunks.some((chunk) => chunk.id.includes(":2048:")));
  assert.match(gameSource, /streamChunks\(\{\s*x:\s*instance\.state\.player\.x,\s*y:\s*instance\.state\.player\.y,\s*world:\s*true\s*\}\)/);
  engine.dispose();
});

test("Biomass Ledger enforces carrying capacity, global population and apex cap", () => {
  const ledger = simulation.createBiomassLedger({ apexCap: 2, maxPopulation: 20 });
  const context = { location: "mesozoic:0:0", vegetation: 2, water: 2, climate: 1 };
  assert.equal(ledger.recordBirth("tyrannosaurus", "grassland", 1, context), 1);
  assert.equal(ledger.recordBirth("tyrannosaurus", "grassland", 1, context), 1);
  assert.equal(ledger.canSpawn("tyrannosaurus", "grassland", 1, context), false);
  assert.equal(ledger.recordBirth("tyrannosaurus", "grassland", 1, context), 0);

  const snapshot = ledger.snapshot();
  assert.equal(snapshot.total, 2);
  assert.equal(snapshot.apex["mesozoic:0:0|apex"], 2);
  assert.ok(snapshot.populations.every((population) => population.count >= 0));
  assert.equal(ledger.recordDeath("tyrannosaurus", "grassland", 1, context), 1);
  assert.equal(ledger.canSpawn("tyrannosaurus", "grassland", 1, context), true);
});

test("chunk migration keeps entity location and Biomass Ledger atomic", () => {
  const engine = simulation.createSimulation({ seed: "LEDGER-MOVE", realm: "mesozoic", chunkSize: 64, maxChunks: 16, maxEntities: 8 });
  const added = engine.addEntity({ id: "mover", speciesId: "triceratops", x: 63, y: 24, hunger: 100, thirst: 100, stamina: 100, maturity: 0 });
  assert.ok(added);
  const live = engine.entities.get("mover");
  live.x = 65;
  engine.spatialHash.update(live.id, live.x, live.y, live);
  engine.stepFixed();
  const moved = engine.getEntity("mover");
  const snapshot = engine.ledger.snapshot();
  assert.equal(moved.chunkId, "mesozoic:1:0");
  assert.equal(snapshot.total, 1);
  assert.equal(snapshot.populations.reduce((sum, row) => sum + row.count, 0), 1);
  assert.ok(snapshot.populations.every((row) => !row.key.startsWith("mesozoic:0:0|") || row.count === 0));
  engine.dispose();
});

test("Utility AI exposes exactly eight deterministic, finite actions", () => {
  assert.deepEqual(Array.from(simulation.ACTIONS), UTILITY_ACTIONS);
  assert.deepEqual(Array.from(simulation.UTILITY_ACTIONS), UTILITY_ACTIONS);
  const animal = { id: "wolf-1", speciesId: "wolf", hunger: 8, thirst: 70, stamina: 45, maturity: 0.8, health: 90 };
  const context = { prey: 1, water: 1, vegetation: 0.2, threat: 0.1, scarcity: 0.2, seasonBreeding: 0.8, nestThreat: 0.2 };
  const first = simulation.utilityScores(animal, context, "UTILITY-9");
  const second = simulation.utilityScores(animal, context, "UTILITY-9");
  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first), UTILITY_ACTIONS);
  for (const action of UTILITY_ACTIONS) assertRange(first[action], 0, 1, `utility.${action}`);

  const decisionA = simulation.chooseUtilityAction(animal, context, "UTILITY-9");
  const decisionB = simulation.chooseUtilityAction(animal, context, "UTILITY-9");
  assert.deepEqual(decisionA, decisionB);
  assert.ok(UTILITY_ACTIONS.includes(decisionA.action));
  assert.deepEqual(decisionA.scores, first);
});

test("hunt, mate and guardNest produce bounded ecological state changes", () => {
  const hunt = simulation.createSimulation({ seed: "HUNT-REAL", realm: "mesozoic", maxEntities: 8, apexCap: 2 });
  assert.ok(hunt.addEntity({ id: "hunter", speciesId: "tyrannosaurus", x: 100, y: 100, hunger: 1, thirst: 100, stamina: 100 }));
  assert.ok(hunt.addEntity({ id: "prey", speciesId: "triceratops", x: 104, y: 100, health: 100 }));
  for (let index = 0; index < 300 && hunt.getEntity("prey"); index += 1) hunt.performAction("hunter", "hunt", 1 / 30);
  assert.equal(hunt.getEntity("prey"), null, "successful predation must remove prey rather than feed the hunter for free");
  assert.equal(hunt.ledger.snapshot().total, 1);
  assert.ok(hunt.getReplay().some((frame) => frame.type === "predation-hit"));
  hunt.dispose();

  const family = simulation.createSimulation({ seed: "MATE-REAL", realm: "modern", maxEntities: 8 });
  assert.ok(family.addEntity({ id: "wolf-a", speciesId: "wolf", sex: "male", x: 40, y: 40, maturity: 1, age: 1, health: 100, hunger: 100, thirst: 100 }));
  assert.ok(family.addEntity({ id: "wolf-b", speciesId: "wolf", sex: "female", x: 42, y: 40, maturity: 1, age: 1, health: 100, hunger: 100, thirst: 100 }));
  for (let index = 0; index < 220 && family.getEntities().length < 3; index += 1) family.performAction("wolf-a", "mate", 1 / 30);
  const offspring = family.getEntities().find((entity) => entity.parentIds?.length === 2);
  assert.ok(offspring, "mating must create a ledger-backed offspring when capacity allows");
  assert.equal(offspring.generation, 2);
  assert.equal(family.ledger.snapshot().total, 3);
  family.dispose();

  const nest = simulation.createSimulation({ seed: "NEST-REAL", realm: "mesozoic", maxEntities: 8, apexCap: 2 });
  assert.ok(nest.addEntity({ id: "guardian", speciesId: "triceratops", x: 80, y: 80, nest: { x: 80, y: 80 }, maturity: 1 }));
  assert.ok(nest.addEntity({ id: "threat", speciesId: "tyrannosaurus", x: 84, y: 80, health: 100 }));
  const before = nest.getEntity("threat").health;
  for (let index = 0; index < 40; index += 1) nest.performAction("guardian", "guardNest", 1 / 30);
  assert.ok(nest.getEntity("threat").health < before, "guardNest must defend a real nest against a nearby threat");
  nest.dispose();
});

test("fixed timestep caps catch-up work and remains deterministic", () => {
  const makeRun = () => {
    const clock = simulation.createFixedTimestep({ step: 1 / 30, maxDelta: 0.25, maxSteps: 3 });
    const calls = [];
    const results = [0.01, 0.2, 1, 0.04].map((delta) => clock.advance(delta, (dt, time, step) => calls.push({ dt, time, step })));
    return { calls, results, time: clock.time, steps: clock.steps };
  };
  const first = makeRun();
  const second = makeRun();
  assert.deepEqual(first, second);
  assert.ok(first.results.every((result) => result.steps <= 3));
  assert.ok(first.calls.every((call) => call.dt === 1 / 30));
  assert.equal(first.steps, first.calls.length);
  assert.ok(first.time > 0);
});

test("footprint and scent trails are bounded, wind-driven and decay", () => {
  const trails = simulation.createTrailSystem({ maxFootprints: 2, maxScents: 2, footprintHalfLife: 8, scentHalfLife: 4, wind: { x: 1, y: 0, speed: 3 } });
  for (let index = 0; index < 4; index += 1) {
    trails.leaveFootprint({ id: `foot-${index}`, sourceId: "wolf", speciesId: "wolf", x: index, y: 0, intensity: 1 });
    trails.addScent({ id: `scent-${index}`, sourceId: "wolf", speciesId: "wolf", x: index, y: 0, intensity: 1 });
  }
  const before = trails.snapshot();
  assert.deepEqual(before.footprints.map((trail) => trail.id), ["foot-2", "foot-3"]);
  assert.deepEqual(before.scents.map((trail) => trail.id), ["scent-2", "scent-3"]);
  const beforeScentX = before.scents[0].x;
  trails.update(2);
  const after = trails.snapshot();
  assert.ok(after.scents[0].x > beforeScentX);
  assert.ok(after.scents[0].intensity < before.scents[0].intensity);
  assert.ok(after.footprints[0].intensity < before.footprints[0].intensity);
  assert.ok(trails.queryScent(10, 0, 50, { speciesId: "wolf" }).length > 0);
});

test("natural hazards are bounded, spatial and deterministic", () => {
  const makeHazards = () => {
    const hazards = simulation.createHazardSystem({ seed: "HAZARD-9", maxEvents: 2, tideBase: 0.5, tideAmplitude: 0.3 });
    hazards.triggerFlood({ id: "flood-a", x: 10, y: 10, radius: 100, intensity: 5, duration: 20 });
    hazards.igniteWildfire({ id: "fire-a", x: 20, y: 20, radius: 80, intensity: 0.7, duration: 20 });
    hazards.eruptVolcano({ id: "volcano-a", x: 30, y: 30, radius: 120, intensity: 0.9, duration: 20 });
    const tick = hazards.update(1, { autoHazards: false });
    return { tick, state: hazards.snapshot(), effect: hazards.effectsAt(25, 25) };
  };
  const first = makeHazards();
  const second = makeHazards();
  assert.deepEqual(first, second);
  assert.ok(first.tick.active.length <= 6, "each hazard type has an independent bounded queue");
  assertRange(first.tick.tide.level, 0, 1, "tide.level");
  assertRange(first.effect.danger, 0, 1, "hazard.danger");
  assert.ok(first.effect.danger > 0);
  assert.ok(first.state.floods.every((event) => event.intensity <= 1 && event.radius <= 5000));
});

test("replay is a bounded ring buffer and never exposes mutable internal frames", () => {
  const replay = simulation.createReplayBuffer(3);
  for (let index = 1; index <= 4; index += 1) replay.record({ tick: index, actor: { id: "wolf" } });
  const frames = replay.toArray();
  assert.equal(replay.size(), 3);
  assert.deepEqual(frames.map((frame) => frame.tick), [2, 3, 4]);
  assert.deepEqual(frames.map((frame) => frame.sequence), [2, 3, 4]);
  frames[0].actor.id = "mutated";
  assert.equal(replay.at(0).actor.id, "wolf");
  assert.equal(replay.latest().tick, 4);
  assert.equal(replay.snapshot().length, 3);
});

test("worker adapter fails closed to a bounded local command set", async () => {
  const adapter = simulation.createWorkerAdapter({ forceLocal: true });
  assert.equal(adapter.mode, "local");
  assert.equal(adapter.local, true);
  assert.equal(adapter.supported, false);
  assert.equal(adapter.capabilities.localFallback, true);
  assert.deepEqual(adapter.capabilities.localCommands, ["ping", "hashSeed", "generateChunk"]);

  assert.deepEqual(await adapter.run("ping"), { ok: true, mode: "local", command: "ping" });
  assert.equal(await adapter.run("hashSeed", "WORKER-SEED"), simulation.hashSeed("WORKER-SEED"));
  const chunk = await adapter.run("generateChunk", { seed: "WORKER-SEED", realm: "modern", cx: 1, cy: -1 });
  assert.deepEqual(chunk, simulation.generateChunk({ seed: "WORKER-SEED", realm: "modern", cx: 1, cy: -1 }));
  await assert.rejects(adapter.run("connect-server", {}), /Unsupported local simulation command/);
  assert.equal(adapter.close(), true);
});

test("3D world addresses separate time slices and convergence remains explicit", () => {
  assert.ok(core3d.TIME_SLICES.length >= 14);
  assert.ok(core3d.REGIONS.length >= 20);
  assert.ok(Object.keys(core3d.SPECIES_CARTRIDGES).length >= 24);
  const tyrannosaurus = core3d.addressForSpecies("tyrannosaurus", "SLICE-1");
  const spinosaurus = core3d.addressForSpecies("spinosaurus", "SLICE-1");
  assert.equal(tyrannosaurus.realmId, "mesozoic");
  assert.notEqual(tyrannosaurus.timeSliceId, spinosaurus.timeSliceId);
  assert.equal(core3d.isSpeciesAllowedAtAddress("tyrannosaurus", tyrannosaurus, false), true);
  assert.equal(core3d.isSpeciesAllowedAtAddress("spinosaurus", tyrannosaurus, false), false);
  assert.equal(core3d.isSpeciesAllowedAtAddress("spinosaurus", tyrannosaurus, true), true);
  assert.deepEqual(
    Object.values(core3d.SPECIES_CARTRIDGES).filter((row) => row.stage === "vertical-slice").map((row) => row.id).sort(),
    ["pteranodon", "spinosaurus", "triceratops", "tyrannosaurus"]
  );
  for (const speciesId of content.FLAGSHIP_IDS) {
    assert.ok(core3d.SPECIES_CARTRIDGES[speciesId], `${speciesId} needs a 3D cartridge`);
    const address = core3d.addressForSpecies(speciesId, "FLAGSHIP-ADDRESS");
    assert.equal(core3d.isSpeciesAllowedAtAddress(speciesId, address, false), true, `${speciesId} needs a valid non-convergence address`);
  }
  const electricEel = core3d.addressForSpecies("electric-eel", "FRESH-WATER");
  assert.equal(electricEel.timeSliceId, "modern-land");
  assert.equal(electricEel.regionId, "wetland");
  assert.ok(core3d.GAME_MODES.some((mode) => mode.id === "convergence" && mode.fictional === true));
});

test("3D chunk streaming and adaptive quality are deterministic and bounded", () => {
  assert.equal(renderer3d.CHUNK_SIZE, core3d.WORLD_CONFIG.chunkSizeMeters);
  assert.equal(renderer3d.CHUNK_SIZE, assetManifest.verticalSlice.chunkSizeMeters);
  const address = core3d.addressForSpecies("triceratops", "CHUNK-42");
  const planA = core3d.planChunkStreaming({ x: 2048, z: 2048 }, { quality: "balanced", address });
  const planB = core3d.planChunkStreaming({ x: 2048, z: 2048 }, { quality: "balanced", address });
  assert.deepEqual(planA, planB);
  assert.ok(planA.length > 0 && planA.length <= core3d.WORLD_CONFIG.maximumResidentChunks);
  assert.equal(new Set(planA.map((chunk) => chunk.key)).size, planA.length);
  assert.ok(planA.every((chunk) => chunk.lod >= 0 && chunk.lod <= 3));
  assert.ok(planA.every((chunk) => chunk.x >= 0 && chunk.z >= 0 && chunk.x < 16 && chunk.z < 16));
  const governor = core3d.createAdaptiveGovernor({ quality: "balanced" });
  governor.sample(1);
  const degraded = governor.sample(1);
  assert.equal(degraded.changed, true);
  assert.equal(degraded.quality, "light");
});

test("generic 3D core retries safely, bounds startup work and truly pauses", () => {
  assert.match(core3dSource, /function withTimeout/);
  assert.match(core3dSource, /non-opaque HTTP\(S\) page origin/);
  assert.match(core3dSource, /dataset\.hweBabylonState\s*=\s*"failed"[\s\S]*?script\?\.remove\?\.\(\)/);
  assert.match(core3dSource, /WEBGPU_CANVAS_INIT_FAILED/);
  assert.match(core3dSource, /let adaptiveQuality\s*=\s*options\.adaptiveQuality\s*!==\s*false/);
  assert.match(core3dSource, /processChunkQueue\(1\)/);
  assert.match(core3dSource, /if\s*\(adaptiveQuality\s*&&\s*now\s*-\s*governorAt/);
  assert.match(core3dSource, /engine\.stopRenderLoop\?\.\(renderFrame\)/);
  assert.match(core3dSource, /setReducedMotion\(value\)/);
  assert.match(core3dSource, /setAdaptiveQuality\(value\)/);
  assert.match(core3dSource, /options\.signal\?\.aborted\s*\|\|\s*options\.isCancelled\?\.\(\)/);
  assert.match(core3dSource, /throwIfStartupCancelled\(\)/);
  assert.match(core3dSource, /if\s*\(changed\)\s*streamChunks\(lastStreamPosition\.x,\s*lastStreamPosition\.z\)/);
});

test("3D renderer is same-origin, optional, truthful and keeps Lite fallback", () => {
  assert.match(renderer3dSource, /root\.HHEonWildRenderer3D\s*=\s*api/);
  assert.doesNotMatch(renderer3dSource, /root\.HHEonWild3D\s*=\s*api/);
  assert.equal(renderer3d.DEFAULT_REMOTE_BABYLON_URL, null);
  assert.match(renderer3d.DEFAULT_LOCAL_BABYLON_URL, /^\.\/vendor\/babylon-9\.22\.1\.js/);
  assert.deepEqual(Array.from(renderer3d.FLAGSHIP_IDS).sort(), ["pteranodon", "spinosaurus", "triceratops", "tyrannosaurus"]);
  assert.match(core3dSource, /source\.origin\s*!==\s*currentOrigin/);
  assert.doesNotMatch(core3dSource + renderer3dSource, /https:\/\/cdn\.babylonjs\.com/);
  assert.match(gameSource, /data-hwe-canvas-3d/);
  assert.match(gameSource, /async function enable3D/);
  assert.match(gameSource, /function disable3D/);
  assert.match(gameSource, /RENDERER_3D\?\.worldToChunk\?\.\(instance\.state\.player\.x, instance\.state\.player\.y\)/);
  assert.match(renderer3dSource, /CreateScreenshotUsingRenderTargetAsync/);
  assert.match(renderer3dSource, /function withDeadline/);
  assert.match(renderer3dSource, /webgpuConstructionAttempted\s*=\s*true/);
  assert.match(renderer3dSource, /canvasMayBeBound\s*=\s*webgpuConstructionAttempted/);
  assert.match(renderer3dSource, /failedBackend\s*===\s*"webgpu"[\s\S]*?replaceCanvasAfterWebGPUFailure/);
  assert.match(renderer3dSource, /onLateSettle/);
  assert.match(renderer3dSource, /removeManagedScript/);
  assert.match(renderer3dSource, /hweBabylonState\s*!==\s*"failed"/);
  assert.match(renderer3dSource, /markScriptFailed/);
  assert.match(renderer3dSource, /replaceCanvasAfterWebGPUFailure/);
  assert.match(renderer3dSource, /function startupCancelled/);
  assert.match(renderer3dSource, /if\s*\(startupCancelled\(options\)\)\s*throw startupCancelledError/);
  assert.match(renderer3dSource, /WEBGPU_CANVAS_REPLACEMENT_REQUIRED/);
  assert.match(renderer3dSource, /new B\.PBRMaterial\("hwe3d-terrain-pbr-material"/);
  assert.match(renderer3dSource, /TONEMAPPING_ACES/);
  assert.match(renderer3dSource, /new B\.ShadowGenerator/);
  assert.match(renderer3dSource, /setPhotoSettings\(value = \{\}\)/);
  assert.match(gameSource, /replaceCanvasOnFallback:\s*true/);
  assert.match(gameSource, /backend:\s*"webgl"/);
  assert.match(gameSource, /webGPUSceneFailure[\s\S]*?backend:\s*"webgl"/);
  assert.match(gameSource, /canRetrySceneInWebGL/);
  assert.match(gameSource, /detail\.previous\s*!==\s*instance\.canvas3d/);
  assert.match(gameSource, /instance\.canvas3d\s*=\s*detail\.canvas/);
  assert.match(renderer3dSource, /if\s*\(generation\s*!==\s*this\._generation\s*\|\|\s*this\._state\s*===\s*"disposed"\)[\s\S]*?safeDispose\(created\.engine\)[\s\S]*?if\s*\(created\.canvas\s*&&\s*created\.canvas\s*!==\s*this\._canvas\)\s*this\._canvas\s*=\s*created\.canvas/);
  assert.match(gameSource, /Canvas 2D Lite/);
  assert.match(css, /\.hwe-render-loading\s*\{/);
  assert.match(css, /\.hwe-render-surface--3d\s*\{/);
});

test("optional 3D adapter fails closed without a browser DOM", async () => {
  await assert.rejects(
    renderer3d.loadBabylon({ urls: ["https://example.invalid/babylon.js"] }),
    (error) => error?.code === "BABYLON_LOAD_FAILED" && error?.failures?.length === 0,
    "cross-origin renderer URLs must be denied unless explicitly enabled"
  );
  const adapter = renderer3d.createRenderer({ allowRemoteBabylon: false });
  const started = await adapter.start();
  assert.equal(started.ok, false);
  assert.equal(started.status, "failed");
  assert.equal(started.reason.code, "DOM_UNAVAILABLE");
  assert.equal(started.reason.fallback, "canvas2d");
  assert.equal(started.reason.recoverable, true);
  assert.equal(adapter.dispose().ok, true);
});

test("vendored renderer and asset provenance manifest are explicit", () => {
  const babylonPath = path.join(root, "vendor", "babylon-9.22.1.js");
  assert.ok(fs.statSync(babylonPath).size > 8_000_000);
  const runtimeSha256 = crypto.createHash("sha256").update(fs.readFileSync(babylonPath)).digest("hex");
  const licenseSha256 = crypto.createHash("sha256").update(read("vendor/BABYLON-LICENSE.md").replaceAll("\r\n", "\n"), "utf8").digest("hex");
  assert.match(read("vendor/BABYLON-LICENSE.md"), /Apache License[\s\S]*Version 2\.0/);
  assert.equal(assetManifest.runtime.rendererVersion, "9.22.1");
  assert.equal(assetManifest.runtime.rendererSha256, runtimeSha256);
  assert.equal(assetManifest.runtime.rendererLicenseSha256, licenseSha256);
  assert.equal(assetManifest.policy.humanContentAllowed, false);
  assert.equal(assetManifest.policy.unknownLicenseAllowed, false);
  assert.equal(assetManifest.verticalSlice.productionModelsReady, false);
  assert.deepEqual(assetManifest.verticalSlice.supportedSpecies.slice().sort(), ["pteranodon", "spinosaurus", "triceratops", "tyrannosaurus"]);
  for (const field of ["sourceUrl", "license", "sha256"]) {
    assert.ok(assetManifest.requiredAssetFields.includes(field), `missing provenance field ${field}`);
  }
  for (const field of ["scientificSource", "lodLevels", "reconstructionConfidence"]) {
    assert.ok(assetManifest.requiredCreatureAssetFields.includes(field), `missing creature provenance field ${field}`);
  }
});

test("Game is a first-class Entertainment route with all nine v3 workspaces", () => {
  assert.match(router, /id:\s*"eonwild-game"[\s\S]*?label:\s*"Game\s*·\s*EonWild"[\s\S]*?route:\s*"\/game"/);
  const routes = ["world", "species", "ecosystem", "timeline", "expeditions", "lineage", "observer", "network", "settings"];
  for (const route of routes) assert.match(router, new RegExp(`route:\\s*"/game/${route}"`), `missing /game/${route}`);
  assert.match(router, /id:\s*"entertainment"[\s\S]*?groupIds:\s*\[[^\]]*"play-center"[^\]]*"eonwild-game"/);
  assert.match(router, /route === "\/game" \|\| route\.startsWith\("\/game\/"\)/);
  assert.match(router, /workspace\.innerHTML\s*=\s*'<div data-hh-eonwild-host><\/div>'/);
  assert.match(router, /window\.HHEonWild\?\.mount/);
  assert.match(router, /remember\("eonwild-game"\)/);
  assert.match(router, /lineage:\s*"Dòng gene"[\s\S]*?observer:\s*"Observer & Replay"[\s\S]*?network:\s*"Multiplayer Readiness"/);
});

test("only Flagship species are offered as playable while other tiers stay truthful", () => {
  assert.match(gameSource, /if\s*\(tier\s*!==\s*"flagship"\)/);
  assert.match(gameSource, /tier\s*===\s*"simulated"[\s\S]*?Quan sát trong hệ sinh thái/);
  assert.match(gameSource, /tier\s*===\s*"codex"|Chỉ tra cứu trong Eon Codex/);
  assert.match(gameSource, /compact\s*&&\s*\(unavailable\s*\|\|\s*tier\s*!==\s*"flagship"\)/);
});

test("lazy loader and service worker cache the complete ordered v4 bundle", () => {
  assert.match(loader, /game:\s*\{[\s\S]*?styles:\s*\["hh-eonwild-game\.css\?v=22"\][\s\S]*?scripts:\s*\["hh-eonwild-cinematic-pack\.js\?v=1",\s*"hh-eonwild-content-v2\.js\?v=3",\s*"hh-eonwild-species-registry\.js\?v=1",\s*"hh-eonwild-input-system\.js\?v=2",\s*"hh-eonwild-desktop-controller\.js\?v=2",\s*"hh-eonwild-collision-system\.js\?v=1",\s*"hh-eonwild-world-atlas\.js\?v=2",\s*"hh-eonwild-simulation-v2\.js\?v=4",\s*"hh-eonwild-3d-core\.js\?v=7",\s*"hh-eonwild-landscape-core\.js\?v=1",\s*"hh-eonwild-vegetation-system\.js\?v=1",\s*"hh-eonwild-environment-renderer\.js\?v=4",\s*"hh-eonwild-water-weather-system\.js\?v=1",\s*"hh-eonwild-renderer-3d\.js\?v=19",\s*"hh-eonwild-game\.js\?v=28"\]/);
  assert.match(loader, /value === "\/game" \|\| value\.startsWith\("\/game\/"\)\) return \["game"\]/);
  const runtimeAssetsSource = worker.slice(
    worker.indexOf("const RUNTIME_ASSETS"),
    worker.indexOf("const CORE")
  );
  const coreAssetsSource = worker.slice(worker.indexOf("const CORE"));
  for (const asset of [
    "./hh-eonwild-cinematic-pack.js?v=1",
    "./hh-eonwild-cinematic-pack-worker.js?v=1",
    "./hh-eonwild-game.css?v=22",
    "./hh-eonwild-content-v2.js?v=3",
    "./hh-eonwild-species-registry.js?v=1",
    "./hh-eonwild-input-system.js?v=2",
    "./hh-eonwild-desktop-controller.js?v=2",
    "./hh-eonwild-collision-system.js?v=1",
    "./hh-eonwild-world-atlas.js?v=2",
    "./hh-eonwild-simulation-v2.js?v=4",
    "./hh-eonwild-3d-core.js?v=7",
    "./hh-eonwild-landscape-core.js?v=1",
    "./hh-eonwild-landscape-worker.js?v=1",
    "./hh-eonwild-vegetation-system.js?v=1",
    "./hh-eonwild-environment-renderer.js?v=4",
    "./hh-eonwild-water-weather-system.js?v=1",
    "./hh-eonwild-renderer-3d.js?v=19",
    "./hh-eonwild-game.js?v=28"
  ]) assert.ok(worker.includes(`"${asset}"`), `service worker must cache ${asset}`);
  for (const asset of [
    "./vendor/babylon-9.22.1.js?v=9.22.1",
    "./vendor/babylonjs-loaders-9.22.1.min.js?v=9.22.1",
    "./assets/eonwild/asset-manifest.v1.json",
    "./assets/eonwild/THIRD_PARTY_NOTICES.md",
    "./vendor/EONWILD_THIRD_PARTY_NOTICES.md",
    "./vendor/BABYLON-LICENSE.md"
  ]) {
    assert.ok(runtimeAssetsSource.includes(`"${asset}"`), `${asset} must be a runtime asset`);
    assert.ok(!coreAssetsSource.includes(`"${asset}"`), `${asset} must not be a core asset`);
  }
  assert.match(worker, /const CACHE\s*=\s*"hh-identity-portal-v951"/);
  assert.match(worker, /const EONWILD_OFFLINE_ASSETS\s*=\s*RUNTIME_ASSETS\.filter/);
  assert.match(worker, /cache\.addAll\(INSTALL_ASSETS\)/);

  for (const asset of ["performance-loader.js", "script.js"]) {
    const escaped = asset.replaceAll(".", "\\.");
    const match = html.match(new RegExp(`<script src="${escaped}\\?v=(\\d+)"`));
    assert.ok(match, `${asset} must have a numeric primary version in index.html`);
    assert.ok(worker.includes(`./${asset}?v=${match[1]}`), `${asset}?v=${match[1]} must be cached by sw.js`);
  }
});

test("keyboard, touch and gamepad controls are real and route-local", () => {
  for (const code of ["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "KeyE", "KeyQ", "KeyR", "KeyC", "KeyP", "KeyF", "KeyN"]) {
    assert.ok(gameSource.includes(code), `missing keyboard control ${code}`);
  }
  for (const direction of ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]) {
    assert.match(gameSource, new RegExp(`data-hwe-touch="${direction}"`));
  }
  assert.match(gameSource, /pointerdown[\s\S]*?setPointerCapture/);
  assert.match(gameSource, /pointerup[\s\S]*?pointercancel[\s\S]*?pointerleave/);
  assert.match(gameSource, /navigator\?\.getGamepads\?\.\(\)/);
  assert.match(gameSource, /data-hwe-action="ability"/);
  assert.match(gameSource, /data-hwe-communication-open/);
});

test("runtime fallback, Time Slice filtering and motion/resize controls fail closed", () => {
  assert.match(gameSource, /function scheduleLiteFallback/);
  assert.match(gameSource, /onFailure:\s*\(\)\s*=>\s*\{\s*scheduleLiteFallback/);
  assert.match(gameSource, /const allowed = SPECIES\.filter\(\(species\) => tierForSpecies\(species\) !== "codex" && speciesAllowedAtAddress/);
  assert.match(gameSource, /Observer only/);
  assert.match(gameSource, /role="group" aria-label="Chọn renderer"/);
  assert.match(gameSource, /RENDERER_ADAPTER\.FLAGSHIP_IDS\.forEach[\s\S]*?visible:\s*false/);
  assert.match(gameSource, /instance\.resizeObserver\?\.observe\(viewport\)/);
  assert.match(gameSource, /reduced3DPreference/);
  assert.match(gameSource, /matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(gameSource, /const adaptiveQuality = instance\.state\.settings\.quality !== "personal" && instance\.state\.settings\.adaptiveQuality/);
  assert.match(gameSource, /adaptiveQuality:\s*adaptiveQuality/);
  assert.match(gameSource, /bootToken\s*!==\s*instance\.rendererBootToken/);
  assert.doesNotMatch(gameSource, /bootToken\s*!==\s*instance\.rendererBootToken\s*\|\|\s*instance\.state\.settings\.renderer\s*===\s*"lite"/);
  assert.match(gameSource, /instance\.rendererBootToken\s*=\s*\(instance\.rendererBootToken\s*\|\|\s*0\)\s*\+\s*1/);
  assert.match(gameSource, /instance\.rendererStartingAdapter\?\.dispose\?\.\(\)/);
  assert.match(gameSource, /isCancelled:\s*\(\)\s*=>\s*instance\.destroyed\s*\|\|\s*bootToken\s*!==\s*instance\.rendererBootToken/);
  assert.match(gameSource, /quickToggle\.setAttribute\("aria-label",\s*loading3D\s*\?\s*"Hủy tải 3D"\s*:\s*"Chế độ 3D"\)/);
  assert.match(gameSource, /quickToggle\.setAttribute\("aria-busy",\s*String\(loading3D\)\)/);
  assert.doesNotMatch(gameSource, /toggleLabel\.textContent\s*=\s*instance\.renderer3d\s*\?\s*"Lite"/);
  assert.match(gameSource, /tierForSpecies\(species\)===\s*"flagship"/);
  assert.match(gameSource, /data-hwe-setting="soundVolume"/);
  assert.match(gameSource, /data-hwe-render-cancel/);
  assert.match(gameSource, /data-hwe-photo-setting="photoFov"/);
  assert.match(gameSource, /data-hwe-photo-setting="photoExposure"/);
  assert.match(gameSource, /catch\s*\(error\)[\s\S]*?instance\.state\.settings\.renderer\s*=\s*"lite";[\s\S]*?saveState\(instance\)/);
  assert.match(css, /\[data-hwe-render-cancel\]\s*\{[^}]*min-height:\s*44px/);
  assert.match(gameSource, /instance\.motionObserver\?\.disconnect/);
  assert.match(css, /\.hwe-root\s*\{[^}]*overflow:\s*clip/);
  assert.match(css, /data-renderer="webgl"/);
});

test("visibility and unmount clean every EonWild v3 runtime resource", () => {
  assert.match(gameSource, /visibilitychange[\s\S]*?global\.document\.hidden[\s\S]*?pauseGame\(instance,\s*"visibility"\)/);
  assert.match(gameSource, /if\s*\(!global\.document\?\.hidden\)\s*\{[\s\S]*?processInputActions[\s\S]*?updateWorld/);
  assert.match(gameSource, /new AbortController\(\)/);
  assert.match(gameSource, /instance\.controller\.abort\(\)/);
  assert.match(gameSource, /clearInterval\(instance\.observerTimer\)/);
  assert.match(gameSource, /instance\.resizeObserver\?\.disconnect\?\.\(\)/);
  assert.match(gameSource, /instance\.motionObserver\?\.disconnect\?\.\(\)/);
  assert.match(gameSource, /global\.cancelAnimationFrame\?\.\(instance\.raf\)/);
  assert.match(gameSource, /instance\.renderer3d\?\.dispose\?\.\(\)/);
  assert.match(gameSource, /instance\.workerAdapter\?\.close\?\.\(\)/);
  assert.match(gameSource, /instance\.simulation\?\.dispose\?\.\(\)/);
  assert.match(gameSource, /instance\.audioContext\?\.close\?\.\(\)/);
});

test("multiplayer UI is truthful, local-first and contains no fake network implementation", () => {
  assert.match(gameSource, /Local single-player/);
  assert.match(gameSource, /Save v1–v3 được migrate đúng một lần sang schema v4/i);
  assert.match(gameSource, /Realtime chưa được bật/i);
  assert.match(gameSource, /Không có room code, người online, leaderboard hoặc máy chủ giả/i);
  assert.match(gameSource, /Backend authoritative mới là điều kiện bắt buộc/i);
  for (const source of [gameSource, contentSource, simulationSource]) {
    assert.doesNotMatch(source, /\b(?:fetch|eval)\s*\(/);
    assert.doesNotMatch(source, /new\s+(?:Function|WebSocket|EventSource|XMLHttpRequest|RTCPeerConnection)\b/);
    assert.doesNotMatch(source, /(?:fake|mock)(?:User|Player|Friend|Room|Server|Leaderboard|Online)/i);
    assert.doesNotMatch(source, /(?:access.?token|refresh.?token|password|client.?secret)\s*[:=]/i);
  }
});

test("the one-viewport UI bounds scrolling and honors accessibility preferences", () => {
  assert.match(css, /body\.app-eonwild-route\s*\{[^}]*overflow:\s*hidden\s*!important/);
  assert.match(css, /\.hwe-root\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/);
  assert.match(css, /\.hwe-main\s*\{[^}]*overflow-y:\s*auto[^}]*overflow-x:\s*hidden/);
  assert.match(css, /\.hwe-root\[data-view="world"\]\s+\.hwe-main\s*\{[^}]*overflow:\s*hidden/);
  assert.match(css, /\.hwe-library,[\s\S]*?\.hwe-network,[\s\S]*?\.hwe-settings\s*\{[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*auto/);
  assert.match(css, /\.hwe-root\s+:where\([^)]*button[^)]*\)\s*\{[^}]*min-height:\s*(?:44|4[5-9]|[5-9]\d)px/);
  assert.match(css, /@media\s*\(max-width:\s*(?:760|768|820|850|900)px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /@media\s*\(forced-colors:\s*active\)/);
});
