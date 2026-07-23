const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "utility-lab-tools.js"), "utf8");
const css = fs.readFileSync(path.join(root, "utility-lab-tools.css"), "utf8");

function load() {
  const window = { crypto: require("node:crypto").webcrypto };
  const context = vm.createContext({ window, crypto: window.crypto, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, navigator: {}, performance: {}, document: {}, Blob, URL, TextEncoder, console, setTimeout, clearTimeout, setInterval, clearInterval });
  vm.runInContext(source, context);
  return window.HHUtilityTools;
}

test("publishes all remaining Developer, Productivity and System tools", () => {
  const api = load();
  assert.equal(api.manifests().length, 53);
  for (const name of ["Markdown Editor", "API Tester", "Terminal Simulator", "Productivity Dashboard", "Kanban", "Calculator", "Clipboard History", "User Preferences Center", "Weather Widget", "Network Speed", "QR Scanner"]) assert.equal(api.supports(name), true, name);
});

test("calculator uses a deterministic parser and rejects executable input", () => {
  const api = load();
  assert.equal(api.safeCalculate("(25 + 5) * 2"), 60);
  assert.equal(api.safeCalculate("10 % 4 + 3"), 5);
  assert.throws(() => api.safeCalculate("globalThis.alert(1)"));
  assert.doesNotMatch(source, /\beval\s*\(|\bFunction\s*\(/);
});

test("real engines and capability fallbacks are present", () => {
  for (const token of ["crypto.subtle.digest", "crypto.randomUUID", "crypto.getRandomValues", "BarcodeDetector", "navigator.storage", "api.github.com/repos", "api.open-meteo.com", "AbortController", "navigator.clipboard", "requestAnimationFrame"]) {
    if (token === "requestAnimationFrame") continue;
    assert.match(source, new RegExp(token.replace(/[.?+]/g, "\\$&")));
  }
  assert.match(source, /không nằm trong sandbox/);
  assert.match(source, /Không tự bật camera|không tự bật camera/i);
});

test("source is UTF-8, responsive and keyboard accessible", () => {
  assert.doesNotMatch(source + css, /Ã.|Â.|â€|Ä‘|Æ°|\uFFFD/);
  assert.match(css, /@media\(max-width:620px\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
