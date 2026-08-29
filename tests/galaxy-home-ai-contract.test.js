const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "galaxy-home-ai.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "galaxy-home-ai.css"), "utf8");
const galaxyAssetReadme = fs.readFileSync(path.join(root, "assets", "galaxy", "README.md"), "utf8");
const api = require("../galaxy-home-ai.js");

function memoryStorage(seed = {}) {
  const records = new Map(Object.entries(seed).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]));
  return {
    getItem(key) { return records.has(key) ? records.get(key) : null; },
    setItem(key, value) { records.set(key, String(value)); },
    removeItem(key) { records.delete(key); },
    read(key) { return records.get(key); }
  };
}

test("exposes the HHGalaxyHomeAI mount contract", () => {
  assert.equal(global.HHGalaxyHomeAI, api);
  assert.equal(api.VERSION, "1.0.0");
  for (const method of ["mount", "unmount", "getState", "canHandle", "normalizeRoute", "collectLocalData", "mergeData", "viewMarkup"]) {
    assert.equal(typeof api[method], "function", `${method} should be exported`);
  }
  assert.deepEqual(api.getState(), {
    mounted: false,
    route: null,
    view: null,
    capability: "idle",
    dataState: "idle",
    baseMounted: false,
    paused: false,
    online: null,
    error: null
  });
});

test("handles only the four owned Home and AI route families", () => {
  for (const route of ["/home", "#/home", "/home/dashboard?tab=tasks", "/create/ai-center", "/chat-ai", "/chat-ai/new"]) {
    assert.equal(api.canHandle(route), true, route);
  }
  for (const route of ["/music-ai", "/create/prompt-studio", "/home/legacy", "/communication/community"]) {
    assert.equal(api.canHandle(route), false, route);
  }
  assert.equal(api.normalizeRoute("#chat-ai/new?fresh=1"), "/chat-ai/new");
});

test("Galaxy Map planets point to real internal route families", () => {
  assert.equal(api.PLANETS.length, 9);
  const routes = api.PLANETS.map((planet) => planet.route);
  for (const route of routes) {
    assert.match(route, /^\/[a-z0-9/-]+$/i);
    assert.doesNotMatch(route, /^https?:/);
  }
  assert.deepEqual(new Set(routes).size, routes.length);
  for (const required of ["/create/ai-center", "/music-ai", "/davinci-resolve", "/create", "/play", "/dev-tools", "/learn", "/communication/community", "/work"]) {
    assert.ok(routes.includes(required), `${required} should be reachable from the map`);
  }
});

test("Home reference surface keeps its live geometry and controls in the DOM", () => {
  const markup = api.viewMarkup("/home", api.collectLocalData(memoryStorage(), {}));
  assert.equal((markup.match(/data-gha-planet=/g) || []).length, api.PLANETS.length);
  assert.equal((markup.match(/data-gha-nav-item=/g) || []).length, api.HOME_NAV_ITEMS.length);
  assert.match(markup, /class="gha-system"/);
  assert.match(markup, /class="[^"]*\bgha-home-topbar\b[^"]*"/);
  assert.match(markup, /class="[^"]*\bgha-home-dock\b[^"]*"/);
  assert.match(markup, /data-gha-action="zoom-in"/);
  assert.match(markup, /data-gha-action="zoom-out"/);
  assert.match(markup, /data-gha-action="fullscreen"/);
  assert.match(markup, /data-gha-ai-form/);
  assert.match(markup, /--x:44\.51%;--y:39\.4%;--size:148px/);
  for (const planet of api.PLANETS) {
    assert.match(markup, new RegExp(`data-gha-planet="${planet.id}"`));
    assert.match(markup, new RegExp(`--x:${planet.x}%;--y:${planet.y}%;--size:${planet.size}px`));
  }
});

test("local snapshot reports only evidence-backed values", () => {
  const storage = memoryStorage({
    "hh-auth-user": { name: "Nguyễn Hoàng", email: "hello@example.test" },
    "hh.creative-os.v1": { projects: [{ id: "p1", name: "Galaxy", progress: 42 }] },
    "hh.command-center.todos.v2": [
      { id: "t1", title: "Kiểm thử route", completed: true, category: "QA" },
      { id: "t2", text: "Kiểm tra focus", done: false }
    ],
    "hh.dashboard.sticky-notes.v1": [{ id: "n1", text: "Ghi chú thật", pinned: true }],
    "hh-module-favorites": ["chat-ai", "ai-center"],
    "hh.command-center.activity.v1": [{ action: "Mở AI Center" }],
    "hh.dashboard.weather.v1": {
      location: { name: "Hà Nội" },
      payload: { weather: { current: { temperature_2m: 29, relative_humidity_2m: 71, wind_speed_10m: 8 } } }
    }
  });
  const snapshot = api.collectLocalData(storage, { HH_PLATFORM_MODULES: [{ id: "one" }], navigator: { onLine: true }, HHChatAI: { mount() {} } });
  assert.equal(snapshot.account.name, "Nguyễn Hoàng");
  assert.equal(snapshot.projects.length, 1);
  assert.equal(snapshot.projects[0].progress, 42);
  assert.equal(snapshot.tasks.length, 2);
  assert.equal(snapshot.tasks[0].completed, true);
  assert.equal(snapshot.notes[0].text, "Ghi chú thật");
  assert.equal(snapshot.weather.temperature, 29);
  assert.equal(snapshot.modules.length, 1);
  assert.equal(snapshot.capability.chat, "ready");
  assert.equal(snapshot.evidence.projects, true);
  assert.equal(snapshot.evidence.tasks, true);
});

test("empty local storage remains explicitly empty instead of receiving demo counts", () => {
  const snapshot = api.collectLocalData(memoryStorage(), { navigator: { onLine: false } });
  assert.equal(snapshot.account, null);
  assert.deepEqual(snapshot.projects, []);
  assert.deepEqual(snapshot.tasks, []);
  assert.deepEqual(snapshot.notes, []);
  assert.equal(snapshot.weather, null);
  assert.equal(snapshot.evidence.projects, false);
  assert.equal(snapshot.evidence.tasks, false);
  assert.equal(snapshot.evidence.weather, false);
  assert.equal(snapshot.capability.chat, "configuration-required");
  const markup = api.viewMarkup("/home", snapshot);
  assert.match(markup, /data-state="empty"/);
  assert.match(markup, /Chưa có dữ liệu/);
  assert.doesNotMatch(markup, /12\.5K|99\.9%|Premium|Pro Plan|78\.4 GB|2\.4TB/);
});

test("passed API data is opt-in and tagged with its source", () => {
  const local = api.collectLocalData(memoryStorage(), {});
  const merged = api.mergeData(local, {
    source: "project-api",
    projects: [{ id: "api-p", name: "API project", progress: 67 }],
    capability: { aiProvider: "ready" },
    evidence: { projects: true }
  });
  assert.equal(merged.source, "project-api");
  assert.equal(merged.projects.length, 1);
  assert.equal(merged.capability.aiProvider, "ready");
  assert.equal(merged.evidence.projects, true);
});

test("AI Universe is navigation, while Chat is an adapter for the supplied engine", () => {
  const local = api.collectLocalData(memoryStorage(), {});
  const ai = api.viewMarkup("/create/ai-center", local);
  const chat = api.viewMarkup("/chat-ai", local);
  for (const destination of api.AI_DESTINATIONS) assert.match(ai, new RegExp(`data-gha-route="${destination.route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  assert.match(chat, /data-gha-chat-engine/);
  assert.match(chat, /Adapter Galaxy không tạo cuộc trò chuyện giả/);
  assert.match(source, /await baseMount\(engineHost/);
  assert.match(source, /runtime\.baseController\?\.unmount\?\.\(\)/);
  assert.doesNotMatch(chat, /data-chat-ai-form|data-chat-ai-input|assistant-message/);
});

test("dashboard uses real browser capabilities and versioned local-first stores", () => {
  assert.equal(api.HOME_PREF_KEY, "hh.galaxy.home.preferences.v1");
  assert.equal(api.FOCUS_KEY, "hh.galaxy.dashboard.focus.v1");
  assert.equal(api.TASK_KEY, "hh.command-center.todos.v2");
  assert.equal(api.NOTE_KEY, "hh.dashboard.sticky-notes.v1");
  assert.match(source, /navigator\.storage\.estimate\(\)/);
  assert.match(source, /Không thay thế dung lượng ổ đĩa hệ điều hành/);
  assert.doesNotMatch(source, /CPU\s*(?:usage|load|percent|%)|RAM\s*(?:usage|load|percent|%)|Disk\s*(?:usage|load|percent|%)/i);
});

test("visual layer is code-native, responsive and motion-safe", () => {
  assert.match(styles, /\.gha-map/);
  assert.match(styles, /\.gha-ai-world/);
  assert.match(styles, /\.gha-widget-grid/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /@media \(max-width: 680px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /url\(["']?assets\/galaxy\/hh-galaxy-map-bg-v1\.png(?:\?v=1)?["']?\)/i);
  assert.match(styles, /url\(["']?assets\/galaxy\/hh-luminous-planet-v1\.webp(?:\?v=1)?["']?\)/i);
  assert.match(styles, /url\(["']?assets\/galaxy\/hh-stellar-core-v1\.webp(?:\?v=1)?["']?\)/i);
  const rasterUrls = [...styles.matchAll(/url\(\s*["']?([^"')]+\.(?:png|jpe?g)(?:\?[^"')]+)?)/gi)].map((match) => match[1]);
  assert.deepEqual(rasterUrls.filter((url) => !/^assets\/galaxy\/hh-galaxy-map-bg-v1\.png(?:\?v=1)?$/i.test(url)), []);
  assert.doesNotMatch(styles, /ChatGPT Image|screenshot/i);
  assert.match(galaxyAssetReadme, /OpenAI ImageGen/);
  assert.match(galaxyAssetReadme, /7BE8CF59220BC280B1B5C11A425BE507BAEB00E34A003FFD2E6DF575C35FB5F8/);
  assert.match(galaxyAssetReadme, /DC8370BA9C8F0E8C56E6B699145BE072986E8C7519687B8E74F290B8AD40924F/);
  assert.match(galaxyAssetReadme, /30565B439C6F2841E2EC7B6967C7930B1B9869CDD2B4A8F86AAC22EDF264F6BE/);
});

test("lifecycle uses abortable listeners and clears timers", () => {
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /runtime\.controller\.abort\(\)/);
  assert.match(source, /clearInterval\?\.\(runtime\.clockTimer\)/);
  assert.match(source, /clearInterval\?\.\(runtime\.focusTimer\)/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /data-gha-paused/);
});

test("mount and unmount keep a stable public runtime snapshot", () => {
  const attributes = new Map();
  const host = {
    dataset: {},
    innerHTML: "",
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    setAttribute(key, value) { attributes.set(key, String(value)); },
    removeAttribute(key) { attributes.delete(key); }
  };
  assert.equal(api.mount(host, { route: "/home", storage: memoryStorage() }), true);
  assert.equal(api.getState().mounted, true);
  assert.equal(api.getState().view, "home");
  assert.equal(host.dataset.ghaRoute, "/home");
  assert.equal(api.unmount(host), true);
  assert.equal(api.getState().mounted, false);
});

test("chat adapter mounts and cleans the explicitly supplied Chat AI engine", async () => {
  const engine = { hidden: false };
  const engineState = { dataset: {}, textContent: "" };
  const missing = { hidden: true };
  let baseUnmounted = 0;
  const host = {
    dataset: {},
    innerHTML: "",
    querySelector(selector) {
      if (selector === "[data-gha-chat-engine]") return engine;
      if (selector === "[data-gha-engine-state]") return engineState;
      if (selector === "[data-gha-chat-missing]") return missing;
      return null;
    },
    querySelectorAll() { return []; },
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {}
  };
  assert.equal(api.mount(host, {
    route: "/chat-ai",
    storage: memoryStorage(),
    baseMount(engineHost, options) {
      assert.equal(engineHost, engine);
      assert.equal(options.route, "/chat-ai");
      return { unmount() { baseUnmounted += 1; } };
    }
  }), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(api.getState().baseMounted, true);
  assert.equal(engineState.dataset.state, "ready");
  assert.equal(api.unmount(host), true);
  assert.equal(baseUnmounted, 1);
});

test("embedded Galaxy Shell integration suppresses duplicate chrome and heavy duplicate effects", () => {
  assert.match(styles, /\[data-galaxy-shell\][\s\S]*?\[data-galaxy-outlet\][\s\S]*?\.gha-topbar/);
  assert.match(styles, /:is\(\.gha-topbar, \.gha-sidebar, \.gha-chat__bar\)\s*\{\s*display:\s*none/);
  assert.match(styles, /\.gha-map__stars, \.gha-map__nebula, \.gha-ai-world__nebula, \.gha-chat__aurora\)[\s\S]*?animation:\s*none/);
});
