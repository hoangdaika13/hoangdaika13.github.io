(function () {
  "use strict";

  const STORAGE_KEY = "hh.youtube-publisher.v1";
  const MAX_THUMBNAIL = 2 * 1024 * 1024;
  const CATEGORIES = [
    ["10", "Âm nhạc"], ["22", "Con người & Blog"], ["24", "Giải trí"],
    ["26", "Hướng dẫn & Phong cách"], ["27", "Giáo dục"], ["28", "Khoa học & Công nghệ"]
  ];
  const DEFAULT_DRAFT = {
    title: "",
    description: "",
    tags: "",
    categoryId: "10",
    defaultLanguage: "vi",
    privacyMode: "private",
    publishAt: "",
    playlistId: "",
    madeForKids: false,
    containsSyntheticMedia: true,
    hasPaidProductPlacement: false,
    notifySubscribers: true,
    embeddable: true,
    publicStatsViewable: true,
    license: "youtube",
    recordingDate: ""
  };

  let host = null;
  let options = {};
  let controller = null;
  let videoFile = null;
  let thumbnailFile = null;
  let videoUrl = "";
  let thumbnailUrl = "";
  let status = { configured: false, connected: false, channel: null, channels: [], playlists: [], history: [] };
  let draft = loadDraft();
  let activeUpload = null;
  let currentXhr = null;
  let paused = false;
  let cancelled = false;

  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const apiBase = () => String(options.apiBase || window.HH_REALTIME_URL || location.origin).replace(/\/$/, "");
  const authHeaders = () => {
    const token = window.HHAuthSession?.token?.() || "";
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };
  const fileSize = (bytes) => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / 1024 ** index).toFixed(index > 1 ? 2 : 0)} ${units[index]}`;
  };
  const formatDate = (value) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "";

  function loadDraft() {
    try { return { ...DEFAULT_DRAFT, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {}) }; }
    catch { return { ...DEFAULT_DRAFT }; }
  }

  function saveDraft() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch {}
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
      const error = new Error(data.error || `YouTube Publisher HTTP ${response.status}`);
      error.code = data.code || "YOUTUBE_PUBLISHER_ERROR";
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function notify(message, type = "success") {
    const node = host?.querySelector("[data-yap-toast]");
    if (!node) return;
    node.textContent = message;
    node.dataset.type = type;
    node.classList.add("is-visible");
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => node.classList.remove("is-visible"), 3200);
  }

  function seedFromMusicProject(force = false) {
    const pack = options.pack || {};
    if (force || !draft.title) draft.title = String(pack.title || "").slice(0, 100);
    if (force || !draft.description) draft.description = String(pack.description || "").slice(0, 5000);
    if (force || !draft.tags) draft.tags = String(pack.tags || "").slice(0, 480);
    saveDraft();
  }

  function handleOauthResult() {
    const params = new URLSearchParams(location.search);
    const connected = params.get("youtubeConnected");
    const error = params.get("youtubeError");
    if (!connected && !error) return;
    params.delete("youtubeConnected");
    params.delete("youtubeError");
    const query = params.toString();
    history.replaceState({}, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
    requestAnimationFrame(() => notify(connected ? "Đã kết nối kênh YouTube." : error, connected ? "success" : "error"));
  }

  async function refreshStatus(showMessage = false) {
    try {
      status = await api("status");
      render();
      if (showMessage) notify("Đã đồng bộ kênh và lịch sử upload.");
    } catch (error) {
      status = { configured: false, connected: false, channel: null, channels: [], playlists: [], history: [], error: error.message };
      render();
    }
  }

  function statusBadge() {
    if (!status.configured) return '<span class="yap-badge is-warning"><i></i>Chưa cấu hình OAuth</span>';
    if (!status.connected) return '<span class="yap-badge"><i></i>Chưa nối kênh</span>';
    return '<span class="yap-badge is-online"><i></i>Kênh đã kết nối</span>';
  }

  function channelCard() {
    if (!status.connected) return `<article class="yap-channel yap-channel--empty">
      <div class="yap-channel__mark">YT</div><div><small>BƯỚC 1 · CHỌN TÀI KHOẢN/KÊNH</small><h3>Kết nối kênh YouTube</h3><p>Google mở cửa sổ chọn tài khoản và Brand Account chính thức. HH không yêu cầu hoặc lưu mật khẩu Google.</p></div>
      <button class="yap-primary" type="button" data-yap-action="connect" ${status.configured ? "" : "disabled"}>Chọn tài khoản Google</button>
    </article>`;
    const channel = status.channel || {};
    const channels = status.channels || [];
    return `<article class="yap-channel">
      ${channel.thumbnail ? `<img src="${esc(channel.thumbnail)}" alt="Ảnh kênh">` : '<div class="yap-channel__mark">YT</div>'}
      <div><small>KÊNH ĐANG CHỌN</small><h3>${esc(channel.title)}</h3><p>${Number(channel.subscribers || 0).toLocaleString("vi-VN")} người đăng ký · ${Number(channel.videos || 0).toLocaleString("vi-VN")} video</p></div>
      <div class="yap-channel__switcher">${channels.length > 1 ? `<label><span>Chuyển kênh</span><select data-yap-channel-select>${channels.map((item) => `<option value="${esc(item.id)}" ${item.id === channel.id ? "selected" : ""}>${esc(item.title)}</option>`).join("")}</select></label>` : ""}<button type="button" data-yap-action="connect">+ Thêm tài khoản/kênh</button></div>
      <div class="yap-channel__actions"><button type="button" data-yap-action="refresh-channel" title="Làm mới kênh">↻</button><button type="button" data-yap-action="disconnect">Gỡ kênh này</button></div>
    </article>`;
  }

  function fileCard() {
    return `<section class="yap-panel yap-files"><header><div><small>BƯỚC 2</small><h3>Media từ thiết bị</h3></div><span>Không lưu video vào database HH</span></header>
      <div class="yap-file-grid">
        <label class="yap-drop ${videoFile ? "has-file" : ""}"><input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-matroska" data-yap-file="video"><b>${videoFile ? "✓" : "+"}</b><strong>${videoFile ? esc(videoFile.name) : "Chọn hoặc kéo video vào đây"}</strong><span>${videoFile ? `${fileSize(videoFile.size)} · ${esc(videoFile.type || "video")}` : "MP4, WebM, MOV, MKV · upload thẳng lên YouTube"}</span></label>
        <label class="yap-drop yap-drop--thumb ${thumbnailFile ? "has-file" : ""}"><input type="file" accept="image/jpeg,image/png" data-yap-file="thumbnail"><b>${thumbnailFile ? "✓" : "▧"}</b><strong>${thumbnailFile ? esc(thumbnailFile.name) : "Thumbnail tùy chỉnh"}</strong><span>${thumbnailFile ? `${fileSize(thumbnailFile.size)} · sẵn sàng` : "JPG hoặc PNG · tối đa 2 MB · khuyến nghị 1280×720"}</span></label>
      </div>
      <div class="yap-preview ${videoFile ? "is-ready" : ""}">${videoFile ? '<video data-yap-video-preview controls playsinline preload="metadata"></video>' : '<div><i>▶</i><strong>Video preview</strong><span>Chọn file để kiểm tra trước khi upload</span></div>'}${thumbnailFile ? '<img data-yap-thumbnail-preview alt="Xem trước thumbnail">' : ""}</div>
    </section>`;
  }

  const field = (label, name, value, attrs = "") => `<label class="yap-field"><span>${label}</span><input data-yap-field="${name}" value="${esc(value)}" ${attrs}></label>`;
  const toggle = (label, note, name, checked) => `<label class="yap-toggle"><span><strong>${label}</strong><small>${note}</small></span><input type="checkbox" data-yap-field="${name}" ${checked ? "checked" : ""}><i></i></label>`;

  function metadataCard() {
    const scheduled = draft.privacyMode === "schedule";
    return `<section class="yap-panel yap-metadata"><header><div><small>BƯỚC 3</small><h3>Metadata & lịch xuất bản</h3></div><div class="yap-meta-actions"><button type="button" data-yap-action="load-project">Nạp từ dự án nhạc</button><button type="button" data-yap-action="ai-disclosure">Thêm ghi chú AI</button></div></header>
      <div class="yap-form-grid">
        <label class="yap-field yap-field--wide"><span>Tiêu đề <b data-yap-title-count>${draft.title.length}/100</b></span><input data-yap-field="title" maxlength="100" value="${esc(draft.title)}" placeholder="Tên video sẽ hiển thị trên YouTube"></label>
        <label class="yap-field yap-field--wide"><span>Mô tả <b data-yap-description-count>${draft.description.length}/5000</b></span><textarea rows="11" maxlength="5000" data-yap-field="description" placeholder="Mô tả, chapter, liên kết và hashtag">${esc(draft.description)}</textarea></label>
        <label class="yap-field yap-field--wide"><span>Tags <b data-yap-tags-count>${draft.tags.length}/480</b></span><textarea rows="3" maxlength="480" data-yap-field="tags" placeholder="relaxing music, piano, sleep">${esc(draft.tags)}</textarea></label>
        <label class="yap-field"><span>Danh mục</span><select data-yap-field="categoryId">${CATEGORIES.map(([id, label]) => `<option value="${id}" ${draft.categoryId === id ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        <label class="yap-field"><span>Ngôn ngữ</span><select data-yap-field="defaultLanguage"><option value="vi" ${draft.defaultLanguage === "vi" ? "selected" : ""}>Tiếng Việt</option><option value="en" ${draft.defaultLanguage === "en" ? "selected" : ""}>English</option><option value="ja" ${draft.defaultLanguage === "ja" ? "selected" : ""}>日本語</option><option value="ko" ${draft.defaultLanguage === "ko" ? "selected" : ""}>한국어</option></select></label>
        <label class="yap-field"><span>Chế độ hiển thị</span><select data-yap-field="privacyMode"><option value="private" ${draft.privacyMode === "private" ? "selected" : ""}>Riêng tư</option><option value="unlisted" ${draft.privacyMode === "unlisted" ? "selected" : ""}>Không công khai</option><option value="public" ${draft.privacyMode === "public" ? "selected" : ""}>Công khai ngay</option><option value="schedule" ${scheduled ? "selected" : ""}>Lên lịch công khai</option></select></label>
        <label class="yap-field ${scheduled ? "" : "is-disabled"}"><span>Lịch phát · ${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}</span><input type="datetime-local" data-yap-field="publishAt" value="${esc(draft.publishAt)}" ${scheduled ? "" : "disabled"}></label>
        <label class="yap-field"><span>Playlist</span><select data-yap-field="playlistId"><option value="">Không thêm playlist</option>${(status.playlists || []).map((item) => `<option value="${esc(item.id)}" ${draft.playlistId === item.id ? "selected" : ""}>${esc(item.title)} · ${esc(item.privacy)}</option>`).join("")}</select></label>
        <label class="yap-field"><span>Giấy phép</span><select data-yap-field="license"><option value="youtube" ${draft.license === "youtube" ? "selected" : ""}>Giấy phép YouTube tiêu chuẩn</option><option value="creativeCommon" ${draft.license === "creativeCommon" ? "selected" : ""}>Creative Commons</option></select></label>
        ${field("Ngày ghi hình", "recordingDate", draft.recordingDate, 'type="date"')}
      </div>
      <div class="yap-settings">
        ${toggle("Nội dung dành cho trẻ em", "Khai báo COPPA cho video", "madeForKids", draft.madeForKids)}
        ${toggle("Nội dung AI/đã chỉnh sửa", "Khai báo altered or synthetic media", "containsSyntheticMedia", draft.containsSyntheticMedia)}
        ${toggle("Có tài trợ/sản phẩm trả phí", "Khai báo paid product placement", "hasPaidProductPlacement", draft.hasPaidProductPlacement)}
        ${toggle("Thông báo người đăng ký", "Gửi thông báo khi video công khai", "notifySubscribers", draft.notifySubscribers)}
        ${toggle("Cho phép nhúng", "Cho website khác nhúng trình phát", "embeddable", draft.embeddable)}
        ${toggle("Hiển thị thống kê", "Cho xem lượt thích và số liệu công khai", "publicStatsViewable", draft.publicStatsViewable)}
      </div>
    </section>`;
  }

  function uploadCard() {
    const progress = Number(activeUpload?.progress || 0);
    const stage = activeUpload?.stage || "ready";
    const labels = { ready: "Sẵn sàng", preparing: "Đang tạo phiên", uploading: "Đang tải video", paused: "Đã tạm dừng", thumbnail: "Đang tải thumbnail", finalizing: "Đang hoàn tất", done: "Hoàn tất", error: "Có lỗi" };
    return `<section class="yap-panel yap-publish"><header><div><small>BƯỚC 4</small><h3>Upload & phát hành</h3></div>${statusBadge()}</header>
      <div class="yap-readiness">
        <article class="${status.connected ? "is-ok" : ""}"><i>${status.connected ? "✓" : "1"}</i><span><strong>Kênh</strong><small>${status.connected ? "Đã kết nối" : "Chưa kết nối"}</small></span></article>
        <article class="${videoFile ? "is-ok" : ""}"><i>${videoFile ? "✓" : "2"}</i><span><strong>Video</strong><small>${videoFile ? fileSize(videoFile.size) : "Chưa chọn"}</small></span></article>
        <article class="${draft.title.trim() ? "is-ok" : ""}"><i>${draft.title.trim() ? "✓" : "3"}</i><span><strong>Metadata</strong><small>${draft.title.trim() ? "Hợp lệ" : "Thiếu tiêu đề"}</small></span></article>
        <article class="${draft.privacyMode !== "schedule" || draft.publishAt ? "is-ok" : ""}"><i>${draft.privacyMode !== "schedule" || draft.publishAt ? "✓" : "4"}</i><span><strong>Phát hành</strong><small>${draft.privacyMode === "schedule" ? (draft.publishAt ? formatDate(draft.publishAt) : "Thiếu lịch") : draft.privacyMode}</small></span></article>
      </div>
      <div class="yap-progress"><div><span style="width:${progress}%"></span></div><p><strong data-yap-progress-label>${labels[stage] || labels.ready}</strong><b data-yap-progress-value>${progress.toFixed(1)}%</b></p><small data-yap-progress-detail>${esc(activeUpload?.detail || "Video được upload trực tiếp từ thiết bị lên máy chủ YouTube bằng HTTPS.")}</small></div>
      <div class="yap-publish__actions">
        <button class="yap-primary" type="button" data-yap-action="upload" ${status.connected && videoFile && draft.title.trim() && !["preparing", "uploading", "thumbnail", "finalizing"].includes(stage) ? "" : "disabled"}>${stage === "paused" ? "Tiếp tục upload" : "Bắt đầu upload"}</button>
        <button type="button" data-yap-action="pause" ${stage === "uploading" ? "" : "disabled"}>Tạm dừng</button>
        <button type="button" data-yap-action="cancel" ${activeUpload && !["done", "error"].includes(stage) ? "" : "disabled"}>Hủy hàng đợi</button>
        <button type="button" data-yap-action="save-draft">Lưu bản nháp</button>
      </div>
      <div class="yap-safety"><i>✓</i><p><strong>Kiểm tra an toàn trước khi đăng</strong><span>Bạn phải sở hữu hoặc có quyền sử dụng video, nhạc, hình ảnh và thumbnail. Nên upload Riêng tư trước để kiểm tra Content ID và xử lý HD.</span></p></div>
    </section>`;
  }

  function historyCard() {
    return `<section class="yap-panel yap-history"><header><div><small>ACTIVITY</small><h3>Lịch sử xuất bản</h3></div><button type="button" data-yap-action="refresh-status">Làm mới</button></header><div>${(status.history || []).length ? status.history.map((item) => `<article><i class="is-${esc(item.status)}">${item.status === "uploaded" ? "✓" : item.status === "error" ? "!" : "↑"}</i><span><strong>${esc(item.title || item.fileName)}</strong><small>${formatDate(item.completedAt || item.createdAt)} · ${esc(item.privacyStatus || "private")}${item.error ? ` · ${esc(item.error)}` : ""}</small></span>${item.videoId ? `<a href="https://youtu.be/${esc(item.videoId)}" target="_blank" rel="noopener">Mở video ↗</a>` : `<b>${esc(item.status)}</b>`}</article>`).join("") : '<p class="yap-empty">Chưa có video nào được gửi từ HH Publisher.</p>'}</div></section>`;
  }

  function render() {
    if (!host) return;
    host.innerHTML = `<div class="youtube-auto-publisher">
      <section class="yap-hero"><div><p><i></i> YOUTUBE AUTO PUBLISHER</p><h2>Từ file trong máy đến <em>YouTube</em></h2><span>Metadata, lịch phát, playlist, thumbnail và upload resumable trong một quy trình.</span></div><aside>${statusBadge()}<span>HTTPS · OAuth 2.0 · Resumable</span></aside></section>
      ${status.error ? `<div class="yap-alert"><strong>Chưa kết nối được backend</strong><span>${esc(status.error)}</span></div>` : ""}
      ${channelCard()}
      <div class="yap-main-grid"><div>${fileCard()}${metadataCard()}</div><aside>${uploadCard()}${historyCard()}</aside></div>
      <div class="yap-toast" data-yap-toast role="status" aria-live="polite"></div>
    </div>`;
    const video = host.querySelector("[data-yap-video-preview]");
    const thumbnail = host.querySelector("[data-yap-thumbnail-preview]");
    if (video && videoUrl) video.src = videoUrl;
    if (thumbnail && thumbnailUrl) thumbnail.src = thumbnailUrl;
  }

  function updateCounters() {
    const title = host?.querySelector("[data-yap-title-count]");
    const description = host?.querySelector("[data-yap-description-count]");
    const tags = host?.querySelector("[data-yap-tags-count]");
    if (title) title.textContent = `${draft.title.length}/100`;
    if (description) description.textContent = `${draft.description.length}/5000`;
    if (tags) tags.textContent = `${draft.tags.length}/480`;
  }

  function updateProgress(stage, progress, detail = "") {
    activeUpload = { ...(activeUpload || {}), stage, progress: Math.max(0, Math.min(100, Number(progress) || 0)), detail };
    const labels = { preparing: "Đang tạo phiên upload", uploading: "Đang tải video", paused: "Đã tạm dừng", thumbnail: "Đang tải thumbnail", finalizing: "Đang hoàn tất", done: "Upload hoàn tất", error: "Upload thất bại" };
    const bar = host?.querySelector(".yap-progress > div span");
    const label = host?.querySelector("[data-yap-progress-label]");
    const value = host?.querySelector("[data-yap-progress-value]");
    const info = host?.querySelector("[data-yap-progress-detail]");
    if (bar) bar.style.width = `${activeUpload.progress}%`;
    if (label) label.textContent = labels[stage] || stage;
    if (value) value.textContent = `${activeUpload.progress.toFixed(1)}%`;
    if (info) info.textContent = detail;
  }

  function xhrPut(url, blob, start, total, mimeType, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      currentXhr = xhr;
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", mimeType || "application/octet-stream");
      xhr.setRequestHeader("Content-Range", `bytes ${start}-${start + blob.size - 1}/${total}`);
      xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(start + event.loaded);
      xhr.onload = () => {
        currentXhr = null;
        if ([200, 201, 308].includes(xhr.status)) {
          const range = xhr.getResponseHeader("Range") || "";
          const match = range.match(/bytes=0-(\d+)/i);
          resolve({ status: xhr.status, offset: match ? Number(match[1]) + 1 : start + blob.size, data: (() => { try { return JSON.parse(xhr.responseText || "{}"); } catch { return {}; } })() });
        } else reject(new Error(`YouTube upload HTTP ${xhr.status}: ${xhr.responseText.slice(0, 240)}`));
      };
      xhr.onerror = () => { currentXhr = null; reject(new Error("Mất kết nối khi upload video.")); };
      xhr.onabort = () => { currentXhr = null; reject(Object.assign(new Error("Upload đã tạm dừng."), { paused: true })); };
      xhr.send(blob);
    });
  }

  function queryResumableOffset(url, total, mimeType) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      currentXhr = xhr;
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", mimeType || "application/octet-stream");
      xhr.setRequestHeader("Content-Range", `bytes */${total}`);
      xhr.onload = () => {
        currentXhr = null;
        if ([200, 201].includes(xhr.status)) {
          let data = {};
          try { data = JSON.parse(xhr.responseText || "{}"); } catch {}
          resolve({ complete: true, offset: total, data });
          return;
        }
        if (xhr.status === 308) {
          const match = (xhr.getResponseHeader("Range") || "").match(/bytes=0-(\d+)/i);
          resolve({ complete: false, offset: match ? Number(match[1]) + 1 : 0, data: {} });
          return;
        }
        reject(new Error(`Không thể tiếp tục phiên upload (HTTP ${xhr.status}).`));
      };
      xhr.onerror = () => { currentXhr = null; reject(new Error("Không thể kiểm tra phiên upload YouTube.")); };
      xhr.onabort = () => { currentXhr = null; reject(Object.assign(new Error("Upload đã tạm dừng."), { paused: true })); };
      xhr.send();
    });
  }

  async function uploadBinary(url, file, startOffset = 0, chunkSize = 8 * 1024 * 1024) {
    let offset = startOffset;
    while (offset < file.size) {
      if (paused) throw Object.assign(new Error("Upload đã tạm dừng."), { paused: true });
      const blob = file.slice(offset, Math.min(file.size, offset + chunkSize));
      const result = await xhrPut(url, blob, offset, file.size, file.type || "application/octet-stream", (sent) => {
        updateProgress("uploading", sent / file.size * 100, `${fileSize(sent)} / ${fileSize(file.size)} · có thể tạm dừng và tiếp tục`);
      });
      offset = Math.max(offset + blob.size, result.offset);
      activeUpload.offset = offset;
      if ([200, 201].includes(result.status)) return result.data;
    }
    throw new Error("YouTube chưa xác nhận video sau khi tải xong.");
  }

  async function uploadThumbnail(videoId) {
    if (!thumbnailFile) return;
    updateProgress("thumbnail", 100, "Đang gắn thumbnail tùy chỉnh…");
    const session = await api("thumbnail/session", "POST", { videoId, fileSize: thumbnailFile.size, mimeType: thumbnailFile.type });
    await xhrPut(session.uploadUrl, thumbnailFile, 0, thumbnailFile.size, thumbnailFile.type, () => {});
  }

  function uploadPayload() {
    return {
      ...draft,
      tags: draft.tags.split(",").map((item) => item.trim()).filter(Boolean),
      fileName: videoFile.name,
      fileSize: videoFile.size,
      mimeType: videoFile.type || "application/octet-stream",
      privacyStatus: draft.privacyMode === "schedule" ? "private" : draft.privacyMode,
      publishAt: draft.privacyMode === "schedule" && draft.publishAt ? new Date(draft.publishAt).toISOString() : ""
    };
  }

  async function startUpload() {
    if (!status.connected || !videoFile) return notify("Hãy kết nối kênh và chọn video.", "error");
    if (!draft.title.trim()) return notify("Tiêu đề video đang trống.", "error");
    if (draft.privacyMode === "schedule" && (!draft.publishAt || new Date(draft.publishAt).getTime() < Date.now() + 60_000)) return notify("Chọn lịch phát trong tương lai.", "error");
    paused = false;
    cancelled = false;
    try {
      if (!activeUpload?.uploadUrl || activeUpload.fileKey !== `${videoFile.name}:${videoFile.size}:${videoFile.lastModified}`) {
        updateProgress("preparing", 0, "Đang gửi metadata và tạo phiên upload bảo mật…");
        const session = await api("upload/session", "POST", uploadPayload());
        activeUpload = { ...activeUpload, ...session, fileKey: `${videoFile.name}:${videoFile.size}:${videoFile.lastModified}`, offset: 0, stage: "uploading", progress: 0 };
      } else if (activeUpload.stage === "paused") {
        updateProgress("preparing", activeUpload.progress || 0, "Đang đồng bộ byte cuối với YouTube…");
        const resume = await queryResumableOffset(activeUpload.uploadUrl, videoFile.size, videoFile.type);
        activeUpload.offset = resume.offset;
        if (resume.complete && resume.data?.id) {
          activeUpload.stage = "uploading";
          activeUpload.offset = videoFile.size;
          activeUpload.completedUploadData = resume.data;
        }
      }
      const result = activeUpload.completedUploadData || await uploadBinary(activeUpload.uploadUrl, videoFile, activeUpload.offset || 0, activeUpload.chunkSize);
      const videoId = result.id;
      if (!videoId) throw new Error("YouTube không trả về video ID.");
      await uploadThumbnail(videoId);
      updateProgress("finalizing", 100, "Đang thêm playlist và xác minh video…");
      const completed = await api("upload/complete", "POST", { uploadId: activeUpload.uploadId, videoId, playlistId: draft.playlistId });
      activeUpload = { ...activeUpload, stage: "done", progress: 100, detail: `Hoàn tất: ${completed.url}`, videoId };
      render();
      notify("Video đã được gửi lên YouTube thành công.");
      await refreshStatus();
    } catch (error) {
      if (error.paused) {
        if (cancelled) {
          activeUpload = null;
          render();
          notify("Đã hủy hàng đợi cục bộ.");
          return;
        }
        activeUpload = { ...activeUpload, stage: "paused", detail: `Đã dừng ở ${fileSize(activeUpload.offset || 0)}. Bấm Tiếp tục để upload tiếp.` };
        render();
        return;
      }
      activeUpload = { ...activeUpload, stage: "error", detail: error.message };
      render();
      notify(error.message, "error");
      if (activeUpload?.uploadId) api("upload/error", "POST", { uploadId: activeUpload.uploadId, error: error.message }).catch(() => {});
    }
  }

  async function connectChannel() {
    try {
      const data = await api("oauth/start", "POST", { returnTo: location.origin });
      location.assign(data.authorizeUrl);
    } catch (error) { notify(error.message, "error"); }
  }

  async function disconnectChannel() {
    try { await api("disconnect", "POST", {}); await refreshStatus(); notify("Đã gỡ kênh YouTube khỏi HH Publisher."); }
    catch (error) { notify(error.message, "error"); }
  }

  function changeFile(target) {
    const file = target.files?.[0];
    if (!file) return;
    if (target.dataset.yapFile === "video") {
      if (!file.type.startsWith("video/") && !/\.(mkv|mov)$/i.test(file.name)) return notify("Hãy chọn một file video hợp lệ.", "error");
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      videoFile = file;
      videoUrl = URL.createObjectURL(file);
      activeUpload = null;
    } else {
      if (![/image\/jpeg/, /image\/png/].some((rule) => rule.test(file.type)) || file.size > MAX_THUMBNAIL) return notify("Thumbnail phải là JPG/PNG và không quá 2 MB.", "error");
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
      thumbnailFile = file;
      thumbnailUrl = URL.createObjectURL(file);
    }
    render();
  }

  function acceptDroppedFile(file, kind) {
    if (!file) return;
    if (kind === "video") {
      if (!file.type.startsWith("video/") && !/\.(mkv|mov)$/i.test(file.name)) return notify("Hãy thả một file video hợp lệ.", "error");
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      videoFile = file;
      videoUrl = URL.createObjectURL(file);
      activeUpload = null;
    } else {
      if (!file.type.startsWith("image/")) return notify("Thumbnail phải là ảnh JPG hoặc PNG.", "error");
      if (file.size > MAX_THUMBNAIL) return notify("Thumbnail phải nhỏ hơn 2 MB.", "error");
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
      thumbnailFile = file;
      thumbnailUrl = URL.createObjectURL(file);
    }
    render();
  }

  function handleDragOver(event) {
    const drop = event.target.closest(".yap-drop");
    if (!drop) return;
    event.preventDefault();
    drop.classList.add("is-dragging");
  }

  function handleDragLeave(event) {
    event.target.closest(".yap-drop")?.classList.remove("is-dragging");
  }

  function handleDrop(event) {
    const drop = event.target.closest(".yap-drop");
    if (!drop) return;
    event.preventDefault();
    drop.classList.remove("is-dragging");
    acceptDroppedFile(event.dataTransfer?.files?.[0], drop.classList.contains("yap-drop--thumb") ? "thumbnail" : "video");
  }

  function handleInput(event) {
    const target = event.target;
    if (!target.matches("[data-yap-field]")) return;
    const key = target.dataset.yapField;
    draft[key] = target.type === "checkbox" ? target.checked : target.value;
    saveDraft();
    updateCounters();
  }

  function handleChange(event) {
    const target = event.target;
    if (target.matches("[data-yap-file]")) return changeFile(target);
    if (target.matches("[data-yap-channel-select]")) {
      api("channel/select", "POST", { channelId: target.value }).then((data) => {
        status = { ...status, ...data };
        render();
        notify("Đã chuyển kênh xuất bản.");
      }).catch((error) => notify(error.message, "error"));
      return;
    }
    if (target.dataset.yapField === "privacyMode") render();
  }

  async function handleClick(event) {
    const button = event.target.closest("[data-yap-action]");
    if (!button) return;
    const action = button.dataset.yapAction;
    if (action === "connect") connectChannel();
    if (action === "disconnect") disconnectChannel();
    if (action === "refresh-status") refreshStatus(true);
    if (action === "refresh-channel") {
      try { const data = await api("channel/refresh", "POST", {}); status = { ...status, ...data }; render(); notify("Đã cập nhật thông tin kênh."); }
      catch (error) { notify(error.message, "error"); }
    }
    if (action === "load-project") { seedFromMusicProject(true); render(); notify("Đã nạp metadata từ dự án nhạc."); }
    if (action === "ai-disclosure") {
      const line = "\n\nMinh bạch nội dung: Video này có sử dụng công cụ AI trong quá trình tạo nhạc hoặc hình ảnh và đã được người sáng tạo biên tập, kiểm tra trước khi xuất bản.";
      if (!draft.description.includes("Minh bạch nội dung")) draft.description = `${draft.description.trim()}${line}`.slice(0, 5000);
      draft.containsSyntheticMedia = true;
      saveDraft(); render();
    }
    if (action === "save-draft") { saveDraft(); notify("Đã lưu bản nháp trên thiết bị."); }
    if (action === "upload") startUpload();
    if (action === "pause" && currentXhr) { paused = true; currentXhr.abort(); }
    if (action === "cancel") {
      cancelled = true;
      paused = true;
      if (currentXhr) currentXhr.abort();
      else { activeUpload = null; render(); notify("Đã hủy hàng đợi cục bộ."); }
    }
  }

  function mount(nextHost, nextOptions = {}) {
    unmount();
    host = nextHost;
    options = nextOptions;
    draft = loadDraft();
    seedFromMusicProject(false);
    controller = new AbortController();
    host.addEventListener("input", handleInput, { signal: controller.signal });
    host.addEventListener("change", handleChange, { signal: controller.signal });
    host.addEventListener("click", handleClick, { signal: controller.signal });
    host.addEventListener("dragover", handleDragOver, { signal: controller.signal });
    host.addEventListener("dragleave", handleDragLeave, { signal: controller.signal });
    host.addEventListener("drop", handleDrop, { signal: controller.signal });
    render();
    handleOauthResult();
    refreshStatus();
  }

  function unmount() {
    controller?.abort();
    controller = null;
    currentXhr?.abort();
    currentXhr = null;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    videoUrl = "";
    thumbnailUrl = "";
    videoFile = null;
    thumbnailFile = null;
    activeUpload = null;
    cancelled = false;
    paused = false;
    host = null;
  }

  window.HHYouTubePublisher = { mount, unmount };
})();
