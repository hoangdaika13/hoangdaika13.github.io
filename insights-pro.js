(() => {
  "use strict";

  const STORE_KEY = "hh.insights.events.v2";
  const SESSION_KEY = "hh.insights.session.v2";
  const MAX_EVENTS = 600;
  const REMOTE_BATCH_SIZE = 20;
  const REMOTE_FLUSH_MS = 15000;
  const API_BASE = String(window.HH_REALTIME_URL || "").replace(/\/$/, "");
  const runtimeVitals = { lcp: 0, cls: 0, inp: 0 };
  let analyticsHost = null;
  let remoteQueue = [];
  let remoteSending = false;
  let lastRemoteAt = 0;
  let lastInteractionAt = Date.now();
  let lastAllowedRoute = "/home";
  const formTelemetry = new WeakMap();

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
    catch { return fallback; }
  };
  const writeJson = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { /* Analytics remains available in-memory when storage is full. */ }
  };
  const events = () => {
    const value = readJson(STORE_KEY, []);
    return Array.isArray(value) ? value : [];
  };
  const routeName = (route = location.hash.replace(/^#/, "") || "/home") => route.split("?")[0].slice(0, 160);
  const moduleName = (route) => routeName(route).split("/").filter(Boolean).at(-1) || "home";
  const actionKey = (target) => {
    const dataKey = Object.keys(target?.dataset || {}).find((key) => !["appRoute", "insightsNoTrack"].includes(key));
    if (dataKey) return dataKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, "");
    if (target?.dataset?.appRoute) return "open-route";
    return target?.tagName === "A" ? "open-link" : "button-action";
  };
  const browserKey = () => navigator.userAgent.includes("Edg/") ? "edge" : navigator.userAgent.includes("Chrome/") ? "chrome" : navigator.userAgent.includes("Firefox/") ? "firefox" : navigator.userAgent.includes("Safari/") ? "safari" : "browser";
  const deviceKey = () => innerWidth < 640 ? "mobile" : innerWidth < 1024 ? "tablet" : "desktop";
  const viewportKey = () => `${Math.round(innerWidth / 100) * 100}x${Math.round(innerHeight / 100) * 100}`;
  const analyticsAllowed = () => localStorage.getItem("hh-tracking-consent") === "yes";
  const bucketNumber = (value, ranges) => ranges.find(([max]) => value <= max)?.[1] || ranges.at(-1)?.[1] || "many";
  const lengthBucket = (value) => bucketNumber(Math.max(0, Number(value || 0)), [[0, "empty"], [20, "1-20"], [80, "21-80"], [240, "81-240"], [1000, "241-1000"], [Infinity, "1000+"]]);
  const interactionBucket = (value) => bucketNumber(Math.max(0, Number(value || 0)), [[0, "none"], [5, "1-5"], [20, "6-20"], [60, "21-60"], [Infinity, "60+"]]);
  const durationBucket = (milliseconds) => bucketNumber(Math.max(0, Number(milliseconds || 0)), [[5000, "0-5s"], [30000, "6-30s"], [120000, "31-120s"], [600000, "2-10m"], [Infinity, "10m+"]]);
  const sensitiveField = (field) => field?.type === "password" || /pass(word)?|token|secret|credential|otp|one.?time|api.?key|private.?key/i.test(`${field?.name || ""} ${field?.id || ""} ${field?.autocomplete || ""}`);
  const formKey = (form) => {
    const dataKey = Object.keys(form?.dataset || {}).find((key) => /form|composer|prompt|chat|message|login|register|search/i.test(key));
    return String(dataKey || form?.id || form?.getAttribute?.("name") || "form").replace(/[^a-z0-9_.:-]/gi, "-").toLowerCase().slice(0, 80) || "form";
  };
  const formKind = (form) => {
    const hint = `${formKey(form)} ${form?.className || ""}`.toLowerCase();
    return /login|register|auth/.test(hint) ? "authentication" : /prompt|ai-|composer-ai/.test(hint) ? "prompt" : /chat|message|comment|composer/.test(hint) ? "message" : /search/.test(hint) ? "search" : "form";
  };
  const safeMeta = (value = {}) => ({
    form: String(value.form || "").replace(/[^a-z0-9_.:-]/gi, "-").toLowerCase().slice(0, 80),
    kind: String(value.kind || "").replace(/[^a-z0-9_.:-]/gi, "-").toLowerCase().slice(0, 40),
    fieldType: String(value.fieldType || "").replace(/[^a-z0-9_.:-]/gi, "-").toLowerCase().slice(0, 40),
    fieldCount: Math.max(0, Math.min(100, Number(value.fieldCount || 0))),
    lengthBucket: String(value.lengthBucket || "").slice(0, 20),
    interactionBucket: String(value.interactionBucket || "").slice(0, 20),
    durationBucket: String(value.durationBucket || "").slice(0, 20),
    valid: value.valid !== false
  });
  const visitorId = () => {
    const key = "hh-presence-id";
    let value = localStorage.getItem(key);
    if (!value) { value = crypto.randomUUID?.() || `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem(key, value); }
    return value;
  };

  function record(type, detail = {}) {
    const row = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: String(type || "event").slice(0, 40),
      route: routeName(detail.route),
      module: String(detail.module || moduleName(detail.route)).slice(0, 80),
      action: String(detail.action || type || "event").replace(/[^a-z0-9_.:-]/gi, "-").toLowerCase().slice(0, 100),
      label: String(detail.label || "").replace(/\s+/g, " ").trim().slice(0, 100),
      meta: safeMeta(detail.meta),
      createdAt: new Date().toISOString()
    };
    writeJson(STORE_KEY, [row, ...events()].slice(0, MAX_EVENTS));
    if (analyticsAllowed()) remoteQueue.push({ ...row, label: "" });
    return row;
  }

  function sessionState() {
    const fallback = { id: Math.random().toString(36).slice(2), startedAt: Date.now(), activeSeconds: 0, lastActiveAt: Date.now() };
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null") || fallback; }
    catch { return fallback; }
  }

  function updateSession() {
    const state = sessionState();
    const now = Date.now();
    if (!document.hidden) state.activeSeconds += Math.max(0, Math.min(30, Math.round((now - Number(state.lastActiveAt || now)) / 1000)));
    state.lastActiveAt = now;
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(state)); } catch {}
    return state;
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
      const response = await fetch(`${API_BASE}/api/platform/summary`, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          visitorId: visitorId(), sessionId: state.id, page: routeName(), module: moduleName(routeName()),
          activeSeconds: state.activeSeconds, activityState: document.hidden ? "background" : Date.now() - lastInteractionAt > 60000 ? "idle" : "active",
          device: deviceKey(), browser: browserKey(), viewport: viewportKey(), analyticsConsent: consent, events: batch
        })
      });
      if (!response.ok) throw new Error("telemetry rejected");
      lastRemoteAt = Date.now();
      const data = await response.json().catch(() => ({}));
      if (data.policy && token) {
        try {
          const user = JSON.parse(localStorage.getItem("hh-auth-user") || "{}");
          user.restrictedFeatures = Array.isArray(data.policy.restrictedFeatures) ? data.policy.restrictedFeatures : [];
          localStorage.setItem("hh-auth-user", JSON.stringify(user));
        } catch {}
      }
      if (data.policy) localStorage.setItem("hh-disabled-features", JSON.stringify(Array.isArray(data.policy.disabledFeatures) ? data.policy.disabledFeatures : []));
      if (routeIsRestricted(routeName())) location.hash = "#/home";
    } catch {
      remoteQueue = [...batch, ...remoteQueue].slice(0, 100);
    } finally { remoteSending = false; }
  }

  function restrictedFeatures() {
    try {
      const user = JSON.parse(localStorage.getItem("hh-auth-user") || "{}");
      const disabled = JSON.parse(localStorage.getItem("hh-disabled-features") || "[]");
      return new Set([...(Array.isArray(user.restrictedFeatures) ? user.restrictedFeatures : []), ...(Array.isArray(disabled) ? disabled : [])]);
    } catch { return new Set(); }
  }

  function routeIsRestricted(route) {
    const denied = restrictedFeatures();
    const normalized = routeName(route);
    const parts = normalized.split("/").filter(Boolean);
    return [...denied].some((feature) => parts.includes(feature) || normalized.startsWith(`/${feature}/`));
  }

  function installFeatureAccessGuard() {
    document.addEventListener("click", (event) => {
      const target = event.target.closest("[data-app-route], a[href^='#/']");
      const nextRoute = target?.dataset?.appRoute || target?.getAttribute("href")?.replace(/^#/, "");
      if (!nextRoute || !routeIsRestricted(nextRoute)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.HHCommunity?.notice?.("Tính năng này đã được quản trị viên tạm giới hạn cho tài khoản của bạn.", "error");
    }, true);
    window.addEventListener("hashchange", () => {
      const current = routeName();
      if (routeIsRestricted(current)) {
        location.hash = `#${lastAllowedRoute}`;
        window.HHCommunity?.notice?.("Bạn không có quyền mở tính năng này.", "error");
      } else lastAllowedRoute = current;
    });
  }

  function installTelemetry() {
    if (window.__HH_INSIGHTS_TRACKING__) return;
    window.__HH_INSIGHTS_TRACKING__ = true;
    const session = sessionState();
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch {}
    record("session_start", { route: routeName(), action: "session-start", label: "Bắt đầu phiên" });
    record("page_view", { route: routeName(), action: "open-route" });
    window.addEventListener("hashchange", () => record("page_view", { route: routeName(), action: "open-route" }));
    document.addEventListener("click", (event) => {
      const target = event.target.closest("button, [data-app-route], a[href^='#/']");
      if (!target || target.closest("[data-insights-no-track]")) return;
      lastInteractionAt = Date.now();
      const nextRoute = target.dataset.appRoute || target.getAttribute("href")?.replace(/^#/, "") || routeName();
      record("action", { route: nextRoute, module: moduleName(nextRoute), action: actionKey(target) });
    }, { passive: true });
    document.addEventListener("keydown", () => { lastInteractionAt = Date.now(); }, { passive: true });
    document.addEventListener("focusin", (event) => {
      const field = event.target.closest?.("input, textarea, select");
      const form = field?.form || field?.closest?.("form");
      if (!form || formTelemetry.has(form)) return;
      const state = { startedAt: Date.now(), interactions: 0 };
      formTelemetry.set(form, state);
      record("form_start", { route: routeName(), action: "form-start", meta: { form: formKey(form), kind: formKind(form), fieldType: sensitiveField(field) ? "credential" : field.type || field.tagName.toLowerCase() } });
    }, { passive: true });
    document.addEventListener("input", (event) => {
      const field = event.target.closest?.("input, textarea");
      const form = field?.form || field?.closest?.("form");
      if (!form || sensitiveField(field)) return;
      const state = formTelemetry.get(form) || { startedAt: Date.now(), interactions: 0 };
      state.interactions += 1;
      formTelemetry.set(form, state);
    }, { passive: true });
    document.addEventListener("change", (event) => {
      const field = event.target.closest?.("select, input[type='checkbox'], input[type='radio']");
      const form = field?.form || field?.closest?.("form");
      if (!form) return;
      record("control_change", { route: routeName(), action: "control-change", meta: { form: formKey(form), kind: formKind(form), fieldType: field.type || field.tagName.toLowerCase() } });
    }, { passive: true });
    document.addEventListener("invalid", (event) => {
      const field = event.target.closest?.("input, textarea, select");
      const form = field?.form || field?.closest?.("form");
      if (!form) return;
      record("form_validation", { route: routeName(), action: "validation-error", meta: { form: formKey(form), kind: formKind(form), fieldType: sensitiveField(field) ? "credential" : field.type || field.tagName.toLowerCase(), valid: false } });
    }, true);
    document.addEventListener("submit", (event) => {
      const form = event.target.closest?.("form");
      if (!form) return;
      const state = formTelemetry.get(form) || { startedAt: Date.now(), interactions: 0 };
      const fields = [...form.querySelectorAll("input, textarea, select")];
      const measurable = fields.filter((field) => !sensitiveField(field) && ["INPUT", "TEXTAREA"].includes(field.tagName));
      const longest = measurable.reduce((max, field) => Math.max(max, String(field.value || "").length), 0);
      record("form_submit", { route: routeName(), action: `${formKind(form)}-submit`, meta: { form: formKey(form), kind: formKind(form), fieldCount: fields.length, lengthBucket: lengthBucket(longest), interactionBucket: interactionBucket(state.interactions), durationBucket: durationBucket(Date.now() - state.startedAt), valid: form.checkValidity() } });
      formTelemetry.delete(form);
      flushRemote(true);
    }, true);
    document.addEventListener("visibilitychange", updateSession);
    window.addEventListener("pagehide", () => { record("session_end", { route: routeName(), action: "session-end", label: "Kết thúc phiên" }); flushRemote(true); });
    setInterval(updateSession, 15000);
    setInterval(() => flushRemote(), REMOTE_FLUSH_MS);
    window.addEventListener("hh:auth-change", () => flushRemote(true));
    window.addEventListener("online", () => flushRemote(true));
    window.addEventListener("error", () => record("error", { route: routeName(), action: "window-error" }));
    window.addEventListener("unhandledrejection", () => record("error", { route: routeName(), action: "unhandled-rejection" }));
    window.addEventListener("load", () => setTimeout(() => record("performance", { route: routeName(), action: "web-vitals" }), 1200), { once: true });
    setTimeout(() => flushRemote(true), 1200);
    if ("PerformanceObserver" in window) {
      try { new PerformanceObserver((list) => { const last = list.getEntries().at(-1); runtimeVitals.lcp = Math.round(last?.startTime || runtimeVitals.lcp); }).observe({ type: "largest-contentful-paint", buffered: true }); } catch {}
      try { new PerformanceObserver((list) => { list.getEntries().forEach((entry) => { if (!entry.hadRecentInput) runtimeVitals.cls += Number(entry.value || 0); }); }).observe({ type: "layout-shift", buffered: true }); } catch {}
      try { new PerformanceObserver((list) => { const longest = Math.max(0, ...list.getEntries().map((entry) => Number(entry.duration || 0))); runtimeVitals.inp = Math.max(runtimeVitals.inp, Math.round(longest)); }).observe({ type: "event", buffered: true, durationThreshold: 40 }); } catch {}
    }
  }

  const rangeStart = (range) => range === "all" ? 0 : Date.now() - Number(range || 7) * 86400000;
  const filteredEvents = (range) => events().filter((item) => new Date(item.createdAt).getTime() >= rangeStart(range));
  const formatNumber = (value) => Number(value || 0).toLocaleString("vi-VN");
  const formatDuration = (seconds) => seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const browserName = () => navigator.userAgent.includes("Edg/") ? "Microsoft Edge" : navigator.userAgent.includes("Chrome/") ? "Chrome / Chromium" : navigator.userAgent.includes("Firefox/") ? "Firefox" : navigator.userAgent.includes("Safari/") ? "Safari" : "Web Browser";

  function vitals() {
    const navigation = performance.getEntriesByType?.("navigation")?.[0];
    const paint = performance.getEntriesByName?.("first-contentful-paint")?.[0];
    return {
      load: Math.round(navigation?.duration || 0),
      ttfb: Math.round(navigation?.responseStart || 0),
      fcp: Math.round(paint?.startTime || 0),
      lcp: runtimeVitals.lcp,
      cls: Number(runtimeVitals.cls.toFixed(3)),
      inp: runtimeVitals.inp
    };
  }

  function aggregate(range = "7") {
    const rows = filteredEvents(range);
    const views = rows.filter((item) => item.type === "page_view");
    const actions = rows.filter((item) => item.type === "action");
    const routes = new Set(views.map((item) => item.route));
    const modules = new Map();
    rows.forEach((item) => modules.set(item.module, (modules.get(item.module) || 0) + 1));
    const topModules = [...modules.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const days = range === "all" ? 14 : Math.min(14, Math.max(7, Number(range || 7)));
    const daily = Array.from({ length: days }, (_, index) => {
      const date = new Date(Date.now() - (days - index - 1) * 86400000);
      const key = date.toISOString().slice(0, 10);
      return { key, label: date.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit" }), value: views.filter((item) => String(item.createdAt).slice(0, 10) === key).length };
    });
    const session = updateSession();
    return { rows, views, actions, routes, topModules, daily, session, vitals: vitals() };
  }

  const tools = [
    { id: "analytics", title: "Analytics Intelligence", route: "/analytics/analytics", icon: "↗", tone: "cyan", description: "Traffic, hành trình module, hiệu suất và báo cáo có thể xuất.", badges: ["Realtime", "Web Vitals"] },
    { id: "smart-search", title: "Smart Search", route: "/analytics/smart-search", icon: "⌕", tone: "violet", description: "Tìm xuyên module, dự án, tài liệu, media và tệp đã đồng bộ.", badges: ["Index", "Filters"] },
    { id: "api-center", title: "API Center", route: "/analytics/api-center", icon: "⇆", tone: "green", description: "Thử endpoint, đo độ trễ, xem phản hồi và sao chép cURL.", badges: ["REST", "Latency"] },
    { id: "developer-hub", title: "Developer Hub", route: "/analytics/developer-hub", icon: "⌘", tone: "blue", description: "Theo dõi GitHub, Vercel API và lịch sử cập nhật hệ thống.", badges: ["GitHub", "Deploy"] },
    { id: "security-center", title: "Security Center", route: "/analytics/security-center", icon: "◇", tone: "pink", description: "Kiểm tra phiên, lịch sử đăng nhập và điểm an toàn tài khoản.", badges: ["JWT", "Audit"] },
    { id: "status-page", title: "Status & Uptime", route: "/analytics/status-page", icon: "●", tone: "green", description: "Chạy health check thật và lưu lịch sử độ trễ của các dịch vụ.", badges: ["Uptime", "Incidents"] },
    { id: "feature-flag-dashboard", title: "Feature Flags", route: "/analytics/feature-flag-dashboard", icon: "⚑", tone: "gold", description: "Bật tắt tính năng runtime, rollout và thử nghiệm giao diện.", badges: ["Runtime", "A/B"] }
  ];

  function overviewMarkup(admin) {
    const data = aggregate("7");
    const allTools = admin ? [...tools, { id: "admin-panel", title: "Admin Control Center", route: "/analytics/admin-panel", icon: "⚙", tone: "red", description: "Quản trị người dùng, nội dung, báo cáo, cấu hình và audit log theo RBAC.", badges: ["Admin", "RBAC"] }] : tools;
    const max = Math.max(1, ...data.daily.map((item) => item.value));
    return `<section class="insights-pro insights-overview" data-insights-overview>
      <header class="insights-hero">
        <div class="insights-hero__copy"><span class="insights-eyebrow"><i></i> HH INTELLIGENCE LAYER</span><h2>Biến dữ liệu thành <em>quyết định rõ ràng.</em></h2><p>Một trung tâm thống nhất cho phân tích hành vi, hiệu suất, API, bảo mật và vận hành hệ thống.</p><div class="insights-hero__actions"><button type="button" class="primary" data-app-route="/analytics/analytics">Mở Analytics</button><button type="button" data-insights-health>Kiểm tra hệ thống</button><button type="button" data-insights-export="json">Xuất báo cáo</button></div></div>
        <div class="insights-orbit" aria-hidden="true"><span></span><span></span><span></span><strong>HH<small>LIVE DATA</small></strong></div>
      </header>
      <section class="insights-livebar"><span><i class="online"></i>${navigator.onLine ? "Đang trực tuyến" : "Ngoại tuyến"}</span><span><b>${formatNumber(data.views.length)}</b> lượt xem cục bộ</span><span><b>${formatNumber(data.actions.length)}</b> thao tác</span><span><b>${data.routes.size}</b> trang đã mở</span><span><b>${data.vitals.load} ms</b> tải trang</span></section>
      <div class="insights-command"><label><span>⌕</span><input type="search" data-insights-tool-search placeholder="Tìm Analytics, API, bảo mật, trạng thái..."></label><small><kbd>Ctrl</kbd> + <kbd>K</kbd> để tìm toàn hệ thống</small></div>
      <div class="insights-layout">
        <section class="insights-tool-grid">${allTools.map((tool) => `<button type="button" class="insights-tool-card ${tool.tone}" data-app-route="${tool.route}" data-insights-tool="${tool.id} ${tool.title.toLowerCase()} ${tool.description.toLowerCase()}"><span class="insights-tool-card__icon">${tool.icon}</span><small>${tool.badges.map((badge) => `<b>${badge}</b>`).join("")}</small><strong>${tool.title}</strong><p>${tool.description}</p><i>Khởi chạy <b>↗</b></i></button>`).join("")}</section>
        <aside class="insights-side">
          <section class="insights-pulse"><header><div><small>7 NGÀY GẦN NHẤT</small><strong>Nhịp hoạt động</strong></div><span>LIVE</span></header><div>${data.daily.map((item) => `<i style="--value:${Math.max(8, Math.round(item.value / max * 100))}%"><b>${item.value}</b><small>${item.label}</small></i>`).join("")}</div></section>
          <section class="insights-health" data-insights-health-output><header><small>SYSTEM CHECK</small><strong>Sẵn sàng kiểm tra</strong></header><p>Bấm “Kiểm tra hệ thống” để đo kết nối frontend và API thật.</p></section>
          <section class="insights-privacy"><span>◇</span><div><strong>Analytics riêng tư</strong><p>Đo trạng thái biểu mẫu và nhóm tương tác, không lưu ký tự gõ, giá trị nhập, prompt, mật khẩu, token hay tin nhắn.</p></div></section>
        </aside>
      </div>
    </section>`;
  }

  function topModuleRows(data) {
    const max = Math.max(1, ...data.topModules.map(([, value]) => value));
    return data.topModules.map(([name, value], index) => `<button type="button" data-app-route="${name === "home" ? "/home" : `/analytics/${name}`}" ${["analytics", "smart-search", "api-center", "developer-hub", "security-center", "status-page", "feature-flag-dashboard"].includes(name) ? "" : "disabled"}><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(name.replaceAll("-", " "))}</strong><i style="--value:${Math.round(value / max * 100)}%"></i></div><b>${value}</b></button>`).join("") || "<p class=insights-empty>Chưa có đủ hoạt động để xếp hạng module.</p>";
  }

  function analyticsMarkup(range = "7", tab = "overview") {
    const data = aggregate(range);
    const max = Math.max(1, ...data.daily.map((item) => item.value));
    const metricCards = [
      ["Lượt xem", data.views.length, "page views trên thiết bị"],
      ["Thao tác", data.actions.length, "click có chủ đích"],
      ["Trang đã mở", data.routes.size, "route duy nhất"],
      ["Thời gian hoạt động", formatDuration(data.session.activeSeconds || 0), "phiên hiện tại"]
    ];
    const overview = `<div class="insights-analytics-grid"><section class="insights-chart-card"><header><div><small>ACTIVITY TREND</small><strong>Lượt xem theo ngày</strong></div><span>${range === "all" ? "Tất cả" : `${range} ngày`}</span></header><div class="insights-line-chart">${data.daily.map((item) => `<i style="--value:${Math.max(5, Math.round(item.value / max * 100))}%"><b>${item.value}</b><span></span><small>${item.label}</small></i>`).join("")}</div></section><section class="insights-ranking"><header><small>TOP MODULES</small><strong>Khu vực được dùng nhiều</strong></header><div>${topModuleRows(data)}</div></section><section class="insights-event-stream"><header><small>LIVE STREAM</small><strong>Sự kiện gần đây</strong></header><div>${data.rows.slice(0, 10).map((item) => `<p><i class="${item.type}"></i><span><strong>${escapeHtml(item.label || item.type)}</strong><small>${escapeHtml(item.route)}</small></span><time>${new Date(item.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</time></p>`).join("") || "<p>Chưa có sự kiện.</p>"}</div></section></div>`;
    const audience = `<div class="insights-audience-grid"><section><small>THIẾT BỊ HIỆN TẠI</small><h3>${escapeHtml(browserName())}</h3><div class="insights-facts"><span><b>Hệ điều hành</b>${escapeHtml(navigator.platform || "Không xác định")}</span><span><b>Ngôn ngữ</b>${escapeHtml(navigator.language || "vi-VN")}</span><span><b>Viewport</b>${innerWidth} × ${innerHeight}</span><span><b>Kết nối</b>${navigator.onLine ? "Online" : "Offline"}</span><span><b>CPU logic</b>${navigator.hardwareConcurrency || "-"}</span><span><b>Bộ nhớ</b>${navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "Không công bố"}</span></div></section><section><small>HÀNH TRÌNH</small><h3>${data.routes.size} route duy nhất</h3><div class="insights-route-list">${[...new Set(data.views.map((item) => item.route))].slice(0, 16).map((route) => `<button type="button" data-app-route="${escapeHtml(route)}"><span>${escapeHtml(route)}</span><b>${data.views.filter((item) => item.route === route).length}</b></button>`).join("") || "<p>Chưa có hành trình.</p>"}</div></section><section class="insights-privacy-map"><small>DATA BOUNDARY</small><h3>Thu thập tối thiểu</h3><ul><li>Không lưu nội dung nhập vào form</li><li>Không lưu mật khẩu hoặc token</li><li>Không đọc tin nhắn riêng</li><li>Chỉ lưu route, loại thao tác và thời gian</li></ul></section></div>`;
    const performancePanel = `<div class="insights-vitals"><section><small>CORE WEB VITALS</small><h3>Hiệu suất phiên hiện tại</h3><div>${[["LCP", `${data.vitals.lcp || "-"} ms`, !data.vitals.lcp || data.vitals.lcp < 2500], ["CLS", data.vitals.cls, data.vitals.cls < .1], ["INP", `${data.vitals.inp || "-"} ms`, !data.vitals.inp || data.vitals.inp < 200], ["FCP", `${data.vitals.fcp || "-"} ms`, !data.vitals.fcp || data.vitals.fcp < 1800], ["TTFB", `${data.vitals.ttfb || "-"} ms`, data.vitals.ttfb < 800], ["Load", `${data.vitals.load} ms`, data.vitals.load < 3000]].map(([name, value, good]) => `<article class="${good ? "good" : "warn"}"><span>${name}</span><strong>${value}</strong><small>${good ? "Tốt" : "Cần tối ưu"}</small></article>`).join("")}</div></section><section class="insights-performance-actions"><small>DIAGNOSTICS</small><h3>Kiểm tra chủ động</h3><p>Đo độ trễ frontend và API bằng request không cache, sau đó hiển thị kết quả thực tế.</p><button type="button" class="primary" data-insights-health>Chạy kiểm tra kết nối</button><div data-insights-health-output></div></section></div>`;
    const eventPanel = `<section class="insights-events-table"><header><div><small>EVENT EXPLORER</small><strong>${data.rows.length} sự kiện</strong></div><label><span>⌕</span><input type="search" data-insights-event-search placeholder="Lọc route, module, thao tác..."></label></header><div><table><thead><tr><th>Loại</th><th>Thao tác</th><th>Module</th><th>Route</th><th>Thời gian</th></tr></thead><tbody>${data.rows.slice(0, 200).map((item) => `<tr data-insights-event-row="${escapeHtml(`${item.type} ${item.label} ${item.module} ${item.route}`.toLowerCase())}"><td><span class="event-type ${item.type}">${escapeHtml(item.type)}</span></td><td>${escapeHtml(item.label || "Mở trang")}</td><td>${escapeHtml(item.module)}</td><td><code>${escapeHtml(item.route)}</code></td><td>${new Date(item.createdAt).toLocaleString("vi-VN")}</td></tr>`).join("") || '<tr><td colspan="5">Chưa có sự kiện.</td></tr>'}</tbody></table></div></section>`;
    return `<section class="insights-pro insights-analytics" data-insights-analytics data-range="${range}" data-tab="${tab}"><header class="insights-analytics-hero"><div><span class="insights-eyebrow"><i></i> ANALYTICS INTELLIGENCE</span><h2>Đọc đúng tín hiệu.<br><em>Hành động nhanh hơn.</em></h2><p>Dữ liệu thật trên thiết bị, Web Performance API và hành trình sử dụng toàn workspace.</p></div><div class="insights-score"><small>HEALTH SCORE</small><strong>${Math.max(35, Math.min(99, 100 - Math.round(data.vitals.load / 150)))}</strong><span>${navigator.onLine ? "Hệ thống trực tuyến" : "Đang ngoại tuyến"}</span></div></header><div class="insights-analytics-toolbar"><nav>${[["overview", "Tổng quan"], ["audience", "Thiết bị & hành trình"], ["performance", "Hiệu suất"], ["events", "Sự kiện"]].map(([id, label]) => `<button type="button" data-insights-tab="${id}" class="${tab === id ? "active" : ""}">${label}</button>`).join("")}</nav><div><select data-insights-range><option value="7" ${range === "7" ? "selected" : ""}>7 ngày</option><option value="30" ${range === "30" ? "selected" : ""}>30 ngày</option><option value="all" ${range === "all" ? "selected" : ""}>Tất cả</option></select><button type="button" data-insights-refresh>↻ Làm mới</button><button type="button" data-insights-copy>Chép tóm tắt</button><button type="button" class="primary" data-insights-export="csv">Xuất CSV</button></div></div><section class="insights-metrics">${metricCards.map(([label, value, note], index) => `<article><span>0${index + 1}</span><small>${label}</small><strong>${typeof value === "number" ? formatNumber(value) : value}</strong><p>${note}</p></article>`).join("")}</section><div data-insights-pane>${tab === "audience" ? audience : tab === "performance" ? performancePanel : tab === "events" ? eventPanel : overview}</div></section>`;
  }

  function mountOverview(host, options = {}) {
    if (!host) return;
    host.innerHTML = overviewMarkup(Boolean(options.admin));
  }

  function mountAnalytics(host) {
    if (!host) return;
    analyticsHost = host;
    host.innerHTML = analyticsMarkup("7", "overview");
  }

  function rerenderAnalytics() {
    const root = analyticsHost?.querySelector("[data-insights-analytics]");
    if (!analyticsHost || !root) return;
    analyticsHost.innerHTML = analyticsMarkup(root.dataset.range || "7", root.dataset.tab || "overview");
  }

  function download(name, content, type) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type }));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function exportReport(format = "json") {
    const root = document.querySelector("[data-insights-analytics]");
    const range = root?.dataset.range || "7";
    const data = aggregate(range);
    const safeRows = data.rows.map(({ type, route, module, label, createdAt }) => ({ type, route, module, label, createdAt }));
    const date = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
      const csv = [["type", "label", "module", "route", "createdAt"], ...safeRows.map((item) => [item.type, item.label, item.module, item.route, item.createdAt])].map((row) => row.map(quote).join(",")).join("\n");
      download(`hh-analytics-${date}.csv`, csv, "text/csv;charset=utf-8");
      return;
    }
    download(`hh-analytics-${date}.json`, JSON.stringify({ generatedAt: new Date().toISOString(), range, vitals: data.vitals, events: safeRows }, null, 2), "application/json;charset=utf-8");
  }

  async function runHealthCheck(root) {
    const output = root.querySelector("[data-insights-health-output]") || document.querySelector("[data-insights-health-output]");
    if (!output) return;
    output.innerHTML = "<header><small>SYSTEM CHECK</small><strong>Đang đo kết nối...</strong></header><p>Vui lòng chờ phản hồi trực tiếp.</p>";
    const endpoints = [{ name: "Frontend", url: location.origin }, ...(API_BASE ? [{ name: "Vercel API", url: `${API_BASE}/api/auth/providers` }] : [])];
    const results = await Promise.all(endpoints.map(async (endpoint) => {
      const started = performance.now();
      try { const response = await fetch(`${endpoint.url}${endpoint.url.includes("?") ? "&" : "?"}health=${Date.now()}`, { cache: "no-store" }); return { ...endpoint, ok: response.ok, latency: Math.round(performance.now() - started) }; }
      catch { return { ...endpoint, ok: false, latency: Math.round(performance.now() - started) }; }
    }));
    output.innerHTML = `<header><small>SYSTEM CHECK</small><strong>${results.every((item) => item.ok) ? "Mọi dịch vụ hoạt động" : "Có dịch vụ cần kiểm tra"}</strong></header>${results.map((item) => `<p><i class="${item.ok ? "online" : "offline"}"></i><span>${item.name}</span><b>${item.ok ? `${item.latency} ms` : "Không phản hồi"}</b></p>`).join("")}`;
    record("diagnostic", { route: routeName(), label: `Health check: ${results.filter((item) => item.ok).length}/${results.length}` });
  }

  document.addEventListener("click", (event) => {
    const scope = event.target.closest(".insights-pro");
    if (!scope) return;
    const tab = event.target.closest("[data-insights-tab]");
    if (tab && analyticsHost) {
      const root = analyticsHost.querySelector("[data-insights-analytics]");
      analyticsHost.innerHTML = analyticsMarkup(root?.dataset.range || "7", tab.dataset.insightsTab);
      return;
    }
    if (event.target.closest("[data-insights-refresh]")) { record("refresh", { route: routeName(), label: "Làm mới Analytics" }); rerenderAnalytics(); return; }
    if (event.target.closest("[data-insights-health]")) { runHealthCheck(scope); return; }
    const exportButton = event.target.closest("[data-insights-export]");
    if (exportButton) { exportReport(exportButton.dataset.insightsExport); record("export", { route: routeName(), label: `Xuất ${exportButton.dataset.insightsExport}` }); return; }
    if (event.target.closest("[data-insights-copy]")) {
      const data = aggregate(scope.dataset.range || "7");
      const summary = `HH Analytics · ${data.views.length} lượt xem · ${data.actions.length} thao tác · ${data.routes.size} route · tải trang ${data.vitals.load} ms`;
      navigator.clipboard?.writeText(summary).then(() => { event.target.closest("[data-insights-copy]").textContent = "✓ Đã chép"; }).catch(() => {});
    }
  });

  document.addEventListener("change", (event) => {
    if (!event.target.matches("[data-insights-range]") || !analyticsHost) return;
    const root = analyticsHost.querySelector("[data-insights-analytics]");
    analyticsHost.innerHTML = analyticsMarkup(event.target.value, root?.dataset.tab || "overview");
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("[data-insights-tool-search]")) {
      const query = event.target.value.trim().toLowerCase();
      event.target.closest("[data-insights-overview]")?.querySelectorAll("[data-insights-tool]").forEach((item) => { item.hidden = Boolean(query) && !item.dataset.insightsTool.includes(query); });
    }
    if (event.target.matches("[data-insights-event-search]")) {
      const query = event.target.value.trim().toLowerCase();
      event.target.closest("[data-insights-analytics]")?.querySelectorAll("[data-insights-event-row]").forEach((row) => { row.hidden = Boolean(query) && !row.dataset.insightsEventRow.includes(query); });
    }
  });

  installFeatureAccessGuard();
  installTelemetry();
  window.HHInsights = Object.freeze({ mountOverview, mountAnalytics, record, flush: () => flushRemote(true), snapshot: aggregate });
  window.dispatchEvent(new CustomEvent("hh:insights-ready"));
})();
