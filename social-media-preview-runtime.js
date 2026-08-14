(function initSocialMediaPreviewRuntime(root) {
  "use strict";

  const defaultNow = () => root.performance?.now?.() ?? Date.now();
  const defaultRaf = (callback) => root.requestAnimationFrame?.(callback) ?? root.setTimeout(() => callback(defaultNow()), 16);
  const defaultCaf = (id) => root.cancelAnimationFrame?.(id) ?? root.clearTimeout?.(id);

  function create(options = {}) {
    if (typeof options.render !== "function") throw new TypeError("Preview runtime cần hàm render.");
    const raf = options.raf || defaultRaf;
    const caf = options.caf || defaultCaf;
    const now = options.now || defaultNow;
    const doc = options.document || root.document;
    let frameId = 0;
    let probeId = 0;
    let pending = null;
    let destroyed = false;
    let paused = Boolean(doc?.hidden);
    let droppedUpdates = 0;
    let probeStartedAt = 0;
    let probeFrames = 0;
    let lastMetrics = Object.freeze({ fps:0, renderMs:0, droppedUpdates:0, paused });

    const report = (patch = {}) => {
      lastMetrics = Object.freeze({ ...lastMetrics, ...patch, paused, droppedUpdates });
      options.onMetrics?.(lastMetrics);
    };

    const probe = (time) => {
      if (destroyed || paused) { probeId = 0; return; }
      if (!probeStartedAt) probeStartedAt = time || now();
      probeFrames += 1;
      const elapsed = (time || now()) - probeStartedAt;
      if (elapsed >= 700) {
        report({ fps:Math.max(1, Math.round(probeFrames * 1000 / elapsed)) });
        probeId = 0;
        probeStartedAt = 0;
        probeFrames = 0;
        return;
      }
      probeId = raf(probe);
    };

    const startProbe = () => {
      if (!probeId && !paused && !destroyed) probeId = raf(probe);
    };

    const draw = () => {
      frameId = 0;
      if (destroyed || paused || pending === null) return;
      const payload = pending;
      pending = null;
      const startedAt = now();
      options.render(payload);
      report({ renderMs:Math.max(0, now() - startedAt) });
      startProbe();
    };

    const schedule = (payload) => {
      if (destroyed) return false;
      if (pending !== null) droppedUpdates += 1;
      pending = payload;
      if (!paused && !frameId) frameId = raf(draw);
      return true;
    };

    const flush = () => {
      if (destroyed || pending === null) return false;
      if (frameId) { caf(frameId); frameId = 0; }
      const wasPaused = paused;
      paused = false;
      draw();
      paused = wasPaused;
      report();
      return true;
    };

    const setPaused = (value) => {
      paused = Boolean(value);
      if (paused) {
        if (frameId) caf(frameId);
        if (probeId) caf(probeId);
        frameId = 0;
        probeId = 0;
        probeStartedAt = 0;
        probeFrames = 0;
      } else if (pending !== null && !frameId) frameId = raf(draw);
      report();
    };

    const onVisibilityChange = () => setPaused(Boolean(doc?.hidden));
    doc?.addEventListener?.("visibilitychange", onVisibilityChange);

    return Object.freeze({
      schedule,
      flush,
      setPaused,
      metrics:() => lastMetrics,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        if (frameId) caf(frameId);
        if (probeId) caf(probeId);
        doc?.removeEventListener?.("visibilitychange", onVisibilityChange);
        frameId = 0;
        probeId = 0;
        pending = null;
      }
    });
  }

  root.HHSocialPreviewRuntime = Object.freeze({ VERSION:1, create });
  if (typeof module !== "undefined" && module.exports) module.exports = root.HHSocialPreviewRuntime;
})(typeof window !== "undefined" ? window : globalThis);
