const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fortune = require(path.join(root, "fortune-hub.js"));

test("fortune calculations handle western zodiac boundary dates", () => {
  assert.equal(fortune.getWesternZodiac(3, 20).name, "Song Ngư");
  assert.equal(fortune.getWesternZodiac(3, 21).name, "Bạch Dương");
  assert.equal(fortune.getWesternZodiac(12, 22).name, "Ma Kết");
  assert.equal(fortune.getWesternZodiac(1, 19).name, "Ma Kết");
  assert.equal(fortune.getWesternZodiac(2, 30), null);
});

test("Chinese zodiac explicitly handles births before Lunar New Year", () => {
  const afterTet = fortune.getChineseZodiac(2003, false);
  const beforeTet = fortune.getChineseZodiac(2003, true);
  assert.deepEqual([afterTet.animal, afterTet.branch], ["Dê", "Mùi"]);
  assert.deepEqual([beforeTet.animal, beforeTet.branch], ["Ngựa", "Ngọ"]);
  assert.equal(afterTet.cycleYear, 2003);
  assert.equal(beforeTet.cycleYear, 2002);
  assert.equal(fortune.getChineseZodiac(1899), null);
});

test("numerology exposes its formula instead of hiding the calculation", () => {
  const result = fortune.calculateNumerology("2003-08-13");
  assert.equal(result.total, 17);
  assert.equal(result.lifePath, 8);
  assert.match(result.formula, /2 \+ 0 \+ 0 \+ 3/);
  assert.equal(fortune.calculateNumerology("2024-02-30"), null);
  assert.equal(fortune.reduceNumerology(29), 11);
});

test("expanded numerology keeps personal cycles and Vietnamese names transparent", () => {
  const cycles = fortune.calculatePersonalCycles("2003-08-13", "2026-08-16");
  assert.deepEqual([cycles.personalYear, cycles.personalMonth, cycles.personalDay], [4, 3, 1]);
  assert.match(cycles.formula, /Năm cá nhân:/);
  const name = fortune.calculateNameNumerology("Nguyễn Hoàng");
  assert.equal(name.letters, "NGUYENHOANG");
  assert.equal(name.expression, 5);
  assert.match(name.formulas.expression, /= 59 → 5/);
  assert.equal(fortune.calculateNameNumerology("--"), null);
});

test("moon phase exposes an astronomical approximation and never a fake exact claim", () => {
  const newMoon = fortune.calculateMoonPhase("2000-01-06");
  assert.equal(newMoon.name, "Trăng non");
  assert.ok(newMoon.illumination < 1);
  assert.match(newMoon.method, /Xấp xỉ/);
  assert.equal(fortune.calculateMoonPhase("2026-02-30"), null);
  assert.ok(fortune.SYNODIC_MONTH_DAYS > 29 && fortune.SYNODIC_MONTH_DAYS < 30);
});

test("two-profile reflection produces prompts without compatibility scoring", () => {
  const result = fortune.compareSymbolicProfiles("2003-08-13", "2000-01-01", { context: "team" });
  assert.equal(result.context, "team");
  assert.equal(result.prompts.length, 3);
  assert.equal(result.first.western.name, "Sư Tử");
  assert.equal(result.second.western.name, "Ma Kết");
  assert.equal("score" in result, false);
  assert.equal(fortune.compareSymbolicProfiles("bad", "2000-01-01"), null);
});

test("tarot and I Ching are deterministic for the same disclosed seed", () => {
  const firstDraw = fortune.drawTarot("repeatable-seed", 3);
  const secondDraw = fortune.drawTarot("repeatable-seed", 3);
  assert.deepEqual(firstDraw, secondDraw);
  assert.equal(firstDraw.length, 3);
  assert.equal(new Set(firstDraw.map((card) => card.id)).size, 3);
  assert.deepEqual(fortune.castIChing("repeatable-seed"), fortune.castIChing("repeatable-seed"));
  assert.equal(fortune.castIChing("repeatable-seed").lines.length, 6);
  assert.equal(fortune.drawTarot("five-card-seed", 5).length, 5);
  assert.equal(typeof fortune.castIChing("repeatable-seed").changedTitle, "string");
});

test("daily result stays stable for the same owner and local date", () => {
  const day = new Date(2026, 7, 16, 10, 30, 0);
  assert.deepEqual(fortune.dailyReading("owner-a", day), fortune.dailyReading("owner-a", day));
  assert.notDeepEqual(fortune.dailyReading("owner-a", day), fortune.dailyReading("owner-b", day));
});

test("state is versioned, bounded and isolated by owner key", () => {
  const history = Array.from({ length: 100 }, (_, index) => ({ id: `h${index}`, type: "tarot", title: "T", summary: "S" }));
  const journal = Array.from({ length: 140 }, (_, index) => ({ id: `j${index}`, text: "Nội dung", tag: "Suy ngẫm" }));
  const state = fortune.normalizeState({ view: "tarot", history, journal, favorites: ["a", "a"] });
  assert.equal(state.version, fortune.VERSION);
  assert.equal(state.history.length, 80);
  assert.equal(state.journal.length, 120);
  assert.deepEqual(state.favorites, ["a"]);
  assert.notEqual(fortune.storageKey("owner-a"), fortune.storageKey("owner-b"));
  assert.match(fortune.storageKey("owner-a"), /^hh\.fortune\.hub\.v1:/);
});

test("module includes working controls, privacy language and lifecycle", () => {
  const source = read("fortune-hub.js");
  assert.match(source, /data-fortune-draw/);
  assert.match(source, /data-fortune-zodiac-calc/);
  assert.match(source, /data-fortune-chinese-calc/);
  assert.match(source, /data-fortune-numerology-calc/);
  assert.match(source, /data-fortune-iching-cast/);
  assert.match(source, /data-fortune-moon-calc/);
  assert.match(source, /data-fortune-compare/);
  assert.match(source, /data-fortune-name-calc/);
  assert.match(source, /data-fortune-history-search/);
  assert.match(source, /data-fortune-journal-form/);
  assert.match(source, /data-fortune-export="png"/);
  assert.match(source, /không được lưu hoặc gửi đi/i);
  assert.match(source, /Không phải dự báo khoa học/i);
  assert.equal(typeof fortune.mount, "function");
  assert.equal(typeof fortune.unmount, "function");
  assert.match(source, /getWesternZodiac\(Number\(match\[1\]\), Number\(match\[2\]\)\)/);
  assert.deepEqual(fortune.inspect(), { version: "2.0.0", mounted: false, view: "today", ownerId: null, historyCount: 0, journalCount: 0 });
});

test("fortune route is lazy loaded, searchable and represented as a major planet", () => {
  const client = read("script.js");
  const loader = read("performance-loader.js");
  const html = read("index.html");
  const galaxy = read("auth-h-galaxy.js");
  const worker = read("sw.js");
  assert.match(client, /id: "fortune"[\s\S]*?route: "\/fortune"/);
  assert.match(client, /window\.HHFortuneHub\?\.mount/);
  assert.match(client, /title: "Xem bói"[\s\S]*?key: "xem bói tarot/);
  assert.match(loader, /fortune:\s*\{[\s\S]*?fortune-hub\.css\?v=2[\s\S]*?fortune-hub\.js\?v=6/);
  assert.match(loader, /value\.startsWith\("\/fortune"\)/);
  assert.match(html, /data-hh-galaxy-key="fortune"/);
  assert.match(html, /25 LĨNH VỰC/);
  assert.match(galaxy, /fortune:\s*\{[\s\S]*?route: "#\/fortune"/);
  assert.match(worker, /fortune-hub\.css\?v=2/);
  assert.match(worker, /fortune-hub\.js\?v=6/);
});

test("fortune layout supports keyboard focus, reduced motion and 375px screens", () => {
  const css = read("fortune-hub.css");
  assert.match(css, /body\.app-fortune-route/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /width:\s*100vw/);
});
