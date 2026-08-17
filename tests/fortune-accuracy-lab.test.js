const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const lab = require(path.join(root, "fortune-accuracy-lab.js"));
const Astronomy = require("astronomy-engine");

const exactProfile = {
  date: "2003-08-13", time: "08:30", place: "Hà Nội", timezoneId: "Asia/Ho_Chi_Minh",
  latitude: 21.0285, longitude: 105.8542, elevation: 12, birthTimeAccuracy: "exact",
  birthTimeSource: "birth-certificate", birthTimeUncertaintyMinutes: 1, locationConfidence: "verified",
  calendarSystem: "gregorian", zodiacMode: "tropical", houseSystem: "equal", aspectOrbs: { conjunction: 8 }
};

test("Accuracy Lab identifies valid, repeated and nonexistent DST wall times", () => {
  const valid = lab.analyzeLocalTime("2024-01-15", "08:00", "America/New_York");
  const fold = lab.analyzeLocalTime("2024-11-03", "01:30", "America/New_York");
  const gap = lab.analyzeLocalTime("2024-03-10", "02:30", "America/New_York");
  assert.equal(valid.status, "valid"); assert.equal(valid.selected.offsetMinutes, -300);
  assert.equal(fold.status, "ambiguous"); assert.equal(fold.candidates.length, 2);
  assert.equal(lab.analyzeLocalTime("2024-11-03", "01:30", "America/New_York", "later").selected.offsetMinutes, -300);
  assert.equal(gap.status, "nonexistent"); assert.equal(gap.ok, false); assert.equal(gap.candidates.length, 0);
});

test("input quality reports independent statuses instead of a fake accuracy percentage", () => {
  const complete = lab.assessInputQuality(exactProfile, { crossChecked: true });
  const estimated = lab.assessInputQuality({ ...exactProfile, birthTimeAccuracy: "estimated", birthTimeSource: "family-memory", birthTimeUncertaintyMinutes: 60 });
  const unknown = lab.assessInputQuality({ ...exactProfile, time: "", birthTimeAccuracy: "unknown" });
  assert.equal(complete.statuses.input.id, "complete"); assert.equal(complete.statuses.timezone.id, "verified"); assert.equal(complete.statuses.calculation.id, "crossChecked");
  assert.equal(estimated.statuses.input.id, "estimated"); assert.equal(unknown.statuses.input.id, "missing");
  assert.equal("accuracy" in complete, false); assert.match(unknown.issues.join(" "), /ẩn ASC, MC/);
});

test("historical and calendar validation are explicit", () => {
  assert.equal(lab.isValidDate("2000-02-29"), true); assert.equal(lab.isValidDate("2026-02-29"), false); assert.equal(lab.isValidDate("2026-02-30"), false);
  const historical = lab.analyzeLocalTime("1969-07-20", "20:17", "America/New_York");
  assert.equal(historical.ok, true); assert.match(historical.warnings.join(" "), /trước 1970/);
  assert.equal(lab.analyzeLocalTime("2026-08-17", "12:00", "Pacific/Kiritimati").selected.offsetMinutes, 840);
  assert.equal(lab.isValidJulianDate("1900-02-29"), true); assert.equal(lab.calendarDateToGregorian("1900-02-29", "julian"), "1900-03-13");
  const julian = lab.analyzeLocalTime("1900-02-29", "12:00", "Europe/London", "", "julian"); assert.equal(julian.ok, true); assert.equal(julian.gregorianDate, "1900-03-13");
});

test("canonical JSON and SHA-256 are stable", () => {
  assert.equal(lab.canonicalStringify({ b: 2, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"b":2}');
  assert.equal(lab.canonicalStringify({ a: { c: 3, d: 4 }, b: 2 }), lab.canonicalStringify({ b: 2, a: { d: 4, c: 3 } }));
  assert.equal(lab.sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("Calculation Certificate verifies the exact result and rejects modification", async () => {
  const result = { planets: [{ body: "Sun", longitude: 140.12345 }], mode: "natal" };
  const certificate = lab.createCalculationCertificate({ profile: exactProfile, result, provenance: { engine: "Astronomy Engine", engineVersion: "2.1.19", algorithmVersion: "astrology-v4", contentVersion: "2026.08" }, computedAt: new Date("2026-08-17T00:00:00Z") });
  const repeated = lab.createCalculationCertificate({ profile: { ...exactProfile }, result: { mode: "natal", planets: [{ longitude: 140.12345, body: "Sun" }] }, provenance: { engine: "Astronomy Engine", engineVersion: "2.1.19", algorithmVersion: "astrology-v4", contentVersion: "2026.08" }, computedAt: new Date("2026-08-17T00:00:00Z") });
  assert.equal(certificate.sha256, repeated.sha256); assert.equal(certificate.sha256.length, 64);
  assert.equal(lab.verifyCalculationCertificate(certificate, result).ok, true);
  assert.equal(lab.verifyCalculationCertificate(certificate, { ...result, mode: "transit" }).ok, false);
  assert.equal((await lab.replayCalculationCertificate(certificate, () => result)).ok, true);
});

test("validation laboratory contains at least 500 deterministic global fixtures", () => {
  const fixtures = lab.buildValidationFixtures(); const repeated = lab.buildValidationFixtures();
  assert.ok(fixtures.length >= 500 && fixtures.length <= 1000); assert.deepEqual(fixtures, repeated);
  assert.ok(fixtures.some((item) => item.category === "historical")); assert.ok(fixtures.some((item) => item.category === "high-latitude")); assert.ok(fixtures.some((item) => item.category === "date-line"));
  const report = lab.runValidationLab(Astronomy, fixtures);
  assert.equal(report.ok, true); assert.equal(report.fixtureCount, fixtures.length); assert.ok(report.astronomyChecks > 0);
  assert.equal(report.references.find((item) => item.id === "jpl-horizons").status, "external-baseline-required");
});
