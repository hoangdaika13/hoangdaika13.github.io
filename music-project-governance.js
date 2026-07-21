(function musicProjectGovernance(globalScope) {
  "use strict";

  const STORAGE_KEY = "hh.music.project-governance.v1";
  const STATE_VERSION = 1;
  const MANIFEST_FORMAT = "hh-music-provenance-manifest";
  const MANIFEST_VERSION = 1;
  const SUPPORTED_VIEWS = new Set(["project-branches", "release-manager"]);
  const REVIEW_STATES = new Set(["draft", "in-review", "changes-requested", "approved"]);
  const MEMBER_ROLES = new Set(["view", "comment", "edit", "approve"]);
  const ASSET_TYPES = new Set(["master", "stem", "sample", "voice", "midi", "artwork", "video", "font", "other"]);
  const BLOCKED_CONTEXT_KEYS = /(?:token|credential|authorization|cookie|session|password|secret|private[-_ ]?key|client[-_ ]?key)/i;
  const REVIEW_LABELS = {
    draft: "Bản nháp",
    "in-review": "Đang duyệt",
    "changes-requested": "Yêu cầu sửa",
    approved: "Đã duyệt"
  };
  const ROLE_LABELS = { view: "Chỉ xem", comment: "Bình luận", edit: "Biên tập", approve: "Phê duyệt" };

  let activeHost = null;
  let activeView = "project-branches";
  let activeOptions = {};
  let state = null;
  let controller = null;
  let realtimeUnsubscribe = null;
  let realtimeState = localRealtimeState();
  let pendingRestoreId = "";
  let toastTimer = 0;

  const nowIso = () => new Date().toISOString();
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);

  function text(value, max = 500) {
    return String(value == null ? "" : value).replace(/\u0000/g, "").trim().slice(0, max);
  }

  function boundedNumber(value, fallback, min, max) {
    const numeric = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(numeric) ? numeric : fallback));
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Chưa xác định";
    return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
  }

  function formatTimestamp(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const remainder = Math.floor(safe % 60);
    return hours
      ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
      : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  function timestampSeconds(value) {
    const raw = text(value, 16);
    if (/^\d+(?:\.\d+)?$/.test(raw)) return boundedNumber(raw, 0, 0, 864000);
    const parts = raw.split(":").map(Number);
    if (!parts.length || parts.some((part) => !Number.isFinite(part) || part < 0)) return 0;
    if (parts.length === 2) return boundedNumber(parts[0] * 60 + parts[1], 0, 0, 864000);
    if (parts.length === 3) return boundedNumber(parts[0] * 3600 + parts[1] * 60 + parts[2], 0, 0, 864000);
    return 0;
  }

  function safeContextValue(value, depth = 0) {
    if (depth > 7 || value == null) return value == null ? null : undefined;
    if (typeof value === "string") return value.slice(0, 4000);
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.slice(0, 250).map((item) => safeContextValue(item, depth + 1)).filter((item) => item !== undefined);
    if (typeof value !== "object") return undefined;
    const output = {};
    Object.keys(value).slice(0, 150).forEach((key) => {
      if (BLOCKED_CONTEXT_KEYS.test(key)) return;
      const next = safeContextValue(value[key], depth + 1);
      if (next !== undefined) output[text(key, 100)] = next;
    });
    return output;
  }

  function captureProjectContext() {
    const context = globalScope.HHMusicProjectContext;
    if (!context || typeof context.getSnapshot !== "function") return null;
    try {
      const raw = context.getSnapshot();
      if (!raw || typeof raw !== "object") return null;
      let data = safeContextValue(raw);
      let serialized = JSON.stringify(data);
      let truncated = false;
      if (serialized.length > 240000) {
        data = safeContextValue({ chordTrack: raw.chordTrack, songDNA: raw.songDNA, bpm: raw.bpm, key: raw.key });
        serialized = JSON.stringify(data);
        truncated = true;
      }
      return {
        source: "HHMusicProjectContext",
        capturedAt: nowIso(),
        truncated,
        bytes: serialized.length,
        data
      };
    } catch (_error) {
      return null;
    }
  }

  function contextCapability() {
    const context = globalScope.HHMusicProjectContext;
    return {
      snapshot: Boolean(context && typeof context.getSnapshot === "function"),
      chordTrack: Boolean(context && typeof context.updateChordTrack === "function"),
      songDNA: Boolean(context && typeof context.updateSongDNA === "function")
    };
  }

  function normalizeComment(value = {}) {
    return {
      id: text(value.id || uid("comment"), 90),
      author: text(value.author || "Bạn", 100),
      body: text(value.body, 1200),
      timestamp: boundedNumber(value.timestamp, 0, 0, 864000),
      resolved: Boolean(value.resolved),
      createdAt: text(value.createdAt || nowIso(), 40)
    };
  }

  function normalizeMember(value = {}) {
    const role = MEMBER_ROLES.has(value.role) ? value.role : "view";
    return {
      id: text(value.id || uid("member"), 90),
      name: text(value.name || "Thành viên", 100),
      role,
      avatar: text(value.avatar || value.name || "TV", 4).toUpperCase()
    };
  }

  function normalizeLock(value = {}) {
    return {
      id: text(value.id || uid("lock"), 90),
      track: text(value.track || "Track", 120),
      owner: text(value.owner || "Bạn", 100),
      createdAt: text(value.createdAt || nowIso(), 40)
    };
  }

  function normalizeContextAttachment(value) {
    if (!value || typeof value !== "object") return null;
    const data = safeContextValue(value.data || {});
    return {
      source: "HHMusicProjectContext",
      capturedAt: text(value.capturedAt || nowIso(), 40),
      truncated: Boolean(value.truncated),
      bytes: Math.max(0, Number(value.bytes) || JSON.stringify(data).length),
      data
    };
  }

  function normalizeSnapshot(value = {}) {
    return {
      id: text(value.id || uid("snapshot"), 90),
      name: text(value.name || "Snapshot", 140),
      note: text(value.note, 800),
      createdBy: text(value.createdBy || "Bạn", 100),
      createdAt: text(value.createdAt || nowIso(), 40),
      reviewState: REVIEW_STATES.has(value.reviewState) ? value.reviewState : "draft",
      loudness: {
        integratedLufs: boundedNumber(value.loudness?.integratedLufs, -14, -70, 3),
        truePeakDb: boundedNumber(value.loudness?.truePeakDb, -1, -30, 6),
        rangeLu: boundedNumber(value.loudness?.rangeLu, 8, 0, 40)
      },
      projectContext: normalizeContextAttachment(value.projectContext)
    };
  }

  function normalizeBranch(value = {}) {
    const members = Array.isArray(value.members) ? value.members.slice(0, 40).map(normalizeMember) : [];
    return {
      id: text(value.id || uid("branch"), 90),
      name: text(value.name || "Nhánh mới", 120),
      purpose: text(value.purpose, 500),
      color: /^#[0-9a-f]{6}$/i.test(value.color || "") ? value.color : "#62d7e7",
      sourceBranchId: text(value.sourceBranchId, 90),
      reviewState: REVIEW_STATES.has(value.reviewState) ? value.reviewState : "draft",
      loudness: {
        integratedLufs: boundedNumber(value.loudness?.integratedLufs, -14, -70, 3),
        truePeakDb: boundedNumber(value.loudness?.truePeakDb, -1, -30, 6),
        rangeLu: boundedNumber(value.loudness?.rangeLu, 8, 0, 40)
      },
      snapshots: Array.isArray(value.snapshots) ? value.snapshots.slice(0, 80).map(normalizeSnapshot) : [],
      comments: Array.isArray(value.comments) ? value.comments.slice(0, 300).map(normalizeComment) : [],
      members: members.length ? members : [normalizeMember({ name: "Bạn", role: "approve", avatar: "B" })],
      trackLocks: Array.isArray(value.trackLocks) ? value.trackLocks.slice(0, 100).map(normalizeLock) : [],
      updatedAt: text(value.updatedAt || nowIso(), 40)
    };
  }

  function normalizeRightsAsset(value = {}) {
    return {
      id: text(value.id || uid("asset"), 90),
      name: text(value.name || "Tài sản", 160),
      type: ASSET_TYPES.has(value.type) ? value.type : "other",
      source: text(value.source, 1000),
      license: text(value.license, 300),
      owner: text(value.owner, 200),
      provider: text(value.provider, 200),
      prompt: text(value.prompt, 4000),
      consent: text(value.consent, 1000),
      proof: text(value.proof, 1000),
      createdAt: text(value.createdAt || nowIso(), 40)
    };
  }

  function normalizeSplit(value = {}) {
    return {
      id: text(value.id || uid("split"), 90),
      name: text(value.name || "", 120),
      role: text(value.role || "Tác giả", 100),
      percent: boundedNumber(value.percent, 0, 0, 100)
    };
  }

  function normalizeRelease(value = {}) {
    return {
      title: text(value.title, 160),
      versionName: text(value.versionName || "Original", 100),
      isrc: text(value.isrc, 24).toUpperCase().replace(/[-\s]/g, ""),
      artist: text(value.artist, 160),
      album: text(value.album, 160),
      writers: text(value.writers, 500),
      label: text(value.label, 160),
      releaseDate: text(value.releaseDate, 20),
      notes: text(value.notes, 2000),
      status: ["draft", "ready", "published"].includes(value.status) ? value.status : "draft",
      splits: Array.isArray(value.splits) ? value.splits.slice(0, 40).map(normalizeSplit) : [],
      assets: Array.isArray(value.assets) ? value.assets.slice(0, 500).map(normalizeRightsAsset) : [],
      acknowledgements: {
        rights: Boolean(value.acknowledgements?.rights),
        consent: Boolean(value.acknowledgements?.consent),
        metadata: Boolean(value.acknowledgements?.metadata),
        restricted: Boolean(value.acknowledgements?.restricted)
      },
      updatedAt: text(value.updatedAt || nowIso(), 40)
    };
  }

  function branchTemplate(name, purpose, color, lufs) {
    return normalizeBranch({
      id: `branch-${name.toLowerCase().replace(/\s+/g, "-")}`,
      name,
      purpose,
      color,
      loudness: { integratedLufs: lufs, truePeakDb: -1, rangeLu: name === "Acoustic" ? 12 : 8 },
      members: [{ name: "Bạn", role: "approve", avatar: "B" }]
    });
  }

  function defaultState() {
    const branches = [
      branchTemplate("Radio Mix", "Bản cân bằng cho radio và streaming.", "#62d7e7", -14),
      branchTemplate("Acoustic", "Phối khí mộc, giữ dynamic và không gian biểu diễn.", "#b9e36b", -16),
      branchTemplate("TikTok", "Hook ngắn, năng lượng cao và tối ưu video dọc.", "#f05caf", -12)
    ];
    return {
      version: STATE_VERSION,
      selectedBranchId: branches[0].id,
      comparison: { baseId: branches[0].id, candidateId: branches[1].id, targetLufs: -14 },
      branches,
      release: normalizeRelease({}),
      audit: [],
      updatedAt: nowIso()
    };
  }

  function normalizeAudit(value = {}) {
    return {
      id: text(value.id || uid("audit"), 90),
      actor: text(value.actor || "Bạn", 100),
      action: text(value.action, 160),
      target: text(value.target, 160),
      reason: text(value.reason, 500),
      before: text(value.before, 500),
      after: text(value.after, 500),
      createdAt: text(value.createdAt || nowIso(), 40)
    };
  }

  function normalizeState(value = {}) {
    const fallback = defaultState();
    const source = value && typeof value === "object" ? value : {};
    const branches = Array.isArray(source.branches) && source.branches.length
      ? source.branches.slice(0, 30).map(normalizeBranch)
      : fallback.branches;
    const branchIds = new Set(branches.map((branch) => branch.id));
    const selectedBranchId = branchIds.has(source.selectedBranchId) ? source.selectedBranchId : branches[0].id;
    const baseId = branchIds.has(source.comparison?.baseId) ? source.comparison.baseId : branches[0].id;
    const candidateId = branchIds.has(source.comparison?.candidateId) ? source.comparison.candidateId : (branches[1]?.id || branches[0].id);
    return {
      version: STATE_VERSION,
      selectedBranchId,
      comparison: {
        baseId,
        candidateId,
        targetLufs: boundedNumber(source.comparison?.targetLufs, -14, -30, -5)
      },
      branches,
      release: normalizeRelease(source.release || {}),
      audit: Array.isArray(source.audit) ? source.audit.slice(0, 400).map(normalizeAudit) : [],
      updatedAt: text(source.updatedAt || nowIso(), 40)
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(globalScope.localStorage?.getItem(STORAGE_KEY) || "null");
      return normalizeState(saved || defaultState());
    } catch (_error) {
      return defaultState();
    }
  }

  function persist() {
    state.version = STATE_VERSION;
    state.updatedAt = nowIso();
    try { globalScope.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_error) { /* Local persistence can be unavailable in private mode. */ }
  }

  function audit(action, target, before = "", after = "", reason = "") {
    const actor = text(activeOptions.actor?.name || "Bạn", 100);
    state.audit.unshift(normalizeAudit({ actor, action, target, before, after, reason }));
    state.audit = state.audit.slice(0, 400);
  }

  function selectedBranch() {
    return state.branches.find((branch) => branch.id === state.selectedBranchId) || state.branches[0];
  }

  function supports(viewId) {
    return SUPPORTED_VIEWS.has(viewId);
  }

  function localRealtimeState() {
    return {
      mode: "local-only",
      label: "Chỉ cục bộ",
      detail: "Chưa có realtime adapter; dữ liệu chỉ được lưu trên thiết bị này."
    };
  }

  function setupRealtime(adapter) {
    realtimeState = localRealtimeState();
    realtimeUnsubscribe = null;
    if (!adapter || typeof adapter.publish !== "function" || typeof adapter.subscribe !== "function") return;
    realtimeState = {
      mode: adapter.connected === true ? "connected" : "adapter-ready",
      label: adapter.connected === true ? "Đã kết nối realtime" : "Adapter sẵn sàng",
      detail: adapter.connected === true
        ? "Sự kiện dự án đang được đồng bộ qua adapter đã xác nhận kết nối."
        : "Adapter có publish/subscribe nhưng chưa xác nhận kết nối mạng."
    };
    try {
      const unsubscribe = adapter.subscribe("music-project-governance", (event) => {
        if (!event || event.origin === activeOptions.clientId || !event.state) return;
        state = normalizeState(event.state);
        persist();
        render();
        notify("Đã nhận thay đổi từ adapter realtime.", "success");
      });
      if (typeof unsubscribe === "function") realtimeUnsubscribe = unsubscribe;
    } catch (_error) {
      realtimeState = { mode: "adapter-error", label: "Adapter gặp lỗi", detail: "Không thể đăng ký kênh realtime; tiếp tục làm việc cục bộ." };
    }
  }

  function broadcast(action) {
    const adapter = activeOptions.realtimeAdapter;
    if (!adapter || typeof adapter.publish !== "function") return;
    try {
      const result = adapter.publish("music-project-governance", {
        origin: activeOptions.clientId || "",
        action,
        state: clone(state),
        sentAt: nowIso()
      });
      if (result && typeof result.catch === "function") result.catch(() => {
        realtimeState = { mode: "adapter-error", label: "Không thể đồng bộ", detail: "Thay đổi vẫn được lưu cục bộ." };
        renderRealtimeBadge();
      });
    } catch (_error) {
      realtimeState = { mode: "adapter-error", label: "Không thể đồng bộ", detail: "Thay đổi vẫn được lưu cục bộ." };
    }
  }

  function commit(action) {
    persist();
    broadcast(action);
    render();
  }

  function renderRealtimeBadge() {
    const badge = activeHost?.querySelector?.("[data-mpg-realtime]");
    if (!badge) return;
    badge.dataset.mode = realtimeState.mode;
    badge.innerHTML = `<i aria-hidden="true"></i><span><strong>${esc(realtimeState.label)}</strong><small>${esc(realtimeState.detail)}</small></span>`;
  }

  function comparisonData() {
    const base = state.branches.find((branch) => branch.id === state.comparison.baseId) || state.branches[0];
    const candidate = state.branches.find((branch) => branch.id === state.comparison.candidateId) || state.branches[0];
    const target = state.comparison.targetLufs;
    const normalize = (branch) => {
      const gain = target - branch.loudness.integratedLufs;
      return {
        branch,
        sourceLufs: branch.loudness.integratedLufs,
        gain,
        normalizedLufs: target,
        projectedPeak: branch.loudness.truePeakDb + gain,
        rangeLu: branch.loudness.rangeLu
      };
    };
    return { base: normalize(base), candidate: normalize(candidate), target };
  }

  function branchOptions(selectedId) {
    return state.branches.map((branch) => `<option value="${esc(branch.id)}" ${branch.id === selectedId ? "selected" : ""}>${esc(branch.name)}</option>`).join("");
  }

  function reviewOptions(selected) {
    return Object.entries(REVIEW_LABELS).map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
  }

  function roleOptions(selected) {
    return Object.entries(ROLE_LABELS).map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
  }

  function shellMarkup() {
    return `
      <section class="mpg-shell" data-mpg-view="${esc(activeView)}" aria-label="Quản trị dự án và phát hành âm nhạc">
        <header class="mpg-hero">
          <div class="mpg-hero-mark" aria-hidden="true">PG</div>
          <div><small>HH MUSIC / GOVERNANCE</small><h2>Project, Review & Release</h2><p>Phiên bản, cộng tác, quyền tài sản và cổng phát hành trong một quy trình có kiểm soát.</p></div>
          <div class="mpg-realtime" data-mpg-realtime data-mode="${esc(realtimeState.mode)}"><i aria-hidden="true"></i><span><strong>${esc(realtimeState.label)}</strong><small>${esc(realtimeState.detail)}</small></span></div>
        </header>
        <nav class="mpg-tabs" role="tablist" aria-label="Workspace quản trị">
          <button type="button" role="tab" aria-selected="${activeView === "project-branches"}" class="${activeView === "project-branches" ? "is-active" : ""}" data-action="switch-view" data-view="project-branches"><span>BR</span><strong>Project Branches</strong><small>Snapshot, review, compare</small></button>
          <button type="button" role="tab" aria-selected="${activeView === "release-manager"}" class="${activeView === "release-manager" ? "is-active" : ""}" data-action="switch-view" data-view="release-manager"><span>RM</span><strong>Release Manager</strong><small>Rights, metadata, publish gate</small></button>
        </nav>
        <main>${activeView === "release-manager" ? releaseMarkup() : branchesMarkup()}</main>
        <div class="mpg-toast" data-mpg-toast role="status" aria-live="polite"></div>
        ${pendingRestoreMarkup()}
      </section>`;
  }

  function branchCardMarkup(branch) {
    const unresolved = branch.comments.filter((comment) => !comment.resolved).length;
    return `<button type="button" class="mpg-branch-card ${branch.id === state.selectedBranchId ? "is-active" : ""}" data-action="select-branch" data-id="${esc(branch.id)}" style="--branch:${esc(branch.color)}">
      <span class="mpg-branch-dot" aria-hidden="true"></span><span><strong>${esc(branch.name)}</strong><small>${esc(REVIEW_LABELS[branch.reviewState])} · ${branch.snapshots.length} snapshot</small></span><b>${unresolved}</b>
    </button>`;
  }

  function branchesMarkup() {
    const branch = selectedBranch();
    const comparison = comparisonData();
    const capabilities = contextCapability();
    return `
      <div class="mpg-branches-layout">
        <aside class="mpg-panel mpg-branch-library">
          <div class="mpg-panel-head"><div><small>BRANCH LIBRARY</small><h3>Phiên bản dự án</h3></div><b>${state.branches.length}</b></div>
          <div class="mpg-template-row" aria-label="Tạo nhánh theo mẫu">
            <button type="button" data-action="create-branch" data-template="Radio Mix">+ Radio</button>
            <button type="button" data-action="create-branch" data-template="Acoustic">+ Acoustic</button>
            <button type="button" data-action="create-branch" data-template="TikTok">+ TikTok</button>
          </div>
          <div class="mpg-branch-list">${state.branches.map(branchCardMarkup).join("")}</div>
          <div class="mpg-context-capability">
            <strong>Project Context</strong>
            <span class="${capabilities.snapshot ? "is-ready" : ""}"><i></i>${capabilities.snapshot ? "Đính kèm khi tạo snapshot" : "Chưa có getSnapshot()"}</span>
            <small>Restore được giới hạn ở Chord Track và Song DNA, luôn cần xác nhận.</small>
          </div>
        </aside>

        <section class="mpg-workspace">
          <form class="mpg-panel mpg-branch-editor" data-form="branch-editor">
            <div class="mpg-panel-head"><div><small>ACTIVE BRANCH</small><h3>${esc(branch.name)}</h3></div><span class="mpg-review" data-state="${esc(branch.reviewState)}">${esc(REVIEW_LABELS[branch.reviewState])}</span></div>
            <div class="mpg-form-grid">
              <label><span>Tên nhánh</span><input name="name" value="${esc(branch.name)}" maxlength="120" required></label>
              <label><span>Trạng thái review</span><select name="reviewState">${reviewOptions(branch.reviewState)}</select></label>
              <label class="is-wide"><span>Mục tiêu phiên bản</span><textarea name="purpose" rows="2" maxlength="500">${esc(branch.purpose)}</textarea></label>
              <label><span>Integrated LUFS</span><input name="integratedLufs" type="number" min="-70" max="3" step="0.1" value="${branch.loudness.integratedLufs}"></label>
              <label><span>True Peak dBTP</span><input name="truePeakDb" type="number" min="-30" max="6" step="0.1" value="${branch.loudness.truePeakDb}"></label>
              <label><span>Loudness Range LU</span><input name="rangeLu" type="number" min="0" max="40" step="0.1" value="${branch.loudness.rangeLu}"></label>
              <label><span>Màu nhánh</span><input name="color" type="color" value="${esc(branch.color)}"></label>
            </div>
            <div class="mpg-actions"><button class="mpg-primary" type="submit">Lưu nhánh</button><span>Cập nhật ${esc(formatDate(branch.updatedAt))}</span></div>
          </form>

          <section class="mpg-panel mpg-snapshots">
            <div class="mpg-panel-head"><div><small>VERSION HISTORY</small><h3>Snapshot không phá hủy</h3></div><button type="button" class="mpg-secondary" data-action="create-snapshot">+ Tạo snapshot</button></div>
            <p class="mpg-truth-note">Nếu <code>HHMusicProjectContext.getSnapshot()</code> khả dụng, Chord Track và Song DNA hiện tại sẽ được đính kèm. Không có dữ liệu nào tự động được phục hồi.</p>
            <div class="mpg-snapshot-list">${branch.snapshots.length ? branch.snapshots.map((snapshot) => `
              <article class="mpg-snapshot-item">
                <span class="mpg-snapshot-icon">${snapshot.projectContext ? "CTX" : "LOCAL"}</span>
                <div><strong>${esc(snapshot.name)}</strong><small>${esc(formatDate(snapshot.createdAt))} · ${esc(snapshot.createdBy)}</small><p>${esc(snapshot.note || "Không có ghi chú")}</p></div>
                <dl><div><dt>LUFS</dt><dd>${snapshot.loudness.integratedLufs.toFixed(1)}</dd></div><div><dt>Peak</dt><dd>${snapshot.loudness.truePeakDb.toFixed(1)}</dd></div></dl>
                <button type="button" class="mpg-secondary" data-action="request-restore" data-id="${esc(snapshot.id)}" ${snapshot.projectContext ? "" : "disabled"}>Phục hồi context</button>
              </article>`).join("") : `<div class="mpg-empty"><b>SN</b><strong>Chưa có snapshot</strong><span>Tạo một mốc an toàn trước khi thay đổi bản phối.</span></div>`}</div>
          </section>

          <section class="mpg-panel mpg-compare">
            <div class="mpg-panel-head"><div><small>LOUDNESS-MATCHED</small><h3>So sánh phiên bản</h3></div><span>Không thay đổi audio gốc</span></div>
            <div class="mpg-compare-controls">
              <label>Gốc<select data-field="compare-base">${branchOptions(state.comparison.baseId)}</select></label>
              <label>Ứng viên<select data-field="compare-candidate">${branchOptions(state.comparison.candidateId)}</select></label>
              <label>Mục tiêu LUFS<input data-field="compare-target" type="number" min="-30" max="-5" step="0.1" value="${state.comparison.targetLufs}"></label>
            </div>
            <div class="mpg-compare-grid">
              ${[comparison.base, comparison.candidate].map((item, index) => `<article><small>${index ? "ỨNG VIÊN" : "THAM CHIẾU"}</small><h4>${esc(item.branch.name)}</h4><div class="mpg-meter"><i style="--level:${Math.max(8, Math.min(100, (70 + item.sourceLufs) * 1.42))}%"></i></div><dl><div><dt>Nguồn</dt><dd>${item.sourceLufs.toFixed(1)} LUFS</dd></div><div><dt>Gain nghe thử</dt><dd>${item.gain >= 0 ? "+" : ""}${item.gain.toFixed(1)} dB</dd></div><div><dt>Peak dự kiến</dt><dd class="${item.projectedPeak > -1 ? "is-warning" : ""}">${item.projectedPeak.toFixed(1)} dBTP</dd></div><div><dt>Dynamic</dt><dd>${item.rangeLu.toFixed(1)} LU</dd></div></dl></article>`).join("")}
            </div>
            <p class="mpg-truth-note">Đây là metadata loudness-normalized để so sánh công bằng; module không tuyên bố đã render hoặc thay đổi gain của file audio.</p>
          </section>

          ${commentsMarkup(branch)}
        </section>

        <aside class="mpg-side-stack">
          ${membersMarkup(branch)}
          ${locksMarkup(branch)}
          ${auditMarkup()}
        </aside>
      </div>`;
  }

  function commentsMarkup(branch) {
    return `<section class="mpg-panel mpg-comments">
      <div class="mpg-panel-head"><div><small>TIMECODE REVIEW</small><h3>Bình luận theo thời điểm</h3></div><b>${branch.comments.filter((item) => !item.resolved).length} mở</b></div>
      <form class="mpg-comment-form" data-form="comment"><label><span>Timecode</span><input name="timestamp" value="00:00" placeholder="01:24"></label><label><span>Nội dung</span><input name="body" maxlength="1200" placeholder="Góp ý đúng vị trí trên timeline..." required></label><button class="mpg-primary" type="submit">Gửi</button></form>
      <div class="mpg-comment-list">${branch.comments.length ? branch.comments.map((comment) => `<article class="${comment.resolved ? "is-resolved" : ""}"><time>${esc(formatTimestamp(comment.timestamp))}</time><div><strong>${esc(comment.author)}</strong><p>${esc(comment.body)}</p><small>${esc(formatDate(comment.createdAt))}</small></div><button type="button" data-action="toggle-comment" data-id="${esc(comment.id)}">${comment.resolved ? "Mở lại" : "Đã xử lý"}</button></article>`).join("") : `<div class="mpg-empty is-compact"><span>Chưa có bình luận trên timeline.</span></div>`}</div>
    </section>`;
  }

  function membersMarkup(branch) {
    return `<section class="mpg-panel mpg-members"><div class="mpg-panel-head"><div><small>ACCESS</small><h3>Thành viên</h3></div><b>${branch.members.length}</b></div>
      <form class="mpg-inline-form" data-form="member"><input name="name" maxlength="100" placeholder="Tên thành viên" required><select name="role">${roleOptions("view")}</select><button type="submit" aria-label="Thêm thành viên">+</button></form>
      <div class="mpg-member-list">${branch.members.map((member) => `<article><span>${esc(member.avatar)}</span><div><strong>${esc(member.name)}</strong><small>${esc(ROLE_LABELS[member.role])}</small></div><select data-action="member-role" data-id="${esc(member.id)}" aria-label="Quyền của ${esc(member.name)}">${roleOptions(member.role)}</select></article>`).join("")}</div>
    </section>`;
  }

  function locksMarkup(branch) {
    return `<section class="mpg-panel mpg-locks"><div class="mpg-panel-head"><div><small>TRACK SAFETY</small><h3>Khóa track</h3></div><b>${branch.trackLocks.length}</b></div>
      <form class="mpg-inline-form" data-form="track-lock"><input name="track" maxlength="120" placeholder="Vocal Lead, Drum Bus..." required><button type="submit">Khóa</button></form>
      <div class="mpg-lock-list">${branch.trackLocks.length ? branch.trackLocks.map((lock) => `<article><i aria-hidden="true">L</i><div><strong>${esc(lock.track)}</strong><small>${esc(lock.owner)} · ${esc(formatDate(lock.createdAt))}</small></div><button type="button" data-action="unlock-track" data-id="${esc(lock.id)}" aria-label="Mở khóa ${esc(lock.track)}">Mở</button></article>`).join("") : `<div class="mpg-empty is-compact"><span>Không có track đang khóa.</span></div>`}</div>
    </section>`;
  }

  function auditMarkup() {
    return `<section class="mpg-panel mpg-audit"><div class="mpg-panel-head"><div><small>LOCAL AUDIT</small><h3>Nhật ký thay đổi</h3></div><b>${state.audit.length}</b></div><div class="mpg-audit-list">${state.audit.length ? state.audit.slice(0, 30).map((entry) => `<article><i></i><div><strong>${esc(entry.action)}</strong><p>${esc(entry.target)}</p><small>${esc(entry.actor)} · ${esc(formatDate(entry.createdAt))}</small></div></article>`).join("") : `<div class="mpg-empty is-compact"><span>Thay đổi mới sẽ xuất hiện tại đây.</span></div>`}</div><p class="mpg-truth-note">Audit này chỉ lưu cục bộ, không phải log máy chủ bất biến.</p></section>`;
  }

  function releaseChecks() {
    const release = state.release;
    const checks = [];
    const add = (key, ok, label, type = "blocking") => checks.push({ key, ok: Boolean(ok), label, type });
    add("title", release.title.length > 0, "Có tên bản phát hành");
    add("artist", release.artist.length > 0, "Có tên nghệ sĩ");
    add("album", release.album.length > 0, "Có album hoặc tên single");
    add("writers", release.writers.length > 0, "Có thông tin tác giả");
    add("isrc", /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(release.isrc), "ISRC gồm 12 ký tự hợp lệ");
    add("splits", release.splits.length > 0, "Có ít nhất một người hưởng split");
    const splitTotal = release.splits.reduce((sum, split) => sum + split.percent, 0);
    add("split-total", Math.abs(splitTotal - 100) < 0.01, `Tổng split bằng 100% (hiện ${splitTotal.toFixed(2)}%)`);
    release.splits.forEach((split) => add(`split-${split.id}`, split.name && split.percent > 0, `Split ${split.name || "chưa đặt tên"} có tên và tỷ lệ`));
    add("assets", release.assets.length > 0, "Có ít nhất một asset trong sổ quyền");
    release.assets.forEach((asset) => {
      add(`asset-${asset.id}`, asset.name && asset.source && asset.license && asset.owner, `${asset.name || "Asset"}: đủ nguồn, giấy phép và chủ sở hữu`);
      if (asset.provider || asset.prompt) add(`provider-${asset.id}`, asset.provider && asset.prompt, `${asset.name || "Asset"}: đủ provider và prompt AI`);
      if (asset.type === "voice") add(`consent-${asset.id}`, asset.consent, `${asset.name || "Voice"}: có bằng chứng đồng ý`);
    });
    add("ack-rights", release.acknowledgements.rights, "Đã xác nhận quyền sử dụng tất cả asset");
    add("ack-consent", release.acknowledgements.consent, "Đã xác nhận consent cho giọng nói và hình ảnh");
    add("ack-metadata", release.acknowledgements.metadata, "Đã kiểm tra metadata và split");
    add("ack-restricted", release.acknowledgements.restricted, "Đã kiểm tra nội dung hạn chế và giả mạo");
    if (!release.releaseDate) add("date", false, "Chưa đặt ngày phát hành", "warning");
    return checks;
  }

  function releaseMarkup() {
    const release = state.release;
    const checks = releaseChecks();
    const blocking = checks.filter((check) => check.type === "blocking" && !check.ok);
    const score = Math.round((checks.filter((check) => check.ok).length / checks.length) * 100);
    return `<div class="mpg-release-layout">
      <section class="mpg-release-main">
        <form class="mpg-panel mpg-release-form" data-form="release-metadata">
          <div class="mpg-panel-head"><div><small>RELEASE METADATA</small><h3>Thông tin bản phát hành</h3></div><span class="mpg-release-status" data-status="${esc(release.status)}">${release.status === "ready" ? "Sẵn sàng nội bộ" : "Bản nháp"}</span></div>
          <div class="mpg-form-grid">
            <label class="is-wide"><span>Tên bản phát hành</span><input name="title" maxlength="160" value="${esc(release.title)}" required></label>
            <label><span>Phiên bản</span><input name="versionName" maxlength="100" value="${esc(release.versionName)}"></label>
            <label><span>ISRC</span><input name="isrc" maxlength="15" value="${esc(release.isrc)}" placeholder="VNABC2600001"></label>
            <label><span>Nghệ sĩ</span><input name="artist" maxlength="160" value="${esc(release.artist)}" required></label>
            <label><span>Album / Single</span><input name="album" maxlength="160" value="${esc(release.album)}" required></label>
            <label class="is-wide"><span>Tác giả</span><input name="writers" maxlength="500" value="${esc(release.writers)}" placeholder="Nguyễn A, Trần B"></label>
            <label><span>Label</span><input name="label" maxlength="160" value="${esc(release.label)}"></label>
            <label><span>Ngày phát hành</span><input name="releaseDate" type="date" value="${esc(release.releaseDate)}"></label>
            <label class="is-wide"><span>Ghi chú phát hành</span><textarea name="notes" rows="3" maxlength="2000">${esc(release.notes)}</textarea></label>
          </div><div class="mpg-actions"><button class="mpg-primary" type="submit">Lưu metadata</button><span>Không chứa thông tin đăng nhập hoặc khóa dịch vụ.</span></div>
        </form>

        ${splitsMarkup(release)}
        ${assetsMarkup(release)}
      </section>

      <aside class="mpg-release-side">
        <section class="mpg-panel mpg-preflight"><div class="mpg-panel-head"><div><small>PREFLIGHT</small><h3>Cổng phát hành</h3></div><div class="mpg-score" style="--score:${score}%"><span>${score}%</span></div></div>
          <div class="mpg-gate-summary"><strong>${blocking.length ? `${blocking.length} mục đang chặn` : "Đủ điều kiện nội bộ"}</strong><small>Cổng này không tự phân phối nhạc và không thay thế kiểm duyệt của nền tảng.</small></div>
          <div class="mpg-check-list">${checks.map((check) => `<div class="${check.ok ? "is-ok" : check.type === "warning" ? "is-warning" : "is-blocked"}"><i>${check.ok ? "✓" : check.type === "warning" ? "!" : "×"}</i><span>${esc(check.label)}</span></div>`).join("")}</div>
          <fieldset class="mpg-acknowledgements"><legend>Xác nhận bắt buộc</legend>
            <label><input type="checkbox" data-ack="rights" ${release.acknowledgements.rights ? "checked" : ""}> Tôi có quyền sử dụng các asset đã khai báo.</label>
            <label><input type="checkbox" data-ack="consent" ${release.acknowledgements.consent ? "checked" : ""}> Tôi có consent cần thiết cho giọng nói và hình ảnh.</label>
            <label><input type="checkbox" data-ack="metadata" ${release.acknowledgements.metadata ? "checked" : ""}> Tôi đã kiểm tra tác giả, ISRC và split.</label>
            <label><input type="checkbox" data-ack="restricted" ${release.acknowledgements.restricted ? "checked" : ""}> Tôi đã kiểm tra nội dung hạn chế và giả mạo.</label>
          </fieldset>
          <div class="mpg-actions"><button type="button" class="mpg-primary" data-action="open-publish-gate" ${blocking.length ? "disabled" : ""}>Đánh dấu sẵn sàng</button></div>
        </section>

        <section class="mpg-panel mpg-manifest"><div class="mpg-panel-head"><div><small>PROVENANCE</small><h3>Manifest</h3></div><b>v${MANIFEST_VERSION}</b></div><p>Lưu lineage của asset, provider, prompt, license, consent và metadata phát hành.</p><div class="mpg-actions"><button type="button" class="mpg-secondary" data-action="export-manifest">Xuất JSON</button><label class="mpg-import">Nhập JSON<input type="file" accept="application/json,.json" data-import-manifest></label></div><small>Import chỉ đọc các trường đã biết và không nhận dữ liệu truy cập dịch vụ.</small></section>
        ${auditMarkup()}
      </aside>
    </div>`;
  }

  function splitsMarkup(release) {
    const total = release.splits.reduce((sum, split) => sum + split.percent, 0);
    return `<section class="mpg-panel mpg-splits"><div class="mpg-panel-head"><div><small>OWNERSHIP</small><h3>Tác giả & split</h3></div><b class="${Math.abs(total - 100) < 0.01 ? "is-valid" : "is-invalid"}">${total.toFixed(2)}%</b></div>
      <form class="mpg-split-form" data-form="split"><label>Tên<input name="name" maxlength="120" required></label><label>Vai trò<input name="role" maxlength="100" value="Tác giả"></label><label>Tỷ lệ %<input name="percent" type="number" min="0.01" max="100" step="0.01" required></label><button class="mpg-primary" type="submit">Thêm</button></form>
      <div class="mpg-table-wrap"><table><thead><tr><th>Người hưởng</th><th>Vai trò</th><th>Tỷ lệ</th><th></th></tr></thead><tbody>${release.splits.length ? release.splits.map((split) => `<tr><td>${esc(split.name)}</td><td>${esc(split.role)}</td><td>${split.percent.toFixed(2)}%</td><td><button type="button" data-action="remove-split" data-id="${esc(split.id)}" aria-label="Xóa split của ${esc(split.name)}">Xóa</button></td></tr>`).join("") : `<tr><td colspan="4">Chưa có dữ liệu split.</td></tr>`}</tbody></table></div>
    </section>`;
  }

  function assetsMarkup(release) {
    return `<section class="mpg-panel mpg-assets"><div class="mpg-panel-head"><div><small>RIGHTS LEDGER</small><h3>Tài sản & nguồn gốc</h3></div><b>${release.assets.length}</b></div>
      <form class="mpg-asset-form" data-form="asset">
        <label><span>Tên asset</span><input name="name" maxlength="160" required></label>
        <label><span>Loại</span><select name="type">${Array.from(ASSET_TYPES).map((type) => `<option value="${type}">${type}</option>`).join("")}</select></label>
        <label><span>Nguồn</span><input name="source" maxlength="1000" required placeholder="Tự tạo, URL hoặc mã asset"></label>
        <label><span>Giấy phép</span><input name="license" maxlength="300" required placeholder="Owned, CC0, commercial..."></label>
        <label><span>Chủ sở hữu</span><input name="owner" maxlength="200" required></label>
        <label><span>Provider / model</span><input name="provider" maxlength="200"></label>
        <label class="is-wide"><span>Prompt / mô tả tạo</span><textarea name="prompt" rows="2" maxlength="4000"></textarea></label>
        <label><span>Consent</span><input name="consent" maxlength="1000"></label>
        <label><span>Bằng chứng</span><input name="proof" maxlength="1000"></label>
        <button class="mpg-primary" type="submit">Thêm vào sổ quyền</button>
      </form>
      <div class="mpg-table-wrap"><table><thead><tr><th>Asset</th><th>Nguồn & quyền</th><th>AI lineage</th><th>Consent</th><th></th></tr></thead><tbody>${release.assets.length ? release.assets.map((asset) => `<tr><td><strong>${esc(asset.name)}</strong><small>${esc(asset.type)}</small></td><td><span>${esc(asset.source || "Thiếu nguồn")}</span><small>${esc(asset.owner || "Thiếu owner")} · ${esc(asset.license || "Thiếu license")}</small></td><td><span>${esc(asset.provider || "Không khai báo AI")}</span><small>${esc(asset.prompt ? `${asset.prompt.slice(0, 90)}${asset.prompt.length > 90 ? "…" : ""}` : "Không có prompt")}</small></td><td>${esc(asset.consent || "Không áp dụng")}</td><td><button type="button" data-action="remove-asset" data-id="${esc(asset.id)}" aria-label="Xóa ${esc(asset.name)}">Xóa</button></td></tr>`).join("") : `<tr><td colspan="5">Chưa có asset trong sổ quyền.</td></tr>`}</tbody></table></div>
    </section>`;
  }

  function pendingRestoreMarkup() {
    if (!pendingRestoreId || activeView !== "project-branches") return "";
    const snapshot = selectedBranch()?.snapshots.find((item) => item.id === pendingRestoreId);
    if (!snapshot?.projectContext) return "";
    const data = snapshot.projectContext.data || {};
    const capability = contextCapability();
    return `<div class="mpg-dialog-backdrop"><section class="mpg-dialog" role="alertdialog" aria-modal="true" aria-labelledby="mpg-restore-title" aria-describedby="mpg-restore-description">
      <small>XÁC NHẬN PHỤC HỒI</small><h3 id="mpg-restore-title">Áp Project Context từ “${esc(snapshot.name)}”?</h3><p id="mpg-restore-description">Thao tác chỉ cập nhật các phần được liệt kê dưới đây. Branch, audio, thành viên và metadata phát hành không bị thay đổi.</p>
      <ul><li class="${data.chordTrack && capability.chordTrack ? "is-ready" : ""}"><b>Chord Track</b><span>${data.chordTrack ? (capability.chordTrack ? "Sẵn sàng áp dụng" : "Thiếu updateChordTrack()") : "Snapshot không có dữ liệu"}</span></li><li class="${data.songDNA && capability.songDNA ? "is-ready" : ""}"><b>Song DNA</b><span>${data.songDNA ? (capability.songDNA ? "Sẵn sàng áp dụng" : "Thiếu updateSongDNA()") : "Snapshot không có dữ liệu"}</span></li></ul>
      <div class="mpg-actions"><button type="button" class="mpg-secondary" data-action="cancel-restore">Hủy</button><button type="button" class="mpg-primary" data-action="confirm-restore">Xác nhận phục hồi</button></div>
    </section></div>`;
  }

  function render() {
    if (!activeHost) return;
    activeHost.innerHTML = shellMarkup();
    renderRealtimeBadge();
  }

  function notify(message, type = "success") {
    const node = activeHost?.querySelector?.("[data-mpg-toast]");
    if (!node) return;
    node.textContent = message;
    node.dataset.type = type;
    node.classList.add("is-visible");
    globalScope.clearTimeout(toastTimer);
    toastTimer = globalScope.setTimeout(() => node.classList.remove("is-visible"), 2800);
  }

  function formData(form) {
    const data = {};
    new globalScope.FormData(form).forEach((value, key) => { data[key] = typeof value === "string" ? value : ""; });
    return data;
  }

  function createBranch(templateName) {
    const presets = {
      "Radio Mix": ["Radio Mix", "Bản cân bằng cho radio và streaming.", "#62d7e7", -14],
      Acoustic: ["Acoustic", "Phối khí mộc, giữ dynamic tự nhiên.", "#b9e36b", -16],
      TikTok: ["TikTok", "Hook ngắn và năng lượng cao cho video dọc.", "#f05caf", -12]
    };
    const preset = presets[templateName] || ["Nhánh mới", "", "#a98df2", -14];
    const existingNames = new Set(state.branches.map((branch) => branch.name));
    let name = preset[0];
    let suffix = 2;
    while (existingNames.has(name)) name = `${preset[0]} ${suffix++}`;
    const branch = normalizeBranch({
      name,
      purpose: preset[1],
      color: preset[2],
      loudness: { integratedLufs: preset[3], truePeakDb: -1, rangeLu: 8 },
      sourceBranchId: state.selectedBranchId,
      members: clone(selectedBranch().members)
    });
    state.branches.push(branch);
    state.selectedBranchId = branch.id;
    audit("Tạo nhánh", branch.name, "", preset[0], "Từ template");
    commit("branch-created");
  }

  function createSnapshot() {
    const branch = selectedBranch();
    const attachment = captureProjectContext();
    const snapshot = normalizeSnapshot({
      name: `${branch.name} · ${new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date())}`,
      note: attachment ? "Có đính kèm Project Context." : "Snapshot metadata cục bộ; Project Context chưa khả dụng.",
      createdBy: activeOptions.actor?.name || "Bạn",
      reviewState: branch.reviewState,
      loudness: clone(branch.loudness),
      projectContext: attachment
    });
    branch.snapshots.unshift(snapshot);
    branch.snapshots = branch.snapshots.slice(0, 80);
    branch.updatedAt = nowIso();
    audit("Tạo snapshot", `${branch.name} / ${snapshot.name}`, "", attachment ? "Có Project Context" : "Metadata cục bộ");
    commit("snapshot-created");
  }

  async function confirmRestore() {
    const branch = selectedBranch();
    const snapshot = branch?.snapshots.find((item) => item.id === pendingRestoreId);
    const context = globalScope.HHMusicProjectContext;
    const data = snapshot?.projectContext?.data || {};
    if (!snapshot || !context) {
      pendingRestoreId = "";
      render();
      notify("Project Context không còn khả dụng.", "error");
      return;
    }
    const applied = [];
    const failed = [];
    if (data.chordTrack && typeof context.updateChordTrack === "function") {
      try { await context.updateChordTrack(clone(data.chordTrack)); applied.push("Chord Track"); } catch (_error) { failed.push("Chord Track"); }
    }
    if (data.songDNA && typeof context.updateSongDNA === "function") {
      try { await context.updateSongDNA(clone(data.songDNA)); applied.push("Song DNA"); } catch (_error) { failed.push("Song DNA"); }
    }
    pendingRestoreId = "";
    audit("Phục hồi Project Context", snapshot.name, "", applied.join(", ") || "Không có phần tương thích", failed.length ? `Lỗi: ${failed.join(", ")}` : "Người dùng đã xác nhận");
    persist();
    render();
    notify(applied.length ? `Đã phục hồi ${applied.join(" và ")}${failed.length ? `; lỗi ${failed.join(", ")}` : ""}.` : "Không có dữ liệu tương thích để phục hồi.", failed.length || !applied.length ? "warning" : "success");
  }

  function exportManifest() {
    const manifest = {
      format: MANIFEST_FORMAT,
      version: MANIFEST_VERSION,
      generatedAt: nowIso(),
      release: clone(state.release),
      preflight: releaseChecks().map(({ key, ok, label, type }) => ({ key, ok, label, type }))
    };
    const blob = new globalScope.Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = globalScope.URL.createObjectURL(blob);
    const anchor = globalScope.document.createElement("a");
    anchor.href = url;
    anchor.download = "hh-music-provenance-manifest.json";
    anchor.click();
    globalScope.setTimeout(() => globalScope.URL.revokeObjectURL(url), 0);
    audit("Xuất provenance manifest", state.release.title || "Bản phát hành", "", MANIFEST_FORMAT);
    persist();
    notify("Đã xuất provenance manifest.");
  }

  async function importManifest(file) {
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.format !== MANIFEST_FORMAT || Number(parsed.version) !== MANIFEST_VERSION) throw new Error("invalid-format");
      const before = state.release.title;
      state.release = normalizeRelease(parsed.release || {});
      audit("Nhập provenance manifest", state.release.title || "Bản phát hành", before, state.release.title, "Đã chuẩn hóa trường dữ liệu");
      commit("manifest-imported");
      notify("Đã nhập manifest và chạy lại preflight.");
    } catch (_error) {
      notify("Manifest không đúng định dạng HH Music.", "error");
    }
  }

  function handleSubmit(event) {
    const form = event.target.closest?.("[data-form]");
    if (!form) return;
    event.preventDefault();
    const data = formData(form);
    const branch = selectedBranch();
    switch (form.dataset.form) {
      case "branch-editor": {
        const before = `${branch.name} / ${branch.reviewState}`;
        branch.name = text(data.name || branch.name, 120);
        branch.purpose = text(data.purpose, 500);
        branch.reviewState = REVIEW_STATES.has(data.reviewState) ? data.reviewState : branch.reviewState;
        branch.color = /^#[0-9a-f]{6}$/i.test(data.color || "") ? data.color : branch.color;
        branch.loudness = {
          integratedLufs: boundedNumber(data.integratedLufs, branch.loudness.integratedLufs, -70, 3),
          truePeakDb: boundedNumber(data.truePeakDb, branch.loudness.truePeakDb, -30, 6),
          rangeLu: boundedNumber(data.rangeLu, branch.loudness.rangeLu, 0, 40)
        };
        branch.updatedAt = nowIso();
        audit("Cập nhật nhánh", branch.name, before, `${branch.name} / ${branch.reviewState}`);
        commit("branch-updated");
        break;
      }
      case "comment": {
        const body = text(data.body, 1200);
        if (!body) return;
        branch.comments.unshift(normalizeComment({ author: activeOptions.actor?.name || "Bạn", body, timestamp: timestampSeconds(data.timestamp) }));
        audit("Thêm bình luận", branch.name, "", `${formatTimestamp(timestampSeconds(data.timestamp))}: ${body}`);
        commit("comment-created");
        break;
      }
      case "member": {
        const member = normalizeMember({ name: data.name, role: data.role });
        if (!member.name) return;
        branch.members.push(member);
        audit("Thêm thành viên", branch.name, "", `${member.name} / ${ROLE_LABELS[member.role]}`);
        commit("member-added");
        break;
      }
      case "track-lock": {
        const lock = normalizeLock({ track: data.track, owner: activeOptions.actor?.name || "Bạn" });
        if (!lock.track || branch.trackLocks.some((item) => item.track.toLowerCase() === lock.track.toLowerCase())) return;
        branch.trackLocks.push(lock);
        audit("Khóa track", branch.name, "Mở", lock.track);
        commit("track-locked");
        break;
      }
      case "release-metadata": {
        const before = state.release.title;
        state.release = normalizeRelease({ ...state.release, ...data, status: "draft", updatedAt: nowIso() });
        audit("Cập nhật metadata phát hành", state.release.title || "Bản phát hành", before, state.release.title);
        commit("release-updated");
        break;
      }
      case "split": {
        const split = normalizeSplit(data);
        if (!split.name || split.percent <= 0) return;
        state.release.splits.push(split);
        state.release.status = "draft";
        audit("Thêm split", state.release.title || "Bản phát hành", "", `${split.name}: ${split.percent}%`);
        commit("split-added");
        break;
      }
      case "asset": {
        const asset = normalizeRightsAsset(data);
        if (!asset.name) return;
        state.release.assets.push(asset);
        state.release.status = "draft";
        audit("Thêm asset quyền", state.release.title || "Bản phát hành", "", `${asset.name} / ${asset.license || "Thiếu license"}`);
        commit("rights-asset-added");
        break;
      }
      default: break;
    }
  }

  function handleChange(event) {
    const target = event.target;
    const branch = selectedBranch();
    if (target.matches?.("[data-field='compare-base']")) {
      state.comparison.baseId = text(target.value, 90); persist(); render();
    } else if (target.matches?.("[data-field='compare-candidate']")) {
      state.comparison.candidateId = text(target.value, 90); persist(); render();
    } else if (target.matches?.("[data-field='compare-target']")) {
      state.comparison.targetLufs = boundedNumber(target.value, -14, -30, -5); persist(); render();
    } else if (target.matches?.("[data-action='member-role']")) {
      const member = branch.members.find((item) => item.id === target.dataset.id);
      if (member && MEMBER_ROLES.has(target.value)) {
        const before = member.role;
        member.role = target.value;
        audit("Đổi quyền thành viên", branch.name, `${member.name}: ${ROLE_LABELS[before]}`, `${member.name}: ${ROLE_LABELS[member.role]}`);
        commit("member-role-updated");
      }
    } else if (target.matches?.("[data-ack]")) {
      const key = target.dataset.ack;
      if (Object.hasOwn(state.release.acknowledgements, key)) {
        state.release.acknowledgements[key] = Boolean(target.checked);
        state.release.status = "draft";
        audit("Cập nhật xác nhận", state.release.title || "Bản phát hành", "", `${key}: ${Boolean(target.checked)}`);
        commit("acknowledgement-updated");
      }
    } else if (target.matches?.("[data-import-manifest]") && target.files?.[0]) {
      importManifest(target.files[0]);
    }
  }

  function handleClick(event) {
    const button = event.target.closest?.("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const id = text(button.dataset.id, 90);
    const branch = selectedBranch();
    if (action === "switch-view" && supports(button.dataset.view)) {
      activeView = button.dataset.view;
      pendingRestoreId = "";
      render();
    } else if (action === "select-branch" && state.branches.some((item) => item.id === id)) {
      state.selectedBranchId = id; persist(); render();
    } else if (action === "create-branch") {
      createBranch(button.dataset.template);
    } else if (action === "create-snapshot") {
      createSnapshot();
    } else if (action === "request-restore") {
      const snapshot = branch.snapshots.find((item) => item.id === id);
      if (snapshot?.projectContext) { pendingRestoreId = id; render(); }
    } else if (action === "cancel-restore") {
      pendingRestoreId = ""; render();
    } else if (action === "confirm-restore") {
      confirmRestore();
    } else if (action === "toggle-comment") {
      const comment = branch.comments.find((item) => item.id === id);
      if (comment) { comment.resolved = !comment.resolved; audit(comment.resolved ? "Đóng bình luận" : "Mở lại bình luận", branch.name, "", comment.body); commit("comment-updated"); }
    } else if (action === "unlock-track") {
      const lock = branch.trackLocks.find((item) => item.id === id);
      branch.trackLocks = branch.trackLocks.filter((item) => item.id !== id);
      if (lock) { audit("Mở khóa track", branch.name, lock.track, "Mở"); commit("track-unlocked"); }
    } else if (action === "remove-split") {
      const split = state.release.splits.find((item) => item.id === id);
      state.release.splits = state.release.splits.filter((item) => item.id !== id);
      state.release.status = "draft";
      if (split) { audit("Xóa split", state.release.title || "Bản phát hành", `${split.name}: ${split.percent}%`, ""); commit("split-removed"); }
    } else if (action === "remove-asset") {
      const asset = state.release.assets.find((item) => item.id === id);
      state.release.assets = state.release.assets.filter((item) => item.id !== id);
      state.release.status = "draft";
      if (asset) { audit("Xóa asset quyền", state.release.title || "Bản phát hành", asset.name, ""); commit("rights-asset-removed"); }
    } else if (action === "open-publish-gate") {
      const blocking = releaseChecks().filter((check) => check.type === "blocking" && !check.ok);
      if (blocking.length) { notify(`Còn ${blocking.length} mục đang chặn phát hành.`, "error"); return; }
      state.release.status = "ready";
      audit("Mở cổng phát hành nội bộ", state.release.title || "Bản phát hành", "draft", "ready", "Đã vượt preflight");
      commit("release-ready");
    } else if (action === "export-manifest") {
      exportManifest();
    }
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && pendingRestoreId) {
      pendingRestoreId = "";
      render();
      return;
    }
    const tab = event.target.closest?.("[role='tab']");
    if (!tab || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const next = activeView === "project-branches" ? "release-manager" : "project-branches";
    activeView = next;
    render();
    activeHost?.querySelector?.(`[data-view="${next}"]`)?.focus?.();
  }

  function bindEvents() {
    controller = new globalScope.AbortController();
    const options = { signal: controller.signal };
    activeHost.addEventListener("click", handleClick, options);
    activeHost.addEventListener("submit", handleSubmit, options);
    activeHost.addEventListener("change", handleChange, options);
    activeHost.addEventListener("keydown", handleKeydown, options);
  }

  function mount(nextHost, options = {}) {
    if (!nextHost || typeof nextHost.addEventListener !== "function" || typeof nextHost.innerHTML !== "string") {
      throw new TypeError("HHMusicProjectGovernance.mount cần một DOM host hợp lệ.");
    }
    unmount();
    activeHost = nextHost;
    activeOptions = options && typeof options === "object" ? options : {};
    activeView = supports(activeOptions.view) ? activeOptions.view : "project-branches";
    state = loadState();
    setupRealtime(activeOptions.realtimeAdapter);
    bindEvents();
    render();
    return true;
  }

  function unmount() {
    globalScope.clearTimeout(toastTimer);
    toastTimer = 0;
    pendingRestoreId = "";
    if (controller) controller.abort();
    controller = null;
    if (typeof realtimeUnsubscribe === "function") {
      try { realtimeUnsubscribe(); } catch (_error) { /* Adapter cleanup is best effort. */ }
    }
    realtimeUnsubscribe = null;
    if (activeHost) activeHost.innerHTML = "";
    activeHost = null;
    activeOptions = {};
    state = null;
    realtimeState = localRealtimeState();
  }

  globalScope.HHMusicProjectGovernance = Object.freeze({ supports, mount, unmount });
})(window);
