(() => {
  "use strict";

  const STORAGE_KEY = "hh.youtube-creator-galaxy.v2";
  const FLEET_STORAGE_KEY = "hh.youtube-channel-fleet.v1";
  const CREATOR_LAUNCH_INTENT_KEY = "hh.youtube.creator.intent.v1";
  const CREATOR_LAUNCH_INTENT_TTL_MS = 5 * 60 * 1000;
  const VIDEO_PROJECT_KEY = "hh.video-editor.project.v1";
  const MEDIA_DB = "hh-video-editor-media";
  const MEDIA_STORE = "assets";
  const BATCH_MANIFEST_DB = "hh-youtube-batch-manifest-v1";
  const BATCH_MANIFEST_STORE = "owners";
  const BATCH_VIDEO_LIMIT = 10;
  const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|mkv)$/i;
  const THUMBNAIL_EXTENSIONS = /\.(jpe?g|png)$/i;
  const SIDECAR_EXTENSIONS = /\.(json|txt|md|srt|vtt)$/i;
  const FLEET_STUDIO_TABS = Object.freeze(["overview", "content", "calendar", "comments", "analytics", "queue", "settings"]);
  const AI_DISCLOSURE_OPTIONS = Object.freeze(["yes", "no", "unreviewed"]);
  const VIDEO_EDITOR_SECTIONS = Object.freeze([
    ["details", "Chi tiết", "▤"], ["analytics", "Analytics", "↗"], ["editor", "Editor", "✂"], ["comments", "Bình luận", "◌"], ["subtitles", "Phụ đề", "CC"], ["restrictions", "Bản quyền", "©"], ["clips", "Clips", "▶"], ["monetization", "Kiếm tiền", "$"], ["audit", "Nhật ký", "⌁"]
  ]);
  const VIDEO_CATEGORIES = Object.freeze({ "1": "Phim & Hoạt hình", "2": "Xe cộ", "10": "Âm nhạc", "15": "Thú cưng & Động vật", "17": "Thể thao", "19": "Du lịch & Sự kiện", "20": "Trò chơi", "22": "Con người & Blog", "23": "Hài", "24": "Giải trí", "25": "Tin tức & Chính trị", "26": "Hướng dẫn & Phong cách", "27": "Giáo dục", "28": "Khoa học & Công nghệ", "29": "Phi lợi nhuận & Hoạt động xã hội" });
  const VIDEO_LANGUAGES = Object.freeze({ vi: "Tiếng Việt", en: "English", es: "Español", fr: "Français", de: "Deutsch", ja: "日本語", ko: "한국어", th: "ไทย", zh: "中文", id: "Bahasa Indonesia" });
  const STUDIO_MODULE_TABS = Object.freeze({ command: "overview", upload: "content", thumbnail: "content", seo: "content", preflight: "content", calendar: "calendar", comments: "comments", analytics: "analytics" });
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
    active: "fleet",
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
  const DEFAULT_CHANNEL_PRESET = Object.freeze({
    titleOverride: "",
    titlePrefix: "",
    titleSuffix: "",
    descriptionTemplate: "",
    tags: "",
    categoryId: "22",
    defaultLanguage: "vi",
    playlistId: "",
    brandColor: "#ff3158",
    publishTime: "20:00",
    timezone: "Asia/Bangkok",
    publishAt: "",
    thumbnailVariant: "A",
    privacyStatus: "private",
    madeForKids: false,
    license: "youtube",
    embeddable: true,
    notifySubscribers: true,
    locked: false
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
  let fleetUploadFiles = [];
  let fleetObservatory = null;
  let fleetThumbnailVariants = new Map();
  let contentLibrary = [];
  let contentDrawer = null;
  let channelSettings = null;
  let deleteDialog = null;
  let aiBulkDialog = false;
  let calendarDragItem = null;
  let queuePaused = false;
  let queueRunToken = 0;
  let batchRouteMode = false;
  let batchFolderName = "";
  let batchSidecars = new Map();
  let batchThumbnailFiles = new Map();
  let batchAiRunning = false;
  let batchAiProgress = { done: 0, total: 0 };
  let batchSchedule = { startAt: "", spacingHours: 24 };
  const activeUploadRequests = new Map();
  const pausedTaskKeys = new Set();

  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const apiBase = () => String(window.HH_API_ORIGIN || location.origin).replace(/\/$/, "");
  const apiUrl = (path) => `${apiBase()}/api/search/youtube-publisher?youtubeAction=${encodeURIComponent(path)}`;
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
  const dateTimeInZone = (value, timeZone) => {
    if (!value) return "Chưa có";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "Không hợp lệ";
    try { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone }).format(date); }
    catch { return dateTime(value); }
  };
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  function normalizeAiDisclosure(value, fallback = "unreviewed") { return AI_DISCLOSURE_OPTIONS.includes(value) ? value : fallback; }
  const aiDisclosureLabel = (value) => ({ yes: "Có AI", no: "Không AI", unreviewed: "Chưa kiểm tra" })[normalizeAiDisclosure(value)] || "Chưa kiểm tra";

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

  function validLaunchIntentTab(value, ownerId = currentIdentityId(), now = Date.now()) {
    const issuedAt = Number(value?.at || 0);
    const age = Number(now) - issuedAt;
    if (!FLEET_STUDIO_TABS.includes(value?.tab)) return "";
    if (String(value?.ownerId || "") !== String(ownerId || "")) return "";
    if (!Number.isFinite(age) || age < -30_000 || age > CREATOR_LAUNCH_INTENT_TTL_MS) return "";
    return value.tab;
  }

  function consumeLaunchIntent(now = Date.now()) {
    let value = null;
    try {
      const raw = sessionStorage.getItem(CREATOR_LAUNCH_INTENT_KEY);
      sessionStorage.removeItem(CREATOR_LAUNCH_INTENT_KEY);
      value = raw ? JSON.parse(raw) : null;
    } catch { return ""; }
    return validLaunchIntentTab(value, currentIdentityId(), now);
  }

  function privateStorageKey(base = STORAGE_KEY) {
    return base === STORAGE_KEY
      ? `${base}:${currentIdentityId()}:${storageChannelId}`
      : `${base}:${currentIdentityId()}`;
  }

  function videoRouteTarget() {
    const match = String(location.hash || "").match(/^#\/davinci-resolve\/youtube\/content\/([^/]+)\/([^/?#]+)/);
    if (!match) return null;
    try { return { channelId: decodeURIComponent(match[1]).slice(0, 120), videoId: decodeURIComponent(match[2]).slice(0, 40) }; }
    catch { return null; }
  }

  function videoWorkspaceRoute(channelId, videoId) {
    return `#/davinci-resolve/youtube/content/${encodeURIComponent(String(channelId || ""))}/${encodeURIComponent(String(videoId || ""))}`;
  }

  function repeatedDescriptionLines(value) {
    const lines = String(value || "").split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length >= 12);
    const seen = new Map();
    lines.forEach((line) => seen.set(line.toLocaleLowerCase("vi"), (seen.get(line.toLocaleLowerCase("vi")) || 0) + 1));
    return [...seen.entries()].filter(([, count]) => count > 1).map(([line, count]) => ({ line, count })).slice(0, 5);
  }

  function editorDraftFromVideo(item = {}) {
    return {
      title: String(item.title || "").slice(0, 100),
      description: String(item.description || "").slice(0, 5000),
      tags: Array.isArray(item.tags) ? item.tags.join(", ") : String(item.tags || ""),
      playlistId: "",
      categoryId: String(item.categoryId || "22"),
      defaultLanguage: String(item.defaultLanguage || "vi"),
      privacyStatus: item.scheduledAt ? "schedule" : ["private", "unlisted", "public"].includes(item.privacyStatus) ? item.privacyStatus : "private",
      publishAt: String(item.scheduledAt || item.publishAt || "").slice(0, 16),
      madeForKids: Boolean(item.madeForKids),
      aiDisclosure: normalizeAiDisclosure(item.aiDisclosure),
      license: item.license === "creativeCommon" ? "creativeCommon" : "youtube",
      embeddable: item.embeddable !== false,
      publicStatsViewable: item.publicStatsViewable !== false,
      recordingDate: String(item.recordingDate || "").slice(0, 10)
    };
  }

  function videoDraftFromForm(form) {
    const data = Object.fromEntries(new FormData(form));
    return {
      title: String(data.title || "").slice(0, 100),
      description: String(data.description || "").slice(0, 5000),
      tags: String(data.tags || "").slice(0, 500),
      playlistId: String(data.playlistId || "").slice(0, 120),
      categoryId: String(data.categoryId || "22").slice(0, 3),
      defaultLanguage: String(data.defaultLanguage || "vi").slice(0, 12),
      privacyStatus: ["private", "unlisted", "public", "schedule"].includes(data.privacyStatus) ? data.privacyStatus : "private",
      publishAt: String(data.publishAt || "").slice(0, 16),
      madeForKids: data.madeForKids === "on",
      aiDisclosure: normalizeAiDisclosure(data.aiDisclosure),
      license: data.license === "creativeCommon" ? "creativeCommon" : "youtube",
      embeddable: data.embeddable === "on",
      publicStatsViewable: data.publicStatsViewable === "on",
      recordingDate: String(data.recordingDate || "").slice(0, 10)
    };
  }

  function draftsEqual(left, right) {
    return JSON.stringify(left || {}) === JSON.stringify(right || {});
  }

  async function loadVideoWorkspace(channelId, videoId, fallbackItem = {}) {
    if (!channelId || !videoId) throw new Error("Route video không hợp lệ.");
    contentDrawer = { loading: true, item: { ...fallbackItem, channelId, videoId }, audit: [], captions: [], activeSection: "details", dirty: false };
    render();
    const result = await api("video/details", "POST", { channelId, videoId });
    const item = { ...fallbackItem, ...(result.video || {}), channelId, videoId };
    const draft = editorDraftFromVideo(item);
    contentDrawer = {
      loading: false,
      item,
      audit: result.audit || [],
      captions: result.captions || [],
      draft,
      originalDraft: { ...draft },
      activeSection: "details",
      dirty: false
    };
    render();
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
      const rawPresets = value?.channelPresets && typeof value.channelPresets === "object" ? value.channelPresets : {};
      const channelPresets = Object.fromEntries(Object.entries(rawPresets).slice(0, 100).map(([channelId, preset]) => [String(channelId).slice(0, 120), {
        ...DEFAULT_CHANNEL_PRESET,
        titleOverride: String(preset?.titleOverride || "").slice(0, 100),
        titlePrefix: String(preset?.titlePrefix || "").slice(0, 40),
        titleSuffix: String(preset?.titleSuffix || "").slice(0, 40),
        descriptionTemplate: String(preset?.descriptionTemplate || "").slice(0, 3000),
        tags: String(preset?.tags || "").slice(0, 480),
        categoryId: String(preset?.categoryId || "22").slice(0, 8),
        defaultLanguage: String(preset?.defaultLanguage || "vi").slice(0, 12),
        playlistId: String(preset?.playlistId || "").slice(0, 120),
        brandColor: /^#[0-9a-f]{6}$/i.test(preset?.brandColor) ? preset.brandColor : DEFAULT_CHANNEL_PRESET.brandColor,
        publishTime: /^\d{2}:\d{2}$/.test(preset?.publishTime) ? preset.publishTime : "20:00",
        timezone: String(preset?.timezone || "Asia/Bangkok").slice(0, 80),
        publishAt: String(preset?.publishAt || "").slice(0, 32),
        thumbnailVariant: ["A", "B", "C"].includes(preset?.thumbnailVariant) ? preset.thumbnailVariant : "A",
        privacyStatus: ["private", "unlisted", "schedule"].includes(preset?.privacyStatus) ? preset.privacyStatus : "private",
        madeForKids: Boolean(preset?.madeForKids),
        license: preset?.license === "creativeCommon" ? "creativeCommon" : "youtube",
        embeddable: preset?.embeddable !== false,
        notifySubscribers: preset?.notifySubscribers !== false,
        locked: Boolean(preset?.locked)
      }]));
      const rawVideoDrafts = value?.videoDrafts && typeof value.videoDrafts === "object" ? value.videoDrafts : {};
      const videoDrafts = Object.fromEntries(Object.entries(rawVideoDrafts).slice(0, 10).map(([fingerprint, draft]) => [String(fingerprint).slice(0, 260), {
        title: String(draft?.title || "").slice(0, 100),
        description: String(draft?.description || "").slice(0, 5000),
        tags: String(draft?.tags || "").slice(0, 500),
        idempotencyKey: String(draft?.idempotencyKey || "").slice(0, 160),
        thumbnailTitle: String(draft?.thumbnailTitle || "").slice(0, 80),
        thumbnailSubtitle: String(draft?.thumbnailSubtitle || "").slice(0, 80),
        thumbnailAccent: /^#[0-9a-f]{6}$/i.test(draft?.thumbnailAccent) ? draft.thumbnailAccent : "#ff3158",
        thumbnailReady: Boolean(draft?.thumbnailReady),
        thumbnailName: String(draft?.thumbnailName || "").slice(0, 240),
        sidecarName: String(draft?.sidecarName || "").slice(0, 240),
        checksum: String(draft?.checksum || "").slice(0, 80),
        aiDisclosure: normalizeAiDisclosure(draft?.aiDisclosure, draft?.containsSyntheticMedia === true ? "yes" : "unreviewed"),
        channelTitles: Object.fromEntries(Object.entries(draft?.channelTitles || {}).slice(0, 100).map(([channelId, title]) => [String(channelId).slice(0, 120), String(title || "").slice(0, 100)]))
      }]));
      const taskMatrix = Object.fromEntries(Object.entries(value?.taskMatrix || {}).slice(0, 1000).map(([taskKey, item]) => [String(taskKey).slice(0, 390), {
        enabled: item?.enabled !== false,
        mode: ["inherit", "private", "unlisted", "schedule"].includes(item?.mode) ? item.mode : "inherit",
        publishAt: String(item?.publishAt || "").slice(0, 32),
        aiDisclosure: normalizeAiDisclosure(item?.aiDisclosure)
      }]));
      const scheduleDrafts = Object.fromEntries(Object.entries(value?.scheduleDrafts || {}).slice(0, 500).map(([taskKey, item]) => [String(taskKey).slice(0, 240), {
        channelId: String(item?.channelId || "").slice(0, 120),
        videoId: String(item?.videoId || "").slice(0, 40),
        publishAt: String(item?.publishAt || "").slice(0, 32),
        previousPublishAt: String(item?.previousPublishAt || "").slice(0, 32)
      }]));
      return {
        selectedChannelIds: Array.isArray(value?.selectedChannelIds) ? value.selectedChannelIds.map(String).slice(0, 100) : [],
        studioTab: FLEET_STUDIO_TABS.includes(value?.studioTab) ? value.studioTab : "overview",
        channelSearch: String(value?.channelSearch || "").slice(0, 100),
        channelFilter: ["all", "ready", "warning", "uploading", "error"].includes(value?.channelFilter) ? value.channelFilter : "all",
        uploadChannelSearch: String(value?.uploadChannelSearch || "").slice(0, 100),
        uploadAccountFilter: String(value?.uploadAccountFilter || "all").slice(0, 80),
        activeFileFingerprint: String(value?.activeFileFingerprint || "").slice(0, 260),
        videoDrafts,
        taskMatrix,
        contentMode: ["upload", "manager"].includes(value?.contentMode) ? value.contentMode : "upload",
        contentFilter: ["all", "uploading", "processing", "draft", "scheduled", "published", "error"].includes(value?.contentFilter) ? value.contentFilter : "all",
        contentAiFilter: ["all", "yes", "no", "unreviewed"].includes(value?.contentAiFilter) ? value.contentAiFilter : "all",
        contentSortBy: ["title", "channel", "status", "processing", "privacy", "date", "metrics"].includes(value?.contentSortBy) ? value.contentSortBy : "title",
        contentSort: ["az", "za"].includes(value?.contentSort) ? value.contentSort : "az",
        contentScrollTop: Math.max(0, Number(value?.contentScrollTop || 0)),
        contentChannel: String(value?.contentChannel || "all").slice(0, 120),
        settingsChannel: String(value?.settingsChannel || "").slice(0, 120),
        settingsSection: ["profile", "upload", "channel", "permissions", "moderation", "agreements"].includes(value?.settingsSection) ? value.settingsSection : "profile",
        selectedContentIds: Array.isArray(value?.selectedContentIds) ? value.selectedContentIds.map(String).slice(0, 500) : [],
        calendarMode: ["month", "timeline", "unscheduled"].includes(value?.calendarMode) ? value.calendarMode : "month",
        calendarTimezone: String(value?.calendarTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Bangkok").slice(0, 80),
        calendarChannelFilter: String(value?.calendarChannelFilter || "all").slice(0, 120),
        calendarTypeFilter: ["all", "Video", "Short", "Livestream"].includes(value?.calendarTypeFilter) ? value.calendarTypeFilter : "all",
        scheduleDrafts,
        scheduleHistory: Array.isArray(value?.scheduleHistory) ? value.scheduleHistory.slice(-20) : [],
        title: String(value?.title || "").slice(0, 100),
        description: String(value?.description || "").slice(0, 5000),
        tags: String(value?.tags || "").slice(0, 500),
        privacyStatus: ["private", "unlisted"].includes(value?.privacyStatus) ? value.privacyStatus : "private",
        rightsConfirmed: Boolean(value?.rightsConfirmed),
        containsSyntheticMedia: Boolean(value?.containsSyntheticMedia),
        aiDisclosure: normalizeAiDisclosure(value?.aiDisclosure, value?.containsSyntheticMedia === true ? "yes" : "unreviewed"),
        madeForKids: Boolean(value?.madeForKids),
        uploadPrivateFirst: value?.uploadPrivateFirst !== false,
        concurrency: Math.min(3, Math.max(1, Number(value?.concurrency || 2))),
        thumbnailVariant: ["A", "B", "C"].includes(value?.thumbnailVariant) ? value.thumbnailVariant : "A",
        thumbnailTitle: String(value?.thumbnailTitle || "").slice(0, 80),
        thumbnailSubtitle: String(value?.thumbnailSubtitle || "").slice(0, 80),
        thumbnailAccent: /^#[0-9a-f]{6}$/i.test(value?.thumbnailAccent) ? value.thumbnailAccent : "#ff3158",
        channelPresets,
        replaceFind: String(value?.replaceFind || "").slice(0, 80),
        replaceWith: String(value?.replaceWith || "").slice(0, 80),
        fileFingerprint: String(value?.fileFingerprint || "").slice(0, 260),
        idempotencyKey: String(value?.idempotencyKey || "").slice(0, 160),
        results: Array.isArray(value?.results) ? value.results.slice(0, 1200) : []
      };
    } catch {
      return { selectedChannelIds: [], studioTab: "overview", channelSearch: "", channelFilter: "all", uploadChannelSearch: "", uploadAccountFilter: "all", activeFileFingerprint: "", videoDrafts: {}, taskMatrix: {}, contentMode: "upload", contentFilter: "all", contentAiFilter: "all", contentSortBy: "title", contentSort: "az", contentScrollTop: 0, contentChannel: "all", settingsChannel: "", settingsSection: "profile", selectedContentIds: [], calendarMode: "month", calendarTimezone: "Asia/Bangkok", calendarChannelFilter: "all", calendarTypeFilter: "all", scheduleDrafts: {}, scheduleHistory: [], title: "", description: "", tags: "", privacyStatus: "private", rightsConfirmed: false, containsSyntheticMedia: false, aiDisclosure: "unreviewed", madeForKids: false, uploadPrivateFirst: true, concurrency: 2, thumbnailVariant: "A", thumbnailTitle: "", thumbnailSubtitle: "", thumbnailAccent: "#ff3158", channelPresets: {}, replaceFind: "", replaceWith: "", fileFingerprint: "", idempotencyKey: "", results: [] };
    }
  }

  function saveFleetState() {
    try { sessionStorage.setItem(privateStorageKey(FLEET_STORAGE_KEY), JSON.stringify(fleetState)); } catch {}
  }

  const normalizedAssetBase = (name) => String(name || "").split(/[\\/]/).pop().replace(/\.[^.]+$/, "").trim().toLocaleLowerCase("vi");
  const folderPathOf = (file) => String(file?.webkitRelativePath || file?.name || "");

  function openBatchManifestDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("Trình duyệt không hỗ trợ lưu manifest cục bộ."));
      const request = indexedDB.open(BATCH_MANIFEST_DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(BATCH_MANIFEST_STORE)) request.result.createObjectStore(BATCH_MANIFEST_STORE, { keyPath: "ownerId" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Không mở được kho manifest."));
    });
  }

  async function persistBatchManifest() {
    const db = await openBatchManifestDb();
    try {
      const record = {
        ownerId: currentIdentityId(), folderName: batchFolderName, savedAt: new Date().toISOString(),
        selectedChannelIds: [...fleetState.selectedChannelIds], schedule: { ...batchSchedule },
        files: fleetUploadFiles.map((file) => { const fingerprint = fleetFileFingerprint(file); const draft = fleetDraft(fingerprint, file); return { fingerprint, path: folderPathOf(file), name: file.name, size: file.size, lastModified: file.lastModified || 0, title: draft?.title || "", description: draft?.description || "", tags: draft?.tags || "", thumbnailName: draft?.thumbnailName || "", sidecarName: draft?.sidecarName || "" }; })
      };
      await new Promise((resolve, reject) => { const transaction = db.transaction(BATCH_MANIFEST_STORE, "readwrite"); transaction.objectStore(BATCH_MANIFEST_STORE).put(record); transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
    } finally { db.close(); }
  }

  async function readBatchManifest() {
    const db = await openBatchManifestDb();
    try { return await new Promise((resolve, reject) => { const request = db.transaction(BATCH_MANIFEST_STORE, "readonly").objectStore(BATCH_MANIFEST_STORE).get(currentIdentityId()); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error); }); }
    finally { db.close(); }
  }

  async function applySidecarToDraft(file, sidecar) {
    const draft = fleetDraft(fleetFileFingerprint(file), file);
    if (!draft || !sidecar) return;
    draft.sidecarName = sidecar.name;
    let text = "";
    try { text = String(await sidecar.text()).slice(0, 12000); } catch {}
    if (!text) return;
    if (/\.json$/i.test(sidecar.name)) {
      try { const data = JSON.parse(text); draft.title = String(data.title || data.youtubeTitle || draft.title).slice(0, 100); draft.description = String(data.description || data.caption || draft.description).slice(0, 5000); draft.tags = (Array.isArray(data.tags) ? data.tags.join(", ") : String(data.tags || draft.tags)).slice(0, 500); draft.thumbnailTitle = String(data.thumbnailTitle || data.thumbText || draft.thumbnailTitle || draft.title).slice(0, 80); draft.thumbnailSubtitle = String(data.thumbnailSubtitle || draft.thumbnailSubtitle || "").slice(0, 80); return; } catch {}
    }
    if (/\.(srt|vtt)$/i.test(sidecar.name)) { draft.description ||= `Phụ đề nguồn: ${sidecar.name}`; return; }
    const lines = text.split(/\r?\n/).map((line) => line.trim()); const first = lines.find(Boolean) || "";
    if (first) draft.title = first.slice(0, 100);
    const body = lines.slice(lines.indexOf(first) + 1).join("\n").trim(); if (body) draft.description = body.slice(0, 5000);
  }

  async function loadBatchFolderFiles(files) {
    const incoming = [...(files || [])].filter((file) => file && !String(file.name || "").startsWith("."));
    const videos = incoming.filter((file) => file.type.startsWith("video/") || file.type === "application/octet-stream" || VIDEO_EXTENSIONS.test(file.name));
    if (!videos.length) throw new Error("Thư mục chưa có video MP4, MOV, WebM hoặc MKV.");
    if (videos.length > BATCH_VIDEO_LIMIT) throw new Error(`Mỗi hàng đợi nhận tối đa ${BATCH_VIDEO_LIMIT} video để kiểm soát quota. Hãy chia thư mục thành nhiều đợt.`);
    const images = incoming.filter((file) => file.type.startsWith("image/") || THUMBNAIL_EXTENSIONS.test(file.name));
    const sidecars = incoming.filter((file) => SIDECAR_EXTENSIONS.test(file.name));
    batchSidecars = new Map(sidecars.map((file) => [normalizedAssetBase(file.name), file]));
    batchThumbnailFiles = new Map(images.map((file) => [normalizedAssetBase(file.name), file]));
    batchFolderName = folderPathOf(videos[0]).split(/[\\/]/)[0] || "Thư mục đã chọn";
    await loadFleetVideoFiles(videos);
    for (const file of fleetUploadFiles) {
      const base = normalizedAssetBase(file.name); const draft = fleetDraft(fleetFileFingerprint(file), file); const thumb = batchThumbnailFiles.get(base); const sidecar = batchSidecars.get(base);
      if (thumb && thumb.size <= 2 * 1024 * 1024 && /image\/(jpeg|png)/.test(thumb.type || "")) { draft.thumbnailName = thumb.name; draft.thumbnailReady = true; }
      if (sidecar) await applySidecarToDraft(file, sidecar);
    }
    saveFleetState(); await persistBatchManifest().catch(() => {}); render();
    status(`Đã quét ${videos.length} video, ghép ${images.length} ảnh và ${sidecars.length} sidecar trong “${batchFolderName}”.`, "success");
  }

  const batchMetadataFallback = (file, index) => { const base = String(file?.name || `Video ${index + 1}`).replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim(); return { title: base.slice(0, 100), description: `Nội dung: ${base}. Hãy kiểm tra lại thông tin và quyền sử dụng trước khi xuất bản.`, tags: base.split(/\s+/).filter((word) => word.length > 2).slice(0, 12).join(", "), thumbnailTitle: base.split(/\s+/).slice(0, 6).join(" ").slice(0, 80), thumbnailSubtitle: "" }; };

  async function generateBatchMetadata() {
    if (!fleetUploadFiles.length) throw new Error("Hãy chọn thư mục video trước khi tạo metadata.");
    batchAiRunning = true; batchAiProgress = { done: 0, total: fleetUploadFiles.length }; render();
    try {
      const items = fleetUploadFiles.map((file, index) => { const draft = fleetDraft(fleetFileFingerprint(file), file); return { index: index + 1, filename: file.name, sidecar: draft?.sidecarName || "", currentTitle: draft?.title || "" }; });
      let rows = [];
      try { const response = await fetch(`${apiBase()}/api/modules/youtube-batch/actions`, { method: "POST", credentials: "include", cache: "no-store", headers: authHeaders(), body: JSON.stringify({ actionType: "youtube-batch-metadata", input: `Tạo metadata YouTube tiếng Việt nguyên bản cho thư mục “${batchFolderName || "video"}”. Không bịa dữ kiện.`, meta: { provider: "auto", allowProviderFallback: true, items } }) }); const payload = await response.json().catch(() => ({})); if (!response.ok || !payload?.ok) throw new Error(payload.error || `AI HTTP ${response.status}`); rows = payload.action?.structured?.items || []; } catch {}
      fleetUploadFiles.forEach((file, index) => { const draft = fleetDraft(fleetFileFingerprint(file), file); const fallback = batchMetadataFallback(file, index); const row = rows.find((item) => Number(item.index) === index + 1 || item.filename === file.name) || fallback; draft.title = String(row.title || fallback.title).slice(0, 100); draft.description = String(row.description || fallback.description).slice(0, 5000); draft.tags = (Array.isArray(row.tags) ? row.tags.join(", ") : String(row.tags || fallback.tags)).slice(0, 500); draft.thumbnailTitle = String(row.thumbnailTitle || fallback.thumbnailTitle).slice(0, 80); draft.thumbnailSubtitle = String(row.thumbnailSubtitle || fallback.thumbnailSubtitle).slice(0, 80); batchAiProgress.done = index + 1; });
      syncActiveFleetDraft(); saveFleetState(); await persistBatchManifest().catch(() => {}); status(`Đã tạo metadata cho ${fleetUploadFiles.length} video. Hãy duyệt nhanh trước khi upload.`, "success");
    } finally { batchAiRunning = false; render(); }
  }

  function applyBatchSchedule() {
    const startAt = root?.querySelector("[data-ycg-batch-start]")?.value || batchSchedule.startAt; const spacingHours = Math.min(168, Math.max(1, Number(root?.querySelector("[data-ycg-batch-spacing]")?.value || batchSchedule.spacingHours || 24))); const start = new Date(startAt);
    if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now() + 60_000) throw new Error("Thời điểm bắt đầu phải ở tương lai ít nhất một phút.");
    batchSchedule = { startAt, spacingHours }; let taskCount = 0;
    fleetUploadFiles.forEach((file, videoIndex) => fleetState.selectedChannelIds.forEach((channelId) => { const cell = matrixTask(fleetFileFingerprint(file), channelId, true); cell.enabled = cell.enabled !== false; cell.mode = "schedule"; cell.publishAt = new Date(start.getTime() + videoIndex * spacingHours * 60 * 60 * 1000).toISOString().slice(0, 16); taskCount += 1; }));
    invalidateFleetPublish(); saveFleetState(); persistBatchManifest().catch(() => {}); render(); status(`Đã xếp ${fleetUploadFiles.length} mốc cho ${taskCount} tác vụ; cùng video dùng chung mốc trên các kênh.`, "success");
  }

  function batchWorkspaceBanner() {
    if (!batchRouteMode) return "";
    return `<section class="ycg-batch-launchpad"><div><small>AUTOMATED FOLDER → YOUTUBE</small><h2>YouTube Batch Publisher</h2><p>Chọn thư mục, ghép video với ảnh/JSON/TXT/SRT cùng tên, tạo metadata AI, chia lịch và gửi tới nhiều kênh bằng resumable upload. Video thiếu ảnh sẽ tự tạo thumbnail từ khung hình và chữ đã duyệt.</p></div><div class="ycg-batch-launchpad__actions"><label class="is-primary">Chọn thư mục<input type="file" webkitdirectory directory multiple accept="video/*,image/jpeg,image/png,.json,.txt,.md,.srt,.vtt" data-ycg-batch-folder></label><button type="button" data-ycg-action="batch-restore-manifest">Khôi phục manifest</button><button type="button" data-ycg-action="batch-open-galaxy">Creator Galaxy</button></div><ul><li><b>${fleetUploadFiles.length}</b> video</li><li><b>${batchThumbnailFiles.size}</b> thumbnail</li><li><b>${batchSidecars.size}</b> sidecar</li><li><b>${fleetState.selectedChannelIds.length}</b> kênh</li></ul>${fleetUploadFiles.length ? `<div class="ycg-batch-automation"><button type="button" data-ycg-action="batch-ai-metadata" ${batchAiRunning ? "disabled" : ""}>${batchAiRunning ? `AI ${batchAiProgress.done}/${batchAiProgress.total}` : "✦ Tạo title, mô tả, tags và chữ thumbnail"}</button><label>Bắt đầu<input type="datetime-local" data-ycg-batch-start value="${esc(batchSchedule.startAt)}"></label><label>Cách nhau<input type="number" min="1" max="168" data-ycg-batch-spacing value="${batchSchedule.spacingHours}"><span>giờ</span></label><button type="button" data-ycg-action="batch-apply-schedule">Áp lịch toàn bộ</button><span>${esc(batchFolderName)}</span></div>` : `<div class="ycg-batch-empty"><strong>Chọn thư mục video để bắt đầu</strong><span>Trình duyệt chỉ đọc file sau khi bạn cấp quyền. Nếu tải lại trang, hãy chọn lại đúng thư mục để tiếp tục checkpoint.</span></div>`}</section>`;
  }

  function fleetFileFingerprint(file) {
    return file ? `${file.name}:${file.size}:${file.lastModified || 0}`.slice(0, 260) : "";
  }

  async function sampledFileChecksum(file) {
    if (!file || !window.crypto?.subtle) return "";
    const sampleSize = 64 * 1024;
    const head = await file.slice(0, Math.min(sampleSize, file.size)).arrayBuffer();
    const tail = file.size > sampleSize ? await file.slice(Math.max(0, file.size - sampleSize), file.size).arrayBuffer() : new ArrayBuffer(0);
    const metadata = new TextEncoder().encode(`${file.name}\n${file.size}\n${file.lastModified || 0}\n`);
    const joined = new Uint8Array(metadata.byteLength + head.byteLength + tail.byteLength);
    joined.set(metadata, 0);
    joined.set(new Uint8Array(head), metadata.byteLength);
    joined.set(new Uint8Array(tail), metadata.byteLength + head.byteLength);
    const digest = await window.crypto.subtle.digest("SHA-256", joined);
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  }

  function fleetFileByFingerprint(fingerprint = fleetState.activeFileFingerprint) {
    return fleetUploadFiles.find((file) => fleetFileFingerprint(file) === fingerprint) || null;
  }

  function fleetDraft(fingerprint = fleetState.activeFileFingerprint, file = fleetFileByFingerprint(fingerprint)) {
    if (!fingerprint) return null;
    if (!fleetState.videoDrafts[fingerprint]) {
      const title = String(file?.name || "Video mới").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 100);
      fleetState.videoDrafts[fingerprint] = {
        title,
        description: "",
        tags: "",
        idempotencyKey: "",
        thumbnailTitle: title.slice(0, 80),
        thumbnailSubtitle: "",
        thumbnailAccent: "#ff3158",
        thumbnailReady: false,
        checksum: "",
        aiDisclosure: "unreviewed",
        channelTitles: {}
      };
    }
    return fleetState.videoDrafts[fingerprint];
  }

  function syncActiveFleetDraftToLegacy() {
    const draft = fleetDraft();
    if (!draft) return;
    fleetState.title = draft.title;
    fleetState.description = draft.description;
    fleetState.tags = draft.tags;
    fleetState.thumbnailTitle = draft.thumbnailTitle;
    fleetState.thumbnailSubtitle = draft.thumbnailSubtitle;
    fleetState.thumbnailAccent = draft.thumbnailAccent;
    fleetState.aiDisclosure = normalizeAiDisclosure(draft.aiDisclosure);
    fleetState.containsSyntheticMedia = fleetState.aiDisclosure === "yes";
    fleetState.fileFingerprint = fleetState.activeFileFingerprint;
    fleetUploadFile = fleetFileByFingerprint();
  }

  function filteredFleetChannels(channels, observatoryRows = fleetObservatory?.channels || []) {
    const query = String(fleetState.channelSearch || "").trim().toLocaleLowerCase("vi");
    const observatoryMap = new Map(observatoryRows.map((row) => [row.channel?.id, row]));
    return channels.filter((channel) => {
      const row = observatoryMap.get(channel.id);
      const searchable = `${channel.title} ${channel.id} ${channel.account?.hint || ""}`.toLocaleLowerCase("vi");
      if (query && !searchable.includes(query)) return false;
      if (fleetState.channelFilter === "ready") return Boolean(channel.permissions?.upload && channel.token?.healthy);
      if (fleetState.channelFilter === "warning") return !channel.permissions?.upload || !channel.token?.healthy;
      if (fleetState.channelFilter === "uploading") return Number(row?.uploads?.pending || 0) > 0;
      if (fleetState.channelFilter === "error") return Number(row?.uploads?.failed || 0) > 0;
      return true;
    });
  }

  function uploadChannelAccountKey(channel) {
    return String(channel?.account?.key || channel?.account?.hint || "google").slice(0, 80);
  }

  function filteredUploadChannels(channels) {
    const query = String(fleetState.uploadChannelSearch || "").trim().toLocaleLowerCase("vi");
    const account = String(fleetState.uploadAccountFilter || "all");
    return channels.filter((channel) => {
      const searchable = `${channel.title || ""} ${channel.id || ""} ${channel.account?.hint || ""}`.toLocaleLowerCase("vi");
      return (!query || searchable.includes(query)) && (account === "all" || uploadChannelAccountKey(channel) === account);
    });
  }

  function fleetSelectionCapacity() {
    const maxChannels = Number(fleetOverview?.limits?.maxChannelsInVault || fleetObservatory?.limits?.maxChannelsInVault || channelStatus.bulk?.maxChannelsInVault || 100);
    return Math.min(100, Math.max(1, maxChannels));
  }

  function matrixTaskKey(fingerprint, channelId) {
    return `${String(fingerprint || "").slice(0, 260)}::${String(channelId || "").slice(0, 120)}`;
  }

  function matrixTask(fingerprint, channelId, create = false) {
    const key = matrixTaskKey(fingerprint, channelId);
    if (!fleetState.taskMatrix[key] && create) fleetState.taskMatrix[key] = { enabled: true, mode: "inherit", publishAt: "", aiDisclosure: normalizeAiDisclosure(fleetState.videoDrafts[fingerprint]?.aiDisclosure) };
    return fleetState.taskMatrix[key] || { enabled: true, mode: "inherit", publishAt: "", aiDisclosure: normalizeAiDisclosure(fleetState.videoDrafts[fingerprint]?.aiDisclosure) };
  }

  function taskDelivery(fingerprint, channelId) {
    const cell = matrixTask(fingerprint, channelId);
    const preset = channelPreset(channelId);
    const mode = cell.mode === "inherit" ? preset.privacyStatus : cell.mode;
    const publishAt = mode === "schedule" ? (cell.publishAt || preset.publishAt || "") : "";
    return {
      enabled: cell.enabled !== false,
      privacyStatus: mode === "unlisted" ? "unlisted" : mode === "schedule" ? "schedule" : "private",
      publishAt,
      aiDisclosure: normalizeAiDisclosure(cell.aiDisclosure, fleetState.videoDrafts[fingerprint]?.aiDisclosure || "unreviewed")
    };
  }

  function selectedMatrixTasks(channelIds = fleetState.selectedChannelIds) {
    return fleetUploadFiles.flatMap((file) => {
      const fingerprint = fleetFileFingerprint(file);
      return channelIds.filter((channelId) => taskDelivery(fingerprint, channelId).enabled).map((channelId) => ({
        taskKey: matrixTaskKey(fingerprint, channelId), fingerprint, channelId, file
      }));
    });
  }

  function metadataVersionFor(draft, channelId, delivery) {
    const preset = channelPreset(channelId);
    const source = JSON.stringify({ title: effectiveChannelTitle(channelId, draft), description: draft?.description || "", tags: draft?.tags || "", preset, delivery });
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
    return `m${(hash >>> 0).toString(36)}`;
  }

  function invalidateFleetPublish({ clearResults = false } = {}) {
    fleetState.idempotencyKey = "";
    Object.values(fleetState.videoDrafts || {}).forEach((draft) => { draft.idempotencyKey = ""; });
    fleetPreflight = null;
    if (clearResults) fleetState.results = [];
  }

  function invalidateFleetThumbnails() {
    const prefix = `${fleetState.activeFileFingerprint}:`;
    [...fleetThumbnailVariants.keys()].filter((key) => key.startsWith(prefix)).forEach((key) => fleetThumbnailVariants.delete(key));
    const draft = fleetDraft();
    if (draft) draft.thumbnailReady = false;
    fleetPreflight = null;
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
    const response = await fetch(apiUrl(path), {
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
    if (!connected && !oauthError) return false;
    params.delete("youtubeConnected");
    params.delete("youtubeError");
    history.replaceState({}, "", `${location.pathname}${params.toString() ? `?${params}` : ""}${location.hash}`);
    errorMessage = oauthError || "";
    return true;
  }

  async function refresh(all = true, preserveError = false) {
    busy = "refresh";
    if (!preserveError) errorMessage = "";
    render();
    try {
      channelStatus = await api("status");
      const nextStorageChannel = String(channelStatus.channel?.id || "unassigned").replace(/[^a-z0-9_-]/gi, "").slice(0, 120) || "unassigned";
      if (nextStorageChannel !== storageChannelId) {
        storageChannelId = nextStorageChannel;
        state = loadState();
      }
      if (all && channelStatus.connected) {
        const [dashboardResult, overviewResult, jobsResult, observatoryResult] = await Promise.all([
          api("dashboard"),
          api("channels/overview"),
          api("bulk/jobs").catch(() => ({ jobs: [] })),
          api("channels/observatory").catch(() => null)
        ]);
        dashboard = dashboardResult;
        fleetOverview = overviewResult;
        fleetJobs = jobsResult.jobs || [];
        fleetObservatory = observatoryResult;
        if (dashboard.project) {
          state.publishProject = dashboard.project;
          saveState();
        }
        if (state.active === "comments" || (state.active === "fleet" && fleetState.studioTab === "comments")) {
          const drafts = await api("comments/drafts").catch(() => ({ drafts: [] }));
          commentDrafts = drafts.drafts || [];
        }
        if ((state.active === "analytics" || (state.active === "fleet" && fleetState.studioTab === "analytics")) && channelStatus.permissions?.analytics && !comparisonData) {
          const comparison = await api("analytics/comparison").catch(() => null);
          comparisonData = comparison?.comparison || null;
        }
        const routeTarget = videoRouteTarget();
        if (routeTarget) {
          fleetState.studioTab = "content";
          fleetState.contentMode = "manager";
          saveFleetState();
          await loadVideoWorkspace(routeTarget.channelId, routeTarget.videoId);
        }
      }
      else if (!channelStatus.connected) {
        dashboard = null;
        fleetOverview = null;
        fleetJobs = [];
        fleetObservatory = null;
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

  function connectedChannels() {
    return (Array.isArray(channelStatus.channels) ? channelStatus.channels : [])
      .filter(Boolean)
      .slice(0, 24);
  }

  function channelSwitcherMarkup(label = "Channel") {
    const channels = connectedChannels();
    if (!channels.length) {
      return `<button type="button" class="is-primary" data-ycg-action="connect-creator">+ Add YouTube channel</button>`;
    }
    return `<label class="ycg-channel-switcher"><span>${esc(label)}</span><select data-ycg-channel-select aria-label="${esc(label)}">${channels.map((item) => `<option value="${esc(item.id)}" ${item.id === channelStatus.channel?.id ? "selected" : ""}>${esc(item.title)} · ${esc(item.account?.hint || "Google")}</option>`).join("")}</select></label>`;
  }

  function studioControlBar() {
    const channels = connectedChannels();
    const jobs = Array.isArray(fleetJobs) ? fleetJobs : [];
    const selected = new Set(fleetState.selectedChannelIds || []);
    const processingJobs = jobs.filter((job) => ["queued", "uploading", "processing", "running"].includes(job.status)).length;
    return `<section class="ycg-studio-bar" aria-label="YouTube Studio control bar">
      <div class="ycg-studio-bar__brand"><span class="ycg-studio-bar__orb">YT</span><div><strong>Creator Studio Control Deck</strong><small>${channels.length ? `${channels.length} channels · ${selected.size} selected for bulk` : "Connect a channel to start"}</small></div></div>
      <div class="ycg-studio-bar__stats"><span><b>${fmt(channels.length)}</b> Channels</span><span><b>${fmt(processingJobs)}</b> Jobs running</span><span><b>${fmt(fleetJobs.length)}</b> Jobs logged</span></div>
      <div class="ycg-studio-bar__actions">${channelSwitcherMarkup("Manage channel")}<button type="button" data-ycg-action="open-command">Overview</button><button type="button" data-ycg-action="open-fleet">Bulk Studio</button></div>
    </section>`;
  }

  function studioOverviewMarkup() {
    const channels = fleetOverview?.channels || connectedChannels();
    const jobs = Array.isArray(fleetJobs) ? fleetJobs : [];
    const activeJobs = jobs.filter((job) => ["queued", "uploading", "processing", "running"].includes(job.status)).length;
    if (!channels.length) return "";
    return `<section class="ycg-panel ycg-studio-overview" aria-label="Multi-channel studio overview">
      <header><div><small>STUDIO CONTROL DECK</small><h3>Quản lý ${fmt(channels.length)} kênh trong một nơi</h3></div><div class="ycg-studio-overview__actions"><span>${fmt(activeJobs)} bulk job đang chạy</span><button type="button" data-ycg-action="open-fleet">Mở Bulk Studio</button></div></header>
      <div class="ycg-channel-grid">${channels.map((channel) => {
        const active = channel.id === channelStatus.channel?.id;
        const permissions = channel.permissions || {};
        const uploadReady = Boolean(permissions.upload);
        return `<article class="ycg-channel-tile ${active ? "is-active" : ""}">
          <div class="ycg-channel-tile__top">${channel.thumbnail ? `<img src="${esc(channel.thumbnail)}" alt="">` : "<span>YT</span>"}<i class="${uploadReady ? "is-ready" : "is-warning"}"></i></div>
          <strong>${esc(channel.title || "YouTube channel")}</strong><small>${esc(channel.account?.hint || "Google account")} · ${active ? "Đang quản lý" : "Đã kết nối"}</small>
          <div class="ycg-channel-tile__rights"><em class="${permissions.upload ? "is-ready" : ""}">Upload</em><em class="${permissions.manage ? "is-ready" : ""}">Manage</em><em class="${permissions.analytics ? "is-ready" : ""}">Analytics</em></div>
        </article>`;
      }).join("")}</div>
      <p class="ycg-studio-note">Số liệu video, bình luận và Analytics được tải theo kênh đang chọn; không gộp số liệu giả giữa các kênh.</p>
    </section>`;
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
    return `${studioOverviewMarkup()}<div class="ycg-command-grid">
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
        <button class="is-primary" data-ycg-action="connect-creator"><strong>Creator đã duyệt</strong><small>youtube.upload + youtube.force-ssl</small></button>
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

  function channelPreset(channelId) {
    const id = String(channelId || "");
    if (!fleetState.channelPresets[id]) fleetState.channelPresets[id] = { ...DEFAULT_CHANNEL_PRESET };
    return fleetState.channelPresets[id];
  }

  function effectiveChannelTitle(channelId, draft = fleetDraft()) {
    const preset = channelPreset(channelId);
    const baseTitle = draft?.title || fleetState.title;
    return (draft?.channelTitles?.[channelId] || `${preset.titlePrefix}${baseTitle}${preset.titleSuffix}`).trim().slice(0, 100);
  }

  function channelPublishReadiness(channel) {
    const preset = channelPreset(channel.id);
    const title = effectiveChannelTitle(channel.id);
    const scheduleReady = preset.privacyStatus !== "schedule"
      || (preset.publishAt && new Date(preset.publishAt).getTime() > Date.now() + 60_000);
    const fileReady = fleetUploadFiles.length > 0 && fleetUploadFiles.every((file) => file.size > 0 && (/^(video\/|application\/octet-stream)/.test(file.type || "application/octet-stream") || /\.(mp4|mov|webm|mkv)$/i.test(file.name)));
    const checks = [
      ["scope", Boolean(channel.permissions?.upload)],
      ["title", Boolean(title)],
      ["video", fileReady],
      ["rights", Boolean(fleetState.rightsConfirmed)],
      ["schedule", Boolean(scheduleReady)]
    ];
    return { ready: checks.every(([, pass]) => pass), checks, title, preset };
  }

  function legacyFleetView() {
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
          <div class="ycg-fleet-preflight">${fleetPreflight ? `<strong class="${fleetPreflight.ready ? "is-ready" : ""}">${fleetPreflight.ready ? "✓ Tất cả kênh sẵn sàng" : "! Có kênh thiếu quyền"}</strong><small>Ước tính ${fmt(fleetPreflight.estimatedQuota)} quota unit · ${fleetPreflight.aiReview?.unreviewed ? `${fleetPreflight.aiReview.unreviewed} tác vụ AI chưa kiểm tra; chỉ được Private` : "khai báo AI đã hoàn tất"}</small>` : "Chạy preflight để kiểm tra quyền upload, refresh token và khai báo AI của từng tác vụ."}</div>
          <div class="ycg-action-row"><button type="button" data-ycg-action="fleet-preflight">Kiểm tra ${selected.size} kênh</button><button class="is-primary" type="submit" ${busy.startsWith("bulk/") ? "disabled" : ""}>${busy.startsWith("bulk/") ? "Đang tạo phiên…" : "Tạo job và upload"}</button></div>
        </form>
      </section>
      <section class="ycg-panel ycg-fleet-jobs">
        <header><div><small>REAL JOB HISTORY</small><h3>Tiến trình theo từng kênh</h3></div><button data-ycg-action="fleet-refresh">Làm mới</button></header>
        <div>${fleetState.results.map((item) => `<article><strong>${esc(item.channelTitle || item.channelId)}</strong><span>${esc(item.status)}${Number.isFinite(item.progress) ? ` · ${item.progress.toFixed(1)}%` : ""}</span><small>${esc(item.error || item.videoId || "")}</small></article>`).join("")}${fleetJobs.map((job) => `<article><strong>Job ${esc(job.id)}</strong><span>${esc(job.status)}</span><small>${job.channelIds.length} kênh · ${dateTime(job.createdAt)}</small></article>`).join("") || (!fleetState.results.length ? "<p>Chưa có job bulk nào. Hệ thống không tạo tiến trình mẫu.</p>" : "")}</div>
      </section>
    </div>`;
  }

  function legacyQuickFleetView() {
    if (!channelStatus.connected) return emptyState(
      "Kết nối kênh để mở Quick Publish Studio",
      "Mỗi tài khoản HH có kho Google/YouTube riêng. Kênh và token của người khác không bao giờ xuất hiện tại đây.",
      channelStatus.authRequired ? "signin" : "connect-creator",
      channelStatus.authRequired ? "Đăng nhập" : "Kết nối tài khoản"
    );
    const channels = (fleetOverview?.channels || channelStatus.channels || []).filter(Boolean);
    const accounts = fleetOverview?.accounts || [];
    const limit = Number(fleetOverview?.limits?.maxChannelsPerBulkJob || channelStatus.bulk?.maxChannelsPerJob || 5);
    const selected = new Set(fleetState.selectedChannelIds);
    const selectedChannels = channels.filter((channel) => selected.has(channel.id));
    const preflightRows = fleetPreflight?.channels || [];
    const readyChannels = selectedChannels.filter((channel) => channelPublishReadiness(channel).ready);
    const connectionDownlink = Number(navigator.connection?.downlink || 0);
    const effectiveConcurrency = connectionDownlink > 0 && connectionDownlink < 3 ? 1 : Math.min(3, Math.max(1, Number(fleetState.concurrency || 2)));
    const variants = ["A", "B", "C"];
    return `<div class="ycg-quick-publish" data-ycg-quick-publish>
      <section class="ycg-panel ycg-quick-head">
        <header><div><small>ONE SCREEN · REAL YOUTUBE WORKFLOW</small><h3>Quick Publish Studio</h3></div><span>${readyChannels.length}/${selectedChannels.length} kênh sẵn sàng</span></header>
        <div class="ycg-quick-steps"><span class="${fleetUploadFile ? "is-ready" : ""}"><i>1</i>Video</span><span class="${selected.size ? "is-ready" : ""}"><i>2</i>Kênh</span><span class="${fleetState.title ? "is-ready" : ""}"><i>3</i>Metadata</span><span class="${fleetState.thumbnailTitle ? "is-ready" : ""}"><i>4</i>Thumbnail</span><span class="${fleetPreflight?.ready ? "is-ready" : ""}"><i>5</i>Preflight</span><span><i>6</i>Upload</span></div>
        <div class="ycg-shortcut-strip"><kbd>Ctrl U</kbd> Chọn video <kbd>T</kbd> Thumbnail <kbd>F</kbd> Lấy frame <kbd>Ctrl D</kbd> Copy metadata <kbd>Ctrl Enter</kbd> Preflight <kbd>1–3</kbd> Chọn A/B/C</div>
      </section>
      <form data-ycg-fleet-form class="ycg-quick-form">
        <section class="ycg-panel ycg-fleet-vault">
          <header><div><small>CHANNEL VAULT</small><h3>${channels.length} kênh · ${accounts.length || 1} tài khoản Google</h3></div><span>Tối đa ${limit} kênh/job</span></header>
          <div class="ycg-fleet-accounts">${accounts.map((account) => `<article><strong>${esc(account.hint)}</strong><small>${account.channels.length} kênh · mã ${esc(account.key)}</small></article>`).join("") || `<article><strong>${esc(channelStatus.channel?.account?.hint || "Tài khoản Google")}</strong><small>Chỉ chủ sở hữu HH nhìn thấy</small></article>`}</div>
          <div class="ycg-fleet-channels">${channels.map((channel) => {
            const readiness = channelPublishReadiness(channel);
            const serverReady = preflightRows.find((item) => item.channel?.id === channel.id)?.ready;
            return `<label class="${selected.has(channel.id) ? "is-selected" : ""}">
              <input type="checkbox" data-ycg-fleet-channel value="${esc(channel.id)}" ${selected.has(channel.id) ? "checked" : ""}>
              ${channel.thumbnail ? `<img src="${esc(channel.thumbnail)}" alt="">` : "<i>YT</i>"}
              <span><strong>${esc(channel.title)}</strong><small>${esc(channel.account?.hint || "Google")} · ${channel.permissions?.upload ? "Upload ready" : "Thiếu scope upload"}</small></span>
              <b>${serverReady ? "✓ Ready" : selected.has(channel.id) && fleetPreflight ? "Cần xử lý" : readiness.ready ? "Local ready" : "Chọn"}</b>
            </label>`;
          }).join("")}</div>
          <div class="ycg-action-row"><button type="button" data-ycg-action="fleet-select-all">Chọn tối đa ${limit}</button><button type="button" data-ycg-action="fleet-clear">Đặt lại</button><button type="button" data-ycg-action="connect-creator">+ Thêm kênh</button></div>
        </section>

        <section class="ycg-panel ycg-quick-media">
          <header><div><small>MEDIA & MASTER METADATA</small><h3>Video dùng chung</h3></div><span>Upload thẳng tới YouTube</span></header>
          <label class="ycg-fleet-file" data-ycg-fleet-drop><span>Kéo hoặc chọn MP4 / MOV / WebM</span><input type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska" data-ycg-fleet-file required><small>${fleetUploadFile ? `${esc(fleetUploadFile.name)} · ${bytes(fleetUploadFile.size)}` : "Video không được lưu vào database HH."}</small></label>
          <video class="ycg-quick-video" data-ycg-fleet-preview controls muted playsinline preload="metadata" ${thumbnailVideoUrl ? `src="${esc(thumbnailVideoUrl)}"` : ""}></video>
          <label>Tiêu đề gốc<input name="title" maxlength="100" value="${esc(fleetState.title)}" placeholder="Tiêu đề sẽ được preset từng kênh xử lý" required></label>
          <label>Mô tả gốc<textarea name="description" maxlength="5000" rows="5">${esc(fleetState.description)}</textarea></label>
          <label>Tags mặc định<input name="tags" maxlength="500" value="${esc(fleetState.tags)}"></label>
          <div class="ycg-inline-fields"><label>Chế độ đích<select name="privacyStatus"><option value="private" ${fleetState.privacyStatus === "private" ? "selected" : ""}>Private</option><option value="unlisted" ${fleetState.privacyStatus === "unlisted" ? "selected" : ""}>Unlisted</option></select></label><label>Upload song song<select name="concurrency"><option value="1" ${fleetState.concurrency === 1 ? "selected" : ""}>1 kênh</option><option value="2" ${fleetState.concurrency === 2 ? "selected" : ""}>2 kênh</option><option value="3" ${fleetState.concurrency === 3 ? "selected" : ""}>3 kênh</option></select></label></div>
          <small class="ycg-network-note">Đang dùng ${effectiveConcurrency} luồng${connectionDownlink ? ` · mạng ${connectionDownlink.toFixed(1)} Mbps` : ""}. Mạng yếu tự giảm còn 1.</small>
          <div class="ycg-quick-toggles"><label><input type="checkbox" name="uploadPrivateFirst" ${fleetState.uploadPrivateFirst ? "checked" : ""}> Upload Private trước</label><label><input type="checkbox" name="madeForKids" ${fleetState.madeForKids ? "checked" : ""}> Dành cho trẻ em</label></div>
          <label class="ycg-ai-disclosure">Video có chứa nội dung được tạo hoặc chỉnh sửa đáng kể bằng AI và trông như thật không?<select name="aiDisclosure"><option value="unreviewed" ${fleetState.aiDisclosure === "unreviewed" ? "selected" : ""}>Chưa kiểm tra · chỉ upload Private</option><option value="yes" ${fleetState.aiDisclosure === "yes" ? "selected" : ""}>Có · khai báo với YouTube</option><option value="no" ${fleetState.aiDisclosure === "no" ? "selected" : ""}>Không · đã kiểm tra</option></select><small>AI hỗ trợ tiêu đề, kịch bản, thumbnail, caption hoặc chỉnh màu nhẹ không tự động bị đánh dấu.</small></label>
        </section>

        <section class="ycg-panel ycg-thumbnail-fastlane" data-ycg-thumbnail-fastlane>
          <header><div><small>THUMBNAIL FAST LANE · 1280×720</small><h3>Lấy frame → Brand Kit → A/B/C</h3></div><span>Preview giống kích thước YouTube</span></header>
          <canvas width="1280" height="720" data-ycg-fleet-thumbnail aria-label="Thumbnail Fast Lane"></canvas>
          <div class="ycg-thumb-mini-row">${variants.map((variant) => `<button type="button" data-ycg-fleet-variant="${variant}" class="${fleetState.thumbnailVariant === variant ? "is-active" : ""}"><canvas width="320" height="180" data-ycg-fleet-thumbnail-mini="${variant}" aria-label="Bản thumbnail ${variant}"></canvas><span><b>${variant}</b> · ${variant === "A" ? "Tương phản" : variant === "B" ? "Sạch" : "Điện ảnh"}</span></button>`).join("")}</div>
          <div class="ycg-inline-fields"><label>Chữ lớn<input data-ycg-fleet-thumb="title" maxlength="80" value="${esc(fleetState.thumbnailTitle)}"></label><label>Chữ phụ<input data-ycg-fleet-thumb="subtitle" maxlength="80" value="${esc(fleetState.thumbnailSubtitle)}"></label><label>Màu Brand<input type="color" data-ycg-fleet-thumb="accent" value="${esc(fleetState.thumbnailAccent)}"></label></div>
          <div class="ycg-action-row"><button type="button" data-ycg-action="fleet-capture-frame">Lấy frame hiện tại</button><button type="button" data-ycg-action="fleet-apply-brand">Áp Brand Kit</button><button type="button" data-ycg-action="fleet-generate-variants">Tạo 3 bản</button><button type="button" data-ycg-action="fleet-copy-thumbnail">Copy sang kênh đã chọn</button></div>
          <p class="ycg-studio-note">Safe zone được vẽ trong editor nhưng không xuất vào thumbnail. Tách nền nâng cao chỉ chạy khi provider thật đã cấu hình.</p>
        </section>

        <section class="ycg-panel ycg-channel-metadata">
          <header><div><small>CHANNEL OVERRIDES</small><h3>Metadata theo từng kênh</h3></div><div class="ycg-table-actions"><button type="button" data-ycg-action="fleet-copy-metadata">Copy master</button><button type="button" data-ycg-action="fleet-find-replace">Tìm & thay thế</button></div></header>
          <div class="ycg-find-replace"><input data-ycg-fleet-state="replaceFind" value="${esc(fleetState.replaceFind)}" placeholder="Tìm trong tiêu đề"><input data-ycg-fleet-state="replaceWith" value="${esc(fleetState.replaceWith)}" placeholder="Thay bằng"></div>
          <div class="ycg-metadata-table-wrap"><table class="ycg-metadata-table"><thead><tr><th>Kênh</th><th>Tiêu đề</th><th>Thumb</th><th>Playlist</th><th>Lịch đăng</th><th>Trạng thái</th></tr></thead><tbody>${selectedChannels.map((channel) => {
            const readiness = channelPublishReadiness(channel);
            const preset = readiness.preset;
            const playlists = Array.isArray(channel.playlists) && channel.playlists.length
              ? channel.playlists
              : channel.id === channelStatus.channel?.id ? channelStatus.playlists || [] : [];
            const playlistOptions = playlists.map((item) => `<option value="${esc(item.id)}" ${preset.playlistId === item.id ? "selected" : ""}>${esc(item.title)}</option>`).join("");
            return `<tr data-ycg-channel-row="${esc(channel.id)}"><td><div class="ycg-table-channel">${channel.thumbnail ? `<img src="${esc(channel.thumbnail)}" alt="">` : "<i>YT</i>"}<span><strong>${esc(channel.title)}</strong><small>${esc(channel.account?.hint || "Google")}</small></span></div></td><td><input data-ycg-channel-preset="titleOverride" data-channel-id="${esc(channel.id)}" maxlength="100" value="${esc(readiness.title)}" ${preset.locked ? "readonly" : ""}></td><td><select data-ycg-channel-preset="thumbnailVariant" data-channel-id="${esc(channel.id)}">${variants.map((variant) => `<option ${preset.thumbnailVariant === variant ? "selected" : ""}>${variant}</option>`).join("")}</select></td><td><select data-ycg-channel-preset="playlistId" data-channel-id="${esc(channel.id)}"><option value="">Không playlist</option>${playlistOptions}</select></td><td><input type="datetime-local" data-ycg-channel-preset="publishAt" data-channel-id="${esc(channel.id)}" value="${esc(preset.publishAt)}"></td><td><button type="button" class="ycg-lock ${preset.locked ? "is-locked" : ""}" data-ycg-preset-lock="${esc(channel.id)}">${preset.locked ? "Đã khóa" : readiness.ready ? "Sẵn sàng" : "Cần sửa"}</button></td></tr>`;
          }).join("") || `<tr><td colspan="6">Chọn ít nhất một kênh để tạo bảng metadata.</td></tr>`}</tbody></table></div>
          <div class="ycg-channel-preset-grid">${selectedChannels.map((channel) => {
            const preset = channelPreset(channel.id);
            return `<details><summary><span>${channel.thumbnail ? `<img src="${esc(channel.thumbnail)}" alt="">` : "<i>YT</i>"}<strong>Preset · ${esc(channel.title)}</strong></span><small>Tiêu đề, mô tả, tag, màu và quyền riêng tư</small></summary><div>
              <label>Tiền tố tiêu đề<input data-ycg-channel-preset="titlePrefix" data-channel-id="${esc(channel.id)}" maxlength="40" value="${esc(preset.titlePrefix)}"></label>
              <label>Hậu tố tiêu đề<input data-ycg-channel-preset="titleSuffix" data-channel-id="${esc(channel.id)}" maxlength="40" value="${esc(preset.titleSuffix)}"></label>
              <label class="is-wide">Mẫu mô tả<textarea data-ycg-channel-preset="descriptionTemplate" data-channel-id="${esc(channel.id)}" maxlength="3000" rows="3">${esc(preset.descriptionTemplate)}</textarea></label>
              <label class="is-wide">Tag mặc định<input data-ycg-channel-preset="tags" data-channel-id="${esc(channel.id)}" maxlength="480" value="${esc(preset.tags)}"></label>
              <label>Category ID<input data-ycg-channel-preset="categoryId" data-channel-id="${esc(channel.id)}" inputmode="numeric" maxlength="3" value="${esc(preset.categoryId)}"></label>
              <label>Ngôn ngữ<input data-ycg-channel-preset="defaultLanguage" data-channel-id="${esc(channel.id)}" maxlength="12" value="${esc(preset.defaultLanguage)}"></label>
              <label>Màu Brand<input type="color" data-ycg-channel-preset="brandColor" data-channel-id="${esc(channel.id)}" value="${esc(preset.brandColor)}"></label>
              <label>Quyền riêng tư<select data-ycg-channel-preset="privacyStatus" data-channel-id="${esc(channel.id)}"><option value="private" ${preset.privacyStatus === "private" ? "selected" : ""}>Private</option><option value="unlisted" ${preset.privacyStatus === "unlisted" ? "selected" : ""}>Unlisted</option><option value="schedule" ${preset.privacyStatus === "schedule" ? "selected" : ""}>Lên lịch</option></select></label>
            </div></details>`;
          }).join("")}</div>
        </section>

        <section class="ycg-panel ycg-quick-preflight">
          <header><div><small>ONE-CLICK PREFLIGHT</small><h3>Kiểm tra rồi upload</h3></div><span>${fleetPreflight?.ready ? "Sẵn sàng" : "Chưa kiểm tra"}</span></header>
          <label class="ycg-fleet-confirm"><input type="checkbox" name="rightsConfirmed" ${fleetState.rightsConfirmed ? "checked" : ""} required><span>Tôi có quyền sử dụng video, ảnh, nhạc, font và thumbnail.</span></label>
          <div class="ycg-fleet-preflight">${fleetPreflight ? `<strong class="${fleetPreflight.ready && readyChannels.length === selectedChannels.length ? "is-ready" : ""}">${fleetPreflight.ready && readyChannels.length === selectedChannels.length ? "✓ Tất cả kênh sẵn sàng" : `! ${selectedChannels.length - readyChannels.length} kênh cần xử lý`}</strong><small>${fmt(fleetPreflight.estimatedQuota)} quota unit ước tính · ${fleetPreflight.aiReview?.unreviewed ? `${fleetPreflight.aiReview.unreviewed} tác vụ AI chưa kiểm tra; chỉ upload Private` : "khai báo AI đã hoàn tất"}</small>` : "Kiểm tra scope, refresh token, video, tiêu đề, lịch đăng, khai báo AI và quyền nội dung."}</div>
          <div class="ycg-action-row"><button type="button" data-ycg-action="fleet-preflight">Preflight ${selected.size} kênh</button><button class="is-primary" type="submit" ${busy.startsWith("bulk/") ? "disabled" : ""}>${busy.startsWith("bulk/") ? "Đang xử lý…" : "Preflight & Upload"}</button></div>
          <p class="ycg-honesty">Mặc định upload Private trước, chờ YouTube xử lý HD rồi mới duyệt thumbnail, caption, playlist và quyền hiển thị.</p>
        </section>

        <section class="ycg-panel ycg-fleet-jobs">
          <header><div><small>RESUMABLE QUEUE</small><h3>Tiến trình theo từng kênh</h3></div><button type="button" data-ycg-action="fleet-refresh">Làm mới</button></header>
          <div>${fleetState.results.map((item) => `<article><strong>${esc(item.channelTitle || item.channelId)}</strong><span>${esc(item.status)}${Number.isFinite(item.progress) ? ` · ${item.progress.toFixed(1)}%` : ""}</span><small>${esc(item.error || item.videoId || "")}${item.status === "uploading" && item.speedBps ? ` · ${bytes(item.speedBps)}/s · ETA ${Math.ceil(item.etaSeconds || 0)}s` : ""}</small>${item.status === "failed" && item.uploadId ? `<button type="button" data-ycg-fleet-retry="${esc(item.channelId)}">Thử lại kênh này</button>` : item.status === "uploaded" && item.uploadId ? `<button type="button" data-ycg-fleet-approve="${esc(item.channelId)}">Duyệt lịch/hiển thị</button>` : ""}</article>`).join("")}${fleetJobs.map((job) => `<article><strong>Job ${esc(job.id)}</strong><span>${esc(job.status)}</span><small>${job.channelIds.length} kênh · ${dateTime(job.createdAt)}</small></article>`).join("") || (!fleetState.results.length ? "<p>Chưa có job. Tiến trình chỉ xuất hiện khi backend tạo phiên thật.</p>" : "")}</div>
        </section>
      </form>
    </div>`;
  }

  function batchMatrixMarkup(selectedChannels, limits) {
    const completed = new Set(fleetState.results.filter((item) => item.videoId && ["processing", "uploaded", "scheduled", "private", "unlisted", "published", "completed"].includes(item.status)).map((item) => item.taskKey));
    const enabledCount = selectedMatrixTasks(selectedChannels.map((channel) => channel.id)).filter((task) => !completed.has(task.taskKey)).length;
    const batches = Math.max(0, Math.ceil(enabledCount / Math.max(1, Number(limits.maxTasksPerBatch || 100))));
    return `<section class="ycg-panel ycg-batch-matrix">
      <header><div><small>BATCH UPLOAD MATRIX</small><h3>Ma trận video × kênh</h3><p>Bật hoặc tắt từng tác vụ. Lịch riêng trong ô sẽ ưu tiên hơn preset của kênh.</p></div><div><strong>${enabledCount}</strong><span>tác vụ còn lại · ${batches} batch</span></div></header>
      <div class="ycg-matrix-toolbar"><button type="button" data-ycg-action="matrix-enable-all">Bật tất cả</button><button type="button" data-ycg-action="matrix-disable-all">Tắt tất cả</button><button type="button" data-ycg-action="matrix-copy-first-channel">Copy lịch kênh đầu sang các kênh</button><label>Khai báo AI<select data-ycg-matrix-ai-bulk><option value="unreviewed">Chưa kiểm tra</option><option value="yes">Có AI</option><option value="no">Không AI</option></select></label><button type="button" data-ycg-action="matrix-apply-ai">Áp dụng cho tác vụ đang bật</button><span>Tự chia ${limits.maxTasksPerBatch} tác vụ/batch</span></div>
      <div class="ycg-batch-matrix__scroll"><table><thead><tr><th>Video</th>${selectedChannels.map((channel) => `<th title="${esc(channel.title)}">${channel.thumbnail ? `<img src="${esc(channel.thumbnail)}" alt="">` : "YT"}<span>${esc(channel.title)}</span></th>`).join("")}<th>Tiến trình</th></tr></thead><tbody>${fleetUploadFiles.map((file, videoIndex) => {
        const fingerprint = fleetFileFingerprint(file);
        const draft = fleetDraft(fingerprint, file);
        const tasks = selectedChannels.map((channel) => {
          const config = matrixTask(fingerprint, channel.id);
          const delivery = taskDelivery(fingerprint, channel.id);
          const taskKey = matrixTaskKey(fingerprint, channel.id);
          const result = fleetState.results.find((item) => item.taskKey === taskKey);
          const value = config.enabled === false ? "off" : config.mode || "inherit";
          return `<td class="${config.enabled === false ? "is-disabled" : result ? `is-${esc(result.status)}` : ""}"><select data-ycg-matrix-mode data-fingerprint="${esc(fingerprint)}" data-channel-id="${esc(channel.id)}" aria-label="${esc(draft.title)} tới ${esc(channel.title)}"><option value="off" ${value === "off" ? "selected" : ""}>Không đăng</option><option value="inherit" ${value === "inherit" ? "selected" : ""}>Theo kênh</option><option value="private" ${value === "private" ? "selected" : ""}>Private</option><option value="unlisted" ${value === "unlisted" ? "selected" : ""}>Unlisted</option><option value="schedule" ${value === "schedule" ? "selected" : ""}>Lên lịch</option></select><select class="ycg-matrix-ai" data-ycg-matrix-ai data-fingerprint="${esc(fingerprint)}" data-channel-id="${esc(channel.id)}" aria-label="Khai báo AI cho ${esc(draft.title)} trên ${esc(channel.title)}"><option value="unreviewed" ${delivery.aiDisclosure === "unreviewed" ? "selected" : ""}>AI: Chưa kiểm tra</option><option value="yes" ${delivery.aiDisclosure === "yes" ? "selected" : ""}>AI: Có</option><option value="no" ${delivery.aiDisclosure === "no" ? "selected" : ""}>AI: Không</option></select>${value === "schedule" ? `<input type="datetime-local" data-ycg-matrix-time data-fingerprint="${esc(fingerprint)}" data-channel-id="${esc(channel.id)}" value="${esc(config.publishAt || delivery.publishAt)}">` : ""}<small>${result ? `${esc(result.status)} · ${Number(result.progress || 0).toFixed(0)}%` : delivery.aiDisclosure === "unreviewed" && delivery.privacyStatus === "schedule" ? "Cần khai báo AI trước khi lên lịch" : delivery.publishAt ? dateTime(delivery.publishAt) : aiDisclosureLabel(delivery.aiDisclosure)}</small></td>`;
        }).join("");
        const done = selectedChannels.filter((channel) => completed.has(matrixTaskKey(fingerprint, channel.id))).length;
        return `<tr><th><button type="button" data-ycg-fleet-video="${esc(fingerprint)}"><i>${videoIndex + 1}</i><span><strong>${esc(draft.title || file.name)}</strong><small>${bytes(file.size)}</small></span></button></th>${tasks}<td><strong>${done}/${selectedChannels.length}</strong><small>${done ? "Đã hoàn thành" : "Chờ upload"}</small></td></tr>`;
      }).join("") || `<tr><td colspan="${selectedChannels.length + 2}">Kéo video vào hàng đợi để tạo ma trận.</td></tr>`}</tbody></table></div>
    </section>`;
  }

  function contentStage(item) {
    const status = String(item?.status || "").toLowerCase();
    if (["error", "failed", "rejected", "terminated"].includes(status) || item?.failureReason || item?.rejectionReason) return "error";
    if (["uploading", "queued", "verifying", "thumbnail"].includes(status)) return "uploading";
    if (["processing", "processing-sd", "processing-hd", "processing-4k"].includes(status) || ["processing", "pending"].includes(item?.processingStatus)) return "processing";
    if (item?.scheduledAt || item?.publishAt || status === "scheduled") return "scheduled";
    if (item?.videoId && (item?.privacyStatus === "public" || status === "published")) return "published";
    if (item?.videoId) return item?.privacyStatus === "private" ? "draft" : "published";
    return "draft";
  }

  function mergedContentItems() {
    const remoteKeys = new Set(contentLibrary.map((item) => item.uploadId || `${item.channelId}::${item.videoId}`));
    const local = fleetState.results.filter((item) => item.uploadId && !remoteKeys.has(item.uploadId)).map((item) => ({
      ...item,
      id: item.uploadId,
      title: item.fileName || "Video",
      thumbnail: "",
      privacyStatus: "private",
      processingStatus: item.status === "processing" ? "processing" : "",
      metrics: { views: 0, likes: 0, comments: 0 }
    }));
    return [...local, ...contentLibrary];
  }

  function contentDrawerMarkup(channels) {
    if (!contentDrawer) return "";
    if (contentDrawer.loading) return `<aside class="ycg-video-drawer is-open"><button type="button" class="ycg-video-drawer__backdrop" data-ycg-content-close aria-label="Đóng"></button><section><div class="ycg-loading"><i></i><strong>Đang tải chi tiết thật từ YouTube…</strong></div></section></aside>`;
    const item = contentDrawer.item || {};
    const videoId = item.videoId || "";
    const channel = channels.find((entry) => entry.id === item.channelId) || {};
    const canEmbed = videoId && item.privacyStatus !== "private";
    const tags = Array.isArray(item.tags) ? item.tags.join(", ") : item.tags || "";
    const playlists = channel.playlists || [];
    return `<aside class="ycg-video-drawer is-open"><button type="button" class="ycg-video-drawer__backdrop" data-ycg-content-close aria-label="Đóng"></button><section><header><div><small>VIDEO DETAIL</small><h3>${esc(item.title || "Chi tiết video")}</h3><span>${esc(channel.title || item.channelTitle || item.channelId || "Kênh")}</span></div><button type="button" data-ycg-content-close aria-label="Đóng">×</button></header><div class="ycg-video-drawer__media">${canEmbed ? `<iframe src="https://www.youtube-nocookie.com/embed/${esc(videoId)}" title="${esc(item.title || "YouTube video")}" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>` : item.thumbnail ? `<img src="${esc(item.thumbnail)}" alt="">` : `<div><strong>YT</strong><span>${videoId ? "Video Private · mở Studio để xem" : "Video chưa tải xong"}</span></div>`}</div>
      <form data-ycg-video-detail-form data-channel-id="${esc(item.channelId)}" data-video-id="${esc(videoId)}">
        <label>Tiêu đề<input name="title" maxlength="100" value="${esc(item.title || "")}" required></label>
        <label>Mô tả<textarea name="description" maxlength="5000" rows="7">${esc(item.description || "")}</textarea></label>
        <label>Tags<input name="tags" maxlength="500" value="${esc(tags)}"></label>
        <div class="ycg-inline-fields"><label>Playlist<select name="playlistId"><option value="">Không thay đổi</option>${playlists.map((playlist) => `<option value="${esc(playlist.id)}">${esc(playlist.title)}</option>`).join("")}</select></label><label>Category<input name="categoryId" value="${esc(item.categoryId || "22")}" maxlength="3"></label><label>Ngôn ngữ<input name="defaultLanguage" value="${esc(item.defaultLanguage || "vi")}" maxlength="12"></label></div>
        <div class="ycg-inline-fields"><label>Quyền hiển thị<select name="privacyStatus"><option value="private" ${item.privacyStatus === "private" ? "selected" : ""}>Private</option><option value="unlisted" ${item.privacyStatus === "unlisted" ? "selected" : ""}>Unlisted</option><option value="public" ${item.privacyStatus === "public" ? "selected" : ""}>Public · cần xác nhận</option><option value="schedule" ${item.scheduledAt ? "selected" : ""}>Lên lịch</option></select></label><label>Thời gian đăng<input type="datetime-local" name="publishAt" value="${esc(String(item.scheduledAt || "").slice(0,16))}"></label></div>
        <div class="ycg-quick-toggles"><label><input type="checkbox" name="madeForKids" ${item.madeForKids ? "checked" : ""}> Dành cho trẻ em</label></div>
        <label class="ycg-ai-disclosure">Video có chứa nội dung được tạo hoặc chỉnh sửa đáng kể bằng AI và trông như thật không?<select name="aiDisclosure"><option value="unreviewed" ${normalizeAiDisclosure(item.aiDisclosure) === "unreviewed" ? "selected" : ""}>Chưa kiểm tra · chặn Public/lên lịch</option><option value="yes" ${item.aiDisclosure === "yes" ? "selected" : ""}>Có · khai báo với YouTube</option><option value="no" ${item.aiDisclosure === "no" ? "selected" : ""}>Không · đã kiểm tra</option></select><small>Nguồn: ${esc(item.aiDisclosureSource === "user-declared" ? "Người dùng khai báo" : item.aiDisclosureSource === "youtube-status" ? "Trạng thái YouTube" : "Chưa xác định")}${item.aiDeclaredAt ? ` · ${dateTime(item.aiDeclaredAt)}` : ""}</small></label>
        <label class="ycg-detail-thumbnail">Thay thumbnail JPEG/PNG ≤ 2 MB<input type="file" accept="image/jpeg,image/png" data-ycg-detail-thumbnail data-channel-id="${esc(item.channelId)}" data-video-id="${esc(videoId)}"></label>
        <div class="ycg-detail-captions"><span>Caption</span><strong>${contentDrawer.captions?.length || 0} track</strong><small>${(contentDrawer.captions || []).map((track) => `${track.language} · ${track.status || "ready"}`).join(" · ") || "Chưa có caption track"}</small><button type="button" data-ycg-detail-captions="${esc(videoId)}">Mở Captions Studio</button></div>
        <div class="ycg-processing-ledger"><h4>Processing details</h4><p><span>Upload</span><b>${esc(item.uploadStatus || item.status || "không rõ")}</b></p><p><span>Xử lý</span><b>${esc(item.processingStatus || "chưa trả về")}</b></p><p><span>SD / HD / 4K</span><b>${esc(item.processingProgress || "YouTube đang quyết định")}</b></p>${item.failureReason || item.rejectionReason ? `<p class="is-error"><span>Lỗi</span><b>${esc(item.failureReason || item.rejectionReason)}</b></p>` : ""}</div>
        ${videoId ? `<section class="ycg-danger-zone"><div><strong>Vùng nguy hiểm</strong><small>Xóa khỏi YouTube là vĩnh viễn. Hãy ưu tiên chuyển Private hoặc Unlisted.</small></div><button type="button" data-ycg-content-delete-current>Xóa vĩnh viễn…</button></section>` : ""}
        <div class="ycg-video-drawer__actions"><button type="button" data-ycg-content-close>Đóng</button>${videoId ? `<a href="https://www.youtube.com/watch?v=${esc(videoId)}" target="_blank" rel="noopener">Mở YouTube</a><a href="https://studio.youtube.com/video/${esc(videoId)}/edit" target="_blank" rel="noopener">Mở YouTube Studio</a>` : ""}<button class="is-primary" ${videoId ? "" : "disabled"}>Lưu thay đổi</button></div>
      </form><section class="ycg-detail-audit"><h4>Nhật ký gần nhất</h4>${(contentDrawer.audit || []).map((entry) => `<p><time>${dateTime(entry.createdAt)}</time><span>${esc(entry.action)}</span><b>${esc(entry.status)}</b></p>`).join("") || `<p>Chưa có audit log cho video này.</p>`}</section></section></aside>`;
  }

  function videoStudioDetailsMarkup(item, channel, draft) {
    const duplicates = repeatedDescriptionLines(draft.description);
    const tags = String(draft.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 30);
    const playlists = channel.playlists || [];
    const categoryOptions = Object.entries(VIDEO_CATEGORIES).map(([id, label]) => `<option value="${id}" ${draft.categoryId === id ? "selected" : ""}>${esc(label)}</option>`).join("");
    const languageOptions = Object.entries(VIDEO_LANGUAGES).map(([id, label]) => `<option value="${id}" ${draft.defaultLanguage === id ? "selected" : ""}>${esc(label)} · ${id}</option>`).join("");
    return `<form id="ycg-video-workspace-form" class="ycg-video-editor-form" data-ycg-video-detail-form data-channel-id="${esc(item.channelId)}" data-video-id="${esc(item.videoId)}">
      <section class="ycg-video-card"><header><div><small>THÔNG TIN CƠ BẢN</small><h3>Chi tiết video</h3></div><span>Thông tin hiển thị trên YouTube</span></header>
        <label class="ycg-counted-field">Tiêu đề<span data-ycg-title-count>${draft.title.length}/100</span><input name="title" maxlength="100" value="${esc(draft.title)}" required></label>
        <label class="ycg-counted-field">Mô tả<span data-ycg-description-count>${draft.description.length}/5000</span><textarea name="description" maxlength="5000" rows="11">${esc(draft.description)}</textarea></label>
        <div class="ycg-insert-tools"><button type="button" data-ycg-editor-insert="template">Chèn template</button><button type="button" data-ycg-editor-insert="chapter">Chèn chapter</button><button type="button" data-ycg-editor-insert="hashtag">Chèn hashtag</button><button type="button" data-ycg-editor-insert="link">Chèn liên kết</button></div>
        ${duplicates.length ? `<div class="ycg-metadata-warning"><strong>Phát hiện nội dung mô tả bị lặp</strong>${duplicates.map((entry) => `<span>“${esc(entry.line.slice(0, 120))}” · ${entry.count} lần</span>`).join("")}<button type="button" data-ycg-action="video-remove-duplicates">Xóa dòng trùng</button></div>` : ""}
      </section>
      <section class="ycg-video-card"><header><div><small>THUMBNAIL</small><h3>Ảnh thu nhỏ</h3></div><span>1280 × 720 · JPEG/PNG ≤ 2 MB</span></header><div class="ycg-video-thumbnails"><article class="is-current">${item.thumbnail ? `<img src="${esc(item.thumbnail)}" alt="Thumbnail hiện tại">` : `<span>Chưa có thumbnail</span>`}<b>Hiện tại</b></article><article><span>A</span><b>Fast Lane A</b></article><article><span>B</span><b>Fast Lane B</b></article><article><span>C</span><b>Fast Lane C</b></article></div><div class="ycg-action-row"><label class="ycg-upload-button">Tải thumbnail<input type="file" accept="image/jpeg,image/png" data-ycg-detail-thumbnail data-channel-id="${esc(item.channelId)}" data-video-id="${esc(item.videoId)}"></label><button type="button" data-ycg-action="video-open-thumbnail">Mở Thumbnail Fast Lane</button><button type="button" data-ycg-action="video-frame-help">Lấy frame từ file nguồn</button></div><small class="ycg-api-note">YouTube Test & Compare vẫn được mở trong Studio; HH không tạo kết quả A/B giả.</small></section>
      <section class="ycg-video-card"><header><div><small>PHÂN LOẠI</small><h3>Playlist, category và ngôn ngữ</h3></div></header><div class="ycg-editor-grid"><label>Playlist<select name="playlistId"><option value="">Không thay đổi</option>${playlists.map((playlist) => `<option value="${esc(playlist.id)}" ${draft.playlistId === playlist.id ? "selected" : ""}>${esc(playlist.title)}</option>`).join("")}</select></label><label>Danh mục<select name="categoryId">${categoryOptions}</select></label><label>Ngôn ngữ<select name="defaultLanguage">${languageOptions}</select></label></div><label>Tags<input name="tags" maxlength="500" value="${esc(draft.tags)}"></label><div class="ycg-tag-chips">${tags.map((tag) => `<button type="button" data-ycg-remove-tag="${esc(tag)}">#${esc(tag)} ×</button>`).join("") || `<span>Chưa có tag</span>`}</div></section>
      <section class="ycg-video-card"><header><div><small>AUDIENCE & AI</small><h3>Đối tượng và nội dung biến đổi</h3></div></header><label class="ycg-setting-row"><span><strong>Dành cho trẻ em</strong><small>YouTube có thể hạn chế một số tính năng tương tác.</small></span><input type="checkbox" name="madeForKids" ${draft.madeForKids ? "checked" : ""}></label><div class="ycg-readonly-setting"><span><strong>Giới hạn độ tuổi</strong><small>${item.ageRestricted ? "YouTube đang đánh dấu video giới hạn tuổi." : "Không thấy giới hạn tuổi trong dữ liệu hiện tại."}</small></span><a href="https://studio.youtube.com/video/${esc(item.videoId)}/edit" target="_blank" rel="noopener">Quản lý trong Studio ↗</a></div><label class="ycg-ai-disclosure">Video có chứa nội dung được tạo hoặc chỉnh sửa đáng kể bằng AI và trông như thật không?<select name="aiDisclosure"><option value="unreviewed" ${draft.aiDisclosure === "unreviewed" ? "selected" : ""}>Chưa kiểm tra · chặn Public/lên lịch</option><option value="yes" ${draft.aiDisclosure === "yes" ? "selected" : ""}>Có · khai báo với YouTube</option><option value="no" ${draft.aiDisclosure === "no" ? "selected" : ""}>Không · đã kiểm tra</option></select><small>Nguồn hiện tại: ${esc(item.aiDisclosureSource === "user-declared" ? "Người dùng khai báo" : item.aiDisclosureSource === "youtube-status" ? "Trạng thái YouTube" : "Chưa xác định")}</small></label><div class="ycg-readonly-setting"><span><strong>Paid promotion</strong><small>${item.paidProductPlacement ? "YouTube báo video có paid product placement." : "Không thấy khai báo paid promotion qua API."}</small></span><a href="https://studio.youtube.com/video/${esc(item.videoId)}/edit" target="_blank" rel="noopener">Mở thuộc tính ↗</a></div></section>
      <details class="ycg-video-card ycg-more-settings" open><summary><span><small>ADVANCED</small><strong>Hiển thị thêm</strong></span><b>⌄</b></summary><div class="ycg-editor-grid"><label>Giấy phép<select name="license"><option value="youtube" ${draft.license === "youtube" ? "selected" : ""}>Standard YouTube License</option><option value="creativeCommon" ${draft.license === "creativeCommon" ? "selected" : ""}>Creative Commons</option></select></label><label>Ngày quay<input type="date" name="recordingDate" value="${esc(draft.recordingDate)}"></label></div><label class="ycg-setting-row"><span><strong>Cho phép nhúng</strong><small>Cho phép website khác nhúng video.</small></span><input type="checkbox" name="embeddable" ${draft.embeddable ? "checked" : ""}></label><label class="ycg-setting-row"><span><strong>Hiển thị số lượt thích</strong><small>Ánh xạ tới publicStatsViewable của YouTube.</small></span><input type="checkbox" name="publicStatsViewable" ${draft.publicStatsViewable ? "checked" : ""}></label>${[["Chapter tự động","Không có trường cập nhật trong Data API."],["Featured places","Quản lý trong YouTube Studio."],["Comment moderation","Dùng Comment Mission Center hoặc Studio."],["Shorts remixing","Data API không cung cấp trường cập nhật."],["Related video cho Short","Mở trực tiếp video trong Studio."]].map(([label,note])=>`<div class="ycg-readonly-setting"><span><strong>${label}</strong><small>${note}</small></span><a href="https://studio.youtube.com/video/${esc(item.videoId)}/edit" target="_blank" rel="noopener">Studio ↗</a></div>`).join("")}</details>
      <div class="ycg-editor-visibility"><label>Quyền hiển thị<select name="privacyStatus"><option value="private" ${draft.privacyStatus === "private" ? "selected" : ""}>Private</option><option value="unlisted" ${draft.privacyStatus === "unlisted" ? "selected" : ""}>Unlisted</option><option value="public" ${draft.privacyStatus === "public" ? "selected" : ""}>Public · cần xác nhận</option><option value="schedule" ${draft.privacyStatus === "schedule" ? "selected" : ""}>Lên lịch</option></select></label><label>Thời gian đăng<input type="datetime-local" name="publishAt" value="${esc(draft.publishAt)}"></label></div>
    </form>`;
  }

  function videoStudioSectionMarkup(item, channel, draft) {
    const section = contentDrawer?.activeSection || "details";
    if (section === "details") return videoStudioDetailsMarkup(item, channel, draft);
    if (section === "analytics") {
      const analytics = contentDrawer.analytics?.totals || {};
      return `<section class="ycg-video-section-page"><header><small>VIDEO ANALYTICS</small><h2>Hiệu suất video</h2><p>Chỉ số được truy vấn cho đúng video và đúng kênh sở hữu.</p></header>${contentDrawer.sectionLoading ? `<div class="ycg-section-loading">Đang tải YouTube Analytics…</div>` : contentDrawer.analyticsError ? `<div class="ycg-unavailable-card"><strong>Không tải được Analytics</strong><p>${esc(contentDrawer.analyticsError)}</p><a href="https://studio.youtube.com/video/${esc(item.videoId)}/analytics/tab-overview/period-default" target="_blank" rel="noopener">Mở Analytics trong Studio ↗</a></div>` : contentDrawer.analytics ? `<div class="ycg-video-metrics">${[["Lượt xem",analytics.views],["Thời gian xem",`${Math.round(Number(analytics.estimatedMinutesWatched||0)/60)} giờ`],["Thời lượng xem TB",`${Math.round(Number(analytics.averageViewDuration||0))} giây`],["Lượt thích",analytics.likes],["Bình luận",analytics.comments]].map(([label,value])=>`<article><span>${label}</span><strong>${typeof value === "number" ? fmt(value) : esc(value || "—")}</strong></article>`).join("")}</div>` : `<div class="ycg-empty-section"><strong>Analytics chưa được tải</strong><button type="button" data-ycg-action="video-load-analytics">Tải dữ liệu video</button></div>`}</section>`;
    }
    if (section === "editor") return `<section class="ycg-video-section-page"><header><small>EDITOR</small><h2>Chỉnh sửa nội dung video</h2><p>Data API không cung cấp thao tác trim, blur, audio hay end screen. Các nút dưới đây mở đúng video trong YouTube Studio.</p></header><div class="ycg-editor-tool-grid">${[["Trim & Cut","Cắt đầu, cuối hoặc đoạn giữa","editor"],["Blur","Làm mờ khuôn mặt hoặc vùng hình ảnh","editor"],["Audio","Thêm nhạc từ Audio Library","editor"],["End screen","Gắn video, playlist và subscribe","editor"]].map(([title,note])=>`<a href="https://studio.youtube.com/video/${esc(item.videoId)}/edit" target="_blank" rel="noopener"><b>${title}</b><span>${note}</span><i>↗</i></a>`).join("")}</div>${item.fileDetails ? `<section class="ycg-video-card"><h3>Thông tin file thật</h3><dl><dt>Tệp</dt><dd>${esc(item.fileDetails.fileName || "—")}</dd><dt>Độ phân giải</dt><dd>${item.fileDetails.width || "—"} × ${item.fileDetails.height || "—"}</dd><dt>Video codec</dt><dd>${esc(item.fileDetails.videoCodec || "—")}</dd><dt>Audio codec</dt><dd>${esc(item.fileDetails.audioCodec || "—")}</dd><dt>FPS</dt><dd>${fmt(item.fileDetails.frameRate || 0)}</dd></dl></section>` : ""}</section>`;
    if (section === "comments") return `<section class="ycg-video-section-page"><header><small>COMMENTS</small><h2>Bình luận của video</h2><p>Đọc bình luận thật; trả lời được kiểm duyệt trong Comment Mission Center.</p></header>${contentDrawer.sectionLoading ? `<div class="ycg-section-loading">Đang tải bình luận…</div>` : contentDrawer.commentsError ? `<div class="ycg-unavailable-card"><strong>Không tải được bình luận</strong><p>${esc(contentDrawer.commentsError)}</p></div>` : contentDrawer.comments ? `<div class="ycg-video-comment-list">${contentDrawer.comments.map((comment)=>`<article>${comment.avatar?`<img src="${esc(comment.avatar)}" alt="">`:`<span>YT</span>`}<div><strong>${esc(comment.author)}</strong><time>${dateTime(comment.publishedAt)}</time><p>${esc(comment.text)}</p><small>${fmt(comment.likeCount)} lượt thích · ${fmt(comment.replyCount)} phản hồi</small></div></article>`).join("")||`<p>Video chưa có bình luận.</p>`}</div>` : `<div class="ycg-empty-section"><strong>Chưa tải bình luận</strong><button type="button" data-ycg-action="video-load-comments">Tải bình luận</button></div>`}</section>`;
    if (section === "subtitles") return `<section class="ycg-video-section-page"><header><small>SUBTITLES & LANGUAGES</small><h2>Phụ đề và ngôn ngữ</h2><p>${contentDrawer.captions?.length || 0} caption track được YouTube trả về.</p></header><div class="ycg-caption-track-list">${(contentDrawer.captions||[]).map((track)=>`<article><b>${esc(VIDEO_LANGUAGES[track.language]||track.language)}</b><span>${esc(track.name||"Caption")}</span><em>${esc(track.status||"unknown")}</em></article>`).join("")||`<div class="ycg-empty-section"><strong>Chưa có caption track</strong></div>`}</div><div class="ycg-action-row"><button type="button" data-ycg-detail-captions="${esc(item.videoId)}">Mở Captions Studio</button><a href="https://studio.youtube.com/video/${esc(item.videoId)}/translations" target="_blank" rel="noopener">Mở phụ đề YouTube ↗</a></div></section>`;
    if (section === "restrictions") return `<section class="ycg-video-section-page"><header><small>CHECKS & RESTRICTIONS</small><h2>Bản quyền và giới hạn</h2><p>Chỉ hiển thị tín hiệu mà YouTube Data API thực sự trả về.</p></header><div class="ycg-check-grid"><article class="${item.ageRestricted?"is-warning":"is-ok"}"><span>Giới hạn tuổi</span><strong>${item.ageRestricted?"Có giới hạn":"Không thấy giới hạn"}</strong></article><article class="${item.licensedContent?"is-warning":"is-neutral"}"><span>Licensed content</span><strong>${item.licensedContent?"Có":"Không"}</strong></article><article class="is-neutral"><span>Copyright Checks</span><strong>Không có qua Data API</strong><small>Không tạo kết quả giả.</small></article><article class="is-neutral"><span>Ad suitability</span><strong>Không có qua Data API</strong><small>Chỉ xem trong Studio/YPP.</small></article></div><a class="ycg-primary-link" href="https://studio.youtube.com/video/${esc(item.videoId)}/checks" target="_blank" rel="noopener">Mở Checks trong YouTube Studio ↗</a></section>`;
    if (section === "clips") return `<section class="ycg-video-section-page"><header><small>CLIPS</small><h2>Clips của video</h2><p>YouTube Data API không cung cấp quản lý Clips. HH không mô phỏng dữ liệu này.</p></header><div class="ycg-unavailable-card"><strong>Mở Clips trong YouTube Studio</strong><p>Xem và quản lý clip bằng giao diện chính thức.</p><a href="https://studio.youtube.com/video/${esc(item.videoId)}/clips" target="_blank" rel="noopener">Mở Studio ↗</a></div></section>`;
    if (section === "monetization") return `<section class="ycg-video-section-page"><header><small>MONETIZATION</small><h2>Kiếm tiền</h2><p>Trạng thái kiếm tiền chỉ được hiển thị khi nguồn YouTube được phép cung cấp; hiện không suy đoán từ lượt xem hoặc channel.</p></header><div class="ycg-unavailable-card"><strong>Không có dữ liệu kiếm tiền qua Data API hiện tại</strong><p>${item.madeForKids?"Video dành cho trẻ em có thể chỉ đủ điều kiện quảng cáo không cá nhân hóa.":"Mở YouTube Studio để xem trạng thái YPP và ad suitability."}</p><a href="https://studio.youtube.com/video/${esc(item.videoId)}/monetization" target="_blank" rel="noopener">Mở Kiếm tiền trong Studio ↗</a></div></section>`;
    return `<section class="ycg-video-section-page"><header><small>AUDIT LOG</small><h2>Nhật ký thay đổi</h2><p>Mọi thao tác thuộc đúng tài khoản và kênh hiện tại.</p></header><div class="ycg-workspace-audit">${(contentDrawer.audit||[]).map((entry)=>`<article><time>${dateTime(entry.createdAt)}</time><strong>${esc(entry.action)}</strong><span>${esc(entry.status)}</span><small>${esc(entry.detail||"")}</small></article>`).join("")||`<p>Chưa có audit log cho video này.</p>`}</div></section>`;
  }

  function videoStudioPreviewMarkup(item, channel, draft) {
    const canEmbed = item.videoId && item.privacyStatus !== "private";
    const disclosure = normalizeAiDisclosure(draft.aiDisclosure);
    const processingError = item.failureReason || item.rejectionReason || item.suggestions?.errors?.[0] || "";
    const timeZone = channelPreset(item.channelId).timezone || fleetState.calendarTimezone || "Asia/Bangkok";
    return `<aside class="ycg-video-preview-column"><section class="ycg-video-preview-card"><div class="ycg-video-preview-media">${canEmbed?`<iframe src="https://www.youtube-nocookie.com/embed/${esc(item.videoId)}" title="${esc(draft.title||"YouTube video")}" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`:item.thumbnail?`<img src="${esc(item.thumbnail)}" alt="Thumbnail video">`:`<span>YT</span>`}</div><div class="ycg-video-preview-meta"><strong>${esc(draft.title||"Video chưa có tiêu đề")}</strong><small>${esc(channel.title||item.channelTitle||item.channelId)}</small><dl><dt>Video ID</dt><dd>${esc(item.videoId||"—")} <button type="button" data-ycg-copy-video-url="https://youtu.be/${esc(item.videoId)}">Copy URL</button></dd><dt>Hiển thị</dt><dd>${esc(draft.privacyStatus)}${draft.publishAt?` · ${dateTimeInZone(draft.publishAt,timeZone)}`:""}<small>${draft.publishAt?esc(timeZone):""}</small></dd><dt>AI</dt><dd><span class="ycg-ai-badge is-${disclosure}">${aiDisclosureLabel(disclosure)}</span></dd><dt>Audience</dt><dd>${draft.madeForKids?"Dành cho trẻ em":"Không dành cho trẻ em"}</dd></dl><div class="ycg-preview-links"><a href="https://www.youtube.com/watch?v=${esc(item.videoId)}" target="_blank" rel="noopener">Mở YouTube ↗</a><a href="https://studio.youtube.com/video/${esc(item.videoId)}/edit" target="_blank" rel="noopener">Mở Studio ↗</a></div></div></section><section class="ycg-video-checks-card"><header><h3>Processing & Checks</h3><button type="button" data-ycg-action="video-refresh-details">↻</button></header><p><span>Upload</span><b>${esc(item.uploadStatus||item.status||"không rõ")}</b></p><p><span>Xử lý</span><b>${esc(item.processingStatus||"chưa trả về")}</b></p><p><span>Chất lượng</span><b>${esc(String(item.definition||"—").toUpperCase())}${item.fileDetails?.width?` · ${item.fileDetails.width}×${item.fileDetails.height}`:""}</b></p><p><span>Caption</span><b>${item.captionAvailable||contentDrawer.captions?.length?"Có":"Chưa có"}</b></p><p><span>Custom thumbnail</span><b>${item.hasCustomThumbnail?"Có":"Chưa xác nhận"}</b></p><p><span>Copyright</span><b>Không có qua Data API</b></p><p><span>Kiếm tiền</span><b>Không có qua Data API</b></p>${processingError?`<div class="ycg-check-error"><strong>Cảnh báo xử lý</strong><span>${esc(processingError)}</span></div>`:""}</section></aside>`;
  }

  function videoStudioWorkspaceMarkup(channels) {
    if (!contentDrawer) return "";
    if (contentDrawer.loading) return `<section class="ycg-video-workspace is-loading"><div class="ycg-loading"><i></i><strong>Đang tải workspace video từ YouTube…</strong></div></section>`;
    const item = contentDrawer.item || {};
    const draft = contentDrawer.draft || editorDraftFromVideo(item);
    const channel = channels.find((entry)=>entry.id===item.channelId)||{ title:item.channelTitle, playlists:[] };
    const dirty = Boolean(contentDrawer.dirty);
    return `<section class="ycg-video-workspace"><header class="ycg-video-workspace-top"><button type="button" data-ycg-video-back>← Nội dung</button><div><small>${esc(channel.title||"Kênh YouTube")}</small><strong>${esc(draft.title||"Video chưa có tiêu đề")}</strong></div><span class="${dirty?"is-dirty":"is-saved"}">${dirty?"Có thay đổi chưa lưu":"Đã lưu"}</span><button type="button" data-ycg-action="video-undo" ${dirty?"":"disabled"}>Hoàn tác</button><button type="button" data-ycg-action="video-save-private">Lưu bản nháp</button><button type="submit" form="ycg-video-workspace-form" class="is-primary" ${dirty?"":"disabled"}>Lưu</button><details class="ycg-workspace-more"><summary>⋮</summary><div><button type="button" data-ycg-content-delete-current>Xóa vĩnh viễn…</button></div></details></header><div class="ycg-video-workspace-grid"><nav class="ycg-video-side-nav" aria-label="Điều hướng video">${VIDEO_EDITOR_SECTIONS.map(([id,label,icon])=>`<button type="button" data-ycg-video-section="${id}" class="${(contentDrawer.activeSection||"details")===id?"is-active":""}"><i>${icon}</i><span>${label}</span>${id==="comments"&&contentDrawer.comments?`<b>${contentDrawer.comments.length}</b>`:id==="subtitles"?`<b>${contentDrawer.captions?.length||0}</b>`:""}</button>`).join("")}</nav><main class="ycg-video-editor-column">${videoStudioSectionMarkup(item,channel,draft)}</main>${videoStudioPreviewMarkup(item,channel,draft)}</div>${deleteDialogMarkup(channels)}</section>`;
  }

  function deleteDialogMarkup(channels) {
    if (!deleteDialog?.item) return "";
    const item = deleteDialog.item;
    const channel = channels.find((entry) => entry.id === item.channelId) || {};
    return `<aside class="ycg-delete-dialog is-open" role="dialog" aria-modal="true" aria-labelledby="ycg-delete-title"><button type="button" class="ycg-video-drawer__backdrop" data-ycg-delete-close aria-label="Đóng xác nhận xóa"></button><form data-ycg-delete-form data-channel-id="${esc(item.channelId)}" data-video-id="${esc(item.videoId)}" data-key="${esc(deleteDialog.key)}"><header><div><small>VÙNG NGUY HIỂM</small><h3 id="ycg-delete-title">Xóa video vĩnh viễn?</h3></div><button type="button" data-ycg-delete-close aria-label="Đóng">×</button></header><div class="ycg-delete-summary">${item.thumbnail ? `<img src="${esc(item.thumbnail)}" alt="">` : `<span>YT</span>`}<div><strong>${esc(item.title || "Video")}</strong><small>${esc(channel.title || item.channelTitle || item.channelId)} · Video ID: ${esc(item.videoId)}</small></div></div><p class="ycg-delete-warning">YouTube không cung cấp khôi phục sau khi xóa. HH chỉ giữ tombstone và audit log, không giữ bản video có thể phục hồi.</p><fieldset><legend>Lựa chọn an toàn hơn</legend><button type="button" data-ycg-delete-safer="private">Chuyển Private</button><button type="button" data-ycg-delete-safer="unlisted">Chuyển Unlisted</button>${item.scheduledAt || item.publishAt ? `<button type="button" data-ycg-delete-safer="cancel-schedule">Hủy lịch đăng</button>` : ""}</fieldset><label>Nhập <b>DELETE</b> hoặc chính xác tiêu đề video<input name="confirmation" autocomplete="off" required placeholder="DELETE"></label><label class="ycg-delete-ack"><input type="checkbox" name="permanentAck" required> Tôi hiểu video sẽ bị xóa vĩnh viễn và không thể khôi phục.</label><div class="ycg-video-drawer__actions"><button type="button" data-ycg-delete-close>Quay lại</button><button class="ycg-delete-confirm">Xóa vĩnh viễn</button></div><small class="ycg-delete-auth-note">Nếu phiên đăng nhập quá 15 phút, hệ thống sẽ yêu cầu xác thực lại bằng Passkey trước khi gửi lệnh.</small></form></aside>`;
  }

  function aiBulkDialogMarkup(selectedCount) {
    if (!aiBulkDialog) return "";
    return `<aside class="ycg-ai-bulk-dialog is-open" role="dialog" aria-modal="true" aria-labelledby="ycg-ai-bulk-title"><button type="button" class="ycg-video-drawer__backdrop" data-ycg-ai-bulk-close aria-label="Đóng khai báo AI"></button><form data-ycg-ai-bulk-form><header><div><small>THIẾT LẬP HÀNG LOẠT</small><h3 id="ycg-ai-bulk-title">Sử dụng AI</h3></div><button type="button" data-ycg-ai-bulk-close aria-label="Đóng">×</button></header><p>Bạn có sử dụng AI để tạo hoặc chỉnh sửa nội dung theo bất kỳ cách nào sau đây không?</p><ul><li>Có hình ảnh người thật có vẻ như nói hoặc làm điều gì đó, nhưng trên thực tế là họ không làm như vậy.</li><li>Chỉnh sửa cảnh quay của một sự kiện hoặc một địa điểm có thật.</li><li>Tạo ra một cảnh trông giống thật mà không thực sự xảy ra.</li></ul><fieldset><legend>Áp dụng cho ${selectedCount} video đã chọn</legend><label><input type="radio" name="aiDisclosure" value="yes" required><span><strong>Có</strong><small>Khai báo video có nội dung được tạo hoặc chỉnh sửa đáng kể bằng AI và trông như thật.</small></span></label><label><input type="radio" name="aiDisclosure" value="no" required><span><strong>Không</strong><small>Video không thuộc các trường hợp cần khai báo ở trên.</small></span></label></fieldset><div class="ycg-ai-bulk-dialog__actions"><button type="button" data-ycg-ai-bulk-close>Hủy</button><button type="submit" class="is-primary">Áp dụng cho ${selectedCount} video</button></div><small class="ycg-api-note">Mỗi video được cập nhật riêng trên đúng kênh sở hữu. Hệ thống không tự suy đoán hoặc tự đánh dấu AI.</small></form></aside>`;
  }

  function channelSettingsMarkup(channels) {
    if (!channels.length) return emptyState("Chưa có kênh để cài đặt", "Hãy kết nối kênh YouTube trước. Mọi thiết lập luôn được khóa theo tài khoản HH đang đăng nhập.", "connect-creator", "Thêm kênh YouTube");
    const selectedId = channels.some((channel) => channel.id === fleetState.settingsChannel)
      ? fleetState.settingsChannel
      : channels.find((channel) => fleetState.selectedChannelIds.includes(channel.id))?.id || channels[0].id;
    const channel = channels.find((item) => item.id === selectedId) || channels[0];
    const remote = channelSettings?.channelId === channel.id ? channelSettings.profile : null;
    const profile = remote || { title: channel.title, thumbnail: channel.thumbnail, ...(channel.profile || {}) };
    const preset = channelPreset(channel.id);
    const section = fleetState.settingsSection || "profile";
    const studioBase = `https://studio.youtube.com/channel/${encodeURIComponent(channel.id)}`;
    const settingsNav = [["profile", "Hồ sơ"], ["upload", "Chế độ mặc định cho video"], ["channel", "Kênh"], ["permissions", "Quyền"], ["moderation", "Kiểm duyệt cộng đồng"], ["agreements", "Thỏa thuận"]];
    const studioLink = (path, label = "Mở YouTube Studio ↗") => `<a href="${studioBase}${path}" target="_blank" rel="noopener">${label}</a>`;
    let content = "";
    if (section === "profile") content = `<form class="ycg-channel-settings-form" data-ycg-channel-profile-form data-channel-id="${esc(channel.id)}"><header><div><small>TÙY CHỈNH KÊNH</small><h3>Hồ sơ</h3><p>Thông tin cập nhật qua YouTube Data API; ảnh, tên và handle mở đúng YouTube Studio.</p></div><div>${studioLink("/editing/details", "Xem kênh trong Studio ↗")}<button class="is-primary">Lưu mô tả</button></div></header><section class="ycg-branding-row"><div class="ycg-banner-preview" style="${profile.bannerUrl ? `background-image:url('${esc(profile.bannerUrl)}')` : ""}"><span>Ảnh biểu ngữ · 2560 × 1440 · tối đa 6 MB</span></div><div><strong>Ảnh biểu ngữ</strong><small>YouTube không cung cấp API công khai để tải banner từ ứng dụng bên thứ ba.</small>${studioLink("/editing/images", "Thay đổi trong Studio ↗")}</div></section><section class="ycg-branding-row"><div class="ycg-avatar-preview">${profile.thumbnail ? `<img src="${esc(profile.thumbnail)}" alt="Ảnh hồ sơ kênh">` : "YT"}</div><div><strong>Ảnh hồ sơ</strong><small>Hiển thị cùng kênh và bình luận. Thay ảnh an toàn trong Studio.</small>${studioLink("/editing/images", "Thay đổi trong Studio ↗")}</div></section><label>Tên kênh<input readonly value="${esc(profile.title || channel.title)}"><small>Data API không cho ứng dụng đổi tên kênh. ${studioLink("/editing/details", "Đổi tên trong Studio ↗")}</small></label><label>Handle<input readonly value="${esc(profile.customUrl ? `@${String(profile.customUrl).replace(/^@/, "")}` : "Chưa đồng bộ")}"><small>Handle chỉ chỉnh trong YouTube Studio và có giới hạn đổi tên của YouTube.</small></label><label>Mô tả kênh <span>${String(profile.description || "").length}/1000</span><textarea name="description" maxlength="1000" rows="8">${esc(profile.description || "")}</textarea></label><div class="ycg-readonly-setting"><span><strong>Liên kết, email liên hệ và đại từ nhân xưng</strong><small>Quản lý trực tiếp trong trang Hồ sơ của YouTube Studio.</small></span>${studioLink("/editing/details", "Quản lý ↗")}</div></form>`;
    else if (section === "upload") content = `<form class="ycg-channel-settings-form" data-ycg-upload-defaults-form data-channel-id="${esc(channel.id)}"><header><div><small>MẶC ĐỊNH CHO HH UPLOAD</small><h3>Chế độ mặc định cho video</h3><p>Tự áp dụng cho mọi video tải từ HH; có thể sửa riêng trước khi gửi YouTube.</p></div><button class="is-primary">Lưu mặc định</button></header><div class="ycg-settings-tabs"><span class="is-active">Thông tin cơ bản</span><span>Cài đặt nâng cao</span></div><label>Tiền tố tiêu đề<input name="titlePrefix" maxlength="40" value="${esc(preset.titlePrefix)}"></label><label>Hậu tố tiêu đề<input name="titleSuffix" maxlength="40" value="${esc(preset.titleSuffix)}"></label><label>Mô tả mặc định<textarea name="descriptionTemplate" maxlength="3000" rows="6">${esc(preset.descriptionTemplate)}</textarea></label><label>Tag mặc định<input name="tags" maxlength="480" value="${esc(preset.tags)}"></label><div class="ycg-editor-grid"><label>Chế độ hiển thị<select name="privacyStatus"><option value="private" ${preset.privacyStatus === "private" ? "selected" : ""}>Private</option><option value="unlisted" ${preset.privacyStatus === "unlisted" ? "selected" : ""}>Unlisted</option><option value="schedule" ${preset.privacyStatus === "schedule" ? "selected" : ""}>Lên lịch</option></select></label><label>Danh mục<select name="categoryId">${Object.entries(VIDEO_CATEGORIES).map(([id,label])=>`<option value="${id}" ${preset.categoryId===id?"selected":""}>${esc(label)}</option>`).join("")}</select></label><label>Ngôn ngữ<select name="defaultLanguage">${Object.entries(VIDEO_LANGUAGES).map(([id,label])=>`<option value="${id}" ${preset.defaultLanguage===id?"selected":""}>${esc(label)}</option>`).join("")}</select></label><label>Playlist<select name="playlistId"><option value="">Không playlist</option>${(channel.playlists||[]).map((item)=>`<option value="${esc(item.id)}" ${preset.playlistId===item.id?"selected":""}>${esc(item.title)}</option>`).join("")}</select></label><label>Giấy phép<select name="license"><option value="youtube" ${preset.license==="youtube"?"selected":""}>Standard YouTube License</option><option value="creativeCommon" ${preset.license==="creativeCommon"?"selected":""}>Creative Commons</option></select></label><label>Giờ đăng mặc định<input type="time" name="publishTime" value="${esc(preset.publishTime)}"></label></div><label class="ycg-setting-row"><span><strong>Dành cho trẻ em</strong><small>Áp làm mặc định cho video mới.</small></span><input type="checkbox" name="madeForKids" ${preset.madeForKids?"checked":""}></label><label class="ycg-setting-row"><span><strong>Cho phép nhúng</strong><small>Cho phép website khác nhúng video.</small></span><input type="checkbox" name="embeddable" ${preset.embeddable?"checked":""}></label><label class="ycg-setting-row"><span><strong>Thông báo người đăng ký</strong><small>Có thể tắt khi tải nhiều video liên tục.</small></span><input type="checkbox" name="notifySubscribers" ${preset.notifySubscribers?"checked":""}></label></form>`;
    else if (section === "channel") content = `<form class="ycg-channel-settings-form" data-ycg-channel-api-settings-form data-channel-id="${esc(channel.id)}"><header><div><small>YOUTUBE DATA API</small><h3>Cài đặt kênh</h3><p>Quốc gia, từ khóa, ngôn ngữ và trailer được lưu thật vào brandingSettings của đúng kênh.</p></div><button class="is-primary">Lưu lên YouTube</button></header><div class="ycg-editor-grid"><label>Quốc gia<input name="country" maxlength="2" placeholder="VN" value="${esc(profile.country || "")}"></label><label>Ngôn ngữ mặc định<select name="defaultLanguage"><option value="">Không đặt</option>${Object.entries(VIDEO_LANGUAGES).map(([id,label])=>`<option value="${id}" ${profile.defaultLanguage===id?"selected":""}>${esc(label)}</option>`).join("")}</select></label></div><label>Từ khóa kênh<input name="keywords" maxlength="500" value="${esc(profile.keywords || "")}"></label><label>Video giới thiệu cho người chưa đăng ký<input name="trailerVideoId" maxlength="40" placeholder="Video ID" value="${esc(profile.trailerVideoId || "")}"></label><div class="ycg-readonly-setting"><span><strong>Đối tượng người xem và tính năng nâng cao</strong><small>${profile.madeForKids?"Kênh hiện được khai báo dành cho trẻ em.":"Kênh hiện không được khai báo dành cho trẻ em."} Thay đổi đối tượng trong Studio.</small></span>${studioLink("/settings/channel", "Mở cài đặt ↗")}</div></form>`;
    else if (section === "permissions") content = `<section class="ycg-channel-settings-form"><header><div><small>OWNER-ISOLATED OAUTH</small><h3>Quyền của ${esc(channel.title)}</h3><p>Token chỉ tồn tại mã hóa ở backend và không hiển thị trên trình duyệt.</p></div>${channel.permissions?.manage?"":`<button type="button" class="is-primary" data-ycg-action="connect-creator">Cấp lại quyền</button>`}</header><div class="ycg-permission-grid">${[["Đọc kênh",true,"openid · email · profile"],["Upload video",channel.permissions?.upload,"youtube.upload"],["Quản lý metadata",channel.permissions?.manage,"youtube.force-ssl"],["Analytics",channel.permissions?.analytics,"yt-analytics.readonly"]].map(([label,ready,scope])=>`<article class="${ready?"is-ready":"is-warning"}"><i>${ready?"✓":"!"}</i><div><strong>${label}</strong><small>${scope}</small></div><b>${ready?"Đã cấp":"Thiếu quyền"}</b></article>`).join("")}</div><div class="ycg-readonly-setting"><span><strong>Quyền truy cập của người khác vào kênh</strong><small>Vai trò Owner, Manager, Editor và Viewer phải quản lý trong YouTube Studio.</small></span>${studioLink("/settings/permissions", "Quản lý quyền ↗")}</div></section>`;
    else if (section === "moderation") content = `<form class="ycg-channel-settings-form" data-ycg-channel-moderation-form data-channel-id="${esc(channel.id)}"><header><div><small>COMMUNITY</small><h3>Kiểm duyệt cộng đồng</h3><p>Thiết lập API khả dụng và lối tắt tới bộ lọc nâng cao của Studio.</p></div><button class="is-primary">Lưu lên YouTube</button></header><label class="ycg-setting-row"><span><strong>Giữ bình luận để kiểm duyệt</strong><small>Ánh xạ tới brandingSettings.channel.moderateComments.</small></span><input type="checkbox" name="moderateComments" ${profile.moderateComments?"checked":""}></label>${[["Người kiểm duyệt","/settings/community"],["Người dùng bị ẩn","/settings/community"],["Từ bị chặn","/settings/community"],["Bình luận có liên kết","/settings/community"]].map(([label,path])=>`<div class="ycg-readonly-setting"><span><strong>${label}</strong><small>YouTube chưa cung cấp trường cập nhật công khai qua Data API.</small></span>${studioLink(path,"Mở Studio ↗")}</div>`).join("")}<button type="button" data-ycg-fleet-tab="comments">Mở Trung tâm bình luận HH</button></form>`;
    else content = `<section class="ycg-channel-settings-form"><header><div><small>POLICY & AGREEMENTS</small><h3>Thỏa thuận và trạng thái</h3><p>HH không tạo trạng thái kiếm tiền, bản quyền hoặc thỏa thuận giả.</p></div></header><div class="ycg-permission-grid"><article class="is-ready"><i>✓</i><div><strong>YouTube Terms of Service</strong><small>Áp dụng khi sử dụng YouTube API Services.</small></div><a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener">Xem ↗</a></article><article><i>i</i><div><strong>Kiếm tiền và AdSense</strong><small>Chỉ YouTube Studio cung cấp trạng thái đủ điều kiện chính thức.</small></div>${studioLink("/monetization","Kiểm tra ↗")}</article><article><i>©</i><div><strong>Bản quyền</strong><small>Claim và strike không được suy đoán từ Data API.</small></div>${studioLink("/copyright","Mở bản quyền ↗")}</article></div></section>`;
    return `<section class="ycg-channel-settings"><header class="ycg-channel-settings-head"><div>${channel.thumbnail?`<img src="${esc(channel.thumbnail)}" alt="">`:`<span>YT</span>`}<label>Đang cài đặt<select data-ycg-settings-channel>${channels.map((item)=>`<option value="${esc(item.id)}" ${item.id===channel.id?"selected":""}>${esc(item.title)}</option>`).join("")}</select></label></div><small>${channel.permissions?.manage?"Có quyền quản lý YouTube":"Chỉ xem · cần scope manage"}</small></header><div class="ycg-channel-settings-grid"><nav aria-label="Mục cài đặt kênh">${settingsNav.map(([id,label])=>`<button type="button" data-ycg-settings-section="${id}" class="${section===id?"is-active":""}">${esc(label)}<i>›</i></button>`).join("")}</nav><main>${content}</main></div></section>`;
  }

  function contentManagerMarkup(channels) {
    if (contentDrawer) return videoStudioWorkspaceMarkup(channels);
    const channelFilter = fleetState.contentChannel;
    const stageFilter = fleetState.contentFilter;
    const contentSortBy = ["title", "channel", "status", "processing", "privacy", "date", "metrics"].includes(fleetState.contentSortBy) ? fleetState.contentSortBy : "title";
    const contentSort = fleetState.contentSort === "za" ? "za" : "az";
    const sortedChannels = channels.slice().sort((left, right) => String(left.title || "").localeCompare(String(right.title || ""), "vi", { sensitivity: "base" }));
    const allItems = mergedContentItems();
    const channelTitle = (item) => item.channelTitle || channels.find((channel) => channel.id === item.channelId)?.title || item.channelId || "Kênh";
    const sortValue = (item, column) => {
      const metrics = item.metrics || item;
      if (column === "channel") return channelTitle(item);
      if (column === "status") return contentStage(item);
      if (column === "processing") return item.processingStatus || item.uploadStatus || "";
      if (column === "privacy") return item.privacyStatus || "private";
      if (column === "date") return new Date(item.scheduledAt || item.publishAt || item.publishedAt || item.updatedAt || 0).getTime() || 0;
      if (column === "metrics") return Number(metrics.views || 0);
      return item.title || item.fileName || "";
    };
    const items = allItems
      .filter((item) => (channelFilter === "all" || item.channelId === channelFilter) && (stageFilter === "all" || contentStage(item) === stageFilter))
      .sort((left, right) => {
        const leftValue = sortValue(left, contentSortBy);
        const rightValue = sortValue(right, contentSortBy);
        const comparison = typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), "vi", { sensitivity: "base", numeric: true });
        const directed = contentSort === "za" ? -comparison : comparison;
        return directed || String(left.title || left.fileName || "").localeCompare(String(right.title || right.fileName || ""), "vi", { sensitivity: "base", numeric: true });
      });
    const selected = new Set(fleetState.selectedContentIds);
    const selectedVideoCount = allItems.filter((item) => item.videoId && selected.has(item.uploadId || `${item.channelId}::${item.videoId}`)).length;
    const filters = [["all", "Tất cả"], ["uploading", "Tải lên"], ["processing", "Đang xử lý"], ["draft", "Bản nháp"], ["scheduled", "Đã lên lịch"], ["published", "Đã xuất bản"], ["error", "Có lỗi"]];
    const sortableHeader = (column, label) => {
      const active = contentSortBy === column;
      const arrow = active ? (contentSort === "az" ? "↑" : "↓") : "↕";
      const ariaSort = active ? (contentSort === "az" ? "ascending" : "descending") : "none";
      return `<th aria-sort="${ariaSort}"><button type="button" data-ycg-content-sort-column="${column}" class="${active ? "is-active" : ""}" aria-label="Sắp xếp ${esc(label)} ${active && contentSort === "az" ? "giảm dần" : "tăng dần"}"><span>${esc(label)}</span><i aria-hidden="true">${arrow}</i></button></th>`;
    };
    return `<section class="ycg-content-manager"><div class="ycg-content-manager__toolbar"><div class="ycg-content-status-tabs">${filters.map(([id, label]) => `<button type="button" data-ycg-content-filter="${id}" class="${stageFilter === id ? "is-active" : ""}">${label}<b>${allItems.filter((item) => id === "all" || contentStage(item) === id).length}</b></button>`).join("")}</div><div><select data-ycg-content-channel aria-label="Chọn riêng một kênh"><option value="all">Tất cả kênh</option>${sortedChannels.map((channel) => `<option value="${esc(channel.id)}" ${channelFilter === channel.id ? "selected" : ""}>${esc(channel.title)}</option>`).join("")}</select><button type="button" data-ycg-action="content-refresh">Làm mới</button></div></div>
      <nav class="ycg-content-channel-rail" aria-label="Lọc nội dung theo từng kênh"><button type="button" data-ycg-content-channel-button="all" class="${channelFilter === "all" ? "is-active" : ""}"><span>YT</span><strong>Tất cả kênh</strong><b>${allItems.length}</b></button>${sortedChannels.map((channel) => { const count = allItems.filter((item) => item.channelId === channel.id).length; return `<button type="button" data-ycg-content-channel-button="${esc(channel.id)}" class="${channelFilter === channel.id ? "is-active" : ""}">${channel.thumbnail ? `<img src="${esc(channel.thumbnail)}" alt="">` : `<span>${esc(String(channel.title || "YT").slice(0, 2).toUpperCase())}</span>`}<strong>${esc(channel.title)}</strong><b>${count}</b></button>`; }).join("")}</nav>
      <section class="ycg-panel ycg-content-table"><header><div><h3>Nội dung trên các kênh</h3><small>Bấm tiêu đề cột để sắp xếp. Chỉnh quyền hiển thị trực tiếp trên từng video.</small></div><div><button type="button" data-ycg-action="content-copy-metadata" ${selected.size ? "" : "disabled"}>Copy metadata</button><button type="button" data-ycg-action="content-open-ai-disclosure" ${selectedVideoCount ? "" : "disabled"}>Khai báo sử dụng AI (${selectedVideoCount})</button><button type="button" data-ycg-action="content-open-calendar" ${selected.size ? "" : "disabled"}>Xếp lịch (${selected.size})</button></div></header><div><table><thead><tr><th></th>${sortableHeader("title", "Video")}${sortableHeader("channel", "Kênh")}${sortableHeader("status", "Trạng thái")}${sortableHeader("processing", "Xử lý")}${sortableHeader("privacy", "Quyền")}${sortableHeader("date", "Ngày")}${sortableHeader("metrics", "Chỉ số")}<th></th></tr></thead><tbody>${items.map((item) => {
        const key = item.uploadId || `${item.channelId}::${item.videoId}`;
        const stage = contentStage(item);
        const metrics = item.metrics || item;
        const progress = Number(item.progress ?? (item.totalBytes ? Number(item.bytesUploaded || 0) / Number(item.totalBytes) * 100 : 0));
        const privacyStatus = ["private", "unlisted", "public"].includes(item.privacyStatus) ? item.privacyStatus : "private";
        return `<tr class="is-${stage}" data-ycg-content-row="${esc(key)}"><td><input type="checkbox" data-ycg-content-select value="${esc(key)}" ${selected.has(key) ? "checked" : ""}></td><td><button type="button" class="ycg-content-video" data-ycg-content-open="${esc(key)}">${item.thumbnail ? `<img src="${esc(item.thumbnail)}" alt="">` : `<span>YT</span>`}<div><strong>${esc(item.title || item.fileName || "Video")}</strong><small>${esc(item.videoId || item.fileName || "Chưa có Video ID")}</small></div></button></td><td><strong>${esc(channelTitle(item))}</strong></td><td><span class="ycg-table-status ${stage === "error" ? "is-error" : ["uploading", "processing"].includes(stage) ? "is-running" : "is-ready"}">${esc(stage)}</span>${stage === "uploading" ? `<progress max="100" value="${progress}"></progress>` : ""}</td><td><small>${esc(item.processingStatus || item.uploadStatus || "—")}</small>${item.failureReason || item.rejectionReason || item.error ? `<em>${esc(item.failureReason || item.rejectionReason || item.error)}</em>` : ""}</td><td><select class="ycg-quick-privacy is-${privacyStatus}" data-ycg-content-privacy data-content-key="${esc(key)}" data-previous="${privacyStatus}" aria-label="Quyền hiển thị của ${esc(item.title || item.fileName || "video")}" ${item.videoId ? "" : "disabled title=\"Chưa có Video ID\""}><option value="private" ${privacyStatus === "private" ? "selected" : ""}>Private</option><option value="unlisted" ${privacyStatus === "unlisted" ? "selected" : ""}>Unlisted</option><option value="public" ${privacyStatus === "public" ? "selected" : ""}>Public</option></select></td><td><small>${dateTime(item.scheduledAt || item.publishAt || item.publishedAt || item.updatedAt)}</small></td><td><small>${fmt(metrics.views)} view<br>${fmt(metrics.comments)} bình luận · ${fmt(metrics.likes)} thích</small></td><td><details class="ycg-row-menu"><summary aria-label="Tác vụ video">⋮</summary><div><button type="button" data-ycg-content-open="${esc(key)}">Chỉnh sửa</button>${item.videoId ? `<a href="https://www.youtube.com/watch?v=${esc(item.videoId)}" target="_blank" rel="noopener">Mở YouTube ↗</a><button type="button" class="is-danger" data-ycg-content-delete="${esc(key)}">Xóa vĩnh viễn…</button>` : ""}</div></details></td></tr>`;
      }).join("") || `<tr><td colspan="9">Chưa có video phù hợp. Hãy tải video hoặc chọn một kênh khác.</td></tr>`}</tbody></table></div></section>${deleteDialogMarkup(channels)}${aiBulkDialogMarkup(selectedVideoCount)}</section>`;
  }

  async function loadContentLibrary() {
    if (!channelStatus.connected) return;
    const channelId = fleetState.contentChannel === "all" ? "" : fleetState.contentChannel;
    const result = await api("content/library", "POST", { channelId });
    contentLibrary = Array.isArray(result.items) ? result.items : [];
  }

  function contentItemByKey(key) {
    return mergedContentItems().find((item) => (item.uploadId || `${item.channelId}::${item.videoId}`) === key) || null;
  }

  function updateContentItemByKey(key, patch) {
    const matches = (item) => (item.uploadId || `${item.channelId}::${item.videoId}`) === key;
    contentLibrary = contentLibrary.map((item) => matches(item) ? { ...item, ...patch } : item);
    fleetState.results = fleetState.results.map((item) => matches(item) ? { ...item, ...patch } : item);
    saveFleetState();
  }

  async function openContentDrawer(key) {
    const item = contentItemByKey(key);
    if (!item) throw new Error("Không tìm thấy video trong Content Manager.");
    fleetState.contentScrollTop = Number(root?.querySelector(".ycg-content-table > div")?.scrollTop || 0);
    fleetState.studioTab = "content";
    fleetState.contentMode = "manager";
    saveFleetState();
    if (!item.videoId) {
      const draft = editorDraftFromVideo(item);
      contentDrawer = { loading: false, item, audit: [], captions: [], draft, originalDraft: { ...draft }, activeSection: "details", dirty: false };
      return render();
    }
    location.hash = videoWorkspaceRoute(item.channelId, item.videoId);
  }

  function returnToContentManager() {
    if (contentDrawer?.dirty && !confirm("Bạn có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?")) return false;
    contentDrawer = null;
    deleteDialog = null;
    errorMessage = "";
    fleetState.studioTab = "content";
    fleetState.contentMode = "manager";
    saveFleetState();
    const target = "#/davinci-resolve/youtube";
    if (location.hash === target) render();
    else location.replace(target);
    return true;
  }

  function handleShellBack(event) {
    if (!event.target.closest?.("[data-shell-back]")) return;
    if (!contentDrawer && !videoRouteTarget()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    returnToContentManager();
  }

  async function copySelectedContentMetadata() {
    const selected = new Set(fleetState.selectedContentIds);
    const items = mergedContentItems().filter((item) => selected.has(item.uploadId || `${item.channelId}::${item.videoId}`) && item.videoId);
    if (items.length < 2) throw new Error("Chọn ít nhất hai video có Video ID để copy metadata.");
    const source = items[0];
    if (!confirm(`Copy tiêu đề, mô tả và tag từ “${source.title}” sang ${items.length - 1} video? YouTube tính quota cho từng lần cập nhật.`)) return;
    for (const item of items.slice(1)) {
      await api("videos/update", "POST", { channelId: item.channelId, videoId: item.videoId, title: source.title, description: source.description || "", tags: source.tags || [], approved: true, metadataVersion: `copy-${Date.now().toString(36)}` });
    }
    await loadContentLibrary();
    render();
    status(`Đã copy metadata thật sang ${items.length - 1} video.`, "success");
  }

  async function platformAuthApi(path, body) {
    const response = await fetch(`${apiBase()}${path}`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body || {}), credentials: "include", cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Xác thực HTTP ${response.status}`);
    return data;
  }

  async function reauthenticateForDelete() {
    const identity = currentIdentity();
    if (!identity?.email || !window.PublicKeyCredential || !navigator.credentials || !window.HHAuthPlatform?.publicKeyOptions) {
      throw new Error("Phiên đăng nhập đã cũ. Hãy đăng nhập lại hoặc cấu hình Passkey trong Trung tâm bảo mật rồi thử lại.");
    }
    const options = await platformAuthApi("/api/auth/passkey-login-options", { email: identity.email });
    const credential = await navigator.credentials.get({ publicKey: window.HHAuthPlatform.publicKeyOptions(options.options) });
    const verified = await platformAuthApi("/api/auth/passkey-login-verify", { requestId: options.requestId, response: window.HHAuthPlatform.credentialJSON(credential), remember: true });
    if (!verified.token) throw new Error("Passkey đã xác minh nhưng máy chủ không cấp phiên mới.");
    window.HHAuthSession?.setToken?.(verified.token);
    return true;
  }

  function openDeleteDialog(item, key) {
    if (!item?.videoId) throw new Error("Video chưa có Video ID nên không thể xóa trên YouTube.");
    deleteDialog = { item: { ...item }, key, idempotencyKey: `${uid("delete-video")}-${Math.random().toString(36).slice(2, 12)}` };
    render();
    requestAnimationFrame(() => root?.querySelector("[data-ycg-delete-form] input[name=confirmation]")?.focus());
  }

  async function applySaferDeleteAlternative(mode) {
    const item = deleteDialog?.item;
    if (!item?.videoId) throw new Error("Không tìm thấy video cần cập nhật.");
    const privacyStatus = mode === "unlisted" ? "unlisted" : "private";
    const result = await api("videos/update", "POST", { channelId: item.channelId, videoId: item.videoId, privacyStatus, publishAt: "", aiDisclosure: normalizeAiDisclosure(item.aiDisclosure), approved: true, metadataVersion: `safe-delete-${Date.now().toString(36)}` });
    const key = deleteDialog.key;
    contentLibrary = contentLibrary.map((entry) => (entry.uploadId || `${entry.channelId}::${entry.videoId}`) === key ? { ...entry, ...(result.video || {}), scheduledAt: null, publishAt: null } : entry);
    if (contentDrawer?.item?.videoId === item.videoId && contentDrawer?.item?.channelId === item.channelId) {
      const draft = { ...(contentDrawer.draft || editorDraftFromVideo(contentDrawer.item)), privacyStatus, publishAt: "" };
      const originalDraft = { ...(contentDrawer.originalDraft || editorDraftFromVideo(contentDrawer.item)), privacyStatus, publishAt: "" };
      contentDrawer = { ...contentDrawer, item: { ...contentDrawer.item, ...(result.video || {}), scheduledAt: null, publishAt: null }, draft, originalDraft, dirty: !draftsEqual(draft, originalDraft), audit: result.audit || contentDrawer.audit || [] };
    }
    deleteDialog = null;
    render();
    status(mode === "unlisted" ? "Đã chuyển video sang Unlisted; video không bị xóa." : mode === "cancel-schedule" ? "Đã hủy lịch và giữ video ở Private." : "Đã chuyển video sang Private; video không bị xóa.", "success");
  }

  async function deleteVideoPermanently(form) {
    const item = deleteDialog?.item;
    if (!item?.videoId) throw new Error("Không tìm thấy video cần xóa.");
    const data = Object.fromEntries(new FormData(form));
    const confirmation = String(data.confirmation || "").trim();
    if (data.permanentAck !== "on") throw new Error("Hãy xác nhận rằng bạn hiểu video không thể khôi phục.");
    if (confirmation !== "DELETE" && confirmation !== String(item.title || "").trim()) throw new Error("Hãy nhập DELETE hoặc chính xác tiêu đề video.");
    const payload = { channelId: item.channelId, videoId: item.videoId, confirmation, approved: true, idempotencyKey: deleteDialog.idempotencyKey };
    let result;
    try { result = await api("videos/delete", "POST", payload); }
    catch (error) {
      if (error.code !== "AUTH_RECENT_REQUIRED") throw error;
      status("Phiên đã cũ · đang yêu cầu Passkey…", "success");
      await reauthenticateForDelete();
      result = await api("videos/delete", "POST", payload);
    }
    if (!result.deleted || Number(result.providerStatus) !== 204) throw new Error("YouTube chưa xác nhận xóa video.");
    contentLibrary = contentLibrary.filter((entry) => !(entry.videoId === item.videoId && entry.channelId === item.channelId));
    fleetState.results = fleetState.results.filter((entry) => !(entry.videoId === item.videoId && entry.channelId === item.channelId));
    fleetState.selectedContentIds = fleetState.selectedContentIds.filter((key) => key !== deleteDialog.key);
    deleteDialog = null;
    contentDrawer = null;
    saveFleetState();
    if (videoRouteTarget()) history.replaceState({}, "", `${location.pathname}${location.search}#/davinci-resolve/youtube`);
    render();
    status("YouTube đã trả HTTP 204. Video đã bị xóa vĩnh viễn và không thể khôi phục.", "success");
  }

  async function applySelectedContentAiDisclosure(disclosureValue) {
    const selected = new Set(fleetState.selectedContentIds);
    const items = mergedContentItems().filter((item) => item.videoId && selected.has(item.uploadId || `${item.channelId}::${item.videoId}`)).slice(0, 100);
    if (!items.length) throw new Error("Chọn ít nhất một video có Video ID.");
    const disclosure = normalizeAiDisclosure(disclosureValue);
    if (!AI_DISCLOSURE_OPTIONS.includes(disclosure) || disclosure === "unreviewed") throw new Error("Hãy chọn Có hoặc Không cho khai báo sử dụng AI.");
    for (const item of items) await api("videos/update", "POST", { channelId: item.channelId, videoId: item.videoId, aiDisclosure: disclosure, approved: true, metadataVersion: `bulk-ai-${Date.now().toString(36)}` });
    aiBulkDialog = false;
    await loadContentLibrary();
    render();
    status(`Đã cập nhật khai báo AI cho ${items.length} video.`, "success");
  }

  function fleetView() {
    if (!channelStatus.connected) return `${batchWorkspaceBanner()}${emptyState(
      "Kết nối kênh để mở Studio đa kênh",
      "Bạn có thể thêm tối đa 100 kênh. Kênh, token và tác vụ luôn được khóa theo tài khoản HH hiện tại.",
      channelStatus.authRequired ? "signin" : "connect-creator",
      channelStatus.authRequired ? "Đăng nhập" : "Thêm kênh YouTube"
    )}`;
    const channels = (fleetOverview?.channels || channelStatus.channels || []).filter(Boolean);
    if (contentDrawer) return videoStudioWorkspaceMarkup(channels);
    if (videoRouteTarget()) return `<section class="ycg-video-workspace is-loading"><div class="ycg-loading"><i></i><strong>Đang tải workspace video từ YouTube…</strong></div></section>`;
    const filteredChannels = filteredFleetChannels(channels);
    const selected = new Set(fleetState.selectedChannelIds);
    const selectedChannels = channels.filter((channel) => selected.has(channel.id));
    const limits = { maxChannelsPerBulkJob: 20, maxChannelsInVault: 100, maxVideosPerQueue: 10, maxTasksPerBatch: 100, ...(fleetOverview?.limits || fleetObservatory?.limits || {}) };
    const selectionCapacity = Math.min(100, limits.maxChannelsInVault);
    const activeFile = fleetFileByFingerprint();
    const activeDraft = fleetDraft();
    const summary = fleetObservatory?.summary || {};
    const observatoryMap = new Map((fleetObservatory?.channels || []).map((row) => [row.channel?.id, row]));
    const estimatedTasks = selectedMatrixTasks(selectedChannels.map((channel) => channel.id)).length;
    const runningTasks = fleetState.results.filter((item) => ["queued", "uploading", "verifying", "thumbnail", "processing"].includes(item.status)).length;
    const unansweredComments = (dashboard?.comments || []).filter((item) => Number(item.replyCount || 0) === 0).length;
    const tabs = [
      ["overview", "Tổng quan", channels.length, "⌂"],
      ["content", "Đăng video", fleetUploadFiles.length, "+"],
      ["calendar", "Lịch đăng", state.calendar.length, "□"],
      ["comments", "Bình luận", unansweredComments, "◌"],
      ["analytics", "Phân tích", dashboard?.analytics?.rows?.length || 0, "↗"],
      ["queue", "Tiến trình", runningTasks, "◷"],
      ["settings", "Cài đặt", channels.length, "⚙"]
    ];
    const channelTable = `<div class="ycg-studio-channel-table"><table><thead><tr><th></th><th>Kênh</th><th>Người đăng ký</th><th>Lượt xem</th><th>Trạng thái</th><th>Đồng bộ</th><th>Quản lý</th></tr></thead><tbody>${filteredChannels.map((channel) => {
      const row = observatoryMap.get(channel.id);
      const ready = channel.permissions?.upload && channel.token?.healthy;
      return `<tr class="${selected.has(channel.id) ? "is-selected" : ""}"><td><input type="checkbox" data-ycg-fleet-channel value="${esc(channel.id)}" ${selected.has(channel.id) ? "checked" : ""}></td><td><button type="button" class="ycg-channel-name" data-ycg-studio-channel="${esc(channel.id)}">${channel.thumbnail ? `<img src="${esc(channel.thumbnail)}" alt="">` : "<i>YT</i>"}<span><strong>${esc(channel.title)}</strong><small>${esc(channel.account?.hint || channel.id)}</small></span></button></td><td><strong>${fmt(channel.statistics?.subscribers)}</strong></td><td><strong>${fmt(channel.statistics?.views)}</strong></td><td><span class="ycg-table-status ${row?.uploads?.failed ? "is-error" : row?.uploads?.pending ? "is-running" : ready ? "is-ready" : "is-warning"}">${row?.uploads?.failed ? `${row.uploads.failed} lỗi` : row?.uploads?.pending ? `${row.uploads.pending} đang chạy` : ready ? "Sẵn sàng" : "Thiếu quyền"}</span></td><td><small>${dateTime(row?.syncedAt || channel.updatedAt)}</small></td><td><button type="button" class="ycg-remove-channel" data-ycg-remove-channel="${esc(channel.id)}" aria-label="Xóa kết nối ${esc(channel.title)}">Xóa</button></td></tr>`;
    }).join("") || `<tr><td colspan="7">Không có kênh phù hợp bộ lọc.</td></tr>`}</tbody></table></div>`;
    const overview = `<section class="ycg-studio-overview-simple">
      <div class="ycg-studio-metrics"><article><span>Sẵn sàng upload</span><strong>${fmt(summary.uploadReady)}</strong><small>Có token và quyền upload</small></article><article><span>Người đăng ký</span><strong>${fmt(summary.subscribers)}</strong><small>Tổng dữ liệu đã đồng bộ</small></article><article><span>Đang xử lý</span><strong>${fmt(summary.pendingUploads)}</strong><small>Upload và YouTube xử lý</small></article><article><span>Cần chú ý</span><strong>${fmt(Number(summary.failedUploads || 0) + Number(summary.unansweredDrafts || 0))}</strong><small>Lỗi và phản hồi nháp</small></article></div>
      <section class="ycg-panel ycg-channel-library"><header><div><h3>Danh sách kênh</h3><small>${filteredChannels.length}/${channels.length} kênh · chọn kênh rồi mở tab Đăng video</small></div></header><div class="ycg-channel-toolbar"><input data-ycg-channel-search value="${esc(fleetState.channelSearch)}" placeholder="Tìm tên kênh, Channel ID hoặc tài khoản Google"><select data-ycg-channel-filter><option value="all" ${fleetState.channelFilter === "all" ? "selected" : ""}>Tất cả trạng thái</option><option value="ready" ${fleetState.channelFilter === "ready" ? "selected" : ""}>Sẵn sàng upload</option><option value="warning" ${fleetState.channelFilter === "warning" ? "selected" : ""}>Thiếu quyền/token</option><option value="uploading" ${fleetState.channelFilter === "uploading" ? "selected" : ""}>Đang xử lý</option><option value="error" ${fleetState.channelFilter === "error" ? "selected" : ""}>Có lỗi</option></select><button type="button" data-ycg-action="fleet-select-visible">Chọn kênh đang lọc</button><button type="button" data-ycg-action="fleet-refresh">Làm mới</button><button type="button" class="ycg-danger-action" data-ycg-action="fleet-remove-selected" ${selectedChannels.length ? "" : "disabled"}>Xóa kênh đã chọn (${selectedChannels.length})</button></div>${channelTable}</section>
    </section>`;
    const uploadAccounts = [...new Map(channels.map((channel) => [uploadChannelAccountKey(channel), channel.account?.hint || "Tài khoản Google"])).entries()];
    const uploadVisibleIds = new Set(filteredUploadChannels(channels).map((channel) => channel.id));
    const channelPicker = `<section class="ycg-upload-channel-picker" aria-label="Chọn kênh đăng video"><header><div><small>KÊNH ĐÍCH</small><h3>Chọn kênh đăng video</h3><p>Chọn ngay tại đây trước khi chỉnh video. Mỗi kênh nhận tối đa 10 video trong đợt hiện tại.</p></div><strong><b>${selectedChannels.length}</b><span>/${selectionCapacity} kênh đã chọn</span></strong></header><div class="ycg-upload-channel-toolbar"><label><span>⌕</span><input data-ycg-upload-channel-search value="${esc(fleetState.uploadChannelSearch)}" placeholder="Tìm tên kênh hoặc tài khoản Google" aria-label="Tìm kênh đăng video"></label><select data-ycg-upload-account-filter aria-label="Lọc tài khoản Google"><option value="all">Tất cả tài khoản Google</option>${uploadAccounts.map(([key,hint])=>`<option value="${esc(key)}" ${fleetState.uploadAccountFilter===key?"selected":""}>${esc(hint)}</option>`).join("")}</select><button type="button" data-ycg-action="upload-select-visible-channels">Chọn đang lọc</button><button type="button" data-ycg-action="upload-select-ready-channels">Chỉ kênh sẵn sàng</button><button type="button" data-ycg-action="upload-clear-channels" ${selectedChannels.length?"":"disabled"}>Bỏ chọn</button></div><div class="ycg-upload-channel-rail">${channels.map((channel)=>{const ready=Boolean(channel.permissions?.upload&&channel.token?.healthy);const checked=selected.has(channel.id);return `<label data-ycg-upload-channel-card data-search="${esc(`${channel.title} ${channel.id} ${channel.account?.hint||""}`.toLocaleLowerCase("vi"))}" data-account="${esc(uploadChannelAccountKey(channel))}" class="${checked?"is-selected":""} ${ready?"is-ready":"is-warning"}" ${uploadVisibleIds.has(channel.id)?"":"hidden"}><input type="checkbox" data-ycg-fleet-channel value="${esc(channel.id)}" ${checked?"checked":""}><span>${channel.thumbnail?`<img src="${esc(channel.thumbnail)}" alt="">`:`<i>${esc(String(channel.title||"YT").slice(0,2).toUpperCase())}</i>`}<em>${checked?"✓":""}</em></span><div><strong>${esc(channel.title)}</strong><small>${esc(channel.account?.hint||"Google")} · ${ready?"Sẵn sàng upload":"Thiếu quyền hoặc token"}</small></div></label>`;}).join("")}</div>${selectedChannels.length?`<footer><span>Video sẽ được tạo tác vụ cho:</span>${selectedChannels.slice(0,8).map((channel)=>`<b>${esc(channel.title)}</b>`).join("")}${selectedChannels.length>8?`<b>+${selectedChannels.length-8} kênh</b>`:""}</footer>`:`<div class="ycg-upload-channel-empty"><strong>Chưa chọn kênh đích</strong><span>Hãy chọn ít nhất một kênh trước khi Preflight & Upload.</span></div>`}</section>`;
    const videoQueue = `<section class="ycg-panel ycg-video-queue"><header><div><h3>Video đã chọn</h3><small>Tối đa ${limits.maxVideosPerQueue} video · file chỉ ở trên thiết bị</small></div><button type="button" data-ycg-action="fleet-clear-videos">Xóa hàng đợi</button></header><label class="ycg-studio-drop" data-ycg-fleet-drop><input type="file" multiple accept="video/mp4,video/quicktime,video/webm,video/x-matroska" data-ycg-fleet-file><strong>Kéo tối đa 10 video vào đây</strong><span>MP4, MOV, WebM, MKV · không tải lên cho đến khi bạn xác nhận</span></label><div class="ycg-video-file-list">${fleetUploadFiles.map((file, index) => {
      const fingerprint = fleetFileFingerprint(file);
      const draft = fleetDraft(fingerprint, file);
      const taskCount = fleetState.results.filter((item) => item.fingerprint === fingerprint).length;
      return `<article class="${fingerprint === fleetState.activeFileFingerprint ? "is-active" : ""}"><button type="button" data-ycg-fleet-video="${esc(fingerprint)}"><i>${index + 1}</i><span><strong>${esc(draft.title || file.name)}</strong><small>${esc(file.name)} · ${bytes(file.size)} · ${taskCount} tác vụ</small></span></button><button type="button" data-ycg-remove-fleet-video="${esc(fingerprint)}" aria-label="Xóa ${esc(file.name)}">×</button></article>`;
    }).join("") || `<p>Chưa có video. Bạn có thể thả nhiều file một lần.</p>`}</div></section>`;
    const metadataEditor = activeFile && activeDraft ? `<section class="ycg-panel ycg-studio-editor"><header><div><h3>Chi tiết video</h3><small>${esc(activeFile.name)} · chỉnh một lần, preset tự áp theo kênh</small></div><span>${activeDraft.thumbnailReady ? "Thumbnail A/B/C đã tạo" : "Dùng thumbnail YouTube nếu chưa tạo"}</span></header><video data-ycg-fleet-preview controls muted playsinline preload="metadata" src="${esc(thumbnailVideoUrl)}"></video><label>Tiêu đề<input name="title" maxlength="100" value="${esc(activeDraft.title)}"></label><label>Mô tả<textarea name="description" maxlength="5000" rows="5">${esc(activeDraft.description)}</textarea></label><div class="ycg-inline-fields"><label>Tags<input name="tags" maxlength="500" value="${esc(activeDraft.tags)}"></label><label>Upload song song<select name="concurrency"><option value="1" ${fleetState.concurrency === 1 ? "selected" : ""}>1</option><option value="2" ${fleetState.concurrency === 2 ? "selected" : ""}>2</option><option value="3" ${fleetState.concurrency === 3 ? "selected" : ""}>3</option></select></label></div><div class="ycg-quick-toggles"><label><input type="checkbox" name="uploadPrivateFirst" ${fleetState.uploadPrivateFirst ? "checked" : ""}> Private trước</label><label><input type="checkbox" name="madeForKids" ${fleetState.madeForKids ? "checked" : ""}> Dành cho trẻ em</label></div><label class="ycg-ai-disclosure">Video có chứa nội dung được tạo hoặc chỉnh sửa đáng kể bằng AI và trông như thật không?<select name="aiDisclosure"><option value="unreviewed" ${activeDraft.aiDisclosure === "unreviewed" ? "selected" : ""}>Chưa kiểm tra · chỉ Private</option><option value="yes" ${activeDraft.aiDisclosure === "yes" ? "selected" : ""}>Có · khai báo với YouTube</option><option value="no" ${activeDraft.aiDisclosure === "no" ? "selected" : ""}>Không · đã kiểm tra</option></select><small>Khai báo này là mặc định cho video; có thể đổi riêng ở từng ô video × kênh.</small></label><details class="ycg-simple-thumbnail"><summary>Chỉnh thumbnail cho video này</summary><canvas width="1280" height="720" data-ycg-fleet-thumbnail></canvas><div class="ycg-thumb-mini-row">${["A", "B", "C"].map((variant) => `<button type="button" data-ycg-fleet-variant="${variant}" class="${fleetState.thumbnailVariant === variant ? "is-active" : ""}"><canvas width="320" height="180" data-ycg-fleet-thumbnail-mini="${variant}"></canvas><span><b>${variant}</b></span></button>`).join("")}</div><div class="ycg-inline-fields"><label>Chữ chính<input data-ycg-fleet-thumb="title" value="${esc(activeDraft.thumbnailTitle)}"></label><label>Chữ phụ<input data-ycg-fleet-thumb="subtitle" value="${esc(activeDraft.thumbnailSubtitle)}"></label><label>Màu<input type="color" data-ycg-fleet-thumb="accent" value="${esc(activeDraft.thumbnailAccent)}"></label></div><div class="ycg-action-row"><button type="button" data-ycg-action="fleet-capture-frame">Lấy frame</button><button type="button" data-ycg-action="fleet-generate-variants">Tạo A/B/C</button></div></details></section>` : `<section class="ycg-panel ycg-studio-editor ycg-empty-editor"><strong>Chọn một video để chỉnh metadata</strong></section>`;
    const overrides = activeDraft ? `<section class="ycg-panel ycg-channel-overrides"><header><div><h3>Thiết lập theo kênh</h3><small>${selectedChannels.length} kênh đích · tiêu đề, playlist, lịch và thumbnail riêng</small></div><button type="button" data-ycg-action="fleet-copy-metadata">Dùng tiêu đề gốc</button></header><div class="ycg-metadata-table-wrap"><table class="ycg-metadata-table"><thead><tr><th>Kênh</th><th>Tiêu đề</th><th>Thumbnail</th><th>Playlist</th><th>Quyền hiển thị</th><th>Lịch đăng</th></tr></thead><tbody>${selectedChannels.map((channel) => {
      const preset = channelPreset(channel.id);
      const playlists = channel.playlists || [];
      return `<tr><td><div class="ycg-table-channel">${channel.thumbnail ? `<img src="${esc(channel.thumbnail)}" alt="">` : "<i>YT</i>"}<span><strong>${esc(channel.title)}</strong><small>${esc(channel.account?.hint || "Google")}</small></span></div></td><td><input data-ycg-channel-title data-channel-id="${esc(channel.id)}" maxlength="100" value="${esc(effectiveChannelTitle(channel.id, activeDraft))}"></td><td><select data-ycg-channel-preset="thumbnailVariant" data-channel-id="${esc(channel.id)}">${["A", "B", "C"].map((variant) => `<option ${preset.thumbnailVariant === variant ? "selected" : ""}>${variant}</option>`).join("")}</select></td><td><select data-ycg-channel-preset="playlistId" data-channel-id="${esc(channel.id)}"><option value="">Không playlist</option>${playlists.map((item) => `<option value="${esc(item.id)}" ${preset.playlistId === item.id ? "selected" : ""}>${esc(item.title)}</option>`).join("")}</select></td><td><select data-ycg-channel-preset="privacyStatus" data-channel-id="${esc(channel.id)}"><option value="private" ${preset.privacyStatus === "private" ? "selected" : ""}>Private</option><option value="unlisted" ${preset.privacyStatus === "unlisted" ? "selected" : ""}>Unlisted</option><option value="schedule" ${preset.privacyStatus === "schedule" ? "selected" : ""}>Lên lịch</option></select></td><td><input type="datetime-local" data-ycg-channel-preset="publishAt" data-channel-id="${esc(channel.id)}" value="${esc(preset.publishAt)}"></td></tr>`;
    }).join("") || `<tr><td colspan="6">Chọn kênh trong tab Tổng quan.</td></tr>`}</tbody></table></div><div class="ycg-channel-schedule-presets">${selectedChannels.map((channel) => { const preset = channelPreset(channel.id); return `<label><strong>${esc(channel.title)}</strong><span>Giờ mặc định<input type="time" data-ycg-channel-preset="publishTime" data-channel-id="${esc(channel.id)}" value="${esc(preset.publishTime)}"></span><span>Múi giờ<select data-ycg-channel-preset="timezone" data-channel-id="${esc(channel.id)}">${[preset.timezone, "Asia/Bangkok", "Asia/Ho_Chi_Minh", "UTC", "America/New_York"].filter((value, index, all) => all.indexOf(value) === index).map((zone) => `<option ${preset.timezone === zone ? "selected" : ""}>${esc(zone)}</option>`).join("")}</select></span></label>`; }).join("")}</div></section>` : "";
    const uploadReady = Boolean(fleetUploadFiles.length && selectedChannels.length && fleetState.rightsConfirmed);
    const uploadActionLabel = busy.startsWith("bulk/") ? "Đang tải video…" : `↑ Tải ${fleetUploadFiles.length || ""} video lên YouTube`.replace("  ", " ");
    const uploadDock = `<section class="ycg-upload-action-dock" aria-label="Tải video lên YouTube"><div><strong>${fleetUploadFiles.length} video → ${selectedChannels.length} kênh · ${estimatedTasks} tác vụ</strong><small>${fleetPreflight ? `${fleetPreflight.ready ? "✓ Đã kiểm tra" : "! Cần xử lý trước khi tải"} · ${fmt(fleetPreflight.estimatedQuota)} quota unit ước tính` : "Hệ thống sẽ kiểm tra quyền, token, metadata và lịch trước khi tải."}</small></div><label><input type="checkbox" name="rightsConfirmed" ${fleetState.rightsConfirmed ? "checked" : ""}> Tôi có quyền sử dụng video, nhạc và thumbnail.</label><div><button type="button" data-ycg-action="fleet-preflight">Kiểm tra trước</button><button type="submit" class="is-primary ycg-upload-now" ${uploadReady && !busy.startsWith("bulk/") ? "" : "disabled"}>${uploadActionLabel}</button></div></section>`;
    const advancedMatrix = `<details class="ycg-upload-advanced"><summary><span><strong>Cài đặt nâng cao</strong><small>Lịch, AI, quyền hiển thị và ma trận từng video × kênh</small></span><b>⌄</b></summary><div>${batchMatrixMarkup(selectedChannels, limits)}${overrides}</div></details>`;
    const contentUpload = `<form data-ycg-fleet-form class="ycg-studio-content">${channelPicker}<div class="ycg-content-columns">${videoQueue}${metadataEditor}</div>${uploadDock}${advancedMatrix}</form>`;
    const content = `${batchWorkspaceBanner()}<div class="ycg-content-mode"><button type="button" data-ycg-content-mode="upload" class="${fleetState.contentMode === "upload" ? "is-active" : ""}">＋ Batch Upload Matrix</button><button type="button" data-ycg-content-mode="manager" class="${fleetState.contentMode === "manager" ? "is-active" : ""}">▤ Content Manager</button><span>${fleetState.contentMode === "upload" ? "Tối đa 10 video/kênh · round-robin queue" : "Xem và chỉnh trực tiếp video thật"}</span></div>${fleetState.contentMode === "manager" ? contentManagerMarkup(channels) : contentUpload}`;
    const queue = `<section class="ycg-panel ycg-task-center"><header><div><h3>Continuous Channel Queue</h3><small>Round-robin · mỗi kênh một video tại một thời điểm · không upload lại tác vụ thành công</small></div><div><button type="button" data-ycg-action="queue-${queuePaused ? "resume" : "pause"}-all">${queuePaused ? "Tiếp tục tất cả" : "Tạm dừng tất cả"}</button><button type="button" data-ycg-action="fleet-refresh">Làm mới</button></div></header><div class="ycg-task-summary"><span>${fleetState.results.length} tổng</span><span>${fleetState.results.filter((item) => item.status === "uploading").length} đang upload</span><span>${fleetState.results.filter((item) => item.status === "processing").length} YouTube xử lý</span><span>${fleetState.results.filter((item) => item.status === "paused").length} tạm dừng</span><span>${fleetState.results.filter((item) => item.status === "failed").length} lỗi</span></div><div class="ycg-task-table"><table><thead><tr><th>Video</th><th>Kênh</th><th>Batch</th><th>Trạng thái</th><th>Tiến trình</th><th>Tốc độ / ETA</th><th>Hành động</th></tr></thead><tbody>${fleetState.results.map((item) => `<tr><td><strong>${esc(item.fileName || "Video")}</strong><small>${esc(item.videoId || item.checksum || "")}</small></td><td>${esc(item.channelTitle || item.channelId)}</td><td>${item.batchIndex ? `${item.batchIndex}/${item.batchTotal || item.batchIndex}` : "—"}</td><td><span class="ycg-table-status ${item.status === "failed" ? "is-error" : ["uploading", "processing", "verifying", "thumbnail", "paused"].includes(item.status) ? "is-running" : "is-ready"}">${esc(item.status)}</span>${item.error ? `<small>${esc(item.error)}</small>` : ""}</td><td><progress max="100" value="${Number(item.progress || 0)}"></progress><small>${Number(item.progress || 0).toFixed(1)}%</small></td><td>${item.speedBps ? `${bytes(item.speedBps)}/s · ${Math.ceil(item.etaSeconds || 0)}s` : "—"}</td><td>${item.status === "uploading" ? `<button type="button" data-ycg-task-pause="${esc(item.taskKey)}">Tạm dừng</button>` : ["paused", "failed"].includes(item.status) && item.uploadId ? `<button type="button" data-ycg-fleet-retry="${esc(item.taskKey)}">Tiếp tục</button>` : item.status === "uploaded" && item.uploadId ? `<button type="button" data-ycg-fleet-approve="${esc(item.taskKey)}">Duyệt</button>` : ""}${["queued", "uploading", "paused", "failed"].includes(item.status) && item.uploadId ? `<button type="button" class="is-danger" data-ycg-task-cancel="${esc(item.taskKey)}">Hủy</button>` : ""}${item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noopener">Mở video</a>` : ""}</td></tr>`).join("") || `<tr><td colspan="7">Chưa có tác vụ. Chọn video và kênh trong tab Đăng video.</td></tr>`}</tbody></table></div></section>`;
    const studioView = fleetState.studioTab === "content" ? content
      : fleetState.studioTab === "calendar" ? calendarView(true)
        : fleetState.studioTab === "comments" ? commentsView()
          : fleetState.studioTab === "analytics" ? analyticsView()
            : fleetState.studioTab === "queue" ? queue
              : fleetState.studioTab === "settings" ? channelSettingsMarkup(channels)
                : overview;
    return `<div class="ycg-multistudio ${batchRouteMode ? "is-batch-route" : ""}"><section class="ycg-studio-simple-head"><div><small>${batchRouteMode ? "YOUTUBE BATCH PUBLISHER" : "YOUTUBE MULTI-CHANNEL STUDIO"}</small><h2>${batchRouteMode ? "Tự động hóa video từ thư mục máy tính" : "Quản lý nhiều kênh trong một nơi"}</h2><p>${batchRouteMode ? "File vẫn trên thiết bị; upload đi thẳng tới YouTube sau khi bạn duyệt." : "Đăng video, xếp lịch, phản hồi và phân tích mà không rời Studio."}</p></div><div><strong>${selectedChannels.length}</strong><span>kênh đang chọn</span><button type="button" data-ycg-action="connect-creator">+ Thêm kênh</button></div></section><nav class="ycg-studio-tabs" aria-label="Công cụ quản lý kênh">${tabs.map(([id, label, count, icon]) => `<button type="button" data-ycg-fleet-tab="${id}" class="${fleetState.studioTab === id ? "is-active" : ""}"><i>${icon}</i><span>${label}</span><b>${count}</b></button>`).join("")}</nav><div class="ycg-studio-embedded">${studioView}</div></div>`;
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
    if (!channelStatus.permissions?.analytics) return `<div class="ycg-empty"><span aria-hidden="true">AN</span><strong>Thiếu quyền YouTube Analytics</strong><p>Kênh vẫn dùng được Upload, Metadata, Community và Live với hai quyền đã duyệt. Analytics cần cấp riêng quyền yt-analytics.readonly; nếu scope này chưa nằm trong hồ sơ Google đã phê duyệt, chủ dự án cần gửi xác minh bổ sung.</p><div class="ycg-action-row"><button class="is-primary" type="button" data-ycg-action="connect-analytics">Cấp quyền Analytics</button><button type="button" data-ycg-module="command">Mở Command Center</button></div></div>`;
    if (!dashboard?.analytics) return emptyState("Analytics chưa có dữ liệu", "Quyền Analytics đã được cấp nhưng YouTube chưa trả dữ liệu cho khoảng ngày hiện tại. Hãy đồng bộ lại; hệ thống không tạo biểu đồ mẫu.", "refresh", "Đồng bộ lại");
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

  function calendarScheduleKey(channelId, videoId) {
    return `${String(channelId || "").slice(0, 120)}::${String(videoId || "").slice(0, 40)}`;
  }

  function calendarContentItems() {
    const channelFilter = fleetState.calendarChannelFilter;
    const typeFilter = fleetState.calendarTypeFilter;
    return mergedContentItems().filter((item) => item.videoId)
      .map((item) => {
        const key = calendarScheduleKey(item.channelId, item.videoId);
        const draft = fleetState.scheduleDrafts[key];
        return { ...item, scheduleKey: key, scheduledAt: draft?.publishAt || item.scheduledAt || item.publishAt || "", scheduleChanged: Boolean(draft) };
      })
      .filter((item) => channelFilter === "all" || item.channelId === channelFilter)
      .filter((item) => typeFilter === "all" || String(item.type || "Video") === typeFilter);
  }

  function scheduleConflicts(items) {
    const slots = new Map();
    items.forEach((item) => {
      if (!item.scheduledAt) return;
      const key = `${item.channelId}::${new Date(item.scheduledAt).toISOString().slice(0, 16)}`;
      slots.set(key, (slots.get(key) || 0) + 1);
    });
    return new Set([...slots].filter(([, count]) => count > 1).map(([key]) => key));
  }

  function zonedLocalToIso(day, time, timeZone) {
    const [year, month, date] = String(day).split("-").map(Number);
    const [hour, minute] = String(time || "20:00").split(":").map(Number);
    let instant = Date.UTC(year, month - 1, date, hour, minute, 0);
    try {
      const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
      for (let iteration = 0; iteration < 2; iteration += 1) {
        const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
        const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
        instant += Date.UTC(year, month - 1, date, hour, minute, 0) - represented;
      }
    } catch {}
    return new Date(instant).toISOString();
  }

  function fleetCalendarView(channels) {
    const items = calendarContentItems();
    const conflicts = scheduleConflicts(items);
    const selected = new Set(fleetState.selectedContentIds);
    const pendingCount = Object.keys(fleetState.scheduleDrafts).length;
    const mode = fleetState.calendarMode;
    const scheduled = items.filter((item) => item.scheduledAt).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    const unscheduled = items.filter((item) => !item.scheduledAt);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const gridStart = new Date(monthStart);
    gridStart.setDate(1 - ((monthStart.getDay() + 6) % 7));
    const days = Array.from({ length: 42 }, (_, index) => { const day = new Date(gridStart); day.setDate(gridStart.getDate() + index); return day; });
    const month = `<div class="ycg-calendar-month"><div class="ycg-calendar-weekdays">${["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => `<span>${day}</span>`).join("")}</div><div class="ycg-calendar-days">${days.map((day) => {
      const isoDay = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      const dayItems = scheduled.filter((item) => String(item.scheduledAt).slice(0, 10) === isoDay);
      return `<section data-ycg-calendar-day="${isoDay}" class="${day.getMonth() === now.getMonth() ? "" : "is-outside"} ${isoDay === now.toISOString().slice(0,10) ? "is-today" : ""}"><header><b>${day.getDate()}</b><small>${dayItems.length || ""}</small></header>${dayItems.slice(0, 5).map((item) => {
        const conflictKey = `${item.channelId}::${new Date(item.scheduledAt).toISOString().slice(0,16)}`;
        return `<button type="button" draggable="true" data-ycg-calendar-video="${esc(item.scheduleKey)}" data-ycg-content-open="${esc(item.uploadId || `${item.channelId}::${item.videoId}`)}" class="${item.scheduleChanged ? "is-draft" : ""} ${conflicts.has(conflictKey) ? "is-conflict" : ""}" style="--channel:${esc(channels.find((channel) => channel.id === item.channelId)?.color || channelPreset(item.channelId).brandColor)}"><time>${new Date(item.scheduledAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</time><span>${esc(item.title)}</span></button>`;
      }).join("")}${dayItems.length > 5 ? `<small>+${dayItems.length - 5} video</small>` : ""}</section>`;
    }).join("")}</div></div>`;
    const timeline = `<div class="ycg-calendar-timeline">${channels.filter((channel) => fleetState.calendarChannelFilter === "all" || channel.id === fleetState.calendarChannelFilter).map((channel) => {
      const rows = scheduled.filter((item) => item.channelId === channel.id);
      return `<section><header>${channel.thumbnail ? `<img src="${esc(channel.thumbnail)}" alt="">` : "YT"}<div><strong>${esc(channel.title)}</strong><small>${esc(channelPreset(channel.id).publishTime)} · ${esc(channelPreset(channel.id).timezone || fleetState.calendarTimezone)}</small></div></header><div>${rows.map((item) => `<button type="button" draggable="true" data-ycg-calendar-video="${esc(item.scheduleKey)}" data-ycg-content-open="${esc(item.uploadId || `${item.channelId}::${item.videoId}`)}"><time>${dateTime(item.scheduledAt)}</time><span>${esc(item.title)}</span><b>${item.scheduleChanged ? "Chờ xác nhận" : esc(item.privacyStatus || "private")}</b></button>`).join("") || `<p>Chưa có video lên lịch.</p>`}</div></section>`;
    }).join("")}</div>`;
    const board = `<div class="ycg-unscheduled-board"><header><strong>${unscheduled.length} video chưa xếp lịch</strong><span>Chọn nhiều video rồi dùng Giãn lịch hoặc kéo vào lịch tháng.</span></header>${unscheduled.map((item) => {
      const key = item.uploadId || `${item.channelId}::${item.videoId}`;
      return `<article draggable="true" data-ycg-calendar-video="${esc(item.scheduleKey)}"><input type="checkbox" data-ycg-content-select value="${esc(key)}" ${selected.has(key) ? "checked" : ""}>${item.thumbnail ? `<img src="${esc(item.thumbnail)}" alt="">` : `<span>YT</span>`}<div><strong>${esc(item.title)}</strong><small>${esc(item.channelTitle || channels.find((channel) => channel.id === item.channelId)?.title || item.channelId)}</small></div><button type="button" data-ycg-content-open="${esc(key)}">Chỉnh</button></article>`;
    }).join("") || `<p>Tất cả video trong bộ lọc đã có lịch.</p>`}</div>`;
    return `<section class="ycg-calendar-studio"><header class="ycg-calendar-studio__head"><div><small>BULK CONTENT CALENDAR</small><h3>Lịch đăng nhiều kênh</h3><p>Mọi thay đổi là bản nháp cho đến khi bấm Xác nhận lịch.</p></div><div><strong>${pendingCount}</strong><span>thay đổi chờ duyệt</span></div></header><div class="ycg-calendar-toolbar"><nav>${[["month", "Lịch tháng"], ["timeline", "Timeline theo kênh"], ["unscheduled", "Chưa xếp lịch"]].map(([id, label]) => `<button type="button" data-ycg-calendar-mode="${id}" class="${mode === id ? "is-active" : ""}">${label}</button>`).join("")}</nav><select data-ycg-calendar-channel><option value="all">Tất cả kênh</option>${channels.map((channel) => `<option value="${esc(channel.id)}" ${fleetState.calendarChannelFilter === channel.id ? "selected" : ""}>${esc(channel.title)}</option>`).join("")}</select><select data-ycg-calendar-type><option value="all">Video, Short và Live</option>${["Video", "Short", "Livestream"].map((type) => `<option ${fleetState.calendarTypeFilter === type ? "selected" : ""}>${type}</option>`).join("")}</select><select data-ycg-calendar-timezone><option>${esc(fleetState.calendarTimezone)}</option><option>Asia/Bangkok</option><option>Asia/Ho_Chi_Minh</option><option>UTC</option><option>America/New_York</option></select></div><div class="ycg-calendar-bulk"><label>Bắt đầu<input type="datetime-local" data-ycg-calendar-start></label><label>Giãn lịch<select data-ycg-calendar-spacing><option value="30">30 phút</option><option value="60" selected>1 giờ</option><option value="1440">1 ngày</option></select></label><button type="button" data-ycg-action="calendar-distribute" ${selected.size ? "" : "disabled"}>Giãn lịch ${selected.size} video</button><button type="button" data-ycg-action="calendar-undo" ${fleetState.scheduleHistory.length ? "" : "disabled"}>Hoàn tác</button><button type="button" class="is-primary" data-ycg-action="calendar-confirm" ${pendingCount ? "" : "disabled"}>Xác nhận lịch (${pendingCount})</button></div>${conflicts.size ? `<div class="ycg-calendar-warning">! Có ${conflicts.size} khung giờ bị trùng trên cùng kênh. Hãy đổi giờ trước khi xác nhận.</div>` : ""}${mode === "timeline" ? timeline : mode === "unscheduled" ? board : month}</section>`;
  }

  function calendarView(compact = false) {
    if (compact) return fleetCalendarView((fleetOverview?.channels || channelStatus.channels || []).filter(Boolean));
    const sorted = state.calendar.slice().sort((a, b) => new Date(a.at) - new Date(b.at));
    const automation = automationReadiness();
    return `<div class="ycg-calendar-grid">
      <section class="ycg-panel"><header><div><small>CONTENT PIPELINE</small><h3>Content Calendar & Automation</h3></div><span>Theo kênh · local-first</span></header>
        <form data-ycg-calendar-form><label>Nội dung<input name="title" required maxlength="160" placeholder="Tên video, Short hoặc livestream"></label><label>Loại<select name="type"><option>Video</option><option>Short</option><option>Livestream</option><option>Community</option></select></label><label>Giai đoạn<select name="stage">${["Ý tưởng", "Kịch bản", "Quay", "Dựng", "Duyệt", "Lên lịch"].map((item) => `<option>${item}</option>`).join("")}</select></label><label>Deadline<input type="datetime-local" name="at" required></label><button class="is-primary">Thêm vào lịch</button></form>
        <p class="ycg-honesty">Calendar chỉ tạo kế hoạch. Video chỉ được đăng khi Upload Center hoàn tất, toàn bộ gate đạt và người dùng xác nhận.</p>
      </section>
      <section class="ycg-panel"><header><div><small>${sorted.length} MISSION</small><h3>Lịch nội dung</h3></div></header><div class="ycg-calendar-list">${sorted.length ? sorted.map((item) => `<article><time>${dateTime(item.at)}</time><i style="--event:${MODULES[(item.type || "").length % MODULES.length].color}"></i><div><strong>${esc(item.title)}</strong><small>${esc(item.type)} · ${esc(item.stage)}</small></div><button data-ycg-calendar-remove="${item.id}">×</button></article>`).join("") : "<p>Chưa có deadline. Không tạo sự kiện mẫu.</p>"}</div></section>
      ${compact ? "" : `<section class="ycg-panel ycg-automation-panel"><header><div><small>COSMIC AUTOMATION</small><h3>Workflow có approval gate</h3></div><span>${automation.ready ? "Sẵn sàng" : "Đang chặn an toàn"}</span></header>
        <div class="ycg-automation-flow">${automation.gates.map((gate, index) => `<article class="${gate.pass ? "is-ready" : ""}"><i>${gate.pass ? "✓" : index + 1}</i><span><strong>${esc(gate.label)}</strong><small>${gate.pass ? "Đạt từ dữ liệu thật" : "Chưa đạt"}</small></span></article>`).join("")}</div>
        <div class="ycg-toggle-grid"><label><input type="checkbox" data-ycg-automation="enabled" ${state.automation.enabled ? "checked" : ""}><span>Bật automation cho project này</span></label><label><input type="checkbox" data-ycg-automation="approvalGate" ${state.automation.approvalGate ? "checked" : ""}><span>Luôn yêu cầu duyệt trước Public</span></label></div>
        <div class="ycg-action-row"><button data-ycg-action="preview-automation">Xem trước hành động</button><button class="is-primary" data-ycg-action="sync-project">Lưu workflow</button></div>
        <p>Idempotency key: <code>${esc(state.automation.idempotencyKey || "được tạo khi lưu")}</code>. Automation không xóa video, trả lời hàng loạt hoặc tự chuyển Public.</p>
      </section>`}
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
    const videoWorkspaceOpen = state.active === "fleet" && Boolean(contentDrawer || videoRouteTarget());
    root.innerHTML = `<section class="ycg-shell ${videoWorkspaceOpen ? "is-video-workspace" : ""}" data-ycg-active="${esc(state.active)}">
      ${videoWorkspaceOpen ? "" : shellHeader()}
      ${videoWorkspaceOpen ? "" : studioControlBar()}
      ${videoWorkspaceOpen ? "" : orbitMarkup()}
      <div class="ycg-layout ${videoWorkspaceOpen ? "is-video-workspace" : ""}">
        ${videoWorkspaceOpen ? "" : navigationMarkup()}
        <main class="ycg-workspace ${videoWorkspaceOpen ? "is-video-workspace" : ""}">
          ${errorMessage ? `<div class="ycg-alert"><strong>Không hoàn thành được yêu cầu</strong><span>${esc(errorMessage)}</span><button data-ycg-action="dismiss-error">×</button></div>` : ""}
          ${activeViewMarkup()}
        </main>
      </div>
      ${videoWorkspaceOpen ? `<span class="ycg-workspace-status" data-ycg-status role="status" aria-live="polite"></span>` : `<footer class="ycg-footer"><span data-ycg-status role="status" aria-live="polite">${busy ? "Đang xử lý yêu cầu thật…" : navigator.onLine ? "Online · bản nháp được lưu trên thiết bị" : "Offline · chỉ chức năng local-first hoạt động"}</span><span>Hiệu ứng chỉ phản ánh dữ liệu và sự kiện đã xác minh.</span></footer>`}
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
    if (state.active === "fleet") drawFleetThumbnail();
    if (state.active === "fleet" && !contentDrawer && !videoRouteTarget() && fleetState.contentScrollTop) {
      const scroller = root?.querySelector(".ycg-content-table > div");
      if (scroller) requestAnimationFrame(() => { scroller.scrollTop = Number(fleetState.contentScrollTop || 0); });
    }
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

  function paintFleetThumbnail(canvas, variant = fleetState.thumbnailVariant, showSafeZone = true, options = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const accent = options.accent || fleetState.thumbnailAccent || "#ff3158";
    const source = options.source || thumbnailImage || thumbnailVideo;
    const sourceWidth = Number(source?.videoWidth || source?.naturalWidth || source?.width || 0);
    const sourceHeight = Number(source?.videoHeight || source?.naturalHeight || source?.height || 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const base = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    const palettes = {
      A: ["#07090f", "#25101d", accent],
      B: ["#061018", "#10293b", accent],
      C: ["#080710", "#19152d", accent]
    };
    const palette = palettes[variant] || palettes.A;
    base.addColorStop(0, palette[0]);
    base.addColorStop(.72, palette[1]);
    base.addColorStop(1, palette[2]);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (sourceWidth && sourceHeight) {
      const scale = Math.max(canvas.width / sourceWidth, canvas.height / sourceHeight);
      const width = sourceWidth * scale;
      const height = sourceHeight * scale;
      ctx.globalAlpha = variant === "B" ? .78 : .68;
      try { ctx.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height); } catch {}
      ctx.globalAlpha = 1;
    }
    const shade = ctx.createLinearGradient(0, 0, canvas.width, 0);
    shade.addColorStop(0, "#02040df2");
    shade.addColorStop(.58, variant === "B" ? "#02040d55" : "#02040d88");
    shade.addColorStop(1, "#02040d16");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = variant === "C" ? 46 : 24;
    ctx.fillRect(70, 88, variant === "B" ? 12 : 17, 492);
    ctx.restore();
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#05070de8";
    ctx.lineWidth = variant === "A" ? 13 : 8;
    ctx.lineJoin = "round";
    ctx.font = `950 ${variant === "B" ? 98 : 92}px "Segoe UI", "Be Vietnam Pro", sans-serif`;
    ctx.textBaseline = "top";
    const title = options.title || fleetState.thumbnailTitle || fleetState.title || "TIÊU ĐỀ VIDEO";
    const words = String(title).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > 790 && line) { lines.push(line); line = word; }
      else line = candidate;
    });
    if (line) lines.push(line);
    lines.slice(0, 3).forEach((value, index) => {
      const y = (variant === "C" ? 165 : 130) + index * 108;
      ctx.strokeText(value, 112, y);
      ctx.fillText(value, 112, y);
    });
    ctx.fillStyle = accent;
    ctx.font = '850 34px "Segoe UI", "Be Vietnam Pro", sans-serif';
    ctx.fillText(String(options.subtitle || fleetState.thumbnailSubtitle || channelStatus.channel?.title || "YOUTUBE").toUpperCase(), 116, 590);
    if (showSafeZone) {
      ctx.save();
      ctx.strokeStyle = "#ffffff8a";
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 10]);
      ctx.strokeRect(48, 48, 1184, 624);
      ctx.fillStyle = "#ffffffc4";
      ctx.font = '700 18px "Segoe UI", sans-serif';
      ctx.fillText("SAFE ZONE · không xuất vào file", 58, 62);
      ctx.restore();
    }
  }

  function drawFleetThumbnail() {
    paintFleetThumbnail(root?.querySelector("[data-ycg-fleet-thumbnail]"), fleetState.thumbnailVariant, true);
    root?.querySelectorAll("[data-ycg-fleet-thumbnail-mini]").forEach((canvas) => {
      const preview = document.createElement("canvas");
      preview.width = 1280;
      preview.height = 720;
      paintFleetThumbnail(preview, canvas.dataset.ycgFleetThumbnailMini, false);
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(preview, 0, 0, canvas.width, canvas.height);
    });
  }

  async function fleetThumbnailBlob(variant = fleetState.thumbnailVariant) {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    paintFleetThumbnail(canvas, variant, false);
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Không tạo được thumbnail JPEG.")), "image/jpeg", .9));
  }

  async function createBatchThumbnailBlob(file, draft, variant = "A") {
    if (!file) return null;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const url = URL.createObjectURL(file);
    const waitFor = (eventName, timeout = 12000) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Không đọc được frame thumbnail đúng thời gian.")), timeout);
      const finish = (callback, value) => { clearTimeout(timer); video.removeEventListener(eventName, ready); video.removeEventListener("error", failed); callback(value); };
      const ready = () => finish(resolve);
      const failed = () => finish(reject, new Error("Video không cung cấp được frame để tạo thumbnail."));
      video.addEventListener(eventName, ready, { once: true });
      video.addEventListener("error", failed, { once: true });
    });
    try {
      const metadataReady = waitFor("loadedmetadata");
      video.src = url;
      video.load();
      await metadataReady;
      const duration = Number(video.duration || 0);
      const targetTime = duration > .2 ? Math.min(Math.max(.1, duration * .18), duration - .1) : 0;
      if (targetTime > 0) {
        const seekReady = waitFor("seeked");
        video.currentTime = targetTime;
        await seekReady;
      } else if (video.readyState < 2) await waitFor("loadeddata");
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      paintFleetThumbnail(canvas, variant, false, {
        source: video,
        title: draft?.thumbnailTitle || draft?.title,
        subtitle: draft?.thumbnailSubtitle,
        accent: draft?.thumbnailAccent
      });
      return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Không tạo được thumbnail tự động.")), "image/jpeg", .88));
    } finally {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    }
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
    const taskKey = patch.taskKey || channelId;
    const existing = fleetState.results.find((item) => (item.taskKey || item.channelId) === taskKey);
    if (existing) Object.assign(existing, patch);
    else fleetState.results.unshift({ channelId, taskKey, ...patch });
    fleetState.results = fleetState.results.slice(0, 1200);
    saveFleetState();
  }

  function putFleetChunk(session, file, start, end) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const taskKey = session.taskKey || session.uploadId || session.channelId;
      activeUploadRequests.set(taskKey, xhr);
      xhr.open("PUT", session.uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.setRequestHeader("Content-Range", `bytes ${start}-${end - 1}/${file.size}`);
      xhr.onload = () => {
        activeUploadRequests.delete(taskKey);
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
      xhr.onerror = () => { activeUploadRequests.delete(taskKey); reject(Object.assign(new Error("Mất kết nối khi gửi video tới YouTube."), { status: 0 })); };
      xhr.onabort = () => { activeUploadRequests.delete(taskKey); reject(Object.assign(new Error(pausedTaskKeys.has(taskKey) || queuePaused ? "Upload đã tạm dừng." : "Phiên bulk upload đã bị hủy."), { status: 499, paused: pausedTaskKeys.has(taskKey) || queuePaused })); };
      xhr.send(file.slice(start, end, file.type || "application/octet-stream"));
    });
  }

  async function uploadFleetSession(session, file) {
    const retryable = new Set([0, 408, 429, 500, 502, 503, 504]);
    const chunkSize = Math.max(256 * 1024, Number(session.chunkSize || 8 * 1024 * 1024));
    let offset = Math.max(0, Number(session.bytesUploaded || 0));
    let finalData = null;
    const startedAt = Date.now();
    const initialOffset = offset;
    let lastProgressSyncAt = 0;
    const taskPatch = { taskKey: session.taskKey || session.channelId, fingerprint: session.fingerprint || "", fileName: session.fileName || file.name };
    updateFleetResult(session.channelId, { ...taskPatch, channelTitle: session.channelTitle, uploadId: session.uploadId, status: "uploading", progress: Math.min(100, offset / Math.max(1, file.size) * 100), error: "" });
    while (offset < file.size) {
      if (queuePaused || pausedTaskKeys.has(taskPatch.taskKey)) throw Object.assign(new Error("Upload đã tạm dừng."), { status: 499, paused: true });
      const end = Math.min(file.size, offset + chunkSize);
      let response = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          response = await putFleetChunk(session, file, offset, end);
          break;
        } catch (error) {
          if (error.paused || Number(error.status) === 499) throw error;
          if (!retryable.has(Number(error.status || 0)) || attempt === 4) throw error;
          await wait(Math.min(8000, 500 * (2 ** attempt)));
        }
      }
      offset = Math.max(offset, Number(response?.offset || end));
      const progress = Math.min(100, offset / file.size * 100);
      const elapsedSeconds = Math.max(.25, (Date.now() - startedAt) / 1000);
      const speedBps = Math.max(0, (offset - initialOffset) / elapsedSeconds);
      const etaSeconds = speedBps > 0 ? Math.max(0, (file.size - offset) / speedBps) : 0;
      updateFleetResult(session.channelId, { ...taskPatch, status: response?.complete ? "verifying" : "uploading", progress, speedBps, etaSeconds });
      render();
      if (response?.complete || Date.now() - lastProgressSyncAt >= 2000) {
        lastProgressSyncAt = Date.now();
        await api("upload/progress", "POST", {
          uploadId: session.uploadId,
          bytesUploaded: offset,
          totalBytes: file.size,
          speedBps,
          etaSeconds
        }).catch(() => {});
      }
      if (response?.complete) {
        finalData = response.data;
        break;
      }
    }
    if (!finalData?.id) throw new Error("YouTube không trả về Video ID cho kênh này.");
    const preset = channelPreset(session.channelId);
    const completed = await api("upload/complete", "POST", { uploadId: session.uploadId, videoId: finalData.id, playlistId: preset.playlistId || "" });
    const sourceFile = fleetFileByFingerprint(session.fingerprint);
    const thumbnailKey = `${session.fingerprint}:${preset.thumbnailVariant}`;
    let thumbnail = fleetThumbnailVariants.get(thumbnailKey) || (sourceFile ? batchThumbnailFiles.get(normalizedAssetBase(sourceFile.name)) : null) || null;
    if (!thumbnail && batchRouteMode && sourceFile) {
      thumbnail = await createBatchThumbnailBlob(sourceFile, fleetDraft(session.fingerprint, sourceFile), preset.thumbnailVariant).catch(() => null);
      if (thumbnail) fleetThumbnailVariants.set(thumbnailKey, thumbnail);
    }
    if (thumbnail && thumbnail.size <= 2 * 1024 * 1024) {
      updateFleetResult(session.channelId, { ...taskPatch, status: "thumbnail", progress: 100 });
      const thumbnailSession = await api("thumbnail/session", "POST", {
        channelId: session.channelId,
        videoId: finalData.id,
        fileSize: thumbnail.size,
        mimeType: thumbnail.type || "image/jpeg"
      });
      await putFleetChunk({ uploadUrl: thumbnailSession.uploadUrl }, thumbnail, 0, thumbnail.size);
    }
    updateFleetResult(session.channelId, { ...taskPatch, status: completed.processingStatus === "succeeded" ? "uploaded" : "processing", progress: 100, videoId: completed.videoId, url: completed.url });
    render();
    return completed;
  }

  async function runConcurrent(items, limit, worker) {
    const queue = [...items];
    const runners = Array.from({ length: Math.min(Math.max(1, limit), queue.length || 1) }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (item) await worker(item);
      }
    });
    await Promise.all(runners);
  }

  async function generateFleetThumbnailVariants() {
    if (!fleetState.activeFileFingerprint) throw new Error("Hãy chọn video trước khi tạo thumbnail.");
    const variants = ["A", "B", "C"];
    const blobs = await Promise.all(variants.map((variant) => fleetThumbnailBlob(variant)));
    const oversized = blobs.findIndex((blob) => blob.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png"].includes(blob.type));
    if (oversized >= 0) throw new Error(`Thumbnail ${variants[oversized]} vượt 2 MB hoặc sai định dạng JPEG/PNG.`);
    variants.forEach((variant, index) => fleetThumbnailVariants.set(`${fleetState.activeFileFingerprint}:${variant}`, blobs[index]));
    const draft = fleetDraft();
    if (draft) draft.thumbnailReady = true;
    saveFleetState();
    return blobs;
  }

  async function captureFleetFrame() {
    const preview = root?.querySelector("[data-ycg-fleet-preview]");
    const source = preview || thumbnailVideo;
    if (!source || !Number.isFinite(Number(source.duration))) throw new Error("Hãy chọn video và chờ video tải xong.");
    thumbnailImage = source;
    invalidateFleetThumbnails();
    drawFleetThumbnail();
    return status(`Đã lấy frame tại ${Number(source.currentTime || 0).toFixed(1)} giây.`, "success");
  }

  async function retryFleetChannel(taskKey) {
    const result = fleetState.results.find((item) => (item.taskKey || item.channelId) === taskKey);
    if (!result?.uploadId) throw new Error("Kênh này không còn phiên upload để tiếp tục.");
    const resumed = await api("upload/resume", "POST", { uploadId: result.uploadId });
    pausedTaskKeys.delete(taskKey);
    const channelId = result.channelId;
    const channel = (fleetOverview?.channels || channelStatus.channels || []).find((item) => item.id === channelId);
    if (resumed.complete && resumed.videoId) {
      const completed = await api("upload/complete", "POST", { uploadId: result.uploadId, videoId: resumed.videoId, playlistId: channelPreset(channelId).playlistId || "" });
      updateFleetResult(channelId, { taskKey, status: completed.processingStatus === "succeeded" ? "uploaded" : "processing", progress: 100, videoId: completed.videoId, url: completed.url, error: "" });
      render();
      return status(`YouTube đã xác nhận video hoàn tất cho ${channel?.title || channelId}.`, "success");
    }
    const file = fleetFileByFingerprint(result.fingerprint);
    if (!file) throw new Error("Hãy chọn lại đúng file video để tiếp tục từ byte YouTube đã xác nhận.");
    await uploadFleetSession({ ...resumed, channelId, channelTitle: channel?.title || result.channelTitle, taskKey, fingerprint: result.fingerprint, fileName: file.name }, file);
    return status(`Đã tiếp tục upload cho ${channel?.title || channelId}.`, "success");
  }

  async function pauseFleetTask(taskKey) {
    pausedTaskKeys.add(taskKey);
    activeUploadRequests.get(taskKey)?.abort?.();
    const result = fleetState.results.find((item) => item.taskKey === taskKey);
    if (result) {
      updateFleetResult(result.channelId, { taskKey, status: "paused", speedBps: 0, etaSeconds: 0, error: "" });
      if (result.uploadId) await api("upload/pause", "POST", { uploadId: result.uploadId }).catch(() => {});
    }
    render();
  }

  async function cancelFleetTask(taskKey) {
    const result = fleetState.results.find((item) => item.taskKey === taskKey);
    if (!result?.uploadId) throw new Error("Tác vụ chưa có phiên upload để hủy.");
    pausedTaskKeys.delete(taskKey);
    activeUploadRequests.get(taskKey)?.abort?.();
    await api("upload/cancel", "POST", { uploadId: result.uploadId });
    updateFleetResult(result.channelId, { taskKey, status: "cancelled", speedBps: 0, etaSeconds: 0, error: "" });
    render();
  }

  async function resumeAllPausedTasks() {
    queuePaused = false;
    const paused = fleetState.results.filter((item) => item.status === "paused" && item.uploadId && item.taskKey);
    await runConcurrent(paused, Math.min(3, Math.max(1, fleetState.concurrency)), async (item) => {
      try { await retryFleetChannel(item.taskKey); }
      catch (error) { updateFleetResult(item.channelId, { taskKey: item.taskKey, status: "failed", error: error.message }); }
    });
    render();
  }

  function mergeFleetJobResults(jobs) {
    (jobs || []).forEach((job) => (job.results || []).forEach((item) => {
      const existing = fleetState.results.find((result) => item.taskKey && result.taskKey === item.taskKey)
        || fleetState.results.find((result) => result.uploadId && result.uploadId === item.uploadId)
        || fleetState.results.find((result) => result.channelId === item.channelId && !result.uploadId);
      if (!existing && !item.uploadId) return;
      if (existing?.uploadId && item.uploadId && existing.uploadId !== item.uploadId) return;
      updateFleetResult(item.channelId, {
        taskKey: item.taskKey || existing?.taskKey || item.channelId,
        uploadId: item.uploadId || existing?.uploadId,
        status: item.status === "error" ? "failed" : item.status,
        videoId: item.videoId || existing?.videoId,
        fingerprint: item.videoFingerprint || existing?.fingerprint || "",
        fileName: item.fileName || existing?.fileName || "",
        checksum: item.checksum || existing?.checksum || "",
        metadataVersion: item.metadataVersion || existing?.metadataVersion || "",
        error: item.error || ""
      });
    }));
  }

  async function approveFleetPublish(taskKey) {
    const result = fleetState.results.find((item) => (item.taskKey || item.channelId) === taskKey);
    if (!result?.uploadId || !result?.videoId) throw new Error("Kênh này chưa có video đã xử lý để duyệt.");
    const channelId = result.channelId;
    const preset = channelPreset(channelId);
    const target = preset.privacyStatus === "schedule" ? `lên lịch ${dateTime(preset.publishAt)}` : preset.privacyStatus === "unlisted" ? "chuyển Unlisted" : "giữ Private";
    if (!confirm(`Duyệt video ${result.videoId} và ${target} trên đúng kênh này?`)) return;
    const approved = await api("bulk/publish/approve", "POST", { uploadId: result.uploadId, approved: true });
    updateFleetResult(channelId, { taskKey, status: approved.status || "approved", error: "" });
    render();
    return status(`YouTube đã xác nhận: ${target}.`, "success");
  }

  async function runFleetPreflight() {
    if (!fleetState.selectedChannelIds.length) throw new Error("Hãy chọn ít nhất một kênh.");
    busy = "bulk/preflight";
    errorMessage = "";
    render();
    try {
      const server = await api("bulk/preflight", "POST", { action: "upload", channelIds: fleetState.selectedChannelIds, tasks: selectedMatrixTasks().map((task) => { const delivery = taskDelivery(task.fingerprint, task.channelId); return { channelId: task.channelId, videoFingerprint: task.fingerprint, aiDisclosure: delivery.aiDisclosure, desiredPrivacyStatus: delivery.privacyStatus }; }) });
      const channels = (fleetOverview?.channels || channelStatus.channels || []).filter((channel) => fleetState.selectedChannelIds.includes(channel.id));
      const localRows = channels.map((channel) => {
        const local = channelPublishReadiness(channel);
        return { channelId: channel.id, ready: local.ready, reasons: local.checks.filter(([, pass]) => !pass).map(([name]) => `local-${name}`) };
      });
      const rows = (server.channels || []).map((row) => {
        const local = localRows.find((item) => item.channelId === row.channel?.id) || { ready: false, reasons: ["local-channel-missing"] };
        return { ...row, localReady: local.ready, ready: Boolean(row.ready && local.ready), reasons: [...(row.reasons || []), ...local.reasons] };
      });
      fleetPreflight = {
        ...server,
        estimatedQuota: Number(server.estimatedQuota || 0) * Math.max(1, fleetUploadFiles.length),
        channels: rows,
        ready: rows.length > 0 && rows.every((row) => row.ready),
        eligibleChannelIds: rows.filter((row) => row.ready).map((row) => row.channel.id)
      };
      const readyCount = fleetPreflight.eligibleChannelIds.length;
      status(readyCount === rows.length
        ? "Tất cả kênh đã sẵn sàng cho upload."
        : `${readyCount}/${rows.length} kênh sẵn sàng; kênh lỗi sẽ bị bỏ qua.`, readyCount ? "success" : "error");
      return fleetPreflight;
    } finally {
      busy = "";
      render();
    }
  }

  async function legacyStartFleetUpload(form) {
    if (!fleetUploadFile) throw new Error("Hãy chọn file video.");
    const data = Object.fromEntries(new FormData(form));
    const fingerprint = `${fleetUploadFile.name}:${fleetUploadFile.size}:${fleetUploadFile.lastModified || 0}`;
    fleetState = {
      ...fleetState,
      title: String(data.title || "").trim(),
      description: String(data.description || ""),
      tags: String(data.tags || ""),
      privacyStatus: ["private", "unlisted"].includes(data.privacyStatus) ? data.privacyStatus : "private",
      rightsConfirmed: data.rightsConfirmed === "on",
      aiDisclosure: normalizeAiDisclosure(data.aiDisclosure),
      containsSyntheticMedia: normalizeAiDisclosure(data.aiDisclosure) === "yes",
      madeForKids: data.madeForKids === "on",
      uploadPrivateFirst: data.uploadPrivateFirst === "on",
      concurrency: Math.min(3, Math.max(1, Number(data.concurrency || fleetState.concurrency || 2))),
      fileFingerprint: fingerprint,
      idempotencyKey: fleetState.idempotencyKey || uid("bulk-upload") + uid("job")
    };
    saveFleetState();
    if (!fleetState.rightsConfirmed) throw new Error("Cần xác nhận quyền sử dụng nội dung.");
    const preflight = await runFleetPreflight();
    const completedIds = new Set(fleetState.results.filter((item) => item.videoId && ["processing", "uploaded", "completed"].includes(item.status)).map((item) => item.channelId));
    const eligibleChannelIds = (preflight.eligibleChannelIds || []).filter((channelId) => !completedIds.has(channelId));
    if (!eligibleChannelIds.length) throw new Error(completedIds.size ? "Các kênh hợp lệ đã upload xong; không tạo bản trùng." : "Chưa có kênh nào vượt qua preflight.");
    const channels = (fleetOverview?.channels || channelStatus.channels || []).filter((channel) => eligibleChannelIds.includes(channel.id));
    const channelPayloads = channels.map((channel) => {
      const preset = channelPreset(channel.id);
      return {
        channelId: channel.id,
        title: effectiveChannelTitle(channel.id),
        description: `${fleetState.description}${preset.descriptionTemplate ? `\n\n${preset.descriptionTemplate}` : ""}`.trim(),
        tags: [...new Set(`${fleetState.tags},${preset.tags}`.split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 30),
        categoryId: preset.categoryId,
        defaultLanguage: preset.defaultLanguage,
        playlistId: preset.playlistId,
        desiredPublishAt: preset.privacyStatus === "schedule" && preset.publishAt ? new Date(preset.publishAt).toISOString() : "",
        desiredPrivacyStatus: preset.privacyStatus === "unlisted" ? "unlisted" : preset.privacyStatus === "schedule" ? "schedule" : "private",
        privacyStatus: fleetState.uploadPrivateFirst ? "private" : preset.privacyStatus === "unlisted" ? "unlisted" : "private",
        aiDisclosure: fleetState.aiDisclosure
      };
    });
    if (!confirm(`Upload thật tới ${eligibleChannelIds.length} kênh? ${fleetState.uploadPrivateFirst ? "Tất cả sẽ ở chế độ PRIVATE trước." : "Quyền riêng tư lấy theo preset."}`)) return;
    busy = "bulk/upload/sessions";
    render();
    try {
      const result = await api("bulk/upload/sessions", "POST", {
        channelIds: eligibleChannelIds,
        channels: channelPayloads,
        idempotencyKey: fleetState.idempotencyKey,
        approved: true,
        rightsConfirmed: true,
        title: fleetState.title || channelPayloads[0]?.title,
        description: fleetState.description,
        tags: fleetState.tags.split(",").map((item) => item.trim()).filter(Boolean),
        privacyStatus: fleetState.uploadPrivateFirst ? "private" : fleetState.privacyStatus,
        fileName: fleetUploadFile.name,
        fileSize: fleetUploadFile.size,
        mimeType: fleetUploadFile.type || "application/octet-stream",
        madeForKids: fleetState.madeForKids,
        aiDisclosure: fleetState.aiDisclosure,
        notifySubscribers: false
      });
      (result.failures || []).forEach((item) => updateFleetResult(item.channelId, { channelTitle: item.channelTitle, status: "failed", error: item.error }));
      const connectionDownlink = Number(navigator.connection?.downlink || 0);
      const concurrency = connectionDownlink > 0 && connectionDownlink < 3 ? 1 : fleetState.concurrency;
      await runConcurrent(result.sessions || [], concurrency, async (session) => {
        try { await uploadFleetSession(session, fleetUploadFile); }
        catch (error) {
          updateFleetResult(session.channelId, { channelTitle: session.channelTitle, status: "failed", error: error.message });
          await api("upload/error", "POST", { uploadId: session.uploadId, error: error.message }).catch(() => {});
          render();
        }
      });
      saveFleetState();
      const jobsResult = await api("bulk/jobs").catch(() => ({ jobs: [] }));
      fleetJobs = jobsResult.jobs || [];
      render();
      status("Hàng đợi đã gửi xong; YouTube đang xử lý HD cho từng video thật.", "success");
    } finally {
      busy = "";
      render();
    }
  }

  async function uploadQueuedFleetFile(file, draft, eligibleChannelIds, batchMeta = {}) {
    const fingerprint = fleetFileFingerprint(file);
    const completedTaskKeys = new Set(fleetState.results.filter((item) => item.videoId && ["processing", "uploaded", "scheduled", "private", "unlisted", "completed"].includes(item.status)).map((item) => item.taskKey));
    const remainingChannelIds = eligibleChannelIds.filter((channelId) => !completedTaskKeys.has(`${fingerprint}::${channelId}`));
    if (!remainingChannelIds.length) return { skipped: true };
    const channels = (fleetOverview?.channels || channelStatus.channels || []).filter((channel) => remainingChannelIds.includes(channel.id));
    const channelPayloads = channels.map((channel) => {
      const preset = channelPreset(channel.id);
      const delivery = taskDelivery(fingerprint, channel.id);
      return {
        channelId: channel.id,
        title: effectiveChannelTitle(channel.id, draft),
        description: `${draft.description}${preset.descriptionTemplate ? `\n\n${preset.descriptionTemplate}` : ""}`.trim(),
        tags: [...new Set(`${draft.tags},${preset.tags}`.split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 30),
        categoryId: preset.categoryId,
        defaultLanguage: preset.defaultLanguage,
        playlistId: preset.playlistId,
        desiredPublishAt: delivery.privacyStatus === "schedule" && delivery.publishAt ? new Date(delivery.publishAt).toISOString() : "",
        desiredPrivacyStatus: delivery.privacyStatus,
        privacyStatus: fleetState.uploadPrivateFirst ? "private" : delivery.privacyStatus === "unlisted" ? "unlisted" : "private",
        taskKey: matrixTaskKey(fingerprint, channel.id),
        videoFingerprint: fingerprint,
        metadataVersion: metadataVersionFor(draft, channel.id, delivery),
        checksum: draft.checksum || "",
        aiDisclosure: delivery.aiDisclosure,
        madeForKids: preset.madeForKids,
        license: preset.license,
        embeddable: preset.embeddable,
        notifySubscribers: preset.notifySubscribers
      };
    });
    const idempotencyBase = draft.idempotencyKey || `${uid("bulk-video")}-${Math.random().toString(36).slice(2, 10)}`;
    draft.idempotencyKey = idempotencyBase;
    remainingChannelIds.forEach((channelId) => {
      const channel = channels.find((item) => item.id === channelId);
      updateFleetResult(channelId, { taskKey: `${fingerprint}::${channelId}`, fingerprint, checksum: draft.checksum || "", fileName: file.name, channelTitle: channel?.title || channelId, status: "queued", progress: 0, batchIndex: batchMeta.batchIndex || 1, batchTotal: batchMeta.batchTotal || 1, error: "" });
    });
    const connectionDownlink = Number(navigator.connection?.downlink || 0);
    const concurrency = connectionDownlink > 0 && connectionDownlink < 3 ? 1 : fleetState.concurrency;
    const chunkSize = Number(fleetOverview?.limits?.maxChannelsPerBulkJob || channelStatus.bulk?.maxChannelsPerJob || 20);
    const results = [];
    let hasSessionFailure = false;
    const remainingSet = new Set(remainingChannelIds);
    for (let offset = 0; offset < eligibleChannelIds.length; offset += chunkSize) {
      const chunkIndex = Math.floor(offset / chunkSize);
      const chunkChannelIds = eligibleChannelIds.slice(offset, offset + chunkSize).filter((channelId) => remainingSet.has(channelId));
      if (!chunkChannelIds.length) continue;
      const result = await api("bulk/upload/sessions", "POST", {
        channelIds: chunkChannelIds,
        channels: channelPayloads.filter((item) => chunkChannelIds.includes(item.channelId)),
        idempotencyKey: `${idempotencyBase.slice(0, 140)}-b${batchMeta.batchIndex || 1}-c${chunkIndex}`,
        approved: true,
        rightsConfirmed: true,
        title: draft.title,
        description: draft.description,
        tags: draft.tags.split(",").map((item) => item.trim()).filter(Boolean),
        privacyStatus: fleetState.uploadPrivateFirst ? "private" : fleetState.privacyStatus,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        madeForKids: fleetState.madeForKids,
        aiDisclosure: normalizeAiDisclosure(channelPayloads.find((item) => chunkChannelIds.includes(item.channelId))?.aiDisclosure, draft.aiDisclosure),
        videoFingerprint: fingerprint,
        metadataVersion: metadataVersionFor(draft, chunkChannelIds[0], taskDelivery(fingerprint, chunkChannelIds[0])),
        checksum: draft.checksum || "",
        queueVideoCount: fleetUploadFiles.length,
        notifySubscribers: false
      });
      results.push(result);
      if ((result.failures || []).length) hasSessionFailure = true;
      (result.failures || []).forEach((item) => updateFleetResult(item.channelId, { taskKey: `${fingerprint}::${item.channelId}`, fingerprint, fileName: file.name, channelTitle: item.channelTitle, status: "failed", error: item.error }));
      (result.reused || []).forEach((item) => updateFleetResult(item.channelId, { taskKey: `${fingerprint}::${item.channelId}`, fingerprint, fileName: file.name, channelTitle: item.channelTitle, uploadId: item.uploadId, videoId: item.videoId, status: item.status || "uploaded", progress: 100, error: "" }));
      await runConcurrent(result.sessions || [], concurrency, async (session) => {
        const taskKey = `${fingerprint}::${session.channelId}`;
        try { await uploadFleetSession({ ...session, taskKey, fingerprint, fileName: file.name }, file); }
        catch (error) {
          const paused = error.paused || pausedTaskKeys.has(taskKey) || queuePaused;
          updateFleetResult(session.channelId, { taskKey, fingerprint, fileName: file.name, channelTitle: session.channelTitle, uploadId: session.uploadId, status: paused ? "paused" : "failed", error: paused ? "" : error.message });
          if (!paused) await api("upload/error", "POST", { uploadId: session.uploadId, error: error.message }).catch(() => {});
          render();
        }
      });
    }
    if (hasSessionFailure && draft.idempotencyKey === idempotencyBase) draft.idempotencyKey = "";
    return results;
  }

  async function startFleetUpload(form) {
    if (!fleetUploadFiles.length) throw new Error("Hãy kéo ít nhất một video vào hàng đợi.");
    if (!fleetState.selectedChannelIds.length) throw new Error("Hãy chọn ít nhất một kênh đích.");
    const data = Object.fromEntries(new FormData(form));
    fleetState.rightsConfirmed = data.rightsConfirmed === "on";
    fleetState.aiDisclosure = normalizeAiDisclosure(data.aiDisclosure, fleetState.aiDisclosure);
    fleetState.containsSyntheticMedia = fleetState.aiDisclosure === "yes";
    fleetState.madeForKids = data.madeForKids === "on";
    fleetState.uploadPrivateFirst = data.uploadPrivateFirst === "on";
    fleetState.concurrency = Math.min(3, Math.max(1, Number(data.concurrency || fleetState.concurrency || 2)));
    if (!fleetState.rightsConfirmed) throw new Error("Cần xác nhận quyền sử dụng toàn bộ nội dung trong batch.");
    const maxTasks = Number(fleetOverview?.limits?.maxTasksPerBatch || fleetObservatory?.limits?.maxTasksPerBatch || 100);
    const requestedTasks = selectedMatrixTasks().length;
    if (!requestedTasks) throw new Error("Ma trận chưa bật tác vụ video × kênh nào.");
    const missingTitle = fleetUploadFiles.find((file) => !fleetDraft(fleetFileFingerprint(file), file)?.title?.trim());
    if (missingTitle) throw new Error(`${missingTitle.name} chưa có tiêu đề.`);
    const preflight = await runFleetPreflight();
    const eligibleChannelIds = preflight.eligibleChannelIds || [];
    if (!eligibleChannelIds.length) throw new Error("Không có kênh nào vượt qua kiểm tra quyền và token.");
    const pendingTasks = selectedMatrixTasks(eligibleChannelIds).filter((task) => {
      const existing = fleetState.results.find((item) => item.taskKey === task.taskKey);
      return !(existing?.videoId && ["processing", "uploaded", "scheduled", "private", "unlisted", "published", "completed"].includes(existing.status));
    });
    const actualTasks = pendingTasks.length;
    const taskBatches = Array.from({ length: Math.ceil(actualTasks / maxTasks) }, (_, index) => pendingTasks.slice(index * maxTasks, (index + 1) * maxTasks));
    if (!actualTasks) throw new Error("Mọi tác vụ đã hoàn thành; hệ thống không tạo video trùng.");
    if (!confirm(`Tạo ${actualTasks} tác vụ và tự chia thành ${taskBatches.length} batch? Mỗi kênh nhận tối đa ${fleetUploadFiles.length}/10 video và tất cả upload PRIVATE trước.`)) return;
    const channelMap = new Map((fleetOverview?.channels || channelStatus.channels || []).map((channel) => [channel.id, channel]));
    pendingTasks.forEach((task, index) => {
      const existing = fleetState.results.find((item) => item.taskKey === task.taskKey);
      updateFleetResult(task.channelId, { taskKey: task.taskKey, fingerprint: task.fingerprint, checksum: fleetDraft(task.fingerprint, task.file)?.checksum || "", fileName: task.file.name, channelTitle: channelMap.get(task.channelId)?.title || task.channelId, status: "queued", progress: existing?.progress || 0, batchIndex: Math.floor(index / maxTasks) + 1, batchTotal: taskBatches.length, error: "" });
    });
    busy = "bulk/batch";
    errorMessage = "";
    fleetState.studioTab = "queue";
    saveFleetState();
    render();
    try {
      const runToken = ++queueRunToken;
      for (let batchIndex = 0; batchIndex < taskBatches.length; batchIndex += 1) {
        if (runToken !== queueRunToken) break;
        const batch = taskBatches[batchIndex];
        const byFingerprint = new Map();
        batch.forEach((task) => {
          if (!byFingerprint.has(task.fingerprint)) byFingerprint.set(task.fingerprint, []);
          byFingerprint.get(task.fingerprint).push(task.channelId);
        });
        for (const [fingerprint, channelIds] of byFingerprint) {
          if (runToken !== queueRunToken) break;
          while (queuePaused) await wait(250);
          const file = fleetFileByFingerprint(fingerprint);
          if (!file) continue;
          await uploadQueuedFleetFile(file, fleetDraft(fingerprint, file), channelIds, { batchIndex: batchIndex + 1, batchTotal: taskBatches.length });
        }
      }
      const [jobsResult, observatoryResult] = await Promise.all([api("bulk/jobs").catch(() => ({ jobs: [] })), api("channels/observatory").catch(() => null)]);
      fleetJobs = jobsResult.jobs || [];
      fleetObservatory = observatoryResult;
      mergeFleetJobResults(fleetJobs);
      saveFleetState();
      render();
      status("Batch đã gửi xong. Theo dõi từng video và từng kênh trong Hàng đợi tác vụ.", "success");
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

  function clearRemovedChannelState(channelIds) {
    const removed = new Set(channelIds.map(String));
    fleetState.selectedChannelIds = fleetState.selectedChannelIds.filter((id) => !removed.has(id));
    fleetState.selectedContentIds = fleetState.selectedContentIds.filter((key) => ![...removed].some((id) => key.startsWith(`${id}::`)));
    if (removed.has(fleetState.settingsChannel)) fleetState.settingsChannel = "";
    if (removed.has(fleetState.contentChannel)) fleetState.contentChannel = "all";
    if (removed.has(fleetState.calendarChannelFilter)) fleetState.calendarChannelFilter = "all";
    removed.forEach((channelId) => {
      delete fleetState.channelPresets[channelId];
      Object.keys(fleetState.taskMatrix).filter((key) => key.endsWith(`::${channelId}`)).forEach((key) => delete fleetState.taskMatrix[key]);
      Object.keys(fleetState.scheduleDrafts).filter((key) => key.startsWith(`${channelId}::`)).forEach((key) => delete fleetState.scheduleDrafts[key]);
    });
    invalidateFleetPublish();
    saveFleetState();
  }

  async function removeChannels(channelIds) {
    const channels = (fleetOverview?.channels || channelStatus.channels || []).filter(Boolean);
    const targets = [...new Set(channelIds.map(String))].map((id) => channels.find((channel) => channel.id === id)).filter(Boolean);
    if (!targets.length) throw new Error("Hãy chọn ít nhất một kênh cần xóa khỏi HH Studio.");
    const names = targets.slice(0, 4).map((channel) => channel.title).join(", ");
    const more = targets.length > 4 ? ` và ${targets.length - 4} kênh khác` : "";
    if (!confirm(`Xóa ${targets.length} kết nối kênh khỏi HH Studio?\n\n${names}${more}\n\nToken của các kết nối này sẽ bị thu hồi. Kênh và video trên YouTube không bị xóa.`)) return;
    busy = "channels/remove";
    errorMessage = "";
    render();
    const removed = [];
    const failed = [];
    for (const channel of targets) {
      try {
        await api("channel/select", "POST", { channelId: channel.id });
        await api("disconnect", "POST", { channelId: channel.id, approved: true });
        removed.push(channel.id);
      } catch (error) {
        failed.push(`${channel.title}: ${error.message}`);
      }
    }
    clearRemovedChannelState(removed);
    busy = "";
    await refresh(true, true);
    if (failed.length) {
      errorMessage = `Đã xóa ${removed.length}/${targets.length} kết nối. ${failed.join(" · ")}`;
      render();
      return;
    }
    status(`Đã xóa ${removed.length} kết nối khỏi HH Studio. Kênh và video trên YouTube vẫn nguyên vẹn.`, "success");
  }

  async function loadChannelSettings(channelId = fleetState.settingsChannel) {
    const channels = connectedChannels();
    const id = channels.some((channel) => channel.id === channelId) ? channelId : channels[0]?.id;
    if (!id) return;
    fleetState.settingsChannel = id;
    const result = await api("channel/settings", "POST", { operation: "read", channelId: id });
    channelSettings = { channelId: id, profile: result.profile || {} };
    saveFleetState();
  }

  function hydrateFleetStudioTab(tab) {
    if (channelStatus.connected && ((tab === "content" && fleetState.contentMode === "manager") || tab === "calendar")) {
      loadContentLibrary().then(() => {
        if (state.active !== "fleet" || fleetState.studioTab !== tab) return;
        render();
      }).catch(() => {});
    }
    if (channelStatus.connected && tab === "comments") {
      api("comments/drafts").then((result) => {
        if (state.active !== "fleet" || fleetState.studioTab !== "comments") return;
        commentDrafts = result.drafts || [];
        render();
      }).catch(() => {});
    }
    if (channelStatus.connected && channelStatus.permissions?.analytics && tab === "analytics" && !comparisonData) {
      api("analytics/comparison").then((result) => {
        if (state.active !== "fleet" || fleetState.studioTab !== "analytics") return;
        comparisonData = result.comparison || null;
        render();
      }).catch(() => {});
    }
    if (channelStatus.connected && tab === "settings") {
      loadChannelSettings().then(() => {
        if (state.active !== "fleet" || fleetState.studioTab !== "settings") return;
        render();
      }).catch((error) => { errorMessage = error.message; render(); });
    }
  }

  function switchModule(moduleId) {
    if (!MODULES.some((item) => item.id === moduleId)) return;
    if (publisherMounted) window.HHYouTubePublisher?.unmount?.();
    const studioTab = STUDIO_MODULE_TABS[moduleId];
    if (studioTab) {
      state.active = "fleet";
      fleetState.studioTab = studioTab;
      saveState();
      saveFleetState();
      render();
      hydrateFleetStudioTab(studioTab);
      return;
    }
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
    if (channelStatus.connected && channelStatus.permissions?.analytics && moduleId === "analytics" && !comparisonData) {
      api("analytics/comparison").then((result) => {
        if (state.active !== "analytics") return;
        comparisonData = result.comparison || null;
        render();
      }).catch(() => {});
    }
    if (channelStatus.connected && moduleId === "fleet" && !fleetOverview) {
      Promise.all([api("channels/overview"), api("bulk/jobs").catch(() => ({ jobs: [] })), api("channels/observatory").catch(() => null)]).then(([overview, jobs, observatory]) => {
        if (state.active !== "fleet") return;
        fleetOverview = overview;
        fleetJobs = jobs.jobs || [];
        fleetObservatory = observatory;
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
    if (action === "batch-open-galaxy") { location.hash = "#/davinci-resolve/youtube"; return; }
    if (action === "batch-ai-metadata") return generateBatchMetadata();
    if (action === "batch-apply-schedule") return applyBatchSchedule();
    if (action === "batch-restore-manifest") { const manifest = await readBatchManifest().catch(() => null); if (!manifest?.files?.length) throw new Error("Chưa có manifest đã lưu cho tài khoản này."); batchFolderName = manifest.folderName || "Thư mục đã lưu"; batchSchedule = { ...batchSchedule, ...(manifest.schedule || {}) }; fleetState.selectedChannelIds = Array.isArray(manifest.selectedChannelIds) ? manifest.selectedChannelIds : fleetState.selectedChannelIds; saveFleetState(); render(); return status(`Manifest có ${manifest.files.length} video. Hãy chọn lại thư mục “${batchFolderName}” để trình duyệt cấp lại quyền file.`, "success"); }
    if (action === "video-undo") {
      if (!contentDrawer?.originalDraft) return;
      contentDrawer.draft = { ...contentDrawer.originalDraft };
      contentDrawer.dirty = false;
      render();
      return status("Đã hoàn tác các thay đổi chưa lưu.", "success");
    }
    if (action === "video-save-private") {
      const form = root?.querySelector("[data-ycg-video-detail-form]");
      if (!form) throw new Error("Không tìm thấy form chi tiết video.");
      const privacy = form.elements.privacyStatus;
      const publishAt = form.elements.publishAt;
      if (privacy) privacy.value = "private";
      if (publishAt) publishAt.value = "";
      syncVideoDraftFromDom(form);
      form.requestSubmit();
      return;
    }
    if (action === "video-remove-duplicates") {
      const form = root?.querySelector("[data-ycg-video-detail-form]");
      const textarea = form?.elements?.description;
      if (!textarea) return;
      const seen = new Set();
      textarea.value = String(textarea.value || "").split(/\r?\n/).filter((line) => {
        const key = line.trim().toLocaleLowerCase("vi");
        if (!key || key.length < 12) return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).join("\n");
      syncVideoDraftFromDom(form);
      render();
      return status("Đã xóa các dòng mô tả bị lặp. Hãy kiểm tra rồi bấm Lưu.", "success");
    }
    if (action === "video-load-analytics") {
      if (!contentDrawer?.item?.videoId) throw new Error("Video chưa có Video ID.");
      contentDrawer.sectionLoading = true;
      contentDrawer.analyticsError = "";
      render();
      try {
        const result = await api("video/analytics", "POST", { channelId: contentDrawer.item.channelId, videoId: contentDrawer.item.videoId });
        contentDrawer.analytics = result.analytics || result;
      } catch (error) { contentDrawer.analyticsError = error.message; }
      contentDrawer.sectionLoading = false;
      render();
      return;
    }
    if (action === "video-load-comments") {
      if (!contentDrawer?.item?.videoId) throw new Error("Video chưa có Video ID.");
      contentDrawer.sectionLoading = true;
      contentDrawer.commentsError = "";
      render();
      try {
        const result = await api("video/comments", "POST", { channelId: contentDrawer.item.channelId, videoId: contentDrawer.item.videoId });
        contentDrawer.comments = result.comments || [];
      } catch (error) { contentDrawer.commentsError = error.message; }
      contentDrawer.sectionLoading = false;
      render();
      return;
    }
    if (action === "video-refresh-details") {
      if (!contentDrawer?.item?.videoId) throw new Error("Video chưa có Video ID.");
      const result = await api("video/details", "POST", { channelId: contentDrawer.item.channelId, videoId: contentDrawer.item.videoId });
      contentDrawer.item = { ...contentDrawer.item, ...(result.video || {}) };
      contentDrawer.audit = result.audit || contentDrawer.audit || [];
      contentDrawer.captions = result.captions || contentDrawer.captions || [];
      render();
      return status("Đã làm mới processing và checks từ YouTube.", "success");
    }
    if (action === "video-open-thumbnail") return status("Dùng nút Tải thumbnail để gửi ảnh ngay, hoặc quay lại Batch Upload để mở Thumbnail Fast Lane A/B/C.", "info");
    if (action === "video-frame-help") return status("Để lấy frame chính xác, mở Thumbnail Fast Lane từ Batch Upload khi file video nguồn vẫn còn trên thiết bị.", "info");
    if (action === "open-upload") return switchModule("upload");
    if (action === "open-command") return switchModule("command");
    if (action === "open-fleet") return switchModule("fleet");
    if (action === "open-calendar") return switchModule("calendar");
    if (action === "open-live") return switchModule("live");
    if (action === "new-video" || action === "open-editor") return location.hash = "#/davinci-resolve/davinci";
    if (action === "new-short") return switchModule("shorts");
    if (action === "open-auto") return location.hash = "#/davinci-resolve/auto";
    if (action === "sync-project") return syncUniversalProject();
    if (action === "fleet-select-all") {
      const channels = fleetOverview?.channels || channelStatus.channels || [];
      const limit = fleetSelectionCapacity();
      fleetState.selectedChannelIds = channels.slice(0, limit).map((channel) => channel.id);
      invalidateFleetPublish();
      saveFleetState();
      return render();
    }
    if (action === "fleet-select-visible") {
      const channels = fleetOverview?.channels || channelStatus.channels || [];
      const limit = fleetSelectionCapacity();
      fleetState.selectedChannelIds = filteredFleetChannels(channels).slice(0, limit).map((channel) => channel.id);
      invalidateFleetPublish();
      saveFleetState();
      return render();
    }
    if (action === "fleet-remove-selected") return removeChannels(fleetState.selectedChannelIds);
    if (["upload-select-visible-channels", "upload-select-ready-channels", "upload-clear-channels"].includes(action)) {
      const channels = fleetOverview?.channels || channelStatus.channels || [];
      const limit = fleetSelectionCapacity();
      const next = action === "upload-clear-channels"
        ? []
        : action === "upload-select-ready-channels"
          ? channels.filter((channel) => channel.permissions?.upload && channel.token?.healthy).slice(0, limit)
          : filteredUploadChannels(channels).slice(0, limit);
      fleetState.selectedChannelIds = next.map((channel) => channel.id);
      invalidateFleetPublish();
      saveFleetState();
      render();
      return status(action === "upload-clear-channels" ? "Đã bỏ chọn toàn bộ kênh đích." : `Đã chọn ${next.length} kênh để đăng video.`, "success");
    }
    if (action === "matrix-enable-all" || action === "matrix-disable-all") {
      const enabled = action === "matrix-enable-all";
      fleetUploadFiles.forEach((file) => fleetState.selectedChannelIds.forEach((channelId) => {
        const cell = matrixTask(fleetFileFingerprint(file), channelId, true);
        cell.enabled = enabled;
      }));
      invalidateFleetPublish();
      saveFleetState();
      render();
      return status(enabled ? "Đã bật toàn bộ tác vụ trong ma trận." : "Đã tắt toàn bộ tác vụ trong ma trận.", "success");
    }
    if (action === "matrix-copy-first-channel") {
      const [sourceId, ...targetIds] = fleetState.selectedChannelIds;
      if (!sourceId || !targetIds.length) throw new Error("Chọn ít nhất hai kênh để copy lịch và metadata.");
      const sourcePreset = { ...channelPreset(sourceId) };
      targetIds.forEach((channelId) => {
        fleetState.channelPresets[channelId] = { ...channelPreset(channelId), ...sourcePreset, locked: false };
        fleetUploadFiles.forEach((file) => {
          const fingerprint = fleetFileFingerprint(file);
          const sourceCell = matrixTask(fingerprint, sourceId);
          fleetState.taskMatrix[matrixTaskKey(fingerprint, channelId)] = { ...sourceCell };
        });
      });
      invalidateFleetPublish();
      saveFleetState();
      render();
      return status(`Đã copy thiết lập kênh đầu sang ${targetIds.length} kênh.`, "success");
    }
    if (action === "matrix-apply-ai") {
      const disclosure = normalizeAiDisclosure(root?.querySelector("[data-ycg-matrix-ai-bulk]")?.value);
      let changed = 0;
      fleetUploadFiles.forEach((file) => fleetState.selectedChannelIds.forEach((channelId) => {
        const cell = matrixTask(fleetFileFingerprint(file), channelId, true);
        if (cell.enabled === false) return;
        cell.aiDisclosure = disclosure;
        changed += 1;
      }));
      invalidateFleetPublish();
      saveFleetState();
      render();
      return status(`Đã áp dụng “${aiDisclosureLabel(disclosure)}” cho ${changed} tác vụ đang bật.`, "success");
    }
    if (action === "content-refresh") {
      await api("content/processing/refresh", "POST", { channelId: fleetState.contentChannel === "all" ? "" : fleetState.contentChannel });
      await loadContentLibrary();
      render();
      return status(`Đã đồng bộ ${contentLibrary.length} video và upload record thật.`, "success");
    }
    if (action === "content-copy-metadata") return copySelectedContentMetadata();
    if (action === "content-open-ai-disclosure") {
      const selected = new Set(fleetState.selectedContentIds);
      if (!mergedContentItems().some((item) => item.videoId && selected.has(item.uploadId || `${item.channelId}::${item.videoId}`))) throw new Error("Chọn ít nhất một video đã có Video ID trước khi khai báo sử dụng AI.");
      aiBulkDialog = true;
      render();
      return;
    }
    if (action === "content-open-calendar") {
      fleetState.studioTab = "calendar";
      fleetState.calendarMode = "unscheduled";
      saveFleetState();
      render();
      return;
    }
    if (action === "calendar-distribute") {
      const startInput = root?.querySelector("[data-ycg-calendar-start]")?.value;
      const start = startInput ? new Date(startInput) : new Date(Date.now() + 60 * 60 * 1000);
      const spacing = Math.max(30, Number(root?.querySelector("[data-ycg-calendar-spacing]")?.value || 60));
      if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now() + 60_000) throw new Error("Thời gian bắt đầu phải ở tương lai.");
      const selected = new Set(fleetState.selectedContentIds);
      const items = mergedContentItems().filter((item) => item.videoId && selected.has(item.uploadId || `${item.channelId}::${item.videoId}`));
      if (!items.length) throw new Error("Chọn ít nhất một video có Video ID.");
      fleetState.scheduleHistory.push(JSON.parse(JSON.stringify(fleetState.scheduleDrafts)));
      fleetState.scheduleHistory = fleetState.scheduleHistory.slice(-20);
      items.forEach((item, index) => {
        const key = calendarScheduleKey(item.channelId, item.videoId);
        const publishAt = new Date(start.getTime() + index * spacing * 60_000).toISOString();
        fleetState.scheduleDrafts[key] = { channelId: item.channelId, videoId: item.videoId, publishAt, previousPublishAt: item.scheduledAt || item.publishAt || "" };
      });
      saveFleetState();
      render();
      return status(`Đã giãn lịch ${items.length} video, cách nhau ${spacing} phút. Chưa gửi YouTube.`, "success");
    }
    if (action === "calendar-undo") {
      const previous = fleetState.scheduleHistory.pop();
      if (previous) fleetState.scheduleDrafts = previous;
      saveFleetState();
      render();
      return status("Đã hoàn tác thay đổi lịch gần nhất.", "success");
    }
    if (action === "calendar-confirm") {
      const items = Object.values(fleetState.scheduleDrafts);
      if (!items.length) throw new Error("Không có thay đổi lịch cần xác nhận.");
      const conflicts = scheduleConflicts(calendarContentItems());
      if (conflicts.size) throw new Error("Hãy xử lý các khung giờ trùng trước khi xác nhận.");
      if (!confirm(`Gửi ${items.length} thay đổi lịch thật tới YouTube? Video phải đang Private và chưa từng xuất bản.`)) return;
      const results = [];
      for (let offset = 0; offset < items.length; offset += 20) {
        const result = await api("content/schedule/bulk", "POST", { approved: true, timezone: fleetState.calendarTimezone, items: items.slice(offset, offset + 20) });
        results.push(...(result.results || []));
      }
      const failedKeys = new Set(results.filter((item) => !item.ok).map((item) => calendarScheduleKey(item.channelId, item.videoId)));
      Object.keys(fleetState.scheduleDrafts).forEach((key) => { if (!failedKeys.has(key)) delete fleetState.scheduleDrafts[key]; });
      saveFleetState();
      await loadContentLibrary();
      render();
      return status(`YouTube đã xác nhận ${results.filter((item) => item.ok).length}/${results.length} lịch đăng.`, failedKeys.size ? "error" : "success");
    }
    if (action === "queue-pause-all") {
      queuePaused = true;
      await Promise.all(fleetState.results.filter((item) => item.status === "uploading").map((item) => pauseFleetTask(item.taskKey)));
      render();
      return status("Đã tạm dừng hàng đợi tại byte gần nhất YouTube xác nhận.", "success");
    }
    if (action === "queue-resume-all") return resumeAllPausedTasks();
    if (action === "fleet-clear") {
      fleetState.selectedChannelIds = [];
      fleetState.results = [];
      fleetState.idempotencyKey = "";
      fleetPreflight = null;
      saveFleetState();
      return render();
    }
    if (action === "fleet-preflight") return runFleetPreflight();
    if (action === "fleet-clear-videos") {
      fleetUploadFiles = [];
      contentLibrary = [];
      contentDrawer = null;
      deleteDialog = null;
      aiBulkDialog = false;
      fleetUploadFile = null;
      fleetState.activeFileFingerprint = "";
      fleetState.taskMatrix = {};
      if (thumbnailVideoUrl) URL.revokeObjectURL(thumbnailVideoUrl);
      thumbnailVideoUrl = "";
      thumbnailVideo = null;
      thumbnailImage = null;
      fleetPreflight = null;
      saveFleetState();
      return render();
    }
    if (action === "fleet-capture-frame") return captureFleetFrame();
    if (action === "fleet-apply-brand") {
      const selectedId = fleetState.selectedChannelIds[0];
      const preset = selectedId ? channelPreset(selectedId) : null;
      if (!preset) throw new Error("Hãy chọn ít nhất một kênh để áp dụng Brand Kit.");
      fleetState.thumbnailAccent = preset.brandColor;
      fleetState.thumbnailSubtitle = (fleetOverview?.channels || channelStatus.channels || []).find((item) => item.id === selectedId)?.title || fleetState.thumbnailSubtitle;
      invalidateFleetThumbnails();
      saveFleetState();
      drawFleetThumbnail();
      return status("Đã áp màu và tên của Brand Kit kênh đầu tiên.", "success");
    }
    if (action === "fleet-generate-variants") {
      await generateFleetThumbnailVariants();
      render();
      return status("Đã tạo ba file thumbnail A/B/C, không chứa đường safe zone.", "success");
    }
    if (action === "fleet-copy-thumbnail") {
      fleetState.selectedChannelIds.forEach((channelId) => { channelPreset(channelId).thumbnailVariant = fleetState.thumbnailVariant; });
      saveFleetState();
      render();
      return status(`Đã gán thumbnail ${fleetState.thumbnailVariant} cho ${fleetState.selectedChannelIds.length} kênh.`, "success");
    }
    if (action === "fleet-copy-metadata") {
      const draft = fleetDraft();
      if (draft) fleetState.selectedChannelIds.forEach((channelId) => { delete draft.channelTitles[channelId]; });
      invalidateFleetPublish();
      saveFleetState();
      render();
      return status("Đã copy metadata master sang các kênh không bị khóa.", "success");
    }
    if (action === "fleet-find-replace") {
      if (!fleetState.replaceFind) throw new Error("Nhập nội dung cần tìm trước.");
      let changed = 0;
      fleetState.selectedChannelIds.forEach((channelId) => {
        const preset = channelPreset(channelId);
        if (preset.locked) return;
        const current = effectiveChannelTitle(channelId);
        const next = current.split(fleetState.replaceFind).join(fleetState.replaceWith).slice(0, 100);
        if (next !== current) { preset.titleOverride = next; changed += 1; }
      });
      invalidateFleetPublish();
      saveFleetState();
      render();
      return status(`Đã thay nội dung trên ${changed} kênh.`, "success");
    }
    if (action === "fleet-refresh") {
      const selectedIds = fleetState.selectedChannelIds.slice(0, 100);
      for (let offset = 0; offset < selectedIds.length; offset += 20) {
        await api("channels/refresh-bulk", "POST", { channelIds: selectedIds.slice(offset, offset + 20) });
      }
      const [overview, jobs, observatory] = await Promise.all([api("channels/overview"), api("bulk/jobs"), api("channels/observatory")]);
      fleetOverview = overview;
      fleetJobs = jobs.jobs || [];
      fleetObservatory = observatory;
      mergeFleetJobResults(fleetJobs);
      render();
      return status(selectedIds.length ? `Đã đồng bộ dữ liệu thật của ${selectedIds.length} kênh đã chọn.` : "Đã nạp lại Observatory từ backend.", "success");
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
    const removeChannelButton = event.target.closest("[data-ycg-remove-channel]");
    if (removeChannelButton) {
      try { await removeChannels([removeChannelButton.dataset.ycgRemoveChannel]); }
      catch (error) { errorMessage = error.message; render(); }
      return;
    }
    const fleetTab = event.target.closest("[data-ycg-fleet-tab]");
    if (fleetTab) {
      fleetState.studioTab = fleetTab.dataset.ycgFleetTab;
      saveFleetState();
      render();
      hydrateFleetStudioTab(fleetState.studioTab);
      return;
    }
    const settingsSection = event.target.closest("[data-ycg-settings-section]");
    if (settingsSection) {
      fleetState.settingsSection = settingsSection.dataset.ycgSettingsSection;
      saveFleetState();
      render();
      return;
    }
    const contentMode = event.target.closest("[data-ycg-content-mode]");
    if (contentMode) {
      fleetState.contentMode = contentMode.dataset.ycgContentMode;
      saveFleetState();
      render();
      if (fleetState.contentMode === "manager") {
        try { await loadContentLibrary(); render(); }
        catch (error) { errorMessage = error.message; render(); }
      }
      return;
    }
    if (event.target.closest("[data-ycg-video-back]")) {
      return returnToContentManager();
    }
    const videoSection = event.target.closest("[data-ycg-video-section]");
    if (videoSection && contentDrawer) {
      contentDrawer.activeSection = videoSection.dataset.ycgVideoSection;
      contentDrawer.sectionLoading = false;
      render();
      return;
    }
    const copyVideoUrl = event.target.closest("[data-ycg-copy-video-url]");
    if (copyVideoUrl) {
      try {
        await navigator.clipboard.writeText(copyVideoUrl.dataset.ycgCopyVideoUrl);
        status("Đã copy URL video.", "success");
      } catch { status("Không thể truy cập clipboard; hãy copy URL trong thanh địa chỉ YouTube.", "error"); }
      return;
    }
    const removeTag = event.target.closest("[data-ycg-remove-tag]");
    if (removeTag) {
      const form = root?.querySelector("[data-ycg-video-detail-form]");
      const input = form?.elements?.tags;
      if (!input) return;
      input.value = String(input.value || "").split(",").map((tag) => tag.trim()).filter((tag) => tag && tag !== removeTag.dataset.ycgRemoveTag).join(", ");
      syncVideoDraftFromDom(form);
      render();
      return;
    }
    const insertTool = event.target.closest("[data-ycg-editor-insert]");
    if (insertTool) {
      const form = root?.querySelector("[data-ycg-video-detail-form]");
      const textarea = form?.elements?.description;
      if (!textarea) return;
      const additions = {
        template: "\n\n📌 Thông tin video\n\n🔔 Đăng ký kênh: ",
        chapter: "\n\n00:00 Mở đầu\n00:30 Nội dung chính\n",
        hashtag: "\n\n#YouTube #Video",
        link: "\n\nLiên kết: https://"
      };
      const addition = additions[insertTool.dataset.ycgEditorInsert] || "";
      const start = textarea.selectionStart ?? textarea.value.length;
      textarea.setRangeText(addition, start, textarea.selectionEnd ?? start, "end");
      syncVideoDraftFromDom(form);
      textarea.focus();
      return;
    }
    const contentFilter = event.target.closest("[data-ycg-content-filter]");
    if (contentFilter) { fleetState.contentFilter = contentFilter.dataset.ycgContentFilter; saveFleetState(); render(); return; }
    const contentSortColumn = event.target.closest("[data-ycg-content-sort-column]");
    if (contentSortColumn) {
      const column = contentSortColumn.dataset.ycgContentSortColumn;
      if (!["title", "channel", "status", "processing", "privacy", "date", "metrics"].includes(column)) return;
      if (fleetState.contentSortBy === column) fleetState.contentSort = fleetState.contentSort === "az" ? "za" : "az";
      else {
        fleetState.contentSortBy = column;
        fleetState.contentSort = ["date", "metrics"].includes(column) ? "za" : "az";
      }
      saveFleetState();
      render();
      return;
    }
    const contentChannelButton = event.target.closest("[data-ycg-content-channel-button]");
    if (contentChannelButton) {
      fleetState.contentChannel = contentChannelButton.dataset.ycgContentChannelButton || "all";
      saveFleetState();
      try { await loadContentLibrary(); }
      catch (error) { errorMessage = error.message; }
      render();
      return;
    }
    const calendarMode = event.target.closest("[data-ycg-calendar-mode]");
    if (calendarMode) { fleetState.calendarMode = calendarMode.dataset.ycgCalendarMode; saveFleetState(); render(); return; }
    const contentOpen = event.target.closest("[data-ycg-content-open]");
    if (contentOpen) {
      try { await openContentDrawer(contentOpen.dataset.ycgContentOpen); }
      catch (error) { errorMessage = error.message; contentDrawer = null; render(); }
      return;
    }
    const contentDelete = event.target.closest("[data-ycg-content-delete]");
    if (contentDelete) {
      const key = contentDelete.dataset.ycgContentDelete;
      try { openDeleteDialog(contentItemByKey(key), key); }
      catch (error) { errorMessage = error.message; render(); }
      return;
    }
    if (event.target.closest("[data-ycg-content-delete-current]")) {
      try {
        const item = contentDrawer?.item;
        openDeleteDialog(item, item?.uploadId || `${item?.channelId}::${item?.videoId}`);
      } catch (error) { errorMessage = error.message; render(); }
      return;
    }
    if (event.target.closest("[data-ycg-delete-close]")) { deleteDialog = null; render(); return; }
    if (event.target.closest("[data-ycg-ai-bulk-close]")) { aiBulkDialog = false; render(); return; }
    const saferDelete = event.target.closest("[data-ycg-delete-safer]");
    if (saferDelete) {
      try { await applySaferDeleteAlternative(saferDelete.dataset.ycgDeleteSafer); }
      catch (error) { errorMessage = error.message; render(); }
      return;
    }
    if (event.target.closest("[data-ycg-content-close]")) {
      return returnToContentManager();
    }
    const taskPause = event.target.closest("[data-ycg-task-pause]");
    if (taskPause) { await pauseFleetTask(taskPause.dataset.ycgTaskPause); return; }
    const taskCancel = event.target.closest("[data-ycg-task-cancel]");
    if (taskCancel) {
      if (!confirm("Hủy phiên upload này? Tác vụ sẽ không tự chạy lại.")) return;
      try { await cancelFleetTask(taskCancel.dataset.ycgTaskCancel); }
      catch (error) { errorMessage = error.message; render(); }
      return;
    }
    const detailCaptions = event.target.closest("[data-ycg-detail-captions]");
    if (detailCaptions) {
      state.captions.videoId = detailCaptions.dataset.ycgDetailCaptions;
      contentDrawer = null;
      saveState();
      switchModule("captions");
      return;
    }
    const fleetVideo = event.target.closest("[data-ycg-fleet-video]");
    if (fleetVideo) {
      try { await activateFleetVideo(fleetVideo.dataset.ycgFleetVideo, true); }
      catch (error) { errorMessage = error.message; render(); }
      return;
    }
    const removeFleetVideoButton = event.target.closest("[data-ycg-remove-fleet-video]");
    if (removeFleetVideoButton) {
      await removeFleetVideo(removeFleetVideoButton.dataset.ycgRemoveFleetVideo);
      return;
    }
    const studioChannel = event.target.closest("[data-ycg-studio-channel]");
    if (studioChannel) {
      const result = await apiAction("channel/select", { channelId: studioChannel.dataset.ycgStudioChannel }, "Đã mở kênh trong Studio.");
      if (result) { await refresh(); switchModule("command"); }
      return;
    }
    const fleetVariant = event.target.closest("[data-ycg-fleet-variant]");
    if (fleetVariant) {
      fleetState.thumbnailVariant = fleetVariant.dataset.ycgFleetVariant;
      saveFleetState();
      render();
      return;
    }
    const presetLock = event.target.closest("[data-ycg-preset-lock]");
    if (presetLock) {
      const preset = channelPreset(presetLock.dataset.ycgPresetLock);
      preset.locked = !preset.locked;
      saveFleetState();
      render();
      return status(preset.locked ? "Đã khóa metadata của kênh." : "Đã mở khóa metadata của kênh.", "success");
    }
    const retry = event.target.closest("[data-ycg-fleet-retry]");
    if (retry) {
      try { await retryFleetChannel(retry.dataset.ycgFleetRetry); }
      catch (error) { errorMessage = error.message; render(); }
      return;
    }
    const approve = event.target.closest("[data-ycg-fleet-approve]");
    if (approve) {
      try { await approveFleetPublish(approve.dataset.ycgFleetApprove); }
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

  function syncVideoDraftFromDom(source) {
    const form = source?.matches?.("[data-ycg-video-detail-form]") ? source : source?.closest?.("[data-ycg-video-detail-form]");
    if (!form || !contentDrawer) return false;
    const draft = videoDraftFromForm(form);
    contentDrawer.draft = draft;
    contentDrawer.dirty = !draftsEqual(draft, contentDrawer.originalDraft);
    const titleCount = root?.querySelector("[data-ycg-title-count]");
    const descriptionCount = root?.querySelector("[data-ycg-description-count]");
    if (titleCount) titleCount.textContent = `${draft.title.length}/100`;
    if (descriptionCount) descriptionCount.textContent = `${draft.description.length}/5000`;
    const stateNode = root?.querySelector(".ycg-video-workspace-top > span");
    if (stateNode) {
      stateNode.className = contentDrawer.dirty ? "is-dirty" : "is-saved";
      stateNode.textContent = contentDrawer.dirty ? "Có thay đổi chưa lưu" : "Đã lưu";
    }
    const undo = root?.querySelector('[data-ycg-action="video-undo"]');
    const save = root?.querySelector('[form="ycg-video-workspace-form"]');
    if (undo) undo.disabled = !contentDrawer.dirty;
    if (save) save.disabled = !contentDrawer.dirty;
    return true;
  }

  function handleInput(event) {
    const target = event.target;
    if (syncVideoDraftFromDom(target)) return;
    if (target.matches("[data-ycg-fleet-thumb]")) {
      const key = target.dataset.ycgFleetThumb;
      const draft = fleetDraft();
      if (key === "title") fleetState.thumbnailTitle = target.value.slice(0, 80);
      if (key === "subtitle") fleetState.thumbnailSubtitle = target.value.slice(0, 80);
      if (key === "accent") fleetState.thumbnailAccent = target.value;
      if (draft) {
        if (key === "title") draft.thumbnailTitle = fleetState.thumbnailTitle;
        if (key === "subtitle") draft.thumbnailSubtitle = fleetState.thumbnailSubtitle;
        if (key === "accent") draft.thumbnailAccent = fleetState.thumbnailAccent;
      }
      invalidateFleetThumbnails();
      saveFleetState();
      drawFleetThumbnail();
      return;
    }
    if (target.matches("[data-ycg-fleet-state]")) {
      fleetState[target.dataset.ycgFleetState] = target.value.slice(0, 80);
      saveFleetState();
      return;
    }
    if (target.matches("[data-ycg-channel-search]")) {
      fleetState.channelSearch = target.value.slice(0, 100);
      const query = fleetState.channelSearch.trim().toLocaleLowerCase("vi");
      root?.querySelectorAll(".ycg-studio-channel-table tbody tr").forEach((row) => {
        row.hidden = Boolean(query && !row.textContent.toLocaleLowerCase("vi").includes(query));
      });
      saveFleetState();
      return;
    }
    if (target.matches("[data-ycg-upload-channel-search]")) {
      fleetState.uploadChannelSearch = target.value.slice(0, 100);
      const query = fleetState.uploadChannelSearch.trim().toLocaleLowerCase("vi");
      const account = fleetState.uploadAccountFilter || "all";
      root?.querySelectorAll("[data-ycg-upload-channel-card]").forEach((card) => {
        card.hidden = Boolean((query && !String(card.dataset.search || "").includes(query)) || (account !== "all" && card.dataset.account !== account));
      });
      saveFleetState();
      return;
    }
    if (target.matches("[data-ycg-channel-title]")) {
      const draft = fleetDraft();
      if (draft) {
        draft.channelTitles[target.dataset.channelId] = target.value.slice(0, 100);
        draft.idempotencyKey = "";
        fleetPreflight = null;
        saveFleetState();
      }
      return;
    }
    if (target.form?.matches("[data-ycg-fleet-form]") && ["title", "description", "tags"].includes(target.name)) {
      const next = target.name === "title" ? target.value.slice(0, 100) : target.name === "description" ? target.value.slice(0, 5000) : target.value.slice(0, 500);
      const draft = fleetDraft();
      const previous = draft?.[target.name] || "";
      if (fleetState[target.name] !== next) invalidateFleetPublish();
      fleetState[target.name] = next;
      if (draft) {
        draft[target.name] = next;
        draft.idempotencyKey = "";
        if (target.name === "title" && (!draft.thumbnailTitle || draft.thumbnailTitle === previous)) {
          draft.thumbnailTitle = next.slice(0, 80);
          fleetState.thumbnailTitle = draft.thumbnailTitle;
        }
      }
      if (target.name === "title" && !fleetState.thumbnailTitle) drawFleetThumbnail();
      saveFleetState();
      return;
    }
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

  async function activateFleetVideo(fingerprint, shouldRender = true) {
    const file = fleetFileByFingerprint(fingerprint);
    if (!file) throw new Error("Không tìm thấy file video trong hàng đợi hiện tại.");
    fleetState.activeFileFingerprint = fingerprint;
    fleetDraft(fingerprint, file);
    syncActiveFleetDraftToLegacy();
    if (thumbnailVideoUrl) URL.revokeObjectURL(thumbnailVideoUrl);
    thumbnailVideoUrl = URL.createObjectURL(file);
    thumbnailVideo = document.createElement("video");
    thumbnailImage = null;
    thumbnailVideo.preload = "metadata";
    thumbnailVideo.muted = true;
    thumbnailVideo.playsInline = true;
    thumbnailVideo.src = thumbnailVideoUrl;
    await new Promise((resolve, reject) => {
      const done = () => { cleanupListeners(); resolve(); };
      const failed = () => { cleanupListeners(); reject(new Error("Không đọc được metadata của video.")); };
      const cleanupListeners = () => { thumbnailVideo?.removeEventListener("loadeddata", done); thumbnailVideo?.removeEventListener("error", failed); };
      thumbnailVideo.addEventListener("loadeddata", done, { once: true });
      thumbnailVideo.addEventListener("error", failed, { once: true });
      thumbnailVideo.load();
    });
    thumbnailImage = thumbnailVideo;
    saveFleetState();
    if (shouldRender) render();
    drawFleetThumbnail();
  }

  async function loadFleetVideoFiles(files) {
    const incoming = [...(files || [])].filter(Boolean);
    if (!incoming.length) return;
    const invalid = incoming.find((file) => !file.type.startsWith("video/") && file.type !== "application/octet-stream" && !/\.(mp4|mov|webm|mkv)$/i.test(file.name));
    if (invalid) throw new Error(`${invalid.name} không phải file video được hỗ trợ.`);
    const merged = new Map(fleetUploadFiles.map((file) => [fleetFileFingerprint(file), file]));
    incoming.forEach((file) => merged.set(fleetFileFingerprint(file), file));
    if (merged.size > 10) throw new Error("Mỗi hàng đợi nhận tối đa 10 video. Hãy chia thành batch tiếp theo.");
    fleetUploadFiles = [...merged.values()];
    const previousSelectedCount = fleetState.selectedChannelIds.length;
    const capacity = fleetSelectionCapacity();
    if (previousSelectedCount > capacity) {
      fleetState.selectedChannelIds = fleetState.selectedChannelIds.slice(0, capacity);
      invalidateFleetPublish();
    }
    fleetUploadFiles.forEach((file) => {
      const fingerprint = fleetFileFingerprint(file);
      const draft = fleetDraft(fingerprint, file);
      draft.thumbnailReady = ["A", "B", "C"].every((variant) => fleetThumbnailVariants.has(`${fingerprint}:${variant}`));
      if (!draft.checksum) sampledFileChecksum(file).then((checksum) => {
        if (!checksum) return;
        const current = fleetDraft(fingerprint, file);
        if (current) current.checksum = checksum;
        saveFleetState();
      }).catch(() => {});
    });
    const nextFingerprint = fleetState.activeFileFingerprint && merged.has(fleetState.activeFileFingerprint)
      ? fleetState.activeFileFingerprint
      : fleetFileFingerprint(incoming[0]);
    await activateFleetVideo(nextFingerprint, true);
    status(`Đã thêm ${incoming.length} video; hàng đợi có ${fleetUploadFiles.length}/10.${previousSelectedCount > capacity ? ` Đã giữ ${capacity} kênh để không vượt 100 tác vụ.` : ""}`, "success");
  }

  async function removeFleetVideo(fingerprint) {
    fleetUploadFiles = fleetUploadFiles.filter((file) => fleetFileFingerprint(file) !== fingerprint);
    Object.keys(fleetState.taskMatrix).filter((key) => key.startsWith(`${fingerprint}::`)).forEach((key) => delete fleetState.taskMatrix[key]);
    if (fleetState.activeFileFingerprint === fingerprint) {
      const next = fleetUploadFiles[0];
      if (next) return activateFleetVideo(fleetFileFingerprint(next), true);
      fleetState.activeFileFingerprint = "";
      fleetUploadFile = null;
      if (thumbnailVideoUrl) URL.revokeObjectURL(thumbnailVideoUrl);
      thumbnailVideoUrl = "";
      thumbnailVideo = null;
      thumbnailImage = null;
    }
    saveFleetState();
    render();
  }

  async function handleChange(event) {
    const target = event.target;
    if (target.matches("[data-ycg-batch-folder]")) return loadBatchFolderFiles(target.files || []);
    if (target.matches("[data-ycg-settings-channel]")) {
      fleetState.settingsChannel = target.value;
      channelSettings = null;
      saveFleetState();
      render();
      await loadChannelSettings(target.value);
      render();
      return;
    }
    if (syncVideoDraftFromDom(target)) return;
    if (target.matches("[data-ycg-matrix-mode]")) {
      const cell = matrixTask(target.dataset.fingerprint, target.dataset.channelId, true);
      cell.enabled = target.value !== "off";
      cell.mode = target.value === "off" ? "inherit" : target.value;
      if (cell.mode !== "schedule") cell.publishAt = "";
      invalidateFleetPublish();
      saveFleetState();
      render();
      return;
    }
    if (target.matches("[data-ycg-matrix-time]")) {
      const cell = matrixTask(target.dataset.fingerprint, target.dataset.channelId, true);
      cell.enabled = true;
      cell.mode = "schedule";
      cell.publishAt = target.value;
      invalidateFleetPublish();
      saveFleetState();
      return;
    }
    if (target.matches("[data-ycg-matrix-ai]")) {
      const cell = matrixTask(target.dataset.fingerprint, target.dataset.channelId, true);
      cell.aiDisclosure = normalizeAiDisclosure(target.value);
      invalidateFleetPublish();
      saveFleetState();
      render();
      return;
    }
    if (target.matches("[data-ycg-content-select]")) {
      const selected = new Set(fleetState.selectedContentIds);
      if (target.checked) selected.add(target.value); else selected.delete(target.value);
      fleetState.selectedContentIds = [...selected].slice(0, 500);
      saveFleetState();
      render();
      return;
    }
    if (target.matches("[data-ycg-content-channel]")) {
      fleetState.contentChannel = target.value;
      saveFleetState();
      try { await loadContentLibrary(); } catch (error) { errorMessage = error.message; }
      render();
      return;
    }
    if (target.matches("[data-ycg-content-privacy]")) {
      const key = target.dataset.contentKey;
      const previous = target.dataset.previous || "private";
      const privacyStatus = ["private", "unlisted", "public"].includes(target.value) ? target.value : previous;
      const item = contentItemByKey(key);
      if (!item?.videoId) {
        target.value = previous;
        throw new Error("Video chưa có Video ID nên chưa thể cập nhật quyền hiển thị trên YouTube.");
      }
      if (privacyStatus === "public" && normalizeAiDisclosure(item.aiDisclosure) === "unreviewed") {
        target.value = previous;
        throw new Error("Hãy khai báo Có hoặc Không cho nội dung AI trước khi chuyển video thành Public.");
      }
      if (privacyStatus === "public" && !confirm(`Chuyển “${item.title || item.fileName || "video"}” thành Public ngay trên YouTube?`)) {
        target.value = previous;
        return;
      }
      target.disabled = true;
      const result = await api("videos/update", "POST", {
        channelId: item.channelId,
        videoId: item.videoId,
        privacyStatus,
        publishAt: "",
        aiDisclosure: normalizeAiDisclosure(item.aiDisclosure),
        approved: true,
        metadataVersion: `quick-privacy-${Date.now().toString(36)}`
      });
      updateContentItemByKey(key, { ...(result.video || {}), privacyStatus, scheduledAt: null, publishAt: null });
      errorMessage = "";
      render();
      status(`Đã chuyển “${item.title || item.fileName || "video"}” sang ${privacyStatus} trên YouTube.`, "success");
      return;
    }
    if (target.matches("[data-ycg-calendar-channel]")) { fleetState.calendarChannelFilter = target.value; saveFleetState(); render(); return; }
    if (target.matches("[data-ycg-calendar-type]")) { fleetState.calendarTypeFilter = target.value; saveFleetState(); render(); return; }
    if (target.matches("[data-ycg-calendar-timezone]")) { fleetState.calendarTimezone = target.value.slice(0, 80); saveFleetState(); render(); return; }
    if (target.matches("[data-ycg-detail-thumbnail]")) {
      const file = target.files?.[0];
      if (!file || !["image/jpeg", "image/png"].includes(file.type) || file.size > 2 * 1024 * 1024) throw new Error("Thumbnail phải là JPEG/PNG và không vượt 2 MB.");
      const session = await api("thumbnail/session", "POST", { channelId: target.dataset.channelId, videoId: target.dataset.videoId, fileSize: file.size, mimeType: file.type });
      await putFleetChunk({ uploadUrl: session.uploadUrl, taskKey: `thumbnail::${target.dataset.videoId}` }, file, 0, file.size);
      status("YouTube đã nhận thumbnail mới.", "success");
      return;
    }
    if (target.matches("[data-ycg-fleet-channel]")) {
      const ids = new Set(fleetState.selectedChannelIds);
      if (target.checked) ids.add(target.value);
      else ids.delete(target.value);
      const limit = fleetSelectionCapacity();
      fleetState.selectedChannelIds = [...ids].slice(0, limit);
      if (ids.size > limit) target.checked = false;
      invalidateFleetPublish();
      saveFleetState();
      render();
      return;
    }
    if (target.matches("[data-ycg-fleet-file]")) {
      return loadFleetVideoFiles(target.files || []);
    }
    if (target.matches("[data-ycg-channel-filter]")) {
      fleetState.channelFilter = target.value;
      saveFleetState();
      render();
      return;
    }
    if (target.matches("[data-ycg-upload-account-filter]")) {
      fleetState.uploadAccountFilter = target.value.slice(0, 80);
      saveFleetState();
      render();
      return;
    }
    if (target.matches("[data-ycg-channel-preset]")) {
      const preset = channelPreset(target.dataset.channelId);
      if (!preset.locked || target.dataset.ycgChannelPreset === "thumbnailVariant") {
        preset[target.dataset.ycgChannelPreset] = target.value;
        const draft = fleetDraft();
        if (draft) draft.idempotencyKey = "";
        invalidateFleetPublish();
        saveFleetState();
        render();
      }
      return;
    }
    if (target.form?.matches("[data-ycg-fleet-form]") && ["privacyStatus", "concurrency", "uploadPrivateFirst", "aiDisclosure", "madeForKids", "rightsConfirmed"].includes(target.name)) {
      const next = target.type === "checkbox" ? target.checked : target.name === "concurrency" ? Math.min(3, Math.max(1, Number(target.value))) : target.value;
      const activeDraft = target.name === "aiDisclosure" ? fleetDraft() : null;
      const previousDisclosure = normalizeAiDisclosure(activeDraft?.aiDisclosure);
      if (fleetState[target.name] !== next) invalidateFleetPublish();
      fleetState[target.name] = next;
      if (target.name === "aiDisclosure") {
        if (activeDraft) activeDraft.aiDisclosure = normalizeAiDisclosure(next);
        fleetState.selectedChannelIds.forEach((channelId) => {
          const cell = matrixTask(fleetState.activeFileFingerprint, channelId, true);
          if (normalizeAiDisclosure(cell.aiDisclosure) === previousDisclosure) cell.aiDisclosure = normalizeAiDisclosure(next);
        });
        fleetState.containsSyntheticMedia = next === "yes";
      }
      saveFleetState();
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
    const aiBulkForm = event.target.closest("[data-ycg-ai-bulk-form]");
    if (aiBulkForm) {
      event.preventDefault();
      const disclosure = new FormData(aiBulkForm).get("aiDisclosure");
      await applySelectedContentAiDisclosure(disclosure);
      return;
    }
    const deleteForm = event.target.closest("[data-ycg-delete-form]");
    if (deleteForm) {
      event.preventDefault();
      try { await deleteVideoPermanently(deleteForm); }
      catch (error) { errorMessage = error.name === "NotAllowedError" ? "Bạn đã hủy xác thực Passkey; video chưa bị xóa." : error.message; render(); }
      return;
    }
    const uploadDefaultsForm = event.target.closest("[data-ycg-upload-defaults-form]");
    if (uploadDefaultsForm) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(uploadDefaultsForm));
      const preset = channelPreset(uploadDefaultsForm.dataset.channelId);
      Object.assign(preset, {
        titlePrefix: String(data.titlePrefix || "").slice(0, 40),
        titleSuffix: String(data.titleSuffix || "").slice(0, 40),
        descriptionTemplate: String(data.descriptionTemplate || "").slice(0, 3000),
        tags: String(data.tags || "").slice(0, 480),
        categoryId: String(data.categoryId || "22").slice(0, 8),
        defaultLanguage: String(data.defaultLanguage || "vi").slice(0, 12),
        playlistId: String(data.playlistId || "").slice(0, 120),
        privacyStatus: ["private", "unlisted", "schedule"].includes(data.privacyStatus) ? data.privacyStatus : "private",
        publishTime: /^\d{2}:\d{2}$/.test(data.publishTime) ? data.publishTime : "20:00",
        license: data.license === "creativeCommon" ? "creativeCommon" : "youtube",
        madeForKids: data.madeForKids === "on",
        embeddable: data.embeddable === "on",
        notifySubscribers: data.notifySubscribers === "on"
      });
      invalidateFleetPublish(false);
      saveFleetState();
      render();
      status("Đã lưu chế độ mặc định cho các video tải từ HH vào kênh này.", "success");
      return;
    }
    const channelApiForm = event.target.closest("[data-ycg-channel-profile-form],[data-ycg-channel-api-settings-form],[data-ycg-channel-moderation-form]");
    if (channelApiForm) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(channelApiForm));
      const id = channelApiForm.dataset.channelId;
      const channel = connectedChannels().find((item) => item.id === id) || {};
      const existing = channelSettings?.channelId === id ? channelSettings.profile || {} : channel.profile || {};
      const payload = {
        channelId: id,
        description: channelApiForm.matches("[data-ycg-channel-profile-form]") ? String(data.description || "").slice(0, 1000) : existing.description || "",
        keywords: channelApiForm.matches("[data-ycg-channel-api-settings-form]") ? String(data.keywords || "").slice(0, 500) : existing.keywords || "",
        country: channelApiForm.matches("[data-ycg-channel-api-settings-form]") ? String(data.country || "").slice(0, 2) : existing.country || "",
        defaultLanguage: channelApiForm.matches("[data-ycg-channel-api-settings-form]") ? String(data.defaultLanguage || "").slice(0, 12) : existing.defaultLanguage || "",
        trailerVideoId: channelApiForm.matches("[data-ycg-channel-api-settings-form]") ? String(data.trailerVideoId || "").slice(0, 40) : existing.trailerVideoId || "",
        moderateComments: channelApiForm.matches("[data-ycg-channel-moderation-form]") ? data.moderateComments === "on" : Boolean(existing.moderateComments)
      };
      const result = await api("channel/settings", "POST", payload);
      channelSettings = { channelId: id, profile: result.profile || { ...existing, ...payload } };
      errorMessage = "";
      render();
      status("YouTube đã xác nhận cập nhật cài đặt của đúng kênh.", "success");
      return;
    }
    const videoDetail = event.target.closest("[data-ycg-video-detail-form]");
    if (videoDetail) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(videoDetail));
      const privacyStatus = data.privacyStatus || "private";
      const aiDisclosure = normalizeAiDisclosure(data.aiDisclosure);
      const publishAt = data.publishAt ? new Date(data.publishAt) : null;
      if (privacyStatus === "schedule" && (!publishAt || !Number.isFinite(publishAt.getTime()) || publishAt.getTime() <= Date.now() + 60_000)) throw new Error("Lịch đăng phải ở tương lai.");
      if (["public", "schedule"].includes(privacyStatus) && aiDisclosure === "unreviewed") throw new Error("Hãy chọn Có hoặc Không cho khai báo nội dung AI trước khi Public hoặc lên lịch.");
      if (["public", "schedule"].includes(privacyStatus) && !confirm(privacyStatus === "public" ? "Chuyển video thành Public ngay bây giờ?" : `Xác nhận lịch đăng ${dateTime(publishAt)}?`)) return;
      const result = await api("videos/update", "POST", {
        channelId: videoDetail.dataset.channelId,
        videoId: videoDetail.dataset.videoId,
        title: data.title,
        description: data.description,
        tags: String(data.tags || "").split(",").map((item) => item.trim()).filter(Boolean),
        categoryId: data.categoryId,
        defaultLanguage: data.defaultLanguage,
        playlistId: data.playlistId,
        privacyStatus,
        publishAt: privacyStatus === "schedule" ? publishAt.toISOString() : "",
        madeForKids: data.madeForKids === "on",
        aiDisclosure,
        license: data.license === "creativeCommon" ? "creativeCommon" : "youtube",
        embeddable: data.embeddable === "on",
        publicStatsViewable: data.publicStatsViewable === "on",
        recordingDate: String(data.recordingDate || ""),
        approved: true,
        metadataVersion: `workspace-${Date.now().toString(36)}`
      });
      const key = contentDrawer?.item?.uploadId || `${videoDetail.dataset.channelId}::${videoDetail.dataset.videoId}`;
      contentLibrary = contentLibrary.map((item) => (item.uploadId || `${item.channelId}::${item.videoId}`) === key ? { ...item, ...(result.video || {}) } : item);
      const updatedItem = {
        ...(contentDrawer?.item || {}),
        ...(result.video || {}),
        title: data.title,
        description: data.description,
        tags: String(data.tags || "").split(",").map((item) => item.trim()).filter(Boolean),
        categoryId: data.categoryId,
        defaultLanguage: data.defaultLanguage,
        privacyStatus: privacyStatus === "schedule" ? "private" : privacyStatus,
        scheduledAt: privacyStatus === "schedule" ? publishAt.toISOString() : null,
        madeForKids: data.madeForKids === "on",
        aiDisclosure,
        license: data.license === "creativeCommon" ? "creativeCommon" : "youtube",
        embeddable: data.embeddable === "on",
        publicStatsViewable: data.publicStatsViewable === "on",
        recordingDate: String(data.recordingDate || "")
      };
      const savedDraft = editorDraftFromVideo(updatedItem);
      savedDraft.playlistId = String(data.playlistId || "");
      contentDrawer = { ...(contentDrawer || {}), loading: false, item: updatedItem, draft: savedDraft, originalDraft: { ...savedDraft }, dirty: false, audit: result.audit || contentDrawer?.audit || [] };
      render();
      return status("YouTube đã xác nhận thay đổi video.", "success");
    }
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

  async function handleKeydown(event) {
    if (state.active !== "fleet") return;
    const editing = event.target?.matches?.("input,textarea,select,[contenteditable='true']");
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "u") {
      event.preventDefault();
      if (fleetState.studioTab !== "content") { fleetState.studioTab = "content"; saveFleetState(); render(); }
      return root?.querySelector("[data-ycg-fleet-form]")?.requestSubmit();
    }
    if (event.ctrlKey && event.key.toLowerCase() === "u") {
      event.preventDefault();
      if (fleetState.studioTab !== "content") { fleetState.studioTab = "content"; saveFleetState(); render(); }
      return root?.querySelector("[data-ycg-fleet-file]")?.click();
    }
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      return handleAction("fleet-preflight");
    }
    if (event.ctrlKey && event.key.toLowerCase() === "d") {
      event.preventDefault();
      return handleAction("fleet-copy-metadata");
    }
    if (editing) return;
    if (event.key.toLowerCase() === "t") {
      event.preventDefault();
      fleetState.studioTab = "content";
      saveFleetState();
      render();
      return root?.querySelector(".ycg-simple-thumbnail")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      return handleAction("fleet-capture-frame");
    }
    if (["1", "2", "3"].includes(event.key)) {
      event.preventDefault();
      fleetState.thumbnailVariant = ["A", "B", "C"][Number(event.key) - 1];
      saveFleetState();
      return render();
    }
    if (event.altKey && ["ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      const channels = fleetOverview?.channels || channelStatus.channels || [];
      if (!channels.length) return;
      const current = Math.max(0, channels.findIndex((item) => item.id === channelStatus.channel?.id));
      const next = event.key === "ArrowUp" ? (current - 1 + channels.length) % channels.length : (current + 1) % channels.length;
      const result = await apiAction("channel/select", { channelId: channels[next].id }, "Đã chuyển kênh bằng phím tắt.");
      if (result) await refresh();
      return;
    }
    if (event.code === "Space") {
      const preview = root?.querySelector("[data-ycg-fleet-preview]");
      if (!preview?.src) return;
      event.preventDefault();
      if (preview.paused) await preview.play().catch(() => {});
      else preview.pause();
    }
  }

  function handleDragOver(event) {
    const drop = event.target.closest?.("[data-ycg-fleet-drop],[data-ycg-calendar-day]");
    if (!drop) return;
    event.preventDefault();
    drop.classList.add("is-dragging");
  }

  function handleDragLeave(event) {
    event.target.closest?.("[data-ycg-fleet-drop],[data-ycg-calendar-day]")?.classList.remove("is-dragging");
  }

  function handleDragStart(event) {
    const item = event.target.closest?.("[data-ycg-calendar-video]");
    if (!item) return;
    calendarDragItem = item.dataset.ycgCalendarVideo;
    event.dataTransfer?.setData?.("text/plain", calendarDragItem);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }

  async function handleDrop(event) {
    const calendarDay = event.target.closest?.("[data-ycg-calendar-day]");
    if (calendarDay) {
      event.preventDefault();
      calendarDay.classList.remove("is-dragging");
      const key = calendarDragItem || event.dataTransfer?.getData?.("text/plain");
      const item = calendarContentItems().find((entry) => entry.scheduleKey === key);
      if (!item) return;
      const preset = channelPreset(item.channelId);
      const time = /^\d{2}:\d{2}$/.test(preset.publishTime) ? preset.publishTime : "20:00";
      let publishAt = new Date(zonedLocalToIso(calendarDay.dataset.ycgCalendarDay, time, preset.timezone || fleetState.calendarTimezone));
      if (publishAt.getTime() <= Date.now() + 60_000) publishAt = new Date(publishAt.getTime() + 24 * 60 * 60 * 1000);
      fleetState.scheduleHistory.push(JSON.parse(JSON.stringify(fleetState.scheduleDrafts)));
      fleetState.scheduleHistory = fleetState.scheduleHistory.slice(-20);
      fleetState.scheduleDrafts[key] = { channelId: item.channelId, videoId: item.videoId, publishAt: publishAt.toISOString(), previousPublishAt: item.scheduledAt || "" };
      calendarDragItem = null;
      saveFleetState();
      render();
      return status(`Đã chuyển “${item.title}” sang ${dateTime(publishAt)}. Chưa gửi YouTube.`, "success");
    }
    const drop = event.target.closest?.("[data-ycg-fleet-drop]");
    if (!drop) return;
    event.preventDefault();
    drop.classList.remove("is-dragging");
    await loadFleetVideoFiles(event.dataTransfer?.files || []);
  }

  function mount(host, mountOptions = {}) {
    cleanup();
    root = host;
    batchRouteMode = mountOptions.view === "youtube-batch" || location.hash.startsWith("#/davinci-resolve/youtube-batch");
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    state = loadState();
    fleetState = loadFleetState();
    const launchTab = consumeLaunchIntent();
    if (batchRouteMode) { fleetState.studioTab = "content"; fleetState.contentMode = "upload"; }
    else if (launchTab) fleetState.studioTab = launchTab;
    else if (STUDIO_MODULE_TABS[state.active]) fleetState.studioTab = STUDIO_MODULE_TABS[state.active];
    state.active = "fleet";
    saveState();
    saveFleetState();
    const hasOauthResult = handleOauthResult();
    controller = new AbortController();
    const options = { signal: controller.signal };
    root.addEventListener("click", handleClick, options);
    document.addEventListener("click", handleShellBack, { signal: controller.signal, capture: true });
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
    root.addEventListener("dragover", handleDragOver, options);
    root.addEventListener("dragstart", handleDragStart, options);
    root.addEventListener("dragleave", handleDragLeave, options);
    root.addEventListener("drop", (event) => handleDrop(event).catch((error) => {
      errorMessage = error.message;
      render();
    }), options);
    window.addEventListener("keydown", (event) => handleKeydown(event).catch((error) => {
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
    window.addEventListener("beforeunload", (event) => {
      if (!contentDrawer?.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }, options);
    window.addEventListener("hh:auth-change", () => {
      if (publisherMounted) window.HHYouTubePublisher?.unmount?.();
      publisherMounted = false;
      storageChannelId = "unassigned";
      state = loadState();
      fleetState = loadFleetState();
      if (STUDIO_MODULE_TABS[state.active]) fleetState.studioTab = STUDIO_MODULE_TABS[state.active];
      state.active = "fleet";
      saveState();
      saveFleetState();
      fleetOverview = null;
      fleetJobs = [];
      fleetObservatory = null;
      fleetPreflight = null;
      fleetUploadFile = null;
      fleetUploadFiles = [];
      batchSidecars = new Map();
      batchThumbnailFiles = new Map();
      contentLibrary = [];
      contentDrawer = null;
      deleteDialog = null;
      channelStatus = { configured: false, connected: false, permissions: {} };
      dashboard = null;
      errorMessage = "";
      render();
      refresh(false);
    }, options);
    render();
    refresh(true, hasOauthResult);
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
    fleetUploadFiles = [];
    batchSidecars = new Map();
    batchThumbnailFiles = new Map();
    batchAiRunning = false;
    batchRouteMode = false;
    contentLibrary = [];
    contentDrawer = null;
    deleteDialog = null;
    aiBulkDialog = false;
    fleetObservatory = null;
    fleetPreflight = null;
    root = null;
  }

  window.HHYouTubeCreatorGalaxy = Object.freeze({
    mount,
    cleanup,
    modules: MODULES,
    normalizeState,
    validLaunchIntentTab,
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
