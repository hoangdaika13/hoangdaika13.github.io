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
  for (const asset of ["media-audio-studio.css?v=4", "media-audio-studio.js?v=2"]) {
    assert.match(loader, new RegExp(asset.replace(/[.?]/g, "\\$&")));
    assert.match(worker, new RegExp(asset.replace(/[.?]/g, "\\$&")));
  }
});
