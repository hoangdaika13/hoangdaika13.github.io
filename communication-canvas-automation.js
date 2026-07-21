(function (globalScope, factory) {
  "use strict";
  const api = factory(globalScope);
  if (typeof module === "object" && module.exports) module.exports = api;
  globalScope.HHCommunicationCanvasAutomation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (globalScope) {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "hh.communication.canvas.v1";
  const SUPPORTED_VIEWS = Object.freeze(["shared-canvas", "automation", "hh-spaces"]);
  const PRESENCE_STATES = Object.freeze(["available", "mixing", "designing", "studying", "dnd"]);
  const PRESENCE_LABELS = Object.freeze({
    available: "Sẵn sàng",
    mixing: "Đang Mix nhạc",
    designing: "Đang thiết kế",
    studying: "Đang học",
    dnd: "Không muốn làm phiền"
  });
  const TARGETS = Object.freeze(["task", "project", "wiki"]);
  const instances = typeof WeakMap === "function" ? new WeakMap() : new Map();

  const clone = (value) => {
    if (value == null) return value;
    if (typeof structuredClone === "function") {
      try { return structuredClone(value); } catch (_) { /* JSON fallback */ }
    }
    return JSON.parse(JSON.stringify(value));
  };

  const escapeHtml = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const cleanText = (value, max = 1000) => String(value == null ? "" : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);

  const makeId = (prefix) => {
    if (globalScope.crypto && typeof globalScope.crypto.randomUUID === "function") {
      return `${prefix}-${globalScope.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  };

  const safeIso = (value, fallback) => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
  };

  const bounded = (items, limit) => Array.isArray(items) ? items.slice(-limit) : [];
  const uniqueText = (items, maxItems, maxLength = 100) => Array.from(new Set(
    (Array.isArray(items) ? items : []).map((item) => cleanText(item, maxLength)).filter(Boolean)
  )).slice(0, maxItems);

  function defaultState(now = () => new Date().toISOString(), idFactory = makeId) {
    const createdAt = now();
    const spaceId = idFactory("canvas");
    const roomId = idFactory("room");
    return {
      version: VERSION,
      updatedAt: createdAt,
      canvas: {
        activeSpaceId: spaceId,
        spaces: [{
          id: spaceId,
          title: "Bảng làm việc chung",
          description: "Ghi chú, quyết định và việc cần làm của nhóm trên thiết bị này.",
          items: [],
          assignees: [],
          selectedItemId: "",
          createdAt,
          updatedAt: createdAt
        }]
      },
      automation: {
        draft: "",
        preview: null,
        rules: [{
          id: idFactory("rule"),
          name: "Tin nhắn #task → công việc",
          trigger: "#task",
          action: "task",
          enabled: false,
          createdAt
        }],
        logs: []
      },
      hhSpaces: {
        presence: "available",
        capsules: [],
        catchUps: [],
        activeRoomId: roomId,
        rooms: [{
          id: roomId,
          title: "Creative Room",
          sourceUrl: "",
          playback: { currentTime: 0, playing: false, updatedAt: createdAt },
          comments: [],
          createdAt
        }],
        circles: []
      }
    };
  }

  function normalizeItem(value, now, idFactory) {
    const source = value && typeof value === "object" ? value : {};
    const type = ["note", "checklist", "file", "decision"].includes(source.type) ? source.type : "note";
    const status = type === "decision"
      ? (["proposed", "accepted", "rejected"].includes(source.status) ? source.status : "proposed")
      : "";
    return {
      id: cleanText(source.id, 120) || idFactory(type),
      type,
      title: cleanText(source.title || (type === "file" ? source.name : "Mục chưa đặt tên"), 180),
      body: cleanText(source.body, 5000),
      completed: type === "checklist" ? Boolean(source.completed) : false,
      status,
      assigneeId: cleanText(source.assigneeId, 120),
      tags: uniqueText(source.tags, 12, 40),
      file: type === "file" ? {
        name: cleanText(source.file?.name || source.name, 240),
        type: cleanText(source.file?.type, 120),
        size: Math.max(0, Math.min(100000000000, Number(source.file?.size) || 0)),
        lastModified: Math.max(0, Number(source.file?.lastModified) || 0)
      } : null,
      createdAt: safeIso(source.createdAt, now()),
      updatedAt: safeIso(source.updatedAt, now())
    };
  }

  function normalizeState(input, options = {}) {
    const now = options.now || (() => new Date().toISOString());
    const idFactory = options.idFactory || makeId;
    const fallback = defaultState(now, idFactory);
    if (!input || typeof input !== "object" || Number(input.version) !== VERSION) return fallback;
    const rawSpaces = Array.isArray(input.canvas?.spaces) ? input.canvas.spaces : [];
    const spaces = rawSpaces.slice(0, 20).map((space) => {
      const id = cleanText(space?.id, 120) || idFactory("canvas");
      const assignees = bounded(space?.assignees, 60).map((person) => ({
        id: cleanText(person?.id, 120) || idFactory("person"),
        name: cleanText(person?.name || "Thành viên", 100),
        role: cleanText(person?.role || "Thành viên", 80)
      }));
      const items = bounded(space?.items, 500).map((item) => normalizeItem(item, now, idFactory));
      return {
        id,
        title: cleanText(space?.title || "Bảng làm việc chung", 180),
        description: cleanText(space?.description, 1000),
        items,
        assignees,
        selectedItemId: items.some((item) => item.id === space?.selectedItemId) ? space.selectedItemId : "",
        createdAt: safeIso(space?.createdAt, now()),
        updatedAt: safeIso(space?.updatedAt, now())
      };
    });
    if (!spaces.length) spaces.push(fallback.canvas.spaces[0]);

    const rules = bounded(input.automation?.rules, 100).map((rule) => ({
      id: cleanText(rule?.id, 120) || idFactory("rule"),
      name: cleanText(rule?.name || "Quy tắc", 180),
      trigger: cleanText(rule?.trigger, 120),
      action: TARGETS.includes(rule?.action) || ["poll", "meeting", "music"].includes(rule?.action) ? rule.action : "task",
      enabled: Boolean(rule?.enabled),
      createdAt: safeIso(rule?.createdAt, now())
    }));
    const logs = bounded(input.automation?.logs, 200).map((entry) => ({
      id: cleanText(entry?.id, 120) || idFactory("log"),
      label: cleanText(entry?.label, 240),
      status: ["preview", "executed", "blocked"].includes(entry?.status) ? entry.status : "blocked",
      createdAt: safeIso(entry?.createdAt, now())
    }));

    const rooms = bounded(input.hhSpaces?.rooms, 30).map((room) => ({
      id: cleanText(room?.id, 120) || idFactory("room"),
      title: cleanText(room?.title || "Creative Room", 180),
      sourceUrl: cleanText(room?.sourceUrl, 1000),
      playback: {
        currentTime: Math.max(0, Math.min(86400, Number(room?.playback?.currentTime) || 0)),
        playing: Boolean(room?.playback?.playing),
        updatedAt: safeIso(room?.playback?.updatedAt, now())
      },
      comments: bounded(room?.comments, 300).map((comment) => ({
        id: cleanText(comment?.id, 120) || idFactory("comment"),
        author: cleanText(comment?.author || "Bạn", 100),
        body: cleanText(comment?.body, 1200),
        timestamp: Math.max(0, Math.min(86400, Number(comment?.timestamp) || 0)),
        createdAt: safeIso(comment?.createdAt, now())
      })),
      createdAt: safeIso(room?.createdAt, now())
    }));
    if (!rooms.length) rooms.push(fallback.hhSpaces.rooms[0]);

    const normalizeDraft = (draft) => ({
      id: cleanText(draft?.id, 120) || idFactory("draft"),
      kind: ["summary", "task", "wiki", "project"].includes(draft?.kind) ? draft.kind : "summary",
      title: cleanText(draft?.title || "Bản nháp", 180),
      body: cleanText(draft?.body, 5000),
      sourceLabel: cleanText(draft?.sourceLabel || "Tóm tắt cục bộ", 80),
      createdAt: safeIso(draft?.createdAt, now())
    });

    return {
      version: VERSION,
      updatedAt: safeIso(input.updatedAt, now()),
      canvas: {
        activeSpaceId: spaces.some((space) => space.id === input.canvas?.activeSpaceId) ? input.canvas.activeSpaceId : spaces[0].id,
        spaces
      },
      automation: {
        draft: cleanText(input.automation?.draft, 3000),
        preview: input.automation?.preview && typeof input.automation.preview === "object" ? {
          type: cleanText(input.automation.preview.type, 40),
          label: cleanText(input.automation.preview.label, 240),
          payload: cleanText(input.automation.preview.payload, 3000)
        } : null,
        rules,
        logs
      },
      hhSpaces: {
        presence: PRESENCE_STATES.includes(input.hhSpaces?.presence) ? input.hhSpaces.presence : "available",
        capsules: bounded(input.hhSpaces?.capsules, 100).map(normalizeDraft),
        catchUps: bounded(input.hhSpaces?.catchUps, 100).map(normalizeDraft),
        activeRoomId: rooms.some((room) => room.id === input.hhSpaces?.activeRoomId) ? input.hhSpaces.activeRoomId : rooms[0].id,
        rooms,
        circles: bounded(input.hhSpaces?.circles, 60).map((circle) => ({
          id: cleanText(circle?.id, 120) || idFactory("circle"),
          name: cleanText(circle?.name || "Focus Circle", 140),
          focus: cleanText(circle?.focus, 400),
          members: uniqueText(circle?.members, 30, 100),
          createdAt: safeIso(circle?.createdAt, now())
        }))
      }
    };
  }

  function getDefaultStorage() {
    try { return globalScope.localStorage || null; } catch (_) { return null; }
  }

  function createStore(options = {}) {
    const now = options.now || (() => new Date().toISOString());
    const idFactory = options.idFactory || makeId;
    const storage = Object.prototype.hasOwnProperty.call(options, "storage") ? options.storage : getDefaultStorage();
    const listeners = new Set();
    let persistenceError = "";
    let initial = null;
    if (storage) {
      try { initial = JSON.parse(storage.getItem(STORAGE_KEY) || "null"); }
      catch (error) { persistenceError = cleanText(error?.message || "Không đọc được dữ liệu cục bộ.", 240); }
    }
    let state = normalizeState(initial, { now, idFactory });

    function persist() {
      state.updatedAt = now();
      if (!storage) return;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
        persistenceError = "";
      } catch (error) {
        persistenceError = cleanText(error?.message || "Không lưu được dữ liệu cục bộ.", 240);
      }
    }

    function notify(reason) {
      const snapshot = clone(state);
      listeners.forEach((listener) => listener(snapshot, reason));
    }

    function commit(reason, mutate) {
      mutate(state);
      state = normalizeState(state, { now, idFactory });
      persist();
      notify(reason);
      return clone(state);
    }

    function activeSpace() {
      return state.canvas.spaces.find((space) => space.id === state.canvas.activeSpaceId) || state.canvas.spaces[0];
    }

    function activeRoom() {
      return state.hhSpaces.rooms.find((room) => room.id === state.hhSpaces.activeRoomId) || state.hhSpaces.rooms[0];
    }

    function addCanvasItem(type, input = {}) {
      if (!["note", "checklist", "file", "decision"].includes(type)) throw new Error("Loại mục Canvas không hợp lệ.");
      const item = normalizeItem({ ...input, type, id: idFactory(type), createdAt: now(), updatedAt: now() }, now, idFactory);
      commit("canvas:item-added", (draft) => {
        const space = draft.canvas.spaces.find((entry) => entry.id === draft.canvas.activeSpaceId);
        space.items.push(item);
        space.selectedItemId = item.id;
        space.updatedAt = now();
      });
      return clone(item);
    }

    function addFileMetadata(file) {
      if (!file || typeof file !== "object") throw new Error("Tệp không hợp lệ.");
      return addCanvasItem("file", {
        title: cleanText(file.name || "Tệp", 240),
        file: { name: file.name, type: file.type, size: file.size, lastModified: file.lastModified },
        body: "Chỉ lưu metadata trên thiết bị; nội dung tệp không được đưa vào localStorage."
      });
    }

    function updateItem(itemId, patch = {}) {
      let output = null;
      commit("canvas:item-updated", (draft) => {
        const space = draft.canvas.spaces.find((entry) => entry.id === draft.canvas.activeSpaceId);
        const index = space.items.findIndex((item) => item.id === itemId);
        if (index < 0) throw new Error("Không tìm thấy mục Canvas.");
        output = normalizeItem({ ...space.items[index], ...patch, id: itemId, updatedAt: now() }, now, idFactory);
        space.items[index] = output;
        space.updatedAt = now();
      });
      return clone(output);
    }

    function selectItem(itemId) {
      commit("canvas:item-selected", (draft) => {
        const space = draft.canvas.spaces.find((entry) => entry.id === draft.canvas.activeSpaceId);
        space.selectedItemId = space.items.some((item) => item.id === itemId) ? itemId : "";
      });
    }

    function removeItem(itemId) {
      commit("canvas:item-removed", (draft) => {
        const space = draft.canvas.spaces.find((entry) => entry.id === draft.canvas.activeSpaceId);
        space.items = space.items.filter((item) => item.id !== itemId);
        if (space.selectedItemId === itemId) space.selectedItemId = "";
        space.updatedAt = now();
      });
    }

    function addAssignee(name, role) {
      const person = { id: idFactory("person"), name: cleanText(name, 100), role: cleanText(role || "Thành viên", 80) };
      if (!person.name) throw new Error("Hãy nhập tên thành viên.");
      commit("canvas:assignee-added", (draft) => {
        const space = draft.canvas.spaces.find((entry) => entry.id === draft.canvas.activeSpaceId);
        space.assignees.push(person);
      });
      return clone(person);
    }

    function selectedDraft(target) {
      if (!TARGETS.includes(target)) throw new Error("Đích chuyển đổi không hợp lệ.");
      const space = activeSpace();
      const item = space.items.find((entry) => entry.id === space.selectedItemId);
      if (!item) throw new Error("Hãy chọn một mục trước khi chuyển đổi.");
      return {
        target,
        source: "shared-canvas",
        sourceId: item.id,
        spaceId: space.id,
        title: item.title,
        body: item.body,
        assigneeId: item.assigneeId,
        tags: clone(item.tags),
        createdAt: now()
      };
    }

    function addRule(input = {}) {
      const rule = {
        id: idFactory("rule"),
        name: cleanText(input.name || "Quy tắc mới", 180),
        trigger: cleanText(input.trigger, 120),
        action: TARGETS.includes(input.action) || ["poll", "meeting", "music"].includes(input.action) ? input.action : "task",
        enabled: false,
        createdAt: now()
      };
      if (!rule.trigger) throw new Error("Hãy nhập điều kiện kích hoạt.");
      commit("automation:rule-added", (draft) => draft.automation.rules.push(rule));
      return clone(rule);
    }

    function toggleRule(ruleId, enabled) {
      commit("automation:rule-toggled", (draft) => {
        const rule = draft.automation.rules.find((entry) => entry.id === ruleId);
        if (!rule) throw new Error("Không tìm thấy quy tắc.");
        rule.enabled = Boolean(enabled);
      });
    }

    function setAutomationDraft(value) {
      commit("automation:draft", (draft) => { draft.automation.draft = cleanText(value, 3000); });
    }

    function setPreview(preview) {
      commit("automation:preview", (draft) => { draft.automation.preview = preview ? clone(preview) : null; });
    }

    function logAutomation(label, status) {
      commit("automation:log", (draft) => {
        draft.automation.logs.push({ id: idFactory("log"), label: cleanText(label, 240), status, createdAt: now() });
      });
    }

    function addCapsule(draftValue, bucket = "capsules") {
      const normalized = {
        id: idFactory(bucket === "catchUps" ? "catchup" : "capsule"),
        kind: ["summary", "task", "wiki", "project"].includes(draftValue.kind) ? draftValue.kind : "summary",
        title: cleanText(draftValue.title || "Bản nháp", 180),
        body: cleanText(draftValue.body, 5000),
        sourceLabel: cleanText(draftValue.sourceLabel || "Tóm tắt cục bộ", 80),
        createdAt: now()
      };
      commit(`spaces:${bucket}-added`, (draft) => { draft.hhSpaces[bucket].push(normalized); });
      return clone(normalized);
    }

    function setPresence(value) {
      if (!PRESENCE_STATES.includes(value)) throw new Error("Trạng thái hiện diện không hợp lệ.");
      commit("spaces:presence", (draft) => { draft.hhSpaces.presence = value; });
    }

    function updatePlayback(patch = {}) {
      let output;
      commit("spaces:playback", (draft) => {
        const room = draft.hhSpaces.rooms.find((entry) => entry.id === draft.hhSpaces.activeRoomId);
        if (Object.prototype.hasOwnProperty.call(patch, "sourceUrl")) room.sourceUrl = cleanText(patch.sourceUrl, 1000);
        if (Object.prototype.hasOwnProperty.call(patch, "playing")) room.playback.playing = Boolean(patch.playing);
        if (Object.prototype.hasOwnProperty.call(patch, "currentTime")) room.playback.currentTime = Math.max(0, Math.min(86400, Number(patch.currentTime) || 0));
        room.playback.updatedAt = now();
        output = clone(room.playback);
      });
      return output;
    }

    function addTimestampComment(body, timestamp, author = "Bạn") {
      const comment = { id: idFactory("comment"), author: cleanText(author, 100), body: cleanText(body, 1200), timestamp: Math.max(0, Math.min(86400, Number(timestamp) || 0)), createdAt: now() };
      if (!comment.body) throw new Error("Hãy nhập bình luận.");
      commit("spaces:comment-added", (draft) => {
        const room = draft.hhSpaces.rooms.find((entry) => entry.id === draft.hhSpaces.activeRoomId);
        room.comments.push(comment);
      });
      return clone(comment);
    }

    function addCircle(input = {}) {
      const circle = { id: idFactory("circle"), name: cleanText(input.name || "Focus Circle", 140), focus: cleanText(input.focus, 400), members: uniqueText(input.members, 30, 100), createdAt: now() };
      commit("spaces:circle-added", (draft) => draft.hhSpaces.circles.push(circle));
      return clone(circle);
    }

    persist();
    return {
      getState: () => clone(state),
      getActiveSpace: () => clone(activeSpace()),
      getActiveRoom: () => clone(activeRoom()),
      getPersistence: () => ({ type: storage ? "localStorage" : "memory", key: STORAGE_KEY, version: VERSION, error: persistenceError }),
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      addCanvasItem,
      addFileMetadata,
      updateItem,
      selectItem,
      removeItem,
      addAssignee,
      selectedDraft,
      addRule,
      toggleRule,
      setAutomationDraft,
      setPreview,
      logAutomation,
      addCapsule,
      setPresence,
      updatePlayback,
      addTimestampComment,
      addCircle
    };
  }

  function parseSlashCommand(value) {
    const raw = cleanText(value, 3000);
    const match = raw.match(/^\/(poll|task|meeting|music)(?:\s+([\s\S]*))?$/i);
    if (!match) return { valid: false, type: "", payload: raw, label: "Không nhận diện được lệnh. Dùng /poll, /task, /meeting hoặc /music." };
    const type = match[1].toLowerCase();
    const payload = cleanText(match[2], 2800);
    const labels = { poll: "Tạo khảo sát", task: "Tạo công việc", meeting: "Tạo lịch hẹn", music: "Gửi nội dung âm nhạc" };
    return { valid: Boolean(payload), type, payload, label: payload ? `${labels[type]}: ${payload}` : `Lệnh ${match[1]} cần nội dung.` };
  }

  function evaluateRules(rules, value, options = {}) {
    const message = cleanText(value, 3000);
    if (!message) return [];
    const folded = message.toLocaleLowerCase("vi");
    return (Array.isArray(rules) ? rules : []).filter((rule) => {
      if (!options.includeDisabled && !rule?.enabled) return false;
      const trigger = cleanText(rule?.trigger, 120).toLocaleLowerCase("vi");
      return Boolean(trigger) && folded.includes(trigger);
    }).map((rule) => ({
      ruleId: cleanText(rule.id, 120),
      type: cleanText(rule.action, 40),
      payload: message,
      label: `${cleanText(rule.name || "Quy tắc", 180)}: ${message}`
    }));
  }

  function localSummary(value, maxSentences = 4) {
    const text = cleanText(value, 12000);
    if (!text) return "Chưa có nội dung để tóm tắt.";
    const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((entry) => entry.trim()).filter(Boolean);
    return sentences.slice(0, maxSentences).join(" ").slice(0, 1800);
  }

  function buildLocalDraft(value, kind = "summary") {
    const text = cleanText(value, 12000);
    const firstLine = cleanText(text.split(/\n|[.!?]/)[0], 120) || "Nội dung cuộc trò chuyện";
    const tasks = text.split(/\n+/).filter((line) => /#task|\b(?:cần|todo|việc)\b/i.test(line)).slice(0, 8);
    const body = kind === "task"
      ? (tasks.length ? tasks.map((line) => `- [ ] ${cleanText(line.replace(/#task/ig, ""), 300)}`).join("\n") : `- [ ] ${localSummary(text, 2)}`)
      : kind === "wiki"
        ? `## Bối cảnh\n${localSummary(text, 4)}\n\n## Điểm cần lưu\n${tasks.map((line) => `- ${cleanText(line, 300)}`).join("\n") || "- Chưa phát hiện mục hành động rõ ràng."}`
        : kind === "project"
          ? `Mục tiêu: ${firstLine}\nPhạm vi: ${localSummary(text, 3)}\nViệc khởi đầu:\n${tasks.map((line) => `- ${cleanText(line, 300)}`).join("\n") || "- Xác định người phụ trách và thời hạn."}`
          : localSummary(text, 5);
    return { kind, title: kind === "summary" ? `Tóm tắt: ${firstLine}` : `${kind === "task" ? "Công việc" : kind === "wiki" ? "Wiki" : "Dự án"}: ${firstLine}`, body, sourceLabel: "Tóm tắt cục bộ" };
  }

  async function buildSmartDraft(value, kind, aiAdapter) {
    if (aiAdapter && typeof aiAdapter.summarize === "function") {
      try {
        const result = await aiAdapter.summarize({ text: cleanText(value, 12000), kind });
        if (result && cleanText(result.body, 5000)) {
          return {
            kind,
            title: cleanText(result.title || "Bản nháp AI máy chủ", 180),
            body: cleanText(result.body, 5000),
            sourceLabel: cleanText(result.sourceLabel || "AI máy chủ", 80)
          };
        }
      } catch (_) { /* Explicit local fallback below. */ }
    }
    return buildLocalDraft(value, kind);
  }

  function emit(name, detail) {
    if (typeof globalScope.dispatchEvent !== "function" || typeof globalScope.CustomEvent !== "function") return false;
    globalScope.dispatchEvent(new globalScope.CustomEvent(name, { detail: clone(detail) }));
    return true;
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function formatBytes(value) {
    const size = Math.max(0, Number(value) || 0);
    if (size < 1024) return `${size} B`;
    if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1048576).toFixed(1)} MB`;
  }

  function statusMarkup(message = "Sẵn sàng.") {
    return `<p class="hcca-status" role="status" aria-live="polite" data-hcca-status>${escapeHtml(message)}</p>`;
  }

  function renderShell(view, state, content, persistence) {
    const nav = [
      ["shared-canvas", "Canvas chung", "Ghi chú và quyết định"],
      ["automation", "Tự động hóa", "Lệnh và quy tắc"],
      ["hh-spaces", "HH Spaces", "Phòng sáng tạo và focus"]
    ];
    return `<section class="hh-communication-ca" data-hcca-view="${view}">
      <header class="hcca-hero">
        <div><span class="hcca-kicker">COMMUNICATION WORKSPACE</span><h2>Biến trao đổi thành hành động</h2><p>Canvas dùng chung, automation có kiểm soát và không gian cộng tác cục bộ trong một luồng làm việc.</p></div>
        <div class="hcca-presence"><i></i><span>${escapeHtml(PRESENCE_LABELS[state.hhSpaces.presence])}</span><small>${persistence.type === "localStorage" ? "Đã lưu trên thiết bị" : "Phiên tạm trong bộ nhớ"}</small></div>
      </header>
      <nav class="hcca-tabs" aria-label="Workspace giao tiếp" role="tablist">
        ${nav.map(([id, label, detail]) => `<button type="button" role="tab" aria-selected="${id === view}" tabindex="${id === view ? "0" : "-1"}" data-hcca-view-button="${id}"><strong>${label}</strong><span>${detail}</span></button>`).join("")}
      </nav>
      ${content}
      ${statusMarkup(persistence.error || "Sẵn sàng.")}
    </section>`;
  }

  function renderCanvas(state) {
    const space = state.canvas.spaces.find((entry) => entry.id === state.canvas.activeSpaceId) || state.canvas.spaces[0];
    const selected = space.items.find((item) => item.id === space.selectedItemId);
    const notes = space.items.filter((item) => item.type === "note");
    const checklist = space.items.filter((item) => item.type === "checklist");
    const files = space.items.filter((item) => item.type === "file");
    const decisions = space.items.filter((item) => item.type === "decision");
    return `<main class="hcca-workspace hcca-canvas">
      <section class="hcca-panel hcca-canvas-intro">
        <div><span class="hcca-eyebrow">SHARED CANVAS</span><h3>${escapeHtml(space.title)}</h3><p>${escapeHtml(space.description)}</p></div>
        <div class="hcca-metrics"><span><b>${space.items.length}</b>Mục</span><span><b>${checklist.filter((item) => item.completed).length}/${checklist.length}</b>Hoàn tất</span><span><b>${space.assignees.length}</b>Thành viên</span></div>
      </section>
      <section class="hcca-panel hcca-compose">
        <form data-hcca-item-form>
          <label>Loại mục<select name="type"><option value="note">Ghi chú</option><option value="checklist">Checklist</option><option value="decision">Quyết định</option></select></label>
          <label class="hcca-grow">Tiêu đề<input name="title" maxlength="180" required placeholder="Nhập nội dung cần phối hợp"></label>
          <label>Người phụ trách<select name="assigneeId"><option value="">Chưa giao</option>${space.assignees.map((person) => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.name)}</option>`).join("")}</select></label>
          <button class="hcca-primary" type="submit">Thêm vào Canvas</button>
        </form>
        <div class="hcca-file-row"><label class="hcca-file-button">Chọn tệp<input type="file" multiple data-hcca-file-input></label><span>Chỉ lưu tên, loại và dung lượng; nội dung tệp vẫn ở thiết bị của bạn.</span></div>
      </section>
      <div class="hcca-canvas-grid">
        <section class="hcca-panel"><header><div><span class="hcca-eyebrow">GHI CHÚ</span><h3>Ý tưởng và bối cảnh</h3></div><b>${notes.length}</b></header><div class="hcca-card-list">${notes.map((item) => renderCanvasItem(item, selected?.id)).join("") || emptyState("Chưa có ghi chú", "Thêm ghi chú đầu tiên để giữ bối cảnh chung.")}</div></section>
        <section class="hcca-panel"><header><div><span class="hcca-eyebrow">CHECKLIST</span><h3>Việc đang theo dõi</h3></div><b>${checklist.length}</b></header><div class="hcca-card-list">${checklist.map((item) => renderCanvasItem(item, selected?.id)).join("") || emptyState("Chưa có checklist", "Các mục hoàn thành sẽ được lưu trên thiết bị.")}</div></section>
        <section class="hcca-panel"><header><div><span class="hcca-eyebrow">QUYẾT ĐỊNH</span><h3>Nhật ký quyết định</h3></div><b>${decisions.length}</b></header><div class="hcca-card-list">${decisions.map((item) => renderCanvasItem(item, selected?.id)).join("") || emptyState("Chưa có quyết định", "Ghi lại đề xuất và chuyển trạng thái khi nhóm thống nhất.")}</div></section>
        <section class="hcca-panel"><header><div><span class="hcca-eyebrow">TỆP & THÀNH VIÊN</span><h3>Nguồn lực Canvas</h3></div><b>${files.length}</b></header>
          <div class="hcca-file-list">${files.map((item) => `<button type="button" class="${selected?.id === item.id ? "is-selected" : ""}" data-hcca-select="${escapeHtml(item.id)}"><span>FILE</span><strong>${escapeHtml(item.file?.name || item.title)}</strong><small>${escapeHtml(item.file?.type || "Không rõ loại")} · ${formatBytes(item.file?.size)}</small></button>`).join("") || `<p class="hcca-muted">Chưa có metadata tệp.</p>`}</div>
          <form class="hcca-inline-form" data-hcca-assignee-form><input name="name" required maxlength="100" placeholder="Tên thành viên"><input name="role" maxlength="80" placeholder="Vai trò"><button type="submit">Thêm</button></form>
          <div class="hcca-people">${space.assignees.map((person) => `<span><i>${escapeHtml(person.name.slice(0, 2).toUpperCase())}</i><b>${escapeHtml(person.name)}</b><small>${escapeHtml(person.role)}</small></span>`).join("") || `<p class="hcca-muted">Chưa có người phụ trách.</p>`}</div>
        </section>
      </div>
      <aside class="hcca-convert ${selected ? "is-active" : ""}" aria-label="Chuyển mục đã chọn">
        <div><span>ĐANG CHỌN</span><strong>${escapeHtml(selected?.title || "Chưa chọn mục")}</strong><small>${selected ? "Tạo bản nháp ở module đích qua sự kiện HH." : "Chọn một card để bật chuyển đổi."}</small></div>
        <div>${TARGETS.map((target) => `<button type="button" data-hcca-convert="${target}" ${selected ? "" : "disabled"}>${target === "task" ? "Công việc" : target === "project" ? "Dự án" : "Wiki"}</button>`).join("")}<button type="button" data-hcca-remove ${selected ? "" : "disabled"}>Xóa</button></div>
      </aside>
    </main>`;
  }

  function renderCanvasItem(item, selectedId) {
    const assigned = item.assigneeId ? `<small>Đã giao: ${escapeHtml(item.assigneeId)}</small>` : "";
    const control = item.type === "checklist"
      ? `<input type="checkbox" aria-label="Đánh dấu hoàn tất" data-hcca-toggle-item="${escapeHtml(item.id)}" ${item.completed ? "checked" : ""}>`
      : item.type === "decision"
        ? `<select aria-label="Trạng thái quyết định" data-hcca-decision="${escapeHtml(item.id)}"><option value="proposed" ${item.status === "proposed" ? "selected" : ""}>Đề xuất</option><option value="accepted" ${item.status === "accepted" ? "selected" : ""}>Đồng ý</option><option value="rejected" ${item.status === "rejected" ? "selected" : ""}>Từ chối</option></select>`
        : `<span aria-hidden="true">${item.type === "note" ? "N" : "•"}</span>`;
    return `<article class="hcca-item ${selectedId === item.id ? "is-selected" : ""} ${item.completed ? "is-complete" : ""}"><div class="hcca-item-control">${control}</div><button type="button" data-hcca-select="${escapeHtml(item.id)}"><strong>${escapeHtml(item.title)}</strong>${item.body ? `<p>${escapeHtml(item.body)}</p>` : ""}${assigned}</button></article>`;
  }

  function renderAutomation(state) {
    const automation = state.automation;
    return `<main class="hcca-workspace hcca-automation">
      <section class="hcca-panel hcca-command-lab">
        <header><div><span class="hcca-eyebrow">COMMAND LAB</span><h3>Lệnh nhanh có bước xem trước</h3><p>Mọi lệnh chỉ phát sự kiện sau khi bạn xem trước và bấm Chạy.</p></div><span class="hcca-safe-badge">SAFE DEFAULT</span></header>
        <form data-hcca-command-form><label for="hcca-command">Lệnh slash</label><div><input id="hcca-command" name="command" value="${escapeHtml(automation.draft)}" placeholder="/task Chuẩn bị thumbnail trước 17:00"><button type="submit">Xem trước</button></div></form>
        <div class="hcca-command-chips">${["/poll Chọn concept A hay B", "/task Hoàn thiện kịch bản", "/meeting Review lúc 20:00", "/music Gửi bản mix v2"].map((command) => `<button type="button" data-hcca-command-example="${escapeHtml(command)}">${escapeHtml(command.split(" ")[0])}</button>`).join("")}</div>
        <div class="hcca-preview ${automation.preview ? "is-ready" : ""}"><span>PREVIEW</span><strong>${escapeHtml(automation.preview?.label || "Chưa có lệnh hợp lệ")}</strong><p>${automation.preview ? "Chưa có hành động nào được gửi. Kiểm tra nội dung rồi mới chạy." : "Dùng /poll, /task, /meeting hoặc /music."}</p><button type="button" data-hcca-command-run ${automation.preview ? "" : "disabled"}>Chạy lệnh đã xem trước</button></div>
      </section>
      <div class="hcca-two-columns">
        <section class="hcca-panel"><header><div><span class="hcca-eyebrow">RULE BUILDER</span><h3>Quy tắc tự động</h3></div><small>Mặc định tắt</small></header>
          <form class="hcca-rule-form" data-hcca-rule-form><label>Tên<input name="name" maxlength="180" placeholder="Ví dụ: Giao việc từ chat"></label><label>Điều kiện<input name="trigger" maxlength="120" required placeholder="#task"></label><label>Hành động<select name="action"><option value="task">Tạo công việc</option><option value="project">Tạo dự án</option><option value="wiki">Tạo wiki</option><option value="poll">Tạo khảo sát</option><option value="meeting">Tạo lịch hẹn</option><option value="music">Gửi Music AI</option></select></label><button type="submit">Lưu quy tắc đang tắt</button></form>
          <div class="hcca-rule-list">${automation.rules.map((rule) => `<article><div><strong>${escapeHtml(rule.name)}</strong><small>Nếu chứa <b>${escapeHtml(rule.trigger)}</b> → ${escapeHtml(rule.action)}</small></div><label class="hcca-switch"><input type="checkbox" data-hcca-rule-toggle="${escapeHtml(rule.id)}" ${rule.enabled ? "checked" : ""}><span></span><em>${rule.enabled ? "Đang bật" : "Đang tắt"}</em></label></article>`).join("") || emptyState("Chưa có quy tắc", "Tạo quy tắc đầu tiên; quy tắc mới luôn ở trạng thái tắt.")}</div>
          <form class="hcca-rule-test" data-hcca-rule-test-form><label>Tin nhắn thử<input name="message" maxlength="3000" required placeholder="Ví dụ: #task hoàn thiện bản mix"></label><button type="submit">Kiểm tra quy tắc đang bật</button></form>
        </section>
        <section class="hcca-panel"><header><div><span class="hcca-eyebrow">EXECUTION LOG</span><h3>Lịch sử minh bạch</h3></div><b>${automation.logs.length}</b></header><ol class="hcca-log">${automation.logs.slice().reverse().map((entry) => `<li class="is-${entry.status}"><i></i><div><strong>${escapeHtml(entry.label)}</strong><small>${escapeHtml(new Date(entry.createdAt).toLocaleString("vi-VN"))}</small></div><span>${entry.status === "executed" ? "Đã chạy" : entry.status === "preview" ? "Xem trước" : "Đã chặn"}</span></li>`).join("") || `<li class="hcca-muted">Chưa có lần chạy nào.</li>`}</ol></section>
      </div>
    </main>`;
  }

  function renderSpaces(state) {
    const spaces = state.hhSpaces;
    const room = spaces.rooms.find((entry) => entry.id === spaces.activeRoomId) || spaces.rooms[0];
    return `<main class="hcca-workspace hcca-spaces">
      <section class="hcca-panel hcca-space-toolbar"><div><span class="hcca-eyebrow">WORK PRESENCE</span><h3>Cho nhóm biết nhịp làm việc của bạn</h3></div><label>Trạng thái<select data-hcca-presence>${PRESENCE_STATES.map((value) => `<option value="${value}" ${spaces.presence === value ? "selected" : ""}>${PRESENCE_LABELS[value]}</option>`).join("")}</select></label></section>
      <div class="hcca-spaces-grid">
        <section class="hcca-panel hcca-capsule"><header><div><span class="hcca-eyebrow">CONTEXT CAPSULE</span><h3>Từ hội thoại thành bản nháp</h3></div><span class="hcca-local-label">Tóm tắt cục bộ</span></header>
          <form data-hcca-capsule-form><label>Nội dung đã chọn<textarea name="content" rows="7" required placeholder="Dán đoạn hội thoại cần chuyển đổi..."></textarea></label><div><label>Đầu ra<select name="kind"><option value="summary">Tóm tắt</option><option value="task">Công việc</option><option value="wiki">Wiki</option><option value="project">Dự án</option></select></label><button type="submit">Tạo bản nháp</button></div></form>
          <div class="hcca-draft-list">${spaces.capsules.slice().reverse().map(renderDraft).join("") || emptyState("Chưa có Context Capsule", "Bản nháp cục bộ sẽ không tự ghi đè dữ liệu ở module khác.")}</div>
        </section>
        <section class="hcca-panel hcca-creative-room"><header><div><span class="hcca-eyebrow">CREATIVE ROOM</span><h3>${escapeHtml(room.title)}</h3></div><span>${room.playback.playing ? "Đang phát" : "Đã tạm dừng"}</span></header>
          <form class="hcca-source-form" data-hcca-source-form><input name="sourceUrl" type="url" value="${escapeHtml(room.sourceUrl)}" placeholder="URL media được phép chia sẻ"><button type="submit">Cập nhật nguồn</button></form>
          <div class="hcca-player"><button type="button" data-hcca-play>${room.playback.playing ? "Tạm dừng" : "Phát"}</button><input type="range" min="0" max="3600" value="${room.playback.currentTime}" aria-label="Vị trí phát" data-hcca-seek><output>${formatTime(room.playback.currentTime)}</output></div>
          <form class="hcca-comment-form" data-hcca-comment-form><input name="timestamp" type="number" min="0" max="86400" value="${Math.floor(room.playback.currentTime)}" aria-label="Thời điểm tính bằng giây"><input name="body" maxlength="1200" required placeholder="Bình luận đúng thời điểm..."><button type="submit">Ghim</button></form>
          <ol class="hcca-room-comments">${room.comments.slice().reverse().map((comment) => `<li><button type="button" data-hcca-jump-time="${comment.timestamp}">${formatTime(comment.timestamp)}</button><div><strong>${escapeHtml(comment.author)}</strong><p>${escapeHtml(comment.body)}</p></div></li>`).join("") || `<li class="hcca-muted">Chưa có bình luận theo timestamp.</li>`}</ol>
        </section>
        <section class="hcca-panel hcca-focus"><header><div><span class="hcca-eyebrow">FOCUS CIRCLES</span><h3>Nhóm nhỏ có mục tiêu rõ ràng</h3></div><b>${spaces.circles.length}</b></header>
          <form data-hcca-circle-form><input name="name" required maxlength="140" placeholder="Tên circle"><input name="focus" maxlength="400" placeholder="Dự án, nghề nghiệp hoặc khóa học"><input name="members" maxlength="800" placeholder="Thành viên, cách nhau bằng dấu phẩy"><button type="submit">Tạo circle</button></form>
          <div class="hcca-circle-list">${spaces.circles.map((circle) => `<article><span>${escapeHtml(circle.name.slice(0, 2).toUpperCase())}</span><div><strong>${escapeHtml(circle.name)}</strong><p>${escapeHtml(circle.focus || "Chưa mô tả mục tiêu")}</p><small>${circle.members.length} thành viên</small></div></article>`).join("") || emptyState("Chưa có Focus Circle", "Tạo nhóm nhỏ theo dự án, nghề nghiệp hoặc khóa học.")}</div>
        </section>
        <section class="hcca-panel hcca-catchup"><header><div><span class="hcca-eyebrow">SMART CATCH-UP</span><h3>Nắm nhanh phần đã bỏ lỡ</h3></div><span class="hcca-local-label">Tóm tắt cục bộ</span></header>
          <form data-hcca-catchup-form><textarea name="content" rows="5" required placeholder="Dán tin nhắn đã bỏ lỡ..."></textarea><button type="submit">Tạo Catch-up</button></form>
          <div class="hcca-draft-list">${spaces.catchUps.slice().reverse().map(renderDraft).join("") || emptyState("Chưa có Catch-up", "Kết quả sẽ luôn ghi rõ nguồn xử lý cục bộ hoặc AI máy chủ.")}</div>
        </section>
      </div>
    </main>`;
  }

  function renderDraft(draft) {
    return `<article><header><span>${escapeHtml(draft.sourceLabel)}</span><time>${escapeHtml(new Date(draft.createdAt).toLocaleString("vi-VN"))}</time></header><strong>${escapeHtml(draft.title)}</strong><pre>${escapeHtml(draft.body)}</pre><div>${TARGETS.map((target) => `<button type="button" data-hcca-draft-convert="${target}" data-hcca-draft-id="${escapeHtml(draft.id)}">${target === "task" ? "Công việc" : target === "project" ? "Dự án" : "Wiki"}</button>`).join("")}</div></article>`;
  }

  function emptyState(title, body) {
    return `<div class="hcca-empty"><span aria-hidden="true">+</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></div>`;
  }

  function render(view, state, persistence) {
    const safeView = SUPPORTED_VIEWS.includes(view) ? view : "shared-canvas";
    const content = safeView === "automation" ? renderAutomation(state) : safeView === "hh-spaces" ? renderSpaces(state) : renderCanvas(state);
    return renderShell(safeView, state, content, persistence);
  }

  function setStatus(root, message, tone = "") {
    const status = root.querySelector("[data-hcca-status]");
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function mount(root, options = {}) {
    if (!root || typeof root.querySelector !== "function") throw new TypeError("HHCommunicationCanvasAutomation cần một root DOM hợp lệ.");
    unmount(root);
    let view = SUPPORTED_VIEWS.includes(options.view) ? options.view : "shared-canvas";
    const storeOptions = Object.prototype.hasOwnProperty.call(options, "storage") ? { storage: options.storage } : {};
    const store = options.store || createStore(storeOptions);
    let destroyed = false;
    let rendering = false;

    const rerender = () => {
      if (destroyed || rendering) return;
      rendering = true;
      root.innerHTML = render(view, store.getState(), store.getPersistence());
      rendering = false;
    };

    const onClick = async (event) => {
      const button = event.target.closest("button");
      if (!button || !root.contains(button)) return;
      try {
        if (button.dataset.hccaViewButton) {
          view = button.dataset.hccaViewButton;
          rerender();
          emit("hh:communication-view", { view });
          return;
        }
        if (button.dataset.hccaSelect) return store.selectItem(button.dataset.hccaSelect);
        if (button.hasAttribute("data-hcca-remove")) {
          const selected = store.getActiveSpace().selectedItemId;
          if (selected) store.removeItem(selected);
          return;
        }
        if (button.dataset.hccaConvert) {
          const draft = store.selectedDraft(button.dataset.hccaConvert);
          emit("hh:communication-convert", draft);
          emit(`hh:create-${draft.target}`, draft);
          setStatus(root, `Đã gửi bản nháp ${draft.target} tới module đích.`, "success");
          return;
        }
        if (button.dataset.hccaCommandExample) {
          store.setAutomationDraft(button.dataset.hccaCommandExample);
          return;
        }
        if (button.hasAttribute("data-hcca-command-run")) {
          const preview = store.getState().automation.preview;
          if (!preview) return;
          emit("hh:communication-command", preview);
          emit(`hh:communication-${preview.type}`, preview);
          store.logAutomation(preview.label, "executed");
          store.setPreview(null);
          return;
        }
        if (button.hasAttribute("data-hcca-play")) {
          const room = store.getActiveRoom();
          const playback = store.updatePlayback({ playing: !room.playback.playing });
          emit("hh:creative-room-playback", { roomId: room.id, ...playback, localOnly: true });
          return;
        }
        if (button.dataset.hccaJumpTime != null) return store.updatePlayback({ currentTime: Number(button.dataset.hccaJumpTime) });
        if (button.dataset.hccaDraftConvert && button.dataset.hccaDraftId) {
          const state = store.getState();
          const draft = state.hhSpaces.capsules.concat(state.hhSpaces.catchUps).find((entry) => entry.id === button.dataset.hccaDraftId);
          if (!draft) return;
          const payload = { target: button.dataset.hccaDraftConvert, source: "hh-spaces", sourceId: draft.id, title: draft.title, body: draft.body, sourceLabel: draft.sourceLabel };
          emit("hh:communication-convert", payload);
          emit(`hh:create-${payload.target}`, payload);
          setStatus(root, `Đã gửi bản nháp ${payload.target}.`, "success");
        }
      } catch (error) {
        setStatus(root, error.message || "Không thể thực hiện thao tác.", "error");
      }
    };

    const onChange = (event) => {
      try {
        if (event.target.matches("[data-hcca-toggle-item]")) store.updateItem(event.target.dataset.hccaToggleItem, { completed: event.target.checked });
        else if (event.target.matches("[data-hcca-decision]")) store.updateItem(event.target.dataset.hccaDecision, { status: event.target.value });
        else if (event.target.matches("[data-hcca-rule-toggle]")) store.toggleRule(event.target.dataset.hccaRuleToggle, event.target.checked);
        else if (event.target.matches("[data-hcca-presence]")) {
          store.setPresence(event.target.value);
          emit("hh:communication-presence", { value: event.target.value, label: PRESENCE_LABELS[event.target.value], localOnly: true });
        } else if (event.target.matches("[data-hcca-seek]")) store.updatePlayback({ currentTime: Number(event.target.value) });
        else if (event.target.matches("[data-hcca-file-input]")) {
          Array.from(event.target.files || []).slice(0, 20).forEach((file) => store.addFileMetadata(file));
        }
      } catch (error) { setStatus(root, error.message || "Không thể cập nhật.", "error"); }
    };

    const onSubmit = async (event) => {
      const form = event.target;
      if (!(form instanceof globalScope.HTMLFormElement) || !root.contains(form)) return;
      event.preventDefault();
      const data = new globalScope.FormData(form);
      try {
        if (form.matches("[data-hcca-item-form]")) {
          store.addCanvasItem(data.get("type"), { title: data.get("title"), assigneeId: data.get("assigneeId"), status: "proposed" });
          form.reset();
        } else if (form.matches("[data-hcca-assignee-form]")) {
          store.addAssignee(data.get("name"), data.get("role"));
          form.reset();
        } else if (form.matches("[data-hcca-command-form]")) {
          const parsed = parseSlashCommand(data.get("command"));
          store.setAutomationDraft(data.get("command"));
          if (!parsed.valid) {
            store.setPreview(null);
            store.logAutomation(parsed.label, "blocked");
          } else {
            store.setPreview({ type: parsed.type, label: parsed.label, payload: parsed.payload });
            store.logAutomation(parsed.label, "preview");
          }
        } else if (form.matches("[data-hcca-rule-form]")) {
          store.addRule({ name: data.get("name"), trigger: data.get("trigger"), action: data.get("action") });
          form.reset();
        } else if (form.matches("[data-hcca-rule-test-form]")) {
          const matches = evaluateRules(store.getState().automation.rules, data.get("message"));
          if (!matches.length) {
            store.setPreview(null);
            store.logAutomation("Không có quy tắc đang bật khớp với tin nhắn thử.", "blocked");
          } else {
            const preview = matches[0];
            store.setPreview(preview);
            store.logAutomation(`Khớp ${matches.length} quy tắc · ${preview.label}`, "preview");
          }
        } else if (form.matches("[data-hcca-capsule-form]")) {
          const draft = await buildSmartDraft(data.get("content"), data.get("kind"), options.aiAdapter);
          store.addCapsule(draft, "capsules");
          form.reset();
        } else if (form.matches("[data-hcca-source-form]")) {
          store.updatePlayback({ sourceUrl: data.get("sourceUrl") });
        } else if (form.matches("[data-hcca-comment-form]")) {
          store.addTimestampComment(data.get("body"), data.get("timestamp"), options.currentUser?.name || "Bạn");
          form.reset();
        } else if (form.matches("[data-hcca-circle-form]")) {
          store.addCircle({ name: data.get("name"), focus: data.get("focus"), members: String(data.get("members") || "").split(",") });
          form.reset();
        } else if (form.matches("[data-hcca-catchup-form]")) {
          const draft = await buildSmartDraft(data.get("content"), "summary", options.aiAdapter);
          store.addCapsule({ ...draft, title: `Catch-up: ${draft.title}` }, "catchUps");
          form.reset();
        }
      } catch (error) { setStatus(root, error.message || "Không thể lưu dữ liệu.", "error"); }
    };

    const onKeyDown = (event) => {
      if (event.target.matches('[role="tab"]') && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
        const index = tabs.indexOf(event.target);
        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        event.preventDefault();
        tabs[nextIndex]?.focus();
        tabs[nextIndex]?.click();
      }
    };

    const unsubscribe = store.subscribe(() => rerender());
    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    root.addEventListener("submit", onSubmit);
    root.addEventListener("keydown", onKeyDown);
    rerender();

    const instance = {
      root,
      store,
      getView: () => view,
      setView(nextView) { if (SUPPORTED_VIEWS.includes(nextView)) { view = nextView; rerender(); } },
      rerender,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        unsubscribe();
        root.removeEventListener("click", onClick);
        root.removeEventListener("change", onChange);
        root.removeEventListener("submit", onSubmit);
        root.removeEventListener("keydown", onKeyDown);
        instances.delete(root);
      }
    };
    instances.set(root, instance);
    return instance;
  }

  function unmount(root) {
    const instance = root && instances.get(root);
    if (instance) instance.destroy();
  }

  return Object.freeze({
    VERSION,
    STORAGE_KEY,
    SUPPORTED_VIEWS,
    PRESENCE_STATES,
    PRESENCE_LABELS,
    createStore,
    defaultState,
    normalizeState,
    parseSlashCommand,
    evaluateRules,
    buildLocalDraft,
    buildSmartDraft,
    render,
    mount,
    unmount,
    escapeHtml
  });
});
