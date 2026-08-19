const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const iching = require(path.join(root, "fortune-iching-64.js"));
globalThis.HHFortuneIChing64 = iching;
const fortune = require(path.join(root, "fortune-hub.js"));
const astrology = require(path.join(root, "fortune-astrology.js"));
const Astronomy = require("astronomy-engine");

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
  assert.equal(fortune.drawTarot("seven-card-seed", 7).length, 7);
  assert.equal(fortune.drawTarot("ten-card-seed", 10).length, 10);
  assert.equal(typeof fortune.castIChing("repeatable-seed").changedTitle, "string");
  assert.match(fortune.castIChing("repeatable-seed").title, /Quẻ \d+ ·/);
});

test("I Ching V3 includes all 64 King Wen mappings and nuclear hexagrams", () => {
  assert.equal(iching.HEXAGRAMS.length, 64);
  assert.equal(iching.hexagramForBits("111111").number, 1);
  assert.equal(iching.hexagramForBits("000000").number, 2);
  assert.match(iching.hexagramForBits("101010").attribution, /HH biên soạn/);
  assert.match(iching.nuclearBits("101011"), /^[01]{6}$/);
});

test("birth chart refuses missing input and calculates real ephemeris when complete", () => {
  const invalid = astrology.calculateBirthChart({ date: "2003-08-13" }, Astronomy);
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((item) => /giờ sinh/i.test(item)));
  const result = astrology.calculateBirthChart({ date: "2003-08-13", time: "08:30", timezone: 7, latitude: 21.0285, longitude: 105.8542, place: "Hà Nội" }, Astronomy);
  assert.equal(result.ok, true);
  assert.equal(result.planets.length, 10);
  assert.equal(result.houses.length, 12);
  assert.ok(result.ascendant.longitude >= 0 && result.ascendant.longitude < 360);
  assert.match(result.method.ephemeris, /Astronomy Engine 2\.1\.19/);
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

test("shared profile is session-only unless remembered is explicitly enabled", () => {
  const profile = { date: "2003-08-13", time: "08:30", place: "Hà Nội", timezone: 7, latitude: 21.0285, longitude: 105.8542 };
  assert.equal(fortune.normalizeState({ profile }).profile, null);
  const remembered = fortune.normalizeState({ profile: { ...profile, remembered: true } }).profile;
  assert.equal(remembered.date, profile.date);
  assert.equal(remembered.remembered, true);
});

test("reflection calendar exposes month, week and timeline without lucky-day labels", () => {
  assert.equal(fortune.buildReflectionCalendar("2003-08-13", "2026-08-17", "month").length, 42);
  assert.equal(fortune.buildReflectionCalendar("2003-08-13", "2026-08-17", "week").length, 7);
  assert.equal(fortune.buildReflectionCalendar("2003-08-13", "2026-08-17", "timeline").length, 14);
  assert.doesNotMatch(JSON.stringify(fortune.buildReflectionCalendar("2003-08-13", "2026-08-17", "week")), /đại cát|chắc chắn xấu/i);
});

test("local journal vault encrypts and decrypts with AES-GCM", async () => {
  const entries = [{ id: "note-1", text: "Nội dung riêng tư", tag: "Suy ngẫm", createdAt: new Date().toISOString() }];
  const secured = await fortune.createJournalVault(entries, "2468");
  assert.ok(secured.vault.ciphertext);
  assert.doesNotMatch(secured.vault.ciphertext, /Nội dung riêng tư/);
  const opened = await fortune.openJournalVault(secured.vault, "2468");
  assert.equal(opened.entries[0].text, entries[0].text);
  await assert.rejects(() => fortune.openJournalVault(secured.vault, "0000"));
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
  assert.match(source, /Website không tự kèm hồ sơ, ngày sinh, tọa độ hoặc nhật ký khác/i);
  assert.match(source, /Không phải dự báo khoa học/i);
  assert.match(source, /data-fortune-ai-analyze/);
  assert.match(source, /data-fortune-copilot-run/);
  assert.match(source, /fortune-deep-analysis/);
  assert.match(source, /data-fortune-chart-calc/);
  assert.match(source, /data-fortune-calendar-mode/);
  assert.equal(typeof fortune.mount, "function");
  assert.equal(typeof fortune.unmount, "function");
  assert.match(source, /calculateSolarZodiac/);
  assert.match(source, /calculateChineseZodiac/);
  assert.match(source, /data-fortune-contract-verify/);
  assert.match(source, /FORTUNE RESULT CONTRACT/);
  assert.deepEqual(fortune.inspect(), { version: "8.0.0", mounted: false, view: "today", ownerId: null, historyCount: 0, journalCount: 0 });
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
  assert.match(loader, /fortune:\s*\{[\s\S]*?fortune-hub\.css\?v=3[\s\S]*?fortune-hub-v3\.css\?v=2[\s\S]*?fortune-hub-v4\.css\?v=8[\s\S]*?fortune-hub-v5\.css\?v=3[\s\S]*?astronomy-engine-2\.1\.19\.min\.js\?v=1[\s\S]*?iztro-2\.6\.0\.min\.js\?v=2\.6\.0[\s\S]*?fortune-iching-64\.js\?v=1[\s\S]*?fortune-accuracy-lab\.js\?v=1[\s\S]*?fortune-suite-v4\.js\?v=4[\s\S]*?fortune-astrology\.js\?v=1[\s\S]*?fortune-astrology-v4\.js\?v=2[\s\S]*?fortune-moon-3d\.js\?v=1[\s\S]*?fortune-extended-tools\.js\?v=2[\s\S]*?fortune-hub\.js\?v=16/);
  assert.match(loader, /value\.startsWith\("\/fortune"\)/);
  assert.match(html, /data-hh-galaxy-key="fortune"/);
  assert.match(html, /23 LĨNH VỰC/);
  assert.match(galaxy, /fortune:\s*\{[\s\S]*?route: "#\/fortune"/);
  assert.match(worker, /fortune-hub\.css\?v=3/);
  assert.match(worker, /fortune-hub-v4\.css\?v=8/);
  assert.match(worker, /fortune-hub-v5\.css\?v=3/);
  assert.match(worker, /fortune-iching-64\.js\?v=1/);
  assert.match(worker, /fortune-accuracy-lab\.js\?v=1/);
  assert.match(worker, /fortune-suite-v4\.js\?v=4/);
  assert.match(worker, /fortune-astrology\.js\?v=1/);
  assert.match(worker, /fortune-astrology-v4\.js\?v=2/);
  assert.match(worker, /fortune-hub-v3\.css\?v=2/);
  assert.match(worker, /fortune-moon-3d\.js\?v=1/);
  assert.match(worker, /iztro-2\.6\.0\.min\.js\?v=2\.6\.0/);
  assert.match(worker, /fortune-extended-tools\.js\?v=2/);
  assert.match(worker, /fortune-hub\.js\?v=16/);
});

test("Gemini fortune route enforces opt-in, safety and server-side redaction", () => {
  const client = read("fortune-hub.js");
  const backend = read("api/modules/[moduleId]/actions.js");
  assert.match(client, /data-fortune-copilot-consent/);
  assert.match(client, /allowProviderFallback:\s*true/);
  assert.match(client, /requireProvider:\s*false/);
  assert.match(client, /globalScope\.HH_API_BASE/);
  assert.match(backend, /HH Reflection Copilot/);
  assert.match(backend, /hh-fortune-continuity-v1/);
  assert.match(backend, /privateFortuneAction/);
  assert.match(backend, /\[redacted:/);
  assert.match(backend, /Không chẩn đoán hay đưa quyết định y tế, pháp lý, tài chính/);
  assert.match(client, /hh\.fortune\.fact-lock\.v1/);
  assert.match(backend, /FORTUNE_FACT_LOCK_REJECTED/);
  assert.match(backend, /validateFortuneFactLockedOutput/);
  assert.match(backend, /\[factId:<id>\]/);
});

test("encrypted Fortune vault is authenticated, owner-isolated and never uploads plaintext", () => {
  const client = read("fortune-hub.js");
  const backend = read("api/modules/[moduleId]/actions.js");
  assert.match(client, /fortuneVault=1/);
  assert.match(client, /JSON\.stringify\(\{ vault: runtime\.state\.journalVault \}\)/);
  assert.doesNotMatch(client, /JSON\.stringify\(\{[^}]*journalEntries/);
  assert.match(backend, /if \(!user\?\._id\) return res\.status\(401\)/);
  assert.match(backend, /fortune-vault:\$\{user\._id\}/);
  assert.match(backend, /findOne\(\{ userId: user\._id \}/);
  assert.match(backend, /updateOne\(\{ userId: user\._id \}/);
  assert.match(backend, /encryptedOnly: true/);
});

test("Tarot export and Reflection Pack include real multi-format output controls", () => {
  const source = read("fortune-hub.js");
  assert.match(source, /data-fortune-export-ratio/);
  assert.match(source, /"1:1": \[1200, 1200\]/);
  assert.match(source, /"9:16": \[1080, 1920\]/);
  assert.match(source, /"16:9": \[1920, 1080\]/);
  assert.match(source, /new globalScope\.JSZip\(\)/);
  assert.match(source, /reflection-preview\.png/);
  assert.match(source, /data-fortune-reflection-pack/);
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

test("Mystic Observatory V5 provides grouped workspace navigation, contextual inspector and six result tabs", () => {
  const client = read("fortune-hub.js"); const css = read("fortune-hub-v5.css");
  assert.match(client, /OBSERVATORY_GROUPS/);
  for (const group of ["Phổ biến", "Thiên văn & lịch", "Hệ phương Đông", "Hệ biểu tượng", "Chiêm nghiệm"]) assert.match(client, new RegExp(group));
  for (const tab of ["Tổng quan", "Kết quả chi tiết", "Phương pháp tính", "Luận giải sâu", "HH AI phân tích", "Chiêm nghiệm"]) assert.match(client, new RegExp(tab));
  assert.match(client, /fortune-observatory-topbar/); assert.match(client, /fortune-context-inspector/); assert.match(client, /fortune-flow-stepper/); assert.match(client, /fortune-result-workspace/);
  assert.match(client, /hh\.fortune\.ai-cache\.v1/); assert.match(client, /runtime\.aiCache/);
  assert.doesNotMatch(client, /fortune-nav__pinned/);
  assert.doesNotMatch(client, /data-fortune-pin/);
  assert.match(css, /grid-template-columns:240px minmax\(650px,1fr\) 340px/);
  assert.match(css, /@media\(max-width:1280px\)/); assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /min-height:44px/); assert.match(css, /font-size:16px/); assert.match(css, /prefers-reduced-motion:reduce/);
});

test("Mystic Living Observatory exposes real themes, motion controls and world scenes", () => {
  const client = read("fortune-hub.js");
  const css = read("fortune-hub-v4.css");
  for (const theme of ["cosmic-oracle", "eastern-temple", "moonlit-forest", "arcane-library", "crystal-dream", "blood-moon"]) {
    assert.match(client, new RegExp(theme));
    assert.match(css, new RegExp(theme));
  }
  assert.match(client, /fortune-mystic-scene/);
  assert.match(client, /data-fortune-cosmos/);
  assert.match(client, /data-fortune-motion/);
  assert.match(client, /data-fortune-density/);
  assert.match(client, /startViewTransition/);
  assert.match(client, /visibilitychange/);
  assert.match(client, /cancelAnimationFrame/);
  assert.match(client, /prefers-reduced-motion: reduce/);
  assert.match(css, /data-world="tarot"/);
  assert.match(css, /data-world="iching"/);
  assert.match(css, /data-world="astrology"/);
  assert.match(css, /data-world="moon"/);
  assert.match(css, /data-world="numerology"/);
  assert.match(css, /data-world="runes"/);
  assert.match(css, /data-world="eastern"/);
  assert.match(css, /data-world="journal"/);
  assert.match(css, /Mystic Galaxy motion layer V2/);
  assert.match(css, /mysticAuroraOrbit/);
  assert.match(css, /mysticPortalBreath/);
  assert.match(css, /mysticStarDrift/);
  for (const view of ["today", "profile", "session", "tarot", "academy", "symbols", "zodiac", "numerology", "iching", "moon", "sky", "chart", "eastern", "compatibility", "calendar", "journal", "copilot", "accuracy", "methods", "history"]) {
    assert.match(css, new RegExp(`data-fortune-view="${view}"`));
  }
  assert.match(css, /Every Fortune tool owns a continuous symbolic motion/);
  assert.match(css, /\.fortune-nav__item:after\{top:auto!important;bottom:3px/);
  assert.match(css, /\.fortune-nav__item span\{font-size:14px/);
  assert.match(css, /\.fortune-view-head p\{font-size:14px/);
});

test("Tarot cinematic flow conceals, reveals and verifies the result contract", () => {
  const client = read("fortune-hub.js");
  const css = read("fortune-hub-v4.css");
  assert.match(client, /tarotRevealed:\s*new Set\(\)/);
  assert.match(client, /data-fortune-card-reveal/);
  assert.match(client, /data-fortune-reveal-all/);
  assert.match(client, /fortune-contract-seal/);
  assert.match(client, /is-verified/);
  assert.match(client, /is-invalid/);
  assert.match(css, /fortune-card-seal/);
  assert.match(css, /is-concealed/);
  assert.match(css, /is-revealed/);
  assert.match(css, /mysticSealVerified/);
  assert.match(css, /article:nth-child\(10\):last-child/);
});

test("Fortune Pro tools use compact inspectors, automatic de-identified AI and detailed learning", () => {
  const client = read("fortune-hub.js"); const css = read("fortune-hub-v4.css"); const moon = read("fortune-moon-3d.js");
  assert.match(client, /fortune-tarot-filmstrip/); assert.match(client, /fortune-tarot-inspector/); assert.match(client, /fortune-celtic-map/);
  assert.match(client, /Tarot Academy · Learning OS/); assert.match(client, /data-fortune-academy-confidence/); assert.match(client, /academyHistory/);
  assert.match(client, /fortune-lenormand-art/); assert.match(client, /Grand Tableau · 36 nhà/); assert.match(client, /Game of Hope 1799/);
  assert.match(client, /function automaticInsightInput/); assert.match(client, /function runAutomaticFortuneAi/); assert.match(client, /Tên, ngày sinh, tọa độ và nhật ký không rời trình duyệt/);
  assert.match(client, /QUẺ ĐỐI/); assert.match(client, /QUẺ ĐẢO/); assert.match(client, /fortune-six-line-ledger/);
  assert.match(client, /fortune-lunar-date/); assert.match(client, /lunarCalendarDate/); assert.match(client, /Không lớp nào được dùng để gán cát\/hung/);
  assert.match(css, /fortune-tarot-filmstrip/); assert.match(css, /fortune-academy-pro/); assert.match(css, /fortune-lenormand-art/); assert.match(css, /fortune-moon-3d-shell/);
  assert.match(moon, /SphereGeometry\(1, 96, 64\)/); assert.match(moon, /lroc-color-2k\.jpg/); assert.match(moon, /IntersectionObserver/); assert.match(moon, /document\?\.hidden/);
});

test("embedded Gemini and extended fortune studios stay inside their own tools", () => {
  const client = read("fortune-hub.js"); const css = read("fortune-hub-v4.css"); const extended = read("fortune-extended-tools.js");
  for (const view of ["tarot", "symbols", "zodiac", "numerology", "iching", "chart", "tuvi", "physiognomy", "dreams", "moon", "sky", "eastern", "compatibility", "session"]) assert.match(client, new RegExp(`\\"${view}\\"`));
  assert.match(client, /embeddedAutomaticAiMarkup/); assert.match(client, /không cần mở Reflection Copilot/); assert.doesNotMatch(client.match(/function navMarkup[\s\S]*?function toolbarMarkup/)?.[0] || "", /data-fortune-view="copilot"/);
  assert.match(client, /Tử Vi Đẩu Số · 12 cung/); assert.match(client, /Nhân tướng học · Self-observation Lab/); assert.match(client, /Giấc mơ & Symbol Journal/);
  assert.match(extended, /calculateZiWei/); assert.match(extended, /Không dùng camera/); assert.match(extended, /không nhận ảnh hoặc dữ liệu định danh/); assert.match(extended, /Nội dung nguyên văn chỉ được xử lý trong trình duyệt/);
  assert.match(css, /fortune-iching-pro \.fortune-iching-manual\{grid-template-columns:repeat\(2/); assert.match(css, /fortune-tuvi-board/); assert.match(css, /fortune-physio-form/);
});

test("all supported fortune tools trigger embedded automatic AI with privacy-safe inputs", () => {
  const client = read("fortune-hub.js");
  for (const view of ["physiognomy", "dreams", "moon", "sky", "eastern"]) {
    assert.match(client, new RegExp(`runAutomaticFortuneAi\\(runtime, \\"${view}\\"\\)`));
    assert.match(client, new RegExp(`automaticAiMarkup\\(runtime, \\"${view}\\"`));
  }
  assert.match(client, /nội dung giấc mơ nguyên văn không được gửi/i);
  assert.match(client, /Không nhắc hay yêu cầu ảnh/);
  assert.match(client, /Không suy đoán ngày sinh, giờ sinh, tọa độ/);
});
