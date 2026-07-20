(function (globalScope) {
  "use strict";

  const STORAGE_KEY = "hh.creative-ai-workflow.v1";
  const FORMAT = "hh-creative-ai-workflow";
  const VERSION = 1;
  const MAX_NODES = 40;
  const MAX_EDGES = 100;
  const MAX_LOGS = 160;
  const MAX_CACHE = 100;
  const MAX_VARIANTS = 40;
  const MAX_TEXT = 12000;
  const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
  const VIEWS = Object.freeze(["workflow", "ai-director", "prompt-studio"]);
  const NODE_TYPES = Object.freeze(["Brief", "Prompt", "Script", "Image", "Voice", "Video", "Subtitle", "Review", "Publish"]);
  const AI_CAPABLE = new Set(["Prompt", "Script", "Image", "Voice", "Video", "Subtitle"]);
  const NODE_META = Object.freeze({
    Brief: { icon: "BR", title: "Brief", note: "Mục tiêu và đối tượng", color: "#67e8f9" },
    Prompt: { icon: "PR", title: "Prompt", note: "Chỉ dẫn sáng tạo", color: "#c084fc" },
    Script: { icon: "SC", title: "Script", note: "Kịch bản và nhịp", color: "#fb7185" },
    Image: { icon: "IM", title: "Image", note: "Kế hoạch hình ảnh", color: "#fbbf24" },
    Voice: { icon: "VO", title: "Voice", note: "Giọng đọc và nhịp", color: "#34d399" },
    Video: { icon: "VI", title: "Video", note: "Shot và chuyển động", color: "#60a5fa" },
    Subtitle: { icon: "SU", title: "Subtitle", note: "Phụ đề và ngôn ngữ", color: "#2dd4bf" },
    Review: { icon: "RV", title: "Review", note: "Kiểm tra trước duyệt", color: "#f472b6" },
    Publish: { icon: "PB", title: "Publish", note: "Gate xuất bản thủ công", color: "#a3e635" }
  });
  const mounted = new WeakMap();

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix || "item"}-${Date.now().toString(36)}-${random}`;
  }

  function safeText(value, fallback, maxLength) {
    return String(value == null ? (fallback || "") : value)
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength || 240);
  }

  function safeLongText(value, fallback, maxLength) {
    return String(value == null ? (fallback || "") : value)
      .replace(/\u0000/g, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .slice(0, maxLength || MAX_TEXT);
  }

  function safeId(value, fallback) {
    const id = String(value == null ? "" : value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72);
    return id || fallback || uid("item");
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === "object") {
      return Object.keys(value).sort().reduce((result, key) => {
        if (typeof value[key] !== "function" && value[key] !== undefined) result[key] = stableValue(value[key]);
        return result;
      }, {});
    }
    return value;
  }

  function boundedValue(value, depth, seen) {
    const level = Number(depth) || 0;
    const visited = seen || new WeakSet();
    if (value == null || typeof value === "boolean") return value;
    if (typeof value === "string") return safeLongText(value, "", 20000);
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "bigint") return value.toString();
    if (typeof value !== "object") return undefined;
    if (level >= 6) return "[depth-limit]";
    if (visited.has(value)) return "[circular]";
    visited.add(value);
    if (Array.isArray(value)) return value.slice(0, 50).map((item) => boundedValue(item, level + 1, visited));
    return Object.keys(value).slice(0, 50).reduce((result, key) => {
      const cleanKey = safeText(key, "field", 80);
      if (/password|secret|api[-_]?key|access[-_]?token|refresh[-_]?token/i.test(cleanKey)) result[cleanKey] = "[redacted]";
      else {
        const clean = boundedValue(value[key], level + 1, visited);
        if (clean !== undefined) result[cleanKey] = clean;
      }
      return result;
    }, {});
  }

  function stableStringify(value) {
    return JSON.stringify(stableValue(value));
  }

  function deterministicHash(value) {
    const text = stableStringify(value);
    let first = 2166136261;
    let second = 2246822507;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      first ^= code;
      first = Math.imul(first, 16777619);
      second ^= code + index;
      second = Math.imul(second, 3266489909);
    }
    return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
  }

  function defaultNode(type, index) {
    const meta = NODE_META[type];
    return {
      id: type.toLowerCase(),
      type,
      name: meta.title,
      enabled: true,
      status: "idle",
      order: index,
      config: { useAI: AI_CAPABLE.has(type), temperature: 0.6, notes: "" },
      output: null,
      error: "",
      cacheKey: "",
      updatedAt: ""
    };
  }

  function createPreset(presetId) {
    const preset = [
      ["Brief", "Prompt"], ["Prompt", "Script"], ["Script", "Image"], ["Script", "Voice"],
      ["Image", "Video"], ["Voice", "Video"], ["Script", "Subtitle"], ["Video", "Review"],
      ["Subtitle", "Review"], ["Review", "Publish"]
    ];
    const short = [["Brief", "Prompt"], ["Prompt", "Script"], ["Script", "Video"], ["Video", "Subtitle"], ["Subtitle", "Review"], ["Review", "Publish"]];
    const audio = [["Brief", "Prompt"], ["Prompt", "Script"], ["Script", "Voice"], ["Voice", "Subtitle"], ["Subtitle", "Review"], ["Review", "Publish"]];
    const selected = presetId === "short-video" ? short : presetId === "audio" ? audio : preset;
    const usedTypes = new Set(selected.flat());
    const nodes = NODE_TYPES.filter((type) => usedTypes.has(type)).map(defaultNode);
    return {
      preset: ["full-production", "short-video", "audio"].includes(presetId) ? presetId : "full-production",
      nodes,
      edges: selected.map(([fromType, toType], index) => ({ id: `edge-${index + 1}`, from: fromType.toLowerCase(), to: toType.toLowerCase() })),
      approvals: { publish: { approved: false, by: "", at: "" } },
      cache: {},
      logs: []
    };
  }

  function createDefaultProject() {
    return {
      format: FORMAT,
      version: VERSION,
      id: uid("creative-project"),
      name: "Creative production",
      updatedAt: nowIso(),
      activeView: "workflow",
      brief: {
        product: "", audience: "", goal: "", platform: "YouTube", brand: "", tone: "Chuyên nghiệp", cta: ""
      },
      workflow: createPreset("full-production"),
      director: { goal: "", source: "local", proposedAt: "", summary: "", steps: [] },
      promptStudio: {
        draft: { text: "", negative: "", seed: 42, camera: "Medium shot", lighting: "Soft studio", style: "Cinematic", firstFrame: null, lastFrame: null, references: [] },
        variants: [], selected: []
      }
    };
  }

  function normalizeFileMeta(raw) {
    if (!raw || typeof raw !== "object") return null;
    return {
      id: safeId(raw.id, uid("asset")),
      name: safeText(raw.name, "asset", 140),
      type: safeText(raw.type, "application/octet-stream", 90),
      size: Math.round(clamp(raw.size, 0, 500 * 1024 * 1024, 0)),
      lastModified: Math.round(clamp(raw.lastModified, 0, Number.MAX_SAFE_INTEGER, 0)),
      width: Math.round(clamp(raw.width, 0, 16384, 0)),
      height: Math.round(clamp(raw.height, 0, 16384, 0))
    };
  }

  function normalizeNode(raw, index) {
    const type = NODE_TYPES.includes(raw && raw.type) ? raw.type : NODE_TYPES[index % NODE_TYPES.length];
    const fallback = defaultNode(type, index);
    return {
      id: safeId(raw && raw.id, `${type.toLowerCase()}-${index + 1}`),
      type,
      name: safeText(raw && raw.name, fallback.name, 80),
      enabled: !(raw && raw.enabled === false),
      status: ["idle", "queued", "running", "success", "cached", "failed", "blocked", "waiting-approval"].includes(raw && raw.status) ? raw.status : "idle",
      order: Math.round(clamp(raw && raw.order, 0, MAX_NODES - 1, index)),
      config: {
        useAI: raw && raw.config && typeof raw.config.useAI === "boolean" ? raw.config.useAI : fallback.config.useAI,
        temperature: clamp(raw && raw.config && raw.config.temperature, 0, 2, 0.6),
        notes: safeLongText(raw && raw.config && raw.config.notes, "", 2000)
      },
      output: raw && raw.output != null ? boundedValue(raw.output) : null,
      error: safeText(raw && raw.error, "", 500),
      cacheKey: safeText(raw && raw.cacheKey, "", 80),
      updatedAt: safeText(raw && raw.updatedAt, "", 40)
    };
  }

  function hasPath(edges, startId, targetId) {
    const queue = [startId];
    const visited = new Set();
    while (queue.length) {
      const current = queue.shift();
      if (current === targetId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      edges.forEach((edge) => {
        if (edge.from === current && !visited.has(edge.to)) queue.push(edge.to);
      });
    }
    return false;
  }

  function normalizeWorkflow(raw) {
    const fallback = createPreset("full-production");
    const input = raw && typeof raw === "object" ? raw : fallback;
    const nodes = (Array.isArray(input.nodes) ? input.nodes : fallback.nodes).slice(0, MAX_NODES).map(normalizeNode);
    const ids = new Set();
    nodes.forEach((node, index) => {
      if (ids.has(node.id)) node.id = safeId(`${node.id}-${index + 1}`, `node-${index + 1}`);
      ids.add(node.id);
    });
    nodes.sort((a, b) => a.order - b.order).forEach((node, index) => { node.order = index; });
    const edges = [];
    (Array.isArray(input.edges) ? input.edges : fallback.edges).slice(0, MAX_EDGES).forEach((rawEdge, index) => {
      const from = safeId(rawEdge && rawEdge.from, "");
      const to = safeId(rawEdge && rawEdge.to, "");
      if (!ids.has(from) || !ids.has(to) || from === to) return;
      if (edges.some((edge) => edge.from === from && edge.to === to) || hasPath(edges, to, from)) return;
      edges.push({ id: safeId(rawEdge && rawEdge.id, `edge-${index + 1}`), from, to });
    });
    const cacheEntries = input.cache && typeof input.cache === "object" ? Object.entries(input.cache).slice(-MAX_CACHE) : [];
    return {
      preset: ["full-production", "short-video", "audio", "custom"].includes(input.preset) ? input.preset : "custom",
      nodes,
      edges,
      approvals: {
        publish: {
          approved: Boolean(input.approvals && input.approvals.publish && input.approvals.publish.approved),
          by: safeText(input.approvals && input.approvals.publish && input.approvals.publish.by, "", 100),
          at: safeText(input.approvals && input.approvals.publish && input.approvals.publish.at, "", 40)
        }
      },
      cache: Object.fromEntries(cacheEntries.map(([key, value]) => [safeText(key, "", 80), boundedValue(value)]).filter(([key]) => key)),
      logs: (Array.isArray(input.logs) ? input.logs : []).slice(-MAX_LOGS).map((entry) => ({
        id: safeId(entry && entry.id, uid("log")),
        nodeId: safeId(entry && entry.nodeId, "system"),
        level: ["info", "success", "warning", "error"].includes(entry && entry.level) ? entry.level : "info",
        message: safeText(entry && entry.message, "Log", 400),
        at: safeText(entry && entry.at, nowIso(), 40)
      }))
    };
  }

  function normalizeVariant(raw, index) {
    const prompt = safeLongText(raw && raw.prompt, "", MAX_TEXT);
    const seed = Math.round(clamp(raw && raw.seed, 0, 2147483647, 42));
    const fingerprint = safeText(raw && raw.fingerprint, deterministicHash({ prompt, seed, settings: raw && raw.settings }), 80);
    return {
      id: safeId(raw && raw.id, `variant-${index + 1}-${fingerprint.slice(0, 6)}`),
      parentId: raw && raw.parentId ? safeId(raw.parentId, "") : "",
      rootId: raw && raw.rootId ? safeId(raw.rootId, "") : "",
      reproducedFrom: raw && raw.reproducedFrom ? safeId(raw.reproducedFrom, "") : "",
      generation: Math.round(clamp(raw && raw.generation, 0, 100, 0)),
      prompt,
      negative: safeLongText(raw && raw.negative, "", 4000),
      seed,
      settings: {
        camera: safeText(raw && raw.settings && raw.settings.camera, "Medium shot", 100),
        lighting: safeText(raw && raw.settings && raw.settings.lighting, "Soft studio", 100),
        style: safeText(raw && raw.settings && raw.settings.style, "Cinematic", 100)
      },
      assets: (Array.isArray(raw && raw.assets) ? raw.assets : []).map(normalizeFileMeta).filter(Boolean).slice(0, 12),
      output: raw && raw.output != null ? boundedValue(raw.output) : null,
      source: raw && raw.source === "external-ai" ? "external-ai" : "local-spec",
      fingerprint,
      createdAt: safeText(raw && raw.createdAt, nowIso(), 40)
    };
  }

  function normalizeProject(raw) {
    const fallback = createDefaultProject();
    const input = raw && typeof raw === "object" ? raw : fallback;
    const variants = (Array.isArray(input.promptStudio && input.promptStudio.variants) ? input.promptStudio.variants : []).slice(-MAX_VARIANTS).map(normalizeVariant);
    const variantIds = new Set(variants.map((variant) => variant.id));
    const draft = input.promptStudio && input.promptStudio.draft && typeof input.promptStudio.draft === "object" ? input.promptStudio.draft : fallback.promptStudio.draft;
    return {
      format: FORMAT,
      version: VERSION,
      id: safeId(input.id, fallback.id),
      name: safeText(input.name, fallback.name, 120),
      updatedAt: safeText(input.updatedAt, nowIso(), 40),
      activeView: VIEWS.includes(input.activeView) ? input.activeView : "workflow",
      brief: {
        product: safeText(input.brief && input.brief.product, "", 240),
        audience: safeText(input.brief && input.brief.audience, "", 500),
        goal: safeText(input.brief && input.brief.goal, "", 500),
        platform: safeText(input.brief && input.brief.platform, "YouTube", 80),
        brand: safeText(input.brief && input.brief.brand, "", 120),
        tone: safeText(input.brief && input.brief.tone, "Chuyên nghiệp", 120),
        cta: safeText(input.brief && input.brief.cta, "", 240)
      },
      workflow: normalizeWorkflow(input.workflow),
      director: {
        goal: safeLongText(input.director && input.director.goal, "", 4000),
        source: input.director && input.director.source === "external-ai" ? "external-ai" : "local",
        proposedAt: safeText(input.director && input.director.proposedAt, "", 40),
        summary: safeLongText(input.director && input.director.summary, "", 4000),
        steps: (Array.isArray(input.director && input.director.steps) ? input.director.steps : []).slice(0, 20).map((step, index) => ({
          id: safeId(step && step.id, `director-${index + 1}`),
          type: NODE_TYPES.includes(step && step.type) ? step.type : "Prompt",
          title: safeText(step && step.title, `Bước ${index + 1}`, 120),
          instruction: safeLongText(step && step.instruction, "", 2000),
          approved: Boolean(step && step.approved),
          applied: Boolean(step && step.applied)
        }))
      },
      promptStudio: {
        draft: {
          text: safeLongText(draft.text, "", MAX_TEXT),
          negative: safeLongText(draft.negative, "", 4000),
          seed: Math.round(clamp(draft.seed, 0, 2147483647, 42)),
          camera: safeText(draft.camera, "Medium shot", 100),
          lighting: safeText(draft.lighting, "Soft studio", 100),
          style: safeText(draft.style, "Cinematic", 100),
          firstFrame: normalizeFileMeta(draft.firstFrame),
          lastFrame: normalizeFileMeta(draft.lastFrame),
          references: (Array.isArray(draft.references) ? draft.references : []).map(normalizeFileMeta).filter(Boolean).slice(0, 10)
        },
        variants,
        selected: (Array.isArray(input.promptStudio && input.promptStudio.selected) ? input.promptStudio.selected : []).map((id) => safeId(id, "")).filter((id, index, list) => variantIds.has(id) && list.indexOf(id) === index).slice(0, 3)
      }
    };
  }

  function addLog(project, nodeId, level, message) {
    project.workflow.logs.push({ id: uid("log"), nodeId: safeId(nodeId, "system"), level, message: safeText(message, "", 400), at: nowIso() });
    project.workflow.logs = project.workflow.logs.slice(-MAX_LOGS);
  }

  function topologicalSort(workflowOrProject) {
    const workflow = normalizeWorkflow(workflowOrProject && workflowOrProject.workflow ? workflowOrProject.workflow : workflowOrProject);
    const indegree = new Map(workflow.nodes.map((node) => [node.id, 0]));
    workflow.edges.forEach((edge) => indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1));
    const queue = workflow.nodes.filter((node) => indegree.get(node.id) === 0).sort((a, b) => a.order - b.order).map((node) => node.id);
    const result = [];
    while (queue.length) {
      const current = queue.shift();
      result.push(current);
      workflow.edges.filter((edge) => edge.from === current).forEach((edge) => {
        indegree.set(edge.to, indegree.get(edge.to) - 1);
        if (indegree.get(edge.to) === 0) queue.push(edge.to);
      });
    }
    if (result.length !== workflow.nodes.length) throw new Error("Workflow chứa chu trình không hợp lệ.");
    return result;
  }

  function connectNodes(projectInput, fromId, toId) {
    const project = normalizeProject(projectInput);
    const from = safeId(fromId, "");
    const to = safeId(toId, "");
    const ids = new Set(project.workflow.nodes.map((node) => node.id));
    if (!ids.has(from) || !ids.has(to)) throw new RangeError("Hai node phải tồn tại.");
    if (from === to || hasPath(project.workflow.edges, to, from)) throw new RangeError("Kết nối này tạo chu trình.");
    if (!project.workflow.edges.some((edge) => edge.from === from && edge.to === to)) {
      project.workflow.edges.push({ id: uid("edge"), from, to });
      project.workflow.preset = "custom";
      project.workflow.approvals.publish = { approved: false, by: "", at: "" };
      addLog(project, to, "info", `Đã nối ${from} → ${to}. Gate Publish cần duyệt lại.`);
    }
    project.updatedAt = nowIso();
    return project;
  }

  function disconnectNodes(projectInput, edgeId) {
    const project = normalizeProject(projectInput);
    const id = safeId(edgeId, "");
    project.workflow.edges = project.workflow.edges.filter((edge) => edge.id !== id);
    project.workflow.preset = "custom";
    project.workflow.approvals.publish = { approved: false, by: "", at: "" };
    project.updatedAt = nowIso();
    return project;
  }

  function approvePublish(projectInput, reviewer) {
    const project = normalizeProject(projectInput);
    const reviewNodes = project.workflow.nodes.filter((node) => node.type === "Review" && node.enabled);
    if (reviewNodes.some((node) => !["success", "cached"].includes(node.status))) throw new Error("Cần hoàn tất node Review trước khi duyệt Publish.");
    project.workflow.approvals.publish = { approved: true, by: safeText(reviewer, "Người duyệt", 100), at: nowIso() };
    addLog(project, "publish", "success", `Gate Publish đã được ${project.workflow.approvals.publish.by} duyệt thủ công.`);
    project.updatedAt = nowIso();
    return project;
  }

  function revokePublishApproval(projectInput, reason) {
    const project = normalizeProject(projectInput);
    project.workflow.approvals.publish = { approved: false, by: "", at: "" };
    addLog(project, "publish", "warning", reason || "Gate Publish cần được duyệt lại.");
    return project;
  }

  function upstreamFor(project, nodeId) {
    const nodesById = new Map(project.workflow.nodes.map((node) => [node.id, node]));
    return project.workflow.edges.filter((edge) => edge.to === nodeId).map((edge) => nodesById.get(edge.from)).filter(Boolean);
  }

  function localNodeOutput(project, node, upstream) {
    const brief = project.brief;
    const context = upstream.map((item) => item.output).filter(Boolean);
    const base = {
      mode: "local-plan",
      notice: "Kế hoạch được tạo cục bộ, chưa gọi dịch vụ AI bên ngoài.",
      node: node.type,
      contextHash: deterministicHash(context),
      generatedAt: nowIso()
    };
    if (node.type === "Brief") return { ...base, brief: clone(brief), readiness: [brief.product, brief.audience, brief.goal].filter(Boolean).length };
    if (node.type === "Prompt") return { ...base, prompt: `${brief.goal || "Tạo nội dung"} cho ${brief.audience || "đối tượng mục tiêu"}; nền tảng ${brief.platform}; tone ${brief.tone}; thương hiệu ${brief.brand || "chưa đặt"}; CTA ${brief.cta || "chưa đặt"}.` };
    if (node.type === "Script") return { ...base, outline: ["Hook", "Bối cảnh", "Giá trị chính", "Cao trào", "CTA"], durationHint: brief.platform === "TikTok" ? "30-60 giây" : "6-10 phút" };
    if (node.type === "Image") return { ...base, deliverable: "image-spec", shots: ["Key visual", "Thumbnail", "Cutaway"], action: "Kết nối runAI hoặc tạo asset thủ công." };
    if (node.type === "Voice") return { ...base, deliverable: "voice-spec", tone: brief.tone, pace: "medium", action: "Kết nối runAI hoặc thu âm thủ công." };
    if (node.type === "Video") return { ...base, deliverable: "video-spec", format: brief.platform, tracks: ["Video", "Voice", "Music", "Caption"], action: "Mở Video Editor để dựng từ spec." };
    if (node.type === "Subtitle") return { ...base, deliverable: "subtitle-spec", languages: ["vi"], format: "SRT", action: "Cần transcript thật để tạo timecode chính xác." };
    if (node.type === "Review") return { ...base, checklist: ["Thông điệp", "Brand voice", "Bản quyền", "Âm lượng", "Phụ đề", "Metadata"], passed: true };
    return { ...base, readinessPackage: { platform: brief.platform, metadataReady: Boolean(brief.product && brief.goal), autoPublished: false }, notice: "Gói xuất bản đã sẵn sàng. Hệ thống không tự đăng nội dung." };
  }

  async function runWorkflowNode(projectInput, nodeId, options) {
    const project = normalizeProject(projectInput);
    const settings = options && typeof options === "object" ? options : {};
    const node = project.workflow.nodes.find((item) => item.id === safeId(nodeId, ""));
    if (!node) throw new RangeError("Không tìm thấy node.");
    if (!node.enabled) {
      node.status = "blocked";
      node.error = "Node đang tắt.";
      addLog(project, node.id, "warning", node.error);
      return project;
    }
    const upstream = upstreamFor(project, node.id);
    const unavailable = upstream.filter((item) => !["success", "cached"].includes(item.status));
    if (unavailable.length) {
      node.status = "blocked";
      node.error = `Đang chờ: ${unavailable.map((item) => item.name).join(", ")}`;
      addLog(project, node.id, "warning", node.error);
      return project;
    }
    if (node.type === "Publish" && !project.workflow.approvals.publish.approved) {
      node.status = "waiting-approval";
      node.error = "Cần người dùng phê duyệt thủ công trước Publish.";
      addLog(project, node.id, "warning", node.error);
      return project;
    }
    const payload = {
      projectId: project.id,
      node: { id: node.id, type: node.type, config: clone(node.config) },
      brief: clone(project.brief),
      upstream: upstream.map((item) => ({ id: item.id, type: item.type, output: item.output }))
    };
    const cacheKey = deterministicHash(payload);
    if (!settings.ignoreCache && Object.prototype.hasOwnProperty.call(project.workflow.cache, cacheKey)) {
      node.output = clone(project.workflow.cache[cacheKey]);
      node.status = "cached";
      node.cacheKey = cacheKey;
      node.error = "";
      node.updatedAt = nowIso();
      addLog(project, node.id, "success", "Đã dùng kết quả cache theo hash đầu vào.");
      return project;
    }
    node.status = "running";
    node.error = "";
    addLog(project, node.id, "info", `Đang chạy ${node.name}.`);
    try {
      let output;
      if (typeof settings.runAI === "function" && AI_CAPABLE.has(node.type) && node.config.useAI) {
        const response = await settings.runAI(clone(payload));
        if (response == null) throw new Error("runAI không trả về kết quả.");
        output = { mode: "external-ai", node: node.type, result: boundedValue(response), generatedAt: nowIso() };
      } else {
        output = localNodeOutput(project, node, upstream);
      }
      node.output = output;
      node.status = "success";
      node.cacheKey = cacheKey;
      node.updatedAt = nowIso();
      project.workflow.cache[cacheKey] = clone(output);
      const cacheKeys = Object.keys(project.workflow.cache);
      while (cacheKeys.length > MAX_CACHE) delete project.workflow.cache[cacheKeys.shift()];
      if (node.type !== "Publish") project.workflow.approvals.publish = { approved: false, by: "", at: "" };
      addLog(project, node.id, "success", output.mode === "external-ai" ? "runAI đã trả kết quả; cần người dùng kiểm tra." : "Đã tạo kế hoạch cục bộ; chưa gọi AI bên ngoài.");
    } catch (error) {
      node.status = "failed";
      node.error = safeText(error && error.message, "Không thể chạy node.", 500);
      node.updatedAt = nowIso();
      addLog(project, node.id, "error", node.error);
    }
    project.updatedAt = nowIso();
    return normalizeProject(project);
  }

  async function runWorkflow(projectInput, options) {
    let project = normalizeProject(projectInput);
    const order = topologicalSort(project.workflow);
    for (const nodeId of order) {
      project = await runWorkflowNode(project, nodeId, options);
      const current = project.workflow.nodes.find((node) => node.id === nodeId);
      if (current && current.status === "failed" && options && options.stopOnError) break;
    }
    return project;
  }

  async function retryFailed(projectInput, options) {
    let project = normalizeProject(projectInput);
    const failedIds = new Set(project.workflow.nodes.filter((node) => ["failed", "blocked"].includes(node.status)).map((node) => node.id));
    project.workflow.nodes.forEach((node) => {
      if (failedIds.has(node.id)) { node.status = "idle"; node.error = ""; }
    });
    const order = topologicalSort(project.workflow).filter((id) => failedIds.has(id));
    for (const nodeId of order) project = await runWorkflowNode(project, nodeId, { ...(options || {}), ignoreCache: true });
    return project;
  }

  function directorStepsFor(goal) {
    const text = safeLongText(goal, "", 4000);
    const lower = text.toLowerCase();
    const types = ["Brief", "Prompt", "Script"];
    if (/ảnh|image|thumbnail|poster/.test(lower)) types.push("Image");
    if (/voice|giọng|podcast|audio|nhạc/.test(lower)) types.push("Voice");
    if (/video|youtube|tiktok|short/.test(lower)) types.push("Video", "Subtitle");
    types.push("Review", "Publish");
    return [...new Set(types)].map((type, index) => ({
      id: `director-${type.toLowerCase()}-${index + 1}`,
      type,
      title: NODE_META[type].title,
      instruction: `${NODE_META[type].note}. Mục tiêu: ${text || "Chưa nhập mục tiêu"}`,
      approved: false,
      applied: false
    }));
  }

  async function proposeDirectorPlan(goal, options) {
    const cleanGoal = safeLongText(goal, "", 4000);
    const localSteps = directorStepsFor(cleanGoal);
    const result = { goal: cleanGoal, source: "local", proposedAt: nowIso(), summary: "Pipeline được đề xuất cục bộ và chưa áp dụng. Hãy duyệt từng bước.", steps: localSteps };
    if (options && typeof options.runAI === "function") {
      try {
        const response = await options.runAI({ task: "creative-director-plan", goal: cleanGoal, allowedNodeTypes: NODE_TYPES.slice(), requirement: "Return suggestions only; never publish or overwrite." });
        result.source = "external-ai";
        result.summary = safeLongText(typeof response === "string" ? response : response && response.summary, "runAI đã đề xuất pipeline. Hãy duyệt từng bước.", 4000);
      } catch (error) {
        result.summary = `runAI không khả dụng: ${safeText(error && error.message, "lỗi không xác định", 300)}. Đang dùng pipeline cục bộ.`;
      }
    }
    return result;
  }

  function setDirectorStepApproval(projectInput, stepId, approved) {
    const project = normalizeProject(projectInput);
    const step = project.director.steps.find((item) => item.id === safeId(stepId, ""));
    if (!step) throw new RangeError("Không tìm thấy bước Director.");
    step.approved = Boolean(approved);
    if (!step.approved) step.applied = false;
    project.updatedAt = nowIso();
    return project;
  }

  function applyDirectorPlan(projectInput) {
    const project = normalizeProject(projectInput);
    const approved = project.director.steps.filter((step) => step.approved);
    if (!approved.length) throw new Error("Hãy duyệt ít nhất một bước trước khi áp dụng.");
    const selectedTypes = approved.map((step) => step.type);
    const nodes = selectedTypes.map(defaultNode);
    const edges = nodes.slice(1).map((node, index) => ({ id: `director-edge-${index + 1}`, from: nodes[index].id, to: node.id }));
    project.workflow = normalizeWorkflow({ preset: "custom", nodes, edges, approvals: { publish: { approved: false } }, cache: {}, logs: [] });
    project.director.steps.forEach((step) => { step.applied = step.approved; });
    project.activeView = "workflow";
    addLog(project, "system", "success", "Đã áp dụng các bước được duyệt; Publish vẫn cần gate thủ công.");
    project.updatedAt = nowIso();
    return project;
  }

  function buildPromptPayload(draftInput) {
    const draft = normalizeProject({ promptStudio: { draft: draftInput } }).promptStudio.draft;
    return {
      text: draft.text,
      negative: draft.negative,
      seed: draft.seed,
      camera: draft.camera,
      lighting: draft.lighting,
      style: draft.style,
      assets: [draft.firstFrame, draft.lastFrame, ...draft.references].filter(Boolean)
    };
  }

  function createPromptVariant(draftInput, options) {
    const payload = buildPromptPayload(draftInput);
    const parent = options && options.parent ? normalizeVariant(options.parent, 0) : null;
    const fingerprint = deterministicHash(payload);
    const id = uid(`variant-${fingerprint.slice(0, 6)}`);
    return normalizeVariant({
      id,
      parentId: parent ? parent.id : "",
      rootId: parent ? (parent.rootId || parent.id) : id,
      reproducedFrom: options && options.reproducedFrom ? options.reproducedFrom : "",
      generation: parent ? parent.generation + 1 : 0,
      prompt: payload.text,
      negative: payload.negative,
      seed: payload.seed,
      settings: { camera: payload.camera, lighting: payload.lighting, style: payload.style },
      assets: payload.assets,
      output: options && options.output != null ? options.output : { notice: "Biến thể prompt cục bộ; chưa tạo media bên ngoài." },
      source: options && options.source === "external-ai" ? "external-ai" : "local-spec",
      fingerprint,
      createdAt: nowIso()
    }, 0);
  }

  function addPromptVariant(projectInput, variantInput) {
    const project = normalizeProject(projectInput);
    const variant = normalizeVariant(variantInput, project.promptStudio.variants.length);
    while (project.promptStudio.variants.some((item) => item.id === variant.id)) variant.id = uid(`variant-${variant.fingerprint.slice(0, 6)}`);
    if (!variant.rootId) variant.rootId = variant.id;
    project.promptStudio.variants.push(variant);
    project.promptStudio.variants = project.promptStudio.variants.slice(-MAX_VARIANTS);
    project.promptStudio.selected = [variant.id, ...project.promptStudio.selected.filter((id) => id !== variant.id)].slice(0, 3);
    project.updatedAt = nowIso();
    return project;
  }

  function reproduceVariant(projectInput, variantId) {
    let project = normalizeProject(projectInput);
    const source = project.promptStudio.variants.find((variant) => variant.id === safeId(variantId, ""));
    if (!source) throw new RangeError("Không tìm thấy biến thể.");
    const draft = { text: source.prompt, negative: source.negative, seed: source.seed, camera: source.settings.camera, lighting: source.settings.lighting, style: source.settings.style, references: source.assets };
    const variant = createPromptVariant(draft, { parent: source, reproducedFrom: source.id, output: clone(source.output), source: source.source });
    project = addPromptVariant(project, variant);
    return project;
  }

  function getVariantLineage(projectInput, variantId) {
    const project = normalizeProject(projectInput);
    const byId = new Map(project.promptStudio.variants.map((variant) => [variant.id, variant]));
    const lineage = [];
    let current = byId.get(safeId(variantId, ""));
    const visited = new Set();
    while (current && !visited.has(current.id)) {
      lineage.unshift(clone(current));
      visited.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : null;
    }
    return lineage;
  }

  function compareVariants(projectInput, variantIds) {
    const project = normalizeProject(projectInput);
    const ids = (variantIds || project.promptStudio.selected).slice(0, 3);
    return ids.map((id) => project.promptStudio.variants.find((variant) => variant.id === id)).filter(Boolean).map((variant) => ({
      id: variant.id,
      generation: variant.generation,
      fingerprint: variant.fingerprint,
      source: variant.source,
      seed: variant.seed,
      promptLength: variant.prompt.length,
      settings: clone(variant.settings),
      assetCount: variant.assets.length
    }));
  }

  function exportProject(projectInput) {
    return JSON.stringify(normalizeProject(projectInput), null, 2);
  }

  function importProject(source) {
    const text = typeof source === "string" ? source : JSON.stringify(source);
    if (text.length > MAX_IMPORT_BYTES) throw new RangeError("Project vượt giới hạn 2 MB.");
    const parsed = typeof source === "string" ? JSON.parse(source) : source;
    if (!parsed || parsed.format !== FORMAT || Number(parsed.version) !== VERSION) throw new Error("Không đúng định dạng Creative AI Workflow.");
    return normalizeProject(parsed);
  }

  function readLocal() {
    try {
      if (!globalScope.localStorage) return null;
      const raw = globalScope.localStorage.getItem(STORAGE_KEY);
      return raw ? importProject(raw) : null;
    } catch {
      return null;
    }
  }

  function writeLocal(project) {
    try {
      if (!globalScope.localStorage) return false;
      globalScope.localStorage.setItem(STORAGE_KEY, exportProject(project));
      return true;
    } catch {
      return false;
    }
  }

  function createStoreAdapter(store) {
    const key = "creativeAIWorkflow";
    return {
      read() {
        try {
          if (store && typeof store.getProject === "function") return store.getProject(key) || readLocal();
          if (store && typeof store.get === "function") return store.get(key) || readLocal();
          if (store && typeof store.getState === "function") {
            const state = store.getState();
            return state && (state[key] || state.aiWorkflow) || readLocal();
          }
          if (store && store.state) return store.state[key] || store.state.aiWorkflow || readLocal();
        } catch { /* fall through to local storage */ }
        return readLocal();
      },
      write(project) {
        const normalized = normalizeProject(project);
        let shared = false;
        try {
          if (store && typeof store.updateProject === "function") { store.updateProject(key, clone(normalized)); shared = true; }
          else if (store && typeof store.set === "function") { store.set(key, clone(normalized)); shared = true; }
          else if (store && typeof store.setState === "function") {
            const current = typeof store.getState === "function" ? store.getState() || {} : {};
            store.setState({ ...current, [key]: clone(normalized) });
            shared = true;
          } else if (store && store.state && typeof store.state === "object") {
            store.state[key] = clone(normalized);
            shared = true;
          }
        } catch { shared = false; }
        writeLocal(normalized);
        return { shared, local: true };
      }
    };
  }

  function fileMeta(file, id) {
    return normalizeFileMeta({ id: id || uid("asset"), name: file && file.name, type: file && file.type, size: file && file.size, lastModified: file && file.lastModified });
  }

  function download(name, content, type) {
    if (!globalScope.document || !globalScope.URL || !globalScope.Blob) return false;
    const url = globalScope.URL.createObjectURL(new globalScope.Blob([content], { type: type || "application/json;charset=utf-8" }));
    const anchor = globalScope.document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    globalScope.setTimeout(() => globalScope.URL.revokeObjectURL(url), 500);
    return true;
  }

  function statusLabel(status) {
    return ({ idle: "Sẵn sàng", queued: "Trong hàng", running: "Đang chạy", success: "Hoàn tất", cached: "Từ cache", failed: "Lỗi", blocked: "Đang chờ", "waiting-approval": "Chờ duyệt" })[status] || status;
  }

  function shellMarkup(view, hasAI) {
    return `<section class="hhcaw" data-hhcaw-view="${view}">
      <header class="hhcaw-hero">
        <div><span class="hhcaw-kicker">CREATIVE OS · AI WORKFLOW</span><h2>Điều phối sáng tạo <em>có kiểm soát</em></h2><p>Graph sản xuất, AI Director và prompt đa phương thức trong cùng một project.</p></div>
        <div class="hhcaw-health"><i></i><strong>${hasAI ? "runAI đã kết nối" : "Local planner"}</strong><small>${hasAI ? "Mọi kết quả vẫn cần duyệt" : "Không gọi AI bên ngoài"}</small></div>
      </header>
      <nav class="hhcaw-tabs" role="tablist" aria-label="Creative AI Workflow">
        <button type="button" role="tab" aria-selected="${view === "workflow"}" data-hhcaw-view-target="workflow"><i>WF</i><span>Workflow<small>Graph & cache</small></span></button>
        <button type="button" role="tab" aria-selected="${view === "ai-director"}" data-hhcaw-view-target="ai-director"><i>DR</i><span>AI Director<small>Duyệt từng bước</small></span></button>
        <button type="button" role="tab" aria-selected="${view === "prompt-studio"}" data-hhcaw-view-target="prompt-studio"><i>PS</i><span>Prompt Studio<small>Variant & lineage</small></span></button>
      </nav>
      <div class="hhcaw-stage" data-hhcaw-stage></div>
      <footer class="hhcaw-status" role="status" aria-live="polite" data-hhcaw-status>Sẵn sàng.</footer>
    </section>`;
  }

  function workflowMarkup(project, running) {
    const workflow = project.workflow;
    return `<section class="hhcaw-workflow">
      <div class="hhcaw-toolbar">
        <label><span>Preset</span><select data-hhcaw-preset><option value="full-production" ${workflow.preset === "full-production" ? "selected" : ""}>Full production</option><option value="short-video" ${workflow.preset === "short-video" ? "selected" : ""}>Short video</option><option value="audio" ${workflow.preset === "audio" ? "selected" : ""}>Audio</option><option value="custom" ${workflow.preset === "custom" ? "selected" : ""}>Custom</option></select></label>
        <button class="is-primary" type="button" data-hhcaw-action="run-all" ${running ? "disabled" : ""}>${running ? "Đang chạy..." : "Chạy toàn bộ"}</button>
        <button type="button" data-hhcaw-action="retry" ${running ? "disabled" : ""}>Thử lại node lỗi</button>
        <button type="button" data-hhcaw-action="approve">Duyệt Publish</button>
        <button type="button" data-hhcaw-action="export">Xuất JSON</button>
        <label class="hhcaw-file-button">Nhập JSON<input type="file" accept="application/json,.json" data-hhcaw-import></label>
      </div>
      <form class="hhcaw-edge-editor" data-hhcaw-edge-form>
        <strong>Edge editor</strong>
        <label><span>Từ node</span><select name="from" required>${workflow.nodes.map((node) => `<option value="${node.id}">${escapeHtml(node.name)}</option>`).join("")}</select></label>
        <label><span>Đến node</span><select name="to" required>${workflow.nodes.map((node, index) => `<option value="${node.id}" ${index === 1 ? "selected" : ""}>${escapeHtml(node.name)}</option>`).join("")}</select></label>
        <button type="submit">Nối node</button>
        <div class="hhcaw-edge-list" aria-label="Danh sách kết nối">${workflow.edges.map((edge) => {
          const from = workflow.nodes.find((node) => node.id === edge.from)?.name || edge.from;
          const to = workflow.nodes.find((node) => node.id === edge.to)?.name || edge.to;
          return `<span>${escapeHtml(from)} → ${escapeHtml(to)}<button type="button" aria-label="Xóa kết nối ${escapeHtml(from)} đến ${escapeHtml(to)}" data-hhcaw-remove-edge="${edge.id}">×</button></span>`;
        }).join("")}</div>
      </form>
      <section class="hhcaw-approval ${workflow.approvals.publish.approved ? "is-approved" : ""}"><i></i><div><strong>${workflow.approvals.publish.approved ? "Gate Publish đã duyệt" : "Publish đang khóa"}</strong><small>${workflow.approvals.publish.approved ? `${escapeHtml(workflow.approvals.publish.by)} · ${escapeHtml(workflow.approvals.publish.at)}` : "Review phải hoàn tất và người dùng phải phê duyệt thủ công."}</small></div></section>
      <div class="hhcaw-workflow-grid">
        <div class="hhcaw-graph" role="list" aria-label="Workflow node graph">
          ${workflow.nodes.map((node, index) => {
            const meta = NODE_META[node.type];
            const incoming = workflow.edges.filter((edge) => edge.to === node.id).map((edge) => workflow.nodes.find((item) => item.id === edge.from)?.name).filter(Boolean);
            return `<article class="hhcaw-node is-${node.status}" style="--node:${meta.color}" role="listitem" data-node-id="${node.id}">
              <header><i>${meta.icon}</i><div><span>0${index + 1} · ${escapeHtml(node.type)}</span><strong>${escapeHtml(node.name)}</strong></div><b>${statusLabel(node.status)}</b></header>
              <p>${escapeHtml(meta.note)}</p><small>${incoming.length ? `Nhận từ: ${escapeHtml(incoming.join(", "))}` : "Node bắt đầu"}</small>
              ${node.error ? `<div class="hhcaw-node-error">${escapeHtml(node.error)}</div>` : ""}
              ${node.output ? `<details><summary>Xem output</summary><pre>${escapeHtml(JSON.stringify(node.output, null, 2).slice(0, 1800))}</pre></details>` : ""}
              <footer><button type="button" data-hhcaw-run-node="${node.id}" ${running ? "disabled" : ""}>Chạy node</button><label><input type="checkbox" data-hhcaw-node-enabled="${node.id}" ${node.enabled ? "checked" : ""}> Bật</label></footer>
            </article>`;
          }).join("")}
        </div>
        <aside class="hhcaw-log-panel"><header><div><span>RUN LOG</span><h3>Nhật ký trạng thái</h3></div><b>${workflow.logs.length}</b></header><div>${workflow.logs.slice().reverse().map((entry) => `<article class="is-${entry.level}"><i></i><div><strong>${escapeHtml(entry.message)}</strong><small>${escapeHtml(entry.nodeId)} · ${new Date(entry.at).toLocaleTimeString("vi-VN")}</small></div></article>`).join("") || `<p class="hhcaw-empty">Chạy một node để xem log.</p>`}</div></aside>
      </div>
    </section>`;
  }

  function directorMarkup(project, running) {
    const director = project.director;
    const approvedCount = director.steps.filter((step) => step.approved).length;
    return `<section class="hhcaw-director">
      <form class="hhcaw-director-input" data-hhcaw-director-form><div><span>AI DIRECTOR</span><h3>Mục tiêu thành pipeline có thể kiểm soát</h3><p>Director chỉ đề xuất. Không ghi đè project và không tự xuất bản.</p></div><textarea name="goal" maxlength="4000" required placeholder="Ví dụ: Tạo chiến dịch video 7 ngày giới thiệu khóa học...">${escapeHtml(director.goal)}</textarea><button class="is-primary" type="submit" ${running ? "disabled" : ""}>${running ? "Đang đề xuất..." : "Đề xuất pipeline"}</button></form>
      <div class="hhcaw-director-summary"><div><span>Nguồn đề xuất</span><strong>${director.source === "external-ai" ? "runAI" : "Bộ lập kế hoạch cục bộ"}</strong></div><p>${escapeHtml(director.summary || "Nhập mục tiêu để bắt đầu.")}</p><button type="button" data-hhcaw-action="apply-director" ${approvedCount ? "" : "disabled"}>Áp dụng ${approvedCount} bước đã duyệt</button></div>
      <div class="hhcaw-director-steps">${director.steps.map((step, index) => `<article class="${step.approved ? "is-approved" : ""}" style="--node:${NODE_META[step.type].color}"><i>${NODE_META[step.type].icon}</i><div><span>BƯỚC ${String(index + 1).padStart(2, "0")}</span><h4>${escapeHtml(step.title)}</h4><p>${escapeHtml(step.instruction)}</p></div><label><input type="checkbox" data-hhcaw-director-approve="${step.id}" ${step.approved ? "checked" : ""}> ${step.approved ? "Đã duyệt" : "Duyệt bước"}</label></article>`).join("") || `<div class="hhcaw-empty">Chưa có đề xuất. Director luôn yêu cầu bạn duyệt từng bước.</div>`}</div>
    </section>`;
  }

  function assetMarkup(meta, url, label) {
    return `<article class="hhcaw-asset">${url && /^image\//.test(meta.type) ? `<img src="${escapeHtml(url)}" alt="Preview ${escapeHtml(meta.name)}">` : `<i>${/^video\//.test(meta.type) ? "VID" : "REF"}</i>`}<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(meta.name)}</strong><small>${Math.round(meta.size / 1024)} KB · ${escapeHtml(meta.type)}</small></div></article>`;
  }

  function promptMarkup(project, urls, hasAI) {
    const studio = project.promptStudio;
    const draft = studio.draft;
    const selected = new Set(studio.selected);
    const assets = [draft.firstFrame && { meta: draft.firstFrame, label: "Frame đầu" }, draft.lastFrame && { meta: draft.lastFrame, label: "Frame cuối" }, ...draft.references.map((meta) => ({ meta, label: "Tham chiếu" }))].filter(Boolean);
    return `<section class="hhcaw-prompt">
      <div class="hhcaw-prompt-grid">
        <form class="hhcaw-prompt-form" data-hhcaw-prompt-form>
          <header><span>MULTIMODAL PROMPT</span><h3>Thiết kế prompt có thể tái tạo</h3><p>Metadata được lưu trong project; tệp gốc không tự tải lên mạng.</p></header>
          <label class="is-wide"><span>Prompt chính</span><textarea name="text" maxlength="${MAX_TEXT}" required placeholder="Mô tả chủ thể, hành động và bối cảnh...">${escapeHtml(draft.text)}</textarea></label>
          <label class="is-wide"><span>Negative prompt</span><textarea name="negative" maxlength="4000" placeholder="Loại trừ lỗi, vật thể hoặc phong cách...">${escapeHtml(draft.negative)}</textarea></label>
          <label><span>Seed</span><input name="seed" type="number" min="0" max="2147483647" value="${draft.seed}"></label>
          <label><span>Camera</span><input name="camera" maxlength="100" value="${escapeHtml(draft.camera)}"></label>
          <label><span>Ánh sáng</span><input name="lighting" maxlength="100" value="${escapeHtml(draft.lighting)}"></label>
          <label><span>Phong cách</span><input name="style" maxlength="100" value="${escapeHtml(draft.style)}"></label>
          <div class="hhcaw-file-grid is-wide"><label>Frame đầu<input type="file" accept="image/*,video/*" data-hhcaw-asset="firstFrame"></label><label>Frame cuối<input type="file" accept="image/*,video/*" data-hhcaw-asset="lastFrame"></label><label>Ảnh tham chiếu<input type="file" accept="image/*,video/*" multiple data-hhcaw-asset="references"></label></div>
          <div class="hhcaw-prompt-actions is-wide"><button type="submit" data-hhcaw-prompt-mode="local">Lưu spec cục bộ</button><button class="is-primary" type="submit" data-hhcaw-prompt-mode="ai" ${hasAI ? "" : "disabled"}>Tạo với runAI</button></div>
        </form>
        <aside class="hhcaw-assets"><header><span>REFERENCE BIN</span><strong>${assets.length} asset</strong></header>${assets.map(({ meta, label }) => assetMarkup(meta, urls.get(meta.id), label)).join("") || `<div class="hhcaw-empty">Chọn frame hoặc ảnh tham chiếu từ thiết bị.</div>`}</aside>
      </div>
      <section class="hhcaw-variants"><header><div><span>VARIANT LAB</span><h3>So sánh và theo dõi lineage</h3></div><b>${studio.variants.length} biến thể</b></header><div>${studio.variants.slice().reverse().map((variant) => `<article class="${selected.has(variant.id) ? "is-selected" : ""}"><header><label><input type="checkbox" data-hhcaw-variant-select="${variant.id}" ${selected.has(variant.id) ? "checked" : ""}> So sánh</label><span>GEN ${variant.generation}</span></header><strong>${escapeHtml(variant.prompt.slice(0, 140) || "Prompt trống")}</strong><p>${escapeHtml(variant.settings.camera)} · ${escapeHtml(variant.settings.lighting)} · ${escapeHtml(variant.settings.style)}</p><small>#${variant.fingerprint} · seed ${variant.seed} · ${variant.source === "external-ai" ? "runAI" : "local spec"}</small><footer><button type="button" data-hhcaw-reproduce="${variant.id}">Tái tạo</button><button type="button" data-hhcaw-lineage="${variant.id}">Lineage</button></footer></article>`).join("") || `<div class="hhcaw-empty">Chưa có biến thể. Prompt cục bộ không tạo ảnh giả.</div>`}</div><pre class="hhcaw-compare" data-hhcaw-compare>${escapeHtml(JSON.stringify(compareVariants(project), null, 2))}</pre></section>
    </section>`;
  }

  function mount(root, options) {
    if (!root || typeof root.querySelector !== "function") throw new TypeError("HHCreativeAIWorkflow.mount cần một root element.");
    unmount(root);
    const opts = options && typeof options === "object" ? options : {};
    const adapter = createStoreAdapter(opts.store);
    let project = normalizeProject(adapter.read() || opts.project || createDefaultProject());
    let view = VIEWS.includes(opts.view) ? opts.view : project.activeView;
    let running = false;
    const objectUrls = new Map();
    const abort = typeof AbortController === "function" ? new AbortController() : null;
    const listeners = [];

    function listen(target, event, handler) {
      if (!target) return;
      if (abort) target.addEventListener(event, handler, { signal: abort.signal });
      else { target.addEventListener(event, handler); listeners.push([target, event, handler]); }
    }

    function persist(message) {
      project.activeView = view;
      project.updatedAt = nowIso();
      const result = adapter.write(project);
      const status = root.querySelector("[data-hhcaw-status]");
      if (status) status.textContent = message || (result.shared ? "Đã đồng bộ project và lưu fallback cục bộ." : "Đã lưu cục bộ trên thiết bị.");
    }

    function renderStage() {
      const stage = root.querySelector("[data-hhcaw-stage]");
      if (!stage) return;
      if (view === "ai-director") stage.innerHTML = directorMarkup(project, running);
      else if (view === "prompt-studio") stage.innerHTML = promptMarkup(project, objectUrls, typeof opts.runAI === "function");
      else stage.innerHTML = workflowMarkup(project, running);
      root.dataset.hhcawView = view;
      root.querySelectorAll("[data-hhcaw-view-target]").forEach((button) => button.setAttribute("aria-selected", String(button.dataset.hhcawViewTarget === view)));
    }

    function setProject(next, message) {
      project = normalizeProject(next);
      persist(message);
      renderStage();
      return clone(project);
    }

    function setView(nextView) {
      if (!VIEWS.includes(nextView)) return;
      view = nextView;
      project.activeView = view;
      persist(`Đã mở ${nextView}.`);
      renderStage();
      if (typeof opts.onNavigate === "function") opts.onNavigate(nextView, clone(project));
    }

    root.innerHTML = shellMarkup(view, typeof opts.runAI === "function");
    renderStage();

    listen(root, "click", async (event) => {
      const target = event.target.closest("button, [data-hhcaw-view-target]");
      if (!target) return;
      if (target.dataset.hhcawViewTarget) { setView(target.dataset.hhcawViewTarget); return; }
      if (target.dataset.hhcawRunNode) {
        running = true; renderStage();
        project = await runWorkflowNode(project, target.dataset.hhcawRunNode, { runAI: opts.runAI });
        running = false; persist("Đã chạy node."); renderStage(); return;
      }
      if (target.dataset.hhcawRemoveEdge) {
        setProject(disconnectNodes(project, target.dataset.hhcawRemoveEdge), "Đã xóa edge; Publish cần duyệt lại."); return;
      }
      if (target.dataset.hhcawReproduce) { setProject(reproduceVariant(project, target.dataset.hhcawReproduce), "Đã tái tạo biến thể và giữ lineage."); return; }
      if (target.dataset.hhcawLineage) {
        const output = root.querySelector("[data-hhcaw-compare]");
        if (output) output.textContent = JSON.stringify(getVariantLineage(project, target.dataset.hhcawLineage).map((variant) => ({ id: variant.id, generation: variant.generation, parentId: variant.parentId, reproducedFrom: variant.reproducedFrom })), null, 2);
        return;
      }
      const action = target.dataset.hhcawAction;
      if (!action) return;
      if (action === "run-all") {
        running = true; renderStage();
        project = await runWorkflow(project, { runAI: opts.runAI });
        running = false; persist("Workflow đã chạy đến gate Publish."); renderStage();
      } else if (action === "retry") {
        running = true; renderStage();
        project = await retryFailed(project, { runAI: opts.runAI });
        running = false; persist("Đã thử lại các node lỗi."); renderStage();
      } else if (action === "approve") {
        try { setProject(approvePublish(project, "Người dùng HH"), "Publish đã được duyệt thủ công."); }
        catch (error) { const status = root.querySelector("[data-hhcaw-status]"); if (status) status.textContent = error.message; }
      } else if (action === "export") download(`${safeId(project.name, "creative-workflow")}.json`, exportProject(project));
      else if (action === "apply-director") {
        try { setProject(applyDirectorPlan(project), "Đã áp dụng pipeline được duyệt."); setView("workflow"); }
        catch (error) { const status = root.querySelector("[data-hhcaw-status]"); if (status) status.textContent = error.message; }
      }
    });

    listen(root, "change", async (event) => {
      const target = event.target;
      if (target.matches("[data-hhcaw-preset]")) {
        if (target.value === "custom") return;
        project.workflow = createPreset(target.value); setProject(project, "Đã nạp preset; Publish cần duyệt lại.");
      } else if (target.matches("[data-hhcaw-node-enabled]")) {
        const node = project.workflow.nodes.find((item) => item.id === target.dataset.hhcawNodeEnabled);
        if (node) { node.enabled = target.checked; setProject(revokePublishApproval(project, "Node thay đổi; cần duyệt Publish lại.")); }
      } else if (target.matches("[data-hhcaw-director-approve]")) {
        setProject(setDirectorStepApproval(project, target.dataset.hhcawDirectorApprove, target.checked), "Đã cập nhật bước Director.");
      } else if (target.matches("[data-hhcaw-variant-select]")) {
        const id = target.dataset.hhcawVariantSelect;
        const selected = new Set(project.promptStudio.selected);
        if (target.checked) selected.add(id); else selected.delete(id);
        project.promptStudio.selected = [...selected].slice(-3);
        setProject(project, "Đã cập nhật nhóm so sánh.");
      } else if (target.matches("[data-hhcaw-import]")) {
        const file = target.files && target.files[0];
        if (!file || file.size > MAX_IMPORT_BYTES) return;
        try { setProject(importProject(await file.text()), "Đã nhập Creative AI Workflow project."); }
        catch (error) { const status = root.querySelector("[data-hhcaw-status]"); if (status) status.textContent = safeText(error.message, "Không thể nhập project.", 300); }
      } else if (target.matches("[data-hhcaw-asset]")) {
        const slot = target.dataset.hhcawAsset;
        const files = [...(target.files || [])].slice(0, slot === "references" ? 10 : 1);
        if (!files.length) return;
        if (slot !== "references" && project.promptStudio.draft[slot]) {
          const oldId = project.promptStudio.draft[slot].id;
          if (objectUrls.has(oldId)) { globalScope.URL.revokeObjectURL(objectUrls.get(oldId)); objectUrls.delete(oldId); }
        }
        const metadata = files.map((file) => fileMeta(file));
        metadata.forEach((meta, index) => {
          if (globalScope.URL && typeof globalScope.URL.createObjectURL === "function") objectUrls.set(meta.id, globalScope.URL.createObjectURL(files[index]));
        });
        if (slot === "references") project.promptStudio.draft.references = [...project.promptStudio.draft.references, ...metadata].slice(-10);
        else project.promptStudio.draft[slot] = metadata[0];
        setProject(project, "Đã thêm metadata asset; tệp chưa được tải lên mạng.");
      }
    });

    listen(root, "submit", async (event) => {
      if (event.target.matches("[data-hhcaw-edge-form]")) {
        event.preventDefault();
        const form = new FormData(event.target);
        try { setProject(connectNodes(project, form.get("from"), form.get("to")), "Đã nối edge; Publish cần duyệt lại."); }
        catch (error) { const status = root.querySelector("[data-hhcaw-status]"); if (status) status.textContent = safeText(error.message, "Không thể nối node.", 300); }
      } else if (event.target.matches("[data-hhcaw-director-form]")) {
        event.preventDefault();
        const goal = new FormData(event.target).get("goal");
        running = true; renderStage();
        project.director = await proposeDirectorPlan(goal, { runAI: opts.runAI });
        running = false; persist("Director đã đề xuất; hãy duyệt từng bước."); renderStage();
      } else if (event.target.matches("[data-hhcaw-prompt-form]")) {
        event.preventDefault();
        const form = new FormData(event.target);
        project.promptStudio.draft = { ...project.promptStudio.draft, text: form.get("text"), negative: form.get("negative"), seed: form.get("seed"), camera: form.get("camera"), lighting: form.get("lighting"), style: form.get("style") };
        const useAI = event.submitter && event.submitter.dataset.hhcawPromptMode === "ai";
        if (useAI && typeof opts.runAI === "function") {
          running = true; renderStage();
          try {
            const payload = buildPromptPayload(project.promptStudio.draft);
            const output = await opts.runAI({ task: "multimodal-prompt", prompt: clone(payload), requirement: "Generate a reviewed draft only; do not publish or overwrite assets." });
            const variant = createPromptVariant(project.promptStudio.draft, { output: boundedValue(output), source: "external-ai" });
            project = addPromptVariant(project, variant);
            persist("runAI đã trả biến thể; hãy so sánh và duyệt kết quả.");
          } catch (error) {
            const status = root.querySelector("[data-hhcaw-status]");
            if (status) status.textContent = `runAI lỗi: ${safeText(error.message, "không xác định", 300)}`;
          } finally { running = false; renderStage(); }
        } else {
          const variant = createPromptVariant(project.promptStudio.draft);
          setProject(addPromptVariant(project, variant), "Đã tạo biến thể prompt cục bộ; chưa gọi AI bên ngoài.");
        }
      }
    });

    listen(root, "keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); persist("Đã lưu project."); }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && view === "workflow" && !running) root.querySelector('[data-hhcaw-action="run-all"]')?.click();
    });

    persist("Creative AI Workflow sẵn sàng.");
    const context = {
      abort,
      listeners,
      objectUrls,
      getProject: () => clone(project),
      setProject,
      getView: () => view,
      setView,
      runNode: async (id, runOptions) => setProject(await runWorkflowNode(project, id, { runAI: opts.runAI, ...(runOptions || {}) }), "Đã chạy node."),
      runAll: async (runOptions) => setProject(await runWorkflow(project, { runAI: opts.runAI, ...(runOptions || {}) }), "Đã chạy workflow.")
    };
    mounted.set(root, context);
    return context;
  }

  function unmount(root) {
    const context = root && mounted.get(root);
    if (!context) return false;
    if (context.abort) context.abort.abort();
    context.listeners.forEach(([target, event, handler]) => target.removeEventListener(event, handler));
    context.objectUrls.forEach((url) => {
      if (globalScope.URL && typeof globalScope.URL.revokeObjectURL === "function") globalScope.URL.revokeObjectURL(url);
    });
    context.objectUrls.clear();
    mounted.delete(root);
    if (root) root.innerHTML = "";
    return true;
  }

  function mountAll(selector, options) {
    if (!globalScope.document) return [];
    return [...globalScope.document.querySelectorAll(selector || "[data-creative-ai-workflow]")].map((root) => mount(root, { ...(options || {}), view: root.dataset.creativeAiWorkflow || options && options.view }));
  }

  const api = Object.freeze({
    STORAGE_KEY, FORMAT, VERSION, VIEWS, NODE_TYPES, NODE_META,
    createDefaultProject, createPreset, normalizeProject, normalizeWorkflow,
    deterministicHash, stableStringify, hasPath, topologicalSort, connectNodes, disconnectNodes,
    approvePublish, revokePublishApproval, runWorkflowNode, runWorkflow, retryFailed,
    directorStepsFor, proposeDirectorPlan, setDirectorStepApproval, applyDirectorPlan,
    buildPromptPayload, createPromptVariant, addPromptVariant, reproduceVariant, getVariantLineage, compareVariants,
    exportProject, importProject, createStoreAdapter, fileMeta,
    mount, unmount, mountAll
  });

  globalScope.HHCreativeAIWorkflow = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
