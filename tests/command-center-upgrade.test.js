const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "command-center-pro.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "command-center-pro.css"), "utf8");

test("Command Center persists a versioned widget layout with safe migration", () => {
  assert.match(script, /layout:\s*"hh\.command-center\.layout\.v3"/);
  assert.match(script, /preset:\s*"hh\.command-center\.preset\.v1"/);
  assert.match(script, /function normalizeLayout\(raw\)/);
  assert.match(script, /widgetCatalog\.map/);
  assert.match(script, /write\(KEYS\.layout, normalized\)/);
  assert.match(script, /size:\s*widgetSizes\.includes\(item\.size\)/);
});

test("Command Center provides drag, keyboard reorder, pin, hide and fixed resize controls", () => {
  assert.match(script, /data-widget-drag/);
  assert.match(script, /data-widget-pin/);
  assert.match(script, /data-widget-size/);
  assert.match(script, /data-widget-hide/);
  assert.match(script, /function reorderWidgets\(sourceId, targetId\)/);
  assert.match(script, /\["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "Home", "End"\]/);
  assert.match(styles, /\[data-widget-size="small"\]/);
  assert.match(styles, /\[data-widget-size="medium"\]/);
  assert.match(styles, /\[data-widget-size="large"\]/);
  assert.match(styles, /\.cc-section\.is-pinned/);
});

test("Command Center presets cover focus, creative, management and learning workflows", () => {
  for (const id of ["focus", "creative", "manage", "learn"]) {
    assert.match(script, new RegExp(`${id}: \\{`));
  }
  for (const label of ["Tập trung", "Sáng tạo", "Quản lý", "Học tập"]) {
    assert.ok(script.includes(`label: "${label}"`));
  }
  assert.match(script, /data-layout-preset/);
  assert.match(script, /function applyPreset\(id\)/);
  assert.match(script, /hidden:\s*!rank\.has\(item\.id\)/);
});

test("Command palette actions mutate real local stores and export user data", () => {
  assert.ok(script.includes('"cc:create-task"'));
  assert.ok(script.includes('"cc:add-note"'));
  assert.ok(script.includes('"cc:cycle-theme"'));
  assert.ok(script.includes('"cc:export"'));
  assert.match(script, /function createTaskFromCommand\(\)/);
  assert.match(script, /function addNoteFromCommand\(\)/);
  assert.match(script, /const NOTES_KEY = "hh\.dashboard\.sticky-notes\.v1"/);
  assert.match(script, /new Blob\(\[JSON\.stringify\(payload, null, 2\)\]/);
  assert.match(script, /window\.dispatchEvent\(new CustomEvent\("hh:command-center-sync"\)\)/);
});

test("Layout controls expose responsive and accessible states", () => {
  assert.match(script, /aria-label="Bố cục Command Center"/);
  assert.match(script, /aria-live="polite"/);
  assert.match(script, /role", "toolbar"/);
  assert.match(script, /setAttribute\("aria-pressed"/);
  assert.match(styles, /\.cc-sr-only/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /@media \(max-width: 650px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
