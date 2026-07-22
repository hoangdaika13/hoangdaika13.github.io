const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "home-health-focus.js"), "utf8");
const css = fs.readFileSync(path.join(root, "home-health-focus.css"), "utf8");
const api = require("../home-health-focus.js");

function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    read(key) { return data.get(key); }
  };
}

test("exposes a standalone UMD API and versioned local-first stores", () => {
  assert.equal(global.HHHomeHealthFocus, api);
  assert.equal(api.VERSION, "1.0.0");
  assert.equal(api.HEALTH_STORAGE_KEY, "hh.home.health.samples.v1");
  assert.equal(api.FOCUS_STORAGE_KEY, "hh.home.focus.v1");
  assert.equal(api.TODO_STORAGE_KEY, "hh.command-center.todos.v2");
  for (const method of ["buildEndpointPlan", "probeEndpoint", "createHealthMonitor", "createVitalsMonitor", "readBrowserSnapshot", "createFocusController", "mount", "unmount", "autoMount"]) {
    assert.equal(typeof api[method], "function", `${method} should be exported`);
  }
});

test("endpoint plan checks current origin plus truthful realtime auth and public endpoints", () => {
  const endpoints = api.buildEndpointPlan({ location: { origin: "https://hh.example" }, HH_REALTIME_URL: "https://api.hh.example/" });
  assert.deepEqual(endpoints.map((item) => item.id), ["frontend", "providers", "session", "public-api"]);
  assert.equal(endpoints[0].url, "https://hh.example/");
  assert.equal(endpoints[1].url, "https://api.hh.example/api/auth/providers");
  assert.equal(endpoints[2].protected, true);
  assert.match(endpoints[3].url, /\/api\/store\/products$/);
  assert.doesNotMatch(source, /(?:OS CPU|OS GPU)\s*(?:usage|load|percent|%)/i);
});

test("HTTP status classification treats protected unauthorized response as reachable", () => {
  assert.deepEqual(api.classifyHttpStatus(200), { state: "online", reachable: true, label: "Hoạt động" });
  assert.equal(api.classifyHttpStatus(401, { protected: true }).state, "online");
  assert.equal(api.classifyHttpStatus(401, { protected: false }).state, "degraded");
  assert.equal(api.classifyHttpStatus(429).state, "limited");
  assert.equal(api.classifyHttpStatus(503).reachable, false);
});

test("timed fetch records real status, latency and safe cross-origin credentials", async () => {
  const calls = [];
  let time = 100;
  const result = await api.probeEndpoint({ id: "providers", label: "Đăng nhập", group: "Auth", url: "https://api.hh.example/api/auth/providers" }, {
    origin: "https://hh.example",
    performance: { now: () => { time += 25; return time; } },
    fetchImpl: async (url, init) => { calls.push([url, init]); return { status: 200 }; }
  });
  assert.equal(result.status, 200);
  assert.equal(result.latency, 25);
  assert.equal(result.source, "timed-fetch");
  assert.equal(calls[0][1].credentials, "omit");
  assert.equal(calls[0][1].cache, "no-store");
});

test("health monitor persists bounded recent samples and computes honest summary", async () => {
  const storage = memoryStorage();
  let tick = 0;
  const monitor = api.createHealthMonitor({
    storage,
    endpoints: [{ id: "front", label: "Website", group: "Frontend", url: "https://hh.example/" }],
    origin: "https://hh.example",
    performance: { now: () => ++tick * 10 },
    fetchImpl: async () => ({ status: 204 }),
    scope: {}
  });
  const result = await monitor.check();
  assert.equal(result.summary.state, "online");
  assert.equal(result.summary.reachable, 1);
  const persisted = JSON.parse(storage.read(api.HEALTH_STORAGE_KEY));
  assert.equal(persisted.endpoints.front.length, 1);
  assert.equal(persisted.endpoints.front[0].status, 204);
  monitor.stop();
});

test("Core Web Vitals use published thresholds and gracefully degrade", () => {
  assert.equal(api.performanceRating("LCP", 2400), "good");
  assert.equal(api.performanceRating("INP", 320), "needs-improvement");
  assert.equal(api.performanceRating("CLS", 0.3), "poor");
  const monitor = api.createVitalsMonitor({ scope: { performance: { getEntriesByType: () => [], getEntriesByName: () => [] } } });
  assert.equal(monitor.getSupport().observer, false);
  assert.equal(monitor.getSupport().coreWebVitals, false);
  assert.doesNotThrow(() => monitor.start());
  assert.doesNotThrow(() => monitor.stop());
});

test("browser snapshot labels only supported browser metrics", async () => {
  const snapshot = await api.readBrowserSnapshot({
    navigator: {
      onLine: true,
      connection: { effectiveType: "4g", downlink: 8.5, rtt: 40, saveData: false },
      storage: { estimate: async () => ({ usage: 1024, quota: 4096 }) }
    },
    performance: { memory: { usedJSHeapSize: 512, jsHeapSizeLimit: 2048 } },
    document: { hidden: true }
  });
  assert.equal(snapshot.online, true);
  assert.equal(snapshot.network.source, "Network Information API");
  assert.equal(snapshot.heap.source, "performance.memory (JS heap)");
  assert.equal(snapshot.storage.source, "StorageManager.estimate");
  assert.equal(snapshot.fps.supported, false);
});

test("Focus Mode restores timer state, persists task and emits quiet-mode events", () => {
  const storage = memoryStorage();
  const events = [];
  const classes = new Set();
  let now = 1_000_000;
  const scope = {
    document: { body: { classList: { toggle(name, active) { active ? classes.add(name) : classes.delete(name); } }, dataset: {} } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    dispatchEvent(event) { events.push(event); },
    setInterval() { return 1; },
    clearInterval() {}
  };
  const focus = api.createFocusController({ scope, storage, now: () => now });
  focus.selectTask("task-1", "Hoàn thiện dashboard");
  focus.enter();
  focus.toggle();
  now += 10_000;
  focus.syncTime();
  const view = focus.snapshot();
  assert.equal(view.active, true);
  assert.equal(view.running, true);
  assert.equal(view.remainingSeconds, 1490);
  assert.equal(view.summary.todaySeconds, 10);
  assert.ok(classes.has("hh-focus-mode"));
  assert.ok(events.some((event) => event.type === "hh:notifications-quiet" && event.detail.quiet === true));
  assert.match(storage.read(api.FOCUS_STORAGE_KEY), /Hoàn thiện dashboard/);
  focus.destroy();
  assert.equal(classes.has("hh-focus-mode"), false, "unmount must restore the surrounding shell");
  assert.ok(events.some((event) => event.type === "hh:notifications-quiet" && event.detail.quiet === false));
});

test("Focus Mode uses a real 25/5 cycle and records completed focus sessions", () => {
  const storage = memoryStorage();
  let now = 0;
  const focus = api.createFocusController({ scope: { setInterval() { return 1; }, clearInterval() {} }, storage, now: () => now });
  assert.equal(focus.snapshot().remainingSeconds, 1500);
  focus.toggle();
  now = 1_500_000;
  focus.syncTime();
  const completed = focus.snapshot();
  assert.equal(completed.phase, "break");
  assert.equal(completed.remainingSeconds, 300);
  assert.equal(completed.stats.completed, 1);
  assert.equal(completed.summary.todaySeconds, 1500);
  focus.skip();
  assert.equal(focus.snapshot().phase, "focus");
  focus.destroy();
});

test("a corrupt running timer without an end timestamp is restored as paused", () => {
  const storage = memoryStorage({
    [api.FOCUS_STORAGE_KEY]: JSON.stringify({ running: true, active: true, phase: "focus", remainingSeconds: 900, endAt: null })
  });
  const focus = api.createFocusController({ scope: {}, storage, now: () => 10_000 });
  assert.equal(focus.snapshot().running, false);
  assert.equal(focus.snapshot().remainingSeconds, 900);
  focus.destroy();
});

test("stylesheet is scoped, responsive, accessible and keeps essential focus content", () => {
  for (const token of [
    ".hhhf {", ".hhhf-health-overview", ".hhhf-vitals", ".hhhf-focus-dock",
    "body.hh-focus-mode .app-sidebar", '[data-cc-widget="todo"]', '[data-cc-widget="music"]',
    ":focus-visible", "@media (max-width: 600px)", "@media (prefers-reduced-motion: reduce)"
  ]) assert.ok(css.includes(token), `missing CSS contract: ${token}`);
  assert.doesNotMatch(css, /font-size:\s*[^;]*vw/);
  assert.doesNotMatch(css, /letter-spacing:\s*-/);
  assert.doesNotMatch(source, /AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}|clientSecret\s*[:=]/i);
});

test("module includes truthful empty and unsupported states instead of invented telemetry", () => {
  for (const token of [/Không hỗ trợ đo JS heap/, /Không hỗ trợ Storage Estimate/, /không mô phỏng CPU\/GPU\/RAM/i, /PerformanceObserver/, /Network Information API/]) {
    assert.match(source, token, `missing truthful telemetry label: ${token}`);
  }
  assert.match(source, /hh:focus-mode-change/);
  assert.match(source, /hh:notifications-quiet/);
  assert.match(source, /visibility|document\?\.hidden|document\.hidden/);
  assert.match(source, /data-home-health-focus-host/);
  assert.match(source, /#commandCenterProRoot/);
});
