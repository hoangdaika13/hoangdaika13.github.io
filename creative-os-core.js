(function (globalScope, factory) {
  "use strict";

  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHCreativeCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "hh.creative-os.v1";
  const FORMAT = "hh-creative-project";
  const MAX_PROJECTS = 50;
  const MAX_STATE_BYTES = 4_500_000;
  const MAX_PROJECT_BYTES = 1_500_000;
  const MAX_ASSET_BYTES = 600_000;
  const MAX_ASSETS = 120;
  const MAX_RUNS = 500;
  const MAX_VERSIONS = 30;
  const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
  const blockedKeys = /(?:api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret|credential|authorization|private[-_]?key)/i;

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function bytes(value) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    if (encoder) return encoder.encode(text).byteLength;
    if (typeof Buffer !== "undefined") return Buffer.byteLength(text, "utf8");
    return unescape(encodeURIComponent(text)).length;
  }

  function error(code, message) {
    const next = new Error(message);
    next.code = code;
    return next;
  }

  function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function cleanText(value, limit = 5000) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .normalize("NFC")
      .slice(0, limit);
  }

  function cleanId(value, prefix = "item") {
    const text = cleanText(value, 100).trim().replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
    return text || `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function isoDate(value, fallback = new Date().toISOString()) {
    const date = new Date(value || fallback);
    return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
  }

  function safeUrl(value) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return "";
    const text = cleanText(raw, 1200);
    if (/^https?:\/\//i.test(text)) return text;
    return "";
  }

  function sanitizeValue(value, depth = 0) {
    if (depth > 6 || value == null) return value == null ? null : undefined;
    if (typeof value === "string") return cleanText(value);
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.slice(0, 200).map((item) => sanitizeValue(item, depth + 1)).filter((item) => item !== undefined);
    if (typeof value !== "object") return undefined;
    const result = {};
    Object.entries(value).slice(0, 200).forEach(([key, item]) => {
      const safeKey = cleanText(key, 80).trim();
      if (!safeKey || blockedKeys.test(safeKey)) return;
      const safe = sanitizeValue(item, depth + 1);
      if (safe !== undefined) result[safeKey] = safe;
    });
    return result;
  }

  function list(value, limit, normalizer) {
    return (Array.isArray(value) ? value : []).slice(0, limit).map(normalizer);
  }

  function normalizePrompt(item, index) {
    const input = item && typeof item === "object" ? item : { content: item };
    return {
      id: cleanId(input.id, `prompt-${index + 1}`),
      title: cleanText(input.title || `Prompt ${index + 1}`, 160),
      content: cleanText(input.content, 30000),
      model: cleanText(input.model, 120),
      negative: cleanText(input.negative, 10000),
      seed: cleanText(input.seed, 100),
      createdAt: isoDate(input.createdAt)
    };
  }

  function normalizeScript(item, index) {
    const input = item && typeof item === "object" ? item : { content: item };
    return {
      id: cleanId(input.id, `script-${index + 1}`),
      title: cleanText(input.title || `Kịch bản ${index + 1}`, 160),
      content: cleanText(input.content, 80000),
      language: cleanText(input.language || "vi", 20),
      status: cleanText(input.status || "draft", 40),
      createdAt: isoDate(input.createdAt),
      updatedAt: isoDate(input.updatedAt || input.createdAt)
    };
  }

  function normalizeShot(item, index) {
    const input = item && typeof item === "object" ? item : {};
    return {
      id: cleanId(input.id, `shot-${index + 1}`),
      title: cleanText(input.title || `Cảnh ${index + 1}`, 160),
      description: cleanText(input.description, 12000),
      dialogue: cleanText(input.dialogue, 12000),
      duration: clamp(input.duration, 0, 7200, 5),
      camera: cleanText(input.camera, 300),
      motion: cleanText(input.motion, 500),
      audio: cleanText(input.audio, 500),
      order: clamp(input.order, 0, 10000, index)
    };
  }

  function normalizeAsset(item, index) {
    const input = item && typeof item === "object" ? item : {};
    return {
      id: cleanId(input.id, `asset-${index + 1}`),
      name: cleanText(input.name || `Asset ${index + 1}`, 200),
      type: cleanText(input.type || "application/octet-stream", 120),
      kind: cleanText(input.kind || "file", 60),
      size: clamp(input.size, 0, 2_000_000_000, 0),
      source: safeUrl(input.source || input.url || input.dataUrl),
      license: cleanText(input.license, 300),
      tags: list(input.tags, 30, (tag) => cleanText(tag, 60)),
      createdAt: isoDate(input.createdAt)
    };
  }

  function normalizePublishing(item, index) {
    const input = item && typeof item === "object" ? item : {};
    const allowedStatus = ["draft", "scheduled", "publishing", "published", "failed"];
    return {
      id: cleanId(input.id, `publish-${index + 1}`),
      platform: cleanText(input.platform || "Website", 80),
      title: cleanText(input.title || `Nội dung ${index + 1}`, 240),
      scheduledAt: input.scheduledAt ? isoDate(input.scheduledAt) : "",
      status: allowedStatus.includes(input.status) ? input.status : "draft",
      url: safeUrl(input.url),
      metadata: sanitizeValue(input.metadata || {}) || {},
      createdAt: isoDate(input.createdAt)
    };
  }

  function normalizeRun(item, index) {
    const input = item && typeof item === "object" ? item : {};
    return {
      id: cleanId(input.id, `run-${index + 1}`),
      projectId: cleanId(input.projectId, "project"),
      provider: cleanText(input.provider || "local", 80),
      model: cleanText(input.model, 120),
      action: cleanText(input.action || "creative-task", 160),
      tokens: clamp(input.tokens, 0, 100_000_000, 0),
      estimatedCost: clamp(input.estimatedCost, 0, 1_000_000, 0),
      latencyMs: clamp(input.latencyMs, 0, 86_400_000, 0),
      status: ["queued", "running", "success", "failed", "cancelled"].includes(input.status) ? input.status : "success",
      createdAt: isoDate(input.createdAt)
    };
  }

  function defaultProject(input = {}) {
    const now = isoDate(input.createdAt);
    return {
      id: cleanId(input.id, "project"),
      name: cleanText(input.name || "Dự án sáng tạo mới", 180),
      brief: {
        product: "", audience: "", goal: "", platform: "", deadline: "", tone: "",
        cta: "", format: "", description: "", ...(sanitizeValue(input.brief || {}) || {})
      },
      prompts: list(input.prompts, 120, normalizePrompt),
      scripts: list(input.scripts, 80, normalizeScript),
      storyboard: list(input.storyboard, 300, normalizeShot),
      assets: list(input.assets, MAX_ASSETS, normalizeAsset),
      versions: [],
      publishing: list(input.publishing, 100, normalizePublishing),
      world: {
        characters: [], locations: [], props: [], palettes: [], references: [],
        ...(sanitizeValue(input.world || {}) || {})
      },
      workflows: {
        nodes: [], edges: [], presets: [],
        ...(sanitizeValue(input.workflows || {}) || {})
      },
      brand: {
        name: "", voice: "", bannedWords: [], fonts: [], colors: [], logos: [], ctaRules: [],
        ...(sanitizeValue(input.brand || {}) || {})
      },
      review: {
        status: "draft", comments: [], approvals: [], locked: false,
        ...(sanitizeValue(input.review || {}) || {})
      },
      analytics: {
        progress: 0, runs: [], estimatedCost: 0, impressions: 0, clicks: 0,
        ...(sanitizeValue(input.analytics || {}) || {})
      },
      rights: {
        records: [], warnings: [], verified: false,
        ...(sanitizeValue(input.rights || {}) || {})
      },
      createdAt: now,
      updatedAt: isoDate(input.updatedAt || now)
    };
  }

  function normalizeProject(input = {}) {
    const base = defaultProject(input && typeof input === "object" ? input : {});
    base.prompts = list(input.prompts, 120, normalizePrompt);
    base.scripts = list(input.scripts, 80, normalizeScript);
    base.storyboard = list(input.storyboard, 300, normalizeShot).sort((a, b) => a.order - b.order);
    base.assets = list(input.assets, MAX_ASSETS, normalizeAsset);
    base.publishing = list(input.publishing, 100, normalizePublishing);
    base.versions = list(input.versions, MAX_VERSIONS, (item, index) => ({
      id: cleanId(item?.id, `version-${index + 1}`),
      label: cleanText(item?.label || `Phiên bản ${index + 1}`, 160),
      note: cleanText(item?.note, 1000),
      createdAt: isoDate(item?.createdAt),
      snapshot: sanitizeValue(item?.snapshot || {}) || {}
    }));
    base.review.status = ["draft", "review", "approved", "published"].includes(base.review.status) ? base.review.status : "draft";
    base.analytics.progress = clamp(base.analytics.progress, 0, 100, 0);
    base.analytics.estimatedCost = clamp(base.analytics.estimatedCost, 0, 1_000_000, 0);
    base.analytics.runs = list(base.analytics.runs, 200, normalizeRun);
    if (bytes(base) > MAX_PROJECT_BYTES) throw error("PROJECT_TOO_LARGE", "Dự án vượt quá giới hạn dung lượng cục bộ.");
    return base;
  }

  function createDefaultState() {
    return {
      version: VERSION,
      activeProjectId: null,
      projects: [],
      runs: [],
      preferences: { lastView: "overview", filters: {}, autosave: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function migrateState(input) {
    if (!input || typeof input !== "object") return createDefaultState();
    const sourceVersion = Number(input.version || 0);
    if (sourceVersion > VERSION) throw error("UNSUPPORTED_VERSION", "Phiên bản dữ liệu Creative OS chưa được hỗ trợ.");
    if (sourceVersion === VERSION) return clone(input);
    return {
      ...createDefaultState(),
      ...sanitizeValue(input),
      version: VERSION,
      projects: Array.isArray(input.projects) ? input.projects : [],
      activeProjectId: input.activeProjectId || input.active || null,
      runs: Array.isArray(input.runs) ? input.runs : []
    };
  }

  function normalizeState(input) {
    const migrated = migrateState(input);
    const state = createDefaultState();
    state.projects = list(migrated.projects, MAX_PROJECTS, normalizeProject);
    state.runs = list(migrated.runs, MAX_RUNS, normalizeRun);
    const active = cleanId(migrated.activeProjectId || "", "project");
    state.activeProjectId = state.projects.some((project) => project.id === active) ? active : (state.projects[0]?.id || null);
    state.preferences = {
      ...state.preferences,
      ...(sanitizeValue(migrated.preferences || {}) || {})
    };
    state.createdAt = isoDate(migrated.createdAt, state.createdAt);
    state.updatedAt = isoDate(migrated.updatedAt, state.updatedAt);
    if (bytes(state) > MAX_STATE_BYTES) throw error("STATE_TOO_LARGE", "Creative OS đã đạt giới hạn lưu trữ cục bộ.");
    return state;
  }

  function exportProject(project) {
    const normalized = normalizeProject(project);
    return JSON.stringify({
      format: FORMAT,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      project: normalized
    }, null, 2);
  }

  function importProject(payload) {
    let parsed;
    try {
      parsed = typeof payload === "string" ? JSON.parse(payload) : clone(payload);
    } catch {
      throw error("INVALID_JSON", "Tệp dự án không phải JSON hợp lệ.");
    }
    if (!parsed || parsed.format !== FORMAT) throw error("UNSUPPORTED_FORMAT", "Định dạng dự án không được hỗ trợ.");
    if (Number(parsed.version) !== VERSION) throw error("UNSUPPORTED_VERSION", "Phiên bản dự án không được hỗ trợ.");
    if (bytes(parsed) > MAX_PROJECT_BYTES) throw error("PROJECT_TOO_LARGE", "Tệp dự án vượt quá giới hạn cho phép.");
    return normalizeProject(parsed.project);
  }

  function mergeProject(project, patch) {
    const next = clone(project);
    Object.entries(sanitizeValue(patch || {}) || {}).forEach(([key, value]) => {
      if (["id", "createdAt", "versions"].includes(key)) return;
      if (value && typeof value === "object" && !Array.isArray(value) && next[key] && typeof next[key] === "object" && !Array.isArray(next[key])) {
        next[key] = { ...next[key], ...value };
      } else {
        next[key] = value;
      }
    });
    next.updatedAt = new Date().toISOString();
    return normalizeProject(next);
  }

  function createStore(options = {}) {
    const storageKey = cleanText(options.storageKey || STORAGE_KEY, 160);
    const storage = options.storage || (typeof localStorage !== "undefined" ? localStorage : null);
    const listeners = new Set();
    let state;

    try {
      const saved = storage?.getItem(storageKey);
      state = saved ? normalizeState(JSON.parse(saved)) : normalizeState(options.initialState || createDefaultState());
    } catch {
      state = normalizeState(options.initialState || createDefaultState());
    }

    function persist(next) {
      const text = JSON.stringify(next);
      if (bytes(text) > MAX_STATE_BYTES) throw error("STATE_TOO_LARGE", "Creative OS đã đạt giới hạn lưu trữ cục bộ.");
      if (storage?.setItem) storage.setItem(storageKey, text);
    }

    function commit(next, action) {
      const normalized = normalizeState({ ...next, updatedAt: new Date().toISOString() });
      persist(normalized);
      state = normalized;
      listeners.forEach((listener) => listener(clone(state), clone(action)));
      return clone(state);
    }

    function findProject(projectId) {
      const id = cleanId(projectId, "project");
      const project = state.projects.find((item) => item.id === id);
      if (!project) throw error("PROJECT_NOT_FOUND", "Không tìm thấy dự án Creative OS.");
      return project;
    }

    function dispatch(action) {
      if (!action || typeof action.type !== "string") throw error("INVALID_ACTION", "Creative OS cần một action hợp lệ.");
      const next = clone(state);
      const payload = action.payload || {};
      if (action.type === "CREATE_PROJECT") {
        if (next.projects.length >= MAX_PROJECTS) throw error("PROJECT_LIMIT", `Chỉ có thể lưu tối đa ${MAX_PROJECTS} dự án.`);
        const project = normalizeProject(payload.project || payload);
        if (next.projects.some((item) => item.id === project.id)) project.id = cleanId("", "project");
        next.projects.unshift(project);
        next.activeProjectId = project.id;
      } else if (action.type === "UPDATE_PROJECT") {
        const index = next.projects.findIndex((item) => item.id === cleanId(payload.projectId, "project"));
        if (index < 0) throw error("PROJECT_NOT_FOUND", "Không tìm thấy dự án Creative OS.");
        next.projects[index] = mergeProject(next.projects[index], payload.patch);
      } else if (action.type === "SET_ACTIVE_PROJECT") {
        const id = cleanId(payload.projectId, "project");
        if (!next.projects.some((item) => item.id === id)) throw error("PROJECT_NOT_FOUND", "Không tìm thấy dự án Creative OS.");
        next.activeProjectId = id;
      } else if (action.type === "ADD_ASSET") {
        const index = next.projects.findIndex((item) => item.id === cleanId(payload.projectId, "project"));
        if (index < 0) throw error("PROJECT_NOT_FOUND", "Không tìm thấy dự án Creative OS.");
        if (next.projects[index].assets.length >= MAX_ASSETS) throw error("ASSET_LIMIT", `Mỗi dự án lưu tối đa ${MAX_ASSETS} asset.`);
        next.projects[index].assets.unshift(normalizeAsset(payload.asset, 0));
        next.projects[index].updatedAt = new Date().toISOString();
      } else if (action.type === "ADD_RUN") {
        const projectIndex = next.projects.findIndex((item) => item.id === cleanId(payload.projectId, "project"));
        if (projectIndex < 0) throw error("PROJECT_NOT_FOUND", "Không tìm thấy dự án Creative OS.");
        const run = normalizeRun({ ...payload.run, projectId: next.projects[projectIndex].id }, 0);
        next.runs.unshift(run);
        next.runs = next.runs.slice(0, MAX_RUNS);
        const analytics = next.projects[projectIndex].analytics;
        analytics.runs = [run, ...(analytics.runs || [])].slice(0, 200);
        analytics.estimatedCost = clamp(Number(analytics.estimatedCost || 0) + run.estimatedCost, 0, 1_000_000, 0);
        next.projects[projectIndex].updatedAt = new Date().toISOString();
      } else if (action.type === "SNAPSHOT_PROJECT") {
        const index = next.projects.findIndex((item) => item.id === cleanId(payload.projectId, "project"));
        if (index < 0) throw error("PROJECT_NOT_FOUND", "Không tìm thấy dự án Creative OS.");
        const current = next.projects[index];
        const snapshot = clone(current);
        snapshot.versions = [];
        current.versions.unshift({
          id: cleanId("", "version"),
          label: cleanText(payload.label || `Snapshot ${current.versions.length + 1}`, 160),
          note: cleanText(payload.note, 1000),
          createdAt: new Date().toISOString(),
          snapshot
        });
        current.versions = current.versions.slice(0, MAX_VERSIONS);
        current.updatedAt = new Date().toISOString();
      } else if (action.type === "IMPORT_PROJECT") {
        if (next.projects.length >= MAX_PROJECTS) throw error("PROJECT_LIMIT", `Chỉ có thể lưu tối đa ${MAX_PROJECTS} dự án.`);
        const project = importProject(payload.data);
        if (next.projects.some((item) => item.id === project.id)) project.id = cleanId("", "project");
        next.projects.unshift(project);
        next.activeProjectId = project.id;
      } else if (action.type === "DELETE_PROJECT") {
        const id = cleanId(payload.projectId, "project");
        next.projects = next.projects.filter((item) => item.id !== id);
        next.runs = next.runs.filter((item) => item.projectId !== id);
        if (next.activeProjectId === id) next.activeProjectId = next.projects[0]?.id || null;
      } else {
        throw error("UNKNOWN_ACTION", `Action ${cleanText(action.type, 80)} chưa được hỗ trợ.`);
      }
      return commit(next, action);
    }

    return {
      getState: () => clone(state),
      subscribe(listener) {
        if (typeof listener !== "function") throw error("INVALID_LISTENER", "Listener phải là một hàm.");
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      dispatch,
      createProject(project = {}) {
        dispatch({ type: "CREATE_PROJECT", payload: { project } });
        return clone(state.projects.find((item) => item.id === state.activeProjectId));
      },
      updateProject(projectId, patch) {
        dispatch({ type: "UPDATE_PROJECT", payload: { projectId, patch } });
        return clone(findProject(projectId));
      },
      setActiveProject(projectId) {
        dispatch({ type: "SET_ACTIVE_PROJECT", payload: { projectId } });
        return clone(findProject(projectId));
      },
      addAsset(projectId, asset) {
        dispatch({ type: "ADD_ASSET", payload: { projectId, asset } });
        return clone(findProject(projectId).assets[0]);
      },
      addRun(projectId, run) {
        dispatch({ type: "ADD_RUN", payload: { projectId, run } });
        return clone(state.runs[0]);
      },
      snapshotProject(projectId, label, note) {
        dispatch({ type: "SNAPSHOT_PROJECT", payload: { projectId, label, note } });
        return clone(findProject(projectId).versions[0]);
      },
      deleteProject(projectId) {
        return dispatch({ type: "DELETE_PROJECT", payload: { projectId } });
      },
      exportProject(projectId) {
        return exportProject(findProject(projectId));
      },
      importProject(data) {
        dispatch({ type: "IMPORT_PROJECT", payload: { data } });
        return clone(findProject(state.activeProjectId));
      }
    };
  }

  return Object.freeze({
    VERSION,
    STORAGE_KEY,
    FORMAT,
    MAX_PROJECTS,
    MAX_STATE_BYTES,
    MAX_PROJECT_BYTES,
    createStore,
    createDefaultState,
    normalizeState,
    normalizeProject,
    migrateState,
    exportProject,
    importProject
  });
});
