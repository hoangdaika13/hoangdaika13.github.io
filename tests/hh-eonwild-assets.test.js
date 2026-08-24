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

function pngHeaderDataUri(width = 1024, height = 1024) {
  const bytes = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

function productionGlbFixture() {
  const binaryChunk = Buffer.alloc(68);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) => binaryChunk.writeFloatLE(value, index * 4));
  binaryChunk.writeFloatLE(0, 36);
  binaryChunk.writeFloatLE(1, 40);
  [0, 0, 0, 1, 0, 0].forEach((value, index) => binaryChunk.writeFloatLE(value, 44 + index * 4));
  const textureNames = ["albedo", "roughness", "normal", "ao", "wetness-dirt-mask"];
  return {
    binaryChunk,
    document: {
      asset: { version: "2.0" },
      buffers: [{ byteLength: binaryChunk.length }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 36, byteLength: 8 },
        { buffer: 0, byteOffset: 44, byteLength: 24 }
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
        { bufferView: 1, componentType: 5126, count: 2, type: "SCALAR" },
        { bufferView: 2, componentType: 5126, count: 2, type: "VEC3" }
      ],
      meshes: [0, 1, 2, 3].map((level) => ({ name: `Creature_LOD${level}`, primitives: [{ attributes: { POSITION: 0 }, material: 0 }] })),
      nodes: [0, 1, 2, 3].map((level) => ({ name: `Creature_LOD${level}`, mesh: level })),
      samplers: [{}],
      images: textureNames.map((name) => ({ name, mimeType: "image/png", uri: pngHeaderDataUri() })),
      textures: textureNames.map((name, source) => ({ name, source, sampler: 0 })),
      materials: [{
        pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicRoughnessTexture: { index: 1 } },
        normalTexture: { index: 2 },
        occlusionTexture: { index: 3 },
        extras: { eonwildTextureIndices: { "wetness-dirt-mask": 4 } }
      }],
      animations: [{
        name: "idle",
        samplers: [{ input: 1, output: 2, interpolation: "LINEAR" }],
        channels: [{ sampler: 0, target: { node: 0, path: "translation" } }]
      }]
    }
  };
}

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
  assert.equal(manifest.verticalSlice.logicalSizeMeters, 16384);
  assert.equal(manifest.verticalSlice.streamingExtensionSizeMeters, 32768);
  assert.equal(manifest.productionPipeline.defaultTextureEdge, 4096);
  assert.equal(manifest.productionPipeline.maximumTextureEdge, 8192);
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

test("license policy is fixed in code and cannot be widened by a hostile manifest", () => {
  const hostile = clone(manifest);
  hostile.productionPipeline.approvedLicenses.push("unknown-marketplace-license");
  const result = pipeline.validateManifest(hostile, { root });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => message.includes("fixed audited policy")));
});

test("production provenance receipt binds source, license and scientific review fields", () => {
  const candidate = clone(manifest);
  const contract = candidate.creatureContracts.find((entry) => entry.speciesId === "tyrannosaurus");
  const asset = candidate.assets.find((entry) => entry.speciesId === "tyrannosaurus" && entry.type === "creature-glb");
  contract.status = "production";
  contract.productionAssetId = asset.id;
  delete contract.prototypeAssetId;
  Object.assign(asset, {
    status: "production",
    rig: contract.rig,
    qualityTier: "production-ready",
    lodLevels: [0, 1, 2, 3],
    textureChannels: candidate.requiredCreatureTextures.slice(),
    reconstructionConfidence: "scientifically-reviewed-production-reconstruction",
    scientificReview: {
      status: "approved",
      sourceUrl: "https://www.nhm.ac.uk/discover/dino-directory/tyrannosaurus.html",
      sha256: "a".repeat(64)
    },
    textureBudget: {
      textureCount: candidate.requiredCreatureTextures.length,
      maximumTextureEdge: 4096,
      pbrComplete: true
    }
  });
  const receipt = {
    format: "hh-eonwild-production-creature-provenance",
    version: 1,
    productionApproved: true,
    originalAuthor: asset.author,
    license: asset.license,
    licenseUrl: asset.licenseUrl,
    assets: [{
      speciesId: asset.speciesId,
      assetId: asset.id,
      filePath: asset.filePath,
      byteSize: asset.byteSize,
      sha256: asset.sha256,
      sourceUrl: asset.sourceUrl,
      sourceApiUrl: asset.sourceApiUrl,
      licenseUrl: asset.licenseUrl,
      scientificSource: asset.scientificSource,
      scientificReview: clone(asset.scientificReview),
      animations: asset.animationClips.slice(),
      lodLevels: asset.lodLevels.slice(),
      textureChannels: asset.textureChannels.slice(),
      textureBudget: clone(asset.textureBudget)
    }]
  };
  const tempDirectory = fs.mkdtempSync(path.join(root, "tests", ".eonwild-production-receipt-"));
  const receiptPath = path.join(tempDirectory, "receipt.json");
  asset.provenancePath = path.relative(root, receiptPath).replaceAll("\\", "/");
  try {
    fs.writeFileSync(receiptPath, JSON.stringify(receipt));
    const bound = pipeline.validateManifest(candidate, { root });
    assert.equal(bound.errors.some((message) => message.includes("bound to source, license, LOD, PBR and scientific review")), false, bound.errors.join("\n"));
    assert.ok(bound.errors.some((message) => message.includes("actual four-level LOD chain")), "declared LOD metadata must not replace GLB evidence");
    assert.ok(bound.errors.some((message) => message.includes("GLB materials do not contain")), "declared PBR channels must not replace GLB material evidence");

    receipt.assets[0].sourceUrl = "https://untrusted.example/relabelled-model";
    receipt.licenseUrl = "https://untrusted.example/fake-license";
    receipt.assets[0].scientificReview.sha256 = "b".repeat(64);
    fs.writeFileSync(receiptPath, JSON.stringify(receipt));
    const hostile = pipeline.validateManifest(candidate, { root });
    assert.equal(hostile.valid, false);
    assert.ok(hostile.errors.some((message) => message.includes("bound to source, license, LOD, PBR and scientific review")));
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test("production GLB inspector binds LOD labels to four distinct backed meshes", () => {
  const fixture = productionGlbFixture();
  const valid = pipeline.inspectProductionGlb(fixture.document, { binaryChunk: fixture.binaryChunk });
  assert.equal(valid.lodChainValid, true, valid.issues.join("\n"));
  assert.deepEqual(valid.lodLevels, [0, 1, 2, 3]);
  assert.deepEqual(valid.lodMeshIndices, [0, 1, 2, 3]);

  const renamedSingleMesh = clone(fixture.document);
  renamedSingleMesh.nodes.forEach((node) => { node.mesh = 0; });
  renamedSingleMesh.meshes = [renamedSingleMesh.meshes[0]];
  const hostile = pipeline.inspectProductionGlb(renamedSingleMesh, { binaryChunk: fixture.binaryChunk });
  assert.equal(hostile.lodChainValid, false);
  assert.deepEqual(hostile.lodLevels, []);
  assert.match(hostile.issues.join("\n"), /four distinct valid meshes/);
});

test("production GLB inspector rejects forged texture indices, sources and oversized image headers", () => {
  const fixture = productionGlbFixture();
  const valid = pipeline.inspectProductionGlb(fixture.document, { binaryChunk: fixture.binaryChunk });
  assert.equal(valid.textureReferencesValid, true, valid.issues.join("\n"));
  assert.equal(valid.textureDimensionsValid, true);
  assert.equal(valid.maximumTextureEdge, 1024);
  assert.deepEqual(valid.textureChannels, ["albedo", "ao", "normal", "roughness", "wetness-dirt-mask"]);

  const hostile = clone(fixture.document);
  hostile.textures[2].source = 999;
  hostile.textures[3].source = undefined;
  hostile.images[4] = { name: "wetness-dirt-mask", mimeType: "image/png", uri: "textures/external.png" };
  const forged = pipeline.inspectProductionGlb(hostile, { binaryChunk: fixture.binaryChunk });
  assert.equal(forged.textureReferencesValid, false);
  assert.equal(forged.textureDimensionsValid, false);
  assert.equal(forged.textureChannels.includes("normal"), false);
  assert.equal(forged.textureChannels.includes("ao"), false);
  assert.equal(forged.textureChannels.includes("wetness-dirt-mask"), false);

  const oversized = clone(fixture.document);
  oversized.images[0].uri = pngHeaderDataUri(9000, 4096);
  const measured = pipeline.inspectProductionGlb(oversized, { binaryChunk: fixture.binaryChunk });
  assert.equal(measured.maximumTextureEdge, 9000);
});

test("production GLB inspector requires real animation channels and increasing backed keyframes", () => {
  const fixture = productionGlbFixture();
  const valid = pipeline.inspectProductionGlb(fixture.document, { binaryChunk: fixture.binaryChunk });
  assert.equal(valid.animationsValid, true, valid.issues.join("\n"));
  assert.deepEqual(valid.validAnimationClips, ["idle"]);

  const emptyClip = clone(fixture.document);
  emptyClip.animations[0].channels = [];
  const namedOnly = pipeline.inspectProductionGlb(emptyClip, { binaryChunk: fixture.binaryChunk });
  assert.equal(namedOnly.animationsValid, false);
  assert.deepEqual(namedOnly.validAnimationClips, []);

  const repeatedTimes = Buffer.from(fixture.binaryChunk);
  repeatedTimes.writeFloatLE(0, 40);
  const noTimeline = pipeline.inspectProductionGlb(fixture.document, { binaryChunk: repeatedTimes });
  assert.equal(noTimeline.animationsValid, false);
  assert.match(noTimeline.issues.join("\n"), /increasing keyframes/);
});

test("asset paths are constrained to the repository", () => {
  assert.equal(pipeline.canonicalPath(root, "../secret.glb"), null);
  assert.equal(pipeline.canonicalPath(root, "https://example.com/a.glb"), null);
  assert.equal(pipeline.canonicalPath(root, "C:\\secret.glb"), null);
  assert.equal(pipeline.canonicalPath(root, "assets/eonwild/model.glb"), path.join(root, "assets", "eonwild", "model.glb"));
  assert.equal(pipeline.manifestRelativePath(root, "../../vendor/babylonjs-loaders-9.22.1.min.js"), path.join(root, "vendor", "babylonjs-loaders-9.22.1.min.js"));
  assert.equal(pipeline.manifestRelativePath(root, "../../../outside.js"), null);
});

test("world and Cinematic texture contracts cannot regress below 16 km or 4K/8K", () => {
  const hostile = clone(manifest);
  hostile.verticalSlice.logicalSizeMeters = 4096;
  hostile.verticalSlice.streamingExtensionSizeMeters = 8192;
  hostile.productionPipeline.defaultTextureEdge = 2048;
  hostile.productionPipeline.maximumTextureEdge = 4096;
  const result = pipeline.validateManifest(hostile, { root });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => message.includes("16–32 km")));
  assert.ok(result.errors.some((message) => message.includes("4K by default")));
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
