(function (scope, factory) {
  "use strict";
  const api = factory();
  scope.HHSchoolAssessments = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // An authored local learning assessment, not a secure/proctored examination.
  // Only view()/review() are presentation contracts. The serializable snapshot
  // necessarily contains its local marking key; a browser cannot hide that key.
  const VERSION = 1;
  const MAX_QUESTIONS = 80;
  const MAX_SESSION_CHARS = 2000000;
  const unsafe = new Set(["__proto__", "prototype", "constructor"]);
  let serial = 0;
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const copy = value => JSON.parse(JSON.stringify(value));
  const fail = (message, code = "ASSESSMENT_INVALID") => { throw Object.assign(new Error(message), { code }); };
  const id = value => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(value) && !unsafe.has(value);
  const version = value => Number.isInteger(value) && value > 0 || typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(value);
  const time = value => Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;

  function json(value) {
    const stack = [[value, 0]], seen = new Set();
    let nodes = 0;
    while (stack.length) {
      const [entry, depth] = stack.pop();
      if (depth === -1) { seen.delete(entry); continue; }
      if (++nodes > 80000 || depth > 24) return false;
      if (entry === null || typeof entry === "boolean") continue;
      if (typeof entry === "number") { if (!Number.isFinite(entry)) return false; continue; }
      if (typeof entry === "string") { if (entry.length > 20000) return false; continue; }
      if (typeof entry !== "object" || seen.has(entry)) return false;
      const prototype = Object.getPrototypeOf(entry);
      if (!Array.isArray(entry) && prototype !== Object.prototype && prototype !== null) return false;
      seen.add(entry);
      stack.push([entry, -1]);
      const keys = Object.keys(entry);
      if (keys.length > 2000 || keys.some(key => unsafe.has(key))) return false;
      for (const key of keys) stack.push([entry[key], depth + 1]);
    }
    return true;
  }

  function freeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }

  function stable(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
    return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stable(value[key])).join(",") + "}";
  }

  function hash(value) {
    let h = 2166136261;
    for (const char of String(value)) { h ^= char.codePointAt(0); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  function random(seed) {
    let state = parseInt(hash(seed), 36) || 1;
    return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  }

  function shuffled(values, next) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  }

  function outcomes(question) {
    return [...new Set([...(Array.isArray(question.outcomeIds) ? question.outcomeIds : []), question.outcomeId || question.skillId].filter(Boolean))];
  }

  function normalizeBlueprint(input) {
    if (!json(input) || !record(input) || !id(input.id) || !id(input.gradeId) || !id(input.subjectId)) fail("Ma trận cần ID, lớp và môn hợp lệ.");
    if (!version(input.contentVersion)) fail("Ma trận cần phiên bản nội dung ổn định.");
    if (typeof input.title !== "string" || !input.title.trim() || input.title.length > 240) fail("Ma trận cần tên bài kiểm tra.");
    if (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 240) fail("Thời lượng bài kiểm tra phải từ 1 đến 240 phút.");
    if (!Array.isArray(input.sections) || !input.sections.length || input.sections.length > 40) fail("Ma trận cần các phần kiểm tra thực sự.");
    const names = new Set();
    for (const section of input.sections) {
      if (!record(section) || !id(section.id) || names.has(section.id) || !Number.isInteger(section.count) || section.count < 1 || section.count > MAX_QUESTIONS) fail("Phần kiểm tra trùng ID hoặc sai số câu.");
      names.add(section.id);
      for (const key of ["outcomeIds", "cognitiveLevels", "questionTypes"]) if (section[key] !== undefined && (!Array.isArray(section[key]) || !section[key].length || section[key].some(item => typeof item !== "string" || !item.trim() || item.length > 160))) fail("Bộ lọc ma trận không hợp lệ: " + key);
      for (const key of ["difficultyMin", "difficultyMax"]) if (section[key] !== undefined && (!Number.isFinite(section[key]) || section[key] < 1 || section[key] > 5)) fail("Độ khó của ma trận phải từ 1 đến 5.");
      if ((section.difficultyMin ?? 1) > (section.difficultyMax ?? 5)) fail("Khoảng độ khó của ma trận bị đảo.");
    }
    if (input.sections.reduce((n, section) => n + section.count, 0) > MAX_QUESTIONS) fail("Bài kiểm tra vượt giới hạn 80 câu.");
    // Source metadata is retained, never promoted into an official exam claim.
    const blueprint = copy(input);
    blueprint.resultType = "in-app-authored-assessment";
    blueprint.contentStatus = blueprint.contentStatus || "draft";
    blueprint.source = blueprint.source || { kind: "authored", sourceTitle: "HH School · bài kiểm tra tự biên soạn", reviewStatus: "draft" };
    return blueprint;
  }

  function normalizeQuestion(input, blueprint) {
    if (!json(input) || !record(input) || !id(input.id) || typeof input.prompt !== "string" || !input.prompt.trim() || typeof input.type !== "string" || !input.type.trim()) fail("Câu hỏi thiếu ID, đề hoặc kiểu bài.");
    if (input.gradeId !== blueprint.gradeId || input.subjectId !== blueprint.subjectId) fail("Ngân hàng chứa câu ngoài lớp hoặc môn của ma trận.");
    const question = copy(input);
    question.familyId = question.familyId || question.id;
    if (!id(question.familyId)) fail("Họ câu hỏi không hợp lệ.");
    question.contentVersion = question.contentVersion ?? question.version ?? blueprint.contentVersion;
    if (!version(question.contentVersion)) fail("Phiên bản câu hỏi không hợp lệ.");
    question.outcomeIds = outcomes(question);
    question.contentStatus = question.contentStatus || "draft";
    if (question.type === "matching" && record(question.answer)) question.matchingKeys = Object.keys(question.answer);
    if (!question.outcomeIds.length || question.outcomeIds.some(value => !id(value))) fail("Câu hỏi cần yêu cầu cần đạt/kỹ năng hợp lệ.");
    question.points = question.points ?? question.maxPoints ?? 1;
    if (!Number.isFinite(question.points) || question.points <= 0 || question.points > 1000) fail("Trọng số câu hỏi không hợp lệ.");
    if (question.difficulty !== undefined && (!Number.isFinite(question.difficulty) || question.difficulty < 1 || question.difficulty > 5)) fail("Độ khó câu hỏi không hợp lệ.");
    return question;
  }

  function matches(question, section) {
    return (!section.outcomeIds || question.outcomeIds.some(value => section.outcomeIds.includes(value))) &&
      (!section.cognitiveLevels || section.cognitiveLevels.includes(question.cognitiveLevel)) &&
      (!section.questionTypes || section.questionTypes.includes(question.type)) &&
      (section.difficultyMin === undefined || Number.isFinite(question.difficulty) && question.difficulty >= section.difficultyMin) &&
      (section.difficultyMax === undefined || Number.isFinite(question.difficulty) && question.difficulty <= section.difficultyMax);
  }

  function signature(question) {
    // Exact duplicates with fresh IDs are one item family too. Authored family
    // IDs additionally group numeric/wording variants that a hash cannot judge.
    const options = question.options || [], semanticOption = index => /^\d+$/.test(String(index)) && Number(index) < options.length ? options[Number(index)] : index;
    let answer = question.answer ?? null;
    if (question.type === "single") answer = semanticOption(answer);
    if (question.type === "multiple" && Array.isArray(answer)) answer = answer.map(semanticOption).sort((a, b) => stable(a).localeCompare(stable(b)));
    if (question.type === "order" && Array.isArray(answer)) answer = answer.map(semanticOption);
    return stable({ type: question.type, prompt: question.prompt.normalize("NFC").replace(/\s+/g, " ").trim(), options: options.slice().sort((a, b) => stable(a).localeCompare(stable(b))), answer, expectedOutput: question.expectedOutput ?? null, media: question.media ?? null });
  }

  function selectQuestions(bank, rawBlueprint, options = {}) {
    const blueprint = normalizeBlueprint(rawBlueprint);
    if (!Array.isArray(bank) || bank.length > 30000) fail("Ngân hàng câu hỏi không hợp lệ.");
    const candidates = bank.filter(question => question?.gradeId === blueprint.gradeId && question?.subjectId === blueprint.subjectId).map(question => normalizeQuestion(question, blueprint));
    if (new Set(candidates.map(question => question.id)).size !== candidates.length) fail("Ngân hàng có ID câu hỏi trùng nhau.");
    const excluded = new Set(options.excludeFamilyIds || []), parents = new Map();
    const find = family => { const parent = parents.get(family); if (!parent) { parents.set(family, family); return family; } if (parent === family) return parent; const root = find(parent); parents.set(family, root); return root; };
    const fingerprints = new Map();
    for (const question of candidates) {
      const key = signature(question), family = find(question.familyId);
      if (fingerprints.has(key)) parents.set(family, find(fingerprints.get(key)));
      else fingerprints.set(key, family);
    }
    const excludedRoots = new Set([...excluded].map(find)), groups = new Map();
    for (const question of candidates) {
      const family = find(question.familyId);
      if (excludedRoots.has(family)) continue;
      if (!groups.has(family)) groups.set(family, []);
      groups.get(family).push(question);
    }
    const next = random(String(options.seed ?? "school-assessment"));
    const slots = blueprint.sections.flatMap(section => Array.from({ length: section.count }, (_, index) => ({ section, index, families: shuffled([...groups.keys()].filter(family => groups.get(family).some(question => matches(question, section))), next) })));
    const familySlot = new Map(), slotFamily = new Map();
    function augment(slotIndex, visited) {
      for (const family of slots[slotIndex].families) {
        if (visited.has(family)) continue;
        visited.add(family);
        if (!familySlot.has(family) || augment(familySlot.get(family), visited)) { familySlot.set(family, slotIndex); slotFamily.set(slotIndex, family); return true; }
      }
      return false;
    }
    const order = slots.map((_, index) => index).sort((a, b) => slots[a].families.length - slots[b].families.length || a - b);
    for (const index of order) if (!augment(index, new Set())) fail("Ngân hàng chưa có đủ họ bài độc lập đúng ma trận; không tạo đề bằng câu lặp.", "ASSESSMENT_INSUFFICIENT_BANK");
    return freeze(slots.map((slot, index) => ({ ...copy(shuffled(groups.get(slotFamily.get(index)).filter(question => matches(question, slot.section)), next)[0]), assessmentSectionId: slot.section.id })));
  }

  function validateBlueprint(blueprint, bank) {
    try { const normalized = normalizeBlueprint(blueprint); const questions = bank === undefined ? null : selectQuestions(bank, normalized); return { ok: true, errors: [], questionCount: normalized.sections.reduce((n, section) => n + section.count, 0), available: questions?.length ?? null }; }
    catch (error) { return { ok: false, errors: [error.message], code: error.code }; }
  }

  const fingerprint = session => hash(stable({ blueprint: session.blueprint, questions: session.questions }));

  function checked(session) {
    if (!json(session) || !record(session) || session.schemaVersion !== VERSION) fail("Phiên kiểm tra sai định dạng hoặc thuộc phiên bản chưa hỗ trợ.", "ASSESSMENT_INCOMPATIBLE");
    if (JSON.stringify(session).length > MAX_SESSION_CHARS || !id(session.id) || !id(session.ownerId) || !id(session.learnerProfileId)) fail("Phiên kiểm tra quá lớn hoặc sai hồ sơ.");
    const blueprint = normalizeBlueprint(session.blueprint), count = blueprint.sections.reduce((n, section) => n + section.count, 0);
    if (!Array.isArray(session.questions) || session.questions.length !== count || new Set(session.questions.map(question => question.id)).size !== count) fail("Đề đã lưu thiếu hoặc trùng câu hỏi.");
    for (const question of session.questions) normalizeQuestion(question, blueprint);
    if (session.contentFingerprint !== fingerprint(session)) fail("Nội dung đề đã lưu thay đổi; không tự thay bằng ngân hàng mới.", "ASSESSMENT_SNAPSHOT_CHANGED");
    if (!["practice", "mock"].includes(session.mode) || !["active", "paused", "submitted"].includes(session.status) || session.mode === "mock" && session.status === "paused") fail("Trạng thái kiểm tra không hợp lệ.");
    if (!time(session.startedAt) || !time(session.lastClockAt) || session.lastClockAt < session.startedAt || session.durationMs !== Math.round(blueprint.durationMinutes * 60000)) fail("Mốc thời gian kiểm tra không hợp lệ.");
    if (session.mode === "mock" ? session.deadlineAt !== session.startedAt + session.durationMs : session.deadlineAt !== null) fail("Hạn nộp đã thay đổi so với lúc bắt đầu.");
    if (!Number.isFinite(session.elapsedMs) || session.elapsedMs < 0 || !Number.isInteger(session.questionIndex) || session.questionIndex < 0 || session.questionIndex >= count || !Number.isInteger(session.answerRevision) || session.answerRevision < 0) fail("Vị trí hoặc thời gian làm bài không hợp lệ.");
    const ids = new Set(session.questions.map(question => question.id));
    if (!record(session.answers) || Object.keys(session.answers).some(key => !ids.has(key)) || !record(session.timeSpentMs) || Object.keys(session.timeSpentMs).some(key => !ids.has(key) || !Number.isFinite(session.timeSpentMs[key]) || session.timeSpentMs[key] < 0)) fail("Bài đã lưu có đáp án hoặc thời gian ngoài đề.");
    if (!Array.isArray(session.flagged) || new Set(session.flagged).size !== session.flagged.length || session.flagged.some(key => !ids.has(key))) fail("Dấu xem lại không hợp lệ.");
    if (session.status === "submitted" && (!time(session.submittedAt) || !id(session.submissionId) || !record(session.result))) fail("Bản nộp đã lưu không đầy đủ.");
    return session;
  }

  function finish(session) { checked(session); return freeze(session); }

  function createSession(options = {}) {
    const blueprint = normalizeBlueprint(options.blueprint), now = options.now ?? Date.now();
    if (!time(now) || !id(options.ownerId) || !id(options.learnerProfileId)) fail("Cần thời gian, tài khoản và hồ sơ hợp lệ để tạo phiên.");
    const mode = options.mode || "practice";
    if (!["practice", "mock"].includes(mode)) fail("Chọn Luyện đề hoặc Thi thử.");
    const questions = selectQuestions(options.questions || options.bank, blueprint, { seed: options.seed, excludeFamilyIds: options.excludeFamilyIds });
    const durationMs = Math.round(blueprint.durationMinutes * 60000);
    const session = { schemaVersion: VERSION, id: options.id || `assessment-${now.toString(36)}-${hash(options.ownerId + ":" + options.learnerProfileId + ":" + blueprint.id + ":" + String(options.seed ?? ""))}-${(++serial).toString(36)}`, ownerId: options.ownerId, learnerProfileId: options.learnerProfileId, blueprint, questions: copy(questions), mode, status: "active", seed: String(options.seed ?? "school-assessment"), startedAt: now, lastClockAt: now, durationMs, deadlineAt: mode === "mock" ? now + durationMs : null, elapsedMs: 0, questionIndex: 0, answers: {}, timeSpentMs: {}, flagged: [], answerRevision: 0, submittedAt: null, submissionId: null, result: null };
    session.contentFingerprint = fingerprint(session);
    return finish(session);
  }

  function nowFor(session, now = Date.now()) { if (!time(now)) fail("Đồng hồ không hợp lệ."); return Math.max(now, session.lastClockAt); }

  function advance(session, now) {
    const effective = nowFor(session, now), next = copy(session);
    if (session.status === "active") {
      const until = session.mode === "mock" ? Math.min(effective, session.deadlineAt) : effective;
      const delta = Math.max(0, until - session.lastClockAt), questionId = session.questions[session.questionIndex].id;
      next.elapsedMs += delta;
      if (delta > 0) next.timeSpentMs[questionId] = (next.timeSpentMs[questionId] || 0) + delta;
    }
    next.lastClockAt = effective;
    return next;
  }

  function remainingMs(session, now = Date.now()) {
    checked(session);
    if (session.status === "submitted") return session.mode === "mock" ? Math.max(0, session.deadlineAt - session.submittedAt) : Math.max(0, session.durationMs - session.elapsedMs);
    const effective = nowFor(session, now);
    return session.mode === "mock" ? Math.max(0, session.deadlineAt - effective) : Math.max(0, session.durationMs - session.elapsedMs - (session.status === "active" ? effective - session.lastClockAt : 0));
  }

  function gradeOne(question, answer, gradeQuestion) {
    if (answer === undefined || answer === "" || answer === null || Array.isArray(answer) && !answer.length) return { correct: false, score: 0, gradingStatus: "unanswered", explanation: question.explanation || "Chưa có câu trả lời." };
    if (typeof gradeQuestion !== "function") return { correct: null, score: null, gradingStatus: "pending-review", explanation: "Chưa có bộ chấm phù hợp; cần đối chiếu rubric hoặc người chấm." };
    const raw = gradeQuestion(freeze(copy(question)), freeze(copy(answer)));
    if (!record(raw) || ![Object.prototype, null].includes(Object.getPrototypeOf(raw))) fail("Bộ chấm trả về dữ liệu không hợp lệ.", "ASSESSMENT_INVALID_GRADE");
    // Existing graders may omit an optional expected answer for code/output
    // checks. Drop only undefined optional fields; never coerce a bad score.
    const result = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== undefined));
    if (!json(result)) fail("Bộ chấm trả về dữ liệu không hợp lệ.", "ASSESSMENT_INVALID_GRADE");
    if (result.score === null || ["pending-review", "unavailable", "self-assessed"].includes(result.gradingStatus)) return { ...copy(result), correct: null, score: null, gradingStatus: "pending-review" };
    // HHSchoolCore.gradeQuestion uses percentages, including partial credit.
    if (!Number.isFinite(result.score) || result.score < 0 || result.score > 100) fail("Điểm tự động phải là phần trăm từ 0 đến 100.", "ASSESSMENT_INVALID_GRADE");
    return { ...copy(result), score: result.score, correct: result.correct === true, gradingStatus: "graded" };
  }

  function submit(session, options = {}) {
    checked(session);
    if (session.status === "submitted") return session;
    const next = advance(session, options.now ?? Date.now()), timeout = next.mode === "mock" && next.lastClockAt >= next.deadlineAt;
    const items = next.questions.map(question => {
      const grade = gradeOne(question, own(next.answers, question.id) ? next.answers[question.id] : undefined, options.gradeQuestion);
      return { questionId: question.id, familyId: question.familyId, outcomeIds: question.outcomeIds, subjectId: question.subjectId, ...grade, maxPoints: question.points, points: grade.score === null ? null : question.points * grade.score / 100 };
    });
    const earnedPoints = items.reduce((n, item) => n + (item.points || 0), 0), maxPoints = items.reduce((n, item) => n + item.maxPoints, 0), pending = items.filter(item => item.points === null).length, gradedMaxPoints = items.filter(item => item.points !== null).reduce((n, item) => n + item.maxPoints, 0);
    const byOutcome = {};
    for (const item of items) for (const outcomeId of item.outcomeIds) {
      const row = byOutcome[outcomeId] || (byOutcome[outcomeId] = { outcomeId, earnedPoints: 0, maxPoints: 0, pending: 0, needsReview: [] });
      row.earnedPoints += item.points || 0; row.maxPoints += item.maxPoints; row.pending += item.points === null ? 1 : 0;
      if (item.correct !== true) row.needsReview.push(item.questionId);
    }
    next.status = "submitted"; next.submittedAt = timeout ? next.deadlineAt : next.lastClockAt; next.finalizedAt = next.lastClockAt; next.submissionId = "submission-" + next.id.slice(0, 140) + "-" + hash(next.id);
    next.result = { official: false, label: "Kết quả luyện tập trong ứng dụng", gradingStatus: pending ? "pending-review" : "graded", reason: timeout ? "timeout" : "manual", earnedPoints, maxPoints, gradedMaxPoints, pending, percent: pending ? null : earnedPoints / maxPoints * 100, provisionalPercent: gradedMaxPoints ? earnedPoints / gradedMaxPoints * 100 : null, elapsedMs: next.elapsedMs, items, byOutcome: Object.values(byOutcome) };
    return finish(next);
  }

  function update(session, action, options = {}) {
    checked(session);
    if (!record(action) || !["answer", "flag", "navigate", "pause", "resume", "tick", "submit"].includes(action.type)) fail("Thao tác kiểm tra không hợp lệ.");
    if (session.status === "submitted") return session;
    const next = advance(session, options.now ?? Date.now());
    if (next.mode === "mock" && next.lastClockAt >= next.deadlineAt || action.type === "submit") return submit(next, { ...options, now: next.lastClockAt });
    if (action.type === "pause") {
      if (next.mode === "mock") fail("Thi thử không dừng đồng hồ; rời trang vẫn tính giờ.", "ASSESSMENT_PAUSE_NOT_ALLOWED");
      next.status = "paused";
    } else if (action.type === "resume") next.status = "active";
    else if (action.type !== "tick") {
      if (next.status !== "active") fail("Tiếp tục Luyện đề trước khi sửa bài.", "ASSESSMENT_PAUSED");
      if (action.type === "navigate") { if (!Number.isInteger(action.index) || action.index < 0 || action.index >= next.questions.length) fail("Vị trí câu hỏi ngoài đề."); next.questionIndex = action.index; }
      else {
        if (!next.questions.some(question => question.id === action.questionId)) fail("Câu hỏi không thuộc đề đã bắt đầu.");
        if (action.type === "flag") {
          const on = action.on === undefined ? !next.flagged.includes(action.questionId) : action.on;
          if (typeof on !== "boolean") fail("Dấu xem lại không hợp lệ.");
          next.flagged = next.flagged.filter(value => value !== action.questionId); if (on) next.flagged.push(action.questionId);
        } else {
          if (!json(action.value) || JSON.stringify(action.value).length > 16000) fail("Câu trả lời quá lớn hoặc không hợp lệ.");
          next.answers[action.questionId] = copy(action.value); next.answerRevision++;
        }
      }
    }
    return finish(next);
  }

  function restoreSession(raw, options = {}) {
    const parsed = typeof raw === "string" ? (() => { if (raw.length > MAX_SESSION_CHARS) fail("Phiên đã lưu quá lớn."); try { return JSON.parse(raw); } catch { fail("Phiên đã lưu không đọc được."); } })() : raw;
    checked(parsed);
    if (options.ownerId !== undefined && parsed.ownerId !== options.ownerId || options.learnerProfileId !== undefined && parsed.learnerProfileId !== options.learnerProfileId) fail("Phiên kiểm tra thuộc tài khoản hoặc hồ sơ khác.", "ASSESSMENT_OWNER_MISMATCH");
    return update(freeze(copy(parsed)), { type: "tick" }, options);
  }

  const publicKeys = new Set(["id", "gradeId", "subjectId", "lessonId", "topicId", "outcomeId", "outcomeIds", "familyId", "type", "prompt", "stem", "passage", "readingText", "options", "items", "leftItems", "rightItems", "matchingKeys", "image", "diagram", "visual", "table", "audio", "transcript", "publicRubric", "cognitiveLevel", "difficulty", "points", "maxPoints", "contentVersion", "version", "source", "contentStatus", "assessmentSectionId", "unit", "unitLabel", "inputLabel", "responseType", "statementLabels", "maxLength"]);
  const privateNestedKeys = /answer|solution|explanation|correct|expected|hint|grading|rationale/i;
  function redactNested(value) {
    if (Array.isArray(value)) return value.map(redactNested);
    if (!record(value)) return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !privateNestedKeys.test(key)).map(([key, item]) => [key, redactNested(item)]));
  }
  function publicQuestion(question) { return Object.fromEntries(Object.entries(question).filter(([key]) => publicKeys.has(key)).map(([key, value]) => [key, redactNested(value)])); }

  function view(session, options = {}) {
    checked(session);
    const submitted = session.status === "submitted";
    return freeze({ id: session.id, mode: session.mode, status: session.status, title: session.blueprint.title, resultType: "in-app-authored-assessment", contentStatus: session.blueprint.contentStatus, source: copy(session.blueprint.source), startedAt: session.startedAt, deadlineAt: session.deadlineAt, remainingMs: remainingMs(session, options.now ?? Date.now()), canPause: session.mode === "practice", timeLimit: session.mode === "mock" ? "hard-wall-clock" : "advisory", mustSubmit: !submitted && session.mode === "mock" && remainingMs(session, options.now ?? Date.now()) === 0, questionIndex: session.questionIndex, questions: session.questions.map(question => submitted ? copy(question) : publicQuestion(question)), answers: copy(session.answers), flagged: session.flagged.slice(), result: submitted ? copy(session.result) : null });
  }

  function review(session, questionId, options = {}) {
    checked(session);
    const question = session.questions.find(item => item.id === questionId);
    if (!question) fail("Câu hỏi không thuộc đề đã bắt đầu.");
    if (session.mode === "mock" && session.status !== "submitted") fail("Thi thử chỉ mở lời giải sau khi nộp bài.", "ASSESSMENT_REVIEW_LOCKED");
    if (session.status !== "submitted" && !own(session.answers, questionId)) fail("Hãy thử làm bài trước khi mở lời giải.", "ASSESSMENT_ANSWER_REQUIRED");
    const grade = session.status === "submitted" ? session.result.items.find(item => item.questionId === questionId) : gradeOne(question, session.answers[questionId], options.gradeQuestion);
    return freeze({ question: copy(question), answer: own(session.answers, questionId) ? copy(session.answers[questionId]) : null, grade: copy(grade) });
  }

  const api = { VERSION, MAX_QUESTIONS, MAX_SESSION_CHARS, validateBlueprint, selectQuestions, createSession, restoreSession, remainingMs, update, submit, view, review,
    answer: (session, questionId, value, now = Date.now(), gradeQuestion) => update(session, { type: "answer", questionId, value }, { now, gradeQuestion }),
    flag: (session, questionId, on, now = Date.now(), gradeQuestion) => update(session, { type: "flag", questionId, on }, { now, gradeQuestion }),
    navigate: (session, index, now = Date.now(), gradeQuestion) => update(session, { type: "navigate", index }, { now, gradeQuestion }),
    pause: (session, now = Date.now()) => update(session, { type: "pause" }, { now }),
    resume: (session, now = Date.now(), gradeQuestion) => update(session, { type: "resume" }, { now, gradeQuestion }) };
  return Object.freeze(api);
});
