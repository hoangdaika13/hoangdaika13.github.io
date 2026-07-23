(function attachHHGameRuntime(root, factory) {
  const runtime = factory(root);

  if (root) {
    root.HHGameRuntime = runtime;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = runtime;
  }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this), function createRuntime(root) {
  "use strict";

  const VERSION = "1.0.0";
  const SCHEMA_VERSION = 1;
  const STORAGE_PREFIX = "hh.game.runtime.";
  const SLOT_NAMES = ["slot-1", "slot-2", "slot-3"];
  const DIFFICULTIES = ["easy", "normal", "hard"];
  const LIFECYCLE = [
    "created",
    "loading",
    "ready",
    "running",
    "paused",
    "offline",
    "gameover",
    "result",
    "error",
    "destroyed"
  ];
  const VALID_STATUSES = new Set(LIFECYCLE.filter((status) => status !== "created" && status !== "destroyed"));
  const transitions = {
    created: ["loading", "error", "destroyed"],
    loading: ["ready", "running", "offline", "error", "destroyed"],
    ready: ["running", "paused", "offline", "gameover", "result", "loading", "error", "destroyed"],
    running: ["paused", "offline", "gameover", "result", "ready", "loading", "error", "destroyed"],
    paused: ["running", "offline", "gameover", "result", "loading", "error", "destroyed"],
    offline: ["running", "paused", "ready", "loading", "error", "destroyed"],
    gameover: ["result", "ready", "loading", "destroyed", "error"],
    result: ["ready", "running", "loading", "destroyed", "error"],
    error: ["loading", "ready", "offline", "destroyed"],
    destroyed: []
  };

  let sessionSequence = 0;
  const sessions = new Map();
  const memoryStore = new Map();

  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const getDocument = () => (root && root.document ? root.document : null);
  const getNavigator = () => (root && root.navigator ? root.navigator : null);
  const getNow = () => {
    const performance = root && root.performance;
    return performance && typeof performance.now === "function" ? performance.now() : Date.now();
  };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  const safeJson = (value) => {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return "";
    }
  };

  function sanitize(value, options, depth, seen) {
    const config = options || {};
    const currentDepth = depth || 0;
    const maxDepth = Number.isInteger(config.maxDepth) ? config.maxDepth : 6;
    const maxString = Number.isInteger(config.maxString) ? config.maxString : 2000;
    const maxItems = Number.isInteger(config.maxItems) ? config.maxItems : 100;
    const maxKeys = Number.isInteger(config.maxKeys) ? config.maxKeys : 100;
    const visited = seen || new Set();

    if (value === null || typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
      return value.slice(0, maxString);
    }
    if (typeof value === "bigint") {
      return String(value).slice(0, maxString);
    }
    if (typeof value !== "object" || currentDepth >= maxDepth) {
      return undefined;
    }
    if (visited.has(value)) {
      return "[Circular]";
    }
    visited.add(value);

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }
    if (Array.isArray(value)) {
      const items = value.slice(0, maxItems).map((item) => sanitize(item, config, currentDepth + 1, visited));
      visited.delete(value);
      return items.map((item) => (item === undefined ? null : item));
    }

    const output = {};
    Object.keys(value).slice(0, maxKeys).forEach((key) => {
      if (key === "__proto__" || key === "prototype" || key === "constructor") {
        return;
      }
      const item = sanitize(value[key], config, currentDepth + 1, visited);
      if (item !== undefined) {
        output[key.slice(0, 120)] = item;
      }
    });
    visited.delete(value);
    return output;
  }

  function safeEvent(name, detail) {
    const doc = getDocument();
    const EventConstructor = root && root.CustomEvent;
    const eventDetail = sanitize(detail, { maxDepth: 5, maxString: 1000, maxItems: 50, maxKeys: 50 }) || {};

    if (typeof EventConstructor === "function") {
      return new EventConstructor(name, { detail: eventDetail });
    }
    if (root && typeof root.Event === "function") {
      const event = new root.Event(name);
      event.detail = eventDetail;
      return event;
    }
    return { type: name, detail: eventDetail };
  }

  function dispatchDocumentEvent(name, detail) {
    const doc = getDocument();
    const event = safeEvent(name, detail);
    if (doc && typeof doc.dispatchEvent === "function") {
      try {
        doc.dispatchEvent(event);
      } catch (error) {
        // A test DOM may not implement the full EventTarget contract.
      }
    }
    if (root && typeof root.dispatchEvent === "function") {
      try {
        root.dispatchEvent(event);
      } catch (error) {
        // Window dispatch is optional.
      }
    }
    return event;
  }

  function resolveElement(value) {
    const doc = getDocument();
    if (!value) {
      return doc && doc.body ? doc.body : null;
    }
    if (typeof value === "string" && doc && typeof doc.querySelector === "function") {
      return doc.querySelector(value);
    }
    return value && typeof value.appendChild === "function" ? value : null;
  }

  function storageFor(config) {
    if (config && config.storage && typeof config.storage.getItem === "function") {
      return config.storage;
    }
    if (root && root.localStorage && typeof root.localStorage.getItem === "function") {
      return root.localStorage;
    }
    return {
      getItem(key) {
        return memoryStore.has(key) ? memoryStore.get(key) : null;
      },
      setItem(key, value) {
        memoryStore.set(key, String(value));
      },
      removeItem(key) {
        memoryStore.delete(key);
      }
    };
  }

  function normalizeGameId(value) {
    const id = String(value || "game").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    return id.slice(0, 48) || "game";
  }

  function normalizeSlot(slot) {
    const value = String(slot || SLOT_NAMES[0]).trim().toLowerCase();
    if (!SLOT_NAMES.includes(value)) {
      throw new RangeError(`Invalid save slot: ${value}`);
    }
    return value;
  }

  function getStorageKey(gameId, slot) {
    return `${STORAGE_PREFIX}${gameId}.${slot}`;
  }

  function normalizeEnvelope(value, gameId, slot) {
    if (!value || typeof value !== "object" || value.gameId !== gameId || value.slot !== slot) {
      return null;
    }
    const version = Number.isInteger(value.version) && value.version > 0 ? value.version : 0;
    const savedAt = typeof value.savedAt === "string" ? value.savedAt.slice(0, 40) : "";
    return {
      schemaVersion: SCHEMA_VERSION,
      gameId,
      slot,
      version,
      savedAt,
      state: sanitize(value.state, { maxDepth: 6, maxString: 2000, maxItems: 100, maxKeys: 100 }) || {}
    };
  }

  function readEnvelope(storage, gameId, slot) {
    try {
      const raw = storage.getItem(getStorageKey(gameId, slot));
      return raw ? normalizeEnvelope(JSON.parse(raw), gameId, slot) : null;
    } catch (error) {
      return null;
    }
  }

  function createAudioManager(session, config, emit) {
    const initial = config && config.audio && typeof config.audio === "object" ? config.audio : {};
    const audio = {
      muted: Boolean(initial.muted),
      sfxMuted: Boolean(initial.sfxMuted),
      musicMuted: Boolean(initial.musicMuted),
      sfxVolume: clamp(Number(initial.sfxVolume), 0, 1),
      musicVolume: clamp(Number(initial.musicVolume), 0, 1),
      context: null,
      music: null,
      sources: []
    };
    if (!Number.isFinite(Number(initial.sfxVolume))) {
      audio.sfxVolume = 0.45;
    }
    if (!Number.isFinite(Number(initial.musicVolume))) {
      audio.musicVolume = 0.3;
    }

    function contextConstructor() {
      return root && (root.AudioContext || root.webkitAudioContext);
    }

    function ensureContext() {
      const AudioContext = contextConstructor();
      if (!AudioContext || audio.muted || audio.sfxMuted) {
        return null;
      }
      if (!audio.context) {
        try {
          audio.context = new AudioContext();
        } catch (error) {
          return null;
        }
      }
      if (audio.context.state === "suspended" && typeof audio.context.resume === "function") {
        audio.context.resume().catch(() => {});
      }
      return audio.context;
    }

    function playSfx(options) {
      const settings = typeof options === "string" ? { type: options } : (options || {});
      const context = ensureContext();
      if (!context) {
        return false;
      }
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime;
      const duration = clamp(Number(settings.duration) || 0.08, 0.03, 1.5);
      const frequency = clamp(Number(settings.frequency) || 440, 80, 1800);
      oscillator.type = ["sine", "triangle", "square", "sawtooth"].includes(settings.wave) ? settings.wave : "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(Math.max(0.001, audio.sfxVolume * 0.18), start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
      audio.sources.push(oscillator);
      oscillator.addEventListener?.("ended", () => {
        audio.sources = audio.sources.filter((source) => source !== oscillator);
      });
      return true;
    }

    function playMusic(source, options) {
      const settings = typeof source === "string" ? { url: source, ...(options || {}) } : (source || {});
      if (!settings.url || audio.muted || audio.musicMuted || !root || typeof root.Audio !== "function") {
        return false;
      }
      stopMusic();
      try {
        const player = new root.Audio(settings.url);
        player.loop = settings.loop !== false;
        player.volume = clamp(Number(settings.volume) || audio.musicVolume, 0, 1);
        audio.music = player;
        const result = player.play();
        if (result && typeof result.catch === "function") {
          result.catch(() => {});
        }
        return true;
      } catch (error) {
        return false;
      }
    }

    function stopMusic() {
      if (audio.music) {
        try {
          audio.music.pause();
          audio.music.currentTime = 0;
        } catch (error) {
          // Ignore a media element that has already been detached.
        }
        audio.music = null;
      }
    }

    function setAudio(patch) {
      const next = patch && typeof patch === "object" ? patch : {};
      ["muted", "sfxMuted", "musicMuted"].forEach((key) => {
        if (hasOwn(next, key)) {
          audio[key] = Boolean(next[key]);
        }
      });
      ["sfxVolume", "musicVolume"].forEach((key) => {
        if (hasOwn(next, key)) {
          audio[key] = clamp(Number(next[key]), 0, 1);
        }
      });
      if (audio.music && hasOwn(next, "musicVolume")) {
        audio.music.volume = audio.musicMuted || audio.muted ? 0 : audio.musicVolume;
      }
      const snapshot = getAudio();
      emit("audio", snapshot);
      return snapshot;
    }

    function getAudio() {
      return {
        muted: audio.muted,
        sfxMuted: audio.sfxMuted,
        musicMuted: audio.musicMuted,
        sfxVolume: audio.sfxVolume,
        musicVolume: audio.musicVolume
      };
    }

    function destroy() {
      stopMusic();
      audio.sources.forEach((source) => {
        try {
          source.stop();
        } catch (error) {
          // Oscillator may already be stopped.
        }
      });
      audio.sources = [];
      if (audio.context && typeof audio.context.close === "function") {
        audio.context.close().catch(() => {});
      }
      audio.context = null;
    }

    return { setAudio, getAudio, playSfx, playMusic, stopMusic, destroy };
  }

  function createInputController(session, config, emit) {
    const doc = getDocument();
    const navigator = getNavigator();
    const target = resolveElement(config && config.inputTarget) || resolveElement(config && config.container) || doc;
    const keyState = new Set();
    const buttonState = new Set();
    const pointers = new Map();
    const gamepads = new Map();
    const handlers = new Set();
    const cleanups = [];
    let runtimeSession = session;
    let gamepadTimer = null;
    let bound = false;

    function emitInput(packet) {
      const detail = sanitize({
        type: packet.type,
        source: packet.source || "unknown",
        action: packet.action || "",
        code: packet.code || "",
        key: packet.key || "",
        button: packet.button || "",
        pointerType: packet.pointerType || "",
        pointerId: Number.isFinite(packet.pointerId) ? packet.pointerId : undefined,
        x: Number.isFinite(packet.x) ? Math.round(packet.x) : undefined,
        y: Number.isFinite(packet.y) ? Math.round(packet.y) : undefined,
        value: Number.isFinite(packet.value) ? Number(packet.value.toFixed(3)) : undefined
      }, { maxDepth: 2, maxString: 80, maxItems: 20, maxKeys: 20 }) || {};
      handlers.forEach((handler) => {
        try {
          handler(detail);
        } catch (error) {
          emit("error", { code: "INPUT_HANDLER_ERROR", message: error.message || "Input handler failed" });
        }
      });
      emit("input", detail);
      if (config && typeof config.onInput === "function") {
        try {
          config.onInput(detail, runtimeSession);
        } catch (error) {
          emit("error", { code: "INPUT_CALLBACK_ERROR", message: error.message || "Input callback failed" });
        }
      }
      return detail;
    }

    function addListener(element, eventName, handler, options) {
      if (!element || typeof element.addEventListener !== "function") {
        return;
      }
      element.addEventListener(eventName, handler, options);
      cleanups.push(() => element.removeEventListener?.(eventName, handler, options));
    }

    function keyboardDown(event) {
      if (event && event.target && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) {
        return;
      }
      const code = String(event.code || event.key || "").slice(0, 80);
      if (code) {
        keyState.add(code);
      }
      const prevent = config && Array.isArray(config.preventKeys) && config.preventKeys.includes(code);
      if (prevent) {
        event.preventDefault?.();
      }
      emitInput({ type: "keydown", source: "keyboard", code, key: event.key });
    }

    function keyboardUp(event) {
      const code = String(event.code || event.key || "").slice(0, 80);
      keyState.delete(code);
      emitInput({ type: "keyup", source: "keyboard", code, key: event.key });
    }

    function pointer(type, event) {
      const pointerId = Number.isFinite(event.pointerId) ? event.pointerId : 0;
      const x = Number(event.clientX) || 0;
      const y = Number(event.clientY) || 0;
      if (type === "pointerdown") {
        pointers.set(pointerId, { x, y, pointerType: event.pointerType || "mouse" });
        buttonState.add(String(event.button ?? 0));
      } else if (type === "pointerup" || type === "pointercancel") {
        pointers.delete(pointerId);
        buttonState.delete(String(event.button ?? 0));
      } else if (pointers.has(pointerId)) {
        pointers.set(pointerId, { x, y, pointerType: event.pointerType || "mouse" });
      }
      emitInput({
        type,
        source: "pointer",
        pointerId,
        pointerType: event.pointerType || "mouse",
        x,
        y,
        button: String(event.button ?? 0)
      });
    }

    function touch(type, event) {
      const touchPoint = event.changedTouches && event.changedTouches[0];
      if (!touchPoint) {
        return;
      }
      pointer(type, {
        pointerId: touchPoint.identifier,
        pointerType: "touch",
        clientX: touchPoint.clientX,
        clientY: touchPoint.clientY,
        button: 0
      });
    }

    function pollGamepads() {
      if (!navigator || typeof navigator.getGamepads !== "function") {
        return;
      }
      const connected = Array.from(navigator.getGamepads() || []).filter(Boolean).slice(0, 4);
      connected.forEach((pad) => {
        const previous = gamepads.get(pad.index) || [];
        const next = Array.from(pad.buttons || []).map((button) => Boolean(button.pressed));
        next.forEach((pressed, index) => {
          if (pressed !== Boolean(previous[index])) {
            emitInput({
              type: pressed ? "gamepaddown" : "gamepadup",
              source: "gamepad",
              code: `button-${index}`,
              value: pad.buttons[index].value
            });
          }
        });
        gamepads.set(pad.index, next);
      });
      const connectedIndexes = new Set(connected.map((pad) => pad.index));
      Array.from(gamepads.keys()).forEach((index) => {
        if (!connectedIndexes.has(index)) {
          gamepads.delete(index);
        }
      });
    }

    function bind() {
      if (bound) {
        return;
      }
      bound = true;
      addListener(doc, "keydown", keyboardDown);
      addListener(doc, "keyup", keyboardUp);
      ["pointerdown", "pointermove", "pointerup", "pointercancel"].forEach((eventName) => {
        addListener(target, eventName, (event) => pointer(eventName, event));
      });
      if (!(root && root.PointerEvent)) {
        ["touchstart", "touchmove", "touchend", "touchcancel"].forEach((eventName) => {
          addListener(target, eventName, (event) => touch(eventName.replace("touch", "pointer"), event), { passive: true });
        });
      }
      if (navigator && typeof navigator.getGamepads === "function" && root && typeof root.setInterval === "function") {
        gamepadTimer = root.setInterval(pollGamepads, 120);
      }
    }

    function unbind() {
      cleanups.splice(0).forEach((cleanup) => cleanup());
      if (gamepadTimer !== null && root && typeof root.clearInterval === "function") {
        root.clearInterval(gamepadTimer);
      }
      gamepadTimer = null;
      keyState.clear();
      buttonState.clear();
      pointers.clear();
      gamepads.clear();
      bound = false;
    }

    function on(handler) {
      if (typeof handler !== "function") {
        return () => {};
      }
      handlers.add(handler);
      return () => handlers.delete(handler);
    }

    function getState() {
      return {
        keys: Array.from(keyState).slice(0, 100),
        buttons: Array.from(buttonState).slice(0, 20),
        pointers: Array.from(pointers.entries()).slice(0, 10).map(([id, point]) => ({ id, ...point })),
        gamepads: Array.from(gamepads.entries()).map(([index, buttons]) => ({ index, pressed: buttons.filter(Boolean).length }))
      };
    }

    function bindSession(value) {
      runtimeSession = value;
    }

    return { bind, unbind, on, getState, bindSession };
  }

  function createOverlay(session, config, emit) {
    const presets = {
      loading: {
        title: "Đang tải game",
        message: "Đang chuẩn bị tài nguyên và phiên chơi.",
        primary: "",
        secondary: ""
      },
      tutorial: {
        title: "Hướng dẫn chơi",
        message: "Khám phá các nút điều khiển và mục tiêu trước khi bắt đầu.",
        primary: "Bắt đầu chơi",
        action: "start"
      },
      pause: {
        title: "Đã tạm dừng",
        message: "Tiến trình hiện tại đã được giữ lại.",
        primary: "Tiếp tục",
        action: "resume",
        secondary: "Chơi lại",
        secondaryAction: "restart"
      },
      gameover: {
        title: "Kết thúc lượt chơi",
        message: "Bạn có thể xem kết quả hoặc chơi lại.",
        primary: "Chơi lại",
        action: "restart",
        secondary: "Xem kết quả",
        secondaryAction: "result"
      },
      result: {
        title: "Kết quả",
        message: "Lượt chơi đã được lưu vào lịch sử của bạn.",
        primary: "Chơi lại",
        action: "restart",
        secondary: "Đóng",
        secondaryAction: "close"
      },
      error: {
        title: "Không thể tiếp tục",
        message: "Đã có lỗi xảy ra. Bạn có thể thử lại.",
        primary: "Thử lại",
        action: "retry",
        secondary: "Đóng",
        secondaryAction: "close"
      }
    };
    let shell = null;
    let body = null;
    let title = null;
    let message = null;
    let status = null;
    let primaryButton = null;
    let secondaryButton = null;
    let current = null;
    let runtimeSession = session;
    const host = resolveElement(config && config.container);
    const doc = getDocument();

    function ensure() {
      if (shell || !doc || typeof doc.createElement !== "function") {
        return Boolean(shell);
      }
      shell = doc.createElement("section");
      shell.className = "hh-game-runtime";
      shell.hidden = true;
      shell.setAttribute("aria-label", "Điều khiển game");
      shell.innerHTML = [
        '<div class="hh-game-runtime__backdrop" data-runtime-dismiss></div>',
        '<div class="hh-game-runtime__dialog" role="dialog" aria-modal="true" aria-labelledby="hh-game-runtime-title" aria-describedby="hh-game-runtime-message">',
        '  <div class="hh-game-runtime__status" data-runtime-status aria-live="polite"></div>',
        '  <div class="hh-game-runtime__spinner" aria-hidden="true"></div>',
        '  <h2 id="hh-game-runtime-title" data-runtime-title></h2>',
        '  <p data-runtime-message></p>',
        '  <div class="hh-game-runtime__actions">',
        '    <button type="button" class="hh-game-runtime__button hh-game-runtime__button--primary" data-runtime-primary></button>',
        '    <button type="button" class="hh-game-runtime__button hh-game-runtime__button--secondary" data-runtime-secondary></button>',
        "  </div>",
        "</div>"
      ].join("");
      title = shell.querySelector("[data-runtime-title]");
      message = shell.querySelector("[data-runtime-message]");
      status = shell.querySelector("[data-runtime-status]");
      body = shell.querySelector(".hh-game-runtime__dialog");
      primaryButton = shell.querySelector("[data-runtime-primary]");
      secondaryButton = shell.querySelector("[data-runtime-secondary]");
      shell.addEventListener("click", (event) => {
        const action = event.target && event.target.dataset ? event.target.dataset.runtimeAction : "";
        if (!action) {
          return;
        }
        if (action === "start") {
          hide();
          runtimeSession.resume();
        } else if (action === "resume") {
          runtimeSession.resume();
        } else if (action === "restart") {
          runtimeSession.restart();
        } else if (action === "retry") {
          runtimeSession.retry();
        } else if (action === "result") {
          runtimeSession.setStatus("result");
        } else if (action === "close") {
          hide();
        }
      });
      shell.querySelector("[data-runtime-dismiss]")?.addEventListener("click", () => {
        if (current && current.dismissible) {
          hide();
        }
      });
      (host || doc.body)?.appendChild(shell);
      return true;
    }

    function show(kind, data) {
      if (!ensure()) {
        return false;
      }
      const preset = presets[kind] || presets.error;
      const values = data && typeof data === "object" ? data : {};
      current = { kind, dismissible: Boolean(values.dismissible) };
      shell.hidden = false;
      shell.dataset.state = kind;
      title.textContent = String(values.title || preset.title).slice(0, 120);
      message.textContent = String(values.message || preset.message).slice(0, 500);
      status.textContent = String(values.status || "").slice(0, 120);
      status.hidden = !status.textContent;
      shell.querySelector(".hh-game-runtime__spinner").hidden = kind !== "loading";
      configureButton(primaryButton, values.primary ?? preset.primary, values.action || preset.action);
      configureButton(secondaryButton, values.secondary ?? preset.secondary, values.secondaryAction || preset.secondaryAction);
      emit("overlay", { visible: true, kind, title: title.textContent });
      return true;
    }

    function configureButton(button, label, action) {
      if (!button) {
        return;
      }
      button.textContent = String(label || "").slice(0, 80);
      button.hidden = !button.textContent || !action;
      if (action) {
        button.dataset.runtimeAction = action;
      } else {
        delete button.dataset.runtimeAction;
      }
    }

    function hide() {
      if (!shell) {
        return;
      }
      shell.hidden = true;
      current = null;
      emit("overlay", { visible: false });
    }

    function destroy() {
      shell?.remove();
      shell = null;
      current = null;
    }

    function bindSession(value) {
      runtimeSession = value;
    }

    return { show, hide, destroy, bindSession };
  }

  function createPerformanceMonitor(session, config, emit) {
    const sampleMs = clamp(Number(config && config.performanceSampleMs) || 1000, 250, 5000);
    const requestedQuality = ["low", "medium", "high"].includes(config && config.quality) ? config.quality : "auto";
    let quality = requestedQuality === "auto" ? "high" : requestedQuality;
    let running = false;
    let handle = null;
    let frameCount = 0;
    let lastFrame = 0;
    let sampleStart = 0;
    let fps = 0;
    let frameTime = 0;
    let slowSamples = 0;
    let fastSamples = 0;
    let reducedMotion = Boolean(config && config.reducedMotion);
    const doc = getDocument();

    if (!reducedMotion && root && typeof root.matchMedia === "function") {
      try {
        reducedMotion = Boolean(root.matchMedia("(prefers-reduced-motion: reduce)").matches);
      } catch (error) {
        reducedMotion = false;
      }
    }

    function frame(timestamp) {
      if (!running) {
        return;
      }
      const current = Number(timestamp) || getNow();
      if (lastFrame) {
        frameTime = current - lastFrame;
      }
      lastFrame = current;
      frameCount += 1;
      if (!sampleStart) {
        sampleStart = current;
      }
      if (current - sampleStart >= sampleMs) {
        fps = Math.round((frameCount * 1000) / Math.max(1, current - sampleStart));
        const memory = root && root.performance && root.performance.memory;
        if (requestedQuality === "auto") {
          if (fps < 45) {
            slowSamples += 1;
            fastSamples = 0;
          } else if (fps > 58) {
            fastSamples += 1;
            slowSamples = 0;
          } else {
            slowSamples = 0;
            fastSamples = 0;
          }
          if (slowSamples >= 2 && quality !== "low") {
            quality = quality === "high" ? "medium" : "low";
            slowSamples = 0;
          }
          if (fastSamples >= 4 && quality !== "high") {
            quality = quality === "low" ? "medium" : "high";
            fastSamples = 0;
          }
        }
        emit("performance", {
          fps,
          frameTime: Number(frameTime.toFixed(2)),
          quality,
          reducedMotion,
          memory: memory && Number.isFinite(memory.usedJSHeapSize) ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : null,
          hidden: Boolean(doc && doc.hidden)
        });
        frameCount = 0;
        sampleStart = current;
      }
      handle = scheduleFrame(frame);
    }

    function scheduleFrame(callback) {
      if (root && typeof root.requestAnimationFrame === "function") {
        return { type: "raf", id: root.requestAnimationFrame(callback) };
      }
      if (root && typeof root.setTimeout === "function") {
        return { type: "timeout", id: root.setTimeout(() => callback(getNow()), 16) };
      }
      return null;
    }

    function cancelFrame(frameHandle) {
      if (!frameHandle || !root) {
        return;
      }
      if (frameHandle.type === "raf" && typeof root.cancelAnimationFrame === "function") {
        root.cancelAnimationFrame(frameHandle.id);
      } else if (frameHandle.type === "timeout" && typeof root.clearTimeout === "function") {
        root.clearTimeout(frameHandle.id);
      }
    }

    function start() {
      if (running) {
        return;
      }
      running = true;
      frameCount = 0;
      lastFrame = 0;
      sampleStart = 0;
      handle = scheduleFrame(frame);
    }

    function stop() {
      running = false;
      cancelFrame(handle);
      handle = null;
    }

    function inspect() {
      return { fps, frameTime: Number(frameTime.toFixed(2)), quality, reducedMotion, running };
    }

    return { start, stop, inspect };
  }

  function create(config) {
    const options = config && typeof config === "object" ? config : {};
    const gameId = normalizeGameId(options.id || options.gameId);
    const sessionId = `${gameId}-${++sessionSequence}`;
    const storage = storageFor(options);
    const listeners = new Map();
    const achievements = new Map();
    const stats = { starts: 0, pauses: 0, restarts: 0, checkpoints: 0, restores: 0, rewards: 0 };
    let lifecycle = "created";
    let difficulty = DIFFICULTIES.includes(options.difficulty) ? options.difficulty : "normal";
    let online = !(root && root.navigator && root.navigator.onLine === false);
    let previousOnlineState = "running";
    let currentPayload = {};
    let startPromise = null;
    let autosaveTimer = null;
    let onlineCleanup = [];
    let destroyed = false;

    function eventName(name) {
      return String(name || "").startsWith("hh:") ? String(name) : `hh:game-runtime:${name}`;
    }

    function emit(name, detail) {
      const fullName = eventName(name);
      const payload = sanitize({ sessionId, gameId, ...detail }, { maxDepth: 6, maxString: 2000, maxItems: 100, maxKeys: 100 }) || { sessionId, gameId };
      dispatchDocumentEvent(fullName, payload);
      const callbacks = listeners.get(fullName) || [];
      callbacks.slice().forEach((callback) => {
        try {
          callback(payload);
        } catch (error) {
          // One consumer must not break the runtime event bus.
        }
      });
      return payload;
    }

    function on(name, callback) {
      if (typeof callback !== "function") {
        return () => {};
      }
      const key = eventName(name);
      const callbacks = listeners.get(key) || [];
      callbacks.push(callback);
      listeners.set(key, callbacks);
      return () => off(key, callback);
    }

    function off(name, callback) {
      const key = eventName(name);
      const callbacks = listeners.get(key) || [];
      listeners.set(key, callbacks.filter((item) => item !== callback));
    }

    function fail(error, code) {
      const message = error && error.message ? error.message : String(error || "Game runtime error");
      emit("error", { code: code || "RUNTIME_ERROR", message: message.slice(0, 300) });
      if (lifecycle !== "destroyed" && lifecycle !== "error") {
        transition("error", { code: code || "RUNTIME_ERROR", message });
      }
      overlay.show("error", { message });
      return false;
    }

    function transition(next, meta) {
      if (lifecycle === next) {
        return true;
      }
      const allowed = transitions[lifecycle] || [];
      if (!allowed.includes(next)) {
        return fail(new Error(`Invalid lifecycle transition: ${lifecycle} -> ${next}`), "INVALID_TRANSITION");
      }
      const previous = lifecycle;
      lifecycle = next;
      emit("statechange", { previous, state: next, meta: sanitize(meta || {}, { maxDepth: 3, maxString: 400, maxItems: 20, maxKeys: 20 }) });
      if (next === "loading") {
        overlay.show("loading");
      } else if (next === "paused") {
        overlay.show("pause");
      } else if (next === "gameover") {
        overlay.show("gameover");
      } else if (next === "result") {
        overlay.show("result");
      } else if (next === "error") {
        overlay.show("error", meta);
      } else if (["ready", "running", "offline", "destroyed"].includes(next)) {
        if (next !== "offline") {
          overlay.hide();
        }
      }
      return true;
    }

    function getStatePayload() {
      let payload = currentPayload;
      if (typeof options.getState === "function") {
        try {
          payload = options.getState(session);
        } catch (error) {
          fail(error, "STATE_SERIALIZE_ERROR");
          payload = currentPayload;
        }
      }
      return payload;
    }

    function checkpoint(payload, slot) {
      if (destroyed) {
        return null;
      }
      const checkpointOptions = slot && typeof slot === "object" ? slot : {};
      const saveSlot = normalizeSlot(checkpointOptions.slot || slot || options.autosaveSlot || SLOT_NAMES[0]);
      const cleanState = sanitize(payload === undefined ? getStatePayload() : payload, {
        maxDepth: 6,
        maxString: 2000,
        maxItems: 100,
        maxKeys: 100
      });
      const envelope = {
        schemaVersion: SCHEMA_VERSION,
        gameId,
        slot: saveSlot,
        version: (readEnvelope(storage, gameId, saveSlot)?.version || 0) + 1,
        savedAt: new Date().toISOString(),
        state: cleanState === undefined ? {} : cleanState
      };
      const serialized = safeJson(envelope);
      const maxBytes = clamp(Number(options.maxPayloadBytes) || 120000, 10000, 500000);
      if (!serialized || serialized.length > maxBytes) {
        fail(new Error("Save data vượt quá giới hạn cho phép."), "PAYLOAD_TOO_LARGE");
        return null;
      }
      try {
        storage.setItem(getStorageKey(gameId, saveSlot), serialized);
      } catch (error) {
        fail(error, "STORAGE_WRITE_ERROR");
        return null;
      }
      currentPayload = envelope.state;
      stats.checkpoints += 1;
      emit("checkpoint", {
        slot: saveSlot,
        version: envelope.version,
        savedAt: envelope.savedAt,
        label: String(checkpointOptions.label || "").slice(0, 120),
        bytes: serialized.length
      });
      if (typeof options.onCheckpoint === "function") {
        try {
          options.onCheckpoint(envelope, session);
        } catch (error) {
          fail(error, "CHECKPOINT_CALLBACK_ERROR");
        }
      }
      return envelope;
    }

    function restore(slot, restoreOptions) {
      if (destroyed) {
        return null;
      }
      if (slot && typeof slot === "object") {
        const state = sanitize(slot, { maxDepth: 6, maxString: 2000, maxItems: 100, maxKeys: 100 }) || {};
        const sourceSlot = normalizeSlot(restoreOptions?.slot || SLOT_NAMES[0]);
        currentPayload = state;
        stats.restores += 1;
        const envelope = {
          schemaVersion: SCHEMA_VERSION,
          gameId,
          slot: sourceSlot,
          version: readEnvelope(storage, gameId, sourceSlot)?.version || 0,
          savedAt: new Date().toISOString(),
          state
        };
        emit("restore", { slot: sourceSlot, version: envelope.version, savedAt: envelope.savedAt, external: true });
        if (typeof options.onRestore === "function") {
          try {
            options.onRestore(state, envelope, session);
          } catch (error) {
            fail(error, "RESTORE_CALLBACK_ERROR");
          }
        }
        return envelope;
      }
      const saveSlot = normalizeSlot(slot || SLOT_NAMES[0]);
      const envelope = readEnvelope(storage, gameId, saveSlot);
      if (!envelope) {
        return null;
      }
      currentPayload = envelope.state;
      stats.restores += 1;
      emit("restore", { slot: saveSlot, version: envelope.version, savedAt: envelope.savedAt });
      if (typeof options.onRestore === "function") {
        try {
          options.onRestore(envelope.state, envelope, session);
        } catch (error) {
          fail(error, "RESTORE_CALLBACK_ERROR");
        }
      }
      return envelope;
    }

    function listSlots() {
      return SLOT_NAMES.map((slot) => {
        const envelope = readEnvelope(storage, gameId, slot);
        return {
          slot,
          hasData: Boolean(envelope),
          version: envelope ? envelope.version : 0,
          savedAt: envelope ? envelope.savedAt : null
        };
      });
    }

    function autosave() {
      if (!destroyed && (lifecycle === "running" || lifecycle === "paused" || lifecycle === "offline")) {
        checkpoint(getStatePayload(), options.autosaveSlot || SLOT_NAMES[0]);
      }
    }

    function setupAutosave() {
      const interval = clamp(Number(options.autosaveMs) || 15000, 5000, 300000);
      if (options.autosave === false || !root || typeof root.setInterval !== "function") {
        return;
      }
      autosaveTimer = root.setInterval(autosave, interval);
    }

    function setupOnlineState() {
      const target = root && typeof root.addEventListener === "function" ? root : null;
      if (!target) {
        return;
      }
      const goOffline = () => {
        online = false;
        if (["running", "ready"].includes(lifecycle)) {
          previousOnlineState = lifecycle;
          transition("offline", { reason: "network" });
        }
        emit("online", { online: false });
      };
      const goOnline = () => {
        online = true;
        if (lifecycle === "offline") {
          transition(previousOnlineState === "ready" ? "ready" : "running", { reason: "network-restored" });
        }
        emit("online", { online: true });
        retry();
      };
      target.addEventListener("offline", goOffline);
      target.addEventListener("online", goOnline);
      onlineCleanup = [
        () => target.removeEventListener?.("offline", goOffline),
        () => target.removeEventListener?.("online", goOnline)
      ];
    }

    async function retry() {
      if (destroyed) {
        return false;
      }
      emit("retry", { online });
      if (typeof options.onRetry === "function") {
        try {
          await options.onRetry({ online, session });
        } catch (error) {
          return fail(error, "RETRY_FAILED");
        }
      }
      if (lifecycle === "error") {
        return start();
      }
      return true;
    }

    async function start() {
      if (destroyed) {
        return false;
      }
      if (lifecycle === "running") {
        return true;
      }
      if (startPromise) {
        return startPromise;
      }
      const pending = (async () => {
        stats.starts += 1;
        if (!transition("loading")) {
          return false;
        }
        try {
          if (typeof options.load === "function") {
            await options.load(session);
          }
          if (!online) {
            transition("offline", { reason: "offline-start" });
          } else {
            transition("ready");
            transition("running");
          }
          input.bind();
          performanceMonitor.start();
          setupAutosave();
          if (options.showTutorialOnStart) {
            overlay.show("tutorial", options.tutorial);
          }
          return true;
        } catch (error) {
          return fail(error, "LOAD_FAILED");
        }
      })();
      startPromise = pending;
      pending.then(
        () => {
          if (startPromise === pending) {
            startPromise = null;
          }
        },
        () => {
          if (startPromise === pending) {
            startPromise = null;
          }
        }
      );
      return pending;
    }

    function pause() {
      if (destroyed || lifecycle !== "running") {
        return false;
      }
      stats.pauses += 1;
      autosave();
      performanceMonitor.stop();
      return transition("paused");
    }

    function resume() {
      if (destroyed || lifecycle !== "paused") {
        return false;
      }
      performanceMonitor.start();
      return transition("running");
    }

    async function restart() {
      if (destroyed) {
        return false;
      }
      stats.restarts += 1;
      if (typeof options.onRestart === "function") {
        try {
          await options.onRestart(session);
        } catch (error) {
          return fail(error, "RESTART_FAILED");
        }
      }
      if (lifecycle !== "created" && lifecycle !== "destroyed") {
        transition("loading", { reason: "restart" });
      }
      const started = await start();
      if (started && lifecycle === "ready") {
        transition("running", { reason: "restart" });
      }
      return started;
    }

    function setDifficulty(value) {
      if (!DIFFICULTIES.includes(value)) {
        throw new RangeError("Difficulty must be easy, normal or hard.");
      }
      difficulty = value;
      emit("difficultychange", { difficulty });
      return difficulty;
    }

    function setAudio(value) {
      return audio.setAudio(value);
    }

    function reward(value) {
      const cleanReward = sanitize(value || {}, { maxDepth: 4, maxString: 500, maxItems: 40, maxKeys: 40 }) || {};
      stats.rewards += 1;
      emit("reward", { reward: cleanReward });
      return cleanReward;
    }

    function unlockAchievement(id, metadata) {
      const achievementId = String(id || "").trim().slice(0, 100);
      if (!achievementId) {
        return false;
      }
      if (achievements.has(achievementId)) {
        return false;
      }
      const item = {
        id: achievementId,
        unlockedAt: new Date().toISOString(),
        metadata: sanitize(metadata || {}, { maxDepth: 3, maxString: 500, maxItems: 20, maxKeys: 20 }) || {}
      };
      achievements.set(achievementId, item);
      emit("achievement", item);
      return item;
    }

    function setStatus(status, meta) {
      if (!VALID_STATUSES.has(status)) {
        throw new RangeError(`Invalid game status: ${status}`);
      }
      if (status === "offline") {
        online = false;
      }
      return transition(status, meta);
    }

    function showTutorial(data) {
      return overlay.show("tutorial", data);
    }

    function showOverlay(kind, data) {
      return overlay.show(kind, data);
    }

    function setState(payload) {
      const cleanState = sanitize(payload || {}, { maxDepth: 6, maxString: 2000, maxItems: 100, maxKeys: 100 }) || {};
      currentPayload = cleanState;
      return cleanState;
    }

    function save(payload, saveOptions) {
      return checkpoint(payload, saveOptions || options.autosaveSlot || SLOT_NAMES[0]);
    }

    function update(payload) {
      return setState(payload);
    }

    function complete(payload) {
      setState(payload);
      if (["running", "paused", "ready"].includes(lifecycle)) {
        transition("gameover", { outcome: payload?.outcome || "complete" });
        transition("result", { outcome: payload?.outcome || "complete" });
      }
      return true;
    }

    function register(registration) {
      if (registration && typeof registration.getState === "function") {
        options.getState = registration.getState;
      }
      return session;
    }

    function inspect() {
      return {
        id: gameId,
        sessionId,
        version: VERSION,
        lifecycle,
        difficulty,
        online,
        audio: audio.getAudio(),
        input: input.getState(),
        performance: performanceMonitor.inspect(),
        startInFlight: Boolean(startPromise),
        saves: listSlots(),
        achievements: Array.from(achievements.values()).slice(0, 100),
        stats: { ...stats },
        destroyed
      };
    }

    function destroy() {
      if (destroyed) {
        return true;
      }
      autosave();
      destroyed = true;
      input.unbind();
      performanceMonitor.stop();
      audio.destroy();
      onlineCleanup.splice(0).forEach((cleanup) => cleanup());
      if (autosaveTimer !== null && root && typeof root.clearInterval === "function") {
        root.clearInterval(autosaveTimer);
      }
      autosaveTimer = null;
      transition("destroyed");
      overlay.destroy();
      listeners.clear();
      sessions.delete(sessionId);
      return true;
    }

    const emitProxy = (name, detail) => emit(name, detail);
    const audio = createAudioManager(null, options, emitProxy);
    const overlay = createOverlay(null, options, emitProxy);
    const performanceMonitor = createPerformanceMonitor(null, options, emitProxy);
    const input = createInputController(null, options, emitProxy);
    const session = {
      id: gameId,
      sessionId,
      version: VERSION,
      start,
      pause,
      resume,
      restart,
      destroy,
      retry,
      setDifficulty,
      checkpoint,
      save,
      restore,
      listSlots,
      setAudio,
      playSfx: audio.playSfx,
      playMusic: audio.playMusic,
      stopMusic: audio.stopMusic,
      reward,
      unlockAchievement,
      setStatus,
      showTutorial,
      showOverlay,
      setState,
      update,
      complete,
      register,
      unmount: destroy,
      on,
      off,
      input,
      inspect
    };
    overlay.bindSession(session);
    input.bindSession(session);
    sessions.set(sessionId, session);
    setupOnlineState();
    return session;
  }

  function inspectAll() {
    return Array.from(sessions.values()).map((session) => session.inspect());
  }

  function destroyAll() {
    Array.from(sessions.values()).forEach((session) => session.destroy());
    return true;
  }

  return {
    version: VERSION,
    create,
    inspectAll,
    destroyAll
  };
});
