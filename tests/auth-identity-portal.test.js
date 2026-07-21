const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const modules = [
  "auth-identity-constellation",
  "auth-emotional-logo",
  "auth-quantum-flow",
  "auth-universe-memory",
  "auth-trust-director",
  "auth-spatial-aurora",
  "auth-zoom-resilience"
];

test("identity portal assets are versioned in HTML and offline cache", () => {
  const html = read("index.html");
  const worker = read("sw.js");
  for (const module of modules) {
    assert.match(html, new RegExp(`${module}\\.css\\?v=\\d+`), `${module}.css is not loaded`);
    assert.match(html, new RegExp(`${module}\\.js\\?v=\\d+`), `${module}.js is not loaded`);
    assert.match(worker, new RegExp(`${module}\\.(?:css|js)\\?v=\\d+`), `${module} is not cached`);
  }
  assert.match(worker, /hh-identity-portal-v\d+/);
});

test("identity constellation uses local non-sensitive identity state", () => {
  const source = read("auth-identity-constellation.js");
  assert.match(source, /hh\.auth\.identity-seed/);
  assert.match(source, /crypto\?\.getRandomValues|crypto\.getRandomValues/);
  assert.match(source, /input\[type=["']email["']\]/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /visibilitychange/);
  assert.doesNotMatch(source, /input\[type=["']password["']\].*value/s);
});

test("emotional logo exposes real states and opt-in spatial audio", () => {
  const source = read("auth-emotional-logo.js");
  for (const state of ["idle", "focus", "caps-lock", "offline", "authenticating", "success", "error"]) {
    assert.match(source, new RegExp(state));
  }
  assert.match(source, /PannerNode|createPanner/);
  assert.match(source, /hh\.auth\.sound-enabled/);
  assert.match(source, /pointerdown|click|keydown/);
  assert.match(source, /getModifierState\(["']CapsLock["']\)/);
  assert.doesNotMatch(source, /password[^\n]{0,80}\.value/i);
});

test("quantum flow is derived from actual auth state and keeps Passkey real", () => {
  const source = read("auth-quantum-flow.js");
  for (const step of ["device", "identity", "session", "workspace"]) {
    assert.match(source, new RegExp(step));
  }
  assert.match(source, /PublicKeyCredential/);
  assert.match(source, /data-passkey-login/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /hh:auth-change|hh:auth-success/);
  assert.doesNotMatch(source, /setInterval\s*\(/);
});

test("universe morph and memory ribbon resume real routes", () => {
  const source = read("auth-universe-memory.js");
  assert.match(source, /startViewTransition/);
  assert.match(source, /hh\.auth\.universe-memory\.v1/);
  assert.match(source, /hh\.auth\.pending-route/);
  assert.match(source, /hashchange/);
  assert.match(source, /hh:auth-universe-select/);
  assert.match(source, /MAX_ITEMS\s*=\s*5/);
});

test("privacy lens never reads secrets and recovery stays inline", () => {
  const source = read("auth-trust-director.js");
  assert.match(source, /Live Privacy Lens|Privacy Lens/i);
  assert.match(source, /personalization/i);
  assert.match(source, /network|oauth|email|passkey/);
  assert.match(source, /static|balanced|cinematic/);
  assert.match(source, /visibilitychange/);
  assert.doesNotMatch(source, /localStorage\.getItem\([^)]*(?:password|token|api.?key)/i);
  assert.doesNotMatch(source, /(?:window\.)?(?:alert|prompt|confirm)\s*\(/);
});

test("spatial aurora uses WebGPU with Canvas fallback", () => {
  const source = read("auth-spatial-aurora.js");
  assert.match(source, /navigator\.gpu/);
  assert.match(source, /getContext\(["']webgpu["']\)/);
  assert.match(source, /createRenderPipeline/);
  assert.match(source, /getContext\(["']2d["']/);
  assert.match(source, /saveData/);
  assert.match(source, /prefers-reduced-motion/);
});

test("zoom resilience keeps hidden panels hidden and switches layout early", () => {
  const css = read("auth-zoom-resilience.css");
  const source = read("auth-zoom-resilience.js");
  assert.match(css, /@media\s*\(max-width:\s*1100px\)/);
  assert.match(css, /\[hidden\][^{]*\{[^}]*display:\s*none\s*!important/s);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(source, /visualViewport/);
  assert.match(source, /scrollIntoView/);
});

test("all identity portal motion modules honor reduced motion", () => {
  for (const module of modules.filter((name) => name !== "auth-zoom-resilience")) {
    const css = read(`${module}.css`);
    const source = read(`${module}.js`);
    assert.match(`${css}\n${source}`, /prefers-reduced-motion/i, `${module} ignores reduced motion`);
  }
});
