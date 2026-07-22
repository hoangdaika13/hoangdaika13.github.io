const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "game-arcade.js"), "utf8");
const css = fs.readFileSync(path.join(root, "game-arcade.css"), "utf8");

const legacyGames = [
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
];

const newGames = [
  "Galaxy Farm",
  "Space Fishing",
  "Mecha Arena",
  "Planet Builder",
  "Alien Pet",
  "Dungeon Stars",
  "Cosmic Card Battle",
  "Astro Tycoon",
  "Space Runner",
  "Black Hole Escape",
  "Nebula Puzzle",
  "Boss Rush"
];

test("Arcade keeps the HHGameArcade lifecycle API", () => {
  assert.match(source, /window\.HHGameArcade\s*=\s*\{\s*mount,\s*unmount,\s*inspect\s*\}/);
  assert.match(source, /function mount\(host,\s*options\s*=\s*\{\}\)/);
  assert.match(source, /function unmount\(\)/);
  assert.match(source, /function inspect\(\)/);
});

test("Arcade Galaxy includes all 22 playable modes", () => {
  [...legacyGames, ...newGames].forEach((name) => assert.match(source, new RegExp(name), `Missing ${name}`));
  assert.match(source, /totalGames:\s*games\.length/);
});

test("Arcade games have real loops, interactions, save and rewards", () => {
  assert.match(source, /requestAnimationFrame\(loop\)/);
  assert.match(source, /keydown/);
  assert.match(source, /pointerdown/);
  assert.match(source, /data-ag-key/);
  assert.match(source, /localStorage\.setItem\(STORE/);
  assert.match(source, /CustomEvent\("hh:game-reward"/);
  assert.match(source, /source:\s*"arcade"/);
  assert.match(source, /finishRound\(/);
});

test("Arcade supports category filtering, recent games and favorites", () => {
  assert.match(source, /data-ag-search/);
  assert.match(source, /data-ag-filter/);
  assert.match(source, /filter === "Yêu thích"/);
  assert.match(source, /filter === "Gần đây"/);
  assert.match(source, /toggleFavorite/);
  assert.match(source, /recordRecent/);
  assert.match(source, /favorites/);
});

test("New game families have dedicated MVP handlers", () => {
  [
    "farm",
    "fishing",
    "arena",
    "builder",
    "pet",
    "dungeon",
    "card",
    "tycoon",
    "escape",
    "match",
    "boss"
  ].forEach((mode) => assert.match(source, new RegExp(`"${mode}"|'${mode}'|mode === "${mode}"`), `Missing mode ${mode}`));
  assert.match(source, /petAction/);
  assert.match(source, /dungeonAction/);
  assert.match(source, /fishingAction/);
  assert.match(source, /cardAction/);
  assert.match(source, /matchAction/);
});

test("Arcade CSS provides colorful responsive game UI", () => {
  assert.match(css, /\.hh-arcade/);
  assert.match(css, /\.ag-filters/);
  assert.match(css, /\.ag-game-button\.is-active/);
  assert.match(css, /\.ag-touch/);
  assert.match(css, /\.ag-board/);
  assert.match(css, /@media \(max-width: 640px\)/);
});

test("Arcade stays dependency-free", () => {
  assert.doesNotMatch(source, /import\s|require\(|from\s+["']/);
});
