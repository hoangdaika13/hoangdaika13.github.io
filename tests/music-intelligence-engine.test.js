const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "music-intelligence-engine.js"), "utf8");
const css = fs.readFileSync(path.join(root, "music-intelligence-engine.css"), "utf8");
const engine = require(path.join(root, "music-intelligence-engine.js"));

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    value(key) { return values.get(key); }
  };
}

function ascii(bytes, start, length) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

test("exposes browser contracts for both intelligence views", () => {
  assert.equal(engine.VERSION, 1);
  assert.equal(engine.STORAGE_KEY, "hh.music.intelligence-engine.v1");
  assert.equal(engine.SHARED_STORAGE_KEY, "hh.music.shared-project.v1");
  assert.equal(engine.PROJECT_EVENT, "hh:music-project-change");
  assert.deepEqual(engine.VIEWS, ["musical-brain", "audio-midi"]);
  assert.equal(engine.supports("musical-brain"), true);
  assert.equal(engine.supports("audio-midi"), true);
  assert.equal(engine.supports("composer"), false);
  assert.deepEqual(Object.keys(global.HHMusicIntelligenceEngine).sort(), ["mount", "supports", "unmount"]);
  assert.equal(Object.isFrozen(global.HHMusicIntelligenceEngine), true);
});

test("shared project context is frozen, versioned and publishes immutable copies", () => {
  const storage = memoryStorage();
  const context = engine.createProjectContext(storage, null);
  const changes = [];
  const unsubscribe = context.subscribe((snapshot, detail) => changes.push({ snapshot, detail }));

  const original = context.getSnapshot();
  original.songDNA.name = "Không được ghi ngược";
  assert.notEqual(context.getSongDNA().name, "Không được ghi ngược");

  context.updateSongDNA({ name: "DNA kiểm thử", instruments: ["Piano", "Bass"] });
  context.updateChordTrack([{ id: "x", start: 0, duration: 2, root: "D", quality: "minor" }]);
  unsubscribe();
  context.updateSongDNA({ motif: "Không gửi sau unsubscribe" });

  assert.equal(context.getSongDNA().name, "DNA kiểm thử");
  assert.equal(context.getChordTrack()[0].label, "Dm");
  assert.equal(changes.length, 2);
  assert.equal(JSON.parse(storage.value(engine.SHARED_STORAGE_KEY)).version, 1);
  assert.deepEqual(Object.keys(global.HHMusicProjectContext).sort(), [
    "getChordTrack", "getSnapshot", "getSongDNA", "subscribe", "updateChordTrack", "updateSongDNA"
  ]);
  assert.equal(Object.isFrozen(global.HHMusicProjectContext), true);
  assert.match(source, /new globalScope\.CustomEvent\(PROJECT_EVENT/);
  assert.match(source, /hh:music-project-change/);

  context.updateChordTrack([]);
  assert.deepEqual(context.getChordTrack(), [], "Chord Track trống phải được giữ nguyên");
});

test("engine persistence is normalized and never stores audio binary data", () => {
  const storage = memoryStorage();
  const state = engine.saveState({
    version: 1,
    view: "audio-midi",
    analysis: { fileName: "<track>.wav", bpm: 900, key: "A minor", duration: 12 },
    midi: { quantize: "1/8", notes: [{ pitch: 300, velocity: -2, start: -5, duration: 0 }] },
    audioBuffer: "binary-must-not-persist",
    arrayBuffer: [1, 2, 3]
  }, storage);
  assert.equal(state.analysis.bpm, 260);
  assert.equal(state.midi.notes[0].pitch, 127);
  assert.equal(state.midi.notes[0].velocity, 1);
  assert.equal(state.audioBuffer, undefined);
  assert.doesNotMatch(storage.value(engine.STORAGE_KEY), /binary-must-not-persist|arrayBuffer/);
  assert.equal(engine.loadState(storage).view, "audio-midi");
});

test("Chord Track supports CRUD, transpose and deterministic tonal suggestions", () => {
  let track = [];
  track = engine.addChord(track, { id: "one", root: "C", quality: "major", duration: 2 });
  track = engine.addChord(track, { id: "two", root: "A", quality: "minor", duration: 2 });
  assert.deepEqual(track.map((item) => [item.label, item.start]), [["C", 0], ["Am", 2]]);

  track = engine.updateChord(track, "two", { root: "D", quality: "minor", duration: 4 });
  assert.equal(track[1].label, "Dm");
  assert.equal(track[1].duration, 4);

  const transposed = engine.transposeChordTrack(track, 2);
  assert.deepEqual(transposed.map((item) => item.label), ["D", "Em"]);
  const suggestionsA = engine.suggestNextChords(track, "C major");
  const suggestionsB = engine.suggestNextChords(track, "C major");
  assert.deepEqual(suggestionsA, suggestionsB);
  assert.equal(suggestionsA.length, 4);
  assert.ok(suggestionsA.every((item) => engine.ROOTS.includes(item.root) && item.reason));
  assert.equal(engine.deleteChord(track, "one").length, 1);
});

test("local PCM analysis is deterministic and returns tempo, key, chords and structure", () => {
  const sampleRate = 8000;
  const duration = 8;
  const samples = new Float32Array(sampleRate * duration);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.sin(2 * Math.PI * 220 * (index / sampleRate)) * 0.09;
  }
  for (let beat = 0; beat < duration * 2; beat += 1) {
    const start = Math.floor(beat * 0.5 * sampleRate);
    for (let offset = 0; offset < 80; offset += 1) samples[start + offset] += (1 - offset / 80) * 0.82;
  }
  const first = engine.analyzePCM(samples, sampleRate);
  const second = engine.analyzePCM(samples, sampleRate);
  assert.deepEqual(first, second);
  assert.ok(first.bpm >= 105 && first.bpm <= 135, `BPM thực tế nhận được: ${first.bpm}`);
  assert.match(first.key, /^[A-G]#? (major|minor)$/);
  assert.ok(first.chords.length > 0);
  assert.equal(first.structure.length, 3);
  assert.equal(first.waveform.length, 120);
  assert.throws(() => engine.analyzePCM([], 8000), /không hợp lệ/i);
});

test("Audio-to-MIDI detects a stable monophonic pitch and quantizes events", () => {
  const sampleRate = 8000;
  const samples = Float32Array.from({ length: sampleRate * 2 }, (_, index) => Math.sin(2 * Math.PI * 440 * (index / sampleRate)) * 0.35);
  const pitch = engine.detectPitch(samples.subarray(0, 1024), sampleRate);
  assert.ok(pitch);
  assert.equal(pitch.midi, 69);
  assert.match(engine.noteName(pitch.midi), /^A4$/);

  const notes = engine.detectNoteEvents(samples, sampleRate);
  assert.ok(notes.length >= 1);
  assert.ok(notes.every((note) => note.pitch === 69));
  const quantized = engine.quantizeNoteEvents([
    { id: "a", start: 0.13, duration: 0.26, pitch: 60, velocity: 80 },
    { id: "b", start: 0.37, duration: 0.12, pitch: 64, velocity: 90 }
  ], 120, "1/16");
  assert.equal(engine.quantizeStepSeconds("1/16", 120), 0.125);
  assert.deepEqual(quantized.map((note) => [note.start, note.duration]), [[0.125, 0.25], [0.375, 0.125]]);
});

test("MIDI export creates a valid deterministic SMF type 0 stream", () => {
  const options = {
    bpm: 120,
    timeSignature: "4/4",
    title: "HH Test",
    chords: [{ id: "c", start: 0, duration: 2, root: "C", quality: "major" }],
    notes: [
      { id: "n1", start: 0, duration: 0.5, pitch: 60, velocity: 90, channel: 0 },
      { id: "n2", start: 0.5, duration: 0.5, pitch: 64, velocity: 88, channel: 0 }
    ]
  };
  const first = engine.createMidiSMF(options);
  const second = engine.createMidiSMF(options);
  assert.ok(first instanceof Uint8Array);
  assert.deepEqual(first, second);
  assert.equal(ascii(first, 0, 4), "MThd");
  assert.equal(ascii(first, 14, 4), "MTrk");
  assert.deepEqual([...first.slice(-4)], [0, 255, 47, 0]);
  assert.ok(first.includes(0x90), "Phải có Note On");
  assert.ok(first.includes(0x80), "Phải có Note Off");
  assert.ok(first.includes(0x91), "Phải có chord note trên MIDI channel riêng");
  assert.deepEqual(engine.variableLength(0), [0]);
  assert.deepEqual(engine.variableLength(128), [129, 0]);
});

test("UI contract is Vietnamese, escaped, accessible, local-first and honest", () => {
  assert.equal(engine.escapeHtml(`<img src=x onerror="bad">'&`), "&lt;img src=x onerror=&quot;bad&quot;&gt;&#39;&amp;");
  for (const marker of [
    "data-mie-audio-input", "accept=\"audio/*", "decodeAudioData", "downmixAudioBuffer",
    "data-mie-chord-field", "data-mie-dna-field", "data-mie-note-field", "data-mie-quantize",
    "createMidiSMF", "audio/midi", "aria-live=\"polite\"", "role=\"tablist\"",
    "Phân tích deterministic bằng Web Audio trên thiết bị", "Không tải audio lên máy chủ"
  ]) assert.match(source, new RegExp(marker.replace(/[()*+]/g, "\\$&")));
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}/);
  assert.doesNotMatch(source, /localStorage\.setItem\([^\n]+(?:audioBuffer|arrayBuffer|dataURL|base64)/i);
});

test("stylesheet is scoped, responsive, keyboard accessible and motion aware", () => {
  assert.match(css, /^\.mie\s*\{/);
  assert.match(css, /\.mie-brain-layout/);
  assert.match(css, /\.mie-midi-layout/);
  assert.match(css, /\.mie-piano-roll/);
  assert.match(css, /\.mie-chord-track/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /overflow-x: auto/);
  assert.doesNotMatch(css, /font-size:\s*[^;]*vw/);
  assert.doesNotMatch(css, /letter-spacing:\s*-/);
});
