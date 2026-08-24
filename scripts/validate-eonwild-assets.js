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
const FIXED_APPROVED_LICENSES = Object.freeze(["CC0-1.0", "CC-BY-4.0", "Apache-2.0", "original-proprietary"]);
const GLB_BINARY_CHUNKS = new WeakMap();
const ACCESSOR_COMPONENT_BYTES = Object.freeze({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 });
const ACCESSOR_TYPE_COMPONENTS = Object.freeze({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 });
const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/ktx2"]);

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
    return url.protocol === "https:" && url.origin === origin && !url.username && !url.password && !url.search && !url.hash ? url : null;
  } catch {
    return null;
  }
}

function safeHttpsUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash ? url : null;
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
  if (bytes.length < 20 || bytes.toString("ascii", 0, 4) !== "glTF") throw new Error("Invalid GLB header.");
  if (bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error("Invalid GLB version or length.");
  let offset = 12;
  let jsonBytes = null;
  let binaryChunk = null;
  let chunkIndex = 0;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error("Invalid GLB chunk header.");
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    offset += 8;
    if (!Number.isSafeInteger(chunkLength) || chunkLength <= 0 || chunkLength % 4 !== 0 || offset + chunkLength > bytes.length) throw new Error("Invalid GLB chunk length.");
    const chunk = bytes.subarray(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === 0x4e4f534a) {
      if (jsonBytes || chunkIndex !== 0) throw new Error("Invalid or duplicate GLB JSON chunk.");
      jsonBytes = chunk;
    } else if (chunkType === 0x004e4942) {
      if (binaryChunk) throw new Error("Duplicate GLB BIN chunk.");
      binaryChunk = chunk;
    }
    chunkIndex += 1;
  }
  if (!jsonBytes) throw new Error("Missing GLB JSON chunk.");
  const document = JSON.parse(jsonBytes.toString("utf8").replace(/[\u0000\u0020]+$/u, ""));
  if (!document || typeof document !== "object" || Array.isArray(document)) throw new Error("Invalid GLB JSON document.");
  GLB_BINARY_CHUNKS.set(document, binaryChunk);
  return document;
}

function decodeDataUri(uri, maximumBytes = 64 * 1024 * 1024) {
  const value = String(uri || "");
  if (value.length > Math.ceil(maximumBytes * 1.5)) return null;
  const match = /^data:([^;,]+);base64,([a-z0-9+/]*={0,2})$/i.exec(value);
  if (!match || !SUPPORTED_IMAGE_MIME_TYPES.has(match[1].toLowerCase()) && match[1].toLowerCase() !== "application/octet-stream") return null;
  const bytes = Buffer.from(match[2], "base64");
  return bytes.length <= maximumBytes ? Object.freeze({ bytes, mimeType: match[1].toLowerCase() }) : null;
}

function resolveBufferBytes(document, bufferIndex, binaryChunk) {
  const buffers = Array.isArray(document?.buffers) ? document.buffers : [];
  const buffer = buffers[bufferIndex];
  if (!buffer || !Number.isSafeInteger(buffer.byteLength) || buffer.byteLength <= 0) return null;
  let bytes = null;
  if (typeof buffer.uri === "string") bytes = decodeDataUri(buffer.uri)?.bytes || null;
  else if (bufferIndex === 0 && Buffer.isBuffer(binaryChunk)) bytes = binaryChunk;
  return bytes && bytes.length >= buffer.byteLength ? bytes.subarray(0, buffer.byteLength) : null;
}

function resolveBufferView(document, bufferViewIndex, binaryChunk) {
  const bufferViews = Array.isArray(document?.bufferViews) ? document.bufferViews : [];
  const view = bufferViews[bufferViewIndex];
  if (!view || !Number.isSafeInteger(view.buffer) || !Number.isSafeInteger(view.byteLength) || view.byteLength <= 0) return null;
  const bytes = resolveBufferBytes(document, view.buffer, binaryChunk);
  const byteOffset = view.byteOffset == null ? 0 : view.byteOffset;
  if (!bytes || !Number.isSafeInteger(byteOffset) || byteOffset < 0 || byteOffset + view.byteLength > bytes.length) return null;
  return Object.freeze({ bytes: bytes.subarray(byteOffset, byteOffset + view.byteLength), byteStride: view.byteStride });
}

function inspectAccessor(document, accessorIndex, binaryChunk) {
  const accessors = Array.isArray(document?.accessors) ? document.accessors : [];
  const accessor = accessors[accessorIndex];
  const componentBytes = ACCESSOR_COMPONENT_BYTES[accessor?.componentType];
  const componentCount = ACCESSOR_TYPE_COMPONENTS[accessor?.type];
  if (!accessor || !componentBytes || !componentCount || !Number.isSafeInteger(accessor.count) || accessor.count <= 0 || !Number.isSafeInteger(accessor.bufferView)) return null;
  const view = resolveBufferView(document, accessor.bufferView, binaryChunk);
  const elementBytes = componentBytes * componentCount;
  const stride = view?.byteStride == null ? elementBytes : view.byteStride;
  const byteOffset = accessor.byteOffset == null ? 0 : accessor.byteOffset;
  if (!view || !Number.isSafeInteger(stride) || stride < elementBytes || stride % componentBytes !== 0 || !Number.isSafeInteger(byteOffset) || byteOffset < 0 || byteOffset + (accessor.count - 1) * stride + elementBytes > view.bytes.length) return null;
  return Object.freeze({ accessor, bytes: view.bytes, byteOffset, componentBytes, componentCount, elementBytes, stride });
}

function readAnimationTimes(accessorEvidence) {
  const { accessor, bytes, byteOffset, stride } = accessorEvidence || {};
  if (!accessor || accessor.componentType !== 5126 || accessor.type !== "SCALAR" || accessor.count < 2) return null;
  const values = [];
  for (let index = 0; index < accessor.count; index += 1) {
    const value = bytes.readFloatLE(byteOffset + index * stride);
    if (!Number.isFinite(value) || index > 0 && value <= values[index - 1]) return null;
    values.push(value);
  }
  return values;
}

function accessorHasFiniteFloatValues(accessorEvidence) {
  const { accessor, bytes, byteOffset, stride, componentCount } = accessorEvidence || {};
  if (!accessor || accessor.componentType !== 5126) return false;
  for (let index = 0; index < accessor.count; index += 1) {
    for (let component = 0; component < componentCount; component += 1) {
      if (!Number.isFinite(bytes.readFloatLE(byteOffset + index * stride + component * 4))) return false;
    }
  }
  return true;
}

function imageDimensions(bytes, mimeType) {
  if (!Buffer.isBuffer(bytes)) return null;
  if (mimeType === "image/png" && bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString("ascii", 12, 16) === "IHDR") {
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (mimeType === "image/ktx2" && bytes.length >= 28 && bytes.subarray(0, 12).equals(Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    const width = bytes.readUInt32LE(20);
    const height = bytes.readUInt32LE(24);
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (mimeType === "image/webp" && bytes.length >= 30 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    const format = bytes.toString("ascii", 12, 16);
    if (format === "VP8X") return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    if (format === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) return { width: 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]), height: 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | (bytes[22] >> 6)) };
    if (format === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (mimeType === "image/jpeg" && bytes.length >= 10 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset++];
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
      if (offset + 2 > bytes.length) break;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) {
        const height = bytes.readUInt16BE(offset + 3);
        const width = bytes.readUInt16BE(offset + 5);
        return width > 0 && height > 0 ? { width, height } : null;
      }
      offset += length;
    }
  }
  return null;
}

function inspectProductionGlb(document, options = {}) {
  const nodes = Array.isArray(document?.nodes) ? document.nodes : [];
  const meshes = Array.isArray(document?.meshes) ? document.meshes : [];
  const materials = Array.isArray(document?.materials) ? document.materials : [];
  const images = Array.isArray(document?.images) ? document.images : [];
  const textures = Array.isArray(document?.textures) ? document.textures : [];
  const samplers = Array.isArray(document?.samplers) ? document.samplers : [];
  const binaryChunk = Buffer.isBuffer(options.binaryChunk) ? options.binaryChunk : GLB_BINARY_CHUNKS.get(document);
  const issues = [];
  const validIndex = (value, list) => Number.isSafeInteger(value) && value >= 0 && value < list.length;
  const validMesh = (meshIndex) => {
    const mesh = meshes[meshIndex];
    return validIndex(meshIndex, meshes) && Array.isArray(mesh?.primitives) && mesh.primitives.length > 0 && mesh.primitives.every((primitive) => {
      if (!primitive || typeof primitive !== "object" || !validIndex(primitive.attributes?.POSITION, Array.isArray(document?.accessors) ? document.accessors : [])) return false;
      const position = inspectAccessor(document, primitive.attributes.POSITION, binaryChunk);
      if (!position || position.accessor.componentType !== 5126 || position.accessor.type !== "VEC3" || position.accessor.count < 3) return false;
      if (primitive.indices != null) {
        const indices = inspectAccessor(document, primitive.indices, binaryChunk);
        if (!indices || indices.accessor.type !== "SCALAR" || ![5121, 5123, 5125].includes(indices.accessor.componentType) || indices.accessor.count < 3) return false;
      }
      return primitive.material == null || validIndex(primitive.material, materials);
    });
  };
  const namedMeshes = Array.from({ length: 4 }, () => new Set());
  const collectNamedMesh = (name, meshIndex) => {
    const match = /(?:^|[^a-z0-9])lod[_-]?([0-3])(?:[^0-9]|$)/i.exec(String(name || ""));
    if (match && validMesh(meshIndex)) namedMeshes[Number(match[1])].add(meshIndex);
  };
  nodes.forEach((node) => collectNamedMesh(node?.name, node?.mesh));
  meshes.forEach((mesh, meshIndex) => collectNamedMesh(mesh?.name, meshIndex));
  const lodCandidates = [];
  if (namedMeshes.every((entries) => entries.size === 1)) lodCandidates.push(namedMeshes.map((entries) => [...entries][0]));
  for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
    const node = nodes[nodeIndex];
    const ids = node?.extensions?.MSFT_lod?.ids;
    if (!Array.isArray(ids) || ids.length < 3) continue;
    const chainNodes = [nodeIndex, ...ids.slice(0, 3)];
    if (new Set(chainNodes).size !== 4 || !chainNodes.every((index) => validIndex(index, nodes))) continue;
    const chainMeshes = chainNodes.map((index) => nodes[index]?.mesh);
    if (chainMeshes.every(validMesh)) lodCandidates.push(chainMeshes);
  }
  const lodMeshIndices = lodCandidates.find((candidate) => new Set(candidate).size === 4) || [];
  const lodChainValid = lodMeshIndices.length === 4;
  if (!lodChainValid) issues.push("LOD0-LOD3 must resolve to four distinct valid meshes with backed POSITION accessors.");

  const imageEvidence = images.map((image, imageIndex) => {
    let bytes = null;
    let mimeType = String(image?.mimeType || "").toLowerCase();
    const hasUri = typeof image?.uri === "string";
    const hasBufferView = image?.bufferView != null;
    if (hasUri === hasBufferView) {
      issues.push(`Image ${imageIndex} must use exactly one embedded URI or bufferView source.`);
      return Object.freeze({ valid: false, width: 0, height: 0 });
    }
    if (hasUri) {
      const decoded = decodeDataUri(image.uri);
      bytes = decoded?.bytes || null;
      mimeType = mimeType || decoded?.mimeType || "";
    } else {
      bytes = resolveBufferView(document, image.bufferView, binaryChunk)?.bytes || null;
    }
    const dimensions = SUPPORTED_IMAGE_MIME_TYPES.has(mimeType) ? imageDimensions(bytes, mimeType) : null;
    const valid = Boolean(bytes && dimensions && dimensions.width > 0 && dimensions.height > 0);
    if (!valid) issues.push(`Image ${imageIndex} is not a self-contained PNG/JPEG/WebP/KTX2 source with readable dimensions.`);
    return Object.freeze({ valid, mimeType, width: dimensions?.width || 0, height: dimensions?.height || 0 });
  });

  const textureEvidence = textures.map((texture, textureIndex) => {
    const sourceIndices = [texture?.source, texture?.extensions?.KHR_texture_basisu?.source, texture?.extensions?.EXT_texture_webp?.source].filter((value) => value != null);
    const sourceValid = sourceIndices.length > 0 && sourceIndices.every((value) => validIndex(value, images) && imageEvidence[value]?.valid);
    const samplerValid = texture?.sampler == null || validIndex(texture.sampler, samplers);
    const valid = sourceValid && samplerValid;
    if (!valid) issues.push(`Texture ${textureIndex} has an invalid sampler, image index or image source.`);
    return Object.freeze({ valid, sourceIndices: Object.freeze(sourceIndices.slice()) });
  });

  const channelSet = new Set();
  let textureInfosValid = true;
  const textureInfoValid = (textureInfo) => Boolean(textureInfo && validIndex(textureInfo.index, textures) && textureEvidence[textureInfo.index]?.valid && (textureInfo.texCoord == null || Number.isSafeInteger(textureInfo.texCoord) && textureInfo.texCoord >= 0) && (textureInfo.extensions?.KHR_texture_transform?.texCoord == null || Number.isSafeInteger(textureInfo.extensions.KHR_texture_transform.texCoord) && textureInfo.extensions.KHR_texture_transform.texCoord >= 0));
  const bindTextureChannel = (textureInfo, channel) => {
    if (textureInfo == null) return;
    if (!textureInfoValid(textureInfo)) {
      textureInfosValid = false;
      issues.push(`${channel} textureInfo does not resolve to a valid texture/image source.`);
    }
    else channelSet.add(channel);
  };
  const inspectAllTextureInfos = (value, path = "material", seen = new Set()) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (/texture$/i.test(key) && child && typeof child === "object" && !textureInfoValid(child)) {
        textureInfosValid = false;
        issues.push(`${childPath} does not resolve to a valid texture/image source.`);
      }
      inspectAllTextureInfos(child, childPath, seen);
    }
  };
  for (const material of materials) {
    const pbr = material?.pbrMetallicRoughness || {};
    bindTextureChannel(pbr.baseColorTexture, "albedo");
    bindTextureChannel(pbr.metallicRoughnessTexture, "roughness");
    bindTextureChannel(material?.normalTexture, "normal");
    bindTextureChannel(material?.occlusionTexture, "ao");
    const wetnessIndex = material?.extras?.eonwildTextureIndices?.["wetness-dirt-mask"];
    if (wetnessIndex != null) bindTextureChannel({ index: wetnessIndex }, "wetness-dirt-mask");
    inspectAllTextureInfos(material);
  }
  textures.forEach((texture, textureIndex) => {
    const imageNames = textureEvidence[textureIndex]?.sourceIndices.map((index) => images[index]?.name).join(" ") || "";
    if (textureEvidence[textureIndex]?.valid && /(?:wetness|wet|dirt)[-_ ]?(?:dirt|wetness|mask)?/i.test(`${texture?.name || ""} ${imageNames}`)) channelSet.add("wetness-dirt-mask");
  });

  const validAnimationClips = [];
  const animationNames = new Set();
  for (const animation of Array.isArray(document?.animations) ? document.animations : []) {
    const clipName = normalizedAnimationNames([animation])[0] || "";
    let animationValid = Boolean(clipName && !animationNames.has(clipName) && Array.isArray(animation?.channels) && animation.channels.length > 0 && Array.isArray(animation?.samplers) && animation.samplers.length > 0);
    if (clipName) animationNames.add(clipName);
    for (const channel of Array.isArray(animation?.channels) ? animation.channels : []) {
      const sampler = validIndex(channel?.sampler, animation.samplers) ? animation.samplers[channel.sampler] : null;
      const input = sampler && validIndex(sampler.input, Array.isArray(document?.accessors) ? document.accessors : []) ? inspectAccessor(document, sampler.input, binaryChunk) : null;
      const output = sampler && validIndex(sampler.output, Array.isArray(document?.accessors) ? document.accessors : []) ? inspectAccessor(document, sampler.output, binaryChunk) : null;
      const times = readAnimationTimes(input);
      const interpolation = sampler?.interpolation || "LINEAR";
      const requiredOutputCount = (interpolation === "CUBICSPLINE" ? 3 : 1) * (input?.accessor?.count || 0);
      const path = channel?.target?.path;
      const expectedOutputType = path === "rotation" ? "VEC4" : path === "weights" ? null : "VEC3";
      const outputCountValid = path === "weights" ? output?.accessor?.count >= requiredOutputCount && output.accessor.count % requiredOutputCount === 0 : output?.accessor?.count === requiredOutputCount;
      const channelValid = Boolean(sampler && ["LINEAR", "STEP", "CUBICSPLINE"].includes(interpolation) && times && output && outputCountValid && accessorHasFiniteFloatValues(output) && validIndex(channel?.target?.node, nodes) && ["translation", "rotation", "scale", "weights"].includes(path) && (!expectedOutputType || output.accessor.type === expectedOutputType) && (path !== "weights" || output.accessor.type === "SCALAR"));
      if (!channelValid) animationValid = false;
    }
    if (animationValid) validAnimationClips.push(clipName);
    else issues.push(`Animation ${clipName || "<unnamed>"} lacks valid channels, samplers, backed accessors or increasing keyframes.`);
  }
  const usedImageIndices = new Set(textureEvidence.flatMap((texture) => texture.sourceIndices));
  const maximumTextureEdge = [...usedImageIndices].reduce((maximum, index) => Math.max(maximum, imageEvidence[index]?.width || 0, imageEvidence[index]?.height || 0), 0);
  return Object.freeze({
    lodLevels: Object.freeze(lodChainValid ? [0, 1, 2, 3] : []),
    lodMeshIndices: Object.freeze(lodMeshIndices.slice()),
    lodChainValid,
    textureChannels: Object.freeze([...channelSet].sort()),
    textureCount: textures.length,
    textureReferencesValid: textureEvidence.every((texture) => texture.valid) && textureInfosValid,
    textureDimensionsValid: [...usedImageIndices].length > 0 && [...usedImageIndices].every((index) => imageEvidence[index]?.valid),
    maximumTextureEdge,
    validAnimationClips: Object.freeze(validAnimationClips.sort()),
    animationsValid: (Array.isArray(document?.animations) ? document.animations.length : 0) > 0 && validAnimationClips.length === document.animations.length,
    materialCount: materials.length,
    meshCount: meshes.length,
    issues: Object.freeze(issues)
  });
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
  const declaredApprovedLicenses = Array.isArray(manifest?.productionPipeline?.approvedLicenses) ? manifest.productionPipeline.approvedLicenses : [];
  const approvedLicenses = new Set(FIXED_APPROVED_LICENSES);
  const supportedSpecies = new Set(manifest?.verticalSlice?.supportedSpecies || []);
  const logicalSizeMeters = Number(manifest?.verticalSlice?.logicalSizeMeters);
  const streamingExtensionSizeMeters = Number(manifest?.verticalSlice?.streamingExtensionSizeMeters);
  const chunkSizeMeters = Number(manifest?.verticalSlice?.chunkSizeMeters);
  if (!Number.isSafeInteger(logicalSizeMeters) || logicalSizeMeters < 16384 || logicalSizeMeters > 32768 || !Number.isSafeInteger(chunkSizeMeters) || chunkSizeMeters < 64 || logicalSizeMeters % chunkSizeMeters !== 0) errors.push("EonWild world contract requires a chunk-aligned 16–32 km logical map.");
  if (!Number.isSafeInteger(streamingExtensionSizeMeters) || streamingExtensionSizeMeters < logicalSizeMeters || streamingExtensionSizeMeters > 32768 || streamingExtensionSizeMeters % chunkSizeMeters !== 0) errors.push("EonWild streaming extension must be chunk-aligned, no smaller than the logical map and at most 32 km.");

  if (manifest?.format !== "hh-eonwild-asset-manifest" || manifest?.version !== 1) errors.push("Unsupported EonWild asset manifest format/version.");
  if (manifest?.policy?.humanContentAllowed !== false) errors.push("Human content must remain disabled.");
  if (manifest?.policy?.unknownLicenseAllowed !== false) errors.push("Unknown licenses must remain disabled.");
  if (manifest?.policy?.externalRuntimeAssetsAllowed !== false) errors.push("Runtime assets must remain same-origin.");
  if (manifest?.productionPipeline?.status !== "contract-ready") errors.push("Production pipeline contract is missing.");
  if (declaredApprovedLicenses.length !== FIXED_APPROVED_LICENSES.length || declaredApprovedLicenses.some((license) => !approvedLicenses.has(license)) || FIXED_APPROVED_LICENSES.some((license) => !declaredApprovedLicenses.includes(license))) errors.push("Production license allowlist must match the fixed audited policy.");
  if (manifest?.productionPipeline?.defaultTextureEdge !== 4096 || manifest?.productionPipeline?.maximumTextureEdge !== 8192) errors.push("Production texture contract must use 4K by default and reserve 8K for Cinematic Personal assets.");
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
    if (!safeHttpsUrl(asset?.sourceUrl)) errors.push(`${id || "<asset>"} needs a credential-free immutable HTTPS source URL.`);
    if (!safeHttpsUrl(asset?.licenseUrl)) errors.push(`${id || "<asset>"} needs a credential-free immutable HTTPS license URL.`);
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
      if (!safeHttpsUrl(asset?.scientificSource)) errors.push(`${id || "<asset>"} needs a credential-free immutable HTTPS scientific source.`);
      if (!Number.isFinite(asset?.realScaleMeters) || asset.realScaleMeters <= 0) errors.push(`${id || "<asset>"} needs a positive real scale.`);
      if (!Array.isArray(asset?.lodLevels) || asset.lodLevels.length === 0 || asset.lodLevels.some((level) => !Number.isInteger(level) || level < 0 || level > 8)) errors.push(`${id || "<asset>"} needs bounded LOD levels.`);
      if (!asset?.textureBudget || typeof asset.textureBudget !== "object" || Array.isArray(asset.textureBudget)) errors.push(`${id || "<asset>"} needs a texture budget object.`);
      if (!String(asset?.reconstructionConfidence || "").trim()) errors.push(`${id || "<asset>"} needs reconstruction confidence.`);
      let creatureDocument = null;
      let productionGlbEvidence = null;
      if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        if (!String(asset?.filePath || "").toLowerCase().endsWith(".glb")) errors.push(`${id || "<asset>"} creature runtime file must be GLB.`);
        else try { creatureDocument = parseGlbDocument(filePath); }
        catch { errors.push(`${id || "<asset>"} creature GLB is structurally invalid.`); }
      }
      const declaredClips = normalizedAnimationNames(asset?.animationClips);
      const actualClips = normalizedAnimationNames(creatureDocument?.animations);
      if (creatureDocument) productionGlbEvidence = inspectProductionGlb(creatureDocument);
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
        if (!productionGlbEvidence?.lodChainValid || JSON.stringify(productionGlbEvidence.lodLevels) !== JSON.stringify(expectedLods) || new Set(productionGlbEvidence.lodMeshIndices).size !== 4) errors.push(`${id || "<asset>"} GLB does not contain an actual four-level LOD chain mapped to four distinct valid meshes.`);
        if (!requiredClips.every((clip) => declaredClips.includes(clip)) || !requiredClips.every((clip) => actualClips.includes(clip))) errors.push(`${id || "<asset>"} production animation set is incomplete.`);
        if (!productionGlbEvidence?.animationsValid || !requiredClips.every((clip) => productionGlbEvidence.validAnimationClips.includes(clip))) errors.push(`${id || "<asset>"} GLB production animations lack valid channels, samplers, backed accessors or increasing keyframes.`);
        if (!requiredTextures.every((channel) => declaredTextures.includes(channel))) errors.push(`${id || "<asset>"} production PBR texture channels are incomplete.`);
        if (!productionGlbEvidence || !requiredTextures.every((channel) => productionGlbEvidence.textureChannels.includes(channel))) errors.push(`${id || "<asset>"} GLB materials do not contain the required PBR texture evidence.`);
        if (!productionGlbEvidence?.textureReferencesValid) errors.push(`${id || "<asset>"} GLB texture samplers, indices or embedded image sources are invalid.`);
        if (!Number.isSafeInteger(asset?.textureBudget?.textureCount) || asset.textureBudget.textureCount < requiredTextures.length || !Number.isSafeInteger(asset?.textureBudget?.maximumTextureEdge) || asset.textureBudget.maximumTextureEdge <= 0 || asset.textureBudget.maximumTextureEdge > maximumTextureEdge) errors.push(`${id || "<asset>"} production texture budget is invalid.`);
        if (productionGlbEvidence && productionGlbEvidence.textureCount < requiredTextures.length) errors.push(`${id || "<asset>"} GLB texture inventory is smaller than the declared production texture budget.`);
        if (!productionGlbEvidence?.textureDimensionsValid || productionGlbEvidence.maximumTextureEdge <= 0 || productionGlbEvidence.maximumTextureEdge > asset?.textureBudget?.maximumTextureEdge) errors.push(`${id || "<asset>"} GLB embedded texture dimensions are missing, invalid or exceed the declared edge budget.`);
        if (!Number.isSafeInteger(asset?.modelVersion) || asset.modelVersion < 1 || /(?:prototype|stylized|unreviewed|not-scientifically-reviewed)/i.test(String(asset.reconstructionConfidence))) errors.push(`${id || "<asset>"} production reconstruction metadata is not approved.`);
        if (!safeHttpsUrl(asset?.sourceApiUrl)) errors.push(`${id || "<asset>"} production source download/API URL is missing or unsafe.`);
        if (asset?.scientificReview?.status !== "approved" || !safeHttpsUrl(asset?.scientificReview?.sourceUrl) || !SHA256_PATTERN.test(String(asset?.scientificReview?.sha256 || ""))) errors.push(`${id || "<asset>"} needs an approved checksummed scientific review record.`);
        if (receipt) {
          const evidence = Array.isArray(receipt.assets) ? receipt.assets.find((entry) => entry.speciesId === speciesId && entry.assetId === id) : null;
          const review = asset?.scientificReview || {};
          const evidenceReview = evidence?.scientificReview || {};
          if (receipt.format !== "hh-eonwild-production-creature-provenance" || receipt.version !== 1 || receipt.productionApproved !== true || receipt.license !== asset.license || receipt.licenseUrl !== asset.licenseUrl || receipt.originalAuthor !== asset.author || !evidence || evidence.filePath !== asset.filePath || evidence.byteSize !== asset.byteSize || evidence.sha256 !== asset.sha256 || evidence.sourceUrl !== asset.sourceUrl || evidence.sourceApiUrl !== asset.sourceApiUrl || evidence.licenseUrl !== asset.licenseUrl || evidence.scientificSource !== asset.scientificSource || evidenceReview.status !== review.status || evidenceReview.sourceUrl !== review.sourceUrl || evidenceReview.sha256 !== review.sha256 || JSON.stringify(normalizedAnimationNames(evidence.animations)) !== JSON.stringify(declaredClips) || JSON.stringify(evidence.lodLevels) !== JSON.stringify(asset.lodLevels) || JSON.stringify([...new Set(evidence.textureChannels || [])].sort()) !== JSON.stringify(declaredTextures) || JSON.stringify(evidence.textureBudget) !== JSON.stringify(asset.textureBudget)) errors.push(`${id || "<asset>"} lacks production-approved provenance evidence bound to source, license, LOD, PBR and scientific review.`);
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

module.exports = Object.freeze({ canonicalPath, canonicalTextSha256, inspectProductionGlb, manifestRelativePath, readManifest, safePackagePath, sha256, validateManifest });
