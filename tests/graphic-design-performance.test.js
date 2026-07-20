const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const file = path.join(root, "graphic-design-performance.js");
const source = fs.readFileSync(file, "utf8");
const performanceWorkspace = require(file);

test("Performance Workspace exposes a standalone UMD/global lifecycle", () => {
  assert.equal(performanceWorkspace.VERSION, 1);
  assert.equal(performanceWorkspace.FORMAT, "hh-graphic-performance-audit");
  assert.equal(performanceWorkspace.STORAGE_KEY, "hh.graphic-performance.workspace.v1");
  assert.equal(typeof performanceWorkspace.mount, "function");
  assert.equal(typeof performanceWorkspace.unmount, "function");
  assert.match(source, /globalScope\.HHGraphicPerformance = api/);
  assert.match(source, /\[data-graphic-performance\]/);

  const browserLike = { globalThis: null };
  browserLike.globalThis = browserLike;
  vm.runInNewContext(source, browserLike);
  assert.equal(typeof browserLike.HHGraphicPerformance.createFrameSampler, "function");
});

test("capability probe distinguishes API presence from a confirmed WebGPU adapter", async () => {
  class MockOffscreenCanvas {}
  class MockWorker {}
  class MockObserver {}
  MockObserver.supportedEntryTypes = ["longtask"];
  const storage = { getItem() { return null; }, setItem() {} };
  const scope = {
    document: {
      createElement() {
        return { getContext(name) { return name === "2d" || name === "webgl2" ? { name } : null; } };
      }
    },
    navigator: { gpu: { async requestAdapter() { return { name: "mock-adapter" }; } } },
    OffscreenCanvas: MockOffscreenCanvas,
    Worker: MockWorker,
    PerformanceObserver: MockObserver,
    createImageBitmap() {},
    VideoDecoder: function VideoDecoder() {},
    VideoEncoder: function VideoEncoder() {},
    VideoFrame: function VideoFrame() {},
    requestAnimationFrame() {},
    performance: { memory: { usedJSHeapSize: 10, totalJSHeapSize: 20, jsHeapSizeLimit: 100 } },
    localStorage: storage,
    matchMedia() { return { matches: true }; }
  };

  const synchronous = performanceWorkspace.detectCapabilities(scope);
  assert.equal(synchronous.webgpu, true);
  assert.equal(synchronous.webgpuUsable, null);
  assert.equal(synchronous.details.webgpu.usable, null);
  assert.equal(synchronous.webgl2, true);
  assert.equal(synchronous.canvas2d, true);
  assert.equal(synchronous.offscreenCanvas, true);
  assert.equal(synchronous.worker, true);
  assert.equal(synchronous.longTasks, true);
  assert.equal(synchronous.jsHeap, true);
  assert.equal(synchronous.webCodecs, true);
  assert.equal(synchronous.reducedMotion, true);
  assert.equal(performanceWorkspace.selectRenderer(synchronous).selected, "webgl2");

  const asynchronous = await performanceWorkspace.probeCapabilities(scope);
  assert.equal(asynchronous.webgpuUsable, true);
  assert.equal(asynchronous.details.webgpu.usable, true);
  assert.equal(performanceWorkspace.selectRenderer(asynchronous).selected, "webgpu");

  const unavailable = performanceWorkspace.detectCapabilities({ navigator: {} });
  assert.equal(unavailable.webgpu, false);
  assert.equal(unavailable.webgl2, false);
  assert.equal(unavailable.canvas2d, false);
  assert.equal(unavailable.offscreenCanvas, false);
  assert.equal(unavailable.worker, false);
  assert.equal(performanceWorkspace.selectRenderer(unavailable).selected, "none");
});

test("renderer strategy follows explicit fallback order without promoting pending capabilities", () => {
  const capabilities = {
    webgpu: true,
    webgpuUsable: false,
    webgl2: true,
    canvas2d: true,
    details: {
      webgpu: { available: true, usable: false, reason: "No adapter." },
      webgl2: { available: true, usable: true, reason: "Context created." },
      canvas2d: { available: true, usable: true, reason: "Context created." }
    }
  };
  const automatic = performanceWorkspace.selectRenderer(capabilities, "auto");
  assert.equal(automatic.selected, "webgl2");
  assert.equal(automatic.degraded, true);
  assert.deepEqual(automatic.attempts.map((item) => item.renderer), ["webgpu", "webgl2", "canvas2d"]);
  assert.equal(performanceWorkspace.selectRenderer(capabilities, "canvas2d").selected, "canvas2d");
});

test("FPS sampler measures frame deltas and has deterministic pause, resume and reset semantics", () => {
  const sampler = performanceWorkspace.createFrameSampler({ sampleSize: 5, targetFps: 60 });
  sampler.sample(0);
  sampler.sample(16.67);
  sampler.sample(33.34);
  sampler.sample(50.01);
  const live = sampler.snapshot();
  assert.ok(live.fps > 59 && live.fps < 61);
  assert.equal(live.sampledFrames, 3);
  assert.ok(live.p95FrameMs >= 16.67);

  sampler.pause();
  sampler.sample(500);
  assert.equal(sampler.snapshot().sampledFrames, 3);
  sampler.resume(1000);
  sampler.sample(1050);
  assert.ok(sampler.snapshot().droppedFrames >= 2);
  assert.equal(sampler.reset().sampledFrames, 0);
});

test("long-task and heap metrics are reported only when their browser APIs exist", () => {
  class MockPerformanceObserver {
    static supportedEntryTypes = ["longtask"];
    constructor(callback) { this.callback = callback; MockPerformanceObserver.instance = this; }
    observe(options) { this.options = options; }
    disconnect() { this.disconnected = true; }
    emit(entries) { this.callback({ getEntries: () => entries }); }
  }
  const scope = {
    PerformanceObserver: MockPerformanceObserver,
    performance: { memory: { usedJSHeapSize: 40, totalJSHeapSize: 60, jsHeapSizeLimit: 200 } }
  };
  const observer = performanceWorkspace.createLongTaskObserver(scope);
  MockPerformanceObserver.instance.emit([
    { name: "self", startTime: 10, duration: 72.5 },
    { name: "self", startTime: 100, duration: 51 }
  ]);
  const tasks = observer.getSnapshot();
  assert.equal(tasks.supported, true);
  assert.equal(tasks.count, 2);
  assert.equal(tasks.totalDurationMs, 123.5);
  assert.equal(tasks.maxDurationMs, 72.5);
  observer.disconnect();
  assert.equal(observer.getSnapshot().active, false);

  const heap = performanceWorkspace.readHeapMetrics(scope);
  assert.equal(heap.supported, true);
  assert.equal(heap.usedBytes, 40);
  assert.equal(heap.utilizationPct, 20);
  assert.deepEqual(performanceWorkspace.readHeapMetrics({}), {
    supported: false,
    usedBytes: null,
    totalBytes: null,
    limitBytes: null,
    utilizationPct: null,
    reason: "performance.memory is unavailable."
  });
  assert.equal(performanceWorkspace.readHeapMetrics({ performance: { memory: { usedJSHeapSize: null } } }).supported, false);
});

test("performance monitor starts and stops the real animation-frame sampler", () => {
  const frames = [];
  const cancelled = [];
  const scope = {
    requestAnimationFrame(callback) { frames.push(callback); return frames.length; },
    cancelAnimationFrame(handle) { cancelled.push(handle); },
    performance: { memory: { usedJSHeapSize: 1, totalJSHeapSize: 2, jsHeapSizeLimit: 4 } }
  };
  const monitor = performanceWorkspace.createPerformanceMonitor(scope);
  assert.equal(monitor.resume(), true);
  frames.shift()(0);
  frames.shift()(16.67);
  assert.equal(monitor.isRunning(), true);
  assert.ok(monitor.getSnapshot().fps.fps > 59);
  monitor.pause();
  assert.equal(monitor.isRunning(), false);
  assert.ok(cancelled.length > 0);
  assert.equal(monitor.destroy(), true);
  assert.equal(monitor.destroy(), false);
});

test("asset budgets preserve unknown sizes and report concrete transfer and renderer violations", () => {
  const assets = [
    { id: "hero", name: "hero.png", type: "image/png", size: 2 * 1024 * 1024, width: 5000, height: 3000 },
    { id: "movie", name: "movie.mp4", type: "video/mp4", size: 20 * 1024 * 1024 },
    { id: "font", name: "brand.woff2", type: "font/woff2" }
  ];
  const report = performanceWorkspace.evaluateAssetBudget(assets, {
    maxTotalBytes: 5 * 1024 * 1024,
    maxImageBytes: 1024 * 1024,
    maxVideoBytes: 10 * 1024 * 1024,
    maxDrawCalls: 100,
    maxTextures: 4
  }, { drawCalls: 120, textures: 6, textureBytes: 300 * 1024 * 1024 });
  assert.equal(report.overBudget, true);
  assert.equal(report.withinBudget, false);
  assert.equal(report.totals.unknownSizeCount, 1);
  for (const code of ["image-asset-over-budget", "video-asset-over-budget", "total-assets-over-budget", "textures-over-budget", "draw-calls-over-budget", "texture-count-over-budget"]) {
    assert.ok(report.violations.some((item) => item.code === code), `missing ${code}`);
  }

  const unknownOnly = performanceWorkspace.evaluateAssetBudget([{ name: "mystery.bin" }]);
  assert.equal(unknownOnly.status, "unknown");
  assert.equal(unknownOnly.withinBudget, null);
});

test("image and video proxy plans never claim processing when required APIs are absent", () => {
  const image = { id: "hero", name: "hero.png", type: "image/png", size: 20 * 1024 * 1024, width: 6000, height: 4000 };
  const unsupported = performanceWorkspace.planAssetProxy(image, { canvas2d: true, createImageBitmap: false });
  assert.equal(unsupported.required, true);
  assert.equal(unsupported.executable, false);
  assert.equal(unsupported.status, "unsupported");
  assert.deepEqual(unsupported.operations, []);

  const planned = performanceWorkspace.planAssetProxy(image, { canvas2d: true, createImageBitmap: true });
  assert.equal(planned.executable, true);
  assert.equal(planned.status, "planned");
  assert.match(planned.reason, /has not run/);

  const video = performanceWorkspace.planAssetProxy(
    { id: "clip", name: "clip.mp4", type: "video/mp4", size: 200 * 1024 * 1024 },
    { webCodecs: false }
  );
  assert.equal(video.status, "unsupported");
  assert.equal(video.processor, null);
  assert.doesNotMatch(JSON.stringify([unsupported, planned, video]), /processed|completed/);
});

test("timeline and list virtualization return bounded overscanned windows", () => {
  const timeline = performanceWorkspace.calculateTimelineWindow({
    duration: 100,
    pixelsPerSecond: 10,
    scrollLeft: 300,
    viewportWidth: 200,
    overscanPx: 100,
    frameRate: 30
  });
  assert.equal(timeline.totalWidth, 1000);
  assert.equal(timeline.startTime, 20);
  assert.equal(timeline.endTime, 60);
  assert.equal(timeline.visibleStartTime, 30);
  assert.equal(timeline.visibleEndTime, 50);
  assert.equal(timeline.startFrame, 600);
  assert.equal(timeline.endFrame, 1800);

  const list = performanceWorkspace.calculateVirtualListWindow({
    totalItems: 100, itemHeight: 20, scrollTop: 200, viewportHeight: 100, overscan: 2
  });
  assert.deepEqual(list, { startIndex: 8, endIndex: 17, visibleCount: 9, offset: 160, totalSize: 2000 });
});

test("lazy asset queue stays idle until resumed and enforces concurrency", async () => {
  let active = 0;
  let maxActive = 0;
  const calls = [];
  const queue = performanceWorkspace.createLazyAssetQueue({
    concurrency: 2,
    loader: async (asset) => {
      calls.push(asset.id);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return `loaded:${asset.id}`;
    }
  });
  const first = queue.enqueue({ id: "first", name: "first.png", type: "image/png", size: 1 }, { priority: 1 });
  const second = queue.enqueue({ id: "second", name: "second.png", type: "image/png", size: 1 }, { visible: true });
  const third = queue.enqueue({ id: "third", name: "third.png", type: "image/png", size: 1 }, { priority: 10 });
  assert.equal(calls.length, 0);
  assert.equal(queue.getSnapshot().pending, 3);
  assert.equal(queue.resume(), true);
  assert.deepEqual(await Promise.all([first, second, third]), ["loaded:first", "loaded:second", "loaded:third"]);
  assert.equal(maxActive, 2);
  assert.equal(calls[0], "second");
  assert.equal(calls[1], "third");
  assert.equal(queue.getSnapshot().loaded, 3);
  assert.equal(queue.destroy(), true);

  const unsupported = performanceWorkspace.createLazyAssetQueue();
  unsupported.enqueue({ id: "queued", name: "queued.bin" });
  assert.equal(unsupported.resume(), false);
  assert.equal(unsupported.getSnapshot().supported, false);
  unsupported.destroy();
});

test("project metrics expose their source and quality presets remain bounded", () => {
  const project = { name: "Performance project", layers: [{ id: 1 }] };
  const metrics = performanceWorkspace.calculateProjectMetrics(project, {
    drawCalls: 42,
    textures: [{ width: 10, height: 20 }, { decodedBytes: 500 }],
    assets: [{ name: "hero.png", type: "image/png", size: 100 }]
  });
  assert.equal(metrics.drawCalls, 42);
  assert.equal(metrics.drawCallSource, "renderer");
  assert.equal(metrics.textures, 2);
  assert.equal(metrics.textureBytes, 1300);
  assert.ok(metrics.projectSizeBytes > 0);
  assert.equal(metrics.projectSizeSource, "serialized-json");
  assert.equal(metrics.assetBytes, 100);
  const unknownMetrics = performanceWorkspace.calculateProjectMetrics({ metrics: { drawCalls: null, textures: null } }, {
    textures: [{ decodedBytes: null, width: 2, height: 3 }]
  });
  assert.equal(unknownMetrics.drawCalls, null);
  assert.equal(unknownMetrics.textureBytes, 24);

  assert.deepEqual(Object.keys(performanceWorkspace.QUALITY_PRESETS), ["draft", "balanced", "high"]);
  assert.equal(performanceWorkspace.getQualityPreset("missing").id, "balanced");
  assert.equal(performanceWorkspace.applyQualityPreset({ custom: true }, "draft").renderScale, 0.5);
  assert.equal(performanceWorkspace.recommendQualityPreset({ fps: 30 }, { webgl2: true }).presetId, "draft");
});

test("audit JSON and versioned local persistence round-trip without unsupported metric inventions", () => {
  const monitoring = {
    running: false,
    fps: { supported: true, fps: 58.4, p95FrameMs: 19, sampledFrames: 30 },
    longTasks: { supported: false, count: null, totalDurationMs: null },
    heap: { supported: false, usedBytes: null, totalBytes: null, limitBytes: null }
  };
  const audit = performanceWorkspace.createAudit({
    now: "2026-07-20T12:00:00.000Z",
    capabilities: performanceWorkspace.detectCapabilities({}),
    monitoring,
    project: { name: "Local" },
    assets: [{ name: "unknown.png", type: "image/png" }],
    qualityPreset: "draft"
  });
  const parsedAudit = JSON.parse(performanceWorkspace.exportAuditJSON(audit));
  assert.equal(parsedAudit.format, performanceWorkspace.FORMAT);
  assert.equal(parsedAudit.createdAt, "2026-07-20T12:00:00.000Z");
  assert.equal(parsedAudit.monitoring.longTasks.count, null);
  assert.equal(parsedAudit.monitoring.heap.usedBytes, null);
  assert.equal(parsedAudit.assetBudget.withinBudget, null);

  const memory = new Map();
  const storage = {
    getItem(key) { return memory.get(key) || null; },
    setItem(key, value) { memory.set(key, value); },
    removeItem(key) { memory.delete(key); }
  };
  const state = performanceWorkspace.createDefaultState();
  state.qualityPreset = "high";
  state.timeline.scrollLeft = 320;
  const saved = performanceWorkspace.saveWorkspaceState(state, storage);
  assert.equal(saved.ok, true);
  assert.equal(JSON.parse(memory.get(performanceWorkspace.STORAGE_KEY)).format, performanceWorkspace.STATE_FORMAT);
  assert.equal(performanceWorkspace.loadWorkspaceState(storage).qualityPreset, "high");
  assert.equal(performanceWorkspace.loadWorkspaceState(storage).timeline.scrollLeft, 320);
  assert.deepEqual(performanceWorkspace.saveWorkspaceState(state, null), { ok: false, reason: "unsupported" });
});

test("dashboard source includes realtime controls and accessible 375px reduced-motion behavior", () => {
  for (const marker of [
    "data-hgp-action=\"pause\"", "data-hgp-action=\"resume\"", "data-hgp-action=\"export\"",
    "data-hgp-chart", "data-hgp-capabilities", "data-hgp-timeline", "data-hgp-queue",
    "aria-live=\"polite\"", "role=\"status\"", ":focus-visible", "event.key === \" \"",
    "requestAnimationFrame", "cancelAnimationFrame", "PerformanceObserver", "performance.memory",
    "OffscreenCanvas", "Worker", "@media(max-width:375px)", "@media(prefers-reduced-motion:reduce)",
    "localStorage", "createObjectURL"
  ]) assert.ok(source.includes(marker), `missing ${marker}`);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\//);
  assert.doesNotMatch(source, /new\s+Worker\s*\(/);
  assert.doesNotMatch(source, /api[_-]?key|secret|bearer\s+[a-z0-9]/i);
});
