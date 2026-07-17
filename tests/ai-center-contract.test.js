const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  GeminiKeyPool,
  canTryAnotherKey,
  parseGeminiKeys
} = require("../utils/gemini-key-pool");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Gemini key pool parses, deduplicates and rotates server credentials", () => {
  const keys = parseGeminiKeys({
    GEMINI_API_KEYS: "key-aaaaaaaaaaaaaaaaaaaa,key-bbbbbbbbbbbbbbbbbbbb\nkey-aaaaaaaaaaaaaaaaaaaa",
    GEMINI_API_KEY: "key-cccccccccccccccccccc"
  });
  assert.deepEqual(keys, [
    "key-aaaaaaaaaaaaaaaaaaaa",
    "key-bbbbbbbbbbbbbbbbbbbb",
    "key-cccccccccccccccccccc"
  ]);
  const pool = new GeminiKeyPool(keys, { maxAttempts: 2 });
  assert.deepEqual(pool.candidates(), keys.slice(0, 2));
  assert.deepEqual(pool.candidates(), keys.slice(1, 3));
});

test("Gemini key pool cools failed keys without exposing their identity", () => {
  let now = 1_000;
  const keys = ["key-aaaaaaaaaaaaaaaaaaaa", "key-bbbbbbbbbbbbbbbbbbbb"];
  const pool = new GeminiKeyPool(keys, { maxAttempts: 2, now: () => now });
  pool.reportFailure(keys[0], 429, "quota exceeded");
  assert.equal(pool.availableCount(), 1);
  assert.deepEqual(pool.candidates(), [keys[1]]);
  assert.equal(canTryAnotherKey(429, "quota"), true);
  now += 80_000;
  assert.equal(pool.availableCount(), 2);
});

test("AI Center uses server-side Gemini, multi-turn history and safe metadata", () => {
  const api = read("api/modules/[moduleId]/actions.js");
  const client = read("script.js");
  const env = read(".env.example");
  assert.match(api, /parseGeminiKeys/);
  assert.match(api, /sanitizeHistory/);
  assert.match(api, /sanitizeAttachments/);
  assert.match(api, /storedMeta/);
  assert.match(api, /keyAttempts/);
  assert.match(client, /data-ai-system-prompt/);
  assert.match(client, /data-ai-attach/);
  assert.match(client, /data-ai-stop/);
  assert.match(client, /useGoogleSearch/);
  assert.match(env, /^GEMINI_API_KEYS=$/m);
  assert.doesNotMatch(read("index.html"), /GEMINI_API_KEY|GEMINI_API_KEYS/);
});
