"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..");
const outputRoot = path.join(repositoryRoot, "assets", "eonwild", "creatures");
const provenancePath = path.join(outputRoot, "quaternius-provenance.v1.json");
const maximumFileBytes = 1024 * 1024;
const expectedAnimations = Object.freeze(["attack", "death", "idle", "jump", "run", "walk"]);
const assets = Object.freeze([
  Object.freeze({
    speciesId: "tyrannosaurus",
    title: "T-Rex",
    publicId: "UYtneO5FpF",
    resourceId: "34eed102-48f0-43dd-bc6f-ef7a6dfddfbb",
    output: "quaternius-tyrannosaurus-prototype.glb",
    triangles: 1820
  }),
  Object.freeze({
    speciesId: "triceratops",
    title: "Triceratops",
    publicId: "IGvrUqGrRM",
    resourceId: "6aa1f3ff-b9b3-4bb5-9d85-b2ffa514f0cc",
    output: "quaternius-triceratops-prototype.glb",
    triangles: 1280
  })
]);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function parseGlb(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 24 || bytes.toString("ascii", 0, 4) !== "glTF") throw new Error("Invalid GLB magic/header.");
  if (bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error("Invalid GLB version/length.");
  const jsonLength = bytes.readUInt32LE(12);
  if (jsonLength <= 0 || jsonLength > bytes.length - 20 || bytes.toString("ascii", 16, 20) !== "JSON") throw new Error("Invalid GLB JSON chunk.");
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8").replace(/\u0000+$/u, ""));
}

function normalizedAnimations(document) {
  return (Array.isArray(document.animations) ? document.animations : [])
    .map((animation) => String(animation?.name || "").split("_").pop().toLowerCase())
    .filter(Boolean)
    .sort();
}

function trustedUrl(rawUrl, expectedOrigin) {
  const url = new URL(String(rawUrl || ""));
  if (url.protocol !== "https:" || url.origin !== expectedOrigin || url.username || url.password) throw new Error(`Untrusted asset URL: ${url.href}`);
  return url;
}

async function fetchText(rawUrl, expectedOrigin) {
  const url = trustedUrl(rawUrl, expectedOrigin);
  const response = await fetch(url, { headers: { "User-Agent": "HH-EonWild-AssetPipeline/1.0 (+https://hoang8.com)" }, redirect: "error" });
  if (!response.ok) throw new Error(`Asset page ${response.status}: ${url.href}`);
  return response.text();
}

async function fetchBinary(rawUrl, expectedOrigin) {
  const url = trustedUrl(rawUrl, expectedOrigin);
  const response = await fetch(url, { headers: { "User-Agent": "HH-EonWild-AssetPipeline/1.0 (+https://hoang8.com)" }, redirect: "error" });
  if (!response.ok) throw new Error(`Asset download ${response.status}: ${url.href}`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maximumFileBytes) throw new Error(`Asset exceeds the ${maximumFileBytes}-byte prototype budget.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > maximumFileBytes) throw new Error(`Asset exceeds the ${maximumFileBytes}-byte prototype budget.`);
  return bytes;
}

async function ingest(asset) {
  const modelPage = `https://poly.pizza/m/${asset.publicId}`;
  const downloadUrl = `https://static.poly.pizza/${asset.resourceId}.glb`;
  const page = await fetchText(modelPage, "https://poly.pizza");
  if (!page.includes(`\"ResourceID\":\"${asset.resourceId}\"`) || !page.includes(`\"PublicID\":\"${asset.publicId}\"`)) throw new Error(`Poly Pizza identifiers changed for ${asset.speciesId}.`);
  if (!/Public Domain \(CC0\)/i.test(page) || !page.includes("Quaternius")) throw new Error(`CC0/author evidence is missing for ${asset.speciesId}.`);
  const bytes = await fetchBinary(downloadUrl, "https://static.poly.pizza");
  const document = parseGlb(bytes);
  const animations = normalizedAnimations(document);
  if (document.asset?.generator !== "FBX2glTF v0.9.7" || Number(document.skins?.length || 0) !== 1) throw new Error(`Unexpected rig/generator for ${asset.speciesId}.`);
  if (JSON.stringify(animations) !== JSON.stringify(expectedAnimations)) throw new Error(`Unexpected animation set for ${asset.speciesId}: ${animations.join(", ")}`);
  fs.mkdirSync(outputRoot, { recursive: true });
  const filePath = path.join(outputRoot, asset.output);
  fs.writeFileSync(filePath, bytes);
  return Object.freeze({
    speciesId: asset.speciesId,
    title: asset.title,
    modelPage,
    downloadUrl,
    resourceId: asset.resourceId,
    filePath: path.relative(repositoryRoot, filePath).replaceAll("\\", "/"),
    byteSize: bytes.length,
    sha256: sha256(bytes),
    triangles: asset.triangles,
    skins: 1,
    animations,
    validation: Object.freeze({
      errors: 0,
      warnings: Object.freeze(["NODE_SKINNED_MESH_NON_ROOT", "NODE_SKINNED_MESH_LOCAL_TRANSFORMS"])
    })
  });
}

async function main() {
  const records = [];
  for (const asset of assets) records.push(await ingest(asset));
  const receipt = {
    format: "hh-eonwild-creature-provenance",
    version: 1,
    recordedAt: new Date().toISOString(),
    provider: "Poly Pizza",
    originalAuthor: "Quaternius",
    originalPackUrl: "https://quaternius.itch.io/animated-lowpoly-dinosaurs",
    license: "CC0-1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    runtimeRole: "animated-low-poly-prototype",
    productionApproved: false,
    notes: [
      "These GLBs are the public Poly Pizza conversions of the official Quaternius CC0 Animated Dinosaur Pack.",
      "They contain skeletal animation but no photographic textures, production LOD chain, wetness mask or scientifically reviewed reconstruction.",
      "They are allowed only as bounded runtime prototypes and must not cause the production creature contracts to be marked ready."
    ],
    assets: records
  };
  fs.writeFileSync(provenancePath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(records.map(({ speciesId, filePath, byteSize, sha256: checksum }) => ({ speciesId, filePath, byteSize, sha256: checksum })), null, 2)}\n`);
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`${String(error?.stack || error)}\n`);
  process.exitCode = 1;
});

module.exports = Object.freeze({ assets, expectedAnimations, maximumFileBytes, normalizedAnimations, parseGlb, sha256, trustedUrl });
