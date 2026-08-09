const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "game-arcade.js"), "utf8");
const css = fs.readFileSync(path.join(root, "game-arcade.css"), "utf8");
const shell = fs.readFileSync(path.join(root, "script.js"), "utf8");

test("Arcade V4 adds bounded game feel and adaptive challenge", () => {
  assert.match(source, /MAX_PARTICLES\s*=\s*180/);
  assert.match(source, /function gameFeel\(/);
  assert.match(source, /function updateGameFeel\(/);
  assert.match(source, /gameState\.shake\s*=\s*Math\.max/);
  assert.match(source, /clamp\(gameState\.shake \|\| 0, 0, 9\)/);
  assert.match(source, /gameState\.intensity\s*=\s*clamp/);
  assert.match(source, /COMBO_WINDOW/);
});

test("Arcade V4 renders at one logical resolution with richer scenes", () => {
  assert.match(source, /WORLD_WIDTH\s*=\s*960/);
  assert.match(source, /function worldViewport\(/);
  assert.match(source, /Math\.min\(safeWidth \/ WORLD_WIDTH, safeHeight \/ WORLD_HEIGHT\)/);
  assert.match(source, /ctx\.scale\(viewport\.scale, viewport\.scale\)/);
  ["drawRunner", "drawShooter", "drawClicker", "drawRhythm", "drawSandbox", "drawPanelPreview", "drawGameFeel"].forEach((name) => {
    assert.match(source, new RegExp(`function ${name}\\(`));
  });
  ["colony", "farm", "fishing", "pet", "dungeon", "tycoon"].forEach((mode) => {
    assert.match(source, new RegExp(`mode === "${mode}"`));
  });
});

test("simulation and puzzle families have real rules instead of generic buttons", () => {
  ["farmAction", "petAction", "dungeonAction", "fishingAction", "cipherAction", "quizAction", "matchAction", "boardAction", "cardAction"].forEach((name) => {
    assert.match(source, new RegExp(`function ${name}\\(`));
  });
  assert.match(source, /const ACTION_INFO\s*=\s*\{/);
  assert.match(source, /const MODE_STATUS\s*=\s*\{/);
  assert.match(source, /is-matched/);
  assert.match(source, /data\.energy < cost/);
  assert.match(source, /distance !== 1/);
});

test("outcomes, checkpoints and lifecycle remain truthful", () => {
  assert.match(source, /finishRound\("Đã kết thúc lượt chơi", "quit"\)/);
  assert.match(source, /result === "quit" \? 0\.35/);
  assert.match(source, /Checkpoint \$\{step\}\/4 đã lưu/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /document\.removeEventListener\("visibilitychange", visibilityHandler\)/);
});

test("Arcade V4 is one-screen, 375px safe, focus-visible and motion-aware", () => {
  assert.match(css, /Arcade Galaxy V4/);
  assert.match(css, /grid-template-rows:\s*auto auto minmax\(0, 1fr\)/);
  assert.match(css, /max-height:\s*calc\(100dvh - 72px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});

test("keyboard and gamepad input stay independent without duplicate key handlers", () => {
  assert.equal((source.match(/addEventListener\("keydown", keyDown\)/g) || []).length, 1);
  assert.match(source, /root\.addEventListener\("keyup", keyUp\)/);
  assert.match(source, /function keyActive\(/);
  assert.match(source, /function consumeActionPress\(/);
  assert.match(source, /gamepadJustPressed/);
  assert.doesNotMatch(source, /if \(nextKeys\.has\(key\)\) keys\.add\(key\)/);
});

test("Arcade game selection keeps its deep link and supports fullscreen", () => {
  assert.match(source, /function syncActiveRoute\(/);
  assert.match(source, /#\/entertainment\/arcade\/\$\{encodeURIComponent\(gameId\)\}/);
  assert.match(source, /history\?\.replaceState/);
  assert.match(source, /data-ag-fullscreen/);
  assert.match(source, /requestFullscreen/);
  assert.match(css, /\.hh-arcade-root:fullscreen/);
});

test("gamepad can start and pause outside the active gameplay loop", () => {
  assert.match(source, /function monitorGamepad\(/);
  assert.match(source, /rising\(9\)/);
  assert.match(source, /rising\(0\).*gameState\.phase !== "playing"/s);
  assert.match(source, /gamepadMonitorRaf = requestAnimationFrame\(monitorGamepad\)/);
  assert.match(source, /cancelAnimationFrame\(gamepadMonitorRaf\)/);
});

test("Arcade deep routes use a true one-screen workspace", () => {
  assert.match(shell, /classList\.toggle\("app-arcade-game-route"/);
  assert.match(css, /body\.app-entertainment-route\.app-arcade-game-route \.app-main[\s\S]*?overflow-y:\s*hidden/);
  assert.match(css, /body\.app-arcade-game-route :is\(\.app-breadcrumb, \.app-page-header, \.app-context-bar\)/);
  assert.match(css, /body\.app-arcade-game-route \[data-game-arcade-host\][\s\S]*?height:\s*100%/);
});

test("Arcade cleans media resources and keeps modal focus inside the dialog", () => {
  assert.match(source, /audioContext\.resume\(\)\.catch/);
  assert.match(source, /audioContext\.close\(\)\.catch/);
  assert.match(source, /child\.inert = Boolean\(overlay\)/);
  assert.match(source, /event\.key !== "Tab"/);
  assert.match(source, /fullscreenchange/);
  assert.match(source, /Thoát toàn màn hình/);
});
