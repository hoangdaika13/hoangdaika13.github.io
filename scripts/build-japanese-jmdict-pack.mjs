import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const input = path.resolve(process.argv[2] || "");
const output = path.resolve(root, "japanese-vocabulary-10k.js");
if (!process.argv[2] || !fs.existsSync(input)) throw new Error("Pass the extracted jmdict-eng-common JSON path.");

require(path.join(root, "japanese-vocabulary-packs.js"));
require(path.join(root, "japanese-learning.js"));
const existing = globalThis.HHJapanese.words;
const target = Math.max(0, 10000 - existing.length);
const source = JSON.parse(fs.readFileSync(input, "utf8"));

const excludedTags = new Set(["X", "vulg", "derog", "arch", "obs", "rare", "dated", "sens", "rK", "rk"]);
const excludedPos = new Set(["person", "surname", "given", "company", "organization", "place", "station", "product", "work", "ship", "dei"]);
const existingKeys = new Set(existing.map((item) => `${item.word}\u0000${item.kana}`));
const seen = new Set(existingKeys);

const kanaMap = {
  "あ":"a","い":"i","う":"u","え":"e","お":"o","か":"ka","き":"ki","く":"ku","け":"ke","こ":"ko","さ":"sa","し":"shi","す":"su","せ":"se","そ":"so","た":"ta","ち":"chi","つ":"tsu","て":"te","と":"to","な":"na","に":"ni","ぬ":"nu","ね":"ne","の":"no","は":"ha","ひ":"hi","ふ":"fu","へ":"he","ほ":"ho","ま":"ma","み":"mi","む":"mu","め":"me","も":"mo","や":"ya","ゆ":"yu","よ":"yo","ら":"ra","り":"ri","る":"ru","れ":"re","ろ":"ro","わ":"wa","を":"wo","ん":"n","が":"ga","ぎ":"gi","ぐ":"gu","げ":"ge","ご":"go","ざ":"za","じ":"ji","ず":"zu","ぜ":"ze","ぞ":"zo","だ":"da","ぢ":"ji","づ":"zu","で":"de","ど":"do","ば":"ba","び":"bi","ぶ":"bu","べ":"be","ぼ":"bo","ぱ":"pa","ぴ":"pi","ぷ":"pu","ぺ":"pe","ぽ":"po",
  "きゃ":"kya","きゅ":"kyu","きょ":"kyo","しゃ":"sha","しゅ":"shu","しょ":"sho","ちゃ":"cha","ちゅ":"chu","ちょ":"cho","にゃ":"nya","にゅ":"nyu","にょ":"nyo","ひゃ":"hya","ひゅ":"hyu","ひょ":"hyo","みゃ":"mya","みゅ":"myu","みょ":"myo","りゃ":"rya","りゅ":"ryu","りょ":"ryo","ぎゃ":"gya","ぎゅ":"gyu","ぎょ":"gyo","じゃ":"ja","じゅ":"ju","じょ":"jo","びゃ":"bya","びゅ":"byu","びょ":"byo","ぴゃ":"pya","ぴゅ":"pyu","ぴょ":"pyo"
};
function hiragana(value) {
  return [...String(value || "").normalize("NFKC")].map((char) => {
    const code = char.charCodeAt(0);
    return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : char;
  }).join("");
}
function romanize(value) {
  const chars = [...hiragana(value)];
  let result = "";
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    const pair = `${char}${chars[index + 1] || ""}`;
    if (char === "っ") {
      const next = kanaMap[`${chars[index + 1] || ""}${chars[index + 2] || ""}`] || kanaMap[chars[index + 1]] || "";
      result += next[0] || "";
      continue;
    }
    if (char === "ー") {
      const vowel = result.match(/[aeiou]$/)?.[0] || "";
      result += vowel;
      continue;
    }
    if (kanaMap[pair]) { result += kanaMap[pair]; index += 1; continue; }
    result += kanaMap[char] || char;
  }
  return result.replace(/n(?=[bmp])/g, "m");
}
function tagsOf(entry) {
  const senses = Array.isArray(entry.sense) ? entry.sense : [];
  return new Set(senses.flatMap((sense) => [...(sense.partOfSpeech || []), ...(sense.misc || []), ...(sense.field || [])]));
}
function candidate(entry) {
  const tags = tagsOf(entry);
  if ([...tags].some((tag) => excludedTags.has(tag) || excludedPos.has(tag))) return null;
  const senses = (Array.isArray(entry.sense) ? entry.sense : []).filter((sense) => !(sense.misc || []).some((tag) => excludedTags.has(tag)));
  const definitions = senses.flatMap((sense) => sense.gloss || []).filter((gloss) => gloss?.lang === "eng" && gloss?.type !== "literal" && gloss?.type !== "explanation").map((gloss) => String(gloss.text || "").trim()).filter(Boolean);
  if (!definitions.length) return null;
  const kanji = (entry.kanji || []).find((item) => item.common && !(item.tags || []).some((tag) => excludedTags.has(tag))) || (entry.kanji || []).find((item) => !(item.tags || []).some((tag) => excludedTags.has(tag)));
  const kana = (entry.kana || []).find((item) => item.common && !(item.tags || []).some((tag) => excludedTags.has(tag))) || (entry.kana || []).find((item) => !(item.tags || []).some((tag) => excludedTags.has(tag)));
  const word = String(kanji?.text || kana?.text || "").normalize("NFKC").trim();
  const reading = String(kana?.text || "").normalize("NFKC").trim();
  if (!word || !reading || word.length > 28 || reading.length > 36) return null;
  const key = `${word}\u0000${reading}`;
  if (seen.has(key)) return null;
  const posTags = senses.flatMap((sense) => sense.partOfSpeech || []).filter((tag, index, list) => list.indexOf(tag) === index).slice(0, 3);
  const pos = posTags.map((tag) => source.tags?.[tag] || tag).join("; ").slice(0, 180) || "JMdict entry";
  const meaning = [...new Set(definitions)].slice(0, 4).join("; ").slice(0, 280);
  const commonKanji = Boolean((entry.kanji || []).some((item) => item.common));
  const commonKana = Boolean((entry.kana || []).some((item) => item.common));
  const basicPos = posTags.some((tag) => ["n", "v1", "v5u", "v5k", "v5s", "v5r", "v5t", "v5m", "v5b", "v5g", "adj-i", "adj-na", "adv", "exp"].includes(tag));
  const score = (commonKanji ? 50 : 0) + (commonKana ? 35 : 0) + (basicPos ? 20 : 0) + Math.max(0, 24 - word.length * 2) + Math.max(0, 16 - meaning.length / 20);
  return { id: `jmdict-${entry.id}`, word, kana: reading, romaji: romanize(reading), meaning, meaningLanguage: "en", pos, level: "N?", topic: "JMdict 10K", source: `JMdict ${source.version}`, score };
}

const selected = source.words.map(candidate).filter(Boolean).sort((left, right) => right.score - left.score || Number(left.id.replace("jmdict-", "")) - Number(right.id.replace("jmdict-", ""))).slice(0, target);
if (selected.length !== target) throw new Error(`Could only build ${selected.length}/${target} JMdict entries.`);
selected.forEach((item) => { delete item.score; seen.add(`${item.word}\u0000${item.kana}`); });

const payload = `/*! JMdict ${source.version} (${source.dictDate}); EDRDG license: https://www.edrdg.org/edrdg/licence.html */\n` +
  `(()=>{"use strict";const words=${JSON.stringify(selected)};globalThis.HHJapaneseVocabulary10K=Object.freeze({version:1,dictVersion:${JSON.stringify(source.version)},dictDate:${JSON.stringify(source.dictDate)},language:"eng",source:"JMdict/EDRDG",words:Object.freeze(words)});})();\n`;
fs.writeFileSync(output, payload, "utf8");
console.log(JSON.stringify({ output, existing: existing.length, generated: selected.length, total: existing.length + selected.length, bytes: Buffer.byteLength(payload), dictVersion: source.version, dictDate: source.dictDate }, null, 2));
