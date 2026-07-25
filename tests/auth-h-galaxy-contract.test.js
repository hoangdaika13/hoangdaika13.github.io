const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("interactive H galaxy exposes exactly fourteen unique product planets", () => {
  const html = read("index.html");
  const planets = [...html.matchAll(/data-hh-planet="(\d+)"/g)].map((match) => match[1]);
  const keys = [...html.matchAll(/data-hh-galaxy-key="([^"]+)"/g)].map((match) => match[1]);

  assert.equal(planets.length, 14);
  assert.equal(new Set(planets).size, 14);
  assert.equal(keys.length, 14);
  assert.equal(new Set(keys).size, 14);
  assert.match(html, /id="hhGalaxyInspector" role="tabpanel"/);
  assert.match(html, /auth-h-galaxy\.css\?v=3/);
  assert.match(read("auth-neon-gateway.js"), /auth-h-galaxy\.js\?v=2/);
  assert.match(html, /data-hh-galaxy-detail/);
  assert.doesNotMatch(html, /auth-feature-showcase|auth-benefits/);
});

test("galaxy interactions support hover, touch, focus and keyboard navigation", () => {
  const script = read("auth-h-galaxy.js");

  assert.equal([...script.matchAll(/^\s{4}[a-z]+:\s*\{/gm)].length, 14);
  assert.equal([...script.matchAll(/^\s{6}accent:\s*"#[0-9a-f]{6}"/gmi)].length, 14);
  assert.equal([...script.matchAll(/^\s{6}detail:\s*"/gm)].length, 14);
  assert.match(script, /pointerover/);
  assert.match(script, /pointerout/);
  assert.match(script, /focusin/);
  assert.match(script, /focusout/);
  assert.match(script, /click/);
  assert.match(script, /keydown/);
  assert.match(script, /ArrowRight/);
  assert.match(script, /aria-selected/);
  assert.match(script, /featureNodes\.forEach/);
  assert.match(script, /--galaxy-accent/);
  assert.match(script, /data-hh-galaxy-detail/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|password|token/i);
});

test("galaxy visuals retain motion comfort and responsive fallbacks", () => {
  const css = read("auth-h-galaxy.css");

  assert.match(css, /\.hh-galaxy-inspector/);
  assert.match(css, /\.hh-galaxy-planet:is\(:hover, :focus-visible, \.is-active\)/);
  assert.match(css, /animation:\s*hh-galaxy-orbit-spin/);
  assert.match(css, /animation:\s*hh-galaxy-planet-surface/);
  assert.match(css, /--planet-texture/);
  assert.match(css, /var\(--galaxy-accent\)/);
  assert.match(css, /\.hh-galaxy-detail/);
  assert.match(css, /\.hh-galaxy-orbit\.is-selected-orbit/);
  assert.match(css, /animation-play-state:\s*paused/);
  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
