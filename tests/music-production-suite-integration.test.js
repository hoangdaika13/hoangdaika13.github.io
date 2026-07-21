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
  for (const engine of ["HHMusicComposerLyrics", "HHMusicDAWWorkspace", "HHMusicAudioLabs", "HHMusicMixMaster", "HHMusicVisualStudio", "HHMusicPublishingRights"]) {
    assert.match(source, new RegExp(engine));
  }
  for (const room of ["stems", "vocal", "sound-design", "image-music", "realtime-jam", "visualizer", "rights"]) {
    assert.match(source, new RegExp(`id: "${room}"`));
  }
});

test("overview is responsive and honors reduced motion", () => {
  assert.match(css, /@media \(max-width:480px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(source, /hh\.music\.production-suite\.v1/);
  assert.match(source, /navigator\.mediaDevices\?\.getUserMedia/);
});
