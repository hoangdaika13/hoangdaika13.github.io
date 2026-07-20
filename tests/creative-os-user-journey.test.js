const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

const ROUTES = Object.freeze([
  "overview", "project", "brief", "moodboard", "storyboard", "world-bible",
  "workflow", "ai-director", "prompt-studio", "repurpose", "brand",
  "audio-dubbing", "prototype", "review", "collaboration", "publishing",
  "analytics", "rights", "providers", "marketplace"
]);

const ENGINES = Object.freeze([
  ["creative-command-center.js", "creative-command-center.css", "HHCreativeCommandCenter"],
  ["creative-preproduction.js", "creative-preproduction.css", "HHCreativePreproduction"],
  ["creative-ai-workflow.js", "creative-ai-workflow.css", "HHCreativeAIWorkflow"],
  ["creative-production-lab.js", "creative-production-lab.css", "HHCreativeProductionLab"],
  ["creative-collaboration-os.js", "creative-collaboration-os.css", "HHCreativeCollaborationOS"],
  ["creative-publishing.js", "creative-publishing.css", "HHCreativePublishing"],
  ["creative-marketplace.js", "creative-marketplace.css", "HHCreativeMarketplace"]
]);

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }
  };
}

class FakeNode {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.dataset = {};
    this.listeners = new Map();
    this.attributes = new Map();
    this._innerHTML = "";
    this.workspace = null;
  }

  addEventListener(type, handler, options = {}) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
    if (options.signal) {
      const remove = () => this.removeEventListener(type, handler);
      if (options.signal.aborted) remove();
      else options.signal.addEventListener("abort", remove, { once: true });
    }
  }

  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }

  dispatch(type) {
    [...(this.listeners.get(type) || [])].forEach((handler) => handler({ type, target: this }));
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size || 0;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    if (this._innerHTML.includes("data-cos-workspace")) this.workspace = new FakeNode("main");
  }

  get innerHTML() { return this._innerHTML; }
  querySelector(selector) { return selector === "[data-cos-workspace]" ? this.workspace : null; }
  querySelectorAll() { return []; }
  replaceChildren() { this._innerHTML = ""; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
}

function createFakeDocument() {
  const scripts = [];
  const styleSheets = [];
  const head = new FakeNode("head");
  head.append = (node) => {
    if (node.tagName === "SCRIPT") scripts.push(node);
    if (node.tagName === "LINK") styleSheets.push({ href: node.href });
    queueMicrotask(() => node.dispatch("load"));
  };
  return {
    scripts,
    styleSheets,
    head,
    createElement: (tag) => new FakeNode(tag),
    querySelector: () => null,
    dispatchEvent: () => true
  };
}

const settle = () => new Promise((resolve) => setImmediate(() => setImmediate(resolve)));

test("all 20 Creative OS routes are reachable and mapped to lazy workspace engines", () => {
  const shell = read("creative-os.js");
  const router = read("script.js");
  const worker = read("sw.js");
  for (const route of ROUTES) {
    assert.match(shell, new RegExp(`(?:id:\\s*["']${route}["']|["']${route}["']:\\s*\\{)`), `missing shell route: ${route}`);
    assert.match(router, new RegExp(`id:\\s*["']${route}["']`), `missing sidebar route: ${route}`);
  }
  for (const [js, css, api] of ENGINES) {
    assert.ok(exists(js), `missing engine source: ${js}`);
    assert.ok(exists(css), `missing engine styles: ${css}`);
    assert.match(shell, new RegExp(api), `shell does not map ${api}`);
    assert.match(worker, new RegExp(js.replace(".", "\\.")), `${js} is not cached`);
  }
});

test("create, update, snapshot, export, and import preserve one Universal Project id", () => {
  const core = require(path.join(root, "creative-os-core.js"));
  const store = core.createStore({ storage: memoryStorage() });
  const project = store.createProject({ name: "Campaign Alpha", brief: { objective: "Launch" } });

  const workspacePatches = [
    { brief: { audience: "Students" } },
    { storyboard: [{ id: "scene-1", title: "Hook" }] },
    { world: { characters: [{ id: "hero", name: "HH" }] } },
    { workflows: [{ id: "flow-1", name: "Brief to publish" }] },
    { brand: { voice: "Clear and energetic" } },
    { review: { status: "review" } },
    { publishing: [{ id: "pub-1", platform: "youtube", status: "draft" }] }
  ];
  workspacePatches.forEach((patch) => store.updateProject(project.id, patch));
  store.addAsset(project.id, { name: "cover.webp", type: "image/webp", size: 128 });
  store.addRun(project.id, { provider: "local", action: "brief", estimatedCost: 0 });
  store.snapshotProject(project.id, "Review 1", "Before approval");

  const current = store.getState();
  assert.equal(current.activeProjectId, project.id);
  assert.equal(current.projects.length, 1);
  assert.equal(current.projects[0].id, project.id);
  assert.equal(current.projects[0].assets[0].name, "cover.webp");
  assert.equal(current.projects[0].versions.length, 1);

  const payload = store.exportProject(project.id);
  const restoredStore = core.createStore({ storage: memoryStorage() });
  const restored = restoredStore.importProject(payload);
  assert.equal(restored.id, project.id);
  assert.equal(restored.brief.audience, "Students");
  assert.equal(restored.storyboard[0].id, "scene-1");
  assert.equal(restored.publishing[0].id, "pub-1");
});

test("shell passes the active Universal Project id to every mounted workspace", () => {
  const shell = read("creative-os.js");
  assert.match(
    shell,
    /projectId:\s*(?:state\?\.activeProjectId|projectId|store\.getState\(\)\.activeProjectId)/,
    "Creative OS passes store but not active projectId; Collaboration falls back to the detached creative-main project"
  );
});

test("mounting all routes reuses one store and unmount removes root listeners", async () => {
  const core = require(path.join(root, "creative-os-core.js"));
  const store = core.createStore({ storage: memoryStorage() });
  const project = store.createProject({ name: "Shared journey" });
  const document = createFakeDocument();
  const mounts = [];
  const context = {
    console,
    document,
    location: { hash: "" },
    AbortController,
    Blob,
    URL,
    CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
    setTimeout,
    clearTimeout,
    queueMicrotask,
    HHCreativeCore: core,
    __HH_CREATIVE_STORE__: store
  };
  context.window = context;
  for (const [, , apiName] of ENGINES) {
    context[apiName] = {
      mount(_host, options) {
        mounts.push({ view: options.view, projectId: options.store.getState().activeProjectId, store: options.store });
        return { unmount() {} };
      },
      unmount() {}
    };
  }
  vm.runInNewContext(read("creative-os.js"), context, { filename: "creative-os.js" });
  const host = new FakeNode("div");
  for (const route of ROUTES) {
    await context.HHCreativeOS.mount(host, { view: route });
    await settle();
    assert.equal(host.listenerCount("click"), 1, `duplicate click listener after mounting ${route}`);
  }
  assert.deepEqual(mounts.map((item) => item.view), ROUTES);
  assert.ok(mounts.every((item) => item.projectId === project.id), "a route detached from the active project");
  assert.ok(mounts.every((item) => item.store === store), "a route received a different store instance");
  context.HHCreativeOS.unmount();
  assert.equal(host.listenerCount("click"), 0);
});

test("external publishing stays blocked until a configured adapter confirms success", async () => {
  const publishing = require(path.join(root, "creative-publishing.js"));
  const store = publishing.createStore({ storage: null, providerAdapters: {} });
  const item = store.addPublication({
    id: "publish-test",
    title: "Owned media",
    platform: "youtube",
    mediaUrl: "https://example.com/video.mp4",
    thumbnailUrl: "https://example.com/cover.jpg",
    visibility: "private",
    status: "queued"
  });
  const result = await store.processPublication(item.id, { now: Date.now() });
  assert.equal(result.ok, false);
  assert.equal(result.code, "ADAPTER_UNCONFIGURED");
  assert.equal(result.item.status, "blocked");
  assert.equal(result.item.confirmedAt, "");
  assert.ok(!["sent", "published", "confirmed"].includes(result.item.status), "unconfigured publishing claimed success");
});

test("Marketplace requires a permission manifest and sandboxed message allowlist", () => {
  assert.ok(exists("creative-marketplace.js"), "Creative Marketplace implementation is missing");
  assert.ok(exists("creative-marketplace.css"), "Creative Marketplace styles are missing");
  const source = read("creative-marketplace.js");
  const css = read("creative-marketplace.css");
  assert.match(source, /manifest/i, "Marketplace lacks a plugin manifest contract");
  assert.match(source, /permissions?/i, "Marketplace lacks permission review");
  assert.match(source, /sandbox/i, "Marketplace plugins are not sandboxed");
  assert.match(source, /postMessage/i, "Marketplace lacks an isolated message bridge");
  assert.match(source, /allow(?:list|ed)|allowedOrigins?|allowedMessages?/i, "Marketplace message bridge lacks an allowlist");
  assert.match(css, /:focus-visible/);
});

test("all workspaces expose responsive, focus, and reduced-motion contracts", () => {
  for (const [, css] of ENGINES) {
    assert.ok(exists(css), `missing styles: ${css}`);
    const source = read(css);
    assert.match(source, /@media\s*\([^)]*max-width\s*:\s*(?:3[5-9]\d|[4-9]\d\d|1\d{3})px/i, `${css} lacks a mobile breakpoint`);
    assert.match(source, /:focus-visible/, `${css} lacks visible keyboard focus`);
    assert.match(source, /prefers-reduced-motion\s*:\s*reduce/, `${css} lacks reduced-motion handling`);
  }
});

test("Creative OS client sources contain no credentials or dynamic code execution", () => {
  const files = ["creative-os.js", "creative-os-core.js", ...ENGINES.map(([js]) => js)].filter(exists);
  const credential = /(?:AIza[0-9A-Za-z_-]{20,}|AQ\.[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}|mongodb(?:\+srv)?:\/\/|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|client_secret\s*[:=]\s*["'][^"']+)/i;
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, credential, `${file} contains a client credential`);
    assert.doesNotMatch(source, /\beval\s*\(|\bnew\s+Function\s*\(/, `${file} permits dynamic code execution`);
  }
});
