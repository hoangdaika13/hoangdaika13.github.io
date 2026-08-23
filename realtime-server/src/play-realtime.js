"use strict";

/*
 * HH Play realtime room adapter.
 *
 * This module deliberately keeps room discovery disabled: a client can only
 * create or join a room when the socket is authenticated. Room state is kept
 * in memory until a durable store is configured, so the protocol never claims
 * persistence or presence after a process restart.
 */
const { randomUUID } = require("crypto");

const ROOM_CODE = /^[A-Z0-9]{6,12}$/;
const ALLOWED_PRIVACY = new Set(["invite", "private", "public-draft"]);
const ALLOWED_ROLES = new Set(["host", "player", "spectator"]);
const MAX_NAME = 80;
const MAX_GAME = 40;
const MAX_MEMBERS = 12;
const MAX_EVENT_BYTES = 16 * 1024;

const clean = (value, max = 200) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const safeCode = (value) => clean(value, 12).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
const safeRole = (value) => ALLOWED_ROLES.has(value) ? value : "player";
const randomCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let output = "";
  for (let index = 0; index < 6; index += 1) output += alphabet[Math.floor(Math.random() * alphabet.length)];
  return output;
};
const publicMember = (member) => ({ id: member.id, name: member.name, role: member.role });
const publicRoom = (room) => ({
  code: room.code,
  name: room.name,
  game: room.game,
  privacy: room.privacy,
  maxMembers: room.maxMembers,
  revision: room.revision,
  members: [...room.members.values()].map(publicMember),
  state: room.state,
  persistence: "memory",
  authoritative: true,
  updatedAt: room.updatedAt
});

function registerPlayRealtime({ io, maxRooms = 200, maxMembers = MAX_MEMBERS } = {}) {
  if (!io || typeof io.on !== "function") throw new Error("HH Play realtime requires a Socket.IO server.");
  const rooms = new Map();
  const socketRoom = (code) => `hh-play:${code}`;
  const activeBySocket = new Map();
  const rate = new Map();
  const allow = (socket, type, limit = 40) => {
    const key = `${socket.id}:${type}`;
    const now = Date.now();
    const current = rate.get(key) || { start: now, count: 0 };
    if (now - current.start >= 10_000) { current.start = now; current.count = 0; }
    current.count += 1; rate.set(key, current);
    return current.count <= limit;
  };
  const ack = (callback, payload) => { if (typeof callback === "function") callback(payload); };
  const authenticated = (socket, callback) => {
    if (socket.user?._id || socket.user?.id) return true;
    ack(callback, { ok: false, error: "HH Play realtime yêu cầu đăng nhập.", code: "AUTH_REQUIRED" });
    return false;
  };
  const identity = (socket, role = "player") => ({
    id: String(socket.user?._id || socket.user?.id || ""),
    name: clean(socket.user?.name || socket.user?.displayName || "Thành viên HH", MAX_NAME),
    role: safeRole(role),
    socketId: socket.id
  });
  const emitPresence = (room) => {
    io.to(socketRoom(room.code)).emit("play:room:presence", {
      code: room.code,
      members: [...room.members.values()].map(publicMember),
      revision: room.revision,
      updatedAt: room.updatedAt
    });
  };
  const leave = async (socket, reason = "left") => {
    const code = activeBySocket.get(socket.id);
    if (!code) return;
    activeBySocket.delete(socket.id);
    const room = rooms.get(code);
    await socket.leave(socketRoom(code));
    if (!room) return;
    room.members.delete(socket.id);
    if (room.hostSocketId === socket.id) {
      const next = room.members.values().next().value;
      if (next) { next.role = "host"; room.hostSocketId = next.socketId; }
    }
    room.updatedAt = new Date().toISOString();
    if (!room.members.size) { rooms.delete(code); return; }
    io.to(socketRoom(code)).emit("play:room:event", { code, type: "member:left", memberId: String(socket.user?._id || ""), reason: clean(reason, 40), revision: room.revision });
    emitPresence(room);
  };
  const join = async (socket, room, role, callback) => {
    if (!room) return ack(callback, { ok: false, error: "Không tìm thấy phòng hoặc phòng đã đóng.", code: "ROOM_NOT_FOUND" });
    if (room.privacy === "private" && room.members.size) return ack(callback, { ok: false, error: "Phòng này chỉ dành cho chủ phòng.", code: "ROOM_PRIVATE" });
    if (room.members.size >= room.maxMembers && !room.members.has(socket.id)) return ack(callback, { ok: false, error: "Phòng đã đủ người.", code: "ROOM_FULL" });
    await leave(socket, "switched");
    const member = identity(socket, socket.id === room.hostSocketId ? "host" : role === "spectator" ? "spectator" : "player");
    room.members.set(socket.id, member);
    activeBySocket.set(socket.id, room.code);
    await socket.join(socketRoom(room.code));
    room.updatedAt = new Date().toISOString();
    emitPresence(room);
    ack(callback, { ok: true, room: publicRoom(room), self: publicMember(member) });
  };

  io.on("connection", (socket) => {
    socket.on("play:room:create", async (payload = {}, callback) => {
      if (!authenticated(socket, callback) || !allow(socket, "create", 8)) return;
      if (rooms.size >= Math.max(1, Math.min(1000, Number(maxRooms) || 200))) return ack(callback, { ok: false, error: "Máy chủ đang đầy phòng.", code: "ROOM_LIMIT" });
      let code = randomCode();
      while (rooms.has(code)) code = randomCode();
      const room = {
        code,
        name: clean(payload.name || "Phòng HH Play", MAX_NAME) || "Phòng HH Play",
        game: clean(payload.game || "party", MAX_GAME) || "party",
        privacy: ALLOWED_PRIVACY.has(payload.privacy) ? payload.privacy : "invite",
        maxMembers: Math.max(2, Math.min(Number(maxMembers) || MAX_MEMBERS, Number(payload.maxMembers) || 8)),
        hostSocketId: socket.id,
        members: new Map(),
        revision: 0,
        state: { phase: "lobby", game: clean(payload.game || "party", MAX_GAME) || "party" },
        updatedAt: new Date().toISOString()
      };
      rooms.set(code, room);
      await join(socket, room, "host", callback);
    });
    socket.on("play:room:join", async (payload = {}, callback) => {
      if (!authenticated(socket, callback) || !allow(socket, "join", 20)) return;
      await join(socket, rooms.get(safeCode(payload.code)), safeRole(payload.role), callback);
    });
    socket.on("play:room:leave", async (_payload = {}, callback) => { await leave(socket, "left"); ack(callback, { ok: true }); });
    socket.on("play:room:state", (payload = {}, callback) => {
      if (!authenticated(socket, callback) || !allow(socket, "state", 60)) return;
      const code = activeBySocket.get(socket.id); const room = rooms.get(code); const member = room?.members.get(socket.id);
      if (!room || member?.role !== "host") return ack(callback, { ok: false, error: "Chỉ chủ phòng được cập nhật trạng thái.", code: "HOST_REQUIRED" });
      const serialized = JSON.stringify(payload.state ?? {});
      if (Buffer.byteLength(serialized, "utf8") > MAX_EVENT_BYTES) return ack(callback, { ok: false, error: "Trạng thái ván chơi quá lớn.", code: "STATE_TOO_LARGE" });
      room.state = JSON.parse(serialized); room.revision += 1; room.updatedAt = new Date().toISOString();
      io.to(socketRoom(code)).emit("play:room:state", { code, state: room.state, revision: room.revision, updatedAt: room.updatedAt });
      ack(callback, { ok: true, revision: room.revision });
    });
    socket.on("play:room:event", (payload = {}, callback) => {
      if (!authenticated(socket, callback) || !allow(socket, "event", 120)) return;
      const code = activeBySocket.get(socket.id); const room = rooms.get(code); const member = room?.members.get(socket.id);
      if (!room || !member) return ack(callback, { ok: false, error: "Bạn chưa ở trong phòng.", code: "NOT_IN_ROOM" });
      const type = clean(payload.type, 40); const serialized = JSON.stringify(payload.data ?? {});
      if (!type || Buffer.byteLength(serialized, "utf8") > MAX_EVENT_BYTES) return ack(callback, { ok: false, error: "Sự kiện không hợp lệ.", code: "EVENT_REJECTED" });
      if (type.startsWith("watch:") && member.role !== "host") return ack(callback, { ok: false, error: "Chỉ chủ phòng được điều khiển Watch Party.", code: "HOST_REQUIRED" });
      room.revision += 1; room.updatedAt = new Date().toISOString();
      socket.to(socketRoom(code)).emit("play:room:event", { code, type, data: JSON.parse(serialized), actor: publicMember(member), revision: room.revision });
      ack(callback, { ok: true, revision: room.revision });
    });
    socket.on("disconnect", () => { void leave(socket, "disconnect"); rate.forEach((_value, key) => { if (key.startsWith(`${socket.id}:`)) rate.delete(key); }); });
  });

  return Object.freeze({ rooms, capabilities: { protocol: "hh-play-realtime-v1", authenticatedOnly: true, persistence: "memory", authoritativeState: true, discovery: "disabled" } });
}

module.exports = { registerPlayRealtime };
