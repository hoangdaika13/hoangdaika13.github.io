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
  "read_insights"
]);
const MAX_PAGES = 200;
const MAX_BATCH_PUBLISH = 20;
const MAX_SETUP_IMPORT = 500;

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
    await Promise.all([
      connections.createIndex({ userId: 1, pageId: 1 }, { unique: true }),
      connections.createIndex({ userId: 1, active: 1, updatedAt: -1 }),
      oauthStates.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      setups.createIndex({ userId: 1, updatedAt: -1 }),
      jobs.createIndex({ userId: 1, createdAt: -1 })
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
      const [allPages, setupRows, recentJobs, audits] = await Promise.all([
        connections.find({ userId: user._id }).sort({ active: -1, pageName: 1 }).limit(MAX_PAGES).toArray(),
        setups.find({ userId: user._id }).sort({ updatedAt: -1 }).limit(MAX_SETUP_IMPORT).toArray(),
        jobs.find({ userId: user._id }).sort({ createdAt: -1 }).limit(25).toArray(),
        db.collection("facebookPageAudits").find({ userId: user._id }).sort({ createdAt: -1 }).limit(30).toArray()
      ]);
      return res.status(200).json({
        configured: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
        callbackUrl: callbackUrl(req), graphVersion: GRAPH_VERSION, permissions: PERMISSIONS,
        pages: allPages.map(publicPage), setups: setupRows.map(publicSetup),
        jobs: recentJobs.map((item) => ({ id: String(item._id), kind: item.kind, status: item.status, total: item.total, completed: item.completed, failed: item.failed, createdAt: item.createdAt })),
        audits: audits.map((item) => ({ id: String(item._id), action: item.action, pageId: item.pageId || "", status: item.status, detail: item.detail || "", createdAt: item.createdAt })),
        capabilities: { automaticPageCreation: false, batchSetup: true, pageManagement: true, publish: true, schedule: true, comments: true, insights: true },
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

    if (route === "publish" && req.method === "POST") {
      const targetIds = [...new Set((Array.isArray(body.pageIds) ? body.pageIds : [body.pageId]).map((id) => clean(id, 100)).filter(Boolean))].slice(0, MAX_BATCH_PUBLISH);
      if (!targetIds.length) throw fail("Chọn ít nhất một Page để đăng.");
      const message = clean(body.message, 63206);
      const link = clean(body.link, 1200);
      const mediaUrl = clean(body.mediaUrl, 1200);
      const mediaType = ["text", "photo", "video"].includes(body.mediaType) ? body.mediaType : "text";
      if (!message && !link && !mediaUrl) throw fail("Bài đăng chưa có nội dung.");
      const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
      if (scheduledAt && (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 10 * 60 * 1000)) throw fail("Lịch đăng phải cách hiện tại ít nhất 10 phút.");
      const job = { userId: user._id, kind: scheduledAt ? "schedule" : "publish", status: "running", total: targetIds.length, completed: 0, failed: 0, results: [], createdAt: new Date(), updatedAt: new Date() };
      const inserted = await jobs.insertOne(job);
      for (const pageId of targetIds) {
        try {
          const record = await pageConnection(db, user._id, pageId);
          const token = decryptToken(record.accessToken, record);
          const common = { message, ...(scheduledAt ? { published: "false", scheduled_publish_time: String(Math.floor(scheduledAt.getTime() / 1000)) } : {}) };
          let result;
          if (mediaType === "photo") result = await graph(`${pageId}/photos`, token, { method: "POST", body: { ...common, url: mediaUrl, caption: message } });
          else if (mediaType === "video") result = await graph(`${pageId}/videos`, token, { method: "POST", body: { ...common, file_url: mediaUrl, description: message } });
          else result = await graph(`${pageId}/feed`, token, { method: "POST", body: { ...common, link } });
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

    if (route === "insights" && req.method === "GET") {
      const record = await pageConnection(db, user._id, req.query.pageId);
      const token = decryptToken(record.accessToken, record);
      const allowed = new Set(["page_impressions_unique", "page_post_engagements", "page_follows", "page_video_views"]);
      const requested = clean(req.query.metrics, 500).split(",").filter((item) => allowed.has(item));
      const data = await graph(`${record.pageId}/insights`, token, { params: { metric: (requested.length ? requested : [...allowed]).join(","), period: "day", since: Math.floor(Date.now() / 1000) - 28 * 86400, until: Math.floor(Date.now() / 1000) } });
      return res.status(200).json({ insights: data.data || [] });
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

module.exports.__test = Object.freeze({ PERMISSIONS, GRAPH_VERSION, MAX_BATCH_PUBLISH, MAX_SETUP_IMPORT, safeReturnHash, setupDoc, publicSetup });
