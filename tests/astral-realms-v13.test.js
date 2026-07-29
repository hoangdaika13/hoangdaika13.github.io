const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("astral-realms.js");
const motionManifest = JSON.parse(read("assets/astral-realms/animations/motion-library-v13.json"));

function readGlbJson(relative) {
  const bytes = fs.readFileSync(path.join(root, relative));
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "glTF");
  const jsonLength = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, "GLB JSON chunk is missing");
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8").replace(/\0+$/g, "").trimEnd());
}

test("V13 ships a truthful Meshopt animation-only library baked onto the VALID rig", () => {
  const relative = "assets/astral-realms/animations/hh-human-motion-v13.glb";
  const bytes = fs.readFileSync(path.join(root, relative));
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "glTF");
  assert.ok(bytes.length > 1_000_000, "the baked library must contain real animation data");
  assert.equal(motionManifest.version, 13);
  assert.equal(motionManifest.rig, "HH_VALID_HUMANOID_V1");
  assert.equal(motionManifest.status, "partial");
  assert.equal(motionManifest.asset, "hh-human-motion-v13.glb");
  assert.equal(motionManifest.optimized, "resample+meshopt");
  assert.ok(motionManifest.clips.length >= 24);
  assert.ok(motionManifest.missing.length > 0, "unavailable clips must remain explicitly missing");
  assert.equal(new Set(motionManifest.clips.map((clip) => clip.name)).size, motionManifest.clips.length);
  for (const clip of motionManifest.clips) {
    assert.ok(clip.name && clip.source && clip.sourceAsset);
    assert.ok(clip.frames > 1 && clip.duration > 0 && clip.mappedBones >= 49);
    assert.equal(typeof clip.loop, "boolean");
  }
  for (const name of [
    "idle_relaxed", "idle_alert", "idle_talk", "walk_f", "run_f", "sprint_f",
    "jump_start", "jump_loop", "land_soft", "crouch_idle", "crouch_walk", "swim",
    "dodge_f", "attack_1", "attack_2", "attack_3", "skill", "hit_f", "knockdown_f",
    "sit_down", "sit_idle", "stand_up", "pickup", "open_door"
  ]) assert.ok(motionManifest.clips.some((clip) => clip.name === name), `missing baked clip ${name}`);
});

test("V13 motion provenance and release manifest match the generated binaries", () => {
  assert.ok(motionManifest.provenance.some((item) => item.license === "CC0-1.0"));
  const assetManifest = JSON.parse(read("assets/astral-realms/manifest.json"));
  const worker = read("sw.js");
  for (const file of ["animations/hh-human-motion-v13.glb", "animations/motion-library-v13.json"]) {
    const record = assetManifest.assets.find((item) => item.file === file);
    assert.ok(record, `asset manifest missing ${file}`);
    const digest = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "assets/astral-realms", file))).digest("hex").toUpperCase();
    assert.equal(record.sha256, digest, `${file} hash drifted`);
    assert.ok(worker.includes(`./assets/astral-realms/${file}`), `offline cache missing ${file}`);
  }
  assert.match(read("tools/astral-animation-pipeline/THIRD_PARTY_NOTICES.md"), /CC0 1\.0/);
});

test("V13 GLB contains rotation-only in-place channels safe for the VALID rig", () => {
  const gltf = readGlbJson("assets/astral-realms/animations/hh-human-motion-v13.glb");
  const declared = new Set(motionManifest.clips.map((clip) => clip.name));
  assert.equal(gltf.animations.length, declared.size);
  let rotationChannels = 0;
  let translationChannels = 0;
  for (const animation of gltf.animations) {
    assert.ok(declared.has(animation.name), `GLB contains undeclared animation ${animation.name}`);
    for (const channel of animation.channels) {
      const targetPath = channel.target.path;
      const nodeName = gltf.nodes[channel.target.node]?.name;
      assert.notEqual(targetPath, "scale", `${animation.name} must never overwrite rig rest scale`);
      assert.notEqual(targetPath, "weights", `${animation.name} must not animate character morph weights`);
      if (targetPath === "translation") {
        assert.equal(nodeName, "Hips", `${animation.name} translates non-Hips node ${nodeName}`);
        translationChannels += 1;
      } else {
        assert.equal(targetPath, "rotation", `${animation.name} contains unsupported ${targetPath} channel`);
        rotationChannels += 1;
      }
    }
  }
  assert.equal(translationChannels, 0, "in-place VALID clips must not key unsafe Hips translation");
  assert.ok(rotationChannels >= 1_200, "the library must retain full-body rotation data");
});

test("the Blender baker performs semantic retarget and in-place bake only offline", () => {
  const baker = read("tools/astral-animation-pipeline/bake_motion_library.py");
  const build = read("tools/astral-animation-pipeline/build-motion-library.ps1");
  const installer = read("tools/astral-animation-pipeline/install-free-motion-pack.ps1");
  for (const token of ["canonical_bone", "bake_action", "rig_basis_rotation", "rig_alignment", '\"export_animation_mode\": \"ACTIONS\"', "mappedBones", "sourceAsset"]) {
    assert.ok(baker.includes(token), `baker missing ${token}`);
  }
  assert.doesNotMatch(baker, /https?:\/\/|requests\.|urlopen|Invoke-WebRequest/);
  assert.match(build, /gltf-transform\.cmd resample/);
  assert.match(build, /gltf-transform\.cmd meshopt/);
  assert.match(installer, /expectedSha256/);
  assert.match(installer, /CC0-1\.0/);
});

test("runtime blends locomotion by speed and direction with synchronized foot phase", () => {
  for (const token of [
    "loadMotionLibrary", "offline-baked-v13", "updateLocomotionBlendSpace",
    "phase-synchronized-rbf", "blendSpaceActive", "idlePhase", "setEffectiveWeight",
    "setEffectiveTimeScale", "footMarkersForMotion", "leftFootDown", "rightFootDown"
  ]) assert.ok(source.includes(token), `motion runtime missing ${token}`);
  assert.doesNotMatch(source, /retargetCharacterClip|buildRetargetedCharacterAnimations/);
});

test("V13 layers inertia, raycast foot locking and visual-only contact warping safely", () => {
  for (const token of [
    "applyAdditiveAnimationLayers", "accelerationLean", "turnLean",
    "raycastFootGround", "solveTwoBoneFootPlant", "raycast+phase-lock+ccd",
    "beginMotionWarp", "applyMotionWarping", "contactPhase",
    "unchanged-server-authoritative"
  ]) assert.ok(source.includes(token), `natural motion runtime missing ${token}`);
  assert.match(source, /const contactDelay = kind === "ultimate"/);
  assert.match(source, /this\.cameraShake = Math\.max\(this\.cameraShake, kind === "ultimate"/);
});

test("Genesis validates against normalized authored body bounds, not animated helpers", () => {
  for (const token of [
    "getGenesisBoundsBox", "genesisAuthoredBounds", "normalizedFitted",
    "wrapper.userData.genesisAuthoredBounds = genesisAuthoredBounds"
  ]) assert.ok(source.includes(token), `Genesis stable bounds missing ${token}`);
  assert.match(source, /const box = this\.getGenesisBoundsBox\(object\)/);
});

test("a texture fallback keeps the authored human silhouette visible", () => {
  assert.match(source, /const assetHasTextureFallback = Number\(source\.userData\?\.hhTextureFallbacks/);
  assert.match(source, /const assetNeedsVisualRecovery = Number\(source\.userData\?\.hhRenderableMeshes/);
  assert.doesNotMatch(source, /const assetNeedsVisualRecovery = Number\(source\.userData\?\.hhTextureFallbacks/);
  assert.match(source, /builtin-rigged-texture-recovery/);
});

test("unsafe animated bounds quarantine the mixer and restore the authored rig", () => {
  for (const token of [
    "deformationRatio", "quarantineUnsafeCharacterMotion", "motion-quarantined",
    "rest-space-procedural-safety", "runtime.rigRest?.forEach"
  ]) assert.ok(source.includes(token), `motion quarantine missing ${token}`);
  assert.match(source, /report\.deformationRatio > 2\.2/);
  assert.match(source, /bone\.quaternion\.copy\(rest\.quaternion\)/);
});

test("V13 facial driver keeps blink, gaze and wrinkle tension during coarticulated speech", () => {
  for (const token of [
    "coarticulationRaw", "mixChannels", "eyeBlinkLeft: blinkLeft",
    "cheekSquintLeft", "wrinkleTension", "baseNormalScale", "saccadeTargetX"
  ]) assert.ok(source.includes(token), `facial performance missing ${token}`);
  assert.match(source, /52 driven/);
  assert.match(source, /native morph/);
});
