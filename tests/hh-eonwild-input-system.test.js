"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "hh-eonwild-input-system.js");
const source = fs.readFileSync(sourcePath, "utf8");
const input = require(sourcePath);

class ListenerTarget {
  constructor() {
    this.listeners = new Map();
    this.hidden = false;
  }

  addEventListener(type, listener, options = {}) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
    if (options.signal) options.signal.addEventListener("abort", () => this.removeEventListener(type, listener), { once: true });
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type, event = {}) {
    for (const listener of Array.from(this.listeners.get(type) || [])) listener({ type, ...event });
  }

  count() {
    return Array.from(this.listeners.values()).reduce((sum, rows) => sum + rows.size, 0);
  }
}

const keyboardEvent = (code, target = null, timeStamp = 100) => {
  let prevented = false;
  return {
    code,
    target,
    timeStamp,
    repeat: false,
    preventDefault() { prevented = true; },
    get prevented() { return prevented; }
  };
};

test("input kernel exposes a renderer-neutral UMD/CommonJS API and accessible action metadata", () => {
  assert.equal(input.VERSION, "1.2.0");
  assert.equal(input.FORMAT, "hh-eonwild-input-profile-v1");
  assert.equal(input.ACTION_IDS.length, 23);
  assert.equal(Object.keys(input.ACTION_METADATA).length, input.ACTION_IDS.length);
  for (const actionId of input.ACTION_IDS) {
    assert.ok(input.ACTION_METADATA[actionId].labelVi.length > 0);
    assert.ok(input.ACTION_METADATA[actionId].labelEn.length > 0);
    assert.ok(input.ACTION_METADATA[actionId].ariaLabel.length > 0);
  }
  for (const name of [
    "normalizeBinding", "normalizeMappings", "detectBindingConflicts", "normalizeVector",
    "applyCircularDeadzone", "stepMovement", "isTextEntryTarget", "isTextEntryEvent",
    "validatePersistencePayload", "detectFeatures", "createInputActionSystem"
  ]) assert.equal(typeof input[name], "function", `${name} must be exported`);
  assert.equal(typeof input.InputBuffer, "function");
  assert.equal(typeof input.InputActionSystem, "function");

  const sandbox = {};
  vm.runInNewContext(source, sandbox, { filename: "hh-eonwild-input-system.js" });
  assert.equal(sandbox.HHEonWildInputSystem.VERSION, input.VERSION);
  assert.equal(typeof sandbox.HHEonWildInputSystem.createInputActionSystem, "function");
  assert.doesNotMatch(source, /BABYLON|THREE\.|getContext\s*\(/);
});

test("default mappings cover required keyboard controls without collisions and normalize deterministically", () => {
  const expected = {
    moveForward: ["KeyW"], moveBackward: ["KeyS"], moveLeft: ["KeyA"], moveRight: ["KeyD"],
    sprint: ["ShiftLeft"], crouch: ["ControlLeft"], jump: ["Space"], interact: ["KeyE", "KeyF"], createNest: ["KeyN"],
    sense: ["KeyQ"], ability: ["KeyR"], communicationWheel: ["KeyC"],
    toggleView: ["KeyV"], lockTarget: ["KeyZ"], shoulderSwap: ["KeyX"],
    lookBack: ["KeyB"], cameraReset: ["Home"], toggleMinimap: ["KeyH"], quickTurn: ["KeyG"], codex: ["Tab"],
    worldMap: ["KeyM"], photoMode: ["KeyP"], pause: ["Escape"]
  };
  for (const [actionId, codes] of Object.entries(expected)) {
    for (const code of codes) {
      assert.ok(input.DEFAULT_ACTIONS[actionId].some((binding) => binding.device === "keyboard" && binding.code === code), `${actionId} must include ${code}`);
    }
  }
  assert.deepEqual(input.detectBindingConflicts(input.DEFAULT_ACTIONS), []);
  for (const preset of Object.values(input.DEFAULT_PRESETS)) {
    assert.deepEqual(input.detectBindingConflicts(preset.mappings), [], `${preset.id} preset must not contain collisions`);
  }
  assert.equal(input.canonicalKeyboardCode("w"), "KeyW");
  assert.equal(input.canonicalKeyboardCode("Ctrl"), "ControlLeft");
  assert.deepEqual(input.normalizeBinding({ device: "gamepad", type: "axis", axis: 1, direction: -8, threshold: 2 }), {
    device: "gamepad", control: "axis", index: 1, direction: -1, threshold: 1
  });
  assert.equal(input.normalizeBinding({ device: "gamepad", control: "button", index: 100 }), null);

  const first = input.normalizeMappings({ jump: ["Space", "Space", { device: "keyboard", code: "Space" }] });
  const second = input.normalizeMappings({ jump: [{ device: "keyboard", code: "Space" }, "Space"] });
  assert.deepEqual(first, second);
  assert.equal(first.jump.length, 1);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.jump));
});

test("remapping detects collisions, supports explicit conflict override and multiple presets", () => {
  const system = new input.InputActionSystem({ clock: () => 1000 });
  const rejected = system.remap("jump", ["KeyF"]);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "BINDING_CONFLICT");
  assert.deepEqual(rejected.conflicts[0].actions, ["interact", "jump"]);
  assert.ok(system.getMappings().jump.some((binding) => binding.code === "Space"));

  const accepted = system.remap("jump", ["KeyF"], { allowConflicts: true });
  assert.equal(accepted.ok, true);
  assert.equal(system.getConflicts().length, 1);
  assert.equal(system.createPreset("field-kit", "Bộ điều khiển thực địa").ok, true);
  assert.equal(system.applyPreset("left-handed").ok, true);
  assert.equal(system.presetId, "left-handed");
  assert.ok(system.getMappings().moveForward.some((binding) => binding.code === "ArrowUp"));
  assert.ok(system.listPresets().some((preset) => preset.id === "field-kit" && preset.builtin === false));
  assert.equal(system.removePreset("field-kit"), true);
  assert.equal(system.applyPreset("missing").reason, "PRESET_UNKNOWN");
  system.dispose();
});

test("camera gameplay actions support hold, edge-triggered, gamepad and remapped input without default collisions", () => {
  let now = 400;
  const system = new input.InputActionSystem({ clock: () => now });

  const lookBackDown = keyboardEvent("KeyB", { tagName: "CANVAS" }, now);
  assert.equal(system.handleKeyDown(lookBackDown), true);
  assert.equal(system.isActionDown("lookBack"), true, "look-back must remain active while its binding is held");
  assert.equal(system.wasPressed("lookBack", now)?.payload.source, "keyboard");
  assert.equal(system.handleKeyDown({ ...keyboardEvent("KeyB"), repeat: true }), true);
  assert.equal(system.wasPressed("lookBack", now), null, "keyboard repeat must not enqueue extra look-back presses");
  assert.equal(system.handleKeyUp({ code: "KeyB", target: { tagName: "INPUT" } }), true);
  assert.equal(system.isActionDown("lookBack"), false, "keyup must release hold actions even after focus enters a field");

  now = 420;
  system.handleKeyDown(keyboardEvent("KeyX"));
  assert.equal(system.wasPressed("shoulderSwap", now)?.actionId, "shoulderSwap");
  system.handleKeyUp({ code: "KeyX" });
  system.handleKeyDown(keyboardEvent("Home"));
  assert.equal(system.wasPressed("cameraReset", now)?.actionId, "cameraReset");
  system.handleKeyUp({ code: "Home" });

  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  buttons[13] = { pressed: true, value: 1 };
  buttons[14] = { pressed: true, value: 1 };
  buttons[15] = { pressed: true, value: 1 };
  const gamepad = system.updateGamepads([{ connected: true, index: 0, axes: [0, 0], buttons }], 430);
  assert.ok(gamepad.actions.includes("lookBack"));
  assert.ok(gamepad.actions.includes("quickTurn"));
  assert.ok(gamepad.actions.includes("shoulderSwap"));
  assert.equal(system.wasPressed("quickTurn", 430)?.payload.source, "gamepad");

  const collision = system.remap("cameraReset", ["KeyX"]);
  assert.equal(collision.ok, false);
  assert.equal(collision.reason, "BINDING_CONFLICT");
  assert.deepEqual(collision.conflicts[0].actions, ["cameraReset", "shoulderSwap"]);
  assert.ok(system.getMappings().cameraReset.some((binding) => binding.code === "Home"));
  system.dispose();
});

test("circular deadzone suppresses drift and diagonal movement remains normalized", () => {
  assert.deepEqual(input.applyCircularDeadzone(0.05, -0.05, 0.2), { x: 0, y: 0, magnitude: 0 });
  const stick = input.applyCircularDeadzone(0.6, 0, 0.2);
  assert.ok(Math.abs(stick.x - 0.5) < 1e-12);
  assert.equal(stick.y, 0);
  assert.ok(Math.abs(stick.magnitude - 0.5) < 1e-12);

  const diagonal = input.normalizeVector(1, 1);
  assert.ok(Math.abs(diagonal.x - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(diagonal.y - Math.SQRT1_2) < 1e-12);
  assert.equal(diagonal.magnitude, 1);

  const system = new input.InputActionSystem({ clock: () => 200 });
  system.handleKeyDown(keyboardEvent("KeyW"));
  system.handleKeyDown(keyboardEvent("KeyD"));
  const movement = system.getMovementVector();
  assert.ok(Math.abs(movement.x - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(movement.y - Math.SQRT1_2) < 1e-12);
  assert.equal(movement.magnitude, 1);
  system.dispose();
});

test("gamepad buttons, axes and touch controls share the action abstraction", () => {
  const system = new input.InputActionSystem({ clock: () => 500, settings: { gamepadDeadzone: 0.2, touchDeadzone: 0.1 } });
  const buttons = Array.from({ length: 12 }, () => ({ pressed: false, value: 0 }));
  buttons[0] = { pressed: true, value: 1 };
  const result = system.updateGamepads([{ connected: true, index: 2, axes: [0.6, 0], buttons }], 500);
  assert.equal(result.connected, true);
  assert.ok(result.actions.includes("jump"));
  assert.ok(result.actions.includes("moveRight"));
  assert.equal(system.isActionDown("jump"), true);
  assert.ok(Math.abs(system.getMovementVector().x - 0.5) < 1e-12, "analog movement must not be counted twice as a digital key");
  assert.equal(system.wasPressed("jump", 500)?.payload.source, "gamepad");

  system.updateGamepads([], 510);
  assert.equal(system.isActionDown("jump"), false);
  assert.equal(system.setTouchAction("ability", true, 520), true);
  assert.equal(system.isActionDown("ability"), true);
  assert.equal(system.wasPressed("ability", 520)?.payload.source, "touch");
  system.setTouchJoystick(0, -1);
  assert.equal(system.getMovementVector().y, 1);
  system.setTouchAction("ability", false, 530);
  assert.equal(system.isActionDown("ability"), false);
  system.dispose();
});

test("pointercancel and touchcancel release only touch state, while blur cleanup stays idempotent", () => {
  let now = 600;
  const target = new ListenerTarget();
  const system = new input.InputActionSystem({ runtime: { AbortController }, clock: () => now });
  const emitted = [];
  system.subscribe((event) => emitted.push(event));
  assert.equal(system.attach(target).ok, true);

  system.handleKeyDown(keyboardEvent("KeyW", { tagName: "CANVAS" }));
  system.setTouchJoystick(0.75, -0.25);
  system.setTouchAction("lookBack", true, now);
  target.dispatch("pointercancel", { pointerType: "mouse" });
  assert.equal(system.isActionDown("lookBack"), true, "mouse cancellation must not discard an active touch pointer");

  target.dispatch("pointercancel", { pointerType: "touch" });
  assert.equal(system.isActionDown("lookBack"), false);
  assert.deepEqual(system.touchStick, { x: 0, y: 0, magnitude: 0 });
  assert.equal(system.wasPressed("lookBack", now), null, "cancelled touch presses must be removed from the buffer");
  assert.equal(system.isActionDown("moveForward"), true, "touch cancellation must preserve keyboard movement");
  assert.equal(system.wasPressed("moveForward", now)?.payload.source, "keyboard");
  target.dispatch("pointercancel", { pointerType: "touch" });
  assert.equal(emitted.filter((event) => event.type === "release-touch").length, 1, "repeated pointercancel must be idempotent");

  now = 620;
  system.setTouchJoystick(-1, 0);
  system.setTouchAction("quickTurn", true, now);
  target.dispatch("touchcancel");
  assert.equal(system.isActionDown("quickTurn"), false);
  assert.deepEqual(system.touchStick, { x: 0, y: 0, magnitude: 0 });
  assert.equal(emitted.filter((event) => event.type === "release-touch").length, 2);

  target.dispatch("blur");
  target.dispatch("blur");
  assert.equal(system.isActionDown("moveForward"), false);
  assert.equal(emitted.filter((event) => event.type === "release-all" && event.detail.source === "blur").length, 1, "repeated blur must emit one state transition");
  system.dispose();
});

test("input buffering is bounded, ordered, consumable and expires by a real time window", () => {
  let now = 1000;
  const buffer = new input.InputBuffer({ windowMs: 100, maxEvents: 2, clock: () => now });
  assert.equal(buffer.push("missing", now), null);
  buffer.push("jump", 950, { source: "keyboard", privateData: "discard me" });
  buffer.push("ability", 970, { source: "touch", value: 0.75 });
  buffer.push("interact", 990, { source: "gamepad", value: 1 });
  assert.equal(buffer.size, 2, "oldest entry must be evicted at the configured bound");
  assert.equal(buffer.peek("ability", now)?.payload.source, "touch");
  assert.equal(buffer.consume("ability", now)?.actionId, "ability");
  assert.equal(buffer.consume("ability", now), null);
  now = 1100;
  assert.equal(buffer.peek("interact", now), null, "event on the exclusive expiry boundary must be stale after time advances");

  const system = new input.InputActionSystem({ clock: () => now, settings: { bufferWindowMs: 120 } });
  const event = keyboardEvent("Space", null, 1100);
  assert.equal(system.handleKeyDown(event), true);
  assert.equal(event.prevented, true);
  assert.equal(system.wasPressed("jump", 1150, false)?.actionId, "jump");
  assert.equal(system.wasPressed("jump", 1150, true)?.actionId, "jump");
  assert.equal(system.wasPressed("jump", 1150), null);
  system.dispose();

  const differentEpoch = new input.InputActionSystem({ clock: () => 500000 });
  differentEpoch.handleKeyDown(keyboardEvent("Space", null, 7));
  assert.equal(differentEpoch.wasPressed("jump", 500000)?.at, 500000, "DOM event and input clock epochs must never be mixed");
  differentEpoch.dispose();
});

test("text-entry guard blocks gameplay hotkeys in editable controls and releases keys safely", () => {
  const system = new input.InputActionSystem({ clock: () => 100 });
  const inputNode = { tagName: "INPUT" };
  const textareaNode = { tagName: "TEXTAREA" };
  const editableParent = { tagName: "DIV", isContentEditable: true };
  const nested = { tagName: "SPAN", parentElement: editableParent };
  const roleTextbox = { tagName: "DIV", getAttribute(name) { return name === "role" ? "textbox" : null; } };
  const plaintextEditable = { tagName: "DIV", getAttribute(name) { return name === "contenteditable" ? "plaintext-only" : null; } };
  for (const node of [inputNode, textareaNode, nested, roleTextbox, plaintextEditable]) assert.equal(input.isTextEntryTarget(node), true);
  assert.equal(input.isTextEntryTarget({ tagName: "CANVAS" }), false);
  assert.equal(input.isTextEntryEvent({ target: { tagName: "DIV" }, composedPath: () => [{ tagName: "INPUT" }, { tagName: "DIV" }] }), true);

  const blocked = keyboardEvent("KeyW", inputNode, 100);
  assert.equal(system.handleKeyDown(blocked), false);
  assert.equal(blocked.prevented, false);
  assert.equal(system.isActionDown("moveForward"), false);
  assert.equal(system.wasPressed("moveForward", 100), null);

  assert.equal(system.handleKeyDown(keyboardEvent("KeyW", { tagName: "CANVAS" }, 110)), true);
  assert.equal(system.isActionDown("moveForward"), true);
  assert.equal(system.handleKeyUp({ code: "KeyW", target: inputNode }), true, "keyup in a text field must still prevent a stuck movement key");
  assert.equal(system.isActionDown("moveForward"), false);
  system.dispose();
});

test("acceleration and deceleration helpers are frame-rate independent for equal elapsed time", () => {
  const simulate = (steps, dt, target) => {
    let velocity = { x: 0, y: 0 };
    for (let index = 0; index < steps; index += 1) velocity = input.stepMovement(velocity, target, 1.5, 2.5, dt);
    return velocity;
  };
  const at30 = simulate(15, 1 / 30, { x: 1, y: 0 });
  const at60 = simulate(30, 1 / 60, { x: 1, y: 0 });
  assert.ok(Math.abs(at30.x - at60.x) < 1e-12);
  assert.ok(Math.abs(at30.y - at60.y) < 1e-12);
  assert.ok(Math.abs(at30.x - 0.75) < 1e-12);

  let slowing30 = at30;
  let slowing60 = at60;
  for (let index = 0; index < 6; index += 1) slowing30 = input.stepMovement(slowing30, { x: 0, y: 0 }, 1.5, 1, 1 / 30);
  for (let index = 0; index < 12; index += 1) slowing60 = input.stepMovement(slowing60, { x: 0, y: 0 }, 1.5, 1, 1 / 60);
  assert.ok(Math.abs(slowing30.x - slowing60.x) < 1e-12);
});

test("persistence is allow-listed, bounded, secret-free and round-trips custom mappings", () => {
  const memory = new Map();
  const storage = {
    getItem(key) { return memory.has(key) ? memory.get(key) : null; },
    setItem(key, value) { memory.set(key, String(value)); },
    removeItem(key) { memory.delete(key); }
  };
  const first = new input.InputActionSystem({ storage, clock: () => 1000 });
  assert.equal(first.remap("jump", ["KeyY"]).ok, true);
  assert.equal(first.createPreset("quiet", "Điều khiển yên tĩnh").ok, true);
  assert.equal(first.save().ok, true);
  const raw = memory.get(input.STORAGE_KEY);
  assert.ok(raw.length < input.LIMITS.MAX_PROFILE_BYTES);
  assert.doesNotMatch(raw, /token|secret|password|credential/i);
  assert.equal(input.validatePersistencePayload(raw).valid, true);

  const second = new input.InputActionSystem({ storage, clock: () => 1000 });
  assert.equal(second.load().ok, true);
  assert.ok(second.getMappings().jump.some((binding) => binding.code === "KeyY"));
  assert.ok(second.listPresets().some((preset) => preset.id === "quiet"));
  assert.equal(second.clearPersistence(), true);
  assert.equal(memory.has(input.STORAGE_KEY), false);

  const previousActionSet = JSON.parse(raw);
  for (const actionId of ["createNest", "shoulderSwap", "lookBack", "cameraReset", "toggleMinimap", "quickTurn"]) delete previousActionSet.mappings[actionId];
  const migrated = input.validatePersistencePayload(previousActionSet);
  assert.equal(migrated.valid, true, "valid v1 profiles from before the camera actions must remain importable");
  assert.ok(migrated.value.mappings.lookBack.some((binding) => binding.code === "KeyB"));
  assert.ok(migrated.value.mappings.createNest.some((binding) => binding.code === "KeyN"));
  assert.ok(migrated.value.mappings.quickTurn.some((binding) => binding.device === "gamepad" && binding.index === 14));

  const poisoned = JSON.parse(raw);
  poisoned.accessToken = "must-never-be-imported";
  const invalid = input.validatePersistencePayload(poisoned);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.includes("PROFILE_CONTAINS_SECRET_FIELD"));
  assert.equal(second.importProfile(poisoned).ok, false);
  const malformedBinding = JSON.parse(raw);
  malformedBinding.mappings.jump = [{ device: "gamepad", control: "button", index: 200 }];
  assert.ok(input.validatePersistencePayload(malformedBinding).errors.includes("PROFILE_MAPPINGS_BINDING_INVALID"));
  assert.equal(input.validatePersistencePayload("{" + "x".repeat(input.LIMITS.MAX_PROFILE_BYTES) + "}").valid, false);
  first.dispose();
  second.dispose();
});

test("lifecycle uses AbortController, pause/resume clears state, and dispose leaves no listeners", () => {
  const target = new ListenerTarget();
  const documentTarget = new ListenerTarget();
  target.document = documentTarget;
  const runtime = { AbortController, document: documentTarget, navigator: { getGamepads: () => [] } };
  const system = new input.InputActionSystem({ runtime, clock: () => 200 });
  assert.equal(system.attach(target).ok, true);
  assert.equal(system.attach(target).alreadyAttached, true);
  assert.equal(target.count(), 5);
  assert.equal(documentTarget.count(), 1);

  const down = keyboardEvent("KeyW", { tagName: "CANVAS" }, 200);
  target.dispatch("keydown", down);
  assert.equal(system.isActionDown("moveForward"), true);
  assert.equal(system.pause(), true);
  assert.equal(system.paused, true);
  assert.equal(system.isActionDown("moveForward"), false);
  target.dispatch("keydown", keyboardEvent("KeyW", { tagName: "CANVAS" }, 210));
  assert.equal(system.isActionDown("moveForward"), false);
  assert.equal(system.resume(), true);
  assert.equal(system.paused, false);

  documentTarget.hidden = true;
  documentTarget.dispatch("visibilitychange");
  assert.equal(system.paused, true);
  documentTarget.hidden = false;
  documentTarget.dispatch("visibilitychange");
  assert.equal(system.paused, false);

  assert.equal(system.dispose(), true);
  assert.equal(system.dispose(), false);
  assert.equal(target.count(), 0);
  assert.equal(documentTarget.count(), 0);
  assert.equal(system.attach(target).reason, "DISPOSED");
});

test("feature detection degrades safely when browser capabilities are absent or throw", () => {
  const none = input.detectFeatures({});
  assert.equal(none.gamepad, false);
  assert.equal(none.touch, false);
  assert.equal(none.persistentStorage, false);
  const available = input.detectFeatures({
    addEventListener() {},
    AbortController,
    PointerEvent: function PointerEvent() {},
    navigator: { maxTouchPoints: 2, getGamepads: () => [{ vibrationActuator: {} }] },
    localStorage: { getItem() {} }
  });
  assert.equal(available.keyboard, true);
  assert.equal(available.abortController, true);
  assert.equal(available.gamepad, true);
  assert.equal(available.gamepadVibration, true);
  assert.equal(available.pointerEvents, true);
  assert.equal(available.touch, true);
  assert.equal(available.persistentStorage, true);
  assert.doesNotThrow(() => input.detectFeatures({ navigator: { getGamepads() { throw new Error("blocked"); } } }));

  const defaults = new input.InputActionSystem({ settings: { gamepadDeadzone: "invalid", touchDeadzone: NaN, bufferWindowMs: Infinity } });
  assert.equal(defaults.settings.gamepadDeadzone, 0.18);
  assert.equal(defaults.settings.touchDeadzone, 0.08);
  assert.equal(defaults.settings.bufferWindowMs, 180);
  defaults.dispose();
});
