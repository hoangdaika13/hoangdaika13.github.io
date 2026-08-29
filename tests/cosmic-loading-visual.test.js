const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("boot surface keeps the animated Galaxy logo single and readable", () => {
  const html = read("index.html");

  assert.match(html, /app-shell\.css\?v=66/);
  assert.match(html, /\.hh-boot-mark:not\(\.hh-galaxy-logo-host\)>img/);
  assert.match(html, /\.hh-boot-mark\.hh-galaxy-logo-host>\.hh-galaxy-logo-fallback\{display:none!important\}/);
  assert.match(html, /hhCriticalNebula/);
  assert.match(html, /hhCriticalParticle/);
  assert.match(html, /hhCriticalBeam/);
  assert.match(html, /\.hh-boot-particles i\{[^}]*display:block/);
});

test("shared route loader exposes colorful depth without clipping text", () => {
  const css = read("app-shell.css");

  assert.match(css, /Cosmic loading visual system v3/);
  assert.match(css, /\.app-cosmic-loader::before/);
  assert.match(css, /\.app-cosmic-loader__stars::after/);
  assert.match(css, /@keyframes hhCosmicNebulaDrift/);
  assert.match(css, /@keyframes hhCosmicShootingStar/);
  assert.match(css, /data-transition-kind="dharma"\]\:not\(\[data-motion="static"\]\)[\s\S]*?app-cosmic-loader__space\s*\{\s*display:\s*grid !important/);
  assert.match(css, /\.app-cosmic-loader__card\s*>\s*strong\s*\{[^}]*white-space:\s*normal/s);
  assert.match(css, /\.app-cosmic-loader__steps\s*>\s*span\s*\{[^}]*white-space:\s*normal/s);
  assert.match(css, /@media \(max-height: 560px\) and \(orientation: landscape\)/);
});

test("cosmic motion honors OS and in-app static preferences", () => {
  const css = read("app-shell.css");

  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.app-cosmic-loader::before[\s\S]*?animation:\s*none !important/);
  assert.match(css, /#hhBootSurface\[data-motion-mode="static"\]::before/);
  assert.match(css, /\.app-cosmic-loader\[data-motion="static"\]::before/);
  assert.match(css, /html\.hh-page-hidden \.app-cosmic-loader::before/);
});

test("versioned loader styles are published to first paint and offline cache", () => {
  const html = read("index.html");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");

  assert.match(html, /href="app-shell\.css\?v=66"/);
  assert.match(html, /Compatibility: app-shell\.css\?v=64 app-shell\.css\?v=65/);
  assert.match(loader, /index\.html\/app-shell\.css\?v=66/);
  assert.equal((worker.match(/\.\/app-shell\.css\?v=66/g) || []).length, 2);
});
