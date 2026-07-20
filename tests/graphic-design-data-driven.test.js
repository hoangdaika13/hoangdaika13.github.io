const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const file = path.join(root, "graphic-design-data-driven.js");
const source = fs.readFileSync(file, "utf8");
const engine = require(file);

test("Data-driven Design exposes the standalone UMD lifecycle", () => {
  assert.equal(engine.VERSION, 1);
  assert.equal(engine.FORMAT, "hh-graphic-data-driven");
  assert.equal(engine.STORAGE_KEY, "hh.graphic-data-driven.dataset.v1");
  assert.equal(typeof engine.mount, "function");
  assert.equal(typeof engine.unmount, "function");
  assert.match(source, /globalScope\.HHGraphicDataDriven = api/);
  assert.match(source, /\[data-graphic-data-driven\]/);
  assert.match(source, /mounted\.delete\(root\)/);
});

test("CSV parser handles BOM, escaped quotes, embedded newlines and uneven rows", () => {
  const parsed = engine.parseCSV('\ufeffname,note,status\r\n"Mai, An","Line 1\nLine 2","active"\r\nBao,"He said ""hello""",review\r\nLan,short');
  assert.equal(parsed.valid, true);
  assert.deepEqual(parsed.headers, ["name", "note", "status"]);
  assert.equal(parsed.records.length, 3);
  assert.equal(parsed.records[0].name, "Mai, An");
  assert.equal(parsed.records[0].note, "Line 1\nLine 2");
  assert.equal(parsed.records[1].note, 'He said "hello"');
  assert.equal(parsed.records[2].status, "");
  assert.ok(parsed.warnings.some((warning) => warning.code === "column-mismatch"));
  assert.equal(engine.parseCSV("a,b\n\"broken,b").valid, false);
});

test("JSON parsing is bounded, removes pollution keys and never executes formula-like text", () => {
  delete globalThis.__gddFormulaRan;
  const parsed = engine.parseJSON('[{"name":"=globalThis.__gddFormulaRan=1","profile":{"city":"Hue"},"tags":["brand","web"],"__proto__":{"polluted":true}}]');
  assert.equal(parsed.valid, true);
  assert.equal(parsed.records[0].name, "=globalThis.__gddFormulaRan=1");
  assert.equal(globalThis.__gddFormulaRan, undefined);
  assert.equal({}.polluted, undefined);
  assert.ok(parsed.warnings.some((warning) => warning.code === "formula-like"));
  assert.equal(engine.parseJSON("not-json").valid, false);
  assert.doesNotMatch(source, /\beval\s*\(|new\s+Function\s*\(|Function\s*\(/);
});

test("Schema inference supports nested, list, enum and semantic design fields", () => {
  const records = [
    { name: "A", role: "Designer", accent: "#112233", avatar: "./a.png", tags: ["brand"], profile: { city: "Hue", score: 10 } },
    { name: "B", role: "Developer", accent: "#445566", avatar: "./b.png", tags: ["web", "ui"], profile: { city: "Hue", score: 20 } },
    { name: "C", role: "Designer", accent: "#778899", avatar: "./c.png", tags: [], profile: { city: "Da Nang", score: 30 } }
  ];
  const schema = engine.inferSchema(records);
  assert.equal(schema.find((field) => field.path === "profile.score").type, "number");
  assert.equal(schema.find((field) => field.path === "tags").type, "list");
  assert.equal(schema.find((field) => field.path === "role").type, "enum");
  assert.equal(schema.find((field) => field.path === "accent").semantic, "color");
  assert.equal(schema.find((field) => field.path === "avatar").semantic, "image");
  assert.equal(engine.getValueAtPath(records[0], "profile.city"), "Hue");
});

test("Source, target and bidirectional bindings read and write deterministically", () => {
  const record = { profile: { name: "Mai" }, accent: "#123456", tags: ["one", "two"], status: "active" };
  const sourceBinding = { path: "profile.name", target: "text", slot: "title", direction: "source" };
  assert.equal(engine.bindingValue(record, sourceBinding, "banner"), "Mai");
  const blocked = engine.updateRecordFromBinding(record, sourceBinding, "Lan");
  assert.equal(blocked.updated, false);
  assert.equal(blocked.record.profile.name, "Mai");

  const twoWay = { path: "profile.name", target: "text", slot: "title", direction: "bidirectional" };
  const updated = engine.updateRecordFromBinding(record, twoWay, "Lan <Admin>");
  assert.equal(updated.updated, true);
  assert.equal(updated.record.profile.name, "Lan <Admin>");
  assert.equal(record.profile.name, "Mai");

  const listBinding = { path: "tags", target: "text", slot: "subtitle", direction: "bidirectional" };
  assert.deepEqual(engine.updateRecordFromBinding(record, listBinding, "three, four").record.tags, ["three", "four"]);
  assert.equal(engine.writeBinding(record, twoWay, "Chi").profile.name, "Chi");
  assert.equal(engine.applyBindings(record, [twoWay], "banner").title, "Mai");
});

test("Record repetition produces banner, member card and thumbnail batches", () => {
  const project = engine.createDefaultProject();
  assert.deepEqual(Object.keys(engine.TEMPLATES), ["banner", "member-card", "thumbnail"]);
  for (const templateId of Object.keys(engine.TEMPLATES)) {
    const batch = engine.generateBatch(project, { templateId });
    assert.equal(batch.length, project.records.length);
    assert.equal(batch[0].templateId, templateId);
    assert.equal(batch[0].width, engine.TEMPLATES[templateId].width);
    assert.equal(batch[0].title, project.records[0].name);
  }
  assert.equal(engine.repeatTemplate("banner", project.records, project.bindings).length, project.records.length);
  const manifest = engine.generateManifest(project);
  assert.equal(manifest.items.length, project.records.length * 3);
});

test("Validation reports required, color, image and binding issues without hiding warnings", () => {
  const records = [{ name: "A", accent: "#112233", image: "./safe.png" }, { name: "", accent: "red", image: "javascript:alert(1)" }];
  const schema = engine.inferSchema([records[0], { name: "B", accent: "#445566", image: "./other.png" }]);
  const validation = engine.validateDataset(records, schema);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.code === "required" && error.path === "name"));
  assert.ok(validation.errors.some((error) => error.code === "invalid-color"));
  assert.ok(validation.errors.some((error) => error.code === "invalid-image"));

  const project = engine.createDefaultProject();
  project.bindings.push({ id: "missing", path: "missing.path", target: "text", slot: "title", direction: "source" });
  assert.ok(engine.validateProject(project).warnings.some((warning) => warning.code === "missing-binding-field"));
});

test("Local persistence is versioned and has an honest unsupported result", () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
  const project = engine.createDefaultProject();
  const saved = engine.saveDataset(project, storage);
  assert.equal(saved.ok, true);
  assert.equal(JSON.parse(memory.get(engine.STORAGE_KEY)).format, engine.FORMAT);
  assert.equal(engine.loadDataset(storage).records.length, project.records.length);
  assert.deepEqual(engine.saveDataset(project, null).reason, "unsupported");
  assert.equal(engine.detectCapabilities({}, null, null).localPersistence, false);
});

test("Manifest and static HTML exports escape user data and contain no executable formula runtime", () => {
  const project = engine.createDefaultProject();
  project.name = 'Demo </title><script>globalThis.pwned=1</script>';
  project.records[0].name = '<img src=x onerror="globalThis.pwned=1">';
  project.records[0].status = 'ready" onmouseover="alert(1)';
  project.records[0].image = "javascript:alert(1)";
  const manifest = JSON.parse(engine.exportManifest(project));
  const html = engine.exportHTML(project);
  assert.equal(manifest.format, engine.FORMAT);
  assert.equal(manifest.templates.length, 3);
  assert.match(html, /&lt;img src=x onerror=&quot;globalThis\.pwned=1&quot;&gt;/);
  assert.doesNotMatch(html, /<script>globalThis\.pwned/);
  assert.doesNotMatch(html, /javascript:alert/);
  assert.doesNotMatch(html, /onmouseover=/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
});

test("Workspace includes local file flow, accessible status, keyboard tabs and responsive motion-safe styles", () => {
  for (const marker of [
    "data-gdd-source", "data-gdd-file", "FileReader", "readAsText", "data-gdd-binding-path", "data-gdd-binding-direction",
    "data-gdd-edit", "data-gdd-template", 'role="tablist"', 'aria-live="polite"', 'role="status"', "localStorage",
    "unsupported", "@media(max-width:420px)", "@media(prefers-reduced-motion:reduce)", "ArrowRight", "ArrowLeft"
  ]) assert.ok(source.includes(marker), `missing ${marker}`);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(source, /https?:\/\/[^"'\s]+\.js/);
});
