"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm"), path = require("node:path");
const root = path.resolve(__dirname, "..");
function key(overrides = {}) { return { key: "k", ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, target: { closest: () => null, matches: () => false }, getModifierState: () => false, preventDefault() { this.defaultPrevented = true; }, ...overrides }; }
test("global All Tool hotkey opens its real route once, not during typing/repeat/composition or consumed events", () => {
  const handlers = new Map(), context = { document: { querySelector: () => ({}) }, location: { hash: "" }, addEventListener(name, fn) { handlers.set(name, fn); } }; context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(root, "tool-manifests.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(path.join(root, "feature-lab.js"), "utf8"), context);
  const handler = handlers.get("keydown");
  for (const override of [{ repeat: true }, { isComposing: true }, { defaultPrevented: true }, { shiftKey: true }, { metaKey: true }, { getModifierState: () => true }, { target: { closest: () => ({}) } }]) {
    handler(key({ altKey: true, ...override })); assert.equal(context.location.hash, "");
  }
  const event = key({ altKey: true }); handler(event);
  assert.equal(context.location.hash, "#/tools/global-search"); assert.equal(event.defaultPrevented, true);
});
test("shell command palette retains plain Ctrl/Meta K without claiming modified All Tool combinations", () => {
  const source = fs.readFileSync(path.join(root, "script.js"), "utf8");
  const marker = source.indexOf('const galaxyLayerActive = document.body.dataset.hhProduct === "galaxy";');
  const start = source.lastIndexOf('document.addEventListener("keydown", (event) => {', marker), end = source.indexOf("    const typing =", marker);
  assert.ok(start >= 0 && end > marker);
  let handler, opens = 0;
  const context = { document: { body: { dataset: { hhProduct: "platform" } }, querySelector: () => null, addEventListener(_name, fn) { handler = fn; } }, openPalette() { opens++; } };
  vm.runInNewContext(source.slice(start, end) + "\n  });", context);
  for (const override of [{ altKey: true }, { shiftKey: true }, { defaultPrevented: true }, { repeat: true }, { isComposing: true }]) handler(key(override));
  assert.equal(opens, 0);
  handler(key()); handler(key({ ctrlKey: false, metaKey: true })); assert.equal(opens, 2);
});
test("shell navigation shortcuts do not consume customized modified combos or already handled events", () => {
  const source = fs.readFileSync(path.join(root, "script.js"), "utf8"), marker = source.indexOf('const galaxyLayerActive = document.body.dataset.hhProduct === "galaxy";');
  const start = source.lastIndexOf('document.addEventListener("keydown", (event) => {', marker), end = source.indexOf('  paletteInput?.addEventListener("input"', marker);
  let handler, opens = 0;
  const context = { document: { body: { dataset: {} }, querySelector: () => null, addEventListener(_name, fn) { handler = fn; } }, location: { hash: "" }, palette: { open: false }, openPalette() { opens++; } };
  vm.runInNewContext(source.slice(start, end), context);
  for (const override of [{ key: "h", altKey: true }, { key: "m", altKey: true }, { key: "/" }, { key: "h", ctrlKey: false, altKey: true, defaultPrevented: true }, { key: "m", ctrlKey: false, altKey: true, repeat: true }]) handler(key(override));
  assert.equal(context.location.hash, ""); assert.equal(opens, 0);
  handler(key({ key: "h", ctrlKey: false, altKey: true })); assert.equal(context.location.hash, "#/platform");
  handler(key({ key: "m", ctrlKey: false, altKey: true })); assert.equal(context.location.hash, "#/music-ai/project");
  context.location.hash = "";
  for (const name of ["h", "m", "/"]) handler(key({ key: name, ctrlKey: false, altKey: name !== "/", target: { closest: () => ({}), matches: () => false } }));
  assert.equal(context.location.hash, ""); assert.equal(opens, 0);
});

test("open shell palette ignores consumed, composing and repeated option keys while ordinary Enter still opens the chosen route", () => {
  const source = fs.readFileSync(path.join(root, "script.js"), "utf8"), marker = source.indexOf('const galaxyLayerActive = document.body.dataset.hhProduct === "galaxy";');
  const start = source.lastIndexOf('document.addEventListener("keydown", (event) => {', marker), end = source.indexOf('  paletteInput?.addEventListener("input"', marker);
  let handler, executions = 0, scrolls = 0;
  const option = { classList: { contains: () => true, toggle() {} }, setAttribute() {}, scrollIntoView() { scrolls++; } };
  const context = { document: { body: { dataset: {} }, querySelector: () => null, addEventListener(_name, fn) { handler = fn; } }, palette: { open: true }, paletteResults: { querySelectorAll: () => [option] }, executePaletteOption() { executions++; } };
  vm.runInNewContext(source.slice(start, end), context);
  for (const name of ["Enter", "ArrowDown", "ArrowUp"]) for (const override of [{ defaultPrevented: true }, { repeat: true }, { isComposing: true }]) handler(key({ key: name, ctrlKey: false, ...override }));
  assert.equal(executions, 0); assert.equal(scrolls, 0);
  handler(key({ key: "Enter", ctrlKey: false })); assert.equal(executions, 1);
  handler(key({ key: "ArrowDown", ctrlKey: false })); assert.equal(scrolls, 1);
});
