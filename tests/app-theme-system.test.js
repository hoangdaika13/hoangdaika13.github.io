const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("global theme runtime is loaded on every route and cached offline", () => {
  const index = read("index.html");
  const worker = read("sw.js");
  for (const asset of ["app-theme-system.css?v=6", "app-theme-system.js?v=5"]) {
    const pattern = new RegExp(asset.replace(/[.?]/g, "\\$&"));
    assert.match(index, pattern);
    assert.match(worker, pattern);
  }
  assert.match(worker, /hh-identity-portal-v369/);
});

test("all colorful and basic themes define complete semantic shell palettes", () => {
  const css = read("app-theme-system.css");
  for (const theme of ["basic-light", "basic-dark", "slate", "warm", "dark", "light", "cyberpunk", "ocean", "aurora", "emerald", "purple", "sunset", "neon", "glass"]) {
    assert.match(css, new RegExp(`body\\[data-app-theme="${theme}"\\]\\{[^}]*--app-bg:[^;}]+;[^}]*--sidebar-bg:[^;}]+;[^}]*--header-bg:[^;}]+;[^}]*--surface-1:[^;}]+;[^}]*--text-primary:[^;}]+;[^}]*--accent:[^;}]+;`));
  }
  assert.match(css, /body\[data-app-theme\] \.app-sidebar/);
  assert.match(css, /body\[data-app-theme\] \.app-header/);
  assert.match(css, /\.app-theme-panel/);
  assert.match(css, /\.app-shortcuts-dialog/);
  assert.match(css, /\.app-theme-section/);
  assert.match(css, /\.app-theme-colorful/);
});

test("theme, language, density, motion and shortcuts controls are functional", () => {
  const runtime = read("app-theme-system.js");
  const shell = read("script.js");
  const command = read("command-center-pro.js");
  assert.match(runtime, /document\.documentElement\.dataset\.appTheme = value/);
  assert.match(runtime, /document\.body\.dataset\.dashboardTheme = value/);
  assert.match(runtime, /data-app-theme-value/);
  assert.match(runtime, /data-dashboard-language/);
  assert.match(runtime, /data-dashboard-shortcuts/);
  assert.match(runtime, /data-app-preference/);
  for (const preference of ["font", "fontScale", "radius", "density", "contrast", "effects", "reducedMotion"]) {
    assert.match(runtime, new RegExp(`data-app-preference=\\"${preference}\\"`));
  }
  assert.match(runtime, /hh:theme-change/);
  assert.match(runtime, /basic-light/);
  assert.match(runtime, /basic-dark/);
  assert.match(shell, /data-app-preference=language/);
  assert.match(shell, /data-app-preference=density/);
  assert.match(shell, /data-app-preference=reducedMotion/);
  assert.match(shell, /data-app-preference=fontScale/);
  assert.match(shell, /data-app-preference=radius/);
  assert.match(shell, /data-app-preference=contrast/);
  assert.match(shell, /data-app-preference=effects/);
  assert.match(command, /window\.HHAppTheme\.apply/);
});
