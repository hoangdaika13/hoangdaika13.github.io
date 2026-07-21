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

test("Stem Intelligence measures silence, noise and clipping locally", () => {
  for (const contract of [
    /function analyzeAudioHealth\(buffer\)/,
    /windowed-rms-local-v1/,
    /silenceThresholdDb/,
    /silenceRanges/,
    /noiseFloorDb/,
    /noiseRisk/,
    /clippedSamples/,
    /clippingRatio/,
    /clippingRanges/
  ]) assert.match(source, contract);
  assert.match(source, /Math\.abs\(sample\)/);
  assert.match(source, /clippingThreshold = 0\.999/);
  assert.match(source, /Nền .* dB/);
});

test("Stem replacement and synchronized WAV workflows stay non-destructive", () => {
  assert.match(source, /function resolvedStemTracks\(\)/);
  assert.match(source, /replacementTrackId/);
  assert.match(source, /status: "draft"/);
  assert.match(source, /preserveMixSettings: true/);
  assert.match(source, /function synchronizeStemTracks\(\)/);
  assert.match(source, /function exportSynchronizedStems\(\)/);
  assert.match(source, /renderSynchronizedTrack/);
  assert.match(source, /hh-sync-/);
  assert.match(source, /API key chỉ nằm ở server/);
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

test("Vocal comping uses take lanes and a non-destructive range playlist", () => {
  for (const contract of [
    /lane: state\.vocal\.takes\.length \+ 1/,
    /selection: \{ start: 0, end: 4 \}/,
    /compSegments/,
    /function addCompSegment\(\)/,
    /takeId: take\.id/,
    /function previewVocalComp\(\)/,
    /function exportVocalComp\(\)/,
    /hh-vocal-comp\.wav/,
    /audio gốc không bị cắt hoặc ghi đè/i
  ]) assert.match(source, contract);
});

test("Vocal controls distinguish local preview from optional backend metadata", () => {
  assert.match(source, /connectVocalPreviewChain/);
  assert.match(source, /deEsser\.frequency\.value = 7200/);
  assert.match(source, /breathControl/);
  assert.match(source, /timingCorrection/);
  assert.match(source, /harmonyAmount/);
  assert.match(source, /Trình duyệt không tự nhận là đã Auto-Tune/);
  assert.match(source, /không phải mô hình ML/);
});

test("Vietnamese lyric syllable cues are explicit editable metadata", () => {
  assert.match(source, /function createVietnameseSyllableCues\(\)/);
  assert.match(source, /kind: "syllable"/);
  assert.match(source, /language: "vi"/);
  assert.match(source, /Tạo cue âm tiết tiếng Việt/);
  assert.match(source, /tinh chỉnh thủ công/);
});

test("old manifest schemas remain stable and include optional project BPM/key", () => {
  assert.match(source, /schema: "hh\.music\.stems\.v1"/);
  assert.match(source, /schema: "hh\.music\.vocal-session\.v1"/);
  assert.match(source, /HHMusicProjectContext\?\.getSnapshot\?\.\(\)/);
  assert.match(source, /source: "standalone", bpm: null, key: null/);
  assert.match(source, /projectContext: getProjectMusicContext\(\)/);
  assert.match(source, /const projectContext = getProjectMusicContext\(\)/);
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
  assert.match(styles, /\.mal-comp-editor/);
  assert.match(styles, /\.mal-health-chip/);
  assert.match(styles, /\.mal-replacement/);
});

test("new module does not expose client-side provider secrets", () => {
  assert.doesNotMatch(source, /ELEVENLABS_API_KEY|GOOGLE_CLIENT_SECRET|BEGIN PRIVATE KEY|AIza[0-9A-Za-z_-]{24,}/);
  assert.match(source, /API key không xuất hiện trong trình duyệt/);
});
