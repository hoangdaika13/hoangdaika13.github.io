"use strict";

// Deliberately small DOM double: these verify lifecycle/data behavior, not browser layout or devices.
const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../tool-workspace-pro.js");
const decode = value => String(value).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

function hostDouble() {
  function parseInputs(host, html) {
    for (const match of html.matchAll(/<(input|textarea|select)\b([^>]*\bdata-tool-input="([^"]+)"[^>]*)>(?:([^]*?)<\/\1>)?/g)) {
      const [, tag, attrs, name, body = ""] = match;
      const value = tag === "textarea" ? decode(body) : tag === "select" ? decode(body.match(/<option[^>]*value="([^"]*)"[^>]*selected/)?.[1] ?? body.match(/<option[^>]*value="([^"]*)"/)?.[1] ?? "") : decode(attrs.match(/\bvalue="([^"]*)"/)?.[1] || "");
      host.inputs.set(name, { value, dataset: { toolInput: name }, type: attrs.match(/type="([^"]+)"/)?.[1], focus() {}, matches(selector) { return selector.includes(`[data-tool-input="${name}"]`) || (selector === '[data-tool-input]'); } });
    }
  }
  const host = { dataset: {}, nodes: new Map(), inputs: new Map(), events: new Map(), contains: () => true,
    addEventListener(name, callback) { this.events.set(name, callback); },
    removeEventListener(name, callback) { if (this.events.get(name) === callback) this.events.delete(name); },
    querySelector(selector) {
      const name = selector.match(/^\[data-tool-input="([^"]+)"\]$/)?.[1];
      if (name) return this.inputs.get(name) || null;
      if (selector === '[data-tool-state="running"]') return this.nodes.get("[data-tool-state]")?.dataset.toolState === "running" ? this.nodes.get("[data-tool-state]") : null;
      return this.nodes.get(selector) || null;
    },
    querySelectorAll(selector) { return selector === "[data-tool-input]" ? [...this.inputs.values()] : []; }
  };
  Object.defineProperty(host, "innerHTML", { set(html) {
    this.inputs.clear(); this.nodes.clear();
    parseInputs(this, html);
    for (const attr of ["data-tool-state", "data-tool-notice", "data-tool-output", "data-tool-tabs", "data-tool-save-state", "data-tool-editor", "data-tool-editor-status", "data-tool-list", "data-tool-variables", "data-tool-prompt-state", "data-tool-code-problems", "data-tool-speech-capability", "data-tool-paid-consent", "data-tool-tts-preview", "data-tool-file-state"]) {
      if (html.includes(attr)) this.nodes.set(`[${attr}]`, { dataset: { toolState: "idle" }, textContent: attr === "data-tool-output" ? "Chưa có kết quả." : "", innerHTML: "", className: "", checked: false, querySelectorAll: () => [], pause() {}, load() {}, removeAttribute() {} });
    }
    if (html.includes("data-tool-preview")) {
      const preview = {}; Object.defineProperty(preview, "innerHTML", { set(value) { ["rename", "file-content", "file-destination"].forEach(name => host.inputs.delete(name)); parseInputs(host, value); if (value.includes("data-tool-file-state")) host.nodes.set("[data-tool-file-state]", { textContent: "" }); this.html = value; }, get() { return this.html || ""; } }); this.nodes.set("[data-tool-preview]", preview);
    }
    this.nodes.set("[data-hh-tool]", {});
  } });
  return host;
}
function click(host, tool, action, extra = {}) {
  return clickApi(api, host, tool, action, extra);
}
function clickApi(instance, host, tool, action, extra = {}) {
  const node = { dataset: { toolAction: action, ...extra }, closest: () => node };
  return instance.handleClick({ target: node, preventDefault() {} }, host, tool);
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function freshApi() {
  // A reload starts a new module/lifecycle; do not call cleanup before capturing persistence.
  const filename = require.resolve("../tool-workspace-pro.js"), cached = require.cache[filename];
  delete require.cache[filename]; const fresh = require(filename); require.cache[filename] = cached; return fresh;
}

test("draft flush survives tool change and is never restored to another account", async () => {
  const host = hostDouble();
  let mounted = api.mount(host, { toolId: "ai-prompt-optimizer", currentUser: { id: "draft-A" } }); await mounted.ready;
  host.inputs.get("source").value = "A confidential draft";
  mounted.cleanup(); await tick();
  mounted = api.mount(host, { toolId: "ai-prompt-optimizer", currentUser: { id: "draft-B" } }); await mounted.ready;
  assert.equal(host.inputs.get("source").value, "");
  mounted.cleanup(); await tick();
  mounted = api.mount(host, { toolId: "ai-prompt-optimizer", currentUser: { id: "draft-A" } }); await mounted.ready;
  assert.equal(host.inputs.get("source").value, "A confidential draft");
  mounted.cleanup(); await tick();
});

test("prompt edit updates the selected record instead of creating duplicates", async () => {
  const host = hostDouble(); const mounted = api.mount(host, { toolId: "ai-prompt-library", currentUser: { id: "prompt-crud" } }); await mounted.ready;
  host.inputs.get("title").value = "Reusable"; host.inputs.get("content").value = "Explain {{topic}} for beginners"; host.inputs.get("tags").value = "study, english";
  await click(host, "ai-prompt-library", "save-prompt"); const id = host.dataset.promptId;
  assert.ok(id); host.inputs.get("content").value = "Updated reusable prompt"; await click(host, "ai-prompt-library", "save-prompt");
  const rows = await api.storage.list("records", row => row.type === "prompt", "account:prompt-crud"); assert.equal(rows.length, 1); assert.equal(rows[0].content, "Updated reusable prompt");
  await click(host, "ai-prompt-library", "favorite-prompt", { recordId: id }); assert.equal((await api.storage.get("records", id, "account:prompt-crud")).favorite, true);
  await click(host, "ai-prompt-library", "duplicate-prompt", { recordId: id }); assert.equal((await api.storage.list("records", row => row.type === "prompt", "account:prompt-crud")).length, 2);
  mounted.cleanup(); await tick();
});

test("prompt reload reapplies restored filters and identifies the existing editing record", async () => {
  const owner = "account:prompt-reload", timestamp = new Date().toISOString();
  await api.storage.put("records", { id: "prompt-alpha", type: "prompt", title: "Alpha", content: "Explain project architecture", tags: ["project"], updatedAt: timestamp }, owner);
  await api.storage.put("records", { id: "prompt-beta", type: "prompt", title: "Beta", content: "Explain language learning", tags: ["study"], updatedAt: timestamp }, owner);
  const host = hostDouble(); let mounted = api.mount(host, { toolId: "ai-prompt-library", currentUser: { id: "prompt-reload" } }); await mounted.ready;
  await click(host, "ai-prompt-library", "use-prompt", { recordId: "prompt-alpha" }); host.inputs.get("prompt-filter").value = "project";
  mounted.cleanup(); await tick(); mounted = api.mount(host, { toolId: "ai-prompt-library", currentUser: { id: "prompt-reload" } }); await mounted.ready;
  assert.equal(host.inputs.get("prompt-filter").value, "project"); assert.equal(host.dataset.promptId, "prompt-alpha");
  assert.match(host.nodes.get("[data-tool-list]").innerHTML, /Alpha/); assert.doesNotMatch(host.nodes.get("[data-tool-list]").innerHTML, /Beta/);
  assert.match(host.nodes.get("[data-tool-prompt-state]").textContent, /Đang sửa “Alpha”/); assert.match(host.nodes.get("[data-tool-prompt-state]").textContent, /cập nhật prompt này/);
  mounted.cleanup(); await tick(); mounted = api.mount(host, { toolId: "ai-prompt-library", currentUser: { id: "prompt-reload-other" } }); await mounted.ready;
  assert.equal(host.dataset.promptId, undefined); assert.match(host.nodes.get("[data-tool-prompt-state]").textContent, /prompt mới/);
  mounted.cleanup(); await tick();
});

test("file reload reapplies folder and name filter before rendering the file list", async () => {
  const owner = "account:file-reload", timestamp = new Date().toISOString();
  await api.storage.put("records", { id: "folder-study", type: "tool-folder", name: "Study" }, owner);
  for (const row of [{ id: "file-root", name: "root.txt", folderId: "" }, { id: "file-study", name: "lesson.txt", folderId: "folder-study" }, { id: "file-notes", name: "notes.txt", folderId: "folder-study" }]) await api.storage.put("files", { ...row, type: "text/plain", size: 5, blob: new Blob(["hello"]), updatedAt: timestamp }, owner);
  const host = hostDouble(); let mounted = api.mount(host, { toolId: "file-explorer", currentUser: { id: "file-reload" } }); await mounted.ready;
  host.inputs.get("file-folder").value = "folder-study"; host.inputs.get("file-filter").value = "lesson";
  mounted.cleanup(); await tick(); mounted = api.mount(host, { toolId: "file-explorer", currentUser: { id: "file-reload" } }); await mounted.ready;
  assert.equal(host.inputs.get("file-folder").value, "folder-study"); assert.equal(host.inputs.get("file-filter").value, "lesson");
  assert.match(host.nodes.get("[data-tool-list]").innerHTML, /lesson\.txt/); assert.doesNotMatch(host.nodes.get("[data-tool-list]").innerHTML, /root\.txt|notes\.txt/);
  mounted.cleanup(); await tick();
});

test("version restore preserves the current text as a safety snapshot", async () => {
  const host = hostDouble(); const mounted = api.mount(host, { toolId: "version-history", currentUser: { id: "version-safe" } }); await mounted.ready;
  await api.storage.put("records", { id: "snapshot-old", type: "version", label: "Old", content: "old text", createdAt: new Date().toISOString() }, "account:version-safe");
  host.inputs.get("document").value = "current unsaved text"; await click(host, "version-history", "restore-version", { recordId: "snapshot-old" });
  assert.equal(host.inputs.get("document").value, "old text"); assert.ok((await api.storage.list("records", row => row.type === "version", "account:version-safe")).some(row => row.content === "current unsaved text"));
  mounted.cleanup(); await tick();
});

test("Monaco fallback multiple documents save before switching and keep independent text", async () => {
  const host = hostDouble(); const mounted = api.mount(host, { toolId: "monaco-code-editor", currentUser: { id: "code-tabs" } }); await mounted.ready;
  host.inputs.get("code").value = "const first = 1;"; host.inputs.get("code-title").value = "first.js"; await click(host, "monaco-code-editor", "new-code"); const second = host.dataset.codeDocument;
  assert.notEqual(second, "code-document"); host.inputs.get("code").value = "const second = 2;";
  const select = host.inputs.get("code-document"); select.value = "code-document"; await api.handleChange({ target: select }, host, "monaco-code-editor");
  assert.equal(host.inputs.get("code").value, "const first = 1;"); assert.equal((await api.storage.get("records", second, "account:code-tabs")).content, "const second = 2;");
  mounted.cleanup(); await tick();
});

test("speech adapters require each explicit consent, make one request and never autoplay WAV", async () => {
  const original = globalThis.fetch; const calls = [], wav = Buffer.alloc(44); wav.write("RIFF", 0); wav.write("WAVE", 8);
  globalThis.fetch = async (url, options) => {
    if (options.method !== "POST") return { ok: true, json: async () => ({ providers: [{ provider: "speech", configured: true }, { provider: "tts", configured: true }] }) };
    const payload = JSON.parse(options.body); calls.push(payload);
    return { ok: true, json: async () => ({ result: payload.toolId === "text-to-speech" ? { audio: { data: wav.toString("base64"), mimeType: "audio/wav" }, voice: "Kore" } : { text: "A real adapter response double" } }) };
  };
  const host = hostDouble(); let mounted;
  try {
    mounted = api.mount(host, { toolId: "text-to-speech", currentUser: { id: "voice-adapter" } }); await mounted.ready;
    host.inputs.get("text").value = "Hello"; await click(host, "text-to-speech", "export-tts"); assert.equal(calls.length, 0);
    host.nodes.get("[data-tool-paid-consent]").checked = true; await click(host, "text-to-speech", "export-tts"); assert.equal(calls.length, 1); assert.equal(calls[0].action, "synthesize"); assert.equal(calls[0].consent.paidProcessing, true); assert.equal(host.nodes.get("[data-tool-paid-consent]").checked, false); assert.equal(host._ttsBlob.type, "audio/wav");
    assert.match(host.nodes.get("[data-tool-tts-preview]").src, /^blob:/); await click(host, "text-to-speech", "export-tts"); assert.equal(calls.length, 1);
    mounted.cleanup(); await tick(); mounted = api.mount(host, { toolId: "speech-to-text", currentUser: { id: "voice-adapter" } }); await mounted.ready;
    const file = new Blob(["selected audio"], { type: "audio/wav" }); file.name = "sample.wav";
    await api.handleChange({ target: { files: [file], matches: selector => selector === "[data-tool-media-file]" } }, host, "speech-to-text");
    host.nodes.get("[data-tool-paid-consent]").checked = true; await click(host, "speech-to-text", "transcribe-media"); assert.equal(calls.length, 2); assert.equal(calls[1].action, "transcribe"); assert.equal(host.inputs.get("transcript").value, "A real adapter response double");
  } finally { mounted?.cleanup(); globalThis.fetch = original; await tick(); }
});

test("Workspace Tabs saves the current unsaved content before opening a new tab", async () => {
  const host = hostDouble(); const mounted = api.mount(host, { toolId: "workspace-tabs", currentUser: { id: "tabs-A" } }); await mounted.ready;
  const originalId = host.dataset.activeTab;
  host.inputs.get("title").value = "My original"; host.inputs.get("document").value = "Unsaved body";
  await click(host, "workspace-tabs", "new-tab");
  assert.notEqual(host.dataset.activeTab, originalId);
  const row = await api.storage.get("records", originalId, "account:tabs-A");
  assert.equal(row.title, "My original"); assert.equal(row.content, "Unsaved body");
  await click(host, "workspace-tabs", "select-tab", { recordId: originalId });
  assert.equal(host.inputs.get("document").value, "Unsaved body");
  mounted.cleanup(); await tick();
});

test("hard reload restores dirty tab drafts only for the owned existing tab and newer revision", async () => {
  const owner = "account:tabs-hard-reload", host = hostDouble();
  const mounted = api.mount(host, { toolId: "workspace-tabs", currentUser: { id: "tabs-hard-reload" } }); await mounted.ready;
  host.inputs.get("title").value = "Stable"; host.inputs.get("document").value = "Stable saved text";
  await click(host, "workspace-tabs", "new-tab"); const draftId = host.dataset.activeTab;
  host.inputs.get("title").value = "Draft title"; host.inputs.get("document").value = "Dirty text persisted without cleanup";
  api.handleInput({ target: host.inputs.get("document") }, host, "workspace-tabs"); await new Promise(resolve => setTimeout(resolve, 450));
  const persisted = await api.exportWorkspaceData({ owner });
  assert.equal(persisted.records.find(row => row.id === "draft-workspace-tabs").values.document, "Dirty text persisted without cleanup");
  assert.equal(persisted.records.find(row => row.id === draftId).content, "");
  async function reload(data, userId = "tabs-hard-reload") {
    const fresh = freshApi(); await fresh.importWorkspaceData(data, { owner, strategy: "replace" });
    const nextHost = hostDouble(), next = fresh.mount(nextHost, { toolId: "workspace-tabs", currentUser: { id: userId } }); await next.ready;
    return { fresh, nextHost, next };
  }
  try {
    let result = await reload(persisted); assert.equal(result.nextHost.dataset.activeTab, draftId); assert.equal(result.nextHost.inputs.get("document").value, "Dirty text persisted without cleanup"); assert.equal(result.nextHost.inputs.get("title").value, "Draft title"); assert.equal(result.nextHost._tabDirty, true); assert.match(result.nextHost.nodes.get("[data-tool-save-state]").textContent, /khôi phục bản nháp chưa lưu/); result.next.cleanup(); await tick();
    result = await reload(persisted, "tabs-hard-reload-other"); assert.equal(result.nextHost.inputs.get("document").value, ""); assert.notEqual(result.nextHost.dataset.activeTab, draftId); result.next.cleanup(); await tick();
    const deleted = structuredClone(persisted); deleted.records = deleted.records.filter(row => row.id !== draftId);
    result = await reload(deleted); assert.notEqual(result.nextHost.dataset.activeTab, draftId); assert.equal(result.nextHost.inputs.get("document").value, "Stable saved text"); result.next.cleanup(); await tick();
    const newer = structuredClone(persisted), authoritative = newer.records.find(row => row.id === draftId); authoritative.content = "Authoritative newer revision"; authoritative.title = "Newer title"; authoritative.updatedAt = new Date(Date.now() + 10000).toISOString();
    result = await reload(newer); assert.equal(result.nextHost.inputs.get("document").value, "Authoritative newer revision"); assert.equal(result.nextHost.inputs.get("title").value, "Newer title"); assert.equal(result.nextHost._tabDirty, false); result.next.cleanup(); await tick();
  } finally { mounted.cleanup(); globalThis.HHToolWorkspace = api; await tick(); }
});

test("file metadata actions preserve dirty text and a fresh module restores the draft without cleanup", async () => {
  const owner = "account:files-hard-reload", timestamp = new Date().toISOString();
  await api.storage.put("records", { id: "draft-folder", type: "tool-folder", name: "Study" }, owner);
  for (const id of ["draft-file-a", "draft-file-b"]) await api.storage.put("files", { id, name: `${id}.txt`, type: "text/plain", size: 8, blob: new Blob(["original"]), updatedAt: timestamp }, owner);
  const host = hostDouble(), mounted = api.mount(host, { toolId: "file-explorer", currentUser: { id: "files-hard-reload" } }); await mounted.ready;
  await click(host, "file-explorer", "preview-file", { recordId: "draft-file-a" });
  host.inputs.get("file-content").value = "Pending text, not saved to the file"; host.inputs.get("rename").value = "renamed.txt";
  await click(host, "file-explorer", "rename-file", { recordId: "draft-file-a" });
  assert.equal(host.inputs.get("file-content").value, "Pending text, not saved to the file"); assert.equal((await api.storage.get("files", "draft-file-a", owner)).name, "renamed.txt");
  host.inputs.get("file-destination").value = "draft-folder"; await click(host, "file-explorer", "move-file", { recordId: "draft-file-a" });
  assert.equal(host.inputs.get("file-content").value, "Pending text, not saved to the file"); assert.equal(await (await api.storage.get("files", "draft-file-a", owner)).blob.text(), "original");
  await click(host, "file-explorer", "preview-file", { recordId: "draft-file-b" }); assert.equal(host.dataset.activeFile, "draft-file-a"); assert.match(host.nodes.get("[data-tool-notice]").textContent, /thay đổi chưa lưu/);
  const persisted = await api.exportWorkspaceData({ owner, includeFiles: true }), fresh = freshApi(); await fresh.importWorkspaceData(persisted, { owner, strategy: "replace" });
  const nextHost = hostDouble(), next = fresh.mount(nextHost, { toolId: "file-explorer", currentUser: { id: "files-hard-reload" } }); await next.ready;
  try {
    assert.equal(nextHost.dataset.activeFile, "draft-file-a"); assert.equal(nextHost.inputs.get("file-content").value, "Pending text, not saved to the file"); assert.equal(nextHost.inputs.get("rename").value, "renamed.txt"); assert.equal(nextHost.inputs.get("file-destination").value, "draft-folder");
    await clickApi(fresh, nextHost, "file-explorer", "save-file", { recordId: "draft-file-a" }); assert.equal(await (await fresh.storage.get("files", "draft-file-a", owner)).blob.text(), "Pending text, not saved to the file");
    await clickApi(fresh, nextHost, "file-explorer", "preview-file", { recordId: "draft-file-b" }); assert.equal(nextHost.dataset.activeFile, "draft-file-b");
  } finally { next.cleanup(); mounted.cleanup(); globalThis.HHToolWorkspace = api; await tick(); }
  const conflict = structuredClone(persisted); conflict.files.find(row => row.id === "draft-file-a").updatedAt = new Date(Date.now() + 20000).toISOString();
  const conflicting = freshApi(); await conflicting.importWorkspaceData(conflict, { owner, strategy: "replace" }); const conflictHost = hostDouble(), conflictMount = conflicting.mount(conflictHost, { toolId: "file-explorer", currentUser: { id: "files-hard-reload" } }); await conflictMount.ready;
  try {
    await clickApi(conflicting, conflictHost, "file-explorer", "save-file", { recordId: "draft-file-a" }); assert.equal(await (await conflicting.storage.get("files", "draft-file-a", owner)).blob.text(), "original"); assert.match(conflictHost.nodes.get("[data-tool-notice]").textContent, /không tự ghi đè/);
    await clickApi(conflicting, conflictHost, "file-explorer", "discard-file-draft"); assert.equal(conflictHost.inputs.get("file-content").value, "Pending text, not saved to the file");
    await clickApi(conflicting, conflictHost, "file-explorer", "discard-file-draft", { confirmDiscard: "draft-file-a" }); assert.equal(conflictHost.inputs.get("file-content").value, "original");
  } finally { conflictMount.cleanup(); globalThis.HHToolWorkspace = api; await tick(); }
});

test("TTS explains short passages, WAV duration cap and charged rejection without automatic splitting", () => {
  const html = api.renderMarkup("text-to-speech"); assert.match(html, /250 ký tự/); assert.match(html, /44 giây/); assert.match(html, /vẫn tính phí/); assert.match(html, /Không tự chia đoạn/); assert.match(html, /2\.000 ký tự/);
});

test("editing large supported text creates a full bounded snapshot that round trips in workspace backup", async () => {
  const owner = "account:large-file-version", original = "x".repeat(250001), timestamp = new Date().toISOString();
  await api.storage.put("files", { id: "large-editable-file", name: "large.txt", type: "text/plain", size: original.length, blob: new Blob([original]), updatedAt: timestamp }, owner);
  const host = hostDouble(), mounted = api.mount(host, { toolId: "file-explorer", currentUser: { id: "large-file-version" } }); await mounted.ready;
  try {
    await click(host, "file-explorer", "preview-file", { recordId: "large-editable-file" }); assert.equal(host.inputs.get("file-content").value, original);
    host.inputs.get("file-content").value = "updated"; await click(host, "file-explorer", "save-file", { recordId: "large-editable-file" });
    const backup = await api.exportWorkspaceData({ owner, includeFiles: true }), snapshot = backup.records.find(row => row.type === "version"); assert.equal(snapshot.content, original); assert.equal(api.normalizeWorkspaceData(backup).records.find(row => row.id === snapshot.id).content.length, 250001);
    const fresh = freshApi(); await fresh.importWorkspaceData(backup, { owner, strategy: "replace" }); assert.equal((await fresh.storage.get("records", snapshot.id, owner)).content, original); assert.equal(await (await fresh.storage.get("files", "large-editable-file", owner)).blob.text(), "updated");
    const tooLarge = structuredClone(backup); tooLarge.records.find(row => row.id === snapshot.id).content = "猫".repeat(200001); assert.throws(() => api.normalizeWorkspaceData(tooLarge), /500 KB UTF-8/);
  } finally { mounted.cleanup(); globalThis.HHToolWorkspace = api; await tick(); }
});

test("old cleanup cannot remove the new tool handlers or cancel its state", async () => {
  const host = hostDouble(); const first = api.mount(host, { toolId: "ai-prompt-optimizer", currentUser: { id: "lifecycle" } }); await first.ready;
  const second = api.mount(host, { toolId: "ai-image-prompt-generator", currentUser: { id: "lifecycle" } }); await second.ready;
  first.cleanup();
  assert.equal(host.events.size, 3);
  host.inputs.get("source").value = "A rainy cafe at night";
  await click(host, "ai-image-prompt-generator", "generate-image-prompt");
  assert.match(host.nodes.get("[data-tool-output]").textContent, /PROMPT/);
  second.cleanup(); assert.equal(host.events.size, 0); await tick();
});

test("unrecognized actions fail visibly instead of showing success", async () => {
  const host = hostDouble(); const mounted = api.mount(host, { toolId: "ai-prompt-optimizer", currentUser: { id: "bad-action" } }); await mounted.ready;
  await click(host, "ai-prompt-optimizer", "fake-action");
  assert.equal(host.nodes.get("[data-tool-state]").dataset.toolState, "error");
  assert.match(host.nodes.get("[data-tool-notice]").textContent, /chưa được hỗ trợ/);
  mounted.cleanup(); await tick();
});

test("a delayed prompt read cannot populate the same host after an account switch", async () => {
  const host = hostDouble(); let mounted = api.mount(host, { toolId: "ai-prompt-library", currentUser: { id: "race-A" } }); await mounted.ready;
  const original = api.storage.get; let release;
  api.storage.get = (store, id, owner) => id === "private-prompt" ? new Promise(resolve => { release = resolve; }) : original.call(api.storage, store, id, owner);
  try {
    const pending = click(host, "ai-prompt-library", "use-prompt", { recordId: "private-prompt" });
    await tick(); assert.equal(typeof release, "function");
    mounted.cleanup(); mounted = api.mount(host, { toolId: "ai-prompt-library", currentUser: { id: "race-B" } }); await mounted.ready;
    release({ id: "private-prompt", title: "Private A", content: "Secret A", tags: [] }); await pending;
    assert.equal(host.inputs.get("title").value, ""); assert.equal(host.inputs.get("content").value, "");
  } finally { api.storage.get = original; mounted.cleanup(); await tick(); }
});
