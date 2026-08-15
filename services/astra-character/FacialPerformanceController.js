(function initFacialPerformanceController(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  const CHANNELS = Object.freeze(["blinkLeft", "blinkRight", "eyeWideLeft", "eyeWideRight", "browUp", "browDownLeft", "browDownRight", "smileLeft", "smileRight", "frownLeft", "frownRight", "jawOpen", "mouthClose", "mouthSmile", "mouthFrown", "mouthPucker", "mouthFunnel", "cheekRaise", "noseSneer", "viseme_A", "viseme_E", "viseme_I", "viseme_O", "viseme_U", "viseme_MBP", "viseme_FV", "viseme_L", "viseme_WQ", "viseme_rest"]);
  const EXPRESSIONS = Object.freeze({
    neutral: {}, happy: { smileLeft: 0.62, smileRight: 0.62, cheekRaise: 0.3 }, sad: { frownLeft: 0.48, frownRight: 0.48, browUp: 0.18 },
    angry: { browDownLeft: 0.66, browDownRight: 0.66, noseSneer: 0.24 }, afraid: { browUp: 0.62, eyeWideLeft: 0.45, eyeWideRight: 0.45 },
    surprised: { browUp: 0.75, eyeWideLeft: 0.68, eyeWideRight: 0.68, jawOpen: 0.48 }, focused: { browDownLeft: 0.24, browDownRight: 0.24 },
    exhausted: { browUp: 0.12, jawOpen: 0.08 }, injured: { frownLeft: 0.36, frownRight: 0.36, browDownLeft: 0.3 },
    confident: { smileLeft: 0.24, smileRight: 0.24, browUp: 0.12 }, embarrassed: { smileLeft: 0.2, smileRight: 0.2, cheekRaise: 0.48 },
    "battle-shout": { browDownLeft: 0.52, browDownRight: 0.52, jawOpen: 0.72 }
  });
  class FacialPerformanceController {
    constructor(dictionary = {}) { this.mapping = this.buildMapping(dictionary); this.weights = Object.fromEntries(CHANNELS.map((key) => [key, 0])); this.expression = "neutral"; this.blinkAt = A.now() + 1800; this.saccadeAt = A.now() + 400; this.saccade = { x: 0, y: 0 }; this.available = Object.keys(this.mapping).length; }
    buildMapping(dictionary) {
      const normalized = new Map(Object.entries(dictionary || {}).map(([name, index]) => [String(name).toLowerCase().replace(/[^a-z0-9]/g, ""), index]));
      const aliases = { blinkLeft: ["blinkleft", "eyeblinkleft", "blink_l"], blinkRight: ["blinkright", "eyeblinkright", "blink_r"], jawOpen: ["jawopen", "mouthopen"], mouthSmile: ["mouthsmile", "smile"], viseme_A: ["visemea", "moutha"], viseme_O: ["visemeo", "moutho"] };
      return Object.fromEntries(CHANNELS.flatMap((channel) => {
        const candidates = [channel.toLowerCase().replace(/[^a-z0-9]/g, ""), ...(aliases[channel] || []).map((value) => value.replace(/[^a-z0-9]/g, ""))];
        const candidate = candidates.find((name) => normalized.has(name));
        return candidate ? [[channel, normalized.get(candidate)]] : [];
      }));
    }
    setExpression(expression) { this.expression = EXPRESSIONS[expression] ? expression : "neutral"; return this.expression; }
    update(dt, timestamp = A.now(), visemes = {}) {
      const target = { ...Object.fromEntries(CHANNELS.map((key) => [key, 0])), ...EXPRESSIONS[this.expression], ...visemes };
      if (timestamp >= this.blinkAt) { target.blinkLeft = 1; target.blinkRight = 1; this.blinkAt = timestamp + 2100 + Math.random() * 3600; }
      if (timestamp >= this.saccadeAt) { this.saccade = { x: (Math.random() - 0.5) * 0.08, y: (Math.random() - 0.5) * 0.05 }; this.saccadeAt = timestamp + 380 + Math.random() * 1250; }
      CHANNELS.forEach((channel) => { if (this.mapping[channel] !== undefined) this.weights[channel] = A.damp(this.weights[channel], A.clamp(target[channel] || 0, 0, 1), channel.startsWith("viseme") ? 28 : 16, dt); });
      return { expression: this.expression, weights: { ...this.weights }, mapping: { ...this.mapping }, saccade: { ...this.saccade }, availableChannels: this.available };
    }
    applyTo(influences) { if (!influences) return 0; let applied = 0; Object.entries(this.mapping).forEach(([channel, index]) => { if (Number.isInteger(index) && index < influences.length) { influences[index] = this.weights[channel] || 0; applied += 1; } }); return applied; }
    reset() { CHANNELS.forEach((channel) => { this.weights[channel] = 0; }); this.expression = "neutral"; }
  }
  FacialPerformanceController.CHANNELS = CHANNELS;
  FacialPerformanceController.EXPRESSIONS = EXPRESSIONS;
  A.FacialPerformanceController = FacialPerformanceController;
  if (typeof module !== "undefined" && module.exports) module.exports = FacialPerformanceController;
})(typeof window !== "undefined" ? window : globalThis);
