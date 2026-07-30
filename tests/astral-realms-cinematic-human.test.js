const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "astral-realms.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "sw.js"), "utf8");

test("saved journeys validate the real character for two rendered frames", () => {
  for (const token of [
    "resetGameplayCharacterVisibility(\"initial-scene\")",
    "validateGameplayCharacterFrame(time)",
    "getGameplayCharacterReport(object = this.playerMesh)",
    "visibility.consecutiveFrames >= 2",
    "projectedHeight",
    "feetGroundError",
    "wristDeviation"
  ]) assert.ok(source.includes(token), `missing gameplay character QA token ${token}`);
  assert.match(source, /this\.root\.dataset\.characterPreview = visibility\.validated \? "3d" : "validating"/);
  assert.match(source, /triangles > 0[\s\S]*renderedTriangles > 0[\s\S]*visibleMaterials > 0[\s\S]*inFrustum/);
  assert.match(source, /this\.pendingStartReveal = !needsGenesis/);
  assert.match(source, /this\.startRevealFrames >= 4 \|\| \(this\.startRevealFrames >= 2 && revealElapsed >= 4200\)/);
  assert.match(source, /this\.setLoading\(100, "Cảnh 3D đã sẵn sàng\."\)/);
});

test("grounding and camera no longer lift VALID humans or frame gameplay top-down", () => {
  assert.match(source, /gameplayVisualLift: 0/);
  assert.match(source, /const restPoseGroundedBounds = new THREE\.Box3\(\)\.setFromObject\(asset, true\)/);
  assert.match(source, /gameplayGroundOffset: measuredGroundOffset/);
  assert.match(source, /runtime\.expectedFootHeight = 0\.09/);
  assert.match(source, /mesh\.userData\.groundingSource = "rest-foot-bones"/);
  assert.match(source, /this\.playerMesh\.userData\.gameplayGroundOffset = currentOffset \+ clamp\(-error, -0\.85, 0\.85\)/);
  assert.match(source, /visibility\.groundingCalibrated = true/);
  assert.doesNotMatch(source, /provider === "valid-avatar" \? 1\.35 : 0/);
  assert.match(source, /this\.cameraPitch = 0\.14/);
  assert.match(source, /originY \+ 1\.68 \+ Math\.sin\(this\.cameraPitch\)/);
  assert.match(source, /originY \+ 1\.52/);
  assert.match(source, /0\.08, 0\.62/);
});

test("opening is a six-shot 32-second realtime sequence using the created actor", () => {
  assert.match(source, /duration: 32000, camera: "opening-six-shot", motion: "opening"/);
  assert.match(source, /case "opening-six-shot"/);
  for (const boundary of ["0.16", "0.34", "0.5", "0.7", "0.86"]) {
    assert.ok(source.includes(`progress < ${boundary}`), `missing opening shot boundary ${boundary}`);
  }
  assert.match(source, /sequence\.shot = shotNumber/);
  assert.match(source, /this\.playerMesh\.position\.set/);
  assert.doesNotMatch(source, /<video[^>]+cinematic/i);
});

test("near-camera low-poly slabs and black rock field are bounded", () => {
  assert.match(source, /\["central", 0, 0, 16, 0xb4b7b4\]/);
  assert.match(source, /new THREE\.IcosahedronGeometry\(0\.72, 2\)/);
  assert.match(source, /const minimumRadius = zoneId === "central" \? 16 : 9/);
  assert.match(source, /const flatAsset = \["kenneyPath", "kenneyRoad", "kenneyBridge"\]\.includes\(assetId\)/);
  assert.match(source, /const sourceMeasure = flatAsset \? Math\.max\(size\.x, size\.z\) : size\.y/);
  assert.match(source, /const tallFoliage = \["deadTree", "kenneyOak", "kenneyPalm"\]\.includes\(assetId\)/);
  assert.match(source, /\? Math\.max\(22, zone\.radius \* 0\.68\)/);
  assert.match(source, /object\.userData\.cameraSafeRadius = minimumRadius/);
  assert.match(source, /new THREE\.CylinderGeometry\(zone\.radius, zone\.radius \+ 0\.38, 0\.18, 96, 1\)/);
  assert.match(source, /const scale = profile\.boss \? 1\.35/);
  assert.match(source, /new THREE\.CapsuleGeometry\(0\.62 \* scale, 1\.08 \* scale, 10, 20\)/);
  assert.match(source, /emissiveIntensity: profile\.boss \? 0\.1 : 0\.08/);
  assert.match(source, /profile\.actor === "wisps"[\s\S]*new THREE\.SphereGeometry\(0\.38, 24, 16\)/);
  assert.doesNotMatch(source, /profile\.actor === "wisps"[\s\S]{0,180}new THREE\.ConeGeometry/);
  assert.match(source, /profile\.actor === "wisps" \? 14 \+ index \* 4\.8/);
  assert.match(source, /terrainSurfaceTextures = \{ albedo, height, roughness \}/);
  assert.match(source, /makeTexture\(heightCanvas, THREE\.NoColorSpace\)/);
  assert.match(source, /roughnessMap: this\.terrainSurfaceTextures\.roughness/);
  assert.match(source, /waterMaterial\.ior = 1\.333/);
  assert.match(source, /waterMaterial\.transmission = quality === "cinematic" \? 0\.2 : 0\.11/);
  assert.match(source, /water\.material\.bumpMap\.offset\.x = \(time \* 0\.000012\) % 1/);
  assert.doesNotMatch(source, /color: 0x3fdacb/);
});

test("cinematic fallback keeps the human silhouette unobstructed", () => {
  assert.match(source, /coat\.visible = !realistic/);
  assert.match(source, /cape\.visible = !realistic/);
  assert.match(source, /halo\.visible = !realistic/);
  assert.doesNotMatch(source, /new THREE\.Clock\(\)/);
});

test("character sources retain immutable license provenance and are cached", () => {
  const manifestPath = path.join(root, "assets", "astral-realms", "characters", "SOURCES.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.sources.length, 6);
  for (const entry of manifest.sources) {
    assert.match(entry.sourceUrl, /^https:\/\//);
    assert.ok(entry.author);
    assert.ok(entry.license);
    assert.ok(entry.attribution);
    assert.match(entry.sha256, /^[A-F0-9]{64}$/);
    const file = path.resolve(path.dirname(manifestPath), entry.file);
    const hash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
    assert.equal(hash, entry.sha256, `${entry.file} checksum changed`);
  }
  assert.match(worker, /characters\/SOURCES\.json/);
});

test("idle posture keeps shoulders and wrists close to authored rest", () => {
  assert.match(source, /runtime\.relaxedArmOffsets/);
  assert.match(source, /postureBlend/);
  assert.match(source, /const wristLimit = quarantined \? 0\.16 : combat \? 0\.72 : 0\.2/);
  assert.match(source, /const fingerLimit = quarantined \? 0\.14 : combat \? 0\.62 : 0\.28/);
  assert.match(source, /runtime\.wristDeviation/);
  assert.match(source, /uprightDot >= 0\.42/);
  assert.match(source, /quarantineUnsafeCharacterMotion\(activeRuntime, `gameplay-pose-/);
  assert.match(source, /poseGraceElapsed >= 900 && visibility\.unsafePoseFrames >= 6/);
  assert.match(source, /runtime\.uprightRecovery = "hips-head-to-world-y"/);
  assert.match(source, /this\.captureNaturalRigPose\(runtime\)/);
  assert.match(source, /allBones: \[\]/);
  assert.match(source, /runtime\.allBones\.push\(object\)/);
  assert.match(source, /\.\.\.\(runtime\.allBones \|\| \[\]\)\.filter\(Boolean\)/);
  assert.match(source, /motionProfile: offlineBakedAnimations\.length/);
  assert.match(source, /this\.motionLibraryManifest\?\.status === "ready"/);
  assert.match(source, /applyVerifiedRestPoseMotion\(runtime, time, motion = "idle"\)/);
  assert.match(source, /valid-world-direction-solver/);
  assert.match(source, /relaxedIdleArms/);
});
