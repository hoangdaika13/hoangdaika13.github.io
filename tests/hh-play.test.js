const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("hh-play.js");
const css = read("hh-play.css");
const router = read("script.js");
const loader = read("performance-loader.js");
const worker = read("sw.js");
const html = read("index.html");

test("HH Play is a first-class lazy route in Entertainment", () => {
  assert.match(router, /id:\s*"play-center"[\s\S]*?label:\s*"HH Play"[\s\S]*?route:\s*"\/play"/);
  assert.match(router, /groupIds:\s*\["play-center",\s*"comic-reader",\s*"cinema",\s*"music-library",\s*"fortune"\]/);
  assert.match(router, /window\.HHPlay\?\.mount/);
  assert.match(router, /window\.HHPlay\?\.unmount/);
  assert.match(router, /app-play-route/);
  assert.match(loader, /play:\s*\{[\s\S]*?hh-play\.css\?v=5[\s\S]*?hh-play\.js\?v=4/);
  assert.match(loader, /value\.startsWith\("\/play"\)[^\n]*\["play"\]/);
  assert.match(worker, /\.\/hh-play\.css\?v=5/);
  assert.match(worker, /\.\/hh-play\.js\?v=4/);
  assert.match(html, /performance-loader\.js\?v=494/);
  assert.match(html, /script\.js\?v=241/);
});

test("Entertainment OS exposes ten distinct workspaces and real local activities", () => {
  for (const term of [
    "Arcade Galaxy", "Party Room", "Watch Party", "Story Universe", "Escape Room",
    "Rhythm Arena", "HH Virtual Pet", "Chill Rooms", "Quiz Arena", "DAILY ENTERTAINMENT"
  ]) assert.ok(source.includes(term), `missing ${term}`);
  for (const term of [
    "Neon Snake", "Asteroid Dodge", "Light Breaker", "Star Shooter", "Memory Constellation",
    "Reaction Pulse", "Element 2048", "Solar Sudoku", "Word Orbit", "Tower Tactics"
  ]) assert.ok(source.includes(term), `missing playable challenge ${term}`);
  for (const implementation of [
    "updateSnake", "updateBreaker", "flipMemory", "reactionTap", "moveElements",
    "checkSudoku", "checkWord", "towerAction", "startRhythm", "toggleChillAudio"
  ]) assert.match(source, new RegExp(`function\\s+${implementation}\\s*\\(`));
});

test("HH Play API advertises all views without requiring a DOM at parse time", () => {
  const sandbox = { window: {}, console, URL, Date, Math, JSON, setTimeout, clearTimeout, setInterval, clearInterval };
  vm.runInNewContext(source, sandbox, { filename: "hh-play.js" });
  assert.equal(sandbox.window.HHPlay.version, "1.0.0");
  assert.deepEqual(Array.from(sandbox.window.HHPlay.views), ["today", "arcade", "party", "watch", "story", "escape", "rhythm", "pet", "chill", "quiz"]);
  assert.equal(typeof sandbox.window.HHPlay.mount, "function");
  assert.equal(typeof sandbox.window.HHPlay.unmount, "function");
});

test("one-screen shell keeps the center as the primary scroller", () => {
  assert.match(css, /body\.app-play-route\s*\{[^}]*overflow:\s*hidden\s*!important/);
  assert.match(css, /body\.app-play-route #appMain\s*\{[^}]*overflow:\s*hidden\s*!important/);
  assert.match(css, /\.hh-play\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/);
  assert.match(css, /\.hhp-stage-scroll\s*\{[^}]*height:\s*100%[^}]*overflow-y:\s*auto[^}]*overflow-x:\s*hidden/);
  assert.match(css, /@media\(max-width:850px\)/);
  assert.match(css, /\.hhp-mobile-nav\{[^}]*display:grid/);
  assert.match(css, /body\.app-play-route\.app-shell-enabled>nav\.app-mobile-nav\{[^}]*display:none!important[^}]*pointer-events:none!important/);
  assert.match(css, /body\.app-play-route \.app-shell__body>\.app-sidebar\{[^}]*display:none!important[^}]*pointer-events:none!important/);
  assert.match(css, /\.hh-play \.hhp-inspector,.hh-play \.hhp-inspector\.is-open\{[^}]*display:none!important[^}]*pointer-events:none!important/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

test("social, media and audio surfaces fail closed", () => {
  assert.match(source, /mode:\s*"local-only"/);
  assert.match(source, /provider:\s*"local-device"/);
  assert.match(source, /Không giả người online/);
  assert.match(source, /youtube-nocookie\.com\/embed/);
  assert.match(source, /\["youtube\.com",\s*"www\.youtube\.com",\s*"m\.youtube\.com",\s*"youtu\.be"\]/);
  assert.match(source, /if\s*\(!context\s*\|\|\s*!state\.settings\.sound\)\s*return/);
  assert.match(source, /document\.hidden[\s\S]*arcade\.paused\s*=\s*true/);
  assert.match(source, /closest\("button\[data-play-view\]"\)/, "workspace navigation must be namespaced away from the global router");
  assert.doesNotMatch(source, /button[^\n>]*data-view=/, "generic data-view conflicts with App Shell tool routing");
  assert.doesNotMatch(source, /(?:fake|mock)(?:User|Friend|Room|Leaderboard|Online)/i);
  assert.doesNotMatch(source, /new\s+Audio\([^)]*\)\.play\s*\(\)/);
  assert.doesNotMatch(source, /(?:access.?token|refresh.?token|password|client.?secret)\s*[:=]/i);
});
