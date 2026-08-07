import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "japanese-sentence-bank-v5.js");
const snapshot = process.argv[2] ? path.resolve(process.argv[2]) : "";
const target = Math.max(1000, Math.min(50000, Number(process.env.HHJ_SENTENCE_TARGET) || 30000));
const api = "https://api.tatoeba.org/v1/sentences";
const params = new URLSearchParams({
  lang: "jpn",
  is_orphan: "no",
  is_unapproved: "no",
  "trans:lang": "vie,eng",
  "trans:is_direct": "yes",
  "trans:is_orphan": "no",
  "trans:is_unapproved": "no",
  showtrans: "matching",
  word_count: "5-80",
  license: "!PROBLEM",
  sort: "words",
  limit: "500"
});

const unsafe = /(?:ポルノ|セックス|強姦|売春|陰茎|膣|自殺|殺して|麻薬)/u;
const validJapanese = (text) => {
  const value = String(text || "").trim();
  if (value.length < 4 || value.length > 120 || unsafe.test(value)) return false;
  const jp = (value.match(/[ぁ-んァ-ヶ一-龯々〆ヵヶ]/gu) || []).length;
  const latin = (value.match(/[A-Za-z]/g) || []).length;
  return jp >= 3 && latin <= Math.max(2, Math.floor(value.length * 0.12));
};
const topicOf = (text) => {
  const rules = [
    ["career", /仕事|会社|会議|報告|上司|同僚|勤務|面接|職場/u],
    ["health", /病院|医者|薬|痛|熱|健康|看護|保険/u],
    ["travel", /駅|電車|空港|切符|旅行|ホテル|道|乗/u],
    ["food", /食|飲|料理|店|注文|野菜|肉|魚/u],
    ["school", /学校|先生|学生|授業|宿題|勉強|試験/u],
    ["life", /家|家族|買|住|市役所|銀行|電話|朝|夜/u]
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || "general";
};
const levelOf = (text) => text.length <= 14 ? "A1" : text.length <= 26 ? "A2" : text.length <= 42 ? "B1" : "B2";
const cleanTranslation = (row) => ({
  id: Number(row.id), text: String(row.text || "").trim(), lang: row.lang,
  author: row.owner || "unknown", license: row.license || "CC BY 2.0 FR"
});
const compactSentence = (row) => {
  if (!validJapanese(row.text)) return null;
  const translations = (row.translations || []).filter((item) => ["vie", "eng"].includes(item.lang) && item.text && item.license !== "PROBLEM");
  const translation = translations.find((item) => item.lang === "vie") || translations.find((item) => item.lang === "eng");
  if (!translation) return null;
  return {
    id: Number(row.id), text: String(row.text).trim(), translation: cleanTranslation(translation),
    author: row.owner || "unknown", license: row.license || "CC BY 2.0 FR",
    level: levelOf(row.text), topic: topicOf(row.text), register: "neutral",
    reviewStatus: "source-filtered", sourceUrl: `https://tatoeba.org/sentences/show/${row.id}`
  };
};

async function eachTsv(file, visit) {
  const input = fs.createReadStream(file, { encoding: "utf8" });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) if (line) visit(line.split("\t"));
}
async function cc0Ids(file) {
  const ids = new Set();
  if (fs.existsSync(file)) await eachTsv(file, (cols) => ids.add(Number(cols[0])));
  return ids;
}
async function buildFromExports(dir) {
  const files = {
    jpn: path.join(dir, "jpn_sentences_detailed.tsv"), eng: path.join(dir, "eng_sentences_detailed.tsv"),
    vie: path.join(dir, "vie_sentences_detailed.tsv"), jpnEng: path.join(dir, "jpn-eng_links.tsv"),
    jpnVie: path.join(dir, "jpn-vie_links.tsv"), jpnCc0: path.join(dir, "jpn_sentences_CC0.tsv"),
    engCc0: path.join(dir, "eng_sentences_CC0.tsv")
  };
  for (const file of [files.jpn, files.eng, files.vie, files.jpnEng, files.jpnVie]) if (!fs.existsSync(file)) throw new Error(`Missing Tatoeba export: ${file}`);
  const vieLink = new Map(), engLink = new Map();
  await eachTsv(files.jpnVie, (cols) => { const jp=Number(cols[0]);if(!vieLink.has(jp))vieLink.set(jp,Number(cols[1])); });
  await eachTsv(files.jpnEng, (cols) => { const jp=Number(cols[0]);if(!engLink.has(jp))engLink.set(jp,Number(cols[1])); });
  const neededVie = new Set(vieLink.values()), neededEng = new Set(engLink.values());
  const translations = new Map();
  await eachTsv(files.vie, (cols) => { const id=Number(cols[0]);if(neededVie.has(id))translations.set(`vie:${id}`,{id,text:cols[2],lang:"vie",author:cols[3]||"unknown",license:"CC BY 2.0 FR"}); });
  const engCc0 = await cc0Ids(files.engCc0);
  await eachTsv(files.eng, (cols) => { const id=Number(cols[0]);if(neededEng.has(id))translations.set(`eng:${id}`,{id,text:cols[2],lang:"eng",author:cols[3]||"unknown",license:engCc0.has(id)?"CC0 1.0":"CC BY 2.0 FR"}); });
  const jpnCc0 = await cc0Ids(files.jpnCc0), candidates=[];
  await eachTsv(files.jpn, (cols) => {
    const id=Number(cols[0]),text=cols[2];if(!validJapanese(text))return;
    const viId=vieLink.get(id),enId=engLink.get(id),translation=translations.get(`vie:${viId}`)||translations.get(`eng:${enId}`);
    if(!translation||!translation.text)return;
    candidates.push({id,text,translation,author:cols[3]||"unknown",license:jpnCc0.has(id)?"CC0 1.0":"CC BY 2.0 FR",level:levelOf(text),topic:topicOf(text),register:"neutral",reviewStatus:"source-filtered",sourceUrl:`https://tatoeba.org/sentences/show/${id}`});
  });
  candidates.sort((a,b) => (a.translation.lang==="vie"?-1:1)-(b.translation.lang==="vie"?-1:1) || a.text.length-b.text.length || a.id-b.id);
  const rows=[],seen=new Set();
  for(const row of candidates){if(seen.has(row.text))continue;seen.add(row.text);rows.push(row);if(rows.length>=target)break;}
  if(rows.length<target)throw new Error(`Only ${rows.length}/${target} bulk sentences passed the filters.`);
  return {rows,fetchedAt:fs.statSync(files.jpn).mtime.toISOString(),pages:0};
}

async function download() {
  const rows = [];
  const seen = new Set();
  let url = `${api}?${params}`;
  let pages = 0;
  while (url && rows.length < target && pages < 180) {
    const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "HHJapaneseOpenDataBuilder/5.0" } });
    if (!response.ok) throw new Error(`Tatoeba API ${response.status}: ${await response.text()}`);
    const payload = await response.json();
    for (const source of payload.data || []) {
      const row = compactSentence(source);
      if (!row || seen.has(row.text)) continue;
      seen.add(row.text);
      rows.push(row);
      if (rows.length >= target) break;
    }
    pages += 1;
    url = payload.paging?.has_next ? payload.paging.next : "";
    if (pages % 10 === 0) console.error(`Tatoeba: ${pages} pages, ${rows.length}/${target} accepted`);
  }
  if (rows.length < target) throw new Error(`Only ${rows.length}/${target} sentences passed the filters.`);
  return { rows, fetchedAt: new Date().toISOString(), pages };
}

const sourcePayload = snapshot && fs.existsSync(snapshot)
  ? (fs.statSync(snapshot).isDirectory()?await buildFromExports(snapshot):{ rows: JSON.parse(fs.readFileSync(snapshot, "utf8")), fetchedAt: fs.statSync(snapshot).mtime.toISOString(), pages: 0 })
  : await download();
const rows = sourcePayload.rows.slice(0, target);
const raw = rows.map((row) => [row.id,row.text,row.translation.text,row.translation.lang,row.author,row.license,row.translation.author,row.translation.license,row.level,row.topic,row.register,row.reviewStatus]);
const checksum = crypto.createHash("sha256").update(JSON.stringify(raw)).digest("hex").toUpperCase();
const sourceQuery = `${api}?${params}`;
const payload = `/*! HH Japanese V5 Sentence Bank · Tatoeba · CC BY 2.0 FR/CC0 per record */\n` +
  `(()=>{"use strict";const raw=${JSON.stringify(raw)},sentences=raw.map(r=>Object.freeze({id:r[0],text:r[1],translation:r[2],translationLanguage:r[3],author:r[4],license:r[5],translationAuthor:r[6],translationLicense:r[7],level:r[8],topic:r[9],register:r[10],reviewStatus:r[11],source:"Tatoeba",sourceUrl:"https://tatoeba.org/sentences/show/"+r[0],audio:null}));globalThis.HHJapaneseSentenceBankV5=Object.freeze({version:5,count:sentences.length,checksum:${JSON.stringify(checksum)},fetchedAt:${JSON.stringify(sourcePayload.fetchedAt)},sourceQuery:${JSON.stringify(sourceQuery)},license:"Per-record: CC BY 2.0 FR or CC0 1.0",sentences:Object.freeze(sentences)});})();\n`;
fs.writeFileSync(output, payload, "utf8");
console.log(JSON.stringify({ output, count: rows.length, bytes: Buffer.byteLength(payload), checksum, fetchedAt: sourcePayload.fetchedAt, pages: sourcePayload.pages }, null, 2));
