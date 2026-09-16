const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Galaxy Resonance connects all 25 login planets to the existing renderer", () => {
  const html = read("index.html");
  const solar = read("auth-solar-secret.js");
  const living = read("auth-living-galaxy-3d.js");

  assert.equal([...html.matchAll(/data-hh-planet="\d+"/g)].length, 25);
  for (const eventName of ["hh:solar-resonance-stage", "hh:solar-resonance-preview", "hh:solar-resonance-reset"]) {
    assert.match(solar, new RegExp(eventName));
    assert.match(living, new RegExp(eventName));
  }
  assert.match(solar, /querySelectorAll\("\[data-hh-galaxy-key\]"\)/);
  assert.match(living, /resonanceTarget\(planet, index, resonanceAge, currentMode\)/);
  assert.match(living, /planet\.resonanceDirection/);
  assert.match(living, /planet\.resonancePace/);
  assert.match(living, /response\.orbitGlow/);
  assert.match(living, /response\.intensity/);
  assert.equal((living.match(/new THREE\.WebGLRenderer/g) || []).length, 1);
  assert.doesNotMatch(solar, /WebGLRenderer|createElement\("canvas"\)|getContext\("webgl/);
});

test("Galaxy Resonance previews branches without changing real planet navigation", () => {
  const solar = read("auth-solar-secret.js");
  assert.match(solar, /const previewBranch/);
  assert.match(solar, /pointerover[\s\S]*previewBranch/);
  assert.match(solar, /focusin[\s\S]*previewBranch/);
  assert.match(solar, /clearResonancePreview\(\);[\s\S]*outcome = branch/);
  assert.doesNotMatch(solar, /HHHGalaxy\.select|activeCategory\s*=|setAttribute\("aria-selected"|setAttribute\("tabindex"/);
  for (const branch of ["portal", "orbit", "ufo", "sleep", "merge"]) {
    assert.match(solar, new RegExp(`${branch}: Object\\.freeze`));
  }
});

test("Galaxy Resonance restores transient state and has safe visual fallbacks", () => {
  const solar = read("auth-solar-secret.js");
  const css = read("auth-solar-secret.css");
  const living = read("auth-living-galaxy-3d.js");

  assert.match(solar, /captureGalaxyState/);
  assert.match(solar, /restoreGalaxyState/);
  assert.match(solar, /RESONANCE_STYLE_PROPS/);
  assert.match(solar, /closeSecret[\s\S]*restoreGalaxyState/);
  assert.match(solar, /pagehide[\s\S]*restoreGalaxyState/);
  assert.match(living, /removeEventListener\("hh:solar-resonance-stage"/);
  assert.match(living, /resonance\.active = false/);
  assert.match(css, /\.hh-solar-resonance-fx[\s\S]*pointer-events:\s*none\s*!important/);
  assert.match(css, /not\(\.is-webgl-ready\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /data-motion-level="off"/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.doesNotMatch(css, /\.hh-h-galaxy\.is-solar-resonating[^\{]*\.hh-galaxy-planet\s*\{[^}]*transform:/);
});

test("Galaxy Resonance keeps the puzzle accessible and stages auto-solve", () => {
  const solar = read("auth-solar-secret.js");
  assert.match(solar, /ArrowLeft|ArrowRight|ArrowUp|ArrowDown/);
  assert.match(solar, /dragstart|dragover|drop/);
  assert.match(solar, /const steps = \[/);
  assert.match(solar, /is-solar-puzzle-solving/);
  assert.match(solar, /reducedMotion\?\.matches/);
  assert.match(solar, /puzzleCorrectCount/);
  assert.match(solar, /charging:\s*true/);
});
