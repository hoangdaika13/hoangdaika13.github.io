(function initHHSchoolCore(root) {
  "use strict";

  const SCHEMA_VERSION = 3;
  const BASE_KEY = "hh.school.v2";
  const DAY = 86_400_000;
  const ROLES = Object.freeze(["student", "parent", "teacher", "content-reviewer", "school-admin", "platform-admin"]);
  const MASTERY_STATES = Object.freeze(["not-started", "learning", "practice", "review-due", "mastered", "forgetting"]);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const safeId = (value, fallback = "default") => String(value || fallback).replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 100) || fallback;
  const clean = (value, max = 400) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  const cleanMultiline = (value, max = 12000) => String(value ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").replace(/[ \t]+\n/g, "\n").trim().slice(0, max);
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

  function localDayKey(now = Date.now()) {
    const date = new Date(now);
    if (!Number.isFinite(date.getTime())) return "";
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function localDayOrdinal(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    return match ? Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY) : NaN;
  }

  function nextActivity(previous = {}, now = Date.now()) {
    const day = localDayKey(now);
    const last = /^\d{4}-\d{2}-\d{2}$/.test(String(previous.lastActiveDay || "")) ? previous.lastActiveDay : "";
    const distance = last ? localDayOrdinal(day) - localDayOrdinal(last) : NaN;
    const streak = day === last ? clamp(previous.streak, 1, 100000) : distance === 1 ? clamp(previous.streak, 0, 99999) + 1 : 1;
    const learningDays = [...new Set([...(Array.isArray(previous.learningDays) ? previous.learningDays : []), day].filter(Boolean))].slice(-366);
    return { learningDays, streak, lastActiveDay: day, updatedAt: nowIso(now) };
  }

  function addLocalDays(now, days) {
    const date = new Date(now);
    date.setDate(date.getDate() + Number(days || 0));
    return date.getTime();
  }

  function learnerProfile(input = {}, ownerId = "guest") {
    const linkedWithoutGrade = input.accessScope === "linked" && (input.grade === null || input.grade === undefined || input.grade === "");
    const grade = linkedWithoutGrade ? null : Math.round(clamp(input.grade || 1, 1, 12));
    const profileId = safeId(input.id || "learner-1", "learner-1"); const linked = input.accessScope === "linked"; const linkId = linked ? safeId(input.linkId || input.relationship || "linked", "linked") : "";
    return {
      id: profileId, accessKey: linked ? `linked-${linkId}` : profileId, ownerId: safeId(ownerId, "guest"),
      name: clean(input.name || "Học sinh HH", 80), grade,
      managed: Boolean(input.managed), managerIds: Array.isArray(input.managerIds) ? input.managerIds.map((id) => safeId(id)).slice(0, 20) : [],
      accessScope: linked ? "linked" : "own", linkId,
      relationship: clean(input.relationship, 40),
      electiveSubjectIds: grade >= 10 ? [...new Set((input.electiveSubjectIds || []).map((id) => safeId(id)).filter(Boolean))].slice(0, 4) : [],
      specialistClusters: grade >= 10 ? [...new Set((input.specialistClusters || []).map((id) => safeId(id)).filter(Boolean))].slice(0, 3) : [],
      ageMode: grade === null ? "unknown" : grade <= 2 ? "little" : grade <= 5 ? "primary" : grade <= 9 ? "secondary" : "career"
    };
  }

  function finitePlainJSON(value) {
    const active = new Set(); let count = 0;
    const walk = (item, depth) => { if (++count > 300000 || depth > 40) return false; if (typeof item === "number" && !Number.isFinite(item) || ["function", "symbol", "bigint"].includes(typeof item)) return false; if (item && typeof item === "object") { if (active.has(item) || !Array.isArray(item) && ![Object.prototype, null].includes(Object.getPrototypeOf(item))) return false; active.add(item); for (const child of Object.values(item)) if (child !== undefined && !walk(child, depth + 1)) return false; active.delete(item); } return true; }; return walk(value, 0);
  }
  function normalizeWorkspace(input) {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    if (source.version !== undefined && source.version !== 1) throw Object.assign(new Error("Không ghi đè workspace của phiên bản mới hơn."), { code: "STATE_VERSION_UNSUPPORTED" });
    if (!finitePlainJSON(source)) throw Object.assign(new Error("Workspace cần dữ liệu JSON hữu hạn, không chứa đối tượng chạy hoặc vòng tham chiếu."), { code: "STATE_WORKSPACE_INVALID" });
    if (["notes", "examSessions"].some(key => source[key] !== undefined && (!source[key] || typeof source[key] !== "object" || Array.isArray(source[key]))) || ["bookmarks", "schedules"].some(key => source[key] !== undefined && !Array.isArray(source[key]))) throw Object.assign(new Error("Cấu trúc ghi chú hoặc phiên kiểm tra chưa hợp lệ; giữ dữ liệu gốc."), { code: "STATE_ARCHIVE_CORRUPT" });
    const notes = Object.fromEntries(Object.entries(source.notes || {}).filter(([key]) => !["__proto__", "constructor", "prototype"].includes(key)).map(([key, value]) => [safeId(key), { text: cleanMultiline(value?.text ?? value, 6000), updatedAt: clean(value?.updatedAt, 40) }]));
    return { ...source, version: 1, previewContent: source.previewContent === true, mode: ["foundation", "school", "review", "advanced", "exam"].includes(source.mode) ? source.mode : "school", track: ["all", "foundation", "standard", "advanced"].includes(source.track) ? source.track : "all", semester: ["all", "1", "2"].includes(String(source.semester)) ? String(source.semester) : "all", notes, bookmarks: [...new Set((Array.isArray(source.bookmarks) ? source.bookmarks : []).map(id => safeId(id)))], examSessions: source.examSessions && typeof source.examSessions === "object" && !Array.isArray(source.examSessions) ? source.examSessions : {}, activeExamId: source.activeExamId ? safeId(source.activeExamId) : "", schedules: Array.isArray(source.schedules) ? source.schedules : [] };
  }

  function defaultState(context = {}, now = Date.now()) {
    const ownerId = ownerIdFor(context.currentUser);
    const profile = learnerProfile(context.profile || {}, ownerId);
    return {
      schemaVersion: SCHEMA_VERSION, ownerId, learnerProfileId: profile.id,
      createdAt: nowIso(now), updatedAt: nowIso(now), revision: 0, lastSyncedAt: null, syncStatus: "local-only", syncConflict: null,
      role: roleFor(context.currentUser), profile, activeView: "today", activeSubjectId: "math", activeLessonId: `g${profile.grade || 1}-math-core-01`,
      studyWorkspace: normalizeWorkspace(), progress: {}, mastery: {}, attempts: [], reviews: [], mistakes: [], assignments: [], classes: [], familyProfiles: [profile], activity: { learningDays: [], streak: 0, lastActiveDay: "", updatedAt: null },
      schedules: [], aiSessions: [], notifications: [], submissions: [], contentDrafts: [], reviewQueue: [], auditLogs: [], preferences: {
        highContrast: false, dyslexia: false, largeText: profile.grade <= 2, reducedMotion: false, dailyMinutes: profile.grade <= 5 ? 20 : 35
      }
    };
  }

  function normalizeState(input, context = {}) {
    const fallback = defaultState(context);
    if (input?.schemaVersion !== undefined && (!Number.isInteger(input.schemaVersion) || input.schemaVersion < 1 || input.schemaVersion > SCHEMA_VERSION) || input?.studyWorkspace?.version !== undefined && input.studyWorkspace.version !== 1) throw Object.assign(new Error("Dữ liệu thuộc phiên bản HH School mới hơn; bản gốc được giữ để phục hồi."), { code: "STATE_VERSION_UNSUPPORTED" });
    if (input?.studyWorkspace) normalizeWorkspace(input.studyWorkspace);
    if (input && (["progress", "mastery"].some(key => input[key] !== undefined && (!input[key] || typeof input[key] !== "object" || Array.isArray(input[key]))) || ["attempts", "mistakes", "reviews"].some(key => input[key] !== undefined && !Array.isArray(input[key])))) throw Object.assign(new Error("Cấu trúc lịch sử học tập chưa hợp lệ; bản gốc được bảo toàn."), { code: "STATE_ARCHIVE_CORRUPT" });
    const state = input && typeof input === "object" ? clone(input) : {};
    const ownerId = ownerIdFor(context.currentUser) || fallback.ownerId;
    if (state.ownerId && safeId(state.ownerId) !== ownerId) return fallback;
    if (context.profile?.id && state.learnerProfileId && safeId(state.learnerProfileId) !== safeId(context.profile.id)) return fallback;
    const profile = learnerProfile(state.profile || fallback.profile, ownerId);
    const bounded = (value, max) => Array.isArray(value) ? value.slice(-max) : [];
    const boundedRecord = (value) => Object.fromEntries(Object.entries(value && typeof value === "object" && !Array.isArray(value) ? value : {}).filter(([key]) => !["__proto__", "constructor", "prototype"].includes(key)));
    const preferences = state.preferences && typeof state.preferences === "object" && !Array.isArray(state.preferences) ? state.preferences : {};
    const familyDailyMinutes = Object.fromEntries(Object.entries(preferences.familyDailyMinutes && typeof preferences.familyDailyMinutes === "object" ? preferences.familyDailyMinutes : {}).slice(-12).map(([id, minutes]) => [safeId(id), clamp(minutes, 10, 120)]));
    const activity = state.activity && typeof state.activity === "object" ? state.activity : {};
    const normalizedFamilyProfiles = bounded(state.familyProfiles, 12).map((item) => learnerProfile(item, ownerId));
    if (!normalizedFamilyProfiles.some((item) => item.accessKey === profile.accessKey)) normalizedFamilyProfiles.unshift(profile);
    return {
      ...fallback, ...state, schemaVersion: SCHEMA_VERSION, ownerId, learnerProfileId: profile.id, profile,
      // Quyền luôn đến từ phiên đã xác thực, không bao giờ tin role trong import/localStorage.
      role: fallback.role,
      progress: boundedRecord(state.progress),
      mastery: boundedRecord(state.mastery),
      attempts: Array.isArray(state.attempts) ? state.attempts : [], reviews: Array.isArray(state.reviews) ? state.reviews : [], mistakes: Array.isArray(state.mistakes) ? state.mistakes : [],
      assignments: bounded(state.assignments, 500),
      classes: bounded(state.classes, 100).map((item) => ({ ...item, inviteCode: undefined, inviteCodeHash: undefined })),
      familyProfiles: normalizedFamilyProfiles.slice(0, 12),
      schedules: bounded(state.schedules, 200), aiSessions: bounded(state.aiSessions, 100), notifications: bounded(state.notifications, 200), submissions: Array.isArray(state.submissions) ? state.submissions : [],
      contentDrafts: bounded(state.contentDrafts, 500), reviewQueue: bounded(state.reviewQueue, 500), auditLogs: bounded(state.auditLogs, 1000),
      studyWorkspace: normalizeWorkspace(state.studyWorkspace),
      activity: {
        learningDays: [...new Set(bounded(activity.learningDays, 366).filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(String(day))))],
        streak: clamp(activity.streak, 0, 100000), lastActiveDay: /^\d{4}-\d{2}-\d{2}$/.test(String(activity.lastActiveDay || "")) ? activity.lastActiveDay : "", updatedAt: clean(activity.updatedAt, 40) || null
      },
      preferences: {
        ...fallback.preferences,
        highContrast: Boolean(preferences.highContrast), dyslexia: Boolean(preferences.dyslexia), largeText: preferences.largeText === undefined ? fallback.preferences.largeText : Boolean(preferences.largeText),
        reducedMotion: Boolean(preferences.reducedMotion), dailyMinutes: clamp(preferences.dailyMinutes || fallback.preferences.dailyMinutes, 10, 120),
        pressureNotifications: preferences.pressureNotifications !== false, familyDailyMinutes, contentPreview: preferences.contentPreview === true, learningMode: ["foundation", "school", "review", "advanced", "exam"].includes(preferences.learningMode) ? preferences.learningMode : "school"
      }, updatedAt: clean(state.updatedAt || fallback.updatedAt, 40)
    };
  }

  function sameLearningContent(left, right) {
    const transport = new Set(["createdAt", "updatedAt", "revision", "serverRevision", "lastSyncedAt", "syncStatus", "syncConflict", "auditLogs", "storageArchive", "role", "activeView"]);
    const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => [key, stable(value[key])])) : value;
    const content = value => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !transport.has(key)));
    return JSON.stringify(stable(content(left))) === JSON.stringify(stable(content(right)));
  }

  function createStore(options = {}) {
    let storage; try { storage = options.storage || root.localStorage; } catch {}
    const archive = options.offline === undefined ? root.HHSchoolOffline : options.offline;
    let context = { currentUser: options.currentUser, profile: options.profile }, state = defaultState(context), generation = 0, protectedSave = false, ready = Promise.resolve(), writeQueue = Promise.resolve();
    let persistence = { status: "memory-only", error: "", archived: false, pending: false }, recovery = { localRaw: null, archiveRaw: null, archiveUnavailable: false };
    const listeners = new Set(), persistenceListeners = new Set();
    const emit = () => listeners.forEach(listener => listener(clone(state)));
    const report = value => { persistence = { ...persistence, ...value }; persistenceListeners.forEach(listener => listener(clone(persistence))); };
    const captureRecovery = error => { if (error?.recoveryRecord !== undefined) { if (finitePlainJSON(error.recoveryRecord)) recovery.archiveRaw = JSON.stringify(error.recoveryRecord); else recovery.archiveUnavailable = true; } };
    const guard = () => { if (persistence.status === "loading") throw Object.assign(new Error("Đang khôi phục lịch sử học; hãy chờ trước khi sửa."), { code: "STATE_LOADING" }); if (protectedSave) throw Object.assign(new Error(persistence.error || "Save được bảo toàn ở chế độ chỉ đọc."), { code: "STATE_PROTECTED" }); };
    const projection = snapshot => {
      const compact = clone(snapshot);
      compact.attempts = snapshot.attempts.slice(-100); compact.mistakes = snapshot.mistakes.slice(-100); compact.submissions = snapshot.submissions.slice(-100);
      compact.studyWorkspace = { ...snapshot.studyWorkspace, notes: {}, examSessions: {} };
      compact.storageArchive = { version: 1, required: true, revision: snapshot.revision, counts: { attempts: snapshot.attempts.length, mistakes: snapshot.mistakes.length, progress: Object.keys(snapshot.progress).length, mastery: Object.keys(snapshot.mastery).length } };
      if (JSON.stringify(compact).length > 750000) { compact.progress = Object.fromEntries(Object.entries(snapshot.progress).slice(-200)); compact.mastery = Object.fromEntries(Object.entries(snapshot.mastery).slice(-200)); compact.reviews = snapshot.reviews.slice(-100); }
      if (JSON.stringify(compact).length > 750000) {
        const minimal = defaultState({ currentUser: options.currentUser, profile: snapshot.profile });
        return { ...minimal, ownerId: snapshot.ownerId, learnerProfileId: snapshot.learnerProfileId, revision: snapshot.revision, createdAt: snapshot.createdAt, updatedAt: snapshot.updatedAt, familyProfiles: snapshot.familyProfiles, preferences: snapshot.preferences, activeView: snapshot.activeView, activeLessonId: snapshot.activeLessonId, activeSubjectId: snapshot.activeSubjectId, storageArchive: compact.storageArchive, studyWorkspace: { ...minimal.studyWorkspace, previewContent: snapshot.studyWorkspace.previewContent, mode: snapshot.studyWorkspace.mode, track: snapshot.studyWorkspace.track, semester: snapshot.studyWorkspace.semester } };
      }
      return compact;
    };
    const writeLocal = value => { if (typeof storage?.setItem !== "function") throw Error("Trình duyệt chưa cho phép lưu trên thiết bị."); storage.setItem(storageKey(value.ownerId, value.learnerProfileId), JSON.stringify(value)); };
    const read = (profileId = state.learnerProfileId) => {
      const token = ++generation, id = safeId(profileId, state.learnerProfileId || "learner-1");
      context = { ...context, profile: { ...(context.profile || state.profile || {}), id } };
      protectedSave = false; recovery = { localRaw: null, archiveRaw: null, archiveUnavailable: false }; let parsed = null, localError = null;
      try { const raw = storage?.getItem?.(storageKey(state.ownerId, id)); if (raw) { recovery.localRaw = raw; parsed = JSON.parse(raw); } if (parsed && (parsed.ownerId !== state.ownerId || parsed.learnerProfileId !== id)) throw Object.assign(new Error("Save không khớp tài khoản/hồ sơ đang mở."), { code: "STATE_OWNER_MISMATCH" }); state = normalizeState(parsed, context); }
      catch (error) { state = defaultState(context); protectedSave = true; localError = error; }
      if (localError) { ready = Promise.resolve(); report({ status: "protected", error: "Dữ liệu lưu chưa đọc được; bản gốc được giữ. " + localError.message, pending: false }); }
      else if (archive?.loadProfile) {
        report({ status: "loading", error: "", pending: true });
        ready = Promise.resolve().then(() => archive.loadProfile(state.ownerId, id)).then(row => {
          if (token !== generation) return;
          if (row?.state) { state = mergeStates(state, row.state, context); delete state.storageArchive; }
          else if (parsed?.storageArchive?.required) throw Object.assign(new Error("Chưa tìm thấy kho lịch sử đầy đủ. Bản tóm tắt được giữ; chưa cho ghi đè."), { code: "STATE_ARCHIVE_MISSING" });
          report({ status: row?.state || parsed ? "saved-device" : "memory-only", error: "", pending: false, archived: Boolean(row?.state) }); emit();
        }).catch(error => { if (token !== generation) return; captureRecovery(error); protectedSave = Boolean(parsed?.storageArchive?.required || ["STATE_VERSION_UNSUPPORTED", "STATE_ARCHIVE_CORRUPT", "STATE_OWNER_MISMATCH", "STATE_WORKSPACE_INVALID"].includes(error.code)); report({ status: protectedSave ? "protected" : parsed ? "saved-device" : "memory-only", error: error.message, pending: false, archived: false }); });
      } else { ready = Promise.resolve(); protectedSave = Boolean(parsed?.storageArchive?.required); report({ status: protectedSave ? "protected" : parsed ? "saved-device" : "memory-only", error: protectedSave ? "Lịch sử đầy đủ nằm trong IndexedDB chưa truy cập được; chưa ghi đè bản tóm tắt." : "", pending: false }); }
      return clone(state);
    };
    const persist = () => {
      guard(); state.updatedAt = nowIso(); state.revision = Math.max(0, Number(state.revision) || 0) + 1;
      const snapshot = clone(state), token = generation; delete snapshot.storageArchive; let localSaved = false, localError = "";
      try { writeLocal(snapshot); localSaved = true; } catch (error) { localError = error.message; }
      report({ status: localSaved ? "saved-device" : archive?.saveProfile ? "loading" : "error", pending: Boolean(archive?.saveProfile), error: localSaved ? "" : localError, archived: false });
      emit();
      if (archive?.saveProfile) {
        writeQueue = writeQueue.catch(() => {}).then(async () => {
          try {
            await archive.saveProfile(snapshot.ownerId, snapshot.learnerProfileId, snapshot);
            if (token !== generation || state.revision !== snapshot.revision) return;
            if (JSON.stringify(snapshot).length > 750000) try { writeLocal(projection(snapshot)); } catch (error) { localError = error.message; }
            report({ status: "saved-device", pending: false, error: "", archived: true, revision: snapshot.revision });
          } catch (error) { if (token !== generation || state.revision !== snapshot.revision) return; captureRecovery(error); protectedSave = ["STATE_VERSION_UNSUPPORTED", "STATE_ARCHIVE_CORRUPT", "STATE_OWNER_MISMATCH", "STATE_WORKSPACE_INVALID"].includes(error.code); report({ status: protectedSave ? "protected" : localSaved ? "saved-device" : "error", error: error.message, pending: false, archived: false }); }
        });
      }
      return clone(state);
    };
    const update = (mutator, event = "state:update") => { guard(); const draft = clone(state), next = mutator(draft) || draft; if (next.ownerId !== state.ownerId || next.learnerProfileId !== state.learnerProfileId || next.profile?.id !== state.profile.id) throw Object.assign(new Error("Đổi hồ sơ cần tải kho riêng, không trộn lịch sử đang học."), { code: "STATE_OWNER_MISMATCH" }); state = normalizeState(next, context); if (!event.startsWith("sync:") && event !== "backend:hydrate" && state.syncStatus !== "conflict") state.syncStatus = "local-only"; state.auditLogs.push({ id: uid("audit"), event: clean(event, 100), actorRole: state.role, learnerProfileId: state.learnerProfileId, at: nowIso() }); return persist(); };
    read();
    return Object.freeze({ get: () => clone(state), get ready() { return ready; }, getPersistence: () => clone(persistence), whenSaved: () => writeQueue.then(() => clone(persistence)), read, update, replace(next) { guard(); if (next?.ownerId !== state.ownerId || next?.learnerProfileId !== state.learnerProfileId) throw Object.assign(new Error("Không thay dữ liệu bằng hồ sơ khác."), { code: "STATE_OWNER_MISMATCH" }); state = normalizeState(next, context); state.syncStatus = "local-only"; return persist(); }, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }, subscribePersistence(listener) { persistenceListeners.add(listener); return () => persistenceListeners.delete(listener); }, getRecoveryData() { return { format: "hh-school-recovery", version: 1, ownerId: state.ownerId, learnerProfileId: state.learnerProfileId, protected: protectedSave, reason: persistence.error, ...recovery, currentSessionRaw: JSON.stringify(state) }; }, export() { if (protectedSave) throw Object.assign(new Error("Không xuất bản trạng thái mặc định thay cho save được bảo toàn. Hãy xuất dữ liệu phục hồi để giữ bản gốc."), { code: "STATE_PROTECTED" }); return JSON.stringify({ format: "hh-school", schemaVersion: SCHEMA_VERSION, exportedAt: nowIso(), data: state }, null, 2); }, import(payload) { guard(); const parsed = JSON.parse(payload); if (parsed?.format !== "hh-school") throw new Error("Sai định dạng dữ liệu HH School."); if (parsed.schemaVersion > SCHEMA_VERSION) throw Object.assign(new Error("Bản xuất thuộc phiên bản mới hơn; chưa nhập hoặc ghi đè."), { code: "STATE_VERSION_UNSUPPORTED" }); if (parsed.data?.ownerId !== state.ownerId || parsed.data?.learnerProfileId !== state.learnerProfileId) throw Object.assign(new Error("Bản nhập không thuộc tài khoản/hồ sơ này."), { code: "STATE_OWNER_MISMATCH" }); state = normalizeState(parsed.data, context); state.syncStatus = "local-only"; return persist(); } });
  }

  function gradeQuestion(question = {}, rawAnswer) {
    const type = question.type || "short", config = question.grading || {};
    const skillId = safeId(question.skillId || "general");
    const mode = config.mode || (["numeric", "number", "fraction"].includes(type) ? "numeric" : ["dictation", "spelling", "orthography"].includes(type) || config.accentSensitive ? "orthography" : "text");
    const text = value => mode === "orthography" ? (config.caseSensitive ? clean(value, 12000).normalize("NFC") : clean(value, 12000).normalize("NFC").toLocaleLowerCase("vi")) : normalizeAnswer(value);
    const pending = message => ({ correct: null, score: null, gradingStatus: "pending-review", gradingMethod: "rubric-self-review", expected: null, explanation: message || "Bài được giữ trên thiết bị để tự đối chiếu rubric; chưa có nhận xét hoặc điểm của giáo viên.", skillId, confidence: 0, received: false, rubric: clone(question.rubric || []) });
    if (["essay", "upload", "image-mark", "project", "practice-product"].includes(type) || type === "scenario" && mode !== "selection") return pending();
    let correct = false, score = 0, explanation = clean(question.explanation, 1000), gradingMethod = "deterministic-exact";
    if (mode === "numeric") {
      const parse = value => {
        const raw = typeof value === "object" && value ? String(value.value ?? "") + " " + String(value.unit ?? "") : String(value ?? "");
        const match = /^\s*([+−-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+−-]?\d+)?(?:\s*\/\s*[+−-]?(?:\d+(?:[.,]\d*)?|[.,]\d+))?)\s*(.*?)\s*$/.exec(raw);
        if (!match) return null;
        const numbers = match[1].replace(/−/g, "-").replace(/,/g, ".").split("/").map(Number);
        const number = numbers.length === 2 ? numbers[1] ? numbers[0] / numbers[1] : NaN : numbers[0];
        return Number.isFinite(number) ? { number, unit: match[2].trim().normalize("NFC") } : null;
      };
      const actual = parse(rawAnswer), expected = parse(question.answer);
      if (!expected) return pending("Đáp án số chưa có cấu hình kiểm chứng hợp lệ; chưa tự chấm hoặc tính thành thạo.");
      const unit = String(config.unit ?? question.unit ?? expected.unit), accepted = config.acceptedUnits || question.acceptedUnits || [];
      const factors = Object.assign(Object.create(null), unit ? { [unit]: 1 } : {}, Array.isArray(accepted) ? Object.fromEntries(accepted.map(name => [String(name), 1])) : accepted);
      const requireUnit = config.unitRequired ?? question.unitRequired ?? Boolean(unit);
      const factor = actual?.unit ? factors[actual.unit] : requireUnit ? undefined : 1;
      const tolerance = Number(config.tolerance ?? question.tolerance ?? 0), relative = Number(config.relativeTolerance ?? question.relativeTolerance ?? 0);
      if (!Number.isFinite(tolerance) || tolerance < 0 || !Number.isFinite(relative) || relative < 0) return pending("Sai số chưa được cấu hình hữu hạn và không âm; chưa tự chấm.");
      const expectedFactor = expected.unit ? factors[expected.unit] : 1;
      if (!Number.isFinite(expectedFactor)) return pending("Đơn vị trong đáp án chưa khớp cấu hình; chưa tự chấm.");
      const expectedNumber = expected.number * expectedFactor, difference = actual && Number.isFinite(factor) ? Math.abs(actual.number * factor - expectedNumber) : Infinity;
      correct = difference <= Math.max(tolerance, Math.abs(expectedNumber) * relative, Number.EPSILON * Math.max(1, Math.abs(expectedNumber)) * 8);
      if (!actual) explanation = "Hãy nhập một số hoặc phân số hợp lệ; mẫu số phải khác 0. " + explanation;
      else if (!Number.isFinite(factor)) explanation = (actual.unit ? "Đơn vị chưa đúng cấu hình của bài. " : "Câu này cần ghi đơn vị. ") + explanation;
      gradingMethod = "numeric-configured";
    } else if (type === "boolean") { if (!["true", "false"].includes(text(question.answer))) return pending("Câu hỏi đúng/sai chưa có đáp án hợp lệ."); correct = text(rawAnswer === true ? "true" : rawAnswer === false ? "false" : rawAnswer) === text(question.answer); }
    else if (type === "multiple") {
      const a = [...new Set(Array.isArray(rawAnswer) ? rawAnswer.map(String) : [])], e = [...new Set(Array.isArray(question.answer) ? question.answer.map(String) : String(question.answer ?? "").split(",").filter(Boolean))];
      if (!e.length) return pending("Câu hỏi chưa có tập đáp án; chưa tự chấm.");
      correct = a.length === e.length && a.every(value => e.includes(value));
      if (config.partialCredit === true || question.partialCredit === true) { score = Math.round(Math.max(0, (a.filter(value => e.includes(value)).length - a.filter(value => !e.includes(value)).length) / e.length) * 100); gradingMethod = "multiple-partial-penalized"; }
    } else if (type === "order") {
      const a = Array.isArray(rawAnswer) ? rawAnswer.map(text) : [], e = (Array.isArray(question.answer) ? question.answer : String(question.answer ?? "").split(",")).map(text);
      correct = a.length > 0 && e.every(value => clean(value)) && JSON.stringify(a) === JSON.stringify(e);
    } else if (type === "matching") {
      const pairs = value => { if (!value || typeof value !== "object" || Array.isArray(value)) return null; const rows = Object.entries(value); if (rows.some(([key]) => ["__proto__", "constructor", "prototype"].includes(key))) return null; return rows.map(([key, item]) => [key.normalize("NFC"), text(item)]).sort((a, b) => a[0].localeCompare(b[0])); };
      const expected = pairs(question.answer); if (!expected?.length) return pending("Câu ghép nối chưa có khóa đáp án hợp lệ; chưa tự chấm."); correct = JSON.stringify(pairs(rawAnswer)) === JSON.stringify(expected);
    } else if (type === "code") { if (question.expectedOutput === undefined && question.answer === undefined) return pending("Chưa cấu hình đầu ra kiểm chứng của chương trình."); correct = text(rawAnswer?.output ?? rawAnswer) === text(question.expectedOutput ?? question.answer); }
    else { const expected = [question.answer, ...(question.acceptedAnswers || [])].filter(value => value !== undefined && value !== null && clean(value)); if (!expected.length) return pending("Câu hỏi chưa có đáp án kiểm chứng; chưa tự chấm."); correct = expected.some(value => text(rawAnswer) === text(value)); }
    if (correct) score = 100;
    return { correct, score, gradingStatus: "graded", gradingMethod, expected: question.answer, explanation, skillId, confidence: 1, received: false };
  }

  function nextMastery(previous = {}, result = {}, now = Date.now()) {
    const attempts = clamp((previous.attempts || 0) + 1, 0, 1000000), correct = clamp((previous.correct || 0) + (result.correct === true ? 1 : 0), 0, attempts);
    const accuracy = attempts ? Math.round(correct / attempts * 100) : 0, helpLevel = clamp(result.helpLevel || 0, 0, 3);
    const score = clamp(Math.round((previous.score || 0) * .72 + (result.correct ? 100 : Number(result.score) || 20) * .28 - helpLevel * 8), 0, 100);
    const familyId = result.familyId ? safeId(result.familyId) : "", questionType = clean(result.questionType || "short", 40), day = localDayKey(now);
    const item = { correct: result.correct === true, responseMs: clamp(result.responseMs, 0, 600000), helpLevel, questionType, familyId, questionId: clean(result.questionId, 100), eligible: result.eligibleEvidence !== false && Boolean(familyId), at: nowIso(now), localDay: day };
    const evidence = [...(previous.evidence || []).slice(-39), item];
    const eligible = item.correct && helpLevel === 0 && item.eligible;
    const familyEvidence = { ...(previous.familyEvidence || {}) };
    if (eligible) { const prior = familyEvidence[familyId] || {}; familyEvidence[familyId] = { firstAt: prior.firstAt || item.at, lastAt: item.at, days: [...new Set([...(prior.days || []), day])], types: [...new Set([...(prior.types || []), questionType])] }; }
    const retrievalDayKeys = [...new Set([...(previous.retrievalDayKeys || previous.evidence?.filter(e => e.correct).map(e => e.localDay || localDayKey(e.at)) || []), ...(result.correct ? [day] : [])])];
    const retrievalDays = retrievalDayKeys.length, families = Object.values(familyEvidence), distinctFamilies = families.length;
    const delayedFamilies = families.filter(family => new Date(family.lastAt) - new Date(family.firstAt) >= DAY).length;
    const verifiedDays = new Set(families.flatMap(family => family.days || [])).size;
    const questionTypes = [...new Set([...(previous.questionTypes || []), questionType])], verifiedTypes = new Set(families.flatMap(family => family.types || [])).size;
    const repetitions = clamp((previous.repetitions || 0) + (result.correct ? 1 : 0), 0, 1000000);
    const mastered = score >= 80 && distinctFamilies >= 3 && delayedFamilies >= 2 && verifiedDays >= 3 && verifiedTypes >= 2;
    const state = attempts < 2 ? "learning" : mastered ? "mastered" : result.correct ? "practice" : "review-due";
    const intervalDays = result.correct ? Math.min(45, Math.max(1, Math.round((previous.intervalDays || .5) * (score >= 80 ? 2.2 : 1.4)))) : 0;
    const dueAt = nowIso(intervalDays ? addLocalDays(now, intervalDays) : now + 10 * 60 * 1000);
    const elapsedDays = previous.lastAttemptAt ? Math.max(0, (now - new Date(previous.lastAttemptAt).getTime()) / DAY) : 0;
    const forgettingRisk = result.correct ? 0 : clamp(Math.round(elapsedDays / Math.max(1, previous.intervalDays || 1) * 100), 0, 100);
    const provisionalCertainty = clamp(Math.round(Math.min(1, attempts / 6) * accuracy), 0, 100);
    const certainty = clamp(Math.round(Math.min(1, distinctFamilies / 3) * Math.min(1, verifiedDays / 3) * Math.min(1, delayedFamilies / 2) * accuracy), 0, 100);
    return { attempts, correct, accuracy, score, state, repetitions, retrievalDays, retrievalDayKeys, distinctFamilies, delayedFamilies, familyEvidence, intervalDays, lastAttemptAt: nowIso(now), dueAt, forgettingRisk, certainty, provisionalCertainty, evidenceScope: distinctFamilies ? "reviewed-content" : "practice-only", questionTypes, averageResponseMs: Math.round(((previous.averageResponseMs || 0) * (attempts - 1) + clamp(result.responseMs, 0, 600000)) / attempts), helpUses: (previous.helpUses || 0) + (helpLevel ? 1 : 0), evidence };
  }

  function recordLessonStep(state, lessonId, detail = {}, now = Date.now()) {
    const next = clone(state), id = safeId(lessonId), prior = next.progress[id] || {};
    const kind = detail.kind === "activity" ? "activity" : "viewed";
    const viewedSteps = [...new Set([...(prior.viewedSteps || []), clean(detail.step ?? "lesson", 100)])];
    const activitySteps = [...new Set([...(prior.activitySteps || []), ...(kind === "activity" ? [clean(detail.step ?? "activity", 100)] : [])])];
    next.progress[id] = { ...prior, status: prior.checkedAt ? prior.status : activitySteps.length ? "activity" : "viewed", viewedSteps, activitySteps, step: Math.max(0, Number(detail.step) || 0), viewedAt: prior.viewedAt || nowIso(now), updatedAt: nowIso(now), navigationComplete: detail.completed === true || prior.navigationComplete === true };
    next.activity = nextActivity(next.activity, now);
    return next;
  }

  function lessonEvidence(state, lessonId) {
    const progress = state.progress?.[lessonId] || {}, attempts = (state.attempts || []).filter(attempt => attempt.lessonId === lessonId), graded = attempts.filter(attempt => attempt.gradingStatus === "graded"), pending = attempts.filter(attempt => attempt.gradingStatus === "pending-review");
    const skills = [...new Set(graded.map(attempt => attempt.skillId))], mastered = skills.length > 0 && skills.every(id => state.mastery?.[id]?.state === "mastered");
    const status = mastered ? "mastered" : graded.length ? "checked" : progress.activitySteps?.length ? "activity" : progress.viewedAt || progress.status ? "viewed" : "not-started";
    return { status, viewed: status !== "not-started", activity: Boolean(progress.activitySteps?.length || attempts.length), checked: graded.length > 0, mastered, gradedAttempts: graded.length, pendingReview: pending.length, distinctFamilies: new Set(graded.map(a => a.familyId || a.questionId)).size, source: "local-learning-evidence" };
  }

  function recordAttempt(state, payload, now = Date.now()) {
    const next = clone(state);
    const result = gradeQuestion(payload.question, payload.answer);
    const skillId = result.skillId;
    const attemptId = uid("attempt");
    const evidence = result.gradingStatus === "graded" ? nextMastery(next.mastery[skillId], { ...result, responseMs: payload.responseMs, helpLevel: payload.helpLevel, questionType: payload.question?.type, familyId: payload.question?.familyId || payload.question?.questionFamilyId || payload.question?.id, questionId: payload.question?.id, eligibleEvidence: ["approved", "published", "reviewed"].includes(payload.question?.contentStatus) }, now) : (next.mastery[skillId] || { state: "learning", attempts: 0, score: 0, certainty: 0 });
    next.mastery[skillId] = evidence;
    const answerText = Array.isArray(payload.answer) ? payload.answer.join(",") : typeof payload.answer === "object" ? JSON.stringify(payload.answer) : payload.answer;
    const expectedText = Array.isArray(payload.question?.answer) ? payload.question.answer.join(",") : typeof payload.question?.answer === "object" ? JSON.stringify(payload.question.answer) : payload.question?.answer;
    next.attempts.push({ id: attemptId, attemptId, ownerId: next.ownerId, learnerProfileId: next.learnerProfileId, gradeId: safeId(payload.question?.gradeId || next.profile?.grade, `grade-${next.profile?.grade || 1}`), subjectId: safeId(payload.question?.subjectId || "general"), lessonId: safeId(payload.lessonId), questionId: safeId(payload.question?.id), familyId: safeId(payload.question?.familyId || payload.question?.questionFamilyId || payload.question?.id), skillId, questionType: clean(payload.question?.type || "short", 40), cognitiveLevel: clean(payload.question?.cognitiveLevel, 40), difficulty: clamp(payload.question?.difficulty, 1, 5), answer: cleanMultiline(answerText, 12000), expectedAnswer: result.gradingStatus === "pending-review" ? "" : cleanMultiline(expectedText, 4000), explanation: clean(payload.question?.explanation, 1000), distractorRationale: payload.question?.distractorRationale && typeof payload.question.distractorRationale === "object" ? clone(payload.question.distractorRationale) : clean(payload.question?.distractorRationale, 1000), correct: result.correct, score: result.score, gradingStatus: result.gradingStatus, gradingMethod: result.gradingMethod, received: false, responseMs: clamp(payload.responseMs, 0, 600000), helpLevel: clamp(payload.helpLevel, 0, 3), source: payload.question?.source || payload.source || "in-app", contentStatus: clean(payload.question?.contentStatus || "machine_generated", 40), createdAt: nowIso(now), updatedAt: nowIso(now), schemaVersion: SCHEMA_VERSION });
    if (result.gradingStatus === "pending-review") next.submissions.push({ id: uid("submission"), attemptId, lessonId: safeId(payload.lessonId), questionId: safeId(payload.question?.id), status: "self-review", received: false, rubric: payload.question?.rubric || [], createdAt: nowIso(now) });
    if (result.gradingStatus === "graded") next.reviews = next.reviews.filter((item) => item.skillId !== skillId).concat({ id: `review-${skillId}`, skillId, lessonId: safeId(payload.lessonId), dueAt: evidence.dueAt, state: evidence.state, reason: result.correct ? "Ôn cách quãng để giữ trí nhớ" : "Câu trả lời chưa đạt; cần luyện biến thể khác", lastQuestionId: safeId(payload.question?.id) });
    if (result.correct === false) {
      const existing = next.mistakes.find((item) => item.questionId === payload.question?.id);
      if (existing) { existing.occurrences += 1; existing.lastAt = nowIso(now); existing.userAnswer = cleanMultiline(answerText, 1200); }
      else next.mistakes.push({ id: uid("mistake"), questionId: safeId(payload.question?.id), lessonId: safeId(payload.lessonId), skillId, prompt: clean(payload.question?.prompt, 600), expected: cleanMultiline(expectedText, 1200), userAnswer: cleanMultiline(answerText, 1200), explanation: result.explanation, occurrences: 1, lastAt: nowIso(now) });
    }
    const lessonId = safeId(payload.lessonId), priorProgress = next.progress[lessonId] || {};
    next.progress[lessonId] = { ...priorProgress, status: result.gradingStatus === "graded" ? "checked" : "activity", viewedAt: priorProgress.viewedAt || nowIso(now), activityAt: nowIso(now), ...(result.gradingStatus === "graded" ? { checkedAt: nowIso(now) } : {}), updatedAt: nowIso(now) };
    next.activity = nextActivity(next.activity, now);
    return { state: normalizeState(next, { currentUser: { id: next.ownerId, roles: [next.role] } }), result: { ...result, attemptId }, mastery: evidence };
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
    const pack = curriculum.packForGrade(state.profile.grade, { preview: state.studyWorkspace?.previewContent === true });
    const nextLesson = pack.lessons.find((lesson) => state.progress[lesson.lessonId]?.status !== "completed" && !state.progress[lesson.lessonId]?.navigationComplete) || pack.lessons[0] || null;
    const due = state.reviews.filter((item) => new Date(item.dueAt).getTime() <= now);
    const weak = Object.entries(state.mastery).sort((a, b) => (a[1].score || 0) - (b[1].score || 0))[0];
    const schedule = state.schedules.filter((item) => item.status !== "completed" && Number.isFinite(new Date(item.at).getTime()) && new Date(item.at).getTime() >= now).sort((a, b) => new Date(a.at) - new Date(b.at))[0] || null;
    return { nextLesson, nextReason: weak ? `Bài này củng cố kỹ năng ${weak[0]} đang có ít bằng chứng nhất.` : "Bài tiếp theo trong lộ trình lớp hiện tại.", assignment: state.assignments.find((item) => item.status !== "completed") || null, review: due[0] || null, mistake: state.mistakes.slice().sort((a, b) => b.occurrences - a.occurrences)[0] || null, schedule, weakSkill: weak ? { id: weak[0], ...weak[1] } : null };
  }

  function mergeStates(localInput, serverInput, context = {}) {
    if (localInput?.ownerId && serverInput?.ownerId && safeId(localInput.ownerId) !== safeId(serverInput.ownerId)) throw new Error("Không thể hợp nhất tiến độ của hai hồ sơ khác nhau.");
    if (localInput?.learnerProfileId && serverInput?.learnerProfileId && safeId(localInput.learnerProfileId) !== safeId(serverInput.learnerProfileId)) throw new Error("Không thể hợp nhất tiến độ của hai hồ sơ khác nhau.");
    const local = normalizeState(localInput, context); const server = normalizeState(serverInput, context);
    if (local.ownerId !== server.ownerId || local.learnerProfileId !== server.learnerProfileId) throw new Error("Không thể hợp nhất tiến độ của hai hồ sơ khác nhau.");
    const unique = (left, right, key = "id") => [...new Map([...left, ...right].map((item) => [item?.[key] || JSON.stringify(item), item])).values()];
    const newerProgress = { ...server.progress, ...local.progress };
    for (const lessonId of new Set([...Object.keys(server.progress || {}), ...Object.keys(local.progress || {})])) {
      const a = local.progress?.[lessonId]; const b = server.progress?.[lessonId]; if (a && b) newerProgress[lessonId] = new Date(a.updatedAt || 0) >= new Date(b.updatedAt || 0) ? a : b;
    }
    const mastery = { ...server.mastery };
    for (const [skillId, evidence] of Object.entries(local.mastery || {})) if (!mastery[skillId] || new Date(evidence.lastAttemptAt || 0) >= new Date(mastery[skillId].lastAttemptAt || 0)) mastery[skillId] = evidence;
    const stamp = value => { const date = typeof value === "number" ? value : new Date(value || 0).getTime(); return Number.isFinite(date) ? date : 0; };
    const localNewer = local.storageArchive?.required ? false : server.storageArchive?.required ? true : stamp(local.updatedAt) >= stamp(server.updatedAt), primary = localNewer ? local : server, secondary = localNewer ? server : local;
    const timedMap = (left, right, exam = false) => { const result = { ...left }; for (const [id, value] of Object.entries(right || {})) { const prior = result[id]; if (!prior) { result[id] = value; continue; } if (exam && (prior.status === "submitted" || value.status === "submitted")) { result[id] = prior.status === "submitted" ? value.status === "submitted" && stamp(value.submittedAt) < stamp(prior.submittedAt) ? value : prior : value; continue; } const a = stamp(value.updatedAt || value.lastClockAt), b = stamp(prior.updatedAt || prior.lastClockAt); if (a >= b) result[id] = value; } return result; };
    const mergedSubmissions = new Map();
    for (const item of [...server.submissions, ...local.submissions]) {
      const key = item?.assignmentId ? JSON.stringify([String(item.assignmentId), String(item.learnerOwnerId || local.ownerId), String(item.learnerProfileId || local.learnerProfileId)]) : item?.id || item?.attemptId || JSON.stringify(item);
      const prior = mergedSubmissions.get(key);
      if (!prior) { mergedSubmissions.set(key, item); continue; }
      if (!item?.assignmentId) { if (stamp(item?.updatedAt || item?.createdAt) >= stamp(prior?.updatedAt || prior?.createdAt)) mergedSubmissions.set(key, item); continue; }
      const a = stamp(item.updatedAt || item.submittedAt), b = stamp(prior.updatedAt || prior.submittedAt), aRevision = Number(item.answerRevision) || 0, bRevision = Number(prior.answerRevision) || 0;
      const sameTime = a === b, aGrade = Number(item.gradingRevision) || 0, bGrade = Number(prior.gradingRevision) || 0;
      const tiePreference = aRevision !== bRevision ? aRevision > bRevision : item.status === "draft-device" || prior.status !== "draft-device" && aGrade >= bGrade;
      const prefer = a > b || sameTime && tiePreference;
      if (prefer) mergedSubmissions.set(key, item);
    }
    const studyWorkspace = { ...secondary.studyWorkspace, ...primary.studyWorkspace, notes: timedMap(server.studyWorkspace.notes, local.studyWorkspace.notes), examSessions: timedMap(server.studyWorkspace.examSessions, local.studyWorkspace.examSessions, true) };
    return normalizeState({ ...secondary, ...primary, profile: primary.profile, studyWorkspace, progress: newerProgress, mastery, attempts: unique(server.attempts, local.attempts), reviews: unique(server.reviews, local.reviews, "skillId"), mistakes: unique(server.mistakes, local.mistakes, "questionId"), assignments: unique(server.assignments, local.assignments), submissions: [...mergedSubmissions.values()], schedules: unique(server.schedules, local.schedules), syncConflict: null, serverRevision: Math.max(Number(local.serverRevision || 0), Number(server.serverRevision || 0)), updatedAt: nowIso() }, context);
  }

  const api = Object.freeze({ SCHEMA_VERSION, BASE_KEY, ROLES, MASTERY_STATES, clean, cleanMultiline, safeId, ownerIdFor, roleFor, storageKey, learnerProfile, localDayKey, nextActivity, defaultState, normalizeState, normalizeWorkspace, sameLearningContent, createStore, gradeQuestion, nextMastery, recordAttempt, recordLessonStep, lessonEvidence, dailyPlan, mergeStates, can });
  root.HHSchoolCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
