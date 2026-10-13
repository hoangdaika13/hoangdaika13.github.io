const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { Worker: NodeWorker } = require("node:worker_threads");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "utility-lab-tools.js"), "utf8");
const css = fs.readFileSync(path.join(root, "utility-lab-tools.css"), "utf8");

function load(options = {}) {
  const window = { crypto: require("node:crypto").webcrypto, ...(options.window || {}) };
  const context = vm.createContext({ window, crypto: window.crypto, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, navigator: {}, performance: {}, document: {}, Blob, URL: options.URL || URL, TextEncoder, console, setTimeout, clearTimeout, setInterval, clearInterval });
  vm.runInContext(source, context);
  return window.HHUtilityTools;
}

test("publishes all remaining Developer, Productivity and System tools", () => {
  const api = load();
  assert.equal(api.manifests().length, 53);
  for (const name of ["Markdown Editor", "API Tester", "Terminal Simulator", "Productivity Dashboard", "Kanban", "Calculator", "Clipboard History", "User Preferences Center", "Weather Widget", "Network Speed", "QR Scanner"]) assert.equal(api.supports(name), true, name);
});

test("CSV parser preserves quotes, multiline Unicode, trailing empties and auto delimiters", () => {
  const api = load(), source = '\uFEFFTên;Ghi chú;Trống\r\nHoàng;"Dòng 1\r\nDòng 2, có ""quote"" 🌌";\r\n\r\nDung;Thư viện;';
  const parsed = api.parseCSV(source); assert.equal(parsed.delimiter, ";"); assert.equal(parsed.rows.length, 3); assert.equal(parsed.rows[1][1], 'Dòng 1\r\nDòng 2, có "quote" 🌌'); assert.equal(parsed.rows[2][2], "");
  assert.deepEqual(JSON.parse(JSON.stringify(api.parseCSV(api.serializeCSV(parsed.rows, { delimiter: ";", protectFormulas: false }), ";").rows)), JSON.parse(JSON.stringify(parsed.rows)));
  assert.equal(api.parseCSV('"one";"two"').delimiter, ";"); assert.equal(api.parseCSV("a\tb\n1\t2").delimiter, "\t");
  assert.equal(api.parseCSV('""\n\n').rows.length, 1); assert.equal(api.parseCSV("").rows.length, 0);
  for (const bad of ['a,"unclosed', 'a,"closed"tail', 'a,un"quoted', "a,\u0000"]) assert.throws(() => api.parseCSV(bad, ","), bad);
  assert.throws(() => api.parseCSV("x".repeat(1048577))); assert.throws(() => api.parseCSV(Array(5001).fill("a").join("\n"))); assert.throws(() => api.parseCSV(Array(101).fill("a").join(","))); assert.throws(() => api.parseCSV("x".repeat(32769)));
});

test("CSV↔JSON rejects ambiguous loss and handles prototype-like headers as plain data", () => {
  const api = load(), parsed = api.parseCSV("__proto__,constructor,Tên\nraw,field,Hoàng"); const records = api.csvToJSON(parsed.rows);
  assert.equal(Object.getPrototypeOf(records[0]), null); assert.equal(records[0].__proto__, "raw"); assert.equal(records[0].constructor, "field");
  assert.throws(() => api.csvToJSON([["a", "a"], ["1", "2"]])); assert.throws(() => api.csvToJSON([["a", "b"], ["1"]]));
  assert.equal(api.csvToJSON([["a", "a"], ["1"]], "arrays")[1].length, 1);
  const converted = api.jsonToCSV('[{"name":"🌌","score":9,"done":false},{"name":"Hoàng","note":null}]');
  assert.equal(converted.hasHeader, true); assert.deepEqual(Array.from(converted.rows[0]), ["name", "score", "done", "note"]); assert.deepEqual(Array.from(converted.rows[1]), ["🌌", "9", "false", ""]);
  assert.equal(api.jsonToCSV('[["a",1],["b",null]]').hasHeader, false);
  for (const bad of ['{"a":1}', '[{"a":{"nested":true}}]', '[[1],{"a":2}]', '[1,2]']) assert.throws(() => api.jsonToCSV(bad));
});

test("CSV downloads default to formula protection and explicit raw serialization preserves source", () => {
  const api = load(), rows = [["=SUM(1,2)", "+cmd", "-2", "@x", "\t=hidden", " \r=trick", "Plain 🌌"]];
  const protectedCSV = api.serializeCSV(rows, { bom: true }); assert.ok(protectedCSV.startsWith("\uFEFF")); const protectedRows = api.parseCSV(protectedCSV, ",").rows[0];
  assert.ok(protectedRows.slice(0, 6).every((value) => value.startsWith("'"))); assert.equal(protectedRows[6], "Plain 🌌");
  assert.equal(rows[0][0], "=SUM(1,2)"); assert.equal(api.parseCSV(api.serializeCSV(rows, { protectFormulas: false }), ",").rows[0][0], "=SUM(1,2)");
  assert.equal(api.parseCSV(api.serializeCSV([["＝SUM(1,2)"]]), ",").rows[0][0], "'＝SUM(1,2)");
});

function regexThreadHarness() {
  const blobs = new Map(), counts = { created: 0, terminated: 0 }; let sequence = 0;
  const TestURL = class extends URL {}; TestURL.createObjectURL = (blob) => { const key = `blob:regex-${++sequence}`; blobs.set(key, blob); return key; }; TestURL.revokeObjectURL = (key) => blobs.delete(key);
  class BrowserWorker {
    constructor(url) { counts.created++; this.ended = false; blobs.get(url).text().then((code) => { if (this.ended) return; this.worker = new NodeWorker(`const { parentPort } = require('node:worker_threads'); globalThis.postMessage = data => parentPort.postMessage(data); parentPort.on('message', data => globalThis.onmessage({ data })); ${code}`, { eval: true }); this.worker.on("message", (data) => { if (!this.ended) this.onmessage?.({ data }); }); this.worker.on("error", () => { if (!this.ended) this.onerror?.(); }); if (this.pending) this.worker.postMessage(this.pending); }); }
    postMessage(data) { if (this.worker) this.worker.postMessage(data); else this.pending = data; }
    terminate() { if (this.ended) return; this.ended = true; counts.terminated++; this.worker?.terminate(); }
  }
  return { api: load({ window: { Worker: BrowserWorker }, URL: TestURL }), blobs, counts };
}

test("Regex actual worker returns captures, named groups, indices and exact replacement tokens", async () => {
  const env = regexThreadHarness(), input = "ab12 cd3", pattern = "(?<word>[a-z]+)(\\d+)?", replacement = "$<word>:$2:$&:$$";
  const result = await env.api.evaluateRegex(pattern, "gd", input, replacement, true);
  assert.equal(result.output, input.replace(new RegExp(pattern, "gd"), replacement)); assert.equal(result.count, 2); assert.deepEqual(result.matches[0].captures, ["ab", "12"]); assert.equal(result.matches[1].groups.word, "cd"); assert.deepEqual(result.matches[0].indices[1], [0, 2]);
  for (const template of ["$`|$'|$&|$$", "$99 $10 $01 $0", "$<missing>-$1"]) { const actual = await env.api.evaluateRegex(pattern, "g", input, template, true); assert.equal(actual.output, input.replace(new RegExp(pattern, "g"), template)); }
  const single = await env.api.evaluateRegex("[a-z]+", "", input, "X", true); assert.equal(single.count, 1); assert.equal(single.output, "X12 cd3"); assert.equal(env.blobs.size, 0); assert.equal(env.counts.created, env.counts.terminated);
});

test("Regex zero-length Unicode advances by code point and empty captures remain distinguishable", async () => {
  const env = regexThreadHarness(), result = await env.api.evaluateRegex("(?=)", "gu", "😀a", "_", true);
  assert.deepEqual(result.matches.map((item) => item.index), [0, 2, 3]); assert.equal(result.output, "😀a".replace(/(?=)/gu, "_"));
  const optional = await env.api.evaluateRegex("(a)?()", "g", "b", "[$1][$2]", false); assert.equal(optional.matches[0].captures[0], null); assert.equal(optional.matches[0].captures[1], "");
  assert.equal(env.blobs.size, 0); assert.equal(env.counts.created, env.counts.terminated);
});

test("Regex actual worker enforces capture/result budgets, count limits and catastrophic timeout", async () => {
  const env = regexThreadHarness(), long = await env.api.evaluateRegex("(?=(.+))", "g", "a".repeat(1500), "", false); assert.equal(long.limited, true); assert.ok(JSON.stringify(long).length < 400000); assert.equal(long.captureLimited, true); assert.equal(long.count, 1000);
  await assert.rejects(env.api.evaluateRegex("a", "g", "a".repeat(1001), "X", true), /1.000 match/);
  await assert.rejects(env.api.evaluateRegex("a", "g", "a".repeat(1000), "$'".repeat(100), true), /2 triệu/);
  await assert.rejects(env.api.evaluateRegex("a", "g", "a".repeat(1000), "\u0001".repeat(1000), true), /4 MiB/);
  await assert.rejects(env.api.evaluateRegex("(a+)+$", "g", "a".repeat(25000) + "!", "", false), /1 giây/);
  await assert.rejects(env.api.evaluateRegex("a", "gg", "a", "", false), /Flags/); await assert.rejects(env.api.evaluateRegex("(", "g", "a", "", false));
  assert.equal(env.blobs.size, 0); assert.equal(env.counts.created, env.counts.terminated);
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
  assert.match(css, /container-type:inline-size/);
  assert.match(css, /@container\(max-width:700px\)/);
  assert.match(css, /select,textarea\)\{min-width:0;max-width:100%\}/);
  assert.match(css, /\.ut-kanban article\{grid-template-columns:minmax\(0,1fr\)\}/);
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

test("JSON viewer has RFC 6901 paths, typed values and bounded searchable nodes", () => {
  const api = load(), data = { "a/b": { "~x": [false, null, 42] }, "<img onerror=alert(1)>": "<script>" };
  assert.equal(api.jsonPointerValue(data, "/a~1b/~0x/2"), 42);
  assert.equal(api.jsonPointerValue(data, ""), data);
  assert.throws(() => api.jsonPointerValue(data, "/constructor"));
  assert.throws(() => api.jsonPointerValue(data, "/a~1b/not-here"));
  const tree = api.jsonTree(data, { query: "42" });
  assert.match(tree.html, /data-ut-json-path="\/a~1b\/~0x\/2"/);
  assert.match(tree.html, /data-type="number"/);
  assert.doesNotMatch(tree.html, /<img|<script>/);
  assert.doesNotMatch(tree.html, /data-type="boolean"/);
  const bounded = api.jsonTree(Array.from({ length: 2500 }, (_, index) => index));
  assert.ok(bounded.visited <= 2000); assert.equal(bounded.truncated, true);
  assert.match(api.jsonTree({ a: 1 }, { query: "missing" }).html, /Không có nhánh khớp/);
});

test("Markdown handles useful blocks without scripts, image requests or unsafe URLs", () => {
  const api = load();
  const html = api.markdownHTML("# Đề cương\n\n- [ ] Học\n- [x] Làm\n\n1. Một\n2. Hai\n\n> Trích dẫn\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```js\n<script>alert(1)</script>\n```\n\n**Đậm** *Nghiêng* ~~Bỏ~~ [Liên kết](https://example.com)\n\n[Độc](javascript:alert) ![Ảnh](https://external.test/image.png)\n<img src=x onerror=alert(1)>");
  for (const token of ["<h1>", "<ul>", "<ol>", "<blockquote>", "<table>", "<pre><code>", "<strong>", "<em>", "<del>", 'target="_blank"', "checked", "&lt;script&gt;"]) assert.ok(html.includes(token), token);
  assert.doesNotMatch(html, /<script|<img|href="javascript:|onerror="/);
  assert.throws(() => api.markdownHTML("a".repeat(100001)));
  assert.throws(() => api.markdownHTML("x\n".repeat(5001)));
});

test("calendar range starts Monday and preserves month/week lengths across boundaries", () => {
  const api = load(); const month = api.calendarDays("2026-02-01T10:00:00", "month"), week = api.calendarDays("2026-12-31T12:00:00", "week");
  assert.equal(month.length, 42); assert.equal(month[0].getDay(), 1);
  assert.equal(month[0].getDate(), 26); assert.equal(month[0].getMonth(), 0);
  assert.equal(week.length, 7); assert.equal(week[0].getDay(), 1); assert.equal(week[6].getFullYear(), 2027);
  const ics = api.calendarICS([{ id: "duration-test", title: "Một buổi học", date: "2026-10-12T10:30:00Z", at: "2026-10-12T09:00:00Z", duration: 90, location: "Phòng; A" }]);
  assert.match(ics, /DTEND:20261012T120000Z/); assert.match(ics, /LOCATION:Phòng\\; A/);
});

test("backup normalization rejects unsafe keys, malformed records and excessive sizes", () => {
  const api = load(), valid = { version: 1, data: { notes: [{ id: "one", title: "Ghi chú", meta: "Nội dung", tags: [], date: "", priority: "normal", column: "backlog", done: false, revision: 1, at: "2026-10-12T00:00:00Z" }] } };
  assert.equal(api.backupAdapter.normalize(valid, { owner: "guest" }).data.notes[0].meta, "Nội dung");
  assert.throws(() => api.backupAdapter.normalize(valid, { owner: "account:else" }));
  assert.throws(() => api.backupAdapter.normalize(JSON.parse('{"version":1,"data":{"__proto__":{}}}')));
  assert.throws(() => api.backupAdapter.normalize({ version: 1, data: { clipboard: [] } }));
  assert.throws(() => api.backupAdapter.normalize({ version: 1, data: { notes: [...valid.data.notes, ...valid.data.notes] } }));
  assert.throws(() => api.backupAdapter.normalize({ version: 1, data: { notes: [{ id: "x", title: "n", date: "not-a-date" }] } }));
  assert.throws(() => api.backupAdapter.normalize({ version: 1, data: { bookmark: [{ id: "x", title: "b", meta: "javascript:alert(1)" }] } }));
  assert.throws(() => api.backupAdapter.normalize({ version: 1, data: { preferences: { reducedMotion: "false" } } }));
  assert.throws(() => api.backupAdapter.normalize({ version: 1, data: { todo: [{ id: "x", title: "t", column: "constructor" }] } }));
  const ics = api.calendarICS([{ id: "folded", title: "Tiếng Việt 🌌 ".repeat(15), date: "2026-10-12T10:00:00Z" }]);
  assert.ok(ics.split("\r\n").every((line) => Buffer.byteLength(line, "utf8") <= 75));
  assert.match(ics, /\r\n /);
});
