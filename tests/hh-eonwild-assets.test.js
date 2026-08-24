const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = require(path.join(root, "assets", "eonwild", "asset-manifest.v1.json"));
const pipeline = require(path.join(root, "scripts", "validate-eonwild-assets.js"));
const sync = require(path.join(root, "scripts", "sync-eonwild-polyhaven-assets.js"));
const creatureSync = require(path.join(root, "scripts", "sync-eonwild-quaternius-creatures.js"));
const creatureProvenance = require(path.join(root, "assets", "eonwild", "creatures", "quaternius-provenance.v1.json"));

const clone = (value) => JSON.parse(JSON.stringify(value));

test("EonWild pipeline validates CC0 environment assets without promoting creature placeholders", () => {
  const result = pipeline.validateManifest(manifest, { root });
  assert.equal(result.valid, true, result.errors.join("\n"));
  const environmentAssets = manifest.assets.filter((asset) => asset.type.startsWith("environment-"));
  const prototypeCreatures = manifest.assets.filter((asset) => asset.type === "creature-glb" && asset.status === "prototype");
  assert.deepEqual(result.summary, {
    assets: manifest.assets.length,
    environmentAssets: environmentAssets.length,
    prototypeCreatures: prototypeCreatures.length,
    runtimeAssetBytes: environmentAssets.reduce((total, asset) => total + asset.byteSize, 0),
    creatureContracts: 4,
    productionCreatures: 0,
    placeholders: 4
  });
  assert.equal(result.warnings.length, 4 + prototypeCreatures.length);
  assert.deepEqual(manifest.creatureContracts.map((row) => row.speciesId).sort(), manifest.verticalSlice.supportedSpecies.slice().sort());
  assert.ok(manifest.creatureContracts.every((row) => row.status === "placeholder" && row.rig.startsWith("bespoke-") && row.lodRatios.length === 4));
  assert.equal(manifest.environmentPipeline.runtimeBytes, environmentAssets.reduce((total, asset) => total + asset.byteSize, 0));
  assert.ok(manifest.environmentPipeline.runtimeBytes < manifest.environmentPipeline.runtimeBudgetBytes);
  assert.ok(environmentAssets.every((asset) => asset.status === "runtime-ready" && asset.license === "CC0-1.0" && asset.sourceResolution === "1k"));
  assert.ok(environmentAssets.some((asset) => asset.role === "living-desert-tree"));
  assert.ok(environmentAssets.some((asset) => asset.type === "environment-hdr"));
});

test("Quaternius CC0 creature prototypes keep exact provenance, animation clips and non-production status", () => {
  assert.equal(creatureProvenance.format, "hh-eonwild-creature-provenance");
  assert.equal(creatureProvenance.productionApproved, false);
  assert.equal(creatureProvenance.license, "CC0-1.0");
  assert.deepEqual(creatureSync.expectedAnimations, ["attack", "death", "idle", "jump", "run", "walk"]);
  for (const record of creatureProvenance.assets) {
    const asset = manifest.assets.find((candidate) => candidate.speciesId === record.speciesId && candidate.status === "prototype");
    const contract = manifest.creatureContracts.find((candidate) => candidate.speciesId === record.speciesId);
    assert.ok(asset, `${record.speciesId} prototype is not manifested`);
    assert.equal(contract.status, "placeholder");
    assert.equal(contract.prototypeAssetId, asset.id);
    assert.equal(asset.reconstructionConfidence, "stylized-prototype-not-scientifically-reviewed");
    const bytes = fs.readFileSync(path.join(root, record.filePath));
    assert.equal(bytes.length, record.byteSize);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), record.sha256);
    const document = creatureSync.parseGlb(bytes);
    assert.deepEqual(creatureSync.normalizedAnimations(document), creatureSync.expectedAnimations);
    assert.equal(document.skins.length, 1);
  }
});

test("prototype creature metadata cannot be promoted to production", () => {
  const hostile = clone(manifest);
  const contract = hostile.creatureContracts.find((candidate) => candidate.speciesId === "tyrannosaurus");
  const asset = hostile.assets.find((candidate) => candidate.speciesId === "tyrannosaurus" && candidate.type === "creature-glb");
  contract.status = "production";
  asset.status = "production";
  const result = pipeline.validateManifest(hostile, { root });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => message.includes("bespoke production contract")));
  assert.ok(result.errors.some((message) => message.includes("PBR production-ready")));
  assert.ok(result.errors.some((message) => message.includes("four-level LOD chain")));
  assert.ok(result.errors.some((message) => message.includes("production animation set is incomplete")));
  assert.ok(result.errors.some((message) => message.includes("production-approved provenance")));
});

test("asset authors and animation claims must match provenance and GLB evidence", () => {
  const hostileEnvironment = clone(manifest);
  hostileEnvironment.assets.find((asset) => asset.type === "environment-glb").author = "Unrelated uploader";
  const environmentResult = pipeline.validateManifest(hostileEnvironment, { root });
  assert.equal(environmentResult.valid, false);
  assert.ok(environmentResult.errors.some((message) => message.includes("Poly Haven provenance receipt")));

  const hostileCreature = clone(manifest);
  hostileCreature.assets.find((asset) => asset.type === "creature-glb").animationClips = ["teleport"];
  const creatureResult = pipeline.validateManifest(hostileCreature, { root });
  assert.equal(creatureResult.valid, false);
  assert.ok(creatureResult.errors.some((message) => message.includes("animation claims do not match the GLB")));
  assert.ok(creatureResult.errors.some((message) => message.includes("creature provenance receipt")));
});

test("EonWild production claims fail closed without approved GLB assets", () => {
  const hostile = clone(manifest);
  hostile.verticalSlice.productionModelsReady = true;
  hostile.creatureContracts[0].status = "production";
  hostile.assets.push({
    id: "fake-human-model",
    speciesId: "tyrannosaurus",
    type: "creature-glb",
    filePath: "../outside.glb",
    sourceUrl: "http://example.invalid/model.glb",
    author: "unknown",
    license: "unknown",
    scientificSource: "none",
    era: "mesozoic",
    timeSlice: "cretaceous-laramidia",
    realScaleMeters: 12,
    modelVersion: 1,
    lodLevels: [0],
    textureBudget: {},
    sha256: "0".repeat(64),
    modificationHistory: [],
    reconstructionConfidence: "unknown"
  });
  const result = pipeline.validateManifest(hostile, { root });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => message.includes("unapproved license")));
  assert.ok(result.errors.some((message) => message.includes("escapes the repository")));
  assert.ok(result.errors.some((message) => message.includes("no-human policy")));
  assert.ok(result.errors.some((message) => message.includes("approved production creature GLB")));
  assert.ok(result.errors.some((message) => message.includes("productionModelsReady")));
});

test("asset paths are constrained to the repository", () => {
  assert.equal(pipeline.canonicalPath(root, "../secret.glb"), null);
  assert.equal(pipeline.canonicalPath(root, "https://example.com/a.glb"), null);
  assert.equal(pipeline.canonicalPath(root, "C:\\secret.glb"), null);
  assert.equal(pipeline.canonicalPath(root, "assets/eonwild/model.glb"), path.join(root, "assets", "eonwild", "model.glb"));
  assert.equal(pipeline.manifestRelativePath(root, "../../vendor/babylonjs-loaders-9.22.1.min.js"), path.join(root, "vendor", "babylonjs-loaders-9.22.1.min.js"));
  assert.equal(pipeline.manifestRelativePath(root, "../../../outside.js"), null);
});

test("Poly Haven evidence fails closed when checksums, hosts or byte budgets are changed", () => {
  const hostile = clone(manifest);
  hostile.assets[0].sourceFiles[0].md5 = "0".repeat(32);
  hostile.assets[1].sourceFiles[0].url = "https://evil.example/rock.gltf";
  hostile.assets[2].byteSize += 1;
  hostile.environmentPipeline.runtimeBytes += 1;
  const result = pipeline.validateManifest(hostile, { root });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => message.includes("untrusted source download URL")));
  assert.ok(result.errors.some((message) => message.includes("byteSize does not match")));
  assert.ok(result.errors.some((message) => message.includes("provenance receipt")));
});

test("Poly Haven sync allowlist uses the declared API identity and rejects unsafe URLs and paths", () => {
  assert.equal(sync.userAgent, "HH-EonWild-AssetPipeline/1.0 (+https://hoang8.com)");
  assert.equal(sync.gltfTransformVersion, "4.4.2");
  assert.deepEqual(sync.allowedAssets.map((asset) => asset.id), [
    "fern_02",
    "rock_moss_set_01",
    "quiver_tree_02",
    "kloofendal_48d_partly_cloudy_puresky"
  ]);
  assert.equal(sync.safeRelativePath("textures/fern_02_diff_1k.jpg"), "textures/fern_02_diff_1k.jpg");
  assert.throws(() => sync.safeRelativePath("../secret"), /Unsafe package path/);
  assert.throws(() => sync.trustedUrl("https://evil.example/model.glb", "https://dl.polyhaven.org"), /Untrusted Poly Haven URL/);
  assert.throws(() => sync.removeVerifiedTempRoot(root), /Refusing to remove an unverified temporary path/);
});
