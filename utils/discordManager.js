const crypto = require("node:crypto");
const { clean, currentUser, enforceRateLimit, withApi } = require("./platform");
const { decryptToken, encryptToken, publicConnection } = require("./discordSecurity");

const DISCORD_API = "https://discord.com/api/v10";
const DISCORD_AUTHORIZE = "https://discord.com/oauth2/authorize";
const DEFAULT_CALLBACK = "https://hoang8.com/api/discord/oauth/callback";
const USER_SCOPES = Object.freeze(["identify", "guilds"]);
const BOT_PERMISSIONS = "309237763136"; // View, read history, send, embed, attach, react, create public threads and send in threads.
const MESSAGE_LIMIT = 50;
const ATTACHMENT_LIMIT = 1_500_000;
const ATTACHMENT_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "text/plain"]);
const AUDIT_RETENTION_SECONDS = 90 * 24 * 60 * 60;

function fail(message, statusCode = 400, code = "DISCORD_MANAGER_ERROR") {
  return Object.assign(new Error(message), { statusCode, code });
}

function routeOf(req) {
  const raw = req.query.discordAction ?? req.query.action ?? "status";
  return clean(Array.isArray(raw) ? raw.join("/") : raw, 260).replace(/^\/+|\/+$/g, "") || "status";
}

function configured() {
  return Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && String(process.env.DISCORD_TOKEN_ENCRYPTION_KEY || "").length >= 32);
}

function callbackUrl() {
  const candidate = String(process.env.DISCORD_CALLBACK_URL || DEFAULT_CALLBACK);
  try {
    const url = new URL(candidate);
    const allowed = new Set(["https://hoang8.com", "https://www.hoang8.com", process.env.PUBLIC_SITE_URL, process.env.FRONTEND_URL]
      .filter(Boolean).map((item) => { try { return new URL(item).origin; } catch { return ""; } }).filter(Boolean));
    if (url.protocol === "https:" && allowed.has(url.origin) && url.pathname === "/api/discord/oauth/callback" && !url.search && !url.hash) return url.toString();
  } catch {}
  return DEFAULT_CALLBACK;
}

function frontendOrigin(value) {
  const allowed = new Set(["https://hoang8.com", "https://www.hoang8.com", process.env.PUBLIC_SITE_URL, process.env.FRONTEND_URL]
    .filter(Boolean).map((item) => { try { return new URL(item).origin; } catch { return ""; } }).filter(Boolean));
  try { const origin = new URL(String(value || "https://hoang8.com")).origin; return allowed.has(origin) ? origin : "https://hoang8.com"; }
  catch { return "https://hoang8.com"; }
}

function safeReturnHash(value) {
  const hash = clean(value || "#/discord", 180);
  return /^#\/discord(?:[/?].*)?$/.test(hash) ? hash : "#/discord";
}

function snowflake(value, label = "Discord ID") {
  const id = clean(value, 30);
  if (!/^\d{15,22}$/.test(id)) throw fail(`${label} không hợp lệ.`, 400, "DISCORD_ID_INVALID");
  return id;
}

function iconUrl(guild) {
  return guild?.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128` : "";
}

function publicGuild(guild, botGuildIds = new Set()) {
  const permissions = BigInt(String(guild.permissions || "0"));
  return {
    id: String(guild.id),
    name: clean(guild.name, 120),
    icon: iconUrl(guild),
    owner: Boolean(guild.owner),
    permissions: String(guild.permissions || "0"),
    canManage: Boolean(guild.owner || (permissions & 0x20n) || (permissions & 0x8n)),
    botInstalled: botGuildIds.has(String(guild.id))
  };
}

function publicChannel(channel) {
  return {
    id: String(channel.id || ""),
    guildId: String(channel.guild_id || ""),
    name: clean(channel.name || "Kênh", 120),
    topic: clean(channel.topic, 500),
    type: Number(channel.type),
    position: Number(channel.position || 0),
    parentId: String(channel.parent_id || ""),
    lastMessageId: String(channel.last_message_id || ""),
    nsfw: Boolean(channel.nsfw),
    messageCount: Math.max(0, Number(channel.message_count || 0)),
    memberCount: Math.max(0, Number(channel.member_count || 0)),
    threadMetadata: channel.thread_metadata ? {
      archived: Boolean(channel.thread_metadata.archived),
      locked: Boolean(channel.thread_metadata.locked),
      archiveTimestamp: channel.thread_metadata.archive_timestamp || null,
      autoArchiveDuration: Number(channel.thread_metadata.auto_archive_duration || 0)
    } : null
  };
}

function publicMessage(message, ownBotId = "") {
  return {
    id: String(message.id || ""),
    channelId: String(message.channel_id || ""),
    content: clean(message.content, 4000),
    timestamp: message.timestamp || null,
    editedTimestamp: message.edited_timestamp || null,
    pinned: Boolean(message.pinned),
    canManage: Boolean(ownBotId && String(message.author?.id || "") === String(ownBotId)),
    author: {
      id: String(message.author?.id || ""),
      username: clean(message.author?.global_name || message.author?.username || "Discord", 100),
      handle: clean(message.author?.username, 100),
      bot: Boolean(message.author?.bot),
      avatar: message.author?.avatar ? `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png?size=80` : ""
    },
    replyTo: message.message_reference ? {
      messageId: String(message.message_reference.message_id || ""),
      channelId: String(message.message_reference.channel_id || ""),
      guildId: String(message.message_reference.guild_id || "")
    } : null,
    reactions: Array.isArray(message.reactions) ? message.reactions.slice(0, 20).map((reaction) => ({
      emoji: reaction.emoji?.id ? `${clean(reaction.emoji.name, 80)}:${String(reaction.emoji.id)}` : clean(reaction.emoji?.name, 80),
      label: clean(reaction.emoji?.name, 80),
      count: Math.max(0, Number(reaction.count || 0)),
      me: Boolean(reaction.me)
    })) : [],
    attachments: Array.isArray(message.attachments) ? message.attachments.slice(0, 10).map((item) => ({
      id: String(item.id || ""), filename: clean(item.filename, 180), url: clean(item.url, 1200), contentType: clean(item.content_type, 100), size: Number(item.size || 0)
    })) : []
  };
}

function safeEmoji(value) {
  const emoji = clean(value, 120);
  if (!emoji || (!/^.{1,16}$/u.test(emoji) && !/^[\w-]{1,80}:\d{15,22}$/.test(emoji))) throw fail("Emoji không hợp lệ.", 400, "DISCORD_EMOJI_INVALID");
  return emoji;
}

function safeThreadName(value) {
  const name = clean(value, 100).replace(/[\r\n\t]/g, " ").replace(/\s{2,}/g, " ");
  if (name.length < 2) throw fail("Tên thread cần ít nhất 2 ký tự.", 400, "DISCORD_THREAD_NAME_INVALID");
  return name;
}

function attachmentBuffer(body = {}) {
  const filename = clean(body.filename, 120).replace(/[^\p{L}\p{N}._ -]/gu, "-").replace(/\.{2,}/g, ".") || "hh-upload";
  const contentType = clean(body.contentType, 100).toLowerCase();
  if (!ATTACHMENT_TYPES.has(contentType)) throw fail("Định dạng tệp chưa được hỗ trợ.", 415, "DISCORD_ATTACHMENT_TYPE_REJECTED");
  const encoded = String(body.base64 || "").replace(/^data:[^;]+;base64,/, "");
  if (!encoded || encoded.length > Math.ceil(ATTACHMENT_LIMIT * 4 / 3) + 8) throw fail("Tệp trống hoặc vượt quá 1,5 MB.", 413, "DISCORD_ATTACHMENT_TOO_LARGE");
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw fail("Dữ liệu tệp không phải Base64 hợp lệ.", 400, "DISCORD_ATTACHMENT_INVALID");
  let buffer;
  try { buffer = Buffer.from(encoded, "base64"); } catch { throw fail("Dữ liệu tệp không hợp lệ.", 400, "DISCORD_ATTACHMENT_INVALID"); }
  if (!buffer.length || buffer.length > ATTACHMENT_LIMIT) throw fail("Tệp trống hoặc vượt quá 1,5 MB.", 413, "DISCORD_ATTACHMENT_TOO_LARGE");
  const signatures = {
    "image/png": buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a",
    "image/jpeg": buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    "image/gif": ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii")),
    "image/webp": buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP",
    "application/pdf": buffer.subarray(0, 5).toString("ascii") === "%PDF-",
    "text/plain": !buffer.includes(0)
  };
  if (!signatures[contentType]) throw fail("Nội dung tệp không khớp định dạng đã khai báo.", 415, "DISCORD_ATTACHMENT_SIGNATURE_REJECTED");
  return { filename, contentType, buffer };
}

async function discord(path, token, options = {}) {
  const url = new URL(`${DISCORD_API}${path.startsWith("/") ? path : `/${path}`}`);
  if (url.origin !== new URL(DISCORD_API).origin) throw fail("Discord API URL không được phép.", 400, "DISCORD_SSRF_REJECTED");
  Object.entries(options.query || {}).forEach(([key, value]) => value !== undefined && value !== "" && url.searchParams.set(key, String(value)));
  let response;
  try {
    response = await fetch(url, {
      method: options.method || "GET",
      headers: { Authorization: `${options.bot ? "Bot" : "Bearer"} ${token}`, "Content-Type": "application/json", "User-Agent": "HH-Discord-Center (https://hoang8.com, 1.0)" },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(20000)
    });
  } catch { throw fail("Không thể kết nối Discord API.", 502, "DISCORD_API_UNREACHABLE"); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = fail(clean(data.message || `Discord API HTTP ${response.status}`, 260), response.status === 401 ? 401 : response.status === 403 ? 403 : response.status === 404 ? 404 : response.status === 429 ? 429 : response.status >= 500 ? 502 : 400, clean(data.code || "DISCORD_API_ERROR", 80));
    const retryAfter = Number(data.retry_after || response.headers.get("retry-after") || 0);
    if (response.status === 429 && retryAfter > 0) error.retryAfter = Math.ceil(retryAfter);
    throw error;
  }
  return data;
}

async function discordMultipart(path, token, payload, file) {
  const url = new URL(`${DISCORD_API}${path.startsWith("/") ? path : `/${path}`}`);
  if (url.origin !== new URL(DISCORD_API).origin) throw fail("Discord API URL không được phép.", 400, "DISCORD_SSRF_REJECTED");
  const form = new FormData();
  form.append("payload_json", JSON.stringify(payload));
  form.append("files[0]", new Blob([file.buffer], { type: file.contentType }), file.filename);
  let response;
  try {
    response = await fetch(url, { method: "POST", headers: { Authorization: `Bot ${token}`, "User-Agent": "HH-Discord-Center (https://hoang8.com, 2.0)" }, body: form, signal: AbortSignal.timeout(30000) });
  } catch { throw fail("Không thể tải tệp lên Discord.", 502, "DISCORD_UPLOAD_UNREACHABLE"); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw fail(clean(data.message || `Discord API HTTP ${response.status}`, 260), response.status === 403 ? 403 : response.status === 429 ? 429 : response.status >= 500 ? 502 : 400, clean(data.code || "DISCORD_UPLOAD_ERROR", 80));
  return data;
}

async function tokenRequest(params) {
  let response;
  try {
    response = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-store" },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(20000)
    });
  } catch { throw fail("Không thể kết nối máy chủ OAuth Discord.", 502, "DISCORD_OAUTH_UNREACHABLE"); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw fail(clean(data.error_description || data.error || "Discord không cấp token.", 260), 401, "DISCORD_TOKEN_EXCHANGE_FAILED");
  return data;
}

async function revokeToken(token) {
  if (!token) return;
  try {
    await fetch(`${DISCORD_API}/oauth2/token/revoke`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token, client_id: process.env.DISCORD_CLIENT_ID || "", client_secret: process.env.DISCORD_CLIENT_SECRET || "" }), signal: AbortSignal.timeout(12000) });
  } catch {}
}

async function ownedConnection(db, userId) {
  const connection = await db.collection("discordConnections").findOne({ userId, active: true });
  if (!connection) throw fail("Tài khoản Discord chưa được kết nối.", 404, "DISCORD_CONNECTION_NOT_FOUND");
  return connection;
}

async function accessToken(db, connection) {
  if (new Date(connection.accessTokenExpiresAt || 0).getTime() > Date.now() + 120000) return decryptToken(connection.encryptedAccessToken, connection);
  const refresh = decryptToken(connection.encryptedRefreshToken, connection);
  const tokens = await tokenRequest({ client_id: process.env.DISCORD_CLIENT_ID || "", client_secret: process.env.DISCORD_CLIENT_SECRET || "", grant_type: "refresh_token", refresh_token: refresh });
  const next = {
    encryptedAccessToken: encryptToken(tokens.access_token, connection),
    encryptedRefreshToken: encryptToken(tokens.refresh_token || refresh, connection),
    accessTokenExpiresAt: new Date(Date.now() + Number(tokens.expires_in || 604800) * 1000),
    scopes: clean(tokens.scope, 500).split(/\s+/).filter(Boolean), updatedAt: new Date()
  };
  await db.collection("discordConnections").updateOne({ _id: connection._id, userId: connection.userId }, { $set: next });
  Object.assign(connection, next);
  return tokens.access_token;
}

async function linkedGuilds(db, connection) {
  const token = await accessToken(db, connection);
  return discord("/users/@me/guilds", token);
}

async function botGuildIds() {
  if (!process.env.DISCORD_BOT_TOKEN) return new Set();
  const guilds = await discord("/users/@me/guilds", process.env.DISCORD_BOT_TOKEN, { bot: true });
  return new Set((Array.isArray(guilds) ? guilds : []).map((item) => String(item.id)));
}

async function requireSharedGuild(db, connection, guildId) {
  const id = snowflake(guildId, "Server ID");
  const [userGuilds, bots] = await Promise.all([linkedGuilds(db, connection), botGuildIds()]);
  if (!(Array.isArray(userGuilds) && userGuilds.some((item) => String(item.id) === id))) throw fail("Server này không thuộc tài khoản Discord đã liên kết.", 403, "DISCORD_GUILD_NOT_OWNED");
  if (!bots.has(id)) throw fail("Bot HH chưa được mời vào server này.", 409, "DISCORD_BOT_NOT_INSTALLED");
  return id;
}

async function requireChannel(db, connection, guildId, channelId) {
  const safeGuildId = await requireSharedGuild(db, connection, guildId);
  const safeChannelId = snowflake(channelId, "Channel ID");
  const channel = await discord(`/channels/${safeChannelId}`, process.env.DISCORD_BOT_TOKEN, { bot: true });
  if (String(channel.guild_id || "") !== safeGuildId || ![0, 5, 10, 11, 12].includes(Number(channel.type))) throw fail("Kênh không thuộc server đã chọn hoặc không hỗ trợ tin nhắn.", 403, "DISCORD_CHANNEL_REJECTED");
  return { guildId: safeGuildId, channelId: safeChannelId, channel };
}

async function requireBotMessage(db, connection, guildId, channelId, messageId) {
  const target = await requireChannel(db, connection, guildId, channelId);
  const safeMessageId = snowflake(messageId, "Message ID");
  const [message, bot] = await Promise.all([
    discord(`/channels/${target.channelId}/messages/${safeMessageId}`, process.env.DISCORD_BOT_TOKEN, { bot: true }),
    discord("/users/@me", process.env.DISCORD_BOT_TOKEN, { bot: true })
  ]);
  if (String(message.author?.id || "") !== String(bot.id || "")) throw fail("Chỉ có thể sửa hoặc xóa tin do HH Discord Bot gửi.", 403, "DISCORD_MESSAGE_NOT_OWNED");
  return { ...target, messageId: safeMessageId, message };
}

async function audit(db, userId, action, detail = {}) {
  const now = new Date();
  await db.collection("discordAuditEvents").insertOne({ userId, action: clean(action, 80), target: clean(detail.target, 120), result: clean(detail.result || "ok", 30), createdAt: now, expiresAt: new Date(now.getTime() + AUDIT_RETENTION_SECONDS * 1000) });
}

module.exports = async function discordManager(req, res) {
  const requestRoute = routeOf(req);
  return withApi(req, res, async ({ db, body }) => {
    const route = requestRoute;
    const states = db.collection("discordOauthStates");
    const connections = db.collection("discordConnections");
    await Promise.all([
      states.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      states.createIndex({ stateHash: 1 }, { unique: true }),
      connections.createIndex({ userId: 1 }, { unique: true }),
      db.collection("discordAuditEvents").createIndex({ userId: 1, createdAt: -1 }),
      db.collection("discordAuditEvents").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    ]);

    if (route === "oauth/callback" && req.method === "GET") {
      const rawState = clean(req.query.state, 180);
      const stateHash = crypto.createHash("sha256").update(rawState).digest("hex");
      const consumed = rawState ? await states.findOneAndDelete({ stateHash, expiresAt: { $gt: new Date() } }) : null;
      const state = consumed?.value || consumed;
      const origin = frontendOrigin(state?.frontendOrigin);
      const returnHash = safeReturnHash(state?.returnHash);
      if (!state || req.query.error) return res.redirect(302, `${origin}/?discord=${encodeURIComponent(req.query.error || "invalid_state")}${returnHash}`);
      const tokens = await tokenRequest({ client_id: process.env.DISCORD_CLIENT_ID || "", client_secret: process.env.DISCORD_CLIENT_SECRET || "", grant_type: "authorization_code", code: clean(req.query.code, 500), redirect_uri: callbackUrl() });
      const profile = await discord("/users/@me", tokens.access_token);
      const recordContext = { userId: state.userId, discordUserId: String(profile.id) };
      const now = new Date();
      await connections.updateOne({ userId: state.userId }, { $set: {
        ...recordContext, username: clean(profile.username, 100), globalName: clean(profile.global_name, 100), avatarHash: clean(profile.avatar, 200),
        encryptedAccessToken: encryptToken(tokens.access_token, recordContext), encryptedRefreshToken: encryptToken(tokens.refresh_token, recordContext),
        accessTokenExpiresAt: new Date(now.getTime() + Number(tokens.expires_in || 604800) * 1000), scopes: clean(tokens.scope, 500).split(/\s+/).filter(Boolean),
        active: true, connectedAt: now, updatedAt: now
      } }, { upsert: true });
      await audit(db, state.userId, "oauth.connected", { target: String(profile.id) });
      return res.redirect(302, `${origin}/?discord=connected${returnHash}`);
    }

    const user = await currentUser(req);
    if (!user) throw fail("Hãy đăng nhập tài khoản HH trước khi kết nối Discord.", 401, "AUTH_REQUIRED");
    const userId = user._id;

    if (route === "status" && req.method === "GET") {
      const connection = await connections.findOne({ userId, active: true });
      return res.status(200).json({ ok: true, configured: configured(), botConfigured: Boolean(process.env.DISCORD_BOT_TOKEN), realtimeConfigured: false, connection: publicConnection(connection), capabilities: {
        identity: configured(), guilds: configured(), channels: Boolean(process.env.DISCORD_BOT_TOKEN), messages: Boolean(process.env.DISCORD_BOT_TOKEN), messageContentIntent: String(process.env.DISCORD_MESSAGE_CONTENT_ENABLED || "").toLowerCase() === "true", sendAsBot: Boolean(process.env.DISCORD_BOT_TOKEN), attachments: Boolean(process.env.DISCORD_BOT_TOKEN), reactions: Boolean(process.env.DISCORD_BOT_TOKEN), threads: Boolean(process.env.DISCORD_BOT_TOKEN), editOwnMessages: Boolean(process.env.DISCORD_BOT_TOKEN), adaptiveSync: true, voice: false, gatewayRealtime: false
      } });
    }

    if (route === "oauth/start" && req.method === "POST") {
      if (!configured()) throw fail("Discord OAuth chưa được cấu hình trên máy chủ.", 503, "DISCORD_NOT_CONFIGURED");
      await enforceRateLimit(db, `discord:oauth:${userId}`, 8, 15 * 60 * 1000);
      const state = crypto.randomBytes(32).toString("base64url");
      await states.insertOne({ stateHash: crypto.createHash("sha256").update(state).digest("hex"), userId, frontendOrigin: frontendOrigin(body.frontendOrigin || req.headers.origin), returnHash: safeReturnHash(body.returnHash), createdAt: new Date(), expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
      const url = new URL(DISCORD_AUTHORIZE);
      url.searchParams.set("client_id", process.env.DISCORD_CLIENT_ID);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", callbackUrl());
      url.searchParams.set("scope", USER_SCOPES.join(" "));
      url.searchParams.set("state", state);
      url.searchParams.set("prompt", "consent");
      return res.status(200).json({ ok: true, authorizationUrl: url.toString() });
    }

    if (route === "disconnect" && req.method === "DELETE") {
      await enforceRateLimit(db, `discord:disconnect:${userId}`, 5, 15 * 60 * 1000);
      const connection = await ownedConnection(db, userId);
      let token = "";
      try { token = decryptToken(connection.encryptedAccessToken, connection); } catch {}
      await connections.updateOne({ _id: connection._id, userId }, { $set: { active: false, encryptedAccessToken: "", encryptedRefreshToken: "", disconnectedAt: new Date(), updatedAt: new Date() } });
      await audit(db, userId, "connection.disconnected", { target: connection.discordUserId });
      await revokeToken(token);
      return res.status(200).json({ ok: true });
    }

    const connection = await ownedConnection(db, userId);
    if (route === "profile" && req.method === "GET") return res.status(200).json({ ok: true, connection: publicConnection(connection) });

    if (route === "guilds" && req.method === "GET") {
      await enforceRateLimit(db, `discord:guilds:${userId}`, 60, 60 * 1000);
      const [guilds, bots] = await Promise.all([linkedGuilds(db, connection), botGuildIds()]);
      return res.status(200).json({ ok: true, guilds: (Array.isArray(guilds) ? guilds : []).map((item) => publicGuild(item, bots)).sort((a, b) => Number(b.botInstalled) - Number(a.botInstalled) || a.name.localeCompare(b.name, "vi")) });
    }

    const channelMatch = route.match(/^guilds\/(\d{15,22})\/channels$/);
    if (channelMatch && req.method === "GET") {
      await enforceRateLimit(db, `discord:channels:${userId}:${channelMatch[1]}`, 60, 60 * 1000);
      const guildId = await requireSharedGuild(db, connection, channelMatch[1]);
      const channels = await discord(`/guilds/${guildId}/channels`, process.env.DISCORD_BOT_TOKEN, { bot: true });
      return res.status(200).json({ ok: true, channels: (Array.isArray(channels) ? channels : []).map(publicChannel).filter((item) => [0, 5, 10, 11, 12].includes(item.type)).sort((a, b) => a.position - b.position) });
    }

    const threadsMatch = route.match(/^guilds\/(\d{15,22})\/threads$/);
    if (threadsMatch && req.method === "GET") {
      await enforceRateLimit(db, `discord:threads:${userId}:${threadsMatch[1]}`, 60, 60 * 1000);
      const guildId = await requireSharedGuild(db, connection, threadsMatch[1]);
      const result = await discord(`/guilds/${guildId}/threads/active`, process.env.DISCORD_BOT_TOKEN, { bot: true });
      return res.status(200).json({ ok: true, threads: (Array.isArray(result.threads) ? result.threads : []).map(publicChannel).sort((a, b) => a.name.localeCompare(b.name, "vi")) });
    }

    const messagesMatch = route.match(/^channels\/(\d{15,22})\/messages$/);
    if (messagesMatch && req.method === "GET") {
      const guildId = snowflake(req.query.guildId, "Server ID");
      await enforceRateLimit(db, `discord:messages:${userId}:${messagesMatch[1]}`, 90, 60 * 1000);
      const target = await requireChannel(db, connection, guildId, messagesMatch[1]);
      const limit = Math.max(1, Math.min(MESSAGE_LIMIT, Number(req.query.limit || 35)));
      const [messages, bot] = await Promise.all([
        discord(`/channels/${target.channelId}/messages`, process.env.DISCORD_BOT_TOKEN, { bot: true, query: { limit, before: clean(req.query.before, 30), after: clean(req.query.after, 30) } }),
        discord("/users/@me", process.env.DISCORD_BOT_TOKEN, { bot: true })
      ]);
      const mapped = (Array.isArray(messages) ? messages : []).map((item) => publicMessage(item, bot.id)).reverse();
      return res.status(200).json({ ok: true, channel: publicChannel(target.channel), messages: mapped, hasMore: mapped.length === limit });
    }

    const sendMatch = route.match(/^channels\/(\d{15,22})\/messages\/send$/);
    if (sendMatch && req.method === "POST") {
      await enforceRateLimit(db, `discord:send:${userId}:${sendMatch[1]}`, 12, 60 * 1000);
      const content = clean(body.content, 2000);
      if (!content) throw fail("Tin nhắn không được để trống.", 400, "DISCORD_MESSAGE_EMPTY");
      const target = await requireChannel(db, connection, body.guildId, sendMatch[1]);
      const replyTo = body.replyTo ? snowflake(body.replyTo, "Reply message ID") : "";
      const payload = { content, allowed_mentions: { parse: [], replied_user: false } };
      if (replyTo) payload.message_reference = { message_id: replyTo, channel_id: target.channelId, guild_id: target.guildId, fail_if_not_exists: false };
      const message = await discord(`/channels/${target.channelId}/messages`, process.env.DISCORD_BOT_TOKEN, { bot: true, method: "POST", body: payload });
      await audit(db, userId, "message.sent_as_bot", { target: target.channelId });
      return res.status(201).json({ ok: true, message: publicMessage(message, message.author?.id), sentAs: "HH Discord Bot" });
    }

    const uploadMatch = route.match(/^channels\/(\d{15,22})\/messages\/upload$/);
    if (uploadMatch && req.method === "POST") {
      await enforceRateLimit(db, `discord:upload:${userId}:${uploadMatch[1]}`, 6, 10 * 60 * 1000);
      const target = await requireChannel(db, connection, body.guildId, uploadMatch[1]);
      const file = attachmentBuffer(body);
      const content = clean(body.content, 1800);
      const replyTo = body.replyTo ? snowflake(body.replyTo, "Reply message ID") : "";
      const payload = { content, allowed_mentions: { parse: [], replied_user: false }, attachments: [{ id: 0, filename: file.filename }] };
      if (replyTo) payload.message_reference = { message_id: replyTo, channel_id: target.channelId, guild_id: target.guildId, fail_if_not_exists: false };
      const message = await discordMultipart(`/channels/${target.channelId}/messages`, process.env.DISCORD_BOT_TOKEN, payload, file);
      await audit(db, userId, "message.attachment_sent", { target: target.channelId });
      return res.status(201).json({ ok: true, message: publicMessage(message, message.author?.id), sentAs: "HH Discord Bot" });
    }

    const mutateMessageMatch = route.match(/^channels\/(\d{15,22})\/messages\/(\d{15,22})$/);
    if (mutateMessageMatch && req.method === "PATCH") {
      await enforceRateLimit(db, `discord:edit:${userId}:${mutateMessageMatch[1]}`, 20, 10 * 60 * 1000);
      const content = clean(body.content, 2000);
      if (!content) throw fail("Tin nhắn không được để trống.", 400, "DISCORD_MESSAGE_EMPTY");
      const target = await requireBotMessage(db, connection, body.guildId, mutateMessageMatch[1], mutateMessageMatch[2]);
      const message = await discord(`/channels/${target.channelId}/messages/${target.messageId}`, process.env.DISCORD_BOT_TOKEN, { bot: true, method: "PATCH", body: { content, allowed_mentions: { parse: [] } } });
      await audit(db, userId, "message.edited_as_bot", { target: target.messageId });
      return res.status(200).json({ ok: true, message: publicMessage(message, message.author?.id) });
    }
    if (mutateMessageMatch && req.method === "DELETE") {
      await enforceRateLimit(db, `discord:delete:${userId}:${mutateMessageMatch[1]}`, 12, 10 * 60 * 1000);
      const target = await requireBotMessage(db, connection, body.guildId, mutateMessageMatch[1], mutateMessageMatch[2]);
      await discord(`/channels/${target.channelId}/messages/${target.messageId}`, process.env.DISCORD_BOT_TOKEN, { bot: true, method: "DELETE" });
      await audit(db, userId, "message.deleted_as_bot", { target: target.messageId });
      return res.status(200).json({ ok: true, messageId: target.messageId });
    }

    const reactionMatch = route.match(/^channels\/(\d{15,22})\/messages\/(\d{15,22})\/reactions$/);
    if (reactionMatch && req.method === "POST") {
      await enforceRateLimit(db, `discord:reaction:${userId}:${reactionMatch[1]}`, 40, 10 * 60 * 1000);
      const target = await requireChannel(db, connection, body.guildId, reactionMatch[1]);
      const messageId = snowflake(reactionMatch[2], "Message ID");
      const emoji = safeEmoji(body.emoji);
      const method = body.remove === true ? "DELETE" : "PUT";
      await discord(`/channels/${target.channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, process.env.DISCORD_BOT_TOKEN, { bot: true, method });
      await audit(db, userId, body.remove === true ? "reaction.removed" : "reaction.added", { target: messageId });
      return res.status(200).json({ ok: true, messageId, emoji, active: body.remove !== true });
    }

    const createThreadMatch = route.match(/^channels\/(\d{15,22})\/threads$/);
    if (createThreadMatch && req.method === "POST") {
      await enforceRateLimit(db, `discord:thread:${userId}:${createThreadMatch[1]}`, 8, 60 * 60 * 1000);
      const target = await requireChannel(db, connection, body.guildId, createThreadMatch[1]);
      if (Number(target.channel.type) !== 0) throw fail("Chỉ có thể tạo thread từ kênh văn bản thường.", 409, "DISCORD_THREAD_PARENT_UNSUPPORTED");
      const thread = await discord(`/channels/${target.channelId}/threads`, process.env.DISCORD_BOT_TOKEN, { bot: true, method: "POST", body: { name: safeThreadName(body.name), type: 11, auto_archive_duration: [60, 1440, 4320, 10080].includes(Number(body.autoArchiveDuration)) ? Number(body.autoArchiveDuration) : 1440, invitable: false } });
      await audit(db, userId, "thread.created", { target: String(thread.id || "") });
      return res.status(201).json({ ok: true, thread: publicChannel(thread) });
    }

    if (route === "audit" && req.method === "GET") {
      await enforceRateLimit(db, `discord:audit:${userId}`, 30, 60 * 1000);
      const events = await db.collection("discordAuditEvents").find({ userId }, { projection: { userId: 0, expiresAt: 0 } }).sort({ createdAt: -1 }).limit(80).toArray();
      return res.status(200).json({ ok: true, events: events.map((item) => ({ id: String(item._id), action: clean(item.action, 80), target: clean(item.target, 120), result: clean(item.result, 30), createdAt: item.createdAt || null })), retentionDays: 90 });
    }

    if (route === "bot/invite" && req.method === "GET") {
      if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_BOT_TOKEN) throw fail("Bot Discord chưa được cấu hình.", 503, "DISCORD_BOT_NOT_CONFIGURED");
      const url = new URL(DISCORD_AUTHORIZE);
      url.searchParams.set("client_id", process.env.DISCORD_CLIENT_ID);
      url.searchParams.set("scope", "bot applications.commands");
      url.searchParams.set("permissions", BOT_PERMISSIONS);
      url.searchParams.set("disable_guild_select", "false");
      return res.status(200).json({ ok: true, invitationUrl: url.toString(), permissions: ["Xem kênh", "Đọc lịch sử", "Gửi tin nhắn", "Nhúng liên kết", "Đính kèm tệp", "Thêm reaction", "Tạo thread công khai", "Gửi trong thread"] });
    }

    throw fail("Discord endpoint không tồn tại.", 404, "DISCORD_ROUTE_NOT_FOUND");
  }, { maxBodyBytes: requestRoute.endsWith("/messages/upload") ? 2_100_000 : 64 * 1024, maxDepth: 12, maxNodes: 500, maxArrayLength: 100 });
};

module.exports.__test = Object.freeze({ ATTACHMENT_LIMIT, BOT_PERMISSIONS, attachmentBuffer, safeEmoji, safeThreadName });
