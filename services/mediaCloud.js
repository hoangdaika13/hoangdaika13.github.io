"use strict";

const crypto = require("crypto");
const { ObjectId } = require("mongodb");
const { del, head, issueSignedToken, presignUrl } = require("@vercel/blob");
const { handleUpload } = require("@vercel/blob/client");
const { clean, currentUser, enforceRateLimit, withApi } = require("../utils/platform");

const ROLES = new Set(["owner", "editor", "reviewer", "viewer"]);
const REVIEW_STATES = new Set(["draft", "in-review", "changes-requested", "approved"]);
const SAFE_MIME = [
  /^image\/(png|jpeg|webp|gif|avif|heic|tiff)$/i,
  /^video\/(mp4|webm|quicktime|x-matroska)$/i,
  /^audio\/(mpeg|mp4|wav|wave|x-wav|flac|ogg|webm)$/i,
  /^application\/pdf$/i,
  /^font\/(ttf|otf|woff|woff2)$/i,
  /^application\/(font-woff|vnd\.ms-fontobject|json|octet-stream)$/i,
  /^text\/(plain|csv|vtt)$/i,
  /^image\/svg\+xml$/i
];
const MAX_UPLOAD_BYTES = Math.max(10 * 1024 * 1024, Number(process.env.MEDIA_MAX_UPLOAD_BYTES || 2 * 1024 * 1024 * 1024));
const USER_QUOTA_BYTES = Math.max(MAX_UPLOAD_BYTES, Number(process.env.MEDIA_USER_QUOTA_BYTES || 5 * 1024 * 1024 * 1024));
const PROJECT_QUOTA_BYTES = Math.max(MAX_UPLOAD_BYTES, Number(process.env.MEDIA_PROJECT_QUOTA_BYTES || 2 * 1024 * 1024 * 1024));
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
let indexesReady = false;

const id = (value) => /^[a-f0-9]{24}$/i.test(String(value || "")) ? new ObjectId(String(value)) : null;
const now = () => new Date();
const safeFilename = (value) => clean(value || "untitled.bin", 180)
  .normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled.bin";
const safeMime = (value) => {
  const mime = clean(value || "application/octet-stream", 120).toLowerCase();
  return SAFE_MIME.some((pattern) => pattern.test(mime)) ? mime : "";
};
const hashToken = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");
const randomToken = () => crypto.randomBytes(24).toString("base64url");
const sameSecret = (left, right) => {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
};

async function ensureIndexes(db) {
  if (indexesReady) return;
  await Promise.all([
    db.collection("mediaProjects").createIndex({ ownerId: 1, updatedAt: -1 }),
    db.collection("mediaProjects").createIndex({ "members.email": 1, updatedAt: -1 }),
    db.collection("mediaAssets").createIndex({ projectId: 1, deletedAt: 1, updatedAt: -1 }),
    db.collection("mediaAssets").createIndex({ projectId: 1, checksum: 1 }, { sparse: true }),
    db.collection("mediaAssets").createIndex({ projectId: 1, uploadSessionId: 1 }, { unique: true, sparse: true }),
    db.collection("mediaAssets").createIndex({ purgeAfter: 1 }, { expireAfterSeconds: 0, sparse: true }),
    db.collection("mediaReviews").createIndex({ projectId: 1, createdAt: -1 }),
    db.collection("mediaRenderJobs").createIndex({ projectId: 1, createdAt: -1 }),
    db.collection("mediaAiTasks").createIndex({ projectId: 1, createdAt: -1 }),
    db.collection("mediaShareLinks").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("mediaShareLinks").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("mediaAudit").createIndex({ projectId: 1, createdAt: -1 })
  ]);
  indexesReady = true;
}

function capabilities() {
  const blob = Boolean(String(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN || "").trim());
  const renderWorker = Boolean(String(process.env.MEDIA_RENDER_WORKER_URL || "").trim());
  const aiWorker = Boolean(String(process.env.MEDIA_AI_WORKER_URL || "").trim());
  return {
    cloud: blob,
    provider: blob ? "vercel-blob-private" : "not-configured",
    multipart: blob,
    signedDownloads: blob,
    renderWorker,
    aiWorker,
    antivirus: false,
    policyScan: true,
    maxUploadBytes: MAX_UPLOAD_BYTES,
    userQuotaBytes: USER_QUOTA_BYTES,
    projectQuotaBytes: PROJECT_QUOTA_BYTES,
    trashRetentionDays: 30,
    messages: {
      cloud: blob ? "Private Blob đã sẵn sàng." : "Chưa kết nối Private Blob.",
      render: renderWorker ? "External render worker đã sẵn sàng." : "Chưa cấu hình external render worker.",
      ai: aiWorker ? "Media AI worker đã sẵn sàng." : "Chưa cấu hình Media AI worker.",
      antivirus: "Đang dùng MIME/checksum policy scan; chưa có antivirus adapter."
    }
  };
}

function publicProject(project, user) {
  const role = roleFor(project, user);
  return {
    id: String(project._id),
    name: project.name,
    description: project.description || "",
    role,
    status: project.status || "active",
    version: Number(project.version || 1),
    reviewStatus: project.reviewStatus || "draft",
    quotaBytes: Number(project.quotaBytes || PROJECT_QUOTA_BYTES),
    members: (project.members || []).map((member) => ({ email: member.email, name: member.name || "", role: member.role })),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
}

function publicAsset(asset) {
  return {
    id: String(asset._id),
    projectId: String(asset.projectId),
    name: asset.name,
    mimeType: asset.mimeType,
    size: Number(asset.size || 0),
    checksum: asset.checksum || "",
    status: asset.status || "pending",
    scanStatus: asset.scanStatus || "policy-pending",
    storageProvider: asset.storageProvider || "",
    version: Number(asset.version || 1),
    versionGroupId: asset.versionGroupId || "",
    license: asset.license || "",
    consentId: asset.consentId || "",
    ai: asset.ai || null,
    deletedAt: asset.deletedAt || null,
    purgeAfter: asset.purgeAfter || null,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt
  };
}

function publicReview(review) {
  return {
    id: String(review._id),
    projectId: String(review.projectId),
    assetId: review.assetId ? String(review.assetId) : "",
    body: review.body,
    anchor: review.anchor,
    annotation: review.annotation || null,
    status: review.status || "open",
    author: review.author,
    replies: review.replies || [],
    reactions: review.reactions || [],
    createdAt: review.createdAt,
    updatedAt: review.updatedAt || review.createdAt
  };
}

function publicJob(job) {
  return {
    id: String(job._id),
    projectId: String(job.projectId),
    name: job.name,
    status: job.status,
    progress: Number(job.progress || 0),
    priority: Number(job.priority || 0),
    dependencies: job.dependencies || [],
    spec: job.spec,
    remoteId: job.remoteId || "",
    output: job.output || null,
    cost: job.cost || null,
    logs: (job.logs || []).slice(-40),
    message: job.message || "",
    idempotencyKey: job.idempotencyKey,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
}

function roleFor(project, user) {
  if (!project || !user) return "";
  if (String(project.ownerId) === String(user._id)) return "owner";
  const email = String(user.email || "").toLowerCase();
  return (project.members || []).find((member) => member.email === email)?.role || "";
}

function allow(project, user, allowed) {
  const role = roleFor(project, user);
  if (!allowed.includes(role)) {
    const error = new Error("Bạn không có quyền thực hiện thao tác này.");
    error.statusCode = 403;
    error.code = "MEDIA_PERMISSION_DENIED";
    throw error;
  }
  return role;
}

async function projectById(db, projectId, user, roles = ["owner", "editor", "reviewer", "viewer"]) {
  const projectObjectId = id(projectId);
  if (!projectObjectId) {
    const error = new Error("Project ID không hợp lệ.");
    error.statusCode = 400;
    error.code = "MEDIA_PROJECT_INVALID";
    throw error;
  }
  const project = await db.collection("mediaProjects").findOne({ _id: projectObjectId });
  if (!project) {
    const error = new Error("Không tìm thấy Media Project.");
    error.statusCode = 404;
    error.code = "MEDIA_PROJECT_NOT_FOUND";
    throw error;
  }
  allow(project, user, roles);
  return project;
}

async function audit(db, project, user, action, detail = {}) {
  await db.collection("mediaAudit").insertOne({
    projectId: project._id,
    actorId: user?._id || null,
    actor: { name: clean(user?.name, 120), email: clean(user?.email, 180).toLowerCase() },
    action: clean(action, 100),
    detail: {
      entityId: clean(detail.entityId, 80),
      label: clean(detail.label, 240),
      from: clean(detail.from, 80),
      to: clean(detail.to, 80)
    },
    createdAt: now()
  });
}

async function userUsage(db, userId, projectId) {
  const [userResult, projectResult] = await Promise.all([
    db.collection("mediaAssets").aggregate([
      { $match: { ownerId: userId, deletedAt: null, storageProvider: "vercel-blob-private" } },
      { $group: { _id: null, bytes: { $sum: "$size" } } }
    ]).toArray(),
    db.collection("mediaAssets").aggregate([
      { $match: { projectId, deletedAt: null, storageProvider: "vercel-blob-private" } },
      { $group: { _id: null, bytes: { $sum: "$size" } } }
    ]).toArray()
  ]);
  return { userBytes: Number(userResult[0]?.bytes || 0), projectBytes: Number(projectResult[0]?.bytes || 0) };
}

function parseClientPayload(value) {
  try {
    const payload = JSON.parse(String(value || "{}"));
    return {
      projectId: clean(payload.projectId, 80),
      name: safeFilename(payload.name),
      mimeType: safeMime(payload.mimeType),
      size: Math.max(0, Number(payload.size || 0)),
      checksum: /^[a-f0-9]{8,128}$/i.test(String(payload.checksum || "")) ? String(payload.checksum).toLowerCase() : "",
      uploadSessionId: /^[a-z0-9-]{6,120}$/i.test(String(payload.uploadSessionId || "")) ? String(payload.uploadSessionId) : "",
      license: clean(payload.license, 120),
      consentId: clean(payload.consentId, 120),
      versionGroupId: clean(payload.versionGroupId, 80)
    };
  } catch {
    return { projectId: "", name: "", mimeType: "", size: 0, checksum: "", uploadSessionId: "", license: "", consentId: "", versionGroupId: "" };
  }
}

async function blobUpload(req, res, db, body) {
  const user = await currentUser(req);
  const result = await handleUpload({
    request: req,
    body,
    onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
      if (!user) {
        const error = new Error("Bạn cần đăng nhập để upload Media Cloud.");
        error.statusCode = 401;
        throw error;
      }
      await enforceRateLimit(db, `media-upload:${String(user._id)}`, 80, 60 * 60 * 1000);
      const meta = parseClientPayload(clientPayload);
      if (!meta.projectId || !meta.mimeType || meta.size <= 0 || meta.size > MAX_UPLOAD_BYTES) {
        const error = new Error("Metadata upload không hợp lệ hoặc file vượt giới hạn.");
        error.statusCode = 400;
        error.code = "MEDIA_UPLOAD_INVALID";
        throw error;
      }
      const project = await projectById(db, meta.projectId, user, ["owner", "editor"]);
      const expectedPrefix = `media/${String(project._id)}/`;
      if (!String(pathname || "").startsWith(expectedPrefix)) {
        const error = new Error("Đường dẫn upload không thuộc project hiện tại.");
        error.statusCode = 403;
        throw error;
      }
      const usage = await userUsage(db, user._id, project._id);
      if (usage.userBytes + meta.size > USER_QUOTA_BYTES || usage.projectBytes + meta.size > Number(project.quotaBytes || PROJECT_QUOTA_BYTES)) {
        const error = new Error("Dung lượng Media Cloud đã vượt quota.");
        error.statusCode = 413;
        error.code = "MEDIA_QUOTA_EXCEEDED";
        throw error;
      }
      const duplicate = meta.checksum ? await db.collection("mediaAssets").findOne({ projectId: project._id, checksum: meta.checksum, size: meta.size, deletedAt: null }) : null;
      const uploadDraft = meta.uploadSessionId ? await db.collection("mediaAssets").findOne({ projectId: project._id, uploadSessionId: meta.uploadSessionId }) : null;
      const draft = {
        projectId: project._id,
        ownerId: user._id,
        createdBy: user._id,
        name: meta.name,
        mimeType: meta.mimeType,
        size: meta.size,
        checksum: meta.checksum,
        ...(meta.uploadSessionId ? { uploadSessionId: meta.uploadSessionId } : {}),
        license: meta.license,
        consentId: meta.consentId,
        versionGroupId: meta.versionGroupId || randomToken().slice(0, 20),
        version: 1,
        pathname,
        multipart: Boolean(multipart),
        status: duplicate ? "duplicate-pending" : "uploading",
        duplicateOf: duplicate?._id || null,
        scanStatus: "policy-pending",
        deletedAt: null,
        purgeAfter: null,
        createdAt: now(),
        updatedAt: now()
      };
      let assetId = uploadDraft?._id;
      if (uploadDraft) {
        await db.collection("mediaAssets").updateOne({ _id: uploadDraft._id }, { $set: { ...draft, createdAt: uploadDraft.createdAt || draft.createdAt } });
      } else {
        assetId = (await db.collection("mediaAssets").insertOne(draft)).insertedId;
      }
      await audit(db, project, user, uploadDraft ? "asset.upload.resumed" : "asset.upload.started", { entityId: String(assetId), label: meta.name });
      return {
        allowedContentTypes: [meta.mimeType],
        maximumSizeInBytes: Math.min(MAX_UPLOAD_BYTES, Math.max(meta.size, 1)),
        validUntil: Date.now() + 60 * 60 * 1000,
        addRandomSuffix: true,
        allowOverwrite: false,
        cacheControlMaxAge: 60,
        tokenPayload: JSON.stringify({ assetId: String(assetId), projectId: String(project._id), userId: String(user._id), pathname, meta })
      };
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      let payload;
      try { payload = JSON.parse(String(tokenPayload || "{}")); } catch { payload = {}; }
      const assetId = id(payload.assetId);
      const projectId = id(payload.projectId);
      if (!assetId || !projectId || !String(blob.pathname || "").startsWith(`media/${String(projectId)}/`)) return;
      const meta = payload.meta || {};
      const scanStatus = safeMime(blob.contentType || meta.mimeType) ? "policy-pass" : "blocked";
      await db.collection("mediaAssets").updateOne(
        { _id: assetId, projectId },
        { $set: {
          pathname: blob.pathname,
          blobUrl: blob.url,
          storageProvider: "vercel-blob-private",
          mimeType: safeMime(blob.contentType || meta.mimeType) || "application/octet-stream",
          status: scanStatus === "blocked" ? "quarantine" : "ready",
          scanStatus,
          etag: clean(blob.etag, 160),
          updatedAt: now()
        } }
      );
      await db.collection("mediaAudit").insertOne({ projectId, actorId: id(payload.userId), action: "asset.upload.completed", detail: { entityId: String(assetId), label: safeFilename(meta.name) }, createdAt: now() });
    }
  });
  return res.status(200).json(result);
}

async function callWorker(url, token, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data || data.accepted !== true || !clean(data.id || data.jobId, 160)) throw new Error("Worker không xác nhận job.");
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function cleanSpec(value) {
  const spec = value && typeof value === "object" ? value : {};
  const codecs = new Set(["h264", "h265", "prores", "vp9", "av1", "wav", "flac", "png", "jpeg", "webp"]);
  return {
    preset: clean(spec.preset || "youtube-16x9", 80),
    codec: codecs.has(String(spec.codec || "").toLowerCase()) ? String(spec.codec).toLowerCase() : "h264",
    width: Math.max(16, Math.min(16384, Number(spec.width || 1920))),
    height: Math.max(16, Math.min(16384, Number(spec.height || 1080))),
    fps: Math.max(1, Math.min(120, Number(spec.fps || 30))),
    bitrate: Math.max(128, Math.min(500000, Number(spec.bitrate || 12000))),
    sourceAssetIds: (Array.isArray(spec.sourceAssetIds) ? spec.sourceAssetIds : []).map((item) => clean(item, 80)).filter(Boolean).slice(0, 200),
    manifest: Boolean(spec.manifest !== false),
    hardwarePreferred: Boolean(spec.hardwarePreferred)
  };
}

async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    await ensureIndexes(db);
    const action = clean(body.action || req.query?.action, 60);
    if (req.method === "POST" && (action === "blob-upload" || String(body.type || "").startsWith("blob."))) {
      return blobUpload(req, res, db, body);
    }
    if (req.method === "POST" && ["render:worker-register-output", "ai:worker-register-output"].includes(action)) {
      const kind = action.startsWith("render:") ? "render" : "ai";
      const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      const expected = kind === "render"
        ? String(process.env.MEDIA_RENDER_CALLBACK_TOKEN || process.env.MEDIA_RENDER_WORKER_TOKEN || "")
        : String(process.env.MEDIA_AI_CALLBACK_TOKEN || process.env.MEDIA_AI_WORKER_TOKEN || "");
      if (!sameSecret(bearer, expected)) return res.status(401).json({ error: "Worker output callback không hợp lệ." });
      const entityId = id(kind === "render" ? body.jobId : body.taskId);
      const collection = kind === "render" ? "mediaRenderJobs" : "mediaAiTasks";
      const entity = entityId ? await db.collection(collection).findOne({ _id: entityId }) : null;
      if (!entity) return res.status(404).json({ error: "Không tìm thấy worker task." });
      const pathname = clean(body.pathname, 600);
      if (!pathname.startsWith(`media/${String(entity.projectId)}/`)) return res.status(403).json({ error: "Worker output không thuộc project." });
      const verified = await head(pathname, { access: "private" });
      const mimeType = safeMime(verified.contentType || body.mimeType);
      if (!mimeType) return res.status(415).json({ error: "Định dạng worker output không được phép." });
      const project = await db.collection("mediaProjects").findOne({ _id: entity.projectId });
      if (!project) return res.status(404).json({ error: "Không tìm thấy Media Project." });
      let asset = await db.collection("mediaAssets").findOne({ projectId: entity.projectId, pathname });
      if (!asset) {
        asset = {
          projectId: entity.projectId,
          ownerId: project.ownerId,
          createdBy: entity.createdBy,
          name: safeFilename(body.name || verified.pathname?.split("/").pop()),
          mimeType,
          size: Number(verified.size || 0),
          checksum: /^[a-f0-9]{8,128}$/i.test(String(body.checksum || "")) ? String(body.checksum).toLowerCase() : "",
          pathname,
          blobUrl: verified.url,
          etag: clean(verified.etag, 160),
          storageProvider: "vercel-blob-private",
          status: "ready",
          scanStatus: "mime-policy-pass",
          license: clean(body.license || "project-generated", 120),
          consentId: clean(body.consentId, 120),
          version: 1,
          versionGroupId: clean(body.versionGroupId, 80) || randomToken().slice(0, 20),
          ai: kind === "ai" ? { taskId: String(entity._id), provider: entity.spec?.provider || "", model: entity.spec?.model || "", seed: entity.spec?.seed || 0 } : null,
          render: kind === "render" ? { jobId: String(entity._id), codec: entity.spec?.codec || "", preset: entity.spec?.preset || "" } : null,
          deletedAt: null,
          purgeAfter: null,
          createdAt: now(),
          updatedAt: now()
        };
        asset._id = (await db.collection("mediaAssets").insertOne(asset)).insertedId;
      }
      await audit(db, project, null, `${kind}.worker.output.registered`, { entityId: String(asset._id), label: asset.name });
      return res.status(201).json({ ok: true, asset: publicAsset(asset) });
    }
    if (req.method === "POST" && action === "render:worker-update") {
      const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      const expected = String(process.env.MEDIA_RENDER_CALLBACK_TOKEN || process.env.MEDIA_RENDER_WORKER_TOKEN || "");
      if (!sameSecret(bearer, expected)) return res.status(401).json({ error: "Worker callback không hợp lệ." });
      const jobId = id(body.jobId);
      const job = jobId ? await db.collection("mediaRenderJobs").findOne({ _id: jobId }) : null;
      if (!job) return res.status(404).json({ error: "Không tìm thấy render job." });
      const status = clean(body.status, 30);
      if (!["queued", "running", "completed", "failed", "canceled"].includes(status)) return res.status(400).json({ error: "Trạng thái worker không hợp lệ." });
      const outputAssetIds = [...new Set((Array.isArray(body.outputAssetIds) ? body.outputAssetIds : []).map((item) => clean(item, 80)).filter((item) => id(item)).slice(0, 100))];
      const manifestAssetId = clean(body.manifestAssetId, 80);
      if (status === "completed" && !outputAssetIds.length && !id(manifestAssetId)) return res.status(409).json({ error: "Worker phải đăng ký output asset hoặc manifest trước khi báo hoàn tất." });
      if (status === "completed") {
        const requestedAssets = [...new Set([...outputAssetIds, ...(id(manifestAssetId) ? [manifestAssetId] : [])])];
        const verifiedCount = await db.collection("mediaAssets").countDocuments({ _id: { $in: requestedAssets.map(id) }, projectId: job.projectId, status: "ready", deletedAt: null });
        if (verifiedCount !== requestedAssets.length) return res.status(409).json({ error: "Output asset của worker chưa được đăng ký an toàn trong project." });
      }
      const message = clean(body.message || `Worker cập nhật ${status}.`, 300);
      const update = {
        status,
        progress: status === "completed" ? 100 : Math.max(0, Math.min(99.9, Number(body.progress || 0))),
        output: { assetIds: outputAssetIds, manifestAssetId: id(manifestAssetId) ? manifestAssetId : "" },
        cost: Number.isFinite(Number(body.cost?.amount)) && Number(body.cost.amount) >= 0 ? { amount: Number(body.cost.amount), currency: clean(body.cost.currency || "USD", 12) } : null,
        message,
        updatedAt: now()
      };
      const updated = await db.collection("mediaRenderJobs").findOneAndUpdate(
        { _id: job._id },
        { $set: update, $push: { logs: { code: `WORKER_${status.toUpperCase()}`, message, at: now() } } },
        { returnDocument: "after" }
      );
      const project = await db.collection("mediaProjects").findOne({ _id: job.projectId });
      if (project) await audit(db, project, null, "render.worker.updated", { entityId: String(job._id), to: status });
      return res.status(200).json({ ok: true, job: publicJob(updated) });
    }
    if (req.method === "POST" && action === "ai:worker-update") {
      const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      const expected = String(process.env.MEDIA_AI_CALLBACK_TOKEN || process.env.MEDIA_AI_WORKER_TOKEN || "");
      if (!sameSecret(bearer, expected)) return res.status(401).json({ error: "AI worker callback không hợp lệ." });
      const taskId = id(body.taskId);
      const task = taskId ? await db.collection("mediaAiTasks").findOne({ _id: taskId }) : null;
      if (!task) return res.status(404).json({ error: "Không tìm thấy AI task." });
      const status = clean(body.status, 30);
      if (!["queued", "running", "completed", "failed", "canceled"].includes(status)) return res.status(400).json({ error: "Trạng thái AI worker không hợp lệ." });
      const outputAssetIds = [...new Set((Array.isArray(body.outputAssetIds) ? body.outputAssetIds : []).map((item) => clean(item, 80)).filter((item) => id(item)).slice(0, 100))];
      if (status === "completed") {
        if (!outputAssetIds.length) return res.status(409).json({ error: "AI worker phải đăng ký output asset trước khi báo hoàn tất." });
        const verifiedCount = await db.collection("mediaAssets").countDocuments({ _id: { $in: outputAssetIds.map(id) }, projectId: task.projectId, status: "ready", deletedAt: null });
        if (verifiedCount !== outputAssetIds.length) return res.status(409).json({ error: "AI output asset chưa được đăng ký an toàn trong project." });
      }
      const message = clean(body.message || `AI worker cập nhật ${status}.`, 300);
      const update = {
        status,
        outputAssetIds,
        cost: Number.isFinite(Number(body.cost?.amount)) && Number(body.cost.amount) >= 0 ? { amount: Number(body.cost.amount), currency: clean(body.cost.currency || "USD", 12) } : null,
        message,
        updatedAt: now()
      };
      const updated = await db.collection("mediaAiTasks").findOneAndUpdate({ _id: task._id }, { $set: update }, { returnDocument: "after" });
      const project = await db.collection("mediaProjects").findOne({ _id: task.projectId });
      if (project) await audit(db, project, null, "ai.worker.updated", { entityId: String(task._id), to: status });
      return res.status(200).json({ ok: true, task: { id: String(updated._id), name: updated.name, status: updated.status, cost: updated.cost, outputAssetIds: updated.outputAssetIds, message: updated.message } });
    }

    const user = await currentUser(req);
    const shareToken = clean(req.query?.shareToken || body.shareToken, 200);
    if (req.method === "POST" && action === "review:access-link" && shareToken) {
      const link = await db.collection("mediaShareLinks").findOne({ tokenHash: hashToken(shareToken), expiresAt: { $gt: now() }, revokedAt: null });
      if (!link) return res.status(404).json({ error: "Link review không tồn tại hoặc đã hết hạn." });
      if (link.passwordHash && link.passwordHash !== hashToken(`${shareToken}:${clean(body.password, 120)}`)) {
        return res.status(401).json({ error: "Mật khẩu review không đúng.", code: "SHARE_PASSWORD_INVALID" });
      }
      const reviews = await db.collection("mediaReviews").find({ projectId: link.projectId }).sort({ createdAt: -1 }).limit(200).toArray();
      return res.status(200).json({ share: { projectId: String(link.projectId), canDownload: Boolean(link.canDownload), watermark: link.watermark || "", expiresAt: link.expiresAt }, reviews: reviews.map(publicReview) });
    }
    if (!user && req.method === "GET" && shareToken) {
      const link = await db.collection("mediaShareLinks").findOne({ tokenHash: hashToken(shareToken), expiresAt: { $gt: now() }, revokedAt: null });
      if (!link) return res.status(404).json({ error: "Link review không tồn tại hoặc đã hết hạn." });
      if (link.passwordHash) return res.status(401).json({ error: "Link review yêu cầu mật khẩu.", code: "SHARE_PASSWORD_REQUIRED" });
      const reviews = await db.collection("mediaReviews").find({ projectId: link.projectId }).sort({ createdAt: -1 }).limit(200).toArray();
      return res.status(200).json({ share: { projectId: String(link.projectId), canDownload: Boolean(link.canDownload), watermark: link.watermark || "", expiresAt: link.expiresAt }, reviews: reviews.map(publicReview) });
    }
    if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để sử dụng Media Cloud.", code: "AUTH_REQUIRED", capabilities: capabilities() });

    if (req.method === "GET") {
      const filter = { $or: [{ ownerId: user._id }, { "members.email": String(user.email || "").toLowerCase() }] };
      const projects = await db.collection("mediaProjects").find(filter).sort({ updatedAt: -1 }).limit(50).toArray();
      const selected = req.query?.projectId ? projects.find((item) => String(item._id) === String(req.query.projectId)) : projects[0];
      if (!selected) return res.status(200).json({ projects: [], assets: [], reviews: [], jobs: [], aiTasks: [], audit: [], usage: { userBytes: 0, projectBytes: 0 }, capabilities: capabilities() });
      allow(selected, user, ["owner", "editor", "reviewer", "viewer"]);
      const includeTrash = req.query?.trash === "1";
      const assetFilter = { projectId: selected._id, ...(includeTrash ? { deletedAt: { $ne: null } } : { deletedAt: null }) };
      const [assets, reviews, jobs, aiTasks, auditRows, usage] = await Promise.all([
        db.collection("mediaAssets").find(assetFilter, { projection: { blobUrl: 0, pathname: 0 } }).sort({ updatedAt: -1 }).limit(500).toArray(),
        db.collection("mediaReviews").find({ projectId: selected._id }).sort({ createdAt: -1 }).limit(300).toArray(),
        db.collection("mediaRenderJobs").find({ projectId: selected._id }).sort({ createdAt: -1 }).limit(200).toArray(),
        db.collection("mediaAiTasks").find({ projectId: selected._id }).sort({ createdAt: -1 }).limit(100).toArray(),
        db.collection("mediaAudit").find({ projectId: selected._id }).sort({ createdAt: -1 }).limit(200).toArray(),
        userUsage(db, user._id, selected._id)
      ]);
      return res.status(200).json({
        projects: projects.map((project) => publicProject(project, user)),
        project: publicProject(selected, user),
        assets: assets.map(publicAsset),
        reviews: reviews.map(publicReview),
        jobs: jobs.map(publicJob),
        aiTasks: aiTasks.map((task) => ({ id: String(task._id), name: task.name, status: task.status, spec: task.spec, cost: task.cost || null, outputAssetIds: task.outputAssetIds || [], message: task.message || "", createdAt: task.createdAt, updatedAt: task.updatedAt })),
        audit: auditRows.map((row) => ({ id: String(row._id), action: row.action, actor: row.actor, detail: row.detail, createdAt: row.createdAt })),
        usage,
        capabilities: capabilities()
      });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    if (action === "project:create") {
      await enforceRateLimit(db, `media-project:${String(user._id)}`, 20, 60 * 60 * 1000);
      const createdAt = now();
      const project = {
        ownerId: user._id,
        name: clean(body.name || "Universal Media Project", 140) || "Universal Media Project",
        description: clean(body.description, 1000),
        status: "active",
        reviewStatus: "draft",
        version: 1,
        quotaBytes: PROJECT_QUOTA_BYTES,
        members: [],
        createdAt,
        updatedAt: createdAt
      };
      const result = await db.collection("mediaProjects").insertOne(project);
      project._id = result.insertedId;
      await audit(db, project, user, "project.created", { entityId: String(project._id), label: project.name });
      return res.status(201).json({ ok: true, project: publicProject(project, user), capabilities: capabilities() });
    }

    const project = await projectById(db, body.projectId, user);

    if (action === "project:update") {
      allow(project, user, ["owner", "editor"]);
      const expectedVersion = Math.max(1, Number(body.version || project.version));
      const update = { name: clean(body.name || project.name, 140), description: clean(body.description ?? project.description, 1000), updatedAt: now() };
      const result = await db.collection("mediaProjects").findOneAndUpdate(
        { _id: project._id, version: expectedVersion },
        { $set: update, $inc: { version: 1 } },
        { returnDocument: "after" }
      );
      if (!result) return res.status(409).json({ error: "Project đã thay đổi trên thiết bị khác. Hãy tải lại trước khi hợp nhất.", code: "MEDIA_VERSION_CONFLICT" });
      await audit(db, project, user, "project.updated", { entityId: String(project._id), label: update.name });
      return res.status(200).json({ ok: true, project: publicProject(result, user) });
    }

    if (action === "member:set-role") {
      allow(project, user, ["owner"]);
      const email = clean(body.email, 180).toLowerCase();
      const role = clean(body.role, 20);
      if (!/^\S+@\S+\.\S+$/.test(email) || !ROLES.has(role) || role === "owner") return res.status(400).json({ error: "Email hoặc vai trò không hợp lệ." });
      const members = (project.members || []).filter((member) => member.email !== email);
      members.push({ email, name: clean(body.name, 120), role, updatedAt: now() });
      await db.collection("mediaProjects").updateOne({ _id: project._id }, { $set: { members: members.slice(-100), updatedAt: now() }, $inc: { version: 1 } });
      await audit(db, project, user, "member.role.updated", { label: email, to: role });
      return res.status(200).json({ ok: true, member: { email, role } });
    }

    if (action === "asset:register") {
      allow(project, user, ["owner", "editor"]);
      const pathname = clean(body.blob?.pathname, 600);
      if (!pathname.startsWith(`media/${String(project._id)}/`)) return res.status(403).json({ error: "Blob không thuộc project hiện tại." });
      const verified = await head(pathname, { access: "private" });
      const uploadSessionId = /^[a-z0-9-]{6,120}$/i.test(String(body.uploadSessionId || "")) ? String(body.uploadSessionId) : "";
      const existing = await db.collection("mediaAssets").findOne({ projectId: project._id, $or: [{ pathname }, ...(uploadSessionId ? [{ uploadSessionId }] : [])] });
      const scanStatus = safeMime(verified.contentType) ? "policy-pass" : "blocked";
      const update = {
        pathname,
        blobUrl: verified.url,
        etag: clean(verified.etag, 160),
        size: Number(verified.size || body.size || existing?.size || 0),
        mimeType: safeMime(verified.contentType || body.mimeType) || "application/octet-stream",
        storageProvider: "vercel-blob-private",
        status: scanStatus === "blocked" ? "quarantine" : "ready",
        scanStatus,
        updatedAt: now()
      };
      let row;
      if (existing) {
        row = await db.collection("mediaAssets").findOneAndUpdate({ _id: existing._id }, { $set: update }, { returnDocument: "after" });
      } else {
        row = {
          ...update,
          projectId: project._id,
          ownerId: user._id,
          createdBy: user._id,
          name: safeFilename(body.name),
          checksum: clean(body.checksum, 128),
          ...(uploadSessionId ? { uploadSessionId } : {}),
          license: clean(body.license, 120),
          consentId: clean(body.consentId, 120),
          version: 1,
          versionGroupId: clean(body.versionGroupId, 80) || randomToken().slice(0, 20),
          deletedAt: null,
          purgeAfter: null,
          createdAt: now()
        };
        const inserted = await db.collection("mediaAssets").insertOne(row);
        row._id = inserted.insertedId;
      }
      await audit(db, project, user, "asset.registered", { entityId: String(row._id), label: row.name });
      return res.status(201).json({ ok: true, asset: publicAsset(row) });
    }

    const assetId = id(body.assetId);
    if (action.startsWith("asset:") && action !== "asset:register") {
      if (!assetId) return res.status(400).json({ error: "Asset ID không hợp lệ." });
      const asset = await db.collection("mediaAssets").findOne({ _id: assetId, projectId: project._id });
      if (!asset) return res.status(404).json({ error: "Không tìm thấy asset." });
      if (action === "asset:download-link") {
        allow(project, user, ["owner", "editor", "reviewer", "viewer"]);
        if (!asset.pathname || asset.deletedAt || asset.status === "quarantine") return res.status(409).json({ error: "Asset chưa sẵn sàng để tải." });
        const validUntil = Date.now() + Math.max(60_000, Math.min(60 * 60 * 1000, Number(body.ttlMs || 10 * 60 * 1000)));
        const signedToken = await issueSignedToken({ pathname: asset.pathname, operations: ["get"], validUntil });
        const signed = await presignUrl(signedToken, { operation: "get", pathname: asset.pathname, access: "private", validUntil, useCache: false });
        await audit(db, project, user, "asset.download.signed", { entityId: String(asset._id), label: asset.name });
        return res.status(200).json({ ok: true, url: signed.presignedUrl, expiresAt: new Date(validUntil).toISOString() });
      }
      allow(project, user, ["owner", "editor"]);
      if (action === "asset:trash") {
        const deletedAt = now(), purgeAfter = new Date(deletedAt.getTime() + TRASH_RETENTION_MS);
        await db.collection("mediaAssets").updateOne({ _id: asset._id }, { $set: { deletedAt, purgeAfter, status: "trashed", updatedAt: deletedAt } });
        await audit(db, project, user, "asset.trashed", { entityId: String(asset._id), label: asset.name });
        return res.status(200).json({ ok: true, purgeAfter });
      }
      if (action === "asset:restore") {
        await db.collection("mediaAssets").updateOne({ _id: asset._id }, { $set: { deletedAt: null, purgeAfter: null, status: "ready", updatedAt: now() } });
        await audit(db, project, user, "asset.restored", { entityId: String(asset._id), label: asset.name });
        return res.status(200).json({ ok: true });
      }
      if (action === "asset:purge") {
        allow(project, user, ["owner"]);
        if (asset.pathname) await del(asset.pathname).catch(() => {});
        await db.collection("mediaAssets").deleteOne({ _id: asset._id });
        await audit(db, project, user, "asset.purged", { entityId: String(asset._id), label: asset.name });
        return res.status(200).json({ ok: true });
      }
      if (action === "asset:metadata") {
        const update = { license: clean(body.license, 120), consentId: clean(body.consentId, 120), updatedAt: now() };
        await db.collection("mediaAssets").updateOne({ _id: asset._id }, { $set: update });
        await audit(db, project, user, "asset.metadata.updated", { entityId: String(asset._id), label: asset.name });
        return res.status(200).json({ ok: true });
      }
    }

    if (action === "review:create") {
      allow(project, user, ["owner", "editor", "reviewer"]);
      const createdAt = now();
      const reviewAssetId = id(body.assetId);
      if (reviewAssetId && !await db.collection("mediaAssets").findOne({ _id: reviewAssetId, projectId: project._id }, { projection: { _id: 1 } })) {
        return res.status(400).json({ error: "Asset review không thuộc project hiện tại." });
      }
      const review = {
        projectId: project._id,
        assetId: reviewAssetId,
        body: clean(body.comment, 1500),
        anchor: {
          type: ["pixel", "frame", "range", "project"].includes(body.anchor?.type) ? body.anchor.type : "project",
          x: Math.max(0, Math.min(1, Number(body.anchor?.x || 0))),
          y: Math.max(0, Math.min(1, Number(body.anchor?.y || 0))),
          frame: Math.max(0, Number(body.anchor?.frame || 0)),
          from: Math.max(0, Number(body.anchor?.from || 0)),
          to: Math.max(0, Number(body.anchor?.to || 0))
        },
        annotation: body.annotation ? { tool: clean(body.annotation.tool, 30), color: clean(body.annotation.color, 20), points: (Array.isArray(body.annotation.points) ? body.annotation.points : []).slice(0, 500).map((point) => ({ x: Math.max(0, Math.min(1, Number(point.x || 0))), y: Math.max(0, Math.min(1, Number(point.y || 0))) })) } : null,
        status: "open",
        author: { id: String(user._id), name: clean(user.name, 120), email: clean(user.email, 180) },
        replies: [],
        reactions: [],
        createdAt,
        updatedAt: createdAt
      };
      if (!review.body) return res.status(400).json({ error: "Nội dung review đang trống." });
      const inserted = await db.collection("mediaReviews").insertOne(review);
      review._id = inserted.insertedId;
      await audit(db, project, user, "review.created", { entityId: String(review._id), label: review.body });
      return res.status(201).json({ ok: true, review: publicReview(review) });
    }

    if (["review:reply", "review:react", "review:resolve"].includes(action)) {
      allow(project, user, ["owner", "editor", "reviewer"]);
      const reviewId = id(body.reviewId);
      const review = reviewId ? await db.collection("mediaReviews").findOne({ _id: reviewId, projectId: project._id }) : null;
      if (!review) return res.status(404).json({ error: "Không tìm thấy review." });
      if (action === "review:reply") {
        const reply = { id: randomToken().slice(0, 18), body: clean(body.reply, 1000), author: { id: String(user._id), name: clean(user.name, 120) }, createdAt: now() };
        if (!reply.body) return res.status(400).json({ error: "Reply đang trống." });
        await db.collection("mediaReviews").updateOne({ _id: review._id }, { $push: { replies: reply }, $set: { updatedAt: now() } });
      }
      if (action === "review:react") {
        const reaction = clean(body.reaction, 20);
        await db.collection("mediaReviews").updateOne({ _id: review._id }, { $pull: { reactions: { userId: String(user._id) } } });
        if (reaction) await db.collection("mediaReviews").updateOne({ _id: review._id }, { $push: { reactions: { userId: String(user._id), type: reaction, createdAt: now() } }, $set: { updatedAt: now() } });
      }
      if (action === "review:resolve") await db.collection("mediaReviews").updateOne({ _id: review._id }, { $set: { status: "resolved", resolvedAt: now(), updatedAt: now() } });
      await audit(db, project, user, action, { entityId: String(review._id) });
      return res.status(200).json({ ok: true });
    }

    if (action === "review:set-status") {
      allow(project, user, ["owner", "editor", "reviewer"]);
      const status = clean(body.status, 30);
      if (!REVIEW_STATES.has(status)) return res.status(400).json({ error: "Trạng thái review không hợp lệ." });
      if (status === "approved" && !["owner", "reviewer"].includes(roleFor(project, user))) return res.status(403).json({ error: "Chỉ Owner hoặc Reviewer được duyệt." });
      await db.collection("mediaProjects").updateOne({ _id: project._id }, { $set: { reviewStatus: status, updatedAt: now() }, $inc: { version: 1 } });
      await audit(db, project, user, "review.status.changed", { from: project.reviewStatus || "draft", to: status });
      return res.status(200).json({ ok: true, status });
    }

    if (action === "review:create-link") {
      allow(project, user, ["owner", "editor"]);
      const token = randomToken();
      const expiresAt = new Date(Date.now() + Math.max(5 * 60 * 1000, Math.min(30 * 24 * 60 * 60 * 1000, Number(body.ttlMs || 7 * 24 * 60 * 60 * 1000))));
      const password = clean(body.password, 120);
      await db.collection("mediaShareLinks").insertOne({
        projectId: project._id,
        createdBy: user._id,
        tokenHash: hashToken(token),
        passwordHash: password ? hashToken(`${token}:${password}`) : "",
        canDownload: Boolean(body.canDownload),
        watermark: clean(body.watermark || user.email, 180),
        expiresAt,
        revokedAt: null,
        createdAt: now()
      });
      await audit(db, project, user, "review.link.created", { label: expiresAt.toISOString() });
      return res.status(201).json({ ok: true, token, expiresAt, canDownload: Boolean(body.canDownload), passwordProtected: Boolean(password) });
    }

    if (action === "render:create") {
      allow(project, user, ["owner", "editor"]);
      const spec = cleanSpec(body.spec);
      spec.sourceAssetIds = [...new Set(spec.sourceAssetIds)];
      if (spec.sourceAssetIds.some((item) => !id(item))) return res.status(400).json({ error: "Render source asset không hợp lệ." });
      if (spec.sourceAssetIds.length) {
        const verifiedCount = await db.collection("mediaAssets").countDocuments({ _id: { $in: spec.sourceAssetIds.map(id) }, projectId: project._id, status: "ready", deletedAt: null });
        if (verifiedCount !== spec.sourceAssetIds.length) return res.status(409).json({ error: "Một hoặc nhiều render source chưa sẵn sàng trong project." });
      }
      const idempotencyKey = clean(body.idempotencyKey, 160) || hashToken(`${String(project._id)}:${JSON.stringify(spec)}`).slice(0, 48);
      const existing = await db.collection("mediaRenderJobs").findOne({ projectId: project._id, idempotencyKey, status: { $in: ["needs-worker", "queued", "paused", "running", "completed"] } });
      if (existing) return res.status(200).json({ ok: true, reused: true, job: publicJob(existing) });
      const createdAt = now();
      const job = {
        projectId: project._id,
        createdBy: user._id,
        name: clean(body.name || `${project.name} · ${spec.preset}`, 160),
        spec,
        status: "needs-worker",
        progress: 0,
        priority: Math.max(-10, Math.min(10, Number(body.priority || 0))),
        dependencies: (Array.isArray(body.dependencies) ? body.dependencies : []).map((item) => clean(item, 80)).filter(Boolean).slice(0, 40),
        idempotencyKey,
        remoteId: "",
        output: null,
        cost: null,
        logs: [{ code: "JOB_CREATED", message: "Job spec đã được lưu; chưa render.", at: createdAt }],
        message: capabilities().renderWorker ? "Đang gửi tới external worker." : "Cần external render worker.",
        createdAt,
        updatedAt: createdAt
      };
      const inserted = await db.collection("mediaRenderJobs").insertOne(job);
      job._id = inserted.insertedId;
      if (capabilities().renderWorker) {
        try {
          const accepted = await callWorker(process.env.MEDIA_RENDER_WORKER_URL, process.env.MEDIA_RENDER_WORKER_TOKEN, { action: "create", jobId: String(job._id), projectId: String(project._id), idempotencyKey, spec });
          job.status = "queued";
          job.remoteId = clean(accepted.id || accepted.jobId, 160);
          job.message = clean(accepted.message || "External worker đã nhận job.", 300);
          job.logs.push({ code: "WORKER_ACCEPTED", message: job.message, at: now() });
          await db.collection("mediaRenderJobs").updateOne({ _id: job._id }, { $set: { status: job.status, remoteId: job.remoteId, message: job.message, logs: job.logs, updatedAt: now() } });
        } catch {
          job.status = "needs-worker";
          job.message = "Worker chưa xác nhận job; chưa có render hoặc chi phí.";
          await db.collection("mediaRenderJobs").updateOne({ _id: job._id }, { $set: { status: job.status, message: job.message, updatedAt: now() }, $push: { logs: { code: "WORKER_UNAVAILABLE", message: job.message, at: now() } } });
        }
      }
      await audit(db, project, user, "render.created", { entityId: String(job._id), label: job.name });
      return res.status(201).json({ ok: true, job: publicJob(job), capabilities: capabilities() });
    }

    if (["render:pause", "render:resume", "render:cancel", "render:retry", "render:duplicate"].includes(action)) {
      allow(project, user, ["owner", "editor"]);
      const jobId = id(body.jobId);
      const job = jobId ? await db.collection("mediaRenderJobs").findOne({ _id: jobId, projectId: project._id }) : null;
      if (!job) return res.status(404).json({ error: "Không tìm thấy render job." });
      if (action === "render:duplicate") {
        const jobFields = { ...job };
        delete jobFields._id;
        const copy = {
          ...jobFields,
          name: `${job.name} Copy`,
          status: "needs-worker",
          progress: 0,
          remoteId: "",
          output: null,
          cost: null,
          idempotencyKey: hashToken(`${job.idempotencyKey}:${Date.now()}`).slice(0, 48),
          logs: [{ code: "JOB_DUPLICATED", message: `Tạo từ ${String(job._id)}`, at: now() }],
          message: capabilities().renderWorker ? "Đang gửi bản sao tới external worker." : "Cần external render worker.",
          createdAt: now(),
          updatedAt: now()
        };
        const inserted = await db.collection("mediaRenderJobs").insertOne(copy);
        copy._id = inserted.insertedId;
        if (capabilities().renderWorker) {
          try {
            const accepted = await callWorker(process.env.MEDIA_RENDER_WORKER_URL, process.env.MEDIA_RENDER_WORKER_TOKEN, { action: "create", jobId: String(copy._id), projectId: String(project._id), idempotencyKey: copy.idempotencyKey, spec: copy.spec });
            copy.status = "queued";
            copy.remoteId = clean(accepted.id || accepted.jobId, 160);
            copy.message = clean(accepted.message || "External worker đã nhận bản sao.", 300);
            copy.logs.push({ code: "WORKER_ACCEPTED", message: copy.message, at: now() });
            await db.collection("mediaRenderJobs").updateOne({ _id: copy._id }, { $set: { status: copy.status, remoteId: copy.remoteId, message: copy.message, logs: copy.logs, updatedAt: now() } });
          } catch {
            copy.message = "Worker chưa xác nhận bản sao; chưa phát sinh render hoặc chi phí.";
            await db.collection("mediaRenderJobs").updateOne({ _id: copy._id }, { $set: { message: copy.message, updatedAt: now() } });
          }
        }
        await audit(db, project, user, "render.duplicated", { entityId: String(copy._id), from: String(job._id) });
        return res.status(201).json({ ok: true, job: publicJob(copy) });
      }
      const desired = { "render:pause": "paused", "render:resume": "queued", "render:cancel": "canceled", "render:retry": capabilities().renderWorker ? "queued" : "needs-worker" }[action];
      let message = capabilities().renderWorker ? `Đã gửi ${action.split(":")[1]} tới worker.` : "Chưa có worker; chỉ cập nhật kế hoạch điều phối.";
      if (capabilities().renderWorker && job.remoteId) {
        try {
          const accepted = await callWorker(process.env.MEDIA_RENDER_WORKER_URL, process.env.MEDIA_RENDER_WORKER_TOKEN, { action: action.split(":")[1], jobId: String(job._id), remoteId: job.remoteId });
          message = clean(accepted.message || message, 300);
        } catch {
          return res.status(409).json({ error: "Worker chưa xác nhận thao tác; trạng thái job không thay đổi.", code: "MEDIA_WORKER_NOT_CONFIRMED" });
        }
      }
      const updated = await db.collection("mediaRenderJobs").findOneAndUpdate({ _id: job._id }, { $set: { status: desired, message, updatedAt: now() }, $push: { logs: { code: action.toUpperCase().replace(":", "_"), message, at: now() } } }, { returnDocument: "after" });
      await audit(db, project, user, action, { entityId: String(job._id) });
      return res.status(200).json({ ok: true, job: publicJob(updated) });
    }

    if (action === "ai:create") {
      allow(project, user, ["owner", "editor"]);
      const spec = {
        provider: clean(body.spec?.provider || "media-ai", 80),
        model: clean(body.spec?.model || "default", 100),
        operation: clean(body.spec?.operation || "generate-image", 80),
        prompt: clean(body.spec?.prompt, 4000),
        negativePrompt: clean(body.spec?.negativePrompt, 2000),
        seed: Math.max(0, Math.floor(Number(body.spec?.seed || 0))),
        variations: Math.max(1, Math.min(6, Number(body.spec?.variations || 3))),
        referenceAssetIds: (Array.isArray(body.spec?.referenceAssetIds) ? body.spec.referenceAssetIds : []).map((item) => clean(item, 80)).slice(0, 20),
        locks: (Array.isArray(body.spec?.locks) ? body.spec.locks : []).map((item) => clean(item, 40)).slice(0, 20),
        licenseAccepted: Boolean(body.spec?.licenseAccepted)
      };
      if (!spec.prompt || !spec.licenseAccepted) return res.status(400).json({ error: "Prompt và xác nhận quyền sử dụng là bắt buộc." });
      spec.referenceAssetIds = [...new Set(spec.referenceAssetIds)];
      if (spec.referenceAssetIds.some((item) => !id(item))) return res.status(400).json({ error: "AI reference asset không hợp lệ." });
      if (spec.referenceAssetIds.length) {
        const verifiedCount = await db.collection("mediaAssets").countDocuments({ _id: { $in: spec.referenceAssetIds.map(id) }, projectId: project._id, status: "ready", deletedAt: null });
        if (verifiedCount !== spec.referenceAssetIds.length) return res.status(409).json({ error: "Một hoặc nhiều AI reference chưa sẵn sàng trong project." });
      }
      const createdAt = now();
      const task = { projectId: project._id, createdBy: user._id, name: clean(body.name || spec.operation, 160), spec, status: "needs-adapter", cost: null, outputAssetIds: [], message: "Chưa gửi tới provider.", createdAt, updatedAt: createdAt };
      const inserted = await db.collection("mediaAiTasks").insertOne(task);
      task._id = inserted.insertedId;
      if (capabilities().aiWorker) {
        try {
          const accepted = await callWorker(process.env.MEDIA_AI_WORKER_URL, process.env.MEDIA_AI_WORKER_TOKEN, { action: "create", taskId: String(task._id), projectId: String(project._id), spec });
          task.status = "queued";
          task.remoteId = clean(accepted.id || accepted.jobId, 160);
          task.message = clean(accepted.message || "AI worker đã nhận task.", 300);
          await db.collection("mediaAiTasks").updateOne({ _id: task._id }, { $set: { status: task.status, remoteId: task.remoteId, message: task.message, updatedAt: now() } });
        } catch {
          task.message = "AI worker chưa xác nhận; project chưa bị thay đổi và chưa phát sinh chi phí.";
          await db.collection("mediaAiTasks").updateOne({ _id: task._id }, { $set: { message: task.message, updatedAt: now() } });
        }
      }
      await audit(db, project, user, "ai.task.created", { entityId: String(task._id), label: task.name });
      return res.status(201).json({ ok: true, task: { id: String(task._id), ...task, _id: undefined }, capabilities: capabilities() });
    }

    return res.status(400).json({ error: "Media action không được hỗ trợ.", code: "MEDIA_ACTION_UNSUPPORTED" });
  });
}

module.exports = { handler, capabilities, safeMime, publicProject, publicAsset, roleFor, __test: { cleanSpec, parseClientPayload, hashToken } };
