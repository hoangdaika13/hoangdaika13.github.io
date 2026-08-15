(function initContextualInteractionController(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  const TYPES = new Set(["door", "pickup", "switch", "sit", "stand", "ladder", "ledge", "vault", "push", "pull", "talk", "handshake", "heal", "enter-vehicle", "exit-vehicle"]);
  class ContextualInteractionController {
    constructor() { this.active = null; this.state = "idle"; this.events = new A.EventBus(); }
    request(target = {}) { if (!TYPES.has(target.type)) return { accepted: false, reason: "unsupported-interaction" }; if (target.serverValidated !== true) return { accepted: false, reason: "server-validation-required" }; this.active = { ...target, approachPoint: A.vector3(target.approachPoint), facingDirection: A.vector3(target.facingDirection), duration: Math.max(0.1, Number(target.duration || 1)), elapsed: 0 }; this.state = "approach"; return { accepted: true, state: this.state }; }
    update(dt, actor = {}) { if (!this.active) return { state: "idle" }; const point = this.active.approachPoint; const distance = Math.hypot(point.x - (actor.x || 0), point.z - (actor.z || 0)); if (this.state === "approach" && distance <= 0.12) { this.state = "align"; this.events.emit("approached", this.active); } else if (this.state === "align" && Math.abs(A.angleDelta(actor.yaw || 0, this.active.facingYaw || actor.yaw || 0)) < 0.08) { this.state = "perform"; this.events.emit("start", this.active); } else if (this.state === "perform") { this.active.elapsed += Math.max(0, dt); if (this.active.elapsed >= this.active.duration) { this.events.emit("complete", this.active); this.active = null; this.state = "idle"; } } return { state: this.state, distance, active: this.active ? { type: this.active.type, animationId: this.active.animationId || "" } : null }; }
    interrupt(reason = "cancelled") { if (!this.active || this.active.interruptPolicy === "locked") return false; this.events.emit("interrupt", { target: this.active, reason }); this.active = null; this.state = "idle"; return true; }
    dispose() { this.active = null; this.events.clear(); }
  }
  A.ContextualInteractionController = ContextualInteractionController;
  if (typeof module !== "undefined" && module.exports) module.exports = ContextualInteractionController;
})(typeof window !== "undefined" ? window : globalThis);
