const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "astral-realms.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "assets", "astral-realms", "characters", "manifest.json"), "utf8"));
const provenance = JSON.parse(fs.readFileSync(path.join(root, "assets", "astral-realms", "characters", "SOURCES.json"), "utf8"));

test("all four protagonists default to distinct downloaded local hero GLBs", () => {
  for (const model of [
    "valid-asian-f-1-casual",
    "valid-white-f-2-casual",
    "valid-black-f-1-casual",
    "valid-hispanic-f-1-milit"
  ]) assert.ok(source.includes(model), `missing main-character model ${model}`);
  assert.match(source, /lyra: "sketchfab-alina-ip"/);
  assert.match(source, /cael: "sketchfab-animated-female-fighter"/);
  assert.match(source, /nyx: "sketchfab-game-character-girl"/);
  assert.match(source, /sol: "sketchfab-miss-galaxy"/);
  assert.match(source, /const APPEARANCE_VERSION = 12/);
  assert.equal(source.includes("Nữ kiếm sĩ trưởng thành"), true);
  assert.equal(source.includes("Nữ xạ thủ Băng tinh"), true);
  assert.equal(source.includes("Nữ võ sĩ Hư không"), true);
  assert.equal(source.includes("Nữ hộ vệ Nhật quang"), true);
});

test("new local character binaries are provenance-locked and cached offline", () => {
  for (const name of ["valid-white-f-2-casual.glb", "valid-hispanic-f-1-milit.glb", "valid-aian-f-1-casual.glb", "valid-mena-f-1-casual.glb"]) {
    const relative = `default/${name}`;
    const record = provenance.sources.find((entry) => entry.file === relative);
    assert.ok(record, `missing provenance for ${name}`);
    assert.equal(record.license, "MIT");
    const bytes = fs.readFileSync(path.join(root, "assets", "astral-realms", "characters", relative));
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "glTF");
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(), record.sha256);
    assert.ok(worker.includes(name), `${name} must work offline`);
  }
});

test("ten Sketchfab heroines are locally integrated while unavailable candidates stay gated", () => {
  assert.equal(manifest.externalCandidates.length, 12);
  const miss = manifest.externalCandidates.find((candidate) => candidate.id === "sketchfab-miss-galaxy");
  assert.equal(miss.status, "integrated-local-safe-motion");
  const gameGirl = manifest.externalCandidates.find((candidate) => candidate.id === "sketchfab-game-character-girl");
  assert.equal(gameGirl.status, "integrated-local-safe-motion");
  assert.equal(gameGirl.author, "gbarzu");
  const integrated = manifest.externalCandidates.filter((candidate) => candidate.status.startsWith("integrated-local"));
  assert.equal(integrated.length, 10);
  for (const candidate of manifest.externalCandidates) {
    assert.equal(candidate.license, "CC-BY-4.0");
    if (![...integrated].includes(candidate)) assert.equal(candidate.status, "awaiting-authenticated-download");
    assert.match(candidate.page, /^https:\/\/sketchfab\.com\/3d-models\//);
    assert.ok(["sword", "gun", "unarmed"].includes(candidate.weaponClass));
  }
  assert.doesNotMatch(JSON.stringify(manifest), /Glayer3d|Limbus/i);
  assert.match(source, /entry\.license === "CC-BY-4\.0"/);
});

test("the local selectable character catalog contains at least ten real GLB models", () => {
  assert.ok(manifest.sources.length >= 10, `expected at least 10 local models, got ${manifest.sources.length}`);
  assert.equal(new Set(manifest.sources.map((entry) => entry.modelId)).size, manifest.sources.length);
  for (const entry of manifest.sources) {
    assert.match(entry.url, /^\.\/assets\/astral-realms\/characters\//);
    const file = path.join(root, entry.url.replace(/^\.\//, "").replace(/\?.*$/, ""));
    assert.ok(fs.existsSync(file), `missing local model ${entry.modelId}`);
    assert.equal(fs.readFileSync(file).subarray(0, 4).toString("ascii"), "glTF");
    assert.ok(worker.includes(path.basename(file)), `${entry.modelId} must work offline`);
  }
});

test("all ten downloaded Sketchfab characters are checksum locked with recorded attribution", () => {
  const sketchfab = manifest.sources.filter((entry) => entry.provider === "sketchfab-cc-by");
  assert.equal(sketchfab.length, 10);
  for (const entry of sketchfab) {
    const relative = entry.url.replace(/^\.\/assets\/astral-realms\/characters\//, "").replace(/\?.*$/, "");
    const record = provenance.sources.find((item) => item.file === relative);
    assert.ok(record, `missing provenance for ${entry.modelId}`);
    assert.equal(record.license, "CC-BY-4.0");
    const bytes = fs.readFileSync(path.join(root, "assets", "astral-realms", "characters", relative));
    const checksum = crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
    assert.equal(checksum, entry.sha256);
    assert.equal(checksum, record.sha256);
    assert.match(record.sourceUrl, /^https:\/\/sketchfab\.com\/3d-models\//);
  }
});

test("Miss Galaxy is provenance locked, cached and protected from rejected retarget motion", () => {
  const local = manifest.sources.find((entry) => entry.modelId === "sketchfab-miss-galaxy");
  assert.ok(local);
  assert.equal(local.provider, "sketchfab-cc-by");
  assert.equal(local.license, "CC-BY-4.0");
  assert.equal(local.author, "Loves_Art");
  assert.equal(local.bones, 75);
  assert.equal(local.bakedClips, 0);
  assert.match(local.motionStatus, /original-web-glb/);

  const relative = "sketchfab-cc-by/miss-galaxy.glb";
  const record = provenance.sources.find((entry) => entry.file === relative);
  assert.ok(record, `missing provenance for ${relative}`);
  const bytes = fs.readFileSync(path.join(root, "assets", "astral-realms", "characters", relative));
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "glTF");
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(), local.sha256);
  assert.equal(record.sha256, local.sha256);
  assert.ok(worker.includes("miss-galaxy.glb"));

  assert.equal(worker.includes("miss-galaxy-motion.glb"), false);
  assert.match(source, /procedural-humanoid-safe/);
  assert.match(source, /sourceInfo\.provider === "sketchfab-cc-by" && !modelSpecificBakedMotion/);
  assert.match(source, /candidate\.motionUrl/);
});

test("Game Character Girl keeps its 136-bone facial rig and attribution", () => {
  const local = manifest.sources.find((entry) => entry.modelId === "sketchfab-game-character-girl");
  assert.equal(local.bones, 136);
  assert.equal(local.triangles, 23380);
  assert.equal(local.nativeAnimations, 3);
  assert.match(local.motionStatus, /procedural-humanoid-safe/);
  const record = provenance.sources.find((entry) => entry.file === "sketchfab-cc-by/game-character-girl.glb");
  const bytes = fs.readFileSync(path.join(root, "assets", "astral-realms", "characters", record.file));
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(), local.sha256);
  assert.equal(record.sha256, local.sha256);
});

test("downloaded hero GLBs are built in, selectable and fitted from humanoid landmarks", () => {
  assert.match(source, /"sketchfab-game-character-girl": "\.\/assets\/astral-realms\/characters\/sketchfab-cc-by\/game-character-girl\.glb"/);
  assert.match(source, /"sketchfab-miss-galaxy": "\.\/assets\/astral-realms\/characters\/sketchfab-cc-by\/miss-galaxy\.glb\?v=2"/);
  assert.match(source, /\["sketchfab-cc-by", "valid-avatar"\]\.includes\(entry\.provider\)/);
  assert.match(source, /Game Character Girl", "gbarzu · 136 bone · CC BY 4\.0 · GLB đã tải local/);
  assert.match(source, /Miss Galaxy", "Loves_Art · 75 bone · CC BY 4\.0 · GLB đã tải local/);
  assert.match(source, /fitHumanoidAsset\(asset, 2\.12\)/);
  assert.match(source, /source: "skeleton-landmarks"/);
  assert.match(source, /getHumanoidPoseBounds\(object, box\)/);
  assert.match(source, /modelId === "sketchfab-miss-galaxy"/);
  assert.match(source, /"sketchfab-static-safe"/);
  assert.match(source, /applyStaticSafeRigMotion\(runtime, time, motion = "idle"\)/);
  assert.match(source, /model-specific-rest-pose-safety/);
  assert.match(source, /\.replace\(\/\[\._-\]\\d\+\$\/g, ""\)/);
});

test("right-hand sockets calibrate every downloaded hero weapon", () => {
  assert.match(source, /configureWeaponSocket\(mesh, weapon, weaponClass = "sword"\)/);
  for (const calibration of ["right-hand-calibrated", "left-hand-calibrated", "two-hand-calibrated"]) {
    assert.ok(source.includes(calibration), `missing ${calibration}`);
  }
  assert.match(source, /weapon\.scale\.setScalar\(preset\.worldScale \/ inheritedScale\)/);
  assert.match(source, /anchor\.parent\?\.getWorldScale/);
  assert.match(source, /parentWorldQuaternion\.invert\(\)\.multiply\(desiredWorldQuaternion\)/);
  assert.match(source, /socket\.calibrated = true/);
  assert.match(source, /sword: \{ position: \[-0\.12, -0\.055, 0\.08\]/);
  assert.match(source, /gun: \{ position: \[0, -0\.035, 0\.028\]/);
  assert.match(source, /unarmed: \{ position: \[0, -0\.018, 0\]/);
  assert.match(source, /syncActiveCharacterDataset\(mesh = this\.playerMesh\)/);
  assert.match(source, /\(lodVariants\.attachments \|\| \[\]\)\.forEach\(\(object\) => \{ object\.visible = tier !== "impostor"; \}\)/);
});

test("downloaded CC4, Mixamo, Renderpeople and Mia rigs map to the HH humanoid", () => {
  for (const alias of [
    "CC_Base_BoneRoot", "CC_Base_Hip", "CC_Base_Spine01", "CC_Base_Spine02", "CC_Base_Head",
    "CC_Base_L_Clavicle", "CC_Base_R_Clavicle", "CC_Base_L_Hand", "CC_Base_R_Hand",
    "upperleg.L", "lowerleg.L", "arm.L", "Kneck"
  ]) assert.ok(source.includes(alias), `missing humanoid alias ${alias}`);
  assert.match(source, /morphChannels\.add\(normalizeMorphTargetName\(name\)/);
  assert.match(source, /triangles: 160000/);
});

test("sword gun and unarmed loadouts drive real combat profiles and motion routing", () => {
  assert.match(source, /const DEFAULT_CHARACTER_WEAPONS = Object\.freeze/);
  assert.match(source, /cael: "pulse-rifle"/);
  assert.match(source, /nyx: "void-gauntlets"/);
  for (const token of [
    "swordSkill", "swordUltimate", "rifleShot", "rifleBurst", "rifleSkill", "rifleUltimate",
    "punch1", "punch2", "kick1", "martialSkill", "martialUltimate"
  ]) assert.ok(source.includes(token), `missing combat motion ${token}`);
  assert.match(source, /const rifleCombat = \/\^rifle\//);
  assert.match(source, /const martialCombat = \/\^\(\?:punch\|kick\|martial\)\//);
  assert.match(source, /combatProfile\.cooldown\.attack/);
  assert.match(source, /this\.refreshEquippedWeapon\(characterId\)/);
  assert.match(source, /button\.dataset\.label = label/);
});

test("Free3D CC0 far LODs sway and remain outside the camera corridor", () => {
  const environment = path.join(root, "assets", "astral-realms", "environment", "free3d-cc0");
  const pack = JSON.parse(fs.readFileSync(path.join(environment, "SOURCES.json"), "utf8"));
  assert.equal(pack.source.license, "CC0-1.0");
  for (const name of pack.assets) {
    assert.ok(fs.existsSync(path.join(environment, name)), `${name} is missing`);
    assert.ok(worker.includes(name), `${name} must work offline`);
  }
  assert.match(source, /"free3dTreeA", "free3dTreeB", "free3dTreeC"/);
  assert.match(source, /assetId\.startsWith\("free3dTree"\)/);
  assert.match(source, /"free3dFlower", "free3dMushroom"/);
});
