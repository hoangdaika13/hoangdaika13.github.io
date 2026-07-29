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

test("Character V13 Hero Prime is the only release selected by the game route and offline catalog", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");

  assert.match(source, /CHARACTER_VISUAL_VERSION\s*=\s*13/);
  for (const asset of ["astral-realms.css?v=40", "astral-realms.js?v=40"]) {
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

test("GLB inspection has decoded-asset budgets and cannot replace the canonical Hero Prime", () => {
  const limitsStart = source.indexOf("const CHARACTER_IMPORT_LIMITS");
  const limitsEnd = source.indexOf("const HH_HUMANOID_SKELETON", limitsStart);
  assert.ok(limitsStart >= 0 && limitsEnd > limitsStart, "missing CHARACTER_IMPORT_LIMITS contract");
  const limits = source.slice(limitsStart, limitsEnd);

  for (const budget of ["file", "triangles", "bones", "morph", "texture", "animation", "nodes"]) {
    assert.match(limits, new RegExp(budget, "i"), `missing ${budget} import budget`);
  }
  assert.match(source, /buildCharacterQaReport\s*\(/);
  assert.match(source, /validateCharacterAsset\s*\(/);

  const importBody = between("    async importCharacterGLB(file) {", "    async toggleFacePilot()");
  const parseAt = importBody.indexOf("loader.parse");
  const validateAt = importBody.indexOf("validateCharacterAsset");
  assert.ok(parseAt >= 0, "GLB must be parsed locally");
  assert.ok(validateAt > parseAt, "decoded GLB must be validated after parsing");
  assert.doesNotMatch(
    importBody,
    /installImportedCharacter\s*\(/,
    "local GLB inspection must not replace the one canonical player model"
  );
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
  const importBody = between("    async importCharacterGLB(file) {", "    async toggleFacePilot()");
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

test("the portrait atlas remains UI-only and never enters the player geometry pipeline", () => {
  const atlasPath = path.join(root, "assets", "astral-realms", "astral-crew-atlas-v2.webp");
  const atlas = fs.readFileSync(atlasPath);
  const worker = read("sw.js");
  const heroFactory = between("    createBuiltInRiggedCharacter(profile, scale = 1) {", "    characterTrackTargetsRoot(");

  assert.doesNotMatch(source, /createCharacterImpostor|isCharacterImpostor/);
  assert.doesNotMatch(heroFactory, /astral-crew-atlas|portrait|SpriteMaterial/);
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

test("Hero Prime is the only character tier and stays at facial 60 Hz at every distance", () => {
  const tierBody = between("  const CHARACTER_MODEL_TIERS = Object.freeze({", "  const CHARACTER_ASSET_CLASSES");
  const lodBody = between("    updateCharacterLod(mesh, distance = 0) {", "    disposeCharacterObject(");
  const facePilotBody = between("    updateFacePilotFrame() {", "    stopFacePilot() {");

  assert.match(tierBody, /hero:\s*\{[^}]*face:\s*52[^}]*updateHz:\s*60/);
  assert.doesNotMatch(tierBody, /\bnear\b|\bcrowd\b|\bimpostor\b/);
  assert.match(lodBody, /const tier\s*=\s*"hero"/);
  assert.match(lodBody, /runtime\.updateHz\s*=\s*CHARACTER_MODEL_TIERS\.hero\.updateHz/);
  assert.match(lodBody, /runtime\.faceChannelBudget\s*=\s*CHARACTER_MODEL_TIERS\.hero\.face/);
  assert.doesNotMatch(lodBody, /\bnear\b|\bcrowd\b|\bimpostor\b|morphTargetInfluences\.fill\(0\)/);
  assert.doesNotMatch(facePilotBody, /\["crowd",\s*"impostor"\]|faceTier/);
  assert.match(facePilotBody, /this\.visible\s*&&\s*canDetectFace[\s\S]{0,700}detectForVideo/);
});

test("inspected GLB cannot create a player proxy or secondary LOD hierarchy", () => {
  const inspectBody = between("    async importCharacterGLB(file) {", "    async toggleFacePilot()");
  assert.doesNotMatch(
    inspectBody,
    /installImportedCharacter|Imported3DProxy|isCharacterLodProxy|createCharacterMesh\s*\(|explicitLods|nearestExplicitLod|\bnear\b|\bcrowd\b|\bimpostor\b/,
    "an inspected GLB must never introduce fallback geometry into the player pipeline"
  );
  assert.match(inspectBody, /disposeCharacterObject\(inspectedScene\)/);
});

test("Hero Prime attachments remain visible and are never hidden by distance", () => {
  const actorsBody = between("    createActors() {", "    createEnemy(");
  const lodBody = between("    updateCharacterLod(mesh, distance = 0) {", "    disposeCharacterObject(");

  assert.match(actorsBody, /lodVariants\.attachments\s*=\s*\[weapon\]/);
  assert.match(lodBody, /lodVariants\.attachments/);
  assert.match(lodBody, /lodVariants\.attachments[^\n]+object\.visible\s*=\s*true/);
  assert.doesNotMatch(lodBody, /tier\s*!==\s*"impostor"|distance\s*[<>]=?/);
});

test("Hero Prime load failure blocks startup and exposes Retry without a model substitute", () => {
  const loadBody = between("    async loadCharacterAssetsFromPipeline() {", "    sanitizeBuiltInCharacterAsset(gltf) {");
  const startBody = between("    async startGame({ fresh = false } = {}) {", "    beginRuntimeSession(");
  const heroFactory = between("    createBuiltInRiggedCharacter(profile, scale = 1) {", "    characterTrackTargetsRoot(");

  assert.match(loadBody, /loader\.loadAsync\(HERO_CHARACTER_ASSET_URL\)/);
  assert.match(loadBody, /throw new Error\(/);
  assert.doesNotMatch(loadBody, /Promise\.allSettled|resolveCharacterAssetCandidates|createAnimeCharacterMesh|createCharacterMesh/);
  assert.ok(
    startBody.indexOf("await this.loadCharacterAssetsFromPipeline()") < startBody.indexOf("this.createActors()"),
    "the canonical Hero must finish loading before any player actor is created"
  );
  assert.match(startBody, /catch \(error\)[\s\S]{0,900}recovery\.hidden\s*=\s*false/);
  assert.match(source, /data-har-retry/);
  assert.match(source, /closest\("\[data-har-retry\]"\)[^\n]+startGame\(\{ fresh: false \}\)/);
  assert.doesNotMatch(heroFactory, /createAnimeCharacterMesh|createCharacterMesh|crowdProxy|Imported3DProxy/);
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

test("Hero Prime badge requires coverage plus detected hips and head bones", () => {
  const creatorBody = between("    renderCharacterCreatorPanel() {", "    renderWorldPanel() {");

  assert.match(creatorBody, /qa\?\.skinnedMeshes/);
  assert.match(creatorBody, /skeletonCoverage\s*\|\|\s*0\)\s*>=\s*0\.55/);
  assert.match(creatorBody, /runtime\?\.bones\?\.hips/);
  assert.match(creatorBody, /runtime\?\.bones\?\.head/);
  assert.match(creatorBody, /trulyRigged\s*\?\s*"HERO PRIME"/);
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

test("Hero Prime footprint cadence is independent of optional body-part handles", () => {
  const animationBody = between("    updateCharacterAnimation(dt, time, input, sprinting) {", "    togglePhotoMode(");
  const cadenceAt = animationBody.indexOf("const cadence");
  const footprintAt = animationBody.indexOf("this.emitFootprint(time)");
  const partsGuardAt = animationBody.indexOf("parts?.leftLeg");

  assert.ok(cadenceAt >= 0);
  assert.ok(footprintAt > cadenceAt, "foot contacts must derive from the shared gait phase");
  assert.ok(
    partsGuardAt > footprintAt,
    "the canonical Hero must emit cadence footprints even without optional limb handles"
  );
  assert.doesNotMatch(animationBody, /modelTier\s*===\s*"(?:near|crowd|impostor)"/);
  assert.match(animationBody, /Math\.sign\(previousPhase\)\s*!==\s*Math\.sign\(phase\)/);
});

test("remote-player cleanup is complete and new remotes clone the canonical Hero Prime", () => {
  const disposeBody = between("    disposeRemotePlayer(", "    async leaveParty()");
  const leaveBody = between("    async leaveParty() {", "    async sendPartyChat(");
  const snapshotBody = between("    applyAuthoritativeSnapshot(payload) {", "    updateConnectionUi() {");
  const factoryBody = between("    createBuiltInRiggedCharacter(profile, scale = 1) {", "    characterTrackTargetsRoot(");

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
  assert.match(factoryBody, /const modelId\s*=\s*HERO_CHARACTER_MODEL_ID/);
  assert.match(factoryBody, /this\.builtInCharacterAssets\.get\(modelId\)/);
  assert.doesNotMatch(factoryBody, /fallbackModelId|crowdProxy|Imported3DProxy/);
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

test("remote players remain on Hero Prime with an active mixer at every distance", () => {
  const worldBody = between("    updateWorld(dt, time) {", "    updateWorldStreaming() {");
  const lodBody = between("    updateCharacterLod(mesh, distance = 0) {", "    disposeCharacterObject(");
  const distanceAt = worldBody.indexOf("const playerDistance");
  const lodAt = worldBody.indexOf("this.updateCharacterLod(remote, playerDistance)");
  const mixerAt = worldBody.indexOf("if (runtime?.mixer)");
  const limbsAt = worldBody.indexOf("if (parts?.leftLeg && parts?.rightLeg)");

  assert.ok(distanceAt >= 0);
  assert.ok(lodAt > distanceAt, "remote Hero state must be refreshed after resolving distance");
  assert.ok(mixerAt > lodAt, "remote mixer must run after Hero state is locked");
  assert.ok(limbsAt > mixerAt, "optional limb work must run only after the canonical mixer update");
  assert.match(lodBody, /runtime\.updateHz\s*=\s*CHARACTER_MODEL_TIERS\.hero\.updateHz/);
  assert.doesNotMatch(lodBody, /\bnear\b|\bcrowd\b|\bimpostor\b|distance\s*[<>]=?/);
});
