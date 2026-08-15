(function initCharacterDefinition(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  const QUALITY = new Set(["cinematic", "high", "balanced", "low", "save-data"]);
  class CharacterDefinition {
    constructor(input = {}) {
      this.id = A.safeId(input.id, "character.id");
      this.displayName = String(input.displayName || this.id).trim().slice(0, 80);
      this.model = String(input.model || "").trim();
      this.skeletonProfileId = A.safeId(input.skeletonProfileId || "hh-humanoid-v1", "skeletonProfileId");
      this.animationSetId = A.safeId(input.animationSetId || "astra-default-v3", "animationSetId");
      this.facialProfileId = A.safeId(input.facialProfileId || "safe-subset", "facialProfileId");
      this.secondaryMotionProfileId = A.safeId(input.secondaryMotionProfileId || "none", "secondaryMotionProfileId");
      this.defaultWeapon = String(input.defaultWeapon || "unarmed").slice(0, 80);
      this.bodyScale = A.clamp(input.bodyScale ?? 1, 0.72, 1.35);
      this.lods = Array.isArray(input.lods) ? input.lods.map((lod) => ({
        id: A.safeId(lod.id || "lod", "lod.id"),
        distance: A.clamp(lod.distance, 0, 500),
        model: String(lod.model || "").trim()
      })).sort((left, right) => left.distance - right.distance) : [];
      this.qualityOverrides = Object.fromEntries(Object.entries(input.qualityOverrides || {}).filter(([key]) => QUALITY.has(key)));
      this.rights = this.validateRights(input.rights);
      this.checksum = String(input.checksum || "").trim().slice(0, 128);
      this.missing = [];
      if (!this.model) this.missing.push("model");
      if (!this.rights.license) this.missing.push("rights.license");
    }
    validateRights(rights = {}) {
      return {
        author: String(rights.author || "HH Platform").slice(0, 120),
        source: String(rights.source || "repository-local").slice(0, 240),
        license: String(rights.license || "").slice(0, 80),
        attribution: String(rights.attribution || "").slice(0, 400)
      };
    }
    get ready() { return this.missing.length === 0; }
    toJSON() {
      return {
        id: this.id, displayName: this.displayName, model: this.model, skeletonProfileId: this.skeletonProfileId,
        animationSetId: this.animationSetId, facialProfileId: this.facialProfileId,
        secondaryMotionProfileId: this.secondaryMotionProfileId, defaultWeapon: this.defaultWeapon,
        bodyScale: this.bodyScale, lods: A.clone(this.lods), qualityOverrides: A.clone(this.qualityOverrides),
        rights: A.clone(this.rights), checksum: this.checksum, missing: [...this.missing], ready: this.ready
      };
    }
  }
  A.CharacterDefinition = CharacterDefinition;
  if (typeof module !== "undefined" && module.exports) module.exports = CharacterDefinition;
})(typeof window !== "undefined" ? window : globalThis);
