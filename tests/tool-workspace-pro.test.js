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
  assert.match(source, /\/api\/tools\/run/);
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
  assert.match(source, /diarization: true, timestamps: true/);
  assert.match(source, /formatSegments\(active\.transcriptSegments/);
  assert.match(source, /globalThis\.TextDetector/);
  assert.match(source, /monaco\.editor\.create/);
  assert.match(source, /Không cho phép mã thực thi trong manifest/);
  assert.match(source, /plugin\.entry \|\| plugin\.script \|\| plugin\.code/);
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
