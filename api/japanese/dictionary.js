const { clean, setCors } = require("../../utils/platform");

const JISHO_ENDPOINT = "https://jisho.org/api/v1/search/words";
const MAX_RESULTS = 12;

function boundedList(value, limit = 12, itemLimit = 180) {
  return (Array.isArray(value) ? value : [])
    .map((item) => clean(item, itemLimit))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeEntry(entry, index) {
  const japanese = Array.isArray(entry?.japanese) ? entry.japanese : [];
  const primary = japanese.find((item) => item?.word) || japanese[0] || {};
  const senses = (Array.isArray(entry?.senses) ? entry.senses : []).slice(0, 5);
  const definitions = boundedList(senses.flatMap((sense) => sense?.english_definitions || []), 12, 120);
  const partsOfSpeech = boundedList(senses.flatMap((sense) => sense?.parts_of_speech || []), 8, 120);
  const word = clean(primary.word || entry?.slug || primary.reading, 80);
  const reading = clean(primary.reading, 80);
  if (!word && !reading) return null;
  return {
    id: `jisho-${index + 1}`,
    word: word || reading,
    reading,
    definitions,
    partsOfSpeech,
    jlpt: boundedList(entry?.jlpt, 5, 20).map((item) => item.replace(/^jlpt-/i, "").toUpperCase()),
    common: entry?.is_common === true,
    source: "JMdict via Jisho"
  };
}

async function fetchDictionary(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const params = new URLSearchParams({ keyword: query });
    const response = await fetch(`${JISHO_ENDPOINT}?${params}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "HH-Japanese/1.0"
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || Number(data?.meta?.status || response.status) >= 400) {
      const error = new Error("Kho từ điển trực tuyến tạm thời không phản hồi.");
      error.statusCode = 502;
      throw error;
    }
    return (Array.isArray(data?.data) ? data.data : [])
      .slice(0, MAX_RESULTS)
      .map(normalizeEntry)
      .filter(Boolean);
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Kho từ điển phản hồi quá chậm. Hãy thử lại.");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const query = clean(req.query?.q, 80);
  if (!query) return res.status(400).json({ error: "Hãy nhập từ cần tra." });
  try {
    const items = await fetchDictionary(query);
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({
      ok: true,
      query,
      items,
      source: "JMdict via Jisho",
      note: "Nghĩa trực tuyến hiện do nguồn cung cấp bằng tiếng Anh."
    });
  } catch (error) {
    return res.status(Number(error?.statusCode || 502)).json({
      error: clean(error?.message || "Không thể tra từ trực tuyến.", 240),
      code: error?.statusCode === 504 ? "DICTIONARY_TIMEOUT" : "DICTIONARY_UNAVAILABLE"
    });
  }
};

module.exports.__test = Object.freeze({ normalizeEntry, fetchDictionary });
