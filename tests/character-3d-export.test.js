const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

test("Astra release exporters are modular and never import external model data", () => {
  const files = [
    "character_generator/export/common.py",
    "character_generator/export/export_gltf.py",
    "character_generator/export/export_fbx.py",
    "character_generator/export_release.py"
  ];
  files.forEach((file) => assert.ok(exists(file), `missing ${file}`));
  const source = files.map(read).join("\n");
  assert.match(source, /export_scene\.gltf/);
  assert.match(source, /export_scene\.fbx/);
  assert.match(source, /export_animation_mode["']?\s*:\s*["']ACTIONS/);
  assert.match(source, /export_morph["']?\s*:\s*True/);
  assert.match(source, /bake_anim_use_all_actions["']?\s*:\s*True/);
  assert.doesNotMatch(source, /bpy\.ops\.(?:import_scene|wm\.open_mainfile|wm\.append)/);
});

test("release gate fails closed before GLB or FBX export while release QA is rejected", () => {
  const common = read("character_generator/export/common.py");
  const entry = read("character_generator/export_release.py");
  const review = JSON.parse(read("assets/character-3d/astra-h08/qa/human-base-latest.review.json"));
  assert.equal(review.approvedForNextPhase, true);
  assert.notEqual(review.approvedForRelease, true);
  assert.match(common, /approvedForNextPhase/);
  assert.match(common, /approvedForRelease/);
  assert.match(common, /ASTRA_H08\.pending\.json/);
  assert.match(common, /outputsWritten["']?\s*:\s*\[\]/);
  assert.ok(entry.indexOf("begin_release()") < entry.indexOf("export_glb(GLB_PATH)"));
  assert.ok(entry.indexOf("begin_release()") < entry.indexOf("export_fbx(FBX_PATH)"));
  assert.equal(exists("assets/character-3d/astra-h08/output/ASTRA_H08.glb"), false);
  assert.equal(exists("assets/character-3d/astra-h08/output/ASTRA_H08.fbx"), false);
  assert.equal(exists("assets/character-3d/astra-h08/output/ASTRA_H08.release.json"), false);
});

test("release inventory covers runtime actions, shape keys, materials and hashes", () => {
  const common = read("character_generator/export/common.py");
  for (const token of [
    "REQUIRED_ACTIONS", "Idle", "Walk", "Run", "Attack_01", "Wave",
    "REQUIRED_SHAPE_KEYS", "Blink_L", "Blink_R", "Smile", "Mouth_A", "Mouth_U",
    "REQUIRED_MATERIAL_ROLES", "BODY_SKIN", "HAIR", "BODYSUIT", "ARMOR_WHITE", "EMISSION_CYAN",
    "sha256", "actionCount", "shapeKeyCount", "materialCount", "triangles", "bones"
  ]) assert.ok(common.includes(token), `missing exporter report token ${token}`);
});

test("generated release outputs are ignored until an approved QA handoff", () => {
  const ignore = read(".gitignore");
  assert.match(ignore, /assets\/character-3d\/astra-h08\/output\/\*/);
  assert.match(ignore, /!assets\/character-3d\/astra-h08\/output\/\.gitkeep/);
  assert.match(ignore, /!assets\/character-3d\/astra-h08\/output\/ASTRA_H08\.pending\.json/);
  assert.ok(exists("assets/character-3d/astra-h08/output/.gitkeep"));
  const pending = JSON.parse(read("assets/character-3d/astra-h08/output/ASTRA_H08.pending.json"));
  assert.equal(pending.status, "build-pending");
  assert.equal(pending.approvedForRelease, false);
  assert.deepEqual(pending.outputsWritten, []);
});
