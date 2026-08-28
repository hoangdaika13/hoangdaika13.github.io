(function initHHLanguageLearningCore(root) {
  "use strict";

  const VERSION = 1;
  const SCHEMA_VERSION = 2;
  const STORAGE_PREFIX = "hh.language.learning.v1";
  const DATABASE_NAME = "hh-language-learning-v1";
  const DATABASE_STORE = "content";
  const LANGUAGES = new Set(["english", "japanese", "chinese"]);
  const REVIEW_RATINGS = new Set(["again", "hard", "good", "easy"]);
  const EVIDENCE_KINDS = new Set(["lesson", "quiz", "review", "listen", "speak", "read", "write", "conversation"]);
  const memoryProfiles = new Map();
  const memoryLargeStore = new Map();

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const safeId = (value, fallback = "default") => {
    const normalized = String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9._:-]/g, "-").slice(0, 96);
    if (["__proto__", "prototype", "constructor"].includes(normalized)) return `id-${normalized.replace(/_/g, "-")}`;
    return normalized || fallback;
  };
  const languageId = (value) => {
    const normalized = safeId(value, "");
    if (!LANGUAGES.has(normalized)) throw new TypeError("Unsupported language centre");
    return normalized;
  };
  const localDay = (input = new Date()) => {
    const date = input instanceof Date ? input : new Date(input);
    if (!Number.isFinite(date.getTime())) throw new TypeError("Invalid local date");
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const localDateFromDay = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
    return Number.isFinite(date.getTime()) ? date : null;
  };
  const dayDistance = (from, to) => {
    const first = localDateFromDay(from);
    const second = localDateFromDay(to);
    if (!first || !second) return Number.POSITIVE_INFINITY;
    return Math.round((second.getTime() - first.getTime()) / 86400000);
  };
  const addLocalDays = (day, amount) => {
    const date = localDateFromDay(day) || new Date();
    date.setDate(date.getDate() + Math.max(0, Math.round(Number(amount) || 0)));
    return localDay(date);
  };
  const storageKey = (language, learnerId) => `${STORAGE_PREFIX}:${languageId(language)}:${safeId(learnerId)}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const boundedText = (value, limit) => String(value || "").trim().slice(0, limit);

  const emptyProfile = (language, learnerId) => ({
    schemaVersion: SCHEMA_VERSION,
    language: languageId(language),
    learnerId: safeId(learnerId),
    level: "starter",
    goal: "balanced",
    xp: 0,
    streak: 0,
    lastActiveDay: "",
    evidence: [],
    completedActivities: {},
    reviews: {},
    skills: {},
    history: [],
    checkpoints: [],
    updatedAt: ""
  });

  const normalizeSkill = (value) => ({
    attempts: Math.round(clamp(value?.attempts, 0, 100000)),
    correct: Math.round(clamp(value?.correct, 0, 100000)),
    lastScore: clamp(value?.lastScore, 0, 1),
    updatedAt: boundedText(value?.updatedAt, 40)
  });

  const migrateProfileSource = (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const source = { ...raw };
    const sourceVersion = Math.max(0, Math.round(Number(source.schemaVersion) || 0));
    if (sourceVersion < 1 && !source.completedActivities) {
      const legacyCompleted = Array.isArray(source.completed)
        ? source.completed
        : Object.entries(source.completed || source.completedLessons || {}).filter(([, value]) => Boolean(value)).map(([key]) => key);
      source.completedActivities = Object.fromEntries(legacyCompleted.slice(0, 3000).map((activityId) => [safeId(activityId, "activity"), {
        day: /^\d{4}-\d{2}-\d{2}$/.test(source.lastActiveDay) ? source.lastActiveDay : "",
        score: 1,
        evidenceId: `migration-${safeId(activityId, "activity")}`
      }]));
    }
    if (sourceVersion < 2 && !source.reviews && Array.isArray(source.reviewQueue)) {
      source.reviews = Object.fromEntries(source.reviewQueue.slice(0, 5000).map((item) => [safeId(item?.cardId || item?.id, "card"), {
        repetitions: item?.repetitions ?? item?.reps,
        interval: item?.interval,
        ease: item?.ease,
        due: item?.due,
        lastRating: item?.lastRating || item?.rating
      }]));
    }
    source.schemaVersion = SCHEMA_VERSION;
    return source;
  };

  const normalizeProfile = (raw, language, learnerId) => {
    const base = emptyProfile(language, learnerId);
    const source = migrateProfileSource(raw);
    const evidence = Array.isArray(source.evidence) ? source.evidence.slice(-1200).map((item) => ({
      id: safeId(item?.id, "evidence"),
      activityId: safeId(item?.activityId, "activity"),
      kind: EVIDENCE_KINDS.has(item?.kind) ? item.kind : "lesson",
      skill: safeId(item?.skill, "general"),
      score: clamp(item?.score, 0, 1),
      xp: Math.round(clamp(item?.xp, 0, 500)),
      day: /^\d{4}-\d{2}-\d{2}$/.test(item?.day) ? item.day : "",
      createdAt: boundedText(item?.createdAt, 40)
    })) : [];
    const completedActivities = {};
    Object.entries(source.completedActivities || {}).slice(0, 3000).forEach(([key, value]) => {
      if (value && typeof value === "object") completedActivities[safeId(key)] = {
        day: /^\d{4}-\d{2}-\d{2}$/.test(value.day) ? value.day : "",
        score: clamp(value.score, 0, 1),
        evidenceId: safeId(value.evidenceId, "evidence")
      };
    });
    const reviews = {};
    Object.entries(source.reviews || {}).slice(0, 5000).forEach(([key, value]) => {
      reviews[safeId(key)] = {
        repetitions: Math.round(clamp(value?.repetitions, 0, 10000)),
        interval: Math.round(clamp(value?.interval, 0, 3650)),
        ease: clamp(value?.ease || 2.5, 1.3, 3.2),
        due: /^\d{4}-\d{2}-\d{2}$/.test(value?.due) ? value.due : localDay(),
        lastRating: REVIEW_RATINGS.has(value?.lastRating) ? value.lastRating : "again"
      };
    });
    const skills = {};
    Object.entries(source.skills || {}).slice(0, 100).forEach(([key, value]) => { skills[safeId(key)] = normalizeSkill(value); });
    const checkpoints = Array.isArray(source.checkpoints) ? source.checkpoints.slice(-3).map((item) => ({
      id: safeId(item?.id, "checkpoint"),
      createdAt: boundedText(item?.createdAt, 40),
      snapshot: item?.snapshot && typeof item.snapshot === "object" ? item.snapshot : null
    })).filter((item) => item.snapshot) : [];
    return {
      ...base,
      level: boundedText(source.level || base.level, 32),
      goal: boundedText(source.goal || base.goal, 48),
      xp: Math.round(clamp(source.xp, 0, 100000000)),
      streak: Math.round(clamp(source.streak, 0, 100000)),
      lastActiveDay: /^\d{4}-\d{2}-\d{2}$/.test(source.lastActiveDay) ? source.lastActiveDay : "",
      evidence,
      completedActivities,
      reviews,
      skills,
      history: Array.isArray(source.history) ? source.history.slice(-600).map((item) => ({
        type: boundedText(item?.type, 32),
        activityId: safeId(item?.activityId, "activity"),
        day: /^\d{4}-\d{2}-\d{2}$/.test(item?.day) ? item.day : "",
        score: clamp(item?.score, 0, 1)
      })) : [],
      checkpoints,
      updatedAt: boundedText(source.updatedAt, 40)
    };
  };

  const migrateProfile = (raw, language, learnerId = "default") => normalizeProfile(raw, language, learnerId);

  const persistProfile = (profile) => {
    const key = storageKey(profile.language, profile.learnerId);
    const normalized = normalizeProfile(profile, profile.language, profile.learnerId);
    normalized.updatedAt = new Date().toISOString();
    memoryProfiles.set(key, normalized);
    try { root.localStorage?.setItem?.(key, JSON.stringify(normalized)); } catch (_) { /* Memory fallback keeps the current learning session usable. */ }
    root.dispatchEvent?.(new CustomEvent("hh:language-progress", { detail: { language: normalized.language, learnerId: normalized.learnerId } }));
    return clone(normalized);
  };

  const readProfile = (language, learnerId = "default") => {
    const key = storageKey(language, learnerId);
    let stored = memoryProfiles.get(key);
    if (!stored) {
      try { stored = JSON.parse(root.localStorage?.getItem?.(key) || "null"); } catch (_) { stored = null; }
    }
    const normalized = normalizeProfile(stored, language, learnerId);
    memoryProfiles.set(key, normalized);
    return clone(normalized);
  };

  const updateStreak = (profile, day) => {
    if (profile.lastActiveDay === day) return;
    profile.streak = dayDistance(profile.lastActiveDay, day) === 1 ? profile.streak + 1 : 1;
    profile.lastActiveDay = day;
  };

  const recordEvidence = (language, learnerId = "default", input = {}) => {
    const profile = readProfile(language, learnerId);
    const kind = String(input.kind || "").toLowerCase();
    const activityId = safeId(input.activityId, "");
    const evidenceId = safeId(input.evidenceId || input.attemptId, "");
    if (!activityId || !evidenceId || !EVIDENCE_KINDS.has(kind)) throw new TypeError("Valid activity, evidence and interaction kind are required");
    if (profile.evidence.some((item) => item.id === evidenceId)) return { duplicate: true, completed: Boolean(profile.completedActivities[activityId]), profile };

    const score = clamp(input.score, 0, 1);
    const minimumScore = clamp(input.minimumScore ?? 0.6, 0.2, 1);
    const interactions = Math.round(clamp(input.interactions, 0, 10000));
    const durationSeconds = clamp(input.durationSeconds, 0, 86400);
    const eligible = input.completed === true && interactions > 0 && durationSeconds >= 3 && score >= minimumScore;
    const day = localDay(input.occurredAt ? new Date(input.occurredAt) : new Date());
    const xp = eligible ? Math.round(clamp(input.xp ?? 10, 0, 500)) : 0;
    const skill = safeId(input.skill, "general");
    const createdAt = new Date().toISOString();
    profile.evidence.push({ id: evidenceId, activityId, kind, skill, score, xp, day, createdAt });
    profile.evidence = profile.evidence.slice(-1200);
    const skillState = normalizeSkill(profile.skills[skill]);
    skillState.attempts += 1;
    skillState.correct += score >= minimumScore ? 1 : 0;
    skillState.lastScore = score;
    skillState.updatedAt = createdAt;
    profile.skills[skill] = skillState;
    profile.history.push({ type: eligible ? "completed" : "attempted", activityId, day, score });
    profile.history = profile.history.slice(-600);
    if (eligible && !profile.completedActivities[activityId]) {
      profile.completedActivities[activityId] = { day, score, evidenceId };
      profile.xp += xp;
      updateStreak(profile, day);
    }
    return { duplicate: false, completed: eligible, profile: persistProfile(profile) };
  };

  const reviewCard = (language, learnerId = "default", cardId, rating, at = new Date()) => {
    const normalizedRating = String(rating || "").toLowerCase();
    if (!REVIEW_RATINGS.has(normalizedRating)) throw new TypeError("Invalid review rating");
    const id = safeId(cardId, "");
    if (!id) throw new TypeError("A card id is required");
    const profile = readProfile(language, learnerId);
    const previous = profile.reviews[id] || { repetitions: 0, interval: 0, ease: 2.5, due: localDay(at), lastRating: "again" };
    let repetitions = previous.repetitions;
    let interval = previous.interval;
    let ease = previous.ease;
    if (normalizedRating === "again") { repetitions = 0; interval = 0; ease = Math.max(1.3, ease - .2); }
    if (normalizedRating === "hard") { repetitions += 1; interval = Math.max(1, Math.round(Math.max(1, interval) * 1.2)); ease = Math.max(1.3, ease - .12); }
    if (normalizedRating === "good") { repetitions += 1; interval = repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.max(4, Math.round(interval * ease)); }
    if (normalizedRating === "easy") { repetitions += 1; ease = Math.min(3.2, ease + .1); interval = repetitions === 1 ? 3 : Math.max(6, Math.round(Math.max(1, interval) * ease * 1.3)); }
    profile.reviews[id] = { repetitions, interval, ease, due: addLocalDays(localDay(at), interval), lastRating: normalizedRating };
    return persistProfile(profile).reviews[id];
  };

  const dueCards = (language, learnerId = "default", at = new Date()) => {
    const day = localDay(at);
    const profile = readProfile(language, learnerId);
    return Object.entries(profile.reviews).filter(([, review]) => review.due <= day).map(([cardId, review]) => ({ cardId, ...review })).sort((a, b) => a.due.localeCompare(b.due));
  };

  const createCheckpoint = (language, learnerId = "default") => {
    const profile = readProfile(language, learnerId);
    const snapshot = clone({ ...profile, checkpoints: [] });
    const checkpoint = { id: safeId(`cp-${Date.now()}`), createdAt: new Date().toISOString(), snapshot };
    profile.checkpoints = [...profile.checkpoints, checkpoint].slice(-3);
    persistProfile(profile);
    return clone(checkpoint);
  };

  const restoreCheckpoint = (language, learnerId = "default", checkpointId) => {
    const profile = readProfile(language, learnerId);
    const checkpoint = profile.checkpoints.find((item) => item.id === safeId(checkpointId, ""));
    if (!checkpoint) throw new TypeError("Checkpoint not found");
    const restored = normalizeProfile(checkpoint.snapshot, language, learnerId);
    restored.checkpoints = profile.checkpoints;
    return persistProfile(restored);
  };

  const exportProfile = (language, learnerId = "default") => ({
    kind: "hh-language-learning-profile",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profile: readProfile(language, learnerId)
  });

  const importProfile = (language, learnerId = "default", payload) => {
    let parsed = payload;
    if (typeof payload === "string") {
      if (payload.length > 4000000) throw new RangeError("Profile import is too large");
      parsed = JSON.parse(payload);
    } else if (JSON.stringify(payload).length > 4000000) {
      throw new RangeError("Profile import is too large");
    }
    if (!parsed || parsed.kind !== "hh-language-learning-profile" || Number(parsed.schemaVersion) > SCHEMA_VERSION) throw new TypeError("Unsupported learning profile");
    if (parsed.profile?.language !== languageId(language) || safeId(parsed.profile?.learnerId) !== safeId(learnerId)) throw new TypeError("Profile scope does not match");
    return persistProfile(normalizeProfile(parsed.profile, language, learnerId));
  };

  const clearProfile = (language, learnerId = "default") => {
    const key = storageKey(language, learnerId);
    memoryProfiles.delete(key);
    try { root.localStorage?.removeItem?.(key); } catch (_) { /* No-op for unavailable storage. */ }
  };

  const containsSensitiveKey = (value, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 5) return false;
    return Object.entries(value).some(([key, child]) => /(?:password|passphrase|secret|token|api.?key|credential)/i.test(key) || containsSensitiveKey(child, depth + 1));
  };

  const openDatabase = () => new Promise((resolve) => {
    if (!root.indexedDB?.open) return resolve(null);
    const request = root.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(DATABASE_STORE)) request.result.createObjectStore(DATABASE_STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  const largeKey = (language, learnerId, namespace, key) => `${languageId(language)}:${safeId(learnerId)}:${safeId(namespace)}:${safeId(key)}`;
  const putLarge = async (language, learnerId = "default", namespace, key, value) => {
    if (containsSensitiveKey(value)) throw new TypeError("Sensitive fields are not allowed in learning content storage");
    const serialized = JSON.stringify(value);
    if (serialized.length > 8 * 1024 * 1024) throw new RangeError("Learning content item is too large");
    const id = largeKey(language, learnerId, namespace, key);
    memoryLargeStore.set(id, clone(value));
    const database = await openDatabase();
    if (!database) return { persisted: false, fallback: "memory" };
    return new Promise((resolve) => {
      const transaction = database.transaction(DATABASE_STORE, "readwrite");
      transaction.objectStore(DATABASE_STORE).put(value, id);
      transaction.oncomplete = () => { database.close(); resolve({ persisted: true, fallback: null }); };
      transaction.onerror = () => { database.close(); resolve({ persisted: false, fallback: "memory" }); };
      transaction.onabort = transaction.onerror;
    });
  };

  const getLarge = async (language, learnerId = "default", namespace, key) => {
    const id = largeKey(language, learnerId, namespace, key);
    const database = await openDatabase();
    if (!database) return clone(memoryLargeStore.get(id) ?? null);
    return new Promise((resolve) => {
      const transaction = database.transaction(DATABASE_STORE, "readonly");
      const request = transaction.objectStore(DATABASE_STORE).get(id);
      request.onsuccess = () => { database.close(); resolve(clone(request.result ?? memoryLargeStore.get(id) ?? null)); };
      request.onerror = () => { database.close(); resolve(clone(memoryLargeStore.get(id) ?? null)); };
    });
  };

  const deleteLarge = async (language, learnerId = "default", namespace, key) => {
    const id = largeKey(language, learnerId, namespace, key);
    memoryLargeStore.delete(id);
    const database = await openDatabase();
    if (!database) return false;
    return new Promise((resolve) => {
      const transaction = database.transaction(DATABASE_STORE, "readwrite");
      transaction.objectStore(DATABASE_STORE).delete(id);
      transaction.oncomplete = () => { database.close(); resolve(true); };
      transaction.onerror = () => { database.close(); resolve(false); };
      transaction.onabort = transaction.onerror;
    });
  };

  const api = Object.freeze({
    VERSION,
    SCHEMA_VERSION,
    LANGUAGES: Object.freeze([...LANGUAGES]),
    localDay,
    dayDistance,
    readProfile,
    recordEvidence,
    reviewCard,
    dueCards,
    migrateProfile,
    createCheckpoint,
    restoreCheckpoint,
    exportProfile,
    importProfile,
    clearProfile,
    putLarge,
    getLarge,
    deleteLarge
  });

  root.HHLanguageLearningCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
