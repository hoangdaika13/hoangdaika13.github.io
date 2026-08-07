import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = path.resolve(process.argv[2] || "");
const output = path.resolve(root, "japanese-vocabulary-v4.js");
if (!input || !fs.existsSync(input)) throw new Error("Pass a jmdict-eng JSON file.");

require(path.join(root, "japanese-vocabulary-packs.js"));
require(path.join(root, "japanese-vocabulary-10k.js"));
require(path.join(root, "japanese-vietnamese-pack.js"));
require(path.join(root, "japanese-learning.js"));

const source = JSON.parse(fs.readFileSync(input, "utf8"));
const existing = [...(globalThis.HHJapanese?.words || []), ...(globalThis.HHJapaneseVietnamesePack?.words || [])];
const seen = new Set(existing.map((row) => `${row.word}\u0000${row.kana || ""}`));
const selectedIds = new Set();
const TARGET_NEW = 30000;

const blockedTags = new Set(["X", "vulg", "derog", "arch", "obs", "rare", "dated", "sens", "rK", "rk", "sK", "sk"]);
const blockedPos = new Set(["person", "surname", "given", "company", "organization", "place", "station", "product", "work", "ship", "dei", "tradem"]);
const unsafeMeaning = /\b(?:porn|sexual|intercourse|genitals?|penis|vagina|prostitut|fondling|canoodl|thong|fetish|rape|incest)\b/i;
const packLabels = Object.freeze({
  general: "General Japanese", life: "Life in Japan", business: "Business Japanese", career: "Career Japanese",
  collocation: "Collocation & Expression", onomatopoeia: "Onomatopoeia", keigo: "Keigo", counter: "Counter & Number"
});
const packTargets = Object.freeze({ general: 20000, life: 8000, business: 10000, career: 15000, collocation: 20000, onomatopoeia: 2000, keigo: 1500, counter: 600 });
const selectionQuotas = Object.freeze({ general: 12000, life: 4000, business: 2500, career: 4500, collocation: 4100, onomatopoeia: 1200, keigo: 1200, counter: 500 });
const careerFields = new Set(["comp", "internet", "med", "pharm", "surg", "dent", "engr", "civeng", "mech", "archit", "elec", "electr", "telec", "rail", "food", "agric", "law", "finc", "econ", "stockm", "photo", "audvid", "film", "print", "chem", "biol", "physics"]);
const lifeFields = new Set(["food", "rail", "cloth", "sports", "gardn", "weather", "geogr"]);
const businessFields = new Set(["bus", "econ", "finc", "stockm", "law", "politics"]);

const basicKana = {
  "あ":"a","い":"i","う":"u","え":"e","お":"o","か":"ka","き":"ki","く":"ku","け":"ke","こ":"ko","さ":"sa","し":"shi","す":"su","せ":"se","そ":"so","た":"ta","ち":"chi","つ":"tsu","て":"te","と":"to","な":"na","に":"ni","ぬ":"nu","ね":"ne","の":"no","は":"ha","ひ":"hi","ふ":"fu","へ":"he","ほ":"ho","ま":"ma","み":"mi","む":"mu","め":"me","も":"mo","や":"ya","ゆ":"yu","よ":"yo","ら":"ra","り":"ri","る":"ru","れ":"re","ろ":"ro","わ":"wa","を":"wo","ん":"n",
  "が":"ga","ぎ":"gi","ぐ":"gu","げ":"ge","ご":"go","ざ":"za","じ":"ji","ず":"zu","ぜ":"ze","ぞ":"zo","だ":"da","ぢ":"ji","づ":"zu","で":"de","ど":"do","ば":"ba","び":"bi","ぶ":"bu","べ":"be","ぼ":"bo","ぱ":"pa","ぴ":"pi","ぷ":"pu","ぺ":"pe","ぽ":"po",
  "ぁ":"a","ぃ":"i","ぅ":"u","ぇ":"e","ぉ":"o","ゔ":"vu"
};
const digraphs = {
  "きゃ":"kya","きゅ":"kyu","きょ":"kyo","しゃ":"sha","しゅ":"shu","しょ":"sho","ちゃ":"cha","ちゅ":"chu","ちょ":"cho","にゃ":"nya","にゅ":"nyu","にょ":"nyo","ひゃ":"hya","ひゅ":"hyu","ひょ":"hyo","みゃ":"mya","みゅ":"myu","みょ":"myo","りゃ":"rya","りゅ":"ryu","りょ":"ryo","ぎゃ":"gya","ぎゅ":"gyu","ぎょ":"gyo","じゃ":"ja","じゅ":"ju","じょ":"jo","びゃ":"bya","びゅ":"byu","びょ":"byo","ぴゃ":"pya","ぴゅ":"pyu","ぴょ":"pyo","てぃ":"ti","でぃ":"di","ふぁ":"fa","ふぃ":"fi","ふぇ":"fe","ふぉ":"fo","うぃ":"wi","うぇ":"we","うぉ":"wo"
};
const toHiragana = (value) => [...String(value || "").normalize("NFKC")].map((char) => {
  const code = char.charCodeAt(0);
  return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : char;
}).join("");
function romanize(value) {
  const chars = [...toHiragana(value)];
  let result = "";
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    const pair = `${char}${chars[index + 1] || ""}`;
    if (char === "っ") {
      const next = digraphs[`${chars[index + 1] || ""}${chars[index + 2] || ""}`] || basicKana[chars[index + 1]] || "";
      result += next[0] || "";
      continue;
    }
    if (char === "ー") { result += result.match(/[aeiou]$/)?.[0] || ""; continue; }
    if (digraphs[pair]) { result += digraphs[pair]; index += 1; continue; }
    result += basicKana[char] || char;
  }
  return result.replace(/n(?=[bmp])/g, "m");
}
const tagsOf = (entry) => new Set((entry.sense || []).flatMap((sense) => [...(sense.partOfSpeech || []), ...(sense.misc || []), ...(sense.field || []), ...(sense.dialect || [])]));
function classify(tags) {
  if (tags.has("on-mim")) return "onomatopoeia";
  if (["hon", "hum", "pol"].some((tag) => tags.has(tag))) return "keigo";
  if (tags.has("ctr") || tags.has("num")) return "counter";
  if ([...tags].some((tag) => businessFields.has(tag))) return "business";
  if ([...tags].some((tag) => careerFields.has(tag))) return "career";
  if ([...tags].some((tag) => lifeFields.has(tag))) return "life";
  if (["exp", "id", "proverb", "yoji"].some((tag) => tags.has(tag))) return "collocation";
  return "general";
}
function register(tags) {
  if (["hon", "hum", "pol"].some((tag) => tags.has(tag))) return "lịch sự/kính ngữ";
  if (["form", "poet", "quote"].some((tag) => tags.has(tag))) return "văn viết/trang trọng";
  if (["col", "sl", "fam", "net-sl", "m-sl"].some((tag) => tags.has(tag))) return "khẩu ngữ/thân mật";
  if ([...tags].some((tag) => businessFields.has(tag) || careerFields.has(tag))) return "công việc/chuyên ngành";
  return "trung tính";
}
function candidate(entry) {
  const tags = tagsOf(entry);
  if ([...tags].some((tag) => blockedTags.has(tag) || blockedPos.has(tag))) return null;
  const senses = (entry.sense || []).filter((sense) => !(sense.misc || []).some((tag) => blockedTags.has(tag)));
  const definitions = [...new Set(senses.flatMap((sense) => sense.gloss || []).filter((gloss) => gloss?.lang === "eng" && !gloss?.type).map((gloss) => String(gloss.text || "").trim()).filter(Boolean))];
  if (!definitions.length || definitions.some((text) => unsafeMeaning.test(text))) return null;
  const kanji = (entry.kanji || []).find((item) => item.common && !(item.tags || []).some((tag) => blockedTags.has(tag))) || (entry.kanji || []).find((item) => !(item.tags || []).some((tag) => blockedTags.has(tag)));
  const kana = (entry.kana || []).find((item) => item.common && !(item.tags || []).some((tag) => blockedTags.has(tag))) || (entry.kana || []).find((item) => !(item.tags || []).some((tag) => blockedTags.has(tag)));
  const word = String(kanji?.text || kana?.text || "").normalize("NFKC").trim();
  const reading = String(kana?.text || "").normalize("NFKC").trim();
  const key = `${word}\u0000${reading}`;
  if (!word || !reading || !/[ぁ-んァ-ン一-龯]/u.test(word) || word.length > 28 || reading.length > 36 || seen.has(key)) return null;
  const posTags = [...new Set(senses.flatMap((sense) => sense.partOfSpeech || []))].slice(0, 4);
  const related = [...new Set(senses.flatMap((sense) => sense.related || []).map((item) => Array.isArray(item) ? item[0] : item).filter(Boolean))].slice(0, 6);
  const common = Boolean((entry.kanji || []).some((item) => item.common) || (entry.kana || []).some((item) => item.common));
  const packId = classify(tags);
  const score = (common ? 100 : 0) + (packId !== "general" ? 22 : 0) + Math.max(0, 32 - word.length * 2) + Math.max(0, 24 - definitions.join(";").length / 18);
  return {
    id: `v4-${entry.id}`, word, kana: reading, romaji: romanize(reading), meaning: definitions.slice(0, 4).join("; ").slice(0, 360),
    meaningLanguage: "en", pos: posTags.map((tag) => source.tags?.[tag] || tag).join("; ").slice(0, 140) || "JMdict entry",
    level: "N?", topic: packLabels[packId], packId, register: register(tags), conjugationType: posTags.join(","),
    domains: [...tags].filter((tag) => careerFields.has(tag) || businessFields.has(tag) || lifeFields.has(tag)).slice(0, 5),
    particles: [], related, example: "", exampleVi: "", audioMode: "speechSynthesis:ja-JP", common,
    reviewStatus: "source-derived", meaningQuality: "reference", jlptVerified: false, pitchVerified: false,
    source: `JMdict ${source.version} (${source.dictDate})`, license: "EDRDG / CC BY-SA 4.0", score
  };
}

const candidates = source.words.map(candidate).filter(Boolean).sort((left, right) => right.score - left.score || Number(left.id.slice(3)) - Number(right.id.slice(3)));
const byPack = Object.fromEntries(Object.keys(packLabels).map((id) => [id, candidates.filter((row) => row.packId === id)]));
const selected = [];
for (const [packId, quota] of Object.entries(selectionQuotas)) {
  for (const row of byPack[packId].slice(0, quota)) { selected.push(row); selectedIds.add(row.id); }
}
for (const row of candidates) {
  if (selected.length >= TARGET_NEW) break;
  if (!selectedIds.has(row.id)) { selected.push(row); selectedIds.add(row.id); }
}
if (selected.length !== TARGET_NEW) throw new Error(`Only selected ${selected.length}/${TARGET_NEW} new entries.`);
selected.forEach((row) => { delete row.score; seen.add(`${row.word}\u0000${row.kana}`); });
const actualCounts = Object.fromEntries(Object.keys(packLabels).map((id) => [id, selected.filter((row) => row.packId === id).length]));
const packs = Object.keys(packLabels).map((id) => ({ id, label: packLabels[id], target: packTargets[id], count: actualCounts[id], status: "source-derived", downloadable: true }));
const checksum = crypto.createHash("sha256").update(JSON.stringify(selected)).digest("hex").toUpperCase();
const compact = selected.map((row) => [row.id, row.word, row.kana, row.romaji, row.meaning, row.pos, row.packId, row.register, row.conjugationType, row.related, row.common ? 1 : 0, row.domains]);
const sourceLabel = `JMdict ${source.version} (${source.dictDate})`;
const payload = `/*! HH Japanese V4 · JMdict ${source.version} (${source.dictDate}) · EDRDG/CC BY-SA 4.0 */\n` +
  `(()=>{"use strict";const raw=${JSON.stringify(compact)},source=${JSON.stringify(sourceLabel)},license="EDRDG / CC BY-SA 4.0",words=raw.map(r=>({id:r[0],word:r[1],kana:r[2],romaji:r[3],meaning:r[4],pos:r[5],packId:r[6],topic:r[6],register:r[7],conjugationType:r[8],related:r[9],common:Boolean(r[10]),domains:r[11],meaningLanguage:"en",level:"N?",particles:[],example:"",exampleVi:"",audioMode:"speechSynthesis:ja-JP",reviewStatus:"source-derived",meaningQuality:"reference",jlptVerified:false,pitchVerified:false,source,license})),packs=${JSON.stringify(packs)};globalThis.HHJapaneseVocabularyV4=Object.freeze({version:4,source,dictDate:${JSON.stringify(source.dictDate)},license,checksum:${JSON.stringify(checksum)},count:words.length,packs:Object.freeze(packs),words:Object.freeze(words)});})();\n`;
fs.writeFileSync(output, payload, "utf8");
console.log(JSON.stringify({ output, existing: existing.length, generated: selected.length, projectedUnique: seen.size, bytes: Buffer.byteLength(payload), checksum, actualCounts, source: source.version, dictDate: source.dictDate }, null, 2));
