"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "hh-eonwild-desktop-controller.js");
const source = fs.readFileSync(sourcePath, "utf8");
const desktop = require(sourcePath);
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} must be within ${tolerance} of ${expected}`);

test("desktop controller is a renderer-neutral UMD/CommonJS module with a bounded API", () => {
  assert.equal(desktop.VERSION, "1.2.0");
  assert.equal(desktop.FORMAT, "hh-eonwild-desktop-controller-v1");
  for (const name of [
    "getCameraProfile", "applyMouseLook", "cameraRelativeMovement", "updateZoom",
    "resolveCameraCollisionDistance", "createControllerState", "stepControllerState",
    "interpolateControllerState", "selectTarget", "dampAngle", "autoCenterCameraYaw", "createGameplayState",
    "reduceGameplayState", "createPointerLockState", "reducePointerLock"
  ]) assert.equal(typeof desktop[name], "function", `${name} must be exported`);
  assert.equal(typeof desktop.FixedTimestepController, "function");

  const sandbox = {};
  vm.runInNewContext(source, sandbox, { filename: "hh-eonwild-desktop-controller.js" });
  assert.equal(sandbox.HHEonWildDesktopController.VERSION, desktop.VERSION);
  assert.equal(typeof sandbox.HHEonWildDesktopController.FixedTimestepController, "function");
  assert.doesNotMatch(source, /BABYLON|THREE\.|createElement|getContext\s*\(|fetch\s*\(|localStorage/);
});

test("all creature camera profiles are distinct, frozen and bounded", () => {
  assert.deepEqual(desktop.CAMERA_PROFILE_IDS, ["ground", "heavy", "small", "bird", "aquatic", "climbing", "burrow"]);
  const distances = new Set();
  for (const id of desktop.CAMERA_PROFILE_IDS) {
    const profile = desktop.getCameraProfile(id);
    assert.equal(profile.id, id);
    assert.ok(Object.isFrozen(profile));
    assert.ok(profile.minDistance >= desktop.LIMITS.MIN_CAMERA_DISTANCE);
    assert.ok(profile.distance >= profile.minDistance && profile.distance <= profile.maxDistance);
    assert.ok(profile.minPitch < profile.maxPitch);
    assert.ok(profile.acceleration > 0 && profile.deceleration > 0 && profile.turnRate > 0);
    distances.add(profile.distance);
  }
  assert.ok(distances.size >= 6);
  assert.equal(desktop.getCameraProfile("unknown"), desktop.CAMERA_PROFILES.ground);

  const bounded = desktop.getCameraProfile({
    id: "bird", minDistance: -100, maxDistance: 999, distance: 999,
    minPitch: -99, maxPitch: 99, sensitivityX: 999
  });
  assert.equal(bounded.minDistance, desktop.LIMITS.MIN_CAMERA_DISTANCE);
  assert.equal(bounded.maxDistance, desktop.LIMITS.MAX_CAMERA_DISTANCE);
  assert.equal(bounded.distance, desktop.LIMITS.MAX_CAMERA_DISTANCE);
  assert.equal(bounded.sensitivityX, desktop.LIMITS.MAX_SENSITIVITY);
  const partial = desktop.getCameraProfile({ id: "bird", invertY: true });
  assert.equal(partial.distance, desktop.CAMERA_PROFILES.bird.distance);
  assert.equal(partial.sensitivityX, desktop.CAMERA_PROFILES.bird.sensitivityX);
  assert.equal(partial.invertY, true);
});

test("pointer movement updates wrapped yaw and clamped pitch with sensitivity and invert-Y", () => {
  const profile = desktop.CAMERA_PROFILES.ground;
  const normal = desktop.applyMouseLook(
    { yaw: Math.PI - 0.01, pitch: 0 },
    { movementX: -100, movementY: 100 },
    { profile: "ground", sensitivityX: 0.002, sensitivityY: 0.002 }
  );
  assert.ok(normal.yaw >= -Math.PI && normal.yaw <= Math.PI);
  near(normal.pitch, -0.2);
  const turnsRight = desktop.applyMouseLook({ yaw: 0, pitch: 0 }, { movementX: 10, movementY: 0 }, { sensitivityX: 0.002 });
  near(turnsRight.yaw, 0.02);

  const inverted = desktop.applyMouseLook(
    { yaw: 0, pitch: 0 },
    { movementX: 0, movementY: 100 },
    { profile: "ground", sensitivityY: 0.002, invertY: true }
  );
  near(inverted.pitch, 0.2);

  const high = desktop.applyMouseLook({ pitch: 0 }, { movementY: -999999 }, { profile: "ground" });
  const low = desktop.applyMouseLook({ pitch: 0 }, { movementY: 999999 }, { profile: "ground" });
  assert.equal(high.pitch, profile.maxPitch);
  assert.equal(low.pitch, profile.minPitch);
});

test("camera-relative WASD movement follows yaw and never gains diagonal speed", () => {
  const forward = desktop.cameraRelativeMovement({ x: 0, y: 1 }, Math.PI / 2);
  near(forward.x, 1);
  near(forward.z, 0);
  near(forward.magnitude, 1);

  const diagonal = desktop.cameraRelativeMovement({ x: 1, y: 1 }, 0.73);
  near(Math.hypot(diagonal.x, diagonal.z), 1);
  near(diagonal.magnitude, 1);
  const half = desktop.cameraRelativeMovement({ x: 0.3, y: 0.4 }, 0);
  near(Math.hypot(half.x, half.z), 0.5);
});

test("zoom and collision distance helpers clamp invalid or obstructed camera distances", () => {
  assert.equal(desktop.updateZoom(5, 100000, { profile: "small" }), desktop.CAMERA_PROFILES.small.maxDistance);
  assert.equal(desktop.updateZoom(5, -100000, { profile: "small" }), desktop.CAMERA_PROFILES.small.minDistance);
  assert.equal(desktop.resolveCameraCollisionDistance(8, null, { profile: "ground" }), 8);
  near(desktop.resolveCameraCollisionDistance(8, 3, { profile: "ground", padding: 0.25 }), 2.75);
  assert.equal(
    desktop.resolveCameraCollisionDistance(8, 0.2, { profile: "ground", padding: 0.5 }),
    desktop.CAMERA_PROFILES.ground.minDistance
  );
});

function simulate(renderFps, seconds, input, options = {}) {
  const controller = new desktop.FixedTimestepController({ stepSeconds: 1 / 120, profile: "ground", ...options });
  const frameSeconds = 1 / renderFps;
  for (let elapsed = 0; elapsed < seconds - 1e-12; elapsed += frameSeconds) {
    controller.advance(Math.min(frameSeconds, seconds - elapsed), input);
  }
  return controller;
}

test("fixed timestep movement, acceleration and smooth heading are render-FPS independent", () => {
  const input = { x: 1, y: 1, cameraYaw: 0.83, sprint: true };
  const at30 = simulate(30, 3, input);
  const at60 = simulate(60, 3, input);
  const at144 = simulate(144, 3, input);
  for (const key of ["x", "z", "velocityX", "velocityZ", "heading", "elapsed"]) {
    near(at30.state[key], at60.state[key], 1e-8);
    near(at30.state[key], at144.state[key], 1e-8);
  }
  near(at30.state.elapsed, 3, 1e-8);
  const maximumSprintSpeed = desktop.CAMERA_PROFILES.ground.maxSpeed * desktop.CAMERA_PROFILES.ground.sprintMultiplier;
  assert.ok(Math.hypot(at30.state.velocityX, at30.state.velocityZ) <= maximumSprintSpeed + 1e-9);
  assert.ok(Math.abs(at30.state.heading) <= Math.PI);
});

test("release decelerates exactly to rest without residual drift", () => {
  const controller = simulate(60, 1, { x: 0, y: 1, cameraYaw: 0 });
  const releaseX = controller.state.x;
  const releaseZ = controller.state.z;
  for (let index = 0; index < 240; index += 1) controller.advance(1 / 120, { x: 0, y: 0, cameraYaw: 0 });
  assert.equal(controller.state.velocityX, 0);
  assert.equal(controller.state.velocityZ, 0);
  const stoppedX = controller.state.x;
  const stoppedZ = controller.state.z;
  for (let index = 0; index < 120; index += 1) controller.advance(1 / 120, { x: 0, y: 0, cameraYaw: 0 });
  assert.equal(controller.state.x, stoppedX);
  assert.equal(controller.state.z, stoppedZ);
  assert.equal(controller.state.x, releaseX);
  assert.ok(controller.state.z > releaseZ, "finite deceleration may carry the animal briefly before a complete stop");
});

test("fixed step exposes bounded substeps and an interpolated render state", () => {
  const controller = new desktop.FixedTimestepController({ stepSeconds: 1 / 60, maxSubSteps: 2 });
  const result = controller.advance(0.25, { y: 1 });
  assert.equal(result.steps, 2);
  assert.ok(result.droppedSeconds > 0);
  assert.ok(result.alpha >= 0 && result.alpha <= 1);
  assert.ok(result.renderState.elapsed >= result.previousState.elapsed);
  assert.ok(result.renderState.elapsed <= result.state.elapsed);
});

test("fixed timestep resolves collision inside every substep without resetting interpolation time", () => {
  const controller = new desktop.FixedTimestepController({
    stepSeconds: 1 / 120,
    initialState: { x: 0, z: 0 },
    maxSpeed: 12,
    acceleration: 1000,
    deceleration: 1000
  });
  let resolvedSteps = 0;
  const frame = controller.advance(1 / 30, { x: 0, y: 1, cameraYaw: 0 }, (proposed) => {
    resolvedSteps += 1;
    return proposed.z > 0.1 ? { ...proposed, z: 0.1, velocityZ: 0 } : proposed;
  });

  assert.equal(frame.steps, 4);
  assert.equal(resolvedSteps, frame.steps);
  assert.equal(frame.state.z, 0.1);
  assert.equal(frame.state.velocityZ, 0);
  assert.equal(frame.state.elapsed, 1 / 30);
  assert.equal(frame.droppedSeconds, 0);
  assert.ok(frame.alpha >= 0 && frame.alpha <= 1);
});

test("target selection defaults to animals and enforces range, reticle angle and line of sight", () => {
  const candidates = [
    { id: "food", type: "food", position: { x: 0, y: 0, z: 2 } },
    { id: "blocked", type: "animal", position: { x: 0, y: 0, z: 3 }, occluderDistance: 2 },
    { id: "off-axis", type: "animal", position: { x: 3, y: 0, z: 3 } },
    { id: "far", type: "animal", position: { x: 0, y: 0, z: 50 } },
    { id: "visible", type: "animal", position: { x: 0.05, y: 0, z: 5 }, lineOfSight: true }
  ];
  const selected = desktop.selectTarget(candidates, {
    origin: { x: 0, y: 0, z: 0 }, forward: { x: 0, y: 0, z: 1 }, maxDistance: 10, maxAngle: 0.2
  });
  assert.equal(selected.id, "visible");
  assert.equal(selected.sourceIndex, 4);
  assert.equal(desktop.selectTarget([{ id: "hidden", type: "animal", distance: 2, angle: 0, lineOfSight: false }]), null);
  assert.equal(desktop.selectTarget([{ id: "far", type: "animal", distance: 26, angle: 0 }]), null);
});

test("target selection supports an explicit pure LOS callback and bounded interaction types", () => {
  const candidates = [
    { id: "water", type: "water", distance: 2, angle: 0.01 },
    { id: "nest", type: "nest", distance: 3, angle: 0.02 },
    { id: "animal", type: "animal", distance: 4, angle: 0 }
  ];
  const selected = desktop.selectTarget(candidates, {
    allowedTypes: ["water", "nest"],
    maxDistance: 10,
    maxAngle: 0.1,
    hasLineOfSight: (candidate, ray) => candidate.id === "nest" && ray.distance === 3
  });
  assert.equal(selected.id, "nest");
  assert.equal(selected.type, "nest");
});

test("gameplay reducer gates input contexts and returns from overlays deterministically", () => {
  const { GAMEPLAY_EVENTS: E, GAMEPLAY_STATES: S, INPUT_CONTEXTS: C } = desktop;
  let machine = desktop.createGameplayState();
  assert.deepEqual({ status: machine.status, context: machine.context }, { status: S.BOOT, context: C.NONE });
  machine = desktop.reduceGameplayState(machine, E.BOOT_COMPLETE);
  machine = desktop.reduceGameplayState(machine, E.START);
  assert.equal(machine.status, S.ENTERING);
  assert.equal(machine.context, C.NONE);
  machine = desktop.reduceGameplayState(machine, E.POINTER_READY);
  assert.equal(machine.status, S.PLAYING);
  assert.equal(machine.context, C.GAMEPLAY);

  machine = desktop.reduceGameplayState(machine, E.OPEN_MAP);
  assert.equal(machine.status, S.MAP);
  assert.equal(machine.context, C.MAP);
  assert.equal(machine.returnTo, S.PLAYING);
  machine = desktop.reduceGameplayState(machine, E.CLOSE_MAP);
  assert.equal(machine.status, S.PLAYING);

  machine = desktop.reduceGameplayState(machine, E.PAUSE);
  machine = desktop.reduceGameplayState(machine, E.OPEN_CODEX);
  machine = desktop.reduceGameplayState(machine, E.CLOSE_CODEX);
  assert.equal(machine.status, S.PAUSED);
  assert.equal(machine.context, C.PAUSE);
  machine = desktop.reduceGameplayState(machine, E.RESUME);
  assert.equal(machine.status, S.ENTERING);
  machine = desktop.reduceGameplayState(machine, E.ENTRY_FAILED);
  assert.equal(machine.status, S.PAUSED);
  const unchanged = desktop.reduceGameplayState(machine, E.START);
  assert.equal(unchanged, machine, "invalid transitions must preserve the exact state object");
  machine = desktop.reduceGameplayState(machine, E.EXIT);
  assert.equal(machine.status, S.EXITING);
  machine = desktop.reduceGameplayState(machine, E.RESET);
  assert.equal(machine.status, S.BOOT);
});

test("pointer-lock reducer distinguishes deliberate release from unexpected loss", () => {
  const { POINTER_LOCK_EVENTS: E, POINTER_LOCK_STATES: S } = desktop;
  let state = desktop.createPointerLockState();
  state = desktop.reducePointerLock(state, E.REQUEST);
  assert.equal(state.status, S.REQUESTING);
  assert.equal(state.desired, true);
  state = desktop.reducePointerLock(state, E.LOCKED);
  assert.equal(state.status, S.LOCKED);
  state = desktop.reducePointerLock(state, E.UNLOCKED);
  assert.equal(state.status, S.UNLOCKED);
  assert.equal(state.shouldPause, true);
  assert.equal(state.reason, "LOCK_LOST");

  state = desktop.reducePointerLock(state, E.REQUEST);
  state = desktop.reducePointerLock(state, E.LOCKED);
  state = desktop.reducePointerLock(state, E.RELEASE);
  state = desktop.reducePointerLock(state, E.UNLOCKED);
  assert.equal(state.shouldPause, false);
  assert.equal(state.reason, null);

  state = desktop.reducePointerLock(desktop.reducePointerLock(state, E.REQUEST), { type: E.ERROR, code: "DENIED" });
  assert.equal(state.status, S.ERROR);
  assert.equal(state.shouldPause, true);
  assert.equal(state.error, "DENIED");
});

test("auto-center is opt-in, waits after manual look and damps independently of frame rate", () => {
  const disabled = desktop.autoCenterCameraYaw(1, 0, 1 / 60, { enabled: false, movementSpeed: 8, idleMilliseconds: 5000 });
  assert.equal(disabled, 1);
  const waiting = desktop.autoCenterCameraYaw(1, 0, 1 / 60, { enabled: true, movementSpeed: 8, idleMilliseconds: 800, delayMilliseconds: 1600 });
  assert.equal(waiting, 1);
  const oneFrame = desktop.autoCenterCameraYaw(1, 0, 1 / 60, { enabled: true, movementSpeed: 8, idleMilliseconds: 2000, delayMilliseconds: 1600, ratePerSecond: 2 });
  assert.ok(oneFrame < 1 && oneFrame > 0);
  let fifteenFrames = 1;
  for (let index = 0; index < 15; index += 1) fifteenFrames = desktop.autoCenterCameraYaw(fifteenFrames, 0, 1 / 60, { enabled: true, movementSpeed: 8, idleMilliseconds: 2000, delayMilliseconds: 1600, ratePerSecond: 2 });
  const oneQuarterSecond = desktop.autoCenterCameraYaw(1, 0, .25, { enabled: true, movementSpeed: 8, idleMilliseconds: 2000, delayMilliseconds: 1600, ratePerSecond: 2 });
  assert.ok(Math.abs(fifteenFrames - oneQuarterSecond) < 0.01);
});
