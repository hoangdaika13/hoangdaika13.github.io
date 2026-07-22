(() => {
  "use strict";

  const STATE_VERSION = 3;
  const STORE_KEY = "hh.insights.analytics.v3";
  const LEGACY_STORE_KEY = "hh.insights.events.v2";
  const SESSION_KEY = "hh.insights.session.v3";
  const PRESENCE_KEY = "hh.insights.presence.v1";
  const MAX_EVENTS = 1200;
  const REMOTE_BATCH_SIZE = 20;
  const REMOTE_FLUSH_MS = 15000;
  const API_BASE = String(window.HH_API_BASE || (/^https?:$/.test(location.protocol) ? location.origin : "")).replace(/\/$/, "");
  const PUBLIC_EVENT_CATALOG = Object.freeze({
    session_start: "Bắt đầu phiên", session_end: "Kết thúc phiên", page_view: "Mở trang",
    action: "Tương tác công khai", form_start: "Bắt đầu biểu mẫu", form_submit: "Gửi biểu mẫu",
    form_validation: "Lỗi xác thực", control_change: "Đổi điều khiển", error: "Lỗi JavaScript",
    performance: "Web Vital", diagnostic: "Chẩn đoán", export: "Xuất báo cáo", refresh: "Làm mới",
    experiment_exposure: "Hiển thị biến thể", experiment_conversion: "Chuyển đổi thử nghiệm", conversion: "Chuyển đổi"
  });
  const META_ENUMS = Object.freeze({
    kind: ["", "form", "authentication", "prompt", "message", "search"],
    fieldType: ["", "text", "email", "number", "url", "search", "textarea", "select-one", "checkbox", "radio", "credential"],
    durationBucket: ["", "0-5s", "6-30s", "31-120s", "2-10m", "10m+"],
    region: ["", "top-left", "top-center", "top-right", "middle-left", "middle-center", "middle-right", "bottom-left", "bottom-center", "bottom-right"],
    source: ["", "direct", "internal", "search", "social", "referral"],
    metric: ["", "lcp", "cls", "inp", "fcp", "ttfb", "load"],
    rating: ["", "good", "needs-improvement", "poor", "unknown"],
    errorKind: ["", "runtime", "script-resource", "style-resource", "image-resource", "media-resource", "resource", "csp", "unhandled-rejection"],
    variant: ["", "A", "B", "C", "D"]
  });
  const runtimeVitals = { lcp: 0, cls: 0, inp: 0, fcp: 0, ttfb: 0, load: 0 };
  let analyticsHost = null;
  let remoteQueue = [];
  let remoteSending = false;
  let lastRemoteAt = 0;
  let lastInteractionAt = Date.now();
  let lastAllowedRoute = "/home";
  let adminSnapshot = null;
  let adminLoading = false;
  let liveTimer = 0;
  const formTelemetry = new WeakMap();

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  const safeKey = (value, fallback = "unknown", max = 80) => String(value || fallback).toLowerCase().replace(/[^a-z0-9_.:-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, max) || fallback;
  const clampNumber = (value, min, max, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
  const readJson = (key, fallback, storage = localStorage) => { try { return JSON.parse(storage.getItem(key) || "null") ?? fallback; } catch { return fallback; } };
  const writeJson = (key, value, storage = localStorage) => { try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const emptyState = () => ({ version: STATE_VERSION, events: [], experiments: {}, assignments: {}, adapter: { confirmed: false, mode: "local-demo", checkedAt: "", online: 0 } });
  const normalizeState = (input) => {
    const source = input && typeof input === "object" ? input : {};
    return {
      version: STATE_VERSION,
      events: Array.isArray(source.events) ? source.events.filter((row) => PUBLIC_EVENT_CATALOG[row?.type]).slice(0, MAX_EVENTS) : [],
      experiments: source.experiments && typeof source.experiments === "object" ? source.experiments : {},
      assignments: source.assignments && typeof source.assignments === "object" ? source.assignments : {},
      adapter: source.adapter?.confirmed === true ? { confirmed: true, mode: "backend", checkedAt: String(source.adapter.checkedAt || ""), online: clampNumber(source.adapter.online, 0, 1000000) } : { confirmed: false, mode: "local-demo", checkedAt: String(source.adapter?.checkedAt || ""), online: 0 }
    };
  };
  function readState() {
    const current = readJson(STORE_KEY, null);
    if (current) return normalizeState(current);
    const legacy = readJson(LEGACY_STORE_KEY, []);
    const migrated = normalizeState({ events: analyticsAllowed() && Array.isArray(legacy) ? legacy : [] });
    writeJson(STORE_KEY, migrated);
    try { localStorage.removeItem(LEGACY_STORE_KEY); } catch {}
    return migrated;
  }
  const saveState = (next) => writeJson(STORE_KEY, normalizeState(next));
  const events = () => readState().events;
  const routeName = (route = location.hash.replace(/^#/, "") || "/home") => String(route || "/home").split("?")[0].replace(/[^\p{L}\p{N}/_.:-]/gu, "-").slice(0, 160) || "/home";
  const moduleName = (route) => routeName(route).split("/").filter(Boolean).at(-1) || "home";
  const analyticsAllowed = () => localStorage.getItem("hh-tracking-consent") === "yes";
  const browserKey = () => navigator.userAgent.includes("Edg/") ? "edge" : navigator.userAgent.includes("Chrome/") ? "chrome" : navigator.userAgent.includes("Firefox/") ? "firefox" : navigator.userAgent.includes("Safari/") ? "safari" : "browser";
  const browserName = () => ({ edge: "Microsoft Edge", chrome: "Chrome / Chromium", firefox: "Firefox", safari: "Safari" }[browserKey()] || "Web Browser");
  const deviceKey = () => innerWidth < 640 ? "mobile" : innerWidth < 1024 ? "tablet" : "desktop";
  const viewportKey = () => `${Math.round(innerWidth / 100) * 100}x${Math.round(innerHeight / 100) * 100}`;
  const durationBucket = (milliseconds) => { const value = Math.max(0, Number(milliseconds || 0)); return value <= 5000 ? "0-5s" : value <= 30000 ? "6-30s" : value <= 120000 ? "31-120s" : value <= 600000 ? "2-10m" : "10m+"; };
  const sensitiveField = (field) => field?.type === "password" || /pass(word)?|token|secret|credential|otp|one.?time|api.?key|private.?key/i.test(`${field?.name || ""} ${field?.id || ""} ${field?.autocomplete || ""}`);
  const formKey = (form) => safeKey(Object.keys(form?.dataset || {}).find((key) => /form|composer|prompt|chat|message|login|register|search/i.test(key)) || form?.id || form?.getAttribute?.("name") || "form", "form");
  const formKind = (form) => { const hint = `${formKey(form)} ${form?.className || ""}`.toLowerCase(); return /login|register|auth/.test(hint) ? "authentication" : /prompt|ai-|composer-ai/.test(hint) ? "prompt" : /chat|message|comment|composer/.test(hint) ? "message" : /search/.test(hint) ? "search" : "form"; };
  const enumMeta = (key, value) => META_ENUMS[key]?.includes(value) ? value : "";
  const safeMeta = (value = {}) => ({
    form: safeKey(value.form, "form"), kind: enumMeta("kind", safeKey(value.kind, "", 40)),
    fieldType: enumMeta("fieldType", safeKey(value.fieldType, "", 40)), fieldCount: clampNumber(value.fieldCount, 0, 100),
    lengthBucket: "", interactionBucket: "", durationBucket: enumMeta("durationBucket", String(value.durationBucket || "")), valid: value.valid !== false,
    region: enumMeta("region", String(value.region || "")), source: enumMeta("source", String(value.source || "")),
    metric: enumMeta("metric", safeKey(value.metric, "", 20)), value: clampNumber(value.value, 0, 600000),
    rating: enumMeta("rating", String(value.rating || "")), errorKind: enumMeta("errorKind", String(value.errorKind || "")),
    experimentId: safeKey(value.experimentId, "", 64), variant: enumMeta("variant", String(value.variant || "").toUpperCase())
  });
  const trafficSource = () => {
    if (!document.referrer) return "direct";
    try {
      const host = new URL(document.referrer).hostname.toLowerCase();
      if (host === location.hostname) return "internal";
      if (/google\.|bing\.|duckduckgo\.|yahoo\.|baidu\./.test(host)) return "search";
      if (/facebook\.|instagram\.|tiktok\.|youtube\.|linkedin\.|x\.com$|twitter\./.test(host)) return "social";
      return "referral";
    } catch { return "referral"; }
  };
  const clickRegion = (event) => {
    const width = Math.max(1, document.documentElement.clientWidth || innerWidth);
    const height = Math.max(1, document.documentElement.clientHeight || innerHeight);
    const column = event.clientX < width / 3 ? "left" : event.clientX < width * 2 / 3 ? "center" : "right";
    const row = event.clientY < height / 3 ? "top" : event.clientY < height * 2 / 3 ? "middle" : "bottom";
    return `${row}-${column}`;
  };
  const actionKey = (target) => {
    const dataKey = Object.keys(target?.dataset || {}).find((key) => !["appRoute", "insightsNoTrack"].includes(key));
    if (dataKey) return safeKey(dataKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), "button-action", 100);
    if (target?.dataset?.appRoute) return "open-route";
    return target?.tagName === "A" ? "open-link" : "button-action";
  };
  function presenceId() {
    const storage = analyticsAllowed() ? localStorage : sessionStorage;
    let value = storage.getItem(PRESENCE_KEY);
    if (!value) { value = crypto.randomUUID?.() || `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`; try { storage.setItem(PRESENCE_KEY, value); } catch {} }
    return value;
  }
  function sessionState() {
    const fallback = { version: STATE_VERSION, id: Math.random().toString(36).slice(2), startedAt: Date.now(), activeSeconds: 0, lastActiveAt: Date.now() };
    const value = readJson(SESSION_KEY, fallback, sessionStorage);
    return value?.version === STATE_VERSION ? value : fallback;
  }
  function updateSession() {
    const state = sessionState();
    const now = Date.now();
    if (!document.hidden) state.activeSeconds += Math.max(0, Math.min(30, Math.round((now - Number(state.lastActiveAt || now)) / 1000)));
    state.lastActiveAt = now;
    writeJson(SESSION_KEY, state, sessionStorage);
    return state;
  }
  function record(type, detail = {}) {
    if (!PUBLIC_EVENT_CATALOG[type]) return null;
    const row = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, route: routeName(detail.route),
      module: safeKey(detail.module || moduleName(detail.route), "home"), action: safeKey(detail.action || type, type, 100),
      label: PUBLIC_EVENT_CATALOG[type], meta: safeMeta(detail.meta), sessionId: sessionState().id, createdAt: new Date().toISOString()
    };
    if (analyticsAllowed()) {
      const state = readState();
      state.events = [row, ...state.events].slice(0, MAX_EVENTS);
      saveState(state);
      remoteQueue.push({ ...row, label: "", sessionId: undefined });
    }
    return row;
  }
  function setAdapter(data) {
    const state = readState();
    state.adapter = data?.adapter?.confirmed === true
      ? { confirmed: true, mode: "backend", checkedAt: String(data.checkedAt || new Date().toISOString()), online: clampNumber(data.online, 0, 1000000) }
      : { confirmed: false, mode: "local-demo", checkedAt: new Date().toISOString(), online: 0 };
    saveState(state);
  }
  async function flushRemote(force = false) {
    if (!API_BASE || remoteSending) return;
    if (!force && !remoteQueue.length && Date.now() - lastRemoteAt < 45000) return;
    const state = updateSession();
    const consent = analyticsAllowed();
    const batch = consent ? remoteQueue.splice(0, REMOTE_BATCH_SIZE) : [];
    remoteSending = true;
    try {
      const token = window.HHAuthSession?.token?.() || "";
      const response = await fetch(`${API_BASE}/api/platform/summary`, { method: "POST", keepalive: true, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ visitorId: presenceId(), sessionId: state.id, page: routeName(), module: moduleName(routeName()), activeSeconds: state.activeSeconds, activityState: document.hidden ? "background" : Date.now() - lastInteractionAt > 60000 ? "idle" : "active", device: deviceKey(), browser: browserKey(), viewport: viewportKey(), analyticsConsent: consent, events: batch }) });
      if (!response.ok) throw new Error("telemetry-rejected");
      const data = await response.json().catch(() => ({}));
      setAdapter(data);
      lastRemoteAt = Date.now();
      if (data.policy) localStorage.setItem("hh-disabled-features", JSON.stringify(Array.isArray(data.policy.disabledFeatures) ? data.policy.disabledFeatures : []));
      if (routeIsRestricted(routeName())) location.hash = "#/home";
    } catch {
      remoteQueue = [...batch, ...remoteQueue].slice(0, 100);
      setAdapter(null);
    } finally { remoteSending = false; }
  }
  function restrictedFeatures() {
    try { const user = JSON.parse(localStorage.getItem("hh-auth-user") || "{}"); const disabled = JSON.parse(localStorage.getItem("hh-disabled-features") || "[]"); return new Set([...(Array.isArray(user.restrictedFeatures) ? user.restrictedFeatures : []), ...(Array.isArray(disabled) ? disabled : [])]); } catch { return new Set(); }
  }
  function routeIsRestricted(route) { const denied = restrictedFeatures(); const normalized = routeName(route); const parts = normalized.split("/").filter(Boolean); return [...denied].some((feature) => parts.includes(feature) || normalized.startsWith(`/${feature}/`)); }
  function installFeatureAccessGuard() {
    document.addEventListener("click", (event) => { const target = event.target.closest("[data-app-route], a[href^='#/']"); const nextRoute = target?.dataset?.appRoute || target?.getAttribute("href")?.replace(/^#/, ""); if (!nextRoute || !routeIsRestricted(nextRoute)) return; event.preventDefault(); event.stopImmediatePropagation(); window.HHCommunity?.notice?.("Tính năng này đang bị giới hạn cho tài khoản của bạn.", "error"); }, true);
    window.addEventListener("hashchange", () => { const current = routeName(); if (routeIsRestricted(current)) { location.hash = `#${lastAllowedRoute}`; window.HHCommunity?.notice?.("Bạn không có quyền mở tính năng này.", "error"); } else lastAllowedRoute = current; });
  }
  const vitalRating = (metric, value) => { const thresholds = { lcp: [2500, 4000], cls: [.1, .25], inp: [200, 500], fcp: [1800, 3000], ttfb: [800, 1800], load: [3000, 5000] }[metric]; return !thresholds ? "unknown" : value <= thresholds[0] ? "good" : value <= thresholds[1] ? "needs-improvement" : "poor"; };
  const classifyBrowserError = (event = {}) => {
    if (event.type === "securitypolicyviolation") return "csp";
    const target = event.target;
    if (!target || target === window) return "runtime";
    const tag = String(target.tagName || "").toLowerCase();
    return ({ script: "script-resource", link: "style-resource", img: "image-resource", audio: "media-resource", video: "media-resource", source: "media-resource" })[tag] || "resource";
  };
  function publishVital(metric, value) { const cleanValue = metric === "cls" ? Number(Number(value || 0).toFixed(3)) : Math.round(Number(value || 0)); runtimeVitals[metric] = cleanValue; record("performance", { action: `web-vital-${metric}`, meta: { metric, value: cleanValue, rating: vitalRating(metric, cleanValue) } }); }
  function installTelemetry() {
    if (window.__HH_INSIGHTS_TRACKING__) return;
    window.__HH_INSIGHTS_TRACKING__ = true;
    writeJson(SESSION_KEY, sessionState(), sessionStorage);
    record("session_start", { action: "session-start", meta: { source: trafficSource() } });
    record("page_view", { action: "open-route", meta: { source: trafficSource() } });
    window.addEventListener("hashchange", () => record("page_view", { action: "open-route", meta: { source: "internal" } }));
    document.addEventListener("click", (event) => { const target = event.target.closest("button, [data-app-route], a[href^='#/']"); if (!target || target.closest("[data-insights-no-track]")) return; lastInteractionAt = Date.now(); const nextRoute = target.dataset.appRoute || target.getAttribute("href")?.replace(/^#/, "") || routeName(); record("action", { route: nextRoute, module: moduleName(nextRoute), action: actionKey(target), meta: { region: clickRegion(event) } }); }, { passive: true });
    document.addEventListener("pointerdown", () => { lastInteractionAt = Date.now(); }, { passive: true });
    document.addEventListener("focusin", (event) => { const field = event.target.closest?.("input, textarea, select"); const form = field?.form || field?.closest?.("form"); if (!form || formTelemetry.has(form)) return; formTelemetry.set(form, { startedAt: Date.now() }); record("form_start", { action: "form-start", meta: { form: formKey(form), kind: formKind(form), fieldType: sensitiveField(field) ? "credential" : safeKey(field.type || field.tagName.toLowerCase(), "text") } }); }, { passive: true });
    document.addEventListener("change", (event) => { const field = event.target.closest?.("select, input[type='checkbox'], input[type='radio']"); const form = field?.form || field?.closest?.("form"); if (!form) return; record("control_change", { action: "control-change", meta: { form: formKey(form), kind: formKind(form), fieldType: safeKey(field.type || field.tagName.toLowerCase(), "text") } }); }, { passive: true });
    document.addEventListener("invalid", (event) => { const field = event.target.closest?.("input, textarea, select"); const form = field?.form || field?.closest?.("form"); if (!form) return; record("form_validation", { action: "validation-error", meta: { form: formKey(form), kind: formKind(form), fieldType: sensitiveField(field) ? "credential" : safeKey(field.type || field.tagName.toLowerCase(), "text"), valid: false } }); }, true);
    document.addEventListener("submit", (event) => { const form = event.target.closest?.("form"); if (!form) return; const state = formTelemetry.get(form) || { startedAt: Date.now() }; record("form_submit", { action: `${formKind(form)}-submit`, meta: { form: formKey(form), kind: formKind(form), fieldCount: form.querySelectorAll("input, textarea, select").length, durationBucket: durationBucket(Date.now() - state.startedAt), valid: form.checkValidity() } }); formTelemetry.delete(form); flushRemote(true); }, true);
    document.addEventListener("visibilitychange", updateSession);
    window.addEventListener("pagehide", () => { record("session_end", { action: "session-end" }); flushRemote(true); });
    window.addEventListener("error", (event) => { const errorKind = classifyBrowserError(event); record("error", { action: `${errorKind}-error`, meta: { errorKind } }); });
    window.addEventListener("unhandledrejection", () => record("error", { action: "unhandled-rejection", meta: { errorKind: "unhandled-rejection" } }));
    document.addEventListener("securitypolicyviolation", (event) => record("error", { action: "csp-violation", meta: { errorKind: classifyBrowserError(event) } }));
    setInterval(updateSession, 15000); setInterval(() => flushRemote(), REMOTE_FLUSH_MS); setTimeout(() => flushRemote(true), 1200);
    if ("PerformanceObserver" in window) {
      try { new PerformanceObserver((list) => { const last = list.getEntries().at(-1); if (last) publishVital("lcp", last.startTime); }).observe({ type: "largest-contentful-paint", buffered: true }); } catch {}
      try { new PerformanceObserver((list) => { list.getEntries().forEach((entry) => { if (!entry.hadRecentInput) runtimeVitals.cls += Number(entry.value || 0); }); publishVital("cls", runtimeVitals.cls); }).observe({ type: "layout-shift", buffered: true }); } catch {}
      try { new PerformanceObserver((list) => { const longest = Math.max(0, ...list.getEntries().map((entry) => Number(entry.duration || 0))); if (longest) publishVital("inp", Math.max(runtimeVitals.inp, longest)); }).observe({ type: "event", buffered: true, durationThreshold: 40 }); } catch {}
    }
    window.addEventListener("load", () => setTimeout(() => { const navigation = performance.getEntriesByType?.("navigation")?.[0]; const paint = performance.getEntriesByName?.("first-contentful-paint")?.[0]; publishVital("fcp", paint?.startTime || 0); publishVital("ttfb", navigation?.responseStart || 0); publishVital("load", navigation?.duration || 0); }, 1200), { once: true });
  }

  const rangeStart = (range, now = Date.now()) => range === "all" ? 0 : now - ({ "5m": 300000, "30m": 1800000, "7d": 604800000, "30d": 2592000000, "7": 604800000, "30": 2592000000 }[range] || 604800000);
  const filteredEvents = (range) => events().filter((item) => new Date(item.createdAt).getTime() >= rangeStart(range));
  const uniqueSessions = (rows, predicate) => new Set(rows.filter(predicate).map((row) => row.sessionId).filter(Boolean)).size;
  const countBy = (rows, selector) => { const result = new Map(); rows.forEach((row) => { const key = selector(row); if (key) result.set(key, (result.get(key) || 0) + 1); }); return [...result.entries()].sort((a, b) => b[1] - a[1]); };
  const formatNumber = (value) => Number(value || 0).toLocaleString("vi-VN");
  const formatDuration = (seconds) => seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  function cohortRows(rows) {
    const sessions = new Map();
    rows.forEach((row) => { if (!row.sessionId) return; const day = String(row.createdAt).slice(0, 10); if (!sessions.has(row.sessionId)) sessions.set(row.sessionId, new Set()); sessions.get(row.sessionId).add(day); });
    const cohorts = new Map();
    sessions.forEach((days, id) => { const first = [...days].sort()[0]; if (!cohorts.has(first)) cohorts.set(first, []); cohorts.get(first).push({ id, days }); });
    return [...cohorts.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7).map(([date, members]) => { const plus = (offset) => { const day = new Date(`${date}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + offset); return day.toISOString().slice(0, 10); }; return { date, size: members.length, d1: members.filter((item) => item.days.has(plus(1))).length, d7: members.filter((item) => item.days.has(plus(7))).length, d30: members.filter((item) => item.days.has(plus(30))).length }; });
  }
  function experimentRows(rows) {
    const groups = new Map();
    rows.filter((row) => row.meta?.experimentId && row.meta?.variant).forEach((row) => { const key = `${row.meta.experimentId}:${row.meta.variant}`; const value = groups.get(key) || { id: row.meta.experimentId, variant: row.meta.variant, exposures: 0, conversions: 0 }; if (row.type === "experiment_exposure") value.exposures += 1; if (row.type === "experiment_conversion") value.conversions += 1; groups.set(key, value); });
    return [...groups.values()].map((item) => ({ ...item, rate: item.exposures ? item.conversions / item.exposures : 0 }));
  }
  function detectAnomalies(allRows) {
    const now = Date.now(); const current = allRows.filter((row) => new Date(row.createdAt).getTime() >= now - 300000); const previous = allRows.filter((row) => { const time = new Date(row.createdAt).getTime(); return time >= now - 600000 && time < now - 300000; });
    const alerts = [];
    if (current.length >= Math.max(8, previous.length * 2.5)) alerts.push({ level: "warn", title: "Tăng đột biến sự kiện", note: `${current.length} trong 5 phút, kỳ trước ${previous.length}.` });
    const errors = current.filter((row) => row.type === "error").length; const previousErrors = previous.filter((row) => row.type === "error").length; if (errors) alerts.push({ level: "danger", title: errors >= Math.max(3, previousErrors * 2) ? "Lỗi JavaScript tăng bất thường" : "Có lỗi JavaScript", note: `${errors} lỗi đã được phân loại; kỳ trước ${previousErrors}; không lưu nội dung lỗi hoặc stack.` });
    Object.entries(runtimeVitals).forEach(([metric, value]) => { if (value && vitalRating(metric, value) === "poor") alerts.push({ level: "warn", title: `${metric.toUpperCase()} kém`, note: `Giá trị phiên hiện tại: ${value}.` }); });
    return alerts;
  }
  function aggregate(range = "7d") {
    const allRows = events(); const rows = filteredEvents(range); const views = rows.filter((item) => item.type === "page_view"); const actions = rows.filter((item) => item.type === "action"); const session = updateSession();
    const funnel = [
      { id: "visit", label: "Phiên truy cập", value: uniqueSessions(rows, (row) => row.type === "page_view") },
      { id: "engage", label: "Có tương tác", value: uniqueSessions(rows, (row) => row.type === "action") },
      { id: "form", label: "Bắt đầu form", value: uniqueSessions(rows, (row) => row.type === "form_start") },
      { id: "submit", label: "Gửi form", value: uniqueSessions(rows, (row) => row.type === "form_submit") },
      { id: "conversion", label: "Chuyển đổi", value: uniqueSessions(rows, (row) => row.type === "conversion" || row.type === "experiment_conversion") }
    ];
    return { rows, views, actions, routes: new Set(views.map((item) => item.route)), sessions: uniqueSessions(rows, () => true), topModules: countBy(rows, (row) => row.module).slice(0, 8), sources: countBy(rows, (row) => row.meta?.source), regions: countBy(actions, (row) => row.meta?.region), errors: countBy(rows.filter((row) => row.type === "error"), (row) => row.meta?.errorKind || "runtime"), funnel, cohorts: cohortRows(allRows), experiments: experimentRows(allRows), alerts: detectAnomalies(allRows), session, vitals: { ...runtimeVitals }, adapter: readState().adapter };
  }
  function assignExperiment(id, variants = ["A", "B"]) {
    if (!analyticsAllowed()) return { id: safeKey(id, "experiment"), variant: "", tracked: false, reason: "analytics-consent-required" };
    const experimentId = safeKey(id, "experiment", 64); const allowed = variants.map((item) => String(item).toUpperCase()).filter((item) => META_ENUMS.variant.includes(item)); if (allowed.length < 2) return { id: experimentId, variant: "", tracked: false, reason: "two-variants-required" };
    const state = readState(); let variant = state.assignments[experimentId];
    if (!allowed.includes(variant)) { const hash = [...`${presenceId()}:${experimentId}`].reduce((sum, character) => ((sum * 31) + character.charCodeAt(0)) >>> 0, 7); variant = allowed[hash % allowed.length]; state.assignments[experimentId] = variant; state.experiments[experimentId] = { id: experimentId, variants: allowed, createdAt: new Date().toISOString() }; saveState(state); record("experiment_exposure", { action: "experiment-exposure", meta: { experimentId, variant } }); }
    return { id: experimentId, variant, tracked: true };
  }
  function convertExperiment(id) { const experimentId = safeKey(id, "experiment", 64); const variant = readState().assignments[experimentId]; if (!variant || !analyticsAllowed()) return false; record("experiment_conversion", { action: "experiment-conversion", meta: { experimentId, variant } }); return true; }
  const isAdminViewer = () => { try { const user = JSON.parse(localStorage.getItem("hh-auth-user") || "{}"); const roles = [user.role, ...(Array.isArray(user.roles) ? user.roles : [])].map((item) => String(item).toLowerCase()); return roles.some((role) => ["admin", "owner", "moderator"].includes(role)); } catch { return false; } };

  const tools = [
    { id: "analytics", title: "Analytics Intelligence", route: "/analytics/analytics", icon: "↗", tone: "cyan", description: "Realtime, funnel, cohort, Web Vitals và thử nghiệm có ranh giới riêng tư.", badges: ["5/30 phút", "Consent"] },
    { id: "smart-search", title: "Smart Search", route: "/analytics/smart-search", icon: "⌕", tone: "violet", description: "Tìm xuyên module, dự án, tài liệu và media.", badges: ["Index", "Filters"] },
    { id: "api-center", title: "API Center", route: "/analytics/api-center", icon: "⇆", tone: "green", description: "Thử endpoint, đo độ trễ và xem phản hồi.", badges: ["REST", "Latency"] },
    { id: "developer-hub", title: "Developer Hub", route: "/analytics/developer-hub", icon: "⌘", tone: "blue", description: "Theo dõi tích hợp và lịch sử cập nhật hệ thống.", badges: ["Deploy", "Audit"] },
    { id: "security-center", title: "Security Center", route: "/analytics/security-center", icon: "◇", tone: "pink", description: "Kiểm tra phiên và điểm an toàn tài khoản.", badges: ["JWT", "Security"] },
    { id: "status-page", title: "Status & Uptime", route: "/analytics/status-page", icon: "●", tone: "green", description: "Health check và lịch sử độ trễ dịch vụ.", badges: ["Uptime", "Incidents"] },
    { id: "feature-flag-dashboard", title: "Feature Flags", route: "/analytics/feature-flag-dashboard", icon: "⚑", tone: "gold", description: "Rollout runtime và quản lý thử nghiệm.", badges: ["Runtime", "A/B"] }
  ];
  function sourceBadge(data) { return data.adapter.confirmed ? `<span class="insights-source is-confirmed"><i></i> Backend xác nhận · ${formatNumber(data.adapter.online)} online</span>` : '<span class="insights-source is-demo"><i></i> Demo cục bộ · chỉ thiết bị này</span>'; }
  function overviewMarkup(admin) {
    const data = aggregate("7d"); const allTools = admin ? [...tools, { id: "admin-panel", title: "Admin Control Center", route: "/analytics/admin-panel", icon: "⚙", tone: "red", description: "Quản trị người dùng, báo cáo và audit theo RBAC.", badges: ["Admin", "RBAC"] }] : tools;
    return `<section class="insights-pro insights-overview" data-insights-overview><header class="insights-hero"><div class="insights-hero__copy"><span class="insights-eyebrow"><i></i> HH INTELLIGENCE LAYER</span><h2>Biến dữ liệu thành <em>quyết định rõ ràng.</em></h2><p>Phân tích local-first có consent, schema sự kiện công bố và trạng thái adapter trung thực.</p><div class="insights-hero__actions"><button type="button" class="primary" data-app-route="/analytics/analytics">Mở Analytics</button><button type="button" data-insights-health>Kiểm tra hệ thống</button><button type="button" data-insights-export="json">Xuất báo cáo</button></div></div><div class="insights-orbit" aria-hidden="true"><span></span><span></span><span></span><strong>HH<small>INSIGHTS</small></strong></div></header><section class="insights-livebar" aria-label="Trạng thái phân tích">${sourceBadge(data)}<span><b>${formatNumber(data.views.length)}</b> lượt xem cục bộ</span><span><b>${formatNumber(data.actions.length)}</b> thao tác</span><span><b>${data.alerts.length}</b> cảnh báo</span></section><div class="insights-command"><label><span>⌕</span><input type="search" data-insights-tool-search aria-label="Tìm công cụ phân tích" placeholder="Tìm Analytics, API, bảo mật..."></label></div><div class="insights-layout"><section class="insights-tool-grid" aria-label="Công cụ phân tích">${allTools.map((tool) => `<button type="button" class="insights-tool-card ${tool.tone}" data-app-route="${tool.route}" data-insights-tool="${escapeHtml(`${tool.id} ${tool.title} ${tool.description}`.toLowerCase())}"><span class="insights-tool-card__icon">${tool.icon}</span><small>${tool.badges.map((badge) => `<b>${badge}</b>`).join("")}</small><strong>${tool.title}</strong><p>${tool.description}</p><i>Khởi chạy <b>↗</b></i></button>`).join("")}</section><aside class="insights-side"><section class="insights-health" data-insights-health-output aria-live="polite"><header><small>SYSTEM CHECK</small><strong>Sẵn sàng kiểm tra</strong></header><p>Adapter backend chỉ được gắn nhãn thật sau khi API trả xác nhận.</p></section><section class="insights-privacy"><span>◇</span><div><strong>Ranh giới riêng tư</strong><p>Không thu phím gõ, giá trị form, prompt, mật khẩu, token, message, error message hoặc stack.</p></div></section></aside></div></section>`;
  }
  const barRows = (rows, empty = "Chưa có dữ liệu.") => { const max = Math.max(1, ...rows.map(([, value]) => value)); return rows.map(([label, value]) => `<li><span>${escapeHtml(label)}</span><i><b style="--value:${Math.round(value / max * 100)}%"></b></i><strong>${formatNumber(value)}</strong></li>`).join("") || `<li class="insights-empty">${empty}</li>`; };
  function realtimePanel(data, range) {
    const total = Math.max(1, data.funnel[0].value);
    return `<div class="insights-analysis-grid"><section class="insights-analysis-card"><header><div><small>REALTIME ${range === "5m" ? "5" : "30"} PHÚT</small><h3>Tín hiệu trên thiết bị</h3></div>${sourceBadge(data)}</header><dl class="insights-kpi-list"><div><dt>Sự kiện</dt><dd>${formatNumber(data.rows.length)}</dd></div><div><dt>Phiên</dt><dd>${formatNumber(data.sessions)}</dd></div><div><dt>Lỗi JS</dt><dd>${formatNumber(data.errors.reduce((sum, item) => sum + item[1], 0))}</dd></div></dl><p class="insights-disclaimer">Số trên thẻ này là local. Chỉ Admin view mới hiển thị tổng backend sau xác nhận adapter.</p></section><section class="insights-analysis-card"><small>FUNNEL</small><h3>Hành trình công khai</h3><ol class="insights-funnel">${data.funnel.map((step) => `<li><span>${escapeHtml(step.label)}</span><i style="--value:${Math.max(3, Math.round(step.value / total * 100))}%"></i><strong>${step.value}</strong><small>${Math.round(step.value / total * 100)}%</small></li>`).join("")}</ol></section><section class="insights-analysis-card"><small>NGUỒN TRUY CẬP</small><h3>Phân loại referrer</h3><ul class="insights-bar-list">${barRows(data.sources)}</ul></section><section class="insights-analysis-card"><small>CLICK-REGION HEATMAP</small><h3>Lưới 3 × 3, không tọa độ thô</h3><div class="insights-heatmap" role="img" aria-label="Bản đồ nhiệt vùng click">${META_ENUMS.region.filter(Boolean).map((region) => { const value = data.regions.find(([key]) => key === region)?.[1] || 0; const max = Math.max(1, ...data.regions.map(([, count]) => count)); return `<span style="--heat:${value / max}" title="${region}: ${value}"><b>${value}</b><small>${region}</small></span>`; }).join("")}</div></section></div>`;
  }
  function journeyPanel(data) {
    const cohort = data.cohorts;
    return `<div class="insights-analysis-grid"><section class="insights-analysis-card insights-wide"><small>COHORT & RETENTION</small><h3>Phiên quay lại theo ngày đầu</h3><div class="insights-table-scroll"><table><caption>Dữ liệu cục bộ định hướng; một session được nhận diện bằng ID ngẫu nhiên có version.</caption><thead><tr><th>Cohort</th><th>Phiên</th><th>D+1</th><th>D+7</th><th>D+30</th></tr></thead><tbody>${cohort.map((row) => `<tr><th>${row.date}</th><td>${row.size}</td><td>${row.d1} · ${row.size ? Math.round(row.d1 / row.size * 100) : 0}%</td><td>${row.d7} · ${row.size ? Math.round(row.d7 / row.size * 100) : 0}%</td><td>${row.d30} · ${row.size ? Math.round(row.d30 / row.size * 100) : 0}%</td></tr>`).join("") || '<tr><td colspan="5">Cần dữ liệu nhiều ngày để tính retention.</td></tr>'}</tbody></table></div></section><section class="insights-analysis-card"><small>TOP MODULE</small><h3>Khu vực sử dụng</h3><ul class="insights-bar-list">${barRows(data.topModules)}</ul></section><section class="insights-analysis-card"><small>Funnel note</small><h3>Định nghĩa minh bạch</h3><p>Visit → action → form start → submit → conversion. Không suy đoán nội dung form hay danh tính người dùng.</p></section></div>`;
  }
  function qualityPanel(data) {
    const vitalCards = Object.entries(data.vitals).map(([metric, value]) => `<article class="${vitalRating(metric, value)}"><span>${metric.toUpperCase()}</span><strong>${metric === "cls" ? Number(value).toFixed(3) : `${value || "-"}${value ? " ms" : ""}`}</strong><small>${value ? vitalRating(metric, value) : "chưa đo"}</small></article>`).join("");
    return `<div class="insights-analysis-grid"><section class="insights-analysis-card insights-wide"><small>CORE WEB VITALS</small><h3>Phiên hiện tại</h3><div class="insights-vital-grid">${vitalCards}</div></section><section class="insights-analysis-card"><small>JAVASCRIPT ERRORS</small><h3>Chỉ phân loại an toàn</h3><ul class="insights-bar-list">${barRows(data.errors, "Chưa ghi nhận lỗi.")}</ul><p class="insights-disclaimer">Không lưu message, stack, URL tài nguyên hoặc payload rejection.</p></section><section class="insights-analysis-card"><small>ANOMALY ALERTS</small><h3>So sánh 5 phút</h3><div class="insights-alerts" role="status">${data.alerts.map((alert) => `<article class="${alert.level}"><strong>${escapeHtml(alert.title)}</strong><p>${escapeHtml(alert.note)}</p></article>`).join("") || "<p>Chưa phát hiện bất thường theo ngưỡng cục bộ.</p>"}</div></section></div>`;
  }
  function experimentPanel(data) {
    const assignment = readState().assignments["analytics-cta-v1"] || "chưa gán";
    return `<div class="insights-analysis-grid"><section class="insights-analysis-card"><small>A/B SANDBOX</small><h3>analytics-cta-v1 · ${escapeHtml(assignment)}</h3><p>SDK local-first gán ổn định; không tự thay đổi UI sản phẩm. Cần consent trước khi exposure/conversion được ghi.</p><div class="insights-card-actions"><button type="button" data-insights-exposure>Gán & ghi exposure</button><button type="button" class="primary" data-insights-conversion>Ghi conversion</button></div></section><section class="insights-analysis-card insights-wide"><small>EXPERIMENT RESULTS</small><h3>Kết quả quan sát</h3><div class="insights-table-scroll"><table><caption>Chưa tuyên bố winner nếu không đủ mẫu; dashboard chỉ báo conversion rate.</caption><thead><tr><th>Experiment</th><th>Variant</th><th>Exposure</th><th>Conversion</th><th>Rate</th></tr></thead><tbody>${data.experiments.map((item) => `<tr><th>${escapeHtml(item.id)}</th><td>${item.variant}</td><td>${item.exposures}</td><td>${item.conversions}</td><td>${(item.rate * 100).toFixed(1)}%</td></tr>`).join("") || '<tr><td colspan="5">Chưa có dữ liệu thử nghiệm.</td></tr>'}</tbody></table></div></section></div>`;
  }
  function adminPanel() {
    if (!isAdminViewer()) return '<section class="insights-analysis-card"><h3>Không có quyền</h3><p>Admin Analytics yêu cầu role admin/owner.</p></section>';
    if (adminLoading) return '<section class="insights-analysis-card" aria-live="polite"><h3>Đang xác nhận adapter backend…</h3></section>';
    if (!adminSnapshot?.adapter?.confirmed) return '<section class="insights-analysis-card"><small>ADMIN VIEW</small><h3>Chưa có backend được xác nhận</h3><p>Không hiển thị số tổng giả. Hãy kiểm tra cấu hình API hoặc thử lại.</p><button type="button" data-insights-admin-refresh>Thử lại</button></section>';
    const data = adminSnapshot;
    return `<div class="insights-analysis-grid"><section class="insights-analysis-card insights-wide"><header><div><small>ADMIN VIEW · BACKEND</small><h3>MongoDB adapter đã xác nhận</h3></div><span class="insights-source is-confirmed"><i></i>${escapeHtml(data.adapter.provider)}</span></header><dl class="insights-kpi-list"><div><dt>Sự kiện 5 phút</dt><dd>${formatNumber(data.windows?.fiveMinutes?.events)}</dd></div><div><dt>Sự kiện 30 phút</dt><dd>${formatNumber(data.windows?.thirtyMinutes?.events)}</dd></div><div><dt>Online</dt><dd>${formatNumber(data.online)}</dd></div><div><dt>Lỗi JS 30 phút</dt><dd>${formatNumber(data.windows?.thirtyMinutes?.errors)}</dd></div></dl><button type="button" data-insights-admin-refresh>Làm mới backend</button></section><section class="insights-analysis-card"><small>TOP ROUTES · 30M</small><ul class="insights-bar-list">${barRows((data.topRoutes || []).map((row) => [row.route, row.count]))}</ul></section><section class="insights-analysis-card"><small>PRIVACY CONTRACT</small><p>Backend chỉ trả số tổng. Không trả identity, userId, sessionId, message, stack, form values hoặc token.</p></section></div>`;
  }
  function analyticsMarkup(range = "30m", tab = "realtime") {
    const data = aggregate(range); const tabs = [["realtime", "Realtime"], ["journey", "Funnel & Cohort"], ["quality", "Quality"], ["experiments", "A/B Test"], ...(isAdminViewer() ? [["admin", "Admin"]] : [])];
    const panel = tab === "journey" ? journeyPanel(data) : tab === "quality" ? qualityPanel(data) : tab === "experiments" ? experimentPanel(data) : tab === "admin" ? adminPanel() : realtimePanel(data, range === "5m" ? "5m" : "30m");
    return `<section class="insights-pro insights-analytics" data-insights-analytics data-range="${range}" data-tab="${tab}"><header class="insights-analytics-hero"><div><span class="insights-eyebrow"><i></i> ANALYTICS INTELLIGENCE</span><h2>Đọc đúng tín hiệu.<br><em>Giữ đúng ranh giới.</em></h2><p>Realtime 5/30 phút, funnel, retention, cohort, nguồn truy cập, heatmap, lỗi JS, Web Vitals, A/B và cảnh báo — chỉ khi có consent.</p></div><div class="insights-score"><small>LOCAL EVENTS</small><strong>${data.rows.length}</strong><span>${analyticsAllowed() ? "Consent đã bật" : "Consent chưa bật"}</span></div></header><div class="insights-analytics-toolbar"><nav aria-label="Các chế độ Analytics">${tabs.map(([id, label]) => `<button type="button" data-insights-tab="${id}" class="${tab === id ? "active" : ""}" aria-pressed="${tab === id}">${label}</button>`).join("")}</nav><div><label class="insights-range-label"><span>Khoảng</span><select data-insights-range><option value="5m" ${range === "5m" ? "selected" : ""}>5 phút</option><option value="30m" ${range === "30m" ? "selected" : ""}>30 phút</option><option value="7d" ${range === "7d" ? "selected" : ""}>7 ngày</option><option value="30d" ${range === "30d" ? "selected" : ""}>30 ngày</option><option value="all" ${range === "all" ? "selected" : ""}>Tất cả</option></select></label><button type="button" data-insights-refresh>↻ Làm mới</button><button type="button" class="primary" data-insights-export="csv">Xuất CSV</button></div></div><section class="insights-metrics"><article><small>Phiên</small><strong>${formatNumber(data.sessions)}</strong><p>session ID ngẫu nhiên</p></article><article><small>Page views</small><strong>${formatNumber(data.views.length)}</strong><p>route đã lọc query</p></article><article><small>Actions</small><strong>${formatNumber(data.actions.length)}</strong><p>control công khai</p></article><article><small>Active</small><strong>${formatDuration(data.session.activeSeconds || 0)}</strong><p>phiên hiện tại</p></article></section><div data-insights-pane>${panel}</div></section>`;
  }
  function mountOverview(host, options = {}) { if (host) host.innerHTML = overviewMarkup(Boolean(options.admin)); }
  function mountAnalytics(host) { if (!host) return; analyticsHost = host; host.innerHTML = analyticsMarkup("30m", "realtime"); clearInterval(liveTimer); liveTimer = setInterval(() => { const root = analyticsHost?.querySelector("[data-insights-analytics]"); if (root && !document.hidden && ["5m", "30m"].includes(root.dataset.range)) rerenderAnalytics(); }, 15000); }
  function rerenderAnalytics() { const root = analyticsHost?.querySelector("[data-insights-analytics]"); if (analyticsHost && root) analyticsHost.innerHTML = analyticsMarkup(root.dataset.range || "30m", root.dataset.tab || "realtime"); }
  function download(name, content, type) { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
  function exportReport(format = "json") { const root = document.querySelector("[data-insights-analytics]"); const range = root?.dataset.range || "30m"; const data = aggregate(range); const safeRows = data.rows.map(({ type, route, module, action, meta, createdAt }) => ({ type, route, module, action, meta, createdAt })); const date = new Date().toISOString().slice(0, 10); if (format === "csv") { const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`; const csv = [["type", "action", "module", "route", "createdAt"], ...safeRows.map((item) => [item.type, item.action, item.module, item.route, item.createdAt])].map((row) => row.map(quote).join(",")).join("\n"); download(`hh-analytics-${date}.csv`, csv, "text/csv;charset=utf-8"); return; } download(`hh-analytics-${date}.json`, JSON.stringify({ version: STATE_VERSION, generatedAt: new Date().toISOString(), range, vitals: data.vitals, events: safeRows }, null, 2), "application/json;charset=utf-8"); }
  async function runHealthCheck(root) { const output = root.querySelector("[data-insights-health-output]") || document.querySelector("[data-insights-health-output]"); if (!output) return; output.innerHTML = "<header><small>SYSTEM CHECK</small><strong>Đang đo kết nối…</strong></header>"; const endpoints = [{ name: "Frontend", url: location.origin }, ...(API_BASE ? [{ name: "Analytics adapter", url: `${API_BASE}/api/platform/summary?view=health` }] : [])]; const results = await Promise.all(endpoints.map(async (endpoint) => { const started = performance.now(); try { const response = await fetch(endpoint.url, { cache: "no-store" }); const body = await response.json().catch(() => ({})); return { ...endpoint, ok: response.ok, confirmed: endpoint.name === "Frontend" || body?.ok === true, latency: Math.round(performance.now() - started) }; } catch { return { ...endpoint, ok: false, confirmed: false, latency: Math.round(performance.now() - started) }; } })); output.innerHTML = `<header><small>SYSTEM CHECK</small><strong>${results.every((item) => item.ok) ? "Đã kiểm tra" : "Có dịch vụ cần xem lại"}</strong></header>${results.map((item) => `<p><i class="${item.ok && item.confirmed ? "online" : "offline"}"></i><span>${item.name}</span><b>${item.ok && item.confirmed ? `${item.latency} ms · xác nhận` : "chưa xác nhận"}</b></p>`).join("")}`; record("diagnostic", { action: "health-check" }); }
  async function loadAdminSnapshot() { if (!isAdminViewer() || adminLoading) return; adminLoading = true; rerenderAnalytics(); try { const token = window.HHAuthSession?.token?.() || ""; const response = await fetch(`${API_BASE}/api/platform/summary?view=analytics&window=30m`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }); const data = await response.json().catch(() => ({})); adminSnapshot = response.ok && data?.adapter?.confirmed === true ? data : null; } catch { adminSnapshot = null; } finally { adminLoading = false; rerenderAnalytics(); } }

  document.addEventListener("click", (event) => {
    const scope = event.target.closest(".insights-pro"); if (!scope) return;
    const tab = event.target.closest("[data-insights-tab]"); if (tab && analyticsHost) { const root = analyticsHost.querySelector("[data-insights-analytics]"); analyticsHost.innerHTML = analyticsMarkup(root?.dataset.range || "30m", tab.dataset.insightsTab); if (tab.dataset.insightsTab === "admin") loadAdminSnapshot(); return; }
    if (event.target.closest("[data-insights-refresh]")) { record("refresh", { action: "analytics-refresh" }); rerenderAnalytics(); return; }
    if (event.target.closest("[data-insights-health]")) { runHealthCheck(scope); return; }
    if (event.target.closest("[data-insights-admin-refresh]")) { loadAdminSnapshot(); return; }
    if (event.target.closest("[data-insights-exposure]")) { assignExperiment("analytics-cta-v1", ["A", "B"]); rerenderAnalytics(); return; }
    if (event.target.closest("[data-insights-conversion]")) { convertExperiment("analytics-cta-v1"); rerenderAnalytics(); return; }
    const exportButton = event.target.closest("[data-insights-export]"); if (exportButton) { exportReport(exportButton.dataset.insightsExport); record("export", { action: `export-${exportButton.dataset.insightsExport}` }); }
  });
  document.addEventListener("change", (event) => { if (!event.target.matches("[data-insights-range]") || !analyticsHost) return; const root = analyticsHost.querySelector("[data-insights-analytics]"); analyticsHost.innerHTML = analyticsMarkup(event.target.value, root?.dataset.tab || "realtime"); });
  document.addEventListener("input", (event) => { if (event.target.matches("[data-insights-tool-search]")) { const query = event.target.value.trim().toLowerCase(); event.target.closest("[data-insights-overview]")?.querySelectorAll("[data-insights-tool]").forEach((item) => { item.hidden = Boolean(query) && !item.dataset.insightsTool.includes(query); }); } });
  window.addEventListener("hh:privacy-changed", (event) => { if (event.detail?.analytics === true) { record("session_start", { action: "consent-enabled", meta: { source: trafficSource() } }); flushRemote(true); return; } remoteQueue = []; saveState(emptyState()); try { localStorage.removeItem(PRESENCE_KEY); } catch {} rerenderAnalytics(); });

  installFeatureAccessGuard();
  installTelemetry();
  window.HHInsights = Object.freeze({ mountOverview, mountAnalytics, record, flush: () => flushRemote(true), snapshot: aggregate, experiment: Object.freeze({ assign: assignExperiment, convert: convertExperiment }), eventCatalog: Object.freeze(Object.keys(PUBLIC_EVENT_CATALOG)), errorTaxonomy: Object.freeze(META_ENUMS.errorKind.filter(Boolean)), stateVersion: STATE_VERSION });
  window.dispatchEvent(new CustomEvent("hh:insights-ready"));
})();
