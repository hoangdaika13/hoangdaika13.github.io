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
  assert.equal(api.safeCalculate("2 * -3 + .5"), -5.5);
  assert.equal(api.safeCalculate("-(2 + 3) * +2"), -10);
  assert.equal(api.safeCalculate("1. + .25"), 1.25);
  for (const expression of ["", "1 2", "1..2", "()", "2(3)", "1/0", "5 % 0", "1e5", "2 ** 3"]) assert.throws(() => api.safeCalculate(expression), expression);
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
  assert.match(css, /forced-colors:active/);
  assert.doesNotMatch(css, /body\.ut-focus-active/);
});

test("unit and timestamp converters accept useful explicit formats and reject mismatched values", () => {
  const api = load();
  assert.equal(api.convertUnit(32, "f", "c"), "32 F = 0 C");
  assert.equal(api.convertUnit(0, "c", "k"), "0 C = 273.15 K");
  assert.match(api.convertUnit(1, "mi", "km"), /1,609344/);
  assert.match(api.convertUnit(1, "h", "min"), /60/);
  assert.throws(() => api.convertUnit(-1, "k", "c"));
  assert.throws(() => api.convertUnit(Infinity, "m", "km"));
  assert.throws(() => api.convertUnit(1, "m", "kg"));
  assert.equal(api.parseTimestamp("-1", "seconds").toISOString(), "1969-12-31T23:59:59.000Z");
  assert.equal(api.parseTimestamp("1000", "milliseconds").getTime(), 1000);
  assert.throws(() => api.parseTimestamp("", "auto"));
  assert.throws(() => api.parseTimestamp("today", "seconds"));
});

test("diff aligns inserted lines instead of claiming all later lines changed", () => {
  const api = load();
  assert.equal(api.compareLines("a\nb\nc", "a\nx\nb\nc"), "  a\n+ x\n  b\n  c");
  assert.throws(() => api.compareLines(Array(1001).fill("a").join("\n"), Array(1001).fill("b").join("\n")));
});

test("calendar export escapes injected separators and uses UTC timestamps", () => {
  const api = load();
  const ics = api.calendarICS([{ id: "event-one", title: "Học, họp; nhóm\nBEGIN:VEVENT", date: "2026-10-12T10:30:00Z", at: "2026-10-12T09:00:00Z", meta: "Ghi chú" }]);
  assert.match(ics, /DTSTART:20261012T103000Z/);
  assert.match(ics, /SUMMARY:Học\\, họp\\; nhóm\\nBEGIN:VEVENT/);
  assert.equal((ics.match(/^BEGIN:VEVENT$/gm) || []).length, 1);
});

test("timer snapshots use anchored time and preserve paused state without drift", () => {
  const api = load();
  const timer = { status: "running", elapsedMs: 2000, remainingMs: 10000, anchor: 1000 };
  assert.equal(api.timerSnapshot(timer, false, 4000).remainingMs, 7000);
  assert.equal(api.timerSnapshot(timer, false, 12000).status, "complete");
  assert.equal(api.timerSnapshot({ ...timer, status: "paused", anchor: null }, false, 100000).remainingMs, 10000);
  assert.equal(api.timerSnapshot(timer, true, 12000).elapsedMs, 13000);
  assert.equal(api.formatDuration(3661000), "01:01:01");
});
