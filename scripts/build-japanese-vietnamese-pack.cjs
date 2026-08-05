#!/usr/bin/env node
/*
 * Build the compact Japanese ⇄ Vietnamese pack from Kaikki/Wiktionary JSONL.
 * The generated pack keeps provenance and is intentionally marked source-derived,
 * not editorially reviewed. Source: https://kaikki.org/viwiktionary/ (CC BY-SA/GFDL).
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const jaFile = process.argv[2] || path.resolve(root, "..", "kaikki-japanese-vi.jsonl");
const viFile = process.argv[3] || path.resolve(root, "..", "kaikki-vietnamese.jsonl");
const output = path.resolve(root, "japanese-vietnamese-pack.js");
const JAPANESE = /[ぁ-んァ-ン一-龯々ー\u3400-\u9fff]/u;
const BAD_POS = new Set(["romanization", "name", "proper name", "punct", "punctuation"]);
const JAPANESE_POS = new Set(["noun", "verb", "adj", "adv", "intj", "phrase", "proverb", "pron", "conj", "particle", "affix", "prefix", "suffix", "num", "unknown"]);
const clean = (value) => String(value || "").replace(/<[^>]+>/g, "").replace(/\{\{[^}]+\}\}/g, "").replace(/\[\[|\]\]/g, "").replace(/\s+/g, " ").trim().slice(0, 420);
const unique = (values) => [...new Set(values.map(clean).filter(Boolean))];
const isJapanese = (value) => JAPANESE.test(String(value || "")) && String(value).length <= 80;
const canonical = (row) => row.forms?.find((form) => form.tags?.includes("canonical"))?.form || row.word;
const kanaFrom = (row) => {
  const form = row.forms?.find((item) => item.tags?.includes("canonical"));
  const ruby = form?.ruby?.map((pair) => pair?.[1] || "").join("");
  if (ruby && /[ぁ-んァ-ン]/u.test(ruby)) return ruby;
  return /^[ぁ-んァ-ンー]+$/u.test(String(row.word || "")) ? row.word : "";
};
const romajiFrom = (row) => row.forms?.find((form) => form.tags?.includes("romanization"))?.form || "";
const idFor = (word, kana) => `vi-${[word, kana].join("-").replace(/[^a-z0-9ぁ-んァ-ン一-龯々ー\u3400-\u9fff-]/giu, "").slice(0, 55)}`;
const rows = new Map();
const add = (item) => {
  if (!item.word || !isJapanese(item.word)) return;
  const key = `${item.word}\u0000${item.kana || ""}`;
  const existing = rows.get(key);
  if (!existing) { rows.set(key, { ...item, id: idFor(item.word, item.kana || "") }); return; }
  existing.meaning = unique([existing.meaning, item.meaning]).join("; ").slice(0, 500);
  existing.example ||= item.example;
  existing.exampleVi ||= item.exampleVi;
  existing.romaji ||= item.romaji;
};

const jaLines = fs.readFileSync(jaFile, "utf8").split(/\r?\n/u).filter(Boolean);
for (const line of jaLines) {
  let row; try { row = JSON.parse(line); } catch { continue; }
  const word = canonical(row);
  if (!JAPANESE_POS.has(row.pos) || BAD_POS.has(row.pos) || !isJapanese(word)) continue;
  const meanings = unique((row.senses || []).flatMap((sense) => sense.glosses || []));
  if (!meanings.length) continue;
  const example = clean((row.senses || []).flatMap((sense) => sense.examples || []).find((item) => JAPANESE.test(item.text || ""))?.text || "");
  add({ word, kana: kanaFrom(row), romaji: romajiFrom(row), meaning: meanings.slice(0, 3).join("; "), pos: row.pos_title || row.pos, level: "N?", topic: "Kaikki · Nhật–Việt", example, exampleVi: "", meaningLanguage: "vi", meaningQuality: "source-derived", reviewStatus: "source-derived", jlptVerified: false, pitchVerified: false, source: "Kaikki/Wiktionary viwiktionary (2026-07-02)", license: "CC BY-SA 4.0 / GFDL" });
}

if (fs.existsSync(viFile)) {
  const viLines = fs.readFileSync(viFile, "utf8").split(/\r?\n/u).filter(Boolean);
  for (const line of viLines) {
    let row; try { row = JSON.parse(line); } catch { continue; }
    const vi = clean(row.word);
    if (!vi || vi.length > 80) continue;
    for (const translation of row.translations || []) {
      if (translation.lang_code !== "ja") continue;
      const word = clean(String(translation.word || "").replace(/^\.\.\./u, ""));
      if (!isJapanese(word)) continue;
      const kana = clean(translation.other || "");
      add({ word, kana, romaji: clean(translation.roman || ""), meaning: vi, pos: row.pos_title || row.pos || "Từ vựng", level: "N?", topic: "Kaikki · Việt–Nhật", example: "", exampleVi: "", meaningLanguage: "vi", meaningQuality: "source-derived", reviewStatus: "source-derived", jlptVerified: false, pitchVerified: false, source: "Kaikki/Wiktionary viwiktionary (2026-07-02)", license: "CC BY-SA 4.0 / GFDL" });
    }
  }
}

const pack = [...rows.values()].slice(0, 5000);
const header = `/* Generated from Kaikki/Wiktionary viwiktionary JSONL. CC BY-SA 4.0 / GFDL.\n   Source: https://kaikki.org/viwiktionary/ · extracted 2026-07-02.\n   Entries are source-derived and require editorial review before being called “đã kiểm duyệt”. */\n`;
fs.writeFileSync(output, `${header}globalThis.HHJapaneseVietnamesePack = Object.freeze(${JSON.stringify({ version: 1, language: "ja-vi", license: "CC BY-SA 4.0 / GFDL", source: "Kaikki/Wiktionary viwiktionary", extracted: "2026-07-02", count: pack.length, words: pack }, null, 0)});\n`, "utf8");
console.log(`Wrote ${pack.length} source-derived entries to ${output}`);
