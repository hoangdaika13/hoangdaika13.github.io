(function initCinematicCharacterDirector(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  const SHOTS = new Set(["close-up", "medium", "over-shoulder", "two-shot", "hero", "low-angle", "high-angle", "combat", "ultimate", "dialogue"]);
  class CinematicCharacterDirector {
    constructor(options = {}) { this.mode = options.mode || "balanced"; this.timeline = []; this.cursor = 0; this.elapsed = 0; this.playing = false; this.events = new A.EventBus(); this.comfort = { shake: 0.5, flashReduction: false, reducedMotion: false, motionBlur: false }; }
    load(events = []) { this.timeline = events.map((event) => ({ ...event, at: Math.max(0, Number(event.at || 0)), type: String(event.type || "event") })).sort((left, right) => left.at - right.at); this.cursor = 0; this.elapsed = 0; return this.timeline.length; }
    setComfort(settings = {}) { Object.assign(this.comfort, settings); if (this.comfort.reducedMotion) { this.comfort.shake = 0; this.comfort.motionBlur = false; } return { ...this.comfort }; }
    play() { this.playing = true; } pause() { this.playing = false; } skip() { this.cursor = this.timeline.length; this.playing = false; this.events.emit("skip", {}); }
    update(dt) { if (!this.playing) return []; this.elapsed += Math.max(0, dt); const fired = []; while (this.cursor < this.timeline.length && this.timeline[this.cursor].at <= this.elapsed) { const event = this.timeline[this.cursor++]; if (event.type === "camera" && !SHOTS.has(event.shot)) event.status = "Chưa kết nối"; if (this.comfort.flashReduction && event.type === "flash") event.suppressed = true; this.events.emit(event.type, event); fired.push(event); } if (this.cursor >= this.timeline.length) this.playing = false; return fired; }
    dispose() { this.timeline.length = 0; this.events.clear(); }
  }
  A.CinematicCharacterDirector = CinematicCharacterDirector;
  if (typeof module !== "undefined" && module.exports) module.exports = CinematicCharacterDirector;
})(typeof window !== "undefined" ? window : globalThis);
