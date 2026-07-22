const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("backend exposes a safe readiness report without returning credentials", () => {
  const source = read("api/platform/summary.js");
  const storageSource = read("api/storage/files.js");
  assert.match(source, /readinessSnapshot/);
  assert.match(source, /requiresConnection/);
  assert.match(storageSource, /largeBinaryFiles: false/);
  assert.match(source, /passkey: true/);
  assert.doesNotMatch(source, /process\.env\.(?:MONGODB_URI|JWT_SECRET|PAYOS_API_KEY|GEMINI_API_KEYS)\s*[,}]/);
});

test("realtime health degrades honestly and async route failures are contained", () => {
  const server = read("realtime-server/src/server.js");
  assert.match(server, /const asyncRoute/);
  assert.match(server, /DATABASE_NOT_CONFIGURED/);
  assert.match(server, /Realtime backend dependency is unavailable/);
});

test("Render keeps shared secrets as operator-provided values", () => {
  const render = read("render.yaml");
  assert.match(render, /key: MONGODB_URI\s+sync: false/);
  assert.match(render, /key: JWT_SECRET\s+sync: false/);
  assert.match(render, /key: GOOGLE_CALLBACK_URL/);
  assert.doesNotMatch(render, /JWT_SECRET[\s\S]{0,80}generateValue/);
});
