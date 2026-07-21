const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "music-composer-lyrics.js"), "utf8");
const css = fs.readFileSync(path.join(root, "music-composer-lyrics.css"), "utf8");
const studio = require(path.join(root, "music-composer-lyrics.js"));

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
    value(key) { return values.get(key); }
  };
}

test("exposes the requested browser workspace contract", () => {
  assert.equal(studio.VERSION, 1);
  assert.equal(studio.STORAGE_KEY, "hh.music.composer-lyrics.v1");
  assert.deepEqual(studio.VIEWS, ["composer", "lyrics"]);
  assert.equal(studio.supports("composer"), true);
  assert.equal(studio.supports("lyrics"), true);
  assert.equal(studio.supports("master"), false);
  assert.equal(typeof studio.mount, "function");
  assert.equal(typeof studio.unmount, "function");
  assert.match(source, /globalScope\.HHMusicComposerLyrics = browserApi/);
  assert.match(source, /Object\.freeze\(\{ supports, mount, unmount \}\)/);
});

test("composition plan is deterministic, ordered and complete", () => {
  const composer = studio.normalizeComposer({
    title: "Bình minh",
    genre: "Cinematic",
    bpm: 84,
    key: "D major",
    timeSignature: "6/8",
    mood: "Hùng tráng",
    duration: 120,
    seed: 20260721,
    instruments: ["Piano", "Strings", "Brass"],
    sections: [
      { id: "intro", type: "Intro", duration: 15, direction: "Mở nhẹ" },
      { id: "verse", type: "Verse", duration: 35, lyrics: "Ta đi qua màn đêm" },
      { id: "chorus", type: "Chorus", duration: 35, lyrics: "Bình minh gọi tên" },
      { id: "bridge", type: "Bridge", duration: 25 },
      { id: "outro", type: "Outro", duration: 10 }
    ]
  });
  const first = studio.buildCompositionPlan(composer, "A");
  const second = studio.buildCompositionPlan(composer, "A");
  assert.deepEqual(first, second);
  assert.equal(first.format, "hh-composition-plan");
  assert.equal(first.durationSeconds, 120);
  assert.deepEqual(first.sections.map((section) => section.type), ["Intro", "Verse", "Chorus", "Bridge", "Outro"]);
  assert.deepEqual(first.sections.map((section) => section.order), [1, 2, 3, 4, 5]);
  assert.equal(first.sections[0].startSeconds, 0);
  assert.equal(first.sections.at(-1).endSeconds, 120);
  assert.match(first.prompt, /84 BPM/);
  assert.match(first.prompt, /6\/8/);
  assert.match(first.prompt, /Do not imitate a named artist/);
  assert.deepEqual(first.providerRequest.meta.compositionPlan, first.sections);
  assert.equal(first.providerRequest.actionType, "music-track");
});

test("variation A and B preserve structure but produce different deterministic seeds", () => {
  const composer = studio.normalizeComposer({ seed: 500, variationNonce: { A: 3, B: 19 } });
  const a = studio.buildCompositionPlan(composer, "A");
  const b = studio.buildCompositionPlan(composer, "B");
  assert.equal(a.seed, 503);
  assert.equal(b.seed, 519);
  assert.equal(a.sections.length, b.sections.length);
  assert.notEqual(a.prompt, b.prompt);
});

test("locked sections cannot be regenerated while unlocked sections advance exactly once", () => {
  let composer = studio.normalizeComposer({
    seed: 44,
    sections: [
      { id: "locked", type: "Intro", direction: "Giữ nguyên", locked: true, generation: 2 },
      { id: "open", type: "Verse", direction: "Bản đầu", locked: false, generation: 2 }
    ]
  });
  const beforeLocked = structuredClone(composer.sections[0]);
  composer = studio.regenerateSection(composer, "locked", "A");
  assert.deepEqual(composer.sections[0], beforeLocked);
  composer = studio.regenerateSection(composer, "open", "A");
  assert.equal(composer.sections[1].generation, 3);
  assert.notEqual(composer.sections[1].direction, "Bản đầu");
  const toggled = studio.toggleSectionLock(composer, "open", true);
  assert.equal(toggled.sections[1].locked, true);
  assert.equal(composer.sections[1].locked, false, "lock helper must not mutate its input");
});

test("duration balancing respects the requested total and server preview limit", () => {
  const plan = studio.buildCompositionPlan({
    duration: 240,
    sections: [
      { id: "a", type: "Intro", duration: 10 },
      { id: "b", type: "Verse", duration: 30 },
      { id: "c", type: "Outro", duration: 10 }
    ]
  });
  assert.equal(plan.durationSeconds, 240);
  assert.equal(plan.sections.reduce((sum, section) => sum + section.durationSeconds, 0), 240);
  assert.equal(plan.providerRequest.meta.durationSeconds, 120);
  assert.equal(plan.providerRequest.meta.outputFormat, "mp3_48000_192");
});

test("Vietnamese and English syllable counters identify their heuristic methods", () => {
  assert.deepEqual(studio.countSyllables("Ta đi qua ngày mưa", "vi"), { count: 5, method: "heuristic-word-units" });
  const english = studio.countSyllables("Morning light is calling", "en");
  assert.ok(english.count >= 5 && english.count <= 7);
  assert.equal(english.method, "heuristic-vowel-groups");
});

test("lyrics analysis reports length and rhyme warnings without claiming exact phonetics", () => {
  const analysis = studio.analyzeLyrics({
    language: "vi",
    rhymeScheme: "AABB",
    syllableTarget: 5,
    sections: [{
      id: "verse",
      type: "Verse",
      label: "Verse",
      text: "Một dòng quá dài với rất nhiều từ nằm trong cùng một câu hôm nay\nTa đi qua mưa\nTrời xanh gọi nắng\nLòng vui thật gần"
    }]
  });
  assert.ok(analysis.warnings.some((warning) => warning.type === "length"));
  assert.ok(analysis.warnings.some((warning) => warning.type === "rhyme"));
  assert.match(analysis.disclaimer, /khoảng trắng/);
  assert.ok(analysis.lines[0].lines.every((line) => /heuristic/.test(line.method)));
});

test("snapshots are bounded and before/after comparison identifies changed sections", () => {
  let lyrics = studio.normalizeLyrics({
    title: "Demo",
    sections: [{ id: "verse", type: "Verse", label: "Verse", text: "Bản đầu" }]
  }, studio.normalizeComposer({}));
  lyrics = studio.createSnapshot(lyrics, "Trước sửa", new Date("2026-07-21T00:00:00.000Z"));
  const snapshotId = lyrics.snapshots[0].id;
  lyrics.sections[0].text = "Bản sau";
  const comparison = studio.compareLyrics(lyrics, snapshotId);
  assert.equal(comparison.found, true);
  assert.deepEqual(comparison.changedSections, ["verse"]);
  assert.match(comparison.before, /Bản đầu/);
  assert.match(comparison.after, /Bản sau/);
  for (let index = 0; index < studio.MAX_SNAPSHOTS + 5; index += 1) lyrics = studio.createSnapshot(lyrics, `v${index}`, new Date(1_800_000_000_000 + index));
  assert.equal(lyrics.snapshots.length, studio.MAX_SNAPSHOTS);
});

test("storage is versioned, repaired and excludes ephemeral audio URLs", () => {
  const storage = memoryStorage();
  const state = studio.normalizeState({ composer: { title: "Stored", preview: { status: "ready", url: "blob:private" } } });
  const saved = studio.saveState(state, storage);
  const raw = storage.value(studio.STORAGE_KEY);
  assert.match(raw, /"version":1/);
  assert.doesNotMatch(raw, /blob:private/);
  assert.equal(saved.composer.preview.url, "");
  assert.equal(studio.loadState(storage).composer.title, "Stored");

  const oldStorage = memoryStorage({ [studio.STORAGE_KEY]: JSON.stringify({ version: 99, composer: { title: "Old" } }) });
  assert.equal(studio.loadState(oldStorage).composer.title, "HH New Song");
  const corruptStorage = memoryStorage({ [studio.STORAGE_KEY]: "not-json" });
  assert.equal(studio.loadState(corruptStorage).version, 1);
});

test("project import/export validates format and sanitizes untrusted strings", () => {
  const exported = studio.exportProject({
    composer: { title: '<img src=x onerror="bad">' },
    lyrics: { sections: [{ id: "x", type: "Verse", text: "Hello\u0000 world" }] }
  });
  const imported = studio.importProject(exported);
  assert.equal(imported.version, 1);
  assert.doesNotMatch(imported.lyrics.sections[0].text, /\u0000/);
  assert.equal(studio.escapeHtml(imported.composer.title), "&lt;img src=x onerror=&quot;bad&quot;&gt;");
  assert.throws(() => studio.importProject('{"format":"other","version":1}'), /không đúng định dạng/);
});

test("provider adapter uses the existing backend and never embeds client credentials", () => {
  assert.match(source, /\/api\/modules\/music-ai\/actions/);
  assert.match(source, /actionType: "music-track"/);
  assert.match(source, /HH_REALTIME_URL/);
  assert.doesNotMatch(source, /process\.env/);
  assert.doesNotMatch(source, /(?:AIza[0-9A-Za-z_-]{20,}|AQ\.[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}|xi-api-key\s*[=:]\s*["'][^"']+)/);
  assert.doesNotMatch(source, /ELEVENLABS_API_KEY/);
  assert.match(source, /Không có credential trong payload/);
});

test("styles cover mobile, focus visibility and reduced motion", () => {
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.doesNotMatch(css, /font-size:\s*[^;]*(?:vw|vh)/);
});
