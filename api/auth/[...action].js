const { bcrypt, clean, currentUser, enforceRateLimit, publicUser, signOAuthState, signUser, verifyOAuthState, withApi } = require("../_lib/platform");

function clientIp(req) {
  return clean(String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0], 80);
}

function strongPassword(value) {
  const bytes = Buffer.byteLength(value, "utf8");
  return value.length >= 15 && bytes <= 72;
}

function appOrigin(req) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${protocol}://${host}`;
}

function frontendOrigin(value) {
  try {
    const url = new URL(String(value || ""));
    return url.origin;
  } catch {
    return process.env.FRONTEND_URL || "https://hoangdaika13.github.io";
  }
}

function redirectError(res, frontend, message) {
  return res.redirect(`${frontend}/?authError=${encodeURIComponent(message)}#account`);
}

async function upsertOAuthUser(db, profile, provider) {
  const email = clean(profile.email, 160).toLowerCase();
  if (!email) throw new Error("Nhà cung cấp không trả về địa chỉ email.");
  const providerId = clean(profile.id, 240);
  const now = new Date();
  await db.collection("users").updateOne(
    { provider, providerId },
    { $set: { name: clean(profile.name, 160) || email.split("@")[0], email, provider, providerId, avatar: clean(profile.avatar, 800), lastLoginAt: now }, $setOnInsert: { createdAt: now, consent: false } },
    { upsert: true }
  );
  return db.collection("users").findOne({ provider, providerId });
}

async function oauthCallback(req, res, db, provider, code, state) {
  const saved = verifyOAuthState(state, provider);
  const frontend = frontendOrigin(saved?.returnTo);
  if (!saved || !code) return redirectError(res, frontend, "Phiên đăng nhập đã hết hạn. Hãy thử lại.");
  const redirectUri = process.env[`${provider.toUpperCase()}_CALLBACK_URL`] || `${appOrigin(req)}/api/auth/${provider}/callback`;
  try {
    let profile;
    if (provider === "google") {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", redirect_uri: redirectUri, grant_type: "authorization_code" }) });
      const tokens = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokens.error_description || "Google không chấp nhận yêu cầu đăng nhập.");
      const personResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      const person = await personResponse.json();
      if (!personResponse.ok) throw new Error("Không lấy được hồ sơ Google.");
      profile = { id: person.sub, email: person.email, name: person.name, avatar: person.picture };
    } else {
      const tokenUrl = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
      tokenUrl.search = new URLSearchParams({ client_id: process.env.FACEBOOK_APP_ID || "", client_secret: process.env.FACEBOOK_APP_SECRET || "", redirect_uri: redirectUri, code }).toString();
      const tokenResponse = await fetch(tokenUrl);
      const tokens = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokens.error?.message || "Facebook không chấp nhận yêu cầu đăng nhập.");
      const personResponse = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(tokens.access_token)}`);
      const person = await personResponse.json();
      if (!personResponse.ok) throw new Error(person.error?.message || "Không lấy được hồ sơ Facebook.");
      profile = { id: person.id, email: person.email, name: person.name, avatar: person.picture?.data?.url };
    }
    const user = await upsertOAuthUser(db, profile, provider);
    await db.collection("loginEvents").insertOne({ userId: user._id, type: `${provider}-login`, userAgent: clean(req.headers["user-agent"], 300), forwardedFor: clean(req.headers["x-forwarded-for"], 120), createdAt: new Date() });
    return res.redirect(`${frontend}/?authToken=${encodeURIComponent(signUser(user))}#account`);
  } catch (error) {
    return redirectError(res, frontend, error.message || "Đăng nhập thất bại.");
  }
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    let action = Array.isArray(req.query.action)
      ? req.query.action
      : (typeof req.query.action === "string" ? [req.query.action] : []);
    if (!action.length) {
      action = String(req.url || "").split("?")[0].split("/").filter(Boolean).slice(2);
    }
    const route = action.join("/");
    if (route === "register" && req.method === "POST") {
      const name = clean(body.name, 160);
      const email = clean(body.email, 160).toLowerCase();
      const password = String(body.password || "");
      await enforceRateLimit(db, `register:${clientIp(req)}`, 5, 60 * 60 * 1000);
      if (!name || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Họ tên hoặc email không hợp lệ." });
      if (!strongPassword(password)) return res.status(400).json({ error: "Mật khẩu cần từ 15 ký tự và không vượt quá giới hạn mã hóa an toàn." });
      if (await db.collection("users").findOne({ email, provider: "local" })) return res.status(409).json({ error: "Email này đã được đăng ký." });
      const user = { name, email, provider: "local", passwordHash: await bcrypt.hash(password, 13), tokenVersion: 0, consent: Boolean(body.consent), createdAt: new Date(), lastLoginAt: new Date() };
      const result = await db.collection("users").insertOne(user);
      user._id = result.insertedId;
      return res.status(201).json({ token: signUser(user), user: publicUser(user) });
    }
    if (route === "login" && req.method === "POST") {
      const email = clean(body.email, 160).toLowerCase();
      await enforceRateLimit(db, `login:${clientIp(req)}:${email}`, 8, 15 * 60 * 1000);
      const user = await db.collection("users").findOne({ email, provider: "local" });
      if (!user || !user.passwordHash || !(await bcrypt.compare(String(body.password || ""), user.passwordHash))) return res.status(401).json({ error: "Sai email hoặc mật khẩu." });
      await db.collection("users").updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
      await db.collection("loginEvents").insertOne({ userId: user._id, type: "login", userAgent: clean(req.headers["user-agent"], 300), forwardedFor: clean(req.headers["x-forwarded-for"], 120), createdAt: new Date() });
      return res.status(200).json({ token: signUser(user), user: publicUser(user) });
    }
    if (route === "logout" && req.method === "POST") {
      const user = await currentUser(req);
      if (user) await db.collection("users").updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 }, $set: { lastLogoutAt: new Date() } });
      return res.status(200).json({ ok: true });
    }
    if (route === "me" && req.method === "GET") {
      const user = await currentUser(req);
      const loginHistory = user ? await db.collection("loginEvents").find({ userId: user._id }).sort({ createdAt: -1 }).limit(12).toArray() : [];
      return res.status(200).json({ user: publicUser(user), loginHistory });
    }
    const provider = action[0];
    if ((provider === "google" || provider === "facebook") && action.length === 1 && req.method === "GET") {
      const clientId = provider === "google" ? process.env.GOOGLE_CLIENT_ID : process.env.FACEBOOK_APP_ID;
      if (!clientId) return redirectError(res, frontendOrigin(req.query.returnTo), `Đăng nhập ${provider === "google" ? "Google" : "Facebook"} chưa được cấu hình trên máy chủ.`);
      const redirectUri = process.env[`${provider.toUpperCase()}_CALLBACK_URL`] || `${appOrigin(req)}/api/auth/${provider}/callback`;
      const state = signOAuthState(provider, frontendOrigin(req.query.returnTo));
      const authUrl = new URL(provider === "google" ? "https://accounts.google.com/o/oauth2/v2/auth" : "https://www.facebook.com/v20.0/dialog/oauth");
      authUrl.search = new URLSearchParams(provider === "google" ? { client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state, prompt: "select_account" } : { client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "email,public_profile", state });
      return res.redirect(authUrl.toString());
    }
    if ((provider === "google" || provider === "facebook") && action[1] === "callback" && req.method === "GET") return oauthCallback(req, res, db, provider, req.query.code, req.query.state);
    return res.status(405).json({ error: "Method not allowed" });
  });
};
