(function initCharacterCustomizationController(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  class CharacterCustomizationController {
    constructor(initial = {}, options = {}) { this.ownerId = String(options.ownerId || "local"); this.value = this.sanitize(initial); this.history = []; this.future = []; this.presets = new Map(); }
    sanitize(input = {}) { const body = input.body || {}; return { version: 1, body: { height: A.clamp(body.height ?? 1, 0.86, 1.14), shoulders: A.clamp(body.shoulders ?? 1, 0.82, 1.18), limbs: A.clamp(body.limbs ?? 1, 0.9, 1.1) }, facePreset: String(input.facePreset || "default").slice(0, 80), skinTone: String(input.skinTone || "#d9aa8c").slice(0, 16), hair: String(input.hair || "default").slice(0, 80), eyeColor: String(input.eyeColor || "#65efff").slice(0, 16), outfit: String(input.outfit || "default").slice(0, 80), materialVariant: String(input.materialVariant || "default").slice(0, 80), accessories: [...new Set((input.accessories || []).map(String))].slice(0, 12), voice: String(input.voice || "vi-female-default").slice(0, 80), idlePersonality: String(input.idlePersonality || "balanced").slice(0, 48), combatPersonality: String(input.combatPersonality || "focused").slice(0, 48), rights: A.clone(input.rights || {}) }; }
    apply(patch = {}) { this.history.push(A.clone(this.value)); this.history = this.history.slice(-50); this.future.length = 0; this.value = this.sanitize({ ...this.value, ...patch, body: { ...this.value.body, ...(patch.body || {}) } }); return A.clone(this.value); }
    undo() { if (!this.history.length) return null; this.future.push(A.clone(this.value)); this.value = this.history.pop(); return A.clone(this.value); }
    redo() { if (!this.future.length) return null; this.history.push(A.clone(this.value)); this.value = this.future.pop(); return A.clone(this.value); }
    savePreset(id) { const presetId = A.safeId(id, "preset.id"); this.presets.set(presetId, { ownerId: this.ownerId, value: A.clone(this.value), checksum: this.checksum() }); return presetId; }
    loadPreset(id, ownerId = this.ownerId) { const preset = this.presets.get(id); if (!preset || preset.ownerId !== ownerId) return null; return this.apply(preset.value); }
    checksum() { let hash = 2166136261; JSON.stringify(this.value).split("").forEach((char) => { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }); return (hash >>> 0).toString(16).padStart(8, "0"); }
    exportJSON() { return JSON.stringify({ format: "hh.astra-character-preset.v1", ownerId: this.ownerId, value: this.value, checksum: this.checksum() }, null, 2); }
  }
  A.CharacterCustomizationController = CharacterCustomizationController;
  if (typeof module !== "undefined" && module.exports) module.exports = CharacterCustomizationController;
})(typeof window !== "undefined" ? window : globalThis);
