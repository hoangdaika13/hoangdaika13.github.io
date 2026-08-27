"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const game = fs.readFileSync(path.join(root, "hh-eonwild-game.js"), "utf8");
const gameplay = require(path.join(root, "hh-eonwild-game.js"));
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

test("Lite projection and reticle selection share authoritative yaw, pitch and screen center", () => {
  const forwardProjection = gameplay.createLiteWorldProjection({ width: 800, height: 600, yaw: 0, pitch: 0, fovDegrees: 70, distance: 6, target: { x: 0, y: 2, z: 0 } });
  assert.equal(forwardProjection.mode, "perspective-yaw-pitch");
  assert.equal(forwardProjection.pitchSupported, true);
  const centered = forwardProjection.project({ x: 0, y: 2, z: 20 });
  assert.ok(Math.abs(centered.x - 400) < 1e-9);
  assert.ok(Math.abs(centered.y - 300) < 1e-9);
  assert.ok(forwardProjection.project({ x: 10, y: 2, z: 20 }).x > 400);

  const rightProjection = gameplay.createLiteWorldProjection({ width: 800, height: 600, yaw: Math.PI / 2, pitch: 0, fovDegrees: 70, distance: 6, target: { x: 0, y: 2, z: 0 } });
  const rightCentered = rightProjection.project({ x: 20, y: 2, z: 0 });
  assert.ok(Math.abs(rightCentered.x - 400) < 1e-9, "yaw must rotate the rendered/targeted center ray");
  assert.ok(Math.abs(rightCentered.y - 300) < 1e-9);

  const pitch = .35;
  const pitchedProjection = gameplay.createLiteWorldProjection({ width: 800, height: 600, yaw: 0, pitch, fovDegrees: 70, distance: 6, target: { x: 0, y: 2, z: 0 } });
  const pointOnPitchedRay = {
    x: pitchedProjection.origin.x + pitchedProjection.forward.x * 24,
    y: pitchedProjection.origin.y + pitchedProjection.forward.y * 24,
    z: pitchedProjection.origin.z + pitchedProjection.forward.z * 24
  };
  const pitchedCenter = pitchedProjection.project(pointOnPitchedRay);
  assert.ok(Math.abs(pitchedCenter.x - 400) < 1e-9);
  assert.ok(Math.abs(pitchedCenter.y - 300) < 1e-9, "pitch must be represented by the same perspective basis, not ignored");

  const candidates = [
    { id: "water-center", type: "water", targetable: true, position: { x: 0, y: 2, z: 20 }, entity: { type: "water" } },
    { id: "water-off-reticle", type: "water", targetable: true, position: { x: 10, y: 2, z: 20 }, entity: { type: "water" } }
  ];
  const selected = gameplay.selectLiteReticleTarget(candidates, forwardProjection, { maxDistance: 120, allowedTypes: ["water"], hasLineOfSight: () => true });
  assert.equal(selected.id, "water-center");
  assert.ok(selected.screenDistance <= selected.targetRadiusPixels + 3);
  assert.equal(gameplay.selectLiteReticleTarget(candidates.slice(1), forwardProjection, { maxDistance: 120, allowedTypes: ["water"], hasLineOfSight: () => true }), null, "an off-reticle resource must not be selected");
  assert.equal(gameplay.selectLiteReticleTarget(candidates, forwardProjection, { maxDistance: 120, allowedTypes: ["water"], hasLineOfSight: () => false }), null, "screen alignment cannot bypass LOS");
});

test("Lite resource drawing emits a distinct world-space highlight only for the current target", () => {
  const makeContext = () => {
    const events = [];
    return {
      events,
      globalAlpha: 1,
      strokeStyle: "",
      fillStyle: "",
      lineWidth: 0,
      shadowColor: "",
      shadowBlur: 0,
      save() { events.push({ type: "save" }); },
      restore() { events.push({ type: "restore" }); },
      beginPath() { events.push({ type: "begin" }); },
      arc(x, y, radius) { events.push({ type: "arc", x, y, radius }); },
      stroke() { events.push({ type: "stroke", strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }); },
      fill() { events.push({ type: "fill", fillStyle: this.fillStyle, alpha: this.globalAlpha }); }
    };
  };
  const projected = { x: 400, y: 300, scale: 12 };
  const highlighted = makeContext();
  assert.equal(gameplay.drawLiteResource(highlighted, { id: "water-1", type: "water" }, projected, true, false), true);
  const highlightStroke = highlighted.events.find((event) => event.type === "stroke");
  assert.deepEqual(highlightStroke, { type: "stroke", strokeStyle: "#fff1a8", lineWidth: 3 });
  assert.equal(highlighted.events.filter((event) => event.type === "fill").length, 1);
  const arcs = highlighted.events.filter((event) => event.type === "arc");
  assert.ok(arcs[0].radius > arcs[1].radius, "highlight ring must surround the resource body");

  const ordinary = makeContext();
  gameplay.drawLiteResource(ordinary, { id: "water-2", type: "water" }, projected, false, false);
  assert.equal(ordinary.events.some((event) => event.type === "stroke"), false);
  const drawWorld = extractFunctionSource(game, "drawWorld");
  assert.match(drawWorld, /drawLiteResource\(ctx, resource, point, instance\.currentTarget\?\.id === resource\.id/);
});

test("targeting is reticle-driven and interaction no longer chooses nearest DOM/world row", () => {
  assert.match(game, /data-hwe-reticle/);
  assert.match(game, /data-hwe-target-prompt/);
  assert.match(game, /selectLiteReticleTarget/);
  assert.match(game, /liteProjectionForInstance/);
  assert.match(game, /perspective-yaw-pitch/);
  assert.match(game, /hasTerrainLineOfSight/);
  assert.match(game, /rendererCanPick\s*=\s*typeof instance\.renderer3d\?\.pickCenter/);
  assert.match(game, /if \(!selected && !rendererCanPick\)/);
  assert.match(game, /rendererSeedForState\(instance\.state\)/);
  assert.match(game, /const source = candidates\.find\(\(row\) => row\.id === picked\.id\)/);
  assert.doesNotMatch(game, /row\.entity\?\.species\?\.id === picked\.speciesId/);
  assert.match(game, /updateFlagship\(id,\s*\{\s*entityId:\s*creature\.id,\s*isPlayer:\s*false/);
  assert.match(game, /queryTargetLineOfSight\(value\)/);
  assert.match(game, /creature\.alive === false \|\| !RENDERER_ADAPTER\.FLAGSHIP_IDS\.includes\(id\)/);
  assert.match(game, /instance\.currentTarget\?\.type/);
  const start = game.indexOf("function interact(");
  const end = game.indexOf("\n  function sense(", start);
  const interaction = game.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(interaction, /\.sort\(\(a, b\) => Math\.hypot/);
});

test("locked 3D targets fail closed when their exact rendered entity becomes occluded or unavailable", () => {
  const hasLockedTargetLineOfSight = Function(
    "hasTerrainLineOfSight",
    `"use strict"; return (${extractFunctionSource(game, "hasLockedTargetLineOfSight")});`
  )(() => true);
  const candidate = { id: "animal-7", type: "animal" };
  const renderer3d = { queryTargetLineOfSight: ({ entityId }) => ({ supported: entityId === "animal-7", visible: true }) };

  assert.equal(hasLockedTargetLineOfSight({ renderer3d }, candidate, {}), true);
  renderer3d.queryTargetLineOfSight = () => ({ supported: true, visible: false });
  assert.equal(hasLockedTargetLineOfSight({ renderer3d }, candidate, {}), false);
  renderer3d.queryTargetLineOfSight = () => ({ supported: false, visible: false });
  assert.equal(hasLockedTargetLineOfSight({ renderer3d }, candidate, {}), false);
  renderer3d.queryTargetLineOfSight = () => Promise.resolve({ supported: true, visible: true });
  assert.equal(hasLockedTargetLineOfSight({ renderer3d }, candidate, {}), false);
  renderer3d.queryTargetLineOfSight = ({ entityId, type }) => ({ supported: entityId === "water-1" && type === "water", visible: true });
  assert.equal(hasLockedTargetLineOfSight({ renderer3d }, { id: "water-1", type: "water" }, {}), true);
  renderer3d.queryTargetLineOfSight = () => ({ supported: false, visible: false });
  assert.equal(hasLockedTargetLineOfSight({ renderer3d }, { id: "water-missing", type: "water" }, {}), false, "a resource without an exact rendered marker must fail closed");
});

test("fixed-step movement is resolved through bounded world collision before committing player coordinates", () => {
  assert.match(game, /HHEonWildCollisionSystem/);
  assert.match(game, /COLLISION\.createCollisionSystem\(\{\s*terrainSampler,\s*waterSampler,\s*cellSize:\s*24/);
  const refresh = extractFunctionSource(game, "refreshStaticCollision");
  assert.match(refresh, /getEnvironmentCollisionPlacements/);
  assert.match(refresh, /const placements = snapshot\.placements/);
  assert.match(refresh, /environmentCollisionObstacle\(placement\)/);
  assert.doesNotMatch(refresh, /planEnvironmentPlacements/);
  assert.doesNotMatch(game, /function collisionQualityPreset/);
  assert.match(game, /createProceduralLandscape\?\.\(\{[\s\S]*?realmId:[\s\S]*?timeSliceId:[\s\S]*?regionId:/);
  assert.match(game, /instance\.collisionLandscape\.sampleHeight\(clamp\(x,\s*0,\s*WORLD_SIZE\),\s*clamp\(z,\s*0,\s*WORLD_SIZE\)\)/);
  assert.match(game, /planProceduralLakes\?\.\(instance\.collisionLandscape/);
  assert.match(game, /queryLandscapeWater\?\.\(instance\.collisionLandscape/);
  assert.match(game, /collisionSystem\.resolveMovement\(/);
  assert.match(game, /locomotion:\s*collisionProfileForSpecies\(species\)/);
  assert.match(game, /instance\.collisionStepResolver\s*=\s*\(proposed, current\) => resolveDesktopCollisionStep/);
  assert.match(game, /instance\.desktopController\?\.advance\?\.\([\s\S]*?instance\.collisionStepResolver/);
  assert.match(game, /velocityX:\s*hardBoundary \? 0 : collision\.resolvedVelocityX/);
  const updateWorld = extractFunctionSource(game, "updateWorld");
  assert.doesNotMatch(updateWorld, /desktopController\.reset/);
  assert.match(game, /instance\.collisionSystem\?\.dispose\?\.\(\)/);
  assert.match(game, /instance\.collisionLandscape\?\.dispose\?\.\(\)/);
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
