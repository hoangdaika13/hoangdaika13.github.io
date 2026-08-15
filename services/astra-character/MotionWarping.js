(function initMotionWarping(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  class MotionWarping {
    constructor(options = {}) {
      this.minStride = A.clamp(options.minStride || 0.72, 0.4, 1);
      this.maxStride = A.clamp(options.maxStride || 1.28, 1, 1.8);
      this.maxRootDelta = A.clamp(options.maxRootDelta || 0.55, 0.05, 2);
      this.last = { strideScale: 1, rootAccepted: true };
    }
    strideScale(actualSpeed, authoredSpeed, legScale = 1) {
      if (Math.abs(actualSpeed - authoredSpeed) < 0.08 || authoredSpeed < 0.05) return 1;
      const anatomicalMin = this.minStride * A.clamp(legScale, 0.75, 1.3);
      const anatomicalMax = this.maxStride * A.clamp(legScale, 0.75, 1.3);
      this.last.strideScale = A.clamp(actualSpeed / authoredSpeed, anatomicalMin, anatomicalMax);
      return this.last.strideScale;
    }
    validateRootDelta(delta = {}, dt = 1 / 60, speedLimit = 10) {
      const distance = Math.hypot(Number(delta.x || 0), Number(delta.y || 0), Number(delta.z || 0));
      const allowed = Math.min(this.maxRootDelta, Math.max(0.02, speedLimit * Math.max(0.001, dt) * 1.4));
      this.last.rootAccepted = Number.isFinite(distance) && distance <= allowed;
      return { accepted: this.last.rootAccepted, distance, allowed, delta: this.last.rootAccepted ? A.vector3(delta) : { x: 0, y: 0, z: 0 } };
    }
  }
  A.MotionWarping = MotionWarping;
  if (typeof module !== "undefined" && module.exports) module.exports = MotionWarping;
})(typeof window !== "undefined" ? window : globalThis);
