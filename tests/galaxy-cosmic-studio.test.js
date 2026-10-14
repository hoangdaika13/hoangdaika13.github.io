const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function studioHarness({ route = "/home", embedded = true, preferences = {} } = {}) {
  const records = new Map(), sessions = new Map(), timers = new Map(), writes = [], viewEvents = [];
  const storage = { getItem: key => records.get(key) || null, setItem(key, value) { records.set(key, String(value)); writes.push(key); } };
  const key = "hh.galaxy.cosmic-studio.v1";
  records.set(key, JSON.stringify(preferences));
  const dataName = name => name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  const matches = (node, selector) => selector.split(",").some(part => {
    const parsed = part.trim().match(/^(\w+)?\[([\w-]+)(?:="([^"]*)")?\]$/);
    return parsed && (!parsed[1] || node.tagName === parsed[1].toUpperCase()) && node.hasAttribute(parsed[2]) && (parsed[3] === undefined || node.getAttribute(parsed[2]) === parsed[3]);
  });
  const element = (tag = "div", dataset = {}) => ({
    tagName: tag.toUpperCase(), dataset: { ...dataset }, attributes: new Map(), children: [], listeners: new Map(),
    setAttribute(name, value) { if (name.startsWith("data-")) this.dataset[dataName(name)] = String(value); else this.attributes.set(name, String(value)); },
    getAttribute(name) { return name.startsWith("data-") ? this.dataset[dataName(name)] : this.attributes.get(name); },
    hasAttribute(name) { return name.startsWith("data-") ? Object.hasOwn(this.dataset, dataName(name)) : this.attributes.has(name); },
    removeAttribute(name) { if (name.startsWith("data-")) delete this.dataset[dataName(name)]; else this.attributes.delete(name); },
    closest(selector) { for (let node = this; node; node = node.parentNode) if (matches(node, selector)) return node; return null; },
    contains(target) { for (let node = target; node; node = node.parentNode) if (node === this) return true; return false; },
    append(child) { child.parentNode = this; this.children.push(child); },
    prepend(child) { child.parentNode = this; this.children.unshift(child); },
    querySelectorAll(selector) { return this.children.flatMap(child => [...(matches(child, selector) ? [child] : []), ...child.querySelectorAll(selector)]); },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    addEventListener(type, handler) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(handler); },
    removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); },
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
  });
  const app = element(), owner = element("main"), page = element(), universe = element();
  app.append(owner); owner.append(page); page.append(universe);
  const ownerQuery = owner.querySelector.bind(owner);
  owner.querySelector = selector => selector === "[data-hh-galaxy-home-host]:has([data-glu])" ? embedded && route === "/home" ? universe : null : selector === ".hgl1-page--home" ? page : ownerQuery(selector);
  app.querySelector = selector => selector === ".hgl1-main" ? owner : null;
  let fields = [];
  const appQueryAll = app.querySelectorAll.bind(app);
  app.querySelectorAll = selector => selector === ".hgl1-main textarea, .hgl1-main input" ? fields : appQueryAll(selector);
  universe.dispatchEvent = event => { viewEvents.push(event.detail.view); };
  let toolbar;
  app.ownerDocument = { createElement(tag) {
    const node = element(tag);
    if (!toolbar) {
      toolbar = node;
      node.append(element("output", { gcsStatus: "" }));
      node.append(element("button", { hgl1Action: "open-command" }));
      if (route === "/home") for (const view of ["map", "list"]) node.append(element("button", { gcsView: view }));
      else node.append(element("button", { gcsFavorite: "" }));
    }
    return node;
  } };
  let timerId = 0;
  const scope = { sessionStorage: { getItem: key => sessions.get(key) || null, setItem: (key, value) => sessions.set(key, String(value)) }, setTimeout(callback) { timers.set(++timerId, callback); return timerId; }, clearTimeout(id) { timers.delete(id); }, addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, Event, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } } };
  vm.runInNewContext(read("galaxy-cosmic-studio.js"), scope);
  const controller = scope.HHGalaxyCosmicStudio.mount(app, { route, storage });
  return { app, owner, page, universe, toolbar, controller, writes, viewEvents, element, storage, sessions, timers, setFields(next) { fields = next; }, read: () => JSON.parse(storage.getItem(key)), update: prefs => storage.setItem(key, JSON.stringify(prefs)), click(target) { for (const handler of app.listeners.get("click") || []) handler({ target }); }, input(target) { for (const handler of app.listeners.get("input") || []) handler({ target }); } };
}

test("render captures the old route's pending input before replacement and late destroy cannot overwrite it", () => {
  const h = studioHarness({ route: "/galaxy/ai" });
  const prompt = { tagName: "TEXTAREA", name: "prompt", value: "Unsaved input before immediate navigation", attributes: [], closest() { return null; }, getAttribute() { return null; } };
  h.setFields([prompt]); h.input(prompt);
  assert.equal(h.timers.size, 1, "the input is still waiting for its debounce");
  const key = "hh.galaxy.cosmic-studio.v1:draft:device:/galaxy/ai";
  const source = read("galaxy-layer-one.js"), start = source.indexOf("  function render() {");
  const render = source.slice(start, source.indexOf("  function mountWorkbench()", start));
  let snapshotAtReplacement;
  const context = {
    runtime: { app: h.app, route: "/galaxy/music", options: {}, storage: h.storage, cosmicStudio: h.controller }, globalScope: {},
    cleanupWorkspaceScene() {}, inspectLocalState: () => ({ status: "ready", data: { settings: {} } }), syncAnalyticsCollectorConsent() {}, viewMarkup: () => "new route markup",
    renderPreservingChrome() {
      snapshotAtReplacement = h.sessions.get(key);
      h.setFields([{ tagName: "INPUT", name: "track-search", value: "music field", attributes: [], closest() { return null; }, getAttribute() { return null; } }]);
      return true;
    }, applyPreferences() {}, updateDrawerMode() {}, mountRouteDelegate() {}, mountRouteRuntime() {}, mountWorkbench() {}, mountWorkspaceScene() {}
  };
  vm.runInNewContext(render + "\nrender();", context);
  assert.ok(snapshotAtReplacement, "the pending draft must be saved before the old fields are replaced");
  assert.deepEqual(JSON.parse(snapshotAtReplacement), { version: 1, values: { "TEXTAREA:prompt:0": prompt.value } });
  assert.equal(h.sessions.get(key), snapshotAtReplacement, "destroy after replacement must not recapture the new route into the old key");
  assert.equal(h.timers.size, 0);
});

test("ordinary embedded atlas clicks cannot dispatch view changes or overwrite its newly saved favorites", () => {
  const h = studioHarness();
  h.update({ version: 1, view: "map", favorites: ["/galaxy/music"], recent: ["/home", "/galaxy/ai"] });
  const saved = h.read(), writes = h.writes.length, events = h.viewEvents.length;
  const star = h.element("button", { gluStar: "/galaxy/music" }); h.universe.append(star);
  h.click(star);
  const foreignView = h.element("button", { gcsView: "list" }); h.universe.append(foreignView); h.click(foreignView);
  assert.equal(h.writes.length, writes);
  assert.equal(h.viewEvents.length, events);
  assert.deepEqual(h.read(), saved);
  assert.equal(h.app.dataset.gcsView, "map");
  h.controller.destroy();
});

test("toolbar view buttons preserve newer atlas favorites and recent destinations", () => {
  const h = studioHarness();
  h.update({ version: 1, view: "map", favorites: ["/galaxy/music"], recent: ["/galaxy/learning", "/home"] });
  const list = h.toolbar.querySelector('[data-gcs-view="list"]'), label = h.element("span"); list.append(label);
  h.click(label);
  assert.deepEqual(h.read(), { version: 1, view: "list", favorites: ["/galaxy/music"], recent: ["/galaxy/learning", "/home"] });
  assert.equal(h.app.dataset.gcsView, "list");
  assert.equal(h.viewEvents.at(-1), "list");
  assert.equal(list.getAttribute("aria-pressed"), "true");
  h.controller.destroy();
});

test("workspace favorite toggles read the latest shared preferences before adding or removing a route", () => {
  const h = studioHarness({ route: "/galaxy/ai" });
  const button = h.toolbar.querySelector("[data-gcs-favorite]");
  h.update({ version: 1, view: "list", favorites: ["/galaxy/music"], recent: ["/galaxy/learning"] });
  h.click(button);
  assert.deepEqual(h.read(), { version: 1, view: "list", favorites: ["/galaxy/music", "/galaxy/ai"], recent: ["/galaxy/learning"] });
  h.update({ version: 1, view: "map", favorites: ["/galaxy/ai", "/galaxy/tools"], recent: ["/galaxy/dev"] });
  h.click(button);
  assert.deepEqual(h.read(), { version: 1, view: "map", favorites: ["/galaxy/tools"], recent: ["/galaxy/dev"] });
  assert.equal(button.getAttribute("aria-pressed"), "false");
  h.controller.destroy();
});

test("legacy home still switches the local directory and preserves favorites across visit and star actions", () => {
  const h = studioHarness({ embedded: false, preferences: { version: 1, view: "map", favorites: ["/galaxy/music"], recent: ["/galaxy/ai", "/home"] } });
  assert.deepEqual(h.read().recent, ["/home", "/galaxy/ai"]);
  const directory = h.owner.children.find(child => child.hasAttribute("data-gcs-directory"));
  h.click(h.toolbar.querySelector('[data-gcs-view="list"]'));
  assert.equal(directory.hidden, false); assert.equal(h.page.hidden, true); assert.equal(h.page.inert, true);
  h.update({ version: 1, view: "list", favorites: ["/galaxy/tools"], recent: ["/home"] });
  const star = h.element("button", { gcsStar: "/galaxy/music" }); directory.append(star); h.click(star);
  assert.deepEqual(h.read().favorites, ["/galaxy/tools", "/galaxy/music"]);
  h.click(h.toolbar.querySelector('[data-gcs-view="map"]'));
  assert.equal(directory.hidden, true); assert.equal(h.page.hidden, false); assert.equal(h.page.inert, false);
  h.controller.destroy();
});

test("Cosmic Studio is registered as a lazy Galaxy module", () => {
  const loader = read("performance-loader.js");
  assert.match(loader, /galaxy-cosmic-studio\.css\?v=1/);
  assert.match(loader, /galaxy-cosmic-studio\.js\?v=5/);
  assert.match(loader, /galaxy-living-universe\.js\?v=9/);
  assert.match(loader, /galaxy-living-universe\.css\?v=4/);
  assert.match(loader, /galaxy-home-ai\.css\?v=25/);
});

test("Cosmic Studio exposes every Layer One workspace and local-first controls", () => {
  const source = read("galaxy-cosmic-studio.js");
  for (const route of ["ai", "music", "video", "creator", "games", "dev", "learning", "community", "tools", "analytics", "settings"]) {
    assert.match(source, new RegExp(`/galaxy/${route}`));
  }
  assert.match(source, /data-gcs-view/);
  assert.match(source, /data-gcs-directory/);
  assert.match(source, /data-hgl1-action=\"open-command\"/);
  assert.match(source, /sessionStorage/);
  assert.match(source, /accountStorage/);
  assert.match(source, /sensitive/);
});

test("Galaxy keeps Platform chrome and lifecycle cleanup deterministic", () => {
  const homeCss = read("galaxy-home-ai.css");
  const layer = read("galaxy-layer-one.js");
  const cosmicCss = read("galaxy-cosmic-studio.css");
  assert.match(homeCss, /#appShell\[data-hh-layer="platform"\]\[data-galaxy-shell\] > \.app-header/);
  assert.match(homeCss, /#appShell\[data-hh-layer="platform"\]\[data-galaxy-shell\] > \.app-shell__body/);
  assert.match(layer, /accountStorage\?\./);
  assert.match(layer, /action === \"open-command\"/);
  assert.match(layer, /active\.cosmicStudio\?\.destroy/);
  assert.match(cosmicCss, /prefers-reduced-motion/);
  assert.match(cosmicCss, /overflow-y:auto/);
  assert.match(read("galaxy-stable-chrome.css"), /\[data-galaxy-shell\]\[data-hh-layer="platform"\][^\n]+\.gcs-heading h1 \{ text-shadow:none; animation:none; \}/);
});

test("new assets are available to the offline catalog", () => {
  const worker = read("sw.js");
  assert.match(worker, /galaxy-cosmic-studio\.css\?v=1/);
  assert.match(worker, /galaxy-cosmic-studio\.js\?v=5/);
  assert.match(worker, /galaxy-living-universe\.js\?v=9/);
  assert.match(worker, /galaxy-living-universe\.css\?v=4/);
  assert.match(worker, /galaxy-universe-renderer\.mjs\?v=9/);
  assert.match(worker, /galaxy-home-ai\.css\?v=25/);
  const html = read("index.html").replace(/<!--[\s\S]*?-->/g, "");
  const loader = html.match(/<script\b[^>]*src="(performance-loader\.js\?v=\d+)"/);
  assert.ok(loader, "the executable document must name the current loader");
  assert.ok(worker.includes(`"./${loader[1]}"`), "the current loader must be present in the offline catalog");
});
