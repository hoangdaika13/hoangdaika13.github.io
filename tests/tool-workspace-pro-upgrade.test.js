"use strict";

const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const api = require("../tool-workspace-pro.js");

test("prompt variables substitute without evaluation and reject missing values", () => {
  assert.deepEqual(api.promptVariables("Explain {{ topic }} for {{audience}} and {{topic}}"), ["topic", "audience"]);
  assert.equal(api.fillPrompt("{{topic}} / {{audience}}", { topic: "CSS", audience: "beginners" }), "CSS / beginners");
  assert.throws(() => api.fillPrompt("Explain {{topic}}", {}), /Chưa điền biến/);
  assert.equal(api.fillPrompt("{{topic}}", { topic: "<script>alert(1)</script>" }), "<script>alert(1)</script>");
  const rows = api.validatePromptImport({ prompts: [{ title: "Reusable", content: "Explain {{topic}}", tags: [" CSS "] }] });
  assert.equal(rows[0].title, "Reusable"); assert.deepEqual(rows[0].tags, ["CSS"]);
  assert.throws(() => api.validatePromptImport({ prompts: [{ title: "Broken", content: "a" }] }), /không hợp lệ/);
  assert.throws(() => api.validatePromptImport({ prompts: [{ title: "Broken", content: "valid content", tags: [{}] }] }), /Tags/);
});

test("line comparison is deterministic, readable and bounded", () => {
  assert.deepEqual(api.compareLines("a\nb\nc", "a\nB\nc"), { added: 1, removed: 1, text: "@@ từ dòng 2 · -1 / +1 @@\n- b\n+ B" });
  assert.equal(api.compareLines("same", "same").added, 0);
  assert.throws(() => api.compareLines("x\n".repeat(4001), "a"), /4.000 dòng/);
});

test("official local Monaco runtime subset has reproducible integrity and all workers", () => {
  const folder = path.resolve(__dirname, "../vendor/monaco-0.55.1"), manifest = JSON.parse(fs.readFileSync(path.join(folder, "manifest.json"), "utf8"));
  assert.equal(manifest.version, "0.55.1"); assert.match(manifest.source, /^https:\/\/registry\.npmjs\.org\/monaco-editor\//);
  assert.equal(manifest.files.length, 34);
  for (const row of manifest.files) { const bytes = fs.readFileSync(path.join(folder, row.path)); assert.equal(bytes.length, row.bytes); assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), row.sha256); }
  assert.match(fs.readFileSync(path.join(folder, "LICENSE"), "utf8"), /MIT License/);
  for (const language of ["editor", "ts", "json", "html", "css"]) assert.ok(manifest.files.some(row => row.path.includes(`/assets/${language}.worker-`)));
  const source = fs.readFileSync(path.resolve(__dirname, "../tool-workspace-pro.js"), "utf8");
  assert.match(source, /loadLocalMonaco\(\)/); assert.match(source, /getWorker\(moduleId, label\)/); assert.match(source, /worker\.terminate\(\)/); assert.match(source, /enableSchemaRequest: false/);
  assert.match(source, /max-width: 600px/); assert.doesNotMatch(source, /https:\/\/(cdn\.|unpkg|jsdelivr)/);
});

test("WAV results are bounded and signature-checked before creating a Blob", async () => {
  const valid = Buffer.alloc(44); valid.write("RIFF", 0); valid.write("WAVE", 8);
  const result = api.decodeSpeechAudio({ mimeType: "audio/wav", data: valid.toString("base64") }); assert.equal(result.type, "audio/wav"); assert.equal(result.size, 44);
  assert.throws(() => api.decodeSpeechAudio({ mimeType: "audio/mpeg", data: valid.toString("base64") }), /không phải WAV/);
  assert.throws(() => api.decodeSpeechAudio({ mimeType: "audio/wav", data: Buffer.from("not WAV").toString("base64") }), /không hợp lệ/);
  assert.throws(() => api.decodeSpeechAudio({ mimeType: "audio/wav", data: "a".repeat(2800001) }), /vượt 2 MB/);
});

test("workspace backup round trip preserves scoped text, folders and selected binaries", async () => {
  const owner = "account:backup-test", other = "account:backup-other";
  await api.storage.put("records", { id: "backup-code", type: "code", title: "test.js", language: "javascript", content: "const saved = 1;", updatedAt: new Date().toISOString() }, owner);
  await api.storage.put("records", { id: "backup-folder", type: "tool-folder", name: "Notes" }, owner);
  await api.storage.put("files", { id: "backup-file", name: "hello.txt", folderId: "backup-folder", type: "text/plain", size: 5, blob: new Blob(["hello"]), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, owner);
  await api.storage.put("files", { id: "backup-omitted", name: "large.bin", type: "application/octet-stream", size: 1048577, blob: new Blob([new Uint8Array(1048577)]), updatedAt: new Date().toISOString() }, owner);
  await api.storage.put("records", { id: "private-other", type: "version", content: "Other account", label: "private", createdAt: new Date().toISOString() }, other);
  const exported = await api.exportWorkspaceData({ owner, includeFiles: true, maxBytes: 4194304 });
  assert.equal(exported.files.length, 1); assert.equal(exported.omittedFiles.length, 1); assert.equal(exported.records.length, 2); assert.equal(JSON.stringify(exported).includes("Other account"), false); assert.equal(exported.records.some(row => Object.hasOwn(row, "owner")), false);
  await api.storage.put("records", { id: "backup-code", type: "code", title: "changed.js", language: "javascript", content: "changed" }, owner);
  await api.importWorkspaceData(exported, { owner, strategy: "replace" });
  assert.equal((await api.storage.get("records", "backup-code", owner)).content, "const saved = 1;");
  assert.equal(await (await api.storage.get("files", "backup-file", owner)).blob.text(), "hello");
  assert.equal((await api.storage.get("files", "backup-omitted", owner)).size, 1048577);
  assert.equal((await api.storage.get("records", "private-other", other)).content, "Other account");
  const bad = structuredClone(exported); bad.records[0].owner = "account:forged"; assert.throws(() => api.normalizeWorkspaceData(bad), /tài khoản nội bộ/);
  const script = structuredClone(exported); script.records[0].script = "alert(1)"; assert.throws(() => api.normalizeWorkspaceData(script), /chưa được hỗ trợ/);
  const oversized = structuredClone(exported); oversized.files[0].data = Buffer.alloc(1048577).toString("base64"); oversized.files[0].size = 1048577; assert.throws(() => api.normalizeWorkspaceData(oversized), /vượt 1 MB/);
});

test("new workspace controls are independent, actionable and describe engine limitations", () => {
  assert.match(api.renderMarkup("ai-prompt-library"), /prompt-filter/); assert.match(api.renderMarkup("ai-prompt-library"), /data-tool-prompt-file/); assert.match(api.renderMarkup("ai-prompt-library"), /render-prompt/);
  assert.match(api.renderMarkup("workspace-tabs"), /tab-left/); assert.match(api.renderMarkup("file-explorer"), /new-folder/);
  assert.match(api.renderMarkup("version-history"), /snapshot nội dung hiện tại/);
  assert.match(api.renderMarkup("monaco-code-editor"), /code-document/); assert.match(api.renderMarkup("monaco-code-editor"), /diff-code/);
  assert.match(api.renderMarkup("speech-to-text"), /data-tool-paid-consent/); assert.match(api.renderMarkup("text-to-speech"), /data-tool-tts-preview/); assert.doesNotMatch(api.renderMarkup("text-to-speech"), /autoplay/);
});
