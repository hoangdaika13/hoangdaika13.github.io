(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-creative-preproduction";
  const STORAGE_KEY = "hh.creative-preproduction.v1";
  const VIEWS = Object.freeze(["brief", "moodboard", "storyboard", "world-bible"]);
  const CARD_TYPES = Object.freeze(["image", "video", "color", "font", "audio", "note"]);
  const BIBLE_TYPES = Object.freeze(["character", "costume", "voice", "location", "prop", "reference"]);
  const LIMITS = Object.freeze({
    text: 4000,
    shortText: 180,
    projects: 24,
    cards: 160,
    groups: 24,
    comments: 80,
    scenes: 120,
    bibleEntries: 240,
    references: 40,
    fileSize: 1024 * 1024 * 750
  });
  const mountedRoots = new WeakMap();

  function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function cleanText(value, limit) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .trim()
      .slice(0, limit || LIMITS.text);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[character]);
  }

  function safeId(value, fallback) {
    const result = cleanText(value, 100).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    return result || fallback || `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function safeColor(value, fallback) {
    const color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : (fallback || "#62D7E7");
  }

  function boundedNumber(value, min, max, fallback) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
  }

  function uniqueStrings(values, limit, itemLimit) {
    const result = [];
    const source = Array.isArray(values) ? values : String(values || "").split(/[,\n]/);
    source.forEach((value) => {
      const clean = cleanText(value, itemLimit || 80);
      if (clean && !result.includes(clean) && result.length < (limit || 30)) result.push(clean);
    });
    return result;
  }

  function hashSeed(value) {
    let hash = 2166136261;
    const input = String(value || "");
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function pick(list, seed, offset) {
    return list[(seed + (offset || 0)) % list.length];
  }

  function normalizeBrief(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      product: cleanText(source.product, 240),
      audience: cleanText(source.audience, 420),
      goal: cleanText(source.goal, 320),
      platform: cleanText(source.platform || "YouTube", 80),
      brandName: cleanText(source.brandName, 100),
      brandColors: uniqueStrings(source.brandColors, 8, 20).map((color) => safeColor(color, "#62D7E7")),
      brandFonts: uniqueStrings(source.brandFonts, 8, 80),
      brandValues: uniqueStrings(source.brandValues, 12, 100),
      persona: cleanText(source.persona, 900),
      message: cleanText(source.message, 500),
      tone: cleanText(source.tone, 240),
      cta: cleanText(source.cta, 240),
      format: cleanText(source.format, 240),
      contentPlan: Array.isArray(source.contentPlan)
        ? source.contentPlan.slice(0, 14).map((item) => cleanText(item, 320)).filter(Boolean)
        : []
    };
  }

  function generateBrief(raw) {
    const brief = normalizeBrief(raw);
    const product = brief.product || "sản phẩm mới";
    const audience = brief.audience || "người đang tìm một giải pháp rõ ràng và đáng tin cậy";
    const goal = brief.goal || "tăng mức độ quan tâm và tạo hành động tiếp theo";
    const platform = brief.platform || "YouTube";
    const seed = hashSeed([product, audience, goal, platform, brief.brandName].join("|"));
    const tones = ["rõ ràng, tích cực và có dẫn chứng", "gần gũi, giàu hình ảnh và truyền cảm hứng", "chuyên nghiệp, súc tích và hướng hành động", "tự nhiên, đáng tin và tập trung vào lợi ích"];
    const formats = {
      YouTube: ["Video 6-8 phút, hook 8 giây, ba chương và CTA cuối", "Video kể chuyện 5-7 phút kèm B-roll và chapter", "Video hướng dẫn 7 phút, demo rõ và recap cuối"],
      TikTok: ["Video dọc 30-45 giây, hook 2 giây và caption lớn", "Chuỗi 3 video dọc, mỗi video một insight", "Video before/after 35 giây với CTA bình luận"],
      Facebook: ["Bài carousel 6 trang kèm caption ngắn", "Video vuông 60-90 giây và bài viết bổ trợ", "Bài kể chuyện có ảnh, câu hỏi và CTA mềm"],
      Website: ["Landing page gồm hero, lợi ích, bằng chứng, FAQ và CTA", "Bài chuyên sâu có mục lục, ví dụ và biểu mẫu", "Trang giới thiệu ngắn có demo và lời chứng thực"]
    };
    const selectedFormats = formats[platform] || ["Nội dung chủ lực kèm ba biến thể ngắn theo nền tảng", "Bài giới thiệu có ví dụ, bằng chứng và CTA", "Chuỗi nội dung ba phần từ nhận biết tới hành động"];
    const brand = brief.brandName || "thương hiệu";
    const persona = `Người xem trọng tâm là ${audience}. Họ cần hiểu nhanh ${product} giúp ích gì, bằng chứng nào đáng tin và bước tiếp theo có ít rủi ro.`;
    const message = `${brand} giúp ${audience.toLowerCase()} đạt mục tiêu “${goal}” bằng ${product}, với thông tin minh bạch và hành động dễ bắt đầu.`;
    const ctas = ["Khám phá bản phù hợp với bạn", "Bắt đầu với bước nhỏ đầu tiên", "Xem hướng dẫn và tự trải nghiệm", "Lưu lại và chia sẻ nhu cầu của bạn"];
    const pillars = [
      `Ngày 1: Nêu vấn đề thật của ${audience} và lời hứa nội dung.`,
      `Ngày 2: Giải thích cách ${product} giải quyết vấn đề bằng một ví dụ cụ thể.`,
      "Ngày 3: Đưa bằng chứng, kết quả hoặc quy trình hậu trường.",
      "Ngày 4: Trả lời ba phản đối phổ biến và chỉ rõ giới hạn.",
      `Ngày 5: Xuất bản nội dung chủ lực trên ${platform}.`,
      "Ngày 6: Tái sử dụng thành nội dung ngắn, ảnh và câu hỏi cộng đồng.",
      `Ngày 7: Tổng hợp phản hồi, đo ${goal} và lập phiên bản cải tiến.`
    ];
    return normalizeBrief({
      ...brief,
      persona,
      message,
      tone: brief.tone || pick(tones, seed, 1),
      cta: brief.cta || pick(ctas, seed, 2),
      format: brief.format || pick(selectedFormats, seed, 3),
      contentPlan: pillars
    });
  }

  function normalizeFileMetadata(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      name: cleanText(source.name, 180),
      type: cleanText(source.type, 100),
      size: boundedNumber(source.size, 0, LIMITS.fileSize, 0),
      lastModified: boundedNumber(source.lastModified, 0, Number.MAX_SAFE_INTEGER, 0)
    };
  }

  function normalizeComment(raw, index) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      id: safeId(source.id, `comment-${index || 0}`),
      author: cleanText(source.author || "Bạn", 80),
      text: cleanText(source.text, 600),
      createdAt: cleanText(source.createdAt || new Date(0).toISOString(), 40)
    };
  }

  function normalizeMoodItem(raw, index) {
    const source = raw && typeof raw === "object" ? raw : {};
    const type = CARD_TYPES.includes(source.type) ? source.type : "note";
    const file = source.file ? normalizeFileMetadata(source.file) : null;
    let content = type === "color" ? safeColor(source.content, "#EC4899") : cleanText(source.content, 1200);
    if (file && ["image", "video", "audio"].includes(type) && /^(?:blob:|data:)/i.test(content)) content = "";
    return {
      id: safeId(source.id, `mood-${index || 0}`),
      type,
      title: cleanText(source.title || `${type} ${(index || 0) + 1}`, 120),
      content,
      file,
      groupId: safeId(source.groupId, "inbox"),
      votes: boundedNumber(source.votes, 0, 999999, 0),
      comments: Array.isArray(source.comments) ? source.comments.slice(0, LIMITS.comments).map(normalizeComment).filter((item) => item.text) : [],
      x: boundedNumber(source.x, 0, 100, 8 + ((index || 0) * 13) % 72),
      y: boundedNumber(source.y, 0, 100, 12 + ((index || 0) * 17) % 64),
      createdAt: cleanText(source.createdAt || new Date(0).toISOString(), 40)
    };
  }

  function normalizeMoodboard(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const groups = Array.isArray(source.groups) ? source.groups.slice(0, LIMITS.groups).map((group, index) => ({
      id: safeId(group?.id, `group-${index}`),
      name: cleanText(group?.name || `Nhóm ${index + 1}`, 80),
      color: safeColor(group?.color, ["#62D7E7", "#F05CAF", "#C7F36B", "#F9C74F"][index % 4])
    })) : [];
    if (!groups.some((group) => group.id === "inbox")) groups.unshift({ id: "inbox", name: "Chưa phân nhóm", color: "#64748B" });
    const items = Array.isArray(source.items) ? source.items.slice(0, LIMITS.cards).map(normalizeMoodItem) : [];
    const validGroups = new Set(groups.map((group) => group.id));
    items.forEach((item) => { if (!validGroups.has(item.groupId)) item.groupId = "inbox"; });
    return {
      groups,
      items,
      concepts: Array.isArray(source.concepts) ? source.concepts.slice(0, 40).map((concept, index) => ({
        id: safeId(concept?.id, `concept-${index}`),
        name: cleanText(concept?.name || `Concept ${index + 1}`, 100),
        groupId: safeId(concept?.groupId, "inbox"),
        itemIds: uniqueStrings(concept?.itemIds, LIMITS.cards, 100),
        createdAt: cleanText(concept?.createdAt || new Date(0).toISOString(), 40)
      })) : []
    };
  }

  function reorderById(items, sourceId, targetId, position) {
    const list = Array.isArray(items) ? items.map((item) => clone(item)) : [];
    const from = list.findIndex((item) => item.id === sourceId);
    const target = list.findIndex((item) => item.id === targetId);
    if (from < 0 || target < 0 || from === target) return list;
    const [moving] = list.splice(from, 1);
    let insertion = list.findIndex((item) => item.id === targetId);
    if (position === "after") insertion += 1;
    list.splice(Math.max(0, insertion), 0, moving);
    return list;
  }

  function moveByDelta(items, id, delta) {
    const list = Array.isArray(items) ? items.map((item) => clone(item)) : [];
    const current = list.findIndex((item) => item.id === id);
    const next = Math.max(0, Math.min(list.length - 1, current + Number(delta || 0)));
    if (current < 0 || next === current) return list;
    const [moving] = list.splice(current, 1);
    list.splice(next, 0, moving);
    return list;
  }

  function normalizeScene(raw, index) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      id: safeId(source.id, `scene-${index || 0}`),
      title: cleanText(source.title || `Cảnh ${(index || 0) + 1}`, 120),
      shot: cleanText(source.shot || "Toàn cảnh", 100),
      dialogue: cleanText(source.dialogue, 1600),
      duration: boundedNumber(source.duration, 0.5, 600, 5),
      camera: cleanText(source.camera || "Máy tĩnh", 120),
      movement: cleanText(source.movement || "Không", 120),
      audio: cleanText(source.audio, 400),
      color: safeColor(source.color, ["#62D7E7", "#F05CAF", "#C7F36B", "#F9C74F"][Number(index || 0) % 4]),
      notes: cleanText(source.notes, 600)
    };
  }

  function normalizeStoryboard(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      title: cleanText(source.title || "Storyboard chính", 120),
      frameRate: boundedNumber(source.frameRate, 12, 60, 24),
      aspectRatio: ["16:9", "9:16", "1:1", "4:5"].includes(source.aspectRatio) ? source.aspectRatio : "16:9",
      scenes: Array.isArray(source.scenes) ? source.scenes.slice(0, LIMITS.scenes).map(normalizeScene) : []
    };
  }

  function totalDuration(storyboard) {
    return Number(normalizeStoryboard(storyboard).scenes.reduce((sum, scene) => sum + scene.duration, 0).toFixed(2));
  }

  function buildAnimaticFrames(storyboard) {
    let start = 0;
    return normalizeStoryboard(storyboard).scenes.map((scene, index) => {
      const frame = { ...scene, index, start, end: Number((start + scene.duration).toFixed(2)) };
      start = frame.end;
      return frame;
    });
  }

  function normalizeBibleEntry(raw, index) {
    const source = raw && typeof raw === "object" ? raw : {};
    const type = BIBLE_TYPES.includes(source.type) ? source.type : "reference";
    return {
      id: safeId(source.id, `bible-${index || 0}`),
      type,
      name: cleanText(source.name || `${type} ${(index || 0) + 1}`, 120),
      summary: cleanText(source.summary, 1200),
      traits: uniqueStrings(source.traits, 30, 100),
      relations: uniqueStrings(source.relations, 30, 100),
      palette: uniqueStrings(source.palette, 12, 20).map((color) => safeColor(color, "#62D7E7")),
      reference: cleanText(source.reference, 500),
      voice: cleanText(source.voice, 240),
      rules: uniqueStrings(source.rules, 30, 160),
      updatedAt: cleanText(source.updatedAt || new Date(0).toISOString(), 40)
    };
  }

  function normalizeWorldBible(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      entries: Array.isArray(source.entries) ? source.entries.slice(0, LIMITS.bibleEntries).map(normalizeBibleEntry) : [],
      globalRules: uniqueStrings(source.globalRules, 60, 180),
      palette: uniqueStrings(source.palette, 16, 20).map((color) => safeColor(color, "#62D7E7"))
    };
  }

  function auditConsistency(raw) {
    const bible = normalizeWorldBible(raw);
    const issues = [];
    const names = new Map();
    bible.entries.forEach((entry) => {
      const nameKey = entry.name.toLocaleLowerCase("vi");
      if (names.has(nameKey)) issues.push({ level: "error", entryId: entry.id, message: `Tên “${entry.name}” đang bị trùng.` });
      names.set(nameKey, entry.id);
      if (!entry.summary) issues.push({ level: "warning", entryId: entry.id, message: `${entry.name} chưa có mô tả nhận diện.` });
      if (["character", "costume", "location"].includes(entry.type) && !entry.palette.length) issues.push({ level: "warning", entryId: entry.id, message: `${entry.name} chưa có bảng màu.` });
      if (entry.type === "character" && !entry.voice) issues.push({ level: "info", entryId: entry.id, message: `${entry.name} chưa có quy tắc giọng nói.` });
      entry.relations.forEach((relation) => {
        if (!names.has(relation.toLocaleLowerCase("vi")) && !bible.entries.some((candidate) => candidate.name.toLocaleLowerCase("vi") === relation.toLocaleLowerCase("vi"))) {
          issues.push({ level: "warning", entryId: entry.id, message: `${entry.name} liên kết tới “${relation}” nhưng mục này chưa tồn tại.` });
        }
      });
    });
    const score = Math.max(0, Math.round(100 - issues.reduce((sum, issue) => sum + (issue.level === "error" ? 18 : issue.level === "warning" ? 8 : 3), 0)));
    return { score, issues, passed: !issues.some((issue) => issue.level === "error") };
  }

  function searchBible(raw, query, type) {
    const terms = cleanText(query, 160).toLocaleLowerCase("vi").split(/\s+/).filter(Boolean);
    return normalizeWorldBible(raw).entries.filter((entry) => {
      if (type && type !== "all" && entry.type !== type) return false;
      const haystack = [entry.name, entry.summary, entry.voice, entry.reference, ...entry.traits, ...entry.relations, ...entry.rules].join(" ").toLocaleLowerCase("vi");
      return terms.every((term) => haystack.includes(term));
    });
  }

  function createDefaultProject() {
    const now = new Date().toISOString();
    return {
      format: FORMAT,
      version: VERSION,
      id: "creative-main",
      name: "Dự án sáng tạo đầu tiên",
      status: "draft",
      brief: normalizeBrief({ platform: "YouTube", brandColors: ["#62D7E7", "#F05CAF"], brandFonts: ["Inter"] }),
      moodboard: normalizeMoodboard({ groups: [{ id: "inbox", name: "Chưa phân nhóm", color: "#64748B" }] }),
      storyboard: normalizeStoryboard({ scenes: [] }),
      worldBible: normalizeWorldBible({ palette: ["#62D7E7", "#F05CAF"] }),
      updatedAt: now
    };
  }

  function normalizeProject(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      format: FORMAT,
      version: VERSION,
      id: safeId(source.id, "creative-main"),
      name: cleanText(source.name || "Dự án sáng tạo", 140),
      status: ["draft", "review", "approved", "published"].includes(source.status) ? source.status : "draft",
      brief: normalizeBrief(source.brief),
      moodboard: normalizeMoodboard(source.moodboard),
      storyboard: normalizeStoryboard(source.storyboard),
      worldBible: normalizeWorldBible(source.worldBible),
      updatedAt: cleanText(source.updatedAt || new Date().toISOString(), 40)
    };
  }

  function projectFromStoreState(raw) {
    const state = raw && typeof raw === "object" ? raw : {};
    if (state.format === FORMAT) return normalizeProject(state);
    if (state.currentProject && typeof state.currentProject === "object") return normalizeProject(state.currentProject);
    if (state.project && typeof state.project === "object") return normalizeProject(state.project);
    if (state.activeProjectId && Array.isArray(state.projects)) {
      return normalizeProject(state.projects.find((project) => project?.id === state.activeProjectId) || state.projects[0]);
    }
    if (state.activeProjectId && state.projects && typeof state.projects === "object") {
      return normalizeProject(state.projects[state.activeProjectId] || Object.values(state.projects)[0]);
    }
    return null;
  }

  function saveLocal(storage, project) {
    if (!storage || typeof storage.setItem !== "function") return { ok: false, reason: "unsupported" };
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(normalizeProject(project)));
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: cleanText(error?.message || "storage-error", 160) };
    }
  }

  function loadLocal(storage) {
    if (!storage || typeof storage.getItem !== "function") return { ok: false, reason: "unsupported", project: createDefaultProject() };
    try {
      const value = storage.getItem(STORAGE_KEY);
      return { ok: true, project: value ? normalizeProject(JSON.parse(value)) : createDefaultProject() };
    } catch (error) {
      return { ok: false, reason: cleanText(error?.message || "storage-error", 160), project: createDefaultProject() };
    }
  }

  function createStoreAdapter(store, storage) {
    const external = store && typeof store.getState === "function" && typeof store.updateProject === "function";
    const getProject = () => {
      if (external) {
        try { return projectFromStoreState(store.getState()) || createDefaultProject(); } catch (_) { return createDefaultProject(); }
      }
      return loadLocal(storage).project;
    };
    const updateProject = (project) => {
      const next = normalizeProject({ ...project, updatedAt: new Date().toISOString() });
      if (external) {
        if (store.updateProject.length >= 2) store.updateProject(next.id, next);
        else store.updateProject(next);
        return { ok: true, project: next, external: true };
      }
      return { ...saveLocal(storage, next), project: next, external: false };
    };
    const subscribe = (listener) => {
      if (!external || typeof store.subscribe !== "function") return () => {};
      const unsubscribe = store.subscribe(listener);
      return typeof unsubscribe === "function" ? unsubscribe : () => {};
    };
    return Object.freeze({ external, getProject, updateProject, subscribe });
  }

  function formatDuration(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safe / 60);
    const rest = Math.floor(safe % 60);
    return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }

  function viewLabel(view) {
    return ({ brief: "Creative Brief", moodboard: "Moodboard", storyboard: "Storyboard", "world-bible": "World Bible" })[view] || "Pre-production";
  }

  function shellMarkup(view, project, body) {
    return `<section class="hhcp" data-hhcp-view="${escapeHtml(view)}">
      <header class="hhcp__hero">
        <div><p class="hhcp__kicker">PRE-PRODUCTION OS</p><h2>${escapeHtml(viewLabel(view))}</h2><p>Biến ý tưởng thành tài liệu sản xuất có cấu trúc, lưu cùng dự án và sẵn sàng chuyển sang bước tiếp theo.</p></div>
        <div class="hhcp__project"><span>Đang làm việc</span><strong>${escapeHtml(project.name)}</strong><small>${project.status} · tự lưu</small></div>
      </header>
      <nav class="hhcp__tabs" aria-label="Không gian tiền kỳ">
        ${VIEWS.map((item) => `<button type="button" data-hhcp-view-button="${item}" class="${item === view ? "is-active" : ""}" aria-current="${item === view ? "page" : "false"}">${escapeHtml(viewLabel(item))}</button>`).join("")}
      </nav>
      <div class="hhcp__workspace">${body}</div>
      <div class="hhcp__toast" data-hhcp-status role="status" aria-live="polite">Sẵn sàng.</div>
      <dialog class="hhcp__dialog" data-hhcp-comment-dialog aria-labelledby="hhcp-comment-title">
        <form method="dialog" data-hhcp-comment-form>
          <header><div><span>Concept feedback</span><h3 id="hhcp-comment-title">Thêm bình luận</h3></div><button type="button" data-hhcp-action="close-comment" aria-label="Đóng">×</button></header>
          <label>Nội dung<textarea name="comment" rows="4" maxlength="600" required placeholder="Điểm mạnh, thay đổi cần thử hoặc câu hỏi..."></textarea></label>
          <footer><button type="button" data-hhcp-action="close-comment">Hủy</button><button type="submit" class="hhcp__primary">Lưu bình luận</button></footer>
        </form>
      </dialog>
    </section>`;
  }

  function field(label, name, value, options) {
    const config = options || {};
    const tag = config.multiline ? "textarea" : "input";
    const attrs = config.multiline ? `rows="${config.rows || 3}"` : `type="${config.type || "text"}"`;
    const content = config.multiline ? escapeHtml(value) : "";
    const valueAttr = config.multiline ? "" : `value="${escapeHtml(value)}"`;
    return `<label class="${config.wide ? "is-wide" : ""}"><span>${escapeHtml(label)}</span><${tag} ${attrs} ${valueAttr} name="${escapeHtml(name)}" maxlength="${config.maxlength || LIMITS.shortText}" placeholder="${escapeHtml(config.placeholder || "")}" data-hhcp-brief>${content}</${tag}></label>`;
  }

  function briefMarkup(project) {
    const brief = project.brief;
    return `<div class="hhcp__brief-layout">
      <form class="hhcp__panel hhcp__brief-form" data-hhcp-brief-form>
        <header><div><span>Đầu vào chiến lược</span><h3>Xây brief có thể sản xuất</h3></div><button type="submit" class="hhcp__primary">Tạo chiến lược</button></header>
        <div class="hhcp__form-grid">
          ${field("Sản phẩm / dịch vụ", "product", brief.product, { placeholder: "Ví dụ: khóa học dựng video", wide: true })}
          ${field("Đối tượng", "audience", brief.audience, { multiline: true, placeholder: "Ai sẽ xem và họ đang cần gì?" })}
          ${field("Mục tiêu", "goal", brief.goal, { multiline: true, placeholder: "Nhận biết, tương tác, đăng ký..." })}
          <label><span>Nền tảng</span><select name="platform" data-hhcp-brief>${["YouTube", "TikTok", "Facebook", "Website", "Podcast", "Đa nền tảng"].map((item) => `<option ${item === brief.platform ? "selected" : ""}>${item}</option>`).join("")}</select></label>
          ${field("Tên thương hiệu", "brandName", brief.brandName, { placeholder: "Tên dùng trên nội dung" })}
          ${field("Màu thương hiệu", "brandColors", brief.brandColors.join(", "), { placeholder: "#62D7E7, #F05CAF" })}
          ${field("Font", "brandFonts", brief.brandFonts.join(", "), { placeholder: "Inter, Be Vietnam Pro" })}
          ${field("Giá trị thương hiệu", "brandValues", brief.brandValues.join(", "), { placeholder: "minh bạch, sáng tạo, dễ dùng", wide: true })}
        </div>
      </form>
      <section class="hhcp__panel hhcp__brief-output">
        <header><div><span>Kết quả có thể chỉnh sửa</span><h3>Creative direction</h3></div><button type="button" data-hhcp-action="copy-brief">Sao chép</button></header>
        <div class="hhcp__brief-result">
          ${field("Chân dung người xem", "persona", brief.persona, { multiline: true, rows: 5, maxlength: 900, wide: true })}
          ${field("Thông điệp chính", "message", brief.message, { multiline: true, maxlength: 500, wide: true })}
          ${field("Tone", "tone", brief.tone, { multiline: true })}
          ${field("CTA", "cta", brief.cta, { multiline: true })}
          ${field("Định dạng", "format", brief.format, { multiline: true, wide: true })}
        </div>
        <ol class="hhcp__plan">${brief.contentPlan.length ? brief.contentPlan.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>Nhập đầu vào rồi chọn “Tạo chiến lược”.</li>"}</ol>
      </section>
    </div>`;
  }

  function moodPreview(item, objectUrl) {
    if (item.type === "image" && objectUrl) return `<img src="${escapeHtml(objectUrl)}" alt="">`;
    if (item.type === "video" && objectUrl) return `<video src="${escapeHtml(objectUrl)}" muted controls preload="metadata"></video>`;
    if (item.type === "audio" && objectUrl) return `<audio src="${escapeHtml(objectUrl)}" controls preload="metadata"></audio>`;
    if (item.type === "color") return `<span class="hhcp__swatch" style="--swatch:${item.content}"></span><code>${escapeHtml(item.content)}</code>`;
    if (item.type === "font") return `<strong class="hhcp__font-preview" style="font-family:${escapeHtml(item.content || "inherit")}">Aa</strong><span>${escapeHtml(item.content || "Font")}</span>`;
    return `<p>${escapeHtml(item.content || (item.file ? `${item.file.name} · chỉ lưu metadata` : "Ghi chú mới"))}</p>`;
  }

  function moodboardMarkup(project, runtime) {
    const board = project.moodboard;
    return `<div class="hhcp__mood-layout">
      <aside class="hhcp__panel hhcp__mood-tools">
        <header><div><span>Concept tools</span><h3>Thêm chất liệu</h3></div></header>
        <div class="hhcp__tool-grid">
          ${["note", "color", "font"].map((type) => `<button type="button" data-hhcp-add-card="${type}">+ ${type}</button>`).join("")}
          <label class="hhcp__file-button">+ Media<input type="file" accept="image/*,video/*,audio/*" multiple data-hhcp-files></label>
        </div>
        <form data-hhcp-group-form><label><span>Tên nhóm concept</span><input name="name" required maxlength="80" placeholder="Ví dụ: Neon tối giản"></label><button class="hhcp__primary" type="submit">Tạo nhóm</button></form>
        <div class="hhcp__group-list">${board.groups.map((group) => `<button type="button" data-hhcp-filter-group="${group.id}" style="--group:${group.color}"><i></i>${escapeHtml(group.name)}<b>${board.items.filter((item) => item.groupId === group.id).length}</b></button>`).join("")}</div>
        <p class="hhcp__truth"><i></i>File chỉ được xem trên thiết bị hiện tại. Project chỉ lưu tên, loại và dung lượng, không giả lập upload.</p>
      </aside>
      <section class="hhcp__panel hhcp__board-shell">
        <header><div><span>Canvas board</span><h3>Kéo thả để sắp xếp ý tưởng</h3></div><div><button type="button" data-hhcp-action="convert-concept">Chuyển thành concept</button><button type="button" data-hhcp-action="clear-filter">Hiện tất cả</button></div></header>
        <div class="hhcp__board" data-hhcp-board tabindex="0" aria-label="Moodboard, có thể thả file tại đây">
          ${board.items.length ? board.items.map((item, index) => `<article class="hhcp__mood-card" draggable="true" data-hhcp-card="${item.id}" data-group="${item.groupId}" tabindex="0" style="--x:${item.x}%;--y:${item.y}%">
            <div class="hhcp__card-media">${moodPreview(item, runtime.urls.get(item.id))}</div>
            <header><span>${escapeHtml(item.type)}</span><strong>${escapeHtml(item.title)}</strong></header>
            <select data-hhcp-card-group="${item.id}" aria-label="Nhóm của ${escapeHtml(item.title)}">${board.groups.map((group) => `<option value="${group.id}" ${group.id === item.groupId ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("")}</select>
            <div class="hhcp__card-actions"><button type="button" data-hhcp-vote="${item.id}">♥ ${item.votes}</button><button type="button" data-hhcp-comment="${item.id}">Bình luận ${item.comments.length}</button><button type="button" data-hhcp-move="${item.id}" data-delta="-1" aria-label="Đưa lên">↑</button><button type="button" data-hhcp-move="${item.id}" data-delta="1" aria-label="Đưa xuống">↓</button><button type="button" data-hhcp-remove-card="${item.id}" aria-label="Xóa">×</button></div>
          </article>`).join("") : `<div class="hhcp__empty"><strong>Thả ảnh, video hoặc audio vào đây</strong><span>Hoặc tạo note, màu và font từ bảng công cụ.</span></div>`}
        </div>
      </section>
    </div>`;
  }

  function storyboardMarkup(project) {
    const story = project.storyboard;
    return `<div class="hhcp__story-layout">
      <section class="hhcp__panel hhcp__story-list">
        <header><div><span>Shot list</span><h3>${story.scenes.length} cảnh · ${formatDuration(totalDuration(story))}</h3></div><button type="button" class="hhcp__primary" data-hhcp-action="add-scene">+ Cảnh</button></header>
        <div class="hhcp__story-settings"><label>Tên storyboard<input data-hhcp-story-meta="title" value="${escapeHtml(story.title)}" maxlength="120"></label><label>Tỉ lệ<select data-hhcp-story-meta="aspectRatio">${["16:9", "9:16", "1:1", "4:5"].map((item) => `<option ${item === story.aspectRatio ? "selected" : ""}>${item}</option>`).join("")}</select></label><label>FPS<input type="number" min="12" max="60" data-hhcp-story-meta="frameRate" value="${story.frameRate}"></label></div>
        <div class="hhcp__scenes">${story.scenes.length ? story.scenes.map((scene, index) => `<article class="hhcp__scene" draggable="true" data-hhcp-scene="${scene.id}">
          <button class="hhcp__scene-index" type="button" data-hhcp-select-scene="${scene.id}" aria-label="Xem cảnh ${index + 1}">${String(index + 1).padStart(2, "0")}</button>
          <div class="hhcp__scene-fields">
            <label>Tiêu đề<input data-hhcp-scene-field="title" data-id="${scene.id}" value="${escapeHtml(scene.title)}" maxlength="120"></label>
            <label>Shot<input data-hhcp-scene-field="shot" data-id="${scene.id}" value="${escapeHtml(scene.shot)}" maxlength="100"></label>
            <label>Thời lượng<input type="number" min="0.5" max="600" step="0.5" data-hhcp-scene-field="duration" data-id="${scene.id}" value="${scene.duration}"></label>
            <label>Camera<input data-hhcp-scene-field="camera" data-id="${scene.id}" value="${escapeHtml(scene.camera)}" maxlength="120"></label>
            <label>Chuyển động<input data-hhcp-scene-field="movement" data-id="${scene.id}" value="${escapeHtml(scene.movement)}" maxlength="120"></label>
            <label>Âm thanh<input data-hhcp-scene-field="audio" data-id="${scene.id}" value="${escapeHtml(scene.audio)}" maxlength="400"></label>
            <label class="is-wide">Lời thoại<textarea rows="2" data-hhcp-scene-field="dialogue" data-id="${scene.id}" maxlength="1600">${escapeHtml(scene.dialogue)}</textarea></label>
          </div>
          <div class="hhcp__scene-actions"><button type="button" data-hhcp-move-scene="${scene.id}" data-delta="-1">↑</button><button type="button" data-hhcp-move-scene="${scene.id}" data-delta="1">↓</button><button type="button" data-hhcp-remove-scene="${scene.id}">Xóa</button></div>
        </article>`).join("") : `<div class="hhcp__empty"><strong>Storyboard chưa có cảnh</strong><span>Thêm cảnh đầu tiên để bắt đầu shot list.</span></div>`}</div>
      </section>
      <aside class="hhcp__panel hhcp__animatic">
        <header><div><span>Canvas2D animatic</span><h3>Xem nhịp dựng</h3></div><button type="button" data-hhcp-action="send-video">Gửi sang Video Editor</button></header>
        <canvas width="960" height="540" data-hhcp-animatic aria-label="Khung xem animatic"></canvas>
        <div class="hhcp__transport"><button type="button" data-hhcp-action="animatic-prev">◀</button><button type="button" class="hhcp__primary" data-hhcp-action="animatic-play">Phát</button><button type="button" data-hhcp-action="animatic-stop">Dừng</button><button type="button" data-hhcp-action="animatic-next">▶</button><span data-hhcp-time>00:00 / ${formatDuration(totalDuration(story))}</span></div>
      </aside>
    </div>`;
  }

  function bibleMarkup(project, runtime) {
    const audit = auditConsistency(project.worldBible);
    const results = searchBible(project.worldBible, runtime.bibleQuery, runtime.bibleType);
    return `<div class="hhcp__bible-layout">
      <aside class="hhcp__panel hhcp__bible-sidebar">
        <header><div><span>Continuity database</span><h3>Thế giới dự án</h3></div><b class="hhcp__score">${audit.score}</b></header>
        <label>Tìm kiếm<input type="search" data-hhcp-bible-search value="${escapeHtml(runtime.bibleQuery)}" placeholder="Tên, đặc điểm, quy tắc..."></label>
        <div class="hhcp__type-filter"><button type="button" data-hhcp-bible-type="all" class="${runtime.bibleType === "all" ? "is-active" : ""}">Tất cả</button>${BIBLE_TYPES.map((type) => `<button type="button" data-hhcp-bible-type="${type}" class="${runtime.bibleType === type ? "is-active" : ""}">${type}</button>`).join("")}</div>
        <form data-hhcp-bible-form>
          <label>Loại<select name="type">${BIBLE_TYPES.map((type) => `<option>${type}</option>`).join("")}</select></label>
          <label>Tên<input name="name" required maxlength="120"></label>
          <label>Mô tả<textarea name="summary" rows="3" maxlength="1200"></textarea></label>
          <label>Đặc điểm<input name="traits" placeholder="ngăn cách bằng dấu phẩy"></label>
          <label>Liên kết<input name="relations" placeholder="tên mục liên quan"></label>
          <label>Màu<input name="palette" placeholder="#62D7E7, #F05CAF"></label>
          <label>Giọng nói<input name="voice" maxlength="240"></label>
          <label>Quy tắc<input name="rules" placeholder="điều luôn phải giữ"></label>
          <button type="submit" class="hhcp__primary">Thêm vào bible</button>
        </form>
      </aside>
      <main class="hhcp__panel hhcp__bible-main">
        <header><div><span>${results.length} mục phù hợp</span><h3>Character & World Bible</h3></div><button type="button" data-hhcp-action="run-audit">Kiểm tra nhất quán</button></header>
        <div class="hhcp__bible-cards">${results.length ? results.map((entry) => `<article data-hhcp-bible-entry="${entry.id}">
          <header><span>${escapeHtml(entry.type)}</span><h4>${escapeHtml(entry.name)}</h4><button type="button" data-hhcp-remove-entry="${entry.id}" aria-label="Xóa ${escapeHtml(entry.name)}">×</button></header>
          <p>${escapeHtml(entry.summary || "Chưa có mô tả.")}</p>
          ${entry.palette.length ? `<div class="hhcp__palette">${entry.palette.map((color) => `<i style="--color:${color}" title="${color}"></i>`).join("")}</div>` : ""}
          <div class="hhcp__chips">${entry.traits.map((trait) => `<span>${escapeHtml(trait)}</span>`).join("")}</div>
          ${entry.voice ? `<small>Giọng: ${escapeHtml(entry.voice)}</small>` : ""}
          ${entry.relations.length ? `<small>Liên kết: ${escapeHtml(entry.relations.join(", "))}</small>` : ""}
        </article>`).join("") : `<div class="hhcp__empty"><strong>Không có mục phù hợp</strong><span>Thử từ khóa khác hoặc thêm mục mới.</span></div>`}</div>
        <section class="hhcp__audit" data-hhcp-audit><header><strong>Consistency audit</strong><span>${audit.passed ? "Không có lỗi nghiêm trọng" : "Cần xử lý lỗi trùng lặp"}</span></header>${audit.issues.length ? `<ul>${audit.issues.slice(0, 20).map((issue) => `<li class="is-${issue.level}">${escapeHtml(issue.message)}</li>`).join("")}</ul>` : `<p>Dữ liệu hiện tại nhất quán. Thêm reference và quy tắc khi dự án mở rộng.</p>`}</section>
      </main>
    </div>`;
  }

  function resolveRoot(target) {
    if (target && typeof target === "object" && typeof target.querySelector === "function") return target;
    if (typeof target === "string" && globalScope.document) return globalScope.document.querySelector(target);
    return null;
  }

  function mount(target, options) {
    const root = resolveRoot(target);
    if (!root || !globalScope.document) return null;
    unmount(root);
    const config = options && typeof options === "object" ? options : {};
    const storage = config.storage || globalScope.localStorage || null;
    const adapter = createStoreAdapter(config.store, storage);
    let project = adapter.getProject();
    let view = VIEWS.includes(config.view) ? config.view : "brief";
    const runtime = {
      urls: new Map(),
      timers: new Set(),
      dragId: "",
      filterGroup: "all",
      selectedSceneId: "",
      animaticIndex: 0,
      bibleQuery: "",
      bibleType: "all",
      commentItemId: "",
      destroyed: false
    };

    const status = (message) => {
      const node = root.querySelector("[data-hhcp-status]");
      if (node) node.textContent = cleanText(message, 240);
    };

    const persist = (message) => {
      const result = adapter.updateProject(project);
      project = result.project;
      if (message) status(message);
      return result;
    };

    const renderAnimatic = () => {
      const canvas = root.querySelector("[data-hhcp-animatic]");
      if (!canvas || typeof canvas.getContext !== "function") return;
      const context = canvas.getContext("2d");
      if (!context) return;
      const frames = buildAnimaticFrames(project.storyboard);
      const frame = frames[Math.max(0, Math.min(frames.length - 1, runtime.animaticIndex))];
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = frame?.color || "#111827";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "rgba(3, 7, 18, .64)";
      context.fillRect(50, 44, canvas.width - 100, canvas.height - 88);
      context.fillStyle = "#FFFFFF";
      context.font = "700 46px system-ui";
      context.fillText(frame ? `${String(frame.index + 1).padStart(2, "0")} · ${frame.title}` : "Chưa có cảnh", 90, 130);
      context.font = "500 25px system-ui";
      const lines = [frame?.shot, frame?.camera, frame?.movement, frame?.dialogue].filter(Boolean);
      lines.forEach((line, index) => context.fillText(cleanText(line, 70), 90, 200 + index * 54));
      context.font = "600 20px system-ui";
      context.fillStyle = "#BAF7FF";
      context.fillText(frame ? `${formatDuration(frame.start)} - ${formatDuration(frame.end)} · ${frame.audio || "không có audio"}` : "Thêm cảnh để xem animatic", 90, canvas.height - 76);
      const time = root.querySelector("[data-hhcp-time]");
      if (time) time.textContent = `${formatDuration(frame?.start || 0)} / ${formatDuration(totalDuration(project.storyboard))}`;
    };

    const render = () => {
      if (runtime.destroyed) return;
      let body = "";
      if (view === "brief") body = briefMarkup(project);
      if (view === "moodboard") body = moodboardMarkup(project, runtime);
      if (view === "storyboard") body = storyboardMarkup(project);
      if (view === "world-bible") body = bibleMarkup(project, runtime);
      root.innerHTML = shellMarkup(view, project, body);
      root.setAttribute("data-creative-preproduction", "");
      root.setAttribute("aria-label", `${viewLabel(view)} workspace`);
      if (view === "moodboard" && runtime.filterGroup !== "all") {
        root.querySelectorAll("[data-hhcp-card]").forEach((card) => { card.hidden = card.dataset.group !== runtime.filterGroup; });
      }
      if (view === "storyboard") renderAnimatic();
      status(adapter.external ? "Đã kết nối Universal Creative Project." : "Đang lưu cục bộ trên thiết bị này.");
    };

    const updateBriefFromControls = () => {
      const values = {};
      root.querySelectorAll("[data-hhcp-brief]").forEach((control) => { values[control.name] = control.value; });
      project.brief = normalizeBrief({ ...project.brief, ...values });
    };

    const addFiles = (fileList) => {
      const files = [...(fileList || [])].slice(0, Math.max(0, LIMITS.cards - project.moodboard.items.length));
      let added = 0;
      files.forEach((file) => {
        if (!file || file.size > LIMITS.fileSize || !/^(image|video|audio)\//.test(file.type || "")) return;
        const type = file.type.split("/")[0];
        const item = normalizeMoodItem({ id: safeId("", ""), type, title: file.name, file, groupId: "inbox", createdAt: new Date().toISOString() }, project.moodboard.items.length);
        if (globalScope.URL?.createObjectURL) {
          const url = globalScope.URL.createObjectURL(file);
          runtime.urls.set(item.id, url);
        }
        project.moodboard.items.push(item);
        added += 1;
      });
      project.moodboard = normalizeMoodboard(project.moodboard);
      persist(`${added} file đã được thêm cục bộ; chỉ metadata được lưu.`);
      render();
    };

    const stopAnimatic = () => {
      runtime.timers.forEach((timer) => globalScope.clearTimeout(timer));
      runtime.timers.clear();
    };

    const playAnimatic = () => {
      stopAnimatic();
      const frames = buildAnimaticFrames(project.storyboard);
      if (!frames.length) return status("Thêm ít nhất một cảnh trước khi phát animatic.");
      const advance = () => {
        if (runtime.animaticIndex >= frames.length) runtime.animaticIndex = 0;
        renderAnimatic();
        const wait = Math.min(12000, Math.max(500, frames[runtime.animaticIndex].duration * 1000));
        const timer = globalScope.setTimeout(() => {
          runtime.timers.delete(timer);
          runtime.animaticIndex += 1;
          if (runtime.animaticIndex < frames.length) advance(); else { runtime.animaticIndex = 0; renderAnimatic(); }
        }, wait);
        runtime.timers.add(timer);
      };
      advance();
      status("Animatic đang phát theo thời lượng cảnh.");
    };

    const navigate = (destination, payload) => {
      if (typeof config.onNavigate !== "function") return status("Chưa có callback Video Editor. Dữ liệu vẫn được lưu trong project.");
      config.onNavigate(destination, clone(payload));
      status("Đã chuyển storyboard sang Video Editor.");
    };

    const onClick = async (event) => {
      const viewButton = event.target.closest("[data-hhcp-view-button]");
      if (viewButton) { view = viewButton.dataset.hhcpViewButton; render(); return; }
      const action = event.target.closest("[data-hhcp-action]")?.dataset.hhcpAction;
      if (action === "copy-brief") {
        const text = [project.brief.persona, project.brief.message, project.brief.tone, project.brief.cta, project.brief.format, ...project.brief.contentPlan].filter(Boolean).join("\n\n");
        try { await globalScope.navigator?.clipboard?.writeText(text); status("Đã sao chép creative brief."); } catch (_) { status("Clipboard chưa được cấp quyền. Bạn vẫn có thể chọn và sao chép nội dung."); }
        return;
      }
      if (action === "close-comment") {
        const dialog = root.querySelector("[data-hhcp-comment-dialog]");
        if (typeof dialog?.close === "function") dialog.close(); else dialog?.removeAttribute("open");
        runtime.commentItemId = "";
        return;
      }
      if (action === "clear-filter") { runtime.filterGroup = "all"; render(); return; }
      if (action === "convert-concept") {
        const group = project.moodboard.groups.find((item) => item.id === runtime.filterGroup) || project.moodboard.groups[0];
        const itemIds = project.moodboard.items.filter((item) => runtime.filterGroup === "all" || item.groupId === runtime.filterGroup).map((item) => item.id);
        if (!itemIds.length) return status("Concept cần ít nhất một card.");
        project.moodboard.concepts.unshift({ id: safeId("", ""), name: `${group.name} · ${new Date().toLocaleDateString("vi-VN")}`, groupId: group.id, itemIds, createdAt: new Date().toISOString() });
        project.moodboard.concepts = project.moodboard.concepts.slice(0, 40);
        persist("Đã đóng gói concept vào Universal Creative Project.");
        return;
      }
      if (action === "add-scene") {
        project.storyboard.scenes.push(normalizeScene({ id: safeId("", ""), title: `Cảnh ${project.storyboard.scenes.length + 1}` }, project.storyboard.scenes.length));
        persist("Đã thêm cảnh mới."); render(); return;
      }
      if (action === "animatic-play") return playAnimatic();
      if (action === "animatic-stop") { stopAnimatic(); status("Đã dừng animatic."); return; }
      if (action === "animatic-prev" || action === "animatic-next") {
        const count = project.storyboard.scenes.length;
        if (!count) return;
        runtime.animaticIndex = (runtime.animaticIndex + (action === "animatic-next" ? 1 : -1) + count) % count;
        renderAnimatic(); return;
      }
      if (action === "send-video") return navigate("video-editor", { projectId: project.id, storyboard: project.storyboard, source: FORMAT });
      if (action === "run-audit") { render(); status(`Kiểm tra xong: điểm nhất quán ${auditConsistency(project.worldBible).score}/100.`); return; }

      const addCard = event.target.closest("[data-hhcp-add-card]");
      if (addCard) {
        const type = addCard.dataset.hhcpAddCard;
        const defaults = { note: "Ghi lại cảm giác, thông điệp hoặc chi tiết cần giữ.", color: "#EC4899", font: "Inter" };
        project.moodboard.items.push(normalizeMoodItem({ id: safeId("", ""), type, title: `Thẻ ${type}`, content: defaults[type], groupId: "inbox", createdAt: new Date().toISOString() }, project.moodboard.items.length));
        project.moodboard = normalizeMoodboard(project.moodboard); persist(`Đã thêm ${type}.`); render(); return;
      }
      const filterGroup = event.target.closest("[data-hhcp-filter-group]");
      if (filterGroup) { runtime.filterGroup = filterGroup.dataset.hhcpFilterGroup; render(); return; }
      const vote = event.target.closest("[data-hhcp-vote]");
      if (vote) { const item = project.moodboard.items.find((entry) => entry.id === vote.dataset.hhcpVote); if (item) item.votes = Math.min(999999, item.votes + 1); persist("Đã ghi nhận bình chọn trên thiết bị này."); render(); return; }
      const comment = event.target.closest("[data-hhcp-comment]");
      if (comment) {
        runtime.commentItemId = comment.dataset.hhcpComment;
        const dialog = root.querySelector("[data-hhcp-comment-dialog]");
        if (dialog?.showModal) dialog.showModal(); else dialog?.setAttribute("open", "");
        dialog?.querySelector("textarea")?.focus();
        return;
      }
      const moveCard = event.target.closest("[data-hhcp-move]");
      if (moveCard) { project.moodboard.items = moveByDelta(project.moodboard.items, moveCard.dataset.hhcpMove, Number(moveCard.dataset.delta)); persist("Đã đổi thứ tự card."); render(); return; }
      const removeCard = event.target.closest("[data-hhcp-remove-card]");
      if (removeCard) {
        const id = removeCard.dataset.hhcpRemoveCard;
        const url = runtime.urls.get(id);
        if (url && globalScope.URL?.revokeObjectURL) globalScope.URL.revokeObjectURL(url);
        runtime.urls.delete(id);
        project.moodboard.items = project.moodboard.items.filter((item) => item.id !== id);
        persist("Đã xóa card và thu hồi media tạm."); render(); return;
      }
      const moveScene = event.target.closest("[data-hhcp-move-scene]");
      if (moveScene) { project.storyboard.scenes = moveByDelta(project.storyboard.scenes, moveScene.dataset.hhcpMoveScene, Number(moveScene.dataset.delta)); persist("Đã đổi thứ tự cảnh."); render(); return; }
      const removeScene = event.target.closest("[data-hhcp-remove-scene]");
      if (removeScene) { project.storyboard.scenes = project.storyboard.scenes.filter((scene) => scene.id !== removeScene.dataset.hhcpRemoveScene); runtime.animaticIndex = 0; persist("Đã xóa cảnh."); render(); return; }
      const selectScene = event.target.closest("[data-hhcp-select-scene]");
      if (selectScene) { runtime.animaticIndex = Math.max(0, project.storyboard.scenes.findIndex((scene) => scene.id === selectScene.dataset.hhcpSelectScene)); renderAnimatic(); return; }
      const bibleType = event.target.closest("[data-hhcp-bible-type]");
      if (bibleType) { runtime.bibleType = bibleType.dataset.hhcpBibleType; render(); return; }
      const removeEntry = event.target.closest("[data-hhcp-remove-entry]");
      if (removeEntry) { project.worldBible.entries = project.worldBible.entries.filter((entry) => entry.id !== removeEntry.dataset.hhcpRemoveEntry); persist("Đã xóa mục khỏi World Bible."); render(); }
    };

    const onSubmit = (event) => {
      if (event.target.matches("[data-hhcp-comment-form]")) {
        event.preventDefault();
        const data = new globalScope.FormData(event.target);
        const text = cleanText(data.get("comment"), 600);
        const item = project.moodboard.items.find((entry) => entry.id === runtime.commentItemId);
        if (text && item) item.comments.push(normalizeComment({ id: safeId("", ""), author: "Bạn", text, createdAt: new Date().toISOString() }, item.comments.length));
        runtime.commentItemId = "";
        const dialog = root.querySelector("[data-hhcp-comment-dialog]");
        if (typeof dialog?.close === "function") dialog.close(); else dialog?.removeAttribute("open");
        if (text && item) { persist("Đã thêm bình luận."); render(); }
        return;
      }
      if (event.target.matches("[data-hhcp-brief-form]")) {
        event.preventDefault(); updateBriefFromControls(); project.brief = generateBrief(project.brief); persist("Đã tạo brief quyết định theo dữ liệu đầu vào."); render(); return;
      }
      if (event.target.matches("[data-hhcp-group-form]")) {
        event.preventDefault(); const data = new globalScope.FormData(event.target); const name = cleanText(data.get("name"), 80);
        if (!name || project.moodboard.groups.length >= LIMITS.groups) return status("Không thể tạo thêm nhóm.");
        project.moodboard.groups.push({ id: safeId(name, ""), name, color: ["#62D7E7", "#F05CAF", "#C7F36B", "#F9C74F"][project.moodboard.groups.length % 4] });
        project.moodboard = normalizeMoodboard(project.moodboard); persist("Đã tạo nhóm concept."); render(); return;
      }
      if (event.target.matches("[data-hhcp-bible-form]")) {
        event.preventDefault(); const values = Object.fromEntries(new globalScope.FormData(event.target));
        project.worldBible.entries.unshift(normalizeBibleEntry({ ...values, id: safeId("", ""), updatedAt: new Date().toISOString() }, project.worldBible.entries.length));
        project.worldBible = normalizeWorldBible(project.worldBible); persist("Đã thêm mục vào World Bible."); render();
      }
    };

    const onInput = (event) => {
      const targetNode = event.target;
      if (targetNode.matches("[data-hhcp-brief]")) { updateBriefFromControls(); persist("Đã tự lưu brief."); return; }
      if (targetNode.dataset.hhcpStoryMeta) { project.storyboard[targetNode.dataset.hhcpStoryMeta] = targetNode.value; project.storyboard = normalizeStoryboard(project.storyboard); persist("Đã tự lưu thiết lập storyboard."); return; }
      if (targetNode.dataset.hhcpSceneField) {
        const scene = project.storyboard.scenes.find((item) => item.id === targetNode.dataset.id);
        if (scene) { scene[targetNode.dataset.hhcpSceneField] = targetNode.value; project.storyboard = normalizeStoryboard(project.storyboard); persist("Đã tự lưu cảnh."); renderAnimatic(); }
        return;
      }
      if (targetNode.matches("[data-hhcp-bible-search]")) {
        runtime.bibleQuery = targetNode.value;
        const cursor = targetNode.selectionStart;
        render();
        const nextSearch = root.querySelector("[data-hhcp-bible-search]");
        nextSearch?.focus();
        if (Number.isFinite(cursor)) nextSearch?.setSelectionRange(cursor, cursor);
      }
    };

    const onChange = (event) => {
      const targetNode = event.target;
      if (targetNode.matches("[data-hhcp-files]")) { addFiles(targetNode.files); return; }
      if (targetNode.dataset.hhcpCardGroup) {
        const item = project.moodboard.items.find((entry) => entry.id === targetNode.dataset.hhcpCardGroup);
        if (item) item.groupId = targetNode.value;
        project.moodboard = normalizeMoodboard(project.moodboard); persist("Đã chuyển card sang nhóm mới."); render();
      }
    };

    const onDragStart = (event) => {
      const card = event.target.closest?.("[data-hhcp-card], [data-hhcp-scene]");
      if (!card) return;
      runtime.dragId = card.dataset.hhcpCard || card.dataset.hhcpScene;
      event.dataTransfer?.setData("text/plain", runtime.dragId);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    };

    const onDragOver = (event) => {
      if (event.target.closest?.("[data-hhcp-board], [data-hhcp-card], [data-hhcp-scene]")) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = event.dataTransfer.files?.length ? "copy" : "move";
      }
    };

    const onDrop = (event) => {
      const board = event.target.closest?.("[data-hhcp-board]");
      if (board && event.dataTransfer?.files?.length) { event.preventDefault(); addFiles(event.dataTransfer.files); return; }
      const targetCard = event.target.closest?.("[data-hhcp-card]");
      if (targetCard && runtime.dragId) { event.preventDefault(); project.moodboard.items = reorderById(project.moodboard.items, runtime.dragId, targetCard.dataset.hhcpCard, "before"); persist("Đã sắp xếp lại moodboard."); render(); return; }
      const targetScene = event.target.closest?.("[data-hhcp-scene]");
      if (targetScene && runtime.dragId) { event.preventDefault(); project.storyboard.scenes = reorderById(project.storyboard.scenes, runtime.dragId, targetScene.dataset.hhcpScene, "before"); persist("Đã sắp xếp lại storyboard."); render(); }
    };

    const onKeydown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); persist("Đã lưu project."); }
      const card = event.target.closest?.("[data-hhcp-card]");
      if (card && event.altKey && ["ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault(); project.moodboard.items = moveByDelta(project.moodboard.items, card.dataset.hhcpCard, event.key === "ArrowUp" ? -1 : 1); persist("Đã đổi thứ tự card bằng bàn phím."); render();
      }
    };

    root.addEventListener("click", onClick);
    root.addEventListener("submit", onSubmit);
    root.addEventListener("input", onInput);
    root.addEventListener("change", onChange);
    root.addEventListener("dragstart", onDragStart);
    root.addEventListener("dragover", onDragOver);
    root.addEventListener("drop", onDrop);
    root.addEventListener("keydown", onKeydown);
    const unsubscribe = adapter.subscribe(() => {
      if (runtime.destroyed) return;
      project = adapter.getProject();
      render();
    });
    render();

    const cleanup = () => {
      runtime.destroyed = true;
      stopAnimatic();
      runtime.urls.forEach((url) => { if (globalScope.URL?.revokeObjectURL) globalScope.URL.revokeObjectURL(url); });
      runtime.urls.clear();
      unsubscribe();
      root.removeEventListener("click", onClick);
      root.removeEventListener("submit", onSubmit);
      root.removeEventListener("input", onInput);
      root.removeEventListener("change", onChange);
      root.removeEventListener("dragstart", onDragStart);
      root.removeEventListener("dragover", onDragOver);
      root.removeEventListener("drop", onDrop);
      root.removeEventListener("keydown", onKeydown);
    };
    const controller = Object.freeze({
      getProject: () => clone(project),
      setProject(next) { project = normalizeProject(next); persist("Đã nạp project."); render(); },
      getView: () => view,
      setView(next) { if (!VIEWS.includes(next)) return false; view = next; render(); return true; },
      render,
      save: () => persist("Đã lưu project."),
      unmount: () => unmount(root)
    });
    mountedRoots.set(root, { cleanup, controller });
    return controller;
  }

  function unmount(target) {
    const root = resolveRoot(target);
    const mounted = root && mountedRoots.get(root);
    if (!mounted) return false;
    mounted.cleanup();
    mountedRoots.delete(root);
    root.removeAttribute("data-creative-preproduction");
    root.removeAttribute("aria-label");
    root.replaceChildren();
    return true;
  }

  const api = Object.freeze({
    VERSION, FORMAT, STORAGE_KEY, VIEWS, CARD_TYPES, BIBLE_TYPES, LIMITS,
    escapeHtml, cleanText, safeId, safeColor, hashSeed,
    normalizeBrief, generateBrief, normalizeFileMetadata, normalizeMoodItem, normalizeMoodboard,
    reorderById, moveByDelta, normalizeScene, normalizeStoryboard, totalDuration, buildAnimaticFrames,
    normalizeBibleEntry, normalizeWorldBible, auditConsistency, searchBible,
    createDefaultProject, normalizeProject, projectFromStoreState, saveLocal, loadLocal, createStoreAdapter,
    mount, unmount
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.HHCreativePreproduction = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
