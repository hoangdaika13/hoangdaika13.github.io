(function initCharacterPerformanceGovernor(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  const TIERS = new Set(["cinematic", "high", "balanced", "low", "save-data"]);
  class CharacterPerformanceGovernor {
    constructor(tier = "balanced") { this.tier = TIERS.has(tier) ? tier : "balanced"; this.samples = []; this.auto = true; this.lastTransitionAt = 0; }
    setTier(tier, manual = true) { if (!TIERS.has(tier)) throw new TypeError(`Quality tier ${tier} không hợp lệ.`); this.tier = tier; if (manual) this.auto = false; return this.profile(); }
    sample(fps, timestamp = A.now()) { this.samples.push(A.clamp(fps, 0, 240)); this.samples = this.samples.slice(-12); if (!this.auto || this.samples.length < 6 || timestamp - this.lastTransitionAt < 5000) return this.profile(); const average = this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length; const order = ["save-data", "low", "balanced", "high", "cinematic"]; let index = order.indexOf(this.tier); if (average < 34 && index > 0) index -= 1; else if (average > 57 && index < 3) index += 1; const next = order[index]; if (next !== this.tier) { this.tier = next; this.lastTransitionAt = timestamp; } return this.profile(); }
    profile() { return ({ cinematic: { ikIterations: 10, morphHz: 60, secondaryHz: 60, maxHeroDistance: 12 }, high: { ikIterations: 8, morphHz: 45, secondaryHz: 45, maxHeroDistance: 9 }, balanced: { ikIterations: 5, morphHz: 30, secondaryHz: 30, maxHeroDistance: 8 }, low: { ikIterations: 2, morphHz: 12, secondaryHz: 15, maxHeroDistance: 5 }, "save-data": { ikIterations: 1, morphHz: 5, secondaryHz: 0, maxHeroDistance: 3 } })[this.tier]; }
  }
  CharacterPerformanceGovernor.TIERS = TIERS;
  A.CharacterPerformanceGovernor = CharacterPerformanceGovernor;
  if (typeof module !== "undefined" && module.exports) module.exports = CharacterPerformanceGovernor;
})(typeof window !== "undefined" ? window : globalThis);
