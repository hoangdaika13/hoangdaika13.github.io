const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("ASTRA HH is reachable from the primary application shell", () => {
  const shell = read("script.js");
  assert.match(shell, /route:\s*"\/entertainment\/astra-hh"/);
  assert.match(shell, /HHSpaceExplorer\?\.mount/);
  assert.match(shell, /HHSpaceExplorer\?\.unmount/);
});

test("the exploration loop keeps its major interactive systems", () => {
  const game = read("space-explorer.js");
  [
    "toggleAutopilot()",
    "startDecode(target)",
    "sonifyTarget()",
    "maybeStartEncounter()",
    "unlockResearch(id)",
    "dailyProgress(type",
    "capturePhoto()"
  ].forEach((contract) => assert.ok(game.includes(contract), `Missing ${contract}`));
  assert.match(game, /requestAnimationFrame/);
  assert.match(game, /localStorage\.setItem\(STORAGE_KEY/);
});

test("the public leaderboard exposes game metrics but not private account data", () => {
  const api = read("api/modules/[moduleId]/items.js");
  const leaderboard = api.slice(api.indexOf('moduleId === "space-explorer"'), api.indexOf('moduleId === "referral-affiliate"'));
  assert.match(leaderboard, /projection:/);
  assert.match(leaderboard, /"data\.score"/);
  assert.doesNotMatch(leaderboard, /password|email|phone|token/i);
  assert.match(api, /game:score:sync/);
});
