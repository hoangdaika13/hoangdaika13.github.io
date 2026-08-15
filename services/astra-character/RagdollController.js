(function initRagdollController(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  class RagdollController {
    constructor() { this.state = "animated"; this.weight = 0; this.pose = "back"; this.serverConfirmed = false; }
    activate(options = {}) { if (!options.serverConfirmed) return { accepted: false, reason: "server-confirmation-required" }; this.serverConfirmed = true; this.state = options.partial ? "partial-ragdoll" : "ragdoll"; this.pose = String(options.pose || "back"); return { accepted: true, state: this.state }; }
    requestGetUp() { if (!this.serverConfirmed || !["ragdoll", "partial-ragdoll"].includes(this.state)) return null; this.state = `get-up-${["front", "left", "right"].includes(this.pose) ? this.pose : "back"}`; return this.state; }
    update(dt) { const target = ["ragdoll", "partial-ragdoll"].includes(this.state) ? (this.state === "partial-ragdoll" ? 0.55 : 1) : 0; this.weight = A.damp(this.weight, target, 9, dt); if (this.state.startsWith("get-up") && this.weight < 0.02) { this.state = "animated"; this.serverConfirmed = false; } return { state: this.state, weight: this.weight, pose: this.pose }; }
    reset() { this.state = "animated"; this.weight = 0; this.serverConfirmed = false; }
  }
  A.RagdollController = RagdollController;
  if (typeof module !== "undefined" && module.exports) module.exports = RagdollController;
})(typeof window !== "undefined" ? window : globalThis);
