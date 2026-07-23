const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Game Center, ASTRA expansion and Arcade assets load offline", () => {
  const html = read("index.html");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const assets = [
    "game-center.css?v=3",
    "game-center.js?v=3",
    "astra-universe-expansion.css?v=3",
    "astra-universe-expansion.js?v=3",
    "game-arcade.css?v=3",
    "game-arcade.js?v=3"
  ];
  assets.forEach((asset) => {
    assert.ok((html + loader).includes(asset), `${asset} must be declared by the route loader`);
    assert.ok(worker.includes(`./${asset}`), `${asset} must be cached by sw.js`);
  });
});

test("Entertainment routes mount dedicated game workspaces", () => {
  const shell = read("script.js");
  assert.match(shell, /route:\s*"\/entertainment\/astra-hh"/);
  assert.match(shell, /route:\s*"\/entertainment\/arcade"/);
  assert.match(shell, /HHGameCenter\?\.mount/);
  assert.match(shell, /HHAstraExpansion\?\.mount/);
  assert.match(shell, /HHGameArcade\?\.mount/);
  assert.match(shell, /HHGameCenter\?\.unmount/);
  assert.match(shell, /HHGameArcade\?\.unmount/);
});

test("All games publish rewards through one progression event", () => {
  const center = read("game-center.js");
  const arcade = read("game-arcade.js");
  const astra = read("astra-universe-expansion.js");
  assert.match(center, /hh:game-reward/);
  assert.match(arcade, /hh:game-reward/);
  assert.match(astra, /hh:game-reward/);
});
