const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
globalThis.HHFortuneSuiteV4 = require(path.join(root, "fortune-suite-v4.js"));
const astrology = require(path.join(root, "fortune-astrology-v4.js"));
const Astronomy = require("astronomy-engine");

const profile = {
  date: "2003-08-13", time: "08:30", place: "Hà Nội",
  timezoneId: "Asia/Ho_Chi_Minh", latitude: 21.0285, longitude: 105.8542, elevation: 12,
  zodiacMode: "tropical", houseSystem: "equal",
  aspectOrbs: { conjunction: 8, sextile: 5, square: 7, trine: 7, opposition: 8 }
};

test("Astrology V4 calculates natal planets, points, houses and provenance", () => {
  const chart = astrology.calculateChart(profile, Astronomy);
  assert.equal(chart.ok, true);
  assert.equal(chart.planets.length, 10);
  assert.equal(chart.points.length, 4);
  assert.equal(chart.houses.length, 12);
  assert.ok(chart.ascendant.longitude >= 0 && chart.ascendant.longitude < 360);
  assert.ok(chart.midheaven.longitude >= 0 && chart.midheaven.longitude < 360);
  assert.equal(chart.provenance.kind, "astrology-natal");
  assert.equal(chart.provenance.input.timezoneId, "Asia/Ho_Chi_Minh");
  assert.deepEqual(chart.unsupported, [{ id: "chiron", label: "Chiron", status: "not-calculated", reason: "Astronomy Engine không cung cấp quỹ đạo Chiron; không tạo dữ liệu thay thế." }]);
});

test("Whole Sign and Equal House stay separate", () => {
  const equal = astrology.calculateChart({ ...profile, houseSystem: "equal" }, Astronomy);
  const whole = astrology.calculateChart({ ...profile, houseSystem: "whole-sign" }, Astronomy);
  assert.equal(equal.ok, true);
  assert.equal(whole.ok, true);
  assert.notDeepEqual(equal.houses.map((house) => house.longitude), whole.houses.map((house) => house.longitude));
  assert.equal(equal.profile.houseSystem, "equal");
  assert.equal(whole.profile.houseSystem, "whole-sign");
});

test("Tropical and sidereal calculations disclose their different longitude frames", () => {
  const tropical = astrology.calculateChart({ ...profile, zodiacMode: "tropical" }, Astronomy);
  const sidereal = astrology.calculateChart({ ...profile, zodiacMode: "sidereal" }, Astronomy);
  assert.equal(tropical.ok, true);
  assert.equal(sidereal.ok, true);
  const tropicalSun = tropical.planets.find((planet) => planet.body === "Sun");
  const siderealSun = sidereal.planets.find((planet) => planet.body === "Sun");
  assert.ok(Math.abs(tropicalSun.longitude - siderealSun.longitude) > 20);
  assert.match(sidereal.method.zodiac, /Lahiri/i);
});

test("transit, progression and return tools use real timestamps", () => {
  const transit = astrology.transitChart(profile, "2026-08-17T12:00:00Z", Astronomy);
  const progression = astrology.progressedChart(profile, "2026-08-17T12:00:00Z", Astronomy);
  const solarReturn = astrology.searchReturn(profile, "2026-01-01T00:00:00Z", "Sun", Astronomy);
  const lunarReturn = astrology.searchReturn(profile, "2026-08-01T00:00:00Z", "Moon", Astronomy);
  assert.equal(transit.ok, true);
  assert.equal(transit.transitPlanets.length, 10);
  assert.equal(progression.ok, true);
  assert.equal(progression.progressed.ok, true);
  assert.equal(progression.solarArcPlanets.length, 10);
  assert.equal(solarReturn.ok, true);
  assert.equal(solarReturn.chart.ok, true);
  assert.equal(lunarReturn.ok, true);
  assert.match(solarReturn.returnUtc, /^2026-/);
});

test("synastry includes cross aspects and a circular midpoint composite without scoring", () => {
  const second = { ...profile, date: "2000-01-01", time: "12:10", place: "Tokyo", timezoneId: "Asia/Tokyo", latitude: 35.6762, longitude: 139.6503 };
  const result = astrology.synastry(profile, second, Astronomy);
  assert.equal(result.ok, true);
  assert.equal(result.composite.planets.length, 10);
  assert.ok(Array.isArray(result.aspects));
  assert.equal("score" in result, false);
  assert.equal(result.provenance.kind, "astrology-synastry");
});

test("relocation and astrocartography preserve the natal instant", () => {
  const natal = astrology.calculateChart(profile, Astronomy);
  const relocated = astrology.relocationChart(profile, { place: "Paris", latitude: 48.8566, longitude: 2.3522 }, Astronomy);
  const map = astrology.astrocartography(profile, Astronomy);
  assert.equal(relocated.ok, true);
  assert.equal(relocated.instantUtc, natal.instantUtc);
  assert.equal(relocated.profile.place, "Paris");
  assert.equal(map.ok, true);
  assert.equal(map.lines.length, 10);
  assert.ok(map.lines.every((line) => line.asc.length > 0 && line.desc.length > 0));
  assert.match(map.note, /xấp xỉ/i);
});

test("missing birth time is rejected and unsupported Chiron is never fabricated", () => {
  const invalid = astrology.calculateChart({ ...profile, time: "" }, Astronomy);
  assert.equal(invalid.ok, false);
  const chart = astrology.calculateChart(profile, Astronomy);
  assert.equal(chart.planets.some((planet) => planet.body === "Chiron"), false);
  assert.equal(chart.points.some((point) => point.body === "Chiron"), false);
});
