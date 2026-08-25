(function (root, factory) {
  "use strict";

  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHEonWild3D = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createEonWild3D(global) {
  "use strict";

  const VERSION = "3.1.0";
  const BABYLON_VERSION = "9.22.1";
  const SCRIPT_BASE_URL = (() => {
    try { return global.document?.currentScript?.src ? new URL("./", global.document.currentScript.src).href : ""; } catch { return ""; }
  })();
  const BABYLON_URL = SCRIPT_BASE_URL ? new URL(`vendor/babylon-${BABYLON_VERSION}.js?v=${BABYLON_VERSION}`, SCRIPT_BASE_URL).href : `./vendor/babylon-${BABYLON_VERSION}.js?v=${BABYLON_VERSION}`;
  const WORLD_CONFIG = Object.freeze({
    logicalSizeMeters: 16384,
    chunkSizeMeters: 256,
    highDetailMeters: 300,
    mediumDetailMeters: 1200,
    farDetailMeters: 16000,
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
    cinematic: Object.freeze({ id: "cinematic", label: "Ultra", targetFps: 45, dpr: 1.8, chunkRadius: 5, terrainSubdivisions: [64, 32, 12, 4], wildlife: 32, shadows: true, fog: true, particles: 24 }),
    personal: Object.freeze({ id: "personal", label: "Cinematic Personal", targetFps: 30, dpr: 2, chunkRadius: 6, terrainSubdivisions: [96, 48, 16, 6], wildlife: 40, shadows: true, fog: true, particles: 32, ownerOnly: true })
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
  const scheduleTimeout = (callback, delay) => {
    const scheduler = typeof global.setTimeout === "function" ? global.setTimeout : (typeof setTimeout === "function" ? setTimeout : null);
    if (!scheduler) throw new Error("A timeout scheduler is required");
    return scheduler.call(global, callback, delay);
  };
  const cancelTimeout = (timer) => {
    const cancel = typeof global.clearTimeout === "function" ? global.clearTimeout : (typeof clearTimeout === "function" ? clearTimeout : null);
    if (cancel && timer !== undefined && timer !== null) cancel.call(global, timer);
  };
  const disposeSafely = (resource) => {
    try { resource?.dispose?.(); } catch {}
  };
  function withTimeout(value, timeoutMs, message, onLateResolve) {
    const duration = Math.trunc(clamp(timeoutMs, 1000, 60000));
    return new Promise((resolve, reject) => {
      let settled = false;
      let timedOut = false;
      let timer;
      try {
        timer = scheduleTimeout(() => {
          if (settled) return;
          settled = true;
          timedOut = true;
          const error = new Error(message || "Operation timed out");
          error.code = "HWE_TIMEOUT";
          reject(error);
        }, duration);
      } catch (error) { reject(error); return; }
      Promise.resolve(value).then((result) => {
        if (settled) {
          if (timedOut && typeof onLateResolve === "function") {
            try { onLateResolve(result); } catch {}
          }
          return;
        }
        settled = true;
        cancelTimeout(timer);
        resolve(result);
      }, (error) => {
        if (settled) return;
        settled = true;
        cancelTimeout(timer);
        reject(error);
      });
    });
  }
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
    const order = ["static", "light", "balanced", "high", "cinematic", "personal"];
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
        // Personal is deliberately opt-in: adaptive quality may leave it when
        // performance is poor, but never enters it on the owner's behalf.
        else if (goodWindows >= 15 && options.allowUpgrade === true && index >= 0 && index < order.indexOf("cinematic")) { qualityId = order[index + 1]; goodWindows = 0; changed = true; }
        return Object.freeze({ changed, quality: qualityId, fps: measured, profile: QUALITY_PROFILES[qualityId] });
      },
      setQuality(next) {
        if (QUALITY_PROFILES[next]) { qualityId = next; badWindows = 0; goodWindows = 0; }
        return qualityId;
      }
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
    const requested = String(options.url || BABYLON_URL);
    let source;
    try {
      const baseHref = global.location?.href || global.document?.baseURI;
      if (!baseHref) throw new Error("Babylon source requires a non-opaque page origin");
      const page = new URL(baseHref);
      const currentOrigin = String(global.location?.origin || page.origin || "");
      if (!/^https?:$/i.test(page.protocol) || !currentOrigin || currentOrigin === "null") throw new Error("Babylon source requires a non-opaque HTTP(S) page origin");
      source = new URL(requested, page.href);
      if (!/^https?:$/i.test(source.protocol) || source.origin !== currentOrigin) throw new Error("Babylon source must be same-origin HTTP(S)");
    } catch (error) { return Promise.reject(error); }
    if (babylonPromise) return babylonPromise;
    const pending = new Promise((resolve, reject) => {
      const timeoutMs = Math.trunc(clamp(options.timeoutMs ?? 20000, 4000, 60000));
      let settled = false;
      let timer = null;
      let script = null;
      let owned = false;
      let onLoad = null;
      let onError = null;
      const cleanup = () => {
        cancelTimeout(timer);
        if (onLoad) script?.removeEventListener?.("load", onLoad);
        if (onError) script?.removeEventListener?.("error", onError);
        if (script?.onload === onLoad) script.onload = null;
        if (script?.onerror === onError) script.onerror = null;
      };
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback(value);
      };
      const fail = (error) => {
        if (settled) return;
        if (script?.dataset) script.dataset.hweBabylonState = "failed";
        script?.remove?.();
        finish(reject, error);
      };
      onLoad = () => {
        if (!global.BABYLON?.Engine) { fail(new Error("Babylon engine API is unavailable")); return; }
        if (script?.dataset) script.dataset.hweBabylonState = "loaded";
        finish(resolve, global.BABYLON);
      };
      onError = () => fail(new Error("Unable to load Babylon runtime"));
      try {
        script = global.document.querySelector?.("script[data-hwe-babylon]") || null;
        if (script) {
          let existingSource = "";
          try { existingSource = new URL(String(script.src || ""), global.document?.baseURI || global.location?.href || source.href).href; } catch {}
          const matchesRequest = existingSource === source.href && script.dataset?.hweBabylon === BABYLON_VERSION && script.dataset?.hweBabylonState === "loading";
          if (!matchesRequest) { script.remove?.(); script = null; }
        }
        owned = !script;
        if (!script) {
          script = global.document.createElement("script");
          script.src = source.href;
          script.async = true;
          script.dataset.hweBabylon = BABYLON_VERSION;
          script.dataset.hweBabylonState = "loading";
        }
        timer = scheduleTimeout(() => fail(new Error("Babylon runtime timed out")), timeoutMs);
        if (typeof script.addEventListener === "function") {
          script.addEventListener("load", onLoad, { once: true });
          script.addEventListener("error", onError, { once: true });
        } else {
          script.onload = onLoad;
          script.onerror = onError;
        }
        if (global.BABYLON?.Engine) { onLoad(); return; }
        if (owned) {
          const host = global.document.head || global.document.body || global.document.documentElement;
          if (!host?.append) { fail(new Error("Unable to attach Babylon runtime script")); return; }
          host.append(script);
        }
      } catch (error) { fail(error); }
    });
    babylonPromise = pending;
    pending.catch(() => { if (babylonPromise === pending) babylonPromise = null; });
    return pending;
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
    const notifyWebGPUFailure = (error) => {
      try { options.onTelemetry?.({ type: "webgpu-init-failed", message: error?.message || "WebGPU init failed" }); } catch {}
    };
    if (preferWebGPU) {
      const initTimeoutMs = options.initTimeoutMs ?? options.timeoutMs ?? 12000;
      let supported = true;
      let supportError = null;
      try {
        if (B.WebGPUEngine.IsSupportedAsync !== undefined) {
          const probe = B.WebGPUEngine.IsSupportedAsync;
          const result = typeof probe === "function" ? probe.call(B.WebGPUEngine) : probe;
          supported = Boolean(await withTimeout(result, initTimeoutMs, "WebGPU support probe timed out"));
        }
      } catch (error) { supported = false; supportError = error; }
      if (!supported) notifyWebGPUFailure(supportError || new Error("Babylon reports that WebGPU is unavailable"));
      if (supported) {
        let engine = null;
        let engineDisposed = false;
        const disposeWebGPUEngine = () => {
          if (engineDisposed) return;
          engineDisposed = true;
          disposeSafely(engine);
        };
        try {
          engine = new B.WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: true, enableAllFeatures: false });
          if (typeof engine.initAsync !== "function") throw new Error("Babylon WebGPU engine has no async initializer");
          await withTimeout(engine.initAsync(), initTimeoutMs, "WebGPU initialization timed out", () => {
            // initAsync may allocate again after our timeout disposal. Dispose
            // once more when that late promise settles so no GPU resource can
            // survive a cancelled or timed-out route startup.
            disposeSafely(engine);
          });
          return { engine, backend: "webgpu" };
        } catch (error) {
          disposeWebGPUEngine();
          notifyWebGPUFailure(error);
          const failure = new Error("WebGPU initialization failed after binding the render canvas; Canvas Lite fallback is required");
          failure.code = "WEBGPU_CANVAS_INIT_FAILED";
          failure.cause = error;
          throw failure;
        }
      }
    }
    const webglSupported = typeof B.Engine?.IsSupported === "function" ? B.Engine.IsSupported() : B.Engine?.IsSupported;
    if (!webglSupported) throw new Error("WebGL is unavailable on this device");
    let engine = null;
    try {
      engine = new B.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false, adaptToDeviceRatio: true, useHighPrecisionMatrix: true }, true);
      return { engine, backend: engine.webGLVersion >= 2 ? "webgl2" : "webgl1" };
    } catch (error) {
      disposeSafely(engine);
      throw error;
    }
  }

  async function createRuntime(canvas, options = {}) {
    if (!canvas?.getContext) throw new TypeError("A render canvas is required");
    const startupCancelled = () => {
      try { return Boolean(options.signal?.aborted || options.isCancelled?.()); }
      catch { return true; }
    };
    const throwIfStartupCancelled = () => {
      if (!startupCancelled()) return;
      const error = new Error("3D startup was cancelled");
      error.code = "RENDER_START_CANCELLED";
      throw error;
    };
    throwIfStartupCancelled();
    const capability = detectCapabilities();
    if (!capability.webgpu && !capability.webgl2 && !capability.webgl1) throw new Error("Thiết bị không hỗ trợ WebGL/WebGPU; Lite Mode vẫn dùng được");
    const B = options.BABYLON || await loadBabylon(options);
    throwIfStartupCancelled();
    let created = null;
    let engine = null;
    let scene = null;
    let camera = null;
    let disposed = false;
    let removeExternalListeners = () => {};
    let stopRuntimeLoop = () => {};
    try {
      created = await createEngine(B, canvas, options, capability);
      engine = created.engine;
      throwIfStartupCancelled();
      let paused = options.paused === true;
      let renderLoopRunning = false;
      let renderFrame = null;
      let currentQuality = QUALITY_PROFILES[options.quality] ? options.quality : (capability.mobile ? "light" : "balanced");
      let adaptiveQuality = options.adaptiveQuality !== false;
      const governor = createAdaptiveGovernor({ quality: currentQuality });
      engine.setHardwareScalingLevel?.(Math.max(1, (global.devicePixelRatio || 1) / QUALITY_PROFILES[currentQuality].dpr));
      scene = new B.Scene(engine);
      scene.clearColor = new B.Color4(.018, .035, .052, 1);
      scene.fogMode = B.Scene.FOGMODE_EXP2;
      scene.fogDensity = QUALITY_PROFILES[currentQuality].fog ? .0017 : 0;
      scene.fogColor = new B.Color3(.035, .09, .105);
      camera = new B.ArcRotateCamera("eonwild-camera", -Math.PI / 2, 1.08, 27, new B.Vector3(0, 2, 0), scene);
      camera.lowerRadiusLimit = 8; camera.upperRadiusLimit = 65; camera.lowerBetaLimit = .35; camera.upperBetaLimit = 1.48;
      camera.wheelPrecision = 28; camera.pinchPrecision = 72;
      if (options.controls === true) camera.attachControl(canvas, true);
      const hemisphere = new B.HemisphericLight("eonwild-sky-light", new B.Vector3(0, 1, 0), scene);
      hemisphere.intensity = .78; hemisphere.groundColor = new B.Color3(.08, .12, .09);
      const sun = new B.DirectionalLight("eonwild-sun", new B.Vector3(-.46, -1, .38), scene);
      sun.position = new B.Vector3(80, 140, -60); sun.intensity = 1.35;
      let address = createWorldAddress(options.address || addressForSpecies(options.speciesId, options.seed));
      let palette = paletteForAddress(address);
      const materialCache = new Map();
      const chunks = new Map();
      const desiredChunks = new Map();
      const chunkQueue = [];
      const queuedChunks = new Set();
      const wildlife = new Map();
      let lastChunkKey = "";
      let lastPlayerPosition = null;
      let lastStreamPosition = { x: WORLD_CONFIG.logicalSizeMeters / 2, z: WORLD_CONFIG.logicalSizeMeters / 2 };
      let lastPopulation = [];
      let playerSpeciesId = options.speciesId || "triceratops";
      let gameplayCamera = {
        yaw: 0,
        pitch: -.18,
        distance: 27,
        fov: 68,
        profileId: "ground",
        firstPerson: false
      };
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
      const enrichDescriptor = (descriptor) => Object.freeze({
        ...descriptor,
        subdivisions: QUALITY_PROFILES[currentQuality].terrainSubdivisions[descriptor.lod] || 2
      });
      const descriptorMatches = (mesh, descriptor) => Boolean(mesh?.metadata &&
        mesh.metadata.key === descriptor.key && mesh.metadata.lod === descriptor.lod && mesh.metadata.subdivisions === descriptor.subdivisions);
      const createTerrainChunk = (descriptor) => {
        const subdivisions = descriptor.subdivisions;
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
        mesh.metadata = descriptor;
        return mesh;
      };
      const processChunkQueue = (requestedLimit) => {
        const limit = Math.trunc(clamp(requestedLimit, 1, 4));
        let built = 0;
        while (built < limit && chunkQueue.length) {
          const pending = chunkQueue.shift();
          queuedChunks.delete(pending.key);
          const wanted = desiredChunks.get(pending.key);
          if (!wanted || wanted.lod !== pending.lod || wanted.subdivisions !== pending.subdivisions) continue;
          const current = chunks.get(pending.key);
          if (descriptorMatches(current, wanted)) continue;
          const replacement = createTerrainChunk(wanted);
          current?.dispose(false, false);
          chunks.set(pending.key, replacement);
          built += 1;
        }
        return built;
      };
      const streamChunks = (playerX, playerZ) => {
        lastStreamPosition = { x: playerX, z: playerZ };
        const descriptorList = planChunkStreaming({ x: playerX, z: playerZ }, { quality: currentQuality, address });
        desiredChunks.clear();
        descriptorList.forEach((descriptor) => {
          const enriched = enrichDescriptor(descriptor);
          desiredChunks.set(enriched.key, enriched);
        });
        chunks.forEach((mesh, key) => {
          if (desiredChunks.has(key)) return;
          mesh.dispose(false, false);
          chunks.delete(key);
        });
        chunkQueue.length = 0;
        queuedChunks.clear();
        descriptorList.forEach((descriptor) => {
          const wanted = desiredChunks.get(descriptor.key);
          if (descriptorMatches(chunks.get(descriptor.key), wanted)) return;
          if (chunkQueue.length >= WORLD_CONFIG.maximumResidentChunks) return;
          chunkQueue.push(wanted);
          queuedChunks.add(wanted.key);
        });
        return descriptorList;
      };
      let motionMode = options.reducedMotion === undefined ? "auto" : options.reducedMotion;
      let mediaQuery = null;
      try { mediaQuery = global.matchMedia?.("(prefers-reduced-motion: reduce)") || null; } catch {}
      let reducedMotion = false;
      const refreshReducedMotion = () => {
        const explicitlyDisabled = motionMode === false;
        const explicitlyEnabled = motionMode === true || motionMode === "static" || motionMode === "reduce";
        const systemPreferred = Boolean(mediaQuery?.matches ?? capability.reducedMotion);
        reducedMotion = !explicitlyDisabled && (explicitlyEnabled || currentQuality === "static" || systemPreferred);
        if (reducedMotion && playerRoot) playerRoot.rotation.z = 0;
        return reducedMotion;
      };
      refreshReducedMotion();
      const rebuildPlayer = (speciesId, color) => {
        playerRoot?.dispose(false, true);
        playerSpeciesId = speciesId;
        playerRoot = buildCreature(B, scene, SPECIES_CARTRIDGES[speciesId] || SPECIES_CARTRIDGES.triceratops, color, "player");
        lastPlayerPosition = null;
        refreshReducedMotion();
      };
      const syncWildlife = (population) => {
        lastPopulation = Array.isArray(population) ? population : [];
        const budget = QUALITY_PROFILES[currentQuality].wildlife;
        const visible = lastPopulation.filter((row) => row?.alive !== false).slice(0, budget);
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
      let governorAt = global.performance?.now?.() || Date.now();
      const stopRenderLoop = () => {
        if (!renderLoopRunning || !engine) return;
        try { engine.stopRenderLoop?.(renderFrame); } catch {}
        renderLoopRunning = false;
      };
      const startRenderLoop = () => {
        if (disposed || paused || global.document?.hidden || renderLoopRunning || !renderFrame) return;
        governorAt = global.performance?.now?.() || Date.now();
        renderLoopRunning = true;
        try { engine.runRenderLoop(renderFrame); }
        catch (error) { renderLoopRunning = false; throw error; }
      };
      stopRuntimeLoop = stopRenderLoop;
      const setPausedState = (value) => {
        paused = Boolean(value);
        if (paused) stopRenderLoop();
        else startRenderLoop();
        return paused;
      };
      const applyCameraInput = (value = {}) => {
        if (disposed || !value || typeof value !== "object") return false;
        const profileLimits = {
          ground: [1.3, 18], heavy: [2.5, 24], small: [.7, 12], bird: [1.5, 28], aquatic: [1.2, 24], climbing: [.9, 16], burrow: [.5, 9]
        };
        const profileId = Object.hasOwn(profileLimits, value.profileId) ? value.profileId : gameplayCamera.profileId;
        const limits = profileLimits[profileId] || profileLimits.ground;
        gameplayCamera = {
          yaw: Number.isFinite(Number(value.yaw)) ? Number(value.yaw) : gameplayCamera.yaw,
          pitch: clamp(value.pitch ?? gameplayCamera.pitch, -1.35, 1.05),
          distance: clamp(value.distance ?? gameplayCamera.distance, value.firstPerson ? .1 : limits[0], limits[1]),
          fov: clamp(value.fov ?? gameplayCamera.fov, 35, 120),
          profileId,
          firstPerson: value.firstPerson === undefined ? gameplayCamera.firstPerson : Boolean(value.firstPerson)
        };
        camera.alpha = -gameplayCamera.yaw - Math.PI / 2;
        camera.beta = Math.PI / 2 + gameplayCamera.pitch;
        camera.radius = gameplayCamera.distance;
        camera.fov = gameplayCamera.fov * Math.PI / 180;
        return true;
      };
      const applyQuality = (value, governorDriven = false) => {
        if (!QUALITY_PROFILES[value]) return currentQuality;
        const changed = value !== currentQuality;
        currentQuality = value;
        if (!governorDriven) governor.setQuality(value);
        engine.setHardwareScalingLevel?.(Math.max(1, (global.devicePixelRatio || 1) / QUALITY_PROFILES[value].dpr));
        refreshReducedMotion();
        if (changed) streamChunks(lastStreamPosition.x, lastStreamPosition.z);
        syncWildlife(lastPopulation);
        return currentQuality;
      };
      const sync = (snapshot = {}) => {
        if (disposed) return false;
        const player = snapshot.player || {};
        const speciesId = String(snapshot.speciesId || playerSpeciesId);
        if (speciesId !== playerSpeciesId) rebuildPlayer(speciesId, snapshot.speciesColor || "#e4ba65");
        const nextAddress = createWorldAddress(snapshot.address || addressForSpecies(speciesId, address.seed));
        const worldChanged = nextAddress.timeSliceId !== address.timeSliceId || nextAddress.regionId !== address.regionId || nextAddress.seed !== address.seed;
        address = nextAddress;
        if (worldChanged) {
          palette = paletteForAddress(address);
          chunks.forEach((mesh) => mesh.dispose(false, false));
          chunks.clear();
          desiredChunks.clear();
          chunkQueue.length = 0;
          queuedChunks.clear();
          materialCache.forEach((material) => material.dispose());
          materialCache.clear();
          lastChunkKey = "";
        }
        const x = clamp(player.x, 0, WORLD_CONFIG.logicalSizeMeters);
        const z = clamp(player.y ?? player.z, 0, WORLD_CONFIG.logicalSizeMeters);
        lastStreamPosition = { x, z };
        const localX = x - WORLD_CONFIG.logicalSizeMeters / 2;
        const localZ = z - WORLD_CONFIG.logicalSizeMeters / 2;
        const groundY = terrainHeight(x, z, address.seed);
        const chunk = worldToChunk(x, z);
        const currentChunk = chunkKey(chunk.x, chunk.z, address);
        if (currentChunk !== lastChunkKey) { streamChunks(x, z); lastChunkKey = currentChunk; }
        playerRoot.position.set(localX, groundY, localZ);
        const heading = Number(snapshot.heading || 0);
        playerRoot.rotation.y = -heading;
        const moving = lastPlayerPosition ? Math.hypot(lastPlayerPosition.x - localX, lastPlayerPosition.z - localZ) > .01 : false;
        const fracture = clamp(player.injuries?.fracture, 0, 100) / 100;
        const pulse = reducedMotion ? 0 : (global.performance?.now ? global.performance.now() / 1000 : Date.now() / 1000);
        if (!reducedMotion && moving) playerRoot.position.y += Math.sin(pulse * (fracture > .25 ? 5 : 9)) * .08 * (1 - fracture * .6);
        playerRoot.rotation.z = reducedMotion ? 0 : fracture * .08 * Math.sin(pulse * 3);
        const material = playerRoot.metadata?.material;
        if (material) material.emissiveColor = snapshot.senseActive
          ? B.Color3.FromHexString("#55e6ff").scale(reducedMotion ? .3 : .3 + Math.sin(pulse * 6) * .12)
          : B.Color3.Black();
        camera.setTarget(new B.Vector3(localX, groundY + 1.5, localZ));
        syncWildlife(snapshot.population);
        const day = Number(snapshot.world?.day ?? 12);
        const daylight = clamp(Math.sin((day - 6) / 24 * Math.PI * 2) * .6 + .48, .08, 1);
        sun.intensity = .3 + daylight * 1.15; hemisphere.intensity = .22 + daylight * .62;
        scene.fogDensity = QUALITY_PROFILES[currentQuality].fog ? (snapshot.world?.weather?.type === "mist" ? .0042 : .0017) : 0;
        setPausedState(snapshot.paused === true);
        lastPlayerPosition = { x: localX, z: localZ };
        return true;
      };
      renderFrame = () => {
        if (disposed || paused || global.document?.hidden) { stopRenderLoop(); return; }
        try {
          const buildLimit = ["high", "cinematic"].includes(currentQuality) ? 2 : 1;
          processChunkQueue(buildLimit);
          scene.render();
          const now = global.performance?.now?.() || Date.now();
          if (adaptiveQuality && now - governorAt > 2000) {
            governorAt = now;
            const sample = governor.sample(engine.getFps?.() || 0);
            if (sample.changed) {
              applyQuality(sample.quality, true);
              try { options.onQualityChange?.(sample); } catch {}
            }
          }
        } catch (error) {
          setPausedState(true);
          try { options.onFailure?.(error); } catch {}
        }
      };
      const initialChunk = worldToChunk(lastStreamPosition.x, lastStreamPosition.z);
      streamChunks(lastStreamPosition.x, lastStreamPosition.z);
      lastChunkKey = chunkKey(initialChunk.x, initialChunk.z, address);
      processChunkQueue(1);
      scene.render();
      const resize = () => { if (!disposed) engine.resize?.(); };
      const visibilityChange = () => {
        if (global.document?.hidden) stopRenderLoop();
        else if (!paused) startRenderLoop();
      };
      const motionChange = () => refreshReducedMotion();
      removeExternalListeners = () => {
        try { global.removeEventListener?.("resize", resize); } catch {}
        try { global.document?.removeEventListener?.("visibilitychange", visibilityChange); } catch {}
        try {
          if (typeof mediaQuery?.removeEventListener === "function") mediaQuery.removeEventListener("change", motionChange);
          else mediaQuery?.removeListener?.(motionChange);
        } catch {}
      };
      global.addEventListener?.("resize", resize);
      global.document?.addEventListener?.("visibilitychange", visibilityChange);
      if (typeof mediaQuery?.addEventListener === "function") mediaQuery.addEventListener("change", motionChange);
      else mediaQuery?.addListener?.(motionChange);
      startRenderLoop();
      return Object.freeze({
        version: VERSION,
        backend: created.backend,
        capability,
        sync,
        resize,
        applyCameraInput,
        getCameraState() {
          return Object.freeze({ ...gameplayCamera, forward: Object.freeze({ x: Math.sin(gameplayCamera.yaw), z: Math.cos(gameplayCamera.yaw) }), right: Object.freeze({ x: Math.cos(gameplayCamera.yaw), z: -Math.sin(gameplayCamera.yaw) }) });
        },
        resolveCameraCollision() { return Object.freeze({ supported: false, terrainOnly: true, mode: "generic-core-unavailable", distance: null, desiredDistance: gameplayCamera.distance }); },
        setHighlightedTarget() { return false; },
        setPaused: setPausedState,
        setMotion(value) { motionMode = value === undefined ? "auto" : value; return refreshReducedMotion(); },
        setReducedMotion(value) { motionMode = value === undefined ? "auto" : value; return refreshReducedMotion(); },
        setAdaptiveQuality(value) {
          adaptiveQuality = Boolean(value);
          governor.setQuality(currentQuality);
          governorAt = global.performance?.now?.() || Date.now();
          return adaptiveQuality;
        },
        setQuality(value) { return applyQuality(value); },
        getStatus() {
          return Object.freeze({
            backend: created.backend,
            quality: currentQuality,
            fps: Math.round(engine.getFps?.() || 0),
            chunks: chunks.size,
            queuedChunks: queuedChunks.size,
            desiredChunks: desiredChunks.size,
            wildlife: wildlife.size,
            reducedMotion,
            adaptiveQuality,
            paused,
            address
          });
        },
        capture() { return new Promise((resolve, reject) => canvas.toBlob ? canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to capture frame")), "image/png") : reject(new Error("Canvas capture is unsupported"))); },
        dispose() {
          if (disposed) return false;
          disposed = true;
          stopRenderLoop();
          removeExternalListeners();
          try { camera?.detachControl?.(); } catch {}
          wildlife.forEach((node) => { try { node.dispose(false, true); } catch {} });
          chunks.forEach((mesh) => { try { mesh.dispose(false, false); } catch {} });
          materialCache.forEach((material) => disposeSafely(material));
          disposeSafely(scene);
          disposeSafely(engine);
          return true;
        }
      });
    } catch (error) {
      disposed = true;
      stopRuntimeLoop();
      removeExternalListeners();
      try { camera?.detachControl?.(); } catch {}
      disposeSafely(scene);
      disposeSafely(engine);
      throw error;
    }
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
