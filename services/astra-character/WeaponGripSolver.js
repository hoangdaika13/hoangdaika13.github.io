(function initWeaponGripSolver(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  const CLASSES = Object.freeze(["sword", "greatsword", "dualBlade", "spear", "scythe", "hammer", "shield", "pistol", "dual-pistol", "rifle", "sniper", "shotgun", "bow", "staff", "unarmed"]);
  const SOCKETS = Object.freeze(["Grip_R", "Grip_L", "Muzzle", "Blade_Base", "Blade_Tip", "String_Grip", "Arrow_Nock", "Holster_Back", "Holster_Hip_L", "Holster_Hip_R", "Shield_Grip", "Scope_Aim", "Shell_Eject", "Trail_Start", "Trail_End"]);
  class WeaponGripSolver {
    constructor() { this.profiles = new Map(); this.calibrations = new Map(); this.equipped = new Map(); this.lastError = new Map(); }
    registerProfile(id, input = {}) {
      const profileId = A.safeId(id, "weaponProfile.id");
      const weaponClass = CLASSES.includes(input.weaponClass) ? input.weaponClass : "unarmed";
      const sockets = Object.fromEntries(Object.entries(input.sockets || {}).filter(([key]) => SOCKETS.includes(key)));
      const required = weaponClass === "unarmed" ? [] : weaponClass === "bow" ? ["Grip_R", "Grip_L", "String_Grip", "Arrow_Nock"] : ["Grip_R", ...(new Set(["greatsword", "spear", "scythe", "hammer", "rifle", "sniper", "shotgun", "staff"]).has(weaponClass) ? ["Grip_L"] : [])];
      const missingSockets = required.filter((socket) => !sockets[socket]);
      const profile = { id: profileId, weaponClass, sockets, required, missingSockets, handIkWeight: A.clamp(input.handIkWeight ?? 1, 0, 1), fallback: missingSockets.length > 0, animationSet: String(input.animationSet || weaponClass) };
      this.profiles.set(profileId, profile);
      return profile;
    }
    calibrationKey(input = {}) { return [input.characterId, input.skeletonProfileId, input.weaponClass, input.weaponAssetId].map((value) => A.safeId(value || "unknown", "calibration key")).join("|"); }
    saveCalibration(input, calibration = {}) { const key = this.calibrationKey(input); this.calibrations.set(key, A.clone(calibration)); return key; }
    equip(characterId, profileId, mode = "hand") {
      const profile = this.profiles.get(profileId);
      if (!profile) throw new Error(`Weapon profile ${profileId} chưa đăng ký.`);
      const record = { characterId: A.safeId(characterId, "characterId"), profileId, mode, transition: mode === "holster" ? "holster" : "equip", attached: false };
      this.equipped.set(record.characterId, record);
      return record;
    }
    marker(characterId, markerName) {
      const record = this.equipped.get(characterId);
      if (!record) return false;
      if (markerName === "equip_attach" || markerName === "equip_release") record.attached = markerName === "equip_attach";
      return record.attached;
    }
    measureGrip(characterId, rightHand, leftHand, rightGrip, leftGrip) {
      const distance = (a, b) => a && b ? Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0), (a.z || 0) - (b.z || 0)) : null;
      const right = distance(rightHand, rightGrip), left = distance(leftHand, leftGrip);
      const valid = (right === null || right < 0.02) && (left === null || left < 0.02);
      const report = { right, left, valid, threshold: 0.02 };
      this.lastError.set(characterId, report);
      return report;
    }
    getDiagnostics(characterId) { const equipped = this.equipped.get(characterId); return { equipped, profile: equipped ? this.profiles.get(equipped.profileId) : null, gripError: this.lastError.get(characterId) || null }; }
    dispose() { this.profiles.clear(); this.calibrations.clear(); this.equipped.clear(); this.lastError.clear(); }
  }
  WeaponGripSolver.CLASSES = CLASSES;
  WeaponGripSolver.SOCKETS = SOCKETS;
  A.WeaponGripSolver = WeaponGripSolver;
  if (typeof module !== "undefined" && module.exports) module.exports = WeaponGripSolver;
})(typeof window !== "undefined" ? window : globalThis);
