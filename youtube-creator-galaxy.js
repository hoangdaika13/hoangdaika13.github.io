(() => {
  "use strict";

  const STORAGE_KEY = "hh.youtube-creator-galaxy.v2";
  const FLEET_STORAGE_KEY = "hh.youtube-channel-fleet.v1";
  const VIDEO_PROJECT_KEY = "hh.video-editor.project.v1";
  const MEDIA_DB = "hh-video-editor-media";
  const MEDIA_STORE = "assets";
  const MODULES = Object.freeze([
    { id: "command", icon: "H", label: "Command Center", color: "#69ebff", note: "Kênh, video và tín hiệu thật" },
    { id: "connect", icon: "CN", label: "Channel Connect", color: "#5fa8ff", note: "OAuth và quyền truy cập" },
    { id: "fleet", icon: "FL", label: "Channel Fleet", color: "#6ee7c7", note: "Nhiều tài khoản và bulk upload" },
    { id: "director", icon: "AD", label: "Auto Director", color: "#ff66c8", note: "Timeline và bản dựng" },
    { id: "upload", icon: "UP", label: "Upload & Scheduler", color: "#9b7cff", note: "Resumable upload" },
    { id: "thumbnail", icon: "TH", label: "Thumbnail Galaxy", color: "#ff8f66", note: "Canvas 1280 × 720" },
    { id: "seo", icon: "SE", label: "Metadata & SEO", color: "#ffd66b", note: "Phân tích nội bộ có giải thích" },
    { id: "shorts", icon: "SH", label: "Shorts Factory", color: "#ff4f8d", note: "9:16 và batch plan" },
    { id: "captions", icon: "CC", label: "Captions Studio", color: "#56e6b1", note: "SRT, VTT và ngôn ngữ" },
    { id: "analytics", icon: "AN", label: "Analytics", color: "#7c9dff", note: "YouTube Analytics API" },
    { id: "comments", icon: "CM", label: "Community", color: "#55d8ff", note: "Phản hồi và kiểm duyệt" },
    { id: "live", icon: "LV", label: "Live Control", color: "#ff5e68", note: "Broadcast và stream" },
    { id: "calendar", icon: "CL", label: "Content Calendar", color: "#b28aff", note: "Pipeline và deadline" },
    { id: "preflight", icon: "PF", label: "Publish Preflight", color: "#ffb15f", note: "Quyền, codec và chất lượng" }
  ]);
  const DEFAULT_STATE = Object.freeze({
    active: "command",
    thumbnail: { title: "TIÊU ĐỀ VIDEO", subtitle: "HH CREATOR GALAXY", variant: "A", accent: "#ff5fbf", variants: [] },
    seo: { videoId: "", title: "", description: "", tags: "", keyword: "", versions: [] },
    shorts: { source: "", duration: 45, hook: "", caption: true, progress: true, safeZone: true, plans: [] },
    captions: { videoId: "", language: "vi", name: "Tiếng Việt", format: "srt", content: "", status: "draft" },
    publishProject: null,
    commentStates: {},
    automation: { enabled: false, approvalGate: true, idempotencyKey: "", lastPreviewAt: "" },
    calendar: [],
    preflight: { rightsConfirmed: false, privacyChecked: false, captionsChecked: false }
  });

  let root = null;
  let controller = null;
  let storageChannelId = "unassigned";
  let state = loadState();
  let channelStatus = { configured: false, connected: false, permissions: {} };
  let dashboard = null;
  let busy = "";
  let errorMessage = "";
  let thumbnailImage = null;
  let thumbnailVideo = null;
  let thumbnailVideoUrl = "";
  let publisherMounted = false;
  let retentionData = null;
  let comparisonData = null;
  let commentDrafts = [];
  let captionTracks = [];
  let fleetState = loadFleetState();
  let fleetOverview = null;
  let fleetJobs = [];
  let fleetPreflight = null;
  let fleetUploadFile = null;

  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const apiBase = () => String(window.HH_REALTIME_URL || location.origin).replace(/\/$/, "");
  const authHeaders = () => {
    const token = window.HHAuthSession?.token?.() || "";
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };
  const fmt = (value) => Number(value || 0).toLocaleString("vi-VN");
  const bytes = (value) => {
    const size = Math.max(0, Number(value || 0));
    if (!size) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(units.length - 1, Math.floor(Math.log(size) / Math.log(1024)));
    return `${(size / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
  };
  const dateTime = (value) => {
    if (!value) return "Chưa có";
    const date = new Date(value);
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date)
      : "Không hợp lệ";
  };
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  function currentIdentity() {
    const fromRuntime = window.HHAuthz?.currentUser?.();
    if (fromRuntime && typeof fromRuntime === "object") return fromRuntime;
    try { return JSON.parse(localStorage.getItem("hh-auth-user") || "null"); }
    catch { return null; }
  }

  function currentIdentityId() {
    const user = currentIdentity();
    return String(user?.id || user?._id || "guest").replace(/[^a-z0-9_-]/gi, "").slice(0, 80) || "guest";
  }

  function privateStorageKey(base = STORAGE_KEY) {
    return base === STORAGE_KEY
      ? `${base}:${currentIdentityId()}:${storageChannelId}`
      : `${base}:${currentIdentityId()}`;
  }

  function normalizeState(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      ...DEFAULT_STATE,
      ...source,
      thumbnail: {
        ...DEFAULT_STATE.thumbnail,
        ...(source.thumbnail || {}),
        variants: Array.isArray(source.thumbnail?.variants) ? source.thumbnail.variants.slice(0, 3) : []
      },
      seo: {
        ...DEFAULT_STATE.seo,
        ...(source.seo || {}),
        versions: Array.isArray(source.seo?.versions) ? source.seo.versions.slice(0, 10) : []
      },
      shorts: {
        ...DEFAULT_STATE.shorts,
        ...(source.shorts || {}),
        plans: Array.isArray(source.shorts?.plans) ? source.shorts.plans.slice(0, 20) : []
      },
      captions: { ...DEFAULT_STATE.captions, ...(source.captions || {}) },
      publishProject: source.publishProject && typeof source.publishProject === "object" ? source.publishProject : null,
      commentStates: source.commentStates && typeof source.commentStates === "object" ? source.commentStates : {},
      automation: { ...DEFAULT_STATE.automation, ...(source.automation || {}) },
      calendar: Array.isArray(source.calendar) ? source.calendar.slice(0, 100) : [],
      preflight: { ...DEFAULT_STATE.preflight, ...(source.preflight || {}) }
    };
  }

  function loadState() {
    try { return normalizeState(JSON.parse(sessionStorage.getItem(privateStorageKey()) || "null")); }
    catch { return normalizeState(null); }
  }

  function saveState() {
    try { sessionStorage.setItem(privateStorageKey(), JSON.stringify(state)); } catch {}
  }

  function loadFleetState() {
    try {
      const value = JSON.parse(sessionStorage.getItem(privateStorageKey(FLEET_STORAGE_KEY)) || "null");
      return {
        selectedChannelIds: Array.isArray(value?.selectedChannelIds) ? value.selectedChannelIds.map(String).slice(0, 5) : [],
        title: String(value?.title || "").slice(0, 100),
        description: String(value?.description || "").slice(0, 5000),
        tags: String(value?.tags || "").slice(0, 500),
        privacyStatus: ["private", "unlisted"].includes(value?.privacyStatus) ? value.privacyStatus : "private",
        rightsConfirmed: Boolean(value?.rightsConfirmed),
        idempotencyKey: String(value?.idempotencyKey || "").slice(0, 160),
        results: Array.isArray(value?.results) ? value.results.slice(0, 20) : []
      };
    } catch {
      return { selectedChannelIds: [], title: "", description: "", tags: "", privacyStatus: "private", rightsConfirmed: false, idempotencyKey: "", results: [] };
    }
  }

  function saveFleetState() {
    try { sessionStorage.setItem(privateStorageKey(FLEET_STORAGE_KEY), JSON.stringify(fleetState)); } catch {}
  }

  function readVideoProject() {
    try {
      const identityId = currentIdentityId();
      const scopedProject = JSON.parse(localStorage.getItem(privateStorageKey(VIDEO_PROJECT_KEY)) || "null");
      if (scopedProject && typeof scopedProject === "object") return scopedProject;
      const project = JSON.parse(localStorage.getItem(VIDEO_PROJECT_KEY) || "null");
      const ownerId = String(project?.ownerId || project?.userId || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 80);
      return project && typeof project === "object" && ownerId === identityId ? project : null;
    } catch {
      return null;
    }
  }

  async function api(path, method = "GET", body) {
    const response = await fetch(`${apiBase()}/api/youtube/${path}`, {
      method,
      headers: authHeaders(),
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || `YouTube API HTTP ${response.status}`);
      error.code = data.code || "YOUTUBE_API_ERROR";
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function handleOauthResult() {
    const params = new URLSearchParams(location.search);
    const connected = params.get("youtubeConnected");
    const oauthError = params.get("youtubeError");
    if (!connected && !oauthError) return;
    params.delete("youtubeConnected");
    params.delete("youtubeError");
    history.replaceState({}, "", `${location.pathname}${params.toString() ? `?${params}` : ""}${location.hash}`);
    errorMessage = oauthError || "";
  }

  async function refresh(all = true) {
    busy = "refresh";
    errorMessage = "";
    render();
    try {
      channelStatus = await api("status");
      const nextStorageChannel = String(channelStatus.channel?.id || "unassigned").replace(/[^a-z0-9_-]/gi, "").slice(0, 120) || "unassigned";
      if (nextStorageChannel !== storageChannelId) {
        storageChannelId = nextStorageChannel;
        state = loadState();
      }
      if (all && channelStatus.connected) {
        const [dashboardResult, overviewResult, jobsResult] = await Promise.all([
          api("dashboard"),
          api("channels/overview"),
          api("bulk/jobs").catch(() => ({ jobs: [] }))
        ]);
        dashboard = dashboardResult;
        fleetOverview = overviewResult;
        fleetJobs = jobsResult.jobs || [];
        if (dashboard.project) {
          state.publishProject = dashboard.project;
          saveState();
        }
        if (state.active === "comments") {
          const drafts = await api("comments/drafts").catch(() => ({ drafts: [] }));
          commentDrafts = drafts.drafts || [];
        }
        if (state.active === "analytics" && !comparisonData) {
          const comparison = await api("analytics/comparison").catch(() => null);
          comparisonData = comparison?.comparison || null;
        }
      }
      else if (!channelStatus.connected) {
        dashboard = null;
        fleetOverview = null;
        fleetJobs = [];
      }
    } catch (error) {
      errorMessage = error.message;
      if (error.status === 401) channelStatus = { configured: false, connected: false, authRequired: true, permissions: {} };
    } finally {
      busy = "";
      render();
    }
  }

  function connectionTone() {
    if (channelStatus.authRequired) return ["auth", "Cần đăng nhập HH Platform"];
    if (!channelStatus.configured) return ["warning", "OAuth chưa cấu hình"];
    if (!channelStatus.connected) return ["idle", "Chưa kết nối kênh"];
    return ["ready", "Đã kết nối YouTube"];
  }

  function orbitMarkup() {
    const analytics = dashboard?.analytics?.totals || {};
    const uploads = dashboard?.uploads || [];
    const activeUpload = uploads.filter((item) => ["uploading", "processing"].includes(item.status)).length;
    const failed = uploads.filter((item) => item.status === "error").length;
    const uploading = uploads.find((item) => item.status === "uploading");
    const uploadPercent = uploading?.totalBytes
      ? Math.min(100, Number(uploading.bytesUploaded || 0) / Number(uploading.totalBytes) * 100)
      : 0;
    const scheduled = (dashboard?.videos || []).filter((item) => item.scheduledAt && new Date(item.scheduledAt) > new Date()).length;
    const missingCaptions = state.publishProject?.captions?.filter((item) => item.status !== "uploaded").length || 0;
    const quotaLedger = dashboard?.quotaLedger;
    const nextLive = (dashboard?.live || [])
      .filter((item) => item.scheduledStartTime && new Date(item.scheduledStartTime) > new Date())
      .sort((a, b) => new Date(a.scheduledStartTime) - new Date(b.scheduledStartTime))[0];
    const cards = [
      ["KÊNH", channelStatus.connected ? channelStatus.channel?.title : "Chưa kết nối", channelStatus.connected ? `ID ${channelStatus.channel?.id}` : "Mở Channel Connect"],
      ["LƯỢT XEM · 28 NGÀY", dashboard?.analytics ? fmt(analytics.views) : "—", dashboard?.analytics ? "YouTube Analytics API" : "Chưa có dữ liệu"],
      ["THỜI GIAN XEM", dashboard?.analytics ? `${fmt(Math.round((analytics.estimatedMinutesWatched || 0) / 60))} giờ` : "—", "Khoảng ngày thật"],
      ["UPLOAD", uploading ? `${uploadPercent.toFixed(1)}% · ${bytes(uploading.speedBps)}/s` : dashboard ? `${activeUpload} chạy · ${failed} lỗi` : "—", uploading?.etaSeconds ? `Còn khoảng ${Math.ceil(uploading.etaSeconds / 60)} phút` : uploads.length ? "Hàng đợi backend" : "Chưa có hoạt động"],
      ["BÌNH LUẬN", dashboard ? fmt((dashboard.comments || []).filter((item) => !item.replyCount).length) : "—", "Chưa có phản hồi trong dữ liệu gần nhất"],
      ["XUẤT BẢN", scheduled ? `${scheduled} đã lên lịch` : "Chưa lên lịch", missingCaptions ? `${missingCaptions} caption chưa tải` : nextLive?.title || "Không có việc chờ"],
      ["QUOTA QUAN SÁT", quotaLedger ? `${fmt(quotaLedger.used)} unit` : "Không cung cấp", quotaLedger?.note || "Không giả lập số dư Google Console"],
      ["ĐỒNG BỘ", dashboard?.syncedAt ? dateTime(dashboard.syncedAt) : "Chưa đồng bộ", navigator.onLine ? "Online" : "Offline"]
    ];
    return `<section class="ycg-orbit" aria-label="YouTube LIVE ORBIT">${cards.map(([label, value, note], index) => `
      <article style="--orbit-index:${index};--orbit-color:${MODULES[index % MODULES.length].color}">
        <i aria-hidden="true"></i><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small>
      </article>`).join("")}</section>`;
  }

  function shellHeader() {
    const [tone, label] = connectionTone();
    return `<header class="ycg-hero">
      <div class="ycg-sun" aria-hidden="true"><span>YT</span><i></i><b></b></div>
      <div><small>TOOL · YOUTUBE CREATOR GALAXY</small><h2>Điều hành kênh từ một vũ trụ</h2><p>Project, media, timeline, thumbnail, metadata, upload, Analytics, Community và Live dùng cùng một luồng dữ liệu. Không tạo số liệu mẫu.</p></div>
      <aside>
        <span class="ycg-state is-${tone}"><i></i>${esc(label)}</span>
        <small>${channelStatus.connected ? `${esc(channelStatus.channel?.title)} · ${dateTime(dashboard?.syncedAt || channelStatus.updatedAt)}` : "Token chỉ được lưu mã hóa ở backend"}</small>
        <div><button type="button" data-ycg-action="refresh" ${busy ? "disabled" : ""}>${busy === "refresh" ? "Đang đồng bộ…" : "Đồng bộ"}</button><button class="is-primary" type="button" data-ycg-action="${channelStatus.connected ? "open-upload" : "connect"}">${channelStatus.connected ? "Tải video lên" : "Kết nối kênh"}</button></div>
      </aside>
    </header>`;
  }

  function navigationMarkup() {
    return `<nav class="ycg-map" aria-label="YouTube Creator Galaxy">${MODULES.map((item, index) => `
      <button type="button" data-ycg-module="${item.id}" class="${state.active === item.id ? "is-active" : ""}" style="--planet:${item.color};--planet-index:${index}">
        <span>${item.icon}<i></i></span><b>${item.label}</b><small>${item.note}</small>
      </button>`).join("")}</nav>`;
  }

  function emptyState(title, message, action = "", label = "") {
    return `<div class="ycg-empty"><span aria-hidden="true">H</span><strong>${esc(title)}</strong><p>${esc(message)}</p>${action ? `<button class="is-primary" type="button" data-ycg-action="${action}">${esc(label)}</button>` : ""}</div>`;
  }

  function commandView() {
    if (!channelStatus.connected) return emptyState(
      "Kết nối kênh để kích hoạt Command Center",
      channelStatus.authRequired
        ? "Bạn cần đăng nhập HH Platform trước khi cấp quyền YouTube."
        : "Dashboard chỉ hiển thị dữ liệu mà YouTube trả về cho kênh được cấp quyền.",
      channelStatus.authRequired ? "signin" : "connect",
      channelStatus.authRequired ? "Đăng nhập" : "Kết nối OAuth"
    );
    const videos = dashboard?.videos || [];
    const warnings = dashboard?.warnings || [];
    const latest = videos[0];
    const growth = videos.slice().sort((a, b) => b.views - a.views)[0];
    const project = dashboard?.project || state.publishProject;
    const pipeline = [
      ["Render", project?.renderStatus === "completed"],
      ["Preflight", Boolean(project?.rightsManifest?.confirmed && !project?.rightsManifest?.missingLicenseCount)],
      ["Caption", Boolean(project?.approvals?.captions)],
      ["Thumbnail", Boolean(project?.approvals?.thumbnail)],
      ["Duyệt đăng", Boolean(project?.approvals?.publish)],
      ["Upload", Boolean(project?.videoId)]
    ];
    return `<div class="ycg-command-grid">
      <section class="ycg-panel ycg-command-core">
        <header><div><small>CHANNEL CORE</small><h3>${esc(channelStatus.channel?.title)}</h3></div><span>${fmt(channelStatus.channel?.subscribers)} người đăng ký</span></header>
        <div class="ycg-metric-grid">
          <article><span>Video trên kênh</span><strong>${fmt(channelStatus.channel?.videos)}</strong><small>YouTube Channels API</small></article>
          <article><span>Video gần nhất</span><strong>${latest ? esc(latest.title) : "Chưa có video"}</strong><small>${latest ? `${fmt(latest.views)} lượt xem · ${esc(latest.processingStatus || latest.uploadStatus || "đã tải")}` : "Không tạo nội dung mẫu"}</small></article>
          <article><span>Đang nổi bật</span><strong>${growth ? esc(growth.title) : "Chưa đủ dữ liệu"}</strong><small>${growth ? `${fmt(growth.views)} lượt xem trong tổng hiện có` : "Cần video thật"}</small></article>
          <article><span>Quyền Analytics</span><strong>${channelStatus.permissions?.analytics ? "Đã cấp" : "Thiếu quyền"}</strong><small>${channelStatus.permissions?.analytics ? "yt-analytics.readonly" : "Kết nối lại để bổ sung scope"}</small></article>
        </div>
        <div class="ycg-quick-actions">
          <button data-ycg-action="new-video">＋ Tạo video</button>
          <button data-ycg-action="new-short">▯ Tạo Short</button>
          <button data-ycg-action="open-upload">↑ Tải lên</button>
          <button data-ycg-action="open-calendar">◷ Lên lịch</button>
          <button data-ycg-action="open-live">● Mở livestream</button>
        </div>
        <div class="ycg-os-pipeline" aria-label="Universal Publish Project">${pipeline.map(([label, ready], index) => `<span class="${ready ? "is-ready" : ""}"><i>${ready ? "✓" : index + 1}</i><b>${label}</b></span>`).join("")}</div>
        <div class="ycg-action-row"><button data-ycg-action="sync-project">Lưu Universal Project</button><button data-ycg-action="open-calendar">Mở Cosmic Automation</button></div>
      </section>
      <section class="ycg-panel"><header><div><small>RECENT VIDEOS</small><h3>Video và trạng thái xử lý</h3></div><button data-ycg-action="refresh">Làm mới</button></header>
        <div class="ycg-video-list">${videos.length ? videos.slice(0, 8).map((video) => `<article>
          ${video.thumbnail ? `<img src="${esc(video.thumbnail)}" alt="">` : "<span>YT</span>"}
          <div><strong>${esc(video.title)}</strong><small>${dateTime(video.publishedAt || video.scheduledAt)} · ${esc(video.privacyStatus || "không rõ")}</small></div>
          <b>${fmt(video.views)} view</b><a href="https://youtu.be/${esc(video.id)}" target="_blank" rel="noopener">Mở ↗</a>
        </article>`).join("") : "<p>Chưa có video được YouTube trả về.</p>"}</div>
      </section>
      <section class="ycg-panel ycg-os-observatory"><header><div><small>CHANNEL VAULT · AUDIT</small><h3>Quyền, quota và hoạt động</h3></div><span>${dateTime(channelStatus.lastApiAt || dashboard?.syncedAt)}</span></header>
        <div class="ycg-vault-health">
          <article><span>Token</span><strong>${channelStatus.expiresAt ? `Hết hạn ${dateTime(channelStatus.expiresAt)}` : "Backend quản lý"}</strong><small>Không gửi token xuống giao diện</small></article>
          <article><span>Quota quan sát</span><strong>${dashboard?.quotaLedger ? `${fmt(dashboard.quotaLedger.used)} unit` : "Chưa có"}</strong><small>${esc(dashboard?.quotaLedger?.note || "Không phải số dư Google")}</small></article>
        </div>
        <div class="ycg-audit-list">${(dashboard?.audit || []).slice(0, 8).map((item) => `<article><i class="is-${esc(item.status)}"></i><div><strong>${esc(item.action)}</strong><small>${esc(item.detail || item.targetId || "Kênh hiện tại")} · ${dateTime(item.createdAt)}</small></div><b>${item.quotaCost ? `${fmt(item.quotaCost)} unit` : "—"}</b></article>`).join("") || "<p>Chưa có thao tác được ghi nhận.</p>"}</div>
      </section>
      ${warnings.length ? `<section class="ycg-panel ycg-warning-panel"><header><div><small>API SIGNALS</small><h3>Dịch vụ cần chú ý</h3></div></header>${warnings.map((item) => `<p><b>${esc(item.source)}</b><span>${esc(item.message)}</span></p>`).join("")}</section>` : ""}
    </div>`;
  }

  function connectView() {
    const permissions = channelStatus.permissions || {};
    const channels = Array.isArray(channelStatus.channels) ? channelStatus.channels : [];
    const verification = channelStatus.verificationReadiness || {};
    const rows = [
      ["Nhận diện kênh đã chọn", permissions.read, "openid · email · profile"],
      ["Upload video", permissions.upload, "youtube.upload"],
      ["Metadata, bình luận và livestream", permissions.manage, "youtube.force-ssl"],
      ["YouTube Analytics", permissions.analytics, "yt-analytics.readonly"]
    ];
    return `<section class="ycg-panel ycg-connect">
      <header><div><small>GOOGLE OAUTH 2.0</small><h3>YouTube Channel Connect</h3></div><span class="ycg-state is-${connectionTone()[0]}"><i></i>${esc(connectionTone()[1])}</span></header>
      <div class="ycg-account-vault">
        <div><strong>Kho kênh riêng của tài khoản HH hiện tại</strong><small>Dữ liệu khóa theo userId + channelId. Người dùng khác không thể liệt kê, chọn hay dùng token của bạn.</small></div>
        ${channels.length ? `<label><span>Kênh đang quản lý</span><select data-ycg-channel-select>${channels.map((item) => `<option value="${esc(item.id)}" ${item.id === channelStatus.channel?.id ? "selected" : ""}>${esc(item.title)} · ${esc(item.account?.hint || "Google")}</option>`).join("")}</select></label>` : ""}
        <button type="button" data-ycg-action="${channelStatus.authRequired ? "signin" : "connect-creator"}">+ Thêm tài khoản/kênh</button>
      </div>
      <div class="ycg-connect-layout">
        <div class="ycg-channel-card">
          ${channelStatus.channel?.thumbnail ? `<img src="${esc(channelStatus.channel.thumbnail)}" alt="Ảnh kênh">` : "<span>YT</span>"}
          <h4>${esc(channelStatus.channel?.title || "Chưa chọn kênh")}</h4>
          <p>${channelStatus.channel ? `Channel ID · ${esc(channelStatus.channel.id)} · ${esc(channelStatus.channel.account?.hint || "Google")}` : "Google sẽ hiển thị màn hình chọn tài khoản và Brand Account chính thức."}</p>
          <div>${channelStatus.connected ? `<button data-ycg-action="refresh-channel">Làm mới kênh</button><button data-ycg-action="disconnect">Ngắt kết nối</button>` : `<button class="is-primary" data-ycg-action="${channelStatus.authRequired ? "signin" : "connect-creator"}">${channelStatus.authRequired ? "Đăng nhập HH Platform" : "Chọn tài khoản Google"}</button>`}</div>
        </div>
        <div class="ycg-permissions"><h4>Quyền đã cấp · least privilege</h4>${rows.map(([label, ready, scope]) => `<p class="${ready ? "is-ready" : ""}"><i>${ready ? "✓" : "!"}</i><span><strong>${label}</strong><small>${esc(scope)} · ${ready ? "Sẵn sàng" : channelStatus.connected ? "Kết nối lại để cấp quyền" : "Chưa kết nối"}</small></span></p>`).join("")}
          <aside>Access token và refresh token không xuất hiện trong trình duyệt. Backend mã hóa AES‑256‑GCM và ràng buộc token với đúng tài khoản HH cùng Channel ID trước khi lưu.</aside>
        </div>
      </div>
      <div class="ycg-oauth-presets">
        <header><div><small>GRANULAR AUTHORIZATION</small><h4>Chọn đúng quyền cho tài khoản mới</h4></div><span>Không bắt buộc cấp toàn bộ</span></header>
        <button data-ycg-action="connect-upload"><strong>Chỉ Upload</strong><small>youtube.upload</small></button>
        <button data-ycg-action="connect-manage"><strong>Quản lý kênh</strong><small>youtube.force-ssl</small></button>
        <button data-ycg-action="connect-analytics"><strong>Chỉ Analytics</strong><small>yt-analytics.readonly</small></button>
        <button class="is-primary" data-ycg-action="connect-creator"><strong>Creator đầy đủ</strong><small>Ba scope đã khai báo</small></button>
      </div>
      <div class="ycg-verification-readiness">
        <header><div><small>GOOGLE VERIFICATION READINESS</small><h4>Checklist video demo và chính sách</h4></div><span>Trạng thái nội bộ, không phải phê duyệt của Google</span></header>
        <p class="is-ready"><i>✓</i><span><strong>Scope chính xác</strong><small>${(verification.exactSubmittedScopes || []).map((scope) => esc(scope.split("/").pop())).join(" · ") || "Tải từ backend"}</small></span></p>
        <p><i>1</i><span><strong>Consent Screen</strong><small>Video phải bấm “Show all services” và hiển thị scope rõ ràng.</small></span></p>
        <p><i>2</i><span><strong>Source Account Impact</strong><small>Quay kết quả upload/sửa metadata xuất hiện trên YouTube Studio của đúng kênh.</small></span></p>
        <p class="is-ready"><i>✓</i><span><strong>Data-sharing disclosure</strong><small><a href="${esc(verification.privacyPolicyUrl || "./privacy.html#google-api-data")}" target="_blank" rel="noopener">Mở Privacy Policy ↗</a></small></span></p>
      </div>
    </section>`;
  }

  function fleetView() {
    if (!channelStatus.connected) return emptyState(
      "Kết nối kênh trước khi tạo Channel Fleet",
      "Mỗi tài khoản HH có một kho Google/YouTube riêng và không thể xem kênh của người khác.",
      channelStatus.authRequired ? "signin" : "connect-creator",
      channelStatus.authRequired ? "Đăng nhập" : "Kết nối tài khoản"
    );
    const channels = fleetOverview?.channels || channelStatus.channels || [];
    const accounts = fleetOverview?.accounts || [];
    const limit = Number(fleetOverview?.limits?.maxChannelsPerBulkJob || channelStatus.bulk?.maxChannelsPerJob || 5);
    const selected = new Set(fleetState.selectedChannelIds);
    const preflightRows = fleetPreflight?.channels || [];
    return `<div class="ycg-fleet-grid">
      <section class="ycg-panel ycg-fleet-vault">
        <header><div><small>OWNER-ISOLATED CHANNEL VAULT</small><h3>Channel Fleet · ${channels.length} kênh / ${accounts.length || 1} tài khoản Google</h3></div><span>Tối đa ${limit} kênh mỗi job</span></header>
        <div class="ycg-fleet-accounts">${accounts.map((account) => `<article><strong>${esc(account.hint)}</strong><small>${account.channels.length} kênh · mã nội bộ ${esc(account.key)}</small></article>`).join("") || `<article><strong>${esc(channelStatus.channel?.account?.hint || "Tài khoản Google")}</strong><small>Dữ liệu chỉ hiện với chủ sở hữu HH</small></article>`}</div>
        <div class="ycg-fleet-channels">${channels.map((channel) => `<label class="${selected.has(channel.id) ? "is-selected" : ""}">
          <input type="checkbox" data-ycg-fleet-channel value="${esc(channel.id)}" ${selected.has(channel.id) ? "checked" : ""} ${!channel.active && !channel.updatedAt ? "disabled" : ""}>
          ${channel.thumbnail ? `<img src="${esc(channel.thumbnail)}" alt="">` : "<i>YT</i>"}
          <span><strong>${esc(channel.title)}</strong><small>${esc(channel.account?.hint || "Google")} · ${channel.permissionPreset === "creator" ? "Full Creator" : esc(channel.permissionPreset || "legacy")}</small></span>
          <b>${preflightRows.find((item) => item.channel?.id === channel.id)?.ready ? "✓ Ready" : selected.has(channel.id) && fleetPreflight ? "Cần quyền" : "Chọn"}</b>
        </label>`).join("")}</div>
        <div class="ycg-action-row"><button data-ycg-action="fleet-select-all">Chọn tối đa ${limit}</button><button data-ycg-action="fleet-clear">Đặt lại</button><button data-ycg-action="connect-creator">+ Thêm tài khoản/kênh</button></div>
      </section>
      <section class="ycg-panel ycg-fleet-upload">
        <header><div><small>SAFE MULTI-CHANNEL DELIVERY</small><h3>Upload một file tới nhiều kênh</h3></div><span>Private/Unlisted trước · duyệt Public sau</span></header>
        <form data-ycg-fleet-form>
          <label class="ycg-fleet-file"><span>Video MP4 / MOV / WebM</span><input type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska" data-ycg-fleet-file required><small>${fleetUploadFile ? `${esc(fleetUploadFile.name)} · ${bytes(fleetUploadFile.size)}` : "File chỉ được đọc trên thiết bị và tải thẳng tới phiên resumable của YouTube."}</small></label>
          <label>Tiêu đề<input name="title" maxlength="100" value="${esc(fleetState.title)}" required></label>
          <label>Mô tả<textarea name="description" maxlength="5000">${esc(fleetState.description)}</textarea></label>
          <div class="ycg-inline-fields"><label>Tags<input name="tags" maxlength="500" value="${esc(fleetState.tags)}"></label><label>Quyền riêng tư<select name="privacyStatus"><option value="private" ${fleetState.privacyStatus === "private" ? "selected" : ""}>Private</option><option value="unlisted" ${fleetState.privacyStatus === "unlisted" ? "selected" : ""}>Unlisted</option></select></label></div>
          <label class="ycg-fleet-confirm"><input type="checkbox" name="rightsConfirmed" ${fleetState.rightsConfirmed ? "checked" : ""} required><span>Tôi có quyền dùng nội dung và đã kiểm tra từng kênh đích.</span></label>
          <div class="ycg-fleet-preflight">${fleetPreflight ? `<strong class="${fleetPreflight.ready ? "is-ready" : ""}">${fleetPreflight.ready ? "✓ Tất cả kênh sẵn sàng" : "! Có kênh thiếu quyền"}</strong><small>Ước tính ${fmt(fleetPreflight.estimatedQuota)} quota unit · Google Console là nguồn quyết định</small>` : "Chạy preflight để kiểm tra quyền upload và refresh token của từng kênh."}</div>
          <div class="ycg-action-row"><button type="button" data-ycg-action="fleet-preflight">Kiểm tra ${selected.size} kênh</button><button class="is-primary" type="submit" ${busy.startsWith("bulk/") ? "disabled" : ""}>${busy.startsWith("bulk/") ? "Đang tạo phiên…" : "Tạo job và upload"}</button></div>
        </form>
      </section>
      <section class="ycg-panel ycg-fleet-jobs">
        <header><div><small>REAL JOB HISTORY</small><h3>Tiến trình theo từng kênh</h3></div><button data-ycg-action="fleet-refresh">Làm mới</button></header>
        <div>${fleetState.results.map((item) => `<article><strong>${esc(item.channelTitle || item.channelId)}</strong><span>${esc(item.status)}${Number.isFinite(item.progress) ? ` · ${item.progress.toFixed(1)}%` : ""}</span><small>${esc(item.error || item.videoId || "")}</small></article>`).join("")}${fleetJobs.map((job) => `<article><strong>Job ${esc(job.id)}</strong><span>${esc(job.status)}</span><small>${job.channelIds.length} kênh · ${dateTime(job.createdAt)}</small></article>`).join("") || (!fleetState.results.length ? "<p>Chưa có job bulk nào. Hệ thống không tạo tiến trình mẫu.</p>" : "")}</div>
      </section>
    </div>`;
  }

  function directorView() {
    const project = readVideoProject();
    const clipCount = project?.clips?.length || 0;
    const titles = project?.titles?.length || 0;
    const duration = (project?.clips || []).reduce((max, clip) => Math.max(max, Number(clip.start || 0) + Math.max(0, (Number(clip.out || 0) - Number(clip.in || 0)) / Math.max(.1, Number(clip.speed || 1)))), 0);
    return `<section class="ycg-panel ycg-director">
      <header><div><small>UNIVERSAL MEDIA PROJECT</small><h3>Auto Video Director for YouTube</h3></div><span>${project?.savedAt ? `Lưu ${dateTime(project.savedAt)}` : "Chưa có project"}</span></header>
      <div class="ycg-project-pulse">
        <article><span>Project</span><strong>${esc(project?.name || "Chưa có project")}</strong></article>
        <article><span>Timeline</span><strong>${clipCount} clip · ${Math.round(duration)} giây</strong></article>
        <article><span>Title & caption</span><strong>${titles}</strong></article>
        <article><span>Undo/redo</span><strong>${project?.history?.length || 0} command</strong></article>
      </div>
      <div class="ycg-director-flow">${["Media Pool", "Phân tích", "Đề xuất cắt", "Xem diff", "Áp dụng timeline", "Render MP4", "Upload"].map((label, index) => `<span class="${index === 0 && clipCount ? "is-ready" : ""}"><i>${index + 1}</i>${label}</span>`).join("")}</div>
      <div class="ycg-action-row"><button class="is-primary" data-ycg-action="open-auto">Mở Auto Director</button><button data-ycg-action="open-editor">Mở Video Studio</button><button data-ycg-action="open-upload">Đưa bản render sang Upload</button></div>
      <p class="ycg-honesty">${project ? "Auto Director sẽ tạo thay đổi thật trong project và lưu backup trước khi áp dụng." : "Hãy nhập media vào Video Studio. Không có clip hoặc timeline mẫu được tạo tự động."}</p>
    </section>`;
  }

  function uploadView() {
    return `<div class="ycg-publisher-host" data-ycg-publisher><div class="ycg-loading"><i></i><strong>Đang mở Upload & Scheduler…</strong></div></div>`;
  }

  function thumbnailView() {
    const thumb = state.thumbnail;
    return `<div class="ycg-thumbnail-grid">
      <section class="ycg-panel ycg-thumb-stage">
        <header><div><small>1280 × 720 · REAL CANVAS</small><h3>Thumbnail Galaxy</h3></div><span>PNG/JPEG · Media Pool</span></header>
        <canvas width="1280" height="720" data-ycg-thumbnail-canvas aria-label="Xem trước thumbnail"></canvas>
        <div class="ycg-safe-note">Viền đứt đoạn là safe zone; không xuất hiện trong file tải xuống.</div>
      </section>
      <section class="ycg-panel ycg-thumb-controls">
        <header><div><small>THUMBNAIL CONTROLS</small><h3>Nội dung và biến thể</h3></div></header>
        <label>Tiêu đề<input data-ycg-thumb="title" maxlength="80" value="${esc(thumb.title)}"></label>
        <label>Dòng phụ<input data-ycg-thumb="subtitle" maxlength="80" value="${esc(thumb.subtitle)}"></label>
        <label>Màu tín hiệu<input type="color" data-ycg-thumb="accent" value="${esc(thumb.accent)}"></label>
        <div class="ycg-variant-row">${["A", "B", "C"].map((variant) => `<button class="${thumb.variant === variant ? "is-active" : ""}" data-ycg-variant="${variant}">Phương án ${variant}</button>`).join("")}</div>
        <label class="ycg-file">Ảnh nền<input type="file" accept="image/jpeg,image/png,image/webp" data-ycg-thumb-image></label>
        <label class="ycg-file">Lấy frame từ video<input type="file" accept="video/*" data-ycg-thumb-video></label>
        <label>Thời điểm frame (giây)<div><input type="number" min="0" step=".1" value="0" data-ycg-frame-time><button data-ycg-action="capture-frame">Lấy frame</button></div></label>
        <div class="ycg-action-row"><button data-ycg-action="download-thumbnail">Tải PNG</button><button data-ycg-action="save-thumbnail">Lưu phương án ${esc(thumb.variant)}</button><button class="is-primary" data-ycg-action="approve-thumbnail" ${thumb.variants.some((item) => item.variant === thumb.variant) ? "" : "disabled"}>Duyệt phương án ${esc(thumb.variant)}</button></div>
        <div class="ycg-variant-status">${["A", "B", "C"].map((variant) => {
          const saved = thumb.variants.find((item) => item.variant === variant);
          return `<span class="${saved?.status === "approved" ? "is-approved" : saved ? "is-saved" : ""}"><i>${saved?.status === "approved" ? "✓" : saved ? "•" : "○"}</i> ${variant} · ${saved?.status === "approved" ? "đã duyệt" : saved ? "đã lưu" : "chưa lưu"}</span>`;
        }).join("")}</div>
        <p>Ba phương án được tạo thật trên canvas. Việc chạy Test & Compare vẫn cần thực hiện trong YouTube Studio.</p>
      </section>
    </div>`;
  }

  function seoScore() {
    const seo = state.seo;
    const keyword = seo.keyword.trim().toLocaleLowerCase("vi");
    const title = seo.title.trim();
    const description = seo.description.trim();
    const tags = seo.tags.split(",").map((item) => item.trim()).filter(Boolean);
    const checks = [
      { label: "Tiêu đề từ 35–70 ký tự", pass: title.length >= 35 && title.length <= 70, value: `${title.length}/100` },
      { label: "Mô tả có ít nhất 120 ký tự", pass: description.length >= 120, value: `${description.length}/5000` },
      { label: "Từ khóa trong tiêu đề", pass: Boolean(keyword && title.toLocaleLowerCase("vi").includes(keyword)), value: keyword || "Chưa nhập" },
      { label: "Từ khóa trong mô tả", pass: Boolean(keyword && description.toLocaleLowerCase("vi").includes(keyword)), value: keyword || "Chưa nhập" },
      { label: "Có 3–15 tag riêng biệt", pass: tags.length >= 3 && tags.length <= 15, value: `${tags.length} tag` },
      { label: "Có chapter hợp lệ", pass: /(?:^|\n)0{1,2}:00\s+\S+/m.test(description), value: /(?:^|\n)0{1,2}:00\s+\S+/m.test(description) ? "Đã tìm thấy" : "Chưa có" },
      { label: "Không có liên kết HTTP không mã hóa", pass: !/http:\/\//i.test(description), value: /http:\/\//i.test(description) ? "Cần đổi HTTPS" : "An toàn" }
    ];
    const score = Math.round(checks.filter((item) => item.pass).length / checks.length * 100);
    return { checks, score, tags };
  }

  function seoView() {
    const result = seoScore();
    const seo = state.seo;
    const videos = dashboard?.videos || [];
    return `<div class="ycg-seo-grid">
      <section class="ycg-panel ycg-seo-editor">
        <header><div><small>INTERNAL QUALITY ANALYSIS</small><h3>Metadata & SEO Observatory</h3></div><span>Không phải điểm của YouTube</span></header>
        <label>Video trên kênh<select data-ycg-seo="videoId"><option value="">Bản nháp cục bộ</option>${videos.map((item) => `<option value="${esc(item.id)}" ${seo.videoId === item.id ? "selected" : ""}>${esc(item.title)}</option>`).join("")}</select></label>
        <label>Từ khóa chính<input data-ycg-seo="keyword" value="${esc(seo.keyword)}" placeholder="Ví dụ: dựng video trên web"></label>
        <label>Tiêu đề<input data-ycg-seo="title" maxlength="100" value="${esc(seo.title)}"></label>
        <label>Mô tả<textarea rows="12" data-ycg-seo="description" maxlength="5000">${esc(seo.description)}</textarea></label>
        <label>Tags<textarea rows="3" data-ycg-seo="tags" maxlength="480">${esc(seo.tags)}</textarea></label>
        <div class="ycg-action-row"><button data-ycg-action="seo-version">Lưu phiên bản</button><button data-ycg-action="seo-chapters">Tạo chapter từ marker</button><button class="is-primary" data-ycg-action="seo-sync" ${seo.videoId && channelStatus.connected ? "" : "disabled"}>Đồng bộ lên YouTube</button></div>
      </section>
      <aside class="ycg-panel ycg-seo-score">
        <div class="ycg-score" style="--score:${result.score}"><strong>${result.score}</strong><span>HH QUALITY</span></div>
        ${result.checks.map((item) => `<p class="${item.pass ? "is-pass" : ""}"><i>${item.pass ? "✓" : "!"}</i><span><strong>${esc(item.label)}</strong><small>${esc(item.value)}</small></span></p>`).join("")}
        <section><h4>${seo.versions.length} phiên bản gần nhất</h4>${seo.versions.slice(0, 5).map((item) => `<button data-ycg-seo-restore="${esc(item.id)}"><span>${esc(item.title || "Không tên")}</span><small>${dateTime(item.createdAt)}</small></button>`).join("") || "<p>Chưa lưu phiên bản metadata.</p>"}</section>
      </aside>
    </div>`;
  }

  function updateSeoScoreUi() {
    const panel = root?.querySelector(".ycg-seo-score");
    if (!panel) return;
    const result = seoScore();
    const gauge = panel.querySelector(".ycg-score");
    if (gauge) {
      gauge.style.setProperty("--score", result.score);
      const value = gauge.querySelector("strong");
      if (value) value.textContent = String(result.score);
    }
    panel.querySelectorAll(":scope > p").forEach((row, index) => {
      const check = result.checks[index];
      if (!check) return;
      row.classList.toggle("is-pass", check.pass);
      const icon = row.querySelector("i");
      const detail = row.querySelector("small");
      if (icon) icon.textContent = check.pass ? "✓" : "!";
      if (detail) detail.textContent = check.value;
    });
  }

  function shortsView() {
    const project = readVideoProject();
    return `<div class="ycg-shorts-grid">
      <section class="ycg-panel">
        <header><div><small>9:16 · 15–180 GIÂY</small><h3>Shorts Factory</h3></div><span>${project ? esc(project.name) : "Chưa có project"}</span></header>
        <label>Hook mở đầu<input data-ycg-shorts="hook" value="${esc(state.shorts.hook)}" placeholder="Câu đầu tiên giữ người xem"></label>
        <label>Thời lượng mục tiêu<input type="range" min="15" max="180" step="5" data-ycg-shorts="duration" value="${Number(state.shorts.duration)}"><span>${Number(state.shorts.duration)} giây</span></label>
        <div class="ycg-toggle-grid">
          ${[["caption", "Caption động"], ["progress", "Thanh tiến trình"], ["safeZone", "Safe zone giao diện"]].map(([key, label]) => `<label><input type="checkbox" data-ycg-shorts="${key}" ${state.shorts[key] ? "checked" : ""}><span>${label}</span></label>`).join("")}
        </div>
        <div class="ycg-action-row"><button data-ycg-action="short-plan">Tạo kế hoạch từ timeline</button><button class="is-primary" data-ycg-action="open-editor">Mở timeline 9:16</button></div>
        <p>Factory lưu kế hoạch và marker thật; chỉ render sau khi người dùng duyệt trong Video Studio.</p>
      </section>
      <section class="ycg-panel"><header><div><small>BATCH PLAN</small><h3>Các Short đã đề xuất</h3></div></header>
        <div class="ycg-plan-list">${state.shorts.plans.length ? state.shorts.plans.map((plan) => `<article><i>SH</i><div><strong>${esc(plan.hook || "Short không tên")}</strong><small>${Number.isFinite(plan.startRatio) ? `${Math.round(plan.startRatio * 100)}% → ${Math.round(plan.endRatio * 100)}% video · cần timeline quy đổi` : `${plan.start}s → ${plan.end}s`} · ${plan.status}</small></div><button data-ycg-plan-remove="${plan.id}">×</button></article>`).join("") : "<p>Chưa có đề xuất. Cần project có clip, marker hoặc retention thật.</p>"}</div>
      </section>
    </div>`;
  }

  function parseCaptions(text) {
    const normalized = String(text || "").replace(/^\uFEFF/, "").replace(/\r/g, "").replace(/^WEBVTT[^\n]*\n+/i, "");
    return normalized.split(/\n{2,}/).map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const timingIndex = lines.findIndex((line) => line.includes("-->"));
      if (timingIndex < 0) return null;
      const timing = lines[timingIndex];
      const caption = lines.slice(timingIndex + 1).join(" ").replace(/<[^>]+>/g, "").trim();
      return caption ? { timing, caption, chars: caption.length } : null;
    }).filter(Boolean);
  }

  function captionsView() {
    const rows = parseCaptions(state.captions.content);
    const videos = dashboard?.videos || [];
    const tooLong = rows.filter((item) => item.chars > 84).length;
    return `<div class="ycg-caption-grid">
      <section class="ycg-panel">
        <header><div><small>SRT · WEBVTT</small><h3>Captions & Language Studio</h3></div><span>${rows.length} câu · ${tooLong} câu dài</span></header>
        <div class="ycg-inline-fields">
          <label>Video<select data-ycg-caption="videoId"><option value="">Chưa chọn</option>${videos.map((item) => `<option value="${esc(item.id)}" ${state.captions.videoId === item.id ? "selected" : ""}>${esc(item.title)}</option>`).join("")}</select></label>
          <label>Ngôn ngữ<input data-ycg-caption="language" value="${esc(state.captions.language)}" maxlength="12"></label>
          <label>Tên track<input data-ycg-caption="name" value="${esc(state.captions.name)}" maxlength="120"></label>
          <label>Định dạng<select data-ycg-caption="format"><option value="srt" ${state.captions.format === "srt" ? "selected" : ""}>SRT</option><option value="vtt" ${state.captions.format === "vtt" ? "selected" : ""}>VTT</option></select></label>
        </div>
        <label>Subtitle<textarea rows="18" data-ycg-caption="content" placeholder="1&#10;00:00:00,000 --> 00:00:03,000&#10;Nội dung phụ đề">${esc(state.captions.content)}</textarea></label>
        <div class="ycg-caption-gate"><span class="is-${esc(state.captions.status)}">${state.captions.status === "approved" ? "✓ Đã duyệt nội dung" : "Bản nháp · chưa được phép tải"}</span><button data-ycg-action="approve-caption" ${rows.length ? "" : "disabled"}>${state.captions.status === "approved" ? "Chuyển về bản nháp" : "Duyệt caption"}</button></div>
        <div class="ycg-action-row"><label class="ycg-file">Nhập SRT/VTT<input type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" data-ycg-caption-file></label><button data-ycg-action="download-caption">Xuất file</button><button data-ycg-action="load-caption-tracks" ${state.captions.videoId && channelStatus.connected ? "" : "disabled"}>Đồng bộ tracks</button><button class="is-primary" data-ycg-action="upload-caption" ${channelStatus.connected && state.captions.videoId && rows.length && state.captions.status === "approved" ? "" : "disabled"}>Tải track đã duyệt</button></div>
      </section>
      <aside class="ycg-panel ycg-caption-preview"><header><div><small>VALIDATION</small><h3>Kiểm tra từng câu</h3></div></header>
        <div class="ycg-track-list">${captionTracks.length ? captionTracks.map((item) => `<p><i class="${item.status === "serving" ? "is-ready" : ""}"></i><span><strong>${esc(item.name || item.language)}</strong><small>${esc(item.language)} · ${esc(item.status || "không rõ")} · ${item.isDraft ? "draft" : "published"}</small></span></p>`).join("") : "<p>Chưa tải danh sách track của video.</p>"}</div>
        ${rows.length ? rows.slice(0, 80).map((item, index) => `<article class="${item.chars > 84 ? "is-warning" : ""}"><b>${index + 1}</b><div><span>${esc(item.timing)}</span><p>${esc(item.caption)}</p></div><small>${item.chars} ký tự</small></article>`).join("") : "<p>Chưa có caption hợp lệ để kiểm tra.</p>"}
      </aside>
    </div>`;
  }

  function analyticsView() {
    if (!channelStatus.connected) return emptyState("Analytics chưa hoạt động", "Kết nối kênh và cấp quyền yt-analytics.readonly để tải số liệu thật.", "connect", "Kết nối kênh");
    if (!dashboard?.analytics) return emptyState("YouTube chưa trả dữ liệu Analytics", "Kết nối lại nếu scope Analytics còn thiếu; không có biểu đồ mẫu được hiển thị.", "refresh", "Thử lại");
    const analytics = dashboard.analytics;
    const rows = analytics.rows || [];
    const maxViews = Math.max(1, ...rows.map((row) => Number(row.views || 0)));
    const totals = analytics.totals || {};
    const videos = dashboard.videos || [];
    const retention = retentionData?.retention;
    const points = retention?.points || [];
    const maxRetention = Math.max(1, ...points.map((item) => Number(item.audienceWatchRatio || 0)));
    const comparison = comparisonData?.rows || [];
    return `<div class="ycg-analytics-grid">
      <section class="ycg-panel">
        <header><div><small>${esc(analytics.startDate)} → ${esc(analytics.endDate)}</small><h3>Analytics Observatory</h3></div><span>YouTube Analytics API</span></header>
        <div class="ycg-metric-grid">
          <article><span>Views</span><strong>${fmt(totals.views)}</strong></article>
          <article><span>Watch time</span><strong>${fmt(Math.round((totals.estimatedMinutesWatched || 0) / 60))} giờ</strong></article>
          <article><span>Subscriber gained</span><strong>${fmt(totals.subscribersGained)}</strong></article>
          <article><span>Subscriber lost</span><strong>${fmt(totals.subscribersLost)}</strong></article>
        </div>
        <div class="ycg-chart" aria-label="Lượt xem theo ngày">${rows.map((row) => `<i style="--bar:${Math.max(3, Number(row.views || 0) / maxViews * 100)}%" title="${esc(row.day)} · ${fmt(row.views)} views"></i>`).join("")}</div>
      </section>
      <section class="ycg-panel ycg-retention-panel"><header><div><small>RETENTION · TỐI ĐA 100 ĐIỂM</small><h3>Giữ chân theo timestamp</h3></div><span>${retentionData ? dateTime(retentionData.syncedAt) : "Chưa tải"}</span></header>
        <div class="ycg-retention-picker"><select data-ycg-retention-video><option value="">Chọn video</option>${videos.map((video) => `<option value="${esc(video.id)}" ${retentionData?.videoId === video.id ? "selected" : ""}>${esc(video.title)}</option>`).join("")}</select><button data-ycg-action="load-retention">Tải retention thật</button></div>
        ${points.length ? `<div class="ycg-retention-chart" aria-label="Audience retention">${points.map((point) => `<i style="--retention:${Math.max(2, Number(point.audienceWatchRatio || 0) / maxRetention * 100)}%" title="${Math.round(Number(point.ratio || 0) * 100)}% video · ${(Number(point.audienceWatchRatio || 0) * 100).toFixed(1)}% audience"></i>`).join("")}</div>
          <div class="ycg-retention-insight"><strong>Đỉnh giữ chân thật</strong><span>Dùng điểm cao nhất để tạo bản nháp Short; hệ thống không tự render hoặc đăng.</span><button data-ycg-action="short-from-retention">Tạo Short từ đỉnh</button></div>` : "<p>Chọn video để tải đường retention từ YouTube Analytics. Nếu kênh chưa đủ dữ liệu, bảng sẽ để trống.</p>"}
      </section>
      <section class="ycg-panel"><header><div><small>10 VIDEO · 90 NGÀY</small><h3>So sánh dữ liệu kênh</h3></div><button data-ycg-action="load-comparison">Đồng bộ</button></header>
        <div class="ycg-video-list">${comparison.length ? comparison.map((row) => {
          const video = videos.find((item) => item.id === row.video);
          return `<article>${video?.thumbnail ? `<img src="${esc(video.thumbnail)}" alt="">` : "<span>YT</span>"}<div><strong>${esc(video?.title || row.video)}</strong><small>${fmt(Math.round((row.estimatedMinutesWatched || 0) / 60))} giờ · +${fmt(row.subscribersGained)} / -${fmt(row.subscribersLost)}</small></div><b>${fmt(row.views)} view</b><button data-ycg-load-seo="${esc(row.video)}">Metadata</button></article>`;
        }).join("") : videos.map((video) => `<article>${video.thumbnail ? `<img src="${esc(video.thumbnail)}" alt="">` : "<span>YT</span>"}<div><strong>${esc(video.title)}</strong><small>${fmt(video.likes)} thích · ${fmt(video.comments)} bình luận</small></div><b>${fmt(video.views)} view</b><button data-ycg-load-seo="${esc(video.id)}">Metadata</button></article>`).join("") || "<p>Chưa có video.</p>"}</div>
      </section>
    </div>`;
  }

  function commentCategory(text) {
    const value = String(text || "").toLocaleLowerCase("vi");
    if (/[?？]|làm sao|tại sao|bao giờ/.test(value)) return "Câu hỏi";
    if (/lỗi|không chạy|không được|bug|error/.test(value)) return "Lỗi";
    if (/gợi ý|ý tưởng|nên làm|mong/.test(value)) return "Ý tưởng";
    if (/http|telegram|kiếm tiền|sub chéo/.test(value)) return "Cần kiểm tra";
    return "Góp ý";
  }

  function commentsView() {
    if (!channelStatus.connected) return emptyState("Community chưa kết nối", "Kết nối kênh để đọc và phản hồi bình luận thật.", "connect", "Kết nối kênh");
    const comments = dashboard?.comments || [];
    return `<section class="ycg-panel ycg-comments">
      <header><div><small>RECENT COMMUNITY</small><h3>Comment & Community Center</h3></div><button data-ycg-action="refresh-comments">Tải lại</button></header>
      <div class="ycg-comment-toolbar"><input type="search" data-ycg-comment-search placeholder="Tìm tên hoặc nội dung…"><select data-ycg-comment-filter><option value="all">Tất cả</option><option value="unanswered">Chưa phản hồi</option><option value="answered">Đã có phản hồi</option></select></div>
      <div class="ycg-comment-list" data-ycg-comment-list>${comments.length ? comments.map((comment) => `<article class="${state.commentStates[comment.id] === "read" ? "is-read" : ""}" data-ycg-comment-row data-search="${esc(`${comment.author} ${comment.text}`.toLowerCase())}" data-replies="${comment.replyCount}">
        ${comment.avatar ? `<img src="${esc(comment.avatar)}" alt="">` : "<span>YT</span>"}
        <div><header><strong>${esc(comment.author || "Người xem")}</strong><time>${dateTime(comment.publishedAt)}</time><em>${esc(commentCategory(comment.text))}</em></header><p>${esc(comment.text)}</p><small>${fmt(comment.likeCount)} thích · ${fmt(comment.replyCount)} phản hồi</small>
          <form data-ycg-reply-form="${esc(comment.id)}"><input name="reply" maxlength="10000" placeholder="Soạn phản hồi để duyệt…"><button>Lưu bản nháp</button></form>
        </div>
        <aside><button data-ycg-mark-read="${esc(comment.id)}">${state.commentStates[comment.id] === "read" ? "Đã đọc" : "Đánh dấu đọc"}</button><button data-ycg-moderate="${esc(comment.id)}" data-status="heldForReview">Giữ duyệt</button><button data-ycg-moderate="${esc(comment.id)}" data-status="rejected">Ẩn</button></aside>
      </article>`).join("") : "<p>Không có bình luận gần đây hoặc API chưa cấp dữ liệu.</p>"}</div>
      <section class="ycg-comment-drafts"><header><div><small>APPROVAL GATE</small><h4>Bản nháp chờ duyệt</h4></div><span>${commentDrafts.filter((item) => item.status === "draft").length} chờ gửi</span></header>${commentDrafts.filter((item) => item.status === "draft").map((item) => `<article><div><strong>${esc(item.text)}</strong><small>${dateTime(item.createdAt)} · chưa gửi ra ngoài</small></div><button data-ycg-send-draft="${esc(item.id)}">Duyệt & gửi</button></article>`).join("") || "<p>Chưa có bản nháp. AI hoặc người dùng chỉ được soạn; gửi luôn cần xác nhận.</p>"}</section>
    </section>`;
  }

  function liveView() {
    if (!channelStatus.connected) return emptyState("Live Control chưa kết nối", "Kết nối kênh có quyền YouTube để tạo broadcast và stream thật.", "connect", "Kết nối kênh");
    const live = dashboard?.live || [];
    const minDate = new Date(Date.now() + 2 * 60 * 1000);
    minDate.setMinutes(minDate.getMinutes() - minDate.getTimezoneOffset());
    return `<div class="ycg-live-grid">
      <section class="ycg-panel">
        <header><div><small>CREATE REAL BROADCAST</small><h3>YouTube Live Mission Control</h3></div><span>testing → live → complete</span></header>
        <form data-ycg-live-form>
          <label>Tên livestream<input name="title" maxlength="100" required></label>
          <label>Mô tả<textarea name="description" rows="5" maxlength="5000"></textarea></label>
          <div class="ycg-inline-fields"><label>Bắt đầu<input name="scheduledStartTime" type="datetime-local" min="${minDate.toISOString().slice(0, 16)}" required></label><label>Quyền riêng tư<select name="privacyStatus"><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></label><label>Độ phân giải<select name="resolution"><option>1080p</option><option>720p</option><option>480p</option></select></label><label>FPS<select name="frameRate"><option>30fps</option><option>60fps</option></select></label></div>
          <label class="ycg-confirm"><input type="checkbox" name="confirm" required><span>Tôi xác nhận tạo sự kiện và stream thật trên kênh đang kết nối.</span></label>
          <button class="is-primary" ${busy ? "disabled" : ""}>Tạo livestream</button>
        </form>
        <div class="ycg-stream-secret" data-ycg-stream-secret hidden></div>
      </section>
      <section class="ycg-panel"><header><div><small>BROADCASTS</small><h3>Sự kiện trên YouTube</h3></div><button data-ycg-action="refresh-live">Làm mới</button></header>
        <div class="ycg-live-list">${live.length ? live.map((item) => `<article><i class="is-${esc(item.lifeCycleStatus)}"></i><div><strong>${esc(item.title)}</strong><small>${dateTime(item.scheduledStartTime)} · ${esc(item.lifeCycleStatus)}</small></div><a href="https://youtube.com/watch?v=${esc(item.id)}" target="_blank" rel="noopener">Mở ↗</a>${["ready", "testStarting", "testing"].includes(item.lifeCycleStatus) ? `<button data-ycg-live-transition="${esc(item.id)}" data-status="${item.lifeCycleStatus === "testing" ? "live" : "testing"}">${item.lifeCycleStatus === "testing" ? "Phát trực tiếp" : "Kiểm thử"}</button>` : ""}${item.lifeCycleStatus === "live" ? `<button data-ycg-live-transition="${esc(item.id)}" data-status="complete">Kết thúc</button>` : ""}</article>`).join("") : "<p>Chưa có livestream được API trả về.</p>"}</div>
      </section>
    </div>`;
  }

  function calendarView() {
    const sorted = state.calendar.slice().sort((a, b) => new Date(a.at) - new Date(b.at));
    const automation = automationReadiness();
    return `<div class="ycg-calendar-grid">
      <section class="ycg-panel"><header><div><small>CONTENT PIPELINE</small><h3>Content Calendar & Automation</h3></div><span>Theo kênh · local-first</span></header>
        <form data-ycg-calendar-form><label>Nội dung<input name="title" required maxlength="160" placeholder="Tên video, Short hoặc livestream"></label><label>Loại<select name="type"><option>Video</option><option>Short</option><option>Livestream</option><option>Community</option></select></label><label>Giai đoạn<select name="stage">${["Ý tưởng", "Kịch bản", "Quay", "Dựng", "Duyệt", "Lên lịch"].map((item) => `<option>${item}</option>`).join("")}</select></label><label>Deadline<input type="datetime-local" name="at" required></label><button class="is-primary">Thêm vào lịch</button></form>
        <p class="ycg-honesty">Calendar chỉ tạo kế hoạch. Video chỉ được đăng khi Upload Center hoàn tất, toàn bộ gate đạt và người dùng xác nhận.</p>
      </section>
      <section class="ycg-panel"><header><div><small>${sorted.length} MISSION</small><h3>Lịch nội dung</h3></div></header><div class="ycg-calendar-list">${sorted.length ? sorted.map((item) => `<article><time>${dateTime(item.at)}</time><i style="--event:${MODULES[(item.type || "").length % MODULES.length].color}"></i><div><strong>${esc(item.title)}</strong><small>${esc(item.type)} · ${esc(item.stage)}</small></div><button data-ycg-calendar-remove="${item.id}">×</button></article>`).join("") : "<p>Chưa có deadline. Không tạo sự kiện mẫu.</p>"}</div></section>
      <section class="ycg-panel ycg-automation-panel"><header><div><small>COSMIC AUTOMATION</small><h3>Workflow có approval gate</h3></div><span>${automation.ready ? "Sẵn sàng" : "Đang chặn an toàn"}</span></header>
        <div class="ycg-automation-flow">${automation.gates.map((gate, index) => `<article class="${gate.pass ? "is-ready" : ""}"><i>${gate.pass ? "✓" : index + 1}</i><span><strong>${esc(gate.label)}</strong><small>${gate.pass ? "Đạt từ dữ liệu thật" : "Chưa đạt"}</small></span></article>`).join("")}</div>
        <div class="ycg-toggle-grid"><label><input type="checkbox" data-ycg-automation="enabled" ${state.automation.enabled ? "checked" : ""}><span>Bật automation cho project này</span></label><label><input type="checkbox" data-ycg-automation="approvalGate" ${state.automation.approvalGate ? "checked" : ""}><span>Luôn yêu cầu duyệt trước Public</span></label></div>
        <div class="ycg-action-row"><button data-ycg-action="preview-automation">Xem trước hành động</button><button class="is-primary" data-ycg-action="sync-project">Lưu workflow</button></div>
        <p>Idempotency key: <code>${esc(state.automation.idempotencyKey || "được tạo khi lưu")}</code>. Automation không xóa video, trả lời hàng loạt hoặc tự chuyển Public.</p>
      </section>
    </div>`;
  }

  function preflightResults() {
    const project = readVideoProject();
    const clips = project?.clips || [];
    const titles = project?.titles || [];
    const checks = [
      { id: "project", label: "Project dựng video tồn tại", pass: Boolean(project) },
      { id: "clips", label: "Timeline có ít nhất một clip", pass: clips.length > 0 },
      { id: "rights", label: "Đã xác nhận quyền asset", pass: Boolean(state.preflight.rightsConfirmed) },
      { id: "privacy", label: "Đã kiểm tra dữ liệu riêng tư", pass: Boolean(state.preflight.privacyChecked) },
      { id: "captions", label: "Caption đã được kiểm tra hoặc không bắt buộc", pass: Boolean(state.preflight.captionsChecked || titles.some((item) => item.kind === "subtitle")) },
      { id: "metadata", label: "Tiêu đề metadata hợp lệ", pass: state.seo.title.trim().length > 0 },
      { id: "codec", label: "Thiết bị có bộ xuất video", pass: Boolean(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream) }
    ];
    return { project, checks, ready: checks.every((item) => item.pass) };
  }

  function preflightView() {
    const result = preflightResults();
    return `<div class="ycg-preflight-grid">
      <section class="ycg-panel"><header><div><small>LOCAL PUBLISH SCANNER</small><h3>Copyright & Publish Preflight</h3></div><span class="${result.ready ? "is-ready" : ""}">${result.ready ? "Sẵn sàng" : "Cần xử lý"}</span></header>
        <div class="ycg-check-list">${result.checks.map((item) => `<p class="${item.pass ? "is-pass" : ""}"><i>${item.pass ? "✓" : "!"}</i><span><strong>${esc(item.label)}</strong><small>${item.pass ? "Đạt" : "Chưa đạt"}</small></span></p>`).join("")}</div>
        <div class="ycg-toggle-grid">
          <label><input type="checkbox" data-ycg-preflight="rightsConfirmed" ${state.preflight.rightsConfirmed ? "checked" : ""}><span>Tôi có quyền dùng video, ảnh, nhạc và font</span></label>
          <label><input type="checkbox" data-ycg-preflight="privacyChecked" ${state.preflight.privacyChecked ? "checked" : ""}><span>Đã kiểm tra dữ liệu cá nhân trong nội dung</span></label>
          <label><input type="checkbox" data-ycg-preflight="captionsChecked" ${state.preflight.captionsChecked ? "checked" : ""}><span>Đã kiểm tra phụ đề và ngôn ngữ</span></label>
        </div>
        <div class="ycg-action-row"><button data-ycg-action="run-preflight">Quét lại</button><button class="is-primary" data-ycg-action="open-upload" ${result.ready ? "" : "disabled"}>Tiếp tục xuất bản</button></div>
      </section>
      <aside class="ycg-panel"><header><div><small>RIGHTS MANIFEST</small><h3>Phạm vi kiểm tra</h3></div></header><p>Scanner kiểm tra project, metadata, caption, codec và các xác nhận quyền do người dùng cung cấp.</p><p>Scanner không thay thế Content ID hoặc quyết định bản quyền của YouTube.</p><p>Asset thiếu trường nguồn/license sẽ được cảnh báo khi Media Pool cung cấp metadata tương ứng.</p></aside>
    </div>`;
  }

  function activeViewMarkup() {
    const views = {
      command: commandView,
      connect: connectView,
      fleet: fleetView,
      director: directorView,
      upload: uploadView,
      thumbnail: thumbnailView,
      seo: seoView,
      shorts: shortsView,
      captions: captionsView,
      analytics: analyticsView,
      comments: commentsView,
      live: liveView,
      calendar: calendarView,
      preflight: preflightView
    };
    return (views[state.active] || commandView)();
  }

  function render() {
    if (!root) return;
    publisherMounted = false;
    root.innerHTML = `<section class="ycg-shell" data-ycg-active="${esc(state.active)}">
      ${shellHeader()}
      ${orbitMarkup()}
      <div class="ycg-layout">
        ${navigationMarkup()}
        <main class="ycg-workspace">
          ${errorMessage ? `<div class="ycg-alert"><strong>Không hoàn thành được yêu cầu</strong><span>${esc(errorMessage)}</span><button data-ycg-action="dismiss-error">×</button></div>` : ""}
          ${activeViewMarkup()}
        </main>
      </div>
      <footer class="ycg-footer"><span data-ycg-status role="status" aria-live="polite">${busy ? "Đang xử lý yêu cầu thật…" : navigator.onLine ? "Online · bản nháp được lưu trên thiết bị" : "Offline · chỉ chức năng local-first hoạt động"}</span><span>Hiệu ứng chỉ phản ánh dữ liệu và sự kiện đã xác minh.</span></footer>
    </section>`;
    afterRender();
  }

  function status(message, kind = "info") {
    const node = root?.querySelector("[data-ycg-status]");
    if (!node) return;
    node.textContent = message;
    node.dataset.state = kind;
  }

  function afterRender() {
    if (state.active === "upload") {
      const host = root.querySelector("[data-ycg-publisher]");
      if (host && window.HHYouTubePublisher?.mount) {
        publisherMounted = true;
        window.HHYouTubePublisher.mount(host, {
          apiBase: apiBase(),
          pack: {
            title: state.publishProject?.metadata?.title || state.seo.title,
            description: state.publishProject?.metadata?.description || state.seo.description,
            tags: Array.isArray(state.publishProject?.metadata?.tags)
              ? state.publishProject.metadata.tags.join(",")
              : state.seo.tags
          }
        });
      }
    }
    if (state.active === "thumbnail") drawThumbnail();
  }

  function drawThumbnail() {
    const canvas = root?.querySelector("[data-ycg-thumbnail-canvas]");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { variant, accent, title, subtitle } = state.thumbnail;
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    const palettes = {
      A: ["#050817", "#171247", accent],
      B: ["#07141c", "#103947", accent],
      C: ["#160512", "#4b102e", accent]
    };
    const palette = palettes[variant] || palettes.A;
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(.66, palette[1]);
    gradient.addColorStop(1, palette[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (thumbnailImage) {
      const scale = Math.max(canvas.width / thumbnailImage.width, canvas.height / thumbnailImage.height);
      const width = thumbnailImage.width * scale;
      const height = thumbnailImage.height * scale;
      ctx.globalAlpha = .68;
      ctx.drawImage(thumbnailImage, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      ctx.globalAlpha = 1;
      const overlay = ctx.createLinearGradient(0, 0, canvas.width, 0);
      overlay.addColorStop(0, "#02040dea");
      overlay.addColorStop(.65, "#02040d55");
      overlay.addColorStop(1, "#02040d18");
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = variant === "C" ? 45 : 25;
    ctx.fillStyle = accent;
    ctx.fillRect(70, variant === "B" ? 78 : 96, 15, 480);
    ctx.restore();
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${variant === "B" ? 104 : 92}px "Segoe UI", sans-serif`;
    ctx.textBaseline = "top";
    wrapCanvasText(ctx, title || "TIÊU ĐỀ VIDEO", 115, variant === "C" ? 170 : 138, variant === "B" ? 760 : 850, 112, 3);
    ctx.fillStyle = accent;
    ctx.font = '800 34px "Segoe UI", sans-serif';
    ctx.fillText(String(subtitle || "").toUpperCase(), 120, 578);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(1110, 130, 72, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b1020";
    ctx.font = '950 62px "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("H", 1110, 130);
    ctx.textAlign = "left";
    ctx.strokeStyle = "#ffffff65";
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 12]);
    ctx.strokeRect(48, 48, 1184, 624);
    ctx.setLineDash([]);
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
    });
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((value, index) => {
      const last = index === maxLines - 1 && lines.length > maxLines;
      ctx.fillText(last ? `${value.slice(0, Math.max(1, value.length - 1))}…` : value, x, y + index * lineHeight);
    });
  }

  async function thumbnailBlob() {
    const canvas = root?.querySelector("[data-ycg-thumbnail-canvas]");
    if (!canvas) throw new Error("Canvas thumbnail chưa sẵn sàng.");
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Không tạo được file PNG.")), "image/png", .96));
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function saveThumbnailToMediaPool() {
    const blob = await thumbnailBlob();
    const file = new File([blob], `youtube-thumbnail-${Date.now()}.png`, { type: "image/png" });
    const id = uid("asset");
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(MEDIA_DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(MEDIA_STORE)) request.result.createObjectStore(MEDIA_STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(MEDIA_STORE, "readwrite");
      transaction.objectStore(MEDIA_STORE).put({
        id,
        ownerId: currentIdentityId(),
        name: file.name,
        type: file.type,
        size: file.size,
        duration: 5,
        waveform: [],
        waveformStatus: "not-applicable",
        source: "youtube-thumbnail-galaxy",
        createdAt: new Date().toISOString(),
        file
      });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
    state.thumbnail.variants = [
      { id, assetId: id, variant: state.thumbnail.variant, status: "draft", createdAt: new Date().toISOString() },
      ...state.thumbnail.variants.filter((item) => item.variant !== state.thumbnail.variant)
    ].slice(0, 3);
    saveState();
    window.dispatchEvent(new CustomEvent("hh:media-asset-created", { detail: { id, name: file.name, source: "youtube-thumbnail" } }));
    render();
    status(`Đã lưu ${file.name} vào Media Pool.`, "success");
  }

  function makeShortPlan() {
    const project = readVideoProject();
    if (!project?.clips?.length) throw new Error("Timeline chưa có clip thật để tạo kế hoạch Short.");
    const duration = Math.max(15, Math.min(180, Number(state.shorts.duration) || 45));
    const projectEnd = project.clips.reduce((max, clip) => Math.max(max, Number(clip.start || 0) + Math.max(0, (Number(clip.out || 0) - Number(clip.in || 0)) / Math.max(.1, Number(clip.speed || 1)))), 0);
    const markers = (project.markers || []).map((item) => Number(item.time)).filter((item) => Number.isFinite(item) && item < projectEnd);
    const start = markers[0] || 0;
    const plan = {
      id: uid("short"),
      hook: state.shorts.hook.trim() || project.name || "Short từ timeline",
      start: Number(start.toFixed(2)),
      end: Number(Math.min(projectEnd, start + duration).toFixed(2)),
      status: "draft",
      sourceProject: project.name || "",
      createdAt: new Date().toISOString()
    };
    if (plan.end <= plan.start) throw new Error("Project ngắn hơn đoạn Short yêu cầu.");
    state.shorts.plans.unshift(plan);
    state.shorts.plans = state.shorts.plans.slice(0, 20);
    saveState();
    render();
    status("Đã tạo kế hoạch Short từ timeline và marker thật.", "success");
  }

  function createChapters() {
    const project = readVideoProject();
    const markers = (project?.markers || []).slice().sort((a, b) => Number(a.time) - Number(b.time));
    if (!markers.length) throw new Error("Timeline chưa có marker để tạo chapter.");
    const line = (seconds) => {
      const value = Math.max(0, Math.floor(Number(seconds) || 0));
      return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
    };
    const chapters = markers.map((marker, index) => `${line(marker.time)} ${marker.name || `Chapter ${index + 1}`}`).join("\n");
    state.seo.description = `${state.seo.description.trim()}\n\n${chapters}`.trim().slice(0, 5000);
    saveState();
    render();
    status(`Đã tạo ${markers.length} chapter từ marker timeline.`, "success");
  }

  function universalProjectPayload() {
    const source = readVideoProject();
    const existing = state.publishProject || dashboard?.project || {};
    const thumbnailVariants = state.thumbnail.variants || [];
    return {
      ...existing,
      title: source?.name || existing.title || state.seo.title || "YouTube Publish Project",
      sourceProjectId: source?.id || existing.sourceProjectId || "",
      sourceAssetId: existing.sourceAssetId || "",
      videoId: state.seo.videoId || existing.videoId || "",
      renderStatus: source?.exportJobs?.some?.((item) => item.status === "completed") ? "completed" : existing.renderStatus || "idle",
      metadata: {
        title: state.seo.title,
        description: state.seo.description,
        tags: state.seo.tags,
        privacyStatus: existing.metadata?.privacyStatus || "private",
        publishAt: existing.metadata?.publishAt || null,
        playlistId: existing.metadata?.playlistId || ""
      },
      thumbnails: thumbnailVariants,
      captions: [{
        language: state.captions.language,
        name: state.captions.name,
        status: state.captions.status,
        captionId: captionTracks.find((item) => item.language === state.captions.language)?.id || ""
      }],
      rightsManifest: {
        confirmed: Boolean(state.preflight.rightsConfirmed),
        assetCount: Number(source?.assets?.length || source?.clips?.length || 0),
        missingLicenseCount: Number(source?.assets?.filter?.((item) => !item.license)?.length || 0)
      },
      approvals: {
        metadata: Boolean(state.seo.title.trim()),
        thumbnail: thumbnailVariants.some((item) => item.status === "approved"),
        captions: state.captions.status === "approved" || state.preflight.captionsChecked,
        publish: Boolean(state.preflight.privacyChecked && state.preflight.rightsConfirmed)
      },
      automation: {
        ...state.automation,
        stage: existing.automation?.stage || "draft",
        idempotencyKey: state.automation.idempotencyKey || uid("publish")
      }
    };
  }

  async function syncUniversalProject() {
    const payload = universalProjectPayload();
    state.publishProject = payload;
    state.automation.idempotencyKey = payload.automation.idempotencyKey;
    saveState();
    if (!channelStatus.connected) {
      render();
      status("Đã lưu Universal Project trên thiết bị; sẽ đồng bộ sau khi kết nối kênh.", "success");
      return payload;
    }
    const result = await apiAction("project", { project: payload }, "Đã đồng bộ Universal Publish Project theo kênh.", "PUT");
    if (result?.project) {
      state.publishProject = result.project;
      saveState();
      dashboard = { ...(dashboard || {}), project: result.project };
      render();
    }
    return result?.project || null;
  }

  function automationReadiness() {
    const project = universalProjectPayload();
    const gates = [
      { label: "Render đã hoàn tất", pass: project.renderStatus === "completed" },
      { label: "Rights Manifest hợp lệ", pass: project.rightsManifest.confirmed && project.rightsManifest.missingLicenseCount === 0 },
      { label: "Caption đã duyệt", pass: project.approvals.captions },
      { label: "Thumbnail đã chọn", pass: project.approvals.thumbnail },
      { label: "Metadata đã duyệt", pass: project.approvals.metadata },
      { label: "Quyền xuất bản đã cấp", pass: project.approvals.publish }
    ];
    return { project, gates, ready: gates.every((item) => item.pass) };
  }

  async function connectChannel(permissionPreset = "creator") {
    if (channelStatus.authRequired) return location.hash = "#/login";
    busy = "connect";
    render();
    try {
      const data = await api("oauth/start", "POST", { returnTo: location.origin, returnHash: "#/davinci-resolve/youtube", permissionPreset });
      location.assign(data.authorizeUrl);
    } catch (error) {
      busy = "";
      errorMessage = error.message;
      render();
    }
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function updateFleetResult(channelId, patch) {
    const existing = fleetState.results.find((item) => item.channelId === channelId);
    if (existing) Object.assign(existing, patch);
    else fleetState.results.unshift({ channelId, ...patch });
    fleetState.results = fleetState.results.slice(0, 20);
    saveFleetState();
  }

  function putFleetChunk(session, file, start, end) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", session.uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.setRequestHeader("Content-Range", `bytes ${start}-${end - 1}/${file.size}`);
      xhr.onload = () => {
        if (xhr.status === 308) {
          const range = xhr.getResponseHeader("Range") || "";
          const match = range.match(/bytes=0-(\d+)/i);
          resolve({ complete: false, offset: match ? Number(match[1]) + 1 : end });
          return;
        }
        if ([200, 201].includes(xhr.status)) {
          let data = {};
          try { data = JSON.parse(xhr.responseText || "{}"); } catch {}
          resolve({ complete: true, offset: file.size, data });
          return;
        }
        const error = new Error(`YouTube upload HTTP ${xhr.status || 0}`);
        error.status = xhr.status || 0;
        reject(error);
      };
      xhr.onerror = () => reject(Object.assign(new Error("Mất kết nối khi gửi video tới YouTube."), { status: 0 }));
      xhr.onabort = () => reject(Object.assign(new Error("Phiên bulk upload đã bị hủy."), { status: 499 }));
      xhr.send(file.slice(start, end, file.type || "application/octet-stream"));
    });
  }

  async function uploadFleetSession(session, file) {
    const retryable = new Set([0, 408, 429, 500, 502, 503, 504]);
    const chunkSize = Math.max(256 * 1024, Number(session.chunkSize || 8 * 1024 * 1024));
    let offset = 0;
    let finalData = null;
    updateFleetResult(session.channelId, { channelTitle: session.channelTitle, uploadId: session.uploadId, status: "uploading", progress: 0, error: "" });
    while (offset < file.size) {
      const end = Math.min(file.size, offset + chunkSize);
      let response = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          response = await putFleetChunk(session, file, offset, end);
          break;
        } catch (error) {
          if (!retryable.has(Number(error.status || 0)) || attempt === 4) throw error;
          await wait(Math.min(8000, 500 * (2 ** attempt)));
        }
      }
      offset = Math.max(offset, Number(response?.offset || end));
      const progress = Math.min(100, offset / file.size * 100);
      updateFleetResult(session.channelId, { status: response?.complete ? "verifying" : "uploading", progress });
      render();
      await api("upload/progress", "POST", {
        uploadId: session.uploadId,
        bytesUploaded: offset,
        totalBytes: file.size,
        speedBps: 0,
        etaSeconds: 0
      }).catch(() => {});
      if (response?.complete) {
        finalData = response.data;
        break;
      }
    }
    if (!finalData?.id) throw new Error("YouTube không trả về Video ID cho kênh này.");
    const completed = await api("upload/complete", "POST", { uploadId: session.uploadId, videoId: finalData.id });
    updateFleetResult(session.channelId, { status: "processing", progress: 100, videoId: completed.videoId, url: completed.url });
    render();
    return completed;
  }

  async function runFleetPreflight() {
    if (!fleetState.selectedChannelIds.length) throw new Error("Hãy chọn ít nhất một kênh.");
    busy = "bulk/preflight";
    errorMessage = "";
    render();
    try {
      fleetPreflight = await api("bulk/preflight", "POST", { action: "upload", channelIds: fleetState.selectedChannelIds });
      status(fleetPreflight.ready ? "Tất cả kênh đã sẵn sàng cho upload." : "Có kênh thiếu scope upload hoặc refresh token.", fleetPreflight.ready ? "success" : "error");
      return fleetPreflight;
    } finally {
      busy = "";
      render();
    }
  }

  async function startFleetUpload(form) {
    if (!fleetUploadFile) throw new Error("Hãy chọn file video.");
    const data = Object.fromEntries(new FormData(form));
    fleetState = {
      ...fleetState,
      title: String(data.title || "").trim(),
      description: String(data.description || ""),
      tags: String(data.tags || ""),
      privacyStatus: ["private", "unlisted"].includes(data.privacyStatus) ? data.privacyStatus : "private",
      rightsConfirmed: data.rightsConfirmed === "on",
      idempotencyKey: fleetState.idempotencyKey || uid("bulk-upload") + uid("job")
    };
    saveFleetState();
    if (!fleetState.title) throw new Error("Tiêu đề video đang trống.");
    if (!fleetState.rightsConfirmed) throw new Error("Cần xác nhận quyền sử dụng nội dung.");
    const preflight = await runFleetPreflight();
    if (!preflight.ready) throw new Error("Chưa thể tạo job vì có kênh thiếu quyền.");
    if (!confirm(`Tạo ${fleetState.selectedChannelIds.length} upload ${fleetState.privacyStatus.toUpperCase()} thật trên YouTube?`)) return;
    busy = "bulk/upload/sessions";
    render();
    try {
      const result = await api("bulk/upload/sessions", "POST", {
        channelIds: fleetState.selectedChannelIds,
        idempotencyKey: fleetState.idempotencyKey,
        approved: true,
        rightsConfirmed: true,
        title: fleetState.title,
        description: fleetState.description,
        tags: fleetState.tags.split(",").map((item) => item.trim()).filter(Boolean),
        privacyStatus: fleetState.privacyStatus,
        fileName: fleetUploadFile.name,
        fileSize: fleetUploadFile.size,
        mimeType: fleetUploadFile.type || "application/octet-stream",
        madeForKids: false,
        containsSyntheticMedia: false,
        notifySubscribers: false
      });
      (result.failures || []).forEach((item) => updateFleetResult(item.channelId, { channelTitle: item.channelTitle, status: "failed", error: item.error }));
      for (const session of result.sessions || []) {
        try { await uploadFleetSession(session, fleetUploadFile); }
        catch (error) {
          updateFleetResult(session.channelId, { channelTitle: session.channelTitle, status: "failed", error: error.message });
          await api("upload/error", "POST", { uploadId: session.uploadId, error: error.message }).catch(() => {});
          render();
        }
      }
      fleetState.idempotencyKey = "";
      saveFleetState();
      const jobsResult = await api("bulk/jobs").catch(() => ({ jobs: [] }));
      fleetJobs = jobsResult.jobs || [];
      render();
      status("Bulk upload đã gửi xong; YouTube đang xử lý từng video thật.", "success");
    } finally {
      busy = "";
      render();
    }
  }

  async function apiAction(path, body, success, method = "POST") {
    busy = path;
    errorMessage = "";
    render();
    try {
      const result = await api(path, method, body);
      status(success, "success");
      return result;
    } catch (error) {
      errorMessage = error.message;
      return null;
    } finally {
      busy = "";
      if (errorMessage) render();
    }
  }

  function switchModule(moduleId) {
    if (!MODULES.some((item) => item.id === moduleId)) return;
    if (publisherMounted) window.HHYouTubePublisher?.unmount?.();
    state.active = moduleId;
    saveState();
    render();
    if (channelStatus.connected && moduleId === "comments") {
      api("comments/drafts").then((result) => {
        if (state.active !== "comments") return;
        commentDrafts = result.drafts || [];
        render();
      }).catch(() => {});
    }
    if (channelStatus.connected && moduleId === "analytics" && !comparisonData) {
      api("analytics/comparison").then((result) => {
        if (state.active !== "analytics") return;
        comparisonData = result.comparison || null;
        render();
      }).catch(() => {});
    }
    if (channelStatus.connected && moduleId === "fleet" && !fleetOverview) {
      Promise.all([api("channels/overview"), api("bulk/jobs").catch(() => ({ jobs: [] }))]).then(([overview, jobs]) => {
        if (state.active !== "fleet") return;
        fleetOverview = overview;
        fleetJobs = jobs.jobs || [];
        render();
      }).catch(() => {});
    }
  }

  async function handleAction(action) {
    if (action === "refresh") return refresh();
    if (action === "connect") return connectChannel();
    if (["connect-upload", "connect-manage", "connect-analytics", "connect-creator"].includes(action)) return connectChannel(action.replace("connect-", ""));
    if (action === "signin") return location.hash = "#/login";
    if (action === "dismiss-error") { errorMessage = ""; return render(); }
    if (action === "open-upload") return switchModule("upload");
    if (action === "open-calendar") return switchModule("calendar");
    if (action === "open-live") return switchModule("live");
    if (action === "new-video" || action === "open-editor") return location.hash = "#/davinci-resolve/davinci";
    if (action === "new-short") return switchModule("shorts");
    if (action === "open-auto") return location.hash = "#/davinci-resolve/auto";
    if (action === "sync-project") return syncUniversalProject();
    if (action === "fleet-select-all") {
      const channels = fleetOverview?.channels || channelStatus.channels || [];
      const limit = Number(fleetOverview?.limits?.maxChannelsPerBulkJob || channelStatus.bulk?.maxChannelsPerJob || 5);
      fleetState.selectedChannelIds = channels.slice(0, limit).map((channel) => channel.id);
      fleetPreflight = null;
      saveFleetState();
      return render();
    }
    if (action === "fleet-clear") {
      fleetState.selectedChannelIds = [];
      fleetState.results = [];
      fleetState.idempotencyKey = "";
      fleetPreflight = null;
      saveFleetState();
      return render();
    }
    if (action === "fleet-preflight") return runFleetPreflight();
    if (action === "fleet-refresh") {
      const [overview, jobs] = await Promise.all([api("channels/overview"), api("bulk/jobs")]);
      fleetOverview = overview;
      fleetJobs = jobs.jobs || [];
      render();
      return status("Đã làm mới Channel Fleet từ backend.", "success");
    }
    if (action === "preview-automation") {
      const preview = automationReadiness();
      state.automation.lastPreviewAt = new Date().toISOString();
      saveState();
      return status(preview.ready
        ? "Preview đạt: workflow có thể đi tới Upload nhưng vẫn dừng tại approval trước Public."
        : `Workflow đang bị chặn bởi ${preview.gates.filter((item) => !item.pass).length} điều kiện chưa đạt.`, preview.ready ? "success" : "error");
    }
    if (action === "disconnect") {
      if (!confirm("Ngắt và xóa token của kênh YouTube đang chọn?")) return;
      const result = await apiAction("disconnect", {}, "Đã ngắt kết nối kênh.");
      if (result) return refresh();
    }
    if (action === "refresh-channel") {
      const result = await apiAction("channel/refresh", {}, "Đã cập nhật kênh.");
      if (result) return refresh();
    }
    if (action === "capture-frame") {
      if (!thumbnailVideo) throw new Error("Hãy chọn video trước khi lấy frame.");
      const time = Math.max(0, Number(root.querySelector("[data-ycg-frame-time]")?.value || 0));
      thumbnailVideo.currentTime = Math.min(time, Number(thumbnailVideo.duration || time));
      await new Promise((resolve) => {
        const done = () => { thumbnailVideo.removeEventListener("seeked", done); resolve(); };
        thumbnailVideo.addEventListener("seeked", done);
        setTimeout(done, 1500);
      });
      thumbnailImage = thumbnailVideo;
      drawThumbnail();
      return status(`Đã lấy frame tại ${time.toFixed(1)} giây.`, "success");
    }
    if (action === "download-thumbnail") {
      const blob = await thumbnailBlob();
      download(blob, `youtube-thumbnail-${state.thumbnail.variant}.png`);
      return status("Đã tạo file thumbnail PNG thật.", "success");
    }
    if (action === "save-thumbnail") return saveThumbnailToMediaPool();
    if (action === "approve-thumbnail") {
      const selected = state.thumbnail.variants.find((item) => item.variant === state.thumbnail.variant);
      if (!selected) throw new Error("Hãy lưu phương án này vào Media Pool trước khi duyệt.");
      state.thumbnail.variants = state.thumbnail.variants.map((item) => ({
        ...item,
        status: item.variant === state.thumbnail.variant ? "approved" : "draft"
      }));
      saveState();
      render();
      return status(`Đã duyệt thumbnail ${state.thumbnail.variant}; các phương án khác vẫn được giữ để so sánh.`, "success");
    }
    if (action === "seo-version") {
      state.seo.versions.unshift({ id: uid("meta"), title: state.seo.title, description: state.seo.description, tags: state.seo.tags, keyword: state.seo.keyword, createdAt: new Date().toISOString() });
      state.seo.versions = state.seo.versions.slice(0, 10);
      saveState(); render(); return status("Đã lưu phiên bản metadata.", "success");
    }
    if (action === "seo-chapters") return createChapters();
    if (action === "seo-sync") {
      if (!state.seo.videoId) throw new Error("Hãy chọn video cần cập nhật.");
      if (!confirm("Cập nhật metadata thật trên video YouTube đã chọn?")) return;
      const result = await apiAction("videos/update", {
        videoId: state.seo.videoId,
        title: state.seo.title,
        description: state.seo.description,
        tags: state.seo.tags
      }, "YouTube đã xác nhận cập nhật metadata.");
      if (result) { await refresh(); switchModule("seo"); }
      else render();
      return;
    }
    if (action === "short-plan") return makeShortPlan();
    if (action === "download-caption") {
      if (!parseCaptions(state.captions.content).length) throw new Error("Caption chưa có timing hợp lệ.");
      const prefix = state.captions.format === "vtt" && !/^WEBVTT/i.test(state.captions.content) ? "WEBVTT\n\n" : "";
      return download(new Blob([`${prefix}${state.captions.content}`], { type: state.captions.format === "vtt" ? "text/vtt" : "application/x-subrip" }), `captions-${state.captions.language}.${state.captions.format}`);
    }
    if (action === "approve-caption") {
      if (!parseCaptions(state.captions.content).length) throw new Error("Caption chưa có timing hợp lệ.");
      state.captions.status = state.captions.status === "approved" ? "draft" : "approved";
      saveState();
      render();
      return status(state.captions.status === "approved" ? "Caption đã được duyệt để tải lên." : "Caption đã trở lại bản nháp.", "success");
    }
    if (action === "load-caption-tracks") {
      if (!state.captions.videoId) throw new Error("Hãy chọn video.");
      busy = "captions";
      render();
      try {
        const result = await api(`captions?videoId=${encodeURIComponent(state.captions.videoId)}`);
        captionTracks = result.captions || [];
        busy = "";
        render();
        return status(`Đã đồng bộ ${captionTracks.length} caption track.`, "success");
      } finally {
        busy = "";
      }
    }
    if (action === "upload-caption") {
      if (state.captions.status !== "approved") throw new Error("Caption phải được duyệt trước khi tải lên.");
      if (!confirm("Tải track phụ đề này lên video YouTube đã chọn?")) return;
      const result = await apiAction("captions/upload", state.captions, "YouTube đã nhận track phụ đề.");
      if (result) {
        state.captions.status = "uploaded";
        saveState();
        await syncUniversalProject();
      }
      render();
      return result;
    }
    if (action === "load-retention") {
      const videoId = root?.querySelector("[data-ycg-retention-video]")?.value || "";
      if (!videoId) throw new Error("Hãy chọn video cần phân tích retention.");
      busy = "retention";
      render();
      try {
        retentionData = await api(`analytics/retention?videoId=${encodeURIComponent(videoId)}`);
        busy = "";
        render();
        return status(`Đã tải ${retentionData.retention?.points?.length || 0} điểm retention thật.`, "success");
      } finally {
        busy = "";
      }
    }
    if (action === "load-comparison") {
      busy = "comparison";
      render();
      try {
        const result = await api("analytics/comparison");
        comparisonData = result.comparison || null;
        busy = "";
        render();
        return status("Đã đồng bộ 10 video theo dữ liệu Analytics.", "success");
      } finally {
        busy = "";
      }
    }
    if (action === "short-from-retention") {
      const points = retentionData?.retention?.points || [];
      if (!points.length) throw new Error("Chưa có dữ liệu retention.");
      const peak = points.slice().sort((a, b) => b.audienceWatchRatio - a.audienceWatchRatio)[0];
      const video = dashboard?.videos?.find((item) => item.id === retentionData.videoId);
      state.shorts.plans.unshift({
        id: uid("short"),
        hook: `Đỉnh retention · ${video?.title || retentionData.videoId}`,
        startRatio: peak.ratio,
        endRatio: Math.min(1, peak.ratio + .12),
        start: 0,
        end: Number(state.shorts.duration || 45),
        status: "draft-needs-duration",
        sourceVideoId: retentionData.videoId,
        sourceProject: video?.title || "",
        createdAt: new Date().toISOString()
      });
      state.shorts.plans = state.shorts.plans.slice(0, 20);
      saveState();
      switchModule("shorts");
      return status("Đã tạo bản nháp Short từ điểm retention; cần timeline để quy đổi timestamp chính xác.", "success");
    }
    if (action === "refresh-comments" || action === "refresh-live") return refresh();
    if (action === "run-preflight") { render(); return status("Đã quét lại project và trạng thái thiết bị.", "success"); }
  }

  async function handleClick(event) {
    const moduleButton = event.target.closest("[data-ycg-module]");
    if (moduleButton) return switchModule(moduleButton.dataset.ycgModule);
    const actionButton = event.target.closest("[data-ycg-action]");
    if (actionButton) {
      try { await handleAction(actionButton.dataset.ycgAction); }
      catch (error) { errorMessage = error.message; render(); }
      return;
    }
    const variant = event.target.closest("[data-ycg-variant]");
    if (variant) {
      state.thumbnail.variant = variant.dataset.ycgVariant;
      saveState(); render(); return;
    }
    const restore = event.target.closest("[data-ycg-seo-restore]");
    if (restore) {
      const version = state.seo.versions.find((item) => item.id === restore.dataset.ycgSeoRestore);
      if (version) Object.assign(state.seo, { title: version.title, description: version.description, tags: version.tags, keyword: version.keyword });
      saveState(); render(); return;
    }
    const loadSeo = event.target.closest("[data-ycg-load-seo]");
    if (loadSeo) {
      const video = dashboard?.videos?.find((item) => item.id === loadSeo.dataset.ycgLoadSeo);
      if (video) Object.assign(state.seo, { videoId: video.id, title: video.title, description: video.description || "" });
      saveState(); return switchModule("seo");
    }
    const removePlan = event.target.closest("[data-ycg-plan-remove]");
    if (removePlan) {
      state.shorts.plans = state.shorts.plans.filter((item) => item.id !== removePlan.dataset.ycgPlanRemove);
      saveState(); render(); return;
    }
    const removeCalendar = event.target.closest("[data-ycg-calendar-remove]");
    if (removeCalendar) {
      state.calendar = state.calendar.filter((item) => item.id !== removeCalendar.dataset.ycgCalendarRemove);
      saveState(); render(); return;
    }
    const moderate = event.target.closest("[data-ycg-moderate]");
    if (moderate) {
      if (!confirm(`Chuyển bình luận sang trạng thái ${moderate.dataset.status}?`)) return;
      const result = await apiAction("comments/moderate", { id: moderate.dataset.ycgModerate, moderationStatus: moderate.dataset.status }, "YouTube đã xác nhận trạng thái kiểm duyệt.");
      if (result) await refresh();
      return;
    }
    const markRead = event.target.closest("[data-ycg-mark-read]");
    if (markRead) {
      state.commentStates[markRead.dataset.ycgMarkRead] = "read";
      saveState();
      render();
      return status("Đã đánh dấu bình luận trong inbox của thiết bị này.", "success");
    }
    const sendDraft = event.target.closest("[data-ycg-send-draft]");
    if (sendDraft) {
      if (!confirm("Gửi phản hồi đã duyệt ra YouTube ngay bây giờ?")) return;
      const result = await apiAction("comments/drafts/send", {
        draftId: sendDraft.dataset.ycgSendDraft,
        approved: true
      }, "YouTube đã xác nhận phản hồi.");
      if (result) {
        const drafts = await api("comments/drafts");
        commentDrafts = drafts.drafts || [];
        await refresh();
      }
      return;
    }
    const transition = event.target.closest("[data-ycg-live-transition]");
    if (transition) {
      if (!confirm(`Chuyển livestream sang ${transition.dataset.status}?`)) return;
      const result = await apiAction("live/transition", { id: transition.dataset.ycgLiveTransition, broadcastStatus: transition.dataset.status }, "YouTube đã xác nhận trạng thái livestream.");
      if (result) await refresh();
    }
  }

  function handleInput(event) {
    const target = event.target;
    if (target.matches("[data-ycg-thumb]")) {
      state.thumbnail[target.dataset.ycgThumb] = target.value;
      saveState(); drawThumbnail(); return;
    }
    if (target.matches("[data-ycg-seo]")) {
      state.seo[target.dataset.ycgSeo] = target.value;
      saveState();
      if (target.dataset.ycgSeo !== "videoId") updateSeoScoreUi();
      return;
    }
    if (target.matches("[data-ycg-shorts]")) {
      const key = target.dataset.ycgShorts;
      state.shorts[key] = target.type === "checkbox" ? target.checked : target.type === "range" ? Number(target.value) : target.value;
      saveState();
      if (target.type === "range") target.nextElementSibling.textContent = `${target.value} giây`;
      return;
    }
    if (target.matches("[data-ycg-caption]")) {
      state.captions[target.dataset.ycgCaption] = target.value;
      if (target.dataset.ycgCaption === "content" && state.captions.status !== "draft") state.captions.status = "draft";
      saveState();
      return;
    }
    if (target.matches("[data-ycg-automation]")) {
      state.automation[target.dataset.ycgAutomation] = target.checked;
      saveState();
      render();
      return;
    }
    if (target.matches("[data-ycg-preflight]")) {
      state.preflight[target.dataset.ycgPreflight] = target.checked;
      saveState(); render();
    }
  }

  async function handleChange(event) {
    const target = event.target;
    if (target.matches("[data-ycg-fleet-channel]")) {
      const ids = new Set(fleetState.selectedChannelIds);
      if (target.checked) ids.add(target.value);
      else ids.delete(target.value);
      const limit = Number(fleetOverview?.limits?.maxChannelsPerBulkJob || channelStatus.bulk?.maxChannelsPerJob || 5);
      fleetState.selectedChannelIds = [...ids].slice(0, limit);
      if (ids.size > limit) target.checked = false;
      fleetPreflight = null;
      saveFleetState();
      render();
      return;
    }
    if (target.matches("[data-ycg-fleet-file]")) {
      const file = target.files?.[0] || null;
      if (file && !file.type.startsWith("video/") && file.type !== "application/octet-stream") throw new Error("Chỉ chấp nhận file video.");
      fleetUploadFile = file;
      fleetState.idempotencyKey = "";
      saveFleetState();
      render();
      return;
    }
    if (target.matches("[data-ycg-channel-select]")) {
      const result = await apiAction("channel/select", { channelId: target.value }, "Đã chuyển sang kênh YouTube đã chọn.");
      if (result) await refresh();
      return;
    }
    if (target.matches("[data-ycg-thumb-image]")) {
      const file = target.files?.[0];
      if (!file?.type.startsWith("image/")) return;
      const image = new Image();
      image.onload = () => { thumbnailImage = image; drawThumbnail(); URL.revokeObjectURL(image.src); };
      image.src = URL.createObjectURL(file);
      return;
    }
    if (target.matches("[data-ycg-thumb-video]")) {
      const file = target.files?.[0];
      if (!file?.type.startsWith("video/")) return;
      if (thumbnailVideoUrl) URL.revokeObjectURL(thumbnailVideoUrl);
      thumbnailVideoUrl = URL.createObjectURL(file);
      thumbnailVideo = document.createElement("video");
      thumbnailVideo.preload = "auto";
      thumbnailVideo.muted = true;
      thumbnailVideo.src = thumbnailVideoUrl;
      await thumbnailVideo.play().catch(() => {});
      thumbnailVideo.pause();
      return status(`Đã nạp ${file.name}. Chọn thời điểm rồi lấy frame.`, "success");
    }
    if (target.matches("[data-ycg-caption-file]")) {
      const file = target.files?.[0];
      if (!file || file.size > 512 * 1024) return status("Subtitle phải nhỏ hơn 512 KB.", "error");
      state.captions.content = await file.text();
      state.captions.format = /\.vtt$/i.test(file.name) ? "vtt" : "srt";
      saveState(); render();
      return;
    }
    if (target.matches('[data-ycg-seo="videoId"]')) {
      const video = dashboard?.videos?.find((item) => item.id === target.value);
      if (video) Object.assign(state.seo, { videoId: video.id, title: video.title, description: video.description || "", tags: "" });
      saveState(); render();
    }
  }

  async function handleSubmit(event) {
    const fleet = event.target.closest("[data-ycg-fleet-form]");
    if (fleet) {
      event.preventDefault();
      return startFleetUpload(fleet);
    }
    const reply = event.target.closest("[data-ycg-reply-form]");
    if (reply) {
      event.preventDefault();
      const text = new FormData(reply).get("reply")?.toString().trim();
      if (!text) return status("Nhập nội dung trả lời.", "error");
      const result = await apiAction("comments/drafts", { parentId: reply.dataset.ycgReplyForm, text }, "Đã lưu bản nháp; chưa gửi ra YouTube.");
      if (result) {
        const drafts = await api("comments/drafts");
        commentDrafts = drafts.drafts || [];
        render();
      }
      return;
    }
    const live = event.target.closest("[data-ycg-live-form]");
    if (live) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(live));
      if (!data.confirm || !confirm("Tạo broadcast và stream thật trên YouTube?")) return;
      const result = await apiAction("live/create", data, "Đã tạo livestream thật trên YouTube.");
      if (result) {
        await refresh();
        switchModule("live");
        const secret = root.querySelector("[data-ycg-stream-secret]");
        if (secret) {
          secret.hidden = false;
          secret.innerHTML = `<strong>Thông tin encoder · chỉ hiển thị trong phiên này</strong><label>Server<input readonly value="${esc(result.stream.ingestionAddress)}"></label><label>Stream key<input type="password" readonly value="${esc(result.stream.streamName)}"><button type="button" data-ycg-reveal-key>Hiện</button></label><small>Không chia sẻ stream key. HH không ghi khóa này vào localStorage.</small>`;
        }
      } else render();
      return;
    }
    const calendar = event.target.closest("[data-ycg-calendar-form]");
    if (calendar) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(calendar));
      const at = new Date(data.at);
      if (!data.title || !Number.isFinite(at.getTime())) return status("Tên và deadline chưa hợp lệ.", "error");
      state.calendar.unshift({ id: uid("calendar"), ...data, at: at.toISOString(), createdAt: new Date().toISOString() });
      saveState(); render(); return status("Đã lưu mission vào lịch cục bộ.", "success");
    }
  }

  function filterComments() {
    const query = root?.querySelector("[data-ycg-comment-search]")?.value.toLowerCase() || "";
    const filter = root?.querySelector("[data-ycg-comment-filter]")?.value || "all";
    root?.querySelectorAll("[data-ycg-comment-row]").forEach((row) => {
      const replies = Number(row.dataset.replies || 0);
      row.hidden = !row.dataset.search.includes(query)
        || (filter === "unanswered" && replies > 0)
        || (filter === "answered" && replies === 0);
    });
  }

  function mount(host) {
    cleanup();
    root = host;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    state = loadState();
    handleOauthResult();
    controller = new AbortController();
    const options = { signal: controller.signal };
    root.addEventListener("click", handleClick, options);
    root.addEventListener("input", (event) => {
      handleInput(event);
      if (event.target.matches("[data-ycg-comment-search]")) filterComments();
    }, options);
    root.addEventListener("change", (event) => {
      handleChange(event).catch((error) => { errorMessage = error.message; render(); });
      if (event.target.matches("[data-ycg-comment-filter]")) filterComments();
    }, options);
    root.addEventListener("submit", (event) => handleSubmit(event).catch((error) => {
      errorMessage = error.message;
      render();
    }), options);
    root.addEventListener("click", (event) => {
      const reveal = event.target.closest("[data-ycg-reveal-key]");
      if (!reveal) return;
      const input = reveal.parentElement.querySelector("input");
      input.type = input.type === "password" ? "text" : "password";
      reveal.textContent = input.type === "password" ? "Hiện" : "Ẩn";
    }, options);
    window.addEventListener("online", () => refresh(false), options);
    window.addEventListener("offline", render, options);
    window.addEventListener("hh:auth-change", () => {
      if (publisherMounted) window.HHYouTubePublisher?.unmount?.();
      publisherMounted = false;
      storageChannelId = "unassigned";
      state = loadState();
      fleetState = loadFleetState();
      fleetOverview = null;
      fleetJobs = [];
      fleetPreflight = null;
      fleetUploadFile = null;
      channelStatus = { configured: false, connected: false, permissions: {} };
      dashboard = null;
      errorMessage = "";
      render();
      refresh(false);
    }, options);
    render();
    refresh();
  }

  function cleanup() {
    controller?.abort();
    controller = null;
    if (publisherMounted) window.HHYouTubePublisher?.unmount?.();
    publisherMounted = false;
    if (thumbnailVideoUrl) URL.revokeObjectURL(thumbnailVideoUrl);
    thumbnailVideoUrl = "";
    thumbnailVideo = null;
    thumbnailImage = null;
    fleetUploadFile = null;
    fleetPreflight = null;
    root = null;
  }

  window.HHYouTubeCreatorGalaxy = Object.freeze({
    mount,
    cleanup,
    modules: MODULES,
    normalizeState,
    parseCaptions,
    seoScore: (value) => {
      const previous = state;
      state = normalizeState(value);
      const result = seoScore();
      state = previous;
      return result;
    },
    preflightResults
  });
  window.dispatchEvent(new CustomEvent("hh:youtube-creator-ready"));
})();
