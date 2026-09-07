"use strict";

const fs = require("node:fs");
const path = require("node:path");

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const GLB_MAGIC = 0x46546c67;

function padded(buffer, fill) {
  const padding = (4 - (buffer.length % 4)) % 4;
  return padding ? Buffer.concat([buffer, Buffer.alloc(padding, fill)]) : buffer;
}

function externalizeTexture(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.readUInt32LE(0) !== GLB_MAGIC || bytes.readUInt32LE(4) !== 2) throw new Error(`Unsupported GLB: ${file}`);
  let cursor = 12;
  let document;
  let binary;
  while (cursor < bytes.length) {
    const length = bytes.readUInt32LE(cursor);
    const type = bytes.readUInt32LE(cursor + 4);
    const chunk = bytes.subarray(cursor + 8, cursor + 8 + length);
    if (type === JSON_CHUNK) document = JSON.parse(chunk.toString("utf8").trim());
    if (type === BIN_CHUNK) binary = chunk;
    cursor += 8 + length;
  }
  if (!document || !binary) throw new Error(`Missing GLB chunks: ${file}`);
  const image = document.images?.[0];
  if (!image) throw new Error(`Missing embedded image: ${file}`);
  let changed = false;
  const extension = image.mimeType === "image/jpeg" ? ".jpg" : ".png";
  const textureName = image.uri || `${path.basename(file, path.extname(file))}-texture${extension}`;
  const texturePath = path.resolve(path.dirname(file), textureName);
  if (!image.uri) {
    const view = document.bufferViews?.[image.bufferView];
    if (!view || Number(view.buffer || 0) !== 0) throw new Error(`Unsupported image buffer: ${file}`);
    const start = Number(view.byteOffset || 0);
    fs.writeFileSync(texturePath, binary.subarray(start, start + Number(view.byteLength || 0)));
    document.images[0] = { ...(image.name ? { name: image.name } : {}), uri: textureName };
    changed = true;
  }

  const armatureIndex = document.nodes?.findIndex((node) => node.name === "Cat.001") ?? -1;
  const catSkin = document.skins?.[0];
  if (path.basename(file).startsWith("cat-j-toastie") && armatureIndex >= 0 && catSkin?.skeleton !== armatureIndex) {
    catSkin.skeleton = armatureIndex;
    changed = true;
  }
  if (!changed) return { file, texture: texturePath, skipped: true };

  const json = padded(Buffer.from(JSON.stringify(document)), 0x20);
  const bin = padded(binary, 0x00);
  const output = Buffer.alloc(12 + 8 + json.length + 8 + bin.length);
  output.writeUInt32LE(GLB_MAGIC, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(json.length, 12);
  output.writeUInt32LE(JSON_CHUNK, 16);
  json.copy(output, 20);
  const binHeader = 20 + json.length;
  output.writeUInt32LE(bin.length, binHeader);
  output.writeUInt32LE(BIN_CHUNK, binHeader + 4);
  bin.copy(output, binHeader + 8);
  fs.writeFileSync(file, output);
  return { file, texture: texturePath, skipped: false };
}

const root = path.resolve(__dirname, "..");
const targets = ["cat-j-toastie.glb", "corgi-gobkit.glb"].map((name) => path.join(root, "assets", "focus-room", "pets", name));
for (const target of targets) console.log(JSON.stringify(externalizeTexture(target)));
