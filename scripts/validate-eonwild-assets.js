"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..");
const defaultManifestPath = path.join(repositoryRoot, "assets", "eonwild", "asset-manifest.v1.json");
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SHA1_PATTERN = /^[a-f0-9]{40}$/;
const MD5_PATTERN = /^[a-f0-9]{32}$/;
const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,95}$/;
const ENVIRONMENT_TYPES = new Set(["environment-glb", "environment-hdr"]);
const CC0_LICENSE_URL = "https://creativecommons.org/publicdomain/zero/1.0/";

function canonicalPath(root, relativePath) {
  const value = String(relativePath || "").replaceAll("\\", "/");
  if (!value || value.startsWith("/") || value.includes(":") || value.split("/").includes("..")) return null;
  const absolute = path.resolve(root, value);
  return absolute === root || absolute.startsWith(`${root}${path.sep}`) ? absolute : null;
}

function manifestRelativePath(root, relativePath) {
  const value = String(relativePath || "").replaceAll("\\", "/");
  if (!value || value.startsWith("/") || value.includes(":")) return null;
  const manifestDirectory = path.join(root, "assets", "eonwild");
  const absolute = path.resolve(manifestDirectory, value);
  return absolute === root || absolute.startsWith(`${root}${path.sep}`) ? absolute : null;
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function canonicalTextSha256(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replaceAll("\r\n", "\n");
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function safePackagePath(relativePath) {
  const value = String(relativePath || "").replaceAll("\\", "/");
  return Boolean(value && !value.startsWith("/") && !value.includes(":") && !value.split("/").includes(".."));
}

function exactHttpsUrl(rawUrl, origin) {
  try {
    const url = new URL(String(rawUrl || ""));
    return url.protocol === "https:" && url.origin === origin && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function normalizedSourceFiles(files) {
  return (Array.isArray(files) ? files : []).map((file) => ({
    path: String(file?.path || ""),
    url: String(file?.url || ""),
    byteSize: Number(file?.byteSize || 0),
    md5: String(file?.md5 || "")
  }));
}

function normalizedAnimationNames(animations) {
  return [...new Set((Array.isArray(animations) ? animations : [])
    .map((animation) => String(typeof animation === "string" ? animation : animation?.name || "")
      .split(/[_:/\\]/u).pop().trim().toLowerCase().replace(/\s+/gu, "-"))
    .filter(Boolean))].sort();
}

function parseGlbDocument(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length < 24 || bytes.toString("ascii", 0, 4) !== "glTF") throw new Error("Invalid GLB header.");
  if (bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error("Invalid GLB version or length.");
  const jsonLength = bytes.readUInt32LE(12);
  if (!Number.isSafeInteger(jsonLength) || jsonLength <= 0 || jsonLength > bytes.length - 20 || bytes.toString("ascii", 16, 20) !== "JSON") throw new Error("Invalid GLB JSON chunk.");
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8").replace(/\u0000+$/u, ""));
}

function validateManifest(manifest, options = {}) {
  const root = path.resolve(options.root || repositoryRoot);
  const errors = [];
  const warnings = [];
  const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
  const contracts = Array.isArray(manifest?.creatureContracts) ? manifest.creatureContracts : [];
  const requiredFields = Array.isArray(manifest?.requiredAssetFields) ? manifest.requiredAssetFields : [];
  const requiredCreatureFields = Array.isArray(manifest?.requiredCreatureAssetFields) ? manifest.requiredCreatureAssetFields : [];
  const requiredEnvironmentFields = Array.isArray(manifest?.requiredEnvironmentAssetFields) ? manifest.requiredEnvironmentAssetFields : [];
  const approvedLicenses = new Set(manifest?.productionPipeline?.approvedLicenses || []);
  const supportedSpecies = new Set(manifest?.verticalSlice?.supportedSpecies || []);

  if (manifest?.format !== "hh-eonwild-asset-manifest" || manifest?.version !== 1) errors.push("Unsupported EonWild asset manifest format/version.");
  if (manifest?.policy?.humanContentAllowed !== false) errors.push("Human content must remain disabled.");
  if (manifest?.policy?.unknownLicenseAllowed !== false) errors.push("Unknown licenses must remain disabled.");
  if (manifest?.policy?.externalRuntimeAssetsAllowed !== false) errors.push("Runtime assets must remain same-origin.");
  if (manifest?.productionPipeline?.status !== "contract-ready") errors.push("Production pipeline contract is missing.");
  for (const stage of ["blender", "gltf-validation", "meshopt", "ktx2", "manifest", "browser-qa"]) {
    if (!manifest?.productionPipeline?.stages?.includes(stage)) errors.push(`Missing production stage: ${stage}`);
  }
  if (!manifest?.requiredCreatureTextures?.includes("wetness-dirt-mask")) errors.push("Creature wetness/dirt texture contract is missing.");
  for (const clip of ["idle", "walk", "run", "turn-left", "turn-right", "injured", "death", "nest", "care-young"]) {
    if (!manifest?.requiredCreatureAnimations?.includes(clip)) errors.push(`Missing required animation clip: ${clip}`);
  }
  for (const [label, relativePath, expectedHash, hashFile] of [
    ["renderer", manifest?.runtime?.rendererPath, manifest?.runtime?.rendererSha256, sha256],
    ["renderer license", manifest?.runtime?.rendererLicensePath, manifest?.runtime?.rendererLicenseSha256, canonicalTextSha256],
    ["glTF loader", manifest?.runtime?.loaderPath, manifest?.runtime?.loaderSha256, sha256],
    ["glTF loader license", manifest?.runtime?.loaderLicensePath, manifest?.runtime?.loaderLicenseSha256, canonicalTextSha256]
  ]) {
    const runtimeFile = manifestRelativePath(root, relativePath);
    if (!runtimeFile || !fs.existsSync(runtimeFile) || !fs.statSync(runtimeFile).isFile()) errors.push(`EonWild ${label} file is missing or escapes the repository.`);
    else if (!SHA256_PATTERN.test(String(expectedHash || "")) || hashFile(runtimeFile) !== expectedHash) errors.push(`EonWild ${label} checksum does not match.`);
  }
  if (manifest?.runtime?.rendererVersion !== manifest?.runtime?.loaderVersion || manifest?.runtime?.loaderLicense !== "Apache-2.0") errors.push("Babylon renderer and glTF loader versions/licenses must match.");
  if (manifest?.runtime?.licenseChecksumNormalization !== "utf8-lf") errors.push("Runtime license checksum normalization must be explicit and cross-platform.");
  if (manifest?.runtime?.loaderSourceUrl !== `https://unpkg.com/babylonjs-loaders@${manifest?.runtime?.loaderVersion}/babylonjs.loaders.min.js`) errors.push("Babylon glTF loader source URL is not version-pinned.");

  const contractSpecies = new Set();
  for (const contract of contracts) {
    const speciesId = String(contract?.speciesId || "");
    if (!SAFE_ID_PATTERN.test(speciesId)) errors.push(`Invalid creature contract species id: ${speciesId || "<empty>"}`);
    if (contractSpecies.has(speciesId)) errors.push(`Duplicate creature contract: ${speciesId}`);
    contractSpecies.add(speciesId);
    if (!supportedSpecies.has(speciesId)) errors.push(`Creature contract is outside the vertical slice: ${speciesId}`);
    if (!["placeholder", "production"].includes(contract?.status)) errors.push(`Invalid creature status for ${speciesId}`);
    if (!String(contract?.rig || "").startsWith("bespoke-")) errors.push(`Creature ${speciesId} must declare a bespoke rig.`);
    if (!Number.isFinite(contract?.realScaleMeters) || contract.realScaleMeters <= 0) errors.push(`Creature ${speciesId} needs a positive real scale.`);
    if (!Array.isArray(contract?.lodRatios) || contract.lodRatios.length !== 4 || contract.lodRatios.some((value) => !Number.isFinite(value) || value <= 0 || value > 1)) errors.push(`Creature ${speciesId} needs four bounded LOD ratios.`);
    if (contract?.status === "placeholder") warnings.push(`${speciesId}: procedural placeholder; production GLB is not approved yet.`);
  }
  for (const speciesId of supportedSpecies) if (!contractSpecies.has(speciesId)) errors.push(`Missing creature contract: ${speciesId}`);

  const assetIds = new Set();
  const environmentAssets = [];
  const creatureAssets = [];
  for (const asset of assets) {
    const id = String(asset?.id || "");
    const type = String(asset?.type || "");
    if (!SAFE_ID_PATTERN.test(id)) errors.push(`Invalid asset id: ${id || "<empty>"}`);
    if (assetIds.has(id)) errors.push(`Duplicate asset id: ${id}`);
    assetIds.add(id);
    for (const field of requiredFields) if (asset?.[field] == null || asset[field] === "") errors.push(`${id || "<asset>"} is missing ${field}.`);
    if (type === "creature-glb") for (const field of requiredCreatureFields) if (asset?.[field] == null || asset[field] === "") errors.push(`${id || "<asset>"} is missing creature field ${field}.`);
    if (ENVIRONMENT_TYPES.has(type)) for (const field of requiredEnvironmentFields) if (asset?.[field] == null || asset[field] === "") errors.push(`${id || "<asset>"} is missing environment field ${field}.`);
    if (type !== "creature-glb" && !ENVIRONMENT_TYPES.has(type)) errors.push(`${id || "<asset>"} has an unsupported asset type.`);
    if (!approvedLicenses.has(asset?.license)) errors.push(`${id || "<asset>"} uses an unapproved license.`);
    if (!/^https:\/\//i.test(String(asset?.sourceUrl || ""))) errors.push(`${id || "<asset>"} needs an HTTPS source URL.`);
    const filePath = canonicalPath(root, asset?.filePath);
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) errors.push(`${id || "<asset>"} file is missing or escapes the repository.`);
    else {
      if (!SHA256_PATTERN.test(String(asset?.sha256 || "")) || sha256(filePath) !== asset.sha256) errors.push(`${id || "<asset>"} checksum does not match.`);
      if (!Number.isSafeInteger(asset?.byteSize) || asset.byteSize <= 0 || fs.statSync(filePath).size !== asset.byteSize) errors.push(`${id || "<asset>"} byteSize does not match.`);
    }
    const provenancePath = canonicalPath(root, asset?.provenancePath);
    if (!provenancePath || !fs.existsSync(provenancePath) || !fs.statSync(provenancePath).isFile()) errors.push(`${id || "<asset>"} provenance file is missing or escapes the repository.`);
    if (!Array.isArray(asset?.modificationHistory) || asset.modificationHistory.length === 0 || asset.modificationHistory.some((entry) => !String(entry || "").trim())) errors.push(`${id || "<asset>"} needs a non-empty modification history.`);
    if (/\b(?:human|person|homo)\b/i.test(JSON.stringify(asset))) errors.push(`${id || "<asset>"} violates the no-human policy.`);

    if (ENVIRONMENT_TYPES.has(type)) {
      environmentAssets.push(asset);
      const sourceAssetId = String(asset?.sourceAssetId || "");
      if (!SAFE_ID_PATTERN.test(sourceAssetId)) errors.push(`${id || "<asset>"} has an invalid Poly Haven source id.`);
      if (asset?.status !== "runtime-ready") errors.push(`${id || "<asset>"} environment status must be runtime-ready.`);
      if (asset?.license !== "CC0-1.0" || asset?.licenseUrl !== CC0_LICENSE_URL) errors.push(`${id || "<asset>"} must use the canonical CC0 declaration.`);
      if (asset?.sourceUrl !== `https://polyhaven.com/a/${sourceAssetId}`) errors.push(`${id || "<asset>"} source page does not match its Poly Haven id.`);
      if (asset?.sourceApiUrl !== `https://api.polyhaven.com/files/${sourceAssetId}`) errors.push(`${id || "<asset>"} API evidence URL does not match its Poly Haven id.`);
      if (asset?.sourceResolution !== "1k") errors.push(`${id || "<asset>"} is outside the approved 1K runtime tier.`);
      if (!SHA1_PATTERN.test(String(asset?.sourceFilesHash || ""))) errors.push(`${id || "<asset>"} needs the Poly Haven files hash.`);
      if (type === "environment-glb" && (asset?.runtimeFormat !== "glb" || !String(asset?.filePath || "").endsWith(".glb"))) errors.push(`${id || "<asset>"} GLB runtime format/path mismatch.`);
      if (type === "environment-hdr" && (asset?.runtimeFormat !== "radiance-hdr" || !String(asset?.filePath || "").endsWith(".hdr"))) errors.push(`${id || "<asset>"} HDR runtime format/path mismatch.`);
      if (!Array.isArray(asset?.sourceFiles) || asset.sourceFiles.length === 0 || asset.sourceFiles.length > 32) errors.push(`${id || "<asset>"} needs bounded source-file evidence.`);
      else for (const sourceFile of asset.sourceFiles) {
        const sourceUrl = exactHttpsUrl(sourceFile?.url, "https://dl.polyhaven.org");
        if (!safePackagePath(sourceFile?.path)) errors.push(`${id || "<asset>"} has an unsafe source package path.`);
        if (!sourceUrl || !sourceUrl.pathname.startsWith("/file/ph-assets/")) errors.push(`${id || "<asset>"} has an untrusted source download URL.`);
        if (!Number.isSafeInteger(sourceFile?.byteSize) || sourceFile.byteSize <= 0) errors.push(`${id || "<asset>"} has an invalid source byte size.`);
        if (!MD5_PATTERN.test(String(sourceFile?.md5 || ""))) errors.push(`${id || "<asset>"} has invalid source MD5 evidence.`);
      }
    }
    if (type === "creature-glb") {
      creatureAssets.push(asset);
      const speciesId = String(asset?.speciesId || "");
      if (!supportedSpecies.has(speciesId)) errors.push(`${id || "<asset>"} targets an unsupported creature species.`);
      if (!["prototype", "production"].includes(asset?.status)) errors.push(`${id || "<asset>"} creature status must be prototype or production.`);
      if (!/^https:\/\//i.test(String(asset?.scientificSource || ""))) errors.push(`${id || "<asset>"} needs an HTTPS scientific source.`);
      if (!Number.isFinite(asset?.realScaleMeters) || asset.realScaleMeters <= 0) errors.push(`${id || "<asset>"} needs a positive real scale.`);
      if (!Array.isArray(asset?.lodLevels) || asset.lodLevels.length === 0 || asset.lodLevels.some((level) => !Number.isInteger(level) || level < 0 || level > 8)) errors.push(`${id || "<asset>"} needs bounded LOD levels.`);
      if (!asset?.textureBudget || typeof asset.textureBudget !== "object" || Array.isArray(asset.textureBudget)) errors.push(`${id || "<asset>"} needs a texture budget object.`);
      if (!String(asset?.reconstructionConfidence || "").trim()) errors.push(`${id || "<asset>"} needs reconstruction confidence.`);
      let creatureDocument = null;
      if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        if (!String(asset?.filePath || "").toLowerCase().endsWith(".glb")) errors.push(`${id || "<asset>"} creature runtime file must be GLB.`);
        else try { creatureDocument = parseGlbDocument(filePath); }
        catch { errors.push(`${id || "<asset>"} creature GLB is structurally invalid.`); }
      }
      const declaredClips = normalizedAnimationNames(asset?.animationClips);
      const actualClips = normalizedAnimationNames(creatureDocument?.animations);
      if (declaredClips.length === 0) errors.push(`${id || "<asset>"} needs declared animation clips.`);
      else if (creatureDocument && JSON.stringify(declaredClips) !== JSON.stringify(actualClips)) errors.push(`${id || "<asset>"} animation claims do not match the GLB.`);
      const contract = contracts.find((candidate) => candidate.speciesId === speciesId);
      let receipt = null;
      try { receipt = provenancePath ? JSON.parse(fs.readFileSync(provenancePath, "utf8")) : null; }
      catch { errors.push(`${id || "<asset>"} creature provenance is not valid JSON.`); }
      if (asset?.status === "prototype") {
        if (asset?.license !== "CC0-1.0" || asset?.licenseUrl !== CC0_LICENSE_URL) errors.push(`${id || "<asset>"} prototype must use the canonical CC0 declaration.`);
        if (asset?.qualityTier !== "prototype-only" || asset?.textureBudget?.pbrComplete !== false || asset?.lodLevels?.length !== 1) errors.push(`${id || "<asset>"} must remain explicitly bounded as a non-PBR single-LOD prototype.`);
        if (!contract || contract.status !== "placeholder" || contract.prototypeAssetId !== id) errors.push(`${id || "<asset>"} prototype is not linked to a placeholder creature contract.`);
        if (receipt) {
          if (receipt.format !== "hh-eonwild-creature-provenance" || receipt.version !== 1 || receipt.productionApproved !== false || receipt.license !== "CC0-1.0") errors.push(`${id || "<asset>"} has an invalid prototype provenance declaration.`);
          const evidence = Array.isArray(receipt.assets) ? receipt.assets.find((entry) => entry.speciesId === speciesId) : null;
          if (asset.author !== receipt.originalAuthor || !evidence || evidence.filePath !== asset.filePath || evidence.byteSize !== asset.byteSize || evidence.sha256 !== asset.sha256 || evidence.modelPage !== asset.sourceUrl || evidence.downloadUrl !== asset.sourceApiUrl || JSON.stringify(normalizedAnimationNames(evidence.animations)) !== JSON.stringify(declaredClips)) errors.push(`${id || "<asset>"} does not match its creature provenance receipt.`);
        }
        warnings.push(`${speciesId}: animated CC0 low-poly prototype is available, but production rig/PBR/LOD requirements remain unmet.`);
      } else if (asset?.status === "production") {
        const requiredClips = normalizedAnimationNames(manifest?.requiredCreatureAnimations);
        const requiredTextures = [...new Set((Array.isArray(manifest?.requiredCreatureTextures) ? manifest.requiredCreatureTextures : []).map((value) => String(value || "").trim()).filter(Boolean))].sort();
        const declaredTextures = [...new Set((Array.isArray(asset?.textureChannels) ? asset.textureChannels : []).map((value) => String(value || "").trim()).filter(Boolean))].sort();
        const expectedLods = [0, 1, 2, 3];
        const maximumTextureEdge = Number(manifest?.productionPipeline?.maximumTextureEdge);
        if (!contract || contract.status !== "production" || contract.productionAssetId !== id || asset.rig !== contract.rig) errors.push(`${id || "<asset>"} production asset is not bound to its bespoke production contract.`);
        if (asset.qualityTier !== "production-ready" || asset.textureBudget?.pbrComplete !== true) errors.push(`${id || "<asset>"} production asset must be explicitly PBR production-ready.`);
        if (JSON.stringify(asset.lodLevels) !== JSON.stringify(expectedLods)) errors.push(`${id || "<asset>"} production asset needs the exact four-level LOD chain.`);
        if (!requiredClips.every((clip) => declaredClips.includes(clip)) || !requiredClips.every((clip) => actualClips.includes(clip))) errors.push(`${id || "<asset>"} production animation set is incomplete.`);
        if (!requiredTextures.every((channel) => declaredTextures.includes(channel))) errors.push(`${id || "<asset>"} production PBR texture channels are incomplete.`);
        if (!Number.isSafeInteger(asset?.textureBudget?.textureCount) || asset.textureBudget.textureCount < requiredTextures.length || !Number.isSafeInteger(asset?.textureBudget?.maximumTextureEdge) || asset.textureBudget.maximumTextureEdge <= 0 || asset.textureBudget.maximumTextureEdge > maximumTextureEdge) errors.push(`${id || "<asset>"} production texture budget is invalid.`);
        if (!Number.isSafeInteger(asset?.modelVersion) || asset.modelVersion < 1 || /(?:prototype|stylized|unreviewed|not-scientifically-reviewed)/i.test(String(asset.reconstructionConfidence))) errors.push(`${id || "<asset>"} production reconstruction metadata is not approved.`);
        if (asset?.scientificReview?.status !== "approved" || !/^https:\/\//i.test(String(asset?.scientificReview?.sourceUrl || ""))) errors.push(`${id || "<asset>"} needs an approved scientific review record.`);
        if (receipt) {
          const evidence = Array.isArray(receipt.assets) ? receipt.assets.find((entry) => entry.speciesId === speciesId && entry.assetId === id) : null;
          if (receipt.format !== "hh-eonwild-production-creature-provenance" || receipt.version !== 1 || receipt.productionApproved !== true || receipt.license !== asset.license || receipt.originalAuthor !== asset.author || !evidence || evidence.filePath !== asset.filePath || evidence.byteSize !== asset.byteSize || evidence.sha256 !== asset.sha256 || JSON.stringify(normalizedAnimationNames(evidence.animations)) !== JSON.stringify(declaredClips)) errors.push(`${id || "<asset>"} lacks production-approved provenance evidence.`);
        } else errors.push(`${id || "<asset>"} lacks production-approved provenance evidence.`);
      }
    }
  }

  const runtimeBudgetBytes = Number(manifest?.environmentPipeline?.runtimeBudgetBytes);
  const environmentRuntimeBytes = environmentAssets.reduce((total, asset) => total + (Number.isSafeInteger(asset?.byteSize) ? asset.byteSize : 0), 0);
  if (!Number.isSafeInteger(runtimeBudgetBytes) || runtimeBudgetBytes <= 0 || environmentRuntimeBytes > runtimeBudgetBytes) errors.push("Environment runtime assets exceed or lack a valid byte budget.");
  if (manifest?.environmentPipeline?.runtimeBytes !== environmentRuntimeBytes) errors.push("Environment pipeline runtimeBytes does not match the manifest assets.");
  if (manifest?.environmentPipeline?.apiUserAgent !== "HH-EonWild-AssetPipeline/1.0 (+https://hoang8.com)") errors.push("Poly Haven API User-Agent contract is missing.");
  if (manifest?.environmentPipeline?.licenseUrl !== "https://polyhaven.com/license") errors.push("Poly Haven license evidence URL is missing.");
  if (manifest?.environmentPipeline?.gltfTransformVersion !== "4.4.2" || manifest?.environmentPipeline?.tangentSpace !== "MikkTSpace") errors.push("Environment glTF toolchain contract is missing or unpinned.");
  for (const stage of ["official-api-discovery", "source-md5-verification", "gltf-bundle", "tangent-generation", "gltf-validation", "sha256", "manifest"]) {
    if (!manifest?.environmentPipeline?.stages?.includes(stage)) errors.push(`Missing environment pipeline stage: ${stage}`);
  }

  const pipelineProvenancePath = canonicalPath(root, manifest?.environmentPipeline?.provenancePath);
  let provenance = null;
  if (!pipelineProvenancePath || !fs.existsSync(pipelineProvenancePath) || !fs.statSync(pipelineProvenancePath).isFile()) errors.push("Environment pipeline provenance is missing or escapes the repository.");
  else try {
    provenance = JSON.parse(fs.readFileSync(pipelineProvenancePath, "utf8"));
  } catch {
    errors.push("Environment pipeline provenance is not valid JSON.");
  }
  if (provenance) {
    if (provenance.format !== "hh-eonwild-polyhaven-provenance" || provenance.version !== 1) errors.push("Unsupported Poly Haven provenance format/version.");
    if (provenance.apiUserAgent !== manifest.environmentPipeline.apiUserAgent) errors.push("Provenance API User-Agent does not match the manifest.");
    if (provenance.toolchain?.gltfTransform !== manifest.environmentPipeline.gltfTransformVersion || provenance.toolchain?.generatedTangents !== manifest.environmentPipeline.tangentSpace) errors.push("Provenance glTF toolchain does not match the manifest.");
    if (provenance.runtimeBytes !== environmentRuntimeBytes || provenance.runtimeBudgetBytes !== runtimeBudgetBytes) errors.push("Provenance byte budget does not match the manifest.");
    const provenanceAssets = new Map((Array.isArray(provenance.assets) ? provenance.assets : []).map((asset) => [asset.id, asset]));
    for (const asset of environmentAssets) {
      const evidence = provenanceAssets.get(asset.sourceAssetId);
      const evidenceAuthor = Array.isArray(evidence?.sourceInfo?.authors) ? evidence.sourceInfo.authors.map((author) => String(author || "").trim()).filter(Boolean).join("; ") : "";
      if (!evidence || evidenceAuthor !== asset.author || evidence.output !== asset.filePath || evidence.outputByteSize !== asset.byteSize || evidence.outputSha256 !== asset.sha256 || evidence.sourceFilesHash !== asset.sourceFilesHash || JSON.stringify(normalizedSourceFiles(evidence.sourceFiles)) !== JSON.stringify(normalizedSourceFiles(asset.sourceFiles))) errors.push(`${asset.id} does not match the Poly Haven provenance receipt.`);
    }
    if (provenanceAssets.size !== environmentAssets.length) errors.push("Poly Haven provenance contains unmanifested or missing environment assets.");
  }

  const productionSpecies = new Set(contracts.filter((contract) => contract.status === "production").map((contract) => contract.speciesId));
  for (const speciesId of productionSpecies) {
    if (!assets.some((asset) => asset.speciesId === speciesId && asset.type === "creature-glb" && asset.status === "production")) errors.push(`${speciesId} is marked production without an approved production creature GLB.`);
  }
  if (manifest?.verticalSlice?.productionModelsReady === true && productionSpecies.size !== supportedSpecies.size) errors.push("productionModelsReady cannot be true while placeholders remain.");

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    summary: Object.freeze({ assets: assets.length, environmentAssets: environmentAssets.length, prototypeCreatures: creatureAssets.filter((asset) => asset.status === "prototype").length, runtimeAssetBytes: environmentRuntimeBytes, creatureContracts: contracts.length, productionCreatures: productionSpecies.size, placeholders: contracts.length - productionSpecies.size })
  });
}

function readManifest(filePath = defaultManifestPath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

if (require.main === module) {
  const manifestPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultManifestPath;
  try {
    const result = validateManifest(readManifest(manifestPath));
    for (const warning of result.warnings) process.stdout.write(`WARN ${warning}\n`);
    if (!result.valid) {
      for (const error of result.errors) process.stderr.write(`ERROR ${error}\n`);
      process.exitCode = 1;
    } else process.stdout.write(`EonWild asset manifest valid: ${JSON.stringify(result.summary)}\n`);
  } catch (error) {
    process.stderr.write(`ERROR ${String(error?.message || error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({ canonicalPath, canonicalTextSha256, manifestRelativePath, readManifest, safePackagePath, sha256, validateManifest });
