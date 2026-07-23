const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Game runtime, Game Center, ASTRA expansion and Arcade assets load offline", () => {
  const html = read("index.html");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const assets = [
    "game-runtime.css?v=1",
    "game-runtime.js?v=1",
    "game-center.css?v=4",
    "game-center.js?v=4",
    "astra-universe-expansion.css?v=4",
    "astra-universe-expansion.js?v=4",
    "game-arcade.css?v=4",
    "game-arcade.js?v=4"
  ];
  assets.forEach((asset) => {
    assert.ok((html + loader).includes(asset), `${asset} must be declared by the route loader`);
    assert.ok(worker.includes(`./${asset}`), `${asset} must be cached by sw.js`);
  });
});

test("the shared runtime loads before every game workspace", () => {
  const loader = read("performance-loader.js");
  const runtime = loader.indexOf('"game-runtime.js?v=1"');
  const explorer = loader.indexOf('"space-explorer.js?v=4"');
  const center = loader.indexOf('"game-center.js?v=4"');
  const arcade = loader.indexOf('"game-arcade.js?v=4"');
  assert.ok(runtime >= 0, "shared runtime must be declared");
  assert.ok(runtime < explorer && runtime < center && runtime < arcade, "shared runtime must load first");
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
