const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const file = path.join(root, "graphic-design-components.js");
const source = fs.readFileSync(file, "utf8");
const components = require(file);

function findNode(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

test("Component System exposes a standalone UMD lifecycle and versioned local contract", () => {
  assert.equal(components.VERSION, 1);
  assert.equal(components.FORMAT, "hh-graphic-components");
  assert.equal(components.LIBRARY_FORMAT, "hh-graphic-component-library");
  assert.equal(components.STORAGE_KEY, "hh.graphic-components.project.v1");
  assert.equal(typeof components.mount, "function");
  assert.equal(typeof components.unmount, "function");
  assert.match(source, /globalScope\.HHGraphicComponents = api/);
  assert.match(source, /instances\.delete\(root\)/);
});

test("Default library contains reusable masters, linked instances and all four variant axes", () => {
  const project = components.createDefaultProject();
  assert.ok(project.library.components.length >= 2);
  assert.ok(project.instances.length >= 3);
  assert.deepEqual(Object.keys(components.VARIANT_AXES), ["theme", "size", "state", "language"]);
  assert.deepEqual(components.VARIANT_AXES.theme, ["light", "dark"]);
  assert.deepEqual(components.VARIANT_AXES.size, ["sm", "md", "lg"]);
  assert.deepEqual(components.VARIANT_AXES.state, ["default", "hover", "disabled"]);
  assert.deepEqual(components.VARIANT_AXES.language, ["vi", "en", "ja"]);
  assert.equal(components.validateGraph(project).valid, true);
  assert.ok(components.validateGraph(project).graph["feature-card"].includes("action-button"));
});

test("Master edits propagate to linked instances while instance overrides remain local", () => {
  let project = components.createDefaultProject();
  const linked = components.resolveInstance(project, "button-live");
  const overridden = components.resolveInstance(project, "button-override");
  assert.equal(findNode(linked.root, "button-label").props.text, "Bat dau");
  assert.equal(findNode(overridden.root, "button-label").props.text, "Dung mien phi");

  project = components.setMasterProperty(project, "action-button", "button-label.text", "Master propagated");
  assert.equal(findNode(components.resolveInstance(project, "button-live").root, "button-label").props.text, "Master propagated");
  assert.equal(findNode(components.resolveInstance(project, "button-override").root, "button-label").props.text, "Dung mien phi");

  project = components.updateMaster(project, "action-button", { "button-label.text": "Master fallback" });
  project = components.resetOverride(project, "button-override", "button-label.text");
  assert.equal(findNode(components.resolveInstance(project, "button-override").root, "button-label").props.text, "Master fallback");
});

test("Variant values resolve deterministically before instance overrides", () => {
  let project = components.createDefaultProject();
  project = components.setInstanceVariant(project, "button-live", "theme", "light");
  project = components.setInstanceVariant(project, "button-live", "size", "lg");
  project = components.setInstanceVariant(project, "button-live", "state", "disabled");
  project = components.setInstanceVariant(project, "button-live", "language", "en");
  let resolved = components.resolveInstance(project, "button-live");
  assert.equal(findNode(resolved.root, "button-label").props.text, "Get started");
  assert.equal(findNode(resolved.root, "button-label").props.fontSize, 17);
  assert.equal(findNode(resolved.root, "button-label").props.color, "#FFFFFF");
  assert.equal(findNode(resolved.root, "button-root").props.disabled, true);
  assert.equal(findNode(resolved.root, "button-root").props.opacity, 0.45);

  project = components.setInstanceOverride(project, "button-live", "button-label.text", "Only this instance");
  resolved = components.resolveInstance(project, "button-live");
  assert.equal(findNode(resolved.root, "button-label").props.text, "Only this instance");

  project = components.setVariantProperty(project, "action-button", "language", "en", "button-label.text", "Continue");
  project = components.resetOverride(project, "button-live", "button-label.text");
  assert.equal(findNode(components.resolveInstance(project, "button-live").root, "button-label").props.text, "Continue");
});

test("Detach captures a stable snapshot and reset override restores current master resolution", () => {
  let project = components.createDefaultProject();
  project = components.setInstanceOverride(project, "button-live", "button-label.text", "Snapshot label");
  project = components.detachInstance(project, "button-live");
  assert.equal(components.resolveInstance(project, "button-live").detached, true);
  assert.equal(findNode(components.resolveInstance(project, "button-live").root, "button-label").props.text, "Snapshot label");

  project = components.setMasterProperty(project, "action-button", "button-label.text", "Changed after detach");
  assert.equal(findNode(components.resolveInstance(project, "button-live").root, "button-label").props.text, "Snapshot label");

  project = components.setInstanceOverride(project, "button-override", "button-label.text", "Temporary");
  project = components.resetOverride(project, "button-override");
  assert.deepEqual(project.instances.find((item) => item.id === "button-override").overrides, {});
});

test("Nested graph rejects direct and transitive cycles and resolver protects imported cycles", () => {
  const project = components.createDefaultProject();
  assert.equal(components.wouldCreateCycle(project, "action-button", "feature-card"), true);
  const rejected = components.addNestedComponent(project, "action-button", "feature-card");
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /cycle/i);

  const unsafe = components.createDefaultProject();
  unsafe.library.components.find((item) => item.id === "action-button").root.children.push({
    id: "bad-cycle", type: "component", name: "Cycle", componentId: "feature-card", variant: {}, overrides: {}
  });
  const validation = components.validateGraph(unsafe);
  assert.equal(validation.valid, false);
  assert.ok(validation.cycles.length >= 1);
  const resolved = components.resolveComponent(unsafe, "action-button");
  assert.ok(resolved.issues.some((issue) => issue.type === "cycle"));
  assert.match(components.renderResolvedHtml(resolved), /Da chan cycle/);
});

test("Component creation, instance creation and library round-trip remain reusable", () => {
  let project = components.createDefaultProject();
  const addedMaster = components.addComponent(project, components.createComponent({ id: "notice", name: "Notice" }));
  project = addedMaster.project;
  assert.equal(addedMaster.component.id, "notice");
  const addedInstance = components.addInstance(project, "notice", { id: "notice-one", language: "en" });
  project = addedInstance.project;
  assert.equal(components.resolveInstance(project, "notice-one").componentId, "notice");

  const libraryJson = components.serializeLibrary(project);
  const imported = components.importLibrary(components.createDefaultProject(), libraryJson);
  assert.equal(imported.ok, true);
  assert.ok(imported.added.includes("notice"));
  assert.ok(imported.project.library.components.some((item) => item.id === "notice"));
});

test("Serialization and preview HTML escape untrusted component text", () => {
  let project = components.createDefaultProject();
  project = components.setInstanceOverride(project, "button-live", "button-label.text", '<img src=x onerror="globalThis.pwned=1">');
  const serialized = components.serializeProject(project);
  const parsed = components.deserializeProject(serialized);
  const resolved = components.resolveInstance(parsed, "button-live");
  const html = components.renderResolvedHtml(resolved);
  assert.doesNotMatch(serialized, /<img/);
  assert.doesNotMatch(html, /<img src=/);
  assert.match(html, /&lt;img src=x onerror=&quot;globalThis\.pwned=1&quot;&gt;/);
});

test("Local persistence uses only the versioned hh key and reports unsupported storage truthfully", () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); }
  };
  const project = components.createDefaultProject();
  assert.equal(components.saveProject(storage, project).ok, true);
  assert.deepEqual([...values.keys()], [components.STORAGE_KEY]);
  assert.equal(components.loadProject(storage).project.format, components.FORMAT);
  assert.deepEqual(components.saveProject(null, project), { ok: false, reason: "unsupported" });
  assert.equal(components.loadProject(null).reason, "unsupported");
  assert.equal(components.getCapabilities(null).localPersistence, false);
});

test("Workspace source includes real propagation UI, semantic access and honest browser fallbacks", () => {
  for (const token of [
    "data-hgc-variant-path", "data-hgc-override-path", "data-hgc-action=\"reset-overrides\"", "data-hgc-action=\"detach\"",
    "data-hgc-axis=", "data-hgc-nested-select", "data-hgc-master-preview", "data-hgc-instances", "FileReader",
    "localStorage", "STORAGE_KEY", "aria-live=\"polite\"", "focus-visible", "@media(max-width:640px)",
    "prefers-reduced-motion:reduce", "ArrowDown", "Ctrl"
  ]) assert.ok(source.includes(token), `missing ${token}`);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(source, /<script[^>]+src=|https?:\/\/|api[_-]?key|secret/i);
});
