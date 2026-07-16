const crypto = require("crypto");
const { bcrypt, clean, currentUser, enforceRateLimit, publicUser, signOAuthState, signUser, verifyOAuthState, withApi } = require("../../utils/platform");

function clientIp(req) {
  return clean(String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0], 80);
}

function strongPassword(value) {
  return value.length >= 8 && Buffer.byteLength(value, "utf8") <= 72;
}

function appOrigin(req) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${protocol}://${host}`;
}

function allowedFrontendOrigins() {
  const configured = String(process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  return new Set([process.env.FRONTEND_URL || "https://hoangdaika13.github.io", "https://hoangdaika13.github.io", ...configured]);
}

function frontendOrigin(value) {
  const fallback = process.env.FRONTEND_URL || "https://hoangdaika13.github.io";
  try {
    const origin = new URL(String(value || "")).origin;
    return allowedFrontendOrigins().has(origin) ? origin : fallback;
  } catch { return fallback; }
}

function redirectError(res, frontend, message) {
  return res.redirect(`${frontend}/?authError=${encodeURIComponent(clean(message, 180) || "Đăng nhập thất bại.")}#/home`);
}

function cookie(req, name) {
  const row = String(req.headers.cookie || "").split(";").map((value) => value.trim()).find((value) => value.startsWith(`${name}=`));
  return row ? decodeURIComponent(row.slice(name.length + 1)) : "";
}

function oauthCookie(res, provider, nonce = "") {
  res.setHeader("Set-Cookie", `hh_oauth_${provider}=${encodeURIComponent(nonce)}; Max-Age=${nonce ? 600 : 0}; Path=/api/auth/${provider}; HttpOnly; Secure; SameSite=Lax`);
}

function safeState(req, provider, state) {
  const saved = verifyOAuthState(state, provider);
  if (!saved?.nonce) return null;
  const actual = cookie(req, `hh_oauth_${provider}`);
  if (!actual || actual.length !== saved.nonce.length) return null;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(saved.nonce)) ? saved : null;
}

function callbackUrl(req, provider) {
  return process.env[`${provider.toUpperCase()}_CALLBACK_URL`] || `${appOrigin(req)}/api/auth/${provider}/callback`;
}

function facebookVersion() {
  return clean(process.env.FACEBOOK_GRAPH_VERSION || "v23.0", 16);
}

async function upsertOAuthUser(db, profile, provider) {
  const email = clean(profile.email, 160).toLowerCase();
  if (!email) throw new Error("Nhà cung cấp không trả về địa chỉ email.");
  const providerId = clean(profile.id, 240);
  const now = new Date();
  const users = db.collection("users");
  const existing = await users.findOne({ $or: [{ provider, providerId }, { email }] });
  const fields = {
    name: clean(profile.name, 160) || email.split("@")[0], email,
    avatar: clean(profile.avatar, 800), lastProvider: provider,
    lastLoginAt: now, lastSeenAt: now, updatedAt: now,
    [`oauth.${provider}.id`]: providerId
  };
  if (existing) {
    if (["deleted", "suspended", "locked", "banned"].includes(String(existing.status || "").toLocaleLowerCase("en-US"))) {
      throw new Error("Tài khoản này hiện không được phép đăng nhập.");
    }
    await users.updateOne({ _id: existing._id }, { $set: fields });
    return users.findOne({ _id: existing._id });
  }
  delete fields[`oauth.${provider}.id`];
  const result = await users.insertOne({ ...fields, status: "active", provider, providerId, oauth: { [provider]: { id: providerId } }, tokenVersion: 0, consent: false, createdAt: now });
  return users.findOne({ _id: result.insertedId });
}

async function oauthCallback(req, res, db, provider, code, state) {
  const saved = safeState(req, provider, state);
  const frontend = frontendOrigin(saved?.returnTo);
  oauthCookie(res, provider);
  if (!saved || !code) return redirectError(res, frontend, "Phiên đăng nhập đã hết hạn. Hãy thử lại.");
  const redirectUri = callbackUrl(req, provider);
  try {
    let profile;
    if (provider === "google") {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", redirect_uri: redirectUri, grant_type: "authorization_code" })
      });
      const tokens = await tokenResponse.json();
      if (!tokenResponse.ok || !tokens.access_token) throw new Error(tokens.error_description || "Google không chấp nhận yêu cầu đăng nhập.");
      const personResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      const person = await personResponse.json();
      if (!personResponse.ok || !person.email_verified) throw new Error("Google chưa xác minh email của tài khoản.");
      profile = { id: person.sub, email: person.email, name: person.name, avatar: person.picture };
    } else {
      const version = facebookVersion();
      const tokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
      tokenUrl.search = new URLSearchParams({ client_id: process.env.FACEBOOK_APP_ID || "", client_secret: process.env.FACEBOOK_APP_SECRET || "", redirect_uri: redirectUri, code }).toString();
      const tokenResponse = await fetch(tokenUrl);
      const tokens = await tokenResponse.json();
      if (!tokenResponse.ok || !tokens.access_token) throw new Error(tokens.error?.message || "Facebook không chấp nhận yêu cầu đăng nhập.");
      const personResponse = await fetch(`https://graph.facebook.com/${version}/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(tokens.access_token)}`);
      const person = await personResponse.json();
      if (!personResponse.ok) throw new Error(person.error?.message || "Không lấy được hồ sơ Facebook.");
      profile = { id: person.id, email: person.email, name: person.name, avatar: person.picture?.data?.url };
    }
    const user = await upsertOAuthUser(db, profile, provider);
    const now = new Date();
    await Promise.all([
      db.collection("loginEvents").insertOne({ userId: user._id, type: `${provider}-login`, userAgent: clean(req.headers["user-agent"], 300), forwardedFor: clean(req.headers["x-forwarded-for"], 120), createdAt: now }),
      db.collection("events").insertOne({ type: `auth:${provider}`, userId: user._id, createdAt: now })
    ]);
    return res.redirect(`${frontend}/?authToken=${encodeURIComponent(signUser(user))}#/home`);
  } catch (error) { return redirectError(res, frontend, error.message); }
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    let action = Array.isArray(req.query.action) ? req.query.action : (typeof req.query.action === "string" ? [req.query.action] : []);
    if (!action.length) action = String(req.url || "").split("?")[0].split("/").filter(Boolean).slice(2);
    if (req.query.oauthCallback === "google" || req.query.oauthCallback === "facebook") {
      action = [req.query.oauthCallback, "callback"];
    }
    const route = action.join("/");

    if (route === "providers" && req.method === "GET") return res.status(200).json({
      google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      facebook: Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
      callbacks: { google: callbackUrl(req, "google"), facebook: callbackUrl(req, "facebook") }
    });

    if (route === "register" && req.method === "POST") {
      const name = clean(body.name, 160); const email = clean(body.email, 160).toLowerCase(); const password = String(body.password || "");
      await enforceRateLimit(db, `register:${clientIp(req)}`, 5, 60 * 60 * 1000);
      if (!name || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Họ tên hoặc email không hợp lệ." });
      if (!strongPassword(password)) return res.status(400).json({ error: "Mật khẩu cần từ 8 ký tự và không vượt quá giới hạn mã hóa an toàn." });
      if (await db.collection("users").findOne({ email })) return res.status(409).json({ error: "Email này đã được đăng ký." });
      const now = new Date();
      const user = { name, email, provider: "local", passwordHash: await bcrypt.hash(password, 13), tokenVersion: 0, consent: Boolean(body.consent), status: "active", createdAt: now, updatedAt: now, lastLoginAt: now, lastSeenAt: now };
      const result = await db.collection("users").insertOne(user); user._id = result.insertedId;
      await db.collection("events").insertOne({ type: "auth:register", userId: user._id, createdAt: now });
      return res.status(201).json({ token: signUser(user), user: publicUser(user) });
    }
    if (route === "login" && req.method === "POST") {
      const email = clean(body.email, 160).toLowerCase();
      await enforceRateLimit(db, `login:${clientIp(req)}:${email}`, 8, 15 * 60 * 1000);
      const user = await db.collection("users").findOne({ email, provider: "local" });
      if (!user || !user.passwordHash || !(await bcrypt.compare(String(body.password || ""), user.passwordHash))) return res.status(401).json({ error: "Sai email hoặc mật khẩu." });
      if (["deleted", "suspended", "locked", "banned"].includes(String(user.status || "").toLocaleLowerCase("en-US"))) return res.status(403).json({ error: "Tài khoản này hiện không được phép đăng nhập." });
      const now = new Date();
      await db.collection("users").updateOne({ _id: user._id }, { $set: { lastLoginAt: now, lastSeenAt: now } });
      await db.collection("loginEvents").insertOne({ userId: user._id, type: "login", userAgent: clean(req.headers["user-agent"], 300), forwardedFor: clean(req.headers["x-forwarded-for"], 120), createdAt: now });
      return res.status(200).json({ token: signUser(user), user: publicUser(user) });
    }
    if (route === "logout" && req.method === "POST") {
      const user = await currentUser(req);
      if (user) await db.collection("users").updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 }, $set: { lastLogoutAt: new Date() } });
      return res.status(200).json({ ok: true });
    }
    if (route === "me" && req.method === "GET") {
      const user = await currentUser(req);
      if (user) await db.collection("users").updateOne({ _id: user._id }, { $set: { lastSeenAt: new Date() } });
      const loginHistory = user ? await db.collection("loginEvents").find({ userId: user._id }).sort({ createdAt: -1 }).limit(12).toArray() : [];
      return res.status(200).json({ user: publicUser(user), loginHistory });
    }

    const provider = action[0];
    if ((provider === "google" || provider === "facebook") && action.length === 1 && req.method === "GET") {
      const clientId = provider === "google" ? process.env.GOOGLE_CLIENT_ID : process.env.FACEBOOK_APP_ID;
      const clientSecret = provider === "google" ? process.env.GOOGLE_CLIENT_SECRET : process.env.FACEBOOK_APP_SECRET;
      const frontend = frontendOrigin(req.query.returnTo);
      if (!clientId || !clientSecret) return redirectError(res, frontend, `Đăng nhập ${provider === "google" ? "Google" : "Facebook"} chưa được cấu hình trên máy chủ.`);
      const redirectUri = callbackUrl(req, provider);
      const nonce = crypto.randomBytes(24).toString("base64url");
      const state = signOAuthState(provider, frontend, nonce);
      oauthCookie(res, provider, nonce);
      const authUrl = new URL(provider === "google" ? "https://accounts.google.com/o/oauth2/v2/auth" : `https://www.facebook.com/${facebookVersion()}/dialog/oauth`);
      authUrl.search = new URLSearchParams(provider === "google" ? { client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state, prompt: "select_account" } : { client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "email,public_profile", state });
      return res.redirect(authUrl.toString());
    }
    if ((provider === "google" || provider === "facebook") && action[1] === "callback" && req.method === "GET") return oauthCallback(req, res, db, provider, req.query.code, req.query.state);
    return res.status(405).json({ error: "Method not allowed" });
  });
};
