const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "music-ai-studio.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "music-ai-studio.css"), "utf8");

function loadProducer() {
  const window = {};
  const context = vm.createContext({
    window,
    location: { origin: "https://example.test" },
    console,
    setTimeout,
    clearTimeout,
    Blob,
    URL
  });
  vm.runInContext(source, context, { filename: "music-ai-studio.js" });
  return window.HHMusicAIStudio.producer;
}

test("One-click Producer exposes deterministic variants for the four long-form genres", () => {
  const producer = loadProducer();
  for (const genre of ["piano", "meditation", "jazz", "lofi"]) {
    const project = { name: "HH Session", genre, bpm: 64, hours: 3 };
    const first = producer.buildProducerVariants(project, 6, 75, "rainy cabin");
    const second = producer.buildProducerVariants(project, 6, 75, "rainy cabin");
    assert.deepEqual(first, second);
    assert.equal(first.length, 6);
    assert.equal(new Set(first.map((item) => item.id)).size, 6);
    assert.ok(first.every((item) => item.genre === genre));
    assert.ok(first.every((item) => item.bpm >= 40 && item.bpm <= 120));
    assert.ok(first.every((item) => item.seed >= 0 && item.arrangement && item.instruments));
  }
});

test("Tempo drift analyzer measures the beginning, middle and end locally", () => {
  const producer = loadProducer();
  const sampleRate = 1000;
  const samples = new Float32Array(sampleRate * 30);
  for (let second = 0; second < 30; second += 1) {
    const start = second * sampleRate;
    for (let index = 0; index < 35; index += 1) samples[start + index] = 1 - index / 35;
  }
  const result = producer.estimateTempoDrift(samples, sampleRate, 60);
  assert.equal(result.tempoWindows.length, 3);
  assert.ok(result.tempoBpm >= 58 && result.tempoBpm <= 62, `received ${result.tempoBpm} BPM`);
  assert.ok(result.tempoDrift <= 1);
});

test("Smart Loop enforces the product contract of one to five hours", () => {
  const producer = loadProducer();
  assert.equal(producer.normalizeLoopTargetSeconds("00:10:00"), 3600);
  assert.equal(producer.normalizeLoopTargetSeconds("03:30:00"), 12600);
  assert.equal(producer.normalizeLoopTargetSeconds("08:00:00"), 18000);
  assert.equal(producer.normalizeLoopTargetSeconds("invalid", 7200), 7200);
  assert.match(source, /từ 1 đến 5 giờ/);
  assert.doesNotMatch(source, /tối đa 8 giờ/);
});

test("Producer handoff carries honest stem, region, loop and YouTube metadata", () => {
  const producer = loadProducer();
  const handoff = producer.producerHandoffManifest();
  assert.equal(handoff.schema, "hh.music.producer-handoff.v1");
  assert.ok(handoff.stems.length >= 4);
  assert.ok(handoff.stems.every((stem) => stem.sourceStatus === "awaiting-real-audio"));
  assert.ok(handoff.regions.length >= 3);
  assert.equal(handoff.regions[0].startSeconds, 0);
  assert.match(handoff.loop.command, /ffmpeg/);
  assert.ok(Array.isArray(handoff.youtube.chapters));
});

test("Producer UI links every finishing step to a real specialized workspace", () => {
  for (const route of ["arrange", "stems", "audio-qa", "loop-builder", "visualizer", "chapters", "youtube-pack", "publish-checklist"]) {
    assert.match(source, new RegExp(`/music-ai/${route}`));
  }
  assert.match(source, /HH_MUSIC_STEM_ADAPTER/);
  assert.match(source, /needs-provider/);
  assert.match(source, /không giả lập thành công/i);
  assert.match(source, /hh\.music\.producer-handoff\.v1/);
  assert.match(source, /data-download-producer-handoff/);
  assert.match(styles, /\.mai-producer-command button:focus-visible/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
