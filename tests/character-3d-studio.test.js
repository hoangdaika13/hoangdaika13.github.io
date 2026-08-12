const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("character 3D route is independently lazy-loaded and mounted", () => {
  const loader = read("performance-loader.js");
  const shell = read("script.js");
  assert.match(loader, /"character-3d"\s*:\s*\{/);
  assert.match(loader, /startsWith\("\/character-3d"\).*\["character-3d"\]/);
  assert.match(shell, /route:\s*"\/character-3d"/);
  assert.match(shell, /HHCharacter3DStudio\?\.mount/);
  assert.match(shell, /HHCharacter3DStudio\?\.unmount/);
});

test("runtime uses the repository Three.js and licensed loader chain", () => {
  const source = read("character-3d-runtime.js");
  for (const dependency of [
    "vendor/three.module.min.js",
    "vendor/addons/loaders/GLTFLoader.js",
    "vendor/addons/loaders/DRACOLoader.js",
    "vendor/addons/loaders/KTX2Loader.js",
    "vendor/addons/libs/meshopt_decoder.module.js"
  ]) assert.ok(source.includes(dependency), `missing local dependency ${dependency}`);
  assert.doesNotMatch(source, /https?:\/\//);
});

test("all requested Character 3D services and concept provenance exist", () => {
  const required = [
    "services/character3d/AvatarRuntime.js",
    "services/character3d/AssetLoader.js",
    "services/character3d/AnimationController.js",
    "services/character3d/ExpressionController.js",
    "services/character3d/CharacterCustomizer.js",
    "services/character3d/VoiceLipSync.js",
    "services/character3d/ExportManager.js",
    "services/character3d/RightsRegistry.js",
    "assets/character-3d/astra-h08/concept/astra-h08-character-sheet-v1.png",
    "assets/character-3d/astra-h08/concept/astra-h08-character-sheet-v1.prompt.txt",
    "assets/character-3d/astra-h08/concept/metadata.json",
    "assets/character-3d/astra-h08/reference-views/astra-h08-front-reference-v1.png",
    "character_generator/config.py",
    "character_generator/README.md",
    "character_generator/run_blender.ps1",
    "docs/CHARACTER_3D_PIPELINE.md"
  ];
  required.forEach((file) => assert.ok(fs.existsSync(path.join(root, file)), `missing ${file}`));
  const metadata = JSON.parse(read("assets/character-3d/astra-h08/concept/metadata.json"));
  assert.equal(metadata.notA3DModel, true);
  assert.equal(metadata.status, "concept-only");
  const pipeline = read("character_generator/README.md");
  assert.match(pipeline, /must not import any external/i);
  assert.match(pipeline, /mesh\.from_pydata\(\)|bmesh/);
  assert.doesNotMatch(read("character-3d-studio.js"), /blender-blockout|procedural-prototype/);
});

test("asset import gate requires local binary files and license review", () => {
  const loader = read("services/character3d/AssetLoader.js");
  const rights = read("services/character3d/RightsRegistry.js");
  assert.match(loader, /glb|vrm/i);
  assert.match(loader, /magic|0x46546c67|glTF/i);
  assert.match(loader, /size|max/i);
  assert.match(loader, /allowOrigins|sameOrigin|allowlist/i);
  assert.match(rights, /approved|review|rejected/i);
  assert.match(rights, /commercial|modification|redistribution/i);
});

test("self-contained Blender body pipeline rejects external models and gates visual QA", () => {
  const generator = [
    read("character_generator/modeling/body.py"),
    read("character_generator/modeling/head.py"),
    read("character_generator/main_body.py")
  ].join("\n");
  assert.match(generator, /mesh\.from_pydata/);
  assert.match(generator, /connected_components/);
  assert.match(generator, /external_model_used["']?\s*:\s*False/);
  assert.match(generator, /head_units/);
  assert.doesNotMatch(generator, /bpy\.ops\.(?:import_scene|wm\.open_mainfile|wm\.append)/);
  const review = JSON.parse(read("assets/character-3d/astra-h08/qa/human-base-latest.review.json"));
  assert.equal(review.approvedForNextPhase, false);
  assert.match(review.releaseGate, /Do not.*commit or push/i);
});

test("animation, cleanup, accessibility and export fallbacks are explicit", () => {
  const runtime = read("services/character3d/AvatarRuntime.js");
  const animation = read("services/character3d/AnimationController.js");
  const exporter = read("services/character3d/ExportManager.js");
  const css = read("character-3d-studio.css");
  assert.match(animation, /crossFade|crossfade/i);
  assert.match(animation, /0\.2|0\.3|0\.4/);
  assert.match(runtime, /dispose/i);
  assert.match(runtime, /visibilitychange|document\.hidden/);
  assert.match(exporter, /MediaRecorder\.isTypeSupported/);
  assert.match(exporter, /captureStream/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /375|420|480/);
});

test("client Character 3D bundle contains no common secret patterns", () => {
  const files = ["character-3d-runtime.js", "character-3d-studio.js", ...fs.readdirSync(path.join(root, "services/character3d")).map((name) => `services/character3d/${name}`)];
  const bundle = files.map(read).join("\n");
  assert.doesNotMatch(bundle, /AIza[0-9A-Za-z_-]{30,}/);
  assert.doesNotMatch(bundle, /sk-[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(bundle, /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/);
});

test("Astra local runtime is manifest-gated and remains honestly pending without a release GLB", () => {
  const studio = read("character-3d-studio.js");
  const loader = read("services/character3d/AssetLoader.js");
  const worker = read("sw.js");
  assert.match(studio, /ASTRA_RELEASE_MANIFEST/);
  assert.match(studio, /approvedForRelease\s*!==\s*true/);
  assert.match(studio, /manifest\?\.model\?\.path\s*!==\s*ASTRA_RELEASE_GLB/);
  assert.match(studio, /loadUrl\(assetPath,\s*\{\s*trustedInternal:\s*true/);
  assert.match(studio, /data-c3d-requires-asset disabled/);
  assert.match(studio, /setAssetControls\(false\)/);
  assert.match(studio, /data-c3d-actions/);
  assert.match(studio, /animationNames/);
  assert.match(studio, /shapeKeyNames/);
  assert.match(studio, /materialNames/);
  assert.match(studio, /data-c3d-clip/);
  assert.match(studio, /ASTRA_H08\.glb local/);
  assert.match(studio, /build pending/);
  assert.match(loader, /ASSET_NOT_FOUND/);
  assert.match(loader, /shapeKeyNames/);
  assert.match(loader, /materialNames/);
  assert.doesNotMatch(worker, /ASTRA_H08\.glb/);
  assert.doesNotMatch(worker, /ASTRA_H08\.release\.json/);
});
