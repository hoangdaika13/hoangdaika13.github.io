(function (global) {
  "use strict";

  const VERSION = 1;
  const BASE_KEY = "hh.virtual-assistant.v1";
  const DEFAULTS = Object.freeze({
    open: true,
    minimized: false,
    voiceEnabled: false,
    soundEnabled: true,
    voiceProvider: "browser",
    voiceURI: "",
    rate: 1,
    pitch: 1.05,
    volume: 0.78,
    quality: "balanced",
    animationEnabled: true,
    x: null,
    y: null,
    history: []
  });

  const cleanId = (value) => String(value || "guest").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "guest";
  const readJson = (key, fallback = {}) => {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
  };
  const account = () => readJson("hh-auth-user", {});
  const ownerId = () => {
    const user = account();
    return cleanId(user._id || user.id || user.userId || user.email || "guest");
  };
  const profileId = () => {
    const learning = readJson("hh.learning.os.v1", {});
    const japanese = readJson("hh.japanese.os.v3", {});
    return cleanId(learning.learnerProfileId || learning.activeProfileId || japanese.learnerProfileId || "default");
  };
  const storageKey = () => `${BASE_KEY}:${ownerId()}:${profileId()}`;

  function load() {
    const saved = readJson(storageKey(), {});
    return {
      ...DEFAULTS,
      ...saved,
      open: saved.open !== false,
      minimized: saved.minimized === true,
      voiceEnabled: saved.voiceEnabled === true,
      soundEnabled: saved.soundEnabled !== false,
      animationEnabled: saved.animationEnabled !== false,
      voiceProvider: ["browser", "cloud"].includes(saved.voiceProvider) ? saved.voiceProvider : "browser",
      quality: ["static", "balanced", "cinematic"].includes(saved.quality) ? saved.quality : "balanced",
      rate: Math.min(1.5, Math.max(.65, Number(saved.rate) || 1)),
      pitch: Math.min(1.5, Math.max(.7, Number(saved.pitch) || 1.05)),
      volume: Math.min(1, Math.max(0, Number(saved.volume) || .78)),
      history: Array.isArray(saved.history) ? saved.history.slice(-40) : []
    };
  }

  function save(state) {
    const safe = { ...state, history: Array.isArray(state.history) ? state.history.slice(-40) : [] };
    try { localStorage.setItem(storageKey(), JSON.stringify(safe)); } catch {}
    return safe;
  }

  function context() {
    const todos = readJson("hh.command-center.todos.v2", []);
    const learning = readJson("hh.learning.os.v1", {});
    const japanese = readJson("hh.japanese.os.v3", {});
    const notifications = readJson("hh-notification-center", {});
    const recent = readJson("hh.app-shell.recent", []);
    const todoList = Array.isArray(todos) ? todos : (Array.isArray(todos.items) ? todos.items : []);
    const inbox = Array.isArray(notifications.inbox) ? notifications.inbox : [];
    const dueLearning = Number(learning.dueCount || learning.reviewDue || 0);
    const dueJapanese = Number(japanese.dueCount || japanese.reviewDue || japanese.srsDue || 0);
    const recentList = Array.isArray(recent) ? recent : [];
    return Object.freeze({
      owner: ownerId(),
      profile: profileId(),
      signedIn: ownerId() !== "guest",
      taskCount: todoList.filter((item) => item && item.done !== true && item.completed !== true).length,
      lessonDue: Math.max(0, dueLearning + dueJapanese),
      unreadCount: inbox.filter((item) => item && item.read !== true).length,
      recentRoute: String(recentList[0]?.route || recentList[0]?.path || "/home").slice(0, 100),
      online: navigator.onLine,
      apiStatus: document.querySelector('[data-hlw-status="api"]')?.textContent?.trim() || "Chưa đo"
    });
  }

  global.HHVirtualAssistantCore = Object.freeze({ VERSION, DEFAULTS, ownerId, profileId, storageKey, load, save, context });
})(window);
