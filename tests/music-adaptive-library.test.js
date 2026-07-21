const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "music-adaptive-library.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "music-adaptive-library.css"), "utf8");
const adaptiveLibrary = require("../music-adaptive-library.js");

test("public API exposes both Adaptive Soundtrack and Sample Browser", () => {
  assert.equal(adaptiveLibrary.VERSION, 1);
  assert.equal(adaptiveLibrary.STORAGE_KEY, "hh.music.adaptive-library.v1");
  assert.equal(adaptiveLibrary.supports("adaptive-soundtrack"), true);
  assert.equal(adaptiveLibrary.supports("sample-browser"), true);
  assert.equal(adaptiveLibrary.supports("mix"), false);
  assert.equal(typeof adaptiveLibrary.mount, "function");
  assert.equal(typeof adaptiveLibrary.unmount, "function");

  const context = { window: {} };
  vm.runInNewContext(source, context);
  assert.equal(typeof context.window.HHMusicAdaptiveLibrary.mount, "function");
});

test("optional HHMusicProjectContext supplies BPM key and Song DNA without becoming a dependency", () => {
  const connected = adaptiveLibrary.readProjectContext({
    HHMusicProjectContext: {
      getSnapshot() { return { bpm: 128, musicalKey: "F# minor", songDNA: { mood: "cinematic", instruments: ["strings"] } }; }
    }
  });
  assert.deepEqual(connected, {
    source: "HHMusicProjectContext",
    bpm: 128,
    key: "F# minor",
    dna: { mood: "cinematic", instruments: ["strings"] }
  });

  assert.deepEqual(adaptiveLibrary.readProjectContext({}), { source: "standalone", bpm: null, key: null, dna: null });
  assert.deepEqual(adaptiveLibrary.readProjectContext({ HHMusicProjectContext: { getSnapshot() { throw new Error("offline"); } } }), { source: "standalone", bpm: null, key: null, dna: null });
  const state = adaptiveLibrary.createDefaultState(connected);
  assert.equal(state.adaptive.context.bpm, 128);
  assert.equal(state.samples.projectKey, "F# minor");
  assert.equal(state.samples.context.dna.mood, "cinematic");
});

test("cue sheet supports normalized CRUD data and deterministic non-destructive retiming", () => {
  const cues = adaptiveLibrary.sortCues([
    { id: "b", start: 10, end: 14, type: "emotion", title: "Cao trào", emotion: "hùng tráng" },
    { id: "a", start: 2, end: 5, type: "scene", title: "Mở đầu" },
    { id: "c", start: 14, end: 15, type: "transition", transition: "fade" }
  ]);
  assert.deepEqual(cues.map((cue) => cue.id), ["a", "b", "c"]);
  const retimed = adaptiveLibrary.retimeCueSheet(cues, 20, 30);
  assert.equal(retimed.ratio, 1.5);
  assert.equal(retimed.preservePitch, true);
  assert.equal(retimed.processing, "metadata-only");
  assert.deepEqual(retimed.cues.map((cue) => [cue.start, cue.end]), [[3, 7.5], [15, 21], [21, 22.5]]);
  assert.deepEqual(cues.map((cue) => [cue.start, cue.end]), [[2, 5], [10, 14], [14, 15]], "source cues stay unchanged");
});

test("cue JSON and CSV exports include markers context and escaped content", () => {
  const adaptive = {
    projectName: "Phim, tập 1",
    media: { name: "scene.mp4", type: "video/mp4", size: 10, availableThisSession: true },
    duration: 12,
    targetDuration: 15,
    preservePitch: true,
    cues: [{ id: "cue-1", start: 0, end: 4, type: "scene", title: "Cảnh \"mở\"", emotion: "ấm áp", transition: "cut", note: "Piano, strings" }]
  };
  const json = JSON.parse(adaptiveLibrary.exportCueJson(adaptive, { bpm: 90, key: "D minor" }));
  assert.equal(json.schema, "hh.adaptive-cue-sheet.v1");
  assert.equal(json.truthfulEngine, "local-metadata");
  assert.equal(json.projectContext.bpm, 90);
  assert.equal(json.media.availableThisSession, undefined);
  const csv = adaptiveLibrary.exportCueCsv(adaptive);
  assert.match(csv, /"Cảnh ""mở"""/);
  assert.match(csv, /"Piano, strings"/);
  assert.equal(csv.split("\r\n").length, 2);
});

test("Web Audio PCM analysis returns bounded real local features", () => {
  const sampleRate = 1000;
  const samples = new Float32Array(sampleRate * 8);
  for (let beat = 0; beat < 16; beat += 1) {
    const start = beat * 500;
    for (let index = start; index < Math.min(samples.length, start + 30); index += 1) samples[index] = Math.sin((index - start) / 30 * Math.PI) * 0.8;
  }
  const bpm = adaptiveLibrary.estimateBpm(samples, sampleRate);
  assert.ok(bpm.bpm >= 110 && bpm.bpm <= 130, `expected near 120 BPM, got ${bpm.bpm}`);
  assert.ok(bpm.confidence >= 0 && bpm.confidence <= 1);

  const analysis = adaptiveLibrary.analyzePcm(samples, sampleRate, 8);
  assert.equal(analysis.duration, 8);
  assert.equal(analysis.sampleRate, sampleRate);
  assert.ok(analysis.peak > 0 && analysis.peak <= 1);
  assert.ok(analysis.rms > 0 && analysis.rms < analysis.peak);
  assert.ok(analysis.dynamicRangeDb >= 0);
  assert.equal(analysis.vector.length, 7);
  analysis.vector.forEach((value) => assert.ok(value >= 0 && value <= 1));
  assert.equal(typeof analysis.key, "string");
});

test("semantic search uses tags BPM key and Song DNA deterministically", () => {
  const samples = [
    { id: "b", name: "Dark Electronic Drums", tags: ["drums", "dark", "electronic"], mood: "căng thẳng", instrument: "drums", license: { type: "CC0" }, analysis: { bpm: 120, key: "C minor" } },
    { id: "a", name: "Warm Piano", tags: ["piano", "warm"], mood: "ấm áp", instrument: "piano", license: { type: "CC BY" }, analysis: { bpm: 84, key: "C major" } },
    { id: "c", name: "Neutral Beat", tags: ["beat"], mood: "trung tính", instrument: "drums", license: { type: "Tự tạo" }, analysis: { bpm: 100, key: "D minor" } }
  ];
  const context = { bpm: 120, key: "C minor", dna: { mood: "dark", instrument: "electronic drums" } };
  const first = adaptiveLibrary.semanticSearch(samples, "trống điện tử tối 120 BPM", context);
  const second = adaptiveLibrary.semanticSearch(samples, "trống điện tử tối 120 BPM", context);
  assert.equal(first[0].sample.id, "b");
  assert.deepEqual(first.map((entry) => [entry.sample.id, entry.score]), second.map((entry) => [entry.sample.id, entry.score]));
});

test("similar-sound ranking and preview sync plans are deterministic and truthful", () => {
  const reference = { id: "r", name: "Reference", tags: ["drums", "dark"], analysis: { bpm: 120, key: "C minor", vector: [0.6, 0.4, 0.3, 0.1, 0.2, 0, 1] } };
  const close = { id: "a", name: "Close", tags: ["drums", "dark"], analysis: { bpm: 118, key: "C minor", vector: [0.59, 0.41, 0.31, 0.1, 0.2, 0, 1] } };
  const far = { id: "z", name: "Far", tags: ["bright", "piano"], analysis: { bpm: 70, key: "F# major", vector: [0.2, 1, 0.9, 0.8, 0.9, 0.55, 0] } };
  const ranked = adaptiveLibrary.rankSimilarSamples(reference, [far, close, reference]);
  assert.equal(ranked[0].sample.id, "a");
  assert.ok(ranked[0].score > ranked[1].score);

  const plan = adaptiveLibrary.buildSyncPlan(close, { bpm: 120, key: "D minor" });
  assert.equal(plan.mode, "estimated-beat-sync");
  assert.equal(plan.preservePitch, true);
  assert.ok(plan.playbackRate > 1);
  assert.equal(plan.transposeSemitones, 2);
  assert.match(plan.notice, /ước tính Web Audio cục bộ/);
  const raw = adaptiveLibrary.buildSyncPlan({ analysis: {} }, { bpm: 100, key: "C major" });
  assert.equal(raw.mode, "raw-preview");
  assert.equal(raw.sourceBpm, null);
});

test("metadata persistence is versioned and never stores Blob URLs or provider secrets", () => {
  assert.match(source, /hh\.music\.adaptive-library\.v1/);
  assert.match(source, /hh-music-adaptive-library/);
  assert.match(source, /indexedDB\.open/);
  assert.match(source, /availableThisSession = false/);
  assert.match(source, /localStorage\?\.setItem/);
  assert.doesNotMatch(source, /localStorage[^\n]+(?:arrayBuffer|decodeAudioData|createObjectURL)/);
  assert.doesNotMatch(source, /API[_-]?KEY|CLIENT[_-]?SECRET|BEGIN PRIVATE KEY|AIza[0-9A-Za-z_-]{24,}/i);
  for (const license of ["CC0", "CC BY", "CC BY-SA", "Royalty-free", "Được cấp phép riêng"]) assert.ok(source.includes(license));
});

test("favorites and named collections survive normalized metadata persistence", () => {
  const normalized = adaptiveLibrary.normalizeState({
    samples: {
      activeCollectionId: "collection-score",
      collections: [{ id: "favorites", name: "Yêu thích", sampleIds: [] }, { id: "collection-score", name: "Score", sampleIds: ["sample-1"] }],
      items: [{ id: "sample-1", name: "Theme.wav", favorite: true, collectionIds: ["collection-score"], license: { type: "Tự tạo", commercialUse: true }, analysis: { bpm: 96, key: "C minor", vector: [0.48, 0.2, 0.3, 0.1, 0.2, 0, 1] } }]
    }
  }, { source: "standalone", bpm: null, key: null, dna: null });
  assert.equal(normalized.samples.activeCollectionId, "collection-score");
  assert.equal(normalized.samples.items[0].favorite, true);
  assert.equal(normalized.samples.items[0].availableThisSession, false);
  assert.equal(normalized.samples.collections[1].sampleIds[0], "sample-1");
  assert.equal(normalized.samples.items[0].license.commercialUse, true);
});

test("browser workspaces include requested local media, cue and accessibility controls", () => {
  for (const marker of [
    "HTMLMediaElement metadata", "loadedmetadata", "video/*,audio/*,image/*", "data-mal-drop=\"adaptive\"",
    "data-mal-action=\"add-cue\"", "data-mal-action=\"retime\"", "export-cue-json", "export-cue-csv",
    "decodeAudioData", "getChannelData", "data-mal-search", "SIMILAR SOUND", "SYNC PLAN",
    "license.commercialUse", "role=\"status\" aria-live=\"polite\"", "Không upload", "Không phá hủy"
  ]) assert.ok(source.includes(marker), `missing ${marker}`);
  assert.match(styles, /@media \(max-width: 520px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /overflow: auto/);
});

test("mount/unmount lifecycle cleans listeners, object URLs, audio and contexts", () => {
  const listeners = new Map();
  const classes = new Set();
  const host = {
    innerHTML: "",
    classList: { add(value) { classes.add(value); }, remove(value) { classes.delete(value); } },
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name, handler) { if (listeners.get(name) === handler) listeners.delete(name); },
    querySelector() { return null; },
    closest() { return null; },
    insertAdjacentHTML() {},
    replaceChildren() { this.innerHTML = ""; }
  };
  const controller = adaptiveLibrary.mount(host, { view: "sample-browser" });
  assert.equal(controller.view, "sample-browser");
  assert.match(host.innerHTML, /Semantic Sample Browser/);
  assert.equal(listeners.size, 6);
  assert.equal(classes.has("hh-music-adaptive-library"), true);
  assert.equal(controller.unmount(), true);
  assert.equal(listeners.size, 0);
  assert.equal(classes.size, 0);
  assert.equal(host.innerHTML, "");
  assert.equal(adaptiveLibrary.unmount(host), false);
  for (const cleanup of ["URL?.revokeObjectURL", "audio.pause", "audio.removeAttribute", "audioContext.close", "context.close", "files.clear", "urls.clear"] ) assert.ok(source.includes(cleanup), `missing cleanup ${cleanup}`);
});
