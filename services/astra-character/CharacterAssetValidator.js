(function initCharacterAssetValidator(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  class CharacterAssetValidator {
    static validate(input = {}) {
      const budgets = input.budgets || {};
      const metrics = {
        triangles: Math.max(0, Number(input.triangles || 0)), skinnedMeshes: Math.max(0, Number(input.skinnedMeshes || 0)),
        bones: Math.max(0, Number(input.bones || 0)), morphTargets: Math.max(0, Number(input.morphTargets || 0)),
        materials: Math.max(0, Number(input.materials || 0)), textureMemory: Math.max(0, Number(input.textureMemory || 0)),
        drawCalls: Math.max(0, Number(input.drawCalls || 0)), animationClips: Math.max(0, Number(input.animationClips || 0)),
        fileBytes: Math.max(0, Number(input.fileBytes || 0))
      };
      const warnings = [];
      Object.entries(budgets).forEach(([key, max]) => {
        if (Number.isFinite(Number(max)) && metrics[key] > Number(max)) warnings.push(`${key}: ${metrics[key]} vượt budget ${max}`);
      });
      const errors = [];
      if (!input.characterId) errors.push("Thiếu characterId.");
      if (!input.skeletonProfileId) errors.push("Thiếu skeletonProfileId.");
      if (!input.rights?.license) errors.push("Thiếu hồ sơ giấy phép asset.");
      if (input.checksum && !/^[a-f0-9]{32,128}$/i.test(input.checksum)) errors.push("Checksum không hợp lệ.");
      return { ok: errors.length === 0, status: errors.length ? "rejected" : warnings.length ? "warning" : "ready", metrics, warnings, errors };
    }
  }
  A.CharacterAssetValidator = CharacterAssetValidator;
  if (typeof module !== "undefined" && module.exports) module.exports = CharacterAssetValidator;
})(typeof window !== "undefined" ? window : globalThis);
