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
  var MANIFEST_KEY = STORAGE_KEY + ".manifest";
  var DATABASE_NAME = "hh-galaxy.creator-studio";
  var DATABASE_VERSION = 1;
  var MAX_HISTORY_PER_PROJECT = 12;
  var MAX_HISTORY_SNAPSHOT_BYTES = 512 * 1024;
  var MAX_BACKUP_BYTES = 16 * 1024 * 1024;
  var MAX_BACKUP_PROJECTS = 500;
  var MAX_BACKUP_SCHEDULE = 2000;
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

  function memoryDatabase(seed, options) {
    options = options || {};
    var record = seed ? clone(seed) : null;
    var closed = false;
    return {
      open: function () {
        if (options.openError) return Promise.reject(options.openError);
        return Promise.resolve();
      },
      read: function () {
        if (closed) return Promise.reject(new Error("Creator database is closed."));
        if (options.readError) return Promise.reject(options.readError);
        if (!record) return Promise.resolve({ exists: false, state: null, history: [] });
        var value = clone(record);
        if (value && value.state && value.exists == null) value.exists = true;
        return Promise.resolve(value);
      },
      write: function (value) {
        if (closed) return Promise.reject(new Error("Creator database is closed."));
        if (options.writeError) return Promise.reject(options.writeError);
        record = clone(value);
        return Promise.resolve();
      },
      close: function () { closed = true; },
      inspect: function () { return record ? clone(record) : null; }
    };
  }

  function requestResult(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("IndexedDB request failed.")); };
    });
  }

  function readAll(store) {
    if (typeof store.getAll === "function") return requestResult(store.getAll());
    return new Promise(function (resolve, reject) {
      var values = [];
      var request = store.openCursor();
      request.onerror = function () { reject(request.error || new Error("IndexedDB cursor failed.")); };
      request.onsuccess = function () {
        var cursor = request.result;
        if (!cursor) { resolve(values); return; }
        values.push(cursor.value);
        cursor.continue();
      };
    });
  }

  function transactionDone(transaction) {
    return new Promise(function (resolve, reject) {
      transaction.oncomplete = function () { resolve(); };
      transaction.onerror = function () { reject(transaction.error || new Error("IndexedDB transaction failed.")); };
      transaction.onabort = function () { reject(transaction.error || new Error("IndexedDB transaction was aborted.")); };
    });
  }

  function createIndexedDbDriver(factory, databaseName) {
    var database = null;
    var openPromise = null;

    function open() {
      if (database) return Promise.resolve(database);
      if (openPromise) return openPromise;
      openPromise = new Promise(function (resolve, reject) {
        var settled = false;
        var request;
        try { request = factory.open(databaseName || DATABASE_NAME, DATABASE_VERSION); }
        catch (error) { reject(error); return; }
        request.onupgradeneeded = function () {
          var db = request.result;
          if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
          if (!db.objectStoreNames.contains("schedule")) db.createObjectStore("schedule", { keyPath: "id" });
          if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
          if (!db.objectStoreNames.contains("history")) db.createObjectStore("history", { keyPath: "id" });
        };
        request.onsuccess = function () {
          if (settled) { try { request.result.close(); } catch (error) { /* Best effort. */ } return; }
          settled = true;
          database = request.result;
          database.onversionchange = function () { try { database.close(); } catch (error) { /* Best effort. */ } database = null; openPromise = null; };
          resolve(database);
        };
        request.onerror = function () {
          if (settled) return;
          settled = true;
          reject(request.error || new Error("Không thể mở IndexedDB."));
        };
        request.onblocked = function () {
          if (settled) return;
          settled = true;
          var blocked = new Error("IndexedDB đang bị một phiên khác chặn.");
          blocked.code = "INDEXEDDB_BLOCKED";
          reject(blocked);
        };
      });
      return openPromise;
    }

    function read() {
      return open().then(function (db) {
        var transaction = db.transaction(["projects", "schedule", "meta", "history"], "readonly");
        var projectsPromise = readAll(transaction.objectStore("projects"));
        var schedulePromise = readAll(transaction.objectStore("schedule"));
        var metaPromise = requestResult(transaction.objectStore("meta").get("state"));
        var historyPromise = readAll(transaction.objectStore("history"));
        return Promise.all([projectsPromise, schedulePromise, metaPromise, historyPromise, transactionDone(transaction)]).then(function (values) {
          var projects = values[0];
          var schedule = values[1];
          var meta = values[2] || null;
          var exists = Boolean(meta || projects.length || schedule.length);
          return {
            exists: exists,
            state: exists ? {
              schemaVersion: meta && meta.schemaVersion || 1,
              projects: projects,
              schedule: schedule,
              activity: meta && Array.isArray(meta.activity) ? meta.activity : [],
              hiddenDemoIds: meta && Array.isArray(meta.hiddenDemoIds) ? meta.hiddenDemoIds : [],
              updatedAt: meta && meta.updatedAt
            } : null,
            history: values[3]
          };
        });
      });
    }

    function write(value) {
      return open().then(function (db) {
        var payload = asObject(value);
        var state = asObject(payload.state);
        var transaction = db.transaction(["projects", "schedule", "meta", "history"], "readwrite");
        var projectsStore = transaction.objectStore("projects");
        var scheduleStore = transaction.objectStore("schedule");
        var historyStore = transaction.objectStore("history");
        projectsStore.clear();
        scheduleStore.clear();
        historyStore.clear();
        (Array.isArray(state.projects) ? state.projects : []).forEach(function (project) { projectsStore.put(clone(project)); });
        (Array.isArray(state.schedule) ? state.schedule : []).forEach(function (item) { scheduleStore.put(clone(item)); });
        (Array.isArray(payload.history) ? payload.history : []).forEach(function (entry) { historyStore.put(clone(entry)); });
        transaction.objectStore("meta").put({
          key: "state",
          schemaVersion: state.schemaVersion || 1,
          revision: Number(payload.revision) || 0,
          activity: clone(Array.isArray(state.activity) ? state.activity : []),
          hiddenDemoIds: clone(Array.isArray(state.hiddenDemoIds) ? state.hiddenDemoIds : []),
          updatedAt: state.updatedAt || new Date().toISOString(),
          migratedAt: payload.migratedAt || null
        });
        return transactionDone(transaction);
      });
    }

    function close() {
      if (database) { try { database.close(); } catch (error) { /* Best effort. */ } }
      database = null;
      openPromise = null;
    }

    return { open: open, read: read, write: write, close: close };
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

  function utf8ByteLength(value) {
    var text = String(value == null ? "" : value);
    var bytes = 0;
    for (var index = 0; index < text.length; index += 1) {
      var code = text.charCodeAt(index);
      if (code < 0x80) bytes += 1;
      else if (code < 0x800) bytes += 2;
      else if (code >= 0xD800 && code <= 0xDBFF && index + 1 < text.length && text.charCodeAt(index + 1) >= 0xDC00 && text.charCodeAt(index + 1) <= 0xDFFF) { bytes += 4; index += 1; }
      else bytes += 3;
    }
    return bytes;
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

  function creatorSnapshotError(code, message) {
    var error = new Error(message);
    error.code = code;
    return error;
  }

  function isSnapshotDemoRecord(value) {
    var source = asObject(value);
    var provenance = String(source.source || "").trim().toLowerCase();
    return source.isDemo === true || source.isSample === true || provenance === "sample" || provenance === "demo" || provenance === "local-template";
  }

  function validateSnapshotId(value, collection, seen) {
    var raw = String(value == null ? "" : value);
    var id = cleanText(raw, 160);
    if (!id) throw creatorSnapshotError("SNAPSHOT_ID_REQUIRED", "Bản ghi Creator trong " + collection + " thiếu ID.");
    if (raw.trim() !== id || raw.trim().length > 160) throw creatorSnapshotError("SNAPSHOT_ID_INVALID", "ID bản ghi Creator trong " + collection + " không hợp lệ.");
    if (seen.has(id)) throw creatorSnapshotError("SNAPSHOT_DUPLICATE_ID", "ID bản ghi Creator bị trùng trong " + collection + ".");
    seen.add(id);
    return id;
  }

  function createStore(options) {
    options = options || {};
    var resolved = resolveStorage(options.storage);
    var storage = resolved.storage;
    var metadataStorage = storage;
    var now = typeof options.now === "function" ? options.now : function () { return new Date(); };
    var subscribers = new Set();
    var lastError = null;
    var revision = 0;
    var migratedAt = null;
    var hydrated = false;
    var databaseReady = false;
    var pendingDatabasePayload = null;
    var databaseWritePromise = null;
    var dirtyProjectIds = new Set();
    var dirtyScheduleIds = new Set();
    var hiddenDemoIdsDirty = false;
    var fullStateDirty = false;
    var closePromise = null;

    function currentIso() {
      var value = now();
      var date = value instanceof Date ? value : new Date(value);
      return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
    }

    var legacyStored = null;
    try { legacyStored = safeParse(storage.getItem(STORAGE_KEY)); }
    catch (error) { lastError = error; }
    var existingManifest = null;
    try { existingManifest = safeParse(storage.getItem(MANIFEST_KEY)); }
    catch (error) { if (!lastError) lastError = error; }
    var state = legacyStored ? normalizeState(legacyStored, currentIso()) : initialState(currentIso());
    var history = Array.isArray(legacyStored && legacyStored.history) ? clone(legacyStored.history) : [];

    var database = options.database || null;
    var indexedDbFactory = options.indexedDB === false ? null : (options.indexedDB || globalScope.indexedDB || null);
    if (!database && indexedDbFactory && typeof indexedDbFactory.open === "function") {
      database = createIndexedDbDriver(indexedDbFactory, options.databaseName || DATABASE_NAME);
    }
    var usesDatabase = Boolean(database && typeof database.open === "function" && typeof database.read === "function" && typeof database.write === "function");
    var compatibilityStorage = !usesDatabase && resolved.kind === "adapter";
    var storageKind = usesDatabase ? "indexedDB-pending" : (compatibilityStorage ? "adapter" : "memory-fallback");

    function normalizeHistory(value) {
      var source = Array.isArray(value) ? value : [];
      var result = [];
      var counts = Object.create(null);
      source.forEach(function (entry) {
        var item = asObject(entry);
        var projectValue = asObject(item.project);
        var projectId = cleanText(item.projectId || projectValue.id, 160);
        if (!projectId || projectValue.isDemo === true || (counts[projectId] || 0) >= MAX_HISTORY_PER_PROJECT) return;
        var project = normalizeProject(projectValue, { nowIso: currentIso() });
        if (JSON.stringify(project).length > MAX_HISTORY_SNAPSHOT_BYTES) return;
        result.push({
          id: cleanText(item.id, 180) || uid("history", Date.parse(currentIso())),
          projectId: projectId,
          reason: cleanText(item.reason, 120) || "project-updated",
          at: isoDate(item.at, currentIso()),
          project: project
        });
        counts[projectId] = (counts[projectId] || 0) + 1;
      });
      return result;
    }
    history = normalizeHistory(history);

    function notify(action, detail) {
      var snapshot = clone(state);
      subscribers.forEach(function (listener) {
        try { listener(snapshot, { action: action, detail: clone(detail), storageKind: storageKind, revision: revision }); }
        catch (error) { /* Subscriber failures are isolated. */ }
      });
      return snapshot;
    }

    function backendStatus() {
      return {
        kind: storageKind,
        phase: storageKind === "indexedDB-pending" ? "hydrating" : (storageKind === "indexedDB" ? "ready" : "fallback"),
        hydrated: hydrated,
        revision: revision,
        migratedAt: migratedAt,
        lastError: lastError ? String(lastError.message || lastError) : null
      };
    }

    function manifestValue() {
      return {
        schemaVersion: 2,
        backend: storageKind,
        revision: revision,
        updatedAt: state.updatedAt,
        migratedAt: migratedAt,
        projectCount: state.projects.filter(function (project) { return !project.isDemo; }).length,
        scheduleCount: state.schedule.filter(function (item) { return !item.isDemo; }).length
      };
    }

    function writeManifest() {
      if (compatibilityStorage && !usesDatabase) return;
      try { metadataStorage.setItem(MANIFEST_KEY, JSON.stringify(manifestValue())); }
      catch (error) { lastError = error; }
    }

    function databasePayload() {
      return {
        state: clone(state),
        history: clone(history),
        revision: revision,
        migratedAt: migratedAt
      };
    }

    function switchToMemoryFallback(error) {
      if (error) lastError = error;
      databaseReady = false;
      pendingDatabasePayload = null;
      storageKind = "memory-fallback";
      compatibilityStorage = true;
      storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(Object.assign({}, state, { history: history })) });
      try { if (database && typeof database.close === "function") database.close(); } catch (closeError) { /* Best effort. */ }
      writeManifest();
      notify("storage-fallback", { error: lastError ? String(lastError.message || lastError) : "IndexedDB unavailable" });
    }

    function drainDatabaseWrites() {
      if (!databaseReady || storageKind !== "indexedDB") return Promise.resolve();
      if (databaseWritePromise) {
        return databaseWritePromise.then(function () { return drainDatabaseWrites(); });
      }
      if (!pendingDatabasePayload) return Promise.resolve();
      var payload = pendingDatabasePayload;
      pendingDatabasePayload = null;
      databaseWritePromise = Promise.resolve().then(function () { return database.write(payload); }).catch(function (error) {
        switchToMemoryFallback(error);
      }).then(function () {
        databaseWritePromise = null;
      });
      return databaseWritePromise.then(function () { return drainDatabaseWrites(); });
    }

    function scheduleDatabaseWrite() {
      if (!usesDatabase || storageKind === "memory-fallback") return;
      pendingDatabasePayload = databasePayload();
      if (databaseReady && storageKind === "indexedDB") drainDatabaseWrites();
    }

    function markDirty(action, detail) {
      var info = asObject(detail);
      if (info.projectId) dirtyProjectIds.add(String(info.projectId));
      (Array.isArray(info.projectIds) ? info.projectIds : []).forEach(function (id) { dirtyProjectIds.add(String(id)); });
      if (info.scheduleId) dirtyScheduleIds.add(String(info.scheduleId));
      (Array.isArray(info.scheduleIds) ? info.scheduleIds : []).forEach(function (id) { dirtyScheduleIds.add(String(id)); });
      if (action === "demo-hidden" || action === "demos-restored") hiddenDemoIdsDirty = true;
      if (action === "data-imported" && info.mode === "replace") fullStateDirty = true;
    }

    function persist(action, detail) {
      state.updatedAt = currentIso();
      if (action !== "store-ready") {
        revision += 1;
        if (!hydrated) markDirty(action, detail);
      }
      if (compatibilityStorage) {
        try {
          storage.setItem(STORAGE_KEY, JSON.stringify(Object.assign({}, state, { history: history })));
          if (storageKind !== "memory-fallback") lastError = null;
        } catch (error) {
          lastError = error;
          storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(Object.assign({}, state, { history: history })) });
          storageKind = "memory-fallback";
          compatibilityStorage = true;
        }
      } else {
        writeManifest();
        scheduleDatabaseWrite();
      }
      return notify(action, detail);
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

    function captureHistory(project, reason) {
      if (!project || project.isDemo || project.editable === false) return null;
      var snapshot = clone(project);
      if (JSON.stringify(snapshot).length > MAX_HISTORY_SNAPSHOT_BYTES) return null;
      var entry = {
        id: uid("history", Date.parse(currentIso())),
        projectId: project.id,
        reason: cleanText(reason, 120) || "project-updated",
        at: currentIso(),
        project: snapshot
      };
      history.unshift(entry);
      var seen = 0;
      history = history.filter(function (item) {
        if (item.projectId !== project.id) return true;
        seen += 1;
        return seen <= MAX_HISTORY_PER_PROJECT;
      });
      return entry;
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

    function updateProjectInternal(id, patch, historyReason) {
      var project = requireEditable(id);
      var nowIso = currentIso();
      var input = asObject(patch);
      captureHistory(project, historyReason || "project-updated");
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

    function updateProject(id, patch) {
      return updateProjectInternal(id, patch, "project-updated");
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
      return updateProjectInternal(projectId, { steps: nextSteps }, "step-updated:" + stepId);
    }

    function removeProject(id) {
      var project = requireEditable(id);
      captureHistory(project, "project-deleted");
      var removedScheduleIds = state.schedule.filter(function (item) { return item.projectId === id && !item.isDemo; }).map(function (item) { return item.id; });
      state.projects.splice(state.projects.indexOf(project), 1);
      state.schedule = state.schedule.filter(function (item) { return item.projectId !== id || item.isDemo; });
      record("project-deleted", id);
      persist("project-deleted", { projectId: id, scheduleIds: removedScheduleIds });
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
      persist("demo-hidden", { projectId: project ? id : null, scheduleIds: relatedScheduleIds, demoId: id });
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
      persist("demos-restored", { projectIds: SAMPLE_PROJECTS.map(function (item) { return item.id; }), scheduleIds: SAMPLE_SCHEDULE.map(function (item) { return item.id; }) });
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
      if (importOptions.mode && importOptions.mode !== "merge" && importOptions.mode !== "replace") {
        var invalidMode = new Error("Chế độ nhập phải là merge hoặc replace.");
        invalidMode.code = "INVALID_IMPORT_MODE";
        throw invalidMode;
      }
      if (typeof value === "string" && utf8ByteLength(value) > MAX_BACKUP_BYTES) {
        var tooLarge = new Error("Bản sao Creator vượt quá giới hạn 16 MiB.");
        tooLarge.code = "IMPORT_TOO_LARGE";
        throw tooLarge;
      }
      var payload = typeof value === "string" ? safeParse(value) : clone(value);
      if (!payload || payload.schema !== SCHEMA || payload.schemaVersion !== 1) {
        var invalid = new Error("Tệp không đúng định dạng HH Galaxy Creator Studio.");
        invalid.code = "INVALID_IMPORT";
        throw invalid;
      }
      if (!Array.isArray(payload.projects) || !Array.isArray(payload.schedule)) {
        var invalidCollections = new Error("Bản sao Creator phải có danh sách projects và schedule.");
        invalidCollections.code = "INVALID_IMPORT_COLLECTIONS";
        throw invalidCollections;
      }
      if (payload.projects.length > MAX_BACKUP_PROJECTS || payload.schedule.length > MAX_BACKUP_SCHEDULE) {
        var tooMany = new Error("Bản sao Creator vượt giới hạn bản ghi cho phép.");
        tooMany.code = "IMPORT_TOO_MANY_RECORDS";
        throw tooMany;
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
        if (index >= 0) { captureHistory(state.projects[index], "project-imported"); state.projects[index] = project; }
        else state.projects.unshift(project);
      });
      importedSchedule.forEach(function (item) {
        var index = state.schedule.findIndex(function (existing) { return existing.id === item.id && !existing.isDemo; });
        if (index >= 0) state.schedule[index] = item; else state.schedule.push(item);
      });
      record("data-imported", null);
      persist("data-imported", {
        mode: importOptions.mode === "replace" ? "replace" : "merge",
        projectIds: importedProjects.map(function (item) { return item.id; }),
        scheduleIds: importedSchedule.map(function (item) { return item.id; }),
        projectCount: importedProjects.length,
        scheduleCount: importedSchedule.length
      });
      return { projects: importedProjects.length, schedule: importedSchedule.length };
    }

    function exportAsync(exportOptions) {
      return readyPromise.then(function () { return flush(); }).then(function () {
        var json = exportJSON(exportOptions);
        if (utf8ByteLength(json) > MAX_BACKUP_BYTES) {
          var tooLarge = new Error("Bản sao Creator vượt quá giới hạn 16 MiB; hãy xuất từng nhóm dự án.");
          tooLarge.code = "EXPORT_TOO_LARGE";
          throw tooLarge;
        }
        return json;
      });
    }

    function importAsync(value, importOptions) {
      var mode = asObject(importOptions).mode || "merge";
      if (mode !== "merge" && mode !== "replace") {
        var invalidMode = new Error("Chế độ khôi phục phải là merge hoặc replace.");
        invalidMode.code = "INVALID_IMPORT_MODE";
        return Promise.reject(invalidMode);
      }
      return readyPromise.then(function () {
        var result = importJSON(value, { mode: mode });
        return flush().then(function (status) {
          return { projects: result.projects, schedule: result.schedule, mode: mode, storageKind: status.kind };
        });
      });
    }

    function parseValidatedSnapshot(value) {
      function requireCanonicalTimestamp(timestamp, code, label) {
        if (typeof timestamp !== "string" || isoDate(timestamp, null) !== timestamp) {
          throw creatorSnapshotError(code, label + " phải là timestamp ISO hợp lệ và đã chuẩn hóa.");
        }
      }

      function requirePreservedFields(source, normalized, prefix) {
        if (typeof source.source !== "string" || cleanText(source.source, 80) !== source.source || normalized.source !== source.source) {
          throw creatorSnapshotError(prefix + "_SOURCE_INVALID", "Nguồn dữ liệu trong snapshot Creator không hợp lệ.");
        }
        if (typeof source.editable !== "boolean" || normalized.editable !== source.editable) {
          throw creatorSnapshotError(prefix + "_EDITABLE_INVALID", "Trạng thái editable trong snapshot Creator không hợp lệ.");
        }
        requireCanonicalTimestamp(source.createdAt, prefix + "_CREATED_AT_INVALID", "createdAt");
        requireCanonicalTimestamp(source.updatedAt, prefix + "_UPDATED_AT_INVALID", "updatedAt");
      }

      var serialized;
      if (typeof value === "string") {
        serialized = value;
        if (utf8ByteLength(serialized) > MAX_BACKUP_BYTES) {
          throw creatorSnapshotError("SNAPSHOT_TOO_LARGE", "Snapshot Creator vượt quá giới hạn 16 MiB.");
        }
      } else {
        try { serialized = JSON.stringify(value); }
        catch (error) { throw creatorSnapshotError("SNAPSHOT_NOT_SERIALIZABLE", "Snapshot Creator không thể tuần tự hóa an toàn."); }
        if (!serialized || utf8ByteLength(serialized) > MAX_BACKUP_BYTES) {
          throw creatorSnapshotError("SNAPSHOT_TOO_LARGE", "Snapshot Creator vượt quá giới hạn 16 MiB.");
        }
      }
      var payload;
      try { payload = typeof value === "string" ? JSON.parse(value) : JSON.parse(serialized); }
      catch (error) { throw creatorSnapshotError("SNAPSHOT_JSON_INVALID", "Snapshot Creator không phải JSON hợp lệ."); }
      if (!payload || typeof payload !== "object" || Array.isArray(payload) || payload.schema !== SCHEMA) {
        throw creatorSnapshotError("SNAPSHOT_SCHEMA_INVALID", "Snapshot không đúng schema Creator Studio.");
      }
      if (payload.schemaVersion !== 1) {
        throw creatorSnapshotError("SNAPSHOT_VERSION_UNSUPPORTED", "Phiên bản snapshot Creator chưa được hỗ trợ.");
      }
      if (!Array.isArray(payload.projects) || !Array.isArray(payload.schedule)) {
        throw creatorSnapshotError("SNAPSHOT_COLLECTIONS_INVALID", "Snapshot Creator phải có danh sách projects và schedule.");
      }
      if (payload.projects.length > MAX_BACKUP_PROJECTS || payload.schedule.length > MAX_BACKUP_SCHEDULE) {
        throw creatorSnapshotError("SNAPSHOT_RECORD_LIMIT", "Snapshot Creator vượt giới hạn bản ghi cho phép.");
      }

      var excludedProjectIds = new Set();
      payload.projects.forEach(function (project) {
        var source = asObject(project);
        if (isSnapshotDemoRecord(source) || SAMPLE_PROJECTS.some(function (sample) { return String(source.id || "") === sample.id; })) {
          if (source.id != null) excludedProjectIds.add(String(source.id));
        }
      });
      var projectIds = new Set();
      var scheduleIds = new Set();
      var nowIso = currentIso();
      var projects = payload.projects.filter(function (project) {
        var source = asObject(project);
        return !isSnapshotDemoRecord(source) && !SAMPLE_PROJECTS.some(function (sample) { return String(source.id || "") === sample.id; });
      }).map(function (project) {
        if (!project || typeof project !== "object" || Array.isArray(project)) {
          throw creatorSnapshotError("SNAPSHOT_PROJECT_INVALID", "Mỗi project trong snapshot Creator phải là một đối tượng.");
        }
        var source = clone(project);
        source.id = validateSnapshotId(source.id, "projects", projectIds);
        source.isDemo = false;
        var normalized = normalizeProject(source, { nowIso: nowIso });
        requirePreservedFields(source, normalized, "SNAPSHOT_PROJECT");
        if (source.dueAt != null) requireCanonicalTimestamp(source.dueAt, "SNAPSHOT_PROJECT_DUE_AT_INVALID", "dueAt");
        if (!source.steps || typeof source.steps !== "object" || Array.isArray(source.steps)) {
          throw creatorSnapshotError("SNAPSHOT_PROJECT_STEPS_INVALID", "Project trong snapshot Creator thiếu pipeline hợp lệ.");
        }
        PIPELINE_STEPS.forEach(function (step) {
          var stepValue = asObject(source.steps[step.id]);
          requireCanonicalTimestamp(stepValue.updatedAt, "SNAPSHOT_STEP_UPDATED_AT_INVALID", "steps." + step.id + ".updatedAt");
        });
        return normalized;
      });
      var schedule = payload.schedule.filter(function (item) {
        var source = asObject(item);
        return !isSnapshotDemoRecord(source)
          && !SAMPLE_SCHEDULE.some(function (sample) { return String(source.id || "") === sample.id; })
          && !excludedProjectIds.has(String(source.projectId || ""));
      }).map(function (item) {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          throw creatorSnapshotError("SNAPSHOT_SCHEDULE_INVALID", "Mỗi mục lịch trong snapshot Creator phải là một đối tượng.");
        }
        var source = clone(item);
        source.id = validateSnapshotId(source.id, "schedule", scheduleIds);
        source.isDemo = false;
        var normalized = normalizeScheduleItem(source, nowIso);
        requirePreservedFields(source, normalized, "SNAPSHOT_SCHEDULE");
        if (source.at != null) requireCanonicalTimestamp(source.at, "SNAPSHOT_SCHEDULE_AT_INVALID", "schedule.at");
        return normalized;
      });
      return { projects: projects, schedule: schedule };
    }

    function replaceValidatedSnapshotAsync(value, replaceOptions) {
      var restoreOptions = asObject(replaceOptions);
      if (!Object.prototype.hasOwnProperty.call(restoreOptions, "audit") || typeof restoreOptions.audit !== "boolean") {
        return Promise.reject(creatorSnapshotError("SNAPSHOT_AUDIT_REQUIRED", "Phải chọn rõ audit=true hoặc audit=false khi thay snapshot Creator."));
      }
      return readyPromise.then(function () { return flush(); }).then(function () {
        var incoming = parseValidatedSnapshot(value);
        var previousState = clone(state);
        var previousHistory = clone(history);
        var previousRevision = revision;
        var previousLastError = lastError;
        var previousStorageKind = storageKind;
        var visibleDemoProjects = state.projects.filter(function (project) { return project.isDemo === true; }).map(clone);
        var visibleDemoSchedule = state.schedule.filter(function (item) { return item.isDemo === true; }).map(clone);
        var auditReason = cleanText(restoreOptions.auditReason, 120) || "validated-snapshot-replace";

        state.projects = incoming.projects.map(clone).concat(visibleDemoProjects);
        state.schedule = visibleDemoSchedule.concat(incoming.schedule.map(clone));
        state.hiddenDemoIds = clone(previousState.hiddenDemoIds);
        state.activity = clone(previousState.activity);
        state.updatedAt = currentIso();
        if (restoreOptions.audit) record("validated-snapshot-replaced", auditReason);
        revision += 1;

        function restoreLiveMirror(error) {
          state = previousState;
          history = previousHistory;
          revision = previousRevision;
          lastError = error || previousLastError;
          pendingDatabasePayload = null;
          if (compatibilityStorage) {
            try { storage.setItem(STORAGE_KEY, JSON.stringify(Object.assign({}, state, { history: history }))); }
            catch (storageError) { if (!error) error = storageError; }
          }
          writeManifest();
          throw error;
        }

        if (compatibilityStorage) {
          try {
            storage.setItem(STORAGE_KEY, JSON.stringify(Object.assign({}, state, { history: history })));
            if (storageKind !== "memory-fallback") lastError = null;
          } catch (error) {
            return restoreLiveMirror(creatorSnapshotError("SNAPSHOT_PERSIST_FAILED", "Không thể lưu snapshot Creator đã xác thực."));
          }
          writeManifest();
          notify("validated-snapshot-replaced", { audit: restoreOptions.audit, auditReason: restoreOptions.audit ? auditReason : null, projectCount: incoming.projects.length, scheduleCount: incoming.schedule.length });
          return {
            projects: incoming.projects.length,
            schedule: incoming.schedule.length,
            audit: restoreOptions.audit,
            auditReason: restoreOptions.audit ? auditReason : null,
            storageKind: storageKind
          };
        }

        writeManifest();
        pendingDatabasePayload = databasePayload();
        return drainDatabaseWrites().then(function () {
          if (previousStorageKind === "indexedDB" && storageKind !== "indexedDB") {
            throw creatorSnapshotError("SNAPSHOT_PERSIST_FAILED", "IndexedDB không thể lưu snapshot Creator đã xác thực.");
          }
          notify("validated-snapshot-replaced", { audit: restoreOptions.audit, auditReason: restoreOptions.audit ? auditReason : null, projectCount: incoming.projects.length, scheduleCount: incoming.schedule.length });
          return {
            projects: incoming.projects.length,
            schedule: incoming.schedule.length,
            audit: restoreOptions.audit,
            auditReason: restoreOptions.audit ? auditReason : null,
            storageKind: storageKind
          };
        }).catch(function (error) {
          return restoreLiveMirror(error && error.code ? error : creatorSnapshotError("SNAPSHOT_PERSIST_FAILED", "Không thể lưu snapshot Creator đã xác thực."));
        });
      });
    }

    function listHistory(projectId) {
      return history.filter(function (entry) { return !projectId || entry.projectId === projectId; }).map(clone);
    }

    function restoreVersion(projectId, versionId) {
      var entry = history.find(function (item) { return item.projectId === projectId && item.id === versionId; });
      if (!entry) {
        var missing = new Error("Không tìm thấy phiên bản cần khôi phục.");
        missing.code = "VERSION_NOT_FOUND";
        throw missing;
      }
      var current = findProject(projectId);
      if (current) requireEditable(projectId);
      if (current) captureHistory(current, "before-version-restore");
      var restored = normalizeProject(Object.assign({}, clone(entry.project), {
        id: projectId,
        isDemo: false,
        editable: true,
        updatedAt: currentIso()
      }), { nowIso: currentIso() });
      if (current) state.projects[state.projects.indexOf(current)] = restored;
      else state.projects.unshift(restored);
      record("version-restored", projectId);
      persist("version-restored", { projectId: projectId, versionId: versionId });
      return clone(restored);
    }

    function subscribe(listener) {
      if (typeof listener !== "function") return function () {};
      subscribers.add(listener);
      return function () { subscribers.delete(listener); };
    }

    function mergeActivities(primary, secondary) {
      var result = [];
      var ids = new Set();
      (Array.isArray(primary) ? primary : []).concat(Array.isArray(secondary) ? secondary : []).forEach(function (item) {
        if (!item || typeof item !== "object") return;
        var id = cleanText(item.id, 180) || [item.action, item.entityId, item.at].join(":");
        if (ids.has(id)) return;
        ids.add(id);
        result.push(clone(item));
      });
      return result.sort(function (left, right) { return String(right.at || "").localeCompare(String(left.at || "")); }).slice(0, MAX_ACTIVITY);
    }

    function copyMissing(baseValue, legacyValue) {
      var base = normalizeState(baseValue || initialState(currentIso()), currentIso());
      if (!legacyValue) return base;
      var legacy = normalizeState(legacyValue, currentIso());
      legacy.projects.forEach(function (project) {
        if (!base.projects.some(function (item) { return item.id === project.id; })) base.projects.push(clone(project));
      });
      legacy.schedule.forEach(function (item) {
        if (!base.schedule.some(function (entry) { return entry.id === item.id; })) base.schedule.push(clone(item));
      });
      base.hiddenDemoIds = Array.from(new Set(base.hiddenDemoIds.concat(legacy.hiddenDemoIds)));
      base.activity = mergeActivities(base.activity, legacy.activity);
      base.projects = base.projects.filter(function (project) { return base.hiddenDemoIds.indexOf(project.id) === -1; });
      base.schedule = base.schedule.filter(function (item) { return base.hiddenDemoIds.indexOf(item.id) === -1 && base.hiddenDemoIds.indexOf(item.projectId) === -1; });
      return base;
    }

    function overlayDirty(base, current) {
      if (fullStateDirty) return normalizeState(current, currentIso());
      dirtyProjectIds.forEach(function (id) {
        base.projects = base.projects.filter(function (item) { return item.id !== id; });
        var local = current.projects.find(function (item) { return item.id === id; });
        if (local) base.projects.unshift(clone(local));
      });
      dirtyScheduleIds.forEach(function (id) {
        base.schedule = base.schedule.filter(function (item) { return item.id !== id; });
        var local = current.schedule.find(function (item) { return item.id === id; });
        if (local) base.schedule.push(clone(local));
      });
      if (hiddenDemoIdsDirty) {
        base.hiddenDemoIds = clone(current.hiddenDemoIds);
        base.projects = base.projects.filter(function (project) { return base.hiddenDemoIds.indexOf(project.id) === -1; });
        base.schedule = base.schedule.filter(function (item) { return base.hiddenDemoIds.indexOf(item.id) === -1 && base.hiddenDemoIds.indexOf(item.projectId) === -1; });
      }
      base.activity = mergeActivities(current.activity, base.activity);
      base.updatedAt = current.updatedAt;
      return normalizeState(base, currentIso());
    }

    function mergeHistory(primary, secondary) {
      var seen = new Set();
      return normalizeHistory((Array.isArray(primary) ? primary : []).concat(Array.isArray(secondary) ? secondary : []).filter(function (entry) {
        var id = cleanText(asObject(entry).id, 180);
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      }).sort(function (left, right) { return String(asObject(right).at || "").localeCompare(String(asObject(left).at || "")); }));
    }

    var readyPromise;
    if (usesDatabase) {
      readyPromise = Promise.resolve().then(function () { return database.open(); }).then(function () { return database.read(); }).then(function (result) {
        var databaseState = result && result.exists && result.state ? result.state : null;
        var base = databaseState ? copyMissing(databaseState, legacyStored) : normalizeState(legacyStored || state, currentIso());
        var localBeforeHydration = clone(state);
        state = overlayDirty(base, localBeforeHydration);
        history = mergeHistory(result && result.history, history);
        migratedAt = legacyStored ? (asObject(existingManifest).migratedAt || currentIso()) : null;
        hydrated = true;
        databaseReady = true;
        storageKind = "indexedDB";
        dirtyProjectIds.clear();
        dirtyScheduleIds.clear();
        hiddenDemoIdsDirty = false;
        fullStateDirty = false;
        writeManifest();
        pendingDatabasePayload = databasePayload();
        return drainDatabaseWrites().then(function () {
          lastError = null;
          notify("hydrated", { migrated: Boolean(legacyStored), storageKind: storageKind });
          return backendStatus();
        });
      }).catch(function (error) {
        hydrated = true;
        switchToMemoryFallback(error);
        return backendStatus();
      });
    } else {
      hydrated = true;
      readyPromise = Promise.resolve(backendStatus());
    }

    function flush() {
      return readyPromise.then(function () { return drainDatabaseWrites(); }).then(function () { return backendStatus(); });
    }

    function close() {
      if (closePromise) return closePromise;
      subscribers.clear();
      closePromise = Promise.resolve(readyPromise).catch(function () { return null; }).then(function () {
        return drainDatabaseWrites().catch(function () { return null; });
      }).then(function () {
        if (database && typeof database.close === "function") database.close();
        databaseReady = false;
        return true;
      });
      return closePromise;
    }

    function getSnapshot() { return clone(state); }
    function getProject(id) { var project = findProject(id); return project ? clone(project) : null; }
    function getStats(referenceDate) { return buildStats(state, referenceDate); }

    if (options.persistInitial !== false) persist("store-ready", {});

    return Object.freeze({
      storageKey: STORAGE_KEY,
      manifestKey: MANIFEST_KEY,
      storageKind: function () { return storageKind; },
      backendStatus: backendStatus,
      lastError: function () { return lastError; },
      ready: function () { return readyPromise; },
      flush: flush,
      close: close,
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
      exportAsync: exportAsync,
      importAsync: importAsync,
      replaceValidatedSnapshotAsync: replaceValidatedSnapshotAsync,
      listHistory: listHistory,
      restoreVersion: restoreVersion,
      subscribe: subscribe
    });
  }

  return Object.freeze({
    VERSION: VERSION,
    SCHEMA: SCHEMA,
    STORAGE_KEY: STORAGE_KEY,
    MANIFEST_KEY: MANIFEST_KEY,
    DATABASE_NAME: DATABASE_NAME,
    DATABASE_VERSION: DATABASE_VERSION,
    MAX_HISTORY_PER_PROJECT: MAX_HISTORY_PER_PROJECT,
    BACKUP_LIMITS: Object.freeze({ maxBytes: MAX_BACKUP_BYTES, maxProjects: MAX_BACKUP_PROJECTS, maxSchedule: MAX_BACKUP_SCHEDULE }),
    PIPELINE_STEPS: PIPELINE_STEPS,
    STEP_STATUSES: STEP_STATUSES,
    SAMPLE_PROJECTS: SAMPLE_PROJECTS,
    SAMPLE_SCHEDULE: SAMPLE_SCHEDULE,
    memoryStorage: memoryStorage,
    memoryDatabase: memoryDatabase,
    createIndexedDbDriver: createIndexedDbDriver,
    normalizeProject: normalizeProject,
    normalizeState: normalizeState,
    progressOf: progressOf,
    buildStats: buildStats,
    createStore: createStore
  });
});
