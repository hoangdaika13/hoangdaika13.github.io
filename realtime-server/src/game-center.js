const { randomUUID } = require("crypto");

const DEFAULT_MAX_PLAYERS = 10;
const MIN_PLAYERS = 2;
const ROOM_IDLE_TTL = 5 * 60 * 1000;
const ROOM_NAME_MAX = 80;
const CHAT_MAX = 1200;
const STATE_MAX = 16000;

function clean(value, max = 2000) {
  return String(value || "").trim().slice(0, max);
}

function number(value, min = 0, max = 999999999, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function slug(value, fallback = "astra-hh") {
  return clean(value || fallback, 80).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 60) || fallback;
}

function roomCode(value) {
  return clean(value, 16).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function socketRoom(code) {
  return `game:center:${code}`;
}

function safeJson(value, max = STATE_MAX) {
  if (!value || typeof value !== "object") return {};
  try {
    const text = JSON.stringify(value);
    if (Buffer.byteLength(text, "utf8") > max) return { truncated: true };
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function publicUser(socket, auth = {}) {
  if (socket.user) {
    return {
      id: String(socket.user._id),
      name: socket.user.name || socket.user.displayName || "Người chơi HH",
      avatar: socket.user.avatar || "",
      guest: false
    };
  }
  const id = clean(auth.anonymousId, 80).replace(/[^a-zA-Z0-9_-]/g, "") || socket.id;
  return {
    id: `guest:${id}`,
    name: clean(auth.gameName || auth.playerName || auth.astraName, 40) || `Người chơi ${id.slice(-4).toUpperCase()}`,
    avatar: clean(auth.avatar, 500),
    guest: true
  };
}

function createCode(rooms) {
  let code = "";
  do code = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  while (rooms.has(code));
  return code;
}

function rate(socket, key, intervalMs) {
  const now = Date.now();
  const field = `lastGame${key}`;
  if (now - Number(socket.data[field] || 0) < intervalMs) return false;
  socket.data[field] = now;
  return true;
}

function publicMember(member) {
  return {
    socketId: member.socketId,
    user: member.user,
    role: member.role,
    ready: member.ready,
    score: member.score,
    state: member.state,
    joinedAt: member.joinedAt,
    lastSeenAt: member.lastSeenAt
  };
}

function publicRoom(room) {
  return {
    code: room.code,
    gameId: room.gameId,
    name: room.name,
    visibility: room.visibility,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    minPlayers: MIN_PLAYERS,
    status: room.status,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    members: [...room.members.values()].map(publicMember),
    chat: room.chat.slice(-50),
    settings: room.settings,
    transportSecurity: "TLS when deployed behind HTTPS/WSS",
    endToEndEncryption: false
  };
}

function createStore() {
  return {
    rooms: new Map(),
    socketRoomById: new Map()
  };
}

function registerGameCenterRealtime({ io, maxPlayers = Number(process.env.MAX_GAME_PLAYERS || DEFAULT_MAX_PLAYERS), store = createStore() } = {}) {
  if (!io) throw new Error("Socket.IO server is required");
  const cappedMaxPlayers = Math.max(MIN_PLAYERS, Math.min(DEFAULT_MAX_PLAYERS, Number(maxPlayers || DEFAULT_MAX_PLAYERS)));

  const emitPresence = (room) => {
    if (!room) return;
    room.updatedAt = new Date().toISOString();
    io.to(socketRoom(room.code)).emit("game:room", publicRoom(room));
    io.to(socketRoom(room.code)).emit("game:presence", {
      room: room.code,
      online: room.members.size,
      members: [...room.members.values()].map(publicMember),
      updatedAt: room.updatedAt
    });
  };

  const leaveRoom = async (socket, reason = "left") => {
    const code = store.socketRoomById.get(socket.id);
    if (!code) return;
    store.socketRoomById.delete(socket.id);
    const room = store.rooms.get(code);
    await socket.leave(socketRoom(code));
    if (!room) return;
    const member = room.members.get(socket.id);
    room.members.delete(socket.id);
    if (member) {
      socket.to(socketRoom(code)).emit("game:member:left", { room: code, socketId: socket.id, user: member.user, reason, updatedAt: new Date().toISOString() });
    }
    if (!room.members.size) {
      room.status = "idle";
      const timer = setTimeout(() => {
        const current = store.rooms.get(code);
        if (current && !current.members.size) store.rooms.delete(code);
      }, ROOM_IDLE_TTL);
      timer.unref?.();
      return;
    }
    if (![...room.members.values()].some((item) => item.user.id === room.hostId)) {
      const nextHost = room.members.values().next().value;
      room.hostId = nextHost.user.id;
      nextHost.role = "host";
      io.to(socketRoom(code)).emit("game:host", { room: code, hostId: room.hostId, host: nextHost.user });
    }
    emitPresence(room);
  };

  const joinRoom = async (socket, room, auth, payload = {}, done = () => {}) => {
    if (!room) return done({ ok: false, error: "Không tìm thấy phòng game." });
    if (room.members.size >= room.maxPlayers && !room.members.has(socket.id)) return done({ ok: false, error: "Phòng game đã đủ người." });
    const currentCode = store.socketRoomById.get(socket.id);
    if (currentCode && currentCode !== room.code) await leaveRoom(socket, "switched");
    const identity = publicUser(socket, { ...auth, ...payload });
    const member = {
      socketId: socket.id,
      user: identity,
      role: identity.id === room.hostId ? "host" : "player",
      ready: false,
      score: { value: 0, level: 1, rank: "Tân binh", updatedAt: Date.now() },
      state: safeJson(payload.state || {}),
      joinedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    };
    room.members.set(socket.id, member);
    store.socketRoomById.set(socket.id, room.code);
    await socket.join(socketRoom(room.code));
    socket.to(socketRoom(room.code)).emit("game:member:joined", { room: room.code, member: publicMember(member) });
    emitPresence(room);
    done({ ok: true, room: publicRoom(room), selfSocketId: socket.id });
  };

  io.on("connection", (socket) => {
    const auth = socket.handshake.auth || {};

    socket.on("game:room:create", async (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      try {
        if (!rate(socket, "Create", 1200)) return done({ ok: false, error: "Bạn tạo phòng quá nhanh." });
        const code = createCode(store.rooms);
        const identity = publicUser(socket, { ...auth, ...payload });
        const room = {
          code,
          gameId: slug(payload.gameId),
          name: clean(payload.name || `Phòng game ${code}`, ROOM_NAME_MAX),
          visibility: payload.visibility === "public" ? "public" : "private",
          hostId: identity.id,
          maxPlayers: Math.max(MIN_PLAYERS, Math.min(cappedMaxPlayers, Number(payload.maxPlayers || cappedMaxPlayers))),
          status: "waiting",
          settings: safeJson(payload.settings || {}, 8000),
          members: new Map(),
          chat: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        store.rooms.set(code, room);
        await joinRoom(socket, room, auth, payload, done);
      } catch (error) {
        done({ ok: false, error: error.message || "Không tạo được phòng game." });
      }
    });

    socket.on("game:room:join", async (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      try {
        await joinRoom(socket, store.rooms.get(roomCode(payload.code)), auth, payload, done);
      } catch (error) {
        done({ ok: false, error: error.message || "Không tham gia được phòng game." });
      }
    });

    socket.on("game:room:match", async (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      try {
        const gameId = slug(payload.gameId);
        let room = [...store.rooms.values()].find((item) => item.gameId === gameId && item.visibility === "public" && item.members.size < item.maxPlayers);
        if (!room) {
          const code = createCode(store.rooms);
          const identity = publicUser(socket, { ...auth, ...payload });
          room = {
            code,
            gameId,
            name: clean(payload.name || `Ghép trận ${gameId}`, ROOM_NAME_MAX),
            visibility: "public",
            hostId: identity.id,
            maxPlayers: Math.max(MIN_PLAYERS, Math.min(cappedMaxPlayers, Number(payload.maxPlayers || cappedMaxPlayers))),
            status: "waiting",
            settings: safeJson(payload.settings || {}, 8000),
            members: new Map(),
            chat: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          store.rooms.set(code, room);
        }
        await joinRoom(socket, room, auth, payload, done);
      } catch (error) {
        done({ ok: false, error: error.message || "Ghép trận đang lỗi." });
      }
    });

    socket.on("game:room:leave", async (_payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      await leaveRoom(socket, "left");
      done({ ok: true });
    });

    socket.on("game:ready", (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      const room = store.rooms.get(store.socketRoomById.get(socket.id));
      const member = room?.members.get(socket.id);
      if (!room || !member) return done({ ok: false, error: "Bạn chưa ở trong phòng game." });
      member.ready = payload.ready !== false;
      member.lastSeenAt = new Date().toISOString();
      const allReady = room.members.size >= MIN_PLAYERS && [...room.members.values()].every((item) => item.ready);
      room.status = allReady ? "ready" : "waiting";
      io.to(socketRoom(room.code)).emit("game:ready", { room: room.code, socketId: socket.id, user: member.user, ready: member.ready, allReady, updatedAt: member.lastSeenAt });
      emitPresence(room);
      done({ ok: true, allReady, room: publicRoom(room) });
    });

    socket.on("game:start", (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      const room = store.rooms.get(store.socketRoomById.get(socket.id));
      const member = room?.members.get(socket.id);
      if (!room || !member || member.user.id !== room.hostId) return done({ ok: false, error: "Chỉ chủ phòng được bắt đầu game." });
      if (room.members.size < MIN_PLAYERS) return done({ ok: false, error: "Cần ít nhất 2 người chơi." });
      room.status = "playing";
      room.seed = number(payload.seed, 0, Number.MAX_SAFE_INTEGER, Date.now());
      room.startedAt = new Date().toISOString();
      io.to(socketRoom(room.code)).emit("game:start", { room: room.code, gameId: room.gameId, seed: room.seed, startedAt: room.startedAt });
      emitPresence(room);
      done({ ok: true, room: publicRoom(room) });
    });

    socket.on("game:chat", (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      const room = store.rooms.get(store.socketRoomById.get(socket.id));
      const member = room?.members.get(socket.id);
      if (!room || !member) return done({ ok: false, error: "Bạn chưa ở trong phòng game." });
      if (!rate(socket, "Chat", 450)) return done({ ok: false, error: "Bạn gửi chat quá nhanh." });
      const body = clean(payload.body, CHAT_MAX);
      if (!body) return done({ ok: false, error: "Tin nhắn đang trống." });
      const message = { id: randomUUID(), room: room.code, body, type: clean(payload.type || "text", 20), user: member.user, createdAt: new Date().toISOString() };
      room.chat.push(message);
      if (room.chat.length > 100) room.chat.shift();
      io.to(socketRoom(room.code)).emit("game:chat", message);
      done({ ok: true, message });
    });

    socket.on("game:state", (payload = {}) => {
      const room = store.rooms.get(store.socketRoomById.get(socket.id));
      const member = room?.members.get(socket.id);
      if (!room || !member || !rate(socket, "State", 35)) return;
      member.state = safeJson(payload.state || payload, STATE_MAX);
      member.lastSeenAt = new Date().toISOString();
      socket.to(socketRoom(room.code)).volatile.emit("game:state", {
        room: room.code,
        socketId: socket.id,
        userId: member.user.id,
        state: member.state,
        updatedAt: member.lastSeenAt
      });
    });

    socket.on("game:score", (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      const room = store.rooms.get(store.socketRoomById.get(socket.id));
      const member = room?.members.get(socket.id);
      if (!room || !member) return done({ ok: false, error: "Bạn chưa ở trong phòng game." });
      if (!rate(socket, "Score", 200)) return done({ ok: false, error: "Bạn đồng bộ điểm quá nhanh." });
      member.score = {
        value: number(payload.score ?? payload.value),
        level: number(payload.level, 1, 9999, member.score.level || 1),
        rank: clean(payload.rank || member.score.rank || "Tân binh", 60),
        stats: safeJson(payload.stats || {}, 8000),
        updatedAt: Date.now()
      };
      io.to(socketRoom(room.code)).emit("game:score", { room: room.code, socketId: socket.id, user: member.user, score: member.score });
      done({ ok: true, score: member.score });
    });

    socket.on("game:ping", (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      const room = store.rooms.get(store.socketRoomById.get(socket.id));
      const member = room?.members.get(socket.id);
      if (!room || !member) return done({ ok: false, error: "Bạn chưa ở trong phòng game." });
      member.lastSeenAt = new Date().toISOString();
      done({ ok: true, now: Date.now(), room: room.code, echo: payload.echo || null });
    });

    socket.on("disconnect", () => {
      leaveRoom(socket, "disconnected").catch(() => {});
    });
  });

  return {
    rooms: store.rooms,
    socketRoomById: store.socketRoomById,
    publicRoom,
    leaveRoom
  };
}

module.exports = {
  createStore,
  publicRoom,
  registerGameCenterRealtime
};
