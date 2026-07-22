const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("HHGameCenter exposes the public mount contract", () => {
  const source = read("game-center.js");
  assert.match(source, /window\.HHGameCenter\s*=\s*\{\s*mount,\s*unmount,\s*inspect\s*\}/);
  assert.match(source, /function mount\(host,\s*opts\s*=\s*\{\}\)/);
  assert.match(source, /function unmount\(\)/);
  assert.match(source, /function inspect\(\)/);
  assert.match(source, /hh:game-center-ready/);
});

test("Game Center is game-only and highlights HH Astra Universe as MMO RPG", () => {
  const source = read("game-center.js");
  assert.match(source, /HH Astra Universe/);
  assert.match(source, /MMO RPG/);
  assert.match(source, /\/entertainment\/astra-hh/);
  assert.match(source, /co-op 2-10 người/i);
  assert.doesNotMatch(source, /phim|nhạc nền|mạng xã hội/i);
});

test("Game Center has progression, missions, badges and local fallback", () => {
  const source = read("game-center.js");
  [
    "localStorage.setItem(STORAGE_KEY",
    "daily-login",
    "weekly",
    "badges",
    "leaderboard",
    "friends",
    "cloud",
    "hh:game-reward",
    "opts.navigate",
    "data-gc-play"
  ].forEach((contract) => assert.ok(source.includes(contract), `Missing ${contract}`));
});

test("Game Center styles include responsive polished game dashboard surfaces", () => {
  const styles = read("game-center.css");
  assert.match(styles, /\.hh-game-center/);
  assert.match(styles, /\.gc-hero/);
  assert.match(styles, /\.gc-card-grid/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /prefers-reduced-motion/);
});
