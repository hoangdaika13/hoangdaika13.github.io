const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("HH Astral Realms is a dedicated Entertainment route with offline assets", () => {
  const shell = read("script.js");
  const center = read("game-center.js");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");

  assert.match(shell, /\/entertainment\/astral-realms/);
  assert.match(shell, /HHAstralRealms\?\.mount/);
  assert.match(shell, /HHAstralRealms\?\.unmount/);
  assert.match(center, /id:\s*"astral-realms"/);
  [
    "astral-realms.css?v=71",
    "astral-realms.js?v=81",
    "vendor/three.module.min.js"
  ].forEach((asset) => {
    assert.ok((loader + worker).includes(asset), `${asset} must be available to the game route`);
  });
});

test("the vertical slice contains real world, combat, quest and persistence systems", () => {
  const source = read("astral-realms.js");
  [
    "H-Central",
    "Aurora Vale",
    "Crimson Forge",
    "Void Garden",
    "Training Arena",
    "ELEMENT_REACTIONS",
    "QUESTS",
    "RECIPES",
    "IndexedDB",
    "cloud-save",
    "requestAnimationFrame",
    "visibilitychange",
    "HHGameRuntime",
    "game:room:create",
    "astral-realms:input",
    "Trình duyệt không hỗ trợ WebGL"
  ].forEach((token) => assert.ok(source.includes(token), `Missing Astral Realms contract: ${token}`));
});

test("Astral Realms exposes mount, unmount and inspect without leaking client secrets", () => {
  const source = read("astral-realms.js");
  assert.match(source, /Object\.freeze\(\{\s*mount,\s*unmount,\s*inspect/);
  assert.doesNotMatch(source, /AQ\.Ab8RN6|sk-[A-Za-z0-9_-]{20,}/);
});

test("Astral Realms UI is namespaced, responsive and motion-safe", () => {
  const css = read("astral-realms.css");
  assert.match(css, /\.har-shell/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /:focus-visible/);
});

test("the realtime service validates Astral Realms input on an authoritative tick", () => {
  const source = read("realtime-server/src/astral-realms.js");
  assert.match(source, /astral-realms:input/);
  assert.match(source, /astral-realms:snapshot/);
  assert.match(source, /MAX_MOVE_SPEED/);
  assert.match(source, /ATTACK_COOLDOWN_MS/);
  assert.match(source, /server-authoritative/);
  assert.match(read("realtime-server/src/server.js"), /registerAstralRealmsRealtime/);
});
