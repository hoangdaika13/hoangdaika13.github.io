(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-graphic-performance-audit";
  const STATE_FORMAT = "hh-graphic-performance-workspace";
  const STORAGE_KEY = "hh.graphic-performance.workspace.v1";
  const STYLE_ID = "hh-graphic-performance-style-v1";
  const MIB = 1024 * 1024;
  const mounted = typeof WeakMap === "function" ? new WeakMap() : new Map();

  const DEFAULT_BUDGET = Object.freeze({
    maxAssetCount: 500,
    maxTotalBytes: 256 * MIB,
    maxImageBytes: 12 * MIB,
    maxVideoBytes: 120 * MIB,
    maxTextureBytes: 256 * MIB,
    maxProjectBytes: 10 * MIB,
    maxDrawCalls: 1000,
    maxTextures: 128
  });

  const QUALITY_PRESETS = Object.freeze({
    draft: Object.freeze({
      id: "draft", label: "Draft", targetFps: 30, renderScale: 0.5,
      maxTextureSize: 2048, antialias: false, shadows: false, proxyScale: 0.5
    }),
    balanced: Object.freeze({
      id: "balanced", label: "Balanced", targetFps: 60, renderScale: 0.8,
      maxTextureSize: 4096, antialias: true, shadows: true, proxyScale: 0.75
    }),
    high: Object.freeze({
      id: "high", label: "High", targetFps: 60, renderScale: 1,
      maxTextureSize: 8192, antialias: true, shadows: true, proxyScale: 1
    })
  });

  function numberOr(value, fallback) {
    if (value == null || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max, fallback) {
    return Math.min(max, Math.max(min, numberOr(value, fallback == null ? min : fallback)));
  }

  function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;"
    }[character]));
  }

  function cleanText(value, fallback, limit) {
    const text = String(value == null ? fallback : value)
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return (text || fallback).slice(0, limit || 160);
  }

  function byteLength(value) {
    const text = String(value == null ? "" : value);
    if (typeof globalScope.TextEncoder === "function") return new globalScope.TextEncoder().encode(text).byteLength;
    let bytes = 0;
    for (const character of text) {
      const code = character.codePointAt(0);
      bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    }
    return bytes;
  }

  function jsonSize(value) {
    try { return byteLength(JSON.stringify(value)); } catch (_) { return null; }
  }

  function formatBytes(value) {
    if (!Number.isFinite(value)) return "N/A";
    if (value < 1024) return `${Math.round(value)} B`;
    if (value < MIB) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
    if (value < 1024 * MIB) return `${(value / MIB).toFixed(value < 10 * MIB ? 1 : 0)} MB`;
    return `${(value / (1024 * MIB)).toFixed(1)} GB`;
  }

  function storageFrom(scope, provided) {
    if (provided && typeof provided.getItem === "function" && typeof provided.setItem === "function") return provided;
    try {
      const storage = scope && scope.localStorage;
      return storage && typeof storage.getItem === "function" && typeof storage.setItem === "function" ? storage : null;
    } catch (_) {
      return null;
    }
  }

  function capability(available, usable, reason) {
    return { available: Boolean(available), usable: usable == null ? null : Boolean(usable), reason: String(reason || "") };
  }

  function canvasCapability(scope, contextName) {
    try {
      const doc = scope && scope.document;
      const canvas = doc && typeof doc.createElement === "function" ? doc.createElement("canvas") : null;
      if (!canvas || typeof canvas.getContext !== "function") return capability(false, false, "Canvas element is unavailable.");
      const context = contextName === "webgl2"
        ? canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true })
        : canvas.getContext("2d");
      return context
        ? capability(true, true, `${contextName} context created.`)
        : capability(true, false, `${contextName} context could not be created.`);
    } catch (error) {
      return capability(true, false, `${contextName} probe failed: ${error && error.message ? error.message : "unknown error"}.`);
    }
  }

  function detectCapabilities(scope) {
    const target = scope || globalScope;
    const canvas2d = canvasCapability(target, "canvas2d");
    const webgl2 = canvasCapability(target, "webgl2");
    const gpu = target.navigator && target.navigator.gpu;
    const webgpuAvailable = Boolean(gpu && typeof gpu.requestAdapter === "function");
    const webgpu = webgpuAvailable
      ? capability(true, null, "WebGPU API found; adapter has not been requested.")
      : capability(false, false, "WebGPU API is unavailable.");

    let offscreen;
    if (typeof target.OffscreenCanvas !== "function") offscreen = capability(false, false, "OffscreenCanvas is unavailable.");
    else {
      try {
        const surface = new target.OffscreenCanvas(1, 1);
        offscreen = capability(true, Boolean(surface), surface ? "OffscreenCanvas created." : "OffscreenCanvas construction returned no surface.");
      } catch (error) {
        offscreen = capability(true, false, `OffscreenCanvas construction failed: ${error && error.message ? error.message : "unknown error"}.`);
      }
    }

    const workerAvailable = typeof target.Worker === "function";
    const worker = capability(
      workerAvailable,
      workerAvailable,
      workerAvailable ? "Worker constructor is available; this workspace does not create a worker script." : "Worker is unavailable."
    );
    const observerType = target.PerformanceObserver;
    const observerTypes = observerType && Array.isArray(observerType.supportedEntryTypes) ? observerType.supportedEntryTypes : null;
    const longTasksAvailable = typeof observerType === "function" && (!observerTypes || observerTypes.includes("longtask"));
    const memory = target.performance && target.performance.memory;
    const heapAvailable = Boolean(memory && memory.usedJSHeapSize != null && Number.isFinite(Number(memory.usedJSHeapSize)));
    const localStorage = Boolean(storageFrom(target));
    const imageBitmap = typeof target.createImageBitmap === "function";
    const webCodecs = typeof target.VideoDecoder === "function" && typeof target.VideoEncoder === "function" && typeof target.VideoFrame === "function";

    return {
      webgpu: webgpu.available,
      webgpuUsable: webgpu.usable,
      webgl2: webgl2.usable === true,
      canvas2d: canvas2d.usable === true,
      offscreenCanvas: offscreen.usable === true,
      worker: worker.usable === true,
      animationFrame: typeof target.requestAnimationFrame === "function",
      longTasks: longTasksAvailable,
      jsHeap: heapAvailable,
      localStorage,
      createImageBitmap: imageBitmap,
      webCodecs,
      reducedMotion: Boolean(target.matchMedia && target.matchMedia("(prefers-reduced-motion: reduce)").matches),
      details: { webgpu, webgl2, canvas2d, offscreenCanvas: offscreen, worker }
    };
  }

  async function probeCapabilities(scope) {
    const target = scope || globalScope;
    const result = detectCapabilities(target);
    const gpu = target.navigator && target.navigator.gpu;
    if (!result.webgpu || !gpu || typeof gpu.requestAdapter !== "function") return result;
    try {
      const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
      result.webgpuUsable = Boolean(adapter);
      result.details.webgpu = adapter
        ? capability(true, true, "WebGPU adapter acquired.")
        : capability(true, false, "WebGPU API is present, but no adapter was returned.");
    } catch (error) {
      result.webgpuUsable = false;
      result.details.webgpu = capability(true, false, `WebGPU adapter request failed: ${error && error.message ? error.message : "unknown error"}.`);
    }
    return result;
  }

  function capabilityUsable(capabilities, name) {
    const source = capabilities || {};
    if (source.details && source.details[name]) return source.details[name].usable === true;
    const explicitKey = `${name}Usable`;
    if (Object.prototype.hasOwnProperty.call(source, explicitKey) && source[explicitKey] != null) return source[explicitKey] === true;
    return source[name] === true;
  }

  function rendererChain(preference) {
    if (Array.isArray(preference) && preference.length) return preference.filter((name) => ["webgpu", "webgl2", "canvas2d"].includes(name));
    if (preference === "canvas2d") return ["canvas2d"];
    if (preference === "webgl2") return ["webgl2", "canvas2d"];
    return ["webgpu", "webgl2", "canvas2d"];
  }

  function selectRenderer(capabilities, preference) {
    const chain = rendererChain(preference);
    const attempts = chain.map((renderer) => {
      const usable = capabilityUsable(capabilities, renderer);
      const detail = capabilities && capabilities.details && capabilities.details[renderer];
      return { renderer, usable, reason: detail ? detail.reason : usable ? `${renderer} is available.` : `${renderer} is unavailable.` };
    });
    const match = attempts.find((attempt) => attempt.usable);
    const selected = match ? match.renderer : "none";
    return {
      requested: chain[0] || "webgpu",
      selected,
      renderer: selected,
      degraded: selected === "none" || selected !== chain[0],
      attempts,
      reason: match ? match.reason : "No usable WebGPU, WebGL2, or Canvas2D renderer was detected."
    };
  }

  function percentile(values, ratio) {
    if (!values.length) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
  }

  function createFrameSampler(options) {
    const settings = options && typeof options === "object" ? options : {};
    const sampleSize = Math.round(clamp(settings.sampleSize, 2, 600, 120));
    const targetFps = clamp(settings.targetFps, 1, 240, 60);
    const targetFrameMs = 1000 / targetFps;
    let deltas = [];
    let lastTimestamp = null;
    let totalFrames = 0;
    let droppedFrames = 0;
    let paused = settings.paused === true;

    function snapshot() {
      const average = deltas.length ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : null;
      const fps = average ? 1000 / average : null;
      return {
        supported: true,
        paused,
        fps: fps == null ? null : Number(fps.toFixed(1)),
        averageFrameMs: average == null ? null : Number(average.toFixed(2)),
        p95FrameMs: deltas.length ? Number(percentile(deltas, 0.95).toFixed(2)) : null,
        minFps: deltas.length ? Number((1000 / Math.max(...deltas)).toFixed(1)) : null,
        sampledFrames: deltas.length,
        totalFrames,
        droppedFrames,
        targetFps
      };
    }

    function sample(timestamp) {
      if (paused) return snapshot();
      const now = numberOr(timestamp, NaN);
      if (!Number.isFinite(now)) return snapshot();
      if (lastTimestamp != null) {
        const delta = now - lastTimestamp;
        if (delta > 0 && delta < 10000) {
          deltas.push(delta);
          if (deltas.length > sampleSize) deltas.shift();
          droppedFrames += Math.max(0, Math.round(delta / targetFrameMs) - 1);
          totalFrames += 1;
        }
      }
      lastTimestamp = now;
      return snapshot();
    }

    return {
      sample,
      pushFrame: sample,
      snapshot,
      pause() { paused = true; lastTimestamp = null; return snapshot(); },
      resume(timestamp) { paused = false; lastTimestamp = Number.isFinite(Number(timestamp)) ? Number(timestamp) : null; return snapshot(); },
      isPaused: () => paused,
      reset() { deltas = []; lastTimestamp = null; totalFrames = 0; droppedFrames = 0; return snapshot(); }
    };
  }

  function createLongTaskObserver(scope, options) {
    const target = scope || globalScope;
    const settings = options && typeof options === "object" ? options : {};
    const Observer = target.PerformanceObserver;
    const supportedTypes = Observer && Array.isArray(Observer.supportedEntryTypes) ? Observer.supportedEntryTypes : null;
    const supported = typeof Observer === "function" && (!supportedTypes || supportedTypes.includes("longtask"));
    const recentLimit = Math.round(clamp(settings.recentLimit, 1, 200, 30));
    let active = false;
    let observer = null;
    let count = 0;
    let totalDurationMs = 0;
    let maxDurationMs = 0;
    const recent = [];
    let reason = supported ? "Long-task observer is ready." : "Long-task entries are unsupported.";

    function addEntries(entries) {
      entries.forEach((entry) => {
        const duration = Math.max(0, numberOr(entry && entry.duration, 0));
        const record = {
          name: cleanText(entry && entry.name, "longtask", 80),
          startTime: Math.max(0, numberOr(entry && entry.startTime, 0)),
          duration: Number(duration.toFixed(2))
        };
        count += 1;
        totalDurationMs += duration;
        maxDurationMs = Math.max(maxDurationMs, duration);
        recent.push(record);
        if (recent.length > recentLimit) recent.shift();
        if (typeof settings.onEntry === "function") settings.onEntry(clone(record));
      });
    }

    function start() {
      if (!supported) return false;
      if (active) return true;
      try {
        if (!observer) observer = new Observer((list) => addEntries(Array.from(list.getEntries ? list.getEntries() : [])));
        try { observer.observe({ type: "longtask", buffered: true }); }
        catch (_) { observer.observe({ entryTypes: ["longtask"] }); }
        active = true;
        reason = "Long-task observer is active.";
        return true;
      } catch (error) {
        active = false;
        reason = `Long-task observer failed: ${error && error.message ? error.message : "unknown error"}.`;
        return false;
      }
    }

    function disconnect() {
      if (observer && typeof observer.disconnect === "function") observer.disconnect();
      active = false;
    }

    function snapshot() {
      return supported ? {
        supported: true, active, count,
        totalDurationMs: Number(totalDurationMs.toFixed(2)),
        maxDurationMs: Number(maxDurationMs.toFixed(2)),
        recent: clone(recent), reason
      } : {
        supported: false, active: false, count: null,
        totalDurationMs: null, maxDurationMs: null, recent: [], reason
      };
    }

    if (settings.autoStart !== false) start();
    return { supported, start, disconnect, snapshot, getSnapshot: snapshot };
  }

  function readHeapMetrics(scope) {
    const target = scope || globalScope;
    const memory = target.performance && target.performance.memory;
    if (!memory || memory.usedJSHeapSize == null || !Number.isFinite(Number(memory.usedJSHeapSize))) {
      return { supported: false, usedBytes: null, totalBytes: null, limitBytes: null, utilizationPct: null, reason: "performance.memory is unavailable." };
    }
    const usedBytes = Math.max(0, numberOr(memory.usedJSHeapSize, 0));
    const totalBytes = Math.max(0, numberOr(memory.totalJSHeapSize, 0));
    const limitBytes = Math.max(0, numberOr(memory.jsHeapSizeLimit, 0));
    return {
      supported: true,
      usedBytes,
      totalBytes,
      limitBytes,
      utilizationPct: limitBytes > 0 ? Number((usedBytes / limitBytes * 100).toFixed(1)) : null,
      reason: "Reported by the non-standard performance.memory API."
    };
  }

  function createPerformanceMonitor(scope, options) {
    const target = scope || globalScope;
    const settings = options && typeof options === "object" ? options : {};
    const sampler = createFrameSampler({ sampleSize: settings.sampleSize, targetFps: settings.targetFps, paused: true });
    const longTasks = createLongTaskObserver(target, { autoStart: false, recentLimit: settings.longTaskLimit, onEntry: settings.onLongTask });
    let frameHandle = 0;
    let running = false;
    let destroyed = false;

    function frame(timestamp) {
      if (!running || destroyed) return;
      const fps = sampler.sample(timestamp);
      if (typeof settings.onSample === "function") settings.onSample({ fps, longTasks: longTasks.snapshot(), heap: readHeapMetrics(target) });
      frameHandle = target.requestAnimationFrame(frame);
    }

    function resume() {
      if (destroyed || running || typeof target.requestAnimationFrame !== "function") return false;
      running = true;
      sampler.resume();
      longTasks.start();
      frameHandle = target.requestAnimationFrame(frame);
      return true;
    }

    function pause() {
      if (frameHandle && typeof target.cancelAnimationFrame === "function") target.cancelAnimationFrame(frameHandle);
      frameHandle = 0;
      running = false;
      sampler.pause();
      longTasks.disconnect();
      return true;
    }

    function snapshot() {
      return { running, fps: sampler.snapshot(), longTasks: longTasks.snapshot(), heap: readHeapMetrics(target) };
    }

    return {
      resume, start: resume, pause,
      sample: (timestamp) => sampler.sample(timestamp),
      snapshot, getSnapshot: snapshot,
      isRunning: () => running,
      reset: () => sampler.reset(),
      destroy() { if (destroyed) return false; pause(); destroyed = true; return true; }
    };
  }

  function assetKind(asset) {
    const type = String(asset && asset.type || "").toLowerCase();
    const name = String(asset && asset.name || "").toLowerCase();
    if (type.startsWith("image/") || /\.(png|jpe?g|webp|gif|avif|svg)$/.test(name)) return "image";
    if (type.startsWith("video/") || /\.(mp4|webm|mov|m4v|avi)$/.test(name)) return "video";
    if (type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a)$/.test(name)) return "audio";
    if (type.startsWith("font/") || /\.(woff2?|ttf|otf)$/.test(name)) return "font";
    return "other";
  }

  function normalizeAsset(asset, index) {
    const source = asset && typeof asset === "object" ? asset : {};
    const hasSize = source.size != null && Number.isFinite(Number(source.size)) && Number(source.size) >= 0;
    return {
      id: cleanText(source.id, `asset-${index + 1}`, 100),
      name: cleanText(source.name, `Asset ${index + 1}`, 180),
      type: cleanText(source.type, "application/octet-stream", 100),
      kind: assetKind(source),
      size: hasSize ? Number(source.size) : null,
      width: Number.isFinite(Number(source.width)) && Number(source.width) > 0 ? Number(source.width) : null,
      height: Number.isFinite(Number(source.height)) && Number(source.height) > 0 ? Number(source.height) : null,
      duration: source.duration != null && Number.isFinite(Number(source.duration)) && Number(source.duration) >= 0 ? Number(source.duration) : null,
      decodedBytes: source.decodedBytes != null && Number.isFinite(Number(source.decodedBytes)) && Number(source.decodedBytes) >= 0 ? Number(source.decodedBytes) : null
    };
  }

  function normalizeBudget(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      maxAssetCount: Math.round(clamp(source.maxAssetCount, 1, 100000, DEFAULT_BUDGET.maxAssetCount)),
      maxTotalBytes: clamp(source.maxTotalBytes, 1024, 1024 * 1024 * MIB, DEFAULT_BUDGET.maxTotalBytes),
      maxImageBytes: clamp(source.maxImageBytes, 1024, 1024 * MIB, DEFAULT_BUDGET.maxImageBytes),
      maxVideoBytes: clamp(source.maxVideoBytes, 1024, 1024 * 1024 * MIB, DEFAULT_BUDGET.maxVideoBytes),
      maxTextureBytes: clamp(source.maxTextureBytes, 1024, 1024 * 1024 * MIB, DEFAULT_BUDGET.maxTextureBytes),
      maxProjectBytes: clamp(source.maxProjectBytes, 1024, 1024 * MIB, DEFAULT_BUDGET.maxProjectBytes),
      maxDrawCalls: Math.round(clamp(source.maxDrawCalls, 1, 1000000, DEFAULT_BUDGET.maxDrawCalls)),
      maxTextures: Math.round(clamp(source.maxTextures, 1, 100000, DEFAULT_BUDGET.maxTextures))
    };
  }

  function evaluateAssetBudget(assetInput, budgetInput, metricsInput) {
    const assets = Array.from(assetInput || [], normalizeAsset);
    const budget = normalizeBudget(budgetInput);
    const metrics = metricsInput && typeof metricsInput === "object" ? metricsInput : {};
    const knownAssets = assets.filter((asset) => asset.size != null);
    const totalBytes = knownAssets.reduce((sum, asset) => sum + asset.size, 0);
    const textureBytes = metrics.textureBytes != null && Number.isFinite(Number(metrics.textureBytes)) ? Number(metrics.textureBytes) : assets.reduce((sum, asset) => sum + (asset.decodedBytes || 0), 0);
    const violations = [];

    assets.forEach((asset) => {
      const limit = asset.kind === "image" ? budget.maxImageBytes : asset.kind === "video" ? budget.maxVideoBytes : null;
      if (limit != null && asset.size != null && asset.size > limit) violations.push({
        code: `${asset.kind}-asset-over-budget`, severity: "warning", assetId: asset.id,
        actual: asset.size, limit, message: `${asset.name} exceeds the ${asset.kind} transfer budget.`
      });
    });
    if (assets.length > budget.maxAssetCount) violations.push({ code: "asset-count-over-budget", severity: "error", actual: assets.length, limit: budget.maxAssetCount, message: "Asset count exceeds budget." });
    if (totalBytes > budget.maxTotalBytes) violations.push({ code: "total-assets-over-budget", severity: "error", actual: totalBytes, limit: budget.maxTotalBytes, message: "Known asset bytes exceed budget." });
    if (textureBytes > budget.maxTextureBytes) violations.push({ code: "textures-over-budget", severity: "error", actual: textureBytes, limit: budget.maxTextureBytes, message: "Decoded texture bytes exceed budget." });
    if (metrics.projectSizeBytes != null && Number.isFinite(Number(metrics.projectSizeBytes)) && Number(metrics.projectSizeBytes) > budget.maxProjectBytes) violations.push({ code: "project-over-budget", severity: "error", actual: Number(metrics.projectSizeBytes), limit: budget.maxProjectBytes, message: "Serialized project size exceeds budget." });
    if (metrics.drawCalls != null && Number.isFinite(Number(metrics.drawCalls)) && Number(metrics.drawCalls) > budget.maxDrawCalls) violations.push({ code: "draw-calls-over-budget", severity: "warning", actual: Number(metrics.drawCalls), limit: budget.maxDrawCalls, message: "Renderer draw calls exceed budget." });
    if (metrics.textures != null && Number.isFinite(Number(metrics.textures)) && Number(metrics.textures) > budget.maxTextures) violations.push({ code: "texture-count-over-budget", severity: "warning", actual: Number(metrics.textures), limit: budget.maxTextures, message: "Renderer texture count exceeds budget." });

    const unknownSizeCount = assets.length - knownAssets.length;
    const overBudget = violations.length > 0;
    return {
      budget,
      totals: {
        assetCount: assets.length,
        knownSizeCount: knownAssets.length,
        unknownSizeCount,
        totalBytes,
        imageBytes: knownAssets.filter((asset) => asset.kind === "image").reduce((sum, asset) => sum + asset.size, 0),
        videoBytes: knownAssets.filter((asset) => asset.kind === "video").reduce((sum, asset) => sum + asset.size, 0),
        textureBytes
      },
      utilizationPct: Number((totalBytes / budget.maxTotalBytes * 100).toFixed(1)),
      overBudget,
      withinBudget: unknownSizeCount ? (overBudget ? false : null) : !overBudget,
      status: overBudget ? "over-budget" : unknownSizeCount ? "unknown" : "within-budget",
      violations
    };
  }

  function proxyCapability(capabilities, name) {
    const source = capabilities || {};
    if (name === "imageSurface") return source.offscreenCanvas === true || source.canvas2d === true;
    return source[name] === true;
  }

  function planAssetProxy(assetInput, capabilities, options) {
    const asset = normalizeAsset(assetInput, 0);
    const settings = options && typeof options === "object" ? options : {};
    const maxDimension = clamp(settings.maxDimension, 256, 16384, 4096);
    const imageLimit = clamp(settings.maxImageBytes, 1024, 1024 * MIB, DEFAULT_BUDGET.maxImageBytes);
    const videoLimit = clamp(settings.maxVideoBytes, 1024, 1024 * 1024 * MIB, DEFAULT_BUDGET.maxVideoBytes);
    const tooLarge = asset.kind === "image"
      ? (asset.size != null && asset.size > imageLimit) || (asset.width != null && asset.width > maxDimension) || (asset.height != null && asset.height > maxDimension)
      : asset.kind === "video"
        ? (asset.size != null && asset.size > videoLimit) || (asset.width != null && asset.width > maxDimension) || (asset.height != null && asset.height > maxDimension)
        : false;
    const required = settings.force === true || tooLarge;

    if (!required || !["image", "video"].includes(asset.kind)) return {
      assetId: asset.id, kind: asset.kind, required: false, executable: false, status: "not-needed",
      processor: null, operations: [], reason: ["image", "video"].includes(asset.kind) ? "Asset is within configured proxy thresholds." : "This asset type has no proxy plan."
    };

    if (asset.kind === "image") {
      const bitmap = proxyCapability(capabilities, "createImageBitmap");
      const surface = proxyCapability(capabilities, "imageSurface");
      const executable = bitmap && surface;
      return {
        assetId: asset.id, kind: asset.kind, required: true, executable,
        status: executable ? "planned" : "unsupported",
        processor: executable ? (capabilities.offscreenCanvas ? "createImageBitmap+offscreen-canvas" : "createImageBitmap+canvas2d") : null,
        operations: executable ? ["decode", "resize", "encode-proxy"] : [],
        target: { maxDimension, mimeType: "image/webp" },
        reason: executable ? "Required APIs are available; work is planned but has not run." : "Image proxy requires createImageBitmap and a usable canvas surface."
      };
    }

    const executable = proxyCapability(capabilities, "webCodecs");
    return {
      assetId: asset.id, kind: asset.kind, required: true, executable,
      status: executable ? "planned" : "unsupported",
      processor: executable ? "webcodecs" : null,
      operations: executable ? ["decode-frames", "resize-frames", "encode-proxy"] : [],
      target: { maxDimension, mimeType: "video/webm" },
      reason: executable ? "WebCodecs APIs are available; work is planned but has not run." : "Video proxy requires VideoDecoder, VideoEncoder, and VideoFrame."
    };
  }

  function planAssetProxies(assets, capabilities, options) {
    const plans = Array.from(assets || [], (asset) => planAssetProxy(asset, capabilities, options));
    return {
      plans,
      required: plans.filter((plan) => plan.required).length,
      executable: plans.filter((plan) => plan.status === "planned").length,
      unsupported: plans.filter((plan) => plan.status === "unsupported").length,
      note: "Plans describe possible local work; they do not claim that a proxy was generated."
    };
  }

  function calculateVirtualListWindow(totalItemsOrOptions, itemSize, scrollOffset, viewportSize, overscan) {
    const input = totalItemsOrOptions && typeof totalItemsOrOptions === "object" ? totalItemsOrOptions : {
      totalItems: totalItemsOrOptions, itemSize, scrollOffset, viewportSize, overscan
    };
    const totalItems = Math.max(0, Math.floor(numberOr(input.totalItems, 0)));
    const size = Math.max(1, numberOr(input.itemSize || input.itemHeight || input.itemWidth, 1));
    const scroll = Math.max(0, numberOr(input.scrollOffset != null ? input.scrollOffset : input.scrollTop, 0));
    const viewport = Math.max(0, numberOr(input.viewportSize != null ? input.viewportSize : input.viewportHeight, 0));
    const extra = Math.max(0, Math.floor(numberOr(input.overscan, 2)));
    const startIndex = Math.max(0, Math.floor(scroll / size) - extra);
    const endIndex = Math.min(totalItems, Math.ceil((scroll + viewport) / size) + extra);
    return {
      startIndex, endIndex,
      visibleCount: Math.max(0, endIndex - startIndex),
      offset: startIndex * size,
      totalSize: totalItems * size
    };
  }

  function calculateTimelineWindow(options) {
    const input = options && typeof options === "object" ? options : {};
    const duration = Math.max(0, numberOr(input.duration, 0));
    const pixelsPerSecond = clamp(input.pixelsPerSecond, 1, 10000, 100);
    const totalWidth = duration * pixelsPerSecond;
    const scrollLeft = clamp(input.scrollLeft, 0, Math.max(0, totalWidth), 0);
    const viewportWidth = Math.max(0, numberOr(input.viewportWidth, 0));
    const overscanPx = Math.max(0, numberOr(input.overscanPx, viewportWidth * 0.5));
    const startPx = Math.max(0, scrollLeft - overscanPx);
    const endPx = Math.min(totalWidth, scrollLeft + viewportWidth + overscanPx);
    const frameRate = clamp(input.frameRate, 1, 240, 30);
    return {
      startTime: Number((startPx / pixelsPerSecond).toFixed(4)),
      endTime: Number((endPx / pixelsPerSecond).toFixed(4)),
      visibleStartTime: Number((scrollLeft / pixelsPerSecond).toFixed(4)),
      visibleEndTime: Number((Math.min(totalWidth, scrollLeft + viewportWidth) / pixelsPerSecond).toFixed(4)),
      startFrame: Math.floor(startPx / pixelsPerSecond * frameRate),
      endFrame: Math.ceil(endPx / pixelsPerSecond * frameRate),
      offsetPx: startPx,
      widthPx: Math.max(0, endPx - startPx),
      totalWidth,
      pixelsPerSecond
    };
  }

  function createLazyAssetQueue(options) {
    const settings = options && typeof options === "object" ? options : {};
    const loader = typeof settings.loader === "function" ? settings.loader : null;
    const concurrency = Math.round(clamp(settings.concurrency, 1, 16, 2));
    const jobs = new Map();
    const listeners = new Set();
    let paused = settings.autoStart !== true;
    let destroyed = false;
    let sequence = 0;

    function snapshot() {
      const values = Array.from(jobs.values());
      const count = (status) => values.filter((job) => job.status === status).length;
      return {
        supported: Boolean(loader), paused, concurrency,
        pending: count("pending"), loading: count("loading"), loaded: count("loaded"), failed: count("failed"),
        items: values.map((job) => ({ id: job.id, name: job.asset.name, status: job.status, priority: job.priority, visible: job.visible, error: job.error }))
      };
    }

    function notify() {
      const value = snapshot();
      listeners.forEach((listener) => { try { listener(value); } catch (_) {} });
      if (typeof settings.onChange === "function") settings.onChange(value);
    }

    function drain() {
      if (paused || destroyed || !loader) return;
      const loading = Array.from(jobs.values()).filter((job) => job.status === "loading").length;
      const slots = concurrency - loading;
      if (slots <= 0) return;
      const pending = Array.from(jobs.values()).filter((job) => job.status === "pending")
        .sort((a, b) => Number(b.visible) - Number(a.visible) || b.priority - a.priority || a.sequence - b.sequence)
        .slice(0, slots);
      pending.forEach((job) => {
        job.status = "loading";
        notify();
        Promise.resolve().then(() => loader(clone(job.asset))).then((result) => {
          job.status = "loaded";
          job.result = result;
          job.resolve(result);
        }, (error) => {
          job.status = "failed";
          job.error = error && error.message ? error.message : String(error || "Asset load failed");
          job.reject(error);
        }).finally(() => { notify(); drain(); });
      });
    }

    function enqueue(assetInput, jobOptions) {
      if (destroyed) return Promise.reject(new Error("Queue is destroyed."));
      const asset = normalizeAsset(assetInput, jobs.size);
      if (jobs.has(asset.id)) return jobs.get(asset.id).promise;
      const config = jobOptions && typeof jobOptions === "object" ? jobOptions : {};
      let resolvePromise;
      let rejectPromise;
      const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
      jobs.set(asset.id, {
        id: asset.id, asset, status: "pending", priority: numberOr(config.priority, 0),
        visible: config.visible === true, sequence: sequence += 1, promise,
        resolve: resolvePromise, reject: rejectPromise, result: null, error: null
      });
      notify();
      drain();
      return promise;
    }

    function markVisible(id, visible) {
      const job = jobs.get(String(id));
      if (!job) return false;
      job.visible = visible !== false;
      notify();
      drain();
      return true;
    }

    return {
      enqueue,
      markVisible,
      pause() { paused = true; notify(); return snapshot(); },
      resume() { if (destroyed || !loader) return false; paused = false; notify(); drain(); return true; },
      start() { return this.resume(); },
      isPaused: () => paused,
      snapshot,
      getSnapshot: snapshot,
      subscribe(listener) { if (typeof listener !== "function") return () => {}; listeners.add(listener); return () => listeners.delete(listener); },
      clear() {
        Array.from(jobs.values()).filter((job) => job.status === "pending").forEach((job) => job.resolve({ status: "cancelled", assetId: job.id }));
        Array.from(jobs.entries()).forEach(([id, job]) => { if (job.status !== "loading") jobs.delete(id); });
        notify();
      },
      destroy() { if (destroyed) return false; paused = true; destroyed = true; this.clear(); listeners.clear(); return true; }
    };
  }

  function textureBytes(texture) {
    if (!texture || typeof texture !== "object") return 0;
    if (texture.decodedBytes != null && Number.isFinite(Number(texture.decodedBytes))) return Math.max(0, Number(texture.decodedBytes));
    if (Number.isFinite(Number(texture.width)) && Number.isFinite(Number(texture.height))) return Math.max(0, Number(texture.width) * Number(texture.height) * numberOr(texture.bytesPerPixel, 4));
    if (texture.size != null && Number.isFinite(Number(texture.size))) return Math.max(0, Number(texture.size));
    return 0;
  }

  function calculateProjectMetrics(project, options) {
    const settings = options && typeof options === "object" ? options : {};
    const projectMetrics = project && project.metrics && typeof project.metrics === "object" ? project.metrics : {};
    const providedDrawCalls = settings.drawCalls != null ? settings.drawCalls : projectMetrics.drawCalls;
    const drawCalls = providedDrawCalls != null && Number.isFinite(Number(providedDrawCalls)) ? Math.max(0, Math.round(Number(providedDrawCalls))) : null;
    const texturesInput = settings.textures != null ? settings.textures : projectMetrics.textures;
    const textureList = Array.isArray(texturesInput) ? texturesInput : null;
    const textureCount = textureList ? textureList.length : texturesInput != null && Number.isFinite(Number(texturesInput)) ? Math.max(0, Math.round(Number(texturesInput))) : null;
    const assets = Array.from(settings.assets || [], normalizeAsset);
    const inventoryTextures = assets.filter((asset) => asset.kind === "image");
    const finalTextures = textureCount == null && assets.length ? inventoryTextures.length : textureCount;
    const measuredTextureBytes = settings.textureBytes != null && Number.isFinite(Number(settings.textureBytes))
      ? Math.max(0, Number(settings.textureBytes))
      : textureList ? textureList.reduce((sum, texture) => sum + textureBytes(texture), 0)
        : inventoryTextures.reduce((sum, texture) => sum + (texture.decodedBytes || (texture.width && texture.height ? texture.width * texture.height * 4 : 0)), 0);
    const projectSizeBytes = settings.projectSizeBytes != null && Number.isFinite(Number(settings.projectSizeBytes)) ? Math.max(0, Number(settings.projectSizeBytes)) : jsonSize(project);
    const assetBytes = assets.filter((asset) => asset.size != null).reduce((sum, asset) => sum + asset.size, 0);
    return {
      drawCalls,
      drawCallSource: drawCalls == null ? "unavailable" : settings.drawCalls != null ? "renderer" : "project-metrics",
      textures: finalTextures,
      textureSource: textureCount != null ? (settings.textures != null ? "renderer" : "project-metrics") : assets.length ? "asset-inventory" : "unavailable",
      textureBytes: measuredTextureBytes,
      projectSizeBytes,
      projectSizeSource: settings.projectSizeBytes != null ? "provided" : projectSizeBytes == null ? "unavailable" : "serialized-json",
      assetBytes,
      unknownAssetSizes: assets.filter((asset) => asset.size == null).length
    };
  }

  function getQualityPreset(id) {
    return clone(QUALITY_PRESETS[id] || QUALITY_PRESETS.balanced);
  }

  function applyQualityPreset(settings, presetId) {
    return Object.assign({}, settings && typeof settings === "object" ? clone(settings) : {}, getQualityPreset(presetId));
  }

  function recommendQualityPreset(metrics, capabilities) {
    const source = metrics && typeof metrics === "object" ? metrics : {};
    const fps = source.fps && source.fps.fps != null ? source.fps.fps : source.fps;
    if (!capabilityUsable(capabilities, "webgl2") && !capabilityUsable(capabilities, "webgpu")) return { presetId: "draft", reason: "No confirmed GPU renderer is available." };
    if (fps != null && Number.isFinite(Number(fps)) && Number(fps) < 42) return { presetId: "draft", reason: "Measured FPS is below 42." };
    if (capabilityUsable(capabilities, "webgpu") && fps != null && Number.isFinite(Number(fps)) && Number(fps) >= 58) return { presetId: "high", reason: "Confirmed WebGPU and stable measured FPS support the high preset." };
    return { presetId: "balanced", reason: "Balanced is the conservative default for the available evidence." };
  }

  function createAudit(options) {
    const input = options && typeof options === "object" ? options : {};
    const capabilities = input.capabilities || detectCapabilities(input.scope || globalScope);
    const renderer = input.renderer || selectRenderer(capabilities, input.rendererPreference);
    const assets = Array.from(input.assets || [], normalizeAsset);
    const metrics = input.metrics || calculateProjectMetrics(input.project || null, { assets });
    const budget = input.budgetReport || evaluateAssetBudget(assets, input.budget, metrics);
    const proxies = input.proxyPlan || planAssetProxies(assets, capabilities, input.proxyOptions);
    const monitoring = input.monitoring || {
      running: false,
      fps: { supported: false, fps: null, reason: "No frame sampler snapshot was provided." },
      longTasks: { supported: false, count: null, reason: "No long-task snapshot was provided." },
      heap: readHeapMetrics(input.scope || globalScope)
    };
    const createdAt = input.now instanceof Date ? input.now.toISOString() : typeof input.now === "string" ? input.now : new Date().toISOString();
    return {
      format: FORMAT,
      version: VERSION,
      createdAt,
      workspace: cleanText(input.workspaceName, "Performance Workspace", 120),
      quality: getQualityPreset(input.qualityPreset),
      capabilities: clone(capabilities),
      renderer: clone(renderer),
      monitoring: clone(monitoring),
      metrics: clone(metrics),
      assetBudget: clone(budget),
      proxyPlan: clone(proxies),
      timelineWindow: input.timelineWindow ? clone(input.timelineWindow) : null,
      recommendation: recommendQualityPreset(monitoring && monitoring.fps ? monitoring.fps : {}, capabilities)
    };
  }

  function exportAuditJSON(options, spacing) {
    const audit = options && options.format === FORMAT ? options : createAudit(options);
    return JSON.stringify(audit, null, spacing == null ? 2 : clamp(spacing, 0, 10, 2));
  }

  function createDefaultState() {
    return {
      format: STATE_FORMAT,
      version: VERSION,
      qualityPreset: "balanced",
      rendererPreference: "auto",
      monitoringPaused: false,
      budget: normalizeBudget(DEFAULT_BUDGET),
      timeline: { duration: 120, pixelsPerSecond: 40, scrollLeft: 0 }
    };
  }

  function normalizeWorkspaceState(value) {
    const fallback = createDefaultState();
    const raw = value && value.state && value.format === STATE_FORMAT ? value.state : value;
    const source = raw && typeof raw === "object" ? raw : {};
    const timeline = source.timeline && typeof source.timeline === "object" ? source.timeline : {};
    return {
      format: STATE_FORMAT,
      version: VERSION,
      qualityPreset: Object.prototype.hasOwnProperty.call(QUALITY_PRESETS, source.qualityPreset) ? source.qualityPreset : fallback.qualityPreset,
      rendererPreference: ["auto", "webgpu", "webgl2", "canvas2d"].includes(source.rendererPreference) ? source.rendererPreference : fallback.rendererPreference,
      monitoringPaused: source.monitoringPaused === true,
      budget: normalizeBudget(source.budget),
      timeline: {
        duration: clamp(timeline.duration, 1, 86400, fallback.timeline.duration),
        pixelsPerSecond: clamp(timeline.pixelsPerSecond, 1, 10000, fallback.timeline.pixelsPerSecond),
        scrollLeft: Math.max(0, numberOr(timeline.scrollLeft, 0))
      }
    };
  }

  function saveWorkspaceState(value, storage) {
    const target = storageFrom(globalScope, storage);
    if (!target) return { ok: false, reason: "unsupported" };
    const state = normalizeWorkspaceState(value);
    const payload = { format: STATE_FORMAT, version: VERSION, savedAt: new Date().toISOString(), state };
    try {
      const text = JSON.stringify(payload);
      target.setItem(STORAGE_KEY, text);
      return { ok: true, key: STORAGE_KEY, bytes: byteLength(text) };
    } catch (error) {
      return { ok: false, reason: "write-failed", error: error && error.message ? error.message : String(error) };
    }
  }

  function loadWorkspaceState(storage) {
    const target = storageFrom(globalScope, storage);
    if (!target) return createDefaultState();
    try {
      const parsed = JSON.parse(target.getItem(STORAGE_KEY) || "null");
      if (!parsed || parsed.format !== STATE_FORMAT || Number(parsed.version) > VERSION) return createDefaultState();
      return normalizeWorkspaceState(parsed);
    } catch (_) {
      return createDefaultState();
    }
  }

  function createPersistence(storage) {
    const target = storageFrom(globalScope, storage);
    return {
      supported: Boolean(target),
      load: () => loadWorkspaceState(target),
      save: (state) => saveWorkspaceState(state, target),
      clear() {
        if (!target || typeof target.removeItem !== "function") return false;
        try { target.removeItem(STORAGE_KEY); return true; } catch (_) { return false; }
      }
    };
  }

  function styles() {
    return `
      .hgp{--bg:#080d14;--surface:#101822;--surface2:#151f2a;--line:#304252;--text:#edf5f5;--muted:#9aabb5;--cyan:#65dbe8;--pink:#f46faf;--lime:#b9e769;--amber:#f0bd5d;box-sizing:border-box;min-width:0;overflow:hidden;background:var(--bg);color:var(--text);font:13px/1.45 Inter,system-ui,sans-serif}
      .hgp *{box-sizing:border-box;letter-spacing:0}.hgp button,.hgp input,.hgp select{min-width:0;font:inherit}.hgp button,.hgp select,.hgp input{min-height:34px;border:1px solid var(--line);border-radius:6px;background:#0c131c;color:var(--text)}.hgp button{padding:6px 10px;cursor:pointer}.hgp button:hover:not(:disabled){border-color:var(--cyan)}.hgp button:disabled{cursor:not-allowed;opacity:.45}.hgp input,.hgp select{width:100%;padding:5px 7px}.hgp :focus-visible{outline:3px solid var(--amber);outline-offset:2px}.hgp output{font-variant-numeric:tabular-nums}
      .hgp-head{display:flex;align-items:center;gap:12px;padding:11px 13px;border-bottom:1px solid var(--line);background:#0d151e}.hgp-brand{display:flex;align-items:center;gap:9px;min-width:230px}.hgp-mark{display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--pink);border-radius:6px;color:var(--pink);font-weight:900}.hgp-brand strong,.hgp-brand small{display:block}.hgp-brand small{color:var(--muted)}.hgp-head-controls{display:flex;align-items:end;justify-content:flex-end;gap:7px;margin-left:auto}.hgp-compact{display:grid;gap:3px;color:var(--muted);font-size:11px}.hgp-compact select{min-width:116px}.hgp-run{display:flex;gap:5px}.hgp-run button[aria-pressed=true]{border-color:var(--lime);background:#18271c}.hgp-export{border-color:#784568!important}
      .hgp-statusbar{display:flex;align-items:center;gap:12px;min-height:32px;padding:6px 13px;border-bottom:1px solid var(--line);color:var(--muted);font-size:11px}.hgp-statusbar [role=status]{margin-left:auto;text-align:right}.hgp-dot{width:8px;height:8px;border-radius:50%;background:var(--amber)}.hgp-dot.is-running{background:var(--lime)}
      .hgp-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(250px,310px);min-height:570px}.hgp-main,.hgp-side{min-width:0}.hgp-side{border-left:1px solid var(--line);background:var(--surface)}.hgp-section{min-width:0;padding:12px;border-bottom:1px solid var(--line)}.hgp-section:last-child{border-bottom:0}.hgp-section h3{margin:0 0 9px;color:var(--muted);font-size:11px;text-transform:uppercase}.hgp-kpis{display:grid;grid-template-columns:repeat(6,minmax(100px,1fr));border-bottom:1px solid var(--line)}.hgp-kpi{min-width:0;padding:12px;border-right:1px solid var(--line);background:var(--surface)}.hgp-kpi:last-child{border-right:0}.hgp-kpi span,.hgp-kpi small{display:block;color:var(--muted);font-size:10px}.hgp-kpi output{display:block;overflow-wrap:anywhere;font-size:20px;font-weight:800}.hgp-kpi:nth-child(1) output{color:var(--lime)}.hgp-kpi:nth-child(2) output{color:var(--cyan)}.hgp-kpi:nth-child(3) output{color:var(--pink)}.hgp-kpi:nth-child(4) output{color:var(--amber)}
      .hgp-chart-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,280px);border-bottom:1px solid var(--line)}.hgp-chart{min-width:0;padding:12px;border-right:1px solid var(--line)}.hgp-chart-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}.hgp-chart-head strong{font-size:12px}.hgp-chart-head span{color:var(--muted);font-size:11px}.hgp-chart canvas{display:block;width:100%;height:128px;border:1px solid var(--line);background:#070c12}.hgp-renderer{padding:12px}.hgp-renderer strong{display:block;margin-bottom:8px}.hgp-chain{display:grid;gap:5px}.hgp-chain-row{display:grid;grid-template-columns:68px 1fr auto;align-items:center;gap:7px;padding:6px;border:1px solid var(--line);border-radius:5px}.hgp-chain-row.is-selected{border-color:var(--cyan);background:#10252c}.hgp-chain-row small{min-width:0;overflow:hidden;color:var(--muted);text-overflow:ellipsis;white-space:nowrap}.hgp-state{color:var(--muted);font-size:10px}.hgp-state.is-ok{color:var(--lime)}
      .hgp-grid{display:grid;grid-template-columns:1fr 1fr}.hgp-grid>.hgp-section:nth-child(odd){border-right:1px solid var(--line)}.hgp-cap-list,.hgp-budget-list,.hgp-proxy-list{display:grid;gap:5px}.hgp-cap,.hgp-budget-line,.hgp-proxy{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;min-width:0}.hgp-cap span:last-child,.hgp-proxy span:last-child{color:var(--muted);font-size:10px}.hgp-cap .is-ok{color:var(--lime)!important}.hgp-cap .is-pending{color:var(--amber)!important}.hgp-cap .is-off{color:var(--pink)!important}.hgp-budget-line output{font-weight:700}.hgp progress{width:100%;height:7px;accent-color:var(--cyan)}.hgp-violations{margin:8px 0 0;padding-left:17px;color:var(--pink);font-size:11px}.hgp-empty{margin:0;color:var(--muted);font-size:11px}.hgp-proxy strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hgp-proxy .is-planned{color:var(--cyan)}.hgp-proxy .is-unsupported{color:var(--pink)}
      .hgp-timeline-controls{display:grid;grid-template-columns:1fr 86px;gap:7px;align-items:end}.hgp-timeline{position:relative;height:56px;margin-top:8px;overflow:hidden;border:1px solid var(--line);background:repeating-linear-gradient(90deg,#0a1119 0,#0a1119 39px,#24323f 40px)}.hgp-window{position:absolute;top:9px;height:36px;border:1px solid var(--cyan);background:rgba(101,219,232,.12)}.hgp-window span{display:block;overflow:hidden;padding:8px;color:var(--cyan);font-size:10px;white-space:nowrap}.hgp-fields{display:grid;grid-template-columns:1fr 1fr;gap:7px}.hgp-queue-head{display:flex;align-items:center;gap:5px}.hgp-queue-head span{margin-right:auto;color:var(--muted);font-size:11px}.hgp-queue-list{display:grid;gap:5px;margin-top:8px}.hgp-queue-item{display:grid;grid-template-columns:1fr auto;gap:7px;min-width:0}.hgp-queue-item span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hgp-queue-item span:last-child{color:var(--muted);font-size:10px}
      @media(max-width:980px){.hgp-kpis{grid-template-columns:repeat(3,1fr)}.hgp-kpi:nth-child(3){border-right:0}.hgp-kpi:nth-child(-n+3){border-bottom:1px solid var(--line)}.hgp-layout{grid-template-columns:minmax(0,1fr) 250px}.hgp-chart-row{grid-template-columns:1fr}.hgp-chart{border-right:0;border-bottom:1px solid var(--line)}}
      @media(max-width:720px){.hgp-head{align-items:flex-start;flex-wrap:wrap}.hgp-brand{min-width:0}.hgp-head-controls{width:100%;margin-left:0;justify-content:flex-start;flex-wrap:wrap}.hgp-layout{display:block;min-height:0}.hgp-side{border-left:0;border-top:1px solid var(--line)}.hgp-grid{display:block}.hgp-grid>.hgp-section:nth-child(odd){border-right:0}.hgp-statusbar{align-items:flex-start;flex-wrap:wrap}.hgp-statusbar [role=status]{width:100%;margin-left:0;text-align:left}}
      @media(max-width:375px){.hgp{font-size:12px}.hgp-head{padding:8px}.hgp-head-controls{display:grid;grid-template-columns:1fr 1fr}.hgp-run{grid-column:1/-1}.hgp-run button{flex:1}.hgp-export{grid-column:1/-1}.hgp-kpis{grid-template-columns:1fr 1fr}.hgp-kpi,.hgp-kpi:nth-child(3){border-right:1px solid var(--line);border-bottom:1px solid var(--line)}.hgp-kpi:nth-child(even){border-right:0}.hgp-kpi output{font-size:17px}.hgp-section,.hgp-chart,.hgp-renderer{padding:9px}.hgp-fields,.hgp-timeline-controls{grid-template-columns:1fr}.hgp-chain-row{grid-template-columns:58px minmax(0,1fr) auto}.hgp-chart canvas{height:110px}}
      @media(prefers-reduced-motion:reduce){.hgp *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
    `;
  }

  function ensureStyles(doc) {
    if (!doc || !doc.head || doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = styles();
    doc.head.appendChild(style);
  }

  function downloadText(scope, text, filename) {
    if (!scope || typeof scope.Blob !== "function" || !scope.URL || typeof scope.URL.createObjectURL !== "function") return false;
    const doc = scope.document;
    if (!doc || typeof doc.createElement !== "function") return false;
    const blob = new scope.Blob([text], { type: "application/json" });
    const url = scope.URL.createObjectURL(blob);
    const anchor = doc.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    if (typeof scope.setTimeout === "function") scope.setTimeout(() => scope.URL.revokeObjectURL(url), 0);
    else scope.URL.revokeObjectURL(url);
    return true;
  }

  function mount(target, options) {
    const settings = options && typeof options === "object" ? options : {};
    const root = typeof target === "string" && globalScope.document ? globalScope.document.querySelector(target) : target;
    if (!root || !root.ownerDocument || typeof root.querySelector !== "function") return null;
    if (mounted.has(root)) return mounted.get(root);
    const doc = root.ownerDocument;
    const host = doc.defaultView || globalScope;
    ensureStyles(doc);
    const persistence = createPersistence(settings.storage || storageFrom(host));
    let state = normalizeWorkspaceState(settings.state || persistence.load());
    let capabilities = detectCapabilities(host);
    let renderer = selectRenderer(capabilities, state.rendererPreference);
    let assets = Array.from(settings.assets || [], normalizeAsset);
    let metricsOverride = settings.metrics && typeof settings.metrics === "object" ? clone(settings.metrics) : {};
    let project = settings.project || null;
    let destroyed = false;
    let hiddenWasRunning = false;
    let timelineWindow = calculateTimelineWindow({
      duration: state.timeline.duration, pixelsPerSecond: state.timeline.pixelsPerSecond,
      scrollLeft: state.timeline.scrollLeft, viewportWidth: 600
    });
    const fpsHistory = [];
    let lastPaint = 0;

    root.setAttribute("data-graphic-performance", "");
    root.innerHTML = `
      <section class="hgp" aria-label="Performance Workspace" tabindex="0">
        <header class="hgp-head">
          <div class="hgp-brand"><span class="hgp-mark" aria-hidden="true">PERF</span><span><strong>Performance Workspace</strong><small data-hgp-renderer-label>Renderer probe pending</small></span></div>
          <div class="hgp-head-controls">
            <label class="hgp-compact">Quality<select data-hgp-quality>${Object.values(QUALITY_PRESETS).map((preset) => `<option value="${preset.id}">${preset.label}</option>`).join("")}</select></label>
            <label class="hgp-compact">Renderer<select data-hgp-renderer><option value="auto">Auto</option><option value="webgpu">WebGPU</option><option value="webgl2">WebGL2</option><option value="canvas2d">Canvas2D</option></select></label>
            <div class="hgp-run" role="group" aria-label="Live monitor"><button type="button" data-hgp-action="resume" aria-pressed="false">Resume</button><button type="button" data-hgp-action="pause" aria-pressed="true">Pause</button></div>
            <button type="button" class="hgp-export" data-hgp-action="export">Export audit JSON</button>
          </div>
        </header>
        <div class="hgp-statusbar"><span class="hgp-dot" data-hgp-dot aria-hidden="true"></span><span data-hgp-monitor-state>Paused</span><span>Local metrics only</span><span role="status" aria-live="polite" data-hgp-status>Ready</span></div>
        <div class="hgp-kpis" aria-label="Live performance metrics">
          <div class="hgp-kpi"><span>FPS</span><output data-hgp-metric="fps">N/A</output><small data-hgp-fps-samples>0 frames</small></div>
          <div class="hgp-kpi"><span>Frame p95</span><output data-hgp-metric="frame">N/A</output><small>milliseconds</small></div>
          <div class="hgp-kpi"><span>Long tasks</span><output data-hgp-metric="tasks">N/A</output><small data-hgp-task-duration>unsupported</small></div>
          <div class="hgp-kpi"><span>JS heap</span><output data-hgp-metric="heap">N/A</output><small data-hgp-heap-limit>API unavailable</small></div>
          <div class="hgp-kpi"><span>Draw calls</span><output data-hgp-metric="draws">N/A</output><small data-hgp-draw-source>renderer input</small></div>
          <div class="hgp-kpi"><span>Textures</span><output data-hgp-metric="textures">N/A</output><small data-hgp-texture-source>renderer input</small></div>
        </div>
        <div class="hgp-layout">
          <main class="hgp-main">
            <div class="hgp-chart-row">
              <section class="hgp-chart" aria-label="FPS frame chart"><div class="hgp-chart-head"><strong>Frame sampler</strong><span data-hgp-chart-label>No samples</span></div><canvas width="720" height="128" data-hgp-chart role="img" aria-label="Recent FPS samples"></canvas></section>
              <section class="hgp-renderer" aria-label="Renderer fallback"><strong data-hgp-selected>Renderer: none</strong><div class="hgp-chain" data-hgp-chain></div></section>
            </div>
            <div class="hgp-grid">
              <section class="hgp-section"><h3>Capability probe</h3><div class="hgp-cap-list" data-hgp-capabilities></div></section>
              <section class="hgp-section"><h3>Asset budget</h3><div class="hgp-budget-list"><div class="hgp-budget-line"><span>Known transfer</span><output data-hgp-budget-bytes>0 B</output></div><progress data-hgp-budget-progress value="0" max="100">0%</progress><div class="hgp-budget-line"><span>Project JSON</span><output data-hgp-project-size>N/A</output></div><div class="hgp-budget-line"><span>Texture memory</span><output data-hgp-texture-bytes>0 B</output></div></div><ul class="hgp-violations" data-hgp-violations></ul></section>
              <section class="hgp-section"><h3>Virtual timeline window</h3><div class="hgp-timeline-controls"><label class="hgp-compact">Scroll<input type="range" min="0" step="1" data-hgp-timeline-scroll></label><label class="hgp-compact">Scale<input type="number" min="1" max="10000" step="5" data-hgp-timeline-scale></label></div><div class="hgp-timeline" data-hgp-timeline><div class="hgp-window" data-hgp-window><span data-hgp-window-label></span></div></div></section>
              <section class="hgp-section"><h3>Proxy plan</h3><div class="hgp-proxy-list" data-hgp-proxies></div></section>
            </div>
          </main>
          <aside class="hgp-side" aria-label="Performance controls">
            <section class="hgp-section"><h3>Budgets</h3><div class="hgp-fields"><label class="hgp-compact">Assets MB<input type="number" min="1" max="1048576" data-hgp-budget="maxTotalBytes"></label><label class="hgp-compact">Texture MB<input type="number" min="1" max="1048576" data-hgp-budget="maxTextureBytes"></label><label class="hgp-compact">Draw calls<input type="number" min="1" max="1000000" data-hgp-budget="maxDrawCalls"></label><label class="hgp-compact">Textures<input type="number" min="1" max="100000" data-hgp-budget="maxTextures"></label></div></section>
            <section class="hgp-section"><h3>Lazy asset queue</h3><div class="hgp-queue-head"><span data-hgp-queue-summary>0 pending</span><button type="button" data-hgp-action="queue-resume">Start</button><button type="button" data-hgp-action="queue-pause">Pause</button></div><div class="hgp-queue-list" data-hgp-queue></div></section>
            <section class="hgp-section"><h3>Quality preset</h3><div class="hgp-budget-list"><div class="hgp-budget-line"><span>Target</span><output data-hgp-quality-value="targetFps"></output></div><div class="hgp-budget-line"><span>Render scale</span><output data-hgp-quality-value="renderScale"></output></div><div class="hgp-budget-line"><span>Texture edge</span><output data-hgp-quality-value="maxTextureSize"></output></div><div class="hgp-budget-line"><span>Proxy scale</span><output data-hgp-quality-value="proxyScale"></output></div></div></section>
          </aside>
        </div>
      </section>`;

    const qs = (selector) => root.querySelector(selector);
    const statusNode = qs("[data-hgp-status]");
    const chart = qs("[data-hgp-chart]");
    let chartContext = null;
    try { chartContext = chart && chart.getContext ? chart.getContext("2d") : null; } catch (_) { chartContext = null; }
    const queue = createLazyAssetQueue({
      loader: settings.assetLoader,
      concurrency: settings.assetConcurrency,
      autoStart: false,
      onChange: renderQueue
    });
    assets.forEach((asset, index) => queue.enqueue(asset, { priority: assets.length - index, visible: index < 6 }).catch(() => {}));

    function setStatus(message) {
      if (statusNode) statusNode.textContent = message;
    }

    function persist() {
      const result = persistence.save(state);
      if (!result.ok && result.reason !== "unsupported") setStatus("Local settings could not be saved.");
      return result;
    }

    function currentMetrics() {
      let provided = {};
      if (typeof settings.metricsProvider === "function") {
        try { provided = settings.metricsProvider() || {}; }
        catch (error) { setStatus(`Metrics provider failed: ${error && error.message ? error.message : "unknown error"}.`); }
      }
      return calculateProjectMetrics(project, Object.assign({}, provided, metricsOverride, { assets }));
    }

    function currentBudget(metrics) {
      return evaluateAssetBudget(assets, state.budget, metrics);
    }

    function currentProxyPlan() {
      const quality = getQualityPreset(state.qualityPreset);
      return planAssetProxies(assets, capabilities, {
        maxDimension: quality.maxTextureSize,
        maxImageBytes: state.budget.maxImageBytes,
        maxVideoBytes: state.budget.maxVideoBytes
      });
    }

    function renderCapabilities() {
      const entries = [
        ["WebGPU", capabilities.details.webgpu], ["WebGL2", capabilities.details.webgl2],
        ["Canvas2D", capabilities.details.canvas2d], ["OffscreenCanvas", capabilities.details.offscreenCanvas],
        ["Worker", capabilities.details.worker],
        ["Long tasks", capability(capabilities.longTasks, capabilities.longTasks, capabilities.longTasks ? "PerformanceObserver longtask is available." : "Long-task entries are unavailable.")],
        ["JS heap", capability(capabilities.jsHeap, capabilities.jsHeap, capabilities.jsHeap ? "performance.memory is available." : "performance.memory is unavailable.")]
      ];
      qs("[data-hgp-capabilities]").innerHTML = entries.map(([label, detail]) => {
        const stateClass = detail.usable === true ? "is-ok" : detail.usable == null ? "is-pending" : "is-off";
        const stateLabel = detail.usable === true ? "usable" : detail.usable == null ? "pending" : detail.available ? "blocked" : "unsupported";
        return `<div class="hgp-cap" title="${escapeHtml(detail.reason)}"><span>${label}</span><span class="${stateClass}">${stateLabel}</span></div>`;
      }).join("");
    }

    function renderRenderer() {
      qs("[data-hgp-selected]").textContent = `Renderer: ${renderer.selected}`;
      qs("[data-hgp-renderer-label]").textContent = renderer.selected === "none" ? "No usable renderer" : `${renderer.selected}${renderer.degraded ? " fallback" : " selected"}`;
      qs("[data-hgp-chain]").innerHTML = renderer.attempts.map((attempt) => `<div class="hgp-chain-row${attempt.renderer === renderer.selected ? " is-selected" : ""}" title="${escapeHtml(attempt.reason)}"><strong>${attempt.renderer}</strong><small>${escapeHtml(attempt.reason)}</small><span class="hgp-state${attempt.usable ? " is-ok" : ""}">${attempt.usable ? "ready" : "skip"}</span></div>`).join("");
    }

    function renderBudget(metrics) {
      const report = currentBudget(metrics);
      qs("[data-hgp-budget-bytes]").textContent = formatBytes(report.totals.totalBytes);
      const progress = qs("[data-hgp-budget-progress]");
      progress.value = Math.min(100, report.utilizationPct);
      progress.textContent = `${report.utilizationPct}%`;
      qs("[data-hgp-project-size]").textContent = formatBytes(metrics.projectSizeBytes);
      qs("[data-hgp-texture-bytes]").textContent = formatBytes(metrics.textureBytes);
      qs("[data-hgp-violations]").innerHTML = report.violations.length
        ? report.violations.slice(0, 6).map((item) => `<li>${escapeHtml(item.message)}</li>`).join("")
        : `<li class="hgp-empty">${report.status === "unknown" ? `${report.totals.unknownSizeCount} asset sizes unknown` : "Within configured budgets"}</li>`;
      return report;
    }

    function renderProxies() {
      const plan = currentProxyPlan();
      qs("[data-hgp-proxies]").innerHTML = plan.plans.length
        ? plan.plans.slice(0, 8).map((item, index) => `<div class="hgp-proxy" title="${escapeHtml(item.reason)}"><strong>${escapeHtml(assets[index] ? assets[index].name : item.assetId)}</strong><span class="is-${item.status}">${item.status}</span></div>`).join("")
        : `<p class="hgp-empty">No assets in inventory</p>`;
      return plan;
    }

    function renderQuality() {
      const preset = getQualityPreset(state.qualityPreset);
      qs("[data-hgp-quality]").value = state.qualityPreset;
      qs("[data-hgp-renderer]").value = state.rendererPreference;
      root.querySelectorAll("[data-hgp-quality-value]").forEach((node) => {
        const key = node.dataset.hgpQualityValue;
        node.textContent = key === "targetFps" ? `${preset[key]} FPS` : key === "maxTextureSize" ? `${preset[key]} px` : `${preset[key]}x`;
      });
      root.querySelectorAll("[data-hgp-budget]").forEach((input) => {
        const value = state.budget[input.dataset.hgpBudget];
        input.value = input.dataset.hgpBudget.endsWith("Bytes") ? Math.round(value / MIB) : value;
      });
    }

    function updateTimeline() {
      const timeline = qs("[data-hgp-timeline]");
      const viewportWidth = Math.max(1, timeline.clientWidth || 600);
      const maxScroll = Math.max(0, state.timeline.duration * state.timeline.pixelsPerSecond - viewportWidth);
      state.timeline.scrollLeft = clamp(state.timeline.scrollLeft, 0, maxScroll, 0);
      timelineWindow = calculateTimelineWindow({
        duration: state.timeline.duration,
        pixelsPerSecond: state.timeline.pixelsPerSecond,
        scrollLeft: state.timeline.scrollLeft,
        viewportWidth,
        overscanPx: viewportWidth * 0.5
      });
      const scroll = qs("[data-hgp-timeline-scroll]");
      scroll.max = Math.max(0, Math.round(maxScroll));
      scroll.value = Math.round(state.timeline.scrollLeft);
      qs("[data-hgp-timeline-scale]").value = state.timeline.pixelsPerSecond;
      const windowNode = qs("[data-hgp-window]");
      windowNode.style.left = `${Math.max(0, (timelineWindow.offsetPx - state.timeline.scrollLeft) / Math.max(1, timelineWindow.totalWidth) * viewportWidth)}px`;
      windowNode.style.width = `${Math.max(2, timelineWindow.widthPx / Math.max(1, timelineWindow.totalWidth) * viewportWidth)}px`;
      qs("[data-hgp-window-label]").textContent = `${timelineWindow.startTime.toFixed(1)}s - ${timelineWindow.endTime.toFixed(1)}s`;
    }

    function drawChart() {
      if (!chartContext || !chart) return;
      const rect = chart.getBoundingClientRect();
      const ratio = Math.min(2, host.devicePixelRatio || 1);
      const width = Math.max(1, Math.round((rect.width || 720) * ratio));
      const height = Math.max(1, Math.round((rect.height || 128) * ratio));
      if (chart.width !== width || chart.height !== height) { chart.width = width; chart.height = height; }
      const context = chartContext;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const cssWidth = width / ratio;
      const cssHeight = height / ratio;
      context.clearRect(0, 0, cssWidth, cssHeight);
      context.fillStyle = "#070c12";
      context.fillRect(0, 0, cssWidth, cssHeight);
      context.strokeStyle = "#263746";
      context.lineWidth = 1;
      [30, 60].forEach((fps) => {
        const y = cssHeight - fps / 75 * cssHeight;
        context.beginPath(); context.moveTo(0, y); context.lineTo(cssWidth, y); context.stroke();
      });
      if (!fpsHistory.length) return;
      context.strokeStyle = "#b9e769";
      context.lineWidth = 2;
      context.beginPath();
      fpsHistory.forEach((fps, index) => {
        const x = fpsHistory.length === 1 ? cssWidth : index / (fpsHistory.length - 1) * cssWidth;
        const y = cssHeight - clamp(fps, 0, 75, 0) / 75 * cssHeight;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.stroke();
    }

    function renderQueue(snapshot) {
      if (destroyed || !root.isConnected && !root.ownerDocument) return;
      const value = snapshot || queue.getSnapshot();
      const summary = qs("[data-hgp-queue-summary]");
      if (!summary) return;
      summary.textContent = value.supported ? `${value.pending} pending / ${value.loading} loading` : "No asset loader";
      qs("[data-hgp-action=\"queue-resume\"]").disabled = !value.supported || !value.paused;
      qs("[data-hgp-action=\"queue-pause\"]").disabled = !value.supported || value.paused;
      qs("[data-hgp-queue]").innerHTML = value.items.length
        ? value.items.slice(0, 10).map((item) => `<div class="hgp-queue-item"><span>${escapeHtml(item.name)}</span><span>${item.status}</span></div>`).join("")
        : `<p class="hgp-empty">Queue is empty</p>`;
    }

    function renderLive(snapshot, force) {
      const now = host.performance && typeof host.performance.now === "function" ? host.performance.now() : Date.now();
      if (!force && now - lastPaint < 250) return;
      lastPaint = now;
      const live = snapshot || monitor.getSnapshot();
      const fps = live.fps;
      const longTasks = live.longTasks;
      const heap = live.heap;
      const metrics = currentMetrics();
      if (fps.fps != null) { fpsHistory.push(fps.fps); if (fpsHistory.length > 90) fpsHistory.shift(); }
      qs("[data-hgp-metric=\"fps\"]").textContent = fps.fps == null ? "N/A" : fps.fps.toFixed(1);
      qs("[data-hgp-metric=\"frame\"]").textContent = fps.p95FrameMs == null ? "N/A" : fps.p95FrameMs.toFixed(1);
      qs("[data-hgp-fps-samples]").textContent = `${fps.sampledFrames} frames`;
      qs("[data-hgp-metric=\"tasks\"]").textContent = longTasks.supported ? String(longTasks.count) : "N/A";
      qs("[data-hgp-task-duration]").textContent = longTasks.supported ? `${longTasks.totalDurationMs.toFixed(0)} ms total` : "unsupported";
      qs("[data-hgp-metric=\"heap\"]").textContent = heap.supported ? formatBytes(heap.usedBytes) : "N/A";
      qs("[data-hgp-heap-limit]").textContent = heap.supported ? `${heap.utilizationPct == null ? "limit unknown" : `${heap.utilizationPct}% of limit`}` : "API unavailable";
      qs("[data-hgp-metric=\"draws\"]").textContent = metrics.drawCalls == null ? "N/A" : String(metrics.drawCalls);
      qs("[data-hgp-draw-source]").textContent = metrics.drawCallSource;
      qs("[data-hgp-metric=\"textures\"]").textContent = metrics.textures == null ? "N/A" : String(metrics.textures);
      qs("[data-hgp-texture-source]").textContent = metrics.textureSource;
      qs("[data-hgp-chart-label]").textContent = fps.fps == null ? "No samples" : `${fps.fps.toFixed(1)} FPS / ${fps.p95FrameMs.toFixed(1)} ms p95`;
      renderBudget(metrics);
      drawChart();
    }

    function renderRunState() {
      const running = monitor.isRunning();
      qs("[data-hgp-action=\"resume\"]").setAttribute("aria-pressed", String(running));
      qs("[data-hgp-action=\"pause\"]").setAttribute("aria-pressed", String(!running));
      qs("[data-hgp-action=\"resume\"]").disabled = running || !capabilities.animationFrame;
      qs("[data-hgp-action=\"pause\"]").disabled = !running;
      qs("[data-hgp-monitor-state]").textContent = running ? "Sampling" : "Paused";
      qs("[data-hgp-dot]").classList.toggle("is-running", running);
    }

    const monitor = createPerformanceMonitor(host, {
      targetFps: getQualityPreset(state.qualityPreset).targetFps,
      onSample: (snapshot) => renderLive(snapshot, false)
    });

    function pause(userInitiated) {
      monitor.pause();
      if (userInitiated !== false) { state.monitoringPaused = true; persist(); }
      renderRunState();
      renderLive(null, true);
      setStatus("Live sampling paused.");
      return true;
    }

    function resume(userInitiated) {
      const started = monitor.resume();
      if (started && userInitiated !== false) { state.monitoringPaused = false; persist(); }
      renderRunState();
      setStatus(started ? "Live sampling active." : "requestAnimationFrame is unavailable.");
      return started;
    }

    function buildAudit() {
      const metrics = currentMetrics();
      return createAudit({
        workspaceName: settings.workspaceName,
        capabilities,
        renderer,
        monitoring: monitor.getSnapshot(),
        metrics,
        assets,
        budget: state.budget,
        budgetReport: currentBudget(metrics),
        proxyPlan: currentProxyPlan(),
        timelineWindow,
        qualityPreset: state.qualityPreset
      });
    }

    function exportAudit() {
      return exportAuditJSON(buildAudit());
    }

    function downloadAudit() {
      const ok = downloadText(host, exportAudit(), "hh-performance-audit.json");
      setStatus(ok ? "Audit JSON exported." : "JSON download is unsupported; use controller.exportAudit().");
      return ok;
    }

    function renderStatic() {
      renderer = selectRenderer(capabilities, state.rendererPreference);
      renderCapabilities();
      renderRenderer();
      renderQuality();
      renderProxies();
      updateTimeline();
      renderQueue();
      renderLive(null, true);
      renderRunState();
    }

    function onClick(event) {
      const button = event.target.closest("[data-hgp-action]");
      if (!button || !root.contains(button)) return;
      const action = button.dataset.hgpAction;
      if (action === "pause") pause(true);
      else if (action === "resume") resume(true);
      else if (action === "export") downloadAudit();
      else if (action === "queue-resume") { const result = queue.resume(); setStatus(result ? "Lazy queue started." : "No asset loader was provided."); }
      else if (action === "queue-pause") { queue.pause(); setStatus("Lazy queue paused."); }
    }

    function onChange(event) {
      const targetNode = event.target;
      if (targetNode.matches("[data-hgp-quality]")) {
        state.qualityPreset = Object.prototype.hasOwnProperty.call(QUALITY_PRESETS, targetNode.value) ? targetNode.value : "balanced";
        renderQuality(); renderProxies(); persist(); setStatus("Quality preset updated.");
      } else if (targetNode.matches("[data-hgp-renderer]")) {
        state.rendererPreference = targetNode.value;
        renderer = selectRenderer(capabilities, state.rendererPreference);
        renderRenderer(); persist(); setStatus(`Renderer strategy selected ${renderer.selected}.`);
      } else if (targetNode.matches("[data-hgp-budget]")) {
        const key = targetNode.dataset.hgpBudget;
        const value = Math.max(1, numberOr(targetNode.value, 1));
        state.budget[key] = key.endsWith("Bytes") ? value * MIB : Math.round(value);
        state.budget = normalizeBudget(state.budget);
        renderLive(null, true); renderProxies(); persist(); setStatus("Budget updated.");
      } else if (targetNode.matches("[data-hgp-timeline-scale]")) {
        state.timeline.pixelsPerSecond = clamp(targetNode.value, 1, 10000, 40);
        updateTimeline(); persist();
      }
    }

    function onInput(event) {
      if (!event.target.matches("[data-hgp-timeline-scroll]")) return;
      state.timeline.scrollLeft = Math.max(0, numberOr(event.target.value, 0));
      updateTimeline();
    }

    function isTypingTarget(node) {
      return node && (node.isContentEditable || ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(node.tagName));
    }

    function onKeyDown(event) {
      if (isTypingTarget(event.target)) return;
      if (event.key === " " || event.key.toLowerCase() === "p") {
        event.preventDefault();
        if (monitor.isRunning()) pause(true); else resume(true);
      } else if (event.key.toLowerCase() === "e") {
        event.preventDefault(); downloadAudit();
      } else if (event.key === "Escape") pause(true);
    }

    function onVisibilityChange() {
      if (doc.hidden) {
        hiddenWasRunning = monitor.isRunning();
        if (hiddenWasRunning) pause(false);
      } else if (hiddenWasRunning) {
        hiddenWasRunning = false;
        resume(false);
      }
    }

    let resizeObserver = null;
    if (typeof host.ResizeObserver === "function") {
      resizeObserver = new host.ResizeObserver(() => { updateTimeline(); drawChart(); });
      resizeObserver.observe(qs("[data-hgp-timeline]"));
      resizeObserver.observe(chart);
    }

    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    root.addEventListener("input", onInput);
    root.addEventListener("keydown", onKeyDown);
    doc.addEventListener("visibilitychange", onVisibilityChange);
    renderStatic();

    if (capabilities.reducedMotion) { pause(false); setStatus("Reduced motion is active; live sampling starts paused."); }
    else if (settings.autoplay === false || state.monitoringPaused) pause(false);
    else resume(false);

    probeCapabilities(host).then((result) => {
      if (destroyed) return;
      capabilities = result;
      renderer = selectRenderer(capabilities, state.rendererPreference);
      renderCapabilities(); renderRenderer(); renderProxies(); renderRunState();
      setStatus(capabilities.webgpuUsable ? "WebGPU adapter confirmed." : `Renderer ready: ${renderer.selected}.`);
    });

    const controller = {
      getCapabilities: () => clone(capabilities),
      getRendererStrategy: () => clone(renderer),
      getState: () => clone(state),
      getSnapshot: () => ({ monitoring: monitor.getSnapshot(), metrics: currentMetrics(), queue: queue.getSnapshot(), timelineWindow: clone(timelineWindow) }),
      setMetrics(next) { metricsOverride = next && typeof next === "object" ? clone(next) : {}; renderLive(null, true); return currentMetrics(); },
      setProject(next) { project = next || null; renderLive(null, true); return currentMetrics(); },
      setAssets(next) {
        assets = Array.from(next || [], normalizeAsset);
        queue.clear();
        assets.forEach((asset, index) => queue.enqueue(asset, { priority: assets.length - index, visible: index < 6 }).catch(() => {}));
        renderProxies(); renderLive(null, true); renderQueue();
        return clone(assets);
      },
      pause: () => pause(true),
      resume: () => resume(true),
      isPaused: () => !monitor.isRunning(),
      exportAudit,
      downloadAudit,
      queue,
      destroy() {
        if (destroyed) return false;
        destroyed = true;
        monitor.destroy(); queue.destroy();
        if (resizeObserver) resizeObserver.disconnect();
        root.removeEventListener("click", onClick);
        root.removeEventListener("change", onChange);
        root.removeEventListener("input", onInput);
        root.removeEventListener("keydown", onKeyDown);
        doc.removeEventListener("visibilitychange", onVisibilityChange);
        root.removeAttribute("data-graphic-performance");
        root.innerHTML = "";
        mounted.delete(root);
        return true;
      }
    };
    mounted.set(root, controller);
    return controller;
  }

  function unmount(target) {
    const root = typeof target === "string" && globalScope.document ? globalScope.document.querySelector(target) : target;
    const controller = root && mounted.get(root);
    return controller ? controller.destroy() : false;
  }

  function mountAll(scope) {
    const doc = scope && typeof scope.querySelectorAll === "function" ? scope : globalScope.document;
    if (!doc || typeof doc.querySelectorAll !== "function") return [];
    return Array.from(doc.querySelectorAll("[data-graphic-performance]"), (root) => mount(root)).filter(Boolean);
  }

  const api = Object.freeze({
    VERSION, FORMAT, STATE_FORMAT, STORAGE_KEY, DEFAULT_BUDGET, QUALITY_PRESETS,
    formatBytes, detectCapabilities, probeCapabilities, selectRenderer, createRendererStrategy: selectRenderer,
    createFrameSampler, createLongTaskObserver, readHeapMetrics, createPerformanceMonitor,
    assetKind, normalizeAsset, normalizeBudget, evaluateAssetBudget, assetBudget: evaluateAssetBudget,
    planAssetProxy, planAssetProxies, calculateTimelineWindow, calculateVirtualTimelineWindow: calculateTimelineWindow,
    calculateVirtualListWindow, createLazyAssetQueue, calculateProjectMetrics, collectMetrics: calculateProjectMetrics,
    getQualityPreset, applyQualityPreset, recommendQualityPreset,
    createAudit, exportAuditJSON, exportAudit: exportAuditJSON,
    createDefaultState, normalizeWorkspaceState, saveWorkspaceState, loadWorkspaceState, createPersistence,
    mount, unmount, mountAll
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.HHGraphicPerformance = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
