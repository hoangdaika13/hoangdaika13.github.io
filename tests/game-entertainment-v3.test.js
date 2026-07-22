const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const center = read("game-center.js");
const arcade = read("game-arcade.js");
const centerCss = read("game-center.css");
const arcadeCss = read("game-arcade.css");

test("entertainment state is versioned and migrates legacy local data", () => {
  assert.match(center, /hh\.game\.center\.profile\.v3/);
  assert.match(center, /LEGACY_STORAGE_KEY\s*=\s*"hh\.game\.center\.profile\.v2"/);
  assert.match(arcade, /hh\.arcade\.galaxy\.v3/);
  assert.match(arcade, /LEGACY_STORE\s*=\s*"hh\.arcade\.galaxy\.v2"/);
  assert.match(center, /schema:\s*SCHEMA/);
  assert.match(arcade, /version:\s*3/);
});

test("cloud, realtime and provider leaderboard require explicit confirmation", () => {
  assert.match(center, /result\.confirmed\s*===\s*true/);
  assert.match(center, /result\.connected\s*===\s*true/);
  assert.match(center, /result\.durable\s*===\s*true/);
  assert.match(center, /source:\s*"local-device"/);
  assert.match(center, /Chỉ lưu trên thiết bị/);
  assert.match(center, /Chưa kết nối realtime/);
  ["Astra Pilot", "Neon Maker", "Star Builder", "Music Studio", "AI Creator"].forEach((fakeName) => {
    assert.doesNotMatch(center, new RegExp(fakeName));
  });
});

test("party and spectator modes distinguish local data from confirmed realtime", () => {
  assert.match(center, /createLocalParty/);
  assert.match(center, /createConnectedParty/);
  assert.match(center, /joinConnectedParty\(roomCode, spectator/);
  assert.match(center, /Party local · chỉ tồn tại trên thiết bị này/);
  assert.match(arcade, /REPLAY_SCHEMA\s*=\s*"hh\.game\.replay\.v1"/);
  assert.match(arcade, /startLocalReplay/);
  assert.match(arcade, /không phải spectator realtime/);
});

test("Creator Sandbox saves sanitized, bounded playable levels", () => {
  assert.match(arcade, /LEVEL_SCHEMA\s*=\s*"hh\.creator\.level\.v1"/);
  assert.match(arcade, /function sanitizeLevel/);
  assert.match(arcade, /objects:[\s\S]*slice\(0, 160\)/);
  assert.match(arcade, /data-ag-level-save/);
  assert.match(arcade, /data-ag-level-test/);
  assert.match(arcade, /data-ag-level-export/);
  assert.match(arcade, /function updateSandbox/);
  assert.match(arcade, /function escapeHtml/);
});

test("entertainment UI supports semantic focus, 375px layouts and reduced motion", () => {
  assert.match(center, /<button/);
  assert.match(arcade, /tabindex="0"/);
  assert.match(centerCss, /:focus-visible/);
  assert.match(arcadeCss, /:focus-visible/);
  assert.match(centerCss, /@media \(max-width: 410px\)/);
  assert.match(arcadeCss, /@media \(max-width: 390px\)/);
  assert.match(centerCss, /prefers-reduced-motion/);
  assert.match(arcadeCss, /prefers-reduced-motion/);
});
