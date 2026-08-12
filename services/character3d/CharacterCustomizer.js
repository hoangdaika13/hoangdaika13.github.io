(function initHHCharacter3DCustomizer(global) {
  "use strict";

  const COLOR_ROLES = Object.freeze({
    hair: [/hair|tóc/i], eyes: [/eye|iris|mắt/i], skin: [/skin|face|body|da/i],
    outfit: [/outfit|cloth|armor|suit|áo|giáp/i], emissive: [/emissive|glow|core|cyan|light/i]
  });
  const VARIANT_PATTERNS = Object.freeze({
    hairstyle: /hairstyle|hair[-_ ]?variant|kiểu[-_ ]?tóc/i,
    outfit: /outfit[-_ ]?variant|costume|trang[-_ ]?phục/i,
    shoes: /shoe|boot|giày/i,
    accessory: /accessory|prop|weapon|hat|ribbon|phụ[-_ ]?kiện/i
  });
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));

  class CharacterCustomizer {
    constructor(options = {}) {
      this.THREE = options.THREE || null;
      this.root = null;
      this.materials = new Map();
      this.morphs = new Map();
      this.accessories = new Map();
      this.variants = new Map(Object.keys(VARIANT_PATTERNS).map((key) => [key, new Map()]));
      this.baseline = new Map();
      this.changes = {};
    }

    bind(root) {
      this.root = root;
      this.materials.clear(); this.morphs.clear(); this.accessories.clear(); this.baseline.clear(); this.changes = {};
      this.variants.forEach((entries) => entries.clear());
      root?.traverse?.((node) => {
        const key = String(node.name || node.uuid || "node");
        if (/accessory|prop|weapon|hat|ribbon|phụ kiện/i.test(key)) this.accessories.set(key, node);
        Object.entries(VARIANT_PATTERNS).forEach(([group, pattern]) => { if (pattern.test(key)) this.variants.get(group).set(key, node); });
        const list = Array.isArray(node.material) ? node.material : [node.material];
        list.filter(Boolean).forEach((material) => {
          const id = material.uuid || material.name || key;
          this.materials.set(id, material);
          this.baseline.set(id, { color: material.color?.clone?.(), emissive: material.emissive?.clone?.(), emissiveIntensity: material.emissiveIntensity });
        });
        Object.entries(node.morphTargetDictionary || {}).forEach(([name, index]) => this.morphs.set(name, { node, index }));
      });
      return this.capabilities();
    }

    findMaterials(role) {
      const patterns = COLOR_ROLES[role] || [new RegExp(String(role), "i")];
      return [...this.materials.values()].filter((material) => patterns.some((pattern) => pattern.test(`${material.name} ${material.userData?.role || ""}`)));
    }

    setColor(role, cssColor, options = {}) {
      const targets = this.findMaterials(role);
      targets.forEach((material) => {
        const target = role === "emissive" && material.emissive ? material.emissive : material.color;
        target?.set?.(cssColor);
        if (role === "emissive" && "emissiveIntensity" in material) material.emissiveIntensity = clamp(options.intensity ?? 1.5, 0, 8);
        material.needsUpdate = true;
      });
      if (targets.length) this.changes[`${role}Color`] = cssColor;
      return targets.length;
    }

    setMorph(name, value) {
      const morph = this.morphs.get(name);
      if (!morph || !Array.isArray(morph.node.morphTargetInfluences)) return false;
      morph.node.morphTargetInfluences[morph.index] = clamp(value);
      this.changes[`morph:${name}`] = clamp(value);
      return true;
    }

    setAccessory(name, visible) {
      const entry = this.accessories.get(name);
      if (!entry) return false;
      entry.visible = Boolean(visible); this.changes[`accessory:${name}`] = Boolean(visible); return true;
    }

    setVariant(group, name) {
      const entries = this.variants.get(group);
      const selected = entries?.get(name);
      if (!entries?.size || !selected) return false;
      entries.forEach((node) => { node.visible = node === selected; });
      this.changes[`${group}Variant`] = name;
      return true;
    }

    applyPreset(preset = {}) {
      const applied = [];
      Object.keys(COLOR_ROLES).forEach((role) => { if (preset[`${role}Color`] && this.setColor(role, preset[`${role}Color`], preset)) applied.push(`${role}Color`); });
      Object.keys(VARIANT_PATTERNS).forEach((group) => { if (preset[`${group}Variant`] && this.setVariant(group, preset[`${group}Variant`])) applied.push(`${group}Variant`); });
      Object.entries(preset.morphs || {}).forEach(([name, value]) => { if (this.setMorph(name, value)) applied.push(`morph:${name}`); });
      return applied;
    }

    capabilities() {
      return Object.freeze({
        colors: Object.keys(COLOR_ROLES).filter((role) => this.findMaterials(role).length),
        morphs: [...this.morphs.keys()],
        accessories: [...this.accessories.keys()],
        variants: Object.fromEntries([...this.variants].map(([group, entries]) => [group, [...entries.keys()]])),
        honestMorphEditing: true
      });
    }

    reset() {
      this.materials.forEach((material, id) => {
        const source = this.baseline.get(id);
        if (source?.color && material.color) material.color.copy(source.color);
        if (source?.emissive && material.emissive) material.emissive.copy(source.emissive);
        if (source && "emissiveIntensity" in material) material.emissiveIntensity = source.emissiveIntensity;
        material.needsUpdate = true;
      });
      this.morphs.forEach(({ node, index }) => { if (node.morphTargetInfluences) node.morphTargetInfluences[index] = 0; });
      this.accessories.forEach((node) => { node.visible = true; });
      this.changes = {};
    }

    serialize() { return JSON.parse(JSON.stringify(this.changes)); }

    dispose() {
      this.reset(); this.root = null; this.materials.clear(); this.morphs.clear(); this.accessories.clear(); this.variants.forEach((entries) => entries.clear()); this.baseline.clear();
    }
  }

  global.HHCharacter3DCustomizer = Object.freeze({ CharacterCustomizer, COLOR_ROLES });
  global.HHCharacter3D = global.HHCharacter3D || {};
  global.HHCharacter3D.CharacterCustomizer = CharacterCustomizer;
})(typeof window !== "undefined" ? window : globalThis);
