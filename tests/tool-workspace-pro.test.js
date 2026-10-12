const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "tool-workspace-pro.js"), "utf8");
const css = fs.readFileSync(path.join(root, "tool-workspace-pro.css"), "utf8");
const api = require(path.join(root, "tool-workspace-pro.js"));

test("publishes complete manifests for voice, AI, workspace and file tools", () => {
  const expected = [
    "voice-search", "speech-to-text", "text-to-speech", "ai-chat-assistant",
    "ai-prompt-library", "ai-prompt-optimizer", "ai-image-prompt-generator",
    "workspace-tabs", "drag-drop-dashboard", "widget-marketplace", "plugin-system",
    "auto-save", "version-history", "file-explorer", "monaco-code-editor", "ocr"
  ];
  assert.deepEqual(api.manifests.map(item => item.id), expected);
  for (const manifest of api.manifests) {
    assert.equal(typeof manifest.name, "string");
    assert.ok(["browser", "ai", "hybrid"].includes(manifest.runtime));
    assert.ok(Array.isArray(manifest.permissions));
    assert.ok(Array.isArray(manifest.inputs));
    assert.ok(manifest.actions.length >= 3);
    assert.equal(typeof manifest.history, "boolean");
    assert.equal(typeof manifest.offline, "boolean");
  }
});

test("exposes Feature Lab and route integration contract", () => {
  for (const name of ["supports", "getManifest", "render", "mount", "cleanup", "handleClick", "handleInput", "handleChange"]) {
    assert.equal(typeof api[name], "function", `${name} must be public`);
  }
  assert.equal(api.supports("OCR"), true);
  assert.equal(api.supports("speech-to-text"), true);
  assert.equal(api.supports("ai-chat"), true);
  assert.equal(api.supports("monaco-editor"), true);
  assert.equal(api.supports("Unknown Fake Tool"), false);
  assert.match(source, /host\.addEventListener\("click", clickHandler\)/);
  assert.match(source, /host\.removeEventListener\("click", clickHandler\)/);
});

test("does not persist API secrets in client code", () => {
  assert.doesNotMatch(source, /sk-[a-z0-9]{12,}/i);
  assert.doesNotMatch(source, /AIza[0-9A-Za-z_-]{20,}/);
  assert.doesNotMatch(source, /api[_-]?key\s*[:=]\s*["'][^"']+/i);
  assert.match(source, /\/api\/ai/);
  assert.match(source, /toolId: "ai-chat", action: "send", input: \{ prompt \}/);
  assert.match(source, /HHAuthSession\?\.token/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});

test("uses IndexedDB stores for records, history and binary files", () => {
  assert.match(source, /indexedDB\.open\(DB_NAME, DB_VERSION\)/);
  assert.match(source, /createObjectStore\("records"/);
  assert.match(source, /createObjectStore\("history"/);
  assert.match(source, /createObjectStore\("files"/);
  assert.match(source, /row\.blob\.text\(\)/);
});

test("local prompt engines produce structured, useful output", () => {
  const optimized = api.optimizePrompt("Lập kế hoạch phát hành video YouTube dài ba giờ", "analysis", "reasoning");
  assert.match(optimized, /VAI TRÒ/);
  assert.match(optimized, /QUY TRÌNH/);
  assert.match(optimized, /Không tự tạo sự kiện/);
  assert.match(optimized, /reasoning/);

  const image = api.imagePrompt("Phòng jazz đêm mưa nhìn qua cửa sổ", "cinematic", "16:9");
  assert.match(image, /PROMPT/);
  assert.match(image, /CAMERA & LIGHT/);
  assert.match(image, /NEGATIVE PROMPT/);
  assert.match(image, /16:9/);
});

test("subtitle export builds valid SRT and WebVTT structures", () => {
  const input = "Xin chào. Đây là bản chép lời thử nghiệm.";
  const srt = api.formatTranscript(input, "srt");
  const vtt = api.formatTranscript(input, "vtt");
  assert.match(srt, /^1\n00:00:00,000 --> 00:00:04,000/);
  assert.match(srt, /2\n00:00:04,000 --> 00:00:08,000/);
  assert.match(vtt, /^WEBVTT/);
  assert.match(vtt, /00:00\.000 --> 00:04\.000/);
});

test("OCR, speech, Monaco and plugin systems provide real capability gates", () => {
  assert.match(source, /SpeechRecognition|webkitSpeechRecognition/);
  assert.match(source, /speechSynthesis\.getVoices/);
  assert.match(source, /navigator\.mediaDevices\?\.getUserMedia/);
  assert.match(source, /new MediaRecorder\(stream\)/);
  assert.match(source, /Chép file chưa khả dụng/);
  assert.match(source, /không có diarization\/timestamp chính xác/);
  assert.match(source, /formatSegments\(active\.transcriptSegments/);
  assert.match(source, /globalThis\.TextDetector/);
  assert.match(source, /loadLocalOcr\(\)/);
  assert.match(source, /tesseract\.createWorker\(languages, 1/);
  assert.match(source, /\/vendor\/tessdata\//);
  assert.match(source, /worker\.terminate\(\)/);
  assert.match(source, /run\.canceled/);
  assert.match(source, /monaco\.editor\.create/);
  assert.match(source, /Không cho phép mã thực thi trong manifest/);
  assert.match(source, /plugin\.entry \|\| plugin\.script \|\| plugin\.code/);
  assert.match(source, /PLUGIN_ENGINES/);
  assert.doesNotMatch(source, /new Function|eval\(/);
});

test("all 16 workspaces have concrete differentiated controls and purpose", () => {
  const layouts = api.manifests.map(manifest => api.renderMarkup(manifest.id));
  assert.equal(new Set(layouts).size, 16);
  for (const [index, html] of layouts.entries()) {
    assert.match(html, new RegExp(`data-hh-tool="${api.manifests[index].id}"`));
    assert.match(html, /ALL TOOLS · WORKSPACE RIÊNG/);
    assert.match(html, /data-tool-(input|action|file)/);
  }
  assert.match(api.renderMarkup("speech-to-text"), /download-recording/);
  assert.match(api.renderMarkup("plugin-system"), /line-sort/);
  assert.match(api.renderMarkup("drag-drop-dashboard"), /widget-kind/);
  assert.match(api.renderMarkup("ai-chat"), /data-tool-paid-consent/);
  assert.equal(api.supports("platform-voice-search"), true);
  assert.equal(api.supports("workspace-ai-prompt-library"), true);
});

test("vetted plugin engines work locally and reject executable/unknown manifests", () => {
  assert.equal(api.runPlugin("text-uppercase", "xin chào"), "XIN CHÀO");
  assert.equal(api.runPlugin("text-trim", "  hello  \n world "), "hello\nworld");
  assert.equal(api.runPlugin("line-sort", "z\na\nb"), "a\nb\nz");
  const safe = { id: "line-helper", name: "Line Helper", version: "1.0.0", engine: "line-sort", permissions: [] };
  assert.equal(api.validatePlugin(safe).engine, "line-sort");
  assert.throws(() => api.validatePlugin({ ...safe, code: "alert(1)" }), /mã thực thi/);
  assert.throws(() => api.validatePlugin({ ...safe, engine: "toString" }), /chưa được duyệt/);
  assert.throws(() => api.validatePlugin({ ...safe, permissions: ["microphone"] }), /permissions phải rỗng/);
  assert.throws(() => api.runPlugin("__proto__", "a"), /chưa được duyệt/);
});

test("records and binary files are isolated by owner without adopting legacy unowned data", async () => {
  await api.storage.put("records", { id: "same", content: "A" }, "account:A");
  await api.storage.put("records", { id: "same", content: "B" }, "account:B");
  assert.equal((await api.storage.get("records", "same", "account:A")).content, "A");
  assert.equal((await api.storage.get("records", "same", "account:B")).content, "B");
  assert.equal(await api.storage.get("records", "same", "guest"), null);
  await api.storage.delete("records", "same", "account:B");
  assert.equal((await api.storage.get("records", "same", "account:A")).content, "A");
  await api.storage.put("files", { id: "binary", blob: new Blob(["hello"]), name: "hello.txt" }, "account:A");
  assert.equal(await (await api.storage.get("files", "binary", "account:A")).blob.text(), "hello");
  assert.deepEqual(await api.storage.list("files", () => true, "account:B"), []);
  assert.match(source, /filter\(row => row\.owner === owner\)/);
});

test("AI gateway uses one request and does not fall back after a provider error", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (url, options) => { calls += 1; assert.equal(url, "/api/ai"); const body = JSON.parse(options.body); assert.equal(body.action, "send"); assert.equal(body.input.prompt, "hello"); return { ok: true, json: async () => ({ result: { text: "answer", provider: "gemini" } }) }; };
    assert.equal((await api.requestAi({ toolId: "ai-chat", action: "send", input: { prompt: "hello" } })).text, "answer");
    assert.equal(calls, 1);
    calls = 0;
    globalThis.fetch = async () => { calls += 1; return { ok: false, status: 503, json: async () => ({ error: "not configured" }) }; };
    await assert.rejects(api.requestAi({ toolId: "ai-chat", action: "send", input: { prompt: "hello" } }), /not configured/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("lifecycle preserves documents, cancels resources and does not display fake widget counts", () => {
  assert.match(source, /saveCurrentTab\(host\)/);
  assert.match(source, /snapshot\.values\.code = editorValue\(host\)/);
  assert.match(source, /active\.epoch \+= 1/);
  assert.match(source, /active\.detach\?\.\(\)/);
  assert.match(source, /active\.urls\.forEach\(url => URL\.revokeObjectURL\(url\)\)/);
  assert.doesNotMatch(source, /3 việc ưu tiên|0 đang chạy|Sẵn sàng cấu hình/);
  assert.doesNotMatch(source, /hh:prompt-use|hh:tool-search/);
});

test("interface is responsive, keyboard-visible and motion-safe", () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /overflow: auto/);
});

test("new assets contain no common mojibake sequences", () => {
  const combined = `${source}\n${css}`;
  for (const token of ["Ã", "Â", "Ä", "â€", "ï¿½", "�"]) assert.equal(combined.includes(token), false, `unexpected mojibake token ${token}`);
  assert.match(combined, /Không thể/);
  assert.match(combined, /Tiếng Việt/);
});
