"use strict";
importScripts("./japanese-vocabulary-v4.js?v=1");

const pack = self.HHJapaneseVocabularyV4;
const index = (pack?.words || []).map((row) => ({
  id: row.id,
  packId: row.packId,
  register: row.register,
  text: [row.word, row.kana, row.romaji, row.meaning, row.pos, row.related?.join(" ")].join(" ").toLocaleLowerCase("ja")
}));

self.onmessage = (event) => {
  const requestId = event.data?.requestId;
  const query = String(event.data?.query || "").normalize("NFKC").trim().toLocaleLowerCase("ja");
  const packId = String(event.data?.packId || "all");
  const register = String(event.data?.register || "all");
  const limit = Math.max(20, Math.min(300, Number(event.data?.limit) || 120));
  const ids = [];
  for (const row of index) {
    if (packId !== "all" && row.packId !== packId) continue;
    if (register !== "all" && row.register !== register) continue;
    if (query && !row.text.includes(query)) continue;
    ids.push(row.id);
    if (ids.length >= limit) break;
  }
  self.postMessage({ requestId, ids, total: index.length, source: pack?.source, checksum: pack?.checksum });
};
