const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const studios = require(path.join(root, "creative-specialist-studios.js"));

function memoryStorage() {
  const data = new Map();
  return {
    data,
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }
  };
}

function completeDraft(view) {
  const draft = {};
  studios.TOOL_DEFINITIONS[view].fields.forEach((field) => {
    if (field.type === "number") draft[field.name] = String(field.value ?? field.min ?? 1);
    else if (field.type === "select") draft[field.name] = field.options[0];
    else if (field.type === "date") draft[field.name] = field.value || "2026-09-01";
    else if (field.name === "projects") draft[field.name] = "HH Creative | Thiết kế sản phẩm | Hoàn thành bản thử nghiệm";
    else draft[field.name] = `Nội dung thực cho ${field.label.toLowerCase()}`;
  });
  return draft;
}

test("ten specialist studios have unique roles, definitions, formats and storage", () => {
  assert.equal(studios.VIEWS.length, 10);
  assert.equal(new Set(studios.VIEWS).size, 10);
  const keys = studios.VIEWS.map((view) => studios.STORAGE_KEYS[view]);
  assert.equal(new Set(keys).size, studios.VIEWS.length);
  studios.VIEWS.forEach((view) => {
    const definition = studios.TOOL_DEFINITIONS[view];
    assert.ok(definition, `missing definition for ${view}`);
    assert.ok(definition.role.length >= 12, `role is too vague for ${view}`);
    assert.ok(definition.fields.some((field) => field.required), `${view} lacks a required input`);
    assert.ok(definition.formats.length >= 3, `${view} lacks useful exports`);
    assert.match(studios.STORAGE_KEYS[view], new RegExp(`hh\\.creative\\.tool\\.${view.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  });
});

test("every studio performs its own deterministic real local task", () => {
  const signatures = new Set();
  studios.VIEWS.forEach((view) => {
    const input = completeDraft(view);
    const first = studios.runGenerator(view, input);
    const second = studios.runGenerator(view, input);
    assert.ok(first && typeof first === "object", `${view} returned no structured output`);
    assert.deepEqual(first, second, `${view} output is not deterministic`);
    assert.ok(Object.keys(first).length >= 3, `${view} returned a placeholder output`);
    signatures.add(Object.keys(first).sort().join("|"));
    const markdown = studios.outputToMarkdown(view, first);
    assert.match(markdown, /^# /);
    assert.ok(markdown.length > 80, `${view} markdown export is empty`);
  });
  assert.ok(signatures.size >= 8, "specialist tools reuse one generic output schema");
});

test("drafts, output and history remain isolated between studios", () => {
  const storage = memoryStorage();
  const idea = studios.createDefaultState("idea-lab");
  idea.draft = completeDraft("idea-lab");
  idea.output = studios.runGenerator("idea-lab", idea.draft);
  idea.history = [{ id: "idea-one", label: "Ý tưởng A", createdAt: new Date().toISOString(), draft: idea.draft, output: idea.output }];
  assert.equal(studios.saveState("idea-lab", idea, storage).ok, true);

  const namingBefore = studios.loadState("naming-studio", storage);
  assert.equal(namingBefore.output, null);
  assert.equal(namingBefore.history.length, 0);
  const naming = studios.createDefaultState("naming-studio");
  naming.draft = completeDraft("naming-studio");
  naming.output = studios.runGenerator("naming-studio", naming.draft);
  assert.equal(studios.saveState("naming-studio", naming, storage).ok, true);

  const ideaAfter = studios.loadState("idea-lab", storage);
  assert.equal(ideaAfter.history.length, 1);
  assert.equal(ideaAfter.history[0].id, "idea-one");
  assert.equal(storage.data.size, 2);

  storage.setItem(studios.STORAGE_KEYS["idea-lab"], studios.exportWorkspaceState("naming-studio", naming));
  const repairedIdea = studios.loadState("idea-lab", storage);
  assert.deepEqual(repairedIdea, studios.createDefaultState("idea-lab"), "foreign envelope must not bleed into this studio");
  assert.equal(studios.saveState("idea-lab", naming, storage).reason, "foreign-state");
});

test("mount rejects a storage key owned by another studio", () => {
  assert.equal(studios.isAllowedStorageKey("idea-lab", studios.STORAGE_KEYS["idea-lab"]), true);
  // Creative OS may pass its project-envelope alias through a scoped adapter.
  assert.equal(studios.isAllowedStorageKey("idea-lab", "hh.creative.tool.idea-lab.project.v1"), true);
  assert.equal(studios.isAllowedStorageKey("idea-lab", studios.STORAGE_KEYS["naming-studio"]), false);
  assert.throws(() => studios.mount({ innerHTML: "" }, {
    view: "idea-lab",
    storageKey: studios.STORAGE_KEYS["naming-studio"]
  }), /không thuộc studio/i);
});

test("workspace import rejects cross-tool, malformed and oversized data", () => {
  const idea = studios.createDefaultState("idea-lab");
  const exported = studios.exportWorkspaceState("idea-lab", idea);
  assert.equal(studios.importState("idea-lab", exported).view, "idea-lab");
  assert.equal(studios.importState("idea-lab", `\ufeff${exported}`).view, "idea-lab", "UTF-8 BOM should be accepted");
  assert.throws(() => studios.importState("naming-studio", exported), /đúng studio/i);
  assert.throws(() => studios.importState("idea-lab", JSON.stringify({ format: "unknown", view: "idea-lab" })), /đúng studio/i);
  assert.throws(() => studios.importState("idea-lab", JSON.stringify({ ...idea, version: 999 })), /phiên bản/i);
  assert.throws(() => studios.importState("idea-lab", "{not json}"), /JSON không hợp lệ/i);
  assert.throws(() => studios.importState("idea-lab", "x".repeat(studios.LIMITS.importBytes + 1)), /1 MB/);
  const multiByteOversize = JSON.stringify({ ...idea, ignored: "😀".repeat(300000) });
  assert.ok(multiByteOversize.length < studios.LIMITS.importBytes, "fixture must be under the old UTF-16 length limit");
  assert.throws(() => studios.importState("idea-lab", multiByteOversize), /1 MB/, "limit must use UTF-8 bytes");
});

test("imported history has valid unique ids and safe timestamps", () => {
  const draft = completeDraft("idea-lab");
  const raw = studios.createDefaultState("idea-lab");
  const longId = "x".repeat(100);
  raw.history = [
    { id: longId, label: "Một", createdAt: "2026-02-30T10:00:00Z", draft },
    { id: longId, label: "Hai", createdAt: "2026-08-29T10:00:00+07:00", draft }
  ];
  const normalized = studios.normalizeState("idea-lab", raw);
  assert.equal(new Set(normalized.history.map((entry) => entry.id)).size, 2);
  assert.equal(normalized.history[0].createdAt, "1970-01-01T00:00:00.000Z");
  assert.equal(normalized.history[1].createdAt, "2026-08-29T03:00:00.000Z");
});

test("specialist exports are bounded formats and HTML escapes user content", () => {
  const draft = completeDraft("portfolio-builder");
  draft.name = '<img src=x onerror="alert(1)">';
  const output = studios.runGenerator("portfolio-builder", draft);
  const html = studios.outputToHtml("portfolio-builder", output);
  assert.doesNotMatch(html, /<img src=x/i);
  assert.match(html, /&lt;img/);
  for (const format of studios.TOOL_DEFINITIONS["portfolio-builder"].formats) {
    const exported = studios.exportOutput("portfolio-builder", output, format);
    assert.ok(exported.filename.endsWith(`.${format === "markdown" ? "md" : format}`));
    assert.ok(exported.content.length > 20);
  }

  const photoDraft = completeDraft("photo-planner");
  photoDraft.subject = "=HYPERLINK(\"https://example.invalid\")";
  const csv = studios.outputToCsv("photo-planner", studios.runGenerator("photo-planner", photoDraft));
  assert.match(csv, /"'=HYPERLINK/);
  assert.doesNotMatch(csv, /\n"=HYPERLINK/);
  const craftedCsv = studios.outputToCsv("photo-planner", { shots: [{ number: 1, shot: "Cảnh", subject: "\r=1+1", direction: "Tĩnh", lens: "50 mm", priority: "Chính" }] });
  assert.match(craftedCsv, /"' =1\+1"/);
});

test("UI source cleans up listeners/timers and styles support keyboard and mobile", () => {
  const source = read("creative-specialist-studios.js");
  const css = read("creative-specialist-studios.css");
  for (const contract of [
    "AbortController", "controller.abort()", "clearTimeout", "URL.revokeObjectURL",
    "reportValidity", "Tệp không thuộc đúng studio đang mở", "không dùng chung lịch sử",
    "draftDirty", "instance.readers", "instance.objectUrls", "readAsText(file, \"utf-8\")",
    "TextDecoderConstructor(\"utf-8\", { fatal: true })", "readAsArrayBuffer(file)",
    "aria-atomic=\\\"true\\\"", "data-hhcss-output-title", "tabindex=\\\"-1\\\""
  ]) assert.ok(source.includes(contract), `missing runtime contract: ${contract}`);
  assert.ok(source.includes('aria-live=\\"polite\\"'));
  assert.doesNotMatch(source, /\beval\s*\(|\bnew\s+Function\s*\(/);
  assert.doesNotMatch(source, /(?:AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}|BEGIN PRIVATE KEY)/);
  for (const contract of [":focus-visible", ":focus-within", "@media (max-width: 480px)", "prefers-reduced-motion: reduce", "forced-colors: active", "min-height: 44px", "grid-template-columns: 1fr", "overflow-wrap: anywhere"]) {
    assert.match(css, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
