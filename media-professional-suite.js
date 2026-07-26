((factory) => {
  const scope = typeof window !== "undefined" ? window : globalThis;
  const api = factory(scope);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.HHMediaProfessionalSuite = api;
})((globalScope) => {
  "use strict";

  const SCHEMA = "hh.media.professional.v1";
  const STATE_KEY = SCHEMA;
  const VERSION = 1;
  const WORKSPACES = Object.freeze([
    {
      id: "media-core", planet: "universal", code: "UP", title: "Universal Project Pro", color: "#56ecff",
      route: "/media-design/media-core", summary: "Media Graph, branch, recovery, review và quyền trong một nguồn dữ liệu.",
      capabilities: [
        ["Media Graph", "Source → proxy → timeline → version → output", "local"],
        ["Branch & Merge", "Nhánh thử nghiệm, checkpoint và lịch sử thay đổi", "local"],
        ["Crash Recovery", "Nhật ký khôi phục cục bộ có phiên bản", "local"],
        ["Team Roles & Locks", "Owner, editor, reviewer và khóa tài nguyên", "local"],
        ["Review & Rights", "Comment neo vị trí, consent, split và audit", "local"],
        ["Cloud Sync", "Cần adapter xác thực phía máy chủ", "adapter"]
      ]
    },
    {
      id: "photo-workspace", planet: "photo", code: "PI", title: "Photo & Image Pro", color: "#ff63d8",
      route: "/media-design/photo-workspace", summary: "Không gian ảnh nhiều lớp, không phá hủy, có preview và lịch sử rõ ràng.",
      capabilities: [
        ["Layer System", "Group, mask, clipping, smart object và adjustment layer", "local"],
        ["Selection Lab", "Marquee, lasso, magic select và refine edge", "editor"],
        ["Retouch & Scopes", "Heal, clone, histogram, curves và channel", "editor"],
        ["Actions & Snapshots", "Ghi thao tác, checkpoint và so sánh phiên bản", "local"],
        ["PSD Workflow", "Nhập/xuất tùy khả năng engine, không giả tương thích", "adapter"],
        ["Controlled AI", "Chỉ Preview → Apply → Undo; cần provider backend", "adapter"]
      ]
    },
    {
      id: "video-workspace", planet: "video", code: "VM", title: "Video & Motion Pro", color: "#a56cff",
      route: "/media-design/video-workspace", summary: "Dựng nhiều rãnh, color, audio, caption và motion trong quy trình thống nhất.",
      capabilities: [
        ["Source / Program", "In-Out, three-point edit, insert và overwrite", "local"],
        ["Trim & Timeline", "Ripple, roll, slip, slide, blade, nested sequence", "editor"],
        ["Motion & Fusion", "Keyframe graph, tracking, stabilization và node compositing", "editor"],
        ["Caption & Text Edit", "Transcript proposal, caption style và timecode", "local"],
        ["Color Management", "Scopes, LUT, color space và reference compare", "editor"],
        ["Audio Bus", "Submix, EQ, compressor, LUFS và True Peak", "editor"]
      ]
    },
    {
      id: "document-workspace", planet: "documents", code: "DU", title: "Documents & Utility Pro", color: "#55efd2",
      route: "/media-design/document-workspace", summary: "PDF, OCR, redaction, form, QR và chuyển đổi theo hàng đợi có kiểm chứng.",
      capabilities: [
        ["PDF Workspace", "Merge, split, rotate, watermark và metadata", "editor"],
        ["OCR & Search", "Nhận dạng, lớp text và xuất tài liệu có thể tìm kiếm", "adapter"],
        ["Redaction", "Che vĩnh viễn nội dung và xóa metadata nhạy cảm", "adapter"],
        ["Forms & Sign", "Field, validation, chữ ký và audit", "adapter"],
        ["PDF/A & Compare", "Preflight lưu trữ và so sánh thay đổi", "adapter"],
        ["Dynamic QR", "QR có version, expiry và analytics cần backend", "adapter"]
      ]
    },
    {
      id: "brand-workspace", planet: "brand", code: "BU", title: "Brand Universe Pro", color: "#ffbd59",
      route: "/media-design/brand-workspace", summary: "Brand kit đa thương hiệu, token có mode, lint và template có khóa.",
      capabilities: [
        ["Multi Brand Kit", "Nhiều nhãn hiệu, chiến dịch và thị trường", "local"],
        ["Design Tokens", "Color, type, spacing, radius và mode", "local"],
        ["Components", "Variant, state và thuộc tính có khóa", "local"],
        ["Brand Lint", "Contrast, font, logo safe-zone và token lệch chuẩn", "local"],
        ["Bulk & Localization", "CSV/JSON, locale và text overflow check", "local"],
        ["Developer Handoff", "Xuất CSS variables và JSON token", "local"]
      ]
    },
    {
      id: "asset-workspace", planet: "assets", code: "AG", title: "Asset Galaxy Pro", color: "#5c9dff",
      route: "/media-design/asset-workspace", summary: "Kho tài nguyên có checksum, license, collection và provenance.",
      capabilities: [
        ["Verified Ingest", "SHA-256, metadata và phát hiện file trùng", "local"],
        ["Preview & Proxy", "Thumbnail cục bộ; proxy nặng cần worker", "local"],
        ["Collections", "Tag, smart collection, rating và trạng thái", "local"],
        ["Fonts & LUT", "Theo dõi font, LUT, phiên bản và quyền", "local"],
        ["Private Cloud", "Vercel Blob private + signed URL cần server adapter", "adapter"],
        ["Semantic Search", "Embedding/vector search cần backend", "adapter"]
      ]
    },
    {
      id: "export-workspace", planet: "export", code: "EP", title: "Export & Publishing Pro", color: "#ffe36d",
      route: "/media-design/export-workspace", summary: "Preflight, codec recipe, queue, review và manifest phát hành.",
      capabilities: [
        ["Render Queue", "Priority, dependency, retry, cancel, duplicate", "local"],
        ["Idempotent Jobs", "Job spec và idempotency key ổn định", "local"],
        ["Codec Matrix", "Master, web, social, audio và image recipe", "local"],
        ["Adaptive Export", "16:9, 9:16, 1:1, thumbnail và Canvas", "local"],
        ["External Worker", "FFmpeg dài hạn chạy ngoài Vercel Functions", "adapter"],
        ["Manifest & C2PA", "Checksum, provenance và C2PA cần signer backend", "adapter"]
      ]
    }
  ]);
  const WORKSPACE_BY_ID = Object.freeze(Object.fromEntries(WORKSPACES.map((item) => [item.id, item])));
  const activeInstances = new Map();

  const now = () => new Date().toISOString();
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const clone = (value) => {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };
  const text = (value, max = 240, fallback = "") => String(value == null ? "" : value).trim().slice(0, max) || fallback;
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const escapeHtml = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const stableHash = (value) => {
    let hash = 2166136261;
    const input = String(value || "");
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  };

  function createDefaultState() {
    const createdAt = now();
    const projectId = uid("media-project");
    const branchId = uid("branch");
    return {
      schema: SCHEMA,
      version: VERSION,
      project: {
        id: projectId,
        name: "Universal Media Project",
        status: "active",
        activeBranchId: branchId,
        branches: [{ id: branchId, name: "main", head: "", createdAt }],
        checkpoints: [],
        recoveries: [],
        members: [{ id: "local-owner", name: "Chủ sở hữu thiết bị", role: "owner" }],
        locks: [],
        graph: {
          nodes: [{ id: projectId, type: "project", label: "Universal Media Project", createdAt }],
          edges: []
        },
        updatedAt: createdAt
      },
      review: { status: "draft", comments: [], audit: [{ id: uid("audit"), action: "project.created", actor: "local-owner", createdAt }] },
      rights: { splits: [{ id: uid("split"), owner: "Chủ sở hữu", percent: 100 }], consents: [], licenses: [] },
      photo: { snapshots: [], actions: [], aiProposals: [], activeDocument: "" },
      video: { sourceMarks: [], sequences: [], trackLocks: [], transcriptProposals: [], activeSequence: "" },
      documents: { jobs: [] },
      brand: {
        activeKitId: "kit-default",
        kits: [{ id: "kit-default", name: "HH Brand", modes: ["Default"], tokens: [
          { id: "brand-primary", name: "color.brand.primary", value: "#56ecff", type: "color" },
          { id: "brand-accent", name: "color.brand.accent", value: "#ff63d8", type: "color" }
        ], components: [], templateLocks: [] }]
      },
      assets: { items: [], collections: [], cloud: { status: "needs-adapter", provider: "Vercel Blob Private" } },
      export: { jobs: [], lastPreflight: null, worker: { status: "needs-adapter", provider: "External media worker" } },
      lastWorkspace: "media-core",
      updatedAt: createdAt
    };
  }

  function normalizeState(input) {
    const source = input && typeof input === "object" ? input : {};
    const base = createDefaultState();
    const state = {
      ...base,
      ...source,
      schema: SCHEMA,
      version: VERSION,
      project: { ...base.project, ...(source.project || {}) },
      review: { ...base.review, ...(source.review || {}) },
      rights: { ...base.rights, ...(source.rights || {}) },
      photo: { ...base.photo, ...(source.photo || {}) },
      video: { ...base.video, ...(source.video || {}) },
      documents: { ...base.documents, ...(source.documents || {}) },
      brand: { ...base.brand, ...(source.brand || {}) },
      assets: { ...base.assets, ...(source.assets || {}), cloud: { ...base.assets.cloud, ...(source.assets?.cloud || {}) } },
      export: { ...base.export, ...(source.export || {}), worker: { ...base.export.worker, ...(source.export?.worker || {}) } },
      lastWorkspace: WORKSPACE_BY_ID[source.lastWorkspace] ? source.lastWorkspace : "media-core",
      updatedAt: now()
    };
    state.project.name = text(state.project.name, 140, "Universal Media Project");
    state.project.branches = Array.isArray(state.project.branches) && state.project.branches.length ? state.project.branches.slice(-80) : base.project.branches;
    state.project.checkpoints = Array.isArray(state.project.checkpoints) ? state.project.checkpoints.slice(-120) : [];
    state.project.recoveries = Array.isArray(state.project.recoveries) ? state.project.recoveries.slice(-40) : [];
    state.project.members = Array.isArray(state.project.members) ? state.project.members.slice(-80) : base.project.members;
    state.project.locks = Array.isArray(state.project.locks) ? state.project.locks.slice(-120) : [];
    state.project.graph = {
      nodes: Array.isArray(state.project.graph?.nodes) ? state.project.graph.nodes.slice(-600) : base.project.graph.nodes,
      edges: Array.isArray(state.project.graph?.edges) ? state.project.graph.edges.slice(-1000) : []
    };
    state.review.comments = Array.isArray(state.review.comments) ? state.review.comments.slice(-300) : [];
    state.review.audit = Array.isArray(state.review.audit) ? state.review.audit.slice(-500) : base.review.audit;
    state.rights.splits = Array.isArray(state.rights.splits) ? state.rights.splits.slice(-80) : base.rights.splits;
    state.rights.consents = Array.isArray(state.rights.consents) ? state.rights.consents.slice(-200) : [];
    state.rights.licenses = Array.isArray(state.rights.licenses) ? state.rights.licenses.slice(-300) : [];
    state.photo.snapshots = Array.isArray(state.photo.snapshots) ? state.photo.snapshots.slice(-100) : [];
    state.photo.actions = Array.isArray(state.photo.actions) ? state.photo.actions.slice(-200) : [];
    state.photo.aiProposals = Array.isArray(state.photo.aiProposals) ? state.photo.aiProposals.slice(-100) : [];
    state.video.sourceMarks = Array.isArray(state.video.sourceMarks) ? state.video.sourceMarks.slice(-200) : [];
    state.video.sequences = Array.isArray(state.video.sequences) ? state.video.sequences.slice(-100) : [];
    state.video.trackLocks = Array.isArray(state.video.trackLocks) ? state.video.trackLocks.slice(-200) : [];
    state.video.transcriptProposals = Array.isArray(state.video.transcriptProposals) ? state.video.transcriptProposals.slice(-100) : [];
    state.documents.jobs = Array.isArray(state.documents.jobs) ? state.documents.jobs.slice(-200) : [];
    state.brand.kits = Array.isArray(state.brand.kits) && state.brand.kits.length ? state.brand.kits.slice(-40) : base.brand.kits;
    state.assets.items = Array.isArray(state.assets.items) ? state.assets.items.slice(-1000) : [];
    state.assets.collections = Array.isArray(state.assets.collections) ? state.assets.collections.slice(-100) : [];
    state.export.jobs = Array.isArray(state.export.jobs) ? state.export.jobs.slice(-300) : [];
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
        const next = normalizeState(value);
        try { target?.setItem?.(STATE_KEY, JSON.stringify(next)); } catch (_) { /* Storage can be unavailable or full. */ }
        return next;
      },
      clear() { try { target?.removeItem?.(STATE_KEY); } catch (_) { /* No-op. */ } }
    });
  }

  function appendAudit(state, action, detail, actor = "local-owner") {
    state.review.audit.push({ id: uid("audit"), action: text(action, 100), detail: text(detail, 320), actor: text(actor, 100), createdAt: now() });
    state.review.audit = state.review.audit.slice(-500);
    return state;
  }

  function createCheckpoint(input, label) {
    const state = normalizeState(input);
    const checkpoint = {
      id: uid("checkpoint"),
      branchId: state.project.activeBranchId,
      label: text(label, 140, `Checkpoint ${state.project.checkpoints.length + 1}`),
      graphHash: stableHash(JSON.stringify(state.project.graph)),
      createdAt: now()
    };
    state.project.checkpoints.push(checkpoint);
    const branch = state.project.branches.find((item) => item.id === state.project.activeBranchId);
    if (branch) branch.head = checkpoint.id;
    state.project.recoveries.push({ id: uid("recovery"), checkpointId: checkpoint.id, reason: "autosave", createdAt: checkpoint.createdAt });
    state.project.updatedAt = checkpoint.createdAt;
    appendAudit(state, "checkpoint.created", checkpoint.label);
    return normalizeState(state);
  }

  function createBranch(input, name) {
    const state = normalizeState(input);
    const branch = { id: uid("branch"), name: text(name, 80, `experiment-${state.project.branches.length}`), head: "", createdAt: now(), from: state.project.activeBranchId };
    state.project.branches.push(branch);
    state.project.activeBranchId = branch.id;
    appendAudit(state, "branch.created", branch.name);
    return normalizeState(state);
  }

  function addReviewComment(input, body, anchor = {}) {
    const state = normalizeState(input);
    const comment = {
      id: uid("comment"),
      body: text(body, 1200),
      anchor: {
        assetId: text(anchor.assetId, 100),
        frame: Math.max(0, number(anchor.frame, 0)),
        timecode: text(anchor.timecode, 30),
        x: Math.max(0, Math.min(1, number(anchor.x, 0))),
        y: Math.max(0, Math.min(1, number(anchor.y, 0)))
      },
      status: "open",
      author: "local-owner",
      replies: [],
      createdAt: now()
    };
    if (!comment.body) return state;
    state.review.comments.push(comment);
    appendAudit(state, "review.comment.created", comment.id);
    return normalizeState(state);
  }

  function resolveReviewComment(input, id) {
    const state = normalizeState(input);
    const comment = state.review.comments.find((item) => item.id === id);
    if (comment) {
      comment.status = "resolved";
      comment.resolvedAt = now();
      appendAudit(state, "review.comment.resolved", id);
    }
    return normalizeState(state);
  }

  function addAssetRecord(input, asset) {
    const state = normalizeState(input);
    const checksum = text(asset?.checksum, 128, stableHash(`${asset?.name}:${asset?.size}:${asset?.lastModified}`));
    const duplicate = state.assets.items.find((item) => item.checksum === checksum && number(item.size) === number(asset?.size));
    const record = {
      id: uid("asset"),
      name: text(asset?.name, 220, "Untitled asset"),
      type: text(asset?.type, 100, "application/octet-stream"),
      size: Math.max(0, number(asset?.size, 0)),
      checksum,
      status: duplicate ? "duplicate" : "ready",
      duplicateOf: duplicate?.id || "",
      license: text(asset?.license, 120),
      consentRequired: Boolean(asset?.consentRequired),
      consentId: text(asset?.consentId, 120),
      source: text(asset?.source, 80, "local"),
      createdAt: now()
    };
    state.assets.items.push(record);
    state.project.graph.nodes.push({ id: record.id, type: "asset", label: record.name, checksum, createdAt: record.createdAt });
    state.project.graph.edges.push({ from: state.project.id, to: record.id, relation: "contains" });
    appendAudit(state, "asset.ingested", `${record.name} · ${record.status}`);
    return { state: normalizeState(state), record };
  }

  function calculateHealth(input) {
    const state = normalizeState(input);
    const blockers = [];
    const warnings = [];
    const splitTotal = state.rights.splits.reduce((sum, item) => sum + number(item.percent, 0), 0);
    if (Math.abs(splitTotal - 100) > 0.001) blockers.push({ code: "rights-split", message: `Tổng split hiện là ${splitTotal}%, bắt buộc bằng 100%.` });
    state.assets.items.filter((item) => item.status === "offline").forEach((item) => blockers.push({ code: "offline", message: `${item.name} đang offline.` }));
    state.assets.items.filter((item) => item.consentRequired && !item.consentId).forEach((item) => blockers.push({ code: "consent", message: `${item.name} thiếu giấy đồng ý sử dụng.` }));
    state.assets.items.filter((item) => !item.license).forEach((item) => warnings.push({ code: "license", message: `${item.name} chưa ghi nhận license/quyền sử dụng.` }));
    state.assets.items.filter((item) => item.status === "duplicate").forEach((item) => warnings.push({ code: "duplicate", message: `${item.name} trùng checksum với asset khác.` }));
    state.review.comments.filter((item) => item.status !== "resolved").forEach((item) => warnings.push({ code: "review", message: `Comment chưa xử lý: ${item.body.slice(0, 80)}` }));
    const failedJobs = state.export.jobs.filter((item) => item.status === "failed");
    failedJobs.forEach((item) => blockers.push({ code: "render", message: `${item.name} render thất bại.` }));
    const score = Math.max(0, 100 - blockers.length * 18 - warnings.length * 5);
    return { score, blockers, warnings, splitTotal, status: blockers.length ? "blocked" : warnings.length ? "attention" : "healthy" };
  }

  function runPreflight(input, target = "youtube-16x9") {
    const state = normalizeState(input);
    const health = calculateHealth(state);
    const checks = [
      { id: "project", label: "Tên dự án", status: state.project.name ? "pass" : "block" },
      { id: "assets", label: "Media offline", status: state.assets.items.some((item) => item.status === "offline") ? "block" : "pass" },
      { id: "rights", label: "Split tác quyền = 100%", status: Math.abs(health.splitTotal - 100) < 0.001 ? "pass" : "block" },
      { id: "consent", label: "Consent bắt buộc", status: state.assets.items.some((item) => item.consentRequired && !item.consentId) ? "block" : "pass" },
      { id: "license", label: "License của asset", status: state.assets.items.some((item) => !item.license) ? "warn" : "pass" },
      { id: "worker", label: "External render worker", status: state.export.worker.status === "ready" ? "pass" : "adapter" }
    ];
    return {
      id: uid("preflight"),
      target: text(target, 100, "youtube-16x9"),
      status: checks.some((item) => item.status === "block") ? "blocked" : checks.some((item) => item.status === "adapter") ? "ready-needs-adapter" : "ready",
      checks,
      createdAt: now()
    };
  }

  function createAdaptiveJobs(input) {
    const state = normalizeState(input);
    const presets = [
      ["youtube-16x9", "YouTube 16:9", 1920, 1080],
      ["vertical-9x16", "Shorts / Reels 9:16", 1080, 1920],
      ["social-1x1", "Social 1:1", 1080, 1080],
      ["thumbnail", "Thumbnail", 1280, 720],
      ["spotify-canvas", "Spotify Canvas", 1080, 1920]
    ];
    const batchId = uid("batch");
    presets.forEach(([preset, label, width, height]) => {
      const spec = `${state.project.id}:${batchId}:${preset}:${width}x${height}`;
      state.export.jobs.push({
        id: uid("render"), batchId, name: `${state.project.name} · ${label}`, preset, width, height,
        status: "planned", progress: 0, cost: 0, currency: "USD", idempotencyKey: stableHash(spec),
        message: "Đã lập job spec; chưa gửi tới worker và chưa phát sinh chi phí.", createdAt: now()
      });
    });
    appendAudit(state, "export.adaptive.planned", batchId);
    return normalizeState(state);
  }

  function workspaceMetrics(state) {
    const health = calculateHealth(state);
    return [
      ["Health", `${health.score}/100`, health.blockers.length ? `${health.blockers.length} blocker` : "Không có blocker"],
      ["Asset Graph", state.project.graph.nodes.length - 1, `${state.project.graph.edges.length} liên kết`],
      ["Version", state.project.checkpoints.length, `${state.project.branches.length} nhánh`],
      ["Review", state.review.comments.filter((item) => item.status !== "resolved").length, `${state.review.audit.length} audit event`],
      ["Render", state.export.jobs.filter((item) => ["planned", "queued", "running", "paused"].includes(item.status)).length, `${state.export.jobs.filter((item) => item.status === "failed").length} lỗi`]
    ];
  }

  const statusLabel = (status) => ({
    local: "Sẵn sàng cục bộ", editor: "Mở editor", adapter: "Cần backend adapter",
    planned: "Đã lập kế hoạch", paused: "Tạm dừng", canceled: "Đã hủy", failed: "Thất bại", completed: "Hoàn tất"
  })[status] || status;

  function capabilityMarkup(workspace) {
    return workspace.capabilities.map(([name, detail, status]) => `<article class="mps-capability" data-status="${status}">
      <span aria-hidden="true">${status === "local" ? "✓" : status === "editor" ? "↗" : "◇"}</span>
      <div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(detail)}</small></div><b>${escapeHtml(statusLabel(status))}</b>
    </article>`).join("");
  }

  function rightsMarkup(state) {
    return `<section class="mps-card mps-card--rights"><header><div><small>RIGHTS CONTROL</small><h3>Tác quyền & consent</h3></div><b>${calculateHealth(state).splitTotal}%</b></header>
      <div class="mps-splits">${state.rights.splits.map((split) => `<label data-split="${escapeHtml(split.id)}"><input data-mps-split-owner value="${escapeHtml(split.owner)}" aria-label="Chủ sở hữu"><input data-mps-split-percent type="number" min="0" max="100" step="0.01" value="${number(split.percent)}" aria-label="Phần trăm"><span>%</span><button type="button" data-mps-remove-split aria-label="Xóa split">×</button></label>`).join("")}</div>
      <button type="button" class="mps-button" data-mps-add-split>+ Thêm người hưởng quyền</button>
      <p>Preflight sẽ khóa phát hành nếu tổng split khác 100% hoặc thiếu consent bắt buộc.</p>
    </section>`;
  }

  function reviewMarkup(state) {
    const comments = state.review.comments.slice().reverse().slice(0, 8);
    return `<section class="mps-card"><header><div><small>FRAME / PIXEL REVIEW</small><h3>Review có neo vị trí</h3></div><b>${comments.filter((item) => item.status !== "resolved").length} mở</b></header>
      <form class="mps-inline-form" data-mps-comment-form><input name="body" maxlength="1200" placeholder="Ghi chú review…" required><input name="timecode" maxlength="20" placeholder="00:00:00"><button type="submit">Gửi</button></form>
      <div class="mps-review-list">${comments.length ? comments.map((comment) => `<article data-status="${comment.status}"><div><strong>${escapeHtml(comment.body)}</strong><small>${escapeHtml(comment.anchor.timecode || "Project")} · ${new Date(comment.createdAt).toLocaleString("vi-VN")}</small></div>${comment.status === "resolved" ? "<b>Đã xử lý</b>" : `<button type="button" data-mps-resolve-comment="${escapeHtml(comment.id)}">Resolve</button>`}</article>`).join("") : "<p>Chưa có comment. Mọi thay đổi review sẽ được ghi vào audit log.</p>"}</div>
    </section>`;
  }

  function universalMarkup(state) {
    const health = calculateHealth(state);
    return `<div class="mps-work-grid">
      <section class="mps-card mps-card--wide"><header><div><small>MEDIA GRAPH</small><h3>Asset lineage bền vững</h3></div><b>${state.project.graph.nodes.length} node</b></header>
        <div class="mps-lineage"><span class="is-project">PROJECT</span><i>→</i><span>SOURCE</span><i>→</i><span>PROXY</span><i>→</i><span>TIMELINE</span><i>→</i><span>VERSION</span><i>→</i><span>OUTPUT</span></div>
        <p>ID asset không đổi khi relink; checksum, provider, prompt, seed, license và output được gắn vào graph.</p>
      </section>
      <section class="mps-card"><header><div><small>BRANCH & RECOVERY</small><h3>${state.project.branches.length} nhánh · ${state.project.recoveries.length} recovery</h3></div></header>
        <form class="mps-inline-form" data-mps-branch-form><input name="name" maxlength="80" placeholder="Tên nhánh thử nghiệm" required><button type="submit">Tạo nhánh</button></form>
        <button class="mps-button is-primary" type="button" data-mps-checkpoint>Tạo checkpoint an toàn</button>
        <div class="mps-chip-list">${state.project.branches.slice(-8).map((branch) => `<span class="${branch.id === state.project.activeBranchId ? "is-active" : ""}">${escapeHtml(branch.name)}<small>${escapeHtml(branch.head || "chưa checkpoint")}</small></span>`).join("")}</div>
      </section>
      <section class="mps-card"><header><div><small>PROJECT HEALTH</small><h3>${health.score}/100 · ${health.status}</h3></div></header>
        <div class="mps-health-bar"><i style="--health:${health.score}%"></i></div>
        <div class="mps-issues">${[...health.blockers, ...health.warnings].slice(0, 6).map((item) => `<p><b>${escapeHtml(item.code)}</b>${escapeHtml(item.message)}</p>`).join("") || "<p><b>ready</b>Không có cảnh báo dữ liệu thật.</p>"}</div>
      </section>
      ${reviewMarkup(state)}${rightsMarkup(state)}
    </div>`;
  }

  function photoMarkup(state) {
    return `<div class="mps-work-grid">
      <section class="mps-card mps-card--launch"><span>PI</span><div><small>NON-DESTRUCTIVE EDITOR</small><h3>Photo Editor Pro</h3><p>Layer, group, mask, smart object, adjustment, blend, selection và high-res export.</p></div><button type="button" data-mps-route="/media-design/photo-editor">Mở Photo Editor</button></section>
      <section class="mps-card"><header><div><small>SNAPSHOTS & ACTIONS</small><h3>Lịch sử sáng tạo</h3></div><b>${state.photo.snapshots.length}</b></header>
        <div class="mps-actions-row"><button type="button" class="mps-button is-primary" data-mps-photo-snapshot>Tạo snapshot</button><button type="button" class="mps-button" data-mps-photo-action>Ghi action mới</button></div>
        <div class="mps-chip-list">${state.photo.snapshots.slice(-6).reverse().map((item) => `<span>${escapeHtml(item.name)}<small>${new Date(item.createdAt).toLocaleTimeString("vi-VN")}</small></span>`).join("") || "<p>Chưa có snapshot.</p>"}</div>
      </section>
      <section class="mps-card"><header><div><small>CONTROLLED AI</small><h3>Preview trước khi áp dụng</h3></div><b>SAFE</b></header>
        <p>AI không chỉnh trực tiếp layer gốc. Đề xuất được lưu thành proposal và chỉ Apply sau khi có preview từ provider.</p>
        <button type="button" class="mps-button" data-mps-ai-proposal>Tạo proposal AI</button>
        <div class="mps-issues">${state.photo.aiProposals.slice(-4).reverse().map((item) => `<p><b>${escapeHtml(item.status)}</b>${escapeHtml(item.message)}</p>`).join("") || "<p><b>idle</b>Chưa có proposal.</p>"}</div>
      </section>
    </div>`;
  }

  function videoMarkup(state) {
    return `<div class="mps-work-grid">
      <section class="mps-card mps-card--launch"><span>VM</span><div><small>EDIT · FUSION · COLOR · AUDIO</small><h3>Video Editor Pro</h3><p>Source/Program, timeline đa rãnh, nodes, scopes, audio mixer và Deliver.</p></div><button type="button" data-mps-route="/media-design/video-editor">Mở Video Editor</button></section>
      <section class="mps-card"><header><div><small>THREE-POINT EDIT</small><h3>Source marks</h3></div><b>${state.video.sourceMarks.length}</b></header>
        <form class="mps-inline-form" data-mps-source-mark-form><input name="in" placeholder="In 00:00:00" required><input name="out" placeholder="Out 00:00:05" required><button type="submit">Lưu mark</button></form>
        <div class="mps-chip-list">${state.video.sourceMarks.slice(-6).reverse().map((item) => `<span>${escapeHtml(item.in)} → ${escapeHtml(item.out)}<small>Source monitor</small></span>`).join("") || "<p>Chưa đặt In/Out.</p>"}</div>
      </section>
      <section class="mps-card"><header><div><small>TEXT-BASED EDIT</small><h3>Transcript proposal</h3></div><b>${state.video.transcriptProposals.length}</b></header>
        <p>Chỉnh theo transcript tạo proposal cắt; timeline chỉ đổi sau khi người dùng Preview và xác nhận.</p>
        <button type="button" class="mps-button" data-mps-transcript-proposal>Tạo proposal transcript</button>
        <small class="mps-adapter-note">Transcription thật cần server adapter; không hiển thị transcript giả.</small>
      </section>
    </div>`;
  }

  function documentsMarkup(state) {
    return `<div class="mps-work-grid">
      <section class="mps-card mps-card--wide"><header><div><small>DOCUMENT INBOX</small><h3>Đăng ký file vào hàng đợi an toàn</h3></div><b>${state.documents.jobs.length}</b></header>
        <label class="mps-dropzone">Chọn PDF hoặc tài liệu<input type="file" data-mps-document-file accept=".pdf,.doc,.docx,.txt,image/*" multiple><span>File chỉ được đọc metadata cục bộ; OCR/redaction backend chưa chạy nếu chưa có adapter.</span></label>
      </section>
      <section class="mps-card mps-card--launch"><span>PDF</span><div><small>LOCAL PDF ENGINE</small><h3>PDF Toolkit</h3><p>Gộp, tách, xoay, watermark và metadata bằng engine trình duyệt.</p></div><button type="button" data-mps-route="/media-design/pdf">Mở PDF Toolkit</button></section>
      <section class="mps-card"><header><div><small>QUEUE</small><h3>Tác vụ tài liệu</h3></div></header>
        <div class="mps-job-list">${state.documents.jobs.slice(-8).reverse().map((job) => `<article><div><strong>${escapeHtml(job.name)}</strong><small>${escapeHtml(job.type)} · ${job.size} bytes</small></div><b>${escapeHtml(job.status)}</b></article>`).join("") || "<p>Chưa có tài liệu.</p>"}</div>
      </section>
    </div>`;
  }

  function brandLint(state) {
    const kit = state.brand.kits.find((item) => item.id === state.brand.activeKitId) || state.brand.kits[0];
    const issues = [];
    const names = new Set();
    (kit.tokens || []).forEach((token) => {
      if (names.has(token.name)) issues.push(`Token trùng: ${token.name}`);
      names.add(token.name);
      if (!/^[a-z][a-z0-9.-]+$/i.test(token.name)) issues.push(`Tên token chưa chuẩn: ${token.name}`);
    });
    return { kit, issues };
  }

  function brandMarkup(state) {
    const lint = brandLint(state);
    return `<div class="mps-work-grid">
      <section class="mps-card mps-card--wide"><header><div><small>DESIGN TOKENS</small><h3>${escapeHtml(lint.kit.name)}</h3></div><b>${(lint.kit.tokens || []).length} token</b></header>
        <form class="mps-token-form" data-mps-token-form><input name="name" placeholder="color.brand.secondary" required><input name="value" placeholder="#a56cff" required><select name="type"><option value="color">Color</option><option value="type">Typography</option><option value="space">Spacing</option><option value="radius">Radius</option></select><button type="submit">Thêm token</button></form>
        <div class="mps-token-grid">${(lint.kit.tokens || []).map((token) => `<article><i style="--token:${escapeHtml(token.value)}"></i><div><strong>${escapeHtml(token.name)}</strong><small>${escapeHtml(token.value)} · ${escapeHtml(token.type)}</small></div></article>`).join("")}</div>
        <div class="mps-actions-row"><button type="button" class="mps-button" data-mps-export-tokens="css">Xuất CSS</button><button type="button" class="mps-button" data-mps-export-tokens="json">Xuất JSON</button><button type="button" class="mps-button" data-mps-add-mode>+ Mode</button></div>
      </section>
      <section class="mps-card"><header><div><small>BRAND LINT</small><h3>${lint.issues.length ? `${lint.issues.length} vấn đề` : "Đạt kiểm tra cơ bản"}</h3></div></header><div class="mps-issues">${lint.issues.map((issue) => `<p><b>lint</b>${escapeHtml(issue)}</p>`).join("") || "<p><b>pass</b>Không có token trùng hoặc tên sai quy ước.</p>"}</div></section>
      <section class="mps-card mps-card--launch"><span>BK</span><div><small>VISUAL BRAND BOARD</small><h3>Brand Kit Studio</h3><p>Palette, typography, logo board và export hiện có.</p></div><button type="button" data-mps-route="/media-design/brand-kit">Mở Brand Kit</button></section>
    </div>`;
  }

  function assetsMarkup(state) {
    return `<div class="mps-work-grid">
      <section class="mps-card mps-card--wide"><header><div><small>VERIFIED INGEST</small><h3>Checksum & provenance</h3></div><b>${state.assets.items.length} asset</b></header>
        <label class="mps-dropzone">Đưa asset vào Galaxy<input type="file" data-mps-asset-file multiple><span>Tạo SHA-256 trên thiết bị khi trình duyệt hỗ trợ; không tải file lên cloud.</span></label>
        <div class="mps-asset-table">${state.assets.items.slice(-12).reverse().map((asset) => `<article data-status="${asset.status}"><span>${escapeHtml(asset.type.split("/")[0].toUpperCase())}</span><div><strong>${escapeHtml(asset.name)}</strong><small>${escapeHtml(asset.checksum.slice(0, 18))} · ${asset.size} bytes</small></div><b>${escapeHtml(asset.status)}</b></article>`).join("") || "<p>Media Bin chuyên nghiệp đang trống.</p>"}</div>
      </section>
      <section class="mps-card"><header><div><small>PRIVATE CLOUD</small><h3>Vercel Blob</h3></div><b>CẦN ADAPTER</b></header><p>Upload private, multipart và signed URL phải đi qua API xác thực. Không lưu token Blob trong JavaScript phía trình duyệt.</p><button type="button" class="mps-button" data-mps-route="/media-design/universal-media">Mở Media Bin</button></section>
      <section class="mps-card"><header><div><small>SMART COLLECTION</small><h3>License · Font · LUT</h3></div></header><p>Collection và metadata được lưu cục bộ. Semantic search chỉ bật khi vector adapter trả kết quả thật.</p></section>
    </div>`;
  }

  function exportMarkup(state) {
    const preflight = state.export.lastPreflight;
    return `<div class="mps-work-grid">
      <section class="mps-card mps-card--wide"><header><div><small>RELEASE PREFLIGHT</small><h3>${preflight ? escapeHtml(preflight.status) : "Chưa kiểm tra"}</h3></div><button type="button" class="mps-button is-primary" data-mps-preflight>Chạy preflight</button></header>
        <div class="mps-preflight">${preflight ? preflight.checks.map((check) => `<article data-status="${check.status}"><span>${check.status === "pass" ? "✓" : check.status === "block" ? "!" : "◇"}</span><strong>${escapeHtml(check.label)}</strong><b>${escapeHtml(check.status)}</b></article>`).join("") : "<p>Kiểm tra project, media offline, quyền, consent, license và render worker trước khi phát hành.</p>"}</div>
        <button type="button" class="mps-button" data-mps-adaptive>Tạo 5 job Adaptive Export</button>
      </section>
      <section class="mps-card"><header><div><small>RENDER QUEUE</small><h3>Job spec trung thực</h3></div><b>${state.export.jobs.length}</b></header>
        <div class="mps-job-list">${state.export.jobs.slice(-10).reverse().map((job) => `<article><div><strong>${escapeHtml(job.name)}</strong><small>${job.width}×${job.height} · key ${escapeHtml(job.idempotencyKey)}</small></div><b>${escapeHtml(statusLabel(job.status))}</b><span>${job.cost || 0} ${job.currency || "USD"}</span><div>${["planned", "paused"].includes(job.status) ? `<button type="button" data-mps-job-action="${job.status === "paused" ? "resume" : "pause"}" data-job-id="${job.id}">${job.status === "paused" ? "Resume" : "Pause"}</button>` : ""}${["planned", "paused"].includes(job.status) ? `<button type="button" data-mps-job-action="cancel" data-job-id="${job.id}">Cancel</button>` : ""}<button type="button" data-mps-job-action="duplicate" data-job-id="${job.id}">Duplicate</button></div></article>`).join("") || "<p>Chưa có job render.</p>"}</div>
      </section>
      <section class="mps-card"><header><div><small>EXTERNAL WORKER</small><h3>FFmpeg ngoài Vercel</h3></div><b>CẦN ADAPTER</b></header><p>Vercel điều phối và xác thực; tác vụ encode dài chạy trên worker riêng. Progress, log, chi phí và output chỉ hiển thị từ response thật.</p><button type="button" class="mps-button" data-mps-route="/media-design/production-workflow">Mở Production Workflow</button></section>
      ${rightsMarkup(state)}
    </div>`;
  }

  function workspaceBody(workspace, state) {
    if (workspace.id === "media-core") return universalMarkup(state);
    if (workspace.id === "photo-workspace") return photoMarkup(state);
    if (workspace.id === "video-workspace") return videoMarkup(state);
    if (workspace.id === "document-workspace") return documentsMarkup(state);
    if (workspace.id === "brand-workspace") return brandMarkup(state);
    if (workspace.id === "asset-workspace") return assetsMarkup(state);
    return exportMarkup(state);
  }

  async function fileChecksum(file) {
    if (globalScope.crypto?.subtle && file?.arrayBuffer) {
      const digest = await globalScope.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
    }
    return stableHash(`${file?.name}:${file?.size}:${file?.lastModified}`);
  }

  function download(name, content, type) {
    if (!globalScope.document || typeof Blob === "undefined") return;
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function mount(host, options = {}) {
    if (!host) return null;
    unmount(host);
    const controller = new AbortController();
    const store = createStateStore(options.storage);
    let state = store.load();
    let workspace = WORKSPACE_BY_ID[options.workspace || options.toolId] || WORKSPACE_BY_ID[state.lastWorkspace] || WORKSPACES[0];
    state.lastWorkspace = workspace.id;
    state = store.save(state);

    const save = () => { state.updatedAt = now(); state = store.save(state); };
    const notify = (message, tone = "success") => {
      const node = host.querySelector("[data-mps-toast]");
      if (!node) return;
      node.textContent = message;
      node.dataset.tone = tone;
      node.hidden = false;
      clearTimeout(notify.timer);
      notify.timer = setTimeout(() => { if (node.isConnected) node.hidden = true; }, 3400);
    };
    const navigate = (route) => {
      if (typeof options.onNavigate === "function") options.onNavigate(route);
      else if (globalScope.location) globalScope.location.hash = `#${route}`;
    };
    const render = () => {
      const health = calculateHealth(state);
      host.innerHTML = `<section class="media-professional-suite" data-mps style="--planet:${workspace.color}" data-planet="${workspace.planet}">
        <div class="mps-space" aria-hidden="true"><i></i><i></i><i></i></div>
        <header class="mps-hero">
          <div class="mps-identity"><span>${workspace.code}</span><div><small>HH MEDIA PROFESSIONAL · ${escapeHtml(workspace.planet.toUpperCase())}</small><h2>${escapeHtml(workspace.title)}</h2><p>${escapeHtml(workspace.summary)}</p></div></div>
          <div class="mps-project-control"><label>Tên Universal Project<input data-mps-project-name maxlength="140" value="${escapeHtml(state.project.name)}"></label><button type="button" data-mps-checkpoint>Checkpoint</button><span data-status="${health.status}">${health.score}/100</span></div>
        </header>
        <nav class="mps-planets" aria-label="Bảy workspace Media & Design">${WORKSPACES.map((item) => `<button type="button" data-mps-route="${item.route}" aria-current="${item.id === workspace.id ? "page" : "false"}" style="--item:${item.color}"><i>${item.code}</i><span>${escapeHtml(item.title.replace(" Pro", ""))}</span></button>`).join("")}</nav>
        <section class="mps-metrics">${workspaceMetrics(state).map(([label, value, detail]) => `<article><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><span>${escapeHtml(detail)}</span></article>`).join("")}</section>
        <div class="mps-layout">
          <aside class="mps-capabilities"><header><small>PRO CAPABILITIES</small><h3>Phạm vi workspace</h3></header>${capabilityMarkup(workspace)}
            <p class="mps-honesty"><b>Cam kết trạng thái thật:</b> tính năng cần cloud/AI/codec chỉ được đánh dấu sẵn sàng khi backend trả kết quả hợp lệ.</p>
          </aside>
          <main class="mps-workspace">${workspaceBody(workspace, state)}</main>
        </div>
        <footer class="mps-footer"><span><i></i> Local-first · schema ${SCHEMA}</span><span>${state.project.checkpoints.length} checkpoint · ${state.review.audit.length} audit event</span><button type="button" data-mps-route="/media-design">Về Galaxy Command Center</button></footer>
        <div class="mps-toast" data-mps-toast role="status" aria-live="polite" hidden></div>
      </section>`;
    };

    host.addEventListener("click", (event) => {
      const route = event.target.closest("[data-mps-route]");
      if (route) { navigate(route.dataset.mpsRoute); return; }
      if (event.target.closest("[data-mps-checkpoint]")) {
        state = createCheckpoint(state, `${workspace.title} · ${new Date().toLocaleTimeString("vi-VN")}`);
        save(); render(); notify("Đã tạo checkpoint và recovery point.", "success"); return;
      }
      if (event.target.closest("[data-mps-add-split]")) {
        state.rights.splits.push({ id: uid("split"), owner: "Thành viên mới", percent: 0 });
        appendAudit(state, "rights.split.created", "Thành viên mới"); save(); render(); return;
      }
      const removeSplit = event.target.closest("[data-mps-remove-split]");
      if (removeSplit) {
        const id = removeSplit.closest("[data-split]")?.dataset.split;
        state.rights.splits = state.rights.splits.filter((item) => item.id !== id);
        appendAudit(state, "rights.split.removed", id); save(); render(); return;
      }
      const resolve = event.target.closest("[data-mps-resolve-comment]");
      if (resolve) { state = resolveReviewComment(state, resolve.dataset.mpsResolveComment); save(); render(); return; }
      if (event.target.closest("[data-mps-photo-snapshot]")) {
        state.photo.snapshots.push({ id: uid("photo-snapshot"), name: `Ảnh v${state.photo.snapshots.length + 1}`, createdAt: now() });
        appendAudit(state, "photo.snapshot.created", state.photo.snapshots.at(-1).name); save(); render(); return;
      }
      if (event.target.closest("[data-mps-photo-action]")) {
        state.photo.actions.push({ id: uid("photo-action"), name: `Action ${state.photo.actions.length + 1}`, steps: [], status: "recording", createdAt: now() });
        appendAudit(state, "photo.action.recording", state.photo.actions.at(-1).name); save(); render(); notify("Đã mở phiên ghi action; thao tác trong Photo Editor vẫn có lịch sử riêng."); return;
      }
      if (event.target.closest("[data-mps-ai-proposal]")) {
        state.photo.aiProposals.push({ id: uid("ai-proposal"), status: "needs-adapter", message: "Chưa có AI image adapter; không thay đổi layer gốc.", createdAt: now() });
        appendAudit(state, "photo.ai.proposal.requested", "needs-adapter"); save(); render(); notify("Đã lưu proposal. Cần provider backend để tạo preview thật.", "warning"); return;
      }
      if (event.target.closest("[data-mps-transcript-proposal]")) {
        state.video.transcriptProposals.push({ id: uid("transcript-proposal"), status: "needs-adapter", message: "Chưa gửi media; cần transcription adapter.", createdAt: now() });
        appendAudit(state, "video.transcript.proposal.requested", "needs-adapter"); save(); render(); notify("Đã lưu yêu cầu; timeline chưa bị thay đổi.", "warning"); return;
      }
      if (event.target.closest("[data-mps-add-mode]")) {
        const kit = state.brand.kits.find((item) => item.id === state.brand.activeKitId) || state.brand.kits[0];
        const mode = `Mode ${kit.modes.length + 1}`;
        kit.modes.push(mode); appendAudit(state, "brand.mode.created", mode); save(); render(); return;
      }
      const exportTokens = event.target.closest("[data-mps-export-tokens]");
      if (exportTokens) {
        const kit = state.brand.kits.find((item) => item.id === state.brand.activeKitId) || state.brand.kits[0];
        if (exportTokens.dataset.mpsExportTokens === "json") {
          download("hh-brand-tokens.json", JSON.stringify({ schema: "hh.brand.tokens.v1", kit }, null, 2), "application/json");
        } else {
          const css = `:root {\n${(kit.tokens || []).map((token) => `  --${token.name.replace(/\./g, "-")}: ${token.value};`).join("\n")}\n}\n`;
          download("hh-brand-tokens.css", css, "text/css");
        }
        appendAudit(state, "brand.tokens.exported", exportTokens.dataset.mpsExportTokens); save(); notify("Đã xuất token từ dữ liệu thật.", "success"); return;
      }
      if (event.target.closest("[data-mps-preflight]")) {
        state.export.lastPreflight = runPreflight(state);
        appendAudit(state, "export.preflight.completed", state.export.lastPreflight.status); save(); render();
        notify(state.export.lastPreflight.status === "blocked" ? "Preflight phát hiện blocker cần xử lý." : "Preflight hoàn tất; worker vẫn cần adapter.", state.export.lastPreflight.status === "blocked" ? "error" : "success"); return;
      }
      if (event.target.closest("[data-mps-adaptive]")) {
        state = createAdaptiveJobs(state); save(); render(); notify("Đã tạo 5 job spec; chưa render và chi phí vẫn bằng 0.", "success"); return;
      }
      const jobAction = event.target.closest("[data-mps-job-action]");
      if (jobAction) {
        const index = state.export.jobs.findIndex((item) => item.id === jobAction.dataset.jobId);
        if (index < 0) return;
        const job = state.export.jobs[index];
        const action = jobAction.dataset.mpsJobAction;
        if (action === "pause" && job.status === "planned") job.status = "paused";
        if (action === "resume" && job.status === "paused") job.status = "planned";
        if (action === "cancel" && ["planned", "paused"].includes(job.status)) job.status = "canceled";
        if (action === "duplicate") state.export.jobs.push({ ...job, id: uid("render"), idempotencyKey: stableHash(`${job.id}:${Date.now()}`), status: "planned", createdAt: now() });
        appendAudit(state, `export.job.${action}`, job.id); save(); render(); return;
      }
    }, { signal: controller.signal });

    host.addEventListener("submit", (event) => {
      const form = event.target;
      if (form.matches("[data-mps-branch-form]")) {
        event.preventDefault(); state = createBranch(state, new FormData(form).get("name")); save(); render(); notify("Đã tạo và chuyển sang nhánh mới."); return;
      }
      if (form.matches("[data-mps-comment-form]")) {
        event.preventDefault(); const data = new FormData(form); state = addReviewComment(state, data.get("body"), { timecode: data.get("timecode") }); save(); render(); return;
      }
      if (form.matches("[data-mps-source-mark-form]")) {
        event.preventDefault(); const data = new FormData(form);
        state.video.sourceMarks.push({ id: uid("mark"), in: text(data.get("in"), 30), out: text(data.get("out"), 30), createdAt: now() });
        appendAudit(state, "video.source-mark.created", `${data.get("in")} → ${data.get("out")}`); save(); render(); return;
      }
      if (form.matches("[data-mps-token-form]")) {
        event.preventDefault(); const data = new FormData(form); const lint = brandLint(state);
        lint.kit.tokens.push({ id: uid("token"), name: text(data.get("name"), 120), value: text(data.get("value"), 160), type: text(data.get("type"), 30, "color") });
        appendAudit(state, "brand.token.created", data.get("name")); save(); render(); return;
      }
    }, { signal: controller.signal });

    host.addEventListener("change", async (event) => {
      if (event.target.matches("[data-mps-project-name]")) {
        state.project.name = text(event.target.value, 140, "Universal Media Project");
        const projectNode = state.project.graph.nodes.find((item) => item.id === state.project.id);
        if (projectNode) projectNode.label = state.project.name;
        appendAudit(state, "project.renamed", state.project.name); save(); render(); return;
      }
      if (event.target.matches("[data-mps-split-owner], [data-mps-split-percent]")) {
        const row = event.target.closest("[data-split]");
        const split = state.rights.splits.find((item) => item.id === row?.dataset.split);
        if (split) {
          split.owner = text(row.querySelector("[data-mps-split-owner]")?.value, 160, "Thành viên");
          split.percent = Math.max(0, Math.min(100, number(row.querySelector("[data-mps-split-percent]")?.value, 0)));
          appendAudit(state, "rights.split.updated", `${split.owner} ${split.percent}%`); save(); render();
        }
        return;
      }
      if (event.target.matches("[data-mps-document-file]")) {
        for (const file of [...(event.target.files || [])]) {
          state.documents.jobs.push({ id: uid("document"), name: text(file.name, 220), type: text(file.type, 100, "unknown"), size: file.size, status: "registered-local", createdAt: now() });
          const result = addAssetRecord(state, { name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, checksum: await fileChecksum(file), source: "document-inbox" });
          state = result.state;
        }
        save(); render(); notify("Đã đăng ký tài liệu và checksum; chưa tải lên máy chủ."); return;
      }
      if (event.target.matches("[data-mps-asset-file]")) {
        for (const file of [...(event.target.files || [])]) {
          const result = addAssetRecord(state, { name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, checksum: await fileChecksum(file), source: "local-ingest" });
          state = result.state;
        }
        save(); render(); notify("Đã ingest metadata, checksum và provenance cục bộ."); return;
      }
    }, { signal: controller.signal });

    render();
    activeInstances.set(host, { controller });
    return Object.freeze({ getState: () => clone(state), getWorkspace: () => workspace.id, unmount: () => unmount(host) });
  }

  function unmount(host) {
    const targets = host ? [[host, activeInstances.get(host)]] : [...activeInstances.entries()];
    targets.forEach(([node, instance]) => {
      if (!instance) return;
      instance.controller.abort();
      node.innerHTML = "";
      activeInstances.delete(node);
    });
  }

  return Object.freeze({
    SCHEMA, STATE_KEY, VERSION, WORKSPACES, WORKSPACE_BY_ID,
    escapeHtml, stableHash, normalizeState, createStateStore, createCheckpoint, createBranch,
    addReviewComment, resolveReviewComment, addAssetRecord, calculateHealth, runPreflight,
    createAdaptiveJobs, mount, unmount
  });
});
