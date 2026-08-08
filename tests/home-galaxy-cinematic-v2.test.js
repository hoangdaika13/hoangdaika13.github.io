const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("home-galaxy-command.js");
const styles = read("home-galaxy-command.css");

test("cinematic galaxy exposes layered color and depth effects", () => {
  for (const effect of [
    "hgc-prism-fog",
    "hgc-aurora-ribbons",
    "hgc-light-rays",
    "hgc-cosmic-dust",
    "hgc-lens-flare",
    "hgc-cursor-light",
    "hgc-orbit-particles",
    "hgc-scanner-ring",
    "hgc-focus-beam",
    "hgc-plasma-arcs"
  ]) {
    assert.ok(source.includes(effect), `missing cinematic layer ${effect}`);
    assert.ok(styles.includes(effect), `missing style for ${effect}`);
  }
});

test("meteor system is colorful, depth-aware and bounded", () => {
  assert.match(source, /\["cyan", "violet", "pink", "gold"\]/);
  assert.match(source, /\["far", "middle", "near"\]/);
  assert.match(source, /childElementCount >= activeLimit/);
  assert.match(source, /activeLimit[\s\S]*?\? 3[\s\S]*?\? 1 : 2/);
  assert.match(source, /function meteorShower/);
  assert.match(source, /document\.hidden/);
});

test("pointer effects use one animation frame and capability quality gates", () => {
  assert.match(source, /pointerFrame = requestAnimationFrame/);
  assert.match(source, /navigator\.deviceMemory/);
  assert.match(source, /navigator\.hardwareConcurrency/);
  assert.match(source, /navigator\.connection\?\.saveData/);
  assert.match(source, /dataset\.hgcQuality = detectQuality/);
  assert.match(source, /visibilitychange/);
  assert.match(styles, /\[data-hgc-quality="low"\]/);
});

test("cinematic layers remain safe on mobile and reduced motion", () => {
  assert.match(styles, /@media\s*\(max-width:\s*700px\)/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /\[data-hgc-motion="static"\]/);
  assert.match(styles, /\.hgc-cursor-light\s*\{\s*display:\s*none/);
});
