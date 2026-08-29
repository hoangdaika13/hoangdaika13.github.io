const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "creative-os.css"), "utf8");

test("Creative OS constrains scrolling and floating panels to its own shell", () => {
  assert.match(css, /\.creative-os\s*\{[^}]*min-width:\s*0[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.creative-os__body\s*\{[^}]*container:\s*creative-body\s*\/\s*inline-size[^}]*min-width:\s*0[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.creative-os__workspace\s*\{[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.creative-os__action-panel\s*\{[^}]*width:\s*min\(330px,\s*calc\(100%\s*-\s*16px\)\)[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.creative-os__readiness\s*\{[^}]*width:\s*min\(460px,\s*calc\(100%\s*-\s*24px\)\)[^}]*overflow:\s*hidden/s);
  assert.doesNotMatch(css, /\.creative-os__(?:action-panel|readiness)\s*\{[^}]*100vw/s);
});

test("the 375px contract keeps every tool detail visible without page overflow", () => {
  assert.match(css, /@media\s*\(max-width:\s*560px\)/);
  assert.match(css, /@container\s+creative-body\s*\(max-width:\s*560px\)/);
  assert.match(css, /\.creative-os__stage\s*\{[^}]*grid-template-rows:\s*58px\s+auto\s+auto\s+minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.creative-os__role-strip dl\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /\.creative-os__role-strip dl > div:last-child\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s);
  assert.match(css, /\.creative-os__role-strip dd\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(css, /\.creative-os__journey\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*overflow-x:\s*hidden/s);
  assert.match(css, /\.creative-os__readiness\s*\{[^}]*max-height:\s*min\(calc\(100%\s*-\s*64px\),\s*calc\(100dvh\s*-\s*72px\)\)/s);
  assert.doesNotMatch(css, /\.creative-os__role-strip dl > div:last-child\s*\{[^}]*display:\s*none/s);
});

test("responsive controls retain visible focus, touch targets and reduced motion", () => {
  assert.match(css, /\.creative-os\s+:focus-visible\s*\{[^}]*outline:\s*2px\s+solid/s);
  assert.match(css, /\.creative-os__journey button:focus-visible\s*\{[^}]*outline-offset:\s*-2px/s);
  assert.match(css, /@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*min-height:\s*44px/);
  assert.match(css, /touch-action:\s*manipulation/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*animation-duration:\s*\.01ms\s*!important/);
});
