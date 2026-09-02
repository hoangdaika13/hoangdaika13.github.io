const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const tools = require("../galaxy-layer-one-tools.js");

test("Markdown preview escapes executable markup and keeps basic structure", () => {
  const html = tools.markdownToSafeHtml("# Tiêu đề\n\n- **Một**\n- Hai\n\n<script>alert(1)</script>");
  assert.match(html, /<h1>Tiêu đề<\/h1>/);
  assert.match(html, /<ul><li><strong>Một<\/strong><\/li><li>Hai<\/li><\/ul>/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script\b/i);
});

test("Markdown links allow only explicit web and mail protocols", () => {
  const html = tools.markdownToSafeHtml("[an toàn](https://hoang8.com) [xấu](javascript:alert(1))");
  assert.match(html, /href="https:\/\/hoang8\.com\//);
  assert.doesNotMatch(html, /javascript:/i);
});

test("CSV parser handles quoted commas, CRLF and escaped quotes", () => {
  const rows = tools.parseCsv('name,note\r\n"Hà, My","Nói ""xin chào"""\r\n');
  assert.deepEqual(rows, [["name", "note"], ["Hà, My", 'Nói "xin chào"']]);
});

test("CSV and JSON conversion round-trip safely", () => {
  const records = tools.csvToObjects("name,age\nAn,12\nBình,14");
  assert.equal(Object.getPrototypeOf(records[0]), null);
  assert.deepEqual({ ...records[1] }, { name: "Bình", age: "14" });
  assert.equal(tools.objectsToCsv(records), "name,age\nAn,12\nBình,14");
});

test("CSV rejects duplicate headers and unterminated quotes", () => {
  assert.throws(() => tools.csvToObjects("id,id\n1,2"), { code: "CSV_DUPLICATE_HEADER" });
  assert.throws(() => tools.parseCsv('id,note\n1,"open'), { code: "CSV_UNCLOSED_QUOTE" });
});

test("SHA-256 uses Web Crypto and returns a real digest", async () => {
  assert.equal(await tools.sha256Hex("abc", crypto.webcrypto), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("QR creation fails closed without a bundled engine", () => {
  assert.throws(() => tools.createQrSvg("HH Galaxy", null), { code: "QR_ENGINE_UNAVAILABLE" });
});

test("source has no network calls, eval, or storage side effects", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "galaxy-layer-one-tools.js"), "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|\.sendBeacon\s*\(/);
  assert.doesNotMatch(source, /\beval\s*\(|new\s+Function\s*\(/);
  assert.doesNotMatch(source, /localStorage|indexedDB/);
});
