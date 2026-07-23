const { randomUUID } = require("crypto");

const DEFAULT_MAX_PLAYERS = 10;
const MIN_PLAYERS = 2;
const ROOM_IDLE_TTL = 5 * 60 * 1000;
const ROOM_NAME_MAX = 80;
const CHAT_MAX = 1200;
const STATE_MAX = 16000;
const INVITE_TTL = 24 * 60 * 60 * 1000;
const RECONNECT_TTL = 2 * 60 * 1000;
const MAX_SCORE_DELTA = 5000;
const SECRET_KEY = /password|token|secret|authorization|cookie|api[-_]?key|private[-_]?key/i;

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
  const sanitize = (input, depth = 0) => {
    if (depth > 6 || input === null || input === undefined) return input;
    if (typeof input === "string") return input.slice(0, 500);
    if (typeof input === "number") return Number.isFinite(input) ? input : 0;
    if (typeof input === "boolean") return input;
    if (Array.isArray(input)) return input.slice(0, 200).map((item) => sanitize(item, depth + 1));
    if (typeof input !== "object") return {};
    return Object.fromEntries(Object.entries(input)
      .filter(([key]) => !SECRET_KEY.test(key))
      .slice(0, 100)
      .map(([key, item]) => [String(key).slice(0, 80), sanitize(item, depth + 1)]));
  };
  if (!value || typeof value !== "object") return {};
  try {
    const sanitized = sanitize(value);
    const text = JSON.stringify(sanitized);
    if (Buffer.byteLength(text, "utf8") > max) return { truncated: true };
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function runtimeStatus() {
  const redisConfigured = Boolean(process.env.REDIS_URL || process.env.REDIS_URI || process.env.HH_REDIS_URL);
  const mongoConfigured = Boolean(process.env.MONGODB_URI);
  return {
    transport: "socket.io",
    persistence: "process-memory",
    durable: false,
    mongo: mongoConfigured ? "configured-but-not-wired" : "unavailable",
    redis: redisConfigured ? "configured-but-not-wired" : "unavailable",
    reconnect: "process-only",
    tls: Boolean(process.env.HH_SOCKET_URL || process.env.HH_REALTIME_URL || process.env.FRONTEND_URL?.startsWith("https://")),
    message: "Realtime game state is not durable until a MongoDB/Redis adapter is connected."
  };
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

function scoreRank(score) {
  if (score >= 50000) return "Huyền thoại";
  if (score >= 20000) return "Captain";
  if (score >= 10000) return "Explorer";
  if (score >= 5000) return "Phi công";
  return "Tân binh";
}

function validatedScore(member, payload = {}) {
  const current = number(member.score?.value, 0, 999999999, 0);
  const rawDelta = payload.delta ?? payload.data?.delta;
  const rawAbsolute = payload.score ?? payload.value ?? payload.data?.score;
  let next = current;
  if (rawDelta !== undefined && rawDelta !== null) {
    const delta = number(rawDelta, 0, MAX_SCORE_DELTA, -1);
    if (delta < 0) throw new Error("Score delta không hợp lệ.");
    next = current + delta;
  } else if (rawAbsolute !== undefined && rawAbsolute !== null) {
    const absolute = number(rawAbsolute, 0, 999999999, -1);
    if (absolute < current || absolute - current > MAX_SCORE_DELTA) {
      throw new Error("Score update vượt giới hạn server cho phép.");
    }
    next = absolute;
  } else {
    throw new Error("Thiếu delta score được server kiểm tra.");
  }
  return {
    value: next,
    level: Math.floor(next / 1000) + 1,
    rank: scoreRank(next),
    stats: safeJson(payload.stats || {}, 4000),
    integrity: "server-validated",
    updatedAt: Date.now()
  };
}

function publicMember(member) {
  return {
    socketId: member.socketId,
    user: member.user,
    role: member.role,
    ready: member.ready,
    score: member.score,
    state: member.state,
    spectator: Boolean(member.spectator),
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
    spectators: [...room.spectators.values()].map(publicMember),
    chat: room.chat.slice(-50),
    leaderboard: room.leaderboard.slice(0, 50),
    settings: room.settings,
    bossRaid: room.bossRaid,
    reconnectable: room.reconnects?.size || 0,
    backendStatus: room.backendStatus,
    transportSecurity: "TLS when deployed behind HTTPS/WSS",
    endToEndEncryption: false
  };
}

function createStore(options = {}) {
  return {
    rooms: new Map(),
    socketRoomById: new Map(),
    backendStatus: options.backendStatus || runtimeStatus()
  };
}

function registerGameCenterRealtime({ io, maxPlayers = Number(process.env.MAX_GAME_PLAYERS || DEFAULT_MAX_PLAYERS), store = createStore(), backendStatus = store.backendStatus || runtimeStatus() } = {}) {
  if (!io) throw new Error("Socket.IO server is required");
  const cappedMaxPlayers = Math.max(MIN_PLAYERS, Math.min(DEFAULT_MAX_PLAYERS, Number(maxPlayers || DEFAULT_MAX_PLAYERS)));
  store.backendStatus = backendStatus;

  const emitPresence = (room) => {
    if (!room) return;
    room.updatedAt = new Date().toISOString();
    io.to(socketRoom(room.code)).emit("game:room", publicRoom(room));
    io.to(socketRoom(room.code)).emit("game:presence", {
      room: room.code,
      online: room.members.size,
      spectators: room.spectators.size,
      reconnectable: room.reconnects?.size || 0,
      members: [...room.members.values()].map(publicMember),
      spectatorMembers: [...room.spectators.values()].map(publicMember),
      backendStatus: room.backendStatus,
      updatedAt: room.updatedAt
    });
  };

  const broadcastLeaderboard = (room) => {
    if (!room) return;
    room.leaderboard = [...room.members.values()]
      .map((member) => ({
        socketId: member.socketId,
        user: member.user,
        score: member.score,
        ready: member.ready,
        spectator: Boolean(member.spectator)
      }))
      .sort((a, b) => Number(b.score?.value || 0) - Number(a.score?.value || 0))
      .slice(0, 50)
      .map((item, index) => ({ position: index + 1, ...item }));
    io.to(socketRoom(room.code)).emit("game:leaderboard", { room: room.code, leaderboard: room.leaderboard, updatedAt: new Date().toISOString() });
  };

  const leaveRoom = async (socket, reason = "left") => {
    const code = store.socketRoomById.get(socket.id);
    if (!code) return;
    store.socketRoomById.delete(socket.id);
    const room = store.rooms.get(code);
    await socket.leave(socketRoom(code));
    if (!room) return;
    const member = room.members.get(socket.id) || room.spectators.get(socket.id);
    const canReconnect = reason === "disconnected" && member && !member.spectator && member.reconnectToken;
    room.members.delete(socket.id);
    room.spectators.delete(socket.id);
    if (canReconnect) {
      room.reconnects.set(member.reconnectToken, {
        ...member,
        socketId: "",
        offline: true,
        disconnectedAt: Date.now(),
        lastSeenAt: new Date().toISOString()
      });
      socket.to(socketRoom(code)).emit("game:member:offline", {
        room: code,
        user: member.user,
        reconnectable: true,
        updatedAt: new Date().toISOString()
      });
    } else if (member) {
      if (member.reconnectToken) room.reconnects.delete(member.reconnectToken);
      socket.to(socketRoom(code)).emit("game:member:left", { room: code, socketId: socket.id, user: member.user, reason, updatedAt: new Date().toISOString() });
    }
    if (!room.members.size) {
      room.status = "idle";
      const timer = setTimeout(() => {
        const current = store.rooms.get(code);
        if (current && !current.members.size && !current.reconnects.size) store.rooms.delete(code);
      }, ROOM_IDLE_TTL);
      timer.unref?.();
    }
    if (member && member.user.id === room.hostId && ![...room.members.values()].some((item) => item.user.id === room.hostId)) {
      const nextHost = room.members.values().next().value;
      if (nextHost) {
        room.hostId = nextHost.user.id;
        nextHost.role = "host";
        io.to(socketRoom(code)).emit("game:host", { room: code, hostId: room.hostId, host: nextHost.user });
      }
    }
    emitPresence(room);
    broadcastLeaderboard(room);
  };

  const joinRoom = async (socket, room, auth, payload = {}, done = () => {}) => {
    if (!room) return done({ ok: false, error: "Không tìm thấy phòng game." });
    room.reconnects ||= new Map();
    for (const [token, pending] of room.reconnects) {
      if (Date.now() - Number(pending.disconnectedAt || 0) > RECONNECT_TTL) room.reconnects.delete(token);
    }
    const spectator = Boolean(payload.spectator || payload.watch || payload.mode === "spectator");
    const reconnectToken = clean(payload.reconnectToken || auth.reconnectToken, 120);
    const recovered = reconnectToken ? room.reconnects.get(reconnectToken) : null;
    if (!spectator && room.members.size >= room.maxPlayers && !room.members.has(socket.id)) return done({ ok: false, error: "Phòng game đã đủ người." });
    const currentCode = store.socketRoomById.get(socket.id);
    if (currentCode && currentCode !== room.code) await leaveRoom(socket, "switched");
    const identity = recovered?.user || publicUser(socket, { ...auth, ...payload });
    const inviteCode = clean(payload.inviteCode || payload.invite, 80);
    const invite = inviteCode ? room.invites.get(inviteCode) : null;
    const inviteValid = room.visibility === "public"
      || identity.id === room.hostId
      || Boolean(recovered)
      || Boolean(invite && (!invite.expiresAt || invite.expiresAt > Date.now()) && (invite.gameId === room.gameId || !invite.gameId));
    if (!inviteValid && !spectator) return done({ ok: false, error: "Phòng riêng yêu cầu mã mời hợp lệ." });
    if (!inviteValid && spectator && room.visibility === "private") return done({ ok: false, error: "Khán giả cần mã mời hợp lệ." });
    const member = recovered
      ? {
        ...recovered,
        socketId: socket.id,
        role: identity.id === room.hostId ? "host" : spectator ? "spectator" : "player",
        spectator,
        offline: false,
        lastSeenAt: new Date().toISOString()
      }
      : {
        socketId: socket.id,
        user: identity,
        role: identity.id === room.hostId ? "host" : spectator ? "spectator" : "player",
        ready: false,
        score: { value: 0, level: 1, rank: "Tân binh", integrity: "server-validated", updatedAt: Date.now() },
        state: safeJson(payload.state || {}),
        spectator,
        reconnectToken: randomUUID(),
        joinedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString()
      };
    room.reconnects.delete(reconnectToken);
    (spectator ? room.spectators : room.members).set(socket.id, member);
    store.socketRoomById.set(socket.id, room.code);
    await socket.join(socketRoom(room.code));
    socket.to(socketRoom(room.code)).emit("game:member:joined", { room: room.code, member: publicMember(member) });
    emitPresence(room);
    broadcastLeaderboard(room);
    done({ ok: true, room: publicRoom(room), selfSocketId: socket.id, reconnectToken: member.reconnectToken });
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
           invites: new Map(),
           members: new Map(),
           spectators: new Map(),
           reconnects: new Map(),
           chat: [],
           leaderboard: [],
           backendStatus,
          bossRaid: { active: false, bossId: "", name: "", hp: 0, maxHp: 0, phase: "idle", participants: [], updatedAt: new Date().toISOString() },
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

    socket.on("game:room:reconnect", async (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      try {
        const code = roomCode(payload.code);
        const room = store.rooms.get(code);
        const token = clean(payload.reconnectToken || auth.reconnectToken, 120);
        if (!room?.reconnects?.has(token)) return done({ ok: false, error: "Phiên reconnect đã hết hạn hoặc không hợp lệ." });
        await joinRoom(socket, room, auth, { ...payload, reconnectToken: token }, done);
      } catch (error) {
        done({ ok: false, error: error.message || "Không thể reconnect phòng game." });
      }
    });

    socket.on("game:status", (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      done({
        ok: true,
        gameId: slug(payload.gameId),
        backendStatus,
        roomCount: store.rooms.size
      });
    });

    socket.on("game:rooms:list", (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      const gameId = slug(payload.gameId);
      const limit = Math.max(1, Math.min(50, Number(payload.limit || 30)));
      const rooms = [...store.rooms.values()]
        .filter((room) => room.visibility === "public")
        .filter((room) => !gameId || room.gameId === gameId)
        .filter((room) => room.status !== "idle" && room.members.size < room.maxPlayers)
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
        .slice(0, limit)
        .map((room) => ({
          code: room.code,
          gameId: room.gameId,
          name: room.name,
          status: room.status,
          memberCount: room.members.size,
          spectatorCount: room.spectators.size,
          maxPlayers: room.maxPlayers,
          updatedAt: room.updatedAt
        }));
      done({ ok: true, rooms, backendStatus });
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
             invites: new Map(),
             members: new Map(),
             spectators: new Map(),
             reconnects: new Map(),
             chat: [],
             leaderboard: [],
             backendStatus,
            bossRaid: { active: false, bossId: "", name: "", hp: 0, maxHp: 0, phase: "idle", participants: [], updatedAt: new Date().toISOString() },
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
      if (member.spectator) return done({ ok: false, error: "Khán giả không thể sẵn sàng." });
      member.ready = payload.ready !== false;
      member.lastSeenAt = new Date().toISOString();
      const allReady = room.members.size >= MIN_PLAYERS && [...room.members.values()].every((item) => item.ready);
      room.status = allReady ? "ready" : "waiting";
      io.to(socketRoom(room.code)).emit("game:ready", { room: room.code, socketId: socket.id, user: member.user, ready: member.ready, allReady, updatedAt: member.lastSeenAt });
      emitPresence(room);
      broadcastLeaderboard(room);
      done({ ok: true, allReady, room: publicRoom(room) });
    });

    socket.on("game:start", (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      const room = store.rooms.get(store.socketRoomById.get(socket.id));
      const member = room?.members.get(socket.id);
      if (!room || !member || member.user.id !== room.hostId) return done({ ok: false, error: "Chỉ chủ phòng được bắt đầu game." });
      if (room.members.size < MIN_PLAYERS) return done({ ok: false, error: "Cần ít nhất 2 người chơi." });
      if (![...room.members.values()].every((item) => item.ready)) return done({ ok: false, error: "Tất cả người chơi phải sẵn sàng trước khi bắt đầu." });
      room.status = "playing";
      room.seed = number(payload.seed, 0, Number.MAX_SAFE_INTEGER, Date.now());
      room.startedAt = new Date().toISOString();
      io.to(socketRoom(room.code)).emit("game:start", { room: room.code, gameId: room.gameId, seed: room.seed, startedAt: room.startedAt });
      emitPresence(room);
      broadcastLeaderboard(room);
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
      if (member.spectator) return;
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
      if (member.spectator) return done({ ok: false, error: "Khán giả không thể cập nhật điểm." });
      if (room.status !== "playing") return done({ ok: false, error: "Game chưa bắt đầu." });
      if (!rate(socket, "Score", 200)) return done({ ok: false, error: "Bạn đồng bộ điểm quá nhanh." });
      try {
        member.score = validatedScore(member, payload);
      } catch (error) {
        return done({ ok: false, error: error.message || "Score không hợp lệ." });
      }
      io.to(socketRoom(room.code)).emit("game:score", { room: room.code, socketId: socket.id, user: member.user, score: member.score });
      broadcastLeaderboard(room);
      done({ ok: true, score: member.score });
    });

    socket.on("game:ping", (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      const room = store.rooms.get(store.socketRoomById.get(socket.id));
      const member = room?.members.get(socket.id);
      if (!room || !member) return done({ ok: false, error: "Bạn chưa ở trong phòng game." });
      member.lastSeenAt = new Date().toISOString();
      done({ ok: true, now: Date.now(), room: room.code, echo: safeJson(payload.echo || {}, 512) });
    });

    socket.on("game:invite:create", (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      const room = store.rooms.get(store.socketRoomById.get(socket.id));
      const member = room?.members.get(socket.id);
      if (!room || !member || member.user.id !== room.hostId) return done({ ok: false, error: "Chỉ chủ phòng được tạo mã mời." });
      if (!rate(socket, "Invite", 500)) return done({ ok: false, error: "Bạn tạo mã mời quá nhanh." });
      const code = clean(payload.code || randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase(), 20).replace(/[^A-Z0-9]/g, "").slice(0, 12);
      const invite = {
        code,
        room: room.code,
        gameId: room.gameId,
        role: clean(payload.role || "player", 20),
        expiresAt: Date.now() + Math.max(5 * 60 * 1000, number(payload.ttl, 5 * 60 * 1000, INVITE_TTL, INVITE_TTL)),
        createdAt: new Date().toISOString(),
        createdBy: member.user
      };
      room.invites.set(code, invite);
      io.to(socketRoom(room.code)).emit("game:invite", { room: room.code, invite });
      done({ ok: true, invite });
    });

    socket.on("game:spectate:join", async (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      try {
        await joinRoom(socket, store.rooms.get(roomCode(payload.code)), auth, { ...payload, spectator: true }, done);
      } catch (error) {
        done({ ok: false, error: error.message || "Không thể vào chế độ khán giả." });
      }
    });

    socket.on("game:boss:spawn", (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      const room = store.rooms.get(store.socketRoomById.get(socket.id));
      const member = room?.members.get(socket.id);
      if (!room || !member || member.user.id !== room.hostId) return done({ ok: false, error: "Chỉ chủ phòng được triệu hồi boss." });
      const boss = {
        bossId: clean(payload.bossId || randomUUID(), 80),
        name: clean(payload.name || "Boss vũ trụ", 80),
        hp: Math.max(1, number(payload.hp, 1, 9999999, 10000)),
        maxHp: Math.max(1, number(payload.maxHp, 1, 9999999, 10000)),
        phase: clean(payload.phase || "spawn", 20),
        participants: [...room.members.values()].map((item) => item.user.id).slice(0, 10),
        updatedAt: new Date().toISOString()
      };
      room.bossRaid = { active: true, ...boss };
      io.to(socketRoom(room.code)).emit("game:boss", { room: room.code, boss: room.bossRaid });
      done({ ok: true, boss: room.bossRaid });
    });

    socket.on("game:boss:state", (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      const room = store.rooms.get(store.socketRoomById.get(socket.id));
      const member = room?.members.get(socket.id);
      if (!room || !member) return done({ ok: false, error: "Bạn chưa ở trong phòng game." });
      if (member.spectator) return done({ ok: false, error: "Khán giả chỉ được xem boss." });
      if (!rate(socket, "Boss", 80)) return done({ ok: false, error: "Boss state update quá nhanh." });
      const maxHp = Math.max(1, number(payload.maxHp, 1, 9999999, room.bossRaid.maxHp || 1));
      const damage = payload.damage === undefined ? -1 : number(payload.damage, 0, 5000, -1);
      if (damage < 0 && member.user.id !== room.hostId) return done({ ok: false, error: "Chỉ host được đặt lại trạng thái boss." });
      const hp = damage >= 0
        ? Math.max(0, number(room.bossRaid.hp, 0, maxHp, maxHp) - damage)
        : number(payload.hp, 0, maxHp, room.bossRaid.hp);
      room.bossRaid = {
        ...room.bossRaid,
        active: Boolean(payload.active ?? room.bossRaid.active),
        hp,
        maxHp,
        phase: clean(payload.phase || room.bossRaid.phase || "fight", 20),
        participants: [...room.members.values()].map((item) => item.user.id).slice(0, 10),
        updatedAt: new Date().toISOString()
      };
      io.to(socketRoom(room.code)).emit("game:boss", { room: room.code, boss: room.bossRaid });
      done({ ok: true, boss: room.bossRaid });
    });

    socket.on("game:leaderboard:sync", (payload = {}, callback) => {
      const done = typeof callback === "function" ? callback : () => {};
      const room = store.rooms.get(store.socketRoomById.get(socket.id));
      const member = room?.members.get(socket.id);
      if (!room || !member) return done({ ok: false, error: "Bạn chưa ở trong phòng game." });
      broadcastLeaderboard(room);
      done({ ok: true, leaderboard: room.leaderboard });
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
