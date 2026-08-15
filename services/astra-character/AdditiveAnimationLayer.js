(function initAdditiveAnimationLayer(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  class AdditiveAnimationLayer {
    constructor() { this.layers = new Map(); }
    set(id, targetWeight, options = {}) {
      const key = A.safeId(id, "layer.id");
      const layer = this.layers.get(key) || { id: key, weight: 0, targetWeight: 0, fadeSpeed: 12, mask: [], action: null };
      layer.targetWeight = A.clamp(targetWeight, 0, 1);
      layer.fadeSpeed = A.clamp(options.fadeSpeed ?? layer.fadeSpeed, 0.1, 60);
      layer.mask = Array.isArray(options.mask) ? [...new Set(options.mask.map(String))] : layer.mask;
      layer.action = options.action || layer.action;
      this.layers.set(key, layer);
      return layer;
    }
    update(dt) {
      this.layers.forEach((layer) => {
        layer.weight = A.damp(layer.weight, layer.targetWeight, layer.fadeSpeed, dt);
        layer.action?.setEffectiveWeight?.(layer.weight);
        layer.action && (layer.action.enabled = layer.weight > 0.001);
      });
      return this.getWeights();
    }
    getWeights() { return Object.fromEntries([...this.layers].map(([id, layer]) => [id, Number(layer.weight.toFixed(4))])); }
    dispose() { this.layers.forEach((layer) => layer.action?.stop?.()); this.layers.clear(); }
  }
  A.AdditiveAnimationLayer = AdditiveAnimationLayer;
  if (typeof module !== "undefined" && module.exports) module.exports = AdditiveAnimationLayer;
})(typeof window !== "undefined" ? window : globalThis);
