(function initHHPlatformOrchestrator(globalScope, factory) {
  "use strict";

  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) {
    globalScope.HHPlatformOrchestrator = api;
    if (!globalScope.HHPlatformRuntime && globalScope.document) {
      let storage = null;
      try { storage = globalScope.localStorage; } catch { storage = null; }
      globalScope.HHPlatformRuntime = api.createRuntime({ storage, eventTarget: globalScope, CustomEvent: globalScope.CustomEvent });
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function platformOrchestratorFactory() {
  "use strict";

  const VERSION = 2;
  const STORAGE_KEY = "hh.platform.orchestrator.v2";
  const LEGACY_STORAGE_KEY = "hh.platform.orchestrator.v1";
  const JOB_STATES = Object.freeze(["queued", "running", "waiting", "completed", "failed", "cancelled"]);
  const TERMINAL_JOB_STATES = new Set(["completed", "failed", "cancelled"]);
  const SENSITIVE_KEY = /(?:password|passcode|secret|token|authorization|cookie|credential|private[-_]?key|api[-_]?key|card|cvv)/i;
  const TRANSITIONS = Object.freeze({
    queued: ["running", "waiting", "cancelled"],
    running: ["waiting", "completed", "failed", "cancelled"],
    waiting: ["queued", "running", "failed", "cancelled"],
    completed: [],
    failed: ["queued"],
    cancelled: ["queued"]
  });
  const ASSET_STATES = Object.freeze(["draft", "processing", "ready", "review", "published", "archived"]);
  const INTEGRATION_STATES = Object.freeze(["connected", "degraded", "offline", "needs-setup"]);

  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const text = (value, limit = 1000) => String(value == null ? "" : value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .normalize("NFC")
    .slice(0, limit);
  const clamp = (value, min, max, fallback = min) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };

  function sanitize(value, depth = 0) {
    if (depth > 6 || value == null) return value == null ? null : undefined;
    if (["string", "number", "boolean"].includes(typeof value)) {
      if (typeof value === "string") return text(value, 10000);
      return typeof value === "number" && !Number.isFinite(value) ? 0 : value;
    }
    if (Array.isArray(value)) return value.slice(0, 250).map((item) => sanitize(item, depth + 1)).filter((item) => item !== undefined);
    if (typeof value !== "object") return undefined;
    return Object.entries(value).slice(0, 250).reduce((result, [key, item]) => {
      const safeKey = text(key, 100).trim();
      if (!safeKey || SENSITIVE_KEY.test(safeKey)) return result;
      const safeValue = sanitize(item, depth + 1);
      if (safeValue !== undefined) result[safeKey] = safeValue;
      return result;
    }, {});
  }

  function defaultState() {
    return {
      version: VERSION,
      activeProjectId: "",
      projects: [],
      assets: [],
      versions: [],
      jobs: [],
      providers: [],
      integrations: [],
      guides: {},
      activities: [],
      audit: [],
      updatedAt: now()
    };
  }

  function normalizeProject(input = {}) {
    const createdAt = text(input.createdAt || now(), 40);
    return {
      id: text(input.id || uid("project"), 100),
      name: text(input.name || "Dự án chưa đặt tên", 200),
      area: text(input.area || "platform", 80),
      status: ["active", "paused", "blocked", "completed", "archived"].includes(input.status) ? input.status : "active",
      progress: clamp(input.progress, 0, 100, 0),
      dueAt: text(input.dueAt, 40),
      nextAction: text(input.nextAction, 500),
      context: sanitize(input.context || {}) || {},
      createdAt,
      updatedAt: text(input.updatedAt || createdAt, 40)
    };
  }

  function normalizeJob(input = {}) {
    const state = JOB_STATES.includes(input.state) ? input.state : "queued";
    return {
      id: text(input.id || uid("job"), 100),
      type: text(input.type || "task", 100),
      area: text(input.area || "platform", 80),
      projectId: text(input.projectId, 100),
      providerId: text(input.providerId, 100),
      state,
      progress: clamp(input.progress, 0, 100, state === "completed" ? 100 : 0),
      input: sanitize(input.input || {}) || {},
      output: sanitize(input.output || {}) || {},
      error: text(input.error, 1000),
      attempts: clamp(input.attempts, 0, 20, 0),
      createdAt: text(input.createdAt || now(), 40),
      updatedAt: text(input.updatedAt || now(), 40)
    };
  }

  function normalizeAsset(input = {}) {
    const createdAt = text(input.createdAt || now(), 40);
    return {
      id: text(input.id || uid("asset"), 100),
      projectId: text(input.projectId, 100),
      kind: text(input.kind || "file", 80),
      name: text(input.name || "Tài sản chưa đặt tên", 200),
      state: ASSET_STATES.includes(input.state) ? input.state : "draft",
      uri: text(input.uri, 2000),
      mimeType: text(input.mimeType, 120),
      size: clamp(input.size, 0, Number.MAX_SAFE_INTEGER, 0),
      metadata: sanitize(input.metadata || {}) || {},
      createdAt,
      updatedAt: text(input.updatedAt || createdAt, 40)
    };
  }

  function normalizeVersion(input = {}) {
    const createdAt = text(input.createdAt || now(), 40);
    return {
      id: text(input.id || uid("version"), 100),
      projectId: text(input.projectId, 100),
      assetId: text(input.assetId, 100),
      label: text(input.label || "Bản nháp", 160),
      state: ASSET_STATES.includes(input.state) ? input.state : "draft",
      snapshot: sanitize(input.snapshot || {}) || {},
      createdAt,
      createdBy: text(input.createdBy || "local", 120)
    };
  }

  function normalizeIntegration(input = {}) {
    return {
      id: text(input.id || uid("integration"), 100),
      providerId: text(input.providerId || input.id, 100),
      area: text(input.area || "platform", 80),
      label: text(input.label || input.providerId || input.id || "Integration", 160),
      state: INTEGRATION_STATES.includes(input.state) ? input.state : "needs-setup",
      capabilities: [...new Set((Array.isArray(input.capabilities) ? input.capabilities : []).map((item) => text(item, 100)).filter(Boolean))],
      lastCheckedAt: text(input.lastCheckedAt || now(), 40),
      detail: text(input.detail, 300)
    };
  }

  function normalizeActivity(input = {}) {
    return {
      id: text(input.id || uid("activity"), 100),
      projectId: text(input.projectId, 100),
      type: text(input.type || "note", 80),
      message: text(input.message || "Hoạt động mới", 300),
      actor: text(input.actor || "local", 120),
      metadata: sanitize(input.metadata || {}) || {},
      createdAt: text(input.createdAt || now(), 40)
    };
  }

  function normalizeProvider(input = {}, existing = {}) {
    const limit = clamp(input.quotaLimit ?? existing.quotaLimit, 0, Number.MAX_SAFE_INTEGER, 0);
    return {
      id: text(input.id || existing.id, 100),
      label: text(input.label || existing.label || input.id, 160),
      configured: Boolean(input.configured ?? existing.configured),
      status: ["ready", "limited", "offline", "needs-setup"].includes(input.status) ? input.status : (existing.status || "needs-setup"),
      quotaLimit: limit,
      quotaUsed: clamp(input.quotaUsed ?? existing.quotaUsed, 0, Number.MAX_SAFE_INTEGER, 0),
      resetAt: text(input.resetAt || existing.resetAt, 40),
      capabilities: [...new Set((Array.isArray(input.capabilities) ? input.capabilities : existing.capabilities || []).map((item) => text(item, 100)).filter(Boolean))],
      updatedAt: now()
    };
  }

  function migrate(input) {
    if (!input || typeof input !== "object") return defaultState();
    const projects = (Array.isArray(input.projects) ? input.projects : []).slice(0, 200).map(normalizeProject);
    return {
      version: VERSION,
      activeProjectId: text(input.activeProjectId, 100) || projects[0]?.id || "",
      projects,
      assets: (Array.isArray(input.assets) ? input.assets : []).slice(-500).map(normalizeAsset),
      versions: (Array.isArray(input.versions) ? input.versions : []).slice(-500).map(normalizeVersion),
      jobs: (Array.isArray(input.jobs) ? input.jobs : []).slice(-500).map(normalizeJob),
      providers: (Array.isArray(input.providers) ? input.providers : []).slice(0, 100).map((item) => normalizeProvider(item)),
      integrations: (Array.isArray(input.integrations) ? input.integrations : []).slice(0, 100).map(normalizeIntegration),
      guides: sanitize(input.guides || {}) || {},
      activities: (Array.isArray(input.activities) ? input.activities : []).slice(-500).map(normalizeActivity),
      audit: (Array.isArray(input.audit) ? input.audit : []).slice(-300).map((item) => sanitize(item)).filter(Boolean),
      updatedAt: text(input.updatedAt || now(), 40)
    };
  }

  function createRuntime(options = {}) {
    const storage = options.storage || null;
    const eventTarget = options.eventTarget || null;
    const adapters = new Map();
    let state = defaultState();
    try {
      const raw = storage?.getItem?.(STORAGE_KEY) || storage?.getItem?.(LEGACY_STORAGE_KEY) || "null";
      state = migrate(JSON.parse(raw));
    } catch { state = defaultState(); }

    function emit(name, detail) {
      if (!eventTarget?.dispatchEvent) return;
      const EventClass = options.CustomEvent || globalThis.CustomEvent;
      if (typeof EventClass === "function") eventTarget.dispatchEvent(new EventClass(name, { detail: clone(detail) }));
    }

    function persist() {
      state.updatedAt = now();
      try { storage?.setItem?.(STORAGE_KEY, JSON.stringify(state)); } catch { /* local quota/private mode */ }
      emit("hh:orchestrator:change", inspect());
    }

    function audit(action, detail = {}) {
      state.audit.push({ id: uid("audit"), action: text(action, 160), detail: sanitize(detail) || {}, createdAt: now() });
      state.audit = state.audit.slice(-300);
    }

    function upsertProject(input) {
      const existingIndex = state.projects.findIndex((project) => project.id === input?.id);
      const existing = existingIndex >= 0 ? state.projects[existingIndex] : {};
      const project = normalizeProject({ ...existing, ...input, context: { ...(existing.context || {}), ...(input?.context || {}) }, updatedAt: now() });
      if (existingIndex >= 0) state.projects[existingIndex] = project;
      else state.projects.unshift(project);
      if (!state.activeProjectId) state.activeProjectId = project.id;
      audit(existingIndex >= 0 ? "project.updated" : "project.created", { projectId: project.id, area: project.area });
      persist();
      return clone(project);
    }

    function activateProject(projectId) {
      if (!state.projects.some((project) => project.id === projectId)) throw new Error("Không tìm thấy dự án.");
      state.activeProjectId = projectId;
      audit("project.activated", { projectId });
      persist();
      return getActiveProject();
    }

    function upsertAsset(input) {
      const existingIndex = state.assets.findIndex((asset) => asset.id === input?.id);
      const existing = existingIndex >= 0 ? state.assets[existingIndex] : {};
      const asset = normalizeAsset({ ...existing, ...input, updatedAt: now() });
      if (existingIndex >= 0) state.assets[existingIndex] = asset;
      else state.assets.unshift(asset);
      state.assets = state.assets.slice(0, 500);
      audit(existingIndex >= 0 ? "asset.updated" : "asset.created", { assetId: asset.id, projectId: asset.projectId, kind: asset.kind });
      persist();
      return clone(asset);
    }

    function addVersion(input) {
      const version = normalizeVersion(input);
      state.versions.unshift(version);
      state.versions = state.versions.slice(0, 500);
      recordActivity({ projectId: version.projectId, type: "version.created", message: `Đã tạo ${version.label}`, metadata: { versionId: version.id, assetId: version.assetId } });
      return clone(version);
    }

    function recordActivity(input) {
      const activity = normalizeActivity(input);
      state.activities.unshift(activity);
      state.activities = state.activities.slice(0, 500);
      audit("activity.recorded", { activityId: activity.id, projectId: activity.projectId, type: activity.type });
      persist();
      return clone(activity);
    }

    function setIntegration(input) {
      if (!input?.providerId && !input?.id) throw new Error("Integration cần providerId hoặc id.");
      const providerId = text(input.providerId || input.id, 100);
      const index = state.integrations.findIndex((item) => item.providerId === providerId && item.area === text(input.area || "platform", 80));
      const integration = normalizeIntegration({ ...(index >= 0 ? state.integrations[index] : {}), ...input, providerId });
      if (index >= 0) state.integrations[index] = integration;
      else state.integrations.push(integration);
      audit("integration.updated", { providerId, area: integration.area, state: integration.state });
      persist();
      return clone(integration);
    }

    function getActiveProject() {
      return clone(state.projects.find((project) => project.id === state.activeProjectId) || null);
    }

    function enqueue(input) {
      const job = normalizeJob({ ...input, state: "queued" });
      state.jobs.unshift(job);
      state.jobs = state.jobs.slice(0, 500);
      audit("job.queued", { jobId: job.id, type: job.type, providerId: job.providerId });
      persist();
      return clone(job);
    }

    function transitionJob(jobId, nextState, patch = {}) {
      const index = state.jobs.findIndex((job) => job.id === jobId);
      if (index < 0) throw new Error("Không tìm thấy tác vụ.");
      const current = state.jobs[index];
      if (!JOB_STATES.includes(nextState) || !TRANSITIONS[current.state].includes(nextState)) {
        throw new Error(`Không thể chuyển tác vụ từ ${current.state} sang ${nextState}.`);
      }
      const next = normalizeJob({ ...current, ...patch, id: current.id, state: nextState, updatedAt: now() });
      if (nextState === "completed") next.progress = 100;
      state.jobs[index] = next;
      audit(`job.${nextState}`, { jobId, type: next.type, error: next.error });
      persist();
      return clone(next);
    }

    function registerAdapter(type, adapter) {
      if (!type || typeof adapter !== "function") throw new TypeError("Adapter cần type và hàm xử lý.");
      adapters.set(text(type, 100), adapter);
      return () => adapters.delete(text(type, 100));
    }

    async function run(jobId) {
      const queued = state.jobs.find((job) => job.id === jobId);
      if (!queued) throw new Error("Không tìm thấy tác vụ.");
      if (!['queued', 'failed', 'cancelled'].includes(queued.state)) throw new Error("Tác vụ chưa sẵn sàng để chạy.");
      if (queued.state !== "queued") transitionJob(jobId, "queued", { error: "", progress: 0 });
      const job = state.jobs.find((item) => item.id === jobId);
      const adapter = adapters.get(job.type);
      if (!adapter) return transitionJob(jobId, "waiting", { error: "Cần cấu hình bộ xử lý cho tác vụ này." });
      transitionJob(jobId, "running", { attempts: job.attempts + 1, error: "" });
      try {
        const result = await adapter(clone(state.jobs.find((item) => item.id === jobId)));
        if (!result || result.ok !== true) throw new Error(result?.error || "Bộ xử lý chưa xác nhận hoàn tất.");
        return transitionJob(jobId, "completed", { output: result.output || {}, error: "" });
      } catch (error) {
        return transitionJob(jobId, "failed", { error: text(error?.message || error, 1000) });
      }
    }

    function setProvider(input) {
      if (!input?.id) throw new Error("Nhà cung cấp cần id.");
      if (Object.keys(input).some((key) => SENSITIVE_KEY.test(key))) throw new Error("Không lưu khóa bí mật trong trình duyệt.");
      const index = state.providers.findIndex((provider) => provider.id === input.id);
      const provider = normalizeProvider(input, index >= 0 ? state.providers[index] : {});
      if (index >= 0) state.providers[index] = provider;
      else state.providers.push(provider);
      audit("provider.updated", { providerId: provider.id, status: provider.status });
      persist();
      return clone(provider);
    }

    function consumeQuota(providerId, amount = 1) {
      const index = state.providers.findIndex((provider) => provider.id === providerId);
      if (index < 0) throw new Error("Nhà cung cấp chưa được cấu hình.");
      const provider = state.providers[index];
      const nextUsed = provider.quotaUsed + clamp(amount, 0, Number.MAX_SAFE_INTEGER, 0);
      if (provider.quotaLimit > 0 && nextUsed > provider.quotaLimit) throw new Error("Đã vượt hạn mức API.");
      provider.quotaUsed = nextUsed;
      provider.status = provider.quotaLimit > 0 && nextUsed >= provider.quotaLimit ? "limited" : provider.status;
      provider.updatedAt = now();
      audit("provider.quota", { providerId, amount });
      persist();
      return clone(provider);
    }

    function updateGuide(area, input = {}) {
      const key = text(area || "platform", 80);
      const current = state.guides[key] || {};
      state.guides[key] = {
        flowId: text(input.flowId || current.flowId || key, 100),
        step: clamp(input.step ?? current.step, 0, 1000, 0),
        completed: [...new Set([...(current.completed || []), ...(input.completed || [])].map((item) => text(item, 100)).filter(Boolean))],
        updatedAt: now()
      };
      audit("guide.updated", { area: key, step: state.guides[key].step });
      persist();
      return clone(state.guides[key]);
    }

    function suggestions(referenceTime = Date.now()) {
      const result = [];
      const active = state.projects.find((project) => project.id === state.activeProjectId);
      if (active?.nextAction) result.push({ priority: 90, kind: "next-action", projectId: active.id, label: active.nextAction });
      state.projects.forEach((project) => {
        const due = Date.parse(project.dueAt);
        if (project.status === "blocked") result.push({ priority: 100, kind: "blocked", projectId: project.id, label: `Gỡ vướng: ${project.name}` });
        else if (Number.isFinite(due) && due < referenceTime && project.status !== "completed") result.push({ priority: 95, kind: "overdue", projectId: project.id, label: `Đã quá hạn: ${project.name}` });
      });
      state.jobs.filter((job) => job.state === "waiting").forEach((job) => result.push({ priority: 85, kind: "adapter", jobId: job.id, label: `Cấu hình bộ xử lý: ${job.type}` }));
      state.providers.filter((provider) => provider.status === "limited" || (provider.quotaLimit && provider.quotaUsed / provider.quotaLimit >= 0.8))
        .forEach((provider) => result.push({ priority: 80, kind: "quota", providerId: provider.id, label: `Kiểm tra hạn mức ${provider.label}` }));
      return result.sort((a, b) => b.priority - a.priority);
    }

    function inspect() {
      return clone({
        version: VERSION,
        activeProjectId: state.activeProjectId,
        projects: state.projects,
        assets: state.assets,
        versions: state.versions,
        jobs: state.jobs,
        providers: state.providers,
        integrations: state.integrations,
        guides: state.guides,
        activities: state.activities,
        audit: state.audit,
        suggestions: suggestions(),
        updatedAt: state.updatedAt
      });
    }

    return {
      upsertProject, activateProject, getActiveProject, upsertAsset, addVersion, recordActivity, setIntegration,
      enqueue, transitionJob, registerAdapter, run, setProvider, consumeQuota, updateGuide, suggestions, inspect,
      listJobs: (filter = {}) => clone(state.jobs.filter((job) => Object.entries(filter).every(([key, value]) => job[key] === value))),
      listProjects: () => clone(state.projects),
      listAssets: (filter = {}) => clone(state.assets.filter((asset) => Object.entries(filter).every(([key, value]) => asset[key] === value))),
      listVersions: (filter = {}) => clone(state.versions.filter((version) => Object.entries(filter).every(([key, value]) => version[key] === value))),
      listProviders: () => clone(state.providers),
      listIntegrations: () => clone(state.integrations),
      listActivities: (projectId = "") => clone(state.activities.filter((activity) => !projectId || activity.projectId === projectId)),
      isTerminalJobState: (value) => TERMINAL_JOB_STATES.has(value)
    };
  }

  return { VERSION, STORAGE_KEY, JOB_STATES, sanitize, migrate, createRuntime };
});
