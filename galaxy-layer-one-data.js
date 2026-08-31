(function (globalScope, factory) {
  "use strict";
  var api = factory(globalScope || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHGalaxyLayerOneData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (globalScope) {
  "use strict";

  var VERSION = "1.0.0";
  var SCHEMA = "hh-galaxy.creator-studio.export";
  var STORAGE_KEY = "hh-galaxy.creator-studio.v1";
  var MAX_ACTIVITY = 100;
  var idSequence = 0;

  var STEP_STATUSES = Object.freeze([
    Object.freeze({ id: "not-started", label: "Chưa bắt đầu", weight: 0 }),
    Object.freeze({ id: "in-progress", label: "Đang làm", weight: 0.5 }),
    Object.freeze({ id: "review", label: "Cần duyệt", weight: 0.8 }),
    Object.freeze({ id: "completed", label: "Hoàn thành", weight: 1 })
  ]);

  var PIPELINE_STEPS = Object.freeze([
    Object.freeze({ id: "idea", number: 1, label: "IDEA", title: "Ý tưởng", icon: "lightbulb", tone: "gold", placeholder: "Mục tiêu, đối tượng và thông điệp chính..." }),
    Object.freeze({ id: "script", number: 2, label: "SCRIPT", title: "Kịch bản", icon: "file-pen", tone: "violet", placeholder: "Viết dàn ý hoặc kịch bản nội dung..." }),
    Object.freeze({ id: "image", number: 3, label: "IMAGE", title: "Hình ảnh", icon: "image", tone: "blue", placeholder: "Mô tả shot, moodboard hoặc danh sách hình ảnh..." }),
    Object.freeze({ id: "voice", number: 4, label: "VOICE", title: "Giọng đọc", icon: "mic", tone: "pink", placeholder: "Ghi chú giọng đọc, nhịp và cách phát âm..." }),
    Object.freeze({ id: "music", number: 5, label: "MUSIC", title: "Âm nhạc", icon: "music", tone: "purple", placeholder: "Ghi chú nhạc nền, nhịp độ và quyền sử dụng..." }),
    Object.freeze({ id: "video", number: 6, label: "VIDEO", title: "Video", icon: "video", tone: "cyan", placeholder: "Danh sách cảnh, dựng thô và ghi chú hậu kỳ..." }),
    Object.freeze({ id: "thumbnail", number: 7, label: "THUMBNAIL", title: "Ảnh bìa", icon: "layout", tone: "orange", placeholder: "Thông điệp, bố cục và phương án ảnh bìa..." }),
    Object.freeze({ id: "seo", number: 8, label: "SEO", title: "Tối ưu SEO", icon: "search", tone: "green", placeholder: "Tiêu đề, mô tả và từ khóa có căn cứ..." }),
    Object.freeze({ id: "publish", number: 9, label: "PUBLISH", title: "Xuất bản", icon: "rocket", tone: "rose", placeholder: "Kênh xuất bản và checklist kiểm tra cuối..." })
  ]);

  var STEP_IDS = PIPELINE_STEPS.map(function (step) { return step.id; });
  var STATUS_IDS = STEP_STATUSES.map(function (status) { return status.id; });

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function asObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function cleanText(value, limit) {
    return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, limit || 5000);
  }

  function isoDate(value, fallback) {
    var parsed = new Date(value || "");
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : fallback;
  }

  function uid(prefix, now) {
    idSequence += 1;
    if (globalScope.crypto && typeof globalScope.crypto.randomUUID === "function") {
      return prefix + "-" + globalScope.crypto.randomUUID();
    }
    return prefix + "-" + Number(now || Date.now()).toString(36) + "-" + idSequence.toString(36);
  }

  function statusWeight(status) {
    var match = STEP_STATUSES.find(function (entry) { return entry.id === status; });
    return match ? match.weight : 0;
  }

  function makeChecklist(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 30).map(function (item, index) {
      var source = typeof item === "string" ? { text: item } : asObject(item);
      return {
        id: cleanText(source.id, 120) || "check-" + (index + 1),
        text: cleanText(source.text || source.label, 240) || "Mục kiểm tra",
        done: source.done === true
      };
    });
  }

  function defaultStep(step, nowIso) {
    return {
      id: step.id,
      status: "not-started",
      content: "",
      notes: "",
      checklist: [],
      updatedAt: nowIso
    };
  }

  function normalizeStep(value, definition, nowIso) {
    var source = asObject(value);
    var status = STATUS_IDS.indexOf(source.status) >= 0 ? source.status : "not-started";
    return {
      id: definition.id,
      status: status,
      content: cleanText(source.content, 30000),
      notes: cleanText(source.notes, 10000),
      checklist: makeChecklist(source.checklist),
      updatedAt: isoDate(source.updatedAt, nowIso)
    };
  }

  function normalizeSteps(value, nowIso) {
    var source = asObject(value);
    var result = {};
    PIPELINE_STEPS.forEach(function (definition) {
      result[definition.id] = normalizeStep(source[definition.id], definition, nowIso);
    });
    return result;
  }

  function progressOf(project) {
    var source = asObject(project);
    var steps = asObject(source.steps);
    var total = PIPELINE_STEPS.reduce(function (sum, definition) {
      return sum + statusWeight(asObject(steps[definition.id]).status);
    }, 0);
    return Math.round(total / PIPELINE_STEPS.length * 100);
  }

  function normalizeProject(value, options) {
    options = options || {};
    var source = asObject(value);
    var nowIso = options.nowIso || new Date().toISOString();
    var isDemo = source.isDemo === true;
    var id = cleanText(source.id, 160) || uid(isDemo ? "demo" : "project", Date.parse(nowIso));
    var title = cleanText(source.title || source.name, 180) || "Dự án không tên";
    return {
      id: id,
      title: title,
      description: cleanText(source.description, 1000),
      category: cleanText(source.category, 80) || "Nội dung",
      accent: cleanText(source.accent, 30) || "violet",
      isDemo: isDemo,
      source: isDemo ? "local-template" : (cleanText(source.source, 80) || "user"),
      templateVersion: isDemo ? (cleanText(source.templateVersion, 30) || VERSION) : (cleanText(source.templateVersion, 30) || null),
      editable: isDemo ? false : source.editable !== false,
      clonedFrom: isDemo ? null : (cleanText(source.clonedFrom, 160) || null),
      tags: Array.isArray(source.tags) ? source.tags.map(function (tag) { return cleanText(tag, 40); }).filter(Boolean).slice(0, 10) : [],
      dueAt: source.dueAt ? isoDate(source.dueAt, null) : null,
      createdAt: isoDate(source.createdAt, nowIso),
      updatedAt: isoDate(source.updatedAt, nowIso),
      steps: normalizeSteps(source.steps, nowIso)
    };
  }

  function sampleSteps(statuses, seed) {
    var result = {};
    PIPELINE_STEPS.forEach(function (definition, index) {
      var status = statuses[index] || "not-started";
      result[definition.id] = {
        id: definition.id,
        status: status,
        content: seed[definition.id] || "",
        notes: "",
        checklist: status === "completed" ? [{ id: definition.id + "-sample-check", text: "Bước mẫu đã hoàn thiện", done: true }] : [],
        updatedAt: "2026-08-01T08:00:00.000Z"
      };
    });
    return result;
  }

  var SAMPLE_PROJECTS = deepFreeze([
    normalizeProject({
      id: "demo-ai-space-journey",
      title: "Dự án mẫu · AI Space Journey",
      description: "Pipeline minh họa cho một video khám phá không gian tạo bằng công cụ số.",
      category: "AI Visual",
      accent: "violet",
      isDemo: true,
      source: "local-template",
      templateVersion: "1.0.0",
      editable: false,
      tags: ["không gian", "visual"],
      createdAt: "2026-08-01T08:00:00.000Z",
      updatedAt: "2026-08-01T08:00:00.000Z",
      steps: sampleSteps(["completed", "completed", "completed", "completed", "review", "in-progress", "in-progress", "not-started", "not-started"], {
        idea: "Một hành trình thị giác qua các hành tinh xa xôi.",
        script: "Mở đầu bằng Trái Đất, đi qua tinh vân và kết tại một hành tinh mới.",
        image: "Moodboard tím, xanh cyan và các dải bụi sao.",
        voice: "Giọng kể bình tĩnh, giàu cảm giác khám phá.",
        music: "Ambient điện tử, nhịp chậm."
      })
    }),
    normalizeProject({
      id: "demo-piano-rain",
      title: "Bản nhạc mẫu · Piano Chill in the Rain",
      description: "Mẫu quy trình sản xuất nội dung thư giãn với piano và âm thanh mưa.",
      category: "Piano",
      accent: "gold",
      isDemo: true,
      source: "local-template",
      templateVersion: "1.0.0",
      editable: false,
      tags: ["piano", "thư giãn"],
      createdAt: "2026-08-01T08:00:00.000Z",
      updatedAt: "2026-08-01T08:00:00.000Z",
      steps: sampleSteps(["completed", "completed", "completed", "review", "in-progress", "not-started", "not-started", "not-started", "not-started"], {
        idea: "Không gian piano đêm mưa cho học tập và thư giãn.",
        script: "Ba chương: mưa nhẹ, cao trào piano, kết thúc êm.",
        image: "Cửa sổ mưa và ánh đèn vàng ấm."
      })
    }),
    normalizeProject({
      id: "demo-forest-night",
      title: "Video mẫu · Forest Night Ambience",
      description: "Mẫu video ambience rừng đêm, có checklist hình, âm thanh và xuất bản.",
      category: "Ambience",
      accent: "green",
      isDemo: true,
      source: "local-template",
      templateVersion: "1.0.0",
      editable: false,
      tags: ["rừng", "ambience"],
      createdAt: "2026-08-01T08:00:00.000Z",
      updatedAt: "2026-08-01T08:00:00.000Z",
      steps: sampleSteps(["completed", "completed", "completed", "completed", "completed", "completed", "review", "in-progress", "not-started"], {
        idea: "Một đêm trong rừng với tiếng suối và côn trùng.",
        script: "Chuyển cảnh rất chậm, không có lời thoại.",
        image: "Rừng xanh thẫm, đèn lều ấm và sương nhẹ.",
        voice: "Không sử dụng giọng đọc.",
        music: "Chỉ dùng field recording có quyền sử dụng."
      })
    })
  ]);

  var SAMPLE_SCHEDULE = deepFreeze([
    { id: "demo-schedule-idea", title: "Họp nhóm dự án", note: "Thảo luận ý tưởng nội dung mẫu", time: "09:00", stepId: "idea", projectId: "demo-ai-space-journey", isDemo: true, source: "local-template", templateVersion: "1.0.0", editable: false },
    { id: "demo-schedule-video", title: "Sản xuất video", note: "Dựng bản nháp cho dự án mẫu", time: "11:00", stepId: "video", projectId: "demo-forest-night", isDemo: true, source: "local-template", templateVersion: "1.0.0", editable: false },
    { id: "demo-schedule-voice", title: "Thu âm giọng đọc", note: "Kiểm tra nhịp và phát âm", time: "14:00", stepId: "voice", projectId: "demo-piano-rain", isDemo: true, source: "local-template", templateVersion: "1.0.0", editable: false },
    { id: "demo-schedule-publish", title: "Xuất bản & SEO", note: "Checklist minh họa trước xuất bản", time: "16:00", stepId: "publish", projectId: "demo-ai-space-journey", isDemo: true, source: "local-template", templateVersion: "1.0.0", editable: false }
  ]);

  function memoryStorage(seed) {
    var records = new Map(Object.entries(seed || {}).map(function (entry) { return [entry[0], String(entry[1])]; }));
    return {
      getItem: function (key) { return records.has(key) ? records.get(key) : null; },
      setItem: function (key, value) { records.set(key, String(value)); },
      removeItem: function (key) { records.delete(key); },
      key: function (index) { return Array.from(records.keys())[index] || null; },
      get length() { return records.size; },
      inspect: function () { return new Map(records); }
    };
  }

  function resolveStorage(candidate) {
    if (candidate && typeof candidate.getItem === "function" && typeof candidate.setItem === "function") {
      return { storage: candidate, kind: candidate === globalScope.localStorage ? "localStorage" : "adapter" };
    }
    try {
      if (globalScope.localStorage && typeof globalScope.localStorage.getItem === "function") {
        globalScope.localStorage.getItem(STORAGE_KEY);
        return { storage: globalScope.localStorage, kind: "localStorage" };
      }
    } catch (error) { /* A private browser context may block localStorage. */ }
    return { storage: memoryStorage(), kind: "memory-fallback" };
  }

  function initialState(nowIso) {
    return {
      schemaVersion: 1,
      projects: clone(SAMPLE_PROJECTS),
      schedule: clone(SAMPLE_SCHEDULE),
      activity: [],
      hiddenDemoIds: [],
      updatedAt: nowIso
    };
  }

  function normalizeScheduleItem(value, nowIso) {
    var source = asObject(value);
    var isDemo = source.isDemo === true;
    return {
      id: cleanText(source.id, 160) || uid(isDemo ? "demo-schedule" : "schedule", Date.parse(nowIso)),
      title: cleanText(source.title, 180) || "Lịch chưa đặt tên",
      note: cleanText(source.note, 500),
      at: source.at ? isoDate(source.at, null) : null,
      time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(source.time || "")) ? String(source.time) : null,
      stepId: STEP_IDS.indexOf(source.stepId) >= 0 ? source.stepId : null,
      projectId: cleanText(source.projectId, 160) || null,
      done: source.done === true,
      isDemo: isDemo,
      source: isDemo ? "local-template" : (cleanText(source.source, 80) || "user"),
      templateVersion: isDemo ? (cleanText(source.templateVersion, 30) || VERSION) : null,
      editable: isDemo ? false : source.editable !== false,
      createdAt: isDemo ? null : isoDate(source.createdAt, nowIso),
      updatedAt: isDemo ? null : isoDate(source.updatedAt, nowIso)
    };
  }

  function normalizeState(value, nowIso) {
    var source = asObject(value);
    var hiddenDemoIds = Array.isArray(source.hiddenDemoIds) ? source.hiddenDemoIds.map(function (id) { return cleanText(id, 160); }).filter(Boolean) : [];
    var rawProjects = Array.isArray(source.projects) ? source.projects : [];
    var projects = rawProjects.map(function (project) { return normalizeProject(project, { nowIso: nowIso }); });
    SAMPLE_PROJECTS.forEach(function (sample) {
      if (hiddenDemoIds.indexOf(sample.id) === -1 && !projects.some(function (project) { return project.id === sample.id; })) projects.push(clone(sample));
    });
    var schedule = (Array.isArray(source.schedule) ? source.schedule : []).map(function (item) { return normalizeScheduleItem(item, nowIso); });
    SAMPLE_SCHEDULE.forEach(function (sample) {
      if (hiddenDemoIds.indexOf(sample.id) === -1 && !schedule.some(function (item) { return item.id === sample.id; })) schedule.push(clone(sample));
    });
    return {
      schemaVersion: 1,
      projects: projects,
      schedule: schedule,
      activity: Array.isArray(source.activity) ? source.activity.filter(function (item) { return item && typeof item === "object"; }).slice(0, MAX_ACTIVITY) : [],
      hiddenDemoIds: Array.from(new Set(hiddenDemoIds)),
      updatedAt: isoDate(source.updatedAt, nowIso)
    };
  }

  function safeParse(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    try { return JSON.parse(value); } catch (error) { return null; }
  }

  function sameDay(first, second) {
    var left = new Date(first);
    var right = new Date(second);
    if (!Number.isFinite(left.getTime()) || !Number.isFinite(right.getTime())) return false;
    return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  }

  function buildStats(value, referenceDate) {
    var state = asObject(value);
    var projects = (Array.isArray(state.projects) ? state.projects : []).filter(function (project) { return project && project.isDemo !== true; });
    var schedule = (Array.isArray(state.schedule) ? state.schedule : []).filter(function (item) { return item && item.isDemo !== true; });
    var progress = projects.map(progressOf);
    var day = referenceDate || new Date();
    return {
      totalProjects: projects.length,
      activeProjects: progress.filter(function (value) { return value > 0 && value < 100; }).length,
      completedProjects: progress.filter(function (value) { return value === 100; }).length,
      draftProjects: progress.filter(function (value) { return value === 0; }).length,
      dueToday: schedule.filter(function (item) { return item.at && sameDay(item.at, day); }).length,
      completedSteps: projects.reduce(function (count, project) {
        return count + PIPELINE_STEPS.filter(function (step) { return asObject(project.steps && project.steps[step.id]).status === "completed"; }).length;
      }, 0)
    };
  }

  function createStore(options) {
    options = options || {};
    var resolved = resolveStorage(options.storage);
    var storage = resolved.storage;
    var storageKind = resolved.kind;
    var now = typeof options.now === "function" ? options.now : function () { return new Date(); };
    var subscribers = new Set();
    var lastError = null;

    function currentIso() {
      var value = now();
      var date = value instanceof Date ? value : new Date(value);
      return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
    }

    var state;
    try {
      var stored = safeParse(storage.getItem(STORAGE_KEY));
      state = stored ? normalizeState(stored, currentIso()) : initialState(currentIso());
    } catch (error) {
      lastError = error;
      storage = memoryStorage();
      storageKind = "memory-fallback";
      state = initialState(currentIso());
    }

    function persist(action, detail) {
      state.updatedAt = currentIso();
      try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); lastError = null; }
      catch (error) {
        lastError = error;
        storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(state) });
        storageKind = "memory-fallback";
      }
      var snapshot = clone(state);
      subscribers.forEach(function (listener) {
        try { listener(snapshot, { action: action, detail: clone(detail), storageKind: storageKind }); } catch (error) { /* Subscriber failures are isolated. */ }
      });
      return snapshot;
    }

    function record(action, entityId) {
      state.activity.unshift({ id: uid("activity", Date.parse(currentIso())), action: action, entityId: entityId || null, at: currentIso() });
      state.activity = state.activity.slice(0, MAX_ACTIVITY);
    }

    function findProject(id) {
      return state.projects.find(function (project) { return project.id === id; });
    }

    function requireEditable(id) {
      var project = findProject(id);
      if (!project) {
        var missing = new Error("Không tìm thấy dự án.");
        missing.code = "PROJECT_NOT_FOUND";
        throw missing;
      }
      if (project.isDemo || project.editable === false) {
        var readOnly = new Error("Bản mẫu chỉ đọc. Hãy tạo bản sao trước khi chỉnh sửa.");
        readOnly.code = "DEMO_READ_ONLY";
        throw readOnly;
      }
      return project;
    }

    function createProject(input) {
      var nowIso = currentIso();
      var source = Object.assign({}, asObject(input), {
        id: cleanText(asObject(input).id, 160) || uid("project", Date.parse(nowIso)),
        isDemo: false,
        source: cleanText(asObject(input).source, 80) || "user",
        editable: true,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      var project = normalizeProject(source, { nowIso: nowIso });
      if (state.projects.some(function (entry) { return entry.id === project.id; })) project.id = uid("project", Date.parse(nowIso));
      state.projects.unshift(project);
      record("project-created", project.id);
      persist("project-created", { projectId: project.id });
      return clone(project);
    }

    function updateProject(id, patch) {
      var project = requireEditable(id);
      var nowIso = currentIso();
      var input = asObject(patch);
      var merged = Object.assign({}, project, input, {
        id: project.id,
        isDemo: false,
        source: project.source,
        editable: true,
        createdAt: project.createdAt,
        updatedAt: nowIso,
        steps: Object.assign({}, project.steps, asObject(input.steps))
      });
      var normalized = normalizeProject(merged, { nowIso: nowIso });
      state.projects[state.projects.indexOf(project)] = normalized;
      record("project-updated", id);
      persist("project-updated", { projectId: id });
      return clone(normalized);
    }

    function updateStep(projectId, stepId, patch) {
      var project = requireEditable(projectId);
      if (STEP_IDS.indexOf(stepId) === -1) {
        var invalidStep = new Error("Bước pipeline không hợp lệ.");
        invalidStep.code = "INVALID_STEP";
        throw invalidStep;
      }
      var nextStep = Object.assign({}, project.steps[stepId], asObject(patch), { id: stepId, updatedAt: currentIso() });
      var nextSteps = {};
      nextSteps[stepId] = nextStep;
      return updateProject(projectId, { steps: nextSteps });
    }

    function removeProject(id) {
      var project = requireEditable(id);
      state.projects.splice(state.projects.indexOf(project), 1);
      state.schedule = state.schedule.filter(function (item) { return item.projectId !== id || item.isDemo; });
      record("project-deleted", id);
      persist("project-deleted", { projectId: id });
      return true;
    }

    function cloneProject(id, overrides) {
      var source = findProject(id);
      if (!source) {
        var missing = new Error("Không tìm thấy dự án để tạo bản sao.");
        missing.code = "PROJECT_NOT_FOUND";
        throw missing;
      }
      var input = Object.assign({}, clone(source), asObject(overrides), {
        id: null,
        title: cleanText(asObject(overrides).title, 180) || ("Bản sao · " + source.title.replace(/^(Dự án|Bản nhạc|Video) mẫu\s*·\s*/i, "")),
        isDemo: false,
        source: "user-clone",
        editable: true,
        clonedFrom: source.id
      });
      return createProject(input);
    }

    function hideDemo(id) {
      var project = findProject(id);
      var scheduleItem = state.schedule.find(function (item) { return item.id === id; });
      if ((!project || !project.isDemo) && (!scheduleItem || !scheduleItem.isDemo)) return false;
      state.projects = state.projects.filter(function (item) { return item.id !== id; });
      var relatedScheduleIds = state.schedule.filter(function (item) { return item.isDemo && (item.id === id || item.projectId === id); }).map(function (item) { return item.id; });
      state.schedule = state.schedule.filter(function (item) { return relatedScheduleIds.indexOf(item.id) === -1; });
      [id].concat(relatedScheduleIds).forEach(function (demoId) {
        if (state.hiddenDemoIds.indexOf(demoId) === -1) state.hiddenDemoIds.push(demoId);
      });
      persist("demo-hidden", { demoId: id });
      return true;
    }

    function restoreDemos() {
      state.hiddenDemoIds = [];
      SAMPLE_PROJECTS.forEach(function (sample) {
        if (!findProject(sample.id)) state.projects.push(clone(sample));
      });
      SAMPLE_SCHEDULE.forEach(function (sample) {
        if (!state.schedule.some(function (item) { return item.id === sample.id; })) state.schedule.push(clone(sample));
      });
      persist("demos-restored", {});
      return clone(state);
    }

    function addSchedule(input) {
      var nowIso = currentIso();
      var item = normalizeScheduleItem(Object.assign({}, asObject(input), { id: null, isDemo: false, source: "user", editable: true }), nowIso);
      state.schedule.push(item);
      record("schedule-created", item.id);
      persist("schedule-created", { scheduleId: item.id });
      return clone(item);
    }

    function updateSchedule(id, patch) {
      var item = state.schedule.find(function (entry) { return entry.id === id; });
      if (!item) throw new Error("Không tìm thấy lịch.");
      if (item.isDemo || item.editable === false) {
        var readOnly = new Error("Lịch mẫu chỉ đọc.");
        readOnly.code = "DEMO_READ_ONLY";
        throw readOnly;
      }
      var normalized = normalizeScheduleItem(Object.assign({}, item, asObject(patch), { id: item.id, isDemo: false, createdAt: item.createdAt, updatedAt: currentIso() }), currentIso());
      state.schedule[state.schedule.indexOf(item)] = normalized;
      persist("schedule-updated", { scheduleId: id });
      return clone(normalized);
    }

    function removeSchedule(id) {
      var item = state.schedule.find(function (entry) { return entry.id === id; });
      if (!item || item.isDemo || item.editable === false) return false;
      state.schedule.splice(state.schedule.indexOf(item), 1);
      persist("schedule-deleted", { scheduleId: id });
      return true;
    }

    function exportJSON(exportOptions) {
      exportOptions = exportOptions || {};
      var includeDemos = exportOptions.includeDemos === true;
      var payload = {
        schema: SCHEMA,
        schemaVersion: 1,
        appVersion: VERSION,
        exportedAt: currentIso(),
        projects: state.projects.filter(function (project) { return includeDemos || !project.isDemo; }).map(clone),
        schedule: state.schedule.filter(function (item) { return includeDemos || !item.isDemo; }).map(clone)
      };
      return JSON.stringify(payload, null, 2);
    }

    function importJSON(value, importOptions) {
      importOptions = importOptions || {};
      var payload = typeof value === "string" ? safeParse(value) : clone(value);
      if (!payload || payload.schema !== SCHEMA || payload.schemaVersion !== 1) {
        var invalid = new Error("Tệp không đúng định dạng HH Galaxy Creator Studio.");
        invalid.code = "INVALID_IMPORT";
        throw invalid;
      }
      var nowIso = currentIso();
      var importedProjects = (Array.isArray(payload.projects) ? payload.projects : []).filter(function (project) { return asObject(project).isDemo !== true; }).map(function (project) {
        return normalizeProject(Object.assign({}, project, { isDemo: false, source: "import", editable: true }), { nowIso: nowIso });
      });
      var importedSchedule = (Array.isArray(payload.schedule) ? payload.schedule : []).filter(function (item) { return asObject(item).isDemo !== true; }).map(function (item) {
        return normalizeScheduleItem(Object.assign({}, item, { isDemo: false, source: "import", editable: true }), nowIso);
      });
      if (importOptions.mode === "replace") {
        state.projects = state.projects.filter(function (project) { return project.isDemo; });
        state.schedule = state.schedule.filter(function (item) { return item.isDemo; });
      }
      importedProjects.forEach(function (project) {
        if (SAMPLE_PROJECTS.some(function (sample) { return sample.id === project.id; })) project.id = uid("import-project", Date.parse(nowIso));
        var index = state.projects.findIndex(function (existing) { return existing.id === project.id && !existing.isDemo; });
        if (index >= 0) state.projects[index] = project; else state.projects.unshift(project);
      });
      importedSchedule.forEach(function (item) {
        var index = state.schedule.findIndex(function (existing) { return existing.id === item.id && !existing.isDemo; });
        if (index >= 0) state.schedule[index] = item; else state.schedule.push(item);
      });
      record("data-imported", null);
      persist("data-imported", { projectCount: importedProjects.length, scheduleCount: importedSchedule.length });
      return { projects: importedProjects.length, schedule: importedSchedule.length };
    }

    function subscribe(listener) {
      if (typeof listener !== "function") return function () {};
      subscribers.add(listener);
      return function () { subscribers.delete(listener); };
    }

    function getSnapshot() { return clone(state); }
    function getProject(id) { var project = findProject(id); return project ? clone(project) : null; }
    function getStats(referenceDate) { return buildStats(state, referenceDate); }

    if (options.persistInitial !== false) persist("store-ready", {});

    return Object.freeze({
      storageKey: STORAGE_KEY,
      storageKind: function () { return storageKind; },
      lastError: function () { return lastError; },
      getSnapshot: getSnapshot,
      getProject: getProject,
      getStats: getStats,
      createProject: createProject,
      updateProject: updateProject,
      updateStep: updateStep,
      removeProject: removeProject,
      cloneProject: cloneProject,
      hideDemo: hideDemo,
      restoreDemos: restoreDemos,
      addSchedule: addSchedule,
      updateSchedule: updateSchedule,
      removeSchedule: removeSchedule,
      exportJSON: exportJSON,
      importJSON: importJSON,
      subscribe: subscribe
    });
  }

  return Object.freeze({
    VERSION: VERSION,
    SCHEMA: SCHEMA,
    STORAGE_KEY: STORAGE_KEY,
    PIPELINE_STEPS: PIPELINE_STEPS,
    STEP_STATUSES: STEP_STATUSES,
    SAMPLE_PROJECTS: SAMPLE_PROJECTS,
    SAMPLE_SCHEDULE: SAMPLE_SCHEDULE,
    memoryStorage: memoryStorage,
    normalizeProject: normalizeProject,
    normalizeState: normalizeState,
    progressOf: progressOf,
    buildStats: buildStats,
    createStore: createStore
  });
});
