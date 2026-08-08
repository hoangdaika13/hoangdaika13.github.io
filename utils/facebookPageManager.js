const crypto = require("node:crypto");
const { ObjectId } = require("mongodb");
const { clean, currentUser, enforceRateLimit, withApi } = require("./platform");
const { decryptToken, encryptToken, publicPage } = require("./facebookSecurity");

const GRAPH_VERSION = clean(process.env.META_GRAPH_VERSION || "v23.0", 20);
const GRAPH_ORIGIN = `https://graph.facebook.com/${GRAPH_VERSION}`;
const DIALOG_ORIGIN = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const PERMISSIONS = Object.freeze([
  "pages_show_list",
  "pages_read_engagement",
  "pages_read_user_content",
  "pages_manage_posts",
  "pages_manage_engagement",
  "pages_manage_metadata",
  "read_insights"
]);
const MAX_PAGES = 200;
const MAX_BATCH_PUBLISH = 20;
const MAX_SETUP_IMPORT = 500;
const MAX_CONTENT_TEMPLATES = 300;

function fail(message, statusCode = 400, code = "FACEBOOK_MANAGER_ERROR") {
  return Object.assign(new Error(message), { statusCode, code });
}

function routeOf(req) {
  const value = req.query.facebookAction ?? req.query.action;
  if (Array.isArray(value)) return value.map((part) => clean(part, 80)).filter(Boolean).join("/");
  return clean(value, 240);
}

function appOrigin(req) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${protocol}://${host}`;
}

function callbackUrl(req) {
  return process.env.META_CALLBACK_URL || `${appOrigin(req)}/api/facebook/oauth/callback`;
}

function allowedFrontends() {
  return new Set([
    "https://hoang8.com",
    "https://www.hoang8.com",
    "https://hoangdaika13.github.io",
    process.env.FRONTEND_URL || "",
    process.env.PUBLIC_SITE_URL || "",
    ...String(process.env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim())
  ].filter(Boolean));
}

function safeFrontend(value) {
  const fallback = process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL || "https://hoang8.com";
  try {
    const url = new URL(String(value || fallback));
    return allowedFrontends().has(url.origin) ? url.origin : fallback;
  } catch { return fallback; }
}

function safeReturnHash(value) {
  const hash = clean(value || "#/davinci-resolve/facebook", 240);
  return /^#\/davinci-resolve\/facebook(?:[/?].*)?$/.test(hash) ? hash : "#/davinci-resolve/facebook";
}

function hmacIdentity(value) {
  const secret = String(process.env.META_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || "");
  return value && secret.length >= 32 ? crypto.createHmac("sha256", secret).update(String(value)).digest("hex") : "";
}

async function graph(path, accessToken, options = {}) {
  const url = new URL(path.startsWith("http") ? path : `${GRAPH_ORIGIN}/${String(path).replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(options.params || {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: { Authorization: `Bearer ${accessToken}`, ...(options.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: options.body ? new URLSearchParams(Object.entries(options.body).filter(([, value]) => value !== undefined && value !== null && value !== "")) : undefined,
    signal: AbortSignal.timeout(20000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const message = clean(data?.error?.message || `Meta API HTTP ${response.status}`, 300);
    const code = clean(data?.error?.code || "META_GRAPH_ERROR", 80);
    throw fail(message, response.status === 401 ? 401 : response.status === 403 ? 403 : response.status === 429 ? 429 : 400, `META_${code}`);
  }
  return data;
}

async function pageConnection(db, userId, pageId) {
  const id = clean(pageId, 100);
  const record = await db.collection("facebookPageConnections").findOne({ userId, pageId: id });
  if (!record) throw fail("Page không thuộc tài khoản HH hiện tại hoặc chưa được kết nối.", 404, "FACEBOOK_PAGE_NOT_CONNECTED");
  return record;
}

function setupDoc(input, userId, previous = {}) {
  const now = new Date();
  const status = ["draft", "ready", "created", "connected", "configured"].includes(input.status) ? input.status : previous.status || "draft";
  const name = clean(input.name, 180);
  if (!name) throw fail("Mỗi Page cần có tên.", 400, "FACEBOOK_SETUP_NAME_REQUIRED");
  return {
    userId,
    name,
    category: clean(input.category, 120),
    bio: clean(input.bio, 500),
    username: clean(input.username, 80).replace(/^@/, ""),
    website: clean(input.website, 500),
    phone: clean(input.phone, 80),
    email: clean(input.email, 254).toLowerCase(),
    address: clean(input.address, 300),
    profileImage: clean(input.profileImage, 1200),
    coverImage: clean(input.coverImage, 1200),
    cta: clean(input.cta, 80),
    status,
    pageId: clean(input.pageId || previous.pageId, 100),
    notes: clean(input.notes, 600),
    updatedAt: now,
    createdAt: previous.createdAt || now
  };
}

function publicSetup(item) {
  return {
    id: String(item._id), name: item.name, category: item.category || "", bio: item.bio || "",
    username: item.username || "", website: item.website || "", phone: item.phone || "", email: item.email || "",
    address: item.address || "", profileImage: item.profileImage || "", coverImage: item.coverImage || "",
    cta: item.cta || "", status: item.status || "draft", pageId: item.pageId || "", notes: item.notes || "",
    createdAt: item.createdAt || null, updatedAt: item.updatedAt || null
  };
}

function campaignDoc(input, userId, previous = {}) {
  const now = new Date();
  const pageIds = [...new Set((Array.isArray(input.pageIds) ? input.pageIds : []).map((id) => clean(id, 100)).filter(Boolean))].slice(0, MAX_BATCH_PUBLISH);
  const status = ["draft", "review", "approved", "publishing", "published", "partial", "failed", "archived"].includes(input.status) ? input.status : previous.status || "draft";
  const overrides = (Array.isArray(input.overrides) ? input.overrides : []).slice(0, MAX_BATCH_PUBLISH).map((item) => ({
    pageId: clean(item.pageId, 100), message: clean(item.message, 63206), link: clean(item.link, 1200),
    mediaUrl: clean(item.mediaUrl, 1200), scheduledAt: clean(item.scheduledAt, 80)
  })).filter((item) => item.pageId && pageIds.includes(item.pageId));
  return {
    userId,
    name: clean(input.name, 180) || previous.name || `Chiến dịch ${now.toLocaleDateString("vi-VN")}`,
    objective: clean(input.objective, 120),
    pageIds,
    message: clean(input.message, 63206),
    link: clean(input.link, 1200),
    mediaType: ["text", "photo", "video"].includes(input.mediaType) ? input.mediaType : "text",
    mediaUrl: clean(input.mediaUrl, 1200),
    scheduledAt: clean(input.scheduledAt, 80),
    overrides,
    tags: (Array.isArray(input.tags) ? input.tags : String(input.tags || "").split(",")).map((tag) => clean(tag, 40)).filter(Boolean).slice(0, 20),
    status,
    submittedAt: status === "review" ? now : previous.submittedAt || null,
    approvedAt: status === "approved" ? now : previous.approvedAt || null,
    approvedBy: status === "approved" ? userId : previous.approvedBy || null,
    approvalNotes: Array.isArray(previous.approvalNotes) ? previous.approvalNotes.slice(-100) : [],
    createdAt: previous.createdAt || now,
    updatedAt: now
  };
}

function publicCampaign(item) {
  return item ? {
    id: String(item._id), name: item.name || "Chiến dịch", objective: item.objective || "", pageIds: item.pageIds || [],
    message: item.message || "", link: item.link || "", mediaType: item.mediaType || "text", mediaUrl: item.mediaUrl || "",
    scheduledAt: item.scheduledAt || "", overrides: item.overrides || [], tags: item.tags || [], status: item.status || "draft",
    submittedAt: item.submittedAt || null, approvedAt: item.approvedAt || null, publishedAt: item.publishedAt || null,
    approvalNotes: (Array.isArray(item.approvalNotes) ? item.approvalNotes : []).slice(-100).map((note) => ({
      id: clean(note.id, 80), message: clean(note.message, 1200), kind: ["comment", "request_changes", "approval"].includes(note.kind) ? note.kind : "comment",
      authorName: clean(note.authorName, 120), createdAt: note.createdAt || null
    })),
    lastJobId: item.lastJobId ? String(item.lastJobId) : "", createdAt: item.createdAt || null, updatedAt: item.updatedAt || null
  } : null;
}

function publicGroup(item) {
  return item ? { id: String(item._id), name: item.name || "Nhóm Page", color: item.color || "#6e9dff", pageIds: item.pageIds || [], createdAt: item.createdAt || null, updatedAt: item.updatedAt || null } : null;
}

function publicRule(item) {
  return item ? { id: String(item._id), name: item.name || "Automation", enabled: item.enabled !== false, pageIds: item.pageIds || [], keyword: item.keyword || "", action: item.action || "notify", label: item.label || "", createdAt: item.createdAt || null, updatedAt: item.updatedAt || null } : null;
}

function contentTemplateDoc(input, userId, previous = {}) {
  const now = new Date();
  const mediaType = ["text", "photo", "video"].includes(input.mediaType) ? input.mediaType : "text";
  const doc = {
    userId,
    name: clean(input.name, 160),
    category: clean(input.category, 80) || "general",
    message: clean(input.message, 63206),
    variantA: clean(input.variantA, 63206),
    variantB: clean(input.variantB, 63206),
    link: clean(input.link, 1200),
    mediaType,
    mediaUrl: clean(input.mediaUrl, 1200),
    tags: (Array.isArray(input.tags) ? input.tags : String(input.tags || "").split(",")).map((tag) => clean(tag, 40)).filter(Boolean).slice(0, 20),
    favorite: input.favorite === true,
    useCount: Math.max(0, Number(previous.useCount || 0)),
    lastUsedAt: previous.lastUsedAt || null,
    createdAt: previous.createdAt || now,
    updatedAt: now
  };
  if (!doc.name || (!doc.message && !doc.variantA && !doc.variantB)) throw fail("Mẫu nội dung cần tên và ít nhất một nội dung.");
  return doc;
}

function publicContentTemplate(item) {
  return item ? {
    id: String(item._id), name: item.name || "Mẫu nội dung", category: item.category || "general",
    message: item.message || "", variantA: item.variantA || "", variantB: item.variantB || "", link: item.link || "",
    mediaType: item.mediaType || "text", mediaUrl: item.mediaUrl || "", tags: item.tags || [], favorite: item.favorite === true,
    useCount: Number(item.useCount || 0), lastUsedAt: item.lastUsedAt || null, createdAt: item.createdAt || null, updatedAt: item.updatedAt || null
  } : null;
}

function engagementTotal(post = {}) {
  return Math.max(0, Number(post.reactions?.summary?.total_count || 0))
    + Math.max(0, Number(post.comments?.summary?.total_count || 0)) * 2
    + Math.max(0, Number(post.shares?.count || 0)) * 3;
}

function recommendPostingSlots(posts, timezoneOffset = 7) {
  const offset = Math.max(-12, Math.min(14, Number(timezoneOffset || 0)));
  const rows = (Array.isArray(posts) ? posts : []).filter((post) => post?.is_published !== false && Number.isFinite(new Date(post?.created_time).getTime()));
  if (rows.length < 3) return { ready: false, reason: "insufficient-data", sampleSize: rows.length, timezoneOffset: offset, slots: [] };
  const buckets = new Map();
  for (const post of rows) {
    const shifted = new Date(new Date(post.created_time).getTime() + offset * 60 * 60 * 1000);
    const day = shifted.getUTCDay();
    const hour = shifted.getUTCHours();
    const key = `${day}:${hour}`;
    const bucket = buckets.get(key) || { day, hour, samples: 0, engagement: 0 };
    bucket.samples += 1;
    bucket.engagement += engagementTotal(post);
    buckets.set(key, bucket);
  }
  const slots = [...buckets.values()].map((bucket) => ({
    ...bucket,
    averageEngagement: Number((bucket.engagement / bucket.samples).toFixed(2)),
    confidence: bucket.samples >= 5 ? "high" : bucket.samples >= 2 ? "medium" : "low"
  })).sort((left, right) => right.averageEngagement - left.averageEngagement || right.samples - left.samples).slice(0, 6);
  return { ready: slots.length > 0, reason: "", sampleSize: rows.length, timezoneOffset: offset, slots };
}

async function writeAudit(db, userId, action, data = {}) {
  await db.collection("facebookPageAudits").insertOne({
    userId, action: clean(action, 100), pageId: clean(data.pageId, 100), status: clean(data.status || "completed", 40),
    detail: clean(data.detail, 300), createdAt: new Date()
  });
}

module.exports = async function facebookPageManager(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const route = routeOf(req);
    const connections = db.collection("facebookPageConnections");
    const oauthStates = db.collection("facebookOauthStates");
    const setups = db.collection("facebookPageSetups");
    const jobs = db.collection("facebookPublishJobs");
    const campaigns = db.collection("facebookCampaigns");
    const groups = db.collection("facebookPageGroups");
    const rules = db.collection("facebookAutomationRules");
    const templates = db.collection("facebookContentTemplates");
    await Promise.all([
      connections.createIndex({ userId: 1, pageId: 1 }, { unique: true }),
      connections.createIndex({ userId: 1, active: 1, updatedAt: -1 }),
      oauthStates.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      setups.createIndex({ userId: 1, updatedAt: -1 }),
      jobs.createIndex({ userId: 1, createdAt: -1 }),
      campaigns.createIndex({ userId: 1, updatedAt: -1 }),
      groups.createIndex({ userId: 1, name: 1 }, { unique: true }),
      rules.createIndex({ userId: 1, updatedAt: -1 }),
      templates.createIndex({ userId: 1, updatedAt: -1 }),
      templates.createIndex({ userId: 1, name: 1 }, { unique: true })
    ]);

    if (route === "oauth/callback" && req.method === "GET") {
      const rawState = clean(req.query.state, 220);
      const stateHash = crypto.createHash("sha256").update(rawState).digest("hex");
      const state = await oauthStates.findOne({ stateHash, expiresAt: { $gt: new Date() } });
      const frontend = safeFrontend(state?.returnTo);
      const returnHash = safeReturnHash(state?.returnHash);
      if (!state) return res.redirect(`${frontend}/?facebookError=${encodeURIComponent("Phiên kết nối Facebook đã hết hạn.")}${returnHash}`);
      await oauthStates.deleteOne({ _id: state._id });
      const callbackUser = await currentUser(req);
      if (!callbackUser || String(callbackUser._id) !== String(state.userId)) {
        return res.redirect(`${frontend}/?facebookError=${encodeURIComponent("Tài khoản HH không khớp với người bắt đầu kết nối.")}${returnHash}`);
      }
      if (req.query.error || !req.query.code) {
        return res.redirect(`${frontend}/?facebookError=${encodeURIComponent(clean(req.query.error_description || "Meta đã hủy cấp quyền.", 180))}${returnHash}`);
      }
      try {
        const tokenUrl = new URL(`${GRAPH_ORIGIN}/oauth/access_token`);
        tokenUrl.search = new URLSearchParams({
          client_id: process.env.META_APP_ID || "",
          client_secret: process.env.META_APP_SECRET || "",
          redirect_uri: callbackUrl(req),
          code: clean(req.query.code, 2000)
        });
        const tokenResponse = await fetch(tokenUrl, { signal: AbortSignal.timeout(20000) });
        const shortToken = await tokenResponse.json().catch(() => ({}));
        if (!tokenResponse.ok || !shortToken.access_token) throw fail(shortToken.error?.message || "Meta không cấp access token.", 401);
        let userToken = shortToken.access_token;
        try {
          const longToken = await graph("oauth/access_token", userToken, { params: {
            grant_type: "fb_exchange_token",
            client_id: process.env.META_APP_ID,
            client_secret: process.env.META_APP_SECRET,
            fb_exchange_token: userToken
          } });
          userToken = longToken.access_token || userToken;
        } catch {}
        const identity = await graph("me", userToken, { params: { fields: "id,name" } });
        let next = `${GRAPH_ORIGIN}/me/accounts?fields=id,name,access_token,category,category_list,tasks,picture.type(square)&limit=100`;
        let pages = [];
        for (let page = 0; next && page < 3 && pages.length < MAX_PAGES; page += 1) {
          const result = await graph(next, userToken);
          pages = pages.concat(Array.isArray(result.data) ? result.data : []);
          next = result.paging?.next || "";
        }
        if (!pages.length) throw fail("Meta không trả về Page nào bạn đang quản lý.", 404, "FACEBOOK_NO_PAGES");
        const now = new Date();
        await connections.updateMany({ userId: state.userId }, { $set: { active: false } });
        for (let index = 0; index < pages.length; index += 1) {
          const page = pages[index];
          if (!page.id || !page.access_token) continue;
          const owner = { userId: state.userId, pageId: String(page.id) };
          const previous = await connections.findOne(owner);
          await connections.updateOne(owner, { $set: {
            ...owner,
            pageName: clean(page.name, 180),
            category: clean(page.category, 160),
            picture: clean(page.picture?.data?.url, 1200),
            tasks: Array.isArray(page.tasks) ? page.tasks.map((task) => clean(task, 80)).filter(Boolean).slice(0, 30) : [],
            accessToken: encryptToken(page.access_token, owner),
            metaIdentityHash: hmacIdentity(identity.id),
            active: index === 0,
            connectedAt: previous?.connectedAt || now,
            updatedAt: now
          } }, { upsert: true });
        }
        await writeAudit(db, state.userId, "pages:connect", { detail: `${pages.length} Pages` });
        return res.redirect(`${frontend}/?facebookConnected=1${returnHash}`);
      } catch (error) {
        return res.redirect(`${frontend}/?facebookError=${encodeURIComponent(clean(error.message, 180))}${returnHash}`);
      }
    }

    const user = await currentUser(req);
    if (!user) throw fail("Đăng nhập HH Platform để quản lý Facebook Page.", 401, "AUTH_REQUIRED");
    await enforceRateLimit(db, `facebook:${route}:${user._id}`, route.startsWith("publish") ? 80 : 180, 15 * 60 * 1000);

    if (route === "oauth/start" && req.method === "POST") {
      if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) throw fail("Meta OAuth chưa được cấu hình trên Vercel.", 503, "META_OAUTH_NOT_CONFIGURED");
      const rawState = crypto.randomBytes(36).toString("base64url");
      await oauthStates.insertOne({
        stateHash: crypto.createHash("sha256").update(rawState).digest("hex"), userId: user._id,
        returnTo: safeFrontend(body.returnTo), returnHash: safeReturnHash(body.returnHash), createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      });
      const url = new URL(DIALOG_ORIGIN);
      url.search = new URLSearchParams({
        client_id: process.env.META_APP_ID,
        redirect_uri: callbackUrl(req),
        state: rawState,
        response_type: "code",
        scope: PERMISSIONS.join(",")
      });
      return res.status(200).json({ authorizeUrl: url.toString(), callbackUrl: callbackUrl(req), permissions: PERMISSIONS, graphVersion: GRAPH_VERSION });
    }

    if (route === "status" && req.method === "GET") {
      const [allPages, setupRows, recentJobs, audits, campaignRows, groupRows, ruleRows, automationEvents, templateRows] = await Promise.all([
        connections.find({ userId: user._id }).sort({ active: -1, pageName: 1 }).limit(MAX_PAGES).toArray(),
        setups.find({ userId: user._id }).sort({ updatedAt: -1 }).limit(MAX_SETUP_IMPORT).toArray(),
        jobs.find({ userId: user._id }).sort({ createdAt: -1 }).limit(25).toArray(),
        db.collection("facebookPageAudits").find({ userId: user._id }).sort({ createdAt: -1 }).limit(30).toArray(),
        campaigns.find({ userId: user._id }).sort({ updatedAt: -1 }).limit(100).toArray(),
        groups.find({ userId: user._id }).sort({ name: 1 }).limit(100).toArray(),
        rules.find({ userId: user._id }).sort({ updatedAt: -1 }).limit(100).toArray(),
        db.collection("facebookAutomationEvents").find({ userId: user._id }).sort({ createdAt: -1 }).limit(50).toArray(),
        templates.find({ userId: user._id }).sort({ favorite: -1, updatedAt: -1 }).limit(MAX_CONTENT_TEMPLATES).toArray()
      ]);
      return res.status(200).json({
        configured: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
        callbackUrl: callbackUrl(req), graphVersion: GRAPH_VERSION, permissions: PERMISSIONS,
        pages: allPages.map(publicPage), setups: setupRows.map(publicSetup),
        campaigns: campaignRows.map(publicCampaign), groups: groupRows.map(publicGroup), rules: ruleRows.map(publicRule),
        templates: templateRows.map(publicContentTemplate),
        automationEvents: automationEvents.map((item) => ({ id: String(item._id), ruleId: String(item.ruleId || ""), pageId: item.pageId || "", field: item.field || "", action: item.action || "notify", label: item.label || "", status: item.status || "matched", createdAt: item.createdAt || null })),
        jobs: recentJobs.map((item) => ({ id: String(item._id), kind: item.kind, status: item.status, total: item.total, completed: item.completed, failed: item.failed, createdAt: item.createdAt })),
        audits: audits.map((item) => ({ id: String(item._id), action: item.action, pageId: item.pageId || "", status: item.status, detail: item.detail || "", createdAt: item.createdAt })),
        capabilities: { automaticPageCreation: false, batchSetup: true, pageManagement: true, publish: true, schedule: true, comments: true, insights: true, campaigns: true, approvalWorkflow: true, approvalNotes: true, pageGroups: true, perPageOverrides: true, webhook: true, automationRules: true, contentLibrary: true, abVariants: true, smartPlanner: true },
        webhook: { callbackUrl: `${safeFrontend()}/api/facebook/webhook`, configured: Boolean(process.env.META_WEBHOOK_VERIFY_TOKEN && process.env.META_APP_SECRET) },
        policy: { pageCreation: "Meta không cung cấp Pages API để tạo Facebook Page mới. Batch Setup chuẩn bị dữ liệu và mở luồng tạo chính thức." }
      });
    }

    if (route === "page/select" && req.method === "POST") {
      const page = await pageConnection(db, user._id, body.pageId);
      await connections.updateMany({ userId: user._id }, { $set: { active: false } });
      await connections.updateOne({ _id: page._id, userId: user._id }, { $set: { active: true, updatedAt: new Date() } });
      return res.status(200).json({ ok: true, page: publicPage({ ...page, active: true }) });
    }

    if (route === "page/dashboard" && req.method === "GET") {
      const record = await pageConnection(db, user._id, req.query.pageId);
      const token = decryptToken(record.accessToken, record);
      const [page, posts] = await Promise.all([
        graph(record.pageId, token, { params: { fields: "id,name,about,description,category,fan_count,followers_count,picture.type(large),cover,link,verification_status" } }),
        graph(`${record.pageId}/feed`, token, { params: { fields: "id,message,created_time,updated_time,permalink_url,is_published,full_picture,shares,comments.limit(0).summary(true),reactions.limit(0).summary(true)", limit: 25 } })
      ]);
      return res.status(200).json({ page, posts: posts.data || [] });
    }

    if (route === "planner/recommendations" && req.method === "GET") {
      const record = await pageConnection(db, user._id, req.query.pageId);
      const token = decryptToken(record.accessToken, record);
      const posts = await graph(`${record.pageId}/feed`, token, { params: { fields: "id,created_time,is_published,shares,comments.limit(0).summary(true),reactions.limit(0).summary(true)", limit: 100 } });
      const recommendation = recommendPostingSlots(posts.data || [], req.query.timezoneOffset ?? 7);
      await writeAudit(db, user._id, "planner:analyze", { pageId: record.pageId, detail: `${recommendation.sampleSize} posts` });
      return res.status(200).json({ recommendation });
    }

    if (route === "publish" && req.method === "POST") {
      const campaignId = ObjectId.isValid(body.campaignId) ? new ObjectId(body.campaignId) : null;
      const campaign = campaignId ? await campaigns.findOne({ _id: campaignId, userId: user._id }) : null;
      if (campaignId && !campaign) throw fail("Không tìm thấy chiến dịch.", 404, "FACEBOOK_CAMPAIGN_NOT_FOUND");
      if (campaign && campaign.status !== "approved") throw fail("Chiến dịch phải được duyệt trước khi xuất bản.", 409, "FACEBOOK_CAMPAIGN_NOT_APPROVED");
      const source = campaign || body;
      const targetIds = [...new Set((Array.isArray(source.pageIds) ? source.pageIds : [source.pageId]).map((id) => clean(id, 100)).filter(Boolean))].slice(0, MAX_BATCH_PUBLISH);
      if (!targetIds.length) throw fail("Chọn ít nhất một Page để đăng.");
      const message = clean(source.message, 63206);
      const link = clean(source.link, 1200);
      const mediaUrl = clean(source.mediaUrl, 1200);
      const mediaType = ["text", "photo", "video"].includes(source.mediaType) ? source.mediaType : "text";
      if (!message && !link && !mediaUrl) throw fail("Bài đăng chưa có nội dung.");
      const scheduledAt = source.scheduledAt ? new Date(source.scheduledAt) : null;
      if (scheduledAt && (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 10 * 60 * 1000)) throw fail("Lịch đăng phải cách hiện tại ít nhất 10 phút.");
      const overrideMap = new Map((Array.isArray(source.overrides) ? source.overrides : []).map((item) => [clean(item.pageId, 100), item]));
      const job = { userId: user._id, campaignId: campaign?._id || null, kind: scheduledAt ? "schedule" : "publish", status: "running", total: targetIds.length, completed: 0, failed: 0, results: [], createdAt: new Date(), updatedAt: new Date() };
      const inserted = await jobs.insertOne(job);
      if (campaign) await campaigns.updateOne({ _id: campaign._id, userId: user._id }, { $set: { status: "publishing", lastJobId: inserted.insertedId, updatedAt: new Date() } });
      for (const pageId of targetIds) {
        try {
          const record = await pageConnection(db, user._id, pageId);
          const token = decryptToken(record.accessToken, record);
          const override = overrideMap.get(pageId) || {};
          const pageMessage = clean(override.message, 63206) || message;
          const pageLink = clean(override.link, 1200) || link;
          const pageMediaUrl = clean(override.mediaUrl, 1200) || mediaUrl;
          const pageSchedule = override.scheduledAt ? new Date(override.scheduledAt) : scheduledAt;
          if (pageSchedule && (!Number.isFinite(pageSchedule.getTime()) || pageSchedule.getTime() < Date.now() + 10 * 60 * 1000)) throw fail("Lịch riêng của Page phải cách hiện tại ít nhất 10 phút.");
          const common = { message: pageMessage, ...(pageSchedule ? { published: "false", scheduled_publish_time: String(Math.floor(pageSchedule.getTime() / 1000)) } : {}) };
          let result;
          if (mediaType === "photo") result = await graph(`${pageId}/photos`, token, { method: "POST", body: { ...common, url: pageMediaUrl, caption: pageMessage } });
          else if (mediaType === "video") result = await graph(`${pageId}/videos`, token, { method: "POST", body: { ...common, file_url: pageMediaUrl, description: pageMessage } });
          else result = await graph(`${pageId}/feed`, token, { method: "POST", body: { ...common, link: pageLink } });
          job.completed += 1;
          job.results.push({ pageId, ok: true, postId: clean(result.id, 160) });
        } catch (error) {
          job.failed += 1;
          job.results.push({ pageId, ok: false, error: clean(error.message, 240) });
        }
      }
      job.status = job.failed === 0 ? "completed" : job.completed ? "partial" : "failed";
      job.updatedAt = new Date();
      await jobs.updateOne({ _id: inserted.insertedId, userId: user._id }, { $set: job });
      if (campaign) await campaigns.updateOne({ _id: campaign._id, userId: user._id }, { $set: { status: job.status === "completed" ? "published" : job.status, publishedAt: job.completed ? new Date() : null, lastJobId: inserted.insertedId, updatedAt: new Date() } });
      await writeAudit(db, user._id, scheduledAt ? "posts:schedule" : "posts:publish", { status: job.status, detail: `${job.completed}/${job.total}` });
      return res.status(job.failed ? 207 : 201).json({ ok: job.failed === 0, job: { id: String(inserted.insertedId), ...job } });
    }

    if (route === "comments" && req.method === "GET") {
      const record = await pageConnection(db, user._id, req.query.pageId);
      const token = decryptToken(record.accessToken, record);
      const data = await graph(`${clean(req.query.postId, 180)}/comments`, token, { params: { fields: "id,message,created_time,from,can_hide,can_remove,is_hidden,like_count", limit: 100 } });
      return res.status(200).json({ comments: data.data || [] });
    }

    if (route === "comments/reply" && req.method === "POST") {
      const record = await pageConnection(db, user._id, body.pageId);
      const token = decryptToken(record.accessToken, record);
      const message = clean(body.message, 8000);
      if (!message) throw fail("Nội dung trả lời đang trống.");
      const result = await graph(`${clean(body.commentId, 180)}/comments`, token, { method: "POST", body: { message } });
      await writeAudit(db, user._id, "comment:reply", { pageId: record.pageId });
      return res.status(201).json({ ok: true, id: result.id });
    }

    if (route === "comments/hide" && req.method === "POST") {
      const record = await pageConnection(db, user._id, body.pageId);
      const token = decryptToken(record.accessToken, record);
      await graph(clean(body.commentId, 180), token, { method: "POST", body: { is_hidden: body.hidden !== false ? "true" : "false" } });
      await writeAudit(db, user._id, body.hidden !== false ? "comment:hide" : "comment:unhide", { pageId: record.pageId });
      return res.status(200).json({ ok: true });
    }

    if (route === "webhooks/subscribe" && req.method === "POST") {
      if (!process.env.META_WEBHOOK_VERIFY_TOKEN) throw fail("Máy chủ chưa cấu hình META_WEBHOOK_VERIFY_TOKEN.", 503, "META_WEBHOOK_NOT_CONFIGURED");
      const record = await pageConnection(db, user._id, body.pageId);
      const token = decryptToken(record.accessToken, record);
      const allowed = new Set(["feed", "mentions", "ratings"]);
      const fields = (Array.isArray(body.fields) ? body.fields : ["feed", "mentions"]).map((item) => clean(item, 40)).filter((item) => allowed.has(item));
      await graph(`${record.pageId}/subscribed_apps`, token, { method: "POST", body: { subscribed_fields: [...new Set(fields)].join(",") || "feed" } });
      await connections.updateOne({ _id: record._id, userId: user._id }, { $set: { webhookSubscribed: true, webhookFields: fields, webhookSubscribedAt: new Date(), updatedAt: new Date() } });
      await writeAudit(db, user._id, "webhook:subscribe", { pageId: record.pageId, detail: fields.join(",") });
      return res.status(200).json({ ok: true, pageId: record.pageId, fields });
    }

    if (route === "webhooks/unsubscribe" && req.method === "DELETE") {
      const record = await pageConnection(db, user._id, body.pageId);
      const token = decryptToken(record.accessToken, record);
      await graph(`${record.pageId}/subscribed_apps`, token, { method: "DELETE" });
      await connections.updateOne({ _id: record._id, userId: user._id }, { $set: { webhookSubscribed: false, webhookFields: [], updatedAt: new Date() } });
      await writeAudit(db, user._id, "webhook:unsubscribe", { pageId: record.pageId });
      return res.status(200).json({ ok: true, pageId: record.pageId });
    }

    if (route === "insights" && req.method === "GET") {
      const record = await pageConnection(db, user._id, req.query.pageId);
      const token = decryptToken(record.accessToken, record);
      const allowed = new Set(["page_impressions_unique", "page_post_engagements", "page_follows", "page_video_views"]);
      const requested = clean(req.query.metrics, 500).split(",").filter((item) => allowed.has(item));
      const data = await graph(`${record.pageId}/insights`, token, { params: { metric: (requested.length ? requested : [...allowed]).join(","), period: "day", since: Math.floor(Date.now() / 1000) - 28 * 86400, until: Math.floor(Date.now() / 1000) } });
      return res.status(200).json({ insights: data.data || [] });
    }

    if (route === "campaigns/save" && ["POST", "PATCH"].includes(req.method)) {
      const id = ObjectId.isValid(body.id) ? new ObjectId(body.id) : null;
      const previous = id ? await campaigns.findOne({ _id: id, userId: user._id }) : null;
      if (id && !previous) throw fail("Không tìm thấy chiến dịch.", 404, "FACEBOOK_CAMPAIGN_NOT_FOUND");
      if (previous && !["draft", "review"].includes(previous.status)) throw fail("Chỉ chiến dịch nháp hoặc đang chờ duyệt mới được sửa.", 409, "FACEBOOK_CAMPAIGN_LOCKED");
      const requestedStatus = body.status === "review" ? "review" : "draft";
      const doc = campaignDoc({ ...body, status: requestedStatus }, user._id, previous || {});
      const owned = doc.pageIds.length ? await connections.countDocuments({ userId: user._id, pageId: { $in: doc.pageIds } }) : 0;
      if (owned !== doc.pageIds.length) throw fail("Chiến dịch chứa Page chưa được tài khoản HH này kết nối.", 403, "FACEBOOK_CAMPAIGN_PAGE_FORBIDDEN");
      if (!doc.message && !doc.link && !doc.mediaUrl) throw fail("Chiến dịch chưa có nội dung.");
      if (id) await campaigns.updateOne({ _id: id, userId: user._id }, { $set: doc });
      else { const result = await campaigns.insertOne(doc); doc._id = result.insertedId; }
      await writeAudit(db, user._id, previous ? "campaign:update" : "campaign:create", { status: doc.status, detail: doc.name });
      return res.status(previous ? 200 : 201).json({ campaign: publicCampaign({ ...doc, _id: id || doc._id }) });
    }

    if (route === "campaigns/stage" && req.method === "POST") {
      const id = ObjectId.isValid(body.id) ? new ObjectId(body.id) : null;
      const campaign = id ? await campaigns.findOne({ _id: id, userId: user._id }) : null;
      if (!campaign) throw fail("Không tìm thấy chiến dịch.", 404, "FACEBOOK_CAMPAIGN_NOT_FOUND");
      const requested = clean(body.status, 40);
      const transitions = { draft: ["review", "archived"], review: ["approved", "draft", "archived"], approved: ["draft", "archived"], failed: ["draft", "archived"], partial: ["draft", "archived"] };
      if (!(transitions[campaign.status] || []).includes(requested)) throw fail(`Không thể chuyển chiến dịch từ ${campaign.status} sang ${requested}.`, 409, "FACEBOOK_CAMPAIGN_TRANSITION_INVALID");
      const now = new Date();
      const update = { status: requested, updatedAt: now };
      if (requested === "review") update.submittedAt = now;
      if (requested === "approved") { update.approvedAt = now; update.approvedBy = user._id; }
      const message = clean(body.note, 1200);
      const approvalNote = message ? { id: crypto.randomUUID(), message, kind: requested === "approved" ? "approval" : requested === "draft" ? "request_changes" : "comment", authorName: clean(user.name || user.email || "HH Reviewer", 120), createdAt: now } : null;
      await campaigns.updateOne({ _id: id, userId: user._id }, { $set: update, ...(approvalNote ? { $push: { approvalNotes: { $each: [approvalNote], $slice: -100 } } } : {}) });
      await writeAudit(db, user._id, `campaign:${requested}`, { status: requested, detail: campaign.name });
      return res.status(200).json({ campaign: publicCampaign({ ...campaign, ...update, approvalNotes: [...(campaign.approvalNotes || []), ...(approvalNote ? [approvalNote] : [])] }) });
    }

    if (route === "campaigns/note" && req.method === "POST") {
      const id = ObjectId.isValid(body.id) ? new ObjectId(body.id) : null;
      const campaign = id ? await campaigns.findOne({ _id: id, userId: user._id }) : null;
      if (!campaign) throw fail("Không tìm thấy chiến dịch.", 404, "FACEBOOK_CAMPAIGN_NOT_FOUND");
      const message = clean(body.message, 1200);
      if (!message) throw fail("Ghi chú duyệt đang trống.");
      const note = { id: crypto.randomUUID(), message, kind: ["comment", "request_changes"].includes(body.kind) ? body.kind : "comment", authorName: clean(user.name || user.email || "HH Reviewer", 120), createdAt: new Date() };
      await campaigns.updateOne({ _id: id, userId: user._id }, { $push: { approvalNotes: { $each: [note], $slice: -100 } }, $set: { updatedAt: new Date() } });
      await writeAudit(db, user._id, "campaign:note", { status: campaign.status, detail: campaign.name });
      return res.status(201).json({ note });
    }

    if (route === "campaigns/delete" && req.method === "DELETE") {
      const id = ObjectId.isValid(body.id || req.query.id) ? new ObjectId(body.id || req.query.id) : null;
      const campaign = id ? await campaigns.findOne({ _id: id, userId: user._id }) : null;
      if (!campaign) throw fail("Không tìm thấy chiến dịch.", 404);
      if (["publishing", "published"].includes(campaign.status)) throw fail("Không xóa chiến dịch đang hoặc đã xuất bản; hãy lưu trữ để giữ audit.", 409);
      await campaigns.deleteOne({ _id: id, userId: user._id });
      return res.status(200).json({ ok: true });
    }

    if (route === "groups/save" && ["POST", "PATCH"].includes(req.method)) {
      const id = ObjectId.isValid(body.id) ? new ObjectId(body.id) : null;
      const previous = id ? await groups.findOne({ _id: id, userId: user._id }) : null;
      if (id && !previous) throw fail("Không tìm thấy nhóm Page.", 404);
      const pageIds = [...new Set((Array.isArray(body.pageIds) ? body.pageIds : []).map((item) => clean(item, 100)).filter(Boolean))].slice(0, MAX_PAGES);
      const owned = pageIds.length ? await connections.countDocuments({ userId: user._id, pageId: { $in: pageIds } }) : 0;
      if (owned !== pageIds.length) throw fail("Nhóm chứa Page chưa được kết nối.", 403);
      const now = new Date();
      const doc = { userId: user._id, name: clean(body.name, 100), color: /^#[0-9a-f]{6}$/i.test(String(body.color || "")) ? String(body.color).toUpperCase() : "#6E9DFF", pageIds, updatedAt: now, createdAt: previous?.createdAt || now };
      if (!doc.name) throw fail("Nhóm Page cần có tên.");
      try {
        if (id) await groups.updateOne({ _id: id, userId: user._id }, { $set: doc });
        else { const result = await groups.insertOne(doc); doc._id = result.insertedId; }
      } catch (error) { if (error?.code === 11000) throw fail("Tên nhóm Page đã tồn tại.", 409); throw error; }
      return res.status(previous ? 200 : 201).json({ group: publicGroup({ ...doc, _id: id || doc._id }) });
    }

    if (route === "groups/delete" && req.method === "DELETE") {
      const id = ObjectId.isValid(body.id || req.query.id) ? new ObjectId(body.id || req.query.id) : null;
      const result = id ? await groups.deleteOne({ _id: id, userId: user._id }) : { deletedCount: 0 };
      if (!result.deletedCount) throw fail("Không tìm thấy nhóm Page.", 404);
      return res.status(200).json({ ok: true });
    }

    if (route === "automations/save" && ["POST", "PATCH"].includes(req.method)) {
      const id = ObjectId.isValid(body.id) ? new ObjectId(body.id) : null;
      const previous = id ? await rules.findOne({ _id: id, userId: user._id }) : null;
      if (id && !previous) throw fail("Không tìm thấy automation.", 404);
      const pageIds = [...new Set((Array.isArray(body.pageIds) ? body.pageIds : []).map((item) => clean(item, 100)).filter(Boolean))].slice(0, MAX_PAGES);
      const now = new Date();
      const doc = { userId: user._id, name: clean(body.name, 120), enabled: body.enabled !== false, pageIds, keyword: clean(body.keyword, 120).toLocaleLowerCase("vi"), action: ["notify", "flag", "label"].includes(body.action) ? body.action : "notify", label: clean(body.label, 80), updatedAt: now, createdAt: previous?.createdAt || now };
      if (!doc.name || !doc.keyword) throw fail("Automation cần tên và từ khóa.");
      if (id) await rules.updateOne({ _id: id, userId: user._id }, { $set: doc });
      else { const result = await rules.insertOne(doc); doc._id = result.insertedId; }
      return res.status(previous ? 200 : 201).json({ rule: publicRule({ ...doc, _id: id || doc._id }) });
    }

    if (route === "automations/delete" && req.method === "DELETE") {
      const id = ObjectId.isValid(body.id || req.query.id) ? new ObjectId(body.id || req.query.id) : null;
      const result = id ? await rules.deleteOne({ _id: id, userId: user._id }) : { deletedCount: 0 };
      if (!result.deletedCount) throw fail("Không tìm thấy automation.", 404);
      return res.status(200).json({ ok: true });
    }

    if (route === "templates/save" && ["POST", "PATCH"].includes(req.method)) {
      const id = ObjectId.isValid(body.id) ? new ObjectId(body.id) : null;
      const previous = id ? await templates.findOne({ _id: id, userId: user._id }) : null;
      if (id && !previous) throw fail("Không tìm thấy mẫu nội dung.", 404);
      const doc = contentTemplateDoc(body, user._id, previous || {});
      try {
        if (id) await templates.updateOne({ _id: id, userId: user._id }, { $set: doc });
        else { const result = await templates.insertOne(doc); doc._id = result.insertedId; }
      } catch (error) { if (error?.code === 11000) throw fail("Tên mẫu nội dung đã tồn tại.", 409); throw error; }
      await writeAudit(db, user._id, previous ? "template:update" : "template:create", { detail: doc.name });
      return res.status(previous ? 200 : 201).json({ template: publicContentTemplate({ ...doc, _id: id || doc._id }) });
    }

    if (route === "templates/use" && req.method === "POST") {
      const id = ObjectId.isValid(body.id) ? new ObjectId(body.id) : null;
      const result = id ? await templates.findOneAndUpdate({ _id: id, userId: user._id }, { $inc: { useCount: 1 }, $set: { lastUsedAt: new Date(), updatedAt: new Date() } }, { returnDocument: "after" }) : null;
      if (!result) throw fail("Không tìm thấy mẫu nội dung.", 404);
      return res.status(200).json({ template: publicContentTemplate(result) });
    }

    if (route === "templates/delete" && req.method === "DELETE") {
      const id = ObjectId.isValid(body.id || req.query.id) ? new ObjectId(body.id || req.query.id) : null;
      const result = id ? await templates.deleteOne({ _id: id, userId: user._id }) : { deletedCount: 0 };
      if (!result.deletedCount) throw fail("Không tìm thấy mẫu nội dung.", 404);
      return res.status(200).json({ ok: true });
    }

    if (route === "setups" && req.method === "POST") {
      const doc = setupDoc(body, user._id);
      const result = await setups.insertOne(doc);
      return res.status(201).json({ setup: publicSetup({ ...doc, _id: result.insertedId }) });
    }

    if (route === "setups/import" && req.method === "POST") {
      const rows = Array.isArray(body.items) ? body.items.slice(0, MAX_SETUP_IMPORT) : [];
      if (!rows.length) throw fail("Tệp import không có Page hợp lệ.");
      const existing = await setups.find({ userId: user._id }).project({ name: 1, username: 1, createdAt: 1 }).toArray();
      const seen = new Set(existing.flatMap((item) => [String(item.name || "").toLocaleLowerCase("vi"), String(item.username || "").toLocaleLowerCase("vi")].filter(Boolean)));
      const documents = [];
      const errors = [];
      rows.forEach((row, index) => {
        try {
          const doc = setupDoc(row || {}, user._id);
          const keys = [doc.name.toLocaleLowerCase("vi"), doc.username.toLocaleLowerCase("vi")].filter(Boolean);
          if (keys.some((key) => seen.has(key))) throw fail("Trùng tên hoặc username.");
          keys.forEach((key) => seen.add(key));
          documents.push(doc);
        } catch (error) { errors.push({ row: index + 1, error: clean(error.message, 180) }); }
      });
      if (documents.length) await setups.insertMany(documents);
      await writeAudit(db, user._id, "setups:import", { status: errors.length ? "partial" : "completed", detail: `${documents.length} hợp lệ, ${errors.length} lỗi` });
      return res.status(errors.length ? 207 : 201).json({ ok: errors.length === 0, imported: documents.length, rejected: errors.length, errors: errors.slice(0, 100) });
    }

    if (route === "setups/update" && ["POST", "PATCH"].includes(req.method)) {
      const id = ObjectId.isValid(body.id) ? new ObjectId(body.id) : null;
      const previous = id ? await setups.findOne({ _id: id, userId: user._id }) : null;
      if (!previous) throw fail("Không tìm thấy Page Setup.", 404);
      const doc = setupDoc(body, user._id, previous);
      await setups.updateOne({ _id: id, userId: user._id }, { $set: doc });
      return res.status(200).json({ setup: publicSetup({ ...doc, _id: id }) });
    }

    if (route === "setups/delete" && req.method === "DELETE") {
      const id = ObjectId.isValid(body.id || req.query.id) ? new ObjectId(body.id || req.query.id) : null;
      const result = id ? await setups.deleteOne({ _id: id, userId: user._id }) : { deletedCount: 0 };
      if (!result.deletedCount) throw fail("Không tìm thấy Page Setup.", 404);
      return res.status(200).json({ ok: true });
    }

    if (route === "disconnect" && req.method === "DELETE") {
      const ids = [...new Set((Array.isArray(body.pageIds) ? body.pageIds : [body.pageId]).map((id) => clean(id, 100)).filter(Boolean))];
      if (!ids.length) throw fail("Chọn Page cần ngắt kết nối.");
      const result = await connections.deleteMany({ userId: user._id, pageId: { $in: ids } });
      await writeAudit(db, user._id, "pages:disconnect", { detail: `${result.deletedCount} Pages` });
      return res.status(200).json({ ok: true, disconnected: result.deletedCount });
    }

    throw fail("Facebook Page API route không tồn tại.", 404, "FACEBOOK_ROUTE_NOT_FOUND");
  });
};

module.exports.__test = Object.freeze({ PERMISSIONS, GRAPH_VERSION, MAX_BATCH_PUBLISH, MAX_SETUP_IMPORT, MAX_CONTENT_TEMPLATES, safeReturnHash, setupDoc, publicSetup, campaignDoc, publicCampaign, publicGroup, publicRule, contentTemplateDoc, publicContentTemplate, recommendPostingSlots });
