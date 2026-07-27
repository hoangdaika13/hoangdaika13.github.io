const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Davinci Resolve is a first-class routed workspace", () => {
  const script = read("script.js");
  const loader = read("performance-loader.js");
  const html = read("index.html");
  const hub = read("davinci-resolve-hub.js");

  assert.match(script, /id:\s*"davinci-resolve"/);
  assert.match(script, /route:\s*"\/davinci-resolve"/);
  assert.match(hub, /window\.HHDavinciResolveHub\s*=\s*\{\s*mount/);
  assert.match(loader, /davinci:\s*\{\s*styles:\s*\["davinci-resolve-hub\.css\?v=2"\]/);
  assert.match(loader, /startsWith\("\/davinci-resolve"\)/);
  assert.match(html, /performance-loader\.js\?v=53/);
});

test("the website bridge is local-only and key protected", () => {
  const hub = read("davinci-resolve-hub.js");
  const vercel = read("vercel.json");
  const html = read("index.html");

  assert.match(hub, /127\.0\.0\.1:8765/);
  assert.match(hub, /X-H-Cosmic-Key/);
  assert.match(hub, /\/api\/preflight/);
  assert.match(hub, /\/api\/run/);
  assert.match(hub, /\/api\/status\?after=/);
  assert.match(hub, /\/api\/claim/);
  assert.match(hub, /h-cosmic-auto-v2/);
  assert.match(hub, /autoConnect\(false\)/);
  assert.match(hub, /resolve_connected/);
  assert.match(vercel, /http:\/\/127\.0\.0\.1:8765/);
  assert.match(html, /http:\/\/localhost:8765/);
  assert.doesNotMatch(hub, /localStorage\.setItem\([^)]*bridge/i);
});

test("the hub exposes production safety controls", () => {
  const hub = read("davinci-resolve-hub.js");
  for (const label of ["PRECHECK", "data-dr-run=\"render\"", "data-dr-run=\"resume\"", "ACTION GRAPH", "HUMAN ACTION BLUEPRINT", "FFprobe", "Checkpoint"]) {
    assert.match(hub, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${label} missing`);
  }
});
