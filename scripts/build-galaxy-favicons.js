"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const brand = path.join(root, "assets", "brand");
const icoInputs = ["favicon-16.png", "favicon-32.png", "favicon-48.png"];

function readPng(name) {
  const bytes = fs.readFileSync(path.join(brand, name));
  if (bytes.subarray(1, 4).toString("ascii") !== "PNG") {
    throw new Error(`${name} is not a PNG file`);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== height || ![16, 32, 48].includes(width)) {
    throw new Error(`${name} must be a square 16, 32 or 48 pixel icon`);
  }
  return { bytes, width, height };
}

function buildIco(images) {
  const headerSize = 6 + images.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = headerSize;
  images.forEach((image, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(image.width === 256 ? 0 : image.width, entry);
    header.writeUInt8(image.height === 256 ? 0 : image.height, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.bytes.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.bytes.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.bytes)]);
}

const images = icoInputs.map(readPng);
fs.writeFileSync(path.join(brand, "favicon.ico"), buildIco(images));
fs.copyFileSync(path.join(brand, "pwa-192.png"), path.join(brand, "icon-192.png"));
fs.copyFileSync(path.join(brand, "pwa-512.png"), path.join(brand, "icon-512.png"));

console.log("Built favicon.ico (16/32/48) and PWA icon aliases (192/512).");
