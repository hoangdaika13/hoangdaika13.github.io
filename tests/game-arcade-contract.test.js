const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "game-arcade.js"), "utf8");

test("Arcade exposes lifecycle and ten playable games", () => {
  assert.match(source, /window\.HHGameArcade/);
  assert.match(source, /mount\(host/);
  [
    "Neon Drift",
    "Galaxy Defense",
    "Star Colony",
    "Cipher Run",
    "Asteroid Miner",
    "Rhythm Reactor",
    "Quiz Arena",
    "Creative Sandbox",
    "Space Chess",
    "Survival Orbit"
  ].forEach((name) => assert.match(source, new RegExp(name)));
});

test("Arcade sends shared game rewards", () => {
  assert.match(source, /hh:game-reward/);
  assert.match(source, /source:\s*"arcade"/);
});
