"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..");
const defaultManifestPath = path.join(repositoryRoot, "assets", "eonwild", "asset-manifest.v1.json");
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,95}$/;

function canonicalPath(root, relativePath) {
  const value = String(relativePath || "").replaceAll("\\", "/");
  if (!value || value.startsWith("/") || value.includes(":") || value.split("/").includes("..")) return null;
  const absolute = path.resolve(root, value);
  return absolute === root || absolute.startsWith(`${root}${path.sep}`) ? absolute : null;
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function validateManifest(manifest, options = {}) {
  const root = path.resolve(options.root || repositoryRoot);
  const errors = [];
  const warnings = [];
  const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
  const contracts = Array.isArray(manifest?.creatureContracts) ? manifest.creatureContracts : [];
  const requiredFields = Array.isArray(manifest?.requiredAssetFields) ? manifest.requiredAssetFields : [];
  const approvedLicenses = new Set(manifest?.productionPipeline?.approvedLicenses || []);
  const supportedSpecies = new Set(manifest?.verticalSlice?.supportedSpecies || []);

  if (manifest?.format !== "hh-eonwild-asset-manifest" || manifest?.version !== 1) errors.push("Unsupported EonWild asset manifest format/version.");
  if (manifest?.policy?.humanContentAllowed !== false) errors.push("Human content must remain disabled.");
  if (manifest?.policy?.unknownLicenseAllowed !== false) errors.push("Unknown licenses must remain disabled.");
  if (manifest?.productionPipeline?.status !== "contract-ready") errors.push("Production pipeline contract is missing.");
  for (const stage of ["blender", "gltf-validation", "meshopt", "ktx2", "manifest", "browser-qa"]) {
    if (!manifest?.productionPipeline?.stages?.includes(stage)) errors.push(`Missing production stage: ${stage}`);
  }
  if (!manifest?.requiredCreatureTextures?.includes("wetness-dirt-mask")) errors.push("Creature wetness/dirt texture contract is missing.");
  for (const clip of ["idle", "walk", "run", "turn-left", "turn-right", "injured", "death", "nest", "care-young"]) {
    if (!manifest?.requiredCreatureAnimations?.includes(clip)) errors.push(`Missing required animation clip: ${clip}`);
  }

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
  for (const asset of assets) {
    const id = String(asset?.id || "");
    if (!SAFE_ID_PATTERN.test(id)) errors.push(`Invalid asset id: ${id || "<empty>"}`);
    if (assetIds.has(id)) errors.push(`Duplicate asset id: ${id}`);
    assetIds.add(id);
    for (const field of requiredFields) if (asset?.[field] == null || asset[field] === "") errors.push(`${id || "<asset>"} is missing ${field}.`);
    if (!approvedLicenses.has(asset?.license)) errors.push(`${id || "<asset>"} uses an unapproved license.`);
    if (!/^https:\/\//i.test(String(asset?.sourceUrl || ""))) errors.push(`${id || "<asset>"} needs an HTTPS source URL.`);
    const filePath = canonicalPath(root, asset?.filePath);
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) errors.push(`${id || "<asset>"} file is missing or escapes the repository.`);
    else if (!SHA256_PATTERN.test(String(asset?.sha256 || "")) || sha256(filePath) !== asset.sha256) errors.push(`${id || "<asset>"} checksum does not match.`);
    if (/\b(?:human|person|homo)\b/i.test(JSON.stringify(asset))) errors.push(`${id || "<asset>"} violates the no-human policy.`);
  }

  const productionSpecies = new Set(contracts.filter((contract) => contract.status === "production").map((contract) => contract.speciesId));
  for (const speciesId of productionSpecies) {
    if (!assets.some((asset) => asset.speciesId === speciesId && asset.type === "creature-glb")) errors.push(`${speciesId} is marked production without an approved creature GLB.`);
  }
  if (manifest?.verticalSlice?.productionModelsReady === true && productionSpecies.size !== supportedSpecies.size) errors.push("productionModelsReady cannot be true while placeholders remain.");

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    summary: Object.freeze({ assets: assets.length, creatureContracts: contracts.length, productionCreatures: productionSpecies.size, placeholders: contracts.length - productionSpecies.size })
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

module.exports = Object.freeze({ canonicalPath, readManifest, sha256, validateManifest });
