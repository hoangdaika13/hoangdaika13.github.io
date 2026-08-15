(function initCharacterLODController(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  const DEFAULTS = Object.freeze({ hero: 8, lod1: 25, lod2: 60, lod3: 100 });
  class CharacterLODController {
    constructor(profile = {}) { this.distances = { ...DEFAULTS, ...(profile.distances || {}) }; this.hysteresis = A.clamp(profile.hysteresis || 1.5, 0.1, 10); this.current = "hero"; this.lastUpdateAt = 0; }
    select(distance, current = this.current) { const d = Math.max(0, Number(distance || 0)); const h = this.hysteresis; let next = d <= this.distances.hero ? "hero" : d <= this.distances.lod1 ? "lod1" : d <= this.distances.lod2 ? "lod2" : "lod3"; const levels = ["hero", "lod1", "lod2", "lod3"]; const oldIndex = levels.indexOf(current), nextIndex = levels.indexOf(next); if (oldIndex >= 0 && nextIndex !== oldIndex) { const boundary = nextIndex > oldIndex ? this.distances[levels[oldIndex]] + h : this.distances[levels[nextIndex]] - h; if (nextIndex > oldIndex && d < boundary) next = current; if (nextIndex < oldIndex && d > boundary) next = current; } this.current = next; return next; }
    animationHz(distance, role = "npc") { if (role === "player") return 60; if (distance <= 8) return 60; if (distance <= 25) return 30; if (distance <= 60) return 15; return 8; }
    capabilities(tier, distance) { const lod = this.select(distance); return { lod, facial: ["cinematic", "high"].includes(tier) && lod === "hero", fullIk: lod === "hero" && tier !== "save-data", secondary: ["cinematic", "high", "balanced"].includes(tier) && ["hero", "lod1"].includes(lod), shadow: tier === "cinematic" ? "high" : tier === "high" ? "medium" : tier === "balanced" ? "low" : "capsule", impostor: lod === "lod3" }; }
  }
  A.CharacterLODController = CharacterLODController;
  if (typeof module !== "undefined" && module.exports) module.exports = CharacterLODController;
})(typeof window !== "undefined" ? window : globalThis);
