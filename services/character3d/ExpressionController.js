(function initHHCharacter3DExpressionController(global) {
  "use strict";

  const STANDARD_EXPRESSIONS = Object.freeze(["neutral", "happy", "angry", "sad", "relaxed", "surprised"]);
  const LOOK_EXPRESSIONS = Object.freeze(["lookUp", "lookDown", "lookLeft", "lookRight"]);
  const BLINK_EXPRESSIONS = Object.freeze(["blink", "blinkLeft", "blinkRight"]);
  const VISEMES = Object.freeze(["aa", "ih", "ou", "ee", "oh"]);
  const ALL_CHANNELS = Object.freeze([...STANDARD_EXPRESSIONS, ...LOOK_EXPRESSIONS, ...BLINK_EXPRESSIONS, ...VISEMES]);
  const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));
  const normalizeKey = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ALIASES = Object.freeze({
    neutral: ["neutral", "default"], happy: ["happy", "joy", "smile"], angry: ["angry", "anger"], sad: ["sad", "sorrow"],
    relaxed: ["relaxed", "relax"], surprised: ["surprised", "surprise"], blink: ["blink"], blinkLeft: ["blinkleft", "blinkl"], blinkRight: ["blinkright", "blinkr"],
    lookUp: ["lookup"], lookDown: ["lookdown"], lookLeft: ["lookleft"], lookRight: ["lookright"],
    aa: ["aa", "a", "visemeaa"], ih: ["ih", "i", "visemeih"], ou: ["ou", "u", "visemeou"], ee: ["ee", "e", "visemeee"], oh: ["oh", "o", "visemeoh"]
  });

  class ExpressionController {
    constructor(options = {}) {
      this.root = null;
      this.vrmExpressionManager = options.expressionManager || null;
      this.bindings = new Map();
      this.current = new Map(ALL_CHANNELS.map((key) => [key, 0]));
      this.targets = new Map(this.current);
      this.duration = Math.max(0.05, Number(options.transitionDuration) || 0.22);
      this.blinkEnabled = options.blinkEnabled !== false;
      this.nextBlink = 0;
      this.blinkPhase = -1;
      this.lookTarget = { x: 0, y: 0 };
      this.random = typeof options.random === "function" ? options.random : Math.random;
      this.disposed = false;
    }

    bind(root, options = {}) {
      this.root = root || null;
      this.vrmExpressionManager = options.expressionManager || root?.userData?.vrm?.expressionManager || this.vrmExpressionManager;
      this.bindings.clear();
      const candidates = new Map();
      root?.traverse?.((object) => {
        const dictionary = object.morphTargetDictionary;
        if (!dictionary || !Array.isArray(object.morphTargetInfluences)) return;
        Object.entries(dictionary).forEach(([name, index]) => {
          const key = normalizeKey(name);
          if (!candidates.has(key)) candidates.set(key, []);
          candidates.get(key).push({ object, index, sourceName: name });
        });
      });
      ALL_CHANNELS.forEach((channel) => {
        const aliases = (ALIASES[channel] || [channel]).map(normalizeKey);
        const found = aliases.flatMap((key) => candidates.get(key) || []);
        if (found.length) this.bindings.set(channel, found);
        else if (this.vrmExpressionManager?.setValue) this.bindings.set(channel, [{ vrm: true, sourceName: channel }]);
      });
      this.scheduleBlink(performance.now?.() || Date.now());
      this.disposed = false;
      return this.describe();
    }

    supported(name) { return this.bindings.has(name); }

    set(name, value, options = {}) {
      if (!ALL_CHANNELS.includes(name) && !this.bindings.has(name)) return false;
      const target = clamp01(value);
      this.targets.set(name, target);
      if (options.immediate) {
        this.current.set(name, target);
        this.apply(name, target);
      }
      return this.supported(name);
    }

    apply(name, value) {
      const bindings = this.bindings.get(name) || [];
      bindings.forEach((binding) => {
        if (binding.vrm) this.vrmExpressionManager?.setValue?.(binding.sourceName, value);
        else if (binding.object?.morphTargetInfluences) binding.object.morphTargetInfluences[binding.index] = value;
      });
    }

    preset(name, intensity = 1, options = {}) {
      if (!STANDARD_EXPRESSIONS.includes(name)) return false;
      STANDARD_EXPRESSIONS.forEach((key) => this.set(key, key === name && key !== "neutral" ? intensity : 0, options));
      if (name === "neutral") STANDARD_EXPRESSIONS.forEach((key) => this.set(key, 0, options));
      return this.supported(name) || name === "neutral";
    }

    setViseme(name, value, options = {}) {
      if (!VISEMES.includes(name)) return false;
      VISEMES.forEach((key) => this.set(key, key === name ? value : 0, options));
      return this.supported(name);
    }

    clearVisemes(options = {}) { VISEMES.forEach((name) => this.set(name, 0, options)); }

    setLook(x, y, options = {}) {
      this.lookTarget.x = Math.min(1, Math.max(-1, Number(x) || 0));
      this.lookTarget.y = Math.min(1, Math.max(-1, Number(y) || 0));
      this.set("lookLeft", Math.max(0, -this.lookTarget.x), options);
      this.set("lookRight", Math.max(0, this.lookTarget.x), options);
      this.set("lookUp", Math.max(0, this.lookTarget.y), options);
      this.set("lookDown", Math.max(0, -this.lookTarget.y), options);
    }

    scheduleBlink(now) { this.nextBlink = now + 2600 + this.random() * 4200; }

    updateBlink(now) {
      if (!this.blinkEnabled || !this.supported("blink")) return;
      if (this.blinkPhase < 0 && now >= this.nextBlink) this.blinkPhase = 0;
      if (this.blinkPhase < 0) return;
      this.blinkPhase += 1;
      const value = this.blinkPhase <= 3 ? this.blinkPhase / 3 : Math.max(0, 1 - (this.blinkPhase - 3) / 4);
      this.set("blink", value, { immediate: true });
      if (this.blinkPhase >= 7) { this.blinkPhase = -1; this.set("blink", 0, { immediate: true }); this.scheduleBlink(now); }
    }

    update(deltaSeconds, now = performance.now?.() || Date.now()) {
      if (this.disposed) return;
      const alpha = Math.min(1, Math.max(0, Number(deltaSeconds) || 0) / this.duration);
      this.targets.forEach((target, name) => {
        const current = this.current.get(name) || 0;
        const next = current + (target - current) * alpha;
        if (Math.abs(next - current) > 0.0001) { this.current.set(name, next); this.apply(name, next); }
      });
      this.updateBlink(now);
      this.vrmExpressionManager?.update?.();
    }

    reset(options = {}) {
      ALL_CHANNELS.forEach((name) => this.set(name, 0, options));
      this.lookTarget = { x: 0, y: 0 };
    }

    describe() {
      return Object.freeze({
        supported: ALL_CHANNELS.filter((name) => this.bindings.has(name)),
        unsupported: ALL_CHANNELS.filter((name) => !this.bindings.has(name)),
        hasVRMExpressionManager: Boolean(this.vrmExpressionManager),
        morphBindingCount: Array.from(this.bindings.values()).reduce((sum, list) => sum + list.length, 0)
      });
    }

    dispose() {
      this.reset({ immediate: true });
      this.bindings.clear();
      this.root = null;
      this.vrmExpressionManager = null;
      this.disposed = true;
    }
  }

  global.HHCharacter3DExpressionController = Object.freeze({ ExpressionController, STANDARD_EXPRESSIONS, LOOK_EXPRESSIONS, BLINK_EXPRESSIONS, VISEMES, ALL_CHANNELS });
  global.HHCharacter3D = global.HHCharacter3D || {};
  global.HHCharacter3D.ExpressionController = ExpressionController;
})(typeof window !== "undefined" ? window : globalThis);
