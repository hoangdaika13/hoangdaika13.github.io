(function initHHEventBus(global) {
  "use strict";

  const channels = new Map();
  const wildcard = "*";

  const normalize = (eventName) => String(eventName || "").trim();
  const listenersFor = (eventName) => {
    const name = normalize(eventName);
    if (!name) throw new Error("HHEventBus requires an event name.");
    if (!channels.has(name)) channels.set(name, new Set());
    return channels.get(name);
  };

  const api = {
    on(eventName, handler) {
      if (typeof handler !== "function") throw new TypeError("HHEventBus handler must be a function.");
      const listeners = listenersFor(eventName);
      listeners.add(handler);
      return () => api.off(eventName, handler);
    },

    once(eventName, handler) {
      const unsubscribe = api.on(eventName, function onceHandler(payload, meta) {
        unsubscribe();
        handler(payload, meta);
      });
      return unsubscribe;
    },

    off(eventName, handler) {
      const name = normalize(eventName);
      const listeners = channels.get(name);
      if (!listeners) return false;
      const removed = listeners.delete(handler);
      if (!listeners.size) channels.delete(name);
      return removed;
    },

    emit(eventName, payload) {
      const name = normalize(eventName);
      if (!name) throw new Error("HHEventBus requires an event name.");
      const meta = { name, timestamp: Date.now() };
      const targets = [
        ...(channels.get(name) || []),
        ...(channels.get(wildcard) || [])
      ];

      targets.forEach((handler) => {
        try {
          handler(payload, meta);
        } catch (error) {
          setTimeout(() => { throw error; }, 0);
        }
      });

      if (typeof global.CustomEvent === "function" && typeof global.dispatchEvent === "function") {
        global.dispatchEvent(new CustomEvent("hh:event", { detail: { eventName: name, payload, meta } }));
      }

      return targets.length;
    },

    clear(eventName) {
      if (eventName) return channels.delete(normalize(eventName));
      channels.clear();
      return true;
    }
  };

  global.HHEventBus = global.HHEventBus || api;
})(window);
