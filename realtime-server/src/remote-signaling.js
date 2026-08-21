"use strict";

const { createHash, randomBytes, timingSafeEqual } = require("crypto");

const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_VIEWERS = 6;
const MAX_PENDING = 8;
const MAX_ALLOWED_USERS = 100;
const MAX_SIGNAL_BYTES = 96_000;
const PENDING_TTL_MS = 60 * 1000;
const RECOVERY_TTL_MS = 45 * 1000;
const PIN_ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const MAX_PIN_FAILURES = 10;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const VISIBILITIES = new Set(["hidden", "invited", "friends", "members"]);

const clean = (value, limit = 80) => String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
const normalizeCode = (value) => clean(value, 12).toUpperCase().replace(/[^A-Z2-9]/g, "");
const hashSecret = (value) => createHash("sha256").update(String(value || "")).digest();
const equalSecret = (value, digest) => {
  const candidate = hashSecret(value);
  return Buffer.isBuffer(digest) && candidate.length === digest.length && timingSafeEqual(candidate, digest);
};
const randomCode = (length = 8) => Array.from(randomBytes(length), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
const randomPin = () => String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");
const randomSecret = () => randomBytes(24).toString("base64url");
const roomName = (code) => `remote:${code}`;
const lobbyName = () => "remote:lobby";
const ack = (callback, payload) => { if (typeof callback === "function") callback(payload); };
const userId = (socket) => clean(socket?.user?._id, 120);
const publicHost = (socket, fallbackName = "Thiết bị chia sẻ") => ({
  id: userId(socket),
  name: clean(socket?.user?.name || socket?.user?.displayName || fallbackName, 60),
  avatar: clean(socket?.user?.avatar, 500)
});
const normalizeAudience = (input, authenticated = false) => {
  const requestedVisibility = clean(input?.visibility, 20);
  const visibility = authenticated && VISIBILITIES.has(requestedVisibility) ? requestedVisibility : "hidden";
  const allowedUserIds = [...new Set((Array.isArray(input?.allowedUserIds) ? input.allowedUserIds : [])
    .map((item) => clean(item, 120)).filter(Boolean))].slice(0, MAX_ALLOWED_USERS);
  return {
    title: clean(input?.title || "Phòng hỗ trợ màn hình", 80),
    visibility,
    allowedUserIds,
    requireApproval: input?.requireApproval !== false,
    maxViewers: Math.max(1, Math.min(MAX_VIEWERS, Number(input?.maxViewers) || 1))
  };
};
const normalizeSignal = (input) => {
  const type = clean(input?.type, 24);
  if (type === "offer" || type === "answer") {
    const description = input?.description;
    if (description?.type !== type || typeof description.sdp !== "string") return null;
    const sdp = description.sdp;
    if (!sdp || Buffer.byteLength(sdp) > MAX_SIGNAL_BYTES) return null;
    return { type, description: { type, sdp } };
  }
  if (type !== "candidate" || !input?.candidate || typeof input.candidate.candidate !== "string") return null;
  const candidate = clean(input.candidate.candidate, 8_192);
  if (!candidate) return null;
  const sdpMLineIndex = Number(input.candidate.sdpMLineIndex);
  return {
    type,
    candidate: {
      candidate,
      sdpMid: input.candidate.sdpMid == null ? null : clean(input.candidate.sdpMid, 80),
      sdpMLineIndex: Number.isInteger(sdpMLineIndex) && sdpMLineIndex >= 0 && sdpMLineIndex <= 65_535 ? sdpMLineIndex : null,
      usernameFragment: input.candidate.usernameFragment == null ? null : clean(input.candidate.usernameFragment, 256)
    }
  };
};

function registerRemoteSignaling({ io, iceServers = [], allowedOrigins = [], audienceAccess } = {}) {
  if (!io?.on || io.__hhRemoteSignaling) return io?.__hhRemoteSignaling || null;
  const sessions = new Map();
  io.__hhRemoteSignaling = { sessions };

  const notifyDirectoryChanged = () => io.to(lobbyName()).emit("remote:rooms:changed", { updatedAt: new Date().toISOString() });

  const canSeeRoom = async (room, socket) => {
    const viewerId = userId(socket);
    if (!room || room.expiresAt <= Date.now() || room.audience.visibility === "hidden" || !viewerId || viewerId === room.hostUserId) return false;
    if (room.audience.visibility === "members") return true;
    if (room.audience.visibility === "invited") return room.audience.allowedUserIds.includes(viewerId);
    if (room.audience.visibility === "friends" && typeof audienceAccess === "function") {
      try { return Boolean(await audienceAccess({ hostUserId: room.hostUserId, viewerUserId: viewerId, visibility: "friends" })); } catch { return false; }
    }
    return false;
  };

  const roomSummary = (room) => ({
    id: room.code,
    title: room.audience.title,
    visibility: room.audience.visibility,
    requireApproval: room.audience.requireApproval,
    host: room.host,
    viewerCount: [...room.viewers.values()].filter((item) => !item.disconnectedAt).length,
    maxViewers: room.audience.maxViewers,
    createdAt: new Date(room.createdAt).toISOString(),
    expiresAt: new Date(room.expiresAt).toISOString()
  });

  const removeSession = async (code, reason = "closed") => {
    const room = sessions.get(code);
    if (!room) return;
    sessions.delete(code);
    io.to(roomName(code)).emit("remote:session:closed", { code, reason, closedAt: new Date().toISOString() });
    const sockets = await io.in(roomName(code)).fetchSockets().catch(() => []);
    await Promise.all(sockets.map((peer) => peer.leave(roomName(code))));
    notifyDirectoryChanged();
  };

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of sessions) {
      if (room.expiresAt <= now) {
        removeSession(code, "expired");
        continue;
      }
      for (const [requestId, request] of room.pending) {
        if (request.expiresAt <= now) {
          room.pending.delete(requestId);
          io.to(request.socketId).emit("remote:join:denied", { code, reason: "Yêu cầu ghép nối đã hết hạn." });
        }
      }
      for (const [socketId, viewer] of room.viewers) {
        if (viewer.disconnectedAt && viewer.disconnectedAt + RECOVERY_TTL_MS <= now) room.viewers.delete(socketId);
      }
    }
  }, 30_000);
  cleanup.unref?.();

  io.on("connection", (socket) => {
    const origin = String(socket.handshake?.headers?.origin || "").trim();
    if (allowedOrigins.length && (!origin || !allowedOrigins.includes(origin))) {
      socket.emit("remote:error", { code: "REMOTE_ORIGIN_REJECTED", message: "Nguồn kết nối Remote không được phép." });
      socket.disconnect?.(true);
      return;
    }
    if (socket.user) socket.join(lobbyName());
    const rate = (key, limit, windowMs) => {
      const now = Date.now();
      socket.data.hhRemoteRates ||= {};
      const current = socket.data.hhRemoteRates[key] || { startedAt: now, count: 0 };
      if (now - current.startedAt >= windowMs) { current.startedAt = now; current.count = 0; }
      current.count += 1;
      socket.data.hhRemoteRates[key] = current;
      return current.count <= limit;
    };

    const hostRoom = (payload) => {
      const code = normalizeCode(payload?.code);
      const room = sessions.get(code);
      return room && room.hostSocketId === socket.id && equalSecret(payload?.hostToken, room.hostTokenHash) ? room : null;
    };

    socket.on("remote:session:create", async (payload = {}, callback) => {
      if (!rate("create", 3, 60_000)) return ack(callback, { ok: false, error: "Bạn đang tạo phiên quá nhanh." });
      for (const [code, room] of sessions) if (room.hostSocketId === socket.id) await removeSession(code, "replaced");
      let code = randomCode();
      while (sessions.has(code)) code = randomCode();
      const pin = randomPin();
      const hostToken = randomSecret();
      const now = Date.now();
      const audience = normalizeAudience(payload.audience, Boolean(socket.user));
      if (audience.visibility === "invited" && !audience.allowedUserIds.length) return ack(callback, { ok: false, error: "Hãy chọn ít nhất một người được xem phòng." });
      const room = {
        code,
        pinHash: hashSecret(pin),
        hostTokenHash: hashSecret(hostToken),
        hostSocketId: socket.id,
        hostUserId: userId(socket),
        hostName: clean(payload.name || socket.user?.name || "Thiết bị chia sẻ", 60),
        hostDevice: clean(payload.device || "Máy tính", 60),
        host: publicHost(socket, payload.name),
        audience,
        createdAt: now,
        expiresAt: now + SESSION_TTL_MS,
        locked: false,
        pinAttempts: new Map(),
        pending: new Map(),
        viewers: new Map()
      };
      sessions.set(code, room);
      await socket.join(roomName(code));
      notifyDirectoryChanged();
      ack(callback, { ok: true, code, pin, hostToken, expiresAt: new Date(room.expiresAt).toISOString(), iceServers, maxViewers: audience.maxViewers, audience });
    });

    socket.on("remote:rooms:list", async (_payload = {}, callback) => {
      if (!rate("rooms-list", 30, 60_000)) return ack(callback, { ok: false, error: "Bạn đang làm mới danh sách phòng quá nhanh." });
      if (!socket.user) return ack(callback, { ok: false, error: "Hãy đăng nhập để xem các phòng đang phát." });
      const visible = [];
      for (const room of sessions.values()) if (await canSeeRoom(room, socket)) visible.push(roomSummary(room));
      visible.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      ack(callback, { ok: true, rooms: visible.slice(0, 50), updatedAt: new Date().toISOString() });
    });

    socket.on("remote:session:join", async (payload = {}, callback) => {
      if (!rate("join", 8, 60_000)) return ack(callback, { ok: false, error: "Bạn đã thử ghép nối quá nhiều lần." });
      const code = normalizeCode(payload.code);
      const room = sessions.get(code);
      if (!room || room.expiresAt <= Date.now()) return ack(callback, { ok: false, error: "Phiên không tồn tại hoặc đã hết hạn." });
      if (room.locked) return ack(callback, { ok: false, error: "Chủ phiên đã khóa yêu cầu kết nối mới." });
      if (room.hostSocketId === socket.id) return ack(callback, { ok: false, error: "Thiết bị chia sẻ không thể tự tham gia phiên của mình." });
      if (room.audience.visibility !== "hidden" && !await canSeeRoom(room, socket)) return ack(callback, { ok: false, error: "Bạn không thuộc phạm vi được xem phòng này." });
      const address = String(socket.handshake?.address || socket.conn?.remoteAddress || socket.id);
      const agent = String(socket.handshake?.headers?.["user-agent"] || "");
      const attemptKey = createHash("sha256").update(`${address}|${agent}`).digest("hex");
      const now = Date.now();
      const attempts = room.pinAttempts.get(attemptKey) || { startedAt: now, count: 0 };
      if (now - attempts.startedAt >= PIN_ATTEMPT_WINDOW_MS) { attempts.startedAt = now; attempts.count = 0; }
      if (attempts.count >= MAX_PIN_FAILURES) return ack(callback, { ok: false, error: "Thiết bị này tạm thời bị giới hạn ghép nối." });
      if (!equalSecret(clean(payload.pin, 12), room.pinHash)) {
        attempts.count += 1;
        room.pinAttempts.set(attemptKey, attempts);
        return ack(callback, { ok: false, error: "Mã PIN không đúng." });
      }
      room.pinAttempts.delete(attemptKey);
      if (room.viewers.size >= room.audience.maxViewers) return ack(callback, { ok: false, error: "Phiên đã đủ người xem." });
      for (const [requestId, request] of room.pending) if (request.socketId === socket.id) room.pending.delete(requestId);
      if (room.pending.size >= MAX_PENDING) return ack(callback, { ok: false, error: "Phiên đang có quá nhiều yêu cầu chờ duyệt." });
      const requestId = randomSecret();
      const request = {
        id: requestId,
        socketId: socket.id,
        name: clean(payload.name || "Thiết bị khách", 60),
        device: clean(payload.device || "Trình duyệt", 60),
        userId: userId(socket),
        avatar: clean(socket.user?.avatar, 500),
        requestedAt: new Date().toISOString(),
        expiresAt: Date.now() + PENDING_TTL_MS
      };
      room.pending.set(requestId, request);
      io.to(room.hostSocketId).emit("remote:join:requested", { code, request: { id: request.id, name: request.name, device: request.device, userId: request.userId, avatar: request.avatar, requestedAt: request.requestedAt } });
      ack(callback, { ok: true, pending: true, requestId, expiresAt: new Date(room.expiresAt).toISOString() });
    });

    const approveViewer = async (room, request, hostSocket = io.sockets.sockets.get(room.hostSocketId)) => {
      if (room.viewers.size >= room.audience.maxViewers) return { ok: false, error: "Phiên đã đủ người xem." };
      const viewerSocket = io.sockets.sockets.get(request.socketId);
      if (!viewerSocket?.connected) return { ok: false, error: "Thiết bị khách đã ngắt kết nối." };
      if (room.audience.visibility !== "hidden" && !await canSeeRoom(room, viewerSocket)) return { ok: false, error: "Người xem không còn thuộc phạm vi được phép." };
      const reconnectToken = randomSecret();
      room.viewers.set(request.socketId, { name: request.name, device: request.device, userId: request.userId || userId(viewerSocket), avatar: request.avatar || clean(viewerSocket.user?.avatar, 500), joinedAt: new Date().toISOString(), reconnectTokenHash: hashSecret(reconnectToken), disconnectedAt: 0 });
      await viewerSocket.join(roomName(room.code));
      viewerSocket.emit("remote:join:approved", { code: room.code, hostSocketId: room.hostSocketId, hostName: room.hostName, reconnectToken, iceServers, expiresAt: new Date(room.expiresAt).toISOString() });
      const viewer = room.viewers.get(request.socketId);
      hostSocket?.emit("remote:peer:joined", { code: room.code, socketId: request.socketId, peer: { name: viewer.name, device: viewer.device, userId: viewer.userId, avatar: viewer.avatar, joinedAt: viewer.joinedAt }, iceServers });
      notifyDirectoryChanged();
      return { ok: true, accepted: true, socketId: request.socketId };
    };

    socket.on("remote:room:watch", async (payload = {}, callback) => {
      if (!rate("room-watch", 8, 60_000)) return ack(callback, { ok: false, error: "Bạn đã gửi quá nhiều yêu cầu xem." });
      if (!socket.user) return ack(callback, { ok: false, error: "Hãy đăng nhập để xem phòng đang phát." });
      const code = normalizeCode(payload.roomId || payload.code);
      const room = sessions.get(code);
      if (!await canSeeRoom(room, socket)) return ack(callback, { ok: false, error: "Phòng không tồn tại hoặc bạn không thuộc phạm vi được xem." });
      if (room.locked) return ack(callback, { ok: false, error: "Chủ phiên đã khóa người xem mới." });
      if (room.viewers.size >= room.audience.maxViewers) return ack(callback, { ok: false, error: "Phòng đã đủ người xem trực tiếp." });
      for (const [requestId, request] of room.pending) if (request.socketId === socket.id) room.pending.delete(requestId);
      const request = {
        id: randomSecret(), socketId: socket.id, userId: userId(socket),
        name: clean(socket.user?.name || socket.user?.displayName || "Thành viên HH", 60),
        avatar: clean(socket.user?.avatar, 500), device: clean(payload.device || "Trình duyệt", 60),
        requestedAt: new Date().toISOString(), expiresAt: Date.now() + PENDING_TTL_MS
      };
      if (!room.audience.requireApproval) return ack(callback, await approveViewer(room, request));
      room.pending.set(request.id, request);
      io.to(room.hostSocketId).emit("remote:join:requested", { code, request: { id: request.id, name: request.name, device: request.device, userId: request.userId, avatar: request.avatar, requestedAt: request.requestedAt } });
      ack(callback, { ok: true, pending: true, requestId: request.id, expiresAt: new Date(room.expiresAt).toISOString() });
    });

    socket.on("remote:session:approve", async (payload = {}, callback) => {
      const room = hostRoom(payload);
      const requestId = clean(payload.requestId, 80);
      const request = room?.pending.get(requestId);
      if (!room || !request) return ack(callback, { ok: false, error: "Yêu cầu ghép nối không còn hợp lệ." });
      room.pending.delete(requestId);
      if (payload.accept !== true) {
        io.to(request.socketId).emit("remote:join:denied", { code: room.code, reason: "Chủ phiên đã từ chối." });
        return ack(callback, { ok: true, accepted: false });
      }
      ack(callback, await approveViewer(room, request, socket));
    });

    socket.on("remote:room:update", async (payload = {}, callback) => {
      if (!rate("room-update", 12, 60_000)) return ack(callback, { ok: false, error: "Bạn đang cập nhật phòng quá nhanh." });
      const room = hostRoom(payload);
      if (!room) return ack(callback, { ok: false, error: "Không có quyền cập nhật phòng." });
      const next = normalizeAudience(payload.audience, Boolean(socket.user));
      if (next.visibility === "invited" && !next.allowedUserIds.length) return ack(callback, { ok: false, error: "Hãy chọn ít nhất một người được xem phòng." });
      room.audience = next;
      for (const [requestId, request] of [...room.pending]) {
        const pendingSocket = io.sockets.sockets.get(request.socketId);
        if (!pendingSocket || !await canSeeRoom(room, pendingSocket)) {
          room.pending.delete(requestId);
          pendingSocket?.emit("remote:join:denied", { code: room.code, reason: "Chủ phòng đã thay đổi phạm vi người xem." });
        }
      }
      let retained = 0;
      for (const [viewerSocketId, viewer] of [...room.viewers]) {
        const viewerSocket = io.sockets.sockets.get(viewerSocketId);
        const allowed = Boolean(viewerSocket && await canSeeRoom(room, viewerSocket) && retained < next.maxViewers);
        if (allowed) retained += 1;
        else {
          room.viewers.delete(viewerSocketId);
          viewerSocket?.emit("remote:session:revoked", { code: room.code, reason: "audience-changed", revokedAt: new Date().toISOString() });
          await viewerSocket?.leave?.(roomName(room.code));
          io.to(room.hostSocketId).emit("remote:peer:left", { code: room.code, socketId: viewerSocketId, reason: "audience-changed" });
        }
      }
      notifyDirectoryChanged();
      ack(callback, { ok: true, audience: next, room: roomSummary(room) });
    });

    socket.on("remote:session:lock", (payload = {}, callback) => {
      if (!rate("lock", 12, 60_000)) return ack(callback, { ok: false, error: "Bạn đang thay đổi trạng thái phiên quá nhanh." });
      const room = hostRoom(payload);
      if (!room) return ack(callback, { ok: false, error: "Không có quyền khóa phiên." });
      room.locked = payload.locked === true;
      io.to(roomName(room.code)).emit("remote:session:state", { code: room.code, locked: room.locked });
      ack(callback, { ok: true, locked: room.locked });
      notifyDirectoryChanged();
    });

    socket.on("remote:session:revoke", async (payload = {}, callback) => {
      if (!rate("revoke", 12, 60_000)) return ack(callback, { ok: false, error: "Bạn đang thu hồi thiết bị quá nhanh." });
      const room = hostRoom(payload);
      const targetSocketId = clean(payload.targetSocketId, 120);
      const viewer = room?.viewers.get(targetSocketId);
      if (!room || !viewer) return ack(callback, { ok: false, error: "Thiết bị không còn trong phiên." });
      room.viewers.delete(targetSocketId);
      const target = io.sockets.sockets.get(targetSocketId);
      target?.emit("remote:session:revoked", { code: room.code, revokedAt: new Date().toISOString() });
      await target?.leave?.(roomName(room.code));
      io.to(room.hostSocketId).emit("remote:peer:left", { code: room.code, socketId: targetSocketId, reason: "revoked" });
      notifyDirectoryChanged();
      ack(callback, { ok: true, revoked: true });
    });

    socket.on("remote:session:recover", async (payload = {}, callback) => {
      if (!rate("recover", 6, 60_000)) return ack(callback, { ok: false, error: "Bạn đã thử phục hồi quá nhiều lần." });
      const code = normalizeCode(payload.code);
      const room = sessions.get(code);
      if (!room || room.expiresAt <= Date.now()) return ack(callback, { ok: false, error: "Phiên không tồn tại hoặc đã hết hạn." });
      let previousId = "";
      let viewer = null;
      for (const [socketId, candidate] of room.viewers) {
        if (candidate.disconnectedAt && candidate.disconnectedAt + RECOVERY_TTL_MS > Date.now() && equalSecret(payload.reconnectToken, candidate.reconnectTokenHash)) {
          previousId = socketId;
          viewer = candidate;
          break;
        }
      }
      if (!viewer) return ack(callback, { ok: false, error: "Phiên phục hồi không hợp lệ hoặc đã hết thời gian." });
      room.viewers.delete(previousId);
      viewer.disconnectedAt = 0;
      room.viewers.set(socket.id, viewer);
      await socket.join(roomName(code));
      socket.emit("remote:join:approved", { code, hostSocketId: room.hostSocketId, hostName: room.hostName, reconnectToken: payload.reconnectToken, iceServers, expiresAt: new Date(room.expiresAt).toISOString(), recovered: true });
      io.to(room.hostSocketId).emit("remote:peer:left", { code, socketId: previousId, reason: "recovering" });
      io.to(room.hostSocketId).emit("remote:peer:joined", { code, socketId: socket.id, peer: { name: viewer.name, device: viewer.device, joinedAt: viewer.joinedAt }, iceServers, recovered: true });
      ack(callback, { ok: true, recovered: true });
    });

    socket.on("remote:signal", (payload = {}, callback) => {
      if (!rate("signal", 180, 10_000)) return ack(callback, { ok: false, error: "Tín hiệu WebRTC vượt giới hạn." });
      const code = normalizeCode(payload.code);
      const targetSocketId = clean(payload.targetSocketId, 120);
      const room = sessions.get(code);
      const isHost = room?.hostSocketId === socket.id;
      const isViewer = room?.viewers.has(socket.id);
      const targetAllowed = isHost ? room?.viewers.has(targetSocketId) : isViewer && targetSocketId === room?.hostSocketId;
      const signal = normalizeSignal(payload.signal);
      let size = Infinity;
      try { size = Buffer.byteLength(JSON.stringify(signal || null)); } catch {}
      if (!room || room.expiresAt <= Date.now() || !targetAllowed || !signal || size > MAX_SIGNAL_BYTES) {
        return ack(callback, { ok: false, error: "Tín hiệu WebRTC không hợp lệ." });
      }
      io.to(targetSocketId).emit("remote:signal", { code, fromSocketId: socket.id, signal });
      ack(callback, { ok: true });
    });

    socket.on("remote:session:leave", async (payload = {}, callback) => {
      const code = normalizeCode(payload.code);
      const room = sessions.get(code);
      if (!room) return ack(callback, { ok: true });
      if (room.hostSocketId === socket.id && equalSecret(payload.hostToken, room.hostTokenHash)) await removeSession(code, "host-ended");
      else if (room.viewers.delete(socket.id)) {
        await socket.leave(roomName(code));
        io.to(room.hostSocketId).emit("remote:peer:left", { code, socketId: socket.id, reason: "left" });
        notifyDirectoryChanged();
      }
      ack(callback, { ok: true });
    });

    socket.on("disconnect", () => {
      for (const [code, room] of sessions) {
        if (room.hostSocketId === socket.id) removeSession(code, "host-disconnected");
        else if (room.viewers.has(socket.id)) {
          const viewer = room.viewers.get(socket.id);
          viewer.disconnectedAt = Date.now();
          room.viewers.set(socket.id, viewer);
          io.to(room.hostSocketId).emit("remote:peer:left", { code, socketId: socket.id, reason: "recoverable-disconnect" });
          notifyDirectoryChanged();
        }
        for (const [requestId, request] of room.pending) if (request.socketId === socket.id) room.pending.delete(requestId);
      }
    });
  });

  return io.__hhRemoteSignaling;
}

module.exports = { registerRemoteSignaling, normalizeCode, normalizeSignal, normalizeAudience, hashSecret, SESSION_TTL_MS, MAX_VIEWERS, MAX_PENDING, MAX_ALLOWED_USERS, MAX_SIGNAL_BYTES, PENDING_TTL_MS, RECOVERY_TTL_MS, PIN_ATTEMPT_WINDOW_MS, MAX_PIN_FAILURES };
