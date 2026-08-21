(function (globalScope, factory) {
  "use strict";
  const api = factory(globalScope);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHRemoteHub = api;
})(typeof window !== "undefined" ? window : null, function (global) {
  "use strict";

  const VERSION = 3;
  const STORAGE_PREFIX = "hh.remote.v3";
  const MAX_FILE_BYTES = 32 * 1024 * 1024;
  const CHUNK_BYTES = 64 * 1024;
  const MAX_DATA_MESSAGE_BYTES = 48_000;
  const BACKPRESSURE_BYTES = 768 * 1024;
  const DEFAULT_ICE = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  const VIEWS = [
    ["quick", "⌁", "Kết nối nhanh", "Mã phiên + PIN"],
    ["live", "◉", "Phòng đang phát", "Chọn ai được xem"],
    ["control", "◈", "Quyền điều khiển", "Cho phép theo tác vụ"],
    ["assist", "◎", "Hỗ trợ trực tiếp", "Chat và con trỏ"],
    ["files", "⇄", "Tệp P2P", "Tối đa 32 MB"],
    ["network", "≋", "Chất lượng mạng", "Tự thích ứng"],
    ["devices", "▣", "Thiết bị", "Phiên đang hoạt động"],
    ["security", "◇", "Bảo mật", "Zero-trust session"]
  ];
  const QUALITY_PROFILES = Object.freeze({
    saver: Object.freeze({ label: "Tiết kiệm dữ liệu", width: 960, height: 540, frameRate: 12, bitrate: 700_000 }),
    balanced: Object.freeze({ label: "Cân bằng", width: 1280, height: 720, frameRate: 20, bitrate: 1_500_000 }),
    sharp: Object.freeze({ label: "Sắc nét", width: 1920, height: 1080, frameRate: 30, bitrate: 3_500_000 })
  });
  const PERMISSIONS = Object.freeze({
    chat: Object.freeze({ label: "Trò chuyện", note: "Tin nhắn P2P trong phiên", default: true }),
    pointer: Object.freeze({ label: "Con trỏ laser", note: "Chỉ hiển thị vị trí, không bấm máy", default: true }),
    clipboard: Object.freeze({ label: "Gửi clipboard", note: "Chỉ đọc sau khi người dùng bấm", default: false }),
    files: Object.freeze({ label: "Truyền tệp", note: "Tệp P2P tối đa 32 MB", default: false }),
    screenshot: Object.freeze({ label: "Chụp màn hình", note: "Lưu PNG trên thiết bị đang xem", default: false }),
    recording: Object.freeze({ label: "Ghi hình phiên", note: "Hiện chỉ báo đỏ trong suốt quá trình", default: false })
  });

  let root = null;
  let options = {};
  let aborter = null;
  let socket = null;
  let localStream = null;
  let activeRole = "host";
  let activeView = "quick";
  let session = null;
  let channel = null;
  let channels = new Map();
  let peers = new Map();
  let peerDevices = new Map();
  let pendingCandidates = new Map();
  let incomingFiles = new Map();
  let downloadUrls = new Set();
  let seenMessages = new Set();
  let hostPermissions = {};
  let remotePermissions = {};
  let statsTimer = 0;
  let expiryTimer = 0;
  let recorder = null;
  let recordingChunks = [];
  let isStopping = false;
  let isPaused = false;
  let sessionLocked = false;
  let selectedQuality = "auto";
  let appliedQuality = "balanced";
  let lastStatsSample = null;
  let liveRooms = [];
  let audienceFriends = [];
  let audienceState = { title: "Phòng hỗ trợ màn hình", visibility: "hidden", allowedUserIds: [], requireApproval: true, maxViewers: 1 };

  const clean = (value, limit = 1000) => String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
  const escapeHTML = (value) => clean(value, 5000).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const normalizeCode = (value) => clean(value, 12).toUpperCase().replace(/[^A-Z2-9]/g, "");
  const bytesLabel = (bytes) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  const nowLabel = () => new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const defaultPermissions = () => Object.fromEntries(Object.entries(PERMISSIONS).map(([key, value]) => [key, value.default]));
  const authToken = () => clean(global?.HHAuthSession?.token?.() || "", 4096);
  const openChannels = () => [...channels.values()].filter((item) => item?.readyState === "open");
  const supported = () => ({
    webrtc: Boolean(global?.RTCPeerConnection),
    display: Boolean(global?.navigator?.mediaDevices?.getDisplayMedia),
    dataChannel: Boolean(global?.RTCDataChannel || global?.RTCPeerConnection),
    secure: Boolean(global?.isSecureContext || /^(localhost|127\.0\.0\.1)$/.test(global?.location?.hostname || "")),
    pip: Boolean(global?.document?.pictureInPictureEnabled),
    clipboard: Boolean(global?.navigator?.clipboard),
    recording: Boolean(global?.MediaRecorder),
    screenshot: Boolean(global?.document?.createElement),
    nativeControl: false
  });

  function encodeSignal(value) {
    const text = JSON.stringify(value);
    if (typeof Buffer !== "undefined") return Buffer.from(text, "utf8").toString("base64url");
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return global.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function decodeSignal(value) {
    const input = clean(value, 200_000).replace(/-/g, "+").replace(/_/g, "/");
    if (!input) throw new Error("Mã kết nối đang trống.");
    try {
      if (typeof Buffer !== "undefined") return JSON.parse(Buffer.from(input, "base64").toString("utf8"));
      const binary = global.atob(input + "=".repeat((4 - input.length % 4) % 4));
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new Error("Mã WebRTC không hợp lệ hoặc đã bị cắt mất.");
    }
  }

  function createEnvelope(type, payload = {}) {
    const entropy = global?.crypto?.getRandomValues ? global.crypto.getRandomValues(new Uint32Array(2)).join("") : Math.random().toString(36).slice(2);
    return { v: VERSION, id: `${Date.now().toString(36)}-${entropy}`.slice(0, 80), at: Date.now(), type: clean(type, 32), payload };
  }

  function normalizeEnvelope(value) {
    if (!value || value.v !== VERSION || typeof value.id !== "string" || typeof value.type !== "string" || !Number.isFinite(value.at)) return null;
    const id = clean(value.id, 80);
    const type = clean(value.type, 32);
    if (!id || !type || Math.abs(Date.now() - value.at) > 2 * 60 * 1000) return null;
    return { v: VERSION, id, at: value.at, type, payload: value.payload && typeof value.payload === "object" ? value.payload : {} };
  }

  function ownerKey() {
    const id = clean(options.currentUser?.id || options.currentUser?._id || options.currentUser?.email || "guest", 120).replace(/[^a-z0-9@._-]/gi, "-");
    return `${STORAGE_PREFIX}.${id || "guest"}`;
  }

  function readHistory() {
    try {
      const parsed = JSON.parse(global.localStorage.getItem(ownerKey()) || "null");
      return parsed?.version === VERSION && Array.isArray(parsed.sessions) ? parsed.sessions.slice(0, 30) : [];
    } catch { return []; }
  }

  function saveHistory(entry) {
    try {
      const sessions = [{ at: new Date().toISOString(), role: activeRole, ...entry }, ...readHistory()].slice(0, 30);
      global.localStorage.setItem(ownerKey(), JSON.stringify({ version: VERSION, sessions }));
    } catch {}
    renderHistory();
  }

  function setStatus(message, tone = "idle") {
    const node = root?.querySelector("[data-remote-status]");
    if (!node) return;
    node.dataset.tone = tone;
    const text = node.querySelector("span");
    if (text) text.textContent = clean(message, 240);
  }

  function log(message, tone = "info") {
    const list = root?.querySelector("[data-remote-log]");
    if (!list) return;
    const item = global.document.createElement("p");
    item.dataset.tone = tone;
    const time = global.document.createElement("time");
    time.textContent = nowLabel();
    const text = global.document.createElement("span");
    text.textContent = clean(message, 500);
    item.append(time, text);
    list.prepend(item);
    while (list.children.length > 40) list.lastElementChild?.remove();
  }

  function toast(message, tone = "info") {
    const node = root?.querySelector("[data-remote-toast]");
    if (!node) return;
    node.textContent = clean(message, 300);
    node.dataset.tone = tone;
    node.hidden = false;
    void node.offsetWidth;
    node.classList.add("is-visible");
    global.setTimeout(() => {
      node.classList.remove("is-visible");
      global.setTimeout(() => { if (node.isConnected) node.hidden = true; }, 220);
    }, 3200);
  }

  function setView(view) {
    activeView = VIEWS.some(([id]) => id === view) ? view : "quick";
    root?.querySelector("[data-remote-hub]")?.setAttribute("data-view", activeView);
    root?.querySelectorAll("[data-remote-view]").forEach((button) => {
      const selected = button.dataset.remoteView === activeView;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
    });
    root?.querySelectorAll("[data-remote-pane]").forEach((pane) => { pane.hidden = pane.dataset.remotePane !== activeView; });
    if (activeView === "live") {
      loadAudienceFriends();
      loadLiveRooms();
    }
  }

  function setRole(role) {
    if (session && role !== activeRole) throw new Error("Hãy ngắt phiên hiện tại trước khi đổi vai trò thiết bị.");
    activeRole = role === "viewer" ? "viewer" : "host";
    root?.querySelector("[data-remote-hub]")?.setAttribute("data-role", activeRole);
    root?.querySelectorAll("[data-remote-role]").forEach((button) => button.classList.toggle("is-active", button.dataset.remoteRole === activeRole));
    root?.querySelector("[data-remote-host-form]")?.toggleAttribute("hidden", activeRole !== "host");
    root?.querySelector("[data-remote-join-form]")?.toggleAttribute("hidden", activeRole !== "viewer");
    const manual = root?.querySelector("[data-remote-manual-action]");
    if (manual) manual.textContent = activeRole === "host" ? "Tạo mã mời thủ công" : "Đọc mã mời & tạo trả lời";
    const apply = root?.querySelector("[data-remote-apply-answer]");
    if (apply) apply.hidden = activeRole !== "host";
    renderPermissions();
    renderParticipants();
    syncActionAvailability();
  }

  function renderCapabilities() {
    const caps = supported();
    const grid = root?.querySelector("[data-remote-capabilities]");
    if (!grid) return;
    const rows = [
      ["WebRTC", caps.webrtc, "Media và dữ liệu P2P mã hóa DTLS-SRTP"],
      ["Chia sẻ màn hình", caps.display, caps.display ? "Yêu cầu lại quyền ở mỗi phiên" : "Trình duyệt không hỗ trợ"],
      ["Kênh dữ liệu", caps.dataChannel, "Chat, con trỏ, clipboard và tệp"],
      ["HTTPS", caps.secure, caps.secure ? "Ngữ cảnh an toàn" : "Cần HTTPS hoặc localhost"],
      ["Ghi hình WebM", caps.recording, caps.recording ? "Ghi cục bộ, có chỉ báo" : "Không khả dụng"],
      ["Picture-in-Picture", caps.pip, caps.pip ? "Được hỗ trợ" : "Không khả dụng"],
      ["Điều khiển hệ điều hành", caps.nativeControl, "Cần HH Remote Agent đã ký và xác minh"]
    ];
    grid.innerHTML = rows.map(([name, ok, note]) => `<article data-ok="${ok}"><i>${ok ? "✓" : "!"}</i><span><strong>${escapeHTML(name)}</strong><small>${escapeHTML(note)}</small></span><b>${ok ? "Sẵn sàng" : "Giới hạn"}</b></article>`).join("");
  }

  function renderHistory() {
    const list = root?.querySelector("[data-remote-history]");
    if (!list) return;
    const entries = readHistory();
    list.innerHTML = entries.length ? entries.map((item) => `<article><i>${item.role === "host" ? "PC" : "MB"}</i><span><strong>${item.role === "host" ? "Đã chia sẻ thiết bị" : "Đã xem thiết bị"}</strong><small>${escapeHTML(item.result || "Đã kết thúc")} · ${new Date(item.at).toLocaleString("vi-VN")}</small></span></article>`).join("") : "<p>Chưa có phiên Remote trên thiết bị này.</p>";
  }

  function renderPermissions() {
    const list = root?.querySelector("[data-remote-permissions]");
    if (!list) return;
    const state = activeRole === "host" ? hostPermissions : remotePermissions;
    list.innerHTML = Object.entries(PERMISSIONS).map(([key, meta]) => `<label class="remote-permission"><span><strong>${escapeHTML(meta.label)}</strong><small>${escapeHTML(meta.note)}</small></span><input type="checkbox" data-remote-permission="${key}" ${state[key] ? "checked" : ""} ${activeRole === "viewer" ? "disabled" : ""}><i aria-hidden="true"></i></label>`).join("") + `<article class="remote-native-gate"><i>AGENT</i><span><strong>Điều khiển chuột & bàn phím Windows</strong><small>Không khả dụng trong trình duyệt. Chỉ bật sau khi HH Remote Agent có chữ ký số, xác nhận phiên và nút dừng cục bộ được phát hành.</small></span><b>Chưa cài</b></article>`;
  }

  function renderParticipants() {
    const list = root?.querySelector("[data-remote-participants]");
    if (!list) return;
    const ownName = clean(options.currentUser?.name || "Thiết bị này", 60);
    const entries = [...peerDevices.entries()];
    list.innerHTML = `<article data-current="true"><i>${activeRole === "host" ? "PC" : "ME"}</i><span><strong>${escapeHTML(ownName)}</strong><small>Thiết bị hiện tại · ${activeRole === "host" ? "Chủ phiên" : "Thiết bị hỗ trợ"}</small></span><b>Đang dùng</b></article>` + (entries.length ? entries.map(([id, peer]) => `<article><i>${activeRole === "host" ? "MB" : "PC"}</i><span><strong>${escapeHTML(peer.name || "Thiết bị đã kết nối")}</strong><small>${escapeHTML(peer.device || "Trình duyệt")} · ${peer.connected === false ? "Đang phục hồi" : "P2P online"}</small></span>${activeRole === "host" ? `<button type="button" data-remote-revoke="${escapeHTML(id)}">Thu hồi</button>` : "<b>Đã duyệt</b>"}</article>`).join("") : "<p>Chưa có thiết bị nào khác trong phiên.</p>");
  }

  function readAudienceForm() {
    const visibility = clean(root?.querySelector("[data-remote-audience-visibility]")?.value, 20);
    const allowedUserIds = [...(root?.querySelectorAll("[data-remote-audience-user]:checked") || [])].map((item) => clean(item.value, 120)).filter(Boolean).slice(0, 100);
    return {
      title: clean(root?.querySelector("[data-remote-room-title]")?.value || "Phòng hỗ trợ màn hình", 80),
      visibility: ["hidden", "invited", "friends", "members"].includes(visibility) ? visibility : "hidden",
      allowedUserIds,
      requireApproval: Boolean(root?.querySelector("[data-remote-require-approval]")?.checked),
      maxViewers: Math.max(1, Math.min(6, Number(root?.querySelector("[data-remote-max-viewers]")?.value) || 1))
    };
  }

  function renderAudienceFriends() {
    const list = root?.querySelector("[data-remote-audience-friends]");
    if (!list) return;
    if (!authToken()) list.innerHTML = '<p>Hãy đăng nhập để chọn thành viên hoặc công khai phòng cho người dùng website.</p>';
    else if (!audienceFriends.length) list.innerHTML = '<p>Chưa có bạn bè để chọn. Bạn vẫn có thể chọn “Tất cả thành viên đã đăng nhập”.</p>';
    else list.innerHTML = audienceFriends.map((person) => `<label><input type="checkbox" data-remote-audience-user value="${escapeHTML(person.id)}" ${audienceState.allowedUserIds.includes(person.id) ? "checked" : ""}><i>${escapeHTML((person.name || "H").slice(0, 1).toUpperCase())}</i><span><strong>${escapeHTML(person.name || "Thành viên HH")}</strong><small>${escapeHTML(person.username ? `@${person.username}` : "Bạn bè trên HH")}</small></span></label>`).join("");
    syncAudienceEditor();
  }

  function syncAudienceEditor() {
    const visibility = root?.querySelector("[data-remote-audience-visibility]")?.value || "hidden";
    const picker = root?.querySelector("[data-remote-audience-friends]");
    if (picker) picker.hidden = visibility !== "invited";
    const note = root?.querySelector("[data-remote-audience-note]");
    const notes = {
      hidden: "Không xuất hiện trong danh sách phòng. Người xem cần mã phiên và PIN.",
      invited: "Chỉ những người bạn tích chọn mới nhìn thấy thẻ phòng.",
      friends: "Chỉ bạn bè đã được chấp nhận trên HH nhìn thấy thẻ phòng.",
      members: "Mọi tài khoản đang đăng nhập đều nhìn thấy thẻ phòng, nhưng không nhìn thấy PIN."
    };
    if (note) note.textContent = notes[visibility] || notes.hidden;
  }

  async function loadAudienceFriends() {
    if (!authToken() || audienceFriends.length) return renderAudienceFriends();
    const base = clean(options.apiBase || global.location?.origin || "", 300).replace(/\/$/, "");
    try {
      const response = await global.fetch(`${base}/api/social?view=friends&limit=100`, { headers: { Authorization: `Bearer ${authToken()}` }, credentials: "include" });
      if (!response.ok) throw new Error("Không tải được danh sách bạn bè.");
      const data = await response.json();
      audienceFriends = (Array.isArray(data.friends) ? data.friends : []).map((item) => ({ id: clean(item.id, 120), name: clean(item.name || item.displayName, 60), username: clean(item.username, 60) })).filter((item) => item.id).slice(0, 100);
    } catch (error) { log(error.message || error, "error"); }
    renderAudienceFriends();
  }

  function renderLiveRooms(message = "") {
    const list = root?.querySelector("[data-remote-live-rooms]");
    if (!list) return;
    if (message) return void (list.innerHTML = `<p>${escapeHTML(message)}</p>`);
    if (!liveRooms.length) return void (list.innerHTML = '<p>Hiện chưa có phòng phát nào dành cho bạn.</p>');
    list.innerHTML = liveRooms.map((room) => `<article class="remote-live-room"><i>LIVE</i><span><strong>${escapeHTML(room.title)}</strong><small>${escapeHTML(room.host?.name || "Thành viên HH")} · ${Number(room.viewerCount) || 0}/${Number(room.maxViewers) || 1} người xem · ${room.requireApproval ? "Cần duyệt" : "Vào ngay"}</small></span><button type="button" data-remote-watch-room="${escapeHTML(room.id)}" ${Number(room.viewerCount) >= Number(room.maxViewers) ? "disabled" : ""}>${Number(room.viewerCount) >= Number(room.maxViewers) ? "Đã đầy" : "Yêu cầu xem"}</button></article>`).join("");
  }

  async function loadLiveRooms() {
    if (!authToken()) return renderLiveRooms("Hãy đăng nhập để xem phòng phát dành cho bạn.");
    try {
      await ensureSocket();
      const result = await emitAck("remote:rooms:list", {});
      liveRooms = Array.isArray(result.rooms) ? result.rooms : [];
      renderLiveRooms();
    } catch (error) { renderLiveRooms(error.message || "Không tải được danh sách phòng."); }
  }

  async function watchLiveRoom(roomId) {
    if (session) throw new Error("Hãy ngắt phiên hiện tại trước khi xem phòng khác.");
    if (!authToken()) throw new Error("Hãy đăng nhập để xem phòng đang phát.");
    setRole("viewer");
    await ensureSocket();
    const code = normalizeCode(roomId);
    session = { code, role: "viewer", directory: true };
    try {
      const result = await emitAck("remote:room:watch", { roomId: code, device: clean(global.navigator?.userAgentData?.platform || global.navigator?.platform || "Điện thoại / máy tính", 60) });
      session = { ...session, requestId: result.requestId, expiresAt: result.expiresAt };
      startExpiryClock(result.expiresAt);
      setStatus(result.pending ? "Đang chờ chủ phòng phê duyệt" : "Đang kết nối phòng phát", "busy");
      setView("quick");
    } catch (error) { session = null; throw error; }
  }

  async function updateRoomAudience() {
    audienceState = readAudienceForm();
    if (audienceState.visibility !== "hidden" && !authToken()) throw new Error("Hãy đăng nhập trước khi công bố phòng cho thành viên website.");
    if (audienceState.visibility === "invited" && !audienceState.allowedUserIds.length) throw new Error("Hãy chọn ít nhất một người được xem phòng.");
    if (!session?.hostToken) return toast("Phạm vi đã sẵn sàng và sẽ áp dụng khi tạo phiên.", "success");
    const result = await emitAck("remote:room:update", { code: session.code, hostToken: session.hostToken, audience: audienceState });
    audienceState = result.audience;
    toast("Đã cập nhật người có thể nhìn thấy phòng.", "success");
  }

  function renderLockState() {
    const button = root?.querySelector("[data-remote-lock]");
    if (!button) return;
    button.disabled = activeRole !== "host" || !session?.hostToken;
    button.dataset.locked = String(sessionLocked);
    button.textContent = sessionLocked ? "Mở nhận kết nối mới" : "Khóa phiên";
  }

  function startExpiryClock(expiresAt) {
    global.clearInterval(expiryTimer);
    const target = Date.parse(expiresAt || "");
    const update = () => {
      const node = root?.querySelector("[data-remote-expiry]");
      if (!node) return;
      if (!Number.isFinite(target)) { node.textContent = "15:00"; return; }
      const left = Math.max(0, target - Date.now());
      const minutes = Math.floor(left / 60_000);
      const seconds = Math.floor(left % 60_000 / 1000);
      node.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      node.dataset.urgent = String(left > 0 && left < 120_000);
      if (left <= 0) stopSession("Phiên Remote đã hết hạn.");
    };
    update();
    expiryTimer = global.setInterval(update, 1000);
  }

  function captureConstraints(profileName = appliedQuality) {
    const profile = QUALITY_PROFILES[profileName] || QUALITY_PROFILES.balanced;
    return { width: { ideal: profile.width }, height: { ideal: profile.height }, frameRate: { ideal: profile.frameRate, max: profile.frameRate } };
  }

  async function startCapture({ replace = false } = {}) {
    const caps = supported();
    if (!caps.secure || !caps.display) throw new Error("Trình duyệt này không hỗ trợ chia sẻ màn hình hoặc trang chưa chạy bằng HTTPS.");
    if (localStream?.active && !replace) return localStream;
    const shareAudio = Boolean(root?.querySelector("[data-remote-system-audio]")?.checked);
    const nextStream = await global.navigator.mediaDevices.getDisplayMedia({ video: captureConstraints(), audio: shareAudio });
    if (!nextStream?.getVideoTracks?.().length) throw new Error("Bạn chưa chọn màn hình để chia sẻ.");
    const previous = localStream;
    localStream = nextStream;
    if (replace && previous) {
      const nextVideo = nextStream.getVideoTracks()[0];
      const nextAudio = nextStream.getAudioTracks()[0] || null;
      for (const [id, pc] of peers) {
        const senders = pc.getSenders?.() || [];
        const videoSender = senders.find((item) => item.track?.kind === "video");
        const audioSender = senders.find((item) => item.track?.kind === "audio");
        if (videoSender) await videoSender.replaceTrack(nextVideo);
        else if (id !== "manual") pc.addTrack(nextVideo, nextStream);
        if (audioSender) await audioSender.replaceTrack(nextAudio);
        else if (nextAudio && id !== "manual") {
          pc.addTrack(nextAudio, nextStream);
          if (session?.code && socket?.connected) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("remote:signal", { code: session.code, targetSocketId: id, signal: { type: "offer", description: pc.localDescription } });
          }
        }
      }
      previous.getTracks().forEach((track) => { try { track.stop(); } catch {} });
      log("Đã chuyển nguồn màn hình chia sẻ.", "success");
    }
    const video = root?.querySelector("[data-remote-local-video]");
    if (video) { video.srcObject = nextStream; video.hidden = false; }
    root?.querySelector("[data-remote-empty-stage]")?.setAttribute("hidden", "");
    const track = nextStream.getVideoTracks()[0];
    track.addEventListener("ended", () => { if (localStream === nextStream) stopSession("Bạn đã dừng chia sẻ màn hình."); }, { once: true });
    await applyQuality(appliedQuality, { updateTrack: true });
    isPaused = false;
    renderPauseState();
    syncActionAvailability();
    log(shareAudio && nextStream.getAudioTracks().length ? "Đã chia sẻ màn hình kèm âm thanh hệ thống." : "Đã cấp quyền chia sẻ màn hình.", "success");
    return nextStream;
  }

  function iceServers(input) {
    const list = Array.isArray(input) ? input.filter((item) => item && (typeof item.urls === "string" || Array.isArray(item.urls))).slice(0, 8) : [];
    return list.length ? list : DEFAULT_ICE;
  }

  async function applyQuality(profileName, { updateTrack = true } = {}) {
    const next = QUALITY_PROFILES[profileName] ? profileName : "balanced";
    const profile = QUALITY_PROFILES[next];
    appliedQuality = next;
    const track = localStream?.getVideoTracks?.()[0];
    if (track && updateTrack && track.applyConstraints) {
      try { await track.applyConstraints(captureConstraints(next)); } catch (error) { log(`Thiết bị không áp dụng đủ cấu hình ${profile.label}: ${clean(error.message, 120)}`); }
    }
    for (const pc of peers.values()) {
      const sender = pc.getSenders?.().find((item) => item.track?.kind === "video");
      if (!sender?.getParameters || !sender?.setParameters) continue;
      const params = sender.getParameters();
      params.encodings ||= [{}];
      params.encodings[0].maxBitrate = profile.bitrate;
      params.degradationPreference = "maintain-framerate";
      try { await sender.setParameters(params); } catch {}
    }
    const badge = root?.querySelector("[data-remote-quality-active]");
    if (badge) badge.textContent = `${selectedQuality === "auto" ? "Tự động · " : ""}${profile.label}`;
  }

  function peerFor(id, role, servers) {
    if (peers.has(id)) return peers.get(id);
    if (!global.RTCPeerConnection) throw new Error("WebRTC không được hỗ trợ trên trình duyệt này.");
    const pc = new global.RTCPeerConnection({ iceServers: iceServers(servers), bundlePolicy: "max-bundle" });
    peers.set(id, pc);
    pendingCandidates.set(id, []);
    pc.addEventListener("icecandidate", (event) => {
      if (!event.candidate || !socket?.connected || !session?.code || id === "manual") return;
      socket.emit("remote:signal", { code: session.code, targetSocketId: id, signal: { type: "candidate", candidate: event.candidate.toJSON?.() || event.candidate } });
    });
    pc.addEventListener("connectionstatechange", () => {
      const state = pc.connectionState;
      const peer = peerDevices.get(id);
      if (peer) { peer.connected = state === "connected"; peerDevices.set(id, peer); renderParticipants(); }
      setStatus(state === "connected" ? "Đã kết nối P2P mã hóa" : `WebRTC: ${state}`, state === "connected" ? "online" : state === "failed" ? "error" : "busy");
      if (state === "connected") {
        log("Luồng WebRTC P2P đã kết nối.", "success");
        saveHistory({ result: "Kết nối thành công" });
        startStatsMonitor();
      }
      if (state === "failed") { log("Kết nối gián đoạn; hãy dùng Khôi phục ICE.", "error"); setView("network"); }
      if (state === "closed") log("Kết nối WebRTC đã đóng.");
    });
    pc.addEventListener("track", (event) => {
      const video = root?.querySelector("[data-remote-video]");
      if (video) { video.srcObject = event.streams[0] || new MediaStream([event.track]); video.hidden = false; }
      root?.querySelector("[data-remote-empty-stage]")?.setAttribute("hidden", "");
      syncActionAvailability();
      log("Đang nhận màn hình từ thiết bị chia sẻ.", "success");
    });
    pc.addEventListener("datachannel", (event) => bindChannel(event.channel, id));
    if (role === "host") {
      localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));
      bindChannel(pc.createDataChannel("hh-remote-assist-v2", { ordered: true }), id);
    }
    return pc;
  }

  function bindChannel(next, peerId = "peer") {
    channel = next;
    channels.set(peerId, next);
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = 256 * 1024;
    channel.addEventListener("open", () => {
      log("Kênh hỗ trợ P2P đã sẵn sàng.", "success");
      renderChannelState(true);
      if (activeRole === "host") sendData("permissions", { permissions: hostPermissions }, { bypass: true, targets: [next] });
    });
    next.addEventListener("close", () => { channels.delete(peerId); channel = openChannels()[0] || null; renderChannelState(openChannels().length > 0); });
    next.addEventListener("message", (event) => handleChannelMessage(event, peerId));
  }

  function permissionFor(type) {
    return ({ chat: "chat", pointer: "pointer", clipboard: "clipboard", "file-meta": "files", "file-end": "files" })[type] || null;
  }

  function permissionAllowed(capability) {
    if (!capability) return true;
    return activeRole === "host" ? Boolean(hostPermissions[capability]) : Boolean(remotePermissions[capability]);
  }

  function sendData(type, payload = {}, { bypass = false, targets } = {}) {
    const active = Array.isArray(targets) ? targets.filter((item) => item?.readyState === "open") : openChannels();
    if (!active.length) throw new Error("Kênh P2P chưa kết nối.");
    const capability = permissionFor(type);
    if (!bypass && capability && !permissionAllowed(capability)) throw new Error(`Chủ phiên chưa cho phép ${PERMISSIONS[capability]?.label.toLowerCase() || "tác vụ này"}.`);
    const encoded = JSON.stringify(createEnvelope(type, payload));
    if (encoded.length > MAX_DATA_MESSAGE_BYTES) throw new Error("Thông điệp P2P vượt giới hạn an toàn.");
    active.forEach((item) => item.send(encoded));
  }

  function renderChannelState(open) {
    const state = root?.querySelector("[data-remote-channel-state]");
    if (state) { state.dataset.online = String(open); state.textContent = open ? "P2P online" : "Chưa kết nối"; }
    syncActionAvailability();
  }

  function syncActionAvailability() {
    const open = openChannels().length > 0;
    root?.querySelectorAll("[data-remote-capability]").forEach((node) => {
      const capability = node.dataset.remoteCapability;
      node.disabled = !open || !permissionAllowed(capability);
      node.title = !open ? "Cần kết nối P2P" : !permissionAllowed(capability) ? "Chủ phiên chưa cho phép" : "";
    });
    const screenshot = root?.querySelector("[data-remote-screenshot]");
    const recording = root?.querySelector("[data-remote-record]");
    const replace = root?.querySelector("[data-remote-replace]");
    if (replace) replace.disabled = activeRole !== "host";
    if (screenshot) screenshot.disabled = !permissionAllowed("screenshot") || !activeVideo();
    if (recording) recording.disabled = !permissionAllowed("recording") || !activeVideo() || !supported().recording;
  }

  function appendMessage(text, mine = false, kind = "chat") {
    const list = root?.querySelector("[data-remote-messages]");
    if (!list) return;
    const item = global.document.createElement("p");
    item.dataset.mine = String(mine);
    item.dataset.kind = kind;
    item.textContent = clean(text, 10_000);
    list.append(item);
    list.scrollTop = list.scrollHeight;
  }

  async function handleChannelMessage(event, peerId = "peer") {
    if (typeof event.data !== "string") return handleFileChunk(event.data, peerId);
    if (event.data.length > MAX_DATA_MESSAGE_BYTES) return log("Đã chặn thông điệp P2P quá lớn.", "error");
    let parsed;
    try { parsed = JSON.parse(event.data); } catch { return log("Đã bỏ qua thông điệp P2P sai định dạng.", "error"); }
    const message = normalizeEnvelope(parsed);
    if (!message || seenMessages.has(message.id)) return;
    seenMessages.add(message.id);
    if (seenMessages.size > 512) seenMessages.delete(seenMessages.values().next().value);
    const capability = permissionFor(message.type);
    if (capability && !permissionAllowed(capability)) return log(`Đã chặn tác vụ ${PERMISSIONS[capability].label} chưa được cấp quyền.`, "error");
    const payload = message.payload;
    if (message.type === "permissions" && activeRole === "viewer") {
      remotePermissions = Object.fromEntries(Object.keys(PERMISSIONS).map((key) => [key, Boolean(payload.permissions?.[key])]));
      if (!remotePermissions.recording && recorder?.state === "recording") recorder.stop();
      if (!remotePermissions.files) incomingFiles.clear();
      renderPermissions();
      syncActionAvailability();
      return log("Chủ phiên đã cập nhật phạm vi quyền.", "success");
    }
    if (message.type === "chat") appendMessage(payload.text, false);
    if (message.type === "pointer") showPointer(payload.x, payload.y);
    if (message.type === "clipboard") appendMessage(`Clipboard từ thiết bị kia:\n${clean(payload.text, 10_000)}`, false, "clipboard");
    if (message.type === "stream-state" && activeRole === "viewer") renderRemotePause(Boolean(payload.paused));
    if (message.type === "file-meta") beginIncomingFile(payload, peerId);
    const receiving = incomingFiles.get(peerId);
    if (message.type === "file-end" && receiving && payload.transferId === receiving.id) finishIncomingFile(peerId);
  }

  async function handleFileChunk(data, peerId = "peer") {
    const receiving = incomingFiles.get(peerId);
    if (!receiving || !permissionAllowed("files")) return;
    const chunk = data instanceof ArrayBuffer ? data : await data.arrayBuffer?.();
    if (!chunk) return;
    const nextSize = receiving.received + chunk.byteLength;
    if (nextSize > receiving.size || nextSize > MAX_FILE_BYTES) {
      log("Đã chặn tệp P2P vượt kích thước đã khai báo.", "error");
      incomingFiles.delete(peerId);
      return;
    }
    receiving.chunks.push(chunk);
    receiving.received = nextSize;
    incomingFiles.set(peerId, receiving);
    updateFileProgress(nextSize, receiving.size, `Đang nhận ${receiving.name}`);
  }

  function beginIncomingFile(payload, peerId = "peer") {
    const size = Number(payload.size) || 0;
    const id = clean(payload.transferId, 80);
    if (!id || size <= 0 || size > MAX_FILE_BYTES || incomingFiles.has(peerId)) return log("Thiết bị kia gửi metadata tệp không hợp lệ hoặc đang có tệp khác.", "error");
    const file = { id, name: clean(payload.name, 160) || "remote-file", type: clean(payload.mime, 100) || "application/octet-stream", size, received: 0, chunks: [] };
    incomingFiles.set(peerId, file);
    log(`Bắt đầu nhận tệp ${file.name} (${bytesLabel(size)}).`);
  }

  function showPointer(x, y) {
    const pointer = root?.querySelector("[data-remote-pointer]");
    if (!pointer) return;
    pointer.style.setProperty("--x", `${Math.max(0, Math.min(1, Number(x) || 0)) * 100}%`);
    pointer.style.setProperty("--y", `${Math.max(0, Math.min(1, Number(y) || 0)) * 100}%`);
    pointer.classList.add("is-visible");
    global.setTimeout(() => pointer.classList.remove("is-visible"), 900);
  }

  function updateFileProgress(done, total, label) {
    const node = root?.querySelector("[data-remote-file-progress]");
    if (!node) return;
    const ratio = total ? Math.max(0, Math.min(100, done / total * 100)) : 0;
    node.hidden = false;
    node.style.setProperty("--progress", `${ratio}%`);
    node.querySelector("span").textContent = `${clean(label, 180)} · ${Math.round(ratio)}%`;
  }

  function finishIncomingFile(peerId = "peer") {
    const file = incomingFiles.get(peerId);
    incomingFiles.delete(peerId);
    if (!file || file.received !== file.size) return log("Tệp P2P chưa nhận đủ dữ liệu nên không được tạo file tải xuống.", "error");
    const blob = new Blob(file.chunks, { type: file.type });
    const url = URL.createObjectURL(blob);
    downloadUrls.add(url);
    const link = global.document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.textContent = `Tải ${file.name} (${bytesLabel(blob.size)})`;
    link.className = "remote-download-link";
    root?.querySelector("[data-remote-downloads]")?.prepend(link);
    updateFileProgress(file.size, file.size, `Đã nhận ${file.name}`);
    log(`Đã nhận đủ tệp ${file.name}.`, "success");
  }

  async function waitForBackpressure() {
    await Promise.all(openChannels().filter((item) => item.bufferedAmount > BACKPRESSURE_BYTES).map((item) => new Promise((resolve) => {
      const timeout = global.setTimeout(resolve, 1800);
      const done = () => { global.clearTimeout(timeout); item.removeEventListener?.("bufferedamountlow", done); resolve(); };
      item.addEventListener("bufferedamountlow", done, { once: true });
    })));
  }

  async function sendFile(file) {
    if (!permissionAllowed("files")) throw new Error("Chủ phiên chưa cho phép truyền tệp.");
    if (!file || file.size <= 0 || file.size > MAX_FILE_BYTES) throw new Error("Chọn tệp từ 1 byte đến 32 MB.");
    const transferId = createEnvelope("file").id;
    sendData("file-meta", { transferId, name: clean(file.name, 160), mime: clean(file.type, 100), size: file.size });
    let offset = 0;
    while (offset < file.size) {
      const active = openChannels();
      if (!active.length) throw new Error("Kết nối bị ngắt khi đang gửi tệp.");
      await waitForBackpressure();
      const chunk = await file.slice(offset, Math.min(offset + CHUNK_BYTES, file.size)).arrayBuffer();
      active.forEach((item) => item.send(chunk));
      offset += chunk.byteLength;
      updateFileProgress(offset, file.size, `Đang gửi ${file.name}`);
      await new Promise((resolve) => global.setTimeout(resolve, 0));
    }
    sendData("file-end", { transferId });
    log(`Đã gửi ${file.name} qua P2P theo từng khối.`, "success");
  }

  function waitForIce(pc, timeoutMs = 8000) {
    if (pc.iceGatheringState === "complete") return Promise.resolve();
    return new Promise((resolve) => {
      const timeout = global.setTimeout(done, timeoutMs);
      function done() { global.clearTimeout(timeout); pc.removeEventListener("icegatheringstatechange", check); resolve(); }
      function check() { if (pc.iceGatheringState === "complete") done(); }
      pc.addEventListener("icegatheringstatechange", check);
    });
  }

  async function createManualCode() {
    if (activeRole === "host") {
      await startCapture();
      const pc = peerFor("manual", "host", DEFAULT_ICE);
      await pc.setLocalDescription(await pc.createOffer());
      await waitForIce(pc);
      root.querySelector("[data-remote-manual-output]").value = encodeSignal({ kind: "offer", description: pc.localDescription });
      setStatus("Mã mời đã sẵn sàng", "online");
      log("Đã tạo mã mời WebRTC thủ công.", "success");
      return;
    }
    const signal = decodeSignal(root.querySelector("[data-remote-manual-input]").value);
    if (signal.kind !== "offer" || !signal.description) throw new Error("Thiết bị khách cần mã mời dạng offer.");
    const pc = peerFor("manual", "viewer", DEFAULT_ICE);
    await pc.setRemoteDescription(signal.description);
    await pc.setLocalDescription(await pc.createAnswer());
    await waitForIce(pc);
    root.querySelector("[data-remote-manual-output]").value = encodeSignal({ kind: "answer", description: pc.localDescription });
    setStatus("Đã tạo mã trả lời", "online");
    log("Đã đọc mã mời và tạo mã trả lời.", "success");
  }

  async function applyManualAnswer() {
    const signal = decodeSignal(root.querySelector("[data-remote-manual-input]").value);
    const pc = peers.get("manual");
    if (!pc || signal.kind !== "answer" || !signal.description) throw new Error("Hãy tạo mã mời trước, sau đó dán mã trả lời.");
    await pc.setRemoteDescription(signal.description);
    setStatus("Đang kết nối P2P...", "busy");
    log("Đã áp dụng mã trả lời WebRTC.");
  }

  function loadSocketClient() {
    if (global.io) return Promise.resolve(global.io);
    const base = clean(options.socketUrl || global.HH_SOCKET_URL || "", 300).replace(/\/$/, "");
    if (!/^https:\/\//.test(base) && !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(base)) throw new Error("Realtime signaling chưa được cấu hình an toàn.");
    return new Promise((resolve, reject) => {
      const existing = [...global.document.scripts].find((item) => item.src.startsWith(`${base}/socket.io/socket.io.js`));
      if (existing && global.io) return resolve(global.io);
      const script = existing || global.document.createElement("script");
      if (!existing) { script.src = `${base}/socket.io/socket.io.js`; script.async = true; script.crossOrigin = "anonymous"; global.document.head.append(script); }
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        global.clearTimeout(timeout);
        error ? reject(error) : resolve(global.io);
      };
      const timeout = global.setTimeout(() => finish(new Error("Dịch vụ ghép nối nhanh phản hồi quá chậm.")), 9000);
      script.addEventListener("load", () => global.io ? finish() : finish(new Error("Socket.io không sẵn sàng.")), { once: true });
      script.addEventListener("error", () => finish(new Error("Không thể tải dịch vụ ghép nối nhanh.")), { once: true });
    });
  }

  function emitAck(event, payload, timeoutMs = 9000) {
    return new Promise((resolve, reject) => {
      if (!socket?.connected) return reject(new Error("Realtime signaling chưa kết nối."));
      const timer = global.setTimeout(() => reject(new Error("Máy chủ signaling không phản hồi.")), timeoutMs);
      socket.emit(event, payload, (result) => { global.clearTimeout(timer); result?.ok ? resolve(result) : reject(new Error(result?.error || "Yêu cầu signaling thất bại.")); });
    });
  }

  async function ensureSocket() {
    if (socket?.connected) return socket;
    const io = await loadSocketClient();
    const base = clean(options.socketUrl || global.HH_SOCKET_URL || "", 300).replace(/\/$/, "");
    socket = io(base, { transports: ["websocket", "polling"], withCredentials: true, auth: { token: global.HHAuthSession?.token?.() || "", anonymousId: `remote-${Math.random().toString(36).slice(2, 12)}`, designName: options.currentUser?.name || "Remote Guest" }, timeout: 8000, reconnectionAttempts: 5 });
    bindSocketEvents();
    if (socket.connected) return socket;
    await new Promise((resolve, reject) => {
      const timer = global.setTimeout(() => reject(new Error("Không kết nối được realtime signaling.")), 9000);
      socket.once("connect", () => { global.clearTimeout(timer); resolve(); });
      socket.once("connect_error", (error) => { global.clearTimeout(timer); reject(new Error(error?.message || "Realtime không khả dụng.")); });
    });
    return socket;
  }

  function bindSocketEvents() {
    socket.on("connect", async () => {
      if (session?.role === "viewer" && session.reconnectToken) {
        try {
          const result = await emitAck("remote:session:recover", { code: session.code, reconnectToken: session.reconnectToken });
          if (result.ok) log("Đã phục hồi phiên signaling an toàn.", "success");
        } catch (error) { setStatus("Không thể phục hồi phiên", "error"); log(error.message, "error"); }
      }
    });
    socket.on("disconnect", () => {
      if (session?.role === "host") stopSession("Signaling bị ngắt; phiên chia sẻ đã dừng an toàn.");
      else if (session) setStatus("Signaling gián đoạn · đang chờ phục hồi", "busy");
    });
    socket.on("remote:rooms:changed", () => { if (activeView === "live") loadLiveRooms(); });
    socket.on("remote:join:requested", ({ request }) => renderJoinRequest(request));
    socket.on("remote:join:approved", async (payload) => {
      session = { ...(session || {}), code: payload.code, hostSocketId: payload.hostSocketId, reconnectToken: payload.reconnectToken || session?.reconnectToken, iceServers: payload.iceServers, expiresAt: payload.expiresAt, role: "viewer" };
      peerDevices.clear();
      peerDevices.set(payload.hostSocketId, { name: payload.hostName || "Thiết bị chia sẻ", device: "Máy chủ", connected: false });
      peerFor(payload.hostSocketId, "viewer", payload.iceServers);
      startExpiryClock(payload.expiresAt);
      renderParticipants();
      setStatus(payload.recovered ? "Đã phục hồi kết nối" : "Đã được chủ phiên chấp nhận", "online");
      log(payload.recovered ? "Phiên đã được phục hồi sau gián đoạn." : "Chủ phiên đã chấp nhận thiết bị này.", "success");
    });
    socket.on("remote:join:denied", (payload) => { setStatus(payload.reason || "Yêu cầu bị từ chối", "error"); log(payload.reason || "Ghép nối bị từ chối.", "error"); });
    socket.on("remote:peer:joined", async (payload) => {
      try {
        peerDevices.set(payload.socketId, { ...(payload.peer || {}), connected: false });
        renderParticipants();
        const pc = peerFor(payload.socketId, "host", payload.iceServers || session?.iceServers);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("remote:signal", { code: session.code, targetSocketId: payload.socketId, signal: { type: "offer", description: pc.localDescription } });
      } catch (error) {
        log(error.message || error, "error");
        setStatus("Không thể tạo kết nối WebRTC", "error");
      }
    });
    socket.on("remote:signal", async (payload) => {
      try {
        const id = payload.fromSocketId;
        const pc = peerFor(id, activeRole === "host" ? "host" : "viewer", session?.iceServers);
        if (payload.signal.type === "candidate") {
          if (pc.remoteDescription) await pc.addIceCandidate(payload.signal.candidate);
          else pendingCandidates.get(id)?.push(payload.signal.candidate);
          return;
        }
        if (payload.signal.type === "offer") {
          await pc.setRemoteDescription(payload.signal.description);
          for (const candidate of pendingCandidates.get(id) || []) await pc.addIceCandidate(candidate);
          pendingCandidates.set(id, []);
          await pc.setLocalDescription(await pc.createAnswer());
          socket.emit("remote:signal", { code: session.code, targetSocketId: id, signal: { type: "answer", description: pc.localDescription } });
        }
        if (payload.signal.type === "answer") {
          await pc.setRemoteDescription(payload.signal.description);
          for (const candidate of pendingCandidates.get(id) || []) await pc.addIceCandidate(candidate);
          pendingCandidates.set(id, []);
        }
      } catch (error) { log(error.message || error, "error"); }
    });
    socket.on("remote:peer:left", ({ socketId, reason }) => {
      peers.get(socketId)?.close?.();
      peers.delete(socketId);
      pendingCandidates.delete(socketId);
      peerDevices.delete(socketId);
      renderParticipants();
      log(`Thiết bị khách đã rời phiên${reason ? ` (${clean(reason, 40)})` : ""}.`);
    });
    socket.on("remote:session:state", ({ locked }) => { sessionLocked = Boolean(locked); renderLockState(); });
    socket.on("remote:session:revoked", () => stopSession("Chủ phiên đã thu hồi quyền của thiết bị này."));
    socket.on("remote:session:closed", ({ reason }) => stopSession(`Phiên đã đóng: ${reason || "kết thúc"}.`));
  }

  function renderJoinRequest(request) {
    const list = root?.querySelector("[data-remote-requests]");
    if (!list) return;
    list.querySelector(":scope > p")?.remove();
    const article = global.document.createElement("article");
    article.dataset.requestId = clean(request.id, 80);
    article.innerHTML = `<i>?</i><span><strong>${escapeHTML(request.name)}</strong><small>${escapeHTML(request.device)} muốn xem màn hình</small></span><button type="button" data-remote-approve>Cho phép</button><button type="button" data-remote-deny>Từ chối</button>`;
    list.prepend(article);
    setStatus("Có thiết bị chờ phê duyệt", "busy");
  }

  async function createQuickSession() {
    if (session) throw new Error("Một phiên Remote đang hoạt động trên thiết bị này.");
    await startCapture();
    let result;
    try {
      await ensureSocket();
      audienceState = readAudienceForm();
      if (audienceState.visibility !== "hidden" && !authToken()) throw new Error("Hãy đăng nhập để công bố phòng cho người dùng website.");
      if (audienceState.visibility === "invited" && !audienceState.allowedUserIds.length) throw new Error("Hãy chọn ít nhất một người được xem phòng.");
      result = await emitAck("remote:session:create", { name: options.currentUser?.name || "Thiết bị của tôi", device: clean(global.navigator?.userAgentData?.platform || global.navigator?.platform || "Máy tính", 60), audience: audienceState });
    } catch (error) {
      await stopSession("Không thể tạo phiên; quyền chia sẻ màn hình đã được dừng an toàn.");
      throw error;
    }
    session = { ...result, role: "host" };
    audienceState = result.audience || audienceState;
    sessionLocked = false;
    root.querySelector("[data-remote-code]").textContent = result.code;
    root.querySelector("[data-remote-pin]").textContent = result.pin;
    root.querySelector("[data-remote-session-card]").hidden = false;
    startExpiryClock(result.expiresAt);
    renderLockState();
    renderParticipants();
    setStatus("Đang chờ thiết bị khác", "online");
    log(`Đã tạo phiên ${result.code}; PIN chỉ hiển thị trong phiên này.`, "success");
  }

  async function joinQuickSession() {
    if (session) throw new Error("Một phiên Remote đang hoạt động trên thiết bị này.");
    await ensureSocket();
    const code = normalizeCode(root.querySelector("[data-remote-join-code]").value);
    const pin = clean(root.querySelector("[data-remote-join-pin]").value, 6);
    if (code.length !== 8 || !/^\d{6}$/.test(pin)) throw new Error("Nhập đúng mã phiên 8 ký tự và PIN 6 số.");
    const result = await emitAck("remote:session:join", { code, pin, name: options.currentUser?.name || "Thiết bị khách", device: clean(global.navigator?.userAgentData?.platform || global.navigator?.platform || "Điện thoại / máy tính", 60) });
    session = { code, role: "viewer", requestId: result.requestId, expiresAt: result.expiresAt };
    startExpiryClock(result.expiresAt);
    setStatus("Đang chờ chủ phiên phê duyệt", "busy");
    log("Đã gửi yêu cầu ghép nối; chưa truyền dữ liệu.");
  }

  async function approveRequest(article, accept) {
    const requestId = article?.dataset.requestId;
    if (!requestId || !session?.hostToken) return;
    await emitAck("remote:session:approve", { code: session.code, hostToken: session.hostToken, requestId, accept });
    article.remove();
    const requestList = root?.querySelector("[data-remote-requests]");
    if (requestList && !requestList.querySelector("article")) requestList.innerHTML = "<p>Chưa có thiết bị yêu cầu kết nối.</p>";
    log(accept ? "Đã cho phép thiết bị khách." : "Đã từ chối thiết bị khách.", accept ? "success" : "info");
  }

  async function setSessionLock() {
    if (!session?.hostToken) throw new Error("Chỉ chủ phiên đang hoạt động mới có thể khóa phiên.");
    const result = await emitAck("remote:session:lock", { code: session.code, hostToken: session.hostToken, locked: !sessionLocked });
    sessionLocked = Boolean(result.locked);
    renderLockState();
    toast(sessionLocked ? "Đã khóa yêu cầu kết nối mới." : "Đã mở nhận kết nối mới.", "success");
  }

  async function revokeViewer(socketId) {
    if (!session?.hostToken) throw new Error("Chỉ chủ phiên mới có thể thu hồi thiết bị.");
    await emitAck("remote:session:revoke", { code: session.code, hostToken: session.hostToken, targetSocketId: clean(socketId, 120) });
    peerDevices.delete(socketId);
    peers.get(socketId)?.close?.();
    peers.delete(socketId);
    renderParticipants();
    toast("Đã thu hồi thiết bị khỏi phiên.", "success");
  }

  function updatePermission(key, allowed) {
    if (activeRole !== "host" || !(key in PERMISSIONS)) return;
    hostPermissions[key] = Boolean(allowed);
    if (key === "recording" && !allowed && recorder?.state === "recording") recorder.stop();
    if (key === "files" && !allowed) incomingFiles.clear();
    if (openChannels().length) sendData("permissions", { permissions: hostPermissions }, { bypass: true });
    syncActionAvailability();
    log(`${allowed ? "Đã cho phép" : "Đã thu hồi"} ${PERMISSIONS[key].label}.`, allowed ? "success" : "info");
  }

  function sendChat() {
    const input = root?.querySelector("[data-remote-chat-input]");
    const text = clean(input?.value, 2000);
    if (!text) return;
    sendData("chat", { text });
    appendMessage(text, true);
    input.value = "";
  }

  function activeVideo() {
    return root?.querySelector("[data-remote-video]:not([hidden]), [data-remote-local-video]:not([hidden])") || null;
  }

  async function captureScreenshot() {
    if (!permissionAllowed("screenshot")) throw new Error("Chủ phiên chưa cho phép chụp màn hình.");
    const video = activeVideo();
    if (!video || !video.videoWidth || !video.videoHeight) throw new Error("Chưa có khung hình để chụp.");
    const canvas = global.document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d", { alpha: false }).drawImage(video, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Không thể tạo ảnh chụp.");
    downloadBlob(blob, `hh-remote-${new Date().toISOString().replace(/[:.]/g, "-")}.png`);
    log("Đã chụp một khung hình PNG trên thiết bị này.", "success");
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    downloadUrls.add(url);
    const link = global.document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    global.setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.delete(url); }, 30_000);
  }

  function bestRecordingMime() {
    return ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((type) => global.MediaRecorder?.isTypeSupported?.(type)) || "";
  }

  function toggleRecording() {
    if (recorder?.state === "recording") {
      recorder.stop();
      return;
    }
    if (!permissionAllowed("recording")) throw new Error("Chủ phiên chưa cho phép ghi hình.");
    const video = activeVideo();
    const stream = video?.srcObject;
    if (!stream || !global.MediaRecorder) throw new Error("Thiết bị không hỗ trợ ghi hình phiên.");
    recordingChunks = [];
    const mimeType = bestRecordingMime();
    recorder = new global.MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: QUALITY_PROFILES[appliedQuality].bitrate } : undefined);
    recorder.addEventListener("dataavailable", (event) => { if (event.data?.size) recordingChunks.push(event.data); });
    recorder.addEventListener("stop", () => {
      const blob = new Blob(recordingChunks, { type: recorder.mimeType || "video/webm" });
      if (blob.size) downloadBlob(blob, `hh-remote-recording-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`);
      recordingChunks = [];
      recorder = null;
      renderRecordingState(false);
      log("Đã dừng và lưu bản ghi WebM cục bộ.", "success");
    }, { once: true });
    recorder.start(1000);
    renderRecordingState(true);
    log("Đã bắt đầu ghi hình; chỉ báo REC đang hiển thị.", "success");
  }

  function renderRecordingState(active) {
    root?.querySelector("[data-remote-hub]")?.classList.toggle("is-recording", active);
    const button = root?.querySelector("[data-remote-record]");
    if (button) button.textContent = active ? "Dừng ghi" : "Ghi hình";
  }

  function togglePause() {
    const track = localStream?.getVideoTracks?.()[0];
    if (activeRole !== "host" || !track) throw new Error("Chỉ thiết bị chia sẻ mới có thể tạm dừng hình ảnh.");
    isPaused = !isPaused;
    track.enabled = !isPaused;
    renderPauseState();
    if (openChannels().length) sendData("stream-state", { paused: isPaused }, { bypass: true });
    log(isPaused ? "Đã tạm dừng truyền hình ảnh." : "Đã tiếp tục truyền hình ảnh.", "success");
  }

  function renderPauseState() {
    root?.querySelector("[data-remote-screen]")?.classList.toggle("is-paused", isPaused);
    const button = root?.querySelector("[data-remote-pause]");
    if (button) { button.disabled = activeRole !== "host" || !localStream; button.textContent = isPaused ? "Tiếp tục" : "Tạm dừng"; }
  }

  function renderRemotePause(paused) {
    root?.querySelector("[data-remote-screen]")?.classList.toggle("is-remote-paused", paused);
    const label = root?.querySelector("[data-remote-paused-label]");
    if (label) label.hidden = !paused;
  }

  async function restartConnections() {
    if (!peers.size) throw new Error("Chưa có kết nối WebRTC để phục hồi.");
    for (const [id, pc] of peers) {
      if (id === "manual" || !session?.code || !socket?.connected) continue;
      pc.restartIce?.();
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      socket.emit("remote:signal", { code: session.code, targetSocketId: id, signal: { type: "offer", description: pc.localDescription } });
    }
    setStatus("Đang khôi phục kết nối ICE", "busy");
    log("Đã yêu cầu ICE restart cho các kết nối.", "success");
  }

  function startStatsMonitor() {
    global.clearInterval(statsTimer);
    collectStats();
    statsTimer = global.setInterval(collectStats, 2000);
  }

  async function collectStats() {
    const first = [...peers.values()].find((pc) => pc.connectionState === "connected") || [...peers.values()][0];
    if (!first?.getStats) return;
    try {
      const report = await first.getStats();
      let media = null;
      let remoteInbound = null;
      let pair = null;
      let localCandidate = null;
      report.forEach((item) => {
        if ((item.type === "outbound-rtp" || item.type === "inbound-rtp") && item.kind === "video") media = item;
        if (item.type === "remote-inbound-rtp" && item.kind === "video") remoteInbound = item;
        if (item.type === "candidate-pair" && (item.selected || (item.nominated && item.state === "succeeded"))) pair = item;
      });
      if (pair?.localCandidateId) localCandidate = report.get(pair.localCandidateId);
      const bytes = Number(media?.bytesSent ?? media?.bytesReceived ?? 0);
      const timestamp = Number(media?.timestamp || Date.now());
      const bitrate = lastStatsSample && timestamp > lastStatsSample.timestamp ? Math.max(0, (bytes - lastStatsSample.bytes) * 8 / ((timestamp - lastStatsSample.timestamp) / 1000)) : 0;
      lastStatsSample = { bytes, timestamp };
      const packetsLost = Math.max(0, Number(remoteInbound?.packetsLost ?? media?.packetsLost ?? 0));
      const packetsReceived = Math.max(0, Number(remoteInbound?.packetsReceived ?? media?.packetsReceived ?? 0));
      const loss = packetsLost / Math.max(1, packetsLost + packetsReceived);
      const rtt = Number(pair?.currentRoundTripTime ?? remoteInbound?.roundTripTime ?? 0);
      const metrics = {
        bitrate,
        rtt,
        loss,
        width: Number(media?.frameWidth || localStream?.getVideoTracks?.()[0]?.getSettings?.().width || 0),
        height: Number(media?.frameHeight || localStream?.getVideoTracks?.()[0]?.getSettings?.().height || 0),
        fps: Number(media?.framesPerSecond || localStream?.getVideoTracks?.()[0]?.getSettings?.().frameRate || 0),
        candidate: clean(localCandidate?.candidateType || "unknown", 30)
      };
      renderStats(metrics);
      if (selectedQuality === "auto") {
        const target = rtt > 0.35 || loss > 0.05 ? "saver" : rtt > 0 && rtt < 0.12 && loss < 0.01 ? "sharp" : "balanced";
        if (target !== appliedQuality) await applyQuality(target);
      }
    } catch (error) { log(`Không đọc được thống kê WebRTC: ${clean(error.message, 120)}`); }
  }

  function renderStats(metrics) {
    const values = {
      bitrate: metrics.bitrate ? `${(metrics.bitrate / 1_000_000).toFixed(2)} Mbps` : "Đang đo",
      rtt: metrics.rtt ? `${Math.round(metrics.rtt * 1000)} ms` : "—",
      loss: `${(metrics.loss * 100).toFixed(1)}%`,
      resolution: metrics.width ? `${metrics.width}×${metrics.height} · ${Math.round(metrics.fps || 0)} FPS` : "—",
      candidate: ({ host: "Nội mạng", srflx: "STUN", relay: "TURN" })[metrics.candidate] || metrics.candidate
    };
    Object.entries(values).forEach(([key, value]) => { const node = root?.querySelector(`[data-remote-metric="${key}"]`); if (node) node.textContent = value; });
    const health = root?.querySelector("[data-remote-network-health]");
    if (health) {
      const tone = metrics.rtt > 0.35 || metrics.loss > 0.05 ? "poor" : metrics.rtt > 0.18 || metrics.loss > 0.02 ? "fair" : "good";
      health.dataset.tone = tone;
      health.textContent = tone === "good" ? "Mạng ổn định" : tone === "fair" ? "Mạng dao động" : "Mạng yếu";
    }
  }

  async function stopSession(message = "Phiên Remote đã kết thúc.") {
    if (isStopping) return;
    isStopping = true;
    try {
      if (recorder?.state === "recording") recorder.stop();
      if (session?.code && socket?.connected) socket.emit("remote:session:leave", { code: session.code, hostToken: session.hostToken || "" });
      localStream?.getTracks?.().forEach((track) => { try { track.stop(); } catch {} });
      localStream = null;
      peers.forEach((pc) => { try { pc.close(); } catch {} });
      peers.clear();
      peerDevices.clear();
      pendingCandidates.clear();
      channels.forEach((item) => { try { item.close?.(); } catch {} });
      channels.clear();
      channel = null;
      session = null;
      incomingFiles.clear();
      isPaused = false;
      sessionLocked = false;
      lastStatsSample = null;
      global.clearInterval(statsTimer);
      global.clearInterval(expiryTimer);
      const local = root?.querySelector("[data-remote-local-video]");
      const remote = root?.querySelector("[data-remote-video]");
      if (local) { local.srcObject = null; local.hidden = true; }
      if (remote) { remote.srcObject = null; remote.hidden = true; }
      const empty = root?.querySelector("[data-remote-empty-stage]");
      if (empty) empty.hidden = false;
      root?.querySelector("[data-remote-session-card]")?.setAttribute("hidden", "");
      renderChannelState(false);
      renderPauseState();
      renderRemotePause(false);
      renderParticipants();
      renderLockState();
      setStatus(message, "idle");
      log(message);
    } finally {
      isStopping = false;
    }
  }

  function permissionMarkup() {
    return Object.entries(PERMISSIONS).map(([key, meta]) => `<label class="remote-permission"><span><strong>${escapeHTML(meta.label)}</strong><small>${escapeHTML(meta.note)}</small></span><input type="checkbox" data-remote-permission="${key}" ${meta.default ? "checked" : ""}><i aria-hidden="true"></i></label>`).join("");
  }

  function markup() {
    const nav = VIEWS.map(([id, icon, title, note]) => `<button type="button" role="tab" aria-selected="${id === "quick"}" data-remote-view="${id}" class="${id === "quick" ? "is-active" : ""}"><i>${icon}</i><span><b>${title}</b><small>${note}</small></span></button>`).join("");
    return `<section class="remote-hub" data-remote-hub data-role="host" data-view="quick">
      <div class="remote-cosmos" aria-hidden="true"><i></i><i></i><i></i><span></span><span></span><b></b><em></em></div>
      <header class="remote-topbar"><div class="remote-brand"><i><b>R</b></i><span><small>HH QUANTUM REMOTE V3</small><strong>Remote máy tính & điện thoại</strong></span></div><div class="remote-link-status" data-remote-status data-tone="idle"><i></i><span>Chưa kết nối</span></div><div class="remote-session-health"><span data-remote-quality-active>Tự động · Cân bằng</span><span data-remote-channel-state data-online="false">Chưa kết nối</span><span class="remote-expiry">Hết hạn <b data-remote-expiry>15:00</b></span><button type="button" data-remote-stop>Ngắt phiên</button></div></header>
      <div class="remote-layout">
        <aside class="remote-nav"><header><small>REMOTE WORKSPACE</small><strong>Trung tâm hỗ trợ</strong></header><nav role="tablist">${nav}</nav><footer><i></i><span><b>Phiên zero-trust</b><small>Chủ máy duyệt từng thiết bị và từng quyền</small></span></footer></aside>
        <main class="remote-stage">
          <section class="remote-screen" data-remote-screen><div class="remote-empty" data-remote-empty-stage><div class="remote-device-orbit"><i class="pc">▰</i><i class="phone">▯</i><span></span><b></b></div><small>DIRECT DEVICE LINK</small><h1>Hỗ trợ từ xa an toàn</h1><p>Xem màn hình, chat, chỉ điểm, chuyển tệp, chụp ảnh và ghi hình qua WebRTC. Mọi quyền nhạy cảm đều do chủ máy bật và có thể thu hồi ngay.</p></div><video data-remote-local-video autoplay muted playsinline hidden></video><video data-remote-video autoplay playsinline hidden></video><i class="remote-pointer" data-remote-pointer></i><div class="remote-paused-label" data-remote-paused-label hidden>Chủ phiên đã tạm dừng hình ảnh</div><div class="remote-recording-badge">● REC · Ghi cục bộ</div><div class="remote-screen-actions"><button type="button" data-remote-replace>Nguồn khác</button><button type="button" data-remote-pause disabled>Tạm dừng</button><button type="button" data-remote-screenshot disabled>Chụp PNG</button><button type="button" data-remote-record disabled>Ghi hình</button><button type="button" data-remote-fit>Vừa khung</button><button type="button" data-remote-fullscreen>Toàn màn hình</button><button type="button" data-remote-pip>PiP</button><button type="button" data-remote-copy-clipboard data-remote-capability="clipboard" disabled>Gửi clipboard</button></div></section>
          <section class="remote-connect-card"><header><div><small>KẾT NỐI CÓ XÁC NHẬN</small><strong>Thiết bị này sẽ làm gì?</strong></div><div class="remote-role"><button type="button" data-remote-role="host" class="is-active">Chia sẻ</button><button type="button" data-remote-role="viewer">Hỗ trợ</button></div></header><div data-remote-host-form><p>Trình duyệt luôn mở hộp chọn màn hình. Quyền không được ghi nhớ và dừng ngay khi bạn ngắt phiên.</p><label class="remote-audio-choice"><input type="checkbox" data-remote-system-audio><span>Chia sẻ âm thanh hệ thống nếu trình duyệt cho phép</span></label><button class="remote-primary" type="button" data-remote-create-session>Tạo phiên & chọn màn hình</button></div><div data-remote-join-form hidden><label>Mã phiên<input data-remote-join-code maxlength="8" autocomplete="off" placeholder="ABCD2345"></label><label>PIN 6 số<input data-remote-join-pin maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="000000"></label><button class="remote-primary" type="button" data-remote-join-session>Gửi yêu cầu kết nối</button></div><article class="remote-session-code" data-remote-session-card hidden><span><small>MÃ PHIÊN</small><strong data-remote-code>--------</strong></span><span><small>PIN MỘT LẦN</small><strong data-remote-pin>------</strong></span><button type="button" data-remote-copy-session>Sao chép</button></article></section>
          <details class="remote-manual"><summary>WebRTC thủ công · phương án dự phòng khi signaling gián đoạn</summary><div><label>Mã nhận từ thiết bị kia<textarea data-remote-manual-input rows="3" spellcheck="false" placeholder="Dán offer hoặc answer tại đây"></textarea></label><label>Mã do thiết bị này tạo<textarea data-remote-manual-output rows="3" readonly spellcheck="false"></textarea></label><footer><button type="button" data-remote-manual-action>Tạo mã mời thủ công</button><button type="button" data-remote-apply-answer>Áp dụng mã trả lời</button><button type="button" data-remote-copy-manual>Sao chép mã của tôi</button></footer></div></details>
        </main>
        <aside class="remote-context">
          <section data-remote-pane="quick"><header><small>QUICK CONNECT</small><strong>Yêu cầu đang chờ</strong></header><div class="remote-requests" data-remote-requests><p>Chưa có thiết bị yêu cầu kết nối.</p></div><div class="remote-steps"><span><i>1</i><b>Chọn đúng màn hình</b></span><span><i>2</i><b>Chia sẻ mã + PIN riêng</b></span><span><i>3</i><b>Kiểm tra tên thiết bị</b></span><span><i>4</i><b>Phê duyệt rồi khóa phiên</b></span></div></section>
          <section data-remote-pane="live" hidden><header><small>HH LIVE ROOMS</small><strong>Phòng đang phát cho bạn</strong></header><div class="remote-live-rooms" data-remote-live-rooms><p>Mở mục này để tải các phòng đang hoạt động.</p></div><button type="button" data-remote-refresh-rooms>Làm mới danh sách</button><div class="remote-audience-editor"><header><small>AI ĐƯỢC THẤY PHÒNG?</small><strong>Phạm vi phát của tôi</strong></header><label>Tên phòng<input type="text" maxlength="80" value="Phòng hỗ trợ màn hình" data-remote-room-title></label><div class="remote-audience-grid"><label>Người nhìn thấy<select data-remote-audience-visibility><option value="hidden">Ẩn · chỉ mã + PIN</option><option value="invited">Chỉ người được chọn</option><option value="friends">Bạn bè trên HH</option><option value="members">Tất cả thành viên website</option></select></label><label>Số người xem<select data-remote-max-viewers><option value="1">1 người</option><option value="3">3 người</option><option value="6">6 người</option></select></label></div><p data-remote-audience-note>Không xuất hiện trong danh sách phòng. Người xem cần mã phiên và PIN.</p><div class="remote-audience-friends" data-remote-audience-friends hidden><p>Đang tải danh sách bạn bè…</p></div><label class="remote-approval-choice"><input type="checkbox" data-remote-require-approval checked><span><strong>Duyệt từng người trước khi xem</strong><small>Nên giữ bật nếu phòng có dữ liệu riêng tư.</small></span></label><button type="button" class="remote-primary" data-remote-update-audience>Áp dụng phạm vi</button><p class="remote-broadcast-limit">WebRTC P2P hỗ trợ tối đa 6 người xem trực tiếp. Phòng không gửi hình ảnh lên signaling server.</p></div></section>
          <section data-remote-pane="control" hidden><header><small>CONTROL & PERMISSIONS</small><strong>Quyền trong phiên</strong></header><p class="remote-pane-intro">Chủ phiên bật riêng từng khả năng. Hai quyền an toàn cơ bản được bật mặc định; quyền nhạy cảm mặc định tắt.</p><div class="remote-permissions" data-remote-permissions>${permissionMarkup()}</div><div class="remote-session-controls"><button type="button" data-remote-lock disabled>Khóa phiên</button><button type="button" data-remote-revoke-all>Thu hồi thiết bị khách</button></div></section>
          <section data-remote-pane="assist" hidden><header><small>REMOTE ASSIST</small><strong>Chat & con trỏ laser</strong></header><div class="remote-messages" data-remote-messages><p data-kind="system">Kết nối P2P để bắt đầu hỗ trợ.</p></div><form data-remote-chat-form><input data-remote-chat-input maxlength="2000" placeholder="Nhắn cho thiết bị kia..."><button type="submit" data-remote-capability="chat" disabled>Gửi</button></form><p>Chạm vào khung màn hình để chỉ vị trí. Trình duyệt không thể tự bấm chuột hay nhập bàn phím của hệ điều hành.</p></section>
          <section data-remote-pane="files" hidden><header><small>P2P FILE STREAM</small><strong>Truyền tệp trực tiếp</strong></header><label class="remote-file-picker">Chọn tệp tối đa 32 MB<input type="file" data-remote-file></label><button class="remote-primary" type="button" data-remote-send-file data-remote-capability="files" disabled>Gửi theo từng khối P2P</button><div class="remote-file-progress" data-remote-file-progress hidden><i></i><span>Đang chờ tệp</span></div><div class="remote-downloads" data-remote-downloads></div><p>Tệp không đi qua signaling server. Hệ thống kiểm tra kích thước khai báo, giới hạn bộ đệm và chỉ tạo file khi nhận đủ dữ liệu.</p></section>
          <section data-remote-pane="network" hidden><header><small>ADAPTIVE QUALITY</small><strong>Chất lượng kết nối</strong></header><label class="remote-quality-select">Chế độ truyền<select data-remote-quality><option value="auto">Tự động thông minh</option><option value="saver">Tiết kiệm · 540p 12 FPS</option><option value="balanced">Cân bằng · 720p 20 FPS</option><option value="sharp">Sắc nét · 1080p 30 FPS</option></select></label><div class="remote-network-health" data-remote-network-health data-tone="idle">Đang chờ kết nối</div><div class="remote-metrics"><span><small>Bitrate</small><b data-remote-metric="bitrate">—</b></span><span><small>Độ trễ RTT</small><b data-remote-metric="rtt">—</b></span><span><small>Mất gói</small><b data-remote-metric="loss">—</b></span><span><small>Khung hình</small><b data-remote-metric="resolution">—</b></span><span><small>Đường truyền</small><b data-remote-metric="candidate">—</b></span></div><button type="button" data-remote-restart-ice>Khôi phục kết nối ICE</button></section>
          <section data-remote-pane="devices" hidden><header><small>SESSION DEVICES</small><strong>Thiết bị trong phiên</strong></header><div class="remote-participants" data-remote-participants></div><header class="remote-subhead"><small>BROWSER CAPABILITIES</small><strong>Khả năng thật</strong></header><div class="remote-capabilities" data-remote-capabilities></div></section>
          <section data-remote-pane="security" hidden><header><small>ZERO-TRUST SESSION</small><strong>Bảo mật & nhật ký</strong></header><ul><li>Mỗi phiên dùng mã 8 ký tự, PIN một lần và phê duyệt thiết bị.</li><li>PIN và host token chỉ lưu dạng SHA-256 trên signaling server, tự hết hạn sau 15 phút.</li><li>Media và dữ liệu đi qua WebRTC mã hóa; signaling chỉ chuyển SDP/ICE đã giới hạn.</li><li>Clipboard, tệp, ảnh chụp và ghi hình mặc định bị khóa.</li><li>Không có truy cập không giám sát và không lưu PIN dùng lại.</li><li>Không tuyên bố điều khiển hệ điều hành khi chưa có native agent đã xác minh.</li></ul><div class="remote-history" data-remote-history></div><button type="button" data-remote-clear-history>Xóa nhật ký trên máy</button></section>
          <section class="remote-activity"><header><small>SECURITY ACTIVITY</small><strong>Nhật ký metadata phiên</strong></header><div data-remote-log><p><time>${nowLabel()}</time><span>Remote Hub v3 đã sẵn sàng.</span></p></div></section>
        </aside>
      </div>
      <div class="remote-toast" data-remote-toast hidden role="status" aria-live="polite"></div>
    </section>`;
  }

  function bind() {
    aborter?.abort();
    aborter = new AbortController();
    const signal = aborter.signal;
    root.addEventListener("click", async (event) => {
      try {
        const view = event.target.closest("[data-remote-view]");
        if (view) return setView(view.dataset.remoteView);
        const role = event.target.closest("[data-remote-role]");
        if (role) return setRole(role.dataset.remoteRole);
        const revoke = event.target.closest("[data-remote-revoke]");
        if (revoke) return await revokeViewer(revoke.dataset.remoteRevoke);
        const watchRoom = event.target.closest("[data-remote-watch-room]");
        if (watchRoom) return await watchLiveRoom(watchRoom.dataset.remoteWatchRoom);
        if (event.target.closest("[data-remote-refresh-rooms]")) return await loadLiveRooms();
        if (event.target.closest("[data-remote-update-audience]")) return await updateRoomAudience();
        if (event.target.closest("[data-remote-create-session]")) return await createQuickSession();
        if (event.target.closest("[data-remote-join-session]")) return await joinQuickSession();
        if (event.target.closest("[data-remote-approve]")) return await approveRequest(event.target.closest("article"), true);
        if (event.target.closest("[data-remote-deny]")) return await approveRequest(event.target.closest("article"), false);
        if (event.target.closest("[data-remote-stop]")) return await stopSession();
        if (event.target.closest("[data-remote-lock]")) return await setSessionLock();
        if (event.target.closest("[data-remote-revoke-all]")) {
          const ids = [...peerDevices.keys()];
          if (!ids.length) throw new Error("Chưa có thiết bị khách để thu hồi.");
          for (const id of ids) await revokeViewer(id);
          return;
        }
        if (event.target.closest("[data-remote-replace]")) {
          if (activeRole !== "host") throw new Error("Chỉ chủ phiên mới có thể đổi nguồn màn hình.");
          return await startCapture({ replace: Boolean(localStream) });
        }
        if (event.target.closest("[data-remote-pause]")) return togglePause();
        if (event.target.closest("[data-remote-screenshot]")) return await captureScreenshot();
        if (event.target.closest("[data-remote-record]")) return toggleRecording();
        if (event.target.closest("[data-remote-restart-ice]")) return await restartConnections();
        if (event.target.closest("[data-remote-manual-action]")) return await createManualCode();
        if (event.target.closest("[data-remote-apply-answer]")) return await applyManualAnswer();
        if (event.target.closest("[data-remote-copy-manual]")) { await global.navigator.clipboard.writeText(root.querySelector("[data-remote-manual-output]").value); return toast("Đã sao chép mã WebRTC.", "success"); }
        if (event.target.closest("[data-remote-copy-session]")) { await global.navigator.clipboard.writeText(`${session?.code || ""} · PIN ${session?.pin || ""}`); return toast("Đã sao chép mã phiên và PIN.", "success"); }
        if (event.target.closest("[data-remote-fit]")) { root.querySelector("[data-remote-screen]")?.classList.toggle("is-cover"); return; }
        if (event.target.closest("[data-remote-fullscreen]")) return await root.querySelector("[data-remote-screen]")?.requestFullscreen?.();
        if (event.target.closest("[data-remote-pip]")) {
          const video = activeVideo();
          if (!video?.requestPictureInPicture) throw new Error("Picture-in-Picture không khả dụng.");
          return await video.requestPictureInPicture();
        }
        if (event.target.closest("[data-remote-copy-clipboard]")) {
          const text = clean(await global.navigator.clipboard.readText(), 10_000);
          if (!text) throw new Error("Clipboard không có văn bản.");
          sendData("clipboard", { text });
          return toast("Đã gửi clipboard sau thao tác chủ động của bạn.", "success");
        }
        if (event.target.closest("[data-remote-send-file]")) return await sendFile(root.querySelector("[data-remote-file]").files?.[0]);
        if (event.target.closest("[data-remote-clear-history]")) { global.localStorage.removeItem(ownerKey()); renderHistory(); return toast("Đã xóa nhật ký Remote trên máy.", "success"); }
      } catch (error) { setStatus(error.message || error, "error"); log(error.message || error, "error"); toast(error.message || error, "error"); }
    }, { signal });
    root.addEventListener("change", async (event) => {
      try {
        const permission = event.target.closest("[data-remote-permission]");
        if (permission) return updatePermission(permission.dataset.remotePermission, permission.checked);
        if (event.target.matches("[data-remote-audience-visibility]")) return syncAudienceEditor();
        if (event.target.matches("[data-remote-quality]")) {
          selectedQuality = event.target.value in QUALITY_PROFILES ? event.target.value : "auto";
          await applyQuality(selectedQuality === "auto" ? "balanced" : selectedQuality);
          return log(`Đã chọn chất lượng ${event.target.options[event.target.selectedIndex].text}.`, "success");
        }
      } catch (error) { toast(error.message || error, "error"); }
    }, { signal });
    root.querySelector("[data-remote-chat-form]")?.addEventListener("submit", (event) => { event.preventDefault(); try { sendChat(); } catch (error) { toast(error.message, "error"); } }, { signal });
    root.querySelector("[data-remote-screen]")?.addEventListener("pointerdown", (event) => {
      if (!openChannels().length || activeRole !== "viewer" || !permissionAllowed("pointer")) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      try { sendData("pointer", { x, y }); showPointer(x, y); } catch {}
    }, { signal });
    global.addEventListener("pagehide", () => stopSession("Phiên đã đóng khi rời trang."), { signal });
    global.document.addEventListener("visibilitychange", () => {
      if (global.document.hidden && recorder?.state === "recording") log("Tab đang ẩn nhưng chỉ báo ghi hình vẫn được duy trì.");
    }, { signal });
  }

  function mount(element, mountOptions = {}) {
    if (!element) throw new Error("Remote Hub cần một phần tử mount hợp lệ.");
    unmount();
    root = element;
    options = mountOptions;
    hostPermissions = defaultPermissions();
    remotePermissions = defaultPermissions();
    root.innerHTML = markup();
    bind();
    setRole("host");
    setView("quick");
    renderCapabilities();
    renderHistory();
    renderParticipants();
    renderChannelState(false);
    renderLockState();
    renderPauseState();
    renderAudienceFriends();
    syncAudienceEditor();
    const caps = supported();
    setStatus(caps.webrtc && caps.secure ? "Sẵn sàng tạo kết nối" : "Thiết bị đang bị giới hạn", caps.webrtc && caps.secure ? "online" : "error");
    return { unmount };
  }

  function unmount() {
    try { aborter?.abort(); } catch {}
    try { if (session?.code && socket?.connected) socket.emit("remote:session:leave", { code: session.code, hostToken: session.hostToken || "" }); } catch {}
    try { socket?.disconnect(); } catch {}
    if (recorder?.state === "recording") try { recorder.stop(); } catch {}
    localStream?.getTracks?.().forEach((track) => { try { track.stop(); } catch {} });
    peers.forEach((pc) => { try { pc.close(); } catch {} });
    downloadUrls.forEach((url) => { try { URL.revokeObjectURL(url); } catch {} });
    global?.clearInterval?.(statsTimer);
    global?.clearInterval?.(expiryTimer);
    aborter = null;
    socket = null;
    localStream = null;
    channel = null;
    channels = new Map();
    session = null;
    peers = new Map();
    peerDevices = new Map();
    pendingCandidates = new Map();
    incomingFiles = new Map();
    downloadUrls = new Set();
    seenMessages = new Set();
    recorder = null;
    recordingChunks = [];
    isStopping = false;
    isPaused = false;
    sessionLocked = false;
    selectedQuality = "auto";
    appliedQuality = "balanced";
    lastStatsSample = null;
    liveRooms = [];
    audienceFriends = [];
    audienceState = { title: "Phòng hỗ trợ màn hình", visibility: "hidden", allowedUserIds: [], requireApproval: true, maxViewers: 1 };
    if (root) root.replaceChildren();
    root = null;
  }

  return Object.freeze({ mount, unmount, normalizeCode, encodeSignal, decodeSignal, createEnvelope, normalizeEnvelope, supported, VERSION, MAX_FILE_BYTES, CHUNK_BYTES, MAX_DATA_MESSAGE_BYTES, QUALITY_PROFILES, PERMISSIONS });
});
