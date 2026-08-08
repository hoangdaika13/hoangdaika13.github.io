const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "music-production-suite.js"), "utf8");
const css = fs.readFileSync(path.join(root, "music-production-suite.css"), "utf8");
const api = fs.readFileSync(path.join(root, "api/modules/[moduleId]/actions.js"), "utf8");

test("Quick Studio exposes the six-step guided workflow and basic/advanced modes", () => {
  for (const marker of ["QUICK STUDIO", "Ý tưởng", "Tạo nhạc", "Cấu trúc", "Mix/Master", "Visualizer", "Xuất bản", "experienceMode", "data-mg-mode"]) {
    assert.match(source, new RegExp(marker, "i"));
  }
  assert.match(css, /\.mg-quick-studio/);
  assert.match(css, /\.mg-quick-steps/);
});

test("provider readiness never embeds browser API keys and distinguishes configuration from authorization", () => {
  for (const marker of ["providerReadiness", "Thiếu cấu hình máy chủ", "Cần đăng nhập tài khoản chủ", "Web Audio", "YouTube OAuth"]) {
    assert.match(source, new RegExp(marker, "i"));
  }
  assert.doesNotMatch(source, /process\.env\.|ELEVENLABS_API_KEY|GEMINI_API_KEYS/);
});

test("Gemini brief and Eleven SFX use the secured music backend", () => {
  assert.match(source, /actionType:\s*"music-plan"/);
  assert.match(source, /provider:\s*"gemini"/);
  assert.match(source, /enqueueGeneration\("music-sfx"/);
  assert.match(source, /promptInfluence/);
  assert.match(source, /durationSeconds/);
  assert.match(source, /loop:/);
  assert.match(api, /\/v1\/sound-generation/);
  assert.match(api, /process\.env\.ELEVENLABS_API_KEY/);
});

test("queue provides truthful lifecycle controls and displays provider errors", () => {
  for (const marker of ["toggle-queue", "cancel", "retry", "duplicate", "job.error", "AbortController"]) {
    assert.match(source, new RegExp(marker, "i"));
  }
  assert.doesNotMatch(source, /fake success|giả hoàn tất/i);
});
