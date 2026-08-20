"use strict";

const { createHash, randomBytes, timingSafeEqual } = require("crypto");

const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_VIEWERS = 1;
const MAX_PENDING = 8;
const MAX_SIGNAL_BYTES = 96_000;
const PENDING_TTL_MS = 60 * 1000;
const RECOVERY_TTL_MS = 45 * 1000;
const PIN_ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const MAX_PIN_FAILURES = 10;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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
const ack = (callback, payload) => { if (typeof callback === "function") callback(payload); };
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

function registerRemoteSignaling({ io, iceServers = [], allowedOrigins = [] } = {}) {
  if (!io?.on || io.__hhRemoteSignaling) return io?.__hhRemoteSignaling || null;
  const sessions = new Map();
  io.__hhRemoteSignaling = { sessions };

  const removeSession = async (code, reason = "closed") => {
    const room = sessions.get(code);
    if (!room) return;
    sessions.delete(code);
    io.to(roomName(code)).emit("remote:session:closed", { code, reason, closedAt: new Date().toISOString() });
    const sockets = await io.in(roomName(code)).fetchSockets().catch(() => []);
    await Promise.all(sockets.map((peer) => peer.leave(roomName(code))));
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
      const room = {
        code,
        pinHash: hashSecret(pin),
        hostTokenHash: hashSecret(hostToken),
        hostSocketId: socket.id,
        hostName: clean(payload.name || socket.user?.name || "Thiết bị chia sẻ", 60),
        hostDevice: clean(payload.device || "Máy tính", 60),
        createdAt: now,
        expiresAt: now + SESSION_TTL_MS,
        locked: false,
        pinAttempts: new Map(),
        pending: new Map(),
        viewers: new Map()
      };
      sessions.set(code, room);
      await socket.join(roomName(code));
      ack(callback, { ok: true, code, pin, hostToken, expiresAt: new Date(room.expiresAt).toISOString(), iceServers, maxViewers: MAX_VIEWERS });
    });

    socket.on("remote:session:join", (payload = {}, callback) => {
      if (!rate("join", 8, 60_000)) return ack(callback, { ok: false, error: "Bạn đã thử ghép nối quá nhiều lần." });
      const code = normalizeCode(payload.code);
      const room = sessions.get(code);
      if (!room || room.expiresAt <= Date.now()) return ack(callback, { ok: false, error: "Phiên không tồn tại hoặc đã hết hạn." });
      if (room.locked) return ack(callback, { ok: false, error: "Chủ phiên đã khóa yêu cầu kết nối mới." });
      if (room.hostSocketId === socket.id) return ack(callback, { ok: false, error: "Thiết bị chia sẻ không thể tự tham gia phiên của mình." });
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
      if (room.viewers.size >= MAX_VIEWERS) return ack(callback, { ok: false, error: "Phiên đã đủ người xem." });
      for (const [requestId, request] of room.pending) if (request.socketId === socket.id) room.pending.delete(requestId);
      if (room.pending.size >= MAX_PENDING) return ack(callback, { ok: false, error: "Phiên đang có quá nhiều yêu cầu chờ duyệt." });
      const requestId = randomSecret();
      const request = {
        id: requestId,
        socketId: socket.id,
        name: clean(payload.name || "Thiết bị khách", 60),
        device: clean(payload.device || "Trình duyệt", 60),
        requestedAt: new Date().toISOString(),
        expiresAt: Date.now() + PENDING_TTL_MS
      };
      room.pending.set(requestId, request);
      io.to(room.hostSocketId).emit("remote:join:requested", { code, request: { id: request.id, name: request.name, device: request.device, requestedAt: request.requestedAt } });
      ack(callback, { ok: true, pending: true, requestId, expiresAt: new Date(room.expiresAt).toISOString() });
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
      const viewerSocket = io.sockets.sockets.get(request.socketId);
      if (!viewerSocket?.connected) return ack(callback, { ok: false, error: "Thiết bị khách đã ngắt kết nối." });
      const reconnectToken = randomSecret();
      room.viewers.set(request.socketId, { name: request.name, device: request.device, joinedAt: new Date().toISOString(), reconnectTokenHash: hashSecret(reconnectToken), disconnectedAt: 0 });
      await viewerSocket.join(roomName(room.code));
      viewerSocket.emit("remote:join:approved", { code: room.code, hostSocketId: room.hostSocketId, hostName: room.hostName, reconnectToken, iceServers, expiresAt: new Date(room.expiresAt).toISOString() });
      const viewer = room.viewers.get(request.socketId);
      socket.emit("remote:peer:joined", { code: room.code, socketId: request.socketId, peer: { name: viewer.name, device: viewer.device, joinedAt: viewer.joinedAt }, iceServers });
      ack(callback, { ok: true, accepted: true, socketId: request.socketId });
    });

    socket.on("remote:session:lock", (payload = {}, callback) => {
      if (!rate("lock", 12, 60_000)) return ack(callback, { ok: false, error: "Bạn đang thay đổi trạng thái phiên quá nhanh." });
      const room = hostRoom(payload);
      if (!room) return ack(callback, { ok: false, error: "Không có quyền khóa phiên." });
      room.locked = payload.locked === true;
      io.to(roomName(room.code)).emit("remote:session:state", { code: room.code, locked: room.locked });
      ack(callback, { ok: true, locked: room.locked });
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
        }
        for (const [requestId, request] of room.pending) if (request.socketId === socket.id) room.pending.delete(requestId);
      }
    });
  });

  return io.__hhRemoteSignaling;
}

module.exports = { registerRemoteSignaling, normalizeCode, normalizeSignal, hashSecret, SESSION_TTL_MS, MAX_VIEWERS, MAX_PENDING, MAX_SIGNAL_BYTES, PENDING_TTL_MS, RECOVERY_TTL_MS, PIN_ATTEMPT_WINDOW_MS, MAX_PIN_FAILURES };
