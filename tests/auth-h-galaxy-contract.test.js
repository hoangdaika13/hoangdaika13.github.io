const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("interactive H galaxy keeps a static fallback and mounts the live Platform registry", () => {
  const html = read("index.html");
  const shell = read("script.js");
  const runtime = read("auth-h-galaxy.js");

  assert.ok((html.match(/data-hh-planet=/g) || []).length > 0);
  assert.match(shell, /HHFeatureUniverseRegistry/);
  assert.match(shell, /generatedFrom:\s*"hh-platform-navigation"/);
  assert.match(shell, /hh:feature-universe-registry/);
  assert.match(runtime, /window\.HHFeatureUniverseRegistry/);
  assert.match(runtime, /PAGE_SIZE\s*=\s*18/);
  assert.doesNotMatch(html, /class="hh-galaxy-planet"[^>]*>\s*<span|class="hh-galaxy-planet"[^>]*>\s*<em/);
  assert.doesNotMatch(html, /auth-gate-brand|auth-h-channel-mark/);
  assert.doesNotMatch(html, /Bước vào thiên hà\.|Đánh thức mọi ý tưởng\.|H Creative Universe/);
  assert.match(html, /<div class="hh-galaxy-sun"[^>]*><span><\/span>/);
  assert.doesNotMatch(html, /<div class="hh-galaxy-sun"[^>]*><span>H<\/span>/);
  assert.match(html, /id="hhGalaxyInspector" role="tabpanel"/);
  assert.match(html, /auth-h-galaxy\.css\?v=14/);
  assert.match(read("auth-neon-gateway.js"), /auth-h-galaxy\.js\?v=16/);
  assert.match(html, /data-hh-galaxy-detail/);
  assert.doesNotMatch(html, /auth-feature-showcase|auth-benefits/);
  assert.doesNotMatch(html, /data-hh-galaxy-key="meme"/);
  assert.doesNotMatch(read("script.js"), /HHMemeHub|app-meme-route|route: "\/meme"/);
  assert.doesNotMatch(read("performance-loader.js"), /meme-hub/);
  assert.doesNotMatch(read("sw.js"), /meme-hub/);
});

test("galaxy interactions support hover, touch, focus and keyboard navigation", () => {
  const script = read("auth-h-galaxy.js");

  assert.match(script, /renderPlanets/);
  assert.match(script, /data-hh-universe-search/);
  assert.match(script, /data-hh-universe-list/);
  assert.match(script, /data-hh-universe-prev/);
  assert.match(script, /data-hh-universe-next/);
  assert.match(script, /hh:feature-universe-render/);
  assert.match(script, /hh:auth-destination/);
  assert.match(script, /pointerover/);
  assert.match(script, /pointerout/);
  assert.match(script, /focusin/);
  assert.match(script, /focusout/);
  assert.match(script, /click/);
  assert.match(script, /keydown/);
  assert.match(script, /ArrowRight/);
  assert.match(script, /aria-selected/);
  assert.match(script, /querySelectorAll\("\.hh-galaxy-planet\[data-hh-galaxy-key\]"\)/);
  assert.match(script, /--galaxy-accent/);
  assert.match(script, /--auth-planet-accent/);
  assert.match(script, /hhPlanetTheme/);
  assert.match(script, /data-hh-galaxy-detail/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|password|token/i);
  assert.doesNotMatch(script, /item\.title\s*=/);
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
  assert.match(css, /--planet-spin/);
  assert.match(css, /--planet-orbit-speed/);
  assert.match(css, /data-hh-body="saturn"/);
  assert.match(css, /\.hh-galaxy-planet > span,[\s\S]{0,120}display: none !important/);
  assert.match(css, /var\(--galaxy-accent\)/);
  assert.match(css, /\.hh-galaxy-detail/);
  assert.match(css, /--comet-y:\s*-\d+vw/);
  assert.match(css, /data-hh-planet-theme/);
  assert.match(css, /\.hh-galaxy-orbit\.is-selected-orbit/);
  assert.match(css, /animation-play-state:\s*paused/);
  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /@media \(min-width: 761px\) and \(max-width: 1100px\)/);
  assert.match(css, /\.hh-feature-universe-controls/);
  assert.match(css, /\.hh-feature-universe-list/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
