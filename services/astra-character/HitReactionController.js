(function initHitReactionController(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  const REGIONS = new Set(["head", "chest", "abdomen", "left-arm", "right-arm", "left-leg", "right-leg", "back"]);
  class HitReactionController {
    constructor() { this.current = null; this.healthRatio = 1; }
    apply(hit = {}, serverConfirmed = false) {
      const intensity = A.clamp(hit.intensity || 0.15, 0, 1);
      const region = REGIONS.has(hit.region) ? hit.region : "chest";
      let level = intensity > 0.92 ? "death" : intensity > 0.74 ? "knockdown" : intensity > 0.56 ? "knockback" : intensity > 0.38 ? "heavy-stagger" : intensity > 0.18 ? "light-stagger" : "flinch";
      if (["knockdown", "death", "knockback"].includes(level) && !serverConfirmed) level = "heavy-stagger";
      this.current = { level, region, direction: A.vector3(hit.direction), element: String(hit.element || "neutral"), weapon: String(hit.weapon || "unknown"), additive: ["flinch", "light-stagger"].includes(level), serverConfirmed, startedAt: A.now(), duration: ({ flinch: 180, "light-stagger": 320, "heavy-stagger": 540, knockback: 720, knockdown: 1600, death: Infinity })[level] };
      return this.current;
    }
    updateHealth(current, maximum) { this.healthRatio = A.clamp(current / Math.max(1, maximum), 0, 1); return this.healthRatio < 0.3 ? "injured" : "normal"; }
    update(timestamp = A.now()) { if (this.current && Number.isFinite(this.current.duration) && timestamp - this.current.startedAt >= this.current.duration) this.current = null; return this.current; }
  }
  A.HitReactionController = HitReactionController;
  if (typeof module !== "undefined" && module.exports) module.exports = HitReactionController;
})(typeof window !== "undefined" ? window : globalThis);
