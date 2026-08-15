(function initAnimationRetargeter(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  class AnimationRetargeter {
    static retargetTracks(tracks = [], sourceProfile, targetProfile, options = {}) {
      if (!sourceProfile || !targetProfile) throw new TypeError("Cần sourceProfile và targetProfile.");
      const sourceByBone = new Map(Object.entries(sourceProfile.boneMap || {}).map(([slot, bone]) => [String(bone), slot]));
      const scale = A.clamp((targetProfile.height || 1) / (sourceProfile.height || 1), 0.5, 2);
      const missing = new Set();
      const mapped = [];
      tracks.forEach((track) => {
        const name = String(track.name || "");
        const separator = name.lastIndexOf(".");
        const sourceBone = separator > 0 ? name.slice(0, separator) : name;
        const property = separator > 0 ? name.slice(separator) : "";
        const slot = sourceByBone.get(sourceBone);
        const targetBone = targetProfile.boneMap?.[slot];
        if (!slot || !targetBone) { missing.add(sourceBone); return; }
        const copy = { ...track, name: `${targetBone}${property}` };
        if (property === ".position" && options.scaleTranslation !== false && track.values) {
          copy.values = Array.from(track.values, (value) => Number(value) * scale);
        }
        mapped.push(copy);
      });
      return { tracks: mapped, missing: [...missing], coverage: tracks.length ? mapped.length / tracks.length : 1, scale };
    }
  }
  A.AnimationRetargeter = AnimationRetargeter;
  if (typeof module !== "undefined" && module.exports) module.exports = AnimationRetargeter;
})(typeof window !== "undefined" ? window : globalThis);
