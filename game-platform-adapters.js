(function () {
  "use strict";

  const MAX_BODY = 128 * 1024;

  function clean(value, max = 180) {
    return String(value == null ? "" : value).trim().slice(0, max);
  }

  function apiUrl(apiBase, query) {
    const base = String(apiBase || window.HH_REALTIME_URL || location.origin).replace(/\/$/, "");
    const params = new URLSearchParams({ service: "games", ...query });
    return `${base}/api/social?${params.toString()}`;
  }

  function bodySize(payload) {
    try {
      return new Blob([JSON.stringify(payload || {})]).size;
    } catch {
      return MAX_BODY + 1;
    }
  }

  async function request(apiBase, method, query, body, anonymousId) {
    if (bodySize(body) > MAX_BODY) throw new Error("Dữ liệu game vượt quá giới hạn cho phép.");
    const token = window.HHAuthSession?.token?.() || "";
    const headers = {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-HH-Anonymous-Id": clean(anonymousId, 120)
    };
    const response = await fetch(apiUrl(apiBase, query), {
      method,
      headers,
      credentials: "include",
      cache: "no-store",
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Game API lỗi HTTP ${response.status}.`);
    return payload;
  }

  function durable(payload) {
    return payload?.persistence === true || payload?.backend === "mongodb" || payload?.backend === "mongodb-or-memory-fallback";
  }

  function confirmed(payload, provider, requireDurable = false) {
    const isDurable = durable(payload);
    return {
      confirmed: Boolean(payload?.ok !== false && (!requireDurable || isDurable)),
      connected: payload?.ok !== false,
      durable: isDurable,
      provider,
      backend: payload?.backend || "unknown"
    };
  }

  function waitForSocket(getSocket, timeoutMs = 6000) {
    const current = getSocket();
    if (current?.connected) return Promise.resolve(current);
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        const socket = getSocket();
        if (socket?.connected) {
          clearInterval(timer);
          resolve(socket);
        } else if (Date.now() - started >= timeoutMs) {
          clearInterval(timer);
          reject(new Error("Realtime server chưa kết nối."));
        }
      }, 100);
    });
  }

  function emitAck(socket, event, payload) {
    return new Promise((resolve, reject) => {
      if (!socket?.connected) return reject(new Error("Realtime server chưa kết nối."));
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value || {});
      };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("Realtime server không phản hồi."));
      }, 8000);
      socket.emit(event, payload, (value) => {
        clearTimeout(timer);
        finish(value);
      });
    });
  }

  function roomResult(response, provider = "Socket.io") {
    const room = response?.room || {};
    return {
      ...response,
      confirmed: response?.ok === true,
      connected: response?.ok === true,
      durable: response?.ok === true,
      provider,
      roomCode: clean(room.code || response.roomCode, 20).toUpperCase(),
      gameId: clean(room.gameId || response.gameId, 80),
      status: clean(room.status || response.status || "waiting", 30),
      members: Array.isArray(room.members) ? room.members.slice(0, 10) : []
    };
  }

  function slotFromKey(key, fallback = "main") {
    const match = clean(key, 180).match(/(slot-[123])$/);
    return match ? match[1].replace("-", "") : fallback;
  }

  function create(options = {}) {
    const apiBase = options.apiBase || window.HH_REALTIME_URL || location.origin;
    const anonymousId = options.anonymousId || window.HHAnonymousId || `guest-${Math.random().toString(36).slice(2, 10)}`;
    const getSocket = () => options.socket || window.HHRealtimeSocket;

    const cloudAdapter = {
      async connect() {
        const payload = await request(apiBase, "GET", { resource: "catalog" }, null, anonymousId);
        return { ...confirmed(payload, "HH Game API", true), games: payload.games || [] };
      },
      async load() {
        const payload = await request(apiBase, "GET", { resource: "cloud-save", gameId: "game-center", slot: "slot1" }, null, anonymousId);
        return { ...confirmed(payload, "HH Game API", true), data: payload.item?.data || null, item: payload.item || null };
      },
      async save({ key, data, version = 1 }) {
        const slot = slotFromKey(key, "slot1");
        const payload = await request(apiBase, "POST", { resource: "cloud-save", gameId: "game-center" }, {
          anonymousId,
          slot,
          version,
          checkpointId: `game-center-${slot}`,
          checkpointLabel: slot === "slot1" && !key ? "Game Center autosave" : `Game Center ${slot}`,
          data
        }, anonymousId);
        return { ...confirmed(payload, "HH Game API", true), item: payload.item || null };
      },
      async delete({ key } = {}) {
        const slot = slotFromKey(key, "slot1");
        const payload = await request(apiBase, "DELETE", { resource: "cloud-save", gameId: "game-center", slot }, null, anonymousId);
        return { ...confirmed(payload, "HH Game API", true), deleted: payload.deleted === true };
      },
      async leaderboard({ season = "local-season", limit = 50 } = {}) {
        const payload = await request(apiBase, "GET", {
          resource: "leaderboard",
          gameId: "astra-hh",
          season: clean(season, 40),
          limit: String(Math.min(100, Math.max(1, Number(limit) || 50)))
        }, null, anonymousId);
        return {
          ...confirmed(payload, "HH Game API", true),
          label: "Bảng xếp hạng server",
          entries: (payload.items || []).map((item) => ({
            name: item.player?.name || "Người chơi HH",
            level: item.level || 1,
            xp: item.score || 0,
            game: "ASTRA MMO RPG",
            gameId: "astra-hh"
          }))
        };
      }
    };

    const realtimeAdapter = {
      async connect() {
        const socket = await waitForSocket(getSocket);
        return { confirmed: true, connected: true, durable: true, provider: "Socket.io", socketId: socket.id };
      },
      async listFriends({ limit = 100 } = {}) {
        const payload = await request(apiBase, "GET", { resource: "friends", limit: String(Math.min(200, limit)) }, null, anonymousId);
        const source = payload.friends || [];
        return {
          ...confirmed(payload, "HH Game API", true),
          items: source.slice(0, limit).map((friend) => ({
            id: friend.friendKey || friend.userKey,
            name: friend.friendName || friend.name || "Bạn HH",
            status: friend.status || "accepted",
            online: false
          }))
        };
      },
      async listLobbies({ gameId = "", limit = 30 } = {}) {
        const socket = await waitForSocket(getSocket);
        const response = await emitAck(socket, "game:rooms:list", {
          gameId: clean(gameId, 80),
          limit: Math.min(50, Math.max(1, Number(limit) || 30))
        });
        if (response?.ok !== true) throw new Error(response?.error || "Không tải được danh sách lobby.");
        return {
          confirmed: true,
          connected: true,
          durable: true,
          provider: "Socket.io",
          backendStatus: response.backendStatus || null,
          items: (response.rooms || []).map((room) => ({
            id: clean(room.code, 20),
            roomCode: clean(room.code, 20).toUpperCase(),
            gameId: clean(room.gameId, 80),
            title: clean(room.name || "Phòng HH", 80),
            status: clean(room.status || "waiting", 30),
            members: Number(room.memberCount || room.members?.length || 0),
            capacity: Number(room.maxPlayers || 10)
          }))
        };
      },
      async createParty({ gameId = "astra-hh", player = {} } = {}) {
        const socket = await waitForSocket(getSocket);
        const response = await emitAck(socket, "game:room:create", {
          gameId,
          name: `Phòng ${clean(player.name || "HH", 40)}`,
          visibility: "public",
          maxPlayers: 10,
          gameName: clean(player.name, 80),
          anonymousId
        });
        return roomResult(response);
      },
      async joinParty({ roomCode } = {}) {
        const socket = await waitForSocket(getSocket);
        return roomResult(await emitAck(socket, "game:room:join", { code: clean(roomCode, 20).toUpperCase(), anonymousId }));
      },
      async spectate({ roomCode } = {}) {
        const socket = await waitForSocket(getSocket);
        return roomResult(await emitAck(socket, "game:spectate:join", { code: clean(roomCode, 20).toUpperCase(), anonymousId }));
      },
      async leaveParty({ roomCode } = {}) {
        const socket = await waitForSocket(getSocket);
        return { ...(await emitAck(socket, "game:room:leave", { code: clean(roomCode, 20).toUpperCase() })), confirmed: true, connected: true, durable: true, provider: "Socket.io" };
      }
    };

    return { cloudAdapter, realtimeAdapter };
  }

  window.HHGameAdapters = { create };
})();
