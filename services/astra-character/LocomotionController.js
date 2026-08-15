(function initLocomotionController(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  const STATES = Object.freeze([
    "idle", "idle-relaxed", "idle-combat", "walk-forward", "walk-backward", "walk-left", "walk-right",
    "jog-forward", "jog-backward", "strafe-left", "strafe-right", "sprint", "crouch-idle", "crouch-walk",
    "jump-start", "jump-loop", "jump-land-soft", "jump-land-hard", "fall", "turn-left-45", "turn-right-45",
    "turn-left-90", "turn-right-90", "turn-180", "start-forward", "start-backward", "stop-forward",
    "stop-backward", "pivot-left", "pivot-right", "exhausted-idle", "injured-idle", "injured-walk"
  ]);
  class LocomotionController {
    constructor(options = {}) {
      this.maxSpeed = A.clamp(options.maxSpeed || 7.2, 0.5, 30);
      this.walkSpeed = A.clamp(options.walkSpeed || 2.4, 0.2, this.maxSpeed);
      this.acceleration = A.clamp(options.acceleration || 15, 1, 80);
      this.deceleration = A.clamp(options.deceleration || 20, 1, 100);
      this.turnRate = A.clamp(options.turnRate || 8.5, 0.5, 30);
      this.velocity = { x: 0, z: 0 };
      this.localVelocity = { x: 0, z: 0 };
      this.input = { x: 0, z: 0, sprint: false, crouch: false, combat: false, grounded: true, injured: false, exhausted: false };
      this.facingYaw = Number(options.facingYaw || 0);
      this.cameraYaw = this.facingYaw;
      this.state = "idle";
      this.previousState = "idle";
      this.stateTime = 0;
      this.accelerationValue = 0;
      this.angularVelocity = 0;
      this.lean = 0;
      this.turnInPlace = 0;
      this.blend = { idle: 1, forward: 0, backward: 0, left: 0, right: 0 };
    }
    setInput(input = {}) {
      const normalized = A.normalize2(input);
      Object.assign(this.input, input, normalized);
      this.input.x = normalized.x;
      this.input.z = normalized.z;
      if (Number.isFinite(input.cameraYaw)) this.cameraYaw = input.cameraYaw;
      return this.input;
    }
    chooseState(speed, local, previousSpeed) {
      const input = this.input;
      if (!input.grounded) return input.verticalVelocity > 0.2 ? "jump-loop" : "fall";
      if (input.justLanded) return Math.abs(input.verticalVelocity || 0) > 7 ? "jump-land-hard" : "jump-land-soft";
      if (speed < 0.06) {
        if (previousSpeed > 1.3) return local.z < -0.05 ? "stop-backward" : "stop-forward";
        if (input.crouch) return "crouch-idle";
        if (input.injured) return "injured-idle";
        if (input.exhausted) return "exhausted-idle";
        const lookDelta = A.angleDelta(this.facingYaw, this.cameraYaw);
        if (Math.abs(lookDelta) > 2.45) return "turn-180";
        if (Math.abs(lookDelta) > 1.05) return lookDelta < 0 ? "turn-left-90" : "turn-right-90";
        if (Math.abs(lookDelta) > 0.55) return lookDelta < 0 ? "turn-left-45" : "turn-right-45";
        return input.combat ? "idle-combat" : "idle-relaxed";
      }
      if (previousSpeed < 0.06) return local.z < -0.15 ? "start-backward" : "start-forward";
      if (input.crouch) return "crouch-walk";
      if (input.injured) return "injured-walk";
      if (input.sprint && local.z > 0.45) return "sprint";
      if (Math.abs(local.x) > Math.abs(local.z) * 1.25) return local.x < 0 ? (input.combat ? "strafe-left" : "walk-left") : (input.combat ? "strafe-right" : "walk-right");
      if (speed > this.walkSpeed * 1.16) return local.z < 0 ? "jog-backward" : "jog-forward";
      return local.z < 0 ? "walk-backward" : "walk-forward";
    }
    update(dt) {
      dt = A.clamp(dt, 0, 0.1);
      const previousSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      const inputLength = Math.hypot(this.input.x, this.input.z);
      const speedLimit = this.input.sprint ? this.maxSpeed : this.input.crouch ? this.walkSpeed * 0.55 : this.input.combat ? this.walkSpeed * 1.55 : this.walkSpeed * 1.9;
      const sin = Math.sin(this.cameraYaw), cos = Math.cos(this.cameraYaw);
      const desired = {
        x: (this.input.x * cos + this.input.z * sin) * speedLimit,
        z: (this.input.z * cos - this.input.x * sin) * speedLimit
      };
      const rate = inputLength > 0.01 ? this.acceleration : this.deceleration;
      this.velocity.x = A.moveTowards(this.velocity.x, desired.x, rate * dt);
      this.velocity.z = A.moveTowards(this.velocity.z, desired.z, rate * dt);
      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      const facingSin = Math.sin(this.facingYaw), facingCos = Math.cos(this.facingYaw);
      this.localVelocity.x = this.velocity.x * facingCos - this.velocity.z * facingSin;
      this.localVelocity.z = this.velocity.z * facingCos + this.velocity.x * facingSin;
      const desiredYaw = speed > 0.12 ? (this.input.combat ? this.cameraYaw : Math.atan2(this.velocity.x, this.velocity.z)) : this.facingYaw;
      const yawDelta = A.angleDelta(this.facingYaw, desiredYaw);
      const oldYaw = this.facingYaw;
      this.facingYaw += A.clamp(yawDelta, -this.turnRate * dt, this.turnRate * dt);
      this.angularVelocity = dt > 0 ? A.angleDelta(oldYaw, this.facingYaw) / dt : 0;
      this.accelerationValue = dt > 0 ? (speed - previousSpeed) / dt : 0;
      this.lean = A.damp(this.lean, A.clamp(this.accelerationValue * 0.018 + this.angularVelocity * 0.045, -0.22, 0.22), 10, dt);
      const nextState = this.chooseState(speed, this.localVelocity, previousSpeed);
      if (nextState !== this.state) { this.previousState = this.state; this.state = nextState; this.stateTime = 0; } else this.stateTime += dt;
      const normalizedX = A.clamp(this.localVelocity.x / Math.max(0.01, speedLimit), -1, 1);
      const normalizedZ = A.clamp(this.localVelocity.z / Math.max(0.01, speedLimit), -1, 1);
      this.blend = {
        idle: A.clamp(1 - Math.hypot(normalizedX, normalizedZ), 0, 1),
        forward: Math.max(0, normalizedZ), backward: Math.max(0, -normalizedZ),
        left: Math.max(0, -normalizedX), right: Math.max(0, normalizedX)
      };
      return this.snapshot();
    }
    snapshot() { return { state: this.state, previousState: this.previousState, stateTime: this.stateTime, velocity: { ...this.velocity }, localVelocity: { ...this.localVelocity }, speed: Math.hypot(this.velocity.x, this.velocity.z), acceleration: this.accelerationValue, angularVelocity: this.angularVelocity, facingYaw: this.facingYaw, lean: this.lean, blend: { ...this.blend } }; }
  }
  LocomotionController.STATES = STATES;
  A.LocomotionController = LocomotionController;
  if (typeof module !== "undefined" && module.exports) module.exports = LocomotionController;
})(typeof window !== "undefined" ? window : globalThis);
