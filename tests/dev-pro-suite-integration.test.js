const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "dev-pro-suite.js"), "utf8");
const shell = fs.readFileSync(path.join(root, "script.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const loader = fs.readFileSync(path.join(root, "performance-loader.js"), "utf8");

test("DEV Pro Suite declares all twelve requested workspaces", () => {
  ["smart-input", "developer-recipe", "api-studio", "mock-api", "json-data-lab", "security-encoding", "regex-studio", "database-playground", "code-playground", "git-diff-studio", "web-diagnostics", "ai-developer"].forEach((id) => assert.match(source, new RegExp(`id: \\"${id}\\"`)));
});

test("DEV route can mount the professional suite", () => {
  assert.match(shell, /HHDevProSuite/);
  assert.match(`${html}\n${loader}`, /dev-pro-suite\.js/);
});

test("DEV overview documents local-first secret handling", () => {
  assert.match(source, /Secret không được đưa vào URL/);
  assert.doesNotMatch(source, /eval\s*\(|new Function/);
});
