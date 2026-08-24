const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = require(path.join(root, "assets", "eonwild", "asset-manifest.v1.json"));
const pipeline = require(path.join(root, "scripts", "validate-eonwild-assets.js"));

const clone = (value) => JSON.parse(JSON.stringify(value));

test("EonWild production pipeline validates the honest placeholder manifest", () => {
  const result = pipeline.validateManifest(manifest, { root });
  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.deepEqual(result.summary, {
    assets: 0,
    creatureContracts: 4,
    productionCreatures: 0,
    placeholders: 4
  });
  assert.equal(result.warnings.length, 4);
  assert.deepEqual(manifest.creatureContracts.map((row) => row.speciesId).sort(), manifest.verticalSlice.supportedSpecies.slice().sort());
  assert.ok(manifest.creatureContracts.every((row) => row.status === "placeholder" && row.rig.startsWith("bespoke-") && row.lodRatios.length === 4));
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
  assert.ok(result.errors.some((message) => message.includes("productionModelsReady")));
});

test("asset paths are constrained to the repository", () => {
  assert.equal(pipeline.canonicalPath(root, "../secret.glb"), null);
  assert.equal(pipeline.canonicalPath(root, "https://example.com/a.glb"), null);
  assert.equal(pipeline.canonicalPath(root, "C:\\secret.glb"), null);
  assert.equal(pipeline.canonicalPath(root, "assets/eonwild/model.glb"), path.join(root, "assets", "eonwild", "model.glb"));
});
