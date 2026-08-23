const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const audio = require(path.join(root, "media-audio-studio.js"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Audio Studio bounds persisted DSP controls and trim ranges", () => {
  const state = audio.normalizeState({ gain: 90, fadeIn: -4, fadeOut: 99, gate: -200, limiter: 4 });
  assert.equal(state.gain, 12);
  assert.equal(state.fadeIn, 0);
  assert.equal(state.fadeOut, 10);
  assert.equal(state.gate, -80);
  assert.equal(state.limiter, 0);
  assert.deepEqual(audio.trimRange(120, 15, 80), { start: 15, end: 80, duration: 65 });
  assert.deepEqual(audio.trimRange(10, 20, 2), { start: 10, end: 10, duration: 0 });
});

test("Audio Studio exports a valid PCM WAV container", () => {
  const channels = [new Float32Array([0, .5, -1, 1])];
  const buffer = { numberOfChannels: 1, sampleRate: 48000, length: 4, getChannelData: (index) => channels[index] };
  const wav = audio.encodeWav(buffer);
  assert.equal(new DataView(wav).getUint32(24, true), 48000);
  assert.equal(Buffer.from(wav).subarray(0, 4).toString(), "RIFF");
  assert.equal(Buffer.from(wav).subarray(8, 12).toString(), "WAVE");
  assert.equal(wav.byteLength, 52);
});

test("Audio Studio provides bounded podcast DSP, loudness analysis and delivery metadata", () => {
  const state = audio.normalizeState({ pan: 500, highPass: 900, markers: [{ time: 3.2, title: "Mở đầu" }], podcast: { title: "Vũ trụ", episode: 4 } });
  assert.equal(state.pan, 100);
  assert.equal(state.highPass, 400);
  assert.equal(state.markers[0].title, "Mở đầu");
  assert.match(audio.chaptersJson(state), /"startTime": 3\.2/);
  assert.match(audio.rssItem(state, 125), /<itunes:episode>4<\/itunes:episode>/);
  const channels = [new Float32Array([0, .25, -.5, 1])];
  const buffer = { numberOfChannels: 1, sampleRate: 4, length: 4, duration: 1, getChannelData: () => channels[0] };
  const metrics = audio.estimateLoudness(buffer);
  assert.ok(Number.isFinite(metrics.peakDbfs));
  assert.ok(Number.isFinite(metrics.estimatedLufs));
});

test("Audio Studio keeps a bounded immutable multitrack mixer model", () => {
  const buffer = { length: 8000, duration: 1, sampleRate: 8000, numberOfChannels: 1, getChannelData: () => new Float32Array(8000) };
  const original = [{ id: "voice", name: "<Voice>", gain: 99, pan: -999, file: { name: "voice.wav" }, buffer }];
  const normalized = audio.updateTrackList(original, { type: "update", id: "voice", patch: { solo: true } });
  assert.equal(original[0].solo, undefined);
  assert.equal(normalized[0].name, "Voice");
  assert.equal(normalized[0].gain, 12);
  assert.equal(normalized[0].pan, -100);
  assert.equal(normalized[0].solo, true);
  const duplicated = audio.updateTrackList(normalized, { type: "duplicate", id: "voice", newId: "voice-copy" });
  assert.equal(duplicated.length, 2);
  assert.equal(duplicated[1].buffer, buffer);
  const moved = audio.updateTrackList(duplicated, { type: "move", id: "voice-copy", delta: -1 });
  assert.equal(moved[0].id, "voice-copy");
  const estimate = audio.renderEstimate(moved, { start: 0, end: 1 });
  assert.deepEqual({ frames: estimate.frames, channels: estimate.channels, allowed: estimate.allowed }, { frames: 8000, channels: 1, allowed: true });
});

test("Audio Studio asynchronously encodes WAV without changing its PCM contract", async () => {
  const channels = [new Float32Array([0, .25, -.5, 1])];
  const buffer = { numberOfChannels: 1, sampleRate: 48000, length: 4, getChannelData: () => channels[0] };
  const sync = Buffer.from(audio.encodeWav(buffer));
  const asyncWav = Buffer.from(await audio.encodeWavAsync(buffer));
  assert.deepEqual(asyncWav, sync);
});

test("Audio Studio silence analysis is truthful and cancellable-friendly", async () => {
  const silent = new Float32Array(8000);
  const buffer = { numberOfChannels: 1, sampleRate: 8000, length: silent.length, duration: 1, getChannelData: () => silent };
  assert.deepEqual(audio.findSpeechBounds(buffer), { start: 0, end: 0 });
  assert.deepEqual(await audio.findSpeechBoundsAsync(buffer), { start: 0, end: 0 });
});

test("Audio Studio is routed, cached, responsive and honest about local processing", () => {
  const shell = read("script.js"), page = read("media-design-page.js"), css = read("media-audio-studio.css"), loader = read("performance-loader.js"), worker = read("sw.js"), source = read("media-audio-studio.js");
  assert.match(shell, /id: "audio-workspace"/);
  assert.match(page, /HHMediaAudioStudio\?\.mount/);
  assert.match(source, /decodeAudioData/);
  assert.match(source, /getUserMedia/);
  assert.match(source, /PCM 16-bit/);
  assert.match(source, /Global Media Bin/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(source, /Podcast Namespace chapters JSON/);
  assert.match(source, /findSpeechBounds/);
  assert.match(source, /renderMixAsync/);
  assert.match(source, /data-mas-track-action="duplicate"/);
  assert.match(source, /session\.renderController\?\.abort/);
  assert.match(css, /\.mas-track-mixer/);
  for (const asset of ["media-audio-studio.css?v=5", "media-audio-studio.js?v=3"]) {
    assert.match(loader, new RegExp(asset.replace(/[.?]/g, "\\$&")));
    assert.match(worker, new RegExp(asset.replace(/[.?]/g, "\\$&")));
  }
});
