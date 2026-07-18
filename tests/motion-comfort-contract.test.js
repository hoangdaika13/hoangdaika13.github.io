const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("route changes cross-fade without sliding or blurring the viewport", () => {
  const css = read("motion-comfort.css");
  const routeMotion = css.slice(css.indexOf("Page changes"), css.indexOf("A single, finite progress cue"));

  assert.match(css, /hh-comfort-fade-out/);
  assert.match(css, /hh-comfort-fade-in/);
  assert.match(css, /::view-transition-group\(app-workspace\) \{ animation: none !important; \}/);
  assert.doesNotMatch(routeMotion, /filter\s*:|translate[XY]?\(|scale\(/);
  assert.match(css, /hh-comfort-progress 320ms/);
  assert.doesNotMatch(css, /hh-comfort-progress[^;]*infinite/);
});

test("core workspaces do not loop decorative motion", () => {
  const css = read("motion-comfort.css");

  for (const selector of [
    ".dashboard-aurora::after",
    ".dashboard-hero-pro::before",
    ".work-aurora::before",
    ".comm-orbit::before",
    ".creative-orbit::before",
    ".insights-orbit::before",
    ".hhe-voice-studio::before"
  ]) assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.match(css, /animation: none !important/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("navigation uses immediate positioning and calm assets are cache-busted", () => {
  const html = read("index.html");
  const worker = read("sw.js");
  const client = read("script.js");
  const english = read("english-learning.js");

  assert.match(client, /sidebar\.scrollTo\(\{ top: 0, behavior: "auto" \}\)/);
  assert.match(client, /activeItem\.scrollIntoView\(\{ block: "nearest", behavior: "auto" \}\)/);
  assert.match(english, /heading\?\.scrollIntoView\?\.\(\{ behavior: "auto", block: "start" \}\)/);
  for (const asset of ["motion-comfort.css?v=1", "script.js?v=95", "english-learning.js?v=13", "auth-experience.js?v=4"]) {
    const pattern = new RegExp(asset.replace(/[.?]/g, "\\$&"));
    assert.match(html, pattern);
    assert.match(worker, pattern);
  }
});
