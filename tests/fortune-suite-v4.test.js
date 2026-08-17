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
  assert.equal(suite.VERSION, "5.0.0");
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

test("every mature engine emits a verifiable Fortune Result Contract", () => {
  const results = [
    suite.drawTarot78("contract-tarot", { count: 3 }),
    suite.tarotQuiz("contract-academy", { mode: "symbol" }),
    suite.castIChingAdvanced("contract-iching", { mode: "manual", manual: [6, 7, 8, 9, 7, 8] }, globalThis.HHFortuneIChing64),
    suite.advancedNumerology("2003-08-13", "Nguyễn Hoàng", "pythagorean", "2026-08-17"),
    suite.calculateSolarZodiac("2003-08-13", profile, Astronomy),
    suite.calculateMoonSky("2026-08-17", profile, Astronomy),
    suite.easternCalendar("2026-08-17", profile, Astronomy),
    suite.drawSymbolDeck("lenormand", "contract-lenormand", 9)
  ];
  for (const result of results) {
    const contract = result.resultContract;
    assert.equal(contract.schema, "hh.fortune.result-contract.v2");
    assert.match(contract.resultId, /^fortune-/);
    assert.match(contract.inputDigest, /^[a-f0-9]{64}$/);
    assert.match(contract.resultDigest, /^[a-f0-9]{64}$/);
    assert.match(contract.sha256, /^[a-f0-9]{64}$/);
    assert.equal(suite.verifyResultContract(contract).ok, true);
    assert.equal("accuracy" in contract, false);
    assert.ok(contract.qualityStatus.input);
    assert.ok(Array.isArray(contract.sourceReferences));
  }
  const altered = { ...results[0].resultContract, seed: "changed-after-draw" };
  assert.equal(suite.verifyResultContract(altered).ok, false);
});

test("method registry and interpretation packs expose versioned provenance", () => {
  assert.ok(suite.METHOD_REGISTRY.length >= 10);
  assert.equal(suite.methodDefinition("tarot-rws-78").version, "2.0.0");
  assert.equal(suite.INTERPRETATION_PACKS["hh-rws-reflection"].language, "vi");
  assert.match(suite.SOURCE_REFERENCES.jpl.url, /jpl\.nasa\.gov/);
  assert.equal(suite.SOURCE_REFERENCES.lenormand.id, "wikimedia-game-of-hope-1799");
  assert.match(suite.SOURCE_REFERENCES.lenormand.url, /commons\.wikimedia\.org/);
  assert.match(suite.SOURCE_REFERENCES.nasaMoonKit.url, /svs\.gsfc\.nasa\.gov/);
  assert.ok(suite.methodDefinition("moon-sky").sources.some((source) => source.id === "nasa-svs-cgi-moon-kit"));
});

test("solar zodiac uses real longitude and discloses all-day boundary uncertainty", () => {
  const result = suite.calculateSolarZodiac("2026-03-20", { ...profile, time: "", birthTimeAccuracy: "unknown" }, Astronomy);
  assert.equal(result.ok, true);
  assert.ok(result.sign.longitude >= 0 && result.sign.longitude < 360);
  assert.equal(result.knownTime, false);
  assert.ok(result.dailyRange.from.longitude >= 0);
  assert.match(result.distinction, /không đồng nhất với chòm sao/);
});

test("Chinese zodiac keeps Lunar New Year and Li Chun boundaries separate", () => {
  const beforeNewYear = suite.calculateChineseZodiac("2026-02-16", profile, "lunar-new-year", Astronomy);
  const afterNewYear = suite.calculateChineseZodiac("2026-02-17", profile, "lunar-new-year", Astronomy);
  const lichun = suite.calculateChineseZodiac("2026-02-10", profile, "lichun", Astronomy);
  assert.equal(beforeNewYear.cycleYear, 2025);
  assert.equal(afterNewYear.cycleYear, 2026);
  assert.equal(lichun.boundary, "lichun");
  assert.match(lichun.formula, /315°/);
});

test("symbol decks preserve historical metadata and support complete Lenormand tableau", () => {
  const tableau = suite.drawSymbolDeck("lenormand", "grand-tableau", 36);
  assert.equal(tableau.cards.length, 36);
  assert.equal(tableau.layout, "grand-tableau");
  assert.ok(tableau.cards.every((card) => card.englishName && card.playingCard));
  const runes = suite.drawSymbolDeck("runes", "rune-default", 24);
  assert.ok(runes.cards.every((card) => card.transliteration && card.family && card.reversed === false));
  const reversed = suite.drawSymbolDeck("runes", "rune-modern", 24, { allowReversed: true });
  assert.equal(reversed.allowReversed, true);
});

test("Moon & Sky includes twilight, monthly phase timeline and local timestamps", () => {
  const result = suite.calculateMoonSky("2026-08-17", profile, Astronomy);
  assert.deepEqual(Object.keys(result.twilight), ["civil", "nautical", "astronomical"]);
  assert.ok(result.phaseTimeline.length >= 3);
  assert.equal(result.horizonModel.refraction, "normal");
  assert.ok(result.localTimes.rise || result.noRiseInWindow);
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
  assert.equal(suite.TAROT_ACADEMY_TRACKS.length, 8);
  assert.equal(suite.TAROT_ACADEMY_TRACKS.reduce((sum, track) => sum + track.lessons.length, 0), 26);
  assert.equal(suite.tarotAcademyLesson("court", 2).lesson.title, "Queen");
  assert.equal(suite.tarotQuiz("academy-court", { mode: "court" }).answers.length, 4);
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
  assert.equal(pythagorean.interpretations.lifePath.number, 8);
  assert.match(pythagorean.interpretations.lifePath.resources, /nguồn lực|trách nhiệm/);
  assert.match(pythagorean.interpretations.lifePath.boundary, /không phải đánh giá/);
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
  assert.ok(suite.LENORMAND_36.every((card) => card.image && card.keywords.length && Number.isInteger(card.spriteColumn) && Number.isInteger(card.spriteRow)));
  const tableau = suite.drawSymbolDeck("lenormand", "tableau-reading", 36); const reading = suite.lenormandReading(tableau.cards);
  assert.equal(reading.houses.length, 36); assert.equal(reading.pairs.length, 35); assert.equal(reading.thirds.length, 3);
  for (const type of ["lenormand", "runes", "oracle"]) {
    const draw = suite.drawSymbolDeck(type, "symbol-seed", 9);
    assert.equal(draw.cards.length, 9);
    assert.deepEqual(draw.cards, suite.drawSymbolDeck(type, "symbol-seed", 9).cards);
    assert.deepEqual(draw.provenance.labels, ["BIỂU TƯỢNG"]);
  }
});

test("Lenormand and NASA Moon assets keep source, license and checksum evidence", () => {
  const fs = require("node:fs"); const crypto = require("node:crypto");
  const verify = (relativeManifest) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, relativeManifest), "utf8"));
    const directory = path.dirname(path.join(root, relativeManifest)); const files = manifest.files || [manifest.derivative];
    for (const file of files) { const bytes = fs.readFileSync(path.join(directory, file.file)); assert.equal(crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(), file.sha256.toUpperCase()); }
    return manifest;
  };
  const lenormand = verify("assets/fortune/lenormand/game-of-hope/rights-manifest.json");
  const moon = verify("assets/fortune/moon/nasa-lro/rights-manifest.json");
  assert.equal(lenormand.licenseCode, "Public-Domain-Mark-1.0"); assert.match(lenormand.sourcePage, /commons\.wikimedia\.org/); assert.match(moon.sourcePage, /svs\.gsfc\.nasa\.gov/);
});
