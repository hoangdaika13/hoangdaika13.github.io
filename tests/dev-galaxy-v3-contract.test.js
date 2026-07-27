const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const source = read("dev-pro-suite.js");
const styles = read("dev-pro-suite.css");
const shell = read("script.js");
const loader = read("performance-loader.js");
const worker = read("sw.js");

const planets = [
  "space-dock",
  "code-nebula",
  "api-pulsar",
  "data-core",
  "git-orbit",
  "delivery-launchpad",
  "security-shield",
  "observability-radar"
];

test("Developer Galaxy exposes exactly eight primary planets and keeps thirteen workspaces", () => {
  for (const id of planets) assert.match(source, new RegExp(`id: \\"${id}\\"`));
  assert.equal((source.match(/planet: "/g) || []).length, 13);
  assert.match(source, /8 PLANETS · 13 WORKSPACES · 34 TOOLS/);
  assert.match(shell, /const developerAllToolItems = \[\.\.\.developerToolItems, \.\.\.developerWorkspaceItems\]/);
});

test("Universal Dev Project is versioned, local-first and never persists secrets", () => {
  assert.match(source, /hh\.dev\.galaxy\.v3/);
  assert.match(source, /Universal Dev Project/);
  assert.match(source, /Secret không được đưa vào URL/);
  assert.match(source, /localStorage\.setItem\(STORAGE_KEY/);
  assert.doesNotMatch(source, /localStorage\.setItem\([^,]+,\s*(?:token|secret|password)/i);
  assert.doesNotMatch(source, /eval\s*\(|new Function/);
});

test("Mission Control reads truthful server health and labels external adapters", () => {
  assert.match(source, /\/api\/platform\/summary\?view=health/);
  assert.match(source, /Không giả lập trạng thái adapter/);
  assert.match(source, /Qua adapter bảo mật/);
  for (const marker of ["MongoDB", "Realtime", "Object Storage", "PayOS", "AI Provider", "Google OAuth"]) {
    assert.match(source, new RegExp(marker));
  }
});

test("Developer Galaxy visual system supports all themes, 375px and reduced motion", () => {
  for (const theme of ["quantum", "cyber", "aurora", "nebula", "solar", "blackhole"]) {
    assert.match(source, new RegExp(`\\[\\"${theme}\\",`));
  }
  assert.match(styles, /\.dev-galaxy-orbit/);
  assert.match(styles, /\.dev-planet-grid/);
  assert.match(styles, /@media \(max-width: 375px\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /focus-visible/);
  assert.doesNotMatch(styles, /min-width:\s*[5-9][0-9]{2}px/);
});

test("cache manifests ship the new Developer Galaxy assets", () => {
  assert.match(loader, /dev-pro-suite\.css\?v=2/);
  assert.match(loader, /dev-pro-suite\.js\?v=3/);
  assert.match(worker, /hh-identity-portal-v270/);
  assert.match(worker, /dev-pro-suite\.css\?v=2/);
  assert.match(worker, /dev-pro-suite\.js\?v=3/);
});
