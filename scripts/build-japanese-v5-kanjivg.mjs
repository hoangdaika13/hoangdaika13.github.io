import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const sourceDir = path.resolve(process.argv[2] || "");
if (!sourceDir || !fs.existsSync(sourceDir)) throw new Error("Pass the extracted KanjiVG kanji directory.");
require(path.join(root, "japanese-vocabulary-packs.js"));
require(path.join(root, "japanese-vocabulary-10k.js"));
require(path.join(root, "japanese-vietnamese-pack.js"));
require(path.join(root, "japanese-learning.js"));
require(path.join(root, "japanese-vocabulary-v4.js"));

const words = [...(globalThis.HHJapaneseVocabularyV4?.words || []), ...(globalThis.HHJapanese?.words || [])];
const frequency = new Map();
for (const row of words) for (const char of row.word || "") if (/^[\u3400-\u9fff]$/u.test(char)) frequency.set(char, (frequency.get(char) || 0) + 1);
for (const char of "未末土士待持") frequency.set(char, Math.max(100000, frequency.get(char) || 0));
const selected = [...frequency].sort((a,b) => b[1] - a[1]).slice(0, 2136).map(([char]) => char);
const rows = [];
for (const char of selected) {
  const code = char.codePointAt(0).toString(16).padStart(5, "0");
  const file = path.join(sourceDir, `${code}.svg`);
  if (!fs.existsSync(file)) continue;
  const svg = fs.readFileSync(file, "utf8");
  const paths = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*>/g)].map((match) => match[1]);
  const numbers = [...svg.matchAll(/<text\b[^>]*>(\d+)<\/text>/g)].map((match) => Number(match[1]));
  if (paths.length) rows.push([char, paths, numbers.length === paths.length ? numbers : paths.map((_, index) => index + 1)]);
}
const checksum = crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex").toUpperCase();
const payload = `/*! HH Japanese V5 KanjiVG stroke pack · CC BY-SA 3.0 */\n` +
  `(()=>{"use strict";const raw=${JSON.stringify(rows)},characters=Object.freeze(Object.fromEntries(raw.map(r=>[r[0],Object.freeze({char:r[0],paths:Object.freeze(r[1]),numbers:Object.freeze(r[2]),source:"KanjiVG",license:"CC BY-SA 3.0"})])));globalThis.HHJapaneseKanjiVGV5=Object.freeze({version:5,count:raw.length,checksum:${JSON.stringify(checksum)},license:"KanjiVG CC BY-SA 3.0",source:"https://github.com/KanjiVG/kanjivg",characters});})();\n`;
const output = path.join(root, "japanese-kanjivg-v5.js");
fs.writeFileSync(output, payload, "utf8");
console.log(JSON.stringify({ output, selected: selected.length, generated: rows.length, bytes: Buffer.byteLength(payload), checksum }, null, 2));
