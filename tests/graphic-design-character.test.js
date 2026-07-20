const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "graphic-design-character.js"), "utf8");
const character = require("../graphic-design-character.js");

test("Character Studio exposes the standalone mount and unmount API", () => {
  assert.match(source, /runtime\.HHGraphicCharacter\s*=\s*api/);
  assert.equal(typeof character.mount, "function");
  assert.equal(typeof character.unmount, "function");
  assert.equal(typeof character.createDefaultProject, "function");
  assert.equal(typeof character.normalizeProject, "function");
  assert.equal(typeof character.interpolateProject, "function");
});

test("Default schema contains a complete 2D human bone rig and layer tree", () => {
  const project = character.createDefaultProject();
  assert.equal(project.version, 1);
  assert.equal(project.character.style, "anime-human");
  assert.ok(character.JOINT_DEFINITIONS.length >= 16);
  assert.ok(character.BONE_DEFINITIONS.length >= 15);
  assert.ok(project.layers.length >= 11);
  assert.ok(["head", "torso", "leftHand", "rightHand", "leftFoot", "rightFoot"].every((id) => project.rig.joints[id]));
  assert.ok(project.rig.bones.every((bone) => project.rig.joints[bone.from] && project.rig.joints[bone.to]));
  assert.ok(project.layers.some((layer) => layer.id === "mouth"));
  assert.ok(project.layers.some((layer) => layer.id === "rig"));
});

test("Pose presets provide distinct usable poses", () => {
  const idle = character.poseJoints("idle");
  const wave = character.poseJoints("wave");
  const walk = character.poseJoints("walk");
  const talk = character.poseJoints("talk");
  const dance = character.poseJoints("dance");
  assert.deepEqual(character.POSE_PRESETS.map((pose) => pose.id), ["idle", "wave", "walk", "talk", "dance"]);
  assert.notDeepEqual(wave.rightHand, idle.rightHand);
  assert.notDeepEqual(walk.leftFoot, idle.leftFoot);
  assert.notDeepEqual(talk.leftHand, idle.leftHand);
  assert.notDeepEqual(dance.head, idle.head);
  [idle, wave, walk, talk, dance].forEach((pose) => {
    assert.equal(Object.keys(pose).length, character.JOINT_DEFINITIONS.length);
  });
});

test("Character schema supports expressions, blinking, phonemes, timeline and lip-sync", () => {
  const project = character.createDefaultProject();
  assert.deepEqual(character.EXPRESSIONS.map((item) => item.id), ["neutral", "happy", "sad", "angry", "surprised", "blink"]);
  assert.ok(character.PHONEMES.includes("M/B/P"));
  assert.equal(typeof project.character.blinking, "boolean");
  assert.ok(project.timeline.keyframes.length >= 3);
  assert.ok(project.timeline.lipSync.length >= 3);
  assert.ok(project.timeline.keyframes.every((frame) => frame.joints && frame.expression && frame.phoneme));
  assert.match(source, /data-hc-expression/);
  assert.match(source, /data-hc-add-lip/);
  assert.match(source, /Tự động chớp mắt/);
});

test("Timeline interpolation produces bounded joint values", () => {
  const project = character.createDefaultProject();
  project.timeline.keyframes = [
    { id: "a", time: 0, easing: "linear", joints: character.poseJoints("idle"), expression: "neutral", phoneme: "REST" },
    { id: "b", time: 10, easing: "linear", joints: character.poseJoints("wave"), expression: "happy", phoneme: "A" }
  ];
  project.timeline.duration = 10;
  const middle = character.interpolateProject(project, 5);
  const start = project.timeline.keyframes[0].joints.rightHand;
  const end = project.timeline.keyframes[1].joints.rightHand;
  assert.equal(middle.joints.rightHand.x, (start.x + end.x) / 2);
  assert.equal(middle.joints.rightHand.y, (start.y + end.y) / 2);
  assert.equal(character.interpolateProject(project, 0).expression, "neutral");
  assert.equal(character.interpolateProject(project, 10).expression, "happy");
});

test("Normalization sanitizes imported projects and preserves the complete rig", () => {
  const normalized = character.normalizeProject({
    meta: { name: "x".repeat(200) },
    stage: { background: "invalid" },
    character: { expression: "unknown", phoneme: "invalid", blinkRate: 999, hairColor: "red" },
    rig: { joints: { head: { x: -90, y: 9000 } }, selectedJointId: "missing" },
    timeline: { duration: 9999, fps: 11, speed: 99, keyframes: [] }
  });
  assert.equal(normalized.meta.name.length, 120);
  assert.equal(normalized.stage.background, "#11172a");
  assert.equal(normalized.character.expression, "neutral");
  assert.equal(normalized.character.phoneme, "REST");
  assert.equal(normalized.character.blinkRate, 12);
  assert.equal(normalized.character.hairColor, "#4338ca");
  assert.equal(normalized.rig.joints.head.x, 0);
  assert.equal(normalized.rig.joints.head.y, 800);
  assert.equal(normalized.rig.selectedJointId, "rightHand");
  assert.equal(normalized.timeline.duration, 300);
  assert.equal(normalized.timeline.fps, 30);
  assert.equal(normalized.timeline.speed, 1);
  assert.ok(normalized.timeline.keyframes.length >= 1);
});

test("Canvas interaction supports draggable joints and numeric joint controls", () => {
  assert.match(source, /nearestJoint\(point\)/);
  assert.match(source, /data-hc-canvas/);
  assert.match(source, /handlePointerDown/);
  assert.match(source, /handlePointerMove/);
  assert.match(source, /setPointerCapture/);
  assert.match(source, /releasePointerCapture/);
  assert.match(source, /data-hc-joint="x"/);
  assert.match(source, /data-hc-joint="y"/);
  assert.match(source, /data-hc-joint="rotation"/);
  assert.match(source, /mirrorEdit/);
});

test("Device access is truthfully gated behind explicit camera and microphone buttons", () => {
  assert.match(source, /data-hc-camera>Xin quyền camera/);
  assert.match(source, /data-hc-microphone>Xin quyền micro/);
  assert.match(source, /async function requestCameraPermission\(\)/);
  assert.match(source, /async function requestMicrophonePermission\(\)/);
  assert.match(source, /requestCameraPermission\(\)/);
  assert.match(source, /requestMicrophonePermission\(\)/);
  assert.equal((source.match(/getUserMedia\(/g) || []).length, 2);
  assert.match(source, /chưa tuyên bố theo dõi khuôn mặt hoặc nhận dạng giọng nói tự động/);
  assert.match(source, /Face tracking chưa được bật/);
  assert.match(source, /Nhận dạng âm vị tự động chưa được bật/);
  assert.match(source, /cameraStream\?\.getTracks/);
  assert.match(source, /microphoneStream\?\.getTracks/);
  assert.match(source, /if \(target\.dataset\.hcCamera !== undefined\) return requestCameraPermission\(\)/);
  assert.match(source, /if \(target\.dataset\.hcMicrophone !== undefined\) return requestMicrophonePermission\(\)/);
});

test("Local project workflow includes autosave, import/export and undo/redo without network tracking", () => {
  assert.equal(character.STORAGE_KEY, "hh.graphic-character.project.v1");
  assert.match(source, /storage\?\.setItem\(STORAGE_KEY/);
  assert.match(source, /JSON\.stringify\(payload, null, 2\)/);
  assert.match(source, /new FileReader\(\)/);
  assert.match(source, /function undo\(\)/);
  assert.match(source, /function redo\(\)/);
  assert.match(source, /data-hc-undo/);
  assert.match(source, /data-hc-redo/);
  assert.match(source, /data-hc-import-open/);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon|google-analytics|gtag\(/i);
});

test("UI is responsive, accessible and respects reduced-motion preferences", () => {
  assert.match(source, /setAttribute\("aria-label", "HH Character Studio"\)/);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(source, /aria-label="Canvas rig nhân vật anime và con người"/);
  assert.match(source, /aria-label="Timeline hoạt ảnh nhân vật"/);
  assert.match(source, /@media\(max-width:1050px\)/);
  assert.match(source, /@media\(max-width:720px\)/);
  assert.match(source, /@media\(max-width:440px\)/);
  assert.match(source, /prefers-reduced-motion:reduce/);
  assert.match(source, /matchMedia\?\./);
});
