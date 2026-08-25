"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const game = fs.readFileSync(path.join(root, "hh-eonwild-game.js"), "utf8");
const core = fs.readFileSync(path.join(root, "hh-eonwild-3d-core.js"), "utf8");
const router = fs.readFileSync(path.join(root, "script.js"), "utf8");

const extractFunctionSource = (source, name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const openingBrace = source.indexOf("{", start + `function ${name}(`.length);
  assert.notEqual(openingBrace, -1, `missing body for function ${name}`);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1).trim();
    }
  }
  assert.fail(`unterminated function ${name}`);
};

test("immersive lifecycle owns Pointer Lock, app chrome and explicit resume", () => {
  assert.match(game, /requestPointerLock/);
  assert.match(game, /pointerlockchange/);
  assert.match(game, /pointerlockerror/);
  assert.match(game, /movementX/);
  assert.match(game, /movementY/);
  assert.match(game, /pauseGame\(instance,\s*"pointer-lock-lost"/);
  assert.match(game, /data-hwe-resume/);
  assert.match(game, /classList\?\.add\("app-eonwild-immersive"\)/);
  assert.match(game, /classList\?\.remove\("app-eonwild-immersive"\)/);
  assert.match(game, /function setImmersiveShell/);
  assert.match(game, /mobileNavigation\.style\.removeProperty\("display"\)/);
  assert.match(game, /mobileNavigation\.style\.setProperty\("display", previous\.value/);
});

test("renderer auto boot keeps Pointer Lock on the gameplay surface and reconciles fallback swaps", () => {
  const activeSurface = Function(`"use strict"; return (${extractFunctionSource(game, "activeSurface")});`)();
  const lite = { id: "lite", hidden: false };
  const threeD = { id: "3d", hidden: false };

  assert.equal(activeSurface({ canvas: lite, canvas3d: threeD, renderer3d: null, rendererBooting: false }), lite);
  assert.equal(activeSurface({ canvas: lite, canvas3d: threeD, renderer3d: null, rendererBooting: true }), threeD);
  threeD.hidden = true;
  assert.equal(activeSurface({ canvas: lite, canvas3d: threeD, renderer3d: null, rendererBooting: true }), lite);
  assert.equal(activeSurface({ canvas: lite, canvas3d: threeD, renderer3d: {}, rendererBooting: false }), threeD);

  const calls = [];
  const runtime = { document: { pointerLockElement: lite } };
  const reconcileGameplaySurface = Function(
    "global", "activeSurface", "pauseGame", "focusSurface",
    `"use strict"; return (${extractFunctionSource(game, "reconcileGameplaySurface")});`
  )(
    runtime,
    () => threeD,
    (_instance, reason) => calls.push(`pause:${reason}`),
    () => calls.push("focus")
  );
  assert.equal(reconcileGameplaySurface({ running: true }), false);
  assert.deepEqual(calls, ["pause:renderer-changed"]);

  calls.length = 0;
  runtime.document.pointerLockElement = threeD;
  assert.equal(reconcileGameplaySurface({ running: true }), true);
  assert.deepEqual(calls, ["focus"]);

  const enable3D = extractFunctionSource(game, "enable3D");
  assert.doesNotMatch(enable3D, /lockedSurfaceBeforeBoot/);
  assert.equal((enable3D.match(/reconcileGameplaySurface\(instance\)/g) || []).length, 2);
});

test("gameplay uses camera-relative fixed-step controller and interpolated rendering", () => {
  assert.match(game, /new DESKTOP\.FixedTimestepController/);
  assert.match(game, /cameraYaw:\s*instance\.camera\?\.yaw/);
  assert.match(game, /desktopController\?\.advance/);
  assert.match(game, /const fixedSeconds\s*=\s*\(advanced\?\.steps/);
  assert.match(game, /instance\.renderPlayer/);
  assert.match(game, /instance\.renderHeading/);
  assert.match(game, /const slopeRadians/);
  assert.match(game, /const slopeLimit/);
  assert.match(game, /groundBound && slopeRadians > slopeLimit/);
  assert.doesNotMatch(game, /INPUT_SYSTEM\?\.stepMovement/);
});

test("targeting is reticle-driven and interaction no longer chooses nearest DOM/world row", () => {
  assert.match(game, /data-hwe-reticle/);
  assert.match(game, /data-hwe-target-prompt/);
  assert.match(game, /DESKTOP\.selectTarget/);
  assert.match(game, /maxAngle:\s*\.15/);
  assert.match(game, /hasTerrainLineOfSight/);
  assert.match(game, /rendererCanPick\s*=\s*typeof instance\.renderer3d\?\.pickCenter/);
  assert.match(game, /if \(!selected && !rendererCanPick\)/);
  assert.match(game, /forward:\s*\{\s*x:\s*Math\.sin\(yaw\) \* horizontal,\s*y:\s*Math\.sin\(pitch\),\s*z:\s*Math\.cos\(yaw\) \* horizontal\s*\}/);
  assert.match(game, /rendererSeedForState\(instance\.state\)/);
  assert.match(game, /instance\.currentTarget\?\.type/);
  const start = game.indexOf("function interact(");
  const end = game.indexOf("\n  function sense(", start);
  const interaction = game.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(interaction, /\.sort\(\(a, b\) => Math\.hypot/);
});

test("Map, Codex, Photo and settings remain opaque in-game contexts", () => {
  for (const marker of [
    "data-hwe-pause-overlay",
    "data-hwe-game-overlay",
    "data-hwe-game-overlay-open=\"map\"",
    "data-hwe-game-overlay-open=\"codex\"",
    "data-hwe-photo",
    "data-hwe-game-overlay-open=\"settings\""
  ]) assert.ok(game.includes(marker), `missing ${marker}`);
  assert.match(game, /inputSystem\?\.pause\?\.\("gameplay-state"\)/);
  assert.match(game, /inputSystem\?\.resume\?\.\("gameplay-state"\)/);
  assert.match(game, /instance\.gameOverlayReturnFocus\s*=\s*activeElement/);
  assert.match(game, /returnFocus\?\.isConnected/);
  const photoStart = game.indexOf("function setPhotoMode(");
  const photoEnd = game.indexOf("\n  function capturePhoto(", photoStart);
  const photoMode = game.slice(photoStart, photoEnd);
  assert.match(photoMode, /data-hwe-pause-overlay[\s\S]*?setAttribute\("hidden"/);
  assert.match(photoMode, /data-hwe-game-overlay[\s\S]*?setAttribute\("hidden"/);
  assert.match(photoMode, /data-hwe-communication-wheel[\s\S]*?setAttribute\("hidden"/);
});

test("generic WebGL fallback shares route-owned gameplay camera contract", () => {
  assert.match(core, /if \(options\.controls === true\) camera\.attachControl/);
  assert.match(core, /const applyCameraInput/);
  assert.match(core, /getCameraState\(\)/);
  assert.match(core, /resolveCameraCollision\(\)/);
});

test("route cleanup releases pointer lock, owned fullscreen and immersive body state", () => {
  assert.match(game, /document\?\.pointerLockElement === instance\.canvas/);
  assert.match(game, /instance\.ownsFullscreen[\s\S]*?exitFullscreen/);
  assert.match(game, /instance\.controller\.abort\(\)/);
  assert.match(game, /cancelAnimationFrame\?\.\(instance\.raf\)/);
  assert.match(router, /workspaceOwnsMobileDock[\s\S]{0,220}?app-eonwild-immersive/);
});
