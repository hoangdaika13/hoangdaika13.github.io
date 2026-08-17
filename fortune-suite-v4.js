(function fortuneSuiteV4Module(scope, factory) {
  "use strict";
  const api = factory(scope || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope && typeof scope === "object") scope.HHFortuneSuiteV4 = api;
})(typeof window !== "undefined" ? window : globalThis, function createFortuneSuiteV4(globalScope) {
  "use strict";

  const VERSION = "4.1.0";
  const CONTENT_VERSION = "hh-reflection-content-2026.08";
  const ASTRONOMY_VERSION = "Astronomy Engine 2.1.19";
  const LABELS = Object.freeze({ calculation: "TÍNH TOÁN", symbolic: "BIỂU TƯỢNG", ai: "AI" });
  const ZODIAC_MODES = Object.freeze(["tropical", "sidereal"]);
  const HOUSE_SYSTEMS = Object.freeze(["equal", "whole-sign", "porphyry"]);
  const DEFAULT_ORBS = Object.freeze({ conjunction: 8, sextile: 5, square: 7, trine: 7, opposition: 8 });
  const AU_KM = 149597870.7;

  function accuracyLab() { return globalScope.HHFortuneAccuracyLab || (typeof require === "function" ? require("./fortune-accuracy-lab") : null); }

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
  const MAJOR_CARDS = MAJOR_NAMES.map(([id, symbol, vietnameseName, englishName], index) => Object.freeze({
    id: `major-${id}`, arcana: "major", number: index, suit: "Major Arcana", symbol, name: `${englishName} · ${vietnameseName}`, englishName, vietnameseName, image: `assets/fortune/tarot/rws/major-${id}.webp`,
    light: `Mặt sáng của ${vietnameseName.toLocaleLowerCase("vi")} khuyến khích quan sát điều đang mở ra và chọn một bước có chủ đích.`,
    shadow: `Mặt khuất nhắc rằng biểu tượng ${vietnameseName.toLocaleLowerCase("vi")} không thay thế dữ kiện, ranh giới hay trách nhiệm cá nhân.`,
    balanced: `Giữ cả cơ hội lẫn giới hạn của ${vietnameseName.toLocaleLowerCase("vi")} trong cùng một góc nhìn.`,
    question: `Điều gì từ hình tượng ${vietnameseName} thật sự liên hệ với trải nghiệm hiện tại của bạn?`, color: `hsl(${(index * 31 + 180) % 360} 78% 68%)`, contentVersion: CONTENT_VERSION
  }));
  const MINOR_CARDS = SUITS.flatMap((suit) => RANKS.map(([rankId, rankName, englishRank, stage], rankIndex) => Object.freeze({
    id: `${suit.id}-${rankId}`, arcana: "minor", number: rankIndex + 1, suit: suit.name, element: suit.element, symbol: suit.symbol, name: `${englishRank} of ${suit.english} · ${rankName} ${suit.name}`, englishName: `${englishRank} of ${suit.english}`, vietnameseName: `${rankName} ${suit.name}`, image: `assets/fortune/tarot/rws/${suit.id}-${rankId}.webp`,
    light: `${stage}; vận dụng ${suit.focus} bằng một hành động vừa sức và có kiểm chứng.`,
    shadow: `${stage} có thể bị lệch khi ${suit.focus} trở thành phản ứng tự động hoặc quá tải.`,
    balanced: `Quan sát ${suit.focus}, sau đó chọn nhịp tiến phù hợp với nguồn lực thực tế.`,
    question: `Trong ${suit.focus}, điều gì đang cần được nhìn rõ thay vì phán đoán nhanh?`, color: suit.color, contentVersion: CONTENT_VERSION
  })));
  const TAROT_78 = Object.freeze([...MAJOR_CARDS, ...MINOR_CARDS]);
  const SPREADS = Object.freeze({
    1: ["Trọng tâm"], 3: ["Bối cảnh", "Điều cần chú ý", "Bước thử"], 5: ["Nền", "Tác động", "Điểm mù", "Nguồn lực", "Hướng đi"],
    7: ["Gốc rễ", "Quá khứ gần", "Hiện tại", "Điểm chuyển", "Nguồn lực", "Thử thách", "Bước tiếp"],
    10: ["Hiện trạng", "Tác động chéo", "Nền sâu", "Quá khứ", "Điều hướng tới", "Tương lai gần", "Nội lực", "Môi trường", "Hy vọng/lo ngại", "Tổng hợp"],
    12: Array.from({ length: 12 }, (_, index) => `Lĩnh vực ${index + 1}`),
    15: Array.from({ length: 15 }, (_, index) => `Vị trí ${index + 1}`)
  });
  function drawTarot78(seedValue, options = {}) {
    const seed = String(seedValue || `${Date.now()}-${Math.random()}`);
    const count = [1, 3, 5, 7, 10, 12, 15].includes(Number(options.count)) ? Number(options.count) : 3;
    const random = createRandom(seed); const deck = [...TAROT_78];
    for (let index = deck.length - 1; index > 0; index -= 1) { const target = Math.floor(random() * (index + 1)); [deck[index], deck[target]] = [deck[target], deck[index]]; }
    const positions = Array.isArray(options.positions) && options.positions.length >= count ? options.positions : SPREADS[count];
    const cards = deck.slice(0, count).map((card, index) => ({ ...card, reversed: options.allowReversed !== false && random() < 0.36, position: String(positions[index] || `Vị trí ${index + 1}`).slice(0, 80), note: "", pinned: false }));
    return { seed, count, allowReversed: options.allowReversed !== false, selfInterpretation: Boolean(options.selfInterpretation), cards, provenance: createProvenance({ kind: "tarot", seed, method: `Tarot HH 78 · ${count} lá · Fisher-Yates/Mulberry32`, algorithmVersion: "tarot-78-v1", labels: ["symbolic"], input: { count, allowReversed: options.allowReversed !== false } }) };
  }
  function tarotStatistics(readings = []) {
    const cards = readings.flatMap((reading) => Array.isArray(reading?.cards) ? reading.cards : Array.isArray(reading) ? reading : []);
    const counts = new Map(); const suits = new Map(); let reversed = 0;
    cards.forEach((card) => { counts.set(card.id, (counts.get(card.id) || 0) + 1); suits.set(card.suit, (suits.get(card.suit) || 0) + 1); if (card.reversed) reversed += 1; });
    return { total: cards.length, reversedRate: cards.length ? Math.round(reversed / cards.length * 100) : 0, topCards: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, count]) => ({ card: TAROT_78.find((item) => item.id === id), count })), suits: Object.fromEntries(suits) };
  }
  function tarotQuiz(seed = "academy") {
    const random = createRandom(seed); const card = TAROT_78[Math.floor(random() * TAROT_78.length)];
    const distractors = TAROT_78.filter((item) => item.id !== card.id).sort(() => random() - 0.5).slice(0, 3).map((item) => item.light);
    const answers = [card.light, ...distractors].sort(() => random() - 0.5);
    return { card, answers, correctIndex: answers.indexOf(card.light) };
  }

  const TRIGRAM_META = Object.freeze({
    "111": { element: "Kim", direction: "Tây Bắc" }, "110": { element: "Kim", direction: "Tây" }, "101": { element: "Hỏa", direction: "Nam" }, "100": { element: "Mộc", direction: "Đông" },
    "011": { element: "Mộc", direction: "Đông Nam" }, "010": { element: "Thủy", direction: "Bắc" }, "001": { element: "Thổ", direction: "Đông Bắc" }, "000": { element: "Thổ", direction: "Tây Nam" }
  });
  function yarrowValue(random) { const roll = random() * 16; return roll < 1 ? 6 : roll < 8 ? 8 : roll < 13 ? 7 : 9; }
  function coinLine(random) { const coins = [0, 1, 2].map(() => random() < 0.5 ? 2 : 3); return { value: coins.reduce((sum, value) => sum + value, 0), coins }; }
  function castIChingAdvanced(seedValue, options = {}, engine = globalScope.HHFortuneIChing64) {
    if (!engine?.hexagramForBits) return { ok: false, errors: ["Engine 64 quẻ chưa được tải."] };
    const seed = String(seedValue || `${Date.now()}-${Math.random()}`); const random = createRandom(seed);
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
    return {
      ok: true, seed, mode, lines, primary, changed, nuclear, opposite, reversed, moving,
      rule: moving.length === 0 ? "Không có hào động: đọc trọng tâm quẻ chính." : moving.length === 1 ? `Một hào động: ưu tiên hào ${moving[0]} và đối chiếu quẻ biến.` : `Có ${moving.length} hào động: hiển thị toàn bộ; người dùng tự chọn quy tắc đọc, hệ thống không trộn trường phái.`,
      lower: { ...primary.lower, ...TRIGRAM_META[bits.slice(0, 3)] }, upper: { ...primary.upper, ...TRIGRAM_META[bits.slice(3, 6)] },
      provenance: createProvenance({ kind: "iching", seed, method: mode === "coins" ? "Ba đồng xu" : mode === "yarrow" ? "Xác suất cỏ thi 1/16·5/16·7/16·3/16" : "Nhập sáu hào thủ công", algorithmVersion: "iching-advanced-v1", labels: ["symbolic"], input: { mode, manual: mode === "manual" ? manual : undefined } })
    };
  }

  const PYTHAGOREAN = Object.freeze({ A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9, S: 1, T: 2, U: 3, V: 4, W: 5, X: 6, Y: 7, Z: 8 });
  const CHALDEAN = Object.freeze({ A: 1, I: 1, J: 1, Q: 1, Y: 1, B: 2, K: 2, R: 2, C: 3, G: 3, L: 3, S: 3, D: 4, M: 4, T: 4, E: 5, H: 5, N: 5, X: 5, U: 6, V: 6, W: 6, O: 7, Z: 7, F: 8, P: 8 });
  function normalizeLetters(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/Đ/g, "D").replace(/[^A-Z ]/g, "").replace(/\s+/g, " ").trim(); }
  function reduceNumber(value, masters = true) { let number = Math.abs(Number(value) || 0); while (number > 9 && (!masters || ![11, 22, 33].includes(number))) number = String(number).split("").reduce((sum, digit) => sum + Number(digit), 0); return number; }
  function sumTrail(values, masters = true) { const total = values.reduce((sum, value) => sum + Number(value || 0), 0); return { total, value: reduceNumber(total, masters), formula: `${values.join(" + ")} = ${total}${total === reduceNumber(total, masters) ? "" : ` → ${reduceNumber(total, masters)}`}` }; }
  function advancedNumerology(dateValue, nameValue = "", systemValue = "pythagorean", targetDateValue = new Date().toISOString().slice(0, 10)) {
    if (!validDateValue(dateValue)) return null;
    const system = systemValue === "chaldean" ? "chaldean" : systemValue === "loshu" ? "loshu" : "pythagorean";
    const [year, month, day] = dateValue.split("-").map(Number); const dateDigits = dateValue.replace(/\D/g, "").split("").map(Number);
    const life = sumTrail(dateDigits); const birthday = sumTrail(String(day).split("").map(Number)); const attitude = sumTrail([...String(month), ...String(day)].map(Number));
    const letters = normalizeLetters(nameValue); const table = system === "chaldean" ? CHALDEAN : PYTHAGOREAN; const chars = letters.replace(/ /g, "").split(""); const vowels = new Set(["A", "E", "I", "O", "U"]);
    const expression = chars.length ? sumTrail(chars.map((letter) => table[letter] || 0)) : null;
    const soul = chars.length ? sumTrail(chars.filter((letter) => vowels.has(letter)).map((letter) => table[letter] || 0)) : null;
    const personality = chars.length ? sumTrail(chars.filter((letter) => !vowels.has(letter)).map((letter) => table[letter] || 0)) : null;
    const maturity = expression ? sumTrail([life.value, expression.value]) : null;
    const initials = letters.split(" ").filter(Boolean).map((part) => table[part[0]] || 0); const balance = initials.length ? sumTrail(initials) : null;
    const monthValue = reduceNumber(month, false); const dayValue = reduceNumber(day, false); const yearValue = reduceNumber(year, false);
    const pinnacles = [reduceNumber(monthValue + dayValue), reduceNumber(dayValue + yearValue), reduceNumber(reduceNumber(monthValue + dayValue) + reduceNumber(dayValue + yearValue)), reduceNumber(monthValue + yearValue)];
    const challenges = [Math.abs(monthValue - dayValue), Math.abs(dayValue - yearValue), Math.abs(Math.abs(monthValue - dayValue) - Math.abs(dayValue - yearValue)), Math.abs(monthValue - yearValue)];
    const [targetYear, targetMonth, targetDay] = validDateValue(targetDateValue) ? targetDateValue.split("-").map(Number) : new Date().toISOString().slice(0, 10).split("-").map(Number);
    const personalYear = reduceNumber(month + day + String(targetYear).split("").reduce((sum, digit) => sum + Number(digit), 0)); const personalMonth = reduceNumber(personalYear + targetMonth); const personalDay = reduceNumber(personalMonth + targetDay);
    const nameDigits = chars.map((letter) => table[letter] || 0); const karmicLessons = Array.from({ length: 9 }, (_, index) => index + 1).filter((number) => !nameDigits.includes(number));
    const rawTotals = [life.total, expression?.total, soul?.total, personality?.total].filter(Number.isFinite); const karmicDebt = [...new Set(rawTotals.filter((number) => [13, 14, 16, 19].includes(number)))];
    const loShu = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [index + 1, dateDigits.filter((digit) => digit === index + 1).length]));
    return {
      system, date: dateValue, name: letters, lifePath: life, birthday, attitude, expression, soulUrge: soul, personality, maturity, balance, pinnacles, challenges,
      cycles: { personalYear, personalMonth, personalDay, targetDate: targetDateValue }, karmicDebt, karmicLessons, loShu,
      provenance: createProvenance({ kind: "numerology", method: system, algorithmVersion: "numerology-v4", labels: ["symbolic"], input: { date: dateValue, targetDate: targetDateValue, nameSystem: system, nameProvided: Boolean(letters) } })
    };
  }

  function eventIso(value) { const date = value?.date || value?.time?.date || value?.peak?.date || value; return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : null; }
  function calculateMoonSky(dateValue, profileValue = {}, astronomy = globalScope.Astronomy) {
    const profile = normalizeProfile(profileValue); if (!validDateValue(dateValue)) return { ok: false, errors: ["Ngày không hợp lệ."] };
    if (!astronomy?.MoonPhase || !astronomy?.Illumination || !astronomy?.SearchRiseSet || !astronomy?.Observer) return { ok: false, errors: ["Astronomy Engine chưa được tải."] };
    const instant = localInputToInstant(dateValue, "12:00", profile.timezoneId) || new Date(`${dateValue}T12:00:00Z`);
    try {
      const observer = new astronomy.Observer(profile.latitude, profile.longitude, profile.elevation); const phaseAngle = astronomy.MoonPhase(instant); const illumination = astronomy.Illumination(astronomy.Body.Moon, instant);
      const rise = astronomy.SearchRiseSet(astronomy.Body.Moon, observer, 1, instant, 2, Math.max(0, profile.elevation)); const set = astronomy.SearchRiseSet(astronomy.Body.Moon, observer, -1, instant, 2, Math.max(0, profile.elevation));
      const transit = astronomy.SearchHourAngle(astronomy.Body.Moon, observer, 0, instant, 2); const apsis = astronomy.SearchLunarApsis(instant); const lunarEclipse = astronomy.SearchLunarEclipse(instant); const solarEclipse = astronomy.SearchGlobalSolarEclipse(instant); const seasons = astronomy.Seasons(instant.getUTCFullYear());
      const planetEvents = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"].map((bodyName) => ({ body: bodyName, rise: eventIso(astronomy.SearchRiseSet(astronomy.Body[bodyName], observer, 1, instant, 2, Math.max(0, profile.elevation))), set: eventIso(astronomy.SearchRiseSet(astronomy.Body[bodyName], observer, -1, instant, 2, Math.max(0, profile.elevation))) }));
      return {
        ok: true, date: dateValue, instantUtc: instant.toISOString(), phaseAngle: Number(phaseAngle.toFixed(3)), ageDays: Number((phaseAngle / 360 * 29.530588853).toFixed(2)), illuminatedPercent: Number((illumination.phase_fraction * 100).toFixed(2)), distanceKm: Math.round(illumination.geo_dist * AU_KM),
        rise: eventIso(rise), set: eventIso(set), transit: eventIso(transit), nextApsis: { time: eventIso(apsis), kind: apsis.kind === 0 ? "Cận điểm" : "Viễn điểm", distanceKm: Math.round(apsis.dist_km) },
        nextLunarEclipse: { time: eventIso(lunarEclipse), kind: lunarEclipse.kind, obscuration: Number((lunarEclipse.obscuration * 100).toFixed(1)) }, nextSolarEclipse: { time: eventIso(solarEclipse), kind: solarEclipse.kind },
        seasons: { marchEquinox: eventIso(seasons.mar_equinox), juneSolstice: eventIso(seasons.jun_solstice), septemberEquinox: eventIso(seasons.sep_equinox), decemberSolstice: eventIso(seasons.dec_solstice) }, planetEvents,
        provenance: createProvenance({ kind: "moon-sky", profile, engine: ASTRONOMY_VERSION, algorithmVersion: "moon-sky-v1", method: "VSOP87/NOVAS models via Astronomy Engine", labels: ["calculation"], input: { date: dateValue } })
      };
    } catch (error) { return { ok: false, errors: [`Không thể tính Moon & Sky: ${String(error?.message || error).slice(0, 180)}`] }; }
  }

  const STEMS = Object.freeze(["Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ", "Canh", "Tân", "Nhâm", "Quý"]);
  const BRANCHES = Object.freeze(["Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi"]);
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
  function solarTerms(yearValue, astronomy = globalScope.Astronomy) {
    const year = Number(yearValue); if (!Number.isInteger(year) || !astronomy?.SearchSunLongitude) return [];
    return SOLAR_TERMS.map(([longitude, name], index) => {
      const approximateMs = Date.UTC(year, 0, 5) + index * (365.2422 / 24) * 86400000; const start = new Date(approximateMs - 6 * 86400000);
      try { const event = astronomy.SearchSunLongitude(longitude, start, 16); return { name, longitude, time: eventIso(event) }; } catch (_error) { return { name, longitude, time: null }; }
    });
  }
  function easternCalendar(dateValue, profileValue = {}, astronomy = globalScope.Astronomy) {
    if (!validDateValue(dateValue)) return { ok: false, errors: ["Ngày không hợp lệ."] };
    const profile = normalizeProfile(profileValue); const year = Number(dateValue.slice(0, 4)); const yearPillar = canChiYear(year); const terms = solarTerms(year, astronomy);
    return {
      ok: true, date: dateValue, lunarLabel: lunarCalendarDate(dateValue, profile.timezoneId), yearPillar, solarTerms: terms,
      engines: [
        { id: "bazi", label: "Bát Tự/Tứ Trụ", status: "review", message: "Chưa kích hoạt trụ tháng/ngày/giờ cho tới khi có bộ fixture tiết khí và chuyên gia kiểm duyệt." },
        { id: "tuvi", label: "Tử Vi Đẩu Số", status: "review", message: "Engine độc lập đang chờ kiểm duyệt phương pháp; không lấy kết quả từ Bát Tự." },
        { id: "fengshui", label: "La bàn phong thủy", status: "local-only", message: "Chỉ đọc hướng khi người dùng cấp quyền cảm biến; không suy đoán vận mệnh." }
      ],
      provenance: createProvenance({ kind: "eastern-calendar", profile, engine: `${ASTRONOMY_VERSION} + Intl Chinese Calendar`, algorithmVersion: "eastern-calendar-v1", method: "Can Chi năm + 24 tiết khí", labels: ["calculation", "symbolic"], input: { date: dateValue } })
    };
  }

  const LENORMAND_36 = Object.freeze(["Kỵ sĩ", "Cỏ bốn lá", "Con thuyền", "Ngôi nhà", "Cây", "Mây", "Rắn", "Quan tài", "Hoa", "Lưỡi hái", "Roi", "Chim", "Đứa trẻ", "Cáo", "Gấu", "Sao", "Cò", "Chó", "Tháp", "Khu vườn", "Núi", "Ngã rẽ", "Chuột", "Trái tim", "Nhẫn", "Sách", "Thư", "Người A", "Người B", "Hoa huệ", "Mặt Trời", "Mặt Trăng", "Chìa khóa", "Cá", "Mỏ neo", "Thập tự"].map((name, index) => Object.freeze({ id: `lenormand-${index + 1}`, number: index + 1, name, symbol: String.fromCodePoint(0x25c7 + index % 4), prompt: `Hình tượng ${name.toLocaleLowerCase("vi")} mời bạn quan sát một dữ kiện, mối liên hệ hoặc lựa chọn cụ thể.` })));
  const RUNES_24 = Object.freeze([["ᚠ", "Fehu"], ["ᚢ", "Uruz"], ["ᚦ", "Thurisaz"], ["ᚨ", "Ansuz"], ["ᚱ", "Raidho"], ["ᚲ", "Kenaz"], ["ᚷ", "Gebo"], ["ᚹ", "Wunjo"], ["ᚺ", "Hagalaz"], ["ᚾ", "Nauthiz"], ["ᛁ", "Isa"], ["ᛃ", "Jera"], ["ᛇ", "Eihwaz"], ["ᛈ", "Perthro"], ["ᛉ", "Algiz"], ["ᛋ", "Sowilo"], ["ᛏ", "Tiwaz"], ["ᛒ", "Berkano"], ["ᛖ", "Ehwaz"], ["ᛗ", "Mannaz"], ["ᛚ", "Laguz"], ["ᛜ", "Ingwaz"], ["ᛞ", "Dagaz"], ["ᛟ", "Othala"]].map(([symbol, name], index) => Object.freeze({ id: `rune-${index + 1}`, number: index + 1, name, symbol, prompt: `Rune ${name} được dùng như câu gợi mở biểu tượng; hãy đối chiếu với trải nghiệm thật.` })));
  const ORACLE_24 = Object.freeze(["Khoảng thở", "Cánh cửa", "Mạch nước", "Sợi chỉ", "Ngọn đồi", "Đốm lửa", "Mầm non", "Bến đỗ", "Làn gió", "Tấm gương", "Dòng chảy", "Chiếc cầu", "Đường chân trời", "Vệt sáng", "Hạt cát", "Vòng tròn", "Tiếng chuông", "Bậc thềm", "Cánh rừng", "Giọt mưa", "Trang giấy", "Ngọn hải đăng", "Mùa chuyển", "Điểm neo"].map((name, index) => Object.freeze({ id: `oracle-${index + 1}`, number: index + 1, name, symbol: ["✦", "◌", "◇", "△"][index % 4], prompt: `${name} gợi một câu hỏi: điều gì có thể được quan sát hoặc thử ở quy mô nhỏ?` })));
  function drawSymbolDeck(typeValue, seedValue, countValue = 1) {
    const type = ["lenormand", "runes", "oracle"].includes(typeValue) ? typeValue : "oracle"; const deck = type === "lenormand" ? LENORMAND_36 : type === "runes" ? RUNES_24 : ORACLE_24;
    const seed = String(seedValue || `${Date.now()}-${Math.random()}`); const random = createRandom(seed); const pool = [...deck];
    for (let index = pool.length - 1; index > 0; index -= 1) { const target = Math.floor(random() * (index + 1)); [pool[index], pool[target]] = [pool[target], pool[index]]; }
    const count = clamp(countValue, 1, Math.min(9, pool.length), 1);
    return { type, seed, cards: pool.slice(0, count), provenance: createProvenance({ kind: type, seed, method: `${type} HH · Fisher-Yates/Mulberry32`, algorithmVersion: `${type}-v1`, labels: ["symbolic"], input: { count } }) };
  }

  const READINESS = Object.freeze([
    { id: "provenance", label: "Accuracy & Provenance", status: "ready" }, { id: "tarot78", label: "Tarot 78", status: "ready" }, { id: "iching", label: "Kinh Dịch nâng cao", status: "ready" },
    { id: "numerology", label: "Thần số học V4", status: "ready" }, { id: "moon-sky", label: "Moon & Sky", status: "ready" }, { id: "eastern-calendar", label: "Can Chi & tiết khí", status: "ready" },
    { id: "bazi", label: "Bát Tự đầy đủ", status: "review" }, { id: "tuvi", label: "Tử Vi Đẩu Số", status: "review" }, { id: "face-palm", label: "Nhân tướng/chỉ tay", status: "disabled" }
  ]);

  return Object.freeze({
    VERSION, CONTENT_VERSION, ASTRONOMY_VERSION, LABELS, ZODIAC_MODES, HOUSE_SYSTEMS, DEFAULT_ORBS, TAROT_78, SPREADS, LENORMAND_36, RUNES_24, ORACLE_24, READINESS,
    clamp, normalizeAngle, hashSeed, createRandom, validDateValue, timeZoneSupported, zoneOffsetMinutes, localInputToInstant, normalizeProfile, createProvenance,
    drawTarot78, tarotStatistics, tarotQuiz, castIChingAdvanced, advancedNumerology, calculateMoonSky, canChiYear, lunarCalendarDate, solarTerms, easternCalendar, drawSymbolDeck
  });
});
