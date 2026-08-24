(function (root, factory) {
  "use strict";

  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHEonWild3D = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createEonWild3D(global) {
  "use strict";

  const VERSION = "3.0.0";
  const BABYLON_VERSION = "9.22.1";
  const SCRIPT_BASE_URL = (() => {
    try { return global.document?.currentScript?.src ? new URL("./", global.document.currentScript.src).href : ""; } catch { return ""; }
  })();
  const BABYLON_URL = SCRIPT_BASE_URL ? new URL(`vendor/babylon-${BABYLON_VERSION}.js?v=${BABYLON_VERSION}`, SCRIPT_BASE_URL).href : `./vendor/babylon-${BABYLON_VERSION}.js?v=${BABYLON_VERSION}`;
  const WORLD_CONFIG = Object.freeze({
    logicalSizeMeters: 4096,
    chunkSizeMeters: 256,
    highDetailMeters: 300,
    mediumDetailMeters: 1200,
    farDetailMeters: 4000,
    desktopChunkRadius: 4,
    mobileChunkRadius: 2,
    maximumResidentChunks: 96,
    physicsBubbleChunks: 2
  });

  const QUALITY_PROFILES = Object.freeze({
    static: Object.freeze({ id: "static", label: "Tĩnh", targetFps: 30, dpr: 1, chunkRadius: 2, terrainSubdivisions: [16, 8, 4, 2], wildlife: 8, shadows: false, fog: false, particles: 0 }),
    light: Object.freeze({ id: "light", label: "Nhẹ", targetFps: 30, dpr: 1.1, chunkRadius: 2, terrainSubdivisions: [24, 12, 6, 2], wildlife: 12, shadows: false, fog: true, particles: 8 }),
    balanced: Object.freeze({ id: "balanced", label: "Cân bằng", targetFps: 45, dpr: 1.35, chunkRadius: 3, terrainSubdivisions: [32, 16, 8, 3], wildlife: 18, shadows: true, fog: true, particles: 14 }),
    high: Object.freeze({ id: "high", label: "Cao", targetFps: 60, dpr: 1.6, chunkRadius: 4, terrainSubdivisions: [48, 24, 10, 4], wildlife: 24, shadows: true, fog: true, particles: 18 }),
    cinematic: Object.freeze({ id: "cinematic", label: "Điện ảnh", targetFps: 60, dpr: 1.8, chunkRadius: 5, terrainSubdivisions: [64, 32, 12, 4], wildlife: 32, shadows: true, fog: true, particles: 24 })
  });

  const GAME_MODES = Object.freeze([
    Object.freeze({ id: "one-life", label: "One Life Survival", available: true, description: "Sống trọn vòng đời với đói, khát, thương tích và dòng gene." }),
    Object.freeze({ id: "migration", label: "Migration Journey", available: true, description: "Theo tín hiệu sinh thái qua nhiều chunk và giữ sức cho đàn." }),
    Object.freeze({ id: "lineage", label: "Nest & Lineage", available: true, description: "Làm tổ và truyền gene qua các thế hệ local." }),
    Object.freeze({ id: "sanctuary", label: "Sanctuary", available: true, description: "Khám phá ít áp lực nhưng quần thể vẫn vận hành." }),
    Object.freeze({ id: "field-documentary", label: "Field Documentary", available: true, description: "Photo Mode, replay và hoàn thiện Codex mà không tạo nhân vật người." }),
    Object.freeze({ id: "abyss", label: "Abyss Life", available: false, description: "Navigation volume và áp suất biển sâu đang trong lộ trình." }),
    Object.freeze({ id: "sky-current", label: "Sky Current", available: false, description: "Nhiệt lưu, gió và đường bay 3D đang trong lộ trình." }),
    Object.freeze({ id: "pack-herd", label: "Pack / Herd Life", available: false, description: "Hành vi đàn nhiều thế hệ cần AI chuyên biệt." }),
    Object.freeze({ id: "ecology-crisis", label: "Ecology Crisis", available: false, description: "Kịch bản hạn, lũ, cháy và rét cực đoan đang được kiểm thử." }),
    Object.freeze({ id: "convergence", label: "Eon Convergence", available: true, fictional: true, description: "Sandbox hư cấu duy nhất cho phép trộn thời đại." })
  ]);

  const TIME_SLICES = Object.freeze([
    Object.freeze({ id: "cambrian-shelf", realmId: "paleozoic", label: "Biển Cambri", range: "khoảng 521–514 Ma", regionIds: ["cambrian-shallow-sea"], biomeIds: ["ocean", "reef"] }),
    Object.freeze({ id: "devonian-reef", realmId: "paleozoic", label: "Rạn Devon", range: "khoảng 382–372 Ma", regionIds: ["devonian-reef-belt"], biomeIds: ["ocean", "reef", "wetland"] }),
    Object.freeze({ id: "carboniferous-swamp", realmId: "paleozoic", label: "Đầm rừng Than đá", range: "khoảng 315–307 Ma", regionIds: ["carboniferous-wetland"], biomeIds: ["wetland", "forest"] }),
    Object.freeze({ id: "permian-basin", realmId: "paleozoic", label: "Lưu vực Permi", range: "khoảng 299–252 Ma", regionIds: ["permian-floodplain"], biomeIds: ["desert", "grassland", "volcanic"] }),
    Object.freeze({ id: "triassic-valley", realmId: "mesozoic", label: "Thung lũng Trias", range: "khoảng 228–201 Ma", regionIds: ["triassic-rift-valley"], biomeIds: ["desert", "grassland", "forest"] }),
    Object.freeze({ id: "jurassic-forest", realmId: "mesozoic", label: "Rừng Jura", range: "khoảng 157–145 Ma", regionIds: ["jurassic-conifer-basin"], biomeIds: ["forest", "grassland", "wetland"] }),
    Object.freeze({ id: "cretaceous-laramidia", realmId: "mesozoic", label: "Laramidia cuối Phấn Trắng", range: "khoảng 68–66 Ma", regionIds: ["late-cretaceous-floodplain"], biomeIds: ["forest", "grassland", "wetland"] }),
    Object.freeze({ id: "cretaceous-north-africa", realmId: "mesozoic", label: "Bắc Phi giữa Phấn Trắng", range: "khoảng 100–94 Ma", regionIds: ["kem-kem-wetland"], biomeIds: ["wetland", "desert", "reef"] }),
    Object.freeze({ id: "western-interior-seaway", realmId: "mesozoic", label: "Western Interior Seaway", range: "khoảng 88–80 Ma", regionIds: ["cretaceous-coast"], biomeIds: ["ocean", "reef", "wetland"] }),
    Object.freeze({ id: "late-cenozoic-pampas", realmId: "ice-age", label: "Đồng cỏ Nam Mỹ Tân sinh muộn", range: "khoảng 9–2,5 Ma", regionIds: ["south-american-grassland"], biomeIds: ["grassland", "wetland", "forest"] }),
    Object.freeze({ id: "mammoth-steppe", realmId: "ice-age", label: "Mammoth Steppe", range: "Pleistocene muộn", regionIds: ["eurasian-steppe"], biomeIds: ["tundra", "grassland", "forest"] }),
    Object.freeze({ id: "pleistocene-americas", realmId: "ice-age", label: "Châu Mỹ Pleistocene", range: "Pleistocene muộn", regionIds: ["american-grassland", "american-forest"], biomeIds: ["grassland", "forest", "wetland"] }),
    Object.freeze({ id: "modern-land", realmId: "modern", label: "Sinh quyển lục địa", range: "Hiện tại", regionIds: ["savanna", "rainforest", "taiga-tundra", "wetland"], biomeIds: ["forest", "grassland", "wetland", "desert", "tundra"] }),
    Object.freeze({ id: "modern-ocean", realmId: "modern", label: "Đại dương hiện đại", range: "Hiện tại", regionIds: ["coral-reef", "open-ocean", "polar-sea", "abyssal-zone"], biomeIds: ["ocean", "reef"] })
  ]);
  const TIME_SLICE_BY_ID = new Map(TIME_SLICES.map((row) => [row.id, row]));

  const REGIONS = Object.freeze([
    ["cambrian-shallow-sea", "Thềm biển nông Cambri", "water"], ["devonian-reef-belt", "Vành đai rạn Devon", "water"],
    ["carboniferous-wetland", "Đầm rừng Than đá", "mixed"], ["permian-floodplain", "Đồng lũ Permi", "land"],
    ["triassic-rift-valley", "Thung lũng tách giãn Trias", "land"], ["jurassic-conifer-basin", "Lưu vực hạt trần Jura", "land"],
    ["late-cretaceous-floodplain", "Đồng lũ Laramidia", "mixed"], ["kem-kem-wetland", "Hệ sông Bắc Phi", "mixed"],
    ["cretaceous-coast", "Bờ biển nội địa Phấn Trắng", "mixed"], ["south-american-grassland", "Đồng cỏ Nam Mỹ Tân sinh muộn", "land"], ["eurasian-steppe", "Thảo nguyên Á–Âu", "land"],
    ["american-grassland", "Đồng cỏ châu Mỹ", "land"], ["american-forest", "Rừng Pleistocene", "land"],
    ["savanna", "Savanna", "land"], ["rainforest", "Rừng mưa", "land"], ["taiga-tundra", "Taiga và tundra", "land"],
    ["wetland", "Đất ngập nước", "mixed"], ["coral-reef", "Rạn san hô", "water"], ["open-ocean", "Đại dương mở", "water"],
    ["polar-sea", "Biển vùng cực", "water"], ["abyssal-zone", "Vực biển sâu", "water"]
  ].map(([id, label, medium]) => Object.freeze({ id, label, medium })));
  const REGION_BY_ID = new Map(REGIONS.map((row) => [row.id, row]));

  const CARTRIDGE_ROWS = [
    ["tyrannosaurus", "vertical-slice", "cretaceous-laramidia", "late-cretaceous-floodplain", "biped", "scent", 1.2, "Bite & scent tracking"],
    ["triceratops", "vertical-slice", "cretaceous-laramidia", "late-cretaceous-floodplain", "heavy-quadruped", "hearing", 1.1, "Herd wall & horn charge"],
    ["spinosaurus", "vertical-slice", "cretaceous-north-africa", "kem-kem-wetland", "amphibious-biped", "pressure", 1.15, "Water pressure pursuit"],
    ["pteranodon", "vertical-slice", "western-interior-seaway", "cretaceous-coast", "soaring", "vision", 0.72, "Thermal soaring"],
    ["argentavis", "content-ready", "late-cenozoic-pampas", "south-american-grassland", "soaring", "vision", 0.82, "Long-range thermal soaring"],
    ["ankylosaurus", "content-ready", "cretaceous-laramidia", "late-cretaceous-floodplain", "heavy-quadruped", "vibration", 1.0, "Armor stance & tail club"],
    ["anomalocaris", "roadmap", "cambrian-shelf", "cambrian-shallow-sea", "aquatic", "pressure", 0.45, "Pressure-wave pursuit"],
    ["dunkleosteus", "roadmap", "devonian-reef", "devonian-reef-belt", "aquatic", "vision", 0.9, "Armored ram"],
    ["arthropleura", "roadmap", "carboniferous-swamp", "carboniferous-wetland", "arthropod-crawl", "vibration", 0.55, "Segment armor"],
    ["dimetrodon", "roadmap", "permian-basin", "permian-floodplain", "sprawling-quadruped", "thermal", 0.65, "Sail thermoregulation"],
    ["inostrancevia", "roadmap", "permian-basin", "permian-floodplain", "sprawling-quadruped", "scent", 0.72, "Ambush bite"],
    ["velociraptor", "roadmap", "cretaceous-laramidia", "late-cretaceous-floodplain", "feathered-biped", "hearing", 0.42, "Coordinated pursuit"],
    ["mosasaurus", "roadmap", "western-interior-seaway", "cretaceous-coast", "aquatic", "pressure", 1.35, "Marine ambush"],
    ["mammuthus", "content-ready", "mammoth-steppe", "eurasian-steppe", "heavy-quadruped", "infrasound", 1.25, "Thermal herd shield"],
    ["smilodon", "roadmap", "pleistocene-americas", "american-grassland", "feline-quadruped", "scent", 0.68, "Silent ambush"],
    ["dire-wolf", "roadmap", "pleistocene-americas", "american-grassland", "canid-quadruped", "scent", 0.64, "Pack pursuit"],
    ["megaloceros", "roadmap", "mammoth-steppe", "eurasian-steppe", "ungulate-quadruped", "hearing", 0.82, "Antler display"],
    ["megatherium", "roadmap", "pleistocene-americas", "american-forest", "heavy-quadruped", "scent", 1.0, "Upright defense"],
    ["wolf", "content-ready", "modern-land", "taiga-tundra", "canid-quadruped", "scent", 0.58, "Pack scent network"],
    ["orca", "content-ready", "modern-ocean", "open-ocean", "aquatic", "echolocation", 1.05, "Pod echolocation"],
    ["giant-octopus", "content-ready", "modern-ocean", "coral-reef", "cephalopod", "polarized-vision", 0.62, "Camouflage & crevice traversal"],
    ["blue-whale", "content-ready", "modern-ocean", "open-ocean", "aquatic", "infrasound", 1.55, "Long-range ocean call"],
    ["electric-eel", "content-ready", "modern-land", "wetland", "aquatic", "electric", 0.54, "Electric field pulse"],
    ["honeybee", "content-ready", "modern-land", "savanna", "insect-flight", "polarized-vision", 0.16, "Waggle navigation"],
    ["tiger", "roadmap", "modern-land", "rainforest", "feline-quadruped", "scent", 0.7, "Cover ambush"]
  ];
  const SPECIES_CARTRIDGES = Object.freeze(Object.fromEntries(CARTRIDGE_ROWS.map(([id, stage, timeSliceId, regionId, locomotionRig, primarySense, bodyScale, signature]) => [id, Object.freeze({
    id,
    stage,
    timeSliceIds: Object.freeze([timeSliceId]),
    regionIds: Object.freeze([regionId]),
    locomotionRig,
    primarySense,
    bodyScale,
    signature,
    animationStates: Object.freeze(["idle", "walk", "run", "feed", "drink", "attack", "injured", "rest", "death"]),
    hitZones: Object.freeze(["head", "torso", "limbs", "tail"]),
    evidence: stage === "roadmap" ? "design-target" : "gameplay-reconstruction"
  })])));

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));
  const safeId = (value, fallback) => {
    const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
    return normalized || fallback;
  };
  const hash = (value) => [...String(value || "eonwild")].reduce((result, character) => Math.imul(result ^ character.charCodeAt(0), 16777619) >>> 0, 2166136261);
  const seededRandom = (seed) => {
    let state = hash(seed) || 1;
    return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  };

  function listTimeSlices(realmId) {
    return TIME_SLICES.filter((row) => row.realmId === realmId);
  }

  function defaultTimeSlice(realmId) {
    return listTimeSlices(realmId)[0] || TIME_SLICES[0];
  }

  function createWorldAddress(value = {}) {
    const realmId = ["paleozoic", "mesozoic", "ice-age", "modern"].includes(value.realmId) ? value.realmId : "mesozoic";
    const fallbackSlice = defaultTimeSlice(realmId);
    const candidateSlice = TIME_SLICE_BY_ID.get(String(value.timeSliceId || ""));
    const timeSlice = candidateSlice?.realmId === realmId ? candidateSlice : fallbackSlice;
    const regionId = timeSlice.regionIds.includes(String(value.regionId || "")) ? String(value.regionId) : timeSlice.regionIds[0];
    return Object.freeze({
      realmId,
      timeSliceId: timeSlice.id,
      regionId,
      biomeId: timeSlice.biomeIds.includes(String(value.biomeId || "")) ? String(value.biomeId) : timeSlice.biomeIds[0],
      chunkX: Math.trunc(clamp(value.chunkX, 0, WORLD_CONFIG.logicalSizeMeters / WORLD_CONFIG.chunkSizeMeters - 1)),
      chunkZ: Math.trunc(clamp(value.chunkZ, 0, WORLD_CONFIG.logicalSizeMeters / WORLD_CONFIG.chunkSizeMeters - 1)),
      seed: String(value.seed || "eonwild-3d").replace(/[\u0000-\u001f]/g, "").slice(0, 64) || "eonwild-3d"
    });
  }

  function addressForSpecies(speciesId, seed) {
    const cartridge = SPECIES_CARTRIDGES[String(speciesId || "")];
    if (!cartridge) return createWorldAddress({ seed });
    const timeSlice = TIME_SLICE_BY_ID.get(cartridge.timeSliceIds[0]);
    return createWorldAddress({ realmId: timeSlice?.realmId, timeSliceId: timeSlice?.id, regionId: cartridge.regionIds[0], seed });
  }

  function isSpeciesAllowedAtAddress(speciesId, address, convergence) {
    if (convergence === true) return Boolean(SPECIES_CARTRIDGES[String(speciesId || "")]);
    const cartridge = SPECIES_CARTRIDGES[String(speciesId || "")];
    const normalized = createWorldAddress(address);
    return Boolean(cartridge && cartridge.timeSliceIds.includes(normalized.timeSliceId) && cartridge.regionIds.includes(normalized.regionId));
  }

  function worldToChunk(x, z) {
    const maximum = WORLD_CONFIG.logicalSizeMeters / WORLD_CONFIG.chunkSizeMeters - 1;
    return Object.freeze({ x: Math.trunc(clamp(Math.floor(Number(x) / WORLD_CONFIG.chunkSizeMeters), 0, maximum)), z: Math.trunc(clamp(Math.floor(Number(z) / WORLD_CONFIG.chunkSizeMeters), 0, maximum)) });
  }

  function chunkKey(x, z, address) {
    const normalized = createWorldAddress(address);
    return `${normalized.timeSliceId}:${normalized.regionId}:${Math.trunc(x)}:${Math.trunc(z)}`;
  }

  function planChunkStreaming(position = {}, options = {}) {
    const center = worldToChunk(position.x, position.z ?? position.y);
    const profile = QUALITY_PROFILES[options.quality] || QUALITY_PROFILES.balanced;
    const radius = Math.trunc(clamp(options.radius ?? profile.chunkRadius, 1, 8));
    const chunks = [];
    const maxIndex = WORLD_CONFIG.logicalSizeMeters / WORLD_CONFIG.chunkSizeMeters - 1;
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const x = center.x + dx;
        const z = center.z + dz;
        if (x < 0 || z < 0 || x > maxIndex || z > maxIndex) continue;
        const ring = Math.max(Math.abs(dx), Math.abs(dz));
        const lod = ring <= 1 ? 0 : ring <= 2 ? 1 : ring <= 4 ? 2 : 3;
        chunks.push(Object.freeze({ x, z, ring, lod, key: chunkKey(x, z, options.address), distance: Math.hypot(dx, dz) }));
      }
    }
    return Object.freeze(chunks.sort((a, b) => a.distance - b.distance || a.key.localeCompare(b.key)).slice(0, WORLD_CONFIG.maximumResidentChunks));
  }

  function createAdaptiveGovernor(options = {}) {
    let qualityId = QUALITY_PROFILES[options.quality] ? options.quality : "balanced";
    let badWindows = 0;
    let goodWindows = 0;
    const order = ["static", "light", "balanced", "high", "cinematic"];
    return Object.freeze({
      get quality() { return qualityId; },
      sample(fps) {
        const profile = QUALITY_PROFILES[qualityId];
        const measured = clamp(fps, 0, 240);
        if (measured < profile.targetFps * .72) { badWindows += 1; goodWindows = 0; }
        else if (measured > profile.targetFps * .92) { goodWindows += 1; badWindows = 0; }
        else { badWindows = 0; goodWindows = 0; }
        let changed = false;
        const index = order.indexOf(qualityId);
        if (badWindows >= 2 && index > 0) { qualityId = order[index - 1]; badWindows = 0; changed = true; }
        else if (goodWindows >= 15 && options.allowUpgrade === true && index < order.length - 1) { qualityId = order[index + 1]; goodWindows = 0; changed = true; }
        return Object.freeze({ changed, quality: qualityId, fps: measured, profile: QUALITY_PROFILES[qualityId] });
      },
      setQuality(next) { if (QUALITY_PROFILES[next]) qualityId = next; return qualityId; }
    });
  }

  function detectCapabilities() {
    const result = { secureContext: global.isSecureContext !== false, webgpu: Boolean(global.navigator?.gpu), webgl2: false, webgl1: false, reducedMotion: false, mobile: false };
    let context = null;
    try {
      const canvas = global.document?.createElement?.("canvas");
      context = canvas?.getContext?.("webgl2", { failIfMajorPerformanceCaveat: true }) || null;
      result.webgl2 = Boolean(context);
      if (!context) context = canvas?.getContext?.("webgl", { failIfMajorPerformanceCaveat: true }) || null;
      result.webgl1 = !result.webgl2 && Boolean(context);
      result.reducedMotion = Boolean(global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
      result.mobile = Boolean(global.matchMedia?.("(max-width: 760px), (pointer: coarse)")?.matches);
    } catch {}
    finally {
      try { context?.getExtension?.("WEBGL_lose_context")?.loseContext?.(); } catch {}
    }
    result.recommendedBackend = result.webgpu ? "webgpu" : result.webgl2 ? "webgl2" : result.webgl1 ? "webgl1" : "lite";
    return Object.freeze(result);
  }

  let babylonPromise = null;
  function loadBabylon(options = {}) {
    if (global.BABYLON?.Engine) return Promise.resolve(global.BABYLON);
    if (!global.document?.createElement) return Promise.reject(new Error("Babylon runtime requires a browser document"));
    if (babylonPromise) return babylonPromise;
    const requested = String(options.url || BABYLON_URL);
    let source;
    try {
      source = new URL(requested, global.location?.href || "http://localhost/");
      const currentOrigin = global.location?.origin;
      if (currentOrigin && currentOrigin !== "null" && source.origin !== currentOrigin) throw new Error("Babylon source must be same-origin");
    } catch (error) { return Promise.reject(error); }
    babylonPromise = new Promise((resolve, reject) => {
      const existing = global.document.querySelector?.("script[data-hwe-babylon]");
      if (existing) {
        const check = () => global.BABYLON?.Engine ? resolve(global.BABYLON) : reject(new Error("Babylon script loaded without engine API"));
        existing.addEventListener("load", check, { once: true });
        existing.addEventListener("error", () => reject(new Error("Unable to load Babylon runtime")), { once: true });
        return;
      }
      const script = global.document.createElement("script");
      script.src = source.href;
      script.async = true;
      script.dataset.hweBabylon = BABYLON_VERSION;
      const timeout = global.setTimeout?.(() => { script.remove(); babylonPromise = null; reject(new Error("Babylon runtime timed out")); }, clamp(options.timeoutMs ?? 20000, 4000, 60000));
      script.onload = () => {
        global.clearTimeout?.(timeout);
        if (global.BABYLON?.Engine) resolve(global.BABYLON);
        else { babylonPromise = null; reject(new Error("Babylon engine API is unavailable")); }
      };
      script.onerror = () => { global.clearTimeout?.(timeout); babylonPromise = null; reject(new Error("Unable to load Babylon runtime")); };
      global.document.head.append(script);
    });
    return babylonPromise;
  }

  function terrainHeight(x, z, seed) {
    const offset = hash(seed) * .000001;
    const broad = Math.sin((x + offset) * .0032) * 7 + Math.cos((z - offset) * .0027) * 6;
    const ridge = Math.sin((x + z) * .0083 + offset) * 2.8;
    const detail = Math.sin(x * .031 + offset) * Math.cos(z * .027 - offset) * 1.2;
    return broad + ridge + detail;
  }

  function paletteForAddress(address) {
    const palettes = {
      paleozoic: ["#183f44", "#2f766d", "#73c69d"],
      mesozoic: ["#263b27", "#526939", "#a3b85f"],
      "ice-age": ["#415d67", "#708997", "#d7edf1"],
      modern: ["#183c31", "#28614b", "#68b96f"]
    };
    return palettes[address.realmId] || palettes.mesozoic;
  }

  function buildCreature(B, scene, cartridge, color, name) {
    const rootNode = new B.TransformNode(`${name}-root`, scene);
    const scale = clamp(cartridge?.bodyScale ?? 1, .15, 1.8);
    const material = new B.PBRMaterial(`${name}-material`, scene);
    material.albedoColor = B.Color3.FromHexString(color || "#e3b46c");
    material.roughness = .82;
    material.metallic = .02;
    const body = B.MeshBuilder.CreateSphere(`${name}-body`, { diameterX: 3.8 * scale, diameterY: 1.7 * scale, diameterZ: 1.45 * scale, segments: 10 }, scene);
    body.material = material;
    body.parent = rootNode;
    body.position.y = 1.15 * scale;
    const head = B.MeshBuilder.CreateSphere(`${name}-head`, { diameter: 1.2 * scale, segments: 8 }, scene);
    head.material = material;
    head.parent = rootNode;
    head.position.set(1.95 * scale, 1.35 * scale, 0);
    const rig = cartridge?.locomotionRig || "biped";
    const addLimb = (id, x, z, height, width) => {
      const limb = B.MeshBuilder.CreateCylinder(`${name}-${id}`, { height, diameter: width, tessellation: 7 }, scene);
      limb.material = material; limb.parent = rootNode; limb.position.set(x, height * .48, z); return limb;
    };
    if (rig.includes("aquatic")) {
      rootNode.scaling.z = .72;
      const tail = B.MeshBuilder.CreateCylinder(`${name}-tail`, { height: 2.4 * scale, diameterTop: .12 * scale, diameterBottom: .7 * scale, tessellation: 8 }, scene);
      tail.rotation.z = Math.PI / 2; tail.position.x = -2.4 * scale; tail.position.y = 1.1 * scale; tail.material = material; tail.parent = rootNode;
    } else if (rig.includes("soaring") || rig.includes("flight")) {
      const wing = B.MeshBuilder.CreateBox(`${name}-wings`, { width: 2.3 * scale, height: .12 * scale, depth: 7 * scale }, scene);
      wing.position.y = 1.4 * scale; wing.material = material; wing.parent = rootNode;
    } else if (rig.includes("biped")) {
      addLimb("leg-left", -.45 * scale, -.45 * scale, 1.5 * scale, .38 * scale);
      addLimb("leg-right", -.45 * scale, .45 * scale, 1.5 * scale, .38 * scale);
      const tail = B.MeshBuilder.CreateCylinder(`${name}-tail`, { height: 2.8 * scale, diameterTop: .08 * scale, diameterBottom: .62 * scale, tessellation: 7 }, scene);
      tail.rotation.z = Math.PI / 2; tail.position.set(-2.35 * scale, 1.2 * scale, 0); tail.material = material; tail.parent = rootNode;
    } else {
      addLimb("fore-left", 1.1 * scale, -.48 * scale, 1.2 * scale, .36 * scale);
      addLimb("fore-right", 1.1 * scale, .48 * scale, 1.2 * scale, .36 * scale);
      addLimb("hind-left", -1.05 * scale, -.48 * scale, 1.2 * scale, .4 * scale);
      addLimb("hind-right", -1.05 * scale, .48 * scale, 1.2 * scale, .4 * scale);
    }
    if (cartridge?.id === "triceratops") {
      [-.34, .34].forEach((z, index) => {
        const horn = B.MeshBuilder.CreateCylinder(`${name}-horn-${index}`, { height: 1.1 * scale, diameterTop: 0, diameterBottom: .2 * scale, tessellation: 8 }, scene);
        horn.rotation.z = -Math.PI / 2; horn.position.set(2.55 * scale, 1.65 * scale, z * scale); horn.material = material; horn.parent = rootNode;
      });
    }
    if (cartridge?.id === "spinosaurus") {
      const sail = B.MeshBuilder.CreateCylinder(`${name}-sail`, { height: 2.1 * scale, diameterTop: .08 * scale, diameterBottom: 1.8 * scale, tessellation: 3 }, scene);
      sail.rotation.z = Math.PI / 2; sail.position.set(-.15 * scale, 2.05 * scale, 0); sail.scaling.z = .15; sail.material = material; sail.parent = rootNode;
    }
    rootNode.metadata = { material, body, cartridge };
    return rootNode;
  }

  async function createEngine(B, canvas, options, capability) {
    const preferWebGPU = options.backend !== "webgl2" && capability.webgpu && B.WebGPUEngine;
    if (preferWebGPU) {
      try {
        const engine = new B.WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: true, enableAllFeatures: false });
        await engine.initAsync();
        return { engine, backend: "webgpu" };
      } catch (error) { options.onTelemetry?.({ type: "webgpu-init-failed", message: error?.message || "WebGPU init failed" }); }
    }
    if (!B.Engine?.IsSupported) throw new Error("WebGL is unavailable on this device");
    const engine = new B.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false, adaptToDeviceRatio: true, useHighPrecisionMatrix: true }, true);
    return { engine, backend: engine.webGLVersion >= 2 ? "webgl2" : "webgl1" };
  }

  async function createRuntime(canvas, options = {}) {
    if (!canvas?.getContext) throw new TypeError("A render canvas is required");
    const capability = detectCapabilities();
    if (!capability.webgpu && !capability.webgl2 && !capability.webgl1) throw new Error("Thiết bị không hỗ trợ WebGL/WebGPU; Lite Mode vẫn dùng được");
    const B = options.BABYLON || await loadBabylon(options);
    const created = await createEngine(B, canvas, options, capability);
    const engine = created.engine;
    let disposed = false;
    let paused = false;
    let currentQuality = QUALITY_PROFILES[options.quality] ? options.quality : (capability.mobile ? "light" : "balanced");
    const governor = createAdaptiveGovernor({ quality: currentQuality });
    engine.setHardwareScalingLevel?.(Math.max(1, (global.devicePixelRatio || 1) / QUALITY_PROFILES[currentQuality].dpr));
    const scene = new B.Scene(engine);
    scene.clearColor = new B.Color4(.018, .035, .052, 1);
    scene.fogMode = B.Scene.FOGMODE_EXP2;
    scene.fogDensity = QUALITY_PROFILES[currentQuality].fog ? .0017 : 0;
    scene.fogColor = new B.Color3(.035, .09, .105);
    const camera = new B.ArcRotateCamera("eonwild-camera", -Math.PI / 2, 1.08, 27, new B.Vector3(0, 2, 0), scene);
    camera.lowerRadiusLimit = 8; camera.upperRadiusLimit = 65; camera.lowerBetaLimit = .35; camera.upperBetaLimit = 1.48;
    camera.wheelPrecision = 28; camera.pinchPrecision = 72; camera.attachControl(canvas, true);
    const hemisphere = new B.HemisphericLight("eonwild-sky-light", new B.Vector3(0, 1, 0), scene);
    hemisphere.intensity = .78; hemisphere.groundColor = new B.Color3(.08, .12, .09);
    const sun = new B.DirectionalLight("eonwild-sun", new B.Vector3(-.46, -1, .38), scene);
    sun.position = new B.Vector3(80, 140, -60); sun.intensity = 1.35;
    const initialAddress = createWorldAddress(options.address || addressForSpecies(options.speciesId, options.seed));
    let address = initialAddress;
    let palette = paletteForAddress(address);
    const materialCache = new Map();
    const chunks = new Map();
    const wildlife = new Map();
    let lastChunkKey = "";
    let lastPlayerPosition = null;
    let playerSpeciesId = options.speciesId || "triceratops";
    let playerRoot = buildCreature(B, scene, SPECIES_CARTRIDGES[playerSpeciesId] || SPECIES_CARTRIDGES.triceratops, options.speciesColor || "#e4ba65", "player");
    const waterMaterial = new B.PBRMaterial("eonwild-water-material", scene);
    waterMaterial.albedoColor = B.Color3.FromHexString("#176681"); waterMaterial.alpha = .82; waterMaterial.metallic = .05; waterMaterial.roughness = .2;
    const water = B.MeshBuilder.CreateGround("eonwild-water", { width: WORLD_CONFIG.logicalSizeMeters, height: WORLD_CONFIG.logicalSizeMeters, subdivisions: 2 }, scene);
    water.position.y = -4; water.material = waterMaterial; water.isPickable = false;
    const getTerrainMaterial = (lod) => {
      const key = `${address.realmId}:${lod}`;
      if (materialCache.has(key)) return materialCache.get(key);
      const material = new B.PBRMaterial(`terrain-${key}`, scene);
      material.albedoColor = B.Color3.FromHexString(palette[Math.min(palette.length - 1, lod)] || palette[0]);
      material.roughness = .93; material.metallic = 0;
      materialCache.set(key, material); return material;
    };
    const createTerrainChunk = (descriptor) => {
      const profile = QUALITY_PROFILES[currentQuality];
      const subdivisions = profile.terrainSubdivisions[descriptor.lod] || 2;
      const mesh = B.MeshBuilder.CreateGround(`chunk-${descriptor.key}`, { width: WORLD_CONFIG.chunkSizeMeters, height: WORLD_CONFIG.chunkSizeMeters, subdivisions, updatable: true }, scene);
      const centerX = descriptor.x * WORLD_CONFIG.chunkSizeMeters + WORLD_CONFIG.chunkSizeMeters / 2;
      const centerZ = descriptor.z * WORLD_CONFIG.chunkSizeMeters + WORLD_CONFIG.chunkSizeMeters / 2;
      mesh.position.x = centerX - WORLD_CONFIG.logicalSizeMeters / 2;
      mesh.position.z = centerZ - WORLD_CONFIG.logicalSizeMeters / 2;
      const positions = mesh.getVerticesData(B.VertexBuffer.PositionKind);
      const indices = mesh.getIndices();
      if (positions && indices) {
        for (let index = 0; index < positions.length; index += 3) {
          const globalX = centerX + positions[index];
          const globalZ = centerZ + positions[index + 2];
          positions[index + 1] = terrainHeight(globalX, globalZ, address.seed);
        }
        const normals = [];
        B.VertexData.ComputeNormals(positions, indices, normals);
        mesh.updateVerticesData(B.VertexBuffer.PositionKind, positions);
        mesh.updateVerticesData(B.VertexBuffer.NormalKind, normals);
      }
      mesh.material = getTerrainMaterial(descriptor.lod); mesh.receiveShadows = true; mesh.isPickable = true;
      mesh.metadata = descriptor; chunks.set(descriptor.key, mesh); return mesh;
    };
    const streamChunks = (playerX, playerZ) => {
      const descriptorList = planChunkStreaming({ x: playerX, z: playerZ }, { quality: currentQuality, address });
      const next = new Set(descriptorList.map((row) => row.key));
      descriptorList.forEach((descriptor) => { if (!chunks.has(descriptor.key)) createTerrainChunk(descriptor); });
      chunks.forEach((mesh, key) => { if (!next.has(key)) { mesh.dispose(false, false); chunks.delete(key); } });
      return descriptorList;
    };
    const rebuildPlayer = (speciesId, color) => {
      playerRoot?.dispose(false, true);
      playerSpeciesId = speciesId;
      playerRoot = buildCreature(B, scene, SPECIES_CARTRIDGES[speciesId] || SPECIES_CARTRIDGES.triceratops, color, "player");
      lastPlayerPosition = null;
    };
    const syncWildlife = (population) => {
      const budget = QUALITY_PROFILES[currentQuality].wildlife;
      const visible = (Array.isArray(population) ? population : []).filter((row) => row?.alive !== false).slice(0, budget);
      const active = new Set();
      visible.forEach((row, index) => {
        const id = safeId(row.id, `wildlife-${index}`); active.add(id);
        let proxy = wildlife.get(id);
        if (!proxy) {
          const speciesId = row.species?.id || row.speciesId || "triceratops";
          proxy = buildCreature(B, scene, SPECIES_CARTRIDGES[speciesId] || { bodyScale: .45, locomotionRig: "quadruped" }, row.species?.color || "#8da477", id);
          proxy.scaling.scaleInPlace(.42); wildlife.set(id, proxy);
        }
        proxy.position.x = clamp(row.x, 0, WORLD_CONFIG.logicalSizeMeters) - WORLD_CONFIG.logicalSizeMeters / 2;
        proxy.position.z = clamp(row.y ?? row.z, 0, WORLD_CONFIG.logicalSizeMeters) - WORLD_CONFIG.logicalSizeMeters / 2;
        proxy.position.y = terrainHeight(row.x, row.y ?? row.z, address.seed);
        if (Math.abs(row.vx || 0) + Math.abs(row.vy || 0) > .02) proxy.rotation.y = -Math.atan2(row.vy || 0, row.vx || 0);
      });
      wildlife.forEach((proxy, id) => { if (!active.has(id)) { proxy.dispose(false, true); wildlife.delete(id); } });
    };
    const sync = (snapshot = {}) => {
      if (disposed) return false;
      const player = snapshot.player || {};
      const speciesId = String(snapshot.speciesId || playerSpeciesId);
      if (speciesId !== playerSpeciesId) rebuildPlayer(speciesId, snapshot.speciesColor || "#e4ba65");
      const nextAddress = createWorldAddress(snapshot.address || addressForSpecies(speciesId, address.seed));
      if (nextAddress.timeSliceId !== address.timeSliceId || nextAddress.regionId !== address.regionId || nextAddress.seed !== address.seed) {
        address = nextAddress; palette = paletteForAddress(address); chunks.forEach((mesh) => mesh.dispose(false, false)); chunks.clear(); materialCache.forEach((material) => material.dispose()); materialCache.clear(); lastChunkKey = "";
      }
      const x = clamp(player.x, 0, WORLD_CONFIG.logicalSizeMeters);
      const z = clamp(player.y ?? player.z, 0, WORLD_CONFIG.logicalSizeMeters);
      const localX = x - WORLD_CONFIG.logicalSizeMeters / 2;
      const localZ = z - WORLD_CONFIG.logicalSizeMeters / 2;
      const groundY = terrainHeight(x, z, address.seed);
      const currentChunk = chunkKey(worldToChunk(x, z).x, worldToChunk(x, z).z, address);
      if (currentChunk !== lastChunkKey) { streamChunks(x, z); lastChunkKey = currentChunk; }
      playerRoot.position.set(localX, groundY, localZ);
      const heading = Number(snapshot.heading || 0);
      playerRoot.rotation.y = -heading;
      const moving = lastPlayerPosition ? Math.hypot(lastPlayerPosition.x - localX, lastPlayerPosition.z - localZ) > .01 : false;
      const fracture = clamp(player.injuries?.fracture, 0, 100) / 100;
      const pulse = global.performance?.now ? global.performance.now() / 1000 : Date.now() / 1000;
      playerRoot.position.y += moving ? Math.sin(pulse * (fracture > .25 ? 5 : 9)) * .08 * (1 - fracture * .6) : 0;
      playerRoot.rotation.z = fracture * .08 * Math.sin(pulse * 3);
      const material = playerRoot.metadata?.material;
      if (material) material.emissiveColor = snapshot.senseActive ? B.Color3.FromHexString("#55e6ff").scale(.3 + Math.sin(pulse * 6) * .12) : B.Color3.Black();
      camera.setTarget(new B.Vector3(localX, groundY + 1.5, localZ));
      syncWildlife(snapshot.population);
      const day = Number(snapshot.world?.day ?? 12);
      const daylight = clamp(Math.sin((day - 6) / 24 * Math.PI * 2) * .6 + .48, .08, 1);
      sun.intensity = .3 + daylight * 1.15; hemisphere.intensity = .22 + daylight * .62;
      scene.fogDensity = QUALITY_PROFILES[currentQuality].fog ? (snapshot.world?.weather?.type === "mist" ? .0042 : .0017) : 0;
      paused = snapshot.paused === true;
      lastPlayerPosition = { x: localX, z: localZ };
      return true;
    };
    let governorAt = global.performance?.now?.() || Date.now();
    engine.runRenderLoop(() => {
      if (disposed || paused || global.document?.hidden) return;
      try {
        scene.render();
        const now = global.performance?.now?.() || Date.now();
        if (now - governorAt > 2000) {
          governorAt = now;
          const sample = governor.sample(engine.getFps?.() || 0);
          if (sample.changed) {
            currentQuality = sample.quality;
            engine.setHardwareScalingLevel?.(Math.max(1, (global.devicePixelRatio || 1) / sample.profile.dpr));
            options.onQualityChange?.(sample);
          }
        }
      } catch (error) { paused = true; options.onFailure?.(error); }
    });
    streamChunks(WORLD_CONFIG.logicalSizeMeters / 2, WORLD_CONFIG.logicalSizeMeters / 2);
    const resize = () => { if (!disposed) engine.resize?.(); };
    global.addEventListener?.("resize", resize);
    return Object.freeze({
      version: VERSION,
      backend: created.backend,
      capability,
      sync,
      resize,
      setPaused(value) { paused = Boolean(value); return paused; },
      setQuality(value) {
        if (!QUALITY_PROFILES[value]) return currentQuality;
        currentQuality = value; governor.setQuality(value); engine.setHardwareScalingLevel?.(Math.max(1, (global.devicePixelRatio || 1) / QUALITY_PROFILES[value].dpr)); return currentQuality;
      },
      getStatus() { return Object.freeze({ backend: created.backend, quality: currentQuality, fps: Math.round(engine.getFps?.() || 0), chunks: chunks.size, wildlife: wildlife.size, address }); },
      capture() { return new Promise((resolve, reject) => canvas.toBlob ? canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to capture frame")), "image/png") : reject(new Error("Canvas capture is unsupported"))); },
      dispose() {
        if (disposed) return false;
        disposed = true; global.removeEventListener?.("resize", resize); engine.stopRenderLoop?.(); wildlife.forEach((node) => node.dispose(false, true)); chunks.forEach((mesh) => mesh.dispose(false, false)); materialCache.forEach((material) => material.dispose()); scene.dispose(); engine.dispose(); return true;
      }
    });
  }

  return Object.freeze({
    VERSION,
    BABYLON_VERSION,
    BABYLON_URL,
    WORLD_CONFIG,
    QUALITY_PROFILES,
    GAME_MODES,
    TIME_SLICES,
    REGIONS,
    SPECIES_CARTRIDGES,
    listTimeSlices,
    defaultTimeSlice,
    createWorldAddress,
    addressForSpecies,
    isSpeciesAllowedAtAddress,
    worldToChunk,
    chunkKey,
    planChunkStreaming,
    createAdaptiveGovernor,
    detectCapabilities,
    loadBabylon,
    terrainHeight,
    createRuntime
  });
});
