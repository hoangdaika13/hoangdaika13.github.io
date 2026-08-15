(function initFootPlacementIK(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  class FootPlacementIK {
    constructor(options = {}) {
      this.deadZone = A.clamp(options.deadZone || 0.006, 0.001, 0.03);
      this.maxError = A.clamp(options.maxError || 0.03, 0.01, 0.12);
      this.smoothing = A.clamp(options.smoothing || 22, 2, 60);
      this.hipMaxOffset = A.clamp(options.hipMaxOffset || 0.22, 0.04, 0.5);
      this.feet = { left: this.makeFoot(), right: this.makeFoot() };
      this.enabled = true;
    }
    makeFoot() { return { planted: false, weight: 0, phase: "swing", target: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 }, error: 0, toeRoll: 0, heelContact: 0 }; }
    updateFoot(side, sample = {}, dt = 1 / 60) {
      const foot = this.feet[side];
      if (!foot) throw new TypeError(`Foot side ${side} không hợp lệ.`);
      const allowed = this.enabled && sample.enabled !== false && sample.grounded !== false && !sample.ragdoll;
      const contact = allowed && (sample.plantMarker === true || sample.phase === "plant");
      const target = A.vector3(sample.point || foot.target);
      const delta = Math.hypot(target.x - foot.target.x, target.y - foot.target.y, target.z - foot.target.z);
      if (contact && (!foot.planted || delta > this.maxError)) foot.target = target;
      else if (contact && delta > this.deadZone) {
        foot.target.x = A.damp(foot.target.x, target.x, this.smoothing, dt);
        foot.target.y = A.damp(foot.target.y, target.y, this.smoothing, dt);
        foot.target.z = A.damp(foot.target.z, target.z, this.smoothing, dt);
      }
      foot.planted = contact;
      foot.weight = A.damp(foot.weight, contact ? 1 : 0, contact ? this.smoothing : this.smoothing * 1.5, dt);
      foot.normal.x = A.damp(foot.normal.x, sample.normal?.x || 0, this.smoothing, dt);
      foot.normal.y = A.damp(foot.normal.y, sample.normal?.y ?? 1, this.smoothing, dt);
      foot.normal.z = A.damp(foot.normal.z, sample.normal?.z || 0, this.smoothing, dt);
      foot.phase = String(sample.phase || (contact ? "plant" : "swing"));
      foot.toeRoll = A.clamp(sample.toeRoll || 0, -0.45, 0.75);
      foot.heelContact = A.clamp(sample.heelContact || 0, 0, 1);
      foot.error = Math.min(this.maxError, delta);
      return { ...foot, target: { ...foot.target }, normal: { ...foot.normal } };
    }
    solveHip(pelvisY, leftDesiredY, rightDesiredY) {
      const required = Math.min(0, Math.min(leftDesiredY - pelvisY, rightDesiredY - pelvisY));
      return A.clamp(required, -this.hipMaxOffset, this.hipMaxOffset);
    }
    reset() { this.feet.left = this.makeFoot(); this.feet.right = this.makeFoot(); }
    getDiagnostics() { return A.clone(this.feet); }
  }
  A.FootPlacementIK = FootPlacementIK;
  if (typeof module !== "undefined" && module.exports) module.exports = FootPlacementIK;
})(typeof window !== "undefined" ? window : globalThis);
