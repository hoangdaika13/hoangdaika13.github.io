"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repositoryRoot = path.resolve(__dirname, "..");
const outputRoot = path.join(repositoryRoot, "assets", "eonwild", "environment");
const provenancePath = path.join(outputRoot, "polyhaven-provenance.v1.json");
const apiOrigin = "https://api.polyhaven.com";
const downloadOrigin = "https://dl.polyhaven.org";
const userAgent = "HH-EonWild-AssetPipeline/1.0 (+https://hoang8.com)";
const gltfTransformVersion = "4.4.2";
const runtimeBudgetBytes = 12 * 1024 * 1024;
const allowedAssets = Object.freeze([
  Object.freeze({ id: "fern_02", kind: "model", output: "fern-02-1k.glb" }),
  Object.freeze({ id: "rock_moss_set_01", kind: "model", output: "rock-moss-set-01-1k.glb" }),
  Object.freeze({ id: "quiver_tree_02", kind: "model", output: "quiver-tree-02-1k.glb" }),
  Object.freeze({ id: "kloofendal_48d_partly_cloudy_puresky", kind: "hdri", output: "kloofendal-partly-cloudy-puresky-1k.hdr" })
]);

function digest(algorithm, value) {
  return crypto.createHash(algorithm).update(value).digest("hex");
}

function hashFile(algorithm, filePath) {
  return digest(algorithm, fs.readFileSync(filePath));
}

function trustedUrl(rawUrl, expectedOrigin) {
  const url = new URL(String(rawUrl || ""));
  if (url.protocol !== "https:" || url.origin !== expectedOrigin || url.username || url.password || url.search || url.hash) {
    throw new Error(`Untrusted Poly Haven URL: ${url.href}`);
  }
  return url;
}

function safeRelativePath(rawPath) {
  const normalized = String(rawPath || "").replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").includes("..") || normalized.includes(":")) {
    throw new Error(`Unsafe package path: ${rawPath}`);
  }
  return normalized;
}

async function fetchApi(route) {
  const url = trustedUrl(`${apiOrigin}${route}`, apiOrigin);
  const response = await fetch(url, { headers: { "User-Agent": userAgent, Accept: "application/json" }, redirect: "error" });
  if (!response.ok) throw new Error(`Poly Haven API ${response.status}: ${url.href}`);
  return response.json();
}

async function download(record, destination) {
  const url = trustedUrl(record.url, downloadOrigin);
  if (!url.pathname.startsWith("/file/ph-assets/")) throw new Error(`Untrusted Poly Haven download path: ${url.href}`);
  const expectedSize = Number(record.size);
  const expectedMd5 = String(record.md5 || "").toLowerCase();
  if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0 || expectedSize > runtimeBudgetBytes) throw new Error(`Invalid source size: ${url.href}`);
  if (!/^[a-f0-9]{32}$/.test(expectedMd5)) throw new Error(`Invalid source MD5: ${url.href}`);
  const response = await fetch(url, { headers: { "User-Agent": userAgent }, redirect: "error" });
  if (!response.ok) throw new Error(`Poly Haven download ${response.status}: ${url.href}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength !== expectedSize) throw new Error(`Size mismatch for ${url.href}: ${bytes.byteLength} != ${expectedSize}`);
  const actualMd5 = digest("md5", bytes);
  if (actualMd5 !== expectedMd5) throw new Error(`MD5 mismatch for ${url.href}: ${actualMd5} != ${expectedMd5}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
  return Object.freeze({ path: destination, byteSize: bytes.byteLength, md5: actualMd5, url: url.href });
}

function runGltfTransform(args) {
  const cliCandidates = [
    process.env.GLTF_TRANSFORM_CLI_JS,
    path.join(process.env.APPDATA || "", "npm", "node_modules", "@gltf-transform", "cli", "bin", "cli.js")
  ].filter(Boolean);
  const cliPath = cliCandidates.find((candidate) => fs.existsSync(candidate));
  const command = cliPath ? process.execPath : (process.env.GLTF_TRANSFORM_BIN || "gltf-transform");
  const commandArgs = cliPath ? [cliPath, ...args] : args;
  const result = spawnSync(command, commandArgs, { cwd: repositoryRoot, encoding: "utf8", windowsHide: true, shell: !cliPath && process.platform === "win32" });
  if (result.error || result.status !== 0) {
    throw new Error(`gltf-transform ${args[0]} failed: ${result.error?.message || result.stderr || result.stdout || result.status}`);
  }
  return String(result.stdout || result.stderr || "").trim();
}

function sourceReceipt(relativePath, file) {
  return Object.freeze({
    path: safeRelativePath(relativePath),
    url: file.url,
    byteSize: file.byteSize,
    md5: file.md5
  });
}

function removeVerifiedTempRoot(tempRoot) {
  const tempDirectory = path.resolve(os.tmpdir());
  const target = path.resolve(String(tempRoot || ""));
  if (!target.startsWith(`${tempDirectory}${path.sep}`) || !path.basename(target).startsWith("hh-eonwild-polyhaven-")) {
    throw new Error(`Refusing to remove an unverified temporary path: ${target}`);
  }
  fs.rmSync(target, { recursive: true, force: true });
}

async function ingestModel(asset, tempRoot) {
  const [info, files] = await Promise.all([fetchApi(`/info/${asset.id}`), fetchApi(`/files/${asset.id}`)]);
  const packageRecord = files?.gltf?.["1k"]?.gltf;
  if (!packageRecord || typeof packageRecord.include !== "object") throw new Error(`No official 1K glTF package for ${asset.id}`);
  const workingRoot = path.join(tempRoot, asset.id);
  const rootName = `${asset.id}_1k.gltf`;
  const rootDownload = await download(packageRecord, path.join(workingRoot, rootName));
  const sourceFiles = [sourceReceipt(rootName, rootDownload)];
  for (const [relativePath, record] of Object.entries(packageRecord.include)) {
    const safePath = safeRelativePath(relativePath);
    const item = await download(record, path.join(workingRoot, ...safePath.split("/")));
    sourceFiles.push(sourceReceipt(safePath, item));
  }
  const outputPath = path.join(outputRoot, asset.output);
  const bundledPath = path.join(workingRoot, `${asset.id}-bundled.glb`);
  fs.mkdirSync(outputRoot, { recursive: true });
  runGltfTransform(["copy", path.join(workingRoot, rootName), bundledPath]);
  runGltfTransform(["tangents", bundledPath, outputPath]);
  const validation = runGltfTransform(["validate", outputPath]);
  if (!validation.includes("No errors found") || !validation.includes("No warnings found")) throw new Error(`glTF validation did not pass cleanly for ${asset.id}.`);
  const stat = fs.statSync(outputPath);
  return Object.freeze({
    id: asset.id,
    kind: asset.kind,
    output: path.relative(repositoryRoot, outputPath).replaceAll("\\", "/"),
    outputByteSize: stat.size,
    outputSha256: hashFile("sha256", outputPath),
    sourceFilesHash: String(info.files_hash || ""),
    sourceInfo: Object.freeze({
      name: String(info.name || asset.id),
      authors: Object.freeze(Object.keys(info.authors || {})),
      publishedAtUnix: Number(info.date_published || 0),
      maxResolution: Object.freeze(Array.isArray(info.max_resolution) ? info.max_resolution.map(Number) : []),
      polygonCount: Number(info.polycount || 0),
      dimensionsMillimeters: Object.freeze(Array.isArray(info.dimensions) ? info.dimensions.map(Number) : [])
    }),
    sourceFiles: Object.freeze(sourceFiles)
  });
}

async function ingestHdri(asset, tempRoot) {
  const [info, files] = await Promise.all([fetchApi(`/info/${asset.id}`), fetchApi(`/files/${asset.id}`)]);
  const record = files?.hdri?.["1k"]?.hdr;
  if (!record) throw new Error(`No official 1K Radiance HDR for ${asset.id}`);
  const tempPath = path.join(tempRoot, `${asset.id}_1k.hdr`);
  const item = await download(record, tempPath);
  const outputPath = path.join(outputRoot, asset.output);
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.copyFileSync(tempPath, outputPath);
  return Object.freeze({
    id: asset.id,
    kind: asset.kind,
    output: path.relative(repositoryRoot, outputPath).replaceAll("\\", "/"),
    outputByteSize: item.byteSize,
    outputSha256: hashFile("sha256", outputPath),
    sourceFilesHash: String(info.files_hash || ""),
    sourceInfo: Object.freeze({
      name: String(info.name || asset.id),
      authors: Object.freeze(Object.keys(info.authors || {})),
      publishedAtUnix: Number(info.date_published || 0),
      maxResolution: Object.freeze(Array.isArray(info.max_resolution) ? info.max_resolution.map(Number) : [])
    }),
    sourceFiles: Object.freeze([sourceReceipt(`${asset.id}_1k.hdr`, item)])
  });
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hh-eonwild-polyhaven-"));
  try {
    const installedVersion = runGltfTransform(["--version"]);
    if (installedVersion !== gltfTransformVersion) throw new Error(`glTF Transform ${gltfTransformVersion} is required; found ${installedVersion || "unknown"}.`);
    const assets = [];
    for (const asset of allowedAssets) assets.push(asset.kind === "model" ? await ingestModel(asset, tempRoot) : await ingestHdri(asset, tempRoot));
    const runtimeBytes = assets.reduce((total, asset) => total + asset.outputByteSize, 0);
    if (runtimeBytes > runtimeBudgetBytes) throw new Error(`Runtime asset budget exceeded: ${runtimeBytes} > ${runtimeBudgetBytes}`);
    const receipt = Object.freeze({
      format: "hh-eonwild-polyhaven-provenance",
      version: 1,
      generatedAt: new Date().toISOString(),
      provider: "Poly Haven",
      providerApi: apiOrigin,
      providerLicenseUrl: "https://polyhaven.com/license",
      apiUserAgent: userAgent,
      toolchain: Object.freeze({ gltfTransform: gltfTransformVersion, generatedTangents: "MikkTSpace" }),
      resolution: "1k",
      runtimeBudgetBytes,
      runtimeBytes,
      assets: Object.freeze(assets)
    });
    fs.writeFileSync(provenancePath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify({ runtimeBytes, runtimeBudgetBytes, provenancePath, assets: assets.map((asset) => ({ id: asset.id, output: asset.output, byteSize: asset.outputByteSize, sha256: asset.outputSha256 })) }, null, 2)}\n`);
  } finally {
    removeVerifiedTempRoot(tempRoot);
  }
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`${String(error?.stack || error)}\n`);
  process.exitCode = 1;
});

module.exports = Object.freeze({ allowedAssets, digest, gltfTransformVersion, removeVerifiedTempRoot, safeRelativePath, trustedUrl, userAgent });
