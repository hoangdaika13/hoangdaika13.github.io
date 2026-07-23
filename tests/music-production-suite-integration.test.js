const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "music-production-suite.js"), "utf8");
const css = fs.readFileSync(path.join(root, "music-production-suite.css"), "utf8");

test("production suite exposes the shared mount contract", () => {
  assert.match(source, /HHMusicProductionSuite/);
  assert.match(source, /Object\.freeze\(\{ supports, mount, unmount \}\)/);
  for (const view of ["composer", "lyrics", "arrange", "record", "mix", "master", "video", "publish"]) {
    assert.match(source, new RegExp(`id: "${view}"`));
  }
});

test("suite dispatches every specialized room to a real engine", () => {
  for (const engine of ["HHMusicComposerLyrics", "HHMusicDAWWorkspace", "HHMusicAudioLabs", "HHMusicMixMaster", "HHMusicVisualStudio", "HHMusicPublishingRights", "HHMusicIntelligenceEngine", "HHMusicGenerativeArrangement", "HHMusicAdaptiveLibrary", "HHMusicMixPerformance", "HHMusicProjectGovernance"]) {
    assert.match(source, new RegExp(engine));
  }
  for (const room of ["musical-brain", "audio-midi", "session-band", "region-editor", "stems", "vocal", "sound-design", "adaptive-soundtrack", "sample-browser", "mix-doctor", "live-performance", "project-branches", "release-manager", "image-music", "realtime-jam", "visualizer", "rights"]) {
    assert.match(source, new RegExp(`id: "${room}"`));
  }
});

test("application shell loads every advanced music engine before the suite", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const loader = fs.readFileSync(path.join(root, "performance-loader.js"), "utf8");
  const registeredAssets = `${html}\n${loader}`;
  const engines = ["music-intelligence-engine", "music-generative-arrangement", "music-adaptive-library", "music-mix-performance", "music-project-governance"];
  for (const name of engines) {
    assert.match(registeredAssets, new RegExp(`${name}\\.css\\?v=1`));
    assert.match(registeredAssets, new RegExp(`${name}\\.js\\?v=1`));
    assert.ok(loader.indexOf(`${name}.js?v=1`) < loader.indexOf("music-production-suite.js?v=1"));
  }
});

test("overview is responsive and honors reduced motion", () => {
  assert.match(css, /@media \(max-width:480px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(source, /hh\.music\.production-suite\.v1/);
  assert.match(source, /navigator\.mediaDevices\?\.getUserMedia/);
});
