const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const modules = Object.freeze({
  background: {
    file: "auth-cosmic-prism-background.js",
    global: "HHCosmicPrismBackground"
  },
  form: {
    file: "auth-cosmic-prism-form.js",
    global: "HHCosmicPrismForm"
  },
  interactions: {
    file: "auth-cosmic-prism-interactions.js",
    global: "HHCosmicPrismInteractions"
  }
});

const palette = Object.freeze([
  "#44E7F2",
  "#FF4FB8",
  "#FFE66D",
  "#72F6A7",
  "#FF766D",
  "#A989FF",
  "#070A12"
]);

const planets = Object.freeze([
  { id: "creative", route: "/create" },
  { id: "music", route: "/music-ai" },
  { id: "design", route: "/graphic-design" },
  { id: "dev", route: "/dev-tools" },
  { id: "learning", route: "/learn" },
  { id: "game", route: "/entertainment" },
  { id: "community", route: "/communication" }
]);

const readRequired = ({ file }) => {
  const absolutePath = path.join(root, file);
  assert.equal(
    fs.existsSync(absolutePath),
    true,
    `Missing Cosmic Prism module: ${file}`
  );
  return fs.readFileSync(absolutePath, "utf8");
};

const readAll = () => Object.fromEntries(
  Object.entries(modules).map(([name, contract]) => [name, readRequired(contract)])
);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

for (const [name, contract] of Object.entries(modules)) {
  test(`Cosmic Prism ${name} exposes mount/unmount APIs`, () => {
    const source = readRequired(contract);
    assert.match(source, new RegExp(`(?:window\\.)?${contract.global}`), `${contract.file} must publish ${contract.global}`);
    assert.match(source, /\bmount\s*(?:[:=]|\()/, `${contract.file} must expose mount()`);
    assert.match(source, /\bunmount\s*(?:[:=]|\()/, `${contract.file} must expose unmount()`);
    assert.match(
      source,
      /AbortController|removeEventListener|cancelAnimationFrame|clear(?:Timeout|Interval)/,
      `${contract.file} unmount() must release listeners, frames or timers`
    );
  });
}

test("Cosmic Prism uses the complete seven-color product palette", () => {
  const source = Object.values(readAll()).join("\n");
  for (const color of palette) {
    assert.match(source, new RegExp(escapeRegExp(color), "i"), `missing palette color ${color}`);
  }
  assert.equal(new Set(palette.map((color) => color.toLowerCase())).size, 7);
});

test("Creative Universe defines exactly the seven requested product planets", () => {
  const source = readRequired(modules.interactions);
  for (const planet of planets) {
    assert.match(
      source,
      new RegExp(`\\bid\\s*:\\s*["']${planet.id}["']`, "i"),
      `missing ${planet.id} planet`
    );
    assert.match(
      source,
      new RegExp(escapeRegExp(planet.route), "i"),
      `${planet.id} planet must target ${planet.route}`
    );
  }
  const knownPlanetDefinitions = planets.reduce((count, planet) => (
    count + (source.match(new RegExp(`\\bid\\s*:\\s*["']${planet.id}["']`, "gi")) || []).length
  ), 0);
  assert.equal(knownPlanetDefinitions, 7, "the product solar system must contain one definition for each of seven planets");
});

test("Cosmic Prism is responsive and honors reduced-motion preferences", () => {
  const { background, form, interactions } = readAll();
  const source = `${background}\n${form}\n${interactions}`;
  assert.match(source, /prefers-reduced-motion\s*:\s*reduce/i);
  assert.match(source, /max-width\s*:\s*(?:560|600|620|720|760|768|900|920)px|visualViewport|ResizeObserver/i);
  assert.match(source, /pointer\s*:\s*coarse|hover\s*:\s*none|touchstart|pointerdown/i);
  assert.match(source, /deviceMemory|saveData|effectiveType|hardwareConcurrency/i);
  assert.match(background, /requestAnimationFrame/);
  assert.match(background, /cancelAnimationFrame/);
});

test("Cosmic Prism keeps authentication accessible and errors inline", () => {
  const { form, interactions } = readAll();
  const source = `${form}\n${interactions}`;
  assert.match(source, /aria-live/i, "auth status and errors need an aria-live region");
  assert.match(source, /aria-invalid/i, "invalid fields need aria-invalid state");
  assert.match(source, /aria-label|aria-labelledby/i, "interactive controls need accessible names");
  assert.match(source, /keydown|keyup/i, "the universe and form must support keyboard interaction");
  assert.match(source, /focus\(|focus-visible|focusin/i, "focus must remain visible and manageable");
  assert.match(source, /role\s*[=:]|setAttribute\(["']role["']/i, "dynamic UI needs semantic roles");
});

test("Cosmic Prism never persists credentials or uses browser dialogs", () => {
  const source = Object.values(readAll()).join("\n");
  assert.doesNotMatch(
    source,
    /(?:localStorage|sessionStorage)\.setItem\s*\([^\n;]*(?:password|passwd|secret|token|api.?key|credential)/i,
    "credentials and secrets must not be persisted in browser storage"
  );
  assert.doesNotMatch(
    source,
    /indexedDB[\s\S]{0,180}(?:password|passwd|secret|token|api.?key|credential)/i,
    "credentials and secrets must not be written to IndexedDB"
  );
  assert.doesNotMatch(
    source,
    /console\.(?:log|debug|info|warn)\s*\([^\n;]*(?:password|passwd|secret|token|api.?key|credential)/i,
    "credentials and secrets must not be logged"
  );
  assert.doesNotMatch(source, /(?:window\.)?(?:alert|prompt|confirm)\s*\(/, "errors and choices must use inline UI");
});

test("Cosmic Prism sound stays locked until a real user interaction", () => {
  const source = readRequired(modules.interactions);
  assert.match(source, /AudioContext|webkitAudioContext|createOscillator|createBufferSource/i);
  assert.match(source, /pointerdown|click|keydown|touchstart/i, "audio unlock needs a user gesture listener");
  assert.match(source, /userActivation|hasBeenActive|audioUnlocked|soundUnlocked|hasInteracted/i);
  assert.match(source, /resume\s*\(|state\s*={2,3}\s*["']suspended["']/i);
  assert.doesNotMatch(source, /autoplay/i, "the login sound must never autoplay");
});

test("Cosmic Prism pauses hidden work and supports static, balanced and cinematic modes", () => {
  const { background, interactions } = readAll();
  const source = `${background}\n${interactions}`;
  assert.match(source, /visibilitychange/);
  assert.match(source, /document\.(?:hidden|visibilityState)/);
  assert.match(source, /cancelAnimationFrame|pause\s*\(|suspend\s*\(/i);
  for (const mode of ["static", "balanced", "cinematic"]) {
    assert.match(interactions, new RegExp(`['"]${mode}['"]`, "i"), `missing ${mode} motion mode`);
  }
  assert.match(interactions, /hh\.auth\.(?:cosmic-prism\.)?motion-mode|data-auth-motion-mode|authMotionMode/i);
});
