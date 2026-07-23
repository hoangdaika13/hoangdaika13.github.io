const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "game-arcade.js"), "utf8");
const css = fs.readFileSync(path.join(root, "game-arcade.css"), "utf8");

const ids = [
  "neon-drift", "galaxy-defense", "star-colony", "cipher-run",
  "asteroid-miner", "rhythm-reactor", "quiz-arena", "creative-sandbox",
  "space-chess", "survival-orbit", "galaxy-farm", "space-fishing",
  "mecha-arena", "planet-builder", "alien-pet", "dungeon-stars",
  "cosmic-card-battle", "astro-tycoon", "space-runner",
  "black-hole-escape", "nebula-puzzle", "boss-rush"
];

test("every Arcade game has a playable rule and tutorial", () => {
  assert.match(source, /const GAME_RULES\s*=\s*\{/);
  ids.forEach((id) => {
    assert.match(source, new RegExp(`"${id}"\\s*:\\s*\\{`), `Missing rule for ${id}`);
  });
  assert.match(source, /tutorial:\s*\[/);
  assert.match(source, /objective:/);
});

test("shared runtime exposes lifecycle, recovery, settings and four engines", () => {
  ["function start(", "function pause(", "function resume(", "function restart(", "function destroy("].forEach((signature) => {
    assert.match(source, new RegExp(signature.replace(/[()]/g, "\\$&")));
  });
  ["saveCheckpoint", "continueSavedGame", "finishRound", "pollGamepad", "updatePerformance", "renderOverlay"].forEach((name) => {
    assert.match(source, new RegExp(`function ${name}\\(`));
  });
  ["action", "strategy", "puzzle", "simulation"].forEach((engine) => {
    assert.match(source, new RegExp(`${engine}:\\s*new Set`), `Missing ${engine} engine`);
  });
});

test("playability UI is keyboard-friendly, responsive and dependency-free", () => {
  ["data-ag-tutorial-start", "data-ag-settings", "data-ag-continue", "data-ag-runtime-retry", "data-ag-setting", "data-ag-fps", "data-ag-network"].forEach((marker) => {
    assert.match(source, new RegExp(marker));
  });
  assert.match(source, /pointerdown/);
  assert.match(source, /getGamepads/);
  assert.match(source, /localStorage\.setItem\(STORE/);
  assert.match(css, /\.ag-overlay/);
  assert.match(css, /\.ag-runtime-toolbar/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(source, /https?:\/\/.*(phaser|cdn)/i);
});
