(function (root, factory) {
  "use strict";
  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHHomeHealthFocus = api;
  if (root?.document) api.autoMount();
})(typeof globalThis !== "undefined" ? globalThis : this, function (globalScope) {
  "use strict";

  const VERSION = "1.0.0";
  const HEALTH_STORAGE_KEY = "hh.home.health.samples.v1";
  const FOCUS_STORAGE_KEY = "hh.home.focus.v1";
  const TODO_STORAGE_KEY = "hh.command-center.todos.v2";
  const MAX_SAMPLES = 36;
  const FOCUS_SECONDS = 25 * 60;
  const BREAK_SECONDS = 5 * 60;
  const mounted = new WeakMap();

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
  const formatClock = (seconds) => {
    const safe = Math.max(0, Math.round(Number(seconds) || 0));
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  };
  const formatLatency = (value) => Number.isFinite(Number(value)) ? `${Math.round(Number(value))} ms` : "Chưa đo";
  const formatBytes = (value) => {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return "Không hỗ trợ";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let amount = bytes;
    let index = 0;
    while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index += 1; }
    return `${amount >= 100 || index === 0 ? Math.round(amount) : amount.toFixed(1)} ${units[index]}`;
  };
  const dayKey = (time = Date.now()) => new Date(time).toISOString().slice(0, 10);

  function createStorageAdapter(storage) {
    const source = storage || globalScope.localStorage;
    return {
      get(key, fallback) {
        try {
          const value = source?.getItem?.(key);
          return value == null ? fallback : JSON.parse(value);
        } catch { return fallback; }
      },
      set(key, value) {
        try { source?.setItem?.(key, JSON.stringify(value)); return true; }
        catch { return false; }
      }
    };
  }

  function normalizedBase(value) {
    return String(value || "").trim().replace(/\/$/, "");
  }

  function buildEndpointPlan(scope = globalScope, options = {}) {
    const location = options.location || scope.location || { origin: "" };
    const currentOrigin = normalizedBase(options.origin || location.origin);
    const realtimeOrigin = normalizedBase(options.apiBase || scope.HH_REALTIME_URL || currentOrigin);
    const candidates = [
      { id: "frontend", label: "Website", group: "Frontend", url: `${currentOrigin || ""}/`, public: true },
      { id: "providers", label: "Đăng nhập", group: "Authentication", url: `${realtimeOrigin}/api/auth/providers`, public: true },
      { id: "session", label: "Phiên tài khoản", group: "Authentication", url: `${realtimeOrigin}/api/auth/me`, protected: true },
      { id: "public-api", label: "API công khai", group: "Backend", url: `${realtimeOrigin}/api/store/products`, public: true }
    ];
    const seen = new Set();
    return candidates.filter((endpoint) => {
      if (!endpoint.url || seen.has(endpoint.url)) return false;
      seen.add(endpoint.url);
      try { new URL(endpoint.url, currentOrigin || "http://localhost"); return true; }
      catch { return false; }
    });
  }

  function classifyHttpStatus(status, endpoint = {}) {
    const code = Number(status) || 0;
    if (code >= 200 && code < 400) return { state: "online", reachable: true, label: "Hoạt động" };
    if ([401, 403].includes(code) && endpoint.protected) return { state: "online", reachable: true, label: "Có bảo vệ" };
    if (code === 429) return { state: "limited", reachable: true, label: "Đang giới hạn" };
    if (code >= 400 && code < 500) return { state: "degraded", reachable: true, label: `HTTP ${code}` };
    if (code >= 500) return { state: "offline", reachable: false, label: `HTTP ${code}` };
    return { state: "offline", reachable: false, label: "Không kết nối" };
  }

  async function probeEndpoint(endpoint, options = {}) {
    const fetchImpl = options.fetchImpl || globalScope.fetch;
    const performanceApi = options.performance || globalScope.performance;
    const timeoutMs = clamp(options.timeoutMs || 6500, 500, 30000);
    const started = performanceApi?.now?.() ?? Date.now();
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const currentOrigin = normalizedBase(options.origin || globalScope.location?.origin);
    let targetOrigin = "";
    try { targetOrigin = new URL(endpoint.url, currentOrigin || undefined).origin; } catch {}
    try {
      if (typeof fetchImpl !== "function") throw new Error("FETCH_UNSUPPORTED");
      const response = await fetchImpl(endpoint.url, {
        method: "GET",
        cache: "no-store",
        credentials: targetOrigin && targetOrigin === currentOrigin ? "include" : "omit",
        headers: { Accept: "application/json, text/plain, */*" },
        signal: controller?.signal
      });
      const ended = performanceApi?.now?.() ?? Date.now();
      const classification = classifyHttpStatus(response.status, endpoint);
      return {
        id: endpoint.id,
        label: endpoint.label,
        group: endpoint.group,
        url: endpoint.url,
        status: Number(response.status),
        latency: Math.max(0, ended - started),
        checkedAt: new Date().toISOString(),
        source: "timed-fetch",
        state: classification.state,
        reachable: classification.reachable,
        resultLabel: classification.label
      };
    } catch (error) {
      const ended = performanceApi?.now?.() ?? Date.now();
      const aborted = error?.name === "AbortError";
      return {
        id: endpoint.id,
        label: endpoint.label,
        group: endpoint.group,
        url: endpoint.url,
        status: 0,
        latency: Math.max(0, ended - started),
        checkedAt: new Date().toISOString(),
        source: "timed-fetch",
        state: "offline",
        reachable: false,
        labelState: aborted ? "Quá thời gian" : "Không kết nối",
        label: endpoint.label,
        resultLabel: aborted ? "Quá thời gian" : "Không kết nối",
        error: aborted ? "TIMEOUT" : String(error?.message || "NETWORK_ERROR")
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function normalizeHealthHistory(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const endpoints = {};
    Object.entries(source.endpoints || {}).forEach(([id, samples]) => {
      endpoints[id] = Array.isArray(samples) ? samples.filter((sample) => sample && Number.isFinite(Number(sample.latency))).slice(-MAX_SAMPLES) : [];
    });
    return { version: 1, endpoints, updatedAt: source.updatedAt || null };
  }

  function healthSummary(results) {
    const items = Array.isArray(results) ? results : [];
    const reachable = items.filter((item) => item.reachable).length;
    const online = items.filter((item) => item.state === "online").length;
    const measured = items.filter((item) => Number.isFinite(Number(item.latency)));
    const averageLatency = measured.length ? measured.reduce((sum, item) => sum + Number(item.latency), 0) / measured.length : null;
    const state = !items.length ? "unknown" : online === items.length ? "online" : reachable ? "degraded" : "offline";
    return { total: items.length, reachable, online, averageLatency, state };
  }

  function createHealthMonitor(options = {}) {
    const scope = options.scope || globalScope;
    const storage = createStorageAdapter(options.storage || scope.localStorage);
    const history = normalizeHealthHistory(storage.get(HEALTH_STORAGE_KEY, null));
    const endpoints = options.endpoints || buildEndpointPlan(scope, options);
    const listeners = new Set();
    let latest = [];
    let running = false;
    let intervalId = null;

    function snapshot() {
      return { endpoints: endpoints.slice(), latest: latest.slice(), history: normalizeHealthHistory(history), summary: healthSummary(latest), running };
    }
    function emit() {
      const data = snapshot();
      listeners.forEach((listener) => listener(data));
      options.onUpdate?.(data);
      return data;
    }
    async function check() {
      if (running) return snapshot();
      running = true;
      emit();
      latest = await Promise.all(endpoints.map((endpoint) => probeEndpoint(endpoint, {
        fetchImpl: options.fetchImpl || scope.fetch?.bind?.(scope) || scope.fetch,
        performance: options.performance || scope.performance,
        timeoutMs: options.timeoutMs,
        origin: options.origin || scope.location?.origin
      })));
      latest.forEach((sample) => {
        history.endpoints[sample.id] ||= [];
        history.endpoints[sample.id].push({ latency: Math.round(sample.latency), status: sample.status, state: sample.state, at: sample.checkedAt });
        history.endpoints[sample.id] = history.endpoints[sample.id].slice(-MAX_SAMPLES);
      });
      history.updatedAt = new Date().toISOString();
      storage.set(HEALTH_STORAGE_KEY, history);
      running = false;
      return emit();
    }
    function start(intervalMs = 60000) {
      check();
      if (!intervalId && typeof scope.setInterval === "function") intervalId = scope.setInterval(check, Math.max(15000, Number(intervalMs) || 60000));
      return snapshot();
    }
    function stop() {
      if (intervalId) scope.clearInterval?.(intervalId);
      intervalId = null;
      running = false;
    }
    return {
      check, start, stop, snapshot,
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
    };
  }

  function performanceRating(name, value) {
    const metric = String(name || "").toUpperCase();
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "unknown";
    const thresholds = {
      LCP: [2500, 4000], INP: [200, 500], CLS: [0.1, 0.25], FCP: [1800, 3000], TTFB: [800, 1800]
    }[metric];
    if (!thresholds) return "unknown";
    return amount <= thresholds[0] ? "good" : amount <= thresholds[1] ? "needs-improvement" : "poor";
  }

  function createVitalsMonitor(options = {}) {
    const scope = options.scope || globalScope;
    const PerformanceObserverType = options.PerformanceObserver || scope.PerformanceObserver;
    const performanceApi = options.performance || scope.performance;
    const metrics = {};
    const observers = [];
    const listeners = new Set();
    const supported = Array.isArray(PerformanceObserverType?.supportedEntryTypes) ? PerformanceObserverType.supportedEntryTypes : [];

    function setMetric(name, value, source = "PerformanceObserver") {
      if (!Number.isFinite(Number(value))) return;
      const normalized = name === "CLS" ? Number(Number(value).toFixed(4)) : Math.round(Number(value));
      metrics[name] = { name, value: normalized, rating: performanceRating(name, normalized), source, measuredAt: new Date().toISOString() };
      listeners.forEach((listener) => listener(getMetrics()));
      options.onUpdate?.(getMetrics());
    }
    function observe(type, callback, extra = {}) {
      if (!PerformanceObserverType || !supported.includes(type)) return false;
      try {
        const observer = new PerformanceObserverType((list) => callback(list.getEntries()));
        observer.observe({ type, buffered: true, ...extra });
        observers.push(observer);
        return true;
      } catch { return false; }
    }
    function start() {
      const navigation = performanceApi?.getEntriesByType?.("navigation")?.[0];
      if (navigation && Number.isFinite(navigation.responseStart)) setMetric("TTFB", navigation.responseStart, "Navigation Timing");
      const firstPaint = performanceApi?.getEntriesByName?.("first-contentful-paint")?.[0];
      if (firstPaint) setMetric("FCP", firstPaint.startTime, "Paint Timing");
      observe("paint", (entries) => {
        const item = entries.find((entry) => entry.name === "first-contentful-paint");
        if (item) setMetric("FCP", item.startTime);
      });
      observe("largest-contentful-paint", (entries) => {
        const item = entries.at?.(-1) || entries[entries.length - 1];
        if (item) setMetric("LCP", item.startTime);
      });
      let cls = Number(metrics.CLS?.value || 0);
      observe("layout-shift", (entries) => {
        entries.forEach((entry) => { if (!entry.hadRecentInput) cls += Number(entry.value || 0); });
        setMetric("CLS", cls);
      });
      let inp = Number(metrics.INP?.value || 0);
      observe("event", (entries) => {
        entries.forEach((entry) => { inp = Math.max(inp, Number(entry.duration || 0)); });
        if (inp) setMetric("INP", inp);
      }, { durationThreshold: 40 });
      return getSupport();
    }
    function stop() { observers.splice(0).forEach((observer) => observer.disconnect?.()); }
    function getMetrics() { return Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, { ...value }])); }
    function getSupport() {
      return { observer: Boolean(PerformanceObserverType), entryTypes: supported.slice(), coreWebVitals: supported.some((type) => ["largest-contentful-paint", "layout-shift", "event"].includes(type)) };
    }
    return { start, stop, getMetrics, getSupport, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
  }

  function measureFps(scope = globalScope, durationMs = 900) {
    return new Promise((resolve) => {
      if (typeof scope.requestAnimationFrame !== "function" || scope.document?.hidden) return resolve({ supported: false, value: null, source: "requestAnimationFrame" });
      const started = scope.performance?.now?.() ?? Date.now();
      let frames = 0;
      function frame(now) {
        frames += 1;
        const elapsed = now - started;
        if (elapsed >= durationMs) resolve({ supported: true, value: Math.round((frames * 1000) / elapsed), source: "requestAnimationFrame" });
        else scope.requestAnimationFrame(frame);
      }
      scope.requestAnimationFrame(frame);
    });
  }

  async function readBrowserSnapshot(scope = globalScope, options = {}) {
    const navigatorApi = options.navigator || scope.navigator || {};
    const performanceApi = options.performance || scope.performance || {};
    const connection = navigatorApi.connection || navigatorApi.mozConnection || navigatorApi.webkitConnection;
    const heap = performanceApi.memory ? {
      supported: true,
      used: Number(performanceApi.memory.usedJSHeapSize),
      limit: Number(performanceApi.memory.jsHeapSizeLimit),
      source: "performance.memory (JS heap)"
    } : { supported: false, used: null, limit: null, source: "unsupported" };
    let storage = { supported: false, usage: null, quota: null, source: "unsupported" };
    try {
      if (typeof navigatorApi.storage?.estimate === "function") {
        const estimate = await navigatorApi.storage.estimate();
        storage = { supported: true, usage: Number(estimate.usage || 0), quota: Number(estimate.quota || 0), source: "StorageManager.estimate" };
      }
    } catch {}
    const fps = await measureFps(scope, options.fpsDuration || 900);
    return {
      online: navigatorApi.onLine !== false,
      network: connection ? {
        supported: true,
        effectiveType: connection.effectiveType || "không rõ",
        downlink: Number.isFinite(Number(connection.downlink)) ? Number(connection.downlink) : null,
        rtt: Number.isFinite(Number(connection.rtt)) ? Number(connection.rtt) : null,
        saveData: Boolean(connection.saveData),
        source: "Network Information API"
      } : { supported: false, source: "unsupported" },
      heap, storage, fps
    };
  }

  function normalizeFocusState(raw, now = Date.now()) {
    const source = raw && typeof raw === "object" ? raw : {};
    const phase = source.phase === "break" ? "break" : "focus";
    const duration = phase === "break" ? BREAK_SECONDS : FOCUS_SECONDS;
    const remaining = Number(source.remainingSeconds);
    const endAt = Number(source.endAt) || null;
    return {
      version: 1,
      active: Boolean(source.active),
      quiet: source.quiet !== false,
      running: Boolean(source.running && endAt),
      phase,
      remainingSeconds: Number.isFinite(remaining) && remaining > 0 ? clamp(remaining, 1, duration) : duration,
      endAt,
      taskId: String(source.taskId || ""),
      taskTitle: String(source.taskTitle || "").slice(0, 180),
      stats: {
        days: source.stats?.days && typeof source.stats.days === "object" ? source.stats.days : {},
        completed: Math.max(0, Number(source.stats?.completed) || 0)
      },
      updatedAt: Number(source.updatedAt) || now
    };
  }

  function focusStats(state, now = Date.now()) {
    const keys = Object.keys(state.stats.days || {}).sort();
    const today = dayKey(now);
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 6);
    const weekSeconds = keys.reduce((sum, key) => new Date(`${key}T00:00:00`).getTime() >= weekStart.getTime() ? sum + Number(state.stats.days[key]?.seconds || 0) : sum, 0);
    let streak = 0;
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    while (state.stats.days[dayKey(cursor.getTime())]?.seconds > 0) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
    return {
      todaySeconds: Number(state.stats.days[today]?.seconds || 0),
      weekSeconds,
      completed: Number(state.stats.completed || 0),
      streak
    };
  }

  function createFocusController(options = {}) {
    const scope = options.scope || globalScope;
    const storage = createStorageAdapter(options.storage || scope.localStorage);
    const now = () => Number(options.now?.() ?? Date.now());
    let state = normalizeFocusState(storage.get(FOCUS_STORAGE_KEY, null), now());
    let intervalId = null;
    const listeners = new Set();

    function phaseDuration(phase = state.phase) { return phase === "break" ? BREAK_SECONDS : FOCUS_SECONDS; }
    function persist() { state.updatedAt = now(); storage.set(FOCUS_STORAGE_KEY, state); }
    function snapshot() { return { ...state, stats: { ...state.stats, days: { ...state.stats.days } }, summary: focusStats(state, now()) }; }
    function emit(reason = "update") {
      persist();
      const detail = { ...snapshot(), reason };
      listeners.forEach((listener) => listener(detail));
      options.onUpdate?.(detail);
      return detail;
    }
    function dispatch(active, reason) {
      const body = options.body || scope.document?.body;
      body?.classList?.toggle("hh-focus-mode", active);
      if (body?.dataset) body.dataset.hhFocusMode = active ? "true" : "false";
      const EventType = scope.CustomEvent || globalScope.CustomEvent;
      if (typeof scope.dispatchEvent === "function" && typeof EventType === "function") {
        scope.dispatchEvent(new EventType("hh:focus-mode-change", { detail: { active, quiet: state.quiet, task: state.taskTitle, reason } }));
        scope.dispatchEvent(new EventType("hh:notifications-quiet", { detail: { quiet: active && state.quiet, source: "home-focus-mode", reason } }));
      }
    }
    function addElapsed(seconds) {
      const amount = Math.max(0, Math.floor(Number(seconds) || 0));
      if (!amount || state.phase !== "focus") return;
      const key = dayKey(now());
      const current = state.stats.days[key] || { seconds: 0, completed: 0 };
      state.stats.days[key] = { ...current, seconds: Number(current.seconds || 0) + amount };
    }
    function syncTime(reason = "tick") {
      if (!state.running || !state.endAt) return snapshot();
      const previous = state.remainingSeconds;
      const next = Math.max(0, Math.ceil((state.endAt - now()) / 1000));
      addElapsed(Math.min(previous, Math.max(0, previous - next)));
      state.remainingSeconds = next;
      if (next <= 0) {
        if (state.phase === "focus") {
          state.stats.completed += 1;
          const key = dayKey(now());
          state.stats.days[key] = { ...(state.stats.days[key] || {}), seconds: Number(state.stats.days[key]?.seconds || 0), completed: Number(state.stats.days[key]?.completed || 0) + 1 };
        }
        state.phase = state.phase === "focus" ? "break" : "focus";
        state.remainingSeconds = phaseDuration();
        state.running = false;
        state.endAt = null;
        dispatch(state.active, "phase-complete");
        return emit("phase-complete");
      }
      return emit(reason);
    }
    function ensureTimer() {
      if (!state.running || intervalId || typeof scope.setInterval !== "function") return;
      intervalId = scope.setInterval(() => syncTime("tick"), 1000);
    }
    function stopTimer() { if (intervalId) scope.clearInterval?.(intervalId); intervalId = null; }
    function restore() {
      if (state.running) syncTime("restore");
      if (state.running) ensureTimer();
      if (state.active) dispatch(true, "restore");
      return snapshot();
    }
    function selectTask(taskId, taskTitle) { state.taskId = String(taskId || ""); state.taskTitle = String(taskTitle || "").trim().slice(0, 180); return emit("task-change"); }
    function setQuiet(value) { state.quiet = Boolean(value); if (state.active) dispatch(true, "quiet-change"); return emit("quiet-change"); }
    function enter() { state.active = true; dispatch(true, "enter"); return emit("enter"); }
    function exit() { syncTime("exit-sync"); state.active = false; state.running = false; state.endAt = null; stopTimer(); dispatch(false, "exit"); return emit("exit"); }
    function toggle() {
      syncTime("toggle-sync");
      state.running = !state.running;
      state.endAt = state.running ? now() + state.remainingSeconds * 1000 : null;
      if (state.running) { state.active = true; dispatch(true, "start"); ensureTimer(); }
      else stopTimer();
      return emit(state.running ? "start" : "pause");
    }
    function reset() { state.running = false; state.endAt = null; state.remainingSeconds = phaseDuration(); stopTimer(); return emit("reset"); }
    function skip() {
      syncTime("skip-sync");
      state.running = false; state.endAt = null; state.phase = state.phase === "focus" ? "break" : "focus"; state.remainingSeconds = phaseDuration(); stopTimer();
      return emit("skip");
    }
    function destroy() {
      syncTime("destroy");
      stopTimer();
      if (state.active) dispatch(false, "unmount");
      listeners.clear();
    }
    restore();
    return { enter, exit, toggle, reset, skip, restore, selectTask, setQuiet, snapshot, syncTime, destroy, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
  }

  function readTasks(storage) {
    return createStorageAdapter(storage).get(TODO_STORAGE_KEY, []).filter((task) => task && !task.completed && String(task.title || "").trim()).slice(0, 30);
  }

  function sampleBars(samples) {
    if (!samples?.length) return `<span class="hhhf-empty-bars">Chưa có mẫu</span>`;
    const max = Math.max(100, ...samples.map((sample) => Number(sample.latency) || 0));
    return samples.slice(-12).map((sample) => `<i class="is-${escapeHtml(sample.state || "unknown")}" style="--bar:${Math.max(8, Math.round((Number(sample.latency || 0) / max) * 100))}%" title="${escapeHtml(`${Math.round(sample.latency || 0)} ms · ${sample.state || "unknown"}`)}"></i>`).join("");
  }

  function healthMarkup(view) {
    const summary = view.summary || healthSummary([]);
    const history = view.history || { endpoints: {} };
    const services = (view.latest?.length ? view.latest : view.endpoints.map((endpoint) => ({ ...endpoint, state: "unknown", status: 0, resultLabel: "Chưa kiểm tra", latency: null }))).map((item) => {
      const label = item.resultLabel || classifyHttpStatus(item.status, item).label;
      return `<article class="hhhf-service is-${escapeHtml(item.state || "unknown")}">
        <span class="hhhf-led" aria-hidden="true"></span><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.group)} · ${escapeHtml(label)}</small></div>
        <b>${escapeHtml(formatLatency(item.latency))}</b><div class="hhhf-spark" aria-hidden="true">${sampleBars(history.endpoints?.[item.id])}</div>
      </article>`;
    }).join("");
    return `<section class="hhhf-panel hhhf-health" aria-labelledby="hhhf-health-title">
      <header class="hhhf-panel-head"><div><span>WEBSITE HEALTH</span><h2 id="hhhf-health-title">Tình trạng hệ thống</h2><p>Đo trực tiếp từ trình duyệt hiện tại, không mô phỏng CPU/GPU/RAM của thiết bị.</p></div><button type="button" data-hhhf-refresh ${view.running ? "disabled" : ""}><span aria-hidden="true">↻</span>${view.running ? "Đang đo" : "Đo lại"}</button></header>
      <div class="hhhf-health-overview"><article><span>Trạng thái</span><strong class="is-${escapeHtml(summary.state)}">${escapeHtml(summary.state === "online" ? "Ổn định" : summary.state === "degraded" ? "Cần chú ý" : summary.state === "offline" ? "Gián đoạn" : "Chưa đo")}</strong></article><article><span>Endpoint phản hồi</span><strong>${summary.reachable}/${summary.total}</strong></article><article><span>Độ trễ trung bình</span><strong>${escapeHtml(formatLatency(summary.averageLatency))}</strong></article><article><span>Cập nhật</span><strong>${history.updatedAt ? escapeHtml(new Date(history.updatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })) : "Chưa có"}</strong></article></div>
      <div class="hhhf-service-list" aria-live="polite">${services}</div>
      <div class="hhhf-runtime-grid"><section><header><span>Trình duyệt & mạng</span><small>Dữ liệu khả dụng tại phiên này</small></header><div data-hhhf-browser><div class="hhhf-skeleton"></div></div></section><section><header><span>Core Web Vitals</span><small>PerformanceObserver khi được hỗ trợ</small></header><div class="hhhf-vitals" data-hhhf-vitals><div class="hhhf-skeleton"></div></div></section></div>
      <footer class="hhhf-truth"><span aria-hidden="true">i</span><p>HTTP 401/403 ở endpoint phiên đăng nhập được tính là máy chủ có phản hồi và đang bảo vệ dữ liệu. Chỉ số bộ nhớ là <b>JS heap</b>, không phải RAM hệ điều hành.</p></footer>
    </section>`;
  }

  function focusMarkup(state, tasks) {
    const stats = state.summary || focusStats(state);
    const options = [`<option value="">Chọn công việc quan trọng...</option>`, ...tasks.map((task) => `<option value="${escapeHtml(task.id)}" data-title="${escapeHtml(task.title)}" ${state.taskId === String(task.id) ? "selected" : ""}>${escapeHtml(task.title)}</option>`)].join("");
    const phaseLabel = state.phase === "focus" ? "Tập trung 25 phút" : "Nghỉ ngắn 5 phút";
    const percent = Math.round((1 - state.remainingSeconds / (state.phase === "focus" ? FOCUS_SECONDS : BREAK_SECONDS)) * 100);
    return `<section class="hhhf-panel hhhf-focus ${state.active ? "is-active" : ""}" aria-labelledby="hhhf-focus-title">
      <header class="hhhf-panel-head"><div><span>FOCUS MODE</span><h2 id="hhhf-focus-title">Một việc. Một nhịp.</h2><p>Giữ Task, Notes và Music; tạm ẩn phần còn lại của dashboard.</p></div><label class="hhhf-switch"><input type="checkbox" data-hhhf-quiet ${state.quiet ? "checked" : ""}><span></span><b>Yên lặng</b></label></header>
      <div class="hhhf-focus-layout"><div class="hhhf-task-picker"><label for="hhhf-task-select">Việc quan trọng nhất</label><select id="hhhf-task-select" data-hhhf-task>${options}</select><label for="hhhf-task-custom">Hoặc nhập việc riêng</label><input id="hhhf-task-custom" data-hhhf-custom-task maxlength="180" value="${escapeHtml(state.taskTitle && !state.taskId ? state.taskTitle : "")}" placeholder="Ví dụ: Hoàn thiện trang chủ HH"><button type="button" data-hhhf-use-custom>Chọn việc này</button></div>
        <div class="hhhf-timer" style="--progress:${clamp(percent, 0, 100)}%"><div class="hhhf-timer-ring"><span>${escapeHtml(phaseLabel)}</span><strong data-hhhf-time>${escapeHtml(formatClock(state.remainingSeconds))}</strong><small data-hhhf-task-label>${escapeHtml(state.taskTitle || "Chưa chọn công việc")}</small></div><div class="hhhf-timer-actions"><button class="is-primary" type="button" data-hhhf-toggle>${state.running ? "Tạm dừng" : "Bắt đầu"}</button><button type="button" data-hhhf-reset>Đặt lại</button><button type="button" data-hhhf-skip>${state.phase === "focus" ? "Nghỉ sớm" : "Quay lại"}</button></div></div>
      </div>
      <div class="hhhf-focus-stats"><article><span>Hôm nay</span><strong data-hhhf-stat="today">${Math.round(stats.todaySeconds / 60)} phút</strong></article><article><span>7 ngày</span><strong data-hhhf-stat="week">${Math.round(stats.weekSeconds / 60)} phút</strong></article><article><span>Phiên hoàn tất</span><strong data-hhhf-stat="completed">${stats.completed}</strong></article><article><span>Chuỗi ngày</span><strong data-hhhf-stat="streak">${stats.streak} ngày</strong></article></div>
      <footer class="hhhf-focus-footer"><button class="is-primary" type="button" data-hhhf-enter>${state.active ? "Đang tập trung" : "Vào chế độ tập trung"}</button>${state.active ? `<button type="button" data-hhhf-exit>Thoát Focus Mode</button>` : ""}<p>Thời gian được lưu cục bộ trên thiết bị này và khôi phục sau khi tải lại trang.</p></footer>
    </section>`;
  }

  function browserMarkup(snapshot) {
    const network = snapshot.network.supported ? `${escapeHtml(snapshot.network.effectiveType)}${snapshot.network.downlink != null ? ` · ${snapshot.network.downlink} Mbps` : ""}${snapshot.network.rtt != null ? ` · RTT ${snapshot.network.rtt} ms` : ""}` : "Trình duyệt không cung cấp Network Information API";
    const heap = snapshot.heap.supported ? `${formatBytes(snapshot.heap.used)} / ${formatBytes(snapshot.heap.limit)} JS heap` : "Không hỗ trợ đo JS heap";
    const storage = snapshot.storage.supported ? `${formatBytes(snapshot.storage.usage)} / ${formatBytes(snapshot.storage.quota)}` : "Không hỗ trợ Storage Estimate";
    const fps = snapshot.fps.supported ? `${snapshot.fps.value} FPS trong phiên đo ngắn` : "Không đo khi tab ẩn/không hỗ trợ";
    return `<dl><div><dt>Kết nối</dt><dd><i class="${snapshot.online ? "is-online" : "is-offline"}"></i>${snapshot.online ? "Trình duyệt đang online" : "Trình duyệt báo offline"}</dd></div><div><dt>Mạng</dt><dd>${network}</dd></div><div><dt>Độ mượt</dt><dd>${escapeHtml(fps)}</dd></div><div><dt>Bộ nhớ</dt><dd>${escapeHtml(heap)}</dd></div><div><dt>Lưu trữ</dt><dd>${escapeHtml(storage)}</dd></div></dl>`;
  }

  function vitalsMarkup(metrics, support) {
    const names = ["LCP", "INP", "CLS", "FCP", "TTFB"];
    return `${names.map((name) => {
      const metric = metrics[name];
      const suffix = name === "CLS" ? "" : " ms";
      return `<article class="is-${escapeHtml(metric?.rating || "unknown")}"><span>${name}</span><strong>${metric ? `${escapeHtml(metric.value)}${suffix}` : "—"}</strong><small>${metric ? escapeHtml(metric.source) : "Chưa đo/không hỗ trợ"}</small></article>`;
    }).join("")}<p>${support.coreWebVitals ? "Đang quan sát các metric trình duyệt hỗ trợ." : "Trình duyệt này không cung cấp đầy đủ Core Web Vitals qua PerformanceObserver."}</p>`;
  }

  function mount(host, options = {}) {
    if (!host || typeof host.innerHTML !== "string") throw new TypeError("HHHomeHealthFocus.mount requires a DOM host.");
    unmount(host);
    const scope = options.scope || globalScope;
    const storage = options.storage || scope.localStorage;
    const health = createHealthMonitor({ ...options, scope, storage });
    const vitals = createVitalsMonitor({ scope, onUpdate: (metrics) => {
      const node = host.querySelector?.("[data-hhhf-vitals]");
      if (node) node.innerHTML = vitalsMarkup(metrics, vitals.getSupport());
    } });
    const focus = createFocusController({ scope, storage });
    let healthView = health.snapshot();
    let destroyed = false;

    function renderHealth() {
      const existing = host.querySelector?.(".hhhf-health");
      if (existing) existing.outerHTML = healthMarkup(healthView);
      else host.innerHTML = `<div class="hhhf" data-hhhf-root>${healthMarkup(healthView)}${focusMarkup(focus.snapshot(), readTasks(storage))}<div class="hhhf-focus-dock" data-hhhf-focus-dock><div><span>FOCUS</span><strong data-hhhf-dock-task>${escapeHtml(focus.snapshot().taskTitle || "Phiên tập trung")}</strong></div><b data-hhhf-dock-time>${formatClock(focus.snapshot().remainingSeconds)}</b><button type="button" data-hhhf-toggle>${focus.snapshot().running ? "Dừng" : "Tiếp tục"}</button><button type="button" data-hhhf-exit aria-label="Thoát Focus Mode">×</button></div></div>`;
      const vitalsNode = host.querySelector?.("[data-hhhf-vitals]");
      if (vitalsNode) vitalsNode.innerHTML = vitalsMarkup(vitals.getMetrics(), vitals.getSupport());
      renderRuntime();
    }
    function renderFocus(detail) {
      if (destroyed) return;
      const view = detail?.phase ? detail : focus.snapshot();
      const existing = host.querySelector?.(".hhhf-focus");
      if (existing && detail?.reason === "tick") {
        const duration = view.phase === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
        existing.querySelector("[data-hhhf-time]").textContent = formatClock(view.remainingSeconds);
        existing.querySelector(".hhhf-timer")?.style.setProperty("--progress", `${Math.round((1 - view.remainingSeconds / duration) * 100)}%`);
        const stats = view.summary || focusStats(view);
        const values = {
          today: `${Math.round(stats.todaySeconds / 60)} phút`,
          week: `${Math.round(stats.weekSeconds / 60)} phút`,
          completed: String(stats.completed),
          streak: `${stats.streak} ngày`
        };
        Object.entries(values).forEach(([key, value]) => {
          const node = existing.querySelector(`[data-hhhf-stat="${key}"]`);
          if (node) node.textContent = value;
        });
      } else if (existing) existing.outerHTML = focusMarkup(view, readTasks(storage));
      const dock = host.querySelector?.("[data-hhhf-focus-dock]");
      if (dock) {
        dock.querySelector("[data-hhhf-dock-task]").textContent = view.taskTitle || "Phiên tập trung";
        dock.querySelector("[data-hhhf-dock-time]").textContent = formatClock(view.remainingSeconds);
        dock.querySelector("[data-hhhf-toggle]").textContent = view.running ? "Dừng" : "Tiếp tục";
      }
    }
    async function renderRuntime() {
      const node = host.querySelector?.("[data-hhhf-browser]");
      if (!node) return;
      const snapshot = await readBrowserSnapshot(scope, options);
      if (!destroyed && node.isConnected !== false) node.innerHTML = browserMarkup(snapshot);
    }
    async function refresh() { return health.check(); }
    function click(event) {
      const action = event.target?.closest?.("button,[data-hhhf-task],[data-hhhf-quiet]");
      if (!action || !host.contains?.(action)) return;
      if (action.matches("[data-hhhf-refresh]")) refresh();
      else if (action.matches("[data-hhhf-toggle]")) focus.toggle();
      else if (action.matches("[data-hhhf-reset]")) focus.reset();
      else if (action.matches("[data-hhhf-skip]")) focus.skip();
      else if (action.matches("[data-hhhf-enter]")) focus.enter();
      else if (action.matches("[data-hhhf-exit]")) focus.exit();
      else if (action.matches("[data-hhhf-use-custom]")) {
        const input = host.querySelector("[data-hhhf-custom-task]");
        if (input?.value.trim()) focus.selectTask("", input.value.trim());
        else input?.focus();
      }
    }
    function change(event) {
      if (event.target?.matches?.("[data-hhhf-task]")) {
        const option = event.target.selectedOptions?.[0];
        focus.selectTask(event.target.value, event.target.value ? (option?.dataset?.title || option?.textContent || "") : "");
      }
      if (event.target?.matches?.("[data-hhhf-quiet]")) focus.setQuiet(event.target.checked);
    }
    function keydown(event) {
      if (event.key === "Enter" && event.target?.matches?.("[data-hhhf-custom-task]")) {
        event.preventDefault();
        if (event.target.value.trim()) focus.selectTask("", event.target.value.trim());
      }
    }
    function sync() { renderFocus(); }
    host.innerHTML = `<div class="hhhf" data-hhhf-root>${healthMarkup(healthView)}${focusMarkup(focus.snapshot(), readTasks(storage))}<div class="hhhf-focus-dock" data-hhhf-focus-dock><div><span>FOCUS</span><strong data-hhhf-dock-task>${escapeHtml(focus.snapshot().taskTitle || "Phiên tập trung")}</strong></div><b data-hhhf-dock-time>${formatClock(focus.snapshot().remainingSeconds)}</b><button type="button" data-hhhf-toggle>${focus.snapshot().running ? "Dừng" : "Tiếp tục"}</button><button type="button" data-hhhf-exit aria-label="Thoát Focus Mode">×</button></div></div>`;
    host.addEventListener("click", click);
    host.addEventListener("change", change);
    host.addEventListener("keydown", keydown);
    scope.addEventListener?.("storage", sync);
    scope.addEventListener?.("hh:command-center-sync", sync);
    scope.addEventListener?.("online", refresh);
    scope.addEventListener?.("offline", refresh);
    const unsubscribeFocus = focus.subscribe(renderFocus);
    vitals.start();
    host.querySelector("[data-hhhf-vitals]").innerHTML = vitalsMarkup(vitals.getMetrics(), vitals.getSupport());
    renderRuntime();
    const unsubscribeHealth = health.subscribe((view) => { healthView = view; if (!destroyed) renderHealth(); });
    mounted.set(host, { health, vitals, focus, click, change, keydown, sync, refresh, scope, unsubscribeFocus, unsubscribeHealth, destroy() { destroyed = true; } });
    health.start(options.refreshInterval || 60000);
    return { version: VERSION, refresh, getHealth: health.snapshot, getFocus: focus.snapshot };
  }

  function unmount(host) {
    const instance = mounted.get(host);
    if (!instance) return false;
    instance.destroy();
    instance.health.stop();
    instance.vitals.stop();
    instance.focus.destroy();
    instance.unsubscribeFocus?.();
    instance.unsubscribeHealth?.();
    instance.scope.removeEventListener?.("storage", instance.sync);
    instance.scope.removeEventListener?.("hh:command-center-sync", instance.sync);
    instance.scope.removeEventListener?.("online", instance.refresh);
    instance.scope.removeEventListener?.("offline", instance.refresh);
    host.removeEventListener?.("click", instance.click);
    host.removeEventListener?.("change", instance.change);
    host.removeEventListener?.("keydown", instance.keydown);
    host.innerHTML = "";
    mounted.delete(host);
    return true;
  }

  function autoMount(options = {}) {
    const scope = options.scope || globalScope;
    const documentRef = options.document || scope.document;
    if (!documentRef) return false;
    const attach = () => {
      const home = documentRef.querySelector?.('[data-shell-view="home"]');
      if (!home) return false;
      let host = home.querySelector?.("[data-home-health-focus-host]");
      if (!host) {
        host = documentRef.createElement("div");
        host.className = "home-health-focus-host";
        host.dataset.homeHealthFocusHost = "true";
        const commandCenter = home.querySelector?.("#commandCenterProRoot");
        if (commandCenter?.parentNode) commandCenter.insertAdjacentElement("afterend", host);
        else home.append?.(host);
      }
      if (!mounted.has(host)) mount(host, { ...options, scope });
      return true;
    };
    const start = () => {
      if (attach() || typeof scope.MutationObserver !== "function") return;
      const observer = new scope.MutationObserver(() => { if (attach()) observer.disconnect(); });
      observer.observe(documentRef.documentElement, { childList: true, subtree: true });
    };
    if (documentRef.readyState === "loading") documentRef.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
    return true;
  }

  return Object.freeze({
    VERSION,
    HEALTH_STORAGE_KEY,
    FOCUS_STORAGE_KEY,
    TODO_STORAGE_KEY,
    buildEndpointPlan,
    classifyHttpStatus,
    probeEndpoint,
    healthSummary,
    performanceRating,
    createHealthMonitor,
    createVitalsMonitor,
    readBrowserSnapshot,
    normalizeFocusState,
    focusStats,
    createFocusController,
    mount,
    unmount,
    autoMount
  });
});
