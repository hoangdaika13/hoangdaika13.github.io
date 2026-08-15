(function initAstraCharacterCore(root) {
  "use strict";

  const namespace = root.HHAstraCharacter ||= {};
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const now = () => root.performance?.now?.() ?? Date.now();
  const safeId = (value, label = "id") => {
    const id = String(value || "").trim();
    if (!/^[a-z0-9][a-z0-9._:-]{0,79}$/i.test(id)) throw new TypeError(`${label} không hợp lệ.`);
    return id;
  };
  const vector3 = (value = {}) => ({ x: finite(value.x), y: finite(value.y), z: finite(value.z) });
  const length2 = (value = {}) => Math.hypot(finite(value.x), finite(value.z));
  const normalize2 = (value = {}) => {
    const length = length2(value);
    return length > 1e-6 ? { x: finite(value.x) / length, z: finite(value.z) / length } : { x: 0, z: 0 };
  };
  const moveTowards = (current, target, maxDelta) => current < target
    ? Math.min(target, current + maxDelta)
    : Math.max(target, current - maxDelta);
  const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-Math.max(0, lambda) * Math.max(0, dt)));
  const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const freeze = (value) => Object.freeze(value);

  class EventBus {
    constructor() { this.listeners = new Map(); }
    on(type, handler) {
      if (typeof handler !== "function") throw new TypeError("Event handler phải là function.");
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(handler);
      return () => this.listeners.get(type)?.delete(handler);
    }
    emit(type, detail) { this.listeners.get(type)?.forEach((handler) => handler(detail)); }
    clear() { this.listeners.clear(); }
  }

  class DisposableRegistry {
    constructor() { this.items = new Set(); this.disposed = false; }
    add(disposable) {
      if (this.disposed) throw new Error("Registry đã dispose.");
      if (disposable) this.items.add(disposable);
      return disposable;
    }
    dispose() {
      if (this.disposed) return false;
      this.disposed = true;
      [...this.items].reverse().forEach((item) => {
        try {
          if (typeof item === "function") item();
          else item?.dispose?.();
        } catch {}
      });
      this.items.clear();
      return true;
    }
  }

  Object.assign(namespace, {
    VERSION: "3.0.0",
    clamp, finite, now, safeId, vector3, length2, normalize2, moveTowards, damp, angleDelta, clone, freeze,
    EventBus, DisposableRegistry
  });
  if (typeof module !== "undefined" && module.exports) module.exports = namespace;
})(typeof window !== "undefined" ? window : globalThis);
