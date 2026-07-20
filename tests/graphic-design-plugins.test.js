const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const file = path.join(root, "graphic-design-plugins.js");
const source = fs.readFileSync(file, "utf8");
const plugins = require(file);

function createPackage() {
  return {
    format: plugins.FORMAT,
    version: plugins.VERSION,
    manifest: {
      id: "local.test.toolkit",
      name: "Local Test Toolkit",
      version: "2.1.0",
      type: "extension",
      description: "Declarative local test package",
      author: "Test",
      permissions: ["canvas", "layer", "selection", "export", "command"],
      preview: { title: "Toolkit preview", body: "Local commands only", accent: "#27D3C2" },
      contributes: {
        commands: [
          { id: "toolkit.background", title: "Set background", operation: "canvas.set-background", args: { color: "#123456" } },
          { id: "toolkit.layer", title: "Add layer", operation: "layer.add", args: { layer: { id: "test-layer", name: "Test layer", type: "text" } } },
          { id: "toolkit.select", title: "Set selection", operation: "selection.set", args: { ids: ["test-layer"] } },
          { id: "toolkit.export", title: "Export snapshot", operation: "export.snapshot", args: { label: "Test snapshot" } },
          { id: "toolkit.notify", title: "Notify", operation: "command.notify", args: { message: "Done" } }
        ],
        presets: [{ id: "toolkit.preset", name: "Square", settings: { width: 1080, height: 1080 } }],
        brushes: [{ id: "toolkit.brush", name: "Marker", settings: { size: 12 } }],
        templates: [{ id: "toolkit.template", name: "Cover", settings: { width: 1600, height: 900 } }],
        effects: [{ id: "toolkit.effect", name: "Glow", settings: { radius: 16 } }],
        characters: [{ id: "toolkit.character", name: "Guide", settings: { pose: "idle" } }]
      }
    }
  };
}

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    dump(key) { return values.get(key); }
  };
}

test("Plugin SDK exposes UMD/global lifecycle and a versioned local contract", () => {
  assert.equal(plugins.VERSION, 1);
  assert.equal(plugins.FORMAT, "hh-graphic-plugin-package");
  assert.equal(plugins.STORAGE_KEY, "hh.graphic-plugins.registry.v1");
  assert.deepEqual(plugins.PERMISSIONS, ["canvas", "layer", "selection", "export", "command"]);
  assert.deepEqual(plugins.PACK_TYPES, ["preset", "brush", "template", "effect", "character"]);
  assert.equal(typeof plugins.mount, "function");
  assert.equal(typeof plugins.unmount, "function");
  assert.equal(globalThis.HHGraphicPlugins, plugins);
  assert.match(source, /globalScope\.HHGraphicPlugins = api/);
  assert.match(source, /module\.exports = api/);
});

test("Manifest validation normalizes declarative contributions and rejects executable fields", () => {
  const valid = plugins.validateManifest(createPackage().manifest);
  assert.equal(valid.valid, true);
  assert.equal(valid.manifest.contributes.commands.length, 5);
  assert.equal(valid.manifest.contributes.effects[0].name, "Glow");

  const unsafe = createPackage().manifest;
  unsafe.entry = "plugin.js";
  unsafe.permissions.push("network");
  unsafe.contributes.commands[0].handler = "globalThis.compromised = true";
  unsafe.contributes.commands[1].operation = "system.shell";
  unsafe.contributes.effects[0].script = "globalThis.compromised = true";
  const rejected = plugins.validateManifest(unsafe);
  assert.equal(rejected.valid, false);
  assert.ok(rejected.errors.some((error) => error.includes("manifest.entry")));
  assert.ok(rejected.errors.some((error) => error.includes("Unknown permission 'network'")));
  assert.ok(rejected.errors.some((error) => error.includes("handler")));
  assert.ok(rejected.errors.some((error) => error.includes("effects[0].script")));
  assert.ok(rejected.errors.some((error) => error.includes("allowlist")));
});

test("Local JSON packages enforce format, schema and permission requirements", () => {
  const parsed = plugins.parseLocalPackage(JSON.stringify(createPackage()));
  assert.equal(parsed.manifest.id, "local.test.toolkit");
  assert.equal(parsed.manifest.type, "extension");

  const wrongFormat = createPackage();
  wrongFormat.format = "third-party-script";
  assert.throws(() => plugins.parseLocalPackage(wrongFormat), plugins.PluginPackageError);

  const missingCapability = createPackage();
  missingCapability.manifest.permissions = ["command"];
  const result = plugins.validatePackage(missingCapability);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("requires the 'canvas' permission")));

  const pack = createPackage();
  pack.manifest.type = "preset-pack";
  assert.equal(plugins.validatePackage(pack).valid, true);
  pack.manifest.contributes.presets = [];
  assert.ok(plugins.validatePackage(pack).errors.some((error) => error.includes("at least one presets")));

  const registry = plugins.createRegistry({ storage: null });
  assert.throws(() => registry.install(wrongFormat), plugins.PluginPackageError);
  assert.equal(registry.getAuditLog()[0].status, "denied");
  assert.equal(registry.getAuditLog()[0].action, "install");
});

test("Registry installs every pack type and persists enable/disable lifecycle locally", () => {
  const storage = createStorage();
  const registry = plugins.createRegistry({ storage });
  assert.equal(registry.backend, "localStorage");
  const installed = registry.install(JSON.stringify(createPackage()));
  assert.equal(installed.enabled, true);
  assert.equal(registry.list().length, 1);
  for (const type of plugins.PACK_TYPES) {
    const contributions = registry.listContributions(type);
    assert.equal(contributions.length, 1, type);
    assert.equal(contributions[0].pluginId, "local.test.toolkit");
  }
  registry.disable(installed.manifest.id);
  assert.equal(registry.get(installed.manifest.id).enabled, false);
  assert.equal(registry.listContributions("effect").length, 0);
  assert.equal(registry.listContributions("effect", { includeDisabled: true }).length, 1);
  registry.enable(installed.manifest.id);

  const persisted = JSON.parse(storage.dump(plugins.STORAGE_KEY));
  assert.equal(persisted.format, plugins.REGISTRY_FORMAT);
  assert.equal(persisted.version, 1);
  const restored = plugins.createRegistry({ storage });
  assert.equal(restored.get(installed.manifest.id).manifest.version, "2.1.0");
  assert.ok(restored.getAuditLog().some((entry) => entry.action === "disable"));
  assert.equal(restored.uninstall(installed.manifest.id), true);
  assert.equal(restored.list().length, 0);
  assert.ok(restored.getAuditLog().some((entry) => entry.action === "uninstall"));
});

test("Allowlisted commands execute through canvas, layer, selection, export and command capabilities", () => {
  const host = plugins.createMemoryHost();
  const registry = plugins.createRegistry({ storage: null, host });
  registry.install(createPackage());
  assert.equal(registry.executeCommand("toolkit.background").background, "#123456");
  assert.equal(registry.executeCommand("toolkit.layer").id, "test-layer");
  assert.deepEqual(registry.executeCommand("toolkit.select"), ["test-layer"]);
  assert.equal(registry.executeCommand("toolkit.export").label, "Test snapshot");
  assert.equal(registry.executeCommand("toolkit.notify"), "Done");
  const state = host.getState();
  assert.equal(state.layers[0].name, "Test layer");
  assert.equal(state.exports.length, 1);
  assert.deepEqual(state.notifications, ["Done"]);
  assert.equal(registry.getAuditLog({ action: "command" }).length, 5);
});

test("Capability API denies undeclared access and disabled extensions cannot run commands", () => {
  const host = plugins.createMemoryHost();
  const capabilities = plugins.createCapabilityApi(["canvas"], host);
  assert.equal(capabilities.canvas.allowed, true);
  assert.equal(capabilities.layer.allowed, false);
  capabilities.canvas.resize(800, 600);
  assert.deepEqual(host.getState().canvas, { width: 800, height: 600, background: "#111827" });
  assert.throws(() => capabilities.layer.add({ name: "Denied" }), plugins.PluginPermissionError);
  assert.throws(
    () => plugins.executeDeclarativeCommand({ id: "x.y", title: "Denied", operation: "layer.add", args: {} }, ["command"], host),
    (error) => error instanceof plugins.PluginPermissionError && error.permission === "layer"
  );

  const registry = plugins.createRegistry({ storage: null, host });
  registry.install(createPackage());
  registry.disable("local.test.toolkit");
  assert.throws(() => registry.executeCommand("toolkit.layer"), /disabled/);
  assert.equal(registry.getAuditLog()[0].status, "denied");
});

test("Sandbox preview escapes package text and only emits fixed postMessage requests", () => {
  const packageValue = createPackage();
  packageValue.manifest.preview.title = '<img src=x onerror="globalThis.compromised=true">';
  packageValue.manifest.preview.body = "</header><script>globalThis.compromised=true</script>";
  const documentText = plugins.createPreviewDocument(packageValue.manifest);
  assert.match(documentText, /Content-Security-Policy/);
  assert.match(documentText, /default-src 'none'/);
  assert.match(documentText, /parent\.postMessage/);
  assert.match(documentText, new RegExp(plugins.PREVIEW_CHANNEL.replace(/\./g, "\\.")));
  assert.match(documentText, /&lt;img src=x onerror=&quot;globalThis\.compromised=true&quot;&gt;/);
  assert.doesNotMatch(documentText, /<img src=x onerror=/);
  assert.doesNotMatch(documentText, /<script>globalThis\.compromised/);
  assert.doesNotMatch(documentText, /https?:\/\//);
});

test("postMessage allowlist binds origin, frame, channel, plugin and command", () => {
  const frameWindow = {};
  const iframe = { contentWindow: frameWindow };
  const event = {
    source: frameWindow,
    origin: "null",
    data: {
      channel: plugins.PREVIEW_CHANNEL,
      type: "command.request",
      pluginId: "local.test.toolkit",
      commandId: "toolkit.background"
    }
  };
  assert.equal(plugins.isAllowedPreviewMessage(event, iframe, "local.test.toolkit", ["toolkit.background"]), true);
  assert.equal(plugins.isAllowedPreviewMessage({ ...event, origin: "https://remote.invalid" }, iframe, "local.test.toolkit", ["toolkit.background"]), false);
  assert.equal(plugins.isAllowedPreviewMessage({ ...event, source: {} }, iframe, "local.test.toolkit", ["toolkit.background"]), false);
  assert.equal(plugins.isAllowedPreviewMessage({ ...event, data: { ...event.data, channel: "other" } }, iframe, "local.test.toolkit", ["toolkit.background"]), false);
  assert.equal(plugins.isAllowedPreviewMessage({ ...event, data: { ...event.data, pluginId: "other" } }, iframe, "local.test.toolkit", ["toolkit.background"]), false);
  assert.equal(plugins.isAllowedPreviewMessage({ ...event, data: { ...event.data, commandId: "unknown" } }, iframe, "local.test.toolkit", ["toolkit.background"]), false);
});

test("Capability detection reports unsupported browser features truthfully", () => {
  const unsupported = plugins.detectCapabilities({});
  assert.equal(unsupported.localStorage, false);
  assert.equal(unsupported.fileReader, false);
  assert.equal(unsupported.preview, false);
  assert.ok(unsupported.unsupported.includes("iframeSandbox"));

  const storage = createStorage();
  function FileReader() {}
  const supported = plugins.detectCapabilities({
    localStorage: storage,
    FileReader,
    postMessage() {},
    document: { createElement() { return { sandbox: {}, srcdoc: "" }; } }
  });
  assert.equal(supported.localStorage, true);
  assert.equal(supported.fileReader, true);
  assert.equal(supported.preview, true);
});

test("Mounted UI contract is local-only, responsive, keyboard-visible and motion-safe", () => {
  for (const token of [
    "data-hgp-install", "data-hgp-file", "FileReader", "readAsText", "data-hgp-enabled", "data-hgp-uninstall",
    "data-hgp-command", "data-hgp-run", "data-hgp-audit", 'sandbox="allow-scripts"', 'referrerpolicy="no-referrer"',
    'role="status"', 'aria-live="polite"', "focus-visible", "event.key !== \"Escape\"",
    "@media(max-width:420px)", "@media(prefers-reduced-motion:reduce)", "localStorage unsupported"
  ]) assert.ok(source.includes(token), `missing ${token}`);
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /new\s+Function\b/);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(source, /https?:\/\/[^"'\s]+\.js/);
});
