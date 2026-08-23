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

test("Audio Studio split and trim preserve source ranges, offsets and loop duration", () => {
  const source = [{ id: "dialogue", name: "Dialogue", sourceDuration: 10, sourceIn: 2, sourceOut: 8, offset: 3 }];
  const split = audio.updateTrackList(source, { type: "split", id: "dialogue", at: 5, newId: "dialogue-b" });
  assert.equal(split.length, 2);
  assert.deepEqual(split.map(({ id, offset, sourceIn, sourceOut }) => ({ id, offset, sourceIn, sourceOut })), [
    { id: "dialogue", offset: 3, sourceIn: 2, sourceOut: 4 },
    { id: "dialogue-b", offset: 5, sourceIn: 4, sourceOut: 8 }
  ]);
  const trimmed = audio.updateTrackList(source, { type: "trim", id: "dialogue", start: 4, end: 7 });
  assert.deepEqual({ offset: trimmed[0].offset, sourceIn: trimmed[0].sourceIn, sourceOut: trimmed[0].sourceOut }, { offset: 4, sourceIn: 3, sourceOut: 6 });
  assert.equal(audio.trackSegmentDuration(trimmed[0]), 3);
  assert.equal(audio.trackTimelineDuration({ ...trimmed[0], loop: true, loopCount: 4 }), 12);
});

test("Audio Studio automation and regions stay sorted, bounded and immutable", () => {
  const points = [{ time: 10, value: 2 }, { time: 0, value: -.5 }];
  assert.equal(audio.automationValue(points, 5), .75);
  assert.deepEqual(points, [{ time: 10, value: 2 }, { time: 0, value: -.5 }]);
  let regions = audio.updateRegions([], { type: "add", region: { id: "later", start: 8, end: 10, title: "<Sau>" } });
  regions = audio.updateRegions(regions, { type: "add", region: { id: "first", start: 1, end: 4, title: "Đầu" } });
  assert.deepEqual(regions.map((region) => region.id), ["first", "later"]);
  assert.equal(regions[1].title, "Sau");
  assert.deepEqual(audio.updateRegions(regions, { type: "update", id: "first", patch: { start: -5, end: 2 } })[0], { id: "first", start: 0, end: 2, title: "Đầu" });
  assert.equal(audio.updateRegions(regions, { type: "remove", id: "later" }).length, 1);
  const bounded = Array.from({ length: audio.LIMITS.regions + 20 }, (_, index) => ({ id: `r${index}`, start: index, end: index + 1 }));
  assert.equal(audio.updateRegions(bounded).length, audio.LIMITS.regions);
});

test("Audio Studio sidechain ducking lowers music while voice is active", async () => {
  const sampleRate = 1000, length = 1000;
  const makeBuffer = (sample) => ({ length, duration: 1, sampleRate, numberOfChannels: 1, getChannelData: () => new Float32Array(length).fill(sample) });
  const context = { createBuffer: (channels, frames, rate) => { const data = Array.from({ length: channels }, () => new Float32Array(frames)); return { numberOfChannels: channels, length: frames, duration: frames / rate, sampleRate: rate, getChannelData: (channel) => data[channel] }; } };
  const tracks = [
    { id: "voice", role: "voice", buffer: makeBuffer(.35), sourceDuration: 1, sourceOut: 1 },
    { id: "music", role: "music", buffer: makeBuffer(.35), sourceDuration: 1, sourceOut: 1 }
  ];
  const base = { normalize: false, compressor: false, gain: 0, gate: -80, limiter: 0, highPass: 0, fadeIn: 0, fadeOut: 0, start: 0, end: 1 };
  const plain = await audio.renderMixAsync(context, tracks, { ...base, ducking: { enabled: false } });
  const ducked = await audio.renderMixAsync(context, tracks, { ...base, ducking: { enabled: true, amountDb: 18, thresholdDb: -40, attack: .005, release: .2 } });
  const average = (buffer) => buffer.getChannelData(0).slice(500).reduce((sum, value) => sum + Math.abs(value), 0) / 500;
  assert.ok(average(ducked) < average(plain) * .75, `${average(ducked)} should be lower than ${average(plain)}`);
});

test("Audio Studio podcast delivery preserves validated metadata and full project structure", () => {
  const state = audio.normalizeState({
    podcast: { title: "Tập 01", show: "HH Show", author: "Hoàng", description: "Mô tả", episode: 8, language: "vi-VN", category: "Education", explicit: true },
    markers: [{ id: "chapter-1", time: 2, title: "Mở đầu" }], regions: [{ id: "region-1", start: 1, end: 4, title: "Intro" }]
  });
  const rss = audio.rssItem(state, 65.4);
  assert.match(rss, /<dc:language>vi-VN<\/dc:language>/);
  assert.match(rss, /<itunes:category text="Education" \/>/);
  assert.match(rss, /<itunes:explicit>true<\/itunes:explicit>/);
  const manifest = JSON.parse(audio.podcastManifest(state, [{ id: "voice", name: "Voice", role: "voice", sourceDuration: 5, sourceOut: 5, automation: [{ time: 1, value: .8 }] }], 5));
  assert.equal(manifest.schema, "hh.podcast-manifest.v1");
  assert.equal(manifest.chapters.length, 1);
  assert.equal(manifest.regions.length, 1);
  assert.deepEqual(manifest.tracks[0].automation, [{ time: 1, value: .8 }]);
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
  assert.match(css, /@media\(max-width:980px\)[\s\S]*\.mdp-cockpit:has\(\.mas-studio\) \.media-design-page__work\{overflow:auto!important\}/);
  for (const asset of ["media-audio-studio.css?v=6", "media-audio-studio.js?v=4"]) {
    assert.match(loader, new RegExp(asset.replace(/[.?]/g, "\\$&")));
    assert.match(worker, new RegExp(asset.replace(/[.?]/g, "\\$&")));
  }
});
