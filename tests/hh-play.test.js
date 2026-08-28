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
  assert.match(router, /groupIds:\s*\["play-center",\s*"eonwild-game",\s*"comic-reader",\s*"cinema",\s*"music-library",\s*"fortune"\]/);
  assert.match(router, /window\.HHPlay\?\.mount/);
  assert.match(router, /window\.HHPlay\?\.unmount/);
  assert.match(router, /app-play-route/);
  assert.match(loader, /play:\s*\{[\s\S]*?hh-play\.css\?v=7&build=3[\s\S]*?hh-play\.js\?v=6&build=3/);
  assert.match(loader, /value\.startsWith\("\/play"\)[^\n]*\["play"\]/);
  assert.match(worker, /\.\/hh-play\.css\?v=7&build=3/);
  assert.match(worker, /\.\/hh-play\.js\?v=6&build=3/);
  for (const asset of ["performance-loader.js", "script.js"]) {
    const escaped = asset.replaceAll(".", "\\.");
    const match = html.match(new RegExp(`<script src="${escaped}\\?v=(\\d+)"`));
    assert.ok(match, `${asset} must have a numeric primary version in index.html`);
    assert.ok(worker.includes(`./${asset}?v=${match[1]}`), `${asset}?v=${match[1]} must be cached by sw.js`);
  }
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
  assert.equal(sandbox.window.HHPlay.version, "1.1.1");
  assert.deepEqual(Array.from(sandbox.window.HHPlay.views), ["today", "arcade", "party", "watch", "story", "escape", "rhythm", "pet", "chill", "quiz"]);
  assert.ok(sandbox.window.HHPlay.quizQuestions >= 30);
  assert.deepEqual(Array.from(sandbox.window.HHPlay.quizTopics), ["all", "science", "technology", "culture", "thinking"]);
  assert.equal(typeof sandbox.window.HHPlay.mount, "function");
  assert.equal(typeof sandbox.window.HHPlay.unmount, "function");
});

test("Quiz Arena has a deep validated bank and real filter controls", () => {
  const quizSource = source.slice(source.indexOf("const QUIZ ="), source.indexOf("const WORDS ="));
  const entries = [...quizSource.matchAll(/\{ id: "([^"]+)", topic: "([^"]+)", difficulty: "([^"]+)", skill: "([^"]+)", q: "([^"]+)", choices: \[([^\]]+)\], answer: ([0-3]), why: "([^"]+)", insight: "([^"]+)" \}/g)];
  assert.ok(entries.length >= 30, `expected at least 30 complete questions, received ${entries.length}`);
  const ids = new Set();
  for (const entry of entries) {
    const [, id, topic, difficulty, skill, question, choices, answer, why, insight] = entry;
    assert.ok(!ids.has(id), `duplicate question id ${id}`);
    ids.add(id);
    assert.ok(["science", "technology", "culture", "thinking"].includes(topic), `invalid topic ${topic}`);
    assert.ok(["foundation", "advanced"].includes(difficulty), `invalid difficulty ${difficulty}`);
    assert.ok(skill.length > 2 && question.length > 12 && why.length > 20 && insight.length > 20);
    assert.equal((choices.match(/"[^"]+"/g) || []).length, 4, `${id} must have four choices`);
    assert.ok(Number(answer) >= 0 && Number(answer) <= 3);
  }
  for (const contract of ["data-quiz-topic", "data-quiz-difficulty", "hhp-quiz-toolbar", "hhp-question-meta", "hhp-insight-note", "hhp-quiz-profile", "hhp-command-deck", "hhp-duration-chips", "hhp-mood-grid"]) {
    assert.ok(source.includes(contract) || css.includes(contract), `missing professional Quiz contract ${contract}`);
  }
  assert.match(source, /selected:\s*integer\(merged\.quiz\.selected,\s*-1,\s*3,\s*-1\)/);
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
