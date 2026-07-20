const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "graphic-design-character-pro.js"), "utf8");
const character = require("../graphic-design-character-pro.js");

test("Character Creator 3.0 exposes a standalone UMD and global mount API", () => {
  assert.match(source, /runtime\.HHGraphicCharacterPro\s*=\s*api/);
  assert.equal(globalThis.HHGraphicCharacterPro, character);
  [
    "mount", "unmount", "mountAll", "createDefaultProject", "normalizeProject",
    "deformMesh", "stepDynamics", "applyPose", "createMotionMixer",
    "textToVisemes", "audioTimingToVisemes", "requestCameraTracking",
    "buildSpriteManifest", "serializeProject"
  ].forEach((name) => assert.equal(typeof character[name], "function", `${name} must be exported`));
});

test("versioned local-first project contains mesh, facial rig, dynamics and privacy-safe camera state", () => {
  const project = character.createDefaultProject();
  assert.equal(project.format, "hh-character-pro");
  assert.equal(project.version, 3);
  assert.equal(character.STORAGE_KEY, "hh.graphic-character-pro.project.v3");
  assert.ok(project.mesh.vertices.length >= 24);
  assert.ok(project.mesh.triangles.length >= 18);
  assert.ok(Object.keys(project.mesh.blendShapes).length >= 8);
  assert.ok(project.dynamics.chains.some((chain) => chain.kind === "hair"));
  assert.ok(project.dynamics.chains.some((chain) => chain.kind === "clothing"));
  assert.equal(project.camera.enabled, false);
  assert.equal(project.camera.consentStored, false);

  const normalized = character.normalizeProject({
    meta: { name: "<img onerror=alert(1)>" },
    puppet: { view: "invalid", skinColor: "red" },
    camera: { enabled: true, consentStored: true, status: "ready" }
  });
  assert.equal(normalized.meta.name, "<img onerror=alert(1)>");
  assert.equal(normalized.puppet.view, "front");
  assert.equal(normalized.puppet.skinColor, "#f3bd9f");
  assert.deepEqual(normalized.camera, {
    enabled: false,
    status: "idle",
    mode: "luminance-centroid-guidance",
    consentStored: false,
    limitation: "Camera guidance cục bộ, không phải motion capture hay nhận diện khuôn mặt."
  });
  assert.match(source, /escapeHtml\(project\.meta\.name\)/);
});

test("mesh deformation normalizes skin weights and combines bones with facial blend shapes", () => {
  const project = character.createDefaultProject();
  const mouthBefore = project.mesh.vertices.find((vertex) => vertex.id === "mouthL");
  const deformed = character.deformMesh(project.mesh, { head: { x: 10, y: 4 } }, { smile: 1 });
  const mouthAfter = deformed.vertices.find((vertex) => vertex.id === "mouthL");
  assert.equal(mouthAfter.x, mouthBefore.x + 5);
  assert.equal(mouthAfter.y, mouthBefore.y - 1);
  assert.equal(mouthAfter.sourceX, mouthBefore.x - 5);

  const normalized = character.normalizeMesh({
    id: "custom",
    vertices: [
      { id: "a", x: 0, y: 0, weights: { head: 3, missing: 7 } },
      { id: "b", x: 1, y: 0, weights: { root: 1 } },
      { id: "c", x: 0, y: 1, weights: {} }
    ],
    triangles: [[0, 1, 2], [0, 2, 99]],
    blendShapes: {}
  });
  assert.deepEqual(normalized.vertices[0].weights, { head: 1 });
  assert.deepEqual(normalized.vertices[2].weights, { root: 1 });
  assert.deepEqual(normalized.triangles, [[0, 1, 2]]);
});

test("facial controls are bounded and visemes drive compatible blend shapes", () => {
  const face = character.evaluateFacialRig({ smile: 9, jawOpen: -2 }, "O");
  assert.equal(face.smile, 1);
  assert.equal(face.jawOpen, 0.55);
  assert.equal(face.pucker, 0.7);
  assert.equal(Object.keys(face).length, character.FACIAL_CONTROLS.length);
});

test("hair and clothing dynamics use finite constrained spring chains", () => {
  const initial = character.createDefaultDynamics();
  const stepped = character.stepDynamics(initial, {
    head: { x: 310, y: 140 },
    spine: { x: 300, y: 355 }
  }, 1 / 60);
  const hair = stepped.chains.find((chain) => chain.id === "hair-left");
  assert.equal(hair.points[0].x, 275);
  assert.equal(hair.points[0].y, 87);
  hair.points.forEach((point) => {
    assert.ok(Number.isFinite(point.x));
    assert.ok(Number.isFinite(point.y));
  });
  for (let index = 1; index < hair.points.length; index += 1) {
    const distance = Math.hypot(hair.points[index].x - hair.points[index - 1].x, hair.points[index].y - hair.points[index - 1].y);
    assert.ok(Math.abs(distance - hair.points[index].restLength) < 2);
  }
  assert.equal(character.stepDynamics({ ...initial, enabled: false }, {}, 1 / 60).enabled, false);
});

test("pose library and puppet projections cover reusable poses and six views", () => {
  ["neutral", "wave", "walk", "run", "jump", "sit", "talk", "fight"].forEach((id) => {
    assert.ok(character.POSE_LIBRARY.some((pose) => pose.id === id));
  });
  assert.equal(character.PUPPET_VIEWS.length, 6);
  const neutral = character.createSkeleton();
  const wave = character.applyPose(neutral, "wave", 1);
  assert.equal(wave.upperArmR.rotation, -48);
  assert.equal(wave.lowerArmR.rotation, -78);
  const points = [{ id: "left", x: 200, y: 200 }, { id: "right", x: 400, y: 200 }];
  const front = character.projectPuppetView(points, "front");
  const profile = character.projectPuppetView(points, "profile-left");
  const back = character.projectPuppetView(points, "back");
  assert.ok(Math.abs(profile[1].x - profile[0].x) < Math.abs(front[1].x - front[0].x));
  assert.equal(back[0].x, front[1].x);
});

test("motion interpolation and mixer blend clips deterministically", () => {
  assert.equal(character.interpolateKeyframes([
    { time: 0, value: 0, easing: "linear" },
    { time: 2, value: 10, easing: "linear" }
  ], 1), 5);
  assert.deepEqual(character.interpolateKeyframes([
    { time: 0, value: { x: 0, y: 4 } },
    { time: 1, value: { x: 10, y: 8 }, easing: "linear" }
  ], 0.5), { x: 5, y: 6 });

  const clip = {
    id: "head-move", label: "Head", duration: 1, loop: false,
    tracks: [{ target: "bones.head.x", keyframes: [{ time: 0, value: 0 }, { time: 1, value: 20, easing: "linear" }] }]
  };
  const mixed = character.mixMotionClips([{ clip, weight: 0.5 }], 1, { bones: character.createSkeleton(), facial: {} });
  assert.equal(mixed.bones.head.x, 10);
  const mixer = character.createMotionMixer([clip]);
  const layer = mixer.addLayer("head-move", { weight: 0.25 });
  assert.ok(layer.id);
  assert.equal(mixer.sample(1).bones.head.x, 5);
});

test("Vietnamese and English text rules plus supplied audio timings produce explicit viseme sources", () => {
  const vietnamese = character.textToVisemes("Xin chào Việt Nam!", "vi", { wordsPerMinute: 120 });
  assert.ok(vietnamese.some((marker) => marker.viseme === "CH"));
  assert.ok(vietnamese.some((marker) => marker.viseme === "MBP"));
  assert.ok(vietnamese.every((marker) => marker.source === "text-rule" && marker.language === "vi"));
  assert.ok(vietnamese.every((marker, index) => index === 0 || marker.time >= vietnamese[index - 1].time));

  const english = character.textToVisemes("Very thoughtful people", "en");
  assert.ok(english.some((marker) => marker.viseme === "FV"));
  assert.ok(english.some((marker) => marker.viseme === "TH"));
  assert.ok(english.some((marker) => marker.viseme === "MBP"));

  const timed = character.audioTimingToVisemes([
    { word: "hello", start: 1, end: 1.5 },
    { viseme: "O", start: 2, end: 2.2 }
  ], "en");
  assert.equal(timed[0].time, 1);
  assert.equal(timed.at(-1).viseme, "O");
  assert.ok(timed.every((marker) => marker.source === "provided-audio-timing"));
  assert.equal(character.sampleViseme(timed, 2.1), "O");
});

test("camera guidance never requests hardware before explicit consent and stops every track", async () => {
  let requested = 0;
  let stopped = 0;
  const scope = {
    navigator: {
      mediaDevices: {
        async getUserMedia(constraints) {
          requested += 1;
          assert.equal(constraints.audio, false);
          return { getTracks: () => [{ stop() { stopped += 1; } }, { stop() { stopped += 1; } }] };
        }
      }
    }
  };
  await assert.rejects(character.requestCameraTracking({ consent: false, runtime: scope }), (error) => error.code === "CONSENT_REQUIRED");
  assert.equal(requested, 0);
  const session = await character.requestCameraTracking({ consent: true, runtime: scope });
  assert.equal(requested, 1);
  assert.equal(session.mode, "luminance-centroid-guidance");
  assert.match(session.limitation, /không phải motion capture/i);
  session.stop();
  session.stop();
  assert.equal(stopped, 2);
});

test("camera frame estimator reports unsupported/low-confidence states honestly", () => {
  assert.equal(character.detectCapabilities({}).camera.supported, false);
  const blank = new Uint8ClampedArray(4 * 4 * 4).fill(40);
  for (let index = 3; index < blank.length; index += 4) blank[index] = 255;
  assert.equal(character.estimateCameraGuidance(blank, 4, 4).confidence, 0);
  const image = new Uint8ClampedArray(8 * 8 * 4);
  for (let index = 3; index < image.length; index += 4) image[index] = 255;
  for (let y = 1; y < 5; y += 1) for (let x = 5; x < 8; x += 1) {
    const offset = (y * 8 + x) * 4;
    image[offset] = 255; image[offset + 1] = 255; image[offset + 2] = 255;
  }
  const guidance = character.estimateCameraGuidance(image, 8, 8);
  assert.ok(guidance.confidence > 0);
  assert.ok(guidance.x > 0);
  assert.equal(guidance.mode, "luminance-centroid-guidance");
});

test("project and sprite exports are bounded, round-trippable and local-only", () => {
  const project = character.createDefaultProject();
  project.meta.name = "A <B> & C";
  const json = character.serializeProject(project);
  const restored = character.parseProject(json);
  assert.equal(restored.meta.name, project.meta.name);
  assert.equal(restored.camera.enabled, false);
  const manifest = character.buildSpriteManifest(project, { fps: 10, duration: 1, views: ["front", "back"], columns: 4, cellWidth: 128, cellHeight: 160 });
  assert.equal(manifest.frames.length, 20);
  assert.equal(manifest.columns, 4);
  assert.equal(manifest.rows, 5);
  assert.equal(manifest.width, 512);
  assert.equal(manifest.height, 800);
  assert.equal(character.renderSpriteSheet(project, { runtime: {} }).supported, false);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\//i);
});

test("mounted UI contract includes semantic controls, focus, 375px response and reduced motion", () => {
  assert.match(source, /setAttribute\("role", "application"\)/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /tabindex="0" data-hhcp-canvas/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /event\.code === "Space"/);
  assert.match(source, /:focus-visible/);
  assert.match(source, /@media\(max-width:440px\)/);
  assert.match(source, /prefers-reduced-motion:reduce/);
  assert.match(source, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(source, /data-hhcp-camera-consent/);
  assert.match(source, /Không phải motion capture/);
  assert.doesNotMatch(source, /SpeechRecognition|webkitSpeechRecognition|MediaPipe|TensorFlow/i);
});
