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

test("all four protagonists use local female digital-human fallbacks", () => {
  for (const model of [
    "valid-asian-f-1-casual",
    "valid-white-f-2-casual",
    "valid-black-f-1-casual",
    "valid-hispanic-f-1-milit"
  ]) assert.ok(source.includes(model), `missing main-character model ${model}`);
  assert.match(source, /lyra: "sketchfab-miss-galaxy"/);
  assert.match(source, /cael: "sketchfab-game-character-girl"/);
  assert.match(source, /sol: "valid-hispanic-f-1-milit"/);
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

test("two Sketchfab heroines are locally integrated while remaining candidates stay gated", () => {
  assert.equal(manifest.externalCandidates.length, 4);
  const miss = manifest.externalCandidates.find((candidate) => candidate.id === "sketchfab-miss-galaxy");
  assert.equal(miss.status, "integrated-local-safe-motion");
  const gameGirl = manifest.externalCandidates.find((candidate) => candidate.id === "sketchfab-game-character-girl");
  assert.equal(gameGirl.status, "integrated-local-safe-motion");
  assert.equal(gameGirl.author, "gbarzu");
  for (const candidate of manifest.externalCandidates) {
    assert.equal(candidate.license, "CC-BY-4.0");
    if (!["sketchfab-miss-galaxy", "sketchfab-game-character-girl"].includes(candidate.id)) assert.equal(candidate.status, "awaiting-authenticated-download");
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
    const file = path.join(root, entry.url.replace(/^\.\//, ""));
    assert.ok(fs.existsSync(file), `missing local model ${entry.modelId}`);
    assert.equal(fs.readFileSync(file).subarray(0, 4).toString("ascii"), "glTF");
    assert.ok(worker.includes(path.basename(file)), `${entry.modelId} must work offline`);
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
  assert.match(local.motionStatus, /procedural-humanoid-safe/);

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
