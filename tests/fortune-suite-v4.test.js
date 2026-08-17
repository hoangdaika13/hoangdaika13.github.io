const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
globalThis.HHFortuneIChing64 = require(path.join(root, "fortune-iching-64.js"));
const suite = require(path.join(root, "fortune-suite-v4.js"));
const Astronomy = require("astronomy-engine");

const profile = {
  date: "2003-08-13", time: "08:30", place: "Hà Nội",
  timezoneId: "Asia/Ho_Chi_Minh", latitude: 21.0285, longitude: 105.8542, elevation: 12,
  zodiacMode: "tropical", houseSystem: "equal"
};

test("Fortune Suite V4 exposes a complete deterministic Tarot 78 deck", () => {
  assert.equal(suite.VERSION, "4.1.0");
  assert.equal(suite.TAROT_78.length, 78);
  assert.equal(new Set(suite.TAROT_78.map((card) => card.id)).size, 78);
  assert.equal(suite.TAROT_78.filter((card) => card.arcana === "major").length, 22);
  assert.equal(suite.TAROT_78.filter((card) => card.arcana === "minor").length, 56);
  const first = suite.drawTarot78("repeatable", { count: 15 });
  const second = suite.drawTarot78("repeatable", { count: 15 });
  assert.deepEqual(first.cards, second.cards);
  assert.equal(first.seed, second.seed);
  assert.equal(first.cards.length, 15);
  assert.equal(new Set(first.cards.map((card) => card.id)).size, 15);
  assert.ok(first.cards.every((card) => /assets\/fortune\/tarot\/rws\/.+\.webp$/.test(card.image)));
  assert.ok(suite.TAROT_78.some((card) => card.name === "The Fool · Kẻ Khờ"));
  assert.ok(suite.TAROT_78.some((card) => card.name === "Ace of Wands · Át Gậy"));
  assert.ok(suite.TAROT_78.some((card) => card.name === "King of Cups · Vua Cốc"));
  assert.deepEqual(first.provenance.labels, ["BIỂU TƯỢNG"]);
});

test("all standard Rider-Waite-Smith card images exist with a verified rights manifest", () => {
  const fs = require("node:fs"); const manifest = JSON.parse(fs.readFileSync(path.join(root, "assets/fortune/tarot/rws/rights-manifest.json"), "utf8"));
  assert.equal(manifest.count, 78); assert.equal(manifest.assets.length, 78); assert.match(manifest.rightsStatus, /public domain/i);
  for (const card of suite.TAROT_78) assert.equal(fs.existsSync(path.join(root, card.image)), true, card.image);
  assert.ok(manifest.assets.every((asset) => asset.license === "Public Domain Mark 1.0" && /^[a-f0-9]{64}$/.test(asset.sha256)));
});

test("Tarot Academy never needs to disclose the answer before evaluation", () => {
  const quiz = suite.tarotQuiz("academy-round-1");
  assert.equal(quiz.answers.length, 4);
  assert.ok(quiz.correctIndex >= 0 && quiz.correctIndex < 4);
  assert.equal(quiz.answers[quiz.correctIndex], quiz.card.light);
});

test("advanced I Ching supports coins, yarrow and strict manual lines", () => {
  const coins = suite.castIChingAdvanced("coins", { mode: "coins" }, globalThis.HHFortuneIChing64);
  const yarrow = suite.castIChingAdvanced("yarrow", { mode: "yarrow" }, globalThis.HHFortuneIChing64);
  const manual = suite.castIChingAdvanced("manual", { mode: "manual", manual: [6, 7, 8, 9, 7, 8] }, globalThis.HHFortuneIChing64);
  assert.equal(coins.ok, true);
  assert.equal(yarrow.ok, true);
  assert.equal(manual.ok, true);
  assert.deepEqual(manual.lines.map((line) => line.value), [6, 7, 8, 9, 7, 8]);
  assert.ok(manual.primary && manual.nuclear && manual.changed && manual.opposite && manual.reversed);
  assert.equal(suite.castIChingAdvanced("bad", { mode: "manual", manual: [6, 7] }, globalThis.HHFortuneIChing64).ok, false);
  assert.deepEqual(suite.castIChingAdvanced("same", { mode: "yarrow" }, globalThis.HHFortuneIChing64).lines, suite.castIChingAdvanced("same", { mode: "yarrow" }, globalThis.HHFortuneIChing64).lines);
});

test("IANA timezone conversion captures DST instead of using a fixed offset", () => {
  assert.equal(suite.timeZoneSupported("America/New_York"), true);
  assert.equal(suite.zoneOffsetMinutes("America/New_York", new Date("2026-01-15T12:00:00Z")), -300);
  assert.equal(suite.zoneOffsetMinutes("America/New_York", new Date("2026-07-15T12:00:00Z")), -240);
  assert.equal(suite.localInputToInstant("2026-07-15", "08:00", "America/New_York").toISOString(), "2026-07-15T12:00:00.000Z");
  assert.equal(suite.localInputToInstant("2026-02-30", "08:00", "America/New_York"), null);
});

test("provenance separates calculations, symbols and AI without fake accuracy scores", () => {
  const record = suite.createProvenance({ kind: "test", profile, engine: "Test Engine", algorithmVersion: "1.2.3", seed: "abc", labels: ["calculation", "symbolic", "ai"] });
  assert.equal(record.schema, "hh.fortune.provenance.v1");
  assert.equal(record.input.timezoneId, "Asia/Ho_Chi_Minh");
  assert.equal(record.input.timezoneOffsetMinutes, 420);
  assert.deepEqual(record.labels, ["TÍNH TOÁN", "BIỂU TƯỢNG", "AI"]);
  assert.equal("accuracy" in record, false);
  assert.equal(record.reproducible, true);
});

test("advanced numerology keeps methods separate and exposes every formula layer", () => {
  const pythagorean = suite.advancedNumerology("2003-08-13", "Nguyễn Hoàng", "pythagorean", "2026-08-17");
  const chaldean = suite.advancedNumerology("2003-08-13", "Nguyễn Hoàng", "chaldean", "2026-08-17");
  assert.equal(pythagorean.lifePath.value, 8);
  assert.equal(pythagorean.birthday.value, 4);
  assert.equal(pythagorean.pinnacles.length, 4);
  assert.equal(pythagorean.challenges.length, 4);
  assert.equal(Object.keys(pythagorean.loShu).length, 9);
  assert.notEqual(pythagorean.expression.total, chaldean.expression.total);
  assert.match(pythagorean.provenance.method, /pythagorean/);
  assert.equal(suite.advancedNumerology("2026-02-30"), null);
});

test("Moon & Sky returns real astronomical events and provenance", () => {
  const result = suite.calculateMoonSky("2026-08-17", profile, Astronomy);
  assert.equal(result.ok, true);
  assert.ok(result.phaseAngle >= 0 && result.phaseAngle < 360);
  assert.ok(result.illuminatedPercent >= 0 && result.illuminatedPercent <= 100);
  assert.ok(result.distanceKm > 300000 && result.distanceKm < 500000);
  assert.equal(result.planetEvents.length, 5);
  assert.equal(result.provenance.input.timezoneId, "Asia/Ho_Chi_Minh");
  assert.deepEqual(result.provenance.labels, ["TÍNH TOÁN"]);
});

test("Eastern calendar exposes 24 solar terms and honest engine readiness", () => {
  const result = suite.easternCalendar("2026-08-17", profile, Astronomy);
  assert.equal(result.ok, true);
  assert.deepEqual(result.yearPillar, { year: 2026, stem: "Bính", branch: "Ngọ" });
  assert.equal(result.solarTerms.length, 24);
  assert.ok(result.engines.every((engine) => engine.status !== "ready"));
  assert.equal(suite.READINESS.find((engine) => engine.id === "bazi").status, "review");
  assert.equal(suite.READINESS.find((engine) => engine.id === "tuvi").status, "review");
  assert.equal(suite.READINESS.find((engine) => engine.id === "face-palm").status, "disabled");
});

test("Lenormand, Rune and Oracle decks are complete and deterministic", () => {
  assert.equal(suite.LENORMAND_36.length, 36);
  assert.equal(suite.RUNES_24.length, 24);
  assert.equal(suite.ORACLE_24.length, 24);
  for (const type of ["lenormand", "runes", "oracle"]) {
    const draw = suite.drawSymbolDeck(type, "symbol-seed", 9);
    assert.equal(draw.cards.length, 9);
    assert.deepEqual(draw.cards, suite.drawSymbolDeck(type, "symbol-seed", 9).cards);
    assert.deepEqual(draw.provenance.labels, ["BIỂU TƯỢNG"]);
  }
});
