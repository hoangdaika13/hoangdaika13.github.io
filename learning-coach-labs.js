(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const STORAGE_KEY = "hh.learning.coach-labs.v1";
  const LOCAL_LABEL = "Gợi ý tự động cục bộ";
  const AI_LABEL = "Gợi ý từ AI đã cấu hình";
  const VIEWS = Object.freeze(["coach", "speaking", "listening", "writing", "career-simulator"]);
  const MAX_HISTORY = 80;

  const CAREERS = Object.freeze({
    communication: { label: "Giao tiếp hằng ngày", role: "người học", terms: ["clarify", "confirm", "suggest"], scenario: "Bạn gặp một người mới tại sự kiện cộng đồng." },
    technology: { label: "Công nghệ thông tin", role: "kỹ sư phần mềm", terms: ["deployment", "requirement", "incident"], scenario: "Bạn báo cáo một lỗi production trong buổi stand-up." },
    design: { label: "Thiết kế đồ họa", role: "nhà thiết kế", terms: ["layout", "contrast", "iteration"], scenario: "Bạn trình bày phương án thiết kế với khách hàng." },
    media: { label: "Video và âm thanh", role: "biên tập viên", terms: ["timeline", "transition", "mix"], scenario: "Bạn trao đổi thay đổi hậu kỳ với đạo diễn." },
    marketing: { label: "Marketing", role: "chuyên viên marketing", terms: ["audience", "conversion", "campaign"], scenario: "Bạn đề xuất chiến dịch mới với trưởng nhóm." },
    business: { label: "Kinh doanh", role: "chuyên viên kinh doanh", terms: ["proposal", "negotiate", "deadline"], scenario: "Bạn thương lượng thời hạn với khách hàng." },
    hospitality: { label: "Du lịch và khách sạn", role: "nhân viên lễ tân", terms: ["reservation", "available", "apologize"], scenario: "Bạn hỗ trợ khách thay đổi phòng." },
    healthcare: { label: "Y tế và điều dưỡng", role: "điều dưỡng", terms: ["symptom", "allergy", "appointment"], scenario: "Bạn hỏi thông tin ban đầu của bệnh nhân." },
    engineering: { label: "Kỹ thuật", role: "kỹ sư", terms: ["specification", "tolerance", "safety"], scenario: "Bạn giải thích một thay đổi kỹ thuật trong cuộc họp." },
    finance: { label: "Tài chính và ngân hàng", role: "chuyên viên tài chính", terms: ["forecast", "revenue", "variance"], scenario: "Bạn tóm tắt biến động ngân sách cho quản lý." },
    logistics: { label: "Logistics", role: "điều phối viên", terms: ["shipment", "warehouse", "delay"], scenario: "Bạn xử lý một lô hàng giao chậm." },
    interview: { label: "Phỏng vấn xin việc", role: "ứng viên", terms: ["strength", "achievement", "responsibility"], scenario: "Bạn trả lời phỏng vấn cho vị trí mong muốn." },
    academic: { label: "Tiếng Anh học thuật", role: "sinh viên", terms: ["evidence", "hypothesis", "conclusion"], scenario: "Bạn bảo vệ lập luận trong một buổi seminar." }
  });

  // These are the small, inspectable references used by the deterministic
  // fallback. They are not a claim that an external model was consulted.
  const LOCAL_TUTOR_SOURCES = Object.freeze([
    { id: "hh-learning-rubric", title: "HH Learning rubric", kind: "local-rule", detail: "Bounded practice rubric for task response, organisation, vocabulary and grammar." },
    { id: "hh-cefr-levels", title: "HH CEFR level map", kind: "local-catalog", detail: "Selectable A0–C2 labels used to tune examples and pacing; not an official placement score." },
    { id: "hh-spaced-review", title: "HH spaced-review scheduler", kind: "local-rule", detail: "Deterministic review hints based on the learner's supplied mistakes and practice history." }
  ]);

  const SPEAKING_SCENARIOS = Object.freeze([
    { id: "restaurant", title: "Nhà hàng", phrase: "Could I have the menu, please?", translation: "Tôi có thể xem thực đơn được không?", roles: ["Customer", "Server"] },
    { id: "airport", title: "Sân bay", phrase: "Where can I find the check-in counter?", translation: "Tôi có thể tìm quầy làm thủ tục ở đâu?", roles: ["Passenger", "Agent"] },
    { id: "office", title: "Công sở", phrase: "Could you clarify the next step for me?", translation: "Bạn có thể làm rõ bước tiếp theo giúp tôi không?", roles: ["Team member", "Manager"] },
    { id: "interview", title: "Phỏng vấn", phrase: "I learned to prioritize tasks under pressure.", translation: "Tôi đã học cách ưu tiên công việc khi chịu áp lực.", roles: ["Candidate", "Interviewer"] }
  ]);

  const LISTENING_ITEMS = Object.freeze([
    { id: "daily", title: "Kế hoạch hôm nay", text: "Today I will review my notes before starting a new lesson.", hint: "review · notes · lesson" },
    { id: "work", title: "Cập nhật công việc", text: "The project is on schedule, but we still need to test the final release.", hint: "schedule · test · release" },
    { id: "travel", title: "Thông báo chuyến bay", text: "Passengers for flight eight twenty should proceed to gate twelve.", hint: "flight · proceed · gate" }
  ]);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const clean = (value, max = 1600) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const uid = (prefix = "item") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const words = (value) => clean(value, 8000).toLowerCase().match(/[a-z0-9']+/g) || [];
  const unique = (items) => [...new Set(items)];

  function defaultState() {
    return {
      version: 1,
      view: "coach",
      career: "communication",
      coach: { task: "socratic", prompt: "", output: null, hintIndex: 0, level: "A2", dailyMinutes: 20, priority: "speaking", history: [] },
      speaking: { scenarioId: "restaurant", transcript: "", manualTranscript: "", attempts: [], recording: false, micPermission: "prompt" },
      listening: { itemId: "daily", rate: 0.8, subtitles: true, repeats: 1, attempts: [] },
      writing: { draft: "", preview: null, reports: [] },
      careerSimulator: { careerId: "interview", messages: [], feedback: null },
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeState(input) {
    const base = defaultState();
    const value = input && typeof input === "object" ? input : {};
    const career = CAREERS[value.career] ? value.career : base.career;
    return {
      ...base,
      view: VIEWS.includes(value.view) ? value.view : base.view,
      career,
      coach: {
        task: ["socratic", "mistakes", "career-example", "weekly-plan", "daily-summary"].includes(value.coach?.task) ? value.coach.task : base.coach.task,
        prompt: clean(value.coach?.prompt, 3000),
        output: value.coach?.output && typeof value.coach.output === "object" ? sanitizeAIResult(value.coach.output) : null,
        hintIndex: clamp(value.coach?.hintIndex, 0, 8),
        level: ["A0", "A1", "A2", "B1", "B2", "C1", "C2"].includes(value.coach?.level) ? value.coach.level : base.coach.level,
        dailyMinutes: clamp(value.coach?.dailyMinutes || base.coach.dailyMinutes, 5, 120),
        priority: ["speaking", "listening", "writing", "vocabulary", "grammar"].includes(value.coach?.priority) ? value.coach.priority : base.coach.priority,
        history: Array.isArray(value.coach?.history) ? value.coach.history.slice(0, MAX_HISTORY).map(normalizeHistory) : []
      },
      speaking: {
        scenarioId: SPEAKING_SCENARIOS.some((item) => item.id === value.speaking?.scenarioId) ? value.speaking.scenarioId : base.speaking.scenarioId,
        transcript: clean(value.speaking?.transcript, 2000),
        manualTranscript: clean(value.speaking?.manualTranscript, 2000),
        attempts: Array.isArray(value.speaking?.attempts) ? value.speaking.attempts.slice(0, MAX_HISTORY).map(normalizeAttempt) : [],
        recording: false,
        micPermission: ["prompt", "granted", "denied", "unavailable"].includes(value.speaking?.micPermission) ? value.speaking.micPermission : "prompt"
      },
      listening: {
        itemId: LISTENING_ITEMS.some((item) => item.id === value.listening?.itemId) ? value.listening.itemId : base.listening.itemId,
        rate: clamp(value.listening?.rate || 0.8, 0.5, 1.15),
        subtitles: value.listening?.subtitles !== false,
        repeats: clamp(value.listening?.repeats || 1, 1, 5),
        attempts: Array.isArray(value.listening?.attempts) ? value.listening.attempts.slice(0, MAX_HISTORY).map(normalizeAttempt) : []
      },
      writing: {
        draft: clean(value.writing?.draft, 12000),
        preview: value.writing?.preview && typeof value.writing.preview === "object" ? sanitizeAIResult(value.writing.preview) : null,
        reports: Array.isArray(value.writing?.reports) ? value.writing.reports.slice(0, MAX_HISTORY).map(normalizeHistory) : []
      },
      careerSimulator: {
        careerId: CAREERS[value.careerSimulator?.careerId] ? value.careerSimulator.careerId : "interview",
        messages: Array.isArray(value.careerSimulator?.messages) ? value.careerSimulator.messages.slice(-40).map((item) => ({ role: item?.role === "learner" ? "learner" : "coach", text: clean(item?.text, 1200), at: clean(item?.at, 40) })) : [],
        feedback: value.careerSimulator?.feedback && typeof value.careerSimulator.feedback === "object" ? sanitizeAIResult(value.careerSimulator.feedback) : null
      },
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeHistory(item) {
    return { id: clean(item?.id || uid("history"), 100), task: clean(item?.task, 50), title: clean(item?.title, 160), source: item?.source === "adapter" ? "adapter" : "local", createdAt: clean(item?.createdAt || new Date().toISOString(), 40), official: false };
  }

  function normalizeAttempt(item) {
    return { id: clean(item?.id || uid("attempt"), 100), type: clean(item?.type, 40), target: clean(item?.target, 1200), transcript: clean(item?.transcript, 2000), score: clamp(item?.score, 0, 100), matched: clamp(item?.matched, 0, 999), total: clamp(item?.total, 0, 999), createdAt: clean(item?.createdAt || new Date().toISOString(), 40), official: false };
  }

  function sanitizeAIResult(value, depth = 0) {
    if (depth > 5) return null;
    if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitizeAIResult(item, depth + 1));
    if (!value || typeof value !== "object") return typeof value === "string" ? clean(value, 6000) : value;
    return Object.fromEntries(Object.entries(value).slice(0, 60).filter(([key]) => !/(api.?key|secret|password|authorization|token|credential)/i.test(key)).map(([key, item]) => [clean(key, 80), sanitizeAIResult(item, depth + 1)]));
  }

  function compareTranscript(transcript, target, durationSeconds = 0) {
    const heard = words(transcript);
    const expected = words(target);
    const expectedCounts = new Map();
    expected.forEach((word) => expectedCounts.set(word, (expectedCounts.get(word) || 0) + 1));
    let matched = 0;
    const extra = [];
    heard.forEach((word) => {
      const remaining = expectedCounts.get(word) || 0;
      if (remaining > 0) { matched += 1; expectedCounts.set(word, remaining - 1); } else extra.push(word);
    });
    const missing = [];
    expectedCounts.forEach((count, word) => { for (let index = 0; index < count; index += 1) missing.push(word); });
    const precision = heard.length ? matched / heard.length : 0;
    const recall = expected.length ? matched / expected.length : 0;
    const score = precision + recall ? Math.round(200 * precision * recall / (precision + recall)) : 0;
    const wordsPerMinute = durationSeconds > 0 ? Math.round(heard.length / durationSeconds * 60) : null;
    return { score: clamp(score, 0, 100), matched, total: expected.length, missing: unique(missing).slice(0, 12), extra: unique(extra).slice(0, 12), wordsPerMinute, official: false, notice: "Đánh giá luyện tập tự động, không phải điểm chính thức." };
  }

  function writingRubric(text, level = "A2") {
    const source = clean(text, 12000);
    const tokens = words(source);
    const sentences = source.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
    const connectors = tokens.filter((word) => ["because", "however", "therefore", "also", "first", "finally", "although"].includes(word)).length;
    const uniqueRatio = tokens.length ? unique(tokens).length / tokens.length : 0;
    const incomplete = sentences.filter((sentence) => words(sentence).length < 3).length;
    const dimensions = {
      taskResponse: clamp(Math.round(tokens.length / 80 * 100), 20, 95),
      organization: clamp(42 + connectors * 9 + Math.min(25, sentences.length * 4), 25, 95),
      vocabulary: clamp(Math.round(35 + uniqueRatio * 58), 25, 96),
      grammar: clamp(82 - incomplete * 9 - (source && !/[.!?]$/.test(source) ? 8 : 0), 25, 94)
    };
    const overall = Math.round(Object.values(dimensions).reduce((sum, item) => sum + item, 0) / 4);
    const suggestions = [];
    if (tokens.length < 50) suggestions.push("Mở rộng ý bằng một ví dụ cụ thể.");
    if (connectors < 2) suggestions.push("Thêm từ nối để các ý liên kết rõ hơn.");
    if (incomplete) suggestions.push("Kiểm tra các câu quá ngắn hoặc chưa đủ chủ ngữ và động từ.");
    if (!suggestions.length) suggestions.push("Đọc lại để kiểm tra sắc thái và tính nhất quán trước khi nộp.");
    return { level: clean(level, 8), words: tokens.length, dimensions, overall, suggestions, official: false, notice: "Rubric tự động chỉ hỗ trợ tự học, không thay thế điểm của giáo viên." };
  }

  function grammarPreview(text) {
    const original = clean(text, 12000);
    const changes = [];
    let proposed = original;
    const rules = [
      [/\bI is\b/gi, "I am", "Đại từ I dùng am."],
      [/\b(you|we|they) is\b/gi, "$1 are", "You, we, they dùng are."],
      [/\b(he|she|it) are\b/gi, "$1 is", "He, she, it dùng is."],
      [/\b(he|she|it) go\b/gi, "$1 goes", "Động từ hiện tại đơn thêm -es."],
      [/\b(he|she|it) have\b/gi, "$1 has", "Dạng đúng với ngôi thứ ba là has."],
      [/\bi\b/g, "I", "Đại từ I luôn viết hoa."],
      [/\s+([,.!?])/g, "$1", "Bỏ khoảng trắng trước dấu câu."]
    ];
    rules.forEach(([pattern, replacement, reason]) => {
      if (pattern.test(proposed)) { pattern.lastIndex = 0; proposed = proposed.replace(pattern, replacement); changes.push(reason); }
    });
    if (proposed && !/[.!?]$/.test(proposed)) { proposed += "."; changes.push("Thêm dấu kết câu."); }
    return { original, proposed, changes: unique(changes), changed: proposed !== original, official: false, applied: false, notice: "Bản xem trước tự động; chỉ thay nội dung khi bạn chọn Áp dụng." };
  }

  function localCoach(task, payload = {}) {
    const careerId = CAREERS[payload.career] ? payload.career : "communication";
    const career = CAREERS[careerId];
    const prompt = clean(payload.prompt, 3000);
    const mistakes = Array.isArray(payload.mistakes) ? payload.mistakes.slice(0, 8) : [];
    if (task === "mistakes") {
      const items = mistakes.length ? mistakes.map((item, index) => ({ question: `${index + 1}. Hãy sửa: ${clean(item.userAnswer || item.prompt, 180)}`, hint: `Đối chiếu với: ${clean(item.answer, 160) || "quy tắc đã học"}` })) : [{ question: "Viết một câu về kế hoạch hôm nay, sau đó tự kiểm tra chủ ngữ và động từ.", hint: "Bắt đầu bằng Today I..." }];
      return { title: "Luyện từ lỗi gần đây", steps: items, summary: "Mỗi lỗi được đổi thành một bài luyện ngắn; chưa có dữ liệu thì dùng bài nền tảng." };
    }
    if (task === "career-example") return { title: `Ví dụ theo ngành ${career.label}`, example: `As a ${career.role}, I need to ${career.terms[0]} the issue, ${career.terms[1]} the next step, and ${career.terms[2]} the result.`, vocabulary: career.terms, challenge: career.scenario };
    if (task === "weekly-plan") {
      const priority = clean(payload.priority || "speaking", 20);
      const focusMap = { speaking: "Nói shadowing", listening: "Nghe và dictation", writing: "Viết có rubric", vocabulary: "Từ vựng theo ngành", grammar: "Ngữ pháp từ lỗi sai" };
      const focus = focusMap[priority] || focusMap.speaking;
      return { title: `Kế hoạch 7 ngày · ${clean(payload.level || "A2", 8)}`, days: ["Khảo sát điểm yếu", focus, "Từ vựng chuyên ngành", "Nghe và ghi chính tả", "Roleplay thực tế", "Viết và tự đánh giá", "Ôn + kiểm tra nhanh"].map((item, index) => ({ day: index + 1, focus: item, minutes: clamp(payload.dailyMinutes || 15, 5, 60) })), summary: "Kế hoạch tự động sẽ điều chỉnh sau mỗi attempt được ghi nhận; người học vẫn quyết định lộ trình cuối cùng." };
    }
    if (task === "daily-summary") return { title: "Tóm tắt học tập hôm nay", summary: `Bạn đã có ${Number(payload.sessions || 0)} phiên học và ${mistakes.length} lỗi đang cần xem lại.`, next: mistakes.length ? "Ôn lỗi gần nhất trước khi bắt đầu bài mới." : "Thử một bài nghe ngắn rồi ghi lại câu bạn chưa chắc." };
    const question = prompt || "Tôi chưa biết cách trả lời bài tập này.";
    return { title: "Coach Socratic", steps: ["Đề bài đang hỏi kết quả hay cách giải thích?", "Từ khóa nào cho biết thì, ngữ cảnh hoặc mục tiêu?", "Bạn có thể viết một câu đơn giản trước rồi mở rộng không?"], response: `Hãy bắt đầu từ điều bạn chắc nhất trong câu: “${question.slice(0, 140)}”. Tôi sẽ gợi ý từng bước, không đưa đáp án ngay.` };
  }

  function localTutorEvidence(task, payload = {}) {
    const sourceIds = task === "weekly-plan" ? ["hh-cefr-levels", "hh-spaced-review"] : task === "mistakes" ? ["hh-spaced-review", "hh-learning-rubric"] : ["hh-learning-rubric", "hh-cefr-levels"];
    const sources = sourceIds.map((id) => LOCAL_TUTOR_SOURCES.find((source) => source.id === id)).filter(Boolean).map((source) => ({ ...source }));
    const context = [payload.level && `level ${clean(payload.level, 8)}`, payload.priority && `priority ${clean(payload.priority, 24)}`, Number(payload.sessions) > 0 && `${clamp(payload.sessions, 0, 999)} recorded sessions`].filter(Boolean);
    return {
      sources,
      explanation: `Deterministic local guidance from ${sources.map((source) => source.title).join(" and ")}${context.length ? `; inputs: ${context.join(", ")}` : "."}`,
      disclaimer: "Local rule-based suggestion; no external AI or web source was consulted.",
      sourceType: "local"
    };
  }

  function enrichLocalResult(task, payload, result) {
    return { ...result, ...localTutorEvidence(task, payload) };
  }

  async function runCoachTask(task, payload = {}, options = {}) {
    const safePayload = sanitizeAIResult({ prompt: clean(payload.prompt, 3000), career: CAREERS[payload.career] ? payload.career : "communication", level: clean(payload.level || "A0", 8), dailyMinutes: clamp(payload.dailyMinutes || 15, 5, 120), priority: clean(payload.priority || "speaking", 20), mistakes: Array.isArray(payload.mistakes) ? payload.mistakes.slice(0, 8).map((item) => ({ prompt: clean(item.prompt, 220), answer: clean(item.answer, 220), userAnswer: clean(item.userAnswer, 220) })) : [], sessions: clamp(payload.sessions, 0, 999) });
    if (typeof options.runAI === "function") {
      try {
        const result = await options.runAI({ task: `learning-${clean(task, 40)}`, context: safePayload, policy: { suggestionsOnly: true, neverChangeOfficialGrade: true, neverApplyEditsWithoutConfirmation: true } });
        if (result != null) {
          const safeResult = sanitizeAIResult(result);
          return { source: "adapter", sourceType: "adapter", label: AI_LABEL, result: typeof safeResult === "string" ? { content: safeResult } : safeResult, official: false, disclaimer: "Adapter response; availability and provenance depend on the confirmed integration." };
        }
      } catch (error) {
        return { source: "local", label: LOCAL_LABEL, result: enrichLocalResult(task, safePayload, localCoach(task, safePayload)), warning: `Adapter AI chưa sẵn sàng: ${clean(error?.message || "lỗi không xác định", 240)}`, official: false };
      }
    }
    return { source: "local", label: LOCAL_LABEL, result: enrichLocalResult(task, safePayload, localCoach(task, safePayload)), official: false };
  }

  function createMemoryStore(storage = root.localStorage) {
    let state = defaultState();
    try { state = normalizeState(JSON.parse(storage?.getItem?.(STORAGE_KEY) || "null")); } catch { state = defaultState(); }
    const persist = () => { state.updatedAt = new Date().toISOString(); try { storage?.setItem?.(STORAGE_KEY, JSON.stringify(state)); } catch {} };
    return {
      get: () => clone(state),
      set: (next) => { state = normalizeState(next); persist(); return clone(state); },
      update: (recipe) => { const draft = clone(state); state = normalizeState(typeof recipe === "function" ? recipe(draft) || draft : { ...draft, ...(recipe || {}) }); persist(); return clone(state); }
    };
  }

  function resultMarkup(output, visibleHints = Number.POSITIVE_INFINITY) {
    if (!output) return `<div class="hhlcl-empty"><strong>Coach đang chờ câu hỏi</strong><p>Chọn một tác vụ và nhập bối cảnh để nhận gợi ý.</p></div>`;
    const body = output.result || {};
    const rows = [];
    if (body.content) rows.push(`<p>${escapeHtml(body.content)}</p>`);
    if (body.response) rows.push(`<p>${escapeHtml(body.response)}</p>`);
    if (body.summary) rows.push(`<p>${escapeHtml(body.summary)}</p>`);
    if (body.example) rows.push(`<blockquote>${escapeHtml(body.example)}</blockquote>`);
    if (body.next) rows.push(`<p><strong>Bước tiếp:</strong> ${escapeHtml(body.next)}</p>`);
    if (Array.isArray(body.steps)) {
      const visible = body.steps.slice(0, Math.max(1, visibleHints));
      rows.push(`<ol>${visible.map((item) => `<li>${escapeHtml(typeof item === "string" ? item : item.question || JSON.stringify(item))}${item?.hint ? `<small>${escapeHtml(item.hint)}</small>` : ""}</li>`).join("")}</ol>`);
      if (visible.length < body.steps.length) rows.push(`<button type="button" class="hhlcl-next-hint" data-hhlcl-next-hint>Hiện gợi ý tiếp theo <span>${visible.length}/${body.steps.length}</span></button>`);
    }
    if (Array.isArray(body.days)) rows.push(`<div class="hhlcl-plan">${body.days.map((item) => `<article><b>Ngày ${escapeHtml(item.day)}</b><span>${escapeHtml(item.focus)}</span><small>${escapeHtml(item.minutes)} phút</small></article>`).join("")}</div>`);
    if (Array.isArray(body.vocabulary)) rows.push(`<div class="hhlcl-chips">${body.vocabulary.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`);
    if (body.explanation) rows.push(`<p class="hhlcl-explanation"><strong>Vì sao có gợi ý này?</strong> ${escapeHtml(body.explanation)}</p>`);
    if (Array.isArray(body.sources) && body.sources.length) rows.push(`<details class="hhlcl-sources"><summary>Nguồn các quy tắc local (${body.sources.length})</summary><ul>${body.sources.map((source) => `<li><strong>${escapeHtml(source.title)}</strong><span>${escapeHtml(source.detail || source.kind || "local")}</span></li>`).join("")}</ul></details>`);
    if (body.disclaimer) rows.push(`<small class="hhlcl-disclaimer">${escapeHtml(body.disclaimer)}</small>`);
    if (!rows.length) rows.push(`<pre>${escapeHtml(JSON.stringify(body, null, 2))}</pre>`);
    return `<article class="hhlcl-result"><header><span>${escapeHtml(output.label)}</span><strong>${escapeHtml(body.title || "Bản gợi ý")}</strong></header>${output.warning ? `<p class="hhlcl-warning">${escapeHtml(output.warning)}</p>` : ""}${rows.join("")}<footer>Nhận xét hỗ trợ tự học · Không tự sửa điểm chính thức</footer></article>`;
  }

  function shellMarkup(state) {
    const labels = { coach: "AI Coach", speaking: "Luyện nói", listening: "Luyện nghe", writing: "Luyện viết", "career-simulator": "Mô phỏng nghề nghiệp" };
    return `<section class="hhlcl-shell" data-hhlcl-shell>
      <header class="hhlcl-hero"><div><span>HH LEARNING LABS</span><h1>Gia sư và phòng luyện kỹ năng</h1><p>Học từng bước, luyện bằng tình huống thật và luôn kiểm soát mọi chỉnh sửa.</p></div><aside><b>${escapeHtml(CAREERS[state.career].label)}</b><small>${escapeHtml(state.coach.level)} · ${state.coach.dailyMinutes} phút/ngày · Local-first</small></aside></header>
      <nav class="hhlcl-tabs" aria-label="Phòng học">${VIEWS.map((view) => `<button type="button" data-hhlcl-view="${view}" class="${state.view === view ? "is-active" : ""}" aria-current="${state.view === view ? "page" : "false"}">${labels[view]}</button>`).join("")}</nav>
      <main data-hhlcl-stage></main><div class="hhlcl-toast" data-hhlcl-toast role="status" aria-live="polite"></div>
    </section>`;
  }

  function coachMarkup(state) {
    const tasks = [["socratic", "Gợi ý Socratic"], ["mistakes", "Luyện từ lỗi sai"], ["career-example", "Ví dụ theo ngành"], ["weekly-plan", "Kế hoạch tuần"], ["daily-summary", "Tóm tắt hôm nay"]];
    return `<section class="hhlcl-workspace hhlcl-coach"><aside class="hhlcl-side"><small>AI LEARNING COACH</small><h2>Hiểu trước, đáp án sau</h2><p>Coach chia nhỏ vấn đề và đặt câu hỏi dẫn dắt. Khi chưa nối AI, bộ quy tắc cục bộ vẫn hoạt động minh bạch.</p><div class="hhlcl-profile-grid"><label>Trình độ<select data-hhlcl-level>${["A0", "A1", "A2", "B1", "B2", "C1", "C2"].map((level) => `<option ${state.coach.level === level ? "selected" : ""}>${level}</option>`).join("")}</select></label><label>Phút/ngày<input data-hhlcl-minutes type="number" min="5" max="120" value="${state.coach.dailyMinutes}"></label></div><label>Ưu tiên<select data-hhlcl-priority>${[["speaking", "Nói"], ["listening", "Nghe"], ["writing", "Viết"], ["vocabulary", "Từ vựng"], ["grammar", "Ngữ pháp"]].map(([id, label]) => `<option value="${id}" ${state.coach.priority === id ? "selected" : ""}>${label}</option>`).join("")}</select></label><label>Chuyên ngành<select data-hhlcl-career>${Object.entries(CAREERS).map(([id, item]) => `<option value="${id}" ${state.career === id ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></label><div class="hhlcl-auto-label"><i></i><span>Mọi nhận xét ở đây là gợi ý tự động, không phải điểm chính thức.</span></div></aside><section class="hhlcl-main"><div class="hhlcl-task-grid">${tasks.map(([id, label]) => `<button type="button" data-hhlcl-task="${id}" class="${state.coach.task === id ? "is-active" : ""}">${escapeHtml(label)}</button>`).join("")}</div><form data-hhlcl-coach-form><label>Bối cảnh hoặc câu hỏi<textarea name="prompt" rows="5" placeholder="Ví dụ: Em chưa hiểu vì sao câu này dùng thì hiện tại hoàn thành...">${escapeHtml(state.coach.prompt)}</textarea></label><button class="is-primary" type="submit">Nhận gợi ý từng bước</button></form><div data-hhlcl-coach-result>${resultMarkup(state.coach.output, state.coach.hintIndex)}</div></section></section>`;
  }

  function speakingMarkup(state) {
    const scenario = SPEAKING_SCENARIOS.find((item) => item.id === state.speaking.scenarioId) || SPEAKING_SCENARIOS[0];
    const permissionLabel = { prompt: "Chưa yêu cầu quyền", granted: "Đã cấp quyền micro", denied: "Quyền micro bị từ chối", unavailable: "Thiết bị không hỗ trợ" }[state.speaking.micPermission];
    return `<section class="hhlcl-workspace"><aside class="hhlcl-side"><small>SPEAKING LAB</small><h2>Shadowing có phản hồi</h2><p>Micro chỉ được yêu cầu sau khi bạn bấm bắt đầu. Transcript được so khớp cục bộ và không phải điểm thi.</p><div class="hhlcl-permission is-${state.speaking.micPermission}"><i></i><div><b>${permissionLabel}</b><small>Bản ghi chỉ tồn tại trong phiên hiện tại, không lưu vào localStorage.</small></div></div><div class="hhlcl-scenarios">${SPEAKING_SCENARIOS.map((item) => `<button type="button" data-hhlcl-scenario="${item.id}" class="${item.id === scenario.id ? "is-active" : ""}"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.roles.join(" · "))}</small></button>`).join("")}</div></aside><section class="hhlcl-main"><article class="hhlcl-phrase"><span>CÂU LUYỆN</span><h2>${escapeHtml(scenario.phrase)}</h2><p>${escapeHtml(scenario.translation)}</p><div><button type="button" data-hhlcl-speak="normal">Nghe mẫu</button><button type="button" data-hhlcl-speak="slow">Nghe chậm</button><button class="is-primary" type="button" data-hhlcl-recognize>Bắt đầu nói</button><button type="button" data-hhlcl-record>Ghi âm</button><button type="button" data-hhlcl-stop disabled>Dừng</button></div><div class="hhlcl-recording"><audio controls data-hhlcl-recording-preview hidden></audio><a data-hhlcl-download-recording hidden download="hh-shadowing.webm">Tải bản ghi trong phiên</a></div></article><article class="hhlcl-transcript"><header><strong>Transcript và so sánh</strong><span data-hhlcl-mic-status>Sẵn sàng</span></header><output data-hhlcl-transcript>${escapeHtml(state.speaking.transcript || "Kết quả nhận dạng sẽ hiện ở đây.")}</output><div data-hhlcl-speaking-score></div><form class="hhlcl-manual-transcript" data-hhlcl-manual-transcript><label>Nhập transcript thủ công khi trình duyệt không nhận giọng nói<input name="transcript" value="${escapeHtml(state.speaking.manualTranscript)}" placeholder="Type what you said..."></label><button type="submit">Đánh giá câu nói</button></form></article>${attemptsMarkup(state.speaking.attempts, "Lịch sử luyện nói")}</section></section>`;
  }

  function listeningMarkup(state) {
    const item = LISTENING_ITEMS.find((entry) => entry.id === state.listening.itemId) || LISTENING_ITEMS[0];
    return `<section class="hhlcl-workspace"><aside class="hhlcl-side"><small>LISTENING LAB</small><h2>Nghe chủ động</h2><p>Điều chỉnh tốc độ, lặp đoạn, ẩn phụ đề và luyện chính tả.</p><div class="hhlcl-scenarios">${LISTENING_ITEMS.map((entry) => `<button type="button" data-hhlcl-listening="${entry.id}" class="${entry.id === item.id ? "is-active" : ""}"><b>${escapeHtml(entry.title)}</b><small>${escapeHtml(entry.hint)}</small></button>`).join("")}</div></aside><section class="hhlcl-main"><article class="hhlcl-player"><header><span>LISTEN & REPEAT</span><h2>${escapeHtml(item.title)}</h2></header><p class="hhlcl-subtitles" ${state.listening.subtitles ? "" : "hidden"}>${escapeHtml(item.text)}</p><div class="hhlcl-controls"><button type="button" data-hhlcl-listen-play>Phát</button><label>Tốc độ<input type="range" min="0.5" max="1.15" step="0.05" value="${state.listening.rate}" data-hhlcl-rate><output>${state.listening.rate}×</output></label><label>Lặp<select data-hhlcl-repeat>${[1, 2, 3, 4, 5].map((count) => `<option ${state.listening.repeats === count ? "selected" : ""}>${count}</option>`).join("")}</select></label><button type="button" data-hhlcl-subtitles>${state.listening.subtitles ? "Ẩn" : "Hiện"} phụ đề</button></div></article><form class="hhlcl-dictation" data-hhlcl-dictation><label>Nghe rồi viết lại<textarea name="answer" rows="5" autocomplete="off" placeholder="Nhập câu bạn nghe được..."></textarea></label><button class="is-primary" type="submit">Kiểm tra dictation</button><div data-hhlcl-dictation-result></div></form>${attemptsMarkup(state.listening.attempts, "Lịch sử dictation")}</section></section>`;
  }

  function rubricMarkup(report) {
    if (!report) return `<div class="hhlcl-empty"><strong>Chưa có phân tích</strong><p>Viết một đoạn rồi chọn Rubric hoặc Xem trước sửa ngữ pháp.</p></div>`;
    if (report.proposed != null) return `<article class="hhlcl-preview"><header><span>BẢN XEM TRƯỚC</span><strong>${report.changed ? `${report.changes.length} đề xuất` : "Chưa phát hiện thay đổi cơ bản"}</strong></header><div><section><small>Bản gốc</small><p>${escapeHtml(report.original)}</p></section><section><small>Đề xuất</small><p>${escapeHtml(report.proposed)}</p></section></div><ul>${report.changes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><footer><button class="is-primary" type="button" data-hhlcl-apply-grammar ${report.changed ? "" : "disabled"}>Áp dụng bản xem trước</button><span>${escapeHtml(report.notice)}</span></footer></article>`;
    return `<article class="hhlcl-rubric"><header><span>RUBRIC TỰ HỌC</span><strong>${report.overall}/100</strong></header><div>${Object.entries(report.dimensions).map(([key, value]) => `<label><span>${escapeHtml({ taskResponse: "Đáp ứng đề", organization: "Tổ chức", vocabulary: "Từ vựng", grammar: "Ngữ pháp" }[key])}</span><progress max="100" value="${value}"></progress><b>${value}</b></label>`).join("")}</div><ul>${report.suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><footer>${escapeHtml(report.notice)}</footer></article>`;
  }

  function writingMarkup(state) {
    return `<section class="hhlcl-workspace"><aside class="hhlcl-side"><small>WRITING STUDIO</small><h2>Sửa có kiểm soát</h2><p>Rubric giúp tự học. Mọi sửa đổi đều hiện trước/sau và chỉ áp dụng sau khi bạn xác nhận.</p><div class="hhlcl-note">Không tự sửa điểm · Không tự ghi đè bài viết</div></aside><section class="hhlcl-main"><label class="hhlcl-editor">Bản nháp<textarea rows="14" data-hhlcl-writing placeholder="Write your paragraph here...">${escapeHtml(state.writing.draft)}</textarea><span><b data-hhlcl-word-count>${words(state.writing.draft).length}</b> từ</span></label><div class="hhlcl-actions"><button type="button" data-hhlcl-rubric>Chấm theo rubric</button><button class="is-primary" type="button" data-hhlcl-grammar>Xem trước sửa ngữ pháp</button></div><div data-hhlcl-writing-result>${rubricMarkup(state.writing.preview)}</div></section></section>`;
  }

  function careerMarkup(state) {
    const career = CAREERS[state.careerSimulator.careerId];
    return `<section class="hhlcl-workspace"><aside class="hhlcl-side"><small>CAREER SIMULATOR</small><h2>Luyện tình huống nghề nghiệp</h2><p>Mô phỏng phỏng vấn và hội thoại theo vai. Coach phản hồi sau từng lượt nhưng không tự chấm điểm chính thức.</p><label>Chọn bối cảnh<select data-hhlcl-career-sim>${Object.entries(CAREERS).map(([id, item]) => `<option value="${id}" ${id === state.careerSimulator.careerId ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></label><article class="hhlcl-brief"><small>NHIỆM VỤ</small><strong>${escapeHtml(career.scenario)}</strong><span>Vai của bạn: ${escapeHtml(career.role)}</span></article></aside><section class="hhlcl-main"><div class="hhlcl-chat" data-hhlcl-chat>${state.careerSimulator.messages.length ? state.careerSimulator.messages.map((item) => `<article class="is-${item.role}"><small>${item.role === "learner" ? "Bạn" : "Coach"}</small><p>${escapeHtml(item.text)}</p></article>`).join("") : `<div class="hhlcl-empty"><strong>Sẵn sàng roleplay</strong><p>Bắt đầu để nhận câu hỏi đầu tiên theo đúng chuyên ngành.</p></div>`}</div><div class="hhlcl-actions"><button type="button" data-hhlcl-start-roleplay>Bắt đầu / làm mới</button><button type="button" data-hhlcl-hear-roleplay ${state.careerSimulator.messages.some((item) => item.role === "coach") ? "" : "disabled"}>Nghe câu Coach</button></div><form data-hhlcl-roleplay><label>Phản hồi của bạn<textarea name="reply" rows="4" placeholder="Type your response in English..."></textarea></label><button class="is-primary" type="submit">Gửi phản hồi</button></form><div data-hhlcl-career-feedback>${state.careerSimulator.feedback ? resultMarkup(state.careerSimulator.feedback) : ""}</div></section></section>`;
  }

  function attemptsMarkup(attempts, title) {
    return `<section class="hhlcl-attempts"><header><strong>${escapeHtml(title)}</strong><span>${attempts.length} lượt</span></header>${attempts.length ? attempts.slice(0, 6).map((item) => `<article><b>${item.score}</b><div><strong>${escapeHtml(item.transcript || "Không có transcript")}</strong><small>${new Date(item.createdAt).toLocaleString("vi-VN")} · không phải điểm chính thức</small></div></article>`).join("") : `<p>Chưa có attempt trên thiết bị này.</p>`}</section>`;
  }

  function createController(target, options = {}) {
    if (!target || typeof target.addEventListener !== "function") throw new TypeError("HHLearningCoachLabs.mount cần một phần tử đích hợp lệ.");
    const memory = createMemoryStore(options.storage || root.localStorage);
    const coreStore = options.store || (root.HHLearningCore?.createStore ? root.HHLearningCore.createStore(options.storage || root.localStorage) : null);
    let state = memory.get();
    if (VIEWS.includes(options.view)) state.view = options.view;
    let recognition = null;
    let recorder = null;
    let recordingUrl = "";
    let recordingChunks = [];
    const streams = new Set();
    let destroyed = false;
    let toastTimer = null;

    const save = (message = "") => {
      state = memory.set(state);
      if (message) toast(message);
    };
    const toast = (message) => {
      const node = target.querySelector?.("[data-hhlcl-toast]");
      if (!node) return;
      node.textContent = clean(message, 240);
      node.classList.add("is-visible");
      if (toastTimer) root.clearTimeout?.(toastTimer);
      toastTimer = root.setTimeout?.(() => node.classList.remove("is-visible"), 2600);
    };
    const renderStage = () => {
      if (destroyed) return;
      const stage = target.querySelector("[data-hhlcl-stage]");
      if (!stage) return;
      if (state.view === "coach") stage.innerHTML = coachMarkup(state);
      else if (state.view === "speaking") stage.innerHTML = speakingMarkup(state);
      else if (state.view === "listening") stage.innerHTML = listeningMarkup(state);
      else if (state.view === "writing") stage.innerHTML = writingMarkup(state);
      else stage.innerHTML = careerMarkup(state);
      target.querySelectorAll("[data-hhlcl-view]").forEach((button) => { button.classList.toggle("is-active", button.dataset.hhlclView === state.view); button.setAttribute("aria-current", button.dataset.hhlclView === state.view ? "page" : "false"); });
    };
    const render = () => { target.innerHTML = shellMarkup(state); renderStage(); };
    const currentScenario = () => SPEAKING_SCENARIOS.find((item) => item.id === state.speaking.scenarioId) || SPEAKING_SCENARIOS[0];
    const currentListening = () => LISTENING_ITEMS.find((item) => item.id === state.listening.itemId) || LISTENING_ITEMS[0];
    const speak = (text, rate = 0.9, repeats = 1) => {
      if (!root.speechSynthesis || typeof root.SpeechSynthesisUtterance !== "function") return toast("Trình duyệt chưa hỗ trợ đọc văn bản.");
      root.speechSynthesis.cancel();
      let count = 0;
      const play = () => { if (destroyed || count >= repeats) return; count += 1; const utterance = new root.SpeechSynthesisUtterance(text); utterance.lang = "en-US"; utterance.rate = rate; utterance.onend = play; root.speechSynthesis.speak(utterance); };
      play();
    };
    const stopMedia = () => {
      try { recognition?.abort?.(); } catch {}
      recognition = null;
      if (recorder?.state === "recording") { try { recorder.stop(); } catch {} }
      recorder = null;
      streams.forEach((stream) => stream?.getTracks?.().forEach((track) => track.stop()));
      streams.clear();
      root.speechSynthesis?.cancel?.();
      if (recordingUrl) { root.URL?.revokeObjectURL?.(recordingUrl); recordingUrl = ""; }
    };
    const micErrorMessage = (error) => {
      const name = clean(error?.name, 80);
      if (["NotAllowedError", "PermissionDeniedError"].includes(name)) return "Bạn chưa cấp quyền micro. Hãy cho phép trong cài đặt trình duyệt hoặc nhập transcript thủ công.";
      if (["NotFoundError", "DevicesNotFoundError"].includes(name)) return "Không tìm thấy micro. Bạn vẫn có thể nhập transcript thủ công để luyện.";
      return clean(error?.message || "Không thể mở micro trên thiết bị này.", 180);
    };
    const requestMic = async () => {
      if (!root.navigator?.mediaDevices?.getUserMedia) { state.speaking.micPermission = "unavailable"; memory.set(state); throw new Error("Trình duyệt chưa hỗ trợ micro. Hãy dùng transcript thủ công."); }
      try {
        const stream = await root.navigator.mediaDevices.getUserMedia({ audio: true });
        state.speaking.micPermission = "granted";
        memory.set(state);
        streams.add(stream);
        return stream;
      } catch (error) {
        state.speaking.micPermission = ["NotAllowedError", "PermissionDeniedError"].includes(error?.name) ? "denied" : "unavailable";
        memory.set(state);
        throw new Error(micErrorMessage(error));
      }
    };
    const addAttempt = (kind, comparison, transcript, targetText) => {
      const attempt = normalizeAttempt({ id: uid("attempt"), type: kind, target: targetText, transcript, ...comparison, createdAt: new Date().toISOString() });
      if (kind === "speaking") state.speaking.attempts.unshift(attempt); else state.listening.attempts.unshift(attempt);
      try { coreStore?.recordStudy?.({ type: kind, minutes: 2, score: attempt.score, xp: 8, skills: [kind] }); } catch {}
      save();
      return attempt;
    };
    const startRecognition = async () => {
      const status = target.querySelector("[data-hhlcl-mic-status]");
      try {
        const permissionStream = await requestMic();
        permissionStream.getTracks().forEach((track) => track.stop());
        streams.delete(permissionStream);
        const Recognition = root.SpeechRecognition || root.webkitSpeechRecognition;
        if (!Recognition) throw new Error("Trình duyệt đã cấp micro nhưng chưa hỗ trợ SpeechRecognition.");
        recognition = new Recognition();
        recognition.lang = "en-US";
        recognition.interimResults = true;
        recognition.continuous = false;
        const startedAt = Date.now();
        recognition.onstart = () => { if (status) status.textContent = "Đang nghe..."; };
        recognition.onresult = (event) => {
          const transcript = Array.from(event.results || []).map((result) => result[0]?.transcript || "").join(" ").trim();
          const output = target.querySelector("[data-hhlcl-transcript]");
          if (output) output.textContent = transcript || "Đang nhận dạng...";
          if (event.results?.[event.results.length - 1]?.isFinal) {
            const comparison = compareTranscript(transcript, currentScenario().phrase, (Date.now() - startedAt) / 1000);
            state.speaking.transcript = transcript;
            addAttempt("speaking", comparison, transcript, currentScenario().phrase);
            const score = target.querySelector("[data-hhlcl-speaking-score]");
            if (score) score.innerHTML = `<article class="hhlcl-score"><b>${comparison.score}</b><span>${comparison.missing.length ? `Cần rõ hơn: ${escapeHtml(comparison.missing.join(", "))}` : "Khớp tốt với câu mẫu."}</span><small>${escapeHtml(comparison.notice)}</small></article>`;
          }
        };
        recognition.onerror = (event) => { if (status) status.textContent = `Không thể nhận dạng: ${clean(event.error || "lỗi micro", 80)}`; };
        recognition.onend = () => { recognition = null; if (status) status.textContent = "Đã kết thúc"; };
        recognition.start();
      } catch (error) { if (status) status.textContent = clean(error.message, 180); }
    };
    const startRecording = async () => {
      const status = target.querySelector("[data-hhlcl-mic-status]");
      try {
        const stream = await requestMic();
        if (typeof root.MediaRecorder !== "function") throw new Error("Trình duyệt chưa hỗ trợ ghi âm.");
        recordingChunks = [];
        recorder = new root.MediaRecorder(stream);
        recorder.ondataavailable = (event) => { if (event.data?.size) recordingChunks.push(event.data); };
        recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
          streams.delete(stream);
          state.speaking.recording = false;
          save();
          const blob = recordingChunks.length ? new Blob(recordingChunks, { type: recorder?.mimeType || "audio/webm" }) : null;
          if (blob && root.URL?.createObjectURL) {
            if (recordingUrl) root.URL.revokeObjectURL(recordingUrl);
            recordingUrl = root.URL.createObjectURL(blob);
            const audio = target.querySelector("[data-hhlcl-recording-preview]");
            const download = target.querySelector("[data-hhlcl-download-recording]");
            if (audio) { audio.src = recordingUrl; audio.hidden = false; }
            if (download) { download.href = recordingUrl; download.hidden = false; }
          }
          recordingChunks = [];
          if (status) status.textContent = "Đã ghi xong. Bạn có thể nghe lại hoặc nhập transcript để đánh giá.";
          target.querySelector("[data-hhlcl-record]")?.removeAttribute("disabled");
          target.querySelector("[data-hhlcl-stop]")?.setAttribute("disabled", "");
        };
        recorder.start();
        state.speaking.recording = true;
        target.querySelector("[data-hhlcl-record]")?.setAttribute("disabled", "");
        target.querySelector("[data-hhlcl-stop]")?.removeAttribute("disabled");
        if (status) status.textContent = "Đang ghi âm trên thiết bị...";
      } catch (error) { streams.forEach((stream) => stream.getTracks?.().forEach((track) => track.stop())); streams.clear(); if (status) status.textContent = micErrorMessage(error); }
    };
    const runCoach = async (task, payload) => {
      const response = await runCoachTask(task, payload, { runAI: options.runAI });
      return { ...response, result: { title: response.result?.title || "Bản gợi ý", ...(response.result || {}) } };
    };

    const onClick = async (event) => {
      const viewButton = event.target.closest("[data-hhlcl-view]");
      if (viewButton) { stopMedia(); state.view = viewButton.dataset.hhlclView; save(); renderStage(); return; }
      const taskButton = event.target.closest("[data-hhlcl-task]");
      if (taskButton) { state.coach.task = taskButton.dataset.hhlclTask; state.coach.hintIndex = 1; save(); renderStage(); return; }
      if (event.target.closest("[data-hhlcl-next-hint]")) { state.coach.hintIndex = clamp(state.coach.hintIndex + 1, 1, 8); save(); renderStage(); return; }
      const scenarioButton = event.target.closest("[data-hhlcl-scenario]");
      if (scenarioButton) { stopMedia(); state.speaking.scenarioId = scenarioButton.dataset.hhlclScenario; save(); renderStage(); return; }
      const listeningButton = event.target.closest("[data-hhlcl-listening]");
      if (listeningButton) { root.speechSynthesis?.cancel?.(); state.listening.itemId = listeningButton.dataset.hhlclListening; save(); renderStage(); return; }
      if (event.target.closest("[data-hhlcl-speak]")) { const mode = event.target.closest("[data-hhlcl-speak]").dataset.hhlclSpeak; speak(currentScenario().phrase, mode === "slow" ? 0.62 : 0.9, 1); return; }
      if (event.target.closest("[data-hhlcl-recognize]")) { await startRecognition(); return; }
      if (event.target.closest("[data-hhlcl-record]")) { await startRecording(); return; }
      if (event.target.closest("[data-hhlcl-stop]")) { try { recognition?.stop?.(); recorder?.stop?.(); } catch {} return; }
      if (event.target.closest("[data-hhlcl-listen-play]")) { speak(currentListening().text, state.listening.rate, state.listening.repeats); return; }
      if (event.target.closest("[data-hhlcl-subtitles]")) { state.listening.subtitles = !state.listening.subtitles; save(); renderStage(); return; }
      if (event.target.closest("[data-hhlcl-rubric]")) { state.writing.preview = writingRubric(state.writing.draft, options.level || "A2"); state.writing.reports.unshift(normalizeHistory({ task: "rubric", title: "Writing rubric", source: "local" })); save(); renderStage(); return; }
      if (event.target.closest("[data-hhlcl-grammar]")) { state.writing.preview = grammarPreview(state.writing.draft); save(); renderStage(); return; }
      if (event.target.closest("[data-hhlcl-apply-grammar]")) { const preview = state.writing.preview; if (preview?.proposed != null) { state.writing.draft = clean(preview.proposed, 12000); state.writing.preview = { ...preview, applied: true }; save("Đã áp dụng sau khi bạn xác nhận."); renderStage(); } return; }
      if (event.target.closest("[data-hhlcl-start-roleplay]")) {
        const career = CAREERS[state.careerSimulator.careerId];
        state.careerSimulator.messages = [{ role: "coach", text: `${career.scenario} I will play the other role. Please introduce yourself and explain your first step.`, at: new Date().toISOString() }];
        state.careerSimulator.feedback = null; save(); renderStage(); return;
      }
      if (event.target.closest("[data-hhlcl-hear-roleplay]")) { const message = [...state.careerSimulator.messages].reverse().find((item) => item.role === "coach"); if (message) speak(message.text, 0.82, 1); return; }
    };

    const onSubmit = async (event) => {
      const coachForm = event.target.closest("[data-hhlcl-coach-form]");
      if (coachForm) {
        event.preventDefault();
        const button = coachForm.querySelector("button[type=submit]"); button.disabled = true; button.textContent = "Đang chuẩn bị gợi ý...";
        state.coach.prompt = clean(new FormData(coachForm).get("prompt"), 3000);
        let coreState = null; try { coreState = coreStore?.get?.(); } catch {}
        state.coach.output = await runCoach(state.coach.task, { prompt: state.coach.prompt, career: state.career, level: coreState?.profile?.level || state.coach.level || options.level, dailyMinutes: coreState?.profile?.dailyMinutes || state.coach.dailyMinutes, priority: state.coach.priority, mistakes: coreState?.mistakes || [], sessions: coreState?.sessions?.length || 0 });
        state.coach.hintIndex = 1;
        state.coach.history.unshift(normalizeHistory({ task: state.coach.task, title: state.coach.output.result?.title, source: state.coach.output.source }));
        save(); renderStage(); return;
      }
      const dictationForm = event.target.closest("[data-hhlcl-dictation]");
      if (dictationForm) {
        event.preventDefault(); const transcript = clean(new FormData(dictationForm).get("answer"), 2000); const comparison = compareTranscript(transcript, currentListening().text); addAttempt("listening", comparison, transcript, currentListening().text); const result = dictationForm.querySelector("[data-hhlcl-dictation-result]"); if (result) result.innerHTML = `<article class="hhlcl-score"><b>${comparison.score}</b><span>${comparison.missing.length ? `Còn thiếu: ${escapeHtml(comparison.missing.join(", "))}` : "Bạn đã nghe đúng các từ chính."}</span><small>${escapeHtml(comparison.notice)}</small></article>`; return;
      }
      const manualTranscriptForm = event.target.closest("[data-hhlcl-manual-transcript]");
      if (manualTranscriptForm) {
        event.preventDefault();
        const transcript = clean(new FormData(manualTranscriptForm).get("transcript"), 2000);
        if (!transcript) return toast("Hãy nhập câu bạn vừa nói.");
        const comparison = compareTranscript(transcript, currentScenario().phrase);
        state.speaking.manualTranscript = transcript;
        state.speaking.transcript = transcript;
        addAttempt("speaking", comparison, transcript, currentScenario().phrase);
        renderStage();
        const score = target.querySelector("[data-hhlcl-speaking-score]");
        if (score) score.innerHTML = `<article class="hhlcl-score"><b>${comparison.score}</b><span>${comparison.missing.length ? `Cần luyện thêm: ${escapeHtml(comparison.missing.join(", "))}` : "Các từ chính đã khớp với câu mẫu."}</span><small>${escapeHtml(comparison.notice)}</small></article>`;
        return;
      }
      const roleplayForm = event.target.closest("[data-hhlcl-roleplay]");
      if (roleplayForm) {
        event.preventDefault(); const reply = clean(new FormData(roleplayForm).get("reply"), 1200); if (!reply) return;
        const career = CAREERS[state.careerSimulator.careerId]; state.careerSimulator.messages.push({ role: "learner", text: reply, at: new Date().toISOString() });
        const feedback = await runCoach("career-example", { prompt: reply, career: state.careerSimulator.careerId });
        state.careerSimulator.messages.push({ role: "coach", text: `Good start. Can you add one concrete detail and use “${career.terms[0]}” in your next answer?`, at: new Date().toISOString() });
        state.careerSimulator.feedback = { ...feedback, result: { title: "Phản hồi sau lượt nói", summary: `Hãy làm câu trả lời cụ thể hơn và dùng từ ${career.terms.join(", ")}.`, next: "Trả lời tiếp bằng 2–3 câu." } };
        save(); renderStage(); return;
      }
    };

    const onInput = (event) => {
      if (event.target.matches("[data-hhlcl-writing]")) { state.writing.draft = clean(event.target.value, 12000); const counter = target.querySelector("[data-hhlcl-word-count]"); if (counter) counter.textContent = words(state.writing.draft).length; memory.set(state); }
    };
    const onChange = (event) => {
      if (event.target.matches("[data-hhlcl-career]")) { state.career = event.target.value; save(); renderStage(); }
      if (event.target.matches("[data-hhlcl-level]")) { state.coach.level = event.target.value; save(); render(); }
      if (event.target.matches("[data-hhlcl-minutes]")) { state.coach.dailyMinutes = clamp(event.target.value, 5, 120); save(); render(); }
      if (event.target.matches("[data-hhlcl-priority]")) { state.coach.priority = event.target.value; save(); renderStage(); }
      if (event.target.matches("[data-hhlcl-rate]")) { state.listening.rate = clamp(event.target.value, 0.5, 1.15); save(); event.target.nextElementSibling.textContent = `${state.listening.rate}×`; }
      if (event.target.matches("[data-hhlcl-repeat]")) { state.listening.repeats = clamp(event.target.value, 1, 5); save(); }
      if (event.target.matches("[data-hhlcl-career-sim]")) { state.careerSimulator.careerId = event.target.value; state.careerSimulator.messages = []; state.careerSimulator.feedback = null; save(); renderStage(); }
    };
    const onKeydown = (event) => { if (event.key === "Escape") stopMedia(); };

    target.addEventListener("click", onClick);
    target.addEventListener("submit", onSubmit);
    target.addEventListener("input", onInput);
    target.addEventListener("change", onChange);
    root.document?.addEventListener?.("keydown", onKeydown);
    render();

    return Object.freeze({
      getState: () => clone(state),
      setView: (view) => { if (!VIEWS.includes(view)) return false; stopMedia(); state.view = view; save(); renderStage(); return true; },
      runCoach: (task, payload) => runCoachTask(task, payload, { runAI: options.runAI }),
      destroy: () => {
        if (destroyed) return;
        destroyed = true; stopMedia();
        target.removeEventListener("click", onClick); target.removeEventListener("submit", onSubmit); target.removeEventListener("input", onInput); target.removeEventListener("change", onChange); root.document?.removeEventListener?.("keydown", onKeydown);
        if (toastTimer) root.clearTimeout?.(toastTimer);
        target.innerHTML = "";
      },
      unmount() { this.destroy(); }
    });
  }

  let activeController = null;
  const api = Object.freeze({
    STORAGE_KEY,
    LOCAL_LABEL,
    VIEWS,
    CAREERS,
    LOCAL_TUTOR_SOURCES,
    SPEAKING_SCENARIOS,
    LISTENING_ITEMS,
    defaultState,
    normalizeState,
    compareTranscript,
    writingRubric,
    grammarPreview,
    localCoach,
    localTutorEvidence,
    runCoachTask,
    sanitizeAIResult,
    createMemoryStore,
    mount(target, options = {}) { activeController?.destroy?.(); activeController = createController(target, options); return activeController; },
    mountAll(selector = "[data-hh-learning-coach-labs]", options = {}) { return Array.from(root.document?.querySelectorAll?.(selector) || []).map((target) => createController(target, options)); },
    unmount() { activeController?.destroy?.(); activeController = null; }
  });

  root.HHLearningCoachLabs = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
