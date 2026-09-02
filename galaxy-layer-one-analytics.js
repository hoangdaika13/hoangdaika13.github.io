(function attachGalaxyLayerOneAnalytics(root, factory) {
  "use strict";
  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHGalaxyLayerOneAnalytics = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createGalaxyLayerOneAnalytics(globalScope) {
  "use strict";

  const VERSION = "1.0.0";
  const LIMITS = Object.freeze({ maxEntriesPerMetric: 256, maxMetrics: 4, maxExportBytes: 2 * 1024 * 1024 });
  const METRICS = Object.freeze({
    lcp: Object.freeze({ unit: "ms", type: "largest-contentful-paint" }),
    fcp: Object.freeze({ unit: "ms", type: "paint" }),
    inp: Object.freeze({ unit: "ms", type: "event" }),
    cls: Object.freeze({ unit: "score", type: "layout-shift" })
  });

  function analyticsError(code, message) {
    const error = new Error(message || code);
    error.name = "GalaxyAnalyticsError";
    error.code = code;
    return error;
  }

  function finite(value, code) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw analyticsError(code, "Giá trị chỉ số không hợp lệ.");
    return number;
  }

  function boundedInteger(value, fallback) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? Math.min(number, LIMITS.maxEntriesPerMetric) : fallback;
  }

  function consentValue(source) {
    if (typeof source === "function") {
      try { return source() === true; } catch (_) { return false; }
    }
    return source === true;
  }

  function entryTime(entry, fallbackNow) {
    const value = Number(entry && (entry.startTime != null ? entry.startTime : entry.time));
    if (Number.isFinite(value) && value >= 0) return value;
    return Number(fallbackNow());
  }

  function cloneEntry(entry) {
    return Object.freeze({ value: entry.value, atMs: entry.atMs, source: entry.source });
  }

  function csvCell(value) {
    const text = String(value == null ? "" : value);
    return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function createCollector(options) {
    const config = options && typeof options === "object" ? options : {};
    const maxEntries = boundedInteger(config.maxEntriesPerMetric, LIMITS.maxEntriesPerMetric);
    const now = typeof config.now === "function" ? config.now : function currentTime() { return Date.now(); };
    const performanceObserver = Object.hasOwn(config, "PerformanceObserver") ? config.PerformanceObserver : globalScope.PerformanceObserver;
    const performanceObject = config.performance || globalScope.performance;
    const metrics = new Map();
    Object.keys(METRICS).forEach(function initialize(metric) { metrics.set(metric, { value: null, entries: [] }); });
    let consentSource = Object.hasOwn(config, "consent") ? config.consent : false;
    let observer = null;
    let running = false;
    let supportedTypes = [];

    function hasConsent() { return consentValue(consentSource); }
    function assertConsent() {
      if (!hasConsent()) throw analyticsError("CONSENT_REQUIRED", "Cần có sự đồng ý đo lường trước khi thu thập.");
    }
    function append(metric, value, atMs, source) {
      assertConsent();
      if (!Object.hasOwn(METRICS, metric)) throw analyticsError("METRIC_UNSUPPORTED", "Chỉ số không được hỗ trợ.");
      const normalized = finite(value, "METRIC_VALUE_INVALID");
      const state = metrics.get(metric);
      state.value = metric === "cls" ? Number((Number(state.value || 0) + normalized).toFixed(4)) : (metric === "fcp" ? (state.value == null ? normalized : Math.min(state.value, normalized)) : Math.max(Number(state.value || 0), normalized));
      state.entries.push({ value: normalized, atMs: Math.max(0, Number(atMs) || 0), source: String(source || "performance").slice(0, 32) });
      if (state.entries.length > maxEntries) state.entries.splice(0, state.entries.length - maxEntries);
      return normalized;
    }
    function consume(list) {
      list.forEach(function consumeEntry(entry) {
        const name = String(entry && entry.name || "");
        const entryType = String(entry && entry.entryType || "");
        const time = entryTime(entry, now);
        if (entryType === "largest-contentful-paint" || name === "largest-contentful-paint") append("lcp", entry.startTime, time, entryType || name);
        else if (name === "first-contentful-paint") append("fcp", entry.startTime, time, name);
        else if ((entryType === "layout-shift" || name === "layout-shift") && entry.hadRecentInput !== true) append("cls", entry.value, time, entryType || name);
        else if (name === "event" || entryType === "event") {
          const duration = Number(entry.duration != null ? entry.duration : entry.processingEnd - entry.startTime);
          if (Number.isFinite(duration) && duration >= 0) append("inp", duration, time, name || "event");
        }
      });
    }
    function start() {
      assertConsent();
      if (running) return true;
      if (typeof performanceObserver !== "function") {
        if (performanceObject && typeof performanceObject.getEntriesByType === "function") {
          ["largest-contentful-paint", "layout-shift", "event", "paint"].forEach(function readBuffered(type) {
            try { consume(performanceObject.getEntriesByType(type) || []); } catch (_) { /* Unsupported entry type. */ }
          });
        }
        return false;
      }
      observer = new performanceObserver(function onPerformanceEntries(list) {
        if (!hasConsent()) return;
        const entries = list && typeof list.getEntries === "function" ? list.getEntries() : [];
        consume(entries);
      });
      supportedTypes = [];
      ["largest-contentful-paint", "layout-shift", "event", "paint"].forEach(function observeType(type) {
        try {
          const observerOptions = { type: type, buffered: true };
          if (type === "event") observerOptions.durationThreshold = 16;
          observer.observe(observerOptions);
          supportedTypes.push(type);
        }
        catch (_) { /* Browser does not support this entry type. */ }
      });
      running = true;
      return true;
    }
    function stop() {
      if (observer && typeof observer.disconnect === "function") observer.disconnect();
      observer = null;
      running = false;
      supportedTypes = [];
      return true;
    }
    function setConsent(value) {
      consentSource = value;
      if (!hasConsent()) { stop(); clear(); }
      return hasConsent();
    }
    function clear() { metrics.forEach(function reset(state) { state.value = null; state.entries = []; }); }
    function snapshot() {
      assertConsent();
      const result = {};
      metrics.forEach(function read(state, metric) { result[metric] = Object.freeze({ value: state.value, unit: METRICS[metric].unit, entries: Object.freeze(state.entries.map(cloneEntry)) }); });
      return Object.freeze({ version: VERSION, collectedAt: new Date(now()).toISOString(), running: running, supportedTypes: Object.freeze(supportedTypes.slice()), metrics: Object.freeze(result) });
    }
    function exportJSON() {
      const output = JSON.stringify(snapshot());
      if (output.length > LIMITS.maxExportBytes) throw analyticsError("EXPORT_TOO_LARGE", "Bản xuất analytics vượt quá giới hạn.");
      return output;
    }
    function exportCSV() {
      const data = snapshot();
      const rows = [["metric", "value", "unit", "atMs", "source"]];
      Object.keys(data.metrics).forEach(function metricRow(metric) { data.metrics[metric].entries.forEach(function entryRow(entry) { rows.push([metric, entry.value, data.metrics[metric].unit, entry.atMs, entry.source]); }); });
      const output = rows.map(function row(values) { return values.map(csvCell).join(","); }).join("\n");
      if (output.length > LIMITS.maxExportBytes) throw analyticsError("EXPORT_TOO_LARGE", "Bản xuất analytics vượt quá giới hạn.");
      return output;
    }
    const api = { version: VERSION, limits: LIMITS, hasConsent: hasConsent, setConsent: setConsent, start: start, stop: stop, clear: clear, record: append, snapshot: snapshot, exportJSON: exportJSON, exportCSV: exportCSV };
    void performanceObject;
    return Object.freeze(api);
  }

  return Object.freeze({ VERSION: VERSION, LIMITS: LIMITS, METRICS: METRICS, createCollector: createCollector });
});
