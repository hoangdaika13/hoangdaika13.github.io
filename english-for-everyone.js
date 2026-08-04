(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const VERSION = 1;
  const esc = (value = "") => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));
  const ageModes = Object.freeze([
    { id: "little", icon: "★", label: "Little Kids", ages: "4–6 tuổi", detail: "Hình ảnh, âm thanh và phonics; gần như không cần gõ.", words: 5, minWords: 4, minutes: 7, rate: 0.72, tone: "playful" },
    { id: "kids", icon: "☀", label: "Kids", ages: "7–10 tuổi", detail: "Truyện tương tác, nhiệm vụ ngắn và từ vựng theo hình.", words: 8, minWords: 6, minutes: 10, rate: 0.78, tone: "friendly" },
    { id: "teens", icon: "◆", label: "Teens", ages: "11–15 tuổi", detail: "Giao tiếp, trường học, game và tình huống số an toàn.", words: 12, minWords: 8, minutes: 15, rate: 0.88, tone: "modern" },
    { id: "student", icon: "A+", label: "Students", ages: "16–22 tuổi", detail: "CEFR, IELTS, TOEIC, học thuật và du học.", words: 15, minWords: 10, minutes: 20, rate: 0.92, tone: "academic" },
    { id: "adult", icon: "▦", label: "Adults", ages: "23–54 tuổi", detail: "Công việc, giao tiếp, du lịch và chuyên ngành.", words: 15, minWords: 10, minutes: 15, rate: 0.9, tone: "focused" },
    { id: "senior", icon: "◎", label: "Senior", ages: "55+", detail: "Chữ lớn, phát âm chậm, hướng dẫn rõ và ít thao tác.", words: 8, minWords: 5, minutes: 12, rate: 0.68, tone: "calm" }
  ]);
  const cefrLevels = Object.freeze(["PRE-A1", "A1", "A2", "B1", "B2", "C1", "C2"]);
  const goals = Object.freeze([
    ["communication", "Giao tiếp hằng ngày"], ["school", "Trường học"], ["exam", "Thi cử"],
    ["career", "Nghề nghiệp"], ["travel", "Du lịch"], ["academic", "Học thuật"]
  ]);
  const contentPacks = Object.freeze([
    { id: "phonics", icon: "Aa", title: "Phonics World", detail: "Âm chữ, minimal pairs và đánh vần.", ageBands: ["little", "kids", "teens", "senior"], action: "practice" },
    { id: "picture", icon: "▣", title: "Picture Vocabulary", detail: "Học từ bằng hình, nghĩa và âm thanh.", ageBands: ["little", "kids", "senior"], action: "picture" },
    { id: "story", icon: "◇", title: "Story Adventure", detail: "Truyện ngắn, lựa chọn tích cực và không phạt khi sai.", ageBands: ["little", "kids", "teens"], action: "story" },
    { id: "school", icon: "⌂", title: "School English", detail: "Lớp học, bạn bè, khoa học và thuyết trình.", ageBands: ["kids", "teens", "student"], view: "learn" },
    { id: "exam", icon: "✓", title: "Exam Center", detail: "CEFR, IELTS, TOEIC và kỹ năng làm bài.", ageBands: ["teens", "student", "adult"], view: "placement" },
    { id: "life", icon: "∞", title: "Life English", detail: "Bệnh viện, ngân hàng, mua sắm và du lịch.", ageBands: ["teens", "student", "adult", "senior"], view: "listening" },
    { id: "career", icon: "▦", title: "Career English", detail: "70 lộ trình nghề nghiệp và hội thoại công việc.", ageBands: ["student", "adult"], view: "career" },
    { id: "senior", icon: "◎", title: "Senior Conversation", detail: "Gia đình, sức khỏe, công nghệ và sinh hoạt.", ageBands: ["senior"], action: "senior" },
    { id: "family", icon: "♥", title: "Family Challenge", detail: "Cùng hoàn thành nhiệm vụ, không xếp hạng cạnh tranh.", ageBands: ["little", "kids", "teens", "adult", "senior"], action: "family" }
  ]);
  const pictureWords = Object.freeze([
    { term: "apple", meaning: "quả táo", icon: "🍎", ageBands: ["little", "kids", "senior"], topics: ["daily", "food"], contentRating: "everyone", reviewStatus: "reviewed" },
    { term: "cat", meaning: "con mèo", icon: "🐱", ageBands: ["little", "kids", "senior"], topics: ["daily", "animals"], contentRating: "everyone", reviewStatus: "reviewed" },
    { term: "book", meaning: "quyển sách", icon: "📘", ageBands: ["little", "kids", "senior"], topics: ["school"], contentRating: "everyone", reviewStatus: "reviewed" },
    { term: "family", meaning: "gia đình", icon: "🏠", ageBands: ["little", "kids", "teens", "adult", "senior"], topics: ["daily"], contentRating: "everyone", reviewStatus: "reviewed" },
    { term: "water", meaning: "nước", icon: "💧", ageBands: ["little", "kids", "teens", "adult", "senior"], topics: ["daily"], contentRating: "everyone", reviewStatus: "reviewed" },
    { term: "friend", meaning: "người bạn", icon: "🤝", ageBands: ["kids", "teens", "student", "adult", "senior"], topics: ["social"], contentRating: "everyone", reviewStatus: "reviewed" }
  ]);
  const phonicsPairs = Object.freeze([
    ["ship", "sheep", "/ɪ/ và /iː/"], ["cat", "cut", "/æ/ và /ʌ/"], ["fan", "van", "/f/ và /v/"],
    ["rice", "lice", "/r/ và /l/"], ["thin", "then", "/θ/ và /ð/"], ["cap", "cab", "/p/ và /b/"]
  ]);
  const familyChallenges = Object.freeze([
    ["listen", "Nghe cùng nhau", "Nghe ba từ và cùng nhắc lại."],
    ["label", "Dán nhãn đồ vật", "Chọn năm đồ vật trong nhà và gọi tên bằng tiếng Anh."],
    ["story", "Kể chuyện 3 câu", "Mỗi người nói thêm một câu ngắn."],
    ["kind", "Câu tử tế", "Nói một lời cảm ơn bằng tiếng Anh."]
  ]);
  const defaults = () => ({
    universalProfile: { ageMode: "adult", level: "A0", goal: "communication", minutes: 15, dialect: "us", support: { largeText: false, reducedMotion: false, dyslexia: false, hearingSupport: false }, updatedAt: "" },
    familyMode: { enabled: false, guardianStatus: "not-configured", permissions: { aiTutor: false, recording: false, sharing: false, purchases: false }, sessionLimit: 20, weeklyReport: true, topicLocks: [], challengeDone: {} },
    everyoneStudio: { activeTab: "profile", activePack: "phonics", sessionStartedAt: "" }
  });
  const modeById = (id) => ageModes.find((item) => item.id === id) || ageModes[4];
  const isChildMode = (id) => ["little", "kids"].includes(modeById(id).id);
  const normalizeState = (state = {}) => {
    const fallback = defaults();
    const profile = state.universalProfile || {};
    const support = profile.support || {};
    state.universalProfile = {
      ...fallback.universalProfile,
      ...profile,
      ageMode: modeById(profile.ageMode).id,
      level: cefrLevels.includes(profile.level) ? profile.level : (profile.level === "A0" ? "PRE-A1" : cefrLevels.includes(state.selectedLevel) ? state.selectedLevel : fallback.universalProfile.level),
      goal: goals.some(([id]) => id === profile.goal) ? profile.goal : fallback.universalProfile.goal,
      minutes: clamp(profile.minutes || state.dailyGoal || 15, 5, 60),
      dialect: profile.dialect === "uk" ? "uk" : "us",
      support: { ...fallback.universalProfile.support, ...support }
    };
    const family = state.familyMode || {};
    state.familyMode = {
      ...fallback.familyMode,
      ...family,
      enabled: isChildMode(state.universalProfile.ageMode) || Boolean(family.enabled),
      permissions: { ...fallback.familyMode.permissions, ...(family.permissions || {}) },
      sessionLimit: clamp(family.sessionLimit || 20, 5, 90),
      topicLocks: Array.isArray(family.topicLocks) ? family.topicLocks.slice(0, 20) : [],
      challengeDone: { ...(family.challengeDone || {}) }
    };
    if (isChildMode(state.universalProfile.ageMode) && state.familyMode.guardianStatus !== "local-confirmed") state.familyMode.permissions = { ...fallback.familyMode.permissions };
    state.everyoneStudio = { ...fallback.everyoneStudio, ...(state.everyoneStudio || {}) };
    return state;
  };
  const lessonPolicy = (input = {}, now = Date.now()) => {
    const state = normalizeState({ ...input, universalProfile: { ...(input.universalProfile || {}), support: { ...(input.universalProfile?.support || {}) } }, familyMode: { ...(input.familyMode || {}), permissions: { ...(input.familyMode?.permissions || {}) } }, everyoneStudio: { ...(input.everyoneStudio || {}) } });
    const mode = modeById(state.universalProfile.ageMode);
    const attempts = Math.max(0, Number(state.galaxySession?.attempts) || 0);
    const correct = Math.max(0, Math.min(attempts, Number(state.galaxySession?.correct) || 0));
    const recordedMistakes = Math.min(attempts || Number.MAX_SAFE_INTEGER, Array.isArray(state.mistakeNotebook) ? state.mistakeNotebook.length : 0);
    const errorRate = attempts ? Math.max(attempts - correct, recordedMistakes) / attempts : 0;
    const wordCount = Math.max(mode.minWords, mode.words - (errorRate >= 0.45 ? 2 : 0));
    const startedAt = Date.parse(state.everyoneStudio.sessionStartedAt || "") || now;
    const elapsedMinutes = Math.max(0, Math.floor((now - startedAt) / 60000));
    const masteryRows = Object.values(state.wordMastery || {});
    const recognitionVocabulary = masteryRows.filter((item) => Number(item?.score) >= 65).length;
    const activeVocabulary = masteryRows.filter((item) => Number(item?.score) >= 90 && Number(item?.attempts) >= 2 && Number(item?.correct) / Math.max(1, Number(item?.attempts)) >= .75).length;
    const fatigueScore = Math.min(100, Math.round(errorRate * 70 + Math.min(30, elapsedMinutes / Math.max(1, state.familyMode.sessionLimit) * 30)));
    return {
      mode: mode.id, wordCount, minutes: Math.min(state.universalProfile.minutes, mode.minutes), voiceRate: mode.rate,
      errorRate: Math.round(errorRate * 100), elapsedMinutes, fatigueScore, recognitionVocabulary, activeVocabulary,
      breakSuggested: elapsedMinutes >= state.familyMode.sessionLimit || (attempts >= 5 && (errorRate >= .65 || fatigueScore >= 65)),
      interaction: mode.id === "little" ? "listen-picture" : mode.id === "kids" ? "story-game" : mode.id === "senior" ? "listen-repeat" : "context-production",
      tutorPolicy: isChildMode(mode.id) ? "guided-only" : "goal-bounded"
    };
  };
  const metadataForEntry = (entry = {}) => {
    const level = String(entry.level || "").toUpperCase();
    const topic = String(entry.topic || "daily");
    let ageBands = ["teens", "student", "adult", "senior"];
    if (["A0", "PRE-A1", "A1"].includes(level)) ageBands = ageModes.map((item) => item.id);
    if (/career|business|academic|law|medical/.test(topic)) ageBands = ["teens", "student", "adult"];
    return { ...entry, ageBands: Array.isArray(entry.ageBands) ? entry.ageBands : ageBands, topics: Array.isArray(entry.topics) ? entry.topics : [topic], contentRating: entry.contentRating || "everyone", reviewStatus: entry.reviewStatus || (entry.reviewed ? "reviewed" : "unreviewed") };
  };
  const contentForAge = (entries = [], ageMode = "adult") => entries.map(metadataForEntry).filter((item) => item.ageBands.includes(modeById(ageMode).id) && item.contentRating === "everyone");
  const weeklyReport = (input = {}, now = Date.now()) => {
    const state = normalizeState({ ...input, universalProfile: { ...(input.universalProfile || {}) }, familyMode: { ...(input.familyMode || {}) } });
    const days = Array.from({ length: 7 }, (_, index) => new Date(now - index * 86400000).toISOString().slice(0, 10));
    const minutes = days.reduce((sum, day) => sum + Math.max(0, Number(state.minutesByDay?.[day]) || 0), 0);
    const mastered = Object.values(state.wordMastery || {}).filter((item) => Number(item?.score) >= 90).length;
    return { minutes, activeDays: days.filter((day) => Number(state.minutesByDay?.[day]) > 0).length, completedLessons: Object.values(state.completed || {}).filter(Boolean).length, savedWords: Object.keys(state.savedWords || {}).length, mastered };
  };
  const modeOptions = (selected) => ageModes.map((item) => `<button type="button" class="${item.id === selected ? "active" : ""}" data-hhee-age="${item.id}" aria-pressed="${item.id === selected}"><i>${item.icon}</i><span><strong>${item.label}</strong><small>${item.ages}</small><em>${item.detail}</em></span>${item.id === selected ? "<b>✓</b>" : ""}</button>`).join("");
  const profileView = (state) => {
    const profile = state.universalProfile;
    return `<section class="hhee-profile"><div class="hhee-age-grid" aria-label="Chọn chế độ tuổi">${modeOptions(profile.ageMode)}</div><form data-hhee-profile><header><div><small>UNIVERSAL LEARNER PROFILE</small><h3>Trình độ và mục tiêu độc lập với độ tuổi</h3></div><span>Tự lưu theo tài khoản hiện tại</span></header><div class="hhee-form-grid"><label><span>Trình độ CEFR</span><select name="level">${cefrLevels.map((value) => `<option ${profile.level === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label><span>Mục tiêu</span><select name="goal">${goals.map(([value, label]) => `<option value="${value}" ${profile.goal === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><label><span>Thời gian mỗi ngày</span><select name="minutes">${[5,7,10,15,20,30,45,60].map((value) => `<option value="${value}" ${profile.minutes === value ? "selected" : ""}>${value} phút</option>`).join("")}</select></label><label><span>Phát âm ưu tiên</span><select name="dialect"><option value="us" ${profile.dialect === "us" ? "selected" : ""}>Anh–Mỹ</option><option value="uk" ${profile.dialect === "uk" ? "selected" : ""}>Anh–Anh</option></select></label></div><fieldset><legend>Hỗ trợ học tập</legend><label><input type="checkbox" name="largeText" ${profile.support.largeText ? "checked" : ""}> Chữ lớn</label><label><input type="checkbox" name="reducedMotion" ${profile.support.reducedMotion ? "checked" : ""}> Ít chuyển động</label><label><input type="checkbox" name="dyslexia" ${profile.support.dyslexia ? "checked" : ""}> Dễ đọc</label><label><input type="checkbox" name="hearingSupport" ${profile.support.hearingSupport ? "checked" : ""}> Luôn ưu tiên transcript</label></fieldset><button class="primary" type="submit">Lưu hồ sơ và tạo lộ trình →</button></form></section>`;
  };
  const lessonView = (state) => {
    const policy = lessonPolicy(state); const mode = modeById(policy.mode);
    return `<section class="hhee-adaptive"><header><div><small>ADAPTIVE LESSON PLAYER</small><h3>${mode.label} · ${policy.wordCount} từ · ${policy.minutes} phút</h3><p>Nhịp học được tính từ chế độ tuổi và lỗi đã ghi trên thiết bị, không dùng camera.</p></div><span>${policy.breakSuggested ? "Nên nghỉ ngắn" : "Nhịp học phù hợp"}</span></header><div class="hhee-policy-grid"><article><small>TỪ MỚI</small><strong>${policy.wordCount}</strong><p>${policy.errorRate >= 45 ? "Đã giảm vì tỷ lệ quên cao." : "Đúng mức mặc định của chế độ."}</p></article><article><small>GIỌNG ĐỌC</small><strong>${policy.voiceRate}×</strong><p>${state.universalProfile.dialect === "uk" ? "Anh–Anh" : "Anh–Mỹ"} · chỉ phát khi bấm nghe.</p></article><article><small>KIỂU TƯƠNG TÁC</small><strong>${policy.interaction}</strong><p>Không mở bước sau trước khi hoàn thành bước hiện tại.</p></article><article><small>TỶ LỆ LỖI</small><strong>${policy.errorRate}%</strong><p>Tính từ các lần luyện thật đã lưu.</p></article><article><small>VỐN TỪ NHẬN BIẾT</small><strong>${policy.recognitionVocabulary}</strong><p>Điểm nhớ từ 65 trở lên.</p></article><article><small>VỐN TỪ CHỦ ĐỘNG</small><strong>${policy.activeVocabulary}</strong><p>Đã nhớ chắc và trả lời đúng lặp lại.</p></article><article><small>MỆT MỎI ƯỚC TÍNH</small><strong>${policy.fatigueScore}%</strong><p>Chỉ dùng thời gian và lỗi, không dùng camera.</p></article><article><small>READING 90%</small><strong>Local</strong><p>Phân tích trong Từ của tôi trước khi đọc.</p></article></div><ol class="hhee-learning-flow"><li><b>1</b><span>Xem hoặc nghe<small>Làm quen từ trong ngữ cảnh.</small></span></li><li><b>2</b><span>Hiểu nghĩa<small>Chọn nghĩa Việt đã kiểm duyệt.</small></span></li><li><b>3</b><span>Dùng trong câu<small>Ghép cụm và tình huống.</small></span></li><li><b>4</b><span>Nói lại<small>Nghe mẫu rồi tự luyện.</small></span></li><li><b>5</b><span>Ôn SRS<small>Quên · Khó · Nhớ · Dễ.</small></span></li></ol><footer><span>AI Tutor: ${policy.tutorPolicy === "guided-only" ? "chỉ trong bài học được kiểm soát" : "giới hạn theo mục tiêu học"}</span><button class="primary" type="button" data-hhe-view="galaxy">Mở Lesson Player →</button></footer></section>`;
  };
  const packPreview = (state, pack) => {
    if (pack.id === "picture") return `<div class="hhee-picture-grid">${contentForAge(pictureWords, state.universalProfile.ageMode).map((item) => `<button type="button" data-hhee-speak="${esc(item.term)}"><i>${item.icon}</i><strong>${item.term}</strong><span>${item.meaning}</span><small>${item.reviewStatus === "reviewed" ? "Đã kiểm duyệt" : "Chưa kiểm duyệt"}</small></button>`).join("") || "<p>Chế độ tuổi này chưa có thẻ hình phù hợp.</p>"}</div>`;
    if (pack.id === "phonics") return `<div class="hhee-phonics">${phonicsPairs.map(([left, right, cue]) => `<article><span>${cue}</span><div><button type="button" data-hhee-speak="${left}">${left} ▶</button><button type="button" data-hhee-speak="${right}">${right} ▶</button></div></article>`).join("")}</div>`;
    if (pack.id === "story") return `<article class="hhee-story"><small>STORY 01 · EVERYONE</small><h4>A kind morning</h4><p>Sam sees a new student alone. “Hello, would you like to sit with us?” The student smiles.</p><div><button type="button" data-hhee-speak="Hello, would you like to sit with us?">▶ Nghe câu</button><button class="primary" type="button" data-hhee-story-choice="kind">Chào bạn mới</button><button type="button" data-hhee-story-choice="retry">Nghe lại trước</button></div><span>Mọi lựa chọn đều cho phép học tiếp; HH không trừ điểm.</span></article>`;
    if (pack.id === "senior") return `<div class="hhee-senior-lines">${[["Could you speak more slowly, please?","Bạn có thể nói chậm hơn không?"],["I need help with my phone.","Tôi cần trợ giúp với điện thoại."],["I have an appointment at ten.","Tôi có lịch hẹn lúc mười giờ."]].map(([line, meaning]) => `<button type="button" data-hhee-speak="${esc(line)}"><strong>${line}</strong><span>${meaning}</span><b>▶</b></button>`).join("")}</div>`;
    if (pack.id === "family") return `<div class="hhee-family-challenges">${familyChallenges.map(([id, title, detail]) => `<button type="button" class="${state.familyMode.challengeDone[id] ? "done" : ""}" data-hhee-challenge="${id}"><i>${state.familyMode.challengeDone[id] ? "✓" : "○"}</i><span><strong>${title}</strong><small>${detail}</small></span></button>`).join("")}</div>`;
    return `<article class="hhee-pack-link"><span>${pack.icon}</span><h4>${pack.title}</h4><p>${pack.detail}</p><button class="primary" type="button" data-hhe-view="${pack.view || "learn"}">Mở công cụ →</button></article>`;
  };
  const contentView = (state) => {
    const allowed = contentPacks.filter((item) => item.ageBands.includes(state.universalProfile.ageMode) && !state.familyMode.topicLocks.includes(item.id));
    const active = allowed.find((item) => item.id === state.everyoneStudio.activePack) || allowed[0];
    return `<section class="hhee-content"><aside><header><small>AGE-AWARE CONTENT</small><h3>Nội dung phù hợp hiện tại</h3><p>${modeById(state.universalProfile.ageMode).label} · ${state.universalProfile.level}</p></header>${allowed.map((pack) => `<button type="button" class="${pack.id === active?.id ? "active" : ""}" data-hhee-pack="${pack.id}"><i>${pack.icon}</i><span><strong>${pack.title}</strong><small>${pack.detail}</small></span><b>→</b></button>`).join("")}</aside><main>${active ? packPreview(state, active) : "<p>Chưa có pack phù hợp.</p>"}</main></section>`;
  };
  const familyView = (state) => {
    const family = state.familyMode; const report = weeklyReport(state); const child = isChildMode(state.universalProfile.ageMode); const confirmed = family.guardianStatus === "local-confirmed";
    return `<section class="hhee-family"><main><header><div><small>FAMILY MODE</small><h3>Không gian học riêng tư cho gia đình</h3><p>${child ? "Chế độ trẻ em đang bật: các quyền nhạy cảm mặc định đều tắt." : "Có thể bật Family Mode để học cùng con hoặc người thân."}</p></div><span class="${confirmed ? "ok" : "pending"}">${confirmed ? "Đã xác nhận trên thiết bị" : "Chưa thiết lập phụ huynh"}</span></header><form data-hhee-family><label class="hhee-guardian"><input type="checkbox" name="guardianAcknowledged" ${confirmed ? "checked" : ""}><span><strong>Tôi là phụ huynh/người giám hộ trên thiết bị này</strong><small>Đây là cổng kiểm soát cục bộ, không phải dịch vụ xác minh danh tính pháp lý.</small></span></label><fieldset ${confirmed ? "" : "disabled"}><legend>Quyền cần phụ huynh duyệt</legend><label><input type="checkbox" name="aiTutor" ${family.permissions.aiTutor ? "checked" : ""}> AI Tutor có hướng dẫn</label><label><input type="checkbox" name="recording" ${family.permissions.recording ? "checked" : ""}> Ghi âm luyện nói</label><label><input type="checkbox" name="sharing" ${family.permissions.sharing ? "checked" : ""}> Chia sẻ kết quả</label><label><input type="checkbox" name="purchases" ${family.permissions.purchases ? "checked" : ""}> Mua hàng</label></fieldset><fieldset ${confirmed ? "" : "disabled"}><legend>Khóa chủ đề hoặc phòng học</legend>${contentPacks.map((pack) => `<label><input type="checkbox" name="topicLocks" value="${pack.id}" ${family.topicLocks.includes(pack.id) ? "checked" : ""}> ${pack.title}</label>`).join("")}</fieldset><div><label><span>Giới hạn một phiên</span><select name="sessionLimit">${[10,15,20,30,45,60].map((value) => `<option value="${value}" ${family.sessionLimit === value ? "selected" : ""}>${value} phút</option>`).join("")}</select></label><label><input type="checkbox" name="weeklyReport" ${family.weeklyReport ? "checked" : ""}> Tạo báo cáo tuần trên thiết bị</label></div><button class="primary" type="submit">Lưu kiểm soát gia đình</button></form><section class="hhee-privacy"><article><b>Không tin nhắn riêng</b><span>Không mở trò chuyện công khai cho hồ sơ trẻ em.</span></article><article><b>Không quảng cáo cá nhân hóa</b><span>HH English không dùng hồ sơ học để nhắm quảng cáo.</span></article><article><b>Microphone chủ động</b><span>Chỉ xin quyền sau thao tác rõ ràng và có thể tắt.</span></article><article><b>Tải/xóa dữ liệu</b><span>Dùng công cụ dữ liệu trong Cài đặt HH English.</span></article></section></main><aside><small>BÁO CÁO 7 NGÀY</small><h3>Dữ liệu thật trên thiết bị</h3><div><span><b>${report.minutes}</b> phút học</span><span><b>${report.activeDays}</b> ngày hoạt động</span><span><b>${report.completedLessons}</b> bài hoàn thành</span><span><b>${report.savedWords}</b> từ đã lưu</span></div><p>${family.weeklyReport ? "Báo cáo sẵn sàng cho phụ huynh xem trên thiết bị này." : "Báo cáo tuần đang tắt."}</p><button type="button" data-hhee-session-end>Kết thúc phiên học</button></aside></section>`;
  };
  const accessibilityView = (state) => {
    const support = state.universalProfile.support;
    return `<section class="hhee-access"><header><div><small>ACCESSIBILITY MODE</small><h3>Đọc, nghe và thao tác theo cách phù hợp</h3></div><span>WCAG-aware · cài đặt cục bộ</span></header><form data-hhee-access>${[["largeText","Aa","Chữ lớn","Tăng cỡ chữ và vùng bấm."],["reducedMotion","◌","Ít chuyển động","Dừng hiệu ứng trang trí và cuộn mượt."],["dyslexia","ab","Dễ đọc","Tăng khoảng cách chữ, từ và dòng."],["hearingSupport","CC","Hỗ trợ nghe","Luôn ưu tiên transcript và hướng dẫn bằng chữ."]].map(([name,icon,title,detail]) => `<label><input type="checkbox" name="${name}" ${support[name] ? "checked" : ""}><span><i>${icon}</i><strong>${title}</strong><small>${detail}</small></span></label>`).join("")}<button class="primary" type="submit">Áp dụng cho toàn HH English</button></form><section><article><b>Chỉ bàn phím</b><p>Tab di chuyển, Enter kích hoạt và focus luôn hiển thị rõ.</p></article><article><b>Vùng bấm lớn</b><p>Các thao tác chính tối thiểu khoảng 44px.</p></article><article><b>Không phụ thuộc màu</b><p>Trạng thái luôn có chữ hoặc biểu tượng đi kèm.</p></article></section></section>`;
  };
  const renderView = (input = {}) => {
    const state = normalizeState(input); const profile = state.universalProfile; const mode = modeById(profile.ageMode); const policy = lessonPolicy(state);
    const tab = ["profile", "lesson", "content", "family", "accessibility"].includes(state.everyoneStudio.activeTab) ? state.everyoneStudio.activeTab : "profile";
    const body = tab === "lesson" ? lessonView(state) : tab === "content" ? contentView(state) : tab === "family" ? familyView(state) : tab === "accessibility" ? accessibilityView(state) : profileView(state);
    return `<section class="hhee-workspace"><header><div><small>HH ENGLISH FOR EVERYONE</small><h2>${mode.label} · ${mode.ages}</h2><p>Độ tuổi, trình độ ${profile.level} và mục tiêu được điều chỉnh độc lập.</p></div><div><span><b>${policy.wordCount}</b> từ/bài</span><span><b>${policy.minutes}</b> phút</span><span><b>${profile.dialect.toUpperCase()}</b> giọng đọc</span></div></header><nav aria-label="Cá nhân hóa HH English">${[["profile","◎","Hồ sơ"],["lesson","▶","Bài thích ứng"],["content","▣","Nội dung"],["family","♥","Gia đình"],["accessibility","Aa","Hỗ trợ"]].map(([id,icon,label]) => `<button type="button" class="${tab === id ? "active" : ""}" data-hhee-tab="${id}"><i>${icon}</i>${label}</button>`).join("")}</nav><div class="hhee-body">${body}</div></section>`;
  };
  const writeAndRender = (runtime, state, message) => { runtime.writeState(state); runtime.render({ focusView: false }); if (message) runtime.toast(message); };
  const handleClick = (runtime, event) => {
    const tab = event.target.closest("[data-hhee-tab]");
    if (tab) { const state = normalizeState(runtime.readState()); state.everyoneStudio.activeTab = tab.dataset.hheeTab; writeAndRender(runtime, state); return; }
    const age = event.target.closest("[data-hhee-age]");
    if (age) { const state = normalizeState(runtime.readState()); const mode = modeById(age.dataset.hheeAge); state.universalProfile.ageMode = mode.id; state.universalProfile.minutes = mode.minutes; state.settings.voiceRate = mode.rate; state.settings.learnerType = mode.id === "adult" ? "worker" : mode.id === "senior" ? "independent" : "student"; if (isChildMode(mode.id)) { state.familyMode.enabled = true; state.familyMode.permissions = { aiTutor: false, recording: false, sharing: false, purchases: false }; state.settings.microphoneConsent = false; } writeAndRender(runtime, state, `Đã chuyển sang ${mode.label}. Tiến độ học được giữ nguyên.`); return; }
    const pack = event.target.closest("[data-hhee-pack]");
    if (pack) { const state = normalizeState(runtime.readState()); state.everyoneStudio.activePack = pack.dataset.hheePack; writeAndRender(runtime, state); return; }
    const speak = event.target.closest("[data-hhee-speak]");
    if (speak) { const state = normalizeState(runtime.readState()); if (!runtime.speak(speak.dataset.hheeSpeak, state.settings, { rate: lessonPolicy(state).voiceRate })) runtime.toast("Hãy bật quyền phát âm thanh trong Voice Studio.", "error"); return; }
    const challenge = event.target.closest("[data-hhee-challenge]");
    if (challenge) { const state = normalizeState(runtime.readState()); state.familyMode.challengeDone[challenge.dataset.hheeChallenge] = !state.familyMode.challengeDone[challenge.dataset.hheeChallenge]; writeAndRender(runtime, state, "Đã cập nhật thử thách gia đình."); return; }
    if (event.target.closest("[data-hhee-session-end]")) { const state = normalizeState(runtime.readState()); const policy = lessonPolicy(state); if (policy.elapsedMinutes) { const day = new Date().toISOString().slice(0,10); state.minutesByDay[day] = (Number(state.minutesByDay[day]) || 0) + Math.min(policy.elapsedMinutes, state.familyMode.sessionLimit); } state.everyoneStudio.sessionStartedAt = new Date().toISOString(); writeAndRender(runtime, state, "Đã kết thúc phiên và lưu thời gian học trên thiết bị."); }
  };
  const handleSubmit = (runtime, event) => {
    const profileForm = event.target.closest("[data-hhee-profile]");
    if (profileForm) { event.preventDefault(); const data = new FormData(profileForm); const state = normalizeState(runtime.readState()); const level = String(data.get("level") || "PRE-A1"); state.universalProfile.level = cefrLevels.includes(level) ? level : "PRE-A1"; state.selectedLevel = level === "PRE-A1" ? "A0" : level; state.universalProfile.goal = String(data.get("goal") || "communication"); state.universalProfile.minutes = clamp(data.get("minutes"), 5, 60); state.dailyGoal = state.universalProfile.minutes; state.universalProfile.dialect = data.get("dialect") === "uk" ? "uk" : "us"; state.universalProfile.support = { largeText: data.get("largeText") === "on", reducedMotion: data.get("reducedMotion") === "on", dyslexia: data.get("dyslexia") === "on", hearingSupport: data.get("hearingSupport") === "on" }; state.settings.reducedMotion = state.universalProfile.support.reducedMotion; state.settings.goal = goals.find(([id]) => id === state.universalProfile.goal)?.[1] || "Giao tiếp hằng ngày"; state.everyoneStudio.activeTab = "lesson"; state.universalProfile.updatedAt = new Date().toISOString(); if (!state.everyoneStudio.sessionStartedAt) state.everyoneStudio.sessionStartedAt = new Date().toISOString(); writeAndRender(runtime, state, "Đã lưu Universal Learner Profile và tạo nhịp học mới."); return; }
    const familyForm = event.target.closest("[data-hhee-family]");
    if (familyForm) { event.preventDefault(); const data = new FormData(familyForm); const state = normalizeState(runtime.readState()); const confirmed = data.get("guardianAcknowledged") === "on"; state.familyMode.enabled = confirmed || isChildMode(state.universalProfile.ageMode); state.familyMode.guardianStatus = confirmed ? "local-confirmed" : "not-configured"; state.familyMode.permissions = confirmed ? { aiTutor: data.get("aiTutor") === "on", recording: data.get("recording") === "on", sharing: data.get("sharing") === "on", purchases: data.get("purchases") === "on" } : { aiTutor: false, recording: false, sharing: false, purchases: false }; state.familyMode.topicLocks = confirmed ? data.getAll("topicLocks").map(String).filter((id) => contentPacks.some((pack) => pack.id === id)).slice(0, contentPacks.length) : []; state.familyMode.sessionLimit = clamp(data.get("sessionLimit"), 5, 90); state.familyMode.weeklyReport = data.get("weeklyReport") === "on"; if (!state.familyMode.permissions.recording) state.settings.microphoneConsent = false; writeAndRender(runtime, state, confirmed ? "Đã lưu quyền phụ huynh trên thiết bị này." : "Đã khóa toàn bộ quyền nhạy cảm."); return; }
    const accessForm = event.target.closest("[data-hhee-access]");
    if (accessForm) { event.preventDefault(); const data = new FormData(accessForm); const state = normalizeState(runtime.readState()); state.universalProfile.support = { largeText: data.get("largeText") === "on", reducedMotion: data.get("reducedMotion") === "on", dyslexia: data.get("dyslexia") === "on", hearingSupport: data.get("hearingSupport") === "on" }; state.settings.reducedMotion = state.universalProfile.support.reducedMotion; writeAndRender(runtime, state, "Đã áp dụng hỗ trợ cho toàn HH English."); }
  };
  const instances = new WeakMap();
  const mount = (runtime) => {
    if (!runtime?.host) return;
    normalizeState(runtime.state || runtime.readState());
    let instance = instances.get(runtime.host);
    if (!instance) {
      const click = (event) => handleClick(instance.runtime, event); const submit = (event) => handleSubmit(instance.runtime, event);
      instance = { runtime, click, submit }; instances.set(runtime.host, instance);
      runtime.host.addEventListener("click", click); runtime.host.addEventListener("submit", submit);
    }
    instance.runtime = runtime;
  };
  const unmount = (host) => { const instance = instances.get(host); if (!instance) return; host.removeEventListener("click", instance.click); host.removeEventListener("submit", instance.submit); instances.delete(host); };

  const api = { VERSION, ageModes, cefrLevels, goals, contentPacks, pictureWords, phonicsPairs, familyChallenges, defaults, modeById, isChildMode, normalizeState, lessonPolicy, metadataForEntry, contentForAge, weeklyReport, renderView, mount, unmount };
  root.HHEnglishForEveryone = Object.freeze(api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
