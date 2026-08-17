const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const A = require(path.join(ROOT, "services/astra-character/AstraCharacterCore.js"));
[
  "CharacterDefinition", "CharacterAssetValidator", "SkeletonProfile", "AnimationRegistry", "AnimationRetargeter",
  "AnimationStateMachine", "AdditiveAnimationLayer", "LocomotionController", "MotionWarping", "FootPlacementIK",
  "FullBodyIK", "LookAtController", "WeaponGripSolver", "CombatMarkerTimeline", "CombatAnimationController",
  "HitReactionController", "RagdollController", "FacialPerformanceController", "LipSyncController",
  "SecondaryMotionController", "ContextualInteractionController", "CharacterCollisionController", "CharacterLODController",
  "CharacterNetworkReplicator", "CharacterPerformanceGovernor", "CinematicCharacterDirector", "ElementalCharacterIdentity",
  "CharacterCustomizationController", "CharacterDebugOverlay"
].forEach((name) => require(path.join(ROOT, `services/astra-character/${name}.js`)));
const { CharacterRuntimeV3 } = require(path.join(ROOT, "services/astra-character/CharacterRuntimeV3.js"));

test("Locomotion V3 accelerates, blends 2D input and transitions without an instant velocity jump", () => {
  const locomotion = new A.LocomotionController({ maxSpeed: 8, acceleration: 10, deceleration: 18 });
  locomotion.setInput({ x: 0.6, z: 1, cameraYaw: 0, sprint: true, combat: true, grounded: true });
  const first = locomotion.update(1 / 60);
  const later = Array.from({ length: 45 }).reduce(() => locomotion.update(1 / 60), first);
  assert.ok(first.speed > 0 && first.speed < 1, "first frame must accelerate rather than teleport to max speed");
  assert.ok(later.speed > first.speed);
  assert.ok(later.blend.forward > 0);
  assert.ok(later.blend.right > 0);
  assert.ok(A.LocomotionController.STATES.includes(later.state));
  locomotion.setInput({ x: 0, z: 0, grounded: true });
  assert.ok(locomotion.update(1 / 60).speed < later.speed);
});

test("combat hit window is marker-driven and duplicate sequence IDs are rejected", () => {
  const combat = new A.CombatAnimationController();
  const markers = [];
  combat.events.on("marker", (marker) => markers.push(marker.name));
  const action = { type: "light", sequenceId: "seq-1", duration: 1, markers: [
    { name: "windup_start", time: 0 }, { name: "active_start", time: 0.3 },
    { name: "active_end", time: 0.42 }, { name: "combo_open", time: 0.5 },
    { name: "combo_close", time: 0.72 }, { name: "recovery_end", time: 1 }
  ] };
  assert.equal(combat.request(action).accepted, true);
  combat.update(0.29);
  assert.equal(combat.timeline.windows.active, false);
  combat.update(0.02);
  assert.equal(combat.timeline.windows.active, true);
  assert.deepEqual(markers.slice(0, 2), ["windup_start", "active_start"]);
  combat.update(0.12);
  assert.equal(combat.timeline.windows.active, false);
  assert.equal(combat.request(action).reason, "duplicate-sequence");
});

test("foot lock smooths tiny terrain changes and full-body IK enforces anatomical reach", () => {
  const feet = new A.FootPlacementIK({ deadZone: 0.006, maxError: 0.03 });
  const initial = feet.updateFoot("left", { point: { x: 0, y: 0.1, z: 0 }, normal: { x: 0, y: 1, z: 0 }, plantMarker: true }, 1 / 60);
  const jitter = feet.updateFoot("left", { point: { x: 0.002, y: 0.103, z: 0.001 }, normal: { x: 0.01, y: 0.999, z: 0 }, plantMarker: true }, 1 / 60);
  assert.deepEqual(jitter.target, initial.target, "sub-dead-zone jitter must not move the locked foot");
  assert.ok(jitter.error <= 0.03);
  const ik = new A.FullBodyIK({ iterations: 8 });
  ik.registerChain("arm", { lengths: [0.3, 0.3] });
  const solve = ik.solveTwoBone("arm", { x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 });
  assert.equal(solve.stretched, true);
  assert.ok(solve.reachable < 0.6);
});

test("weapon grip reports missing sockets honestly and validates two-centimetre grip error", () => {
  const grip = new A.WeaponGripSolver();
  const incomplete = grip.registerProfile("rifle-missing", { weaponClass: "rifle", sockets: { Grip_R: {} } });
  assert.equal(incomplete.fallback, true);
  assert.deepEqual(incomplete.missingSockets, ["Grip_L"]);
  grip.registerProfile("rifle-ready", { weaponClass: "rifle", sockets: { Grip_R: {}, Grip_L: {} } });
  grip.equip("hero", "rifle-ready");
  assert.equal(grip.measureGrip("hero", { x: 0 }, { x: 0 }, { x: 0.019 }, { x: 0.018 }).valid, true);
  assert.equal(grip.measureGrip("hero", { x: 0 }, { x: 0 }, { x: 0.03 }, { x: 0 }).valid, false);
});

test("character separation resolves overlap without moving more than the frame correction budget", () => {
  const collision = new A.CharacterCollisionController({ maxCorrection: 0.15 });
  collision.register("player", { position: { x: 0, z: 0 }, player: true, priority: 1, personalSpaceRadius: 0.6 });
  collision.register("ally", { position: { x: 0, z: 0 }, personalSpaceRadius: 0.6 });
  const corrections = collision.solve();
  assert.ok(Math.hypot(corrections.ally.x, corrections.ally.z) > 0);
  assert.ok(Math.hypot(corrections.ally.x, corrections.ally.z) <= 0.16);
  assert.ok(Math.hypot(corrections.player.x, corrections.player.z) < Math.hypot(corrections.ally.x, corrections.ally.z));
});

test("facial subset, multilingual lip-sync fallback and secondary reset remain bounded", () => {
  const face = new A.FacialPerformanceController({ eyeBlinkLeft: 0, eyeBlinkRight: 1, jawOpen: 2 });
  face.setExpression("happy");
  const weights = face.update(1 / 60, 10).weights;
  assert.ok(Object.values(weights).every((value) => value >= 0 && value <= 1));
  const lip = new A.LipSyncController();
  lip.play({ startedAt: 0, cues: [{ start: 0, end: 0.2, viseme: "A" }] });
  assert.equal(lip.update(100).viseme_A, 1);
  assert.deepEqual(lip.stop(), { viseme_rest: 1 });
  const secondary = new A.SecondaryMotionController();
  secondary.registerChain("hair", [{ x: 0, y: 1 }, { x: 0, y: 0.9 }]);
  assert.equal(secondary.update(0.5), 0, "tab-resume delta must reset rather than explode the simulation");
  assert.equal(secondary.lastResetReason, "resume");
});

test("LOD, quality governor and network snapshot guards are deterministic", () => {
  const lod = new A.CharacterLODController();
  assert.equal(lod.select(4), "hero");
  assert.equal(lod.select(32), "lod2");
  assert.equal(lod.animationHz(70), 8);
  const governor = new A.CharacterPerformanceGovernor("balanced");
  governor.setTier("low");
  assert.equal(governor.profile().ikIterations, 2);
  const network = new A.CharacterNetworkReplicator();
  const packet = { characterId: "hero", actionSequenceId: "attack-1", serverTimestamp: 10, locomotionVector: { x: 2, z: 0 } };
  assert.equal(network.acceptSnapshot(packet).accepted, true);
  assert.equal(network.acceptSnapshot({ ...packet, serverTimestamp: 11 }).reason, "duplicate-sequence");
  assert.ok(Math.abs(network.snapshots[0].locomotionVector.x) <= 1);
});

test("runtime facade mounts, updates, reports truthful diagnostics and releases owned controllers", () => {
  const runtime = new CharacterRuntimeV3({ qualityTier: "balanced" });
  const object3d = { position: { x: 0, y: 0, z: 0 }, rotation: { y: 0 }, userData: {}, traverse(handler) { handler(this); } };
  runtime.registerSkeletonProfile({ id: "test-skeleton", boneMap: { root: "Root", hips: "Hips", spine: "Spine", head: "Head", leftHand: "LeftHand", rightHand: "RightHand", leftFoot: "LeftFoot", rightFoot: "RightFoot" } });
  runtime.registerCharacter({ id: "test-hero", model: "local.glb", skeletonProfileId: "test-skeleton", rights: { license: "repository-local" } });
  runtime.mountCharacter({ characterId: "test-hero", object3d, role: "player", backend: "webgl2" });
  runtime.setLocomotionInput("test-hero", { x: 0, z: 1, grounded: true });
  runtime.update(1 / 60, 16, { activeCharacterId: "test-hero" });
  const diagnostic = runtime.getDiagnostics("test-hero");
  assert.equal(diagnostic.mountedCharacters, 1);
  assert.equal(diagnostic.backend, "webgl2");
  assert.notEqual(diagnostic.characters[0].state, "idle");
  assert.equal(runtime.unmountCharacter("test-hero"), true);
  assert.equal(runtime.characters.size, 0);
  assert.equal(runtime.dispose(), true);
});

test("HH ASTRA loads every V3 module before the game and contains no timeout-based combat damage", () => {
  const loader = fs.readFileSync(path.join(ROOT, "performance-loader.js"), "utf8");
  const game = fs.readFileSync(path.join(ROOT, "astral-realms.js"), "utf8");
  const runtimeIndex = loader.indexOf("services/astra-character/CharacterRuntimeV3.js?v=1");
  const gameIndex = loader.indexOf("astral-realms.js?v=97");
  assert.ok(runtimeIndex >= 0 && gameIndex > runtimeIndex);
  assert.match(game, /pendingCombatActionsV3/);
  assert.match(game, /combatMarker:\s*"active_start"/);
  const attackStart = game.indexOf("attack(kind = \"attack\")");
  const attackEnd = game.indexOf("swingAnimation(", attackStart);
  assert.doesNotMatch(game.slice(attackStart, attackEnd), /setTimeout/);
  assert.match(game, /data-character-lab-v3/);
  assert.match(game, /releasePointerForUi\(`panel:/);
});
