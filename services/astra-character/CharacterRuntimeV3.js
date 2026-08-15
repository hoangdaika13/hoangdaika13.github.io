(function initCharacterRuntimeV3(root) {
  "use strict";
  const A = root.HHAstraCharacter || (typeof require === "function" ? require("./AstraCharacterCore.js") : {});
  if (typeof require === "function" && typeof module !== "undefined" && module.exports) {
    ["CharacterDefinition", "CharacterAssetValidator", "SkeletonProfile", "AnimationRegistry", "AnimationRetargeter", "AnimationStateMachine", "AdditiveAnimationLayer", "LocomotionController", "MotionWarping", "FootPlacementIK", "FullBodyIK", "LookAtController", "WeaponGripSolver", "CombatMarkerTimeline", "CombatAnimationController", "HitReactionController", "RagdollController", "FacialPerformanceController", "LipSyncController", "SecondaryMotionController", "ContextualInteractionController", "CharacterCollisionController", "CharacterLODController", "CharacterNetworkReplicator", "CharacterPerformanceGovernor", "CharacterDebugOverlay", "CinematicCharacterDirector", "ElementalCharacterIdentity", "CharacterCustomizationController"].forEach((name) => { if (!A[name]) require(`./${name}.js`); });
  }

  const LAB_TABS = Object.freeze([
    ["overview", "Tổng quan"], ["locomotion", "Locomotion"], ["ik", "IK"], ["weapons", "Vũ khí"], ["combat", "Combat"],
    ["face", "Khuôn mặt"], ["secondary", "Secondary Motion"], ["damage", "Damage/Ragdoll"], ["performance", "LOD & Performance"],
    ["network", "Network"], ["assets", "Asset Validation"]
  ]);
  const DEFAULT_CLIPS = Object.freeze([
    { id: "idle-relaxed", clipName: "idle", category: "idle", looping: true, duration: 2.4, locomotionSpeed: 0 },
    { id: "walk-forward", clipName: "walk", category: "locomotion", looping: true, duration: 1.05, locomotionSpeed: 2.4, direction: 0 },
    { id: "jog-forward", clipName: "run", category: "locomotion", looping: true, duration: 0.72, locomotionSpeed: 4.7, direction: 0 },
    { id: "sprint", clipName: "sprint", category: "locomotion", looping: true, duration: 0.58, locomotionSpeed: 7.2, direction: 0 }
  ]);

  class CharacterRuntimeV3 {
    constructor(options = {}) {
      this.version = A.VERSION || "3.0.0";
      this.characters = new Map();
      this.definitions = new Map();
      this.skeletons = new Map();
      this.animationRegistry = new A.AnimationRegistry();
      this.weaponGrip = new A.WeaponGripSolver();
      this.collision = new A.CharacterCollisionController();
      this.performance = new A.CharacterPerformanceGovernor(options.qualityTier || "balanced");
      this.events = new A.EventBus();
      this.disposables = new A.DisposableRegistry();
      this.qualityTier = options.qualityTier || "balanced";
      this.developer = options.developer === true;
      this.disposed = false;
      this.frame = 0;
      this.lastUpdateAt = A.now();
      this.backend = "unmounted";
      this.activeLabTab = "overview";
      this.animationRegistry.registerSet("astra-default-v3", DEFAULT_CLIPS);
      this.visibilityHandler = () => { if (root.document?.visibilityState === "visible") this.characters.forEach((record) => record.secondary.reset("tab-resume")); };
      root.document?.addEventListener?.("visibilitychange", this.visibilityHandler);
      this.disposables.add(() => root.document?.removeEventListener?.("visibilitychange", this.visibilityHandler));
    }
    assertActive() { if (this.disposed) throw new Error("Character Runtime V3 đã dispose."); }
    registerCharacter(input) { this.assertActive(); const definition = input instanceof A.CharacterDefinition ? input : new A.CharacterDefinition(input); this.definitions.set(definition.id, definition); return definition; }
    registerSkeletonProfile(input) { this.assertActive(); const profile = input instanceof A.SkeletonProfile ? input : new A.SkeletonProfile(input); this.skeletons.set(profile.id, profile); return profile; }
    registerAnimationSet(id, clips) { this.assertActive(); return this.animationRegistry.registerSet(id, clips); }
    registerWeaponProfile(id, profile) { this.assertActive(); return this.weaponGrip.registerProfile(id, profile); }
    mountCharacter(options = {}) {
      this.assertActive();
      const characterId = A.safeId(options.characterId || options.definition?.id, "characterId");
      if (this.characters.has(characterId)) this.unmountCharacter(characterId);
      let definition = this.definitions.get(characterId);
      if (!definition) definition = this.registerCharacter(options.definition || { id: characterId, displayName: options.displayName || characterId, model: options.model || options.object3d?.userData?.sourceAssetPath || "runtime-object", skeletonProfileId: options.skeletonProfileId || "hh-humanoid-v1", animationSetId: options.animationSetId || "astra-default-v3", rights: options.rights || { license: options.object3d?.userData?.sourceLicense || "repository-local", source: options.object3d?.userData?.sourceAssetPath || "runtime-object" } });
      let skeleton = this.skeletons.get(definition.skeletonProfileId);
      if (!skeleton) skeleton = this.registerSkeletonProfile(options.skeletonProfile || { id: definition.skeletonProfileId, boneMap: options.boneMap || { root: "Root", hips: "Hips", spine: "Spine", head: "Head", leftHand: "LeftHand", rightHand: "RightHand", leftFoot: "LeftFoot", rightFoot: "RightFoot" }, height: options.height || 1.72 });
      const resolved = options.object3d ? skeleton.resolve(options.object3d) : { bones: {}, missing: [...skeleton.missingBones] };
      const morphDictionary = {};
      options.object3d?.traverse?.((node) => Object.assign(morphDictionary, node.morphTargetDictionary || {}));
      const qa = options.legacyRuntime?.qaReport || {};
      const assetValidation = A.CharacterAssetValidator.validate({
        characterId, skeletonProfileId: definition.skeletonProfileId, rights: definition.rights, checksum: definition.checksum,
        triangles: options.legacyRuntime?.triangles || qa.triangles, skinnedMeshes: qa.skinnedMeshes, bones: qa.bones,
        morphTargets: qa.morphTargets, materials: qa.materials, textureMemory: qa.textureMemory,
        drawCalls: qa.materials, animationClips: qa.animations, fileBytes: qa.fileBytes,
        budgets: options.assetBudgets || { triangles: 180000, bones: 320, morphTargets: 160, materials: 48, drawCalls: 80 }
      });
      const record = {
        id: characterId, definition, skeleton, object3d: options.object3d || null, mixer: options.mixer || options.legacyRuntime?.mixer || null,
        legacyRuntime: options.legacyRuntime || null, role: options.role || "npc", mountedAt: A.now(), status: "mounted", bones: resolved.bones,
        missingBones: resolved.missing, input: {}, groundSampler: typeof options.groundSampler === "function" ? options.groundSampler : null,
        onCombatMarker: typeof options.onCombatMarker === "function" ? options.onCombatMarker : null,
        onServerCombatRequest: typeof options.onServerCombatRequest === "function" ? options.onServerCombatRequest : null,
        locomotion: new A.LocomotionController(options.locomotion), motionWarping: new A.MotionWarping(options.motionWarping),
        feet: new A.FootPlacementIK(), fullBodyIk: new A.FullBodyIK(), lookAt: new A.LookAtController(), additive: new A.AdditiveAnimationLayer(),
        combat: new A.CombatAnimationController(), hitReaction: new A.HitReactionController(), ragdoll: new A.RagdollController(),
        facial: new A.FacialPerformanceController(morphDictionary), lipSync: new A.LipSyncController(), secondary: new A.SecondaryMotionController(),
        interaction: new A.ContextualInteractionController(), lod: new A.CharacterLODController(options.lodProfile), network: new A.CharacterNetworkReplicator(),
        director: new A.CinematicCharacterDirector(), elemental: new A.ElementalCharacterIdentity(options.element || "neutral"),
        customization: new A.CharacterCustomizationController(options.customization, { ownerId: options.ownerId || "local" }),
        assetValidation,
        diagnostics: { lastMarker: "", activeHitboxes: 0, gripError: null, groundNormal: { x: 0, y: 1, z: 0 }, missingAssets: [...definition.missing, ...assetValidation.errors], backend: options.backend || "unknown" }
      };
      record.fullBodyIk.registerChain("left-hand", { lengths: [0.32, 0.29], weight: 1 });
      record.fullBodyIk.registerChain("right-hand", { lengths: [0.32, 0.29], weight: 1 });
      record.fullBodyIk.registerChain("left-foot", { lengths: [0.48, 0.47], weight: 1 });
      record.fullBodyIk.registerChain("right-foot", { lengths: [0.48, 0.47], weight: 1 });
      record.combat.events.on("marker", (event) => {
        record.diagnostics.lastMarker = event.name;
        record.diagnostics.activeHitboxes = event.name === "active_start" ? 1 : event.name === "active_end" ? 0 : record.diagnostics.activeHitboxes;
        this.weaponGrip.marker(characterId, event.name);
        record.onCombatMarker?.(event);
        if (event.name === "active_start") record.onServerCombatRequest?.({ characterId, sequenceId: event.sequenceId, action: record.combat.active?.type, marker: event.name });
      });
      const position = options.object3d?.position || options.position || {};
      this.collision.register(characterId, { position, player: record.role === "player", personalSpaceRadius: options.personalSpaceRadius, combatRadius: options.combatRadius, priority: record.role === "player" ? 1 : record.role === "boss" ? 0.9 : 0.5 });
      this.characters.set(characterId, record);
      this.backend = options.backend || this.backend === "unmounted" ? (options.backend || "webgl2") : this.backend;
      this.events.emit("mounted", { characterId });
      return this.publicRecord(record);
    }
    publicRecord(record) { return { id: record.id, status: record.status, definition: record.definition.toJSON(), missingBones: [...record.missingBones], role: record.role, mountedAt: record.mountedAt }; }
    unmountCharacter(characterId) {
      const id = A.safeId(characterId, "characterId");
      const record = this.characters.get(id);
      if (!record) return false;
      record.combat.dispose(); record.additive.dispose(); record.fullBodyIk.dispose(); record.secondary.dispose(); record.interaction.dispose(); record.network.dispose(); record.director.dispose();
      record.mixer?.stopAllAction?.();
      this.collision.unregister(id);
      record.status = "unmounted";
      this.characters.delete(id);
      this.events.emit("unmounted", { characterId: id });
      return true;
    }
    equipWeapon(characterId, weaponProfileId, mode = "hand") { return this.weaponGrip.equip(characterId, weaponProfileId, mode); }
    setLocomotionInput(characterId, input) { const record = this.requireRecord(characterId); record.input = { ...record.input, ...input }; return record.locomotion.setInput(record.input); }
    requestAction(characterId, action = {}) { const record = this.requireRecord(characterId); if (action.type === "interaction") return record.interaction.request(action.target); if (action.type === "ragdoll") return record.ragdoll.activate(action); record.action = { ...action, requestedAt: A.now() }; return { accepted: true, action: record.action }; }
    requestCombatAction(characterId, action) { return this.requireRecord(characterId).combat.request(action); }
    setLookTarget(characterId, target, weight) { const record = this.requireRecord(characterId); record.lookAt.setTarget(target, weight); return true; }
    setFacialState(characterId, state) { return this.requireRecord(characterId).facial.setExpression(state); }
    playDialogue(characterId, dialogue = {}) { return this.requireRecord(characterId).lipSync.play(dialogue); }
    applyHit(characterId, hit = {}) { const record = this.requireRecord(characterId); const reaction = record.hitReaction.apply(hit, hit.serverConfirmed === true); if (["knockdown", "death"].includes(reaction.level)) record.ragdoll.activate({ serverConfirmed: true, partial: reaction.level !== "death", pose: hit.pose }); return reaction; }
    setQualityTier(tier, manual = true) { this.qualityTier = tier; const profile = this.performance.setTier(tier, manual); this.characters.forEach((record) => record.fullBodyIk.setQuality(tier)); return profile; }
    requireRecord(characterId) { this.assertActive(); const record = this.characters.get(A.safeId(characterId, "characterId")); if (!record) throw new Error(`Character ${characterId} chưa mount.`); return record; }
    update(dt, timestamp = A.now(), frameContext = {}) {
      if (this.disposed) return null;
      dt = A.clamp(dt, 0, 0.1); this.frame += 1; this.lastUpdateAt = timestamp;
      const activeId = frameContext.activeCharacterId;
      this.characters.forEach((record) => {
        const objectPosition = record.object3d?.position;
        const distance = typeof frameContext.distanceFor === "function" ? frameContext.distanceFor(record.id) : record.id === activeId ? 0 : Number(frameContext.distance || 12);
        const capabilities = record.lod.capabilities(this.qualityTier, distance);
        const hz = record.lod.animationHz(distance, record.role);
        if (this.frame % Math.max(1, Math.round(60 / hz)) !== 0 && record.role !== "player") return;
        const locomotion = record.locomotion.update(dt);
        if (record.legacyRuntime) {
          record.legacyRuntime.v3State = locomotion.state;
          record.legacyRuntime.v3Blend = locomotion.blend;
          record.legacyRuntime.acceleration = locomotion.acceleration;
          record.legacyRuntime.yawVelocity = locomotion.angularVelocity;
          record.legacyRuntime.strideScale = record.motionWarping.strideScale(locomotion.speed, Math.max(0.1, record.legacyRuntime.motionSpeed || locomotion.speed || 1), record.definition.bodyScale);
        }
        const ground = record.groundSampler?.(record) || null;
        if (ground && capabilities.fullIk) {
          record.feet.enabled = !["jump-start", "jump-loop", "fall"].includes(locomotion.state) && !record.ragdoll.state.includes("ragdoll");
          record.feet.updateFoot("left", ground.left || ground, dt); record.feet.updateFoot("right", ground.right || ground, dt);
          record.diagnostics.groundNormal = A.vector3(ground.normal || { y: 1 });
        }
        const viseme = record.lipSync.update(timestamp);
        const face = record.facial.update(dt, timestamp, viseme);
        if (capabilities.facial) record.object3d?.traverse?.((node) => { if (node.morphTargetInfluences) record.facial.applyTo(node.morphTargetInfluences); });
        record.secondary.setDistance(distance, this.qualityTier); record.secondary.update(dt);
        record.combat.update(dt, timestamp); record.ragdoll.update(dt); record.hitReaction.update(timestamp);
        record.lookAt.update(objectPosition || {}, locomotion.facingYaw, dt);
        record.additive.set("upper-body-aim", record.input.aim ? 1 : 0, { fadeSpeed: 14 });
        record.additive.set("hit-reaction", record.hitReaction.current?.additive ? 1 : 0, { fadeSpeed: 20 });
        record.additive.update(dt);
        record.director.update(dt);
        record.diagnostics = { ...record.diagnostics, lod: capabilities.lod, capabilities, currentState: locomotion.state, facialMode: record.facial.available ? "morph-subset" : "Chưa kết nối", lipSyncMode: record.lipSync.mode, secondaryEnabled: record.secondary.enabled, expression: face.expression };
        const collider = this.collision.actors.get(record.id); if (collider && objectPosition) collider.position = A.vector3(objectPosition);
      });
      const corrections = this.collision.solve({ attackingId: [...this.characters.values()].find((record) => record.combat.state === "active")?.id });
      if (frameContext.applySeparation === true) Object.entries(corrections).forEach(([id, correction]) => { const record = this.characters.get(id); if (record?.role !== "player" && record.object3d?.position) { record.object3d.position.x += correction.x; record.object3d.position.z += correction.z; } });
      return { frame: this.frame, characters: this.characters.size, corrections };
    }
    getDiagnostics(characterId) {
      const records = characterId ? [this.requireRecord(characterId)] : [...this.characters.values()];
      return {
        runtime: "HH CINEMATIC CHARACTER RUNTIME V3", version: this.version, backend: this.backend, qualityTier: this.qualityTier,
        frame: this.frame, mountedCharacters: records.length, characterDefinitions: this.definitions.size, skeletonProfiles: this.skeletons.size,
        characters: records.map((record) => ({
          id: record.id, role: record.role, model: record.definition.model, state: record.locomotion.state, previousState: record.locomotion.previousState,
          stateTime: Number(record.locomotion.stateTime.toFixed(3)), speed: Number(Math.hypot(record.locomotion.velocity.x, record.locomotion.velocity.z).toFixed(3)),
          acceleration: Number(record.locomotion.accelerationValue.toFixed(3)), blendWeights: record.locomotion.blend, currentClip: record.legacyRuntime?.currentAction?._clip?.name || record.legacyRuntime?.state || "Chưa kết nối",
          groundNormal: record.diagnostics.groundNormal, footLock: record.feet.getDiagnostics(), ikWeights: { leftHand: record.fullBodyIk.chains.get("left-hand")?.weight || 0, rightHand: record.fullBodyIk.chains.get("right-hand")?.weight || 0, feet: record.feet.enabled ? 1 : 0 },
          grip: this.weaponGrip.getDiagnostics(record.id), activeHitboxes: record.diagnostics.activeHitboxes, combat: record.combat.snapshot(),
          network: { snapshots: record.network.snapshots.length, lastReconciliation: record.network.lastReconciliation },
          lod: record.diagnostics.lod || "hero", qualityTier: this.qualityTier, triangles: record.legacyRuntime?.triangles || record.legacyRuntime?.qaReport?.triangles || 0,
          drawCalls: record.legacyRuntime?.qaReport?.materials || 0, textureMemory: record.legacyRuntime?.qaReport?.textureMemory || "Chưa kết nối",
          facial: { channels: record.facial.available, mode: record.diagnostics.facialMode, expression: record.facial.expression, lipSync: record.lipSync.mode },
          secondary: { enabled: record.secondary.enabled, chains: record.secondary.chains.size, resets: record.secondary.resets }, ragdoll: record.ragdoll.state,
          missingBones: record.missingBones, missingAssets: record.diagnostics.missingAssets, assetValidation: record.assetValidation, backend: record.diagnostics.backend
        }))
      };
    }
    setLabTab(tab) { if (LAB_TABS.some(([id]) => id === tab)) this.activeLabTab = tab; return this.activeLabTab; }
    dispose() { if (this.disposed) return false; [...this.characters.keys()].forEach((id) => this.unmountCharacter(id)); this.animationRegistry.clear(); this.weaponGrip.dispose(); this.collision.dispose(); this.events.clear(); this.disposables.dispose(); this.definitions.clear(); this.skeletons.clear(); this.disposed = true; this.backend = "disposed"; return true; }
  }

  CharacterRuntimeV3.LAB_TABS = LAB_TABS;
  const runtime = new CharacterRuntimeV3();
  const facade = Object.freeze({
    VERSION: runtime.version, LAB_TABS,
    mountCharacter: (options) => runtime.mountCharacter(options), unmountCharacter: (id) => runtime.unmountCharacter(id),
    registerCharacter: (input) => runtime.registerCharacter(input), registerSkeletonProfile: (input) => runtime.registerSkeletonProfile(input),
    registerAnimationSet: (id, clips) => runtime.registerAnimationSet(id, clips), registerWeaponProfile: (id, profile) => runtime.registerWeaponProfile(id, profile),
    equipWeapon: (characterId, profileId, mode) => runtime.equipWeapon(characterId, profileId, mode), setLocomotionInput: (id, input) => runtime.setLocomotionInput(id, input),
    requestAction: (id, action) => runtime.requestAction(id, action), requestCombatAction: (id, action) => runtime.requestCombatAction(id, action),
    setLookTarget: (id, target, weight) => runtime.setLookTarget(id, target, weight), setFacialState: (id, state) => runtime.setFacialState(id, state),
    playDialogue: (id, dialogue) => runtime.playDialogue(id, dialogue), applyHit: (id, hit) => runtime.applyHit(id, hit),
    setQualityTier: (tier, manual) => runtime.setQualityTier(tier, manual), getDiagnostics: (id) => runtime.getDiagnostics(id),
    update: (dt, timestamp, context) => runtime.update(dt, timestamp, context), setLabTab: (tab) => runtime.setLabTab(tab),
    get activeLabTab() { return runtime.activeLabTab; }, get instance() { return runtime; }, dispose: () => runtime.dispose()
  });
  A.CharacterRuntimeV3 = CharacterRuntimeV3;
  root.HHAstraCharacterRuntimeV3 = facade;
  if (typeof module !== "undefined" && module.exports) module.exports = { CharacterRuntimeV3, facade };
})(typeof window !== "undefined" ? window : globalThis);
