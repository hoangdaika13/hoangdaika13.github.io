(() => {
  "use strict";

  const rootScope = typeof window !== "undefined" ? window : globalThis;
  const STORAGE_KEY = "hh.communication.messenger.v1";
  const PAGE_SIZE = 24;
  const EDIT_WINDOW_MS = 15 * 60 * 1000;
  const instances = new WeakMap();

  const uid = (prefix = "id") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const nowIso = () => new Date().toISOString();
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
  const cleanText = (value, limit = 2000) => String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, limit);
  const safeUrl = (value) => {
    try {
      const url = new URL(String(value || ""), rootScope.location?.href || "https://hh.local/");
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function seedState() {
    const stamp = Date.now();
    return {
      version: 1,
      viewer: { id: "me", name: "Bạn", avatar: "HH", status: "offline", lastActive: nowIso() },
      activeRoomId: "dm-hoang",
      roomFilter: "active",
      rooms: [
        { id: "dm-hoang", kind: "direct", name: "Hoàng Đại Ka", avatar: "HK", unread: 2, muted: false, archived: false, blocked: false, markedUnread: false, lastActive: new Date(stamp - 120000).toISOString(), members: [{ id: "me", name: "Bạn", role: "member" }, { id: "hoang", name: "Hoàng Đại Ka", role: "member" }] },
        { id: "group-creative", kind: "group", name: "HH Creative Room", avatar: "CR", unread: 0, muted: false, archived: false, blocked: false, markedUnread: false, lastActive: new Date(stamp - 450000).toISOString(), members: [{ id: "me", name: "Bạn", role: "owner" }, { id: "linh", name: "Linh Design", role: "admin" }, { id: "minh", name: "Minh Audio", role: "member" }] }
      ],
      messages: {
        "dm-hoang": [
          { id: "m-welcome-1", roomId: "dm-hoang", author: { id: "hoang", name: "Hoàng Đại Ka", avatar: "HK" }, text: "Chào bạn, đây là Messenger HH. Tin nhắn này đang được lưu cục bộ cho tới khi máy chủ kết nối.", kind: "text", createdAt: new Date(stamp - 300000).toISOString(), status: "read", reactions: { love: 1 }, pinned: false, deletedFor: [] },
          { id: "m-welcome-2", roomId: "dm-hoang", author: { id: "me", name: "Bạn", avatar: "HH" }, text: "Mình đã nhận được. Khi Socket.IO trực tuyến, trạng thái sẽ được đồng bộ theo thời gian thực.", kind: "text", createdAt: new Date(stamp - 180000).toISOString(), status: "read", reactions: {}, pinned: false, deletedFor: [] }
        ],
        "group-creative": [
          { id: "m-group-1", roomId: "group-creative", author: { id: "linh", name: "Linh Design", avatar: "LD" }, text: "Nhóm dùng để chia sẻ thiết kế, lịch hẹn và bình chọn.", kind: "text", createdAt: new Date(stamp - 600000).toISOString(), status: "delivered", reactions: {}, pinned: true, deletedFor: [] }
        ]
      },
      preferences: { sound: true, readReceipts: true, ephemeralSeconds: 0 },
      reports: [],
      drafts: {}
    };
  }

  function normalizeState(input) {
    const seed = seedState();
    const value = input && typeof input === "object" ? input : {};
    const rooms = Array.isArray(value.rooms) ? value.rooms.filter((room) => room && room.id).map((room) => ({
      kind: "direct", unread: 0, muted: false, archived: false, blocked: false, markedUnread: false, members: [], ...room,
      id: cleanText(room.id, 80), name: cleanText(room.name, 80) || "Cuộc trò chuyện", avatar: cleanText(room.avatar, 8) || "HH",
      members: Array.isArray(room.members) ? room.members.map((member) => ({ id: cleanText(member.id, 80), name: cleanText(member.name, 80) || "Thành viên", role: ["owner", "admin", "member"].includes(member.role) ? member.role : "member" })) : []
    })) : seed.rooms;
    const messages = {};
    rooms.forEach((room) => {
      const source = Array.isArray(value.messages?.[room.id]) ? value.messages[room.id] : seed.messages[room.id] || [];
      messages[room.id] = source.slice(-500).map((message) => ({ reactions: {}, deletedFor: [], status: "local", pinned: false, ...message, id: cleanText(message.id, 100) || uid("msg"), roomId: room.id, text: cleanText(message.text, 4000), status: ["local", "pending", "sent", "delivered", "read", "failed"].includes(message.status) ? message.status : "local" }));
    });
    return {
      version: 1,
      viewer: { ...seed.viewer, ...(value.viewer || {}), status: "offline" },
      activeRoomId: rooms.some((room) => room.id === value.activeRoomId) ? value.activeRoomId : rooms[0]?.id || "",
      roomFilter: ["active", "unread", "groups", "archived"].includes(value.roomFilter) ? value.roomFilter : "active",
      rooms,
      messages,
      preferences: { ...seed.preferences, ...(value.preferences || {}) },
      reports: Array.isArray(value.reports) ? value.reports.slice(-100) : [],
      drafts: value.drafts && typeof value.drafts === "object" ? value.drafts : {}
    };
  }

  function createStore(storage = rootScope.localStorage) {
    let state;
    try { state = normalizeState(JSON.parse(storage?.getItem(STORAGE_KEY) || "null")); }
    catch { state = normalizeState(null); }
    const save = () => {
      try { storage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Storage can be unavailable. */ }
      return state;
    };
    const room = (roomId = state.activeRoomId) => state.rooms.find((item) => item.id === roomId) || null;
    const message = (roomId, messageId) => (state.messages[roomId] || []).find((item) => item.id === messageId) || null;
    return {
      snapshot: () => clone(state),
      room,
      setActive(roomId) { if (room(roomId)) { state.activeRoomId = roomId; const active = room(roomId); active.unread = 0; active.markedUnread = false; save(); } return room(roomId); },
      setFilter(filter) { state.roomFilter = ["active", "unread", "groups", "archived"].includes(filter) ? filter : "active"; save(); },
      listRooms(query = "") {
        const term = cleanText(query, 100).toLocaleLowerCase("vi");
        return state.rooms.filter((item) => {
          if (state.roomFilter === "active" && item.archived) return false;
          if (state.roomFilter === "unread" && !(item.unread || item.markedUnread)) return false;
          if (state.roomFilter === "groups" && item.kind !== "group") return false;
          if (state.roomFilter === "archived" && !item.archived) return false;
          return !term || `${item.name} ${(state.messages[item.id] || []).at(-1)?.text || ""}`.toLocaleLowerCase("vi").includes(term);
        }).sort((a, b) => String(b.lastActive || "").localeCompare(String(a.lastActive || "")));
      },
      page(roomId, before = "", limit = PAGE_SIZE, query = "") {
        const hiddenFor = state.viewer.id;
        const term = cleanText(query, 100).toLocaleLowerCase("vi");
        let items = (state.messages[roomId] || []).filter((item) => !(item.deletedFor || []).includes(hiddenFor));
        if (term) items = items.filter((item) => `${item.text} ${item.author?.name || ""} ${item.file?.name || ""}`.toLocaleLowerCase("vi").includes(term));
        if (before) {
          const index = items.findIndex((item) => item.id === before);
          if (index >= 0) items = items.slice(0, index);
        }
        const page = items.slice(-Math.max(1, Math.min(50, Number(limit) || PAGE_SIZE)));
        return { items: clone(page), cursor: page[0]?.id || "", hasMore: items.length > page.length, total: items.length };
      },
      createRoom(values = {}) {
        const members = Array.isArray(values.members) ? values.members : [];
        const created = { id: uid("room"), kind: "group", name: cleanText(values.name, 80) || "Nhóm mới", avatar: cleanText(values.avatar, 8) || "GR", unread: 0, muted: false, archived: false, blocked: false, markedUnread: false, lastActive: nowIso(), members: [{ id: state.viewer.id, name: state.viewer.name, role: "owner" }, ...members.filter((member) => member.id !== state.viewer.id).map((member) => ({ id: cleanText(member.id, 80), name: cleanText(member.name, 80), role: "member" }))] };
        state.rooms.unshift(created); state.messages[created.id] = []; state.activeRoomId = created.id; save(); return clone(created);
      },
      updateRoom(roomId, patch = {}) {
        const target = room(roomId); if (!target) return null;
        ["muted", "archived", "blocked", "markedUnread"].forEach((key) => { if (typeof patch[key] === "boolean") target[key] = patch[key]; });
        if (patch.name) target.name = cleanText(patch.name, 80);
        if (patch.avatar) target.avatar = cleanText(patch.avatar, 8);
        if (patch.ephemeralSeconds !== undefined) target.ephemeralSeconds = Math.max(0, Number(patch.ephemeralSeconds) || 0);
        save(); return clone(target);
      },
      setMember(roomId, values = {}) {
        const target = room(roomId); if (!target || target.kind !== "group") return null;
        const memberId = cleanText(values.id, 80); const existing = target.members.find((item) => item.id === memberId);
        if (values.remove) target.members = target.members.filter((item) => item.id !== memberId || item.role === "owner");
        else if (existing) existing.role = ["admin", "member"].includes(values.role) ? values.role : existing.role;
        else target.members.push({ id: memberId || uid("member"), name: cleanText(values.name, 80) || "Thành viên mới", role: "member" });
        save(); return clone(target);
      },
      leaveRoom(roomId) {
        const target = room(roomId); if (!target || target.kind !== "group") return false;
        target.members = target.members.filter((member) => member.id !== state.viewer.id); target.archived = true;
        state.activeRoomId = state.rooms.find((item) => !item.archived && item.id !== roomId)?.id || roomId; save(); return true;
      },
      addMessage(roomId, values = {}) {
        const target = room(roomId); if (!target || target.blocked) return null;
        const createdAt = nowIso();
        const created = {
          id: cleanText(values.id, 100) || uid("msg"), roomId, author: clone(values.author || state.viewer), text: cleanText(values.text, 4000), kind: cleanText(values.kind, 30) || "text", attachmentUrl: safeUrl(values.attachmentUrl), file: values.file ? { name: cleanText(values.file.name, 160), size: Math.max(0, Number(values.file.size) || 0), type: cleanText(values.file.type, 100), dataUrl: String(values.file.dataUrl || "").slice(0, 1800000) } : null,
          location: values.location || null, poll: values.poll || null, event: values.event || null, sticker: cleanText(values.sticker, 20), gifUrl: safeUrl(values.gifUrl), replyTo: values.replyTo || null, forwardedFrom: values.forwardedFrom || null,
          createdAt, editedAt: null, status: ["pending", "sent", "delivered", "read"].includes(values.status) ? values.status : "local", reactions: {}, pinned: false, deletedFor: [], expiresAt: values.ephemeralSeconds ? new Date(Date.now() + Number(values.ephemeralSeconds) * 1000).toISOString() : null
        };
        (state.messages[roomId] ||= []).push(created); target.lastActive = createdAt; state.drafts[roomId] = ""; save(); return clone(created);
      },
      editMessage(roomId, messageId, text) {
        const target = message(roomId, messageId); if (!target || target.author?.id !== state.viewer.id || Date.now() - Date.parse(target.createdAt) > EDIT_WINDOW_MS || target.recalled) return null;
        target.text = cleanText(text, 4000); target.editedAt = nowIso(); save(); return clone(target);
      },
      mutateMessage(roomId, messageId, action, value) {
        const target = message(roomId, messageId); if (!target) return null;
        if (action === "reaction") target.reactions[value || "like"] = Math.max(0, Number(target.reactions[value || "like"] || 0) + 1);
        if (action === "pin") target.pinned = !target.pinned;
        if (action === "status" && ["local", "pending", "sent", "delivered", "read", "failed"].includes(value)) target.status = value;
        if (action === "recall" && target.author?.id === state.viewer.id) { target.recalled = true; target.text = ""; target.kind = "text"; target.file = null; target.attachmentUrl = ""; }
        if (action === "delete-self" && !target.deletedFor.includes(state.viewer.id)) target.deletedFor.push(state.viewer.id);
        save(); return clone(target);
      },
      votePoll(roomId, messageId, optionIndex) {
        const target = message(roomId, messageId);
        const option = target?.poll?.options?.[Number(optionIndex)];
        if (!option) return null;
        option.votes = Math.max(0, Number(option.votes || 0) + 1);
        save(); return clone(target);
      },
      saveDraft(roomId, text) { state.drafts[roomId] = String(text || "").slice(0, 4000); save(); },
      report(roomId, reason) { state.reports.push({ id: uid("report"), roomId, reason: cleanText(reason, 400), createdAt: nowIso(), scope: "conversation-metadata-only" }); save(); },
      reset() { state = seedState(); save(); }
    };
  }

  function relativeTime(value) {
    const diff = Math.max(0, Date.now() - Date.parse(value || nowIso()));
    if (diff < 60000) return "vừa xong";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phút`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ`;
    return new Date(value).toLocaleDateString("vi-VN");
  }

  function initials(name) { return String(name || "HH").split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase().slice(0, 2); }
  function statusLabel(status) { return ({ local: "Chỉ lưu trên thiết bị", pending: "Đang chờ máy chủ", sent: "Máy chủ đã nhận", delivered: "Đã nhận", read: "Đã xem", failed: "Chưa gửi được" })[status] || "Chỉ lưu trên thiết bị"; }

  function normalizeTranslationResult(result) {
    if (!result || result.ok !== true || result.connected !== true) return null;
    const translatedText = cleanText(result.translatedText || result.text, 4000);
    if (!translatedText) return null;
    return {
      translatedText,
      targetLanguage: cleanText(result.targetLanguage || result.language || "vi", 24),
      provider: cleanText(result.provider || "adapter", 80)
    };
  }
  function notify(message, type = "info") {
    if (rootScope.HHCommunity?.notice) return rootScope.HHCommunity.notice(message, type === "error" ? "error" : "success");
    rootScope.dispatchEvent?.(new CustomEvent("hh:notice", { detail: { message, type } }));
  }

  function attachmentMarkup(message) {
    if (message.recalled) return '<p class="hmn-tombstone">Tin nhắn đã được thu hồi.</p>';
    if (message.kind === "sticker") return `<div class="hmn-sticker" aria-label="Sticker">${escapeHtml(message.sticker || "✨")}</div>`;
    if (message.kind === "gif" && message.gifUrl) return `<img class="hmn-media" src="${escapeHtml(message.gifUrl)}" alt="GIF được chia sẻ" loading="lazy">`;
    if (message.kind === "location" && message.location) {
      const href = `https://www.google.com/maps?q=${encodeURIComponent(`${message.location.lat},${message.location.lng}`)}`;
      return `<a class="hmn-attachment" href="${href}" target="_blank" rel="noopener noreferrer"><b>⌖ Vị trí được chia sẻ</b><span>${Number(message.location.lat).toFixed(5)}, ${Number(message.location.lng).toFixed(5)}</span></a>`;
    }
    if (message.kind === "poll" && message.poll) return `<section class="hmn-poll"><b>${escapeHtml(message.poll.question)}</b>${message.poll.options.map((option, index) => `<button type="button" data-hmn-poll="${escapeHtml(message.id)}" data-option="${index}"><span>${escapeHtml(option.label)}</span><small>${Number(option.votes || 0)} phiếu</small></button>`).join("")}</section>`;
    if (message.kind === "event" && message.event) return `<section class="hmn-event"><small>LỊCH HẸN</small><b>${escapeHtml(message.event.title)}</b><time>${new Date(message.event.startsAt).toLocaleString("vi-VN")}</time></section>`;
    const file = message.file;
    if (file) {
      const src = file.dataUrl || "";
      if (file.type.startsWith("image/") && src) return `<img class="hmn-media" src="${escapeHtml(src)}" alt="${escapeHtml(file.name)}" loading="lazy">`;
      if (file.type.startsWith("video/") && src) return `<video class="hmn-media" src="${escapeHtml(src)}" controls playsinline preload="metadata"></video>`;
      if (file.type.startsWith("audio/") && src) return `<audio class="hmn-audio" src="${escapeHtml(src)}" controls preload="metadata"></audio>`;
      return `<div class="hmn-file"><span>FILE</span><div><b>${escapeHtml(file.name)}</b><small>${Math.ceil(file.size / 1024)} KB${src ? " · lưu cục bộ" : " · chỉ metadata"}</small></div></div>`;
    }
    if (message.kind === "link" && message.attachmentUrl) return `<a class="hmn-attachment" href="${escapeHtml(message.attachmentUrl)}" target="_blank" rel="noopener noreferrer"><b>Mở liên kết ↗</b><span>${escapeHtml(message.attachmentUrl)}</span></a>`;
    return "";
  }

  function renderMessage(message, viewerId, translations = new Map(), translationPending = new Set()) {
    const mine = message.author?.id === viewerId;
    const translation = translations.get(message.id);
    const reactions = Object.entries(message.reactions || {}).filter(([, count]) => count).map(([type, count]) => `<button type="button" data-hmn-action="reaction" data-message="${escapeHtml(message.id)}" data-value="${escapeHtml(type)}">${({ like: "👍", love: "❤", laugh: "😄", wow: "😮" })[type] || "👍"} ${count}</button>`).join("");
    return `<article class="hmn-message${mine ? " is-mine" : ""}" data-hmn-message="${escapeHtml(message.id)}">
      <span class="hmn-avatar" aria-hidden="true">${escapeHtml(message.author?.avatar || initials(message.author?.name))}</span>
      <div class="hmn-bubble"><header><b>${escapeHtml(message.author?.name || "Thành viên")}</b><time>${relativeTime(message.createdAt)}</time>${message.editedAt ? "<small>đã sửa</small>" : ""}${message.pinned ? "<small>◆ đã ghim</small>" : ""}</header>
      ${message.replyTo ? `<blockquote><b>${escapeHtml(message.replyTo.name)}</b><span>${escapeHtml(message.replyTo.text)}</span></blockquote>` : ""}
      ${message.forwardedFrom ? '<small class="hmn-forwarded">Đã chuyển tiếp</small>' : ""}${message.text ? `<p>${escapeHtml(message.text).replace(/\n/g, "<br>")}</p>` : ""}${translation ? `<aside class="hmn-translation" lang="${escapeHtml(translation.targetLanguage)}"><small>Bản dịch ${escapeHtml(translation.targetLanguage)} · ${escapeHtml(translation.provider)}</small><p>${escapeHtml(translation.translatedText).replace(/\n/g, "<br>")}</p></aside>` : ""}${attachmentMarkup(message)}
      <footer><button type="button" data-hmn-action="reply" data-message="${escapeHtml(message.id)}">Trả lời</button><button type="button" data-hmn-action="reaction" data-message="${escapeHtml(message.id)}" data-value="like">👍</button>${message.text && !message.recalled ? `<button type="button" data-hmn-action="translate" data-message="${escapeHtml(message.id)}" ${translationPending.has(message.id) ? "disabled" : ""}>${translationPending.has(message.id) ? "Đang dịch…" : translation ? "Dịch lại" : "Dịch"}</button>` : ""}<button type="button" data-hmn-action="forward" data-message="${escapeHtml(message.id)}">Chuyển tiếp</button><button type="button" data-hmn-action="pin" data-message="${escapeHtml(message.id)}">${message.pinned ? "Bỏ ghim" : "Ghim"}</button>${mine && Date.now() - Date.parse(message.createdAt) <= EDIT_WINDOW_MS && !message.recalled ? `<button type="button" data-hmn-action="edit" data-message="${escapeHtml(message.id)}">Sửa</button><button type="button" data-hmn-action="recall" data-message="${escapeHtml(message.id)}">Thu hồi</button>` : ""}<button type="button" data-hmn-action="delete-self" data-message="${escapeHtml(message.id)}">Xóa với tôi</button></footer>
      ${reactions ? `<div class="hmn-reactions">${reactions}</div>` : ""}${mine ? `<small class="hmn-delivery">${statusLabel(message.status)}</small>` : ""}</div>
    </article>`;
  }

  function memberMarkup(member, room, viewerId) {
    const canManage = room.members.find((item) => item.id === viewerId)?.role === "owner";
    return `<li><span class="hmn-avatar">${escapeHtml(initials(member.name))}</span><div><b>${escapeHtml(member.name)}</b><small>${member.id === viewerId ? "Bạn" : member.role === "owner" ? "Chủ nhóm" : member.role === "admin" ? "Quản trị viên" : "Thành viên"}</small></div>${canManage && member.id !== viewerId ? `<select data-hmn-member-role="${escapeHtml(member.id)}" aria-label="Vai trò của ${escapeHtml(member.name)}"><option value="member" ${member.role === "member" ? "selected" : ""}>Thành viên</option><option value="admin" ${member.role === "admin" ? "selected" : ""}>Quản trị viên</option></select><button type="button" data-hmn-member-remove="${escapeHtml(member.id)}" aria-label="Xóa ${escapeHtml(member.name)}">×</button>` : ""}</li>`;
  }

  function modalMarkup(type, state) {
    if (!type) return "";
    const room = state.rooms.find((item) => item.id === state.activeRoomId);
    if (type === "group") return `<dialog class="hmn-dialog" open data-hmn-dialog><form method="dialog" data-hmn-create-group><header><div><small>NHÓM CHAT</small><h3>Tạo không gian mới</h3></div><button value="cancel" aria-label="Đóng">×</button></header><label>Tên nhóm<input name="name" required minlength="3" maxlength="80" placeholder="Ví dụ: Nhóm dự án mùa hè"></label><label>Ảnh đại diện dạng chữ<input name="avatar" maxlength="4" placeholder="HH"></label><label>Thành viên, phân cách bằng dấu phẩy<input name="members" placeholder="Linh Design, Minh Audio"></label><footer><button value="cancel">Hủy</button><button class="primary" type="submit">Tạo nhóm</button></footer></form></dialog>`;
    if (type === "room-settings") return `<dialog class="hmn-dialog" open data-hmn-dialog><form method="dialog" data-hmn-room-settings><header><div><small>QUẢN LÝ NHÓM</small><h3>${escapeHtml(room?.name)}</h3></div><button value="cancel" aria-label="Đóng">×</button></header><label>Tên nhóm<input name="name" maxlength="80" value="${escapeHtml(room?.name || "")}"></label><label>Ảnh đại diện dạng chữ<input name="avatar" maxlength="4" value="${escapeHtml(room?.avatar || "")}"></label><div class="hmn-dialog-members"><b>Thành viên</b><ul>${(room?.members || []).map((member) => memberMarkup(member, room, state.viewer.id)).join("")}</ul><label>Thêm thành viên<input name="newMember" placeholder="Tên thành viên"></label></div><footer><button value="cancel">Đóng</button><button class="danger" type="button" data-hmn-leave-group>Rời nhóm</button><button class="primary" type="submit">Lưu thay đổi</button></footer></form></dialog>`;
    if (type === "poll") return `<dialog class="hmn-dialog" open data-hmn-dialog><form method="dialog" data-hmn-poll-form><header><div><small>TƯƠNG TÁC</small><h3>Tạo bình chọn</h3></div><button value="cancel" aria-label="Đóng">×</button></header><label>Câu hỏi<input name="question" required maxlength="180"></label><label>Các lựa chọn, mỗi dòng một mục<textarea name="options" required rows="5"></textarea></label><footer><button value="cancel">Hủy</button><button class="primary" type="submit">Gửi bình chọn</button></footer></form></dialog>`;
    if (type === "event") return `<dialog class="hmn-dialog" open data-hmn-dialog><form method="dialog" data-hmn-event-form><header><div><small>LỊCH HẸN</small><h3>Tạo lịch trong trò chuyện</h3></div><button value="cancel" aria-label="Đóng">×</button></header><label>Tiêu đề<input name="title" required maxlength="120"></label><label>Thời gian<input name="startsAt" type="datetime-local" required></label><footer><button value="cancel">Hủy</button><button class="primary" type="submit">Gửi lịch hẹn</button></footer></form></dialog>`;
    if (type === "gif") return `<dialog class="hmn-dialog" open data-hmn-dialog><form method="dialog" data-hmn-gif-form><header><div><small>GIF URL</small><h3>Chia sẻ GIF công khai</h3></div><button value="cancel" aria-label="Đóng">×</button></header><label>Liên kết HTTPS<input name="url" type="url" required placeholder="https://..."></label><p class="hmn-capability">HH không tải GIF từ dịch vụ bên thứ ba nếu chưa có API; liên kết được gửi trực tiếp.</p><footer><button value="cancel">Hủy</button><button class="primary" type="submit">Gửi GIF</button></footer></form></dialog>`;
    if (type === "report") return `<dialog class="hmn-dialog" open data-hmn-dialog><form method="dialog" data-hmn-report-form><header><div><small>AN TOÀN</small><h3>Báo cáo cuộc trò chuyện</h3></div><button value="cancel" aria-label="Đóng">×</button></header><label>Lý do<textarea name="reason" required maxlength="400" rows="5"></textarea></label><p class="hmn-capability">Bản cục bộ chỉ lưu metadata báo cáo, không tự gửi nội dung tin nhắn riêng.</p><footer><button value="cancel">Hủy</button><button class="danger" type="submit">Gửi báo cáo</button></footer></form></dialog>`;
    return "";
  }

  function createController(host, options = {}) {
    const store = createStore(options.storage || rootScope.localStorage);
    let state = store.snapshot();
    let searchRooms = "";
    let searchMessages = "";
    let pageCursor = "";
    let loadedMessages = PAGE_SIZE;
    let replyTo = null;
    let modal = "";
    let typingUsers = new Map();
    let typingTimer = 0;
    let recorder = null;
    let recorderStream = null;
    let chunks = [];
    let socket = null;
    let socketHandlers = null;
    let socketMode = "local";
    const confirmedPresence = new Map();
    const translations = new Map();
    const translationPending = new Set();
    let destroyed = false;

    const activeRoom = () => state.rooms.find((room) => room.id === state.activeRoomId) || state.rooms[0];
    const api = rootScope.HHCommunity?.api;
    const syncLabel = () => socketMode === "live" ? "Socket.IO đã xác nhận phòng" : typeof api === "function" ? "Có API cấu hình · realtime chưa xác nhận" : "Chế độ cục bộ trên thiết bị";
    const roomPresenceLabel = (room) => room.kind === "group"
      ? `${room.members.length} thành viên`
      : socketMode === "live" && confirmedPresence.get(room.id) === true
        ? "Đang online · realtime đã xác nhận"
        : "Chưa xác nhận hiện diện realtime";
    const refresh = () => { state = store.snapshot(); render(); };
    const currentMessages = () => store.page(state.activeRoomId, pageCursor, loadedMessages, searchMessages);

    function filteredRooms() { return store.listRooms(searchRooms); }
    function setModal(value) { modal = value; render(); host.querySelector("[data-hmn-dialog] input, [data-hmn-dialog] textarea")?.focus(); }
    function closeModal() { modal = ""; render(); }

    function render() {
      if (destroyed) return;
      state = store.snapshot();
      const room = activeRoom();
      if (!room) { host.innerHTML = '<section class="hmn-shell"><p>Chưa có cuộc trò chuyện.</p></section>'; return; }
      const page = currentMessages();
      const owner = room.members?.find((member) => member.id === state.viewer.id)?.role === "owner";
      const typing = [...typingUsers.values()].filter((item) => item.roomId === room.id && item.until > Date.now());
      host.innerHTML = `<section class="hmn-shell" data-hmn-root aria-label="Messenger HH">
        <header class="hmn-topbar"><div class="hmn-brand"><span>HH</span><div><small>COMMUNICATION / MESSENGER</small><h2>Tin nhắn</h2></div></div><div class="hmn-top-actions"><span class="hmn-sync hmn-sync--${socketMode}"><i></i>${escapeHtml(syncLabel())}</span><button type="button" data-hmn-new-group>＋ Tạo nhóm</button></div></header>
        <div class="hmn-workspace">
          <aside class="hmn-rooms" aria-label="Danh sách trò chuyện"><div class="hmn-search"><span>⌕</span><input type="search" data-hmn-room-search value="${escapeHtml(searchRooms)}" placeholder="Tìm cuộc trò chuyện" aria-label="Tìm cuộc trò chuyện"></div>
            <nav class="hmn-filters" aria-label="Bộ lọc"><button type="button" data-hmn-filter="active" class="${state.roomFilter === "active" ? "is-active" : ""}">Gần đây</button><button type="button" data-hmn-filter="unread" class="${state.roomFilter === "unread" ? "is-active" : ""}">Chưa đọc</button><button type="button" data-hmn-filter="groups" class="${state.roomFilter === "groups" ? "is-active" : ""}">Nhóm</button><button type="button" data-hmn-filter="archived" class="${state.roomFilter === "archived" ? "is-active" : ""}">Lưu trữ</button></nav>
            <div class="hmn-room-list">${filteredRooms().map((item) => { const last = (state.messages[item.id] || []).at(-1); const online = socketMode === "live" && confirmedPresence.get(item.id) === true; return `<button type="button" class="hmn-room ${item.id === room.id ? "is-active" : ""}" data-hmn-room="${escapeHtml(item.id)}"><span class="hmn-avatar">${escapeHtml(item.avatar || initials(item.name))}<i class="${online ? "is-online" : ""}"></i></span><span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(last?.recalled ? "Tin nhắn đã thu hồi" : last?.text || (item.kind === "group" ? `${item.members.length} thành viên` : "Bắt đầu trò chuyện"))}</small></span>${item.unread || item.markedUnread ? `<em>${item.unread || "•"}</em>` : item.muted ? "<em>◒</em>" : ""}</button>`; }).join("") || '<p class="hmn-empty">Không có cuộc trò chuyện phù hợp.</p>'}</div>
          </aside>
          <main class="hmn-conversation"><header class="hmn-conversation-head"><span class="hmn-avatar">${escapeHtml(room.avatar || initials(room.name))}</span><div><h3>${escapeHtml(room.name)}</h3><p>${escapeHtml(roomPresenceLabel(room))} · ${escapeHtml(syncLabel())}</p></div><div><button type="button" data-hmn-call="audio" ${rootScope.HHCalls?.available?.() ? "" : 'title="Cần máy chủ realtime để gọi"'}>☎<span>Gọi thoại</span></button><button type="button" data-hmn-call="video" ${rootScope.HHCalls?.available?.() ? "" : 'title="Cần máy chủ realtime để gọi"'}>▣<span>Gọi video</span></button>${room.kind === "group" ? '<button type="button" data-hmn-room-settings>⚙<span>Nhóm</span></button>' : ""}</div></header>
            <div class="hmn-message-search"><span>⌕</span><input type="search" data-hmn-message-search value="${escapeHtml(searchMessages)}" placeholder="Tìm trong cuộc trò chuyện"><small>${page.total} kết quả</small></div>
            <section class="hmn-message-list" data-hmn-message-list aria-live="polite">${page.hasMore ? '<button class="hmn-load-more" type="button" data-hmn-load-more>↑ Tải tin cũ hơn</button>' : ""}${page.items.map((message) => renderMessage(message, state.viewer.id, translations, translationPending)).join("") || '<div class="hmn-empty-state"><span>✦</span><h3>Bắt đầu cuộc trò chuyện</h3><p>Gửi tin nhắn, ảnh, lịch hẹn hoặc bình chọn đầu tiên.</p></div>'}${typing.length ? `<div class="hmn-typing"><i></i><i></i><i></i><span>${escapeHtml(typing.map((item) => item.name).join(", "))} đang nhập…</span></div>` : ""}</section>
            <form class="hmn-composer" data-hmn-composer>${room.blocked ? '<div class="hmn-blocked">Bạn đã chặn người gửi. Bỏ chặn ở bảng thông tin để tiếp tục.</div>' : `${replyTo ? `<div class="hmn-reply-bar"><span>Đang trả lời <b>${escapeHtml(replyTo.name)}</b>: ${escapeHtml(replyTo.text)}</span><button type="button" data-hmn-reply-cancel aria-label="Hủy trả lời">×</button></div>` : ""}<div class="hmn-compose-tools"><button type="button" data-hmn-tool="emoji" title="Emoji">☺</button><button type="button" data-hmn-tool="sticker" title="Sticker">◇</button><button type="button" data-hmn-tool="gif" title="GIF">GIF</button><label title="Ảnh, video, âm thanh hoặc tệp"><input type="file" data-hmn-file accept="image/*,video/*,audio/*,.pdf,.zip,.txt,.json,.csv"><span>＋</span></label><button type="button" data-hmn-tool="voice" title="Ghi âm">${recorder?.state === "recording" ? "■" : "◉"}</button><button type="button" data-hmn-tool="location" title="Vị trí">⌖</button><button type="button" data-hmn-tool="poll" title="Bình chọn">▥</button><button type="button" data-hmn-tool="event" title="Lịch hẹn">▦</button></div><div class="hmn-compose-row"><textarea data-hmn-input rows="2" maxlength="4000" placeholder="Nhắn tin cho ${escapeHtml(room.name)}">${escapeHtml(state.drafts[room.id] || "")}</textarea><button class="primary" type="submit" aria-label="Gửi tin nhắn">➤</button></div><div class="hmn-compose-meta"><label>Tự xóa<select data-hmn-ephemeral><option value="0">Tắt</option><option value="60" ${Number(room.ephemeralSeconds) === 60 ? "selected" : ""}>1 phút</option><option value="3600" ${Number(room.ephemeralSeconds) === 3600 ? "selected" : ""}>1 giờ</option><option value="86400" ${Number(room.ephemeralSeconds) === 86400 ? "selected" : ""}>1 ngày</option><option value="604800" ${Number(room.ephemeralSeconds) === 604800 ? "selected" : ""}>7 ngày</option></select></label><small>Không mã hóa đầu cuối · truyền qua TLS khi backend trực tuyến</small></div>`}</form>
          </main>
          <aside class="hmn-details" aria-label="Thông tin cuộc trò chuyện"><section class="hmn-profile-card"><span class="hmn-avatar hmn-avatar--xl">${escapeHtml(room.avatar || initials(room.name))}</span><h3>${escapeHtml(room.name)}</h3><p>${escapeHtml(roomPresenceLabel(room))}</p><div><button type="button" data-hmn-call="audio">☎</button><button type="button" data-hmn-call="video">▣</button><button type="button" data-hmn-action-room="markedUnread">◉</button></div></section>
            <details open><summary>Quyền riêng tư & an toàn</summary><div class="hmn-setting-list"><button type="button" data-hmn-action-room="muted"><span>Tắt thông báo</span><b>${room.muted ? "Bật" : "Tắt"}</b></button><button type="button" data-hmn-action-room="markedUnread"><span>Đánh dấu chưa đọc</span><b>${room.markedUnread ? "Có" : "Không"}</b></button><button type="button" data-hmn-action-room="archived"><span>Lưu trữ</span><b>${room.archived ? "Có" : "Không"}</b></button>${room.kind === "direct" ? `<button type="button" data-hmn-action-room="blocked"><span>Chặn người gửi</span><b>${room.blocked ? "Đã chặn" : "Chưa chặn"}</b></button>` : ""}<button type="button" data-hmn-report><span>Báo cáo</span><b>Riêng tư</b></button></div></details>
            <details open><summary>${room.kind === "group" ? "Thành viên" : "Trạng thái"}</summary><ul class="hmn-members">${room.members.map((member) => memberMarkup(member, room, state.viewer.id)).join("")}</ul></details>
            <details><summary>Tin nhắn đã ghim</summary><div class="hmn-pins">${(state.messages[room.id] || []).filter((message) => message.pinned && !message.recalled).map((message) => `<button type="button" data-hmn-jump="${escapeHtml(message.id)}">${escapeHtml(message.text || message.kind)}</button>`).join("") || "<p>Chưa có tin nhắn được ghim.</p>"}</div></details>
            <div class="hmn-capability"><b>Trạng thái bảo mật</b><p>Kết nối HTTPS/TLS bảo vệ dữ liệu khi truyền. HH chưa tuyên bố mã hóa đầu cuối cho workspace này. Dịch chỉ gửi đúng tin nhắn bạn chủ động chọn tới adapter đã xác nhận và bản dịch không được lưu.</p></div>
          </aside>
        </div>${modalMarkup(modal, state)}
      </section>`;
      requestAnimationFrame(() => { const list = host.querySelector("[data-hmn-message-list]"); if (list && !searchMessages) list.scrollTop = list.scrollHeight; });
    }

    async function remoteMutation(body) {
      if (typeof api !== "function") return { localOnly: true };
      try { const result = await api({ method: "POST", body }); return result && typeof result === "object" ? result : { localOnly: true }; }
      catch (error) { notify(`Đã lưu trên thiết bị; chưa đồng bộ máy chủ: ${error.message}`, "error"); return { localOnly: true, error }; }
    }

    function socketChanged(type, messageId = "") {
      if (socketMode === "live" && socket?.connected) socket.emit("messenger:changed", { room: state.activeRoomId, type, messageId });
    }

    function joinRealtime(roomId) {
      if (!socket?.connected) { socketMode = "local"; confirmedPresence.clear(); render(); return; }
      socketMode = "connecting";
      socket.emit("messenger:room:join", { room: roomId }, (result = {}) => {
        socketMode = result.ok === true && socket?.connected === true ? "live" : "local";
        if (socketMode !== "live") confirmedPresence.clear();
        render();
      });
    }

    function bindRealtime() {
      const candidate = rootScope.HHRealtimeSocket;
      if (!candidate || socket === candidate) return;
      socket = candidate;
      socketHandlers = {
        connect: () => joinRealtime(state.activeRoomId),
        disconnect: () => { socketMode = "local"; confirmedPresence.clear(); render(); },
        typing: (payload = {}) => {
        if (payload.room !== state.activeRoomId || !payload.user?.id || payload.user.id === state.viewer.id) return;
        if (payload.active) typingUsers.set(payload.user.id, { roomId: payload.room, name: payload.user.name || "Thành viên", until: Date.now() + 2500 }); else typingUsers.delete(payload.user.id);
        render(); setTimeout(() => { if (!destroyed) render(); }, 2600);
        },
        presence: (payload = {}) => {
        if (socketMode !== "live" || payload.room !== state.activeRoomId || typeof payload.online !== "boolean") return;
        confirmedPresence.set(payload.room, payload.online);
        const target = store.room(payload.room); if (target && target.kind === "direct" && payload.online === true) store.updateRoom(payload.room, { lastActive: nowIso() });
        render();
        },
        changed: (payload = {}) => { if (socketMode === "live" && payload.room === state.activeRoomId) remoteLoad(payload.room); }
      };
      socket.on?.("connect", socketHandlers.connect);
      socket.on?.("disconnect", socketHandlers.disconnect);
      socket.on?.("messenger:typing", socketHandlers.typing);
      socket.on?.("messenger:presence", socketHandlers.presence);
      socket.on?.("messenger:changed", socketHandlers.changed);
      joinRealtime(state.activeRoomId);
    }

    async function translateMessage(message) {
      if (!message?.text || message.recalled) return;
      if (typeof options.translateAdapter !== "function") {
        return notify("Chưa có adapter dịch được cấu hình; nội dung không được gửi đi.", "error");
      }
      translationPending.add(message.id);
      render();
      try {
        const result = normalizeTranslationResult(await options.translateAdapter({
          messageId: message.id,
          text: message.text,
          sourceLanguage: "auto",
          targetLanguage: cleanText(options.translationLanguage || "vi", 24)
        }));
        if (!result) return notify("Adapter chưa xác nhận kết nối hoặc không trả về bản dịch hợp lệ.", "error");
        translations.set(message.id, result);
        notify(`Đã dịch qua ${result.provider}. Bản dịch chỉ giữ trong phiên này.`);
      } catch (error) {
        notify(`Không thể dịch tin nhắn: ${error.message || "adapter không khả dụng"}`, "error");
      } finally {
        translationPending.delete(message.id);
        render();
      }
    }

    async function remoteLoad(roomId) {
      if (typeof api !== "function") return;
      try {
        const result = await api({ query: `?view=messenger&room=${encodeURIComponent(roomId)}` });
        if (!result?.room || !Array.isArray(result.messages)) return;
        const local = store.room(roomId);
        if (local) store.updateRoom(roomId, { name: result.room.name || local.name, avatar: result.room.avatar || local.avatar, muted: Boolean(result.room.muted), archived: Boolean(result.room.archived), blocked: Boolean(result.room.blocked) });
        result.messages.slice(-200).forEach((incoming) => {
          if ((store.snapshot().messages[roomId] || []).some((item) => item.id === incoming.id)) return;
          store.addMessage(roomId, { ...incoming, author: incoming.author, status: incoming.status || "delivered" });
        });
        refresh();
      } catch { /* Local mode stays available and visibly labeled. */ }
    }

    async function fileToMessage(file, kind = "file") {
      if (!file?.size) return;
      if (file.size > 12 * 1024 * 1024) return notify("Tệp vượt 12 MB. Hãy dùng kho media backend để gửi tệp lớn.", "error");
      let dataUrl = "";
      if (file.size <= 1.5 * 1024 * 1024) dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
      const detected = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? kind === "voice" ? "voice" : "audio" : "file";
      const created = store.addMessage(state.activeRoomId, { kind: detected, file: { name: file.name, size: file.size, type: file.type || "application/octet-stream", dataUrl }, replyTo, ephemeralSeconds: activeRoom().ephemeralSeconds });
      replyTo = null; socketChanged("create", created?.id); remoteMutation({ action: "message:create", room: state.activeRoomId, kind: detected, text: "", file: { name: file.name, size: file.size, type: file.type } }); refresh();
      if (!dataUrl) notify("Tệp lớn chỉ lưu metadata cục bộ; cần object storage backend để đồng bộ nội dung.");
    }

    async function startVoice() {
      if (recorder?.state === "recording") { recorder.stop(); return; }
      if (!navigator.mediaDevices?.getUserMedia || !rootScope.MediaRecorder) return notify("Trình duyệt chưa hỗ trợ ghi âm.", "error");
      try {
        recorderStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const type = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"].find((item) => rootScope.MediaRecorder.isTypeSupported?.(item));
        recorder = new rootScope.MediaRecorder(recorderStream, type ? { mimeType: type } : undefined); chunks = [];
        recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
        recorder.onstop = async () => { const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" }); recorderStream?.getTracks().forEach((track) => track.stop()); recorderStream = null; const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type }); recorder = null; await fileToMessage(file, "voice"); };
        recorder.start(); render(); notify("Đang ghi âm. Bấm lại nút ghi để gửi.");
      } catch (error) { notify(error.name === "NotAllowedError" ? "Bạn chưa cấp quyền micro." : `Không thể ghi âm: ${error.message}`, "error"); }
    }

    function shareLocation() {
      if (!navigator.geolocation) return notify("Thiết bị không hỗ trợ định vị.", "error");
      navigator.geolocation.getCurrentPosition((position) => {
        const created = store.addMessage(state.activeRoomId, { kind: "location", location: { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy }, ephemeralSeconds: activeRoom().ephemeralSeconds });
        socketChanged("create", created?.id); remoteMutation({ action: "message:create", room: state.activeRoomId, kind: "location", location: created.location }); refresh();
      }, (error) => notify(error.code === 1 ? "Bạn chưa cấp quyền vị trí." : "Không thể lấy vị trí hiện tại.", "error"), { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    }

    async function sendText(text) {
      const content = cleanText(text, 4000); if (!content) return;
      const link = safeUrl(content); const created = store.addMessage(state.activeRoomId, { text: content, kind: link === content ? "link" : "text", attachmentUrl: link === content ? link : "", replyTo, ephemeralSeconds: activeRoom().ephemeralSeconds });
      replyTo = null; refresh(); socketChanged("create", created.id);
      const result = await remoteMutation({ action: "message:create", room: state.activeRoomId, text: content, kind: created.kind, replyTo: created.replyTo, ephemeralSeconds: activeRoom().ephemeralSeconds });
      store.mutateMessage(state.activeRoomId, created.id, "status", result?.ok === true ? "sent" : result?.error ? "failed" : "local");
      refresh();
    }

    async function onSubmit(event) {
      const form = event.target;
      if (form.matches("[data-hmn-composer]")) { event.preventDefault(); await sendText(form.querySelector("[data-hmn-input]")?.value); return; }
      if (form.matches("[data-hmn-create-group]")) { event.preventDefault(); const values = Object.fromEntries(new FormData(form)); const members = String(values.members || "").split(",").map((name) => cleanText(name, 80)).filter(Boolean).map((name) => ({ id: uid("member"), name })); const created = store.createRoom({ name: values.name, avatar: values.avatar, members }); closeModal(); remoteMutation({ action: "message:room:create", name: created.name, memberIds: members.map((item) => item.id), avatar: created.avatar }); joinRealtime(created.id); return; }
      if (form.matches("[data-hmn-room-settings]")) { event.preventDefault(); const values = Object.fromEntries(new FormData(form)); store.updateRoom(state.activeRoomId, { name: values.name, avatar: values.avatar }); if (values.newMember) store.setMember(state.activeRoomId, { id: uid("member"), name: values.newMember }); closeModal(); remoteMutation({ action: "message:room:update", room: state.activeRoomId, name: values.name, avatar: values.avatar }); return; }
      if (form.matches("[data-hmn-poll-form]")) { event.preventDefault(); const values = Object.fromEntries(new FormData(form)); const options = String(values.options || "").split(/\n/).map((label) => cleanText(label, 80)).filter(Boolean).slice(0, 8).map((label) => ({ label, votes: 0 })); if (options.length < 2) return notify("Bình chọn cần ít nhất hai lựa chọn.", "error"); store.addMessage(state.activeRoomId, { kind: "poll", poll: { question: cleanText(values.question, 180), options } }); closeModal(); socketChanged("create"); return; }
      if (form.matches("[data-hmn-event-form]")) { event.preventDefault(); const values = Object.fromEntries(new FormData(form)); store.addMessage(state.activeRoomId, { kind: "event", event: { title: cleanText(values.title, 120), startsAt: new Date(values.startsAt).toISOString() } }); closeModal(); socketChanged("create"); return; }
      if (form.matches("[data-hmn-gif-form]")) { event.preventDefault(); const url = safeUrl(new FormData(form).get("url")); if (!url) return notify("Liên kết GIF không hợp lệ.", "error"); store.addMessage(state.activeRoomId, { kind: "gif", gifUrl: url }); closeModal(); socketChanged("create"); return; }
      if (form.matches("[data-hmn-report-form]")) { event.preventDefault(); const reason = new FormData(form).get("reason"); store.report(state.activeRoomId, reason); closeModal(); remoteMutation({ action: "message:conversation:report", room: state.activeRoomId, reason }); notify("Đã ghi nhận báo cáo. Nội dung riêng tư không được tự động đính kèm."); }
    }

    function onInput(event) {
      if (event.target.matches("[data-hmn-room-search]")) { searchRooms = event.target.value; render(); return; }
      if (event.target.matches("[data-hmn-message-search]")) { searchMessages = event.target.value; render(); return; }
      if (event.target.matches("[data-hmn-input]")) {
        store.saveDraft(state.activeRoomId, event.target.value);
        if (socketMode === "live" && socket?.connected) { socket.emit("messenger:typing", { room: state.activeRoomId, active: true }); clearTimeout(typingTimer); typingTimer = setTimeout(() => socket?.emit("messenger:typing", { room: state.activeRoomId, active: false }), 1200); }
      }
    }

    async function onChange(event) {
      if (event.target.matches("[data-hmn-file]")) { const file = event.target.files?.[0]; if (file) await fileToMessage(file); return; }
      if (event.target.matches("[data-hmn-ephemeral]")) { store.updateRoom(state.activeRoomId, { ephemeralSeconds: Number(event.target.value) }); refresh(); return; }
      if (event.target.matches("[data-hmn-member-role]")) { store.setMember(state.activeRoomId, { id: event.target.dataset.hmnMemberRole, role: event.target.value }); remoteMutation({ action: "message:room:role", room: state.activeRoomId, targetId: event.target.dataset.hmnMemberRole, role: event.target.value }); refresh(); }
    }

    async function onClick(event) {
      const button = event.target.closest("button, [data-hmn-room]"); if (!button) return;
      if (button.dataset.hmnRoom) { socket?.emit?.("messenger:room:leave", { room: state.activeRoomId }); store.setActive(button.dataset.hmnRoom); searchMessages = ""; loadedMessages = PAGE_SIZE; replyTo = null; refresh(); joinRealtime(button.dataset.hmnRoom); remoteMutation({ action: "message:read", room: button.dataset.hmnRoom }); return; }
      if (button.dataset.hmnFilter) { store.setFilter(button.dataset.hmnFilter); refresh(); return; }
      if (button.hasAttribute("data-hmn-new-group")) return setModal("group");
      if (button.hasAttribute("data-hmn-room-settings")) return setModal("room-settings");
      if (button.hasAttribute("data-hmn-reply-cancel")) { replyTo = null; render(); return; }
      if (button.hasAttribute("data-hmn-load-more")) { loadedMessages += PAGE_SIZE; render(); return; }
      if (button.hasAttribute("data-hmn-report")) return setModal("report");
      if (button.hasAttribute("data-hmn-leave-group")) { store.leaveRoom(state.activeRoomId); closeModal(); remoteMutation({ action: "message:room:leave", room: state.activeRoomId }); return; }
      if (button.dataset.hmnMemberRemove) { store.setMember(state.activeRoomId, { id: button.dataset.hmnMemberRemove, remove: true }); remoteMutation({ action: "message:room:member", room: state.activeRoomId, targetId: button.dataset.hmnMemberRemove, operation: "remove" }); refresh(); return; }
      if (button.dataset.hmnActionRoom) { const key = button.dataset.hmnActionRoom; const room = activeRoom(); store.updateRoom(room.id, { [key]: !room[key] }); remoteMutation({ action: key === "blocked" ? "message:conversation:block" : "message:conversation:preference", room: room.id, [key]: !room[key] }); refresh(); return; }
      if (button.dataset.hmnCall) {
        if (!rootScope.HHCalls?.available?.()) return notify("Cuộc gọi cần máy chủ Socket.IO và cấu hình STUN/TURN đang trực tuyến.", "error");
        try { await rootScope.HHCalls.start(state.activeRoomId, button.dataset.hmnCall); } catch (error) { notify(error.message || "Không thể bắt đầu cuộc gọi.", "error"); } return;
      }
      if (button.dataset.hmnTool) {
        const tool = button.dataset.hmnTool;
        if (tool === "emoji") { const input = host.querySelector("[data-hmn-input]"); input.value += " 😊"; input.focus(); return; }
        if (tool === "sticker") { store.addMessage(state.activeRoomId, { kind: "sticker", sticker: "✨" }); refresh(); socketChanged("create"); return; }
        if (["gif", "poll", "event"].includes(tool)) return setModal(tool);
        if (tool === "voice") return startVoice();
        if (tool === "location") return shareLocation();
      }
      if (button.dataset.hmnPoll) { if (store.votePoll(state.activeRoomId, button.dataset.hmnPoll, button.dataset.option)) { socketChanged("poll", button.dataset.hmnPoll); refresh(); } return; }
      if (button.dataset.hmnJump) { host.querySelector(`[data-hmn-message="${CSS.escape(button.dataset.hmnJump)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      const action = button.dataset.hmnAction; const messageId = button.dataset.message; if (!action || !messageId) return;
      const target = store.page(state.activeRoomId, "", 500).items.find((item) => item.id === messageId); if (!target) return;
      if (action === "translate") return translateMessage(target);
      if (action === "reply") { replyTo = { id: target.id, name: target.author?.name || "Thành viên", text: target.text || target.kind }; render(); host.querySelector("[data-hmn-input]")?.focus(); return; }
      if (action === "edit") { const next = rootScope.prompt?.("Sửa tin nhắn trong 15 phút:", target.text); if (next !== null && store.editMessage(state.activeRoomId, messageId, next)) { remoteMutation({ action: "message:edit", room: state.activeRoomId, messageId, text: next }); socketChanged("edit", messageId); refresh(); } return; }
      if (action === "forward") { const other = state.rooms.find((room) => room.id !== state.activeRoomId); if (!other) return notify("Chưa có cuộc trò chuyện khác để chuyển tiếp.", "error"); store.addMessage(other.id, { ...target, author: state.viewer, forwardedFrom: { roomId: state.activeRoomId, messageId }, replyTo: null }); remoteMutation({ action: "message:forward", room: state.activeRoomId, messageId, targetRoom: other.id }); notify(`Đã chuyển tiếp tới ${other.name}.`); return; }
      const map = { reaction: "message:react", pin: "message:pin", recall: "message:delete:all", "delete-self": "message:delete:self" };
      store.mutateMessage(state.activeRoomId, messageId, action, button.dataset.value); remoteMutation({ action: map[action], room: state.activeRoomId, messageId, type: button.dataset.value }); socketChanged(action, messageId); refresh();
    }

    function onKeydown(event) {
      if (event.key === "Escape" && modal) { closeModal(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && event.target.matches("[data-hmn-input]")) { event.preventDefault(); event.target.form?.requestSubmit(); }
    }

    host.addEventListener("submit", onSubmit);
    host.addEventListener("input", onInput);
    host.addEventListener("change", onChange);
    host.addEventListener("click", onClick);
    host.addEventListener("keydown", onKeydown);
    rootScope.addEventListener?.("hh:realtime-ready", bindRealtime);
    render(); bindRealtime(); remoteLoad(state.activeRoomId);

    return {
      getState: () => store.snapshot(),
      refresh,
      unmount() {
        destroyed = true; clearTimeout(typingTimer); recorderStream?.getTracks().forEach((track) => track.stop());
        socket?.emit?.("messenger:room:leave", { room: state.activeRoomId });
        if (socket && socketHandlers) {
          socket.off?.("connect", socketHandlers.connect); socket.off?.("disconnect", socketHandlers.disconnect);
          socket.off?.("messenger:typing", socketHandlers.typing); socket.off?.("messenger:presence", socketHandlers.presence); socket.off?.("messenger:changed", socketHandlers.changed);
        }
        rootScope.removeEventListener?.("hh:realtime-ready", bindRealtime);
        host.removeEventListener("submit", onSubmit); host.removeEventListener("input", onInput); host.removeEventListener("change", onChange); host.removeEventListener("click", onClick); host.removeEventListener("keydown", onKeydown);
        instances.delete(host); host.innerHTML = "";
      }
    };
  }

  function supports(view) { return ["messenger", "conversation"].includes(String(view || "").toLowerCase()); }
  function mount(host, options = {}) {
    if (!host || typeof host.querySelector !== "function") return null;
    instances.get(host)?.unmount?.();
    const controller = createController(host, options); instances.set(host, controller); return controller;
  }
  function unmount(host) { if (host) instances.get(host)?.unmount?.(); else rootScope.document?.querySelectorAll?.("[data-hmn-root]").forEach((node) => instances.get(node.parentElement)?.unmount?.()); }

  rootScope.HHCommunicationMessengerNext = Object.freeze({ supports, mount, unmount, createStore, normalizeState, normalizeTranslationResult, STORAGE_KEY, PAGE_SIZE, EDIT_WINDOW_MS });
})();
