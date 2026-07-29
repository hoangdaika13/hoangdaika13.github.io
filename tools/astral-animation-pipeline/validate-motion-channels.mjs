import fs from "node:fs";

const [glbPath, manifestPath] = process.argv.slice(2);
if (!glbPath || !manifestPath) throw new Error("Usage: node validate-motion-channels.mjs <motion.glb> <manifest.json>");

const bytes = fs.readFileSync(glbPath);
if (bytes.subarray(0, 4).toString("ascii") !== "glTF") throw new Error("Motion output is not GLB");
const jsonLength = bytes.readUInt32LE(12);
const jsonType = bytes.readUInt32LE(16);
if (jsonType !== 0x4e4f534a) throw new Error("GLB JSON chunk is missing");
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8").replace(/\0+$/g, "").trimEnd());
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const declared = new Set((manifest.clips || []).map((clip) => String(clip.name)));
const animations = Array.isArray(gltf.animations) ? gltf.animations : [];
if (animations.length !== declared.size) {
  throw new Error(`Animation count mismatch: GLB ${animations.length}, manifest ${declared.size}`);
}

let rotationChannels = 0;
let translationChannels = 0;
let translationValueRangeChecked = false;
const binaryHeader = 20 + jsonLength;
const binaryLength = bytes.length >= binaryHeader + 8 ? bytes.readUInt32LE(binaryHeader) : 0;
const binaryType = bytes.length >= binaryHeader + 8 ? bytes.readUInt32LE(binaryHeader + 4) : 0;
const binary = binaryType === 0x004e4942 ? bytes.subarray(binaryHeader + 8, binaryHeader + 8 + binaryLength) : null;

function inspectTranslationAccessor(accessorIndex, label) {
  const accessor = gltf.accessors?.[accessorIndex];
  const view = gltf.bufferViews?.[accessor?.bufferView];
  if (!binary || !accessor || !view || view.extensions?.EXT_meshopt_compression) return;
  if (accessor.componentType !== 5126 || accessor.type !== "VEC3" || accessor.sparse) {
    throw new Error(`${label} translation output must be a dense FLOAT VEC3 accessor`);
  }
  const stride = Number(view.byteStride || 12);
  const start = Number(view.byteOffset || 0) + Number(accessor.byteOffset || 0);
  let maxAbs = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let frame = 0; frame < accessor.count; frame += 1) {
    const offset = start + frame * stride;
    const x = binary.readFloatLE(offset);
    const y = binary.readFloatLE(offset + 4);
    const z = binary.readFloatLE(offset + 8);
    if (![x, y, z].every(Number.isFinite)) throw new Error(`${label} contains a non-finite Hips translation`);
    maxAbs = Math.max(maxAbs, Math.abs(x), Math.abs(y), Math.abs(z));
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  // VALID avatars are about 0.02 source units tall before runtime fitting.
  // Anything above this generous ceiling is a unit/space conversion failure.
  if (maxAbs > 0.1 || maxY - minY > 0.08 || maxZ - minZ > 0.08) {
    throw new Error(`${label} Hips translation is unsafe: max=${maxAbs}, ySpan=${maxY - minY}, zSpan=${maxZ - minZ}`);
  }
  translationValueRangeChecked = true;
}
for (const animation of animations) {
  if (!declared.has(String(animation.name))) throw new Error(`Undeclared animation: ${animation.name}`);
  for (const channel of animation.channels || []) {
    const path = String(channel.target?.path || "");
    const nodeName = String(gltf.nodes?.[channel.target?.node]?.name || "");
    if (path === "scale" || path === "weights") {
      throw new Error(`${animation.name} contains forbidden ${path} channel on ${nodeName}`);
    }
    if (path === "translation") {
      if (nodeName !== "Hips") throw new Error(`${animation.name} translates non-Hips node ${nodeName}`);
      inspectTranslationAccessor(animation.samplers?.[channel.sampler]?.output, animation.name);
      translationChannels += 1;
    } else if (path === "rotation") {
      rotationChannels += 1;
    } else {
      throw new Error(`${animation.name} contains unsupported channel ${path}`);
    }
  }
}

if (!rotationChannels) throw new Error("Motion output contains no rotation channels");
if (translationChannels !== 0 && translationChannels !== animations.length) {
  throw new Error(`Hips translation must be absent or present once per clip, received ${translationChannels}/${animations.length}`);
}
console.log(JSON.stringify({ animations: animations.length, rotationChannels, translationChannels, translationValueRangeChecked, safe: true }));
