(function initLookAtController(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  class LookAtController {
    constructor() { this.target = null; this.yaw = 0; this.pitch = 0; this.eyeYaw = 0; this.eyePitch = 0; this.weight = 0; }
    setTarget(target, weight = 1) { this.target = target ? A.vector3(target) : null; this.weight = A.clamp(weight, 0, 1); }
    update(origin = {}, facingYaw = 0, dt = 1 / 60) {
      if (!this.target) { this.weight = A.damp(this.weight, 0, 8, dt); return this.snapshot(); }
      const dx = this.target.x - (origin.x || 0), dy = this.target.y - (origin.y || 0), dz = this.target.z - (origin.z || 0);
      const targetYaw = A.angleDelta(facingYaw, Math.atan2(dx, dz));
      const behind = Math.abs(targetYaw) > Math.PI * 0.72;
      const clampedYaw = A.clamp(targetYaw, -1.05, 1.05);
      const targetPitch = A.clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.55, 0.62);
      this.eyeYaw = A.damp(this.eyeYaw, behind ? 0 : A.clamp(clampedYaw, -0.38, 0.38), 22, dt);
      this.eyePitch = A.damp(this.eyePitch, behind ? 0 : A.clamp(targetPitch, -0.28, 0.28), 22, dt);
      this.yaw = A.damp(this.yaw, behind ? 0 : clampedYaw, 8, dt);
      this.pitch = A.damp(this.pitch, behind ? 0 : targetPitch, 8, dt);
      return this.snapshot(behind);
    }
    snapshot(behind = false) { return { yaw: this.yaw, pitch: this.pitch, eyeYaw: this.eyeYaw, eyePitch: this.eyePitch, weight: this.weight, targetBehind: behind }; }
  }
  A.LookAtController = LookAtController;
  if (typeof module !== "undefined" && module.exports) module.exports = LookAtController;
})(typeof window !== "undefined" ? window : globalThis);
