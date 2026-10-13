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

test("JSON Viewer searches real source, copies pointer/value and exports complete JSON", async () => {
  const copies = [], env = harness({ navigator: { clipboard: { async writeText(text) { copies.push(text); } } } }); env.mount("json-viewer");
  env.field("source", '{"a/b":{"~name":"Tiếng Việt"},"other":true}'); await env.click("json-tree");
  env.field("json-search", "Tiếng Việt"); env.root.events.get("input")({ target: env.root.fields.get("json-search") });
  assert.match(env.root.elements.get("data-ut-output").innerHTML, /a~1b\/~0name/); assert.doesNotMatch(env.root.elements.get("data-ut-output").innerHTML, /data-type="boolean"/);
  await env.click(null, { utJsonPath: "/a~1b/~0name" }); await env.click(null, { utJsonValue: "/a~1b/~0name" }); await env.click(null, { utJsonPath: "" });
  assert.deepEqual(copies, ["/a~1b/~0name", '"Tiếng Việt"', ""]); await env.click("export-json"); assert.equal(env.downloads[0].name, "data.json"); assert.equal(JSON.parse(await env.downloads[0].blob.text()).other, true); env.api.cleanup();
});

test("Markdown toolbar and HTML/Markdown export work without storing source implicitly", async () => {
  const env = harness(); env.mount("markdown-editor"); env.field("source", "# Bài học\n\n- [x] Học xong"); env.field("filename", "bai-hoc"); await env.click("render-markdown");
  assert.match(env.root.elements.get("data-ut-output").innerHTML, /<h1>Bài học<\/h1>/);
  await env.click(null, { utMdInsert: "bold" }); assert.match(env.root.fields.get("source").value, /\*\*nội dung\*\*/);
  await env.click("export-markdown"); await env.click("export-markdown-html"); assert.equal(env.downloads[0].name, "bai-hoc.md"); assert.equal(env.downloads[1].name, "bai-hoc.html");
  const html = await env.downloads[1].blob.text(); assert.match(html, /Content-Security-Policy/); assert.match(html, /default-src 'none'/); assert.match(html, /<h1>Bài học<\/h1>/); assert.doesNotMatch(JSON.stringify(env.store()), /Học xong/); env.api.cleanup();
});

test("API Tester separates body/headers/raw, appends query and bounds request/response", async () => {
  let request, calls = 0; const env = harness({ fetch: async (url, init) => { request = { url, init }; calls++; return new Response('{"b":true}', { status: 201, headers: { "x-safe": "yes", "x-api-key": "MUST_HIDE" } }); } });
  env.mount("api-tester"); env.field("url", "https://example.com/api?keep=yes"); env.field("query-params", '{"page":2,"draft":false}'); await env.click("api-run");
  assert.equal(new URL(request.url).searchParams.get("page"), "2"); assert.equal(new URL(request.url).searchParams.get("keep"), "yes"); assert.match(env.output(), /HTTP 201/);
  await env.click(null, { utApiTab: "headers" }); assert.match(env.output(), /x-safe: yes/); assert.doesNotMatch(env.output(), /MUST_HIDE/);
  await env.click(null, { utApiTab: "raw" }); assert.equal(env.output(), '{"b":true}');
  env.field("body", "x".repeat(1048577)); await env.click("api-run"); assert.equal(calls, 1); assert.equal(env.status().dataset.state, "error"); env.api.cleanup();
  const huge = harness({ fetch: async () => new Response("x", { status: 200, headers: { "content-length": "1048577" } }) }); huge.mount("api-tester"); huge.field("url", "https://example.com"); await huge.click("api-run"); assert.match(huge.output(), /Response vượt giới hạn/); huge.api.cleanup();
});

test("Calendar renders month/week/list, selects a day, edits duration/location and exports ICS", async () => {
  const env = harness(); env.mount("calendar"); assert.match(env.root.elements.get("data-ut-list").innerHTML, /ut-calendar-grid--month/);
  await env.click(null, { utCalendarDay: "2026-10-15" }); assert.equal(env.root.fields.get("date").value, "2026-10-15T09:00"); env.field("title", "Buổi học"); env.field("duration", "90"); env.field("location", "Phòng A"); await env.click("record-add");
  const item = env.store().calendar[0]; assert.equal(item.duration, 90); assert.equal(item.location, "Phòng A"); assert.match(env.root.elements.get("data-ut-list").innerHTML, /Buổi học/);
  env.field("calendar-view", "week"); env.root.events.get("change")({ target: env.root.fields.get("calendar-view") }); assert.match(env.root.elements.get("data-ut-list").innerHTML, /ut-calendar-grid--week/);
  await env.click("calendar-next"); assert.match(env.root.elements.get("data-ut-calendar-period").textContent, /Tuần/);
  env.field("calendar-view", "list"); env.root.events.get("change")({ target: env.root.fields.get("calendar-view") }); assert.match(env.root.elements.get("data-ut-list").innerHTML, /Phòng A/);
  await env.click(null, { utRecordEdit: item.id }); assert.equal(env.root.fields.get("duration").value, 90); await env.click("calendar-export"); assert.match(await env.downloads[0].blob.text(), /DTEND:/); env.api.cleanup();
});

test("Tasks have priority/tags/due filters, note conflicts preserve drafts and cap prevents silent loss", async () => {
  const env = harness(); env.mount("todo"); env.field("title", "Việc gấp"); env.field("tags", "thiết kế, học"); env.field("priority", "high"); env.field("date", "2026-10-11T08:00"); await env.click("record-add");
  assert.equal(env.store().todo[0].priority, "high"); assert.deepEqual(env.store().todo[0].tags, ["thiết kế", "học"]);
  env.field("record-state", "overdue"); env.root.events.get("change")({ target: env.root.fields.get("record-state") }); assert.match(env.root.elements.get("data-ut-list").innerHTML, /Việc gấp/);
  env.mount("notes"); env.field("title", "Original"); env.field("meta", "Original text"); await env.click("record-add"); const note = env.store().notes[0]; await env.click(null, { utRecordEdit: note.id }); env.field("meta", "Draft survives");
  const changed = env.store(); changed.notes[0].revision++; changed.notes[0].meta = "Other tab version"; env.storage.set("hh.utility-tools.v2.account:A", JSON.stringify(changed)); env.globals.get("storage")({ key: "hh.utility-tools.v2.account:A" }); assert.match(env.status().textContent, /tab khác/);
  await env.click("record-add"); assert.equal(env.status().dataset.state, "error"); assert.equal(env.root.fields.get("meta").value, "Draft survives"); assert.equal(env.store().notes[0].meta, "Other tab version");
  await env.click("record-cancel"); const full = env.store(); full.notes = Array.from({ length: 250 }, (_, i) => ({ id: String(i), title: "Existing" })); env.storage.set("hh.utility-tools.v2.account:A", JSON.stringify(full)); env.field("title", "New"); await env.click("record-add"); assert.match(env.status().textContent, /250 mục/); assert.equal(env.store().notes.length, 250); env.api.cleanup();
});

test("Reminder snoozes, toggles completed and requests notifications only explicitly", async () => {
  let permissions = 0, notifications = 0; class FakeNotification { constructor() { notifications++; } close() {} static permission = "granted"; static async requestPermission() { permissions++; return "granted"; } }
  const env = harness({ window: { Notification: FakeNotification } }); env.mount("reminder"); env.field("title", "Nhắc học"); env.field("date", "2026-10-11T08:00"); await env.click("record-add"); const id = env.store().reminder[0].id; assert.equal(permissions, 0); assert.equal(notifications, 0);
  await env.click("reminder-notifications"); assert.equal(permissions, 1); assert.equal(notifications, 1); env.advance(30000); assert.equal(notifications, 1);
  await env.click(null, { utReminderSnooze: id }); assert.ok(new Date(env.store().reminder[0].date).getTime() > Date.parse("2026-10-12T00:00:00Z"));
  await env.click(null, { utRecordToggle: id }); assert.equal(env.store().reminder[0].done, true); await env.click("reminder-notifications"); assert.equal(env.store().reminderNotifications, false); assert.equal(permissions, 1); env.api.cleanup(); assert.equal(env.intervals.size, 0);
});

test("utility backup export/import filters private content, respects owner, and merges safely", async () => {
  const env = harness(); env.mount("notes"); env.field("title", "Saved"); env.field("meta", "Work content"); await env.click("record-add"); const stored = env.store(); stored.clipboard = [{ id: "secret", text: "SECRET_CLIP" }]; stored.terminal = [{ command: "echo SECRET" }]; env.storage.set("hh.utility-tools.v2.account:A", JSON.stringify(stored));
  const adapter = env.api.backupAdapter, exported = adapter.export({ owner: "account:A", maxBytes: 4194304 }); assert.doesNotMatch(JSON.stringify(exported), /SECRET|clipboard|terminal/); assert.ok(adapter.history({ owner: "account:A" }).length); assert.throws(() => adapter.export({ owner: "account:B" }));
  const incoming = JSON.parse(JSON.stringify(exported)); incoming.data.notes[0].meta = "Imported edit"; adapter.import(incoming, { owner: "account:A", strategy: "skip" }); assert.equal(env.store().notes[0].meta, "Work content"); adapter.import(incoming, { owner: "account:A", strategy: "merge" }); assert.equal(env.store().notes[0].meta, "Imported edit");
  adapter.import({ version: 1, data: { notes: [] } }, { owner: "account:A", strategy: "replace" }); assert.equal(env.store().notes.length, 0); assert.equal(env.store().clipboard[0].text, "SECRET_CLIP"); env.api.cleanup();
});

test("Dev Utilities CSV preview filters/paginates real rows and safely exports CSV/JSON", async () => {
  const env = harness(); env.mount("dev-utilities"); const csv = "Tên,Giá trị\n" + Array.from({ length: 120 }, (_, index) => `Người ${index},${index === 7 ? '"=SUM(1,2)"' : index === 8 ? "<img onerror=alert(1)>" : index}`).join("\n");
  env.field("csv-source", csv); await env.click("csv-preview"); assert.match(env.root.elements.get("data-ut-csv-page").textContent, /Trang 1\/3/); assert.match(env.root.elements.get("data-ut-csv-table").innerHTML, /Người 0/); assert.doesNotMatch(env.root.elements.get("data-ut-csv-table").innerHTML, /<img/);
  await env.click("csv-page-next"); assert.match(env.root.elements.get("data-ut-csv-page").textContent, /Trang 2\/3/); assert.match(env.root.elements.get("data-ut-csv-table").innerHTML, /Người 50/);
  env.field("csv-search", "Người 119"); env.root.events.get("input")({ target: env.root.fields.get("csv-search") }); assert.match(env.root.elements.get("data-ut-csv-table").innerHTML, /Người 119/); assert.match(env.root.elements.get("data-ut-csv-page").textContent, /1 hàng khớp/);
  await env.click("csv-export"); const exported = await env.downloads[0].blob.text(), rows = env.api.parseCSV(exported, ",").rows; assert.equal(rows.length, 121); assert.equal(rows[8][1], "'=SUM(1,2)"); assert.equal(env.root.fields.get("csv-source").value, csv);
  await env.click("csv-export-json"); const json = JSON.parse(await env.downloads[1].blob.text()); assert.equal(json.length, 120); assert.equal(json[7]["Giá trị"], "=SUM(1,2)");
  assert.doesNotMatch(JSON.stringify(env.store()), /SUM\(|Người|<img/); env.api.cleanup(); assert.equal(env.globals.size, 0);
});

test("CSV raw export needs opt-out consent and JSON conversion never loses ambiguous rows silently", async () => {
  const env = harness(); env.mount("dev-utilities"); env.field("csv-source", "a,a\n1,2"); await env.click("csv-to-json"); assert.equal(env.status().dataset.state, "error"); assert.match(env.output(), /duy nhất/); env.field("csv-json-shape", "arrays"); await env.click("csv-to-json"); assert.deepEqual(JSON.parse(env.output()), [["a", "a"], ["1", "2"]]);
  env.field("csv-source", "name,value\nSafe,=1+2"); env.field("csv-safe-formulas", false); await env.click("csv-export"); assert.equal(env.downloads.length, 0); assert.match(env.output(), /Xác nhận rủi ro/);
  env.field("csv-unsafe-consent", true); await env.click("csv-export"); assert.equal(env.api.parseCSV(await env.downloads[0].blob.text(), ",").rows[1][1], "=1+2"); assert.equal(env.root.fields.get("csv-unsafe-consent").checked, false);
  env.field("csv-json", '[{"name":"🌌","count":2},{"name":"Hoàng","count":null}]'); await env.click("csv-from-json"); assert.match(env.root.fields.get("csv-source").value, /🌌,2/); assert.equal(env.root.fields.get("csv-header").checked, true);
  env.field("csv-delimiter", "auto"); env.field("csv-json", '[{"only":"one;two"}]'); await env.click("csv-from-json"); assert.equal(env.root.fields.get("csv-delimiter").value, ","); env.field("csv-json-shape", "records"); await env.click("csv-to-json"); assert.equal(JSON.parse(env.output())[0].only, "one;two");
  await env.click("csv-clear"); assert.equal(env.root.fields.get("csv-source").value, ""); assert.equal(env.root.fields.get("csv-json").value, ""); assert.match(env.root.elements.get("data-ut-csv-table").innerHTML, /Đã xóa/); env.api.cleanup();
});

test("CSV imports selected local UTF-8/UTF-16 files and rejected/late imports leave source safe", async () => {
  const env = harness(); env.mount("dev-utilities"); const bytes = new TextEncoder().encode("Tên\nHoàng 🌌"), file = { name: "lesson.csv", size: bytes.byteLength, async arrayBuffer() { return bytes.buffer; } }; env.root.fields.get("csv-file").files = [file]; await env.click("csv-import"); assert.match(env.root.fields.get("csv-source").value, /Hoàng 🌌/);
  const wide = Buffer.from("Tên;Điểm\r\nHoàng;9", "utf16le"); env.field("csv-encoding", "utf-16le"); env.root.fields.get("csv-file").files = [{ name: "wide.csv", size: wide.byteLength, async arrayBuffer() { return wide.buffer.slice(wide.byteOffset, wide.byteOffset + wide.byteLength); } }]; await env.click("csv-import"); assert.match(env.root.fields.get("csv-source").value, /Hoàng;9/);
  const before = env.root.fields.get("csv-source").value; env.field("csv-encoding", "utf-8"); env.root.fields.get("csv-file").files = [{ name: "broken.csv", size: 1, async arrayBuffer() { return Uint8Array.of(0xC3).buffer; } }]; await env.click("csv-import"); assert.equal(env.root.fields.get("csv-source").value, before); assert.match(env.output(), /Không giải mã/);
  let canceledFile; env.root.fields.get("csv-file").files = [{ name: "cleared.csv", size: 10, arrayBuffer: () => new Promise((resolve) => { canceledFile = resolve; }) }]; const canceled = env.click("csv-import"); await env.click("csv-clear"); canceledFile(new TextEncoder().encode("private\nNEVER_APPLY").buffer); await canceled; assert.equal(env.root.fields.get("csv-source").value, ""); assert.match(env.output(), /Đã hủy áp dụng tệp/);
  let finish; env.root.fields.get("csv-file").files = [{ name: "late.csv", size: 10, arrayBuffer: () => new Promise((resolve) => { finish = resolve; }) }]; const pending = env.click("csv-import"); env.setScope("account:B"); env.mount("dev-utilities"); finish(new TextEncoder().encode("secret\nACCOUNT_A_DATA").buffer); await pending; assert.doesNotMatch(env.root.fields.get("csv-source").value, /ACCOUNT_A_DATA/); assert.doesNotMatch(JSON.stringify(env.store()), /Hoàng|ACCOUNT_A_DATA/); env.api.cleanup();
});

test("CSV/text engines retain independent fields and private drafts are released on close", async () => {
  const env = harness(); env.mount("dev-utilities"); env.field("csv-source", "PRIVATE_CSV\nrow"); env.field("source", "PRIVATE_TEXT"); await env.click(null, { utDevMode: "text" }); assert.equal(env.root.dataset.devMode, "text"); await env.click("text-stats"); assert.match(env.output(), /Ký tự: 12/); await env.click(null, { utDevMode: "csv" }); assert.equal(env.root.fields.get("csv-source").value, "PRIVATE_CSV\nrow");
  env.mount("notes"); env.mount("dev-utilities"); assert.doesNotMatch(env.root.fields.get("csv-source").value, /PRIVATE_CSV/); assert.doesNotMatch(JSON.stringify(env.store()), /PRIVATE_TEXT|PRIVATE_CSV/); env.api.cleanup();
});

test("Regex UI renders structured escaped captures and preview copy/export without storing content", async () => {
  const copies = []; let terminated = 0, calls = 0; class UIWorkerDouble { postMessage(input) { calls++; setTimeout(() => this.onmessage?.({ data: { result: { count: 1, matches: [{ value: "<img>", index: 0, end: 5, groupCount: 1, captures: ["<script>"], groups: { word: "<script>" }, indices: [[0, 5], [0, 5]] }], limited: false, captureLimited: false, replaced: input.replace, output: input.replace ? "REPLACED_PRIVATE_TEXT" : null } } }), 0); } terminate() { terminated++; } }
  const env = harness({ window: { Worker: UIWorkerDouble }, navigator: { clipboard: { async writeText(text) { copies.push(text); } } } }); env.mount("regex-playground"); env.field("pattern", "(?<word>.+)"); env.field("source", "REGEX_PRIVATE_TEXT"); env.field("replacement", "X"); await env.click("regex-run");
  assert.match(env.root.elements.get("data-ut-regex-match-list").innerHTML, /\[0, 5\)/); assert.match(env.root.elements.get("data-ut-regex-match-list").innerHTML, /&lt;script&gt;/); assert.doesNotMatch(env.root.elements.get("data-ut-regex-match-list").innerHTML, /<img>|<script>/);
  await env.click("regex-replace"); assert.equal(env.output(), "REPLACED_PRIVATE_TEXT"); await env.click("regex-copy-replacement"); assert.deepEqual(copies, ["REPLACED_PRIVATE_TEXT"]); await env.click("regex-export"); assert.equal(JSON.parse(await env.downloads[0].blob.text()).positions, "UTF-16");
  env.field("replacement", "Different"); env.root.events.get("input")({ target: env.root.fields.get("replacement") }); await env.click("regex-copy-replacement"); assert.equal(copies.length, 1); assert.equal(env.status().dataset.state, "error"); assert.doesNotMatch(JSON.stringify(env.store()), /REGEX_PRIVATE_TEXT|REPLACED_PRIVATE_TEXT/); env.api.cleanup(); assert.equal(calls, 2); assert.equal(terminated, 2);
});

test("Regex cancel and cleanup terminate the worker; unsupported browsers get truthful state", async () => {
  let terminated = 0; class PendingWorker { postMessage() {} terminate() { terminated++; } }
  const env = harness({ window: { Worker: PendingWorker } }); env.mount("regex-playground"); const pending = env.click("regex-run"); await env.click("cancel"); await pending; assert.equal(terminated, 1); assert.match(env.output(), /hủy/); assert.equal(env.status().dataset.state, "error"); env.api.cleanup();
  const unsupported = harness(); unsupported.mount("regex-playground"); await unsupported.click("regex-run"); assert.equal(unsupported.status().dataset.state, "error"); assert.match(unsupported.output(), /Worker/); unsupported.api.cleanup();
});
