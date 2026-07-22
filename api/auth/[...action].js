const crypto = require("crypto");
const QRCode = require("qrcode");
const {
  bcrypt,
  clean,
  enforceRateLimit,
  signOAuthState,
  verifyOAuthState,
  withApi
} = require("../../utils/platform");
const {
  appendCookie,
  authPublicUser,
  authResponse,
  authenticate,
  clearSessionCookie,
  clientIp,
  createSession,
  deviceInfo,
  ensureIndexes,
  expectedWebAuthn,
  hmacHash,
  objectId,
  parseCookies,
  randomToken,
  recordLoginEvent,
  requireAuth,
  safeEqual,
  sendSecurityEmail,
  setSessionCookie,
  tokenHash,
  webauthnServer
} = require("../../utils/auth-security");

const RESET_OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const EMAIL_OTP_TTL_MS = 15 * 60 * 1000;
const QR_TTL_MS = 3 * 60 * 1000;
const LOCK_AFTER_FAILURES = 5;
const LOCK_TTL_MS = 15 * 60 * 1000;
const ROUTE_ALIASES = Object.freeze({
  "passkey-login-options": "passkey/login/options",
  "passkey-login-verify": "passkey/login/verify",
  "passkey-register-options": "passkey/register/options",
  "passkey-register-verify": "passkey/register/verify",
  "passkey-revoke": "passkeys/revoke",
  "password-recovery-request": "forgot-password/request",
  "password-recovery-verify": "forgot-password/verify",
  "password-recovery-reset": "forgot-password/reset",
  "email-verification-request": "email-verification/request",
  "email-verification-verify": "email-verification/verify",
  "qr-create": "qr/create",
  "qr-approve": "qr/approve",
  "qr-status": "qr/status",
  "session-revoke": "sessions/revoke",
  "session-revoke-all": "sessions/revoke-all"
});
// Session transport is issued by auth-security as: hh_session=...; HttpOnly; Secure; SameSite=None.

function strongPassword(value) {
  return value.length >= 8 && Buffer.byteLength(value, "utf8") <= 72;
}

function validEmail(value) {
  return /^\S+@\S+\.\S+$/.test(value);
}

function appOrigin(req) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${protocol}://${host}`;
}

function allowedFrontendOrigins() {
  const configured = String(process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  return new Set([
    "https://nhhoang13all.xyz",
    "https://www.nhhoang13all.xyz",
    "https://hoangdaika13.github.io",
    process.env.FRONTEND_URL || "",
    ...configured
  ].filter(Boolean));
}

function frontendOrigin(value) {
  const fallback = "https://nhhoang13all.xyz";
  try {
    const origin = new URL(String(value || "")).origin;
    return allowedFrontendOrigins().has(origin) ? origin : fallback;
  } catch { return fallback; }
}

function redirectError(res, frontend, message) {
  return res.redirect(`${frontend}/?authError=${encodeURIComponent(clean(message, 180) || "Đăng nhập thất bại.")}#/home`);
}

function oauthCookie(res, provider, nonce = "") {
  appendCookie(res, `hh_oauth_${provider}=${encodeURIComponent(nonce)}; Max-Age=${nonce ? 600 : 0}; Path=/api/auth/${provider}; HttpOnly; Secure; SameSite=Lax`);
}

function safeState(req, provider, state) {
  const saved = verifyOAuthState(state, provider);
  if (!saved?.nonce) return null;
  const actual = parseCookies(req)[`hh_oauth_${provider}`];
  if (!actual || actual.length !== saved.nonce.length) return null;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(saved.nonce)) ? saved : null;
}

function callbackUrl(req, provider) {
  return process.env[`${provider.toUpperCase()}_CALLBACK_URL`] || `${appOrigin(req)}/api/auth/${provider}/callback`;
}

function publicSession(row, currentHash = "") {
  return {
    id: row.sessionId,
    type: row.type || "password",
    device: row.device || {},
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    expiresAt: row.expiresAt,
    current: Boolean(currentHash && row.tokenHash === currentHash)
  };
}

function sanitizeInterests(value) {
  return (Array.isArray(value) ? value : []).map((item) => clean(item, 60)).filter(Boolean).slice(0, 20);
}

function sanitizeCreativeColor(value) {
  const color = clean(value, 20);
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : "#62D7E7";
}

function resetEmailHtml(code) {
  return `<p>Mã xác minh khôi phục tài khoản HH Platform của bạn là:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Mã hết hạn sau 10 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`;
}

function verificationEmailHtml(code) {
  return `<p>Mã xác minh email HH Platform của bạn là:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Mã hết hạn sau 15 phút.</p>`;
}

async function verifyAdaptiveCaptcha(req, user, body) {
  const suspicious = Number(user?.loginFailures || 0) >= 3;
  const secretKey = String(process.env.TURNSTILE_SECRET_KEY || "");
  if (!suspicious || !secretKey) return { required: false, valid: true };
  const token = clean(body.captchaToken, 4000);
  if (!token) return { required: true, valid: false, missing: true };
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token, remoteip: clientIp(req) })
    });
    const result = await response.json();
    return { required: true, valid: Boolean(response.ok && result.success), missing: false };
  } catch {
    return { required: true, valid: false, unavailable: true };
  }
}

async function issueOtp(db, { type, email, ttlMs, purpose }) {
  await ensureIndexes(db);
  const code = String(crypto.randomInt(100000, 1000000));
  const now = new Date();
  await db.collection("authChallenges").deleteMany({ type, lookup: email, consumedAt: null });
  await db.collection("authChallenges").insertOne({
    type, lookup: email, secretHash: hmacHash(`${email}:${code}`, purpose), attempts: 0,
    createdAt: now, expiresAt: new Date(now.getTime() + ttlMs), consumedAt: null
  });
  return code;
}

async function verifyOtp(db, { type, email, code, purpose }) {
  const challenge = await db.collection("authChallenges").findOne({ type, lookup: email, consumedAt: null, expiresAt: { $gt: new Date() } }, { sort: { createdAt: -1 } });
  if (!challenge || Number(challenge.attempts || 0) >= 5) return null;
  const candidate = hmacHash(`${email}:${clean(code, 12)}`, purpose);
  if (!safeEqual(challenge.secretHash, candidate)) {
    await db.collection("authChallenges").updateOne({ _id: challenge._id }, { $inc: { attempts: 1 } });
    return null;
  }
  await db.collection("authChallenges").updateOne({ _id: challenge._id, consumedAt: null }, { $set: { consumedAt: new Date() } });
  return challenge;
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
    emailVerifiedAt: now, lastLoginAt: now, lastSeenAt: now, updatedAt: now,
    [`oauth.${provider}.id`]: providerId
  };
  if (existing) {
    if (["deleted", "suspended", "locked", "banned"].includes(String(existing.status || "").toLowerCase())) {
      throw new Error("Tài khoản này hiện không được phép đăng nhập.");
    }
    await users.updateOne({ _id: existing._id }, { $set: fields });
    return users.findOne({ _id: existing._id });
  }
  delete fields[`oauth.${provider}.id`];
  const result = await users.insertOne({
    ...fields, status: "active", provider, providerId,
    oauth: { [provider]: { id: providerId } }, tokenVersion: 0,
    consent: false, createdAt: now
  });
  return users.findOne({ _id: result.insertedId });
}

async function oauthCallback(req, res, db, provider, code, state) {
  const saved = safeState(req, provider, state);
  const frontend = frontendOrigin(saved?.returnTo);
  oauthCookie(res, provider);
  if (!saved || !code) return redirectError(res, frontend, "Phiên đăng nhập đã hết hạn. Hãy thử lại.");
  const redirectUri = callbackUrl(req, provider);
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: redirectUri, grant_type: "authorization_code"
      })
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token) throw new Error(tokens.error_description || "Google không chấp nhận yêu cầu đăng nhập.");
    const personResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const person = await personResponse.json();
    if (!personResponse.ok || !person.email_verified) throw new Error("Google chưa xác minh email của tài khoản.");
    const user = await upsertOAuthUser(db, { id: person.sub, email: person.email, name: person.name, avatar: person.picture }, provider);
    const exchangeCode = randomToken(24);
    const now = new Date();
    await db.collection("authChallenges").insertOne({
      type: "oauth-exchange", lookup: hmacHash(exchangeCode, "oauth-exchange"),
      userId: user._id, provider, createdAt: now,
      expiresAt: new Date(now.getTime() + 2 * 60 * 1000), consumedAt: null
    });
    await db.collection("events").insertOne({ type: `auth:${provider}`, userId: user._id, createdAt: new Date() });
    return res.redirect(`${frontend}/?authCode=${encodeURIComponent(exchangeCode)}#/home`);
  } catch (error) { return redirectError(res, frontend, error.message); }
}

async function notifyNewDevice(db, user, req, session) {
  const device = deviceInfo(req);
  const previous = await db.collection("authSessions").findOne({
    userId: user._id,
    sessionId: { $ne: session.sessionId },
    "device.browser": device.browser,
    "device.platform": device.platform
  }, { projection: { _id: 1 } });
  if (previous) return { sent: false, reason: "known-device" };
  const sessionCount = await db.collection("authSessions").countDocuments({ userId: user._id }, { limit: 2 });
  if (sessionCount < 2) return { sent: false, reason: "first-session" };
  const result = await sendSecurityEmail({
    to: user.email,
    subject: "Thiết bị mới đăng nhập HH Platform",
    html: `<p>Tài khoản của bạn vừa đăng nhập từ <strong>${device.label}</strong>.</p><p>IP: ${device.ip}</p><p>Nếu không phải bạn, hãy thu hồi phiên trong Trung tâm bảo mật.</p>`,
    text: `Thiết bị mới đăng nhập HH Platform: ${device.label}, IP ${device.ip}. Nếu không phải bạn, hãy thu hồi phiên trong Trung tâm bảo mật.`
  });
  return { sent: Boolean(result.delivered), reason: result.configured ? "provider-result" : "provider-unavailable" };
}

async function passkeyRegistrationOptions(req, res, db) {
  const auth = await requireAuth(req, res, db);
  if (!auth) return;
  const { generateRegistrationOptions } = webauthnServer();
  const config = expectedWebAuthn(req);
  const credentials = await db.collection("passkeys").find({ userId: auth.user._id }).toArray();
  const options = await generateRegistrationOptions({
    rpName: process.env.PASSKEY_RP_NAME || "HH Platform", rpID: config.rpID,
    userID: Buffer.from(String(auth.user._id)), userName: auth.user.email,
    userDisplayName: auth.user.name || auth.user.email, attestationType: "none",
    excludeCredentials: credentials.map((item) => ({ id: item.credentialId, transports: item.transports || [] })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" }
  });
  const requestId = randomToken(18);
  const now = new Date();
  await db.collection("authChallenges").insertOne({
    type: "passkey-register", lookup: requestId, userId: auth.user._id,
    challenge: options.challenge, createdAt: now, expiresAt: new Date(now.getTime() + 5 * 60 * 1000), consumedAt: null
  });
  return res.status(200).json({ options, requestId });
}

function credentialParts(info) {
  const credential = info?.credential || {};
  const rawId = credential.id || info?.credentialID;
  const id = typeof rawId === "string" ? rawId : Buffer.from(rawId || []).toString("base64url");
  const rawKey = credential.publicKey || info?.credentialPublicKey;
  return { id, publicKey: Buffer.from(rawKey || []), counter: Number(credential.counter ?? info?.counter ?? 0), transports: credential.transports || [] };
}

function storedPublicKeyBytes(value) {
  if (Buffer.isBuffer(value)) return new Uint8Array(value);
  if (value?.value && typeof value.value === "function") return new Uint8Array(value.value(true));
  if (value instanceof Uint8Array) return new Uint8Array(value);
  return new Uint8Array(value || []);
}

async function passkeyRegistrationVerify(req, res, db, body) {
  const auth = await requireAuth(req, res, db);
  if (!auth) return;
  const { verifyRegistrationResponse } = webauthnServer();
  const requestId = clean(body.requestId, 120);
  const challenge = await db.collection("authChallenges").findOne({ type: "passkey-register", lookup: requestId, userId: auth.user._id, consumedAt: null, expiresAt: { $gt: new Date() } });
  if (!challenge) return res.status(400).json({ error: "Yêu cầu Passkey đã hết hạn.", code: "PASSKEY_CHALLENGE_EXPIRED" });
  const config = expectedWebAuthn(req);
  const verification = await verifyRegistrationResponse({
    response: body.response, expectedChallenge: challenge.challenge,
    expectedOrigin: config.expectedOrigin, expectedRPID: config.rpID,
    requireUserVerification: true
  });
  if (!verification.verified || !verification.registrationInfo) return res.status(400).json({ error: "Không thể xác minh Passkey.", code: "PASSKEY_VERIFICATION_FAILED" });
  const credential = credentialParts(verification.registrationInfo);
  if (!credential.id || !credential.publicKey.length) return res.status(400).json({ error: "Dữ liệu Passkey không hợp lệ." });
  await db.collection("passkeys").updateOne(
    { credentialId: credential.id },
    { $set: { userId: auth.user._id, credentialId: credential.id, publicKey: credential.publicKey, counter: credential.counter, transports: credential.transports.length ? credential.transports : (body.response?.response?.transports || []), name: clean(body.name, 80) || "Passkey", lastUsedAt: null, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
  await db.collection("authChallenges").updateOne({ _id: challenge._id }, { $set: { consumedAt: new Date() } });
  return res.status(201).json({ ok: true, credential: { id: credential.id, name: clean(body.name, 80) || "Passkey" } });
}

async function passkeyLoginOptions(req, res, db, body) {
  const { generateAuthenticationOptions } = webauthnServer();
  const email = clean(body.email, 160).toLowerCase();
  await enforceRateLimit(db, `passkey-options:${clientIp(req)}:${email}`, 10, 15 * 60 * 1000);
  const user = validEmail(email) ? await db.collection("users").findOne({ email }) : null;
  const credentials = user ? await db.collection("passkeys").find({ userId: user._id }).toArray() : [];
  const config = expectedWebAuthn(req);
  const options = await generateAuthenticationOptions({
    rpID: config.rpID, userVerification: "preferred",
    allowCredentials: credentials.map((item) => ({ id: item.credentialId, transports: item.transports || [] }))
  });
  const requestId = randomToken(18);
  const now = new Date();
  await db.collection("authChallenges").insertOne({
    type: "passkey-login", lookup: requestId, userId: user?._id || null,
    challenge: options.challenge, createdAt: now, expiresAt: new Date(now.getTime() + 5 * 60 * 1000), consumedAt: null
  });
  return res.status(200).json({ options, requestId });
}

async function passkeyLoginVerify(req, res, db, body) {
  const { verifyAuthenticationResponse } = webauthnServer();
  const requestId = clean(body.requestId, 120);
  const challenge = await db.collection("authChallenges").findOne({ type: "passkey-login", lookup: requestId, consumedAt: null, expiresAt: { $gt: new Date() } });
  if (!challenge?.userId) return res.status(401).json({ error: "Passkey không hợp lệ hoặc đã hết hạn.", code: "PASSKEY_LOGIN_FAILED" });
  const credentialId = clean(body.response?.id, 1000);
  const credential = await db.collection("passkeys").findOne({ userId: challenge.userId, credentialId });
  if (!credential) return res.status(401).json({ error: "Passkey không hợp lệ hoặc đã hết hạn.", code: "PASSKEY_LOGIN_FAILED" });
  const config = expectedWebAuthn(req);
  const verification = await verifyAuthenticationResponse({
    response: body.response, expectedChallenge: challenge.challenge,
    expectedOrigin: config.expectedOrigin, expectedRPID: config.rpID,
    credential: { id: credential.credentialId, publicKey: storedPublicKeyBytes(credential.publicKey), counter: Number(credential.counter || 0), transports: credential.transports || [] },
    requireUserVerification: true
  });
  if (!verification.verified) return res.status(401).json({ error: "Passkey không hợp lệ hoặc đã hết hạn.", code: "PASSKEY_LOGIN_FAILED" });
  const user = await db.collection("users").findOne({ _id: challenge.userId });
  if (!user || ["deleted", "suspended", "locked", "banned"].includes(String(user.status || "").toLowerCase())) return res.status(403).json({ error: "Tài khoản này hiện không được phép đăng nhập." });
  const session = await createSession(db, user, req, { type: "passkey", remember: Boolean(body.remember) });
  setSessionCookie(res, session.token, session.ttlSeconds);
  await Promise.all([
    db.collection("passkeys").updateOne({ _id: credential._id }, { $set: { counter: Number(verification.authenticationInfo?.newCounter ?? credential.counter), lastUsedAt: new Date() } }),
    db.collection("authChallenges").updateOne({ _id: challenge._id }, { $set: { consumedAt: new Date() } }),
    recordLoginEvent(db, user, req, "passkey-login")
  ]);
  return res.status(200).json(authResponse(user, session));
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  return withApi(req, res, async ({ db, body }) => {
    await ensureIndexes(db);
    let action = Array.isArray(req.query.action) ? req.query.action : (typeof req.query.action === "string" ? [req.query.action] : []);
    if (!action.length) action = String(req.url || "").split("?")[0].split("/").filter(Boolean).slice(2);
    if (req.query.oauthCallback === "google") action = [req.query.oauthCallback, "callback"];
    const rawRoute = action.join("/");
    const route = ROUTE_ALIASES[rawRoute] || rawRoute;

    if (route === "providers" && req.method === "GET") return res.status(200).json({
      google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      passkey: (() => { try { webauthnServer(); return true; } catch { return false; } })(),
      email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
      captcha: Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SITE_KEY),
      turnstileSiteKey: process.env.TURNSTILE_SECRET_KEY ? clean(process.env.TURNSTILE_SITE_KEY, 200) : "",
      callbacks: { google: callbackUrl(req, "google") }
    });

    if (route === "exchange" && req.method === "POST") {
      const exchangeCode = clean(body.code, 240);
      await enforceRateLimit(db, `oauth-exchange:${clientIp(req)}`, 12, 15 * 60 * 1000);
      const lookup = hmacHash(exchangeCode, "oauth-exchange");
      const challenge = await db.collection("authChallenges").findOneAndUpdate(
        { type: "oauth-exchange", lookup, consumedAt: null, expiresAt: { $gt: new Date() } },
        { $set: { consumedAt: new Date() } },
        { returnDocument: "before" }
      );
      if (!challenge) return res.status(400).json({ error: "Mã đăng nhập đã hết hạn hoặc đã được sử dụng.", code: "OAUTH_EXCHANGE_INVALID" });
      const user = await db.collection("users").findOne({ _id: challenge.userId });
      if (!user) return res.status(400).json({ error: "Không tìm thấy tài khoản Google đã xác minh." });
      const session = await createSession(db, user, req, { type: challenge.provider || "google", remember: true });
      setSessionCookie(res, session.token, session.ttlSeconds);
      await Promise.all([notifyNewDevice(db, user, req, session), recordLoginEvent(db, user, req, `${challenge.provider || "google"}-login`)]);
      return res.status(200).json(authResponse(user, session));
    }

    if (route === "email-availability" && ["GET", "POST"].includes(req.method)) {
      const email = clean(req.method === "GET" ? req.query.email : body.email, 160).toLowerCase();
      await enforceRateLimit(db, `email-availability:${clientIp(req)}`, 30, 15 * 60 * 1000);
      if (!validEmail(email)) return res.status(400).json({ error: "Email không hợp lệ.", available: false });
      const exists = Boolean(await db.collection("users").findOne({ email }, { projection: { _id: 1 } }));
      return res.status(200).json({ available: !exists });
    }

    if (route === "register" && req.method === "POST") {
      const name = clean(body.name, 160);
      const nickname = clean(body.nickname, 80);
      const email = clean(body.email, 160).toLowerCase();
      const password = String(body.password || "");
      await enforceRateLimit(db, `register:${clientIp(req)}`, 5, 60 * 60 * 1000);
      const productionEmailRequired = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
      if (productionEmailRequired && (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)) {
        return res.status(503).json({
          error: "Đăng ký bằng email đang tạm tắt vì dịch vụ gửi mã xác minh chưa được cấu hình. Hãy tiếp tục bằng Google.",
          code: "EMAIL_PROVIDER_UNAVAILABLE"
        });
      }
      if (!name || !validEmail(email)) return res.status(400).json({ error: "Họ tên hoặc email không hợp lệ." });
      if (!strongPassword(password)) return res.status(400).json({ error: "Mật khẩu cần từ 8 ký tự và không vượt quá giới hạn mã hóa an toàn." });
      if (await db.collection("users").findOne({ email })) return res.status(409).json({ error: "Email này đã được đăng ký." });
      const now = new Date();
      const user = {
        name, nickname, email, avatar: clean(body.avatar, 800), interests: sanitizeInterests(body.interests),
        creativeColor: sanitizeCreativeColor(body.creativeColor), provider: "local",
        passwordHash: await bcrypt.hash(password, 13), tokenVersion: 0,
        consent: Boolean(body.consent), status: "active", createdAt: now, updatedAt: now,
        lastLoginAt: now, lastSeenAt: now, emailVerifiedAt: null, loginFailures: 0, loginLockedUntil: null
      };
      const result = await db.collection("users").insertOne(user);
      user._id = result.insertedId;
      const session = await createSession(db, user, req, { type: "register", remember: Boolean(body.remember) });
      setSessionCookie(res, session.token, session.ttlSeconds);
      const verificationCode = await issueOtp(db, { type: "email-verification", email, ttlMs: EMAIL_OTP_TTL_MS, purpose: "email-otp" });
      const verificationDelivery = await sendSecurityEmail({ to: email, subject: "Xác minh email HH Platform", html: verificationEmailHtml(verificationCode), text: `Mã xác minh email HH Platform: ${verificationCode}. Mã hết hạn sau 15 phút.` });
      await Promise.all([
        db.collection("events").insertOne({ type: "auth:register", userId: user._id, createdAt: now }),
        recordLoginEvent(db, user, req, "register")
      ]);
      const developmentCode = process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production" && !verificationDelivery.delivered ? verificationCode : undefined;
      return res.status(201).json({
        ...authResponse(user, session), verificationRequired: true,
        verificationDelivery: verificationDelivery.delivered ? "sent" : "email-provider-unavailable",
        ...(developmentCode ? { developmentCode } : {})
      });
    }

    if (route === "login" && req.method === "POST") {
      const email = clean(body.email, 160).toLowerCase();
      const password = String(body.password || "");
      await enforceRateLimit(db, `login:${clientIp(req)}:${email}`, 12, 15 * 60 * 1000);
      const user = validEmail(email) ? await db.collection("users").findOne({ email, provider: "local" }) : null;
      const now = new Date();
      const captcha = await verifyAdaptiveCaptcha(req, user, body);
      if (captcha.required && !captcha.valid) {
        return res.status(captcha.unavailable ? 503 : captcha.missing ? 428 : 403).json({
          error: captcha.unavailable ? "Dịch vụ xác minh chống lạm dụng đang gián đoạn." : captcha.missing ? "Cần xác minh bảo mật để tiếp tục đăng nhập." : "Xác minh bảo mật không hợp lệ.",
          code: captcha.unavailable ? "CAPTCHA_UNAVAILABLE" : "CAPTCHA_REQUIRED",
          captchaRequired: true
        });
      }
      if (user?.loginLockedUntil && new Date(user.loginLockedUntil) > now) {
        const retryAfter = Math.max(1, Math.ceil((new Date(user.loginLockedUntil).getTime() - now.getTime()) / 1000));
        res.setHeader("Retry-After", String(retryAfter));
        await recordLoginEvent(db, user, req, "login-blocked", { success: false, reason: "temporary-lock" });
        return res.status(423).json({ error: "Tài khoản tạm khóa do đăng nhập sai nhiều lần. Hãy thử lại sau.", code: "LOGIN_TEMPORARILY_LOCKED", retryAfter });
      }
      const matched = Boolean(user?.passwordHash && await bcrypt.compare(password, user.passwordHash));
      if (!matched) {
        if (user) {
          const failures = Number(user.loginFailures || 0) + 1;
          const lock = failures >= LOCK_AFTER_FAILURES;
          await db.collection("users").updateOne({ _id: user._id }, { $set: { loginFailures: lock ? 0 : failures, loginLockedUntil: lock ? new Date(now.getTime() + LOCK_TTL_MS) : null, updatedAt: now } });
          await recordLoginEvent(db, user, req, "login-failed", { success: false, reason: lock ? "lock-applied" : "invalid-credentials" });
        }
        return res.status(401).json({ error: "Sai email hoặc mật khẩu.", code: "INVALID_CREDENTIALS" });
      }
      if (["deleted", "suspended", "locked", "banned"].includes(String(user.status || "").toLowerCase())) return res.status(403).json({ error: "Tài khoản này hiện không được phép đăng nhập." });
      await db.collection("users").updateOne({ _id: user._id }, { $set: { lastLoginAt: now, lastSeenAt: now, loginFailures: 0, loginLockedUntil: null } });
      const session = await createSession(db, user, req, { type: "password", remember: Boolean(body.remember) });
      setSessionCookie(res, session.token, session.ttlSeconds);
      await notifyNewDevice(db, user, req, session);
      await recordLoginEvent(db, user, req, "login");
      return res.status(200).json(authResponse(user, session));
    }

    if (["forgot-password/request", "otp/request"].includes(route) && req.method === "POST") {
      const email = clean(body.email, 160).toLowerCase();
      await enforceRateLimit(db, `forgot:${clientIp(req)}:${email}`, 5, 60 * 60 * 1000);
      if (!validEmail(email)) return res.status(400).json({ error: "Email không hợp lệ." });
      const user = await db.collection("users").findOne({ email, provider: "local" });
      let delivery = "accepted";
      let developmentCode;
      if (user) {
        const code = await issueOtp(db, { type: "password-reset-otp", email, ttlMs: RESET_OTP_TTL_MS, purpose: "reset-otp" });
        const sent = await sendSecurityEmail({ to: email, subject: "Mã khôi phục HH Platform", html: resetEmailHtml(code), text: `Mã khôi phục HH Platform: ${code}. Mã hết hạn sau 10 phút.` });
        delivery = sent.delivered ? "sent" : "email-provider-unavailable";
        if (process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production" && !sent.delivered) developmentCode = code;
      }
      return res.status(202).json({
        ok: true, delivery,
        message: delivery === "email-provider-unavailable" ? "Yêu cầu đã được ghi nhận nhưng máy chủ chưa cấu hình dịch vụ gửi email." : "Nếu email tồn tại, mã xác minh sẽ được gửi tới hộp thư.",
        ...(developmentCode ? { developmentCode } : {})
      });
    }

    if (["forgot-password/verify", "otp/verify"].includes(route) && req.method === "POST") {
      const email = clean(body.email, 160).toLowerCase();
      await enforceRateLimit(db, `forgot-verify:${clientIp(req)}:${email}`, 10, 15 * 60 * 1000);
      const verified = await verifyOtp(db, { type: "password-reset-otp", email, code: body.code, purpose: "reset-otp" });
      if (!verified) return res.status(400).json({ error: "Mã xác minh không đúng hoặc đã hết hạn.", code: "OTP_INVALID" });
      const resetToken = randomToken(32);
      const now = new Date();
      await db.collection("authChallenges").insertOne({ type: "password-reset-token", lookup: email, secretHash: hmacHash(`${email}:${resetToken}`, "reset-token"), createdAt: now, expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS), consumedAt: null });
      return res.status(200).json({ ok: true, resetToken, expiresIn: Math.floor(RESET_TOKEN_TTL_MS / 1000) });
    }

    if (route === "forgot-password/reset" && req.method === "POST") {
      const email = clean(body.email, 160).toLowerCase();
      const password = String(body.password || "");
      if (!strongPassword(password)) return res.status(400).json({ error: "Mật khẩu mới cần từ 8 ký tự." });
      const resetHash = hmacHash(`${email}:${clean(body.resetToken, 200)}`, "reset-token");
      const challenge = await db.collection("authChallenges").findOne({ type: "password-reset-token", lookup: email, consumedAt: null, expiresAt: { $gt: new Date() } }, { sort: { createdAt: -1 } });
      if (!challenge || !safeEqual(challenge.secretHash, resetHash)) return res.status(400).json({ error: "Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn." });
      const user = await db.collection("users").findOne({ email, provider: "local" });
      if (!user) return res.status(400).json({ error: "Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn." });
      const now = new Date();
      await Promise.all([
        db.collection("users").updateOne({ _id: user._id }, { $set: { passwordHash: await bcrypt.hash(password, 13), loginFailures: 0, loginLockedUntil: null, updatedAt: now }, $inc: { tokenVersion: 1 } }),
        db.collection("authChallenges").updateOne({ _id: challenge._id }, { $set: { consumedAt: now } }),
        db.collection("authSessions").updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: now, revokeReason: "password-reset" } }),
        recordLoginEvent(db, user, req, "password-reset")
      ]);
      clearSessionCookie(res);
      return res.status(200).json({ ok: true });
    }

    if (route === "email-verification/request" && req.method === "POST") {
      const auth = await requireAuth(req, res, db);
      if (!auth) return;
      await enforceRateLimit(db, `verify-email:${auth.user._id}`, 5, 60 * 60 * 1000);
      if (auth.user.emailVerifiedAt) return res.status(200).json({ ok: true, alreadyVerified: true });
      const code = await issueOtp(db, { type: "email-verification", email: auth.user.email, ttlMs: EMAIL_OTP_TTL_MS, purpose: "email-otp" });
      const sent = await sendSecurityEmail({ to: auth.user.email, subject: "Xác minh email HH Platform", html: verificationEmailHtml(code), text: `Mã xác minh email HH Platform: ${code}. Mã hết hạn sau 15 phút.` });
      const developmentCode = process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production" && !sent.delivered ? code : undefined;
      return res.status(202).json({ ok: true, delivery: sent.delivered ? "sent" : "email-provider-unavailable", ...(developmentCode ? { developmentCode } : {}) });
    }

    if (route === "email-verification/verify" && req.method === "POST") {
      const auth = await requireAuth(req, res, db);
      if (!auth) return;
      const verified = await verifyOtp(db, { type: "email-verification", email: auth.user.email, code: body.code, purpose: "email-otp" });
      if (!verified) return res.status(400).json({ error: "Mã xác minh không đúng hoặc đã hết hạn." });
      const now = new Date();
      await db.collection("users").updateOne({ _id: auth.user._id }, { $set: { emailVerifiedAt: now, updatedAt: now } });
      return res.status(200).json({ ok: true, verifiedAt: now });
    }

    if (route === "logout" && req.method === "POST") {
      const auth = await authenticate(req, db);
      if (auth?.session) await db.collection("authSessions").updateOne({ _id: auth.session._id }, { $set: { revokedAt: new Date(), revokeReason: "logout" } });
      else if (auth?.user) await db.collection("users").updateOne({ _id: auth.user._id }, { $inc: { tokenVersion: 1 }, $set: { lastLogoutAt: new Date() } });
      clearSessionCookie(res);
      return res.status(200).json({ ok: true });
    }

    if (route === "me" && req.method === "GET") {
      const auth = await authenticate(req, db);
      if (!auth) return res.status(200).json({ user: null, loginHistory: [] });
      await db.collection("users").updateOne({ _id: auth.user._id }, { $set: { lastSeenAt: new Date() } });
      const loginHistory = await db.collection("loginEvents").find({ userId: auth.user._id }).sort({ createdAt: -1 }).limit(12).project({ userAgent: 0 }).toArray();
      return res.status(200).json({ user: authPublicUser(auth.user), loginHistory, session: auth.session ? publicSession(auth.session, tokenHash(auth.token)) : null });
    }

    if (route === "sessions" && req.method === "GET") {
      const auth = await requireAuth(req, res, db);
      if (!auth) return;
      const rows = await db.collection("authSessions").find({ userId: auth.user._id, revokedAt: null, expiresAt: { $gt: new Date() } }).sort({ lastSeenAt: -1 }).limit(50).toArray();
      return res.status(200).json({ sessions: rows.map((row) => publicSession(row, tokenHash(auth.token))) });
    }

    if (route === "sessions/revoke" && ["POST", "DELETE"].includes(req.method)) {
      const auth = await requireAuth(req, res, db);
      if (!auth) return;
      const sessionId = clean(body.sessionId || req.query.sessionId, 120);
      const result = await db.collection("authSessions").updateOne({ userId: auth.user._id, sessionId, revokedAt: null }, { $set: { revokedAt: new Date(), revokeReason: "user-revoked" } });
      if (!result.matchedCount) return res.status(404).json({ error: "Không tìm thấy phiên đăng nhập." });
      if (auth.session?.sessionId === sessionId) clearSessionCookie(res);
      return res.status(200).json({ ok: true });
    }

    if (["sessions/revoke-all", "logout-all"].includes(route) && req.method === "POST") {
      const auth = await requireAuth(req, res, db);
      if (!auth) return;
      const now = new Date();
      await Promise.all([
        db.collection("authSessions").updateMany({ userId: auth.user._id, revokedAt: null }, { $set: { revokedAt: now, revokeReason: "revoke-all" } }),
        db.collection("users").updateOne({ _id: auth.user._id }, { $inc: { tokenVersion: 1 }, $set: { lastLogoutAt: now } })
      ]);
      clearSessionCookie(res);
      return res.status(200).json({ ok: true });
    }

    if (route === "passkey/register/options" && req.method === "POST") return passkeyRegistrationOptions(req, res, db);
    if (route === "passkey/register/verify" && req.method === "POST") return passkeyRegistrationVerify(req, res, db, body);
    if (route === "passkey/login/options" && req.method === "POST") return passkeyLoginOptions(req, res, db, body);
    if (route === "passkey/login/verify" && req.method === "POST") return passkeyLoginVerify(req, res, db, body);
    if (route === "passkey/options" && req.method === "POST") return body.mode === "register" ? passkeyRegistrationOptions(req, res, db) : passkeyLoginOptions(req, res, db, body);
    if (route === "passkey/register" && req.method === "POST") return body.response ? passkeyRegistrationVerify(req, res, db, body) : passkeyRegistrationOptions(req, res, db);
    if (route === "passkey/verify" && req.method === "POST") return passkeyLoginVerify(req, res, db, body);

    if (route === "passkeys" && req.method === "GET") {
      const auth = await requireAuth(req, res, db);
      if (!auth) return;
      const rows = await db.collection("passkeys").find({ userId: auth.user._id }).sort({ createdAt: -1 }).project({ publicKey: 0 }).toArray();
      return res.status(200).json({ passkeys: rows.map((row) => ({ id: row.credentialId, name: row.name, transports: row.transports || [], createdAt: row.createdAt, lastUsedAt: row.lastUsedAt })) });
    }

    if (route === "passkeys/revoke" && ["POST", "DELETE"].includes(req.method)) {
      const auth = await requireAuth(req, res, db);
      if (!auth) return;
      const credentialId = clean(body.credentialId || req.query.credentialId, 1000);
      const result = await db.collection("passkeys").deleteOne({ userId: auth.user._id, credentialId });
      return res.status(result.deletedCount ? 200 : 404).json(result.deletedCount ? { ok: true } : { error: "Không tìm thấy Passkey." });
    }

    if (route === "qr/create" && req.method === "POST") {
      await enforceRateLimit(db, `qr-create:${clientIp(req)}`, 10, 15 * 60 * 1000);
      const qrId = randomToken(18);
      const code = String(crypto.randomInt(100000, 1000000));
      const now = new Date();
      const expiresAt = new Date(now.getTime() + QR_TTL_MS);
      await db.collection("authChallenges").insertOne({ type: "qr-login", lookup: qrId, secretHash: hmacHash(`${qrId}:${code}`, "qr-login"), status: "pending", createdAt: now, expiresAt, consumedAt: null });
      const returnTo = frontendOrigin(body.returnTo || req.headers.origin);
      const qrPayload = `${returnTo}/?qrLogin=${encodeURIComponent(`${qrId}.${code}`)}`;
      const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 280, margin: 1, color: { dark: "#091119", light: "#f7fbff" } });
      return res.status(201).json({ id: qrId, qrId, code, expiresAt, qrPayload, qrDataUrl });
    }

    if (route === "qr/approve" && req.method === "POST") {
      const auth = await requireAuth(req, res, db);
      if (!auth) return;
      const qrId = clean(body.qrId, 120);
      const expected = hmacHash(`${qrId}:${clean(body.code, 12)}`, "qr-login");
      const challenge = await db.collection("authChallenges").findOne({ type: "qr-login", lookup: qrId, status: "pending", consumedAt: null, expiresAt: { $gt: new Date() } });
      if (!challenge || !safeEqual(challenge.secretHash, expected)) return res.status(400).json({ error: "Mã QR không hợp lệ hoặc đã hết hạn." });
      await db.collection("authChallenges").updateOne({ _id: challenge._id, status: "pending" }, { $set: { status: "approved", approvedBy: auth.user._id, approvedAt: new Date() } });
      await recordLoginEvent(db, auth.user, req, "qr-approved");
      return res.status(200).json({ ok: true });
    }

    if (route === "qr/status" && ["GET", "POST"].includes(req.method)) {
      const qrId = clean(req.method === "GET" ? req.query.qrId : body.qrId, 120);
      const code = clean(req.method === "GET" ? req.query.code : body.code, 12);
      const challenge = await db.collection("authChallenges").findOne({ type: "qr-login", lookup: qrId, consumedAt: null, expiresAt: { $gt: new Date() } });
      if (!challenge || !safeEqual(challenge.secretHash, hmacHash(`${qrId}:${code}`, "qr-login"))) return res.status(410).json({ status: "expired" });
      if (challenge.status !== "approved" || !challenge.approvedBy) return res.status(200).json({ status: "pending", expiresAt: challenge.expiresAt });
      const user = await db.collection("users").findOne({ _id: challenge.approvedBy });
      if (!user) return res.status(410).json({ status: "expired" });
      const session = await createSession(db, user, req, { type: "qr", remember: Boolean(body.remember) });
      const consumed = await db.collection("authChallenges").updateOne({ _id: challenge._id, consumedAt: null }, { $set: { status: "consumed", consumedAt: new Date() } });
      if (!consumed.modifiedCount) return res.status(409).json({ error: "Mã QR đã được sử dụng." });
      setSessionCookie(res, session.token, session.ttlSeconds);
      await recordLoginEvent(db, user, req, "qr-login");
      return res.status(200).json({ status: "approved", ...authResponse(user, session) });
    }

    const provider = action[0];
    if (provider === "google" && action.length === 1 && req.method === "GET") {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const frontend = frontendOrigin(req.query.returnTo);
      if (!clientId || !clientSecret) return redirectError(res, frontend, "Đăng nhập Google chưa được cấu hình trên máy chủ.");
      const redirectUri = callbackUrl(req, provider);
      // OAuth state is bound to an HttpOnly nonce cookie. When a legacy callback URL
      // points at another Vercel alias, start the flow on that same origin so the
      // browser returns the nonce cookie to the callback instead of rejecting every
      // Google sign-in as an expired session.
      try {
        const callbackOrigin = new URL(redirectUri).origin;
        const requestOrigin = appOrigin(req);
        if (callbackOrigin !== requestOrigin) {
          const bootstrap = new URL(`/api/auth/${provider}`, callbackOrigin);
          bootstrap.searchParams.set("returnTo", frontend);
          return res.redirect(bootstrap.toString());
        }
      } catch {
        return redirectError(res, frontend, "Địa chỉ callback Google không hợp lệ.");
      }
      const nonce = crypto.randomBytes(24).toString("base64url");
      const state = signOAuthState(provider, frontend, nonce);
      oauthCookie(res, provider, nonce);
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state, prompt: "select_account" });
      return res.redirect(authUrl.toString());
    }
    if (provider === "google" && action[1] === "callback" && req.method === "GET") return oauthCallback(req, res, db, provider, req.query.code, req.query.state);
    return res.status(405).json({ error: "Phương thức hoặc tuyến API không được hỗ trợ." });
  });
};
