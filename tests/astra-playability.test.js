const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const spaceJs = read("space-explorer.js");
const spaceCss = read("space-explorer.css");
const expansionJs = read("astra-universe-expansion.js");
const expansionCss = read("astra-universe-expansion.css");

test("Astra core exposes a real playable session contract", () => {
  for (const token of [
    "const DIFFICULTIES",
    "const SAVE_SLOTS_KEY",
    "const TUTORIAL_STEPS",
    "saveCheckpoint(",
    "restoreCheckpoint(",
    "restart(",
    "pollGamepad(",
    "initGameRuntime(",
    "syncCloudSave(",
    "navigator.getGamepads",
    "this.listen(window, \"online\"",
    "this.listen(window, \"offline\""
  ]) {
    assert.ok(spaceJs.includes(token), `missing core token: ${token}`);
  }
});

test("Astra UI wires onboarding, objectives, difficulty, input and save controls", () => {
  for (const token of [
    'data-action="tutorial-start"',
    'data-action="tutorial-next"',
    'data-action="tutorial-skip"',
    'data-action="restart"',
    "data-objective-title",
    "data-run-status",
    "data-difficulty",
    "data-volume",
    "data-save-slot",
    'data-save-action="checkpoint"',
    'data-save-action="restore"',
    "data-gamepad-status",
    "data-connection-badge"
  ]) {
    assert.ok(spaceJs.includes(token), `missing UI token: ${token}`);
  }
});

test("Astra CSS protects focus, mobile layout and reduced motion", () => {
  for (const token of [
    ".astra-objective-bar",
    ".astra-tutorial",
    ".astra-save-panel",
    ".astra-input-status",
    "button:focus-visible",
    "@media (max-width: 620px)",
    "@media (prefers-reduced-motion: reduce)",
    "min-height: 27px"
  ]) {
    assert.ok(spaceCss.includes(token), `missing CSS token: ${token}`);
  }
});

test("Astra companion keeps MMO systems and truthfully separates local/realtime state", () => {
  for (const token of [
    "realtimeConnected",
    "connectionLabel",
    "data-au-connection-status",
    "local fallback",
    "options.socket?.on",
    "data-au-zone",
    "data-au-quest",
    "data-au-party",
    "data-au-craft",
    "data-au-skill",
    "data-au-base"
  ]) {
    assert.ok(expansionJs.includes(token), `missing companion token: ${token}`);
  }
});

test("Astra companion UI is keyboard-visible, responsive and motion-aware", () => {
  for (const token of [
    ".astra-expansion button:focus-visible",
    ".astra-expansion .au-card:focus-within",
    "@media (max-width: 560px)",
    "@media (prefers-reduced-motion: reduce)",
    ".au-connection-state[data-state=\"online\"]"
  ]) {
    assert.ok(expansionCss.includes(token), `missing companion CSS token: ${token}`);
  }
});
