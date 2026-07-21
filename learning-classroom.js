(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const VERSION = 1;
  const STORAGE_KEY = "hh.learning.classroom.v1";
  const VIEWS = Object.freeze(["assessments", "certificates", "classroom", "study-together", "catch-up"]);
  const ASSESSMENT_TYPES = Object.freeze(["placement", "lesson-quiz", "unit-test", "course-challenge", "timed-mock"]);
  const ROLES = Object.freeze(["teacher", "student"]);
  const MAX = Object.freeze({ attempts: 120, classes: 24, assignments: 240, submissions: 500, discussions: 500, strokes: 1800 });
  const DEFAULT_DURATION = Object.freeze({ placement: 15, "lesson-quiz": 5, "unit-test": 20, "course-challenge": 30, "timed-mock": 60 });
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
      certificates: [],
      classrooms: [],
      assignments: [],
      submissions: [],
      discussions: [],
      studyRooms: [],
      pomodoro: { mode: "focus", duration: 25 * 60, remaining: 25 * 60, running: false, updatedAt: iso(), rounds: 0 },
      whiteboards: {},
      adapter: { connected: false, name: "local", lastSyncAt: null, error: "" },
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
      currentUser: { id: clean(currentUser.id || base.currentUser.id, 80), name: clean(currentUser.name || base.currentUser.name, 80), role: ROLES.includes(currentUser.role) ? currentUser.role : "student" },
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
        startedAt: validDate(item?.startedAt), submittedAt: validDate(item?.submittedAt), elapsedSeconds: clamp(item?.elapsedSeconds, 0, 86_400)
      })),
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
      studyRooms: list(value.studyRooms, 30).map((item) => ({ id: clean(item?.id || uid("room"), 80), code: clean(item?.code || classCode(), 12).toUpperCase(), name: clean(item?.name || "Phòng học", 100), ownerId: clean(item?.ownerId, 80), memberIds: list(item?.memberIds, 50).map((id) => clean(id, 80)), createdAt: validDate(item?.createdAt), mode: "local" })),
      pomodoro: { mode: value.pomodoro?.mode === "break" ? "break" : "focus", duration: clamp(value.pomodoro?.duration || 1500, 60, 7200), remaining: clamp(value.pomodoro?.remaining ?? value.pomodoro?.duration ?? 1500, 0, 7200), running: Boolean(value.pomodoro?.running), updatedAt: validDate(value.pomodoro?.updatedAt), rounds: clamp(value.pomodoro?.rounds, 0, 9999) },
      whiteboards: Object.fromEntries(Object.entries(value.whiteboards || {}).slice(0, 30).map(([roomId, strokes]) => [clean(roomId, 80), list(strokes, MAX.strokes).map((stroke) => ({ color: /^#[0-9a-f]{6}$/i.test(stroke?.color) ? stroke.color : "#53cbd6", width: clamp(stroke?.width || 3, 1, 20), points: list(stroke?.points, 300).map((point) => ({ x: clamp(point?.x, 0, 5000), y: clamp(point?.y, 0, 5000) })) })).filter((stroke) => stroke.points.length > 1)])),
      adapter: { connected: Boolean(value.adapter?.connected), name: clean(value.adapter?.name || "local", 80), lastSyncAt: value.adapter?.lastSyncAt ? validDate(value.adapter.lastSyncAt) : null, error: clean(value.adapter?.error, 300) },
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
    const recommendedLevel = weighted >= 92 ? "C2" : weighted >= 84 ? "C1" : weighted >= 72 ? "B2" : weighted >= 60 ? "B1" : weighted >= 45 ? "A2" : weighted >= 25 ? "A1" : "A0";
    return { score: weighted, autoScore, correct, objectiveCount: objective.length, rubricCount: rubricItems.length, needsRubric: rubricItems.length > reviewedScores.length, recommendedLevel };
  }

  function submitAttempt(state, payload = {}) {
    const next = normalizeState(state);
    const assessment = next.assessments.find((item) => item.id === payload.assessmentId);
    if (!assessment) throw new Error("Không tìm thấy bài đánh giá.");
    const startedAt = payload.startedAt && Number.isFinite(Date.parse(payload.startedAt)) ? Date.parse(payload.startedAt) : Date.now();
    const elapsedSeconds = clamp(Math.round((Date.now() - startedAt) / 1000), 0, assessment.durationMinutes * 60 + 300);
    const result = gradeAssessment(assessment, payload.answers, { rubricScores: payload.rubricScores });
    const attempt = { id: uid("attempt"), assessmentId: assessment.id, userId: next.currentUser.id, score: result.score, autoScore: result.autoScore, status: result.needsRubric ? "needs-rubric" : "graded", answers: payload.answers || {}, rubricScores: payload.rubricScores || {}, feedback: result.needsRubric ? "Phần nói/viết đang chờ giáo viên đánh giá bằng rubric." : "Đã chấm các câu có đáp án rõ ràng.", recommendedLevel: assessment.type === "placement" && !result.needsRubric ? result.recommendedLevel : null, startedAt: iso(startedAt), submittedAt: iso(), elapsedSeconds };
    next.attempts.unshift(attempt);
    next.attempts = next.attempts.slice(0, MAX.attempts);
    return { state: normalizeState(next), attempt: normalizeState({ attempts: [attempt] }).attempts[0], result };
  }

  function issueCertificate(state, payload = {}) {
    const next = normalizeState(state);
    const attempt = next.attempts.find((item) => item.id === payload.attemptId) || next.attempts[0];
    if (!attempt || attempt.status === "needs-rubric") throw new Error("Cần một bài đã chấm hoàn tất trước khi tạo chứng chỉ xem trước.");
    const title = clean(payload.title || "Hoàn thành lộ trình HH Learning", 160);
    const fingerprint = Array.from(`${next.currentUser.id}:${title}:${attempt.score}:${iso().slice(0, 10)}`).reduce((sum, char) => (sum * 33 + char.charCodeAt(0)) >>> 0, 5381).toString(36).toUpperCase();
    const certificate = { id: uid("certificate"), code: `HH-LOCAL-${iso().slice(0, 10).replace(/-/g, "")}-${fingerprint.slice(0, 7)}`, title, learner: next.currentUser.name, score: attempt.score, issuedAt: iso(), localPreview: true, onlineVerified: false };
    next.certificates.unshift(certificate);
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
    if (timer.running) timer.remaining = clamp(timer.remaining - Math.floor((now - Date.parse(timer.updatedAt)) / 1000), 0, timer.duration);
    if (action === "start") timer.running = timer.remaining > 0;
    if (action === "pause") timer.running = false;
    if (action === "reset") { timer.running = false; timer.remaining = timer.duration; }
    if (action === "toggle-mode") { timer.mode = timer.mode === "focus" ? "break" : "focus"; timer.duration = timer.mode === "focus" ? 1500 : 300; timer.remaining = timer.duration; timer.running = false; }
    if (timer.remaining === 0) { timer.running = false; timer.rounds += timer.mode === "focus" ? 1 : 0; }
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

  const assessmentOptions = () => ASSESSMENT_TYPES.map((type) => `<option value="${type}">${escapeHTML(TYPE_LABELS[type])}</option>`).join("");
  const nav = (active) => VIEWS.map((view) => `<button type="button" class="hlc-nav__item${view === active ? " is-active" : ""}" data-hlc-view="${view}">${escapeHTML({ assessments: "Đánh giá", certificates: "Chứng chỉ", classroom: "Lớp học", "study-together": "Học cùng nhau", "catch-up": "Bắt kịp" }[view])}</button>`).join("");

  function renderAssessments(state) {
    const selected = state.assessments.find((item) => item.id === state.ui.selectedAssessmentId) || state.assessments[0];
    const attempts = state.attempts.slice(0, 8).map((item) => `<li><strong>${item.score}%</strong><span>${escapeHTML(item.status === "needs-rubric" ? "Chờ rubric" : "Đã chấm")}</span><time>${new Date(item.submittedAt).toLocaleString("vi-VN")}</time></li>`).join("") || "<li class=\"hlc-empty\">Chưa có lần làm bài.</li>";
    const questions = selected?.questions.map((question, index) => `<fieldset class="hlc-question"><legend>${index + 1}. ${escapeHTML(question.prompt)}</legend>${question.kind === "choice" ? question.options.map((option) => `<label><input type="radio" name="answer-${escapeHTML(question.id)}" value="${escapeHTML(option)}"> <span>${escapeHTML(option)}</span></label>`).join("") : `<textarea name="answer-${escapeHTML(question.id)}" rows="4" placeholder="Nhập câu trả lời. Giáo viên sẽ đánh giá theo rubric ${escapeHTML(question.rubric)}."></textarea><small>${RUBRIC[question.rubric].map(escapeHTML).join(" · ")}</small>`}</fieldset>`).join("") || "";
    return `<section class="hlc-page" aria-labelledby="hlc-assessment-title"><header class="hlc-page__head"><div><span class="hlc-kicker">ASSESSMENT CENTER</span><h2 id="hlc-assessment-title">Đánh giá có lịch sử và rubric</h2><p>Kết quả trắc nghiệm được chấm cục bộ. Nói và viết luôn chờ giáo viên duyệt.</p></div><form data-hlc-create-assessment><select name="type" aria-label="Loại bài kiểm tra">${assessmentOptions()}</select><button class="hlc-primary">Tạo bài</button></form></header><div class="hlc-grid hlc-grid--assessment"><aside class="hlc-panel"><h3>Ngân hàng bài</h3>${state.assessments.map((item) => `<button class="hlc-list-button${selected?.id === item.id ? " is-active" : ""}" data-hlc-select-assessment="${escapeHTML(item.id)}"><span>${escapeHTML(item.title)}</span><small>${item.questions.length} câu · ${item.durationMinutes} phút</small></button>`).join("") || "<div class=\"hlc-empty\">Tạo bài đầu tiên để bắt đầu.</div>"}<h3>Lịch sử lần làm</h3><ul class="hlc-history">${attempts}</ul></aside><main class="hlc-panel hlc-exam">${selected ? `<div class="hlc-exam__bar"><div><strong>${escapeHTML(selected.title)}</strong><small>${selected.durationMinutes} phút · ${selected.shuffle ? "Đã xáo câu" : "Giữ thứ tự"}</small></div><output data-hlc-timer>${String(selected.durationMinutes).padStart(2, "0")}:00</output></div><form data-hlc-submit-assessment="${escapeHTML(selected.id)}">${questions}<button class="hlc-primary">Nộp bài</button></form>` : `<div class="hlc-empty hlc-empty--large">Chọn hoặc tạo một bài đánh giá.</div>`}</main></div></section>`;
  }

  function renderCertificates(state) {
    return `<section class="hlc-page"><header class="hlc-page__head"><div><span class="hlc-kicker">LOCAL CERTIFICATE PREVIEW</span><h2>Chứng chỉ xem trước minh bạch</h2><p>Trạng thái: Chưa xác minh online. Xác minh công khai, chống sửa đổi và URL tra cứu cần backend.</p></div><button class="hlc-primary" data-hlc-issue-certificate ${state.attempts.some((item) => item.status !== "needs-rubric") ? "" : "disabled"}>Tạo từ kết quả mới nhất</button></header><div class="hlc-certificate-grid">${state.certificates.map((item) => `<article class="hlc-certificate"><span>HH LEARNING PASSPORT</span><h3>${escapeHTML(item.title)}</h3><p>Trao cho <strong>${escapeHTML(item.learner)}</strong></p><div class="hlc-certificate__score">${item.score}%</div><code>${escapeHTML(item.code)}</code><small>Chỉ là bản xem trước trên thiết bị · Chưa xác minh online</small><button data-hlc-print type="button">In / lưu PDF</button></article>`).join("") || `<div class="hlc-empty hlc-empty--large">Hoàn tất một bài đã chấm để tạo chứng chỉ xem trước.</div>`}</div></section>`;
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
    return `<section class="hlc-page"><header class="hlc-page__head"><div><span class="hlc-kicker">STUDY TOGETHER · LOCAL ROOM</span><h2>Không gian tập trung nhẹ nhàng</h2><p>Pomodoro và bảng trắng chạy trên thiết bị. Presence nhiều người chỉ bật sau khi backend xác nhận.</p></div><button class="hlc-primary" data-hlc-create-room>${room ? "Tạo phòng khác" : "Tạo phòng học"}</button></header><div class="hlc-study-grid"><section class="hlc-pomodoro hlc-panel"><span>${timer.mode === "focus" ? "PHIÊN TẬP TRUNG" : "NGHỈ NGẮN"}</span><output data-hlc-pomodoro>${timerText(timer.remaining)}</output><div><button data-hlc-pomo="${timer.running ? "pause" : "start"}">${timer.running ? "Tạm dừng" : "Bắt đầu"}</button><button data-hlc-pomo="reset">Đặt lại</button><button data-hlc-pomo="toggle-mode">Đổi chế độ</button></div><small>${timer.rounds} vòng tập trung đã hoàn thành</small></section><section class="hlc-panel hlc-room"><h3>${room ? escapeHTML(room.name) : "Chưa có phòng"}</h3><p>${room ? `Mã ${escapeHTML(room.code)} · Chỉ local` : "Tạo phòng để bật bảng trắng."}</p><div class="hlc-whiteboard-wrap"><canvas data-hlc-whiteboard width="960" height="440" aria-label="Bảng trắng dùng chuột hoặc cảm ứng"></canvas><div><label>Màu <input data-hlc-ink type="color" value="#53cbd6"></label><button data-hlc-clear-board ${room ? "" : "disabled"}>Xóa bảng</button></div></div></section></div></section>`;
  }

  function renderCatchUp(state) {
    const selected = state.classrooms.find((item) => item.id === state.ui.selectedClassId) || state.classrooms[0];
    const result = buildCatchUp(state, selected?.id);
    return `<section class="hlc-page"><header class="hlc-page__head"><div><span class="hlc-kicker">SMART CATCH-UP · EXTRACTIVE LOCAL</span><h2>Bắt kịp mà không phóng đại AI</h2><p>Chỉ trích xuất hoạt động đã lưu trên thiết bị; không suy diễn nội dung không có nguồn.</p></div></header><article class="hlc-catchup"><div><span>${result.sourceCount} nguồn cục bộ</span><time>${new Date(result.generatedAt).toLocaleString("vi-VN")}</time></div><h3>${escapeHTML(result.title)}</h3><p>${escapeHTML(result.summary)}</p><small>${escapeHTML(result.method)}</small></article></section>`;
  }

  function render(host, state) {
    const body = state.activeView === "assessments" ? renderAssessments(state) : state.activeView === "certificates" ? renderCertificates(state) : state.activeView === "classroom" ? renderClassroom(state) : state.activeView === "study-together" ? renderStudy(state) : renderCatchUp(state);
    host.innerHTML = `<div class="hlc" data-hlc-root><header class="hlc-shell-head"><div><span class="hlc-logo">HH</span><div><strong>Learning Classroom</strong><small>Đánh giá · Lớp học · Study Together</small></div></div><nav aria-label="Learning Classroom">${nav(state.activeView)}</nav></header><div class="hlc-notice" aria-live="polite">${escapeHTML(state.ui.notice)}</div>${body}</div>`;
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
    if (VIEWS.includes(options.view)) state.activeView = options.view;
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
      if (target.hasAttribute("data-hlc-sync")) { try { const result = await requestAdapter(scope, "sync", { state }); const next = normalizeState(result?.state || state); next.adapter = { connected: true, name: clean(result?.name || "backend", 80), lastSyncAt: iso(), error: "" }; setState(next, "Đồng bộ backend thành công."); } catch (error) { const next = clone(state); next.adapter = { connected: false, name: "local", lastSyncAt: null, error: clean(error.message, 300) }; setState(next, error.message); } return; }
      if (target.dataset.hlcSubmitAssignment) { const text = promptValue(scope, "Nội dung bài nộp"); if (text) { try { const result = submitAssignment(state, { assignmentId: target.dataset.hlcSubmitAssignment, text }); setState(result.state, "Đã lưu metadata bài nộp trên thiết bị."); } catch (error) { setState(state, error.message); } } return; }
      if (target.dataset.hlcGrade) { const score = promptValue(scope, "Điểm số", "80"); const feedback = promptValue(scope, "Nhận xét", "Đã hoàn thành yêu cầu."); if (score != null) { try { const result = gradeSubmission(state, { submissionId: target.dataset.hlcGrade, score, feedback }); setState(result.state, "Đã lưu điểm và phản hồi."); } catch (error) { setState(state, error.message); } } return; }
      if (target.hasAttribute("data-hlc-create-room")) { const name = promptValue(scope, "Tên phòng học", "Focus Room"); if (name) { const result = createStudyRoom(state, { name }); setState(result.state, "Phòng local đã sẵn sàng. Backend cần thiết cho nhiều người."); } return; }
      if (target.dataset.hlcPomo) return setState(updatePomodoro(state, target.dataset.hlcPomo), "Đã cập nhật Pomodoro.");
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
    VERSION, STORAGE_KEY, VIEWS, ASSESSMENT_TYPES, ROLES, TYPE_LABELS, RUBRIC, QUESTION_BANK,
    supports: (view) => VIEWS.includes(view), defaultState, normalizeState, shuffled, createAssessment, gradeAssessment, submitAttempt,
    issueCertificate, createClassroom, joinClassroom, createAssignment, submitAssignment, gradeSubmission, addDiscussion,
    createStudyRoom, updatePomodoro, addWhiteboardStroke, buildCatchUp, createStore, setAdapter, requestAdapter, mount, unmount
  });

  root.HHLearningClassroom = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();
