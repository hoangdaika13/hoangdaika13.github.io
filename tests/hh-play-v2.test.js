const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "hh-play.js"), "utf8");
const css = fs.readFileSync(path.join(root, "hh-play.css"), "utf8");
const server = fs.readFileSync(path.join(root, "realtime-server", "src", "play-realtime.js"), "utf8");
const worklet = fs.readFileSync(path.join(root, "hh-play-audio-worklet.js"), "utf8");

test("HH Play v2 exposes state integrity, cartridge and data tools", () => {
  for (const term of ["STATE_SCHEMA_VERSION", "localDayKey", "rewardLedger", "indexedDB", "exportPlayData", "restoreLatestSnapshot", "ARCADE_DIFFICULTIES", "GAME_GUIDES", "hhp-game-history", "hhp-dpad", "contentPackTemplate"]) {
    assert.match(source, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing ${term}`);
  }
  for (const term of ["hhp-cartridge", "hhp-difficulty", "hhp-watch-controls", "hhp-content-studio", "prefers-reduced-motion", "hhp-achievement-strip"]) assert.ok(css.includes(term), `missing style ${term}`);
  assert.match(source, /audioWorklet\.addModule/);
  assert.match(worklet, /registerProcessor\("hh-play-metronome"/);
});

test("HH Play realtime is authenticated and authoritative by construction", () => {
  assert.match(server, /AUTH_REQUIRED/);
  assert.match(server, /authoritativeState:\s*true/);
  assert.match(server, /play:room:create/);
  assert.match(server, /play:room:state/);
  assert.match(server, /ROOM_PRIVATE/);
  assert.doesNotMatch(server, /fake|mock|anonymous\s+online/i);
});
