const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("interactive H galaxy exposes exactly twenty-five unique product planets", () => {
  const html = read("index.html");
  const planets = [...html.matchAll(/data-hh-planet="(\d+)"/g)].map((match) => match[1]);
  const keys = [...html.matchAll(/data-hh-galaxy-key="([^"]+)"/g)].map((match) => match[1]);

  assert.equal(planets.length, 25);
  assert.equal(new Set(planets).size, 25);
  assert.equal(keys.length, 25);
  assert.equal(new Set(keys).size, 25);
  assert.equal((html.match(/data-hh-weight=/g) || []).length, 25);
  assert.equal((html.match(/data-hh-model=/g) || []).length, 25);
  assert.match(html, /auth-h-channel-mark/);
  assert.match(html, /Bước vào thiên hà\./);
  assert.match(html, /Đánh thức mọi ý tưởng\./);
  assert.match(html, /<div class="hh-galaxy-sun"[^>]*><span><\/span>/);
  assert.doesNotMatch(html, /<div class="hh-galaxy-sun"[^>]*><span>H<\/span>/);
  assert.match(html, /id="hhGalaxyInspector" role="tabpanel"/);
  assert.match(html, /auth-h-galaxy\.css\?v=11/);
  assert.match(read("auth-neon-gateway.js"), /auth-h-galaxy\.js\?v=11/);
  assert.match(html, /data-hh-galaxy-detail/);
  assert.doesNotMatch(html, /auth-feature-showcase|auth-benefits/);
});

test("galaxy interactions support hover, touch, focus and keyboard navigation", () => {
  const script = read("auth-h-galaxy.js");

  assert.equal([...script.matchAll(/^\s{4}[a-zA-Z]+:\s*\{/gm)].length, 25);
  assert.equal([...script.matchAll(/^\s{6}accent:\s*"#[0-9a-f]{6}"/gmi)].length, 25);
  assert.equal([...script.matchAll(/^\s{6}detail:\s*"/gm)].length, 25);
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
  assert.match(script, /--auth-planet-accent/);
  assert.match(script, /hhPlanetTheme/);
  assert.match(script, /data-hh-galaxy-detail/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|password|token/i);
});

test("galaxy visuals retain motion comfort and responsive fallbacks", () => {
  const css = read("auth-h-galaxy.css");

  assert.match(css, /\.hh-galaxy-inspector/);
  assert.match(css, /\.hh-galaxy-planet:is\(:hover, :focus-visible, \.is-active\)/);
  assert.match(css, /offset-path:\s*ellipse/);
  assert.match(css, /animation:\s*hh-galaxy-planet-orbit/);
  assert.match(css, /min-height:\s*0/);
  assert.match(css, /aspect-ratio:\s*1/);
  assert.doesNotMatch(css, /\.hh-galaxy-planet[\s\S]{0,1800}rotateX\(-61deg\)/);
  assert.match(css, /animation:\s*hh-galaxy-planet-surface/);
  assert.match(css, /--planet-texture/);
  assert.match(css, /var\(--galaxy-accent\)/);
  assert.match(css, /\.hh-galaxy-detail/);
  assert.match(css, /--comet-y:\s*-\d+vw/);
  assert.match(css, /data-hh-planet-theme/);
  assert.match(css, /\.hh-galaxy-orbit\.is-selected-orbit/);
  assert.match(css, /animation-play-state:\s*paused/);
  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
