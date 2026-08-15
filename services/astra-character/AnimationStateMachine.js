(function initAnimationStateMachine(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  class AnimationStateMachine {
    constructor(options = {}) {
      this.states = new Map();
      this.transitions = [];
      this.current = "";
      this.previous = "";
      this.stateTime = 0;
      this.buffer = [];
      this.bufferMs = A.clamp(options.bufferMs || 220, 40, 1000);
      this.events = new A.EventBus();
      this.paused = false;
    }
    addState(id, definition = {}) {
      const stateId = A.safeId(id, "state.id");
      this.states.set(stateId, { id: stateId, interruptible: definition.interruptible !== false, ...definition });
      if (!this.current) this.current = stateId;
      return this;
    }
    addTransition(from, to, guard = () => true, options = {}) {
      if (!this.states.has(from) || !this.states.has(to)) throw new Error(`Transition ${from} → ${to} tham chiếu state chưa đăng ký.`);
      this.transitions.push({ from, to, guard, priority: Number(options.priority || 0), minTime: Math.max(0, Number(options.minTime || 0)) });
      this.transitions.sort((left, right) => right.priority - left.priority);
      return this;
    }
    request(event, payload = {}, timestamp = A.now()) {
      this.buffer.push({ event: String(event), payload, timestamp });
      this.buffer = this.buffer.filter((item) => timestamp - item.timestamp <= this.bufferMs).slice(-8);
      return this.buffer.length;
    }
    transition(to, reason = "direct") {
      if (!this.states.has(to) || to === this.current) return false;
      const from = this.current;
      this.previous = from;
      this.current = to;
      this.stateTime = 0;
      this.events.emit("transition", { from, to, reason });
      return true;
    }
    update(dt, context = {}, timestamp = A.now()) {
      if (this.paused) return this.snapshot();
      this.stateTime += Math.max(0, Number(dt || 0));
      this.buffer = this.buffer.filter((item) => timestamp - item.timestamp <= this.bufferMs);
      const candidates = this.transitions.filter((entry) => entry.from === this.current && this.stateTime >= entry.minTime);
      for (const entry of candidates) {
        const match = this.buffer.find((request) => entry.guard(context, request, this));
        if (!match && !entry.guard(context, null, this)) continue;
        if (match) this.buffer.splice(this.buffer.indexOf(match), 1);
        this.transition(entry.to, match?.event || "guard");
        break;
      }
      return this.snapshot();
    }
    snapshot() { return { current: this.current, previous: this.previous, stateTime: this.stateTime, bufferedInputs: this.buffer.map(({ event }) => event) }; }
    dispose() { this.events.clear(); this.states.clear(); this.transitions.length = 0; this.buffer.length = 0; }
  }
  A.AnimationStateMachine = AnimationStateMachine;
  if (typeof module !== "undefined" && module.exports) module.exports = AnimationStateMachine;
})(typeof window !== "undefined" ? window : globalThis);
