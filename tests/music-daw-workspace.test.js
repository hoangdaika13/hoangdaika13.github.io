const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("music-daw-workspace.js");
const styles = read("music-daw-workspace.css");
const helpers = require(path.join(root, "music-daw-workspace.js"));

test("DAW exposes the requested global mount contract and only supported views", () => {
  assert.match(source, /root\.HHMusicDAWWorkspace = api/);
  assert.match(source, /const api = \{ supports:/);
  assert.equal(helpers.supports("arrange"), true);
  assert.equal(helpers.supports("record"), true);
  assert.equal(helpers.supports("master"), false);
  assert.equal(helpers.supports(""), false);
});

test("DAW keeps versioned local-first project and binary asset storage", () => {
  assert.equal(helpers.STORAGE_KEY, "hh.music-daw-workspace.v1");
  assert.match(source, /hh-music-daw-assets-v1/);
  assert.match(source, /indexedDB\.open/);
  assert.match(source, /objectStore\(DATABASE_STORE\)\.put/);
  assert.match(source, /Audio blob không nằm trong JSON/);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket\s*\(/);
});

test("DAW implements real browser audio import, decode, waveform and playback", () => {
  for (const contract of [
    /accept="audio\/\*"/, /data-audio-drop/, /decodeAudioData/, /getChannelData\(0\)/,
    /createBufferSource\(\)/, /createGain\(\)/, /createStereoPanner/,
    /createBiquadFilter\(\)/, /createDynamicsCompressor\(\)/,
    /source\.start\(when, offset, duration\)/
  ]) assert.match(source, contract);
});

test("DAW editing contract includes clips, tracks, take lanes and timing tools", () => {
  for (const contract of [
    /function splitSelectedClip/, /function duplicateSelected/, /function deleteSelected/,
    /new-take/, /sourceStart/, /fadeIn/, /fadeOut/, /snapTime/,
    /add-marker/, /loopStart/, /loopEnd/, /project\.zoom/
  ]) assert.match(source, contract);
  assert.deepEqual(helpers.SIGNATURES, ["3/4", "4/4", "6/8", "7/8"]);
  assert.equal(helpers.snapValue(3.74, 0.5), 3.5);
  assert.equal(helpers.snapValue(-4, 0), 0);
});

test("record mode requests permission only from explicit record action", () => {
  assert.match(source, /data-action="record-toggle"/);
  assert.match(source, /action === "record-toggle"/);
  assert.match(source, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(source, /new root\.MediaRecorder/);
  assert.match(source, /NotAllowedError/);
  assert.match(source, /getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(source, /URL\.revokeObjectURL/);
  const getUserMediaPosition = source.indexOf("getUserMedia({ audio");
  const startRecordingPosition = source.indexOf("async function startRecording");
  assert.ok(getUserMediaPosition > startRecordingPosition, "Permission request must stay inside startRecording");
});

test("advanced DSP adapters are represented honestly", () => {
  assert.match(source, /warp: "adapter-unavailable"/);
  assert.match(source, /timeStretch: "adapter-unavailable"/);
  assert.match(source, /Chưa có engine DSP/);
  assert.doesNotMatch(source, /pro-quality|studio-grade warp|professional time stretch/i);
});

test("state normalization bounds unsafe or malformed project values", () => {
  const state = helpers.normalizeState({
    project: { bpm: 999, signature: "13/9", zoom: 4, snap: 99 },
    tracks: [{ id: "t", name: "Track", volume: 9, pan: -8, clips: [{ id: "c", name: "Clip", start: -3, duration: 0, gain: 8, lane: 20 }] }]
  });
  assert.equal(state.project.bpm, 260);
  assert.equal(state.project.signature, "4/4");
  assert.equal(state.project.zoom, 16);
  assert.equal(state.project.snap, 1);
  assert.equal(state.tracks[0].volume, 1.2);
  assert.equal(state.tracks[0].pan, -1);
  assert.equal(state.tracks[0].clips[0].start, 0);
  assert.equal(state.tracks[0].clips[0].duration, 1);
  assert.equal(state.tracks[0].clips[0].gain, 2);
  assert.equal(state.tracks[0].clips[0].lane, 5);
});

test("waveform helper down-samples browser AudioBuffer-like data deterministically", () => {
  const data = Float32Array.from({ length: 100 }, (_, index) => index % 2 ? -0.5 : 0.25);
  const peaks = helpers.computePeaks({ length: data.length, getChannelData: () => data }, 10);
  assert.equal(peaks.length, 10);
  assert.ok(peaks.every((peak) => peak === 0.5));
});

test("all user-facing interpolated strings pass through the HTML escaper", () => {
  assert.equal(helpers.escapeHtml(`<img src=x onerror="bad">'&`), "&lt;img src=x onerror=&quot;bad&quot;&gt;&#39;&amp;");
  for (const pattern of [
    /escapeHtml\(runtime\.state\.project\.name\)/,
    /escapeHtml\(asset\.name\)/,
    /escapeHtml\(clip\.name\)/,
    /escapeHtml\(track\.name\)/,
    /escapeHtml\(prompt\.result\)/,
    /escapeHtml\(marker\.label\)/
  ]) assert.match(source, pattern);
});

test("DAW renders professional workspace regions and semantic controls", () => {
  for (const contract of [
    /mdaw-library/, /mdaw-arrangement/, /mdaw-inspector/, /mdaw-console/,
    /aria-label="Timeline nhiều track"/, /role="tablist"/, /aria-live="polite"/,
    /data-time-display/, /data-master-meter/, /data-input-meter/
  ]) assert.match(source, contract);
});

test("DAW styles support focus, 375px layouts and reduced motion", () => {
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(max-width: 390px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /overflow-x: auto/);
  assert.match(styles, /grid-template-columns: 236px minmax\(420px, 1fr\) 272px/);
  assert.doesNotMatch(styles, /letter-spacing:\s*-/);
});

test("time formatter remains stable for transport and timeline labels", () => {
  assert.equal(helpers.formatTime(0), "00:00.00");
  assert.equal(helpers.formatTime(65.25), "01:05.25");
  assert.equal(helpers.formatTime(-5), "00:00.00");
});
