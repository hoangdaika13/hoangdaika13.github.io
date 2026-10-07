"use strict";
const { randomBytes, randomUUID, createHash } = require("node:crypto");
const { AccessToken, RoomServiceClient, TrackSource } = require("livekit-server-sdk");
const { withApi, currentUser, enforceRateLimit, setCors } = require("./platform");
const clean = (v, max = 120) => typeof v === "string" ? v.trim().slice(0, max) : "";
const fail = (message, statusCode = 400, code = "STUDY_INVALID") => { throw Object.assign(new Error(message), { statusCode, code }); };
const hash = v => createHash("sha256").update(v).digest("hex");
const identity = user => "u_" + String(user._id);
const safeSettings = (input = {}, previous = {}) => {
  input = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  previous = previous && typeof previous === "object" ? previous : {};
  return Object.fromEntries(["waitingRoom", "allowScreenShare", "allowMicrophone", "chatEnabled"].map(k => [k, typeof input[k] === "boolean" ? input[k] : previous[k] ?? (k !== "waitingRoom")]));
};
const init = new WeakMap();
function configuration(env = process.env) {
  try {
    const url = new URL(env.LIVEKIT_URL || "");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (!["wss:", "https:"].includes(url.protocol) && !(env.NODE_ENV !== "production" && local && ["ws:", "http:"].includes(url.protocol))) return null;
    if (url.username || url.password || url.search || url.hash || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) return null;
    return { wsUrl: url.href.replace(/^http/, "ws").replace(/\/$/, ""), httpUrl: url.href.replace(/^ws/, "http").replace(/\/$/, ""), key: env.LIVEKIT_API_KEY, secret: env.LIVEKIT_API_SECRET };
  } catch { return null; }
}
async function indexes(db) {
  if (!init.has(db)) init.set(db, Promise.all([
    db.collection("studyTogetherRooms").createIndex({ codeHash: 1 }, { unique: true }),
    db.collection("studyTogetherRooms").createIndex({ ownerId: 1, createdAt: -1 }),
    db.collection("studyTogetherRooms").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("studyTogetherMembers").createIndex({ roomId: 1, state: 1 }),
    db.collection("studyTogetherMembers").createIndex({ userId: 1, updatedAt: -1 }),
    db.collection("studyTogetherMembers").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  ]).catch(e => { init.delete(db); throw e; }));
  await init.get(db);
}
function publicRoom(room, user) {
  return { id: room._id, title: room.title, capacity: room.capacity, settings: room.settings, timer: room.timer || null, host: room.ownerId === String(user._id), hostIdentity: "u_" + room.ownerId, expiresAt: room.expiresAt, status: room.status };
}
function permissions(room, isHost = false) {
  const s = room.settings;
  return { canPublish: true, canSubscribe: true, canPublishData: true, canUpdateOwnMetadata: false, canPublishSources: [TrackSource.CAMERA, ...(isHost || s.allowMicrophone ? [TrackSource.MICROPHONE] : []), ...(isHost || s.allowScreenShare ? [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO] : [])] };
}
const metadata = room => JSON.stringify({ kind: "hh-study-together", hostIdentity: "u_" + room.ownerId, settings: room.settings, timer: room.timer || null });
async function remote(work) {
  try { return await work(); } catch { fail("Không kết nối được LiveKit. Kiểm tra máy chủ và thử lại.", 503, "LIVEKIT_UNAVAILABLE"); }
}
async function ensureRoom(client, room) {
  return remote(() => client.createRoom({ name: room._id, maxParticipants: room.capacity, emptyTimeout: 600, departureTimeout: 120, metadata: metadata(room) }));
}
async function joinToken(config, room, user) {
  const token = new AccessToken(config.key, config.secret, { identity: identity(user), name: clean(user.name || "Người học", 80), ttl: 90, metadata: JSON.stringify({ role: room.ownerId === String(user._id) ? "host" : "learner" }) });
  token.addGrant({ room: room._id, roomJoin: true, ...permissions(room, room.ownerId === String(user._id)) });
  return token.toJwt();
}
async function handle(req, res, { db, body = {}, user, config, client, rateLimit = enforceRateLimit }) {
  if (!user?._id) fail("Đăng nhập để tạo hoặc tham gia phòng học.", 401, "AUTH_REQUIRED");
  if ((user.restrictedFeatures || []).some(id => ["learn", "study-together"].includes(id))) fail("Tài khoản chưa được phép dùng phòng học chung.", 403);
  if (!config) fail("Chưa cấu hình LiveKit.", 503, "LIVEKIT_NOT_CONFIGURED");
  await indexes(db);
  const rooms = db.collection("studyTogetherRooms"), members = db.collection("studyTogetherMembers"), uid = String(user._id);
  const action = req.method === "GET" ? clean(req.query.action) : clean(body.action);
  if (req.method !== "GET" && req.method !== "POST") fail("Phương thức không được hỗ trợ.", 405);
  await rateLimit(db, "study:" + uid + ":" + (req.method === "GET" ? "read" : action), req.method === "GET" ? 120 : 25, 60000);
  if (action === "rooms" && req.method === "GET") {
    const owned = await rooms.find({ ownerId: uid, status: "active", expiresAt: { $gt: new Date() } }, { maxTimeMS: 5000 }).sort({ createdAt: -1 }).limit(20).toArray();
    return res.status(200).json({ ok: true, rooms: owned.map(r => publicRoom(r, user)) });
  }
  if (action === "create" && req.method === "POST") {
    const title = clean(body.title, 100);
    if (!title) fail("Nhập tên phòng học.");
    if (await rooms.countDocuments({ ownerId: uid, status: "active", expiresAt: { $gt: new Date() } }) >= 5) fail("Bạn đang có 5 phòng. Kết thúc phòng cũ trước khi tạo thêm.", 409);
    const code = randomBytes(8).toString("hex").toUpperCase(), now = new Date();
    const room = { _id: "hh-study-" + randomUUID(), codeHash: hash(code), ownerId: uid, title, capacity: Math.max(2, Math.min(32, Math.floor(Number(body.capacity) || 12))), settings: safeSettings(body.settings), status: "active", createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + 86400000) };
    await ensureRoom(client, room);
    try { await rooms.insertOne(room); } catch (e) { await client.deleteRoom(room._id).catch(() => {}); throw e; }
    await members.updateOne({ _id: room._id + ":" + uid }, { $set: { roomId: room._id, userId: uid, name: clean(user.name, 80), state: "admitted", updatedAt: now, expiresAt: room.expiresAt } }, { upsert: true });
    return res.status(201).json({ ok: true, code, room: publicRoom(room, user), token: await joinToken(config, room, user), wsUrl: config.wsUrl });
  }
  const roomId = clean(req.method === "GET" ? req.query.roomId : body.roomId, 100);
  const code = clean(body.code, 32).replace(/[\s-]/g, "").toUpperCase();
  const room = await rooms.findOne(action === "join" && code ? { codeHash: hash(code) } : { _id: roomId });
  if (!room || (room.status !== "active" && !(action === "close" && room.ownerId === uid && room.status === "closed")) || new Date(room.expiresAt) <= new Date()) fail("Phòng không tồn tại, đã hết hạn hoặc đã kết thúc.", 404, "ROOM_NOT_FOUND");
  const isHost = room.ownerId === uid, memberKey = room._id + ":" + uid;
  let member = await members.findOne({ _id: memberKey });
  if (action === "join" && req.method === "POST") {
    // A room ID is not an invitation. Returning hosts/admitted members may rejoin by ID.
    if (!code && !isHost && member?.state !== "admitted") fail("Nhập mã mời hợp lệ để tham gia.", 403);
    if (member?.state === "blocked") fail("Bạn không còn được phép tham gia phòng này.", 403, "ROOM_BLOCKED");
    const state = isHost || !room.settings.waitingRoom || member?.state === "admitted" ? "admitted" : "waiting";
    try { await members.updateOne({ _id: memberKey, state: { $ne: "blocked" } }, { $set: { roomId: room._id, userId: uid, name: clean(user.name || "Người học", 80), state, updatedAt: new Date(), expiresAt: room.expiresAt } }, { upsert: true }); }
    catch (e) { if (e.code === 11000) fail("Bạn không còn được phép tham gia phòng này.", 403, "ROOM_BLOCKED"); throw e; }
    if (state === "waiting") return res.status(200).json({ ok: true, waiting: true, room: publicRoom(room, user) });
    await ensureRoom(client, room);
    // Remote setup can yield; re-check closure, blocking and current publish policy before minting.
    const latest = await rooms.findOne({ _id: room._id, status: "active", expiresAt: { $gt: new Date() } });
    member = await members.findOne({ _id: memberKey, state: "admitted" });
    if (!latest || !member) fail("Quyền tham gia đã thay đổi. Kiểm tra lại phòng.", 403, "ROOM_ACCESS_CHANGED");
    return res.status(200).json({ ok: true, room: publicRoom(latest, user), token: await joinToken(config, latest, user), wsUrl: config.wsUrl });
  }
  if (!isHost && !["waiting", "admitted"].includes(member?.state)) fail("Bạn không có quyền xem phòng này.", 403);
  if (action === "status" && req.method === "GET") {
    if (!isHost && member.state === "waiting") return res.status(200).json({ ok: true, waiting: true, room: publicRoom(room, user) });
    const participants = await remote(() => client.listParticipants(room._id));
    const waiting = isHost ? await members.find({ roomId: room._id, state: "waiting" }, { projection: { userId: 1, name: 1, updatedAt: 1 }, maxTimeMS: 5000 }).sort({ updatedAt: 1 }).limit(50).toArray() : [];
    return res.status(200).json({ ok: true, room: publicRoom(room, user), waiting: false, requests: waiting.map(m => ({ userId: m.userId, name: m.name, at: m.updatedAt })), participants: participants.map(p => ({ identity: p.identity, name: p.name, tracks: (p.tracks || []).map(t => ({ sid: t.sid, source: t.source, muted: t.muted })) })) });
  }
  if (req.method !== "POST") fail("Phương thức không được hỗ trợ.", 405);
  if (action === "leave") return res.status(200).json({ ok: true });
  if (!isHost) fail("Chỉ chủ phòng được dùng thao tác này.", 403, "HOST_ONLY");
  if (action === "rotate-invite") {
    const nextCode = randomBytes(8).toString("hex").toUpperCase();
    await rooms.updateOne({ _id: room._id, status: "active" }, { $set: { codeHash: hash(nextCode), updatedAt: new Date() } });
    return res.status(200).json({ ok: true, code: nextCode });
  }
  if (action === "admit" || action === "reject") {
    const target = clean(body.userId, 80);
    const result = await members.updateOne({ _id: room._id + ":" + target, roomId: room._id, state: "waiting" }, { $set: { state: action === "admit" ? "admitted" : "blocked", updatedAt: new Date() } });
    if (!result.matchedCount) fail("Yêu cầu tham gia không còn tồn tại.", 409);
    return res.status(200).json({ ok: true });
  }
  if (action === "kick" || action === "mute") {
    const targetIdentity = clean(body.identity, 100);
    if (!/^u_[a-f0-9]{24}$/i.test(targetIdentity) || targetIdentity === "u_" + room.ownerId) fail("Không thể thao tác trên chủ phòng hoặc người tham gia không hợp lệ.");
    const target = await members.findOne({ _id: room._id + ":" + targetIdentity.slice(2), state: "admitted" });
    if (!target) fail("Người tham gia không thuộc phòng này.", 404);
    if (action === "kick") {
      await members.updateOne({ _id: target._id }, { $set: { state: "blocked", updatedAt: new Date() } });
      await remote(() => client.removeParticipant(room._id, targetIdentity, { revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 1) }));
    } else {
      const participant = await remote(() => client.getParticipant(room._id, targetIdentity));
      for (const track of participant.tracks || []) if (track.source === TrackSource.MICROPHONE && !track.muted) await remote(() => client.mutePublishedTrack(room._id, targetIdentity, track.sid, true));
    }
    return res.status(200).json({ ok: true });
  }
  if (action === "settings") {
    const next = { ...room, settings: safeSettings(body.settings, room.settings) };
    await remote(() => client.updateRoomMetadata(room._id, metadata(next)));
    const participants = await remote(() => client.listParticipants(room._id));
    for (const p of participants) await remote(() => client.updateParticipant(room._id, p.identity, { permission: permissions(next, p.identity === "u_" + room.ownerId) }));
    await rooms.updateOne({ _id: room._id, status: "active" }, { $set: { settings: next.settings, updatedAt: new Date() } });
    return res.status(200).json({ ok: true, room: publicRoom(next, user) });
  }
  if (action === "timer") {
    const mode = clean(body.mode, 12), duration = Math.max(60, Math.min(10800, Math.floor(Number(body.duration) || 1500)));
    if (!["start", "pause", "reset"].includes(mode)) fail("Thao tác đồng hồ không hợp lệ.");
    const remaining = room.timer?.running ? Math.max(0, Number(room.timer.deadline) - Date.now()) : Number(room.timer?.remainingMs) || duration * 1000;
    const timer = { running: mode === "start", duration, remainingMs: mode === "reset" ? duration * 1000 : remaining, deadline: mode === "start" ? Date.now() + remaining : null };
    const next = { ...room, timer };
    await remote(() => client.updateRoomMetadata(room._id, metadata(next)));
    await rooms.updateOne({ _id: room._id, status: "active" }, { $set: { timer, updatedAt: new Date() } });
    return res.status(200).json({ ok: true, room: publicRoom(next, user) });
  }
  if (action === "close") {
    await rooms.updateOne({ _id: room._id, ownerId: uid, status: "active" }, { $set: { status: "closed", updatedAt: new Date() } });
    await remote(() => client.deleteRoom(room._id).catch(e => { if (e.code !== "not_found") throw e; }));
    return res.status(200).json({ ok: true });
  }
  fail("Thao tác không được hỗ trợ.");
}
async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET" && req.query.action === "config") {
    setCors(req, res);
    return res.status(200).json({ ok: true, configured: Boolean(configuration()), provider: "LiveKit", maxParticipants: 32, authenticationRequired: true });
  }
  return withApi(req, res, async ({ db, body }) => {
    const config = configuration();
    return handle(req, res, { db, body, user: await currentUser(req), config, client: config ? new RoomServiceClient(config.httpUrl, config.key, config.secret, { requestTimeout: 8 }) : null });
  });
}
handler.__test = { handle, configuration, permissions, joinToken, publicRoom, safeSettings };
module.exports = handler;
