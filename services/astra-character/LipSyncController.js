(function initLipSyncController(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  class LipSyncController {
    constructor() { this.cues = []; this.playing = false; this.startedAt = 0; this.delayMs = 0; this.mode = "none"; this.lastViseme = { viseme_rest: 1 }; }
    play(input = {}) {
      this.delayMs = A.clamp(input.delayMs || 0, -500, 500);
      const requestedStart = Number(input.startedAt);
      this.startedAt = Number.isFinite(requestedStart) ? requestedStart : A.now();
      this.cues = (input.cues || []).map((cue) => ({ start: Math.max(0, Number(cue.start || 0)), end: Math.max(Number(cue.start || 0), Number(cue.end || cue.start || 0) + 0.01), viseme: String(cue.viseme || "rest") })).sort((left, right) => left.start - right.start);
      this.mode = this.cues.length ? "timestamped-viseme" : input.amplitude ? "amplitude-fallback" : "none";
      this.amplitude = typeof input.amplitude === "function" ? input.amplitude : null;
      this.playing = this.mode !== "none";
      return { playing: this.playing, mode: this.mode };
    }
    update(timestamp = A.now()) {
      if (!this.playing) return { viseme_rest: 1 };
      const elapsed = (timestamp - this.startedAt - this.delayMs) / 1000;
      const cue = this.cues.find((item) => elapsed >= item.start && elapsed <= item.end);
      if (cue) this.lastViseme = { [`viseme_${cue.viseme}`]: 1 };
      else if (this.mode === "amplitude-fallback") { const level = A.clamp(this.amplitude?.() || 0, 0, 1); this.lastViseme = { jawOpen: level * 0.72, mouthFunnel: level * 0.2 }; }
      else this.lastViseme = { viseme_rest: 1 };
      if (this.cues.length && elapsed > this.cues[this.cues.length - 1].end + 0.08) this.stop();
      return { ...this.lastViseme };
    }
    stop() { this.playing = false; this.lastViseme = { viseme_rest: 1 }; return this.lastViseme; }
  }
  A.LipSyncController = LipSyncController;
  if (typeof module !== "undefined" && module.exports) module.exports = LipSyncController;
})(typeof window !== "undefined" ? window : globalThis);
