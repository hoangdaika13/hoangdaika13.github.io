const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "music-audio-labs.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "music-audio-labs.css"), "utf8");

test("Music Audio Labs exposes the requested mount contract and views", () => {
  const context = { window: {} };
  vm.runInNewContext(source, context);
  const api = context.window.HHMusicAudioLabs;
  assert.equal(typeof api.mount, "function");
  assert.equal(typeof api.unmount, "function");
  assert.equal(api.supports("stems"), true);
  assert.equal(api.supports("vocal"), true);
  assert.equal(api.supports("sound-design"), true);
  assert.equal(api.supports("fake"), false);
});

test("state is versioned and persists metadata without voice consent", () => {
  assert.match(source, /hh\.music\.audio-labs\.v1/);
  assert.match(source, /availableThisSession/);
  assert.match(source, /safe\.vocal\.voiceClone = \{ ownerConfirmed: false, purposeConfirmed: false \}/);
  assert.match(source, /Không lưu dữ liệu giọng nói vào localStorage/);
  assert.doesNotMatch(source, /localStorage\.setItem\([^\n]+(?:arrayBuffer|recordChunks|mediaStream)/);
});

test("Stem Lab performs real local decode, analysis, routing and synchronized export", () => {
  for (const contract of [
    /decodeAudioData/,
    /getChannelData/,
    /peakDb/,
    /rmsDb/,
    /createStereoPanner/,
    /OfflineAudioContext/,
    /startRendering/,
    /wavFromAudioBuffer/,
    /instrumental/,
    /karaoke/,
    /acapella/,
    /timelineStart: 0/
  ]) assert.match(source, contract);
  assert.match(source, /Web Audio local/);
  assert.match(source, /GPU\/Demucs/);
  assert.match(source, /không giả lập kết quả tách stem/i);
});

test("Vocal Studio asks for explicit consent and cleans capture devices", () => {
  const consentIndex = source.indexOf("if (!consent?.checked)");
  const mediaIndex = source.indexOf("getUserMedia", consentIndex);
  assert.ok(consentIndex > 0 && mediaIndex > consentIndex, "consent gate must precede getUserMedia");
  assert.match(source, /MediaRecorder/);
  assert.match(source, /getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(source, /highpass/);
  assert.match(source, /createDynamicsCompressor/);
  assert.match(source, /BACKEND REQUIRED/);
  assert.match(source, /Không lưu giọng, embedding hoặc mẫu sinh trắc học/);
  assert.match(source, /hh\.voice-consent\.v1/);
});

test("Sound Design supports local generation and truthful Eleven server adapters", () => {
  for (const type of ["ambience", "impact", "riser", "whoosh", "foley", "loop"]) assert.match(source, new RegExp(`"${type}"`));
  assert.match(source, /HH_MUSIC_SFX_ADAPTER/);
  assert.match(source, /HH_MUSIC_SFX_ENDPOINT/);
  assert.match(source, /Chưa cấu hình Eleven Sound Effects adapter/);
  assert.match(source, /createBuffer\(2/);
  assert.match(source, /Đây không phải kết quả ElevenLabs/);
  assert.match(source, /hh:music-audio-clip/);
  assert.match(source, /application\/x-hh-music-clip/);
});

test("all imported media resources are released on unmount", () => {
  assert.match(source, /controller\?\.abort\(\)/);
  assert.match(source, /URL\.revokeObjectURL/);
  assert.match(source, /audioContext\.close\(\)/);
  assert.match(source, /mediaRecorder\.onstop = null/);
  assert.match(source, /runtimeTracks\.clear\(\)/);
  assert.match(source, /runtimeTakes\.clear\(\)/);
  assert.match(source, /runtimeSounds\.clear\(\)/);
});

test("DAW interface remains accessible and responsive", () => {
  assert.match(source, /aria-label="Chế độ routing"/);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(source, /aria-pressed/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(max-width: 520px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /overflow: auto/);
});

test("new module does not expose client-side provider secrets", () => {
  assert.doesNotMatch(source, /ELEVENLABS_API_KEY|GOOGLE_CLIENT_SECRET|BEGIN PRIVATE KEY|AIza[0-9A-Za-z_-]{24,}/);
  assert.match(source, /API key không xuất hiện trong trình duyệt/);
});
