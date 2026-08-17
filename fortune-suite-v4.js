(function fortuneSuiteV4Module(scope, factory) {
  "use strict";
  const api = factory(scope || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope && typeof scope === "object") scope.HHFortuneSuiteV4 = api;
})(typeof window !== "undefined" ? window : globalThis, function createFortuneSuiteV4(globalScope) {
  "use strict";

  const VERSION = "5.0.0";
  const CONTENT_VERSION = "hh-reflection-content-2026.09";
  const ASTRONOMY_VERSION = "Astronomy Engine 2.1.19";
  const LABELS = Object.freeze({ calculation: "TÍNH TOÁN", symbolic: "BIỂU TƯỢNG", ai: "AI" });
  const ZODIAC_MODES = Object.freeze(["tropical", "sidereal"]);
  const HOUSE_SYSTEMS = Object.freeze(["equal", "whole-sign", "porphyry"]);
  const DEFAULT_ORBS = Object.freeze({ conjunction: 8, sextile: 5, square: 7, trine: 7, opposition: 8 });
  const AU_KM = 149597870.7;

  const SOURCE_REFERENCES = Object.freeze({
    iana: Object.freeze({ id: "iana-tzdb", title: "IANA Time Zone Database", url: "https://www.iana.org/time-zones", role: "Múi giờ dân sự và DST" }),
    jpl: Object.freeze({ id: "jpl-horizons", title: "NASA/JPL Horizons", url: "https://ssd.jpl.nasa.gov/horizons/manual.html", role: "Đường chuẩn đối chiếu ephemeris" }),
    astronomy: Object.freeze({ id: "astronomy-engine", title: "Astronomy Engine", url: "https://github.com/cosinekitty/astronomy", role: "VSOP87/NOVAS · MIT" }),
    usno: Object.freeze({ id: "usno-moon", title: "USNO Moon Data Services", url: "https://aa.usno.navy.mil/data/api.html", role: "Pha Mặt Trăng và mốc UTC" }),
    nasaMoon: Object.freeze({ id: "nasa-moon", title: "NASA Moon Phases", url: "https://science.nasa.gov/moon/moon-phases/", role: "Giải thích thiên văn Mặt Trăng" }),
    nasaMoonKit: Object.freeze({ id: "nasa-svs-cgi-moon-kit", title: "NASA SVS · CGI Moon Kit", url: "https://svs.gsfc.nasa.gov/4720/", role: "Texture LRO/LROC và bản đồ độ cao LOLA cho mô hình 3D" }),
    hko: Object.freeze({ id: "hko-solar-terms", title: "Hong Kong Observatory · 24 Solar Terms", url: "https://www.hko.gov.hk/en/gts/time/24solarterms.htm", role: "Định nghĩa 24 tiết khí theo kinh độ Mặt Trời" }),
    iztro: Object.freeze({ id: "iztro-2.6.0", title: "iztro · Zi Wei Dou Shu engine", url: "https://github.com/SylarLong/iztro", role: "Lập lá số Tử Vi 12 cung · MIT" }),
    rws: Object.freeze({ id: "rws-waite-1911", title: "The Pictorial Key to the Tarot · 1911", url: "https://sacred-texts.com/tarot/pkt/pkttp.htm", role: "Nguồn lịch sử RWS công cộng" }),
    rwsImages: Object.freeze({ id: "rws-wikimedia", title: "Rider–Waite–Smith · Wikimedia Commons", url: "https://commons.wikimedia.org/wiki/Category:Rider-Waite-Smith_tarot_deck_(Geldard)", role: "78 hình Public Domain Mark 1.0" }),
    iching: Object.freeze({ id: "ctext-zhouyi", title: "Chinese Text Project · Zhouyi", url: "https://ctext.org/book-of-changes/ens", role: "Văn bản và cấu trúc 64 quẻ" }),
    lenormand: Object.freeze({ id: "wikimedia-game-of-hope-1799", title: "Das Spiel der Hoffnung (1799) · Wikimedia Commons", url: "https://commons.wikimedia.org/wiki/File:Das_Spiel_der_Hofnung_(The_Game_of_Hope).png", role: "Ảnh bộ 36 lá lịch sử · Public Domain Mark 1.0" }),
    runes: Object.freeze({ id: "unicode-runic", title: "Unicode Standard · Runic", url: "https://www.unicode.org/versions/Unicode17.0.0/core-spec/chapter-8/", role: "Tên, ký tự và thứ tự Elder Futhark" }),
    hh: Object.freeze({ id: "hh-original", title: "HH Original Reflection Content", url: "#/fortune/methods", role: "Diễn giải tiếng Việt nguyên bản" })
  });
  const INTERPRETATION_PACKS = Object.freeze({
    "hh-rws-reflection": Object.freeze({ id: "hh-rws-reflection", version: "2.0.0", language: "vi", nature: "symbolic", sourceIds: ["rws-waite-1911", "hh-original"] }),
    "hh-iching-reflection": Object.freeze({ id: "hh-iching-reflection", version: "2.0.0", language: "vi", nature: "symbolic", sourceIds: ["ctext-zhouyi", "hh-original"] }),
    "hh-numerology-transparent": Object.freeze({ id: "hh-numerology-transparent", version: "2.0.0", language: "vi", nature: "symbolic", sourceIds: ["hh-original"] }),
    "hh-astrology-reflection": Object.freeze({ id: "hh-astrology-reflection", version: "2.0.0", language: "vi", nature: "symbolic", sourceIds: ["astronomy-engine", "hh-original"] }),
    "hh-symbol-decks": Object.freeze({ id: "hh-symbol-decks", version: "2.1.0", language: "vi", nature: "symbolic", sourceIds: ["wikimedia-game-of-hope-1799", "unicode-runic", "hh-original"] }),
    "none-calculation-only": Object.freeze({ id: "none-calculation-only", version: "1.0.0", language: "vi", nature: "calculation", sourceIds: [] })
  });
  const METHOD_REGISTRY = Object.freeze([
    { id: "tarot-rws-78", version: "2.0.0", engine: "HH deterministic deck engine", engineVersion: VERSION, pack: "hh-rws-reflection", referenceFrame: "not-applicable", timeScale: "not-applicable", randomMethod: "Web Crypto seed + Mulberry32 replay", sources: [SOURCE_REFERENCES.rws, SOURCE_REFERENCES.rwsImages, SOURCE_REFERENCES.hh], limitations: ["Diễn giải biểu tượng không dự báo tương lai.", "Ý nghĩa lá đảo là tùy chọn trường phái."] },
    { id: "tarot-academy", version: "2.0.0", engine: "HH active-recall engine", engineVersion: VERSION, pack: "hh-rws-reflection", referenceFrame: "not-applicable", timeScale: "not-applicable", randomMethod: "Seeded review selection", sources: [SOURCE_REFERENCES.rws, SOURCE_REFERENCES.hh], limitations: ["Điểm học phản ánh tiến độ trong ứng dụng, không phải năng lực tâm lý."] },
    { id: "zodiac-solar-longitude", version: "2.0.0", engine: ASTRONOMY_VERSION, engineVersion: "2.1.19", pack: "hh-astrology-reflection", referenceFrame: "geocentric ecliptic of date", timeScale: "UTC", randomMethod: "none", sources: [SOURCE_REFERENCES.astronomy, SOURCE_REFERENCES.jpl, SOURCE_REFERENCES.iana], limitations: ["Cung là lớp chiêm tinh biểu tượng; chòm sao thiên văn là khái niệm khác."] },
    { id: "numerology-transparent", version: "2.0.0", engine: "HH local formula engine", engineVersion: VERSION, pack: "hh-numerology-transparent", referenceFrame: "not-applicable", timeScale: "civil date", randomMethod: "none", sources: [SOURCE_REFERENCES.hh], limitations: ["Không đo trí tuệ, sức khỏe, đạo đức hoặc xác suất thành công."] },
    { id: "iching-king-wen-64", version: "2.0.0", engine: "HH Zhouyi structure engine", engineVersion: VERSION, pack: "hh-iching-reflection", referenceFrame: "bottom-up six lines", timeScale: "not-applicable", randomMethod: "Web Crypto seed + Mulberry32 replay", sources: [SOURCE_REFERENCES.iching, SOURCE_REFERENCES.hh], limitations: ["Không có một quy tắc diễn giải duy nhất cho nhiều hào động."] },
    { id: "moon-sky", version: "2.1.0", engine: ASTRONOMY_VERSION, engineVersion: "2.1.19", pack: "none-calculation-only", referenceFrame: "topocentric/geocentric apparent", timeScale: "UTC + IANA local", randomMethod: "none", sources: [SOURCE_REFERENCES.astronomy, SOURCE_REFERENCES.usno, SOURCE_REFERENCES.nasaMoon, SOURCE_REFERENCES.nasaMoonKit, SOURCE_REFERENCES.iana], limitations: ["Đường chân trời và khúc xạ thực tế có thể làm đổi thời gian quan sát.", "Texture CGI phục vụ trực quan; Astronomy Engine mới là nguồn số liệu.", "Không dùng cho điều hướng."] },
    { id: "astrology-v5", version: "5.0.0", engine: ASTRONOMY_VERSION, engineVersion: "2.1.19", pack: "hh-astrology-reflection", referenceFrame: "geocentric ecliptic of date", timeScale: "UTC + IANA local", randomMethod: "none", sources: [SOURCE_REFERENCES.astronomy, SOURCE_REFERENCES.jpl, SOURCE_REFERENCES.iana, SOURCE_REFERENCES.hh], limitations: ["Độ chính xác thiên văn không chứng minh diễn giải chiêm tinh.", "Không biết giờ sinh thì không tính ASC, MC hoặc nhà."] },
    { id: "eastern-calendar-foundation", version: "2.0.0", engine: `${ASTRONOMY_VERSION} + Intl Chinese Calendar`, engineVersion: "2.1.19", pack: "none-calculation-only", referenceFrame: "apparent solar longitude", timeScale: "UTC + IANA local", randomMethod: "none", sources: [SOURCE_REFERENCES.astronomy, SOURCE_REFERENCES.hko, SOURCE_REFERENCES.iana], limitations: ["HKO dùng UTC+8; mọi mốc hiển thị phải đổi bằng timezone hồ sơ.", "Bát Tự và Tử Vi chưa được suy ra từ lớp lịch nền."] },
    { id: "ziwei-iztro-12-palaces", version: "1.0.0", engine: "iztro", engineVersion: "2.6.0", pack: "none-calculation-only", referenceFrame: "12 palaces · Vietnamese locale", timeScale: "local civil birth time", randomMethod: "none", sources: [SOURCE_REFERENCES.iztro, SOURCE_REFERENCES.hh], limitations: ["Tử Vi là hệ biểu tượng có nhiều trường phái.", "Không dùng cung Tật Ách hoặc tên sao để chẩn đoán sức khỏe.", "Giờ sinh sai có thể đổi cung Mệnh/Thân và vị trí sao."] },
    { id: "lenormand-classic-36", version: "2.1.0", engine: "HH deterministic deck engine", engineVersion: VERSION, pack: "hh-symbol-decks", referenceFrame: "Game of Hope 36-card order", timeScale: "not-applicable", randomMethod: "Web Crypto seed + Mulberry32 replay", sources: [SOURCE_REFERENCES.lenormand, SOURCE_REFERENCES.hh], limitations: ["Ảnh lịch sử được dùng theo Public Domain Mark của trang file Wikimedia; hồ sơ quyền và checksum đi kèm asset.", "Kết hợp lá là quy tắc trường phái, không phải dữ kiện khách quan."] },
    { id: "elder-futhark-24", version: "2.0.0", engine: "HH deterministic deck engine", engineVersion: VERSION, pack: "hh-symbol-decks", referenceFrame: "Unicode Elder Futhark order", timeScale: "not-applicable", randomMethod: "Web Crypto seed + Mulberry32 replay", sources: [SOURCE_REFERENCES.runes, SOURCE_REFERENCES.hh], limitations: ["Rune đảo không được coi là quy tắc lịch sử bắt buộc.", "Ý nghĩa biểu tượng tách khỏi dữ liệu ngôn ngữ học."] },
    { id: "oracle-hh-24", version: "2.0.0", engine: "HH deterministic deck engine", engineVersion: VERSION, pack: "hh-symbol-decks", referenceFrame: "HH original order", timeScale: "not-applicable", randomMethod: "Web Crypto seed + Mulberry32 replay", sources: [SOURCE_REFERENCES.hh], limitations: ["Bộ Oracle và toàn bộ diễn giải là nội dung HH nguyên bản."] }
  ].map((entry) => Object.freeze(entry)));

  function accuracyLab() { return globalScope.HHFortuneAccuracyLab || (typeof require === "function" ? require("./fortune-accuracy-lab") : null); }

  function methodDefinition(methodId) { return METHOD_REGISTRY.find((entry) => entry.id === methodId) || null; }
  function createSecureSeed(prefix = "fortune") {
    const label = String(prefix || "fortune").replace(/[^a-z0-9-]/gi, "").slice(0, 24) || "fortune";
    try {
      if (globalScope.crypto?.getRandomValues) {
        const values = new Uint32Array(4); globalScope.crypto.getRandomValues(values);
        return { seed: `${label}-${[...values].map((value) => value.toString(16).padStart(8, "0")).join("")}`, randomMethod: "webcrypto-seed+mulberry32-replay", secureSeed: true };
      }
    } catch (_error) { /* Trình duyệt có thể chặn crypto trong ngữ cảnh không an toàn. */ }
    return { seed: `${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`, randomMethod: "fallback-math-random+mulberry32-replay", secureSeed: false };
  }
  function deterministicSeed(seedValue, prefix) {
    const supplied = String(seedValue || "").trim().slice(0, 180);
    if (supplied) return { seed: supplied, randomMethod: "user-seed+mulberry32-replay", secureSeed: null };
    return createSecureSeed(prefix);
  }
  function digest(value) { return accuracyLab()?.sha256?.(value) || ""; }
  function normalizeFact(fact, index) {
    const factId = String(fact?.factId || `fact-${index + 1}`).toLowerCase().replace(/[^a-z0-9._-]/g, "-").slice(0, 100);
    return Object.freeze({ factId, type: String(fact?.type || "calculation").slice(0, 40), label: String(fact?.label || factId).slice(0, 120), value: fact?.value ?? null, unit: String(fact?.unit || "").slice(0, 32), sourceId: String(fact?.sourceId || "").slice(0, 80) });
  }
  function normalizeInterpretation(item, index, packId) {
    return Object.freeze({ interpretationId: String(item?.interpretationId || `interpretation-${index + 1}`).slice(0, 100), label: String(item?.label || "Diễn giải").slice(0, 120), text: String(item?.text || "").slice(0, 4000), packId: String(item?.packId || packId || "").slice(0, 80), nature: "symbolic" });
  }
  function createResultContract(options = {}) {
    const method = methodDefinition(options.methodId); if (!method) throw new Error(`Method Registry không có ${String(options.methodId || "methodId")}.`);
    const pack = INTERPRETATION_PACKS[options.interpretationPack || method.pack] || INTERPRETATION_PACKS[method.pack] || INTERPRETATION_PACKS["none-calculation-only"];
    const normalizedProfile = normalizeProfile(options.profile || {}); const input = options.input && typeof options.input === "object" ? options.input : {};
    const calculatedFacts = (Array.isArray(options.calculatedFacts) ? options.calculatedFacts : []).slice(0, 240).map(normalizeFact);
    const symbolicInterpretations = (Array.isArray(options.symbolicInterpretations) ? options.symbolicInterpretations : []).slice(0, 160).map((item, index) => normalizeInterpretation(item, index, pack.id));
    const sourceReferences = (Array.isArray(options.sourceReferences) && options.sourceReferences.length ? options.sourceReferences : method.sources).map((source) => ({ id: String(source.id || "source"), title: String(source.title || source.id || "Nguồn"), url: String(source.url || ""), role: String(source.role || "") }));
    const createdAt = safeIso(options.createdAt || new Date()); const inputDigest = digest(input); const resultDigest = digest(options.resultData || {}); const seed = String(options.seed || "").slice(0, 180);
    const hasProfile = Boolean(options.profile && typeof options.profile === "object" && Object.keys(options.profile).length);
    const quality = hasProfile ? accuracyLab()?.assessInputQuality?.(options.profile, { crossChecked: options.crossChecked === true, aiGenerated: Boolean(options.aiGeneratedSections?.length) }) : null;
    const payload = {
      schema: "hh.fortune.result-contract.v2", resultId: `fortune-${method.id}-${digest(`${method.id}|${inputDigest}|${seed}|${createdAt}`).slice(0, 18)}`,
      methodId: method.id, methodVersion: method.version, calculationEngine: options.calculationEngine || method.engine, engineVersion: options.engineVersion || method.engineVersion,
      interpretationPack: pack.id, packVersion: pack.version, inputDigest, resultDigest,
      timezoneId: options.timezoneId || normalizedProfile.timezoneId || "", tzdbVersion: "2026c", calendarSystem: options.calendarSystem || normalizedProfile.calendarSystem || "gregorian",
      referenceFrame: options.referenceFrame || method.referenceFrame, timeScale: options.timeScale || method.timeScale, seed, randomMethod: options.randomMethod || method.randomMethod,
      calculatedFacts, symbolicInterpretations, aiGeneratedSections: (Array.isArray(options.aiGeneratedSections) ? options.aiGeneratedSections : []).slice(0, 40),
      limitations: [...new Set([...(method.limitations || []), ...(Array.isArray(options.limitations) ? options.limitations : [])].map(String))].slice(0, 40), sourceReferences,
      qualityStatus: quality?.statuses || options.qualityStatus || { input: { id: "not-required", label: "Không yêu cầu" }, timezone: { id: "not-required", label: "Không yêu cầu" }, calculation: { id: options.crossChecked ? "crossChecked" : "pending", label: options.crossChecked ? "Đã đối chiếu" : "Chưa đối chiếu ngoài" }, interpretation: { id: symbolicInterpretations.length ? "symbolic" : "calculation", label: symbolicInterpretations.length ? "Biểu tượng" : "Tính toán" } },
      truthLayers: { calculation: calculatedFacts.length > 0, symbolic: symbolicInterpretations.length > 0, ai: Boolean(options.aiGeneratedSections?.length) }, createdAt
    };
    return Object.freeze({ ...payload, sha256: digest(payload) });
  }
  function verifyResultContract(contract) {
    if (!contract || contract.schema !== "hh.fortune.result-contract.v2") return { ok: false, errors: ["Sai schema Fortune Result Contract."] };
    const { sha256, ...payload } = contract; const expected = digest(payload); const method = methodDefinition(contract.methodId); const errors = [];
    if (!method) errors.push("Method Registry không còn methodId này.");
    if (expected !== sha256) errors.push("SHA-256 của Result Contract không khớp.");
    if (!/^[a-f0-9]{64}$/.test(String(contract.inputDigest || ""))) errors.push("Input digest không hợp lệ.");
    if (!/^[a-f0-9]{64}$/.test(String(contract.resultDigest || ""))) errors.push("Result digest không hợp lệ.");
    return { ok: errors.length === 0, methodMatch: Boolean(method), digestMatch: expected === sha256, errors, checkedAt: new Date().toISOString() };
  }
  function attachResultContract(result, options = {}) {
    if (!result || result.ok === false) return result;
    const resultData = { ...result }; delete resultData.resultContract;
    return { ...result, resultContract: createResultContract({ ...options, resultData }) };
  }

  function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  }
  function normalizeAngle(value) { return ((Number(value) % 360) + 360) % 360; }
  function hashSeed(value) {
    let hash = 2166136261;
    for (const character of String(value || "")) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }
  function createRandom(seed) {
    let state = hashSeed(seed) || 0x6d2b79f5;
    return () => { state += 0x6d2b79f5; let result = state; result = Math.imul(result ^ (result >>> 15), result | 1); result ^= result + Math.imul(result ^ (result >>> 7), result | 61); return ((result ^ (result >>> 14)) >>> 0) / 4294967296; };
  }
  function safeIso(value, fallback = new Date()) {
    const date = value instanceof Date ? value : new Date(value || fallback);
    return Number.isFinite(date.getTime()) ? date.toISOString() : fallback.toISOString();
  }
  function validDateValue(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return false;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
  }
  function timeZoneSupported(timeZone) {
    try { new Intl.DateTimeFormat("en", { timeZone: String(timeZone || "") }).format(); return true; } catch (_error) { return false; }
  }
  function zoneOffsetMinutes(timeZone, instantValue = new Date()) {
    if (!timeZoneSupported(timeZone)) return null;
    const instant = instantValue instanceof Date ? instantValue : new Date(instantValue);
    if (!Number.isFinite(instant.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).formatToParts(instant).reduce((map, part) => ({ ...map, [part.type]: part.value }), {});
    const localAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
    return Math.round((localAsUtc - instant.getTime()) / 60000);
  }
  function localInputToInstant(dateValue, timeValue, timeZone, calendarSystem = "gregorian", dstResolution = "") {
    const analyzed = accuracyLab()?.analyzeLocalTime?.(dateValue, timeValue, timeZone, dstResolution, calendarSystem);
    if (analyzed) return analyzed.ok ? new Date(analyzed.selected.instantUtc) : null;
    if (!validDateValue(dateValue) || !/^\d{2}:\d{2}$/.test(String(timeValue || "")) || !timeZoneSupported(timeZone)) return null;
    const [year, month, day] = String(dateValue).split("-").map(Number);
    const [hour, minute] = String(timeValue).split(":").map(Number);
    if (hour > 23 || minute > 59) return null;
    let guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
    for (let iteration = 0; iteration < 3; iteration += 1) {
      const offset = zoneOffsetMinutes(timeZone, guess);
      if (offset === null) return null;
      guess = new Date(Date.UTC(year, month - 1, day, hour, minute) - offset * 60000);
    }
    return guess;
  }
  function normalizeProfile(raw = {}) {
    const timezoneId = timeZoneSupported(raw.timezoneId) ? String(raw.timezoneId) : "Asia/Ho_Chi_Minh";
    const calendarSystem = ["gregorian", "julian"].includes(raw.calendarSystem) ? raw.calendarSystem : "gregorian"; const normalizedDate = accuracyLab()?.calendarDateToGregorian?.(raw.date, calendarSystem); const instant = localInputToInstant(raw.date, raw.time, timezoneId, calendarSystem, raw.dstResolution);
    return {
      date: normalizedDate ? String(raw.date) : "",
      time: /^\d{2}:\d{2}$/.test(String(raw.time || "")) ? String(raw.time) : "",
      place: String(raw.place || "").trim().slice(0, 120),
      latitude: clamp(raw.latitude, -90, 90, 0),
      longitude: clamp(raw.longitude, -180, 180, 0),
      elevation: clamp(raw.elevation, -500, 9000, 0),
      birthTimeAccuracy: ["exact", "estimated", "unknown"].includes(raw.birthTimeAccuracy) ? raw.birthTimeAccuracy : (raw.time ? "estimated" : "unknown"),
      birthTimeSource: ["birth-certificate", "family-memory", "self-estimated", "unknown"].includes(raw.birthTimeSource) ? raw.birthTimeSource : "unknown",
      birthTimeUncertaintyMinutes: [1, 15, 60, 720].includes(Number(raw.birthTimeUncertaintyMinutes)) ? Number(raw.birthTimeUncertaintyMinutes) : (raw.birthTimeAccuracy === "exact" ? 1 : raw.birthTimeAccuracy === "unknown" ? 720 : 15),
      locationConfidence: ["verified", "selected", "approximate"].includes(raw.locationConfidence) ? raw.locationConfidence : "selected",
      calendarSystem,
      dstResolution: ["earlier", "later"].includes(raw.dstResolution) ? raw.dstResolution : "",
      timezoneId,
      timezoneOffsetMinutes: instant ? zoneOffsetMinutes(timezoneId, instant) : null,
      zodiacMode: ZODIAC_MODES.includes(raw.zodiacMode) ? raw.zodiacMode : "tropical",
      houseSystem: HOUSE_SYSTEMS.includes(raw.houseSystem) ? raw.houseSystem : "equal",
      aspectOrbs: Object.fromEntries(Object.entries(DEFAULT_ORBS).map(([key, fallback]) => [key, clamp(raw.aspectOrbs?.[key], 0, 15, fallback)]))
    };
  }
  function createProvenance({ kind = "reflection", profile = {}, engine = "HH local engine", algorithmVersion = "1", contentVersion = CONTENT_VERSION, seed = "", method = "", input = {}, labels = ["symbolic"], computedAt = new Date() } = {}) {
    const normalized = normalizeProfile(profile);
    return Object.freeze({
      schema: "hh.fortune.provenance.v1",
      recordId: `prov-${hashSeed(`${kind}|${seed}|${safeIso(computedAt)}`).toString(16)}`,
      kind: String(kind).slice(0, 80),
      computedAt: safeIso(computedAt),
      engine: String(engine).slice(0, 160),
      algorithmVersion: String(algorithmVersion).slice(0, 80),
      contentVersion: String(contentVersion).slice(0, 80),
      method: String(method).slice(0, 160),
      seed: String(seed || "").slice(0, 180),
      labels: [...new Set(labels.filter((label) => LABELS[label]).map((label) => LABELS[label]))],
      input: {
        date: normalized.date, time: normalized.time, place: normalized.place, latitude: normalized.latitude, longitude: normalized.longitude,
        elevation: normalized.elevation, timezoneId: normalized.timezoneId, timezoneOffsetMinutes: normalized.timezoneOffsetMinutes,
        birthTimeAccuracy: normalized.birthTimeAccuracy, birthTimeSource: normalized.birthTimeSource, birthTimeUncertaintyMinutes: normalized.birthTimeUncertaintyMinutes,
        locationConfidence: normalized.locationConfidence, calendarSystem: normalized.calendarSystem, dstResolution: normalized.dstResolution,
        zodiacMode: normalized.zodiacMode, houseSystem: normalized.houseSystem, aspectOrbs: normalized.aspectOrbs, ...input
      },
      timezoneData: { targetVersion: "2026c", runtimeVersion: "unknown-runtime-icu", note: "IANA tzdb do môi trường chạy cung cấp; offset được chụp tại thời điểm tính." },
      reproducible: Boolean(seed || (normalized.date && normalized.time && normalized.timezoneId))
    });
  }

  const SOLAR_ZODIAC_SIGNS = Object.freeze([
    ["Bạch Dương", "♈", "Lửa", "Tiên phong"], ["Kim Ngưu", "♉", "Đất", "Kiên định"], ["Song Tử", "♊", "Khí", "Linh hoạt"], ["Cự Giải", "♋", "Nước", "Tiên phong"],
    ["Sư Tử", "♌", "Lửa", "Kiên định"], ["Xử Nữ", "♍", "Đất", "Linh hoạt"], ["Thiên Bình", "♎", "Khí", "Tiên phong"], ["Bọ Cạp", "♏", "Nước", "Kiên định"],
    ["Nhân Mã", "♐", "Lửa", "Linh hoạt"], ["Ma Kết", "♑", "Đất", "Tiên phong"], ["Bảo Bình", "♒", "Khí", "Kiên định"], ["Song Ngư", "♓", "Nước", "Linh hoạt"]
  ]);
  function solarLongitude(astronomy, instant) { const vector = astronomy.GeoVector(astronomy.Body.Sun, instant, true); return normalizeAngle(astronomy.Ecliptic(vector).elon); }
  function solarSignFor(longitude) { const value = normalizeAngle(longitude); const index = Math.floor(value / 30); const [name, symbol, element, modality] = SOLAR_ZODIAC_SIGNS[index]; return { index, name, symbol, element, modality, degree: Number((value % 30).toFixed(4)), longitude: Number(value.toFixed(6)) }; }
  function calculateSolarZodiac(dateValue, profileValue = {}, astronomy = globalScope.Astronomy) {
    if (!validDateValue(dateValue)) return { ok: false, errors: ["Ngày không hợp lệ."] };
    if (!astronomy?.GeoVector || !astronomy?.Ecliptic || !astronomy?.Body?.Sun) return { ok: false, errors: ["Astronomy Engine chưa được tải."] };
    const profile = normalizeProfile({ ...profileValue, date: dateValue }); const knownTime = profile.birthTimeAccuracy !== "unknown" && Boolean(profile.time);
    const center = localInputToInstant(dateValue, knownTime ? profile.time : "12:00", profile.timezoneId, profile.calendarSystem, profile.dstResolution);
    const start = localInputToInstant(dateValue, "00:00", profile.timezoneId, profile.calendarSystem, profile.dstResolution); const end = localInputToInstant(dateValue, "23:59", profile.timezoneId, profile.calendarSystem, profile.dstResolution);
    if (!center || !start || !end) return { ok: false, errors: ["Không thể chuyển ngày sang UTC theo timezone IANA."] };
    try {
      const longitude = solarLongitude(astronomy, center); const fromLongitude = solarLongitude(astronomy, start); const toLongitude = solarLongitude(astronomy, end); const sign = solarSignFor(longitude); const fromSign = solarSignFor(fromLongitude); const toSign = solarSignFor(toLongitude); const distanceToBoundary = Number(Math.min(sign.degree, 30 - sign.degree).toFixed(4)); const nearBoundary = fromSign.index !== toSign.index || distanceToBoundary < 1;
      const base = { ok: true, date: dateValue, instantUtc: center.toISOString(), knownTime, sign, dailyRange: { from: solarSignFor(fromLongitude), to: solarSignFor(toLongitude) }, nearBoundary, distanceToBoundaryDegrees: distanceToBoundary, distinction: "Cung tropical là 12 đoạn 30° từ điểm xuân phân; không đồng nhất với chòm sao thiên văn.", provenance: createProvenance({ kind: "solar-zodiac", profile, engine: ASTRONOMY_VERSION, algorithmVersion: "solar-zodiac-v2", method: "Geocentric solar ecliptic longitude", labels: ["calculation", "symbolic"], input: { date: dateValue, knownTime } }) };
      return attachResultContract(base, { methodId: "zodiac-solar-longitude", profile, crossChecked: false, input: { date: dateValue, time: knownTime ? profile.time : null, timezoneId: profile.timezoneId }, calculatedFacts: [{ factId: "zodiac.sun-longitude", type: "astronomy", label: "Kinh độ Mặt Trời", value: sign.longitude, unit: "degree", sourceId: "astronomy-engine" }, { factId: "zodiac.sign-sector", type: "derived", label: "Đoạn tropical", value: sign.name, sourceId: "astronomy-engine" }], symbolicInterpretations: [{ interpretationId: "zodiac.sector", label: sign.name, text: `Đây là nhãn của đoạn tropical ${sign.index * 30}°–${(sign.index + 1) * 30}°, không phải phép đo tính cách.` }], limitations: [nearBoundary && !knownTime ? "Ngày nằm gần ranh giới; cần giờ sinh để chọn đoạn tropical chắc chắn hơn." : "Kết quả đoạn tropical được tính tại thời điểm UTC hiển thị."] });
    } catch (error) { return { ok: false, errors: [`Không thể tính kinh độ Mặt Trời: ${String(error?.message || error).slice(0, 180)}`] }; }
  }

  const MAJOR_NAMES = Object.freeze([
    ["fool", "0", "Kẻ Khờ", "The Fool"], ["magician", "I", "Nhà Ảo Thuật", "The Magician"], ["high-priestess", "II", "Nữ Tư Tế", "The High Priestess"], ["empress", "III", "Nữ Hoàng", "The Empress"],
    ["emperor", "IV", "Hoàng Đế", "The Emperor"], ["hierophant", "V", "Giáo Hoàng", "The Hierophant"], ["lovers", "VI", "Những Người Yêu", "The Lovers"], ["chariot", "VII", "Cỗ Xe", "The Chariot"],
    ["strength", "VIII", "Sức Mạnh", "Strength"], ["hermit", "IX", "Ẩn Sĩ", "The Hermit"], ["wheel-of-fortune", "X", "Bánh Xe Số Phận", "Wheel of Fortune"], ["justice", "XI", "Công Lý", "Justice"],
    ["hanged-man", "XII", "Người Treo Ngược", "The Hanged Man"], ["death", "XIII", "Cái Chết", "Death"], ["temperance", "XIV", "Tiết Chế", "Temperance"], ["devil", "XV", "Ác Quỷ", "The Devil"],
    ["tower", "XVI", "Tòa Tháp", "The Tower"], ["star", "XVII", "Ngôi Sao", "The Star"], ["moon", "XVIII", "Mặt Trăng", "The Moon"], ["sun", "XIX", "Mặt Trời", "The Sun"],
    ["judgement", "XX", "Phán Xét", "Judgement"], ["world", "XXI", "Thế Giới", "The World"]
  ]);
  const SUITS = Object.freeze([
    { id: "wands", name: "Gậy", english: "Wands", symbol: "♣", element: "Lửa", focus: "động lực, sáng tạo và hành động", color: "#ff9b71" },
    { id: "cups", name: "Cốc", english: "Cups", symbol: "♥", element: "Nước", focus: "cảm xúc, kết nối và tiếp nhận", color: "#6fd8ff" },
    { id: "swords", name: "Kiếm", english: "Swords", symbol: "♠", element: "Khí", focus: "tư duy, giao tiếp và quyết định", color: "#a9b7ff" },
    { id: "pentacles", name: "Tiền", english: "Pentacles", symbol: "♦", element: "Đất", focus: "nguồn lực, cơ thể và giá trị thực tế", color: "#80e1a5" }
  ]);
  const RANKS = Object.freeze([
    ["ace", "Át", "Ace", "một hạt giống mới"], ["two", "Hai", "Two", "sự cân nhắc giữa hai hướng"], ["three", "Ba", "Three", "việc phối hợp để mở rộng"], ["four", "Bốn", "Four", "một cấu trúc cần ổn định"],
    ["five", "Năm", "Five", "ma sát tạo cơ hội điều chỉnh"], ["six", "Sáu", "Six", "nhịp chuyển sang trạng thái hài hòa hơn"], ["seven", "Bảy", "Seven", "bài kiểm tra về lựa chọn và bền bỉ"], ["eight", "Tám", "Eight", "chuyển động có nhịp và kỹ năng"],
    ["nine", "Chín", "Nine", "giai đoạn gần hoàn tất cần giữ sức"], ["ten", "Mười", "Ten", "một chu kỳ đạt ngưỡng và cần phân bổ lại"], ["page", "Tiểu Đồng", "Page", "tò mò và tiếp nhận thông tin mới"],
    ["knight", "Hiệp Sĩ", "Knight", "đưa năng lượng vào hành động"], ["queen", "Nữ Hoàng", "Queen", "chăm sóc chiều sâu và tiêu chuẩn"], ["king", "Vua", "King", "chịu trách nhiệm định hướng nguồn lực"]
  ]);
  const MAJOR_SYMBOL_ATLAS = Object.freeze({
    fool: ["vách núi · ngưỡng bắt đầu", "chó trắng · bản năng/cảnh báo", "hoa hồng trắng · chủ ý trong sáng", "hành trang · kinh nghiệm mang theo"],
    magician: ["bàn bốn chất · nguồn lực", "vô cực · khả năng liên tục", "một tay lên/một tay xuống · nối ý tưởng với hành động"],
    "high-priestess": ["hai cột B/J · đối cực", "màn lựu · ranh giới tri thức", "trăng lưỡi liềm · chu kỳ tiếp nhận"],
    empress: ["lúa mì · nuôi dưỡng", "vương miện sao · nhịp tự nhiên", "Venus · giá trị và kết nối"], emperor: ["ngai đá · cấu trúc", "đầu cừu · sức đẩy", "núi trọc · giới hạn rõ"],
    hierophant: ["hai chìa khóa · tri thức truyền lại", "hai môn đồ · cộng đồng học", "cử chỉ ban phước · chuẩn mực"], lovers: ["hai nhân vật · lựa chọn có ý thức", "thiên thần · giá trị cao hơn", "núi · thử thách chung"],
    chariot: ["hai sphinx · lực đối nghịch", "mái sao · định hướng", "thành phố sau lưng · rời vùng quen"], strength: ["sư tử · xung lực", "vô cực · sức bền", "vòng hoa · điều hòa"],
    hermit: ["đèn lục giác · sự thật từng phần", "gậy · điểm tựa", "đỉnh núi · khoảng cách quan sát"], "wheel-of-fortune": ["bánh xe · chu kỳ", "bốn sinh vật · nhiều góc nhìn", "sphinx · điểm cân bằng"],
    justice: ["cân · hệ quả", "kiếm · quyết định", "màn tím · nguyên tắc"], "hanged-man": ["tư thế đảo · đổi góc nhìn", "hào quang · nhận thức", "cây sống · tạm dừng có chủ đích"],
    death: ["kỵ sĩ · thay đổi không dừng", "mặt trời mọc · chu kỳ tiếp", "hoa hồng trắng · chuyển hóa"], temperance: ["hai cốc · điều phối", "một chân nước/một chân đất · tích hợp", "đường tới ánh sáng · tiến trình"],
    devil: ["xiềng lỏng · ràng buộc có thể nhìn lại", "đuốc ngược · năng lượng lệch", "bệ tối · thói quen cố định"], tower: ["sét · thông tin phá vỡ", "vương miện rơi · cấu trúc mất hiệu lực", "lửa · tái cấu trúc"],
    star: ["ngôi sao lớn · phương hướng", "hai bình nước · phục hồi", "chim trên cây · góc nhìn xa"], moon: ["hai tháp · cổng bất định", "chó và sói · hai phản ứng bản năng", "tôm bò lên · nội dung nổi dần"],
    sun: ["đứa trẻ · sự trực tiếp", "hoa hướng dương · sinh lực", "ngựa trắng · chuyển động rõ"], judgement: ["kèn · lời gọi đánh giá lại", "nhân vật đứng dậy · đáp ứng", "núi · điều không thể né"],
    world: ["vòng nguyệt quế · hoàn tất", "bốn sinh vật · tổng hợp", "hai gậy · quyền chủ động"]
  });
  const MAJOR_CARDS = MAJOR_NAMES.map(([id, symbol, vietnameseName, englishName], index) => Object.freeze({
    id: `major-${id}`, arcana: "major", group: "Major Arcana", number: index, suit: "Major Arcana", element: "Tùy trường phái", symbol, name: `${englishName} · ${vietnameseName}`, englishName, vietnameseName, image: `assets/fortune/tarot/rws/major-${id}.webp`, symbols: MAJOR_SYMBOL_ATLAS[id] || [],
    light: `Mặt sáng của ${vietnameseName.toLocaleLowerCase("vi")} khuyến khích quan sát điều đang mở ra và chọn một bước có chủ đích.`,
    shadow: `Mặt khuất nhắc rằng biểu tượng ${vietnameseName.toLocaleLowerCase("vi")} không thay thế dữ kiện, ranh giới hay trách nhiệm cá nhân.`,
    balanced: `Giữ cả cơ hội lẫn giới hạn của ${vietnameseName.toLocaleLowerCase("vi")} trong cùng một góc nhìn.`,
    question: `Điều gì từ hình tượng ${vietnameseName} thật sự liên hệ với trải nghiệm hiện tại của bạn?`, color: `hsl(${(index * 31 + 180) % 360} 78% 68%)`, interpretationPack: "hh-rws-reflection", sourceIds: ["rws-waite-1911", "rws-wikimedia", "hh-original"], contentVersion: CONTENT_VERSION
  }));
  const MINOR_CARDS = SUITS.flatMap((suit) => RANKS.map(([rankId, rankName, englishRank, stage], rankIndex) => Object.freeze({
    id: `${suit.id}-${rankId}`, arcana: "minor", group: rankIndex < 10 ? "Pip Cards" : "Court Cards", rank: rankId, number: rankIndex + 1, suit: suit.name, element: suit.element, symbol: suit.symbol, symbols: [`${suit.english} · nguyên tố ${suit.element}`, `${englishRank} · ${stage}`], name: `${englishRank} of ${suit.english} · ${rankName} ${suit.name}`, englishName: `${englishRank} of ${suit.english}`, vietnameseName: `${rankName} ${suit.name}`, image: `assets/fortune/tarot/rws/${suit.id}-${rankId}.webp`,
    light: `${stage}; vận dụng ${suit.focus} bằng một hành động vừa sức và có kiểm chứng.`,
    shadow: `${stage} có thể bị lệch khi ${suit.focus} trở thành phản ứng tự động hoặc quá tải.`,
    balanced: `Quan sát ${suit.focus}, sau đó chọn nhịp tiến phù hợp với nguồn lực thực tế.`,
    question: `Trong ${suit.focus}, điều gì đang cần được nhìn rõ thay vì phán đoán nhanh?`, color: suit.color, interpretationPack: "hh-rws-reflection", sourceIds: ["rws-waite-1911", "rws-wikimedia", "hh-original"], contentVersion: CONTENT_VERSION
  })));
  const TAROT_78 = Object.freeze([...MAJOR_CARDS, ...MINOR_CARDS]);
  const SPREADS = Object.freeze({
    1: ["Trọng tâm"], 3: ["Bối cảnh", "Điều cần chú ý", "Bước thử"], 5: ["Nền", "Tác động", "Điểm mù", "Nguồn lực", "Hướng đi"],
    7: ["Gốc rễ", "Quá khứ gần", "Hiện tại", "Điểm chuyển", "Nguồn lực", "Thử thách", "Bước tiếp"],
    10: ["Hiện trạng", "Tác động chéo", "Nền sâu", "Quá khứ", "Điều hướng tới", "Tương lai gần", "Nội lực", "Môi trường", "Hy vọng/lo ngại", "Tổng hợp"],
    12: Array.from({ length: 12 }, (_, index) => `Lĩnh vực ${index + 1}`),
    15: Array.from({ length: 15 }, (_, index) => `Vị trí ${index + 1}`)
  });
  function shuffleWithRandom(values, random) { const output = [...values]; for (let index = output.length - 1; index > 0; index -= 1) { const target = Math.floor(random() * (index + 1)); [output[index], output[target]] = [output[target], output[index]]; } return output; }
  function drawTarot78(seedValue, options = {}) {
    const seedInfo = deterministicSeed(seedValue, "tarot"); const { seed, randomMethod } = seedInfo;
    const count = [1, 3, 5, 7, 10, 12, 15].includes(Number(options.count)) ? Number(options.count) : 3;
    const random = createRandom(seed); const deck = shuffleWithRandom(TAROT_78, random);
    const positions = Array.isArray(options.positions) && options.positions.length >= count ? options.positions : SPREADS[count];
    const cards = deck.slice(0, count).map((card, index) => ({ ...card, reversed: options.allowReversed !== false && random() < 0.36, position: String(positions[index] || `Vị trí ${index + 1}`).slice(0, 80), note: "", pinned: false }));
    const base = { seed, seedProof: digest({ seed, count, positions: positions.slice(0, count), allowReversed: options.allowReversed !== false }), randomMethod, secureSeed: seedInfo.secureSeed, count, allowReversed: options.allowReversed !== false, selfInterpretation: Boolean(options.selfInterpretation), positions: positions.slice(0, count), cards, provenance: createProvenance({ kind: "tarot", seed, method: `Tarot HH 78 · ${count} lá · Fisher-Yates/Mulberry32`, algorithmVersion: "tarot-78-v2", labels: ["symbolic"], input: { count, allowReversed: options.allowReversed !== false, positions: positions.slice(0, count), randomMethod } }) };
    return attachResultContract(base, { methodId: "tarot-rws-78", seed, randomMethod, input: { count, allowReversed: base.allowReversed, positions: base.positions, seedProof: base.seedProof }, calculatedFacts: cards.map((card, index) => ({ factId: `tarot.card.${index + 1}`, type: "deterministic-selection", label: card.position, value: `${card.id}:${card.reversed ? "reversed" : "upright"}`, sourceId: "rws-wikimedia" })), symbolicInterpretations: cards.map((card, index) => ({ interpretationId: `tarot.interpretation.${index + 1}`, label: `${card.position} · ${card.name}`, text: card.reversed ? card.shadow : card.light })), limitations: [seedInfo.secureSeed === false ? "Môi trường không có Web Crypto; seed dùng nguồn fallback không mật mã." : "Seed ngẫu nhiên do Web Crypto tạo, sau đó dùng PRNG xác định để tái tạo."] });
  }
  function tarotStatistics(readings = []) {
    const cards = readings.flatMap((reading) => Array.isArray(reading?.cards) ? reading.cards : Array.isArray(reading) ? reading : []);
    const counts = new Map(); const suits = new Map(); let reversed = 0;
    cards.forEach((card) => { counts.set(card.id, (counts.get(card.id) || 0) + 1); suits.set(card.suit, (suits.get(card.suit) || 0) + 1); if (card.reversed) reversed += 1; });
    return { total: cards.length, reversedRate: cards.length ? Math.round(reversed / cards.length * 100) : 0, topCards: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, count]) => ({ card: TAROT_78.find((item) => item.id === id), count })), suits: Object.fromEntries(suits) };
  }
  function tarotQuiz(seed = "academy", options = {}) {
    const mode = ["meaning", "name", "element", "symbol", "number", "court"].includes(options.mode) ? options.mode : "meaning"; const random = createRandom(seed); const card = TAROT_78[Math.floor(random() * TAROT_78.length)];
    const pool = TAROT_78.filter((item) => item.id !== card.id); let correct; let question; let distractors;
    if (mode === "name") { correct = card.name; question = "Hình này là lá nào?"; distractors = shuffleWithRandom(pool, random).slice(0, 3).map((item) => item.name); }
    else if (mode === "element") { correct = card.element || "Tùy trường phái"; question = "Lá này thuộc nguyên tố hoặc nhóm nào?"; distractors = [...new Set(shuffleWithRandom(pool, random).map((item) => item.element || "Tùy trường phái").filter((item) => item !== correct))].slice(0, 3); while (distractors.length < 3) distractors.push(["Lửa", "Nước", "Khí", "Đất", "Tùy trường phái"].find((item) => item !== correct && !distractors.includes(item)) || `Nhóm ${distractors.length + 1}`); }
    else if (mode === "symbol") { correct = card.symbols?.[0] || card.light; question = "Chi tiết biểu tượng nào thuộc lá này?"; distractors = shuffleWithRandom(pool.filter((item) => item.symbols?.length), random).slice(0, 3).map((item) => item.symbols[0]); }
    else if (mode === "number") { correct = card.arcana === "major" ? `Major ${card.number}` : `Bậc ${card.number} · ${card.group}`; question = "Lá này nằm ở bậc số hoặc nhóm cấu trúc nào?"; distractors = [...new Set(shuffleWithRandom(pool, random).map((item) => item.arcana === "major" ? `Major ${item.number}` : `Bậc ${item.number} · ${item.group}`).filter((item) => item !== correct))].slice(0, 3); }
    else if (mode === "court") { correct = card.group === "Court Cards" ? `${card.vietnameseName} là Court Card` : `${card.vietnameseName} không phải Court Card`; question = "Nhận diện vai trò Court Card của lá này."; distractors = card.group === "Court Cards" ? ["Đây là Pip Card", "Đây là Major Arcana", "Không có phân nhóm"] : ["Đây là Court Card", "Đây luôn là lá Hoàng gia", "Không thể phân loại"]; }
    else { correct = card.light; question = "Điều nào mô tả lớp ánh sáng của lá này theo bộ nội dung HH?"; distractors = shuffleWithRandom(pool, random).slice(0, 3).map((item) => item.light); }
    const answers = shuffleWithRandom([correct, ...distractors], random);
    const base = { seed, mode, question, card, answers, correctIndex: answers.indexOf(correct), rubric: { correct: "Nhận diện đúng dữ liệu hoặc lớp nội dung đang học.", review: "Đối chiếu hình, cấu trúc và nguồn trước khi ghi nhớ." } };
    return attachResultContract(base, { methodId: "tarot-academy", seed, randomMethod: "seeded-review-selection", input: { mode, cardId: card.id }, calculatedFacts: [{ factId: "academy.card", type: "curriculum", label: "Lá đang học", value: card.id, sourceId: "rws-wikimedia" }], symbolicInterpretations: mode === "meaning" ? [{ interpretationId: "academy.meaning", label: card.name, text: card.light }] : [] });
  }
  function academyReviewSchedule(scoreValue, previous = {}) {
    const score = clamp(scoreValue, 0, 4, 0); const repetitions = Math.max(0, Number(previous.repetitions) || 0); const ease = clamp((Number(previous.ease) || 2.5) + (0.1 - (4 - score) * (0.08 + (4 - score) * 0.02)), 1.3, 3, 2.5);
    const intervalDays = score < 2 ? 1 : repetitions === 0 ? 1 : repetitions === 1 ? 3 : Math.max(4, Math.round((Number(previous.intervalDays) || 3) * ease));
    const reviewedAt = new Date(); const dueAt = new Date(reviewedAt.getTime() + intervalDays * 86400000);
    return { score, repetitions: score < 2 ? 0 : repetitions + 1, ease: Number(ease.toFixed(2)), intervalDays, reviewedAt: reviewedAt.toISOString(), dueAt: dueAt.toISOString() };
  }

  const TAROT_ACADEMY_TRACKS = Object.freeze([
    { id: "foundation", title: "Nền tảng 78 lá", level: "Nhập môn", lessons: [
      ["Cấu trúc bộ bài", "Phân biệt 22 Major Arcana, 40 Pip Cards và 16 Court Cards trước khi học ý nghĩa riêng lẻ.", ["Nhận diện ba nhóm", "Đọc số và chất", "Không học thuộc một từ khóa duy nhất"]],
      ["Câu hỏi mở", "Chuyển hình ảnh thành câu hỏi có thể kiểm chứng thay vì lời khẳng định chắc chắn.", ["Tách dữ kiện", "Nêu giả định", "Chọn hành động có thể đảo ngược"]],
      ["Thuận và góc khuất", "Cùng một lá có thể mô tả nguồn lực hoặc điểm mù; lá đảo là tùy chọn trường phái, không phải mặc định xấu.", ["Đọc hai chiều", "Tránh tốt/xấu tuyệt đối", "Kiểm tra bằng bối cảnh"]]
    ]},
    { id: "major", title: "Hành trình Major Arcana", level: "Cơ bản", lessons: [
      ["The Fool đến The Chariot", "Theo dõi tiến trình từ khởi đầu, tạo tác, tiếp nhận, nuôi dưỡng, cấu trúc, truyền thống, lựa chọn đến định hướng.", ["0–VII", "Hình tượng trung tâm", "Bài học phát triển"]],
      ["Strength đến Temperance", "Quan sát sức bền, chiêm nghiệm, chu kỳ, hệ quả, đổi góc nhìn, chuyển hóa và điều phối.", ["VIII–XIV", "Nội lực", "Tích hợp đối cực"]],
      ["The Devil đến The World", "Đọc ràng buộc, đổ vỡ, hồi phục, bất định, sáng rõ, đánh giá lại và hoàn tất như các tiến trình.", ["XV–XXI", "Khủng hoảng và phục hồi", "Khép chu kỳ"]]
    ]},
    { id: "suits", title: "Bốn chất & nguyên tố", level: "Cơ bản", lessons: [
      ["Wands · Lửa", "Động lực, sáng tạo và hành động. Luôn đối chiếu mức năng lượng thực tế.", ["Chủ động", "Cảm hứng", "Nguy cơ quá sức"]],
      ["Cups · Nước", "Cảm xúc, quan hệ và khả năng tiếp nhận. Không dùng lá bài để đoán ý nghĩ người khác.", ["Cảm nhận", "Kết nối", "Ranh giới"]],
      ["Swords · Khí", "Tư duy, ngôn ngữ và quyết định. Phân biệt suy nghĩ với dữ kiện.", ["Phân tích", "Giao tiếp", "Xung đột"]],
      ["Pentacles · Đất", "Nguồn lực, cơ thể, công việc và điều hữu hình. Ưu tiên bước cụ thể.", ["Ổn định", "Kỹ năng", "Giá trị thực tế"]]
    ]},
    { id: "numbers", title: "Số học Ace–Ten", level: "Trung cấp", lessons: [
      ["Ace–Three", "Ace mở hạt giống, Two đặt hai lực cạnh nhau, Three tạo sự phối hợp và mở rộng.", ["Khởi nguồn", "Đối cực", "Tăng trưởng"]],
      ["Four–Seven", "Four tạo cấu trúc, Five tạo ma sát, Six điều hòa, Seven kiểm tra lựa chọn và bền bỉ.", ["Ổn định", "Điều chỉnh", "Thử thách"]],
      ["Eight–Ten", "Eight tăng nhịp và kỹ năng, Nine gần hoàn tất, Ten đưa chu kỳ tới ngưỡng phân bổ lại.", ["Chuyển động", "Tích lũy", "Hoàn tất"]]
    ]},
    { id: "court", title: "Court Cards", level: "Trung cấp", lessons: [
      ["Page", "Tiếp nhận tín hiệu mới với tò mò; có thể là vai trò học hỏi hơn là một người cụ thể.", ["Tin mới", "Học việc", "Tò mò"]],
      ["Knight", "Đưa năng lượng của chất vào chuyển động; kiểm tra tốc độ, hướng và hệ quả.", ["Hành động", "Theo đuổi", "Điều tiết"]],
      ["Queen", "Giữ chiều sâu, tiêu chuẩn và khả năng nuôi dưỡng phẩm chất từ bên trong.", ["Nội lực", "Chăm sóc", "Ranh giới"]],
      ["King", "Chịu trách nhiệm định hướng nguồn lực và tác động ra bên ngoài.", ["Lãnh đạo", "Trách nhiệm", "Kết quả"]]
    ]},
    { id: "symbols", title: "Symbol Atlas", level: "Trung cấp", lessons: [
      ["Màu sắc và ánh sáng", "Quan sát độ tương phản, nguồn sáng và hướng nhìn trước khi gán ý nghĩa.", ["Mô tả trước", "Diễn giải sau", "Không tách khỏi toàn cảnh"]],
      ["Nhân vật và tư thế", "Tư thế, khoảng cách và hướng cơ thể tạo quan hệ thị giác nhưng không chứng minh ý định con người.", ["Hướng nhìn", "Khoảng cách", "Tương tác"]],
      ["Phong cảnh và vật thể", "Núi, nước, đường đi, công trình và vật dụng tạo lớp bối cảnh để đặt câu hỏi.", ["Bối cảnh", "Chuyển động", "Nguồn lực"]]
    ]},
    { id: "spreads", title: "Spread & Synthesis", level: "Nâng cao", lessons: [
      ["Một và ba lá", "Dùng một lá cho trọng tâm; ba lá cho ba vai trò rõ, không mặc định quá khứ–hiện tại–tương lai.", ["Vai trò vị trí", "Điểm lặp", "Mâu thuẫn"]],
      ["Năm và bảy lá", "Đọc theo cụm: nền, tác động, điểm mù, nguồn lực và bước thử; sau đó nối thành câu chuyện có điều kiện.", ["Cụm ý", "Mạch đọc", "Điều chưa biết"]],
      ["Celtic Cross", "Giữ đúng 10 vị trí; lá thứ hai nằm ngang trên lá thứ nhất và bốn lá cột phải đọc từ dưới lên.", ["Trục trung tâm", "Thập tự", "Cột tổng hợp"]]
    ]},
    { id: "ethics", title: "Thực hành & đạo đức", level: "Bắt buộc", lessons: [
      ["Ranh giới an toàn", "Không dùng Tarot thay quyết định y tế, pháp lý, tài chính hoặc để tạo phụ thuộc.", ["Không tuyệt đối", "Không gây sợ", "Khuyến khích tự quyết"]],
      ["Nhật ký kiểm chứng", "Ghi diễn giải ban đầu, dữ kiện thật, điều không khớp và kết quả sau một khoảng thời gian.", ["Dự đoán kiểm chứng được", "Không sửa ký ức", "Học từ sai lệch"]],
      ["Đọc cho người khác", "Xin đồng thuận, tránh hỏi về người thứ ba và tôn trọng quyền từ chối.", ["Đồng thuận", "Riêng tư", "Không gán nhãn"]]
    ]}
  ].map((track) => Object.freeze({ ...track, lessons: Object.freeze(track.lessons.map(([title, overview, objectives], index) => Object.freeze({ id: `${track.id}-${index + 1}`, title, overview, objectives: Object.freeze(objectives) }))) })));

  function tarotAcademyLesson(trackId = "foundation", lessonIndex = 0) {
    const track = TAROT_ACADEMY_TRACKS.find((item) => item.id === trackId) || TAROT_ACADEMY_TRACKS[0];
    const index = clamp(lessonIndex, 0, track.lessons.length - 1, 0); const lesson = track.lessons[index];
    return { track: { id: track.id, title: track.title, level: track.level, lessonCount: track.lessons.length }, lesson, index, previous: index > 0, next: index < track.lessons.length - 1 };
  }

  const TRIGRAM_META = Object.freeze({
    "111": { element: "Kim", direction: "Tây Bắc" }, "110": { element: "Kim", direction: "Tây" }, "101": { element: "Hỏa", direction: "Nam" }, "100": { element: "Mộc", direction: "Đông" },
    "011": { element: "Mộc", direction: "Đông Nam" }, "010": { element: "Thủy", direction: "Bắc" }, "001": { element: "Thổ", direction: "Đông Bắc" }, "000": { element: "Thổ", direction: "Tây Nam" }
  });
  function yarrowValue(random) { const roll = random() * 16; return roll < 1 ? 6 : roll < 8 ? 8 : roll < 13 ? 7 : 9; }
  function coinLine(random) { const coins = [0, 1, 2].map(() => random() < 0.5 ? 2 : 3); return { value: coins.reduce((sum, value) => sum + value, 0), coins }; }
  function castIChingAdvanced(seedValue, options = {}, engine = globalScope.HHFortuneIChing64) {
    if (!engine?.hexagramForBits) return { ok: false, errors: ["Engine 64 quẻ chưa được tải."] };
    const seedInfo = deterministicSeed(seedValue, "iching"); const { seed, randomMethod } = seedInfo; const random = createRandom(seed);
    const mode = ["coins", "yarrow", "manual"].includes(options.mode) ? options.mode : "coins";
    const manual = Array.isArray(options.manual) ? options.manual.map(Number) : [];
    if (mode === "manual" && (manual.length !== 6 || manual.some((value) => ![6, 7, 8, 9].includes(value)))) return { ok: false, errors: ["Chế độ thủ công cần đúng sáu giá trị 6, 7, 8 hoặc 9."] };
    const lines = Array.from({ length: 6 }, (_, index) => {
      const coin = mode === "coins" ? coinLine(random) : null; const value = mode === "manual" ? manual[index] : mode === "yarrow" ? yarrowValue(random) : coin.value;
      return { number: index + 1, value, yang: value === 7 || value === 9, changing: value === 6 || value === 9, coins: coin?.coins || [], reflection: engine.lineReflection?.(index + 1, value === 7 || value === 9, value === 6 || value === 9) || "" };
    });
    const bits = lines.map((line) => line.yang ? "1" : "0").join("");
    const changedBits = lines.map((line) => line.changing ? (line.yang ? "0" : "1") : (line.yang ? "1" : "0")).join("");
    const primary = engine.hexagramForBits(bits); const changed = engine.hexagramForBits(changedBits); const nuclear = engine.hexagramForBits(engine.nuclearBits(bits));
    const opposite = engine.hexagramForBits([...bits].map((bit) => bit === "1" ? "0" : "1").join("")); const reversed = engine.hexagramForBits([...bits].reverse().join(""));
    const moving = lines.filter((line) => line.changing).map((line) => line.number);
    const base = {
      ok: true, seed, mode, lines, primary, changed, nuclear, opposite, reversed, moving,
      rule: moving.length === 0 ? "Không có hào động: đọc trọng tâm quẻ chính." : moving.length === 1 ? `Một hào động: ưu tiên hào ${moving[0]} và đối chiếu quẻ biến.` : `Có ${moving.length} hào động: hiển thị toàn bộ; người dùng tự chọn quy tắc đọc, hệ thống không trộn trường phái.`,
      lower: { ...primary.lower, ...TRIGRAM_META[bits.slice(0, 3)] }, upper: { ...primary.upper, ...TRIGRAM_META[bits.slice(3, 6)] },
      sourceLayers: { classicalStructure: { sourceId: "ctext-zhouyi", status: "referenced" }, vietnameseTranslation: { sourceId: "hh-original", status: "HH paraphrase" }, reflection: { sourceId: "hh-original", status: "symbolic" } },
      seedProof: digest({ seed, mode, values: lines.map((line) => line.value) }), randomMethod, secureSeed: seedInfo.secureSeed,
      provenance: createProvenance({ kind: "iching", seed, method: mode === "coins" ? "Ba đồng xu" : mode === "yarrow" ? "Xác suất cỏ thi 1/16·5/16·7/16·3/16" : "Nhập sáu hào thủ công", algorithmVersion: "iching-advanced-v2", labels: ["symbolic"], input: { mode, manual: mode === "manual" ? manual : undefined, randomMethod } })
    };
    return attachResultContract(base, { methodId: "iching-king-wen-64", seed, randomMethod, input: { mode, manual: mode === "manual" ? manual : undefined, values: lines.map((line) => line.value), seedProof: base.seedProof }, calculatedFacts: [{ factId: "iching.primary", type: "hexagram-structure", label: "Quẻ chính", value: primary.number || primary.title, sourceId: "ctext-zhouyi" }, { factId: "iching.changed", type: "hexagram-structure", label: "Quẻ biến", value: changed.number || changed.title, sourceId: "ctext-zhouyi" }, ...lines.map((line) => ({ factId: `iching.line.${line.number}`, type: "line-value", label: `Hào ${line.number}`, value: line.value, sourceId: "ctext-zhouyi" }))], symbolicInterpretations: [{ interpretationId: "iching.rule", label: "Quy tắc đọc", text: base.rule }, { interpretationId: "iching.theme", label: primary.title || "Quẻ chính", text: primary.theme || "Đọc cấu trúc quẻ như câu hỏi mở." }], limitations: [seedInfo.secureSeed === false ? "Môi trường không có Web Crypto; seed dùng nguồn fallback không mật mã." : "Seed có thể kiểm chứng bằng seedProof."] });
  }

  const PYTHAGOREAN = Object.freeze({ A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9, S: 1, T: 2, U: 3, V: 4, W: 5, X: 6, Y: 7, Z: 8 });
  const CHALDEAN = Object.freeze({ A: 1, I: 1, J: 1, Q: 1, Y: 1, B: 2, K: 2, R: 2, C: 3, G: 3, L: 3, S: 3, D: 4, M: 4, T: 4, E: 5, H: 5, N: 5, X: 5, U: 6, V: 6, W: 6, O: 7, Z: 7, F: 8, P: 8 });
  const NUMEROLOGY_GUIDES = Object.freeze({
    1: ["Khởi tạo", "tự chủ, tiên phong và định hướng", "cô lập hoặc ép tốc độ", "chọn một bước do chính bạn chịu trách nhiệm", "Bạn muốn bắt đầu điều gì bằng nguồn lực đang có?"],
    2: ["Kết nối", "hợp tác, lắng nghe và tinh tế", "do dự hoặc phụ thuộc vào phản hồi", "nói rõ nhu cầu và kiểm tra sự đồng thuận", "Ranh giới nào giúp mối quan hệ cân bằng hơn?"],
    3: ["Biểu đạt", "sáng tạo, ngôn ngữ và niềm vui", "phân tán hoặc che khó khăn bằng sự vui vẻ", "hoàn thành một bản nháp nhỏ rồi nhận phản hồi", "Ý tưởng nào cần một hình dạng cụ thể?"],
    4: ["Nền tảng", "kỷ luật, quy trình và độ tin cậy", "cứng nhắc hoặc đồng nhất an toàn với bất động", "xây một thói quen đủ nhỏ để duy trì", "Cấu trúc nào đang hỗ trợ và cấu trúc nào cần sửa?"],
    5: ["Chuyển động", "tự do, trải nghiệm và thích nghi", "bốc đồng hoặc đổi hướng trước khi học xong", "thử nghiệm có giới hạn và tiêu chí dừng", "Bạn cần tự do khỏi điều gì và cam kết với điều gì?"],
    6: ["Chăm sóc", "trách nhiệm, hài hòa và cộng đồng", "ôm việc hoặc kiểm soát dưới danh nghĩa giúp đỡ", "thống nhất kỳ vọng và chia đều trách nhiệm", "Bạn có thể chăm sóc mà không quên nhu cầu của mình thế nào?"],
    7: ["Chiêm nghiệm", "nghiên cứu, chiều sâu và phân tích", "thu mình hoặc đòi đủ chắc chắn mới hành động", "kiểm chứng một giả thuyết bằng dữ kiện nhỏ", "Điều gì đã biết, điều gì mới chỉ là suy đoán?"],
    8: ["Điều hành", "nguồn lực, trách nhiệm và tác động", "quá tập trung thành tích hoặc quyền kiểm soát", "đặt tiêu chí minh bạch cho một quyết định nguồn lực", "Thành công nào vẫn phù hợp với giá trị của bạn?"],
    9: ["Hoàn tất", "tổng hợp, lòng trắc ẩn và buông bỏ", "hy sinh quá mức hoặc khó khép vòng lặp", "hoàn tất, bàn giao hoặc từ bỏ một việc đúng lúc", "Điều gì đã hoàn thành vai trò của nó?"],
    11: ["Trực giác có kiểm chứng", "độ nhạy, cảm hứng và khả năng kết nối ý tưởng", "quá tải hoặc biến cảm giác thành sự thật", "ghi cảm nhận rồi tìm bằng chứng ủng hộ và phản bác", "Tín hiệu nào cần được kiểm tra trước khi tin?"],
    22: ["Kiến tạo quy mô", "tầm nhìn đi cùng hệ thống và hợp tác", "gánh mục tiêu quá lớn hoặc cầu toàn", "chia tầm nhìn thành cột mốc có chủ sở hữu", "Phiên bản nhỏ nhất vẫn chứng minh được ý tưởng là gì?"],
    33: ["Phụng sự có ranh giới", "giảng giải, chữa lành theo nghĩa biểu tượng và nâng đỡ", "cứu hộ người khác hoặc bỏ quên bản thân", "hỗ trợ trong phạm vi năng lực và chuyển chuyên gia khi cần", "Bạn có thể giúp mà vẫn tôn trọng quyền tự quyết ra sao?"]
  });
  function numerologyGuide(numberValue, label = "Chỉ số") {
    const number = Number(numberValue); const guide = NUMEROLOGY_GUIDES[number] || NUMEROLOGY_GUIDES[reduceNumber(number, false)] || NUMEROLOGY_GUIDES[9];
    return { number, label, title: guide[0], resources: guide[1], blindSpots: guide[2], practice: guide[3], reflectionQuestion: guide[4], boundary: "Đây là ngôn ngữ biểu tượng để tự quan sát, không phải đánh giá tính cách, năng lực hay tương lai." };
  }
  function normalizeLetters(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/Đ/g, "D").replace(/[^A-Z ]/g, "").replace(/\s+/g, " ").trim(); }
  function reduceNumber(value, masters = true) { let number = Math.abs(Number(value) || 0); while (number > 9 && (!masters || ![11, 22, 33].includes(number))) number = String(number).split("").reduce((sum, digit) => sum + Number(digit), 0); return number; }
  function sumTrail(values, masters = true) { const total = values.reduce((sum, value) => sum + Number(value || 0), 0); return { total, value: reduceNumber(total, masters), formula: `${values.join(" + ")} = ${total}${total === reduceNumber(total, masters) ? "" : ` → ${reduceNumber(total, masters)}`}` }; }
  function advancedNumerology(dateValue, nameValue = "", systemValue = "pythagorean", targetDateValue = new Date().toISOString().slice(0, 10), options = {}) {
    if (!validDateValue(dateValue)) return null;
    const system = systemValue === "chaldean" ? "chaldean" : systemValue === "loshu" ? "loshu" : "pythagorean"; const keepMasterNumbers = options.keepMasterNumbers !== false;
    const [year, month, day] = dateValue.split("-").map(Number); const dateDigits = dateValue.replace(/\D/g, "").split("").map(Number);
    const life = sumTrail(dateDigits, keepMasterNumbers); const birthday = sumTrail(String(day).split("").map(Number), keepMasterNumbers); const attitude = sumTrail([...String(month), ...String(day)].map(Number), keepMasterNumbers);
    const letters = normalizeLetters(nameValue); const table = system === "chaldean" ? CHALDEAN : PYTHAGOREAN; const chars = letters.replace(/ /g, "").split(""); const vowels = new Set(["A", "E", "I", "O", "U"]);
    const mappingTrace = chars.map((letter, index) => ({ index, letter, value: table[letter] || 0, kind: vowels.has(letter) ? "vowel" : "consonant" }));
    const expression = chars.length ? sumTrail(mappingTrace.map((item) => item.value), keepMasterNumbers) : null;
    const soul = chars.length ? sumTrail(mappingTrace.filter((item) => item.kind === "vowel").map((item) => item.value), keepMasterNumbers) : null;
    const personality = chars.length ? sumTrail(mappingTrace.filter((item) => item.kind === "consonant").map((item) => item.value), keepMasterNumbers) : null;
    const maturity = expression ? sumTrail([life.value, expression.value], keepMasterNumbers) : null;
    const initials = letters.split(" ").filter(Boolean).map((part) => table[part[0]] || 0); const balance = initials.length ? sumTrail(initials, keepMasterNumbers) : null;
    const monthValue = reduceNumber(month, false); const dayValue = reduceNumber(day, false); const yearValue = reduceNumber(year, false);
    const pinnacles = [reduceNumber(monthValue + dayValue), reduceNumber(dayValue + yearValue), reduceNumber(reduceNumber(monthValue + dayValue) + reduceNumber(dayValue + yearValue)), reduceNumber(monthValue + yearValue)];
    const challenges = [Math.abs(monthValue - dayValue), Math.abs(dayValue - yearValue), Math.abs(Math.abs(monthValue - dayValue) - Math.abs(dayValue - yearValue)), Math.abs(monthValue - yearValue)];
    const [targetYear, targetMonth, targetDay] = validDateValue(targetDateValue) ? targetDateValue.split("-").map(Number) : new Date().toISOString().slice(0, 10).split("-").map(Number);
    const personalYear = reduceNumber(month + day + String(targetYear).split("").reduce((sum, digit) => sum + Number(digit), 0)); const personalMonth = reduceNumber(personalYear + targetMonth); const personalDay = reduceNumber(personalMonth + targetDay);
    const nameDigits = chars.map((letter) => table[letter] || 0); const karmicLessons = Array.from({ length: 9 }, (_, index) => index + 1).filter((number) => !nameDigits.includes(number));
    const rawTotals = [life.total, expression?.total, soul?.total, personality?.total].filter(Number.isFinite); const karmicDebt = [...new Set(rawTotals.filter((number) => [13, 14, 16, 19].includes(number)))];
    const loShu = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [index + 1, dateDigits.filter((digit) => digit === index + 1).length]));
    const base = {
      system, date: dateValue, originalName: String(nameValue || "").slice(0, 120), normalizedName: letters, name: letters, keepMasterNumbers, mappingTable: { ...table }, mappingTrace, lifePath: life, birthday, attitude, expression, soulUrge: soul, personality, maturity, balance, pinnacles, challenges,
      cycles: { personalYear, personalMonth, personalDay, targetDate: targetDateValue }, karmicDebt, karmicLessons, loShu,
      interpretations: {
        lifePath: numerologyGuide(life.value, "Đường đời"), birthday: numerologyGuide(birthday.value, "Ngày sinh"), attitude: numerologyGuide(attitude.value, "Thái độ"),
        expression: expression ? numerologyGuide(expression.value, "Biểu đạt") : null, soulUrge: soul ? numerologyGuide(soul.value, "Nội tâm") : null, personality: personality ? numerologyGuide(personality.value, "Ấn tượng") : null,
        maturity: maturity ? numerologyGuide(maturity.value, "Trưởng thành") : null, personalYear: numerologyGuide(personalYear, "Năm cá nhân"), personalMonth: numerologyGuide(personalMonth, "Tháng cá nhân"), personalDay: numerologyGuide(personalDay, "Ngày cá nhân")
      },
      provenance: createProvenance({ kind: "numerology", method: system, algorithmVersion: "numerology-v5", labels: ["symbolic"], input: { date: dateValue, targetDate: targetDateValue, nameSystem: system, nameProvided: Boolean(letters), keepMasterNumbers, normalizedName: letters } })
    };
    return attachResultContract(base, { methodId: "numerology-transparent", input: { date: dateValue, targetDate: targetDateValue, originalNameProvided: Boolean(nameValue), normalizedName: letters, system, keepMasterNumbers }, calculatedFacts: [{ factId: "numerology.life-path", type: "formula", label: "Đường đời", value: life.value }, { factId: "numerology.birthday", type: "formula", label: "Ngày sinh", value: birthday.value }, { factId: "numerology.attitude", type: "formula", label: "Thái độ", value: attitude.value }, ...(expression ? [{ factId: "numerology.expression", type: "formula", label: "Biểu đạt", value: expression.value }] : [])], symbolicInterpretations: [{ interpretationId: "numerology.limit", label: "Giới hạn", text: "Các con số chỉ là lớp biểu tượng minh bạch, không đánh giá con người." }], limitations: ["Tên tiếng Việt được Latin hóa có thể mất khác biệt ngữ âm; chuỗi chuyển đổi luôn được hiển thị.", `Chính sách master number: ${keepMasterNumbers ? "giữ 11/22/33" : "rút gọn toàn bộ"}.`] });
  }

  function eventIso(value) { const date = value?.date || value?.time?.date || value?.peak?.date || value; return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : null; }
  function localEvent(isoValue, timeZone) {
    if (!isoValue) return null;
    try { return new Intl.DateTimeFormat("vi-VN", { timeZone, dateStyle: "medium", timeStyle: "medium", hourCycle: "h23" }).format(new Date(isoValue)); } catch (_error) { return null; }
  }
  function searchAltitudeEvent(astronomy, body, observer, direction, start, altitude) {
    try { return eventIso(astronomy.SearchAltitude(body, observer, direction, start, 2, altitude)); } catch (_error) { return null; }
  }
  function moonQuarterTimeline(astronomy, dateValue) {
    if (!astronomy?.SearchMoonQuarter || !astronomy?.NextMoonQuarter) return [];
    const monthStart = new Date(`${dateValue.slice(0, 7)}-01T00:00:00Z`); const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
    const labels = ["Sóc", "Thượng huyền", "Vọng", "Hạ huyền"]; const events = [];
    try {
      let quarter = astronomy.SearchMoonQuarter(monthStart);
      while (quarter && quarter.time?.date < monthEnd && events.length < 6) {
        if (quarter.time.date >= monthStart) events.push({ quarter: quarter.quarter, label: labels[quarter.quarter] || `Pha ${quarter.quarter}`, time: eventIso(quarter) });
        quarter = astronomy.NextMoonQuarter(quarter);
      }
    } catch (_error) { return []; }
    return events;
  }
  function calculateMoonSky(dateValue, profileValue = {}, astronomy = globalScope.Astronomy) {
    const profile = normalizeProfile(profileValue); if (!validDateValue(dateValue)) return { ok: false, errors: ["Ngày không hợp lệ."] };
    if (!astronomy?.MoonPhase || !astronomy?.Illumination || !astronomy?.SearchRiseSet || !astronomy?.Observer) return { ok: false, errors: ["Astronomy Engine chưa được tải."] };
    const instant = localInputToInstant(dateValue, "12:00", profile.timezoneId) || new Date(`${dateValue}T12:00:00Z`);
    try {
      const observer = new astronomy.Observer(profile.latitude, profile.longitude, profile.elevation); const phaseAngle = astronomy.MoonPhase(instant); const illumination = astronomy.Illumination(astronomy.Body.Moon, instant);
      const rise = astronomy.SearchRiseSet(astronomy.Body.Moon, observer, 1, instant, 2, Math.max(0, profile.elevation)); const set = astronomy.SearchRiseSet(astronomy.Body.Moon, observer, -1, instant, 2, Math.max(0, profile.elevation));
      const transit = astronomy.SearchHourAngle(astronomy.Body.Moon, observer, 0, instant, 2); const apsis = astronomy.SearchLunarApsis(instant); const lunarEclipse = astronomy.SearchLunarEclipse(instant); const solarEclipse = astronomy.SearchGlobalSolarEclipse(instant); const seasons = astronomy.Seasons(instant.getUTCFullYear());
      const planetEvents = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"].map((bodyName) => ({ body: bodyName, rise: eventIso(astronomy.SearchRiseSet(astronomy.Body[bodyName], observer, 1, instant, 2, Math.max(0, profile.elevation))), set: eventIso(astronomy.SearchRiseSet(astronomy.Body[bodyName], observer, -1, instant, 2, Math.max(0, profile.elevation))) }));
      const moonEquator = astronomy.Equator?.(astronomy.Body.Moon, instant, observer, true, true); const moonHorizon = moonEquator && astronomy.Horizon?.(instant, observer, moonEquator.ra, moonEquator.dec, "normal");
      const twilight = Object.fromEntries([["civil", -6], ["nautical", -12], ["astronomical", -18]].map(([id, altitude]) => [id, {
        dawn: searchAltitudeEvent(astronomy, astronomy.Body.Sun, observer, 1, instant, altitude), dusk: searchAltitudeEvent(astronomy, astronomy.Body.Sun, observer, -1, instant, altitude), altitude
      }]));
      const phaseTimeline = moonQuarterTimeline(astronomy, dateValue); const riseIso = eventIso(rise); const setIso = eventIso(set); const transitIso = eventIso(transit);
      const base = {
        ok: true, date: dateValue, instantUtc: instant.toISOString(), phaseAngle: Number(phaseAngle.toFixed(3)), ageDays: Number((phaseAngle / 360 * 29.530588853).toFixed(2)), illuminatedPercent: Number((illumination.phase_fraction * 100).toFixed(2)), distanceKm: Math.round(illumination.geo_dist * AU_KM),
        waxing: phaseAngle < 180, rise: riseIso, set: setIso, transit: transitIso, noRiseInWindow: !riseIso, noSetInWindow: !setIso,
        localTimes: { rise: localEvent(riseIso, profile.timezoneId), set: localEvent(setIso, profile.timezoneId), transit: localEvent(transitIso, profile.timezoneId) },
        currentPosition: moonHorizon ? { altitude: Number(moonHorizon.altitude.toFixed(3)), azimuth: Number(moonHorizon.azimuth.toFixed(3)), refraction: "normal" } : null,
        twilight, phaseTimeline, horizonModel: { observerElevationMeters: profile.elevation, refraction: "normal", terrainObstruction: "not-modeled" },
        nextApsis: { time: eventIso(apsis), kind: apsis.kind === 0 ? "Cận điểm" : "Viễn điểm", distanceKm: Math.round(apsis.dist_km) },
        nextLunarEclipse: { time: eventIso(lunarEclipse), kind: lunarEclipse.kind, obscuration: Number((lunarEclipse.obscuration * 100).toFixed(1)) }, nextSolarEclipse: { time: eventIso(solarEclipse), kind: solarEclipse.kind },
        seasons: { marchEquinox: eventIso(seasons.mar_equinox), juneSolstice: eventIso(seasons.jun_solstice), septemberEquinox: eventIso(seasons.sep_equinox), decemberSolstice: eventIso(seasons.dec_solstice) }, planetEvents,
        provenance: createProvenance({ kind: "moon-sky", profile, engine: ASTRONOMY_VERSION, algorithmVersion: "moon-sky-v2", method: "VSOP87/NOVAS models via Astronomy Engine", labels: ["calculation"], input: { date: dateValue, refraction: "normal", horizonMeters: profile.elevation } })
      };
      return attachResultContract(base, { methodId: "moon-sky", profile, input: { date: dateValue, timezoneId: profile.timezoneId, latitude: profile.latitude, longitude: profile.longitude, elevation: profile.elevation, refraction: "normal" }, calculatedFacts: [
        { factId: "moon.phase-angle", type: "astronomy", label: "Góc pha", value: base.phaseAngle, unit: "degree", sourceId: "astronomy-engine" },
        { factId: "moon.illumination", type: "astronomy", label: "Phần chiếu sáng", value: base.illuminatedPercent, unit: "percent", sourceId: "astronomy-engine" },
        { factId: "moon.distance", type: "astronomy", label: "Khoảng cách địa tâm", value: base.distanceKm, unit: "km", sourceId: "astronomy-engine" },
        { factId: "moon.rise", type: "topocentric-event", label: "Mọc", value: riseIso, sourceId: "astronomy-engine" }, { factId: "moon.set", type: "topocentric-event", label: "Lặn", value: setIso, sourceId: "astronomy-engine" }
      ], limitations: [(!riseIso || !setIso) ? "Trong cửa sổ tìm kiếm có thể không có lần mọc hoặc lặn, đặc biệt ở vĩ độ cao." : "Mọc/lặn đã tính theo vị trí hồ sơ.", "Địa hình và vật cản chân trời chưa được mô hình hóa."] });
    } catch (error) { return { ok: false, errors: [`Không thể tính Moon & Sky: ${String(error?.message || error).slice(0, 180)}`] }; }
  }

  const STEMS = Object.freeze(["Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ", "Canh", "Tân", "Nhâm", "Quý"]);
  const BRANCHES = Object.freeze(["Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi"]);
  const ANIMALS = Object.freeze(["Chuột", "Trâu", "Hổ", "Mèo", "Rồng", "Rắn", "Ngựa", "Dê", "Khỉ", "Gà", "Chó", "Lợn"]);
  const STEM_ELEMENTS = Object.freeze(["Mộc", "Mộc", "Hỏa", "Hỏa", "Thổ", "Thổ", "Kim", "Kim", "Thủy", "Thủy"]);
  const SOLAR_TERMS = Object.freeze([
    [285, "Tiểu hàn"], [300, "Đại hàn"], [315, "Lập xuân"], [330, "Vũ thủy"], [345, "Kinh trập"], [0, "Xuân phân"],
    [15, "Thanh minh"], [30, "Cốc vũ"], [45, "Lập hạ"], [60, "Tiểu mãn"], [75, "Mang chủng"], [90, "Hạ chí"],
    [105, "Tiểu thử"], [120, "Đại thử"], [135, "Lập thu"], [150, "Xử thử"], [165, "Bạch lộ"], [180, "Thu phân"],
    [195, "Hàn lộ"], [210, "Sương giáng"], [225, "Lập đông"], [240, "Tiểu tuyết"], [255, "Đại tuyết"], [270, "Đông chí"]
  ]);
  function canChiYear(yearValue) { const year = Number(yearValue); if (!Number.isInteger(year) || year < -4000 || year > 9999) return null; return { year, stem: STEMS[((year - 4) % 10 + 10) % 10], branch: BRANCHES[((year - 4) % 12 + 12) % 12] }; }
  function lunarCalendarDate(dateValue, timeZone = "Asia/Ho_Chi_Minh") {
    if (!validDateValue(dateValue) || !timeZoneSupported(timeZone)) return null;
    try { return new Intl.DateTimeFormat("vi-VN-u-ca-chinese", { timeZone, year: "numeric", month: "long", day: "numeric" }).format(new Date(`${dateValue}T12:00:00Z`)); } catch (_error) { return null; }
  }
  function chineseRelatedYear(dateValue, timeZone = "Asia/Ho_Chi_Minh") {
    if (!validDateValue(dateValue) || !timeZoneSupported(timeZone)) return null;
    try { const part = new Intl.DateTimeFormat("en-u-ca-chinese", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(`${dateValue}T12:00:00Z`)).find((item) => item.type === "relatedYear"); return Number(part?.value) || null; } catch (_error) { return null; }
  }
  function solarTerms(yearValue, astronomy = globalScope.Astronomy) {
    const year = Number(yearValue); if (!Number.isInteger(year) || !astronomy?.SearchSunLongitude) return [];
    return SOLAR_TERMS.map(([longitude, name], index) => {
      const approximateMs = Date.UTC(year, 0, 5) + index * (365.2422 / 24) * 86400000; const start = new Date(approximateMs - 6 * 86400000);
      try { const event = astronomy.SearchSunLongitude(longitude, start, 16); return { name, longitude, time: eventIso(event) }; } catch (_error) { return { name, longitude, time: null }; }
    });
  }
  function calculateChineseZodiac(dateValue, profileValue = {}, boundaryValue = "lunar-new-year", astronomy = globalScope.Astronomy) {
    if (!validDateValue(dateValue)) return { ok: false, errors: ["Ngày không hợp lệ."] };
    const profile = normalizeProfile(profileValue); const boundary = boundaryValue === "lichun" ? "lichun" : "lunar-new-year"; const civilYear = Number(dateValue.slice(0, 4)); let cycleYear = chineseRelatedYear(dateValue, profile.timezoneId); let boundaryUtc = null;
    if (boundary === "lichun") {
      const lichun = solarTerms(civilYear, astronomy).find((term) => term.longitude === 315); boundaryUtc = lichun?.time || null;
      const instant = localInputToInstant(dateValue, profile.time || "12:00", profile.timezoneId, profile.calendarSystem, profile.dstResolution);
      cycleYear = instant && boundaryUtc && instant.getTime() < new Date(boundaryUtc).getTime() ? civilYear - 1 : civilYear;
    }
    if (!Number.isInteger(cycleYear)) return { ok: false, errors: ["Runtime không cung cấp năm lịch Trung Hoa cho ngày này."] };
    const pillar = canChiYear(cycleYear); const branchIndex = ((cycleYear - 4) % 12 + 12) % 12; const stemIndex = ((cycleYear - 4) % 10 + 10) % 10;
    return { ok: true, date: dateValue, boundary, boundaryLabel: boundary === "lichun" ? "Lập Xuân" : "Tết Âm lịch", boundaryUtc, cycleYear, pillar, branch: pillar.branch, stem: pillar.stem, animal: ANIMALS[branchIndex], element: STEM_ELEMENTS[stemIndex], yinYang: stemIndex % 2 === 0 ? "Dương" : "Âm", formula: boundary === "lichun" ? `So sánh thời điểm địa phương với Mặt Trời đạt 315° trong năm ${civilYear}.` : `Lấy relatedYear từ lịch Chinese của Intl tại ${profile.timezoneId}.` };
  }
  function easternCalendar(dateValue, profileValue = {}, astronomy = globalScope.Astronomy) {
    if (!validDateValue(dateValue)) return { ok: false, errors: ["Ngày không hợp lệ."] };
    const profile = normalizeProfile(profileValue); const year = Number(dateValue.slice(0, 4)); const yearPillar = canChiYear(year); const terms = solarTerms(year, astronomy); const lunarZodiac = calculateChineseZodiac(dateValue, profile, "lunar-new-year", astronomy); const lichunZodiac = calculateChineseZodiac(dateValue, profile, "lichun", astronomy);
    const base = {
      ok: true, date: dateValue, lunarLabel: lunarCalendarDate(dateValue, profile.timezoneId), yearPillar, solarTerms: terms, boundaries: { lunarNewYear: lunarZodiac, lichun: lichunZodiac },
      engines: [
        { id: "bazi", label: "Bát Tự/Tứ Trụ", status: "review", message: "Chưa kích hoạt trụ tháng/ngày/giờ cho tới khi có bộ fixture tiết khí và chuyên gia kiểm duyệt." },
        { id: "tuvi", label: "Tử Vi Đẩu Số", status: "ready", message: "Workspace riêng lập đủ 12 cung bằng iztro 2.6.0; không suy ra từ Bát Tự và không dùng cho chẩn đoán." },
        { id: "fengshui", label: "La bàn phong thủy", status: "local-only", message: "Chỉ đọc hướng khi người dùng cấp quyền cảm biến; không suy đoán vận mệnh." }
      ],
      provenance: createProvenance({ kind: "eastern-calendar", profile, engine: `${ASTRONOMY_VERSION} + Intl Chinese Calendar`, algorithmVersion: "eastern-calendar-v2", method: "Can Chi năm + 24 tiết khí + hai mốc đổi năm", labels: ["calculation", "symbolic"], input: { date: dateValue } })
    };
    return attachResultContract(base, { methodId: "eastern-calendar-foundation", profile, input: { date: dateValue, timezoneId: profile.timezoneId }, calculatedFacts: [
      { factId: "eastern.civil-year-pillar", type: "cycle", label: "Can Chi năm dương lịch", value: `${yearPillar.stem} ${yearPillar.branch}`, sourceId: "hh-original" },
      { factId: "eastern.lunar-boundary-year", type: "calendar", label: "Năm theo Tết Âm lịch", value: lunarZodiac.cycleYear, sourceId: "iana-tzdb" },
      { factId: "eastern.lichun-boundary-year", type: "astronomy", label: "Năm theo Lập Xuân", value: lichunZodiac.cycleYear, sourceId: "astronomy-engine" },
      ...terms.map((term, index) => ({ factId: `eastern.solar-term.${index + 1}`, type: "solar-longitude-event", label: term.name, value: term.time, unit: `${term.longitude} degree`, sourceId: "astronomy-engine" }))
    ], limitations: ["Hai mốc Tết Âm lịch và Lập Xuân được giữ riêng; không trộn trong một kết luận.", "Can Chi tháng/ngày/giờ chưa bật cho đến khi bộ fixture chuyên gia hoàn tất."] });
  }

  const LENORMAND_EN = Object.freeze(["Rider", "Clover", "Ship", "House", "Tree", "Clouds", "Snake", "Coffin", "Bouquet", "Scythe", "Whip", "Birds", "Child", "Fox", "Bear", "Stars", "Stork", "Dog", "Tower", "Garden", "Mountain", "Crossroads", "Mice", "Heart", "Ring", "Book", "Letter", "Man", "Woman", "Lily", "Sun", "Moon", "Key", "Fish", "Anchor", "Cross"]);
  const LENORMAND_INSETS = Object.freeze(["9♥", "6♦", "10♠", "K♥", "7♥", "K♣", "Q♣", "9♦", "Q♠", "J♦", "J♣", "7♦", "J♠", "9♣", "10♣", "6♥", "Q♥", "10♥", "6♠", "8♠", "8♣", "Q♦", "7♣", "J♥", "A♣", "10♦", "7♠", "A♥", "A♠", "K♠", "A♦", "8♥", "8♦", "K♦", "9♠", "6♣"]);
  const LENORMAND_GUIDES = Object.freeze([
    ["tin tức, chuyển động", "Điều gì đang đến gần và cần được phản hồi?"], ["cơ hội nhỏ, nhẹ nhõm", "Cơ hội ngắn hạn nào đáng thử với rủi ro thấp?"], ["hành trình, khoảng cách", "Điều gì cần mở rộng tầm nhìn hoặc vượt khỏi vùng quen?"], ["nhà, nền an toàn", "Nền tảng nào đang bảo vệ bạn và nền nào cần sửa?"],
    ["sức sống, phát triển dài hạn", "Điều gì cần thời gian, chăm sóc và nhịp đều?"], ["mơ hồ, thay đổi góc nhìn", "Dữ kiện nào đang bị che và cần chờ rõ hơn?"], ["phức tạp, đường vòng", "Vấn đề nào cần chiến lược thay vì phản ứng trực diện?"], ["kết thúc, tạm dừng", "Điều gì đã khép lại hoặc cần được để yên?"],
    ["quà tặng, thiện ý", "Bạn có thể đón nhận hoặc trao sự trân trọng cụ thể nào?"], ["cắt bỏ, quyết định nhanh", "Điều gì cần giới hạn rõ trước khi gây thêm tổn thất?"], ["lặp lại, tranh luận", "Vòng lặp nào đang tiêu hao và cần một quy tắc mới?"], ["đối thoại, xao động", "Cuộc trò chuyện nào cần bình tĩnh và nghe đủ hai phía?"],
    ["khởi đầu, sự đơn giản", "Bạn có thể bắt đầu lại bằng một bước nhỏ nào?"], ["chiến lược, công việc", "Điều gì cần kiểm tra kỹ động cơ, vai trò và lợi ích?"], ["sức mạnh, bảo trợ", "Nguồn lực hoặc quyền lực nào cần được dùng có trách nhiệm?"], ["định hướng, mạng lưới", "Mục tiêu nào đủ rõ để giúp bạn chọn đường?"],
    ["thay đổi, cải tiến", "Sự dịch chuyển nào đang diễn ra và cần chuẩn bị gì?"], ["tin cậy, hỗ trợ", "Ai hoặc điều gì đã chứng minh độ tin cậy bằng hành động lặp lại?"], ["ranh giới, tổ chức", "Khoảng cách hoặc cấu trúc nào giúp bạn nhìn khách quan hơn?"], ["cộng đồng, công khai", "Không gian xã hội nào ảnh hưởng đến lựa chọn này?"],
    ["trở ngại, trì hoãn", "Vật cản nào cần đổi tuyến, giảm tải hoặc xin hỗ trợ?"], ["lựa chọn, phân nhánh", "Tiêu chí nào giúp loại bớt phương án mà không vội vàng?"], ["hao hụt, lo lắng", "Rò rỉ nhỏ nào đang bào mòn thời gian hoặc năng lượng?"], ["tình cảm, giá trị", "Cảm xúc nào cần được gọi tên và trao đổi trực tiếp?"],
    ["cam kết, chu kỳ", "Cam kết nào cần điều khoản, kỳ vọng và thời điểm xem lại?"], ["tri thức, điều chưa mở", "Điều gì cần học thêm hoặc chưa nên kết luận?"], ["thông điệp, tài liệu", "Thông tin nào cần được viết rõ và kiểm tra nguồn?"], ["người/đại diện chủ động", "Hãy đọc như một vai trò hoặc người được xác định rõ, không tự đoán danh tính."],
    ["người/đại diện tiếp nhận", "Hãy đọc như một vai trò hoặc người được xác định rõ, không tự đoán danh tính."], ["trưởng thành, hòa bình", "Điều gì cần kinh nghiệm, kiên nhẫn và ranh giới lành mạnh?"], ["thành công, sáng rõ", "Điều gì đã rõ hơn và có thể chuyển thành hành động cụ thể?"], ["cảm nhận, ghi nhận", "Phản hồi hoặc cảm xúc nào cần kiểm chứng thay vì phóng đại?"],
    ["lời giải, điều chắc chắn", "Dữ kiện then chốt nào đang mở khóa bước tiếp theo?"], ["nguồn lực, dòng chảy", "Nguồn lực nào đang tăng, giảm hoặc cần được phân bổ lại?"], ["ổn định, nghề nghiệp", "Điểm neo nào đủ bền để xây kế hoạch dài hạn?"], ["gánh nặng, ý nghĩa", "Điều khó nào cần được thừa nhận và chia nhỏ thay vì thần bí hóa?"]
  ]);
  const LENORMAND_SPRITE = "assets/fortune/lenormand/game-of-hope/spiel-der-hoffnung-36.webp";
  const LENORMAND_36 = Object.freeze(["Kỵ sĩ", "Cỏ bốn lá", "Con thuyền", "Ngôi nhà", "Cây", "Mây", "Rắn", "Quan tài", "Bó hoa", "Lưỡi hái", "Roi", "Chim", "Đứa trẻ", "Cáo", "Gấu", "Sao", "Cò", "Chó", "Tháp", "Khu vườn", "Núi", "Ngã rẽ", "Chuột", "Trái tim", "Nhẫn", "Sách", "Thư", "Người nam", "Người nữ", "Hoa huệ", "Mặt Trời", "Mặt Trăng", "Chìa khóa", "Cá", "Mỏ neo", "Thập tự"].map((name, index) => Object.freeze({
    id: `lenormand-${index + 1}`, number: index + 1, name, englishName: LENORMAND_EN[index], playingCard: LENORMAND_INSETS[index], symbol: String.fromCodePoint(0x25c7 + index % 4),
    keywords: LENORMAND_GUIDES[index][0].split(", "), prompt: LENORMAND_GUIDES[index][1], image: LENORMAND_SPRITE, spriteColumn: index % 6, spriteRow: Math.floor(index / 6),
    sourceId: "game-of-hope-wikimedia-pdm", sourcePage: "https://commons.wikimedia.org/wiki/File:Das_Spiel_der_Hofnung_(The_Game_of_Hope).png"
  })));

  function lenormandReading(cardsValue = []) {
    const cards = Array.isArray(cardsValue) ? cardsValue.filter((card) => card?.id?.startsWith("lenormand-")).slice(0, 36) : [];
    const pairs = cards.slice(0, -1).map((card, index) => {
      const next = cards[index + 1];
      return { from: card.id, to: next.id, label: `${card.name} + ${next.name}`, reading: `${card.name} đặt chủ đề “${card.keywords.join(", ")}”; ${next.name} cho biết chủ đề ấy được tiếp nối qua “${next.keywords.join(", ")}”. Hãy kiểm tra mối nối này bằng một dữ kiện hoặc cuộc trò chuyện thật.`, question: `Trong tình huống hiện tại, ${card.prompt.replace(/\?$/, "").toLocaleLowerCase("vi")}; đồng thời ${next.prompt.toLocaleLowerCase("vi")}` };
    });
    const thirds = cards.length >= 3 ? [
      { label: "Mở cảnh", cards: cards.slice(0, Math.ceil(cards.length / 3)).map((card) => card.name), instruction: "Mô tả điều đang bước vào bối cảnh mà chưa vội kết luận." },
      { label: "Điểm chuyển", cards: cards.slice(Math.ceil(cards.length / 3), Math.ceil(cards.length * 2 / 3)).map((card) => card.name), instruction: "Tìm lực cản, nguồn hỗ trợ và chi tiết làm thay đổi mạch đọc." },
      { label: "Hướng quan sát", cards: cards.slice(Math.ceil(cards.length * 2 / 3)).map((card) => card.name), instruction: "Chuyển mạch biểu tượng thành câu hỏi và bước thử có thể đảo ngược." }
    ] : [];
    const houses = cards.length === 36 ? cards.map((card, index) => ({ position: index + 1, house: LENORMAND_36[index], card, match: card.number === index + 1, note: `${card.name} nằm ở nhà ${LENORMAND_36[index].name}: đặt “${card.keywords.join(", ")}” trong lĩnh vực “${LENORMAND_36[index].keywords.join(", ")}”.` })) : [];
    const findPosition = (number) => { const index = cards.findIndex((card) => card.number === number); return index < 0 ? null : { index: index + 1, row: Math.floor(index / 8) + 1, column: index % 8 + 1 }; };
    return { count: cards.length, pairs, thirds, houses, significators: { man: findPosition(28), woman: findPosition(29) }, guidance: cards.length === 36 ? ["Grand Tableau dùng bố cục 8×4 + 4 lá cuối.", "Đọc nhà, lá đại diện và các lá kề trước khi nối đường xa.", "Không tự chọn lá Người nam/nữ làm đại diện nếu người dùng chưa xác định."] : ["Đọc từ trái sang phải như một câu, nhưng giữ vai trò từng vị trí.", "Cặp lá mô tả quan hệ biểu tượng; không phải bằng chứng về người hoặc sự kiện.", "Kết thúc bằng một câu hỏi có thể kiểm chứng."] };
  }
  const RUNES_24 = Object.freeze([["ᚠ", "Fehu", "f", "Freyr's ætt"], ["ᚢ", "Uruz", "u", "Freyr's ætt"], ["ᚦ", "Thurisaz", "þ", "Freyr's ætt"], ["ᚨ", "Ansuz", "a", "Freyr's ætt"], ["ᚱ", "Raidho", "r", "Freyr's ætt"], ["ᚲ", "Kenaz", "k", "Freyr's ætt"], ["ᚷ", "Gebo", "g", "Freyr's ætt"], ["ᚹ", "Wunjo", "w", "Freyr's ætt"], ["ᚺ", "Hagalaz", "h", "Hagal's ætt"], ["ᚾ", "Nauthiz", "n", "Hagal's ætt"], ["ᛁ", "Isa", "i", "Hagal's ætt"], ["ᛃ", "Jera", "j", "Hagal's ætt"], ["ᛇ", "Eihwaz", "ï", "Hagal's ætt"], ["ᛈ", "Perthro", "p", "Hagal's ætt"], ["ᛉ", "Algiz", "z", "Hagal's ætt"], ["ᛋ", "Sowilo", "s", "Hagal's ætt"], ["ᛏ", "Tiwaz", "t", "Tyr's ætt"], ["ᛒ", "Berkano", "b", "Tyr's ætt"], ["ᛖ", "Ehwaz", "e", "Tyr's ætt"], ["ᛗ", "Mannaz", "m", "Tyr's ætt"], ["ᛚ", "Laguz", "l", "Tyr's ætt"], ["ᛜ", "Ingwaz", "ŋ", "Tyr's ætt"], ["ᛞ", "Dagaz", "d", "Tyr's ætt"], ["ᛟ", "Othala", "o", "Tyr's ætt"]].map(([symbol, name, transliteration, family], index) => Object.freeze({ id: `rune-${index + 1}`, number: index + 1, name, symbol, transliteration, family, sourceId: "unicode-runic", prompt: `Rune ${name} được dùng như câu gợi mở biểu tượng; dữ liệu ngôn ngữ “${transliteration}” được tách khỏi diễn giải HH.` })));
  const ORACLE_24 = Object.freeze(["Khoảng thở", "Cánh cửa", "Mạch nước", "Sợi chỉ", "Ngọn đồi", "Đốm lửa", "Mầm non", "Bến đỗ", "Làn gió", "Tấm gương", "Dòng chảy", "Chiếc cầu", "Đường chân trời", "Vệt sáng", "Hạt cát", "Vòng tròn", "Tiếng chuông", "Bậc thềm", "Cánh rừng", "Giọt mưa", "Trang giấy", "Ngọn hải đăng", "Mùa chuyển", "Điểm neo"].map((name, index) => Object.freeze({ id: `oracle-${index + 1}`, number: index + 1, name, symbol: ["✦", "◌", "◇", "△"][index % 4], prompt: `${name} gợi một câu hỏi: điều gì có thể được quan sát hoặc thử ở quy mô nhỏ?` })));
  function drawSymbolDeck(typeValue, seedValue, countValue = 1, options = {}) {
    const type = ["lenormand", "runes", "oracle"].includes(typeValue) ? typeValue : "oracle"; const deck = type === "lenormand" ? LENORMAND_36 : type === "runes" ? RUNES_24 : ORACLE_24;
    const seedInfo = deterministicSeed(seedValue, type); const { seed, randomMethod } = seedInfo; const random = createRandom(seed); const pool = [...deck];
    for (let index = pool.length - 1; index > 0; index -= 1) { const target = Math.floor(random() * (index + 1)); [pool[index], pool[target]] = [pool[target], pool[index]]; }
    const maxCount = type === "lenormand" ? 36 : pool.length; const count = clamp(countValue, 1, maxCount, 1); const allowReversed = type === "runes" && options.allowReversed === true;
    const cards = pool.slice(0, count).map((card) => ({ ...card, reversed: allowReversed ? random() < 0.5 : false })); const methodId = type === "lenormand" ? "lenormand-classic-36" : type === "runes" ? "elder-futhark-24" : "oracle-hh-24";
    const base = { type, seed, seedProof: digest({ type, seed, count, allowReversed, cards: cards.map((card) => `${card.id}:${card.reversed}`) }), randomMethod, secureSeed: seedInfo.secureSeed, count, allowReversed, layout: type === "lenormand" && count === 36 ? "grand-tableau" : `${count}-symbol`, cards, provenance: createProvenance({ kind: type, seed, method: `${type} HH · Fisher-Yates/Mulberry32`, algorithmVersion: `${type}-v2`, labels: ["symbolic"], input: { count, allowReversed } }) };
    return attachResultContract(base, { methodId, seed, randomMethod, input: { type, count, allowReversed, seedProof: base.seedProof }, calculatedFacts: cards.map((card, index) => ({ factId: `${type}.card.${index + 1}`, type: "deterministic-selection", label: `Vị trí ${index + 1}`, value: card.id, sourceId: card.sourceId || "hh-original" })), symbolicInterpretations: cards.map((card, index) => ({ interpretationId: `${type}.reflection.${index + 1}`, label: card.name, text: card.prompt })), limitations: [type === "runes" ? `Rune đảo: ${allowReversed ? "đã bật theo lựa chọn người dùng" : "mặc định tắt vì không phải quy tắc lịch sử bắt buộc"}.` : "Các vị trí và kết hợp là lớp trường phái biểu tượng."] });
  }

  const READINESS = Object.freeze([
    { id: "provenance", label: "Accuracy & Provenance", status: "ready" }, { id: "tarot78", label: "Tarot 78", status: "ready" }, { id: "iching", label: "Kinh Dịch nâng cao", status: "ready" },
    { id: "numerology", label: "Thần số học V4", status: "ready" }, { id: "moon-sky", label: "Moon & Sky", status: "ready" }, { id: "eastern-calendar", label: "Can Chi & tiết khí", status: "ready" },
    { id: "bazi", label: "Bát Tự đầy đủ", status: "review" }, { id: "tuvi", label: "Tử Vi Đẩu Số · iztro", status: "ready" }, { id: "face-palm", label: "Camera/AI nhân tướng", status: "disabled" }
  ]);

  return Object.freeze({
    VERSION, CONTENT_VERSION, ASTRONOMY_VERSION, LABELS, ZODIAC_MODES, HOUSE_SYSTEMS, DEFAULT_ORBS, SOURCE_REFERENCES, INTERPRETATION_PACKS, METHOD_REGISTRY, TAROT_78, SPREADS, TAROT_ACADEMY_TRACKS, LENORMAND_36, RUNES_24, ORACLE_24, READINESS,
    clamp, normalizeAngle, hashSeed, createRandom, validDateValue, timeZoneSupported, zoneOffsetMinutes, localInputToInstant, normalizeProfile, createProvenance, methodDefinition, createSecureSeed, createResultContract, verifyResultContract, attachResultContract,
    calculateSolarZodiac, drawTarot78, tarotStatistics, tarotQuiz, academyReviewSchedule, tarotAcademyLesson, castIChingAdvanced, advancedNumerology, numerologyGuide, calculateMoonSky, canChiYear, lunarCalendarDate, chineseRelatedYear, solarTerms, calculateChineseZodiac, easternCalendar, drawSymbolDeck, lenormandReading
  });
});
