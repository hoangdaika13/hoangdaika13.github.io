const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "graphic-design-character.js"), "utf8");
const character = require("../graphic-design-character.js");

test("Character Creator 2.0 keeps the standalone mount API and adds reusable engines", () => {
  assert.match(source, /runtime\.HHGraphicCharacter\s*=\s*api/);
  ["mount", "unmount", "createDefaultProject", "normalizeProject", "interpolateProject", "solveTwoBoneIK", "applyIK", "buildVisemeTimeline"].forEach((name) => {
    assert.equal(typeof character[name], "function", `${name} must be exported`);
  });
});

test("Version 2 schema preserves the complete human rig, layers and autosave key", () => {
  const project = character.createDefaultProject();
  assert.equal(project.version, 2);
  assert.equal(project.character.style, "anime-human");
  assert.equal(character.STORAGE_KEY, "hh.graphic-character.project.v1");
  assert.ok(character.JOINT_DEFINITIONS.length >= 16);
  assert.ok(character.BONE_DEFINITIONS.length >= 15);
  assert.ok(project.layers.length >= 11);
  assert.ok(["head", "torso", "leftHand", "rightHand", "leftFoot", "rightFoot"].every((id) => project.rig.joints[id]));
  assert.ok(project.rig.bones.every((bone) => project.rig.joints[bone.from] && project.rig.joints[bone.to]));
  assert.deepEqual(Object.keys(project.rig.constraints), ["leftArm", "rightArm", "leftLeg", "rightLeg"]);
  assert.deepEqual(project.rig.footLock, { left: false, right: false });
});

test("Appearance library covers face, eyes, hair, clothing and accessories", () => {
  assert.ok(character.CHARACTER_LIBRARY.faces.length >= 4);
  assert.ok(character.CHARACTER_LIBRARY.eyes.length >= 4);
  assert.ok(character.CHARACTER_LIBRARY.hair.length >= 6);
  assert.ok(character.CHARACTER_LIBRARY.outfits.length >= 5);
  assert.ok(character.CHARACTER_LIBRARY.accessories.length >= 5);
  const project = character.createDefaultProject();
  ["faceId", "eyeId", "hairId", "outfitId", "accessoryId"].forEach((key) => assert.equal(typeof project.character[key], "string"));
  assert.match(source, /data-hc-character="faceId"/);
  assert.match(source, /data-hc-character="accessoryId"/);
});

test("Archetypes and body proportions produce visibly distinct display rigs", () => {
  assert.deepEqual(character.ARCHETYPES.map((item) => item.id), ["male", "female", "anime", "chibi", "semi-realistic"]);
  const base = character.createDefaultProject();
  const anime = character.characterDisplayJoints(base, base.rig.joints);
  const chibiProject = character.normalizeProject({ ...base, character: { ...base.character, archetype: "chibi", proportions: character.ARCHETYPES.find((item) => item.id === "chibi").proportions } });
  const chibi = character.characterDisplayJoints(chibiProject, chibiProject.rig.joints);
  assert.notEqual(chibi.head.y, anime.head.y);
  assert.notEqual(chibi.leftFoot.y, anime.leftFoot.y);
  assert.match(source, /data-hc-proportion=/);
  assert.match(source, /\[\["height","Chiều cao"\],\["headScale","Tỉ lệ đầu"\]/);
});

test("Front, side and back views are available and side projection changes the rig", () => {
  assert.deepEqual(character.CHARACTER_VIEWS.map((item) => item.id), ["front", "left", "right", "back"]);
  const frontProject = character.createDefaultProject();
  const sideProject = character.normalizeProject({ ...frontProject, character: { ...frontProject.character, view: "left" } });
  const front = character.characterDisplayJoints(frontProject, frontProject.rig.joints);
  const side = character.characterDisplayJoints(sideProject, sideProject.rig.joints);
  assert.ok(Math.abs(side.leftHand.x - side.rightHand.x) < Math.abs(front.leftHand.x - front.rightHand.x));
  assert.match(source, /data-hc-view/);
  assert.match(source, /character\.view !== "back"/);
});

test("Pose and motion libraries include all requested character actions", () => {
  const requested = ["walk", "run", "jump", "sit", "talk", "fight"];
  requested.forEach((id) => assert.ok(character.POSE_PRESETS.some((pose) => pose.id === id)));
  assert.deepEqual(character.MOTION_LIBRARY.map((motion) => motion.id), requested);
  requested.forEach((id) => {
    const frames = character.createMotionFrames(id);
    assert.equal(frames.length, 3);
    assert.equal(Object.keys(frames[0].joints).length, character.JOINT_DEFINITIONS.length);
    assert.ok(frames[2].time > frames[0].time);
  });
  assert.match(source, /data-hc-motion/);
  assert.match(source, /applyMotionSequence/);
});

test("Two-bone IK reaches a bounded target while preserving finite joints", () => {
  const joints = character.poseJoints("idle");
  const root = { ...joints.rightShoulder };
  const originalLength = Math.hypot(joints.rightElbow.x - root.x, joints.rightElbow.y - root.y)
    + Math.hypot(joints.rightHand.x - joints.rightElbow.x, joints.rightHand.y - joints.rightElbow.y);
  const solved = character.applyIK(joints, "rightHand", { x: 620, y: 250 }, {
    rightArm: { minBend: 8, maxBend: 165, maxStretch: 1, bendDirection: -1 }
  });
  const solvedLength = Math.hypot(solved.rightElbow.x - root.x, solved.rightElbow.y - root.y)
    + Math.hypot(solved.rightHand.x - solved.rightElbow.x, solved.rightHand.y - solved.rightElbow.y);
  assert.ok(Math.abs(solvedLength - originalLength) < 8);
  assert.ok(Number.isFinite(solved.rightElbow.x) && Number.isFinite(solved.rightElbow.y));
  assert.notDeepEqual(solved.rightHand, joints.rightHand);
  assert.match(source, /data-hc-foot-lock="left"/);
  assert.match(source, /project\.rig\.footLock\.left/);
});

test("Amplitude analysis creates deterministic viseme markers without speech-recognition claims", () => {
  assert.equal(character.amplitudeToPhoneme(0), "REST");
  assert.equal(character.amplitudeToPhoneme(.04, 0), "M/B/P");
  const sampleRate = 1000;
  const samples = new Float32Array(sampleRate);
  for (let index = 250; index < 750; index += 1) samples[index] = .25 * Math.sin(index);
  const markers = character.buildVisemeTimeline(samples, sampleRate, 1, .1);
  assert.ok(markers.some((marker) => marker.phoneme !== "REST"));
  assert.ok(markers.every((marker) => marker.time >= 0 && marker.time <= 1));
  assert.match(source, /decodeAudioData/);
  assert.match(source, /getChannelData\(0\)/);
  assert.match(source, /WebAudio chỉ phân tích biên độ/);
  assert.doesNotMatch(source, /SpeechRecognition|webkitSpeechRecognition/);
});

test("Normalization migrates old projects and sanitizes every new field", () => {
  const normalized = character.normalizeProject({
    meta: { name: "x".repeat(200) },
    stage: { background: "invalid" },
    character: {
      archetype: "unknown", view: "diagonal", faceId: "bad", hairId: "bad",
      expression: "unknown", phoneme: "invalid", blinkRate: 999, hairColor: "red",
      proportions: { height: 8, headScale: 0, shoulderWidth: 9, armLength: -2, legLength: 9 }
    },
    rig: { joints: { head: { x: -90, y: 9000 } }, selectedJointId: "missing", constraints: { leftArm: { maxBend: 999 } } },
    timeline: { duration: 9999, fps: 11, speed: 99, keyframes: [] }
  });
  assert.equal(normalized.meta.name.length, 120);
  assert.equal(normalized.stage.background, "#11172a");
  assert.equal(normalized.character.archetype, "anime");
  assert.equal(normalized.character.view, "front");
  assert.equal(normalized.character.faceId, "oval");
  assert.equal(normalized.character.proportions.height, 1.35);
  assert.equal(normalized.character.proportions.headScale, .7);
  assert.equal(normalized.rig.joints.head.x, 0);
  assert.equal(normalized.rig.joints.head.y, 800);
  assert.equal(normalized.rig.constraints.leftArm.maxBend, 180);
  assert.equal(normalized.timeline.duration, 300);
  assert.ok(normalized.timeline.keyframes.length >= 1);
});

test("Canvas remains editable with pointer IK, numeric controls and keyboard nudging", () => {
  assert.match(source, /nearestJoint\(point\)/);
  assert.match(source, /data-hc-canvas/);
  assert.match(source, /setPointerCapture/);
  assert.match(source, /releasePointerCapture/);
  assert.match(source, /applyIK\(project\.rig\.joints/);
  assert.match(source, /data-hc-joint="x"/);
  assert.match(source, /data-hc-joint="rotation"/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /phím 1–4 đổi góc nhìn/);
});

test("Webcam is optional, explicitly consented and never presented as face tracking", () => {
  assert.match(source, /data-hc-webcam-consent/);
  assert.match(source, /if \(!webcamConsent\) throw new Error/);
  assert.match(source, /data-hc-camera>Xin quyền camera/);
  assert.match(source, /data-hc-microphone>Xin quyền micro/);
  assert.match(source, /async function requestCameraPermission\(\)/);
  assert.match(source, /async function requestMicrophonePermission\(\)/);
  assert.equal((source.match(/getUserMedia\(/g) || []).length, 2);
  assert.match(source, /Không có face tracking hoặc AI nhận dạng/);
  assert.match(source, /cameraStream\?\.getTracks/);
  assert.match(source, /microphoneStream\?\.getTracks/);
});

test("Project rig, sprite sheet, PNG sequence and truthful WebM branches are implemented", () => {
  assert.match(source, /format: "hh-character-rig"/);
  assert.match(source, /data-hc-sprite/);
  assert.match(source, /function exportSpriteSheet\(\)/);
  assert.match(source, /function exportPngSequence\(\)/);
  assert.match(source, /canvasBlob\(renderExportFrame/);
  assert.match(source, /function exportTransparentWebM\(\)/);
  assert.match(source, /MediaRecorder/);
  assert.match(source, /canvas\.captureStream/);
  assert.match(source, /khả năng giữ trong suốt còn phụ thuộc codec và trình duyệt/);
  assert.equal(character.transparentWebMSupport({}).supported, false);
});

test("Local workflow retains autosave, JSON migration and undo redo without network tracking", () => {
  assert.match(source, /storage\?\.setItem\(STORAGE_KEY/);
  assert.match(source, /JSON\.stringify\(payload, null, 2\)/);
  assert.match(source, /parsed\?\.format === "hh-character-rig"/);
  assert.match(source, /function undo\(\)/);
  assert.match(source, /function redo\(\)/);
  assert.match(source, /data-hc-undo/);
  assert.match(source, /data-hc-redo/);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon|google-analytics|gtag\(/i);
});

test("UI is Vietnamese, responsive, accessible and reduced-motion safe", () => {
  assert.match(source, /HH Character Creator 2\.0/);
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
