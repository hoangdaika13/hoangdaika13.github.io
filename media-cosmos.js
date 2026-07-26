(function (globalScope, factory) {
  "use strict";
  const api = factory(globalScope || globalThis);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHMediaCosmos = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (globalScope) {
  "use strict";

  const SCHEMA = "hh.media.cosmos.v1";
  const STATE_KEY = SCHEMA;
  const VERSION = 1;
  const THEMES = Object.freeze([
    { id: "cyberpunk", label: "Cyberpunk" },
    { id: "dreamy", label: "Dreamy" },
    { id: "aurora", label: "Aurora" },
    { id: "deep-space", label: "Deep Space" },
    { id: "retro-wave", label: "Retro Wave" },
    { id: "golden-cinema", label: "Golden Cinema" }
  ]);
  const PLANETS = Object.freeze([
    { id: "universal", code: "UP", label: "Universal Project", color: "#56ecff", accent: "#27a8ff", route: "/media-design/universal-media", tools: ["universal-media", "asset-manager"] },
    { id: "photo", code: "PI", label: "Photo & Image", color: "#ff63d8", accent: "#9a68ff", route: "/media-design/photo-editor", tools: ["photo-editor", "background-remover", "collage", "inspector", "compress", "convert", "image", "picker"] },
    { id: "video", code: "VM", label: "Video & Motion", color: "#a56cff", accent: "#635bff", route: "/media-design/video-editor", tools: ["video-editor"] },
    { id: "documents", code: "DU", label: "Documents & Utility", color: "#55efd2", accent: "#21bba7", route: "/media-design/pdf", tools: ["pdf", "qr"] },
    { id: "brand", code: "BU", label: "Brand Universe", color: "#ffbd59", accent: "#ff7a4d", route: "/media-design/brand-kit", tools: ["color", "type", "gradient", "brand-kit"] },
    { id: "assets", code: "AG", label: "Asset Galaxy", color: "#5c9dff", accent: "#36d6ff", route: "/media-design/icon", description: "Icon · SVG · Font · LUT", tools: ["icon", "svg"] },
    { id: "export", code: "EP", label: "Export & Publishing", color: "#ffe36d", accent: "#ffad35", route: "/media-design/production-workflow", tools: ["production-workflow", "social-post", "favicon", "meme"] }
  ]);
  const ADAPTIVE_PRESETS = Object.freeze([
    { id: "youtube-16x9", label: "YouTube / 16:9", width: 1920, height: 1080, kind: "video" },
    { id: "shorts-9x16", label: "Shorts · Reels / 9:16", width: 1080, height: 1920, kind: "video" },
    { id: "social-1x1", label: "Social / 1:1", width: 1080, height: 1080, kind: "image" },
    { id: "thumbnail", label: "Thumbnail", width: 1280, height: 720, kind: "image" },
    { id: "spotify-canvas", label: "Spotify Canvas", width: 1080, height: 1920, kind: "video", duration: "3–8 giây" }
  ]);
  const activeInstances = new Set();

  const now = () => new Date().toISOString();
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const clone = (value) => {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };
  const cleanText = (value, max, fallback) => String(value == null ? "" : value).trim().slice(0, max || 240) || fallback || "";
  const escapeHtml = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : (fallback || 0);

  function normalizePlannedJob(input) {
    const source = input && typeof input === "object" ? input : {};
    const allowed = ["planned", "queued", "paused", "running", "completed", "failed", "canceled", "needs-adapter"];
    return {
      id: cleanText(source.id, 100, uid("adaptive")),
      name: cleanText(source.name, 180, "Adaptive export"),
      preset: cleanText(source.preset, 80),
      width: Math.max(1, Math.min(16384, number(source.width, 1920))),
      height: Math.max(1, Math.min(16384, number(source.height, 1080))),
      kind: ["image", "video"].includes(source.kind) ? source.kind : "video",
      status: allowed.includes(source.status) ? source.status : "planned",
      message: cleanText(source.message, 400, "Đã lập kế hoạch; chưa render."),
      cost: Math.max(0, number(source.cost, 0)),
      currency: cleanText(source.currency, 12, "USD"),
      provider: cleanText(source.provider, 80),
      outputUrl: /^https:\/\//i.test(String(source.outputUrl || "")) ? source.outputUrl : "",
      createdAt: source.createdAt || now(),
      updatedAt: now()
    };
  }

  function normalizeState(input) {
    const source = input && typeof input === "object" ? input : {};
    const theme = THEMES.some((item) => item.id === source.theme) ? source.theme : "cyberpunk";
    return {
      schema: SCHEMA,
      version: VERSION,
      theme,
      activity: ["idle", "preview", "render"].includes(source.activity) ? source.activity : "idle",
      activePanel: ["command", "queue", "provenance", "export"].includes(source.activePanel) ? source.activePanel : "command",
      lastTool: cleanText(source.lastTool, 80, "universal-media"),
      lastToolName: cleanText(source.lastToolName, 160, "Universal Media Project"),
      lastOpenedAt: source.lastOpenedAt || now(),
      plannedJobs: (Array.isArray(source.plannedJobs) ? source.plannedJobs : []).slice(-80).map(normalizePlannedJob),
      history: (Array.isArray(source.history) ? source.history : []).slice(-160).map((item) => ({
        id: cleanText(item?.id, 100, uid("history")),
        jobId: cleanText(item?.jobId, 100),
        action: cleanText(item?.action, 80, "update"),
        detail: cleanText(item?.detail, 300),
        createdAt: item?.createdAt || now()
      })),
      updatedAt: now()
    };
  }

  function createStateStore(storage) {
    const target = storage || globalScope.localStorage;
    return Object.freeze({
      load() {
        if (!target?.getItem) return normalizeState({});
        try { return normalizeState(JSON.parse(target.getItem(STATE_KEY) || "{}")); } catch (_) { return normalizeState({}); }
      },
      save(value) {
        const normalized = normalizeState(value);
        try { target?.setItem?.(STATE_KEY, JSON.stringify(normalized)); } catch (_) { /* Private mode or full quota. */ }
        return normalized;
      }
    });
  }

  function createAdaptiveExportPlan(project, createdAt) {
    const stamp = createdAt || now();
    const projectName = cleanText(project?.name, 120, "Universal Media Project");
    return ADAPTIVE_PRESETS.map((preset) => normalizePlannedJob({
      id: `${preset.id}-${Date.parse(stamp) || Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${projectName} · ${preset.label}`,
      preset: preset.id,
      width: preset.width,
      height: preset.height,
      kind: preset.kind,
      status: "planned",
      message: "Đã tạo kế hoạch kích thước. Chưa render và chưa phát sinh chi phí.",
      createdAt: stamp
    }));
  }

  function applyQueueAction(input, action, options) {
    const job = normalizePlannedJob(input);
    const settings = options || {};
    if (action === "pause" && ["planned", "queued"].includes(job.status)) {
      return normalizePlannedJob({ ...job, status: "paused", message: "Đã tạm dừng trước khi gửi tới engine." });
    }
    if (action === "resume" && job.status === "paused") {
      return normalizePlannedJob({ ...job, status: "planned", message: "Đã đưa lại vào kế hoạch render." });
    }
    if (action === "cancel" && ["planned", "queued", "paused"].includes(job.status)) {
      return normalizePlannedJob({ ...job, status: "canceled", message: "Đã hủy trước khi render." });
    }
    if (action === "cancel" && job.status === "running" && !settings.remoteCancelConfirmed) {
      return normalizePlannedJob({ ...job, message: "Job đang chạy trên server; hãy mở Production Workflow để hủy có xác nhận." });
    }
    if (action === "retry" && ["failed", "canceled", "needs-adapter"].includes(job.status)) {
      return normalizePlannedJob({
        ...job,
        status: settings.adapterAvailable ? "queued" : "needs-adapter",
        message: settings.adapterAvailable ? "Đã gửi lại tới render adapter." : "Chưa có render adapter; chưa gửi lại tác vụ."
      });
    }
    return job;
  }

  function getEffectsPolicy(env, activity) {
    const scope = env || globalScope;
    const reducedMotion = Boolean(scope.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    const memory = number(scope.navigator?.deviceMemory, 8);
    const cores = number(scope.navigator?.hardwareConcurrency, 8);
    const saveData = Boolean(scope.navigator?.connection?.saveData);
    const lowPower = memory <= 4 || cores <= 4 || saveData;
    const active = ["preview", "render"].includes(activity);
    return {
      reducedMotion,
      lowPower,
      particles: active && !reducedMotion && !lowPower,
      density: reducedMotion ? 0 : lowPower ? 8 : active ? 26 : 0,
      label: reducedMotion ? "Giảm chuyển động" : lowPower ? "Tiết kiệm hiệu ứng" : active ? "Hiệu ứng đang chạy" : "Hiệu ứng tạm nghỉ"
    };
  }

  function buildProvenanceGraph(project, assets) {
    const list = Array.isArray(assets) ? assets : [];
    const nodes = [{ id: cleanText(project?.id, 100, "project"), type: "project", label: cleanText(project?.name, 160, "Universal Media Project") }];
    const edges = [];
    const providers = new Map();
    const assetIds = new Set(list.map((asset) => cleanText(asset?.id, 100)));
    list.slice(0, 160).forEach((asset) => {
      const assetId = cleanText(asset?.id, 100, uid("asset"));
      const provider = cleanText(asset?.metadata?.aiProvider || asset?.metadata?.provider || asset?.metadata?.sourceProvider, 80);
      nodes.push({ id: assetId, type: cleanText(asset?.kind, 20, "other"), label: cleanText(asset?.name, 160, "Asset"), provider });
      edges.push({ from: nodes[0].id, to: assetId, relation: "contains" });
      if (provider) {
        const providerId = `provider:${provider.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
        if (!providers.has(providerId)) {
          const node = { id: providerId, type: "provider", label: provider };
          providers.set(providerId, node);
          nodes.push(node);
        }
        edges.push({ from: providerId, to: assetId, relation: "generated" });
      }
      (Array.isArray(asset?.references) ? asset.references : []).slice(0, 30).forEach((reference) => {
        const referenceId = typeof reference === "string" ? reference : reference?.assetId;
        if (assetIds.has(referenceId)) edges.push({ from: referenceId, to: assetId, relation: "derived" });
      });
    });
    return { schema: "hh.media.provenance.v1", nodes, edges, providers: providers.size };
  }

  function assessCosmosWarnings(project, assets, renderJobs, options) {
    const mediaApi = options?.mediaApi;
    const warnings = mediaApi?.assessWarnings ? mediaApi.assessWarnings(project, assets, { availableFonts: options?.availableFonts || [] }) : [];
    (Array.isArray(assets) ? assets : []).forEach((asset) => {
      const generated = Boolean(asset?.metadata?.aiProvider || asset?.metadata?.provider || asset?.metadata?.generatedByAI);
      const rights = cleanText(asset?.metadata?.rights || asset?.metadata?.license || asset?.metadata?.licenseId, 120);
      const consentRequired = Boolean(asset?.metadata?.consentRequired);
      const consent = Boolean(asset?.metadata?.consent || asset?.metadata?.consentId);
      if (generated && !rights) warnings.push({ code: "missing-rights", level: "warning", assetId: asset.id, message: `${cleanText(asset.name, 120, "Asset AI")} chưa có thông tin quyền sử dụng.` });
      if (consentRequired && !consent) warnings.push({ code: "missing-consent", level: "error", assetId: asset.id, message: `${cleanText(asset.name, 120, "Asset")} đang thiếu consent.` });
    });
    (Array.isArray(renderJobs) ? renderJobs : []).filter((job) => job?.status === "failed").forEach((job) => {
      warnings.push({ code: "export-failed", level: "error", jobId: job.id, message: `${cleanText(job.name, 120, "Export")} đã thất bại.` });
    });
    return warnings.slice(0, 200);
  }

  const formatBytes = (bytes) => {
    const value = Math.max(0, number(bytes, 0));
    if (value < 1024) return `${value} B`;
    if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1073741824) return `${(value / 1048576).toFixed(1)} MB`;
    return `${(value / 1073741824).toFixed(2)} GB`;
  };
  const formatCost = (jobs) => {
    const values = (Array.isArray(jobs) ? jobs : []).filter((job) => number(job?.cost, 0) > 0);
    if (!values.length) return "Chưa ghi nhận";
    const total = values.reduce((sum, job) => sum + number(job.cost, 0), 0);
    return `${total.toFixed(total < 1 ? 4 : 2)} ${cleanText(values[0]?.currency, 12, "USD")}`;
  };
  const routeForTool = (id) => `/media-design/${cleanText(id, 80, "universal-media")}`;
  const statusLabel = (status) => ({
    planned: "Đã lập kế hoạch", queued: "Đang chờ", paused: "Tạm dừng", running: "Đang render",
    completed: "Hoàn tất", failed: "Thất bại", canceled: "Đã hủy", "needs-adapter": "Cần adapter"
  })[status] || status;

  function queueMarkup(jobs) {
    if (!jobs.length) return `<div class="mcs-empty"><b>Không có tác vụ render</b><span>Tạo Adaptive Export hoặc mở Production Workflow để gửi render thật.</span></div>`;
    return jobs.slice().reverse().slice(0, 20).map((job) => {
      const canPause = ["planned", "queued"].includes(job.status);
      const canResume = job.status === "paused";
      const canCancel = ["planned", "queued", "paused", "running"].includes(job.status);
      const canRetry = ["failed", "canceled", "needs-adapter"].includes(job.status);
      const actions = [
        canPause ? `<button type="button" data-mcs-job-action="pause" data-mcs-job="${escapeHtml(job.id)}">Pause</button>` : "",
        canResume ? `<button type="button" data-mcs-job-action="resume" data-mcs-job="${escapeHtml(job.id)}">Resume</button>` : "",
        canRetry ? `<button type="button" data-mcs-job-action="retry" data-mcs-job="${escapeHtml(job.id)}">Retry</button>` : "",
        canCancel ? `<button type="button" data-mcs-job-action="cancel" data-mcs-job="${escapeHtml(job.id)}">Cancel</button>` : "",
        job.outputUrl ? `<a href="${escapeHtml(job.outputUrl)}" target="_blank" rel="noopener noreferrer">Mở output</a>` : ""
      ].join("");
      return `<article class="mcs-job" data-status="${escapeHtml(job.status)}">
        <span class="mcs-job__signal" aria-hidden="true"></span>
        <div><strong>${escapeHtml(job.name)}</strong><small>${escapeHtml(job.preset || job.provider || "Render")} · ${escapeHtml(job.message || "Không có thông báo")}</small></div>
        <b>${escapeHtml(statusLabel(job.status))}</b>
        <span class="mcs-job__cost">${number(job.cost, 0) > 0 ? escapeHtml(`${job.cost} ${job.currency || "USD"}`) : "0 chi phí ghi nhận"}</span>
        <div class="mcs-job__actions">${actions}</div>
      </article>`;
    }).join("");
  }

  function provenanceMarkup(graph) {
    if (graph.nodes.length <= 1) return `<div class="mcs-empty mcs-empty--provenance"><b>Chưa có asset để dựng provenance graph</b><span>Thêm ảnh, video, audio, font hoặc asset AI vào Media Bin.</span></div>`;
    const project = graph.nodes[0];
    const assetNodes = graph.nodes.filter((node) => node.type !== "project" && node.type !== "provider").slice(0, 14);
    const providerNodes = graph.nodes.filter((node) => node.type === "provider");
    return `<div class="mcs-provenance-map">
      <div class="mcs-provenance-project"><span>UP</span><strong>${escapeHtml(project.label)}</strong></div>
      <div class="mcs-provenance-providers">${providerNodes.length ? providerNodes.map((node) => `<span>${escapeHtml(node.label)}</span>`).join("") : "<span>Không có AI provider được ghi nhận</span>"}</div>
      <div class="mcs-provenance-assets">${assetNodes.map((node, index) => `<article style="--node-index:${index}"><i>${escapeHtml(String(node.type || "A").slice(0, 2).toUpperCase())}</i><b>${escapeHtml(node.label)}</b><small>${escapeHtml(node.provider || "Nguồn local / thủ công")}</small></article>`).join("")}</div>
      <footer>${graph.nodes.length - 1} node asset/provider · ${graph.edges.length} liên kết nguồn</footer>
    </div>`;
  }

  function warningsMarkup(warnings) {
    if (!warnings.length) return `<div class="mcs-alert mcs-alert--ok"><span>✓</span><div><b>Không có cảnh báo thực tế</b><small>Media Bin và render history hiện không phát hiện lỗi.</small></div></div>`;
    return warnings.slice(0, 6).map((warning) => `<div class="mcs-alert" data-level="${escapeHtml(warning.level || "warning")}"><span>${warning.level === "error" ? "!" : "i"}</span><div><b>${escapeHtml(warning.code || "media-warning")}</b><small>${escapeHtml(warning.message || "Cần kiểm tra asset.")}</small></div></div>`).join("");
  }

  async function mount(host, options) {
    if (!host) return null;
    await unmount(host);
    const controller = new AbortController();
    const store = createStateStore(options?.storage);
    let state = store.load();
    const mediaApi = options?.mediaApi || globalScope.HHUniversalMediaProject;
    const productionApi = options?.productionApi || globalScope.HHMediaProductionWorkflow;
    const mediaStore = options?.mediaStore || mediaApi?.createStore?.();
    const productionStore = productionApi?.createStateStore?.(options?.storage || globalScope.localStorage);
    let project = null;
    let assets = [];
    let snapshots = [];
    let productionState = productionStore?.load?.() || { proxyJobs: [], renderQueue: [] };
    let availableFonts = [];
    let message = "";

    if (globalScope.document?.fonts?.values) {
      try { availableFonts = [...globalScope.document.fonts.values()].map((font) => font.family).filter(Boolean); } catch (_) { availableFonts = []; }
    }
    if (mediaStore) {
      try {
        await mediaStore.ready();
        project = (await mediaStore.listProjects())[0] || await mediaStore.saveProject({ name: "Universal Media Project" });
        assets = await mediaStore.listAssets(project.id);
        snapshots = await mediaStore.listSnapshots(project.id);
      } catch (error) {
        message = cleanText(error?.message, 240, "Không thể đọc Media Bin trên thiết bị này.");
      }
    }
    if (!project) project = mediaApi?.normalizeProject?.({ name: "Universal Media Project" }) || { id: "local-project", name: "Universal Media Project", assetIds: [], requiredFonts: [] };

    const navigate = (route) => {
      if (typeof options?.onNavigate === "function") options.onNavigate(route);
      else if (globalScope.location) globalScope.location.hash = `#${route}`;
    };
    const save = () => { state = store.save(state); };
    const record = (action, detail, jobId) => {
      state.history.push({ id: uid("history"), jobId: jobId || "", action, detail, createdAt: now() });
      state.history = state.history.slice(-160);
      save();
    };
    const allJobs = () => [...(productionState.renderQueue || []), ...state.plannedJobs];
    const refreshData = async () => {
      if (mediaStore) {
        project = await mediaStore.getProject(project.id) || project;
        assets = await mediaStore.listAssets(project.id);
        snapshots = await mediaStore.listSnapshots(project.id);
      }
      productionState = productionStore?.load?.() || productionState;
    };

    const render = () => {
      const jobs = allJobs();
      const warnings = assessCosmosWarnings(project, assets, jobs, { mediaApi, availableFonts });
      const graph = buildProvenanceGraph(project, assets);
      const visualActivity = jobs.some((job) => job.status === "running") ? "render" : state.activity;
      const effects = getEffectsPolicy(globalScope, visualActivity);
      const totalBytes = assets.reduce((sum, asset) => sum + number(asset.size, 0), 0);
      const newAssets = assets.filter((asset) => Date.now() - Date.parse(asset.createdAt || 0) < 7 * 86400000).length;
      const activeJobs = jobs.filter((job) => ["planned", "queued", "paused", "running", "needs-adapter"].includes(job.status)).length;
      const proxyCount = (productionState.proxyJobs || []).filter((job) => ["queued", "running", "completed"].includes(job.status)).length;
      const routeTools = Array.isArray(options?.tools) ? options.tools : [];
      const planetButtons = PLANETS.filter((planet) => planet.id !== "universal").map((planet, index) => {
        const count = routeTools.filter((tool) => planet.tools.includes(tool.id)).length || planet.tools.length;
        const pending = planet.id === "export" ? activeJobs : planet.id === "assets" ? warnings.filter((item) => ["offline", "duplicate"].includes(item.code)).length : 0;
        return `<button class="mcs-planet" type="button" data-mcs-route="${planet.route}" data-planet="${planet.id}" style="--planet:${planet.color};--planet-accent:${planet.accent};--planet-index:${index}">
          <span class="mcs-planet__body" aria-hidden="true"><i></i><em></em></span>
          <span class="mcs-planet__copy"><small>${planet.code} · ${count} công cụ</small><strong>${planet.label}</strong><b>${pending ? `${pending} cần xử lý` : escapeHtml(planet.description || "Sẵn sàng")}</b></span>
        </button>`;
      }).join("");
      const panelContent = state.activePanel === "queue"
        ? `<section class="mcs-panel mcs-panel--queue"><header><div><small>RENDER QUEUE · TRẠNG THÁI THẬT</small><h3>Hàng đợi, lịch sử và chi phí</h3></div><button type="button" data-mcs-route="/media-design/production-workflow">Mở Production Workflow</button></header><div class="mcs-jobs">${queueMarkup(jobs)}</div><div class="mcs-render-history"><h4>Lịch sử thao tác</h4>${state.history.length ? state.history.slice().reverse().slice(0, 8).map((item) => `<article><span>${escapeHtml(item.action)}</span><b>${escapeHtml(item.detail || item.jobId)}</b><time>${new Date(item.createdAt).toLocaleString("vi-VN")}</time></article>`).join("") : "<p>Chưa có thao tác queue nào trên thiết bị này.</p>"}</div><footer>${state.history.length} sự kiện trong lịch sử cục bộ · chi phí chỉ lấy từ response backend</footer></section>`
        : state.activePanel === "provenance"
          ? `<section class="mcs-panel"><header><div><small>ASSET LINEAGE</small><h3>Provenance Graph</h3></div><button type="button" data-mcs-route="/media-design/asset-manager">Kiểm tra Media Bin</button></header>${provenanceMarkup(graph)}</section>`
          : state.activePanel === "export"
            ? `<section class="mcs-panel"><header><div><small>ADAPTIVE EXPORT</small><h3>Một dự án · năm đầu ra</h3></div><button type="button" data-mcs-adaptive>Tạo kế hoạch 5 định dạng</button></header><div class="mcs-export-grid">${ADAPTIVE_PRESETS.map((preset) => `<article><span>${preset.width}<i>×</i>${preset.height}</span><strong>${preset.label}</strong><small>${preset.duration || (preset.kind === "video" ? "Video master" : "Ảnh tĩnh")}</small></article>`).join("")}</div><p class="mcs-honesty">Tạo kế hoạch không đồng nghĩa đã render. Output chỉ hoàn tất khi engine trả tệp hoặc URL hợp lệ.</p></section>`
            : `<div class="mcs-command-grid">
              <section class="mcs-panel mcs-panel--metrics"><header><div><small>GALAXY COMMAND CENTER</small><h3>Tín hiệu dự án thật</h3></div><span>${escapeHtml(project.name)}</span></header><div class="mcs-live-metrics">
                <article><small>Media Bin</small><strong>${assets.length}</strong><span>${formatBytes(totalBytes)} trên thiết bị</span></article>
                <article><small>Render Queue</small><strong>${activeJobs}</strong><span>${jobs.filter((job) => job.status === "failed").length} lỗi</span></article>
                <article><small>Proxy</small><strong>${proxyCount}</strong><span>${(productionState.proxyJobs || []).filter((job) => job.status === "completed").length} hoàn tất</span></article>
                <article><small>Asset mới</small><strong>${newAssets}</strong><span>trong 7 ngày</span></article>
                <article><small>Dung lượng</small><strong>${formatBytes(totalBytes)}</strong><span>local-first</span></article>
                <article><small>Chi phí AI</small><strong>${escapeHtml(formatCost(jobs))}</strong><span>không ước tính giả</span></article>
              </div></section>
              <section class="mcs-panel mcs-panel--alerts"><header><div><small>PRE-FLIGHT</small><h3>Cảnh báo cần xử lý</h3></div><b>${warnings.length}</b></header><div>${warningsMarkup(warnings)}</div></section>
              <section class="mcs-panel mcs-panel--recent"><header><div><small>CONTINUE</small><h3>Tiếp tục chỉnh sửa gần nhất</h3></div></header><button type="button" data-mcs-continue><span>${escapeHtml(String(state.lastToolName).slice(0, 2).toUpperCase())}</span><div><strong>${escapeHtml(state.lastToolName)}</strong><small>${new Date(state.lastOpenedAt).toLocaleString("vi-VN")}</small></div><b>Tiếp tục →</b></button><div class="mcs-bridges"><button type="button" data-mcs-route="/create"><i>CG</i><span><b>Creative Galaxy</b><small>Brief, palette và prompt</small></span></button><button type="button" data-mcs-route="/music-ai/studio"><i>MG</i><span><b>Music Galaxy</b><small>Audio, stem và visual</small></span></button></div></section>
            </div>`;

      host.innerHTML = `<section class="media-cosmos ${effects.particles ? "is-particle-active" : ""}" data-media-cosmos data-theme="${escapeHtml(state.theme)}">
        <div class="mcs-space" aria-hidden="true"><i></i><i></i><i></i><div class="mcs-particles">${Array.from({ length: effects.density }, (_, index) => `<span style="--p:${index}"></span>`).join("")}</div></div>
        <header class="mcs-hero">
          <div><span class="mcs-kicker"><i></i> HH MEDIA COSMOS · LOCAL-FIRST</span><h2>Biến mọi asset thành một vũ trụ sản xuất.</h2><p>Ảnh, video, motion, tài liệu, thương hiệu và xuất bản cùng quay quanh một Universal Media Project.</p></div>
          <div class="mcs-hero__controls">
            <label>Theme<select data-mcs-theme aria-label="Chọn theme Media Cosmos">${THEMES.map((theme) => `<option value="${theme.id}" ${theme.id === state.theme ? "selected" : ""}>${theme.label}</option>`).join("")}</select></label>
            <button type="button" data-mcs-activity="${state.activity === "idle" ? "preview" : "idle"}" aria-pressed="${state.activity !== "idle"}"><i></i>${state.activity === "idle" ? "Bật preview" : "Dừng hiệu ứng"}</button>
            <span><b>${effects.particles ? "LIVE" : "ECO"}</b>${escapeHtml(effects.label)}</span>
          </div>
        </header>
        <section class="mcs-galaxy" aria-label="Bản đồ Media Cosmos">
          <div class="mcs-orbit mcs-orbit--one" aria-hidden="true"></div><div class="mcs-orbit mcs-orbit--two" aria-hidden="true"></div><div class="mcs-orbit mcs-orbit--three" aria-hidden="true"></div>
          <button class="mcs-star" type="button" data-mcs-route="/media-design/universal-media">
            <span aria-hidden="true"><i>UP</i></span><small>UNIVERSAL MEDIA PROJECT</small><strong>${escapeHtml(project.name)}</strong><b>${assets.length} asset · ${snapshots.length} phiên bản</b>
          </button>
          ${planetButtons}
        </section>
        <nav class="mcs-tabs" aria-label="Media Cosmos Command Center">${[
          ["command", "Command Center"], ["queue", `Render Queue · ${activeJobs}`], ["provenance", `Provenance · ${graph.nodes.length - 1}`], ["export", "Adaptive Export"]
        ].map(([id, label]) => `<button type="button" data-mcs-panel="${id}" aria-selected="${state.activePanel === id}">${label}</button>`).join("")}</nav>
        ${panelContent}
        ${message ? `<div class="mcs-inline-notice" role="status">${escapeHtml(message)}</div>` : ""}
        <div class="mcs-toast" data-mcs-toast role="status" aria-live="polite" hidden></div>
      </section>`;
    };

    const announce = (text, tone) => {
      const node = host.querySelector("[data-mcs-toast]");
      if (!node) return;
      node.textContent = text;
      node.dataset.tone = tone || "info";
      node.hidden = false;
      clearTimeout(announce.timer);
      announce.timer = setTimeout(() => { if (node.isConnected) node.hidden = true; }, 3200);
    };

    host.addEventListener("click", async (event) => {
      const route = event.target.closest("[data-mcs-route]");
      if (route) { navigate(route.dataset.mcsRoute); return; }
      const panel = event.target.closest("[data-mcs-panel]");
      if (panel) { state.activePanel = panel.dataset.mcsPanel; save(); render(); return; }
      const activity = event.target.closest("[data-mcs-activity]");
      if (activity) { state.activity = activity.dataset.mcsActivity; save(); render(); return; }
      if (event.target.closest("[data-mcs-continue]")) { navigate(routeForTool(state.lastTool)); return; }
      if (event.target.closest("[data-mcs-adaptive]")) {
        const created = createAdaptiveExportPlan(project);
        state.plannedJobs = [...state.plannedJobs, ...created].slice(-80);
        created.forEach((job) => record("adaptive-plan", `${job.preset} · ${job.width}×${job.height}`, job.id));
        state.activePanel = "queue";
        save();
        render();
        announce("Đã lập kế hoạch 5 định dạng; chưa render và chưa phát sinh chi phí.", "success");
        return;
      }
      const action = event.target.closest("[data-mcs-job-action]");
      if (action) {
        const id = action.dataset.mcsJob;
        const plannedIndex = state.plannedJobs.findIndex((job) => job.id === id);
        if (plannedIndex >= 0) {
          const next = applyQueueAction(state.plannedJobs[plannedIndex], action.dataset.mcsJobAction);
          state.plannedJobs[plannedIndex] = next;
          record(action.dataset.mcsJobAction, next.message, next.id);
          render();
          announce(next.message, next.status === "needs-adapter" ? "warning" : "success");
          return;
        }
        const remoteIndex = (productionState.renderQueue || []).findIndex((job) => job.id === id);
        if (remoteIndex >= 0) {
          const current = productionState.renderQueue[remoteIndex];
          if (current.status === "running" || current.remoteId || action.dataset.mcsJobAction === "retry") {
            announce("Tác vụ server cần adapter xác nhận. Đang mở Production Workflow.", "warning");
            navigate("/media-design/production-workflow");
            return;
          }
          const result = applyQueueAction(current, action.dataset.mcsJobAction);
          const next = { ...current, status: result.status, message: result.message, updatedAt: now() };
          productionState.renderQueue[remoteIndex] = next;
          productionState = productionStore?.save?.(productionState) || productionState;
          record(action.dataset.mcsJobAction, next.message, next.id);
          render();
        }
      }
    }, { signal: controller.signal });
    host.addEventListener("change", (event) => {
      if (!event.target.matches("[data-mcs-theme]")) return;
      state.theme = THEMES.some((theme) => theme.id === event.target.value) ? event.target.value : "cyberpunk";
      save();
      render();
      globalScope.dispatchEvent?.(new CustomEvent("hh:media-theme", { detail: { theme: state.theme } }));
    }, { signal: controller.signal });

    render();
    activeInstances.add({ host, controller, mediaStore, ownedMediaStore: !options?.mediaStore });
    return Object.freeze({
      getState: () => clone(state),
      getProject: () => clone(project),
      getAssets: () => clone(assets),
      async refresh() { await refreshData(); render(); },
      async unmount() { await unmount(host); }
    });
  }

  async function unmount(host) {
    const targets = [...activeInstances].filter((instance) => !host || instance.host === host);
    for (const instance of targets) {
      instance.controller.abort();
      instance.host.innerHTML = "";
      if (instance.ownedMediaStore) await instance.mediaStore?.close?.().catch(() => {});
      activeInstances.delete(instance);
    }
  }

  function getState(storage) {
    return createStateStore(storage).load();
  }

  function recordTool(id, name, storage) {
    const store = createStateStore(storage);
    const state = store.load();
    state.lastTool = cleanText(id, 80, "universal-media");
    state.lastToolName = cleanText(name, 160, "Universal Media Project");
    state.lastOpenedAt = now();
    return store.save(state);
  }

  return Object.freeze({
    SCHEMA, STATE_KEY, VERSION, THEMES, PLANETS, ADAPTIVE_PRESETS,
    escapeHtml, normalizeState, createStateStore, createAdaptiveExportPlan, applyQueueAction,
    getEffectsPolicy, buildProvenanceGraph, assessCosmosWarnings, getState, recordTool, mount, unmount
  });
});
