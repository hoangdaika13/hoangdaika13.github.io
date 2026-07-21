(() => {
  "use strict";

  const STORAGE_KEY = "hh.communication.live.v1";
  const CHANNEL_NAME = "hh.communication.live.v1";
  const VIEWS = new Set(["live-room", "calls"]);
  const instances = new Map();
  let sequence = 0;

  const DEFAULTS = Object.freeze({
    version: 1,
    callType: "video",
    callScope: "group",
    layout: "grid",
    compact: false,
    mediaVolume: 0.8,
    syncMode: true
  });

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const makeId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
  const normalizeView = (value) => String(value || "live-room").split(/[?#]/)[0].split("/").filter(Boolean).at(-1) || "live-room";
  const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());

  function readPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        ...DEFAULTS,
        callType: saved.callType === "audio" ? "audio" : "video",
        callScope: saved.callScope === "direct" ? "direct" : "group",
        layout: saved.layout === "speaker" ? "speaker" : "grid",
        compact: Boolean(saved.compact),
        mediaVolume: clamp(saved.mediaVolume ?? DEFAULTS.mediaVolume, 0, 1),
        syncMode: saved.syncMode !== false
      };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function savePreferences(instance) {
    const preferences = {
      version: 1,
      callType: instance.preferences.callType,
      callScope: instance.preferences.callScope,
      layout: instance.preferences.layout,
      compact: Boolean(instance.preferences.compact),
      mediaVolume: clamp(instance.preferences.mediaVolume, 0, 1),
      syncMode: Boolean(instance.preferences.syncMode)
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }

  function currentUser() {
    try {
      const value = JSON.parse(localStorage.getItem("hh-auth-user") || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function initials(value) {
    const parts = String(value || "HH").trim().split(/\s+/).filter(Boolean);
    return parts.slice(-2).map((part) => part[0]).join("").toLocaleUpperCase("vi") || "HH";
  }

  function supports(view) {
    return VIEWS.has(normalizeView(view));
  }

  function status(instance, message, tone = "info") {
    const target = instance.root.querySelector("[data-live-status]");
    if (!target) return;
    target.textContent = message;
    target.dataset.tone = tone;
  }

  function announce(instance, message) {
    const target = instance.root.querySelector("[data-live-announcer]");
    if (target) target.textContent = message;
  }

  function socketEmit(instance, event, payload = {}) {
    const packet = { ...payload, room: instance.roomId(), sentAt: new Date().toISOString() };
    if (instance.socket?.connected) instance.socket.emit(event, packet);
    if (instance.channel) instance.channel.postMessage({ event, payload: packet, source: instance.id });
  }

  function emitWithAck(socket, event, payload, timeout = 7000) {
    return new Promise((resolve, reject) => {
      if (!socket?.connected) return reject(new Error("Socket.IO chưa kết nối."));
      const timer = window.setTimeout(() => reject(new Error("Máy chủ signaling không phản hồi.")), timeout);
      const callback = (result = {}) => {
        window.clearTimeout(timer);
        if (result.ok === false) reject(new Error(result.error || "Không thể lấy cấu hình cuộc gọi."));
        else resolve(result);
      };
      if (payload === undefined) socket.emit(event, callback);
      else socket.emit(event, payload, callback);
    });
  }

  function securitySummary(instance, data = {}) {
    const servers = Array.isArray(data.iceServers) ? data.iceServers : [];
    const urls = servers.flatMap((server) => Array.isArray(server?.urls) ? server.urls : [server?.urls]).filter(Boolean).map(String);
    const turn = urls.some((url) => /^turns?:/i.test(url));
    const stun = urls.some((url) => /^stuns?:/i.test(url));
    const securePage = location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname);
    const secureBackend = !instance.apiBase || /^https:\/\//i.test(instance.apiBase) || securePage;
    instance.security = {
      configured: servers.length > 0,
      turn,
      stun,
      secureTransport: securePage && secureBackend,
      maxParticipants: Number(data.maxParticipants || 8),
      e2ee: false
    };
    renderSecurity(instance);
  }

  function renderSecurity(instance) {
    const security = instance.security;
    const list = instance.root.querySelector("[data-live-security]");
    if (!list) return;
    const rows = [
      ["TLS / WSS", security.secureTransport ? "Đang dùng kết nối an toàn" : "Chưa xác minh kết nối HTTPS/WSS", security.secureTransport],
      ["STUN", security.stun ? "Đã cấu hình" : "Chưa có cấu hình từ máy chủ", security.stun],
      ["TURN", security.turn ? "Có máy chủ chuyển tiếp" : "Chưa có TURN; một số mạng có thể không gọi được", security.turn],
      ["Mã hóa đầu cuối", "Chưa bật E2EE. WebRTC vẫn mã hóa đường truyền DTLS-SRTP.", false]
    ];
    list.innerHTML = rows.map(([title, text, ok]) => `<li class="${ok ? "is-ok" : "is-warning"}"><i aria-hidden="true"></i><span><strong>${title}</strong><small>${text}</small></span></li>`).join("");
    const capacity = instance.root.querySelector("[data-live-capacity]");
    if (capacity) capacity.textContent = `${security.maxParticipants} người tối đa`;
  }

  async function loadCallConfig(instance) {
    const token = localStorage.getItem("hh-auth-token") || "";
    let error = null;
    if (token && instance.apiBase) {
      try {
        const response = await fetch(`${instance.apiBase.replace(/\/$/, "")}/api/realtime/ice`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          cache: "no-store"
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        securitySummary(instance, data);
        status(instance, "Cấu hình ICE đã được xác minh từ backend.", "success");
        return data;
      } catch (caught) {
        error = caught;
      }
    }
    const socket = instance.socket || window.HHRealtimeSocket;
    if (socket?.connected) {
      try {
        const data = await emitWithAck(socket, "call:config", undefined);
        securitySummary(instance, data);
        status(instance, "Cấu hình ICE đã được nhận qua Socket.IO.", "success");
        return data;
      } catch (caught) {
        error = caught;
      }
    }
    securitySummary(instance, {});
    status(instance, token ? `Chưa lấy được cấu hình ICE: ${error?.message || "backend ngoại tuyến"}` : "Đăng nhập để máy chủ cấp cấu hình STUN/TURN.", "warning");
    return null;
  }

  function participantMarkup(participant) {
    const name = participant.name || "Thành viên HH";
    const media = participant.media || {};
    return `<article class="live-participant ${participant.local ? "is-local" : ""}" data-participant="${escapeHTML(participant.id)}">
      <div class="live-participant__avatar" aria-hidden="true">${escapeHTML(initials(name))}</div>
      <div><strong>${escapeHTML(name)}</strong><span>${participant.local ? "Bạn" : "Đang kết nối"}</span></div>
      <ul aria-label="Trạng thái thiết bị"><li title="Microphone">${media.mic === false ? "Mic tắt" : "Mic bật"}</li><li title="Camera">${media.screen ? "Chia sẻ" : media.camera === false ? "Camera tắt" : "Camera bật"}</li></ul>
    </article>`;
  }

  function renderParticipants(instance) {
    const target = instance.root.querySelector("[data-live-participants]");
    if (!target) return;
    target.classList.toggle("is-speaker", instance.preferences.layout === "speaker");
    target.innerHTML = [...instance.participants.values()].map(participantMarkup).join("");
    const count = instance.root.querySelector("[data-live-participant-count]");
    if (count) count.textContent = String(instance.participants.size);
  }

  function queueMarkup(item, index, currentIndex) {
    const type = item.type === "video" ? "Video" : "Âm thanh";
    return `<li class="${index === currentIndex ? "is-active" : ""}" draggable="true" data-queue-item="${escapeHTML(item.id)}">
      <button type="button" data-queue-play="${escapeHTML(item.id)}" aria-label="Phát ${escapeHTML(item.title)}"><span>${item.type === "video" ? "▶" : "♫"}</span><b>${escapeHTML(item.title)}</b><small>${type}${item.local ? " · Chỉ thiết bị này" : " · Có thể đồng bộ"}</small></button>
      <button type="button" data-queue-remove="${escapeHTML(item.id)}" aria-label="Xóa khỏi hàng đợi">×</button>
    </li>`;
  }

  function renderQueue(instance) {
    const target = instance.root.querySelector("[data-live-queue]");
    if (!target) return;
    target.innerHTML = instance.queue.length
      ? instance.queue.map((item, index) => queueMarkup(item, index, instance.currentIndex)).join("")
      : '<li class="live-empty">Thêm URL công khai hoặc chọn media trên thiết bị để bắt đầu.</li>';
    const count = instance.root.querySelector("[data-live-queue-count]");
    if (count) count.textContent = `${instance.queue.length} mục`;
  }

  function renderPlayer(instance) {
    const host = instance.root.querySelector("[data-live-player]");
    if (!host) return;
    const item = instance.queue[instance.currentIndex];
    if (!item) {
      host.innerHTML = '<div class="live-player-empty"><span aria-hidden="true">▶</span><strong>Phòng xem và nghe chung</strong><p>Hàng đợi chưa có media. Nội dung từ máy chỉ phát cục bộ; URL công khai mới có thể đồng bộ sang thiết bị khác.</p></div>';
      return;
    }
    const tag = item.type === "video" ? "video" : "audio";
    host.innerHTML = `<${tag} data-live-media controls preload="metadata" playsinline src="${escapeHTML(item.url)}"></${tag}><div class="live-now-playing"><span>ĐANG PHÁT</span><strong>${escapeHTML(item.title)}</strong><small>${item.local ? "Tệp cục bộ không được tải lên máy chủ" : "URL công khai · sẵn sàng đồng bộ"}</small></div>`;
    const media = host.querySelector("[data-live-media]");
    media.volume = instance.preferences.mediaVolume;
    media.addEventListener("play", () => broadcastPlayback(instance, "play"));
    media.addEventListener("pause", () => broadcastPlayback(instance, "pause"));
    media.addEventListener("seeked", () => broadcastPlayback(instance, "seek"));
    media.addEventListener("volumechange", () => {
      instance.preferences.mediaVolume = media.volume;
      savePreferences(instance);
    });
    media.addEventListener("ended", () => playQueueAt(instance, Math.min(instance.currentIndex + 1, instance.queue.length - 1), true));
  }

  function playQueueAt(instance, index, autoplay = false) {
    if (!instance.queue.length) return;
    instance.currentIndex = clamp(index, 0, instance.queue.length - 1);
    renderQueue(instance);
    renderPlayer(instance);
    const item = instance.queue[instance.currentIndex];
    if (instance.preferences.syncMode && !instance.suppressSync && !item.local) {
      socketEmit(instance, "live:media:queue", { action: "select", item: { id: item.id, title: item.title, type: item.type, url: item.url }, index: instance.currentIndex });
    }
    if (autoplay) instance.root.querySelector("[data-live-media]")?.play().catch(() => status(instance, "Trình duyệt cần một lần bấm để phát media.", "warning"));
  }

  function broadcastPlayback(instance, action) {
    if (!instance.preferences.syncMode || instance.suppressSync) return;
    const item = instance.queue[instance.currentIndex];
    const media = instance.root.querySelector("[data-live-media]");
    if (!item || item.local || !media) return;
    socketEmit(instance, "live:media:sync", { action, itemId: item.id, currentTime: Number(media.currentTime || 0), paused: media.paused });
  }

  function receivePlayback(instance, payload = {}) {
    if (!instance.preferences.syncMode || payload.room !== instance.roomId()) return;
    const media = instance.root.querySelector("[data-live-media]");
    if (!media) return;
    instance.suppressSync = true;
    if (Number.isFinite(Number(payload.currentTime)) && Math.abs(media.currentTime - Number(payload.currentTime)) > 1.5) media.currentTime = Number(payload.currentTime);
    if (payload.action === "play") media.play().catch(() => status(instance, "Nhấn phát để cho phép đồng bộ âm thanh trên thiết bị này.", "warning"));
    if (payload.action === "pause") media.pause();
    window.setTimeout(() => { instance.suppressSync = false; }, 180);
  }

  function receiveQueue(instance, payload = {}) {
    if (!instance.preferences.syncMode || payload.room !== instance.roomId() || payload.action !== "select" || !payload.item || !isHttpUrl(payload.item.url)) return;
    let index = instance.queue.findIndex((item) => item.id === payload.item.id || item.url === payload.item.url);
    if (index < 0) {
      instance.queue.push({ ...payload.item, id: payload.item.id || makeId("media"), local: false });
      index = instance.queue.length - 1;
    }
    instance.suppressSync = true;
    playQueueAt(instance, index);
    instance.suppressSync = false;
  }

  function addUrl(instance) {
    const input = instance.root.querySelector("[data-live-media-url]");
    const value = input?.value.trim() || "";
    if (!isHttpUrl(value)) return status(instance, "Hãy nhập URL media công khai bắt đầu bằng https:// hoặc http://.", "error");
    let parsed;
    try { parsed = new URL(value); } catch { return status(instance, "URL media không hợp lệ.", "error"); }
    const extension = parsed.pathname.split(".").at(-1)?.toLowerCase();
    const type = ["mp4", "webm", "mov", "m4v", "ogv"].includes(extension) ? "video" : "audio";
    const item = { id: makeId("media"), title: decodeURIComponent(parsed.pathname.split("/").filter(Boolean).at(-1) || parsed.hostname), type, url: value, local: false };
    instance.queue.push(item);
    if (input) input.value = "";
    renderQueue(instance);
    if (instance.currentIndex < 0) playQueueAt(instance, 0);
    status(instance, "Đã thêm URL vào hàng đợi dùng chung.", "success");
  }

  function addFiles(instance, files) {
    const accepted = [...(files || [])].filter((file) => /^(audio|video)\//.test(file.type));
    if (!accepted.length) return status(instance, "Không tìm thấy tệp âm thanh hoặc video phù hợp.", "error");
    accepted.forEach((file) => {
      const url = URL.createObjectURL(file);
      instance.objectUrls.add(url);
      instance.queue.push({ id: makeId("local"), title: file.name, type: file.type.startsWith("video/") ? "video" : "audio", url, local: true });
    });
    renderQueue(instance);
    if (instance.currentIndex < 0) playQueueAt(instance, 0);
    status(instance, `Đã thêm ${accepted.length} tệp cục bộ. Tệp không được tải lên hoặc chia sẻ.`, "success");
  }

  async function requestPreviewMedia(instance) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Trình duyệt không hỗ trợ camera/microphone.");
    stopPreview(instance);
    instance.previewStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: instance.preferences.callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false
    });
    const video = instance.root.querySelector("[data-live-preview]");
    if (video) {
      video.srcObject = instance.previewStream;
      video.hidden = !instance.previewStream.getVideoTracks().length;
    }
    instance.permissionGranted = true;
    await enumerateDevices(instance);
    instance.root.querySelector("[data-live-devices]")?.removeAttribute("hidden");
    status(instance, "Thiết bị hoạt động. Bản xem trước chỉ ở trên máy của bạn.", "success");
  }

  function stopPreview(instance) {
    instance.previewStream?.getTracks().forEach((track) => track.stop());
    instance.previewStream = null;
    const video = instance.root.querySelector("[data-live-preview]");
    if (video) {
      video.srcObject = null;
      video.hidden = true;
    }
  }

  async function enumerateDevices(instance) {
    if (!instance.permissionGranted || !navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const groups = {
      audioinput: devices.filter((device) => device.kind === "audioinput"),
      videoinput: devices.filter((device) => device.kind === "videoinput"),
      audiooutput: devices.filter((device) => device.kind === "audiooutput")
    };
    [["microphone", "audioinput"], ["camera", "videoinput"], ["speaker", "audiooutput"]].forEach(([name, kind]) => {
      const select = instance.root.querySelector(`[data-live-device="${name}"]`);
      if (!select) return;
      const label = name === "microphone" ? "Microphone" : name === "camera" ? "Camera" : "Loa";
      select.innerHTML = groups[kind].map((device, index) => `<option value="${escapeHTML(device.deviceId)}">${escapeHTML(device.label || `${label} ${index + 1}`)}</option>`).join("") || `<option value="">${label} mặc định</option>`;
      if (name === "speaker" && typeof HTMLMediaElement.prototype.setSinkId !== "function") {
        select.disabled = true;
        select.title = "Trình duyệt không hỗ trợ đổi thiết bị phát.";
      }
    });
  }

  async function switchPreviewDevice(instance, kind, deviceId) {
    if (!instance.permissionGranted) throw new Error("Hãy kiểm tra thiết bị trước khi đổi nguồn.");
    if (kind === "speaker") {
      const media = [...instance.root.querySelectorAll("audio, video")];
      if (!media.some((element) => typeof element.setSinkId === "function")) throw new Error("Trình duyệt không hỗ trợ chọn loa.");
      await Promise.all(media.filter((element) => typeof element.setSinkId === "function").map((element) => element.setSinkId(deviceId)));
      return;
    }
    const constraints = kind === "microphone" ? { audio: { deviceId: { exact: deviceId } } } : { video: { deviceId: { exact: deviceId } } };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const newTrack = kind === "microphone" ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];
    const oldTrack = kind === "microphone" ? instance.previewStream?.getAudioTracks()[0] : instance.previewStream?.getVideoTracks()[0];
    oldTrack?.stop();
    if (oldTrack) instance.previewStream.removeTrack(oldTrack);
    instance.previewStream.addTrack(newTrack);
    const video = instance.root.querySelector("[data-live-preview]");
    if (video) video.srcObject = instance.previewStream;
  }

  async function startCall(instance) {
    const room = instance.roomId();
    if (!room || room.length < 2) return status(instance, "Nhập tên phòng hoặc người nhận trước khi gọi.", "error");
    const calls = window.HHCalls;
    if (!calls?.start || !calls.available?.()) return status(instance, "Máy chủ Socket.IO chưa sẵn sàng. Cuộc gọi thật chưa thể bắt đầu.", "error");
    const button = instance.root.querySelector("[data-live-start-call]");
    if (button) button.disabled = true;
    stopPreview(instance);
    status(instance, "Đang yêu cầu quyền thiết bị và kết nối cuộc gọi...", "info");
    try {
      await calls.start(room, instance.preferences.callType);
      instance.callActive = true;
      instance.root.classList.add("is-call-active");
      updateCallButtons(instance);
      status(instance, `${instance.preferences.callType === "video" ? "Cuộc gọi video" : "Cuộc gọi thoại"} đã bắt đầu.`, "success");
    } catch (error) {
      const message = error?.name === "NotAllowedError" ? "Bạn chưa cấp quyền camera/microphone." : error?.message || "Không thể bắt đầu cuộc gọi.";
      status(instance, message, "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function updateCallButtons(instance) {
    const start = instance.root.querySelector("[data-live-start-call]");
    const end = instance.root.querySelector("[data-live-end-call]");
    if (start) start.hidden = instance.callActive;
    if (end) end.hidden = !instance.callActive;
    instance.root.querySelectorAll("[data-live-call-control]").forEach((button) => { button.disabled = !instance.callActive; });
  }

  async function endCall(instance) {
    await window.HHCalls?.hangup?.().catch(() => {});
    instance.callActive = false;
    instance.root.classList.remove("is-call-active");
    updateCallButtons(instance);
    status(instance, "Cuộc gọi đã kết thúc.", "info");
  }

  function delegateCallControl(instance, control, button) {
    const existing = document.querySelector(`[data-hh-call-stage] [data-call-control="${control}"]`);
    if (!existing) return status(instance, "Bảng điều khiển WebRTC chưa sẵn sàng.", "warning");
    existing.click();
    if (button && ["mic", "camera", "screen"].includes(control)) button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
  }

  async function openPictureInPicture(instance) {
    const video = document.querySelector("[data-hh-call-stage] video:not([hidden])") || instance.root.querySelector("video[data-live-media], [data-live-preview]:not([hidden])");
    if (!video) throw new Error("Chưa có video để mở Picture-in-Picture.");
    if (!document.pictureInPictureEnabled || typeof video.requestPictureInPicture !== "function") throw new Error("Trình duyệt không hỗ trợ Picture-in-Picture cho video này.");
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await video.requestPictureInPicture();
  }

  function toggleMiniPlayer(instance) {
    instance.preferences.compact = !instance.preferences.compact;
    instance.root.classList.toggle("is-mini", instance.preferences.compact);
    const button = instance.root.querySelector("[data-live-mini]");
    if (button) button.setAttribute("aria-pressed", String(instance.preferences.compact));
    savePreferences(instance);
  }

  function addReaction(instance, emoji, remoteName = "Bạn") {
    const rail = instance.root.querySelector("[data-live-reaction-rail]");
    if (!rail) return;
    const node = document.createElement("span");
    node.textContent = emoji;
    node.title = `${remoteName} đã thả cảm xúc ${emoji}`;
    rail.append(node);
    window.setTimeout(() => node.remove(), 2400);
  }

  function enableNotes(instance) {
    const consent = instance.root.querySelector("[data-live-notes-consent]");
    if (!consent?.checked) return status(instance, "Chỉ bật ghi chú sau khi mọi người trong cuộc gọi đã đồng ý.", "warning");
    instance.notesEnabled = true;
    instance.root.querySelector("[data-live-notes-panel]")?.removeAttribute("hidden");
    status(instance, "Ghi chú cộng tác đã bật cho phiên này. Nội dung không được lưu tự động trên thiết bị.", "success");
  }

  function addNote(instance) {
    if (!instance.notesEnabled) return status(instance, "Cần xác nhận đồng thuận trước khi ghi chú.", "warning");
    const input = instance.root.querySelector("[data-live-note-input]");
    const text = input?.value.trim() || "";
    if (!text) return;
    const person = currentUser().name || "Thành viên HH";
    const note = { id: makeId("note"), text: text.slice(0, 800), author: person, createdAt: new Date().toISOString() };
    instance.notes.push(note);
    if (input) input.value = "";
    renderNotes(instance);
    socketEmit(instance, "live:notes", { action: "add", note });
  }

  function renderNotes(instance) {
    const target = instance.root.querySelector("[data-live-notes-list]");
    if (!target) return;
    target.innerHTML = instance.notes.map((note) => `<li><span>${new Date(note.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span><div><strong>${escapeHTML(note.author)}</strong><p>${escapeHTML(note.text)}</p></div></li>`).join("") || "<li class=\"live-empty\">Chưa có ghi chú trong phiên này.</li>";
  }

  function receiveNote(instance, payload = {}) {
    if (!instance.notesEnabled || payload.room !== instance.roomId() || payload.action !== "add" || !payload.note?.text) return;
    if (instance.notes.some((note) => note.id === payload.note.id)) return;
    instance.notes.push({ id: String(payload.note.id || makeId("note")), text: String(payload.note.text).slice(0, 800), author: String(payload.note.author || "Thành viên HH").slice(0, 80), createdAt: payload.note.createdAt || new Date().toISOString() });
    renderNotes(instance);
  }

  function exportNotes(instance) {
    if (!instance.notes.length) return status(instance, "Chưa có ghi chú để xuất.", "warning");
    const content = [`GHI CHÚ LIVE ROOM: ${instance.roomId()}`, `Xuất lúc: ${new Date().toLocaleString("vi-VN")}`, "", ...instance.notes.map((note) => `[${new Date(note.createdAt).toLocaleTimeString("vi-VN")}] ${note.author}: ${note.text}`)].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hh-live-notes-${Date.now()}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bindSocket(instance, candidate = window.HHRealtimeSocket) {
    if (!candidate || instance.socket === candidate) return;
    unbindSocket(instance);
    instance.socket = candidate;
    instance.socketHandlers = {
      connect: () => { status(instance, "Realtime đã kết nối.", "success"); loadCallConfig(instance).catch(() => {}); },
      disconnect: () => status(instance, "Realtime bị ngắt; cuộc gọi và đồng bộ có thể gián đoạn.", "warning"),
      participantJoined: (payload = {}) => {
        if (!payload.participant?.socketId) return;
        instance.participants.set(payload.participant.socketId, { id: payload.participant.socketId, name: payload.participant.user?.name || "Thành viên HH", media: payload.participant.media || {} });
        renderParticipants(instance);
      },
      participantLeft: (payload = {}) => { if (payload.socketId) instance.participants.delete(payload.socketId); renderParticipants(instance); },
      participantMedia: (payload = {}) => { const person = instance.participants.get(payload.socketId); if (person) { person.media = payload.media || {}; renderParticipants(instance); } },
      callEnded: () => { instance.callActive = false; updateCallButtons(instance); status(instance, "Máy chủ đã kết thúc cuộc gọi.", "info"); },
      mediaSync: (payload) => receivePlayback(instance, payload),
      mediaQueue: (payload) => receiveQueue(instance, payload),
      reaction: (payload = {}) => { if (payload.room === instance.roomId() && payload.emoji) addReaction(instance, String(payload.emoji).slice(0, 4), payload.name || "Thành viên"); },
      notes: (payload) => receiveNote(instance, payload)
    };
    Object.entries({
      connect: instance.socketHandlers.connect,
      disconnect: instance.socketHandlers.disconnect,
      "call:participant:joined": instance.socketHandlers.participantJoined,
      "call:participant:left": instance.socketHandlers.participantLeft,
      "call:participant:media": instance.socketHandlers.participantMedia,
      "call:ended": instance.socketHandlers.callEnded,
      "live:media:sync": instance.socketHandlers.mediaSync,
      "live:media:queue": instance.socketHandlers.mediaQueue,
      "live:reaction": instance.socketHandlers.reaction,
      "live:notes": instance.socketHandlers.notes
    }).forEach(([event, handler]) => candidate.on?.(event, handler));
  }

  function unbindSocket(instance) {
    if (!instance.socket || !instance.socketHandlers) return;
    Object.entries({
      connect: instance.socketHandlers.connect,
      disconnect: instance.socketHandlers.disconnect,
      "call:participant:joined": instance.socketHandlers.participantJoined,
      "call:participant:left": instance.socketHandlers.participantLeft,
      "call:participant:media": instance.socketHandlers.participantMedia,
      "call:ended": instance.socketHandlers.callEnded,
      "live:media:sync": instance.socketHandlers.mediaSync,
      "live:media:queue": instance.socketHandlers.mediaQueue,
      "live:reaction": instance.socketHandlers.reaction,
      "live:notes": instance.socketHandlers.notes
    }).forEach(([event, handler]) => instance.socket.off?.(event, handler));
    instance.socketHandlers = null;
    instance.socket = null;
  }

  function receiveChannel(instance, event) {
    const packet = event.data || {};
    if (!packet.event || packet.source === instance.id) return;
    if (packet.event === "live:media:sync") receivePlayback(instance, packet.payload);
    if (packet.event === "live:media:queue") receiveQueue(instance, packet.payload);
    if (packet.event === "live:reaction" && packet.payload?.room === instance.roomId()) addReaction(instance, packet.payload.emoji, packet.payload.name || "Thành viên");
    if (packet.event === "live:notes") receiveNote(instance, packet.payload);
  }

  function workspaceMarkup(instance) {
    const person = currentUser();
    const viewTitle = instance.view === "calls" ? "Cuộc gọi HH" : "Live Room HH";
    return `<section class="communication-live-room ${instance.preferences.compact ? "is-mini" : ""}" data-live-room aria-labelledby="live-room-title">
      <header class="live-hero">
        <div><span class="live-kicker"><i></i> COMMUNICATION · WEBRTC</span><h2 id="live-room-title">${viewTitle}</h2><p>Gọi thoại, gọi video, chia sẻ màn hình và cùng xem media trong một workspace. Quyền camera/microphone chỉ được hỏi sau khi bạn chủ động bấm.</p></div>
        <div class="live-hero__actions"><button type="button" data-live-mini aria-pressed="${instance.preferences.compact}">Thu nhỏ</button><button type="button" data-live-pip>Picture-in-Picture</button><span class="live-capacity" data-live-capacity>Đang kiểm tra giới hạn</span></div>
      </header>

      <div class="live-status" data-live-status data-tone="info" role="status">Đang kiểm tra signaling và ICE...</div>
      <div class="live-shell">
        <aside class="live-sidebar" aria-label="Thiết lập cuộc gọi">
          <section class="live-card live-call-setup"><header><span>PHÒNG TRỰC TIẾP</span><strong>Thiết lập cuộc gọi</strong></header>
            <label>Tên phòng hoặc người nhận<input type="text" maxlength="80" data-live-room-name placeholder="Ví dụ: team-music" autocomplete="off"></label>
            <fieldset><legend>Loại cuộc gọi</legend><label><input type="radio" name="live-call-type-${instance.id}" value="video" data-live-call-type ${instance.preferences.callType === "video" ? "checked" : ""}> Video</label><label><input type="radio" name="live-call-type-${instance.id}" value="audio" data-live-call-type ${instance.preferences.callType === "audio" ? "checked" : ""}> Thoại</label></fieldset>
            <fieldset><legend>Phạm vi</legend><label><input type="radio" name="live-call-scope-${instance.id}" value="group" data-live-call-scope ${instance.preferences.callScope === "group" ? "checked" : ""}> Nhóm</label><label><input type="radio" name="live-call-scope-${instance.id}" value="direct" data-live-call-scope ${instance.preferences.callScope === "direct" ? "checked" : ""}> Một-một</label></fieldset>
            <video data-live-preview autoplay muted playsinline hidden aria-label="Xem trước camera"></video>
            <div class="live-call-setup__buttons"><button type="button" data-live-test-devices>Kiểm tra thiết bị</button><button class="is-primary" type="button" data-live-start-call>Bắt đầu gọi</button><button class="is-danger" type="button" data-live-end-call hidden>Kết thúc</button></div>
            <div class="live-device-grid" data-live-devices hidden><label>Microphone<select data-live-device="microphone"></select></label><label>Camera<select data-live-device="camera"></select></label><label>Loa<select data-live-device="speaker"></select></label></div>
          </section>

          <section class="live-card live-security-card"><header><span>BẢO MẬT KẾT NỐI</span><strong>ICE & truyền tải</strong></header><ul data-live-security></ul><button type="button" data-live-refresh-ice>Kiểm tra lại</button></section>
        </aside>

        <main class="live-stage">
          <section class="live-card live-room-stage">
            <header class="live-room-stage__head"><div><span>PHÒNG ĐANG HOẠT ĐỘNG</span><strong>Không gian cuộc gọi</strong></div><div><button type="button" data-live-layout="grid" aria-pressed="${instance.preferences.layout === "grid"}">Lưới</button><button type="button" data-live-layout="speaker" aria-pressed="${instance.preferences.layout === "speaker"}">Diễn giả</button><b><span data-live-participant-count>1</span> người</b></div></header>
            <div class="live-participants" data-live-participants></div>
            <div class="live-call-controls" role="toolbar" aria-label="Điều khiển cuộc gọi"><button type="button" data-live-call-control="mic" aria-pressed="true" disabled>Mic</button><button type="button" data-live-call-control="camera" aria-pressed="true" disabled>Camera</button><button type="button" data-live-call-control="screen" aria-pressed="false" disabled>Chia sẻ màn hình</button><button type="button" data-live-call-control="devices" disabled>Thiết bị</button></div>
            <div class="live-reactions" aria-label="Cảm xúc nhanh">${["👍", "❤️", "🎉", "😂", "👏", "✨"].map((emoji) => `<button type="button" data-live-reaction="${emoji}" aria-label="Thả cảm xúc ${emoji}">${emoji}</button>`).join("")}</div>
            <div class="live-reaction-rail" data-live-reaction-rail aria-hidden="true"></div>
          </section>

          <section class="live-card live-watch-room"><header><div><span>CREATIVE ROOM</span><strong>Xem và nghe chung</strong></div><label class="live-switch"><input type="checkbox" data-live-sync ${instance.preferences.syncMode ? "checked" : ""}><span>Đồng bộ</span></label></header>
            <div class="live-watch-layout"><div class="live-player" data-live-player></div><aside><form data-live-url-form><label>URL media công khai<input type="url" data-live-media-url placeholder="https://.../video.mp4"></label><button type="submit">Thêm URL</button></form><label class="live-file-button">Chọn media trên máy<input type="file" data-live-files accept="audio/*,video/*" multiple></label><div class="live-queue-head"><strong>Hàng đợi</strong><span data-live-queue-count>0 mục</span></div><ol data-live-queue></ol></aside></div>
          </section>
        </main>

        <aside class="live-collaboration" aria-label="Cộng tác trong cuộc gọi">
          <section class="live-card live-presence"><header><span>THÀNH VIÊN</span><strong>Hiện diện</strong></header><article><span>${escapeHTML(initials(person.name))}</span><div><strong>${escapeHTML(person.name || "Bạn")}</strong><small>${instance.socket?.connected ? "Đang online" : "Chưa kết nối realtime"}</small></div><i></i></article></section>
          <section class="live-card live-notes-consent"><header><span>GHI CHÚ CUỘC GỌI</span><strong>Đồng thuận trước</strong></header><p>HH không tự ghi âm hoặc tạo biên bản. Chỉ bật ghi chú khi mọi người đã đồng ý.</p><label><input type="checkbox" data-live-notes-consent> Tôi xác nhận đã có sự đồng ý</label><button type="button" data-live-enable-notes>Bật ghi chú phiên</button></section>
          <section class="live-card live-notes" data-live-notes-panel hidden><header><span>SHARED NOTES</span><strong>Ghi chú phiên</strong><button type="button" data-live-export-notes>Xuất TXT</button></header><ol data-live-notes-list></ol><form data-live-note-form><label class="sr-only" for="live-note-${instance.id}">Nội dung ghi chú</label><textarea id="live-note-${instance.id}" data-live-note-input rows="3" maxlength="800" placeholder="Quyết định, việc cần làm..."></textarea><button type="submit">Thêm ghi chú</button></form></section>
        </aside>
      </div>
      <p class="live-privacy-note">Không lưu camera, microphone, tên phòng, thiết bị hoặc nội dung media vào localStorage. E2EE chưa được triển khai; không chia sẻ nội dung nhạy cảm nếu bạn không tin tưởng các thành viên.</p>
      <div class="sr-only" data-live-announcer aria-live="polite"></div>
    </section>`;
  }

  function handleClick(instance, event) {
    const target = event.target;
    if (target.closest("[data-live-test-devices]")) {
      requestPreviewMedia(instance).catch((error) => status(instance, error?.name === "NotAllowedError" ? "Bạn đã từ chối quyền camera/microphone." : error.message, "error"));
      return;
    }
    if (target.closest("[data-live-start-call]")) { startCall(instance); return; }
    if (target.closest("[data-live-end-call]")) { endCall(instance); return; }
    const callControl = target.closest("[data-live-call-control]");
    if (callControl) { delegateCallControl(instance, callControl.dataset.liveCallControl, callControl); return; }
    if (target.closest("[data-live-refresh-ice]")) { loadCallConfig(instance); return; }
    if (target.closest("[data-live-mini]")) { toggleMiniPlayer(instance); return; }
    if (target.closest("[data-live-pip]")) { openPictureInPicture(instance).catch((error) => status(instance, error.message, "warning")); return; }
    const layout = target.closest("[data-live-layout]");
    if (layout) {
      instance.preferences.layout = layout.dataset.liveLayout === "speaker" ? "speaker" : "grid";
      savePreferences(instance);
      instance.root.querySelectorAll("[data-live-layout]").forEach((button) => button.setAttribute("aria-pressed", String(button === layout)));
      renderParticipants(instance);
      return;
    }
    const queuePlay = target.closest("[data-queue-play]");
    if (queuePlay) { playQueueAt(instance, instance.queue.findIndex((item) => item.id === queuePlay.dataset.queuePlay), true); return; }
    const queueRemove = target.closest("[data-queue-remove]");
    if (queueRemove) {
      const index = instance.queue.findIndex((item) => item.id === queueRemove.dataset.queueRemove);
      const [removed] = instance.queue.splice(index, 1);
      if (removed?.local) { URL.revokeObjectURL(removed.url); instance.objectUrls.delete(removed.url); }
      instance.currentIndex = instance.queue.length ? clamp(instance.currentIndex, 0, instance.queue.length - 1) : -1;
      renderQueue(instance); renderPlayer(instance); return;
    }
    const reaction = target.closest("[data-live-reaction]");
    if (reaction) {
      addReaction(instance, reaction.dataset.liveReaction);
      socketEmit(instance, "live:reaction", { emoji: reaction.dataset.liveReaction, name: currentUser().name || "Thành viên HH" });
      announce(instance, `Đã gửi cảm xúc ${reaction.dataset.liveReaction}`);
      return;
    }
    if (target.closest("[data-live-enable-notes]")) { enableNotes(instance); return; }
    if (target.closest("[data-live-export-notes]")) { exportNotes(instance); }
  }

  function handleChange(instance, event) {
    const type = event.target.closest("[data-live-call-type]");
    if (type) { instance.preferences.callType = type.value === "audio" ? "audio" : "video"; savePreferences(instance); stopPreview(instance); return; }
    const scope = event.target.closest("[data-live-call-scope]");
    if (scope) { instance.preferences.callScope = scope.value === "direct" ? "direct" : "group"; savePreferences(instance); return; }
    const device = event.target.closest("[data-live-device]");
    if (device) { switchPreviewDevice(instance, device.dataset.liveDevice, device.value).then(() => status(instance, "Đã chuyển thiết bị xem trước.", "success")).catch((error) => status(instance, error.message, "error")); return; }
    if (event.target.matches("[data-live-files]")) { addFiles(instance, event.target.files); event.target.value = ""; return; }
    if (event.target.matches("[data-live-sync]")) { instance.preferences.syncMode = event.target.checked; savePreferences(instance); status(instance, event.target.checked ? "Đã bật đồng bộ media cho phòng." : "Đã tắt đồng bộ media.", "info"); }
  }

  function handleSubmit(instance, event) {
    if (event.target.matches("[data-live-url-form]")) { event.preventDefault(); addUrl(instance); return; }
    if (event.target.matches("[data-live-note-form]")) { event.preventDefault(); addNote(instance); }
  }

  function handleKeydown(instance, event) {
    if (event.key === "Escape" && instance.preferences.compact) toggleMiniPlayer(instance);
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "m") {
      event.preventDefault();
      const button = instance.root.querySelector('[data-live-call-control="mic"]');
      if (!button?.disabled) delegateCallControl(instance, "mic", button);
    }
  }

  function mount(root, options = {}) {
    if (!root || typeof root.querySelector !== "function") throw new TypeError("HHCommunicationLiveRoom.mount cần một root DOM hợp lệ.");
    unmount(root);
    const view = normalizeView(options.view || options.route || "live-room");
    if (!supports(view)) throw new Error(`View không được hỗ trợ: ${view}`);
    const person = currentUser();
    const instance = {
      id: makeId("live"), root, view,
      apiBase: String(options.apiBase || window.HH_REALTIME_URL || "").replace(/\/$/, ""),
      preferences: readPreferences(), security: { configured: false, turn: false, stun: false, secureTransport: location.protocol === "https:", maxParticipants: 8, e2ee: false },
      socket: null, socketHandlers: null, previewStream: null, permissionGranted: false, callActive: false,
      participants: new Map([["local", { id: "local", name: person.name || "Bạn", local: true, media: { mic: true, camera: true } }]]),
      queue: [], currentIndex: -1, objectUrls: new Set(), suppressSync: false, notesEnabled: false, notes: [], channel: null,
      roomId: () => instance.root.querySelector("[data-live-room-name]")?.value.trim().slice(0, 80) || "hh-live-lobby"
    };
    root.innerHTML = workspaceMarkup(instance);
    root.classList.add("hh-live-room-host");
    instance.onClick = (event) => handleClick(instance, event);
    instance.onChange = (event) => handleChange(instance, event);
    instance.onSubmit = (event) => handleSubmit(instance, event);
    instance.onKeydown = (event) => handleKeydown(instance, event);
    instance.onRealtimeReady = (event) => bindSocket(instance, event.detail?.socket || window.HHRealtimeSocket);
    instance.onRealtimeOffline = () => status(instance, "Realtime ngoại tuyến; media cục bộ vẫn dùng được.", "warning");
    root.addEventListener("click", instance.onClick);
    root.addEventListener("change", instance.onChange);
    root.addEventListener("submit", instance.onSubmit);
    root.addEventListener("keydown", instance.onKeydown);
    window.addEventListener("hh:realtime-ready", instance.onRealtimeReady);
    window.addEventListener("hh:realtime-offline", instance.onRealtimeOffline);
    if ("BroadcastChannel" in window) {
      instance.channel = new BroadcastChannel(CHANNEL_NAME);
      instance.onChannel = (event) => receiveChannel(instance, event);
      instance.channel.addEventListener("message", instance.onChannel);
    }
    bindSocket(instance, options.socket || window.HHRealtimeSocket);
    renderParticipants(instance);
    renderQueue(instance);
    renderPlayer(instance);
    renderNotes(instance);
    renderSecurity(instance);
    updateCallButtons(instance);
    instances.set(root, instance);
    loadCallConfig(instance).catch(() => {});
    return Object.freeze({ view, refreshConfig: () => loadCallConfig(instance), unmount: () => unmount(root) });
  }

  function unmount(root) {
    const targets = root ? [root] : [...instances.keys()];
    let changed = false;
    targets.forEach((target) => {
      const instance = instances.get(target);
      if (!instance) return;
      changed = true;
      stopPreview(instance);
      instance.objectUrls.forEach((url) => URL.revokeObjectURL(url));
      instance.channel?.removeEventListener("message", instance.onChannel);
      instance.channel?.close();
      unbindSocket(instance);
      target.removeEventListener("click", instance.onClick);
      target.removeEventListener("change", instance.onChange);
      target.removeEventListener("submit", instance.onSubmit);
      target.removeEventListener("keydown", instance.onKeydown);
      window.removeEventListener("hh:realtime-ready", instance.onRealtimeReady);
      window.removeEventListener("hh:realtime-offline", instance.onRealtimeOffline);
      target.classList.remove("hh-live-room-host", "is-mini", "is-call-active");
      instances.delete(target);
    });
    return changed;
  }

  window.HHCommunicationLiveRoom = Object.freeze({ supports, mount, unmount, STORAGE_KEY });
})();
