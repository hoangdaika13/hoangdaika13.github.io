(function initHHSchoolCore(root) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const BASE_KEY = "hh.school.v1";
  const DAY = 86_400_000;
  const ROLES = Object.freeze(["student", "parent", "teacher", "content-reviewer", "school-admin", "platform-admin"]);
  const MASTERY_STATES = Object.freeze(["not-started", "learning", "practice", "review-due", "mastered", "forgetting"]);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const safeId = (value, fallback = "default") => String(value || fallback).replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 100) || fallback;
  const clean = (value, max = 400) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  const nowIso = (now = Date.now()) => new Date(now).toISOString();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const normalizeAnswer = (value) => clean(value, 600).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
  const ownerIdFor = (user) => safeId(user?.id || user?._id || user?.email || "guest", "guest");
  const roleFor = (user) => {
    if (user?.access?.owner || user?.roles?.includes?.("owner")) return "platform-admin";
    const known = [...(user?.roles || []), user?.educationRole].map((item) => clean(item, 40).toLowerCase()).find((item) => ROLES.includes(item));
    return known || "student";
  };
  const storageKey = (ownerId, profileId) => `${BASE_KEY}:${safeId(ownerId, "guest")}:${safeId(profileId, "learner-1")}`;

  function learnerProfile(input = {}, ownerId = "guest") {
    const grade = clamp(input.grade || 1, 1, 12);
    return {
      id: safeId(input.id || "learner-1", "learner-1"), ownerId: safeId(ownerId, "guest"),
      name: clean(input.name || "Học sinh HH", 80), grade,
      managed: Boolean(input.managed), managerIds: Array.isArray(input.managerIds) ? input.managerIds.map((id) => safeId(id)).slice(0, 20) : [],
      electiveSubjectIds: grade >= 10 ? [...new Set((input.electiveSubjectIds || []).map((id) => safeId(id)).filter(Boolean))].slice(0, 4) : [],
      specialistClusters: grade >= 10 ? [...new Set((input.specialistClusters || []).map((id) => safeId(id)).filter(Boolean))].slice(0, 3) : [],
      ageMode: grade <= 2 ? "little" : grade <= 5 ? "primary" : grade <= 9 ? "secondary" : "career"
    };
  }

  function defaultState(context = {}, now = Date.now()) {
    const ownerId = ownerIdFor(context.currentUser);
    const profile = learnerProfile(context.profile || {}, ownerId);
    return {
      schemaVersion: SCHEMA_VERSION, ownerId, learnerProfileId: profile.id,
      createdAt: nowIso(now), updatedAt: nowIso(now), lastSyncedAt: null, syncStatus: "local-only",
      role: roleFor(context.currentUser), profile, activeView: "today", activeSubjectId: "math", activeLessonId: `g${profile.grade}-math-core-01`,
      progress: {}, mastery: {}, attempts: [], reviews: [], mistakes: [], assignments: [], classes: [], familyProfiles: [profile],
      schedules: [], aiSessions: [], notifications: [], contentDrafts: [], reviewQueue: [], auditLogs: [], preferences: {
        highContrast: false, dyslexia: false, largeText: profile.grade <= 2, reducedMotion: false, dailyMinutes: profile.grade <= 5 ? 20 : 35
      }
    };
  }

  function normalizeState(input, context = {}) {
    const fallback = defaultState(context);
    const state = input && typeof input === "object" ? clone(input) : {};
    const ownerId = ownerIdFor(context.currentUser) || fallback.ownerId;
    if (state.ownerId && safeId(state.ownerId) !== ownerId) return fallback;
    const profile = learnerProfile(state.profile || fallback.profile, ownerId);
    const bounded = (value, max) => Array.isArray(value) ? value.slice(-max) : [];
    return {
      ...fallback, ...state, schemaVersion: SCHEMA_VERSION, ownerId, learnerProfileId: profile.id, profile,
      role: ROLES.includes(state.role) ? state.role : fallback.role,
      progress: state.progress && typeof state.progress === "object" ? state.progress : {},
      mastery: state.mastery && typeof state.mastery === "object" ? state.mastery : {},
      attempts: bounded(state.attempts, 1000), reviews: bounded(state.reviews, 1000), mistakes: bounded(state.mistakes, 500),
      assignments: bounded(state.assignments, 500), classes: bounded(state.classes, 100), familyProfiles: bounded(state.familyProfiles, 12).map((item) => learnerProfile(item, ownerId)),
      schedules: bounded(state.schedules, 200), aiSessions: bounded(state.aiSessions, 100), notifications: bounded(state.notifications, 200),
      contentDrafts: bounded(state.contentDrafts, 500), reviewQueue: bounded(state.reviewQueue, 500), auditLogs: bounded(state.auditLogs, 1000),
      preferences: { ...fallback.preferences, ...(state.preferences || {}) }, updatedAt: clean(state.updatedAt || fallback.updatedAt, 40)
    };
  }

  function createStore(options = {}) {
    const storage = options.storage || root.localStorage;
    const context = { currentUser: options.currentUser, profile: options.profile };
    let state = defaultState(context);
    const listeners = new Set();
    const read = (profileId = state.learnerProfileId) => {
      try { state = normalizeState(JSON.parse(storage?.getItem?.(storageKey(state.ownerId, profileId)) || "null"), context); }
      catch { state = defaultState(context); }
      return clone(state);
    };
    const persist = () => {
      state.updatedAt = nowIso();
      storage?.setItem?.(storageKey(state.ownerId, state.learnerProfileId), JSON.stringify(state));
      listeners.forEach((listener) => listener(clone(state)));
      return clone(state);
    };
    const update = (mutator, event = "state:update") => {
      const draft = clone(state);
      const next = mutator(draft) || draft;
      state = normalizeState(next, context);
      state.auditLogs.push({ id: uid("audit"), event: clean(event, 100), actorRole: state.role, learnerProfileId: state.learnerProfileId, at: nowIso() });
      return persist();
    };
    read();
    return Object.freeze({ get: () => clone(state), read, update, replace: (next) => { state = normalizeState(next, context); return persist(); }, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }, export() { return JSON.stringify({ format: "hh-school", schemaVersion: SCHEMA_VERSION, exportedAt: nowIso(), data: state }, null, 2); }, import(payload) { const parsed = JSON.parse(payload); if (parsed?.format !== "hh-school") throw new Error("Sai định dạng dữ liệu HH School."); state = normalizeState(parsed.data, context); return persist(); } });
  }

  function gradeQuestion(question, rawAnswer) {
    const type = question?.type || "short";
    const actual = normalizeAnswer(rawAnswer);
    const expected = normalizeAnswer(question?.answer);
    let correct = false;
    if (type === "boolean") correct = (rawAnswer === true ? "true" : rawAnswer === false ? "false" : actual) === expected;
    else if (type === "multiple") {
      const a = [...new Set(Array.isArray(rawAnswer) ? rawAnswer.map(String) : [])].sort();
      const e = [...new Set(Array.isArray(question.answer) ? question.answer.map(String) : String(question.answer).split(","))].sort();
      correct = JSON.stringify(a) === JSON.stringify(e);
    } else correct = actual === expected;
    return { correct, score: correct ? 100 : 0, expected: question.answer, explanation: clean(question.explanation, 1000), skillId: safeId(question.skillId || "general") };
  }

  function nextMastery(previous = {}, result = {}, now = Date.now()) {
    const attempts = clamp((previous.attempts || 0) + 1, 0, 100000);
    const correct = clamp((previous.correct || 0) + (result.correct ? 1 : 0), 0, attempts);
    const accuracy = attempts ? Math.round(correct / attempts * 100) : 0;
    const helpPenalty = clamp(result.helpLevel || 0, 0, 3) * 8;
    const score = clamp(Math.round((previous.score || 0) * 0.72 + (result.correct ? 100 : 20) * 0.28 - helpPenalty), 0, 100);
    const repetitions = clamp((previous.repetitions || 0) + (result.correct ? 1 : 0), 0, 1000);
    const state = attempts < 2 ? "learning" : score >= 80 && repetitions >= 3 ? "mastered" : result.correct ? "practice" : "review-due";
    const intervalDays = result.correct ? Math.min(45, Math.max(1, Math.round((previous.intervalDays || 0.5) * (score >= 80 ? 2.2 : 1.4)))) : 0;
    return { attempts, correct, accuracy, score, state, repetitions, intervalDays, lastAttemptAt: nowIso(now), dueAt: nowIso(now + (intervalDays ? intervalDays * DAY : 10 * 60 * 1000)), averageResponseMs: Math.round(((previous.averageResponseMs || 0) * (attempts - 1) + clamp(result.responseMs, 0, 600000)) / attempts), helpUses: (previous.helpUses || 0) + (result.helpLevel ? 1 : 0), evidence: [...(previous.evidence || []).slice(-9), { correct: Boolean(result.correct), responseMs: clamp(result.responseMs, 0, 600000), helpLevel: clamp(result.helpLevel, 0, 3), at: nowIso(now) }] };
  }

  function recordAttempt(state, payload, now = Date.now()) {
    const next = clone(state);
    const result = gradeQuestion(payload.question, payload.answer);
    const skillId = result.skillId;
    const evidence = nextMastery(next.mastery[skillId], { ...result, responseMs: payload.responseMs, helpLevel: payload.helpLevel }, now);
    next.mastery[skillId] = evidence;
    next.attempts.push({ id: uid("attempt"), ownerId: next.ownerId, learnerProfileId: next.learnerProfileId, lessonId: safeId(payload.lessonId), questionId: safeId(payload.question?.id), skillId, answer: clean(Array.isArray(payload.answer) ? payload.answer.join(",") : payload.answer, 600), correct: result.correct, score: result.score, responseMs: clamp(payload.responseMs, 0, 600000), helpLevel: clamp(payload.helpLevel, 0, 3), source: payload.source || "in-app", createdAt: nowIso(now), updatedAt: nowIso(now), schemaVersion: SCHEMA_VERSION });
    next.reviews = next.reviews.filter((item) => item.skillId !== skillId).concat({ id: `review-${skillId}`, skillId, lessonId: safeId(payload.lessonId), dueAt: evidence.dueAt, state: evidence.state });
    if (!result.correct) {
      const existing = next.mistakes.find((item) => item.questionId === payload.question?.id);
      if (existing) { existing.occurrences += 1; existing.lastAt = nowIso(now); existing.userAnswer = clean(payload.answer, 400); }
      else next.mistakes.push({ id: uid("mistake"), questionId: safeId(payload.question?.id), lessonId: safeId(payload.lessonId), skillId, prompt: clean(payload.question?.prompt, 600), expected: clean(payload.question?.answer, 400), userAnswer: clean(payload.answer, 400), explanation: result.explanation, occurrences: 1, lastAt: nowIso(now) });
    }
    return { state: normalizeState(next, { currentUser: { id: next.ownerId, roles: [next.role] } }), result, mastery: evidence };
  }

  const can = (role, action) => {
    const permissions = {
      student: ["learn", "attempt", "view-own"], parent: ["view-linked", "schedule", "manage-limits"],
      teacher: ["learn", "attempt", "view-class", "create-class", "assign", "grade"],
      "content-reviewer": ["review-content", "propose-edit"], "school-admin": ["view-school", "manage-class", "publish-school"],
      "platform-admin": ["learn", "attempt", "view-own", "view-linked", "schedule", "manage-limits", "view-class", "create-class", "assign", "grade", "review-content", "propose-edit", "view-school", "manage-class", "publish-school", "platform-admin"]
    };
    return Boolean(permissions[role]?.includes(action));
  };

  function dailyPlan(state, curriculum, now = Date.now()) {
    const pack = curriculum.packForGrade(state.profile.grade);
    const nextLesson = pack.lessons.find((lesson) => state.progress[lesson.lessonId]?.status !== "completed") || pack.lessons[0];
    const due = state.reviews.filter((item) => new Date(item.dueAt).getTime() <= now);
    const weak = Object.entries(state.mastery).sort((a, b) => (a[1].score || 0) - (b[1].score || 0))[0];
    return { nextLesson, assignment: state.assignments.find((item) => item.status !== "completed") || null, review: due[0] || null, mistake: state.mistakes.slice().sort((a, b) => b.occurrences - a.occurrences)[0] || null, schedule: state.schedules.slice().sort((a, b) => new Date(a.at) - new Date(b.at))[0] || null, weakSkill: weak ? { id: weak[0], ...weak[1] } : null };
  }

  const api = Object.freeze({ SCHEMA_VERSION, BASE_KEY, ROLES, MASTERY_STATES, clean, safeId, ownerIdFor, roleFor, storageKey, learnerProfile, defaultState, normalizeState, createStore, gradeQuestion, nextMastery, recordAttempt, dailyPlan, can });
  root.HHSchoolCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
