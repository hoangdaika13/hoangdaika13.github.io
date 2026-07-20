const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const prototype = fs.readFileSync(path.join(root, "graphic-design-prototype.js"), "utf8");

test("Graphic Design Prototype exposes an idempotent local-first mount API", () => {
  assert.match(prototype, /window\.HHGraphicPrototype/);
  assert.match(prototype, /mount\(target\)/);
  assert.match(prototype, /\[data-graphic-prototype\]/);
  assert.match(prototype, /__hhGraphicPrototypeInstance/);
  assert.match(prototype, /hh\.graphic-design\.prototype\.v1/);
  assert.match(prototype, /localStorage\.getItem/);
  assert.match(prototype, /localStorage\.setItem/);
});

test("Graphic Design Prototype implements frame management and a visible canvas preview", () => {
  for (const action of ["add-frame", "duplicate-frame", "delete-frame", "add-hotspot", "delete-hotspot"]) {
    assert.match(prototype, new RegExp(`data-action=\\\"${action}\\\"`));
  }
  assert.match(prototype, /data-preview-frame/);
  assert.match(prototype, /function addFrame\(duplicate\)/);
  assert.match(prototype, /function deleteFrame\(\)/);
  assert.match(prototype, /function addHotspot\(\)/);
  assert.match(prototype, /MAX_FRAMES = 40/);
});

test("Prototype flow supports click, hover, drag, swipe and target frame links", () => {
  for (const trigger of ["click", "hover", "drag", "swipe"]) assert.match(prototype, new RegExp(`\\\"${trigger}\\\"`));
  assert.match(prototype, /targetFrameId/);
  assert.match(prototype, /function navigate\(targetId\)/);
  assert.match(prototype, /handlePointerOver/);
  assert.match(prototype, /spot\.trigger === "drag"/);
  assert.match(prototype, /spot\.trigger === "swipe"/);
});

test("Inspector includes variables, component states and device viewport controls", () => {
  for (const token of ["variables", "components", "COMPONENT_STATES", "data-variable-field", "data-component-field", "data-graphic-prototype"]) {
    assert.match(prototype, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const device of ["desktop", "laptop", "tablet", "mobile"]) assert.match(prototype, new RegExp(`${device}: \\{`));
  assert.match(prototype, /data-action="device-change"/);
});

test("Prototype provides undo/redo, keyboard shortcuts and persistent history boundaries", () => {
  assert.match(prototype, /function undo\(\)/);
  assert.match(prototype, /function redo\(\)/);
  assert.match(prototype, /Ctrl Z/);
  assert.match(prototype, /Ctrl Shift Z/);
  assert.match(prototype, /event\.key === "Delete"/);
  assert.match(prototype, /MAX_HISTORY = 30/);
  assert.match(prototype, /future\.unshift/);
});

test("Prototype supports JSON export/import and a copyable share payload without network calls", () => {
  assert.match(prototype, /function exportJson\(\)/);
  assert.match(prototype, /JSON\.stringify\(payload, null, 2\)/);
  assert.match(prototype, /data-import-input/);
  assert.match(prototype, /JSON\.parse\(text\)/);
  assert.match(prototype, /function sharePayload\(\)/);
  assert.match(prototype, /hh-prototype:v1:/);
  assert.match(prototype, /navigator\.clipboard/);
  assert.doesNotMatch(prototype, /fetch\s*\(/);
  assert.doesNotMatch(prototype, /WebSocket/);
  assert.doesNotMatch(prototype, /XMLHttpRequest/);
});

test("Prototype includes responsive, accessible and reduced-motion UI states", () => {
  assert.match(prototype, /setAttribute\(`data-\$\{STYLE_KEY\}`/);
  assert.doesNotMatch(prototype, /dataset\[STYLE_KEY\]/);
  assert.match(prototype, /aria-label=/);
  assert.match(prototype, /aria-live=\"polite\"/);
  assert.match(prototype, /focus-visible/);
  assert.match(prototype, /@media\(max-width:1080px\)/);
  assert.match(prototype, /@media\(max-width:780px\)/);
  assert.match(prototype, /prefers-reduced-motion:reduce/);
});
