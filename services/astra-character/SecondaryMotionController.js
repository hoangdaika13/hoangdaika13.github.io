(function initSecondaryMotionController(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  class SecondaryMotionController {
    constructor(options = {}) { this.fixedStep = 1 / A.clamp(options.hz || 60, 15, 120); this.accumulator = 0; this.chains = new Map(); this.enabled = true; this.lastTimestamp = A.now(); this.resets = 0; }
    registerChain(id, points = [], profile = {}) { const key = A.safeId(id, "secondaryChain.id"); this.chains.set(key, { points: points.map((point) => ({ position: A.vector3(point.position || point), previous: A.vector3(point.position || point) })), stiffness: A.clamp(profile.stiffness || 0.6, 0, 1), damping: A.clamp(profile.damping || 0.12, 0, 0.95), gravity: Number(profile.gravity ?? -0.12) }); return key; }
    simulate(step) { this.chains.forEach((chain) => chain.points.forEach((point, index) => { if (!index) return; const vx = (point.position.x - point.previous.x) * (1 - chain.damping); const vy = (point.position.y - point.previous.y) * (1 - chain.damping); const vz = (point.position.z - point.previous.z) * (1 - chain.damping); point.previous = { ...point.position }; point.position.x += vx; point.position.y += vy + chain.gravity * step * step; point.position.z += vz; const anchor = chain.points[index - 1].position; const rest = 0.08; const dx = point.position.x - anchor.x, dy = point.position.y - anchor.y, dz = point.position.z - anchor.z; const length = Math.max(1e-5, Math.hypot(dx, dy, dz)); const correction = (length - rest) / length * chain.stiffness; point.position.x -= dx * correction; point.position.y -= dy * correction; point.position.z -= dz * correction; })); }
    update(dt) { if (!this.enabled) return 0; if (!Number.isFinite(dt) || dt > 0.2) { this.reset("resume"); return 0; } this.accumulator = Math.min(0.1, this.accumulator + Math.max(0, dt)); let steps = 0; while (this.accumulator >= this.fixedStep && steps < 6) { this.simulate(this.fixedStep); this.accumulator -= this.fixedStep; steps += 1; } return steps; }
    reset(reason = "teleport") { this.accumulator = 0; this.chains.forEach((chain) => chain.points.forEach((point) => { point.previous = { ...point.position }; })); this.resets += 1; this.lastResetReason = reason; }
    setDistance(distance, tier = "balanced") { this.enabled = tier !== "save-data" && distance < (tier === "cinematic" ? 60 : tier === "high" ? 40 : 25); }
    dispose() { this.chains.clear(); }
  }
  A.SecondaryMotionController = SecondaryMotionController;
  if (typeof module !== "undefined" && module.exports) module.exports = SecondaryMotionController;
})(typeof window !== "undefined" ? window : globalThis);
