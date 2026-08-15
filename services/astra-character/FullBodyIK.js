(function initFullBodyIK(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  class FullBodyIK {
    constructor(options = {}) {
      this.iterations = A.clamp(options.iterations || 6, 1, 16);
      this.chains = new Map();
      this.enabled = true;
      this.lastSolve = {};
    }
    registerChain(id, definition = {}) {
      const key = A.safeId(id, "ikChain.id");
      const lengths = (definition.lengths || []).map((length) => A.clamp(length, 0.001, 10));
      if (lengths.length < 2) throw new TypeError("IK chain cần ít nhất hai segment.");
      this.chains.set(key, { ...definition, id: key, lengths, weight: A.clamp(definition.weight ?? 1, 0, 1) });
      return this.chains.get(key);
    }
    solveTwoBone(id, origin, target, pole = { x: 0, y: 1, z: 0 }) {
      const chain = this.chains.get(id);
      if (!chain || !this.enabled) return null;
      const rootPoint = A.vector3(origin), targetPoint = A.vector3(target);
      const dx = targetPoint.x - rootPoint.x, dy = targetPoint.y - rootPoint.y, dz = targetPoint.z - rootPoint.z;
      const distance = Math.hypot(dx, dy, dz);
      const first = chain.lengths[0], second = chain.lengths[1];
      const reachable = A.clamp(distance, Math.abs(first - second) + 1e-4, first + second - 1e-4);
      const jointAngle = Math.acos(A.clamp((first * first + second * second - reachable * reachable) / (2 * first * second), -1, 1));
      const shoulderAngle = Math.acos(A.clamp((first * first + reachable * reachable - second * second) / (2 * first * reachable), -1, 1));
      const result = { id, distance, reachable, stretched: distance > first + second, jointAngle, shoulderAngle, pole: A.vector3(pole), weight: chain.weight, iterations: this.iterations };
      this.lastSolve[id] = result;
      return result;
    }
    setQuality(tier) { this.iterations = ({ cinematic: 10, high: 8, balanced: 5, low: 2, "save-data": 1 })[tier] || 5; }
    dispose() { this.chains.clear(); this.lastSolve = {}; }
  }
  A.FullBodyIK = FullBodyIK;
  if (typeof module !== "undefined" && module.exports) module.exports = FullBodyIK;
})(typeof window !== "undefined" ? window : globalThis);
