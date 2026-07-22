(function (globalScope, factory) {
  "use strict";
  const api = factory(globalScope || globalThis);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope && globalScope.document && !globalScope.HHPlatformModuleBridge) {
    globalScope.HHPlatformModuleBridge = api.createBridge({
      runtime: globalScope.HHPlatformRuntime,
      storage: globalScope.localStorage,
      eventTarget: globalScope
    });
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 2;
  const MARKER_KEY = "hh.platform.module-bridge.v1";
  const SOURCE_KEYS = Object.freeze({
    creative: "hh.creative-ai-workflow.v1",
    music: "hh.music-ai-studio.v1",
    media: "hh.media-production.v1",
    dev: "hh.dev.delivery-workflow.v1",
    work: "hh-work-center-v2"
  });
  const MODULE_CHANGE_EVENTS = Object.freeze([
    "hh:creative-workflow-change",
    "hh:music-studio-change",
    "hh:media-production-change",
    "hh:dev-delivery-change",
    "hh:work-center-change"
  ]);
  const SECRET_VALUE_RE = /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+/=-]{12,}|\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|(?:api[_-]?key|secret|password|passwd|access[_-]?token)\s*[:=]\s*\S{8,})/gi;
  const ACTIVE_JOB_STATES = new Set(["queued", "running", "waiting", "needs-adapter", "pending"]);

  function cleanText(value, limit = 240, fallback = "") {
    const text = String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
      .replace(SECRET_VALUE_RE, "[redacted]")
      .trim()
      .slice(0, limit);
    return text || fallback;
  }

  function safeId(value, fallback) {
    return cleanText(value, 100, fallback || "item")
      .toLowerCase()
      .replace(/[^a-z0-9._:-]+/g, "-")
      .replace(/^-+|-+$/g, "") || fallback || "item";
  }

  function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function readJson(storage, key) {
    try {
      const value = storage?.getItem?.(key);
      if (!value) return null;
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function stableHash(value) {
    const text = JSON.stringify(value, Object.keys(value || {}).sort());
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function projectStatus(value) {
    const status = cleanText(value, 40).toLowerCase();
    if (/complete|done|published|ready|hoàn|ổn định/.test(status)) return "completed";
    if (/block|fail|error|trễ|lỗi/.test(status)) return "blocked";
    if (/pause|hold|tạm/.test(status)) return "paused";
    return "active";
  }

  function jobState(value) {
    const state = cleanText(value, 40).toLowerCase();
    if (state === "running") return "running";
    if (["needs-adapter", "waiting", "missing-source", "unsupported", "partial"].includes(state)) return "waiting";
    return "queued";
  }

  function progressFromItems(items, completedValues) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return 0;
    const done = list.filter((item) => completedValues.has(cleanText(item?.status || item?.state, 40).toLowerCase())).length;
    return Math.round(done / list.length * 100);
  }

  function summarizeCreative(raw) {
    if (!raw || typeof raw !== "object") return [];
    const nodes = Array.isArray(raw.workflow?.nodes) ? raw.workflow.nodes : [];
    const campaign = raw.campaign && typeof raw.campaign === "object" ? raw.campaign : {};
    const progress = progressFromItems(nodes, new Set(["success", "cached", "completed", "done"]));
    const nextNode = nodes.find((node) => !["success", "cached", "completed", "done"].includes(cleanText(node?.status || node?.state, 40).toLowerCase()));
    return [{
      source: "creative",
      project: {
        id: `creative:${safeId(raw.id, "campaign")}`,
        name: cleanText(raw.name, 180, "Chiến dịch sáng tạo"),
        area: "creative",
        status: projectStatus(campaign.status),
        progress,
        nextAction: nextNode ? `Tiếp tục bước ${cleanText(nextNode.label || nextNode.type, 120, "sản xuất")}` : "Kiểm duyệt và lên lịch xuất bản",
        context: {
          route: "/creative/ai-center",
          campaignStatus: cleanText(campaign.status, 40, "draft"),
          workflowNodes: nodes.length,
          calendarSlots: Array.isArray(campaign.calendar) ? campaign.calendar.length : 0,
          experiments: Array.isArray(campaign.experiments) ? campaign.experiments.length : 0,
          brandConfigured: Boolean(campaign.brandKit?.voice || campaign.brandKit?.colors?.length)
        },
        updatedAt: cleanText(raw.updatedAt, 40)
      },
      assets: [],
      jobs: nodes.filter((node) => ACTIVE_JOB_STATES.has(cleanText(node?.status || node?.state, 40).toLowerCase())).map((node) => ({
        id: `bridge:creative:${safeId(raw.id, "campaign")}:${safeId(node.id, node.type || "step")}`,
        type: `creative.${safeId(node.type, "step")}`,
        providerId: cleanText(node.providerId, 100),
        state: jobState(node.status || node.state),
        progress: clamp(node.progress, 0, 100, 0),
        input: { step: cleanText(node.label || node.type, 120, "Creative step") }
      }))
    }];
  }

  function summarizeMusic(raw) {
    if (!raw || typeof raw !== "object") return [];
    const project = raw.project && typeof raw.project === "object" ? raw.project : {};
    const stages = Object.entries(raw.automation?.stages || {});
    const completed = new Set(["completed", "success", "done", "cached"]);
    const progress = stages.length ? Math.round(stages.filter(([, stage]) => completed.has(cleanText(stage?.status || stage, 40).toLowerCase())).length / stages.length * 100) : 0;
    const projectId = `music:${safeId(project.name, "relax-session")}`;
    const assets = [];
    if (raw.media?.visualName) assets.push({ id: `${projectId}:visual`, kind: "video", name: cleanText(raw.media.visualName, 180, "Visual"), state: "ready", metadata: { duration: clamp(raw.media.visualDuration, 0, 86400, 0) } });
    if (raw.media?.audioName) assets.push({ id: `${projectId}:audio`, kind: "audio", name: cleanText(raw.media.audioName, 180, "Audio"), state: "ready", metadata: { duration: clamp(raw.media.audioDuration, 0, 86400, 0) } });
    const nextStage = stages.find(([, stage]) => !completed.has(cleanText(stage?.status || stage, 40).toLowerCase()));
    return [{
      source: "music",
      project: {
        id: projectId,
        name: cleanText(project.name, 180, "HH Relax Session"),
        area: "music",
        status: raw.qa?.passed === true ? "completed" : "active",
        progress,
        nextAction: nextStage ? `Tiếp tục ${cleanText(nextStage[0], 100, "pipeline")}` : "Kiểm âm, tạo visualizer và chuẩn bị đăng YouTube",
        context: {
          route: "/music-ai/producer",
          genre: cleanText(project.genre, 40, "relax"),
          targetHours: clamp(project.hours, 1, 8, 1),
          chapters: Array.isArray(raw.chapters) ? raw.chapters.length : 0,
          variants: Array.isArray(raw.automation?.variants) ? raw.automation.variants.length : 0,
          qaPassed: raw.qa?.passed === true
        },
        updatedAt: cleanText(raw.updatedAt, 40)
      },
      assets,
      jobs: stages.filter(([, stage]) => ACTIVE_JOB_STATES.has(cleanText(stage?.status || stage, 40).toLowerCase())).map(([name, stage]) => ({
        id: `bridge:music:${safeId(project.name, "session")}:${safeId(name, "stage")}`,
        type: `music.${safeId(name, "stage")}`,
        providerId: cleanText(stage?.providerId, 100),
        state: jobState(stage?.status || stage),
        progress: clamp(stage?.progress, 0, 100, 0),
        input: { stage: cleanText(name, 100) }
      }))
    }];
  }

  function summarizeMedia(raw) {
    if (!raw || typeof raw !== "object") return [];
    const queues = [raw.proxyJobs, raw.transcriptionJobs, raw.batchJobs, raw.renderQueue].flatMap((value) => Array.isArray(value) ? value : []);
    const projectId = `media:${safeId(raw.projectId, "production")}`;
    const clips = Array.isArray(raw.timeline?.clips) ? raw.timeline.clips : [];
    const assets = clips.slice(0, 100).map((clip, index) => ({
      id: `${projectId}:${safeId(clip.assetId, `clip-${index + 1}`)}`,
      kind: cleanText(clip.kind, 40, "media"),
      name: cleanText(clip.name, 180, `Clip ${index + 1}`),
      state: "draft",
      metadata: { trackId: safeId(clip.trackId, "track"), duration: clamp(Number(clip.sourceOut) - Number(clip.sourceIn), 0, 86400, 0) }
    }));
    const progress = queues.length ? progressFromItems(queues, new Set(["completed", "done", "success"])) : Math.min(90, clips.length * 10);
    const nextJob = queues.find((job) => !["completed", "done", "success"].includes(cleanText(job?.status, 40).toLowerCase()));
    return [{
      source: "media",
      project: {
        id: projectId,
        name: "Media Production",
        area: "media",
        status: queues.some((job) => cleanText(job?.status, 40).toLowerCase() === "failed") ? "blocked" : "active",
        progress,
        nextAction: nextJob ? `Xử lý ${cleanText(nextJob.name || nextJob.kind, 120, "tác vụ media")}` : "Thêm media, dựng timeline hoặc xuất bản render",
        context: {
          route: "/media/video-editor",
          timelineRevision: clamp(raw.timeline?.revision, 0, 100000, 0),
          tracks: Array.isArray(raw.timeline?.tracks) ? raw.timeline.tracks.length : 0,
          clips: clips.length,
          subtitles: Array.isArray(raw.timeline?.subtitles) ? raw.timeline.subtitles.length : 0,
          reviewsOpen: Array.isArray(raw.reviews) ? raw.reviews.filter((item) => item?.status !== "resolved").length : 0,
          queuedJobs: queues.filter((job) => !["completed", "failed", "canceled"].includes(cleanText(job?.status, 40).toLowerCase())).length
        },
        updatedAt: cleanText(raw.updatedAt, 40)
      },
      assets,
      jobs: queues.filter((job) => ACTIVE_JOB_STATES.has(cleanText(job?.status, 40).toLowerCase())).map((job, index) => ({
        id: `bridge:media:${safeId(job.id, `job-${index + 1}`)}`,
        type: `media.${safeId(job.kind, "process")}`,
        state: jobState(job.status),
        progress: clamp(Number(job.progress) * (Number(job.progress) <= 1 ? 100 : 1), 0, 100, 0),
        input: { name: cleanText(job.name, 120, "Media job") }
      }))
    }];
  }

  function summarizeDev(raw) {
    if (!raw || typeof raw !== "object") return [];
    const repository = raw.repository && typeof raw.repository === "object" ? raw.repository : {};
    const checks = Object.values(raw.checks || {});
    const passedChecks = checks.filter((check) => cleanText(check?.status, 40).toLowerCase() === "passed").length;
    const progress = repository.status !== "imported" ? 10 : raw.change?.status !== "drafted" ? 35 : checks.length && passedChecks < checks.length ? Math.round(35 + passedChecks / checks.length * 40) : raw.delivery?.mergeStatus === "merged" ? 100 : 85;
    let nextAction = "Kết nối GitHub bằng quyền tối thiểu";
    if (raw.provider?.connected) nextAction = repository.status === "imported" ? "Chọn issue và tạo bản thay đổi" : "Nhập repository GitHub";
    if (raw.change?.status === "drafted") nextAction = passedChecks < checks.length ? "Chạy đủ kiểm thử và quét bảo mật" : "Yêu cầu con người duyệt trước khi merge";
    return [{
      source: "dev",
      project: {
        id: `dev:${safeId(`${repository.owner || "local"}-${repository.name || "delivery"}`, "delivery")}`,
        name: cleanText(repository.name, 180, "DEV Delivery Workflow"),
        area: "dev",
        status: checks.some((check) => ["failed", "error", "blocked"].includes(cleanText(check?.status, 40).toLowerCase())) ? "blocked" : (raw.delivery?.mergeStatus === "merged" ? "completed" : "active"),
        progress,
        nextAction,
        context: {
          route: "/dev/delivery-workflow",
          repositoryOwner: cleanText(repository.owner, 100),
          repositoryName: cleanText(repository.name, 100),
          branch: cleanText(raw.change?.branch, 160),
          providerStatus: cleanText(raw.provider?.status, 40, "unknown"),
          repositoryStatus: cleanText(repository.status, 40, "idle"),
          changeStatus: cleanText(raw.change?.status, 40, "idle"),
          checksPassed: passedChecks,
          checksTotal: checks.length
        },
        updatedAt: cleanText(raw.updatedAt, 40)
      },
      assets: [],
      jobs: []
    }];
  }

  function summarizeWork(raw) {
    if (!raw || typeof raw !== "object") return [];
    const projects = Array.isArray(raw.projects) ? raw.projects : [];
    const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
    return projects.slice(0, 100).map((project, index) => {
      const projectId = safeId(project.id, `project-${index + 1}`);
      const projectTasks = tasks.filter((task) => safeId(task.projectId || task.project, "") === projectId);
      const openTasks = projectTasks.filter((task) => !["done", "completed"].includes(cleanText(task.status || task.column, 40).toLowerCase()));
      const explicitProgress = Number(project.progress);
      const progress = Number.isFinite(explicitProgress) ? clamp(explicitProgress, 0, 100, 0) : (projectTasks.length ? Math.round((projectTasks.length - openTasks.length) / projectTasks.length * 100) : 0);
      const nextTask = openTasks.sort((a, b) => String(a.due || "9999").localeCompare(String(b.due || "9999")))[0];
      return {
        source: "work",
        project: {
          id: `work:${projectId}`,
          name: cleanText(project.name, 180, `Dự án ${index + 1}`),
          area: "work",
          status: projectStatus(project.status),
          progress,
          dueAt: cleanText(project.due || project.dueAt, 40),
          nextAction: nextTask ? cleanText(nextTask.title, 220, "Tiếp tục công việc") : "Lập kế hoạch bước tiếp theo",
          context: {
            route: "/work/project-center",
            priority: cleanText(project.priority, 40),
            tasksTotal: projectTasks.length,
            tasksOpen: openTasks.length,
            milestones: Array.isArray(raw.milestones) ? raw.milestones.filter((item) => safeId(item.projectId, "") === projectId).length : 0
          },
          updatedAt: cleanText(raw.updatedAt, 40)
        },
        assets: [],
        jobs: []
      };
    });
  }

  const SUMMARIZERS = Object.freeze({ creative: summarizeCreative, music: summarizeMusic, media: summarizeMedia, dev: summarizeDev, work: summarizeWork });

  function collectModuleSnapshots(storage) {
    return Object.entries(SOURCE_KEYS).flatMap(([source, key]) => {
      const raw = readJson(storage, key);
      return raw ? SUMMARIZERS[source](raw) : [];
    });
  }

  function createBridge(options = {}) {
    const runtime = options.runtime;
    const storage = options.storage;
    const eventTarget = options.eventTarget;
    const intervalMs = clamp(options.intervalMs, 3000, 60000, 8000);
    let markers = readJson(storage, MARKER_KEY) || {};
    let timer = null;

    function saveMarkers() {
      try { storage?.setItem?.(MARKER_KEY, JSON.stringify(markers)); } catch (_) { /* Storage may be unavailable. */ }
    }

    function sync() {
      if (!runtime || typeof runtime.upsertProject !== "function") return { ok: false, reason: "runtime-unavailable", changed: 0 };
      const existingProjects = new Set((runtime.listProjects?.() || []).map((item) => item.id));
      const existingJobs = new Set((runtime.listJobs?.({}) || []).map((item) => item.id));
      const snapshots = collectModuleSnapshots(storage);
      let changed = 0;
      const grouped = new Map();
      snapshots.forEach((snapshot) => {
        if (!grouped.has(snapshot.source)) grouped.set(snapshot.source, []);
        grouped.get(snapshot.source).push(snapshot);
      });

      grouped.forEach((items, source) => {
        const summary = items.map((item) => ({ project: item.project, assets: item.assets, jobs: item.jobs }));
        const fingerprint = stableHash({ source, summary });
        const missing = items.some((item) => !existingProjects.has(item.project.id));
        if (markers[source] === fingerprint && !missing) return;
        items.forEach((item) => {
          runtime.upsertProject(item.project);
          item.assets.forEach((asset) => runtime.upsertAsset({ ...asset, projectId: item.project.id }));
          item.jobs.forEach((job) => {
            if (!existingJobs.has(job.id)) {
              runtime.enqueue({ ...job, projectId: item.project.id, area: item.project.area });
              existingJobs.add(job.id);
            }
          });
        });
        const primary = items[0]?.project;
        if (primary && markers[source] !== fingerprint) {
          runtime.recordActivity({
            projectId: primary.id,
            type: "module.synced",
            message: `Đã đồng bộ ${items.length} dự án từ ${source}`,
            metadata: { source, projects: items.length }
          });
        }
        markers[source] = fingerprint;
        changed += items.length;
      });
      if (changed) saveMarkers();
      return { ok: true, changed, projects: snapshots.length };
    }

    function onStorage(event) {
      if (!event?.key || Object.values(SOURCE_KEYS).includes(event.key)) sync();
    }

    function start() {
      sync();
      if (eventTarget?.addEventListener) {
        eventTarget.addEventListener("storage", onStorage);
        eventTarget.addEventListener("hashchange", sync);
        eventTarget.addEventListener("pageshow", sync);
        eventTarget.addEventListener("hh:asset-group-ready", sync);
        MODULE_CHANGE_EVENTS.forEach((eventName) => eventTarget.addEventListener(eventName, sync));
      }
      if (typeof eventTarget?.setInterval === "function") timer = eventTarget.setInterval(sync, intervalMs);
      return api;
    }

    function stop() {
      if (eventTarget?.removeEventListener) {
        eventTarget.removeEventListener("storage", onStorage);
        eventTarget.removeEventListener("hashchange", sync);
        eventTarget.removeEventListener("pageshow", sync);
        eventTarget.removeEventListener("hh:asset-group-ready", sync);
        MODULE_CHANGE_EVENTS.forEach((eventName) => eventTarget.removeEventListener(eventName, sync));
      }
      if (timer && typeof eventTarget?.clearInterval === "function") eventTarget.clearInterval(timer);
      timer = null;
    }

    const api = { version: VERSION, sync, start, stop, collect: () => collectModuleSnapshots(storage) };
    return start();
  }

  return {
    VERSION, MARKER_KEY, SOURCE_KEYS, MODULE_CHANGE_EVENTS, cleanText, safeId, stableHash,
    summarizeCreative, summarizeMusic, summarizeMedia, summarizeDev, summarizeWork,
    collectModuleSnapshots, createBridge
  };
});
