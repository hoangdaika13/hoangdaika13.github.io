const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const modules = [
  "auth-cosmic-prism-background",
  "auth-cosmic-prism-form",
  "auth-cosmic-prism-interactions"
];

test("Cosmic Prism is lazy-loaded with the authentication experience and cached", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const html = read("index.html");

  for (const module of modules) {
    assert.match(loader, new RegExp(`${module}\\.css\\?v=1`));
    assert.match(loader, new RegExp(`${module}\\.js\\?v=1`));
    assert.match(worker, new RegExp(`${module}\\.css\\?v=1`));
    assert.match(worker, new RegExp(`${module}\\.js\\?v=1`));
  }

  assert.match(html, /performance-loader\.js\?v=\d+/);
  assert.doesNotMatch(html.replace(/<!--[\s\S]*?-->/g, ""), /auth-cosmic-prism-(?:background|form|interactions)\.(?:css|js)/);
});

test("Cosmic Prism composes with existing auth events without replacing authentication", () => {
  const background = read("auth-cosmic-prism-background.js");
  const form = read("auth-cosmic-prism-form.js");
  const interactions = read("auth-cosmic-prism-interactions.js");
  const combined = `${background}\n${form}\n${interactions}`;

  assert.match(combined, /#authGate|authGate/);
  assert.match(combined, /hh:auth-success|hh:auth-change/);
  assert.match(combined, /online|offline/);
  assert.doesNotMatch(combined, /fetch\([^)]*(?:login|register)|\/api\/auth/);
  assert.doesNotMatch(combined, /(?:window\.)?(?:alert|prompt|confirm)\s*\(/);
});

test("Cosmic Prism keeps a stable form at mobile widths and reduced motion", () => {
  const css = modules.map((module) => read(`${module}.css`)).join("\n");
  assert.match(css, /@media\s*\(max-width:\s*(?:560|600|640|720)px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /overflow-wrap|word-break/);
  assert.doesNotMatch(css, /font-size:\s*clamp\([^;]*vw/);
});
