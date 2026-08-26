(function (root, factory) {
  "use strict";
  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHEonWildRenderer3D = api;
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function createHHEonWildRenderer3D(runtime) {
  "use strict";

  /*
   * HH EonWild 3D foundation.
   *
   * This adapter is deliberately optional. It owns a separate canvas, loads
   * Babylon lazily, and only exposes that canvas after a scene has rendered once.
   * A failed start therefore never invalidates the existing Canvas2D experience.
   * Terrain and unsupported animal stand-ins remain procedural. Optional
   * same-origin CC0 creature prototypes, environment props and HDR lighting are
   * streamed only after the first frame; their failure never changes the
   * Canvas2D fallback contract.
   */

  const VERSION = "1.6.1";
  // Four 8.192 km half-axes provide a true 16.384 x 16.384 km streamed realm.
  // Only nearby 256 m chunks are materialized, so the larger address space
  // does not multiply active geometry or main-thread work.
  const WORLD_SIZE = 16384;
  const WORLD_HALF = WORLD_SIZE / 2;
  const CHUNK_SIZE = 256;
  const CHUNKS_PER_AXIS = WORLD_SIZE / CHUNK_SIZE;
  const WATER_LEVEL = 3.5;
  const MAX_ACTIVE_CHUNKS = 96;
  const MAX_PENDING_CHUNKS = 128;
  const MAX_FRAME_SAMPLES = 180;
  const MAX_LOADER_URLS = 4;
  const BABYLON_VERSION = "9.22.1";
  const DEFAULT_LOCAL_BABYLON_URL = `./vendor/babylon-${BABYLON_VERSION}.js?v=${BABYLON_VERSION}`;
  const DEFAULT_LOCAL_GLTF_LOADER_URL = `./vendor/babylonjs-loaders-${BABYLON_VERSION}.min.js?v=${BABYLON_VERSION}`;
  const DEFAULT_REMOTE_BABYLON_URL = null;
  const DEFAULT_ENVIRONMENT_ASSET_BASE = "./assets/eonwild/environment/";
  const DEFAULT_CREATURE_ASSET_BASE = "./assets/eonwild/creatures/";
  const DEFAULT_LANDSCAPE_WORKER_URL = "./hh-eonwild-landscape-worker.js?v=1";

  function optionalRuntimeModule(globalName, localPath) {
    if (runtime && runtime[globalName]) return runtime[globalName];
    if (typeof require !== "function") return null;
    try { return require(localPath); }
    catch { return null; }
  }

  const LANDSCAPE_CORE = optionalRuntimeModule("HHEonWildLandscapeCore", "./hh-eonwild-landscape-core.js");
  const VEGETATION_CORE = optionalRuntimeModule("HHEonWildVegetation", "./hh-eonwild-vegetation-system.js");
  const ENVIRONMENT_RENDERER = optionalRuntimeModule("HHEonWildEnvironmentRenderer", "./hh-eonwild-environment-renderer.js");
  const WATER_WEATHER_CORE = optionalRuntimeModule("HHEonWildWaterWeather", "./hh-eonwild-water-weather-system.js");

  const ENVIRONMENT_ASSETS = Object.freeze([
    Object.freeze({ id: "fern", file: "fern-02-1k.glb", kind: "vegetation", scale: 2.15, wind: 0.035, salt: 0x4645524e }),
    Object.freeze({ id: "rock", file: "rock-moss-set-01-1k.glb", kind: "rock", scale: 0.78, wind: 0, salt: 0x524f434b }),
    Object.freeze({ id: "quiver", file: "quiver-tree-02-1k.glb", kind: "vegetation", scale: 5.2, wind: 0.018, salt: 0x54524545 })
  ]);
  const ENVIRONMENT_BUDGETS = Object.freeze({
    low: Object.freeze({ fern: 6, rock: 1, quiver: 0, rainParticles: 48, hdrCubeSize: 64, placementRadius: 2 }),
    balanced: Object.freeze({ fern: 12, rock: 2, quiver: 1, rainParticles: 96, hdrCubeSize: 128, placementRadius: 2 }),
    high: Object.freeze({ fern: 18, rock: 3, quiver: 1, rainParticles: 160, hdrCubeSize: 128, placementRadius: 3 }),
    ultra: Object.freeze({ fern: 26, rock: 4, quiver: 2, rainParticles: 240, hdrCubeSize: 256, placementRadius: 3 }),
    cinematic: Object.freeze({ fern: 32, rock: 8, quiver: 4, rainParticles: 420, hdrCubeSize: 512, placementRadius: 4 })
  });
  const PROCEDURAL_ENVIRONMENT_BUDGETS = Object.freeze({
    low: Object.freeze({ instances: 3000, perChunk: 120, chunks: 18 }),
    balanced: Object.freeze({ instances: 9000, perChunk: 240, chunks: 32 }),
    high: Object.freeze({ instances: 15000, perChunk: 360, chunks: 44 }),
    ultra: Object.freeze({ instances: 24000, perChunk: 480, chunks: 56 }),
    cinematic: Object.freeze({ instances: 36000, perChunk: 620, chunks: 64 })
  });
  const DEFAULT_ENVIRONMENT_HDR_FILE = "kloofendal-partly-cloudy-puresky-1k.hdr";
  const CREATURE_PROTOTYPE_ASSETS = Object.freeze([
    Object.freeze({ id: "tyrannosaurus", file: "quaternius-tyrannosaurus-prototype.glb", scale: 0.4, rotationY: -Math.PI / 2, source: "Quaternius CC0 via Poly Pizza" }),
    Object.freeze({ id: "triceratops", file: "quaternius-triceratops-prototype.glb", scale: 0.44, rotationY: -Math.PI / 2, source: "Quaternius CC0 via Poly Pizza" })
  ]);

  const FLAGSHIP_SPECIES = Object.freeze([
    Object.freeze({ id: "tyrannosaurus", label: "Tyrannosaurus rex", locomotion: "run", color: "#b96d43" }),
    Object.freeze({ id: "triceratops", label: "Triceratops", locomotion: "run", color: "#9fa66f" }),
    Object.freeze({ id: "spinosaurus", label: "Spinosaurus", locomotion: "amphibious", color: "#668d73" }),
    Object.freeze({ id: "pteranodon", label: "Pteranodon", locomotion: "fly", color: "#9b7a66" })
  ]);
  const FLAGSHIP_IDS = Object.freeze(FLAGSHIP_SPECIES.map((species) => species.id));

  const QUALITY_PRESETS = Object.freeze({
    low: Object.freeze({ id: "low", targetFps: 30, renderScale: 0.62, streamRadius: 2, maxChunks: 21, terrainSegments: 12, chunkBuildsPerFrame: 1, farClip: 520 }),
    balanced: Object.freeze({ id: "balanced", targetFps: 45, renderScale: 0.78, streamRadius: 3, maxChunks: 37, terrainSegments: 20, chunkBuildsPerFrame: 1, farClip: 700 }),
    high: Object.freeze({ id: "high", targetFps: 60, renderScale: 0.9, streamRadius: 4, maxChunks: 61, terrainSegments: 28, chunkBuildsPerFrame: 2, farClip: 900 }),
    ultra: Object.freeze({ id: "ultra", targetFps: 60, renderScale: 1, streamRadius: 5, maxChunks: 89, terrainSegments: 36, chunkBuildsPerFrame: 2, farClip: 1100 }),
    cinematic: Object.freeze({ id: "cinematic", targetFps: 60, renderScale: 1, streamRadius: 6, maxChunks: 96, terrainSegments: 48, chunkBuildsPerFrame: 2, farClip: 1600 })
  });
  const QUALITY_ORDER = Object.freeze(["low", "balanced", "high", "ultra", "cinematic"]);
  const ADAPTIVE_MAX_PRESET = "ultra";
  const CINEMATIC_PRESET = "cinematic";
  const QUALITY_ALIASES = Object.freeze({ personal: CINEMATIC_PRESET, "cinematic-personal": CINEMATIC_PRESET });
  const DEFAULT_PHOTO_SETTINGS = Object.freeze({
    sensorHeightMm: 24,
    focalLengthMm: 35,
    apertureFStop: 4,
    shutterSeconds: 1 / 125,
    iso: 100,
    focusDistanceM: 18,
    exposureCompensationEv: 0,
    exposure: 1.02,
    depthOfField: false,
    autofocus: true,
    cameraShake: 0
  });
  const GAMEPLAY_CAMERA_PROFILES = Object.freeze({
    ground: Object.freeze({ id: "ground", distance: 11, minDistance: 1.2, maxDistance: 32, targetHeight: 1.8, fov: 65, defaultPitch: -0.18, minPitch: -1.15, maxPitch: 0.65, collisionPadding: 0.35, maxShoulderOffset: 1.2, headBobScale: 0.1, headBobCyclesPerMeter: 0.72, autoCenterDelay: 0.9, autoCenterRate: 2.4, collisionRecoveryRate: 6, collisionReleaseDelay: 0.12, collisionHysteresis: 0.12 }),
    heavy: Object.freeze({ id: "heavy", distance: 18, minDistance: 2.5, maxDistance: 48, targetHeight: 3.2, fov: 69, defaultPitch: -0.16, minPitch: -1.05, maxPitch: 0.55, collisionPadding: 0.65, maxShoulderOffset: 2, headBobScale: 0.065, headBobCyclesPerMeter: 0.48, autoCenterDelay: 1.15, autoCenterRate: 1.7, collisionRecoveryRate: 4.2, collisionReleaseDelay: 0.18, collisionHysteresis: 0.22 }),
    small: Object.freeze({ id: "small", distance: 6, minDistance: 0.7, maxDistance: 18, targetHeight: 0.8, fov: 62, defaultPitch: -0.22, minPitch: -1.25, maxPitch: 0.75, collisionPadding: 0.22, maxShoulderOffset: 0.55, headBobScale: 0.075, headBobCyclesPerMeter: 1.25, autoCenterDelay: 0.55, autoCenterRate: 3.4, collisionRecoveryRate: 8, collisionReleaseDelay: 0.08, collisionHysteresis: 0.06 }),
    bird: Object.freeze({ id: "bird", distance: 16, minDistance: 1.5, maxDistance: 42, targetHeight: 1.4, fov: 76, defaultPitch: -0.12, minPitch: -1.35, maxPitch: 1.05, collisionPadding: 0.42, maxShoulderOffset: 1.6, headBobScale: 0.02, headBobCyclesPerMeter: 0.42, autoCenterDelay: 0.7, autoCenterRate: 2.2, collisionRecoveryRate: 5, collisionReleaseDelay: 0.1, collisionHysteresis: 0.15 }),
    aquatic: Object.freeze({ id: "aquatic", distance: 13, minDistance: 1.2, maxDistance: 36, targetHeight: 1.1, fov: 72, defaultPitch: -0.08, minPitch: -1.25, maxPitch: 1.05, collisionPadding: 0.5, maxShoulderOffset: 1.2, headBobScale: 0.025, headBobCyclesPerMeter: 0.38, autoCenterDelay: 0.75, autoCenterRate: 2, collisionRecoveryRate: 5, collisionReleaseDelay: 0.14, collisionHysteresis: 0.14 }),
    climbing: Object.freeze({ id: "climbing", distance: 9, minDistance: 0.9, maxDistance: 24, targetHeight: 1.1, fov: 68, defaultPitch: -0.2, minPitch: -1.35, maxPitch: 0.95, collisionPadding: 0.3, maxShoulderOffset: 0.8, headBobScale: 0.05, headBobCyclesPerMeter: 0.85, autoCenterDelay: 0.65, autoCenterRate: 2.8, collisionRecoveryRate: 7, collisionReleaseDelay: 0.1, collisionHysteresis: 0.08 }),
    burrow: Object.freeze({ id: "burrow", distance: 5, minDistance: 0.5, maxDistance: 14, targetHeight: 0.55, fov: 60, defaultPitch: -0.12, minPitch: -0.9, maxPitch: 0.5, collisionPadding: 0.18, maxShoulderOffset: 0.35, headBobScale: 0.035, headBobCyclesPerMeter: 1.45, autoCenterDelay: 0.45, autoCenterRate: 3.8, collisionRecoveryRate: 9, collisionReleaseDelay: 0.06, collisionHysteresis: 0.04 })
  });
  const GAMEPLAY_CAMERA_PROFILE_IDS = Object.freeze(Object.keys(GAMEPLAY_CAMERA_PROFILES));
  const DEFAULT_GAMEPLAY_CAMERA = Object.freeze({
    active: false,
    yaw: 0,
    pitch: GAMEPLAY_CAMERA_PROFILES.ground.defaultPitch,
    distance: GAMEPLAY_CAMERA_PROFILES.ground.distance,
    fov: GAMEPLAY_CAMERA_PROFILES.ground.fov,
    profileId: "ground",
    firstPerson: false,
    cameraShake: 0,
    smoothing: 10,
    shoulderOffset: 0,
    headBob: 0,
    movementSpeed: 0,
    autoCenter: false,
    autoCenterDelay: GAMEPLAY_CAMERA_PROFILES.ground.autoCenterDelay,
    autoCenterRate: GAMEPLAY_CAMERA_PROFILES.ground.autoCenterRate,
    playerHeading: 0,
    lookBack: false,
    collisionRecoveryRate: GAMEPLAY_CAMERA_PROFILES.ground.collisionRecoveryRate,
    collisionReleaseDelay: GAMEPLAY_CAMERA_PROFILES.ground.collisionReleaseDelay,
    collisionHysteresis: GAMEPLAY_CAMERA_PROFILES.ground.collisionHysteresis
  });
  const CAMERA_COLLISION_RAY_OFFSETS = Object.freeze([
    Object.freeze([0, 0]),
    Object.freeze([1, 0]),
    Object.freeze([-1, 0]),
    Object.freeze([0, 1]),
    Object.freeze([0, -1])
  ]);
  const CAMERA_BLOCKER_CATEGORIES = Object.freeze(new Set(["mature-tree", "dead-tree", "sapling", "root", "log"]));
  const MAX_INTERACTIVE_RESOURCE_MARKERS = 48;
  const INTERACTIVE_RESOURCE_DISTANCE = 180;
  const PROCEDURAL_LAKE_OFFSETS = Object.freeze([
    Object.freeze([-540, -310]), Object.freeze([460, -620]), Object.freeze([720, 280]),
    Object.freeze([-680, 520]), Object.freeze([220, 760]), Object.freeze([-180, -840])
  ]);
  // A restrained indirect-light floor keeps vertex-coloured terrain readable
  // on WebGPU while the optional IBL is absent or still compiling. Directional
  // sun and weather shading remain active; this is not an unlit override.
  const READABILITY_FLOORS = Object.freeze({
    daylightThreshold: 0.42,
    ambientIntensity: 0.68,
    sunIntensity: 0.9,
    exposure: 1.08,
    sceneAmbient: Object.freeze([0.42, 0.48, 0.4]),
    hemisphereGround: Object.freeze([0.26, 0.3, 0.24]),
    terrainStandardEmissive: Object.freeze([0.78, 0.84, 0.7]),
    terrainPbrEmissive: Object.freeze([0.26, 0.3, 0.22]),
    terrainNightStandardEmissive: Object.freeze([0.045, 0.055, 0.04]),
    terrainNightPbrEmissive: Object.freeze([0.012, 0.015, 0.01]),
    terrainEnvironmentIntensity: 0.92
  });

  const TERRAIN_COLORS = Object.freeze({
    waterbed: Object.freeze([0.16, 0.25, 0.2]),
    floodplain: Object.freeze([0.27, 0.42, 0.24]),
    fern: Object.freeze([0.2, 0.38, 0.2]),
    conifer: Object.freeze([0.13, 0.3, 0.2]),
    upland: Object.freeze([0.38, 0.4, 0.23]),
    badland: Object.freeze([0.48, 0.31, 0.2]),
    rock: Object.freeze([0.34, 0.34, 0.31])
  });
  const LANDSCAPE_BIOME_COLORS = Object.freeze({
    ocean: Object.freeze([0.1, 0.19, 0.2]),
    coast: Object.freeze([0.53, 0.46, 0.32]),
    dunes: Object.freeze([0.58, 0.49, 0.33]),
    floodplain: Object.freeze([0.25, 0.38, 0.21]),
    wetland: Object.freeze([0.18, 0.32, 0.23]),
    swamp: Object.freeze([0.15, 0.27, 0.19]),
    rainforest: Object.freeze([0.13, 0.3, 0.17]),
    forest: Object.freeze([0.16, 0.31, 0.18]),
    conifer: Object.freeze([0.14, 0.27, 0.2]),
    grassland: Object.freeze([0.35, 0.43, 0.2]),
    scrub: Object.freeze([0.39, 0.39, 0.22]),
    badland: Object.freeze([0.46, 0.3, 0.19]),
    alpine: Object.freeze([0.4, 0.41, 0.38]),
    snow: Object.freeze([0.71, 0.76, 0.76]),
    volcanic: Object.freeze([0.25, 0.22, 0.21]),
    river: Object.freeze([0.18, 0.28, 0.2])
  });

  const loaderPromises = new Map();
  const gltfLoaderPromises = new Map();
  const clamp = (value, min, max) => {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : min));
  };
  const finite = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  const now = () => runtime.performance && typeof runtime.performance.now === "function" ? runtime.performance.now() : Date.now();
  const lerp = (a, b, amount) => a + (b - a) * amount;
  const smooth = (value) => value * value * (3 - 2 * value);
  const wrapAngle = (value) => {
    const angle = finite(value, 0);
    const wrapped = ((angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return wrapped === -Math.PI ? Math.PI : wrapped;
  };
  const shortestAngleDelta = (from, to) => wrapAngle(finite(to, 0) - finite(from, 0));
  const defaultGameplayCameraProfileForSpecies = (speciesId) => {
    const id = String(speciesId || "").toLowerCase();
    if (id === "pteranodon") return "bird";
    if (id === "spinosaurus" || id === "triceratops" || id === "tyrannosaurus") return "heavy";
    return "ground";
  };
  function normalizeGameplayCamera(value = {}, previous = DEFAULT_GAMEPLAY_CAMERA) {
    const source = value && typeof value === "object" ? value : {};
    const priorSource = previous && typeof previous === "object" ? previous : DEFAULT_GAMEPLAY_CAMERA;
    const prior = { ...DEFAULT_GAMEPLAY_CAMERA, ...priorSource };
    const requestedProfile = String(source.profileId ?? source.profile ?? prior.profileId ?? "ground").toLowerCase();
    const profileId = GAMEPLAY_CAMERA_PROFILES[requestedProfile] ? requestedProfile : (GAMEPLAY_CAMERA_PROFILES[prior.profileId] ? prior.profileId : "ground");
    const profile = GAMEPLAY_CAMERA_PROFILES[profileId];
    const profileChanged = profileId !== prior.profileId;
    const firstPerson = source.firstPerson === undefined ? Boolean(prior.firstPerson) : Boolean(source.firstPerson);
    const numberOr = (candidate, fallback) => Number.isFinite(Number(candidate)) ? Number(candidate) : fallback;
    const fovInput = source.fov === undefined ? source.fovDegrees : source.fov;
    return freezeRecord({
      active: source.active === undefined ? true : Boolean(source.active),
      yaw: wrapAngle(numberOr(source.yaw, prior.yaw)),
      pitch: clamp(numberOr(source.pitch, profileChanged ? profile.defaultPitch : prior.pitch), profile.minPitch, profile.maxPitch),
      distance: clamp(numberOr(source.distance, profileChanged ? profile.distance : prior.distance), firstPerson ? 0.1 : profile.minDistance, profile.maxDistance),
      fov: clamp(numberOr(fovInput, profileChanged ? profile.fov : prior.fov), 35, 120),
      profileId,
      firstPerson,
      cameraShake: clamp(numberOr(source.cameraShake ?? source.shake, prior.cameraShake), 0, 1),
      smoothing: clamp(numberOr(source.smoothing, prior.smoothing), 0, 30),
      shoulderOffset: clamp(numberOr(source.shoulderOffset, prior.shoulderOffset), -profile.maxShoulderOffset, profile.maxShoulderOffset),
      headBob: clamp(numberOr(source.headBob, prior.headBob), 0, 1),
      movementSpeed: clamp(numberOr(source.movementSpeed ?? source.speed, prior.movementSpeed), 0, 100),
      autoCenter: source.autoCenter === undefined && source.autoCenterCamera === undefined ? Boolean(prior.autoCenter) : Boolean(source.autoCenter ?? source.autoCenterCamera),
      autoCenterDelay: clamp(numberOr(source.autoCenterDelay, profileChanged ? profile.autoCenterDelay : prior.autoCenterDelay), 0, 5),
      autoCenterRate: clamp(numberOr(source.autoCenterRate, profileChanged ? profile.autoCenterRate : prior.autoCenterRate), 0, 10),
      playerHeading: wrapAngle(numberOr(source.playerHeading, prior.playerHeading)),
      lookBack: source.lookBack === undefined ? Boolean(prior.lookBack) : Boolean(source.lookBack),
      collisionRecoveryRate: clamp(numberOr(source.collisionRecoveryRate, profileChanged ? profile.collisionRecoveryRate : prior.collisionRecoveryRate), 0, 30),
      collisionReleaseDelay: clamp(numberOr(source.collisionReleaseDelay, profileChanged ? profile.collisionReleaseDelay : prior.collisionReleaseDelay), 0, 1),
      collisionHysteresis: clamp(numberOr(source.collisionHysteresis, profileChanged ? profile.collisionHysteresis : prior.collisionHysteresis), 0, 2)
    });
  }
  function gameplayCameraToArc(value = DEFAULT_GAMEPLAY_CAMERA) {
    const state = normalizeGameplayCamera({ ...value, active: value?.active !== false }, value);
    return freezeRecord({
      alpha: wrapAngle(-state.yaw - Math.PI / 2),
      beta: clamp(Math.PI / 2 + state.pitch, 0.05, Math.PI - 0.05),
      radius: state.distance,
      fovRadians: state.fov * Math.PI / 180
    });
  }
  function gameplayCameraOffset(yaw, pitch, distance) {
    const horizontal = Math.cos(finite(pitch, 0));
    const radius = Math.max(0, finite(distance, 0));
    return freezeRecord({
      x: -Math.sin(finite(yaw, 0)) * horizontal * radius,
      y: -Math.sin(finite(pitch, 0)) * radius,
      z: -Math.cos(finite(yaw, 0)) * horizontal * radius
    });
  }
  function gameplayLookDirection(yaw, pitch) {
    const boundedPitch = clamp(pitch, -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001);
    const horizontal = Math.cos(boundedPitch);
    return freezeRecord({
      x: Math.sin(finite(yaw, 0)) * horizontal,
      y: Math.sin(boundedPitch),
      z: Math.cos(finite(yaw, 0)) * horizontal
    });
  }

  function headingToProxyRotation(heading) {
    // Gameplay heading is measured from +Z (0 = forward). Procedural creature
    // meshes are authored facing +X, so their Babylon root needs a -90° basis
    // correction while the public heading contract stays renderer-neutral.
    return wrapAngle(finite(heading, 0) - Math.PI / 2);
  }

  function gameplayCameraForwardXZ(appliedCamera, requestedCamera = DEFAULT_GAMEPLAY_CAMERA) {
    const yaw = finite(appliedCamera?.yaw, finite(requestedCamera?.yaw, DEFAULT_GAMEPLAY_CAMERA.yaw));
    const direction = gameplayLookDirection(yaw, 0);
    return freezeRecord({ x: direction.x, z: direction.z });
  }

  function isCameraObstructionMesh(mesh) {
    const metadata = mesh?.metadata || {};
    if (metadata.cameraObstruction === true) return true;
    return metadata.targetType === "animal" && metadata.targetable === true && metadata.isPlayer !== true;
  }

  function cameraObstructionKind(mesh) {
    const metadata = mesh?.metadata || {};
    if (metadata.targetType === "animal" && metadata.isPlayer !== true) return "creature";
    return String(metadata.cameraObstructionKind || metadata.kind || "obstruction");
  }
  function raySphereIntersectionDistance(origin, direction, center, radius, maximumDistance = Infinity) {
    if (!origin || !direction || !center) return null;
    const dx = finite(direction.x, NaN); const dy = finite(direction.y, NaN); const dz = finite(direction.z, NaN);
    const length = Math.hypot(dx, dy, dz);
    const boundedRadius = Math.max(0, finite(radius, 0));
    if (!Number.isFinite(length) || length <= 1e-9 || boundedRadius <= 0) return null;
    const ux = dx / length; const uy = dy / length; const uz = dz / length;
    const ox = finite(origin.x, NaN) - finite(center.x, NaN);
    const oy = finite(origin.y, NaN) - finite(center.y, NaN);
    const oz = finite(origin.z, NaN) - finite(center.z, NaN);
    if (![ox, oy, oz].every(Number.isFinite)) return null;
    const projection = ox * ux + oy * uy + oz * uz;
    const discriminant = projection * projection - (ox * ox + oy * oy + oz * oz - boundedRadius * boundedRadius);
    if (discriminant < 0) return null;
    const root = Math.sqrt(discriminant);
    const near = -projection - root;
    const far = -projection + root;
    const distance = near >= 0 ? near : (far >= 0 ? 0 : null);
    const limit = Math.max(0, finite(maximumDistance, Infinity));
    return distance !== null && distance <= limit ? distance : null;
  }
  function safeEntityId(value) {
    return String(value == null ? "" : value).normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 128);
  }
  function exactMetadataEntityId(metadata) {
    if (!metadata || metadata.identityExact !== true) return "";
    const targetId = safeEntityId(metadata.targetId);
    const entityId = safeEntityId(metadata.entityId);
    if (targetId && entityId && targetId !== entityId) return "";
    return targetId || entityId;
  }
  const normalizePreset = (value, fallback = "balanced") => {
    const normalized = String(value || "").trim().toLowerCase();
    const aliased = QUALITY_ALIASES[normalized] || normalized;
    return Object.prototype.hasOwnProperty.call(QUALITY_PRESETS, aliased) ? aliased : fallback;
  };
  const compactError = (error) => ({
    name: String(error && error.name || "Error").slice(0, 80),
    message: String(error && error.message || error || "Unknown error").slice(0, 360)
  });
  const freezeRecord = (value) => Object.freeze(value);
  const safeCall = (callback, value) => {
    if (typeof callback !== "function") return;
    try { callback(value); } catch { /* Host callbacks must not break the renderer. */ }
  };
  const safeDispose = (value) => {
    if (!value || typeof value.dispose !== "function") return;
    try { value.dispose(); } catch { /* Best-effort cleanup during fallback. */ }
  };

  function makeReason(code, message, stage, details, recoverable = true) {
    return freezeRecord({
      code: String(code || "UNKNOWN_FAILURE"),
      message: String(message || "The optional 3D renderer could not start."),
      stage: String(stage || "unknown"),
      recoverable: Boolean(recoverable),
      fallback: "canvas2d",
      details: details && typeof details === "object" ? freezeRecord({ ...details }) : freezeRecord({})
    });
  }

  function makeResult(ok, fields) {
    return freezeRecord({ ok: Boolean(ok), ...(fields || {}) });
  }

  function hashSeed(value) {
    const text = String(value === undefined ? "eonwild-mesozoic" : value).slice(0, 128);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function hash2D(x, z, seed) {
    let hash = (seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263)) >>> 0;
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0;
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967295;
  }

  function valueNoise(x, z, scale, seed) {
    const scaledX = x / scale;
    const scaledZ = z / scale;
    const x0 = Math.floor(scaledX);
    const z0 = Math.floor(scaledZ);
    const tx = smooth(scaledX - x0);
    const tz = smooth(scaledZ - z0);
    const top = lerp(hash2D(x0, z0, seed), hash2D(x0 + 1, z0, seed), tx);
    const bottom = lerp(hash2D(x0, z0 + 1, seed), hash2D(x0 + 1, z0 + 1, seed), tx);
    return lerp(top, bottom, tz);
  }

  function terrainHeightNumeric(worldX, worldZ, seed) {
    const x = clamp(worldX, 0, WORLD_SIZE);
    const z = clamp(worldZ, 0, WORLD_SIZE);
    const warpX = (valueNoise(x, z, 720, seed ^ 0x9e3779b9) - 0.5) * 180;
    const warpZ = (valueNoise(x, z, 690, seed ^ 0x85ebca6b) - 0.5) * 180;
    const continental = valueNoise(x + warpX, z + warpZ, 940, seed);
    const hills = valueNoise(x - warpZ, z + warpX, 310, seed ^ 0x27d4eb2f) - 0.5;
    const detail = valueNoise(x, z, 96, seed ^ 0x165667b1) - 0.5;
    const ridgeNoise = valueNoise(x + 217, z - 131, 470, seed ^ 0xd3a2646c);
    const ridge = Math.pow(1 - Math.abs(ridgeNoise * 2 - 1), 2);
    const channelNoise = Math.abs(valueNoise(x + 611, z - 347, 560, seed ^ 0xfd7046c5) * 2 - 1);
    const channel = channelNoise < 0.12 ? (0.12 - channelNoise) * 105 : 0;
    const edgeTaper = Math.min(1, Math.min(x, z, WORLD_SIZE - x, WORLD_SIZE - z) / 170);
    const height = 8 + (continental - 0.43) * 62 + hills * 31 + ridge * 16 + detail * 7 - channel;
    return lerp(WATER_LEVEL - 7, height, smooth(clamp(edgeTaper, 0, 1)));
  }

  function terrainSampleNumeric(worldX, worldZ, seed) {
    const height = terrainHeightNumeric(worldX, worldZ, seed);
    const moisture = valueNoise(worldX + 83, worldZ - 47, 390, seed ^ 0xa24baed5);
    const heat = valueNoise(worldX - 101, worldZ + 229, 780, seed ^ 0x9fb21c65);
    let biome = "fern";
    if (height <= WATER_LEVEL - 0.5) biome = "waterbed";
    else if (height <= WATER_LEVEL + 4 || moisture > 0.73) biome = "floodplain";
    else if (height > 64) biome = heat > 0.58 ? "badland" : "rock";
    else if (moisture > 0.57) biome = "conifer";
    else if (moisture < 0.3) biome = "upland";
    return { height, moisture, heat, biome, color: TERRAIN_COLORS[biome] };
  }

  function createProceduralLandscape(options = {}) {
    if (!LANDSCAPE_CORE || typeof LANDSCAPE_CORE.createLandscapeCore !== "function") return null;
    try {
      return LANDSCAPE_CORE.createLandscapeCore({
        seed: options.seed || "eonwild-mesozoic",
        realmId: options.realmId || options.eraRealm || "mesozoic",
        timeSliceId: options.timeSliceId || options.timeSlice || "cretaceous",
        regionId: options.regionId || "eonwild-wilds",
        worldSize: WORLD_SIZE,
        chunkSize: CHUNK_SIZE,
        seaLevel: WATER_LEVEL,
        maxGeometryBuildsPerFrame: clamp(options.maxGeometryBuildsPerFrame || 2, 1, 4)
      });
    } catch { return null; }
  }

  function landscapeColor(sample, fallback) {
    const explicit = Array.isArray(sample?.color) ? sample.color : Array.isArray(sample?.albedo) ? sample.albedo : null;
    const biomeId = String(sample?.biomeId || sample?.biome || "").toLowerCase();
    const base = explicit && explicit.length >= 3 ? explicit : LANDSCAPE_BIOME_COLORS[biomeId] || fallback || TERRAIN_COLORS.fern;
    const wetness = clamp(sample?.wetness ?? sample?.moisture ?? 0.45, 0, 1);
    const ash = clamp(sample?.ash ?? sample?.materialWeights?.ash ?? 0, 0, 1);
    const snow = clamp(sample?.snow ?? sample?.materialWeights?.snow ?? 0, 0, 1);
    const macro = clamp(sample?.macroVariation ?? 0.5, 0, 1);
    const shade = 0.88 + macro * 0.18 - wetness * 0.08;
    return [0, 1, 2].map((index) => clamp((base[index] * shade) * (1 - ash * 0.55 - snow * 0.42) + ash * 0.16 + snow * 0.72, 0.035, 0.92));
  }

  function terrainSampleFromProvider(provider, worldX, worldZ, seed) {
    if (!provider || typeof provider.sample !== "function") return terrainSampleNumeric(worldX, worldZ, seed);
    try {
      const source = provider.sample(worldX, worldZ) || {};
      const height = finite(source.height ?? source.elevation, terrainHeightNumeric(worldX, worldZ, seed));
      const moisture = clamp(source.moisture ?? source.humidity ?? 0.5, 0, 1);
      const heat = clamp(source.heat ?? source.temperature ?? 0.5, 0, 1);
      const biome = String(source.biomeId || source.biome || "forest").toLowerCase();
      return { ...source, height, moisture, heat, biome, color: landscapeColor(source, TERRAIN_COLORS.fern) };
    } catch { return terrainSampleNumeric(worldX, worldZ, seed); }
  }

  function sampleTerrainHeight(worldX, worldZ, seed = "eonwild-mesozoic") {
    return terrainHeightNumeric(worldX, worldZ, hashSeed(seed));
  }

  function sampleTerrain(worldX, worldZ, seed = "eonwild-mesozoic") {
    const sample = terrainSampleNumeric(clamp(worldX, 0, WORLD_SIZE), clamp(worldZ, 0, WORLD_SIZE), hashSeed(seed));
    return freezeRecord({
      x: clamp(worldX, 0, WORLD_SIZE),
      z: clamp(worldZ, 0, WORLD_SIZE),
      height: sample.height,
      moisture: sample.moisture,
      heat: sample.heat,
      biome: sample.biome,
      underwater: sample.height < WATER_LEVEL
    });
  }

  function planProceduralLakes(landscape, playerX, playerZ) {
    if (!landscape || typeof landscape.sample !== "function") return Object.freeze([]);
    const lakes = [];
    for (let index = 0; index < PROCEDURAL_LAKE_OFFSETS.length && lakes.length < 2; index += 1) {
      const offset = PROCEDURAL_LAKE_OFFSETS[index];
      const worldX = clamp(finite(playerX, WORLD_HALF) + offset[0], 96, WORLD_SIZE - 96);
      const worldZ = clamp(finite(playerZ, WORLD_HALF) + offset[1], 96, WORLD_SIZE - 96);
      const sample = terrainSampleFromProvider(landscape, worldX, worldZ, hashSeed("eonwild-lakes"));
      if (sample.height <= WATER_LEVEL + .6 || sample.moisture < .68 || finite(sample.slopeDegrees, finite(sample.slope) * 57.2958) > 9) continue;
      const swamp = ["wetland", "rainforest"].includes(String(sample.biome));
      lakes.push(freezeRecord({
        id: `procedural-${swamp ? "swamp" : "lake"}-${index}`,
        type: swamp ? "swamp" : "lake",
        worldX,
        worldZ,
        level: sample.height + .12,
        width: swamp ? 58 : 92,
        length: swamp ? 88 : 126,
        depth: swamp ? 1.4 : 5.2,
        sediment: swamp ? .82 : .28,
        clarity: swamp ? .26 : .72,
        flowSpeed: .08
      }));
    }
    return Object.freeze(lakes);
  }

  function queryLandscapeWater(landscape, worldX, worldZ, options = {}) {
    if (!landscape || typeof landscape.sample !== "function") return null;
    const x = clamp(worldX, 0, WORLD_SIZE);
    const z = clamp(worldZ, 0, WORLD_SIZE);
    const sample = terrainSampleFromProvider(landscape, x, z, hashSeed(options.seed || "eonwild-water-query"));
    const seaLevel = finite(landscape.config?.seaLevel, WATER_LEVEL);
    if (sample.height <= seaLevel) return freezeRecord({ inside: true, isWater: true, type: "ocean", surfaceHeight: seaLevel, depth: Math.max(0, seaLevel - sample.height), walkable: false });
    const river = sample.river;
    if (river && finite(river.distance, Infinity) <= Math.max(.5, finite(river.width, 0))) {
      const surfaceHeight = finite(river.bedHeight, sample.height) + .18;
      return freezeRecord({ inside: true, isWater: true, type: "river", surfaceHeight, depth: Math.max(.18, surfaceHeight - sample.height), walkable: false });
    }
    const lakes = Array.isArray(options.lakes) ? options.lakes : [];
    for (const lake of lakes) {
      const radiusX = Math.max(1, finite(lake.width, 1) * .5);
      const radiusZ = Math.max(1, finite(lake.length, 1) * .5);
      const dx = (x - finite(lake.worldX)) / radiusX;
      const dz = (z - finite(lake.worldZ)) / radiusZ;
      if (dx * dx + dz * dz > 1) continue;
      return freezeRecord({ inside: true, isWater: true, type: String(lake.type || "lake"), surfaceHeight: finite(lake.level, sample.height), depth: Math.max(0, finite(lake.depth, finite(lake.level) - sample.height)), walkable: false });
    }
    return null;
  }

  function testWebGL(documentRef, kind) {
    if (!documentRef || typeof documentRef.createElement !== "function") return false;
    let canvas;
    let context;
    try {
      canvas = documentRef.createElement("canvas");
      context = canvas && typeof canvas.getContext === "function"
        ? canvas.getContext(kind, { failIfMajorPerformanceCaveat: true })
        : null;
      return Boolean(context);
    } catch {
      return false;
    } finally {
      const extension = context && typeof context.getExtension === "function" ? context.getExtension("WEBGL_lose_context") : null;
      try { extension && extension.loseContext(); } catch { /* Probe canvas only. */ }
      canvas = null;
      context = null;
    }
  }

  function detectCapabilities(options = {}) {
    const scope = options.runtime || runtime;
    const documentRef = options.document || scope.document;
    const navigatorRef = options.navigator || scope.navigator || {};
    let reducedMotion = false;
    try { reducedMotion = Boolean(scope.matchMedia && scope.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch { /* Optional media query. */ }
    const canvas = Boolean(documentRef && typeof documentRef.createElement === "function");
    const webgl2 = options.skipContextProbe ? null : testWebGL(documentRef, "webgl2");
    const webgl = options.skipContextProbe ? null : (webgl2 || testWebGL(documentRef, "webgl") || testWebGL(documentRef, "experimental-webgl"));
    const webgpu = Boolean(navigatorRef && navigatorRef.gpu);
    const preferredBackend = webgpu ? "webgpu" : webgl2 ? "webgl2" : webgl ? "webgl1" : null;
    return freezeRecord({
      dom: Boolean(documentRef),
      canvas,
      webgpu,
      webgl2,
      webgl,
      preferredBackend,
      rendererAvailable: Boolean(canvas && (webgpu || webgl)),
      secureContext: scope.isSecureContext !== false,
      pageVisibility: Boolean(documentRef && "hidden" in documentRef),
      resizeObserver: typeof scope.ResizeObserver === "function",
      offscreenCanvas: typeof scope.OffscreenCanvas === "function",
      reducedMotion,
      touch: finite(navigatorRef.maxTouchPoints, 0) > 0,
      hardwareConcurrency: clamp(navigatorRef.hardwareConcurrency || 0, 0, 256),
      deviceMemoryGB: clamp(navigatorRef.deviceMemory || 0, 0, 128),
      devicePixelRatio: clamp(scope.devicePixelRatio || 1, 0.5, 8),
      babylonPresent: isBabylonNamespace(options.babylon || scope.BABYLON),
      integrations: freezeRecord({ physics: "kinematic-proxy-only", rapier: false, recast: false, navmesh: false, gameplayCamera: true, cameraCollision: "terrain-ray-when-running" })
    });
  }

  function isBabylonNamespace(value) {
    return Boolean(value && typeof value === "object" && typeof value.Engine === "function" && typeof value.Scene === "function");
  }

  function validateBabylonNamespace(value) {
    if (!isBabylonNamespace(value)) return false;
    const required = ["ArcRotateCamera", "Color3", "Color4", "DirectionalLight", "HemisphericLight", "Mesh", "MeshBuilder", "StandardMaterial", "TransformNode", "Vector3", "VertexData"];
    return required.every((key) => typeof value[key] === "function" || (key === "MeshBuilder" && value[key] && typeof value[key] === "object"));
  }

  function normalizeUrl(url, documentRef) {
    const value = String(url || "").trim();
    if (!value) return "";
    if (/^(?:javascript|data):/i.test(value)) return "";
    try { return String(new URL(value, documentRef && documentRef.baseURI || runtime.location && runtime.location.href || undefined)); }
    catch { return value; }
  }

  function isRemoteUrl(url, documentRef) {
    try {
      const parsed = new URL(url, documentRef && documentRef.baseURI || runtime.location && runtime.location.href || undefined);
      let origin = runtime.location && runtime.location.origin || documentRef && documentRef.location && documentRef.location.origin;
      if (!origin && documentRef && documentRef.baseURI) {
        try { origin = new URL(documentRef.baseURI).origin; } catch { /* A non-URL base is treated as unknown. */ }
      }
      return /^https?:$/i.test(parsed.protocol) && (!origin || parsed.origin !== origin);
    } catch {
      return /^https?:\/\//i.test(String(url || ""));
    }
  }

  function isSameOriginAssetUrl(url, documentRef) {
    try {
      const baseValue = documentRef?.baseURI || runtime.location?.href;
      if (!baseValue) return false;
      const base = new URL(baseValue);
      const parsed = new URL(String(url || ""), base);
      if (base.protocol === "file:") return parsed.protocol === "file:";
      return ["http:", "https:"].includes(base.protocol) && parsed.protocol === base.protocol && parsed.origin === base.origin;
    } catch { return false; }
  }

  function trustedBlobAssetUrl(definition, documentRef) {
    if (definition?.trustedObjectUrl !== true) return "";
    try {
      const base = new URL(documentRef?.baseURI || runtime.location?.href);
      const parsed = new URL(String(definition.file || ""));
      return parsed.protocol === "blob:" && parsed.origin === base.origin ? parsed.href : "";
    } catch { return ""; }
  }

  function createRuntimeTexture(B, scene, definition, documentRef, options = {}) {
    const url = trustedBlobAssetUrl(definition, documentRef);
    if (!url || !/^image\//i.test(String(definition?.contentType || "")) || typeof B.Texture !== "function") return null;
    try {
      const texture = new B.Texture(url, scene, options.noMipmap === true, false, B.Texture.TRILINEAR_SAMPLINGMODE);
      texture.name = "hwe3d-personal-" + String(definition.role || definition.channel || "texture").replace(/[^a-z0-9-]+/gi, "-");
      texture.wrapU = B.Texture.WRAP_ADDRESSMODE;
      texture.wrapV = B.Texture.WRAP_ADDRESSMODE;
      texture.uScale = finite(options.uScale, 1);
      texture.vScale = finite(options.vScale, 1);
      if ("anisotropicFilteringLevel" in texture) texture.anisotropicFilteringLevel = Math.round(clamp(options.anisotropy || 8, 1, 16));
      return texture;
    } catch { return null; }
  }

  function resolveBabylonUrls(options, documentRef) {
    const allowRemote = options.allowRemoteBabylon === true;
    const explicit = Array.isArray(options.babylonUrls) ? options.babylonUrls : (Array.isArray(options.urls) ? options.urls : []);
    const candidates = explicit.length ? explicit.slice() : [
      options.localBabylonUrl || options.localUrl || DEFAULT_LOCAL_BABYLON_URL,
      ...(allowRemote ? [options.remoteBabylonUrl || options.remoteUrl || DEFAULT_REMOTE_BABYLON_URL].filter(Boolean) : [])
    ];
    const unique = [];
    for (const candidate of candidates) {
      const normalized = normalizeUrl(candidate, documentRef);
      if (!normalized || unique.includes(normalized)) continue;
      if (!allowRemote && isRemoteUrl(normalized, documentRef)) continue;
      unique.push(normalized);
      if (unique.length >= MAX_LOADER_URLS) break;
    }
    return unique.sort((left, right) => Number(isRemoteUrl(left, documentRef)) - Number(isRemoteUrl(right, documentRef)));
  }

  function loadScript(url, options, documentRef) {
    const cacheKey = String(url);
    if (loaderPromises.has(cacheKey)) return loaderPromises.get(cacheKey);
    const timeoutMs = clamp(options.loadTimeoutMs || options.timeoutMs || 12000, 1000, 30000);
    const promise = new Promise((resolve, reject) => {
      if (!documentRef || typeof documentRef.createElement !== "function") {
        const error = new Error("A DOM is required to load Babylon.js.");
        error.code = "DOM_UNAVAILABLE";
        reject(error);
        return;
      }

      let settled = false;
      let owned = false;
      let script = null;
      const scripts = documentRef.scripts ? Array.from(documentRef.scripts) : [];
      script = scripts.find((candidate) => normalizeUrl(candidate.src, documentRef) === url && candidate.dataset?.hweBabylonState !== "failed") || null;
      if (!script) {
        script = documentRef.createElement("script");
        owned = true;
        script.async = true;
        script.src = url;
        script.dataset.hweBabylonLoader = VERSION;
        script.dataset.hweBabylonState = "loading";
        if (options.nonce) script.nonce = String(options.nonce);
        if (options.integrity && typeof options.integrity === "string") {
          script.integrity = options.integrity;
          script.crossOrigin = options.crossOrigin || "anonymous";
        } else if (isRemoteUrl(url, documentRef) && options.crossOrigin !== false) {
          script.crossOrigin = typeof options.crossOrigin === "string" ? options.crossOrigin : "anonymous";
        }
        script.referrerPolicy = options.referrerPolicy || "no-referrer";
      }
      const removeManagedScript = () => {
        const managed = owned || Boolean(script?.dataset?.hweBabylonLoader);
        if (managed && script && typeof script.remove === "function") script.remove();
      };
      const markScriptFailed = () => {
        if (script?.dataset) script.dataset.hweBabylonState = "failed";
        removeManagedScript();
      };

      const cleanup = () => {
        runtime.clearTimeout(timer);
        if (script && typeof script.removeEventListener === "function") {
          script.removeEventListener("load", onLoad);
          script.removeEventListener("error", onError);
        }
      };
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback(value);
      };
      const onLoad = () => {
        if (isBabylonNamespace(runtime.BABYLON)) {
          if (script?.dataset) script.dataset.hweBabylonState = "ready";
          finish(resolve, runtime.BABYLON);
        }
        else {
          const error = new Error("The script loaded but did not expose a Babylon namespace.");
          error.code = "BABYLON_NAMESPACE_MISSING";
          markScriptFailed();
          finish(reject, error);
        }
      };
      const onError = () => {
        const error = new Error(`Could not load Babylon.js from ${url}.`);
        error.code = "BABYLON_SCRIPT_ERROR";
        markScriptFailed();
        finish(reject, error);
      };
      const timer = runtime.setTimeout(() => {
        const error = new Error(`Timed out loading Babylon.js after ${timeoutMs} ms.`);
        error.code = "BABYLON_LOAD_TIMEOUT";
        markScriptFailed();
        finish(reject, error);
      }, timeoutMs);

      if (typeof script.addEventListener === "function") {
        script.addEventListener("load", onLoad);
        script.addEventListener("error", onError);
      } else {
        script.onload = onLoad;
        script.onerror = onError;
      }
      if (isBabylonNamespace(runtime.BABYLON)) {
        finish(resolve, runtime.BABYLON);
      } else if (owned) {
        const parent = documentRef.head || documentRef.body || documentRef.documentElement;
        if (!parent || typeof parent.appendChild !== "function") {
          const error = new Error("No document node can host the Babylon.js loader.");
          error.code = "SCRIPT_HOST_MISSING";
          finish(reject, error);
        } else {
          parent.appendChild(script);
        }
      }
    }).catch((error) => {
      loaderPromises.delete(cacheKey);
      throw error;
    });
    loaderPromises.set(cacheKey, promise);
    return promise;
  }

  async function loadBabylon(options = {}) {
    const direct = options.babylon || runtime.BABYLON;
    if (isBabylonNamespace(direct)) return direct;
    if (typeof options.loadBabylon === "function") {
      const injected = await options.loadBabylon();
      if (isBabylonNamespace(injected)) return injected;
      const error = new Error("The injected Babylon loader returned an invalid namespace.");
      error.code = "BABYLON_NAMESPACE_INVALID";
      throw error;
    }

    const documentRef = options.document || runtime.document;
    const urls = resolveBabylonUrls(options, documentRef);
    const failures = [];
    for (const url of urls) {
      try {
        const loaded = await loadScript(url, options, documentRef);
        if (isBabylonNamespace(loaded)) return loaded;
      } catch (error) {
        failures.push({ url, code: String(error && error.code || "LOAD_FAILED"), message: String(error && error.message || error).slice(0, 220) });
      }
    }
    const error = new Error(urls.length ? "All configured Babylon.js sources failed." : "No permitted Babylon.js source is configured.");
    error.code = "BABYLON_LOAD_FAILED";
    error.failures = failures;
    throw error;
  }

  function hasGltfLoader(B) {
    return Boolean(B && typeof B.GLTFFileLoader === "function" && B.SceneLoader && typeof B.SceneLoader.LoadAssetContainerAsync === "function");
  }

  function loadBabylonGltfLoader(B, options = {}, documentRef) {
    if (hasGltfLoader(B)) return Promise.resolve(B);
    const normalized = normalizeUrl(options.localGltfLoaderUrl || options.gltfLoaderUrl || DEFAULT_LOCAL_GLTF_LOADER_URL, documentRef);
    if (!normalized || !isSameOriginAssetUrl(normalized, documentRef)) {
      const error = new Error("The Babylon glTF loader must be served from the current origin.");
      error.code = "GLTF_LOADER_ORIGIN_DENIED";
      return Promise.reject(error);
    }
    if (gltfLoaderPromises.has(normalized)) return gltfLoaderPromises.get(normalized);
    const timeoutMs = clamp(options.assetLoadTimeoutMs || options.loadTimeoutMs || 12000, 1000, 30000);
    const promise = new Promise((resolve, reject) => {
      if (!documentRef || typeof documentRef.createElement !== "function") {
        const error = new Error("A DOM is required to load the Babylon glTF plugin.");
        error.code = "DOM_UNAVAILABLE";
        reject(error);
        return;
      }
      let settled = false;
      let owned = false;
      const scripts = documentRef.scripts ? Array.from(documentRef.scripts) : [];
      let script = scripts.find((candidate) => normalizeUrl(candidate.src, documentRef) === normalized && candidate.dataset?.hweGltfState !== "failed") || null;
      if (!script) {
        script = documentRef.createElement("script");
        owned = true;
        script.async = true;
        script.src = normalized;
        script.dataset.hweGltfLoader = VERSION;
        script.dataset.hweGltfState = "loading";
        script.referrerPolicy = "no-referrer";
        if (options.nonce) script.nonce = String(options.nonce);
      }
      const cleanup = () => {
        (runtime.clearTimeout || clearTimeout)(timer);
        if (script && typeof script.removeEventListener === "function") {
          script.removeEventListener("load", onLoad);
          script.removeEventListener("error", onError);
        }
      };
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback(value);
      };
      const fail = (code, message) => {
        if (script?.dataset) script.dataset.hweGltfState = "failed";
        if ((owned || script?.dataset?.hweGltfLoader) && typeof script?.remove === "function") script.remove();
        const error = new Error(message);
        error.code = code;
        finish(reject, error);
      };
      const onLoad = () => {
        if (!hasGltfLoader(B)) {
          fail("GLTF_LOADER_API_MISSING", "The glTF loader script did not register Babylon's .glb plugin.");
          return;
        }
        if (script?.dataset) script.dataset.hweGltfState = "ready";
        finish(resolve, B);
      };
      const onError = () => fail("GLTF_LOADER_SCRIPT_ERROR", "The same-origin Babylon glTF loader could not be loaded.");
      const timer = (runtime.setTimeout || setTimeout)(() => fail("GLTF_LOADER_TIMEOUT", `Timed out loading the Babylon glTF plugin after ${timeoutMs} ms.`), timeoutMs);
      if (typeof script.addEventListener === "function") {
        script.addEventListener("load", onLoad);
        script.addEventListener("error", onError);
      } else {
        script.onload = onLoad;
        script.onerror = onError;
      }
      if (hasGltfLoader(B)) finish(resolve, B);
      else if (owned) {
        const parent = documentRef.head || documentRef.body || documentRef.documentElement;
        if (!parent || typeof parent.appendChild !== "function") fail("SCRIPT_HOST_MISSING", "No document node can host the Babylon glTF loader.");
        else parent.appendChild(script);
      }
    }).catch((error) => {
      gltfLoaderPromises.delete(normalized);
      throw error;
    });
    gltfLoaderPromises.set(normalized, promise);
    return promise;
  }

  function withDeadline(task, timeoutMs, code, onLateSettle) {
    const duration = clamp(timeoutMs, 500, 30000);
    return new Promise((resolve, reject) => {
      let settled = false;
      let timedOut = false;
      const timer = (runtime.setTimeout || setTimeout)(() => {
        if (settled) return;
        settled = true;
        timedOut = true;
        const error = new Error(`3D initialization exceeded ${duration} ms.`);
        error.code = code || "RENDER_INIT_TIMEOUT";
        reject(error);
      }, duration);
      Promise.resolve(task).then((value) => {
        if (settled) {
          if (timedOut && typeof onLateSettle === "function") safeCall(onLateSettle);
          return;
        }
        settled = true;
        (runtime.clearTimeout || clearTimeout)(timer);
        resolve(value);
      }, (error) => {
        if (settled) {
          if (timedOut && typeof onLateSettle === "function") safeCall(onLateSettle);
          return;
        }
        settled = true;
        (runtime.clearTimeout || clearTimeout)(timer);
        reject(error);
      });
    });
  }

  function replaceCanvasAfterWebGPUFailure(canvas, options) {
    if (options.replaceCanvasOnFallback !== true || !canvas || typeof canvas.cloneNode !== "function") return null;
    const replacement = canvas.cloneNode(false);
    replacement.width = canvas.width;
    replacement.height = canvas.height;
    replacement.hidden = canvas.hidden;
    if (canvas.parentNode && typeof canvas.parentNode.replaceChild === "function") canvas.parentNode.replaceChild(replacement, canvas);
    safeCall(options.onCanvasReplaced, freezeRecord({ previous: canvas, canvas: replacement, reason: "webgpu-fallback" }));
    return replacement;
  }

  function startupCancelled(options) {
    try { return Boolean(options?.signal?.aborted || options?.isCancelled?.()); }
    catch { return true; }
  }

  function startupCancelledError(attempts = []) {
    const error = new Error("3D startup was cancelled.");
    error.code = "RENDER_START_CANCELLED";
    error.attempts = attempts;
    return error;
  }

  async function createBabylonEngine(B, initialCanvas, capabilities, options) {
    const attempts = [];
    let canvas = initialCanvas;
    if (startupCancelled(options)) throw startupCancelledError(attempts);
    const requested = ["auto", "webgpu", "webgl"].includes(options.backend) ? options.backend : "auto";
    const mayTryWebGPU = requested !== "webgl" && Boolean(B.WebGPUEngine) && (capabilities.webgpu || options.forceWebGPUProbe === true);
    if (mayTryWebGPU) {
      let webgpuEngine = null;
      let webgpuConstructionAttempted = false;
      try {
        if (typeof B.WebGPUEngine.IsSupportedAsync !== "undefined") {
          const supportProbe = B.WebGPUEngine.IsSupportedAsync;
          const supported = await withDeadline(typeof supportProbe === "function" ? supportProbe.call(B.WebGPUEngine) : supportProbe, options.webgpuProbeTimeoutMs || 4000, "WEBGPU_PROBE_TIMEOUT");
          if (!supported) throw Object.assign(new Error("Babylon reports that WebGPU is unavailable."), { code: "WEBGPU_UNSUPPORTED" });
          if (startupCancelled(options)) throw startupCancelledError(attempts);
        }
        const webgpuOptions = {
          antialias: options.antialias !== false,
          adaptToDeviceRatio: false,
          powerPreference: options.powerPreference || "high-performance",
          ...(options.webgpuOptions && typeof options.webgpuOptions === "object" ? options.webgpuOptions : {})
        };
        webgpuConstructionAttempted = true;
        webgpuEngine = new B.WebGPUEngine(canvas, webgpuOptions);
        if (typeof webgpuEngine.initAsync !== "function") throw new Error("This Babylon WebGPU engine has no async initializer.");
        const startupPreset = QUALITY_PRESETS[normalizePreset(options.qualityPreset || options.quality, "balanced")];
        if (typeof webgpuEngine.setHardwareScalingLevel === "function") {
          // Set the scale before initAsync creates the swap chain. Calling it
          // immediately after initialization can invalidate an in-flight D3D
          // shared texture in Chromium's WebGPU implementation.
          webgpuEngine.setHardwareScalingLevel(clamp(1 / startupPreset.renderScale, 1, 2.25));
        }
        await withDeadline(webgpuEngine.initAsync(options.webgpuDeviceDescriptor), options.engineTimeoutMs || options.timeoutMs || 10000, "WEBGPU_INIT_TIMEOUT", () => safeDispose(webgpuEngine));
        if (startupCancelled(options)) throw startupCancelledError(attempts);
        if (!webgpuEngine || typeof webgpuEngine.runRenderLoop !== "function") throw new Error("WebGPU returned an invalid engine.");
        attempts.push(freezeRecord({ backend: "webgpu", ok: true }));
        return { engine: webgpuEngine, backend: "webgpu", attempts, canvas };
      } catch (error) {
        const canvasMayBeBound = webgpuConstructionAttempted;
        safeDispose(webgpuEngine);
        attempts.push(freezeRecord({ backend: "webgpu", ok: false, error: compactError(error) }));
        if (options.allowWebGLFallback === false) {
          const failure = new Error("WebGPU initialization failed and WebGL fallback is disabled.");
          failure.code = "WEBGPU_INIT_FAILED";
          failure.attempts = attempts;
          throw failure;
        }
        if (canvasMayBeBound) {
          const replacement = replaceCanvasAfterWebGPUFailure(canvas, options);
          if (!replacement) {
            const failure = new Error("WebGPU bound the canvas and a clean WebGL fallback canvas is unavailable.");
            failure.code = "WEBGPU_CANVAS_REPLACEMENT_REQUIRED";
            failure.attempts = attempts;
            throw failure;
          }
          canvas = replacement;
        }
        if (startupCancelled(options)) throw startupCancelledError(attempts);
      }
    }

    if (requested === "webgpu" && options.allowWebGLFallback === false) {
      const error = new Error("WebGPU is unavailable and WebGL fallback is disabled.");
      error.code = "WEBGPU_UNAVAILABLE";
      error.attempts = attempts;
      throw error;
    }

    if (startupCancelled(options)) throw startupCancelledError(attempts);

    let webglEngine = null;
    try {
      const engineOptions = {
        preserveDrawingBuffer: false,
        stencil: true,
        disableWebGL2Support: false,
        powerPreference: options.powerPreference || "high-performance",
        premultipliedAlpha: false,
        ...(options.webglOptions && typeof options.webglOptions === "object" ? options.webglOptions : {})
      };
      webglEngine = new B.Engine(canvas, options.antialias !== false, engineOptions, false);
      if (!webglEngine || typeof webglEngine.runRenderLoop !== "function") throw new Error("WebGL returned an invalid engine.");
      attempts.push(freezeRecord({ backend: webglEngine.webGLVersion >= 2 ? "webgl2" : "webgl1", ok: true }));
      return { engine: webglEngine, backend: webglEngine.webGLVersion >= 2 ? "webgl2" : "webgl1", attempts, canvas };
    } catch (error) {
      safeDispose(webglEngine);
      attempts.push(freezeRecord({ backend: "webgl", ok: false, error: compactError(error) }));
      const failure = new Error("Neither WebGPU nor WebGL could initialize.");
      failure.code = "NO_RENDER_BACKEND";
      failure.attempts = attempts;
      throw failure;
    }
  }

  function makeColor3(B, rgb) {
    return new B.Color3(rgb[0], rgb[1], rgb[2]);
  }

  function setColorFloor(color, floor) {
    if (!color || !Array.isArray(floor)) return false;
    color.r = Math.max(finite(color.r), floor[0]);
    color.g = Math.max(finite(color.g), floor[1]);
    color.b = Math.max(finite(color.b), floor[2]);
    return true;
  }

  function setColorFromBaseline(color, baseline, floor) {
    if (!color || !Array.isArray(baseline) || !Array.isArray(floor)) return false;
    color.r = Math.max(finite(baseline[0]), floor[0]);
    color.g = Math.max(finite(baseline[1]), floor[1]);
    color.b = Math.max(finite(baseline[2]), floor[2]);
    return true;
  }

  function applyTerrainMaterialReadability(B, material, daylight = false) {
    if (!material) return material;
    material.disableLighting = false;
    material.maxSimultaneousLights = Math.max(4, Math.trunc(finite(material.maxSimultaneousLights, 4)));
    material.metadata = material.metadata && typeof material.metadata === "object" ? material.metadata : {};
    if (!Array.isArray(material.metadata.hhEonWildBaseEmissive)) {
      const original = material.emissiveColor;
      material.metadata.hhEonWildBaseEmissive = [finite(original?.r), finite(original?.g), finite(original?.b)];
    }
    const baseEmissive = material.metadata.hhEonWildBaseEmissive;
    if ("albedoColor" in material) {
      const floor = daylight ? READABILITY_FLOORS.terrainPbrEmissive : READABILITY_FLOORS.terrainNightPbrEmissive;
      if (!material.emissiveColor && typeof B?.Color3 === "function") material.emissiveColor = makeColor3(B, floor);
      else setColorFromBaseline(material.emissiveColor, baseEmissive, floor);
      if ("environmentIntensity" in material) material.environmentIntensity = Math.max(READABILITY_FLOORS.terrainEnvironmentIntensity, finite(material.environmentIntensity));
      if ("directIntensity" in material) material.directIntensity = Math.max(1, finite(material.directIntensity));
    } else {
      const floor = daylight ? READABILITY_FLOORS.terrainStandardEmissive : READABILITY_FLOORS.terrainNightStandardEmissive;
      if (!material.emissiveColor && typeof B?.Color3 === "function") material.emissiveColor = makeColor3(B, floor);
      else setColorFromBaseline(material.emissiveColor, baseEmissive, floor);
      if (!material.ambientColor && typeof B?.Color3 === "function") material.ambientColor = makeColor3(B, READABILITY_FLOORS.sceneAmbient);
      else setColorFloor(material.ambientColor, READABILITY_FLOORS.sceneAmbient);
    }
    material.metadata.hhEonWildReadabilityFloor = daylight ? "daylight" : "night-weather";
    return material;
  }

  function enforceClearDaylightReadability(B, scene, lights, material, context = {}) {
    const daylight = clamp(context.daylight, 0, 1);
    const weather = String(context.weather || "clear").toLowerCase();
    const clearEnough = weather === "clear" || weather === "mist";
    applyTerrainMaterialReadability(B, material, clearEnough && daylight >= READABILITY_FLOORS.daylightThreshold);
    if (!clearEnough || daylight < READABILITY_FLOORS.daylightThreshold) return { applied: false, daylight, weather };
    if (scene?.ambientColor) setColorFloor(scene.ambientColor, READABILITY_FLOORS.sceneAmbient);
    if (lights?.ambient) {
      lights.ambient.intensity = Math.max(READABILITY_FLOORS.ambientIntensity, finite(lights.ambient.intensity));
      if (lights.ambient.groundColor) setColorFloor(lights.ambient.groundColor, READABILITY_FLOORS.hemisphereGround);
    }
    if (lights?.sun) lights.sun.intensity = Math.max(READABILITY_FLOORS.sunIntensity, finite(lights.sun.intensity));
    if (context.allowExposureFloor !== false && scene?.imageProcessingConfiguration) {
      scene.imageProcessingConfiguration.exposure = Math.max(READABILITY_FLOORS.exposure, finite(scene.imageProcessingConfiguration.exposure));
    }
    return {
      applied: true,
      daylight,
      weather,
      ambientIntensity: finite(lights?.ambient?.intensity),
      sunIntensity: finite(lights?.sun?.intensity),
      exposure: finite(scene?.imageProcessingConfiguration?.exposure)
    };
  }

  function applyCreatureMaterialReadability(B, material, emissiveFactor = 0.08) {
    if (!material) return material;
    material.disableLighting = false;
    if ("maxSimultaneousLights" in material) material.maxSimultaneousLights = Math.max(4, Math.trunc(finite(material.maxSimultaneousLights, 4)));
    if ("environmentIntensity" in material) material.environmentIntensity = Math.max(1.05, finite(material.environmentIntensity));
    if ("directIntensity" in material) material.directIntensity = Math.max(1.05, finite(material.directIntensity));
    const source = material.albedoColor || material.diffuseColor || null;
    if (source && typeof B?.Color3 === "function") {
      const floor = [
        Math.max(0.018, finite(source.r) * emissiveFactor),
        Math.max(0.02, finite(source.g) * emissiveFactor),
        Math.max(0.016, finite(source.b) * emissiveFactor)
      ];
      if (!material.emissiveColor) material.emissiveColor = makeColor3(B, floor);
      else setColorFloor(material.emissiveColor, floor);
      if (material.ambientColor) setColorFloor(material.ambientColor, floor.map((channel) => channel * 2.2));
    }
    material.metadata = material.metadata && typeof material.metadata === "object" ? material.metadata : {};
    material.metadata.hhEonWildCreatureReadability = true;
    return material;
  }

  function createTerrainMaterial(B, scene, options = {}) {
    const descriptors = Array.isArray(options.cinematicTerrainAssets) ? options.cinematicTerrainAssets : [];
    // Babylon PBR without an environment texture is technically valid but
    // renders the repository-only terrain far too dark on several WebGPU
    // backends. Keep PBR for verified terrain/IBL inputs and use the lit
    // StandardMaterial fallback when every Cinematic Pack has been removed.
    const hasVerifiedPbrInput = descriptors.length > 0 || Boolean(scene?.environmentTexture);
    const material = hasVerifiedPbrInput && typeof B.PBRMaterial === "function"
      ? new B.PBRMaterial("hwe3d-terrain-pbr-material", scene)
      : new B.StandardMaterial("hwe3d-terrain-material", scene);
    const documentRef = options.document || runtime.document;
    const textureByChannel = new Map();
    for (const descriptor of descriptors) {
      const channel = String(descriptor?.channel || "").toLowerCase();
      if (!["albedo", "normal", "roughness", "ao"].includes(channel) || textureByChannel.has(channel)) continue;
      const texture = createRuntimeTexture(B, scene, descriptor, documentRef, { uScale: 14, vScale: 14, anisotropy: 12 });
      if (texture) textureByChannel.set(channel, texture);
    }
    if ("albedoColor" in material) {
      material.albedoColor = new B.Color3(1, 1, 1);
      material.metallic = 0;
      material.roughness = 0.96;
      material.environmentIntensity = 0.62;
      if (textureByChannel.has("albedo")) material.albedoTexture = textureByChannel.get("albedo");
      if (textureByChannel.has("normal")) material.bumpTexture = textureByChannel.get("normal");
      if (textureByChannel.has("ao")) material.ambientTexture = textureByChannel.get("ao");
      if (textureByChannel.has("roughness")) {
        material.metallicTexture = textureByChannel.get("roughness");
        material.useRoughnessFromMetallicTextureAlpha = false;
        material.useRoughnessFromMetallicTextureGreen = true;
        material.useMetallnessFromMetallicTextureBlue = false;
      }
    } else {
      material.diffuseColor = new B.Color3(1, 1, 1);
      material.ambientColor = new B.Color3(0.3, 0.34, 0.28);
      // Repository-only fallback has no guaranteed IBL. Keep physical direct
      // light and a small colour-preserving floor so WebGPU cannot turn whole
      // shaded valleys black before the optional HDR environment is ready.
      material.emissiveColor = new B.Color3(0.24, 0.24, 0.24);
      material.specularColor = new B.Color3(0.025, 0.03, 0.025);
      material.roughness = 1;
      if (textureByChannel.has("albedo")) material.diffuseTexture = textureByChannel.get("albedo");
      if (textureByChannel.has("normal")) material.bumpTexture = textureByChannel.get("normal");
      if (textureByChannel.has("ao")) material.ambientTexture = textureByChannel.get("ao");
    }
    material.backFaceCulling = false;
    applyTerrainMaterialReadability(B, material, false);
    // Terrain wetness, atmosphere and a late verified HDR environment all
    // change after the first frame. Freezing here captured the pre-HDR light
    // state on WebGPU and could leave an otherwise valid landscape near-black.
    return { material, textures: [...textureByChannel.values()] };
  }

  function appendSkirt(positions, colors, indices, edge, depth, color) {
    const start = positions.length / 3;
    for (const point of edge) {
      positions.push(point[0], point[1], point[2], point[0], point[1] - depth, point[2]);
      colors.push(color[0], color[1], color[2], 1, color[0] * 0.55, color[1] * 0.55, color[2] * 0.55, 1);
    }
    for (let index = 0; index < edge.length - 1; index += 1) {
      const topLeft = start + index * 2;
      const bottomLeft = topLeft + 1;
      const topRight = topLeft + 2;
      const bottomRight = topLeft + 3;
      indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
    }
  }

  function buildTerrainChunk(B, scene, material, chunkX, chunkZ, segments, seed, landscape = null) {
    const boundedSegments = Math.round(clamp(segments, 4, 48));
    const positions = [];
    const indices = [];
    const normals = [];
    const colors = [];
    const originX = chunkX * CHUNK_SIZE;
    const originZ = chunkZ * CHUNK_SIZE;
    const step = CHUNK_SIZE / boundedSegments;
    for (let zIndex = 0; zIndex <= boundedSegments; zIndex += 1) {
      for (let xIndex = 0; xIndex <= boundedSegments; xIndex += 1) {
        const worldX = originX + xIndex * step;
        const worldZ = originZ + zIndex * step;
        const sample = terrainSampleFromProvider(landscape, worldX, worldZ, seed);
        positions.push(xIndex * step - CHUNK_SIZE / 2, sample.height, zIndex * step - CHUNK_SIZE / 2);
        colors.push(sample.color[0], sample.color[1], sample.color[2], 1);
      }
    }
    const row = boundedSegments + 1;
    for (let zIndex = 0; zIndex < boundedSegments; zIndex += 1) {
      for (let xIndex = 0; xIndex < boundedSegments; xIndex += 1) {
        const topLeft = zIndex * row + xIndex;
        const bottomLeft = (zIndex + 1) * row + xIndex;
        indices.push(topLeft, bottomLeft, topLeft + 1, topLeft + 1, bottomLeft, bottomLeft + 1);
      }
    }

    const edgeColor = TERRAIN_COLORS.rock;
    const pointAt = (xIndex, zIndex) => {
      const offset = (zIndex * row + xIndex) * 3;
      return [positions[offset], positions[offset + 1], positions[offset + 2]];
    };
    const north = [];
    const south = [];
    const west = [];
    const east = [];
    for (let index = 0; index <= boundedSegments; index += 1) {
      north.push(pointAt(index, 0));
      south.push(pointAt(index, boundedSegments));
      west.push(pointAt(0, index));
      east.push(pointAt(boundedSegments, index));
    }
    appendSkirt(positions, colors, indices, north, 10, edgeColor);
    appendSkirt(positions, colors, indices, south, 10, edgeColor);
    appendSkirt(positions, colors, indices, west, 10, edgeColor);
    appendSkirt(positions, colors, indices, east, 10, edgeColor);

    const uvs = [];
    for (let index = 0; index < positions.length; index += 3) {
      uvs.push((originX + positions[index] + CHUNK_SIZE / 2) / CHUNK_SIZE, (originZ + positions[index + 2] + CHUNK_SIZE / 2) / CHUNK_SIZE);
    }
    B.VertexData.ComputeNormals(positions, indices, normals);
    const mesh = new B.Mesh(`hwe3d-terrain-${chunkX}-${chunkZ}`, scene);
    const vertexData = new B.VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;
    vertexData.uvs = uvs;
    vertexData.applyToMesh(mesh, false);
    mesh.position.x = originX + CHUNK_SIZE / 2 - WORLD_HALF;
    mesh.position.z = originZ + CHUNK_SIZE / 2 - WORLD_HALF;
    mesh.material = material;
    mesh.useVertexColors = true;
    // Pointer-move picking remains disabled at scene level. Keeping bounded
    // terrain chunks ray-pickable gives the gameplay camera a terrain-safe
    // obstruction query without enabling Babylon's pointer input ownership.
    mesh.isPickable = true;
    mesh.checkCollisions = false;
    mesh.metadata = { eonwild: true, kind: "terrain-chunk", cameraObstruction: true, chunkX, chunkZ, segments: boundedSegments };
    if (typeof mesh.freezeWorldMatrix === "function") mesh.freezeWorldMatrix();
    return mesh;
  }

  function buildTerrainChunkFromGeometry(B, scene, material, descriptor, payload, landscape, seed) {
    const geometry = payload?.geometry || payload?.result || payload;
    if (!geometry || !geometry.positions || !geometry.indices) throw new Error("Landscape worker returned incomplete geometry");
    const chunkX = Math.trunc(descriptor.chunkX);
    const chunkZ = Math.trunc(descriptor.chunkZ);
    const originX = chunkX * CHUNK_SIZE;
    const originZ = chunkZ * CHUNK_SIZE;
    let positions = geometry.positions;
    if (geometry.coordinateSpace === "world") {
      const local = new Float32Array(positions.length);
      for (let index = 0; index < positions.length; index += 3) {
        local[index] = positions[index] - originX - CHUNK_SIZE / 2;
        local[index + 1] = positions[index + 1];
        local[index + 2] = positions[index + 2] - originZ - CHUNK_SIZE / 2;
      }
      positions = local;
    } else if (geometry.origin && !["chunk-centered", "centered-chunk"].includes(geometry.coordinateSpace)) {
      const centered = new Float32Array(positions.length);
      for (let index = 0; index < positions.length; index += 3) {
        centered[index] = positions[index] - CHUNK_SIZE / 2;
        centered[index + 1] = positions[index + 1];
        centered[index + 2] = positions[index + 2] - CHUNK_SIZE / 2;
      }
      positions = centered;
    }
    let indices = geometry.indices;
    let normals = geometry.normals?.length === positions.length ? geometry.normals : [];
    const vertexCount = Math.floor(positions.length / 3);
    let colors = geometry.colors;
    if (!colors || colors.length !== vertexCount * 4) {
      colors = new Float32Array(vertexCount * 4);
      const biomeIds = Array.isArray(geometry.biomeIds) ? geometry.biomeIds : [];
      const biomeWeights = geometry.biomeWeights;
      const hasWorkerWeights = biomeWeights && biomeIds.length && biomeWeights.length === vertexCount * biomeIds.length;
      for (let index = 0; index < vertexCount; index += 1) {
        let color;
        if (hasWorkerWeights) {
          const mixed = [0, 0, 0];
          let total = 0;
          for (let biomeIndex = 0; biomeIndex < biomeIds.length; biomeIndex += 1) {
            const weight = clamp(biomeWeights[index * biomeIds.length + biomeIndex], 0, 1);
            const base = LANDSCAPE_BIOME_COLORS[biomeIds[biomeIndex]] || TERRAIN_COLORS.fern;
            mixed[0] += base[0] * weight; mixed[1] += base[1] * weight; mixed[2] += base[2] * weight; total += weight;
          }
          const macro = 0.9 + hash2D(Math.floor(originX + positions[index * 3]), Math.floor(originZ + positions[index * 3 + 2]), seed ^ 0x6d2b79f5) * 0.16;
          color = total > 0 ? mixed.map((channel) => clamp(channel / total * macro, 0.035, 0.92)) : TERRAIN_COLORS.fern;
        } else {
          const px = positions[index * 3] + originX + CHUNK_SIZE / 2;
          const pz = positions[index * 3 + 2] + originZ + CHUNK_SIZE / 2;
          color = terrainSampleFromProvider(landscape, px, pz, seed).color;
        }
        colors[index * 4] = color[0]; colors[index * 4 + 1] = color[1]; colors[index * 4 + 2] = color[2]; colors[index * 4 + 3] = 1;
      }
    }
    const resolution = Math.trunc(geometry.resolution || Math.sqrt(vertexCount));
    if (geometry.includesSkirts !== true && resolution >= 2 && resolution * resolution === vertexCount) {
      positions = Array.from(positions);
      indices = Array.from(indices);
      colors = Array.from(colors);
      const pointAt = (xIndex, zIndex) => {
        const offset = (zIndex * resolution + xIndex) * 3;
        return [positions[offset], positions[offset + 1], positions[offset + 2]];
      };
      const north = []; const south = []; const west = []; const east = [];
      for (let index = 0; index < resolution; index += 1) {
        north.push(pointAt(index, 0)); south.push(pointAt(index, resolution - 1));
        west.push(pointAt(0, index)); east.push(pointAt(resolution - 1, index));
      }
      appendSkirt(positions, colors, indices, north, 12, TERRAIN_COLORS.rock);
      appendSkirt(positions, colors, indices, south, 12, TERRAIN_COLORS.rock);
      appendSkirt(positions, colors, indices, west, 12, TERRAIN_COLORS.rock);
      appendSkirt(positions, colors, indices, east, 12, TERRAIN_COLORS.rock);
      normals = [];
    }
    if (!normals.length) B.VertexData.ComputeNormals(positions, indices, normals);
    const uvs = new Float32Array(Math.floor(positions.length / 3) * 2);
    for (let index = 0; index < positions.length / 3; index += 1) {
      uvs[index * 2] = (originX + positions[index * 3] + CHUNK_SIZE / 2) / CHUNK_SIZE;
      uvs[index * 2 + 1] = (originZ + positions[index * 3 + 2] + CHUNK_SIZE / 2) / CHUNK_SIZE;
    }
    const mesh = new B.Mesh(`hwe3d-terrain-${chunkX}-${chunkZ}`, scene);
    const vertexData = new B.VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;
    vertexData.uvs = uvs;
    vertexData.applyToMesh(mesh, false);
    mesh.position.x = originX + CHUNK_SIZE / 2 - WORLD_HALF;
    mesh.position.z = originZ + CHUNK_SIZE / 2 - WORLD_HALF;
    mesh.material = material;
    mesh.useVertexColors = true;
    mesh.isPickable = true;
    mesh.checkCollisions = false;
    mesh.metadata = { eonwild: true, kind: "terrain-chunk", cameraObstruction: true, chunkX, chunkZ, segments: descriptor.segments, workerBuilt: true, biomeSummary: geometry.biomeSummary || null };
    if (typeof mesh.freezeWorldMatrix === "function") mesh.freezeWorldMatrix();
    return mesh;
  }

  class LandscapeWorkerBridge {
    constructor(options = {}) {
      this.runtime = options.runtime || runtime;
      this.url = String(options.url || DEFAULT_LANDSCAPE_WORKER_URL);
      this.onFailure = typeof options.onFailure === "function" ? options.onFailure : null;
      this.worker = null;
      this.pending = new Map();
      this.sequence = 0;
      this.disposed = false;
      this.disabled = options.enabled === false;
      this.failures = [];
    }

    _safeUrl() {
      try {
        const base = new URL(this.runtime.document?.baseURI || this.runtime.location?.href);
        const parsed = new URL(this.url, base);
        if (parsed.origin !== base.origin || parsed.username || parsed.password || !["http:", "https:", "file:"].includes(parsed.protocol)) return "";
        return parsed.href;
      } catch { return ""; }
    }

    _ensureWorker() {
      if (this.worker || this.disabled || this.disposed || typeof this.runtime.Worker !== "function") return this.worker;
      const url = this._safeUrl();
      if (!url) { this.disabled = true; return null; }
      try {
        const worker = new this.runtime.Worker(url, { name: "hh-eonwild-landscape" });
        worker.onmessage = (event) => this._handleMessage(event);
        worker.onerror = (event) => this._fail(new Error(String(event?.message || "Landscape worker crashed")));
        this.worker = worker;
      } catch (error) { this._fail(error); }
      return this.worker;
    }

    _handleMessage(event) {
      const message = event?.data && typeof event.data === "object" ? event.data : {};
      const entry = this.pending.get(String(message.id || ""));
      if (!entry) return;
      this.pending.delete(entry.id);
      this.runtime.clearTimeout?.(entry.timeout);
      try { entry.callback(message.ok === true ? null : new Error(message.error?.message || "Landscape worker rejected a job"), message.result); }
      catch { /* A stale chunk callback must not break worker delivery. */ }
    }

    _fail(error) {
      const failure = compactError(error);
      this.failures.push(failure);
      if (this.failures.length > 8) this.failures.shift();
      const queued = Array.from(this.pending.values());
      this.pending.clear();
      try { this.worker?.terminate?.(); } catch { /* Worker may already be gone. */ }
      this.worker = null;
      this.disabled = true;
      for (const entry of queued) {
        this.runtime.clearTimeout?.(entry.timeout);
        try { entry.callback(error || new Error(failure.message)); } catch { /* Fallback is handled by the streamer. */ }
      }
      safeCall(this.onFailure, failure);
    }

    submit(job, callback) {
      const worker = this._ensureWorker();
      if (!worker || !job || typeof callback !== "function") return false;
      const id = `land-${++this.sequence}`;
      const timeout = this.runtime.setTimeout?.(() => this._fail(new Error("Landscape worker job timed out")), 12000);
      this.pending.set(id, { id, callback, timeout });
      try { worker.postMessage({ id, job }); }
      catch (error) { this.pending.delete(id); this.runtime.clearTimeout?.(timeout); this._fail(error); return false; }
      return true;
    }

    pause() {
      if (!this.worker) return;
      const callbacks = Array.from(this.pending.values());
      this.pending.clear();
      try { this.worker.terminate(); } catch { /* Visibility pause remains best effort. */ }
      this.worker = null;
      for (const entry of callbacks) {
        this.runtime.clearTimeout?.(entry.timeout);
        try { entry.callback(new Error("Landscape worker paused")); } catch { /* Queue will be rebuilt on resume. */ }
      }
    }

    resume() { if (!this.disposed && !this.disabled) this._ensureWorker(); }
    getStatus() { return freezeRecord({ active: Boolean(this.worker), pending: this.pending.size, disabled: this.disabled, failures: this.failures.slice() }); }
    dispose() { this.disposed = true; this.pause(); }
  }

  class TerrainStreamer {
    constructor(B, scene, options) {
      this.B = B;
      this.scene = scene;
      this.seed = hashSeed(options.seed);
      this.landscape = options.landscapeCore || null;
      this.worker = this.landscape && typeof this.landscape.createWorkerJob === "function"
        ? new LandscapeWorkerBridge({
          runtime,
          url: options.landscapeWorkerUrl || DEFAULT_LANDSCAPE_WORKER_URL,
          enabled: options.worker !== false,
          onFailure: (failure) => safeCall(options.onTelemetry, { type: "landscape-worker-failed", failure })
        })
        : null;
      this.inFlight = new Map();
      this.completed = [];
      this.reducedMotion = options.reducedMotion === true;
      this.lodController = LANDSCAPE_CORE && typeof LANDSCAPE_CORE.TerrainLODController === "function"
        ? new LANDSCAPE_CORE.TerrainLODController({ thresholds: [CHUNK_SIZE * 1.35, CHUNK_SIZE * 2.85, CHUNK_SIZE * 5.2], hysteresis: 0.16, transitionMs: 360, maxEntries: MAX_ACTIVE_CHUNKS * 2 })
        : null;
      this.fades = [];
      const terrainMaterial = createTerrainMaterial(B, scene, options);
      this.material = terrainMaterial.material;
      this.textures = terrainMaterial.textures;
      this.active = new Map();
      this.wanted = new Map();
      this.queue = [];
      this.queued = new Set();
      this.preset = QUALITY_PRESETS[normalizePreset(options.qualityPreset)];
      this.centerChunkX = -1;
      this.centerChunkZ = -1;
      this.dirty = true;
      this.disposed = false;
    }

    configure(preset) {
      if (!preset || this.preset.id === preset.id) return;
      this.preset = preset;
      this.dirty = true;
    }

    segmentsForDistance(distance, key) {
      const base = this.preset.terrainSegments;
      if (this.lodController) {
        try {
          const state = this.lodController.update(key, distance * CHUNK_SIZE, now());
          if (state.lod === 0) return base;
          if (state.lod === 1) return Math.max(8, Math.round(base / 2));
          if (state.lod === 2) return Math.max(4, Math.round(base / 4));
          return 4;
        } catch { /* Fall through to the renderer's stable legacy thresholds. */ }
      }
      if (distance <= 1) return base;
      if (distance <= 2.25) return Math.max(8, Math.round(base / 2));
      return Math.max(4, Math.round(base / 4));
    }

    update(worldX, worldZ, force = false) {
      if (this.disposed) return;
      const centerX = clamp(Math.floor(clamp(worldX, 0, WORLD_SIZE - 0.001) / CHUNK_SIZE), 0, CHUNKS_PER_AXIS - 1);
      const centerZ = clamp(Math.floor(clamp(worldZ, 0, WORLD_SIZE - 0.001) / CHUNK_SIZE), 0, CHUNKS_PER_AXIS - 1);
      if (!force && !this.dirty && centerX === this.centerChunkX && centerZ === this.centerChunkZ) return;
      this.centerChunkX = centerX;
      this.centerChunkZ = centerZ;
      this.dirty = false;

      const candidates = [];
      const radius = this.preset.streamRadius;
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const chunkX = centerX + dx;
          const chunkZ = centerZ + dz;
          if (chunkX < 0 || chunkZ < 0 || chunkX >= CHUNKS_PER_AXIS || chunkZ >= CHUNKS_PER_AXIS) continue;
          const distance = Math.hypot(dx, dz);
          if (distance > radius + 0.34) continue;
          candidates.push({ chunkX, chunkZ, distance, key: `${chunkX}:${chunkZ}` });
        }
      }
      candidates.sort((left, right) => left.distance - right.distance || left.chunkZ - right.chunkZ || left.chunkX - right.chunkX);
      const desired = candidates.slice(0, Math.min(this.preset.maxChunks, MAX_ACTIVE_CHUNKS));
      this.wanted.clear();
      for (const item of desired) this.wanted.set(item.key, { ...item, segments: this.segmentsForDistance(item.distance, item.key) });

      for (const [key, entry] of this.active) {
        if (this.wanted.has(key)) continue;
        safeDispose(entry.mesh);
        this.active.delete(key);
        this.lodController?.forget?.(key);
      }

      this.queue.length = 0;
      this.queued.clear();
      for (const item of desired) {
        const wanted = this.wanted.get(item.key);
        const current = this.active.get(item.key);
        if (current && current.segments === wanted.segments) continue;
        this.queue.push(wanted);
        this.queued.add(item.key);
        if (this.queue.length >= MAX_PENDING_CHUNKS) break;
      }
    }

    process(buildLimit) {
      if (this.disposed) return 0;
      this._processFades();
      const limit = Math.round(clamp(buildLimit || this.preset.chunkBuildsPerFrame, 1, 4));
      let built = 0;
      while (built < limit && this.completed.length) {
        const completed = this.completed.shift();
        const wanted = this.wanted.get(completed.item.key);
        if (!wanted || wanted.segments !== completed.item.segments || completed.error) {
          if (wanted && !this.queued.has(wanted.key)) {
            this.queue.unshift(wanted);
            this.queued.add(wanted.key);
          }
          continue;
        }
        try {
          const mesh = buildTerrainChunkFromGeometry(this.B, this.scene, this.material, completed.item, completed.result, this.landscape, this.seed);
          this._installMesh(completed.item.key, mesh, completed.item.segments);
          built += 1;
        } catch {
          this.active.delete(completed.item.key);
          if (!this.queued.has(completed.item.key)) { this.queue.unshift(completed.item); this.queued.add(completed.item.key); }
        }
      }
      while (built < limit && this.queue.length) {
        const item = this.queue.shift();
        const wanted = this.wanted.get(item.key);
        if (!wanted || wanted.segments !== item.segments) { this.queued.delete(item.key); continue; }
        const current = this.active.get(item.key);
        if (current && current.segments === item.segments) { this.queued.delete(item.key); continue; }
        if (this.inFlight.has(item.key)) { this.queued.add(item.key); continue; }
        if (this.worker && this.active.size > 0 && !this.worker.disabled) {
          if (this.inFlight.size >= 2) { this.queue.unshift(item); break; }
          let job = null;
          try {
            const lod = item.segments >= this.preset.terrainSegments * 0.75 ? 0 : item.segments >= this.preset.terrainSegments * 0.35 ? 1 : 2;
            job = this.landscape.createWorkerJob({ chunkX: item.chunkX, chunkZ: item.chunkZ, lod, resolution: item.segments + 1, includeNormals: true, includeBiomeWeights: true, priority: Math.round(100 - item.distance * 10) });
          }
          catch { job = null; }
          if (job) {
            const accepted = this.worker.submit(job, (error, result) => {
              this.inFlight.delete(item.key);
              this.queued.delete(item.key);
              if (this.disposed) return;
              this.completed.push({ item, error, result });
            });
            if (accepted) { this.inFlight.set(item.key, item); continue; }
          }
        }
        this.queued.delete(item.key);
        try {
          const initialSegments = this.active.size === 0 ? Math.min(item.segments, 24) : item.segments;
          const mesh = buildTerrainChunk(this.B, this.scene, this.material, item.chunkX, item.chunkZ, initialSegments, this.seed, this.landscape);
          this._installMesh(item.key, mesh, initialSegments);
          if (initialSegments !== item.segments) { this.queue.unshift(item); this.queued.add(item.key); }
          built += 1;
        } catch {
          this.active.delete(item.key);
        }
      }
      return built;
    }

    _installMesh(key, mesh, segments) {
      const current = this.active.get(key);
      if (current?.mesh && !this.reducedMotion && "visibility" in mesh && "visibility" in current.mesh) {
        mesh.visibility = 0;
        mesh.metadata = { ...(mesh.metadata || {}), lodTransition: "dither-fade" };
        this.fades.push({ key, previous: current.mesh, next: mesh, startedAt: now(), duration: 360 });
      } else if (current?.mesh) safeDispose(current.mesh);
      this.active.set(key, { mesh, segments });
    }

    _processFades() {
      if (!this.fades.length) return;
      const timestamp = now();
      for (let index = this.fades.length - 1; index >= 0; index -= 1) {
        const fade = this.fades[index];
        const progress = clamp((timestamp - fade.startedAt) / fade.duration, 0, 1);
        try { fade.next.visibility = progress; fade.previous.visibility = 1 - progress; }
        catch { /* A context transition may already have disposed one mesh. */ }
        if (progress >= 1) { safeDispose(fade.previous); this.fades.splice(index, 1); }
      }
    }

    getStats() {
      return freezeRecord({ activeChunks: this.active.size, queuedChunks: this.queue.length + this.inFlight.size + this.completed.length, maxChunks: this.preset.maxChunks, chunkSize: CHUNK_SIZE, worker: this.worker?.getStatus?.() || freezeRecord({ active: false, pending: 0, disabled: true, failures: [] }) });
    }

    pause() { this.worker?.pause?.(); }
    resume() { if (!this.disposed) { this.worker?.resume?.(); this.dirty = true; } }

    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      this.queue.length = 0;
      this.completed.length = 0;
      this.inFlight.clear();
      for (const fade of this.fades) { safeDispose(fade.previous); if (!this.active.get(fade.key)?.mesh || this.active.get(fade.key).mesh !== fade.next) safeDispose(fade.next); }
      this.fades.length = 0;
      this.queued.clear();
      this.wanted.clear();
      for (const entry of this.active.values()) safeDispose(entry.mesh);
      this.active.clear();
      safeDispose(this.material);
      for (const texture of this.textures) safeDispose(texture);
      this.textures.length = 0;
      this.worker?.dispose?.();
      this.worker = null;
      this.lodController?.dispose?.();
      this.lodController = null;
    }
  }

  function environmentPlacementAllowed(definition, sample, slope) {
    if (!definition || !sample || sample.height <= WATER_LEVEL + 0.75 || slope > (definition.id === "rock" ? 10 : 5.5)) return false;
    if (["ocean", "reef", "waterbed", "river"].includes(sample.biome)) return false;
    if (definition.id === "fern") return sample.moisture >= 0.34 && !["badland", "rock", "desert", "volcanic"].includes(sample.biome);
    if (definition.id === "quiver") return sample.moisture < 0.62 && ["upland", "badland", "fern", "grassland", "desert", "scrub"].includes(sample.biome);
    return true;
  }

  function planEnvironmentPlacements(worldX, worldZ, options = {}) {
    const presetId = normalizePreset(options.qualityPreset || options.quality, "balanced");
    const budget = ENVIRONMENT_BUDGETS[presetId];
    const seed = typeof options.seed === "number" ? options.seed >>> 0 : hashSeed(options.seed || "eonwild-mesozoic");
    const terrainProvider = typeof options.terrainSampler === "function"
      ? { sample: options.terrainSampler }
      : options.landscape || options.landscapeCore || null;
    const sampleTerrain = (x, z) => terrainSampleFromProvider(terrainProvider, x, z, seed);
    const centerChunkX = clamp(Math.floor(clamp(worldX, 0, WORLD_SIZE - 0.001) / CHUNK_SIZE), 0, CHUNKS_PER_AXIS - 1);
    const centerChunkZ = clamp(Math.floor(clamp(worldZ, 0, WORLD_SIZE - 0.001) / CHUNK_SIZE), 0, CHUNKS_PER_AXIS - 1);
    const placements = [];
    for (const definition of ENVIRONMENT_ASSETS) {
      const limit = Math.round(clamp(budget[definition.id] || 0, 0, 32));
      if (!limit) continue;
      const candidates = [];
      // A stable 52 m micro-grid guarantees camera-scale foreground detail
      // without attaching props to the player. Returning to the same area
      // therefore produces the same plants and rocks from the world seed.
      const fineCellSize = 52;
      const fineCenterX = Math.floor(worldX / fineCellSize);
      const fineCenterZ = Math.floor(worldZ / fineCellSize);
      for (let fineDz = -2; fineDz <= 2; fineDz += 1) {
        for (let fineDx = -2; fineDx <= 2; fineDx += 1) {
          const cellX = fineCenterX + fineDx;
          const cellZ = fineCenterZ + fineDz;
          const cellSeed = seed ^ definition.salt ^ Math.imul(cellX + 257, 0x9e3779b1) ^ Math.imul(cellZ + 263, 0x85ebca6b);
          const x = cellX * fineCellSize + 7 + hash2D(cellX, cellZ, cellSeed) * (fineCellSize - 14);
          const z = cellZ * fineCellSize + 7 + hash2D(cellX + 17, cellZ - 19, cellSeed ^ 0x27d4eb2f) * (fineCellSize - 14);
          if (x < 4 || z < 4 || x > WORLD_SIZE - 4 || z > WORLD_SIZE - 4) continue;
          const sample = sampleTerrain(x, z);
          const slope = Math.max(
            Math.abs(sample.height - sampleTerrain(x + 3, z).height),
            Math.abs(sample.height - sampleTerrain(x, z + 3).height)
          );
          const distance = Math.hypot(x - worldX, z - worldZ);
          if (distance < 16 || !environmentPlacementAllowed(definition, sample, slope)) continue;
          const randomScale = 0.88 + hash2D(cellX - 23, cellZ + 29, cellSeed ^ 0x165667b1) * 0.28;
          candidates.push({
            id: `${definition.id}:fine:${cellX}:${cellZ}`,
            assetId: definition.id,
            x,
            y: sample.height,
            z,
            rotationY: hash2D(cellX + 31, cellZ - 37, cellSeed ^ 0xd3a2646c) * Math.PI * 2,
            scale: definition.scale * randomScale,
            phase: hash2D(cellX - 41, cellZ + 43, cellSeed ^ 0xfd7046c5) * Math.PI * 2,
            distance
          });
        }
      }
      for (let dz = -budget.placementRadius; dz <= budget.placementRadius; dz += 1) {
        for (let dx = -budget.placementRadius; dx <= budget.placementRadius; dx += 1) {
          const chunkX = centerChunkX + dx;
          const chunkZ = centerChunkZ + dz;
          if (chunkX < 0 || chunkZ < 0 || chunkX >= CHUNKS_PER_AXIS || chunkZ >= CHUNKS_PER_AXIS) continue;
          for (let slot = 0; slot < 24; slot += 1) {
            const slotSeed = seed ^ definition.salt ^ Math.imul(slot + 1, 0x9e3779b1);
            const offsetX = 12 + hash2D(chunkX * 17 + slot, chunkZ * 31 - slot, slotSeed) * (CHUNK_SIZE - 24);
            const offsetZ = 12 + hash2D(chunkX * 29 - slot, chunkZ * 19 + slot, slotSeed ^ 0x85ebca6b) * (CHUNK_SIZE - 24);
            const x = chunkX * CHUNK_SIZE + offsetX;
            const z = chunkZ * CHUNK_SIZE + offsetZ;
            const sample = sampleTerrain(x, z);
            const slope = Math.max(
              Math.abs(sample.height - sampleTerrain(x + 3, z).height),
              Math.abs(sample.height - sampleTerrain(x, z + 3).height)
            );
            if (!environmentPlacementAllowed(definition, sample, slope)) continue;
            const distance = Math.hypot(x - worldX, z - worldZ);
            if (distance < 16) continue;
            const randomScale = 0.88 + hash2D(chunkX + slot * 7, chunkZ - slot * 11, slotSeed ^ 0x27d4eb2f) * 0.28;
            candidates.push({
              id: `${definition.id}:${chunkX}:${chunkZ}:${slot}`,
              assetId: definition.id,
              x,
              y: sample.height,
              z,
              rotationY: hash2D(chunkX - slot * 13, chunkZ + slot * 5, slotSeed ^ 0x165667b1) * Math.PI * 2,
              scale: definition.scale * randomScale,
              phase: hash2D(chunkX + slot * 3, chunkZ - slot * 17, slotSeed ^ 0xd3a2646c) * Math.PI * 2,
              distance
            });
          }
        }
      }
      candidates.sort((left, right) => left.distance - right.distance || left.id.localeCompare(right.id));
      placements.push(...candidates.slice(0, limit));
    }
    return Object.freeze(placements.map((placement) => freezeRecord(placement)));
  }

  class EnvironmentAssetManager {
    constructor(adapter, B, scene, options) {
      this.adapter = adapter;
      this.B = B;
      this.scene = scene;
      this.options = options;
      this.documentRef = options.document || runtime.document;
      this.qualityPreset = normalizePreset(options.qualityPreset || options.quality, "balanced");
      this.seed = hashSeed(options.seed || "eonwild-mesozoic");
      const personalDefinitions = new Map((Array.isArray(options.cinematicEnvironmentAssets) ? options.cinematicEnvironmentAssets : [])
        .filter((definition) => ENVIRONMENT_ASSETS.some((base) => base.id === String(definition?.id || ""))
          && definition?.trustedObjectUrl === true
          && /^model\/gltf-binary$/i.test(String(definition?.contentType || ""))
          && new RegExp("^vegetation:" + String(definition.id) + "$").test(String(definition?.role || "")))
        .map((definition) => [String(definition.id), definition]));
      this.definitions = ENVIRONMENT_ASSETS.map((base) => {
        const personal = personalDefinitions.get(base.id);
        return personal ? freezeRecord({ ...base, ...personal, scale: clamp(personal.scale || 1, 0.001, 100), wind: clamp(personal.wind ?? base.wind, 0, 0.2), personal: true }) : base;
      });
      this.baseDefinitions = ENVIRONMENT_ASSETS;
      this.hdrDefinition = (Array.isArray(options.cinematicWeatherAssets) ? options.cinematicWeatherAssets : [])
        .find((definition) => definition?.trustedObjectUrl === true && definition?.channel === "hdri" && /^image\//i.test(String(definition?.contentType || ""))) || null;
      this.entries = new Map();
      this.hdrTexture = null;
      this.skybox = null;
      this.started = false;
      this.loading = false;
      this.disposed = false;
      this.status = options.environmentAssets === false ? "disabled" : "idle";
      this.failures = [];
      this.centerChunkKey = "";
      this.loadedInstances = 0;
      this.collisionPlacements = Object.freeze([]);
    }

    _emit(change = "environment-assets") {
      const detail = this.getStatus();
      safeCall(this.options.onEnvironmentAssetStatus, detail);
      if (!this.disposed) this.adapter._emitStatus({ change, environmentAssets: detail });
    }

    _resolveUrl(file, definition = null) {
      const trusted = definition ? trustedBlobAssetUrl(definition, this.documentRef) : "";
      if (trusted) return trusted;
      const base = normalizeUrl(this.options.environmentAssetBase || DEFAULT_ENVIRONMENT_ASSET_BASE, this.documentRef);
      let resolved = "";
      try { resolved = String(new URL(String(file || ""), base)); }
      catch { resolved = normalizeUrl(`${base}${String(file || "")}`, this.documentRef); }
      if (!resolved || !isSameOriginAssetUrl(resolved, this.documentRef)) {
        const error = new Error("EonWild environment assets must be served from the current origin.");
        error.code = "ENVIRONMENT_ASSET_ORIGIN_DENIED";
        throw error;
      }
      return resolved;
    }

    async start() {
      if (this.started || this.loading || this.disposed || this.status === "disabled") return this.getStatus();
      this.started = true;
      this.loading = true;
      this.status = "loading";
      this._emit();
      try {
        try { await this._loadHdr(); }
        catch (error) {
          this._recordFailure(this.hdrDefinition ? "personal-hdr" : "hdr", error);
          if (this.hdrDefinition && !this.disposed) {
            this.hdrDefinition = null;
            await this._loadHdr().catch((fallbackError) => this._recordFailure("hdr-fallback", fallbackError));
          }
        }
        if (this.disposed) return this.getStatus();
        await loadBabylonGltfLoader(this.B, this.options, this.documentRef);
        if (this.disposed) return this.getStatus();
        await this._ensureRequestedDefinitions();
      } catch (error) {
        this._recordFailure("gltf-loader", error);
      } finally {
        if (!this.disposed) {
          this.loading = false;
          this.status = this.entries.size ? "ready" : "procedural-fallback";
          this.update(this.adapter._player.x, this.adapter._player.z, true);
          this.syncEnvironment(this.adapter._environment.hour, this.adapter._environment.weather);
          this._emit();
        }
      }
      return this.getStatus();
    }

    _recordFailure(assetId, error) {
      this.failures.push(freezeRecord({ assetId: String(assetId), error: compactError(error) }));
      if (this.failures.length > this.definitions.length + 2) this.failures.shift();
    }

    async _loadHdr() {
      if (this.options.environmentHdr === false || typeof this.B.HDRCubeTexture !== "function") return;
      const url = this.hdrDefinition
        ? this._resolveUrl(this.hdrDefinition.file, this.hdrDefinition)
        : this._resolveUrl(this.options.environmentHdrFile || DEFAULT_ENVIRONMENT_HDR_FILE);
      const size = ENVIRONMENT_BUDGETS[this.qualityPreset].hdrCubeSize;
      let texture = null;
      const pending = new Promise((resolve, reject) => {
        const onLoad = () => resolve(texture);
        const onError = (message, exception) => reject(exception || new Error(String(message || "The HDR environment could not be decoded.")));
        texture = new this.B.HDRCubeTexture(url, this.scene, size, false, true, false, true, onLoad, onError);
      });
      try { await withDeadline(pending, this.options.assetLoadTimeoutMs || 12000, "ENVIRONMENT_HDR_TIMEOUT", () => safeDispose(texture)); }
      catch (error) { safeDispose(texture); throw error; }
      if (this.disposed) { safeDispose(texture); return; }
      this.hdrTexture = texture;
      this.hdrTexture.name = this.hdrDefinition ? "hwe3d-personal-weather-ibl" : "hwe3d-polyhaven-sky-ibl";
      this.scene.environmentTexture = texture;
      this.scene.environmentIntensity = 0.72;
      if (typeof this.scene.createDefaultSkybox === "function") {
        try {
          this.skybox = this.scene.createDefaultSkybox(texture, true, QUALITY_PRESETS[this.qualityPreset].farClip * 1.45, 0.22);
          if (this.skybox) {
            this.skybox.name = "hwe3d-polyhaven-skybox";
            this.skybox.isPickable = false;
            this.skybox.metadata = {
              eonwild: true,
              kind: this.hdrDefinition ? "verified-personal-hdri-candidate" : "cc0-hdri-sky",
              source: this.hdrDefinition?.source || "Poly Haven",
              productionApproved: false
            };
          }
        } catch { this.skybox = null; }
      }
    }

    async _ensureRequestedDefinitions() {
      for (const definition of this.definitions) {
        if (this.disposed) return;
        if ((ENVIRONMENT_BUDGETS[this.qualityPreset][definition.id] || 0) <= 0 || this.entries.has(definition.id)) continue;
        try { await this._loadDefinition(definition); }
        catch (error) {
          this._recordFailure(definition.id, error);
          const fallback = definition.personal ? this.baseDefinitions.find((candidate) => candidate.id === definition.id) : null;
          if (fallback && !this.disposed && !this.entries.has(definition.id)) {
            try { await this._loadDefinition(fallback); }
            catch (fallbackError) { this._recordFailure(definition.id + "-fallback", fallbackError); }
          }
        }
      }
    }

    async _loadDefinition(definition) {
      const absolute = this._resolveUrl(definition.file, definition);
      const isObjectUrl = /^blob:/i.test(absolute);
      const parsed = new URL(absolute, this.documentRef?.baseURI);
      const slash = parsed.pathname.lastIndexOf("/");
      parsed.pathname = parsed.pathname.slice(0, slash + 1);
      parsed.search = "";
      parsed.hash = "";
      const rootUrl = isObjectUrl ? "" : parsed.href;
      const filename = isObjectUrl ? absolute : absolute.slice(absolute.lastIndexOf("/") + 1).split(/[?#]/)[0];
      let lateContainer = null;
      const task = this.B.SceneLoader.LoadAssetContainerAsync(rootUrl, filename, this.scene, undefined, ".glb").then((container) => {
        lateContainer = container;
        if (this.disposed) safeDispose(container);
        return container;
      });
      const container = await withDeadline(task, this.options.assetLoadTimeoutMs || 12000, "ENVIRONMENT_GLB_TIMEOUT", () => safeDispose(lateContainer));
      if (this.disposed) { safeDispose(container); return; }
      if (!container || typeof container.instantiateModelsToScene !== "function") {
        safeDispose(container);
        const error = new Error(`The ${definition.id} GLB did not produce a reusable Babylon AssetContainer.`);
        error.code = "ENVIRONMENT_GLB_INVALID";
        throw error;
      }
      for (const material of container.materials || []) {
        if ("environmentIntensity" in material) material.environmentIntensity = 0.72;
        if ("maxSimultaneousLights" in material) material.maxSimultaneousLights = 2;
      }
      for (const texture of container.textures || []) {
        if ("anisotropicFilteringLevel" in texture) texture.anisotropicFilteringLevel = this.qualityPreset === "low" ? 2 : 4;
      }
      this.entries.set(definition.id, { definition, container, instances: [] });
      this._syncInstancesFor(definition.id, []);
    }

    _createInstance(entry, index) {
      const result = entry.container.instantiateModelsToScene((name) => `hwe3d-${entry.definition.id}-${index}-${name}`, false, { doNotInstantiate: false });
      if (!result || !Array.isArray(result.rootNodes) || !result.rootNodes.length) {
        for (const group of result?.animationGroups || []) safeDispose(group);
        for (const skeleton of result?.skeletons || []) safeDispose(skeleton);
        const error = new Error(`The ${entry.definition.id} asset could not create a visible instance.`);
        error.code = "ENVIRONMENT_INSTANCE_INVALID";
        throw error;
      }
      const wrapper = new this.B.TransformNode(`hwe3d-${entry.definition.id}-instance-${index}`, this.scene);
      for (const rootNode of result.rootNodes || []) rootNode.parent = wrapper;
      wrapper.setEnabled(false);
      wrapper.metadata = {
        eonwild: true,
        kind: entry.definition.personal ? "verified-personal-environment-candidate" : "cc0-environment-instance",
        assetId: entry.definition.id,
        source: entry.definition.source || "Poly Haven",
        productionApproved: false
      };
      const childMeshes = typeof wrapper.getChildMeshes === "function" ? wrapper.getChildMeshes(false) : [];
      const obstructionKind = entry.definition.id === "rock" ? "rock" : (entry.definition.id === "quiver" ? "tree" : "");
      for (const mesh of childMeshes) {
        mesh.isPickable = Boolean(obstructionKind);
        mesh.checkCollisions = false;
        if (obstructionKind) this.adapter._registerEnvironmentBlockerMesh(mesh, obstructionKind, "imported-mesh");
        if (this.adapter._lights?.shadow && typeof this.adapter._lights.shadow.addShadowCaster === "function") this.adapter._lights.shadow.addShadowCaster(mesh, true);
      }
      for (const group of result.animationGroups || []) { try { group.stop(); } catch { /* Static CC0 environment prop. */ } }
      const instance = { wrapper, result, placement: null, baseRotationX: 0, baseRotationZ: 0, phase: 0 };
      entry.instances.push(instance);
      this.loadedInstances += 1;
      return instance;
    }

    _applyPlacement(instance, placement) {
      if (!placement) {
        instance.placement = null;
        instance.wrapper.setEnabled(false);
        return;
      }
      instance.placement = placement;
      instance.phase = placement.phase;
      instance.baseRotationX = 0;
      instance.baseRotationZ = 0;
      instance.wrapper.position.x = placement.x - WORLD_HALF;
      instance.wrapper.position.y = placement.y;
      instance.wrapper.position.z = placement.z - WORLD_HALF;
      instance.wrapper.rotation.x = 0;
      instance.wrapper.rotation.y = placement.rotationY;
      instance.wrapper.rotation.z = 0;
      instance.wrapper.scaling.x = placement.scale;
      instance.wrapper.scaling.y = placement.scale;
      instance.wrapper.scaling.z = placement.scale;
      instance.wrapper.setEnabled(true);
    }

    _syncInstancesFor(assetId, placements) {
      const entry = this.entries.get(assetId);
      if (!entry) return;
      const wanted = new Map(placements.map((placement) => [placement.id, placement]));
      const assignments = new Map();
      for (const instance of entry.instances) {
        const placementId = instance.placement?.id;
        if (!placementId || !wanted.has(placementId)) continue;
        assignments.set(instance, wanted.get(placementId));
        wanted.delete(placementId);
      }
      const available = entry.instances.filter((instance) => !assignments.has(instance));
      for (const placement of wanted.values()) {
        const instance = available.shift() || this._createInstance(entry, entry.instances.length);
        assignments.set(instance, placement);
      }
      for (const instance of entry.instances) this._applyPlacement(instance, assignments.get(instance) || null);
    }

    update(worldX, worldZ, force = false) {
      if (this.disposed || !this.started) return;
      const placementCellSize = 52;
      const chunkKey = `${Math.floor(clamp(worldX, 0, WORLD_SIZE - 0.001) / placementCellSize)}:${Math.floor(clamp(worldZ, 0, WORLD_SIZE - 0.001) / placementCellSize)}:${this.qualityPreset}`;
      if (!force && chunkKey === this.centerChunkKey) return;
      this.centerChunkKey = chunkKey;
      const placements = planEnvironmentPlacements(worldX, worldZ, {
        seed: this.seed,
        qualityPreset: this.qualityPreset,
        landscape: this.adapter._landscape
      });
      const collisionPlacements = [];
      for (const definition of this.definitions) {
        const matching = placements.filter((placement) => placement.assetId === definition.id);
        try {
          this._syncInstancesFor(definition.id, matching);
          if (this.entries.has(definition.id) && ["rock", "quiver"].includes(definition.id)) collisionPlacements.push(...matching);
        }
        catch (error) { this._recordFailure(`${definition.id}-instance`, error); }
      }
      this.collisionPlacements = Object.freeze(collisionPlacements.slice());
    }

    getCollisionPlacements(worldX, worldZ, force = false) {
      this.update(worldX, worldZ, force);
      return freezeRecord({
        supported: this.started && !this.disposed,
        cellKey: this.centerChunkKey,
        placements: this.collisionPlacements,
        visible: this.collisionPlacements.length
      });
    }

    configure(qualityPreset) {
      const next = normalizePreset(qualityPreset, this.qualityPreset);
      if (next === this.qualityPreset) return;
      this.qualityPreset = next;
      this.centerChunkKey = "";
      if (this.started && !this.loading && !this.disposed) {
        this.loading = true;
        this._ensureRequestedDefinitions().catch((error) => this._recordFailure("quality-upgrade", error)).finally(() => {
          if (this.disposed) return;
          this.loading = false;
          this.status = this.entries.size ? "ready" : "procedural-fallback";
          this.update(this.adapter._player.x, this.adapter._player.z, true);
          this._emit("environment-quality");
        });
      } else this.update(this.adapter._player.x, this.adapter._player.z, true);
    }

    animate(elapsed, weather, reducedMotion) {
      if (this.disposed) return;
      const windMultiplier = weather === "storm" ? 2.8 : weather === "rain" ? 1.65 : weather === "mist" ? 0.65 : 1;
      for (const entry of this.entries.values()) {
        const amplitude = entry.definition.wind;
        if (!amplitude) continue;
        for (const instance of entry.instances) {
          if (!instance.placement) continue;
          if (reducedMotion) {
            instance.wrapper.rotation.x = instance.baseRotationX;
            instance.wrapper.rotation.z = instance.baseRotationZ;
          } else {
            const sway = Math.sin(elapsed * 0.72 + instance.phase) * amplitude * windMultiplier;
            instance.wrapper.rotation.x = instance.baseRotationX + sway * 0.4;
            instance.wrapper.rotation.z = instance.baseRotationZ + sway;
          }
        }
      }
    }

    syncEnvironment(hour, weather) {
      if (!this.skybox || typeof this.skybox.setEnabled !== "function") return;
      const daylightSky = hour >= 6.25 && hour <= 18.75 && !["storm", "ash"].includes(weather);
      this.skybox.setEnabled(daylightSky);
    }

    getStatus() {
      return freezeRecord({
        status: this.status,
        loadedAssets: Array.from(this.entries.keys()),
        loadedInstances: this.loadedInstances,
        visibleInstances: Array.from(this.entries.values()).reduce((sum, entry) => sum + entry.instances.filter((instance) => Boolean(instance.placement)).length, 0),
        hdr: Boolean(this.hdrTexture),
        failures: this.failures.slice()
      });
    }

    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      for (const entry of this.entries.values()) {
        for (const instance of entry.instances) {
          for (const group of instance.result.animationGroups || []) safeDispose(group);
          for (const skeleton of instance.result.skeletons || []) safeDispose(skeleton);
          safeDispose(instance.wrapper);
        }
        safeDispose(entry.container);
      }
      this.entries.clear();
      safeDispose(this.skybox);
      if (this.scene && this.scene.environmentTexture === this.hdrTexture) this.scene.environmentTexture = null;
      safeDispose(this.hdrTexture);
      this.skybox = null;
      this.hdrTexture = null;
      this.loadedInstances = 0;
      this.collisionPlacements = Object.freeze([]);
      this.status = "disposed";
    }
  }

  class CreaturePrototypeManager {
    constructor(adapter, B, scene, options) {
      this.adapter = adapter;
      this.B = B;
      this.scene = scene;
      this.options = options;
      this.documentRef = options.document || runtime.document;
      this.entries = new Map();
      this.lodEntries = new Map();
      this.activeLods = new Map();
      this.lastPose = new Map();
      this.clipTransitions = new Map();
      this.failures = [];
      this.started = false;
      this.loading = false;
      this.disposed = false;
      this.reducedMotion = Boolean(adapter._reducedMotion);
      this.cinematicDefinitions = (Array.isArray(options.cinematicCreatureAssets) ? options.cinematicCreatureAssets : [])
        .map((definition) => {
          const id = String(definition?.id || "");
          const roleMatch = new RegExp("^creature:" + id + ":lod([0-3])$").exec(String(definition?.role || ""));
          const lod = roleMatch ? Number(roleMatch[1]) : -1;
          return { definition, id, lod };
        })
        .filter(({ definition, id, lod }) => FLAGSHIP_IDS.includes(id)
          && lod >= 0
          && definition?.trustedObjectUrl === true
          && /^blob:/i.test(String(definition?.file || ""))
          && /^model\/gltf-binary$/i.test(String(definition?.contentType || "")))
        .slice(0, FLAGSHIP_IDS.length * 4)
        .map(({ definition, lod }) => freezeRecord({
          ...definition,
          lod,
          scale: clamp(definition.scale || 1, 0.001, 100),
          rotationY: finite(definition.rotationY, 0),
          productionApproved: false
        }));
      this.status = options.creaturePrototypeAssets === false ? "disabled" : "idle";
    }

    _emit(change = "creature-prototypes") {
      const detail = this.getStatus();
      safeCall(this.options.onCreatureAssetStatus, detail);
      if (!this.disposed) this.adapter._emitStatus({ change, creatureAssets: detail });
    }

    _resolveUrl(definition) {
      const file = definition?.file;
      if (definition?.trustedObjectUrl === true) {
        try {
          const base = new URL(this.documentRef?.baseURI || runtime.location?.href);
          const parsed = new URL(String(file || ""));
          if (parsed.protocol === "blob:" && parsed.origin === base.origin) return parsed.href;
        } catch { /* Fall through to the same-origin rejection below. */ }
      }
      const base = normalizeUrl(this.options.creatureAssetBase || DEFAULT_CREATURE_ASSET_BASE, this.documentRef);
      let resolved = "";
      try { resolved = String(new URL(String(file || ""), base)); }
      catch { resolved = normalizeUrl(`${base}${String(file || "")}`, this.documentRef); }
      if (!resolved || !isSameOriginAssetUrl(resolved, this.documentRef)) {
        const error = new Error("EonWild creature prototypes must be served from the current origin.");
        error.code = "CREATURE_ASSET_ORIGIN_DENIED";
        throw error;
      }
      return resolved;
    }

    _recordFailure(speciesId, error) {
      this.failures.push(freezeRecord({ speciesId: String(speciesId), error: compactError(error) }));
      if (this.failures.length > CREATURE_PROTOTYPE_ASSETS.length + this.cinematicDefinitions.length + 1) this.failures.shift();
    }

    async start() {
      if (this.started || this.loading || this.disposed || this.status === "disabled") return this.getStatus();
      this.started = true;
      this.loading = true;
      this.status = "loading";
      this._emit();
      try {
        await loadBabylonGltfLoader(this.B, this.options, this.documentRef);
        for (const speciesId of FLAGSHIP_IDS) {
          if (this.disposed) break;
          const cinematic = this.cinematicDefinitions
            .filter((definition) => definition.id === speciesId)
            .sort((left, right) => left.lod - right.lod);
          const lod0 = cinematic.find((definition) => definition.lod === 0);
          if (lod0) {
            try { await this._loadDefinition(lod0); }
            catch (error) { this._recordFailure(speciesId + ":lod0", error); }
          }
          if (this.entries.has(speciesId)) {
            for (const definition of cinematic.filter((candidate) => candidate.lod > 0)) {
              if (this.disposed) break;
              try { await this._loadDefinition(definition); }
              catch (error) { this._recordFailure(speciesId + ":lod" + definition.lod, error); }
            }
            continue;
          }
          const prototype = CREATURE_PROTOTYPE_ASSETS.find((definition) => definition.id === speciesId);
          if (!prototype) continue;
          try { await this._loadDefinition({ ...prototype, lod: 0 }); }
          catch (error) { this._recordFailure(speciesId, error); }
        }
      } catch (error) {
        this._recordFailure("gltf-loader", error);
      } finally {
        if (!this.disposed) {
          this.loading = false;
          const cinematicReady = [...this.lodEntries.values()].some((lods) => [...lods.values()].some((entry) => entry.definition.trustedObjectUrl === true));
          this.status = cinematicReady ? "cinematic-candidate-ready" : this.entries.size ? "prototype-ready" : "procedural-fallback";
          this._emit();
        }
      }
      return this.getStatus();
    }

    async _loadDefinition(definition) {
      const proxy = this.adapter._proxies.get(definition.id);
      if (!proxy) throw Object.assign(new Error(`No procedural fallback exists for ${definition.id}.`), { code: "CREATURE_PROXY_MISSING" });
      const cinematic = definition.trustedObjectUrl === true;
      const lod = cinematic ? Math.round(clamp(definition.lod, 0, 3)) : 0;
      const existingLods = this.lodEntries.get(definition.id);
      if (existingLods?.has(lod)) return existingLods.get(lod);
      const absolute = this._resolveUrl(definition);
      const isObjectUrl = /^blob:/i.test(absolute);
      const parsed = new URL(absolute, this.documentRef?.baseURI);
      const slash = parsed.pathname.lastIndexOf("/");
      parsed.pathname = parsed.pathname.slice(0, slash + 1);
      parsed.search = "";
      parsed.hash = "";
      const rootUrl = isObjectUrl ? "" : parsed.href;
      const filename = isObjectUrl ? absolute : absolute.slice(absolute.lastIndexOf("/") + 1).split(/[?#]/)[0];
      let lateContainer = null;
      const task = this.B.SceneLoader.LoadAssetContainerAsync(rootUrl, filename, this.scene, undefined, ".glb").then((container) => {
        lateContainer = container;
        if (this.disposed) safeDispose(container);
        return container;
      });
      const container = await withDeadline(task, this.options.assetLoadTimeoutMs || 12000, "CREATURE_GLB_TIMEOUT", () => safeDispose(lateContainer));
      if (this.disposed) { safeDispose(container); return; }
      const groups = Array.from(container?.animationGroups || []);
      const clipMap = new Map();
      for (const group of groups) {
        const normalized = String(group?.name || "").toLowerCase();
        for (const clip of ["idle", "walk", "run", "attack", "jump", "death"]) if (normalized === clip || normalized.endsWith(`_${clip}`) || normalized.endsWith(`-${clip}`) || normalized.endsWith(`/${clip}`)) clipMap.set(clip, group);
      }
      if (!container || typeof container.addAllToScene !== "function" || !clipMap.has("idle") || !clipMap.has("walk") || !clipMap.has("run")) {
        safeDispose(container);
        const error = new Error(`The ${definition.id} prototype is missing its reusable skin or locomotion clips.`);
        error.code = "CREATURE_GLB_INVALID";
        throw error;
      }

      container.addAllToScene();
      const wrapper = new this.B.TransformNode(`hwe3d-${definition.id}-${cinematic ? `personal-cinematic-lod${lod}` : "cc0-prototype"}`, this.scene);
      wrapper.parent = proxy.root;
      wrapper.rotation.y = definition.rotationY;
      wrapper.scaling.set(definition.scale, definition.scale, definition.scale);
      wrapper.metadata = { eonwild: true, kind: cinematic ? "verified-cinematic-creature-candidate" : "animated-creature-prototype", targetType: "animal", targetable: true, speciesId: definition.id, targetId: proxy.entityId || "", entityId: proxy.entityId || "", identityExact: proxy.identityExact === true, isPlayer: proxy.isPlayer === true, lod, source: definition.source, packId: definition.packId || "", productionApproved: false };
      for (const rootNode of container.rootNodes || []) rootNode.parent = wrapper;
      const childMeshes = typeof wrapper.getChildMeshes === "function" ? wrapper.getChildMeshes(false) : [];
      for (const mesh of childMeshes) {
        mesh.isPickable = true;
        mesh.checkCollisions = false;
        mesh.receiveShadows = true;
        mesh.metadata = { ...(mesh.metadata || {}), eonwild: true, kind: cinematic ? "verified-cinematic-creature-candidate-part" : "animated-creature-prototype-part", targetType: "animal", targetable: true, speciesId: definition.id, targetId: proxy.entityId || "", entityId: proxy.entityId || "", identityExact: proxy.identityExact === true, isPlayer: proxy.isPlayer === true, lod, productionApproved: false };
        if (this.adapter._lights?.shadow && typeof this.adapter._lights.shadow.addShadowCaster === "function") this.adapter._lights.shadow.addShadowCaster(mesh, true);
      }
      for (const material of container.materials || []) {
        if (!cinematic) {
          if ("roughness" in material) material.roughness = Math.max(0.78, finite(material.roughness, 0.9));
          if ("metallic" in material) material.metallic = 0;
        }
        applyCreatureMaterialReadability(this.B, material, cinematic ? 0.04 : 0.3);
      }
      for (const group of groups) { try { group.stop(); } catch { /* Clip selection starts only after the model is attached. */ } }
      const entry = { definition: { ...definition, lod }, lod, container, wrapper, groups, clipMap, activeClip: "", animationLodActive: lod < 2, proxy };
      const lods = existingLods || new Map();
      lods.set(lod, entry);
      this.lodEntries.set(definition.id, lods);
      const becomesPrimary = lod === 0 && !this.entries.has(definition.id);
      if (becomesPrimary) {
        this.entries.set(definition.id, entry);
        this.activeLods.set(definition.id, 0);
        proxy.parts.forEach((part) => { try { part.setEnabled(false); } catch { part.isVisible = false; } });
        try { wrapper.setEnabled(true); } catch {}
      } else {
        try { wrapper.setEnabled(false); } catch { wrapper.isVisible = false; }
      }
      this._applyClip(entry, becomesPrimary && !this.reducedMotion ? "idle" : "");
      const pose = this.lastPose.get(definition.id);
      if (becomesPrimary && pose?.motion && !this.reducedMotion) this._applyClip(entry, pose.motion);
      if (proxy.entityId && this.adapter._highlightedTarget?.entityId === proxy.entityId) this.adapter.setHighlightedTarget(this.adapter._highlightedTarget);
      return entry;
    }

    _setAnimationGroupWeight(group, weight) {
      if (!group) return false;
      const bounded = clamp(weight, 0, 1);
      try {
        if (typeof group.setWeightForAllAnimatables === "function") { group.setWeightForAllAnimatables(bounded); return true; }
        if (Array.isArray(group.animatables)) {
          for (const animatable of group.animatables) animatable.weight = bounded;
          return group.animatables.length > 0;
        }
      } catch { /* Babylon blending remains available below. */ }
      return false;
    }

    _configureAnimationBlending(group) {
      if (!group) return;
      for (const targeted of group.targetedAnimations || []) {
        const animation = targeted?.animation;
        if (!animation) continue;
        try {
          animation.enableBlending = true;
          animation.blendingSpeed = clamp(this.options.animationBlendingSpeed ?? 0.12, 0.02, 0.3);
        } catch { /* Optional GLB tracks may be immutable. */ }
      }
    }

    _advanceClipTransitions(timestamp = now()) {
      for (const [entry, transition] of this.clipTransitions) {
        const elapsed = timestamp - transition.startedAt;
        // Comparing the deadline explicitly avoids leaving a transition alive
        // for one extra frame when floating-point subtraction lands just below 1.
        const completed = timestamp >= transition.startedAt + transition.durationMs;
        const amount = completed ? 1 : clamp(elapsed / transition.durationMs, 0, 1);
        this._setAnimationGroupWeight(transition.previous, 1 - amount);
        this._setAnimationGroupWeight(transition.next, amount);
        if (!completed) continue;
        try { transition.previous?.stop?.(); } catch { /* The new clip is already authoritative. */ }
        this._setAnimationGroupWeight(transition.next, 1);
        this.clipTransitions.delete(entry);
      }
    }

    _stopEntryAnimation(entry) {
      const transition = this.clipTransitions.get(entry);
      this.clipTransitions.delete(entry);
      const groups = new Set([transition?.previous, transition?.next, entry?.clipMap?.get(entry?.activeClip)].filter(Boolean));
      for (const group of groups) {
        this._setAnimationGroupWeight(group, 0);
        try { group.stop(); } catch { /* A broken optional clip must not break gameplay. */ }
      }
      if (entry) entry.activeClip = "";
    }

    _applyClip(entry, clip, options = {}) {
      this._advanceClipTransitions();
      const next = clip && entry.clipMap.has(clip) ? clip : "";
      if (entry.activeClip === next) return;
      const previous = entry.clipMap.get(entry.activeClip) || null;
      const interrupted = this.clipTransitions.get(entry);
      if (interrupted) {
        this.clipTransitions.delete(entry);
        if (interrupted.previous && interrupted.previous !== previous) {
          this._setAnimationGroupWeight(interrupted.previous, 0);
          try { interrupted.previous.stop(); } catch { /* Stale transition cleanup only. */ }
        }
      }
      if (!next) { this._stopEntryAnimation(entry); return; }
      const group = entry.clipMap.get(next);
      this._configureAnimationBlending(group);
      try {
        group.speedRatio = next === "run" ? 1.05 : 1;
        group.start(true);
      } catch {
        entry.activeClip = "";
        this._setAnimationGroupWeight(previous, 1);
        return;
      }
      entry.activeClip = next;
      if (!previous || previous === group || options.immediate === true) {
        this._setAnimationGroupWeight(group, 1);
        if (previous && previous !== group) { try { previous.stop(); } catch { /* New clip already started. */ } }
        return;
      }
      const weighted = this._setAnimationGroupWeight(group, 0);
      this._setAnimationGroupWeight(previous, 1);
      if (!weighted) {
        // Babylon track blending still prevents a bind-pose snap. Start the new
        // group first, then retire only the previous active group.
        try { previous.stop(); } catch { /* New clip already started. */ }
        this._setAnimationGroupWeight(group, 1);
        return;
      }
      this.clipTransitions.set(entry, {
        previous,
        next: group,
        startedAt: now(),
        durationMs: clamp(options.durationMs ?? this.options.animationCrossFadeMs ?? 180, 80, 420)
      });
    }

    _selectLod(speciesId, worldX, worldZ, motion) {
      const lods = this.lodEntries.get(speciesId);
      if (!lods?.size) return null;
      const camera = this.adapter._camera;
      const cameraX = finite(camera?.position?.x, worldX - WORLD_HALF);
      const cameraZ = finite(camera?.position?.z, worldZ - WORLD_HALF);
      const distance = Math.hypot(cameraX - (finite(worldX) - WORLD_HALF), cameraZ - (finite(worldZ) - WORLD_HALF));
      const wanted = distance < 42 ? 0 : distance < 105 ? 1 : distance < 230 ? 2 : 3;
      const available = [...lods.keys()].sort((left, right) => left - right);
      const selected = available.find((lod) => lod >= wanted) ?? available[available.length - 1];
      const current = this.activeLods.get(speciesId);
      if (current !== selected) {
        const previous = lods.get(current);
        if (previous) {
          this._applyClip(previous, "", { immediate: true });
          try { previous.wrapper.setEnabled(false); } catch { previous.wrapper.isVisible = false; }
        }
        const next = lods.get(selected);
        if (next) {
          try { next.wrapper.setEnabled(true); } catch { next.wrapper.isVisible = true; }
          this.activeLods.set(speciesId, selected);
        }
      }
      const active = lods.get(this.activeLods.get(speciesId));
      if (active) {
        active.animationLodActive = wanted < 2 && active.lod < 2;
        this._applyClip(active, this.reducedMotion || !active.animationLodActive ? "" : motion, { immediate: !active.animationLodActive });
      }
      return active || null;
    }

    syncPose(speciesId, worldX, worldZ) {
      const id = String(speciesId || "").toLowerCase();
      if (!CREATURE_PROTOTYPE_ASSETS.some((definition) => definition.id === id) && !this.entries.has(id)) return;
      const timestamp = now();
      const previous = this.lastPose.get(id);
      let motion = "idle";
      if (previous) {
        const seconds = Math.max(1 / 120, (timestamp - previous.at) / 1000);
        const speed = Math.hypot(finite(worldX) - previous.x, finite(worldZ) - previous.z) / seconds;
        if (speed > 5.5) motion = "run";
        else if (speed > 0.35) motion = "walk";
      }
      this.lastPose.set(id, { x: finite(worldX), z: finite(worldZ), at: timestamp, motion });
      this._advanceClipTransitions(timestamp);
      this._selectLod(id, worldX, worldZ, motion);
    }

    setReducedMotion(value) {
      this.reducedMotion = Boolean(value);
      for (const [speciesId, lods] of this.lodEntries) {
        const motion = this.lastPose.get(speciesId)?.motion || "idle";
        for (const [lod, entry] of lods) this._applyClip(entry, !this.reducedMotion && entry.animationLodActive && lod === this.activeLods.get(speciesId) ? motion : "", { immediate: this.reducedMotion || !entry.animationLodActive });
      }
    }

    getStatus() {
      return freezeRecord({
        status: this.status,
        loadedSpecies: Array.from(this.entries.keys()),
        activeClips: freezeRecord(Object.fromEntries(Array.from(this.lodEntries, ([id, lods]) => {
          const entry = lods.get(this.activeLods.get(id));
          return [id, entry?.activeClip || "static"];
        }))),
        activeLods: freezeRecord(Object.fromEntries(this.activeLods)),
        animationLodActive: freezeRecord(Object.fromEntries(Array.from(this.lodEntries, ([id, lods]) => {
          const entry = lods.get(this.activeLods.get(id));
          return [id, Boolean(entry?.animationLodActive)];
        }))),
        animationCrossFadeMs: clamp(this.options.animationCrossFadeMs ?? 180, 80, 420),
        footIk: freezeRecord({ supported: false, active: false, reason: "asset-contract-unavailable" }),
        availableLods: freezeRecord(Object.fromEntries(Array.from(this.lodEntries, ([id, lods]) => [id, [...lods.keys()].sort()]))),
        productionApproved: false,
        cinematicSpecies: Array.from(this.lodEntries)
          .filter(([, lods]) => [...lods.values()].some((entry) => entry.definition.trustedObjectUrl === true))
          .map(([id]) => id),
        failures: this.failures.slice()
      });
    }

    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      for (const [speciesId, lods] of this.lodEntries) {
        for (const entry of lods.values()) {
          for (const group of entry.groups) safeDispose(group);
          safeDispose(entry.container);
          safeDispose(entry.wrapper);
        }
        const proxy = this.adapter._proxies.get(speciesId);
        proxy?.parts?.forEach((part) => { try { part.setEnabled(true); } catch { part.isVisible = true; } });
      }
      this.entries.clear();
      this.lodEntries.clear();
      this.activeLods.clear();
      this.lastPose.clear();
      this.clipTransitions.clear();
      this.status = "disposed";
    }
  }

  function createWaterNormalTexture(B, scene) {
    if (typeof B.DynamicTexture !== "function") return null;
    try {
      const size = 96;
      const texture = new B.DynamicTexture("hwe3d-water-normal-map", { width: size, height: size }, scene, false);
      const context = texture.getContext();
      const image = context.createImageData(size, size);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const phaseA = Math.sin((x + y * 0.68) * 0.31);
          const phaseB = Math.cos((x * 0.42 - y) * 0.19);
          const offset = (y * size + x) * 4;
          image.data[offset] = Math.round(128 + phaseA * 22);
          image.data[offset + 1] = Math.round(128 + phaseB * 22);
          image.data[offset + 2] = 244;
          image.data[offset + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
      texture.update(false);
      texture.wrapU = B.Texture?.WRAP_ADDRESSMODE ?? 1;
      texture.wrapV = B.Texture?.WRAP_ADDRESSMODE ?? 1;
      texture.uScale = 72;
      texture.vScale = 72;
      texture.level = 0.22;
      return texture;
    } catch { return null; }
  }

  function createWeatherEffects(B, scene) {
    if (typeof B.ParticleSystem !== "function" || typeof B.DynamicTexture !== "function") return null;
    let texture = null;
    let rain = null;
    try {
      texture = new B.DynamicTexture("hwe3d-rain-drop-texture", { width: 8, height: 32 }, scene, false);
      const context = texture.getContext();
      context.clearRect(0, 0, 8, 32);
      const gradient = context.createLinearGradient(0, 0, 0, 32);
      gradient.addColorStop(0, "rgba(210,235,255,0)");
      gradient.addColorStop(0.28, "rgba(210,235,255,.86)");
      gradient.addColorStop(1, "rgba(175,220,255,0)");
      context.fillStyle = gradient;
      context.fillRect(3, 0, 2, 32);
      texture.hasAlpha = true;
      texture.update(false);
      rain = new B.ParticleSystem("hwe3d-bounded-rain", ENVIRONMENT_BUDGETS.ultra.rainParticles, scene);
      rain.particleTexture = texture;
      rain.emitter = new B.Vector3(0, 26, 0);
      rain.minEmitBox = new B.Vector3(-30, 0, -30);
      rain.maxEmitBox = new B.Vector3(30, 8, 30);
      rain.color1 = new B.Color4(0.72, 0.86, 1, 0.62);
      rain.color2 = new B.Color4(0.58, 0.76, 0.94, 0.42);
      rain.colorDead = new B.Color4(0.42, 0.62, 0.8, 0);
      rain.direction1 = new B.Vector3(-2.2, -48, 0.8);
      rain.direction2 = new B.Vector3(1.2, -62, 2.5);
      rain.gravity = new B.Vector3(0, -28, 0);
      rain.minLifeTime = 0.45;
      rain.maxLifeTime = 0.8;
      rain.minSize = 0.1;
      rain.maxSize = 0.22;
      rain.minScaleX = 0.16;
      rain.maxScaleX = 0.3;
      rain.minScaleY = 3.5;
      rain.maxScaleY = 7;
      rain.minEmitPower = 8;
      rain.maxEmitPower = 15;
      rain.emitRate = 0;
      rain.updateSpeed = 0.012;
      return { rain, texture, active: false };
    } catch {
      safeDispose(rain);
      safeDispose(texture);
      return null;
    }
  }

  function createProxyMaterial(B, scene, name, hex, accent = false) {
    const material = new B.StandardMaterial(`hwe3d-proxy-${name}-${accent ? "accent" : "body"}`, scene);
    let color;
    try { color = typeof B.Color3.FromHexString === "function" ? B.Color3.FromHexString(hex) : new B.Color3(0.55, 0.45, 0.3); }
    catch { color = new B.Color3(0.55, 0.45, 0.3); }
    material.diffuseColor = accent ? new B.Color3(color.r * 0.72, color.g * 0.72, color.b * 0.72) : color;
    material.ambientColor = new B.Color3(material.diffuseColor.r * 0.34, material.diffuseColor.g * 0.34, material.diffuseColor.b * 0.34);
    material.emissiveColor = new B.Color3(material.diffuseColor.r * 0.12, material.diffuseColor.g * 0.12, material.diffuseColor.b * 0.12);
    material.specularColor = new B.Color3(0.04, 0.04, 0.035);
    material.roughness = 0.95;
    if (typeof material.freeze === "function") material.freeze();
    return material;
  }

  function createProxyPart(B, scene, rootNode, material, definition) {
    const name = `${rootNode.name}-${definition.name}`;
    let mesh;
    if (definition.shape === "box") mesh = B.MeshBuilder.CreateBox(name, { size: 1 }, scene);
    else if (definition.shape === "cylinder") mesh = B.MeshBuilder.CreateCylinder(name, { height: 1, diameter: 1, tessellation: definition.tessellation || 8 }, scene);
    else mesh = B.MeshBuilder.CreateSphere(name, { diameter: 1, segments: definition.segments || 8 }, scene);
    mesh.parent = rootNode;
    mesh.position = new B.Vector3(definition.position[0], definition.position[1], definition.position[2]);
    mesh.scaling = new B.Vector3(definition.scale[0], definition.scale[1], definition.scale[2]);
    if (definition.rotation) mesh.rotation = new B.Vector3(definition.rotation[0], definition.rotation[1], definition.rotation[2]);
    mesh.material = material;
    mesh.isPickable = true;
    mesh.checkCollisions = false;
    mesh.metadata = { eonwild: true, kind: "species-proxy-part", targetType: "animal", targetable: true, speciesId: rootNode.metadata?.speciesId || "", targetId: "", entityId: "", identityExact: false, isPlayer: false, part: definition.name };
    return mesh;
  }

  function proxyDefinitions(speciesId) {
    if (speciesId === "triceratops") return [
      { name: "torso", shape: "sphere", position: [0, 2.1, 0], scale: [4.1, 1.75, 1.55] },
      { name: "head", shape: "sphere", position: [3.55, 2.15, 0], scale: [1.65, 1.2, 1.15] },
      { name: "frill", shape: "cylinder", position: [2.55, 2.8, 0], scale: [2.3, 0.38, 2.3], rotation: [Math.PI / 2, 0, 0], accent: true },
      { name: "horn-left", shape: "cylinder", position: [4.45, 3.05, -0.55], scale: [0.22, 1.45, 0.22], rotation: [0, 0, -1.08], accent: true },
      { name: "horn-right", shape: "cylinder", position: [4.45, 3.05, 0.55], scale: [0.22, 1.45, 0.22], rotation: [0, 0, -1.08], accent: true },
      { name: "leg-fl", shape: "cylinder", position: [2.2, 0.8, -0.85], scale: [0.58, 1.55, 0.58] },
      { name: "leg-fr", shape: "cylinder", position: [2.2, 0.8, 0.85], scale: [0.58, 1.55, 0.58] },
      { name: "leg-bl", shape: "cylinder", position: [-2.1, 0.8, -0.85], scale: [0.62, 1.55, 0.62] },
      { name: "leg-br", shape: "cylinder", position: [-2.1, 0.8, 0.85], scale: [0.62, 1.55, 0.62] },
      { name: "tail", shape: "cylinder", position: [-4.2, 2, 0], scale: [0.55, 3.4, 0.55], rotation: [0, 0, Math.PI / 2] }
    ];
    if (speciesId === "spinosaurus") return [
      { name: "torso", shape: "sphere", position: [0, 3.2, 0], scale: [4.5, 1.6, 1.3] },
      { name: "snout", shape: "sphere", position: [4.2, 3.75, 0], scale: [2.1, 0.7, 0.72] },
      { name: "sail", shape: "box", position: [-0.5, 5.5, 0], scale: [4.7, 4, 0.24], rotation: [0, 0, -0.08], accent: true },
      { name: "tail", shape: "cylinder", position: [-4.8, 3, 0], scale: [0.68, 4.3, 0.68], rotation: [0, 0, Math.PI / 2] },
      { name: "leg-left", shape: "cylinder", position: [-0.4, 1.3, -0.75], scale: [0.52, 2.1, 0.52] },
      { name: "leg-right", shape: "cylinder", position: [-0.4, 1.3, 0.75], scale: [0.52, 2.1, 0.52] },
      { name: "arm-left", shape: "cylinder", position: [2.2, 2.6, -0.8], scale: [0.22, 1.15, 0.22], rotation: [0.35, 0, -0.5] },
      { name: "arm-right", shape: "cylinder", position: [2.2, 2.6, 0.8], scale: [0.22, 1.15, 0.22], rotation: [-0.35, 0, -0.5] }
    ];
    if (speciesId === "pteranodon") return [
      { name: "body", shape: "sphere", position: [0, 0, 0], scale: [2.25, 0.62, 0.58] },
      { name: "head", shape: "sphere", position: [2.2, 0.25, 0], scale: [0.7, 0.55, 0.5] },
      { name: "beak", shape: "cylinder", position: [3.2, 0.17, 0], scale: [0.22, 1.5, 0.22], rotation: [0, 0, Math.PI / 2], accent: true },
      { name: "crest", shape: "box", position: [1.55, 0.85, 0], scale: [1.25, 0.65, 0.18], rotation: [0, 0, -0.4], accent: true },
      { name: "wing-left", shape: "box", position: [-0.2, 0, -3.2], scale: [3.5, 0.16, 5.8], rotation: [0, 0.1, 0], accent: true, wing: "left" },
      { name: "wing-right", shape: "box", position: [-0.2, 0, 3.2], scale: [3.5, 0.16, 5.8], rotation: [0, -0.1, 0], accent: true, wing: "right" }
    ];
    return [
      { name: "torso", shape: "sphere", position: [0, 3.2, 0], scale: [3.5, 1.55, 1.25] },
      { name: "head", shape: "sphere", position: [3.15, 4.05, 0], scale: [1.6, 0.9, 0.82] },
      { name: "jaw", shape: "box", position: [4.25, 3.75, 0], scale: [1.55, 0.4, 0.74], accent: true },
      { name: "tail", shape: "cylinder", position: [-4, 3, 0], scale: [0.58, 3.7, 0.58], rotation: [0, 0, Math.PI / 2] },
      { name: "leg-left", shape: "cylinder", position: [-0.2, 1.3, -0.62], scale: [0.55, 2.2, 0.55] },
      { name: "leg-right", shape: "cylinder", position: [-0.2, 1.3, 0.62], scale: [0.55, 2.2, 0.55] },
      { name: "arm-left", shape: "cylinder", position: [2, 3, -0.65], scale: [0.18, 0.85, 0.18], rotation: [0.35, 0, -0.45] },
      { name: "arm-right", shape: "cylinder", position: [2, 3, 0.65], scale: [0.18, 0.85, 0.18], rotation: [-0.35, 0, -0.45] }
    ];
  }

  function createSpeciesProxy(B, scene, species) {
    const rootNode = new B.TransformNode(`hwe3d-${species.id}`, scene);
    rootNode.metadata = { eonwild: true, kind: "species-proxy", targetType: "animal", targetable: true, speciesId: species.id, targetId: "", entityId: "", identityExact: false, isPlayer: false, proxyOnly: true };
    const bodyMaterial = createProxyMaterial(B, scene, species.id, species.color, false);
    const accentMaterial = createProxyMaterial(B, scene, species.id, species.color, true);
    const parts = [];
    const wings = [];
    for (const definition of proxyDefinitions(species.id)) {
      const part = createProxyPart(B, scene, rootNode, definition.accent ? accentMaterial : bodyMaterial, definition);
      parts.push(part);
      if (definition.wing) wings.push({ mesh: part, side: definition.wing, baseRotation: part.rotation.x });
    }
    return { id: species.id, entityId: "", identityExact: false, isPlayer: false, species, root: rootNode, parts, wings, materials: [bodyMaterial, accentMaterial], baseY: 0, flightOffset: species.locomotion === "fly" ? 18 : 0 };
  }

  class AdaptiveQualityGovernor {
    constructor(adapter, enabled) {
      this.adapter = adapter;
      this.enabled = enabled !== false;
      this.samples = [];
      this.lastEvaluation = now();
      this.warmupUntil = this.lastEvaluation + 8000;
      this.slowWindows = 0;
      this.fastWindows = 0;
      this.p95 = 0;
      this.p99 = 0;
      this.average = 0;
      this.maximum = 0;
      this.longFrameCount = 0;
    }

    record(frameMs, timestamp) {
      if (timestamp < this.warmupUntil) return;
      const value = clamp(frameMs, 0.1, 250);
      if (value >= 100) this.longFrameCount += 1;
      this.samples.push({ at: timestamp, value });
      while (this.samples.length && (this.samples.length > MAX_FRAME_SAMPLES || this.samples[0].at < timestamp - 2000)) this.samples.shift();
      if (timestamp - this.lastEvaluation < 2000 || this.samples.length < 12) return;
      this.lastEvaluation = timestamp;
      const sorted = this.samples.map((sample) => sample.value).sort((a, b) => a - b);
      this.p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
      this.p99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
      this.average = this.samples.reduce((sum, sample) => sum + sample.value, 0) / this.samples.length;
      this.maximum = sorted[sorted.length - 1];
      if (!this.enabled) return;
      const preset = QUALITY_PRESETS[this.adapter._qualityPreset];
      const targetMs = 1000 / preset.targetFps;
      if (this.p95 > targetMs * 1.25) {
        this.slowWindows += 1;
        this.fastWindows = 0;
      } else if (this.p95 < targetMs * 0.72) {
        this.fastWindows += 1;
        this.slowWindows = 0;
      } else {
        this.slowWindows = 0;
        this.fastWindows = 0;
      }
      if (this.slowWindows >= 2) {
        this.slowWindows = 0;
        this.adapter._shiftAdaptiveQuality(-1, "frame-budget");
      } else if (this.fastWindows >= 4) {
        this.fastWindows = 0;
        this.adapter._shiftAdaptiveQuality(1, "frame-headroom");
      }
    }

    reset() {
      this.samples.length = 0;
      this.slowWindows = 0;
      this.fastWindows = 0;
      this.p95 = 0;
      this.p99 = 0;
      this.average = 0;
      this.maximum = 0;
      this.longFrameCount = 0;
      this.lastEvaluation = now();
      this.warmupUntil = this.lastEvaluation + 8000;
    }
  }

  class CinematicAudioManager {
    constructor(options = {}, documentRef = runtime.document) {
      this.options = options;
      this.documentRef = documentRef;
      this.definition = (Array.isArray(options.cinematicAudioAssets) ? options.cinematicAudioAssets : [])
        .find((asset) => asset?.trustedObjectUrl === true
          && /^audio\//i.test(String(asset?.contentType || ""))
          && ["ambience", "forest", "ocean", "rain", "wind"].includes(String(asset?.channel || ""))) || null;
      this.enabled = options.ambientAudioEnabled === true;
      this.volume = clamp(options.ambientAudioVolume ?? 0.7, 0, 1);
      this.audio = null;
      this.status = this.definition ? "idle" : "fallback";
      this.playBlocked = false;
    }

    start() {
      if (!this.definition || this.audio) return this.getStatus();
      const url = trustedBlobAssetUrl(this.definition, this.documentRef);
      const AudioCtor = this.options.Audio || runtime.Audio;
      if (!url || typeof AudioCtor !== "function") {
        this.status = "fallback";
        return this.getStatus();
      }
      try {
        const audio = new AudioCtor(url);
        audio.loop = true;
        audio.preload = "auto";
        audio.volume = this.volume;
        this.audio = audio;
        this.status = "ready";
        if (this.enabled) this.resume();
      } catch {
        this.status = "fallback";
      }
      return this.getStatus();
    }

    set(enabled, volume = this.volume) {
      this.enabled = Boolean(enabled);
      this.volume = clamp(volume, 0, 1);
      if (!this.audio) this.start();
      if (this.audio) this.audio.volume = this.volume;
      if (!this.enabled || this.volume <= 0) this.pause();
      else this.resume();
      return this.getStatus();
    }

    pause() {
      try { this.audio?.pause?.(); } catch {}
      return this.getStatus();
    }

    resume() {
      if (!this.enabled || this.volume <= 0 || !this.audio || this.documentRef?.hidden) return this.getStatus();
      try {
        const pending = this.audio.play?.();
        if (pending?.catch) pending.catch(() => { this.playBlocked = true; });
        this.playBlocked = false;
      } catch { this.playBlocked = true; }
      return this.getStatus();
    }

    getStatus() {
      return freezeRecord({
        status: this.status,
        enabled: this.enabled,
        channel: this.definition?.channel || "",
        playing: Boolean(this.audio && !this.audio.paused),
        playBlocked: this.playBlocked,
        productionApproved: false
      });
    }

    dispose() {
      try {
        if (this.audio) {
          this.audio.pause?.();
          this.audio.removeAttribute?.("src");
          this.audio.load?.();
        }
      } catch {}
      this.audio = null;
      this.status = "disposed";
    }
  }

  class EonWild3DAdapter {
    constructor(options = {}) {
      this._options = options && typeof options === "object" ? { ...options } : {};
      this._state = "idle";
      this._backend = null;
      this._failureReason = null;
      this._attempts = [];
      this._engine = null;
      this._scene = null;
      this._camera = null;
      this._canvas = null;
      this._container = null;
      this._ownsCanvas = false;
      this._manageCanvasVisibility = true;
      this._manageCanvasStyle = true;
      this._canvasCommitted = false;
      this._canvasStyleSnapshot = null;
      this._Babylon = null;
      this._landscape = null;
      this._streamer = null;
      this._vegetation = null;
      this._environmentRenderer = null;
      this._waterWeather = null;
      this._proceduralLakes = Object.freeze([]);
      this._water = null;
      this._weatherFx = null;
      this._fogBaseDensity = 0.00055;
      this._sunBaseIntensity = 1.05;
      this._ambientBaseIntensity = 0.72;
      this._environmentRenderState = null;
      this._readabilityState = null;
      this._environmentAssets = null;
      this._creatureAssets = null;
      this._cinematicAudio = null;
      this._environmentLoadHandle = null;
      this._environmentLoadHandleType = null;
      this._lights = null;
      this._postProcessing = null;
      this._renderFeaturePreset = null;
      this._postProcessingFailureHistory = [];
      this._photoSettings = { ...DEFAULT_PHOTO_SETTINGS };
      this._photoCameraOverride = false;
      this._proxies = new Map();
      this._proxyByEntityId = new Map();
      this._visibleWildlifeSpecies = new Set();
      this._resourceMarkers = new Map();
      this._resourceMaterials = new Map();
      this._environmentBlockerMeshes = new Set();
      this._playerSpeciesId = FLAGSHIP_IDS.includes(this._options.speciesId) ? this._options.speciesId : "tyrannosaurus";
      this._playerEntityId = safeEntityId(this._options.playerEntityId ?? this._options.playerId ?? "player") || "player";
      const initialCameraProfileId = defaultGameplayCameraProfileForSpecies(this._playerSpeciesId);
      const configuredGameplayCamera = this._options.gameplayCamera && typeof this._options.gameplayCamera === "object"
        ? this._options.gameplayCamera
        : null;
      const speciesCameraDefaults = freezeRecord({
        ...DEFAULT_GAMEPLAY_CAMERA,
        profileId: initialCameraProfileId,
        pitch: GAMEPLAY_CAMERA_PROFILES[initialCameraProfileId].defaultPitch,
        distance: GAMEPLAY_CAMERA_PROFILES[initialCameraProfileId].distance,
        fov: GAMEPLAY_CAMERA_PROFILES[initialCameraProfileId].fov,
        active: false
      });
      this._gameplayCamera = configuredGameplayCamera
        ? normalizeGameplayCamera({ ...configuredGameplayCamera, profileId: configuredGameplayCamera.profileId ?? configuredGameplayCamera.profile ?? initialCameraProfileId, active: configuredGameplayCamera.active !== false }, speciesCameraDefaults)
        : speciesCameraDefaults;
      this._gameplayCameraApplied = null;
      this._gameplayCameraSourceYaw = this._gameplayCamera.yaw;
      this._gameplayCameraYawOverrideLatched = false;
      this._gameplayCameraManualIdleSeconds = 0;
      this._gameplayCameraFovDirty = Boolean(configuredGameplayCamera);
      this._gameplayCameraLimitsDirty = Boolean(configuredGameplayCamera);
      this._gameplayCameraCollision = freezeRecord({ supported: false, mode: "unavailable", terrainOnly: true, approximate: false, rayCount: 0, blockerCoverage: Object.freeze([]), hit: false, desiredDistance: this._gameplayCamera.distance, resolvedDistance: this._gameplayCamera.distance, hitDistance: null, meshKind: null });
      this._gameplayCameraCollisionHold = { active: false, distance: this._gameplayCamera.distance, clearSeconds: 0 };
      this._controlsAttached = false;
      this._highlightedTarget = null;
      this._highlightedMeshes = new Map();
      this._player = {
        x: clamp(this._options.playerX === undefined ? WORLD_HALF : this._options.playerX, 0, WORLD_SIZE),
        z: clamp(this._options.playerZ === undefined ? WORLD_HALF : this._options.playerZ, 0, WORLD_SIZE),
        heading: finite(this._options.heading, 0),
        elevation: finite(this._options.elevation, 0)
      };
      this._playerMotion = { speed: 0, distance: 0, sampledAt: now() };
      this._lastEnvironmentInteraction = { x: this._player.x, z: this._player.z, at: 0 };
      this._environment = {
        hour: clamp(this._options.timeOfDay === undefined ? 10.5 : this._options.timeOfDay, 0, 24),
        weather: "clear",
        fog: null,
        dayCycleMinutes: clamp(this._options.dayCycleMinutes || 0, 0, 1440)
      };
      this._qualityRequested = normalizePreset(this._options.qualityPreset || this._options.quality, "balanced");
      this._qualityPreset = this._qualityRequested;
      this._reducedMotionMode = this._options.reducedMotion === undefined ? "auto" : this._options.reducedMotion;
      this._reducedMotion = false;
      this._pausedByVisibility = false;
      this._pauseRequested = false;
      this._generation = 0;
      this._startPromise = null;
      this._cleanupCallbacks = [];
      this._resizeObserver = null;
      this._renderFrame = this._renderFrame.bind(this);
      this._lastFrameAt = 0;
      this._lastTelemetryAt = 0;
      this._lastFrameDrawCalls = 0;
      this._drawCallsMeasured = false;
      this._webgpuDevice = null;
      this._webgpuErrorHandler = null;
      this._webgpuErrorCount = 0;
      this._webgpuErrorWindowStartedAt = 0;
      this._elapsed = 0;
      this._governor = new AdaptiveQualityGovernor(this, this._options.adaptiveQuality !== false);
      this._capabilities = detectCapabilities({ babylon: this._options.babylon, document: this._options.document });
    }

    get status() { return this._state; }
    get backend() { return this._backend; }
    get canvas() { return this._canvas; }
    get scene() { return this._scene; }
    get engine() { return this._engine; }
    get failureReason() { return this._failureReason; }
    get capabilities() { return this._capabilities; }
    get qualityPreset() { return this._qualityPreset; }
    get reducedMotion() { return this._reducedMotion; }

    _emitStatus(extra = {}) {
      const detail = freezeRecord({
        status: this._state,
        backend: this._backend,
        qualityPreset: this._qualityPreset,
        reducedMotion: this._reducedMotion,
        reason: this._failureReason,
        ...extra
      });
      safeCall(this._options.onStatus, detail);
      const target = this._canvas || this._container;
      if (target && typeof target.dispatchEvent === "function" && typeof runtime.CustomEvent === "function") {
        try { target.dispatchEvent(new runtime.CustomEvent("hh:eonwild-renderer-status", { detail })); } catch { /* Optional DOM integration. */ }
      }
    }

    _fail(reason) {
      this._failureReason = reason;
      this._state = "failed";
      if (this._canvas && this._canvasCommitted && this._manageCanvasVisibility) this._canvas.hidden = true;
      this._emitStatus({ fallback: "canvas2d" });
      return makeResult(false, { status: this._state, reason });
    }

    _resolveMount(options) {
      const documentRef = options.document || runtime.document;
      let canvas = options.canvas || null;
      let container = options.container || options.mount || null;
      if (typeof canvas === "string" && documentRef && typeof documentRef.querySelector === "function") canvas = documentRef.querySelector(canvas);
      if (typeof container === "string" && documentRef && typeof documentRef.querySelector === "function") container = documentRef.querySelector(container);
      if (!container && canvas && canvas.parentElement) container = canvas.parentElement;
      if (!canvas) {
        if (!documentRef || typeof documentRef.createElement !== "function") {
          return { reason: makeReason("DOM_UNAVAILABLE", "A DOM canvas is required for the optional 3D renderer.", "mount", {}, true) };
        }
        if (!container || typeof container.appendChild !== "function") {
          return { reason: makeReason("MOUNT_TARGET_MISSING", "Pass a container (or a dedicated canvas) before starting 3D mode.", "mount", {}, true) };
        }
        canvas = documentRef.createElement("canvas");
        this._ownsCanvas = true;
      }
      if (!canvas || typeof canvas.getContext !== "function") {
        return { reason: makeReason("CANVAS_INVALID", "The configured 3D canvas is not a usable HTML canvas.", "mount", {}, true) };
      }
      return { canvas, container, documentRef };
    }

    async start(startOptions = {}) {
      if (this._state === "disposed") return makeResult(false, { status: this._state, reason: makeReason("ADAPTER_DISPOSED", "A disposed renderer cannot be restarted.", "lifecycle", {}, false) });
      if (this._state === "running" || this._state === "paused") return makeResult(true, { status: this._state, backend: this._backend, qualityPreset: this._qualityPreset });
      if (this._startPromise) return this._startPromise;
      if (this._state === "failed") {
        this._teardownGraphics();
        this._restoreCanvasPresentation();
        this._releaseOwnedCanvas();
        this._canvas = null;
      }
      const input = startOptions && typeof startOptions === "object" ? startOptions : {};
      const options = { ...this._options, ...input };
      const generation = ++this._generation;
      this._state = "starting";
      this._failureReason = null;
      this._attempts = [];
      this._emitStatus();
      if (startupCancelled(options)) return this._fail(makeReason("RENDER_START_CANCELLED", "3D startup was cancelled.", "lifecycle", {}, true));
      this._startPromise = this._startInternal(options, generation).finally(() => { this._startPromise = null; });
      return this._startPromise;
    }

    async _startInternal(options, generation) {
      const mount = this._resolveMount(options);
      if (mount.reason) return this._fail(mount.reason);
      this._canvas = mount.canvas;
      this._container = mount.container;
      this._manageCanvasVisibility = options.manageCanvasVisibility !== false;
      this._manageCanvasStyle = options.manageCanvasStyle !== false;
      this._canvasCommitted = false;
      this._canvasStyleSnapshot = !this._ownsCanvas && this._canvas.style ? {
        width: this._canvas.style.width,
        height: this._canvas.style.height,
        display: this._canvas.style.display,
        touchAction: this._canvas.style.touchAction
      } : null;
      if (this._ownsCanvas) {
        this._canvas.hidden = true;
        this._canvas.className = options.canvasClassName || "hwe-render-surface hwe-render-surface--3d hwe-3d-canvas";
        this._canvas.setAttribute("data-hwe-3d-canvas", "");
        this._canvas.setAttribute("data-hwe-canvas-3d", "");
        this._canvas.setAttribute("aria-label", options.canvasLabel || "Thế giới 3D HH EonWild");
        this._canvas.setAttribute("role", "img");
        this._canvas.tabIndex = 0;
        this._canvas.style.width = "100%";
        this._canvas.style.height = "100%";
        this._canvas.style.display = "block";
        this._canvas.style.touchAction = "none";
      }

      let B;
      try {
        B = await loadBabylon({ ...options, document: mount.documentRef });
      } catch (error) {
        if (generation !== this._generation || this._state === "disposed") return makeResult(false, { status: this._state, reason: makeReason("START_CANCELLED", "3D startup was cancelled.", "lifecycle", {}, true) });
        this._releaseOwnedCanvas();
        return this._fail(makeReason("BABYLON_LOAD_FAILED", "Babylon.js was unavailable; 2D mode remains active.", "dependency", {
          error: compactError(error),
          failures: Array.isArray(error && error.failures) ? error.failures.slice(0, MAX_LOADER_URLS) : []
        }, true));
      }
      if (generation !== this._generation || this._state === "disposed") return makeResult(false, { status: this._state, reason: makeReason("START_CANCELLED", "3D startup was cancelled.", "lifecycle", {}, true) });
      if (!validateBabylonNamespace(B)) {
        this._releaseOwnedCanvas();
        return this._fail(makeReason("BABYLON_API_INCOMPLETE", "The loaded Babylon build does not contain the core scene APIs EonWild needs.", "dependency", {}, true));
      }

      this._Babylon = B;
      this._capabilities = detectCapabilities({ babylon: B, document: mount.documentRef });
      try {
        // Prime the backing store before WebGPU creates its swap chain. A
        // canvas without explicit dimensions starts at 300x150; resizing that
        // swap chain immediately after init can invalidate Chromium's first
        // D3D shared texture. Match Babylon's intended hardware scale up front
        // so the warm-up frame does not race a backing-store replacement.
        const startupScale = QUALITY_PRESETS[this._qualityPreset].renderScale;
        const cssWidth = Math.max(1, Math.round(this._canvas.clientWidth || this._container?.clientWidth || this._canvas.width || 1));
        const cssHeight = Math.max(1, Math.round(this._canvas.clientHeight || this._container?.clientHeight || this._canvas.height || 1));
        const backingWidth = Math.max(1, Math.round(cssWidth * startupScale));
        const backingHeight = Math.max(1, Math.round(cssHeight * startupScale));
        if (this._canvas.width !== backingWidth) this._canvas.width = backingWidth;
        if (this._canvas.height !== backingHeight) this._canvas.height = backingHeight;
        const created = await createBabylonEngine(B, this._canvas, this._capabilities, options);
        if (generation !== this._generation || this._state === "disposed") {
          safeDispose(created.engine);
          return makeResult(false, { status: this._state, reason: makeReason("START_CANCELLED", "3D startup was cancelled.", "lifecycle", {}, true) });
        }
        if (created.canvas && created.canvas !== this._canvas) this._canvas = created.canvas;
        this._engine = created.engine;
        this._backend = created.backend;
        this._attempts = created.attempts.slice();
        this._installWebGpuDiagnostics();
        this._buildScene(options);
        // Configure the swap-chain size before the first submitted frame. In
        // Chromium/D3D, resizing immediately after scene.render() can destroy
        // the frame's swap-buffer texture while WebGPU is still submitting it.
        // Besides producing a validation warning, affected drivers may show a
        // black first frame. Applying quality and resize first keeps startup
        // atomic and lets WebGL follow the same deterministic warm-up order.
        this._applyQuality(this._qualityPreset, "startup", false);
        if (typeof this._engine.resize === "function") this._engine.resize();
        this._streamer.update(this._player.x, this._player.z, true);
        this._streamer.process(2);
        this._scene.render();

        if (this._ownsCanvas && this._container && !this._canvas.parentNode) this._container.appendChild(this._canvas);
        if (!this._ownsCanvas && this._manageCanvasStyle && this._canvas.style) {
          this._canvas.style.width = "100%";
          this._canvas.style.height = "100%";
          this._canvas.style.display = "block";
          this._canvas.style.touchAction = "none";
        }
        if (this._manageCanvasVisibility) this._canvas.hidden = false;
        this._canvasCommitted = true;
        this._canvas.setAttribute("data-hwe-3d-backend", this._backend);
        this._installRuntimeListeners(mount.documentRef);
        this._state = this._pauseRequested || mount.documentRef && mount.documentRef.hidden ? "paused" : "running";
        this._pausedByVisibility = Boolean(mount.documentRef && mount.documentRef.hidden);
        this._lastFrameAt = now();
        if (this._state === "running") this._engine.runRenderLoop(this._renderFrame);
        this._emitStatus({ attempts: this._attempts.slice() });
        if (this._state === "running") this._scheduleEnvironmentAssetLoad(generation);
        return makeResult(true, {
          status: this._state,
          backend: this._backend,
          qualityPreset: this._qualityPreset,
          canvas: this._canvas,
          capabilities: this._runtimeCapabilities(),
          attempts: this._attempts.slice()
        });
      } catch (error) {
        if (generation !== this._generation || this._state === "disposed") {
          this._teardownGraphics();
          this._releaseOwnedCanvas();
          return makeResult(false, { status: this._state, reason: makeReason("START_CANCELLED", "3D startup was cancelled.", "lifecycle", {}, true) });
        }
        const attempts = Array.isArray(error && error.attempts) ? error.attempts : this._attempts;
        const failureStage = this._scene ? "scene" : "engine";
        const failedBackend = this._backend;
        if (this._canvas && this._canvasCommitted && this._manageCanvasVisibility) this._canvas.hidden = true;
        this._teardownGraphics();
        // A WebGPU engine can initialize successfully and still fail while
        // building or warming the first scene. Reset its bound canvas so the
        // caller can make one clean WebGL retry before falling back to Lite.
        if (failedBackend === "webgpu" && options.allowWebGLFallback !== false) {
          const replacement = replaceCanvasAfterWebGPUFailure(this._canvas, options);
          if (replacement) this._canvas = replacement;
        }
        this._restoreCanvasPresentation();
        this._releaseOwnedCanvas();
        return this._fail(makeReason(error && error.code || "SCENE_START_FAILED", "The 3D scene could not initialize; 2D mode remains active.", failureStage, {
          error: compactError(error), attempts: attempts.slice(0, 4), failedBackend
        }, true));
      }
    }

    _focalLengthFromFov(fovRadians, sensorHeightMm) {
      const sensor = clamp(sensorHeightMm, 8, 70);
      const fov = clamp(fovRadians, 0.08, Math.PI - 0.08);
      return clamp(sensor / (2 * Math.tan(fov / 2)), 8, 600);
    }

    _fovFromFocalLength(focalLengthMm, sensorHeightMm) {
      const focalLength = clamp(focalLengthMm, 8, 600);
      const sensor = clamp(sensorHeightMm, 8, 70);
      return clamp(2 * Math.atan(sensor / (2 * focalLength)), 0.08, Math.PI - 0.08);
    }

    _recordRenderingFeatureFailure(feature, error) {
      const failure = freezeRecord({ feature: String(feature || "unknown"), error: compactError(error) });
      this._postProcessingFailureHistory.push(failure);
      if (this._postProcessingFailureHistory.length > 12) this._postProcessingFailureHistory.shift();
      if (this._postProcessing && Array.isArray(this._postProcessing.failures)) this._postProcessing.failures.push(failure);
      return failure;
    }

    _disposePostProcessing() {
      const pipelines = this._postProcessing;
      if (!pipelines) return;
      // Reverse construction order. TAA was created first and is disposed last
      // so dependent pre-pass/render-target resources cannot outlive it.
      for (const key of ["ssr", "ssao", "defaultPipeline", "taa"]) {
        const pipeline = pipelines[key];
        if (!pipeline) continue;
        safeDispose(pipeline);
        pipelines[key] = null;
      }
      this._postProcessing = null;
    }

    _registerShadowCasters(shadow) {
      if (!shadow || typeof shadow.addShadowCaster !== "function") return;
      const seen = new Set();
      const add = (mesh) => {
        if (!mesh || seen.has(mesh)) return;
        seen.add(mesh);
        try { shadow.addShadowCaster(mesh, false); } catch { /* An optional mesh must not invalidate the shadow map. */ }
      };
      for (const proxy of this._proxies.values()) for (const part of proxy.parts || []) add(part);
      for (const mesh of this._scene?.meshes || []) {
        const kind = String(mesh?.metadata?.kind || "");
        if (["terrain-chunk", "water-proxy", "cc0-hdri-sky"].includes(kind) || mesh?.metadata?.hhEonWildWater) continue;
        // Imported GLB child meshes may not carry metadata, whereas their
        // wrapper does. They are safe bounded assets and should cast shadows.
        add(mesh);
      }
    }

    _registerEnvironmentBlockerMesh(mesh, obstructionKind, source = "mesh") {
      if (!mesh) return false;
      const kind = String(obstructionKind || "environment").toLowerCase();
      mesh.metadata = {
        ...(mesh.metadata || {}),
        eonwild: true,
        cameraObstruction: true,
        cameraObstructionKind: kind,
        cameraObstructionSource: String(source || "mesh")
      };
      mesh.isPickable = true;
      if ("thinInstanceEnablePicking" in mesh) mesh.thinInstanceEnablePicking = true;
      this._environmentBlockerMeshes.add(mesh);
      return true;
    }

    _registerProceduralEnvironmentBlockers() {
      const buckets = this._environmentRenderer?._buckets;
      if (!Array.isArray(buckets)) return 0;
      let count = 0;
      for (const bucket of buckets) {
        const category = String(bucket?.definition?.category || "").toLowerCase();
        if (!CAMERA_BLOCKER_CATEGORIES.has(category) || !bucket?.mesh) continue;
        if (this._registerEnvironmentBlockerMesh(bucket.mesh, category.includes("tree") || category === "sapling" ? "tree" : "wood", "thin-instance-mesh")) count += 1;
      }
      return count;
    }

    _cameraCollisionCapabilities() {
      let environmentMesh = false;
      for (const mesh of this._environmentBlockerMeshes) {
        let disposed = false;
        try { disposed = typeof mesh?.isDisposed === "function" ? mesh.isDisposed() : Boolean(mesh?.disposed); } catch { disposed = true; }
        if (!disposed) { environmentMesh = true; break; }
      }
      const proceduralApproximation = Boolean(this._environmentRenderer?.mode === "babylon-thin-instances" && Array.isArray(this._environmentRenderer._buckets));
      const importedApproximation = Boolean(this._environmentAssets?.entries instanceof Map && this._environmentAssets.entries.size);
      const environmentApproximation = proceduralApproximation || importedApproximation;
      const sceneRaycast = Boolean(this._scene && typeof this._scene.pickWithRay === "function" && this._Babylon && typeof this._Babylon.Ray === "function");
      const creatureMesh = sceneRaycast;
      const blockerCoverage = ["terrain-mesh"];
      if (creatureMesh) blockerCoverage.push("wildlife-creature-mesh");
      if (environmentMesh) blockerCoverage.push("rock-tree-mesh");
      if (environmentApproximation) blockerCoverage.push("rock-tree-sphere-approximation");
      return freezeRecord({
        supported: sceneRaycast,
        sceneRaycast,
        terrain: sceneRaycast,
        creatureMesh,
        environmentMesh,
        environmentApproximation,
        terrainOnly: !creatureMesh && !environmentMesh && !environmentApproximation,
        approximate: environmentApproximation,
        rayCount: sceneRaycast ? CAMERA_COLLISION_RAY_OFFSETS.length : 0,
        blockerCoverage: Object.freeze(blockerCoverage)
      });
    }

    _disposeResourceMarker(entityId) {
      const id = safeEntityId(entityId);
      const marker = id ? this._resourceMarkers.get(id) : null;
      if (!marker) return false;
      if (this._highlightedTarget?.entityId === id) this._clearHighlightedTargetInternal();
      const mesh = marker.mesh;
      if (mesh) {
        try {
          mesh.isPickable = false;
          mesh.metadata = {
            ...(mesh.metadata || {}),
            targetable: false,
            targetId: "",
            entityId: "",
            identityExact: false
          };
        } catch { /* Disposal remains authoritative if metadata is immutable. */ }
        safeDispose(mesh);
      }
      this._resourceMarkers.delete(id);
      return true;
    }

    _resourceMarkerCapabilities() {
      let exactIdentities = 0;
      const activeTypes = new Set();
      for (const [id, marker] of this._resourceMarkers) {
        const metadata = marker?.mesh?.metadata || {};
        const metadataId = exactMetadataEntityId(metadata);
        if (marker?.mesh && metadata.targetable === true && metadataId === id) {
          exactIdentities += 1;
          activeTypes.add(String(metadata.targetType || marker.targetType || "interactive").toLowerCase());
        }
      }
      const markerMeshes = Boolean(this._scene && this._Babylon?.MeshBuilder && typeof this._Babylon?.Vector3 === "function");
      return freezeRecord({
        supported: markerMeshes,
        markerMeshes,
        materials: this._resourceMaterials.size,
        active: this._resourceMarkers.size,
        exactIdentities,
        identityCoverageComplete: exactIdentities === this._resourceMarkers.size,
        exactEntityIdRequired: true,
        maximum: MAX_INTERACTIVE_RESOURCE_MARKERS,
        distance: INTERACTIVE_RESOURCE_DISTANCE,
        supportedTypes: Object.freeze(["food", "water", "nest", "interactive"]),
        activeTypes: Object.freeze(Array.from(activeTypes).sort())
      });
    }

    _syncProxyIdentity(proxy, entityId, isPlayer = false, identityExact = true) {
      if (!proxy) return false;
      const nextId = safeEntityId(entityId);
      const previousId = safeEntityId(proxy.entityId);
      const nextExact = Boolean(nextId && identityExact);
      const changed = previousId !== nextId || proxy.identityExact !== nextExact || proxy.isPlayer !== Boolean(isPlayer);
      if (changed) {
        if (this._highlightedTarget && (this._highlightedTarget.entityId === previousId || this._highlightedTarget.speciesId === proxy.id)) this._clearHighlightedTargetInternal();
        if (previousId && this._proxyByEntityId.get(previousId) === proxy) this._proxyByEntityId.delete(previousId);
        const occupied = nextId ? this._proxyByEntityId.get(nextId) : null;
        if (occupied && occupied !== proxy) this._syncProxyIdentity(occupied, "", occupied.isPlayer === true, false);
        if (nextId) this._disposeResourceMarker(nextId);
      }
      proxy.entityId = nextId;
      proxy.identityExact = nextExact;
      proxy.isPlayer = Boolean(isPlayer);
      if (nextId) this._proxyByEntityId.set(nextId, proxy);
      const apply = (node) => {
        if (!node) return;
        node.metadata = {
          ...(node.metadata || {}),
          targetType: "animal",
          targetable: true,
          speciesId: proxy.id,
          targetId: nextId,
          entityId: nextId,
          identityExact: proxy.identityExact,
          isPlayer: proxy.isPlayer
        };
      };
      apply(proxy.root);
      const meshes = new Set(proxy.parts || []);
      try { for (const mesh of proxy.root?.getChildMeshes?.(false) || []) meshes.add(mesh); } catch { /* Procedural parts remain authoritative. */ }
      for (const mesh of meshes) apply(mesh);
      return true;
    }

    _resourceTargetType(type) {
      const value = String(type || "").toLowerCase();
      if (value === "water") return "water";
      if (value === "shelter" || value === "nest") return "nest";
      if (value === "plant" || value === "carcass" || value === "food") return "food";
      return "interactive";
    }

    _resourceMaterial(type) {
      const key = this._resourceTargetType(type);
      if (this._resourceMaterials.has(key)) return this._resourceMaterials.get(key);
      const B = this._Babylon;
      if (!B || !this._scene || typeof B.StandardMaterial !== "function" || typeof B.Color3 !== "function") return null;
      const colors = {
        water: [.18, .72, .98],
        food: [.48, .86, .32],
        nest: [.84, .62, .3],
        interactive: [.78, .48, .72]
      };
      const color = colors[key] || colors.interactive;
      const material = new B.StandardMaterial(`hwe3d-resource-${key}`, this._scene);
      material.diffuseColor = new B.Color3(color[0], color[1], color[2]);
      material.emissiveColor = new B.Color3(color[0] * .22, color[1] * .22, color[2] * .22);
      material.roughness = .82;
      material.metallic = 0;
      material.alpha = key === "water" ? .82 : 1;
      this._resourceMaterials.set(key, material);
      return material;
    }

    _createResourceMarker(resource, targetType) {
      const B = this._Babylon;
      if (!B?.MeshBuilder || !this._scene) return null;
      const id = safeEntityId(resource?.id);
      if (!id) return null;
      let mesh = null;
      try {
        if (targetType === "water") mesh = B.MeshBuilder.CreateCylinder(`hwe3d-resource-${id}`, { height: .12, diameter: 2.4, tessellation: 16 }, this._scene);
        else if (targetType === "nest") mesh = B.MeshBuilder.CreateCylinder(`hwe3d-resource-${id}`, { height: .42, diameterTop: 1.35, diameterBottom: 2.1, tessellation: 12 }, this._scene);
        else mesh = B.MeshBuilder.CreateSphere(`hwe3d-resource-${id}`, { diameter: targetType === "food" ? .82 : .72, segments: 8 }, this._scene);
      } catch { return null; }
      mesh.material = this._resourceMaterial(targetType);
      mesh.isPickable = true;
      mesh.checkCollisions = false;
      mesh.metadata = { eonwild: true, kind: "interactive-resource-marker", targetType, targetable: true, targetId: id, entityId: id, identityExact: true, isPlayer: false, resourceType: String(resource?.type || "interactive").slice(0, 24) };
      return { id, targetType, resourceType: String(resource?.type || "interactive"), mesh };
    }

    syncResources(resources = []) {
      if (!Array.isArray(resources) || !this._scene || !this._Babylon) return makeResult(false, { reason: makeReason("RESOURCE_MARKERS_UNAVAILABLE", "The active renderer cannot create world resource markers.", "target", {}, true) });
      const candidates = [];
      const maximumDistanceSquared = INTERACTIVE_RESOURCE_DISTANCE * INTERACTIVE_RESOURCE_DISTANCE;
      for (const resource of resources) {
        const id = safeEntityId(resource?.id);
        const worldX = finite(resource?.x, NaN);
        const worldZ = finite(resource?.z ?? resource?.y, NaN);
        if (!id || this._proxyByEntityId.has(id) || !Number.isFinite(worldX) || !Number.isFinite(worldZ) || finite(resource?.amount, 0) <= 0) continue;
        const distanceSquared = (worldX - this._player.x) ** 2 + (worldZ - this._player.z) ** 2;
        if (distanceSquared > maximumDistanceSquared) continue;
        candidates.push({ resource, id, worldX, worldZ, distanceSquared });
      }
      candidates.sort((left, right) => left.distanceSquared - right.distanceSquared || left.id.localeCompare(right.id));
      const wanted = new Set();
      for (const candidate of candidates.slice(0, MAX_INTERACTIVE_RESOURCE_MARKERS)) {
        const targetType = this._resourceTargetType(candidate.resource.type);
        let marker = this._resourceMarkers.get(candidate.id);
        if (!marker || marker.targetType !== targetType) {
          if (marker) this._disposeResourceMarker(candidate.id);
          marker = this._createResourceMarker(candidate.resource, targetType);
          if (!marker) continue;
          this._resourceMarkers.set(candidate.id, marker);
        }
        wanted.add(candidate.id);
        const ground = terrainSampleFromProvider(this._landscape, candidate.worldX, candidate.worldZ, this._streamer ? this._streamer.seed : hashSeed(this._options.seed)).height;
        const water = targetType === "water" ? queryLandscapeWater(this._landscape, candidate.worldX, candidate.worldZ, { lakes: this._proceduralLakes, seed: this._options.seed }) : null;
        const height = water?.surfaceHeight ?? (ground + (targetType === "nest" ? .24 : targetType === "water" ? .08 : .45));
        marker.mesh.position = new this._Babylon.Vector3(candidate.worldX - WORLD_HALF, height, candidate.worldZ - WORLD_HALF);
        marker.mesh.metadata = { ...(marker.mesh.metadata || {}), targetType, targetable: true, targetId: candidate.id, entityId: candidate.id, identityExact: true, resourceType: String(candidate.resource.type || "interactive").slice(0, 24) };
        try { marker.mesh.setEnabled(true); } catch { marker.mesh.isVisible = true; }
      }
      for (const [id] of this._resourceMarkers) {
        if (wanted.has(id)) continue;
        this._disposeResourceMarker(id);
      }
      return makeResult(true, { visible: this._resourceMarkers.size, maximum: MAX_INTERACTIVE_RESOURCE_MARKERS, distance: INTERACTIVE_RESOURCE_DISTANCE });
    }

    getEnvironmentCollisionPlacements(options = {}) {
      const x = finite(options.x, this._player.x);
      const z = finite(options.z ?? options.y, this._player.z);
      const manager = this._environmentAssets;
      const imported = manager && typeof manager.getCollisionPlacements === "function"
        ? manager.getCollisionPlacements(x, z, options.force === true)
        : freezeRecord({ supported: false, cellKey: "", placements: Object.freeze([]), visible: 0 });
      const procedural = this._environmentRenderer && typeof this._environmentRenderer.getCollisionSnapshot === "function"
        ? this._environmentRenderer.getCollisionSnapshot({ x, z, radius: options.radius, budget: options.budget })
        : freezeRecord({ supported: false, cellKey: "", revision: 0, digest: "", colliders: Object.freeze([]), truncated: false });
      const placements = Object.freeze([
        ...(Array.isArray(procedural.colliders) ? procedural.colliders : []),
        ...(Array.isArray(imported.placements) ? imported.placements : [])
      ]);
      let importedDigestA = hashSeed(`imported-collision-a:${imported.cellKey || ""}`);
      let importedDigestB = hashSeed(`imported-collision-b:${imported.cellKey || ""}`);
      for (const placement of Array.isArray(imported.placements) ? imported.placements : []) {
        const token = `${safeEntityId(placement?.id)}:${String(placement?.assetId || "")}:${Math.round(finite(placement?.x) * 1000)}:${Math.round(finite(placement?.y) * 1000)}:${Math.round(finite(placement?.z) * 1000)}:${Math.round(finite(placement?.scale, 1) * 1000)}`;
        importedDigestA = hashSeed(`${importedDigestA}:${token}`);
        importedDigestB = hashSeed(`${importedDigestB}:${token}:${importedDigestA}`);
      }
      const importedDigest = `${imported.placements?.length || 0}:${importedDigestA.toString(16)}:${importedDigestB.toString(16)}`;
      const combinedDigestA = hashSeed(`combined-a:${procedural.digest || ""}:${importedDigest}`);
      const combinedDigestB = hashSeed(`combined-b:${importedDigest}:${procedural.digest || ""}`);
      const digest = `v2:${placements.length}:${combinedDigestA.toString(16)}:${combinedDigestB.toString(16)}`;
      return freezeRecord({
        supported: procedural.supported === true || imported.supported === true,
        format: "hh-eonwild-renderer-colliders-v2",
        cellKey: `procedural:${procedural.cellKey || "none"}|imported:${imported.cellKey || "none"}`,
        revision: `${Math.max(0, Math.trunc(finite(procedural.revision)))}:${digest}`,
        digest,
        placements,
        visible: placements.length,
        procedural: Array.isArray(procedural.colliders) ? procedural.colliders.length : 0,
        imported: Array.isArray(imported.placements) ? imported.placements.length : 0,
        truncated: procedural.truncated === true
      });
    }

    planProceduralLakes(options = {}) {
      const descriptor = options && typeof options === "object" ? options : {};
      const landscape = descriptor.landscape || this._landscape;
      const lakes = planProceduralLakes(landscape, finite(descriptor.x, this._player.x), finite(descriptor.z ?? descriptor.y, this._player.z));
      if (descriptor.commit === true) this._proceduralLakes = lakes;
      return lakes;
    }

    queryLandscapeWater(options = {}) {
      const x = finite(options.x, this._player.x);
      const z = finite(options.z ?? options.y, this._player.z);
      return queryLandscapeWater(this._landscape, x, z, { lakes: this._proceduralLakes, seed: this._options.seed });
    }

    queryWorldWater(options = {}) { return this.queryLandscapeWater(options); }

    _queryEnvironmentBlockerDistance(ray, maximumDistance) {
      if (!ray?.origin || !ray?.direction) return freezeRecord({ hit: false, distance: null, kind: null, tested: 0, approximate: false });
      const limit = Math.max(0, finite(maximumDistance, 0));
      let bestDistance = null;
      let bestKind = null;
      let tested = 0;
      const center = { x: 0, y: 0, z: 0 };
      const testSphere = (x, y, z, radius, kind) => {
        if (tested >= 4096) return;
        const boundedRadius = Math.max(0.05, finite(radius, 0.05));
        if (Math.hypot(finite(x) - finite(ray.origin.x), finite(z) - finite(ray.origin.z)) > limit + boundedRadius) return;
        tested += 1;
        center.x = finite(x); center.y = finite(y); center.z = finite(z);
        const distance = raySphereIntersectionDistance(ray.origin, ray.direction, center, boundedRadius, limit);
        if (distance !== null && (bestDistance === null || distance < bestDistance)) { bestDistance = distance; bestKind = kind; }
      };

      const entries = this._environmentAssets?.entries;
      if (entries instanceof Map) {
        for (const entry of entries.values()) {
          const assetId = String(entry?.definition?.id || "").toLowerCase();
          if (assetId !== "rock" && assetId !== "quiver") continue;
          for (const instance of entry.instances || []) {
            const placement = instance?.placement;
            if (!placement) continue;
            const x = finite(placement.x) - WORLD_HALF; const y = finite(placement.y); const z = finite(placement.z) - WORLD_HALF;
            const scale = Math.max(0.1, finite(placement.scale, 1));
            if (assetId === "rock") testSphere(x, y + scale * 0.7, z, scale * 1.15, "rock-sphere");
            else {
              for (const height of [0.35, 0.75, 1.15]) testSphere(x, y + scale * height, z, scale * 0.22, "tree-trunk-sphere");
              testSphere(x, y + scale * 1.35, z, scale * 0.55, "tree-canopy-sphere");
            }
          }
        }
      }

      const buckets = this._environmentRenderer?.mode === "babylon-thin-instances" ? this._environmentRenderer._buckets : null;
      if (Array.isArray(buckets)) {
        for (const bucket of buckets) {
          const category = String(bucket?.definition?.category || "").toLowerCase();
          if (!CAMERA_BLOCKER_CATEGORIES.has(category)) continue;
          const matrices = bucket?.matrices;
          const count = Math.min(Math.max(0, Math.trunc(finite(bucket?.count, 0))), matrices ? Math.floor(matrices.length / 16) : 0);
          for (let index = 0; index < count && tested < 4096; index += 1) {
            const offset = index * 16;
            const x = finite(matrices[offset + 12]); const y = finite(matrices[offset + 13]); const z = finite(matrices[offset + 14]);
            const scale = Math.max(
              0.05,
              Math.hypot(finite(matrices[offset]), finite(matrices[offset + 2])),
              Math.abs(finite(matrices[offset + 5])),
              Math.hypot(finite(matrices[offset + 8]), finite(matrices[offset + 10]))
            );
            if (category === "mature-tree") {
              for (const height of [0.55, 1.55, 2.55, 3.55, 4.55, 5.55]) testSphere(x, y + scale * height, z, scale * 0.58, "tree-trunk-sphere");
              testSphere(x, y + scale * 6.5, z, scale * 2.4, "tree-canopy-sphere");
            } else if (category === "dead-tree") {
              for (const height of [0.55, 1.55, 2.55, 3.55, 4.55]) testSphere(x, y + scale * height, z, scale * 0.52, "tree-trunk-sphere");
            }
            else if (category === "sapling") {
              for (const height of [0.45, 1.15, 1.85]) testSphere(x, y + scale * height, z, scale * 0.38, "tree-trunk-sphere");
              testSphere(x, y + scale * 2.8, z, scale * 1.05, "tree-canopy-sphere");
            } else testSphere(x, y + scale * 0.35, z, scale * (category === "log" ? 2.1 : 1.15), "wood-sphere");
          }
        }
      }
      return freezeRecord({ hit: bestDistance !== null, distance: bestDistance, kind: bestKind, tested, approximate: tested > 0 });
    }

    _createShadowGenerator(presetId) {
      if (!this._lights?.sun || !this._Babylon) return null;
      safeDispose(this._lights.shadow);
      this._lights.shadow = null;
      this._lights.shadowKind = "none";
      const B = this._Babylon;
      const cinematic = presetId === CINEMATIC_PRESET && !this._reducedMotion;
      let shadow = null;
      if (cinematic && this._backend !== "webgl1" && typeof B.CascadedShadowGenerator === "function") {
        try {
          const supported = B.CascadedShadowGenerator.IsSupported !== false;
          if (supported) {
            shadow = new B.CascadedShadowGenerator(2048, this._lights.sun);
            shadow.numCascades = 4;
            shadow.lambda = 0.76;
            shadow.cascadeBlendPercentage = 0.12;
            shadow.stabilizeCascades = true;
            shadow.autoCalcDepthBounds = true;
            shadow.shadowMaxZ = Math.min(1200, QUALITY_PRESETS[presetId].farClip);
            shadow.bias = 0.00045;
            shadow.normalBias = 0.018;
            if (B.ShadowGenerator?.QUALITY_HIGH !== undefined) shadow.filteringQuality = B.ShadowGenerator.QUALITY_HIGH;
            this._lights.shadowKind = "cascaded-pcf";
          }
        } catch (error) {
          safeDispose(shadow);
          shadow = null;
          this._recordRenderingFeatureFailure("cascaded-shadows", error);
        }
      }
      if (!shadow && typeof B.ShadowGenerator === "function") {
        try {
          const shadowSize = cinematic ? 2048 : ["high", "ultra"].includes(presetId) ? 1024 : 512;
          shadow = new B.ShadowGenerator(shadowSize, this._lights.sun);
          shadow.useBlurExponentialShadowMap = true;
          shadow.blurKernel = cinematic ? 32 : presetId === "ultra" ? 24 : 12;
          shadow.bias = cinematic ? 0.0005 : 0.0008;
          shadow.normalBias = cinematic ? 0.018 : 0.025;
          this._lights.shadowKind = cinematic ? "blurred-fallback" : "blurred";
        } catch (error) {
          safeDispose(shadow);
          shadow = null;
          this._recordRenderingFeatureFailure("standard-shadows", error);
        }
      }
      this._lights.shadow = shadow;
      this._registerShadowCasters(shadow);
      return shadow;
    }

    _buildCinematicPostProcessing(presetId) {
      this._disposePostProcessing();
      const state = {
        preset: presetId,
        requested: presetId === CINEMATIC_PRESET,
        supportedBackend: this._backend === "webgpu" || this._backend === "webgl2",
        taa: null,
        defaultPipeline: null,
        ssao: null,
        ssr: null,
        active: [],
        failures: []
      };
      this._postProcessing = state;
      if (!state.requested || !state.supportedBackend || this._reducedMotion || !this._scene || !this._camera) return state;
      const B = this._Babylon;
      const cameras = [this._camera];

      // TAA must be constructed before DefaultRenderingPipeline, SSAO2 and
      // SSR. Do not reorder these guarded blocks.
      if (typeof B.TAARenderingPipeline === "function") {
        try {
          const taa = new B.TAARenderingPipeline("hwe3d-cinematic-taa", this._scene, cameras);
          if (taa.isSupported === false) throw new Error("Babylon TAA is unsupported by the active graphics backend.");
          taa.samples = 16;
          taa.msaaSamples = 1;
          taa.factor = 0.06;
          taa.disableOnCameraMove = true;
          taa.isEnabled = true;
          state.taa = taa;
          state.active.push("taa");
        } catch (error) {
          safeDispose(state.taa);
          state.taa = null;
          this._recordRenderingFeatureFailure("taa", error);
        }
      }

      if (typeof B.DefaultRenderingPipeline === "function") {
        let pipeline = null;
        try {
          pipeline = new B.DefaultRenderingPipeline("hwe3d-cinematic-default", true, this._scene, cameras, false);
          pipeline.samples = 1;
          pipeline.fxaaEnabled = !state.taa;
          pipeline.sharpenEnabled = true;
          pipeline.bloomEnabled = true;
          pipeline.bloomThreshold = 0.92;
          pipeline.bloomWeight = 0.12;
          pipeline.bloomKernel = 48;
          pipeline.bloomScale = 0.5;
          pipeline.grainEnabled = true;
          pipeline.chromaticAberrationEnabled = false;
          pipeline.depthOfFieldEnabled = false;
          if (typeof pipeline.prepare === "function") pipeline.prepare();
          if (pipeline.sharpen) {
            pipeline.sharpen.edgeAmount = 0.18;
            pipeline.sharpen.colorAmount = 1;
          }
          if (pipeline.grain) {
            pipeline.grain.intensity = 5;
            pipeline.grain.animated = false;
          }
          state.defaultPipeline = pipeline;
          state.active.push("aces-bloom-sharpen-grain");
        } catch (error) {
          safeDispose(pipeline);
          state.defaultPipeline = null;
          this._recordRenderingFeatureFailure("default-post-processing", error);
        }
      }

      if (typeof B.SSAO2RenderingPipeline === "function") {
        let ssao = null;
        try {
          ssao = new B.SSAO2RenderingPipeline("hwe3d-cinematic-ssao2", this._scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, cameras);
          if (ssao.isSupported === false) throw new Error("Babylon SSAO2 is unsupported by the active graphics backend.");
          ssao.totalStrength = 0.72;
          ssao.base = 0.08;
          ssao.radius = 1.8;
          ssao.maxZ = Math.min(300, this._camera.maxZ);
          ssao.samples = 16;
          ssao.textureSamples = 1;
          ssao.expensiveBlur = true;
          state.ssao = ssao;
          state.active.push("ssao2");
        } catch (error) {
          safeDispose(ssao);
          state.ssao = null;
          this._recordRenderingFeatureFailure("ssao2", error);
        }
      }

      if (typeof B.SSRRenderingPipeline === "function") {
        let ssr = null;
        try {
          ssr = new B.SSRRenderingPipeline("hwe3d-cinematic-ssr", this._scene, cameras);
          if (ssr.isSupported === false) throw new Error("Babylon SSR is unsupported by the active graphics backend.");
          ssr.maxDistance = 140;
          ssr.step = 1;
          ssr.thickness = 0.45;
          ssr.strength = 0.42;
          ssr.maxSteps = 72;
          ssr.roughnessFactor = 0.22;
          ssr.reflectivityThreshold = 0.055;
          ssr.reflectionSpecularFalloffExponent = 2.2;
          ssr.enableSmoothReflections = true;
          ssr.attenuateScreenBorders = true;
          ssr.attenuateIntersectionDistance = true;
          ssr.samples = 1;
          state.ssr = ssr;
          state.active.push("ssr");
        } catch (error) {
          safeDispose(ssr);
          state.ssr = null;
          this._recordRenderingFeatureFailure("ssr", error);
        }
      }
      this._applyPhysicalDepthOfField();
      return state;
    }

    _rebuildRenderingFeatures(presetId, force = false) {
      if (!this._scene || !this._Babylon || !this._lights) return;
      if (!force && this._renderFeaturePreset === presetId) return;
      this._renderFeaturePreset = presetId;
      this._createShadowGenerator(presetId);
      this._buildCinematicPostProcessing(presetId);
    }

    _effectiveFocusDistanceM() {
      if (!this._photoSettings.autofocus) return this._photoSettings.focusDistanceM;
      const proxy = this._proxies.get(this._playerSpeciesId);
      const cameraPosition = this._camera?.position;
      const subjectPosition = proxy?.root?.position;
      if (!cameraPosition || !subjectPosition) return this._photoSettings.focusDistanceM;
      const dx = finite(cameraPosition.x) - finite(subjectPosition.x);
      const dy = finite(cameraPosition.y) - finite(subjectPosition.y);
      const dz = finite(cameraPosition.z) - finite(subjectPosition.z);
      return clamp(Math.hypot(dx, dy, dz), 0.25, 10000);
    }

    _applyPhysicalDepthOfField() {
      const pipeline = this._postProcessing?.defaultPipeline;
      if (!pipeline) return false;
      const enabled = Boolean(this._photoSettings.depthOfField && this._qualityPreset === CINEMATIC_PRESET && !this._reducedMotion);
      try {
        if (this._Babylon?.DepthOfFieldEffectBlurLevel?.Medium !== undefined) pipeline.depthOfFieldBlurLevel = this._Babylon.DepthOfFieldEffectBlurLevel.Medium;
        pipeline.depthOfFieldEnabled = enabled;
        if (enabled && pipeline.depthOfField) {
          pipeline.depthOfField.focalLength = this._photoSettings.focalLengthMm;
          pipeline.depthOfField.fStop = this._photoSettings.apertureFStop;
          // Babylon's physical DOF values are millimetres; EonWild exposes
          // focus distance in world metres for a photographer-friendly API.
          pipeline.depthOfField.focusDistance = this._effectiveFocusDistanceM() * 1000;
        }
        return enabled;
      } catch (error) {
        try { pipeline.depthOfFieldEnabled = false; } catch { /* Keep the rest of the pipeline alive. */ }
        this._recordRenderingFeatureFailure("depth-of-field", error);
        return false;
      }
    }

    _buildScene(options) {
      const B = this._Babylon;
      const scene = new B.Scene(this._engine);
      this._scene = scene;
      this._landscape = createProceduralLandscape({ ...options, seed: options.seed || "eonwild-mesozoic" });
      scene.clearColor = new B.Color4(0.08, 0.15, 0.17, 1);
      scene.skipPointerMovePicking = true;
      scene.autoClear = true;
      const imageProcessing = scene.imageProcessingConfiguration;
      if (imageProcessing) {
        imageProcessing.contrast = 1.12;
        imageProcessing.exposure = 1.02;
        imageProcessing.toneMappingEnabled = true;
        if (B.ImageProcessingConfiguration?.TONEMAPPING_ACES !== undefined) imageProcessing.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
      }

      const ambient = new B.HemisphericLight("hwe3d-ambient", new B.Vector3(0, 1, 0), scene);
      ambient.intensity = 0.72;
      ambient.groundColor = makeColor3(B, READABILITY_FLOORS.hemisphereGround);
      // StandardMaterial uses scene ambient light as its indirect repository
      // fallback. A non-black value keeps valleys readable before the verified
      // HDR environment has loaded, without making vegetation self-emissive.
      scene.ambientColor = makeColor3(B, READABILITY_FLOORS.sceneAmbient);
      const sun = new B.DirectionalLight("hwe3d-sun", new B.Vector3(-0.45, -0.78, 0.35), scene);
      sun.intensity = 1.05;
      sun.position = new B.Vector3(180, 280, -120);
      this._lights = { ambient, sun, shadow: null, shadowKind: "none" };

      const targetHeight = terrainSampleFromProvider(this._landscape, this._player.x, this._player.z, hashSeed(options.seed)).height;
      const target = new B.Vector3(this._player.x - WORLD_HALF, targetHeight + 3, this._player.z - WORLD_HALF);
      const camera = new B.ArcRotateCamera("hwe3d-third-person-camera", -Math.PI / 2.2, 1.08, 27, target, scene);
      camera.lowerRadiusLimit = 10;
      camera.upperRadiusLimit = 72;
      camera.lowerBetaLimit = 0.45;
      camera.upperBetaLimit = 1.48;
      camera.wheelPrecision = 28;
      camera.panningSensibility = 0;
      camera.minZ = 0.15;
      camera.maxZ = QUALITY_PRESETS[this._qualityPreset].farClip;
      camera.inertia = 0.72;
      // Gameplay input is route-owned. Babylon controls are now an explicit
      // opt-in for isolated renderer demos and are detached as soon as the
      // public gameplay-camera contract becomes active.
      if (options.controls === true && !this._gameplayCamera.active && typeof camera.attachControl === "function") {
        camera.attachControl(this._canvas, true);
        this._controlsAttached = true;
      }
      scene.activeCamera = camera;
      this._camera = camera;
      this._gameplayCameraApplied = {
        yaw: wrapAngle(-finite(camera.alpha, -Math.PI / 2) - Math.PI / 2),
        pitch: clamp(finite(camera.beta, Math.PI / 2) - Math.PI / 2, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05),
        distance: finite(camera.radius, 27),
        collisionDistance: finite(camera.radius, 27)
      };
      this._photoSettings = {
        ...DEFAULT_PHOTO_SETTINGS,
        focalLengthMm: this._focalLengthFromFov(camera.fov, DEFAULT_PHOTO_SETTINGS.sensorHeightMm),
        focusDistanceM: finite(camera.radius, DEFAULT_PHOTO_SETTINGS.focusDistanceM)
      };
      // Babylon's TAA pipeline must be attached before every other
      // post-process pipeline. The feature builder preserves that order and
      // treats every cinematic effect as optional so WebGL2 can fail open.
      this._rebuildRenderingFeatures(this._qualityPreset, true);
      const shadow = this._lights.shadow;

      const oceanAssets = Array.isArray(options.cinematicOceanAssets) ? options.cinematicOceanAssets : [];
      const hasVerifiedWaterPbrInput = oceanAssets.length > 0 || Boolean(scene.environmentTexture);
      const waterMaterial = hasVerifiedWaterPbrInput && typeof B.PBRMaterial === "function"
        ? new B.PBRMaterial("hwe3d-water-pbr-material", scene)
        : new B.StandardMaterial("hwe3d-water-material", scene);
      const personalOceanNormal = oceanAssets.find((asset) => asset?.channel === "normal");
      const personalOceanFoam = oceanAssets.find((asset) => asset?.channel === "foam");
      const waterNormalTexture = createRuntimeTexture(B, scene, personalOceanNormal, options.document || runtime.document, { uScale: 68, vScale: 68, anisotropy: 12 })
        || createWaterNormalTexture(B, scene);
      const waterFoamTexture = createRuntimeTexture(B, scene, personalOceanFoam, options.document || runtime.document, { uScale: 18, vScale: 18, anisotropy: 8 });
      if ("albedoColor" in waterMaterial) {
        waterMaterial.albedoColor = new B.Color3(0.028, 0.21, 0.285);
        waterMaterial.emissiveColor = new B.Color3(0.004, 0.025, 0.035);
        waterMaterial.metallic = 0.03;
        waterMaterial.roughness = 0.11;
        waterMaterial.environmentIntensity = 1.08;
        waterMaterial.indexOfRefraction = 1.333;
        if (waterMaterial.clearCoat) {
          waterMaterial.clearCoat.isEnabled = true;
          waterMaterial.clearCoat.intensity = 0.52;
          waterMaterial.clearCoat.roughness = 0.08;
        }
      } else {
        waterMaterial.diffuseColor = new B.Color3(0.08, 0.35, 0.43);
        waterMaterial.emissiveColor = new B.Color3(0.055, 0.26, 0.32);
        waterMaterial.specularColor = new B.Color3(0.38, 0.55, 0.58);
        if (typeof B.FresnelParameters === "function") {
          waterMaterial.opacityFresnelParameters = new B.FresnelParameters();
          waterMaterial.opacityFresnelParameters.leftColor = new B.Color3(0.25, 0.38, 0.42);
          waterMaterial.opacityFresnelParameters.rightColor = new B.Color3(0.8, 0.92, 1);
          waterMaterial.opacityFresnelParameters.bias = 0.18;
          waterMaterial.opacityFresnelParameters.power = 2.4;
        }
      }
      if (waterNormalTexture) waterMaterial.bumpTexture = waterNormalTexture;
      if (waterFoamTexture && "emissiveTexture" in waterMaterial) {
        waterFoamTexture.level = 0.1;
        waterMaterial.emissiveTexture = waterFoamTexture;
      }
      waterMaterial.alpha = 0.72;
      waterMaterial.backFaceCulling = false;
      const water = B.MeshBuilder.CreateGround("hwe3d-water", { width: WORLD_SIZE, height: WORLD_SIZE, subdivisions: 1 }, scene);
      water.position.y = WATER_LEVEL;
      water.material = waterMaterial;
      water.isPickable = false;
      water.metadata = { eonwild: true, kind: "water-proxy", procedural: true };
      // Tide and storm displacement update position.y at runtime, so this
      // shared surface must keep an unfrozen world matrix.
      this._water = { mesh: water, material: waterMaterial, normalTexture: waterNormalTexture, foamTexture: waterFoamTexture };
      this._weatherFx = createWeatherEffects(B, scene);

      this._streamer = new TerrainStreamer(B, scene, { ...options, document: options.document || runtime.document, seed: options.seed || "eonwild-mesozoic", qualityPreset: this._qualityPreset, landscapeCore: this._landscape });
      if (VEGETATION_CORE && typeof VEGETATION_CORE.create === "function") {
        try {
          this._vegetation = VEGETATION_CORE.create({
            Babylon: B,
            scene,
            landscape: this._landscape,
            seed: options.seed || "eonwild-mesozoic",
            worldSize: WORLD_SIZE,
            chunkSize: CHUNK_SIZE,
            waterLevel: WATER_LEVEL,
            quality: this._qualityPreset,
            reducedMotion: this._reducedMotion,
            document: options.document || runtime.document
          });
        } catch (error) { safeCall(options.onTelemetry, { type: "vegetation-fallback", error: compactError(error) }); }
      }
      if (ENVIRONMENT_RENDERER && typeof ENVIRONMENT_RENDERER.create === "function") {
        try {
          const environmentBudget = PROCEDURAL_ENVIRONMENT_BUDGETS[this._qualityPreset];
          this._environmentRenderer = ENVIRONMENT_RENDERER.create({
            BABYLON: B,
            scene,
            landscape: this._landscape,
            vegetationSystem: this._vegetation,
            seed: options.seed || "eonwild-mesozoic",
            chunkSize: CHUNK_SIZE,
            quality: this._qualityPreset,
            playerX: this._player.x,
            playerZ: this._player.z,
            renderOffsetX: -WORLD_HALF,
            renderOffsetZ: -WORLD_HALF,
            maxActiveChunks: environmentBudget.chunks,
            maxActiveInstances: environmentBudget.instances,
            maxInstancesPerChunk: environmentBudget.perChunk
          });
          this._registerProceduralEnvironmentBlockers();
        } catch (error) { safeCall(options.onTelemetry, { type: "environment-renderer-fallback", error: compactError(error) }); }
      }
      if (WATER_WEATHER_CORE && typeof WATER_WEATHER_CORE.create === "function") {
        try {
          this._waterWeather = WATER_WEATHER_CORE.create({
            Babylon: B,
            scene,
            camera: this._camera,
            landscape: this._landscape,
            seed: options.seed || "eonwild-mesozoic",
            worldSize: WORLD_SIZE,
            chunkSize: CHUNK_SIZE,
            waterLevel: WATER_LEVEL,
            quality: this._qualityPreset,
            reducedMotion: this._reducedMotion,
            maxParticles: ENVIRONMENT_BUDGETS[this._qualityPreset].rainParticles
          });
          const riverNetwork = this._landscape?.getRiverNetwork?.();
          if (Array.isArray(riverNetwork) && typeof this._waterWeather.water?.syncRiverNetwork === "function") {
            const renderNetwork = riverNetwork.map((river) => ({
              ...river,
              points: (river.points || []).map((point, index, points) => {
                const next = points[Math.min(points.length - 1, index + 1)] || point;
                const run = Math.max(0.001, Math.hypot(finite(next.x) - finite(point.x), finite(next.z) - finite(point.z)));
                return {
                  ...point,
                  x: finite(point.x) - WORLD_HALF,
                  y: finite(point.bedHeight ?? point.elevation, WATER_LEVEL) + 0.18,
                  z: finite(point.z) - WORLD_HALF,
                  flow: clamp(point.discharge ?? point.flow ?? 0.5, 0.05, 8),
                  slope: clamp((finite(point.bedHeight) - finite(next.bedHeight)) / run, 0, 2)
                };
              })
            }));
            this._waterWeather.water.syncRiverNetwork(renderNetwork);
          }
          if (typeof this._waterWeather.water?.addLake === "function" && this._landscape) {
            this._proceduralLakes = planProceduralLakes(this._landscape, this._player.x, this._player.z);
            for (const lake of this._proceduralLakes) {
              this._waterWeather.water.addLake({
                id: lake.id,
                position: { x: lake.worldX - WORLD_HALF, y: lake.level, z: lake.worldZ - WORLD_HALF },
                level: lake.level,
                width: lake.width,
                length: lake.length,
                depth: lake.depth,
                sediment: lake.sediment,
                clarity: lake.clarity,
                flowSpeed: lake.flowSpeed
              });
            }
          }
        } catch (error) { safeCall(options.onTelemetry, { type: "water-weather-fallback", error: compactError(error) }); }
      }
      this._environmentAssets = new EnvironmentAssetManager(this, B, scene, { ...options, document: options.document || runtime.document, qualityPreset: this._qualityPreset });
      this._creatureAssets = new CreaturePrototypeManager(this, B, scene, { ...options, document: options.document || runtime.document });
      this._cinematicAudio = new CinematicAudioManager(options, options.document || runtime.document);
      this._cinematicAudio.start();
      const placements = [
        [this._player.x, this._player.z],
        [this._player.x + 34, this._player.z + 22],
        [this._player.x - 42, this._player.z + 30],
        [this._player.x + 24, this._player.z - 45]
      ];
      this._visibleWildlifeSpecies.clear();
      FLAGSHIP_SPECIES.forEach((species, index) => {
        const proxy = createSpeciesProxy(B, scene, species);
        const worldX = clamp(placements[index][0], 8, WORLD_SIZE - 8);
        const worldZ = clamp(placements[index][1], 8, WORLD_SIZE - 8);
        proxy.baseY = terrainSampleFromProvider(this._landscape, worldX, worldZ, this._streamer.seed).height + proxy.flightOffset;
        proxy.root.position = new B.Vector3(worldX - WORLD_HALF, proxy.baseY, worldZ - WORLD_HALF);
        proxy.root.rotation.y = index * 1.45;
        if (typeof proxy.root.setEnabled === "function") proxy.root.setEnabled(species.id === this._playerSpeciesId);
        if (shadow && typeof shadow.addShadowCaster === "function") proxy.parts.forEach((part) => shadow.addShadowCaster(part, true));
        this._proxies.set(species.id, proxy);
        this._syncProxyIdentity(proxy, species.id === this._playerSpeciesId ? this._playerEntityId : "", species.id === this._playerSpeciesId, species.id === this._playerSpeciesId);
      });
      this._registerShadowCasters(shadow);
      this._applyPlayerPosition();
      this._followPlayer(0, true);
      this._applyEnvironment();
    }

    _runtimeCapabilities() {
      let engineCaps = {};
      try {
        const caps = this._engine && typeof this._engine.getCaps === "function" ? this._engine.getCaps() : {};
        engineCaps = {
          maxTextureSize: finite(caps.maxTextureSize, 0),
          maxMSAASamples: finite(caps.maxMSAASamples, 0),
          maxAnisotropy: finite(caps.maxAnisotropy, 0),
          instancing: Boolean(caps.instancedArrays),
          occlusionQueries: Boolean(caps.supportOcclusionQuery),
          computeShaders: Boolean(caps.supportComputeShaders)
        };
      } catch { /* Capability reporting is best effort. */ }
      return freezeRecord({
        ...this._capabilities,
        backend: this._backend,
        engine: freezeRecord(engineCaps),
        integrations: freezeRecord({ physics: "kinematic-proxy-only", rapier: false, recast: false, navmesh: false, gameplayCamera: true, cameraCollision: typeof this._Babylon?.Ray === "function" && typeof this._scene?.pickWithRay === "function" ? "terrain-ray" : false })
      });
    }

    _cancelEnvironmentAssetSchedule() {
      if (this._environmentLoadHandle === null) return;
      if (this._environmentLoadHandleType === "idle" && typeof runtime.cancelIdleCallback === "function") {
        try { runtime.cancelIdleCallback(this._environmentLoadHandle); } catch { /* Best-effort delayed-load cleanup. */ }
      } else {
        try { (runtime.clearTimeout || clearTimeout)(this._environmentLoadHandle); } catch { /* Best-effort delayed-load cleanup. */ }
      }
      this._environmentLoadHandle = null;
      this._environmentLoadHandleType = null;
    }

    _scheduleEnvironmentAssetLoad(generation = this._generation) {
      const environmentPending = Boolean(this._environmentAssets && !this._environmentAssets.started && !this._environmentAssets.loading && this._environmentAssets.status !== "disabled");
      const creaturesPending = Boolean(this._creatureAssets && !this._creatureAssets.started && !this._creatureAssets.loading && this._creatureAssets.status !== "disabled");
      if ((!environmentPending && !creaturesPending) || this._environmentLoadHandle !== null) return;
      const begin = async () => {
        this._environmentLoadHandle = null;
        this._environmentLoadHandleType = null;
        if (generation !== this._generation || this._state !== "running") return;
        // Decode the small animated prototypes first, then the larger scans.
        // Serial work avoids overlapping HDR prefiltering, skin upload and
        // photogrammetry texture upload on memory-constrained devices.
        if (creaturesPending && !this._creatureAssets?.disposed) {
          await this._creatureAssets.start().catch((error) => {
            if (generation !== this._generation || this._state === "disposed") return;
            safeCall(this._options.onCreatureAssetStatus, freezeRecord({ status: "procedural-fallback", error: compactError(error) }));
          });
        }
        if (generation !== this._generation || this._state !== "running") return;
        if (environmentPending && !this._environmentAssets?.disposed) {
          await this._environmentAssets.start().catch((error) => {
            if (generation !== this._generation || this._state === "disposed") return;
            safeCall(this._options.onEnvironmentAssetStatus, freezeRecord({ status: "procedural-fallback", error: compactError(error) }));
          });
        }
      };
      if (typeof runtime.requestIdleCallback === "function") {
        this._environmentLoadHandleType = "idle";
        this._environmentLoadHandle = runtime.requestIdleCallback(begin, { timeout: 900 });
      } else {
        this._environmentLoadHandleType = "timeout";
        this._environmentLoadHandle = (runtime.setTimeout || setTimeout)(begin, 0);
      }
    }

    _installRuntimeListeners(documentRef) {
      this._removeRuntimeListeners();
      const add = (target, type, handler, options) => {
        if (!target || typeof target.addEventListener !== "function") return;
        target.addEventListener(type, handler, options);
        this._cleanupCallbacks.push(() => { try { target.removeEventListener(type, handler, options); } catch { /* Cleanup only. */ } });
      };

      const visibilityHandler = () => {
        if (documentRef.hidden) {
          if (this._state === "running") {
            this._pausedByVisibility = true;
            this.pause("visibility");
          }
        } else if (this._pausedByVisibility) {
          this._pausedByVisibility = false;
          if (!this._pauseRequested) this.resume("visibility");
        }
      };
      add(documentRef, "visibilitychange", visibilityHandler, false);

      let observedWidth = Math.max(1, Math.round(this._canvas?.clientWidth || this._container?.clientWidth || 1));
      let observedHeight = Math.max(1, Math.round(this._canvas?.clientHeight || this._container?.clientHeight || 1));
      const resizeHandler = () => {
        const width = Math.max(1, Math.round(this._canvas?.clientWidth || this._container?.clientWidth || 1));
        const height = Math.max(1, Math.round(this._canvas?.clientHeight || this._container?.clientHeight || 1));
        // ResizeObserver always emits once after observe(). Skipping that
        // no-op callback prevents a WebGPU swap-chain rebuild from racing the
        // first submitted frame on Chromium/D3D.
        if (width === observedWidth && height === observedHeight) return;
        observedWidth = width;
        observedHeight = height;
        if (this._engine && typeof this._engine.resize === "function") this._engine.resize();
      };
      if (typeof runtime.ResizeObserver === "function" && this._container) {
        this._resizeObserver = new runtime.ResizeObserver(resizeHandler);
        this._resizeObserver.observe(this._container);
      } else add(runtime, "resize", resizeHandler, { passive: true });

      let mediaQuery = null;
      try { mediaQuery = runtime.matchMedia && runtime.matchMedia("(prefers-reduced-motion: reduce)"); } catch { /* Optional query. */ }
      const reducedHandler = (event) => {
        if (this._reducedMotionMode === "auto") this._setReducedMotionInternal(Boolean(event.matches));
      };
      if (mediaQuery) {
        this._setReducedMotionInternal(this._reducedMotionMode === "auto" ? Boolean(mediaQuery.matches) : Boolean(this._reducedMotionMode));
        if (typeof mediaQuery.addEventListener === "function") add(mediaQuery, "change", reducedHandler, false);
        else if (typeof mediaQuery.addListener === "function") {
          mediaQuery.addListener(reducedHandler);
          this._cleanupCallbacks.push(() => { try { mediaQuery.removeListener(reducedHandler); } catch { /* Legacy cleanup. */ } });
        }
      } else this._setReducedMotionInternal(Boolean(this._reducedMotionMode === true));

      const contextLost = (event) => {
        if (event && typeof event.preventDefault === "function") event.preventDefault();
        this._handleRuntimeFailure(makeReason("RENDER_CONTEXT_LOST", "The 3D graphics context was lost; return to 2D mode or retry 3D.", "runtime", { backend: this._backend }, true));
      };
      add(this._canvas, "webglcontextlost", contextLost, false);
      if (this._engine && this._engine.onContextLostObservable && typeof this._engine.onContextLostObservable.add === "function") {
        const observer = this._engine.onContextLostObservable.add(() => contextLost());
        this._cleanupCallbacks.push(() => { try { this._engine && this._engine.onContextLostObservable.remove(observer); } catch { /* Observer cleanup. */ } });
      }
    }

    _installWebGpuDiagnostics() {
      this._removeWebGpuDiagnostics();
      if (this._backend !== "webgpu" || !this._engine) return false;
      const device = this._engine._device;
      if (!device || typeof device.addEventListener !== "function") return false;
      // Babylon normally logs every uncaptured GPU validation error. EonWild
      // records the same signal in bounded telemetry and fails open after a
      // short burst, so the console is not flooded while a broken device keeps
      // submitting frames. A single resize-related warning remains recoverable.
      try { this._engine.numMaxUncapturedErrors = -1; } catch { /* Optional Babylon diagnostic control. */ }
      this._webgpuDevice = device;
      this._webgpuErrorHandler = (event) => {
        const timestamp = now();
        if (!this._webgpuErrorWindowStartedAt || timestamp - this._webgpuErrorWindowStartedAt > 5000) {
          this._webgpuErrorWindowStartedAt = timestamp;
          this._webgpuErrorCount = 0;
        }
        this._webgpuErrorCount += 1;
        const error = event?.error || new Error("WebGPU validation error");
        this._recordRenderingFeatureFailure("webgpu-validation", error);
        if (this._webgpuErrorCount < 3) return;
        const fail = () => {
          if (!["starting", "running", "paused"].includes(this._state)) return;
          this._handleRuntimeFailure(makeReason(
            "WEBGPU_RUNTIME_VALIDATION_FAILED",
            "WebGPU reported repeated validation errors; Canvas Lite remains available.",
            "runtime",
            { backend: this._backend, errors: this._webgpuErrorCount },
            true
          ));
        };
        try { (runtime.setTimeout || setTimeout)(fail, 0); } catch { fail(); }
      };
      device.addEventListener("uncapturederror", this._webgpuErrorHandler);
      return true;
    }

    _removeWebGpuDiagnostics() {
      if (this._webgpuDevice && this._webgpuErrorHandler && typeof this._webgpuDevice.removeEventListener === "function") {
        try { this._webgpuDevice.removeEventListener("uncapturederror", this._webgpuErrorHandler); } catch { /* Cleanup only. */ }
      }
      this._webgpuDevice = null;
      this._webgpuErrorHandler = null;
      this._webgpuErrorCount = 0;
      this._webgpuErrorWindowStartedAt = 0;
    }

    _removeRuntimeListeners() {
      if (this._resizeObserver) {
        try { this._resizeObserver.disconnect(); } catch { /* Cleanup only. */ }
        this._resizeObserver = null;
      }
      while (this._cleanupCallbacks.length) {
        const cleanup = this._cleanupCallbacks.pop();
        try { cleanup(); } catch { /* Cleanup only. */ }
      }
    }

    _handleRuntimeFailure(reason) {
      if (this._state === "failed" || this._state === "disposed") return;
      try { this._engine && this._engine.stopRenderLoop(this._renderFrame); } catch { /* Engine may already be lost. */ }
      this._fail(reason);
    }

    _setReducedMotionInternal(value) {
      const next = Boolean(value);
      if (this._reducedMotion === next) return;
      this._reducedMotion = next;
      if (this._camera) this._camera.inertia = next ? 0 : 0.72;
      if (next && this._water && this._water.material) this._water.material.alpha = 0.72;
      if (this._streamer) this._streamer.reducedMotion = next;
      if (next && QUALITY_ORDER.indexOf(this._qualityPreset) > QUALITY_ORDER.indexOf("low")) this._applyQuality("low", "reduced-motion", true);
      else if (!next && QUALITY_ORDER.indexOf(this._qualityPreset) < QUALITY_ORDER.indexOf(this._qualityRequested)) this._applyQuality(this._qualityRequested, "reduced-motion-ended", true);
      this._creatureAssets?.setReducedMotion(next);
      this._vegetation?.configure?.({ reducedMotion: next });
      this._environmentRenderer?.configure?.({ reducedMotion: next });
      this._waterWeather?.configure?.({ reducedMotion: next });
      this._syncWeatherEffects();
      this._emitStatus({ change: "reduced-motion" });
    }

    setReducedMotion(value) {
      this._reducedMotionMode = value === "auto" ? "auto" : Boolean(value);
      let next = Boolean(value);
      if (value === "auto") {
        try { next = Boolean(runtime.matchMedia && runtime.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch { next = false; }
      }
      this._setReducedMotionInternal(next);
      return makeResult(true, { reducedMotion: this._reducedMotion, mode: this._reducedMotionMode });
    }

    setGameplayCamera(value = {}) {
      if (this._state === "disposed") return makeResult(false, { status: this._state, reason: makeReason("ADAPTER_DISPOSED", "A disposed renderer cannot accept gameplay camera state.", "camera", {}, false) });
      if (!value || typeof value !== "object" || Array.isArray(value)) return makeResult(false, { reason: makeReason("GAMEPLAY_CAMERA_INVALID", "Gameplay camera state must be an object.", "camera", {}, true) });
      const previous = this._gameplayCamera;
      const requestedProfileId = String(value.profileId ?? value.profile ?? previous.profileId ?? "ground").toLowerCase();
      const requestedProfile = GAMEPLAY_CAMERA_PROFILES[requestedProfileId] || GAMEPLAY_CAMERA_PROFILES[previous.profileId] || GAMEPLAY_CAMERA_PROFILES.ground;
      const normalizedInput = {
        ...value,
        active: value.active === false ? false : true,
        playerHeading: value.playerHeading === undefined ? this._player.heading : value.playerHeading
      };
      const incomingYaw = Number.isFinite(Number(value.yaw)) ? wrapAngle(Number(value.yaw)) : null;
      if (incomingYaw !== null) {
        const inputChanged = Math.abs(shortestAngleDelta(this._gameplayCameraSourceYaw, incomingYaw)) > 1e-5;
        if (inputChanged) {
          this._gameplayCameraSourceYaw = incomingYaw;
          this._gameplayCameraYawOverrideLatched = false;
          this._gameplayCameraManualIdleSeconds = 0;
        } else if (this._gameplayCameraYawOverrideLatched && value.resetCamera !== true && value.reset !== true && value.resetYaw !== true) normalizedInput.yaw = previous.yaw;
      }
      const resetCamera = value.resetCamera === true || value.reset === true || value.resetYaw === true;
      if (resetCamera) {
        normalizedInput.yaw = wrapAngle(finite(normalizedInput.playerHeading, this._player.heading));
        if (value.resetYaw !== true && value.resetPitch !== false) normalizedInput.pitch = requestedProfile.defaultPitch;
        this._gameplayCameraYawOverrideLatched = true;
        this._gameplayCameraManualIdleSeconds = 0;
      }
      if (value.lookBack !== undefined && Boolean(value.lookBack) !== Boolean(previous.lookBack)) this._gameplayCameraManualIdleSeconds = 0;
      this._gameplayCamera = normalizeGameplayCamera(normalizedInput, previous);
      this._photoCameraOverride = false;
      const fovProvided = value.fov !== undefined || value.fovDegrees !== undefined;
      this._gameplayCameraFovDirty = this._gameplayCameraFovDirty || fovProvided || this._gameplayCamera.fov !== previous.fov || !previous.active;
      const collisionBasisChanged = this._gameplayCamera.profileId !== previous.profileId || this._gameplayCamera.firstPerson !== previous.firstPerson || !previous.active;
      this._gameplayCameraLimitsDirty = this._gameplayCameraLimitsDirty || collisionBasisChanged;
      if (collisionBasisChanged) {
        this._gameplayCameraCollision = freezeRecord({ supported: false, mode: "unavailable", terrainOnly: true, approximate: false, rayCount: 0, blockerCoverage: Object.freeze([]), hit: false, desiredDistance: this._gameplayCamera.distance, resolvedDistance: this._gameplayCamera.distance, hitDistance: null, meshKind: null });
        this._gameplayCameraCollisionHold = { active: false, distance: this._gameplayCamera.distance, clearSeconds: 0 };
      }
      if (this._gameplayCamera.active && this._camera && typeof this._camera.detachControl === "function") {
        try { this._camera.detachControl(); } catch { /* Route input ownership remains authoritative. */ }
        this._controlsAttached = false;
        this._camera.inertialAlphaOffset = 0;
        this._camera.inertialBetaOffset = 0;
        this._camera.inertialRadiusOffset = 0;
        this._camera.inertialPanningX = 0;
        this._camera.inertialPanningY = 0;
      }
      // The render loop is the sole steady-state camera/collision owner.  An
      // immediate follow is needed only when route ownership first activates;
      // applying every input sample here used to repeat all five collision rays
      // before the same frame was rendered.
      if (this._camera && this._gameplayCamera.active && !previous.active) this._followPlayer(0, true);
      return makeResult(true, { camera: this.getGameplayCamera() });
    }

    getGameplayCamera() {
      const state = this._gameplayCamera || DEFAULT_GAMEPLAY_CAMERA;
      const applied = this._gameplayCameraApplied;
      const collision = this._gameplayCameraCollision || { supported: false, mode: "unavailable", terrainOnly: true, approximate: false, rayCount: 0, blockerCoverage: Object.freeze([]), hit: false, desiredDistance: state.distance, resolvedDistance: state.distance, hitDistance: null, meshKind: null };
      return freezeRecord({
        ...state,
        profile: state.profileId,
        fovDegrees: state.fov,
        effectiveYaw: applied ? wrapAngle(applied.yaw) : state.yaw,
        effectivePitch: applied ? applied.pitch : state.pitch,
        effectiveDistance: applied ? finite(applied.collisionDistance, applied.distance) : state.distance,
        effectiveShoulderOffset: applied ? finite(applied.shoulderOffset, state.shoulderOffset) : state.shoulderOffset,
        headBobOffset: applied ? finite(applied.headBobOffset, 0) : 0,
        manualIdleSeconds: this._gameplayCameraManualIdleSeconds,
        inputOwner: state.active ? "route" : (this._controlsAttached ? "babylon-opt-in" : "none"),
        photoOverride: this._photoCameraOverride,
        collision: freezeRecord({ ...collision })
      });
    }

    getGameplayCapabilities() {
      const cameraCollision = this._cameraCollisionCapabilities();
      const resourceMarkers = this._resourceMarkerCapabilities();
      let visibleWildlife = 0;
      let exactWildlifeIdentities = 0;
      for (const speciesId of this._visibleWildlifeSpecies) {
        const proxy = this._proxies.get(speciesId);
        if (!proxy || proxy.isPlayer) continue;
        visibleWildlife += 1;
        if (proxy.identityExact && proxy.entityId) exactWildlifeIdentities += 1;
      }
      return freezeRecord({
        cameraCollision,
        targeting: freezeRecord({
          centerRay: "authoritative-yaw-pitch",
          lockOnLineOfSight: cameraCollision.sceneRaycast,
          terrainLineOfSight: cameraCollision.sceneRaycast,
          environmentLineOfSight: cameraCollision.environmentMesh || cameraCollision.environmentApproximation,
          environmentApproximate: cameraCollision.environmentApproximation,
          exactEntityIdSupported: true,
          exactEntityIdRequired: true,
          requiresHostEntityId: true,
          supportedTypes: Object.freeze(["animal", ...resourceMarkers.supportedTypes]),
          resourceMarkers: resourceMarkers.supported,
          proxyGranularity: "one-visible-entity-per-flagship-species",
          visibleWildlife,
          exactWildlifeIdentities,
          identityCoverageComplete: visibleWildlife === exactWildlifeIdentities
        }),
        resourceMarkers,
        waterQueries: freezeRecord({
          supported: Boolean(this._landscape && typeof this._landscape.sample === "function"),
          proceduralLakes: this._proceduralLakes.length,
          sharesRenderedLakePlan: true
        }),
        highlighting: freezeRecord({ exactEntityIdRequired: true, active: Boolean(this._highlightedTarget), activeType: this._highlightedTarget?.type || null })
      });
    }

    queryCameraObstructionDistance(options = {}) {
      const state = this._gameplayCamera || DEFAULT_GAMEPLAY_CAMERA;
      const profile = GAMEPLAY_CAMERA_PROFILES[state.profileId] || GAMEPLAY_CAMERA_PROFILES.ground;
      const desiredDistance = clamp(options.desiredDistance ?? options.distance ?? state.distance, state.firstPerson ? 0.1 : profile.minDistance, profile.maxDistance);
      const capability = this._cameraCollisionCapabilities();
      const unsupported = (mode = "unavailable") => freezeRecord({ ...capability, supported: false, mode, hit: false, desiredDistance, distance: null, meshKind: null });
      if (!capability.supported || !this._camera) return unsupported();
      const source = options.origin || this._camera.target;
      if (!source || !Number.isFinite(Number(source.x)) || !Number.isFinite(Number(source.y)) || !Number.isFinite(Number(source.z))) return unsupported("origin-unavailable");
      const yaw = Number.isFinite(Number(options.yaw)) ? Number(options.yaw) : finite(this._gameplayCameraApplied?.yaw, state.yaw);
      const pitch = Number.isFinite(Number(options.pitch)) ? Number(options.pitch) : finite(this._gameplayCameraApplied?.pitch, state.pitch);
      const offset = gameplayCameraOffset(yaw, pitch, 1);
      const right = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
      const probeRadius = clamp(options.probeRadius ?? Math.max(0.12, Math.min(0.8, profile.collisionPadding)), 0, 2);
      try {
        let distance = null;
        let meshKind = null;
        let rayCount = 0;
        let sphereTests = 0;
        for (const [horizontalOffset, verticalOffset] of CAMERA_COLLISION_RAY_OFFSETS) {
          const origin = new this._Babylon.Vector3(
            Number(source.x) + right.x * horizontalOffset * probeRadius,
            Number(source.y) + verticalOffset * probeRadius,
            Number(source.z) + right.z * horizontalOffset * probeRadius
          );
          const direction = new this._Babylon.Vector3(offset.x, offset.y, offset.z);
          if (typeof direction.normalize === "function") direction.normalize();
          const ray = new this._Babylon.Ray(origin, direction, desiredDistance);
          rayCount += 1;
          const picked = this._scene.pickWithRay(ray, isCameraObstructionMesh, false);
          const meshDistance = picked?.hit && Number.isFinite(Number(picked.distance)) ? clamp(picked.distance, 0, desiredDistance) : null;
          if (meshDistance !== null && (distance === null || meshDistance < distance)) {
            distance = meshDistance;
            meshKind = cameraObstructionKind(picked?.pickedMesh);
          }
          if (!capability.environmentMesh) {
            const approximate = this._queryEnvironmentBlockerDistance(ray, desiredDistance);
            sphereTests += approximate.tested;
            if (approximate.hit && (distance === null || approximate.distance < distance)) {
              distance = approximate.distance;
              meshKind = approximate.kind;
            }
          }
        }
        return freezeRecord({
          ...capability,
          supported: true,
          mode: capability.environmentMesh || capability.environmentApproximation ? "terrain-environment-multi-ray" : "terrain-multi-ray",
          approximate: sphereTests > 0 || rayCount > 1,
          rayCount,
          sphereTests,
          hit: distance !== null,
          desiredDistance,
          distance,
          meshKind: distance !== null ? meshKind : null
        });
      } catch {
        return unsupported("multi-ray-error");
      }
    }

    resolveGameplayCameraCollision(options = {}) {
      const state = this._gameplayCamera || DEFAULT_GAMEPLAY_CAMERA;
      const profile = GAMEPLAY_CAMERA_PROFILES[state.profileId] || GAMEPLAY_CAMERA_PROFILES.ground;
      const minimum = state.firstPerson ? 0.1 : profile.minDistance;
      const desiredDistance = clamp(options.desiredDistance ?? options.distance ?? state.distance, minimum, profile.maxDistance);
      const hasProvidedHit = Number.isFinite(Number(options.hitDistance)) && Number(options.hitDistance) >= 0;
      const providedMeshKind = String(options.meshKind || "provided");
      const providedCreatureHit = ["animal", "creature", "wildlife"].includes(providedMeshKind.toLowerCase());
      const query = hasProvidedHit
        ? freezeRecord({ supported: true, mode: "provided", terrainOnly: !providedCreatureHit, approximate: false, rayCount: 0, blockerCoverage: Object.freeze([providedCreatureHit ? "wildlife-creature-mesh" : "provided"]), hit: true, desiredDistance, distance: clamp(options.hitDistance, 0, desiredDistance), meshKind: providedMeshKind })
        : this.queryCameraObstructionDistance({ ...options, desiredDistance });
      const padding = Number.isFinite(Number(options.padding)) ? clamp(options.padding, 0, 5) : profile.collisionPadding;
      const obstructedDistance = query.hit ? clamp(finite(query.distance, desiredDistance) - padding, minimum, desiredDistance) : desiredDistance;
      const previousDistance = finite(this._gameplayCameraApplied?.collisionDistance, desiredDistance);
      const deltaSeconds = clamp(Number.isFinite(Number(options.deltaSeconds)) ? options.deltaSeconds : 1 / 60, 0, 0.25);
      const recoveryRate = clamp(options.recoverySmoothing ?? state.collisionRecoveryRate ?? profile.collisionRecoveryRate, 0, 30);
      // Retraction is deliberately much faster than release, but still uses
      // exponential damping so the same obstruction converges identically at
      // 30, 60 or 120 Hz and never teleports the camera in a single frame.
      const retractionRate = clamp(options.retractionSmoothing ?? Math.max(36, recoveryRate * 6), 0, 120);
      const releaseDelay = clamp(options.releaseDelay ?? state.collisionReleaseDelay ?? profile.collisionReleaseDelay, 0, 1);
      const hysteresis = clamp(options.hysteresis ?? state.collisionHysteresis ?? profile.collisionHysteresis, 0, 2);
      const dampingAmount = (rate) => deltaSeconds <= 0 ? 0 : (rate > 0 ? 1 - Math.exp(-deltaSeconds * rate) : 1);
      const recoveryAmount = dampingAmount(recoveryRate);
      const retractionAmount = dampingAmount(retractionRate);
      const priorHold = this._gameplayCameraCollisionHold || { active: false, distance: previousDistance, clearSeconds: 0 };
      let holdActive = Boolean(priorHold.active);
      let heldDistance = clamp(priorHold.distance, minimum, desiredDistance);
      let clearSeconds = Math.max(0, finite(priorHold.clearSeconds, 0));
      let releaseHeld = false;
      let targetDistance = desiredDistance;
      if (query.hit) {
        clearSeconds = 0;
        // Moving inward is safety-critical, so it converges with the fast
        // retraction rate. Outward movement must clear a small band before
        // recovery begins, so adjacent terrain triangles cannot pump the camera.
        if (!holdActive || obstructedDistance < heldDistance) heldDistance = obstructedDistance;
        else if (obstructedDistance > heldDistance + hysteresis) heldDistance = obstructedDistance - hysteresis;
        holdActive = true;
        targetDistance = heldDistance;
      } else if (holdActive) {
        clearSeconds = Math.min(1, clearSeconds + deltaSeconds);
        releaseHeld = clearSeconds < releaseDelay;
        if (releaseHeld) targetDistance = Math.min(heldDistance, desiredDistance);
        else { holdActive = false; targetDistance = desiredDistance; heldDistance = desiredDistance; }
      }
      // Both directions are frame-rate independent: pull-in is aggressively
      // damped while outward recovery remains intentionally softer.
      const movingInward = targetDistance < previousDistance;
      const resolvedDistance = lerp(previousDistance, targetDistance, movingInward ? retractionAmount : recoveryAmount);
      const result = freezeRecord({
        supported: query.supported,
        mode: query.mode,
        terrainOnly: query.terrainOnly,
        approximate: Boolean(query.approximate),
        rayCount: Math.max(0, Math.trunc(finite(query.rayCount, 0))),
        blockerCoverage: Object.freeze(Array.from(query.blockerCoverage || [])),
        hit: query.hit,
        holding: query.hit || releaseHeld,
        releaseHeld,
        clearSeconds,
        releaseDelay,
        hysteresis,
        retractionRate,
        recoveryRate,
        desiredDistance,
        resolvedDistance: clamp(resolvedDistance, minimum, desiredDistance),
        hitDistance: query.hit ? query.distance : null,
        meshKind: query.meshKind || null
      });
      if (options.commit !== false) {
        if (this._gameplayCameraApplied) this._gameplayCameraApplied.collisionDistance = result.resolvedDistance;
        this._gameplayCameraCollisionHold = { active: holdActive, distance: heldDistance, clearSeconds };
        this._gameplayCameraCollision = result;
      }
      return result;
    }

    pickCenter(options = {}) {
      if (!this._scene || !this._camera || typeof this._scene.pickWithRay !== "function") return null;
      const maximumDistance = clamp(options.maxDistance ?? 120, 0.1, 1000);
      const allowed = new Set(Array.isArray(options.allowedTypes) && options.allowedTypes.length ? options.allowedTypes.map((value) => String(value).toLowerCase()) : ["animal"]);
      const state = this._gameplayCamera || DEFAULT_GAMEPLAY_CAMERA;
      const yaw = Number.isFinite(Number(options.yaw)) ? Number(options.yaw) : finite(this._gameplayCameraApplied?.yaw, state.yaw);
      const pitch = Number.isFinite(Number(options.pitch)) ? Number(options.pitch) : finite(this._gameplayCameraApplied?.pitch, state.pitch);
      let ray = null;
      try {
        const source = options.origin || this._camera.position;
        if (source && this._Babylon && typeof this._Babylon.Ray === "function" && typeof this._Babylon.Vector3 === "function") {
          const look = gameplayLookDirection(yaw, pitch);
          const origin = new this._Babylon.Vector3(finite(source.x), finite(source.y), finite(source.z));
          const direction = new this._Babylon.Vector3(look.x, look.y, look.z);
          if (typeof direction.normalize === "function") direction.normalize();
          ray = new this._Babylon.Ray(origin, direction, maximumDistance);
        } else if (typeof this._camera.getForwardRay === "function") ray = this._camera.getForwardRay(maximumDistance);
      }
      catch { return null; }
      if (!ray) return null;
      try {
        const capability = this._cameraCollisionCapabilities();
        const picked = this._scene.pickWithRay(ray, (mesh) => {
          const metadata = mesh?.metadata || {};
          if (metadata.cameraObstruction === true) return true;
           const type = String(metadata.targetType || "").toLowerCase();
           if (metadata.targetable !== true || !allowed.has(type)) return false;
           if (options.excludePlayer !== false && type === "animal" && metadata.isPlayer === true) return false;
           if (!exactMetadataEntityId(metadata)) return false;
           return true;
        }, false);
        if (!picked?.hit || !picked.pickedMesh) return null;
        const metadata = picked.pickedMesh.metadata || {};
        if (metadata.cameraObstruction === true) return null;
        const type = String(metadata.targetType || "").toLowerCase();
        if (!allowed.has(type)) return null;
        const targetDistance = clamp(picked.distance, 0, maximumDistance);
        const approximateBlocker = capability.environmentMesh
          ? freezeRecord({ hit: false, distance: null, kind: null, tested: 0, approximate: false })
          : this._queryEnvironmentBlockerDistance(ray, targetDistance);
        if (approximateBlocker.hit && approximateBlocker.distance + 0.001 < targetDistance) return null;
        const entityId = exactMetadataEntityId(metadata);
        const identityExact = Boolean(entityId);
        if (!identityExact) return null;
        if (type !== "animal") {
          const marker = this._resourceMarkers.get(entityId);
          if (!marker || marker.mesh !== picked.pickedMesh || marker.targetType !== type) return null;
        }
        return freezeRecord({
          id: entityId || safeEntityId(picked.pickedMesh.id || picked.pickedMesh.name || "target"),
          entityId,
          identityExact,
          type,
          speciesId: String(metadata.speciesId || "").slice(0, 64),
          distance: targetDistance,
          lineOfSight: true,
          lineOfSightMode: approximateBlocker.tested ? "mesh-ray+environment-sphere" : "mesh-ray",
          yaw,
          pitch,
          meshKind: String(metadata.kind || "target").slice(0, 64)
        });
      } catch { return null; }
    }

    queryTargetLineOfSight(target, options = {}) {
      const descriptor = typeof target === "string" ? { id: target } : target;
      const entityId = safeEntityId(descriptor?.entityId ?? descriptor?.targetId ?? descriptor?.id);
      const suppliedType = String(descriptor?.type || "animal").toLowerCase();
      const requestedType = suppliedType === "animal" ? "animal" : this._resourceTargetType(suppliedType);
      const capability = this._cameraCollisionCapabilities();
      const unsupported = (reason) => freezeRecord({
        supported: false,
        visible: false,
        entityId,
        reason,
        approximate: capability.approximate,
        blockerCoverage: capability.blockerCoverage,
        distance: null,
        blockerKind: null
      });
      if (!entityId) return unsupported("entity-id-required");
      const proxy = requestedType === "animal" ? this._proxyByEntityId.get(entityId) : null;
      const resourceMarker = requestedType !== "animal" ? this._resourceMarkers.get(entityId) : null;
      if (requestedType === "animal" && (!proxy || !proxy.identityExact || proxy.isPlayer || proxy.entityId !== entityId)) return unsupported("exact-rendered-proxy-unavailable");
      const resourceMetadata = resourceMarker?.mesh?.metadata || {};
      if (requestedType !== "animal" && (!resourceMarker?.mesh || resourceMarker.targetType !== requestedType || resourceMetadata.targetable !== true || String(resourceMetadata.targetType || "").toLowerCase() !== requestedType || exactMetadataEntityId(resourceMetadata) !== entityId)) return unsupported("exact-rendered-target-unavailable");
      if (!capability.sceneRaycast || !this._camera || !this._Babylon?.Vector3) return unsupported("scene-raycast-unavailable");
      const source = options.origin || this._camera.position;
      const rootPosition = proxy?.root?.position || resourceMarker?.mesh?.position;
      const destination = options.target || (rootPosition ? {
        x: rootPosition.x,
        // Resource meshes are positioned by their geometric centre. A fixed
        // +.25 m offset passed above the shallow water and nest marker meshes,
        // so a real Babylon ray could never confirm the exact locked target.
        y: proxy ? finite(proxy.baseY, rootPosition.y) + (proxy.id === "pteranodon" ? .45 : 2.1) : finite(rootPosition.y),
        z: rootPosition.z
      } : null);
      if (!source || !destination) return unsupported("line-segment-unavailable");
      const dx = finite(destination.x, NaN) - finite(source.x, NaN);
      const dy = finite(destination.y, NaN) - finite(source.y, NaN);
      const dz = finite(destination.z, NaN) - finite(source.z, NaN);
      const maximumDistance = Math.hypot(dx, dy, dz);
      if (!Number.isFinite(maximumDistance) || maximumDistance <= 1e-6) return unsupported("line-segment-invalid");
      try {
        const origin = new this._Babylon.Vector3(finite(source.x), finite(source.y), finite(source.z));
        const direction = new this._Babylon.Vector3(dx / maximumDistance, dy / maximumDistance, dz / maximumDistance);
        const ray = new this._Babylon.Ray(origin, direction, maximumDistance + 0.05);
        const picked = this._scene.pickWithRay(ray, (mesh) => {
          const metadata = mesh?.metadata || {};
          return metadata.cameraObstruction === true || (metadata.targetable === true && String(metadata.targetType || "").toLowerCase() === requestedType && exactMetadataEntityId(metadata) === entityId);
        }, false);
        const pickedDistance = picked?.hit && Number.isFinite(Number(picked.distance)) ? clamp(picked.distance, 0, maximumDistance + 0.05) : null;
        const pickedMetadata = picked?.pickedMesh?.metadata || {};
        const hitTarget = pickedDistance !== null && pickedMetadata.cameraObstruction !== true && String(pickedMetadata.targetType || "").toLowerCase() === requestedType && exactMetadataEntityId(pickedMetadata) === entityId;
        const approximateBlocker = capability.environmentMesh
          ? freezeRecord({ hit: false, distance: null, kind: null, tested: 0, approximate: false })
          : this._queryEnvironmentBlockerDistance(ray, hitTarget ? pickedDistance : maximumDistance);
        const blockedByApproximation = approximateBlocker.hit && (!hitTarget || approximateBlocker.distance + 0.001 < pickedDistance);
        const visible = hitTarget && !blockedByApproximation;
        return freezeRecord({
          supported: true,
          visible,
          entityId,
          type: requestedType,
          identityExact: true,
          reason: visible ? "visible" : "occluded",
          approximate: capability.approximate || approximateBlocker.tested > 0,
          blockerCoverage: capability.blockerCoverage,
          distance: maximumDistance,
          blockerDistance: blockedByApproximation ? approximateBlocker.distance : (!hitTarget ? pickedDistance : null),
          blockerKind: blockedByApproximation ? approximateBlocker.kind : (!hitTarget && pickedDistance !== null ? String(pickedMetadata.cameraObstructionKind || pickedMetadata.kind || "obstruction") : null),
          mode: approximateBlocker.tested ? "mesh-ray+environment-sphere" : "mesh-ray"
        });
      } catch { return unsupported("scene-raycast-error"); }
    }

    _clearHighlightedTargetInternal() {
      const hadTarget = Boolean(this._highlightedTarget || this._highlightedMeshes.size);
      for (const [mesh, previous] of this._highlightedMeshes) {
        try {
          mesh.renderOverlay = previous.renderOverlay;
          mesh.overlayColor = previous.overlayColor;
          mesh.overlayAlpha = previous.overlayAlpha;
        } catch { /* A streamed mesh may already be disposed. */ }
      }
      this._highlightedMeshes.clear();
      this._highlightedTarget = null;
      return hadTarget;
    }

    setHighlightedTarget(target = null) {
      if (target == null || target === false) return this.clearHighlightedTarget();
      if (this._state === "disposed") return makeResult(false, { status: this._state, reason: makeReason("ADAPTER_DISPOSED", "A disposed renderer cannot highlight a target.", "target", {}, false) });
      const descriptor = typeof target === "string" ? { id: target } : target;
      if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) return makeResult(false, { reason: makeReason("TARGET_INVALID", "Highlighted targets must identify one rendered world entity.", "target", {}, true) });
      const entityId = safeEntityId(descriptor.entityId ?? descriptor.targetId ?? descriptor.id);
      const suppliedType = String(descriptor.type || "animal").toLowerCase();
      const targetType = suppliedType === "animal" ? "animal" : this._resourceTargetType(suppliedType);
      const speciesId = String(descriptor.speciesId || "").toLowerCase();
      const proxy = targetType === "animal" && entityId ? this._proxyByEntityId.get(entityId) : null;
      const resourceMarker = targetType !== "animal" && entityId ? this._resourceMarkers.get(entityId) : null;
      const resourceMetadata = resourceMarker?.mesh?.metadata || {};
      if (targetType === "animal" && (!proxy || proxy.isPlayer || !proxy.identityExact || proxy.entityId !== entityId || (speciesId && proxy.id !== speciesId))) return makeResult(false, { reason: makeReason("TARGET_PROXY_UNAVAILABLE", "No rendered animal proxy matches this exact entity identity.", "target", { entityId, speciesId, identityRequired: true }, true) });
      if (targetType !== "animal" && (!resourceMarker?.mesh || resourceMarker.targetType !== targetType || resourceMetadata.targetable !== true || String(resourceMetadata.targetType || "").toLowerCase() !== targetType || exactMetadataEntityId(resourceMetadata) !== entityId)) return makeResult(false, { reason: makeReason("RESOURCE_MARKER_UNAVAILABLE", "No rendered resource marker matches this exact entity identity and type.", "target", { entityId, targetType }, true) });
      this._clearHighlightedTargetInternal();
      const meshes = resourceMarker ? new Set([resourceMarker.mesh]) : new Set(proxy.parts || []);
      if (proxy) try { for (const mesh of proxy.root?.getChildMeshes?.(false) || []) meshes.add(mesh); } catch { /* Procedural parts remain sufficient. */ }
      let color = null;
      const requestedColor = /^#[0-9a-f]{6}$/i.test(String(descriptor.highlightColor || "")) ? String(descriptor.highlightColor) : "#79f2c0";
      try { color = this._Babylon?.Color3?.FromHexString?.(requestedColor) || new this._Babylon.Color3(0.475, 0.949, 0.753); } catch { color = { r: 0.475, g: 0.949, b: 0.753 }; }
      for (const mesh of meshes) {
        if (!mesh) continue;
        this._highlightedMeshes.set(mesh, { renderOverlay: mesh.renderOverlay, overlayColor: mesh.overlayColor, overlayAlpha: mesh.overlayAlpha });
        try {
          mesh.overlayColor = color;
          mesh.overlayAlpha = clamp(descriptor.alpha ?? 0.24, 0.05, 0.65);
          mesh.renderOverlay = true;
        } catch { this._highlightedMeshes.delete(mesh); }
      }
      if (!this._highlightedMeshes.size) return makeResult(false, { reason: makeReason("TARGET_MESH_UNAVAILABLE", "The selected world target has no highlightable render mesh.", "target", { entityId, speciesId: proxy?.id || "", targetType }, true) });
      this._highlightedTarget = freezeRecord({ id: entityId || proxy?.id, entityId, identityExact: true, speciesId: proxy?.id || "", type: targetType });
      return makeResult(true, { target: this._highlightedTarget, meshCount: this._highlightedMeshes.size });
    }

    clearHighlightedTarget() {
      const cleared = this._clearHighlightedTargetInternal();
      return makeResult(true, { target: null, cleared });
    }

    _syncProxyVisibility(speciesId) {
      const proxy = this._proxies.get(speciesId);
      if (!proxy || typeof proxy.root.setEnabled !== "function") return;
      proxy.root.setEnabled(speciesId === this._playerSpeciesId || this._visibleWildlifeSpecies.has(speciesId));
    }

    _applyPlayerPosition() {
      const proxy = this._proxies.get(this._playerSpeciesId);
      if (!proxy || !this._streamer) return;
      const ground = terrainSampleFromProvider(this._landscape, this._player.x, this._player.z, this._streamer.seed).height;
      proxy.baseY = ground + proxy.flightOffset + this._player.elevation;
      proxy.root.position.x = this._player.x - WORLD_HALF;
      proxy.root.position.y = proxy.baseY;
      proxy.root.position.z = this._player.z - WORLD_HALF;
      proxy.root.rotation.y = headingToProxyRotation(this._player.heading);
      this._creatureAssets?.syncPose(this._playerSpeciesId, this._player.x, this._player.z);
      if (this._streamer) this._streamer.update(this._player.x, this._player.z);
    }

    setPlayerState(state = {}) {
      if (!state || typeof state !== "object") return makeResult(false, { reason: makeReason("PLAYER_STATE_INVALID", "Player state must be an object.", "input", {}, true) });
      const suppliedEntityId = state.entityId ?? state.targetId ?? state.id ?? state.playerId;
      if (suppliedEntityId !== undefined) this._playerEntityId = safeEntityId(suppliedEntityId) || this._playerEntityId;
      if (state.speciesId !== undefined) {
        const selected = this.selectSpecies(state.speciesId);
        if (!selected.ok) return selected;
      }
      this._syncProxyIdentity(this._proxies.get(this._playerSpeciesId), this._playerEntityId, true, true);
      const previousX = this._player.x;
      const previousZ = this._player.z;
      if (state.x !== undefined) this._player.x = clamp(state.x, 0, WORLD_SIZE);
      if (state.z !== undefined || state.y !== undefined) this._player.z = clamp(state.z === undefined ? state.y : state.z, 0, WORLD_SIZE);
      if (state.heading !== undefined) {
        const nextHeading = finite(state.heading, this._player.heading);
        this._player.heading = nextHeading;
        if (Math.abs(shortestAngleDelta(this._gameplayCamera?.playerHeading, nextHeading)) > 1e-7) {
          this._gameplayCamera = normalizeGameplayCamera({ ...this._gameplayCamera, playerHeading: nextHeading }, this._gameplayCamera);
        }
      }
      if (state.elevation !== undefined) this._player.elevation = clamp(state.elevation, -20, 300);
      const sampledAt = now();
      const travel = Math.hypot(this._player.x - previousX, this._player.z - previousZ);
      const sampleSeconds = Math.max(0, (sampledAt - finite(this._playerMotion?.sampledAt, sampledAt)) / 1000);
      const explicitSpeed = state.movementSpeed ?? state.speed;
      const inferredSpeed = sampleSeconds > 1e-4 && travel <= 64 ? travel / sampleSeconds : 0;
      this._playerMotion = {
        speed: state.moving === false ? 0 : clamp(Number.isFinite(Number(explicitSpeed)) ? explicitSpeed : inferredSpeed, 0, 100),
        distance: finite(this._playerMotion?.distance, 0) + (travel <= 64 ? travel : 0),
        sampledAt
      };
      this._applyPlayerPosition();
      const interactionNow = now();
      const moved = Math.hypot(this._player.x - this._lastEnvironmentInteraction.x, this._player.z - this._lastEnvironmentInteraction.z);
      if (moved >= 1.2 && interactionNow - this._lastEnvironmentInteraction.at >= 150) {
        const terrain = terrainSampleFromProvider(this._landscape, this._player.x, this._player.z, this._streamer?.seed || hashSeed(this._options.seed));
        this.recordEnvironmentalInteraction({
          type: terrain.height <= WATER_LEVEL + 0.4 ? "water-step" : "footprint",
          x: this._player.x,
          z: this._player.z,
          y: terrain.height,
          speciesId: this._playerSpeciesId,
          radius: this._playerSpeciesId === "pteranodon" ? 0.5 : this._playerSpeciesId === "triceratops" ? 2.4 : 1.8,
          intensity: clamp(moved / 5, 0.35, 1)
        });
        this._lastEnvironmentInteraction = { x: this._player.x, z: this._player.z, at: interactionNow };
      }
      return makeResult(true, { player: freezeRecord({ ...this._player, speciesId: this._playerSpeciesId, entityId: this._playerEntityId, identityExact: true }) });
    }

    updatePlayer(state) { return this.setPlayerState(state); }

    recordEnvironmentalInteraction(input = {}) {
      if (!input || typeof input !== "object") return makeResult(false, { reason: makeReason("ENVIRONMENT_INTERACTION_INVALID", "Environmental interactions must be objects.", "input", {}, true) });
      const eventX = clamp(input.x, 0, WORLD_SIZE);
      const eventZ = clamp(input.z === undefined ? input.worldZ : input.z, 0, WORLD_SIZE);
      const groundY = terrainSampleFromProvider(this._landscape, eventX, eventZ, this._streamer?.seed || hashSeed(this._options.seed)).height;
      const event = freezeRecord({
        type: String(input.type || "footprint").replace(/[^a-z0-9-]/gi, "").slice(0, 32) || "footprint",
        x: eventX,
        y: clamp(finite(input.y, groundY), -512, 4096),
        z: eventZ,
        speciesId: String(input.speciesId || this._playerSpeciesId).replace(/[^a-z0-9-]/gi, "").slice(0, 48),
        radius: clamp(input.radius ?? 1, 0.1, 24),
        intensity: clamp(input.intensity ?? 0.6, 0, 1),
        at: finite(input.at, now())
      });
      try {
        if (this._environmentRenderer?.disturb) this._environmentRenderer.disturb(event);
        else this._vegetation?.disturb?.(event);
      } catch { /* Disturbance is a bounded visual enhancement. */ }
      try {
        const environment = this._waterWeather;
        if (event.type === "water-step") {
          environment?.interactions?.addSplash?.({ ...event, strength: event.intensity, surface: "water" });
          environment?.water?.emitRipple?.({ ...event, strength: event.intensity, surface: "water" });
          environment?.water?.emitWake?.({ ...event, strength: event.intensity * 0.7, surface: "water" });
        } else environment?.interactions?.addFootprint?.({ ...event, strength: event.intensity, surface: event.type.includes("snow") ? "snow" : "soil" });
        environment?.interactions?.addDisturbance?.({ ...event, strength: event.intensity, compression: event.intensity });
        environment?.interactions?.addWetness?.({ ...event, wetness: this._environmentRenderState?.weather?.wetness || 0, surface: "ground" });
      } catch { /* Water/footprint fallback remains optional. */ }
      return makeResult(true, { interaction: event });
    }

    selectSpecies(speciesId) {
      const id = String(speciesId || "").toLowerCase();
      if (!FLAGSHIP_IDS.includes(id)) return makeResult(false, { reason: makeReason("SPECIES_PROXY_UNAVAILABLE", "This foundation provides only four bounded Mesozoic proxy species.", "input", { supported: FLAGSHIP_IDS.slice() }, true) });
      const previousId = this._playerSpeciesId;
      this._playerSpeciesId = id;
      if (previousId !== id) this._syncProxyIdentity(this._proxies.get(previousId), "", false, false);
      this._syncProxyIdentity(this._proxies.get(id), this._playerEntityId, true, true);
      this._syncProxyVisibility(previousId);
      this._syncProxyVisibility(id);
      this._applyPlayerPosition();
      this._emitStatus({ change: "species", speciesId: id });
      return makeResult(true, { speciesId: id });
    }

    updateFlagship(speciesId, state = {}) {
      const proxy = this._proxies.get(String(speciesId || "").toLowerCase());
      if (!proxy) return makeResult(false, { reason: makeReason("SPECIES_PROXY_UNAVAILABLE", "No 3D proxy exists for this species.", "input", { speciesId }, true) });
      const suppliedEntityId = state.entityId ?? state.targetId ?? state.id;
      const isPlayerProxy = proxy.id === this._playerSpeciesId;
      if (!isPlayerProxy && suppliedEntityId !== undefined) {
        const entityId = safeEntityId(suppliedEntityId);
        const occupied = entityId ? this._proxyByEntityId.get(entityId) : null;
        if (occupied && occupied !== proxy) return makeResult(false, { reason: makeReason("ENTITY_ID_CONFLICT", "A rendered proxy already owns this exact entity identity.", "input", { entityId, speciesId: proxy.id }, true) });
        this._syncProxyIdentity(proxy, entityId, false, true);
      }
      const worldX = clamp(state.x === undefined ? proxy.root.position.x + WORLD_HALF : state.x, 0, WORLD_SIZE);
      const worldZ = clamp(state.z === undefined ? (state.y === undefined ? proxy.root.position.z + WORLD_HALF : state.y) : state.z, 0, WORLD_SIZE);
      const altitude = proxy.flightOffset + clamp(state.elevation || 0, -20, 300);
      proxy.baseY = terrainSampleFromProvider(this._landscape, worldX, worldZ, this._streamer ? this._streamer.seed : hashSeed(this._options.seed)).height + altitude;
      proxy.root.position.x = worldX - WORLD_HALF;
      proxy.root.position.y = proxy.baseY;
      proxy.root.position.z = worldZ - WORLD_HALF;
      if (state.heading !== undefined) proxy.root.rotation.y = headingToProxyRotation(state.heading);
      this._creatureAssets?.syncPose(proxy.id, worldX, worldZ);
      if (state.visible !== undefined) {
        if (state.visible) this._visibleWildlifeSpecies.add(proxy.id);
        else {
          this._visibleWildlifeSpecies.delete(proxy.id);
          if (!isPlayerProxy) this._syncProxyIdentity(proxy, "", false, false);
        }
        this._syncProxyVisibility(proxy.id);
      }
      return makeResult(true, { speciesId: proxy.id, entityId: proxy.entityId || "", identityExact: proxy.identityExact === true, x: worldX, z: worldZ, elevation: altitude });
    }

    setTimeOfDay(hour) {
      this._environment.hour = ((finite(hour, this._environment.hour) % 24) + 24) % 24;
      this._applyEnvironment();
      return makeResult(true, { hour: this._environment.hour });
    }

    setFog(value) {
      if (value === false || value === null) this._environment.fog = { enabled: false };
      else if (value && typeof value === "object") this._environment.fog = {
        enabled: value.enabled !== false,
        density: clamp(value.density === undefined ? 0.0018 : value.density, 0, 0.02),
        color: Array.isArray(value.color) ? value.color.slice(0, 3).map((channel) => clamp(channel, 0, 1)) : null
      };
      else this._environment.fog = { enabled: Boolean(value), density: 0.0018, color: null };
      this._applyEnvironment();
      return makeResult(true, { fog: freezeRecord({ ...this._environment.fog }) });
    }

    setWeather(value) {
      const weather = typeof value === "string" ? value : value && value.type;
      const allowed = ["clear", "mist", "rain", "storm", "ash"];
      this._environment.weather = allowed.includes(weather) ? weather : "clear";
      if (value && typeof value === "object" && value.dayCycleMinutes !== undefined) this._environment.dayCycleMinutes = clamp(value.dayCycleMinutes, 0, 1440);
      this._applyEnvironment();
      return makeResult(true, { weather: this._environment.weather });
    }

    setEnvironment(value = {}) {
      if (!value || typeof value !== "object") return makeResult(false, { reason: makeReason("ENVIRONMENT_INVALID", "Environment settings must be an object.", "input", {}, true) });
      if (value.timeOfDay !== undefined || value.hour !== undefined) this._environment.hour = ((finite(value.timeOfDay === undefined ? value.hour : value.timeOfDay, this._environment.hour) % 24) + 24) % 24;
      if (value.weather !== undefined) this.setWeather(value.weather);
      if (value.fog !== undefined) this.setFog(value.fog);
      if (value.dayCycleMinutes !== undefined) this._environment.dayCycleMinutes = clamp(value.dayCycleMinutes, 0, 1440);
      this._applyEnvironment();
      return makeResult(true, { environment: this.getEnvironment() });
    }

    getEnvironment() {
      return freezeRecord({ hour: this._environment.hour, weather: this._environment.weather, fog: this._environment.fog ? freezeRecord({ ...this._environment.fog }) : null, dayCycleMinutes: this._environment.dayCycleMinutes });
    }

    setPhotoSettings(value = {}) {
      if (!value || typeof value !== "object" || !this._camera || !this._scene) return makeResult(false, { reason: makeReason("PHOTO_SETTINGS_UNAVAILABLE", "Photo controls require a running 3D scene.", "photo", {}, true) });
      const next = { ...this._photoSettings };
      if (value.sensorHeightMm !== undefined) next.sensorHeightMm = clamp(value.sensorHeightMm, 8, 70);
      if (value.focalLengthMm !== undefined || value.focalLength !== undefined) {
        next.focalLengthMm = clamp(value.focalLengthMm === undefined ? value.focalLength : value.focalLengthMm, 8, 600);
        this._camera.fov = this._fovFromFocalLength(next.focalLengthMm, next.sensorHeightMm);
      } else if (value.fovDegrees !== undefined) {
        const fovDegrees = clamp(value.fovDegrees, 5, 120);
        this._camera.fov = fovDegrees * Math.PI / 180;
        next.focalLengthMm = this._focalLengthFromFov(this._camera.fov, next.sensorHeightMm);
      } else if (value.sensorHeightMm !== undefined) {
        this._camera.fov = this._fovFromFocalLength(next.focalLengthMm, next.sensorHeightMm);
      }

      const apertureInput = value.apertureFStop === undefined ? value.aperture : value.apertureFStop;
      const isoInput = value.iso === undefined ? value.ISO : value.iso;
      const focusInput = value.focusDistanceM === undefined ? value.focusDistance : value.focusDistanceM;
      const compensationInput = value.exposureCompensationEv === undefined ? value.exposureCompensation : value.exposureCompensationEv;
      const physicalExposureChanged = apertureInput !== undefined || value.shutterSeconds !== undefined || value.shutterSpeed !== undefined || isoInput !== undefined || compensationInput !== undefined;
      if (apertureInput !== undefined) next.apertureFStop = clamp(apertureInput, 1.2, 32);
      if (value.shutterSeconds !== undefined) next.shutterSeconds = clamp(value.shutterSeconds, 1 / 8000, 30);
      else if (value.shutterSpeed !== undefined) {
        const speed = Math.max(1 / 30, finite(value.shutterSpeed, 125));
        next.shutterSeconds = clamp(speed >= 1 ? 1 / speed : speed, 1 / 8000, 30);
      }
      if (isoInput !== undefined) next.iso = Math.round(clamp(isoInput, 25, 51200));
      if (focusInput !== undefined) next.focusDistanceM = clamp(focusInput, 0.25, 10000);
      if (compensationInput !== undefined) next.exposureCompensationEv = clamp(compensationInput, -5, 5);
      if (value.depthOfField !== undefined || value.dofEnabled !== undefined) next.depthOfField = Boolean(value.depthOfField === undefined ? value.dofEnabled : value.depthOfField);
      if (value.autofocus !== undefined) next.autofocus = Boolean(value.autofocus);
      if (value.cameraShake !== undefined) next.cameraShake = clamp(value.cameraShake, 0, 1);

      if (value.exposure !== undefined) next.exposure = clamp(value.exposure, 0.25, 4);
      else if (physicalExposureChanged) {
        const relativeExposure = (next.iso / DEFAULT_PHOTO_SETTINGS.iso)
          * (next.shutterSeconds / DEFAULT_PHOTO_SETTINGS.shutterSeconds)
          * Math.pow(DEFAULT_PHOTO_SETTINGS.apertureFStop / next.apertureFStop, 2)
          * Math.pow(2, next.exposureCompensationEv);
        next.exposure = clamp(DEFAULT_PHOTO_SETTINGS.exposure * relativeExposure, 0.25, 4);
      } else next.exposure = clamp(this._scene.imageProcessingConfiguration?.exposure || next.exposure, 0.25, 4);

      this._photoSettings = next;
      this._photoCameraOverride = true;
      if (this._scene.imageProcessingConfiguration) this._scene.imageProcessingConfiguration.exposure = next.exposure;
      const depthOfFieldActive = this._applyPhysicalDepthOfField();
      return makeResult(true, { ...this.getPhotoSettings(), depthOfFieldActive });
    }

    getPhotoSettings() {
      const fovDegrees = this._camera ? this._camera.fov * 180 / Math.PI : this._fovFromFocalLength(this._photoSettings.focalLengthMm, this._photoSettings.sensorHeightMm) * 180 / Math.PI;
      return freezeRecord({
        ...this._photoSettings,
        effectiveFocusDistanceM: Math.round(this._effectiveFocusDistanceM() * 100) / 100,
        fovDegrees: Math.round(fovDegrees * 10) / 10,
        shutterSpeed: Math.round((1 / this._photoSettings.shutterSeconds) * 10) / 10,
        depthOfFieldAvailable: Boolean(this._postProcessing?.defaultPipeline && this._qualityPreset === CINEMATIC_PRESET && !this._reducedMotion),
        depthOfFieldActive: Boolean(this._postProcessing?.defaultPipeline?.depthOfFieldEnabled)
      });
    }

    _applyEnvironment(announce = true) {
      if (!this._scene || !this._Babylon || !this._lights) return;
      const B = this._Babylon;
      const hour = this._environment.hour;
      const angle = (hour - 6) / 24 * Math.PI * 2;
      const elevation = Math.sin(angle);
      const daylight = clamp((elevation + 0.18) / 0.9, 0.04, 1);
      const dusk = 1 - clamp(Math.abs(elevation) * 4, 0, 1);
      const weatherFactors = {
        clear: { light: 1, fog: 0.00055 }, mist: { light: 0.83, fog: 0.0032 }, rain: { light: 0.72, fog: 0.0022 }, storm: { light: 0.48, fog: 0.0038 }, ash: { light: 0.58, fog: 0.0046 }
      };
      const weather = weatherFactors[this._environment.weather] || weatherFactors.clear;
      const sky = [
        lerp(0.025, 0.36, daylight) + dusk * 0.09,
        lerp(0.04, 0.59, daylight) + dusk * 0.035,
        lerp(0.09, 0.66, daylight)
      ];
      if (this._environment.weather === "storm") { sky[0] *= 0.55; sky[1] *= 0.62; sky[2] *= 0.68; }
      if (this._environment.weather === "ash") { sky[0] *= 0.82; sky[1] *= 0.6; sky[2] *= 0.46; }
      this._scene.clearColor = new B.Color4(sky[0], sky[1], sky[2], 1);
      this._lights.ambient.intensity = (0.18 + daylight * 0.58) * weather.light;
      this._lights.sun.intensity = (0.06 + daylight * 1.14) * weather.light;
      this._ambientBaseIntensity = this._lights.ambient.intensity;
      this._sunBaseIntensity = this._lights.sun.intensity;
      this._lights.sun.direction = new B.Vector3(-Math.cos(angle) * 0.66, -Math.max(0.08, elevation), Math.sin(angle) * 0.45);
      this._lights.sun.diffuse = new B.Color3(1, lerp(0.58, 0.96, daylight), lerp(0.38, 0.82, daylight));

      const override = this._environment.fog;
      const fogEnabled = !override || override.enabled !== false;
      this._scene.fogMode = fogEnabled ? B.Scene.FOGMODE_EXP2 : B.Scene.FOGMODE_NONE;
      this._fogBaseDensity = override && override.density !== undefined ? override.density : weather.fog;
      this._scene.fogDensity = this._fogBaseDensity;
      const fogColor = override && override.color || sky.map((channel) => channel * 0.82);
      this._scene.fogColor = makeColor3(B, fogColor);
      this._syncWeatherEffects();
      this._waterWeather?.configure?.({ weather: this._environment.weather, timeOfDay: hour, fog: this._environment.fog, reducedMotion: this._reducedMotion });
      this._environmentAssets?.syncEnvironment(hour, this._environment.weather);
      if (announce) safeCall(this._options.onEnvironmentChange, this.getEnvironment());
    }

    _syncWeatherEffects() {
      const effect = this._weatherFx;
      if (!effect?.rain) return;
      const rainy = this._environment.weather === "rain" || this._environment.weather === "storm";
      const budget = ENVIRONMENT_BUDGETS[this._qualityPreset].rainParticles;
      let rainOcclusion = 0;
      try {
        const chunkX = Math.floor(this._player.x / CHUNK_SIZE);
        const chunkZ = Math.floor(this._player.z / CHUNK_SIZE);
        const shelters = this._landscape?.getSheltersForChunk?.(chunkX, chunkZ) || this._landscape?.querySheltersInChunk?.(chunkX, chunkZ) || [];
        for (const shelter of shelters) {
          const distance = Math.hypot(this._player.x - finite(shelter?.position?.x), this._player.z - finite(shelter?.position?.z));
          const reach = clamp(finite(shelter?.radius, 2) + finite(shelter?.depth, 0) * 0.35, 1, 24);
          if (distance <= reach) rainOcclusion = Math.max(rainOcclusion, clamp(shelter?.rainOcclusion ?? 0.75, 0, 1) * (1 - distance / reach));
        }
      } catch { rainOcclusion = 0; }
      effect.rain.emitRate = rainy ? Math.round(budget * (this._environment.weather === "storm" ? 2.2 : 1.35) * (this._reducedMotion ? 0.45 : 1) * (1 - rainOcclusion)) : 0;
      effect.rain.direction1.x = this._environment.weather === "storm" ? -9 : -2.2;
      effect.rain.direction2.x = this._environment.weather === "storm" ? -4 : 1.2;
      if (rainy && !effect.active) {
        try { effect.rain.start(); effect.active = true; } catch { effect.active = false; }
      } else if (!rainy && effect.active) {
        try { effect.rain.stop(); } catch { /* Weather fallback remains visual-only. */ }
        effect.active = false;
      }
    }

    _animateAtmosphere() {
      const reduced = this._reducedMotion;
      if (this._water?.material) {
        this._water.material.alpha = reduced ? 0.72 : 0.7 + Math.sin(this._elapsed * 0.45) * 0.018;
        if (this._water.mesh?.position) {
          const stormWave = this._environment.weather === "storm" ? Math.sin(this._elapsed * 0.82) * 0.1 : 0;
          this._water.mesh.position.y = WATER_LEVEL + Math.sin(this._elapsed * 0.012) * 0.16 + stormWave;
        }
        const texture = this._water.normalTexture;
        if (texture && !reduced) {
          texture.uOffset = (this._elapsed * 0.0045) % 1;
          texture.vOffset = (this._elapsed * -0.0032) % 1;
        }
      }
      const targetY = finite(this._camera?.target?.y, WATER_LEVEL);
      if (this._scene && this._Babylon && this._scene.fogMode !== this._Babylon.Scene.FOGMODE_NONE) {
        const valleyFactor = clamp(1.42 - Math.max(0, targetY - WATER_LEVEL) / 88, 0.38, 1.42);
        const breathing = reduced ? 1 : 1 + Math.sin(this._elapsed * 0.13) * 0.035;
        this._scene.fogDensity = clamp(this._fogBaseDensity * valleyFactor * breathing, 0, 0.02);
      }
      if (this._weatherFx?.rain) {
        this._weatherFx.rain.emitter.x = this._player.x - WORLD_HALF;
        this._weatherFx.rain.emitter.y = targetY + 28;
        this._weatherFx.rain.emitter.z = this._player.z - WORLD_HALF;
      }
      this._environmentAssets?.animate(this._elapsed, this._environment.weather, reduced);
    }

    _updateProceduralEnvironment(deltaSeconds) {
      const sample = terrainSampleFromProvider(this._landscape, this._player.x, this._player.z, this._streamer?.seed || hashSeed(this._options.seed));
      const context = {
        elapsed: this._elapsed,
        deltaSeconds,
        player: { x: this._player.x, y: sample.height, z: this._player.z, speciesId: this._playerSpeciesId },
        camera: this._camera ? { x: finite(this._camera.position?.x) + WORLD_HALF, y: finite(this._camera.position?.y), z: finite(this._camera.position?.z) + WORLD_HALF } : null,
        cameraX: this._camera ? finite(this._camera.position?.x) + WORLD_HALF : this._player.x,
        cameraZ: this._camera ? finite(this._camera.position?.z) + WORLD_HALF : this._player.z,
        terrain: sample,
        time: this._elapsed,
        timeSeconds: this._elapsed,
        delta: deltaSeconds,
        hour: this._environment.hour,
        weather: this._environment.weather,
        quality: this._qualityPreset,
        reducedMotion: this._reducedMotion,
        visible: !(this._options.document || runtime.document)?.hidden
      };
      let renderState = null;
      if (this._waterWeather) {
        try {
          const updated = this._waterWeather.update(deltaSeconds, { ...context, collectState: false });
          renderState = updated && typeof updated === "object"
            ? updated
            : { weather: this._waterWeather.weather?.getState?.(), atmosphere: this._waterWeather.atmosphere?.getRenderState?.() };
        } catch (error) { safeCall(this._options.onTelemetry, { type: "water-weather-runtime-fallback", error: compactError(error) }); }
      }
      this._environmentRenderState = renderState;
      if (this._vegetation) {
        try {
          const weatherWind = renderState?.weather?.wind;
          const vegetationEnvironment = {
            wetness: renderState?.weather?.wetness ?? 0,
            snow: renderState?.weather?.snowCover ?? 0,
            burn: this._environment.weather === "ash" ? 0.18 : 0,
            mud: clamp((renderState?.weather?.wetness ?? 0) * (sample.moisture ?? 0.5), 0, 1),
            baseWindSpeed: weatherWind?.speed,
            windDirectionRadians: weatherWind ? Math.atan2(finite(weatherWind.z), finite(weatherWind.x, 1)) : undefined
          };
          if (this._environmentRenderer) {
            this._environmentRenderer.configure?.(vegetationEnvironment);
            const cameraForward = gameplayCameraForwardXZ(this._gameplayCameraApplied, this._gameplayCamera);
            this._environmentRenderer.update({
              playerX: this._player.x,
              playerZ: this._player.z,
              forwardX: cameraForward.x,
              forwardZ: cameraForward.z,
              fovRadians: this._camera?.fov,
              timeSeconds: this._elapsed,
              deltaSeconds,
              weather: { type: this._environment.weather, ...renderState?.weather, ...vegetationEnvironment },
              wetness: vegetationEnvironment.wetness
            });
          } else {
            this._vegetation.configure?.(vegetationEnvironment);
            this._vegetation.update({
              ...context,
              time: this._elapsed,
              dt: deltaSeconds,
              wetness: renderState?.wetness?.ground ?? renderState?.weather?.wetness ?? 0,
              wind: renderState?.wind || renderState?.weather?.wind || null
            });
          }
        } catch (error) { safeCall(this._options.onTelemetry, { type: "vegetation-runtime-fallback", error: compactError(error) }); }
      }

      const wetness = clamp(renderState?.wetness?.ground ?? renderState?.weather?.wetness ?? 0, 0, 1);
      const lightning = clamp(renderState?.lightning?.intensity ?? renderState?.weather?.flash?.intensity ?? renderState?.weather?.lightning ?? 0, 0, 1);
      if (this._streamer?.material && "roughness" in this._streamer.material) this._streamer.material.roughness = lerp(0.96, 0.68, wetness);
      const atmosphere = renderState?.atmosphere;
      const skyColor = atmosphere?.sky?.color;
      if (skyColor && this._scene && this._Babylon) this._scene.clearColor = new this._Babylon.Color4(clamp(skyColor.r, 0, 1), clamp(skyColor.g, 0, 1), clamp(skyColor.b, 0, 1), 1);
      if (this._lights?.sun) {
        const sunDirection = atmosphere?.sun?.direction;
        if (sunDirection && this._Babylon) this._lights.sun.direction = new this._Babylon.Vector3(-finite(sunDirection.x), -Math.max(0.04, finite(sunDirection.y)), -finite(sunDirection.z));
        this._lights.sun.intensity = finite(atmosphere?.sun?.intensity, this._sunBaseIntensity) + lightning * 2.8;
      }
      if (this._lights?.ambient) {
        const ambientColor = atmosphere?.ambient?.color;
        if (ambientColor && this._Babylon) this._lights.ambient.diffuse = new this._Babylon.Color3(clamp(ambientColor.r, 0, 1), clamp(ambientColor.g, 0, 1), clamp(ambientColor.b, 0, 1));
        this._lights.ambient.intensity = finite(atmosphere?.ambient?.intensity, this._ambientBaseIntensity) + lightning * 0.8;
      }
      const layeredFogDensity = Array.isArray(atmosphere?.fogLayers) ? atmosphere.fogLayers.reduce((sum, layer) => sum + clamp(layer?.density, 0, 0.1), 0) * 0.09 : NaN;
      const fogDensity = finite(atmosphere?.fogDensity ?? renderState?.fog?.density ?? layeredFogDensity, NaN);
      if (this._scene && Number.isFinite(fogDensity) && this._scene.fogMode !== this._Babylon?.Scene?.FOGMODE_NONE) {
        this._scene.fogDensity = clamp(Math.max(this._scene.fogDensity, fogDensity), 0, 0.02);
      }
      const hourAngle = (this._environment.hour - 6) / 24 * Math.PI * 2;
      const fallbackDaylight = clamp((Math.sin(hourAngle) + 0.08) / 0.35, 0, 1);
      this._readabilityState = enforceClearDaylightReadability(this._Babylon, this._scene, this._lights, this._streamer?.material, {
        daylight: atmosphere?.sun?.daylight == null ? fallbackDaylight : atmosphere.sun.daylight,
        weather: this._environment.weather,
        allowExposureFloor: finite(this._photoSettings.exposure, DEFAULT_PHOTO_SETTINGS.exposure) >= READABILITY_FLOORS.exposure
      });
    }

    setQualityPreset(value, options = {}) {
      const preset = normalizePreset(value, "");
      if (!preset) return makeResult(false, { reason: makeReason("QUALITY_PRESET_INVALID", "Unknown graphics preset.", "input", { supported: QUALITY_ORDER.slice() }, true) });
      if (options.requested !== false) this._qualityRequested = preset;
      if (options.adaptive !== undefined) this._governor.enabled = Boolean(options.adaptive);
      this._applyQuality(preset, options.reason || "user", true);
      return makeResult(true, { qualityPreset: this._qualityPreset, requestedPreset: this._qualityRequested, adaptive: this._governor.enabled });
    }

    _applyQuality(value, reason, announce) {
      let presetId = normalizePreset(value);
      if (this._reducedMotion && QUALITY_ORDER.indexOf(presetId) > QUALITY_ORDER.indexOf("low")) presetId = "low";
      const preset = QUALITY_PRESETS[presetId];
      const changed = presetId !== this._qualityPreset;
      this._qualityPreset = presetId;
      if (this._engine && typeof this._engine.setHardwareScalingLevel === "function") {
        const targetScale = clamp(1 / preset.renderScale, 1, 2.25);
        const currentScale = typeof this._engine.getHardwareScalingLevel === "function" ? this._engine.getHardwareScalingLevel() : NaN;
        if (!Number.isFinite(currentScale) || Math.abs(currentScale - targetScale) > 0.001) this._engine.setHardwareScalingLevel(targetScale);
      }
      if (this._camera) this._camera.maxZ = preset.farClip;
      if (changed && this._scene) this._rebuildRenderingFeatures(presetId, true);
      if (this._streamer) {
        this._streamer.configure(preset);
        this._streamer.update(this._player.x, this._player.z, true);
      }
      this._environmentAssets?.configure(presetId);
      this._vegetation?.configure?.({ quality: presetId, reducedMotion: this._reducedMotion });
      const environmentBudget = PROCEDURAL_ENVIRONMENT_BUDGETS[presetId];
      this._environmentRenderer?.configure?.({ quality: presetId, reducedMotion: this._reducedMotion, maxActiveChunks: environmentBudget.chunks, maxActiveInstances: environmentBudget.instances, maxInstancesPerChunk: environmentBudget.perChunk });
      this._waterWeather?.configure?.({ quality: presetId, reducedMotion: this._reducedMotion, maxParticles: ENVIRONMENT_BUDGETS[presetId].rainParticles });
      this._syncWeatherEffects();
      if (this._canvas) this._canvas.setAttribute("data-hwe-3d-quality", presetId);
      if (changed && announce) {
        const detail = freezeRecord({ qualityPreset: presetId, requestedPreset: this._qualityRequested, reason: String(reason || "unknown") });
        safeCall(this._options.onQualityChange, detail);
        this._emitStatus({ change: "quality", quality: detail });
      }
    }

    _shiftAdaptiveQuality(direction, reason) {
      const currentIndex = QUALITY_ORDER.indexOf(this._qualityPreset);
      const requestedIndex = QUALITY_ORDER.indexOf(this._qualityRequested);
      const adaptiveMaxIndex = QUALITY_ORDER.indexOf(ADAPTIVE_MAX_PRESET);
      // Cinematic Personal is an explicit owner-controlled profile. The
      // governor may step down from it to protect responsiveness, but it must
      // never spend the user's GPU/VRAM budget by enabling it automatically.
      if (Math.sign(direction) > 0 && currentIndex >= adaptiveMaxIndex) return;
      let targetIndex = Math.max(0, Math.min(currentIndex + Math.sign(direction), requestedIndex, adaptiveMaxIndex));
      if (this._reducedMotion) targetIndex = Math.min(targetIndex, QUALITY_ORDER.indexOf("low"));
      if (targetIndex !== currentIndex) this._applyQuality(QUALITY_ORDER[targetIndex], reason, true);
    }

    _animateProxies(deltaSeconds) {
      this._elapsed += deltaSeconds;
      if (!this._reducedMotion) {
        let index = 0;
        for (const proxy of this._proxies.values()) {
          const phase = this._elapsed * (proxy.id === "pteranodon" ? 1.9 : 1.15) + index * 0.9;
          proxy.root.position.y = proxy.baseY + Math.sin(phase) * (proxy.id === "pteranodon" ? 0.45 : 0.075);
          for (const wing of proxy.wings) wing.mesh.rotation.x = wing.baseRotation + Math.sin(phase * 2.2) * (wing.side === "left" ? 0.22 : -0.22);
          index += 1;
        }
      }
      this._animateAtmosphere();
      this._updateProceduralEnvironment(deltaSeconds);
    }

    _followPlayer(deltaSeconds, immediate = false) {
      if (!this._camera || !this._Babylon) return;
      const proxy = this._proxies.get(this._playerSpeciesId);
      if (!proxy) return;
      const stableBaseY = finite(proxy.baseY, finite(proxy.root?.position?.y, 0));
      let cameraState = this._gameplayCamera || DEFAULT_GAMEPLAY_CAMERA;
      const massFactor = proxy.id === "pteranodon" ? 0.34 : proxy.id === "triceratops" ? 0.92 : 1;
      if (cameraState.active) {
        const profile = GAMEPLAY_CAMERA_PROFILES[cameraState.profileId] || GAMEPLAY_CAMERA_PROFILES.ground;
        const current = this._gameplayCameraApplied || { yaw: cameraState.yaw, pitch: cameraState.pitch, distance: cameraState.distance, collisionDistance: cameraState.distance };
        const delta = clamp(deltaSeconds, 0, 0.1);
        const movementSpeed = Math.max(finite(cameraState.movementSpeed, 0), finite(this._playerMotion?.speed, 0));
        this._gameplayCameraManualIdleSeconds = Math.min(60, this._gameplayCameraManualIdleSeconds + delta);
        if (!this._reducedMotion && cameraState.autoCenter && !cameraState.lookBack && movementSpeed > 0.05 && this._gameplayCameraManualIdleSeconds >= cameraState.autoCenterDelay && cameraState.autoCenterRate > 0) {
          const centerAmount = immediate ? 1 : 1 - Math.exp(-delta * cameraState.autoCenterRate);
          const autoCenterHeading = finite(cameraState.playerHeading, this._player.heading);
          const centeredYaw = wrapAngle(cameraState.yaw + shortestAngleDelta(cameraState.yaw, autoCenterHeading) * centerAmount);
          if (Math.abs(shortestAngleDelta(cameraState.yaw, centeredYaw)) > 1e-7) {
            cameraState = normalizeGameplayCamera({ ...cameraState, yaw: centeredYaw, playerHeading: autoCenterHeading }, cameraState);
            this._gameplayCamera = cameraState;
            this._gameplayCameraYawOverrideLatched = true;
          }
        }
        const displayYaw = wrapAngle(cameraState.yaw + (cameraState.lookBack ? Math.PI : 0));
        const followAmount = immediate || this._reducedMotion || cameraState.smoothing <= 0
          ? 1
          : 1 - Math.exp(-delta * cameraState.smoothing);
        current.yaw = wrapAngle(current.yaw + shortestAngleDelta(current.yaw, displayYaw) * followAmount);
        current.pitch = lerp(current.pitch, cameraState.pitch, followAmount);
        current.distance = lerp(current.distance, cameraState.distance, followAmount);
        this._gameplayCameraApplied = current;

        if (this._gameplayCameraLimitsDirty) {
          this._camera.lowerBetaLimit = clamp(Math.PI / 2 + profile.minPitch, 0.05, Math.PI - 0.06);
          this._camera.upperBetaLimit = clamp(Math.PI / 2 + profile.maxPitch, this._camera.lowerBetaLimit + 0.01, Math.PI - 0.05);
          this._camera.lowerRadiusLimit = cameraState.firstPerson ? 0.1 : profile.minDistance;
          this._camera.upperRadiusLimit = profile.maxDistance;
          this._gameplayCameraLimitsDirty = false;
        }
        if (this._gameplayCameraFovDirty) {
          this._camera.fov = cameraState.fov * Math.PI / 180;
          this._gameplayCameraFovDirty = false;
        }
        const arc = gameplayCameraToArc({ ...cameraState, yaw: current.yaw, pitch: current.pitch, distance: current.distance });
        this._camera.alpha = arc.alpha;
        this._camera.beta = arc.beta;

        const lookAhead = cameraState.firstPerson ? clamp(profile.targetHeight * 0.5, 0.6, 1.2) : 0;
        const firstPersonOffset = lookAhead > 0 ? gameplayCameraOffset(current.yaw, current.pitch, lookAhead) : null;
        const configuredShake = this._photoCameraOverride ? this._photoSettings.cameraShake : cameraState.cameraShake;
        const shake = this._reducedMotion ? 0 : clamp(configuredShake, 0, 1) * massFactor * 0.08;
        const rightX = Math.cos(current.yaw);
        const rightZ = -Math.sin(current.yaw);
        const shoulderOffset = clamp(cameraState.shoulderOffset, -profile.maxShoulderOffset, profile.maxShoulderOffset);
        const motionAmount = clamp(movementSpeed / 8, 0, 1);
        const bobAmplitude = this._reducedMotion ? 0 : clamp(cameraState.headBob, 0, 1) * profile.headBobScale * motionAmount;
        const bobPhase = finite(this._playerMotion?.distance, 0) * profile.headBobCyclesPerMeter * Math.PI * 2;
        const lateralBob = Math.sin(bobPhase) * bobAmplitude * 0.35;
        const verticalBob = Math.sin(bobPhase * 2) * bobAmplitude;
        current.shoulderOffset = shoulderOffset;
        current.headBobOffset = verticalBob;
        const desiredTarget = new this._Babylon.Vector3(
          finite(proxy.root?.position?.x) - (firstPersonOffset?.x || 0) + rightX * (shoulderOffset + lateralBob) + Math.sin(this._elapsed * 7.1) * shake,
          stableBaseY + profile.targetHeight - (firstPersonOffset?.y || 0) + verticalBob + Math.sin(this._elapsed * 11.3) * shake * 0.65,
          finite(proxy.root?.position?.z) - (firstPersonOffset?.z || 0) + rightZ * (shoulderOffset + lateralBob) + Math.cos(this._elapsed * 6.4) * shake
        );
        const targetAmount = immediate || this._reducedMotion || !this._camera.target ? 1 : followAmount;
        const target = targetAmount >= 1 ? desiredTarget : new this._Babylon.Vector3(
          lerp(this._camera.target.x, desiredTarget.x, targetAmount),
          lerp(this._camera.target.y, desiredTarget.y, targetAmount),
          lerp(this._camera.target.z, desiredTarget.z, targetAmount)
        );
        this._camera.setTarget(target);
        const desiredDistance = lookAhead || current.distance;
        const collision = this.resolveGameplayCameraCollision({
          origin: target,
          yaw: current.yaw,
          pitch: current.pitch,
          desiredDistance,
          deltaSeconds: delta,
          commit: true
        });
        current.collisionDistance = collision.resolvedDistance;
        this._camera.radius = collision.resolvedDistance;
        return;
      }

      // Legacy/photo follow remains available for isolated demos, but follows
      // the authoritative base height rather than the animated proxy bob.
      const shake = this._reducedMotion ? 0 : clamp(this._photoSettings.cameraShake, 0, 1) * massFactor * 0.08;
      const desiredTarget = new this._Babylon.Vector3(
        finite(proxy.root?.position?.x) + Math.sin(this._elapsed * 7.1) * shake,
        stableBaseY + (proxy.id === "pteranodon" ? 0.6 : 2.4) + Math.sin(this._elapsed * 11.3) * shake * 0.65,
        finite(proxy.root?.position?.z) + Math.cos(this._elapsed * 6.4) * shake
      );
      const amount = immediate || this._reducedMotion || !this._camera.target ? 1 : 1 - Math.exp(-clamp(deltaSeconds, 0, 0.1) * 8);
      const target = amount >= 1 ? desiredTarget : new this._Babylon.Vector3(
        lerp(this._camera.target.x, desiredTarget.x, amount),
        lerp(this._camera.target.y, desiredTarget.y, amount),
        lerp(this._camera.target.z, desiredTarget.z, amount)
      );
      this._camera.setTarget(target);
      this._gameplayCameraApplied = {
        yaw: wrapAngle(-finite(this._camera.alpha, -Math.PI / 2) - Math.PI / 2),
        pitch: finite(this._camera.beta, Math.PI / 2) - Math.PI / 2,
        distance: finite(this._camera.radius, 27),
        collisionDistance: finite(this._camera.radius, 27)
      };
    }

    _renderFrame() {
      if (this._state !== "running" || !this._scene || !this._engine) return;
      const startedAt = now();
      const rawDelta = this._lastFrameAt ? (startedAt - this._lastFrameAt) / 1000 : 1 / 60;
      const deltaSeconds = clamp(rawDelta, 0, 0.1);
      this._lastFrameAt = startedAt;
      try {
        if (this._environment.dayCycleMinutes > 0) {
          this._environment.hour = (this._environment.hour + deltaSeconds * 24 / (this._environment.dayCycleMinutes * 60)) % 24;
          this._applyEnvironment(false);
        }
        this._streamer.update(this._player.x, this._player.z);
        this._streamer.process(this._reducedMotion ? 1 : undefined);
        this._environmentAssets?.update(this._player.x, this._player.z);
        this._creatureAssets?._advanceClipTransitions(startedAt);
        this._animateProxies(deltaSeconds);
        this._followPlayer(deltaSeconds);
        let drawCallsBefore = NaN;
        try { drawCallsBefore = Number(this._engine?._drawCalls?.current); }
        catch { /* Babylon draw-call telemetry is optional. */ }
        this._scene.render();
        try {
          const drawCallsAfter = Number(this._engine?._drawCalls?.current);
          if (Number.isFinite(drawCallsAfter)) {
            const perFrame = Number.isFinite(drawCallsBefore) && drawCallsAfter >= drawCallsBefore
              ? drawCallsAfter - drawCallsBefore
              : drawCallsAfter;
            this._lastFrameDrawCalls = Math.max(0, Math.floor(perFrame));
            this._drawCallsMeasured = true;
          }
        } catch { /* Keep the mesh-derived estimate when the backend has no counter. */ }
        const finishedAt = now();
        // Visibility suspension stops the render loop and resume() resets
        // _lastFrameAt, so every remaining long delta is a real observed hitch.
        this._governor.record(Math.max(finishedAt - startedAt, rawDelta * 1000), finishedAt);
        if (finishedAt - this._lastTelemetryAt >= 1000) {
          this._lastTelemetryAt = finishedAt;
          safeCall(this._options.onTelemetry, this.getTelemetry());
        }
      } catch (error) {
        this._handleRuntimeFailure(makeReason("RENDER_LOOP_FAILED", "The 3D render loop stopped safely; 2D mode remains available.", "runtime", { error: compactError(error), backend: this._backend }, true));
      }
    }

    _getRenderingFeatureStatus() {
      const pipelines = this._postProcessing;
      return freezeRecord({
        preset: this._renderFeaturePreset || this._qualityPreset,
        cinematicRequested: this._qualityPreset === CINEMATIC_PRESET,
        supportedBackend: Boolean(pipelines?.supportedBackend),
        shadow: this._lights?.shadow ? String(this._lights.shadowKind || "standard") : "disabled",
        taa: Boolean(pipelines?.taa),
        defaultPipeline: Boolean(pipelines?.defaultPipeline),
        ssao2: Boolean(pipelines?.ssao),
        ssr: Boolean(pipelines?.ssr),
        active: Array.isArray(pipelines?.active) ? pipelines.active.slice() : [],
        failures: this._postProcessingFailureHistory.slice(-8)
      });
    }

    _collectRenderTelemetry() {
      const scene = this._scene;
      const engine = this._engine;
      if (!scene || !engine) return freezeRecord({ drawCalls: 0, triangles: 0, vertices: 0, visibleMeshes: 0, textures: 0, estimatedVramBytes: 0, estimatedVramMiB: 0, drawCallsMeasured: false });
      let activeMeshes = [];
      try {
        const active = typeof scene.getActiveMeshes === "function" ? scene.getActiveMeshes() : null;
        if (Array.isArray(active)) activeMeshes = active;
        else if (active?.data && Number.isFinite(active.length)) activeMeshes = active.data.slice(0, active.length);
      } catch { /* Scene counters remain best effort. */ }
      if (!activeMeshes.length) {
        activeMeshes = Array.from(scene.meshes || []).filter((mesh) => {
          try { return mesh && mesh.isVisible !== false && (typeof mesh.isEnabled !== "function" || mesh.isEnabled()); }
          catch { return false; }
        });
      }

      let estimatedDrawCalls = 0;
      let triangles = 0;
      let vertices = 0;
      for (const mesh of activeMeshes) {
        estimatedDrawCalls += Math.max(1, Array.isArray(mesh?.subMeshes) ? mesh.subMeshes.length : 1);
        try {
          const indices = finite(typeof mesh.getTotalIndices === "function" ? mesh.getTotalIndices() : 0, 0);
          triangles += Math.max(0, Math.floor(indices / 3));
        } catch { /* Optional imported mesh. */ }
        try { vertices += Math.max(0, Math.floor(finite(typeof mesh.getTotalVertices === "function" ? mesh.getTotalVertices() : 0, 0))); }
        catch { /* Optional imported mesh. */ }
      }
      try {
        const activeIndices = finite(typeof scene.getActiveIndices === "function" ? scene.getActiveIndices() : 0, 0);
        if (activeIndices > 0) triangles = Math.floor(activeIndices / 3);
      } catch { /* Keep the mesh-derived estimate. */ }

      const measuredDrawCalls = this._drawCallsMeasured ? this._lastFrameDrawCalls : 0;
      const drawCalls = this._drawCallsMeasured ? measuredDrawCalls : estimatedDrawCalls;

      let textureList = [];
      let usesInternalTextureCache = false;
      try {
        if (typeof engine.getLoadedTexturesCache === "function") {
          textureList = Array.from(engine.getLoadedTexturesCache() || []);
          usesInternalTextureCache = textureList.length > 0;
        }
      } catch { /* Fall through to public scene textures. */ }
      if (!textureList.length) textureList = Array.from(scene.textures || []);
      const uniqueTextures = Array.from(new Set(textureList.filter(Boolean)));
      let textureBytes = 0;
      for (const texture of uniqueTextures) {
        try {
          const size = typeof texture.getSize === "function" ? texture.getSize() : texture;
          const width = clamp(size?.width || texture.width || texture.baseWidth || 1, 1, 32768);
          const height = clamp(size?.height || texture.height || texture.baseHeight || 1, 1, 32768);
          const depth = clamp(size?.depth || texture.depth || 1, 1, 2048);
          const faces = texture.isCube ? 6 : 1;
          const bytesPerPixel = texture.type === 1 ? 16 : texture.type === 2 ? 8 : 4;
          const mipFactor = texture.generateMipMaps || texture._generateMipMaps ? 4 / 3 : 1;
          textureBytes += width * height * depth * faces * bytesPerPixel * mipFactor;
        } catch { /* Texture memory is an estimate, never a render dependency. */ }
      }
      const renderWidth = clamp(typeof engine.getRenderWidth === "function" ? engine.getRenderWidth() : this._canvas?.width || 1, 1, 32768);
      const renderHeight = clamp(typeof engine.getRenderHeight === "function" ? engine.getRenderHeight() : this._canvas?.height || 1, 1, 32768);
      const activeEffects = this._postProcessing?.active?.length || 0;
      const backAndDepthBuffers = renderWidth * renderHeight * 12;
      const untrackedRenderTargets = usesInternalTextureCache ? 0 : renderWidth * renderHeight * 8 * (activeEffects * 2 + (this._postProcessing?.taa ? 2 : 0));
      const meshBytes = vertices * 48 + triangles * 3 * 4;
      const estimatedVramBytes = Math.max(0, Math.round(textureBytes + backAndDepthBuffers + untrackedRenderTargets + meshBytes));
      return freezeRecord({
        drawCalls,
        triangles,
        vertices,
        visibleMeshes: activeMeshes.length,
        textures: uniqueTextures.length,
        estimatedVramBytes,
        estimatedVramMiB: Math.round(estimatedVramBytes / 104857.6) / 10,
        drawCallsMeasured: this._drawCallsMeasured
      });
    }

    getTelemetry() {
      const streaming = this._streamer ? this._streamer.getStats() : freezeRecord({ activeChunks: 0, queuedChunks: 0, maxChunks: 0, chunkSize: CHUNK_SIZE, worker: freezeRecord({ active: false, pending: 0, disabled: true, failures: [] }) });
      const environmentAssets = this._environmentAssets ? this._environmentAssets.getStatus() : freezeRecord({ status: "procedural", loadedAssets: [], loadedInstances: 0, visibleInstances: 0, hdr: false, failures: [] });
      const creatureAssets = this._creatureAssets ? this._creatureAssets.getStatus() : freezeRecord({ status: "procedural", loadedSpecies: [], activeClips: freezeRecord({}), productionApproved: false, failures: [] });
      const cinematicAudio = this._cinematicAudio ? this._cinematicAudio.getStatus() : freezeRecord({ status: "fallback", enabled: false, channel: "", playing: false, playBlocked: false, productionApproved: false });
      const vegetation = this._environmentRenderer?.getTelemetry?.() || this._vegetation?.getStatus?.() || freezeRecord({ status: "fallback", activeChunks: 0, activeInstances: 0 });
      const waterWeather = this._waterWeather?.getTelemetry?.() || freezeRecord({ status: "fallback", waterBodies: 1, particles: 0, interactions: 0 });
      const average = this._governor.average;
      const render = this._collectRenderTelemetry();
      const resourceMarkers = this._resourceMarkerCapabilities();
      return freezeRecord({
        status: this._state,
        backend: this._backend,
        qualityPreset: this._qualityPreset,
        requestedPreset: this._qualityRequested,
        adaptiveQuality: this._governor.enabled,
        fps: average > 0 ? Math.round(1000 / average) : 0,
        frameTimeAverageMs: Math.round(average * 10) / 10,
        frameTimeP95Ms: Math.round(this._governor.p95 * 10) / 10,
        frameTimeP99Ms: Math.round(this._governor.p99 * 10) / 10,
        frameTimeMaximumMs: Math.round(this._governor.maximum * 10) / 10,
        frameTimeMaxMs: Math.round(this._governor.maximum * 10) / 10,
        longFrameCount: this._governor.longFrameCount,
        drawCalls: render.drawCalls,
        drawCallsMeasured: render.drawCallsMeasured,
        triangles: render.triangles,
        triangleCount: render.triangles,
        vertices: render.vertices,
        visibleMeshes: render.visibleMeshes,
        textureCount: render.textures,
        estimatedVramBytes: render.estimatedVramBytes,
        estimatedVramMiB: render.estimatedVramMiB,
        estimatedVRAMMiB: render.estimatedVramMiB,
        activeChunks: streaming.activeChunks,
        queuedChunks: streaming.queuedChunks,
        maxChunks: streaming.maxChunks,
        landscapeWorker: streaming.worker,
        worldSize: WORLD_SIZE,
        reducedMotion: this._reducedMotion,
        hidden: Boolean((this._options.document || runtime.document) && (this._options.document || runtime.document).hidden),
        proxySpecies: FLAGSHIP_IDS.slice(),
        resourceMarkers,
        environmentAssets,
        proceduralEnvironment: freezeRecord({
          landscape: this._landscape ? "active" : "legacy-fallback",
          vegetation,
          waterWeather
        }),
        creatureAssets,
        cinematicAudio,
        renderingFeatures: this._getRenderingFeatureStatus(),
        readability: this._readabilityState ? freezeRecord({ ...this._readabilityState }) : freezeRecord({ applied: false }),
        photoCamera: this.getPhotoSettings(),
        gameplayCamera: this.getGameplayCamera(),
        gameplayCapabilities: this.getGameplayCapabilities(),
        rainParticleBudget: ENVIRONMENT_BUDGETS[this._qualityPreset].rainParticles,
        physics: "kinematic-proxy-only"
      });
    }

    async capture(mimeType = "image/png", dimensions = {}) {
      if (!this._engine || !this._camera || !this._canvas) throw new Error("The 3D renderer is not ready for capture.");
      const type = /^image\/(?:png|jpeg|webp)$/i.test(String(mimeType || "")) ? String(mimeType) : "image/png";
      const screenshot = this._Babylon?.Tools?.CreateScreenshotUsingRenderTargetAsync;
      if (typeof screenshot === "function") {
        const dataUrl = await screenshot(this._engine, this._camera, {
          width: Math.trunc(clamp(dimensions.width || this._canvas.width || this._canvas.clientWidth || 1, 1, 7680)),
          height: Math.trunc(clamp(dimensions.height || this._canvas.height || this._canvas.clientHeight || 1, 1, 4320))
        }, type);
        const encoded = String(dataUrl || "").split(",")[1];
        if (!encoded || typeof runtime.atob !== "function" || typeof runtime.Blob !== "function") throw new Error("The captured frame could not be encoded.");
        const binary = runtime.atob(encoded);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        return new runtime.Blob([bytes], { type });
      }
      return new Promise((resolve, reject) => {
        if (typeof this._canvas.toBlob !== "function") { reject(new Error("Canvas capture is unsupported.")); return; }
        this._canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to capture the current frame.")), type);
      });
    }

    pause(cause = "user") {
      if (cause !== "visibility") this._pauseRequested = true;
      this._cancelEnvironmentAssetSchedule();
      if (this._state === "starting" || this._state === "idle") {
        return makeResult(true, { status: this._state, pending: true, cause });
      }
      if (this._state !== "running") return makeResult(this._state === "paused", { status: this._state, cause });
      try { this._engine && this._engine.stopRenderLoop(this._renderFrame); } catch { /* Pausing must remain safe. */ }
      this._streamer?.pause?.();
      this._environmentRenderer?.pause?.(cause);
      this._vegetation?.pause?.(cause);
      this._waterWeather?.pause?.(cause);
      this._cinematicAudio?.pause();
      this._state = "paused";
      this._emitStatus({ cause: String(cause) });
      return makeResult(true, { status: this._state, cause });
    }

    resume(cause = "user") {
      if (cause !== "visibility") this._pauseRequested = false;
      else if (this._pauseRequested) return makeResult(false, { status: this._state, reason: makeReason("USER_PAUSED", "3D rendering remains paused until the user resumes it.", "lifecycle", {}, true) });
      if (this._state !== "paused") return makeResult(this._state === "running", { status: this._state, cause });
      const documentRef = this._options.document || runtime.document;
      if (documentRef && documentRef.hidden) {
        this._pausedByVisibility = true;
        return makeResult(false, { status: this._state, reason: makeReason("PAGE_HIDDEN", "3D rendering stays paused while the page is hidden.", "lifecycle", {}, true) });
      }
      this._pausedByVisibility = false;
      this._state = "running";
      this._lastFrameAt = now();
      this._streamer?.resume?.();
      this._environmentRenderer?.resume?.(cause);
      this._vegetation?.resume?.(cause);
      this._waterWeather?.resume?.(cause);
      this._engine.runRenderLoop(this._renderFrame);
      this._cinematicAudio?.resume();
      this._scheduleEnvironmentAssetLoad(this._generation);
      this._emitStatus({ cause: String(cause) });
      return makeResult(true, { status: this._state, cause });
    }

    setAmbientAudio(enabled, volume = 0.7) {
      if (!this._cinematicAudio) return makeResult(false, { status: "fallback" });
      return makeResult(true, { audio: this._cinematicAudio.set(enabled, volume) });
    }

    _releaseOwnedCanvas() {
      if (this._ownsCanvas && this._canvas) {
        try { this._canvas.remove(); } catch { /* It may never have been attached. */ }
        this._canvas = null;
        this._ownsCanvas = false;
      }
      this._canvasCommitted = false;
    }

    _restoreCanvasPresentation() {
      if (!this._canvas || this._ownsCanvas) return;
      if (this._canvasStyleSnapshot && this._canvas.style) {
        this._canvas.style.width = this._canvasStyleSnapshot.width;
        this._canvas.style.height = this._canvasStyleSnapshot.height;
        this._canvas.style.display = this._canvasStyleSnapshot.display;
        this._canvas.style.touchAction = this._canvasStyleSnapshot.touchAction;
      }
      if (typeof this._canvas.removeAttribute === "function") {
        this._canvas.removeAttribute("data-hwe-3d-backend");
        this._canvas.removeAttribute("data-hwe-3d-quality");
      }
      this._canvasStyleSnapshot = null;
    }

    _teardownGraphics() {
      this._cancelEnvironmentAssetSchedule();
      this._removeRuntimeListeners();
      this._removeWebGpuDiagnostics();
      this._clearHighlightedTargetInternal();
      try { this._engine && this._engine.stopRenderLoop(this._renderFrame); } catch { /* Cleanup only. */ }
      if (this._camera && typeof this._camera.detachControl === "function") {
        try { this._camera.detachControl(); } catch { /* Cleanup only. */ }
      }
      this._disposePostProcessing();
      safeDispose(this._lights?.shadow);
      if (this._lights) {
        this._lights.shadow = null;
        this._lights.shadowKind = "none";
      }
      this._renderFeaturePreset = null;
      if (this._streamer) this._streamer.dispose();
      this._streamer = null;
      try { this._environmentRenderer?.dispose?.(); } catch { /* Thin-instance cleanup must fail open. */ }
      this._environmentRenderer = null;
      try { this._vegetation?.dispose?.(); } catch { /* Subsystem disposal must fail open. */ }
      this._vegetation = null;
      try { this._waterWeather?.dispose?.(); } catch { /* Subsystem disposal must fail open. */ }
      this._waterWeather = null;
      this._proceduralLakes = Object.freeze([]);
      try { this._landscape?.dispose?.(); } catch { /* Pure procedural state remains optional. */ }
      this._landscape = null;
      this._environmentAssets?.dispose();
      this._environmentAssets = null;
      this._creatureAssets?.dispose();
      this._creatureAssets = null;
      this._cinematicAudio?.dispose();
      this._cinematicAudio = null;
      for (const id of Array.from(this._resourceMarkers.keys())) this._disposeResourceMarker(id);
      this._resourceMarkers.clear();
      for (const material of this._resourceMaterials.values()) safeDispose(material);
      this._resourceMaterials.clear();
      for (const proxy of this._proxies.values()) {
        safeDispose(proxy.root);
        for (const material of proxy.materials) safeDispose(material);
      }
      this._proxies.clear();
      this._proxyByEntityId.clear();
      this._visibleWildlifeSpecies.clear();
      this._environmentBlockerMeshes.clear();
      if (this._water) {
        safeDispose(this._water.mesh);
        safeDispose(this._water.material);
        safeDispose(this._water.normalTexture);
        safeDispose(this._water.foamTexture);
      }
      this._water = null;
      this._environmentRenderState = null;
      this._readabilityState = null;
      if (this._weatherFx) {
        try { this._weatherFx.rain?.stop(); } catch { /* Cleanup only. */ }
        safeDispose(this._weatherFx.rain);
        safeDispose(this._weatherFx.texture);
      }
      this._weatherFx = null;
      safeDispose(this._scene);
      safeDispose(this._engine);
      this._scene = null;
      this._engine = null;
      this._camera = null;
      this._controlsAttached = false;
      this._gameplayCameraApplied = null;
      this._gameplayCameraCollisionHold = { active: false, distance: this._gameplayCamera.distance, clearSeconds: 0 };
      this._gameplayCameraManualIdleSeconds = 0;
      this._gameplayCameraYawOverrideLatched = false;
      this._photoCameraOverride = false;
      this._gameplayCameraCollision = freezeRecord({ supported: false, mode: "unavailable", terrainOnly: true, approximate: false, rayCount: 0, blockerCoverage: Object.freeze([]), hit: false, desiredDistance: this._gameplayCamera.distance, resolvedDistance: this._gameplayCamera.distance, hitDistance: null, meshKind: null });
      this._lights = null;
      this._postProcessingFailureHistory.length = 0;
      this._lastFrameDrawCalls = 0;
      this._drawCallsMeasured = false;
      this._Babylon = null;
      this._backend = null;
      this._governor.reset();
    }

    dispose() {
      if (this._state === "disposed") return makeResult(true, { status: this._state });
      this._generation += 1;
      this._teardownGraphics();
      if (this._canvas && this._manageCanvasVisibility) this._canvas.hidden = true;
      this._restoreCanvasPresentation();
      this._releaseOwnedCanvas();
      this._canvas = null;
      this._container = null;
      this._state = "disposed";
      this._failureReason = null;
      this._emitStatus();
      return makeResult(true, { status: this._state });
    }
  }

  function create(options) { return new EonWild3DAdapter(options); }
  function createRenderer(options) { return create(options); }
  let defaultAdapter = null;
  function getDefaultAdapter(options) {
    if (!defaultAdapter || defaultAdapter.status === "disposed") defaultAdapter = create(options);
    return defaultAdapter;
  }
  function start(options) { return getDefaultAdapter(options).start(options); }
  function pause(cause) { return defaultAdapter ? defaultAdapter.pause(cause) : makeResult(true, { status: "idle" }); }
  function resume(cause) { return defaultAdapter ? defaultAdapter.resume(cause) : makeResult(false, { status: "idle", reason: makeReason("ADAPTER_NOT_STARTED", "Start the optional 3D renderer before resuming it.", "lifecycle", {}, true) }); }
  function dispose() {
    if (!defaultAdapter) return makeResult(true, { status: "idle" });
    const result = defaultAdapter.dispose();
    defaultAdapter = null;
    return result;
  }
  function getStatus() {
    return defaultAdapter ? freezeRecord({ status: defaultAdapter.status, backend: defaultAdapter.backend, qualityPreset: defaultAdapter.qualityPreset, reason: defaultAdapter.failureReason }) : freezeRecord({ status: "idle", backend: null, qualityPreset: null, reason: null });
  }

  return Object.freeze({
    VERSION,
    version: VERSION,
    BABYLON_VERSION,
    WORLD_SIZE,
    CHUNK_SIZE,
    CHUNKS_PER_AXIS,
    WATER_LEVEL,
    MAX_ACTIVE_CHUNKS,
    DEFAULT_LOCAL_BABYLON_URL,
    DEFAULT_LOCAL_GLTF_LOADER_URL,
    DEFAULT_REMOTE_BABYLON_URL,
    DEFAULT_ENVIRONMENT_ASSET_BASE,
    DEFAULT_CREATURE_ASSET_BASE,
    DEFAULT_LANDSCAPE_WORKER_URL,
    ENVIRONMENT_ASSETS,
    ENVIRONMENT_BUDGETS,
    CREATURE_PROTOTYPE_ASSETS,
    FLAGSHIP_SPECIES,
    FLAGSHIP_IDS,
    QUALITY_PRESETS,
    QUALITY_ORDER,
    CINEMATIC_PRESET,
    DEFAULT_PHOTO_SETTINGS,
    GAMEPLAY_CAMERA_PROFILES,
    GAMEPLAY_CAMERA_PROFILE_IDS,
    DEFAULT_GAMEPLAY_CAMERA,
    READABILITY_FLOORS,
    detectCapabilities,
    loadBabylon,
    loadBabylonGltfLoader,
    sampleTerrain,
    sampleTerrainHeight,
    createProceduralLandscape,
    planProceduralLakes,
    queryLandscapeWater,
    applyTerrainMaterialReadability,
    applyCreatureMaterialReadability,
    enforceClearDaylightReadability,
    planEnvironmentPlacements,
    normalizeGameplayCamera,
    defaultGameplayCameraProfileForSpecies,
    gameplayCameraToArc,
    gameplayCameraOffset,
    gameplayLookDirection,
    headingToProxyRotation,
    gameplayCameraForwardXZ,
    isCameraObstructionMesh,
    cameraObstructionKind,
    raySphereIntersectionDistance,
    LandscapeWorkerBridge,
    CreaturePrototypeManager,
    create,
    createRenderer,
    start,
    pause,
    resume,
    dispose,
    getStatus,
    EonWild3DAdapter
  });
});
