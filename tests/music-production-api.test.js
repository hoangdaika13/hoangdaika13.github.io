const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "api", "modules", "[moduleId]", "actions.js"), "utf8");

test("Music API accepts structured Eleven composition plans without exposing keys", () => {
  assert.match(source, /composition_plan: compositionPlan/);
  assert.match(source, /positive_styles/);
  assert.match(source, /negative_styles/);
  assert.match(source, /context_adherence/);
  assert.match(source, /sign_with_c2pa: true/);
  assert.match(source, /requestBody\.seed = seed/);
  assert.doesNotMatch(source, /ELEVENLABS_API_KEY\s*=\s*["'][^"']+/);
});

test("Music API provides an official sound-effect action with bounded controls", () => {
  assert.match(source, /"music-sfx"/);
  assert.match(source, /\/v1\/sound-generation/);
  assert.match(source, /eleven_text_to_sound_v2/);
  assert.match(source, /durationSeconds = Math\.min\(30, Math\.max\(0\.5/);
  assert.match(source, /promptInfluence = Math\.min\(1, Math\.max\(0/);
  assert.match(source, /loop: Boolean\(meta\.loop\)/);
});

test("Provider status reports capabilities without returning credentials", () => {
  assert.match(source, /sound: \{ configured: Boolean/);
  assert.match(source, /capabilities: \["ambience", "foley", "one-shot", "loop", "0\.5-30s"\]/);
  assert.doesNotMatch(source, /providers:[\s\S]{0,1800}(?:apiKey|secret|token):/i);
});
