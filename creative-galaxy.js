(function (globalScope, factory) {
  "use strict";
  const api = factory(globalScope || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHCreativeGalaxy = api;
  if (globalScope?.document) api.autoMount();
})(typeof globalThis !== "undefined" ? globalThis : this, function createCreativeGalaxy(global) {
  "use strict";

  const VERSION = "1.0.0";
  const PREF_KEY = "hh.creative.galaxy.preferences.v1";
  const HOME_PREF_KEY = "hh.home.galaxy.preferences.v2";
  const CORE_KEY = "hh.creative-os.v1";
  const RETRY_KEY = "hh.creative.retry.pending.v1";
  const ENGINE_ROUTES = new Set(["overview", "project", "brief", "moodboard", "storyboard", "world-bible", "workflow", "ai-director", "prompt-studio", "repurpose", "brand", "audio-dubbing", "prototype", "review", "collaboration", "publishing", "analytics", "rights", "providers", "marketplace", "idea-lab", "naming-studio", "copy-studio", "writing-room", "campaign-planner", "photo-planner", "motion-planner", "podcast-studio", "three-d-planner", "portfolio-builder"]);

  const CLUSTERS = Object.freeze([
    {
      id: "command", label: "Điều hành", icon: "CC", color: "#5eefff", angle: -90,
      description: "Dự án, deadline, chi phí, phiên bản và tiến độ chung.",
      tools: [
        ["overview", "Command Center", "/create/overview"],
        ["project", "Universal Project", "/create/project"]
      ]
    },
    {
      id: "idea", label: "Ý tưởng & Ngôn từ", icon: "AI", color: "#ff59d5", angle: -30,
      description: "Mỗi công cụ ngôn từ có đầu vào, đầu ra và lịch sử riêng.",
      tools: [
        ["ai-center", "AI Center", "/create/ai-center"],
        ["ai-script", "Kịch bản AI", "/create/ai-script"],
        ["idea-lab", "Idea Lab", "/create/idea-lab"],
        ["naming-studio", "Naming Studio", "/create/naming-studio"],
        ["copy-studio", "Copy Studio", "/create/copy-studio"],
        ["writing-room", "Writing Room", "/create/writing-room"]
      ]
    },
    {
      id: "preproduction", label: "Tiền kỳ", icon: "SB", color: "#a887ff", angle: 30,
      description: "Moodboard, storyboard và World Bible có liên kết.",
      tools: [
        ["brief", "Creative Brief", "/create/brief"],
        ["moodboard", "Moodboard", "/create/moodboard"],
        ["storyboard", "Storyboard", "/create/storyboard"],
        ["world-bible", "World Bible", "/create/world-bible"]
      ]
    },
    {
      id: "production", label: "Sản xuất", icon: "PX", color: "#6af0ae", angle: 90,
      description: "Sản xuất chuyên biệt cho ảnh, motion, audio, 3D và prototype.",
      tools: [
        ["creator-studio", "Creator Studio", "/create/creator-studio"],
        ["media-center", "Media Center", "/create/media-center"],
        ["repurpose", "Repurpose Engine", "/create/repurpose"],
        ["brand", "Brand Intelligence", "/create/brand"],
        ["audio-dubbing", "Audio & Dubbing", "/create/audio-dubbing"],
        ["prototype", "Prototype", "/create/prototype"],
        ["photo-planner", "Photo Planner", "/create/photo-planner"],
        ["motion-planner", "Motion Planner", "/create/motion-planner"],
        ["podcast-studio", "Podcast Studio", "/create/podcast-studio"],
        ["three-d-planner", "3D Scene Planner", "/create/three-d-planner"]
      ]
    },
    {
      id: "workflow", label: "Workflow", icon: "WF", color: "#ffbd59", angle: 150,
      description: "Node graph, AI Director, prompt lineage và automation.",
      tools: [
        ["workflow", "Creative Workflow", "/create/workflow"],
        ["ai-director", "AI Director", "/create/ai-director"],
        ["prompt-studio", "Prompt Studio", "/create/prompt-studio"],
        ["ai-automation", "AI Automation", "/create/ai-automation"],
        ["campaign-planner", "Campaign Planner", "/create/campaign-planner"]
      ]
    },
    {
      id: "publish", label: "Xuất bản", icon: "PB", color: "#7fa7ff", angle: 210,
      description: "Duyệt, cộng tác, analytics, quyền và provider.",
      tools: [
        ["review", "Creative Review", "/create/review"],
        ["collaboration", "Collaboration", "/create/collaboration"],
        ["publishing", "Publishing", "/create/publishing"],
        ["analytics", "Analytics", "/create/analytics"],
        ["rights", "Rights", "/create/rights"],
        ["providers", "Providers", "/create/providers"],
        ["marketplace", "Marketplace", "/create/marketplace"],
        ["portfolio-builder", "Portfolio Builder", "/create/portfolio-builder"]
      ]
    }
  ]);

  const WIDGETS = Object.freeze([
    ["project", "Dự án đang hoạt động", "UP", "#5eefff"],
    ["deadline", "Deadline gần nhất", "DL", "#ffbd59"],
    ["ai", "AI jobs", "AI", "#ff59d5"],
    ["asset", "Asset mới nhất", "AS", "#6af0ae"],
    ["comments", "Bình luận chưa đọc", "CM", "#a887ff"],
    ["publishing", "Chờ xuất bản", "PB", "#7fa7ff"],
    ["provider", "Provider & chi phí", "PR", "#63e5ff"],
    ["rights", "Quyền tài sản", "RC", "#ff755f"]
  ]);

  const THEMES = Object.freeze([
    ["neon", "Neon Nebula", "#5eefff", "#ff59d5"],
    ["purple", "Purple Galaxy", "#aa7dff", "#ff68d7"],
    ["solar", "Solar Fire", "#ffba55", "#ff547d"],
    ["deep", "Deep Space", "#4a78ff", "#7de7ff"],
    ["aurora", "Aurora Cyan", "#58f3ff", "#69ffb7"],
    ["magenta", "Magenta Supernova", "#ff4ecf", "#a971ff"],
    ["emerald", "Emerald Cosmos", "#58f5a8", "#bcff65"],
    ["quantum", "Blue Quantum", "#54a4ff", "#58f4ff"],
    ["golden", "Golden Eclipse", "#ffd75e", "#ff874a"],
    ["crimson", "Crimson Mars", "#ff654d", "#ff4c9f"],
    ["ice", "Ice Universe", "#d8fbff", "#78b7ff"],
    ["blackhole", "Black Hole", "#8c78ff", "#303c75"],
    ["time", "Theo thời gian", "#5eefff", "#ffb653"]
  ]);

  const PRESETS = Object.freeze([
    ["content", "Content Creator", "creator-studio", ["ai-center", "ai-script", "creator-studio", "repurpose", "publishing", "analytics"], ["project", "ai", "asset", "publishing"]],
    ["video", "Video Producer", "storyboard", ["brief", "storyboard", "media-center", "audio-dubbing", "review", "publishing"], ["project", "asset", "comments", "publishing"]],
    ["writer", "AI Writer", "ai-center", ["ai-center", "ai-script", "brief", "world-bible", "review", "rights"], ["project", "ai", "comments", "rights"]],
    ["brand", "Brand Studio", "brand", ["brief", "moodboard", "brand", "media-center", "review", "marketplace"], ["project", "asset", "comments", "rights"]],
    ["campaign", "Campaign Team", "overview", ["overview", "project", "workflow", "collaboration", "publishing", "analytics"], ["project", "deadline", "comments", "publishing"]],
    ["focus", "Solo Focus", "project", ["project", "ai-center", "workflow", "review"], ["project", "ai", "comments", "deadline"]]
  ]);

  const instances = new WeakMap();
  const mountedRoots = new Set();
  let wormholeState = null;
  let autoMounted = false;
  const clean = (value, limit = 220) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
  const asArray = (value) => Array.isArray(value) ? value : [];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const allTools = () => CLUSTERS.flatMap((cluster) => cluster.tools);
  const toolById = (id) => allTools().find((tool) => tool[0] === id);
  const clusterByTool = (id) => CLUSTERS.find((cluster) => cluster.tools.some((tool) => tool[0] === id));
  const formatNumber = (value) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(Number(value) || 0);
  const formatDate = (value, empty = "Chưa có") => {
    const date = new Date(value || 0);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= 0) return empty;
    return date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };
  const relativeDate = (value) => {
    const date = new Date(value || 0);
    if (!Number.isFinite(date.getTime())) return "Chưa có";
    const delta = date.getTime() - Date.now();
    const days = Math.round(delta / 86_400_000);
    if (days === 0) return "Hôm nay";
    if (days === 1) return "Ngày mai";
    if (days > 1) return `Còn ${days} ngày`;
    return `Quá ${Math.abs(days)} ngày`;
  };
  const read = (key, fallback) => {
    try { return JSON.parse(global.localStorage?.getItem?.(key) || "null") ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => {
    try { global.localStorage?.setItem?.(key, JSON.stringify(value)); return true; }
    catch { return false; }
  };

  function normalizeStoredState(value) {
    try { return global.HHCreativeCore?.normalizeState?.(value) || value || {}; }
    catch { return {}; }
  }

  function aggregateToolStates(entries = [], prefs = {}) {
    const projects = [];
    const runs = [];
    let activeProjectId = "";
    let fallbackProjectId = "";
    let updatedAt = "";
    asArray(entries).forEach((entry) => {
      const toolId = clean(entry?.toolId, 80);
      if (!toolId || !toolById(toolId)) return;
      const state = entry?.state && typeof entry.state === "object" ? entry.state : {};
      const idMap = new Map();
      asArray(state.projects).forEach((project, index) => {
        if (!project || typeof project !== "object") return;
        const originalId = clean(project.id, 120) || `project-${index + 1}`;
        const aggregateId = `${toolId}:${originalId}`;
        idMap.set(originalId, aggregateId);
        const next = clone(project);
        next.id = aggregateId;
        next.originalProjectId = originalId;
        next.creativeToolId = toolId;
        projects.push(next);
        if (!fallbackProjectId) fallbackProjectId = aggregateId;
        if (toolId === prefs.lastWorkspace && originalId === state.activeProjectId) activeProjectId = aggregateId;
        const projectUpdatedAt = clean(project.updatedAt, 60);
        if (projectUpdatedAt && (!updatedAt || new Date(projectUpdatedAt) > new Date(updatedAt))) updatedAt = projectUpdatedAt;
      });
      asArray(state.runs).forEach((run, index) => {
        if (!run || typeof run !== "object") return;
        const next = clone(run);
        const originalProjectId = clean(run.projectId, 120);
        next.id = `${toolId}:${clean(run.id, 120) || `run-${index + 1}`}`;
        next.projectId = idMap.get(originalProjectId) || `${toolId}:${originalProjectId || "unassigned"}`;
        next.creativeToolId = toolId;
        runs.push(next);
      });
      if (!activeProjectId && toolId === prefs.lastWorkspace) {
        activeProjectId = idMap.get(clean(state.activeProjectId, 120)) || [...idMap.values()][0] || "";
      }
    });
    return {
      format: "hh-creative-tool-index",
      version: 1,
      activeProjectId: activeProjectId || fallbackProjectId || null,
      projects,
      runs,
      updatedAt: updatedAt || null,
      readOnly: true
    };
  }

  function readToolIndex(prefs = normalizePrefs(read(PREF_KEY, {}))) {
    const entries = allTools().map((tool) => {
      const raw = read(`hh.creative.tool.${tool[0]}.project.v1`, null);
      return raw ? { toolId: tool[0], state: normalizeStoredState(raw) } : null;
    }).filter(Boolean);
    if (entries.length) return aggregateToolStates(entries, prefs);
    return normalizeStoredState(read(CORE_KEY, {}));
  }

  function defaultPrefs() {
    return {
      theme: "neon",
      syncTheme: true,
      motion: "balanced",
      pinnedTools: ["overview", "project", "ai-center", "workflow", "review", "publishing"],
      hiddenTools: [],
      widgetOrder: WIDGETS.map((item) => item[0]),
      hiddenWidgets: [],
      defaultProjectId: "",
      lastWorkspace: "overview",
      preset: "content",
      updatedAt: Date.now()
    };
  }

  function normalizePrefs(value = {}) {
    const base = defaultPrefs();
    const toolIds = allTools().map((tool) => tool[0]);
    const widgetIds = WIDGETS.map((widget) => widget[0]);
    const pinned = asArray(value.pinnedTools).filter((id) => toolIds.includes(id)).slice(0, 6);
    const order = [...new Set(asArray(value.widgetOrder).filter((id) => widgetIds.includes(id)))];
    return {
      ...base,
      theme: THEMES.some((item) => item[0] === value.theme) ? value.theme : base.theme,
      syncTheme: value.syncTheme !== false,
      motion: ["off", "minimal", "balanced", "cinematic", "adaptive"].includes(value.motion) ? value.motion : base.motion,
      pinnedTools: value.pinnedTools ? pinned : base.pinnedTools,
      hiddenTools: asArray(value.hiddenTools).filter((id) => toolIds.includes(id) && !pinned.includes(id)),
      widgetOrder: [...order, ...widgetIds.filter((id) => !order.includes(id))],
      hiddenWidgets: asArray(value.hiddenWidgets).filter((id) => widgetIds.includes(id)),
      defaultProjectId: clean(value.defaultProjectId, 120),
      lastWorkspace: toolIds.includes(value.lastWorkspace) ? value.lastWorkspace : base.lastWorkspace,
      preset: PRESETS.some((item) => item[0] === value.preset) ? value.preset : "custom",
      updatedAt: Number(value.updatedAt) || Date.now()
    };
  }

  function applyPreset(base, presetId) {
    const preset = PRESETS.find((item) => item[0] === presetId);
    if (!preset) return normalizePrefs({ ...base, preset: "custom" });
    const [id, , defaultTool, pinned, widgets] = preset;
    return normalizePrefs({
      ...base,
      preset: id,
      pinnedTools: pinned,
      widgetOrder: [...widgets, ...WIDGETS.map((item) => item[0]).filter((widget) => !widgets.includes(widget))],
      hiddenWidgets: id === "focus" ? WIDGETS.map((item) => item[0]).filter((widget) => !widgets.includes(widget)) : [],
      hiddenTools: id === "focus" ? allTools().map((tool) => tool[0]).filter((tool) => !pinned.includes(tool)) : [],
      lastWorkspace: defaultTool,
      motion: id === "focus" ? "minimal" : id === "video" ? "cinematic" : "balanced",
      updatedAt: Date.now()
    });
  }

  function activeProject(state, prefs = {}) {
    const projects = asArray(state?.projects);
    return projects.find((project) => project.id === prefs.defaultProjectId)
      || projects.find((project) => project.id === state?.activeProjectId)
      || projects[0]
      || null;
  }

  function projectProgress(project) {
    if (!project) return 0;
    const explicit = Number(project.analytics?.progress);
    if (Number.isFinite(explicit) && explicit > 0) return clamp(explicit, 0, 100);
    const checks = [
      Boolean(project.brief?.goal || project.brief?.description),
      Boolean(asArray(project.prompts).length),
      Boolean(asArray(project.scripts).length),
      Boolean(asArray(project.storyboard).length),
      Boolean(asArray(project.assets).length),
      ["review", "approved", "published"].includes(project.review?.status),
      Boolean(asArray(project.publishing).length)
    ];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
  }

  function commentList(project) {
    return asArray(project?.review?.comments).concat(asArray(project?.comments));
  }

  function snapshot(state = {}, prefs = {}) {
    const projects = asArray(state.projects);
    const project = activeProject(state, prefs);
    const runs = asArray(state.runs);
    const relevantRuns = project ? runs.filter((run) => run.projectId === project.id) : runs;
    const pendingRuns = relevantRuns.filter((run) => ["queued", "running"].includes(run.status));
    const failedRuns = relevantRuns.filter((run) => run.status === "failed");
    const assets = asArray(project?.assets).slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const comments = commentList(project);
    const unread = comments.filter((comment) => comment?.read !== true && comment?.resolved !== true);
    const publishing = asArray(project?.publishing);
    const pendingPublishing = publishing.filter((item) => ["draft", "scheduled", "publishing", "queued"].includes(item.status));
    const deadlines = projects.map((item) => ({
      project: item,
      value: item.brief?.deadline || item.deadline || item.due || ""
    })).filter((item) => Number.isFinite(new Date(item.value).getTime())).sort((a, b) => new Date(a.value) - new Date(b.value));
    const deadline = deadlines.find((item) => new Date(item.value).getTime() >= Date.now() - 86_400_000) || deadlines[0] || null;
    const publishingIntelligence = project?.analytics?.publishingIntelligence || {};
    const providerRecords = asArray(publishingIntelligence.providers).filter((provider) => provider?.configured === true);
    const cost = relevantRuns.reduce((sum, run) => sum + Number(run.estimatedCost || 0), 0)
      + providerRecords.reduce((sum, provider) => sum + Number(provider.credits || 0), 0);
    const latencyRuns = relevantRuns.filter((run) => Number(run.latencyMs) > 0);
    const providerLatencies = providerRecords.filter((provider) => Number(provider.avgLatencyMs) > 0);
    const averageLatency = latencyRuns.length
      ? Math.round(latencyRuns.reduce((sum, run) => sum + Number(run.latencyMs), 0) / latencyRuns.length)
      : providerLatencies.length
        ? Math.round(providerLatencies.reduce((sum, provider) => sum + Number(provider.avgLatencyMs), 0) / providerLatencies.length)
        : 0;
    const providers = [...new Set([
      ...relevantRuns.map((run) => clean(run.provider, 60)),
      ...providerRecords.map((provider) => clean(provider.label || provider.id, 60))
    ].filter(Boolean))];
    const quotaUsed = providerRecords.reduce((sum, provider) => sum + Number(provider.quotaUsed || 0), 0);
    const quotaLimit = providerRecords.reduce((sum, provider) => sum + Number(provider.quotaLimit || 0), 0);
    const rightsWarnings = asArray(project?.rights?.warnings);
    const unlicensed = assets.filter((asset) => !clean(asset.license)).length;
    const rightsCount = rightsWarnings.length + unlicensed;
    const progress = projectProgress(project);
    const widgets = {
      project: {
        value: project ? `${progress}%` : "Chưa có dự án",
        meta: project ? project.name : "Tạo Universal Project để bắt đầu",
        detail: project ? `${projects.length} dự án · cập nhật ${formatDate(project.updatedAt)}` : "Không tạo dữ liệu mẫu."
      },
      deadline: {
        value: deadline ? relativeDate(deadline.value) : "Chưa đặt deadline",
        meta: deadline ? deadline.project.name : "Không có mốc thời gian",
        detail: deadline ? formatDate(deadline.value) : "Thêm deadline trong Creative Brief."
      },
      ai: {
        value: pendingRuns.length ? `${pendingRuns.length} đang chạy` : failedRuns.length ? `${failedRuns.length} lỗi` : relevantRuns.length ? `${relevantRuns.length} lượt chạy` : "Chưa có hoạt động",
        meta: pendingRuns.length ? "Đang xử lý qua provider" : failedRuns.length ? "Có lượt chạy cần thử lại" : "Không có job nền",
        detail: relevantRuns.length ? `${relevantRuns.filter((run) => run.status === "success").length} hoàn tất · ${failedRuns.length} lỗi` : "AI Center chưa ghi nhận lượt chạy cho dự án."
      },
      asset: {
        value: assets[0] ? assets[0].name : "Chưa có asset",
        meta: assets[0] ? `${assets.length} asset · ${clean(assets[0].kind || assets[0].type, 50)}` : "Media Center đang trống",
        detail: assets[0] ? `Thêm ${formatDate(assets[0].createdAt)}` : "Ảnh, video, audio và tài liệu sẽ xuất hiện tại đây."
      },
      comments: {
        value: unread.length ? `${unread.length} chưa đọc` : comments.length ? "Đã xử lý hết" : "Chưa có bình luận",
        meta: `${comments.length} bình luận trong dự án`,
        detail: unread[0]?.text || "Creative Review chưa có tín hiệu mới."
      },
      publishing: {
        value: pendingPublishing.length ? `${pendingPublishing.length} đang chờ` : publishing.length ? "Không có hàng đợi" : "Chưa có lịch",
        meta: publishing.length ? `${publishing.filter((item) => item.status === "published").length} đã xuất bản` : "Publishing Calendar chưa có dữ liệu",
        detail: pendingPublishing[0] ? `${pendingPublishing[0].platform || "Nền tảng"} · ${formatDate(pendingPublishing[0].scheduledAt)}` : "Chưa có nội dung chờ xử lý."
      },
      provider: {
        value: providers.length ? `${providers.length} provider` : "Chưa cấu hình",
        meta: providers.length ? `${averageLatency ? `${averageLatency} ms · ` : ""}${formatNumber(cost)} chi phí ghi nhận${quotaLimit ? ` · quota ${formatNumber(quotaUsed)}/${formatNumber(quotaLimit)}` : ""}` : "Không suy đoán quota",
        detail: providers.length ? providers.join(" · ") : "Provider Router chỉ báo sẵn sàng khi backend xác nhận."
      },
      rights: {
        value: rightsCount ? `${rightsCount} cảnh báo` : assets.length ? "Chưa thấy cảnh báo" : "Chưa có asset",
        meta: project?.rights?.verified ? "Manifest đã xác minh" : "Cần kiểm tra provenance",
        detail: rightsWarnings[0]?.message || (unlicensed ? `${unlicensed} asset chưa có giấy phép được ghi nhận.` : "Không có cảnh báo quyền đang hoạt động.")
      }
    };
    return {
      projects, project, progress, runs: relevantRuns, allRuns: runs, pendingRuns, failedRuns, assets, comments, unread,
      publishing, pendingPublishing, deadline, providers, providerRecords, cost, averageLatency, quotaUsed, quotaLimit, rightsCount, widgets
    };
  }

  function clusterSignal(cluster, data) {
    const project = data.project;
    if (!project) return { value: "Chưa có hoạt động", level: "empty", detail: "Mở một công cụ để tạo hồ sơ riêng." };
    if (cluster.id === "command") return { value: `${data.progress}% dự án`, level: data.progress >= 80 ? "ready" : "active", detail: `${data.projects.length} dự án · ${asArray(project.versions).length} phiên bản` };
    if (cluster.id === "idea") return { value: data.pendingRuns.length ? `${data.pendingRuns.length} AI đang chạy` : data.runs.length ? `${data.runs.length} AI run` : "Chưa có AI run", level: data.failedRuns.length ? "error" : data.pendingRuns.length ? "processing" : "active", detail: `${asArray(project.prompts).length} prompt · ${asArray(project.scripts).length} kịch bản` };
    if (cluster.id === "preproduction") return { value: `${asArray(project.storyboard).length} shot`, level: asArray(project.storyboard).length ? "active" : "empty", detail: `${asArray(project.world?.characters).length} nhân vật · ${asArray(project.world?.locations).length} địa điểm` };
    if (cluster.id === "production") return { value: `${data.assets.length} asset`, level: data.assets.length ? "ready" : "empty", detail: `${asArray(project.brand?.colors).length} màu brand · ${asArray(project.brand?.logos).length} logo` };
    if (cluster.id === "workflow") return { value: data.pendingRuns.length ? `${data.pendingRuns.length} job đang chạy` : `${asArray(project.workflows?.nodes).length} node`, level: data.failedRuns.length ? "error" : data.pendingRuns.length ? "processing" : "active", detail: `${data.failedRuns.length} lỗi · ${data.runs.filter((run) => run.status === "success").length} hoàn tất` };
    return { value: data.pendingPublishing.length ? `${data.pendingPublishing.length} chờ xuất bản` : project.review?.status === "approved" ? "Đã duyệt" : "Chưa có hàng đợi", level: data.rightsCount ? "warning" : project.review?.status === "approved" ? "ready" : "active", detail: `${data.unread.length} bình luận mới · ${data.rightsCount} cảnh báo quyền` };
  }

  function resolvedTheme(prefs) {
    if (!prefs.syncTheme) return prefs.theme;
    const home = read(HOME_PREF_KEY, {});
    return THEMES.some((item) => item[0] === home.theme) ? home.theme : prefs.theme;
  }

  function visualProfile(prefs = {}) {
    const home = read(HOME_PREF_KEY, {});
    const synced = prefs.syncTheme !== false;
    const reduced = Boolean(global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    const motion = reduced ? "off" : synced ? clean(home.motion || prefs.motion || "balanced", 20) : prefs.motion || "balanced";
    const metric = (key, fallback) => Number.isFinite(Number(home[key])) ? Number(home[key]) : fallback;
    return {
      theme: resolvedTheme(prefs),
      motion,
      stars: clamp(synced ? metric("stars", 64) : 70, 0, 100),
      particles: clamp(synced ? metric("particles", 64) : 65, 0, 100),
      nebula: clamp(synced ? metric("nebula", 68) : 68, 0, 100),
      glow: clamp(synced ? metric("glow", 70) : 70, 0, 100),
      parallax: clamp(synced ? metric("parallax", 55) : 55, 0, 100),
      effectComet: !reduced && (synced ? home.effectComet !== false : true),
      effectNova: !reduced && (synced ? home.effectNova !== false : true),
      effectWormhole: !reduced && (synced ? home.effectWormhole !== false : true),
      reduced
    };
  }

  function projectLevel(project, runs = []) {
    if (!project) return "empty";
    if (runs.some((run) => run.projectId === project.id && run.status === "failed") || asArray(project.rights?.warnings).length) return "error";
    if (runs.some((run) => run.projectId === project.id && ["queued", "running"].includes(run.status)) || project.review?.status === "review") return "processing";
    return asArray(project.assets).length || project.brief?.goal || project.brief?.description ? "active" : "empty";
  }

  function projectStages(data) {
    const project = data.project;
    if (!project) return [];
    return [
      ["Brief", "/create/brief", Boolean(project.brief?.goal || project.brief?.description), false],
      ["Prompt", "/create/ai-center", Boolean(asArray(project.prompts).length || data.runs.length), Boolean(data.failedRuns.length)],
      ["Script", "/create/ai-script", Boolean(asArray(project.scripts).length), false],
      ["Storyboard", "/create/storyboard", Boolean(asArray(project.storyboard).length), false],
      ["Assets", "/create/media-center", Boolean(data.assets.length), Boolean(data.rightsCount)],
      ["Review", "/create/review", ["review", "approved", "published"].includes(project.review?.status), false],
      ["Publish", "/create/publishing", Boolean(data.publishing.length), data.publishing.some((item) => item.status === "failed")]
    ];
  }

  function liveMarkup(instance, data) {
    return `<section class="cg-live" aria-label="Creative LIVE ORBIT">
      <header><span><i></i><b>CREATIVE LIVE ORBIT</b><small>Dữ liệu đã lưu của workspace hiện tại · không tạo số giả</small></span><button type="button" data-cg-settings>⚙ Cá nhân hóa</button></header>
      <div data-cg-live-list>${instance.prefs.widgetOrder.filter((id) => !instance.prefs.hiddenWidgets.includes(id)).map((id) => {
        const widget = WIDGETS.find((item) => item[0] === id);
        const item = data.widgets[id];
        return `<button type="button" data-cg-widget="${id}" style="--signal:${widget[3]}"><i>${widget[2]}</i><span><small>${esc(widget[1])}</small><strong>${esc(item.value)}</strong><em>${esc(item.meta)}</em></span><b></b><div>${esc(item.detail)}</div></button>`;
      }).join("")}</div>
    </section>`;
  }

  function galaxyMarkup(instance, data) {
    const visibleClusters = CLUSTERS.map((cluster) => ({ ...cluster, tools: cluster.tools.filter((tool) => !instance.prefs.hiddenTools.includes(tool[0])) }));
    const active = visibleClusters.find((cluster) => cluster.id === instance.focusCluster);
    return `<section class="cg-universe ${active ? "has-focus" : ""}" data-cg-universe>
      <canvas data-cg-canvas aria-hidden="true"></canvas>
      <div class="cg-nebula" aria-hidden="true"><i></i><i></i><i></i></div>
      <header class="cg-universe-head"><span><small>CREATIVE GALAXY COMMAND CENTER</small><h2>Biến ý tưởng thành sản phẩm</h2><p>Ba mươi lăm công cụ chuyên trách có vai trò, dữ liệu, đầu ra và lịch sử tách biệt.</p></span>
        <div><button type="button" data-cg-new-project>+ Dự án mới</button><button type="button" data-cg-continue>Tiếp tục công việc →</button></div>
      </header>
      <div class="cg-orbits" aria-label="Sáu cụm thiên hà sáng tạo">
        <div class="cg-orbit-line o1"></div><div class="cg-orbit-line o2"></div><div class="cg-orbit-line o3"></div>
        <button class="cg-sun" type="button" data-cg-sun aria-label="Mở dự án đang hoạt động">
          <i></i><span>H</span><b>CREATIVE SUN</b><small>${data.project ? esc(data.project.name) : "CHƯA CÓ DỰ ÁN"}</small><em style="--progress:${data.progress}%"></em>
        </button>
        <div class="cg-project-stars" aria-label="Các cụm sao dự án">${data.projects.slice(0, 6).map((project, index) => {
          const level = projectLevel(project, data.allRuns);
          const activeProject = project.id === data.project?.id;
          return `<button type="button" class="is-${level}${activeProject ? " is-active" : ""}" data-cg-project="${esc(project.id)}" style="--project-index:${index}" aria-pressed="${activeProject}" title="${esc(project.name)}"><i></i><span>${esc(project.name)}</span></button>`;
        }).join("")}</div>
        ${visibleClusters.map((cluster, index) => {
          const signal = clusterSignal(cluster, data);
          const pinned = cluster.tools.filter((tool) => instance.prefs.pinnedTools.includes(tool[0])).length;
          return `<button class="cg-cluster is-${signal.level}${active?.id === cluster.id ? " is-selected" : ""}" type="button" data-cg-cluster="${cluster.id}" style="--cluster:${cluster.color};--cluster-index:${index};--cluster-angle:${cluster.angle}deg" aria-pressed="${active?.id === cluster.id}">
            <i><span>${cluster.icon}</span><b></b><em></em></i>
            <strong>${esc(cluster.label)}</strong><small>${esc(signal.value)}</small>${pinned ? `<mark>${pinned}</mark>` : ""}
          </button>`;
        }).join("")}
      </div>
      <div class="cg-project-constellation">
        <header><span>PROJECT CONSTELLATION</span><b>${data.project ? `${asArray(data.project.versions).length} phiên bản · ${data.assets.length} asset` : "Chưa có dữ liệu"}</b></header>
        <div>${data.project ? projectStages(data).map(([label, route, done, error], index) => `<button type="button" data-cg-route="${route}" class="${done ? "is-done" : ""}${error ? " is-error" : ""}" style="--step:${index}" title="Mở ${label}"><i></i><b>${label}</b></button>`).join("") : "<p>Hãy tạo dự án đầu tiên để hình thành chòm sao sản xuất.</p>"}</div>
      </div>
      ${active ? focusMarkup(instance, active, data) : ""}
      <div class="cg-event-layer" data-cg-event-layer aria-live="polite"></div>
    </section>`;
  }

  function focusMarkup(instance, cluster, data) {
    const signal = clusterSignal(cluster, data);
    const activities = [
      ...data.runs.slice(0, 3).map((run) => ({ text: `${run.action || "AI"} · ${run.status}`, at: run.createdAt, type: run.status })),
      ...data.assets.slice(0, 2).map((asset) => ({ text: `Asset ${asset.name}`, at: asset.createdAt, type: "asset" })),
      ...data.publishing.slice(0, 2).map((item) => ({ text: `${item.title || "Nội dung"} · ${item.status}`, at: item.createdAt || item.scheduledAt, type: item.status }))
    ].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)).slice(0, 5);
    return `<aside class="cg-focus" data-cg-focus style="--focus:${cluster.color}">
      <header><span><i>${cluster.icon}</i><small>CREATIVE FOCUS GALAXY</small><strong>${esc(cluster.label)}</strong></span><button type="button" data-cg-focus-close aria-label="Đóng">×</button></header>
      <p>${esc(cluster.description)}</p>
      <section class="cg-focus-signal"><span class="is-${signal.level}"><i></i>${esc(signal.value)}</span><small>${esc(signal.detail)}</small></section>
      <section class="cg-focus-metrics">
        <span><small>Tiến độ</small><b>${data.project ? `${data.progress}%` : "—"}</b></span>
        <span><small>AI job</small><b>${data.pendingRuns.length || data.failedRuns.length || "0"}</b></span>
        <span><small>Asset</small><b>${data.assets.length}</b></span>
        <span class="${data.rightsCount ? "is-warning" : ""}"><small>Cảnh báo</small><b>${data.rightsCount}</b></span>
      </section>
      <div class="cg-focus-tools">${cluster.tools.map((tool) => `<button type="button" data-cg-route="${tool[2]}" class="${instance.prefs.pinnedTools.includes(tool[0]) ? "is-pinned" : ""}"><i>${instance.prefs.pinnedTools.includes(tool[0]) ? "★" : "◇"}</i><span><b>${esc(tool[1])}</b><small>${esc(toolStatus(tool[0], data))}</small></span><em>→</em></button>`).join("") || '<div class="cg-empty">Tất cả công cụ trong cụm đang bị ẩn.</div>'}</div>
      <section class="cg-focus-history"><header><span>LỊCH SỬ DỰ ÁN THẬT</span><b>${activities.length} tín hiệu</b></header>${activities.length ? activities.map((item) => `<p class="is-${esc(item.type)}"><i></i><span>${esc(item.text)}</span><time>${formatDate(item.at)}</time></p>`).join("") : "<p>Chưa có hoạt động được ghi nhận.</p>"}</section>
      <footer><button type="button" data-cg-continue-cluster="${cluster.id}">Tiếp tục</button><button type="button" data-cg-route="/create/project">Mở dự án</button>${data.failedRuns.length ? '<button type="button" data-cg-retry>Chạy lại</button>' : ""}<button class="is-primary" type="button" data-cg-review>Gửi duyệt</button></footer>
    </aside>`;
  }

  function toolStatus(id, data) {
    const project = data.project;
    if (!project) return "Chưa có dự án";
    if (id === "overview" || id === "project") return `${data.progress}% hoàn thành`;
    if (id === "ai-center" || id === "ai-script") return data.pendingRuns.length ? `${data.pendingRuns.length} đang chạy` : `${data.runs.length} lượt chạy`;
    if (id === "brief") return project.brief?.goal || project.brief?.description ? "Đã có dữ liệu" : "Chưa có brief";
    if (id === "moodboard" || id === "media-center") return `${data.assets.length} asset`;
    if (id === "storyboard") return `${asArray(project.storyboard).length} shot`;
    if (id === "world-bible") return `${asArray(project.world?.characters).length} nhân vật`;
    if (["workflow", "ai-director", "prompt-studio", "ai-automation"].includes(id)) return data.failedRuns.length ? `${data.failedRuns.length} lỗi` : `${asArray(project.workflows?.nodes).length} node`;
    if (id === "review" || id === "collaboration") return `${data.unread.length} chưa đọc · ${project.review?.status || "draft"}`;
    if (id === "publishing") return `${data.pendingPublishing.length} đang chờ`;
    if (id === "rights") return `${data.rightsCount} cảnh báo`;
    if (id === "providers") return data.providers.length ? `${data.providers.length} provider` : "Chưa cấu hình";
    if (id === "analytics") return project.analytics?.impressions ? `${formatNumber(project.analytics.impressions)} impressions` : "Chưa có dữ liệu đo";
    return data.assets.length ? `${data.assets.length} asset liên kết` : "Chưa có hoạt động";
  }

  function settingsMarkup(instance) {
    const state = instance.store?.getState?.() || readCoreState();
    const projects = asArray(state.projects);
    const draft = instance.settingsDraft || clone(instance.prefs);
    return `<aside class="cg-settings" data-cg-settings-panel role="dialog" aria-modal="true" aria-label="Cá nhân hóa Creative Galaxy">
      <button class="cg-settings-backdrop" type="button" data-cg-settings-close aria-label="Đóng"></button>
      <section>
        <header><span><small>CREATIVE GALAXY CONTROL</small><h3>Cá nhân hóa xưởng sáng tạo</h3></span><button type="button" data-cg-settings-close>×</button></header>
        <div class="cg-settings-body">
          <article><div class="cg-settings-title"><span>Preset dùng ngay</span><small>Mỗi preset thay đổi công cụ ghim, LIVE ORBIT và mức chuyển động.</small></div><div class="cg-preset-grid">${PRESETS.map((preset) => `<button type="button" data-cg-preset="${preset[0]}" aria-pressed="${draft.preset === preset[0]}"><i>${preset[2].slice(0, 2).toUpperCase()}</i><span><b>${preset[1]}</b><small>${preset[3].length} công cụ ghim</small></span></button>`).join("")}</div></article>
          <article><div class="cg-settings-title"><span>Màu và chuyển động</span><small>Đồng bộ Galaxy Control Deck hoặc chọn riêng Creative OS.</small></div>
            <label class="cg-toggle"><input type="checkbox" data-cg-pref="syncTheme" ${draft.syncTheme ? "checked" : ""}><i><b></b></i><span>Đồng bộ theme với trang chủ</span></label>
            <div class="cg-setting-row"><label>Theme<select data-cg-pref="theme" ${draft.syncTheme ? "disabled" : ""}>${THEMES.map((theme) => `<option value="${theme[0]}" ${theme[0] === draft.theme ? "selected" : ""}>${theme[1]}</option>`).join("")}</select></label><label>Chuyển động<select data-cg-pref="motion">${[["off", "Tắt"], ["minimal", "Tối giản"], ["balanced", "Cân bằng"], ["cinematic", "Điện ảnh"], ["adaptive", "Theo FPS"]].map(([id, label]) => `<option value="${id}" ${id === draft.motion ? "selected" : ""}>${label}</option>`).join("")}</select></label></div>
          </article>
          <article><div class="cg-settings-title"><span>Dự án và công cụ ghim</span><small>Chọn dự án mặc định và tối đa sáu lối tắt.</small></div>
            <label class="cg-project-select">Dự án mặc định<select data-cg-pref="defaultProjectId"><option value="">Theo dự án đang hoạt động</option>${projects.map((project) => `<option value="${esc(project.id)}" ${project.id === draft.defaultProjectId ? "selected" : ""}>${esc(project.name)}</option>`).join("")}</select></label>
            <div class="cg-tool-settings">${allTools().map((tool) => `<label><input type="checkbox" data-cg-pin-tool="${tool[0]}" ${draft.pinnedTools.includes(tool[0]) ? "checked" : ""}><i>${draft.pinnedTools.includes(tool[0]) ? "★" : "☆"}</i><span>${esc(tool[1])}</span><input type="checkbox" data-cg-hide-tool="${tool[0]}" ${draft.hiddenTools.includes(tool[0]) ? "checked" : ""} aria-label="Ẩn ${esc(tool[1])}"><em>Ẩn</em></label>`).join("")}</div>
          </article>
          <article><div class="cg-settings-title"><span>LIVE ORBIT</span><small>Bật/tắt và sắp xếp tín hiệu realtime.</small></div><div class="cg-widget-settings">${draft.widgetOrder.map((id, index) => {
            const widget = WIDGETS.find((item) => item[0] === id);
            return `<div><label><input type="checkbox" data-cg-widget-visible="${id}" ${draft.hiddenWidgets.includes(id) ? "" : "checked"}><i style="--widget:${widget[3]}">${widget[2]}</i><span>${esc(widget[1])}</span></label><span><button type="button" data-cg-widget-move="${id}" data-direction="-1" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-cg-widget-move="${id}" data-direction="1" ${index === draft.widgetOrder.length - 1 ? "disabled" : ""}>↓</button></span></div>`;
          }).join("")}</div></article>
        </div>
        <footer><button type="button" data-cg-settings-reset>Khôi phục</button><span><button type="button" data-cg-settings-close>Để sau</button><button class="is-primary" type="button" data-cg-settings-apply>Áp dụng</button></span></footer>
        <div class="cg-settings-status" data-cg-settings-status role="status"></div>
      </section>
    </aside>`;
  }

  function miniMarkup(data, theme) {
    return `<section class="cg-mini" data-cg-mini data-theme="${theme}">
      <button class="cg-mini-sun" type="button" data-cg-mini-route="/create"><i>H</i><span><small>CREATIVE GALAXY · CHỈ ĐỌC</small><b>${data.project ? esc(data.project.name) : "Chưa có hoạt động sáng tạo"}</b></span></button>
      <div><span><i style="--signal:#5eefff"></i><small>Tiến độ</small><b>${data.project ? `${data.progress}%` : "—"}</b></span><span><i style="--signal:#ff59d5"></i><small>AI</small><b>${data.pendingRuns.length || data.runs.length || "—"}</b></span><span><i style="--signal:#6af0ae"></i><small>Asset</small><b>${data.assets.length || "—"}</b></span><span><i style="--signal:#7fa7ff"></i><small>Xuất bản</small><b>${data.pendingPublishing.length || "—"}</b></span></div>
      <button type="button" data-cg-mini-route="/create">Mở kho Sáng tạo →</button>
    </section>`;
  }

  function render(instance) {
    const state = instance.store?.getState?.() || readCoreState();
    instance.data = snapshot(state, instance.prefs);
    instance.profile = visualProfile(instance.prefs);
    const theme = instance.profile.theme;
    const themeMeta = THEMES.find((item) => item[0] === theme) || THEMES[0];
    instance.root.innerHTML = `${liveMarkup(instance, instance.data)}${galaxyMarkup(instance, instance.data)}`;
    instance.root.dataset.theme = theme;
    instance.root.dataset.motion = instance.profile.motion;
    instance.root.dataset.effectComet = String(instance.profile.effectComet);
    instance.root.dataset.effectNova = String(instance.profile.effectNova);
    instance.root.dataset.effectWormhole = String(instance.profile.effectWormhole);
    instance.root.dataset.creativeGalaxy = "";
    instance.root.style.setProperty("--cg-star-density", String(instance.profile.stars / 100));
    instance.root.style.setProperty("--cg-nebula-strength", String(instance.profile.nebula / 100));
    instance.root.style.setProperty("--cg-glow-strength", String(instance.profile.glow / 100));
    instance.root.style.setProperty("--cg-parallax-strength", String(instance.profile.parallax / 100));
    global.document?.body?.style?.setProperty("--cg-a", themeMeta[2]);
    global.document?.body?.style?.setProperty("--cg-b", themeMeta[3]);
    global.document?.body?.style?.setProperty("--cg-c", themeMeta[2]);
    instance.startCanvas?.();
  }

  function navigate(instance, route) {
    const tool = allTools().find((item) => item[2] === route);
    if (tool) {
      instance.prefs.lastWorkspace = tool[0];
      instance.prefs.updatedAt = Date.now();
      write(PREF_KEY, instance.prefs);
    }
    const go = () => {
      if (typeof instance.options.onNavigate === "function") instance.options.onNavigate(route);
      else if (global.location) global.location.hash = `#${route}`;
    };
    if (instance.profile?.effectWormhole) openWormhole(route, go);
    else go();
  }

  function wormholeNeedsEngine(route) {
    const id = String(route || "").split("/").filter(Boolean)[1] || "overview";
    return ENGINE_ROUTES.has(id);
  }

  function normalizedRoute(value) {
    const route = String(value || "").replace(/^#/, "") || "/home";
    return route.startsWith("/") ? route : `/${route}`;
  }

  function wormholeWorkspaceReady(state = wormholeState) {
    if (!state || normalizedRoute(global.location?.hash) !== normalizedRoute(state.route)) return false;
    if (!state.needsEngine) return true;
    const view = String(state.route || "").split("/").filter(Boolean)[1] || "overview";
    const shell = global.document?.querySelector?.(`[data-creative-os][data-view="${view}"]`);
    const host = shell?.querySelector?.("[data-cos-workspace]");
    return Boolean(host && host.children.length && !host.querySelector(".creative-os__loader, .creative-os__error"));
  }

  function probeWormhole(state = wormholeState) {
    if (!state || state !== wormholeState) return;
    clearInterval(state.probe);
    state.probe = setInterval(() => {
      if (state !== wormholeState) return clearInterval(state.probe);
      if (wormholeWorkspaceReady(state)) closeWormhole(true);
    }, 80);
  }

  function closeWormhole(success = true, message = "") {
    const state = wormholeState;
    if (!state) return false;
    clearTimeout(state.timeout);
    clearInterval(state.probe);
    const overlay = global.document?.querySelector?.("[data-cg-wormhole]");
    if (!overlay) { wormholeState = null; return false; }
    if (!success) {
      overlay.classList.add("is-reverse", "is-error");
      const status = overlay.querySelector("[data-cg-wormhole-status]");
      if (status) status.textContent = message || "Workspace chưa sẵn sàng.";
      overlay.querySelector("[data-cg-wormhole-retry]")?.removeAttribute("hidden");
      return true;
    }
    overlay.classList.add("is-complete");
    setTimeout(() => overlay.remove(), 260);
    wormholeState = null;
    return true;
  }

  function openWormhole(route, onNavigate) {
    const profile = visualProfile({ syncTheme: true, motion: "balanced", theme: "neon" });
    const reduced = profile.reduced || profile.motion === "off" || profile.effectWormhole === false;
    if (!global.document || reduced) {
      onNavigate?.();
      return false;
    }
    global.document.querySelector("[data-cg-wormhole]")?.remove();
    const tool = allTools().find((item) => item[2] === route);
    const label = tool?.[1] || "Creative Workspace";
    const overlay = global.document.createElement("section");
    overlay.className = "cg-wormhole";
    overlay.dataset.cgWormhole = "";
    overlay.dataset.route = clean(route, 220);
    overlay.innerHTML = `<div aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div><section role="status" aria-live="polite"><span>H</span><small>WORMHOLE NAVIGATION</small><strong>${esc(label)}</strong><p data-cg-wormhole-status>Đang chuẩn bị workspace và dữ liệu dự án...</p><button type="button" data-cg-wormhole-retry hidden>Thử lại</button></section>`;
    global.document.body.append(overlay);
    const navigate = typeof onNavigate === "function" ? onNavigate : () => { global.location.hash = `#${route}`; };
    wormholeState = {
      route: normalizedRoute(route),
      navigate,
      needsEngine: wormholeNeedsEngine(route),
      timeout: 0,
      probe: 0
    };
    global.requestAnimationFrame?.(() => overlay.classList.add("is-active"));
    const startedAt = Date.now();
    const preparation = global.HHCreativeOS?.prepareRoute?.(route);
    Promise.resolve(preparation).catch(() => null).then(() => {
      const wait = Math.max(0, 280 - (Date.now() - startedAt));
      setTimeout(() => {
        const state = wormholeState;
        if (!state || state.route !== normalizedRoute(route)) return;
        const wasCurrentRoute = normalizedRoute(global.location?.hash) === state.route;
        state.timeout = setTimeout(() => {
          if (wormholeWorkspaceReady(state) || normalizedRoute(global.location?.hash) === state.route) closeWormhole(true);
          else closeWormhole(false, "Không thể mở workspace. Hãy thử lại.");
        }, 7000);
        navigate();
        if (wasCurrentRoute && typeof global.dispatchEvent === "function" && typeof global.Event === "function") {
          global.dispatchEvent(new global.Event("hashchange"));
        }
        probeWormhole(state);
      }, wait);
    });
    return true;
  }

  function announce(instance, text, tone = "") {
    const layer = instance.root.querySelector("[data-cg-event-layer]");
    if (!layer) return;
    layer.innerHTML = `<div class="is-${tone}"><i></i><span>${esc(text)}</span></div>`;
    clearTimeout(instance.noticeTimer);
    instance.noticeTimer = setTimeout(() => { if (layer) layer.innerHTML = ""; }, 3600);
  }

  function triggerEvent(instance, type) {
    const layer = instance.root.querySelector("[data-cg-event-layer]");
    if (!layer || ["off", "minimal"].includes(instance.profile?.motion || instance.prefs.motion)) return;
    const className = type === "success" ? "nova" : type === "error" ? "flare" : type === "comment" ? "comet" : "pulse";
    if (className === "nova" && instance.profile?.effectNova === false) return;
    if (className === "comet" && instance.profile?.effectComet === false) return;
    layer.insertAdjacentHTML("beforeend", `<i class="cg-${className}" aria-hidden="true"></i>`);
    setTimeout(() => layer.querySelector(`.cg-${className}`)?.remove(), 1500);
  }

  function startCanvas(instance) {
    global.cancelAnimationFrame?.(instance.canvasFrame);
    const canvas = instance.root.querySelector("[data-cg-canvas]");
    const context = canvas?.getContext?.("2d");
    const profile = instance.profile || visualProfile(instance.prefs);
    if (!canvas || !context || profile.motion === "off") return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(2, global.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.max(8, Math.round((profile.motion === "minimal" ? 18 : profile.motion === "hyper" ? 56 : 44) * profile.stars / 100));
    const stars = Array.from({ length: count }, (_, index) => ({
      x: Math.random() * rect.width, y: Math.random() * rect.height, z: .2 + Math.random() * .8,
      r: .35 + Math.random() * 1.25, hue: [188, 215, 275, 324, 45][index % 5]
    }));
    let previous = 0;
    const draw = (time) => {
      if (!instance.root.isConnected || instance.destroyed) return;
      instance.canvasFrame = global.requestAnimationFrame?.(draw);
      if (global.document.hidden) return;
      const adaptive = profile.motion === "adaptive";
      const delta = Math.min(50, time - previous || 16);
      instance.fps = instance.fps * .88 + (1000 / Math.max(1, delta)) * .12;
      const speed = adaptive && instance.fps < 40 ? .004 : ["cinematic", "hyper"].includes(profile.motion) ? .022 : profile.motion === "vivid" ? .016 : .01;
      context.clearRect(0, 0, rect.width, rect.height);
      const visibleStars = adaptive && instance.fps < 42 ? Math.ceil(stars.length * .52) : stars.length;
      stars.forEach((star, index) => {
        star.y += speed * star.z * Math.min(34, delta);
        if (star.y > rect.height + 2) { star.y = -2; star.x = Math.random() * rect.width; }
        if (index >= visibleStars) return;
        context.beginPath();
        context.fillStyle = `hsla(${star.hue},90%,78%,${.12 + star.z * .38})`;
        context.arc(star.x + instance.pointerX * star.z * 12 * profile.parallax / 100, star.y + instance.pointerY * star.z * 8 * profile.parallax / 100, star.r * star.z, 0, Math.PI * 2);
        context.fill();
      });
      previous = time;
    };
    instance.canvasFrame = global.requestAnimationFrame?.(draw);
  }

  function openSettings(instance) {
    instance.settingsDraft = clone(instance.prefs);
    instance.root.insertAdjacentHTML("beforeend", settingsMarkup(instance));
    global.document.documentElement.classList.add("cg-settings-open");
  }

  function closeSettings(instance) {
    instance.root.querySelector("[data-cg-settings-panel]")?.remove();
    global.document.documentElement.classList.remove("cg-settings-open");
    instance.settingsDraft = null;
  }

  function rerenderSettings(instance, message = "") {
    const panel = instance.root.querySelector("[data-cg-settings-panel]");
    if (!panel) return;
    panel.outerHTML = settingsMarkup(instance);
    if (message) {
      const status = instance.root.querySelector("[data-cg-settings-status]");
      if (status) status.textContent = message;
    }
  }

  function handleSettingsClick(instance, event) {
    const target = event.target;
    if (target.closest("[data-cg-settings-close]")) return closeSettings(instance);
    const preset = target.closest("[data-cg-preset]");
    if (preset) {
      instance.settingsDraft = applyPreset(instance.settingsDraft, preset.dataset.cgPreset);
      return rerenderSettings(instance, `Đã xem trước preset ${PRESETS.find((item) => item[0] === preset.dataset.cgPreset)?.[1]}.`);
    }
    const move = target.closest("[data-cg-widget-move]");
    if (move) {
      const order = instance.settingsDraft.widgetOrder;
      const index = order.indexOf(move.dataset.cgWidgetMove);
      const next = index + Number(move.dataset.direction);
      if (index >= 0 && next >= 0 && next < order.length) [order[index], order[next]] = [order[next], order[index]];
      instance.settingsDraft.preset = "custom";
      return rerenderSettings(instance);
    }
    if (target.closest("[data-cg-settings-reset]")) {
      instance.settingsDraft = defaultPrefs();
      return rerenderSettings(instance, "Đã đưa cấu hình mặc định vào bản xem trước.");
    }
    if (target.closest("[data-cg-settings-apply]")) {
      instance.prefs = normalizePrefs({ ...instance.settingsDraft, updatedAt: Date.now() });
      write(PREF_KEY, instance.prefs);
      closeSettings(instance);
      render(instance);
      announce(instance, "Đã áp dụng cá nhân hóa Creative Galaxy.", "success");
    }
  }

  function handleSettingsChange(instance, event) {
    const target = event.target;
    if (!instance.settingsDraft) return;
    if (target.matches("[data-cg-pref]")) {
      const key = target.dataset.cgPref;
      instance.settingsDraft[key] = target.type === "checkbox" ? target.checked : target.value;
      instance.settingsDraft.preset = "custom";
      if (key === "syncTheme") rerenderSettings(instance);
      return;
    }
    if (target.matches("[data-cg-pin-tool]")) {
      const id = target.dataset.cgPinTool;
      const next = instance.settingsDraft.pinnedTools.filter((item) => item !== id);
      if (target.checked) {
        if (next.length >= 6) {
          target.checked = false;
          const status = instance.root.querySelector("[data-cg-settings-status]");
          if (status) status.textContent = "Chỉ có thể ghim tối đa sáu workspace.";
          return;
        }
        next.push(id);
        instance.settingsDraft.hiddenTools = instance.settingsDraft.hiddenTools.filter((item) => item !== id);
      }
      instance.settingsDraft.pinnedTools = next;
      instance.settingsDraft.preset = "custom";
      return rerenderSettings(instance);
    }
    if (target.matches("[data-cg-hide-tool]")) {
      const id = target.dataset.cgHideTool;
      const next = instance.settingsDraft.hiddenTools.filter((item) => item !== id);
      if (target.checked) {
        next.push(id);
        instance.settingsDraft.pinnedTools = instance.settingsDraft.pinnedTools.filter((item) => item !== id);
      }
      instance.settingsDraft.hiddenTools = next;
      instance.settingsDraft.preset = "custom";
      return rerenderSettings(instance);
    }
    if (target.matches("[data-cg-widget-visible]")) {
      const id = target.dataset.cgWidgetVisible;
      const next = instance.settingsDraft.hiddenWidgets.filter((item) => item !== id);
      if (!target.checked) next.push(id);
      instance.settingsDraft.hiddenWidgets = next;
      instance.settingsDraft.preset = "custom";
    }
  }

  function bind(instance) {
    instance.root.addEventListener("pointermove", (event) => {
      const rect = instance.root.getBoundingClientRect();
      instance.pointerX = (event.clientX - rect.left) / Math.max(1, rect.width) - .5;
      instance.pointerY = (event.clientY - rect.top) / Math.max(1, rect.height) - .5;
      instance.root.style.setProperty("--pointer-x", `${(instance.pointerX + .5) * 100}%`);
      instance.root.style.setProperty("--pointer-y", `${(instance.pointerY + .5) * 100}%`);
    }, { signal: instance.controller.signal });
    instance.root.addEventListener("click", (event) => {
      const target = event.target;
      if (target.closest("[data-cg-settings-panel]")) return handleSettingsClick(instance, event);
      const route = target.closest("[data-cg-route]");
      if (route) return navigate(instance, route.dataset.cgRoute);
      const project = target.closest("[data-cg-project]");
      if (project) {
        instance.store?.setActiveProject?.(project.dataset.cgProject);
        announce(instance, "Đã chuyển Universal Project đang hoạt động.", "success");
        return navigate(instance, "/create/project");
      }
      const cluster = target.closest("[data-cg-cluster]");
      if (cluster) {
        instance.focusCluster = instance.focusCluster === cluster.dataset.cgCluster ? "" : cluster.dataset.cgCluster;
        render(instance);
        return;
      }
      if (target.closest("[data-cg-focus-close]")) { instance.focusCluster = ""; render(instance); return; }
      if (target.closest("[data-cg-settings]")) return openSettings(instance);
      if (target.closest("[data-cg-new-project]")) {
        const project = instance.store?.createProject?.({ name: `Dự án sáng tạo ${new Date().toLocaleDateString("vi-VN")}` });
        if (project) {
          triggerEvent(instance, "success");
          navigate(instance, "/create/project");
        }
        return;
      }
      if (target.closest("[data-cg-sun]")) return navigate(instance, "/create/project");
      if (target.closest("[data-cg-continue]")) {
        const tool = toolById(instance.prefs.lastWorkspace) || toolById(instance.prefs.pinnedTools[0]) || toolById("project");
        return navigate(instance, tool[2]);
      }
      const continueCluster = target.closest("[data-cg-continue-cluster]");
      if (continueCluster) {
        const clusterMeta = CLUSTERS.find((item) => item.id === continueCluster.dataset.cgContinueCluster);
        const tool = clusterMeta?.tools.find((item) => instance.prefs.pinnedTools.includes(item[0])) || clusterMeta?.tools[0];
        if (tool) navigate(instance, tool[2]);
        return;
      }
      if (target.closest("[data-cg-retry]")) {
        const failed = instance.data.failedRuns[0];
        if (!failed) return;
        write(RETRY_KEY, { runId: failed.id, projectId: failed.projectId, requestedAt: Date.now() });
        navigate(instance, "/create/ai-center");
        return;
      }
      if (target.closest("[data-cg-review]")) {
        if (!instance.data.project) return announce(instance, "Hãy tạo dự án trước khi gửi duyệt.", "warning");
        const project = instance.data.project;
        instance.store?.updateProject?.(project.id, { review: { ...project.review, status: "review", locked: false } });
        triggerEvent(instance, "comment");
        announce(instance, "Đã chuyển dự án sang trạng thái chờ duyệt.", "success");
        return;
      }
      const widget = target.closest("[data-cg-widget]");
      if (widget) {
        const routeByWidget = { project: "/create/project", deadline: "/create/brief", ai: "/create/ai-center", asset: "/create/media-center", comments: "/create/review", publishing: "/create/publishing", provider: "/create/providers", rights: "/create/rights" };
        navigate(instance, routeByWidget[widget.dataset.cgWidget] || "/create");
      }
    }, { signal: instance.controller.signal });
    instance.root.addEventListener("change", (event) => {
      if (event.target.closest("[data-cg-settings-panel]")) handleSettingsChange(instance, event);
    }, { signal: instance.controller.signal });
  }

  function mount(root, options = {}) {
    if (!root) return false;
    if (instances.has(root)) {
      const existing = instances.get(root);
      existing.options = { ...existing.options, ...options };
      existing.prefs.lastWorkspace = options.view && toolById(options.view) ? options.view : existing.prefs.lastWorkspace;
      render(existing);
      return existing.api;
    }
    const store = options.store || global.HHCreativeCore?.createStore?.();
    if (!store?.getState) return false;
    const controller = new AbortController();
    const instance = {
      root, store, options, controller,
      prefs: normalizePrefs(read(PREF_KEY, {})),
      focusCluster: "",
      pointerX: 0, pointerY: 0, fps: 60,
      destroyed: false,
      startCanvas: null
    };
    if (options.view && toolById(options.view)) instance.prefs.lastWorkspace = options.view;
    instance.startCanvas = () => startCanvas(instance);
    bind(instance);
    instance.unsubscribe = store.subscribe?.((state, action) => {
      const before = instance.data;
      render(instance);
      if (action?.type === "ADD_ASSET" && before?.assets?.length !== instance.data.assets.length) triggerEvent(instance, "success");
      if (action?.type === "ADD_RUN") {
        const run = instance.data.runs[0];
        triggerEvent(instance, run?.status === "failed" ? "error" : run?.status === "success" ? "success" : "processing");
      }
      if ((before?.unread?.length || 0) < instance.data.unread.length) triggerEvent(instance, "comment");
      if ((before?.rightsCount || 0) < instance.data.rightsCount) triggerEvent(instance, "error");
      if ((before?.pendingPublishing?.length || 0) > instance.data.pendingPublishing.length) triggerEvent(instance, "success");
    });
    render(instance);
    const api = Object.freeze({
      version: VERSION,
      refresh: () => render(instance),
      preferences: () => clone(instance.prefs),
      snapshot: () => clone(instance.data),
      focus: (id) => { instance.focusCluster = CLUSTERS.some((item) => item.id === id) ? id : ""; render(instance); },
      openSettings: () => openSettings(instance),
      destroy: () => unmount(root)
    });
    instance.api = api;
    instances.set(root, instance);
    mountedRoots.add(root);
    return api;
  }

  function unmount(root) {
    const instance = instances.get(root);
    if (!instance) return false;
    instance.destroyed = true;
    instance.controller.abort();
    instance.unsubscribe?.();
    global.cancelAnimationFrame?.(instance.canvasFrame);
    clearTimeout(instance.noticeTimer);
    global.document?.documentElement?.classList.remove("cg-settings-open");
    root.replaceChildren();
    instances.delete(root);
    mountedRoots.delete(root);
    return true;
  }

  function readCoreState() {
    return readToolIndex();
  }

  function mountMini() {
    if (!global.document || !String(global.location?.hash || "").replace(/^#/, "").startsWith("/create")) {
      global.document?.querySelector?.("[data-cg-mini]")?.remove();
      return false;
    }
    if (global.document.querySelector("[data-creative-os]")) {
      global.document.querySelector("[data-cg-mini]")?.remove();
      return false;
    }
    const workspace = global.document.querySelector("#appWorkspace");
    if (!workspace || workspace.querySelector("[data-cg-mini]")) return false;
    const prefs = normalizePrefs(read(PREF_KEY, {}));
    const data = snapshot(readCoreState(), prefs);
    workspace.insertAdjacentHTML("afterbegin", miniMarkup(data, resolvedTheme(prefs)));
    const mini = workspace.querySelector("[data-cg-mini]");
    mini?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-cg-mini-route]");
      if (button) global.location.hash = `#${button.dataset.cgMiniRoute}`;
    });
    return true;
  }

  function autoMount() {
    if (!global.document || autoMounted) return false;
    autoMounted = true;
    let frame = 0;
    const attach = () => {
      global.cancelAnimationFrame?.(frame);
      frame = global.requestAnimationFrame?.(() => mountMini());
    };
    if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", attach, { once: true });
    else attach();
    global.addEventListener?.("hashchange", () => setTimeout(attach, 60));
    global.addEventListener?.("hh:assets-ready", () => setTimeout(attach, 0));
    global.addEventListener?.("hh:creative-project-change", () => {
      const mini = global.document.querySelector("[data-cg-mini]");
      if (mini) { mini.remove(); attach(); }
    });
    global.addEventListener?.("hh:home-galaxy-preferences-applied", () => {
      mountedRoots.forEach((root) => {
        const instance = instances.get(root);
        if (instance) render(instance);
      });
      const mini = global.document.querySelector("[data-cg-mini]");
      if (mini) { mini.remove(); attach(); }
    });
    global.addEventListener?.("hh:route-rendered", (event) => {
      if (!wormholeState || event.detail?.route !== wormholeState.route || wormholeState.needsEngine) return;
      setTimeout(() => closeWormhole(true), 80);
    });
    global.addEventListener?.("hh:creative-workspace-ready", (event) => {
      const targetView = String(wormholeState?.route || "").split("/").filter(Boolean)[1] || "overview";
      if (wormholeState && (event.detail?.route === wormholeState.route || event.detail?.view === targetView)) closeWormhole(true);
    });
    global.addEventListener?.("hh:creative-workspace-error", (event) => {
      const targetView = String(wormholeState?.route || "").split("/").filter(Boolean)[1] || "overview";
      if (wormholeState && (event.detail?.route === wormholeState.route || event.detail?.view === targetView)) closeWormhole(false, event.detail?.message || "Workspace tải lỗi.");
    });
    global.document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-cg-wormhole-retry]") || !wormholeState) return;
      const overlay = global.document.querySelector("[data-cg-wormhole]");
      overlay?.classList.remove("is-reverse", "is-error");
      const status = overlay?.querySelector("[data-cg-wormhole-status]");
      if (status) status.textContent = "Đang thử mở lại workspace...";
      event.target.setAttribute("hidden", "");
      clearTimeout(wormholeState.timeout);
      const state = wormholeState;
      global.HHCreativeOS?.prepareRoute?.(state.route).catch?.(() => {});
      state.navigate?.();
      if (typeof global.dispatchEvent === "function" && typeof global.Event === "function") {
        global.dispatchEvent(new global.Event("hashchange"));
      }
      state.timeout = setTimeout(() => {
        if (normalizedRoute(global.location?.hash) === state.route) closeWormhole(true);
        else closeWormhole(false);
      }, 7000);
      probeWormhole(state);
    });
    if (typeof global.MutationObserver === "function") {
      const observer = new global.MutationObserver(attach);
      observer.observe(global.document.documentElement, { childList: true, subtree: true });
    }
    return true;
  }

  return Object.freeze({
    VERSION, PREF_KEY, CORE_KEY, CLUSTERS, WIDGETS, THEMES, PRESETS,
    normalizePrefs, applyPreset, aggregateToolStates, readToolIndex, snapshot, clusterSignal, projectProgress, visualProfile,
    mount, unmount, autoMount, openWormhole, closeWormhole
  });
});
