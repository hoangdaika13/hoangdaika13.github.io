(function initHHStore(global) {
  "use strict";

  const storageKey = "hh-platform-store-v1";
  const bus = global.HHEventBus;
  const subscribers = new Set();

  const fallbackState = {
    user: null,
    authToken: "",
    trackingConsent: false,
    votes: { likes: 0, ratings: [0, 0, 0, 0, 0] },
    modules: [],
    settings: { theme: "neon" }
  };

  let state = readState();

  function clone(value) {
    if (value == null || typeof value !== "object") return value;
    return JSON.parse(JSON.stringify(value));
  }

  function merge(base, patch) {
    const output = { ...base };
    Object.keys(patch || {}).forEach((key) => {
      const value = patch[key];
      if (value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object") {
        output[key] = merge(base[key], value);
      } else {
        output[key] = value;
      }
    });
    return output;
  }

  function readState() {
    try {
      const saved = JSON.parse(global.localStorage.getItem(storageKey) || "{}");
      return merge(fallbackState, saved);
    } catch {
      return clone(fallbackState);
    }
  }

  function persist() {
    try {
      global.localStorage.setItem(storageKey, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  function notify(previousState, source) {
    const snapshot = clone(state);
    subscribers.forEach((handler) => handler(snapshot, clone(previousState), source));
    if (bus) bus.emit("store:change", { state: snapshot, previousState: clone(previousState), source });
  }

  const api = {
    getState() {
      return clone(state);
    },

    setState(nextState, options) {
      const previousState = state;
      state = merge(fallbackState, nextState || {});
      if (!options || options.persist !== false) persist();
      notify(previousState, options?.source || "setState");
      return api.getState();
    },

    patch(patch, options) {
      const previousState = state;
      state = merge(state, patch || {});
      if (!options || options.persist !== false) persist();
      notify(previousState, options?.source || "patch");
      return api.getState();
    },

    subscribe(handler) {
      if (typeof handler !== "function") throw new TypeError("HHStore subscriber must be a function.");
      subscribers.add(handler);
      return () => subscribers.delete(handler);
    },

    select(selector, fallbackValue) {
      if (typeof selector !== "function") return fallbackValue;
      try {
        return selector(api.getState());
      } catch {
        return fallbackValue;
      }
    },

    reset(options) {
      return api.setState(clone(fallbackState), { ...(options || {}), source: options?.source || "reset" });
    },

    persist
  };

  // Backend note: auth/session values here are only local mirrors; real trust needs server-issued tokens.
  global.HHStore = global.HHStore || api;
})(window);
