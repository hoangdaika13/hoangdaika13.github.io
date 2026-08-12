(function initHHCharacter3DAnimationController(global) {
  "use strict";

  const STATES = Object.freeze([
    "loading", "appear", "idle", "greeting", "listening", "thinking", "speaking",
    "walk", "run", "pose", "dance", "warning", "celebrating", "sleeping"
  ]);
  const ANY_STATES = new Set(["warning", "celebrating", "sleeping"]);
  const DEFAULT_TRANSITIONS = Object.freeze({
    loading: ["appear", "idle"],
    appear: ["idle"],
    idle: ["greeting", "listening", "thinking", "speaking", "walk", "run", "pose", "dance", "warning", "celebrating", "sleeping"],
    greeting: ["idle"], listening: ["idle", "thinking", "speaking"], thinking: ["idle", "speaking"],
    speaking: ["idle", "listening"], walk: ["idle", "run"], run: ["idle", "walk"], pose: ["idle"], dance: ["idle"]
  });
  const NAME_ALIASES = Object.freeze({
    appear: ["appear", "spawn", "intro", "entry"], idle: ["idle", "breath", "stand"], greeting: ["greet", "wave", "hello"],
    listening: ["listen"], thinking: ["think"], speaking: ["speak", "talk"], walk: ["walk"], run: ["run", "jog"],
    pose: ["pose"], dance: ["dance"], warning: ["warning", "alert"], celebrating: ["celebrate", "victory", "cheer"], sleeping: ["sleep"]
  });
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const cleanName = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");

  class AnimationController {
    constructor(options = {}) {
      this.THREE = options.THREE || null;
      this.root = null;
      this.mixer = null;
      this.clips = [];
      this.actions = new Map();
      this.stateActions = new Map();
      this.state = "loading";
      this.previousState = "loading";
      this.speed = 1;
      this.paused = false;
      this.loop = true;
      this.crossfadeDuration = clamp(options.crossfadeDuration ?? 0.32, 0.2, 0.4);
      this.activeAction = null;
      this.stateListeners = new Set();
      this.reducedMotion = Boolean(options.reducedMotion);
      this.disposed = false;
    }

    async ensureThree() {
      if (!this.THREE) this.THREE = await import("../../vendor/three.module.min.js");
      return this.THREE;
    }

    async bind(root, clips = [], mapping = {}) {
      if (!root) throw new Error("AnimationController requires a model root.");
      this.disposeMixer();
      const THREE = await this.ensureThree();
      this.root = root;
      this.clips = Array.isArray(clips) ? clips.filter(Boolean) : [];
      this.mixer = new THREE.AnimationMixer(root);
      this.clips.forEach((clip) => this.actions.set(clip.name || `clip-${this.actions.size}`, this.mixer.clipAction(clip)));
      STATES.forEach((state) => {
        const explicit = mapping[state];
        const clip = typeof explicit === "string" ? this.clips.find((candidate) => candidate.name === explicit) : explicit;
        const inferred = clip || this.findClipForState(state);
        if (inferred) this.stateActions.set(state, this.mixer.clipAction(inferred));
      });
      this.disposed = false;
      this.setState(this.state === "loading" ? "idle" : this.state, { force: true, immediate: true });
      return this.describe();
    }

    findClipForState(state) {
      const aliases = NAME_ALIASES[state] || [state];
      return this.clips.find((clip) => aliases.some((alias) => cleanName(clip.name).includes(alias)));
    }

    canTransition(from, to) {
      if (!STATES.includes(to)) return false;
      if (from === to || ANY_STATES.has(to)) return true;
      if (ANY_STATES.has(from)) return to === "idle";
      return (DEFAULT_TRANSITIONS[from] || ["idle"]).includes(to);
    }

    setState(next, options = {}) {
      if (!STATES.includes(next)) return false;
      if (!options.force && !this.canTransition(this.state, next)) return false;
      const previous = this.state;
      const previousAction = this.activeAction;
      const requestedAction = this.stateActions.get(next) || null;
      const action = requestedAction || (next !== "idle" ? this.stateActions.get("idle") : null);
      this.previousState = previous;
      this.state = next;
      if (action && action !== previousAction) {
        const THREE = this.THREE;
        action.enabled = true;
        action.paused = false;
        action.setEffectiveTimeScale(this.speed);
        action.setEffectiveWeight(1);
        action.clampWhenFinished = next !== "idle" && next !== "walk" && next !== "run" && next !== "dance";
        action.setLoop(action.clampWhenFinished && THREE ? THREE.LoopOnce : THREE?.LoopRepeat, action.clampWhenFinished ? 1 : Infinity);
        if (options.restart !== false) action.reset();
        action.play();
        const duration = options.immediate || this.reducedMotion ? 0 : clamp(options.duration ?? this.crossfadeDuration, 0.2, 0.4);
        if (previousAction && previousAction !== action) {
          if (duration > 0) action.crossFadeFrom(previousAction, duration, true);
          else { previousAction.stop(); action.setEffectiveWeight(1); }
        }
        this.activeAction = action;
      } else if (!action && next === "idle" && this.activeAction) {
        this.activeAction.fadeOut?.(this.reducedMotion ? 0 : this.crossfadeDuration);
        if (this.reducedMotion) this.activeAction.stop?.();
        this.activeAction = null;
      }
      this.stateListeners.forEach((listener) => {
        try { listener({ state: next, previous, clip: action?.getClip?.()?.name || null }); } catch (_) { /* isolate listeners */ }
      });
      // State still updates for voice/UI orchestration, but a missing clip must not be reported as playable.
      return Boolean(requestedAction);
    }

    playClip(nameOrClip, options = {}) {
      const clip = typeof nameOrClip === "string" ? this.clips.find((item) => item.name === nameOrClip) : nameOrClip;
      if (!clip || !this.mixer) return false;
      const action = this.mixer.clipAction(clip);
      action.enabled = true;
      action.paused = false;
      action.setEffectiveWeight(1);
      action.setEffectiveTimeScale(this.speed);
      action.clampWhenFinished = options.loop === false;
      action.setLoop(options.loop === false ? this.THREE.LoopOnce : this.THREE.LoopRepeat, options.loop === false ? 1 : Infinity);
      action.reset().play();
      const duration = this.reducedMotion ? 0 : clamp(options.duration ?? this.crossfadeDuration, 0.2, 0.4);
      if (this.activeAction && this.activeAction !== action) {
        if (duration > 0) action.crossFadeFrom(this.activeAction, duration, true);
        else this.activeAction.stop();
      }
      this.activeAction = action;
      return true;
    }

    update(deltaSeconds) {
      if (!this.mixer || this.paused || this.disposed) return;
      const delta = Math.min(0.1, Math.max(0, Number(deltaSeconds) || 0));
      this.mixer.update(delta);
    }

    setSpeed(value) {
      this.speed = clamp(value, 0.1, 3);
      this.mixer && (this.mixer.timeScale = this.speed);
      return this.speed;
    }

    setPaused(paused) {
      this.paused = Boolean(paused);
      if (this.mixer) this.mixer.timeScale = this.paused ? 0 : this.speed;
      return this.paused;
    }

    setLoop(enabled) {
      this.loop = Boolean(enabled);
      const action = this.activeAction;
      if (action && this.THREE) {
        action.clampWhenFinished = !this.loop;
        action.setLoop(this.loop ? this.THREE.LoopRepeat : this.THREE.LoopOnce, this.loop ? Infinity : 1);
      }
      return this.loop;
    }

    scrub(seconds) {
      if (!this.mixer) return 0;
      const duration = this.activeAction?.getClip?.()?.duration || 0;
      const time = clamp(seconds, 0, duration || Number.MAX_SAFE_INTEGER);
      this.mixer.setTime(time);
      return time;
    }

    resetPose() {
      if (!this.mixer) return false;
      this.mixer.stopAllAction();
      this.root?.traverse?.((object) => {
        if (object.isSkinnedMesh) object.pose?.();
        if (Array.isArray(object.morphTargetInfluences)) object.morphTargetInfluences.fill(0);
      });
      this.activeAction = null;
      return this.setState("idle", { force: true, immediate: true, restart: true });
    }

    onStateChange(listener) {
      if (typeof listener !== "function") throw new TypeError("State listener must be a function.");
      this.stateListeners.add(listener);
      return () => this.stateListeners.delete(listener);
    }

    describe() {
      return Object.freeze({
        state: this.state,
        clipCount: this.clips.length,
        clips: this.clips.map((clip) => ({ name: clip.name || "Untitled", duration: clip.duration || 0 })),
        supportedStates: STATES.filter((state) => this.stateActions.has(state)),
        crossfadeDuration: this.crossfadeDuration,
        speed: this.speed
      });
    }

    disposeMixer() {
      if (this.mixer) {
        this.mixer.stopAllAction();
        this.mixer.uncacheRoot?.(this.root);
      }
      this.actions.clear();
      this.stateActions.clear();
      this.activeAction = null;
      this.clips = [];
      this.mixer = null;
      this.root = null;
    }

    dispose() {
      this.disposeMixer();
      this.stateListeners.clear();
      this.disposed = true;
    }
  }

  global.HHCharacter3DAnimationController = Object.freeze({ AnimationController, STATES, DEFAULT_TRANSITIONS });
  global.HHCharacter3D = global.HHCharacter3D || {};
  global.HHCharacter3D.AnimationController = AnimationController;
})(typeof window !== "undefined" ? window : globalThis);
