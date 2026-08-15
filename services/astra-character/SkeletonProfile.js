(function initSkeletonProfile(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  const REQUIRED = ["root", "hips", "spine", "head", "leftHand", "rightHand", "leftFoot", "rightFoot"];
  class SkeletonProfile {
    constructor(input = {}) {
      this.id = A.safeId(input.id || "hh-humanoid-v1", "skeleton.id");
      this.boneMap = Object.fromEntries(Object.entries(input.boneMap || {}).map(([slot, bone]) => [slot, String(bone || "").trim()]));
      this.jointLimits = Object.fromEntries(Object.entries(input.jointLimits || {}).map(([slot, limit]) => [slot, {
        min: A.vector3(limit?.min), max: A.vector3(limit?.max), pole: limit?.pole ? A.vector3(limit.pole) : null
      }]));
      this.restPose = A.clone(input.restPose || {});
      this.forwardAxis = String(input.forwardAxis || "+Z");
      this.upAxis = String(input.upAxis || "+Y");
      this.height = A.clamp(input.height || 1.72, 0.8, 3.2);
      this.hipBone = String(input.hipBone || this.boneMap.hips || "");
      this.rootBone = String(input.rootBone || this.boneMap.root || "");
      this.ikChains = A.clone(input.ikChains || {});
      this.missingBones = REQUIRED.filter((slot) => !this.boneMap[slot]);
    }
    resolve(rootObject) {
      const found = {};
      rootObject?.traverse?.((node) => {
        const match = Object.entries(this.boneMap).find(([, boneName]) => boneName && node.name === boneName);
        if (match && !found[match[0]]) found[match[0]] = node;
      });
      return { bones: found, missing: REQUIRED.filter((slot) => !found[slot]) };
    }
    clampJoint(slot, rotation = {}) {
      const limit = this.jointLimits[slot];
      if (!limit) return A.vector3(rotation);
      return {
        x: A.clamp(rotation.x, limit.min.x, limit.max.x),
        y: A.clamp(rotation.y, limit.min.y, limit.max.y),
        z: A.clamp(rotation.z, limit.min.z, limit.max.z)
      };
    }
  }
  A.SkeletonProfile = SkeletonProfile;
  if (typeof module !== "undefined" && module.exports) module.exports = SkeletonProfile;
})(typeof window !== "undefined" ? window : globalThis);
