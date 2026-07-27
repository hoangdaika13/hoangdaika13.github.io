((factory) => {
  const scope = typeof window !== "undefined" ? window : globalThis;
  const api = factory(scope);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.HHMediaNextSuite = api;
})((globalScope) => {
  "use strict";

  const SCHEMA = "hh.media.next.v1";
  const STATE_KEY = SCHEMA;
  const VERSION = 1;
  const WORKSPACES = Object.freeze([
    { id: "media-cloud", code: "MC", title: "Media Cloud", planet: "assets", color: "#5c9dff", route: "/media-design/media-cloud", summary: "Private Blob, upload lớn, quyền, quota, signed URL và trash." },
    { id: "review-studio", code: "RV", title: "Review Studio", planet: "universal", color: "#56ecff", route: "/media-design/review-studio", summary: "Comment theo pixel/frame, annotation, version compare và approval." },
    { id: "motion-compositor", code: "FX", title: "Motion & Compositing", planet: "video", color: "#a56cff", route: "/media-design/motion-compositor", summary: "Node graph, keyframe, tracking, 2.5D, particle và render cache." },
    { id: "universal-canvas", code: "UC", title: "Universal Canvas", planet: "universal", color: "#ff63d8", route: "/media-design/universal-canvas", summary: "Infinite canvas cho frame, asset, sequence, component và review." },
    { id: "ai-task-center", code: "AI", title: "AI Task Center", planet: "photo", color: "#ff7fcb", route: "/media-design/ai-task-center", summary: "Provider, model, seed, variation, lock, quyền và provenance." },
    { id: "dev-handoff", code: "DV", title: "Dev Mode & Handoff", planet: "brand", color: "#ffbd59", route: "/media-design/dev-handoff", summary: "Inspect, token alias, code snippet, Ready for Dev và screenshot compare." }
  ]);
  const WORKSPACE_BY_ID = Object.freeze(Object.fromEntries(WORKSPACES.map((item) => [item.id, item])));
  const active = new Map();

  const now = () => new Date().toISOString();
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const clean = (value, max = 240, fallback = "") => String(value == null ? "" : value).trim().slice(0, max) || fallback;
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, number(value)));
  const clone = (value) => {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };
  const escapeHtml = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const safeFileName = (value) => clean(value, 180, "asset.bin").normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "asset.bin";

  function createDefaultState() {
    const frameId = uid("frame");
    return {
      schema: SCHEMA,
      version: VERSION,
      activeProjectId: "",
      lastWorkspace: "media-cloud",
      cloud: { status: "idle", projects: [], project: null, assets: [], reviews: [], jobs: [], aiTasks: [], audit: [], usage: { userBytes: 0, projectBytes: 0 }, capabilities: null, lastSyncAt: "" },
      uploads: [],
      review: {
        compare: { leftAssetId: "", rightAssetId: "", mode: "side-by-side", slider: 50, linked: true },
        localComments: [],
        localStatus: "draft",
        drawing: { tool: "arrow", color: "#56ecff" }
      },
      motion: {
        nodes: [
          { id: "media-in", type: "input", name: "Media In", enabled: true, x: 50, y: 120 },
          { id: "transform", type: "transform", name: "Transform", enabled: true, x: 260, y: 120 },
          { id: "media-out", type: "output", name: "Media Out", enabled: true, x: 480, y: 120 }
        ],
        edges: [{ from: "media-in", to: "transform" }, { from: "transform", to: "media-out" }],
        keyframes: [],
        cache: [],
        camera: { depth: 0, fov: 45 },
        audioReactive: false
      },
      canvas: {
        zoom: 70,
        grid: true,
        snap: true,
        frames: [{ id: frameId, name: "Desktop 16:9", x: 80, y: 70, width: 640, height: 360, readyForDev: false }],
        nodes: [{ id: uid("canvas-node"), frameId, type: "text", name: "HH Media Universe", x: 48, y: 54, width: 280, height: 64, content: "HH Media Universe", token: "color.brand.primary" }],
        selectedId: ""
      },
      ai: { tasks: [], provider: "media-ai", model: "default", operation: "generate-image" },
      dev: { format: "css", selectedFrameId: frameId, compareOpacity: 50, screenshotName: "", storybookUrl: "" },
      updatedAt: now()
    };
  }

  function normalizeState(input) {
    const raw = input && typeof input === "object" ? input : {};
    const base = createDefaultState();
    const state = {
      ...base,
      ...raw,
      schema: SCHEMA,
      version: VERSION,
      cloud: { ...base.cloud, ...(raw.cloud || {}), usage: { ...base.cloud.usage, ...(raw.cloud?.usage || {}) } },
      review: { ...base.review, ...(raw.review || {}), compare: { ...base.review.compare, ...(raw.review?.compare || {}) }, drawing: { ...base.review.drawing, ...(raw.review?.drawing || {}) } },
      motion: { ...base.motion, ...(raw.motion || {}), camera: { ...base.motion.camera, ...(raw.motion?.camera || {}) } },
      canvas: { ...base.canvas, ...(raw.canvas || {}) },
      ai: { ...base.ai, ...(raw.ai || {}) },
      dev: { ...base.dev, ...(raw.dev || {}) },
      lastWorkspace: WORKSPACE_BY_ID[raw.lastWorkspace] ? raw.lastWorkspace : "media-cloud",
      updatedAt: now()
    };
    state.cloud.projects = Array.isArray(state.cloud.projects) ? state.cloud.projects.slice(-60) : [];
    state.cloud.assets = Array.isArray(state.cloud.assets) ? state.cloud.assets.slice(-600) : [];
    state.cloud.reviews = Array.isArray(state.cloud.reviews) ? state.cloud.reviews.slice(-300) : [];
    state.cloud.jobs = Array.isArray(state.cloud.jobs) ? state.cloud.jobs.slice(-200) : [];
    state.cloud.aiTasks = Array.isArray(state.cloud.aiTasks) ? state.cloud.aiTasks.slice(-100) : [];
    state.cloud.audit = Array.isArray(state.cloud.audit) ? state.cloud.audit.slice(-200) : [];
    state.uploads = (Array.isArray(state.uploads) ? state.uploads : []).slice(-100).map((item) => ({ ...item, file: undefined, progress: clamp(item.progress, 0, 100) }));
    state.review.localComments = Array.isArray(state.review.localComments) ? state.review.localComments.slice(-300) : [];
    state.motion.nodes = (Array.isArray(state.motion.nodes) ? state.motion.nodes : base.motion.nodes).slice(-100).map((node) => ({ id: clean(node.id, 80, uid("node")), type: clean(node.type, 40, "transform"), name: clean(node.name, 100, "Node"), enabled: node.enabled !== false, x: clamp(node.x, -2000, 5000), y: clamp(node.y, -2000, 5000) }));
    state.motion.edges = (Array.isArray(state.motion.edges) ? state.motion.edges : base.motion.edges).slice(-200).map((edge) => ({ from: clean(edge.from, 80), to: clean(edge.to, 80) }));
    state.motion.keyframes = (Array.isArray(state.motion.keyframes) ? state.motion.keyframes : []).slice(-500);
    state.motion.cache = (Array.isArray(state.motion.cache) ? state.motion.cache : []).slice(-100);
    state.canvas.frames = (Array.isArray(state.canvas.frames) ? state.canvas.frames : base.canvas.frames).slice(-80).map((frame) => ({ ...frame, id: clean(frame.id, 80, uid("frame")), name: clean(frame.name, 100, "Frame"), x: clamp(frame.x, -5000, 10000), y: clamp(frame.y, -5000, 10000), width: clamp(frame.width, 64, 4096), height: clamp(frame.height, 64, 4096), readyForDev: Boolean(frame.readyForDev) }));
    state.canvas.nodes = (Array.isArray(state.canvas.nodes) ? state.canvas.nodes : base.canvas.nodes).slice(-500).map((node) => ({ ...node, id: clean(node.id, 80, uid("canvas-node")), name: clean(node.name, 120, "Layer"), content: clean(node.content, 1000), x: clamp(node.x, -5000, 10000), y: clamp(node.y, -5000, 10000), width: clamp(node.width, 8, 4096), height: clamp(node.height, 8, 4096) }));
    state.ai.tasks = Array.isArray(state.ai.tasks) ? state.ai.tasks.slice(-100) : [];
    return state;
  }

  function createStateStore(storage) {
    const target = storage || globalScope.localStorage;
    return Object.freeze({
      load() {
        if (!target?.getItem) return normalizeState({});
        try { return normalizeState(JSON.parse(target.getItem(STATE_KEY) || "{}")); } catch (_) { return normalizeState({}); }
      },
      save(value) {
        const state = normalizeState(value);
        const portable = clone(state);
        portable.cloud = { ...portable.cloud, projects: [], assets: [], reviews: [], jobs: [], aiTasks: [], audit: [] };
        portable.uploads = portable.uploads.map((item) => ({ ...item, file: undefined }));
        try { target?.setItem?.(STATE_KEY, JSON.stringify(portable)); } catch (_) { /* Local quota can be unavailable. */ }
        return state;
      }
    });
  }

  function createCanvasFrame(input, preset = "youtube") {
    const state = normalizeState(input);
    const sizes = {
      youtube: ["YouTube 16:9", 640, 360],
      vertical: ["Shorts 9:16", 270, 480],
      square: ["Social 1:1", 360, 360],
      canvas: ["Spotify Canvas", 270, 480],
      custom: ["Custom Frame", 420, 300]
    };
    const [name, width, height] = sizes[preset] || sizes.custom;
    const frame = { id: uid("frame"), name, x: 80 + state.canvas.frames.length * 32, y: 70 + state.canvas.frames.length * 28, width, height, readyForDev: false };
    state.canvas.frames.push(frame);
    state.canvas.selectedId = frame.id;
    return normalizeState(state);
  }

  function addMotionNode(input, type = "transform") {
    const state = normalizeState(input);
    const names = { mask: "Polygon Mask", transform: "Transform", merge: "Merge", text: "Text+", particle: "Particle Emitter", keyer: "Chroma Key", tracker: "Planar Tracker", camera: "Camera 2.5D", light: "Light", output: "Media Out" };
    const node = { id: uid("motion-node"), type: clean(type, 40, "transform"), name: names[type] || clean(type, 100, "Node"), enabled: true, x: 120 + (state.motion.nodes.length % 4) * 190, y: 250 + Math.floor(state.motion.nodes.length / 4) * 100 };
    const previous = [...state.motion.nodes].reverse().find((item) => item.type !== "output");
    state.motion.nodes.push(node);
    if (previous && node.type !== "input") state.motion.edges.push({ from: previous.id, to: node.id });
    return normalizeState(state);
  }

  function createAiTaskDraft(input = {}) {
    return {
      id: uid("ai-task"),
      name: clean(input.name, 120, "Media AI Task"),
      provider: clean(input.provider, 80, "media-ai"),
      model: clean(input.model, 100, "default"),
      operation: clean(input.operation, 80, "generate-image"),
      prompt: clean(input.prompt, 4000),
      negativePrompt: clean(input.negativePrompt, 2000),
      seed: Math.max(0, Math.floor(number(input.seed))),
      variations: clamp(input.variations || 3, 1, 6),
      locks: (Array.isArray(input.locks) ? input.locks : []).map((item) => clean(item, 40)).slice(0, 20),
      licenseAccepted: Boolean(input.licenseAccepted),
      status: "draft",
      cost: null,
      outputAssetIds: [],
      createdAt: now()
    };
  }

  function buildDevSnippet(node, frame, format = "css") {
    const item = node || { name: "MediaLayer", x: 0, y: 0, width: 100, height: 100, token: "color.brand.primary" };
    const safeName = clean(item.name, 80, "MediaLayer").replace(/[^a-z0-9]+/gi, "");
    if (format === "json") return JSON.stringify({ name: item.name, frame: frame?.name || "", bounds: { x: item.x, y: item.y, width: item.width, height: item.height }, token: item.token || "" }, null, 2);
    if (format === "react") return `<div className="${safeName}" data-token="${item.token || ""}">${item.content || item.name}</div>`;
    if (format === "svg") return `<rect x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" rx="12" fill="var(--${String(item.token || "color-brand-primary").replace(/\./g, "-")})" />`;
    return `.${safeName} {\n  position: absolute;\n  left: ${item.x}px;\n  top: ${item.y}px;\n  width: ${item.width}px;\n  height: ${item.height}px;\n  color: var(--${String(item.token || "color-brand-primary").replace(/\./g, "-")});\n}`;
  }

  const SHA256_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);
  const rotateRight = (value, bits) => (value >>> bits) | (value << (32 - bits));

  function createStreamingSha256() {
    const state = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const buffer = new Uint8Array(64);
    const words = new Uint32Array(64);
    let buffered = 0;
    let bytes = 0;
    const process = (chunk, offset = 0) => {
      for (let index = 0; index < 16; index += 1) {
        const position = offset + index * 4;
        words[index] = ((chunk[position] << 24) | (chunk[position + 1] << 16) | (chunk[position + 2] << 8) | chunk[position + 3]) >>> 0;
      }
      for (let index = 16; index < 64; index += 1) {
        const a = words[index - 15], b = words[index - 2];
        const s0 = rotateRight(a, 7) ^ rotateRight(a, 18) ^ (a >>> 3);
        const s1 = rotateRight(b, 17) ^ rotateRight(b, 19) ^ (b >>> 10);
        words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = state;
      for (let index = 0; index < 64; index += 1) {
        const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
        const choose = (e & f) ^ (~e & g);
        const first = (h + s1 + choose + SHA256_K[index] + words[index]) >>> 0;
        const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const second = (s0 + majority) >>> 0;
        h = g; g = f; f = e; e = (d + first) >>> 0; d = c; c = b; b = a; a = (first + second) >>> 0;
      }
      state[0] = (state[0] + a) >>> 0; state[1] = (state[1] + b) >>> 0;
      state[2] = (state[2] + c) >>> 0; state[3] = (state[3] + d) >>> 0;
      state[4] = (state[4] + e) >>> 0; state[5] = (state[5] + f) >>> 0;
      state[6] = (state[6] + g) >>> 0; state[7] = (state[7] + h) >>> 0;
    };
    return Object.freeze({
      update(input) {
        const chunk = input instanceof Uint8Array ? input : new Uint8Array(input);
        bytes += chunk.byteLength;
        let offset = 0;
        if (buffered) {
          const amount = Math.min(64 - buffered, chunk.byteLength);
          buffer.set(chunk.subarray(0, amount), buffered);
          buffered += amount; offset += amount;
          if (buffered === 64) { process(buffer); buffered = 0; }
        }
        while (offset + 64 <= chunk.byteLength) { process(chunk, offset); offset += 64; }
        if (offset < chunk.byteLength) { buffer.set(chunk.subarray(offset), 0); buffered = chunk.byteLength - offset; }
      },
      digest() {
        const tail = new Uint8Array(128);
        tail.set(buffer.subarray(0, buffered));
        tail[buffered] = 0x80;
        const lengthOffset = buffered < 56 ? 56 : 120;
        const high = Math.floor(bytes / 0x20000000);
        const low = (bytes << 3) >>> 0;
        tail[lengthOffset] = (high >>> 24) & 255; tail[lengthOffset + 1] = (high >>> 16) & 255;
        tail[lengthOffset + 2] = (high >>> 8) & 255; tail[lengthOffset + 3] = high & 255;
        tail[lengthOffset + 4] = (low >>> 24) & 255; tail[lengthOffset + 5] = (low >>> 16) & 255;
        tail[lengthOffset + 6] = (low >>> 8) & 255; tail[lengthOffset + 7] = low & 255;
        process(tail, 0);
        if (lengthOffset === 120) process(tail, 64);
        return [...state].map((value) => value.toString(16).padStart(8, "0")).join("");
      }
    });
  }

  async function checksum(file, signal) {
    if (!file) return "";
    if (signal?.aborted) throw new DOMException("Checksum đã tạm dừng.", "AbortError");
    if (file.size <= 64 * 1024 * 1024 && globalScope.crypto?.subtle && file.arrayBuffer) {
      const hash = await globalScope.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
    }
    if (!file.stream) return "";
    const hasher = createStreamingSha256();
    const reader = file.stream().getReader();
    while (true) {
      if (signal?.aborted) {
        await reader.cancel().catch(() => {});
        throw new DOMException("Checksum đã tạm dừng.", "AbortError");
      }
      const { value, done } = await reader.read();
      if (done) break;
      hasher.update(value);
    }
    return hasher.digest();
  }

  async function request(endpoint, options = {}) {
    const response = await fetch(endpoint, { credentials: "include", headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(clean(data.error, 300, `HTTP ${response.status}`));
      error.status = response.status;
      error.code = data.code || "";
      error.data = data;
      throw error;
    }
    return data;
  }

  const apiUrl = (query = "") => `/api/store/media${query ? `?${query}` : ""}`;
  const formatBytes = (value) => {
    const bytes = Math.max(0, number(value));
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  };
  const statusLabel = (value) => ({
    idle: "Chưa kết nối", loading: "Đang đồng bộ", local: "Local-first",
    uploading: "Đang upload", paused: "Tạm dừng", completed: "Hoàn tất", failed: "Thất bại",
    ready: "Sẵn sàng", trashed: "Trong Trash", quarantine: "Cách ly", "needs-worker": "Cần worker",
    queued: "Đang chờ", running: "Đang chạy", canceled: "Đã hủy", "needs-adapter": "Cần adapter"
  })[value] || value;

  function navMarkup(workspace) {
    return `<nav class="mnx-nav" aria-label="Media Design Next">${WORKSPACES.map((item) => `<button type="button" data-mnx-route="${item.route}" aria-current="${item.id === workspace.id ? "page" : "false"}" style="--nav-color:${item.color}"><i>${item.code}</i><span>${escapeHtml(item.title)}</span></button>`).join("")}</nav>`;
  }

  function cloudCapabilityMarkup(cloud) {
    const caps = cloud.capabilities;
    if (!caps) return `<p class="mnx-empty">Đăng nhập để kiểm tra Media Cloud và quota thật.</p>`;
    return `<div class="mnx-cap-grid">${[
      ["Private Blob", caps.cloud, caps.messages?.cloud],
      ["Multipart", caps.multipart, caps.multipart ? "Tự chia part và retry file lớn" : "Chưa sẵn sàng"],
      ["Signed URL", caps.signedDownloads, caps.signedDownloads ? "Link tải ngắn hạn" : "Chưa sẵn sàng"],
      ["Render Worker", caps.renderWorker, caps.messages?.render],
      ["AI Worker", caps.aiWorker, caps.messages?.ai],
      ["Antivirus", caps.antivirus, caps.messages?.antivirus]
    ].map(([label, ready, detail]) => `<article data-ready="${ready}"><span>${ready ? "✓" : "◇"}</span><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(detail || "")}</small></div></article>`).join("")}</div>`;
  }

  function projectPickerMarkup(state) {
    return `<div class="mnx-project-picker"><label>Cloud Project<select data-mnx-project-select><option value="">Chọn project…</option>${state.cloud.projects.map((project) => `<option value="${project.id}" ${project.id === state.activeProjectId ? "selected" : ""}>${escapeHtml(project.name)} · ${escapeHtml(project.role)}</option>`).join("")}</select></label><button type="button" data-mnx-refresh>Đồng bộ</button><form data-mnx-project-form><input name="name" maxlength="140" placeholder="Tên Media Project" required><button type="submit">Tạo mới</button></form></div>`;
  }

  function uploadRows(state) {
    return state.uploads.slice().reverse().slice(0, 12).map((job) => `<article data-status="${job.status}"><div><strong>${escapeHtml(job.name)}</strong><small>${formatBytes(job.size)} · ${escapeHtml(job.message || statusLabel(job.status))}</small><i style="--progress:${job.progress}%"></i></div><b>${job.progress}%</b><span>${escapeHtml(statusLabel(job.status))}</span><div>${job.status === "uploading" ? `<button type="button" data-mnx-upload-action="pause" data-upload-id="${job.id}">Pause</button>` : ""}${["paused", "failed"].includes(job.status) ? `<button type="button" data-mnx-upload-action="resume" data-upload-id="${job.id}">Resume</button>` : ""}${!["completed", "canceled"].includes(job.status) ? `<button type="button" data-mnx-upload-action="cancel" data-upload-id="${job.id}">Cancel</button>` : ""}</div></article>`).join("") || `<p class="mnx-empty">Chưa có upload trong phiên này.</p>`;
  }

  function assetRows(state) {
    return state.cloud.assets.slice(0, 40).map((asset) => `<article data-status="${asset.status}"><span>${escapeHtml(String(asset.mimeType || "file").split("/")[0].toUpperCase())}</span><div><strong>${escapeHtml(asset.name)}</strong><small>${formatBytes(asset.size)} · ${escapeHtml(String(asset.checksum || "").slice(0, 16) || "chưa có checksum")} · v${asset.version}</small></div><b>${escapeHtml(statusLabel(asset.status))}</b><div><button type="button" data-mnx-asset-action="download" data-asset-id="${asset.id}">Tải</button><button type="button" data-mnx-asset-action="trash" data-asset-id="${asset.id}">Trash</button></div></article>`).join("") || `<p class="mnx-empty">Project chưa có asset cloud.</p>`;
  }

  function renderJobRows(state) {
    return state.cloud.jobs.slice(0, 30).map((job) => {
      const actions = [
        ["pause", ["queued", "running"].includes(job.status)],
        ["resume", job.status === "paused"],
        ["retry", ["failed", "needs-worker"].includes(job.status)],
        ["cancel", !["completed", "canceled"].includes(job.status)],
        ["duplicate", true]
      ].filter(([, visible]) => visible);
      const cost = job.cost ? `${job.cost.amount} ${job.cost.currency}` : "Chưa ghi nhận chi phí";
      return `<article data-status="${job.status}"><span>${escapeHtml(String(job.spec?.codec || "job").toUpperCase())}</span><div><strong>${escapeHtml(job.name)}</strong><small>${escapeHtml(job.spec?.preset || "")} · ${job.spec?.width || 0}×${job.spec?.height || 0} · ưu tiên ${job.priority}</small><i style="--progress:${clamp(job.progress, 0, 100)}%"></i><em>${escapeHtml(job.message || cost)}</em></div><b>${Math.round(number(job.progress))}% · ${escapeHtml(statusLabel(job.status))}</b><div>${actions.map(([action]) => `<button type="button" data-mnx-render-action="${action}" data-job-id="${job.id}">${action}</button>`).join("")}</div></article>`;
    }).join("") || `<p class="mnx-empty">Chưa có render job. Job chỉ chuyển sang queued khi worker xác nhận.</p>`;
  }

  function cloudMarkup(state) {
    const caps = state.cloud.capabilities;
    const quota = caps ? Math.max(1, number(caps.projectQuotaBytes)) : 1;
    const used = number(state.cloud.usage.projectBytes);
    return `<div class="mnx-grid">
      <section class="mnx-card mnx-card--wide"><header><div><small>MEDIA CLOUD CONTROL</small><h3>Private Asset Galaxy</h3></div><span data-status="${state.cloud.status}">${escapeHtml(statusLabel(state.cloud.status))}</span></header>${projectPickerMarkup(state)}${cloudCapabilityMarkup(state.cloud)}</section>
      <section class="mnx-card"><header><div><small>PROJECT QUOTA</small><h3>${formatBytes(used)} / ${formatBytes(quota)}</h3></div><b>${Math.round(used / quota * 100)}%</b></header><div class="mnx-progress"><i style="--progress:${Math.min(100, used / quota * 100)}%"></i></div><p>MongoDB lưu metadata, quyền và audit. Binary nằm trong Private Blob.</p></section>
      <section class="mnx-card"><header><div><small>ROLE MATRIX</small><h3>${escapeHtml(state.cloud.project?.role || "Local user")}</h3></div></header><div class="mnx-role-list">${["Owner · quản trị", "Editor · chỉnh sửa", "Reviewer · nhận xét/duyệt", "Viewer · chỉ xem"].map((item) => `<span>${item}</span>`).join("")}</div>${state.cloud.project?.role === "owner" ? `<form class="mnx-inline" data-mnx-member-form><input name="email" type="email" placeholder="email@domain.com" required><select name="role"><option>editor</option><option>reviewer</option><option>viewer</option></select><button type="submit">Cấp quyền</button></form>` : ""}</section>
      <section class="mnx-card mnx-card--wide"><header><div><small>MULTIPART UPLOAD</small><h3>Pause · Retry · Checksum</h3></div><b>${state.uploads.filter((job) => job.status === "uploading").length} đang chạy</b></header><label class="mnx-drop">Chọn asset để upload<input type="file" multiple data-mnx-cloud-files><span>File trên 100 MB tự dùng multipart. Token upload chỉ có quyền ghi đúng pathname và tự hết hạn.</span></label><div class="mnx-upload-list">${uploadRows(state)}</div></section>
      <section class="mnx-card mnx-card--wide"><header><div><small>ASSET LIBRARY</small><h3>Checksum · License · Trash 30 ngày</h3></div><button type="button" data-mnx-trash-view>Đổi chế độ Trash</button></header><div class="mnx-asset-list">${assetRows(state)}</div></section>
      <section class="mnx-card mnx-card--wide"><header><div><small>RENDER ORCHESTRATION</small><h3>FFmpeg worker · Checkpoint · Idempotency</h3></div><span data-ready="${Boolean(caps?.renderWorker)}">${caps?.renderWorker ? "WORKER ONLINE" : "CẦN EXTERNAL WORKER"}</span></header>
        <form class="mnx-render-form" data-mnx-render-form><input name="name" maxlength="160" placeholder="Tên render job" required><select name="preset"><option value="youtube-16x9">YouTube 16:9</option><option value="shorts-9x16">Shorts 9:16</option><option value="social-1x1">Social 1:1</option><option value="spotify-canvas">Spotify Canvas</option><option value="archive-master">Archive Master</option></select><select name="codec"><option value="h264">H.264</option><option value="h265">H.265</option><option value="prores">ProRes</option><option value="vp9">VP9</option><option value="av1">AV1</option></select><input name="width" type="number" min="16" max="16384" value="1920" aria-label="Chiều rộng"><input name="height" type="number" min="16" max="16384" value="1080" aria-label="Chiều cao"><input name="fps" type="number" min="1" max="120" value="30" aria-label="FPS"><input name="priority" type="number" min="-10" max="10" value="0" aria-label="Độ ưu tiên"><button type="submit">Tạo job</button></form>
        <div class="mnx-render-list">${renderJobRows(state)}</div>
      </section>
    </div>`;
  }

  function sharedReviewMarkup(state, meta, passwordRequired) {
    if (passwordRequired) return `<div class="mnx-grid"><section class="mnx-card mnx-card--wide mnx-share-gate"><header><div><small>PROTECTED REVIEW</small><h3>Nhập mật khẩu để mở phiên review</h3></div></header><form data-mnx-share-access><input type="password" name="password" maxlength="120" required autocomplete="current-password" placeholder="Mật khẩu review"><button type="submit">Mở review</button></form><p>Token không được lưu vào localStorage. Link vẫn tự hết hạn trên máy chủ.</p></section></div>`;
    return `<div class="mnx-grid"><section class="mnx-card mnx-card--wide"><header><div><small>SHARED REVIEW · READ ONLY</small><h3>Phiên review được bảo vệ</h3></div><b>${state.cloud.reviews.length} nhận xét</b></header><div class="mnx-share-meta"><span>Hết hạn: ${meta?.expiresAt ? new Date(meta.expiresAt).toLocaleString("vi-VN") : "đang xác minh"}</span><span>Watermark: ${escapeHtml(meta?.watermark || "bật")}</span><span>Tải xuống: ${meta?.canDownload ? "được phép" : "không"}</span></div><div class="mnx-review-list">${reviewRows(state)}</div></section></div>`;
  }

  function compareViewer(state) {
    const assets = state.cloud.assets.filter((asset) => /^image\/|^video\/|^audio\//.test(asset.mimeType || ""));
    const options = assets.map((asset) => `<option value="${asset.id}">${escapeHtml(asset.name)} · v${asset.version}</option>`).join("");
    return `<section class="mnx-card mnx-card--wide"><header><div><small>VERSION COMPARISON</small><h3>Side by side · Overlay · Pixel difference</h3></div><label>Mode<select data-mnx-compare-mode><option value="side-by-side">Song song</option><option value="overlay">Overlay</option><option value="difference">Pixel difference</option></select></label></header>
      <div class="mnx-compare-controls"><select data-mnx-compare-left><option value="">Phiên bản trái</option>${options}</select><select data-mnx-compare-right><option value="">Phiên bản phải</option>${options}</select><button type="button" data-mnx-load-compare>Tải bản so sánh</button><label><input type="checkbox" data-mnx-linked ${state.review.compare.linked ? "checked" : ""}> Đồng bộ zoom/playback</label><input type="range" min="0" max="100" value="${state.review.compare.slider}" data-mnx-compare-slider aria-label="Thanh overlay"></div>
      <div class="mnx-compare" data-mode="${escapeHtml(state.review.compare.mode)}" style="--compare:${state.review.compare.slider}%"><article data-mnx-preview="left"><span>Chọn phiên bản trái</span></article><article data-mnx-preview="right"><span>Chọn phiên bản phải</span></article><i></i></div>
    </section>`;
  }

  function reviewRows(state) {
    const comments = state.cloud.reviews.length ? state.cloud.reviews : state.review.localComments;
    return comments.slice(0, 30).map((review) => `<article data-status="${review.status || "open"}"><span>${review.anchor?.type === "frame" ? `F${review.anchor.frame}` : review.anchor?.type === "pixel" ? "PX" : "PR"}</span><div><strong>${escapeHtml(review.body)}</strong><small>${escapeHtml(review.author?.name || "Local reviewer")} · ${new Date(review.createdAt).toLocaleString("vi-VN")}</small></div><b>${escapeHtml(review.status || "open")}</b>${review.status !== "resolved" ? `<button type="button" data-mnx-review-resolve="${review.id}">Resolve</button>` : ""}</article>`).join("") || `<p class="mnx-empty">Chưa có nhận xét.</p>`;
  }

  function reviewMarkup(state) {
    const status = state.cloud.project?.reviewStatus || state.review.localStatus;
    return `<div class="mnx-grid">${compareViewer(state)}
      <section class="mnx-card"><header><div><small>ANNOTATION CANVAS</small><h3>Pixel · frame · range</h3></div><b>${state.review.drawing.tool}</b></header><div class="mnx-annotation-toolbar">${["arrow", "rectangle", "highlight", "freehand"].map((tool) => `<button type="button" data-mnx-drawing-tool="${tool}" aria-pressed="${state.review.drawing.tool === tool}">${tool}</button>`).join("")}<input type="color" value="${state.review.drawing.color}" data-mnx-drawing-color aria-label="Màu annotation"></div><div class="mnx-annotation-stage"><canvas data-mnx-annotation width="720" height="360" aria-label="Canvas vẽ nhận xét"></canvas><span>Kéo chuột để vẽ annotation. Tọa độ được chuẩn hóa theo canvas.</span></div></section>
      <section class="mnx-card"><header><div><small>APPROVAL WORKFLOW</small><h3>${escapeHtml(status)}</h3></div></header><div class="mnx-workflow">${["draft", "in-review", "changes-requested", "approved"].map((item) => `<button type="button" data-mnx-review-status="${item}" aria-current="${status === item}">${item}</button>`).join("")}</div><form class="mnx-inline mnx-inline--stack" data-mnx-share-form><input name="password" type="password" placeholder="Mật khẩu link (không bắt buộc)"><select name="ttl"><option value="86400000">1 ngày</option><option value="604800000">7 ngày</option><option value="2592000000">30 ngày</option></select><label><input type="checkbox" name="download"> Cho tải xuống</label><button type="submit">Tạo link review</button></form><p data-mnx-share-result>Link có token ngẫu nhiên, ngày hết hạn và watermark.</p></section>
      <section class="mnx-card mnx-card--wide"><header><div><small>ANCHORED COMMENTS</small><h3>Review threads</h3></div><b>${state.cloud.reviews.length || state.review.localComments.length}</b></header><form class="mnx-review-form" data-mnx-review-form><input name="comment" maxlength="1500" placeholder="Nhận xét…" required><select name="type"><option value="project">Project</option><option value="pixel">Pixel</option><option value="frame">Frame</option><option value="range">Time range</option></select><input name="frame" type="number" min="0" value="0" aria-label="Frame"><button type="submit">Gửi</button></form><div class="mnx-review-list">${reviewRows(state)}</div></section>
    </div>`;
  }

  function motionMarkup(state) {
    return `<div class="mnx-grid">
      <section class="mnx-card mnx-card--wide"><header><div><small>FUSION-STYLE GRAPH</small><h3>Compositing không phá hủy</h3></div><button type="button" data-mnx-route="/media-design/video-editor">Mở Video Editor</button></header>
        <div class="mnx-node-toolbar">${["mask", "transform", "merge", "text", "particle", "keyer", "tracker", "camera", "light"].map((type) => `<button type="button" data-mnx-add-motion="${type}">+ ${type}</button>`).join("")}</div>
        <div class="mnx-node-graph">${state.motion.edges.map((edge) => `<i data-from="${escapeHtml(edge.from)}" data-to="${escapeHtml(edge.to)}"></i>`).join("")}${state.motion.nodes.map((node) => `<button type="button" class="mnx-motion-node" data-node-id="${node.id}" data-type="${node.type}" data-mnx-toggle-motion="${node.id}" style="left:${node.x}px;top:${node.y}px" aria-pressed="${node.enabled}"><small>${escapeHtml(node.type)}</small><strong>${escapeHtml(node.name)}</strong><span>${node.enabled ? "LIVE" : "BYPASS"}</span></button>`).join("")}</div>
      </section>
      <section class="mnx-card"><header><div><small>KEYFRAME GRAPH</small><h3>${state.motion.keyframes.length} keyframe</h3></div></header><form class="mnx-inline" data-mnx-keyframe-form><select name="property"><option>position</option><option>scale</option><option>rotation</option><option>opacity</option><option>energy</option></select><input name="time" type="number" min="0" step=".01" value="0" aria-label="Thời gian"><input name="value" type="number" value="100" aria-label="Giá trị"><button type="submit">Thêm</button></form><div class="mnx-keyframe-graph">${state.motion.keyframes.map((item) => `<i style="left:${Math.min(100, item.time)}%;bottom:${Math.min(100, Math.abs(item.value))}%"></i>`).join("")}</div></section>
      <section class="mnx-card"><header><div><small>2.5D & AUDIO REACTIVE</small><h3>Camera · light · particle</h3></div></header><label>Depth<input type="range" min="-100" max="100" value="${state.motion.camera.depth}" data-mnx-camera="depth"></label><label>FOV<input type="range" min="15" max="120" value="${state.motion.camera.fov}" data-mnx-camera="fov"></label><label class="mnx-switch"><input type="checkbox" data-mnx-audio-reactive ${state.motion.audioReactive ? "checked" : ""}> Particle phản ứng theo audio</label><button type="button" class="mnx-primary" data-mnx-cache-node>Tạo render-cache checkpoint</button><p>${state.motion.cache.length} cache manifest · chỉ là cache metadata cho tới khi worker trả output thật.</p></section>
    </div>`;
  }

  function canvasMarkup(state) {
    const zoom = state.canvas.zoom / 100;
    return `<div class="mnx-canvas-layout">
      <aside class="mnx-canvas-tools"><button type="button" data-mnx-frame="youtube">16:9</button><button type="button" data-mnx-frame="vertical">9:16</button><button type="button" data-mnx-frame="square">1:1</button><button type="button" data-mnx-frame="canvas">Canvas</button><span></span><button type="button" data-mnx-canvas-node="text">Text</button><button type="button" data-mnx-canvas-node="asset">Asset</button><button type="button" data-mnx-canvas-node="component">Component</button><button type="button" data-mnx-canvas-node="sequence">Sequence</button></aside>
      <section class="mnx-canvas-shell"><header><div><button type="button" data-mnx-canvas-grid>${state.canvas.grid ? "Grid bật" : "Grid tắt"}</button><button type="button" data-mnx-canvas-snap>${state.canvas.snap ? "Snap bật" : "Snap tắt"}</button></div><label>Zoom <input type="range" min="25" max="150" value="${state.canvas.zoom}" data-mnx-canvas-zoom><b>${state.canvas.zoom}%</b></label></header>
        <div class="mnx-infinite-canvas ${state.canvas.grid ? "has-grid" : ""}" data-mnx-canvas style="--canvas-zoom:${zoom}">
          <div class="mnx-canvas-world">${state.canvas.frames.map((frame) => `<article class="mnx-artboard ${state.canvas.selectedId === frame.id ? "is-selected" : ""}" data-canvas-id="${frame.id}" style="left:${frame.x}px;top:${frame.y}px;width:${frame.width}px;height:${frame.height}px"><header><strong>${escapeHtml(frame.name)}</strong><span>${frame.width}×${frame.height}${frame.readyForDev ? " · DEV" : ""}</span></header>${state.canvas.nodes.filter((node) => node.frameId === frame.id).map((node) => `<button type="button" class="mnx-canvas-node" data-canvas-node-id="${node.id}" data-type="${node.type}" style="left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px"><small>${escapeHtml(node.type)}</small><strong>${escapeHtml(node.content || node.name)}</strong></button>`).join("")}</article>`).join("")}</div>
          <aside class="mnx-minimap">${state.canvas.frames.map((frame) => `<i style="left:${Math.max(0, frame.x / 20)}px;top:${Math.max(0, frame.y / 20)}px;width:${Math.max(8, frame.width / 20)}px;height:${Math.max(6, frame.height / 20)}px"></i>`).join("")}</aside>
        </div>
      </section>
      <aside class="mnx-canvas-inspector"><small>UNIVERSAL INSPECTOR</small>${(() => { const selected = state.canvas.nodes.find((item) => item.id === state.canvas.selectedId) || state.canvas.frames.find((item) => item.id === state.canvas.selectedId); return selected ? `<h3>${escapeHtml(selected.name)}</h3><label>X<input data-mnx-inspect="x" type="number" value="${selected.x}"></label><label>Y<input data-mnx-inspect="y" type="number" value="${selected.y}"></label><label>Width<input data-mnx-inspect="width" type="number" value="${selected.width}"></label><label>Height<input data-mnx-inspect="height" type="number" value="${selected.height}"></label><button type="button" data-mnx-delete-canvas>Xóa</button>` : "<p>Chọn frame hoặc layer trên canvas.</p>"; })()}</aside>
    </div>`;
  }

  function aiMarkup(state) {
    const tasks = [...state.cloud.aiTasks, ...state.ai.tasks].slice(-20).reverse();
    const caps = state.cloud.capabilities;
    return `<div class="mnx-grid">
      <section class="mnx-card mnx-card--wide"><header><div><small>CONTROLLED GENERATION</small><h3>AI Task Composer</h3></div><span data-ready="${Boolean(caps?.aiWorker)}">${caps?.aiWorker ? "PROVIDER ONLINE" : "CẦN ADAPTER"}</span></header>
        <form class="mnx-ai-form" data-mnx-ai-form><label>Provider<select name="provider"><option value="media-ai">Media AI Router</option><option value="firefly">Adobe Firefly adapter</option><option value="openai">OpenAI image adapter</option><option value="custom">Custom provider</option></select></label><label>Model<input name="model" value="default" maxlength="100"></label><label>Operation<select name="operation"><option value="generate-image">Generate Image</option><option value="generative-fill">Generative Fill</option><option value="expand">Expand</option><option value="harmonize">Harmonize</option><option value="upscale">Upscale</option><option value="generate-video">Generate Video</option><option value="sound-effect">Sound Effect</option></select></label><label>Seed<input name="seed" type="number" min="0" value="0"></label><label>Variations<input name="variations" type="number" min="1" max="6" value="3"></label><label class="mnx-ai-prompt">Prompt<textarea name="prompt" maxlength="4000" required placeholder="Mô tả kết quả cần tạo…"></textarea></label><label class="mnx-ai-prompt">Negative prompt<textarea name="negativePrompt" maxlength="2000" placeholder="Những yếu tố cần tránh…"></textarea></label><fieldset><legend>Khóa thuộc tính</legend>${["subject", "palette", "typography", "composition", "camera", "duration"].map((lock) => `<label><input type="checkbox" name="locks" value="${lock}">${lock}</label>`).join("")}</fieldset><label class="mnx-ai-consent"><input type="checkbox" name="licenseAccepted" required> Tôi xác nhận có quyền sử dụng reference, giọng và asset đầu vào.</label><button type="submit" class="mnx-primary">Tạo AI Task</button></form>
      </section>
      <section class="mnx-card mnx-card--wide"><header><div><small>PROVENANCE QUEUE</small><h3>Preview → Apply → Undo</h3></div><b>${tasks.length} task</b></header><div class="mnx-task-list">${tasks.map((task) => `<article data-status="${task.status}"><span>AI</span><div><strong>${escapeHtml(task.name || task.operation)}</strong><small>${escapeHtml(task.spec?.model || task.model || "model chưa xác nhận")} · seed ${task.spec?.seed ?? task.seed ?? 0} · ${task.spec?.variations ?? task.variations ?? 1} variation</small></div><b>${escapeHtml(statusLabel(task.status))}</b><em>${task.cost ? escapeHtml(`${task.cost.amount} ${task.cost.currency}`) : "Chưa ghi nhận chi phí"}</em></article>`).join("") || `<p class="mnx-empty">Chưa có AI Task.</p>`}</div><p class="mnx-honest">Output chỉ được gắn vào Universal Project khi provider trả asset hợp lệ. Không có task nào tự ghi đè layer hoặc clip nguồn.</p></section>
    </div>`;
  }

  function devMarkup(state) {
    const frame = state.canvas.frames.find((item) => item.id === state.dev.selectedFrameId) || state.canvas.frames[0];
    const node = state.canvas.nodes.find((item) => item.frameId === frame?.id) || state.canvas.nodes[0];
    const snippet = buildDevSnippet(node, frame, state.dev.format);
    return `<div class="mnx-grid">
      <section class="mnx-card"><header><div><small>READY FOR DEV</small><h3>Frame status</h3></div><b>${state.canvas.frames.filter((item) => item.readyForDev).length}/${state.canvas.frames.length}</b></header><div class="mnx-frame-list">${state.canvas.frames.map((item) => `<label><input type="radio" name="dev-frame" value="${item.id}" ${item.id === frame?.id ? "checked" : ""}><span>${escapeHtml(item.name)}</span><button type="button" data-mnx-ready-frame="${item.id}">${item.readyForDev ? "Ready ✓" : "Mark ready"}</button></label>`).join("")}</div><label>Storybook / code component URL<input type="url" data-mnx-storybook value="${escapeHtml(state.dev.storybookUrl)}" placeholder="https://storybook.example.com/..."></label></section>
      <section class="mnx-card"><header><div><small>INSPECT</small><h3>${escapeHtml(node?.name || "Layer")}</h3></div><select data-mnx-dev-format><option value="css">CSS</option><option value="react">React</option><option value="svg">SVG</option><option value="json">JSON</option></select></header><div class="mnx-inspect-grid"><span>X<b>${node?.x || 0}</b></span><span>Y<b>${node?.y || 0}</b></span><span>W<b>${node?.width || 0}</b></span><span>H<b>${node?.height || 0}</b></span></div><p>Token: <b>${escapeHtml(node?.token || "raw value")}</b></p><pre data-mnx-snippet>${escapeHtml(snippet)}</pre><button type="button" data-mnx-copy-snippet>Sao chép code</button></section>
      <section class="mnx-card mnx-card--wide"><header><div><small>IMPLEMENTATION COMPARE</small><h3>Design ↔ Screenshot</h3></div><label>Overlay <input type="range" min="0" max="100" value="${state.dev.compareOpacity}" data-mnx-dev-opacity></label></header><label class="mnx-drop">Chọn screenshot triển khai<input type="file" accept="image/*" data-mnx-dev-screenshot><span>Ảnh chỉ dùng trong phiên hiện tại và không tự upload.</span></label><div class="mnx-dev-compare" style="--opacity:${state.dev.compareOpacity / 100}"><div><strong>${escapeHtml(frame?.name || "Design")}</strong><span>${frame?.width || 0}×${frame?.height || 0}</span></div><img data-mnx-dev-image alt="Screenshot triển khai" hidden></div></section>
      <section class="mnx-card mnx-card--wide"><header><div><small>EXPORT MATRIX</small><h3>1x · 2x · 3x · token package</h3></div></header><div class="mnx-export-matrix">${[1, 2, 3].map((scale) => `<button type="button" data-mnx-export-scale="${scale}">${scale}x<br><small>${Math.round((frame?.width || 0) * scale)}×${Math.round((frame?.height || 0) * scale)}</small></button>`).join("")}<button type="button" data-mnx-export-handoff>Xuất handoff JSON</button></div></section>
    </div>`;
  }

  function workspaceMarkup(workspace, state, runtime = {}) {
    if (workspace.id === "review-studio" && runtime.shareToken) return sharedReviewMarkup(state, runtime.shareMeta, runtime.sharePasswordRequired);
    if (workspace.id === "media-cloud") return cloudMarkup(state);
    if (workspace.id === "review-studio") return reviewMarkup(state);
    if (workspace.id === "motion-compositor") return motionMarkup(state);
    if (workspace.id === "universal-canvas") return canvasMarkup(state);
    if (workspace.id === "ai-task-center") return aiMarkup(state);
    return devMarkup(state);
  }

  function download(name, content, type = "application/json") {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function mount(host, options = {}) {
    if (!host) return null;
    unmount(host);
    const controller = new AbortController();
    const store = createStateStore(options.storage);
    let state = store.load();
    const workspace = WORKSPACE_BY_ID[options.workspace || options.toolId] || WORKSPACE_BY_ID[state.lastWorkspace] || WORKSPACES[0];
    const files = new Map();
    const uploads = new Map();
    const objectUrls = new Set();
    let trash = false;
    let drag = null;
    let drawing = null;
    const shareToken = workspace.id === "review-studio" ? clean(new URLSearchParams(String(globalScope.location?.hash || "").split("?")[1] || "").get("mediaShare"), 200) : "";
    let shareMeta = null;
    let sharePasswordRequired = false;
    state.lastWorkspace = workspace.id;

    const save = () => { state.updatedAt = now(); state = store.save(state); };
    const navigate = (route) => typeof options.onNavigate === "function" ? options.onNavigate(route) : (globalScope.location.hash = `#${route}`);
    const notify = (message, tone = "success") => {
      const node = host.querySelector("[data-mnx-toast]");
      if (!node) return;
      node.textContent = message; node.dataset.tone = tone; node.hidden = false;
      clearTimeout(notify.timer); notify.timer = setTimeout(() => { if (node.isConnected) node.hidden = true; }, 3600);
    };
    const render = () => {
      host.innerHTML = `<section class="media-next-suite" data-mnx style="--accent:${workspace.color}" data-workspace="${workspace.id}">
        <div class="mnx-space" aria-hidden="true"><i></i><i></i><i></i></div>
        <header class="mnx-hero"><div><span>${workspace.code}</span><section><small>HH MEDIA DESIGN · NEXT GENERATION</small><h2>${escapeHtml(workspace.title)}</h2><p>${escapeHtml(workspace.summary)}</p></section></div><aside><b data-status="${state.cloud.status}">${escapeHtml(statusLabel(state.cloud.status))}</b><span>${state.activeProjectId ? `Project ${escapeHtml(state.activeProjectId.slice(-6))}` : "Local-first project"}</span></aside></header>
        ${navMarkup(workspace)}
        <main class="mnx-work">${workspaceMarkup(workspace, state, { shareToken, shareMeta, sharePasswordRequired })}</main>
        <footer class="mnx-footer"><span><i></i> ${SCHEMA} · dữ liệu nhạy cảm không nằm trong client</span><button type="button" data-mnx-route="/media-design">Galaxy Command Center</button></footer>
        <div class="mnx-toast" data-mnx-toast role="status" aria-live="polite" hidden></div>
      </section>`;
      if (workspace.id === "review-studio") {
        const select = host.querySelector("[data-mnx-compare-mode]"); if (select) select.value = state.review.compare.mode;
      }
      if (workspace.id === "dev-handoff") {
        const select = host.querySelector("[data-mnx-dev-format]"); if (select) select.value = state.dev.format;
      }
    };
    const mutateCloud = (data) => {
      state.cloud = {
        ...state.cloud,
        ...data,
        status: "ready",
        projects: data.projects || state.cloud.projects,
        project: data.project || state.cloud.project,
        assets: data.assets || [],
        reviews: data.reviews || [],
        jobs: data.jobs || [],
        aiTasks: data.aiTasks || [],
        audit: data.audit || [],
        usage: data.usage || state.cloud.usage,
        capabilities: data.capabilities || state.cloud.capabilities,
        lastSyncAt: now()
      };
      if (!state.activeProjectId && data.project?.id) state.activeProjectId = data.project.id;
      save();
    };
    const sync = async (quiet = false) => {
      state.cloud.status = "loading"; render();
      try {
        const query = new URLSearchParams({ ...(state.activeProjectId ? { projectId: state.activeProjectId } : {}), ...(trash ? { trash: "1" } : {}) });
        const data = await request(apiUrl(query.toString()));
        mutateCloud(data); render(); if (!quiet) notify("Media Cloud đã đồng bộ.", "success");
      } catch (error) {
        state.cloud.status = error.status === 401 ? "local" : "error";
        state.cloud.capabilities = error.data?.capabilities || state.cloud.capabilities;
        save(); render(); if (!quiet) notify(error.message, "warning");
      }
    };
    const syncShare = async (password = "") => {
      state.cloud.status = "loading"; render();
      try {
        const data = password
          ? await request(apiUrl(), { method: "POST", body: JSON.stringify({ action: "review:access-link", shareToken, password }) })
          : await request(apiUrl(`shareToken=${encodeURIComponent(shareToken)}`));
        shareMeta = data.share || null;
        sharePasswordRequired = false;
        state.activeProjectId = data.share?.projectId || "";
        state.cloud = { ...state.cloud, status: "ready", reviews: data.reviews || [], project: null, lastSyncAt: now() };
        save(); render();
      } catch (error) {
        sharePasswordRequired = ["SHARE_PASSWORD_REQUIRED", "SHARE_PASSWORD_INVALID"].includes(error.code);
        state.cloud.status = sharePasswordRequired ? "local" : "error";
        render();
        if (!sharePasswordRequired) notify(error.message, "error");
        else if (password) notify("Mật khẩu review không đúng.", "warning");
      }
    };
    const post = async (action, payload = {}) => {
      const data = await request(apiUrl(), { method: "POST", body: JSON.stringify({ action, projectId: state.activeProjectId, ...payload }) });
      return data;
    };
    const updateUpload = (jobId, patch) => {
      const job = state.uploads.find((item) => item.id === jobId);
      if (job) Object.assign(job, patch);
      save(); render();
    };
    const startUpload = async (jobId) => {
      const job = state.uploads.find((item) => item.id === jobId);
      const file = files.get(jobId);
      if (!job || !file || !state.activeProjectId) return notify("Hãy chọn Cloud Project trước khi upload.", "warning");
      if (!globalScope.HHVercelBlobClient?.upload) return updateUpload(jobId, { status: "failed", message: "Vercel Blob client chưa tải." });
      const abort = new AbortController();
      uploads.set(jobId, abort);
      updateUpload(jobId, { status: "uploading", message: file.size > 100 * 1024 * 1024 ? "Multipart upload" : "Direct upload" });
      try {
        const fileChecksum = job.checksum || await checksum(file, abort.signal);
        job.checksum = fileChecksum;
        const pathname = `media/${state.activeProjectId}/${crypto.randomUUID?.() || uid("upload")}-${safeFileName(file.name)}`;
        const blob = await globalScope.HHVercelBlobClient.upload(pathname, file, {
          access: "private",
          handleUploadUrl: apiUrl("action=blob-upload"),
          multipart: file.size > 100 * 1024 * 1024,
          contentType: file.type || "application/octet-stream",
          clientPayload: JSON.stringify({ projectId: state.activeProjectId, uploadSessionId: job.id, name: file.name, mimeType: file.type || "application/octet-stream", size: file.size, checksum: fileChecksum, license: job.license || "", consentId: job.consentId || "" }),
          abortSignal: abort.signal,
          onUploadProgress: (progress) => updateUpload(jobId, { progress: Math.round(progress.percentage), status: "uploading" })
        });
        await post("asset:register", { blob, uploadSessionId: job.id, name: file.name, mimeType: file.type, size: file.size, checksum: fileChecksum, license: job.license || "", consentId: job.consentId || "" });
        updateUpload(jobId, { progress: 100, status: "completed", message: "Blob và metadata đã xác minh." });
        await sync(true);
      } catch (error) {
        const paused = abort.signal.aborted && job.status === "paused";
        updateUpload(jobId, { status: paused ? "paused" : "failed", message: paused ? "Đã tạm dừng; Resume sẽ upload lại an toàn." : clean(error.message, 240, "Upload thất bại.") });
      } finally {
        uploads.delete(jobId);
      }
    };
    const loadPreview = async (side, assetId) => {
      const target = host.querySelector(`[data-mnx-preview="${side}"]`);
      const asset = state.cloud.assets.find((item) => item.id === assetId);
      if (!target || !asset) return;
      target.innerHTML = "<span>Đang tạo signed URL…</span>";
      try {
        const data = await post("asset:download-link", { assetId, ttlMs: 10 * 60 * 1000 });
        const tag = asset.mimeType.startsWith("image/") ? `<img src="${escapeHtml(data.url)}" alt="${escapeHtml(asset.name)}">` : asset.mimeType.startsWith("video/") ? `<video src="${escapeHtml(data.url)}" controls muted></video>` : `<audio src="${escapeHtml(data.url)}" controls></audio>`;
        target.innerHTML = `${tag}<b>${escapeHtml(asset.name)}</b>`;
      } catch (error) { target.innerHTML = `<span>${escapeHtml(error.message)}</span>`; }
    };

    host.addEventListener("click", async (event) => {
      const route = event.target.closest("[data-mnx-route]"); if (route) return navigate(route.dataset.mnxRoute);
      if (event.target.closest("[data-mnx-refresh]")) return sync();
      if (event.target.closest("[data-mnx-trash-view]")) { trash = !trash; return sync(); }
      const uploadAction = event.target.closest("[data-mnx-upload-action]");
      if (uploadAction) {
        const jobId = uploadAction.dataset.uploadId, action = uploadAction.dataset.mnxUploadAction;
        if (action === "pause") { const job = state.uploads.find((item) => item.id === jobId); if (job) job.status = "paused"; uploads.get(jobId)?.abort(); save(); render(); return; }
        if (action === "cancel") { uploads.get(jobId)?.abort(); updateUpload(jobId, { status: "canceled", message: "Đã hủy trong phiên này." }); return; }
        if (action === "resume") return startUpload(jobId);
      }
      const assetAction = event.target.closest("[data-mnx-asset-action]");
      if (assetAction) {
        try {
          if (assetAction.dataset.mnxAssetAction === "download") {
            const data = await post("asset:download-link", { assetId: assetAction.dataset.assetId });
            window.open(data.url, "_blank", "noopener,noreferrer");
          } else {
            await post("asset:trash", { assetId: assetAction.dataset.assetId }); await sync(true); notify("Asset đã chuyển vào Trash 30 ngày.");
          }
        } catch (error) { notify(error.message, "error"); }
        return;
      }
      const renderAction = event.target.closest("[data-mnx-render-action]");
      if (renderAction) {
        try {
          await post(`render:${renderAction.dataset.mnxRenderAction}`, { jobId: renderAction.dataset.jobId });
          await sync(true);
          notify(`Render job: ${renderAction.dataset.mnxRenderAction}.`);
        } catch (error) { notify(error.message, "error"); }
        return;
      }
      if (event.target.closest("[data-mnx-load-compare]")) {
        const left = host.querySelector("[data-mnx-compare-left]")?.value, right = host.querySelector("[data-mnx-compare-right]")?.value;
        state.review.compare.leftAssetId = left; state.review.compare.rightAssetId = right; save();
        await Promise.all([loadPreview("left", left), loadPreview("right", right)]); return;
      }
      const reviewResolve = event.target.closest("[data-mnx-review-resolve]");
      if (reviewResolve) {
        try {
          if (state.activeProjectId && state.cloud.status === "ready") { await post("review:resolve", { reviewId: reviewResolve.dataset.mnxReviewResolve }); await sync(true); }
          else { const item = state.review.localComments.find((comment) => comment.id === reviewResolve.dataset.mnxReviewResolve); if (item) item.status = "resolved"; save(); }
          render();
        } catch (error) { notify(error.message, "error"); }
        return;
      }
      const reviewStatus = event.target.closest("[data-mnx-review-status]");
      if (reviewStatus) {
        try {
          if (state.activeProjectId && state.cloud.status === "ready") { await post("review:set-status", { status: reviewStatus.dataset.mnxReviewStatus }); await sync(true); }
          else { state.review.localStatus = reviewStatus.dataset.mnxReviewStatus; save(); }
          render();
        } catch (error) { notify(error.message, "error"); }
        return;
      }
      const drawingTool = event.target.closest("[data-mnx-drawing-tool]");
      if (drawingTool) { state.review.drawing.tool = drawingTool.dataset.mnxDrawingTool; save(); render(); return; }
      const addMotion = event.target.closest("[data-mnx-add-motion]");
      if (addMotion) { state = addMotionNode(state, addMotion.dataset.mnxAddMotion); save(); render(); return; }
      const toggleMotion = event.target.closest("[data-mnx-toggle-motion]");
      if (toggleMotion) { const node = state.motion.nodes.find((item) => item.id === toggleMotion.dataset.mnxToggleMotion); if (node) node.enabled = !node.enabled; save(); render(); return; }
      if (event.target.closest("[data-mnx-cache-node]")) { state.motion.cache.push({ id: uid("cache"), graphHash: state.motion.nodes.map((item) => `${item.id}:${item.enabled}`).join("|"), status: "manifest-only", createdAt: now() }); save(); render(); notify("Đã tạo cache manifest; chưa báo render hoàn tất."); return; }
      const frame = event.target.closest("[data-mnx-frame]");
      if (frame) { state = createCanvasFrame(state, frame.dataset.mnxFrame); save(); render(); return; }
      const canvasNode = event.target.closest("[data-mnx-canvas-node]");
      if (canvasNode) {
        const targetFrame = state.canvas.frames.find((item) => item.id === state.canvas.selectedId) || state.canvas.frames[0];
        if (!targetFrame) return;
        const type = canvasNode.dataset.mnxCanvasNode;
        state.canvas.nodes.push({ id: uid("canvas-node"), frameId: targetFrame.id, type, name: `${type} layer`, x: 30 + state.canvas.nodes.length * 8, y: 40 + state.canvas.nodes.length * 6, width: type === "text" ? 240 : 160, height: type === "text" ? 58 : 120, content: type === "text" ? "New cosmic headline" : type, token: "color.brand.primary" });
        save(); render(); return;
      }
      if (event.target.closest("[data-mnx-canvas-grid]")) { state.canvas.grid = !state.canvas.grid; save(); render(); return; }
      if (event.target.closest("[data-mnx-canvas-snap]")) { state.canvas.snap = !state.canvas.snap; save(); render(); return; }
      if (event.target.closest("[data-mnx-delete-canvas]")) { state.canvas.nodes = state.canvas.nodes.filter((item) => item.id !== state.canvas.selectedId); state.canvas.frames = state.canvas.frames.filter((item) => item.id !== state.canvas.selectedId); state.canvas.selectedId = ""; save(); render(); return; }
      const readyFrame = event.target.closest("[data-mnx-ready-frame]");
      if (readyFrame) { const item = state.canvas.frames.find((frameItem) => frameItem.id === readyFrame.dataset.mnxReadyFrame); if (item) item.readyForDev = !item.readyForDev; save(); render(); return; }
      if (event.target.closest("[data-mnx-copy-snippet]")) {
        const value = host.querySelector("[data-mnx-snippet]")?.textContent || "";
        navigator.clipboard?.writeText(value).then(() => notify("Đã sao chép code.")).catch(() => notify("Trình duyệt chưa cho phép Clipboard.", "warning")); return;
      }
      const scale = event.target.closest("[data-mnx-export-scale]");
      if (scale) { const frameItem = state.canvas.frames.find((item) => item.id === state.dev.selectedFrameId) || state.canvas.frames[0]; download(`hh-${scale.dataset.mnxExportScale}x-recipe.json`, JSON.stringify({ frame: frameItem, scale: Number(scale.dataset.mnxExportScale), status: "export-recipe", rendered: false }, null, 2)); return; }
      if (event.target.closest("[data-mnx-export-handoff]")) { download("hh-media-handoff.json", JSON.stringify({ schema: "hh.media.handoff.v1", frames: state.canvas.frames, nodes: state.canvas.nodes, storybookUrl: state.dev.storybookUrl, exportedAt: now() }, null, 2)); return; }
    }, { signal: controller.signal });

    host.addEventListener("submit", async (event) => {
      const form = event.target;
      if (form.matches("[data-mnx-project-form]")) {
        event.preventDefault();
        try { const data = await request(apiUrl(), { method: "POST", body: JSON.stringify({ action: "project:create", name: new FormData(form).get("name") }) }); state.activeProjectId = data.project.id; await sync(true); notify("Đã tạo Cloud Project."); } catch (error) { notify(error.message, "error"); }
        return;
      }
      if (form.matches("[data-mnx-member-form]")) {
        event.preventDefault(); const data = new FormData(form);
        try { await post("member:set-role", { email: data.get("email"), role: data.get("role") }); await sync(true); notify("Đã cập nhật quyền thành viên."); } catch (error) { notify(error.message, "error"); }
        return;
      }
      if (form.matches("[data-mnx-review-form]")) {
        event.preventDefault(); const data = new FormData(form);
        const local = { id: uid("review"), body: clean(data.get("comment"), 1500), anchor: { type: clean(data.get("type"), 20), frame: number(data.get("frame")) }, author: { name: "Local reviewer" }, status: "open", createdAt: now() };
        try {
          if (state.activeProjectId && state.cloud.status === "ready") { await post("review:create", { comment: local.body, anchor: local.anchor }); await sync(true); }
          else { state.review.localComments.unshift(local); save(); }
          render();
        } catch (error) { notify(error.message, "error"); }
        return;
      }
      if (form.matches("[data-mnx-share-form]")) {
        event.preventDefault(); const data = new FormData(form);
        try {
          const response = await post("review:create-link", { password: data.get("password"), ttlMs: Number(data.get("ttl")), canDownload: data.get("download") === "on" });
          const url = `${location.origin}${location.pathname}#/media-design/review-studio?mediaShare=${encodeURIComponent(response.token)}`;
          const node = host.querySelector("[data-mnx-share-result]"); if (node) node.textContent = `Link hết hạn ${new Date(response.expiresAt).toLocaleString("vi-VN")}: ${url}`;
        } catch (error) { notify(error.message, "error"); }
        return;
      }
      if (form.matches("[data-mnx-share-access]")) {
        event.preventDefault();
        await syncShare(clean(new FormData(form).get("password"), 120));
        return;
      }
      if (form.matches("[data-mnx-render-form]")) {
        event.preventDefault();
        const data = new FormData(form);
        try {
          await post("render:create", {
            name: data.get("name"),
            priority: number(data.get("priority")),
            idempotencyKey: globalScope.crypto?.randomUUID?.() || uid("render"),
            spec: {
              preset: data.get("preset"),
              codec: data.get("codec"),
              width: number(data.get("width"), 1920),
              height: number(data.get("height"), 1080),
              fps: number(data.get("fps"), 30),
              manifest: true,
              hardwarePreferred: true,
              sourceAssetIds: state.cloud.assets.filter((asset) => asset.status === "ready").slice(0, 50).map((asset) => asset.id)
            }
          });
          form.reset();
          await sync(true);
          notify(state.cloud.capabilities?.renderWorker ? "External worker đã nhận render job." : "Đã lưu job; cần cấu hình external worker để render.");
        } catch (error) { notify(error.message, "error"); }
        return;
      }
      if (form.matches("[data-mnx-keyframe-form]")) {
        event.preventDefault(); const data = new FormData(form);
        state.motion.keyframes.push({ id: uid("keyframe"), property: clean(data.get("property"), 40), time: clamp(data.get("time"), 0, 86400), value: clamp(data.get("value"), -10000, 10000), easing: "ease-in-out" }); save(); render(); return;
      }
      if (form.matches("[data-mnx-ai-form]")) {
        event.preventDefault(); const data = new FormData(form);
        const task = createAiTaskDraft({ provider: data.get("provider"), model: data.get("model"), operation: data.get("operation"), prompt: data.get("prompt"), negativePrompt: data.get("negativePrompt"), seed: data.get("seed"), variations: data.get("variations"), locks: data.getAll("locks"), licenseAccepted: data.get("licenseAccepted") === "on" });
        if (!task.prompt || !task.licenseAccepted) return notify("Prompt và xác nhận quyền sử dụng là bắt buộc.", "warning");
        try {
          if (state.activeProjectId && state.cloud.status === "ready") { await post("ai:create", { name: task.name, spec: task }); await sync(true); }
          else { task.status = "needs-adapter"; state.ai.tasks.push(task); save(); }
          render(); notify(task.status === "needs-adapter" ? "Đã lưu task; chưa thay đổi project vì thiếu provider." : "AI worker đã nhận task.");
        } catch (error) { notify(error.message, "error"); }
      }
    }, { signal: controller.signal });

    host.addEventListener("change", async (event) => {
      if (event.target.matches("[data-mnx-project-select]")) { state.activeProjectId = event.target.value; save(); return sync(true); }
      if (event.target.matches("[data-mnx-cloud-files]")) {
        for (const file of [...(event.target.files || [])]) {
          const job = { id: uid("upload"), name: file.name, size: file.size, type: file.type, progress: 0, status: "paused", message: "Đang chờ upload", checksum: "", createdAt: now() };
          state.uploads.push(job); files.set(job.id, file); save(); startUpload(job.id);
        }
        return;
      }
      if (event.target.matches("[data-mnx-compare-mode]")) { state.review.compare.mode = event.target.value; save(); render(); return; }
      if (event.target.matches("[data-mnx-linked]")) { state.review.compare.linked = event.target.checked; save(); return; }
      if (event.target.matches("[data-mnx-drawing-color]")) { state.review.drawing.color = event.target.value; save(); return; }
      if (event.target.matches("[data-mnx-audio-reactive]")) { state.motion.audioReactive = event.target.checked; save(); render(); return; }
      if (event.target.matches("[data-mnx-dev-format]")) { state.dev.format = event.target.value; save(); render(); return; }
      if (event.target.matches('input[name="dev-frame"]')) { state.dev.selectedFrameId = event.target.value; save(); render(); return; }
      if (event.target.matches("[data-mnx-storybook]")) { state.dev.storybookUrl = clean(event.target.value, 500); save(); return; }
      if (event.target.matches("[data-mnx-dev-screenshot]")) {
        const file = event.target.files?.[0]; if (!file) return;
        objectUrls.forEach((url) => URL.revokeObjectURL(url)); objectUrls.clear();
        const url = URL.createObjectURL(file); objectUrls.add(url); state.dev.screenshotName = file.name; save();
        const image = host.querySelector("[data-mnx-dev-image]"); if (image) { image.src = url; image.hidden = false; }
      }
    }, { signal: controller.signal });

    host.addEventListener("input", (event) => {
      if (event.target.matches("[data-mnx-compare-slider]")) { state.review.compare.slider = clamp(event.target.value, 0, 100); const viewer = host.querySelector(".mnx-compare"); if (viewer) viewer.style.setProperty("--compare", `${state.review.compare.slider}%`); save(); return; }
      if (event.target.matches("[data-mnx-camera]")) { state.motion.camera[event.target.dataset.mnxCamera] = number(event.target.value); save(); return; }
      if (event.target.matches("[data-mnx-canvas-zoom]")) { state.canvas.zoom = clamp(event.target.value, 25, 150); const world = host.querySelector("[data-mnx-canvas]"); if (world) world.style.setProperty("--canvas-zoom", state.canvas.zoom / 100); event.target.nextElementSibling.textContent = `${state.canvas.zoom}%`; save(); return; }
      if (event.target.matches("[data-mnx-inspect]")) {
        const selected = state.canvas.nodes.find((item) => item.id === state.canvas.selectedId) || state.canvas.frames.find((item) => item.id === state.canvas.selectedId);
        if (selected) selected[event.target.dataset.mnxInspect] = clamp(event.target.value, -5000, 10000);
        save(); return;
      }
      if (event.target.matches("[data-mnx-dev-opacity]")) { state.dev.compareOpacity = clamp(event.target.value, 0, 100); const viewer = host.querySelector(".mnx-dev-compare"); if (viewer) viewer.style.setProperty("--opacity", state.dev.compareOpacity / 100); save(); }
    }, { signal: controller.signal });

    host.addEventListener("pointerdown", (event) => {
      const canvasNode = event.target.closest("[data-canvas-node-id]");
      const frame = event.target.closest("[data-canvas-id]");
      if (canvasNode) {
        event.preventDefault(); const item = state.canvas.nodes.find((node) => node.id === canvasNode.dataset.canvasNodeId);
        state.canvas.selectedId = item.id; drag = { type: "node", id: item.id, startX: event.clientX, startY: event.clientY, x: item.x, y: item.y, element: canvasNode }; canvasNode.setPointerCapture?.(event.pointerId); save(); return;
      }
      if (frame && event.target.closest("header")) {
        const item = state.canvas.frames.find((frameItem) => frameItem.id === frame.dataset.canvasId);
        state.canvas.selectedId = item.id; drag = { type: "frame", id: item.id, startX: event.clientX, startY: event.clientY, x: item.x, y: item.y, element: frame }; frame.setPointerCapture?.(event.pointerId); save(); return;
      }
      const annotation = event.target.closest("[data-mnx-annotation]");
      if (annotation) {
        const rect = annotation.getBoundingClientRect(); drawing = { points: [{ x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }], canvas: annotation, pointerId: event.pointerId };
        annotation.setPointerCapture?.(event.pointerId);
      }
    }, { signal: controller.signal });

    host.addEventListener("pointermove", (event) => {
      if (drag) {
        const scale = state.canvas.zoom / 100;
        const x = drag.x + (event.clientX - drag.startX) / scale, y = drag.y + (event.clientY - drag.startY) / scale;
        drag.element.style.left = `${state.canvas.snap ? Math.round(x / 8) * 8 : x}px`; drag.element.style.top = `${state.canvas.snap ? Math.round(y / 8) * 8 : y}px`; return;
      }
      if (drawing) {
        const rect = drawing.canvas.getBoundingClientRect();
        drawing.points.push({ x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) });
        const context = drawing.canvas.getContext("2d"); context.clearRect(0, 0, drawing.canvas.width, drawing.canvas.height); context.strokeStyle = state.review.drawing.color; context.lineWidth = 4; context.beginPath(); drawing.points.forEach((point, index) => { const x = point.x * drawing.canvas.width, y = point.y * drawing.canvas.height; index ? context.lineTo(x, y) : context.moveTo(x, y); }); context.stroke();
      }
    }, { signal: controller.signal });

    host.addEventListener("pointerup", async () => {
      if (drag) {
        const item = drag.type === "node" ? state.canvas.nodes.find((node) => node.id === drag.id) : state.canvas.frames.find((frame) => frame.id === drag.id);
        if (item) { item.x = number(parseFloat(drag.element.style.left)); item.y = number(parseFloat(drag.element.style.top)); }
        drag = null; save(); render(); return;
      }
      if (drawing) {
        const annotation = { tool: state.review.drawing.tool, color: state.review.drawing.color, points: drawing.points.slice(0, 500) };
        drawing = null;
        const local = { id: uid("review"), body: `Annotation ${annotation.tool}`, anchor: { type: "pixel", x: annotation.points[0]?.x || 0, y: annotation.points[0]?.y || 0 }, annotation, author: { name: "Local reviewer" }, status: "open", createdAt: now() };
        try {
          if (state.activeProjectId && state.cloud.status === "ready") { await post("review:create", { comment: local.body, anchor: local.anchor, annotation }); await sync(true); }
          else { state.review.localComments.unshift(local); save(); }
        } catch (error) { notify(error.message, "error"); }
        render();
      }
    }, { signal: controller.signal });

    render();
    active.set(host, { controller, uploads, objectUrls });
    if (shareToken) syncShare();
    else sync(true);
    return Object.freeze({ getState: () => clone(state), getWorkspace: () => workspace.id, sync, unmount: () => unmount(host) });
  }

  function unmount(host) {
    const entries = host ? [[host, active.get(host)]] : [...active.entries()];
    entries.forEach(([node, instance]) => {
      if (!instance) return;
      instance.controller.abort();
      instance.uploads.forEach((controller) => controller.abort());
      instance.objectUrls.forEach((url) => URL.revokeObjectURL(url));
      node.innerHTML = "";
      active.delete(node);
    });
  }

  return Object.freeze({
    SCHEMA, STATE_KEY, VERSION, WORKSPACES, WORKSPACE_BY_ID,
    escapeHtml, normalizeState, createStateStore, createCanvasFrame, addMotionNode,
    createAiTaskDraft, buildDevSnippet, createStreamingSha256, mount, unmount
  });
});
