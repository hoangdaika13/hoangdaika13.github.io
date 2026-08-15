(function initCombatAnimationController(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  class CombatAnimationController {
    constructor(options = {}) {
      this.state = "ready";
      this.previousState = "";
      this.timeline = null;
      this.sequence = 0;
      this.pending = [];
      this.seenSequences = new Set();
      this.cooldowns = new Map();
      this.events = new A.EventBus();
      this.maxBuffer = A.clamp(options.maxBuffer || 4, 1, 12);
      this.serverConfirmed = new Set();
    }
    request(action = {}, timestamp = A.now()) {
      const type = String(action.type || "light");
      const sequenceId = action.sequenceId ? A.safeId(action.sequenceId, "sequenceId") : `local-${++this.sequence}`;
      if (this.seenSequences.has(sequenceId) || this.pending.some((record) => record.sequenceId === sequenceId)) return { accepted: false, reason: "duplicate-sequence", sequenceId };
      const readyAt = this.cooldowns.get(type) || 0;
      if (timestamp < readyAt) return { accepted: false, reason: "cooldown", retryAt: readyAt, sequenceId };
      const canStart = this.state === "ready" || this.state === "locomotion-combat" || this.timeline?.windows.combo || this.timeline?.windows.cancel;
      const record = { ...action, type, sequenceId, timestamp };
      if (!canStart) {
        if (this.pending.length >= this.maxBuffer) this.pending.shift();
        this.pending.push(record);
        return { accepted: true, buffered: true, sequenceId };
      }
      return this.start(record, timestamp);
    }
    start(record, timestamp = A.now()) {
      this.seenSequences.add(record.sequenceId);
      if (this.seenSequences.size > 512) this.seenSequences.delete(this.seenSequences.values().next().value);
      this.previousState = this.state;
      this.state = "windup";
      const duration = Math.max(0.1, Number(record.duration || 0.8));
      const markers = record.markers || [
        { name: "windup_start", time: 0 }, { name: "active_start", time: duration * 0.28 },
        { name: "active_end", time: duration * 0.48 }, { name: "combo_open", time: duration * 0.52 },
        { name: "combo_close", time: duration * 0.72 }, { name: "recovery_end", time: duration }
      ];
      this.timeline?.dispose?.();
      this.timeline = new A.CombatMarkerTimeline(markers, duration);
      this.timeline.events.on("marker", (marker) => this.handleMarker(marker, record));
      this.active = record;
      this.cooldowns.set(record.type, timestamp + Math.max(duration * 1000, Number(record.cooldownMs || 0)));
      this.events.emit("request", record);
      return { accepted: true, buffered: false, sequenceId: record.sequenceId };
    }
    handleMarker(marker, action) {
      const states = { windup_start: "windup", active_start: "active", active_end: "recovery", combo_open: "combo-window", recovery_end: "ready" };
      if (states[marker.name]) { this.previousState = this.state; this.state = states[marker.name]; }
      this.events.emit("marker", { ...marker, sequenceId: action.sequenceId, state: this.state, serverDamageAllowed: marker.name === "active_start" });
    }
    update(dt, timestamp = A.now()) {
      this.timeline?.update(dt);
      if (this.timeline?.snapshot().complete) { this.state = "ready"; this.active = null; }
      if ((this.state === "ready" || this.timeline?.windows.combo || this.timeline?.windows.cancel) && this.pending.length) this.start(this.pending.shift(), timestamp);
      return this.snapshot();
    }
    reconcile(sequenceId, response = {}) {
      if (!this.seenSequences.has(sequenceId)) return false;
      if (response.accepted) this.serverConfirmed.add(sequenceId);
      else if (this.active?.sequenceId === sequenceId) { this.state = "ready"; this.timeline?.dispose(); this.timeline = null; this.active = null; this.events.emit("rejected", { sequenceId, reason: response.reason || "server-rejected" }); }
      return true;
    }
    snapshot() { return { state: this.state, previousState: this.previousState, sequenceId: this.active?.sequenceId || "", pending: this.pending.length, marker: this.timeline?.snapshot() || null, serverConfirmed: this.active ? this.serverConfirmed.has(this.active.sequenceId) : false }; }
    dispose() { this.timeline?.dispose(); this.timeline = null; this.pending.length = 0; this.seenSequences.clear(); this.cooldowns.clear(); this.events.clear(); }
  }
  A.CombatAnimationController = CombatAnimationController;
  if (typeof module !== "undefined" && module.exports) module.exports = CombatAnimationController;
})(typeof window !== "undefined" ? window : globalThis);
