const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("astral-realms.js");

function between(startToken, endToken) {
  const start = source.indexOf(startToken);
  assert.notEqual(start, -1, `missing ${startToken}`);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.notEqual(end, -1, `missing ${endToken} after ${startToken}`);
  return source.slice(start, end);
}

test("Character V14 is the only release selected by the game route and offline catalog", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");

  assert.match(source, /CHARACTER_VISUAL_VERSION\s*=\s*14/);
  for (const asset of ["astral-realms.css?v=76", "astral-realms.js?v=88"]) {
    assert.ok(loader.includes(asset), `route loader missing ${asset}`);
    assert.ok(worker.includes(asset), `service worker missing ${asset}`);
  }
});

test("motion fallback terminates without an idle clip and initial idle starts an action", () => {
  const findClip = between("    findCharacterClip(runtime, state) {", "    playCharacterClip(runtime, state) {");
  const playClip = between("    playCharacterClip(runtime, state) {", "    setCharacterAction(");
  const oneShotReturnAt = findClip.indexOf("return null;", findClip.indexOf('["jump", "land", "dodge"'));
  const genericFallbackAt = findClip.indexOf("runtime.clips.values().next().value");

  assert.doesNotMatch(
    findClip,
    /return\s+this\.findCharacterClip\(runtime,\s*"idle"\)\s*\|\|/,
    "idle fallback must not recursively call itself"
  );
  assert.match(
    findClip,
    /state\s*!==\s*"idle"|state\s*===\s*"idle"/,
    "idle fallback needs an explicit terminal guard"
  );
  assert.match(
    playClip,
    /runtime\.state\s*===\s*state\s*&&\s*runtime\.currentAction/,
    "same-state early return is only valid after an action has started"
  );
  assert.doesNotMatch(
    playClip,
    /\|\|\s*runtime\.state\s*===\s*state\s*\)\s*return/,
    "initial idle must not be skipped merely because the state label is already idle"
  );
  assert.ok(oneShotReturnAt >= 0, "a missing one-shot clip must not substitute an unrelated animation");
  assert.ok(genericFallbackAt > oneShotReturnAt, "one-shot null return must run before the generic clip fallback");
  for (const state of ["jump", "land", "dodge", "attack1", "attack2", "attack3", "skill", "ultimate", "hit", "defeated"]) {
    assert.ok(
      findClip.slice(0, oneShotReturnAt).includes(`"${state}"`),
      `missing one-shot guard for ${state}`
    );
  }
});

test("one-shot clips fit their duration to the requested action window", () => {
  const playClip = between("    playCharacterClip(runtime, state) {", "    setCharacterAction(");
  const oneShotAt = playClip.indexOf("const oneShot");
  const actionWindowAt = playClip.indexOf("const actionWindowSeconds");
  const fittedAt = playClip.indexOf("const fittedTimeScale");
  const applyAt = playClip.indexOf("setEffectiveTimeScale(fittedTimeScale)");

  assert.ok(oneShotAt >= 0 && actionWindowAt > oneShotAt);
  assert.ok(fittedAt > actionWindowAt && applyAt > fittedAt);
  assert.match(playClip, /this\.characterAction\?\.name\s*===\s*state/);
  assert.match(playClip, /this\.characterAction\.duration\s*\/\s*1000/);
  assert.match(playClip, /oneShot\s*&&\s*actionWindowSeconds\s*&&\s*Number\.isFinite\(clip\.duration\)/);
  assert.match(playClip, /clip\.duration\s*\/\s*actionWindowSeconds/);
  assert.match(playClip, /runtime\.actionTimeScale\s*=\s*fittedTimeScale/);
});

test("GLB import has decoded-asset budgets, QA reporting and validation before installation", () => {
  const limitsStart = source.indexOf("const CHARACTER_IMPORT_LIMITS");
  const limitsEnd = source.indexOf("const HH_HUMANOID_SKELETON", limitsStart);
  assert.ok(limitsStart >= 0 && limitsEnd > limitsStart, "missing CHARACTER_IMPORT_LIMITS contract");
  const limits = source.slice(limitsStart, limitsEnd);

  for (const budget of ["file", "triangles", "bones", "morph", "texture", "animation", "nodes"]) {
    assert.match(limits, new RegExp(budget, "i"), `missing ${budget} import budget`);
  }
  assert.match(source, /buildCharacterQaReport\s*\(/);
  assert.match(source, /validateCharacterAsset\s*\(/);

  const importBody = between("    async importCharacterGLB(file) {", "    installImportedCharacter(");
  const parseAt = importBody.indexOf("loader.parse");
  const validateAt = importBody.indexOf("validateCharacterAsset");
  const installAt = importBody.indexOf("installImportedCharacter");
  assert.ok(parseAt >= 0, "GLB must be parsed locally");
  assert.ok(validateAt > parseAt, "decoded GLB must be validated after parsing");
  assert.ok(installAt > validateAt, "invalid GLB must be rejected before scene installation");
});

test("texture QA and disposal cover physical, lighting and environment map slots", () => {
  const qaBody = between("    buildCharacterQaReport(", "    registerCharacterRuntime(");
  const disposeBody = between("    disposeCharacterObject(", "    async importCharacterGLB(file) {");

  for (const slot of ["envMap", "lightMap", "thicknessMap", "iridescenceMap", "anisotropyMap"]) {
    assert.match(qaBody, new RegExp(`"${slot}"`), `Character QA missing ${slot}`);
    assert.match(disposeBody, new RegExp(`"${slot}"`), `character disposal missing ${slot}`);
  }
});

test("GLTF support remains required while optional compression decoders fail independently", () => {
  const modulesBody = between("    async loadCharacterModules() {", "    createTerrainTexture() {");
  const requiredGltfAt = modulesBody.indexOf('await import("./vendor/addons/loaders/GLTFLoader.js")');
  const settledAt = modulesBody.indexOf("Promise.allSettled([");
  const settledEnd = modulesBody.indexOf("]);", settledAt);
  const optionalImports = modulesBody.slice(settledAt, settledEnd);

  assert.ok(requiredGltfAt >= 0, "GLTFLoader must be loaded as the required character parser");
  assert.ok(settledAt > requiredGltfAt, "optional decoders should load only after required GLTFLoader");
  assert.doesNotMatch(optionalImports, /GLTFLoader/, "GLTFLoader must not be downgraded to an optional decoder");
  for (const decoder of ["DRACOLoader", "KTX2Loader", "meshopt_decoder"]) {
    assert.match(optionalImports, new RegExp(decoder), `optional decoder group missing ${decoder}`);
  }
  assert.match(modulesBody, /draco\.status\s*===\s*"fulfilled"/);
  assert.match(modulesBody, /ktx2\.status\s*===\s*"fulfilled"/);
  assert.match(modulesBody, /meshopt\.status\s*===\s*"fulfilled"/);
});

test("KTX2 transcoding detects renderer support before the GLB is parsed", () => {
  const importBody = between("    async importCharacterGLB(file) {", "    installImportedCharacter(");
  const createAt = importBody.indexOf("new this.KTX2LoaderClass()");
  const detectAt = importBody.indexOf("ktx2Loader.detectSupport(this.renderer)");
  const attachAt = importBody.indexOf("loader.setKTX2Loader(ktx2Loader)");
  const parseAt = importBody.indexOf("loader.parse");

  assert.match(importBody, /this\.KTX2LoaderClass\s*&&\s*this\.renderer/);
  assert.ok(createAt >= 0, "KTX2 loader must be instantiated when available");
  assert.ok(detectAt > createAt, "KTX2 support detection must use the active renderer");
  assert.ok(attachAt > detectAt, "KTX2 loader must be attached after support detection");
  assert.ok(parseAt > attachAt, "compressed textures must be configured before GLB parsing");
});

test("both CSP layers permit the explicit MediaPipe Face Pilot runtime", () => {
  for (const file of ["index.html", "vercel.json"]) {
    const policy = read(file);
    assert.match(
      policy,
      /script-src[^;"]*'wasm-unsafe-eval'/,
      `${file} must permit WebAssembly used by MediaPipe`
    );
    assert.match(
      policy,
      /script-src[^;"]*https:\/\/cdn\.jsdelivr\.net/,
      `${file} must permit the pinned MediaPipe module origin`
    );
  }
});

test("the portrait atlas remains a valid UI-only asset", () => {
  const atlasPath = path.join(root, "assets", "astral-realms", "astral-crew-atlas-v2.webp");
  const atlas = fs.readFileSync(atlasPath);
  const worker = read("sw.js");
  const manifest = read("assets/astral-realms/manifest.json");

  assert.match(manifest, /astral-crew-atlas-v2\.webp/);
  assert.match(manifest, /used only by interface cards/);
  assert.doesNotMatch(source, /createCharacterImpostor|isCharacterImpostor/);
  assert.ok(atlas.length > 1_000, "atlas v2 must not be an empty placeholder");
  assert.equal(atlas.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(atlas.subarray(8, 12).toString("ascii"), "WEBP");
  assert.match(worker, /assets\/astral-realms\/astral-crew-atlas-v2\.webp/);
});

test("hair-card alphaMap stores its opacity mask in RGB including the green channel", () => {
  const textureBody = between("    createCharacterDetailTexture(kind = \"skin\") {", "    createAnimeCharacterMesh(");
  const hairBranchStart = textureBody.indexOf('kind === "hair-alpha"');
  const hairBranchEnd = textureBody.indexOf("continue;", hairBranchStart);
  const hairBranch = textureBody.slice(hairBranchStart, hairBranchEnd);

  assert.ok(hairBranchStart >= 0 && hairBranchEnd > hairBranchStart, "missing hair alpha texture branch");
  assert.match(hairBranch, /image\.data\[offset\s*\+\s*1\]\s*=/, "Three.js alphaMap samples the green channel");
  assert.match(hairBranch, /image\.data\[offset\s*\+\s*3\]\s*=\s*255/, "mask texture itself must remain opaque");
  assert.match(source, /\.alphaMap\s*=\s*this\.createCharacterDetailTexture\("hair-alpha"\)/);
  assert.match(textureBody, /kind\s*===\s*"hair-alpha"[\s\S]{0,180}\?\s*this\.THREE\.NoColorSpace/);
});

test("LOD changes select real variants and a distant 3D proxy instead of changing labels only", () => {
  const lodBody = between("    updateCharacterLod(mesh, distance = 0) {", "    async importCharacterGLB(file) {");

  assert.match(source, /createCharacterMesh\(\{ body: profile\.body, accent: profile\.accent/);
  assert.match(source, /Imported3DProxy/);
  assert.doesNotMatch(source, /createCharacterImpostor|isCharacterImpostor/);
  assert.match(source, /lodVariants/);
  assert.match(lodBody, /lodVariants/);
  assert.match(lodBody, /\.visible\s*=/);
  assert.match(lodBody, /impostor/);
  assert.match(source, /proxy3d\.userData\.isCharacterLodProxy\s*=\s*true/);
});

test("low LOD always suspends animation, zeros morphs and prevents Face Pilot inference", () => {
  const lodBody = between("    updateCharacterLod(mesh, distance = 0) {", "    disposeCharacterObject(");
  const facePilotBody = between("    updateFacePilotFrame() {", "    stopFacePilot() {");
  const lowTierAt = lodBody.indexOf('["crowd", "impostor"].includes(tier)');
  const suspendAt = lodBody.indexOf("runtime.lodSuspended = lowDetailTier");
  const zeroMorphAt = lodBody.indexOf("object.morphTargetInfluences.fill(0)");
  const sameTierReturnAt = lodBody.indexOf("if (mesh.userData.modelTier === tier) return");

  assert.ok(lowTierAt >= 0);
  assert.ok(suspendAt > lowTierAt, "low tier must suspend its mixer runtime");
  assert.ok(zeroMorphAt > suspendAt, "low tier must clear facial/appearance morph work");
  assert.ok(
    sameTierReturnAt > zeroMorphAt,
    "suspension and morph clearing must still run when the tier label has not changed"
  );
  assert.match(facePilotBody, /!\["crowd",\s*"impostor"\]\.includes\(faceTier\)/);
  assert.match(facePilotBody, /this\.visible\s*&&\s*canDetectFace[\s\S]{0,700}detectForVideo/);
});

test("imported explicit LOD starts with an unset tier and is actively initialized", () => {
  const installBody = between("    installImportedCharacter(", "    async toggleFacePilot()");
  const unsetTierAt = installBody.indexOf('modelTier: ""');
  const variantsAt = installBody.indexOf("wrapper.userData.lodVariants =");
  const runtimeAt = installBody.indexOf("this.registerCharacterRuntime(wrapper");
  const updateAt = installBody.indexOf("this.updateCharacterLod(wrapper, 0)");

  assert.ok(unsetTierAt >= 0, "imported wrapper must not claim hero before its variants are initialized");
  assert.doesNotMatch(installBody, /modelTier:\s*"hero"/);
  assert.ok(variantsAt > unsetTierAt, "explicit LOD variants must be attached to the imported wrapper");
  assert.ok(runtimeAt > variantsAt, "runtime must observe the imported LOD variants");
  assert.ok(updateAt > runtimeAt, "first LOD selection must run after runtime registration");
});

test("missing imported LOD levels reuse the nearest explicit tier, not the complete mesh set", () => {
  const installBody = between("    installImportedCharacter(", "    async toggleFacePilot()");
  const nearestStart = installBody.indexOf("const nearestExplicitLod");
  const variantsStart = installBody.indexOf("wrapper.userData.lodVariants =");
  const nearestBody = installBody.slice(nearestStart, variantsStart);
  const variantsBody = installBody.slice(variantsStart, installBody.indexOf("this.world.add(wrapper)", variantsStart));

  assert.ok(nearestStart >= 0, "imported LOD needs a nearest-tier resolver");
  assert.match(nearestBody, /if\s*\(!hasExplicitLods\)\s*return\s+importedMeshes/);
  assert.match(nearestBody, /Math\.abs\(candidateIndex\s*-\s*tierIndex\)/);
  assert.match(nearestBody, /explicitLods\[nearestTier\.candidate\]/);
  for (const tier of ["hero", "near", "crowd"]) {
    assert.match(
      variantsBody,
      new RegExp(`${tier}:\\s*explicitLods\\.${tier}\\.length\\s*\\?\\s*explicitLods\\.${tier}\\s*:\\s*nearestExplicitLod\\("${tier}"\\)`),
      `missing ${tier} must select its nearest explicit LOD`
    );
  }
});

test("built-in weapons are registered as LOD attachments and hidden for impostors", () => {
  const actorsBody = between("    createActors() {", "    createEnemy(");
  const lodBody = between("    updateCharacterLod(mesh, distance = 0) {", "    disposeCharacterObject(");

  assert.match(actorsBody, /lodVariants\.attachments\s*=\s*\[weapon\]/);
  assert.match(lodBody, /lodVariants\.attachments/);
  assert.match(lodBody, /object\.visible\s*=\s*tier\s*!==\s*"impostor"/);
});

test("facial animation reuses a cached morph lookup on every frame", () => {
  const faceBody = between("    applyFaceBlendshapes(mesh, values = {}) {", "    applyProceduralFacialPerformance(");

  assert.match(source, /morphLookup/);
  assert.match(faceBody, /morphLookup/);
  assert.doesNotMatch(
    faceBody,
    /Object\.fromEntries\s*\(\s*Object\.entries\s*\(\s*dictionary\s*\)/,
    "the lowercase morph dictionary must not be rebuilt every animation frame"
  );
});

test("disabling face, eye or surface systems immediately resets their runtime state", () => {
  const settingsBody = between('        } else if (event.target.matches("[data-setting]")) {', "      const setSelect =");
  const resetFaceBody = between("    resetCharacterFace(", "    applyProceduralFacialPerformance(");

  assert.match(settingsBody, /key\s*===\s*"facialAnimation"\s*&&\s*value\s*===\s*false[\s\S]{0,420}resetCharacterFace/);
  assert.match(settingsBody, /key\s*===\s*"eyePerformance"\s*&&\s*value\s*===\s*false[\s\S]{0,260}resetCharacterFace/);
  assert.match(settingsBody, /key\s*===\s*"surfaceFx"\s*&&\s*value\s*===\s*false[\s\S]{0,260}restoreCharacterMaterialState/);
  assert.match(resetFaceBody, /morphTargetInfluences|influences/);
  assert.match(resetFaceBody, /eyelids/);
  assert.match(resetFaceBody, /iris/);
  assert.match(resetFaceBody, /pupil/);
});

test("RIGGED GLB badge requires coverage plus detected hips and head bones", () => {
  const creatorBody = between("    renderCharacterCreatorPanel() {", "    renderWorldPanel() {");

  assert.match(creatorBody, /qa\?\.skinnedMeshes/);
  assert.match(creatorBody, /skeletonCoverage\s*\|\|\s*0\)\s*>=\s*0\.55/);
  assert.match(creatorBody, /runtime\?\.bones\?\.hips/);
  assert.match(creatorBody, /runtime\?\.bones\?\.head/);
  assert.match(creatorBody, /trulyRigged\s*\?\s*"RIGGED GLB"/);
});

test("weather material state is reversible and character disposal releases GPU resources", () => {
  const restoreBody = between("    restoreCharacterMaterialState(", "    updateCharacterSurface(mesh, time) {");
  const surfaceBody = between("    updateCharacterSurface(mesh, time) {", "    updateCharacterLod(mesh, distance = 0) {");
  const disposeCalls = source.match(/this\.disposeCharacterObject\s*\(/g) || [];

  assert.match(source, /restoreCharacterMaterialState\s*\(/);
  assert.match(surfaceBody, /restoreCharacterMaterialState/);
  for (const property of ["roughness", "clearcoat", "emissiveIntensity"]) {
    assert.match(restoreBody, new RegExp(property), `material restoration missing ${property}`);
  }

  assert.match(source, /disposeCharacterObject\s*\(/);
  assert.ok(disposeCalls.length >= 2, "replacement and teardown must share character disposal");
  const disposeStart = source.indexOf("    disposeCharacterObject(");
  assert.notEqual(disposeStart, -1);
  const disposeBody = source.slice(disposeStart, disposeStart + 5000);
  assert.match(disposeBody, /isTexture|normalMap|roughnessMap|metalnessMap/);
  assert.match(disposeBody, /\.dispose(?:\?\.)?\s*\(/);
  assert.match(disposeBody, /stopAllAction|uncacheRoot/);
});

test("movement animation guards optional imported-GLB and NPC body parts", () => {
  const playerBody = between("    updatePlayer(dt, time) {", "    updateEnemies(dt, time) {");
  const livingWorldBody = between("    updateLivingWorld(dt, time) {", "    addWorldLabel(");

  assert.match(playerBody, /userData\?\.parts|userData\.parts\?/);
  assert.match(playerBody, /legs\?\.leftLeg/);
  assert.match(playerBody, /legs\?\.rightLeg/);

  for (const part of ["leftLeg", "rightLeg", "leftArm", "rightArm"]) {
    assert.match(
      livingWorldBody,
      new RegExp(`\\?\\.${part}`),
      `NPC movement must guard optional ${part}`
    );
  }
});

test("footprint cadence is independent of procedural body-part availability", () => {
  const animationBody = between("    updateCharacterAnimation(dt, time, input, sprinting) {", "    togglePhotoMode(");
  const cadenceAt = animationBody.indexOf("const cadence");
  const footprintAt = animationBody.indexOf("this.emitFootprint(time)");
  const partsGuardAt = animationBody.indexOf("if (!lowDetailTier && parts?.leftLeg");

  assert.ok(cadenceAt >= 0);
  assert.ok(footprintAt > cadenceAt, "foot contacts must derive from the shared gait phase");
  assert.ok(
    partsGuardAt > footprintAt,
    "GLB characters without procedural limb handles must still emit cadence footprints"
  );
  assert.match(animationBody, /Math\.sign\(previousPhase\)\s*!==\s*Math\.sign\(phase\)/);
});

test("remote-player cleanup runs for leave, character changes and stale snapshots", () => {
  const disposeBody = between("    disposeRemotePlayer(", "    async leaveParty()");
  const leaveBody = between("    async leaveParty() {", "    async sendPartyChat(");
  const snapshotBody = between("    applyAuthoritativeSnapshot(payload) {", "    updateConnectionUi() {");

  assert.match(disposeBody, /disposeCharacterObject\(mesh,\s*runtime\)/);
  assert.match(disposeBody, /characterRuntimes\.delete\(runtimeKey\)/);
  assert.match(disposeBody, /remotePlayers\.delete\(id\)/);
  assert.match(leaveBody, /remotePlayers\.entries\(\)[\s\S]{0,180}disposeRemotePlayer\(id,\s*mesh\)/);
  assert.match(
    snapshotBody,
    /mesh\s*&&\s*mesh\.userData\.characterId\s*!==\s*profile\.id[\s\S]{0,180}disposeRemotePlayer\(player\.socketId,\s*mesh\)/,
    "changing a remote character must dispose the old render object and runtime"
  );
  assert.match(
    snapshotBody,
    /!activeRemoteIds\.has\(id\)[\s\S]{0,150}disposeRemotePlayer\(id,\s*mesh\)/,
    "remote players absent from a snapshot must be disposed as stale"
  );
  assert.match(
    snapshotBody,
    /if\s*\(!mesh\)\s*\{[\s\S]{0,180}createPhotorealCharacterModel\(profile,\s*0\.92\)/,
    "new remote players must use the same photoreal character pipeline"
  );
  assert.doesNotMatch(snapshotBody, /createAnimeCharacterMesh\(/);
});

test("lock-on updates character yaw even when movement input is idle", () => {
  const playerBody = between("    updatePlayer(dt, time) {", "    updateEnemies(dt, time) {");
  const inputGuardAt = playerBody.indexOf("if (input.active) {");
  const lockAt = playerBody.indexOf("const lockedEnemy");
  const facingAt = playerBody.indexOf("if (input.active || hasActiveLock)");

  assert.ok(inputGuardAt >= 0 && lockAt > inputGuardAt, "lock state must be evaluated outside movement-only work");
  assert.ok(facingAt > lockAt, "facing update must consider the resolved lock target");
  assert.match(playerBody, /hasActiveLock\s*=\s*Boolean\(lockedEnemy\?\.visible/);
  assert.match(playerBody, /targetRotation\s*=\s*hasActiveLock[\s\S]{0,180}lockedEnemy\.position\.x\s*-\s*player\.x/);
  assert.match(playerBody, /player\.rotation\s*\+=\s*yawDelta/);
  assert.match(playerBody, /playerMesh\.rotation\.y\s*=\s*player\.rotation/);
});

test("remote players apply distance LOD before spending mixer or limb-animation work", () => {
  const worldBody = between("    updateWorld(dt, time) {", "    indexWorldRuntimeObjects() {");
  const distanceAt = worldBody.indexOf("const playerDistance");
  const lodAt = worldBody.indexOf("this.updateCharacterLod(remote, playerDistance)");
  const mixerAt = worldBody.indexOf("runtime?.mixer && !runtime.lodSuspended");
  const limbsAt = worldBody.indexOf("!runtime?.lodSuspended && parts?.leftLeg");

  assert.ok(distanceAt >= 0);
  assert.ok(lodAt > distanceAt, "remote LOD must use actual player distance");
  assert.ok(mixerAt > lodAt, "remote mixer update must respect the newly selected LOD");
  assert.ok(limbsAt > mixerAt, "procedural remote limbs must also remain suspended at low LOD");
});
