(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const STORAGE_KEY = "hh.learning.os.v1";
  const SCHEMA_VERSION = 1;
  const DAY = 86_400_000;
  const MAX_HISTORY = 240;
  const LEVELS = Object.freeze(["A0", "A1", "A2", "B1", "B2", "C1", "C2"]);
  const MASTERY_STATES = Object.freeze(["new", "familiar", "mastered", "review"]);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const clean = (value, max = 180) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  const uid = (prefix = "item") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const dayKey = (time = Date.now()) => new Date(time).toISOString().slice(0, 10);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const safeArray = (value, limit = 100) => Array.isArray(value) ? value.slice(0, limit) : [];

  const SKILLS = Object.freeze([
    { id: "vocabulary", label: "Từ vựng", color: "#56d9e8" },
    { id: "grammar", label: "Ngữ pháp", color: "#9b87f5" },
    { id: "listening", label: "Nghe", color: "#f4c95d" },
    { id: "speaking", label: "Nói", color: "#f06bb5" },
    { id: "reading", label: "Đọc", color: "#79d7a5" },
    { id: "writing", label: "Viết", color: "#f28c65" },
    { id: "project", label: "Dự án", color: "#7aa8ff" }
  ]);

  const TRACKS = Object.freeze([
    ["communication", "Tiếng Anh giao tiếp", "Giao tiếp tự nhiên trong đời sống", ["speaking", "listening"]],
    ["ielts", "IELTS", "Academic English và chiến lược bốn kỹ năng", ["writing", "reading", "listening"]],
    ["toeic", "TOEIC", "Tiếng Anh môi trường làm việc và bài thi TOEIC", ["listening", "reading"]],
    ["vstep", "VSTEP", "Lộ trình chuẩn năng lực ngoại ngữ Việt Nam", ["speaking", "writing"]],
    ["technology", "Công nghệ thông tin", "Phần mềm, dữ liệu, cloud và bảo mật", ["vocabulary", "project"]],
    ["design", "Thiết kế đồ họa", "UI/UX, typography, brand và trình bày ý tưởng", ["speaking", "project"]],
    ["media", "Video và âm thanh", "Sản xuất nội dung, hậu kỳ và âm thanh", ["vocabulary", "project"]],
    ["marketing", "Marketing", "Chiến dịch, khách hàng và phân tích hiệu quả", ["writing", "speaking"]],
    ["business", "Kinh doanh", "Họp, đàm phán và trình bày kế hoạch", ["speaking", "writing"]],
    ["hospitality", "Du lịch và khách sạn", "Phục vụ khách hàng và xử lý tình huống", ["speaking", "listening"]],
    ["healthcare", "Y tế và điều dưỡng", "Giao tiếp lâm sàng và thuật ngữ an toàn", ["vocabulary", "listening"]],
    ["engineering", "Kỹ thuật", "Thông số, quy trình và an toàn công nghiệp", ["reading", "project"]],
    ["finance", "Tài chính và ngân hàng", "Báo cáo, giao dịch và phân tích", ["reading", "writing"]],
    ["logistics", "Logistics", "Chuỗi cung ứng, vận chuyển và chứng từ", ["vocabulary", "writing"]],
    ["interview", "Phỏng vấn xin việc", "CV, phỏng vấn và giao tiếp chuyên nghiệp", ["speaking", "writing"]],
    ["academic", "Tiếng Anh học thuật", "Nghiên cứu, thuyết trình và viết học thuật", ["reading", "writing"]]
  ].map(([id, title, description, focus]) => ({ id, title, description, focus })));

  const LESSON_TYPES = Object.freeze(["article", "video", "flashcard", "fill", "drag", "match", "listen", "record", "write", "scenario", "quiz"]);

  function seedLessons() {
    return TRACKS.flatMap((track, trackIndex) => LEVELS.map((level, levelIndex) => ({
      id: `${track.id}-${level.toLowerCase()}-01`,
      trackId: track.id,
      level,
      title: levelIndex < 2 ? `Nền tảng ${track.title}` : `${track.title}: tình huống ${level}`,
      description: `Bài học thích ứng cho ${track.title}, cấp ${level}.`,
      minutes: 5 + ((trackIndex + levelIndex) % 8),
      skills: [...track.focus, "vocabulary"].filter((value, index, array) => array.indexOf(value) === index),
      types: LESSON_TYPES.slice(0, 5 + (levelIndex % 6)),
      difficulty: levelIndex + 1,
      xp: 20 + levelIndex * 5
    })));
  }

  const LESSONS = Object.freeze(seedLessons());

  function masterySeed() {
    return Object.fromEntries(SKILLS.map((skill) => [skill.id, {
      skillId: skill.id,
      state: "new",
      score: 0,
      accuracy: 0,
      attempts: 0,
      correct: 0,
      updatedAt: null
    }]));
  }

  function defaultState(now = Date.now()) {
    return {
      version: SCHEMA_VERSION,
      profile: {
        configured: false,
        goal: "communication",
        level: "A0",
        dailyMinutes: 15,
        career: "communication",
        focusSkills: ["speaking", "listening"],
        retentionGoal: 90,
        name: "Học viên HH"
      },
      activeLessonId: "communication-a0-01",
      progress: {},
      mastery: masterySeed(),
      reviews: [],
      mistakes: [],
      sessions: [],
      assessments: [],
      deadlines: [{ id: "deadline-welcome", title: "Hoàn thành bài đầu tiên", dueAt: new Date(now + 2 * DAY).toISOString(), type: "lesson", completed: false }],
      streak: { count: 0, best: 0, lastStudyDay: null },
      daily: { date: dayKey(now), minutes: 0, xp: 0, lessons: 0, reviews: 0 },
      classes: [],
      submissions: [],
      certificates: [],
      passport: [],
      notes: [],
      settings: { reducedMotion: false, sound: true, beginnerMode: true },
      updatedAt: new Date(now).toISOString()
    };
  }

  function normalizeMastery(value) {
    const source = value && typeof value === "object" ? value : {};
    return Object.fromEntries(SKILLS.map((skill) => {
      const item = source[skill.id] || {};
      const attempts = clamp(item.attempts, 0, 100_000);
      const correct = clamp(item.correct, 0, attempts);
      const score = clamp(item.score, 0, 100);
      return [skill.id, {
        skillId: skill.id,
        state: MASTERY_STATES.includes(item.state) ? item.state : score >= 80 ? "mastered" : score >= 45 ? "familiar" : "new",
        score,
        accuracy: attempts ? Math.round(correct / attempts * 100) : clamp(item.accuracy, 0, 100),
        attempts,
        correct,
        updatedAt: item.updatedAt ? clean(item.updatedAt, 40) : null
      }];
    }));
  }

  function normalizeState(input, now = Date.now()) {
    const base = defaultState(now);
    const value = input && typeof input === "object" ? input : {};
    const profile = value.profile && typeof value.profile === "object" ? value.profile : {};
    const focus = safeArray(profile.focusSkills, 4).map((item) => clean(item, 30)).filter((id) => SKILLS.some((skill) => skill.id === id));
    const level = LEVELS.includes(profile.level) ? profile.level : base.profile.level;
    const career = TRACKS.some((track) => track.id === profile.career) ? profile.career : base.profile.career;
    const state = {
      ...base,
      version: SCHEMA_VERSION,
      profile: {
        configured: Boolean(profile.configured),
        goal: ["communication", "exam", "work", "career"].includes(profile.goal) ? profile.goal : base.profile.goal,
        level,
        dailyMinutes: clamp(profile.dailyMinutes || 15, 5, 120),
        career,
        focusSkills: focus.length ? focus : TRACKS.find((track) => track.id === career)?.focus || base.profile.focusSkills,
        retentionGoal: [85, 90, 95].includes(Number(profile.retentionGoal)) ? Number(profile.retentionGoal) : 90,
        name: clean(profile.name || base.profile.name, 80)
      },
      activeLessonId: LESSONS.some((lesson) => lesson.id === value.activeLessonId) ? value.activeLessonId : `${career}-${level.toLowerCase()}-01`,
      progress: Object.fromEntries(Object.entries(value.progress || {}).slice(0, 500).map(([id, item]) => [clean(id, 100), {
        status: ["started", "completed"].includes(item?.status) ? item.status : "started",
        score: clamp(item?.score, 0, 100),
        attempts: clamp(item?.attempts, 0, 999),
        seconds: clamp(item?.seconds, 0, 86_400),
        completedAt: item?.completedAt ? clean(item.completedAt, 40) : null
      }])),
      mastery: normalizeMastery(value.mastery),
      reviews: safeArray(value.reviews, 1000).map((item) => ({
        id: clean(item.id || uid("review"), 100),
        prompt: clean(item.prompt, 300),
        answer: clean(item.answer, 600),
        trackId: TRACKS.some((track) => track.id === item.trackId) ? item.trackId : career,
        skillId: SKILLS.some((skill) => skill.id === item.skillId) ? item.skillId : "vocabulary",
        difficulty: clamp(item.difficulty || 3, 1, 10),
        stability: clamp(item.stability || 1, 0.1, 3650),
        intervalDays: clamp(item.intervalDays || 0, 0, 3650),
        lapses: clamp(item.lapses, 0, 999),
        dueAt: item.dueAt ? clean(item.dueAt, 40) : new Date(now).toISOString(),
        lastRating: ["again", "hard", "good", "easy"].includes(item.lastRating) ? item.lastRating : null
      })).filter((item) => item.prompt),
      mistakes: safeArray(value.mistakes, MAX_HISTORY).map((item) => ({
        id: clean(item.id || uid("mistake"), 100), lessonId: clean(item.lessonId, 100), skillId: clean(item.skillId || "vocabulary", 30),
        prompt: clean(item.prompt, 300), answer: clean(item.answer, 600), userAnswer: clean(item.userAnswer, 600), createdAt: clean(item.createdAt || new Date(now).toISOString(), 40), resolved: Boolean(item.resolved)
      })),
      sessions: safeArray(value.sessions, MAX_HISTORY).map((item) => ({ id: clean(item.id || uid("session"), 100), type: clean(item.type, 40), minutes: clamp(item.minutes, 0, 480), score: clamp(item.score, 0, 100), createdAt: clean(item.createdAt || new Date(now).toISOString(), 40) })),
      assessments: safeArray(value.assessments, 100).map((item) => ({ id: clean(item.id || uid("assessment"), 100), type: clean(item.type, 40), score: clamp(item.score, 0, 100), level: LEVELS.includes(item.level) ? item.level : level, createdAt: clean(item.createdAt || new Date(now).toISOString(), 40), official: false })),
      deadlines: safeArray(value.deadlines, 100).map((item) => ({ id: clean(item.id || uid("deadline"), 100), title: clean(item.title, 160), dueAt: clean(item.dueAt || new Date(now + DAY).toISOString(), 40), type: clean(item.type || "lesson", 40), completed: Boolean(item.completed) })),
      streak: { count: clamp(value.streak?.count, 0, 100_000), best: clamp(value.streak?.best, 0, 100_000), lastStudyDay: value.streak?.lastStudyDay ? clean(value.streak.lastStudyDay, 20) : null },
      daily: value.daily?.date === dayKey(now) ? { date: dayKey(now), minutes: clamp(value.daily.minutes, 0, 1440), xp: clamp(value.daily.xp, 0, 100_000), lessons: clamp(value.daily.lessons, 0, 1000), reviews: clamp(value.daily.reviews, 0, 1000) } : base.daily,
      classes: safeArray(value.classes, 50).map((item) => ({ id: clean(item.id || uid("class"), 100), name: clean(item.name, 100), code: clean(item.code, 16).toUpperCase(), role: ["teacher", "student"].includes(item.role) ? item.role : "student", members: clamp(item.members || 1, 1, 500), unread: clamp(item.unread, 0, 999) })),
      submissions: safeArray(value.submissions, 200).map((item) => ({ id: clean(item.id || uid("submission"), 100), assignmentId: clean(item.assignmentId, 100), status: ["draft", "submitted", "returned"].includes(item.status) ? item.status : "draft", score: item.score == null ? null : clamp(item.score, 0, 100), feedback: clean(item.feedback, 800) })),
      certificates: safeArray(value.certificates, 50).map((item) => ({ id: clean(item.id || uid("certificate"), 100), title: clean(item.title, 160), code: clean(item.code, 40), issuedAt: clean(item.issuedAt, 40), score: clamp(item.score, 0, 100), verified: false })),
      passport: safeArray(value.passport, 200).map((item) => ({ id: clean(item.id || uid("passport"), 100), skillId: clean(item.skillId, 30), title: clean(item.title, 160), evidence: clean(item.evidence, 300), earnedAt: clean(item.earnedAt || new Date(now).toISOString(), 40) })),
      notes: safeArray(value.notes, 100).map((item) => ({ id: clean(item.id || uid("note"), 100), lessonId: clean(item.lessonId, 100), text: clean(item.text, 3000), updatedAt: clean(item.updatedAt || new Date(now).toISOString(), 40) })),
      settings: { reducedMotion: Boolean(value.settings?.reducedMotion), sound: value.settings?.sound !== false, beginnerMode: value.settings?.beginnerMode !== false },
      updatedAt: new Date(now).toISOString()
    };
    return state;
  }

  function scheduleReview(card, rating = "good", now = Date.now(), retentionGoal = 90) {
    const source = card && typeof card === "object" ? card : {};
    const grade = ["again", "hard", "good", "easy"].includes(rating) ? rating : "good";
    const previous = clamp(source.intervalDays || 0, 0, 3650);
    const stability = clamp(source.stability || 1, 0.1, 3650);
    const retentionFactor = clamp(retentionGoal, 85, 95) / 90;
    const multipliers = { again: 0, hard: 1.25, good: 2.25, easy: 3.6 };
    const intervalDays = grade === "again" ? 0 : clamp(Math.max(1, (previous || stability) * multipliers[grade] / retentionFactor), 1, 3650);
    const dueDelay = grade === "again" ? 10 * 60_000 : Math.round(intervalDays * DAY);
    return {
      ...source,
      stability: grade === "again" ? Math.max(0.5, stability * 0.55) : clamp(stability + intervalDays * 0.18, 0.5, 3650),
      difficulty: clamp((source.difficulty || 3) + ({ again: 1, hard: 0.35, good: -0.1, easy: -0.35 })[grade], 1, 10),
      intervalDays: Number(intervalDays.toFixed(2)),
      lapses: clamp((source.lapses || 0) + (grade === "again" ? 1 : 0), 0, 999),
      lastRating: grade,
      dueAt: new Date(now + dueDelay).toISOString()
    };
  }

  function updateMastery(item, correct, now = Date.now()) {
    const current = item || {};
    const attempts = clamp((current.attempts || 0) + 1, 0, 100_000);
    const totalCorrect = clamp((current.correct || 0) + (correct ? 1 : 0), 0, attempts);
    const accuracy = Math.round(totalCorrect / attempts * 100);
    const score = clamp((current.score || 0) + (correct ? attempts < 4 ? 16 : 7 : -11), 0, 100);
    const state = !correct && attempts > 1 ? "review" : score >= 80 && accuracy >= 75 ? "mastered" : score >= 40 ? "familiar" : "new";
    return { ...current, state, score, accuracy, attempts, correct: totalCorrect, updatedAt: new Date(now).toISOString() };
  }

  function adaptiveDifficulty(state, skillId) {
    const item = normalizeMastery(state?.mastery)[skillId] || {};
    const levelBase = Math.max(1, LEVELS.indexOf(state?.profile?.level) + 1);
    if (item.attempts < 3) return levelBase;
    if (item.accuracy >= 88) return clamp(levelBase + 1, 1, 7);
    if (item.accuracy < 55) return clamp(levelBase - 1, 1, 7);
    return levelBase;
  }

  function pathForProfile(profile = {}) {
    const level = LEVELS.includes(profile.level) ? profile.level : "A0";
    const trackId = TRACKS.some((track) => track.id === profile.career) ? profile.career : "communication";
    const start = Math.max(0, LEVELS.indexOf(level));
    const levelWindow = LEVELS.slice(Math.max(0, start - 1), Math.min(LEVELS.length, start + 3));
    return LESSONS.filter((lesson) => lesson.trackId === trackId && levelWindow.includes(lesson.level)).sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
  }

  function weakSkills(state) {
    return Object.values(normalizeMastery(state?.mastery)).sort((a, b) => {
      const aNeed = a.state === "review" ? -100 : a.score;
      const bNeed = b.state === "review" ? -100 : b.score;
      return aNeed - bNeed;
    }).slice(0, 3);
  }

  function buildDailyPlan(input, now = Date.now()) {
    const state = normalizeState(input, now);
    const path = pathForProfile(state.profile);
    const active = LESSONS.find((lesson) => lesson.id === state.activeLessonId) || path.find((lesson) => state.progress[lesson.id]?.status !== "completed") || path[0];
    const due = state.reviews.filter((review) => Date.parse(review.dueAt) <= now).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
    const upcoming = state.deadlines.filter((item) => !item.completed).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))[0] || null;
    const percent = clamp(Math.round(state.daily.minutes / state.profile.dailyMinutes * 100), 0, 100);
    return {
      continueLesson: active,
      reviewsDue: due,
      quickTest: { id: "quick-test", title: `Kiểm tra ${state.profile.level}`, questions: 5, minutes: 4, skills: state.profile.focusSkills },
      goal: { targetMinutes: state.profile.dailyMinutes, completedMinutes: state.daily.minutes, percent },
      weakSkills: weakSkills(state),
      upcomingDeadline: upcoming,
      path,
      streak: state.streak,
      daily: state.daily
    };
  }

  function recordStudy(input, payload = {}, now = Date.now()) {
    const state = normalizeState(input, now);
    const today = dayKey(now);
    if (state.daily.date !== today) state.daily = { date: today, minutes: 0, xp: 0, lessons: 0, reviews: 0 };
    const previousDay = dayKey(now - DAY);
    if (state.streak.lastStudyDay !== today) {
      state.streak.count = state.streak.lastStudyDay === previousDay ? state.streak.count + 1 : 1;
      state.streak.best = Math.max(state.streak.best, state.streak.count);
      state.streak.lastStudyDay = today;
    }
    const minutes = clamp(payload.minutes || 1, 1, 240);
    const score = clamp(payload.score, 0, 100);
    state.daily.minutes = clamp(state.daily.minutes + minutes, 0, 1440);
    state.daily.xp = clamp(state.daily.xp + clamp(payload.xp || 10, 1, 500), 0, 100_000);
    if (payload.type === "lesson") state.daily.lessons += 1;
    if (payload.type === "review") state.daily.reviews += 1;
    state.sessions.unshift({ id: uid("session"), type: clean(payload.type || "study", 40), minutes, score, createdAt: new Date(now).toISOString() });
    state.sessions = state.sessions.slice(0, MAX_HISTORY);
    safeArray(payload.skills, 8).forEach((skillId) => {
      if (state.mastery[skillId]) state.mastery[skillId] = updateMastery(state.mastery[skillId], score >= 60, now);
    });
    if (payload.lessonId && LESSONS.some((lesson) => lesson.id === payload.lessonId)) {
      state.progress[payload.lessonId] = { status: payload.completed === false ? "started" : "completed", score, attempts: clamp((state.progress[payload.lessonId]?.attempts || 0) + 1, 1, 999), seconds: minutes * 60, completedAt: payload.completed === false ? null : new Date(now).toISOString() };
      state.activeLessonId = pathForProfile(state.profile).find((lesson) => state.progress[lesson.id]?.status !== "completed")?.id || payload.lessonId;
    }
    return normalizeState(state, now);
  }

  function certificateFor(state, title = "HH Learning Path", now = Date.now()) {
    const cleanTitle = clean(title, 160) || "HH Learning Path";
    const fingerprint = Array.from(`${state?.profile?.name || "HH"}:${cleanTitle}:${dayKey(now)}`).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7).toString(36).toUpperCase();
    return { id: uid("certificate"), title: cleanTitle, code: `HH-${dayKey(now).replace(/-/g, "")}-${fingerprint.slice(0, 8)}`, issuedAt: new Date(now).toISOString(), score: clamp(state?.assessments?.[0]?.score || 0, 0, 100), verified: false };
  }

  function createStore(storage = root.localStorage) {
    let state = defaultState();
    const listeners = new Set();
    const persist = () => {
      try { storage?.setItem?.(STORAGE_KEY, JSON.stringify(state)); } catch {}
      listeners.forEach((listener) => listener(clone(state)));
      try { root.dispatchEvent?.(new CustomEvent("hh:learning:state", { detail: { state: clone(state) } })); } catch {}
    };
    try { state = normalizeState(JSON.parse(storage?.getItem?.(STORAGE_KEY) || "null")); } catch { state = defaultState(); }
    return Object.freeze({
      get: () => clone(state),
      set: (next) => { state = normalizeState(next); persist(); return clone(state); },
      update: (recipe, now = Date.now()) => { const draft = clone(state); const result = typeof recipe === "function" ? recipe(draft) : { ...draft, ...(recipe || {}) }; state = normalizeState(result || draft, now); persist(); return clone(state); },
      recordStudy: (payload) => { state = recordStudy(state, payload); persist(); return clone(state); },
      subscribe: (listener) => { if (typeof listener !== "function") return () => {}; listeners.add(listener); return () => listeners.delete(listener); },
      export: () => JSON.stringify({ format: "hh-learning", version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), state }, null, 2),
      import: (text) => { if (String(text).length > 2_000_000) throw new Error("Tệp Learning vượt quá 2 MB."); const parsed = JSON.parse(text); if (parsed?.format !== "hh-learning") throw new Error("Không đúng định dạng HH Learning."); state = normalizeState(parsed.state); persist(); return clone(state); },
      reset: () => { state = defaultState(); persist(); return clone(state); }
    });
  }

  root.HHLearningCore = Object.freeze({
    version: SCHEMA_VERSION,
    storageKey: STORAGE_KEY,
    levels: LEVELS,
    skills: SKILLS,
    tracks: TRACKS,
    lessons: LESSONS,
    lessonTypes: LESSON_TYPES,
    masteryStates: MASTERY_STATES,
    defaultState,
    normalizeState,
    normalizeMastery,
    scheduleReview,
    updateMastery,
    adaptiveDifficulty,
    pathForProfile,
    weakSkills,
    buildDailyPlan,
    recordStudy,
    certificateFor,
    createStore,
    clean,
    clamp,
    dayKey,
    uid
  });

  if (typeof module !== "undefined" && module.exports) module.exports = root.HHLearningCore;
})();
