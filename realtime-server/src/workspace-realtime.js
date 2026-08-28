"use strict";

const { randomUUID } = require("crypto");

const ROOM_CODE = /^[A-Z0-9]{6,12}$/;
const RESOURCE_ID = /^[A-Za-z0-9:_-]{1,120}$/;
const MAX_EVENT_BYTES = 16 * 1024;
const MAX_STATE_BYTES = 48 * 1024;
const SERVICE_RULES = Object.freeze({
  "dharma-circle": Object.freeze({
    maxMembers: 24,
    events: new Set(["note:add", "scripture:select", "schedule:set", "reading:position"]),
    hostOnly: new Set(["scripture:select", "schedule:set"])
  }),
  "music-jam": Object.freeze({
    maxMembers: 12,
    events: new Set(["param:update", "transport:set", "note:trigger"]),
    hostOnly: new Set(["transport:set"])
  }),
  "creative-review": Object.freeze({
    maxMembers: 24,
    events: new Set(["chat", "cursor", "lock", "unlock", "change", "decision", "review"]),
    hostOnly: new Set()
  }),
  "team-board": Object.freeze({
    maxMembers: 80,
    events: new Set(["invalidate"]),
    hostOnly: new Set()
  })
});
const CREATIVE_EVENTS = Object.freeze([
  "creative:cursor", "creative:chat", "creative:lock", "creative:lock-release",
  "creative:change", "creative:change-decision", "creative:review"
]);

const clean = (value, max = 240) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const safeCode = (value) => clean(value, 12).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
const safeService = (value) => clean(value, 40).toLowerCase();
const cloneBounded = (value, maximum, code) => {
  let serialized;
  try { serialized = JSON.stringify(value == null ? {} : value); }
  catch (_) { throw Object.assign(new Error("Dữ liệu realtime không thể tuần tự hóa."), { code: `${code}_INVALID` }); }
  if (Buffer.byteLength(serialized, "utf8") > maximum) throw Object.assign(new Error("Dữ liệu realtime vượt giới hạn an toàn."), { code: `${code}_TOO_LARGE` });
  return JSON.parse(serialized);
};
const randomCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let output = "";
  for (let index = 0; index < 6; index += 1) output += alphabet[Math.floor(Math.random() * alphabet.length)];
  return output;
};
const userId = (socket) => String(socket.user?._id || socket.user?.id || "");
const publicIdentity = (socket, role = "member") => ({
  id: userId(socket),
  name: clean(socket.user?.name || socket.user?.displayName || "Thành viên HH", 80),
  avatar: clean(socket.user?.avatar, 500),
  role
});

function registerWorkspaceRealtime({ io, verifyResourceAccess, maxRooms = 500 } = {}) {
  if (!io || typeof io.on !== "function") throw new Error("Workspace realtime requires a Socket.IO server.");
  const rooms = new Map();
  const resourceRooms = new Map();
  const creativeRooms = new Map();
  const activeBySocket = new Map();
  const rate = new Map();
  const ack = (callback, payload) => { if (typeof callback === "function") callback(payload); };
  const authenticated = (socket, callback) => {
    if (userId(socket)) return true;
    ack(callback, { ok: false, error: "Chức năng realtime yêu cầu đăng nhập.", code: "AUTH_REQUIRED" });
    return false;
  };
  const allow = (socket, type, limit = 80) => {
    const key = `${socket.id}:${type}`;
    const now = Date.now();
    const record = rate.get(key) || { startedAt: now, count: 0 };
    if (now - record.startedAt >= 10_000) { record.startedAt = now; record.count = 0; }
    record.count += 1;
    rate.set(key, record);
    return record.count <= limit;
  };
  const socketRoom = (service, code) => `workspace:${service}:${code}`;
  const activeKey = (socket, service) => `${socket.id}:${service}`;
  const publicMember = (member) => ({ id: member.id, name: member.name, avatar: member.avatar, role: member.role });
  const publicRoom = (room) => ({
    code: room.code,
    service: room.service,
    name: room.name,
    revision: room.revision,
    state: room.state,
    members: [...room.members.values()].map(publicMember),
    persistence: "memory",
    authoritative: true,
    updatedAt: room.updatedAt
  });
  const emitPresence = (room) => io.to(socketRoom(room.service, room.code)).emit("workspace:room:presence", {
    service: room.service,
    code: room.code,
    revision: room.revision,
    members: [...room.members.values()].map(publicMember),
    updatedAt: room.updatedAt
  });

  const leaveRoom = async (socket, service, reason = "left") => {
    const key = activeKey(socket, service);
    const code = activeBySocket.get(key);
    if (!code) return;
    activeBySocket.delete(key);
    const room = rooms.get(`${service}:${code}`);
    await socket.leave(socketRoom(service, code));
    if (!room) return;
    const leaving = room.members.get(socket.id);
    room.members.delete(socket.id);
    if (room.hostSocketId === socket.id) {
      const next = room.members.values().next().value;
      if (next) { next.role = "host"; room.hostSocketId = next.socketId; }
    }
    room.updatedAt = new Date().toISOString();
    if (!room.members.size) {
      rooms.delete(`${service}:${code}`);
      return;
    }
    io.to(socketRoom(service, code)).emit("workspace:room:event", {
      service, code, type: "member:left", data: { memberId: leaving?.id || "", reason: clean(reason, 40) }, revision: room.revision
    });
    emitPresence(room);
  };

  const joinRoom = async (socket, room, callback, requestedAlias = "") => {
    if (!room) return ack(callback, { ok: false, error: "Không tìm thấy phòng hoặc phòng đã đóng.", code: "ROOM_NOT_FOUND" });
    const rules = SERVICE_RULES[room.service];
    if (room.members.size >= rules.maxMembers && !room.members.has(socket.id)) return ack(callback, { ok: false, error: "Phòng đã đủ thành viên.", code: "ROOM_FULL" });
    await leaveRoom(socket, room.service, "switched");
    const identity = publicIdentity(socket, socket.id === room.hostSocketId ? "host" : "member");
    const member = {
      ...identity,
      id: `member:${randomUUID()}`,
      name: room.service === "dharma-circle" ? (clean(requestedAlias, 40) || "Thành viên ẩn danh") : identity.name,
      avatar: room.service === "dharma-circle" ? "" : identity.avatar,
      socketId: socket.id
    };
    room.members.set(socket.id, member);
    activeBySocket.set(activeKey(socket, room.service), room.code);
    room.updatedAt = new Date().toISOString();
    await socket.join(socketRoom(room.service, room.code));
    emitPresence(room);
    ack(callback, { ok: true, room: publicRoom(room), self: publicMember(member) });
  };

  const applyStateEvent = (room, type, data) => {
    if (room.service === "dharma-circle") {
      if (type === "note:add") room.state.sharedNotes = [...(Array.isArray(room.state.sharedNotes) ? room.state.sharedNotes : []), data].slice(-100);
      if (type === "scripture:select") room.state.scriptureId = clean(data.scriptureId, 120);
      if (type === "schedule:set") room.state.discussionAt = clean(data.discussionAt, 80);
      if (type === "reading:position") room.state.readingPosition = { ...(room.state.readingPosition || {}), [clean(data.memberId, 80)]: clean(data.segmentId, 120) };
    }
    if (room.service === "music-jam") {
      if (type === "param:update") room.state.jam = { ...(room.state.jam || {}), ...(data.jam || {}) };
      if (type === "transport:set") room.state.transport = { playing: data.playing === true, startedAt: Number(data.startedAt) || Date.now(), step: Math.max(0, Math.min(1_000_000, Number(data.step) || 0)) };
    }
  };

  const normalizeWorkspaceEvent = (service, type, data, member) => {
    if (service === "dharma-circle") {
      if (type === "note:add") return { id: randomUUID(), alias: member.name, body: clean(data.body, 2000), createdAt: new Date().toISOString() };
      if (type === "scripture:select") return { scriptureId: clean(data.scriptureId, 120) };
      if (type === "schedule:set") return { discussionAt: clean(data.discussionAt, 80) };
      if (type === "reading:position") return { memberId: member.id, segmentId: clean(data.segmentId, 120) };
    }
    if (service === "music-jam") {
      if (type === "param:update") {
        const input = data.jam && typeof data.jam === "object" ? data.jam : {};
        const jam = {};
        for (const key of ["density", "brightness", "groove", "tension"]) if (key in input) jam[key] = Math.max(0, Math.min(100, Number(input[key]) || 0));
        if ("bpm" in input) jam.bpm = Math.round(Math.max(45, Math.min(200, Number(input.bpm) || 96)));
        if (["C minor", "D minor", "E minor", "F major", "G major", "A minor"].includes(input.key)) jam.key = input.key;
        if (["glass", "bass", "pluck", "pad"].includes(input.instrument)) jam.instrument = input.instrument;
        if (["dreamy", "calm", "hopeful", "dark", "energetic"].includes(input.mood)) jam.mood = input.mood;
        return { jam };
      }
      if (type === "transport:set") return { playing: data.playing === true, startedAt: Date.now(), step: Math.max(0, Math.min(1_000_000, Number(data.step) || 0)) };
      if (type === "note:trigger") return { step: Math.max(0, Math.min(1_000_000, Number(data.step) || 0)) };
    }
    return data;
  };

  const leaveResource = async (socket, service, resourceId) => {
    const key = `${service}:${resourceId}`;
    const room = resourceRooms.get(key);
    await socket.leave(socketRoom(service, resourceId));
    room?.members.delete(socket.id);
    if (room && !room.members.size) resourceRooms.delete(key);
  };

  const leaveCreative = async (socket, reason = "left") => {
    const projectId = socket.data?.creativeProjectId;
    if (!projectId) return;
    const room = creativeRooms.get(projectId);
    socket.data.creativeProjectId = "";
    await socket.leave(`creative:${projectId}`);
    room?.delete(socket.id);
    if (!room?.size) creativeRooms.delete(projectId);
    else io.to(`creative:${projectId}`).emit("creative:presence", { user: publicIdentity(socket), online: false, reason: clean(reason, 40) });
  };

  io.on("connection", (socket) => {
    socket.on("workspace:room:create", async (payload = {}, callback) => {
      if (!authenticated(socket, callback) || !allow(socket, "workspace:create", 10)) return;
      const service = safeService(payload.service);
      const rules = SERVICE_RULES[service];
      if (!rules || service === "team-board") return ack(callback, { ok: false, error: "Dịch vụ phòng không hợp lệ.", code: "SERVICE_REJECTED" });
      if (rooms.size >= Math.max(1, Math.min(2000, Number(maxRooms) || 500))) return ack(callback, { ok: false, error: "Máy chủ đang đạt giới hạn phòng.", code: "ROOM_LIMIT" });
      let code = randomCode();
      while (rooms.has(`${service}:${code}`)) code = randomCode();
      let state;
      try { state = cloneBounded(payload.state, MAX_STATE_BYTES, "STATE"); }
      catch (error) { return ack(callback, { ok: false, error: error.message, code: error.code }); }
      const room = {
        id: randomUUID(), code, service, name: clean(payload.name || "Phòng HH", 100) || "Phòng HH",
        hostSocketId: socket.id, members: new Map(), state, revision: 0,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      rooms.set(`${service}:${code}`, room);
      await joinRoom(socket, room, callback, payload.alias);
    });

    socket.on("workspace:room:join", async (payload = {}, callback) => {
      if (!authenticated(socket, callback) || !allow(socket, "workspace:join", 30)) return;
      const service = safeService(payload.service);
      const code = safeCode(payload.code);
      if (!SERVICE_RULES[service] || !ROOM_CODE.test(code)) return ack(callback, { ok: false, error: "Mã phòng không hợp lệ.", code: "ROOM_CODE_INVALID" });
      await joinRoom(socket, rooms.get(`${service}:${code}`), callback, payload.alias);
    });

    socket.on("workspace:room:leave", async (payload = {}, callback) => {
      const service = safeService(payload.service);
      if (SERVICE_RULES[service]) await leaveRoom(socket, service, "left");
      ack(callback, { ok: true });
    });

    socket.on("workspace:room:state", (payload = {}, callback) => {
      if (!authenticated(socket, callback) || !allow(socket, "workspace:state", 40)) return;
      const service = safeService(payload.service);
      const code = activeBySocket.get(activeKey(socket, service));
      const room = rooms.get(`${service}:${code}`);
      const member = room?.members.get(socket.id);
      if (!room || !member) return ack(callback, { ok: false, error: "Bạn chưa ở trong phòng.", code: "NOT_IN_ROOM" });
      if (member.role !== "host") return ack(callback, { ok: false, error: "Chỉ chủ phòng được thay đổi trạng thái chung.", code: "HOST_REQUIRED" });
      try { room.state = cloneBounded(payload.state, MAX_STATE_BYTES, "STATE"); }
      catch (error) { return ack(callback, { ok: false, error: error.message, code: error.code }); }
      room.revision += 1; room.updatedAt = new Date().toISOString();
      io.to(socketRoom(service, code)).emit("workspace:room:state", { service, code, state: room.state, revision: room.revision, updatedAt: room.updatedAt });
      ack(callback, { ok: true, revision: room.revision });
    });

    socket.on("workspace:room:event", (payload = {}, callback) => {
      if (!authenticated(socket, callback) || !allow(socket, "workspace:event", 160)) return;
      const service = safeService(payload.service);
      const rules = SERVICE_RULES[service];
      const code = activeBySocket.get(activeKey(socket, service));
      const room = rooms.get(`${service}:${code}`);
      const member = room?.members.get(socket.id);
      const type = clean(payload.type, 40);
      if (!room || !member) return ack(callback, { ok: false, error: "Bạn chưa ở trong phòng.", code: "NOT_IN_ROOM" });
      if (!rules?.events.has(type)) return ack(callback, { ok: false, error: "Sự kiện không nằm trong danh sách cho phép.", code: "EVENT_REJECTED" });
      if (rules.hostOnly.has(type) && member.role !== "host") return ack(callback, { ok: false, error: "Chỉ chủ phòng được thực hiện thao tác này.", code: "HOST_REQUIRED" });
      let data;
      try { data = cloneBounded(payload.data, MAX_EVENT_BYTES, "EVENT"); }
      catch (error) { return ack(callback, { ok: false, error: error.message, code: error.code }); }
      data = normalizeWorkspaceEvent(service, type, data, member);
      if (service === "dharma-circle" && type === "note:add" && !data.body) return ack(callback, { ok: false, error: "Ghi chú chia sẻ đang trống.", code: "NOTE_REQUIRED" });
      applyStateEvent(room, type, data);
      room.revision += 1; room.updatedAt = new Date().toISOString();
      const event = { service, code, type, data, actor: publicMember(member), revision: room.revision, updatedAt: room.updatedAt };
      const channel = type === "param:update" || type === "cursor" ? socket.to(socketRoom(service, code)).volatile : socket.to(socketRoom(service, code));
      channel.emit("workspace:room:event", event);
      ack(callback, { ok: true, data, revision: room.revision, updatedAt: room.updatedAt });
    });

    socket.on("workspace:resource:join", async (payload = {}, callback) => {
      if (!authenticated(socket, callback) || !allow(socket, "resource:join", 30)) return;
      const service = safeService(payload.service);
      const resourceId = clean(payload.resourceId, 120);
      if (service !== "team-board" || !RESOURCE_ID.test(resourceId)) return ack(callback, { ok: false, error: "Tài nguyên realtime không hợp lệ.", code: "RESOURCE_REJECTED" });
      let access = null;
      try { access = await verifyResourceAccess?.({ service, resourceId, user: socket.user, socket }); }
      catch (_) { return ack(callback, { ok: false, error: "Không thể xác minh quyền truy cập realtime.", code: "ACCESS_UNAVAILABLE" }); }
      if (!access) return ack(callback, { ok: false, error: "Bạn chưa có quyền truy cập tài nguyên này.", code: "ACCESS_DENIED" });
      const key = `${service}:${resourceId}`;
      const room = resourceRooms.get(key) || { service, resourceId, revision: 0, members: new Map(), updatedAt: new Date().toISOString() };
      room.members.set(socket.id, { ...publicIdentity(socket, clean(access.role || "member", 20)), socketId: socket.id });
      room.updatedAt = new Date().toISOString();
      resourceRooms.set(key, room);
      await socket.join(socketRoom(service, resourceId));
      ack(callback, { ok: true, resourceId, service, revision: room.revision, role: clean(access.role || "member", 20), persistence: "mongodb-source" });
    });

    socket.on("workspace:resource:event", async (payload = {}, callback) => {
      if (!authenticated(socket, callback) || !allow(socket, "resource:event", 100)) return;
      const service = safeService(payload.service);
      const resourceId = clean(payload.resourceId, 120);
      const key = `${service}:${resourceId}`;
      const room = resourceRooms.get(key);
      if (service !== "team-board" || !room?.members.has(socket.id) || clean(payload.type, 40) !== "invalidate") return ack(callback, { ok: false, error: "Sự kiện tài nguyên không hợp lệ.", code: "RESOURCE_EVENT_REJECTED" });
      let data;
      try { data = cloneBounded(payload.data, 2048, "EVENT"); }
      catch (error) { return ack(callback, { ok: false, error: error.message, code: error.code }); }
      room.revision += 1; room.updatedAt = new Date().toISOString();
      socket.to(socketRoom(service, resourceId)).emit("workspace:resource:event", { service, resourceId, type: "invalidate", data, revision: room.revision, updatedAt: room.updatedAt });
      ack(callback, { ok: true, revision: room.revision });
    });

    socket.on("workspace:resource:leave", async (payload = {}, callback) => {
      const service = safeService(payload.service);
      const resourceId = clean(payload.resourceId, 120);
      if (service === "team-board" && RESOURCE_ID.test(resourceId)) await leaveResource(socket, service, resourceId);
      ack(callback, { ok: true });
    });

    socket.on("creative:join", async (payload = {}, callback) => {
      if (!authenticated(socket, callback) || !allow(socket, "creative:join", 30)) return;
      const projectId = clean(payload.projectId, 120);
      if (!RESOURCE_ID.test(projectId) || projectId === "creative-main") return ack(callback, { ok: false, error: "Dự án Creative cần ID riêng hợp lệ.", code: "PROJECT_ID_REQUIRED" });
      await leaveCreative(socket, "switched");
      const members = creativeRooms.get(projectId) || new Map();
      const identity = publicIdentity(socket, members.size ? "collaborator" : "host");
      members.set(socket.id, { ...identity, socketId: socket.id });
      creativeRooms.set(projectId, members);
      socket.data = socket.data || {};
      socket.data.creativeProjectId = projectId;
      await socket.join(`creative:${projectId}`);
      socket.to(`creative:${projectId}`).emit("creative:presence", { projectId, user: identity, online: true });
      ack(callback, { ok: true, projectId, self: identity, members: [...members.values()].map(publicMember), persistence: "memory" });
    });

    socket.on("creative:leave", async (_payload = {}, callback) => { await leaveCreative(socket, "left"); ack(callback, { ok: true }); });
    for (const eventName of CREATIVE_EVENTS) {
      socket.on(eventName, (payload = {}, callback) => {
        if (!authenticated(socket, callback) || !allow(socket, eventName, eventName === "creative:cursor" ? 240 : 100)) return;
        const projectId = clean(payload.projectId, 120);
        if (!projectId || socket.data?.creativeProjectId !== projectId || !creativeRooms.get(projectId)?.has(socket.id)) return ack(callback, { ok: false, error: "Bạn chưa tham gia dự án Creative này.", code: "NOT_IN_PROJECT" });
        let data;
        try { data = cloneBounded(payload.payload, MAX_EVENT_BYTES, "EVENT"); }
        catch (error) { return ack(callback, { ok: false, error: error.message, code: error.code }); }
        const outbound = { projectId, user: publicIdentity(socket), payload: data, eventId: randomUUID(), updatedAt: new Date().toISOString() };
        const channel = eventName === "creative:cursor" ? socket.to(`creative:${projectId}`).volatile : socket.to(`creative:${projectId}`);
        channel.emit(eventName, outbound);
        ack(callback, { ok: true, eventId: outbound.eventId });
      });
    }

    socket.on("disconnect", () => {
      for (const service of Object.keys(SERVICE_RULES)) void leaveRoom(socket, service, "disconnect");
      resourceRooms.forEach((room) => { if (room.members.has(socket.id)) void leaveResource(socket, room.service, room.resourceId); });
      void leaveCreative(socket, "disconnect");
      rate.forEach((_value, key) => { if (key.startsWith(`${socket.id}:`)) rate.delete(key); });
    });
  });

  return Object.freeze({
    rooms,
    resourceRooms,
    creativeRooms,
    capabilities: Object.freeze({
      protocol: "hh-workspace-realtime-v1",
      authenticatedOnly: true,
      roomDiscovery: "disabled",
      roomPersistence: "memory",
      services: Object.keys(SERVICE_RULES)
    })
  });
}

module.exports = { registerWorkspaceRealtime, SERVICE_RULES };
