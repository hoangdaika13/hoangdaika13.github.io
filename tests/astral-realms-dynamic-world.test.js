const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "astral-realms.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "sw.js"), "utf8");

test("the project contains the complete four-pack CC0 environment library", () => {
  const packCounts = { nature: 329, roads: 72, suburban: 40, buildings: 108 };
  let total = 0;
  for (const [pack, expected] of Object.entries(packCounts)) {
    const directory = path.join(root, "assets", "astral-realms", "kenney", pack);
    const models = fs.readdirSync(directory).filter((file) => file.endsWith(".glb"));
    assert.equal(models.length, expected, `${pack} GLB count changed`);
    assert.ok(fs.existsSync(path.join(directory, "SOURCE-License.txt")), `${pack} must retain its source license`);
    total += models.length;
  }
  assert.equal(total, 549);
  assert.match(fs.readFileSync(path.join(root, "assets", "astral-realms", "kenney", "CATALOG.md"), "utf8"), /Creative Commons CC0|CC0/);
});

test("original scenic panorama is mapped onto 3D geometry and available offline", () => {
  const file = path.join(root, "assets", "astral-realms", "environment", "astral-cinematic-panorama-v1.png");
  const bytes = fs.readFileSync(file);
  assert.ok(bytes.length > 1_000_000, "scenic panorama must be a real high-detail raster");
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
  assert.match(source, /scenicPanorama: "\.\/assets\/astral-realms\/environment\/astral-cinematic-panorama-v1\.png"/);
  assert.match(source, /map: this\.photorealAssets\.scenicPanorama \|\| null/);
  assert.doesNotMatch(source, /scene\.background\s*=\s*this\.photorealAssets\.scenicPanorama/);
  assert.match(worker, /environment\/astral-cinematic-panorama-v1\.png/);
});

test("trees clouds sun rain and pebbles have realtime 3D motion", () => {
  for (const token of [
    "createDynamicNatureSystem()",
    "dynamicFoliage",
    "dynamicPebbleFields",
    "sunCorona",
    "cloudBaseScale",
    "weatherWind",
    "instanceMatrix.needsUpdate = true"
  ]) assert.ok(source.includes(token), `missing dynamic-world system ${token}`);
  assert.match(source, /object\.rotation\.z = base\.z \+ Math\.sin/);
  assert.match(source, /this\.sunCorona\.position\.copy\(this\.sunDisc\.position\)/);
  assert.match(source, /puff\.scale\.set/);
  assert.match(source, /hhWeatherTime|positions\[index - 1\] \+= weatherDt \* weatherWind/);
});

test("camera and lighting use restrained full-frame cinematic settings", () => {
  const css = fs.readFileSync(path.join(root, "astral-realms.css"), "utf8");
  assert.match(source, /sensorWidthMm: 36/);
  assert.match(source, /sensorHeightMm: 24/);
  assert.match(source, /focalLengthMm: 40/);
  assert.match(source, /verticalFovDeg: \(2 \* Math\.atan\(24 \/ \(2 \* 40\)\)/);
  assert.match(source, /ACESFilmicToneMapping/);
  assert.match(source, /outputColorSpace = THREE\.SRGBColorSpace/);
  assert.match(source, /physicallyCorrectLights/);
  assert.match(source, /sun\.shadow\.normalBias = 0\.024/);
  assert.match(source, /cameraFocusDistance/);
  assert.match(source, /floatX = Math\.sin/);
  assert.match(css, /har-camera-grain/);
  assert.match(css, /filter: saturate\(\.92\) contrast\(1\.035\)/);
  assert.match(source, /new THREE\.CylinderGeometry\(1\.75, 2\.2, 0\.34, 64\)/);
  assert.match(source, /hasAuthoredCity \? 0 : 9/);
});

test("curated nearby environment models stream instead of preloading all 549", () => {
  for (const model of [
    "tree_oak.glb",
    "tree_palmDetailedTall.glb",
    "plant_bushDetailed.glb",
    "path_stone.glb",
    "road-straight.glb",
    "road-bridge.glb",
    "building-type-a.glb",
    "building-sample-tower-c.glb"
  ]) {
    assert.ok(source.includes(model), `runtime selection missing ${model}`);
    assert.ok(worker.includes(model), `offline cache missing ${model}`);
  }
  assert.match(source, /visibleRadius/);
  assert.match(source, /this\.streamingGroups\.forEach/);
});

test("Kenney textured packs retain and offline-cache their shared colormaps", () => {
  for (const pack of ["roads", "suburban", "buildings"]) {
    const relative = `assets/astral-realms/kenney/${pack}/Textures/colormap.png`;
    const file = path.join(root, ...relative.split("/"));
    assert.ok(fs.existsSync(file), `${pack} colormap is required by its GLB models`);
    assert.ok(fs.statSync(file).size > 1_000, `${pack} colormap must contain real image data`);
    assert.ok(worker.includes(relative), `${pack} colormap must be available offline`);
  }
});

test("CC0 photogrammetry source manifest locks every downloaded asset by checksum", () => {
  const environmentRoot = path.join(root, "assets", "astral-realms", "environment");
  const manifest = JSON.parse(fs.readFileSync(path.join(environmentRoot, "SOURCES.json"), "utf8"));
  assert.equal(manifest.version, 1);
  assert.match(manifest.policy, /recorded source, license and immutable SHA-256 checksum/);
  assert.ok(manifest.sources.length >= 7, "expected the complete scan, surface and HDR source catalog");
  for (const entry of manifest.sources) {
    assert.equal(entry.license, "CC0-1.0", `${entry.id} must remain CC0`);
    assert.match(entry.sourceUrl || entry.files[0]?.sourceUrl || "", /^https:\/\//, `${entry.id} needs a source URL`);
    for (const asset of entry.files) {
      const file = path.join(environmentRoot, ...asset.file.split("/"));
      const bytes = fs.readFileSync(file);
      assert.equal(bytes.length, asset.bytes, `${asset.file} byte size changed`);
      assert.equal(crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(), asset.sha256, `${asset.file} checksum changed`);
    }
  }
});

test("HDR and photogrammetry PBR maps are real files with explicit color-space handling", () => {
  const environmentRoot = path.join(root, "assets", "astral-realms", "environment");
  const hdr = fs.readFileSync(path.join(environmentRoot, "hdr", "bell_park_dawn_1k.hdr"));
  assert.ok(hdr.length > 1_000_000);
  assert.match(hdr.subarray(0, 80).toString("ascii"), /#\?RADIANCE|#\?RGBE/);
  for (const name of ["color", "normal-gl", "roughness", "height", "ao"]) {
    const bytes = fs.readFileSync(path.join(environmentRoot, "surfaces", `ground037-${name}.webp`));
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");
  }
  assert.match(source, /role === "albedo" \? THREE\.SRGBColorSpace : THREE\.NoColorSpace/);
  assert.match(source, /hdr-photogrammetry-ready/);
  assert.match(source, /normalMap: this\.terrainSurfaceTextures\.normal/);
  assert.match(source, /roughnessMap: this\.terrainSurfaceTextures\.roughness/);
  assert.match(source, /aoMap: this\.terrainSurfaceTextures\.ao/);
  assert.match(source, /bumpMap: this\.terrainSurfaceTextures\.height/);
  assert.match(source, /disposePhotorealAssets\(\)/);
});

test("hero photogrammetry LODs are web-compressed, adaptive and available offline", () => {
  for (const file of ["pine_roots_web.glb", "modular_fort_01_web.glb"]) {
    const bytes = fs.readFileSync(path.join(root, "assets", "astral-realms", "environment", file));
    assert.ok(bytes.length > 1_000_000 && bytes.length < 3_000_000, `${file} should be a bounded web LOD`);
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "glTF");
    assert.ok(worker.includes(file), `${file} must be available offline`);
    assert.ok(source.includes(file), `${file} must be used by the world loader`);
  }
  assert.match(source, /CINEMATIC_ENVIRONMENT_ASSET_IDS/);
  assert.match(source, /allowCinematicScans/);
  assert.match(source, /data\.cinematicScans|dataset\.cinematicScans/);
});

test("HDRLoader matches the vendored Three runtime and is cached", () => {
  const hdrLoader = fs.readFileSync(path.join(root, "vendor", "addons", "loaders", "HDRLoader.js"), "utf8");
  assert.match(hdrLoader, /from '\.\.\/\.\.\/three\.module\.min\.js'/);
  assert.match(hdrLoader, /class HDRLoader extends DataTextureLoader/);
  assert.match(source, /import\("\.\/vendor\/addons\/loaders\/HDRLoader\.js"\)/);
  assert.doesNotMatch(source, /quality === "low" \|\| this\.rendererBackend !== "webgl2"/);
  assert.match(worker, /vendor\/addons\/loaders\/HDRLoader\.js/);
});
