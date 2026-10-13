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
    for (const attr of ["data-tool-state", "data-tool-notice", "data-tool-output", "data-tool-tabs", "data-tool-save-state", "data-tool-editor", "data-tool-editor-status", "data-tool-list", "data-tool-variables", "data-tool-prompt-state", "data-tool-code-problems", "data-tool-code-documents", "data-tool-code-meta", "data-tool-code-save-state", "data-tool-speech-capability", "data-tool-paid-consent", "data-tool-tts-preview", "data-tool-file-state", "data-tool-subtitle-origin", "data-tool-subtitle-validation", "data-tool-subtitle-cues", "data-tool-version-context", "data-tool-version-selection", "data-tool-version-page"]) {
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
  const { querySelector, ...data } = extra;
  const node = { dataset: { toolAction: action, ...data }, closest: () => node, querySelector: querySelector || (() => null) };
  return instance.handleClick({ target: node, preventDefault() {} }, host, tool);
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function freshApi() {
  // A reload starts a new module/lifecycle; do not call cleanup before capturing persistence.
  const filename = require.resolve("../tool-workspace-pro.js"), cached = require.cache[filename];
  delete require.cache[filename]; const fresh = require(filename); require.cache[filename] = cached; return fresh;
}
function codeFile(name, content) { const file = new Blob([content]); file.name = name; return file; }
function codeFileChange(file) { return { target: { files: [file], value: "selected", matches: selector => selector === "[data-tool-code-file]" } }; }
function inputCode(host, name, value, instance = api) { const target = host.inputs.get(name); target.value = value; instance.handleInput({ target }, host, "monaco-code-editor"); }

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

test("code saved and new drafts reload with their latest text, metadata and account ownership", async () => {
  const owner = "account:code-draft-reload", host = hostDouble(), mounted = api.mount(host, { toolId: "monaco-code-editor", currentUser: { id: "code-draft-reload" } }); await mounted.ready;
  try {
    inputCode(host, "code", "saved text"); await click(host, "monaco-code-editor", "save-code");
    inputCode(host, "code", "latest unsaved text"); inputCode(host, "code-title", "latest.ts"); inputCode(host, "language", "typescript");
    await click(host, "monaco-code-editor", "version-code");
    assert.equal(host.nodes.get("[data-tool-code-save-state]").dataset.codeDirty, "true");
    const backup = await api.exportWorkspaceData({ owner }), draft = backup.records.find(row => row.id === "draft-monaco-code-editor"), saved = backup.records.find(row => row.type === "code");
    assert.equal(draft.values.code, "latest unsaved text"); assert.ok(draft.updatedAt > saved.updatedAt); assert.equal(saved.content, "saved text");
    async function reload(payload, user = "code-draft-reload") { const fresh = freshApi(); await fresh.importWorkspaceData(payload, { owner, strategy: "replace" }); const nextHost = hostDouble(), next = fresh.mount(nextHost, { toolId: "monaco-code-editor", currentUser: { id: user } }); await next.ready; return { fresh, nextHost, next }; }
    let result = await reload(backup); assert.equal(result.nextHost.inputs.get("code").value, "latest unsaved text"); assert.equal(result.nextHost.inputs.get("code-title").value, "latest.ts"); assert.equal(result.nextHost.inputs.get("language").value, "typescript"); assert.equal(result.nextHost.nodes.get("[data-tool-code-save-state]").dataset.codeDirty, "true"); result.next.cleanup(); await tick();
    result = await reload(backup, "code-draft-reload-other"); assert.equal(result.nextHost.inputs.get("code").value, ""); result.next.cleanup(); await tick();
    const newer = structuredClone(backup), row = newer.records.find(item => item.type === "code"); row.content = "new authoritative revision"; row.updatedAt = new Date(Date.parse(draft.updatedAt) + 10000).toISOString();
    result = await reload(newer); assert.equal(result.nextHost.inputs.get("code").value, "new authoritative revision"); result.next.cleanup(); await tick();
    const newDraft = structuredClone(backup); newDraft.records = newDraft.records.filter(item => item.type !== "code"); const unsaved = newDraft.records.find(item => item.type === "tool-draft"); unsaved.codeDocument = "new-independent-draft"; unsaved.codeDocumentState = "new"; unsaved.codeBaseUpdatedAt = "";
    result = await reload(newDraft); assert.equal(result.nextHost.dataset.codeDocument, "new-independent-draft"); assert.equal(result.nextHost.inputs.get("code").value, "latest unsaved text"); assert.equal((await result.fresh.storage.list("records", item => item.type === "code", owner)).length, 0); result.next.cleanup(); await tick();
  } finally { mounted.cleanup(); await tick(); }
});

test("UTF-8 code import applies explicit duplicate policies and rejects unsupported or excessive input", async () => {
  const owner = "account:code-import", host = hostDouble(), mounted = api.mount(host, { toolId: "monaco-code-editor", currentUser: { id: "code-import" } }); await mounted.ready;
  try {
    inputCode(host, "code-title", "sample.ts"); inputCode(host, "language", "typescript"); inputCode(host, "code", "original saved"); await click(host, "monaco-code-editor", "save-code");
    const original = host.dataset.codeDocument;
    host.inputs.get("code-import-duplicate").value = "reject"; await assert.rejects(api.handleChange(codeFileChange(codeFile("SAMPLE.ts", "incoming")), host, "monaco-code-editor"), /Tên file đã tồn tại/);
    assert.equal((await api.storage.get("records", original, owner)).content, "original saved");
    host.inputs.get("code-import-duplicate").value = "open"; await api.handleChange(codeFileChange(codeFile("sample.ts", "ignored incoming")), host, "monaco-code-editor"); assert.equal(host.inputs.get("code").value, "original saved"); assert.equal((await api.storage.list("records", item => item.type === "code", owner)).length, 1);
    host.inputs.get("code-import-duplicate").value = "rename"; await api.handleChange(codeFileChange(codeFile("sample.ts", "line one\r\nline two\rline three")), host, "monaco-code-editor"); assert.equal(host.inputs.get("code-title").value, "sample-copy-2.ts"); assert.equal(host.inputs.get("code").value, "line one\nline two\nline three"); assert.equal((await api.storage.get("records", original, owner)).content, "original saved");
    for (const [file, message] of [[codeFile("broken.js", new Uint8Array([0xc3, 0x28])), /UTF-8 hợp lệ/], [codeFile("binary.exe", "text"), /Chỉ nhận/], [codeFile("unsafe.txt", "text\u0000control"), /byte điều khiển/], [codeFile("large.txt", "x".repeat(200001)), /200.000/], [codeFile("bytes.txt", "猫".repeat(166667)), /500 KB/], [codeFile("CON.js", "text"), /tên thiết bị/]]) await assert.rejects(api.handleChange(codeFileChange(file), host, "monaco-code-editor"), message);
    assert.equal((await api.storage.list("records", item => item.type === "code", owner)).length, 2);
  } finally { mounted.cleanup(); await tick(); }
});

test("code search, metadata rename, duplication and extension-aware export preserve literal unsaved text", async () => {
  const owner = "account:code-manage", host = hostDouble(), mounted = api.mount(host, { toolId: "monaco-code-editor", currentUser: { id: "code-manage" } }); await mounted.ready;
  const originalDocument = globalThis.document, createUrl = URL.createObjectURL, downloads = [], blobs = new Map();
  try {
    inputCode(host, "code-title", "first.js"); inputCode(host, "code", "saved code"); await click(host, "monaco-code-editor", "save-code"); const original = host.dataset.codeDocument;
    inputCode(host, "code", "<script>globalThis.mustNeverRun = true</script>"); inputCode(host, "language", "html"); inputCode(host, "code-title", "renamed.js"); await click(host, "monaco-code-editor", "rename-code");
    assert.equal((await api.storage.get("records", original, owner)).title, "renamed.html"); assert.equal((await api.storage.get("records", original, owner)).content, "saved code"); assert.match(host.inputs.get("code").value, /<script>/); assert.equal(host.nodes.get("[data-tool-code-save-state]").dataset.codeDirty, "true");
    await click(host, "monaco-code-editor", "duplicate-code"); const copied = host.dataset.codeDocument; assert.notEqual(copied, original); assert.equal(host.inputs.get("code-title").value, "renamed-copy-2.html"); assert.equal((await api.storage.get("records", copied, owner)).content, host.inputs.get("code").value);
    inputCode(host, "code-filter", "html"); await tick(); assert.match(host.nodes.get("[data-tool-code-documents]").innerHTML, /renamed-copy-2/); inputCode(host, "code-filter", "missing"); await tick(); assert.doesNotMatch(host.nodes.get("[data-tool-code-documents]").innerHTML, /open-code-document/);
    URL.createObjectURL = blob => { const url = createUrl(blob); blobs.set(url, blob); return url; }; globalThis.document = { createElement: () => ({ click() { downloads.push({ name: this.download, blob: blobs.get(this.href) }); } }) };
    inputCode(host, "language", "plaintext"); await click(host, "monaco-code-editor", "export-code"); assert.equal(downloads[0].name, "renamed-copy-2.txt"); assert.equal(await downloads[0].blob.text(), "<script>globalThis.mustNeverRun = true</script>"); assert.equal(globalThis.mustNeverRun, undefined);
  } finally { globalThis.document = originalDocument; URL.createObjectURL = createUrl; mounted.cleanup(); await tick(); }
});

test("code deletion keeps saved and dirty snapshots and stale drafts cannot recreate the deleted ID", async () => {
  const owner = "account:code-delete", host = hostDouble(), mounted = api.mount(host, { toolId: "monaco-code-editor", currentUser: { id: "code-delete" } }); await mounted.ready;
  try {
    inputCode(host, "code", "saved before deletion"); await click(host, "monaco-code-editor", "save-code"); const id = host.dataset.codeDocument;
    inputCode(host, "code", "unsaved before deletion"); await click(host, "monaco-code-editor", "version-code"); const stale = await api.storage.get("records", "draft-monaco-code-editor", owner);
    await click(host, "monaco-code-editor", "delete-code"); assert.ok(await api.storage.get("records", id, owner));
    await click(host, "monaco-code-editor", "delete-code", { confirmCodeDelete: id }); assert.equal(await api.storage.get("records", id, owner), null); assert.equal((await api.storage.get("records", `code-deleted-${id}`, owner)).sourceDocument, id);
    const versions = await api.storage.list("records", row => row.type === "version", owner); assert.ok(versions.some(row => row.content === "saved before deletion")); assert.ok(versions.some(row => row.content === "unsaved before deletion"));
    host.dataset.codeDocument = id; inputCode(host, "code", "stale editor content"); await click(host, "monaco-code-editor", "save-code"); assert.equal(await api.storage.get("records", id, owner), null); assert.match(host.nodes.get("[data-tool-notice]").textContent, /đã xóa/);
    await api.storage.put("records", stale, owner); const backup = await api.exportWorkspaceData({ owner }), fresh = freshApi(); await fresh.importWorkspaceData(backup, { owner, strategy: "replace" }); const nextHost = hostDouble(), next = fresh.mount(nextHost, { toolId: "monaco-code-editor", currentUser: { id: "code-delete" } }); await next.ready;
    assert.notEqual(nextHost.dataset.codeDocument, id); assert.equal(nextHost.inputs.get("code").value, ""); assert.equal(await fresh.storage.get("records", id, owner), null); next.cleanup(); await tick();
  } finally { mounted.cleanup(); await tick(); }
});

test("delayed code-document reads retain text entered after saving and restore the selector", async () => {
  const owner = "account:code-switch-race", host = hostDouble(), mounted = api.mount(host, { toolId: "monaco-code-editor", currentUser: { id: "code-switch-race" } }); await mounted.ready;
  const originalGet = api.storage.get; let release, reached;
  try {
    inputCode(host, "code", "first document"); await click(host, "monaco-code-editor", "save-code"); const originalId = host.dataset.codeDocument;
    await api.storage.put("records", { id: "switch-target", type: "code", title: "target.txt", language: "plaintext", content: "target content", updatedAt: new Date().toISOString() }, owner);
    const waiting = new Promise(resolve => { reached = resolve; }); api.storage.get = async (...args) => { const row = await originalGet(...args); if (args[1] === "switch-target") { reached(); await new Promise(resolve => { release = resolve; }); } return row; };
    const selector = host.inputs.get("code-document"); selector.value = "switch-target"; const switching = api.handleChange({ target: selector }, host, "monaco-code-editor"); await waiting;
    inputCode(host, "code", "typed during target read"); release(); await assert.rejects(switching, /vừa nhập thêm/); assert.equal(host.dataset.codeDocument, originalId); assert.equal(selector.value, originalId); assert.equal(host.inputs.get("code").value, "typed during target read");
  } finally { api.storage.get = originalGet; release?.(); mounted.cleanup(); await tick(); }
});

test("code imports cancel late reads, preserve concurrent typing and cannot enter another account", async () => {
  const owner = "account:code-import-race", host = hostDouble(); let mounted = api.mount(host, { toolId: "monaco-code-editor", currentUser: { id: "code-import-race" } }); await mounted.ready;
  function delayedFile() { let release; const file = { name: "late.js", size: 4, arrayBuffer: () => new Promise(resolve => { release = () => resolve(new TextEncoder().encode("late").buffer); }) }; return { file, finish: () => release() }; }
  try {
    inputCode(host, "code", "present text"); let delayed = delayedFile(), pending = api.handleChange(codeFileChange(delayed.file), host, "monaco-code-editor"); await tick(); await click(host, "monaco-code-editor", "cancel-code-import"); delayed.finish(); await pending;
    assert.equal(host.inputs.get("code").value, "present text"); assert.equal((await api.storage.list("records", row => row.type === "code", owner)).length, 0);
    delayed = delayedFile(); pending = api.handleChange(codeFileChange(delayed.file), host, "monaco-code-editor"); await tick(); inputCode(host, "code", "new typing"); delayed.finish(); await assert.rejects(pending, /vừa nhập thêm/); assert.equal(host.inputs.get("code").value, "new typing");
    delayed = delayedFile(); pending = api.handleChange(codeFileChange(delayed.file), host, "monaco-code-editor"); await tick(); mounted = api.mount(host, { toolId: "monaco-code-editor", currentUser: { id: "code-import-race-other" } }); await mounted.ready; delayed.finish(); await pending;
    assert.equal(host.inputs.get("code").value, ""); assert.equal((await api.storage.list("records", row => row.type === "code", "account:code-import-race-other")).length, 0);
  } finally { mounted.cleanup(); await tick(); }
});

test("code save detects a revision changed between read and commit without replacing newer content", async () => {
  const owner = "account:code-save-conflict", host = hostDouble(), mounted = api.mount(host, { toolId: "monaco-code-editor", currentUser: { id: "code-save-conflict" } }); await mounted.ready;
  const originalList = api.storage.list; let changed = false;
  try {
    inputCode(host, "code", "first saved"); await click(host, "monaco-code-editor", "save-code"); const id = host.dataset.codeDocument;
    inputCode(host, "code", "local unsaved"); api.storage.list = async (...args) => { if (!changed && args[0] === "records") { changed = true; const current = await api.storage.get("records", id, owner); await api.storage.put("records", { ...current, content: "other editor revision", updatedAt: new Date(Date.parse(current.updatedAt) + 1000).toISOString() }, owner); } return originalList(...args); };
    await click(host, "monaco-code-editor", "save-code"); assert.equal((await api.storage.get("records", id, owner)).content, "other editor revision"); assert.equal(host.inputs.get("code").value, "local unsaved"); assert.match(host.nodes.get("[data-tool-notice]").textContent, /Revision đã đổi/);
  } finally { api.storage.list = originalList; mounted.cleanup(); await tick(); }
});

test("File Explorer copies saved and draft UTF-8 text into independent code documents without altering bytes", async () => {
  const owner = "account:file-code-copy", original = "<script>globalThis.mustNeverRun = true</script>\r\n", blob = new Blob([original], { type: "text/html" });
  await api.storage.put("files", { id: "copy-html", name: "literal.html", type: "text/html", size: blob.size, blob, updatedAt: new Date().toISOString() }, owner);
  const host = hostDouble(), mounted = api.mount(host, { toolId: "file-explorer", currentUser: { id: "file-code-copy" } }); await mounted.ready;
  try {
    await click(host, "file-explorer", "preview-file", { recordId: "copy-html" }); host.inputs.get("file-content").value = "unsaved draft HTML";
    assert.match(host.nodes.get("[data-tool-preview]").innerHTML, /copy-file-code/); await click(host, "file-explorer", "copy-file-code", { recordId: "copy-html" }); await click(host, "file-explorer", "copy-file-draft-code", { recordId: "copy-html" });
    const copies = await api.storage.list("records", row => row.type === "code", owner); assert.equal(copies.length, 2); assert.ok(copies.some(row => row.content === original.replace(/\r\n/g, "\n"))); assert.ok(copies.some(row => row.content === "unsaved draft HTML")); assert.equal(new Set(copies.map(row => row.title)).size, 2);
    assert.equal(await (await api.storage.get("files", "copy-html", owner)).blob.text(), original); assert.equal(host.inputs.get("file-content").value, "unsaved draft HTML"); assert.equal(host.dataset.activeFile, "copy-html"); assert.equal(globalThis.mustNeverRun, undefined);
    host.inputs.get("file-content").value = "x".repeat(200001); await click(host, "file-explorer", "copy-file-draft-code", { recordId: "copy-html" }); assert.match(host.nodes.get("[data-tool-notice]").textContent, /200.000/); assert.equal((await api.storage.list("records", row => row.type === "code", owner)).length, 2);
  } finally { mounted.cleanup(); await tick(); }
});

test("Monaco editor and diff avoid cancellable occurrence delays and dispose each owned resource once", async () => {
  const originalMonaco = globalThis.monaco, models = [], editors = [], listeners = [];
  function disposable() { const item = { disposed: 0, dispose() { this.disposed += 1; } }; listeners.push(item); return item; }
  globalThis.monaco = { languages: {}, editor: {
    createModel(content, language) { const model = { content, language, disposed: 0, uri: {}, dispose() { this.disposed += 1; } }; models.push(model); return model; },
    create(holder, options) { const editor = { options, disposed: 0, getValue: () => options.model.content, getModel: () => options.model, getPosition: () => ({ lineNumber: 1, column: 1 }), setValue(value) { options.model.content = value; this.changed?.(); }, onDidChangeModelContent(callback) { this.changed = callback; return disposable(); }, onDidChangeCursorPosition(callback) { this.cursor = callback; return disposable(); }, dispose() { this.disposed += 1; } }; editors.push(editor); return editor; },
    setModelLanguage(model, language) { model.language = language; }, onDidChangeMarkers: () => disposable(),
    createDiffEditor(holder, options) { const editor = { options, disposed: 0, setModel(model) { this.model = model; }, dispose() { this.disposed += 1; } }; editors.push(editor); return editor; }
  } };
  const host = hostDouble(); let mounted;
  try {
    mounted = api.mount(host, { toolId: "monaco-code-editor", currentUser: { id: "code-resource-life" } }); await mounted.ready;
    assert.equal(editors[0].options.occurrencesHighlight, "off"); assert.equal(editors[0].options.minimap.enabled, false);
    editors[0].setValue("const saved = 1;"); await click(host, "monaco-code-editor", "save-code"); editors[0].setValue("const edited = 2;"); editors[0].cursor();
    host.nodes.set("[data-tool-code-diff]", { hidden: true, innerHTML: "", querySelector: () => ({}) }); await click(host, "monaco-code-editor", "diff-code"); assert.equal(editors[1].options.occurrencesHighlight, "off"); assert.equal(editors[1].model.original.content, "const saved = 1;"); assert.equal(editors[1].model.modified.content, "const edited = 2;");
    mounted.cleanup(); await tick(); assert.ok(editors.every(editor => editor.disposed === 1)); assert.ok(models.every(model => model.disposed === 1)); assert.ok(listeners.every(listener => listener.disposed === 1));
  } finally { mounted?.cleanup(); globalThis.monaco = originalMonaco; await tick(); }
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

test("subtitle timeline imports, edits, validates before export and restores scoped cue data", async () => {
  const originalFetch = globalThis.fetch, originalDocument = globalThis.document, downloads = []; let postCalls = 0;
  globalThis.fetch = async (url, options) => { if (options?.method === "POST") postCalls += 1; return { ok: true, json: async () => ({ providers: [{ provider: "speech", configured: false }] }) }; };
  globalThis.document = { createElement: () => ({ click() { downloads.push({ href: this.href, name: this.download }); } }) };
  const host = hostDouble(), owner = "account:cue-edits"; let mounted = api.mount(host, { toolId: "speech-to-text", currentUser: { id: "cue-edits" } }); await mounted.ready;
  try {
    host.inputs.get("subtitle-source").value = "1\n00:00:01,001 --> 00:00:02,500\n<script>literal, not HTML</script>\n\n2\n00:00:03,000 --> 00:00:04,000\nSecond line";
    await click(host, "speech-to-text", "subtitle-import"); let draft = await api.storage.get("records", "draft-speech-to-text", owner); assert.equal(draft.subtitle.cues.length, 2); assert.match(host.nodes.get("[data-tool-subtitle-cues]").innerHTML, /&lt;script&gt;/);
    await click(host, "speech-to-text", "export-vtt"); assert.equal(downloads.length, 1); const vtt = await (await originalFetch(downloads[0].href)).text(); assert.match(vtt, /^WEBVTT/); assert.match(vtt, /00:00:01\.001 --> 00:00:02\.500/);
    const cueId = draft.subtitle.cues[1].id;
    const input = { value: "1.5", dataset: { subtitleField: "start" }, matches: selector => selector === "[data-subtitle-field]", closest: () => ({ dataset: { subtitleCue: cueId } }) };
    api.handleInput({ target: input }, host, "speech-to-text"); await click(host, "speech-to-text", "export-srt"); assert.equal(downloads.length, 1); assert.match(host.nodes.get("[data-tool-notice]").textContent, /chồng lấn/);
    input.value = "3"; api.handleInput({ target: input }, host, "speech-to-text"); await click(host, "speech-to-text", "subtitle-validate"); await click(host, "speech-to-text", "subtitle-up", { subtitleCue: cueId }); assert.match(host.nodes.get("[data-tool-subtitle-validation]").textContent, /sai thứ tự/);
    await click(host, "speech-to-text", "subtitle-sort"); await click(host, "speech-to-text", "export-srt"); assert.equal(downloads.length, 2); assert.match(await (await originalFetch(downloads[1].href)).text(), /00:00:01,001 --> 00:00:02,500/);
    const persisted = await api.exportWorkspaceData({ owner }), fresh = freshApi(); await fresh.importWorkspaceData(persisted, { owner, strategy: "replace" });
    const nextHost = hostDouble(), next = fresh.mount(nextHost, { toolId: "speech-to-text", currentUser: { id: "cue-edits" } }); await next.ready;
    assert.match(nextHost.nodes.get("[data-tool-subtitle-origin]").textContent, /Nhập SRT.*2 cue/); await clickApi(fresh, nextHost, "speech-to-text", "subtitle-delete", { subtitleCue: cueId }); assert.equal((await fresh.storage.get("records", "draft-speech-to-text", owner)).subtitle.cues.length, 1); next.cleanup(); await tick();
    const isolatedHost = hostDouble(), isolated = fresh.mount(isolatedHost, { toolId: "speech-to-text", currentUser: { id: "cue-other" } }); await isolated.ready; assert.match(isolatedHost.nodes.get("[data-tool-subtitle-origin]").textContent, /0 cue/); isolated.cleanup();
    assert.equal(postCalls, 0);
  } finally { mounted.cleanup(); globalThis.fetch = originalFetch; globalThis.document = originalDocument; globalThis.HHToolWorkspace = api; await tick(); }
});

test("subtitle imports fail atomically on unsupported formats and estimated conversion remains explicit", async () => {
  const original = globalThis.fetch; globalThis.fetch = async () => ({ ok: true, json: async () => ({ providers: [{ provider: "speech", configured: false }] }) });
  const host = hostDouble(), mounted = api.mount(host, { toolId: "speech-to-text", currentUser: { id: "cue-file" } }); await mounted.ready;
  try {
    host.inputs.get("transcript").value = "Sentence one. Sentence two."; await click(host, "speech-to-text", "subtitle-from-transcript"); assert.match(host.nodes.get("[data-tool-subtitle-origin]").textContent, /Mốc ước lượng/);
    const before = await api.storage.get("records", "draft-speech-to-text", "account:cue-file"), file = new Blob(["WEBVTT\n\nSTYLE\n::cue { color: red; }\n\n00:00.000 --> 00:01.000\nText"], { type: "text/vtt" }); file.name = "styles.vtt";
    await assert.rejects(api.handleChange({ target: { files: [file], matches: selector => selector === "[data-tool-subtitle-file]" } }, host, "speech-to-text"), /STYLE\/REGION/);
    assert.deepEqual((await api.storage.get("records", "draft-speech-to-text", "account:cue-file")).subtitle, before.subtitle);
    await click(host, "speech-to-text", "clear-transcript"); assert.equal(host.inputs.get("transcript").value, ""); assert.match(host.nodes.get("[data-tool-subtitle-origin]").textContent, /2 cue/);
  } finally { mounted.cleanup(); globalThis.fetch = original; await tick(); }
});

test("version pages, context filters and selected comparison use actual snapshots", async () => {
  const owner = "account:version-browser";
  for (let index = 0; index < 25; index += 1) await api.storage.put("records", { id: `paged-${index}`, type: "version", label: `Snapshot ${String(index).padStart(2, "0")}`, content: index === 2 ? "unique search content" : `content ${index}`, sourceDocument: index >= 22 ? "code-document" : "local", createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString() }, owner);
  const host = hostDouble(), mounted = api.mount(host, { toolId: "version-history", currentUser: { id: "version-browser" } }); await mounted.ready;
  try {
    assert.equal((host.nodes.get("[data-tool-list]").innerHTML.match(/<article /g) || []).length, 20); assert.match(host.nodes.get("[data-tool-version-page]").textContent, /Trang 1\/2/);
    await click(host, "version-history", "version-next"); assert.equal((host.nodes.get("[data-tool-list]").innerHTML.match(/<article /g) || []).length, 5);
    host.inputs.get("version-filter").value = "unique search"; await click(host, "version-history", "version-next"); assert.match(host.nodes.get("[data-tool-list]").innerHTML, /Snapshot 02/); assert.equal((host.nodes.get("[data-tool-list]").innerHTML.match(/<article /g) || []).length, 1);
    host.inputs.get("version-filter").value = ""; const context = host.inputs.get("version-document"); context.value = "code-document"; await api.handleChange({ target: context }, host, "version-history"); assert.equal((host.nodes.get("[data-tool-list]").innerHTML.match(/<article /g) || []).length, 3);
    for (const id of ["paged-22", "paged-23"]) await api.handleChange({ target: { checked: true, dataset: { versionSelect: id }, matches: selector => selector === "[data-version-select]" } }, host, "version-history");
    await click(host, "version-history", "compare-selected-versions"); assert.match(host.nodes.get("[data-tool-output]").textContent, /Snapshot 22.*Snapshot 23/); assert.match(host.nodes.get("[data-tool-output]").textContent, /- content 22\n\+ content 23/);
    await click(host, "version-history", "rename-version", { recordId: "paged-22", querySelector: () => ({ value: "Named revision" }) }); assert.equal((await api.storage.get("records", "paged-22", owner)).label, "Named revision");
    host.inputs.get("document").value = "My local editing text"; await click(host, "version-history", "restore-version", { recordId: "paged-22" }); assert.equal(host.inputs.get("document").value, "My local editing text"); assert.match(host.nodes.get("[data-tool-notice]").textContent, /khác nhóm/);
    await click(host, "version-history", "restore-version", { recordId: "paged-22", confirmContext: "paged-22" }); assert.equal(host.inputs.get("document").value, "content 22"); assert.equal(host.dataset.versionContext, "code-document"); assert.ok((await api.storage.list("records", row => row.type === "version", owner)).some(row => row.content === "My local editing text"));
  } finally { mounted.cleanup(); await tick(); }
});

test("version restore never overwrites text typed during an asynchronous read", async () => {
  const host = hostDouble(), mounted = api.mount(host, { toolId: "version-history", currentUser: { id: "version-race" } }); await mounted.ready;
  const original = api.storage.get; let release; api.storage.get = (store, id, owner) => id === "delayed-version" ? new Promise(resolve => { release = resolve; }) : original.call(api.storage, store, id, owner);
  try {
    host.inputs.get("document").value = "Before read"; const pending = click(host, "version-history", "restore-version", { recordId: "delayed-version" }); await tick();
    host.inputs.get("document").value = "New text while reading"; api.handleInput({ target: host.inputs.get("document") }, host, "version-history");
    release({ id: "delayed-version", type: "version", label: "Older", content: "snapshot text", createdAt: new Date().toISOString() }); await pending;
    assert.equal(host.inputs.get("document").value, "New text while reading"); assert.match(host.nodes.get("[data-tool-notice]").textContent, /vừa được sửa/);
  } finally { api.storage.get = original; mounted.cleanup(); await tick(); }
});

test("large restored version drafts survive fresh reload without truncation", async () => {
  const owner = "account:version-large-draft", content = "x".repeat(250001);
  await api.storage.put("records", { id: "large-snapshot", type: "version", label: "Large", content, createdAt: new Date().toISOString() }, owner);
  const host = hostDouble(), mounted = api.mount(host, { toolId: "version-history", currentUser: { id: "version-large-draft" } }); await mounted.ready;
  try {
    await click(host, "version-history", "restore-version", { recordId: "large-snapshot" }); const exported = await api.exportWorkspaceData({ owner }); assert.equal(exported.records.find(row => row.id === "draft-version-history").values.document, content);
    const fresh = freshApi(); await fresh.importWorkspaceData(exported, { owner, strategy: "replace" }); const nextHost = hostDouble(), next = fresh.mount(nextHost, { toolId: "version-history", currentUser: { id: "version-large-draft" } }); await next.ready; assert.equal(nextHost.inputs.get("document").value, content); next.cleanup();
  } finally { mounted.cleanup(); globalThis.HHToolWorkspace = api; await tick(); }
});

test("delayed selected-version comparison cannot display another account's content in a reused host", async () => {
  const timestamp = new Date().toISOString(), host = hostDouble();
  for (const [id, content] of [["compare-one", "Account A secret one"], ["compare-two", "Account A secret two"]]) await api.storage.put("records", { id, type: "version", label: id, content, createdAt: timestamp }, "account:compare-A");
  await api.storage.put("records", { id: "compare-one", type: "version", label: "B version", content: "Account B content", createdAt: timestamp }, "account:compare-B");
  let mounted = api.mount(host, { toolId: "version-history", currentUser: { id: "compare-A" } }); await mounted.ready; host._selectedVersions = new Set(["compare-one", "compare-two"]);
  const original = api.storage.get; let release; api.storage.get = (store, id, owner) => id === "compare-one" && owner === "account:compare-A" ? new Promise(resolve => { release = resolve; }) : original.call(api.storage, store, id, owner);
  try {
    const pending = click(host, "version-history", "compare-selected-versions"); await tick(); assert.equal(typeof release, "function");
    mounted.cleanup(); mounted = api.mount(host, { toolId: "version-history", currentUser: { id: "compare-B" } }); await mounted.ready;
    release({ id: "compare-one", type: "version", label: "A secret", content: "Account A secret one", createdAt: timestamp }); await pending;
    assert.doesNotMatch(host.nodes.get("[data-tool-output]").textContent, /Account A|A secret/); assert.equal((await original.call(api.storage, "records", "compare-one", "account:compare-B")).content, "Account B content");
  } finally { api.storage.get = original; mounted.cleanup(); await tick(); }
});

test("delayed rename never copies an old account's snapshot into a newly mounted account", async () => {
  const timestamp = new Date().toISOString(), host = hostDouble(); await api.storage.put("records", { id: "rename-private", type: "version", label: "Original A", content: "A private snapshot", createdAt: timestamp }, "account:rename-A");
  let mounted = api.mount(host, { toolId: "version-history", currentUser: { id: "rename-A" } }); await mounted.ready;
  const original = api.storage.get; let release; api.storage.get = (store, id, owner) => id === "rename-private" && owner === "account:rename-A" ? new Promise(resolve => { release = resolve; }) : original.call(api.storage, store, id, owner);
  try {
    const pending = click(host, "version-history", "rename-version", { recordId: "rename-private", querySelector: () => ({ value: "Renamed A" }) }); await tick();
    mounted.cleanup(); mounted = api.mount(host, { toolId: "version-history", currentUser: { id: "rename-B" } }); await mounted.ready;
    release({ id: "rename-private", type: "version", label: "Original A", content: "A private snapshot", createdAt: timestamp }); await pending;
    assert.equal(await original.call(api.storage, "records", "rename-private", "account:rename-B"), null); assert.equal((await original.call(api.storage, "records", "rename-private", "account:rename-A")).label, "Original A"); assert.doesNotMatch(host.nodes.get("[data-tool-list]").innerHTML, /private snapshot|Renamed A/);
  } finally { api.storage.get = original; mounted.cleanup(); await tick(); }
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
