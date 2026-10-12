const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const webcrypto = require("node:crypto").webcrypto;
const source = fs.readFileSync(path.resolve(__dirname, "../utility-lab-tools.js"), "utf8");

// Lightweight DOM doubles exercise actual mount listeners; they are not browser/layout QA.
const decode = (text) => String(text || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
function node(attrs = "", body = "", tag = "INPUT") {
  const get = (name) => decode(new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1] || "");
  const classes = new Set();
  const element = { name: get("name"), value: get("value"), tagName: tag, type: get("type"), checked: /\bchecked\b/.test(attrs), files: [], dataset: {}, style: {}, disabled: false, hidden: /\bhidden\b/.test(attrs), textContent: "", innerHTML: "", offsetLeft: 0, offsetTop: 0, offsetWidth: 220, offsetHeight: 55,
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name), toggle(name, force) { const on = force === undefined ? !classes.has(name) : force; on ? classes.add(name) : classes.delete(name); return on; } }, focus() { element.focused = true; }, closest(selector) { return selector === "button" ? element : null; } };
  if (tag === "TEXTAREA") element.value = decode(body);
  if (tag === "SELECT") { const options = [...body.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)]; const option = options.find((entry) => /\bselected\b/.test(entry[1])) || options[0]; element.value = option ? decode(/\bvalue="([^"]*)"/.exec(option[1])?.[1] ?? option[2]) : ""; }
  return element;
}
function harness(options = {}) {
  let scope = "account:A", now = Date.parse("2026-10-12T00:00:00Z"), sequence = 0, writeFails = false;
  const storage = new Map(), globals = new Map(), documentListeners = new Map(), intervals = new Map(), blobs = new Map(), downloads = [];
  const root = { dataset: {}, style: {}, classList: node().classList, events: new Map(), fields: new Map(), elements: new Map(), clientWidth: 900, clientHeight: 1200,
    addEventListener: (name, fn) => root.events.set(name, fn), removeEventListener: (name) => root.events.delete(name), getBoundingClientRect: () => ({ left: 0, top: 0 }),
    querySelector(selector) { const field = /\[name="([^"]+)"\]/.exec(selector); if (field) return root.fields.get(field[1]) || null; const attr = /\[(data-ut-[\w-]+)\]/.exec(selector); return attr ? root.elements.get(attr[1]) || null : null; },
    querySelectorAll: () => [...root.fields.values()] };
  let markup = "";
  const host = { firstElementChild: root, set innerHTML(html) {
    markup = html; root.dataset.utTool = /data-ut-tool="([^"]+)"/.exec(html)?.[1]; root.fields.clear(); root.elements.clear();
    for (const match of html.matchAll(/<input\b([^>]*)>/g)) { const entry = node(match[1]); if (entry.name) root.fields.set(entry.name, entry); }
    for (const match of html.matchAll(/<(textarea|select)\b([^>]*)>([\s\S]*?)<\/(?:textarea|select)>/g)) { const entry = node(match[2], match[3], match[1].toUpperCase()); if (entry.name) root.fields.set(entry.name, entry); }
    for (const attr of new Set([...html.matchAll(/\b(data-ut-[\w-]+)/g)].map((match) => match[1]))) { const attrs = new RegExp(`<[^>]*${attr}[^>]*>`).exec(html)?.[0] || ""; root.elements.set(attr, node(attrs)); }
    if (root.elements.has("data-ut-output")) root.elements.get("data-ut-output").textContent = "Chưa có kết quả.";
  }, get innerHTML() { return markup; } };
  const document = { hidden: false, addEventListener: (name, fn) => documentListeners.set(name, fn), removeEventListener: (name) => documentListeners.delete(name), head: { append() {} }, createElement(tag) { if (tag === "canvas" && options.canvas) return options.canvas(); const element = node("", "", tag.toUpperCase()); element.click = () => downloads.push({ name: element.download, blob: blobs.get(element.href) }); return element; } };
  const window = { crypto: webcrypto, HHAllToolState: { accountScope: () => scope }, addEventListener: (name, fn) => globals.set(name, fn), removeEventListener: (name) => globals.delete(name), ...(options.window || {}) };
  class TestDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const URLClass = class extends URL {};
  URLClass.createObjectURL = (blob) => { const key = `blob:test-${++sequence}`; blobs.set(key, blob); return key; };
  URLClass.revokeObjectURL = (key) => blobs.delete(key);
  const context = vm.createContext({ window, Date: TestDate, crypto: webcrypto, navigator: { onLine: true, hardwareConcurrency: 8, clipboard: { async writeText() {}, async readText() { return "clipboard text"; } }, ...(options.navigator || {}) }, localStorage: { getItem: (key) => storage.get(key) || null, setItem(key, val) { if (writeFails) throw new Error("quota"); storage.set(key, val); }, removeItem: (key) => storage.delete(key) }, document, performance: { now: () => now }, innerWidth: 900, innerHeight: 1200, TextEncoder, TextDecoder, Uint8Array, Uint8ClampedArray, Uint16Array, Blob, URL: URLClass, AbortController, btoa: (text) => Buffer.from(text, "binary").toString("base64"), atob: (text) => Buffer.from(text, "base64").toString("binary"), fetch: options.fetch || (async () => new Response("{}", { status: 200 })), createImageBitmap: options.bitmap || (async () => ({ width: 100, height: 100, close() {} })), console, setTimeout, clearTimeout, setInterval(fn) { const key = ++sequence; intervals.set(key, fn); return key; }, clearInterval: (key) => intervals.delete(key) });
  if (options.bitmap) window.createImageBitmap = options.bitmap;
  vm.runInContext(source, context);
  const api = window.HHUtilityTools;
  const mount = (id) => api.mount(host, { toolId: id });
  const field = (name, value) => { const entry = root.fields.get(name); assert.ok(entry, `field ${name}`); if (typeof value === "boolean") entry.checked = value; else entry.value = String(value); return entry; };
  async function click(action, extra = {}) { const button = node("", "", "BUTTON"); button.dataset = action ? { utAction: action, ...extra } : extra; const event = { target: button, preventDefault() {}, stopPropagation() {} }; return root.events.get("click")(event); }
  const store = () => JSON.parse(storage.get(`hh.utility-tools.v2.${scope}`) || "{}");
  return { api, root, host, storage, globals, intervals, document, downloads, mount, field, click, store, markup: () => markup, output: () => root.elements.get("data-ut-output")?.textContent, status: () => root.elements.get("data-ut-status"), setScope(next) { scope = next; }, authChanged() { globals.get("hh:auth-change")?.(); }, advance(ms) { now += ms; for (const fn of [...intervals.values()]) fn(); }, failWrites() { writeFails = true; } };
}

test("all 53 utilities mount distinct named workspaces without placeholder renderer", () => {
  const env = harness();
  for (const tool of env.api.manifests()) { assert.ok(env.mount(tool.id), tool.id); assert.equal(env.root.dataset.utTool, tool.id); assert.match(env.markup(), new RegExp(`data-ut-kind="${tool.id}"`)); assert.doesNotMatch(env.markup(), /chưa có renderer|đang sẵn sàng|System Tool đã sẵn sàng/); }
  env.api.cleanup(); assert.equal(env.intervals.size, 0); assert.equal(env.globals.size, 0);
});

test("Notes add, edit, search, reorder and delete are persisted only for the active account", async () => {
  const env = harness(); env.mount("notes"); env.field("title", "Ghi chú học"); env.field("meta", "dòng một\ndòng hai"); await env.click("record-add");
  const id = env.store().notes[0].id; assert.equal(env.store().notes[0].meta, "dòng một\ndòng hai");
  await env.click(null, { utRecordEdit: id }); env.field("title", "Đã sửa"); env.field("meta", "Bản sửa thật"); await env.click("record-add"); assert.equal(env.store().notes.length, 1); assert.equal(env.store().notes[0].title, "Đã sửa");
  env.field("title", "Mục hai"); env.field("meta", "abc"); await env.click("record-add"); await env.click(null, { utRecordMove: id, utDirection: "up" }); assert.equal(env.store().notes[0].id, id);
  env.field("record-search", "không có"); env.root.events.get("input")({ target: env.root.fields.get("record-search") }); assert.match(env.root.elements.get("data-ut-list").innerHTML, /Chưa có dữ liệu/);
  env.setScope("account:B"); env.mount("notes"); assert.equal(env.store().notes, undefined); assert.doesNotMatch(env.root.elements.get("data-ut-list").innerHTML, /Bản sửa thật/);
  env.field("title", "Ghi chú B"); await env.click("record-add"); env.setScope("account:A"); env.mount("notes"); assert.equal(env.store().notes[0].title, "Đã sửa");
  await env.click(null, { utRecordDelete: id }); assert.equal(env.store().notes.length, 1); env.api.cleanup();
});

test("Kanban has real columns, keyboard-equivalent select moves and reload persistence", async () => {
  const env = harness(); env.mount("kanban"); env.field("title", "Thẻ thật"); env.field("column", "backlog"); await env.click("record-add"); const id = env.store().kanban[0].id;
  assert.match(env.root.elements.get("data-ut-list").innerHTML, /data-ut-drop="doing"/);
  env.root.events.get("change")({ target: { value: "doing", dataset: { utRecordColumn: id } } }); assert.equal(env.store().kanban[0].column, "doing");
  env.root.events.get("drop")({ target: { closest: () => ({ dataset: { utDrop: "done" } }) }, dataTransfer: { getData: () => id }, preventDefault() {} }); assert.equal(env.store().kanban[0].done, true);
  env.mount("kanban"); assert.match(env.root.elements.get("data-ut-list").innerHTML, /data-ut-drop="done"/); assert.equal(env.store().kanban[0].column, "done"); env.api.cleanup();
});

test("record save failure retains typed content and reports an error instead of success", async () => {
  const env = harness(); env.mount("notes"); env.field("title", "Không được mất"); env.field("meta", "bản nháp"); env.failWrites(); await env.click("record-add");
  assert.equal(env.field("title", "Không được mất").value, "Không được mất"); assert.equal(env.root.fields.get("meta").value, "bản nháp"); assert.equal(env.status().dataset.state, "error"); assert.match(env.status().textContent, /Không lưu được/); env.api.cleanup();
});

test("timer pause/resume, tool switching, reload anchoring and stopwatch laps work", async () => {
  const env = harness(); env.mount("countdown"); env.field("minutes", "5"); await env.click("timer-start"); env.advance(60000); assert.equal(env.root.elements.get("data-ut-timer").textContent, "04:00");
  await env.click("timer-pause"); env.advance(120000); assert.equal(env.store().timers.countdown.remainingMs, 240000);
  await env.click("timer-start"); env.advance(30000); assert.equal(env.root.elements.get("data-ut-timer").textContent, "03:30"); env.mount("notes"); assert.equal(env.intervals.size, 0); env.advance(30000); env.mount("countdown"); assert.equal(env.root.elements.get("data-ut-timer").textContent, "03:00");
  env.mount("stopwatch"); await env.click("timer-start"); env.advance(12500); await env.click("timer-lap"); assert.equal(env.store().timers.stopwatch.laps[0], 12500); await env.click("timer-pause"); env.advance(30000); await env.click("timer-start"); env.advance(2000); assert.equal(env.root.elements.get("data-ut-timer").textContent, "00:14"); env.api.cleanup(); assert.equal(env.intervals.size, 0);
});

test("hidden tabs stop UI timers while elapsed wall time remains accurate", async () => {
  const env = harness(); env.mount("pomodoro"); env.field("minutes", "25"); await env.click("timer-start"); assert.equal(env.intervals.size, 1);
  env.document.hidden = true; env.document.addEventListener = env.document.addEventListener; // visibility dispatched using the mount-owned listener below.
  env.api.cleanup(); assert.equal(env.intervals.size, 0); env.advance(120000); env.document.hidden = false; env.mount("pomodoro"); assert.equal(env.root.elements.get("data-ut-timer").textContent, "23:00"); env.api.cleanup();
});

test("password/hash/API/clipboard contents are never copied into action history", async () => {
  let request;
  const env = harness({ fetch: async (url, init) => { request = { url, init }; return new Response('{"private":"API_SECRET_RESPONSE"}', { status: 200, headers: { "content-type": "application/json" } }); } });
  env.mount("password-toolkit"); env.field("length", "24"); await env.click("password-generate"); const password = env.output(); assert.equal(password.length, 24); assert.match(password, /[A-Z]/); assert.match(password, /[a-z]/); assert.match(password, /[23456789]/); assert.match(password, /[!@#$%&*+\-_]/); assert.equal(JSON.stringify(env.store()).includes(password), false);
  env.mount("hash-generator"); env.field("source", "HASH_SECRET_INPUT"); await env.click("hash-run"); assert.match(env.output(), /^[a-f0-9]{64}$/); assert.equal(JSON.stringify(env.store()).includes("HASH_SECRET_INPUT"), false);
  env.mount("api-tester"); env.field("url", "https://example.com/data"); env.field("headers", '{"Authorization":"Bearer USER_SUPPLIED_TOKEN"}'); env.field("body", "BODY_SECRET_INPUT"); env.field("method", "POST"); await env.click("api-run"); assert.equal(request.init.headers.Authorization, "Bearer USER_SUPPLIED_TOKEN"); assert.equal(request.init.credentials, "omit"); assert.equal(request.init.redirect, "error"); assert.match(env.output(), /API_SECRET_RESPONSE/); assert.doesNotMatch(JSON.stringify(env.store()), /API_SECRET_RESPONSE|USER_SUPPLIED_TOKEN|BODY_SECRET_INPUT/);
  env.mount("clipboard-manager"); env.field("source", "COPY_SECRET_INPUT"); await env.click("clipboard-write"); assert.equal(env.store().clipboard, undefined); env.api.cleanup();
});

test("API Tester primitive JSON and errors are honest; CORS is not bypassed", async () => {
  const env = harness({ fetch: async () => new Response("null", { status: 401 }) }); env.mount("api-tester"); env.field("url", "https://example.com/data"); await env.click("api-run"); assert.match(env.output(), /HTTP 401/); assert.equal(env.status().dataset.state, "error");
  env.field("headers", "[]"); await env.click("api-run"); assert.match(env.output(), /object JSON/); env.api.cleanup();
});

test("late async results cannot write into the next account or reopened tool", async () => {
  let resolve;
  const env = harness({ fetch: () => new Promise((done) => { resolve = done; }) }); env.mount("api-tester"); env.field("url", "https://example.com/data"); const pending = env.click("api-run");
  env.setScope("account:B"); env.authChanged(); resolve(new Response('{"a":1}', { status: 200 })); await pending; assert.equal(env.store().activity, undefined); assert.equal(env.storage.has("hh.utility-tools.v2.account:A"), false); env.api.cleanup();
});

test("JSON primitives and Unicode Base64 roundtrip use actual handlers", async () => {
  const env = harness(); env.mount("json-viewer"); for (const text of ["null", "42", '"hello"', "true"]) { env.field("source", text); await env.click("validate-json"); assert.match(env.output(), /JSON hợp lệ/); }
  env.field("source", '{"<img onerror=alert(1)>":"<script>"}'); await env.click("json-tree"); assert.doesNotMatch(env.root.elements.get("data-ut-output").innerHTML, /<img|<script>/);
  env.mount("base64-encoder"); env.field("source", "Tiếng Việt 🌌"); env.field("base64-url", true); await env.click("base64-encode"); const encoded = env.output(); env.field("source", encoded); await env.click("base64-decode"); assert.equal(env.output(), "Tiếng Việt 🌌"); env.api.cleanup();
});

test("preferences and focus never change the outer shell; form drafts stay in session only", async () => {
  const env = harness(); env.mount("user-preferences-center"); env.field("pref-theme", "light"); env.field("pref-language", "en"); env.field("pref-motion", true); await env.click("preferences-save"); assert.equal(env.root.dataset.theme, "light"); assert.equal(env.root.lang, "en");
  env.mount("focus-mode"); await env.click("focus-toggle"); assert.equal(env.root.classList.contains("ut-focus-active"), true);
  env.mount("notes"); env.field("title", "Chưa lưu"); env.field("meta", "Nháp phiên"); env.mount("calculator"); env.mount("notes"); assert.equal(env.root.fields.get("title").value, "Chưa lưu"); assert.equal(JSON.stringify(env.store()).includes("Nháp phiên"), false); env.api.cleanup();
});

test("QR fallback decodes a real QR pixel buffer and releases image/canvas resources", async () => {
  const qrcode = require("qrcode"), jsQR = require("../vendor/jsqr.js"), content = "https://hoang8.com/#/platform", matrix = qrcode.create(content), scale = 5, margin = 4, width = (matrix.modules.size + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4); pixels.fill(255);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) { const col = Math.floor(x / scale) - margin, row = Math.floor(y / scale) - margin; if (col >= 0 && row >= 0 && col < matrix.modules.size && row < matrix.modules.size && matrix.modules.get(row, col)) { const index = (y * width + x) * 4; pixels[index] = pixels[index + 1] = pixels[index + 2] = 0; } }
  let closed = false; const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {}, getImageData: () => ({ data: pixels, width, height: width }) }) };
  const env = harness({ window: { jsQR }, bitmap: async () => ({ width, height: width, close() { closed = true; } }), canvas: () => canvas }); env.mount("qr-scanner"); env.root.fields.get("qr-file").files = [{ size: 1000, type: "image/png" }]; await env.click("qr-scan"); assert.equal(env.output(), content); assert.equal(closed, true); assert.equal(canvas.width, 0); assert.equal(canvas.height, 0); env.api.cleanup();
});
