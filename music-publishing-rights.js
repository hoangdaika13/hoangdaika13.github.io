(function () {
  "use strict";

  const STORAGE_KEY = "hh.music.publishing-rights.v1";
  const MANIFEST_FORMAT = "hh-music-rights-manifest";
  const MANIFEST_VERSION = 1;
  const SUPPORTED_VIEWS = new Set(["publish", "rights"]);
  const STATUS_LABELS = {
    draft: "Bản nháp",
    ready: "Sẵn sàng",
    scheduled: "Đã lên lịch",
    uploading: "Đang tải",
    failed: "Cần thử lại",
    complete: "Hoàn tất",
    blocked: "Bị chặn"
  };
  const EMPTY_PUBLISH_DRAFT = {
    title: "",
    description: "",
    tags: "",
    playlist: "",
    privacy: "private",
    scheduleAt: "",
    timezone: "Asia/Bangkok",
    thumbnailName: "",
    thumbnailSize: 0,
    captionName: "",
    captionLanguage: "vi",
    videoName: "",
    videoSize: 0,
    madeForKids: false,
    containsSyntheticMedia: true,
    retryLimit: 5
  };
  const EMPTY_RIGHTS_DRAFT = {
    id: "",
    name: "",
    type: "original",
    source: "",
    creator: "",
    license: "",
    proof: "",
    provider: "",
    prompt: "",
    consent: "",
    territory: "Worldwide",
    expiry: "",
    synthIdStatus: "not-checked",
    c2paStatus: "not-checked",
    notes: ""
  };
  const DEFAULT_STATE = {
    version: 1,
    publishDraft: EMPTY_PUBLISH_DRAFT,
    queue: [],
    rightsDraft: EMPTY_RIGHTS_DRAFT,
    assets: [],
    acknowledgements: {
      ownership: false,
      authorization: false,
      prohibitedContent: false
    }
  };

  let host = null;
  let view = "publish";
  let options = {};
  let state = null;
  let controller = null;
  let publisherOpen = false;
  let publisherMounted = false;
  let confirmAction = null;
  const sessionFiles = { video: null, thumbnail: null, caption: null };

  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const isoNow = () => new Date().toISOString();
  const formatBytes = (bytes) => {
    const value = Number(bytes) || 0;
    if (!value) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
    return `${(value / (1024 ** index)).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
  };
  const formatDate = (value) => {
    if (!value || Number.isNaN(new Date(value).getTime())) return "Chưa đặt";
    return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  };

  function cleanText(value, max = 5000) {
    return String(value ?? "").replace(/\u0000/g, "").slice(0, max);
  }

  function normalizePublishDraft(value = {}) {
    const source = value && typeof value === "object" ? value : {};
    return {
      ...EMPTY_PUBLISH_DRAFT,
      title: cleanText(source.title, 100),
      description: cleanText(source.description, 5000),
      tags: cleanText(source.tags, 500),
      playlist: cleanText(source.playlist, 160),
      privacy: ["private", "unlisted", "public", "schedule"].includes(source.privacy) ? source.privacy : "private",
      scheduleAt: cleanText(source.scheduleAt, 40),
      timezone: cleanText(source.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Bangkok", 80),
      thumbnailName: cleanText(source.thumbnailName, 240),
      thumbnailSize: Math.max(0, Number(source.thumbnailSize) || 0),
      captionName: cleanText(source.captionName, 240),
      captionLanguage: cleanText(source.captionLanguage || "vi", 20),
      videoName: cleanText(source.videoName, 240),
      videoSize: Math.max(0, Number(source.videoSize) || 0),
      madeForKids: Boolean(source.madeForKids),
      containsSyntheticMedia: source.containsSyntheticMedia !== false,
      retryLimit: Math.min(8, Math.max(1, Number(source.retryLimit) || 5))
    };
  }

  function normalizeRightsAsset(value = {}) {
    const source = value && typeof value === "object" ? value : {};
    const provenanceValues = ["not-checked", "declared", "detected"];
    return {
      ...EMPTY_RIGHTS_DRAFT,
      id: cleanText(source.id || uid("asset"), 80),
      name: cleanText(source.name, 180),
      type: ["original", "sample", "ai", "voice", "image", "video", "font", "other"].includes(source.type) ? source.type : "other",
      source: cleanText(source.source, 1000),
      creator: cleanText(source.creator, 200),
      license: cleanText(source.license, 240),
      proof: cleanText(source.proof, 1000),
      provider: cleanText(source.provider, 200),
      prompt: cleanText(source.prompt, 4000),
      consent: cleanText(source.consent, 1000),
      territory: cleanText(source.territory || "Worldwide", 200),
      expiry: cleanText(source.expiry, 40),
      synthIdStatus: provenanceValues.includes(source.synthIdStatus) ? source.synthIdStatus : "not-checked",
      c2paStatus: provenanceValues.includes(source.c2paStatus) ? source.c2paStatus : "not-checked",
      notes: cleanText(source.notes, 2000),
      createdAt: cleanText(source.createdAt || isoNow(), 40),
      updatedAt: cleanText(source.updatedAt || isoNow(), 40)
    };
  }

  function normalizeRightsDraft(value = {}) {
    const draft = normalizeRightsAsset(value);
    draft.id = cleanText(value?.id, 80);
    return draft;
  }

  function normalizeQueueItem(value = {}) {
    const draft = normalizePublishDraft(value.metadata || value);
    return {
      id: cleanText(value.id || uid("release"), 80),
      title: cleanText(value.title || draft.title, 100),
      status: Object.hasOwn(STATUS_LABELS, value.status) ? value.status : "draft",
      metadata: draft,
      attempts: Math.max(0, Number(value.attempts) || 0),
      nextRetryAt: cleanText(value.nextRetryAt, 40),
      createdAt: cleanText(value.createdAt || isoNow(), 40),
      updatedAt: cleanText(value.updatedAt || isoNow(), 40),
      note: cleanText(value.note, 500)
    };
  }

  function normalizeState(value = {}) {
    const source = value && typeof value === "object" ? value : {};
    return {
      version: 1,
      publishDraft: normalizePublishDraft(source.publishDraft),
      queue: Array.isArray(source.queue) ? source.queue.slice(0, 100).map(normalizeQueueItem) : [],
      rightsDraft: normalizeRightsDraft({ ...EMPTY_RIGHTS_DRAFT, ...(source.rightsDraft || {}) }),
      assets: Array.isArray(source.assets) ? source.assets.slice(0, 500).map(normalizeRightsAsset) : [],
      acknowledgements: {
        ownership: Boolean(source.acknowledgements?.ownership),
        authorization: Boolean(source.acknowledgements?.authorization),
        prohibitedContent: Boolean(source.acknowledgements?.prohibitedContent)
      }
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return normalizeState(saved || DEFAULT_STATE);
    } catch {
      return normalizeState(DEFAULT_STATE);
    }
  }

  state = loadState();

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  function publishChecks(draft = state.publishDraft) {
    const checks = [
      { key: "title", ok: draft.title.trim().length > 0 && draft.title.length <= 100, label: "Tiêu đề từ 1 đến 100 ký tự" },
      { key: "description", ok: draft.description.length <= 5000, label: "Mô tả không vượt quá 5.000 ký tự" },
      { key: "tags", ok: draft.tags.length <= 500, label: "Tags không vượt quá 500 ký tự" },
      { key: "video", ok: Boolean(draft.videoName), label: "Đã chọn video từ thiết bị" },
      { key: "thumbnail", ok: !draft.thumbnailName || draft.thumbnailSize <= 2 * 1024 * 1024, label: "Thumbnail JPG/PNG tối đa 2 MB" },
      { key: "caption", ok: !draft.captionName || /\.(srt|vtt)$/i.test(draft.captionName), label: "Phụ đề dùng định dạng SRT hoặc VTT" }
    ];
    if (draft.privacy === "schedule") {
      const future = draft.scheduleAt && new Date(draft.scheduleAt).getTime() > Date.now() + 60 * 1000;
      checks.push({ key: "schedule", ok: Boolean(future), label: "Lịch công khai phải ở tương lai" });
    }
    return checks;
  }

  function rightsRequirements(asset) {
    const fields = [
      ["name", "Tên tài sản"], ["source", "Nguồn"], ["creator", "Tác giả/chủ sở hữu"],
      ["license", "Giấy phép"], ["proof", "Bằng chứng"]
    ];
    if (asset.type === "ai" || asset.provider || asset.prompt) {
      fields.push(["provider", "Provider/model"], ["prompt", "Prompt hoặc mô tả tạo"]);
    }
    if (asset.type === "voice") fields.push(["consent", "Bằng chứng đồng ý giọng nói"]);
    return fields;
  }

  function assetScore(asset) {
    const requirements = rightsRequirements(asset);
    const complete = requirements.filter(([key]) => String(asset[key] || "").trim()).length;
    return Math.round((complete / requirements.length) * 100);
  }

  function rightsPreflight() {
    const checks = [];
    checks.push({ ok: state.assets.length > 0, label: "Có ít nhất một tài sản trong sổ quyền" });
    state.assets.forEach((asset) => {
      rightsRequirements(asset).forEach(([key, label]) => {
        if (!String(asset[key] || "").trim()) checks.push({ ok: false, label: `${asset.name || "Tài sản chưa đặt tên"}: thiếu ${label}` });
      });
      if (asset.expiry) {
        const expiry = new Date(`${asset.expiry}T23:59:59`).getTime();
        checks.push({ ok: Number.isFinite(expiry) && expiry >= Date.now(), label: `${asset.name || "Tài sản"}: giấy phép còn hiệu lực` });
      }
    });
    checks.push({ ok: state.acknowledgements.ownership, label: "Đã xác nhận quyền sở hữu hoặc quyền sử dụng" });
    checks.push({ ok: state.acknowledgements.authorization, label: "Đã xác nhận bằng chứng và khai báo là chính xác" });
    checks.push({ ok: state.acknowledgements.prohibitedContent, label: "Đã kiểm tra nội dung bị cấm và giả mạo" });
    return checks;
  }

  function overallRightsScore() {
    if (!state.assets.length) return 0;
    return Math.round(state.assets.reduce((sum, asset) => sum + assetScore(asset), 0) / state.assets.length);
  }

  function notify(message, type = "success") {
    const node = host?.querySelector?.("[data-mpr-toast]");
    if (!node) return;
    node.textContent = message;
    node.dataset.type = type;
    node.classList.add("is-visible");
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => node.classList.remove("is-visible"), 3200);
  }

  function field(label, key, value, attrs = "") {
    return `<label class="mpr-field"><span>${esc(label)}</span><input data-mpr-publish-field="${esc(key)}" value="${esc(value)}" ${attrs}></label>`;
  }

  function publishPreflightMarkup() {
    const checks = publishChecks();
    return `<div class="mpr-checks" data-mpr-publish-checks>${checks.map((item) => `<div class="${item.ok ? "is-ok" : "is-blocked"}"><i aria-hidden="true">${item.ok ? "✓" : "!"}</i><span>${esc(item.label)}</span></div>`).join("")}</div>`;
  }

  function queueMarkup() {
    if (!state.queue.length) return `<div class="mpr-empty"><i aria-hidden="true">⇧</i><strong>Hàng đợi đang trống</strong><span>Hoàn thiện metadata và thêm một bản phát hành.</span></div>`;
    return `<div class="mpr-queue-list">${state.queue.map((item) => {
      const meta = item.metadata;
      return `<article class="mpr-queue-item" data-status="${esc(item.status)}">
        <header><div><span class="mpr-status">${esc(STATUS_LABELS[item.status])}</span><h4>${esc(item.title)}</h4></div><button class="mpr-icon-button" type="button" data-mpr-action="confirm-remove-queue" data-id="${esc(item.id)}" aria-label="Xóa ${esc(item.title)}">×</button></header>
        <dl><div><dt>Hiển thị</dt><dd>${esc(meta.privacy)}</dd></div><div><dt>Lịch</dt><dd>${esc(meta.privacy === "schedule" ? formatDate(meta.scheduleAt) : "Ngay khi upload")}</dd></div><div><dt>Tệp</dt><dd>${esc(meta.videoName || "Chưa chọn")}</dd></div></dl>
        <div class="mpr-queue-progress" aria-label="Tiến trình upload"><span style="width:${item.status === "complete" ? 100 : item.status === "uploading" ? 48 : 0}%"></span></div>
        <footer><span>Thử lại ${item.attempts}/${meta.retryLimit}${item.nextRetryAt ? ` · ${esc(formatDate(item.nextRetryAt))}` : ""}</span><div><button type="button" data-mpr-action="open-queue-item" data-id="${esc(item.id)}">Mở</button>${item.status === "failed" ? `<button type="button" data-mpr-action="retry-queue" data-id="${esc(item.id)}">Thử lại</button>` : ""}<button type="button" data-mpr-action="mark-queue-failed" data-id="${esc(item.id)}">Báo lỗi thử</button></div></footer>
      </article>`;
    }).join("")}</div>`;
  }

  function publisherMarkup() {
    const available = Boolean(window.HHYouTubePublisher?.mount);
    return `<section class="mpr-panel mpr-publisher" aria-labelledby="mpr-publisher-title">
      <header class="mpr-panel-head"><div><small>UPLOAD GATEWAY</small><h3 id="mpr-publisher-title">YouTube Publisher chính thức</h3></div><span class="mpr-provider-state ${available ? "is-ready" : "is-offline"}"><i></i>${available ? "Module sẵn sàng" : "Chưa nạp module"}</span></header>
      <div class="mpr-oauth-notice"><b aria-hidden="true">G</b><p><strong>Đăng nhập bằng Google OAuth</strong><span>HH chỉ yêu cầu quyền YouTube sau khi bạn đồng ý. Không nhập, không nhận và không lưu mật khẩu Google.</span></p></div>
      ${publisherOpen ? `<div class="mpr-publisher-host" data-mpr-publisher-host>${available ? "" : `<div class="mpr-empty"><strong>HHYouTubePublisher chưa khả dụng</strong><span>Nạp module YouTube Publisher rồi thử lại. Metadata vẫn được giữ trên thiết bị.</span></div>`}</div><button class="mpr-secondary" type="button" data-mpr-action="close-publisher">Đóng Publisher</button>` : `<div class="mpr-launch-zone"><div><strong>Upload thật, OAuth thật, resumable upload</strong><span>Publisher xử lý chọn kênh, file và phiên upload. Hàng đợi bên trên chỉ điều phối metadata cục bộ.</span></div><button class="mpr-primary" type="button" data-mpr-action="launch-publisher" ${available ? "" : "disabled"}>Mở YouTube Publisher</button></div>`}
      <div class="mpr-retry-policy"><strong>Chính sách thử lại</strong><span>Exponential backoff: 5 giây → 15 giây → 60 giây → 5 phút → 15 phút. Phiên upload thật do Publisher xác nhận, không được giả lập ở giao diện này.</span></div>
    </section>`;
  }

  function publishViewMarkup() {
    const draft = state.publishDraft;
    return `<div class="mpr-publish-grid">
      <section class="mpr-panel mpr-release-form" aria-labelledby="mpr-release-title">
        <header class="mpr-panel-head"><div><small>RELEASE BUILDER</small><h3 id="mpr-release-title">Metadata và lịch xuất bản</h3></div><span data-mpr-autosave>Đã lưu cục bộ</span></header>
        <div class="mpr-form-grid">
          <label class="mpr-field mpr-field--wide"><span>Tiêu đề <b data-mpr-title-count>${draft.title.length}/100</b></span><input data-mpr-publish-field="title" maxlength="100" value="${esc(draft.title)}" placeholder="Tên video trên YouTube"></label>
          <label class="mpr-field mpr-field--wide"><span>Mô tả <b data-mpr-description-count>${draft.description.length}/5000</b></span><textarea data-mpr-publish-field="description" maxlength="5000" rows="7" placeholder="Mô tả, chapter, hashtag và ghi chú minh bạch AI">${esc(draft.description)}</textarea></label>
          <label class="mpr-field mpr-field--wide"><span>Tags <b data-mpr-tags-count>${draft.tags.length}/500</b></span><textarea data-mpr-publish-field="tags" maxlength="500" rows="2" placeholder="piano, ambient, original music">${esc(draft.tags)}</textarea></label>
          ${field("Playlist", "playlist", draft.playlist, 'placeholder="Tên hoặc ID playlist"')}
          <label class="mpr-field"><span>Quyền riêng tư</span><select data-mpr-publish-field="privacy"><option value="private" ${draft.privacy === "private" ? "selected" : ""}>Riêng tư</option><option value="unlisted" ${draft.privacy === "unlisted" ? "selected" : ""}>Không công khai</option><option value="public" ${draft.privacy === "public" ? "selected" : ""}>Công khai</option><option value="schedule" ${draft.privacy === "schedule" ? "selected" : ""}>Lên lịch</option></select></label>
          <label class="mpr-field"><span>Lịch công khai</span><input type="datetime-local" data-mpr-publish-field="scheduleAt" value="${esc(draft.scheduleAt)}" ${draft.privacy === "schedule" ? "" : "disabled"}></label>
          <label class="mpr-field"><span>Múi giờ</span><input data-mpr-publish-field="timezone" value="${esc(draft.timezone)}" readonly></label>
          <label class="mpr-field"><span>Ngôn ngữ phụ đề</span><select data-mpr-publish-field="captionLanguage"><option value="vi" ${draft.captionLanguage === "vi" ? "selected" : ""}>Tiếng Việt</option><option value="en" ${draft.captionLanguage === "en" ? "selected" : ""}>English</option><option value="ja" ${draft.captionLanguage === "ja" ? "selected" : ""}>日本語</option><option value="ko" ${draft.captionLanguage === "ko" ? "selected" : ""}>한국어</option></select></label>
          <label class="mpr-field"><span>Số lần thử lại tối đa</span><input type="number" min="1" max="8" data-mpr-publish-field="retryLimit" value="${draft.retryLimit}"></label>
        </div>
        <div class="mpr-file-grid">
          <label class="mpr-file"><input type="file" accept="video/*" data-mpr-file="video"><i aria-hidden="true">▶</i><span><strong>${esc(draft.videoName || "Chọn video")}</strong><small>${draft.videoName ? `${formatBytes(draft.videoSize)} · phải chọn lại sau khi tải trang` : "MP4, WebM, MOV từ thiết bị"}</small></span></label>
          <label class="mpr-file"><input type="file" accept="image/jpeg,image/png" data-mpr-file="thumbnail"><i aria-hidden="true">▧</i><span><strong>${esc(draft.thumbnailName || "Chọn thumbnail")}</strong><small>${draft.thumbnailName ? formatBytes(draft.thumbnailSize) : "JPG/PNG, tối đa 2 MB"}</small></span></label>
          <label class="mpr-file"><input type="file" accept=".srt,.vtt,text/vtt" data-mpr-file="caption"><i aria-hidden="true">CC</i><span><strong>${esc(draft.captionName || "Chọn phụ đề")}</strong><small>SRT hoặc VTT</small></span></label>
        </div>
        <div class="mpr-toggle-grid">
          <label><input type="checkbox" data-mpr-publish-field="madeForKids" ${draft.madeForKids ? "checked" : ""}><span>Nội dung dành cho trẻ em</span></label>
          <label><input type="checkbox" data-mpr-publish-field="containsSyntheticMedia" ${draft.containsSyntheticMedia ? "checked" : ""}><span>Khai báo nội dung AI/chỉnh sửa</span></label>
        </div>
        ${publishPreflightMarkup()}
        <div class="mpr-actions"><button class="mpr-primary" type="button" data-mpr-action="add-queue">Thêm vào hàng đợi</button><button class="mpr-secondary" type="button" data-mpr-action="export-queue">Xuất kế hoạch JSON</button><button class="mpr-danger" type="button" data-mpr-action="confirm-reset-publish">Đặt lại</button></div>
      </section>
      <aside class="mpr-panel mpr-queue" aria-labelledby="mpr-queue-title"><header class="mpr-panel-head"><div><small>LOCAL QUEUE</small><h3 id="mpr-queue-title">Hàng đợi xuất bản</h3></div><b>${state.queue.length}</b></header><p class="mpr-truth-note">Lưu metadata trên thiết bị. Không tự nhận là đã upload nếu Publisher chưa xác nhận.</p>${queueMarkup()}</aside>
      ${publisherMarkup()}
    </div>`;
  }

  function rightsField(label, key, value, attrs = "") {
    return `<label class="mpr-field"><span>${esc(label)}</span><input data-mpr-rights-field="${esc(key)}" value="${esc(value)}" ${attrs}></label>`;
  }

  function provenanceBadge(status) {
    const labels = { "not-checked": "Chưa kiểm tra", declared: "Đã khai báo", detected: "Ghi nhận phát hiện" };
    return `<span class="mpr-provenance" data-state="${esc(status)}">${esc(labels[status] || labels["not-checked"])}</span>`;
  }

  function assetLedgerMarkup() {
    if (!state.assets.length) return `<div class="mpr-empty"><i aria-hidden="true">§</i><strong>Chưa có tài sản</strong><span>Thêm nhạc, sample, giọng, ảnh hoặc font để tạo hồ sơ quyền.</span></div>`;
    return `<div class="mpr-table-wrap"><table><thead><tr><th>Tài sản</th><th>Giấy phép</th><th>Lineage</th><th>Provenance</th><th>Điểm</th><th><span class="mpr-sr-only">Tác vụ</span></th></tr></thead><tbody>${state.assets.map((asset) => `<tr>
      <td><strong>${esc(asset.name)}</strong><small>${esc(asset.type)} · ${esc(asset.creator || "Thiếu tác giả")}</small></td>
      <td><span>${esc(asset.license || "Thiếu")}</span><small>${asset.expiry ? `Hết hạn ${esc(asset.expiry)}` : "Không đặt hạn"}</small></td>
      <td><span>${esc(asset.provider || "Không dùng AI/Chưa khai báo")}</span><small>${asset.prompt ? "Có prompt" : "Chưa có prompt"}</small></td>
      <td><div class="mpr-provenance-stack"><small>SynthID ${provenanceBadge(asset.synthIdStatus)}</small><small>C2PA ${provenanceBadge(asset.c2paStatus)}</small></div></td>
      <td><strong class="mpr-score-text">${assetScore(asset)}%</strong></td>
      <td><div class="mpr-row-actions"><button type="button" data-mpr-action="edit-asset" data-id="${esc(asset.id)}">Sửa</button><button type="button" data-mpr-action="confirm-remove-asset" data-id="${esc(asset.id)}">Xóa</button></div></td>
    </tr>`).join("")}</tbody></table></div>`;
  }

  function lineageMarkup() {
    const groups = new Map();
    state.assets.forEach((asset) => {
      const provider = asset.provider || (asset.type === "ai" ? "Chưa khai báo provider" : "Tạo thủ công/không AI");
      groups.set(provider, (groups.get(provider) || 0) + 1);
    });
    if (!groups.size) return `<span>Chưa có dữ liệu lineage.</span>`;
    return [...groups.entries()].map(([provider, count]) => `<div><b>${esc(provider)}</b><span>${count} tài sản</span></div>`).join("");
  }

  function rightsPreflightMarkup() {
    const checks = rightsPreflight();
    const blocked = checks.filter((item) => !item.ok).length;
    return `<div class="mpr-preflight-summary"><div><small>RELEASE GATE</small><strong>${blocked ? `${blocked} mục đang chặn` : "Sẵn sàng kiểm duyệt"}</strong></div><span class="${blocked ? "is-blocked" : "is-ok"}">${blocked ? "BLOCKED" : "PASS"}</span></div><div class="mpr-checks">${checks.slice(0, 16).map((item) => `<div class="${item.ok ? "is-ok" : "is-blocked"}"><i aria-hidden="true">${item.ok ? "✓" : "!"}</i><span>${esc(item.label)}</span></div>`).join("")}</div>${checks.length > 16 ? `<small class="mpr-more-issues">Và ${checks.length - 16} mục khác trong manifest xuất ra.</small>` : ""}`;
  }

  function rightsViewMarkup() {
    const draft = state.rightsDraft;
    const score = overallRightsScore();
    return `<div class="mpr-rights-grid">
      <section class="mpr-panel mpr-rights-form" aria-labelledby="mpr-rights-form-title">
        <header class="mpr-panel-head"><div><small>ASSET LEDGER</small><h3 id="mpr-rights-form-title">${draft.id ? "Cập nhật tài sản" : "Thêm hồ sơ quyền"}</h3></div><button class="mpr-secondary" type="button" data-mpr-action="clear-rights-draft">Mới</button></header>
        <div class="mpr-form-grid">
          ${rightsField("Tên tài sản", "name", draft.name, 'placeholder="Ví dụ: Piano loop mở đầu"')}
          <label class="mpr-field"><span>Loại tài sản</span><select data-mpr-rights-field="type"><option value="original" ${draft.type === "original" ? "selected" : ""}>Sáng tác gốc</option><option value="sample" ${draft.type === "sample" ? "selected" : ""}>Sample</option><option value="ai" ${draft.type === "ai" ? "selected" : ""}>Nội dung AI</option><option value="voice" ${draft.type === "voice" ? "selected" : ""}>Giọng nói</option><option value="image" ${draft.type === "image" ? "selected" : ""}>Hình ảnh</option><option value="video" ${draft.type === "video" ? "selected" : ""}>Video</option><option value="font" ${draft.type === "font" ? "selected" : ""}>Font</option><option value="other" ${draft.type === "other" ? "selected" : ""}>Khác</option></select></label>
          ${rightsField("Nguồn hoặc URL", "source", draft.source, 'placeholder="Tệp gốc, website hoặc mã hóa đơn"')}
          ${rightsField("Tác giả / chủ sở hữu", "creator", draft.creator, 'placeholder="Tên cá nhân hoặc tổ chức"')}
          ${rightsField("Giấy phép", "license", draft.license, 'placeholder="Owned, CC BY, Commercial License..."')}
          ${rightsField("Bằng chứng quyền", "proof", draft.proof, 'placeholder="Hóa đơn, hợp đồng, URL hoặc mã biên nhận"')}
          ${rightsField("AI provider / model", "provider", draft.provider, 'placeholder="Ví dụ: Eleven Music, Lyria"')}
          ${rightsField("Lãnh thổ", "territory", draft.territory, 'placeholder="Worldwide hoặc quốc gia"')}
          ${rightsField("Đồng ý giọng/hình ảnh", "consent", draft.consent, 'placeholder="URL, mã văn bản đồng ý hoặc không áp dụng"')}
          ${rightsField("Ngày hết hạn", "expiry", draft.expiry, 'type="date"')}
          <label class="mpr-field"><span>SynthID</span><select data-mpr-rights-field="synthIdStatus"><option value="not-checked" ${draft.synthIdStatus === "not-checked" ? "selected" : ""}>Chưa kiểm tra</option><option value="declared" ${draft.synthIdStatus === "declared" ? "selected" : ""}>Provider khai báo</option><option value="detected" ${draft.synthIdStatus === "detected" ? "selected" : ""}>Ghi nhận từ công cụ ngoài</option></select></label>
          <label class="mpr-field"><span>C2PA</span><select data-mpr-rights-field="c2paStatus"><option value="not-checked" ${draft.c2paStatus === "not-checked" ? "selected" : ""}>Chưa kiểm tra</option><option value="declared" ${draft.c2paStatus === "declared" ? "selected" : ""}>Provider khai báo</option><option value="detected" ${draft.c2paStatus === "detected" ? "selected" : ""}>Ghi nhận từ công cụ ngoài</option></select></label>
          <label class="mpr-field mpr-field--wide"><span>Prompt / mô tả tạo</span><textarea rows="4" data-mpr-rights-field="prompt" placeholder="Lưu prompt để truy vết, không lưu API key">${esc(draft.prompt)}</textarea></label>
          <label class="mpr-field mpr-field--wide"><span>Ghi chú</span><textarea rows="3" data-mpr-rights-field="notes" placeholder="Điều khoản đặc biệt, credit bắt buộc...">${esc(draft.notes)}</textarea></label>
        </div>
        <p class="mpr-truth-note">“Đã phát hiện” chỉ ghi lại kết quả từ công cụ ngoài do người dùng cung cấp. HH không tự xác minh SynthID hoặc C2PA trong module này.</p>
        <div class="mpr-actions"><button class="mpr-primary" type="button" data-mpr-action="save-asset">${draft.id ? "Lưu thay đổi" : "Thêm vào sổ"}</button><button class="mpr-secondary" type="button" data-mpr-action="export-manifest">Xuất manifest JSON</button><label class="mpr-import-button">Nhập manifest<input type="file" accept="application/json,.json" data-mpr-import-manifest></label></div>
      </section>
      <aside class="mpr-panel mpr-rights-gate" aria-labelledby="mpr-rights-gate-title">
        <header class="mpr-panel-head"><div><small>RIGHTS SCORE</small><h3 id="mpr-rights-gate-title">Kiểm tra trước xuất bản</h3></div><div class="mpr-score-ring" style="--score:${score * 3.6}deg"><span>${score}%</span></div></header>
        ${rightsPreflightMarkup()}
        <fieldset class="mpr-acknowledgements"><legend>Xác nhận của chủ dự án</legend>
          <label><input type="checkbox" data-mpr-ack="ownership" ${state.acknowledgements.ownership ? "checked" : ""}><span>Tôi sở hữu hoặc có quyền sử dụng các tài sản này.</span></label>
          <label><input type="checkbox" data-mpr-ack="authorization" ${state.acknowledgements.authorization ? "checked" : ""}><span>Bằng chứng, provider và prompt được khai báo trung thực.</span></label>
          <label><input type="checkbox" data-mpr-ack="prohibitedContent" ${state.acknowledgements.prohibitedContent ? "checked" : ""}><span>Tôi đã kiểm tra nội dung bị cấm trước khi xuất bản.</span></label>
        </fieldset>
        <div class="mpr-warning-box"><strong>Không được phát hành</strong><ul><li>Nhạc/sample có bản quyền khi chưa được phép.</li><li>Giọng nói hoặc hình ảnh người khác khi thiếu đồng ý.</li><li>Nội dung giả mạo, lừa đảo hoặc cố tình che giấu nguồn AI.</li><li>Tài sản hết hạn hoặc vượt ngoài lãnh thổ cấp phép.</li></ul></div>
        <div class="mpr-lineage"><header><strong>Provider lineage</strong><span>Không chứa khóa API</span></header>${lineageMarkup()}</div>
        <button class="mpr-danger" type="button" data-mpr-action="confirm-reset-rights">Xóa toàn bộ sổ quyền</button>
      </aside>
      <section class="mpr-panel mpr-ledger" aria-labelledby="mpr-ledger-title"><header class="mpr-panel-head"><div><small>PROVENANCE LEDGER</small><h3 id="mpr-ledger-title">Tài sản và giấy phép</h3></div><b>${state.assets.length} tài sản</b></header>${assetLedgerMarkup()}</section>
    </div>`;
  }

  function dialogMarkup() {
    if (!confirmAction) return "";
    return `<div class="mpr-dialog-backdrop" data-mpr-dialog-backdrop><section class="mpr-dialog" role="alertdialog" aria-modal="true" aria-labelledby="mpr-dialog-title" aria-describedby="mpr-dialog-copy"><b aria-hidden="true">!</b><h3 id="mpr-dialog-title">Xác nhận thao tác</h3><p id="mpr-dialog-copy">${esc(confirmAction.message)}</p><div><button class="mpr-secondary" type="button" data-mpr-action="cancel-confirm">Hủy</button><button class="mpr-danger" type="button" data-mpr-action="execute-confirm">Xác nhận</button></div></section></div>`;
  }

  function render() {
    if (!host) return;
    if (publisherMounted) {
      window.HHYouTubePublisher?.unmount?.();
      publisherMounted = false;
    }
    host.innerHTML = `<section class="mpr-shell" data-mpr-view="${esc(view)}">
      <header class="mpr-hero"><div class="mpr-hero-mark" aria-hidden="true"><span>HH</span><i></i></div><div><small>MUSIC RELEASE OPERATIONS</small><h2>Publishing & Rights Center</h2><p>Chuẩn hóa metadata, điều phối upload và khóa cổng bản quyền trước khi phát hành.</p></div><div class="mpr-local-state"><i></i><span>Local-first</span><small>${esc(STORAGE_KEY)}</small></div></header>
      <nav class="mpr-tabs" aria-label="Không gian Publishing & Rights" role="tablist"><button type="button" role="tab" aria-selected="${view === "publish"}" class="${view === "publish" ? "is-active" : ""}" data-mpr-switch="publish"><i aria-hidden="true">⇧</i><span>Xuất bản</span><small>Queue · OAuth · Schedule</small></button><button type="button" role="tab" aria-selected="${view === "rights"}" class="${view === "rights" ? "is-active" : ""}" data-mpr-switch="rights"><i aria-hidden="true">§</i><span>Quyền & nguồn gốc</span><small>License · Proof · Lineage</small></button></nav>
      <main>${view === "rights" ? rightsViewMarkup() : publishViewMarkup()}</main>
      <footer class="mpr-footer"><span>Dữ liệu metadata nằm trên thiết bị này.</span><span>Không lưu mật khẩu, token OAuth, private message hoặc API secret.</span></footer>
      <div class="mpr-toast" data-mpr-toast role="status" aria-live="polite"></div>${dialogMarkup()}
    </section>`;
    if (publisherOpen && view === "publish" && window.HHYouTubePublisher?.mount) {
      const publisherHost = host.querySelector?.("[data-mpr-publisher-host]");
      if (publisherHost) {
        window.HHYouTubePublisher.mount(publisherHost, {
          ...(options.youtubePublisherOptions || {}),
          pack: {
            title: state.publishDraft.title,
            description: state.publishDraft.description,
            tags: state.publishDraft.tags
          },
          project: options.project || {}
        });
        publisherMounted = true;
      }
    }
    if (confirmAction) requestAnimationFrame(() => host?.querySelector?.("[data-mpr-action='cancel-confirm']")?.focus());
  }

  function updatePublishLive() {
    if (!host || view !== "publish") return;
    const draft = state.publishDraft;
    const title = host.querySelector?.("[data-mpr-title-count]");
    const description = host.querySelector?.("[data-mpr-description-count]");
    const tags = host.querySelector?.("[data-mpr-tags-count]");
    const checks = host.querySelector?.("[data-mpr-publish-checks]");
    if (title) title.textContent = `${draft.title.length}/100`;
    if (description) description.textContent = `${draft.description.length}/5000`;
    if (tags) tags.textContent = `${draft.tags.length}/500`;
    if (checks) checks.outerHTML = publishPreflightMarkup();
  }

  function setView(nextView) {
    if (!SUPPORTED_VIEWS.has(nextView)) return;
    view = nextView;
    publisherOpen = false;
    confirmAction = null;
    render();
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function exportManifest() {
    const checks = rightsPreflight();
    return {
      format: MANIFEST_FORMAT,
      version: MANIFEST_VERSION,
      exportedAt: isoNow(),
      project: cleanText(options.project?.title || options.project?.name || "HH Music Project", 200),
      declarations: clone(state.acknowledgements),
      summary: {
        assets: state.assets.length,
        completenessScore: overallRightsScore(),
        blockingIssues: checks.filter((item) => !item.ok).length
      },
      verificationNotice: "SynthID/C2PA statuses are user records or external-tool observations; HH did not independently verify them.",
      assets: clone(state.assets),
      preflight: checks
    };
  }

  function retryDelay(attempt) {
    return [5, 15, 60, 300, 900, 1800, 3600][Math.min(Math.max(0, attempt - 1), 6)];
  }

  function requestConfirm(type, id, message) {
    confirmAction = { type, id, message };
    render();
  }

  function executeConfirm() {
    const action = confirmAction;
    confirmAction = null;
    if (!action) return;
    if (action.type === "reset-publish") {
      state.publishDraft = normalizePublishDraft();
      state.queue = [];
      sessionFiles.video = sessionFiles.thumbnail = sessionFiles.caption = null;
      publisherOpen = false;
    }
    if (action.type === "reset-rights") {
      state.rightsDraft = normalizeRightsDraft();
      state.assets = [];
      state.acknowledgements = clone(DEFAULT_STATE.acknowledgements);
    }
    if (action.type === "remove-queue") state.queue = state.queue.filter((item) => item.id !== action.id);
    if (action.type === "remove-asset") state.assets = state.assets.filter((item) => item.id !== action.id);
    saveState();
    render();
    notify("Đã hoàn tất thao tác.");
  }

  function handlePublishField(target) {
    const key = target.dataset.mprPublishField;
    if (!key) return false;
    state.publishDraft[key] = target.type === "checkbox" ? target.checked : target.value;
    state.publishDraft = normalizePublishDraft(state.publishDraft);
    saveState();
    updatePublishLive();
    return true;
  }

  function handleRightsField(target) {
    const key = target.dataset.mprRightsField;
    if (!key) return false;
    state.rightsDraft[key] = target.value;
    state.rightsDraft = normalizeRightsDraft(state.rightsDraft);
    saveState();
    return true;
  }

  function handleInput(event) {
    if (handlePublishField(event.target)) return;
    handleRightsField(event.target);
  }

  function handleChange(event) {
    const target = event.target;
    if (target.matches?.("[data-mpr-file]")) {
      const kind = target.dataset.mprFile;
      const file = target.files?.[0];
      if (!file) return;
      if (kind === "thumbnail" && file.size > 2 * 1024 * 1024) {
        notify("Thumbnail vượt quá 2 MB.", "error");
        target.value = "";
        return;
      }
      if (kind === "caption" && !/\.(srt|vtt)$/i.test(file.name)) {
        notify("Phụ đề phải là tệp SRT hoặc VTT.", "error");
        target.value = "";
        return;
      }
      sessionFiles[kind] = file;
      if (kind === "video") {
        state.publishDraft.videoName = file.name;
        state.publishDraft.videoSize = file.size;
      } else if (kind === "thumbnail") {
        state.publishDraft.thumbnailName = file.name;
        state.publishDraft.thumbnailSize = file.size;
      } else {
        state.publishDraft.captionName = file.name;
      }
      saveState();
      render();
      notify(`Đã nhận ${file.name}.`);
      return;
    }
    if (target.matches?.("[data-mpr-import-manifest]")) return importManifest(target.files?.[0]);
    if (target.matches?.("[data-mpr-ack]")) {
      state.acknowledgements[target.dataset.mprAck] = target.checked;
      saveState();
      render();
      return;
    }
    const privacyChanged = target.dataset.mprPublishField === "privacy";
    if (handlePublishField(target) && privacyChanged) render();
    else handleRightsField(target);
  }

  async function importManifest(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.assets)) throw new Error("Manifest không có danh sách assets.");
      const imported = parsed.assets.slice(0, 500).map(normalizeRightsAsset);
      const byId = new Map(state.assets.map((asset) => [asset.id, asset]));
      imported.forEach((asset) => byId.set(asset.id, asset));
      state.assets = [...byId.values()].slice(0, 500);
      saveState();
      render();
      notify(`Đã nhập ${imported.length} tài sản. Dữ liệu trùng ID được cập nhật.`);
    } catch (error) {
      notify(error.message || "Không đọc được manifest.", "error");
    }
  }

  function handleClick(event) {
    const switcher = event.target.closest?.("[data-mpr-switch]");
    if (switcher) return setView(switcher.dataset.mprSwitch);
    const button = event.target.closest?.("[data-mpr-action]");
    if (!button) return;
    const action = button.dataset.mprAction;
    if (action === "launch-publisher") { publisherOpen = true; render(); return; }
    if (action === "close-publisher") { publisherOpen = false; render(); return; }
    if (action === "add-queue") {
      const failed = publishChecks().filter((item) => !item.ok);
      if (failed.length) return notify(`Chưa thể thêm: ${failed[0].label}.`, "error");
      const draft = normalizePublishDraft(state.publishDraft);
      state.queue.unshift(normalizeQueueItem({
        title: draft.title,
        status: draft.privacy === "schedule" ? "scheduled" : "ready",
        metadata: draft
      }));
      saveState(); render(); notify("Đã thêm bản phát hành vào hàng đợi cục bộ."); return;
    }
    if (action === "open-queue-item") {
      const item = state.queue.find((entry) => entry.id === button.dataset.id);
      if (item) { state.publishDraft = normalizePublishDraft(item.metadata); publisherOpen = true; saveState(); render(); }
      return;
    }
    if (action === "mark-queue-failed") {
      const item = state.queue.find((entry) => entry.id === button.dataset.id);
      if (item) { item.status = "failed"; item.note = "Trạng thái thử nghiệm cục bộ; chưa phải lỗi từ YouTube."; item.updatedAt = isoNow(); saveState(); render(); }
      return;
    }
    if (action === "retry-queue") {
      const item = state.queue.find((entry) => entry.id === button.dataset.id);
      if (!item) return;
      if (item.attempts >= item.metadata.retryLimit) { item.status = "blocked"; item.note = "Đã đạt giới hạn thử lại."; }
      else {
        item.attempts += 1;
        item.status = "ready";
        item.nextRetryAt = new Date(Date.now() + retryDelay(item.attempts) * 1000).toISOString();
        item.note = "Đã lập lịch thử lại cục bộ. Publisher sẽ xác nhận upload thật.";
      }
      item.updatedAt = isoNow(); saveState(); render(); return;
    }
    if (action === "export-queue") {
      downloadJson("hh-music-publishing-plan.json", { format: "hh-music-publishing-plan", version: 1, exportedAt: isoNow(), queue: state.queue });
      notify("Đã xuất kế hoạch hàng đợi."); return;
    }
    if (action === "save-asset") {
      const draft = normalizeRightsAsset(state.rightsDraft);
      if (!draft.name.trim()) return notify("Hãy nhập tên tài sản.", "error");
      const existing = state.assets.findIndex((asset) => asset.id === draft.id);
      draft.updatedAt = isoNow();
      if (existing >= 0) state.assets[existing] = draft;
      else state.assets.unshift({ ...draft, id: draft.id || uid("asset"), createdAt: isoNow() });
      state.rightsDraft = normalizeRightsDraft();
      saveState(); render(); notify("Đã lưu hồ sơ tài sản."); return;
    }
    if (action === "edit-asset") {
      const asset = state.assets.find((item) => item.id === button.dataset.id);
      if (asset) { state.rightsDraft = clone(asset); saveState(); render(); }
      return;
    }
    if (action === "clear-rights-draft") { state.rightsDraft = normalizeRightsDraft(); saveState(); render(); return; }
    if (action === "export-manifest") {
      downloadJson("hh-music-rights-manifest.json", exportManifest());
      notify("Đã xuất manifest kèm preflight."); return;
    }
    if (action === "confirm-reset-publish") return requestConfirm("reset-publish", "", "Xóa bản nháp và toàn bộ hàng đợi xuất bản trên thiết bị này?");
    if (action === "confirm-reset-rights") return requestConfirm("reset-rights", "", "Xóa toàn bộ sổ quyền và các xác nhận trên thiết bị này?");
    if (action === "confirm-remove-queue") return requestConfirm("remove-queue", button.dataset.id, "Xóa mục này khỏi hàng đợi cục bộ?");
    if (action === "confirm-remove-asset") return requestConfirm("remove-asset", button.dataset.id, "Xóa hồ sơ tài sản này khỏi sổ quyền?");
    if (action === "cancel-confirm") { confirmAction = null; render(); return; }
    if (action === "execute-confirm") executeConfirm();
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && confirmAction) { confirmAction = null; render(); return; }
    const tab = event.target.closest?.("[role='tab'][data-mpr-switch]");
    if (!tab || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    setView(tab.dataset.mprSwitch === "publish" ? "rights" : "publish");
    requestAnimationFrame(() => host?.querySelector?.("[role='tab'][aria-selected='true']")?.focus());
  }

  function supports(id) {
    return SUPPORTED_VIEWS.has(id);
  }

  function mount(nextHost, mountOptions = {}) {
    unmount();
    if (!nextHost) throw new TypeError("HHMusicPublishingRights.mount requires a host element.");
    host = nextHost;
    options = mountOptions || {};
    view = supports(options.view) ? options.view : "publish";
    state = loadState();
    controller = new AbortController();
    host.addEventListener("input", handleInput, { signal: controller.signal });
    host.addEventListener("change", handleChange, { signal: controller.signal });
    host.addEventListener("click", handleClick, { signal: controller.signal });
    host.addEventListener("keydown", handleKeydown, { signal: controller.signal });
    render();
  }

  function unmount() {
    controller?.abort();
    controller = null;
    if (publisherMounted) window.HHYouTubePublisher?.unmount?.();
    publisherMounted = false;
    publisherOpen = false;
    confirmAction = null;
    sessionFiles.video = sessionFiles.thumbnail = sessionFiles.caption = null;
    host = null;
    options = {};
  }

  window.HHMusicPublishingRights = Object.freeze({ supports, mount, unmount });
})();
