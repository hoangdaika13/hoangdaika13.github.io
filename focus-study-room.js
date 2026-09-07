(function (root, factory) {
  "use strict";
  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHFocusStudyRoom = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (globalScope) {
  "use strict";

  const VERSION = 1;
  const STORAGE_PREFIX = "hh.focus.study-room.v1";
  const MAX_TASKS = 160;
  const MAX_HISTORY = 600;
  const MAX_NOTE_LENGTH = 20000;
  const VALID_MODES = new Set(["focus", "short-break", "long-break", "custom"]);
  const VALID_PRIORITIES = new Set(["low", "normal", "high"]);
  const mounted = new WeakMap();

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const clean = (value, limit = 200) => String(value ?? "").trim().slice(0, limit);
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
  const id = (prefix = "item") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const dayKey = (time = Date.now()) => {
    const date = new Date(time);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const formatClock = (seconds) => {
    const safe = Math.max(0, Math.ceil(Number(seconds) || 0));
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  };
  const formatMinutes = (seconds) => {
    const minutes = Math.round(Math.max(0, Number(seconds) || 0) / 60);
    if (minutes < 60) return `${minutes} phút`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours} giờ ${remainder} phút` : `${hours} giờ`;
  };

  function ownerIdFor(user) {
    return clean(user?._id || user?.id || user?.userId || user?.email || "guest", 120)
      .replace(/[^a-z0-9@._-]/gi, "-") || "guest";
  }

  function storageKey(ownerId) {
    return `${STORAGE_PREFIX}:${ownerIdFor({ id: ownerId || "guest" })}`;
  }

  function durationFor(mode, settings) {
    const minutes = mode === "short-break" ? settings.shortBreakMinutes
      : mode === "long-break" ? settings.longBreakMinutes
        : mode === "custom" ? settings.customMinutes
          : settings.focusMinutes;
    return clamp(minutes, 1, 180) * 60;
  }

  function defaultState(now = Date.now()) {
    const settings = {
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      customMinutes: 45,
      longBreakEvery: 4,
      autoStartBreaks: false,
      autoStartFocus: false,
      eyeReminder: true,
      reducedMotion: false
    };
    return {
      version: VERSION,
      tasks: [],
      note: "",
      history: [],
      settings,
      sound: { rain: 0, brown: 0, cafe: 0 },
      timer: {
        mode: "focus",
        status: "idle",
        durationSeconds: durationFor("focus", settings),
        remainingSeconds: durationFor("focus", settings),
        endsAt: null,
        startedAt: null,
        taskId: null,
        completedFocusCycles: 0,
        lastEyeReminderAt: now
      },
      updatedAt: new Date(now).toISOString()
    };
  }

  function normalizeSettings(raw) {
    const input = raw && typeof raw === "object" ? raw : {};
    return {
      focusMinutes: clamp(input.focusMinutes || 25, 1, 180),
      shortBreakMinutes: clamp(input.shortBreakMinutes || 5, 1, 60),
      longBreakMinutes: clamp(input.longBreakMinutes || 15, 1, 120),
      customMinutes: clamp(input.customMinutes || 45, 1, 180),
      longBreakEvery: clamp(input.longBreakEvery || 4, 2, 12),
      autoStartBreaks: input.autoStartBreaks === true,
      autoStartFocus: input.autoStartFocus === true,
      eyeReminder: input.eyeReminder !== false,
      reducedMotion: input.reducedMotion === true
    };
  }

  function normalizeTask(task, index = 0) {
    if (!task || !clean(task.title, 160)) return null;
    const createdAt = Number.isFinite(Date.parse(task.createdAt)) ? task.createdAt : new Date().toISOString();
    return {
      id: clean(task.id, 100) || `task-${index}`,
      title: clean(task.title, 160),
      done: task.done === true,
      priority: VALID_PRIORITIES.has(task.priority) ? task.priority : "normal",
      estimate: clamp(task.estimate || 1, 1, 20),
      createdAt,
      completedAt: task.done && Number.isFinite(Date.parse(task.completedAt)) ? task.completedAt : null
    };
  }

  function normalizeHistoryItem(item, index = 0) {
    if (!item || !VALID_MODES.has(item.mode) || !Number.isFinite(Date.parse(item.completedAt))) return null;
    return {
      id: clean(item.id, 100) || `session-${index}`,
      mode: item.mode,
      durationSeconds: clamp(item.durationSeconds, 1, 12 * 60 * 60),
      startedAt: Number.isFinite(Date.parse(item.startedAt)) ? item.startedAt : item.completedAt,
      completedAt: item.completedAt,
      taskId: clean(item.taskId, 100) || null
    };
  }

  function normalizeState(raw, now = Date.now()) {
    const base = defaultState(now);
    const source = raw && typeof raw === "object" ? raw : {};
    const settings = normalizeSettings(source.settings);
    const tasks = (Array.isArray(source.tasks) ? source.tasks : []).map(normalizeTask).filter(Boolean).slice(-MAX_TASKS);
    const taskIds = new Set(tasks.map((task) => task.id));
    const mode = VALID_MODES.has(source.timer?.mode) ? source.timer.mode : "focus";
    const expectedDuration = durationFor(mode, settings);
    const durationSeconds = clamp(source.timer?.durationSeconds || expectedDuration, 60, 12 * 60 * 60);
    const status = ["idle", "running", "paused"].includes(source.timer?.status) ? source.timer.status : "idle";
    const endsAt = status === "running" && Number.isFinite(Number(source.timer?.endsAt)) ? Number(source.timer.endsAt) : null;
    return {
      version: VERSION,
      tasks,
      note: String(source.note ?? "").slice(0, MAX_NOTE_LENGTH),
      history: (Array.isArray(source.history) ? source.history : []).map(normalizeHistoryItem).filter(Boolean).slice(-MAX_HISTORY),
      settings,
      sound: {
        rain: clamp(source.sound?.rain, 0, 1),
        brown: clamp(source.sound?.brown, 0, 1),
        cafe: clamp(source.sound?.cafe, 0, 1)
      },
      timer: {
        mode,
        status,
        durationSeconds,
        remainingSeconds: clamp(source.timer?.remainingSeconds || durationSeconds, 0, durationSeconds),
        endsAt,
        startedAt: Number.isFinite(Number(source.timer?.startedAt)) ? Number(source.timer.startedAt) : null,
        taskId: taskIds.has(source.timer?.taskId) ? source.timer.taskId : null,
        completedFocusCycles: Math.max(0, Math.floor(Number(source.timer?.completedFocusCycles) || 0)),
        lastEyeReminderAt: Number.isFinite(Number(source.timer?.lastEyeReminderAt)) ? Number(source.timer.lastEyeReminderAt) : now
      },
      updatedAt: Number.isFinite(Date.parse(source.updatedAt)) ? source.updatedAt : base.updatedAt
    };
  }

  function timerSnapshot(timer, now = Date.now()) {
    const source = timer || {};
    const remainingSeconds = source.status === "running" && Number.isFinite(Number(source.endsAt))
      ? Math.max(0, Math.ceil((Number(source.endsAt) - now) / 1000))
      : Math.max(0, Math.ceil(Number(source.remainingSeconds) || 0));
    return { ...source, remainingSeconds, expired: source.status === "running" && remainingSeconds <= 0 };
  }

  function nextModeAfterFocus(cycles, settings) {
    return cycles > 0 && cycles % settings.longBreakEvery === 0 ? "long-break" : "short-break";
  }

  function finishExpiredSession(input, now = Date.now()) {
    const state = normalizeState(input, now);
    const snapshot = timerSnapshot(state.timer, now);
    if (!snapshot.expired) {
      state.timer = snapshot;
      return { state, completed: null };
    }
    const completed = {
      id: id("session"),
      mode: snapshot.mode,
      durationSeconds: snapshot.durationSeconds,
      startedAt: new Date(snapshot.startedAt || now - snapshot.durationSeconds * 1000).toISOString(),
      completedAt: new Date(now).toISOString(),
      taskId: snapshot.taskId || null
    };
    state.history = [...state.history, completed].slice(-MAX_HISTORY);
    const completedFocusCycles = snapshot.completedFocusCycles + (snapshot.mode === "focus" || snapshot.mode === "custom" ? 1 : 0);
    const nextMode = snapshot.mode === "focus" || snapshot.mode === "custom"
      ? nextModeAfterFocus(completedFocusCycles, state.settings)
      : "focus";
    const shouldAutoStart = (nextMode === "focus" && state.settings.autoStartFocus)
      || (nextMode !== "focus" && state.settings.autoStartBreaks);
    const nextDuration = durationFor(nextMode, state.settings);
    state.timer = {
      ...snapshot,
      mode: nextMode,
      status: shouldAutoStart ? "running" : "idle",
      durationSeconds: nextDuration,
      remainingSeconds: nextDuration,
      endsAt: shouldAutoStart ? now + nextDuration * 1000 : null,
      startedAt: shouldAutoStart ? now : null,
      completedFocusCycles,
      lastEyeReminderAt: now
    };
    state.updatedAt = new Date(now).toISOString();
    return { state, completed };
  }

  function computeStats(history, now = Date.now()) {
    const sessions = (Array.isArray(history) ? history : []).map(normalizeHistoryItem).filter(Boolean)
      .filter((item) => item.mode === "focus" || item.mode === "custom");
    const today = dayKey(now);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const weekStart = start.getTime() - 6 * 86400000;
    const todaySessions = sessions.filter((item) => dayKey(Date.parse(item.completedAt)) === today);
    const weekSessions = sessions.filter((item) => Date.parse(item.completedAt) >= weekStart && Date.parse(item.completedAt) <= now);
    const activeDays = new Set(sessions.map((item) => dayKey(Date.parse(item.completedAt))));
    let streak = 0;
    const cursor = new Date(start);
    if (!activeDays.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
    while (activeDays.has(dayKey(cursor.getTime()))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return {
      totalSessions: sessions.length,
      todaySessions: todaySessions.length,
      todaySeconds: todaySessions.reduce((sum, item) => sum + item.durationSeconds, 0),
      weekSessions: weekSessions.length,
      weekSeconds: weekSessions.reduce((sum, item) => sum + item.durationSeconds, 0),
      streak
    };
  }

  function readState(storage, ownerId, now = Date.now()) {
    try { return normalizeState(JSON.parse(storage?.getItem?.(storageKey(ownerId)) || "null"), now); }
    catch { return defaultState(now); }
  }

  function writeState(runtime) {
    runtime.state.updatedAt = new Date().toISOString();
    try {
      runtime.storage?.setItem?.(storageKey(runtime.ownerId), JSON.stringify(runtime.state));
      runtime.storageError = false;
      return true;
    } catch {
      runtime.storageError = true;
      return false;
    }
  }

  function modeLabel(mode) {
    return ({ focus: "Tập trung", "short-break": "Nghỉ ngắn", "long-break": "Nghỉ dài", custom: "Linh hoạt" })[mode] || "Tập trung";
  }

  function createAmbientMixer(scope = globalScope) {
    let context = null;
    const layers = new Map();
    let suspendedByVisibility = false;

    function ensureContext() {
      if (context) return context;
      const AudioContext = scope.AudioContext || scope.webkitAudioContext;
      if (!AudioContext) throw new Error("Trình duyệt chưa hỗ trợ Web Audio.");
      context = new AudioContext();
      return context;
    }

    function makeNoise(kind) {
      const ctx = ensureContext();
      const length = Math.max(1, Math.floor(ctx.sampleRate * 2));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let index = 0; index < length; index += 1) {
        const white = Math.random() * 2 - 1;
        if (kind === "brown") {
          last = (last + 0.02 * white) / 1.02;
          data[index] = last * 3.2;
        } else {
          data[index] = white * (kind === "cafe" ? 0.45 : 0.7);
        }
      }
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      filter.type = kind === "rain" ? "highpass" : kind === "cafe" ? "bandpass" : "lowpass";
      filter.frequency.value = kind === "rain" ? 1800 : kind === "cafe" ? 720 : 420;
      filter.Q.value = kind === "cafe" ? 0.55 : 0.35;
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start();
      layers.set(kind, { source, gain });
      return layers.get(kind);
    }

    async function set(kind, volume) {
      const ctx = ensureContext();
      if (ctx.state === "suspended") await ctx.resume();
      suspendedByVisibility = false;
      const layer = layers.get(kind) || makeNoise(kind);
      layer.gain.gain.setTargetAtTime(clamp(volume, 0, 1) * 0.36, ctx.currentTime, 0.04);
      return ctx.state;
    }

    function suspendForVisibility() {
      if (!context || context.state !== "running") return false;
      suspendedByVisibility = true;
      context.suspend?.();
      return true;
    }

    async function resume() {
      if (!context) ensureContext();
      await context.resume?.();
      suspendedByVisibility = false;
      return true;
    }

    function close() {
      layers.forEach((layer) => { try { layer.source.stop(); } catch {} });
      layers.clear();
      const closing = context?.close?.();
      closing?.catch?.(() => {});
      context = null;
      suspendedByVisibility = false;
    }

    return {
      set, resume, suspendForVisibility, close,
      get state() { return context?.state || "off"; },
      get suspendedByVisibility() { return suspendedByVisibility; }
    };
  }

  function taskRows(state) {
    const sorted = state.tasks.map((task, index) => ({ task, index })).sort((a, b) => Number(a.task.done) - Number(b.task.done));
    if (!sorted.length) return '<div class="focus-empty"><span aria-hidden="true">✦</span><strong>Chưa có việc học</strong><p>Thêm một việc nhỏ, chọn làm mục tiêu rồi bắt đầu phiên tập trung.</p></div>';
    return sorted.map(({ task, index }) => `<article class="focus-task${task.done ? " is-done" : ""}${state.timer.taskId === task.id ? " is-active" : ""}" data-task-id="${esc(task.id)}">
      <label class="focus-check"><input type="checkbox" data-task-toggle="${esc(task.id)}" ${task.done ? "checked" : ""}><span aria-hidden="true"></span><span class="sr-only">Đánh dấu ${esc(task.title)}</span></label>
      <button class="focus-task__body" type="button" data-task-active="${esc(task.id)}" ${task.done ? "disabled" : ""}>
        <strong>${esc(task.title)}</strong><small>${task.estimate} phiên · ${task.priority === "high" ? "Ưu tiên cao" : task.priority === "low" ? "Ưu tiên thấp" : "Ưu tiên thường"}</small>
      </button>
      <div class="focus-task__actions">
        <button type="button" data-task-move="up" data-task-index="${index}" aria-label="Đưa lên">↑</button><button type="button" data-task-move="down" data-task-index="${index}" aria-label="Đưa xuống">↓</button><button type="button" data-task-edit="${esc(task.id)}" aria-label="Sửa việc học">✎</button><button type="button" data-task-delete="${esc(task.id)}" aria-label="Xóa việc học">×</button>
      </div>
    </article>`).join("");
  }

  function historyRows(state) {
    const recent = state.history.slice().reverse().slice(0, 12);
    if (!recent.length) return '<div class="focus-empty focus-empty--compact"><strong>Chưa có phiên hoàn thành</strong><p>Chỉ những phiên chạy hết thời gian mới được tính.</p></div>';
    return recent.map((session) => {
      const task = state.tasks.find((item) => item.id === session.taskId);
      return `<article class="focus-history__row"><span class="focus-history__orb focus-history__orb--${esc(session.mode)}" aria-hidden="true"></span><div><strong>${esc(modeLabel(session.mode))}${task ? ` · ${esc(task.title)}` : ""}</strong><small>${new Date(session.completedAt).toLocaleString("vi-VN")} · ${esc(formatMinutes(session.durationSeconds))}</small></div></article>`;
    }).join("");
  }

  function activeTaskOptions(state) {
    return [`<option value="">Không gắn với việc cụ thể</option>`, ...state.tasks.filter((task) => !task.done).map((task) => `<option value="${esc(task.id)}" ${state.timer.taskId === task.id ? "selected" : ""}>${esc(task.title)}</option>`)].join("");
  }

  function shellMarkup(runtime) {
    const state = runtime.state;
    return `<section class="focus-room" data-focus-room data-motion="${state.settings.reducedMotion ? "reduced" : "full"}">
      <div class="focus-room__cosmos" aria-hidden="true"><i></i><i></i><i></i><span></span></div>
      <header class="focus-room__hero">
        <div><p class="focus-kicker"><span></span> COSMIC FOCUS ROOM · LOCAL-FIRST</p><h2>Phòng học tập trung</h2><p>Gom thời gian, mục tiêu, ghi chú và không gian âm thanh vào một bàn học duy nhất. Dữ liệu được lưu riêng cho tài khoản này trên thiết bị.</p></div>
        <div class="focus-hero__actions"><button type="button" data-focus-jump="history">Xem tiến độ</button><button type="button" data-focus-export>Xuất dữ liệu</button><label class="focus-import">Nhập JSON<input type="file" accept="application/json,.json" data-focus-import></label></div>
      </header>
      <div class="focus-room__notice" role="status" data-focus-notice>Âm thanh không tự phát. Hãy kéo một thanh âm lượng để bắt đầu.</div>
      <div class="focus-room__grid">
        <section class="focus-panel focus-timer-panel" aria-labelledby="focus-timer-title">
          <header class="focus-panel__head"><div><span>DEEP WORK</span><h3 id="focus-timer-title">Bộ đếm tập trung</h3></div><button class="focus-icon-button" type="button" data-focus-settings aria-expanded="false" aria-controls="focus-settings-panel" title="Cài đặt thời gian">⚙</button></header>
          <div class="focus-mode-tabs" role="tablist" aria-label="Chế độ hẹn giờ">
            ${[["focus", "Tập trung"], ["short-break", "Nghỉ ngắn"], ["long-break", "Nghỉ dài"], ["custom", "Linh hoạt"]].map(([mode, label]) => `<button type="button" role="tab" data-focus-mode="${mode}" aria-selected="${state.timer.mode === mode}" class="${state.timer.mode === mode ? "is-active" : ""}">${label}</button>`).join("")}
          </div>
          <div class="focus-timer" data-timer-state="${esc(state.timer.status)}">
            <div class="focus-timer__ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="53"></circle><circle class="focus-timer__progress" cx="60" cy="60" r="53" data-focus-progress></circle></svg><div><strong data-focus-clock>${formatClock(timerSnapshot(state.timer).remainingSeconds)}</strong><span data-focus-mode-label>${esc(modeLabel(state.timer.mode))}</span></div></div>
            <div class="focus-timer__controls"><button class="focus-button focus-button--primary" type="button" data-focus-start>${state.timer.status === "running" ? "Tạm dừng" : state.timer.status === "paused" ? "Tiếp tục" : "Bắt đầu"}</button><button class="focus-button" type="button" data-focus-reset>Đặt lại</button><button class="focus-button" type="button" data-focus-skip>Chuyển phiên</button></div>
          </div>
          <label class="focus-select-label"><span>Mục tiêu của phiên</span><select data-focus-task>${activeTaskOptions(state)}</select></label>
          <div class="focus-cycle-line"><span><i data-focus-cycle-dots>${Array.from({ length: state.settings.longBreakEvery }, (_, index) => `<b class="${index < state.timer.completedFocusCycles % state.settings.longBreakEvery ? "is-done" : ""}"></b>`).join("")}</i>${state.timer.completedFocusCycles} phiên tập trung đã hoàn thành</span><small>Phiên chỉ được ghi khi chạy hết thời gian.</small></div>
          <form class="focus-settings" id="focus-settings-panel" data-focus-settings-form hidden>
            <div class="focus-settings__grid"><label>Tập trung (phút)<input name="focusMinutes" type="number" min="1" max="180" value="${state.settings.focusMinutes}"></label><label>Nghỉ ngắn<input name="shortBreakMinutes" type="number" min="1" max="60" value="${state.settings.shortBreakMinutes}"></label><label>Nghỉ dài<input name="longBreakMinutes" type="number" min="1" max="120" value="${state.settings.longBreakMinutes}"></label><label>Linh hoạt<input name="customMinutes" type="number" min="1" max="180" value="${state.settings.customMinutes}"></label><label>Nghỉ dài sau<input name="longBreakEvery" type="number" min="2" max="12" value="${state.settings.longBreakEvery}"></label></div>
            <div class="focus-settings__checks"><label><input name="autoStartBreaks" type="checkbox" ${state.settings.autoStartBreaks ? "checked" : ""}> Tự bắt đầu giờ nghỉ</label><label><input name="autoStartFocus" type="checkbox" ${state.settings.autoStartFocus ? "checked" : ""}> Tự bắt đầu phiên học</label><label><input name="eyeReminder" type="checkbox" ${state.settings.eyeReminder ? "checked" : ""}> Nhắc quy tắc mắt 20–20–20</label><label><input name="reducedMotion" type="checkbox" ${state.settings.reducedMotion ? "checked" : ""}> Giảm chuyển động trang trí</label></div>
            <button class="focus-button focus-button--primary" type="submit">Lưu cài đặt</button>
          </form>
        </section>

        <section class="focus-panel focus-task-panel" aria-labelledby="focus-task-title">
          <header class="focus-panel__head"><div><span>STUDY PLAN</span><h3 id="focus-task-title">Việc học hôm nay</h3></div><button type="button" data-task-clear>Ẩn việc đã xong</button></header>
          <form class="focus-task-form" data-task-form><label class="sr-only" for="focus-task-input">Việc cần học</label><input id="focus-task-input" name="title" maxlength="160" required placeholder="Ví dụ: Ôn 20 từ vựng…"><select name="priority" aria-label="Mức ưu tiên"><option value="normal">Thường</option><option value="high">Cao</option><option value="low">Thấp</option></select><input name="estimate" type="number" min="1" max="20" value="1" aria-label="Số phiên dự kiến"><button type="submit" aria-label="Thêm việc học">＋</button></form>
          <div class="focus-task-list" data-task-list>${taskRows(state)}</div>
        </section>

        <section class="focus-panel focus-sound-panel" aria-labelledby="focus-sound-title">
          <header class="focus-panel__head"><div><span>PROCEDURAL AUDIO</span><h3 id="focus-sound-title">Không gian âm thanh</h3></div><button type="button" data-audio-resume>Bật lại</button></header>
          <p class="focus-panel__intro">Âm thanh được tạo ngay trong trình duyệt, không tải bản ghi bên ngoài và chỉ bật sau thao tác của bạn.</p>
          <div class="focus-sound-list">
            ${[["rain", "Mưa đêm", "Nhẹ, sáng"], ["brown", "Nhiễu nâu", "Trầm, đều"], ["cafe", "Quán cà phê", "Ấm, xa"]].map(([key, label, hint]) => `<label class="focus-sound"><span class="focus-sound__icon focus-sound__icon--${key}" aria-hidden="true"></span><span><strong>${label}</strong><small>${hint}</small></span><input type="range" min="0" max="100" value="${Math.round(state.sound[key] * 100)}" data-sound="${key}" aria-label="Âm lượng ${label}"><output>${Math.round(state.sound[key] * 100)}%</output></label>`).join("")}
          </div>
          <div class="focus-sound__status"><span data-audio-status>Đang tắt</span><button type="button" data-audio-stop>Tắt tất cả</button></div>
        </section>

        <section class="focus-panel focus-note-panel" aria-labelledby="focus-note-title">
          <header class="focus-panel__head"><div><span>SESSION NOTE</span><h3 id="focus-note-title">Ghi chú phiên học</h3></div><span data-note-status>Đã lưu cục bộ</span></header>
          <textarea data-focus-note maxlength="${MAX_NOTE_LENGTH}" placeholder="Ghi nhanh công thức, từ mới, câu hỏi cần xem lại…">${esc(state.note)}</textarea>
          <footer><span>Dữ liệu không rời khỏi trình duyệt.</span><span data-note-count>${state.note.length.toLocaleString("vi-VN")} / ${MAX_NOTE_LENGTH.toLocaleString("vi-VN")}</span></footer>
        </section>

        <section class="focus-panel focus-stats-panel" id="focus-history" data-focus-history aria-labelledby="focus-history-title">
          <header class="focus-panel__head"><div><span>REAL PROGRESS</span><h3 id="focus-history-title">Nhịp học của bạn</h3></div><button type="button" data-history-clear>Xóa lịch sử</button></header>
          <div class="focus-stats" data-focus-stats></div>
          <div class="focus-history" data-history-list>${historyRows(state)}</div>
        </section>
      </div>
      <aside class="focus-eye-reminder" data-eye-alert hidden role="status"><span aria-hidden="true">◉</span><div><strong>Cho mắt nghỉ 20 giây</strong><p>Nhìn một vật cách khoảng 6 mét, chớp mắt và thả lỏng vai.</p></div><button type="button" data-eye-dismiss>Đã nghỉ</button></aside>
      <div class="focus-toast" data-focus-toast role="status" aria-live="polite" hidden></div>
    </section>`;
  }

  function updateStats(runtime) {
    const stats = computeStats(runtime.state.history);
    const host = runtime.root.querySelector("[data-focus-stats]");
    if (!host) return;
    host.innerHTML = `<article><span>Hôm nay</span><strong>${esc(formatMinutes(stats.todaySeconds))}</strong><small>${stats.todaySessions} phiên hoàn thành</small></article><article><span>7 ngày</span><strong>${esc(formatMinutes(stats.weekSeconds))}</strong><small>${stats.weekSessions} phiên hoàn thành</small></article><article><span>Chuỗi ngày</span><strong>${stats.streak}</strong><small>ngày có phiên hoàn thành</small></article>`;
  }

  function updateTimer(runtime, now = Date.now()) {
    const result = finishExpiredSession(runtime.state, now);
    if (result.completed) {
      runtime.state = result.state;
      writeState(runtime);
      render(runtime);
      toast(runtime, result.completed.mode === "focus" || result.completed.mode === "custom" ? "Hoàn thành một phiên tập trung." : "Đã hết giờ nghỉ.", "success");
      if (runtime.state.timer.status === "running") startTicker(runtime);
      return;
    }
    runtime.state.timer = result.state.timer;
    const snapshot = timerSnapshot(runtime.state.timer, now);
    const clock = runtime.root.querySelector("[data-focus-clock]");
    const progress = runtime.root.querySelector("[data-focus-progress]");
    const start = runtime.root.querySelector("[data-focus-start]");
    if (clock) clock.textContent = formatClock(snapshot.remainingSeconds);
    if (progress) {
      const circumference = 2 * Math.PI * 53;
      const ratio = snapshot.durationSeconds ? snapshot.remainingSeconds / snapshot.durationSeconds : 0;
      progress.style.strokeDasharray = String(circumference);
      progress.style.strokeDashoffset = String(circumference * (1 - clamp(ratio, 0, 1)));
    }
    if (start) start.textContent = snapshot.status === "running" ? "Tạm dừng" : snapshot.status === "paused" ? "Tiếp tục" : "Bắt đầu";
    runtime.root.querySelector("[data-focus-room]")?.setAttribute("data-timer-running", String(snapshot.status === "running"));
    if (snapshot.status === "running" && runtime.state.settings.eyeReminder && now - snapshot.lastEyeReminderAt >= 20 * 60 * 1000) {
      runtime.state.timer.lastEyeReminderAt = now;
      writeState(runtime);
      const alert = runtime.root.querySelector("[data-eye-alert]");
      if (alert) alert.hidden = false;
    }
  }

  function startTicker(runtime) {
    stopTicker(runtime);
    if (globalScope.document?.hidden || runtime.state.timer.status !== "running") return;
    runtime.ticker = globalScope.setInterval?.(() => updateTimer(runtime), 1000) || null;
    updateTimer(runtime);
  }

  function stopTicker(runtime) {
    if (runtime.ticker) globalScope.clearInterval?.(runtime.ticker);
    runtime.ticker = null;
  }

  function toast(runtime, message, tone = "info") {
    const node = runtime.root.querySelector("[data-focus-toast]");
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = tone;
    node.hidden = false;
    globalScope.clearTimeout?.(runtime.toastTimer);
    runtime.toastTimer = globalScope.setTimeout?.(() => { if (node) node.hidden = true; }, 3600);
  }

  function render(runtime) {
    stopTicker(runtime);
    runtime.host.innerHTML = shellMarkup(runtime);
    runtime.root = runtime.host.querySelector("[data-focus-room]");
    updateStats(runtime);
    updateTimer(runtime);
    const prefersReduced = globalScope.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    runtime.root.dataset.motion = runtime.state.settings.reducedMotion || prefersReduced ? "reduced" : "full";
    if (runtime.state.timer.status === "running") startTicker(runtime);
    const audioStatus = runtime.root.querySelector("[data-audio-status]");
    if (audioStatus && runtime.audio.state === "running") audioStatus.textContent = "Đang phát trên thiết bị";
    else if (audioStatus && runtime.audio.suspendedByVisibility) audioStatus.textContent = "Đã tạm dừng khi rời tab";
  }

  function setTimerMode(runtime, mode, now = Date.now()) {
    if (!VALID_MODES.has(mode)) return;
    const durationSeconds = durationFor(mode, runtime.state.settings);
    runtime.state.timer = {
      ...runtime.state.timer,
      mode,
      status: "idle",
      durationSeconds,
      remainingSeconds: durationSeconds,
      endsAt: null,
      startedAt: null,
      lastEyeReminderAt: now
    };
    writeState(runtime);
    render(runtime);
  }

  function toggleTimer(runtime, now = Date.now()) {
    const snapshot = timerSnapshot(runtime.state.timer, now);
    if (snapshot.status === "running") {
      runtime.state.timer = { ...snapshot, status: "paused", endsAt: null };
      stopTicker(runtime);
    } else {
      const remainingSeconds = snapshot.remainingSeconds > 0 ? snapshot.remainingSeconds : snapshot.durationSeconds;
      runtime.state.timer = {
        ...snapshot,
        status: "running",
        remainingSeconds,
        endsAt: now + remainingSeconds * 1000,
        startedAt: snapshot.startedAt || now,
        lastEyeReminderAt: snapshot.lastEyeReminderAt || now
      };
      startTicker(runtime);
    }
    writeState(runtime);
    updateTimer(runtime, now);
  }

  function resetTimer(runtime, now = Date.now()) {
    const durationSeconds = durationFor(runtime.state.timer.mode, runtime.state.settings);
    runtime.state.timer = { ...runtime.state.timer, status: "idle", durationSeconds, remainingSeconds: durationSeconds, endsAt: null, startedAt: null, lastEyeReminderAt: now };
    writeState(runtime);
    stopTicker(runtime);
    updateTimer(runtime, now);
  }

  function skipTimer(runtime, now = Date.now()) {
    const current = runtime.state.timer.mode;
    const nextMode = current === "focus" || current === "custom" ? nextModeAfterFocus(runtime.state.timer.completedFocusCycles, runtime.state.settings) : "focus";
    setTimerMode(runtime, nextMode, now);
    toast(runtime, "Đã chuyển phiên; phiên vừa bỏ qua không được tính vào thống kê.");
  }

  function downloadJson(runtime) {
    if (typeof Blob !== "function" || !globalScope.URL?.createObjectURL || !globalScope.document?.createElement) return false;
    const payload = { type: "hh-focus-study-room", version: VERSION, owner: runtime.ownerId, exportedAt: new Date().toISOString(), state: runtime.state };
    const url = globalScope.URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }));
    const link = globalScope.document.createElement("a");
    link.href = url;
    link.download = `hh-focus-room-${dayKey()}.json`;
    link.click();
    globalScope.setTimeout?.(() => globalScope.URL.revokeObjectURL(url), 1000);
    return true;
  }

  async function importJson(runtime, file) {
    if (!file) return;
    if (file.size > 1000000) throw new Error("Tệp vượt giới hạn 1 MB.");
    const payload = JSON.parse(await file.text());
    if (payload?.type !== "hh-focus-study-room" || !payload.state || Number(payload.version) !== VERSION) throw new Error("Tệp không đúng định dạng Phòng học tập trung v1.");
    const next = normalizeState(payload.state);
    next.timer.status = "paused";
    next.timer.endsAt = null;
    runtime.state = next;
    writeState(runtime);
    render(runtime);
    toast(runtime, "Đã nhập dữ liệu. Timer được tạm dừng để tránh chạy ngoài ý muốn.", "success");
  }

  function bindEvents(runtime) {
    const signal = runtime.controller.signal;
    runtime.host.addEventListener("click", (event) => {
      const target = event.target.closest("button, [data-focus-jump]");
      if (!target || !runtime.root?.contains(target)) return;
      if (target.matches("[data-focus-start]")) return toggleTimer(runtime);
      if (target.matches("[data-focus-reset]")) return resetTimer(runtime);
      if (target.matches("[data-focus-skip]")) return skipTimer(runtime);
      if (target.matches("[data-focus-mode]")) return setTimerMode(runtime, target.dataset.focusMode);
      if (target.matches("[data-focus-settings]")) {
        const panel = runtime.root.querySelector("[data-focus-settings-form]");
        if (panel) panel.hidden = !panel.hidden;
        target.setAttribute("aria-expanded", String(panel && !panel.hidden));
        return;
      }
      if (target.matches("[data-focus-jump='history']")) return runtime.root.querySelector("[data-focus-history]")?.scrollIntoView({ behavior: runtime.root.dataset.motion === "reduced" ? "auto" : "smooth", block: "start" });
      if (target.matches("[data-focus-export]")) {
        const exported = downloadJson(runtime);
        return toast(runtime, exported ? "Đã xuất bản sao JSON." : "Trình duyệt không hỗ trợ xuất tệp.", exported ? "success" : "error");
      }
      if (target.matches("[data-task-active]")) {
        runtime.state.timer.taskId = target.dataset.taskActive;
        writeState(runtime);
        render(runtime);
        return toast(runtime, "Đã chọn mục tiêu cho phiên tiếp theo.", "success");
      }
      if (target.matches("[data-task-edit]")) {
        const task = runtime.state.tasks.find((item) => item.id === target.dataset.taskEdit);
        const title = task && globalScope.prompt?.("Sửa việc học:", task.title)?.trim();
        if (task && title) { task.title = clean(title, 160); writeState(runtime); render(runtime); toast(runtime, "Đã cập nhật việc học.", "success"); }
        return;
      }
      if (target.matches("[data-task-delete]")) {
        const taskId = target.dataset.taskDelete;
        runtime.state.tasks = runtime.state.tasks.filter((item) => item.id !== taskId);
        if (runtime.state.timer.taskId === taskId) runtime.state.timer.taskId = null;
        writeState(runtime); render(runtime);
        return;
      }
      if (target.matches("[data-task-move]")) {
        const from = Number(target.dataset.taskIndex);
        const to = target.dataset.taskMove === "up" ? from - 1 : from + 1;
        if (from >= 0 && to >= 0 && to < runtime.state.tasks.length) {
          [runtime.state.tasks[from], runtime.state.tasks[to]] = [runtime.state.tasks[to], runtime.state.tasks[from]];
          writeState(runtime); render(runtime);
        }
        return;
      }
      if (target.matches("[data-task-clear]")) {
        runtime.state.tasks = runtime.state.tasks.filter((task) => !task.done);
        if (!runtime.state.tasks.some((task) => task.id === runtime.state.timer.taskId)) runtime.state.timer.taskId = null;
        writeState(runtime); render(runtime);
        return;
      }
      if (target.matches("[data-audio-resume]")) {
        runtime.audio.resume().then(() => {
          Object.entries(runtime.state.sound).forEach(([kind, volume]) => runtime.audio.set(kind, volume));
          const status = runtime.root.querySelector("[data-audio-status]");
          if (status) status.textContent = "Đang phát trên thiết bị";
        }).catch((error) => toast(runtime, error.message, "error"));
        return;
      }
      if (target.matches("[data-audio-stop]")) {
        runtime.audio.close();
        runtime.state.sound = { rain: 0, brown: 0, cafe: 0 };
        writeState(runtime); render(runtime);
        return toast(runtime, "Đã tắt toàn bộ âm thanh.");
      }
      if (target.matches("[data-eye-dismiss]")) {
        const alert = runtime.root.querySelector("[data-eye-alert]");
        if (alert) alert.hidden = true;
        return;
      }
      if (target.matches("[data-history-clear]")) {
        if (runtime.state.history.length && !globalScope.confirm?.("Xóa toàn bộ lịch sử phiên trên thiết bị này?")) return;
        runtime.state.history = [];
        writeState(runtime); render(runtime);
        return toast(runtime, "Đã xóa lịch sử phiên trên thiết bị.");
      }
    }, { signal });

    runtime.host.addEventListener("submit", (event) => {
      if (event.target.matches("[data-task-form]")) {
        event.preventDefault();
        const data = new FormData(event.target);
        const title = clean(data.get("title"), 160);
        if (!title) return;
        const task = normalizeTask({ id: id("task"), title, priority: data.get("priority"), estimate: data.get("estimate"), createdAt: new Date().toISOString() });
        runtime.state.tasks.push(task);
        runtime.state.tasks = runtime.state.tasks.slice(-MAX_TASKS);
        if (!runtime.state.timer.taskId) runtime.state.timer.taskId = task.id;
        writeState(runtime); render(runtime); toast(runtime, "Đã thêm việc học.", "success");
        return;
      }
      if (event.target.matches("[data-focus-settings-form]")) {
        event.preventDefault();
        const data = new FormData(event.target);
        runtime.state.settings = normalizeSettings({
          focusMinutes: data.get("focusMinutes"), shortBreakMinutes: data.get("shortBreakMinutes"), longBreakMinutes: data.get("longBreakMinutes"), customMinutes: data.get("customMinutes"), longBreakEvery: data.get("longBreakEvery"),
          autoStartBreaks: data.has("autoStartBreaks"), autoStartFocus: data.has("autoStartFocus"), eyeReminder: data.has("eyeReminder"), reducedMotion: data.has("reducedMotion")
        });
        if (runtime.state.timer.status === "idle") {
          runtime.state.timer.durationSeconds = durationFor(runtime.state.timer.mode, runtime.state.settings);
          runtime.state.timer.remainingSeconds = runtime.state.timer.durationSeconds;
        }
        writeState(runtime); render(runtime); toast(runtime, "Đã lưu cài đặt tập trung.", "success");
      }
    }, { signal });

    runtime.host.addEventListener("change", (event) => {
      if (event.target.matches("[data-task-toggle]")) {
        const task = runtime.state.tasks.find((item) => item.id === event.target.dataset.taskToggle);
        if (task) {
          task.done = event.target.checked;
          task.completedAt = task.done ? new Date().toISOString() : null;
          if (task.done && runtime.state.timer.taskId === task.id) runtime.state.timer.taskId = null;
          writeState(runtime); render(runtime);
        }
        return;
      }
      if (event.target.matches("[data-focus-task]")) {
        runtime.state.timer.taskId = clean(event.target.value, 100) || null;
        writeState(runtime);
        return;
      }
      if (event.target.matches("[data-focus-import]")) {
        const input = event.target;
        importJson(runtime, input.files?.[0]).catch((error) => toast(runtime, error.message || "Không thể nhập dữ liệu.", "error")).finally(() => { input.value = ""; });
      }
    }, { signal });

    runtime.host.addEventListener("input", (event) => {
      if (event.target.matches("[data-focus-note]")) {
        runtime.state.note = String(event.target.value).slice(0, MAX_NOTE_LENGTH);
        const count = runtime.root.querySelector("[data-note-count]");
        const status = runtime.root.querySelector("[data-note-status]");
        if (count) count.textContent = `${runtime.state.note.length.toLocaleString("vi-VN")} / ${MAX_NOTE_LENGTH.toLocaleString("vi-VN")}`;
        if (status) status.textContent = "Đang lưu…";
        globalScope.clearTimeout?.(runtime.noteTimer);
        runtime.noteTimer = globalScope.setTimeout?.(() => {
          writeState(runtime);
          const latestStatus = runtime.root?.querySelector("[data-note-status]");
          if (latestStatus) latestStatus.textContent = runtime.storageError ? "Không thể lưu trên thiết bị" : "Đã lưu cục bộ";
        }, 320);
        return;
      }
      if (event.target.matches("[data-sound]")) {
        const kind = event.target.dataset.sound;
        const volume = clamp(Number(event.target.value) / 100, 0, 1);
        runtime.state.sound[kind] = volume;
        event.target.parentElement?.querySelector("output")?.replaceChildren(`${Math.round(volume * 100)}%`);
        writeState(runtime);
        runtime.audio.set(kind, volume).then(() => {
          const status = runtime.root.querySelector("[data-audio-status]");
          if (status) status.textContent = Object.values(runtime.state.sound).some((value) => value > 0) ? "Đang phát trên thiết bị" : "Đang tắt";
        }).catch((error) => toast(runtime, error.message, "error"));
      }
    }, { signal });

    globalScope.document?.addEventListener("visibilitychange", () => {
      if (globalScope.document.hidden) {
        stopTicker(runtime);
        if (runtime.audio.suspendForVisibility()) {
          const status = runtime.root?.querySelector("[data-audio-status]");
          if (status) status.textContent = "Đã tạm dừng khi rời tab";
        }
      } else {
        const result = finishExpiredSession(runtime.state);
        runtime.state = result.state;
        if (result.completed) { writeState(runtime); render(runtime); toast(runtime, "Phiên đã hoàn thành khi tab ẩn.", "success"); }
        else if (runtime.state.timer.status === "running") startTicker(runtime);
      }
    }, { signal });
  }

  function mount(host, options = {}) {
    if (!host) return false;
    unmount(host);
    const ownerId = ownerIdFor(options.currentUser);
    const runtime = {
      host,
      ownerId,
      storage: options.storage || globalScope.localStorage,
      state: readState(options.storage || globalScope.localStorage, ownerId),
      audio: createAmbientMixer(globalScope),
      controller: new AbortController(),
      ticker: null,
      toastTimer: null,
      noteTimer: null,
      root: null,
      storageError: false
    };
    const restored = finishExpiredSession(runtime.state);
    runtime.state = restored.state;
    if (restored.completed) writeState(runtime);
    mounted.set(host, runtime);
    render(runtime);
    bindEvents(runtime);
    return true;
  }

  function unmount(host) {
    const targets = host ? [host] : [];
    if (!host && globalScope.document) globalScope.document.querySelectorAll("[data-focus-study-room-host]").forEach((node) => targets.push(node));
    targets.forEach((target) => {
      const runtime = mounted.get(target);
      if (!runtime) return;
      globalScope.clearTimeout?.(runtime.noteTimer);
      if (runtime.noteTimer) writeState(runtime);
      globalScope.clearTimeout?.(runtime.toastTimer);
      stopTicker(runtime);
      runtime.audio.close();
      runtime.controller.abort();
      mounted.delete(target);
    });
  }

  return Object.freeze({
    VERSION, STORAGE_PREFIX, ownerIdFor, storageKey, defaultState, normalizeSettings, normalizeState,
    durationFor, timerSnapshot, finishExpiredSession, computeStats, createAmbientMixer, mount, unmount
  });
});
