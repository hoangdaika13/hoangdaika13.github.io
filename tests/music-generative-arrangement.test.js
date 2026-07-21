const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "music-generative-arrangement.js"), "utf8");
const css = fs.readFileSync(path.join(root, "music-generative-arrangement.css"), "utf8");
const studio = require(path.join(root, "music-generative-arrangement.js"));

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    value(key) { return values.get(key); }
  };
}

function apiWithProjectContext(contextApi) {
  const context = {
    window: { HHMusicProjectContext: contextApi },
    module: { exports: {} },
    exports: {},
    console,
    structuredClone,
    setTimeout,
    clearTimeout,
    AbortController,
    Date,
    Math,
    JSON,
    Uint8Array,
    Blob
  };
  vm.runInNewContext(source, context, { filename: "music-generative-arrangement.js" });
  return { helpers: context.module.exports, browser: context.window.HHMusicGenerativeArrangement };
}

test("exposes the browser workspace contract for exactly two views", () => {
  const context = { window: {}, module: { exports: {} }, exports: {}, setTimeout, clearTimeout, AbortController, Date, Math, JSON, Uint8Array, Blob };
  vm.runInNewContext(source, context);
  const api = context.window.HHMusicGenerativeArrangement;
  assert.equal(typeof api.mount, "function");
  assert.equal(typeof api.unmount, "function");
  assert.equal(api.supports("session-band"), true);
  assert.equal(api.supports("region-editor"), true);
  assert.equal(api.supports("composer"), false);
  assert.deepEqual(studio.VIEWS, ["session-band", "region-editor"]);
  assert.equal(studio.STORAGE_KEY, "hh.music.generative-arrangement.v1");
  assert.match(source, /browserScope\.HHMusicGenerativeArrangement = browserApi/);
});

test("prefers HHMusicProjectContext chord track and song DNA without creating a competing context", () => {
  let chordReads = 0;
  let dnaReads = 0;
  let subscribed = null;
  let unsubscribeCount = 0;
  const shared = {
    getChordTrack() {
      chordReads += 1;
      return [{ id: "shared-a", symbol: "Dm7", startBar: 0, bars: 4 }, { id: "shared-b", symbol: "G7", startBar: 4, bars: 4 }];
    },
    getSongDNA() {
      dnaReads += 1;
      return { motif: "1-2-4-5", instruments: ["Piano", "Strings"], timbre: "Mềm và rộng", style: "Cinematic", mood: "Bí ẩn", locked: true };
    },
    subscribe(listener) {
      subscribed = listener;
      return () => { unsubscribeCount += 1; };
    }
  };
  const { helpers } = apiWithProjectContext(shared);
  const result = helpers.applySharedContext(helpers.createDefaultState(1));
  assert.equal(result.source, "HHMusicProjectContext");
  assert.equal(result.state.project.contextSource, "HHMusicProjectContext");
  assert.deepEqual(Array.from(result.state.project.chordTrack, (item) => item.symbol), ["Dm7", "G7"]);
  assert.equal(result.state.project.songDNA.motif, "1-2-4-5");
  assert.equal(result.state.project.songDNA.style, "Cinematic");
  assert.equal(chordReads, 1);
  assert.equal(dnaReads, 1);
  const unsubscribe = helpers.subscribeSharedProjectContext(() => {});
  assert.equal(typeof subscribed, "function");
  unsubscribe();
  assert.equal(unsubscribeCount, 1);
  assert.doesNotMatch(source, /(?:window|browserScope|root)\.HHMusicProjectContext\s*=/);
});

test("falls back to a deterministic project when shared context is absent", () => {
  const { helpers } = apiWithProjectContext(null);
  const first = helpers.applySharedContext(helpers.createDefaultState(1));
  const second = helpers.applySharedContext(helpers.createDefaultState(1));
  assert.equal(first.source, "fallback-deterministic");
  assert.equal(first.state.project.contextSource, "fallback-deterministic");
  assert.deepEqual(first.state.project.chordTrack, second.state.project.chordTrack);
  assert.deepEqual(first.state.sessionBand.patterns, second.state.sessionBand.patterns);
  const stale = helpers.createDefaultState(1);
  stale.project.contextSource = "HHMusicProjectContext";
  const repaired = helpers.applySharedContext(stale);
  assert.equal(repaired.changed, true);
  assert.equal(repaired.state.project.contextSource, "fallback-deterministic");
});

test("all six Session Band players generate deterministic chord-aware patterns", () => {
  const project = studio.normalizeProject({
    bpm: 108,
    bars: 8,
    seed: 20260721,
    chordTrack: [
      { id: "c1", symbol: "C", startBar: 0, bars: 2 },
      { id: "c2", symbol: "Am", startBar: 2, bars: 2 },
      { id: "c3", symbol: "F", startBar: 4, bars: 2 },
      { id: "c4", symbol: "G7", startBar: 6, bars: 2 }
    ]
  });
  const chordIds = new Set(project.chordTrack.map((item) => item.id));
  for (const instrument of studio.INSTRUMENTS) {
    const musician = studio.normalizeMusician(instrument.id, { id: instrument.id, complexity: 64, energy: 70, density: 62, technique: instrument.techniques[0] });
    const first = studio.generateInstrumentPattern(project, musician);
    const second = studio.generateInstrumentPattern(project, musician);
    assert.ok(first.length > 0, `${instrument.id} must create notes`);
    assert.deepEqual(first, second, `${instrument.id} must be deterministic`);
    assert.ok(first.every((note) => chordIds.has(note.chordId)), `${instrument.id} must follow chord track segments`);
    assert.ok(first.every((note) => note.startBeat >= 0 && note.durationBeats >= 0.25));
  }
});

test("density and energy controls change generated musical material predictably", () => {
  const project = studio.normalizeProject({ seed: 41, bars: 16 });
  const sparse = studio.generateInstrumentPattern(project, studio.normalizeMusician("synth", { id: "synth", density: 5, energy: 20, complexity: 60 }));
  const dense = studio.generateInstrumentPattern(project, studio.normalizeMusician("synth", { id: "synth", density: 100, energy: 90, complexity: 60 }));
  const average = (notes) => notes.reduce((sum, note) => sum + note.velocity, 0) / notes.length;
  assert.ok(dense.length > sparse.length);
  assert.ok(average(dense) > average(sparse));
});

test("piano roll export produces a real type-1 MIDI container", () => {
  const state = studio.createDefaultState(1);
  const midi = studio.exportMidi(state, "all");
  assert.equal(midi instanceof Uint8Array, true);
  assert.equal(Buffer.from(midi.subarray(0, 4)).toString("ascii"), "MThd");
  assert.equal(midi[8], 0);
  assert.equal(midi[9], 1, "MIDI format must be type 1");
  const trackCount = (midi[10] << 8) | midi[11];
  assert.equal(trackCount, 7, "tempo track plus six enabled players");
  assert.equal((midi[12] << 8) | midi[13], studio.PPQ);
  assert.ok(Buffer.from(midi).includes(Buffer.from("MTrk")));
});

test("region operations create non-destructive branches and honor every lock", () => {
  const state = studio.createDefaultState(1700000000000);
  const original = structuredClone(state.regionEditor);
  const sourceBranch = original.branches[0];
  const sourceRegion = sourceBranch.regions[0];
  const selection = { startBeat: sourceRegion.startBeat, endBeat: sourceRegion.endBeat };
  const next = studio.applyRegionOperation(original, "regenerate", {
    project: state.project,
    selection,
    locks: { seed: true, chord: true, tempo: true, vocal: true },
    now: 1700000000100
  });
  assert.deepEqual(original, state.regionEditor, "pure helper must not mutate source editor");
  assert.equal(next.branches.length, original.branches.length + 1);
  assert.equal(next.branches[0].id, sourceBranch.id);
  const changed = next.branches.at(-1).regions.find((item) => item.id === sourceRegion.id);
  assert.equal(changed.seed, sourceRegion.seed);
  assert.equal(changed.chord, sourceRegion.chord);
  assert.equal(changed.tempo, sourceRegion.tempo);
  assert.equal(changed.vocal, sourceRegion.vocal);
  assert.equal(changed.generation, sourceRegion.generation + 1);
  assert.equal(next.branches.at(-1).parentId, sourceBranch.id);
});

test("all Region Editor actions preserve source and create the expected draft", () => {
  const state = studio.createDefaultState(1700000000000);
  const selection = { startBeat: 0, endBeat: 8 };
  const originalCount = state.regionEditor.branches[0].regions.length;
  const actionResults = Object.fromEntries(studio.REGION_ACTIONS.map((action, index) => [action, studio.applyRegionOperation(state.regionEditor, action, { project: state.project, selection, instrument: "synth", now: 1700000010000 + index })]));
  for (const action of studio.REGION_ACTIONS) {
    assert.equal(actionResults[action].branches.length, 2, `${action} must create a branch`);
    assert.equal(actionResults[action].branches[0].regions.length, originalCount, `${action} must preserve source regions`);
  }
  assert.ok(actionResults.extend.branches.at(-1).regions.length > originalCount);
  assert.ok(actionResults["add-harmony"].branches.at(-1).regions.some((item) => item.harmony));
  assert.ok(actionResults.replace.branches.at(-1).regions.some((item) => item.instrument === "synth"));
  const baseEnergy = state.regionEditor.branches[0].regions[0].energy;
  assert.ok(actionResults["reduce-energy"].branches.at(-1).regions[0].energy < baseEnergy);
});

test("version comparison and restore keep history instead of overwriting it", () => {
  const state = studio.createDefaultState(1700000000000);
  const edited = studio.applyRegionOperation(state.regionEditor, "add-harmony", { project: state.project, selection: { startBeat: 0, endBeat: 8 }, now: 1700000000200 });
  const comparison = studio.compareVersions(edited, edited.compare.beforeId, edited.compare.afterId);
  assert.equal(comparison.found, true);
  assert.ok(comparison.added.length > 0);
  const branch = edited.branches.at(-1);
  const beforeLength = branch.versions.length;
  const restored = studio.restoreVersion(edited, edited.compare.beforeId, { now: 1700000000300 });
  assert.equal(restored.branches.at(-1).versions.length, beforeLength + 1);
  assert.match(restored.branches.at(-1).versions.at(-1).label, /Khôi phục/);
  assert.equal(edited.branches.at(-1).versions.length, beforeLength, "restore helper must remain non-mutating");
});

test("versioned localStorage repairs incompatible data and never persists runtime provider readiness", () => {
  const storage = memoryStorage();
  const state = studio.createDefaultState(1);
  state.regionEditor.provider = { configured: true, status: "ready", name: "Secret server", message: "Ready" };
  const saved = studio.saveState(state, storage);
  assert.match(storage.value(studio.STORAGE_KEY), /"version":1/);
  assert.equal(saved.regionEditor.provider.configured, false);
  assert.equal(saved.regionEditor.provider.status, "local");
  const oldStorage = memoryStorage({ [studio.STORAGE_KEY]: JSON.stringify({ version: 99, project: { title: "Old" } }) });
  assert.equal(studio.loadState(oldStorage).project.title, "HH Generative Arrangement");
  const corrupt = memoryStorage({ [studio.STORAGE_KEY]: "not-json" });
  assert.equal(studio.loadState(corrupt).version, 1);
});

test("provider adapter state is truthful and client source contains no credentials", () => {
  const local = studio.resolveProvider({});
  assert.equal(local.configured, false);
  assert.equal(local.status, "local");
  assert.match(local.message, /Chưa cấu hình/);
  const ready = studio.resolveProvider({ providerAdapter: async () => ({ ok: true }) });
  assert.equal(ready.configured, true);
  assert.equal(ready.status, "ready");
  assert.equal(typeof ready.adapter, "function");
  assert.match(source, /API key không nằm trong trình duyệt/);
  assert.doesNotMatch(source, /(?:AIza[0-9A-Za-z_-]{20,}|AQ\.[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}|ELEVENLABS_API_KEY|GOOGLE_CLIENT_SECRET)/);
});

test("UI source and styles are Vietnamese, accessible and responsive", () => {
  for (const contract of [
    /Session Band/, /Region Editor/, /AI SESSION BAND/, /GENERATIVE REGION EDITOR/,
    /aria-label="Chord Track dùng chung"/, /role="application"/, /aria-live="polite"/,
    /data-mga-region-operation="regenerate"/, /data-mga-action="export-midi-all"/
  ]) assert.match(source, contract);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /overflow-x: auto/);
  assert.doesNotMatch(css, /font-size:\s*[^;]*(?:vw|vh)/);
  assert.doesNotMatch(css, /letter-spacing:\s*-/);
});
