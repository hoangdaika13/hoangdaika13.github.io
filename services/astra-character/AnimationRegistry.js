(function initAnimationRegistry(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  class AnimationRegistry {
    constructor() { this.sets = new Map(); }
    registerSet(id, clips = []) {
      const setId = A.safeId(id, "animationSet.id");
      const records = new Map();
      clips.forEach((clip) => {
        const record = AnimationRegistry.normalizeClip(clip);
        records.set(record.id, record);
      });
      this.sets.set(setId, records);
      return records.size;
    }
    static normalizeClip(clip = {}) {
      const id = A.safeId(clip.id || clip.clipName || "clip", "animation.id");
      const duration = Math.max(0.001, Number(clip.duration || 1));
      const markers = (clip.markers || []).map((marker) => ({
        name: A.safeId(marker.name, "marker.name"),
        time: A.clamp(marker.time, 0, duration), detail: A.clone(marker.detail || {})
      })).sort((left, right) => left.time - right.time);
      return Object.freeze({
        id, clipName: String(clip.clipName || id), category: String(clip.category || "action"),
        looping: clip.looping === true, rootMotion: clip.rootMotion === true, additive: clip.additive === true,
        duration, locomotionSpeed: Math.max(0, Number(clip.locomotionSpeed || 0)), direction: A.clamp(clip.direction || 0, -180, 180),
        markers, cancelWindows: A.clone(clip.cancelWindows || []), comboWindows: A.clone(clip.comboWindows || []),
        weaponClasses: [...new Set((clip.weaponClasses || []).map(String))], tags: [...new Set((clip.tags || []).map(String))],
        sourceClip: clip.sourceClip || null
      });
    }
    get(setId, clipId) { return this.sets.get(setId)?.get(clipId) || null; }
    find(setId, predicate) { return [...(this.sets.get(setId)?.values() || [])].filter(predicate); }
    clear() { this.sets.clear(); }
  }
  A.AnimationRegistry = AnimationRegistry;
  if (typeof module !== "undefined" && module.exports) module.exports = AnimationRegistry;
})(typeof window !== "undefined" ? window : globalThis);
