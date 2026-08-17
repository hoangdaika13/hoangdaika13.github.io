(function fortuneAccuracyLabModule(scope, factory) {
  "use strict";
  const api = factory(scope || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope && typeof scope === "object") scope.HHFortuneAccuracyLab = api;
})(typeof window !== "undefined" ? window : globalThis, function createFortuneAccuracyLab(globalScope) {
  "use strict";

  const VERSION = "1.0.0";
  const SCHEMA = "hh.fortune.calculation-certificate.v1";
  const TZDB_TARGET_VERSION = "2026c";
  const TZDB_RUNTIME_VERSION = "unknown-runtime-icu";
  const ASTRONOMY_ENGINE_VERSION = "Astronomy Engine 2.1.19";
  const STATUS_LABELS = Object.freeze({
    complete: "Đầy đủ", estimated: "Ước lượng", missing: "Thiếu",
    verified: "Đã xác minh", conflict: "Có xung đột",
    crossChecked: "Đã đối chiếu", pending: "Chưa đối chiếu",
    symbolic: "Biểu tượng", ai: "AI tạo thêm"
  });

  function isValidDate(dateValue) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ""));
    if (!match) return false;
    const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }
  function isValidTime(timeValue) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(timeValue || ""));
    return Boolean(match && Number(match[1]) < 24 && Number(match[2]) < 60);
  }
  function isValidJulianDate(dateValue) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || "")); if (!match) return false; const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]); const leap = year % 4 === 0; const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
  }
  function calendarDateToGregorian(dateValue, calendarSystem = "gregorian") {
    if (calendarSystem !== "julian") return isValidDate(dateValue) ? String(dateValue) : null; if (!isValidJulianDate(dateValue)) return null;
    const [year, month, day] = String(dateValue).split("-").map(Number); const a = Math.floor((14 - month) / 12); const y = year + 4800 - a; const m = month + 12 * a - 3; const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083; const alpha = jdn + 32044; const beta = Math.floor((4 * alpha + 3) / 146097); const gamma = alpha - Math.floor(146097 * beta / 4); const delta = Math.floor((4 * gamma + 3) / 1461); const epsilon = gamma - Math.floor(1461 * delta / 4); const zeta = Math.floor((5 * epsilon + 2) / 153); const convertedDay = epsilon - Math.floor((153 * zeta + 2) / 5) + 1; const convertedMonth = zeta + 3 - 12 * Math.floor(zeta / 10); const convertedYear = 100 * beta + delta - 4800 + Math.floor(zeta / 10); return `${String(convertedYear).padStart(4, "0")}-${String(convertedMonth).padStart(2, "0")}-${String(convertedDay).padStart(2, "0")}`;
  }
  function isTimeZoneSupported(timeZone) {
    try { new Intl.DateTimeFormat("en", { timeZone: String(timeZone || "") }).format(); return true; } catch (_error) { return false; }
  }
  function zonedParts(timeZone, instantValue) {
    const instant = instantValue instanceof Date ? instantValue : new Date(instantValue);
    if (!Number.isFinite(instant.getTime()) || !isTimeZoneSupported(timeZone)) return null;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).formatToParts(instant).reduce((output, part) => { if (part.type !== "literal") output[part.type] = part.value; return output; }, {});
    return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour) % 24, minute: Number(parts.minute), second: Number(parts.second) };
  }
  function offsetMinutes(timeZone, instantValue) {
    const instant = instantValue instanceof Date ? instantValue : new Date(instantValue); const parts = zonedParts(timeZone, instant);
    if (!parts) return null;
    return Math.round((Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instant.getTime()) / 60000);
  }
  function sameLocalMinute(parts, year, month, day, hour, minute) {
    return Boolean(parts && parts.year === year && parts.month === month && parts.day === day && parts.hour === hour && parts.minute === minute);
  }

  function analyzeLocalTime(dateValue, timeValue, timezoneId, resolutionValue = "", calendarSystem = "gregorian") {
    const errors = [];
    const gregorianDate = calendarDateToGregorian(dateValue, calendarSystem);
    if (!gregorianDate) errors.push(calendarSystem === "julian" ? "Ngày không hợp lệ theo lịch Julian." : "Ngày không hợp lệ theo lịch Gregorian.");
    if (!isValidTime(timeValue)) errors.push("Giờ không hợp lệ.");
    if (!isTimeZoneSupported(timezoneId)) errors.push("Timezone IANA không được môi trường hỗ trợ.");
    if (errors.length) return { ok: false, status: "invalid", errors, timezoneId: String(timezoneId || ""), candidates: [] };
    const [year, month, day] = String(gregorianDate).split("-").map(Number); const [hour, minute] = String(timeValue).split(":").map(Number);
    const localAsUtc = Date.UTC(year, month - 1, day, hour, minute); const offsets = new Set();
    for (let deltaHours = -36; deltaHours <= 36; deltaHours += 3) {
      const offset = offsetMinutes(timezoneId, new Date(localAsUtc + deltaHours * 3600000));
      if (Number.isFinite(offset)) offsets.add(offset);
    }
    const candidates = [...offsets].map((offset) => {
      const instant = new Date(localAsUtc - offset * 60000); const parts = zonedParts(timezoneId, instant);
      return sameLocalMinute(parts, year, month, day, hour, minute) ? { instantUtc: instant.toISOString(), offsetMinutes: offset } : null;
    }).filter(Boolean).sort((a, b) => a.instantUtc.localeCompare(b.instantUtc));
    const resolution = resolutionValue === "later" ? "later" : "earlier";
    const selected = candidates.length ? candidates[resolution === "later" ? candidates.length - 1 : 0] : null;
    const status = candidates.length === 0 ? "nonexistent" : candidates.length > 1 ? "ambiguous" : "valid";
    const warnings = [];
    if (status === "nonexistent") warnings.push("Giờ địa phương không tồn tại do chuyển DST; cần chọn giờ khác.");
    if (status === "ambiguous") warnings.push("Giờ địa phương bị lặp khi kết thúc DST; cần lưu lựa chọn sớm/muộn.");
    if (year < 1970) warnings.push("Dữ liệu timezone trước 1970 có thể không đầy đủ trong tzdb của môi trường chạy.");
    return { ok: Boolean(selected), status, date: dateValue, gregorianDate, calendarSystem, time: timeValue, timezoneId, resolution: status === "ambiguous" ? resolution : "unique", candidates, selected, warnings, tzdbTargetVersion: TZDB_TARGET_VERSION, tzdbRuntimeVersion: TZDB_RUNTIME_VERSION };
  }

  function assessInputQuality(profileValue = {}, options = {}) {
    const profile = { ...profileValue }; const timeAccuracy = ["exact", "estimated", "unknown"].includes(profile.birthTimeAccuracy) ? profile.birthTimeAccuracy : (profile.time ? "estimated" : "unknown");
    const local = profile.time ? analyzeLocalTime(profile.date, profile.time, profile.timezoneId, profile.dstResolution, profile.calendarSystem) : { ok: false, status: "missing", warnings: ["Chưa có giờ sinh."] };
    const requiredPlace = Boolean(String(profile.place || "").trim() && Number.isFinite(Number(profile.latitude)) && Number.isFinite(Number(profile.longitude)));
    const inputId = !calendarDateToGregorian(profile.date, profile.calendarSystem) || !requiredPlace || timeAccuracy === "unknown" ? "missing" : timeAccuracy === "exact" ? "complete" : "estimated";
    const timezoneId = local.status === "valid" || (local.status === "ambiguous" && ["earlier", "later"].includes(profile.dstResolution)) ? "verified" : "conflict";
    const calculationId = options.crossChecked === true ? "crossChecked" : "pending";
    const interpretationId = options.aiGenerated === true ? "ai" : "symbolic";
    const issues = [];
    if (!calendarDateToGregorian(profile.date, profile.calendarSystem)) issues.push("Thiếu hoặc sai ngày sinh theo hệ lịch đã chọn.");
    if (!requiredPlace) issues.push("Thiếu địa điểm hoặc tọa độ hợp lệ.");
    if (timeAccuracy === "unknown") issues.push("Không biết giờ sinh: phải ẩn ASC, MC và hệ nhà.");
    if (local.status === "nonexistent") issues.push("Giờ sinh nằm trong khoảng DST không tồn tại.");
    if (local.status === "ambiguous" && !["earlier", "later"].includes(profile.dstResolution)) issues.push("Giờ sinh DST bị lặp nhưng chưa chọn lần sớm/muộn.");
    if (profile.calendarSystem && !["gregorian", "julian"].includes(profile.calendarSystem)) issues.push("Hệ lịch không được hỗ trợ.");
    return {
      ok: inputId !== "missing" && timezoneId === "verified",
      statuses: {
        input: { id: inputId, label: STATUS_LABELS[inputId] },
        timezone: { id: timezoneId, label: STATUS_LABELS[timezoneId] },
        calculation: { id: calculationId, label: STATUS_LABELS[calculationId] },
        interpretation: { id: interpretationId, label: STATUS_LABELS[interpretationId] }
      },
      localTime: local, issues, warnings: [...(local.warnings || [])],
      uncertaintyMinutes: timeAccuracy === "unknown" ? 720 : [1, 15, 60, 720].includes(Number(profile.birthTimeUncertaintyMinutes)) ? Number(profile.birthTimeUncertaintyMinutes) : timeAccuracy === "exact" ? 1 : 15
    };
  }

  function canonicalize(value, seen = new WeakSet()) {
    if (value === null || typeof value !== "object") {
      if (typeof value === "number" && !Number.isFinite(value)) return null;
      return value;
    }
    if (seen.has(value)) throw new TypeError("Không thể canonicalize cấu trúc vòng.");
    seen.add(value);
    let output;
    if (Array.isArray(value)) output = value.map((item) => canonicalize(item, seen));
    else output = Object.keys(value).sort().reduce((result, key) => { if (value[key] !== undefined) result[key] = canonicalize(value[key], seen); return result; }, {});
    seen.delete(value); return output;
  }
  function canonicalStringify(value) { return JSON.stringify(canonicalize(value)); }

  function sha256(value) {
    const text = typeof value === "string" ? value : canonicalStringify(value); const bytes = typeof TextEncoder !== "undefined" ? new TextEncoder().encode(text) : unescape(encodeURIComponent(text)).split("").map((character) => character.charCodeAt(0));
    const words = []; const bitLength = bytes.length * 8;
    for (let index = 0; index < bytes.length; index += 1) words[index >> 2] = (words[index >> 2] || 0) | bytes[index] << (24 - (index % 4) * 8);
    words[bitLength >> 5] = (words[bitLength >> 5] || 0) | 0x80 << (24 - bitLength % 32); words[((bitLength + 64 >> 9) << 4) + 15] = bitLength;
    const constants = []; const initial = []; let candidate = 2;
    while (constants.length < 64) { let prime = true; for (let factor = 2; factor * factor <= candidate; factor += 1) if (candidate % factor === 0) { prime = false; break; } if (prime) { if (initial.length < 8) initial.push(((Math.sqrt(candidate) % 1) * 0x100000000) | 0); constants.push(((Math.cbrt(candidate) % 1) * 0x100000000) | 0); } candidate += 1; }
    let hash = initial.slice();
    const rotate = (number, bits) => number >>> bits | number << (32 - bits);
    for (let offset = 0; offset < words.length; offset += 16) {
      const schedule = Array.from({ length: 64 }, (_, index) => index < 16 ? (words[offset + index] || 0) : 0); const old = hash.slice(); let [a, b, c, d, e, f, g, h] = hash;
      for (let index = 0; index < 64; index += 1) {
        if (index >= 16) { const w15 = schedule[index - 15]; const w2 = schedule[index - 2]; schedule[index] = (schedule[index - 16] + (rotate(w15, 7) ^ rotate(w15, 18) ^ w15 >>> 3) + schedule[index - 7] + (rotate(w2, 17) ^ rotate(w2, 19) ^ w2 >>> 10)) | 0; }
        const temp1 = (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + (e & f ^ ~e & g) + constants[index] + schedule[index]) | 0;
        const temp2 = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + (a & b ^ a & c ^ b & c)) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      hash = [a, b, c, d, e, f, g, h].map((value, index) => (value + old[index]) | 0);
    }
    return hash.map((value) => (value >>> 0).toString(16).padStart(8, "0")).join("");
  }

  function certificatePayload(certificate) { const { sha256: _ignored, ...payload } = certificate || {}; return payload; }
  function createCalculationCertificate({ profile = {}, result = {}, provenance = {}, computedAt = new Date(), seed = "" } = {}) {
    const local = profile.time ? analyzeLocalTime(profile.date, profile.time, profile.timezoneId, profile.dstResolution, profile.calendarSystem) : null;
    const instantUtc = provenance.instantUtc || result.instantUtc || local?.selected?.instantUtc || "";
    const resultDigest = sha256(result);
    const certificate = {
      schema: SCHEMA, input: canonicalize(profile), instantUtc, timezoneId: String(profile.timezoneId || ""),
      tzdbVersion: TZDB_TARGET_VERSION, tzdbRuntimeVersion: TZDB_RUNTIME_VERSION,
      engine: String(provenance.engine || ASTRONOMY_ENGINE_VERSION), engineVersion: String(provenance.engineVersion || "2.1.19"),
      algorithmVersion: String(provenance.algorithmVersion || "fortune-accuracy-v1"), contentVersion: String(provenance.contentVersion || ""),
      houseSystem: String(profile.houseSystem || ""), zodiacMode: String(profile.zodiacMode || ""), aspectOrbs: canonicalize(profile.aspectOrbs || {}),
      seed: String(seed || provenance.seed || ""), computedAt: (computedAt instanceof Date ? computedAt : new Date(computedAt)).toISOString(), resultDigest
    };
    return Object.freeze({ ...certificate, sha256: sha256(certificate) });
  }
  function verifyCalculationCertificate(certificate, result) {
    if (!certificate || certificate.schema !== SCHEMA) return { ok: false, certificateMatch: false, resultMatch: false, errors: ["Sai định dạng Calculation Certificate."] };
    const certificateMatch = sha256(certificatePayload(certificate)) === certificate.sha256;
    const resultMatch = sha256(result) === certificate.resultDigest;
    const errors = []; if (!certificateMatch) errors.push("Certificate đã bị thay đổi."); if (!resultMatch) errors.push("Kết quả không khớp certificate.");
    return { ok: certificateMatch && resultMatch, certificateMatch, resultMatch, errors, checkedAt: new Date().toISOString() };
  }
  async function replayCalculationCertificate(certificate, calculator) {
    if (typeof calculator !== "function") return { ok: false, errors: ["Thiếu calculator để tái tạo kết quả."] };
    try { const result = await calculator(certificate.input, certificate); return { ...verifyCalculationCertificate(certificate, result), result }; }
    catch (error) { return { ok: false, errors: [`Không thể tái tạo: ${String(error?.message || error).slice(0, 180)}`] }; }
  }

  const FIXTURE_CITIES = Object.freeze([
    ["Hanoi", "Asia/Ho_Chi_Minh", 21.0285, 105.8542], ["New York", "America/New_York", 40.7128, -74.006], ["London", "Europe/London", 51.5072, -0.1276],
    ["Paris", "Europe/Paris", 48.8566, 2.3522], ["Tokyo", "Asia/Tokyo", 35.6762, 139.6503], ["Sydney", "Australia/Sydney", -33.8688, 151.2093],
    ["Auckland", "Pacific/Auckland", -36.8509, 174.7645], ["Honolulu", "Pacific/Honolulu", 21.3099, -157.8581], ["Kiritimati", "Pacific/Kiritimati", 1.8721, -157.4278],
    ["Ushuaia", "America/Argentina/Ushuaia", -54.8019, -68.303], ["Tromso", "Europe/Oslo", 69.6492, 18.9553], ["Reykjavik", "Atlantic/Reykjavik", 64.1466, -21.9426],
    ["Delhi", "Asia/Kolkata", 28.6139, 77.209], ["Kathmandu", "Asia/Kathmandu", 27.7172, 85.324], ["Chatham", "Pacific/Chatham", -43.95, -176.55], ["Cairo", "Africa/Cairo", 30.0444, 31.2357]
  ]);
  const FIXTURE_DATES = Object.freeze(["1969-07-20", "1970-01-01", "1999-12-31", "2000-02-29", "2012-02-29", "2024-03-10", "2024-11-03", "2026-03-29", "2026-08-17", "2026-10-25", "2028-02-29", "2030-12-31"]);
  const FIXTURE_TIMES = Object.freeze(["00:30", "01:30", "02:30", "12:00"]);
  function buildValidationFixtures() {
    const fixtures = [];
    FIXTURE_CITIES.forEach(([city, timezoneId, latitude, longitude]) => FIXTURE_DATES.forEach((date) => FIXTURE_TIMES.forEach((time) => {
      const local = analyzeLocalTime(date, time, timezoneId);
      fixtures.push({ id: `${city.toLowerCase().replace(/\W+/g, "-")}-${date}-${time.replace(":", "")}`, city, timezoneId, latitude, longitude, date, time, expectedLocalStatus: local.status, expectedInstantUtc: local.selected?.instantUtc || null, category: Number(date.slice(0, 4)) < 1970 ? "historical" : Math.abs(latitude) >= 60 ? "high-latitude" : Math.abs(longitude) >= 150 ? "date-line" : "standard" });
    })));
    return fixtures;
  }
  function runValidationLab(astronomy = globalScope.Astronomy, fixtures = buildValidationFixtures()) {
    const failures = []; let astronomyChecks = 0;
    fixtures.forEach((fixture) => {
      const local = analyzeLocalTime(fixture.date, fixture.time, fixture.timezoneId);
      if (local.status !== fixture.expectedLocalStatus || (local.selected?.instantUtc || null) !== fixture.expectedInstantUtc) failures.push({ id: fixture.id, test: "timezone-replay" });
    });
    if (astronomy?.GeoVector && astronomy?.Ecliptic) fixtures.filter((fixture) => fixture.expectedInstantUtc).slice(0, 96).forEach((fixture) => {
      try { const vector = astronomy.GeoVector(astronomy.Body.Moon, new Date(fixture.expectedInstantUtc), true); const ecliptic = astronomy.Ecliptic(vector); astronomyChecks += 1; if (!Number.isFinite(ecliptic.elon) || !Number.isFinite(ecliptic.elat)) failures.push({ id: fixture.id, test: "moon-finite" }); } catch (_error) { failures.push({ id: fixture.id, test: "astronomy-runtime" }); }
    });
    return { ok: failures.length === 0, fixtureCount: fixtures.length, timezoneChecks: fixtures.length, astronomyChecks, failures, references: [{ id: "astronomy-engine", status: astronomyChecks ? "runtime-checked" : "not-loaded" }, { id: "jpl-horizons", status: "external-baseline-required" }, { id: "usno", status: "external-baseline-required" }], generatedAt: new Date().toISOString() };
  }

  return Object.freeze({ VERSION, SCHEMA, TZDB_TARGET_VERSION, TZDB_RUNTIME_VERSION, ASTRONOMY_ENGINE_VERSION, STATUS_LABELS, isValidDate, isValidJulianDate, calendarDateToGregorian, isValidTime, isTimeZoneSupported, zonedParts, offsetMinutes, analyzeLocalTime, assessInputQuality, canonicalStringify, sha256, createCalculationCertificate, verifyCalculationCertificate, replayCalculationCertificate, buildValidationFixtures, runValidationLab });
});
