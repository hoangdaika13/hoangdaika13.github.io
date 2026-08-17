(function fortuneAstrologyV4Module(scope, factory) {
  "use strict";
  const api = factory(scope || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope && typeof scope === "object") scope.HHFortuneAstrologyV4 = api;
})(typeof window !== "undefined" ? window : globalThis, function createFortuneAstrologyV4(globalScope) {
  "use strict";

  const VERSION = "2.1.0";
  const PLANETS = Object.freeze([
    ["Sun", "Mặt Trời", "☉"], ["Moon", "Mặt Trăng", "☽"], ["Mercury", "Sao Thủy", "☿"], ["Venus", "Sao Kim", "♀"], ["Mars", "Sao Hỏa", "♂"],
    ["Jupiter", "Sao Mộc", "♃"], ["Saturn", "Sao Thổ", "♄"], ["Uranus", "Thiên Vương", "♅"], ["Neptune", "Hải Vương", "♆"], ["Pluto", "Diêm Vương", "♇"]
  ]);
  const SIGNS = Object.freeze([
    ["Bạch Dương", "♈", "Lửa", "Tiên phong"], ["Kim Ngưu", "♉", "Đất", "Kiên định"], ["Song Tử", "♊", "Khí", "Linh hoạt"], ["Cự Giải", "♋", "Nước", "Tiên phong"],
    ["Sư Tử", "♌", "Lửa", "Kiên định"], ["Xử Nữ", "♍", "Đất", "Linh hoạt"], ["Thiên Bình", "♎", "Khí", "Tiên phong"], ["Bọ Cạp", "♏", "Nước", "Kiên định"],
    ["Nhân Mã", "♐", "Lửa", "Linh hoạt"], ["Ma Kết", "♑", "Đất", "Tiên phong"], ["Bảo Bình", "♒", "Khí", "Kiên định"], ["Song Ngư", "♓", "Nước", "Linh hoạt"]
  ]);
  const ASPECTS = Object.freeze([
    { id: "conjunction", name: "Đồng vị", angle: 0, symbol: "☌" }, { id: "sextile", name: "Lục hợp", angle: 60, symbol: "⚹" }, { id: "square", name: "Vuông", angle: 90, symbol: "□" },
    { id: "trine", name: "Tam hợp", angle: 120, symbol: "△" }, { id: "opposition", name: "Đối đỉnh", angle: 180, symbol: "☍" }
  ]);
  const SOLAR_ORBS = Object.freeze({ cazimi: 17 / 60, combust: 8.5, underBeams: 17 });
  const HOUSE_SYSTEM_READINESS = Object.freeze([
    { id: "equal", label: "Equal House", status: "ready" }, { id: "whole-sign", label: "Whole Sign", status: "ready" }, { id: "porphyry", label: "Porphyry", status: "ready" },
    { id: "placidus", label: "Placidus", status: "review", reason: "Chưa bật nếu chưa có fixture đối chiếu ở vĩ độ cao." }, { id: "koch", label: "Koch", status: "review", reason: "Chưa bật nếu chưa có fixture đối chiếu độc lập." }
  ]);

  function suite() { return globalScope.HHFortuneSuiteV4 || (typeof require === "function" ? require("./fortune-suite-v4") : null); }
  function normalize(value) { return ((Number(value) % 360) + 360) % 360; }
  function signed(value) { const angle = normalize(value); return angle > 180 ? angle - 360 : angle; }
  function signFor(longitude) { const value = normalize(longitude); const index = Math.floor(value / 30); const [name, symbol, element, modality] = SIGNS[index]; return { index, name, symbol, element, modality, degree: Number((value % 30).toFixed(2)), longitude: Number(value.toFixed(5)) }; }
  function meanObliquity(date) { const t = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000 / 36525; return 23.439291111 - (46.815 * t + .00059 * t * t - .001813 * t * t * t) / 3600; }
  function ayanamshaLahiriApprox(date) { const years = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 31557600000; return 23.8530556 + years * 50.290966 / 3600; }
  function ascendant(date, latitude, longitude, astronomy) {
    const theta = normalize(astronomy.SiderealTime(date) * 15 + longitude) * Math.PI / 180; const epsilon = meanObliquity(date) * Math.PI / 180; const phi = latitude * Math.PI / 180;
    return normalize(Math.atan2(Math.cos(theta), -(Math.sin(theta) * Math.cos(epsilon) + Math.tan(phi) * Math.sin(epsilon))) * 180 / Math.PI);
  }
  function midheaven(date, longitude, astronomy) { const theta = normalize(astronomy.SiderealTime(date) * 15 + longitude) * Math.PI / 180; const epsilon = meanObliquity(date) * Math.PI / 180; return normalize(Math.atan2(Math.sin(theta), Math.cos(theta) * Math.cos(epsilon)) * 180 / Math.PI); }
  function bodyPosition(astronomy, bodyName, date, zodiacMode = "tropical") {
    const vector = astronomy.GeoVector(astronomy.Body[bodyName], date, true); const ecliptic = astronomy.Ecliptic(vector); const tropical = normalize(ecliptic.elon); const shift = zodiacMode === "sidereal" ? ayanamshaLahiriApprox(date) : 0;
    return { longitude: normalize(tropical - shift), tropicalLongitude: tropical, latitude: Number(ecliptic.elat.toFixed(5)), distanceAu: Number(Math.sqrt(vector.x ** 2 + vector.y ** 2 + vector.z ** 2).toFixed(7)) };
  }
  function planetMotion(astronomy, bodyName, date, zodiacMode) {
    const before = bodyPosition(astronomy, bodyName, new Date(date.getTime() - 43200000), zodiacMode).longitude; const after = bodyPosition(astronomy, bodyName, new Date(date.getTime() + 43200000), zodiacMode).longitude;
    const speedDegreesPerDay = signed(after - before); const stationThreshold = ["Uranus", "Neptune", "Pluto"].includes(bodyName) ? 0.015 : ["Jupiter", "Saturn"].includes(bodyName) ? 0.03 : 0.05;
    const station = !["Sun", "Moon"].includes(bodyName) && Math.abs(speedDegreesPerDay) <= stationThreshold;
    return { speedDegreesPerDay: Number(speedDegreesPerDay.toFixed(5)), retrograde: !["Sun", "Moon"].includes(bodyName) && speedDegreesPerDay < 0, station, direction: station ? "station" : speedDegreesPerDay < 0 ? "retrograde" : "direct" };
  }
  function houseCusps(asc, system, mc = normalize(asc + 270)) {
    const start = system === "whole-sign" ? Math.floor(normalize(asc) / 30) * 30 : normalize(asc);
    if (system !== "porphyry") return Array.from({ length: 12 }, (_, index) => normalize(start + index * 30));
    const anchors = [normalize(asc), normalize(mc + 180), normalize(asc + 180), normalize(mc)]; const cusps = [];
    for (let quadrant = 0; quadrant < 4; quadrant += 1) { const from = anchors[quadrant]; const to = anchors[(quadrant + 1) % 4]; const arc = normalize(to - from); for (let step = 0; step < 3; step += 1) cusps.push(normalize(from + arc * step / 3)); }
    return cusps;
  }
  function houseFor(longitude, cusps) { for (let index = 0; index < 12; index += 1) { const arc = normalize(cusps[(index + 1) % 12] - cusps[index]); if (normalize(longitude - cusps[index]) < arc) return index + 1; } return 1; }
  function calculateAspects(firstPlanets, secondPlanets = firstPlanets, orbs = {}) {
    const output = []; const same = firstPlanets === secondPlanets;
    for (let first = 0; first < firstPlanets.length; first += 1) for (let second = same ? first + 1 : 0; second < secondPlanets.length; second += 1) {
      const separation = Math.abs(signed(firstPlanets[first].longitude - secondPlanets[second].longitude));
      ASPECTS.forEach((aspect) => {
        const delta = Math.abs(separation - aspect.angle); const orb = Number(orbs[aspect.id] ?? ({ conjunction: 8, sextile: 5, square: 7, trine: 7, opposition: 8 })[aspect.id]);
        if (delta <= orb) {
          const firstSpeed = Number(firstPlanets[first].speedDegreesPerDay || 0); const secondSpeed = Number(secondPlanets[second].speedDegreesPerDay || 0); const futureSeparation = Math.abs(signed((firstPlanets[first].longitude + firstSpeed / 24) - (secondPlanets[second].longitude + secondSpeed / 24))); const futureExactness = Math.abs(futureSeparation - aspect.angle); const applying = Math.abs(futureExactness - delta) < 0.00001 ? null : futureExactness < delta; const relativeSpeed = Math.abs(firstSpeed - secondSpeed); const hoursToExact = applying && relativeSpeed > 0.0001 ? delta / relativeSpeed * 24 : null;
          output.push({ first: firstPlanets[first].name, firstBody: firstPlanets[first].body, second: secondPlanets[second].name, secondBody: secondPlanets[second].body, ...aspect, orb, separation: Number(separation.toFixed(2)), exactness: Number(delta.toFixed(2)), applying, phase: applying === null ? "undetermined" : applying ? "applying" : "separating", hoursToExact: hoursToExact !== null && hoursToExact <= 8760 ? Number(hoursToExact.toFixed(2)) : null });
        }
      });
    }
    return output.sort((a, b) => a.exactness - b.exactness);
  }
  function meanNodeLongitude(date) { const t = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000 / 36525; return normalize(125.04452 - 1934.136261 * t + .0020708 * t * t + t * t * t / 450000); }
  function meanLilithLongitude(date) { const t = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000 / 36525; return normalize(83.3532465 + 4069.0137287 * t - .01032 * t * t - t * t * t / 80053); }
  function profileInstant(profile) {
    const helper = suite(); if (helper?.localInputToInstant && profile.timezoneId) return helper.localInputToInstant(profile.date, profile.time, profile.timezoneId, profile.calendarSystem, profile.dstResolution);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(profile.date || "")) || !/^\d{2}:\d{2}$/.test(String(profile.time || ""))) return null;
    const [year, month, day] = profile.date.split("-").map(Number); const [hour, minute] = profile.time.split(":").map(Number); return new Date(Date.UTC(year, month - 1, day, hour, minute) - Number(profile.timezone || 0) * 3600000);
  }
  function distributions(planets) {
    const elements = { Lửa: 0, Đất: 0, Khí: 0, Nước: 0 }; const modalities = { "Tiên phong": 0, "Kiên định": 0, "Linh hoạt": 0 }; const hemispheres = { east: 0, west: 0, upper: 0, lower: 0 };
    let houseCount = 0; planets.forEach((planet) => { elements[planet.sign.element] += 1; modalities[planet.sign.modality] += 1; if (Number.isInteger(planet.house)) { houseCount += 1; if (planet.house >= 7) hemispheres.upper += 1; else hemispheres.lower += 1; if ([10, 11, 12, 1, 2, 3].includes(planet.house)) hemispheres.east += 1; else hemispheres.west += 1; } });
    return { elements, modalities, hemispheres: houseCount ? hemispheres : null };
  }
  function solarCondition(longitude, sunLongitude, body) {
    if (["Sun", "Moon"].includes(body)) return null; const distance = Math.abs(signed(longitude - sunLongitude));
    if (distance <= SOLAR_ORBS.cazimi) return { id: "cazimi", label: "Cazimi", distance: Number(distance.toFixed(4)), orb: SOLAR_ORBS.cazimi };
    if (distance <= SOLAR_ORBS.combust) return { id: "combust", label: "Combust", distance: Number(distance.toFixed(4)), orb: SOLAR_ORBS.combust };
    if (distance <= SOLAR_ORBS.underBeams) return { id: "under-beams", label: "Under the beams", distance: Number(distance.toFixed(4)), orb: SOLAR_ORBS.underBeams };
    return null;
  }
  function calculateUntimedChart(profileValue, astronomy = globalScope.Astronomy) {
    const helper = suite(); const profile = helper?.normalizeProfile ? helper.normalizeProfile({ ...profileValue, time: "12:00", birthTimeAccuracy: "unknown", birthTimeUncertaintyMinutes: 720 }) : { ...profileValue, time: "12:00", birthTimeAccuracy: "unknown" };
    const instant = helper?.localInputToInstant?.(profile.date, "12:00", profile.timezoneId, profile.calendarSystem, profile.dstResolution); const errors = [];
    if (!profile.date || !instant) errors.push("Cần ngày sinh và timezone IANA hợp lệ."); if (!astronomy?.GeoVector || !astronomy?.Ecliptic) errors.push("Astronomy Engine chưa được tải."); if (errors.length) return { ok: false, errors };
    try {
      let planets = PLANETS.map(([body, name, symbol]) => { const position = bodyPosition(astronomy, body, instant, profile.zodiacMode); return { body, name, symbol, ...position, sign: signFor(position.longitude), ...planetMotion(astronomy, body, instant, profile.zodiacMode), house: null }; });
      const sunLongitude = planets.find((planet) => planet.body === "Sun").longitude; planets = planets.map((planet) => ({ ...planet, solarCondition: solarCondition(planet.longitude, sunLongitude, planet.body) }));
      const start = helper.localInputToInstant(profile.date, "00:00", profile.timezoneId, profile.calendarSystem, profile.dstResolution) || instant; const end = helper.localInputToInstant(profile.date, "23:59", profile.timezoneId, profile.calendarSystem, profile.dstResolution) || instant;
      const dailyRanges = PLANETS.map(([body, name]) => { const from = bodyPosition(astronomy, body, start, profile.zodiacMode).longitude; const to = bodyPosition(astronomy, body, end, profile.zodiacMode).longitude; return { body, name, from: signFor(from), to: signFor(to), spanDegrees: Number(Math.abs(signed(to - from)).toFixed(4)) }; });
      return { ok: true, mode: "untimed", instantUtc: instant.toISOString(), representativeTime: "12:00 local", profile: { ...profile, time: "", birthTimeAccuracy: "unknown" }, planets, points: [], houses: [], ascendant: null, midheaven: null, dailyRanges, aspects: calculateAspects(planets, planets, profile.aspectOrbs), distributions: distributions(planets), limitations: ["Không biết giờ sinh: không tính ASC, MC, nhà, Part of Fortune hoặc các kỹ thuật phụ thuộc nhà.", "Vị trí 12:00 chỉ là đại diện; hãy xem khoảng biến thiên cả ngày."], method: { ephemeris: "Astronomy Engine 2.1.19", zodiac: profile.zodiacMode === "sidereal" ? "Sidereal · Lahiri xấp xỉ" : "Tropical", houses: "Disabled — unknown birth time", solarOrbs: SOLAR_ORBS }, provenance: helper?.createProvenance?.({ kind: "astrology-untimed", profile, engine: "Astronomy Engine 2.1.19", algorithmVersion: "astrology-untimed-v1", method: `${profile.zodiacMode}/no-houses`, labels: ["calculation", "symbolic"] }) || null };
    } catch (error) { return { ok: false, errors: [`Không thể tính biểu đồ không giờ sinh: ${String(error?.message || error).slice(0, 180)}`] }; }
  }
  function calculateChart(profileValue, astronomy = globalScope.Astronomy, instantOverride = null) {
    const helper = suite(); const profile = helper?.normalizeProfile ? helper.normalizeProfile(profileValue) : { ...profileValue }; const instant = instantOverride || profileInstant(profile);
    if (!instantOverride && (profile.birthTimeAccuracy === "unknown" || !profile.time)) return calculateUntimedChart(profileValue, astronomy);
    const errors = []; if (!instant || !Number.isFinite(instant.getTime())) errors.push("Cần ngày, giờ và múi giờ IANA hợp lệ."); if (!astronomy?.GeoVector || !astronomy?.Ecliptic || !astronomy?.SiderealTime) errors.push("Astronomy Engine chưa được tải."); if (errors.length) return { ok: false, errors };
    try {
      const tropicalAsc = ascendant(instant, profile.latitude, profile.longitude, astronomy); const tropicalMc = midheaven(instant, profile.longitude, astronomy); const shift = profile.zodiacMode === "sidereal" ? ayanamshaLahiriApprox(instant) : 0; const asc = normalize(tropicalAsc - shift); const mc = normalize(tropicalMc - shift); const cusps = houseCusps(asc, profile.houseSystem, mc);
      let planets = PLANETS.map(([body, name, symbol]) => { const position = bodyPosition(astronomy, body, instant, profile.zodiacMode); return { body, name, symbol, ...position, sign: signFor(position.longitude), house: houseFor(position.longitude, cusps), ...planetMotion(astronomy, body, instant, profile.zodiacMode) }; });
      const sunLongitude = planets.find((planet) => planet.body === "Sun").longitude; planets = planets.map((planet) => ({ ...planet, solarCondition: solarCondition(planet.longitude, sunLongitude, planet.body) }));
      const northNode = meanNodeLongitude(instant); const lilith = meanLilithLongitude(instant); const sun = planets.find((planet) => planet.body === "Sun"); const moon = planets.find((planet) => planet.body === "Moon"); const isDay = sun.house >= 7; const partOfFortune = normalize(asc + (isDay ? moon.longitude - sun.longitude : sun.longitude - moon.longitude));
      const points = [{ body: "NorthNode", name: "Nút Bắc (trung bình)", symbol: "☊", longitude: northNode, sign: signFor(northNode), house: houseFor(northNode, cusps), retrograde: true }, { body: "SouthNode", name: "Nút Nam", symbol: "☋", longitude: normalize(northNode + 180), sign: signFor(northNode + 180), house: houseFor(northNode + 180, cusps), retrograde: true }, { body: "Lilith", name: "Lilith trung bình", symbol: "⚸", longitude: lilith, sign: signFor(lilith), house: houseFor(lilith, cusps), retrograde: false }, { body: "Fortune", name: "Part of Fortune", symbol: "⊗", longitude: partOfFortune, sign: signFor(partOfFortune), house: houseFor(partOfFortune, cusps), retrograde: false }];
      return {
        ok: true, mode: "natal", instantUtc: instant.toISOString(), profile, ascendant: signFor(asc), midheaven: signFor(mc), houses: cusps.map((longitude, index) => ({ house: index + 1, longitude, sign: signFor(longitude) })), planets, points,
        aspects: calculateAspects(planets, planets, profile.aspectOrbs), distributions: distributions(planets), unsupported: [{ id: "chiron", label: "Chiron", status: "not-calculated", reason: "Astronomy Engine không cung cấp quỹ đạo Chiron; không tạo dữ liệu thay thế." }, { id: "true-node", label: "True Node", status: "not-calculated", reason: "Chỉ hiển thị Mean Node cho tới khi có ephemeris và fixture True Node được xác minh." }],
        method: { ephemeris: "Astronomy Engine 2.1.19", zodiac: profile.zodiacMode === "sidereal" ? `Sidereal · Lahiri xấp xỉ ${shift.toFixed(4)}°` : "Tropical", houses: profile.houseSystem === "whole-sign" ? "Whole Sign" : profile.houseSystem === "porphyry" ? "Porphyry" : "Equal House", nodes: "Mean lunar node formula", lilith: "Mean lunar apogee formula", solarOrbs: SOLAR_ORBS },
        provenance: helper?.createProvenance?.({ kind: "astrology-natal", profile, engine: "Astronomy Engine 2.1.19", algorithmVersion: "astrology-v4", method: `${profile.zodiacMode}/${profile.houseSystem}`, labels: ["calculation", "symbolic"] }) || null
      };
    } catch (error) { return { ok: false, errors: [`Không thể tính bản đồ sao: ${String(error?.message || error).slice(0, 180)}`] }; }
  }
  function transitChart(profile, targetDate, astronomy = globalScope.Astronomy) {
    const natal = calculateChart(profile, astronomy); const target = targetDate instanceof Date ? targetDate : new Date(targetDate); if (!natal.ok || !Number.isFinite(target.getTime())) return { ok: false, errors: natal.errors || ["Ngày transit không hợp lệ."] };
    const transitPlanets = PLANETS.map(([body, name, symbol]) => { const position = bodyPosition(astronomy, body, target, natal.profile.zodiacMode); return { body, name: `Transit ${name}`, symbol, ...position, sign: signFor(position.longitude), ...planetMotion(astronomy, body, target, natal.profile.zodiacMode) }; });
    return { ok: true, mode: "transit", targetUtc: target.toISOString(), natal, transitPlanets, aspects: calculateAspects(transitPlanets, natal.planets, natal.profile.aspectOrbs).slice(0, 40), provenance: suite()?.createProvenance?.({ kind: "astrology-transit", profile: natal.profile, engine: "Astronomy Engine 2.1.19", algorithmVersion: "transit-v1", method: "Transit-to-natal aspects", labels: ["calculation", "symbolic"], input: { targetUtc: target.toISOString() } }) };
  }
  function compositeChart(firstProfile, secondProfile, astronomy = globalScope.Astronomy) {
    const first = calculateChart(firstProfile, astronomy); const second = calculateChart(secondProfile, astronomy); if (!first.ok || !second.ok) return { ok: false, errors: [...(first.errors || []), ...(second.errors || [])] };
    const planets = first.planets.map((planet, index) => { const other = second.planets[index]; const longitude = normalize(planet.longitude + signed(other.longitude - planet.longitude) / 2); const speedDegreesPerDay = Number(((Number(planet.speedDegreesPerDay || 0) + Number(other.speedDegreesPerDay || 0)) / 2).toFixed(5)); return { body: planet.body, name: planet.name, symbol: planet.symbol, longitude, speedDegreesPerDay, sign: signFor(longitude), house: null }; });
    return { ok: true, mode: "composite", planets, houses: [], aspects: calculateAspects(planets), method: "Circular midpoint composite; không trộn với Davison.", provenance: suite()?.createProvenance?.({ kind: "astrology-composite", profile: first.profile, engine: "Astronomy Engine 2.1.19", algorithmVersion: "composite-v1", method: "Circular midpoint of paired longitudes", labels: ["calculation", "symbolic"], input: { secondProfileProvided: true } }) };
  }
  function davisonChart(firstProfile, secondProfile, astronomy = globalScope.Astronomy) {
    const helper = suite(); const first = helper?.normalizeProfile ? helper.normalizeProfile(firstProfile) : { ...firstProfile }; const second = helper?.normalizeProfile ? helper.normalizeProfile(secondProfile) : { ...secondProfile }; const firstInstant = profileInstant(first); const secondInstant = profileInstant(second);
    if (!firstInstant || !secondInstant) return { ok: false, errors: ["Davison cần ngày và giờ hợp lệ của cả hai hồ sơ."] };
    const instant = new Date((firstInstant.getTime() + secondInstant.getTime()) / 2); const longitude = normalize(first.longitude + signed(second.longitude - first.longitude) / 2); const latitude = (Number(first.latitude) + Number(second.latitude)) / 2;
    const chart = calculateChart({ ...first, place: `Davison · ${first.place || "A"} + ${second.place || "B"}`, latitude, longitude, birthTimeAccuracy: "exact" }, astronomy, instant);
    return chart.ok ? { ...chart, mode: "davison", midpoint: { instantUtc: instant.toISOString(), latitude: Number(latitude.toFixed(5)), longitude: Number(longitude.toFixed(5)) }, provenance: helper?.createProvenance?.({ kind: "astrology-davison", profile: chart.profile, engine: "Astronomy Engine 2.1.19", algorithmVersion: "davison-v1", method: "Midpoint in UTC time and geographic coordinates", labels: ["calculation", "symbolic"], input: { secondProfileProvided: true } }) || null } : chart;
  }
  function synastry(firstProfile, secondProfile, astronomy = globalScope.Astronomy) {
    const first = calculateChart(firstProfile, astronomy); const second = calculateChart(secondProfile, astronomy); if (!first.ok || !second.ok) return { ok: false, errors: [...(first.errors || []), ...(second.errors || [])] };
    const composite = compositeChart(firstProfile, secondProfile, astronomy); const davison = davisonChart(firstProfile, secondProfile, astronomy);
    return { ok: true, mode: "synastry", first, second, aspects: calculateAspects(first.planets, second.planets, first.profile.aspectOrbs).slice(0, 50), composite, davison, provenance: suite()?.createProvenance?.({ kind: "astrology-synastry", profile: first.profile, engine: "Astronomy Engine 2.1.19", algorithmVersion: "synastry-v2", method: "Cross aspects; Composite và Davison là hai phép tính riêng", labels: ["calculation", "symbolic"], input: { secondProfileProvided: true } }) };
  }
  function birthTimeRange(profileValue, uncertaintyMinutes = 15, astronomy = globalScope.Astronomy) {
    const base = calculateChart({ ...profileValue, birthTimeAccuracy: profileValue.birthTimeAccuracy === "unknown" ? "unknown" : "estimated" }, astronomy); const minutes = [15, 30, 60].includes(Number(uncertaintyMinutes)) ? Number(uncertaintyMinutes) : 15;
    if (!base.ok || base.mode === "untimed") return { ok: false, errors: base.errors || ["Birth-time range cần một giờ sinh ước lượng."] };
    const center = new Date(base.instantUtc); const before = calculateChart(base.profile, astronomy, new Date(center.getTime() - minutes * 60000)); const after = calculateChart(base.profile, astronomy, new Date(center.getTime() + minutes * 60000));
    const planetChanges = base.planets.map((planet, index) => ({ body: planet.body, name: planet.name, centerHouse: planet.house, beforeHouse: before.planets[index].house, afterHouse: after.planets[index].house, houseChanges: new Set([planet.house, before.planets[index].house, after.planets[index].house]).size > 1 }));
    return { ok: true, mode: "birth-time-range", uncertaintyMinutes: minutes, rangeUtc: { from: before.instantUtc, center: base.instantUtc, to: after.instantUtc }, ascendantRange: { from: before.ascendant, center: base.ascendant, to: after.ascendant }, midheavenRange: { from: before.midheaven, center: base.midheaven, to: after.midheaven }, planetChanges, affected: planetChanges.filter((item) => item.houseChanges), note: "Khoảng biến thiên kỹ thuật; không phải phép hiệu chỉnh giờ sinh." };
  }
  function compareChartMethods(profile, astronomy = globalScope.Astronomy) {
    const combinations = []; for (const zodiacMode of ["tropical", "sidereal"]) for (const houseSystem of ["equal", "whole-sign", "porphyry"]) { const chart = calculateChart({ ...profile, zodiacMode, houseSystem }, astronomy); combinations.push({ zodiacMode, houseSystem, chart }); }
    return { ok: combinations.every((item) => item.chart.ok), combinations, houseSystems: HOUSE_SYSTEM_READINESS, note: "Các phương pháp được đặt cạnh nhau; hệ thống không chọn một trường phái là đúng tuyệt đối." };
  }
  function transitTimeline(profile, startValue, daysValue = 30, astronomy = globalScope.Astronomy) {
    const natal = calculateChart(profile, astronomy); const start = new Date(startValue); const days = Math.max(1, Math.min(366, Number(daysValue) || 30)); if (!natal.ok || !Number.isFinite(start.getTime())) return { ok: false, errors: natal.errors || ["Ngày bắt đầu không hợp lệ."] };
    const events = []; let previous = null; const seen = new Set();
    for (let hours = 0; hours <= days * 24; hours += 6) {
      const instant = new Date(start.getTime() + hours * 3600000); const planets = PLANETS.map(([body, name, symbol]) => { const position = bodyPosition(astronomy, body, instant, natal.profile.zodiacMode); return { body, name, symbol, ...position, sign: signFor(position.longitude), ...planetMotion(astronomy, body, instant, natal.profile.zodiacMode) }; });
      if (previous) planets.forEach((planet, index) => { const prior = previous.planets[index]; if (planet.sign.index !== prior.sign.index) events.push({ type: "ingress", instantUtc: instant.toISOString(), body: planet.body, label: `${planet.name} vào ${planet.sign.name}`, fromSign: prior.sign.name, toSign: planet.sign.name }); if (planet.direction !== prior.direction && (planet.direction === "station" || prior.direction === "station" || planet.retrograde !== prior.retrograde)) events.push({ type: "station", instantUtc: instant.toISOString(), body: planet.body, label: `${planet.name} đổi trạng thái ${prior.direction} → ${planet.direction}`, direction: planet.direction }); });
      calculateAspects(planets, natal.planets, natal.profile.aspectOrbs).filter((aspect) => aspect.exactness <= 0.25).forEach((aspect) => { const key = `${instant.toISOString().slice(0, 10)}|${aspect.firstBody}|${aspect.id}|${aspect.secondBody}`; if (!seen.has(key)) { seen.add(key); events.push({ type: "exact-aspect-window", instantUtc: instant.toISOString(), label: `${aspect.first} ${aspect.name} ${aspect.second}`, ...aspect }); } });
      previous = { instant, planets };
    }
    events.sort((a, b) => a.instantUtc.localeCompare(b.instantUtc)); return { ok: true, mode: "transit-timeline", startUtc: start.toISOString(), endUtc: new Date(start.getTime() + days * 86400000).toISOString(), days, events, alertsEnabled: false, resolutionHours: 6, note: "Mốc exact-aspect là cửa sổ quét 6 giờ; cần root-search riêng nếu dùng thời điểm đến phút." };
  }
  function progressedChart(profile, targetDateValue, astronomy = globalScope.Astronomy) {
    const natal = calculateChart(profile, astronomy); const target = new Date(targetDateValue); if (!natal.ok || !Number.isFinite(target.getTime())) return { ok: false, errors: natal.errors || ["Ngày progression không hợp lệ."] };
    const birth = new Date(natal.instantUtc); const ageYears = (target - birth) / 31557600000; const progressedInstant = new Date(birth.getTime() + ageYears * 86400000); const progressed = calculateChart(natal.profile, astronomy, progressedInstant); const solarArc = signed(progressed.planets.find((planet) => planet.body === "Sun").longitude - natal.planets.find((planet) => planet.body === "Sun").longitude);
    const solarArcPlanets = natal.planets.map((planet) => { const longitude = normalize(planet.longitude + solarArc); return { ...planet, longitude, sign: signFor(longitude) }; });
    return { ok: true, mode: "progression", targetUtc: target.toISOString(), ageYears: Number(ageYears.toFixed(4)), progressedInstantUtc: progressedInstant.toISOString(), natal, progressed, secondaryAspects: calculateAspects(progressed.planets, natal.planets, natal.profile.aspectOrbs).slice(0, 40), solarArcDegrees: Number(solarArc.toFixed(4)), solarArcPlanets, solarArcAspects: calculateAspects(solarArcPlanets, natal.planets, natal.profile.aspectOrbs).slice(0, 40), provenance: suite()?.createProvenance?.({ kind: "astrology-progression", profile: natal.profile, engine: "Astronomy Engine 2.1.19", algorithmVersion: "progression-v1", method: "Secondary progression 1 day = 1 tropical year + solar arc", labels: ["calculation", "symbolic"], input: { targetUtc: target.toISOString() } }) };
  }
  function searchReturn(profile, targetDateValue, bodyName = "Sun", astronomy = globalScope.Astronomy) {
    const natal = calculateChart(profile, astronomy); let target = new Date(targetDateValue); if (!natal.ok || !Number.isFinite(target.getTime()) || !["Sun", "Moon"].includes(bodyName)) return { ok: false, errors: natal.errors || ["Dữ liệu return không hợp lệ."] };
    const natalLongitude = natal.planets.find((planet) => planet.body === bodyName).longitude; const maxDays = bodyName === "Moon" ? 35 : 380; const stepHours = bodyName === "Moon" ? 4 : 24; let previous = target; let previousDelta = signed(bodyPosition(astronomy, bodyName, previous, natal.profile.zodiacMode).longitude - natalLongitude);
    for (let hours = stepHours; hours <= maxDays * 24; hours += stepHours) { const current = new Date(target.getTime() + hours * 3600000); const delta = signed(bodyPosition(astronomy, bodyName, current, natal.profile.zodiacMode).longitude - natalLongitude); if ((previousDelta <= 0 && delta >= 0) || Math.abs(delta - previousDelta) > 300) { let low = previous; let high = current; for (let iteration = 0; iteration < 32; iteration += 1) { const mid = new Date((low.getTime() + high.getTime()) / 2); const midDelta = signed(bodyPosition(astronomy, bodyName, mid, natal.profile.zodiacMode).longitude - natalLongitude); if (midDelta >= 0) high = mid; else low = mid; } const returnInstant = new Date((low.getTime() + high.getTime()) / 2); return { ok: true, body: bodyName, returnUtc: returnInstant.toISOString(), chart: calculateChart(natal.profile, astronomy, returnInstant), provenance: suite()?.createProvenance?.({ kind: bodyName === "Sun" ? "solar-return" : "lunar-return", profile: natal.profile, engine: "Astronomy Engine 2.1.19", algorithmVersion: "return-search-v1", method: "Root search of natal ecliptic longitude", labels: ["calculation", "symbolic"], input: { searchStart: target.toISOString() } }) }; } previous = current; previousDelta = delta; }
    return { ok: false, errors: ["Không tìm thấy return trong khoảng tìm kiếm."] };
  }
  function relocationChart(profile, location, astronomy = globalScope.Astronomy) { const merged = { ...profile, place: location.place || profile.place, latitude: Number(location.latitude), longitude: Number(location.longitude) }; const chart = calculateChart(merged, astronomy); if (chart.ok && chart.mode === "untimed") return { ok: false, errors: ["Relocation Chart cần giờ sinh; chế độ không biết giờ chỉ hiển thị hành tinh."] }; return chart.ok ? { ...chart, mode: "relocation", provenance: suite()?.createProvenance?.({ kind: "relocation", profile: merged, engine: "Astronomy Engine 2.1.19", algorithmVersion: "relocation-v1", method: "Same UTC instant, relocated observer", labels: ["calculation", "symbolic"] }) } : chart; }
  function astrocartography(profile, astronomy = globalScope.Astronomy) {
    const chart = calculateChart(profile, astronomy); if (!chart.ok) return chart; if (chart.mode === "untimed") return { ok: false, errors: ["Astrocartography cần giờ sinh chính xác hoặc ước lượng; không tự dùng 12:00 khi chưa biết giờ."] }; const instant = new Date(chart.instantUtc); const gstDegrees = astronomy.SiderealTime(instant) * 15; const observer = new astronomy.Observer(0, 0, 0);
    const lines = PLANETS.map(([body, name, symbol]) => { const equ = astronomy.Equator(astronomy.Body[body], instant, observer, true, true); const mc = signed(equ.ra * 15 - gstDegrees); const asc = []; const desc = []; for (let latitude = -60; latitude <= 60; latitude += 10) { const phi = latitude * Math.PI / 180; const dec = equ.dec * Math.PI / 180; const cosH = -Math.tan(phi) * Math.tan(dec); if (Math.abs(cosH) <= 1) { const h = Math.acos(cosH) * 180 / Math.PI; asc.push({ latitude, longitude: signed((equ.ra * 15 - h) - gstDegrees) }); desc.push({ latitude, longitude: signed((equ.ra * 15 + h) - gstDegrees) }); } } return { body, name, symbol, mcLongitude: mc, icLongitude: signed(mc + 180), asc, desc }; });
    return { ok: true, mode: "astrocartography", instantUtc: chart.instantUtc, lines, note: "MC/IC là kinh tuyến góc; ASC/DSC là đường xấp xỉ theo lưới vĩ độ 10°. Không dùng cho điều hướng.", provenance: suite()?.createProvenance?.({ kind: "astrocartography", profile: chart.profile, engine: "Astronomy Engine 2.1.19", algorithmVersion: "astrocartography-v1", method: "RA/Dec angular lines on Earth grid", labels: ["calculation", "symbolic"] }) };
  }

  return Object.freeze({ VERSION, PLANETS, SIGNS, ASPECTS, SOLAR_ORBS, HOUSE_SYSTEM_READINESS, normalize, signFor, ayanamshaLahiriApprox, calculateAspects, calculateUntimedChart, calculateChart, transitChart, transitTimeline, birthTimeRange, compareChartMethods, compositeChart, davisonChart, synastry, progressedChart, searchReturn, relocationChart, astrocartography });
});
