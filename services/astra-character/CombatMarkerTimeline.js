(function initCombatMarkerTimeline(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  const ALLOWED = new Set(["equip_attach", "equip_release", "windup_start", "active_start", "active_end", "combo_open", "combo_close", "cancel_open", "cancel_close", "footstep_left", "footstep_right", "trail_start", "trail_end", "muzzle_flash", "projectile_spawn", "shell_eject", "recoil_peak", "hit_stop", "camera_impulse", "vfx_spawn", "sfx_play", "recovery_end"]);
  class CombatMarkerTimeline {
    constructor(markers = [], duration = 1) { this.events = new A.EventBus(); this.load(markers, duration); }
    load(markers = [], duration = 1) {
      this.duration = Math.max(0.001, Number(duration || 1));
      this.markers = markers.map((marker, index) => ({ name: String(marker.name || ""), time: A.clamp(marker.time, 0, this.duration), detail: A.clone(marker.detail || {}), index })).filter((marker) => ALLOWED.has(marker.name)).sort((left, right) => left.time - right.time || left.index - right.index);
      this.reset();
      return this.markers.length;
    }
    reset(time = 0) { this.time = A.clamp(time, 0, this.duration); this.cursor = this.markers.findIndex((marker) => marker.time >= this.time); if (this.cursor < 0) this.cursor = this.markers.length; this.windows = { active: false, combo: false, cancel: false, trail: false }; this.lastMarker = ""; }
    apply(marker) {
      this.lastMarker = marker.name;
      if (marker.name === "active_start") this.windows.active = true;
      if (marker.name === "active_end") this.windows.active = false;
      if (marker.name === "combo_open") this.windows.combo = true;
      if (marker.name === "combo_close") this.windows.combo = false;
      if (marker.name === "cancel_open") this.windows.cancel = true;
      if (marker.name === "cancel_close") this.windows.cancel = false;
      if (marker.name === "trail_start") this.windows.trail = true;
      if (marker.name === "trail_end") this.windows.trail = false;
      this.events.emit("marker", marker);
    }
    advance(nextTime) {
      const clamped = A.clamp(nextTime, 0, this.duration);
      if (clamped < this.time) this.reset(clamped);
      const fired = [];
      while (this.cursor < this.markers.length && this.markers[this.cursor].time <= clamped) {
        const marker = this.markers[this.cursor++];
        if (marker.time >= this.time) { this.apply(marker); fired.push(marker); }
      }
      this.time = clamped;
      return fired;
    }
    update(dt, timeScale = 1) { return this.advance(this.time + Math.max(0, dt) * Math.max(0, timeScale)); }
    snapshot() { return { time: this.time, duration: this.duration, lastMarker: this.lastMarker, windows: { ...this.windows }, complete: this.time >= this.duration }; }
    dispose() { this.events.clear(); this.markers.length = 0; }
  }
  CombatMarkerTimeline.ALLOWED = ALLOWED;
  A.CombatMarkerTimeline = CombatMarkerTimeline;
  if (typeof module !== "undefined" && module.exports) module.exports = CombatMarkerTimeline;
})(typeof window !== "undefined" ? window : globalThis);
