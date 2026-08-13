"use strict";
const { ObjectId } = require("mongodb");
const { createHash, createHmac, randomBytes, timingSafeEqual } = require("crypto");
const { clean, currentUser, enforceRateLimit, withApi } = require("./platform");
const { parseOpenAIKeys, runOpenAIResponse } = require("./openai-provider");

const ROLES = new Set(["owner", "admin", "editor", "reviewer", "publisher", "analyst"]);
const STATES = new Set(["draft", "awaiting-review", "approved", "scheduled", "publishing", "published", "failed", "retry-scheduled", "cancelled", "manual-package"]);
let indexesReady = false;
const id = (value, fallback = "") => clean(value, 100).replace(/[^a-zA-Z0-9._-]/g, "") || fallback;
const objectId = (value) => ObjectId.isValid(String(value || "")) ? new ObjectId(String(value)) : null;
const hash = (value) => createHash("sha256").update(String(value || "")).digest("hex");
const publicId = (value) => value?._id ? String(value._id) : value?.id;
const now = () => new Date();
function publicAccount(item) { return { id: publicId(item), workspaceId: item.workspaceId, provider: item.provider, displayName: item.displayName, username: item.username, status: item.status, scopes: item.scopes || [], capabilities: item.capabilities || {}, updatedAt: item.updatedAt }; }
function publicProject(item) { return { id: publicId(item), workspaceId: item.workspaceId, title: item.title, toolId: item.toolId, platform: item.platform, payload: item.payload || {}, version: item.version || 1, status: item.status, updatedAt: item.updatedAt }; }
function publicJob(item) { return { id: publicId(item), workspaceId: item.workspaceId, projectId: item.projectId, accountId: item.accountId, provider: item.provider, state: item.state, reason: item.reason || "", scheduledAt: item.scheduledAt, timezone: item.timezone, attempts: item.attempts || 0, platformPostId: item.platformPostId || "", platformUrl: item.platformUrl || "", lastError: item.lastError || "", updatedAt: item.updatedAt }; }
function transition(state, action) { const map = { draft:{review:"awaiting-review",cancel:"cancelled"}, "awaiting-review":{approve:"approved",reject:"draft",cancel:"cancelled"}, approved:{schedule:"scheduled",publish:"publishing",manual:"manual-package",cancel:"cancelled"}, scheduled:{publish:"publishing",pause:"approved",cancel:"cancelled"}, publishing:{success:"published",fail:"failed"}, failed:{retry:"retry-scheduled",cancel:"cancelled"}, "retry-scheduled":{resume:"publishing",pause:"failed",cancel:"cancelled"} }; return map[state]?.[action] || ""; }
function validSignature(payload, signature, secret) { if (!secret || !/^[a-f0-9]{64}$/i.test(signature || "")) return false; const expected = createHmac("sha256", secret).update(payload).digest("hex"); const left = Buffer.from(expected, "hex"); const right = Buffer.from(signature, "hex"); return left.length === right.length && timingSafeEqual(left, right); }

async function indexes(db) {
  if (indexesReady) return;
  await Promise.all([
    db.collection("social_workspaces").createIndex({ ownerId: 1, workspaceId: 1 }, { unique: true }),
    db.collection("social_projects").createIndex({ ownerId: 1, workspaceId: 1, updatedAt: -1 }),
    db.collection("social_post_versions").createIndex({ ownerId: 1, workspaceId: 1, projectId: 1, version: -1 }, { unique: true }),
    db.collection("social_publish_jobs").createIndex({ ownerId: 1, workspaceId: 1, idempotencyKey: 1 }, { unique: true }),
    db.collection("social_audit_logs").createIndex({ ownerId: 1, workspaceId: 1, createdAt: -1 }),
    db.collection("social_webhook_events").createIndex({ provider: 1, eventId: 1 }, { unique: true })
  ]); indexesReady = true;
}
async function audit(db, user, workspaceId, action, target = {}) { await db.collection("social_audit_logs").insertOne({ ownerId: user._id, workspaceId, action, target, createdAt: now(), updatedAt: now(), schemaVersion: 1 }); }
async function workspaceAccess(db, user, workspaceId, action = "read") {
  const ws = await db.collection("social_workspaces").findOne({ ownerId: user._id, workspaceId, status: { $ne: "archived" } });
  if (!ws) return null; const role = ROLES.has(ws.role) ? ws.role : "owner";
  const matrix = { owner: ["read","edit","review","publish","manage","analytics"], admin: ["read","edit","review","publish","manage","analytics"], editor: ["read","edit"], reviewer: ["read","review"], publisher: ["read","publish"], analyst: ["read","analytics"] };
  return matrix[role]?.includes(action) ? ws : null;
}
async function ensurePersonal(db, user) { const workspaceId = "personal"; const existing = await db.collection("social_workspaces").findOne({ ownerId: user._id, workspaceId }); if (existing) return existing; const stamp = now(); const doc = { ownerId: user._id, workspaceId, name: "Social Workspace cá nhân", role: "owner", automationEnabled: false, status: "active", createdAt: stamp, updatedAt: stamp, schemaVersion: 1 }; await db.collection("social_workspaces").updateOne({ ownerId: user._id, workspaceId }, { $setOnInsert: doc }, { upsert: true }); return doc; }

async function workspaces(req, res, db, user, body) {
  if (req.method === "GET") { await ensurePersonal(db, user); const rows = await db.collection("social_workspaces").find({ ownerId: user._id, status: { $ne: "archived" } }).sort({ updatedAt: -1 }).limit(50).toArray(); return res.status(200).json({ items: rows.map((row) => ({ id: publicId(row), workspaceId: row.workspaceId, name: row.name, role: row.role, automationEnabled: Boolean(row.automationEnabled), updatedAt: row.updatedAt })) }); }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const name = clean(body.name, 100); if (!name) return res.status(400).json({ error: "Tên workspace là bắt buộc." }); const workspaceId = id(body.workspaceId || `${name}-${randomBytes(3).toString("hex")}`); const stamp = now();
  try { await db.collection("social_workspaces").insertOne({ ownerId: user._id, workspaceId, name, role: "owner", automationEnabled: false, status: "active", createdAt: stamp, updatedAt: stamp, schemaVersion: 1 }); } catch (error) { if (error?.code === 11000) return res.status(409).json({ error: "Workspace đã tồn tại." }); throw error; }
  await audit(db, user, workspaceId, "social:workspace:create"); return res.status(201).json({ ok: true, item: { workspaceId, name, role: "owner", automationEnabled: false } });
}

async function accounts(req, res, db, user) {
  const workspaceId = id(req.query.workspaceId, "personal"); if (!await workspaceAccess(db, user, workspaceId)) return res.status(403).json({ error: "Không được truy cập workspace này." });
  if (req.method !== "GET") return res.status(405).json({ error: "Kết nối tài khoản được thực hiện trong Facebook, TikTok hoặc YouTube hiện có." });
  const [social, facebook, tiktok, youtube] = await Promise.all([
    db.collection("social_accounts").find({ ownerId: user._id, workspaceId }).limit(100).toArray(),
    db.collection("facebookConnections").find({ userId: user._id, status: "connected" }).limit(50).toArray().catch(() => []),
    db.collection("tiktokCreatorConnections").find({ ownerId: user._id, active: true }).limit(50).toArray().catch(() => []),
    db.collection("youtubeConnections").find({ userId: user._id }).limit(50).toArray().catch(() => [])
  ]);
  const mapped = [...social.map(publicAccount), ...facebook.map((item) => ({ id: String(item._id), workspaceId, provider: "facebook", displayName: item.pageName || item.name, username: item.pageId, status: "connected", capabilities: { publish: true } })), ...tiktok.map((item) => ({ id: String(item._id), workspaceId, provider: "tiktok", displayName: item.displayName, username: item.username, status: "connected", capabilities: { publish: true } })), ...youtube.map((item) => ({ id: String(item._id), workspaceId, provider: "youtube", displayName: item.channelTitle, username: item.channelId, status: "connected", capabilities: { publish: true } }))];
  return res.status(200).json({ items: mapped, tokenDelivery: "server-only" });
}

async function projects(req, res, db, user, body) {
  const workspaceId = id(req.query.workspaceId || body.workspaceId, "personal"); const action = req.method === "GET" ? "read" : "edit"; if (!await workspaceAccess(db, user, workspaceId, action)) return res.status(403).json({ error: "Không có quyền với workspace này." }); const collection = db.collection("social_projects");
  if (req.method === "GET") return res.status(200).json({ items: (await collection.find({ ownerId: user._id, workspaceId }).sort({ updatedAt: -1 }).limit(100).toArray()).map(publicProject) });
  if (req.method !== "POST" && req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });
  const projectId = id(body.projectId || `project-${Date.now()}`); const payload = body.payload && typeof body.payload === "object" ? body.payload : {}; const serialized = JSON.stringify(payload); if (Buffer.byteLength(serialized) > 180000) return res.status(413).json({ error: "Dự án vượt giới hạn 180 KB." }); const current = await collection.findOne({ ownerId: user._id, workspaceId, projectId }); const version = Number(current?.version || 0) + 1; const stamp = now(); const doc = { ownerId: user._id, workspaceId, projectId, title: clean(body.title || "Dự án social", 160), toolId: id(body.toolId, "caption-formatter"), platform: id(body.platform, "general"), payload, version, status: "draft", checksum: hash(serialized), updatedAt: stamp, schemaVersion: 1 };
  await collection.updateOne({ ownerId: user._id, workspaceId, projectId }, { $set: doc, $setOnInsert: { createdAt: stamp } }, { upsert: true }); await db.collection("social_post_versions").insertOne({ ...doc, projectId, createdAt: stamp }); await audit(db, user, workspaceId, "social:project:save", { projectId, version }); return res.status(200).json({ ok: true, item: publicProject(doc) });
}

async function oembed(req, res, db, user) {
  const workspaceId = id(req.query.workspaceId, "personal"); if (!await workspaceAccess(db, user, workspaceId)) return res.status(403).json({ error: "Không có quyền với workspace này." }); await enforceRateLimit(db, `social-oembed:${user._id}`, 30, 15 * 60 * 1000);
  const provider = id(req.query.provider); const target = clean(req.query.url, 1000); let endpoint = "";
  if (provider === "youtube" && /^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(target)) endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(target)}`;
  if (provider === "vimeo" && /^https:\/\/(?:www\.)?vimeo\.com\//i.test(target)) endpoint = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(target)}`;
  if (!endpoint) return res.status(400).json({ error: "Chỉ hỗ trợ URL YouTube/Vimeo HTTPS hợp lệ." });
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } }); if (!response.ok) return res.status(response.status === 404 ? 404 : 502).json({ error: "Nhà cung cấp không trả về metadata công khai." }); const data = await response.json();
  return res.status(200).json({ provider, title: clean(data.title, 300), authorName: clean(data.author_name, 200), authorUrl: clean(data.author_url, 1000), thumbnailUrl: clean(data.thumbnail_url, 1200), thumbnailWidth: Number(data.thumbnail_width || 0), thumbnailHeight: Number(data.thumbnail_height || 0), sourceUrl: target, rights: "Metadata công khai từ oEmbed; không cấp quyền tải video/audio." });
}

async function publish(req, res, db, user, body) {
  const workspaceId = id(req.query.workspaceId || body.workspaceId, "personal"); if (!await workspaceAccess(db, user, workspaceId, "publish")) return res.status(403).json({ error: "Vai trò hiện tại không có quyền xuất bản." }); const jobs = db.collection("social_publish_jobs");
  if (req.method === "GET") return res.status(200).json({ items: (await jobs.find({ ownerId: user._id, workspaceId }).sort({ updatedAt: -1 }).limit(100).toArray()).map(publicJob) });
  if (req.method !== "POST" && req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" }); await enforceRateLimit(db, `social-publish:${user._id}:${workspaceId}`, 30, 60 * 60 * 1000);
  if (req.method === "PATCH") { const jobId = objectId(body.jobId); const action = id(body.action); if (!jobId || !["review","approve","reject","schedule","publish","manual","pause","resume","retry","cancel"].includes(action)) return res.status(400).json({ error: "Job hoặc thao tác không hợp lệ." }); const job = await jobs.findOne({ _id: jobId, ownerId: user._id, workspaceId }); if (!job) return res.status(404).json({ error: "Không tìm thấy job trong workspace." }); if (["publish","resume"].includes(action) && job.reason !== "official-api-ready") return res.status(409).json({ error: "Worker API chính thức chưa được liên kết; hãy chuyển thành gói đăng thủ công." }); const target = transition(job.state, action); if (!target) return res.status(409).json({ error: `Không thể ${action} khi job đang ở trạng thái ${job.state}.` }); const stamp = now(); const update = { state: target, updatedAt: stamp }; if (action === "retry") update.attempts = Number(job.attempts || 0) + 1; await jobs.updateOne({ _id: job._id, ownerId: user._id, workspaceId, state: job.state }, { $set: update }); const changed = { ...job, ...update }; await audit(db, user, workspaceId, `social:publish:${action}`, { jobId: String(job._id), from: job.state, to: target }); return res.status(200).json({ ok: true, item: publicJob(changed), execution: target === "publishing" ? "provider-worker-required" : "state-only" }); }
  const projectId = id(body.projectId); const provider = id(body.provider, "manual"); const accountId = id(body.accountId); const action = id(body.action, "create"); const project = await db.collection("social_projects").findOne({ ownerId: user._id, workspaceId, projectId }); if (!project) return res.status(404).json({ error: "Không tìm thấy dự án trong workspace." });
  const connected = accountId ? await db.collection("social_accounts").findOne({ ownerId: user._id, workspaceId, accountId, provider, status: "connected" }) : null; const supportsDirect = Boolean(connected?.capabilities?.publish && connected?.publisherHandler === "social-worker-v1");
  const suppliedKey = clean(req.headers["idempotency-key"] || body.idempotencyKey, 200); const key = hash(suppliedKey || `${user._id}:${workspaceId}:${projectId}:${accountId || "manual"}:${provider}:${clean(body.scheduledAt, 40) || "now"}`); const existing = await jobs.findOne({ ownerId: user._id, workspaceId, idempotencyKey: key }); if (existing) return res.status(200).json({ ok: true, duplicatePrevented: true, item: publicJob(existing) }); const stamp = now();
  const state = "draft"; const doc = { ownerId: user._id, workspaceId, projectId, accountId: accountId || null, provider, state, idempotencyKey: key, timezone: clean(body.timezone || "Asia/Bangkok", 80), scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null, attempts: 0, reason: supportsDirect ? "official-api-ready" : "provider-api-not-connected", createdAt: stamp, updatedAt: stamp, schemaVersion: 1 };
  await jobs.insertOne(doc); await audit(db, user, workspaceId, "social:publish:create", { projectId, provider, state, action }); return res.status(201).json({ ok: true, item: publicJob(doc), message: supportsDirect ? "Đã tạo bản nháp trong hàng duyệt." : "Đã tạo bản nháp; API trực tiếp chưa liên kết nên sau khi duyệt chỉ có thể xuất gói đăng thủ công." });
}

async function webhooks(req, res, db, body) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const provider = id(req.query.provider || body.provider); if (provider !== "internal") return res.status(501).json({ error: "Webhook nền tảng được xử lý tại module OAuth chính thức tương ứng; endpoint chung không giả lập chữ ký nhà cung cấp." });
  const secret = process.env.SOCIAL_WEBHOOK_SECRET; if (!secret) return res.status(503).json({ error: "Webhook nội bộ chưa được cấu hình.", code: "SOCIAL_WEBHOOK_NOT_CONFIGURED" });
  const timestamp = Number(req.headers["x-hh-social-timestamp"] || 0); if (!timestamp || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) return res.status(401).json({ error: "Webhook đã hết hạn hoặc thiếu timestamp." });
  const payload = JSON.stringify(body || {}); if (!validSignature(`${timestamp}.${payload}`, req.headers["x-hh-social-signature"], secret)) return res.status(401).json({ error: "Chữ ký webhook không hợp lệ." });
  const eventId = id(body.eventId); if (!eventId) return res.status(400).json({ error: "Thiếu eventId." }); const stamp = now();
  try { await db.collection("social_webhook_events").insertOne({ provider, eventId, payloadHash: hash(payload), processed: false, createdAt: stamp, updatedAt: stamp, schemaVersion: 1 }); } catch (error) { if (error?.code === 11000) return res.status(200).json({ ok: true, duplicatePrevented: true }); throw error; }
  return res.status(202).json({ ok: true, accepted: true });
}

async function ai(req, res, db, user, body) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" }); const workspaceId = id(body.workspaceId, "personal"); if (!await workspaceAccess(db, user, workspaceId, "edit")) return res.status(403).json({ error: "Không có quyền sửa nội dung." }); await enforceRateLimit(db, `social-ai:${user._id}`, 30, 15 * 60 * 1000); const keys = parseOpenAIKeys(); if (!keys.length) return res.status(503).json({ error: "AI Social Assistant chưa được cấu hình trên máy chủ.", code: "SOCIAL_AI_NOT_CONFIGURED" }); const action = id(body.action, "caption"); const input = clean(body.input, 12000); if (!input) return res.status(400).json({ error: "Nội dung đầu vào đang trống." });
  const instruction = `Bạn là biên tập viên social media an toàn. Tạo nội dung nguyên bản bằng tiếng Việt cho tác vụ ${action}. Không bịa xu hướng, số liệu, người hoặc kết quả A/B. Không cam kết viral. Không thêm thông tin cá nhân. Trả lời ngắn, dùng được ngay và nhắc người dùng kiểm tra trước khi đăng.`;
  const result = await runOpenAIResponse({ apiKey: keys[0], model: process.env.OPENAI_SOCIAL_MODEL, prompt: JSON.stringify({ action, platform: id(body.platform, "general"), input, brandVoice: clean(body.brandVoice, 1000) }), instruction, history: [], attachments: [], reasoningEffort: "low", useWebSearch: false, safetyIdentifier: `social-${user._id}` }); const stamp = now(); const record = { ownerId: user._id, workspaceId, provider: "openai", model: result.model, generatedAt: stamp, sourceAssetIds: (body.sourceAssetIds || []).map(id).slice(0, 30), contentStatus: "ai_generated", warning: "Cần người dùng kiểm tra trước khi đăng.", createdAt: stamp, updatedAt: stamp, schemaVersion: 1 }; await db.collection("social_ai_generations").insertOne(record); await audit(db, user, workspaceId, "social:ai:generate", { action }); return res.status(200).json({ output: result.output, ...record, ownerId: undefined });
}

module.exports = async function handler(req, res) { return withApi(req, res, async ({ db, body }) => { await indexes(db); const resource = id(req.query.socialResource || req.query.resource || "workspaces"); if (resource === "webhooks") return webhooks(req, res, db, body); const user = await currentUser(req); if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để dùng Social Media backend.", code: "AUTH_REQUIRED" }); if (resource === "workspaces") return workspaces(req, res, db, user, body); if (resource === "accounts") return accounts(req, res, db, user); if (resource === "projects") return projects(req, res, db, user, body); if (resource === "oembed") return oembed(req, res, db, user); if (resource === "publish") return publish(req, res, db, user, body); if (resource === "ai") return ai(req, res, db, user, body); return res.status(404).json({ error: "Social Media API resource không tồn tại." }); }); };
module.exports.__test = { id, hash, publicAccount, publicProject, publicJob, transition, validSignature, ROLES, STATES };
