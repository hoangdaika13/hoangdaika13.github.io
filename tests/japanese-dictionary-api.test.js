const test = require("node:test");
const assert = require("node:assert/strict");

const handler = require("../api/search/[provider]");

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; }
  };
}

test("Japanese dictionary proxy exposes only bounded learning fields", () => {
  const entry = handler.__test.normalizeJapaneseEntry({
    slug: "学ぶ",
    is_common: true,
    jlpt: ["jlpt-n3"],
    japanese: [{ word: "学ぶ", reading: "まなぶ", unexpected: "private" }],
    senses: [{ english_definitions: ["to learn", "to study"], parts_of_speech: ["Godan verb"], links: [{ text: "ignored" }] }]
  }, 0);
  assert.deepEqual(entry, {
    id: "jisho-1",
    word: "学ぶ",
    reading: "まなぶ",
    definitions: ["to learn", "to study"],
    partsOfSpeech: ["Godan verb"],
    jlpt: ["N3"],
    common: true,
    source: "JMdict via Jisho"
  });
  assert.equal("links" in entry, false);
});

test("Japanese dictionary endpoint validates query and maps provider response", async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ meta: { status: 200 }, data: [{ slug: "日本語", japanese: [{ word: "日本語", reading: "にほんご" }], senses: [{ english_definitions: ["Japanese language"], parts_of_speech: ["Noun"] }] }] })
  });
  try {
    const res = responseRecorder();
    await handler({ method: "GET", headers: {}, query: { provider: "japanese", q: "日本語" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.items[0].word, "日本語");
    assert.match(res.headers["Cache-Control"], /s-maxage=3600/);

    const invalid = responseRecorder();
    await handler({ method: "GET", headers: {}, query: { provider: "japanese", q: "" } }, invalid);
    assert.equal(invalid.statusCode, 400);
  } finally {
    global.fetch = previousFetch;
  }
});
