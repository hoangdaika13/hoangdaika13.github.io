(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const VERSION = "3.0.0";
  const SCHEMA_VERSION = 3;
  const MAX_MISTAKES = 500;
  const esc = (value = "") => String(value).replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" })[char]);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));
  const iso = (value = Date.now()) => new Date(value).toISOString();
  const normalizeText = (value = "") => String(value).trim().toLocaleLowerCase("en-US").replace(/[.!?,;:]/g, "").replace(/\s+/g, " ");

  const mainNavigation = Object.freeze([
    ["dashboard", "☉", "Hôm nay"],
    ["pathways", "⌁", "Lộ trình"],
    ["practice-hub", "✦", "Luyện tập"],
    ["explore", "⌕", "Khám phá"],
    ["progress", "↗", "Tiến độ"]
  ]);

  const sessionModes = Object.freeze([
    { id: "quick", minutes: 5, label: "Học nhanh", detail: "Một việc quan trọng nhất" },
    { id: "standard", minutes: 15, label: "Bài chuẩn", detail: "Nhiệm vụ + ôn tập" },
    { id: "focus", minutes: 30, label: "Tập trung", detail: "Bài học và luyện chủ động" }
  ]);

  const pathways = Object.freeze([
    { id: "foundation", icon: "Aa", title: "Foundation", vi: "Nền tảng", detail: "Từ vựng cốt lõi, ngữ pháp, phát âm và collocation.", color: "#63e8ff", view: "learn" },
    { id: "communication", icon: "◉", title: "Communication", vi: "Giao tiếp", detail: "Nghe, nói, hội thoại, shadowing và phản xạ câu.", color: "#ff77cf", view: "listening" },
    { id: "academic", icon: "A+", title: "Academic & Exams", vi: "Học thuật và thi cử", detail: "Đọc, viết và chiến lược làm bài theo dữ liệu đã xác minh.", color: "#ffe66d", view: "practice" },
    { id: "career", icon: "▦", title: "Life & Career", vi: "Đời sống và nghề nghiệp", detail: "70 lộ trình nghề cùng các tình huống dùng tiếng Anh thật.", color: "#80f4b4", view: "career" }
  ]);

  const tools = Object.freeze([
    { id: "dictionary", icon: "Aa", title: "Từ điển & từ đã lưu", detail: "Tra nghĩa đã kiểm duyệt, IPA, ví dụ và SRS.", view: "galaxy" },
    { id: "grammar", icon: "✓", title: "Grammar & Usage", detail: "Cấu trúc, cách dùng và giải thích theo ngữ cảnh.", view: "practice" },
    { id: "pronunciation", icon: "◉", title: "Phát âm & Shadowing", detail: "Nghe mẫu, ghi âm và đối chiếu transcript.", view: "speaking" },
    { id: "writing", icon: "✎", title: "Writing Coach", detail: "Viết câu, đoạn, email và lưu phiên bản.", view: "writing" },
    { id: "reader", icon: "▤", title: "Smart Reader", detail: "Đọc n+1, tra từ và sentence mining.", view: "reading" },
    { id: "listener", icon: "◖", title: "Listening Lab", detail: "Nghe theo câu, chép chính tả và kiểm tra ý.", view: "listening" },
    { id: "mistakes", icon: "!", title: "Sổ lỗi", detail: "Sửa lỗi lặp lại bằng Error Clinic ngắn.", view: "mistakes" },
    { id: "profile", icon: "◎", title: "Hồ sơ người học", detail: "Độ tuổi, mục tiêu, accent và hỗ trợ.", view: "everyone" },
    { id: "settings", icon: "⚙", title: "Cài đặt & dữ liệu", detail: "Quyền âm thanh, nhập/xuất và giao diện.", view: "settings" }
  ]);

  const lessonSteps = Object.freeze([
    ["context", "Ngữ cảnh", "Hiểu mình sắp làm được gì"],
    ["listen", "Nghe lần đầu", "Nghe toàn cảnh, chưa cần hiểu từng từ"],
    ["gist", "Ý chính", "Kiểm tra điều quan trọng nhất"],
    ["vocabulary", "Từ & cụm", "Học lượng từ vừa đủ trong ngữ cảnh"],
    ["pattern", "Mẫu câu", "Nhận ra cấu trúc đang được sử dụng"],
    ["gap", "Điền từ", "Nhớ lại từ hoặc cấu trúc"],
    ["order", "Sắp xếp câu", "Khôi phục một câu tự nhiên"],
    ["shadow", "Shadowing", "Nghe theo cụm và nói lại"],
    ["recall", "Nhớ lại", "Tự viết lại không nhìn đáp án"],
    ["create", "Tạo câu mới", "Dùng kiến thức cho ý của bạn"],
    ["challenge", "Mini challenge", "Kiểm tra trong tình huống mới"],
    ["summary", "Tổng kết", "Lưu tiến độ, lỗi và lịch ôn"]
  ]);

  const defaults = () => ({
    learningOS: {
      schemaVersion: SCHEMA_VERSION,
      activePath: "foundation",
      sessionMode: "standard",
      lessonCheckpoints: {},
      mistakeRecords: [],
      reviewAttempts: [],
      skillEvidence: [],
      recentActivity: [],
      mistakeFilter: "all",
      sync: { status: "local", lastAttemptAt: "", lastSuccessAt: "", lastError: "", revision: 0 },
      migration: { legacyImportedAt: "", sourceVersion: 0 }
    },
    learnerProfileId: "default"
  });

  const mistakeKey = (item = {}) => normalizeText(`${item.type || item.mode || "general"}:${item.prompt || item.word || item.expected || ""}:${item.answer || ""}`);
  const normalizeMistake = (item = {}, index = 0) => ({
    id: String(item.id || `mistake-${index}-${Math.abs(hashText(mistakeKey(item)))}`),
    type: String(item.type || item.mode || "vocabulary").slice(0, 32),
    prompt: String(item.prompt || item.word || "Mục cần ôn lại").slice(0, 500),
    answer: String(item.answer || "").slice(0, 500),
    expected: String(item.expected || item.correctAnswer || "").slice(0, 500),
    explanation: String(item.explanation || "Hãy đối chiếu đáp án và thử lại trong ngữ cảnh mới.").slice(0, 1000),
    lessonId: String(item.lessonId || "").slice(0, 120),
    occurrences: clamp(item.occurrences || 1, 1, 999),
    status: item.status === "resolved" ? "resolved" : "open",
    createdAt: item.createdAt || iso(),
    lastSeenAt: item.lastSeenAt || item.createdAt || iso(),
    nextReviewAt: item.nextReviewAt || iso()
  });

  function hashText(value = "") {
    let hash = 2166136261;
    for (const char of String(value)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return hash | 0;
  }

  const normalizeState = (state = {}) => {
    const fallback = defaults();
    const source = state.learningOS || {};
    const legacy = Array.isArray(state.mistakeNotebook) ? state.mistakeNotebook : [];
    const rows = [...(Array.isArray(source.mistakeRecords) ? source.mistakeRecords : []), ...legacy]
      .map(normalizeMistake);
    const deduped = [];
    const seen = new Map();
    rows.forEach((row) => {
      const key = mistakeKey(row);
      const existing = seen.get(key);
      if (existing) { existing.occurrences += row.occurrences; existing.lastSeenAt = row.lastSeenAt > existing.lastSeenAt ? row.lastSeenAt : existing.lastSeenAt; }
      else { seen.set(key, row); deduped.push(row); }
    });
    state.learningOS = {
      ...fallback.learningOS,
      ...source,
      schemaVersion: SCHEMA_VERSION,
      activePath: pathways.some((item) => item.id === source.activePath) ? source.activePath : "foundation",
      sessionMode: sessionModes.some((item) => item.id === source.sessionMode) ? source.sessionMode : "standard",
      lessonCheckpoints: { ...(source.lessonCheckpoints || {}) },
      mistakeRecords: deduped.slice(0, MAX_MISTAKES),
      reviewAttempts: Array.isArray(source.reviewAttempts) ? source.reviewAttempts.slice(0, 1000) : [],
      skillEvidence: Array.isArray(source.skillEvidence) ? source.skillEvidence.slice(0, 1000) : [],
      recentActivity: Array.isArray(source.recentActivity) ? source.recentActivity.slice(0, 50) : [],
      sync: { ...fallback.learningOS.sync, ...(source.sync || {}) },
      migration: { ...fallback.learningOS.migration, ...(source.migration || {}), legacyImportedAt: source.migration?.legacyImportedAt || (legacy.length ? iso() : "") }
    };
    state.learnerProfileId = String(state.learnerProfileId || "default").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 72) || "default";
    return state;
  };

  const activeVocabularyStage = (record = {}) => {
    const attempts = Math.max(0, Number(record.attempts) || 0);
    const correct = Math.max(0, Number(record.correct) || 0);
    const production = Math.max(0, Number(record.productionSuccesses) || 0);
    const delayed = Math.max(0, Number(record.delayedRecalls) || 0);
    const score = clamp(record.score || 0, 0, 100);
    if (score >= 88 && attempts >= 4 && correct / Math.max(1, attempts) >= .75 && production >= 1 && delayed >= 1) return "active";
    if (score >= 55 && attempts >= 2) return "recall";
    if (attempts >= 1 || score > 0) return "recognition";
    return "new";
  };

  const vocabularyCounts = (state = {}) => Object.values(state.wordMastery || {}).reduce((totals, row) => {
    totals[activeVocabularyStage(row)] += 1;
    return totals;
  }, { new: 0, recognition: 0, recall: 0, active: 0 });

  const dueReviewItems = (state = {}, now = Date.now()) => Object.entries(state.reviewQueue || {})
    .filter(([, row]) => !row?.dueAt || Date.parse(row.dueAt) <= now)
    .map(([id, row]) => ({ id, type: row?.type || (state.savedWords?.[id] ? "word" : "review"), dueAt: row?.dueAt || "", record: row }))
    .slice(0, 100);

  const currentCheckpoint = (state, lessonId) => normalizeState(state).learningOS.lessonCheckpoints[lessonId] || { step: 0, completedSteps: [], skippedSteps: [], answers: {}, startedAt: iso(), updatedAt: iso() };
  const progressPercent = (checkpoint) => Math.round(new Set(checkpoint.completedSteps || []).size / lessonSteps.length * 100);

  const addActivity = (state, activity = {}) => {
    const os = normalizeState(state).learningOS;
    os.recentActivity.unshift({ id: activity.id || `activity-${Date.now()}`, kind: activity.kind || "learning", label: String(activity.label || "Hoạt động học tập").slice(0, 200), view: activity.view || "dashboard", lessonId: activity.lessonId || "", at: activity.at || iso() });
    os.recentActivity = os.recentActivity.slice(0, 50);
  };

  const recordMistake = (state, mistake) => {
    const os = normalizeState(state).learningOS;
    const row = normalizeMistake(mistake);
    const key = mistakeKey(row);
    const existing = os.mistakeRecords.find((item) => mistakeKey(item) === key);
    if (existing) { existing.occurrences += 1; existing.status = "open"; existing.lastSeenAt = iso(); existing.nextReviewAt = iso(); }
    else os.mistakeRecords.unshift(row);
    os.mistakeRecords = os.mistakeRecords.slice(0, MAX_MISTAKES);
    state.mistakeNotebook = os.mistakeRecords.map((item) => ({ id: item.id, word: item.prompt, mode: item.type, expected: item.expected, answer: item.answer, explanation: item.explanation, createdAt: item.createdAt }));
    return existing || row;
  };

  const session = (state) => sessionModes.find((item) => item.id === normalizeState(state).learningOS.sessionMode) || sessionModes[1];
  const openMistakes = (state) => normalizeState(state).learningOS.mistakeRecords.filter((item) => item.status !== "resolved");

  const todayModel = (state, context = {}) => {
    const level = context.selectedLevelId?.(state) || state.selectedLevel || "A0";
    const nextLesson = context.nextLessonFor?.(state, level) || context.allLessons?.find((item) => !state.completed?.[item.id]) || context.allLessons?.[0];
    const due = dueReviewItems(state);
    const mistakes = openMistakes(state).sort((a, b) => b.occurrences - a.occurrences || String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)));
    const recent = normalizeState(state).learningOS.recentActivity[0] || null;
    const listening = root.HHEnglishLearningGalaxy?.listeningLibrary?.[0];
    return { level, nextLesson, due, mistake: mistakes[0] || null, recent, listening, mode: session(state) };
  };

  const syncLabel = (state) => {
    const sync = normalizeState(state).learningOS.sync;
    if (sync.status === "syncing") return ["syncing", "Đang đồng bộ"];
    if (sync.status === "synced") return ["synced", "Đã đồng bộ"];
    if (sync.status === "failed") return ["failed", "Đã lưu cục bộ · chờ thử lại"];
    return ["local", "Đã lưu trên thiết bị"];
  };

  const renderToday = (state, context) => {
    const model = todayModel(state, context);
    const [syncTone, syncText] = syncLabel(state);
    const checkpoints = normalizeState(state).learningOS.lessonCheckpoints;
    const lessonCheckpoint = model.nextLesson ? checkpoints[model.nextLesson.id] : null;
    const lessonProgress = lessonCheckpoint ? progressPercent(lessonCheckpoint) : 0;
    const canDo = model.nextLesson?.canDo || "Hoàn thành một nhiệm vụ tiếng Anh phù hợp với trình độ hiện tại.";
    const dueTypes = model.due.reduce((result, item) => { result[item.type] = (result[item.type] || 0) + 1; return result; }, {});
    const dueSummary = Object.entries(dueTypes).slice(0, 3).map(([type, count]) => `${count} ${type}`).join(" · ") || "Không có thẻ quá hạn";
    const reason = model.mistake ? "Ưu tiên lỗi lặp lại và bài đang học dở." : model.due.length ? "Ưu tiên thẻ đến hạn rồi tiếp tục lộ trình." : "Tiếp tục bài chưa hoàn thành ở cấp hiện tại.";
    return `<section class="hheo-today" data-hheo-view="today">
      <header class="hheo-today-hero"><div><small>HH ENGLISH · DAILY LEARNING OS</small><h2>Hôm nay, chỉ cần hoàn thành<br><em>một việc tiếp theo.</em></h2><p>${esc(reason)} Kế hoạch được tính từ tiến độ đã lưu, không giả là đề xuất AI.</p></div><aside><span>${esc(model.level)}</span><strong>${model.mode.minutes} phút</strong><small>${esc(model.mode.label)} · ${esc(model.mode.detail)}</small><i class="${syncTone}"></i><em>${esc(syncText)}</em></aside></header>
      <nav class="hheo-session-modes" aria-label="Chọn thời lượng học">${sessionModes.map((item) => `<button type="button" class="${item.id === model.mode.id ? "active" : ""}" data-hheo-session-mode="${item.id}" aria-pressed="${item.id === model.mode.id}"><b>${item.minutes}</b><span><strong>${item.label}</strong><small>${item.detail}</small></span></button>`).join("")}</nav>
      <div class="hheo-today-grid">
        <article class="hheo-mission"><header><span>01</span><div><small>DAILY CAN-DO MISSION</small><h3>${esc(model.nextLesson?.title || "Bài học tiếp theo")}</h3></div><b>${lessonProgress}%</b></header><p>${esc(canDo)}</p><div><span>${esc(model.nextLesson?.primarySkill || "English")}</span><span>${model.nextLesson?.minutes || model.mode.minutes} phút</span><span>${model.nextLesson?.isCareer ? "Career" : model.level}</span></div>${model.nextLesson ? `<button class="primary" type="button" data-hhe-open-lesson="${esc(model.nextLesson.id)}">${lessonProgress ? "Tiếp tục đúng bước đang học" : "Bắt đầu nhiệm vụ"} →</button>` : ""}</article>
        <article class="hheo-due"><header><span>02</span><div><small>SRS ĐẾN HẠN</small><h3>${model.due.length} mục cần ôn</h3></div></header><p>${esc(dueSummary)}</p><div class="hheo-mini-meter"><i style="--p:${Math.min(100, model.due.length * 8)}%"></i></div><button type="button" data-hhe-view="vocabulary">${model.due.length ? "Ôn đúng mục đến hạn" : "Mở sổ từ"} →</button></article>
        <article class="hheo-input"><header><span>03</span><div><small>N+1 INPUT</small><h3>${esc(model.listening?.title || "Nghe và đọc ngắn")}</h3></div></header><p>${esc(model.listening?.description || "Nội dung ngắn phù hợp cấp hiện tại, có transcript và bài chép chính tả.")}</p><button type="button" data-hhe-view="listening">Mở bài nghe có hướng dẫn →</button></article>
        <article class="hheo-error ${model.mistake ? "has-error" : ""}"><header><span>04</span><div><small>MỘT LỖI CẦN SỬA</small><h3>${esc(model.mistake?.prompt || "Chưa có lỗi đang chờ")}</h3></div><b>${model.mistake?.occurrences || 0}×</b></header><p>${esc(model.mistake?.explanation || "Lỗi mới sẽ tự xuất hiện ở đây sau khi bạn luyện tập.")}</p><button type="button" data-hhe-view="mistakes">${model.mistake ? "Sửa lỗi trong ngữ cảnh mới" : "Mở Sổ lỗi"} →</button></article>
        <article class="hheo-recent"><header><span>05</span><div><small>TIẾP TỤC GẦN ĐÂY</small><h3>${esc(model.recent?.label || model.nextLesson?.title || "Chưa có phiên gần đây")}</h3></div></header><p>${model.recent?.at ? `Lưu lúc ${new Date(model.recent.at).toLocaleString("vi-VN")}.` : "HH sẽ lưu checkpoint sau từng bước học."}</p><button type="button" ${model.recent?.lessonId ? `data-hhe-open-lesson="${esc(model.recent.lessonId)}"` : `data-hhe-view="${esc(model.recent?.view || "learn")}"`}>Tiếp tục công việc →</button></article>
      </div>
      <footer class="hheo-why"><span>?</span><div><strong>Vì sao HH chọn kế hoạch này?</strong><p>${esc(reason)} Bạn luôn có thể đổi thời lượng hoặc chọn lộ trình khác.</p></div><button type="button" data-hhe-view="pathways">Đổi lộ trình</button></footer>
    </section>`;
  };

  const renderPathways = (state, context) => {
    const active = normalizeState(state).learningOS.activePath;
    return `<section class="hheo-pathways"><header><div><small>FOUR PARALLEL PATHS</small><h2>Bốn lộ trình, một tiến độ chung</h2><p>Học song song nhưng mỗi ngày HH chỉ ưu tiên một nhiệm vụ để bạn không bị rối.</p></div><button type="button" data-hhe-view="placement">Kiểm tra điểm bắt đầu</button></header><div>${pathways.map((item) => `<article class="${item.id === active ? "active" : ""}" style="--path:${item.color}"><i>${item.icon}</i><small>${item.title}</small><h3>${item.vi}</h3><p>${item.detail}</p><ul>${item.id === "foundation" ? "<li>69 bài CEFR A0–C2</li><li>Vocabulary + Grammar</li><li>Phát âm nền tảng</li>" : item.id === "communication" ? "<li>Listening theo câu</li><li>Role-play và shadowing</li><li>Phản xạ có ngữ cảnh</li>" : item.id === "academic" ? "<li>Reading & Writing</li><li>Practice theo cấp</li><li>Không tự gán điểm thi</li>" : "<li>70 lộ trình nghề</li><li>7 ngày mỗi chuyên ngành</li><li>Từ và hội thoại thực tế</li>"}</ul><footer><button type="button" data-hheo-select-path="${item.id}" data-view="${item.view}">${item.id === active ? "Đang ưu tiên" : "Chọn ưu tiên"}</button><button class="primary" type="button" data-hhe-view="${item.view}">Mở lộ trình →</button></footer></article>`).join("")}</div><footer><strong>Mọi cấp độ vẫn mở</strong><span>Kết quả xếp lớp chỉ là gợi ý, không khóa bài.</span><button type="button" data-hhe-view="learn">Xem CEFR ${esc(context.selectedLevelId?.(state) || state.selectedLevel || "A0")}</button></footer></section>`;
  };

  const renderPracticeHub = (state) => {
    const mistakes = openMistakes(state).length;
    const due = dueReviewItems(state).length;
    const practice = [
      ["listening", "◖", "Nghe hiểu", "Nghe theo câu, transcript và chép chính tả."],
      ["speaking", "◉", "Nói & phát âm", "Ghi âm khi bạn cho phép; phản hồi transcript minh bạch."],
      ["reading", "Aa", "Đọc hiểu", "Mở từng đoạn, tra từ và ghi chú."],
      ["writing", "✎", "Viết", "Lưu bản nháp theo cấp và giữ lịch sử."],
      ["practice", "✓", "Grammar & Usage", "Bài đúng/sai có đáp án và giải thích."],
      ["vocabulary", "◇", "Active Vocabulary", `${due} thẻ đến hạn · nhận biết, nhớ lại và dùng chủ động.`],
      ["mistakes", "!", "Error Clinic", `${mistakes} lỗi đang mở · ưu tiên lỗi lặp lại.`],
      ["lab", "✦", "16 chế độ luyện", "Flashcard, cloze, collocation, minimal pairs và hơn nữa."]
    ];
    return `<section class="hheo-practice-hub"><header><div><small>DELIBERATE PRACTICE</small><h2>Luyện đúng kỹ năng đang yếu</h2><p>Mỗi phòng luyện dùng chung SRS, vốn từ chủ động và Sổ lỗi của bạn.</p></div><div><span><b>${due}</b> đến hạn</span><span><b>${mistakes}</b> lỗi mở</span></div></header><div>${practice.map(([view, icon, title, detail]) => `<button type="button" data-hhe-view="${view}"><i>${icon}</i><span><strong>${title}</strong><small>${detail}</small></span><b>→</b></button>`).join("")}</div></section>`;
  };

  const renderExplore = (state) => `<section class="hheo-explore"><header><div><small>TOOLS, NOT DISTRACTIONS</small><h2>Công cụ được gom đúng chỗ</h2><p>Chọn một công cụ; HH mở đúng một workspace và giữ nguyên tiến độ đang học.</p></div><label><span>⌕</span><input type="search" data-hheo-tool-search placeholder="Tìm từ điển, phát âm, viết, dữ liệu..." autocomplete="off"></label></header><div data-hheo-tools>${tools.map((item) => `<button type="button" data-hhe-view="${item.view}" data-hheo-tool="${esc(normalizeText(`${item.title} ${item.detail}`))}"><i>${item.icon}</i><span><strong>${item.title}</strong><small>${item.detail}</small></span><b>→</b></button>`).join("")}</div><footer><span><i></i> Công cụ cốt lõi hoạt động cục bộ khi API ngoài gián đoạn.</span><button type="button" data-hheo-export="json">Xuất JSON</button><button type="button" data-hheo-export="csv">Xuất CSV</button><button type="button" data-hheo-print>In / lưu PDF</button></footer></section>`;

  const renderMistakes = (state) => {
    const os = normalizeState(state).learningOS;
    const filters = ["all", "grammar", "vocabulary", "listening", "pronunciation", "writing", "resolved"];
    const rows = os.mistakeRecords.filter((item) => os.mistakeFilter === "all" ? item.status !== "resolved" : os.mistakeFilter === "resolved" ? item.status === "resolved" : item.status !== "resolved" && item.type.includes(os.mistakeFilter)).sort((a, b) => b.occurrences - a.occurrences || String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)));
    const clinic = rows.filter((item) => item.status !== "resolved").slice(0, 5);
    return `<section class="hheo-mistakes"><header><div><small>MISTAKE NOTEBOOK · ERROR CLINIC</small><h2>Sửa đúng lỗi đang lặp lại</h2><p>Mỗi lỗi giữ câu trả lời cũ, đáp án, giải thích, số lần lặp và lịch ôn.</p></div><span><b>${openMistakes(state).length}</b> lỗi đang mở</span></header><nav>${filters.map((id) => `<button type="button" class="${os.mistakeFilter === id ? "active" : ""}" data-hheo-mistake-filter="${id}">${{ all: "Đang mở", grammar: "Ngữ pháp", vocabulary: "Từ vựng", listening: "Nghe", pronunciation: "Phát âm", writing: "Viết", resolved: "Đã sửa" }[id]}</button>`).join("")}</nav>${clinic.length ? `<section class="hheo-clinic"><header><span>5–10 phút</span><div><small>ERROR CLINIC HÔM NAY</small><h3>${clinic.length} lỗi ưu tiên theo số lần lặp</h3></div></header>${clinic.map((item, index) => `<article><b>${index + 1}</b><div><strong>${esc(item.prompt)}</strong><small>${esc(item.explanation)}</small></div><span>${item.occurrences}×</span><button type="button" data-hheo-resolve-mistake="${esc(item.id)}">Đánh dấu đã sửa</button></article>`).join("")}</section>` : `<div class="hheo-empty"><span>✓</span><h3>Không có lỗi trong bộ lọc này</h3><p>HH chỉ thêm lỗi từ hoạt động bạn đã thực hiện.</p><button type="button" data-hhe-view="practice-hub">Mở phòng luyện tập</button></div>`}<div class="hheo-mistake-list">${rows.map((item) => `<article class="${item.status}"><header><span>${esc(item.type)}</span><b>${item.occurrences} lần</b></header><h3>${esc(item.prompt)}</h3>${item.answer ? `<p><small>Bạn trả lời</small>${esc(item.answer)}</p>` : ""}${item.expected ? `<p class="expected"><small>Đáp án / phương án tự nhiên hơn</small>${esc(item.expected)}</p>` : ""}<blockquote>${esc(item.explanation)}</blockquote><footer><span>Lần gần nhất: ${new Date(item.lastSeenAt).toLocaleDateString("vi-VN")}</span>${item.status === "resolved" ? `<button type="button" data-hheo-reopen-mistake="${esc(item.id)}">Mở lại</button>` : `<button type="button" data-hheo-resolve-mistake="${esc(item.id)}">Đã sửa</button>`}</footer></article>`).join("")}</div></section>`;
  };

  const lessonLine = (lesson = {}) => String(lesson.dialogue || "").split("\n").map((line) => line.replace(/^[^:]{1,30}:\s*/, "").trim()).find(Boolean) || lesson.grammar || lesson.canDo || lesson.title || "English practice";
  const lessonVocabulary = (lesson = {}) => (Array.isArray(lesson.vocabulary) ? lesson.vocabulary : []).slice(0, 8);
  const lessonQuestion = (lesson = {}, index = 0) => (Array.isArray(lesson.exercises) ? lesson.exercises[index] || lesson.exercises[0] : null);

  const renderLessonTask = (state, lesson, checkpoint, stepIndex) => {
    const [stepId] = lessonSteps[stepIndex];
    const line = lessonLine(lesson);
    const words = lessonVocabulary(lesson);
    const question = lessonQuestion(lesson, stepId === "challenge" ? 1 : 0);
    if (stepId === "context") return `<div class="hheo-step-copy"><small>CAN-DO</small><h3>${esc(lesson.canDo || lesson.title)}</h3><p>Bài này dùng ngữ cảnh và dữ liệu có sẵn trong chương trình ${esc(lesson.level || "English")}.</p><button class="primary" type="button" data-hheo-step-complete>Đã hiểu mục tiêu →</button></div>`;
    if (stepId === "listen") return `<div class="hheo-step-listen"><small>NGHE TOÀN CẢNH</small><blockquote>${esc(line)}</blockquote><div><button type="button" data-hhe-speak="${esc(line)}">▶ Nghe tự nhiên</button><button type="button" data-hhe-speak="${esc(line)}" data-hhe-speak-rate="0.68">◷ Nghe chậm</button></div><button class="primary" type="button" data-hheo-step-complete>Đã nghe ít nhất một lần →</button></div>`;
    if (stepId === "gist") return question ? `<form class="hheo-step-question" data-hheo-lesson-question data-question-index="0" data-type="listening"><small>CHỌN Ý PHÙ HỢP</small><h3>${esc(question.prompt)}</h3><fieldset>${(question.options || []).map((option) => `<label><input type="radio" name="answer" value="${esc(option)}"><span>${esc(option)}</span></label>`).join("")}</fieldset><button class="primary" type="submit">Kiểm tra ý chính</button><output></output></form>` : `<div class="hheo-step-copy"><h3>${esc(lesson.canDo)}</h3><button class="primary" type="button" data-hheo-step-complete>Đã nắm ý chính →</button></div>`;
    if (stepId === "vocabulary") return `<div class="hheo-step-words"><header><small>TỪ VÀ CỤM TRỌNG TÂM</small><h3>${words.length} mục trong bài</h3></header>${words.map((word) => `<article><button type="button" data-hhe-speak="${esc(word[0])}">♪</button><div><strong>${esc(word[0])}</strong><span>${esc(word[1] || "")} · ${esc(word[2] || "")}</span><small>${esc(word[3] || "")}</small></div><button type="button" data-hhe-save-word data-hhe-word-json="${encodeURIComponent(JSON.stringify(word))}">☆ Lưu</button></article>`).join("") || "<p>Chưa có mục từ đã kiểm duyệt trong bài này.</p>"}<button class="primary" type="button" data-hheo-step-complete>Đã học các từ cần thiết →</button></div>`;
    if (stepId === "pattern") return `<div class="hheo-step-pattern"><small>LANGUAGE PATTERN</small><h3>${esc(lesson.grammar || "Mẫu câu trong hội thoại")}</h3><blockquote>${esc(line)}</blockquote><p>Quan sát cách cấu trúc được dùng trong câu, thay vì chỉ ghi nhớ tên ngữ pháp.</p><button class="primary" type="button" data-hheo-step-complete>Đã nhận ra mẫu câu →</button></div>`;
    if (["gap", "challenge"].includes(stepId) && question) return `<form class="hheo-step-question" data-hheo-lesson-question data-question-index="${stepId === "challenge" ? 1 : 0}" data-type="${stepId === "gap" ? "grammar" : "challenge"}"><small>${stepId === "gap" ? "NHỚ LẠI" : "MINI CHALLENGE"}</small><h3>${esc(question.prompt)}</h3>${question.options?.length ? `<fieldset>${question.options.map((option) => `<label><input type="radio" name="answer" value="${esc(option)}"><span>${esc(option)}</span></label>`).join("")}</fieldset>` : `<label class="hheo-text-answer"><span>Câu trả lời</span><input name="answer" autocomplete="off"></label>`}<button class="primary" type="submit">Kiểm tra</button><output></output></form>`;
    if (stepId === "order") return `<form class="hheo-step-produce" data-hheo-recall data-type="grammar"><small>KHÔI PHỤC CÂU</small><h3>Gõ lại câu sau theo đúng trật tự</h3><p class="hheo-scramble">${esc(line.split(/\s+/).reverse().join(" · "))}</p><label><span>Câu hoàn chỉnh</span><input name="answer" autocomplete="off"></label><button class="primary" type="submit">Kiểm tra trật tự</button><output></output></form>`;
    if (stepId === "shadow") return `<div class="hheo-step-shadow"><small>SHADOWING THEO CỤM</small><h3>${esc(line)}</h3><div><button type="button" data-hhe-speak="${esc(line)}" data-hhe-speak-rate="0.72">▶ Nghe chậm</button><button type="button" data-hhe-speak="${esc(line)}">▶ Nghe tự nhiên</button><button type="button" data-hhe-recognize data-hhe-target="${esc(line)}">◉ Nói lại</button></div><output data-hhe-transcript>Micro chỉ được mở khi bạn bấm Nói lại và đã cho phép.</output><div data-hhe-pron-score hidden></div><button class="primary" type="button" data-hheo-step-complete>Đã tự nghe và nói lại →</button></div>`;
    if (["recall", "create"].includes(stepId)) return `<form class="hheo-step-produce" data-hheo-production data-type="${stepId === "recall" ? "recall" : "writing"}"><small>${stepId === "recall" ? "NHỚ LẠI KHÔNG GỢI Ý" : "DÙNG CHỦ ĐỘNG"}</small><h3>${stepId === "recall" ? "Viết lại câu bạn vừa học" : "Tạo một câu mới cho chính bạn"}</h3><label><span>${stepId === "recall" ? "Câu bạn nhớ" : "Câu mới"}</span><textarea name="answer" rows="4" placeholder="Write one complete English sentence..."></textarea></label><button class="primary" type="submit">Lưu và tiếp tục</button><output></output></form>`;
    if (stepId === "summary") {
      const completed = new Set(checkpoint.completedSteps || []).size;
      return `<div class="hheo-step-summary"><span>✓</span><small>LESSON SUMMARY</small><h3>${completed}/${lessonSteps.length - 1} bước đã hoàn thành</h3><p>${esc(lesson.canDo || lesson.title)}</p><div><b>${words.length}</b><span>từ/cụm đã gặp</span><b>${progressPercent(checkpoint)}%</b><span>tiến độ bài</span></div><button class="primary" type="button" data-hheo-finish-lesson>Hoàn thành và lên lịch ôn →</button></div>`;
    }
    return `<div class="hheo-step-copy"><h3>${esc(lesson.title)}</h3><button class="primary" type="button" data-hheo-step-complete>Tiếp tục →</button></div>`;
  };

  const renderLessonPlayer = (state, context) => {
    const lesson = context.getLesson?.(state.activeLesson) || context.allLessons?.find((item) => item.id === state.activeLesson) || context.allLessons?.[0];
    if (!lesson) return "";
    const checkpoint = currentCheckpoint(state, lesson.id);
    const step = clamp(checkpoint.step, 0, lessonSteps.length - 1);
    return `<section class="hheo-player" data-hheo-player="${esc(lesson.id)}" data-hheo-runtime="${VERSION}" data-hheo-dispatch="${typeof root.HHEnglishLearningOS?.dispatchClick}"><header><button type="button" data-hhe-view="${lesson.isCareer ? "career" : "pathways"}">← Lộ trình</button><div><small>${esc(lesson.level || "ENGLISH")} · ${esc(lesson.primarySkill || "LANGUAGE")} · ${lesson.minutes || 10} PHÚT</small><h2>${esc(lesson.title)}</h2><p>${esc(lesson.canDo || "")}</p></div><span>${progressPercent(checkpoint)}%</span></header><div class="hheo-player-progress"><i style="--p:${progressPercent(checkpoint)}%"></i><ol>${lessonSteps.map(([id, label], index) => `<li class="${index === step ? "active" : checkpoint.completedSteps?.includes(id) ? "done" : index < step ? "skipped" : "locked"}" aria-current="${index === step ? "step" : "false"}"><b>${checkpoint.completedSteps?.includes(id) ? "✓" : index + 1}</b><span>${label}</span></li>`).join("")}</ol></div><main data-hheo-step="${lessonSteps[step][0]}"><header><span>BƯỚC ${step + 1}/${lessonSteps.length}</span><div><strong>${lessonSteps[step][1]}</strong><small>${lessonSteps[step][2]}</small></div></header>${renderLessonTask(state, lesson, checkpoint, step)}</main><footer><button type="button" data-hheo-step-prev ${step === 0 ? "disabled" : ""}>← Bước trước</button><span><i></i> Checkpoint tự lưu sau mỗi bước</span>${step < lessonSteps.length - 1 ? `<button type="button" data-hheo-step-skip>Bỏ qua có ghi nhận</button>` : ""}</footer></section>`;
  };

  const renderProgress = (state, context) => {
    const graph = root.HHEnglishSkillGraph?.buildSkillGraph?.(state, { allLessons: context.allLessons || [], levelOrder: context.levelOrder || [] });
    const vocabulary = vocabularyCounts(state);
    const reviews = normalizeState(state).learningOS.reviewAttempts;
    const correct = reviews.filter((item) => item.correct).length;
    const retention = reviews.length ? Math.round(correct / reviews.length * 100) : 0;
    const completed = Object.values(state.completed || {}).filter(Boolean).length;
    const minutes = Object.values(state.minutesByDay || {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    return `<section class="hheo-progress"><header><div><small>LEARNING EVIDENCE</small><h2>Tiến bộ dựa trên hoạt động đã lưu</h2><p>Không cộng các kỹ năng không tương đương thành một điểm chứng chỉ.</p></div><button type="button" data-hheo-print>In / lưu PDF</button></header><div class="hheo-progress-kpis"><article><small>BÀI HOÀN THÀNH</small><strong>${completed}</strong><span>evidence đã lưu</span></article><article><small>THỜI GIAN HỌC</small><strong>${minutes}</strong><span>phút trên thiết bị</span></article><article><small>TỶ LỆ NHỚ LẠI</small><strong>${retention}%</strong><span>${reviews.length} lượt đánh giá</span></article><article><small>LỖI ĐANG GIẢM</small><strong>${openMistakes(state).length}</strong><span>mục đang cần sửa</span></article></div><section class="hheo-vocabulary-ladder"><header><div><small>ACTIVE VOCABULARY</small><h3>Từ nhận biết đến sử dụng chủ động</h3></div><button type="button" data-hhe-view="vocabulary">Mở từ của tôi</button></header><div><article><b>${vocabulary.recognition}</b><span>Nhận ra</span><small>Đã gặp và nhận diện</small></article><i>→</i><article><b>${vocabulary.recall}</b><span>Nhớ lại</span><small>Đã nhớ không gợi ý</small></article><i>→</i><article><b>${vocabulary.active}</b><span>Chủ động</span><small>Có sản xuất và nhớ lại trễ</small></article></div></section>${graph ? `<section class="hheo-skill-summary"><header><div><small>CEFR 2020 SKILL GRAPH</small><h3>Các năng lực độc lập</h3></div><button type="button" data-hhe-view="skill-graph">Xem Evidence Ledger →</button></header><div>${graph.components.slice(0, 12).map((item) => `<article><span>${esc(item.label)}</span><b>${item.score}%</b><i style="--p:${item.score}%"></i><small>${item.evidence} bằng chứng · tin cậy ${item.confidence}%</small></article>`).join("")}</div><p>${esc(graph.disclaimer)}</p></section>` : ""}</section>`;
  };

  const renderView = (input, context = {}) => {
    const state = normalizeState(input);
    if (state.activeView === "dashboard") return renderToday(state, context);
    if (state.activeView === "pathways") return renderPathways(state, context);
    if (state.activeView === "practice-hub") return renderPracticeHub(state);
    if (state.activeView === "explore") return renderExplore(state);
    if (state.activeView === "mistakes") return renderMistakes(state);
    if (state.activeView === "lesson") return renderLessonPlayer(state, context);
    if (state.activeView === "progress") return renderProgress(state, context);
    return null;
  };

  const setCheckpointStep = (state, lessonId, mutate) => {
    const normalized = normalizeState(state);
    const os = normalized.learningOS;
    const existing = os.lessonCheckpoints[lessonId] || { step: 0, completedSteps: [], skippedSteps: [], answers: {}, startedAt: iso(), updatedAt: iso() };
    const checkpoint = { ...existing, completedSteps: [...(existing.completedSteps || [])], skippedSteps: [...(existing.skippedSteps || [])], answers: { ...(existing.answers || {}) } };
    mutate(checkpoint);
    checkpoint.step = clamp(checkpoint.step, 0, lessonSteps.length - 1);
    checkpoint.updatedAt = iso();
    os.lessonCheckpoints[lessonId] = checkpoint;
    addActivity(state, { kind: "lesson", label: `Bài học · bước ${checkpoint.step + 1}/${lessonSteps.length}`, view: "lesson", lessonId });
    return checkpoint;
  };

  const completeCurrentStep = (state, lessonId) => setCheckpointStep(state, lessonId, (checkpoint) => {
    const id = lessonSteps[checkpoint.step][0];
    if (!checkpoint.completedSteps.includes(id)) checkpoint.completedSteps.push(id);
    checkpoint.skippedSteps = checkpoint.skippedSteps.filter((item) => item !== id);
    checkpoint.step = Math.min(lessonSteps.length - 1, checkpoint.step + 1);
  });

  const download = (filename, body, type) => {
    if (!root.document || !root.URL?.createObjectURL) return false;
    const url = root.URL.createObjectURL(new Blob([body], { type }));
    const link = root.document.createElement("a"); link.href = url; link.download = filename; link.click(); root.setTimeout?.(() => root.URL.revokeObjectURL(url), 5000);
    return true;
  };

  const exportCsv = (state) => {
    const rows = [["kind", "id", "status", "value", "updatedAt"]];
    Object.entries(state.completed || {}).filter(([, value]) => value).forEach(([id]) => rows.push(["lesson", id, "completed", "1", ""]));
    Object.entries(state.wordMastery || {}).forEach(([id, row]) => rows.push(["vocabulary", id, activeVocabularyStage(row), Number(row.score) || 0, row.updatedAt || ""]));
    normalizeState(state).learningOS.mistakeRecords.forEach((row) => rows.push(["mistake", row.id, row.status, row.prompt, row.lastSeenAt]));
    return rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  };

  const filterTools = (host, query) => {
    const folded = normalizeText(query);
    host?.querySelectorAll?.("[data-hheo-tool]").forEach((button) => { button.hidden = Boolean(folded && !button.dataset.hheoTool.includes(folded)); });
  };

  const dispatchClick = (runtime, event) => {
    if (!event?.target?.closest || event.__hheoHandled) return false;
    const mode = event.target.closest("[data-hheo-session-mode]");
    const path = event.target.closest("[data-hheo-select-path]");
    const filter = event.target.closest("[data-hheo-mistake-filter]");
    const resolved = event.target.closest("[data-hheo-resolve-mistake], [data-hheo-reopen-mistake]");
    const player = event.target.closest("[data-hheo-player]");
    const exportButton = event.target.closest("[data-hheo-export]");
    const printable = event.target.closest("[data-hheo-print]");
    if (!mode && !path && !filter && !resolved && !player && !exportButton && !printable) return false;
    event.__hheoHandled = true;
    if (mode) { const state = normalizeState(runtime.readState()); state.learningOS.sessionMode = mode.dataset.hheoSessionMode; runtime.writeState(state); runtime.render(); runtime.toast(`Đã chọn phiên ${session(state).minutes} phút.`); return true; }
    if (path) { const state = normalizeState(runtime.readState()); state.learningOS.activePath = path.dataset.hheoSelectPath; runtime.writeState(state); runtime.render(); runtime.toast("Đã đổi lộ trình ưu tiên cho trang Hôm nay."); return true; }
    if (filter) { const state = normalizeState(runtime.readState()); state.learningOS.mistakeFilter = filter.dataset.hheoMistakeFilter; runtime.writeState(state); runtime.render(); return true; }
    if (resolved) { const state = normalizeState(runtime.readState()); const id = resolved.dataset.hheoResolveMistake || resolved.dataset.hheoReopenMistake; const row = state.learningOS.mistakeRecords.find((item) => item.id === id); if (row) { row.status = resolved.dataset.hheoResolveMistake ? "resolved" : "open"; row.nextReviewAt = resolved.dataset.hheoResolveMistake ? iso(Date.now() + 7 * 86400000) : iso(); runtime.writeState(state); runtime.render(); runtime.toast(row.status === "resolved" ? "Đã lưu lỗi là đã sửa; HH sẽ kiểm tra lại sau." : "Đã đưa lỗi trở lại Error Clinic."); } return true; }
    if (player && event.target.closest("[data-hheo-step-complete]")) { const state = normalizeState(runtime.readState()); completeCurrentStep(state, player.dataset.hheoPlayer); runtime.writeState(state); runtime.render({ focusView: true }); return true; }
    if (player && event.target.closest("[data-hheo-step-prev]")) { const state = normalizeState(runtime.readState()); setCheckpointStep(state, player.dataset.hheoPlayer, (checkpoint) => { checkpoint.step -= 1; }); runtime.writeState(state); runtime.render({ focusView: true }); return true; }
    if (player && event.target.closest("[data-hheo-step-skip]")) { const state = normalizeState(runtime.readState()); setCheckpointStep(state, player.dataset.hheoPlayer, (checkpoint) => { const id = lessonSteps[checkpoint.step][0]; if (!checkpoint.skippedSteps.includes(id)) checkpoint.skippedSteps.push(id); checkpoint.step += 1; }); runtime.writeState(state); runtime.render({ focusView: true }); runtime.toast("Đã bỏ qua và ghi nhận bước này, không giả là đã hoàn thành."); return true; }
    if (player && event.target.closest("[data-hheo-finish-lesson]")) {
      const state = normalizeState(runtime.readState()); const lessonId = player.dataset.hheoPlayer; const lesson = runtime.context.getLesson?.(lessonId) || runtime.context.allLessons?.find((item) => item.id === lessonId);
      setCheckpointStep(state, lessonId, (checkpoint) => { if (!checkpoint.completedSteps.includes("summary")) checkpoint.completedSteps.push("summary"); checkpoint.completedAt = iso(); });
      if (!state.completed[lessonId]) { state.completed[lessonId] = true; state.xp = (Number(state.xp) || 0) + (Number(lesson?.xp) || 30); state.minutesByDay[runtime.todayKey()] = (Number(state.minutesByDay[runtime.todayKey()]) || 0) + (Number(lesson?.minutes) || session(state).minutes); runtime.updateStreak?.(state); }
      lessonVocabulary(lesson).forEach((word) => { const id = word[0]; state.reviewQueue[id] = state.reviewQueue[id] || { type: "word", dueAt: iso(Date.now() + 86400000), repetitions: 0, interval: 1, ease: 2.5 }; });
      addActivity(state, { kind: "lesson-completed", label: `Hoàn thành · ${lesson?.title || lessonId}`, view: "progress", lessonId }); runtime.writeState(state); state.activeView = "dashboard"; runtime.writeState(state); runtime.render(); runtime.toast("Đã hoàn thành bài, lưu bằng chứng và lên lịch ôn.", "success"); return true;
    }
    if (exportButton) { const state = normalizeState(runtime.readState()); if (exportButton.dataset.hheoExport === "csv") download(`hh-english-${Date.now()}.csv`, exportCsv(state), "text/csv;charset=utf-8"); else download(`hh-english-${Date.now()}.json`, JSON.stringify({ exportedAt: iso(), schemaVersion: SCHEMA_VERSION, data: state }, null, 2), "application/json"); runtime.toast("Đã tạo tệp xuất trên thiết bị."); return true; }
    if (printable) { root.print?.(); return true; }
    return false;
  };

  const dispatchSubmit = (runtime, event) => {
    if (!event?.target?.closest || event.__hheoHandled) return false;
    const player = event.target.closest("[data-hheo-player]");
    const question = event.target.closest("[data-hheo-lesson-question], [data-hheo-recall], [data-hheo-production]");
    if (!player || !question) return false;
    event.__hheoHandled = true; event.preventDefault();
    const state = normalizeState(runtime.readState()); const lessonId = player.dataset.hheoPlayer; const answer = String(new FormData(question).get("answer") || "").trim(); const output = question.querySelector("output");
    if (!answer) { if (output) { output.className = "wrong"; output.textContent = "Hãy nhập hoặc chọn một câu trả lời trước."; } return true; }
    const lesson = runtime.context.getLesson?.(lessonId) || runtime.context.allLessons?.find((item) => item.id === lessonId) || {};
    const checkpoint = currentCheckpoint(state, lessonId);
    const currentStepId = lessonSteps[clamp(checkpoint.step, 0, lessonSteps.length - 1)]?.[0] || "";
    const expectedQuestion = lessonQuestion(lesson, Number(question.dataset.questionIndex) || (currentStepId === "challenge" ? 1 : 0));
    let correct = true; let score = 100; const expected = question.matches("[data-hheo-lesson-question]") ? String(expectedQuestion?.answer || "") : question.matches("[data-hheo-recall]") || question.dataset.type === "recall" ? lessonLine(lesson) : "";
    if (question.matches("[data-hheo-lesson-question]")) correct = normalizeText(answer) === normalizeText(expected);
    else if (question.matches("[data-hheo-recall]")) { const expectedWords = normalizeText(expected).split(" ").filter(Boolean); const actual = new Set(normalizeText(answer).split(" ").filter(Boolean)); score = expectedWords.length ? Math.round(expectedWords.filter((word) => actual.has(word)).length / expectedWords.length * 100) : 0; correct = score >= 70; }
    else { correct = answer.split(/\s+/).length >= 3 && /[a-z]/i.test(answer); score = correct ? 100 : 0; }
    if (!correct) {
      recordMistake(state, { type: question.dataset.type || "lesson", prompt: question.querySelector("h3")?.textContent || "Bài tập trong bài học", answer, expected, explanation: question.dataset.type === "writing" ? "Hãy viết ít nhất một câu tiếng Anh hoàn chỉnh có ba từ trở lên." : "Đối chiếu đáp án và thử lại trong ngữ cảnh mới.", lessonId });
      if (output) { output.className = "wrong"; output.innerHTML = `<strong>Chưa đạt</strong><span>${expected ? `Phương án: ${esc(expected)}` : "Hãy hoàn thiện câu rồi thử lại."}</span>`; }
      runtime.writeState(state); return true;
    }
    setCheckpointStep(state, lessonId, (row) => { const id = lessonSteps[row.step][0]; row.answers[id] = { answer, score, at: iso() }; if (!row.completedSteps.includes(id)) row.completedSteps.push(id); row.step += 1; });
    state.learningOS.reviewAttempts.unshift({ id: `attempt-${Date.now()}`, lessonId, type: question.dataset.type || "lesson", correct: true, score, at: iso() });
    if (question.matches("[data-hheo-production]")) { const targetWord = lessonVocabulary(runtime.context.getLesson?.(lessonId) || {})[0]?.[0]; if (targetWord && state.wordMastery?.[targetWord]) { state.wordMastery[targetWord].productionSuccesses = (Number(state.wordMastery[targetWord].productionSuccesses) || 0) + 1; state.wordMastery[targetWord].updatedAt = iso(); } }
    runtime.writeState(state); runtime.render({ focusView: true }); runtime.toast("Đúng · checkpoint đã được lưu.", "success"); return true;
  };

  const boundHosts = new WeakSet();
  let activeRuntime = null;
  let documentBound = false;
  const bind = (runtime) => {
    const { host } = runtime;
    if (!host) return;
    activeRuntime = runtime;
    if (!documentBound && root.document) {
      documentBound = true;
      root.document.addEventListener("click", (event) => { if (activeRuntime?.host?.contains?.(event.target)) dispatchClick(activeRuntime, event); }, true);
      root.document.addEventListener("submit", (event) => { if (activeRuntime?.host?.contains?.(event.target)) dispatchSubmit(activeRuntime, event); }, true);
    }
    if (boundHosts.has(host)) return;
    boundHosts.add(host); host.dataset.hheoBound = VERSION;
    host.addEventListener("input", (event) => { if (event.target.matches("[data-hheo-tool-search]")) filterTools(host, event.target.value); });
    host.addEventListener("click", (event) => dispatchClick(runtime, event));
    host.addEventListener("submit", (event) => dispatchSubmit(runtime, event), true);
  };

  const api = Object.freeze({ VERSION, SCHEMA_VERSION, mainNavigation, sessionModes, pathways, tools, lessonSteps, defaults, normalizeState, activeVocabularyStage, vocabularyCounts, dueReviewItems, todayModel, currentCheckpoint, setCheckpointStep, completeCurrentStep, recordMistake, renderView, dispatchClick, dispatchSubmit, bind, exportCsv });
  root.HHEnglishLearningOS = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
