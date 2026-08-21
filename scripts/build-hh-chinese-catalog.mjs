#!/usr/bin/env node
/**
 * Build the lazy HH Chinese catalog from CVDICT.u8.
 * Usage:
 *   node scripts/build-hh-chinese-catalog.mjs CVDICT.u8 assets/chinese
 *
 * The generated catalog is intentionally kept separate from the 58-entry
 * learning deck. It is a lookup source, not an official HSK syllabus.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";

const inputPath = process.argv[2];
const outputDir = process.argv[3] || "assets/chinese";
const targetCount = 50000;
if (!inputPath || !fs.existsSync(inputPath)) throw new Error("CVDICT input file is required.");

const lines = fs.readFileSync(inputPath, "utf8").split(/\r?\n/);
const entries = [];
const seen = new Set();
for (const line of lines) {
  if (line.startsWith("#")) continue;
  const match = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.*)\/$/);
  if (!match) continue;
  const traditional = match[1].trim();
  const simplified = match[2].trim();
  const pinyin = match[3].trim();
  const meaning = match[4].split("/").map((part) => part.trim()).filter(Boolean).join(" · ");
  if (!simplified || !pinyin || !meaning || seen.has(simplified)) continue;
  // Keep the lookup catalog focused on Chinese headwords, not punctuation-only
  // dictionary symbols that also exist in CVDICT.
  if (!/[\u3400-\u9fff]/.test(simplified)) continue;
  if (simplified.length > 16 || /[\u0000-\u001f]/.test(simplified)) continue;
  seen.add(simplified);
  entries.push({
    id: "cv-" + String(entries.length + 1).padStart(5, "0"),
    hanzi: simplified,
    traditional,
    pinyin,
    meaning,
    level: "catalog",
    pos: "CVDICT",
    example: "",
    exampleVi: "",
    strokes: null,
    tones: []
  });
  if (entries.length >= targetCount) break;
}
if (entries.length !== targetCount) throw new Error("Expected " + targetCount + " unique entries, got " + entries.length + ".");

fs.mkdirSync(outputDir, { recursive: true });
const payload = JSON.stringify({ format: "hh-chinese-catalog", version: 1, count: entries.length, entries });
const outputPath = path.join(outputDir, "cvdict-50k.json.gz");
const compressed = zlib.gzipSync(Buffer.from(payload), { level: 9 });
fs.writeFileSync(outputPath, compressed);
const checksum = crypto.createHash("sha256").update(compressed).digest("hex");
fs.writeFileSync(path.join(outputDir, "cvdict-50k.meta.json"), JSON.stringify({
  format: "hh-chinese-catalog",
  count: entries.length,
  compressedBytes: compressed.length,
  sha256: checksum,
  source: "https://github.com/ph0ngp/CVDICT",
  sourceLicense: "CC BY-SA 4.0",
  generatedAt: new Date().toISOString()
}, null, 2) + "\n");
console.log(JSON.stringify({ outputPath, count: entries.length, compressedBytes: compressed.length, sha256: checksum }, null, 2));
