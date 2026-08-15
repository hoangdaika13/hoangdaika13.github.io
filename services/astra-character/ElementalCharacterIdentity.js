(function initElementalCharacterIdentity(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  const PROFILES = Object.freeze({
    plasma: { stance: "charged", eyeGlow: "#67f4ff", trail: "ion-ribbon", footstep: "spark", impact: "plasma-arc", material: "ionized" },
    cryo: { stance: "precise", eyeGlow: "#a8e7ff", trail: "ice-shard", footstep: "frost", impact: "crystal-burst", material: "frosted" },
    void: { stance: "predatory", eyeGlow: "#c98cff", trail: "gravity-rift", footstep: "void-dust", impact: "singularity", material: "phase-shift" },
    solar: { stance: "heroic", eyeGlow: "#ffd36a", trail: "solar-flare", footstep: "ember", impact: "corona", material: "radiant" },
    neutral: { stance: "balanced", eyeGlow: "#ffffff", trail: "standard", footstep: "dust", impact: "physical", material: "pbr" }
  });
  class ElementalCharacterIdentity { constructor(element = "neutral") { this.set(element); } set(element) { this.element = PROFILES[element] ? element : "neutral"; this.profile = PROFILES[this.element]; return this.profile; } reflectedSurfaces() { return { skin: true, eyes: true, hair: true, outfit: true, weapon: true, nearbyGround: true, pooledLights: true }; } }
  ElementalCharacterIdentity.PROFILES = PROFILES;
  A.ElementalCharacterIdentity = ElementalCharacterIdentity;
  if (typeof module !== "undefined" && module.exports) module.exports = ElementalCharacterIdentity;
})(typeof window !== "undefined" ? window : globalThis);
