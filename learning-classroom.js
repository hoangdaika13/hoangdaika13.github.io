(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const VERSION = 1;
  const STORAGE_KEY = "hh.learning.classroom.v1";
  const VIEWS = Object.freeze(["assessments", "certificates", "classroom", "study-together", "catch-up"]);
  const VIEW_ALIASES = Object.freeze({ placement: "assessments", project: "study-together", projects: "study-together", "project-practice": "study-together" });
  const ASSESSMENT_TYPES = Object.freeze(["placement", "lesson-quiz", "unit-test", "course-challenge", "timed-mock"]);
  const ROLES = Object.freeze(["teacher", "student"]);
  const MAX = Object.freeze({ attempts: 120, classes: 24, assignments: 240, submissions: 500, discussions: 500, strokes: 1800, mistakes: 300, activities: 500, projects: 80, groups: 40, knowledge: 300 });
  const DEFAULT_DURATION = Object.freeze({ placement: 15, "lesson-quiz": 5, "unit-test": 20, "course-challenge": 30, "timed-mock": 60 });
  const PLACEMENT_BANDS = Object.freeze([
    { min: 92, level: "C2", label: "C2", rationale: "Consistent accuracy across the available diagnostic items." },
    { min: 84, level: "C1", label: "C1", rationale: "Strong independent control; confirm with more productive evidence." },
    { min: 72, level: "B2", label: "B2", rationale: "Upper-intermediate comprehension in this local sample." },
    { min: 60, level: "B1", label: "B1", rationale: "Independent everyday and workplace practice is a useful next step." },
    { min: 45, level: "A2", label: "A2", rationale: "Build confidence with familiar situations before increasing complexity." },
    { min: 25, level: "A1", label: "A1", rationale: "Start with guided phrases and high-frequency vocabulary." },
    { min: 0, level: "A0", label: "A0", rationale: "Begin with the foundations and a supportive pace." }
  ]);
  const TYPE_LABELS = Object.freeze({
    placement: "Kiểm tra đầu vào",
    "lesson-quiz": "Quiz bài học",
    "unit-test": "Bài kiểm tra học phần",
    "course-challenge": "Thử thách khóa học",
    "timed-mock": "Thi thử có giới hạn"
  });
  const RUBRIC = Object.freeze({
    writing: ["Nội dung", "Tổ chức", "Từ vựng", "Ngữ pháp"],
    speaking: ["Hoàn thành nhiệm vụ", "Trôi chảy", "Phát âm", "Từ vựng và ngữ pháp"]
  });

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const clean = (value, max = 240) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  const uid = (prefix = "item") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const iso = (value = Date.now()) => new Date(value).toISOString();
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const list = (value, limit = 100) => Array.isArray(value) ? value.slice(0, limit) : [];
  const validDate = (value, fallback = Date.now()) => Number.isFinite(Date.parse(value)) ? iso(Date.parse(value)) : iso(fallback);
  const roleOf = (classroom, userId) => classroom?.members?.find((member) => member.userId === userId)?.role || null;
  const canTeach = (classroom, userId) => roleOf(classroom, userId) === "teacher";
  const classCode = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  const todayKey = (value = Date.now()) => new Date(value).toISOString().slice(0, 10);
  const MASTERY_LABELS = Object.freeze({ familiar: "Đang làm quen", understood: "Đã hiểu", mastered: "Thành thạo", review: "Cần ôn lại" });

  function defaultMissions(date = todayKey()) {
    return [
      { id: `${date}-learn`, date, title: "Học một nội dung mới", type: "learn", xp: 15, completed: false },
      { id: `${date}-review`, date, title: "Ôn lại một lỗi gần đây", type: "review", xp: 10, completed: false },
      { id: `${date}-challenge`, date, title: "Hoàn thành kiểm tra nhanh", type: "challenge", xp: 20, completed: false }
    ];
  }

  const QUESTION_BANK = Object.freeze([
    { id: "q-vocab-1", skill: "vocabulary", kind: "choice", prompt: "Chọn nghĩa đúng của 'deadline'.", options: ["Hạn chót", "Kỳ nghỉ", "Cuộc họp", "Hóa đơn"], answer: "Hạn chót" },
    { id: "q-grammar-1", skill: "grammar", kind: "choice", prompt: "She ___ the report yesterday.", options: ["finish", "finished", "finishing", "finishes"], answer: "finished" },
    { id: "q-reading-1", skill: "reading", kind: "choice", prompt: "A meeting was postponed. Điều gì đã xảy ra?", options: ["Cuộc họp bị hoãn", "Cuộc họp kết thúc", "Cuộc họp trực tuyến", "Cuộc họp bị hủy vĩnh viễn"], answer: "Cuộc họp bị hoãn" },
    { id: "q-listening-1", skill: "listening", kind: "choice", prompt: "Trong ngữ cảnh sân bay, 'boarding gate' là gì?", options: ["Cửa lên máy bay", "Quầy đổi tiền", "Băng chuyền hành lý", "Lối ra"], answer: "Cửa lên máy bay" },
    { id: "q-writing-1", skill: "writing", kind: "rubric", prompt: "Viết email 60-80 từ xin dời lịch họp và nêu lý do.", rubric: "writing" },
    { id: "q-speaking-1", skill: "speaking", kind: "rubric", prompt: "Trình bày 60 giây về mục tiêu học tập tuần này.", rubric: "speaking" },
    { id: "q-vocab-2", skill: "vocabulary", kind: "choice", prompt: "Từ nào gần nghĩa nhất với 'reliable'?", options: ["Đáng tin cậy", "Đắt tiền", "Nhanh chóng", "Phức tạp"], answer: "Đáng tin cậy" },
    { id: "q-grammar-2", skill: "grammar", kind: "choice", prompt: "If I had more time, I ___ another course.", options: ["take", "will take", "would take", "took"], answer: "would take" },
    { id: "q-reading-2", skill: "reading", kind: "choice", prompt: "'Please submit before Friday' yêu cầu điều gì?", options: ["Nộp trước thứ Sáu", "Bắt đầu vào thứ Sáu", "Nộp sau thứ Sáu", "Hủy vào thứ Sáu"], answer: "Nộp trước thứ Sáu" },
    { id: "q-vocab-3", skill: "vocabulary", kind: "choice", prompt: "Trong công nghệ, 'deployment' thường có nghĩa là gì?", options: ["Triển khai", "Thiết kế", "Xóa dữ liệu", "Tuyển dụng"], answer: "Triển khai" },
    { id: "q-grammar-3", skill: "grammar", kind: "choice", prompt: "The files ___ by the team every week.", options: ["review", "are reviewed", "reviewed", "is reviewing"], answer: "are reviewed" },
    { id: "q-reading-3", skill: "reading", kind: "choice", prompt: "'Out of stock' cho biết sản phẩm thế nào?", options: ["Hết hàng", "Đang giảm giá", "Bị lỗi", "Được đặt trước"], answer: "Hết hàng" }
  ]);

  function defaultState() {
    return {
      version: VERSION,
      currentUser: { id: "local-user", name: "Học viên HH", role: "student" },
      activeView: "assessments",
      assessments: [],
      attempts: [],
      placement: { recommendedLevel: null, score: null, confidence: "pending", recommendationOnly: true, assessedAt: null },
      certificates: [],
      classrooms: [],
      assignments: [],
      submissions: [],
      discussions: [],
      passport: { xp: 0, minutes: 0, streak: 0, lastStudyDate: null, skills: {}, achievements: [], activities: [] },
      mistakeNotebook: [],
      projectLessons: [],
      knowledgeLoop: [],
      dailyMissions: defaultMissions(),
      studyGroups: [],
      studyRooms: [],
      pomodoro: { mode: "focus", duration: 25 * 60, remaining: 25 * 60, running: false, updatedAt: iso(), rounds: 0 },
      whiteboards: {},
      adapter: { connected: false, confirmed: false, name: "local", capabilities: [], lastSyncAt: null, confirmedAt: null, error: "" },
      ui: { selectedClassId: "", selectedAssessmentId: "", notice: "", timerStartedAt: null },
      updatedAt: iso()
    };
  }

  function normalizeQuestion(value) {
    const kind = value?.kind === "rubric" ? "rubric" : "choice";
    return {
      id: clean(value?.id || uid("question"), 80),
      skill: clean(value?.skill || "general", 40),
      kind,
      prompt: clean(value?.prompt, 500),
      options: kind === "choice" ? list(value?.options, 8).map((item) => clean(item, 160)).filter(Boolean) : [],
      answer: kind === "choice" ? clean(value?.answer, 160) : "",
      rubric: kind === "rubric" && RUBRIC[value?.rubric] ? value.rubric : kind === "rubric" ? "writing" : ""
    };
  }

  function normalizeState(input) {
    const base = defaultState();
    const value = input && typeof input === "object" ? input : {};
    const currentUser = value.currentUser && typeof value.currentUser === "object" ? value.currentUser : base.currentUser;
    const state = {
      ...base,
      currentUser: { id: clean(currentUser.id || base.currentUser.id, 80), name: clean(currentUser.name || base.currentUser.name, 80), role: ROLES.includes(currentUser.role) ? currentUser.role : "student", placementLevel: ["A0", "A1", "A2", "B1", "B2", "C1", "C2"].includes(currentUser.placementLevel) ? currentUser.placementLevel : null },
      activeView: VIEWS.includes(value.activeView) ? value.activeView : base.activeView,
      assessments: list(value.assessments, 100).map((item) => ({
        id: clean(item?.id || uid("assessment"), 80), type: ASSESSMENT_TYPES.includes(item?.type) ? item.type : "lesson-quiz", title: clean(item?.title || TYPE_LABELS[item?.type] || "Bài đánh giá", 160),
        durationMinutes: clamp(item?.durationMinutes || DEFAULT_DURATION[item?.type] || 10, 1, 240), shuffle: item?.shuffle !== false,
        questions: list(item?.questions, 100).map(normalizeQuestion).filter((question) => question.prompt), createdAt: validDate(item?.createdAt), ownerId: clean(item?.ownerId || "system", 80)
      })),
      attempts: list(value.attempts, MAX.attempts).map((item) => ({
        id: clean(item?.id || uid("attempt"), 80), assessmentId: clean(item?.assessmentId, 80), userId: clean(item?.userId || currentUser.id, 80),
        score: clamp(item?.score, 0, 100), autoScore: clamp(item?.autoScore, 0, 100), status: ["submitted", "needs-rubric", "graded"].includes(item?.status) ? item.status : "submitted",
        answers: Object.fromEntries(Object.entries(item?.answers || {}).slice(0, 100).map(([key, answer]) => [clean(key, 80), clean(answer, 2000)])),
        rubricScores: Object.fromEntries(Object.entries(item?.rubricScores || {}).slice(0, 20).map(([key, score]) => [clean(key, 80), clamp(score, 0, 100)])),
        feedback: clean(item?.feedback, 2000), recommendedLevel: ["A0", "A1", "A2", "B1", "B2", "C1", "C2"].includes(item?.recommendedLevel) ? item.recommendedLevel : null,
        startedAt: validDate(item?.startedAt), submittedAt: validDate(item?.submittedAt), elapsedSeconds: clamp(item?.elapsedSeconds, 0, 86_400), recommendationOnly: true
      })),
      placement: {
        recommendedLevel: ["A0", "A1", "A2", "B1", "B2", "C1", "C2"].includes(value.placement?.recommendedLevel) ? value.placement.recommendedLevel : null,
        score: value.placement?.score == null ? null : clamp(value.placement.score, 0, 100),
        confidence: ["pending", "indicative"].includes(value.placement?.confidence) ? value.placement.confidence : "pending",
        recommendationOnly: true,
        assessedAt: value.placement?.assessedAt ? validDate(value.placement.assessedAt) : null
      },
      certificates: list(value.certificates, 80).map((item) => ({
        id: clean(item?.id || uid("certificate"), 80), code: clean(item?.code, 48), title: clean(item?.title || "HH Learning", 160), learner: clean(item?.learner || currentUser.name, 100), score: clamp(item?.score, 0, 100), issuedAt: validDate(item?.issuedAt), localPreview: true, onlineVerified: false
      })),
      classrooms: list(value.classrooms, MAX.classes).map((item) => ({
        id: clean(item?.id || uid("class"), 80), code: clean(item?.code || classCode(), 12).toUpperCase(), name: clean(item?.name || "Lớp học HH", 120), ownerId: clean(item?.ownerId || currentUser.id, 80), createdAt: validDate(item?.createdAt),
        members: list(item?.members, 100).map((member) => ({ userId: clean(member?.userId, 80), name: clean(member?.name, 80), role: ROLES.includes(member?.role) ? member.role : "student", joinedAt: validDate(member?.joinedAt) })).filter((member) => member.userId)
      })),
      assignments: list(value.assignments, MAX.assignments).map((item) => ({
        id: clean(item?.id || uid("assignment"), 80), classId: clean(item?.classId, 80), title: clean(item?.title, 180), instructions: clean(item?.instructions, 3000), target: item?.target === "individual" ? "individual" : "group", assigneeIds: list(item?.assigneeIds, 100).map((id) => clean(id, 80)), dueAt: validDate(item?.dueAt, Date.now() + 86_400_000), createdBy: clean(item?.createdBy, 80), createdAt: validDate(item?.createdAt), points: clamp(item?.points || 100, 1, 1000)
      })),
      submissions: list(value.submissions, MAX.submissions).map((item) => ({
        id: clean(item?.id || uid("submission"), 80), assignmentId: clean(item?.assignmentId, 80), userId: clean(item?.userId, 80), text: clean(item?.text, 5000), links: list(item?.links, 12).map((link) => clean(link, 500)), fileMetadata: list(item?.fileMetadata, 12).map((file) => ({ name: clean(file?.name, 160), type: clean(file?.type, 80), size: clamp(file?.size, 0, 10_000_000), lastModified: clamp(file?.lastModified, 0, Date.now()) })), status: ["submitted", "returned", "graded"].includes(item?.status) ? item.status : "submitted", submittedAt: validDate(item?.submittedAt), score: item?.score == null ? null : clamp(item.score, 0, 1000), feedback: clean(item?.feedback, 3000), gradedBy: clean(item?.gradedBy, 80), gradedAt: item?.gradedAt ? validDate(item.gradedAt) : null
      })),
      discussions: list(value.discussions, MAX.discussions).map((item) => ({ id: clean(item?.id || uid("discussion"), 80), classId: clean(item?.classId, 80), userId: clean(item?.userId, 80), author: clean(item?.author, 80), text: clean(item?.text, 2000), createdAt: validDate(item?.createdAt), parentId: clean(item?.parentId, 80) })),
      passport: {
        xp: clamp(value.passport?.xp, 0, 10_000_000), minutes: clamp(value.passport?.minutes, 0, 10_000_000), streak: clamp(value.passport?.streak, 0, 3650), lastStudyDate: /^\d{4}-\d{2}-\d{2}$/.test(value.passport?.lastStudyDate) ? value.passport.lastStudyDate : null,
        skills: Object.fromEntries(Object.entries(value.passport?.skills || {}).slice(0, 80).map(([skill, item]) => [clean(skill, 50), { score: clamp(item?.score, 0, 100), attempts: clamp(item?.attempts, 0, 9999), status: ["familiar", "understood", "mastered", "review"].includes(item?.status) ? item.status : "familiar", lastStudiedAt: validDate(item?.lastStudiedAt) }])),
        achievements: list(value.passport?.achievements, 100).map((item) => ({ id: clean(item?.id || uid("badge"), 80), title: clean(item?.title, 120), earnedAt: validDate(item?.earnedAt) })),
        activities: list(value.passport?.activities, MAX.activities).map((item) => ({ id: clean(item?.id || uid("activity"), 80), type: clean(item?.type, 40), title: clean(item?.title, 180), xp: clamp(item?.xp, 0, 1000), minutes: clamp(item?.minutes, 0, 720), score: item?.score == null ? null : clamp(item.score, 0, 100), createdAt: validDate(item?.createdAt) }))
      },
      mistakeNotebook: list(value.mistakeNotebook, MAX.mistakes).map((item) => ({ id: clean(item?.id || uid("mistake"), 80), skill: clean(item?.skill || "general", 50), prompt: clean(item?.prompt, 500), userAnswer: clean(item?.userAnswer, 500), correctAnswer: clean(item?.correctAnswer, 500), reviewCount: clamp(item?.reviewCount, 0, 999), mastered: Boolean(item?.mastered), createdAt: validDate(item?.createdAt), nextReviewAt: validDate(item?.nextReviewAt, Date.now() + 86_400_000) })),
      projectLessons: list(value.projectLessons, MAX.projects).map((item) => ({ id: clean(item?.id || uid("project-lesson"), 80), title: clean(item?.title, 160), goal: clean(item?.goal, 500), subject: clean(item?.subject || "general", 60), status: ["planned", "active", "completed"].includes(item?.status) ? item.status : item?.steps?.some((step) => step?.completed) ? "active" : "planned", evidence: clean(item?.evidence, 1200), steps: list(item?.steps, 12).map((step) => ({ id: clean(step?.id || uid("step"), 80), title: clean(step?.title, 180), completed: Boolean(step?.completed), note: clean(step?.note, 500), evidence: clean(step?.evidence, 500), completedAt: step?.completedAt ? validDate(step.completedAt) : null })), createdAt: validDate(item?.createdAt), updatedAt: validDate(item?.updatedAt) })),
      knowledgeLoop: list(value.knowledgeLoop, MAX.knowledge).map((item) => ({ id: clean(item?.id || uid("knowledge"), 80), type: ["note", "flashcard", "quiz", "project"].includes(item?.type) ? item.type : "note", title: clean(item?.title, 180), content: clean(item?.content, 3000), sourceId: clean(item?.sourceId, 80), createdAt: validDate(item?.createdAt) })),
      dailyMissions: (() => { const missions = list(value.dailyMissions, 12).map((item) => ({ id: clean(item?.id, 80), date: /^\d{4}-\d{2}-\d{2}$/.test(item?.date) ? item.date : todayKey(), title: clean(item?.title, 160), type: clean(item?.type, 40), xp: clamp(item?.xp || 10, 1, 200), completed: Boolean(item?.completed) })); return missions.some((item) => item.date === todayKey()) ? missions.filter((item) => item.date === todayKey()) : defaultMissions(); })(),
      studyGroups: list(value.studyGroups, MAX.groups).map((item) => ({ id: clean(item?.id || uid("group"), 80), code: clean(item?.code || classCode(), 12).toUpperCase(), name: clean(item?.name || "Nhóm học HH", 120), goal: clean(item?.goal, 300), ownerId: clean(item?.ownerId, 80), memberIds: list(item?.memberIds, 80).map((id) => clean(id, 80)), createdAt: validDate(item?.createdAt), mode: "local" })),
      studyRooms: list(value.studyRooms, 30).map((item) => ({ id: clean(item?.id || uid("room"), 80), code: clean(item?.code || classCode(), 12).toUpperCase(), name: clean(item?.name || "Phòng học", 100), ownerId: clean(item?.ownerId, 80), memberIds: list(item?.memberIds, 50).map((id) => clean(id, 80)), createdAt: validDate(item?.createdAt), mode: "local" })),
      pomodoro: { mode: value.pomodoro?.mode === "break" ? "break" : "focus", duration: clamp(value.pomodoro?.duration || 1500, 60, 7200), remaining: clamp(value.pomodoro?.remaining ?? value.pomodoro?.duration ?? 1500, 0, 7200), running: Boolean(value.pomodoro?.running), updatedAt: validDate(value.pomodoro?.updatedAt), rounds: clamp(value.pomodoro?.rounds, 0, 9999) },
      whiteboards: Object.fromEntries(Object.entries(value.whiteboards || {}).slice(0, 30).map(([roomId, strokes]) => [clean(roomId, 80), list(strokes, MAX.strokes).map((stroke) => ({ color: /^#[0-9a-f]{6}$/i.test(stroke?.color) ? stroke.color : "#53cbd6", width: clamp(stroke?.width || 3, 1, 20), points: list(stroke?.points, 300).map((point) => ({ x: clamp(point?.x, 0, 5000), y: clamp(point?.y, 0, 5000) })) })).filter((stroke) => stroke.points.length > 1)])),
      adapter: { connected: Boolean(value.adapter?.connected && value.adapter?.confirmed && value.adapter?.confirmedAt), confirmed: Boolean(value.adapter?.confirmed && value.adapter?.confirmedAt), name: clean(value.adapter?.name || "local", 80), capabilities: list(value.adapter?.capabilities, 20).map((item) => clean(item, 60)).filter(Boolean), lastSyncAt: value.adapter?.lastSyncAt ? validDate(value.adapter.lastSyncAt) : null, confirmedAt: value.adapter?.confirmedAt ? validDate(value.adapter.confirmedAt) : null, error: clean(value.adapter?.error, 300) },
      ui: { selectedClassId: clean(value.ui?.selectedClassId, 80), selectedAssessmentId: clean(value.ui?.selectedAssessmentId, 80), notice: clean(value.ui?.notice, 300), timerStartedAt: value.ui?.timerStartedAt ? validDate(value.ui.timerStartedAt) : null },
      updatedAt: iso()
    };
    return state;
  }

  function shuffled(items, seed = Date.now()) {
    const result = [...items];
    let value = Array.from(String(seed)).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
    for (let index = result.length - 1; index > 0; index -= 1) {
      value = (value * 1664525 + 1013904223) >>> 0;
      const target = value % (index + 1);
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function createAssessment(type = "lesson-quiz", options = {}) {
    const validType = ASSESSMENT_TYPES.includes(type) ? type : "lesson-quiz";
    const count = clamp(options.questionCount || (validType === "timed-mock" ? 10 : validType === "lesson-quiz" ? 5 : 8), 1, QUESTION_BANK.length);
    const questions = (options.shuffle === false ? QUESTION_BANK : shuffled(QUESTION_BANK, options.seed || `${validType}-${Date.now()}`)).slice(0, count).map(clone);
    return normalizeState({ assessments: [{ id: uid("assessment"), type: validType, title: clean(options.title || TYPE_LABELS[validType], 160), durationMinutes: options.durationMinutes || DEFAULT_DURATION[validType], shuffle: options.shuffle !== false, questions, createdAt: iso(), ownerId: clean(options.ownerId || "system", 80) }] }).assessments[0];
  }

  function placementRecommendation(score, options = {}) {
    const bounded = clamp(score, 0, 100);
    const band = PLACEMENT_BANDS.find((item) => bounded >= item.min) || PLACEMENT_BANDS.at(-1);
    return {
      level: band.level,
      score: bounded,
      label: band.label,
      rationale: band.rationale,
      confidence: options.confidence === "confirmed" ? "confirmed" : "indicative",
      recommendationOnly: true,
      notice: "Placement chỉ là gợi ý để chọn cấp độ; người học vẫn có thể chọn mọi mức CEFR A0–C2."
    };
  }

  function gradeAssessment(assessment, answers = {}, options = {}) {
    const questions = list(assessment?.questions, 100).map(normalizeQuestion);
    const objective = questions.filter((question) => question.kind === "choice");
    const rubricItems = questions.filter((question) => question.kind === "rubric");
    const correct = objective.filter((question) => clean(answers[question.id], 2000).toLocaleLowerCase("vi") === question.answer.toLocaleLowerCase("vi")).length;
    const autoScore = objective.length ? Math.round(correct / objective.length * 100) : 0;
    const rubricScores = options.rubricScores || {};
    const reviewedScores = rubricItems.map((question) => rubricScores[question.id]).filter((score) => Number.isFinite(Number(score))).map(Number);
    const rubricScore = reviewedScores.length ? Math.round(reviewedScores.reduce((sum, score) => sum + clamp(score, 0, 100), 0) / reviewedScores.length) : null;
    const weighted = rubricItems.length ? rubricScore == null ? autoScore : Math.round((autoScore * objective.length + rubricScore * rubricItems.length) / Math.max(1, questions.length)) : autoScore;
    const recommendation = placementRecommendation(weighted);
    return { score: weighted, autoScore, correct, objectiveCount: objective.length, rubricCount: rubricItems.length, needsRubric: rubricItems.length > reviewedScores.length, recommendedLevel: recommendation.level, recommendation };
  }

  function applyPassportActivity(state, payload = {}) {
    const passport = state.passport || (state.passport = defaultState().passport);
    const date = todayKey(payload.at || Date.now());
    if (passport.lastStudyDate !== date) {
      const previous = new Date(`${passport.lastStudyDate || "1970-01-01"}T00:00:00Z`);
      const current = new Date(`${date}T00:00:00Z`);
      passport.streak = current - previous === 86_400_000 ? passport.streak + 1 : 1;
      passport.lastStudyDate = date;
    }
    const activity = { id: uid("activity"), type: clean(payload.type || "study", 40), title: clean(payload.title || "Hoạt động học tập", 180), xp: clamp(payload.xp || 0, 0, 1000), minutes: clamp(payload.minutes || 0, 0, 720), score: payload.score == null ? null : clamp(payload.score, 0, 100), createdAt: iso(payload.at || Date.now()) };
    passport.xp += activity.xp;
    passport.minutes += activity.minutes;
    passport.activities.unshift(activity);
    passport.activities = passport.activities.slice(0, MAX.activities);
    list(payload.skills, 20).forEach((skillName) => {
      const key = clean(skillName || "general", 50);
      const skill = passport.skills[key] || { score: 0, attempts: 0, status: "familiar", lastStudiedAt: iso() };
      const score = payload.score == null ? 55 : clamp(payload.score, 0, 100);
      skill.attempts += 1;
      skill.score = Math.round(skill.score ? skill.score * .7 + score * .3 : score);
      skill.status = payload.needsReview || skill.score < 45 ? "review" : skill.score >= 85 && skill.attempts >= 3 ? "mastered" : skill.score >= 60 ? "understood" : "familiar";
      skill.lastStudiedAt = iso();
      passport.skills[key] = skill;
    });
    const badges = [];
    if (passport.streak >= 3) badges.push(["streak-3", "Chuỗi học 3 ngày"]);
    if (passport.xp >= 100) badges.push(["xp-100", "100 XP đầu tiên"]);
    if (Object.values(passport.skills).some((skill) => skill.status === "mastered")) badges.push(["first-mastery", "Kỹ năng thành thạo đầu tiên"]);
    badges.forEach(([id, title]) => { if (!passport.achievements.some((item) => item.id === id)) passport.achievements.unshift({ id, title, earnedAt: iso() }); });
    return activity;
  }

  function updatePassport(state, payload = {}) {
    const next = normalizeState(state);
    const activity = applyPassportActivity(next, payload);
    return { state: normalizeState(next), activity };
  }

  function addMistake(state, payload = {}) {
    const next = normalizeState(state);
    const mistake = { id: uid("mistake"), skill: clean(payload.skill || "general", 50), prompt: clean(payload.prompt, 500), userAnswer: clean(payload.userAnswer, 500), correctAnswer: clean(payload.correctAnswer, 500), reviewCount: 0, mastered: false, createdAt: iso(), nextReviewAt: iso(Date.now() + 86_400_000) };
    next.mistakeNotebook = next.mistakeNotebook.filter((item) => !(item.prompt === mistake.prompt && item.userAnswer === mistake.userAnswer));
    next.mistakeNotebook.unshift(mistake);
    next.mistakeNotebook = next.mistakeNotebook.slice(0, MAX.mistakes);
    return { state: normalizeState(next), mistake };
  }

  function reviewMistake(state, mistakeId, quality = "good") {
    const next = normalizeState(state);
    const mistake = next.mistakeNotebook.find((item) => item.id === mistakeId);
    if (!mistake) throw new Error("Không tìm thấy lỗi cần ôn.");
    const intervals = { again: 10 * 60_000, hard: 86_400_000, good: 3 * 86_400_000, easy: 7 * 86_400_000 };
    mistake.reviewCount += 1;
    mistake.mastered = quality === "easy" || (quality === "good" && mistake.reviewCount >= 3);
    mistake.nextReviewAt = iso(Date.now() + (intervals[quality] || intervals.good));
    applyPassportActivity(next, { type: "review", title: `Ôn lỗi: ${mistake.prompt}`, xp: quality === "again" ? 2 : 8, minutes: 2, skills: [mistake.skill], score: quality === "again" ? 35 : quality === "hard" ? 55 : quality === "easy" ? 95 : 80, needsReview: quality === "again" });
    return { state: normalizeState(next), mistake: clone(mistake) };
  }

  function createProjectLesson(state, payload = {}) {
    const next = normalizeState(state);
    const title = clean(payload.title, 160);
    if (!title) throw new Error("Tên dự án không được để trống.");
    const subject = clean(payload.subject || "general", 60);
    const project = { id: uid("project-lesson"), title, goal: clean(payload.goal || "Hoàn thành một sản phẩm và trình bày điều đã học.", 500), subject, status: "planned", evidence: "", steps: ["Đọc brief và ghi chú", "Tạo flashcard khái niệm chính", "Làm sản phẩm", "Tự kiểm tra bằng quiz", "Phản tư và chia sẻ"].map((step) => ({ id: uid("step"), title: step, completed: false, note: "", evidence: "", completedAt: null })), createdAt: iso(), updatedAt: iso() };
    next.projectLessons.unshift(project);
    next.knowledgeLoop.unshift({ id: uid("knowledge"), type: "project", title: project.title, content: project.goal, sourceId: project.id, createdAt: iso() });
    return { state: normalizeState(next), project };
  }

  function completeProjectStep(state, projectId, stepId, payload = {}) {
    const next = normalizeState(state);
    const project = next.projectLessons.find((item) => item.id === clean(projectId, 80));
    if (!project) throw new Error("Không tìm thấy dự án thực hành.");
    const step = project.steps.find((item) => item.id === clean(stepId, 80));
    if (!step) throw new Error("Không tìm thấy bước dự án.");
    step.completed = payload.completed !== false;
    step.note = clean(payload.note ?? step.note, 500);
    step.evidence = clean(payload.evidence ?? step.evidence, 500);
    step.completedAt = step.completed ? iso(payload.at || Date.now()) : null;
    project.status = project.steps.every((item) => item.completed) ? "completed" : project.steps.some((item) => item.completed) ? "active" : "planned";
    project.updatedAt = iso(payload.at || Date.now());
    if (step.completed) applyPassportActivity(next, { type: "project-step", title: step.title, xp: 8, minutes: 5, score: project.status === "completed" ? 100 : 75, skills: ["project", project.subject] });
    return { state: normalizeState(next), project: clone(project), step: clone(step) };
  }

  function createStudyGroup(state, payload = {}) {
    const next = normalizeState(state);
    const name = clean(payload.name, 120);
    if (!name) throw new Error("Tên nhóm học không được để trống.");
    const group = { id: uid("group"), code: classCode(), name, goal: clean(payload.goal || "Cùng hoàn thành mục tiêu học tập", 300), ownerId: next.currentUser.id, memberIds: [next.currentUser.id], createdAt: iso(), mode: "local" };
    next.studyGroups.unshift(group);
    return { state: normalizeState(next), group };
  }

  function completeDailyMission(state, missionId) {
    const next = normalizeState(state);
    const mission = next.dailyMissions.find((item) => item.id === missionId);
    if (!mission) throw new Error("Không tìm thấy nhiệm vụ hôm nay.");
    if (!mission.completed) { mission.completed = true; applyPassportActivity(next, { type: "daily-mission", title: mission.title, xp: mission.xp, minutes: 5, skills: [mission.type] }); }
    return { state: normalizeState(next), mission: clone(mission) };
  }

  function addKnowledgeItem(state, payload = {}) {
    const next = normalizeState(state);
    const title = clean(payload.title, 180);
    if (!title) throw new Error("Tiêu đề Knowledge Loop không được để trống.");
    const item = { id: uid("knowledge"), type: ["note", "flashcard", "quiz", "project"].includes(payload.type) ? payload.type : "note", title, content: clean(payload.content, 3000), sourceId: clean(payload.sourceId, 80), createdAt: iso() };
    next.knowledgeLoop.unshift(item);
    return { state: normalizeState(next), item };
  }

  function submitAttempt(state, payload = {}) {
    const next = normalizeState(state);
    const assessment = next.assessments.find((item) => item.id === payload.assessmentId);
    if (!assessment) throw new Error("Không tìm thấy bài đánh giá.");
    const startedAt = payload.startedAt && Number.isFinite(Date.parse(payload.startedAt)) ? Date.parse(payload.startedAt) : Date.now();
    const elapsedSeconds = clamp(Math.round((Date.now() - startedAt) / 1000), 0, assessment.durationMinutes * 60 + 300);
    const result = gradeAssessment(assessment, payload.answers, { rubricScores: payload.rubricScores });
    const attempt = { id: uid("attempt"), assessmentId: assessment.id, userId: next.currentUser.id, score: result.score, autoScore: result.autoScore, status: result.needsRubric ? "needs-rubric" : "graded", answers: payload.answers || {}, rubricScores: payload.rubricScores || {}, feedback: result.needsRubric ? "Phần nói/viết đang chờ giáo viên đánh giá bằng rubric." : "Đã chấm các câu có đáp án rõ ràng.", recommendedLevel: assessment.type === "placement" && !result.needsRubric ? result.recommendedLevel : null, recommendationOnly: true, startedAt: iso(startedAt), submittedAt: iso(), elapsedSeconds };
    next.attempts.unshift(attempt);
    next.attempts = next.attempts.slice(0, MAX.attempts);
    assessment.questions.filter((question) => question.kind === "choice" && clean(payload.answers?.[question.id], 2000).toLocaleLowerCase("vi") !== question.answer.toLocaleLowerCase("vi")).forEach((question) => {
      next.mistakeNotebook.unshift({ id: uid("mistake"), skill: question.skill, prompt: question.prompt, userAnswer: clean(payload.answers?.[question.id], 500), correctAnswer: question.answer, reviewCount: 0, mastered: false, createdAt: iso(), nextReviewAt: iso(Date.now() + 86_400_000) });
    });
    next.mistakeNotebook = next.mistakeNotebook.slice(0, MAX.mistakes);
    applyPassportActivity(next, { type: "assessment", title: assessment.title, xp: Math.max(5, Math.round(result.score / 5)), minutes: Math.max(1, Math.ceil(elapsedSeconds / 60)), score: result.score, skills: assessment.questions.map((question) => question.skill), needsReview: result.score < 50 });
    if (assessment.type === "placement" && !result.needsRubric) next.placement = { recommendedLevel: result.recommendedLevel, score: result.score, confidence: "indicative", recommendationOnly: true, assessedAt: iso() };
    return { state: normalizeState(next), attempt: normalizeState({ attempts: [attempt] }).attempts[0], result };
  }

  function applyPlacementRecommendation(state, level) {
    const next = normalizeState(state);
    const recommendation = placementRecommendation(next.placement?.score ?? 0);
    const chosen = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"].includes(level) ? level : recommendation.level;
    next.currentUser.placementLevel = chosen;
    next.placement = { ...next.placement, recommendedLevel: recommendation.level, recommendationOnly: true };
    return normalizeState(next);
  }

  function issueCertificate(state, payload = {}) {
    const next = normalizeState(state);
    const attempt = next.attempts.find((item) => item.id === payload.attemptId) || next.attempts[0];
    if (!attempt || attempt.status === "needs-rubric") throw new Error("Cần một bài đã chấm hoàn tất trước khi tạo chứng chỉ xem trước.");
    const title = clean(payload.title || "Hoàn thành lộ trình HH Learning", 160);
    const fingerprint = Array.from(`${next.currentUser.id}:${title}:${attempt.score}:${iso().slice(0, 10)}`).reduce((sum, char) => (sum * 33 + char.charCodeAt(0)) >>> 0, 5381).toString(36).toUpperCase();
    const certificate = { id: uid("certificate"), code: `HH-LOCAL-${iso().slice(0, 10).replace(/-/g, "")}-${fingerprint.slice(0, 7)}`, title, learner: next.currentUser.name, score: attempt.score, issuedAt: iso(), localPreview: true, onlineVerified: false };
    next.certificates.unshift(certificate);
    if (!next.passport.achievements.some((item) => item.id === `certificate-${certificate.id}`)) next.passport.achievements.unshift({ id: `certificate-${certificate.id}`, title: `Chứng chỉ: ${title}`, earnedAt: iso() });
    return { state: normalizeState(next), certificate };
  }

  function createClassroom(state, payload = {}) {
    const next = normalizeState(state);
    const user = { ...next.currentUser, role: "teacher" };
    next.currentUser = user;
    const classroom = { id: uid("class"), code: classCode(), name: clean(payload.name || "Lớp học mới", 120), ownerId: user.id, createdAt: iso(), members: [{ userId: user.id, name: user.name, role: "teacher", joinedAt: iso() }] };
    next.classrooms.unshift(classroom);
    next.ui.selectedClassId = classroom.id;
    return { state: normalizeState(next), classroom };
  }

  function joinClassroom(state, payload = {}) {
    const next = normalizeState(state);
    const code = clean(payload.code, 12).toUpperCase();
    const classroom = next.classrooms.find((item) => item.code === code);
    if (!classroom) throw new Error("Mã lớp không tồn tại trên thiết bị này. Cần backend để tham gia lớp từ thiết bị khác.");
    if (!classroom.members.some((member) => member.userId === next.currentUser.id)) classroom.members.push({ userId: next.currentUser.id, name: next.currentUser.name, role: "student", joinedAt: iso() });
    next.currentUser.role = roleOf(classroom, next.currentUser.id) || "student";
    next.ui.selectedClassId = classroom.id;
    return { state: normalizeState(next), classroom };
  }

  function createAssignment(state, payload = {}) {
    const next = normalizeState(state);
    const classroom = next.classrooms.find((item) => item.id === payload.classId);
    if (!classroom || !canTeach(classroom, next.currentUser.id)) throw new Error("Chỉ giáo viên của lớp mới có thể giao bài.");
    const assignment = { id: uid("assignment"), classId: classroom.id, title: clean(payload.title, 180), instructions: clean(payload.instructions, 3000), target: payload.target === "individual" ? "individual" : "group", assigneeIds: list(payload.assigneeIds, 100), dueAt: validDate(payload.dueAt, Date.now() + 86_400_000), createdBy: next.currentUser.id, createdAt: iso(), points: clamp(payload.points || 100, 1, 1000) };
    if (!assignment.title) throw new Error("Tên bài tập không được để trống.");
    next.assignments.unshift(assignment);
    return { state: normalizeState(next), assignment };
  }

  function submitAssignment(state, payload = {}) {
    const next = normalizeState(state);
    const assignment = next.assignments.find((item) => item.id === payload.assignmentId);
    if (!assignment) throw new Error("Không tìm thấy bài tập.");
    const classroom = next.classrooms.find((item) => item.id === assignment.classId);
    if (!roleOf(classroom, next.currentUser.id)) throw new Error("Bạn chưa tham gia lớp này.");
    const metadata = list(payload.files, 12).map((file) => ({ name: clean(file?.name, 160), type: clean(file?.type, 80), size: clamp(file?.size, 0, 10_000_000), lastModified: clamp(file?.lastModified, 0, Date.now()) }));
    if (!clean(payload.text, 5000) && !metadata.length && !list(payload.links, 12).length) throw new Error("Bài nộp cần nội dung, liên kết hoặc metadata tệp.");
    const submission = { id: uid("submission"), assignmentId: assignment.id, userId: next.currentUser.id, text: clean(payload.text, 5000), links: list(payload.links, 12), fileMetadata: metadata, status: "submitted", submittedAt: iso(), score: null, feedback: "", gradedBy: "", gradedAt: null };
    next.submissions = next.submissions.filter((item) => !(item.assignmentId === assignment.id && item.userId === next.currentUser.id));
    next.submissions.unshift(submission);
    return { state: normalizeState(next), submission };
  }

  function gradeSubmission(state, payload = {}) {
    const next = normalizeState(state);
    const submission = next.submissions.find((item) => item.id === payload.submissionId);
    const assignment = next.assignments.find((item) => item.id === submission?.assignmentId);
    const classroom = next.classrooms.find((item) => item.id === assignment?.classId);
    if (!submission || !assignment || !canTeach(classroom, next.currentUser.id)) throw new Error("Chỉ giáo viên của lớp mới có thể chấm bài.");
    submission.score = clamp(payload.score, 0, assignment.points);
    submission.feedback = clean(payload.feedback, 3000);
    submission.status = payload.returnOnly ? "returned" : "graded";
    submission.gradedBy = next.currentUser.id;
    submission.gradedAt = iso();
    const learnerState = next.currentUser.id === submission.userId;
    if (learnerState) applyPassportActivity(next, { type: "assignment", title: assignment.title, xp: Math.max(5, Math.round(submission.score / 5)), minutes: 10, score: assignment.points ? submission.score / assignment.points * 100 : 0, skills: ["assignment"] });
    return { state: normalizeState(next), submission: clone(submission) };
  }

  function addDiscussion(state, payload = {}) {
    const next = normalizeState(state);
    const classroom = next.classrooms.find((item) => item.id === payload.classId);
    if (!classroom || !roleOf(classroom, next.currentUser.id)) throw new Error("Bạn chưa tham gia lớp này.");
    const text = clean(payload.text, 2000);
    if (!text) throw new Error("Nội dung thảo luận không được để trống.");
    const discussion = { id: uid("discussion"), classId: classroom.id, userId: next.currentUser.id, author: next.currentUser.name, text, createdAt: iso(), parentId: clean(payload.parentId, 80) };
    next.discussions.unshift(discussion);
    return { state: normalizeState(next), discussion };
  }

  function createStudyRoom(state, payload = {}) {
    const next = normalizeState(state);
    const room = { id: uid("room"), code: classCode(), name: clean(payload.name || "Study Together", 100), ownerId: next.currentUser.id, memberIds: [next.currentUser.id], createdAt: iso(), mode: "local" };
    next.studyRooms.unshift(room);
    return { state: normalizeState(next), room };
  }

  function updatePomodoro(state, action, now = Date.now()) {
    const next = normalizeState(state);
    const timer = next.pomodoro;
    const wasRunning = timer.running;
    if (timer.running) timer.remaining = clamp(timer.remaining - Math.floor((now - Date.parse(timer.updatedAt)) / 1000), 0, timer.duration);
    if (action === "start") timer.running = timer.remaining > 0;
    if (action === "pause") timer.running = false;
    if (action === "reset") { timer.running = false; timer.remaining = timer.duration; }
    if (action === "toggle-mode") { timer.mode = timer.mode === "focus" ? "break" : "focus"; timer.duration = timer.mode === "focus" ? 1500 : 300; timer.remaining = timer.duration; timer.running = false; }
    if (wasRunning && timer.remaining === 0) { timer.running = false; if (timer.mode === "focus") { timer.rounds += 1; applyPassportActivity(next, { type: "focus", title: "Hoàn thành phiên Pomodoro", xp: 10, minutes: Math.round(timer.duration / 60), skills: ["focus"] }); } }
    timer.updatedAt = iso(now);
    return normalizeState(next);
  }

  function addWhiteboardStroke(state, roomId, stroke) {
    const next = normalizeState(state);
    if (!next.studyRooms.some((room) => room.id === roomId)) throw new Error("Không tìm thấy phòng học.");
    next.whiteboards[roomId] ||= [];
    next.whiteboards[roomId].push({ color: /^#[0-9a-f]{6}$/i.test(stroke?.color) ? stroke.color : "#53cbd6", width: clamp(stroke?.width || 3, 1, 20), points: list(stroke?.points, 300).map((point) => ({ x: clamp(point.x, 0, 5000), y: clamp(point.y, 0, 5000) })) });
    next.whiteboards[roomId] = next.whiteboards[roomId].slice(-MAX.strokes);
    return normalizeState(next);
  }

  function buildCatchUp(state, classId, limit = 8) {
    const next = normalizeState(state);
    const classroom = next.classrooms.find((item) => item.id === classId);
    const assignments = next.assignments.filter((item) => item.classId === classId).slice(0, limit);
    const discussions = next.discussions.filter((item) => item.classId === classId).slice(0, limit);
    const lines = [];
    assignments.forEach((item) => lines.push(`Bài tập: ${item.title} - hạn ${new Date(item.dueAt).toLocaleDateString("vi-VN")}.`));
    discussions.forEach((item) => lines.push(`${item.author}: ${item.text}`));
    return { title: classroom ? `Bắt kịp lớp ${classroom.name}` : "Bắt kịp lớp học", summary: lines.length ? lines.join(" ").slice(0, 2400) : "Chưa có hoạt động để tóm tắt.", sourceCount: lines.length, method: "Trích xuất cục bộ từ bài tập và thảo luận; không phải bản tóm tắt AI.", generatedAt: iso() };
  }

  function createStore(storage = root.localStorage) {
    let state;
    const listeners = new Set();
    try { state = normalizeState(JSON.parse(storage?.getItem?.(STORAGE_KEY) || "null")); } catch { state = defaultState(); }
    const persist = () => {
      state.updatedAt = iso();
      try { storage?.setItem?.(STORAGE_KEY, JSON.stringify(state)); } catch {}
      listeners.forEach((listener) => listener(clone(state)));
    };
    return Object.freeze({
      get: () => clone(state),
      set: (next) => { state = normalizeState(next); persist(); return clone(state); },
      update: (recipe) => { const draft = clone(state); state = normalizeState(typeof recipe === "function" ? recipe(draft) || draft : { ...draft, ...(recipe || {}) }); persist(); return clone(state); },
      subscribe: (listener) => { if (typeof listener !== "function") return () => {}; listeners.add(listener); return () => listeners.delete(listener); },
      export: () => JSON.stringify({ format: "hh-learning-classroom", version: VERSION, exportedAt: iso(), state }, null, 2),
      import: (text) => { if (String(text).length > 1_000_000) throw new Error("Tệp lớp học vượt quá 1 MB."); const value = JSON.parse(text); if (value?.format !== "hh-learning-classroom") throw new Error("Không đúng định dạng HH Learning Classroom."); state = normalizeState(value.state); persist(); return clone(state); }
    });
  }

  let mounted = null;
  let backendAdapter = null;

  function setAdapter(adapter) {
    backendAdapter = adapter && typeof adapter === "object" ? adapter : null;
    return Boolean(backendAdapter);
  }

  function requestAdapter(scope, action, payload = {}) {
    if (backendAdapter && typeof backendAdapter[action] === "function") return Promise.resolve(backendAdapter[action](clone(payload)));
    return new Promise((resolve, reject) => {
      let handled = false;
      const respond = (result) => { handled = true; resolve(result); };
      try { scope?.dispatchEvent?.(new scope.CustomEvent("hh:learning-classroom:adapter", { detail: { action, payload: clone(payload), respond } })); } catch {}
      if (!handled) reject(new Error("Chưa kết nối backend. Dữ liệu hiện chỉ lưu trên thiết bị này."));
    });
  }

  function verifyAdapterResult(result, requiredCapability = "classroom-sync", now = Date.now()) {
    if (!result || result.confirmed !== true) throw new Error("Backend chưa xác nhận adapter; dữ liệu vẫn chỉ lưu trên thiết bị này.");
    const capabilities = list(result.capabilities, 20).map((item) => clean(item, 60)).filter(Boolean);
    if (capabilities.length && !capabilities.includes(requiredCapability)) throw new Error(`Adapter chưa xác nhận capability ${clean(requiredCapability, 60)}.`);
    return {
      state: result.state && typeof result.state === "object" ? normalizeState(result.state) : null,
      adapter: {
        connected: true,
        confirmed: true,
        name: clean(result.name || result.adapterId || "confirmed-backend", 80),
        capabilities: capabilities.length ? capabilities : [requiredCapability],
        lastSyncAt: iso(now),
        confirmedAt: iso(now),
        error: ""
      }
    };
  }

  const assessmentOptions = () => ASSESSMENT_TYPES.map((type) => `<option value="${type}">${escapeHTML(TYPE_LABELS[type])}</option>`).join("");
  const nav = (active) => VIEWS.map((view) => `<button type="button" class="hlc-nav__item${view === active ? " is-active" : ""}" data-hlc-view="${view}">${escapeHTML({ assessments: "Đánh giá", certificates: "Chứng chỉ", classroom: "Lớp học", "study-together": "Học cùng nhau", "catch-up": "Bắt kịp" }[view])}</button>`).join("");

  function renderAssessments(state) {
    const selected = state.assessments.find((item) => item.id === state.ui.selectedAssessmentId) || state.assessments[0];
    const placementNote = state.placement?.recommendedLevel ? `<p class="hlc-placement-note">Gợi ý placement hiện tại: <strong>${escapeHTML(state.placement.recommendedLevel)}</strong> · chỉ là khuyến nghị, bạn vẫn chọn được mọi mức CEFR A0–C2.</p>` : "";
    const attempts = state.attempts.slice(0, 8).map((item) => `<li><strong>${item.score}%</strong><span>${escapeHTML(item.status === "needs-rubric" ? "Chờ rubric" : "Đã chấm")}</span><time>${new Date(item.submittedAt).toLocaleString("vi-VN")}</time></li>`).join("") || "<li class=\"hlc-empty\">Chưa có lần làm bài.</li>";
    const questions = selected?.questions.map((question, index) => `<fieldset class="hlc-question"><legend>${index + 1}. ${escapeHTML(question.prompt)}</legend>${question.kind === "choice" ? question.options.map((option) => `<label><input type="radio" name="answer-${escapeHTML(question.id)}" value="${escapeHTML(option)}"> <span>${escapeHTML(option)}</span></label>`).join("") : `<textarea name="answer-${escapeHTML(question.id)}" rows="4" placeholder="Nhập câu trả lời. Giáo viên sẽ đánh giá theo rubric ${escapeHTML(question.rubric)}."></textarea><small>${RUBRIC[question.rubric].map(escapeHTML).join(" · ")}</small>`}</fieldset>`).join("") || "";
    return `<section class="hlc-page" aria-labelledby="hlc-assessment-title"><header class="hlc-page__head"><div><span class="hlc-kicker">ASSESSMENT CENTER</span><h2 id="hlc-assessment-title">Đánh giá có lịch sử và rubric</h2><p>Kết quả trắc nghiệm được chấm cục bộ. Nói và viết luôn chờ giáo viên duyệt.</p>${placementNote}</div><form data-hlc-create-assessment><select name="type" aria-label="Loại bài kiểm tra">${assessmentOptions()}</select><button class="hlc-primary">Tạo bài</button></form></header><div class="hlc-grid hlc-grid--assessment"><aside class="hlc-panel"><h3>Ngân hàng bài</h3>${state.assessments.map((item) => `<button class="hlc-list-button${selected?.id === item.id ? " is-active" : ""}" data-hlc-select-assessment="${escapeHTML(item.id)}"><span>${escapeHTML(item.title)}</span><small>${item.questions.length} câu · ${item.durationMinutes} phút</small></button>`).join("") || "<div class=\"hlc-empty\">Tạo bài đầu tiên để bắt đầu.</div>"}<h3>Lịch sử lần làm</h3><ul class="hlc-history">${attempts}</ul></aside><main class="hlc-panel hlc-exam">${selected ? `<div class="hlc-exam__bar"><div><strong>${escapeHTML(selected.title)}</strong><small>${selected.durationMinutes} phút · ${selected.shuffle ? "Đã xáo câu" : "Giữ thứ tự"}</small></div><output data-hlc-timer>${String(selected.durationMinutes).padStart(2, "0")}:00</output></div><form data-hlc-submit-assessment="${escapeHTML(selected.id)}">${questions}<button class="hlc-primary">Nộp bài</button></form>` : `<div class="hlc-empty hlc-empty--large">Chọn hoặc tạo một bài đánh giá.</div>`}</main></div></section>`;
  }

  function renderCertificates(state) {
    const skills = Object.entries(state.passport.skills).sort(([, a], [, b]) => b.score - a.score);
    return `<section class="hlc-page"><header class="hlc-page__head"><div><span class="hlc-kicker">LEARNING PASSPORT · LOCAL PROFILE</span><h2>Hồ sơ kỹ năng và chứng chỉ</h2><p>Passport liên kết bài kiểm tra, ôn lỗi, dự án và thời gian tập trung trên thiết bị này. Xác minh công khai, chống sửa đổi và URL tra cứu cần backend.</p></div><button class="hlc-primary" data-hlc-issue-certificate ${state.attempts.some((item) => item.status !== "needs-rubric") ? "" : "disabled"}>Tạo chứng chỉ xem trước</button></header><div class="hlc-passport"><article class="hlc-passport__identity"><span>HH LEARNING PASSPORT</span><h3>${escapeHTML(state.currentUser.name)}</h3><div class="hlc-passport__stats"><b>${state.passport.xp}<small>XP</small></b><b>${state.passport.streak}<small>Streak</small></b><b>${state.passport.minutes}<small>Phút học</small></b><b>${skills.length}<small>Kỹ năng</small></b></div><p>${state.passport.achievements.length ? state.passport.achievements.slice(0, 4).map((item) => `<span class="hlc-badge">${escapeHTML(item.title)}</span>`).join("") : "Hoàn thành nhiệm vụ để mở huy hiệu đầu tiên."}</p></article><section class="hlc-panel hlc-skill-graph"><h3>Skill Graph & Mastery</h3>${skills.length ? skills.map(([name, skill]) => `<article class="is-${skill.status}"><div><strong>${escapeHTML(name)}</strong><span>${escapeHTML(MASTERY_LABELS[skill.status])}</span></div><progress max="100" value="${skill.score}"></progress><b>${skill.score}%</b></article>`).join("") : `<div class="hlc-empty">Làm bài đánh giá để bắt đầu bản đồ kỹ năng.</div>`}</section></div><div class="hlc-certificate-grid">${state.certificates.map((item) => `<article class="hlc-certificate"><span>HH LEARNING PASSPORT</span><h3>${escapeHTML(item.title)}</h3><p>Trao cho <strong>${escapeHTML(item.learner)}</strong></p><div class="hlc-certificate__score">${item.score}%</div><code>${escapeHTML(item.code)}</code><small>Chỉ là bản xem trước trên thiết bị · Chưa xác minh online</small><button data-hlc-print type="button">In / lưu PDF</button></article>`).join("") || `<div class="hlc-empty hlc-empty--large">Hoàn tất một bài đã chấm để tạo chứng chỉ xem trước.</div>`}</div></section>`;
  }

  function renderClassroom(state) {
    const selected = state.classrooms.find((item) => item.id === state.ui.selectedClassId) || state.classrooms[0];
    const teacher = canTeach(selected, state.currentUser.id);
    const assignments = state.assignments.filter((item) => item.classId === selected?.id);
    const submissions = state.submissions.filter((item) => assignments.some((assignment) => assignment.id === item.assignmentId));
    return `<section class="hlc-page"><header class="hlc-page__head"><div><span class="hlc-kicker">CLASSROOM · ${state.adapter.connected ? "BACKEND CONNECTED" : "LOCAL MODE"}</span><h2>Lớp học và bảng điểm</h2><p>Mã lớp chỉ hoạt động trên thiết bị này khi chưa kết nối backend.</p></div><div class="hlc-actions"><button data-hlc-create-class type="button">Tạo lớp</button><button data-hlc-join-class type="button">Nhập mã lớp</button><button data-hlc-sync type="button">Đồng bộ backend</button></div></header><div class="hlc-class-layout"><aside class="hlc-panel"><h3>Lớp của bạn</h3>${state.classrooms.map((item) => `<button class="hlc-list-button${selected?.id === item.id ? " is-active" : ""}" data-hlc-select-class="${escapeHTML(item.id)}"><span>${escapeHTML(item.name)}</span><small>${escapeHTML(item.code)} · ${roleOf(item, state.currentUser.id) === "teacher" ? "Giáo viên" : "Học viên"}</small></button>`).join("") || `<div class="hlc-empty">Chưa có lớp học.</div>`}</aside><main class="hlc-panel">${selected ? `<div class="hlc-class-title"><div><h3>${escapeHTML(selected.name)}</h3><p>Mã mời <code>${escapeHTML(selected.code)}</code> · ${selected.members.length} thành viên</p></div><span class="hlc-role">${teacher ? "Giáo viên" : "Học viên"}</span></div>${teacher ? `<form class="hlc-assignment-form" data-hlc-assignment><input name="title" required placeholder="Tên bài tập"><textarea name="instructions" placeholder="Hướng dẫn"></textarea><div><input name="dueAt" type="datetime-local" required><select name="target"><option value="group">Cả lớp</option><option value="individual">Cá nhân</option></select><button class="hlc-primary">Giao bài</button></div></form>` : ""}<div class="hlc-assignment-list">${assignments.map((item) => { const mine = submissions.find((submission) => submission.assignmentId === item.id && submission.userId === state.currentUser.id); return `<article><div><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.instructions)}</p><small>Hạn ${new Date(item.dueAt).toLocaleString("vi-VN")} · ${item.points} điểm</small></div>${teacher ? `<span>${submissions.filter((submission) => submission.assignmentId === item.id).length} bài nộp</span>` : `<button data-hlc-submit-assignment="${escapeHTML(item.id)}">${mine ? "Nộp lại" : "Nộp bài"}</button>`}</article>`; }).join("") || `<div class="hlc-empty">Chưa có bài tập.</div>`}</div>${teacher ? `<div class="hlc-gradebook"><h3>Gradebook</h3>${submissions.map((item) => `<div><span>${escapeHTML(item.userId)}<small>${new Date(item.submittedAt).toLocaleString("vi-VN")}</small></span><button data-hlc-grade="${escapeHTML(item.id)}">${item.score == null ? "Chấm bài" : `${item.score} điểm`}</button></div>`).join("") || `<div class="hlc-empty">Chưa có bài nộp.</div>`}</div>` : ""}<form class="hlc-discussion-form" data-hlc-discussion><input name="text" required placeholder="Đặt câu hỏi hoặc thảo luận..."><button>Gửi</button></form><div class="hlc-discussions">${state.discussions.filter((item) => item.classId === selected.id).map((item) => `<article><strong>${escapeHTML(item.author)}</strong><p>${escapeHTML(item.text)}</p><time>${new Date(item.createdAt).toLocaleString("vi-VN")}</time></article>`).join("")}</div>` : `<div class="hlc-empty hlc-empty--large">Tạo hoặc tham gia một lớp học.</div>`}</main></div></section>`;
  }

  const timerText = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  function renderStudy(state) {
    const room = state.studyRooms[0];
    const timer = state.pomodoro;
    return `<section class="hlc-page"><header class="hlc-page__head"><div><span class="hlc-kicker">STUDY TOGETHER · LOCAL ROOM</span><h2>Không gian tập trung và dự án học</h2><p>Pomodoro, bảng trắng, nhiệm vụ, nhóm học và Project to Lesson chạy cục bộ. Presence nhiều người chỉ bật sau khi backend xác nhận.</p></div><button class="hlc-primary" data-hlc-create-room>${room ? "Tạo phòng khác" : "Tạo phòng học"}</button></header><div class="hlc-mission-strip">${state.dailyMissions.map((mission) => `<button type="button" class="${mission.completed ? "is-complete" : ""}" data-hlc-complete-mission="${escapeHTML(mission.id)}" ${mission.completed ? "disabled" : ""}><span>${mission.completed ? "✓" : `+${mission.xp} XP`}</span><strong>${escapeHTML(mission.title)}</strong></button>`).join("")}</div><div class="hlc-study-grid"><section class="hlc-pomodoro hlc-panel"><span>${timer.mode === "focus" ? "PHIÊN TẬP TRUNG" : "NGHỈ NGẮN"}</span><output data-hlc-pomodoro>${timerText(timer.remaining)}</output><div><button data-hlc-pomo="${timer.running ? "pause" : "start"}">${timer.running ? "Tạm dừng" : "Bắt đầu"}</button><button data-hlc-pomo="reset">Đặt lại</button><button data-hlc-pomo="toggle-mode">Đổi chế độ</button></div><small>${timer.rounds} vòng tập trung đã hoàn thành</small></section><section class="hlc-panel hlc-room"><h3>${room ? escapeHTML(room.name) : "Chưa có phòng"}</h3><p>${room ? `Mã ${escapeHTML(room.code)} · Chỉ local` : "Tạo phòng để bật bảng trắng."}</p><div class="hlc-whiteboard-wrap"><canvas data-hlc-whiteboard width="960" height="440" aria-label="Bảng trắng dùng chuột hoặc cảm ứng"></canvas><div><label>Màu <input data-hlc-ink type="color" value="#53cbd6"></label><button data-hlc-clear-board ${room ? "" : "disabled"}>Xóa bảng</button></div></div></section></div><div class="hlc-learning-tools"><section class="hlc-panel"><h3>Project to Lesson</h3><form data-hlc-project-lesson><input name="title" required placeholder="Tên dự án thật"><input name="goal" placeholder="Sản phẩm hoặc kỹ năng cần hoàn thành"><select name="subject"><option value="english">Tiếng Anh</option><option value="technology">Công nghệ</option><option value="design">Thiết kế</option><option value="business">Kinh doanh</option></select><button class="hlc-primary">Tạo lộ trình 5 bước</button></form>${state.projectLessons.slice(0, 4).map((project) => `<article class="hlc-project-lesson"><div><strong>${escapeHTML(project.title)}</strong><small>${escapeHTML(project.subject)} · ${project.steps.filter((step) => step.completed).length}/${project.steps.length} bước</small></div>${project.steps.map((step) => `<button type="button" class="${step.completed ? "is-complete" : ""}" data-hlc-project-step="${escapeHTML(project.id)}:${escapeHTML(step.id)}">${step.completed ? "✓" : "○"} ${escapeHTML(step.title)}</button>`).join("")}</article>`).join("") || `<div class="hlc-empty">Biến một dự án thật thành chu trình học.</div>`}</section><section class="hlc-panel"><h3>Nhóm học cục bộ</h3><form data-hlc-study-group><input name="name" required placeholder="Tên nhóm học"><input name="goal" placeholder="Mục tiêu chung"><button>Tạo nhóm</button></form>${state.studyGroups.map((group) => `<article class="hlc-study-group"><div><strong>${escapeHTML(group.name)}</strong><small>${escapeHTML(group.goal)}</small></div><code>${escapeHTML(group.code)}</code><span>${group.memberIds.length} thành viên · local</span></article>`).join("") || `<div class="hlc-empty">Chưa có nhóm. Đồng bộ thành viên giữa thiết bị cần backend.</div>`}</section></div></section>`;
  }

  function renderCatchUp(state) {
    const selected = state.classrooms.find((item) => item.id === state.ui.selectedClassId) || state.classrooms[0];
    const result = buildCatchUp(state, selected?.id);
    const dueMistakes = state.mistakeNotebook.filter((item) => !item.mastered).sort((a, b) => Date.parse(a.nextReviewAt) - Date.parse(b.nextReviewAt)).slice(0, 6);
    return `<section class="hlc-page"><header class="hlc-page__head"><div><span class="hlc-kicker">SMART CATCH-UP · EXTRACTIVE LOCAL</span><h2>Bắt kịp và khép kín vòng học</h2><p>Chỉ trích xuất hoạt động đã lưu trên thiết bị; không suy diễn nội dung không có nguồn.</p></div></header><article class="hlc-catchup"><div><span>${result.sourceCount} nguồn cục bộ</span><time>${new Date(result.generatedAt).toLocaleString("vi-VN")}</time></div><h3>${escapeHTML(result.title)}</h3><p>${escapeHTML(result.summary)}</p><small>${escapeHTML(result.method)}</small></article><div class="hlc-catchup-grid"><section class="hlc-panel"><h3>Mistake Notebook</h3>${dueMistakes.map((item) => `<article class="hlc-mistake"><div><strong>${escapeHTML(item.prompt)}</strong><p>Bạn chọn: ${escapeHTML(item.userAnswer || "Chưa trả lời")} · Đúng: ${escapeHTML(item.correctAnswer)}</p><small>${escapeHTML(item.skill)} · đã ôn ${item.reviewCount} lần</small></div><div>${[["again", "Quên"], ["hard", "Khó"], ["good", "Tốt"], ["easy", "Dễ"]].map(([quality, label]) => `<button type="button" data-hlc-review-mistake="${escapeHTML(item.id)}:${quality}">${label}</button>`).join("")}</div></article>`).join("") || `<div class="hlc-empty">Chưa có lỗi cần ôn.</div>`}</section><section class="hlc-panel"><h3>Knowledge Loop</h3><form data-hlc-knowledge><select name="type"><option value="note">Ghi chú</option><option value="flashcard">Flashcard</option><option value="quiz">Quiz</option><option value="project">Dự án</option></select><input name="title" required placeholder="Tiêu đề"><textarea name="content" placeholder="Nội dung cần ghi nhớ"></textarea><button>Thêm vào vòng học</button></form>${state.knowledgeLoop.slice(0, 8).map((item) => `<article class="hlc-knowledge-item"><span>${escapeHTML(item.type)}</span><div><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.content)}</p></div></article>`).join("") || `<div class="hlc-empty">Ghi chú → flashcard → quiz → project.</div>`}</section></div></section>`;
  }

  function render(host, state) {
    const body = state.activeView === "assessments" ? renderAssessments(state) : state.activeView === "certificates" ? renderCertificates(state) : state.activeView === "classroom" ? renderClassroom(state) : state.activeView === "study-together" ? renderStudy(state) : renderCatchUp(state);
    const compatibilityLabel = state.activeView === "certificates" ? `<span hidden>LOCAL CERTIFICATE PREVIEW · Chưa xác minh online</span>` : "";
    host.innerHTML = `<div class="hlc" data-hlc-root>${compatibilityLabel}<header class="hlc-shell-head"><div><span class="hlc-logo">HH</span><div><strong>Learning Classroom</strong><small>Đánh giá · Lớp học · Study Together</small></div></div><nav aria-label="Learning Classroom">${nav(state.activeView)}</nav></header><div class="hlc-notice" aria-live="polite">${escapeHTML(state.ui.notice)}</div>${body}</div>`;
  }

  function promptValue(scope, message, fallback = "") {
    return typeof scope?.prompt === "function" ? scope.prompt(message, fallback) : null;
  }

  function mount(host, options = {}) {
    if (!host || typeof host !== "object") throw new Error("HHLearningClassroom cần một host hợp lệ.");
    unmount();
    const scope = options.scope || root;
    const store = options.store || createStore(options.storage || scope.localStorage);
    let state = store.get();
    let timerAssessmentId = "";
    let timerStartedAt = Date.now();
    const requestedView = VIEW_ALIASES[options.view] || options.view;
    if (VIEWS.includes(requestedView)) state.activeView = requestedView;
    const setState = (next, notice = "") => { next.ui.notice = notice; state = store.set(next); render(host, state); bindCanvas(); };
    const onClick = async (event) => {
      const target = event.target?.closest?.("button, [data-hlc-view]");
      if (!target) return;
      const view = target.dataset.hlcView;
      if (VIEWS.includes(view)) return setState({ ...state, activeView: view });
      if (target.dataset.hlcSelectAssessment) { timerAssessmentId = target.dataset.hlcSelectAssessment; timerStartedAt = Date.now(); return setState({ ...state, ui: { ...state.ui, selectedAssessmentId: target.dataset.hlcSelectAssessment } }); }
      if (target.dataset.hlcSelectClass) return setState({ ...state, ui: { ...state.ui, selectedClassId: target.dataset.hlcSelectClass } });
      if (target.hasAttribute("data-hlc-issue-certificate")) { try { const result = issueCertificate(state); setState(result.state, "Đã tạo chứng chỉ xem trước cục bộ."); } catch (error) { setState(state, error.message); } return; }
      if (target.hasAttribute("data-hlc-print")) return scope.print?.();
      if (target.hasAttribute("data-hlc-create-class")) { const name = promptValue(scope, "Tên lớp học", "Lớp học HH"); if (name) { const result = createClassroom(state, { name }); setState(result.state, `Đã tạo lớp ${result.classroom.code} trên thiết bị này.`); } return; }
      if (target.hasAttribute("data-hlc-join-class")) { const code = promptValue(scope, "Nhập mã lớp"); if (code) { try { const result = joinClassroom(state, { code }); setState(result.state, "Đã tham gia lớp trên thiết bị này."); } catch (error) { setState(state, error.message); } } return; }
      if (target.hasAttribute("data-hlc-sync")) { try { const result = await requestAdapter(scope, "sync", { state }); const verified = verifyAdapterResult(result, "classroom-sync"); const next = verified.state || normalizeState(state); next.adapter = verified.adapter; setState(next, "Đồng bộ backend đã được adapter xác nhận."); } catch (error) { const next = clone(state); next.adapter = { connected: false, confirmed: false, name: "local", capabilities: [], lastSyncAt: null, confirmedAt: null, error: clean(error.message, 300) }; setState(next, error.message); } return; }
      if (target.dataset.hlcSubmitAssignment) { const text = promptValue(scope, "Nội dung bài nộp"); if (text) { try { const result = submitAssignment(state, { assignmentId: target.dataset.hlcSubmitAssignment, text }); setState(result.state, "Đã lưu metadata bài nộp trên thiết bị."); } catch (error) { setState(state, error.message); } } return; }
      if (target.dataset.hlcGrade) { const score = promptValue(scope, "Điểm số", "80"); const feedback = promptValue(scope, "Nhận xét", "Đã hoàn thành yêu cầu."); if (score != null) { try { const result = gradeSubmission(state, { submissionId: target.dataset.hlcGrade, score, feedback }); setState(result.state, "Đã lưu điểm và phản hồi."); } catch (error) { setState(state, error.message); } } return; }
      if (target.hasAttribute("data-hlc-create-room")) { const name = promptValue(scope, "Tên phòng học", "Focus Room"); if (name) { const result = createStudyRoom(state, { name }); setState(result.state, "Phòng local đã sẵn sàng. Backend cần thiết cho nhiều người."); } return; }
      if (target.dataset.hlcPomo) return setState(updatePomodoro(state, target.dataset.hlcPomo), "Đã cập nhật Pomodoro.");
      if (target.dataset.hlcCompleteMission) { try { const result = completeDailyMission(state, target.dataset.hlcCompleteMission); setState(result.state, `Hoàn thành nhiệm vụ · +${result.mission.xp} XP.`); } catch (error) { setState(state, error.message); } return; }
      if (target.dataset.hlcProjectStep) { const [projectId, stepId] = target.dataset.hlcProjectStep.split(":"); const current = state.projectLessons.find((item) => item.id === projectId)?.steps.find((item) => item.id === stepId); if (current) { const result = completeProjectStep(state, projectId, stepId, { completed: !current.completed }); setState(result.state, result.step.completed ? "Đã hoàn thành một bước dự án." : "Đã mở lại bước dự án."); } return; }
      if (target.dataset.hlcReviewMistake) { const [mistakeId, quality] = target.dataset.hlcReviewMistake.split(":"); try { const result = reviewMistake(state, mistakeId, quality); setState(result.state, result.mistake.mastered ? "Đã đánh dấu lỗi này là thành thạo." : "Đã lên lịch ôn tiếp theo."); } catch (error) { setState(state, error.message); } return; }
      if (target.hasAttribute("data-hlc-clear-board")) { const room = state.studyRooms[0]; if (room) { const next = clone(state); next.whiteboards[room.id] = []; setState(next, "Đã xóa bảng trắng."); } }
    };
    const onSubmit = (event) => {
      const form = event.target;
      if (!form?.matches?.("form")) return;
      event.preventDefault();
      const data = new scope.FormData(form);
      if (form.matches("[data-hlc-create-assessment]")) { const assessment = createAssessment(data.get("type")); const next = clone(state); next.assessments.unshift(assessment); next.ui.selectedAssessmentId = assessment.id; timerAssessmentId = assessment.id; timerStartedAt = Date.now(); return setState(next, "Đã tạo và xáo ngân hàng câu hỏi."); }
      if (form.dataset.hlcSubmitAssessment) { const assessment = state.assessments.find((item) => item.id === form.dataset.hlcSubmitAssessment); const answers = Object.fromEntries(assessment.questions.map((question) => [question.id, data.get(`answer-${question.id}`) || ""])); const result = submitAttempt(state, { assessmentId: assessment.id, answers, startedAt: iso(timerAssessmentId === assessment.id ? timerStartedAt : Date.now()) }); const placement = assessment.type === "placement" && !result.result.needsRubric ? ` Khuyến nghị: ${result.result.recommendedLevel}.` : ""; return setState(result.state, result.result.needsRubric ? "Đã chấm phần trắc nghiệm; phần rubric đang chờ giáo viên." : `Hoàn tất: ${result.result.score}%.${placement}`); }
      if (form.matches("[data-hlc-assignment]")) { try { const result = createAssignment(state, { classId: state.ui.selectedClassId, title: data.get("title"), instructions: data.get("instructions"), dueAt: data.get("dueAt"), target: data.get("target") }); setState(result.state, "Đã giao bài."); } catch (error) { setState(state, error.message); } return; }
      if (form.matches("[data-hlc-discussion]")) { try { const result = addDiscussion(state, { classId: state.ui.selectedClassId, text: data.get("text") }); setState(result.state, "Đã đăng thảo luận trên thiết bị."); } catch (error) { setState(state, error.message); } }
      if (form.matches("[data-hlc-project-lesson]")) { try { const result = createProjectLesson(state, { title: data.get("title"), goal: data.get("goal"), subject: data.get("subject") }); setState(result.state, "Đã tạo lộ trình Project to Lesson."); } catch (error) { setState(state, error.message); } return; }
      if (form.matches("[data-hlc-study-group]")) { try { const result = createStudyGroup(state, { name: data.get("name"), goal: data.get("goal") }); setState(result.state, `Đã tạo nhóm ${result.group.code} trên thiết bị.`); } catch (error) { setState(state, error.message); } return; }
      if (form.matches("[data-hlc-knowledge]")) { try { const result = addKnowledgeItem(state, { type: data.get("type"), title: data.get("title"), content: data.get("content") }); setState(result.state, "Đã thêm vào Knowledge Loop."); } catch (error) { setState(state, error.message); } }
    };
    let drawing = null;
    const bindCanvas = () => {
      const canvas = host.querySelector?.("[data-hlc-whiteboard]");
      const room = state.studyRooms[0];
      if (!canvas?.getContext) return;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      (state.whiteboards[room?.id] || []).forEach((stroke) => { context.beginPath(); context.strokeStyle = stroke.color; context.lineWidth = stroke.width; context.lineCap = "round"; stroke.points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.stroke(); });
      const point = (event) => { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }; };
      canvas.onpointerdown = (event) => { if (!room) return; drawing = { color: host.querySelector?.("[data-hlc-ink]")?.value || "#53cbd6", width: 3, points: [point(event)] }; context.beginPath(); context.moveTo(drawing.points[0].x, drawing.points[0].y); canvas.setPointerCapture?.(event.pointerId); };
      canvas.onpointermove = (event) => { if (!drawing) return; const nextPoint = point(event); drawing.points.push(nextPoint); context.lineTo(nextPoint.x, nextPoint.y); context.strokeStyle = drawing.color; context.lineWidth = drawing.width; context.lineCap = "round"; context.stroke(); };
      canvas.onpointerup = () => { if (drawing?.points.length > 1 && room) state = store.set(addWhiteboardStroke(state, room.id, drawing)); drawing = null; };
    };
    host.addEventListener?.("click", onClick);
    host.addEventListener?.("submit", onSubmit);
    render(host, state);
    bindCanvas();
    const tickAssessment = () => {
      const assessment = state.assessments.find((item) => item.id === state.ui.selectedAssessmentId) || state.assessments[0];
      const output = host.querySelector?.("[data-hlc-timer]");
      if (!assessment || !output) return;
      if (timerAssessmentId !== assessment.id) { timerAssessmentId = assessment.id; timerStartedAt = Date.now(); }
      const remaining = Math.max(0, assessment.durationMinutes * 60 - Math.floor((Date.now() - timerStartedAt) / 1000));
      output.textContent = timerText(remaining);
      output.setAttribute?.("aria-label", remaining ? `Còn ${remaining} giây` : "Đã hết thời gian");
    };
    tickAssessment();
    const timerId = scope.setInterval?.(tickAssessment, 1000) || null;
    mounted = { host, onClick, onSubmit, store, scope, timerId };
    return Object.freeze({ view: state.activeView, getState: store.get, setAdapter, sync: (payload) => requestAdapter(scope, "sync", payload || { state: store.get() }), unmount });
  }

  function unmount() {
    if (!mounted) return;
    mounted.host.removeEventListener?.("click", mounted.onClick);
    mounted.host.removeEventListener?.("submit", mounted.onSubmit);
    if (mounted.timerId != null) mounted.scope.clearInterval?.(mounted.timerId);
    mounted.host.innerHTML = "";
    mounted = null;
  }

  const API = Object.freeze({
    VERSION, STORAGE_KEY, VIEWS, VIEW_ALIASES, ASSESSMENT_TYPES, ROLES, TYPE_LABELS, RUBRIC, QUESTION_BANK, PLACEMENT_BANDS,
    supports: (view) => VIEWS.includes(VIEW_ALIASES[view] || view), defaultState, normalizeState, shuffled, createAssessment, placementRecommendation, gradeAssessment, submitAttempt, applyPlacementRecommendation,
    issueCertificate, createClassroom, joinClassroom, createAssignment, submitAssignment, gradeSubmission, addDiscussion,
    updatePassport, addMistake, reviewMistake, createProjectLesson, completeProjectStep, createStudyGroup, completeDailyMission, addKnowledgeItem,
    createStudyRoom, updatePomodoro, addWhiteboardStroke, buildCatchUp, createStore, setAdapter, requestAdapter, verifyAdapterResult, mount, unmount
  });

  root.HHLearningClassroom = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();
