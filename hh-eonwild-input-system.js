(function (root, factory) {
  "use strict";

  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHEonWildInputSystem = api;
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function createHHEonWildInputSystem(runtime) {
  "use strict";

  /*
   * Renderer-neutral input kernel for HH EonWild.
   *
   * All normalization helpers are deterministic and side-effect free. The
   * stateful controller owns only event subscriptions and ephemeral input
   * state; it never stores account data, credentials, or arbitrary payloads.
   */
  const VERSION = "1.2.0";
  const FORMAT = "hh-eonwild-input-profile-v1";
  const STORAGE_KEY = "hh:eonwild:input-profile:v1";

  const ACTION_IDS = Object.freeze([
    "moveForward", "moveBackward", "moveLeft", "moveRight",
    "sprint", "crouch", "jump", "interact", "createNest", "sense", "ability",
    "communicationWheel", "toggleView", "lockTarget",
    "shoulderSwap", "lookBack", "cameraReset", "toggleMinimap", "quickTurn",
    "codex", "worldMap", "photoMode", "pause"
  ]);
  const ACTION_ID_SET = new Set(ACTION_IDS);

  const LIMITS = Object.freeze({
    MAX_BINDINGS_PER_ACTION: 8,
    MAX_CUSTOM_PRESETS: 8,
    MAX_PRESET_ID_LENGTH: 32,
    MAX_PRESET_LABEL_LENGTH: 48,
    MAX_PROFILE_BYTES: 32768,
    MAX_BUFFER_EVENTS: 64,
    MIN_BUFFER_WINDOW_MS: 16,
    MAX_BUFFER_WINDOW_MS: 1000,
    MIN_DEADZONE: 0.02,
    MAX_DEADZONE: 0.95,
    MAX_DELTA_SECONDS: 0.25,
    MAX_EVENT_TIME_MS: Number.MAX_SAFE_INTEGER
  });

  const ACTION_METADATA = deepFreeze({
    moveForward: actionMeta("Di chuyển tới", "Move forward", "movement", "Di chuyển động vật về phía trước"),
    moveBackward: actionMeta("Di chuyển lùi", "Move backward", "movement", "Di chuyển động vật về phía sau"),
    moveLeft: actionMeta("Di chuyển trái", "Move left", "movement", "Di chuyển động vật sang trái"),
    moveRight: actionMeta("Di chuyển phải", "Move right", "movement", "Di chuyển động vật sang phải"),
    sprint: actionMeta("Chạy nhanh", "Sprint", "movement", "Giữ để chạy nhanh"),
    crouch: actionMeta("Hạ thấp cơ thể", "Crouch", "movement", "Hạ thấp cơ thể hoặc lặn tùy loài"),
    jump: actionMeta("Nhảy / bay lên", "Jump / ascend", "movement", "Nhảy, cất cánh hoặc nổi lên tùy loài"),
    interact: actionMeta("Tương tác", "Interact", "gameplay", "Ăn, uống hoặc tương tác với môi trường"),
    createNest: actionMeta("Tạo tổ", "Create nest", "gameplay", "Tạo tổ tại nơi trú hợp lệ khi cá thể đã trưởng thành"),
    sense: actionMeta("Giác quan", "Sense", "gameplay", "Kích hoạt giác quan nổi bật của loài"),
    ability: actionMeta("Năng lực", "Ability", "gameplay", "Dùng năng lực đặc trưng của loài"),
    communicationWheel: actionMeta("Vòng giao tiếp", "Communication wheel", "gameplay", "Mở vòng tín hiệu giao tiếp động vật"),
    toggleView: actionMeta("Đổi góc nhìn", "Toggle view", "interface", "Đổi camera theo loài hoặc chế độ animal-eye"),
    lockTarget: actionMeta("Khóa mục tiêu", "Lock target", "gameplay", "Khóa hoặc bỏ khóa mục tiêu hợp lệ trong thế giới 3D"),
    shoulderSwap: actionMeta("Đổi vai camera", "Shoulder swap", "camera", "Đổi camera qua vai trái hoặc vai phải"),
    lookBack: actionMeta("Nhìn phía sau", "Look back", "camera", "Giữ để nhìn nhanh ra phía sau mà không đổi hướng di chuyển"),
    cameraReset: actionMeta("Đặt lại camera", "Reset camera", "camera", "Đưa camera mượt về góc nhìn mặc định của loài"),
    toggleMinimap: actionMeta("Ẩn hoặc hiện bản đồ nhỏ", "Toggle minimap", "interface", "Ẩn hoặc hiện bản đồ nhỏ trong HUD"),
    quickTurn: actionMeta("Quay nhanh", "Quick turn", "camera", "Quay nhanh camera và hướng điều khiển khi dùng tay cầm"),
    codex: actionMeta("Bách khoa loài", "Animal Codex", "interface", "Mở Bách khoa EonWild"),
    worldMap: actionMeta("Bản đồ thế giới", "World map", "interface", "Mở bản đồ thế giới"),
    photoMode: actionMeta("Chế độ chụp ảnh", "Photo mode", "interface", "Bật hoặc tắt chế độ chụp ảnh"),
    pause: actionMeta("Tạm dừng", "Pause", "interface", "Mở trình đơn tạm dừng")
  });

  function actionMeta(labelVi, labelEn, category, ariaLabel) {
    return { labelVi, labelEn, category, ariaLabel };
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
    return value;
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, finite(value, minimum)));
  }

  function safeTime(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number)
      ? clamp(number, 0, LIMITS.MAX_EVENT_TIME_MS)
      : clamp(fallback, 0, LIMITS.MAX_EVENT_TIME_MS);
  }

  function safeText(value, maximum, fallback = "") {
    const text = String(value == null ? "" : value)
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maximum);
    return text || fallback;
  }

  function safePresetId(value, fallback = "") {
    const id = String(value == null ? "" : value)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, LIMITS.MAX_PRESET_ID_LENGTH);
    return id || fallback;
  }

  function canonicalKeyboardCode(value) {
    if (value === " ") return "Space";
    const raw = safeText(value, 32);
    if (!raw) return "";
    if (/^[a-z]$/i.test(raw)) return `Key${raw.toUpperCase()}`;
    if (/^[0-9]$/.test(raw)) return `Digit${raw}`;
    const aliases = {
      " ": "Space", spacebar: "Space", space: "Space",
      esc: "Escape", escape: "Escape", tab: "Tab",
      shift: "ShiftLeft", shiftleft: "ShiftLeft", shiftright: "ShiftRight",
      ctrl: "ControlLeft", control: "ControlLeft", controlleft: "ControlLeft", controlright: "ControlRight",
      alt: "AltLeft", altleft: "AltLeft", altright: "AltRight",
      cmd: "MetaLeft", meta: "MetaLeft", metaleft: "MetaLeft", metaright: "MetaRight",
      arrowup: "ArrowUp", arrowdown: "ArrowDown", arrowleft: "ArrowLeft", arrowright: "ArrowRight",
      enter: "Enter", backspace: "Backspace", delete: "Delete", home: "Home", end: "End",
      pageup: "PageUp", pagedown: "PageDown"
    };
    const alias = aliases[raw.toLowerCase()];
    if (alias) return alias;
    if (/^Key[A-Z]$/.test(raw) || /^Digit[0-9]$/.test(raw)) return raw;
    if (/^key[a-z]$/i.test(raw)) return `Key${raw.slice(-1).toUpperCase()}`;
    if (/^digit[0-9]$/i.test(raw)) return `Digit${raw.slice(-1)}`;
    if (/^(?:F(?:[1-9]|1[0-9]|2[0-4])|Numpad[A-Za-z0-9]+|Bracket(?:Left|Right)|Semicolon|Quote|Backquote|Backslash|Comma|Period|Slash|Minus|Equal|CapsLock|Intl[A-Za-z]+)$/.test(raw)) return raw;
    if (/^[A-Za-z][A-Za-z0-9]{0,31}$/.test(raw)) return raw;
    return "";
  }

  function normalizeBinding(input) {
    if (typeof input === "string") {
      const code = canonicalKeyboardCode(input);
      return code ? Object.freeze({ device: "keyboard", code }) : null;
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    const device = safeText(input.device || (input.code || input.key ? "keyboard" : ""), 16).toLowerCase();
    if (device === "keyboard") {
      const code = canonicalKeyboardCode(input.code || input.key);
      return code ? Object.freeze({ device: "keyboard", code }) : null;
    }
    if (device === "gamepad") {
      const control = safeText(input.control || input.type, 16).toLowerCase();
      if (control === "button") {
        const index = Math.trunc(finite(input.index, -1));
        if (index < 0 || index > 31) return null;
        return Object.freeze({ device: "gamepad", control: "button", index });
      }
      if (control === "axis") {
        const index = Math.trunc(finite(input.index ?? input.axis, -1));
        const direction = finite(input.direction, 0) < 0 ? -1 : 1;
        const threshold = clamp(finite(input.threshold, 0.5), 0.1, 1);
        if (index < 0 || index > 15) return null;
        return Object.freeze({ device: "gamepad", control: "axis", index, direction, threshold });
      }
      return null;
    }
    if (device === "touch") {
      const id = safePresetId(input.id || input.action || input.control);
      if (!id) return null;
      return Object.freeze({ device: "touch", control: "action", id });
    }
    return null;
  }

  function bindingKey(binding) {
    const normalized = normalizeBinding(binding);
    if (!normalized) return "";
    if (normalized.device === "keyboard") return `keyboard:${normalized.code}`;
    if (normalized.device === "touch") return `touch:${normalized.id}`;
    if (normalized.control === "button") return `gamepad:button:${normalized.index}`;
    return `gamepad:axis:${normalized.index}:${normalized.direction}`;
  }

  function normalizeBindingList(input) {
    const rows = Array.isArray(input) ? input : (input == null ? [] : [input]);
    const unique = new Map();
    for (const row of rows.slice(0, LIMITS.MAX_BINDINGS_PER_ACTION * 2)) {
      const binding = normalizeBinding(row);
      const key = bindingKey(binding);
      if (key && !unique.has(key)) unique.set(key, binding);
      if (unique.size >= LIMITS.MAX_BINDINGS_PER_ACTION) break;
    }
    return Object.freeze(Array.from(unique.values()).sort((a, b) => {
      const left = bindingKey(a);
      const right = bindingKey(b);
      return left < right ? -1 : (left > right ? 1 : 0);
    }));
  }

  function cloneMappings(mappings) {
    const output = {};
    for (const actionId of ACTION_IDS) output[actionId] = (mappings[actionId] || []).map((binding) => ({ ...binding }));
    return output;
  }

  function normalizeMappings(input, baseMappings = null) {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const base = baseMappings && typeof baseMappings === "object" ? baseMappings : null;
    const normalized = {};
    for (const actionId of ACTION_IDS) {
      const rows = Object.prototype.hasOwnProperty.call(source, actionId)
        ? source[actionId]
        : (base ? base[actionId] : []);
      normalized[actionId] = normalizeBindingList(rows);
    }
    return deepFreeze(normalized);
  }

  function keyboard(code) {
    return { device: "keyboard", code };
  }

  function gamepadButton(index) {
    return { device: "gamepad", control: "button", index };
  }

  function gamepadAxis(index, direction, threshold = 0.5) {
    return { device: "gamepad", control: "axis", index, direction, threshold };
  }

  function touch(id) {
    return { device: "touch", control: "action", id };
  }

  const STANDARD_MAPPINGS = normalizeMappings({
    moveForward: [keyboard("KeyW"), gamepadAxis(1, -1)],
    moveBackward: [keyboard("KeyS"), gamepadAxis(1, 1)],
    moveLeft: [keyboard("KeyA"), gamepadAxis(0, -1)],
    moveRight: [keyboard("KeyD"), gamepadAxis(0, 1)],
    sprint: [keyboard("ShiftLeft"), keyboard("ShiftRight"), gamepadButton(10), touch("sprint")],
    crouch: [keyboard("ControlLeft"), keyboard("ControlRight"), gamepadButton(1), touch("crouch")],
    jump: [keyboard("Space"), gamepadButton(0), touch("jump")],
    interact: [keyboard("KeyE"), keyboard("KeyF"), gamepadButton(2), touch("interact")],
    createNest: [keyboard("KeyN"), touch("create-nest")],
    sense: [keyboard("KeyQ"), gamepadButton(4), touch("sense")],
    ability: [keyboard("KeyR"), gamepadButton(3), touch("ability")],
    communicationWheel: [keyboard("KeyC"), gamepadButton(5), touch("communication-wheel")],
    toggleView: [keyboard("KeyV"), gamepadButton(11), touch("toggle-view")],
    lockTarget: [keyboard("KeyZ"), gamepadButton(12), touch("lock-target")],
    shoulderSwap: [keyboard("KeyX"), gamepadButton(15), touch("shoulder-swap")],
    lookBack: [keyboard("KeyB"), gamepadButton(13), touch("look-back")],
    cameraReset: [keyboard("Home"), touch("camera-reset")],
    toggleMinimap: [keyboard("KeyH"), touch("toggle-minimap")],
    quickTurn: [keyboard("KeyG"), gamepadButton(14), touch("quick-turn")],
    codex: [keyboard("Tab"), gamepadButton(6), touch("codex")],
    worldMap: [keyboard("KeyM"), gamepadButton(8), touch("world-map")],
    photoMode: [keyboard("KeyP"), gamepadButton(7), touch("photo-mode")],
    pause: [keyboard("Escape"), gamepadButton(9), touch("pause")]
  });

  const LEFT_HANDED_MAPPINGS = normalizeMappings({
    moveForward: [keyboard("ArrowUp"), gamepadAxis(1, -1)],
    moveBackward: [keyboard("ArrowDown"), gamepadAxis(1, 1)],
    moveLeft: [keyboard("ArrowLeft"), gamepadAxis(0, -1)],
    moveRight: [keyboard("ArrowRight"), gamepadAxis(0, 1)],
    sprint: [keyboard("ShiftRight"), gamepadButton(10), touch("sprint")],
    crouch: [keyboard("ControlRight"), gamepadButton(1), touch("crouch")],
    jump: [keyboard("Numpad0"), gamepadButton(0), touch("jump")],
    interact: [keyboard("Numpad1"), gamepadButton(2), touch("interact")],
    createNest: [keyboard("KeyN"), touch("create-nest")],
    sense: [keyboard("Numpad4"), gamepadButton(4), touch("sense")],
    ability: [keyboard("Numpad2"), gamepadButton(3), touch("ability")],
    communicationWheel: [keyboard("Numpad3"), gamepadButton(5), touch("communication-wheel")],
    toggleView: [keyboard("KeyV"), gamepadButton(11), touch("toggle-view")],
    lockTarget: [keyboard("KeyZ"), gamepadButton(12), touch("lock-target")],
    shoulderSwap: [keyboard("KeyX"), gamepadButton(15), touch("shoulder-swap")],
    lookBack: [keyboard("KeyB"), gamepadButton(13), touch("look-back")],
    cameraReset: [keyboard("Home"), touch("camera-reset")],
    toggleMinimap: [keyboard("KeyH"), touch("toggle-minimap")],
    quickTurn: [keyboard("KeyG"), gamepadButton(14), touch("quick-turn")],
    codex: [keyboard("Tab"), gamepadButton(6), touch("codex")],
    worldMap: [keyboard("KeyM"), gamepadButton(8), touch("world-map")],
    photoMode: [keyboard("KeyP"), gamepadButton(7), touch("photo-mode")],
    pause: [keyboard("Escape"), gamepadButton(9), touch("pause")]
  });

  const ACCESSIBLE_MAPPINGS = normalizeMappings({
    moveForward: [keyboard("KeyI"), keyboard("ArrowUp"), gamepadAxis(1, -1)],
    moveBackward: [keyboard("KeyK"), keyboard("ArrowDown"), gamepadAxis(1, 1)],
    moveLeft: [keyboard("KeyJ"), keyboard("ArrowLeft"), gamepadAxis(0, -1)],
    moveRight: [keyboard("KeyL"), keyboard("ArrowRight"), gamepadAxis(0, 1)],
    sprint: [keyboard("KeyU"), gamepadButton(10), touch("sprint")],
    crouch: [keyboard("KeyO"), gamepadButton(1), touch("crouch")],
    jump: [keyboard("Space"), gamepadButton(0), touch("jump")],
    interact: [keyboard("Enter"), gamepadButton(2), touch("interact")],
    createNest: [keyboard("KeyN"), touch("create-nest")],
    sense: [keyboard("KeyQ"), gamepadButton(4), touch("sense")],
    ability: [keyboard("KeyR"), gamepadButton(3), touch("ability")],
    communicationWheel: [keyboard("KeyC"), gamepadButton(5), touch("communication-wheel")],
    toggleView: [keyboard("KeyV"), gamepadButton(11), touch("toggle-view")],
    lockTarget: [keyboard("KeyZ"), gamepadButton(12), touch("lock-target")],
    shoulderSwap: [keyboard("KeyX"), gamepadButton(15), touch("shoulder-swap")],
    lookBack: [keyboard("KeyB"), gamepadButton(13), touch("look-back")],
    cameraReset: [keyboard("Home"), touch("camera-reset")],
    toggleMinimap: [keyboard("KeyH"), touch("toggle-minimap")],
    quickTurn: [keyboard("KeyG"), gamepadButton(14), touch("quick-turn")],
    codex: [keyboard("Tab"), gamepadButton(6), touch("codex")],
    worldMap: [keyboard("KeyM"), gamepadButton(8), touch("world-map")],
    photoMode: [keyboard("KeyP"), gamepadButton(7), touch("photo-mode")],
    pause: [keyboard("Escape"), gamepadButton(9), touch("pause")]
  });

  const DEFAULT_PRESETS = deepFreeze({
    standard: { id: "standard", label: "Tiêu chuẩn", builtin: true, mappings: STANDARD_MAPPINGS },
    "left-handed": { id: "left-handed", label: "Thuận tay trái", builtin: true, mappings: LEFT_HANDED_MAPPINGS },
    accessible: { id: "accessible", label: "Dễ tiếp cận", builtin: true, mappings: ACCESSIBLE_MAPPINGS }
  });
  const DEFAULT_ACTIONS = STANDARD_MAPPINGS;

  function detectBindingConflicts(mappings) {
    const normalized = normalizeMappings(mappings);
    const owners = new Map();
    for (const actionId of ACTION_IDS) {
      for (const binding of normalized[actionId]) {
        const key = bindingKey(binding);
        if (!owners.has(key)) owners.set(key, { binding, actions: [] });
        owners.get(key).actions.push(actionId);
      }
    }
    return Array.from(owners.entries())
      .filter(([, row]) => row.actions.length > 1)
      .sort(([left], [right]) => left < right ? -1 : (left > right ? 1 : 0))
      .map(([key, row]) => Object.freeze({ key, binding: row.binding, actions: Object.freeze(row.actions.slice().sort()) }));
  }

  function normalizeVector(x, y, maximum = 1) {
    const safeX = finite(x, 0);
    const safeY = finite(y, 0);
    const limit = Math.max(0, finite(maximum, 1));
    const magnitude = Math.hypot(safeX, safeY);
    if (magnitude <= 1e-12 || limit <= 0) return Object.freeze({ x: 0, y: 0, magnitude: 0 });
    const outputMagnitude = Math.min(magnitude, limit);
    const scale = outputMagnitude / magnitude;
    return Object.freeze({ x: safeX * scale, y: safeY * scale, magnitude: outputMagnitude });
  }

  function applyCircularDeadzone(x, y, deadzone = 0.18) {
    const raw = normalizeVector(x, y, 1);
    const threshold = clamp(deadzone, LIMITS.MIN_DEADZONE, LIMITS.MAX_DEADZONE);
    if (raw.magnitude <= threshold) return Object.freeze({ x: 0, y: 0, magnitude: 0 });
    const scaledMagnitude = clamp((raw.magnitude - threshold) / (1 - threshold), 0, 1);
    const scale = scaledMagnitude / raw.magnitude;
    return Object.freeze({ x: raw.x * scale, y: raw.y * scale, magnitude: scaledMagnitude });
  }

  function moveTowards(current, target, maximumDelta) {
    const from = finite(current, 0);
    const to = finite(target, 0);
    const step = Math.max(0, finite(maximumDelta, 0));
    if (Math.abs(to - from) <= step) return to;
    return from + Math.sign(to - from) * step;
  }

  function stepScalarVelocity(current, target, acceleration, deceleration, deltaSeconds) {
    const from = finite(current, 0);
    const to = finite(target, 0);
    const dt = clamp(deltaSeconds, 0, LIMITS.MAX_DELTA_SECONDS);
    const speedingUp = Math.abs(to) > Math.abs(from) && (from === 0 || Math.sign(from) === Math.sign(to));
    const rate = Math.max(0, finite(speedingUp ? acceleration : deceleration, 0));
    return moveTowards(from, to, rate * dt);
  }

  function stepMovement(current, target, acceleration = 8, deceleration = 12, deltaSeconds = 1 / 60) {
    const from = normalizeVector(current?.x, current?.y, 1);
    const to = normalizeVector(target?.x, target?.y, 1);
    const dt = clamp(deltaSeconds, 0, LIMITS.MAX_DELTA_SECONDS);
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance <= 1e-12) return to;
    const sameDirection = from.magnitude <= 1e-9 || (from.x * to.x + from.y * to.y) >= 0;
    const speedingUp = sameDirection && to.magnitude > from.magnitude;
    const rate = Math.max(0, finite(speedingUp ? acceleration : deceleration, 0));
    const maximumStep = rate * dt;
    if (distance <= maximumStep) return to;
    return normalizeVector(from.x + deltaX / distance * maximumStep, from.y + deltaY / distance * maximumStep, 1);
  }

  function isTextEntryTarget(target) {
    let node = target && typeof target === "object" ? target : null;
    for (let depth = 0; node && depth < 32; depth += 1) {
      const tagName = String(node.tagName || node.nodeName || "").toLowerCase();
      if (["input", "textarea", "select", "option"].includes(tagName)) return true;
      if (node.isContentEditable === true) return true;
      const contentEditable = typeof node.getAttribute === "function" ? node.getAttribute("contenteditable") : null;
      if (contentEditable != null && String(contentEditable).toLowerCase() !== "false") return true;
      const role = typeof node.getAttribute === "function" ? String(node.getAttribute("role") || "").toLowerCase() : "";
      if (["textbox", "searchbox", "combobox", "spinbutton"].includes(role)) return true;
      node = node.parentElement || node.parentNode || null;
    }
    return false;
  }

  function isTextEntryEvent(event) {
    if (isTextEntryTarget(event?.target)) return true;
    if (typeof event?.composedPath !== "function") return false;
    try { return event.composedPath().some((node) => isTextEntryTarget(node)); } catch (_) { return false; }
  }

  function normalizeBufferedPayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return Object.freeze({ source: "unknown", value: 1 });
    return Object.freeze({
      source: safePresetId(payload.source, "unknown").slice(0, 24),
      value: clamp(payload.value ?? 1, -1, 1)
    });
  }

  class InputBuffer {
    constructor(options = {}) {
      this.windowMs = clamp(finite(options.windowMs, 180), LIMITS.MIN_BUFFER_WINDOW_MS, LIMITS.MAX_BUFFER_WINDOW_MS);
      this.maxEvents = Math.trunc(clamp(finite(options.maxEvents, 32), 1, LIMITS.MAX_BUFFER_EVENTS));
      this.clock = typeof options.clock === "function" ? options.clock : () => Date.now();
      this.events = [];
      this.sequence = 0;
    }

    push(actionId, at = this.clock(), payload = null) {
      if (!ACTION_ID_SET.has(actionId)) return null;
      const event = Object.freeze({
        actionId,
        at: safeTime(at, this.clock()),
        sequence: ++this.sequence,
        payload: normalizeBufferedPayload(payload)
      });
      this.events.push(event);
      if (this.events.length > this.maxEvents) this.events.splice(0, this.events.length - this.maxEvents);
      return event;
    }

    prune(now = this.clock()) {
      const time = safeTime(now, this.clock());
      const oldest = Math.max(0, time - this.windowMs);
      this.events = this.events.filter((event) => event.at >= oldest && event.at <= time + this.windowMs);
      return this.events.length;
    }

    peek(actionId, now = this.clock()) {
      if (!ACTION_ID_SET.has(actionId)) return null;
      const time = safeTime(now, this.clock());
      this.prune(time);
      return this.events.find((event) => event.actionId === actionId && event.at <= time) || null;
    }

    consume(actionId, now = this.clock()) {
      const event = this.peek(actionId, now);
      if (!event) return null;
      const index = this.events.findIndex((candidate) => candidate.sequence === event.sequence);
      if (index >= 0) this.events.splice(index, 1);
      return event;
    }

    clear(actionId = null) {
      if (actionId == null) {
        const count = this.events.length;
        this.events.length = 0;
        return count;
      }
      const before = this.events.length;
      this.events = this.events.filter((event) => event.actionId !== actionId);
      return before - this.events.length;
    }

    clearSource(source) {
      const normalizedSource = safePresetId(source);
      if (!normalizedSource) return 0;
      const before = this.events.length;
      this.events = this.events.filter((event) => event.payload.source !== normalizedSource);
      return before - this.events.length;
    }

    get size() {
      return this.events.length;
    }
  }

  function utf8ByteLength(value) {
    const text = String(value == null ? "" : value);
    let bytes = 0;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      if (code < 0x80) bytes += 1;
      else if (code < 0x800) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length && text.charCodeAt(index + 1) >= 0xdc00 && text.charCodeAt(index + 1) <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    }
    return bytes;
  }

  function containsSecretField(value, depth = 0) {
    if (!value || typeof value !== "object" || depth > 8) return false;
    for (const [key, child] of Object.entries(value)) {
      if (/token|secret|password|credential|authorization|cookie|session/i.test(key)) return true;
      if (containsSecretField(child, depth + 1)) return true;
    }
    return false;
  }

  function normalizeSettings(input = {}) {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    return Object.freeze({
      gamepadDeadzone: clamp(finite(source.gamepadDeadzone, 0.18), LIMITS.MIN_DEADZONE, LIMITS.MAX_DEADZONE),
      touchDeadzone: clamp(finite(source.touchDeadzone, 0.08), LIMITS.MIN_DEADZONE, LIMITS.MAX_DEADZONE),
      gamepadVibration: source.gamepadVibration !== false,
      preventDefault: source.preventDefault !== false,
      bufferWindowMs: clamp(finite(source.bufferWindowMs, 180), LIMITS.MIN_BUFFER_WINDOW_MS, LIMITS.MAX_BUFFER_WINDOW_MS)
    });
  }

  function parsePayload(input) {
    if (typeof input !== "string") return input;
    if (utf8ByteLength(input) > LIMITS.MAX_PROFILE_BYTES) return null;
    try { return JSON.parse(input); } catch (_) { return null; }
  }

  function validateMappingsShape(value, prefix, errors) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${prefix}_INVALID`);
      return;
    }
    for (const actionId of Object.keys(value)) {
      if (!ACTION_ID_SET.has(actionId)) errors.push(`${prefix}_ACTION_UNKNOWN`);
    }
    for (const actionId of ACTION_IDS) {
      if (!Object.prototype.hasOwnProperty.call(value, actionId)) continue;
      const raw = value[actionId];
      const rows = Array.isArray(raw) ? raw : [raw];
      if (rows.length > LIMITS.MAX_BINDINGS_PER_ACTION) errors.push(`${prefix}_BINDING_LIMIT`);
      if (rows.some((binding) => normalizeBinding(binding) == null)) errors.push(`${prefix}_BINDING_INVALID`);
    }
  }

  function validatePersistencePayload(input) {
    const errors = [];
    const parsed = parsePayload(input);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Object.freeze({ valid: false, ok: false, errors: Object.freeze(["PROFILE_INVALID"]), value: null });
    }
    let serialized = "";
    try { serialized = JSON.stringify(parsed); } catch (_) { errors.push("PROFILE_NOT_SERIALIZABLE"); }
    if (utf8ByteLength(serialized) > LIMITS.MAX_PROFILE_BYTES) errors.push("PROFILE_TOO_LARGE");
    if (containsSecretField(parsed)) errors.push("PROFILE_CONTAINS_SECRET_FIELD");
    const rootFields = new Set(["format", "version", "presetId", "mappings", "customPresets", "settings"]);
    if (Object.keys(parsed).some((key) => !rootFields.has(key))) errors.push("PROFILE_FIELD_UNKNOWN");
    if (parsed.format !== FORMAT) errors.push("PROFILE_FORMAT_INVALID");
    if (Math.trunc(finite(parsed.version, 0)) !== 1) errors.push("PROFILE_VERSION_INVALID");

    const presetId = safePresetId(parsed.presetId, "standard");
    if (typeof parsed.presetId !== "string" || parsed.presetId !== presetId) errors.push("PROFILE_PRESET_ID_INVALID");
    validateMappingsShape(parsed.mappings, "PROFILE_MAPPINGS", errors);
    if (!parsed.settings || typeof parsed.settings !== "object" || Array.isArray(parsed.settings)) errors.push("PROFILE_SETTINGS_INVALID");
    const mappings = normalizeMappings(parsed.mappings, STANDARD_MAPPINGS);
    const settings = normalizeSettings(parsed.settings);
    const customPresets = [];
    const seen = new Set(Object.keys(DEFAULT_PRESETS));
    const rows = Array.isArray(parsed.customPresets) ? parsed.customPresets : [];
    if (rows.length > LIMITS.MAX_CUSTOM_PRESETS) errors.push("TOO_MANY_CUSTOM_PRESETS");
    for (const row of rows.slice(0, LIMITS.MAX_CUSTOM_PRESETS)) {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        errors.push("CUSTOM_PRESET_INVALID");
        continue;
      }
      const id = safePresetId(row.id);
      if (!id || seen.has(id)) {
        errors.push("CUSTOM_PRESET_ID_INVALID");
        continue;
      }
      validateMappingsShape(row.mappings, "CUSTOM_PRESET_MAPPINGS", errors);
      seen.add(id);
      customPresets.push(Object.freeze({
        id,
        label: safeText(row.label, LIMITS.MAX_PRESET_LABEL_LENGTH, id),
        mappings: normalizeMappings(row.mappings, STANDARD_MAPPINGS)
      }));
    }
    if (!seen.has(presetId)) errors.push("ACTIVE_PRESET_UNKNOWN");
    const value = deepFreeze({
      format: FORMAT,
      version: 1,
      presetId: seen.has(presetId) ? presetId : "standard",
      mappings,
      customPresets,
      settings
    });
    return Object.freeze({ valid: errors.length === 0, ok: errors.length === 0, errors: Object.freeze(errors), value });
  }

  function detectFeatures(environment = runtime) {
    const navigatorRef = environment && environment.navigator;
    let storage = false;
    let gamepads = [];
    try { storage = Boolean(environment && environment.localStorage && typeof environment.localStorage.getItem === "function"); } catch (_) { storage = false; }
    try { gamepads = navigatorRef && typeof navigatorRef.getGamepads === "function" ? Array.from(navigatorRef.getGamepads() || []) : []; } catch (_) { gamepads = []; }
    return Object.freeze({
      keyboard: Boolean(environment && typeof environment.addEventListener === "function"),
      abortController: Boolean(environment && typeof environment.AbortController === "function") || typeof AbortController === "function",
      gamepad: Boolean(navigatorRef && typeof navigatorRef.getGamepads === "function"),
      gamepadVibration: gamepads.some((pad) => pad?.vibrationActuator),
      pointerEvents: Boolean(environment && environment.PointerEvent),
      touch: Boolean(navigatorRef && finite(navigatorRef.maxTouchPoints, 0) > 0),
      persistentStorage: storage
    });
  }

  function buttonPressed(button) {
    if (typeof button === "number") return button > 0.5;
    return Boolean(button && (button.pressed || finite(button.value, 0) > 0.5));
  }

  class InputActionSystem {
    constructor(options = {}) {
      this.runtime = options.runtime || runtime;
      this.clock = typeof options.clock === "function" ? options.clock : () => Date.now();
      this.settings = normalizeSettings(options.settings || options);
      this.buffer = new InputBuffer({ windowMs: this.settings.bufferWindowMs, maxEvents: options.maxBufferEvents, clock: this.clock });
      this.presets = new Map();
      this.customPresetIds = new Set();
      for (const preset of Object.values(DEFAULT_PRESETS)) this.presets.set(preset.id, preset);
      this.presetId = this.presets.has(options.presetId) ? options.presetId : "standard";
      this.mappings = normalizeMappings(options.mappings, this.presets.get(this.presetId).mappings);
      this.storage = options.storage || null;
      this.storageKey = safeText(options.storageKey, 96, STORAGE_KEY);
      this.keyboardCodes = new Set();
      this.gamepadActions = new Set();
      this.touchActions = new Set();
      this.gamepadStick = Object.freeze({ x: 0, y: 0, magnitude: 0 });
      this.touchStick = Object.freeze({ x: 0, y: 0, magnitude: 0 });
      this.activeGamepad = null;
      this.pauseReasons = new Set();
      this.subscribers = new Set();
      this.abortController = null;
      this.listenerRecords = [];
      this.target = null;
      this.disposed = false;
      this.attached = false;
      this._boundKeyDown = (event) => this.handleKeyDown(event);
      this._boundKeyUp = (event) => this.handleKeyUp(event);
      this._boundBlur = () => this.releaseAll("blur");
      this._boundPointerCancel = (event) => {
        const pointerType = safeText(event?.pointerType, 12).toLowerCase();
        if (!pointerType || pointerType === "touch" || pointerType === "pen") this.releaseTouchInput("pointercancel");
      };
      this._boundTouchCancel = () => this.releaseTouchInput("touchcancel");
      this._boundVisibility = () => {
        const documentRef = this._documentRef();
        if (documentRef?.hidden) this.pause("visibility");
        else this.resume("visibility");
      };
    }

    _documentRef() {
      if (this.target?.document) return this.target.document;
      if (this.target?.ownerDocument) return this.target.ownerDocument;
      return this.runtime?.document || null;
    }

    _abortControllerClass() {
      return this.runtime?.AbortController || (typeof AbortController === "function" ? AbortController : null);
    }

    _listen(target, type, listener, options = {}) {
      if (!target || typeof target.addEventListener !== "function") return false;
      const record = { target, type, listener, options: { capture: Boolean(options.capture) } };
      try {
        target.addEventListener(type, listener, { ...options, signal: this.abortController?.signal });
      } catch (_) {
        target.addEventListener(type, listener, options);
      }
      this.listenerRecords.push(record);
      return true;
    }

    attach(target = this.runtime) {
      if (this.disposed) return Object.freeze({ ok: false, reason: "DISPOSED" });
      if (!target || typeof target.addEventListener !== "function") return Object.freeze({ ok: false, reason: "EVENT_TARGET_UNAVAILABLE" });
      if (this.attached && target === this.target) return Object.freeze({ ok: true, alreadyAttached: true });
      if (this.attached) this.detach();
      const Controller = this._abortControllerClass();
      if (!Controller) return Object.freeze({ ok: false, reason: "ABORT_CONTROLLER_UNAVAILABLE" });
      this.abortController = new Controller();
      this.target = target;
      this._listen(target, "keydown", this._boundKeyDown, { passive: false });
      this._listen(target, "keyup", this._boundKeyUp, { passive: true });
      this._listen(target, "blur", this._boundBlur, { passive: true });
      this._listen(target, "pointercancel", this._boundPointerCancel, { passive: true });
      this._listen(target, "touchcancel", this._boundTouchCancel, { passive: true });
      const documentRef = this._documentRef();
      if (documentRef && documentRef !== target) this._listen(documentRef, "visibilitychange", this._boundVisibility, { passive: true });
      this.attached = true;
      return Object.freeze({ ok: true, alreadyAttached: false });
    }

    detach() {
      if (!this.attached) return false;
      try { this.abortController?.abort(); } catch (_) { /* listener cleanup continues below */ }
      for (const record of this.listenerRecords) {
        try { record.target.removeEventListener(record.type, record.listener, record.options); } catch (_) { /* no-op */ }
      }
      this.listenerRecords.length = 0;
      this.abortController = null;
      this.target = null;
      this.attached = false;
      this.releaseAll("detach");
      this.pauseReasons.delete("visibility");
      return true;
    }

    pause(reason = "manual") {
      if (this.disposed) return false;
      this.pauseReasons.add(safePresetId(reason, "manual"));
      this.releaseAll("pause");
      return true;
    }

    resume(reason = "manual") {
      if (this.disposed) return false;
      this.pauseReasons.delete(safePresetId(reason, "manual"));
      return true;
    }

    get paused() {
      return this.pauseReasons.size > 0;
    }

    dispose() {
      if (this.disposed) return false;
      this.detach();
      this.releaseAll("dispose");
      this.subscribers.clear();
      this.presets.clear();
      this.customPresetIds.clear();
      this.disposed = true;
      return true;
    }

    subscribe(listener) {
      if (this.disposed || typeof listener !== "function") return () => false;
      this.subscribers.add(listener);
      let active = true;
      return () => {
        if (!active) return false;
        active = false;
        return this.subscribers.delete(listener);
      };
    }

    _emit(type, detail) {
      const event = Object.freeze({ type, detail, at: safeTime(this.clock(), 0) });
      for (const listener of Array.from(this.subscribers)) {
        try { listener(event); } catch (_) { /* subscribers cannot break input */ }
      }
    }

    actionsForBinding(binding) {
      const key = bindingKey(binding);
      if (!key) return Object.freeze([]);
      return Object.freeze(ACTION_IDS.filter((actionId) => this.mappings[actionId].some((candidate) => bindingKey(candidate) === key)));
    }

    _isActionDownInSets(actionId) {
      if (!ACTION_ID_SET.has(actionId)) return false;
      if (this.gamepadActions.has(actionId) || this.touchActions.has(actionId)) return true;
      return this.mappings[actionId].some((binding) => binding.device === "keyboard" && this.keyboardCodes.has(binding.code));
    }

    isActionDown(actionId) {
      return !this.paused && this._isActionDownInSets(actionId);
    }

    handleKeyDown(event = {}) {
      if (this.disposed || this.paused || isTextEntryEvent(event)) return false;
      const code = canonicalKeyboardCode(event.code || event.key);
      if (!code) return false;
      const actions = this.actionsForBinding({ device: "keyboard", code });
      if (!actions.length) return false;
      const wasDown = new Map(actions.map((actionId) => [actionId, this._isActionDownInSets(actionId)]));
      this.keyboardCodes.add(code);
      // DOMEvent.timeStamp and Date.now() are not guaranteed to share an epoch.
      // All buffered events therefore use the injected monotonic clock.
      const at = safeTime(this.clock(), 0);
      if (!event.repeat) {
        for (const actionId of actions) {
          if (!wasDown.get(actionId)) this.buffer.push(actionId, at, { source: "keyboard", value: 1 });
        }
      }
      if (this.settings.preventDefault && typeof event.preventDefault === "function") event.preventDefault();
      this._emit("keyboard", Object.freeze({ code, pressed: true, actions }));
      return true;
    }

    handleKeyUp(event = {}) {
      const code = canonicalKeyboardCode(event.code || event.key);
      if (!code) return false;
      const existed = this.keyboardCodes.delete(code);
      if (existed) this._emit("keyboard", Object.freeze({ code, pressed: false, actions: this.actionsForBinding({ device: "keyboard", code }) }));
      return existed;
    }

    setTouchJoystick(x, y) {
      if (this.disposed || this.paused) return this.touchStick;
      this.touchStick = applyCircularDeadzone(x, y, this.settings.touchDeadzone);
      this._emit("touch-joystick", this.touchStick);
      return this.touchStick;
    }

    setTouchAction(actionId, pressed, at = this.clock()) {
      if (this.disposed || this.paused || !ACTION_ID_SET.has(actionId)) return false;
      const down = Boolean(pressed);
      const wasDown = this.touchActions.has(actionId);
      if (down) this.touchActions.add(actionId);
      else this.touchActions.delete(actionId);
      if (down && !wasDown) this.buffer.push(actionId, at, { source: "touch", value: 1 });
      if (down !== wasDown) this._emit("touch-action", Object.freeze({ actionId, pressed: down }));
      return true;
    }

    releaseTouchInput(source = "manual") {
      const hadPhysicalState = this.touchActions.size > 0 || this.touchStick.magnitude > 0;
      this.touchActions.clear();
      this.touchStick = Object.freeze({ x: 0, y: 0, magnitude: 0 });
      const clearedEvents = this.buffer.clearSource("touch");
      const hadState = hadPhysicalState || clearedEvents > 0;
      if (hadState) this._emit("release-touch", Object.freeze({ source: safePresetId(source, "manual") }));
      return hadState;
    }

    updateGamepads(gamepads = null, at = this.clock()) {
      if (this.disposed || this.paused) return Object.freeze({ connected: false, stick: this.gamepadStick, actions: Object.freeze([]) });
      let rows = gamepads;
      if (!rows) {
        try { rows = this.runtime?.navigator?.getGamepads?.() || []; } catch (_) { rows = []; }
      }
      const pad = Array.from(rows || []).find((candidate) => candidate && candidate.connected !== false) || null;
      const nextActions = new Set();
      if (pad) {
        const axes = Array.isArray(pad.axes) || ArrayBuffer.isView(pad.axes) ? pad.axes : [];
        this.gamepadStick = applyCircularDeadzone(axes[0] || 0, axes[1] || 0, this.settings.gamepadDeadzone);
        for (const actionId of ACTION_IDS) {
          for (const binding of this.mappings[actionId]) {
            if (binding.device !== "gamepad") continue;
            const down = binding.control === "button"
              ? buttonPressed(pad.buttons?.[binding.index])
              : finite(axes[binding.index], 0) * binding.direction >= binding.threshold;
            if (down) {
              nextActions.add(actionId);
              break;
            }
          }
        }
      } else {
        this.gamepadStick = Object.freeze({ x: 0, y: 0, magnitude: 0 });
      }
      for (const actionId of nextActions) {
        if (!this.gamepadActions.has(actionId)) this.buffer.push(actionId, at, { source: "gamepad", value: 1 });
      }
      this.gamepadActions = nextActions;
      this.activeGamepad = pad;
      const result = Object.freeze({ connected: Boolean(pad), index: pad ? Math.trunc(finite(pad.index, 0)) : -1, stick: this.gamepadStick, actions: Object.freeze(Array.from(nextActions).sort()) });
      this._emit("gamepad", result);
      return result;
    }

    vibrate(options = {}) {
      if (this.disposed || !this.settings.gamepadVibration) return Promise.resolve(false);
      const actuator = this.activeGamepad?.vibrationActuator;
      if (!actuator || typeof actuator.playEffect !== "function") return Promise.resolve(false);
      const duration = Math.trunc(clamp(options.duration ?? 80, 0, 1000));
      const strongMagnitude = clamp(options.strongMagnitude ?? 0.35, 0, 1);
      const weakMagnitude = clamp(options.weakMagnitude ?? 0.2, 0, 1);
      try {
        return Promise.resolve(actuator.playEffect("dual-rumble", { duration, strongMagnitude, weakMagnitude }))
          .then(() => true, () => false);
      } catch (_) {
        return Promise.resolve(false);
      }
    }

    getMovementVector() {
      if (this.disposed || this.paused) return Object.freeze({ x: 0, y: 0, magnitude: 0 });
      const digitalDown = (actionId) => this.touchActions.has(actionId)
        || this.mappings[actionId].some((binding) => binding.device === "keyboard" && this.keyboardCodes.has(binding.code));
      const keyboardX = (digitalDown("moveRight") ? 1 : 0) - (digitalDown("moveLeft") ? 1 : 0);
      const keyboardY = (digitalDown("moveForward") ? 1 : 0) - (digitalDown("moveBackward") ? 1 : 0);
      const keyboard = normalizeVector(keyboardX, keyboardY, 1);
      const gamepad = { x: this.gamepadStick.x, y: -this.gamepadStick.y };
      const touchVector = { x: this.touchStick.x, y: -this.touchStick.y };
      return normalizeVector(keyboard.x + gamepad.x + touchVector.x, keyboard.y + gamepad.y + touchVector.y, 1);
    }

    wasPressed(actionId, now = this.clock(), consume = true) {
      if (this.disposed || this.paused) return null;
      return consume ? this.buffer.consume(actionId, now) : this.buffer.peek(actionId, now);
    }

    releaseAll(source = "manual") {
      const hadState = this.keyboardCodes.size || this.gamepadActions.size || this.touchActions.size || this.gamepadStick.magnitude || this.touchStick.magnitude || this.buffer.size;
      this.keyboardCodes.clear();
      this.gamepadActions.clear();
      this.touchActions.clear();
      this.gamepadStick = Object.freeze({ x: 0, y: 0, magnitude: 0 });
      this.touchStick = Object.freeze({ x: 0, y: 0, magnitude: 0 });
      this.activeGamepad = null;
      this.buffer.clear();
      if (hadState) this._emit("release-all", Object.freeze({ source: safePresetId(source, "manual") }));
      return Boolean(hadState);
    }

    snapshot(now = this.clock()) {
      this.buffer.prune(now);
      const down = ACTION_IDS.filter((actionId) => this.isActionDown(actionId));
      return deepFreeze({
        presetId: this.presetId,
        paused: this.paused,
        attached: this.attached,
        movement: this.getMovementVector(),
        down,
        buffered: this.buffer.events.map((event) => ({ actionId: event.actionId, at: event.at, sequence: event.sequence, payload: event.payload })),
        gamepadConnected: Boolean(this.activeGamepad)
      });
    }

    getMappings() {
      return normalizeMappings(this.mappings);
    }

    getConflicts() {
      return detectBindingConflicts(this.mappings);
    }

    remap(actionId, bindings, options = {}) {
      if (this.disposed) return Object.freeze({ ok: false, reason: "DISPOSED", conflicts: Object.freeze([]) });
      if (!ACTION_ID_SET.has(actionId)) return Object.freeze({ ok: false, reason: "ACTION_UNKNOWN", conflicts: Object.freeze([]) });
      const candidate = cloneMappings(this.mappings);
      candidate[actionId] = normalizeBindingList(bindings);
      const mappings = normalizeMappings(candidate);
      const conflicts = detectBindingConflicts(mappings);
      if (conflicts.length && options.allowConflicts !== true) return Object.freeze({ ok: false, reason: "BINDING_CONFLICT", conflicts });
      this.mappings = mappings;
      this.releaseAll("remap");
      this._emit("mappings", Object.freeze({ actionId, conflicts }));
      return Object.freeze({ ok: true, mappings, conflicts });
    }

    listPresets() {
      return Object.freeze(Array.from(this.presets.values()).map((preset) => Object.freeze({ id: preset.id, label: preset.label, builtin: Boolean(preset.builtin) })));
    }

    createPreset(id, label, mappings = this.mappings) {
      if (this.disposed) return Object.freeze({ ok: false, reason: "DISPOSED" });
      const presetId = safePresetId(id);
      if (!presetId || this.presets.has(presetId)) return Object.freeze({ ok: false, reason: "PRESET_ID_INVALID" });
      if (this.customPresetIds.size >= LIMITS.MAX_CUSTOM_PRESETS) return Object.freeze({ ok: false, reason: "PRESET_LIMIT" });
      const preset = deepFreeze({ id: presetId, label: safeText(label, LIMITS.MAX_PRESET_LABEL_LENGTH, presetId), builtin: false, mappings: normalizeMappings(mappings, STANDARD_MAPPINGS) });
      this.presets.set(presetId, preset);
      this.customPresetIds.add(presetId);
      return Object.freeze({ ok: true, preset });
    }

    removePreset(id) {
      const presetId = safePresetId(id);
      if (!this.customPresetIds.has(presetId)) return false;
      this.customPresetIds.delete(presetId);
      this.presets.delete(presetId);
      if (this.presetId === presetId) this.applyPreset("standard");
      return true;
    }

    applyPreset(id) {
      if (this.disposed) return Object.freeze({ ok: false, reason: "DISPOSED" });
      const presetId = safePresetId(id);
      const preset = this.presets.get(presetId);
      if (!preset) return Object.freeze({ ok: false, reason: "PRESET_UNKNOWN" });
      this.presetId = presetId;
      this.mappings = normalizeMappings(preset.mappings);
      this.releaseAll("preset");
      this._emit("preset", Object.freeze({ presetId }));
      return Object.freeze({ ok: true, presetId, mappings: this.mappings });
    }

    updateSettings(input) {
      if (this.disposed) return false;
      this.settings = normalizeSettings({ ...this.settings, ...(input || {}) });
      this.buffer.windowMs = this.settings.bufferWindowMs;
      return true;
    }

    buildPersistencePayload() {
      const customPresets = Array.from(this.customPresetIds)
        .sort()
        .map((id) => {
          const preset = this.presets.get(id);
          return { id: preset.id, label: preset.label, mappings: cloneMappings(preset.mappings) };
        });
      return {
        format: FORMAT,
        version: 1,
        presetId: this.presetId,
        mappings: cloneMappings(this.mappings),
        customPresets,
        settings: { ...this.settings }
      };
    }

    exportProfile() {
      const payload = this.buildPersistencePayload();
      const validation = validatePersistencePayload(payload);
      if (!validation.valid) return Object.freeze({ ok: false, reason: "PROFILE_VALIDATION_FAILED", errors: validation.errors, json: "" });
      const json = JSON.stringify(payload);
      if (utf8ByteLength(json) > LIMITS.MAX_PROFILE_BYTES) return Object.freeze({ ok: false, reason: "PROFILE_TOO_LARGE", errors: Object.freeze(["PROFILE_TOO_LARGE"]), json: "" });
      return Object.freeze({ ok: true, json, bytes: utf8ByteLength(json) });
    }

    importProfile(input) {
      if (this.disposed) return Object.freeze({ ok: false, reason: "DISPOSED", errors: Object.freeze([]) });
      const validation = validatePersistencePayload(input);
      if (!validation.valid) return Object.freeze({ ok: false, reason: "PROFILE_INVALID", errors: validation.errors });
      for (const id of Array.from(this.customPresetIds)) this.presets.delete(id);
      this.customPresetIds.clear();
      for (const row of validation.value.customPresets) {
        const preset = deepFreeze({ ...row, builtin: false });
        this.presets.set(row.id, preset);
        this.customPresetIds.add(row.id);
      }
      this.presetId = validation.value.presetId;
      this.mappings = normalizeMappings(validation.value.mappings);
      this.settings = normalizeSettings(validation.value.settings);
      this.buffer.windowMs = this.settings.bufferWindowMs;
      this.releaseAll("profile");
      this._emit("profile", Object.freeze({ presetId: this.presetId }));
      return Object.freeze({ ok: true, presetId: this.presetId });
    }

    _resolveStorage(storage = null) {
      if (storage && typeof storage.getItem === "function" && typeof storage.setItem === "function") return storage;
      if (this.storage && typeof this.storage.getItem === "function" && typeof this.storage.setItem === "function") return this.storage;
      try {
        const candidate = this.runtime?.localStorage;
        return candidate && typeof candidate.getItem === "function" && typeof candidate.setItem === "function" ? candidate : null;
      } catch (_) {
        return null;
      }
    }

    save(storage = null) {
      const target = this._resolveStorage(storage);
      if (!target) return Object.freeze({ ok: false, reason: "STORAGE_UNAVAILABLE" });
      const exported = this.exportProfile();
      if (!exported.ok) return exported;
      try {
        target.setItem(this.storageKey, exported.json);
        return Object.freeze({ ok: true, bytes: exported.bytes });
      } catch (_) {
        return Object.freeze({ ok: false, reason: "STORAGE_WRITE_FAILED" });
      }
    }

    load(storage = null) {
      const target = this._resolveStorage(storage);
      if (!target) return Object.freeze({ ok: false, reason: "STORAGE_UNAVAILABLE" });
      let raw = null;
      try { raw = target.getItem(this.storageKey); } catch (_) { return Object.freeze({ ok: false, reason: "STORAGE_READ_FAILED" }); }
      if (!raw) return Object.freeze({ ok: false, reason: "PROFILE_NOT_FOUND" });
      return this.importProfile(raw);
    }

    clearPersistence(storage = null) {
      const target = this._resolveStorage(storage);
      if (!target || typeof target.removeItem !== "function") return false;
      try { target.removeItem(this.storageKey); return true; } catch (_) { return false; }
    }
  }

  function createInputActionSystem(options) {
    return new InputActionSystem(options);
  }

  return Object.freeze({
    VERSION,
    FORMAT,
    STORAGE_KEY,
    LIMITS,
    ACTION_IDS,
    ACTION_METADATA,
    DEFAULT_ACTIONS,
    DEFAULT_PRESETS,
    canonicalKeyboardCode,
    normalizeBinding,
    bindingKey,
    normalizeMappings,
    detectBindingConflicts,
    normalizeVector,
    applyCircularDeadzone,
    moveTowards,
    stepScalarVelocity,
    stepMovement,
    isTextEntryTarget,
    isTextEntryEvent,
    validatePersistencePayload,
    detectFeatures,
    InputBuffer,
    InputActionSystem,
    createInputActionSystem
  });
});
