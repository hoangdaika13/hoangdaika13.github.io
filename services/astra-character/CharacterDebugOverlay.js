(function initCharacterDebugOverlay(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  class CharacterDebugOverlay {
    constructor(runtime, options = {}) { this.runtime = runtime; this.developer = options.developer === true; this.host = null; this.visible = false; this.paused = false; this.slowMotion = 1; this.toggles = { ik: true, rootMotion: true, skeleton: false, hitbox: false, footTarget: false, weaponSockets: false }; }
    mount(host) { if (!this.developer || !host?.appendChild || typeof document === "undefined") return false; this.host = host; this.element = document.createElement("section"); this.element.className = "har-v3-debug"; this.element.hidden = true; this.element.setAttribute("aria-label", "Character Runtime V3 diagnostics"); host.appendChild(this.element); return true; }
    toggle(force) { if (!this.element) return false; this.visible = force ?? !this.visible; this.element.hidden = !this.visible; if (this.visible) this.render(); return this.visible; }
    action(name, value) { if (name === "pause") this.paused = !this.paused; else if (name === "slow-motion") this.slowMotion = A.clamp(value || 0.25, 0.05, 1); else if (name in this.toggles) this.toggles[name] = !this.toggles[name]; return this.runtime.getDiagnostics(); }
    render() { if (!this.element) return; const diagnostic = this.runtime.getDiagnostics(); this.element.textContent = JSON.stringify(diagnostic, null, 2); }
    exportJSON() { return JSON.stringify(this.runtime.getDiagnostics(), null, 2); }
    dispose() { this.element?.remove?.(); this.element = null; this.host = null; }
  }
  A.CharacterDebugOverlay = CharacterDebugOverlay;
  if (typeof module !== "undefined" && module.exports) module.exports = CharacterDebugOverlay;
})(typeof window !== "undefined" ? window : globalThis);
