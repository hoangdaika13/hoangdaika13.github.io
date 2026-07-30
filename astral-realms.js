(function (root) {
  "use strict";

  const GAME_ID = "astral-realms";
  const SCHEMA_VERSION = 8;
  const STORY_CANON_VERSION = 2;
  const RENDER_SCALE_STEPS = Object.freeze([1, 0.85, 0.7, 0.6]);
  const DB_NAME = "hh-astral-realms";
  const DB_VERSION = 1;
  const STORE_NAME = "saves";
  const STORAGE_FALLBACK = "hh.astral-realms.save.v1";
  const WORLD_LIMIT = 188;
  const COOP_PLAYER_LIMIT = 8;
  const PLAYER_LEVEL_CAP = 80;
  const AUTOSAVE_MS = 15000;
  const ELEMENTS = Object.freeze({
    plasma: { label: "Plasma", short: "PL", color: "#ff68c9" },
    cryo: { label: "Băng tinh", short: "BT", color: "#77d9ff" },
    void: { label: "Hư không", short: "HK", color: "#a17bff" },
    nature: { label: "Thiên nhiên", short: "TN", color: "#6ef2a8" },
    quantum: { label: "Lượng tử", short: "LT", color: "#5feeff" },
    solar: { label: "Nhật quang", short: "NQ", color: "#ffd36b" }
  });
  const CHARACTERS = Object.freeze({
    lyra: {
      id: "lyra", name: "Nax Veyra", role: "Astral Vanguard", element: "plasma", short: "NX",
      body: "#43dfff", accent: "#ff69cc", hair: "#dffbff", eyes: "#63efff",
      attackScale: 1, speedScale: 1, description: "Nữ kiếm sĩ trưởng thành cân bằng, tạo nhịp Plasma liên hoàn."
    },
    cael: {
      id: "cael", name: "Cael Aurora", role: "Cryo Ranger", element: "cryo", short: "CA",
      body: "#5d86ff", accent: "#8ff7ff", hair: "#e5ecff", eyes: "#8aeaff",
      attackScale: 0.92, speedScale: 1.12, description: "Nữ xạ thủ Băng tinh nhanh, kiểm soát mục tiêu từ xa."
    },
    nyx: {
      id: "nyx", name: "Nyx Veyra", role: "Void Dancer", element: "void", short: "NV",
      body: "#6d43b8", accent: "#d66cff", hair: "#27174b", eyes: "#ff7de4",
      attackScale: 1.08, speedScale: 1.06, description: "Nữ võ sĩ Hư không linh hoạt, phản đòn và dịch chuyển."
    },
    sol: {
      id: "sol", name: "Sol Riven", role: "Solar Guardian", element: "solar", short: "SR",
      body: "#d47433", accent: "#ffd96a", hair: "#fff2c4", eyes: "#ffbd58",
      attackScale: 1.18, speedScale: 0.94, description: "Nữ hộ vệ Nhật quang có đòn kiếm nặng và khả năng hồi phục."
    }
  });
  const CHARACTER_ORDER = Object.freeze(Object.keys(CHARACTERS));
  const DEFAULT_CHARACTER_WEAPONS = Object.freeze({
    lyra: "starter-blade",
    cael: "pulse-rifle",
    nyx: "void-gauntlets",
    sol: "starter-blade"
  });
  const CHARACTER_VISUAL_VERSION = 13;
  const CHARACTER_MODEL_TIERS = Object.freeze({
    hero: { label: "Web Hero LOD0", triangles: "Face 18–28K · body 25–40K", texture: "2K", face: 52, distance: 13, updateHz: 60 },
    near: { label: "Gameplay LOD1", triangles: "Face 8–14K · body 10–18K", texture: "1K", face: 52, distance: 34, updateHz: 30 },
    crowd: { label: "Crowd LOD2", triangles: "Tổng 6–12K", texture: "512", face: 0, distance: 76, updateHz: 12 },
    impostor: { label: "3D Proxy LOD3", triangles: "3–6K / proxy", texture: "Material PBR", face: 0, distance: 140, updateHz: 6 }
  });
  const CHARACTER_IMPORT_LIMITS = Object.freeze({
    fileBytes: 32 * 1024 * 1024,
    triangles: 120000,
    bones: 160,
    morphTargets: 180,
    textureSize: 4096,
    textures: 64,
    animations: 80,
    animationSeconds: 600,
    nodes: 2500,
    materials: 120
  });
  const CINEMATIC_CAMERA = Object.freeze({
    sensorWidthMm: 36,
    sensorHeightMm: 24,
    focalLengthMm: 40,
    verticalFovDeg: (2 * Math.atan(24 / (2 * 40)) * 180) / Math.PI,
    aperture: 4.8,
    shutterAngle: 180,
    shutterSpeed: "1/48",
    iso: 640
  });
  const HH_HUMANOID_SKELETON = Object.freeze({
    root: ["Root", "Armature", "rootbone"],
    hips: ["Hips", "mixamorigHips", "pelvis", "spine_root"],
    spine: ["Spine", "mixamorigSpine", "spine_01"],
    chest: ["Chest", "mixamorigSpine2", "upperChest", "spine_03"],
    neck: ["Neck", "mixamorigNeck", "neck_01"],
    head: ["Head", "mixamorigHead", "head_01"],
    jaw: ["Jaw", "mixamorigJaw", "jaw_01"],
    leftEye: ["LeftEye", "eye.L", "mixamorigLeftEye", "eye_l"],
    rightEye: ["RightEye", "eye.R", "mixamorigRightEye", "eye_r"],
    leftHand: ["LeftHand", "hand.L", "mixamorigLeftHand", "hand_l"],
    rightHand: ["RightHand", "hand.R", "mixamorigRightHand", "hand_r"],
    leftShoulder: ["LeftShoulder", "shoulder.L", "mixamorigLeftShoulder", "clavicle_l"],
    rightShoulder: ["RightShoulder", "shoulder.R", "mixamorigRightShoulder", "clavicle_r"],
    leftUpperArm: ["LeftArm", "upper_arm.L", "mixamorigLeftArm", "upperarm_l"],
    rightUpperArm: ["RightArm", "upper_arm.R", "mixamorigRightArm", "upperarm_r"],
    leftForeArm: ["LeftForeArm", "forearm.L", "mixamorigLeftForeArm", "lowerarm_l"],
    rightForeArm: ["RightForeArm", "forearm.R", "mixamorigRightForeArm", "lowerarm_r"],
    leftUpLeg: ["LeftUpLeg", "thigh.L", "mixamorigLeftUpLeg", "thigh_l"],
    rightUpLeg: ["RightUpLeg", "thigh.R", "mixamorigRightUpLeg", "thigh_r"],
    leftLeg: ["LeftLeg", "shin.L", "mixamorigLeftLeg", "calf_l"],
    rightLeg: ["RightLeg", "shin.R", "mixamorigRightLeg", "calf_r"],
    leftFoot: ["LeftFoot", "foot.L", "mixamorigLeftFoot", "foot_l"],
    rightFoot: ["RightFoot", "foot.R", "mixamorigRightFoot", "foot_r"],
    leftToe: ["LeftToeBase", "toe.L", "mixamorigLeftToeBase", "ball_l"],
    rightToe: ["RightToeBase", "toe.R", "mixamorigRightToeBase", "ball_r"]
  });
  const CHARACTER_MOTION_LIBRARY = Object.freeze({
    idle: ["idle_relaxed", "idle", "breathing", "stand"],
    walk: ["walk_f", "walk", "walking"],
    run: ["run_f", "run", "jog", "running"],
    sprint: ["sprint_f", "sprint", "fast_run"],
    strafe: ["strafe", "sidestep"],
    jump: ["jump_start", "jump", "takeoff"],
    fall: ["fall_loop", "jump_loop", "fall", "air"],
    land: ["land_soft", "land", "landing"],
    glide: ["glide", "fly"],
    swim: ["swim"],
    climb: ["climb", "ladder"],
    dodge: ["dodge_f", "dodge", "roll", "evade"],
    attack1: ["attack_1", "attack1", "slash"],
    attack2: ["attack_2", "attack2", "combo"],
    attack3: ["attack_3", "attack3", "heavy"],
    swordSkill: ["sword_skill", "skill", "attack_3", "heavy"],
    swordUltimate: ["sword_ultimate", "ultimate", "special"],
    rifleShot: ["rifle_shot", "shoot", "fire", "attack_1"],
    rifleBurst: ["rifle_burst", "shoot_burst", "attack_2"],
    rifleSkill: ["rifle_skill", "aim_fire", "skill"],
    rifleUltimate: ["rifle_ultimate", "ultimate", "special"],
    punch1: ["punch_1", "punch", "attack_1"],
    punch2: ["punch_2", "jab", "attack_2"],
    kick1: ["kick_1", "kick", "attack_3"],
    martialSkill: ["martial_skill", "counter", "skill"],
    martialUltimate: ["martial_ultimate", "ultimate", "special"],
    skill: ["skill", "cast"],
    ultimate: ["ultimate", "special"],
    hit: ["hit_f", "hit", "damage", "impact"],
    defeated: ["knockdown_f", "death", "defeated", "knockdown"],
    talk: ["idle_talk", "talk", "conversation", "gesture"]
  });
  const MEDIAPIPE_FACE_CHANNELS = Object.freeze([
    "_neutral", "browDownLeft", "browDownRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight",
    "cheekPuff", "cheekSquintLeft", "cheekSquintRight", "eyeBlinkLeft", "eyeBlinkRight", "eyeLookDownLeft",
    "eyeLookDownRight", "eyeLookInLeft", "eyeLookInRight", "eyeLookOutLeft", "eyeLookOutRight", "eyeLookUpLeft",
    "eyeLookUpRight", "eyeSquintLeft", "eyeSquintRight", "eyeWideLeft", "eyeWideRight", "jawForward", "jawLeft",
    "jawOpen", "jawRight", "mouthClose", "mouthDimpleLeft", "mouthDimpleRight", "mouthFrownLeft", "mouthFrownRight",
    "mouthFunnel", "mouthLeft", "mouthLowerDownLeft", "mouthLowerDownRight", "mouthPressLeft", "mouthPressRight",
    "mouthPucker", "mouthRight", "mouthRollLower", "mouthRollUpper", "mouthShrugLower", "mouthShrugUpper",
    "mouthSmileLeft", "mouthSmileRight", "mouthStretchLeft", "mouthStretchRight", "mouthUpperUpLeft",
    "mouthUpperUpRight", "noseSneerLeft", "noseSneerRight"
  ]);
  // VALID/MakeHuman-style exports do not always use ARKit names. Keep the
  // public 52-channel driver stable, then resolve it to each model's native
  // morph vocabulary at runtime. This makes blinking, emotion and visemes
  // work without rewriting or duplicating the source GLB.
  const FACIAL_MORPH_ALIASES = Object.freeze({
    browDownLeft: ["LbrowDown_h", "LLbrowDown_h"],
    browDownRight: ["RbrowDown_h", "RRbrowDown_h"],
    browInnerUp: ["LbrowUp_h", "RbrowUp_h"],
    browOuterUpLeft: ["LLbrowUp_h"],
    browOuterUpRight: ["RRbrowUp_h"],
    cheekPuff: ["Chew_h"],
    cheekSquintLeft: ["Lsquint_h"],
    cheekSquintRight: ["Rsquint_h"],
    eyeBlinkLeft: ["LeyeClose_h"],
    eyeBlinkRight: ["ReyeClose_h"],
    eyeSquintLeft: ["Lsquint_h", "LlowLid_h"],
    eyeSquintRight: ["Rsquint_h", "RlowLid_h"],
    eyeWideLeft: ["LeyeOpen_h"],
    eyeWideRight: ["ReyeOpen_h"],
    jawForward: ["JawFront_h"],
    jawLeft: ["Ljaw_h"],
    jawOpen: ["MouthOpen_h", "Shout_h", "Chew_h"],
    jawRight: ["Rjaw_h"],
    mouthClose: ["MPB_Up_h", "MPB_Down_h", "JawCompress_h"],
    mouthDimpleLeft: ["LlipCorner_h"],
    mouthDimpleRight: ["RlipCorner_h"],
    mouthFrownLeft: ["LmouthSad_h", "Lsad_h"],
    mouthFrownRight: ["RmouthSad_h", "Rsad_h"],
    mouthFunnel: ["Lblow_h", "Rblow_h", "AO_a_h", "UH_OO_h"],
    mouthLeft: ["LlipSide_h"],
    mouthLowerDownLeft: ["LlipDown_h"],
    mouthLowerDownRight: ["RlipDown_h"],
    mouthPressLeft: ["MPB_Down_h", "JawCompress_h"],
    mouthPressRight: ["MPB_Up_h", "JawCompress_h"],
    mouthPucker: ["Kiss_h", "UW_U_h"],
    mouthRight: ["RlipSide_h"],
    mouthRollLower: ["MPB_Down_h"],
    mouthRollUpper: ["MPB_Up_h"],
    mouthShrugLower: ["Chin_h"],
    mouthShrugUpper: ["Glotis_h"],
    mouthSmileLeft: ["LsmileClose_h", "LsmileOpen_h"],
    mouthSmileRight: ["RsmileClose_h", "RsmileOpen_h"],
    mouthStretchLeft: ["LlipSide_h", "Ax_E_h", "TD_I_h"],
    mouthStretchRight: ["RlipSide_h", "Ax_E_h", "TD_I_h"],
    mouthUpperUpLeft: ["LlipUp_h"],
    mouthUpperUpRight: ["RlipUp_h"],
    noseSneerLeft: ["Ldisgust_h", "Lnostril_h"],
    noseSneerRight: ["Rdisgust_h", "Rnostril_h"]
  });
  const FACIAL_COMPOUND_ALIASES = Object.freeze({
    browInnerUp: ["LbrowUp_h", "RbrowUp_h"],
    mouthClose: ["MPB_Up_h", "MPB_Down_h"],
    mouthFunnel: ["Lblow_h", "Rblow_h"]
  });
  const CHARACTER_VISEMES = Object.freeze({
    neutral: {},
    A: { jawOpen: 0.72, mouthFunnel: 0.08, mouthStretchLeft: 0.18, mouthStretchRight: 0.18 },
    E: { jawOpen: 0.34, mouthStretchLeft: 0.62, mouthStretchRight: 0.62, mouthSmileLeft: 0.22, mouthSmileRight: 0.22 },
    I: { jawOpen: 0.24, mouthStretchLeft: 0.78, mouthStretchRight: 0.78 },
    O: { jawOpen: 0.46, mouthFunnel: 1, mouthPucker: 0.72 },
    U: { jawOpen: 0.24, mouthFunnel: 0.82, mouthPucker: 0.9 },
    MBP: { mouthClose: 0.92, mouthPressLeft: 0.74, mouthPressRight: 0.74 },
    FV: { mouthLowerDownLeft: 0.22, mouthLowerDownRight: 0.22, mouthPressLeft: 0.44, mouthPressRight: 0.44 },
    L: { jawOpen: 0.38, mouthUpperUpLeft: 0.18, mouthUpperUpRight: 0.18 },
    WQ: { jawOpen: 0.2, mouthFunnel: 0.62, mouthPucker: 0.76 }
  });
  const CHARACTER_EXPRESSION_PRESETS = Object.freeze({
    neutral: {},
    happy: { mouthSmileLeft: 0.72, mouthSmileRight: 0.72, cheekSquintLeft: 0.28, cheekSquintRight: 0.28, browInnerUp: 0.08 },
    sad: { mouthFrownLeft: 0.64, mouthFrownRight: 0.64, browInnerUp: 0.7, eyeSquintLeft: 0.12, eyeSquintRight: 0.12 },
    angry: { browDownLeft: 0.76, browDownRight: 0.76, eyeSquintLeft: 0.32, eyeSquintRight: 0.32, noseSneerLeft: 0.22, noseSneerRight: 0.22 },
    surprised: { eyeWideLeft: 0.7, eyeWideRight: 0.7, browInnerUp: 0.65, browOuterUpLeft: 0.55, browOuterUpRight: 0.55, jawOpen: 0.58 },
    pain: { browDownLeft: 0.72, browDownRight: 0.58, eyeSquintLeft: 0.68, eyeSquintRight: 0.56, mouthFrownLeft: 0.55, mouthFrownRight: 0.42, jawOpen: 0.22 }
  });
  const CHARACTER_PIPELINE = Object.freeze([
    { id: "character-creator", name: "Character Creator 5", role: "Web-ready GLB với morph và material đã bake", state: "Chờ manifest asset" },
    { id: "valid-avatar", name: "VALID Human Library", role: "210 người 3D đa dạng, tải theo nhu cầu", state: "MIT · CDN pin c539a28" },
    { id: "metahuman", name: "MetaHuman Web Hero", role: "GLB đã retopology cho hero/cinematic", state: "Kiểm tra khi nhập" },
    { id: "makehuman", name: "MakeHuman / MPFB", role: "Nguồn NPC được tối ưu bên ngoài", state: "Kiểm tra skeleton" },
    { id: "readyplayerme", name: "Ready Player Me", role: "Avatar GLB do người chơi tạo", state: "Draco/Meshopt/KTX2" },
    { id: "mixamo", name: "Mixamo", role: "Clip locomotion có sẵn trong GLB", state: "Phát clip theo tên" },
    { id: "rokoko", name: "Rokoko Vision", role: "Motion capture xuất GLB", state: "Nhập clip cục bộ" },
    { id: "mediapipe", name: "MediaPipe Face", role: "52 blendshape trên thiết bị", state: "Opt-in camera" },
    { id: "environment", name: "HH Volumetric World", role: "Địa hình mesh 3D và panorama chỉ dùng làm IBL", state: "Không dùng ảnh làm phông nền" },
    { id: "three", name: "Three.js GLTF", role: "GLB rigged, mixer, morph, viseme và 3D LOD", state: "Runtime V13" }
  ]);
  const APPEARANCE_VERSION = 9;
  const APPEARANCE_GROUPS = Object.freeze([
    { id: "face", label: "Khuôn mặt", focus: "head", controls: [["headLength", "Chiều dài đầu"], ["foreheadHeight", "Chiều cao trán"], ["cheekboneWidth", "Gò má"], ["cheekFullness", "Độ đầy má"], ["jawWidth", "Độ rộng hàm"], ["jawAngle", "Góc hàm"], ["chinLength", "Chiều dài cằm"], ["faceFullness", "Độ đầy khuôn mặt"]] },
    { id: "eyes", label: "Mắt", focus: "head", controls: [["eyeSize", "Kích thước mắt"], ["eyeSpacing", "Khoảng cách mắt"], ["eyeDepth", "Độ sâu mắt"], ["upperLid", "Mí trên"], ["lowerLid", "Mí dưới"], ["eyeAngle", "Góc mắt"], ["irisSize", "Kích thước tròng"], ["pupilSize", "Kích thước đồng tử"], ["eyeReflection", "Phản chiếu mắt"], ["eyeLeft", "Mắt trái"], ["eyeRight", "Mắt phải"]] },
    { id: "brows", label: "Lông mày", focus: "head", controls: [["browShape", "Hình dáng"], ["browThickness", "Độ dày"], ["browHeight", "Chiều cao"], ["browAngle", "Góc nghiêng"]] },
    { id: "nose", label: "Mũi", focus: "head", controls: [["noseBridge", "Sống mũi"], ["noseLength", "Chiều dài"], ["noseTip", "Đầu mũi"], ["noseWing", "Cánh mũi"], ["nostrilWidth", "Lỗ mũi"], ["noseProjection", "Độ nhô"], ["noseCurve", "Độ cong"]] },
    { id: "mouth", label: "Miệng", focus: "head", controls: [["mouthWidth", "Độ rộng miệng"], ["upperLip", "Môi trên"], ["lowerLip", "Môi dưới"], ["mouthCorner", "Khóe miệng"], ["mouthProjection", "Độ nhô"], ["teethShape", "Hình răng"], ["teethSize", "Kích thước răng"], ["philtrum", "Nhân trung"], ["smileLine", "Rãnh cười"]] },
    { id: "ears", label: "Tai", focus: "head", controls: [["earSize", "Kích thước tai"], ["earAngle", "Góc tai"], ["earProtrusion", "Độ vểnh"], ["earLobe", "Dái tai"], ["earLeft", "Tai trái"], ["earRight", "Tai phải"]] },
    { id: "shoulders", label: "Cổ & vai", focus: "upper", controls: [["neckLength", "Chiều dài cổ"], ["neckWidth", "Độ rộng cổ"], ["shoulderWidth", "Độ rộng vai"], ["shoulderSlope", "Độ dốc vai"], ["clavicle", "Xương quai xanh"]] },
    { id: "arms", label: "Tay", focus: "upper", controls: [["armLength", "Chiều dài tay"], ["upperArm", "Bắp tay"], ["forearm", "Cẳng tay"], ["handSize", "Bàn tay"], ["fingerLength", "Ngón tay"], ["armLeft", "Tay trái"], ["armRight", "Tay phải"]] },
    { id: "legs", label: "Chân", focus: "lower", controls: [["legLength", "Chiều dài chân"], ["thighSize", "Đùi"], ["calfSize", "Bắp chân"], ["kneeSize", "Đầu gối"], ["footSize", "Bàn chân"], ["legLeft", "Chân trái"], ["legRight", "Chân phải"]] },
    { id: "torso", label: "Thân người", focus: "body", controls: [["height", "Chiều cao"], ["torsoLength", "Chiều dài thân"], ["backWidth", "Độ rộng lưng"], ["waist", "Vòng eo"], ["belly", "Bụng"], ["legTorsoRatio", "Tỷ lệ chân–thân"], ["ribcage", "Lồng ngực"], ["posture", "Tư thế"]] },
    { id: "chest", label: "Ngực", focus: "upper", controls: [["chestSize", "Kích thước"], ["chestWidth", "Độ rộng"], ["chestFullness", "Độ đầy"], ["chestPosition", "Vị trí"], ["chestSymmetry", "Độ cân đối"]] },
    { id: "hips", label: "Hông & mông", focus: "lower", controls: [["hipWidth", "Độ rộng hông"], ["gluteFullness", "Độ đầy"], ["gluteProjection", "Độ nhô"], ["waistHipRatio", "Tỷ lệ eo–hông"], ["hipTilt", "Độ nghiêng hông"]] },
    { id: "body", label: "Cơ thể", focus: "body", controls: [["muscle", "Lượng cơ"], ["bodyFat", "Lượng mỡ"], ["tone", "Độ săn chắc"], ["abs", "Cơ bụng"], ["bodyMass", "Khối lượng cơ thể"], ["softness", "Độ mềm mô"], ["weightDistribution", "Phân bố hình thể"]] },
    { id: "expression", label: "Biểu cảm", focus: "head", defaultValue: 0, controls: [["blink", "Chớp mắt"], ["smile", "Vui"], ["sad", "Buồn"], ["angry", "Tức giận"], ["surprised", "Bất ngờ"], ["pain", "Đau"], ["cheekPuff", "Má phồng"], ["squint", "Nheo mắt"], ["mouthA", "Âm A"], ["mouthO", "Âm O"]] }
  ]);
  const APPEARANCE_CONTROL_MAP = Object.freeze(Object.fromEntries(
    APPEARANCE_GROUPS.flatMap((group) => group.controls.map(([id, label]) => [id, { id, label, group: group.id, defaultValue: group.defaultValue ?? 0.5 }]))
  ));
  const APPEARANCE_ASSETS = Object.freeze({
    baseModels: [
      "valid-asian-f-1-casual",
      "valid-asian-m-1-casual",
      "valid-black-f-1-casual",
      "valid-white-m-1-casual",
      "human-adult-a01",
      "human-adult-b01"
    ],
    skins: ["warm-04", "neutral-03", "cool-02", "deep-05"],
    hairs: ["astral-layered-07", "aurora-short-02", "void-long-04", "solar-braid-03"],
    beards: ["none", "shadow-01", "short-boxed-02", "astral-goatee-03"],
    brows: ["natural-01", "soft-02", "defined-03", "bold-04"],
    makeups: ["none", "natural", "nebula", "cyber", "solar"],
    accessories: ["none", "ear-cuff", "visor", "astral-mark"],
    outfits: ["central-jacket-02", "combat-boots-01", "aurora-suit-01", "void-coat-01"],
    lighting: ["daylight", "night", "neon", "cinematic"]
  });
  const GENESIS_STUDIOS = Object.freeze({
    central: { label: "H-Central", short: "HC", background: 0x06121f, floor: 0x163a4d, key: 0xfff4e8, fill: 0xffddca, rim: 0x9acbff, accent: 0x6feeff },
    aurora: { label: "Aurora Lake", short: "AU", background: 0x061c25, floor: 0x0f5260, key: 0xe8fff8, fill: 0xcce8ff, rim: 0x79a8ff, accent: 0x65f1c7 },
    crimson: { label: "Crimson Forge", short: "CF", background: 0x1a0809, floor: 0x4c1714, key: 0xffe0bf, fill: 0xffc8a7, rim: 0xff4f72, accent: 0xff805f },
    void: { label: "Void Garden", short: "VG", background: 0x10071d, floor: 0x291447, key: 0xf2e7ff, fill: 0xd8c9ff, rim: 0x8f69ff, accent: 0xae78ff },
    deep: { label: "Deep Space", short: "DS", background: 0x02050f, floor: 0x111c38, key: 0xe7f2ff, fill: 0xc6d9ff, rim: 0xf46dff, accent: 0x79a8ff },
    neutral: { label: "Neutral Studio", short: "NS", background: 0x9aa5b2, floor: 0xc8d0d7, key: 0xffffff, fill: 0xfff4eb, rim: 0xb9d8ff, accent: 0xeef7ff }
  });
  const APPEARANCE_PRESETS = Object.freeze({
    balanced: { label: "Cân bằng", bodyPreset: "balanced", morphs: {} },
    athletic: { label: "Thể thao", bodyPreset: "athletic", morphs: { shoulderWidth: 0.62, upperArm: 0.61, thighSize: 0.6, calfSize: 0.58, muscle: 0.68, tone: 0.72, bodyFat: 0.36, abs: 0.64 } },
    soft: { label: "Mềm mại", bodyPreset: "soft", morphs: { cheekFullness: 0.62, faceFullness: 0.58, shoulderWidth: 0.45, waist: 0.47, chestFullness: 0.61, hipWidth: 0.6, gluteFullness: 0.62, softness: 0.7, muscle: 0.38 } },
    heroic: { label: "Anh hùng", bodyPreset: "heroic", morphs: { height: 0.67, jawWidth: 0.58, shoulderWidth: 0.7, chestWidth: 0.65, chestSize: 0.6, backWidth: 0.64, muscle: 0.72, posture: 0.7 } },
    agile: { label: "Nhanh nhẹn", bodyPreset: "agile", morphs: { height: 0.54, shoulderWidth: 0.48, armLength: 0.58, legLength: 0.66, waist: 0.43, bodyMass: 0.38, muscle: 0.54, tone: 0.66 } }
  });
  const PHOTOREAL_ASSETS = Object.freeze({
    panorama: "./assets/astral-realms/astral-realms-panorama-v1.webp",
    scenicPanorama: "./assets/astral-realms/environment/astral-cinematic-panorama-v1.png",
    hdrEnvironment: "./assets/astral-realms/environment/hdr/bell_park_dawn_1k.hdr",
    terrain: Object.freeze({
      albedo: "./assets/astral-realms/environment/surfaces/ground037-color.webp",
      normal: "./assets/astral-realms/environment/surfaces/ground037-normal-gl.webp",
      roughness: "./assets/astral-realms/environment/surfaces/ground037-roughness.webp",
      height: "./assets/astral-realms/environment/surfaces/ground037-height.webp",
      ao: "./assets/astral-realms/environment/surfaces/ground037-ao.webp"
    })
  });
  const BUILTIN_CHARACTER_ASSETS = Object.freeze({
    "human-adult-a01": "./assets/astral-realms/hh-human-asteria-v1.glb",
    "human-adult-b01": "./assets/astral-realms/hh-human-vanguard-v1.glb",
    "valid-asian-f-1-casual": "./assets/astral-realms/hh-human-asteria-v1.glb",
    "valid-asian-m-1-casual": "./assets/astral-realms/hh-human-vanguard-v1.glb",
    "valid-black-f-1-casual": "./assets/astral-realms/hh-human-asteria-v1.glb",
    "valid-white-m-1-casual": "./assets/astral-realms/hh-human-vanguard-v1.glb",
    "valid-white-f-2-casual": "./assets/astral-realms/characters/default/valid-white-f-2-casual.glb",
    "valid-hispanic-f-1-milit": "./assets/astral-realms/characters/default/valid-hispanic-f-1-milit.glb"
  });
  // Optional web-ready exports from the recommended pipeline:
  // MetaHuman/Character Creator/MPFB -> Blender retopology -> optimized GLB.
  // The manifest is deliberately optional so a missing premium asset never
  // blocks the game; the loader falls back to the bundled GLB, then procedural.
  const CHARACTER_PIPELINE_SOURCES = Object.freeze(["auto", "metahuman", "character-creator", "mpfb", "sketchfab-cc-by", "valid-avatar", "bundled", "procedural"]);
  const CHARACTER_PIPELINE_MANIFEST_URL = "./assets/astral-realms/characters/manifest.json";
  const CHARACTER_MOTION_MANIFEST_URL = "./assets/astral-realms/animations/motion-library-v13.json";
  const CHARACTER_MOTION_LIBRARY_URL = "./assets/astral-realms/animations/hh-human-motion-v13.glb";
  const LICENSED_ENVIRONMENT_ASSETS = Object.freeze({
    boulder: "./assets/astral-realms/environment/boulder_01.glb",
    grass: "./assets/astral-realms/environment/grass_medium_01.glb",
    mossRocks: "./assets/astral-realms/environment/rock_moss_set_01.glb",
    shrub: "./assets/astral-realms/environment/shrub_01.glb",
    deadTree: "./assets/astral-realms/environment/dead_tree_trunk_02.glb",
    fern: "./assets/astral-realms/environment/fern_02.glb",
    pineRoots: "./assets/astral-realms/environment/pine_roots_web.glb",
    modularFort: "./assets/astral-realms/environment/modular_fort_01_web.glb",
    kenneyOak: "./assets/astral-realms/kenney/nature/tree_oak.glb",
    kenneyPalm: "./assets/astral-realms/kenney/nature/tree_palmDetailedTall.glb",
    kenneyBush: "./assets/astral-realms/kenney/nature/plant_bushDetailed.glb",
    kenneyPath: "./assets/astral-realms/kenney/nature/path_stone.glb",
    kenneyRoad: "./assets/astral-realms/kenney/roads/road-straight.glb",
    kenneyHouse: "./assets/astral-realms/kenney/suburban/building-type-a.glb",
    kenneyTower: "./assets/astral-realms/kenney/buildings/building-sample-tower-c.glb",
    kenneyBridge: "./assets/astral-realms/kenney/roads/road-bridge.glb",
    free3dTreeA: "./assets/astral-realms/environment/free3d-cc0/free3d-tree-a.glb",
    free3dTreeB: "./assets/astral-realms/environment/free3d-cc0/free3d-tree-b.glb",
    free3dTreeC: "./assets/astral-realms/environment/free3d-cc0/free3d-tree-c.glb",
    free3dBush: "./assets/astral-realms/environment/free3d-cc0/free3d-bush.glb",
    free3dFlower: "./assets/astral-realms/environment/free3d-cc0/free3d-flower.glb",
    free3dMushroom: "./assets/astral-realms/environment/free3d-cc0/free3d-mushroom.glb",
    free3dStone: "./assets/astral-realms/environment/free3d-cc0/free3d-stone.glb"
  });
  const CINEMATIC_ENVIRONMENT_ASSET_IDS = Object.freeze(new Set(["pineRoots", "modularFort"]));
  const CHARACTER_ATLAS_INDEX = Object.freeze({ lyra: 0, cael: 1, nyx: 2, sol: 3 });
  const ELEMENT_REACTIONS = Object.freeze({
    "cryo+plasma": { name: "Sốc nhiệt", multiplier: 1.55, color: "#ff9bd6" },
    "quantum+void": { name: "Sụp đổ lượng tử", multiplier: 1.75, color: "#b591ff" },
    "nature+solar": { name: "Tinh hoa nở rộ", multiplier: 1.35, heal: 8, color: "#baff8e" }
  });
  const ZONES = Object.freeze([
    { id: "central", name: "H-Central", x: 0, z: 0, radius: 31, color: "#6feeff", weather: "Trời quang", description: "Thành phố trung tâm và Training Arena." },
    { id: "aurora", name: "Aurora Vale", x: -51, z: 20, radius: 30, color: "#65f1c7", weather: "Mưa tinh thể", description: "Thung lũng cực quang với tinh thể Băng tinh." },
    { id: "crimson", name: "Crimson Forge", x: 52, z: 24, radius: 30, color: "#ff805f", weather: "Tro plasma", description: "Lò rèn cổ, dung nham và máy móc tha hóa." },
    { id: "void", name: "Void Garden", x: 2, z: -62, radius: 32, color: "#ae78ff", weather: "Bão hư không", description: "Khu rừng tím nơi Nexus Warden trú ngụ." },
    { id: "sky", name: "Sky Ruins", x: -122, z: -48, radius: 28, color: "#9ad7ff", weather: "Gió lượng tử", description: "Quần đảo cổ trôi giữa những dòng gió lượng tử." },
    { id: "ocean", name: "Ocean Moon", x: 122, z: -42, radius: 30, color: "#4de1ff", weather: "Mưa sao biển", description: "Mặt trăng đại dương với các rạn tinh thể phát sáng." },
    { id: "station", name: "Astral Station", x: -118, z: 90, radius: 27, color: "#ffd36b", weather: "Cực quang nhân tạo", description: "Trạm trung chuyển, chợ và hub xã hội ngoài quỹ đạo." },
    { id: "abyss", name: "Nexus Abyss", x: 124, z: 94, radius: 31, color: "#ff5e9f", weather: "Nhật thực Nexus", description: "Vực cuối nơi không gian, trọng lực và ánh sáng cùng biến dạng." }
  ]);
  const ASTRAL_CINEMATICS = Object.freeze([
    { id: "central", chapter: 1, title: "Tín hiệu thức tỉnh", kicker: "NEXUS ECHO · H-CENTRAL", description: "Nax Veyra được tái tạo tại H-Central. Ngay khi ý thức ổn định, Nax nhận một tín hiệu cầu cứu mang chính chữ ký của mình, được gửi ngược về từ 72 giờ trong tương lai.", objective: "Cùng Luma xác minh tín hiệu tương lai", duration: 32000, camera: "opening-six-shot", motion: "opening", requiredEvent: "quest:awakening" },
    { id: "aurora", chapter: 2, title: "Hồ gương Aurora", kicker: "NEXUS ECHO · AURORA VALE", description: "Ký ức được lưu trong hồ gương tái hiện khoảnh khắc mạng Astral sụp đổ. Tín hiệu của Nax là thật, và chỉ còn 72 giờ để ngăn thảm họa.", objective: "Khôi phục ký ức trong lõi Aurora", duration: 11800, camera: "water-sweep", motion: "walk", requiredEvent: "restored:aurora" },
    { id: "crimson", chapter: 3, title: "Trái tim lò rèn", kicker: "NEXUS ECHO · CRIMSON FORGE", description: "Từ lõi Plasma còn hoạt động, Cael rèn Temporal Key — công cụ duy nhất có thể giải mã lớp thời gian đang khóa tín hiệu của Nax.", objective: "Cùng Cael hoàn thiện Temporal Key", duration: 11600, camera: "forge-rise", motion: "idle", requiredEvent: "restored:crimson" },
    { id: "void", chapter: 4, title: "Khu vườn không bóng", kicker: "NEXUS ECHO · VOID GARDEN", description: "Temporal Key mở kho lưu trữ cấm. Nyx phát hiện Nexus không phải sinh vật ngoài hành tinh, mà là hệ thống phòng vệ Astral đã nhận sai toàn bộ sự sống là mối đe dọa.", objective: "Giải mã giao thức phòng vệ Nexus", duration: 12400, camera: "gravity-roll", motion: "talk", requiredEvent: "restored:void" },
    { id: "sky", chapter: 5, title: "Tàn tích tầng mây", kicker: "NEXUS ECHO · SKY RUINS", description: "Giữa các tàn tích tầng mây, đội tìm lại bản đồ điều hướng dẫn tới con tàu mất tích của Nax nguyên bản — nguồn duy nhất còn giữ ký ức chưa bị Nexus sửa đổi.", objective: "Khôi phục bản đồ tới con tàu nguyên bản", duration: 11800, camera: "sky-dive", motion: "glide", requiredEvent: "restored:sky" },
    { id: "ocean", chapter: 6, title: "Mặt trăng đại dương", kicker: "NEXUS ECHO · OCEAN MOON", description: "Nhật ký con tàu xác nhận Nax nguyên bản đã chết khi cứu H-Central. Nax hiện tại là một bản tái tạo, nhưng ký ức mới và ý thức đang sống thuộc về chính mình.", objective: "Đưa nhật ký gốc trở lại mạng Astral", duration: 12800, camera: "ocean-glide", motion: "walk", requiredEvent: "restored:ocean" },
    { id: "station", chapter: 7, title: "Quỹ đạo phong tỏa", kicker: "NEXUS ECHO · ASTRAL STATION", description: "Astral Station phong tỏa quỹ đạo và ra lệnh xóa Nax để reset hệ thống. Luma thú nhận cô đã che giấu cái chết của Nax nguyên bản nhằm giữ hy vọng cứu thành phố.", objective: "Thoát lệnh xóa và mở đường tới Nexus", duration: 12600, camera: "station-track", motion: "talk", requiredEvent: "restored:station" },
    { id: "abyss", chapter: 8, title: "Điểm tận cùng Nexus", kicker: "NEXUS ECHO · NEXUS ABYSS", description: "Nax hợp nhất tám lõi, sửa giao thức phòng vệ và cứu mạng Astral mà không xóa ký ức hay bản ngã. Tín hiệu 72 giờ khép lại đúng lúc một Echo mới xuất hiện ngoài rìa thiên hà.", objective: "Sửa mạng Astral và giữ lại bản ngã", duration: 14800, camera: "abyss-spiral", motion: "attack1", requiredEvent: "restored:abyss" }
  ]);
  const BIOME_PROFILES = Object.freeze({
    central: { accent: "#6feeff", fog: 0x102a3f, fogDensity: 0.0056, particle: 0x73eaff, wind: 0.35, precipitation: "neon-rain", actor: "traffic" },
    aurora: { accent: "#65f1c7", fog: 0x173e45, fogDensity: 0.0082, particle: 0xc5fff4, wind: 0.62, precipitation: "snow", actor: "wisps" },
    crimson: { accent: "#ff805f", fog: 0x471d18, fogDensity: 0.0094, particle: 0xff8b52, wind: 0.78, precipitation: "embers", actor: "forge-drones" },
    void: { accent: "#ae78ff", fog: 0x211039, fogDensity: 0.0102, particle: 0xc996ff, wind: 0.22, precipitation: "spores", actor: "void-mantas" },
    sky: { accent: "#9ad7ff", fog: 0x3d5774, fogDensity: 0.0068, particle: 0xd7f2ff, wind: 1.25, precipitation: "quantum-wind", actor: "sky-rays" },
    ocean: { accent: "#4de1ff", fog: 0x0c4560, fogDensity: 0.0088, particle: 0x8ff6ff, wind: 0.74, precipitation: "star-rain", actor: "lumen-fish" },
    station: { accent: "#ffd36b", fog: 0x252738, fogDensity: 0.0048, particle: 0xffe5a1, wind: 0.08, precipitation: "orbital-dust", actor: "shuttles" },
    abyss: { accent: "#ff5e9f", fog: 0x170516, fogDensity: 0.012, particle: 0xff83bb, wind: 0.18, precipitation: "gravity-shards", actor: "fractures" },
    dungeon: { accent: "#ff70cf", fog: 0x16051f, fogDensity: 0.014, particle: 0xff8ee1, wind: 0.12, precipitation: "void-static", actor: "fractures" }
  });
  const FACTIONS = Object.freeze([
    { id: "h-central", name: "H-Central Federation", short: "HCF", color: "#6feeff", description: "Giữ mạng lưới cổng và bảo vệ các thành phố lõi.", perk: "Mở tuyến dịch chuyển và nâng cấp checkpoint." },
    { id: "aurora-keepers", name: "Aurora Keepers", short: "AUR", color: "#65f1c7", description: "Bảo vệ tinh thể và hệ sinh thái Aurora Vale.", perk: "Mở công thức hồi phục và tuyến lượn cực quang." },
    { id: "crimson-union", name: "Crimson Forge Union", short: "CFU", color: "#ff805f", description: "Thợ rèn và kỹ sư tái xây dựng Crimson Forge.", perk: "Mở nâng cấp vũ khí và mô-đun tàu." },
    { id: "void-cult", name: "Void Garden Cult", short: "VGC", color: "#ae78ff", description: "Những người canh giữ ranh giới Hư không.", perk: "Mở kỹ năng dịch chuyển và bí cảnh Void." },
    { id: "astral-researchers", name: "Astral Researchers", short: "AST", color: "#ffb4e5", description: "Nghiên cứu phản ứng nguyên tố và lịch sử các lõi.", perk: "Mở codex, scan và phần thưởng nghiên cứu." },
    { id: "free-travelers", name: "Free Travelers", short: "FRT", color: "#ffd36b", description: "Đội tàu độc lập đưa người và hàng qua các vùng nguy hiểm.", perk: "Giảm chi phí chế tạo và mở nhiệm vụ vận chuyển." }
  ]);
  const COMPANION_STORIES = Object.freeze({
    lyra: { title: "Nexus Echo của Nax", summary: "Khôi phục chuỗi ký ức dẫn tới tín hiệu 72 giờ.", support: "Có thể ổn định Plasma trong puzzle." },
    cael: { title: "Bản đồ băng vỡ", summary: "Khôi phục ba mảnh bản đồ tại Aurora Vale.", support: "Tạo cầu Băng tinh trong khu vực nước." },
    nyx: { title: "Vết nứt không tên", summary: "Đóng các khe nứt Hư không trước khi chúng lan rộng.", support: "Mở cổng ngắn tới điểm scan bí mật." },
    sol: { title: "Lời thề Nhật quang", summary: "Hộ tống lõi năng lượng qua Crimson Forge.", support: "Kích hoạt lò rèn và tăng tốc chế tạo." }
  });
  const SHIP_MODULES = Object.freeze({
    engine: { name: "Astral Engine", description: "Tăng tốc di chuyển giữa các khu vực.", max: 5, cost: { "plasma-core": 2 } },
    radar: { name: "Deep Scan Radar", description: "Hiện tài nguyên và điểm bí mật trên minimap.", max: 5, cost: { "aurora-shard": 2 } },
    hold: { name: "Cargo Hold", description: "Tăng giới hạn vật liệu có thể mang.", max: 5, cost: { "void-fiber": 2 } },
    forge: { name: "Mobile Forge", description: "Mở chế tạo nâng cao trên tàu.", max: 5, cost: { "plasma-core": 1, "aurora-shard": 1 } },
    garden: { name: "Life Garden", description: "Trồng lại nguyên liệu theo thời gian thật.", max: 5, cost: { "aurora-shard": 3 } }
  });
  const WORLD_ZONE_DEFAULTS = Object.freeze({
    central: { core: "stable", restored: true, occupation: "h-central", weather: "clear", resources: 100, lastBossAt: "" },
    aurora: { core: "unstable", restored: false, occupation: "aurora-keepers", weather: "aurora", resources: 100, lastBossAt: "" },
    crimson: { core: "corrupted", restored: false, occupation: "crimson-union", weather: "embers", resources: 100, lastBossAt: "" },
    void: { core: "sealed", restored: false, occupation: "void-cult", weather: "storm", resources: 100, lastBossAt: "" },
    sky: { core: "unstable", restored: false, occupation: "free-travelers", weather: "quantum-wind", resources: 100, lastBossAt: "" },
    ocean: { core: "unstable", restored: false, occupation: "aurora-keepers", weather: "star-rain", resources: 100, lastBossAt: "" },
    station: { core: "corrupted", restored: false, occupation: "astral-researchers", weather: "artificial-aurora", resources: 100, lastBossAt: "" },
    abyss: { core: "sealed", restored: false, occupation: "void-cult", weather: "eclipse", resources: 100, lastBossAt: "" }
  });
  const ITEMS = Object.freeze({
    "starter-blade": { id: "starter-blade", name: "Đoản kiếm H", type: "weapon", weaponClass: "sword", rarity: "Khởi đầu", description: "Vũ khí tiêu chuẩn của Nhà du hành H.", attack: 8 },
    "pulse-rifle": { id: "pulse-rifle", name: "Súng trường Pulse", type: "weapon", weaponClass: "gun", rarity: "Khởi đầu", description: "Vũ khí tầm xa với đạn năng lượng và nhịp bắn ổn định.", attack: 7 },
    "void-gauntlets": { id: "void-gauntlets", name: "Găng chiến Veyra", type: "weapon", weaponClass: "unarmed", rarity: "Khởi đầu", description: "Găng cận chiến khuếch đại đấm, đá và phản đòn.", attack: 10 },
    "aurora-shard": { id: "aurora-shard", name: "Mảnh Aurora", type: "material", rarity: "Phổ thông", description: "Tinh thể lạnh thu được tại Aurora Vale." },
    "plasma-core": { id: "plasma-core", name: "Lõi Plasma", type: "material", rarity: "Hiếm", description: "Lõi năng lượng còn nóng của sinh vật Crimson." },
    "void-fiber": { id: "void-fiber", name: "Sợi Hư Không", type: "material", rarity: "Hiếm", description: "Vật chất bất ổn từ Void Garden." },
    "healing-tonic": { id: "healing-tonic", name: "Tinh dược hồi phục", type: "consumable", rarity: "Phổ thông", description: "Hồi 35 HP khi sử dụng.", heal: 35 },
    "astral-edge": { id: "astral-edge", name: "Astral Edge", type: "weapon", weaponClass: "sword", rarity: "Sử thi", description: "Lưỡi kiếm cộng hưởng với sáu nguyên tố.", attack: 22 }
  });
  const WEAPON_COMBAT_PROFILES = Object.freeze({
    sword: {
      label: "Kiếm",
      icon: "⚔",
      attacks: ["attack1", "attack2", "attack3"],
      skillMotion: "swordSkill",
      ultimateMotion: "swordUltimate",
      attackName: "Astral Slash",
      skillName: "Temporal Cleave",
      ultimateName: "Nexus Sever",
      range: { attack: 4.2, skill: 8, ultimate: 12 },
      cooldown: { attack: 320, skill: 2600, ultimate: 9500 },
      damage: { attack: 1, skill: 1, ultimate: 1 }
    },
    gun: {
      label: "Súng",
      icon: "⌁",
      attacks: ["rifleShot", "rifleShot", "rifleBurst"],
      skillMotion: "rifleSkill",
      ultimateMotion: "rifleUltimate",
      attackName: "Pulse Shot",
      skillName: "Tracking Burst",
      ultimateName: "Orbital Barrage",
      range: { attack: 24, skill: 30, ultimate: 38 },
      cooldown: { attack: 190, skill: 3200, ultimate: 11000 },
      damage: { attack: 0.78, skill: 1.12, ultimate: 1.08 }
    },
    unarmed: {
      label: "Tay không",
      icon: "✦",
      attacks: ["punch1", "punch2", "kick1"],
      skillMotion: "martialSkill",
      ultimateMotion: "martialUltimate",
      attackName: "Veyra Combo",
      skillName: "Counter Drive",
      ultimateName: "Eight-Core Impact",
      range: { attack: 3.25, skill: 5.4, ultimate: 9 },
      cooldown: { attack: 245, skill: 2100, ultimate: 9000 },
      damage: { attack: 1.16, skill: 0.94, ultimate: 1.18 }
    }
  });
  const RECIPES = Object.freeze([
    { id: "healing-tonic", name: "Tinh dược hồi phục", result: "healing-tonic", amount: 1, requires: { "aurora-shard": 2 } },
    { id: "astral-edge", name: "Astral Edge", result: "astral-edge", amount: 1, requires: { "aurora-shard": 3, "plasma-core": 2, "void-fiber": 1 } }
  ]);
  const QUESTS = Object.freeze([
    { id: "awakening", title: "Tín hiệu thức tỉnh", description: "Nói chuyện với Navigator Luma tại H-Central.", type: "talk", target: 1, reward: { xp: 80 } },
    { id: "purify", title: "Thanh lọc Aurora", description: "Đánh bại 3 Tinh linh Aurora tha hóa.", type: "defeat", target: 3, enemy: "aurora-wisp", reward: { xp: 120, item: "aurora-shard", amount: 1 } },
    { id: "shards", title: "Mạch tinh thể", description: "Thu thập 3 Mảnh Aurora trong thung lũng.", type: "collect", target: 3, item: "aurora-shard", reward: { xp: 120 } },
    { id: "craft", title: "Dược phẩm tiền tuyến", description: "Chế tạo một Tinh dược hồi phục.", type: "craft", target: 1, recipe: "healing-tonic", reward: { xp: 140 } },
    { id: "gates", title: "Ba cổng thất lạc", description: "Kích hoạt cổng Aurora, Crimson và Void.", type: "gate", target: 3, reward: { xp: 180 } },
    { id: "warden", title: "Nexus Warden", description: "Đánh bại boss thế giới tại Void Garden.", type: "boss", target: 1, enemy: "nexus-warden", reward: { xp: 500, item: "astral-edge", amount: 1 } }
  ]);
  const ENEMY_ARCHETYPES = Object.freeze({
    "aurora-wisp": { name: "Tinh linh Aurora", health: 105, attack: 9, speed: 2.4, color: "#6cf6d0", element: "cryo", xp: 22, drop: "aurora-shard" },
    "forge-hound": { name: "Khuyển Plasma", health: 145, attack: 12, speed: 3.1, color: "#ff765d", element: "plasma", xp: 28, drop: "plasma-core" },
    "void-stalker": { name: "Bóng săn Hư Không", health: 185, attack: 15, speed: 2.8, color: "#a875ff", element: "void", xp: 36, drop: "void-fiber" },
    "sky-sentinel": { name: "Vệ binh Sky Ruins", health: 210, attack: 16, speed: 3.25, color: "#9ad7ff", element: "quantum", xp: 42, drop: "aurora-shard" },
    "ocean-siren": { name: "Hải linh Ocean Moon", health: 225, attack: 17, speed: 2.7, color: "#4de1ff", element: "cryo", xp: 44, drop: "aurora-shard" },
    "station-drone": { name: "Drone Astral lỗi", health: 245, attack: 18, speed: 3, color: "#ffd36b", element: "solar", xp: 48, drop: "plasma-core" },
    "abyss-herald": { name: "Sứ giả Nexus Abyss", health: 290, attack: 21, speed: 3.2, color: "#ff5e9f", element: "void", xp: 56, drop: "void-fiber" },
    "nexus-warden": { name: "Nexus Warden", health: 1200, attack: 22, speed: 2.1, color: "#ff5e9f", element: "quantum", xp: 360, drop: "astral-edge", boss: true }
  });

  function clamp(value, min, max) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : min;
  }

  function smoothstepRange(value, start, end) {
    const progress = clamp((value - start) / Math.max(0.0001, end - start), 0, 1);
    return progress * progress * (3 - 2 * progress);
  }

  function normalizeBoneName(value) {
    return String(value || "")
      .replace(/^.*[:|]/, "")
      .replace(/[._\-\s]/g, "")
      .replace(/mixamorig/gi, "")
      .toLowerCase();
  }

  function normalizeMorphTargetName(value) {
    return String(value || "")
      .replace(/^.*(?:h_expressions\.|expressions\.|blendshapes\.)/i, "")
      .replace(/^ARKit[_:.\-]?/i, "")
      .replace(/^AR[_:.\-]?/i, "")
      .replace(/_h$/i, "")
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase();
  }

  function facialMorphAliases(channel) {
    const native = FACIAL_MORPH_ALIASES[channel] || [];
    return [channel, `ARKit_${channel}`, `AR_${channel}`, channel.replace(/left$/i, "_L").replace(/right$/i, "_R"), ...native];
  }

  function supportedFacialChannels(dictionary = {}) {
    const available = new Set();
    Object.keys(dictionary).forEach((name) => {
      available.add(String(name).toLowerCase());
      available.add(normalizeMorphTargetName(name));
    });
    return MEDIAPIPE_FACE_CHANNELS.filter((channel) => channel !== "_neutral" && facialMorphAliases(channel).some((alias) => (
      available.has(String(alias).toLowerCase()) || available.has(normalizeMorphTargetName(alias))
    )));
  }

  function validateCharacterAsset(report = {}) {
    const errors = [];
    const warnings = [];
    const exceeds = (key, value, label) => {
      if (Number(value || 0) > CHARACTER_IMPORT_LIMITS[key]) {
        errors.push(`${label} vượt giới hạn ${CHARACTER_IMPORT_LIMITS[key].toLocaleString("vi-VN")}.`);
      }
    };
    exceeds("fileBytes", report.fileBytes, "Dung lượng file");
    exceeds("triangles", report.triangles, "Số tam giác");
    exceeds("bones", report.bones, "Số bone");
    exceeds("morphTargets", report.morphTargets, "Số morph target");
    exceeds("textureSize", report.maxTextureSize, "Kích thước texture");
    exceeds("textures", report.textures, "Số texture");
    exceeds("animations", report.animations, "Số animation");
    exceeds("animationSeconds", report.animationSeconds, "Tổng thời lượng animation");
    exceeds("nodes", report.nodes, "Số node");
    exceeds("materials", report.materials, "Số material");
    if (!report.skinnedMeshes) warnings.push("Không có SkinnedMesh; model sẽ dùng chuyển động fallback hoặc impostor.");
    if (!report.bones) warnings.push("Không phát hiện skeleton humanoid.");
    if (!report.animations) warnings.push("Không có animation clip; runtime giữ pose gốc.");
    if ((report.skeletonCoverage || 0) < 0.55 && report.bones) warnings.push("Skeleton chưa khớp tốt với HH Humanoid.");
    if (report.rootMotionTracks) warnings.push(`${report.rootMotionTracks} root-motion track X/Z sẽ được chuyển thành in-place để tránh trôi nhân vật.`);
    if (report.headVertices && report.headVertices < 18000) warnings.push("Head mesh dưới 18K vertices; phù hợp gameplay nhưng chưa đạt Web Hero LOD0.");
    if ((report.faceMorphTargets || 0) < 52) warnings.push(`Model có ${report.faceMorphTargets || 0}/52 facial morph native; HH dùng procedural/bone fallback cho kênh còn thiếu.`);
    if ((report.maxTextureSize || 0) > 2048) warnings.push("Texture trên 2K sẽ tốn bộ nhớ; nên xuất KTX2 2K cho Web Hero.");
    if ((report.bones || 0) > 120) warnings.push("Skeleton trên 120 bone; nên giảm bone phụ cho bản web.");
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      score: clamp(100 - errors.length * 28 - warnings.length * 7, 0, 100)
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function bodyValue(rootElement, selector) {
    return String(rootElement?.querySelector(selector)?.value || "").trim();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix = "id") {
    if (root.crypto?.randomUUID) return `${prefix}-${root.crypto.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function defaultAppearanceRecipe(characterId = "lyra") {
    const profile = CHARACTERS[characterId] || CHARACTERS.lyra;
    const realisticBase = {
      lyra: "sketchfab-miss-galaxy",
      cael: "sketchfab-game-character-girl",
      nyx: "valid-black-f-1-casual",
      sol: "valid-hispanic-f-1-milit"
    }[characterId] || "valid-asian-f-1-casual";
    return {
      appearanceVersion: APPEARANCE_VERSION,
      baseModel: realisticBase,
      sourceProvider: "auto",
      bodyPreset: "balanced",
      style: "human-cinematic",
      symmetry: true,
      advanced: false,
      morphs: Object.fromEntries(Object.values(APPEARANCE_CONTROL_MAP).map((control) => [control.id, control.defaultValue])),
      skin: "warm-04",
      skinColor: "#ffd5c5",
      eyeColor: profile.eyes,
      hair: "astral-layered-07",
      hairColor: profile.hair,
      beard: "none",
      brow: "natural-01",
      makeup: "none",
      accessory: "none",
      lighting: "cinematic",
      expression: "neutral",
      viseme: "neutral",
      outfit: ["central-jacket-02", "combat-boots-01"],
      decals: { freckles: 0, scars: 0, moles: 0, makeup: 0, tattoos: 0, wrinkles: 0, eyeShadow: 0, age: 0 },
      surface: { pores: 0.72, subsurface: 0.58, roughness: 0.52, flush: 0.18, wetness: 0 },
      updatedAt: nowIso()
    };
  }

  function normalizeAppearanceRecipe(input, characterId = "lyra") {
    const base = defaultAppearanceRecipe(characterId);
    const recipe = input && typeof input === "object" ? input : {};
    const morphs = Object.fromEntries(Object.values(APPEARANCE_CONTROL_MAP).map((control) => [
      control.id,
      Number.isFinite(Number(recipe.morphs?.[control.id])) ? clamp(recipe.morphs[control.id], 0, 1) : control.defaultValue
    ]));
    const validHex = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : fallback;
    const requestedModel = String(recipe.baseModel || "").slice(0, 80);
    const isCatalogModel = /^(?:valid|sketchfab)-[a-z0-9-]{3,72}$/.test(requestedModel);
    const isLegacyRecipe = Number(recipe.appearanceVersion || 0) < APPEARANCE_VERSION;
    const legacyMainModel = ["human-adult-a01", "human-adult-b01"].includes(requestedModel)
      || (characterId === "lyra" && requestedModel === "valid-asian-f-1-casual")
      || (characterId === "cael" && ["valid-asian-m-1-casual", "valid-white-f-2-casual"].includes(requestedModel))
      || (characterId === "sol" && requestedModel === "valid-white-m-1-casual");
    const normalizedBaseModel = isLegacyRecipe && legacyMainModel
      ? base.baseModel
      : APPEARANCE_ASSETS.baseModels.includes(requestedModel) || isCatalogModel
        ? requestedModel
        : base.baseModel;
    return {
      ...base,
      appearanceVersion: APPEARANCE_VERSION,
      baseModel: normalizedBaseModel,
      sourceProvider: CHARACTER_PIPELINE_SOURCES.includes(recipe.sourceProvider) ? recipe.sourceProvider : base.sourceProvider,
      bodyPreset: APPEARANCE_PRESETS[recipe.bodyPreset] ? recipe.bodyPreset : base.bodyPreset,
      style: ["human-cinematic", "anime-realistic"].includes(recipe.style) ? recipe.style : base.style,
      symmetry: recipe.symmetry !== false,
      advanced: recipe.advanced === true,
      morphs,
      skin: APPEARANCE_ASSETS.skins.includes(recipe.skin) ? recipe.skin : base.skin,
      skinColor: validHex(recipe.skinColor, base.skinColor),
      eyeColor: validHex(recipe.eyeColor, base.eyeColor),
      hair: APPEARANCE_ASSETS.hairs.includes(recipe.hair) ? recipe.hair : base.hair,
      hairColor: validHex(recipe.hairColor, base.hairColor),
      beard: APPEARANCE_ASSETS.beards.includes(recipe.beard) ? recipe.beard : base.beard,
      brow: APPEARANCE_ASSETS.brows.includes(recipe.brow) ? recipe.brow : base.brow,
      makeup: APPEARANCE_ASSETS.makeups.includes(recipe.makeup) ? recipe.makeup : base.makeup,
      accessory: APPEARANCE_ASSETS.accessories.includes(recipe.accessory) ? recipe.accessory : base.accessory,
      lighting: APPEARANCE_ASSETS.lighting.includes(recipe.lighting) ? recipe.lighting : base.lighting,
      expression: CHARACTER_EXPRESSION_PRESETS[recipe.expression] ? recipe.expression : base.expression,
      viseme: CHARACTER_VISEMES[recipe.viseme] ? recipe.viseme : base.viseme,
      outfit: Array.isArray(recipe.outfit)
        ? [...new Set(recipe.outfit.filter((id) => APPEARANCE_ASSETS.outfits.includes(id)))].slice(0, 4)
        : base.outfit,
      decals: Object.fromEntries(Object.keys(base.decals).map((id) => [
        id,
        Number.isFinite(Number(recipe.decals?.[id])) ? clamp(recipe.decals[id], 0, 1) : base.decals[id]
      ])),
      surface: Object.fromEntries(Object.keys(base.surface).map((id) => [
        id,
        Number.isFinite(Number(recipe.surface?.[id])) ? clamp(recipe.surface[id], 0, 1) : base.surface[id]
      ])),
      updatedAt: typeof recipe.updatedAt === "string" ? recipe.updatedAt.slice(0, 40) : nowIso()
    };
  }

  function compactAppearanceRecipe(recipe, characterId = "lyra") {
    const normalized = normalizeAppearanceRecipe(recipe, characterId);
    return {
      appearanceVersion: APPEARANCE_VERSION,
      baseModel: normalized.baseModel,
      sourceProvider: normalized.sourceProvider,
      bodyPreset: normalized.bodyPreset,
      style: normalized.style,
      symmetry: normalized.symmetry,
      morphs: Object.fromEntries(Object.entries(normalized.morphs).map(([id, value]) => [id, Number(value.toFixed(3))])),
      skin: normalized.skin,
      skinColor: normalized.skinColor,
      eyeColor: normalized.eyeColor,
      hair: normalized.hair,
      hairColor: normalized.hairColor,
      beard: normalized.beard,
      brow: normalized.brow,
      makeup: normalized.makeup,
      accessory: normalized.accessory,
      lighting: normalized.lighting,
      expression: normalized.expression,
      viseme: normalized.viseme,
      outfit: normalized.outfit.slice(0, 4),
      decals: Object.fromEntries(Object.entries(normalized.decals).map(([id, value]) => [id, Number(value.toFixed(3))])),
      surface: Object.fromEntries(Object.entries(normalized.surface).map(([id, value]) => [id, Number(value.toFixed(3))]))
    };
  }

  function appearanceFingerprint(recipe, characterId = "lyra") {
    return JSON.stringify(compactAppearanceRecipe(recipe, characterId));
  }

  function encodeCharacterDNA(recipe, characterId = "lyra") {
    const payload = JSON.stringify({
      format: "hh.character-dna.v1",
      characterId,
      recipe: compactAppearanceRecipe(recipe, characterId)
    });
    const bytes = new TextEncoder().encode(payload);
    let binary = "";
    bytes.forEach((value) => { binary += String.fromCharCode(value); });
    return root.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function decodeCharacterDNA(value) {
    const normalized = String(value || "").trim().replace(/-/g, "+").replace(/_/g, "/");
    if (!normalized || normalized.length > 18000) throw new Error("Mã Character DNA không hợp lệ.");
    const binary = root.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    if (payload?.format !== "hh.character-dna.v1" || !payload.recipe) throw new Error("Mã Character DNA không đúng định dạng HH.");
    return payload;
  }

  function defaultQuestState() {
    return Object.fromEntries(QUESTS.map((quest, index) => [quest.id, {
      status: index === 0 ? "active" : "locked",
      progress: 0,
      completedAt: ""
    }]));
  }

  function reputationRank(value) {
    const reputation = Number(value) || 0;
    if (reputation >= 900) return "Exalted";
    if (reputation >= 500) return "Allied";
    if (reputation >= 200) return "Trusted";
    if (reputation > 0) return "Friendly";
    if (reputation <= -200) return "Hostile";
    return "Neutral";
  }

  function defaultWorldState() {
    return {
      version: 1,
      zones: Object.fromEntries(Object.entries(WORLD_ZONE_DEFAULTS).map(([id, value]) => [id, { ...value, discovered: id === "central", updatedAt: nowIso() }])),
      factions: Object.fromEntries(FACTIONS.map((faction) => [faction.id, { reputation: 0, rank: "Neutral", supportedEvents: 0, updatedAt: nowIso() }])),
      eventLog: [],
      activeEvent: null,
      lastSyncAt: nowIso()
    };
  }

  function defaultStoryState() {
    return {
      canonVersion: STORY_CANON_VERSION,
      chapter: 1,
      step: "cinematic",
      completedEvents: []
    };
  }

  function normalizeStoryState(input) {
    const raw = input?.story && typeof input.story === "object" ? input.story : null;
    const events = new Set(Array.isArray(raw?.completedEvents)
      ? raw.completedEvents.slice(-80).map((eventId) => String(eventId || "").slice(0, 80)).filter(Boolean)
      : []);
    let chapter = clamp(raw?.chapter ?? 1, 1, ASTRAL_CINEMATICS.length);
    let step = ["cinematic", "mission", "complete"].includes(raw?.step) ? raw.step : "cinematic";

    if (!raw) {
      const awakeningComplete = input?.quests?.awakening?.status === "completed";
      if (awakeningComplete) {
        events.add("cinematic:central");
        events.add("quest:awakening");
        events.add("chapter:1:complete");
        chapter = 2;
      }
      for (let index = 1; index < ASTRAL_CINEMATICS.length; index += 1) {
        const cinematic = ASTRAL_CINEMATICS[index];
        if (chapter !== cinematic.chapter || input?.world?.zones?.[cinematic.id]?.restored !== true) break;
        events.add(`cinematic:${cinematic.id}`);
        events.add(`restored:${cinematic.id}`);
        events.add(`chapter:${cinematic.chapter}:complete`);
        if (cinematic.chapter < ASTRAL_CINEMATICS.length) chapter = cinematic.chapter + 1;
        else step = "complete";
      }
    }

    for (let completedChapter = 1; completedChapter < chapter; completedChapter += 1) {
      events.add(`chapter:${completedChapter}:complete`);
    }
    if (step === "complete" && chapter !== ASTRAL_CINEMATICS.length) step = "cinematic";
    return {
      canonVersion: STORY_CANON_VERSION,
      chapter,
      step,
      completedEvents: [...events].slice(-80)
    };
  }

  function defaultState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      saveVersion: 1,
      updatedAt: nowIso(),
      createdAt: nowIso(),
      playTime: 0,
      worldTime: 8.2,
      player: {
        id: uid("traveler"),
        name: "Nax Veyra",
        level: 1,
        xp: 0,
        health: 100,
        maxHealth: 100,
        stamina: 100,
        maxStamina: 100,
        ultimate: 0,
        element: "plasma",
        x: 0,
        y: 1.2,
        z: 5,
        rotation: 0,
        checkpoint: "central",
        weapon: "starter-blade",
        skillPoints: 0
      },
      roster: {
        activeId: "lyra",
        unlocked: [...CHARACTER_ORDER],
        members: Object.fromEntries(CHARACTER_ORDER.map((id) => [id, {
          level: 1,
          health: 100,
          maxHealth: 100,
          ultimate: 0
        }]))
      },
      appearance: {
        recipes: Object.fromEntries(CHARACTER_ORDER.map((id) => [id, defaultAppearanceRecipe(id)])),
        savedPresets: [],
        lastSavedAt: "",
        creatorCompletedAt: "",
        creatorVersion: 0
      },
      inventory: {
        "starter-blade": { quantity: 1, favorite: true, locked: true, acquiredAt: nowIso() },
        "pulse-rifle": { quantity: 1, favorite: false, locked: true, acquiredAt: nowIso() },
        "void-gauntlets": { quantity: 1, favorite: false, locked: true, acquiredAt: nowIso() }
      },
      quests: defaultQuestState(),
      story: defaultStoryState(),
      world: defaultWorldState(),
      companions: Object.fromEntries(CHARACTER_ORDER.map((id) => [id, {
        unlocked: id === "lyra",
        bond: id === "lyra" ? 1 : 0,
        storyStage: 0,
        lastActivityAt: ""
      }])),
      ship: {
        name: "Horizon H",
        level: 1,
        fuel: 100,
        modules: Object.fromEntries(Object.keys(SHIP_MODULES).map((id) => [id, 1])),
        crew: ["lyra"],
        decorations: [],
        lastExpeditionAt: ""
      },
      loadouts: Object.fromEntries(CHARACTER_ORDER.map((id) => [id, {
        role: id === "sol" ? "support" : id === "nyx" ? "control" : "damage",
        weapon: DEFAULT_CHARACTER_WEAPONS[id] || "starter-blade",
        core: "none",
        relics: [],
        updatedAt: nowIso()
      }])),
      exploration: {
        scans: [],
        hiddenFinds: [],
        landmarks: ["central-spire"],
        codex: [],
        mapFog: Object.fromEntries(ZONES.map((zone) => [zone.id, zone.id === "central" ? 0 : 100]))
      },
      progression: {
        mastery: Object.fromEntries(CHARACTER_ORDER.map((id) => [id, { combat: 0, exploration: 0, bond: 0 }])),
        daily: { date: "", completed: 0 },
        weekly: { week: "", completed: 0 }
      },
      checkpoints: Object.fromEntries(ZONES.map((zone) => [zone.id, zone.id === "central"])),
      activatedGates: [],
      collectedNodes: [],
      puzzles: {},
      defeated: {},
      skills: { plasmaDrive: 0, astralGuard: 0, staminaCore: 0 },
      settings: {
        quality: "auto",
        renderStyle: "realistic",
        rendererMode: "auto",
        visualStyle: "photoreal",
        characterMode: "rigged",
        characterQuality: "adaptive",
        characterPipeline: "auto",
        characterStudio: "central",
        facialAnimation: true,
        surfaceFx: true,
        microDetail: true,
        naturalMotion: true,
        eyePerformance: true,
        secondaryMotion: true,
        digitalHumanQuality: "adaptive",
        vfxLevel: "balanced",
        livingWorld: true,
        dynamicResolution: true,
        shadows: "high",
        postFx: true,
        weatherDensity: 80,
        cameraShake: 65,
        volume: 42,
        sound: true,
        cameraSensitivity: 55,
        reduceEffects: root.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true
      },
      stats: {
        totalDamage: 0,
        highestHit: 0,
        enemiesDefeated: 0,
        bossDefeated: 0,
        crafted: 0,
        distance: 0,
        deaths: 0,
        perfectDodges: 0,
        parries: 0,
        worldEventsCompleted: 0,
        expeditions: 0
      },
      cloud: { status: "local", version: 0, updatedAt: "", error: "" },
      party: { roomCode: "", status: "local", ready: false, capacity: 4, members: [], integrity: "local-simulation" }
    };
  }

  function normalizeState(input) {
    const base = defaultState();
    if (!input || typeof input !== "object") return base;
    const safeWorldInput = input.world && typeof input.world === "object"
      ? Object.fromEntries(Object.entries(input.world).filter(([key]) => key !== "choiceHistory"))
      : {};
    const state = {
      ...base,
      ...input,
      player: { ...base.player, ...(input.player || {}) },
      roster: {
        ...base.roster,
        ...(input.roster || {}),
        members: { ...base.roster.members, ...(input.roster?.members || {}) }
      },
      appearance: {
        recipes: Object.fromEntries(CHARACTER_ORDER.map((id) => [
          id,
          normalizeAppearanceRecipe(input.appearance?.recipes?.[id], id)
        ])),
        savedPresets: Array.isArray(input.appearance?.savedPresets)
          ? input.appearance.savedPresets.slice(-12).map((preset) => ({
            id: String(preset?.id || uid("look")).slice(0, 80),
            name: String(preset?.name || "Ngoại hình").slice(0, 40),
            characterId: CHARACTERS[preset?.characterId] ? preset.characterId : "lyra",
            recipe: normalizeAppearanceRecipe(preset?.recipe, preset?.characterId),
            createdAt: String(preset?.createdAt || nowIso()).slice(0, 40)
          }))
          : [],
        lastSavedAt: String(input.appearance?.lastSavedAt || "").slice(0, 40),
        creatorCompletedAt: String(input.appearance?.creatorCompletedAt || "").slice(0, 40),
        creatorVersion: clamp(input.appearance?.creatorVersion ?? 0, 0, CHARACTER_VISUAL_VERSION)
      },
      inventory: input.inventory && typeof input.inventory === "object" ? { ...base.inventory, ...input.inventory } : base.inventory,
      quests: { ...base.quests, ...(input.quests || {}) },
      story: normalizeStoryState(input),
      world: {
        ...base.world,
        ...safeWorldInput,
        zones: Object.fromEntries(Object.entries(WORLD_ZONE_DEFAULTS).map(([id, fallback]) => [id, {
          ...fallback,
          ...(input.world?.zones?.[id] || {}),
          resources: clamp(input.world?.zones?.[id]?.resources ?? fallback.resources, 0, 100),
          discovered: id === "central" || input.world?.zones?.[id]?.discovered === true,
          updatedAt: String(input.world?.zones?.[id]?.updatedAt || fallback.updatedAt).slice(0, 40)
        }])),
        factions: Object.fromEntries(FACTIONS.map((faction) => {
          const record = input.world?.factions?.[faction.id] || {};
          const reputation = clamp(record.reputation ?? 0, -1000, 1000);
          return [faction.id, {
            reputation,
            rank: reputationRank(reputation),
            supportedEvents: clamp(record.supportedEvents ?? 0, 0, 999),
            updatedAt: String(record.updatedAt || nowIso()).slice(0, 40)
          }];
        })),
        eventLog: Array.isArray(input.world?.eventLog) ? input.world.eventLog.slice(-80).map((event) => ({
          id: String(event?.id || uid("event")).slice(0, 80),
          type: String(event?.type || "system").slice(0, 32),
          title: String(event?.title || "Astral event").slice(0, 120),
          detail: String(event?.detail || "").slice(0, 240),
          zoneId: String(event?.zoneId || "").slice(0, 24),
          createdAt: String(event?.createdAt || nowIso()).slice(0, 40)
        })) : [],
        activeEvent: input.world?.activeEvent && typeof input.world.activeEvent === "object" ? {
          id: String(input.world.activeEvent.id || "").slice(0, 80),
          title: String(input.world.activeEvent.title || "").slice(0, 120),
          detail: String(input.world.activeEvent.detail || "").slice(0, 240),
          zoneId: String(input.world.activeEvent.zoneId || "").slice(0, 24),
          factionId: FACTIONS.some((faction) => faction.id === input.world.activeEvent.factionId) ? input.world.activeEvent.factionId : "h-central",
          progress: clamp(input.world.activeEvent.progress ?? 0, 0, 99),
          target: clamp(input.world.activeEvent.target ?? 3, 1, 99),
          expiresAt: String(input.world.activeEvent.expiresAt || "").slice(0, 40)
        } : null,
        lastSyncAt: String(input.world?.lastSyncAt || nowIso()).slice(0, 40)
      },
      companions: Object.fromEntries(CHARACTER_ORDER.map((id) => {
        const record = input.companions?.[id] || {};
        return [id, {
          unlocked: id === "lyra" || record.unlocked === true,
          bond: clamp(record.bond ?? (id === "lyra" ? 1 : 0), 0, 10),
          storyStage: clamp(record.storyStage ?? 0, 0, 5),
          lastActivityAt: String(record.lastActivityAt || "").slice(0, 40)
        }];
      })),
      ship: {
        ...base.ship,
        ...(input.ship || {}),
        name: String(input.ship?.name || base.ship.name).slice(0, 32),
        level: clamp(input.ship?.level ?? 1, 1, 10),
        fuel: clamp(input.ship?.fuel ?? 100, 0, 100),
        modules: Object.fromEntries(Object.entries(SHIP_MODULES).map(([id, module]) => [id, clamp(input.ship?.modules?.[id] ?? 1, 1, module.max)])),
        crew: Array.isArray(input.ship?.crew) ? input.ship.crew.filter((id) => CHARACTER_ORDER.includes(id)).slice(0, 4) : ["lyra"],
        decorations: Array.isArray(input.ship?.decorations) ? input.ship.decorations.slice(0, 40).map((item) => String(item).slice(0, 40)) : [],
        lastExpeditionAt: String(input.ship?.lastExpeditionAt || "").slice(0, 40)
      },
      loadouts: Object.fromEntries(CHARACTER_ORDER.map((id) => {
        const loadout = input.loadouts?.[id] || {};
        const migrateDefaultWeapon = Number(input.schemaVersion || 0) < 8
          && ["cael", "nyx"].includes(id)
          && (!loadout.weapon || loadout.weapon === "starter-blade");
        return [id, {
          role: ["damage", "support", "control", "exploration"].includes(loadout.role) ? loadout.role : base.loadouts[id].role,
          weapon: migrateDefaultWeapon ? base.loadouts[id].weapon : ITEMS[loadout.weapon] ? loadout.weapon : base.loadouts[id].weapon,
          core: ITEMS[loadout.core] ? loadout.core : "none",
          relics: Array.isArray(loadout.relics) ? loadout.relics.slice(0, 4).filter((item) => ITEMS[item]) : [],
          updatedAt: String(loadout.updatedAt || nowIso()).slice(0, 40)
        }];
      })),
      exploration: {
        ...base.exploration,
        ...(input.exploration || {}),
        scans: Array.isArray(input.exploration?.scans) ? input.exploration.scans.slice(-100).map((id) => String(id).slice(0, 80)) : [],
        hiddenFinds: Array.isArray(input.exploration?.hiddenFinds) ? input.exploration.hiddenFinds.slice(-100).map((id) => String(id).slice(0, 80)) : [],
        landmarks: Array.isArray(input.exploration?.landmarks) ? input.exploration.landmarks.slice(-100).map((id) => String(id).slice(0, 80)) : base.exploration.landmarks,
        codex: Array.isArray(input.exploration?.codex) ? input.exploration.codex.slice(-100).map((id) => String(id).slice(0, 80)) : [],
        mapFog: Object.fromEntries(Object.keys(base.exploration.mapFog).map((id) => [id, clamp(input.exploration?.mapFog?.[id] ?? base.exploration.mapFog[id], 0, 100)]))
      },
      progression: {
        ...base.progression,
        ...(input.progression || {}),
        mastery: Object.fromEntries(CHARACTER_ORDER.map((id) => [id, {
          combat: clamp(input.progression?.mastery?.[id]?.combat ?? 0, 0, 999999),
          exploration: clamp(input.progression?.mastery?.[id]?.exploration ?? 0, 0, 999999),
          bond: clamp(input.progression?.mastery?.[id]?.bond ?? 0, 0, 999999)
        }])),
        daily: { date: String(input.progression?.daily?.date || "").slice(0, 10), completed: clamp(input.progression?.daily?.completed ?? 0, 0, 10) },
        weekly: { week: String(input.progression?.weekly?.week || "").slice(0, 10), completed: clamp(input.progression?.weekly?.completed ?? 0, 0, 50) }
      },
      checkpoints: { ...base.checkpoints, ...(input.checkpoints || {}) },
      puzzles: input.puzzles && typeof input.puzzles === "object" ? input.puzzles : base.puzzles,
      skills: { ...base.skills, ...(input.skills || {}) },
      settings: { ...base.settings, ...(input.settings || {}) },
      stats: { ...base.stats, ...(input.stats || {}) },
      cloud: { ...base.cloud, ...(input.cloud || {}) },
      party: {
        ...base.party,
        ...(input.party || {}),
        ready: input.party?.ready === true,
        capacity: [4, 8].includes(Number(input.party?.capacity)) ? Number(input.party.capacity) : 4
      }
    };
    state.schemaVersion = SCHEMA_VERSION;
    state.player.health = clamp(state.player.health, 0, state.player.maxHealth || 100);
    state.player.stamina = clamp(state.player.stamina, 0, state.player.maxStamina || 100);
    state.player.level = clamp(state.player.level, 1, PLAYER_LEVEL_CAP);
    state.player.xp = state.player.level >= PLAYER_LEVEL_CAP
      ? 0
      : clamp(state.player.xp, 0, Math.max(0, 120 + (state.player.level - 1) * 70 - 1));
    state.player.x = clamp(state.player.x, -WORLD_LIMIT, WORLD_LIMIT);
    state.player.z = clamp(state.player.z, -WORLD_LIMIT, WORLD_LIMIT);
    if (!["auto", "low", "medium", "high", "cinematic"].includes(state.settings.quality)) state.settings.quality = "auto";
    if (!["realistic", "cinematic", "anime"].includes(state.settings.renderStyle)) state.settings.renderStyle = "realistic";
    if (!["auto", "webgpu", "webgl"].includes(state.settings.rendererMode)) state.settings.rendererMode = "auto";
    if (!["photoreal", "hybrid", "performance"].includes(state.settings.visualStyle)) state.settings.visualStyle = "photoreal";
    if (!["rigged", "portrait"].includes(state.settings.characterMode)) state.settings.characterMode = "rigged";
    if (!["adaptive", "hero", "near", "crowd"].includes(state.settings.characterQuality)) state.settings.characterQuality = "adaptive";
    if (!CHARACTER_PIPELINE_SOURCES.includes(state.settings.characterPipeline)) state.settings.characterPipeline = "auto";
    if (!GENESIS_STUDIOS[state.settings.characterStudio]) state.settings.characterStudio = "central";
    state.settings.facialAnimation = state.settings.facialAnimation !== false;
    state.settings.surfaceFx = state.settings.surfaceFx !== false;
    state.settings.microDetail = state.settings.microDetail !== false;
    state.settings.naturalMotion = state.settings.naturalMotion !== false;
    state.settings.eyePerformance = state.settings.eyePerformance !== false;
    state.settings.secondaryMotion = state.settings.secondaryMotion !== false;
    if (!["adaptive", "performance", "quality", "cinematic"].includes(state.settings.digitalHumanQuality)) state.settings.digitalHumanQuality = "adaptive";
    if (!["static", "balanced", "cinematic"].includes(state.settings.vfxLevel)) state.settings.vfxLevel = "balanced";
    state.settings.livingWorld = state.settings.livingWorld !== false;
    state.settings.dynamicResolution = state.settings.dynamicResolution !== false;
    state.settings.weatherDensity = clamp(state.settings.weatherDensity, 0, 100);
    state.settings.cameraShake = clamp(state.settings.cameraShake, 0, 100);
    if (!CHARACTERS[state.roster.activeId]) state.roster.activeId = "lyra";
    const activeLoadoutWeapon = state.loadouts?.[state.roster.activeId]?.weapon;
    if (ITEMS[activeLoadoutWeapon] && state.inventory?.[activeLoadoutWeapon]?.quantity > 0) state.player.weapon = activeLoadoutWeapon;
    state.roster.unlocked = Array.isArray(state.roster.unlocked)
      ? state.roster.unlocked.filter((id) => CHARACTERS[id]).slice(0, CHARACTER_ORDER.length)
      : [...CHARACTER_ORDER];
    if (!state.roster.unlocked.length) state.roster.unlocked = ["lyra"];
    state.activatedGates = Array.isArray(state.activatedGates) ? [...new Set(state.activatedGates)].slice(0, 8) : [];
    state.collectedNodes = Array.isArray(state.collectedNodes) ? [...new Set(state.collectedNodes)].slice(0, 200) : [];
    return state;
  }

  class AstralSaveStore {
    constructor() {
      this.db = null;
      this.fallback = false;
    }

    async open() {
      if (!root.indexedDB) {
        this.fallback = true;
        return this;
      }
      try {
        this.db = await new Promise((resolve, reject) => {
          const request = root.indexedDB.open(DB_NAME, DB_VERSION);
          request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "slot" });
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error || new Error("Không mở được IndexedDB."));
        });
      } catch {
        this.fallback = true;
      }
      return this;
    }

    async load(slot = "slot1") {
      if (this.fallback || !this.db) {
        try {
          const parsed = JSON.parse(root.localStorage?.getItem(STORAGE_FALLBACK) || "null");
          return parsed?.slot === slot ? parsed : null;
        } catch {
          return null;
        }
      }
      return new Promise((resolve) => {
        const request = this.db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(slot);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    }

    async save(data, slot = "slot1", label = "Autosave") {
      const previous = await this.load(slot);
      const version = Math.max(1, Number(previous?.version || 0) + 1);
      const history = [
        ...(Array.isArray(previous?.history) ? previous.history : []),
        ...(previous?.data ? [{ version: previous.version, updatedAt: previous.updatedAt, label: previous.label, data: previous.data }] : [])
      ].slice(-3);
      const record = {
        slot,
        version,
        label,
        updatedAt: nowIso(),
        data: clone(data),
        history
      };
      if (this.fallback || !this.db) {
        try {
          root.localStorage?.setItem(STORAGE_FALLBACK, JSON.stringify(record));
          return record;
        } catch (error) {
          throw new Error(`Không lưu được tiến trình trên thiết bị: ${error.message || error}`);
        }
      }
      return new Promise((resolve, reject) => {
        const request = this.db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(record);
        request.onsuccess = () => resolve(record);
        request.onerror = () => reject(request.error || new Error("Không ghi được IndexedDB."));
      });
    }

    async restore(version, slot = "slot1") {
      const current = await this.load(slot);
      const source = current?.history?.find((entry) => Number(entry.version) === Number(version));
      if (!source?.data) throw new Error("Không tìm thấy phiên bản lưu cần khôi phục.");
      return this.save(normalizeState(source.data), slot, `Khôi phục v${source.version}`);
    }

    async clear(slot = "slot1") {
      if (this.fallback || !this.db) {
        root.localStorage?.removeItem(STORAGE_FALLBACK);
        return;
      }
      await new Promise((resolve) => {
        const request = this.db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(slot);
        request.onsuccess = request.onerror = () => resolve();
      });
    }
  }

  class AstralRealmsGame {
    constructor(host, options = {}) {
      this.host = host;
      this.options = options;
      this.store = new AstralSaveStore();
      this.state = defaultState();
      this.savedRecord = null;
      this.root = null;
      this.THREE = null;
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.rendererBackend = "webgl2";
      this.webgpuAvailable = Boolean(root.navigator?.gpu);
      this.clock = null;
      this.playerMesh = null;
      this.playerShadow = null;
      this.characterMeshes = new Map();
      this.characterRuntimes = new Map();
      this.characterAssetStatus = new Map(CHARACTER_ORDER.map((id) => [id, "HH Human Rig PBR"]));
      this.characterAction = { name: "", startedAt: 0, duration: 0, until: 0, strength: 0 };
      this.characterLandAt = 0;
      this.characterImporting = false;
      this.GLTFLoaderClass = null;
      this.DRACOLoaderClass = null;
      this.KTX2LoaderClass = null;
      this.MeshoptDecoder = null;
      this.cloneSkinnedCharacter = null;
      this.characterDecodersReady = false;
      this.builtInCharacterAssets = new Map();
      this.builtInCharacterSources = new Map();
      this.characterPipelineManifest = [];
      this.characterExternalCandidates = [];
      this.characterPipelineStatus = "not-configured";
      this.motionLibraryManifest = null;
      this.motionLibraryAnimations = [];
      this.motionLibraryStatus = "pending";
      this.licensedEnvironmentAssets = new Map();
      this.licensedEnvironmentStatus = "pending";
      this.builtInCharacterStatus = "pending";
      this.characterDetailTextures = null;
      this.lastCharacterQa = null;
      this.motionState = { gaitPhase: 0, foot: "", yawVelocity: 0, acceleration: 0 };
      this.facePilot = { status: "off", stream: null, video: null, landmarker: null, frame: 0, blendshapes: {}, error: "", lastDetectionAt: 0, lastResultAt: 0 };
      this.facePreview = { expression: "neutral", viseme: "neutral", until: 0 };
      this.genesisLighting = "cinematic";
      this.genesisOriginalLighting = null;
      this.lastSurfaceUpdateAt = 0;
      this.toonGradient = null;
      this.photorealAssets = { panorama: null, scenicPanorama: null, hdrEnvironment: null, terrain: null };
      this.photorealStatus = "pending";
      this.terrainTexture = null;
      this.activeAnimation = "idle";
      this.animationBlend = 0;
      this.characterSwitchAt = 0;
      this.entities = new Map();
      this.enemies = new Map();
      this.collectibles = new Map();
      this.npcs = new Map();
      this.portals = new Map();
      this.remotePlayers = new Map();
      this.effects = [];
      this.environmentActors = [];
      this.livingWorldActors = [];
      this.zoneFxGroups = new Map();
      this.footprints = [];
      this.footprintCursor = 0;
      this.lastFootprintAt = 0;
      this.lastFootprintPosition = { x: Number.NaN, z: Number.NaN };
      this.runtimeFailureCount = 0;
      this.lastRenderSuccessAt = 0;
      this.streamingGroups = new Map();
      this.puzzleNodes = new Map();
      this.cloudLayers = [];
      this.dynamicFoliage = [];
      this.dynamicPebbleFields = [];
      this.dynamicNatureScratch = null;
      this.sunCorona = null;
      this.waterSurfaces = [];
      this.climbables = [];
      this.climbableObjects = [];
      this.keys = new Set();
      this.gamepads = [];
      this.touchMove = { x: 0, z: 0 };
      this.running = false;
      this.paused = true;
      this.menuPaused = false;
      this.genesisActive = false;
      this.genesisCompleting = false;
      this.genesisTurntable = false;
      this.genesisScene = null;
      this.genesisCamera = null;
      this.genesisStudioGroup = null;
      this.genesisStudioId = "central";
      this.genesisFallbackModel = null;
      this.genesisActualModel = null;
      this.genesisOriginalParent = null;
      this.genesisOriginalTransform = null;
      this.genesisVisibility = null;
      this.gameplayVisibility = {
        consecutiveFrames: 0,
        visibleFrames: 0,
        failureFrames: 0,
        unsafePoseFrames: 0,
        validated: false,
        groundingCalibrated: false,
        startedAt: 0,
        lastCheckedAt: 0,
        report: null
      };
      this.characterDiagnostics = null;
      this.runtimeStarted = false;
      this.destroyed = false;
      this.started = false;
      this.visible = document.visibilityState !== "hidden";
      this.lastFrameAt = performance.now();
      this.lastProcessedFrameAt = 0;
      this.lastUiAt = 0;
      this.lastMinimapAt = 0;
      this.lastSaveAt = 0;
      this.lastNetworkAt = 0;
      this.lastAttackAt = 0;
      this.lastSkillAt = 0;
      this.lastUltimateAt = 0;
      this.lastDodgeAt = 0;
      this.hitStopUntil = 0;
      this.invulnerableUntil = 0;
      this.combo = 0;
      this.comboUntil = 0;
      this.verticalVelocity = 0;
      this.isGrounded = true;
      this.gliding = false;
      this.isSwimming = false;
      this.isClimbing = false;
      this.cameraYaw = 0;
      this.cameraPitch = 0.14;
      this.cameraDistance = 10.8;
      this.cameraShake = 0;
      this.cameraFovTarget = CINEMATIC_CAMERA.verticalFovDeg;
      this.cameraFocusDistance = 8;
      this.cinematicTarget = null;
      this.cinematicScene = null;
      this.cinematicSetGroup = null;
      this.cinematicSetCache = new Map();
      this.cinematicActorRestore = null;
      this.cinematicShadowRestore = null;
      this.cinematicScratch = null;
      this.cinematicSequence = {
        active: false,
        chapterId: "central",
        startedAt: 0,
        elapsedBeforePause: 0,
        playing: false,
        completed: false,
        source: "",
        waitingForSubject: false,
        pendingAutoplay: false,
        validSubjectFrames: 0,
        subjectReport: null,
        restoreMenuPaused: false,
        restorePaused: false,
        restoreZone: null
      };
      this.photoMode = false;
      this.photoSettings = { fov: 48, exposure: 1.08, time: 8.2, weather: "auto", hideUi: true };
      this.draggingCamera = false;
      this.pointerStart = null;
      this.lockedTargetId = "";
      this.nearby = null;
      this.currentZone = ZONES[0];
      this.currentPanel = "";
      this.appearanceGroup = "face";
      this.appearanceHistory = [];
      this.appearanceFuture = [];
      this.appearanceCompareRecipe = null;
      this.appearanceDirty = true;
      this.appearanceFocus = "";
      this.toastTimer = 0;
      this.frameHandle = 0;
      this.autosaveTimer = 0;
      this.fpsFrames = 0;
      this.fpsStartedAt = performance.now();
      this.fps = 0;
      this.fpsEma = 60;
      this.lowFpsWindows = 0;
      this.highFpsWindows = 0;
      this.lastQualityTransitionAt = 0;
      this.renderScaleTier = 0;
      this.renderScale = 1;
      this.dynamicResolution = 1;
      this.forceCompatibility = false;
      this.lastStreamingAt = 0;
      this.lastStreamingCell = "";
      this.shadowCastersByZone = new Map();
      this.activeShadowCasters = new Set();
      this.worldSpinners = [];
      this.lastEnvironmentDetailAt = 0;
      this.lastWeatherCpuAt = 0;
      this.frameScratch = null;
      this.dpsSamples = [];
      this.trainingActive = false;
      this.trainingSession = false;
      this.worldHoursPerSecond = 0.018;
      this.runtime = null;
      this.socket = options.socket || root.HHRealtimeSocket || null;
      this.room = null;
      this.authoritative = false;
      this.inputSeq = 0;
      this.audio = null;
      this.audioMaster = null;
      this.cleanup = [];
      this.renderShell();
    }

    renderShell() {
      this.host.innerHTML = `
        <section class="har-shell" data-har-shell data-quality="auto" aria-label="HH Astral Realms">
          <div class="har-stage" data-har-stage>
            <canvas data-har-world aria-label="Thế giới 3D HH Astral Realms"></canvas>
            <div class="har-postfx" aria-hidden="true"></div>
            <div class="har-biome-fx" data-har-biome-fx aria-hidden="true"><i></i><i></i><i></i></div>
            <div class="har-cinematic-bars" aria-hidden="true"></div>
            <div class="har-crosshair" aria-hidden="true"></div>
          </div>

          <div class="har-topbar">
            <div class="har-brand">
              <div class="har-brand__core" aria-hidden="true">H</div>
              <div class="har-brand__copy"><strong>HH Astral Realms</strong><span>Human Character System · Visual V${CHARACTER_VISUAL_VERSION}</span></div>
            </div>
            <div class="har-live-orbit" aria-label="Trạng thái game realtime">
              <div class="har-signal" data-tone="cyan"><small>Khu vực</small><strong data-har-zone>H-Central</strong></div>
              <div class="har-signal" data-tone="amber"><small>Thời gian</small><strong data-har-time>08:12</strong></div>
              <div class="har-signal" data-tone="pink"><small>Thời tiết</small><strong data-har-weather>Trời quang</strong></div>
              <div class="har-signal" data-tone="lime"><small>Engine</small><strong data-har-fps>Chưa chạy</strong></div>
              <div class="har-signal" data-tone="violet"><small>Renderer</small><strong data-har-renderer>Đang dò GPU</strong></div>
              <div class="har-signal" data-tone="pink"><small>Character</small><strong data-har-character-runtime>RIGGED V${CHARACTER_VISUAL_VERSION}</strong></div>
              <div class="har-signal" data-tone="cyan"><small>Máy chủ</small><strong data-har-server>LOCAL</strong></div>
              <div class="har-signal" data-tone="amber"><small>World state</small><strong data-har-world-state>Ổn định</strong></div>
            </div>
            <div class="har-top-actions">
              <button class="har-icon-button har-cinema-button" type="button" data-har-cinematics aria-label="Mở 8 cinematic 3D">▶<b>8</b></button>
              <button class="har-icon-button" type="button" data-har-panel="map" aria-label="Mở bản đồ">◇</button>
              <button class="har-icon-button" type="button" data-har-photo aria-label="Mở Photo Mode">◉</button>
              <button class="har-icon-button" type="button" data-har-panel="party" aria-label="Mở tổ đội">◎</button>
              <button class="har-icon-button" type="button" data-har-fullscreen aria-label="Toàn màn hình">⛶</button>
              <button class="har-icon-button" type="button" data-har-pause aria-label="Tạm dừng">Ⅱ</button>
            </div>
          </div>

          <nav class="har-system-dock" aria-label="Hệ thống Astral">
            <button type="button" data-har-panel="world"><span>✦</span>Thế giới</button>
            <button type="button" data-har-panel="factions"><span>◈</span>Phe phái</button>
            <button type="button" data-har-panel="companions"><span>✧</span>Đồng đội</button>
            <button type="button" data-har-panel="ship"><span>⌁</span>Tàu H</button>
            <button type="button" data-har-panel="training"><span>◎</span>Training</button>
            <button type="button" data-har-panel="codex"><span>▣</span>Codex</button>
          </nav>

          <div class="har-team" aria-label="Đội hình">
            ${CHARACTER_ORDER.map((id, index) => {
              const profile = CHARACTERS[id];
              return `<button class="har-team-slot ${index === 0 ? "is-active" : ""}" type="button" data-team-slot="${index + 1}" data-character="${id}" aria-label="Đổi sang ${profile.name}" style="--character-color:${profile.accent};--portrait-x:${index * 33.333333}%"><i class="har-team-portrait" aria-hidden="true"></i><strong>${profile.short}</strong><span>${profile.name}</span><small>${ELEMENTS[profile.element].label}</small></button>`;
            }).join("")}
            <button class="har-team-preview" type="button" data-har-panel="characters">Hồ sơ đội</button>
          </div>
          <div class="har-dps" data-har-dps>Training DPS · 0</div>

          <div class="har-minimap-wrap">
            <canvas width="276" height="276" data-har-minimap aria-label="Radar thiên hà"></canvas>
            <div class="har-minimap-label" data-har-minimap-label>H-Central</div>
          </div>

          <div class="har-boss" data-har-boss hidden>
            <div><strong data-har-boss-name>Nexus Warden</strong><small data-har-boss-phase>PHASE I · Astral Shell</small></div>
            <div class="har-meter har-meter--boss"><i data-har-boss-meter></i></div>
          </div>

          <section class="har-photo" data-har-photo-ui hidden aria-label="Photo Mode">
            <header><div><small>ASTRAL LENS</small><strong>Photo Mode</strong></div><button type="button" data-photo-action="close" aria-label="Đóng Photo Mode">×</button></header>
            <label>Góc nhìn <input type="range" min="28" max="80" value="48" data-photo-setting="fov"></label>
            <label>Phơi sáng <input type="range" min="65" max="150" value="108" data-photo-setting="exposure"></label>
            <label>Thời gian <input type="range" min="0" max="24" step="0.1" value="8.2" data-photo-setting="time"></label>
            <label>Thời tiết <select data-photo-setting="weather"><option value="auto">Theo khu vực</option><option value="clear">Trời quang</option><option value="aurora">Cực quang</option><option value="storm">Bão tinh thể</option><option value="embers">Tro plasma</option><option value="quantum-wind">Gió lượng tử</option><option value="star-rain">Mưa sao biển</option><option value="eclipse">Nhật thực Nexus</option></select></label>
            <div class="har-photo__actions"><button type="button" data-photo-action="toggle-ui">Ẩn/hiện HUD</button><button class="is-primary" type="button" data-photo-action="capture">Chụp PNG</button></div>
          </section>

          <div class="har-hud">
            <div class="har-player-card">
              <div class="har-player-row">
                <div class="har-avatar" data-level="1">LH</div>
                <div class="har-player-meta">
                  <strong data-har-player-name>Nax Veyra</strong>
                  <span data-har-player-meta>Nhà du hành · Plasma</span>
                  <div class="har-meter"><i data-har-health></i></div>
                  <div class="har-meter har-meter--stamina"><i data-har-stamina></i></div>
                  <div class="har-meter har-meter--xp"><i data-har-xp></i></div>
                </div>
              </div>
            </div>
            <div class="har-quest-card">
              <button type="button" data-har-panel="quests">
                <small>Nhiệm vụ đang theo dõi</small>
                <strong data-har-quest-title>Tín hiệu thức tỉnh</strong>
                <span data-har-quest-progress>Nói chuyện với Navigator Luma · 0/1</span>
              </button>
            </div>
          </div>

          <div class="har-action-dock" aria-label="Kỹ năng">
            <button class="har-action" type="button" data-har-action="dodge"><small>Q</small><strong>⇥</strong><i data-cooldown="dodge"></i></button>
            <button class="har-action har-action--attack" type="button" data-har-action="attack"><small>F</small><strong>⚔</strong><i data-cooldown="attack"></i></button>
            <button class="har-action" type="button" data-har-action="skill"><small>E</small><strong>✦</strong><i data-cooldown="skill"></i></button>
            <button class="har-action" type="button" data-har-action="ultimate"><small>R</small><strong>✺</strong><i data-cooldown="ultimate"></i></button>
            <button class="har-action" type="button" data-har-action="interact"><small>G</small><strong>◇</strong><i></i></button>
          </div>

          <div class="har-element-ring" aria-label="Lõi nguyên tố">
            ${Object.entries(ELEMENTS).map(([id, item]) => `<button class="har-element" type="button" data-element="${id}" aria-pressed="${id === "plasma"}" style="--element-color:${item.color}" title="${item.label}">${item.short}</button>`).join("")}
          </div>

          <div class="har-context-prompt" data-har-context hidden></div>

          <div class="har-touch" aria-label="Điều khiển cảm ứng">
            <div class="har-joystick" data-har-joystick><i></i></div>
            <div class="har-touch-actions">
              <button class="har-touch-action" type="button" data-touch-action="attack">⚔</button>
              <button class="har-touch-action" type="button" data-touch-action="jump">↑</button>
              <button class="har-touch-action" type="button" data-touch-action="skill">✦</button>
              <button class="har-touch-action" type="button" data-touch-action="dodge">⇥</button>
            </div>
          </div>

          <aside class="har-panel" data-har-panel-root aria-hidden="true">
            <header class="har-panel__head">
              <div><small data-har-panel-kicker>Holographic Console</small><h2 data-har-panel-title>Bản đồ</h2></div>
              <button class="har-icon-button" type="button" data-har-panel-close aria-label="Đóng bảng">×</button>
            </header>
            <div class="har-panel__body" data-har-panel-body></div>
          </aside>

          <section class="har-dialogue" data-har-dialogue hidden aria-live="polite">
            <small data-har-dialogue-role>Navigator</small>
            <h2 data-har-dialogue-name>Luma</h2>
            <p data-har-dialogue-text></p>
            <div class="har-dialogue__choices" data-har-dialogue-choices></div>
          </section>

          <section class="har-story-cinema" data-har-cinematic-player hidden aria-label="Astral Cinematic Archive" aria-modal="true" role="dialog">
            <div class="har-story-cinema__vignette" aria-hidden="true"></div>
            <header class="har-story-cinema__header">
              <div><small>ASTRAL CINEMATIC ARCHIVE · REALTIME 3D</small><strong>Hành trình của <span data-cinematic-player-name>Nhà du hành</span></strong></div>
              <button type="button" data-cinematic-action="close" aria-label="Đóng cinematic">×</button>
            </header>
            <div class="har-story-cinema__copy">
              <div class="har-story-cinema__chapter"><span data-cinematic-number>01</span><i></i><small data-cinematic-kicker>H-CENTRAL · KHỞI NGUYÊN</small></div>
              <h2 data-cinematic-title>Tín hiệu thức tỉnh</h2>
              <p data-cinematic-description></p>
              <div class="har-story-cinema__objective"><small>NHIỆM VỤ TIẾP THEO</small><strong data-cinematic-objective></strong></div>
            </div>
            <div class="har-story-cinema__transport">
              <div class="har-story-cinema__time"><span data-cinematic-current>00:00</span><div><i data-cinematic-progress></i></div><span data-cinematic-duration>00:10</span></div>
              <div class="har-story-cinema__actions">
                <button type="button" data-cinematic-action="replay">↺ Phát lại</button>
                <button class="is-primary" type="button" data-cinematic-action="toggle">Ⅱ Tạm dừng</button>
                <button type="button" data-cinematic-action="enter">Vào khu vực →</button>
              </div>
            </div>
            <nav class="har-story-cinema__chapters" aria-label="Tám cinematic khu vực">
              ${ASTRAL_CINEMATICS.map((cinematic) => `<button type="button" data-cinematic-chapter="${cinematic.id}" data-cinematic-index="${cinematic.chapter}" ${cinematic.chapter > 1 ? "disabled aria-disabled=\"true\"" : "aria-disabled=\"false\""} style="--cinema-color:${ZONES.find((zone) => zone.id === cinematic.id)?.color || "#6feeff"}"><span>${String(cinematic.chapter).padStart(2, "0")}</span><div><strong>${cinematic.title}</strong><small>${cinematic.chapter > 1 ? "Đã khóa" : `Hiện tại · ${ZONES.find((zone) => zone.id === cinematic.id)?.name || cinematic.id}`}</small></div><i></i></button>`).join("")}
            </nav>
            <div class="har-story-cinema__hint">Cinematic dùng chính nhân vật 3D đã tạo · Esc để đóng · không phải video giả lập</div>
          </section>

          <div class="har-toast" data-har-toast role="status" aria-live="polite"></div>

          <section class="har-genesis" data-har-genesis hidden aria-label="Character Genesis">
            <header class="har-genesis__header">
              <div><small>ASTRAL GENESIS · CHARACTER V${CHARACTER_VISUAL_VERSION}</small><strong>Tạo Nhà du hành của bạn</strong><span>Mesh 3D rigged · PBR · không dùng ảnh làm nhân vật</span></div>
              <div class="har-genesis__status"><i></i><span data-genesis-status>Đang dựng Human Rig...</span></div>
            </header>
              <div class="har-genesis__layout">
                <aside class="har-genesis__guide">
                <small>BƯỚC ĐẦU TIÊN</small>
                <h2>Định hình một con người trong thế giới Astral.</h2>
                <p>Chọn nền cơ thể, chỉnh tỷ lệ khuôn mặt và vóc dáng, kiểm tra chuyển động rồi mới bước vào H-Central.</p>
                <ol>
                  <li class="is-active"><span>01</span>Nền nhân vật 3D</li>
                  <li><span>02</span>Khuôn mặt & cơ thể</li>
                  <li><span>03</span>Da, mắt & phong cách</li>
                  <li><span>04</span>Chuyển động & xác nhận</li>
                </ol>
                </aside>
                <div class="har-genesis__viewport" aria-label="Xem trước nhân vật 3D">
                <div class="har-genesis-fallback-character" data-genesis-fallback-character aria-hidden="true">
                  <div class="har-genesis-fallback-character__frame"></div>
                  <div class="har-genesis-fallback-character__orbit har-genesis-fallback-character__orbit--a"></div>
                  <div class="har-genesis-fallback-character__orbit har-genesis-fallback-character__orbit--b"></div>
                  <div class="har-genesis-fallback-character__figure">
                    <i class="har-genesis-fallback-character__aura"></i>
                    <i class="har-genesis-fallback-character__head"></i>
                    <i class="har-genesis-fallback-character__neck"></i>
                    <i class="har-genesis-fallback-character__torso"></i>
                    <i class="har-genesis-fallback-character__arm har-genesis-fallback-character__arm--left"></i>
                    <i class="har-genesis-fallback-character__arm har-genesis-fallback-character__arm--right"></i>
                    <i class="har-genesis-fallback-character__leg har-genesis-fallback-character__leg--left"></i>
                    <i class="har-genesis-fallback-character__leg har-genesis-fallback-character__leg--right"></i>
                    <i class="har-genesis-fallback-character__visor"></i>
                  </div>
                  <small>GPU SAFE HUMAN PREVIEW · 3D FALLBACK</small>
                </div>
                <div class="har-genesis__scan"><i></i><i></i><i></i></div>
                <div class="har-genesis__camera-note"><strong data-genesis-model-name>ASTERIA HUMAN</strong><span>Giữ và kéo trên nhân vật để xoay camera</span></div>
                <div class="har-genesis-studios" data-genesis-studios aria-label="Studio 3D">
                  ${Object.entries(GENESIS_STUDIOS).map(([id, studio]) => `<button type="button" data-genesis-studio="${id}" title="${studio.label}" style="--studio:#${studio.accent.toString(16).padStart(6, "0")}"><i>${studio.short}</i><span>${studio.label}</span></button>`).join("")}
                </div>
                <div class="har-genesis__view-actions">
                  <button type="button" data-genesis-action="rotate-left" aria-label="Xoay trái">↶</button>
                  <button type="button" data-genesis-action="focus-body">Toàn thân</button>
                  <button type="button" data-genesis-action="focus-head">Khuôn mặt</button>
                  <button type="button" data-genesis-action="rotate-right" aria-label="Xoay phải">↷</button>
                </div>
              </div>
              <aside class="har-genesis__editor" data-har-genesis-content></aside>
            </div>
          </section>

          <section class="har-start" data-har-start>
            <div class="har-start-card">
              <div class="har-start-sun" aria-hidden="true">H</div>
              <small>H Galaxy · Original Action RPG</small>
              <h1>Astral Realms</h1>
              <p>Khám phá tám khu vực được tải theo vị trí, phát triển nhân vật tới cấp 80 và chiến đấu cùng tối đa tám Nhà du hành trong shard realtime miễn phí.</p>
              <div class="har-start-features">
                <div class="har-start-feature"><strong>08</strong>Khu vực streaming</div>
                <div class="har-start-feature"><strong>06</strong>Nhiệm vụ thật</div>
                <div class="har-start-feature"><strong>80</strong>Cấp nhân vật tối đa</div>
                <div class="har-start-feature"><strong>1–8</strong>Co-op realtime</div>
              </div>
              <div class="har-start-actions">
                <button class="har-primary-button" type="button" data-har-continue>Tạo nhân vật & bắt đầu</button>
                <button class="har-secondary-button" type="button" data-har-new>Tạo hành trình mới</button>
              </div>
              <div class="har-loading" data-har-loading hidden>
                <div class="har-loading__track"><i data-har-loading-bar></i></div>
                <span data-har-loading-text>Đang chuẩn bị cổng không gian...</span>
                <div class="har-loading__recovery" data-har-loading-recovery hidden>
                  <button class="har-secondary-button" type="button" data-har-retry>Thử lại</button>
                  <button class="har-secondary-button" type="button" data-har-safe-mode>Chạy cấu hình nhẹ</button>
                </div>
              </div>
              <div class="har-status-note" data-har-save-note>Đang kiểm tra tiến trình trên thiết bị...</div>
            </div>
          </section>
        </section>`;
      this.root = this.host.firstElementChild;
    }

    async init() {
      await this.store.open();
      this.savedRecord = await this.store.load("slot1");
      const note = this.root.querySelector("[data-har-save-note]");
      const continueButton = this.root.querySelector("[data-har-continue]");
      if (this.savedRecord?.data) {
        this.state = normalizeState(this.savedRecord.data);
        const date = new Date(this.savedRecord.updatedAt);
        note.textContent = `Có tiến trình v${this.savedRecord.version} · ${Number.isNaN(date.getTime()) ? "đã lưu trên thiết bị" : date.toLocaleString("vi-VN")}`;
        continueButton.textContent = "Tiếp tục hành trình";
      } else {
        note.textContent = this.store.fallback
          ? "IndexedDB không khả dụng · sẽ dùng bộ nhớ cục bộ dự phòng."
          : "Chưa có hành trình · bản mới sẽ được lưu bằng IndexedDB.";
        continueButton.textContent = "Bắt đầu hành trình";
      }
      this.updateCinematicChapterRail(this.currentStoryChapter().id);
      this.bindShellEvents();
      return this;
    }

    setLoading(progress, message) {
      const panel = this.root.querySelector("[data-har-loading]");
      panel.hidden = false;
      panel.style.setProperty("--progress", `${clamp(progress, 0, 100)}%`);
      const text = this.root.querySelector("[data-har-loading-text]");
      if (text) text.textContent = message;
    }

    applyCompatibilityProfile({ forced = false } = {}) {
      const memory = Number(root.navigator?.deviceMemory || 0);
      const cores = Number(root.navigator?.hardwareConcurrency || 0);
      const constrained = forced || (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4);
      if (!constrained) return false;
      this.state.settings.quality = "low";
      this.state.settings.rendererMode = "webgl";
      this.state.settings.visualStyle = forced ? "performance" : this.state.settings.visualStyle;
      this.state.settings.vfxLevel = "static";
      this.state.settings.dynamicResolution = true;
      this.state.settings.microDetail = false;
      this.state.settings.characterMode = "rigged";
      this.state.settings.characterQuality = "near";
      this.state.settings.shadows = "low";
      this.state.settings.postFx = false;
      this.state.settings.weatherDensity = Math.min(38, Number(this.state.settings.weatherDensity || 38));
      this.state.settings.reduceEffects = true;
      this.root.dataset.quality = "low";
      this.root.dataset.compatibility = "true";
      return true;
    }

    async startGame({ fresh = false } = {}) {
      if (this.started || this.destroyed) return;
      this.started = true;
      const continueButton = this.root.querySelector("[data-har-continue]");
      const newButton = this.root.querySelector("[data-har-new]");
      const recovery = this.root.querySelector("[data-har-loading-recovery]");
      const loadingText = this.root.querySelector("[data-har-loading-text]");
      if (recovery) recovery.hidden = true;
      this.root.dataset.characterPreview = "fallback";
      loadingText?.classList.remove("har-unsupported");
      continueButton.disabled = true;
      newButton.disabled = true;
      try {
        if (fresh) {
          await this.store.clear("slot1");
          this.state = defaultState();
          this.savedRecord = null;
        } else if (this.savedRecord?.data) {
          this.state = normalizeState(this.savedRecord.data);
        }
        const compatibilityMode = this.applyCompatibilityProfile({ forced: this.forceCompatibility });
        this.root.dataset.quality = this.state.settings.quality;
        this.root.dataset.visualStyle = this.state.settings.visualStyle;
        this.root.dataset.vfx = this.state.settings.vfxLevel;
        this.setLoading(12, "Đang kiểm tra trình duyệt và bộ nhớ đồ họa...");
        if (!this.supportsRenderer()) throw new Error("Trình duyệt không hỗ trợ WebGL hoặc WebGPU. Hãy bật tăng tốc phần cứng hoặc dùng trình duyệt mới hơn.");
        this.setLoading(28, compatibilityMode
          ? "Đã bật cấu hình nhẹ cho thiết bị này · đang khởi tạo WebGL..."
          : "Đang chọn WebGPU hoặc WebGL2 phù hợp với thiết bị...");
        // WebGPU remains opt-in. Some Chromium/GPU combinations terminate the
        // graphics process instead of throwing a recoverable initialization error.
        const wantsWebGPU = this.state.settings.rendererMode === "webgpu"
          && this.webgpuAvailable
          && this.state.settings.quality !== "low";
        if (wantsWebGPU) {
          try {
            this.THREE = await import("./vendor/three.webgpu.min.js");
            this.rendererBackend = "webgpu";
          } catch {
            this.THREE = await import("./vendor/three.module.min.js");
            this.rendererBackend = "webgl2";
          }
        } else {
          this.THREE = await import("./vendor/three.module.min.js");
          this.rendererBackend = "webgl2";
        }
        if (this.destroyed) return;
        this.setLoading(44, `Đang khởi tạo ${this.rendererBackend.toUpperCase()} và PBR pipeline...`);
        await this.setupRenderer();
        this.setLoading(54, "Đang nạp vật liệu PBR và image-based lighting...");
        await this.loadPhotorealAssets();
        this.setLoading(62, "Đang khởi tạo GLB, skeleton, morph và animation mixer...");
        await this.loadCharacterModules();
        this.setLoading(66, "Đang nạp cây, đá và thảm thực vật CC0...");
        await this.loadLicensedEnvironmentAssets();
        this.setLoading(69, "Đang nạp hai Human Rig 3D và chuyển động toàn thân...");
        await this.loadCharacterAssetsFromPipeline();
        this.createWorld();
        this.setLoading(76, "Đang dựng nhân vật rigged PBR, sinh vật và Nexus Warden...");
        this.createActors();
        this.indexWorldRuntimeObjects();
        this.setLoading(84, "Đang khôi phục nhiệm vụ và kho đồ...");
        this.applyStateToWorld();
        this.resetGameplayCharacterVisibility("initial-scene");
        this.initRuntime();
        this.initAudio();
        this.bindGameEvents();
        this.initRealtime();
        this.setLoading(96, "Đang đồng bộ checkpoint gần nhất...");
        this.updateCamera(true, 0.016);
        this.renderer.render(this.scene, this.camera);
        this.lastRenderSuccessAt = performance.now();
        const needsGenesis = !this.state.appearance.creatorCompletedAt
          || Number(this.state.appearance.creatorVersion || 0) < CHARACTER_VISUAL_VERSION;
        this.running = true;
        this.paused = needsGenesis;
        this.menuPaused = needsGenesis;
        this.pendingStartReveal = !needsGenesis;
        this.startRevealStartedAt = performance.now();
        this.startRevealFrames = 0;
        if (needsGenesis) this.root.querySelector("[data-har-start]").hidden = true;
        else this.setLoading(99, "Đang làm nóng shader và xác nhận khung hình 3D...");
        this.autosaveTimer = root.setInterval(() => this.saveProgress("Autosave"), AUTOSAVE_MS);
        this.lastFrameAt = performance.now();
        this.frameHandle = requestAnimationFrame((time) => this.frame(time));
        this.updateUi(true);
        if (needsGenesis) this.openGenesisCreator();
        else this.beginRuntimeSession(this.savedRecord?.data ? "Đã khôi phục checkpoint gần nhất." : "Hành trình mới bắt đầu tại H-Central.");
      } catch (error) {
        this.resetGraphicsAfterFailure();
        this.started = false;
        continueButton.disabled = false;
        newButton.disabled = false;
        const message = error?.message || "Không khởi động được game.";
        this.setLoading(0, message);
        this.root.querySelector("[data-har-loading-text]")?.classList.add("har-unsupported");
        if (recovery) recovery.hidden = false;
      }
    }

    beginRuntimeSession(message = "Hành trình bắt đầu tại H-Central.") {
      if (this.runtimeStarted) return;
      this.runtimeStarted = true;
      this.paused = false;
      this.menuPaused = false;
      this.lastFrameAt = performance.now();
      if (typeof this.runtime?.start === "function") {
        this.runtime.start({ gameId: GAME_ID, mode: this.authoritative ? "online" : "local" });
      } else {
        this.runtime?.resume?.({ gameId: GAME_ID, reason: "character-ready" });
      }
      this.toast(message, "success");
      this.syncCloud(false);
    }

    cinematicById(id = "central") {
      return ASTRAL_CINEMATICS.find((entry) => entry.id === id) || ASTRAL_CINEMATICS[0];
    }

    cinematicTime(milliseconds = 0) {
      const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
      return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    }

    currentStoryChapter() {
      const chapter = clamp(this.state.story?.chapter ?? 1, 1, ASTRAL_CINEMATICS.length);
      return ASTRAL_CINEMATICS[chapter - 1] || ASTRAL_CINEMATICS[0];
    }

    isStoryChapterUnlocked(chapterId) {
      const cinematic = this.cinematicById(chapterId);
      return cinematic.chapter <= (this.state.story?.chapter || 1);
    }

    recordStoryEvent(eventId) {
      const normalized = String(eventId || "").slice(0, 80);
      if (!normalized) return false;
      this.state.story ||= defaultStoryState();
      this.state.story.completedEvents ||= [];
      if (this.state.story.completedEvents.includes(normalized)) return false;
      this.state.story.completedEvents = [...this.state.story.completedEvents, normalized].slice(-80);
      return true;
    }

    completeStoryChapter(chapterNumber, { save = true } = {}) {
      const current = this.currentStoryChapter();
      if (current.chapter !== chapterNumber || this.state.story.step === "complete") return false;
      this.recordStoryEvent(`chapter:${chapterNumber}:complete`);
      if (chapterNumber >= ASTRAL_CINEMATICS.length) {
        this.state.story.step = "complete";
        this.recordStoryEvent("nexus:repaired");
        this.toast("Nexus Echo hoàn tất · mạng Astral đã được sửa và bản ngã của Nax được bảo toàn.", "success");
      } else {
        this.state.story.chapter = chapterNumber + 1;
        this.state.story.step = "cinematic";
        const next = this.currentStoryChapter();
        this.toast(`Đã mở Chương ${next.chapter}: ${next.title}`, "success");
      }
      this.updateCinematicChapterRail();
      if (save) this.saveProgress(`Nexus Echo · hoàn tất chương ${chapterNumber}`);
      return true;
    }

    evaluateStoryProgress({ save = true } = {}) {
      const current = this.currentStoryChapter();
      const events = this.state.story?.completedEvents || [];
      const cinematicComplete = events.includes(`cinematic:${current.id}`);
      const objectiveComplete = events.includes(current.requiredEvent)
        || (current.requiredEvent === "quest:awakening" && this.state.quests.awakening?.status === "completed")
        || (current.requiredEvent.startsWith("restored:") && this.state.world?.zones?.[current.id]?.restored === true);
      if (!cinematicComplete) {
        this.state.story.step = "cinematic";
        return false;
      }
      if (!objectiveComplete) {
        this.state.story.step = "mission";
        this.updateCinematicChapterRail();
        return false;
      }
      this.recordStoryEvent(current.requiredEvent);
      return this.completeStoryChapter(current.chapter, { save });
    }

    updateCinematicChapterRail(activeId = this.cinematicSequence.chapterId) {
      const overlay = this.root?.querySelector("[data-har-cinematic-player]");
      if (!overlay) return;
      const storyChapter = this.state.story?.chapter || 1;
      overlay.querySelectorAll("[data-cinematic-chapter]").forEach((button) => {
        const cinematic = this.cinematicById(button.dataset.cinematicChapter);
        const zone = ZONES.find((entry) => entry.id === cinematic.id);
        const locked = cinematic.chapter > storyChapter;
        const complete = (this.state.story?.completedEvents || []).includes(`chapter:${cinematic.chapter}:complete`);
        const active = cinematic.id === activeId;
        button.disabled = locked;
        button.classList.toggle("is-locked", locked);
        button.classList.toggle("is-complete", complete);
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-disabled", String(locked));
        button.setAttribute("aria-pressed", String(active));
        button.title = locked
          ? `Hoàn thành Chương ${cinematic.chapter - 1} để mở khóa`
          : complete
            ? `Xem lại ${cinematic.title} · không thay đổi save`
            : `Chương hiện tại · ${cinematic.title}`;
        const status = button.querySelector("small");
        if (status) status.textContent = locked ? "Đã khóa" : complete ? `Xem lại · ${zone?.name || cinematic.id}` : `Hiện tại · ${zone?.name || cinematic.id}`;
      });
      const selected = this.cinematicById(activeId);
      const enter = overlay.querySelector('[data-cinematic-action="enter"]');
      if (enter) {
        const canEnter = selected.chapter === storyChapter && this.state.story?.step !== "complete";
        enter.disabled = !canEnter;
        enter.textContent = canEnter ? "Vào nhiệm vụ chính →" : selected.chapter < storyChapter ? "Chương đã hoàn thành" : "Nexus Echo hoàn tất";
      }
    }

    createCinematicScene() {
      if (this.cinematicScene) return this.cinematicScene;
      const THREE = this.THREE;
      const scene = new THREE.Scene();
      scene.name = "NexusEchoCinematicScene";
      scene.background = new THREE.Color(0x070b12);
      scene.environment = this.scene?.environment || null;
      scene.fog = new THREE.FogExp2(0x101927, 0.008);

      const hemisphere = new THREE.HemisphereLight(0xeaf3ff, 0x161820, 0.48);
      hemisphere.name = "CinematicFill";
      const key = new THREE.DirectionalLight(0xfff3e3, 3.4);
      key.name = "CinematicKey";
      key.castShadow = Boolean(this.renderer?.shadowMap?.enabled);
      key.shadow.mapSize.set(this.state.settings.quality === "cinematic" ? 2048 : 1024, this.state.settings.quality === "cinematic" ? 2048 : 1024);
      key.shadow.bias = -0.00012;
      key.shadow.normalBias = 0.025;
      const rim = new THREE.DirectionalLight(0x9fcfff, 1.25);
      rim.name = "CinematicRim";
      const practical = new THREE.PointLight(0x72dfff, 1.6, 26, 2);
      practical.name = "CinematicPractical";
      scene.add(hemisphere, key, key.target, rim, rim.target, practical);
      scene.userData.lightRig = { hemisphere, key, rim, practical };
      this.cinematicScene = scene;
      this.cinematicScratch = {
        box: new THREE.Box3(),
        size: new THREE.Vector3(),
        center: new THREE.Vector3(),
        top: new THREE.Vector3(),
        bottom: new THREE.Vector3(),
        matrix: new THREE.Matrix4(),
        frustum: new THREE.Frustum(),
        shot: new THREE.Vector3(),
        actor: new THREE.Vector3(),
        targetFocus: new THREE.Vector3(),
        cinematicPosition: new THREE.Vector3(),
        forward: new THREE.Vector3(),
        cameraRight: new THREE.Vector3(),
        upTarget: new THREE.Vector3(),
        worldUp: new THREE.Vector3(0, 1, 0)
      };
      return scene;
    }

    buildCinematicFilmSet(zone) {
      const THREE = this.THREE;
      const profile = BIOME_PROFILES[zone.id] || BIOME_PROFILES.central;
      const group = new THREE.Group();
      group.name = `NexusEchoFilmSet:${zone.id}`;
      group.userData.zoneId = zone.id;

      const accent = new THREE.Color(profile.accent);
      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(Math.min(24, zone.radius * 0.78), 96),
        new THREE.MeshPhysicalMaterial({
          color: accent.clone().lerp(new THREE.Color(0x30343a), 0.82),
          map: this.terrainTexture,
          bumpMap: this.terrainSurfaceTextures?.height || null,
          bumpScale: 0.16,
          normalMap: this.terrainSurfaceTextures?.normal || null,
          roughnessMap: this.terrainSurfaceTextures?.roughness || null,
          aoMap: this.terrainSurfaceTextures?.ao || null,
          roughness: 0.88,
          metalness: zone.id === "station" ? 0.22 : 0.035,
          clearcoat: zone.id === "ocean" ? 0.28 : 0.06,
          envMapIntensity: 0.64
        })
      );
      floor.name = `CinematicFloor:${zone.id}`;
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(zone.x, 1.01, zone.z);
      floor.receiveShadow = true;
      floor.userData.cinematicOwned = true;
      group.add(floor);

      const streamSource = this.streamingGroups.get(zone.id);
      if (streamSource) {
        const clone = new THREE.Group();
        clone.name = `CinematicDecor:${zone.id}`;
        clone.visible = true;
        streamSource.children.forEach((child) => {
          if (child.userData?.licensedAsset !== true || child.userData?.lodPriority === "environment-far") return;
          clone.add(child.clone(true));
        });
        clone.traverse((object) => {
          object.userData ||= {};
          object.userData.cinematicDecoration = true;
          if (object.isMesh) object.castShadow = Boolean(object.castShadow && this.state.settings.quality !== "low");
        });
        if (clone.children.length) group.add(clone);
      }

      let directDecorCount = 0;
      for (const object of this.world?.children || []) {
        if (directDecorCount >= 48 || object === this.playerMesh || object === this.playerShadow || object === this.terrainGround) continue;
        if (object.name?.startsWith("Stream:") || object.name?.startsWith("LivingBiome:") || object.name?.startsWith("DynamicPebbles:")) continue;
        if (object.isSprite || object.isPoints || object.userData?.type || object.userData?.boss || object.userData?.livingParticles || object.userData?.characterRuntime) continue;
        if (object.userData?.licensedAsset !== true) continue;
        const distance = Math.hypot(object.position.x - zone.x, object.position.z - zone.z);
        if (distance > zone.radius + 4) continue;
        const clone = object.clone(true);
        clone.userData = { ...(clone.userData || {}), cinematicDecoration: true };
        clone.traverse((child) => {
          child.userData ||= {};
          child.userData.cinematicDecoration = true;
        });
        group.add(clone);
        directDecorCount += 1;
      }
      return group;
    }

    releaseCinematicFilmSet(group) {
      if (!group) return;
      group.parent?.remove(group);
      group.traverse((object) => {
        if (!object.userData?.cinematicOwned) return;
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => material.dispose?.());
      });
    }

    prepareCinematicFilmSets(zone) {
      const scene = this.createCinematicScene();
      const currentIndex = ASTRAL_CINEMATICS.findIndex((entry) => entry.id === zone.id);
      const retain = new Set([zone.id, ASTRAL_CINEMATICS[currentIndex + 1]?.id].filter(Boolean));
      this.cinematicSetCache.forEach((group, id) => {
        if (retain.has(id)) return;
        this.releaseCinematicFilmSet(group);
        this.cinematicSetCache.delete(id);
      });
      retain.forEach((id) => {
        if (this.cinematicSetCache.has(id)) return;
        const nextZone = ZONES.find((entry) => entry.id === id);
        if (nextZone) this.cinematicSetCache.set(id, this.buildCinematicFilmSet(nextZone));
      });
      if (this.cinematicSetGroup) this.cinematicSetGroup.parent?.remove(this.cinematicSetGroup);
      this.cinematicSetGroup = this.cinematicSetCache.get(zone.id) || null;
      if (this.cinematicSetGroup) {
        this.cinematicSetGroup.visible = true;
        scene.add(this.cinematicSetGroup);
      }
      const profile = BIOME_PROFILES[zone.id] || BIOME_PROFILES.central;
      scene.background.set(profile.fog).multiplyScalar(0.42);
      scene.fog.color.set(profile.fog);
      scene.fog.density = Math.min(0.012, profile.fogDensity * 0.72);
      const { key, rim, practical } = scene.userData.lightRig;
      key.position.set(zone.x - 9, 14, zone.z + 10);
      key.target.position.set(zone.x, 2, zone.z);
      rim.color.set(profile.accent);
      rim.position.set(zone.x + 8, 9, zone.z - 11);
      rim.target.position.set(zone.x, 2, zone.z);
      practical.color.set(profile.accent);
      practical.position.set(zone.x - 4, 4.5, zone.z + 1);
    }

    enterCinematicScene(zone) {
      const scene = this.createCinematicScene();
      if (!this.cinematicActorRestore) {
        this.cinematicActorRestore = {
          parent: this.playerMesh.parent || this.world,
          position: this.playerMesh.position.clone(),
          quaternion: this.playerMesh.quaternion.clone(),
          scale: this.playerMesh.scale.clone()
        };
        this.playerMesh.parent?.remove(this.playerMesh);
        scene.add(this.playerMesh);
      }
      if (this.playerShadow && !this.cinematicShadowRestore) {
        this.cinematicShadowRestore = {
          parent: this.playerShadow.parent || this.world,
          position: this.playerShadow.position.clone(),
          quaternion: this.playerShadow.quaternion.clone(),
          scale: this.playerShadow.scale.clone()
        };
        this.playerShadow.parent?.remove(this.playerShadow);
        scene.add(this.playerShadow);
      }
      this.prepareCinematicFilmSets(zone);
      return true;
    }

    restoreGameplaySceneFromCinematic() {
      const restoreObject = (object, restore) => {
        if (!object || !restore) return;
        object.parent?.remove(object);
        restore.parent?.add(object);
        object.position.copy(restore.position);
        object.quaternion.copy(restore.quaternion);
        object.scale.copy(restore.scale);
      };
      restoreObject(this.playerMesh, this.cinematicActorRestore);
      restoreObject(this.playerShadow, this.cinematicShadowRestore);
      this.cinematicActorRestore = null;
      this.cinematicShadowRestore = null;
      this.cinematicSetCache.forEach((group) => this.releaseCinematicFilmSet(group));
      this.cinematicSetCache.clear();
      this.cinematicSetGroup = null;
      this.cinematicScene = null;
      this.cinematicScratch = null;
    }

    validateCinematicSubject() {
      const THREE = this.THREE;
      const scratch = this.cinematicScratch;
      if (!scratch || !this.playerMesh || !this.camera) return { ready: false, reason: "missing-subject" };
      let triangles = 0;
      let opaqueMeshes = 0;
      this.playerMesh.traverse((object) => {
        if (!object.visible || !object.isMesh || !object.geometry?.attributes?.position) return;
        const positionCount = object.geometry.attributes.position.count || 0;
        triangles += object.geometry.index ? object.geometry.index.count / 3 : positionCount / 3;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        if (materials.some((material) => material?.visible !== false && Number(material?.opacity ?? 1) > 0.08)) opaqueMeshes += 1;
      });
      scratch.box.setFromObject(this.playerMesh, true);
      scratch.box.getSize(scratch.size);
      scratch.box.getCenter(scratch.center);
      this.camera.updateMatrixWorld(true);
      scratch.matrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
      scratch.frustum.setFromProjectionMatrix(scratch.matrix);
      scratch.top.copy(scratch.center).setY(scratch.box.max.y).project(this.camera);
      scratch.bottom.copy(scratch.center).setY(scratch.box.min.y).project(this.camera);
      const screenHeight = this.renderer?.domElement?.clientHeight || 1;
      const projectedPixels = Math.abs(scratch.top.y - scratch.bottom.y) * 0.5 * screenHeight;
      const finiteBounds = [scratch.size.x, scratch.size.y, scratch.size.z].every(Number.isFinite) && scratch.size.y > 0.5;
      const ready = finiteBounds
        && triangles >= 500
        && opaqueMeshes > 0
        && scratch.frustum.intersectsBox(scratch.box)
        && projectedPixels >= Math.max(110, screenHeight * 0.22);
      return { ready, finiteBounds, triangles: Math.round(triangles), opaqueMeshes, projectedPixels: Math.round(projectedPixels) };
    }

    confirmCinematicSubjectFrame(renderedAt) {
      const sequence = this.cinematicSequence;
      if (!sequence.active || !sequence.waitingForSubject || renderedAt <= sequence.startedAt) return;
      const report = this.validateCinematicSubject();
      sequence.subjectReport = report;
      sequence.validSubjectFrames = report.ready ? sequence.validSubjectFrames + 1 : 0;
      if (sequence.validSubjectFrames < 2) return;
      sequence.waitingForSubject = false;
      sequence.playing = sequence.pendingAutoplay;
      sequence.startedAt = performance.now();
      this.root.dataset.cinematicState = sequence.playing ? "playing" : "paused";
      const toggle = this.root.querySelector('[data-cinematic-action="toggle"]');
      if (toggle) toggle.textContent = sequence.playing ? "Ⅱ Tạm dừng" : "▶ Tiếp tục";
    }

    openCinematicGallery(chapterId = this.currentStoryChapter().id, { source = "manual", autoplay = true } = {}) {
      if (!this.running || this.genesisActive || !this.playerMesh) return false;
      const overlay = this.root.querySelector("[data-har-cinematic-player]");
      if (!overlay) return false;
      if (!this.isStoryChapterUnlocked(chapterId)) chapterId = this.currentStoryChapter().id;
      const wasActive = this.cinematicSequence.active;
      if (!wasActive) {
        this.cinematicSequence.restoreMenuPaused = this.menuPaused;
        this.cinematicSequence.restorePaused = this.paused;
        this.cinematicSequence.restoreZone = this.currentZone;
      }
      this.cinematicSequence.active = true;
      this.cinematicSequence.source = source;
      this.menuPaused = true;
      this.paused = false;
      this.keys.clear();
      overlay.hidden = false;
      this.root.classList.add("is-story-cinematic", "is-cinematic");
      const playerName = overlay.querySelector("[data-cinematic-player-name]");
      if (playerName) playerName.textContent = this.state.player.name || "Nhà du hành";
      this.playCinematicChapter(chapterId, { autoplay });
      return true;
    }

    playCinematicChapter(chapterId = "central", { autoplay = true } = {}) {
      const cinematic = this.cinematicById(chapterId);
      if (!this.isStoryChapterUnlocked(cinematic.id)) {
        this.toast(`Chương ${cinematic.chapter} đang khóa · hãy hoàn thành nhiệm vụ chính trước.`, "error");
        this.updateCinematicChapterRail();
        return null;
      }
      const zone = ZONES.find((entry) => entry.id === cinematic.id) || ZONES[0];
      const now = performance.now();
      this.enterCinematicScene(zone);
      Object.assign(this.cinematicSequence, {
        chapterId: cinematic.id,
        startedAt: now,
        elapsedBeforePause: 0,
        playing: false,
        completed: false,
        progress: 0,
        waitingForSubject: true,
        pendingAutoplay: autoplay,
        validSubjectFrames: 0,
        subjectReport: null,
        replayOnly: cinematic.chapter < (this.state.story?.chapter || 1)
      });
      const lift = Number(this.playerMesh.userData?.gameplayGroundOffset ?? this.playerMesh.userData?.gameplayVisualLift ?? 0);
      const direction = cinematic.chapter % 2 ? 1 : -1;
      this.playerMesh.position.set(zone.x - direction * 2.4, 1.05 + lift, zone.z + direction * 1.6);
      this.playerMesh.rotation.y = direction > 0 ? -0.5 : 0.5;
      this.playerMesh.visible = true;
      if (cinematic.camera === "opening-six-shot" && this.camera) {
        const initialOffset = this.cinematicScratch?.shot || new this.THREE.Vector3();
        initialOffset.set(-9.2, 6.1, 11.8);
        this.camera.position.copy(this.playerMesh.position).add(initialOffset);
        this.camera.up.set(0, 1, 0);
        const initialFocus = this.cinematicScratch?.targetFocus || new this.THREE.Vector3();
        initialFocus.copy(this.playerMesh.position).setY(this.playerMesh.position.y + 1.8);
        this.camera.lookAt(initialFocus);
      }
      if (this.playerShadow) {
        this.playerShadow.visible = true;
        this.playerShadow.position.set(this.playerMesh.position.x, 1.08, this.playerMesh.position.z);
      }
      this.setCharacterAction("idle", 100, 0);
      const overlay = this.root.querySelector("[data-har-cinematic-player]");
      if (overlay) {
        overlay.style.setProperty("--cinema-accent", zone.color);
        const assign = (selector, value) => { const node = overlay.querySelector(selector); if (node) node.textContent = value; };
        assign("[data-cinematic-number]", String(cinematic.chapter).padStart(2, "0"));
        assign("[data-cinematic-kicker]", cinematic.kicker);
        assign("[data-cinematic-title]", cinematic.title);
        assign("[data-cinematic-description]", cinematic.description);
        assign("[data-cinematic-objective]", cinematic.objective);
        assign("[data-cinematic-current]", "00:00");
        assign("[data-cinematic-duration]", this.cinematicTime(cinematic.duration));
        this.updateCinematicChapterRail(cinematic.id);
        const toggle = overlay.querySelector('[data-cinematic-action="toggle"]');
        if (toggle) toggle.textContent = "Đang căn khung hình…";
        const progress = overlay.querySelector("[data-cinematic-progress]");
        if (progress) progress.style.width = "0%";
      }
      this.root.dataset.cinematicChapter = cinematic.id;
      this.root.dataset.cinematicState = "preparing";
      return cinematic;
    }

    toggleCinematicPlayback() {
      if (!this.cinematicSequence.active) return;
      const cinematic = this.cinematicById(this.cinematicSequence.chapterId);
      const now = performance.now();
      if (now - Number(this.lastCinematicToggleAt || 0) < 160) return;
      this.lastCinematicToggleAt = now;
      if (this.cinematicSequence.waitingForSubject) return;
      if (this.cinematicSequence.completed) return this.playCinematicChapter(cinematic.id, { autoplay: true });
      if (this.cinematicSequence.playing) {
        this.cinematicSequence.elapsedBeforePause += now - this.cinematicSequence.startedAt;
        this.cinematicSequence.playing = false;
      } else {
        this.cinematicSequence.startedAt = now;
        this.cinematicSequence.playing = true;
      }
      const toggle = this.root.querySelector('[data-cinematic-action="toggle"]');
      if (toggle) toggle.textContent = this.cinematicSequence.playing ? "Ⅱ Tạm dừng" : "▶ Tiếp tục";
      this.root.dataset.cinematicState = this.cinematicSequence.playing ? "playing" : "paused";
    }

    closeCinematicGallery({ enterZone = false } = {}) {
      const overlay = this.root.querySelector("[data-har-cinematic-player]");
      if (!this.cinematicSequence.active && overlay?.hidden !== false) return;
      const cinematic = this.cinematicById(this.cinematicSequence.chapterId);
      const zone = ZONES.find((entry) => entry.id === cinematic.id) || ZONES[0];
      if (enterZone && cinematic.chapter !== (this.state.story?.chapter || 1)) {
        this.toast("Chương cũ chỉ dùng để xem lại và không thay đổi tiến trình.", "error");
        return;
      }
      if (enterZone) {
        this.state.player.x = zone.x;
        this.state.player.z = zone.z + Math.min(5, zone.radius * 0.2);
        this.state.player.y = 1.05;
        if (this.state.world?.zones?.[zone.id]) this.state.world.zones[zone.id].discovered = true;
        this.currentZone = zone;
      } else if (this.cinematicSequence.restoreZone) {
        this.currentZone = this.cinematicSequence.restoreZone;
      }
      // Release the modal first. Scene restoration is best-effort and must
      // never trap the player behind the cinematic overlay.
      this.menuPaused = this.cinematicSequence.restoreMenuPaused;
      this.paused = this.cinematicSequence.restorePaused;
      this.cinematicSequence.active = false;
      this.cinematicSequence.playing = false;
      this.cinematicSequence.completed = false;
      this.cinematicSequence.waitingForSubject = false;
      if (overlay) overlay.hidden = true;
      this.root.classList.remove("is-story-cinematic", "is-cinematic");
      delete this.root.dataset.cinematicChapter;
      this.root.dataset.cinematicState = "closed";
      try {
        this.restoreGameplaySceneFromCinematic();
        this.positionCharacterInWorld(this.playerMesh, this.state.player.x, this.state.player.y, this.state.player.z);
        this.playerMesh.rotation.y = this.state.player.rotation;
        if (this.playerShadow) this.playerShadow.position.set(this.state.player.x, 1.08, this.state.player.z);
        this.applyBiomeVisualState(this.currentZone);
        this.updateWorldStreaming();
        this.camera.up.set(0, 1, 0);
        this.updateCamera(true, 0.016);
      } catch (error) {
        console.warn("Astral cinematic scene restore recovered:", error?.message || error);
      }
      if (enterZone) {
        this.state.story.step = "mission";
        this.toast(`Đã tới ${zone.name} · nhiệm vụ chính Chương ${String(cinematic.chapter).padStart(2, "0")}`, "success");
        this.saveProgress(`Nexus Echo ${cinematic.chapter} · ${zone.name}`);
      }
    }

    updateStoryCinematic(dt, time) {
      const sequence = this.cinematicSequence;
      if (!sequence.active || !this.playerMesh) return;
      const cinematic = this.cinematicById(sequence.chapterId);
      const zone = ZONES.find((entry) => entry.id === cinematic.id) || ZONES[0];
      // Some embedded browsers expose a requestAnimationFrame timestamp with a
      // different time origin. Keep playback on performance.now() end-to-end so
      // a cinematic cannot jump straight to 100% after tab restore.
      const playbackNow = performance.now();
      const elapsed = sequence.elapsedBeforePause + (sequence.playing ? Math.max(0, playbackNow - sequence.startedAt) : 0);
      const progress = clamp(elapsed / cinematic.duration, 0, 1);
      sequence.progress = progress;
      if (progress >= 1 && sequence.playing) {
        sequence.playing = false;
        sequence.completed = true;
        sequence.elapsedBeforePause = cinematic.duration;
        const recorded = this.recordStoryEvent(`cinematic:${cinematic.id}`);
        const advanced = this.evaluateStoryProgress({ save: true });
        if (recorded && !advanced) this.saveProgress(`Nexus Echo · cinematic chương ${cinematic.chapter}`);
        this.root.dataset.cinematicState = "completed";
        const toggle = this.root.querySelector('[data-cinematic-action="toggle"]');
        if (toggle) toggle.textContent = "↺ Phát lại";
        this.updateCinematicChapterRail(cinematic.id);
      }
      const direction = cinematic.chapter % 2 ? 1 : -1;
      const lift = Number(this.playerMesh.userData?.gameplayGroundOffset ?? this.playerMesh.userData?.gameplayVisualLift ?? 0);
      const opening = cinematic.camera === "opening-six-shot";
      const travel = opening
        ? clamp((progress - 0.48) / 0.28, 0, 1)
        : progress < 0.7 ? progress / 0.7 : 1;
      const easedTravel = travel * travel * (3 - 2 * travel);
      const startX = opening ? -1.65 : direction * -2.4;
      const startZ = opening ? 3.4 : direction * 1.6;
      const travelX = opening ? 2.45 : direction * 3.2;
      const travelZ = opening ? -2.8 : direction * -2.1;
      this.playerMesh.position.set(
        zone.x + startX + easedTravel * travelX,
        1.05 + lift + (cinematic.id === "sky" ? Math.sin(progress * Math.PI) * 1.35 : cinematic.id === "void" ? Math.sin(progress * Math.PI * 2) * 0.24 : 0),
        zone.z + startZ + easedTravel * travelZ
      );
      const pathYaw = Math.atan2(travelX, travelZ);
      const cameraYaw = Math.atan2(
        this.camera.position.x - this.playerMesh.position.x,
        this.camera.position.z - this.playerMesh.position.z
      );
      const turnToCamera = clamp((progress - 0.54) / 0.24, 0, 1);
      const yawDelta = Math.atan2(Math.sin(cameraYaw - pathYaw), Math.cos(cameraYaw - pathYaw));
      this.playerMesh.rotation.y = pathYaw + yawDelta * (turnToCamera * turnToCamera * (3 - 2 * turnToCamera));
      if (this.playerShadow) this.playerShadow.position.set(this.playerMesh.position.x, 1.08, this.playerMesh.position.z);
      const runtime = this.playerMesh.userData?.characterRuntime || this.characterRuntimes.get(this.state.roster.activeId);
      const motion = opening
        ? progress < 0.48 ? "idle" : progress < 0.76 ? "walk" : progress < 0.9 ? "talk" : "idle"
        : progress < 0.68
          ? cinematic.motion === "glide" ? "glide" : cinematic.motion === "talk" ? "walk" : cinematic.motion || "walk"
          : cinematic.motion === "attack1" ? "attack1" : cinematic.motion === "talk" ? "talk" : "idle";
      if (runtime?.mixer) {
        this.playCharacterClip(runtime, motion);
        if (sequence.playing) runtime.mixer.update(dt);
      } else if (runtime && sequence.playing) {
        this.applyProceduralRigMotion(runtime, time, motion, dt);
      }
      this.applyNaturalHandPose(runtime, motion, dt);
      this.applyProceduralFacialPerformance(this.playerMesh, time, progress > 0.72 ? "talk" : motion);
      this.updateSecondaryCharacterMotion(runtime, time, { moving: motion === "walk", sprinting: false, direction: 0 });
      const overlay = this.root.querySelector("[data-har-cinematic-player]");
      if (overlay) {
        const current = overlay.querySelector("[data-cinematic-current]");
        const bar = overlay.querySelector("[data-cinematic-progress]");
        if (current) current.textContent = this.cinematicTime(Math.min(elapsed, cinematic.duration));
        if (bar) bar.style.width = `${(progress * 100).toFixed(2)}%`;
      }
      this.root.style.setProperty("--cinematic-progress", progress.toFixed(4));
      if (opening) {
        const shotNumber = progress < 0.16 ? 1 : progress < 0.34 ? 2 : progress < 0.5 ? 3 : progress < 0.7 ? 4 : progress < 0.86 ? 5 : 6;
        sequence.shot = shotNumber;
        this.root.dataset.cinematicShot = String(shotNumber);
      } else {
        sequence.shot = 1;
        this.root.dataset.cinematicShot = "1";
      }
    }

    renderGenesisCreator() {
      const id = this.state.roster.activeId;
      const recipe = this.activeAppearanceRecipe();
      const group = APPEARANCE_GROUPS.find((item) => item.id === this.appearanceGroup) || APPEARANCE_GROUPS[0];
      const mesh = this.characterMeshes.get(id);
      const runtime = this.characterRuntimes.get(id);
      const fit = this.buildAppearanceFitReport(recipe, mesh);
      const modelLabels = {
        "valid-asian-f-1-casual": ["Asteria Real Human", "VALID rig · full-body · facial morph · local GLB"],
        "valid-asian-m-1-casual": ["Cael Real Human", "VALID rig · full-body · facial morph · local GLB"],
        "valid-black-f-1-casual": ["Nyx Real Human", "VALID rig · full-body · facial morph · local GLB"],
        "valid-white-m-1-casual": ["Sol Real Human", "VALID rig · full-body · facial morph · local GLB"],
        "human-adult-a01": ["Asteria Human", "Human Rig · 16K vertices · Digital Human runtime"],
        "human-adult-b01": ["Vanguard Human", "Combat Rig · 7K vertices · LOD hiệu năng"]
      };
      const faceChannels = Math.min(52, Number(runtime?.facialChannels || 0));
      const boneCount = runtime?.bones ? Object.values(runtime.bones).filter(Boolean).length : 0;
      const bakedMotionCount = this.motionLibraryManifest?.clips?.length || 0;
      const visibility = this.genesisVisibility?.report;
      const catalogModels = [...new Map(this.characterPipelineManifest
        .filter((entry) => entry.provider === "valid-avatar")
        .map((entry) => [entry.modelId, entry])).values()];
      const dna = encodeCharacterDNA(recipe, id);
      const option = (value, label, selected) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`;
      return `
        <div class="har-genesis-editor__intro">
          <small>DIGITAL HUMAN CORE V${CHARACTER_VISUAL_VERSION} · ${escapeHtml(modelLabels[recipe.baseModel]?.[0] || "HUMAN RIG")}</small>
          <h2>Tạo con người 3D của bạn</h2>
          <p>Chỉnh trực tiếp mesh có xương, vật liệu da nhiều lớp, biểu cảm, viseme và LOD trong khung hình thật của game.</p>
        </div>
        <div class="har-genesis-capabilities" aria-label="Năng lực Digital Human">
          <div><small>FACE DRIVER</small><strong>52 driven · ${faceChannels} native</strong><span>${boneCount} bone nhận diện · morph + bone fallback</span></div>
          <div><small>SURFACE</small><strong>5 lớp</strong><span>pore · roughness · SSS · flush · wetness</span></div>
          <div><small>MOTION V13</small><strong>${bakedMotionCount} baked clip</strong><span>blend space · phase sync · raycast foot IK</span></div>
          <div><small>LOD</small><strong>${escapeHtml(mesh?.userData?.modelTier || "near")}</strong><span data-genesis-lod-status>${visibility?.ready ? "Đã xác nhận trong camera" : "Đang giữ fallback an toàn"}</span></div>
        </div>
        <div class="har-genesis-fit ${fit.level}" aria-live="polite">
          <div><span class="har-genesis-fit__orb"></span><div><small>FIT & SILHOUETTE CHECK</small><strong>${escapeHtml(fit.label)} · ${fit.score}%</strong><span>${escapeHtml(fit.summary)}</span></div></div>
          <div class="har-genesis-fit__actions">
            <button type="button" data-genesis-action="auto-fit">Tự cân đối</button>
            <button type="button" class="${this.genesisTurntable ? "is-active" : ""}" data-genesis-action="toggle-turntable" aria-pressed="${this.genesisTurntable}">${this.genesisTurntable ? "Dừng xoay 360°" : "Xoay 360°"}</button>
          </div>
          ${fit.warnings.length ? `<ul>${fit.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>` : ""}
        </div>
        <label class="har-genesis-name">Tên Nhà du hành
          <input type="text" maxlength="40" value="${escapeHtml(this.state.player.name || "")}" data-genesis-name autocomplete="off">
        </label>
        <div class="har-genesis-block">
          <div class="har-genesis-block__title"><strong>Nền cơ thể 3D</strong><span>${runtime?.bones ? Object.keys(runtime.bones).length : 0} bone nhận diện</span></div>
          <label class="har-field">Thư viện người thật · ${catalogModels.length} model
            <select data-genesis-catalog>
              ${catalogModels.map((entry) => `<option value="${escapeHtml(entry.modelId)}" ${recipe.baseModel === entry.modelId ? "selected" : ""}>${escapeHtml(entry.label)}</option>`).join("")}
            </select>
          </label>
          <div class="har-genesis-models">
            ${Object.entries(modelLabels).map(([value, item]) => `<button type="button" class="${recipe.baseModel === value ? "is-active" : ""}" data-genesis-base="${value}"><i></i><strong>${item[0]}</strong><span>${item[1]}</span></button>`).join("")}
          </div>
        </div>
        <div class="har-genesis-block">
          <div class="har-genesis-block__title"><strong>Kiểu vóc dáng</strong><span>giữ collider gameplay cân bằng</span></div>
          <div class="har-genesis-presets">
            ${Object.entries(APPEARANCE_PRESETS).map(([value, item]) => `<button type="button" class="${recipe.bodyPreset === value ? "is-active" : ""}" data-genesis-preset="${value}">${item.label}</button>`).join("")}
          </div>
        </div>
        <div class="har-genesis-colors">
          <label>Da<input type="color" value="${recipe.skinColor}" data-genesis-setting="skinColor"></label>
          <label>Mắt<input type="color" value="${recipe.eyeColor}" data-genesis-setting="eyeColor"></label>
          <label>Tóc<input type="color" value="${recipe.hairColor}" data-genesis-setting="hairColor"></label>
          <span><strong>Digital Skin</strong><small>micro-normal · roughness zones · skin response</small></span>
        </div>
        <div class="har-genesis-assets">
          <label>Tóc<select data-genesis-setting="hair">
            ${option("astral-layered-07", "Astral Layered", recipe.hair)}
            ${option("aurora-short-02", "Aurora Short", recipe.hair)}
            ${option("void-long-04", "Void Long", recipe.hair)}
            ${option("solar-braid-03", "Solar Braid", recipe.hair)}
          </select></label>
          <label>Râu<select data-genesis-setting="beard">
            ${option("none", "Không râu", recipe.beard)}
            ${option("shadow-01", "Râu bóng nhẹ", recipe.beard)}
            ${option("short-boxed-02", "Short Boxed", recipe.beard)}
            ${option("astral-goatee-03", "Astral Goatee", recipe.beard)}
          </select></label>
          <label>Lông mày<select data-genesis-setting="brow">
            ${option("natural-01", "Tự nhiên", recipe.brow)}
            ${option("soft-02", "Mềm", recipe.brow)}
            ${option("defined-03", "Sắc nét", recipe.brow)}
            ${option("bold-04", "Đậm", recipe.brow)}
          </select></label>
          <label>Makeup<select data-genesis-setting="makeup">
            ${option("none", "Không makeup", recipe.makeup)}
            ${option("natural", "Natural", recipe.makeup)}
            ${option("nebula", "Nebula", recipe.makeup)}
            ${option("cyber", "Cyber", recipe.makeup)}
            ${option("solar", "Solar", recipe.makeup)}
          </select></label>
          <label>Phụ kiện<select data-genesis-setting="accessory">
            ${option("none", "Không", recipe.accessory)}
            ${option("ear-cuff", "Ear Cuff", recipe.accessory)}
            ${option("visor", "Astral Visor", recipe.accessory)}
            ${option("astral-mark", "Astral Mark", recipe.accessory)}
          </select></label>
          <label>Trang phục<select data-genesis-setting="outfitPrimary">
            ${option("central-jacket-02", "Central Jacket", recipe.outfit[0])}
            ${option("combat-boots-01", "Combat Set", recipe.outfit[0])}
            ${option("aurora-suit-01", "Aurora Suit", recipe.outfit[0])}
            ${option("void-coat-01", "Void Coat", recipe.outfit[0])}
          </select></label>
        </div>
        <div class="har-genesis-tabs" role="tablist" aria-label="Nhóm chỉnh ngoại hình">
          ${APPEARANCE_GROUPS.map((item) => `<button type="button" class="${item.id === group.id ? "is-active" : ""}" data-genesis-group="${item.id}" role="tab" aria-selected="${item.id === group.id}">${item.label}</button>`).join("")}
        </div>
        <div class="har-genesis-sliders">
          ${group.controls.map(([controlId, label]) => {
            const control = APPEARANCE_CONTROL_MAP[controlId];
            const value = recipe.morphs[controlId] ?? control.defaultValue;
            return `<label><span>${escapeHtml(label)}<output data-genesis-output="${controlId}">${Math.round(value * 100)}</output></span><input type="range" min="0" max="1" step="0.01" value="${value}" data-genesis-morph="${controlId}" aria-label="${escapeHtml(label)}"></label>`;
          }).join("")}
        </div>
        <div class="har-genesis-detail-grid">
          <fieldset><legend>Chi tiết khuôn mặt</legend>
            ${Object.entries(recipe.decals).map(([key, value]) => `<label><span>${escapeHtml({ freckles: "Tàn nhang", scars: "Sẹo", moles: "Nốt ruồi", makeup: "Cường độ makeup", tattoos: "Hình xăm", wrinkles: "Nếp nhăn", eyeShadow: "Quầng mắt", age: "Tuổi sinh học" }[key] || key)}<output>${Math.round(value * 100)}</output></span><input type="range" min="0" max="1" step="0.01" value="${value}" data-genesis-decal="${key}"></label>`).join("")}
          </fieldset>
          <fieldset><legend>Vật liệu da</legend>
            ${Object.entries(recipe.surface).map(([key, value]) => `<label><span>${escapeHtml({ pores: "Lỗ chân lông", subsurface: "Tán xạ da", roughness: "Độ nhám", flush: "Độ ửng đỏ", wetness: "Độ ẩm" }[key] || key)}<output>${Math.round(value * 100)}</output></span><input type="range" min="0" max="1" step="0.01" value="${value}" data-genesis-surface="${key}"></label>`).join("")}
          </fieldset>
        </div>
        <div class="har-genesis-performance">
          <div><span>Biểu cảm</span>${Object.keys(CHARACTER_EXPRESSION_PRESETS).map((name) => `<button type="button" class="${recipe.expression === name ? "is-active" : ""}" data-genesis-expression="${name}">${name}</button>`).join("")}</div>
          <div><span>Khẩu hình</span>${Object.keys(CHARACTER_VISEMES).map((name) => `<button type="button" class="${recipe.viseme === name ? "is-active" : ""}" data-genesis-viseme="${name}">${name}</button>`).join("")}</div>
          <div><span>Ánh sáng thử</span>${APPEARANCE_ASSETS.lighting.map((name) => `<button type="button" class="${recipe.lighting === name ? "is-active" : ""}" data-genesis-lighting="${name}">${name}</button>`).join("")}</div>
        </div>
        <div class="har-genesis-motion">
          <span>Kiểm tra chuyển động</span>
          ${["idle", "walk", "run", "strafe", "jump", "dodge", "attack1", "talk"].map((motion) => `<button type="button" class="${this.genesisMotion === motion ? "is-active" : ""}" data-genesis-motion="${motion}">${motion}</button>`).join("")}
        </div>
        <div class="har-genesis-tools">
          <button type="button" data-genesis-action="undo" ${this.appearanceHistory.length ? "" : "disabled"}>↶ Hoàn tác</button>
          <button type="button" data-genesis-action="redo" ${this.appearanceFuture.length ? "" : "disabled"}>↷ Làm lại</button>
          <button type="button" data-genesis-action="random">Ngẫu nhiên</button>
          <button type="button" data-genesis-action="reset">Khôi phục</button>
        </div>
        <div class="har-genesis-dna">
          <label>Character DNA<textarea rows="2" spellcheck="false" data-genesis-dna>${escapeHtml(dna)}</textarea></label>
          <div><button type="button" data-genesis-action="copy-dna">Sao chép DNA</button><button type="button" data-genesis-action="apply-dna">Nạp DNA</button><button type="button" data-genesis-action="save-slot">Lưu ô ngoại hình</button></div>
        </div>
        <button class="har-genesis-confirm" type="button" data-genesis-action="confirm">
          <span>Xác nhận Nhà du hành</span><small>Lưu ngoại hình và bước vào H-Central</small>
        </button>`;
    }

    refreshGenesisCreator() {
      if (!this.genesisActive) return;
      const content = this.root.querySelector("[data-har-genesis-content]");
      if (content) content.innerHTML = this.renderGenesisCreator();
      const recipe = this.activeAppearanceRecipe();
      const name = this.root.querySelector("[data-genesis-model-name]");
      if (name) {
        name.textContent = ({
          "valid-asian-f-1-casual": "ASTERIA REAL HUMAN",
          "valid-asian-m-1-casual": "CAEL REAL HUMAN",
          "valid-black-f-1-casual": "NYX REAL HUMAN",
          "valid-white-m-1-casual": "SOL REAL HUMAN",
          "human-adult-b01": "VANGUARD HUMAN"
        })[recipe.baseModel] || "ASTERIA HUMAN";
      }
      const status = this.root.querySelector("[data-genesis-status]");
      if (status) {
        const runtime = this.characterRuntimes.get(this.state.roster.activeId);
        status.textContent = `${runtime?.mixer ? "Rigged + animation" : "3D PBR"} · ${this.rendererBackend.toUpperCase()} · đã sẵn sàng`;
      }
    }

    openGenesisCreator() {
      this.genesisActive = true;
      this.genesisMotion = "idle";
      this.genesisTurntable = false;
      this.facePreview = { expression: "neutral", viseme: "neutral", until: 0 };
      this.genesisOriginalLighting = {
        worldTime: this.state.worldTime,
        exposure: this.renderer?.toneMappingExposure || 1.08
      };
      this.paused = true;
      this.menuPaused = true;
      this.keys.clear();
      this.currentPanel = "";
      this.appearanceGroup = "face";
      this.appearanceFocus = "body";
      this.cameraYaw = 0;
      this.cameraPitch = 0.28;
      this.cameraDistance = 7.8;
      this.root.classList.add("is-genesis");
      const section = this.root.querySelector("[data-har-genesis]");
      if (section) section.hidden = false;
      this.root.dataset.characterPreview = "fallback";
      this.setupGenesisPreview();
      this.setGenesisMotion("idle");
      this.refreshGenesisCreator();
    }

    setupGenesisPreview() {
      if (!this.THREE || !this.renderer || !this.playerMesh) return;
      this.teardownGenesisPreview({ restorePlayer: true });
      const THREE = this.THREE;
      this.genesisScene = new THREE.Scene();
      this.genesisCamera = new THREE.PerspectiveCamera(38, 1, 0.04, 90);
      this.genesisCamera.position.set(0, 1.55, 5.2);
      this.genesisCameraTarget = new THREE.Vector3(0, 1.48, 0);

      const ambient = new THREE.HemisphereLight(0xeaf2ff, 0x24212a, 0.78);
      ambient.name = "GenesisStudioAmbient";
      const key = new THREE.DirectionalLight(0xffffff, 2.28);
      key.name = "GenesisStudioKey";
      key.position.set(3.8, 5.4, 4.7);
      key.castShadow = this.state.settings.quality !== "low";
      if (key.shadow?.mapSize) {
        const shadowSize = this.state.settings.quality === "cinematic" ? 1024 : 512;
        key.shadow.mapSize.set(shadowSize, shadowSize);
        key.shadow.bias = -0.00018;
        key.shadow.normalBias = 0.018;
      }
      const fill = new THREE.DirectionalLight(0x9fd8ff, 0.46);
      fill.name = "GenesisStudioFill";
      fill.position.set(-4.2, 2.7, 2.2);
      const rim = new THREE.PointLight(0xb4d8ff, 0.94, 16, 1.5);
      rim.name = "GenesisStudioRim";
      rim.position.set(0.5, 3.3, -3.2);
      this.genesisScene.add(ambient, key, fill, rim);
      this.genesisLights = { ambient, key, fill, rim };

      const profile = CHARACTERS[this.state.roster.activeId] || CHARACTERS.lyra;
      this.genesisFallbackModel = this.createAnimeCharacterMesh(profile, 1);
      this.genesisFallbackModel.name = "HHGenesisProceduralHuman";
      this.genesisFallbackModel.userData.hhGenesisFallback = true;
      this.genesisFallbackModel.position.set(0, 0, 0);
      this.genesisScene.add(this.genesisFallbackModel);

      this.genesisActualModel = this.playerMesh;
      this.genesisOriginalParent = this.playerMesh.parent || this.world;
      this.genesisOriginalTransform = {
        position: this.playerMesh.position.clone(),
        quaternion: this.playerMesh.quaternion.clone(),
        scale: this.playerMesh.scale.clone()
      };
      this.genesisOriginalParent?.remove?.(this.playerMesh);
      this.genesisScene.add(this.playerMesh);
      this.playerMesh.position.set(0, 0, 0);
      this.playerMesh.rotation.set(0, 0, 0);
      this.playerMesh.scale.set(1, 1, 1);
      this.playerMesh.visible = true;
      this.setGenesisModelOpacity(this.playerMesh, 0.015);
      this.setGenesisModelOpacity(this.genesisFallbackModel, 1);

      this.genesisVisibility = {
        consecutiveFrames: 0,
        validated: false,
        crossfadeStartedAt: 0,
        startedAt: performance.now(),
        report: null
      };
      this.root.dataset.characterPreview = "validating";
      this.setGenesisStudio(this.state.settings.characterStudio || "central", { save: false });
      this.updateCharacterLod(this.playerMesh, 0);
      this.fitGenesisCamera(this.playerMesh, "body");
    }

    teardownGenesisPreview({ restorePlayer = true } = {}) {
      if (!this.genesisScene && !this.genesisActualModel && !this.genesisFallbackModel) return;
      if (this.genesisActualModel) {
        this.restoreGenesisModelOpacity(this.genesisActualModel);
        this.genesisScene?.remove?.(this.genesisActualModel);
        if (restorePlayer && this.genesisOriginalParent) {
          this.genesisOriginalParent.add(this.genesisActualModel);
          if (this.genesisOriginalTransform) {
            this.genesisActualModel.position.copy(this.genesisOriginalTransform.position);
            this.genesisActualModel.quaternion.copy(this.genesisOriginalTransform.quaternion);
            this.genesisActualModel.scale.copy(this.genesisOriginalTransform.scale);
          }
        }
      }
      this.disposeGenesisObject(this.genesisFallbackModel);
      this.disposeGenesisObject(this.genesisStudioGroup);
      this.genesisScene = null;
      this.genesisCamera = null;
      this.genesisCameraTarget = null;
      this.genesisStudioGroup = null;
      this.genesisFallbackModel = null;
      this.genesisActualModel = null;
      this.genesisOriginalParent = null;
      this.genesisOriginalTransform = null;
      this.genesisVisibility = null;
      this.genesisLights = null;
    }

    disposeGenesisObject(object) {
      if (!object) return;
      object.parent?.remove?.(object);
      const geometries = new Set();
      const materials = new Set();
      object.traverse?.((node) => {
        if (node.geometry && !node.userData?.sharedAsset) geometries.add(node.geometry);
        (Array.isArray(node.material) ? node.material : [node.material]).filter(Boolean).forEach((material) => materials.add(material));
      });
      geometries.forEach((geometry) => geometry.dispose?.());
      materials.forEach((material) => material.dispose?.());
    }

    setGenesisModelOpacity(object, opacity) {
      if (!object) return;
      object.traverse?.((node) => {
        (Array.isArray(node.material) ? node.material : [node.material]).filter(Boolean).forEach((material) => {
          material.userData ||= {};
          if (!material.userData.hhGenesisOpacity) {
            material.userData.hhGenesisOpacity = {
              opacity: Number.isFinite(material.opacity) ? material.opacity : 1,
              transparent: material.transparent === true,
              depthWrite: material.depthWrite !== false
            };
          }
          const base = material.userData.hhGenesisOpacity.opacity;
          material.opacity = clamp(base * opacity, 0, 1);
          material.transparent = opacity < 0.999 || material.userData.hhGenesisOpacity.transparent;
          material.depthWrite = opacity > 0.98 && material.userData.hhGenesisOpacity.depthWrite;
          material.needsUpdate = true;
        });
      });
    }

    restoreGenesisModelOpacity(object) {
      object?.traverse?.((node) => {
        (Array.isArray(node.material) ? node.material : [node.material]).filter(Boolean).forEach((material) => {
          const saved = material.userData?.hhGenesisOpacity;
          if (!saved) return;
          material.opacity = saved.opacity;
          material.transparent = saved.transparent;
          material.depthWrite = saved.depthWrite;
          delete material.userData.hhGenesisOpacity;
          material.needsUpdate = true;
        });
      });
    }

    createGenesisStudio(studioId) {
      const THREE = this.THREE;
      const studio = GENESIS_STUDIOS[studioId] || GENESIS_STUDIOS.central;
      const group = new THREE.Group();
      group.name = `HHGenesisStudio:${studioId}`;
      const floorMaterial = new (THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial)({
        color: studio.floor,
        roughness: studioId === "neutral" ? 0.54 : 0.18,
        metalness: studioId === "neutral" ? 0.02 : 0.38,
        clearcoat: studioId === "neutral" ? 0.08 : 0.72,
        clearcoatRoughness: 0.22,
        transparent: true,
        opacity: 0.9
      });
      const floor = new THREE.Mesh(new THREE.CircleGeometry(6.8, 72), floorMaterial);
      floor.name = "GenesisReflectiveFloor";
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.018;
      floor.receiveShadow = true;
      group.add(floor);
      const accentMaterial = new THREE.MeshStandardMaterial({
        color: studio.accent,
        emissive: studio.accent,
        emissiveIntensity: 1.15,
        roughness: 0.26,
        metalness: 0.35,
        transparent: true,
        opacity: 0.72
      });

      if (studioId === "central") {
        [-4.2, -2.8, 2.8, 4.2].forEach((x, index) => {
          const tower = new THREE.Mesh(new THREE.BoxGeometry(0.52, 2.5 + (index % 2) * 1.2, 0.52), accentMaterial.clone());
          tower.position.set(x, tower.geometry.parameters.height / 2, -2.8 - Math.abs(x) * 0.12);
          group.add(tower);
        });
      } else if (studioId === "aurora") {
        [-3.8, -2.7, 2.7, 3.8].forEach((x, index) => {
          const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.32 + index * 0.03, 1.6 + (index % 2), 6), accentMaterial.clone());
          crystal.position.set(x, crystal.geometry.parameters.height / 2, -2.4);
          group.add(crystal);
        });
      } else if (studioId === "crimson") {
        [-3.8, 3.8].forEach((x) => {
          const forge = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.92, 3.1, 16), accentMaterial.clone());
          forge.position.set(x, 1.55, -2.3);
          group.add(forge);
        });
      } else if (studioId === "void") {
        [-3.4, 3.4].forEach((x) => {
          const portal = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.12, 12, 48), accentMaterial.clone());
          portal.position.set(x, 1.75, -2.5);
          portal.rotation.y = x < 0 ? 0.28 : -0.28;
          group.add(portal);
        });
      } else if (studioId === "deep") {
        const positions = new Float32Array(270);
        for (let index = 0; index < positions.length; index += 3) {
          const radius = 5 + Math.random() * 8;
          const angle = Math.random() * Math.PI * 2;
          positions[index] = Math.cos(angle) * radius;
          positions[index + 1] = Math.random() * 7 - 0.5;
          positions[index + 2] = -2 - Math.sin(angle) * radius;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        group.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: studio.accent, size: 0.045, transparent: true, opacity: 0.86 })));
      } else {
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(13, 8), new THREE.MeshStandardMaterial({ color: 0xd8dee5, roughness: 0.88 }));
        wall.position.set(0, 3.7, -4.2);
        group.add(wall);
      }

      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.022, 8, 96), accentMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.035;
      group.add(ring);
      return group;
    }

    setGenesisStudio(studioId = "central", { save = true } = {}) {
      if (!this.genesisScene || !this.THREE) return;
      const safeId = GENESIS_STUDIOS[studioId] ? studioId : "central";
      const studio = GENESIS_STUDIOS[safeId];
      this.disposeGenesisObject(this.genesisStudioGroup);
      this.genesisStudioGroup = this.createGenesisStudio(safeId);
      this.genesisScene.add(this.genesisStudioGroup);
      this.genesisScene.background = new this.THREE.Color(studio.background);
      this.genesisScene.fog = new this.THREE.FogExp2(studio.background, safeId === "neutral" ? 0.012 : 0.035);
      if (this.genesisLights) {
        this.genesisLights.key.color.setHex(studio.key);
        this.genesisLights.rim.color.setHex(studio.rim);
        // Keep skin readable and neutral. The world's saturated accent stays
        // in the rim/background instead of tinting the whole face cyan.
        this.genesisLights.fill.color.setHex(studio.fill || studio.key);
      }
      this.genesisStudioId = safeId;
      if (save) {
        this.state.settings.characterStudio = safeId;
        this.saveProgress("Đổi Character Studio");
      }
      this.root.querySelectorAll("[data-genesis-studio]").forEach((button) => {
        const active = button.dataset.genesisStudio === safeId;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    }

    genesisBoundsRoot(object) {
      // Weapons, procedural safety proxies and head-bone accessories can use a
      // different unit scale from the source GLB. Camera/visibility QA must be
      // based on the authored human mesh, otherwise one attachment can make a
      // normal 2.9 m character look tens of metres wide and block crossfade.
      return object?.userData?.gltfAsset || object;
    }

    getGenesisBoundsBox(object) {
      const THREE = this.THREE;
      const stored = object?.userData?.genesisAuthoredBounds;
      if (THREE && Array.isArray(stored?.min) && Array.isArray(stored?.max)) {
        object.updateMatrixWorld?.(true);
        return new THREE.Box3(
          new THREE.Vector3().fromArray(stored.min),
          new THREE.Vector3().fromArray(stored.max)
        ).applyMatrix4(object.matrixWorld);
      }
      const boundsRoot = this.genesisBoundsRoot(object);
      boundsRoot?.updateMatrixWorld?.(true);
      return new THREE.Box3().setFromObject(boundsRoot);
    }

    fitGenesisCamera(object = this.genesisActualModel || this.genesisFallbackModel, focus = this.appearanceFocus || "body") {
      if (!object || !this.genesisCamera || !this.THREE) return false;
      object.updateMatrixWorld(true);
      const box = this.getGenesisBoundsBox(object);
      const size = box.getSize(new this.THREE.Vector3());
      const center = box.getCenter(new this.THREE.Vector3());
      if (![size.x, size.y, size.z, center.x, center.y, center.z].every(Number.isFinite) || size.y < 0.2) return false;
      const profile = {
        head: { target: 0.855, visible: 0.3, padding: 0.72, min: 1.25, max: 3.2 },
        upper: { target: 0.7, visible: 0.52, padding: 0.78, min: 1.75, max: 5.2 },
        lower: { target: 0.3, visible: 0.5, padding: 0.8, min: 1.8, max: 5.2 },
        body: { target: 0.5, visible: 1, padding: 0.82, min: 2.5, max: 9.2 }
      }[focus] || { target: 0.5, visible: 1, padding: 0.82, min: 2.5, max: 9.2 };
      let targetY = box.min.y + size.y * profile.target;
      if (focus === "head") {
        const runtime = object.userData?.characterRuntime;
        const head = runtime?.bones?.head;
        if (head?.getWorldPosition) {
          const headPosition = head.getWorldPosition(new this.THREE.Vector3());
          if (Number.isFinite(headPosition.y)) targetY = clamp(headPosition.y + size.y * 0.035, box.min.y + size.y * 0.78, box.max.y - size.y * 0.06);
        }
      }
      this.genesisCameraTarget.set(center.x, targetY, center.z);
      // Face framing must not use the full-body width: a T/A pose would make
      // the camera zoom out precisely when the user asks for a close-up.
      const visibleHeight = size.y * profile.visible;
      const fov = this.THREE.MathUtils.degToRad(this.genesisCamera.fov);
      this.cameraDistance = clamp((visibleHeight * profile.padding) / Math.tan(fov / 2), profile.min, profile.max);
      this.updateGenesisCamera();
      return true;
    }

    updateGenesisCamera() {
      if (!this.genesisCamera || !this.genesisCameraTarget) return;
      const yaw = this.cameraYaw || 0;
      const pitch = clamp(this.cameraPitch - 0.28, -0.02, 0.8);
      const minimumDistance = this.appearanceFocus === "head" ? 1.25 : this.appearanceFocus === "upper" ? 1.75 : this.appearanceFocus === "lower" ? 1.8 : 2.5;
      const distance = Math.max(minimumDistance, this.cameraDistance || 5.2);
      this.genesisCamera.position.set(
        this.genesisCameraTarget.x + Math.sin(yaw) * distance,
        this.genesisCameraTarget.y + pitch * distance,
        this.genesisCameraTarget.z + Math.cos(yaw) * distance
      );
      this.genesisCamera.lookAt(this.genesisCameraTarget);
      this.genesisCamera.updateMatrixWorld(true);
    }

    getGenesisVisibilityReport(object = this.genesisActualModel) {
      const THREE = this.THREE;
      if (!object || !THREE || !this.genesisCamera) return { ready: false, reason: "missing-model", triangles: 0 };
      object.updateMatrixWorld(true);
      const boundsRoot = this.genesisBoundsRoot(object);
      boundsRoot?.updateMatrixWorld?.(true);
      this.genesisCamera.updateMatrixWorld(true);
      this.genesisCamera.updateProjectionMatrix();
      const box = this.getGenesisBoundsBox(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const dynamicBox = new THREE.Box3().setFromObject(boundsRoot, true);
      const dynamicSize = dynamicBox.getSize(new THREE.Vector3());
      const deformationRatio = Math.max(
        dynamicSize.x / Math.max(0.01, size.x),
        dynamicSize.y / Math.max(0.01, size.y),
        dynamicSize.z / Math.max(0.01, size.z)
      );
      const finiteBounds = [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].every(Number.isFinite);
      let triangles = 0;
      let visibleMaterials = 0;
      boundsRoot?.traverse?.((node) => {
        if ((!node.isMesh && !node.isSkinnedMesh) || node.visible === false || !node.geometry) return;
        const indexCount = Number(node.geometry.index?.count || 0);
        const vertexCount = Number(node.geometry.attributes?.position?.count || 0);
        triangles += indexCount ? Math.floor(indexCount / 3) : Math.floor(vertexCount / 3);
        (Array.isArray(node.material) ? node.material : [node.material]).filter(Boolean).forEach((material) => {
          const baseOpacity = material.userData?.hhGenesisOpacity?.opacity ?? material.opacity ?? 1;
          const colorStrength = material.color
            ? Math.max(material.color.r, material.color.g, material.color.b)
            : 1;
          const emissiveStrength = material.emissive
            ? Math.max(material.emissive.r, material.emissive.g, material.emissive.b) * Number(material.emissiveIntensity || 0)
            : 0;
          if (material.visible !== false && baseOpacity > 0.04 && (material.map || colorStrength > 0.012 || emissiveStrength > 0.012)) visibleMaterials += 1;
        });
      });
      const frustumMatrix = new THREE.Matrix4().multiplyMatrices(this.genesisCamera.projectionMatrix, this.genesisCamera.matrixWorldInverse);
      const inFrustum = finiteBounds && new THREE.Frustum().setFromProjectionMatrix(frustumMatrix).intersectsBox(box);
      const projectedCenter = center.clone().project(this.genesisCamera);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const distance = Math.max(0.01, this.genesisCamera.position.distanceTo(sphere.center));
      const projectedRatio = (2 * Math.atan(Math.max(0.001, sphere.radius) / distance)) / THREE.MathUtils.degToRad(this.genesisCamera.fov);
      const centered = Math.abs(projectedCenter.x) <= 0.84 && Math.abs(projectedCenter.y) <= 0.84 && projectedCenter.z >= -1 && projectedCenter.z <= 1;
      const adequateSize = projectedRatio >= 0.18 && projectedRatio <= 1.22 && size.y >= 0.35;
      const ready = finiteBounds && triangles > 0 && visibleMaterials > 0 && inFrustum && centered && adequateSize;
      return {
        ready,
        finiteBounds,
        inFrustum,
        centered,
        adequateSize,
        triangles,
        visibleMaterials,
        projectedRatio,
        size: { x: size.x, y: size.y, z: size.z },
        dynamicSize: { x: dynamicSize.x, y: dynamicSize.y, z: dynamicSize.z },
        deformationRatio,
        reason: ready
          ? "ready"
          : !finiteBounds
            ? "invalid-bounds"
            : !triangles
              ? "no-triangles"
              : !visibleMaterials
                ? "invisible-material"
                : !inFrustum
                  ? "outside-camera"
                  : !centered
                    ? "off-center"
                    : projectedRatio > 1.22
                      ? "too-large"
                      : "too-small"
      };
    }

    resetGameplayCharacterVisibility(reason = "model-created") {
      this.gameplayVisibility = {
        consecutiveFrames: 0,
        visibleFrames: 0,
        failureFrames: 0,
        unsafePoseFrames: 0,
        validated: false,
        groundingCalibrated: false,
        startedAt: performance.now(),
        lastCheckedAt: 0,
        reason,
        report: null
      };
      if (this.root) {
        this.root.dataset.characterPreview = "validating";
        this.root.dataset.characterValidation = reason;
      }
      if (this.playerMesh) {
        this.playerMesh.visible = true;
        this.updateCharacterLod(this.playerMesh, 0);
      }
    }

    getGameplayCharacterReport(object = this.playerMesh) {
      const THREE = this.THREE;
      const runtime = object?.userData?.characterRuntime || this.characterRuntimes.get(this.state.roster.activeId);
      if (!object || !THREE || !this.camera || !this.renderer) {
        return { modelReady: false, reason: "missing-runtime", triangles: 0, bones: 0, morphTargets: 0 };
      }
      object.updateMatrixWorld(true);
      this.camera.updateMatrixWorld(true);
      this.camera.updateProjectionMatrix();
      const boundsRoot = this.genesisBoundsRoot(object);
      const box = this.getGenesisBoundsBox(object);
      const dynamicBox = new THREE.Box3().setFromObject(boundsRoot, true);
      const finiteBounds = [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].every(Number.isFinite);
      const size = box.getSize(new THREE.Vector3());
      const dynamicSize = dynamicBox.getSize(new THREE.Vector3());
      const deformationRatio = Math.max(
        dynamicSize.x / Math.max(0.01, size.x),
        dynamicSize.y / Math.max(0.01, size.y),
        dynamicSize.z / Math.max(0.01, size.z)
      );
      let uprightDot = 1;
      if (runtime?.bones?.head && runtime?.bones?.hips) {
        const headPosition = runtime.bones.head.getWorldPosition(new THREE.Vector3());
        const hipsPosition = runtime.bones.hips.getWorldPosition(new THREE.Vector3());
        const bodyAxis = headPosition.sub(hipsPosition);
        uprightDot = bodyAxis.lengthSq() > 0.000001 ? bodyAxis.normalize().dot(new THREE.Vector3(0, 1, 0)) : -1;
      }
      const armDownness = {};
      [["left", runtime?.bones?.leftUpperArm, runtime?.bones?.leftForeArm], ["right", runtime?.bones?.rightUpperArm, runtime?.bones?.rightForeArm]]
        .forEach(([side, upperArm, foreArm]) => {
          if (!upperArm || !foreArm) return;
          const shoulder = upperArm.getWorldPosition(new THREE.Vector3());
          const elbow = foreArm.getWorldPosition(new THREE.Vector3());
          const direction = elbow.sub(shoulder);
          armDownness[side] = direction.lengthSq() > 0.000001
            ? direction.normalize().dot(new THREE.Vector3(0, -1, 0))
            : -1;
        });
      const idlePose = ["", "idle", "talk"].includes(String(runtime?.state || this.activeAnimation || "idle"));
      const relaxedIdleArms = !idlePose || Object.values(armDownness).every((value) => Number.isFinite(value) && value >= 0.38);
      const poseStable = Number.isFinite(uprightDot) && uprightDot >= 0.42 && deformationRatio <= 2.25 && relaxedIdleArms;
      const frustumMatrix = new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
      const inFrustum = finiteBounds && new THREE.Frustum().setFromProjectionMatrix(frustumMatrix).intersectsBox(box);
      const corners = [
        [box.min.x, box.min.y, box.min.z], [box.min.x, box.min.y, box.max.z],
        [box.min.x, box.max.y, box.min.z], [box.min.x, box.max.y, box.max.z],
        [box.max.x, box.min.y, box.min.z], [box.max.x, box.min.y, box.max.z],
        [box.max.x, box.max.y, box.min.z], [box.max.x, box.max.y, box.max.z]
      ];
      let minimumY = Infinity;
      let maximumY = -Infinity;
      let projectedCenterX = 0;
      corners.forEach(([x, y, z]) => {
        const point = new THREE.Vector3(x, y, z).project(this.camera);
        minimumY = Math.min(minimumY, point.y);
        maximumY = Math.max(maximumY, point.y);
        projectedCenterX += point.x / corners.length;
      });
      const canvasHeight = Math.max(1, this.renderer.domElement?.clientHeight || this.renderer.domElement?.height || 1);
      const projectedHeight = Math.abs(maximumY - minimumY) * 0.5 * canvasHeight;
      let visibleMaterials = 0;
      boundsRoot?.traverse?.((node) => {
        if ((!node.isMesh && !node.isSkinnedMesh) || node.visible === false) return;
        (Array.isArray(node.material) ? node.material : [node.material]).filter(Boolean).forEach((material) => {
          const opacity = Number.isFinite(material.opacity) ? material.opacity : 1;
          if (material.visible !== false && opacity > 0.04 && material.depthTest !== false) visibleMaterials += 1;
        });
      });
      const dynamicBottom = Number.isFinite(dynamicBox.min.y) ? dynamicBox.min.y : box.min.y;
      const expectedGround = Number(this.state.player.y || 0);
      const footHeights = [runtime?.bones?.leftFoot, runtime?.bones?.rightFoot]
        .filter(Boolean)
        .map((foot) => foot.getWorldPosition(new THREE.Vector3()).y)
        .filter(Number.isFinite);
      const expectedFootHeight = Number(runtime?.expectedFootHeight || 0.09);
      const boneGroundError = footHeights.length
        ? Math.min(...footHeights) - (expectedGround + expectedFootHeight)
        : null;
      const feetGroundError = dynamicBottom - expectedGround;
      const triangles = Number(runtime?.triangles || runtime?.qaReport?.triangles || 0);
      const bones = Object.values(runtime?.bones || {}).filter(Boolean).length;
      const morphTargets = Number(runtime?.facialChannels || runtime?.qaReport?.faceMorphTargets || 0);
      const renderedTriangles = Number(this.renderer.info?.render?.triangles || 0);
      const notBuried = finiteBounds && box.max.y > expectedGround + 0.35 && feetGroundError > -0.18;
      const adequateProjection = projectedHeight >= Math.max(48, canvasHeight * 0.12)
        && projectedHeight <= canvasHeight * 1.22
        && Math.abs(projectedCenterX) < 1.15;
      const modelReady = finiteBounds
        && size.y >= 0.35
        && triangles > 0
        && renderedTriangles > 0
        && visibleMaterials > 0
        && inFrustum
        && adequateProjection
        && notBuried
        && poseStable;
      return {
        modelReady,
        reason: modelReady
          ? "ready"
          : !finiteBounds
            ? "invalid-bounds"
            : triangles <= 0
              ? "no-triangles"
              : visibleMaterials <= 0
                ? "invisible-material"
                : !inFrustum
                  ? "outside-camera"
                  : !notBuried
                    ? "below-terrain"
                    : !poseStable
                      ? "unsafe-pose"
                    : "insufficient-screen-coverage",
        finiteBounds,
        inFrustum,
        notBuried,
        visibleMaterials,
        renderedTriangles,
        triangles,
        bones,
        morphTargets,
        boundingBox: {
          min: box.min.toArray().map((value) => Number(value.toFixed(4))),
          max: box.max.toArray().map((value) => Number(value.toFixed(4)))
        },
        dynamicSize: dynamicSize.toArray().map((value) => Number(value.toFixed(4))),
        deformationRatio: Number(deformationRatio.toFixed(4)),
        uprightDot: Number(uprightDot.toFixed(4)),
        armDownness: Object.fromEntries(Object.entries(armDownness).map(([side, value]) => [side, Number(value.toFixed(4))])),
        relaxedIdleArms,
        poseStable,
        projectedHeight: Number(projectedHeight.toFixed(2)),
        feetGroundError: Number(feetGroundError.toFixed(4)),
        boneGroundError: Number.isFinite(boneGroundError) ? Number(boneGroundError.toFixed(4)) : null,
        wristDeviation: Number((runtime?.wristDeviation || 0).toFixed(4)),
        activeLOD: object.userData?.modelTier || "near"
      };
    }

    validateGameplayCharacterFrame(time = performance.now()) {
      this.gameplayVisibility ||= {
        consecutiveFrames: 0,
        visibleFrames: 0,
        failureFrames: 0,
        unsafePoseFrames: 0,
        validated: false,
        groundingCalibrated: false,
        startedAt: time,
        lastCheckedAt: 0,
        report: null
      };
      const visibility = this.gameplayVisibility;
      if (visibility.validated && time - visibility.lastCheckedAt < 1000) return visibility.report;
      visibility.lastCheckedAt = time;
      let report = this.getGameplayCharacterReport(this.playerMesh);
      const activeRuntime = this.playerMesh?.userData?.characterRuntime || this.characterRuntimes.get(this.state.roster.activeId);
      visibility.unsafePoseFrames = report.poseStable ? 0 : visibility.unsafePoseFrames + 1;
      const poseGraceElapsed = time - visibility.startedAt;
      if (!report.poseStable && activeRuntime && poseGraceElapsed >= 900 && visibility.unsafePoseFrames >= 6) {
        this.quarantineUnsafeCharacterMotion(activeRuntime, `gameplay-pose-${report.uprightDot}`);
        this.positionCharacterInWorld(this.playerMesh, this.state.player.x, this.state.player.y, this.state.player.z);
        this.playerMesh.updateMatrixWorld(true);
        report = this.getGameplayCharacterReport(this.playerMesh);
        visibility.unsafePoseFrames = report.poseStable ? 0 : visibility.unsafePoseFrames;
      }
      if (!visibility.validated && !visibility.groundingCalibrated && Number.isFinite(report.feetGroundError)) {
        const error = Number(report.feetGroundError);
        if (Math.abs(error) > 0.055 && Math.abs(error) <= 1.2 && !this.cinematicSequence.active) {
          const currentOffset = Number(this.playerMesh?.userData?.gameplayGroundOffset || 0);
          this.playerMesh.userData.gameplayGroundOffset = currentOffset + clamp(-error, -0.85, 0.85);
          this.positionCharacterInWorld(this.playerMesh, this.state.player.x, this.state.player.y, this.state.player.z);
          this.playerMesh.updateMatrixWorld(true);
          report = this.getGameplayCharacterReport(this.playerMesh);
        }
        visibility.groundingCalibrated = true;
      }
      visibility.report = report;
      visibility.consecutiveFrames = report.modelReady ? visibility.consecutiveFrames + 1 : 0;
      visibility.failureFrames = report.modelReady ? 0 : visibility.failureFrames + 1;
      if (report.modelReady) visibility.visibleFrames += 1;
      if (visibility.validated && visibility.failureFrames >= 2) visibility.validated = false;
      if (!visibility.validated && visibility.consecutiveFrames >= 2) visibility.validated = true;
      this.characterDiagnostics = {
        ...report,
        previewValidated: visibility.validated,
        visibleFrames: visibility.visibleFrames,
        renderer: this.rendererBackend,
        fps: this.fps,
        environmentAssets: {
          status: this.licensedEnvironmentStatus,
          loaded: this.licensedEnvironmentAssets.size,
          photoreal: this.photorealStatus
        },
        cinematicChapter: this.cinematicSequence.active ? this.cinematicSequence.chapterId : ""
      };
      if (this.root) {
        this.root.dataset.characterPreview = visibility.validated ? "3d" : "validating";
        this.root.dataset.characterValidation = report.reason;
        this.root.dataset.characterProjectedHeight = String(report.projectedHeight || 0);
        this.root.dataset.characterFeetError = String(report.feetGroundError ?? "invalid");
        this.root.dataset.characterGroundOffset = String(Number(this.playerMesh?.userData?.gameplayGroundOffset || 0).toFixed(4));
        this.root.dataset.characterUpright = String(report.uprightDot ?? "invalid");
        this.root.dataset.characterArmDownness = `${report.armDownness?.left ?? "invalid"},${report.armDownness?.right ?? "invalid"}`;
        this.root.dataset.characterDeformation = String(report.deformationRatio ?? "invalid");
        this.root.dataset.characterVisibleFrames = String(visibility.visibleFrames);
      }
      if (!report.modelReady && time - visibility.startedAt > 1200) {
        this.playerMesh.visible = true;
        this.updateCharacterLod(this.playerMesh, 0);
      }
      return report;
    }

    alignCharacterRigUpright(runtime) {
      const THREE = this.THREE;
      const visualRoot = runtime?.visualRoot || runtime?.mesh?.userData?.gltfAsset;
      const head = runtime?.bones?.head;
      const hips = runtime?.bones?.hips;
      if (!THREE || !visualRoot || !head || !hips) return false;
      runtime.mesh.updateMatrixWorld(true);
      const headWorld = head.getWorldPosition(new THREE.Vector3());
      const hipsWorld = hips.getWorldPosition(new THREE.Vector3());
      const bodyAxis = headWorld.sub(hipsWorld);
      if (bodyAxis.lengthSq() < 0.000001) return false;
      bodyAxis.normalize();
      const upright = new THREE.Vector3(0, 1, 0);
      if (bodyAxis.dot(upright) >= 0.72) return true;
      const deltaWorld = new THREE.Quaternion().setFromUnitVectors(bodyAxis, upright);
      const currentWorld = visualRoot.getWorldQuaternion(new THREE.Quaternion());
      const desiredWorld = deltaWorld.multiply(currentWorld).normalize();
      const parentWorld = visualRoot.parent?.getWorldQuaternion?.(new THREE.Quaternion()) || new THREE.Quaternion();
      visualRoot.quaternion.copy(parentWorld.invert().multiply(desiredWorld).normalize());
      runtime.mesh.updateMatrixWorld(true);
      runtime.uprightRecovery = "hips-head-to-world-y";
      // Parent-space quaternions change when the imported Z-up rig is aligned.
      // Capture them again so relaxed arms, wrists and procedural locomotion
      // operate in the corrected human coordinate system.
      this.captureNaturalRigPose(runtime);
      return true;
    }

    quarantineUnsafeCharacterMotion(runtime, reason = "dynamic-bounds") {
      if (!runtime) return false;
      const firstQuarantine = !runtime.motionQuarantined;
      runtime.motionQuarantined = runtime.motionQuarantined || reason;
      runtime.quarantinedClipCount ||= runtime.clips?.size || 0;
      if (firstQuarantine) {
        try {
          runtime.mixer?.stopAllAction?.();
          runtime.mixer?.uncacheRoot?.(runtime.animationRoot || runtime.mesh);
        } catch {}
        runtime.currentAction = null;
        runtime.blendActions?.clear?.();
        runtime.blendWeights?.clear?.();
        runtime.clips?.clear?.();
        runtime.mixer = null;
      }
      runtime.rigRest?.forEach?.((rest, bone) => {
        bone.position.copy(rest.position);
        bone.quaternion.copy(rest.quaternion);
      });
      this.alignCharacterRigUpright(runtime);
      runtime.mesh?.updateMatrixWorld?.(true);
      runtime.state = "";
      runtime.motionSource = "rest-space-procedural-safety";
      return firstQuarantine;
    }

    renderGenesisFrame(time, dt) {
      if (!this.genesisScene || !this.genesisCamera || !this.renderer) return false;
      if (this.genesisTurntable && !this.state.settings.reduceEffects) this.cameraYaw = (this.cameraYaw + dt * 0.34) % (Math.PI * 2);
      this.updateGenesisCamera();
      const canvas = this.renderer.domElement;
      const stage = this.root.querySelector("[data-har-stage]");
      const viewport = this.root.querySelector(".har-genesis__viewport");
      const canvasRect = canvas.getBoundingClientRect();
      const viewRect = viewport?.getBoundingClientRect?.() || canvasRect;
      const fullWidth = Math.max(1, stage?.clientWidth || canvasRect.width);
      const fullHeight = Math.max(1, stage?.clientHeight || canvasRect.height);
      const x = clamp(viewRect.left - canvasRect.left, 0, fullWidth - 1);
      const y = clamp(canvasRect.bottom - viewRect.bottom, 0, fullHeight - 1);
      const width = clamp(viewRect.width, 1, fullWidth - x);
      const height = clamp(viewRect.height, 1, fullHeight - y);
      this.genesisCamera.aspect = width / height;
      this.genesisCamera.updateProjectionMatrix();
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, fullWidth, fullHeight);
      this.renderer.setClearColor(0x02050f, 1);
      this.renderer.clear(true, true, true);
      this.renderer.setViewport(x, y, width, height);
      this.renderer.setScissor(x, y, width, height);
      this.renderer.setScissorTest(true);
      this.renderer.render(this.genesisScene, this.genesisCamera);
      const renderedTriangles = Number(this.renderer.info?.render?.triangles || 0);
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, fullWidth, fullHeight);

      const report = this.getGenesisVisibilityReport(this.genesisActualModel);
      report.renderedTriangles = renderedTriangles;
      report.ready = report.ready && renderedTriangles > 0;
      const genesisRuntime = this.genesisActualModel?.userData?.characterRuntime;
      if (report.deformationRatio > 2.2 && genesisRuntime?.mixer) {
        this.quarantineUnsafeCharacterMotion(genesisRuntime, `bounds-ratio-${report.deformationRatio.toFixed(2)}`);
        report.ready = false;
        report.reason = "motion-quarantined";
        this.genesisVisibility.startedAt = time;
      }
      const genesisVariants = this.genesisActualModel?.userData?.lodVariants || {};
      this.root.dataset.characterVisualMode = this.genesisActualModel?.userData?.visualMode || "missing";
      this.root.dataset.characterHeroVisible = String((genesisVariants.hero || []).some((object) => object.visible));
      this.root.dataset.characterProxyVisible = String((genesisVariants.crowd || []).some((object) => object.visible));
      this.root.dataset.characterFallbackVisible = String(Boolean(this.genesisFallbackModel?.visible));
      this.root.dataset.characterDeformation = Number.isFinite(report.deformationRatio) ? report.deformationRatio.toFixed(2) : "invalid";
      this.root.dataset.characterMotionSafety = genesisRuntime?.motionQuarantined ? "procedural-safety" : "baked";
      this.root.dataset.characterProjection = Number.isFinite(report.projectedRatio)
        ? report.projectedRatio.toFixed(3)
        : "invalid";
      this.root.dataset.characterBounds = report.size
        ? `${report.size.x.toFixed(2)}x${report.size.y.toFixed(2)}x${report.size.z.toFixed(2)}`
        : "missing";
      this.genesisVisibility ||= { consecutiveFrames: 0, validated: false, crossfadeStartedAt: 0, startedAt: time, report: null };
      this.genesisVisibility.report = report;
      this.genesisVisibility.consecutiveFrames = report.ready ? this.genesisVisibility.consecutiveFrames + 1 : 0;
      const status = this.root.querySelector("[data-genesis-status]");
      const lodStatus = this.root.querySelector("[data-genesis-lod-status]");

      if (!this.genesisVisibility.validated && this.genesisVisibility.consecutiveFrames >= 2) {
        this.genesisVisibility.validated = true;
        this.genesisVisibility.crossfadeStartedAt = time;
        this.fitGenesisCamera(this.genesisActualModel, this.appearanceFocus || "body");
      }
      if (this.genesisVisibility.validated) {
        const progress = clamp((time - this.genesisVisibility.crossfadeStartedAt) / 400, 0, 1);
        this.setGenesisModelOpacity(this.genesisActualModel, progress);
        this.setGenesisModelOpacity(this.genesisFallbackModel, 1 - progress);
        if (progress >= 1) {
          this.genesisFallbackModel.visible = false;
          this.root.dataset.characterPreview = "3d";
          if (status) status.textContent = `${report.triangles.toLocaleString("vi-VN")} triangles · trong camera · 2/2 frame`;
          if (lodStatus) lodStatus.textContent = "Đã xác nhận trong camera";
        } else {
          this.root.dataset.characterPreview = "crossfade";
          if (status) status.textContent = `Đang chuyển sang GLB · ${Math.round(progress * 100)}%`;
        }
      } else {
        this.root.dataset.characterPreview = "validating";
        this.genesisFallbackModel.visible = true;
        this.setGenesisModelOpacity(this.genesisFallbackModel, 1);
        if (lodStatus) lodStatus.textContent = "Đang giữ fallback an toàn";
        if (time - this.genesisVisibility.startedAt > 1200) {
          this.setGenesisModelOpacity(this.genesisActualModel, 0);
          if (status) status.textContent = `GLB đang chờ QA · ${report.reason} · khung ${this.root.dataset.characterProjection}`;
        } else if (status) {
          status.textContent = `Đang kiểm tra GLB · ${this.genesisVisibility.consecutiveFrames}/2 frame`;
        }
      }
      return true;
    }

    buildAppearanceFitReport(inputRecipe, mesh) {
      const recipe = normalizeAppearanceRecipe(inputRecipe, this.state.roster.activeId);
      const values = Object.entries(recipe.morphs || {}).map(([id, raw]) => ({
        id,
        value: clamp(Number(raw), 0, 1),
        distance: Math.abs(Number(raw) - 0.5)
      }));
      const extremes = values.filter((item) => item.distance > 0.43);
      const asymmetry = recipe.advanced && !recipe.symmetry
        ? ["eyeLeft", "eyeRight", "earLeft", "earRight", "armLeft", "armRight", "legLeft", "legRight"]
          .map((id) => Math.abs((recipe.morphs?.[id] ?? 0.5) - 0.5))
          .reduce((sum, value) => sum + value, 0)
        : 0;
      const scale = Number(mesh?.userData?.visualHeight || 1);
      const score = clamp(Math.round(100 - extremes.length * 3 - asymmetry * 5 - (scale < 0.86 || scale > 1.14 ? 7 : 0)), 56, 100);
      const warnings = [];
      if (extremes.length) warnings.push(`${extremes.length} vùng đang ở gần giới hạn morph; đã giữ collider gameplay an toàn.`);
      if (asymmetry > 0.9) warnings.push("Độ lệch trái–phải cao; nên kiểm tra vai, mắt và chân trong turntable.");
      if (recipe.surface.wetness > 0.82) warnings.push("Độ ẩm da cao; giảm nếu đang dùng cảnh mưa để tránh highlight quá mạnh.");
      if (recipe.decals.age > 0.82 && recipe.decals.wrinkles < 0.35) warnings.push("Tuổi sinh học cao nhưng nếp nhăn thấp; có thể tăng chi tiết da để tự nhiên hơn.");
      const runtime = mesh?.userData?.characterRuntime;
      if (runtime?.qaReport && runtime.qaReport.faceMorphTargets < 52) warnings.push(`GLB hiện có ${runtime.qaReport.faceMorphTargets || 0}/52 morph native; fallback 52 kênh vẫn đang hoạt động.`);
      const level = score >= 90 ? "is-safe" : score >= 75 ? "is-watch" : "is-review";
      return {
        score,
        level,
        label: level === "is-safe" ? "Sẵn sàng" : level === "is-watch" ? "Cần xem lại" : "Cần cân đối",
        summary: warnings[0] || "Tỷ lệ cơ thể, vật liệu và collider đang nằm trong vùng an toàn.",
        warnings
      };
    }

    autoFitCharacter() {
      if (this.genesisActive && this.genesisScene) {
        this.fitGenesisCamera(this.genesisActualModel || this.genesisFallbackModel, this.appearanceFocus || "body");
        return;
      }
      const id = this.state.roster.activeId;
      const before = clone(this.activeAppearanceRecipe());
      const recipe = this.activeAppearanceRecipe();
      Object.keys(recipe.morphs || {}).forEach((key) => {
        const value = Number(recipe.morphs[key]);
        if (!Number.isFinite(value)) return;
        recipe.morphs[key] = Number(clamp(value, 0.12, 0.88).toFixed(3));
      });
      recipe.morphs.height = Number(clamp(recipe.morphs.height, 0.22, 0.78).toFixed(3));
      recipe.morphs.bodyMass = Number(clamp(recipe.morphs.bodyMass, 0.18, 0.82).toFixed(3));
      recipe.updatedAt = nowIso();
      this.applyAppearanceToMesh(this.characterMeshes.get(id), recipe, id);
      this.recordAppearanceChange(before);
      this.appearanceDirty = true;
      this.toast("Đã cân đối silhouette, tỷ lệ và vùng collider.", "success");
    }

    setGenesisMotion(motion = "idle") {
      this.genesisMotion = CHARACTER_MOTION_LIBRARY[motion] ? motion : "idle";
      const runtime = this.characterRuntimes.get(this.state.roster.activeId);
      if (runtime) {
        runtime.state = "";
        this.playCharacterClip(runtime, this.genesisMotion);
      }
    }

    setCharacterFacePreview(expression = "neutral", viseme = "neutral", duration = 12000) {
      const safeExpression = CHARACTER_EXPRESSION_PRESETS[expression] ? expression : "neutral";
      const safeViseme = CHARACTER_VISEMES[viseme] ? viseme : "neutral";
      const values = {
        ...Object.fromEntries(MEDIAPIPE_FACE_CHANNELS.map((channel) => [channel, 0])),
        ...CHARACTER_EXPRESSION_PRESETS[safeExpression],
        ...CHARACTER_VISEMES[safeViseme]
      };
      this.facePreview = {
        expression: safeExpression,
        viseme: safeViseme,
        values,
        until: performance.now() + Math.max(500, Number(duration || 0))
      };
      const mesh = this.characterMeshes.get(this.state.roster.activeId);
      this.applyFaceBlendshapes(mesh, values);
      this.applyBoneFacialFallback(mesh, values, 0.78);
    }

    setGenesisLighting(preset = "cinematic") {
      const safePreset = APPEARANCE_ASSETS.lighting.includes(preset) ? preset : "cinematic";
      const recipe = this.activeAppearanceRecipe();
      const before = clone(recipe);
      recipe.lighting = safePreset;
      recipe.updatedAt = nowIso();
      this.genesisLighting = safePreset;
      if (appearanceFingerprint(before, this.state.roster.activeId) !== appearanceFingerprint(recipe, this.state.roster.activeId)) {
        this.appearanceHistory.push(normalizeAppearanceRecipe(before, this.state.roster.activeId));
        this.appearanceHistory = this.appearanceHistory.slice(-30);
        this.appearanceFuture = [];
        this.appearanceDirty = true;
      }
      const profile = {
        daylight: { time: 11.5, exposure: 1.04 },
        night: { time: 22.2, exposure: 0.94 },
        neon: { time: 1.4, exposure: 1.16 },
        cinematic: { time: 17.8, exposure: 1.2 }
      }[safePreset];
      this.state.worldTime = profile.time;
      if (this.renderer) this.renderer.toneMappingExposure = profile.exposure;
      this.updateWorld?.(0, performance.now());
    }

    restoreGenesisLighting() {
      if (!this.genesisOriginalLighting) return;
      this.state.worldTime = this.genesisOriginalLighting.worldTime;
      if (this.renderer) this.renderer.toneMappingExposure = this.genesisOriginalLighting.exposure;
      this.genesisOriginalLighting = null;
    }

    async copyCharacterDNA() {
      const field = this.root.querySelector("[data-genesis-dna], [data-character-dna]");
      const value = field?.value || encodeCharacterDNA(this.activeAppearanceRecipe(), this.state.roster.activeId);
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        field?.focus?.();
        field?.select?.();
        document.execCommand?.("copy");
      }
      this.toast("Đã sao chép Character DNA.", "success");
    }

    applyCharacterDNA(value) {
      try {
        const payload = decodeCharacterDNA(value);
        const id = this.state.roster.activeId;
        const before = clone(this.activeAppearanceRecipe());
        this.state.appearance.recipes[id] = normalizeAppearanceRecipe(payload.recipe, id);
        this.applyAppearanceToMesh(this.characterMeshes.get(id), this.state.appearance.recipes[id], id);
        if (before.baseModel !== this.state.appearance.recipes[id].baseModel) this.rebuildActiveBuiltInCharacter();
        this.recordAppearanceChange(before);
        this.setCharacterFacePreview(this.state.appearance.recipes[id].expression, this.state.appearance.recipes[id].viseme);
        this.refreshGenesisCreator();
        this.renderCurrentPanel();
        this.toast("Đã nạp Character DNA và kiểm tra giới hạn hình thể.", "success");
      } catch (error) {
        this.toast(error?.message || "Không đọc được Character DNA.", "error");
      }
    }

    rebuildActiveBuiltInCharacter() {
      const id = this.state.roster.activeId;
      const profile = CHARACTERS[id] || CHARACTERS.lyra;
      const oldMesh = this.characterMeshes.get(id);
      if (!oldMesh) return;
      const oldRuntime = oldMesh.userData?.characterRuntime || this.characterRuntimes.get(id);
      const next = this.createPhotorealCharacterModel(profile, 1);
      next.position.copy(oldMesh.position);
      next.rotation.copy(oldMesh.rotation);
      next.visible = true;
      const weapon = this.createPlayerWeapon(profile);
      next.userData.parts.weaponAnchor.add(weapon);
      next.userData.lodVariants.attachments = [weapon];
      next.userData.weapon = weapon;
      (oldMesh.parent || this.world).add(next);
      oldMesh.parent?.remove(oldMesh);
      this.disposeCharacterObject(oldMesh, oldRuntime);
      this.characterRuntimes.delete(id);
      this.characterMeshes.set(id, next);
      this.playerMesh = next;
      this.playerWeapon = weapon;
      this.registerCharacterRuntime(next, profile, id, "hero", next.userData.builtInAnimations || []);
      this.applyAppearanceToMesh(next, this.activeAppearanceRecipe(), id);
      this.setGenesisMotion(this.genesisMotion || "idle");
      if (this.genesisActive && this.genesisScene) {
        this.genesisActualModel = next;
        this.setGenesisModelOpacity(next, 0.015);
        this.genesisVisibility = { consecutiveFrames: 0, validated: false, crossfadeStartedAt: 0, startedAt: performance.now(), report: null };
        this.fitGenesisCamera(next, this.appearanceFocus || "body");
      } else {
        this.updateCamera(true, 0.016);
      }
    }

    async completeGenesisCreator() {
      if (this.genesisCompleting) return;
      this.genesisCompleting = true;
      const input = this.root.querySelector("[data-genesis-name]");
      const cleanName = String(input?.value || this.state.player.name || "")
        .replace(/[<>{}[\]\\]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 40);
      this.state.player.name = cleanName.length >= 2 ? cleanName : (CHARACTERS[this.state.roster.activeId]?.name || "Nhà du hành H");
      this.state.appearance.creatorCompletedAt = nowIso();
      this.state.appearance.creatorVersion = CHARACTER_VISUAL_VERSION;
      this.state.appearance.lastSavedAt = nowIso();
      this.teardownGenesisPreview({ restorePlayer: true });
      this.restoreGenesisLighting();
      await this.saveProgress("Hoàn tất Character Genesis");
      const section = this.root.querySelector("[data-har-genesis]");
      if (section) section.hidden = true;
      this.root.classList.remove("is-genesis");
      this.genesisActive = false;
      this.genesisCompleting = false;
      this.positionCharacterInWorld(this.playerMesh, this.state.player.x, this.state.player.y, this.state.player.z);
      this.cameraPitch = 0.14;
      this.cameraDistance = 10.8;
      this.updateCamera(true, 0.016);
      this.updateUi(true);
      this.beginRuntimeSession(`${this.state.player.name} đã sẵn sàng · bước vào H-Central.`);
      root.setTimeout(() => {
        if (!this.destroyed && this.running && !this.genesisActive) {
          this.openCinematicGallery("central", { source: "genesis-complete", autoplay: true });
        }
      }, 180);
    }

    resetGraphicsAfterFailure() {
      this.teardownGenesisPreview({ restorePlayer: false });
      this.restoreGenesisLighting();
      if (this.cinematicActorRestore) this.restoreGameplaySceneFromCinematic();
      if (this.frameHandle) cancelAnimationFrame(this.frameHandle);
      this.frameHandle = 0;
      try { this.renderer?.dispose?.(); } catch {}
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      this.world = null;
      this.playerMesh = null;
      this.characterMeshes.clear();
      this.characterRuntimes.forEach((runtime) => runtime.mixer?.stopAllAction?.());
      this.characterRuntimes.clear();
      this.entities.clear();
      this.enemies.clear();
      this.collectibles.clear();
      this.npcs.clear();
      this.portals.clear();
      this.streamingGroups.clear();
      this.zoneFxGroups.clear();
      this.shadowCastersByZone.clear();
      this.activeShadowCasters.clear();
      this.worldSpinners = [];
      this.climbableObjects = [];
      this.livingWorldActors = [];
      this.footprints = [];
      this.dynamicFoliage = [];
      this.dynamicPebbleFields = [];
      this.dynamicNatureScratch = null;
      this.sunCorona = null;
      this.disposePhotorealAssets();
      this.disposeBuiltInCharacterAssets();
      this.disposeLicensedEnvironmentAssets();
      this.photorealStatus = "pending";
      if (this.root) this.root.dataset.characterPreview = "fallback";
    }

    enterRendererRecovery(reason = "Renderer bị gián đoạn.") {
      if (this.destroyed) return;
      this.runtimeFailureCount += 1;
      this.forceCompatibility = true;
      this.running = false;
      this.paused = true;
      this.menuPaused = false;
      this.genesisActive = false;
      this.runtimeStarted = false;
      this.started = false;
      this.resetGraphicsAfterFailure();
      const start = this.root.querySelector("[data-har-start]");
      const recovery = this.root.querySelector("[data-har-loading-recovery]");
      const continueButton = this.root.querySelector("[data-har-continue]");
      const newButton = this.root.querySelector("[data-har-new]");
      if (start) start.hidden = false;
      if (recovery) recovery.hidden = false;
      if (continueButton) continueButton.disabled = false;
      if (newButton) newButton.disabled = false;
      this.setLoading(0, `${reason} Hãy chọn “Chạy cấu hình nhẹ” để tự khôi phục.`);
      this.root.querySelector("[data-har-loading-text]")?.classList.add("har-unsupported");
    }

    supportsRenderer() {
      try {
        const probe = document.createElement("canvas");
        return Boolean(root.navigator?.gpu || probe.getContext("webgl2", { failIfMajorPerformanceCaveat: false }) || probe.getContext("webgl"));
      } catch {
        return false;
      }
    }

    async setupRenderer() {
      let THREE = this.THREE;
      const canvas = this.root.querySelector("[data-har-world]");
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x050816);
      this.scene.fog = new THREE.FogExp2(0x071023, 0.0095);
      this.camera = new THREE.PerspectiveCamera(CINEMATIC_CAMERA.verticalFovDeg, 1, 0.1, 420);
      this.camera.position.set(0, 10, 14);
      const quality = this.state.settings.quality;
      try {
        if (this.rendererBackend === "webgpu" && THREE.WebGPURenderer) {
          this.renderer = new THREE.WebGPURenderer({
            canvas,
            antialias: !["low"].includes(quality),
            powerPreference: "high-performance",
            alpha: false
          });
          await this.renderer.init();
        } else {
          this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: !["low"].includes(quality),
            powerPreference: "high-performance",
            alpha: false
          });
        }
      } catch (error) {
        if (this.rendererBackend !== "webgpu") throw error;
        this.THREE = await import("./vendor/three.module.min.js");
        THREE = this.THREE;
        this.rendererBackend = "webgl2";
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050816);
        this.scene.fog = new THREE.FogExp2(0x071023, 0.0095);
        this.camera = new THREE.PerspectiveCamera(CINEMATIC_CAMERA.verticalFovDeg, 1, 0.1, 420);
        this.camera.position.set(0, 10, 14);
        this.renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: !["low"].includes(quality),
          powerPreference: "high-performance",
          alpha: false
        });
      }
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = quality === "cinematic" ? 1.08 : 0.98;
      this.frameScratch = {
        dayColor: new THREE.Color(),
        biomeFog: new THREE.Color(),
        cameraDesired: new THREE.Vector3(),
        cameraFocus: new THREE.Vector3(),
        cameraDirection: new THREE.Vector3(),
        cameraTargetFocus: new THREE.Vector3(),
        cameraTargetPosition: new THREE.Vector3(),
        cameraCinematicPosition: new THREE.Vector3()
      };
      if ("physicallyCorrectLights" in this.renderer) this.renderer.physicallyCorrectLights = true;
      this.root.dataset.cameraSensor = `${CINEMATIC_CAMERA.sensorWidthMm}x${CINEMATIC_CAMERA.sensorHeightMm}mm`;
      this.root.dataset.cameraLens = `${CINEMATIC_CAMERA.focalLengthMm}mm`;
      this.root.dataset.cameraExposure = `f${CINEMATIC_CAMERA.aperture} · ${CINEMATIC_CAMERA.shutterSpeed} · ISO ${CINEMATIC_CAMERA.iso}`;
      if (this.renderer.shadowMap) {
        this.renderer.shadowMap.enabled = quality !== "low";
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.shadowMap.autoUpdate = true;
      }
      this.root.dataset.renderer = this.rendererBackend;
      const rendererLabel = this.root.querySelector("[data-har-renderer]");
      if (rendererLabel) rendererLabel.textContent = this.rendererBackend === "webgpu" ? "WEBGPU · PBR" : "WEBGL2 · PBR";
      // Frame timing is derived from requestAnimationFrame timestamps in frame().
      // Do not construct the deprecated THREE.Clock here: it was unused and
      // emitted a warning on every remount in current Three.js releases.
      this.clock = null;
      if (this.rendererBackend === "webgl2") {
        this.listen(canvas, "webglcontextlost", (event) => {
          event.preventDefault();
          this.enterRendererRecovery("Kết nối với GPU đã bị mất.");
        });
        this.listen(canvas, "webglcontextrestored", () => {
          this.forceCompatibility = true;
          this.toast("GPU đã phục hồi. Game sẽ khởi động bằng cấu hình an toàn.", "success");
        });
      }
      this.resize();
    }

    async loadPhotorealAssets() {
      const THREE = this.THREE;
      const visualStyle = this.state.settings.visualStyle;
      const saveData = Boolean(root.navigator?.connection?.saveData);
      const lowMemory = Number(root.navigator?.deviceMemory || 8) <= 2;
      this.root.dataset.visualStyle = visualStyle;
      if (visualStyle === "performance") {
        this.photorealStatus = "performance";
        this.root.classList.remove("is-photoreal");
        return;
      }
      this.photorealStatus = "loading";
      const loader = new THREE.TextureLoader();
      const loadTexture = (url) => new Promise((resolve, reject) => {
        let settled = false;
        const timeout = root.setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error(`Quá thời gian tải ${url}`));
        }, 8000);
        loader.load(url, (texture) => {
          if (settled) {
            texture?.dispose?.();
            return;
          }
          settled = true;
          root.clearTimeout(timeout);
          resolve(texture);
        }, undefined, (error) => {
          if (settled) return;
          settled = true;
          root.clearTimeout(timeout);
          reject(error);
        });
      });
      const configureSurfaceTexture = (texture, role) => {
        if (!texture) return null;
        texture.colorSpace = role === "albedo" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(14, 14);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = Math.min(8, this.renderer.capabilities?.getMaxAnisotropy?.() || 1);
        texture.needsUpdate = true;
        return texture;
      };
      const panoramaPromise = saveData || lowMemory || this.state.settings.quality === "low"
        ? Promise.resolve(null)
        : loadTexture(PHOTOREAL_ASSETS.panorama);
      const scenicPromise = loadTexture(PHOTOREAL_ASSETS.scenicPanorama);
      const terrainPromise = saveData || lowMemory || this.state.settings.quality === "low"
        ? Promise.resolve(null)
        : Promise.all(Object.entries(PHOTOREAL_ASSETS.terrain).map(async ([role, url]) => [role, await loadTexture(url)]));
      const hdrPromise = saveData || lowMemory || this.state.settings.quality === "low"
        ? Promise.resolve(null)
        : import("./vendor/addons/loaders/HDRLoader.js")
          .then(({ HDRLoader }) => new Promise((resolve, reject) => {
            let settled = false;
            const timeout = root.setTimeout(() => {
              if (settled) return;
              settled = true;
              reject(new Error("HDR environment timeout"));
            }, 10000);
            new HDRLoader().load(PHOTOREAL_ASSETS.hdrEnvironment, (texture) => {
              if (settled) {
                texture?.dispose?.();
                return;
              }
              settled = true;
              root.clearTimeout(timeout);
              resolve(texture);
            }, undefined, (error) => {
              if (settled) return;
              settled = true;
              root.clearTimeout(timeout);
              reject(error);
            });
          }));
      const [panoramaResult, scenicResult, terrainResult, hdrResult] = await Promise.allSettled([
        panoramaPromise,
        scenicPromise,
        terrainPromise,
        hdrPromise
      ]);
      if (panoramaResult.status === "fulfilled" && panoramaResult.value) {
        const texture = panoramaResult.value;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        this.photorealAssets.panorama = texture;
      }
      if (scenicResult.status === "fulfilled" && scenicResult.value) {
        const texture = scenicResult.value;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = Math.min(4, this.renderer.capabilities?.getMaxAnisotropy?.() || 1);
        this.photorealAssets.scenicPanorama = texture;
      }
      if (terrainResult.status === "fulfilled" && terrainResult.value) {
        this.photorealAssets.terrain = Object.fromEntries(
          terrainResult.value.map(([role, texture]) => [role, configureSurfaceTexture(texture, role)])
        );
      }
      if (hdrResult.status === "fulfilled" && hdrResult.value) {
        const texture = hdrResult.value;
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        this.photorealAssets.hdrEnvironment = texture;
      }
      this.photorealStatus = this.photorealAssets.hdrEnvironment && this.photorealAssets.terrain
        ? "hdr-photogrammetry-ready"
        : this.photorealAssets.scenicPanorama
          ? "scenic-3d-ready"
          : this.photorealAssets.panorama
            ? "ready"
            : "mesh-pbr";
      this.root.classList.add("is-photoreal");
      this.root.dataset.photorealAssets = this.photorealStatus;
    }

    async loadCharacterModules() {
      try {
        const gltf = await import("./vendor/addons/loaders/GLTFLoader.js");
        this.GLTFLoaderClass = gltf.GLTFLoader || null;
        const [draco, ktx2, meshopt, skeletonUtils] = await Promise.allSettled([
          import("./vendor/addons/loaders/DRACOLoader.js"),
          import("./vendor/addons/loaders/KTX2Loader.js"),
          import("./vendor/addons/libs/meshopt_decoder.module.js"),
          import("./vendor/addons/utils/SkeletonUtils.js")
        ]);
        this.DRACOLoaderClass = draco.status === "fulfilled" ? draco.value.DRACOLoader || null : null;
        this.KTX2LoaderClass = ktx2.status === "fulfilled" ? ktx2.value.KTX2Loader || null : null;
        this.MeshoptDecoder = meshopt.status === "fulfilled" ? meshopt.value.MeshoptDecoder || null : null;
        this.cloneSkinnedCharacter = skeletonUtils.status === "fulfilled" ? skeletonUtils.value.clone || null : null;
        this.characterDecodersReady = Boolean(
          this.GLTFLoaderClass && this.DRACOLoaderClass && this.KTX2LoaderClass && this.MeshoptDecoder
        );
      } catch {
        this.GLTFLoaderClass = null;
        this.DRACOLoaderClass = null;
        this.KTX2LoaderClass = null;
        this.MeshoptDecoder = null;
        this.cloneSkinnedCharacter = null;
        this.characterDecodersReady = false;
      }
      this.root.dataset.characterLoader = this.GLTFLoaderClass ? "ready" : "fallback";
      this.root.dataset.characterDecoders = this.characterDecodersReady ? "ready" : "basic";
    }

    async loadLicensedEnvironmentAssets() {
      if (!this.GLTFLoaderClass) {
        this.licensedEnvironmentStatus = "fallback";
        return;
      }
      this.licensedEnvironmentStatus = "loading";
      const manager = this.THREE?.LoadingManager ? new this.THREE.LoadingManager() : undefined;
      if (manager) manager.hhPreferTextureLoader = true;
      const loader = new this.GLTFLoaderClass(manager);
      if (this.MeshoptDecoder) loader.setMeshoptDecoder(this.MeshoptDecoder);
      const quality = this.state.settings.quality;
      const saveData = Boolean(root.navigator?.connection?.saveData);
      const lowMemory = Number(root.navigator?.deviceMemory || 8) <= 2;
      const allowCinematicScans = !saveData && !lowMemory && ["auto", "high", "cinematic"].includes(quality);
      const entries = Object.entries(LICENSED_ENVIRONMENT_ASSETS)
        .filter(([id]) => allowCinematicScans || !CINEMATIC_ENVIRONMENT_ASSET_IDS.has(id));
      const results = await Promise.allSettled(entries.map(async ([id, url]) => {
        const gltf = await Promise.race([
          loader.loadAsync(url),
          new Promise((_, reject) => root.setTimeout(() => reject(new Error(`Environment timeout: ${id}`)), 12000))
        ]);
        gltf.scene?.traverse?.((object) => {
          if (!object.isMesh) return;
          object.castShadow = false;
          object.receiveShadow = true;
          object.frustumCulled = true;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.filter(Boolean).forEach((material) => {
            material.envMapIntensity = Math.max(0.72, Number(material.envMapIntensity || 0));
            if (["boulder", "mossRocks"].includes(id) && material.color) {
              material.color.set(material.map ? 0xffffff : id === "mossRocks" ? 0x75806f : 0x8a8378);
              material.roughness = clamp(Number(material.roughness ?? 0.86), 0.64, 0.92);
            }
            material.needsUpdate = true;
          });
        });
        return [id, gltf];
      }));
      results.forEach((result) => {
        if (result.status === "fulfilled") this.licensedEnvironmentAssets.set(result.value[0], result.value[1]);
      });
      this.licensedEnvironmentStatus = this.licensedEnvironmentAssets.size === entries.length
        ? "ready"
        : this.licensedEnvironmentAssets.size
          ? "partial"
          : "fallback";
      this.root.dataset.licensedEnvironment = this.licensedEnvironmentStatus;
      this.root.dataset.cinematicScans = allowCinematicScans ? "enabled" : "adaptive-fallback";
    }

    async loadCharacterPipelineManifest() {
      this.characterPipelineManifest = [];
      this.characterExternalCandidates = [];
      this.characterPipelineStatus = "not-configured";
      try {
        const response = await fetch(CHARACTER_PIPELINE_MANIFEST_URL, { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        const entries = Array.isArray(payload?.sources) ? payload.sources : [];
        this.characterExternalCandidates = (Array.isArray(payload?.externalCandidates) ? payload.externalCandidates : [])
          .map((entry) => ({
            id: String(entry?.id || "").slice(0, 80),
            characterId: CHARACTERS[entry?.characterId] ? entry.characterId : "",
            label: String(entry?.label || "Sketchfab character").slice(0, 100),
            author: String(entry?.author || "").slice(0, 80),
            page: /^https:\/\/sketchfab\.com\//.test(String(entry?.page || "")) ? String(entry.page).slice(0, 300) : "",
            license: String(entry?.license || "").slice(0, 40),
            status: String(entry?.status || "awaiting-download").slice(0, 40),
            weaponClass: WEAPON_COMBAT_PROFILES[entry?.weaponClass] ? entry.weaponClass : "sword"
          }))
          .filter((entry) => entry.id && entry.characterId && entry.page && entry.license === "CC-BY-4.0");
        const normalizedEntries = entries.map((entry) => ({
          id: String(entry?.id || "").slice(0, 80),
          provider: CHARACTER_PIPELINE_SOURCES.includes(entry?.provider) ? entry.provider : "",
          modelId: String(entry?.modelId || "").slice(0, 60),
          url: String(entry?.url || "").slice(0, 240),
          motionUrl: String(entry?.motionUrl || "").slice(0, 240),
          motionManifestUrl: String(entry?.motionManifestUrl || "").slice(0, 240),
          label: String(entry?.label || entry?.provider || "Web GLB").slice(0, 100),
          quality: String(entry?.quality || "web").slice(0, 32),
          image: String(entry?.image || "").slice(0, 240),
          license: String(entry?.license || "").slice(0, 40),
          author: String(entry?.author || "").slice(0, 80),
          page: /^https:\/\/sketchfab\.com\//.test(String(entry?.page || "")) ? String(entry.page).slice(0, 300) : "",
          attribution: String(entry?.attribution || "").slice(0, 180),
          sha256: String(entry?.sha256 || "").slice(0, 80),
          motionSha256: String(entry?.motionSha256 || "").slice(0, 80),
          ethnicity: String(entry?.ethnicity || "").slice(0, 40),
          gender: String(entry?.gender || "").slice(0, 8),
          outfit: String(entry?.outfit || "").slice(0, 40)
        })).filter((entry) => entry.provider && entry.modelId && entry.url);
        const catalogs = Array.isArray(payload?.catalogs) ? payload.catalogs : [];
        const catalogResults = await Promise.allSettled(catalogs.map(async (catalog) => {
          const provider = CHARACTER_PIPELINE_SOURCES.includes(catalog?.provider) ? catalog.provider : "";
          const catalogUrl = String(catalog?.url || "").slice(0, 240);
          const baseUrl = String(catalog?.baseUrl || "").slice(0, 240);
          if (!provider || !catalogUrl || !/^https:\/\//.test(baseUrl)) return [];
          const catalogResponse = await fetch(catalogUrl, { cache: "force-cache" });
          if (!catalogResponse.ok) return [];
          const records = await catalogResponse.json();
          if (!Array.isArray(records)) return [];
          return records.slice(0, 400).map((record) => {
            const label = String(record?.text || "Human").slice(0, 100);
            const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
            return {
              id: `${provider}-${slug}`,
              provider,
              modelId: `valid-${slug}`,
              url: `${baseUrl}${String(record?.model || "").replace(/^\/+/, "")}`.slice(0, 300),
              image: `${baseUrl}${String(record?.image || "").replace(/^\/+/, "")}`.slice(0, 300),
              label: `${String(catalog?.label || "VALID Human").slice(0, 40)} · ${label}`,
              quality: "rigged-human",
              license: String(catalog?.license || "MIT").slice(0, 40),
              ethnicity: String(record?.ethnicity || "").slice(0, 40),
              gender: String(record?.gender || "").slice(0, 8),
              outfit: String(record?.outfit || "").slice(0, 40)
            };
          }).filter((entry) => entry.modelId.length > 8 && /\.glb(?:$|\?)/i.test(entry.url));
        }));
        const catalogEntries = catalogResults.flatMap((result) => result.status === "fulfilled" ? result.value : []);
        this.characterPipelineManifest = [...normalizedEntries, ...catalogEntries];
        this.characterPipelineStatus = this.characterPipelineManifest.length ? "configured" : "empty";
      } catch {
        // Missing optional manifest is valid: bundled/procedural remain usable.
      }
      this.root.dataset.characterPipeline = this.characterPipelineStatus;
    }

    async loadMotionLibrary() {
      if (this.motionLibraryAnimations.length) return;
      if (!this.GLTFLoaderClass) {
        this.motionLibraryStatus = "unsupported";
        this.root.dataset.motionLibrary = this.motionLibraryStatus;
        return;
      }
      this.motionLibraryStatus = "loading";
      this.root.dataset.motionLibrary = this.motionLibraryStatus;
      try {
        const response = await fetch(CHARACTER_MOTION_MANIFEST_URL, { cache: "no-store" });
        if (!response.ok) throw new Error(`Motion manifest HTTP ${response.status}`);
        const manifest = await response.json();
        const declaredClips = Array.isArray(manifest?.clips) ? manifest.clips : [];
        if (Number(manifest?.version) !== CHARACTER_VISUAL_VERSION || !declaredClips.length) {
          throw new Error("Motion manifest không đúng Visual V13 hoặc chưa có clip thật");
        }
        const allowed = new Set(declaredClips.map((item) => String(item?.name || "").toLowerCase()).filter(Boolean));
        const manager = this.THREE?.LoadingManager ? new this.THREE.LoadingManager() : undefined;
        const loader = new this.GLTFLoaderClass(manager);
        if (this.MeshoptDecoder) loader.setMeshoptDecoder(this.MeshoptDecoder);
        const gltf = await Promise.race([
          loader.loadAsync(CHARACTER_MOTION_LIBRARY_URL),
          new Promise((_, reject) => root.setTimeout(() => reject(new Error("Motion library timeout")), 12000))
        ]);
        const animations = (gltf.animations || []).filter((clip) => allowed.has(String(clip?.name || "").toLowerCase()));
        if (!animations.length) throw new Error("Motion GLB không có clip khớp manifest");
        const loadedNames = new Set(animations.map((clip) => String(clip?.name || "").toLowerCase()));
        const unresolved = [...allowed].filter((name) => !loadedNames.has(name));
        const declaredMissing = Array.isArray(manifest.missing) ? manifest.missing.map((value) => String(value)) : [];
        this.motionLibraryManifest = {
          version: CHARACTER_VISUAL_VERSION,
          status: manifest.status === "ready" && !unresolved.length ? "ready" : "partial",
          rig: String(manifest.rig || ""),
          fps: clamp(Number(manifest.fps || 30), 12, 60),
          inPlace: manifest.inPlace === true,
          asset: String(manifest.asset || ""),
          optimized: String(manifest.optimized || ""),
          clips: declaredClips.map((item) => ({
            name: String(item?.name || "").toLowerCase(),
            source: String(item?.source || ""),
            sourceAsset: String(item?.sourceAsset || ""),
            category: String(item?.category || ""),
            loop: item?.loop !== false,
            speed: clamp(Number(item?.speed || 0), 0, 1),
            direction: clamp(Number(item?.direction || 0), -180, 180),
            mappedBones: Math.max(0, Number(item?.mappedBones || 0))
          })).filter((item) => item.name && loadedNames.has(item.name)),
          missing: [...new Set([...declaredMissing, ...unresolved])].slice(0, 160),
          footMarkers: manifest.footMarkers && typeof manifest.footMarkers === "object" ? manifest.footMarkers : {},
          provenance: Array.isArray(manifest.provenance) ? manifest.provenance.slice(0, 12) : []
        };
        this.motionLibraryAnimations = animations;
        this.motionLibraryStatus = this.motionLibraryManifest.status;
      } catch (error) {
        this.motionLibraryManifest = null;
        this.motionLibraryAnimations = [];
        this.motionLibraryStatus = "failed";
        this.characterAssetStatus.set("motion-v13", `Motion V13 lỗi: ${String(error?.message || error).slice(0, 120)}`);
      }
      this.root.dataset.motionLibrary = this.motionLibraryStatus;
    }

    resolveCharacterAssetCandidates(modelId, requestedProvider = "auto") {
      const preferred = CHARACTER_PIPELINE_SOURCES.includes(requestedProvider) ? requestedProvider : "auto";
      if (preferred === "procedural") return [];
      const order = preferred === "auto"
        ? ["metahuman", "character-creator", "mpfb", "sketchfab-cc-by", "valid-avatar", "bundled"]
        : [preferred, "bundled"];
      const optional = this.characterPipelineManifest
        .filter((entry) => entry.modelId === modelId && order.includes(entry.provider))
        .sort((a, b) => order.indexOf(a.provider) - order.indexOf(b.provider));
      const fallbackUrl = BUILTIN_CHARACTER_ASSETS[modelId]
        || (modelId === "sketchfab-miss-galaxy"
          ? BUILTIN_CHARACTER_ASSETS["valid-asian-f-1-casual"]
          : /^valid-.*-f-/.test(modelId)
            ? BUILTIN_CHARACTER_ASSETS["human-adult-a01"]
            : /^valid-/.test(modelId)
              ? BUILTIN_CHARACTER_ASSETS["human-adult-b01"]
              : "");
      const bundled = fallbackUrl
        ? [{ id: `bundled-${modelId}`, provider: "bundled", modelId, url: fallbackUrl, label: "HH bundled GLB fallback", quality: "fallback-web" }]
        : [];
      const result = [];
      [...optional, ...bundled].forEach((entry) => {
        if (!result.some((candidate) => candidate.url === entry.url)) result.push(entry);
      });
      return result;
    }

    async loadBuiltInCharacterAssets() {
      if (!this.GLTFLoaderClass || !this.cloneSkinnedCharacter) {
        this.builtInCharacterStatus = "fallback";
        this.root.dataset.builtInCharacter = "fallback";
        return;
      }
      this.builtInCharacterStatus = "loading";
      let assetLoadError = false;
      const manager = this.THREE?.LoadingManager ? new this.THREE.LoadingManager() : undefined;
      if (manager) {
        // Embedded GLB images are more reliable through HTMLImageElement on
        // Chromium devices that reject createImageBitmap(blob) decoding.
        manager.hhPreferTextureLoader = true;
        manager.onError = () => { assetLoadError = true; };
      }
      const loader = new this.GLTFLoaderClass(manager);
      const entries = Object.entries(BUILTIN_CHARACTER_ASSETS);
      const results = await Promise.allSettled(entries.map(async ([id, url]) => {
        const gltf = await Promise.race([
          loader.loadAsync(url),
          new Promise((_, reject) => root.setTimeout(() => reject(new Error(`Quá thời gian tải ${url}`)), 12000))
        ]);
        // GLTFLoader can resolve before an embedded blob texture reports its
        // decode failure. Let LoadingManager flush those late errors before QA.
        await new Promise((resolve) => root.setTimeout(resolve, 320));
        this.sanitizeBuiltInCharacterAsset(gltf);
        if (assetLoadError) gltf.userData.hhTextureFallbacks = Math.max(1, Number(gltf.userData?.hhTextureFallbacks || 0));
        gltf.scene.traverse?.((object) => {
          if (!object.isMesh && !object.isSkinnedMesh) return;
          object.userData ||= {};
          object.userData.sharedAsset = true;
          object.geometry?.userData && (object.geometry.userData.sharedAsset = true);
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.filter(Boolean).forEach((material) => {
            [
              "map", "normalMap", "roughnessMap", "metalnessMap", "aoMap",
              "emissiveMap", "alphaMap"
            ].forEach((slot) => {
              if (material[slot]?.isTexture) {
                material[slot].userData ||= {};
                material[slot].userData.sharedAsset = true;
              }
            });
          });
        });
        return [id, gltf];
      }));
      results.forEach((result) => {
        if (result.status !== "fulfilled") return;
        this.builtInCharacterAssets.set(result.value[0], result.value[1]);
      });
      this.builtInCharacterStatus = this.builtInCharacterAssets.size === entries.length ? "ready" : this.builtInCharacterAssets.size ? "partial" : "fallback";
      this.root.dataset.builtInCharacter = this.builtInCharacterStatus;
    }

    async loadCharacterAssetsFromPipeline() {
      if (!this.GLTFLoaderClass || !this.cloneSkinnedCharacter) {
        this.builtInCharacterStatus = "fallback";
        this.root.dataset.builtInCharacter = "fallback";
        return;
      }
      await Promise.all([this.loadCharacterPipelineManifest(), this.loadMotionLibrary()]);
      this.builtInCharacterStatus = "loading";
      let assetLoadError = false;
      const manager = this.THREE?.LoadingManager ? new this.THREE.LoadingManager() : undefined;
      if (manager) {
        manager.hhPreferTextureLoader = true;
        manager.onError = () => { assetLoadError = true; };
      }
      const loader = new this.GLTFLoaderClass(manager);
      if (this.MeshoptDecoder) loader.setMeshoptDecoder(this.MeshoptDecoder);
      const recipeModels = Object.values(this.state.appearance?.recipes || {})
        .map((recipe) => String(recipe?.baseModel || ""))
        .filter(Boolean);
      const entries = [...new Set(["human-adult-b01", ...recipeModels])];
      const results = await Promise.allSettled(entries.map(async (id) => {
        const recipes = Object.values(this.state.appearance?.recipes || {}).filter((recipe) => recipe?.baseModel === id);
        const requestedProvider = recipes.find((recipe) => recipe.sourceProvider && recipe.sourceProvider !== "auto")?.sourceProvider
          || this.state.settings.characterPipeline;
        if (requestedProvider === "procedural") {
          this.builtInCharacterAssets.delete(id);
          this.builtInCharacterSources.delete(id);
          return [id, null];
        }
        let lastError = null;
        for (const candidate of this.resolveCharacterAssetCandidates(id, requestedProvider)) {
          try {
            assetLoadError = false;
            const gltf = await Promise.race([
              loader.loadAsync(candidate.url),
              new Promise((_, reject) => root.setTimeout(() => reject(new Error(`Quá thời gian tải ${candidate.url}`)), candidate.provider === "bundled" ? 12000 : 15000))
            ]);
            gltf.userData ||= {};
            gltf.userData.hhSourceProvider = candidate.provider;
            gltf.userData.hhSourceLabel = candidate.label;
            gltf.userData.hhAssetPath = candidate.url;
            gltf.userData.hhAuthor = candidate.author || "";
            gltf.userData.hhLicense = candidate.license || "";
            gltf.userData.hhSourcePage = candidate.page || "";
            gltf.userData.hhAttribution = candidate.attribution || "";
            gltf.userData.hhMotionSource = "native";
            if (candidate.motionUrl && candidate.motionManifestUrl) {
              try {
                const motionManifestResponse = await fetch(candidate.motionManifestUrl, { cache: "no-store" });
                if (!motionManifestResponse.ok) throw new Error(`Motion manifest HTTP ${motionManifestResponse.status}`);
                const motionManifest = await motionManifestResponse.json();
                if (motionManifest?.status !== "ready" || motionManifest?.qaStatus !== "approved") {
                  throw new Error("Motion library has not passed visual QA");
                }
                const motionGltf = await Promise.race([
                  loader.loadAsync(candidate.motionUrl),
                  new Promise((_, reject) => root.setTimeout(() => reject(new Error(`Motion timeout ${candidate.motionUrl}`)), 15000))
                ]);
                const mergedAnimations = new Map();
                [...(gltf.animations || []), ...(motionGltf.animations || [])].forEach((clip) => {
                  const key = String(clip?.name || "").toLowerCase();
                  if (key) mergedAnimations.set(key, clip);
                });
                gltf.animations = [...mergedAnimations.values()];
                if (motionGltf.animations?.length) gltf.userData.hhMotionSource = "offline-baked-model-specific";
              } catch (motionError) {
                gltf.userData.hhMotionError = String(motionError?.message || motionError).slice(0, 160);
              }
            }
            await new Promise((resolve) => root.setTimeout(resolve, 320));
            this.sanitizeBuiltInCharacterAsset(gltf);
            gltf.scene.traverse?.((object) => {
              if (!object.isMesh && !object.isSkinnedMesh) return;
              object.userData ||= {};
              object.userData.sharedAsset = true;
              object.geometry?.userData && (object.geometry.userData.sharedAsset = true);
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              materials.filter(Boolean).forEach((material) => {
                ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap"].forEach((slot) => {
                  if (material[slot]?.isTexture) {
                    material[slot].userData ||= {};
                    material[slot].userData.sharedAsset = true;
                  }
                });
              });
            });
            return [id, gltf];
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError || new Error(`Không có asset cho ${id}`);
      }));
      results.forEach((result) => {
        if (result.status !== "fulfilled") return;
        const [id, gltf] = result.value;
        if (!gltf) return;
        this.builtInCharacterAssets.set(id, gltf);
        this.builtInCharacterSources.set(id, {
          provider: gltf.userData?.hhSourceProvider || "bundled",
          label: gltf.userData?.hhSourceLabel || "HH bundled GLB",
          url: gltf.userData?.hhAssetPath || BUILTIN_CHARACTER_ASSETS[id],
          author: gltf.userData?.hhAuthor || "",
          license: gltf.userData?.hhLicense || "",
          page: gltf.userData?.hhSourcePage || "",
          attribution: gltf.userData?.hhAttribution || "",
          motionSource: gltf.userData?.hhMotionSource || "native"
        });
      });
      this.builtInCharacterStatus = this.builtInCharacterAssets.size === entries.length
        ? "ready"
        : this.builtInCharacterAssets.size
          ? "partial"
          : "fallback";
      this.root.dataset.builtInCharacter = this.builtInCharacterStatus;
      const activeModelId = this.activeAppearanceRecipe()?.baseModel || "";
      const activeSource = this.builtInCharacterSources.get(activeModelId);
      this.root.dataset.characterModel = activeModelId || "fallback";
      this.root.dataset.characterSource = activeSource?.provider || "fallback";
    }

    sanitizeBuiltInCharacterAsset(gltf) {
      if (!gltf?.scene) return;
      const THREE = this.THREE;
      const slots = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap"];
      let brokenTextures = 0;
      let meshCount = 0;
      gltf.scene.traverse?.((object) => {
        if (!object.isMesh && !object.isSkinnedMesh) return;
        meshCount += 1;
        object.visible = true;
        object.frustumCulled = false;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => {
          material.userData ||= {};
          slots.forEach((slot) => {
            const texture = material[slot];
            if (!texture?.isTexture) return;
            const image = texture.image || texture.source?.data;
            const invalid = !image || (Number(image.width) === 0 && Number(image.height) === 0);
            if (invalid) {
              material[slot] = null;
              brokenTextures += 1;
            }
          });
          material.transparent = false;
          material.opacity = 1;
          material.alphaTest = 0;
          material.depthWrite = true;
          material.depthTest = true;
          material.side = THREE.DoubleSide;
          if (material.color && (!material.map || brokenTextures)) {
            const identity = `${object.name || ""} ${material.name || ""}`.toLowerCase();
            material.color.set(/visor|eye|glass/.test(identity) ? 0x6feeff : /skin|face|body|head/.test(identity) ? 0xb98273 : 0x6f7f98);
          }
          material.needsUpdate = true;
        });
      });
      gltf.userData ||= {};
      gltf.userData.hhTextureFallbacks = brokenTextures;
      gltf.userData.hhRenderableMeshes = meshCount;
    }

    disposeBuiltInCharacterAssets() {
      const geometries = new Set();
      const materials = new Set();
      const textures = new Set();
      const textureSlots = [
        "map", "normalMap", "roughnessMap", "metalnessMap", "aoMap",
        "emissiveMap", "alphaMap", "bumpMap", "displacementMap"
      ];
      this.builtInCharacterAssets.forEach((gltf) => {
        gltf.scene?.traverse?.((object) => {
          if (object.geometry) geometries.add(object.geometry);
          const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
          objectMaterials.filter(Boolean).forEach((material) => {
            materials.add(material);
            textureSlots.forEach((slot) => {
              if (material[slot]?.isTexture) textures.add(material[slot]);
            });
          });
        });
      });
      geometries.forEach((geometry) => geometry.dispose?.());
      textures.forEach((texture) => texture.dispose?.());
      materials.forEach((material) => material.dispose?.());
      this.builtInCharacterAssets.clear();
      this.builtInCharacterSources.clear();
      this.builtInCharacterStatus = "pending";
    }

    disposeLicensedEnvironmentAssets() {
      this.licensedEnvironmentAssets.forEach((gltf) => this.disposeCharacterObject(gltf.scene));
      this.licensedEnvironmentAssets.clear();
      this.licensedEnvironmentStatus = "pending";
    }

    disposePhotorealAssets() {
      const textures = new Set();
      const collect = (value) => {
        if (!value) return;
        if (value.isTexture || typeof value.dispose === "function" && value.image) {
          textures.add(value);
          return;
        }
        if (typeof value === "object") Object.values(value).forEach(collect);
      };
      collect(this.photorealAssets);
      collect(this.terrainSurfaceTextures);
      if (this.terrainTexture) textures.add(this.terrainTexture);
      textures.forEach((texture) => texture.dispose?.());
      this.photorealAssets = { panorama: null, scenicPanorama: null, hdrEnvironment: null, terrain: null };
      this.terrainSurfaceTextures = null;
      this.terrainTexture = null;
    }

    createTerrainTexture() {
      const THREE = this.THREE;
      const scannedTerrain = this.photorealAssets.terrain;
      if (scannedTerrain?.albedo && scannedTerrain?.normal && scannedTerrain?.roughness && scannedTerrain?.height) {
        this.terrainTexture = scannedTerrain.albedo;
        this.terrainSurfaceTextures = {
          albedo: scannedTerrain.albedo,
          normal: scannedTerrain.normal,
          roughness: scannedTerrain.roughness,
          height: scannedTerrain.height,
          ao: scannedTerrain.ao || null,
          source: "ambientcg-ground037-cc0"
        };
        return scannedTerrain.albedo;
      }
      const albedoCanvas = document.createElement("canvas");
      const heightCanvas = document.createElement("canvas");
      const roughnessCanvas = document.createElement("canvas");
      const size = this.state.settings.quality === "low" ? 256 : 512;
      [albedoCanvas, heightCanvas, roughnessCanvas].forEach((canvas) => {
        canvas.width = size;
        canvas.height = size;
      });
      const albedoContext = albedoCanvas.getContext("2d", { alpha: false });
      const heightContext = heightCanvas.getContext("2d", { alpha: false });
      const roughnessContext = roughnessCanvas.getContext("2d", { alpha: false });
      const albedoImage = albedoContext.createImageData(size, size);
      const heightImage = heightContext.createImageData(size, size);
      const roughnessImage = roughnessContext.createImageData(size, size);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const index = (y * size + x) * 4;
          const broad = Math.sin(x * 0.057) * 12 + Math.cos(y * 0.049) * 10 + Math.sin((x + y) * 0.018) * 16;
          const grain = ((x * 17 + y * 31 + (x * y) % 67) % 29) - 14;
          const heightValue = clamp(112 + broad * 1.3 + grain * 0.72, 38, 218);
          const mineral = clamp((Math.sin(x * 0.021 - y * 0.017) + 1) * 0.5, 0, 1);
          albedoImage.data[index] = clamp(62 + broad * 0.36 + grain * 0.22 + mineral * 10, 34, 116);
          albedoImage.data[index + 1] = clamp(69 + broad * 0.4 + grain * 0.18 + mineral * 12, 38, 126);
          albedoImage.data[index + 2] = clamp(66 + broad * 0.28 + grain * 0.16 + mineral * 7, 36, 118);
          albedoImage.data[index + 3] = 255;
          heightImage.data[index] = heightValue;
          heightImage.data[index + 1] = heightValue;
          heightImage.data[index + 2] = heightValue;
          heightImage.data[index + 3] = 255;
          const roughnessValue = clamp(222 - broad * 0.32 + Math.abs(grain) * 0.7, 178, 246);
          roughnessImage.data[index] = roughnessValue;
          roughnessImage.data[index + 1] = roughnessValue;
          roughnessImage.data[index + 2] = roughnessValue;
          roughnessImage.data[index + 3] = 255;
        }
      }
      albedoContext.putImageData(albedoImage, 0, 0);
      heightContext.putImageData(heightImage, 0, 0);
      roughnessContext.putImageData(roughnessImage, 0, 0);
      const makeTexture = (canvas, colorSpace) => {
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(18, 18);
        texture.colorSpace = colorSpace;
        texture.anisotropy = Math.min(8, this.renderer.capabilities?.getMaxAnisotropy?.() || 1);
        texture.needsUpdate = true;
        return texture;
      };
      const albedo = makeTexture(albedoCanvas, THREE.SRGBColorSpace);
      const height = makeTexture(heightCanvas, THREE.NoColorSpace);
      const roughness = makeTexture(roughnessCanvas, THREE.NoColorSpace);
      this.terrainTexture = albedo;
      this.terrainSurfaceTextures = { albedo, height, roughness, normal: null, ao: null, source: "procedural-fallback" };
      return albedo;
    }

    createWorld() {
      const THREE = this.THREE;
      // Keep the renderer quality decision scoped to the world build as well.
      // Previously this function referenced an undeclared `quality`, which
      // aborted the entire start sequence after the renderer was initialized.
      const quality = ["auto", "low", "medium", "high", "cinematic"].includes(this.state?.settings?.quality)
        ? this.state.settings.quality
        : "auto";
      this.world = new THREE.Group();
      this.world.name = "AstralOpenWorld";
      this.scene.add(this.world);
      const environmentMap = this.photorealAssets.hdrEnvironment || this.photorealAssets.panorama;
      if (environmentMap) {
        // The panorama is lighting data only. The visible world is always
        // geometry rendered by the engine, never a flat background image.
        this.scene.environment = environmentMap;
        if ("environmentIntensity" in this.scene) this.scene.environmentIntensity = this.photorealAssets.hdrEnvironment ? 0.92 : 0.68;
        this.scene.fog = new THREE.FogExp2(0x17263a, 0.0068);
      }

      const hemisphere = new THREE.HemisphereLight(0xdce8f5, 0x171a1f, 0.46);
      this.scene.add(hemisphere);
      this.hemisphereLight = hemisphere;

      const sun = new THREE.DirectionalLight(0xfff4e7, 3.15);
      sun.position.set(-24, 42, 18);
      sun.castShadow = Boolean(this.renderer.shadowMap?.enabled);
      const shadowSize = quality === "cinematic" ? 2048 : quality === "high" ? 1536 : quality === "medium" ? 1024 : 768;
      sun.shadow.mapSize.set(shadowSize, shadowSize);
      sun.shadow.camera.left = -75;
      sun.shadow.camera.right = 75;
      sun.shadow.camera.top = 75;
      sun.shadow.camera.bottom = -75;
      sun.shadow.bias = -0.00016;
      sun.shadow.normalBias = 0.024;
      sun.shadow.radius = quality === "cinematic" ? 2.2 : 1.35;
      this.scene.add(sun);
      this.sunLight = sun;

      const hLight = new THREE.PointLight(0xa9d9ff, 3.2, 42, 2);
      hLight.position.set(0, 10, 0);
      this.scene.add(hLight);
      this.hLight = hLight;

      const fill = new THREE.DirectionalLight(0xbfd1e8, 0.18);
      fill.position.set(28, 18, -34);
      this.scene.add(fill);
      this.fillLight = fill;
      const rim = new THREE.DirectionalLight(0xe5edff, 0.26);
      rim.position.set(-18, 15, -42);
      this.scene.add(rim);
      this.rimLight = rim;

      const terrainTexture = this.createTerrainTexture();
      const terrainSegments = quality === "cinematic" ? 160 : quality === "high" ? 128 : quality === "low" ? 48 : 88;
      const terrainGeometry = new THREE.PlaneGeometry(376, 376, terrainSegments, terrainSegments);
      if (terrainGeometry.attributes.uv && !terrainGeometry.attributes.uv1) {
        terrainGeometry.setAttribute("uv1", terrainGeometry.attributes.uv.clone());
      }
      const positions = terrainGeometry.attributes.position;
      for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index);
        const z = positions.getY(index);
        const radius = Math.hypot(x, z);
        const macro = Math.sin(x * 0.047) * 0.58
          + Math.cos(z * 0.054) * 0.46
          + Math.sin((x + z) * 0.025) * 0.72
          + Math.cos(Math.hypot(x + 32, z - 18) * 0.087) * 0.35;
        const centralFlatten = clamp((radius - 30) / 28, 0, 1);
        const edgeRise = clamp((radius - 126) / 48, 0, 1) * 2.8;
        const centralRise = (1 - centralFlatten) * 0.9;
        positions.setZ(index, -0.22 + centralRise + macro * centralFlatten + edgeRise);
      }
      terrainGeometry.computeVertexNormals();
      const scannedTerrain = this.terrainSurfaceTextures?.source === "ambientcg-ground037-cc0";
      const ground = new THREE.Mesh(
        terrainGeometry,
        new THREE.MeshPhysicalMaterial({
          color: scannedTerrain ? 0xffffff : 0xc0c6bd,
          map: terrainTexture,
          bumpMap: this.terrainSurfaceTextures.height,
          bumpScale: scannedTerrain ? 0.2 : 0.34,
          normalMap: this.terrainSurfaceTextures.normal,
          normalScale: new THREE.Vector2(scannedTerrain ? 0.62 : 0, scannedTerrain ? 0.62 : 0),
          roughnessMap: this.terrainSurfaceTextures.roughness,
          aoMap: this.terrainSurfaceTextures.ao,
          aoMapIntensity: scannedTerrain ? 0.72 : 0,
          roughness: 0.92,
          metalness: 0.025,
          clearcoat: 0.12,
          clearcoatRoughness: 0.62,
          envMapIntensity: this.photorealAssets.hdrEnvironment || this.photorealAssets.panorama ? 0.62 : 0.16
        })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      ground.name = "AstralGround";
      this.world.add(ground);
      this.terrainGround = ground;

      this.createToonGradient();
      this.createAtmosphere();
      this.createStarfield();
      this.createZonePlatforms();
      this.createCentralCity();
      this.createAuroraVale();
      this.createCrimsonForge();
      this.createVoidGarden();
      this.createFrontierRegions();
      this.createDungeon();
      this.createWater();
      this.createInstancedNature();
      this.createLicensedEnvironmentDecor();
      this.createElementalPuzzles();
      this.createWeatherField();
      this.createLivingWorldEffects();
      this.createDynamicNatureSystem();
      this.createFootprintPool();
      this.applyBiomeVisualState(this.currentZone);
    }

    createToonGradient() {
      const THREE = this.THREE;
      const data = new Uint8Array([
        28, 28, 34, 255,
        92, 96, 118, 255,
        178, 188, 215, 255,
        255, 255, 255, 255
      ]);
      const texture = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      texture.userData ||= {};
      texture.userData.sharedAsset = true;
      this.toonGradient = texture;
    }

    createAtmosphere() {
      const THREE = this.THREE;
      const skyGeometry = new THREE.SphereGeometry(280, 40, 24);
      const skyPositions = skyGeometry.attributes.position;
      const skyColors = new Float32Array(skyPositions.count * 3);
      const horizon = new THREE.Color(0x33205c);
      const zenith = new THREE.Color(0x061027);
      const lower = new THREE.Color(0x12091f);
      for (let index = 0; index < skyPositions.count; index += 1) {
        const y = skyPositions.getY(index) / 280;
        const color = y >= 0
          ? horizon.clone().lerp(zenith, clamp(y, 0, 1))
          : horizon.clone().lerp(lower, clamp(-y, 0, 1));
        skyColors[index * 3] = color.r;
        skyColors[index * 3 + 1] = color.g;
        skyColors[index * 3 + 2] = color.b;
      }
      skyGeometry.setAttribute("color", new THREE.BufferAttribute(skyColors, 3));
      this.skyDome = new THREE.Mesh(
        skyGeometry,
        new THREE.MeshBasicMaterial({
          vertexColors: !this.photorealAssets.scenicPanorama,
          map: this.photorealAssets.scenicPanorama || null,
          color: this.photorealAssets.scenicPanorama ? 0xffffff : 0xffffff,
          side: THREE.BackSide,
          fog: false,
          depthWrite: false,
          transparent: false,
          opacity: 1
        })
      );
      this.skyDome.name = this.photorealAssets.scenicPanorama ? "AstralScenicPanoramaDome" : "AstralProceduralSkyDome";
      this.scene.add(this.skyDome);

      this.sunDisc = new THREE.Mesh(
        new THREE.SphereGeometry(5.2, 28, 20),
        new THREE.MeshBasicMaterial({ color: 0xffdf8b, fog: false })
      );
      this.scene.add(this.sunDisc);
      this.sunCorona = new THREE.Mesh(
        new THREE.SphereGeometry(8.8, 24, 16),
        new THREE.MeshBasicMaterial({
          color: 0xffc766,
          transparent: true,
          opacity: 0.16,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false
        })
      );
      this.scene.add(this.sunCorona);
      this.moonDisc = new THREE.Mesh(
        new THREE.SphereGeometry(3.2, 24, 16),
        new THREE.MeshBasicMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.8, fog: false })
      );
      this.scene.add(this.moonDisc);

      const cloudMaterial = new THREE.MeshStandardMaterial({
        color: 0xe8f1ff,
        emissive: 0x8294b8,
        emissiveIntensity: 0.04,
        roughness: 1,
        transparent: true,
        opacity: 0.095,
        depthWrite: false
      });
      const cloudCount = this.state.settings.reduceEffects ? 7 : 16;
      for (let index = 0; index < cloudCount; index += 1) {
        const cloud = new THREE.Group();
        const puffs = 3 + (index % 3);
        for (let part = 0; part < puffs; part += 1) {
          const puff = new THREE.Mesh(
            new THREE.SphereGeometry(1.55 + (part % 2) * 0.72, 14, 9),
            cloudMaterial
          );
          puff.position.set(part * 1.8 - puffs * 0.72, Math.sin(part) * 0.42, Math.cos(part) * 0.66);
          puff.scale.y = 0.36;
          puff.userData.cloudPhase = index * 0.73 + part * 1.31;
          puff.userData.cloudBaseScale = puff.scale.clone();
          cloud.add(puff);
        }
        const angle = (index / cloudCount) * Math.PI * 2;
        const radius = 55 + (index % 4) * 18;
        cloud.position.set(Math.cos(angle) * radius, 30 + (index % 5) * 4.8, Math.sin(angle) * radius);
        cloud.userData = { atmosphere: "cloud", drift: 0.25 + (index % 4) * 0.08 };
        this.scene.add(cloud);
        this.cloudLayers.push(cloud);
      }

      this.auroraVeil = new THREE.Mesh(
        new THREE.TorusGeometry(76, 1.2, 8, 128),
        new THREE.MeshBasicMaterial({
          color: 0x63f6d2,
          transparent: true,
          opacity: 0.08,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false
        })
      );
      this.auroraVeil.rotation.x = Math.PI / 2.8;
      this.auroraVeil.position.set(-35, 48, 18);
      this.scene.add(this.auroraVeil);
    }

    createWater() {
      const THREE = this.THREE;
      const quality = this.state.settings.quality;
      const waveTexture = this.terrainSurfaceTextures?.height?.clone?.() || null;
      if (waveTexture) {
        waveTexture.wrapS = THREE.RepeatWrapping;
        waveTexture.wrapT = THREE.RepeatWrapping;
        waveTexture.repeat.set(7, 11);
        waveTexture.colorSpace = THREE.NoColorSpace;
        waveTexture.needsUpdate = true;
      }
      const waterMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x245b64,
        emissive: 0x061316,
        emissiveIntensity: 0.018,
        roughness: 0.11,
        metalness: 0,
        transparent: true,
        opacity: quality === "low" ? 0.76 : 0.66,
        clearcoat: 1,
        clearcoatRoughness: 0.075,
        envMapIntensity: this.photorealAssets.hdrEnvironment || this.photorealAssets.panorama ? 1.15 : 0.48,
        bumpMap: waveTexture,
        bumpScale: 0.055,
        side: THREE.DoubleSide
      });
      if (quality === "high" || quality === "cinematic") {
        waterMaterial.transmission = quality === "cinematic" ? 0.2 : 0.11;
        waterMaterial.thickness = 0.7;
        waterMaterial.attenuationColor = new THREE.Color(0x1f6a72);
        waterMaterial.attenuationDistance = 8;
      }
      waterMaterial.ior = 1.333;
      const auroraLake = new THREE.Mesh(new THREE.CircleGeometry(13.5, 72), waterMaterial);
      auroraLake.rotation.x = -Math.PI / 2;
      auroraLake.position.set(-51, 1.12, 20);
      auroraLake.receiveShadow = true;
      auroraLake.userData = { water: true, baseY: 1.12, zoneId: "aurora" };
      this.world.add(auroraLake);
      this.waterSurfaces.push(auroraLake);

      const forgeLava = new THREE.Mesh(
        new THREE.CircleGeometry(8.2, 64),
        new THREE.MeshPhysicalMaterial({
          color: 0xff5b2e,
          emissive: 0xff321a,
          emissiveIntensity: 1.35,
          roughness: 0.3,
          metalness: 0.02,
          clearcoat: 0.5,
          clearcoatRoughness: 0.24,
          transparent: true,
          opacity: 0.86
        })
      );
      forgeLava.rotation.x = -Math.PI / 2;
      forgeLava.position.set(52, 1.13, 24);
      forgeLava.userData = { water: true, baseY: 1.13, zoneId: "crimson", lava: true };
      this.world.add(forgeLava);
      this.waterSurfaces.push(forgeLava);
    }

    createInstancedNature() {
      const THREE = this.THREE;
      const quality = this.state.settings.quality;
      const density = quality === "low" ? 0.35 : quality === "medium" ? 0.62 : quality === "cinematic" ? 1.25 : 1;
      const seeded = (index, salt = 0) => {
        const value = Math.sin(index * 91.733 + salt * 17.17) * 43758.5453;
        return value - Math.floor(value);
      };
      const makeGroup = (zoneId) => {
        const group = new THREE.Group();
        group.name = `Stream:${zoneId}`;
        group.userData.zoneId = zoneId;
        this.world.add(group);
        this.streamingGroups.set(zoneId, group);
        return group;
      };

      const auroraGroup = makeGroup("aurora");
      const grassCount = Math.max(40, Math.round(240 * density));
      const grass = new THREE.InstancedMesh(
        new THREE.ConeGeometry(0.075, 0.82, 3),
        new THREE.MeshStandardMaterial({ color: 0x3c8a62, roughness: 0.96, metalness: 0, envMapIntensity: 0.18 }),
        grassCount
      );
      const matrix = new THREE.Matrix4();
      for (let index = 0; index < grassCount; index += 1) {
        const angle = seeded(index, 1) * Math.PI * 2;
        const radius = 14 + seeded(index, 2) * 15;
        const scale = 0.7 + seeded(index, 3) * 1.1;
        matrix.compose(
          new THREE.Vector3(-51 + Math.cos(angle) * radius, 1.42, 20 + Math.sin(angle) * radius),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), seeded(index, 4) * Math.PI),
          new THREE.Vector3(scale, scale, scale)
        );
        grass.setMatrixAt(index, matrix);
      }
      grass.instanceMatrix.needsUpdate = true;
      grass.castShadow = quality === "cinematic";
      grass.userData.dynamicFoliage = true;
      grass.userData.windPhase = 0.4;
      grass.userData.windStrength = 0.018;
      grass.userData.baseRotation = grass.rotation.clone();
      this.dynamicFoliage.push(grass);
      auroraGroup.add(grass);

      const rockProfiles = [
        ["central", 0, 0, 16, 0xb4b7b4],
        ["aurora", -51, 20, 30, 0x9aa99f],
        ["crimson", 52, 24, 30, 0xa18478],
        ["void", 2, -62, 32, 0x8f879b]
      ];
      rockProfiles.forEach(([zoneId, centerX, centerZ, baseCount, color], profileIndex) => {
        const group = this.streamingGroups.get(zoneId) || makeGroup(zoneId);
        const count = Math.max(14, Math.round(baseCount * density));
        const rocks = new THREE.InstancedMesh(
          new THREE.IcosahedronGeometry(0.72, 2),
          new THREE.MeshStandardMaterial({
            color,
            map: this.terrainSurfaceTextures?.albedo || this.terrainTexture,
            bumpMap: this.terrainSurfaceTextures?.height || null,
            bumpScale: 0.12,
            roughnessMap: this.terrainSurfaceTextures?.roughness || null,
            roughness: 0.94,
            metalness: zoneId === "crimson" ? 0.12 : 0.02,
            envMapIntensity: this.photorealAssets.hdrEnvironment || this.photorealAssets.panorama ? 0.56 : 0.12
          }),
          count
        );
        for (let index = 0; index < count; index += 1) {
          const angle = seeded(index, profileIndex + 7) * Math.PI * 2;
          const minimumRadius = zoneId === "central" ? 16 : 9;
          const radius = minimumRadius + seeded(index, profileIndex + 11) * (28 - minimumRadius);
          const sx = zoneId === "central"
            ? 0.28 + seeded(index, 15) * 0.62
            : 0.38 + seeded(index, 15) * 0.9;
          const sy = sx * (0.62 + seeded(index, 21) * 0.28);
          matrix.compose(
            new THREE.Vector3(centerX + Math.cos(angle) * radius, 1.01 + sy * 0.43, centerZ + Math.sin(angle) * radius),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(seeded(index, 18), seeded(index, 19) * Math.PI, seeded(index, 20))),
            new THREE.Vector3(sx, sy, sx * (0.82 + seeded(index, 22) * 0.28))
          );
          rocks.setMatrixAt(index, matrix);
        }
        rocks.instanceMatrix.needsUpdate = true;
        rocks.castShadow = quality === "high" || quality === "cinematic";
        rocks.receiveShadow = true;
        group.add(rocks);
      });
    }

    createLicensedEnvironmentDecor() {
      if (!this.licensedEnvironmentAssets.size) return;
      const THREE = this.THREE;
      const quality = this.state.settings.quality;
      const amountScale = quality === "low"
        ? 0.32
        : quality === "medium"
          ? 0.48
          : quality === "cinematic"
            ? 0.9
            : quality === "high"
              ? 0.68
              : 0.52;
      const placements = [
        ["boulder", "central", 9, 1.8, 28],
        ["boulder", "crimson", 8, 2.3, 29],
        ["mossRocks", "aurora", 10, 1.45, 27],
        ["mossRocks", "void", 7, 1.65, 28],
        ["shrub", "aurora", 15, 1.75, 29],
        ["shrub", "void", 10, 1.95, 29],
        ["deadTree", "void", 6, 5.8, 27],
        ["deadTree", "crimson", 4, 4.6, 28],
        ["fern", "aurora", 18, 1.1, 29],
        ["fern", "void", 12, 1.25, 28],
        ["grass", "aurora", 22, 0.9, 30],
        ["pineRoots", "aurora", 2, 6.2, 25],
        ["pineRoots", "void", 1, 5.4, 24],
        ["modularFort", "sky", 1, 5.8, 24],
        ["kenneyOak", "aurora", 14, 6.4, 30],
        ["kenneyOak", "central", 8, 5.8, 29],
        ["kenneyPalm", "ocean", 14, 6.8, 29],
        ["kenneyBush", "aurora", 18, 1.45, 30],
        ["kenneyPath", "aurora", 12, 3.2, 24],
        ["kenneyRoad", "central", 10, 5.4, 25],
        ["kenneyHouse", "central", 6, 6.6, 30],
        ["kenneyTower", "station", 5, 11.5, 25],
        ["kenneyBridge", "central", 2, 9.5, 24],
        ["free3dTreeA", "aurora", 12, 5.8, 30],
        ["free3dTreeB", "central", 7, 6.4, 29],
        ["free3dTreeC", "ocean", 10, 5.2, 29],
        ["free3dBush", "aurora", 16, 1.35, 30],
        ["free3dFlower", "aurora", 22, 0.62, 28],
        ["free3dMushroom", "void", 14, 0.42, 27],
        ["free3dStone", "central", 18, 0.58, 30]
      ];
      const seeded = (index, salt) => {
        const value = Math.sin(index * 71.137 + salt * 19.71) * 43758.5453;
        return value - Math.floor(value);
      };
      const instantiate = (source, targetHeight, assetId) => {
        const wrapper = new THREE.Group();
        const object = source.scene.clone(true);
        object.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(object);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const flatAsset = ["kenneyPath", "kenneyRoad", "kenneyBridge", "pineRoots"].includes(assetId);
        const sourceMeasure = flatAsset ? Math.max(size.x, size.z) : size.y;
        const fit = targetHeight / Math.max(0.001, sourceMeasure);
        object.scale.setScalar(fit);
        object.position.set(-center.x * fit, -bounds.min.y * fit, -center.z * fit);
        wrapper.add(object);
        wrapper.userData = {
          licensedAsset: true,
          provider: assetId.startsWith("kenney")
            ? "Kenney CC0"
            : assetId.startsWith("free3d")
              ? "Free3D author-declared CC0"
              : "Poly Haven CC0",
          lodPriority: assetId.startsWith("free3d") ? "environment-far" : "environment-near"
        };
        return wrapper;
      };
      placements.forEach(([assetId, zoneId, requestedCount, targetHeight, maxRadius], profileIndex) => {
        const source = this.licensedEnvironmentAssets.get(assetId);
        const zone = ZONES.find((entry) => entry.id === zoneId);
        if (!source?.scene || !zone) return;
        const parent = this.streamingGroups.get(zoneId) || this.world;
        const heroAsset = CINEMATIC_ENVIRONMENT_ASSET_IDS.has(assetId);
        const count = Math.max(heroAsset ? 1 : 2, Math.round(requestedCount * amountScale));
        for (let index = 0; index < count; index += 1) {
          const object = instantiate(source, targetHeight * (0.78 + seeded(index, profileIndex + 4) * 0.5), assetId);
          const angle = seeded(index, profileIndex + 9) * Math.PI * 2;
          const architecture = ["kenneyHouse", "kenneyTower", "modularFort"].includes(assetId);
          const tallFoliage = ["deadTree", "kenneyOak", "kenneyPalm", "free3dTreeA", "free3dTreeB", "free3dTreeC"].includes(assetId);
          const flatAsset = ["kenneyPath", "kenneyRoad", "kenneyBridge", "pineRoots"].includes(assetId);
          // The gameplay camera trails roughly 11 units behind the actor. Keep
          // tall authored assets beyond that corridor so trunks/canopies cannot
          // sit between the camera and the character at a zone checkpoint.
          const minimumRadius = architecture
            ? Math.max(20, zone.radius * 0.72)
            : tallFoliage
              ? Math.max(22, zone.radius * 0.68)
              : flatAsset
                ? 10
                : 12;
          const radius = minimumRadius + seeded(index, profileIndex + 13) * Math.max(2, maxRadius - minimumRadius);
          object.position.set(zone.x + Math.cos(angle) * radius, 1.05, zone.z + Math.sin(angle) * radius);
          object.rotation.y = seeded(index, profileIndex + 17) * Math.PI * 2;
          object.userData.zoneId = zoneId;
          object.userData.cameraSafeRadius = minimumRadius;
          object.traverse?.((node) => {
            if (!node.isMesh) return;
            node.castShadow = quality === "cinematic" && index < 2;
            node.receiveShadow = true;
          });
          parent.add(object);
          if (["shrub", "deadTree", "fern", "grass", "kenneyOak", "kenneyPalm", "kenneyBush", "free3dTreeA", "free3dTreeB", "free3dTreeC", "free3dBush", "free3dFlower", "free3dMushroom"].includes(assetId)) {
            object.userData.dynamicFoliage = true;
            object.userData.windPhase = seeded(index, profileIndex + 23) * Math.PI * 2;
            object.userData.windStrength = assetId === "deadTree"
              ? 0.012
              : assetId === "grass" || assetId === "free3dFlower"
                ? 0.034
                : assetId === "free3dMushroom"
                  ? 0.008
                  : assetId.startsWith("free3dTree")
                    ? 0.016
                    : 0.022;
            object.userData.baseRotation = object.rotation.clone();
            this.dynamicFoliage.push(object);
          }
        }
      });
    }

    createElementalPuzzles() {
      const puzzles = [
        ["aurora-resonance", "Aurora Resonance", -64, 20, "cryo", "#77d9ff"],
        ["forge-ignition", "Forge Ignition", 57, 35, "plasma", "#ff765d"],
        ["void-lattice", "Void Lattice", -4, -73, "void", "#b17aff"]
      ];
      puzzles.forEach(([id, name, x, z, requiredElement, color]) => {
        const THREE = this.THREE;
        const group = new THREE.Group();
        const solved = Boolean(this.state.puzzles[id]?.solved);
        for (let index = 0; index < 3; index += 1) {
          const angle = (index / 3) * Math.PI * 2;
          const pylon = new THREE.Mesh(
            new THREE.CylinderGeometry(0.32, 0.52, 2.8, 6),
            new THREE.MeshToonMaterial({
              color: solved ? color : 0x243047,
              emissive: color,
              emissiveIntensity: solved ? 0.85 : 0.16,
              gradientMap: this.toonGradient
            })
          );
          pylon.position.set(Math.cos(angle) * 1.8, 1.4, Math.sin(angle) * 1.8);
          group.add(pylon);
        }
        const core = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.72, 1),
          new THREE.MeshToonMaterial({
            color,
            emissive: color,
            emissiveIntensity: solved ? 1.4 : 0.36,
            gradientMap: this.toonGradient
          })
        );
        core.position.y = 1.8;
        core.userData.weakPoint = true;
        group.add(core);
        group.position.set(x, 1.08, z);
        group.userData = { type: "puzzle", id, name, requiredElement, color, solved, core };
        this.world.add(group);
        this.puzzleNodes.set(id, group);
      });
    }

    createStarfield() {
      const THREE = this.THREE;
      const count = this.state.settings.reduceEffects ? 420 : 980;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const palette = [new THREE.Color(0x8cecff), new THREE.Color(0xff91da), new THREE.Color(0xc5a1ff), new THREE.Color(0xffde83)];
      for (let index = 0; index < count; index += 1) {
        const radius = 90 + Math.random() * 210;
        const angle = Math.random() * Math.PI * 2;
        const elevation = 18 + Math.random() * 110;
        positions[index * 3] = Math.cos(angle) * radius;
        positions[index * 3 + 1] = elevation;
        positions[index * 3 + 2] = Math.sin(angle) * radius;
        const color = palette[index % palette.length];
        colors[index * 3] = color.r;
        colors[index * 3 + 1] = color.g;
        colors[index * 3 + 2] = color.b;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      this.starfield = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({ size: 0.17, vertexColors: true, transparent: true, opacity: 0.62, sizeAttenuation: true, depthWrite: false })
      );
      this.scene.add(this.starfield);
    }

    createZonePlatforms() {
      const THREE = this.THREE;
      const surfaceColors = {
        central: 0x59616a,
        aurora: 0x405b4c,
        crimson: 0x4a3027,
        void: 0x2d2933,
        sky: 0x68727a,
        ocean: 0x526970,
        station: 0x55575c,
        abyss: 0x29262c
      };
      ZONES.forEach((zone) => {
        const color = new THREE.Color(zone.color);
        const platform = new THREE.Mesh(
          new THREE.CylinderGeometry(zone.radius, zone.radius + 0.38, 0.18, 96, 1),
          new THREE.MeshPhysicalMaterial({
            color: surfaceColors[zone.id] || 0x555b61,
            emissive: color.clone().multiplyScalar(0.12),
            emissiveIntensity: 0.012,
            map: this.terrainTexture,
            bumpMap: this.terrainTexture,
            bumpScale: 0.24,
            roughness: 0.93,
            metalness: zone.id === "station" ? 0.16 : 0.025,
            clearcoat: 0.025,
            envMapIntensity: 0.3
          })
        );
        platform.position.set(zone.x, 0.94, zone.z);
        platform.receiveShadow = true;
        platform.userData.zoneId = zone.id;
        this.world.add(platform);

        const ring = new THREE.Mesh(
          new THREE.RingGeometry(zone.radius - 0.6, zone.radius, 96),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.36, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(zone.x, 1.04, zone.z);
        ring.userData.zoneId = zone.id;
        this.world.add(ring);

        this.addWorldLabel(zone.name, zone.x, 5.8, zone.z, zone.color, 1.15);
      });

      const paths = ZONES
        .filter((zone) => zone.id !== "central")
        .map((zone) => [0, 0, zone.x, zone.z, zone.color]);
      paths.forEach(([x1, z1, x2, z2, color]) => {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const length = Math.hypot(dx, dz);
        const path = new THREE.Mesh(
          new THREE.PlaneGeometry(2.65, length),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(color).lerp(new THREE.Color(0x26303a), 0.82),
            emissive: new THREE.Color(color),
            emissiveIntensity: 0.012,
            transparent: false,
            roughness: 0.92,
            metalness: 0.02
          })
        );
        path.rotation.x = -Math.PI / 2;
        path.rotation.z = Math.atan2(dz, dx) - Math.PI / 2;
        path.position.set((x1 + x2) / 2, 1.035, (z1 + z2) / 2);
        this.world.add(path);
      });
    }

    createCentralCity() {
      const THREE = this.THREE;
      const hasAuthoredCity = this.licensedEnvironmentAssets.has("kenneyTower") && this.licensedEnvironmentAssets.has("kenneyHouse");
      const towerMaterial = new THREE.MeshStandardMaterial({
        color: 0x152b47,
        emissive: 0x23546e,
        emissiveIntensity: 0.2,
        metalness: 0.62,
        roughness: 0.28
      });
      const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xd7e9f2, transparent: true, opacity: 0.22 });

      const coreBase = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 2.2, 0.34, 64), towerMaterial);
      coreBase.position.set(0, 1.19, 0);
      coreBase.castShadow = true;
      coreBase.receiveShadow = true;
      this.world.add(coreBase);

      const core = new THREE.Mesh(
        new THREE.SphereGeometry(1.28, 48, 32),
        new THREE.MeshPhysicalMaterial({
          color: 0xe9d8b4,
          emissive: 0xffd08c,
          emissiveIntensity: 0.42,
          roughness: 0.24,
          metalness: 0.34,
          clearcoat: 0.35,
          clearcoatRoughness: 0.18,
          envMapIntensity: 0.72
        })
      );
      core.position.set(0, 6.9, 0);
      core.userData.floatBase = 6.9;
      this.world.add(core);
      this.centralCore = core;

      const hLabel = this.addWorldLabel("H", 0, 7.25, 0, "#ffffff", 1.35);
      hLabel.userData.followCore = true;

      [10, 14].forEach((radius, index) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.08 + index * 0.03, 8, 96), glowMaterial.clone());
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 1.25 + index * 0.18;
        ring.userData.spin = index ? -0.1 : 0.14;
        this.world.add(ring);
      });

      for (let index = 0; index < (hasAuthoredCity ? 0 : 9); index += 1) {
        const angle = (index / 9) * Math.PI * 2;
        const radius = index % 2 ? 20 : 24;
        const height = 4.5 + (index % 3) * 2.4;
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.7, height, 8), towerMaterial);
        tower.position.set(Math.cos(angle) * radius, 1 + height / 2, Math.sin(angle) * radius);
        tower.castShadow = true;
        this.world.add(tower);
        this.climbables.push({ object: tower, radius: 2.6, top: 1 + height });
        const light = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.22, 8), glowMaterial.clone());
        light.position.set(tower.position.x, tower.position.y + height / 2 + 0.2, tower.position.z);
        this.world.add(light);
      }

      const trainingPad = new THREE.Mesh(
        new THREE.CylinderGeometry(6.2, 6.6, 0.65, 40),
        new THREE.MeshStandardMaterial({ color: 0x27233e, emissive: 0xffc25e, emissiveIntensity: 0.12, metalness: 0.35 })
      );
      trainingPad.position.set(17, 1.35, -10);
      this.world.add(trainingPad);
      this.addWorldLabel("Training Arena", 17, 4.2, -10, "#ffd36b", 0.9);

      const dummy = this.createCharacterMesh({ body: "#ffbd62", accent: "#fff2c5", scale: 0.9, label: "Training Core" });
      dummy.position.set(17, 2.2, -10);
      dummy.userData = { type: "training", id: "training-core", health: 999999, maxHealth: 999999 };
      this.world.add(dummy);
      this.entities.set("training-core", dummy);

      this.createNpc("luma", "Navigator Luma", -6, 3, "#6cf2ff");
      this.createNpc("forge-master", "Cael · Thợ rèn Temporal", 8, 8, "#ffbb72");

      this.createPortal("central", "Cổng H-Central", 0, 18, "#6feeff", { checkpoint: "central" });
    }

    createAuroraVale() {
      const THREE = this.THREE;
      const material = new THREE.MeshPhysicalMaterial({
        color: 0x6aa59b,
        emissive: 0x133f38,
        emissiveIntensity: 0.08,
        roughness: 0.34,
        metalness: 0.04,
        clearcoat: 0.58,
        clearcoatRoughness: 0.2,
        envMapIntensity: 0.86
      });
      for (let index = 0; index < 14; index += 1) {
        const angle = (index / 14) * Math.PI * 2 + (index % 4) * 0.14;
        const radius = 15 + (index * 7) % 17;
        const height = 1.2 + (index % 5) * 0.56;
        const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.38 + (index % 3) * 0.1, height, 7), material);
        crystal.position.set(-51 + Math.cos(angle) * radius, 1.05 + height / 2, 20 + Math.sin(angle) * radius);
        crystal.rotation.y = angle;
        this.world.add(crystal);
      }
      [
        ["aurora-node-1", -42, 13],
        ["aurora-node-2", -58, 26],
        ["aurora-node-3", -49, 34],
        ["aurora-node-4", -67, 13]
      ].forEach(([id, x, z]) => this.createCollectible(id, "aurora-shard", x, z, "#8dfff1"));
      this.createPortal("aurora", "Cổng Aurora", -38, 21, "#6ff5cd", { checkpoint: "aurora" });
    }

    createCrimsonForge() {
      const THREE = this.THREE;
      const metal = new THREE.MeshStandardMaterial({ color: 0x48231f, emissive: 0xff4b2f, emissiveIntensity: 0.11, metalness: 0.6, roughness: 0.38 });
      const lava = new THREE.MeshBasicMaterial({ color: 0xff5a32, transparent: true, opacity: 0.82 });
      for (let index = 0; index < 18; index += 1) {
        const angle = (index / 18) * Math.PI * 2;
        const radius = 10 + (index % 4) * 5;
        const column = new THREE.Mesh(new THREE.BoxGeometry(2 + (index % 2), 3 + (index % 5) * 1.1, 2), metal);
        column.position.set(52 + Math.cos(angle) * radius, 2.5 + (index % 5) * 0.55, 24 + Math.sin(angle) * radius);
        column.rotation.y = angle;
        column.castShadow = true;
        this.world.add(column);
      }
      for (let index = 0; index < 8; index += 1) {
        const stream = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 10), lava.clone());
        stream.rotation.x = -Math.PI / 2;
        stream.rotation.z = (index / 8) * Math.PI * 2;
        stream.position.set(52 + Math.cos(stream.rotation.z) * 16, 1.11, 24 + Math.sin(stream.rotation.z) * 16);
        this.world.add(stream);
      }
      this.createPortal("crimson", "Cổng Crimson", 39, 24, "#ff8365", { checkpoint: "crimson" });
    }

    createVoidGarden() {
      const THREE = this.THREE;
      const trunk = new THREE.MeshStandardMaterial({ color: 0x24143e, emissive: 0x7a39cc, emissiveIntensity: 0.12, roughness: 0.7 });
      const crown = new THREE.MeshStandardMaterial({ color: 0x25212d, emissive: 0x68417d, emissiveIntensity: 0.045, roughness: 0.92, transparent: false });
      const hasAuthoredVoidFoliage = this.licensedEnvironmentAssets.has("deadTree") && this.licensedEnvironmentAssets.has("shrub");
      const treeCount = hasAuthoredVoidFoliage ? 8 : 22;
      for (let index = 0; index < treeCount; index += 1) {
        const angle = (index / treeCount) * Math.PI * 2 + (index % 5) * 0.16;
        const radius = 9 + (index * 9) % 26;
        const height = 3 + (index % 4) * 1.1;
        const tree = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.42, height, 14), trunk);
        stem.position.y = height / 2;
        const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.82 + (index % 3) * 0.16, 2), crown);
        leaves.position.y = height + 0.6;
        tree.add(stem, leaves);
        tree.position.set(2 + Math.cos(angle) * radius, 1.05, -62 + Math.sin(angle) * radius);
        tree.userData.dynamicFoliage = true;
        tree.userData.windPhase = index * 0.67;
        tree.userData.windStrength = 0.02 + (index % 4) * 0.004;
        tree.userData.baseRotation = tree.rotation.clone();
        this.dynamicFoliage.push(tree);
        this.world.add(tree);
        this.climbables.push({ object: tree, radius: 0.9, top: 1.05 + height + 1.2 });
      }
      this.createPortal("void", "Cổng Void", 2, -45, "#ac7aff", { checkpoint: "void" });
      this.createPortal("dungeon-entry", "Bí cảnh Hư Không", -12, -69, "#ff67ca", { dungeon: "nexus-depths" });
    }

    createFrontierRegions() {
      const THREE = this.THREE;
      const frontier = [
        { id: "sky", geometry: () => new THREE.DodecahedronGeometry(1.25, 0), item: "aurora-shard" },
        { id: "ocean", geometry: () => new THREE.IcosahedronGeometry(1.05, 1), item: "aurora-shard" },
        { id: "station", geometry: () => new THREE.BoxGeometry(1.8, 3.4, 1.8), item: "plasma-core" },
        { id: "abyss", geometry: () => new THREE.OctahedronGeometry(1.35, 0), item: "void-fiber" }
      ];
      frontier.forEach((profile, profileIndex) => {
        const zone = ZONES.find((entry) => entry.id === profile.id);
        if (!zone) return;
        const group = new THREE.Group();
        group.name = `Stream:${zone.id}`;
        group.userData.zoneId = zone.id;
        this.world.add(group);
        this.streamingGroups.set(zone.id, group);

        const color = new THREE.Color(zone.color);
        const material = new THREE.MeshStandardMaterial({
          color: color.clone().multiplyScalar(0.34),
          emissive: color,
          emissiveIntensity: zone.id === "abyss" ? 0.34 : 0.18,
          metalness: zone.id === "station" ? 0.72 : 0.18,
          roughness: zone.id === "ocean" ? 0.22 : 0.62,
          transparent: zone.id === "ocean",
          opacity: zone.id === "ocean" ? 0.82 : 1
        });
        const count = this.state.settings.quality === "low" ? 8 : 16;
        for (let index = 0; index < count; index += 1) {
          const angle = (index / count) * Math.PI * 2 + profileIndex * 0.22;
          const radius = 7 + (index * 7) % Math.max(9, zone.radius - 6);
          const object = new THREE.Mesh(profile.geometry(), material.clone());
          const height = zone.id === "sky"
            ? 2.4 + (index % 5) * 1.25
            : zone.id === "station"
              ? 2.7
              : 1.25 + (index % 3) * 0.35;
          object.position.set(zone.x + Math.cos(angle) * radius, height, zone.z + Math.sin(angle) * radius);
          object.rotation.set(index * 0.17, angle, index * 0.11);
          const scale = 0.72 + (index % 4) * 0.18;
          object.scale.set(scale, zone.id === "station" ? 1 + (index % 3) * 0.45 : scale, scale);
          object.castShadow = index < 6;
          object.receiveShadow = true;
          object.userData.zoneId = zone.id;
          if (zone.id === "sky" || zone.id === "abyss") object.userData.spin = (index % 2 ? -1 : 1) * 0.04;
          group.add(object);
        }

        if (zone.id === "ocean") {
          const ocean = new THREE.Mesh(
            new THREE.CircleGeometry(zone.radius - 3, 72),
            new THREE.MeshPhysicalMaterial({
              color: 0x0a6a91,
              emissive: color,
              emissiveIntensity: 0.22,
              roughness: 0.12,
              metalness: 0.08,
              clearcoat: 0.88,
              transparent: true,
              opacity: 0.76
            })
          );
          ocean.rotation.x = -Math.PI / 2;
          ocean.position.set(zone.x, 1.13, zone.z);
          ocean.userData = { water: true, baseY: 1.13, zoneId: zone.id };
          group.add(ocean);
          this.waterSurfaces.push(ocean);
        } else if (zone.id === "station") {
          const stationRing = new THREE.Mesh(
            new THREE.TorusGeometry(11, 0.75, 12, 96),
            new THREE.MeshStandardMaterial({ color: 0x36435b, emissive: color, emissiveIntensity: 0.42, metalness: 0.82, roughness: 0.22 })
          );
          stationRing.position.set(zone.x, 5.4, zone.z);
          stationRing.rotation.x = Math.PI / 2.4;
          stationRing.userData = { spin: 0.08, zoneId: zone.id };
          group.add(stationRing);
        } else if (zone.id === "abyss") {
          const abyssCore = new THREE.Mesh(
            new THREE.SphereGeometry(4.2, 28, 20),
            new THREE.MeshPhysicalMaterial({
              color: 0x05010c,
              emissive: color,
              emissiveIntensity: 0.62,
              roughness: 0.08,
              metalness: 0.7,
              clearcoat: 1
            })
          );
          abyssCore.position.set(zone.x, 5.5, zone.z);
          abyssCore.userData = { spin: -0.12, zoneId: zone.id };
          group.add(abyssCore);
        }

        const nodeAngle = profileIndex * 1.7 + 0.5;
        this.createCollectible(
          `${zone.id}-node-1`,
          profile.item,
          zone.x + Math.cos(nodeAngle) * 9,
          zone.z + Math.sin(nodeAngle) * 9,
          zone.color
        );
        this.createPortal(zone.id, `Cổng ${zone.name}`, zone.x, zone.z + Math.min(18, zone.radius * 0.58), zone.color, { checkpoint: zone.id });
      });
    }

    createDungeon() {
      const THREE = this.THREE;
      const arena = new THREE.Mesh(
        new THREE.CylinderGeometry(13, 15, 1.2, 56),
        new THREE.MeshStandardMaterial({ color: 0x170b2e, emissive: 0x6a2ca8, emissiveIntensity: 0.15, metalness: 0.34 })
      );
      arena.position.set(76, 0.5, -66);
      this.world.add(arena);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(10, 0.18, 10, 80),
        new THREE.MeshBasicMaterial({ color: 0xff66ca, transparent: true, opacity: 0.7 })
      );
      ring.position.set(76, 1.15, -66);
      ring.rotation.x = Math.PI / 2;
      ring.userData.spin = 0.2;
      this.world.add(ring);
      this.addWorldLabel("Nexus Depths · Dungeon", 76, 5.2, -66, "#ff78d3", 0.92);
      this.createPortal("dungeon-exit", "Trở về Void Garden", 76, -55, "#72eaff", { dungeonExit: true });
    }

    createWeatherField() {
      const THREE = this.THREE;
      const qualityMultiplier = this.state.settings.quality === "low" ? 0.45 : this.state.settings.quality === "medium" ? 0.72 : this.state.settings.quality === "cinematic" ? 1.45 : 1;
      const count = Math.max(24, Math.round((this.state.settings.reduceEffects ? 60 : 180) * qualityMultiplier * clamp(this.state.settings.weatherDensity, 0, 100) / 80));
      const positions = new Float32Array(count * 3);
      for (let index = 0; index < count; index += 1) {
        positions[index * 3] = (Math.random() - 0.5) * 55;
        positions[index * 3 + 1] = 2 + Math.random() * 20;
        positions[index * 3 + 2] = (Math.random() - 0.5) * 55;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({ size: 0.085, color: 0xbfd9e8, transparent: true, opacity: 0.32, depthWrite: false });
      material.onBeforeCompile = (shader) => {
        shader.uniforms.hhWeatherTime = { value: 0 };
        shader.uniforms.hhWeatherWind = { value: 0.4 };
        shader.uniforms.hhWeatherFall = { value: 3.2 };
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nuniform float hhWeatherTime;\nuniform float hhWeatherWind;\nuniform float hhWeatherFall;")
          .replace("#include <begin_vertex>", `#include <begin_vertex>
            transformed.y = 1.0 + mod((position.y - 1.0) - hhWeatherTime * hhWeatherFall, 27.0);
            transformed.x += sin(hhWeatherTime * 0.72 + position.z * 0.31) * hhWeatherWind;
            transformed.z += cos(hhWeatherTime * 0.54 + position.x * 0.27) * hhWeatherWind * 0.42;`);
        material.userData.gpuShader = shader;
      };
      material.customProgramCacheKey = () => "hh-weather-gpu-v1";
      this.weatherField = new THREE.Points(geometry, material);
      this.weatherField.userData.gpuDriven = true;
      this.scene.add(this.weatherField);
    }

    createLivingWorldEffects() {
      if (!this.state.settings.livingWorld) return;
      const THREE = this.THREE;
      const qualityScale = this.state.settings.quality === "low"
        ? 0.42
        : this.state.settings.quality === "medium"
          ? 0.7
          : this.state.settings.quality === "cinematic"
            ? 1.35
            : 1;
      const reduced = this.state.settings.reduceEffects || this.state.settings.vfxLevel === "static";

      ZONES.forEach((zone, zoneIndex) => {
        const profile = BIOME_PROFILES[zone.id] || BIOME_PROFILES.central;
        const group = new THREE.Group();
        group.name = `LivingBiome:${zone.id}`;
        group.position.set(zone.x, 0, zone.z);
        group.userData.zoneId = zone.id;
        this.world.add(group);
        this.zoneFxGroups.set(zone.id, group);

        const particleCount = Math.max(10, Math.round((reduced ? 18 : 42) * qualityScale));
        const positions = new Float32Array(particleCount * 3);
        for (let index = 0; index < particleCount; index += 1) {
          const angle = ((index * 137.5 + zoneIndex * 29) * Math.PI) / 180;
          const radius = 4 + ((index * 17 + zoneIndex * 11) % Math.max(8, Math.round(zone.radius - 4)));
          positions[index * 3] = Math.cos(angle) * radius;
          positions[index * 3 + 1] = 1.4 + ((index * 13) % 18) * 0.72;
          positions[index * 3 + 2] = Math.sin(angle) * radius;
        }
        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const particleField = new THREE.Points(
          particleGeometry,
          new THREE.PointsMaterial({
            color: profile.particle,
            size: zone.id === "crimson" || zone.id === "abyss" ? 0.34 : 0.22,
            transparent: true,
            opacity: reduced ? 0.2 : 0.48,
            depthWrite: false,
            blending: THREE.AdditiveBlending
          })
        );
        particleField.userData = { livingParticles: true, baseOpacity: reduced ? 0.2 : 0.48, wind: profile.wind };
        group.add(particleField);

        const actorCount = reduced ? 1 : (this.state.settings.quality === "cinematic" ? 4 : 2);
        for (let index = 0; index < actorCount; index += 1) {
          const material = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(profile.accent).multiplyScalar(0.52),
            emissive: new THREE.Color(profile.accent),
            emissiveIntensity: 0.38,
            roughness: profile.actor === "traffic" || profile.actor === "shuttles" ? 0.22 : 0.52,
            metalness: profile.actor === "traffic" || profile.actor === "shuttles" || profile.actor === "forge-drones" ? 0.68 : 0.18,
            clearcoat: 0.42
          });
          const geometry = profile.actor === "traffic" || profile.actor === "shuttles"
            ? new THREE.BoxGeometry(1.25, 0.34, 0.58)
            : profile.actor === "fractures"
              ? new THREE.TetrahedronGeometry(0.78, 0)
              : profile.actor === "forge-drones"
                ? new THREE.DodecahedronGeometry(0.58, 0)
                : profile.actor === "wisps"
                  // Aurora wisps used to be large five-sided cones. In front of
                  // the player those read as untextured pyramids and could cover
                  // the character. A smooth, small luminous volume keeps the
                  // living-world motion without exposing primitive silhouettes.
                  ? new THREE.SphereGeometry(0.38, 24, 16)
                  : new THREE.CapsuleGeometry(0.26, 0.72, 8, 16);
          const actor = new THREE.Mesh(geometry, material);
          actor.scale.set(
            profile.actor === "void-mantas" || profile.actor === "sky-rays" ? 1.8 : 1,
            profile.actor === "lumen-fish" ? 0.58 : profile.actor === "wisps" ? 0.72 : 1,
            profile.actor === "void-mantas" || profile.actor === "sky-rays" ? 0.34 : 1
          );
          const radius = profile.actor === "wisps" ? 14 + index * 4.8 : 6 + index * 4.2;
          const angle = zoneIndex * 0.71 + index * Math.PI;
          actor.position.set(Math.cos(angle) * radius, 3.4 + index * 1.35, Math.sin(angle) * radius);
          actor.castShadow = this.state.settings.quality === "cinematic" && index === 0;
          actor.userData.livingActor = true;
          group.add(actor);
          this.livingWorldActors.push({
            mesh: actor,
            zoneId: zone.id,
            radius,
            angle,
            speed: (0.08 + index * 0.025) * (index % 2 ? -1 : 1),
            baseY: actor.position.y,
            vertical: profile.actor === "fractures" ? 1.1 : 0.38
          });
        }

        if (zone.id === "central") {
          for (let index = 0; index < 5; index += 1) {
            const panel = new THREE.Mesh(
              new THREE.PlaneGeometry(2.6, 1.05),
              new THREE.MeshBasicMaterial({
                color: index % 2 ? 0xff69cc : 0x6feeff,
                transparent: true,
                opacity: 0.24,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending
              })
            );
            const angle = (index / 5) * Math.PI * 2;
            panel.position.set(Math.cos(angle) * 17, 4.5 + (index % 2) * 2.2, Math.sin(angle) * 17);
            panel.lookAt(0, panel.position.y, 0);
            panel.userData.hologram = true;
            group.add(panel);
          }
        } else if (zone.id === "aurora") {
          for (let index = 0; index < 3; index += 1) {
            const ribbon = new THREE.Mesh(
              new THREE.TorusGeometry(8 + index * 3.2, 0.12 + index * 0.03, 6, 72),
              new THREE.MeshBasicMaterial({ color: index % 2 ? 0x7ee7ff : 0x71ffc7, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })
            );
            ribbon.rotation.set(Math.PI / 2.5, index * 0.42, index * 0.6);
            ribbon.position.y = 12 + index * 3.2;
            ribbon.userData.spin = (index % 2 ? -1 : 1) * 0.045;
            group.add(ribbon);
          }
        } else if (zone.id === "crimson") {
          for (let index = 0; index < 4; index += 1) {
            const heat = new THREE.Mesh(
              new THREE.CylinderGeometry(0.9 + index * 0.28, 1.5 + index * 0.35, 7 + index, 18, 1, true),
              new THREE.MeshBasicMaterial({ color: 0xff5d32, transparent: true, opacity: 0.055, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
            );
            heat.position.set(Math.cos(index * 1.7) * 11, 4.2, Math.sin(index * 1.7) * 11);
            heat.userData.heatColumn = true;
            group.add(heat);
          }
        } else if (zone.id === "sky") {
          for (let index = 0; index < 3; index += 1) {
            const fall = new THREE.Mesh(
              new THREE.CylinderGeometry(0.18, 0.5, 13 + index * 3, 10, 1, true),
              new THREE.MeshBasicMaterial({ color: 0xa9edff, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false })
            );
            fall.position.set(-8 + index * 8, -1.5, 3 + index * 2);
            group.add(fall);
          }
        } else if (zone.id === "station" || zone.id === "abyss") {
          for (let index = 0; index < 3; index += 1) {
            const orbit = new THREE.Mesh(
              new THREE.TorusGeometry(7 + index * 3.4, 0.09 + index * 0.025, 8, 80),
              new THREE.MeshBasicMaterial({ color: profile.particle, transparent: true, opacity: 0.22, depthWrite: false })
            );
            orbit.rotation.set(Math.PI / (2.3 + index * 0.25), index * 0.4, index * 0.7);
            orbit.position.y = 5.2;
            orbit.userData.spin = (index % 2 ? -1 : 1) * (zone.id === "abyss" ? 0.2 : 0.08);
            group.add(orbit);
          }
        }
      });
    }

    createDynamicNatureSystem() {
      if (!this.state.settings.livingWorld) return;
      const THREE = this.THREE;
      this.dynamicNatureScratch = {
        matrix: new THREE.Matrix4(),
        position: new THREE.Vector3(),
        quaternion: new THREE.Quaternion(),
        scale: new THREE.Vector3(),
        euler: new THREE.Euler()
      };
      const countPerZone = this.state.settings.reduceEffects
        ? 5
        : this.state.settings.quality === "cinematic"
          ? 18
          : this.state.settings.quality === "high"
            ? 12
            : 8;
      const geometry = new THREE.IcosahedronGeometry(0.28, 0);
      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      ZONES.forEach((zone, zoneIndex) => {
        const group = this.zoneFxGroups.get(zone.id);
        if (!group) return;
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(zone.color).multiplyScalar(zone.id === "aurora" ? 0.42 : 0.28),
          roughness: 0.9,
          metalness: ["crimson", "station"].includes(zone.id) ? 0.28 : 0.04,
          envMapIntensity: this.photorealAssets.hdrEnvironment || this.photorealAssets.panorama ? 0.48 : 0.12
        });
        const mesh = new THREE.InstancedMesh(geometry, material, countPerZone);
        mesh.name = `DynamicPebbles:${zone.id}`;
        mesh.castShadow = ["high", "cinematic"].includes(this.state.settings.quality);
        mesh.receiveShadow = true;
        const bases = [];
        for (let index = 0; index < countPerZone; index += 1) {
          const seed = Math.abs(Math.sin((zoneIndex + 1) * 71.17 + (index + 1) * 19.91));
          const angle = (index / countPerZone) * Math.PI * 2 + seed * 1.7;
          const radius = 7 + ((index * 7 + zoneIndex * 5) % Math.max(9, Math.round(zone.radius - 5)));
          const size = 0.18 + seed * 0.52;
          const base = {
            x: Math.cos(angle) * radius,
            y: 1.11 + size * 0.08,
            z: Math.sin(angle) * radius,
            size,
            phase: zoneIndex * 0.91 + index * 0.73,
            lift: ["sky", "void", "abyss"].includes(zone.id) ? 0.18 + seed * 0.32 : 0.012
          };
          bases.push(base);
          quaternion.setFromEuler(new THREE.Euler(seed * 0.7, angle, seed * 0.4));
          scale.setScalar(size);
          matrix.compose(new THREE.Vector3(base.x, base.y, base.z), quaternion, scale);
          mesh.setMatrixAt(index, matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        group.add(mesh);
        this.dynamicPebbleFields.push({ mesh, bases, zoneId: zone.id });
      });
    }

    createFootprintPool() {
      if (this.state.settings.reduceEffects || this.state.settings.vfxLevel === "static") return;
      const THREE = this.THREE;
      const count = this.state.settings.quality === "cinematic" ? 32 : 18;
      for (let index = 0; index < count; index += 1) {
        const footprint = new THREE.Mesh(
          new THREE.PlaneGeometry(0.2, 0.48),
          new THREE.MeshBasicMaterial({ color: 0x9fefff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
        );
        footprint.rotation.x = -Math.PI / 2;
        footprint.visible = false;
        footprint.renderOrder = 2;
        footprint.userData = { life: 0, maxLife: 3.6 };
        this.world.add(footprint);
        this.footprints.push(footprint);
      }
    }

    emitFootprint(time) {
      if (!this.footprints.length || time - this.lastFootprintAt < 145) return;
      const player = this.state.player;
      const distance = Math.hypot(player.x - this.lastFootprintPosition.x, player.z - this.lastFootprintPosition.z);
      if (Number.isFinite(distance) && distance < 0.48) return;
      const footprint = this.footprints[this.footprintCursor % this.footprints.length];
      this.footprintCursor += 1;
      const side = this.footprintCursor % 2 ? -0.14 : 0.14;
      const cos = Math.cos(player.rotation);
      const sin = Math.sin(player.rotation);
      footprint.position.set(player.x + cos * side, 1.095, player.z - sin * side);
      footprint.rotation.z = -player.rotation;
      footprint.material.color.set(BIOME_PROFILES[this.currentZone.id]?.particle || 0x9fefff);
      footprint.material.opacity = 0.38;
      footprint.userData.life = footprint.userData.maxLife;
      footprint.visible = true;
      this.lastFootprintAt = time;
      this.lastFootprintPosition = { x: player.x, z: player.z };
    }

    applyBiomeVisualState(zone = this.currentZone) {
      const profile = BIOME_PROFILES[zone?.id] || BIOME_PROFILES.central;
      this.root.dataset.biome = zone?.id || "central";
      this.root.dataset.precipitation = profile.precipitation;
      this.root.style.setProperty("--har-biome-accent", profile.accent);
      this.root.style.setProperty("--har-biome-wind", String(profile.wind));
      if (this.scene?.fog) {
        this.scene.fog.color.set(profile.fog);
        this.scene.fog.density = profile.fogDensity;
      }
    }

    updateLivingWorld(dt, time) {
      this.livingWorldActors.forEach((actor) => {
        if (actor.mesh?.parent?.visible === false) return;
        actor.angle += dt * actor.speed;
        actor.mesh.position.x = Math.cos(actor.angle) * actor.radius;
        actor.mesh.position.z = Math.sin(actor.angle) * actor.radius;
        actor.mesh.position.y = actor.baseY + Math.sin(time * 0.0013 + actor.radius) * actor.vertical;
        actor.mesh.rotation.y = -actor.angle + Math.PI / 2;
        actor.mesh.rotation.z += dt * 0.18;
      });
      this.zoneFxGroups.forEach((group) => {
        if (!group.visible) return;
        group.children.forEach((object) => {
          if (object.userData?.livingParticles) {
            object.rotation.y += dt * 0.012 * object.userData.wind;
            object.material.opacity = object.userData.baseOpacity * (0.78 + Math.sin(time * 0.0015 + group.position.x) * 0.22);
          }
          if (object.userData?.hologram) {
            object.material.opacity = 0.17 + Math.sin(time * 0.003 + object.position.x) * 0.08;
          }
          if (object.userData?.heatColumn) {
            object.scale.y = 0.92 + Math.sin(time * 0.004 + object.position.x) * 0.12;
            object.material.opacity = 0.04 + Math.abs(Math.sin(time * 0.002 + object.position.z)) * 0.05;
          }
        });
      });
      const activeWind = BIOME_PROFILES[this.currentZone?.id]?.wind || 0.35;
      const gust = Math.sin(time * 0.0011) * 0.55 + Math.sin(time * 0.0027) * 0.2;
      this.dynamicFoliage.forEach((object, index) => {
        if (!object?.rotation || object.visible === false || object.parent?.visible === false) return;
        const base = object.userData.baseRotation || object.rotation;
        const phase = object.userData.windPhase || index * 0.47;
        const strength = (object.userData.windStrength || 0.018) * activeWind;
        object.rotation.z = base.z + Math.sin(time * 0.0018 + phase) * strength + gust * strength * 0.55;
        object.rotation.x = base.x + Math.cos(time * 0.00125 + phase) * strength * 0.38;
      });
      if (this.dynamicPebbleFields.length) {
        const { matrix, position, quaternion, scale, euler } = this.dynamicNatureScratch;
        this.dynamicPebbleFields.forEach((field) => {
          if (!field.mesh.visible || field.mesh.parent?.visible === false) return;
          const localProfile = BIOME_PROFILES[field.zoneId] || BIOME_PROFILES.central;
          field.bases.forEach((base, index) => {
            const pulse = Math.sin(time * 0.0015 + base.phase);
            const roll = time * 0.00008 * localProfile.wind + base.phase;
            position.set(
              base.x + Math.sin(time * 0.0005 + base.phase) * base.lift * 0.28,
              base.y + Math.max(0, pulse) * base.lift,
              base.z + Math.cos(time * 0.00043 + base.phase) * base.lift * 0.22
            );
            euler.set(pulse * 0.08, roll, Math.cos(time * 0.0012 + base.phase) * 0.06);
            quaternion.setFromEuler(euler);
            scale.setScalar(base.size);
            matrix.compose(position, quaternion, scale);
            field.mesh.setMatrixAt(index, matrix);
          });
          field.mesh.instanceMatrix.needsUpdate = true;
        });
      }
      let npcIndex = 0;
      this.npcs.forEach((npc) => {
        const schedule = npc.userData.schedule;
        if (!schedule) return;
        const angle = time * schedule.speed + schedule.phase;
        const targetX = schedule.homeX + Math.cos(angle) * schedule.radius;
        const targetZ = schedule.homeZ + Math.sin(angle) * schedule.radius;
        npc.position.x += (targetX - npc.position.x) * clamp(dt * 0.7, 0, 1);
        npc.position.z += (targetZ - npc.position.z) * clamp(dt * 0.7, 0, 1);
        npc.rotation.y = Math.atan2(targetX - npc.position.x, targetZ - npc.position.z);
        const runtime = npc.userData.characterRuntime;
        if (runtime?.mixer) {
          this.playCharacterClip(runtime, "walk");
          runtime.mixer.update(dt);
        } else {
          const parts = npc.userData.parts;
          if (!(parts?.leftLeg && parts?.rightLeg && parts?.leftArm && parts?.rightArm)) {
            npcIndex += 1;
            return;
          }
          const stride = Math.sin(time * 0.0065 + npcIndex * 0.9) * 0.24;
          parts.leftLeg.rotation.x += (stride - parts.leftLeg.rotation.x) * clamp(dt * 5, 0, 1);
          parts.rightLeg.rotation.x += (-stride - parts.rightLeg.rotation.x) * clamp(dt * 5, 0, 1);
          parts.leftArm.rotation.x += (-stride * 0.7 - parts.leftArm.rotation.x) * clamp(dt * 5, 0, 1);
          parts.rightArm.rotation.x += (stride * 0.7 - parts.rightArm.rotation.x) * clamp(dt * 5, 0, 1);
        }
        const distance = Math.hypot(this.state.player.x - npc.position.x, this.state.player.z - npc.position.z);
        this.updateCharacterLod(npc, distance);
        npcIndex += 1;
      });
      this.footprints.forEach((footprint) => {
        if (!footprint.visible) return;
        footprint.userData.life -= dt;
        footprint.material.opacity = 0.38 * clamp(footprint.userData.life / footprint.userData.maxLife, 0, 1);
        if (footprint.userData.life <= 0) footprint.visible = false;
      });
    }

    addWorldLabel(text, x, y, z, color = "#ffffff", scale = 1) {
      const THREE = this.THREE;
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 128;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.font = "800 42px Inter, Arial, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.shadowBlur = 18;
      context.shadowColor = color;
      context.fillStyle = color;
      context.fillText(text, canvas.width / 2, canvas.height / 2);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: true }));
      sprite.position.set(x, y, z);
      sprite.scale.set(10 * scale, 2.5 * scale, 1);
      this.world.add(sprite);
      return sprite;
    }

    createPortal(id, name, x, z, color, data = {}) {
      const THREE = this.THREE;
      const group = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.2, 0.17, 12, 64),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(color).multiplyScalar(0.5),
          emissive: new THREE.Color(color),
          emissiveIntensity: 1.2,
          metalness: 0.58,
          roughness: 0.2
        })
      );
      ring.rotation.y = Math.PI / 2;
      ring.userData.spin = 0.45;
      group.add(ring);
      const inner = new THREE.Mesh(
        new THREE.CircleGeometry(1.9, 48),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, side: THREE.DoubleSide })
      );
      inner.rotation.y = Math.PI / 2;
      group.add(inner);
      group.position.set(x, 3.2, z);
      group.userData = { type: "portal", id, name, ...data };
      this.world.add(group);
      this.portals.set(id, group);
      return group;
    }

    createCollectible(id, itemId, x, z, color) {
      const THREE = this.THREE;
      const group = new THREE.Group();
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.72, 0),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(color).multiplyScalar(0.62),
          emissive: new THREE.Color(color),
          emissiveIntensity: 0.85,
          metalness: 0.35,
          roughness: 0.18
        })
      );
      crystal.castShadow = true;
      group.add(crystal);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(1.05, 0.04, 8, 48),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 })
      );
      halo.rotation.x = Math.PI / 2;
      group.add(halo);
      group.position.set(x, 2.35, z);
      group.userData = { type: "collectible", id, itemId, floatBase: 2.35 };
      this.world.add(group);
      this.collectibles.set(id, group);
      return group;
    }

    createNpc(id, name, x, z, color) {
      const npcProfile = id === "luma" ? CHARACTERS.cael : CHARACTERS.sol;
      const mesh = this.createPhotorealCharacterModel(npcProfile, 0.88);
      mesh.position.set(x, 1.08, z);
      mesh.userData = {
        ...mesh.userData,
        type: "npc",
        id,
        name,
        schedule: {
          homeX: x,
          homeZ: z,
          radius: id === "luma" ? 1.35 : 1.8,
          phase: id === "luma" ? 0 : Math.PI,
          speed: id === "luma" ? 0.00011 : 0.000085
        }
      };
      this.world.add(mesh);
      this.npcs.set(id, mesh);
      this.registerCharacterRuntime(mesh, npcProfile, `npc:${id}`, "npc", mesh.userData.builtInAnimations || []);
      return mesh;
    }

    createCharacterMesh({ body = "#6deeff", accent = "#ff65c8", scale = 1 } = {}) {
      const THREE = this.THREE;
      const group = new THREE.Group();
      group.scale.setScalar(scale);
      const bodyMaterial = new THREE.MeshStandardMaterial({ color: body, roughness: 0.42, metalness: 0.18 });
      const accentMaterial = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.3, roughness: 0.28 });
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 1.05, 7, 12), bodyMaterial);
      torso.position.y = 1.38;
      torso.castShadow = true;
      group.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), accentMaterial);
      head.position.y = 2.48;
      head.castShadow = true;
      group.add(head);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.63, 0.045, 8, 32), accentMaterial);
      halo.position.y = 2.78;
      halo.rotation.x = Math.PI / 2;
      group.add(halo);
      const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.64, 5, 8), bodyMaterial);
      const rightLeg = leftLeg.clone();
      leftLeg.position.set(-0.22, 0.42, 0);
      rightLeg.position.set(0.22, 0.42, 0);
      group.add(leftLeg, rightLeg);
      group.userData.parts = { leftLeg, rightLeg, torso, halo };
      return group;
    }

    createCharacterDetailTexture(kind = "skin") {
      if (!this.THREE || !this.state.settings.microDetail) return null;
      this.characterDetailTextures ||= {};
      if (this.characterDetailTextures[kind]) return this.characterDetailTextures[kind];
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const context = canvas.getContext("2d");
      const image = context.createImageData(size, size);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const offset = (y * size + x) * 4;
          const pore = Math.sin(x * 2.73 + y * 1.41) * 0.5 + Math.sin(x * 0.53 - y * 2.17) * 0.5;
          const strand = Math.sin((x + y * 0.32) * 0.62);
          if (kind === "skin-normal") {
            image.data[offset] = 128 + pore * 9;
            image.data[offset + 1] = 128 + pore * 7;
            image.data[offset + 2] = 246;
          } else if (kind === "hair-alpha") {
            const alpha = clamp((strand + 1) * 118 + 18, 0, 255);
            image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = alpha;
            image.data[offset + 3] = 255;
            continue;
          } else {
            const rough = clamp(146 + pore * 24, 92, 205);
            image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = rough;
          }
          image.data[offset + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
      const texture = new this.THREE.CanvasTexture(canvas);
      texture.wrapS = texture.wrapT = this.THREE.RepeatWrapping;
      texture.repeat.set(kind === "hair-alpha" ? 1 : 5, kind === "hair-alpha" ? 1 : 7);
      texture.userData ||= {};
      texture.userData.sharedAsset = true;
      texture.colorSpace = kind === "skin-normal" || kind === "skin-roughness" || kind === "hair-alpha"
        ? this.THREE.NoColorSpace
        : this.THREE.SRGBColorSpace;
      this.characterDetailTextures[kind] = texture;
      return texture;
    }

    createAnimeCharacterMesh(profile, scale = 1) {
      const THREE = this.THREE;
      const group = new THREE.Group();
      group.name = `Character:${profile.id}`;
      group.scale.setScalar(scale);
      const realistic = this.state.settings.renderStyle !== "anime"
        && this.state.settings.visualStyle !== "performance";

      const toon = (color, options = {}) => {
        const material = new THREE.MeshToonMaterial({
          color,
          gradientMap: this.toonGradient,
          emissive: options.emissive || 0x000000,
          emissiveIntensity: options.emissiveIntensity || 0,
          transparent: Boolean(options.transparent),
          opacity: options.opacity ?? 1
        });
        material.userData.astralSurface = true;
        return material;
      };
      const surface = (color, options = {}) => {
        if (!realistic) return toon(color, options);
        const Physical = THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial;
        const parameters = {
          color,
          roughness: options.roughness ?? 0.44,
          metalness: options.metalness ?? 0.08,
          clearcoat: options.clearcoat ?? 0.22,
          clearcoatRoughness: options.clearcoatRoughness ?? 0.32,
          sheen: options.sheen ?? 0.16,
          envMapIntensity: this.photorealAssets.hdrEnvironment || this.photorealAssets.panorama ? 0.82 : 0.18,
          emissive: options.emissive || 0x000000,
          emissiveIntensity: options.emissiveIntensity || 0,
          transparent: Boolean(options.transparent),
          opacity: options.opacity ?? 1
        };
        if (options.side !== undefined) parameters.side = options.side;
        const material = new Physical(parameters);
        material.userData.astralSurface = true;
        return material;
      };
      const skinMaterial = surface(0xffd5c5, { roughness: 0.52, sheen: 0.52, clearcoat: 0.08, clearcoatRoughness: 0.72 });
      const bodyMaterial = surface(profile.body, { emissive: profile.body, emissiveIntensity: 0.06, roughness: 0.36, clearcoat: 0.42 });
      const accentMaterial = surface(profile.accent, { emissive: profile.accent, emissiveIntensity: 0.24, roughness: 0.25, clearcoat: 0.62 });
      const hairMaterial = surface(profile.hair, { emissive: profile.accent, emissiveIntensity: 0.035, roughness: 0.3, clearcoat: 0.48, sheen: 0.52 });
      const darkMaterial = surface(0x16162c, { roughness: 0.5, metalness: 0.22 });
      if (realistic && this.state.settings.microDetail) {
        skinMaterial.normalMap = this.createCharacterDetailTexture("skin-normal");
        skinMaterial.roughnessMap = this.createCharacterDetailTexture("skin-roughness");
        skinMaterial.normalScale?.set?.(0.18, 0.18);
      }
      skinMaterial.userData.materialRole = "skin";
      hairMaterial.userData.materialRole = "hair";
      [skinMaterial, bodyMaterial, accentMaterial, hairMaterial, darkMaterial].forEach((material) => {
        material.userData.baseRoughness = material.roughness;
        material.userData.baseClearcoat = material.clearcoat || 0;
        material.userData.baseEmissiveIntensity = material.emissiveIntensity || 0;
      });
      if ("ior" in skinMaterial) skinMaterial.ior = 1.4;
      if ("specularIntensity" in skinMaterial) skinMaterial.specularIntensity = 0.34;
      if ("anisotropy" in hairMaterial) hairMaterial.anisotropy = realistic ? 0.72 : 0;
      const outlineMaterial = realistic
        ? new THREE.MeshBasicMaterial({ color: 0x100d20, transparent: true, opacity: 0, depthWrite: false })
        : new THREE.MeshBasicMaterial({ color: 0x100d20, side: THREE.BackSide });
      outlineMaterial.userData.astralOutline = true;

      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.43, 0.92, 8, 14), bodyMaterial);
      torso.position.y = 1.45;
      torso.scale.set(0.95, 1, 0.68);
      torso.castShadow = true;
      group.add(torso);
      const torsoOutline = new THREE.Mesh(torso.geometry, outlineMaterial);
      torsoOutline.position.copy(torso.position);
      torsoOutline.scale.copy(torso.scale).multiplyScalar(1.045);
      group.add(torsoOutline);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.43, 24, 18), skinMaterial);
      head.position.y = 2.52;
      head.scale.set(0.92, 1.08, 0.9);
      head.castShadow = true;
      group.add(head);
      const headOutline = new THREE.Mesh(head.geometry, outlineMaterial);
      headOutline.position.copy(head.position);
      headOutline.scale.copy(head.scale).multiplyScalar(1.045);
      group.add(headOutline);

      const faceShadow = new THREE.Mesh(
        new THREE.SphereGeometry(0.405, 20, 14, 0, Math.PI, 0, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0xb86f86, transparent: true, opacity: 0.12, depthWrite: false })
      );
      faceShadow.position.set(0.04, 2.49, -0.07);
      faceShadow.rotation.y = Math.PI;
      faceShadow.scale.set(0.92, 1.05, 0.9);
      group.add(faceShadow);

      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.38, 14), skinMaterial);
      neck.position.set(0, 2.08, 0);
      neck.castShadow = true;
      group.add(neck);

      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 12), skinMaterial);
      nose.position.set(0, 2.43, -0.43);
      nose.rotation.x = -Math.PI / 2;
      nose.scale.set(0.72, 1, 0.78);
      group.add(nose);
      const mouth = new THREE.Mesh(
        new THREE.SphereGeometry(0.105, 14, 8),
        surface(0xb94f68, { roughness: 0.34, clearcoat: 0.2 })
      );
      mouth.position.set(0, 2.29, -0.405);
      mouth.scale.set(1, 0.22, 0.25);
      group.add(mouth);
      const leftEar = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 9), skinMaterial);
      const rightEar = leftEar.clone();
      leftEar.position.set(-0.415, 2.51, 0);
      rightEar.position.set(0.415, 2.51, 0);
      leftEar.scale.set(0.42, 1, 0.55);
      rightEar.scale.copy(leftEar.scale);
      group.add(leftEar, rightEar);

      const eyeMaterial = surface(profile.eyes, {
        roughness: 0.08,
        metalness: 0.14,
        clearcoat: 0.9,
        clearcoatRoughness: 0.08,
        emissive: profile.eyes,
        emissiveIntensity: realistic ? 0.18 : 0.08
      });
      const eyeGlow = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
      const eyes = [];
      [-0.15, 0.15].forEach((x) => {
        const sclera = surface(0xf5f4ef, { roughness: 0.18, clearcoat: 0.82, clearcoatRoughness: 0.08 });
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.069, 16, 12), sclera);
        eye.position.set(x, 2.56, -0.385);
        eye.scale.set(0.72, 1.15, 0.36);
        const iris = new THREE.Mesh(new THREE.CircleGeometry(0.047, 16), eyeMaterial);
        iris.position.set(0, 0, -0.066);
        const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.019, 14), new THREE.MeshBasicMaterial({ color: 0x080914 }));
        pupil.position.set(0, 0, -0.0015);
        pupil.userData.baseScale = 1;
        iris.add(pupil);
        const cornea = new THREE.Mesh(
          new THREE.SphereGeometry(0.071, 16, 12),
          new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.02, transmission: 0.18, depthWrite: false })
        );
        const shine = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), eyeGlow);
        shine.name = "EyeCatchlight";
        shine.position.set(-0.018, 0.023, -0.064);
        eye.add(iris, cornea, shine);
        eye.userData.iris = iris;
        eye.userData.pupil = pupil;
        eye.userData.cornea = cornea;
        eye.userData.baseScale = eye.scale.clone();
        group.add(eye);
        eyes.push(eye);
      });
      const eyelidMaterial = skinMaterial.clone();
      eyelidMaterial.userData = { ...skinMaterial.userData, materialRole: "skin" };
      const eyelids = [];
      [-0.15, 0.15].forEach((x) => {
        const lid = new THREE.Mesh(new THREE.SphereGeometry(0.073, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.48), eyelidMaterial);
        lid.position.set(x, 2.61, -0.401);
        lid.scale.set(0.72, 0.01, 0.36);
        lid.rotation.x = Math.PI;
        lid.userData.baseScaleY = 0.01;
        group.add(lid);
        eyelids.push(lid);
      });
      eyeMaterial.userData.materialRole = "eyes";
      const browMaterial = surface(profile.hair, { roughness: 0.42 });
      browMaterial.userData.materialRole = "hair";
      const leftBrow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.025), browMaterial);
      const rightBrow = leftBrow.clone();
      leftBrow.position.set(-0.15, 2.68, -0.397);
      rightBrow.position.set(0.15, 2.68, -0.397);
      leftBrow.rotation.z = -0.08;
      rightBrow.rotation.z = 0.08;
      group.add(leftBrow, rightBrow);
      const beard = new THREE.Mesh(
        new THREE.SphereGeometry(0.235, 20, 12, 0.18, Math.PI - 0.36, Math.PI * 0.5, Math.PI * 0.42),
        browMaterial
      );
      beard.position.set(0, 2.25, -0.34);
      beard.rotation.y = Math.PI;
      beard.visible = false;
      beard.userData.heroDetail = true;
      group.add(beard);

      const hair = new THREE.Group();
      const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.455, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMaterial);
      hairCap.scale.set(1.02, 1.08, 1.04);
      hair.add(hairCap);
      for (let index = 0; index < (realistic ? 11 : 7); index += 1) {
        const lock = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.82 + (index % 3) * 0.18, realistic ? 8 : 5), hairMaterial);
        const angle = ((index - 3) / 7) * Math.PI * 1.25;
        lock.position.set(Math.sin(angle) * 0.36, -0.22 - (index % 2) * 0.08, Math.cos(angle) * 0.32);
        lock.rotation.z = Math.sin(angle) * 0.18;
        lock.userData.secondaryMotion = 0.035 + (index % 3) * 0.012;
        hair.add(lock);
      }
      if (realistic && this.state.settings.microDetail) {
        const cardMaterial = hairMaterial.clone();
        cardMaterial.alphaMap = this.createCharacterDetailTexture("hair-alpha");
        cardMaterial.transparent = true;
        cardMaterial.alphaTest = 0.34;
        cardMaterial.side = THREE.DoubleSide;
        cardMaterial.depthWrite = true;
        cardMaterial.userData = { ...hairMaterial.userData, materialRole: "hair-card" };
        for (let index = 0; index < 12; index += 1) {
          const card = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.78, 1, 3), cardMaterial);
          const angle = (index / 12) * Math.PI * 2;
          card.position.set(Math.sin(angle) * 0.37, -0.2 - (index % 3) * 0.07, Math.cos(angle) * 0.34);
          card.rotation.y = angle;
          card.rotation.z = Math.sin(angle * 1.5) * 0.08;
          card.userData.secondaryMotion = 0.018 + (index % 4) * 0.006;
          card.userData.heroDetail = true;
          card.userData.requiresAlpha = true;
          hair.add(card);
        }
      }
      hair.position.set(0, 2.67, 0.02);
      group.add(hair);
      const accessory = new THREE.Group();
      const accessoryMaterial = surface(profile.accent, { emissive: profile.accent, emissiveIntensity: 0.34, roughness: 0.2, clearcoat: 0.75 });
      accessoryMaterial.userData.materialRole = "accessory";
      const earCuff = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.018, 8, 22, Math.PI * 1.45), accessoryMaterial);
      earCuff.position.set(-0.42, 2.49, -0.01);
      earCuff.rotation.set(0, Math.PI / 2, 0.25);
      earCuff.userData.accessoryId = "ear-cuff";
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.105, 0.024),
        surface(profile.eyes, { emissive: profile.accent, emissiveIntensity: 0.28, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.72 })
      );
      visor.position.set(0, 2.57, -0.438);
      visor.userData.accessoryId = "visor";
      const astralMark = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 1), accessoryMaterial);
      astralMark.position.set(0, 2.75, -0.395);
      astralMark.userData.accessoryId = "astral-mark";
      accessory.add(earCuff, visor, astralMark);
      accessory.visible = false;
      accessory.userData.heroDetail = true;
      group.add(accessory);

      const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.74, 5, 8), bodyMaterial);
      const rightArm = leftArm.clone();
      leftArm.position.set(-0.55, 1.48, 0);
      rightArm.position.set(0.55, 1.48, 0);
      leftArm.rotation.z = -0.06;
      rightArm.rotation.z = 0.06;
      group.add(leftArm, rightArm);
      const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 9), skinMaterial);
      const rightHand = leftHand.clone();
      leftHand.position.set(-0.55, 0.95, 0);
      rightHand.position.set(0.55, 0.95, 0);
      leftHand.scale.set(0.72, 1.18, 0.55);
      rightHand.scale.copy(leftHand.scale);
      group.add(leftHand, rightHand);

      const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.74, 5, 8), darkMaterial);
      const rightLeg = leftLeg.clone();
      leftLeg.position.set(-0.22, 0.46, 0);
      rightLeg.position.set(0.22, 0.46, 0);
      group.add(leftLeg, rightLeg);
      const leftFoot = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.22, 5, 8), darkMaterial);
      const rightFoot = leftFoot.clone();
      leftFoot.position.set(-0.22, 0.02, -0.1);
      rightFoot.position.set(0.22, 0.02, -0.1);
      leftFoot.rotation.x = Math.PI / 2;
      rightFoot.rotation.x = Math.PI / 2;
      group.add(leftFoot, rightFoot);

      const coat = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.92, 8, 1, true), accentMaterial);
      coat.position.y = 1.05;
      coat.rotation.y = Math.PI / 8;
      // Fantasy geometry is retained for the explicit anime renderer only.
      // In cinematic/realistic modes this open cone hid the torso and made the
      // safety human look like a mannequin inside a pyramid.
      coat.visible = !realistic;
      group.add(coat);

      const cape = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 1.2, 1, 3),
        toon(profile.accent, { transparent: true, opacity: 0.82, emissive: profile.accent, emissiveIntensity: 0.2 })
      );
      cape.position.set(0, 1.5, 0.34);
      cape.rotation.x = 0.12;
      cape.visible = !realistic;
      group.add(cape);

      const wingMaterial = new THREE.MeshBasicMaterial({
        color: profile.accent,
        transparent: true,
        opacity: 0.58,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const leftWing = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.72), wingMaterial);
      const rightWing = leftWing.clone();
      leftWing.position.set(-0.8, 1.72, 0.34);
      rightWing.position.set(0.8, 1.72, 0.34);
      leftWing.rotation.set(-0.15, 0.28, -0.25);
      rightWing.rotation.set(-0.15, -0.28, 0.25);
      leftWing.visible = false;
      rightWing.visible = false;
      group.add(leftWing, rightWing);

      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 8, 40), accentMaterial);
      halo.position.y = 2.98;
      halo.rotation.x = Math.PI / 2;
      halo.visible = !realistic;
      group.add(halo);

      const weaponAnchor = new THREE.Group();
      weaponAnchor.position.set(0.58, 1.45, 0);
      group.add(weaponAnchor);

      group.userData.parts = {
        leftLeg, rightLeg, leftArm, rightArm, torso, head, hair, cape, halo, eyes, eyelids,
        faceShadow, weaponAnchor, leftWing, rightWing, neck, nose, mouth, leftEar, rightEar,
        leftBrow, rightBrow, leftHand, rightHand, leftFoot, rightFoot, coat, beard, accessory
      };
      group.userData.characterId = profile.id;
      group.userData.renderStyle = this.state.settings.renderStyle;
      this.applyAppearanceToMesh(group, this.state.appearance?.recipes?.[profile.id] || defaultAppearanceRecipe(profile.id), profile.id);
      return group;
    }

    applyNamedMorphTargets(mesh, recipe) {
      const candidates = Object.values(APPEARANCE_CONTROL_MAP)
        .map((control) => ({
          ...control,
          value: recipe.morphs[control.id],
          delta: Math.abs(recipe.morphs[control.id] - control.defaultValue)
        }))
        .filter((control) => control.delta > 0.015)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 20);
      let supportedTargets = 0;
      mesh.traverse((object) => {
        const dictionary = object.morphTargetDictionary;
        const influences = object.morphTargetInfluences;
        if (!dictionary || !influences) return;
        Object.entries(dictionary).forEach(([name, index]) => {
          const normalized = String(name).replace(/^ARKit_/i, "").replace(/^AR_/i, "").replace(/Positive$|Negative$/i, "");
          if (APPEARANCE_CONTROL_MAP[normalized] && Number.isInteger(index) && index < influences.length) influences[index] = 0;
        });
        candidates.forEach((control) => {
          const centered = control.value - control.defaultValue;
          const aliases = [
            [control.id, control.value],
            [`AR_${control.id}`, control.value],
            [`${control.id}Positive`, Math.max(0, centered * 2)],
            [`${control.id}Negative`, Math.max(0, -centered * 2)]
          ];
          aliases.forEach(([name, value]) => {
            const index = dictionary[name];
            if (!Number.isInteger(index) || index >= influences.length) return;
            influences[index] = clamp(value, 0, 1);
            supportedTargets += 1;
          });
        });
      });
      mesh.userData.activeMorphs = candidates.map((control) => control.id);
      return supportedTargets;
    }

    applyDigitalHumanMaterials(mesh, recipe, characterId = "lyra") {
      if (!mesh) return;
      const profile = CHARACTERS[characterId] || CHARACTERS.lyra;
      const outfitPalette = {
        "central-jacket-02": [profile.body, profile.accent],
        "combat-boots-01": ["#1a2233", profile.accent],
        "aurora-suit-01": ["#b9f4ff", "#65f1c7"],
        "void-coat-01": ["#211638", "#d66cff"]
      }[recipe.outfit?.[0]] || [profile.body, profile.accent];
      const makeupTint = {
        none: null,
        natural: "#d98f94",
        nebula: "#cb68e8",
        cyber: "#56eaff",
        solar: "#ffb75f"
      }[recipe.makeup];
      mesh.traverse?.((object) => {
        if (!object.isMesh && !object.isSkinnedMesh) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material, materialIndex) => {
          material.userData ||= {};
          const identity = `${object.name || ""} ${material.name || ""}`.toLowerCase();
          let role = material.userData.materialRole || "";
          if (!role) {
            if (/gland|tear|wetline/.test(identity)) role = "eye-moisture";
            else if (/teeth|tooth|gum|tongue/.test(identity)) role = "teeth";
            else if (/hair|brow|lash|beard|groom/.test(identity)) role = "hair";
            else if (/eye|iris|cornea|sclera|tear/.test(identity)) role = "eyes";
            else if (/skin|dermis|face|head|body_nude/.test(identity)) role = "skin";
            else if (/dds|body|character|human/.test(identity)) role = "body-composite";
            else role = "outfit";
            material.userData.materialRole = role;
          }
          material.userData.baseRoughness ??= material.roughness;
          material.userData.baseClearcoat ??= material.clearcoat || 0;
          material.userData.baseEmissiveIntensity ??= material.emissiveIntensity || 0;
          if (material.color && !material.userData.hhOriginalColor) material.userData.hhOriginalColor = `#${material.color.getHexString()}`;
          if (role === "skin") {
            material.color?.set(recipe.skinColor);
            if ("roughness" in material) material.roughness = clamp(0.26 + recipe.surface.roughness * 0.5 - recipe.surface.wetness * 0.18, 0.12, 0.86);
            if ("clearcoat" in material) material.clearcoat = clamp(0.025 + recipe.surface.wetness * 0.72, 0, 0.82);
            if ("clearcoatRoughness" in material) material.clearcoatRoughness = 0.56;
            if ("sheen" in material) material.sheen = clamp(0.18 + recipe.surface.subsurface * 0.52, 0, 0.85);
            if ("ior" in material) material.ior = 1.4;
            if ("specularIntensity" in material) material.specularIntensity = 0.28 + recipe.surface.subsurface * 0.24;
            if (this.state.settings.microDetail) {
              material.normalMap ||= this.createCharacterDetailTexture("skin-normal");
              material.roughnessMap ||= this.createCharacterDetailTexture("skin-roughness");
              material.normalScale?.setScalar?.(0.06 + recipe.surface.pores * 0.18);
            }
            if (material.emissive && makeupTint) {
              material.emissive.set(makeupTint);
              material.emissiveIntensity = clamp(recipe.decals.makeup * 0.025 + recipe.surface.flush * 0.018, 0, 0.045);
            }
          } else if (role === "hair" || role === "hair-card") {
            material.color?.set(recipe.hairColor);
            if ("roughness" in material) material.roughness = recipe.hair.includes("long") ? 0.34 : 0.28;
            if ("anisotropy" in material) material.anisotropy = this.state.settings.microDetail ? 0.78 : 0;
            if ("alphaHash" in material && role === "hair-card") material.alphaHash = true;
          } else if (role === "eyes" || role === "eye-moisture") {
            if (material.color) {
              material.color.set(material.userData.hhOriginalColor || "#ffffff");
              if (role === "eyes") material.color.lerp(new this.THREE.Color(recipe.eyeColor), 0.12);
            }
            if ("roughness" in material) material.roughness = role === "eye-moisture" ? 0.035 : 0.09;
            if ("clearcoat" in material) material.clearcoat = 0.78 + (recipe.morphs.eyeReflection || 0.5) * 0.22;
            if ("ior" in material) material.ior = 1.376;
            if ("transmission" in material) material.transmission = role === "eye-moisture" ? 0.08 : 0.025;
          } else if (role === "teeth") {
            material.color?.set(0xfff8eb);
            if ("roughness" in material) material.roughness = 0.32;
            if ("clearcoat" in material) material.clearcoat = 0.22;
          } else if (role === "body-composite") {
            // VALID packs skin, hair and clothing into one authored atlas. A
            // global tint would color the sclera and clothes too, so preserve
            // the photographed base color and only tune its physical response.
            material.color?.set(material.userData.hhOriginalColor || "#ffffff");
            if ("roughness" in material) material.roughness = clamp(0.42 + recipe.surface.roughness * 0.16 - recipe.surface.wetness * 0.12, 0.26, 0.66);
            material.envMapIntensity = 0.58;
          } else if (role === "outfit") {
            const color = materialIndex % 2 ? outfitPalette[1] : outfitPalette[0];
            if (material.color && mesh.userData.visualMode !== "builtin-rigged") material.color.set(color);
            if ("roughness" in material) material.roughness = clamp(material.userData.baseRoughness ?? 0.45, 0.22, 0.82);
          }
          material.userData.hhDigitalHuman = {
            version: CHARACTER_VISUAL_VERSION,
            role,
            skinLayers: role === "skin" ? 5 : 0,
            hairCards: role === "hair-card"
          };
          if (material.color) material.userData.baseColor = `#${material.color.getHexString()}`;
          material.needsUpdate = true;
        });
      });
      const parts = mesh.userData?.parts;
      if (parts?.hair?.children?.length) {
        const visibilityPattern = {
          "astral-layered-07": [1, 1, 1, 1, 1, 1],
          "aurora-short-02": [1, 0, 1, 0, 0, 0],
          "void-long-04": [1, 1, 1, 1, 1, 1],
          "solar-braid-03": [1, 0, 0, 1, 0, 1]
        }[recipe.hair] || [];
        parts.hair.children.forEach((child, index) => {
          if (index === 0) return;
          child.visible = visibilityPattern[(index - 1) % Math.max(1, visibilityPattern.length)] !== 0
            && (!child.userData.requiresAlpha || Boolean(child.material?.alphaMap));
          child.scale.y = recipe.hair.includes("long") ? 1.28 : recipe.hair.includes("short") ? 0.68 : 1;
        });
      }
      if (parts?.beard) {
        parts.beard.visible = recipe.beard !== "none";
        parts.beard.scale.set(
          recipe.beard === "astral-goatee-03" ? 0.54 : 0.82,
          recipe.beard === "shadow-01" ? 0.38 : recipe.beard === "astral-goatee-03" ? 1.18 : 0.72,
          1
        );
      }
      if (parts?.accessory) {
        parts.accessory.visible = recipe.accessory !== "none";
        parts.accessory.children.forEach((child) => {
          child.visible = child.userData.accessoryId === recipe.accessory;
        });
      }
      mesh.userData.digitalHumanSurface = {
        skinLayers: 5,
        eyeLayers: parts?.eyes?.length ? 3 : 0,
        hairMode: this.state.settings.microDetail ? "hair-cards-anisotropic" : "hair-lite",
        recipe: { ...recipe.surface },
        decals: { ...recipe.decals }
      };
    }

    applyAppearanceToMesh(mesh, inputRecipe, characterId = "lyra") {
      if (!mesh?.userData?.parts) return;
      const recipe = normalizeAppearanceRecipe(inputRecipe, characterId);
      const parts = mesh.userData.parts;
      const morph = (id) => recipe.morphs[id] ?? APPEARANCE_CONTROL_MAP[id]?.defaultValue ?? 0.5;
      const delta = (id) => morph(id) - (APPEARANCE_CONTROL_MAP[id]?.defaultValue ?? 0.5);
      const hasProceduralRig = Boolean(parts.torso && parts.head && parts.leftArm && parts.rightArm && parts.leftLeg && parts.rightLeg);
      if (!hasProceduralRig) {
        this.applyDigitalHumanMaterials(mesh, recipe, characterId);
        const supportedTargets = this.applyNamedMorphTargets(mesh, recipe);
        if (mesh.userData.visualMode === "builtin-rigged") {
          this.applyRiggedBodyProportions(mesh, recipe);
        }
        mesh.userData.appearance = compactAppearanceRecipe(recipe, characterId);
        mesh.userData.appearanceFingerprint = appearanceFingerprint(recipe, characterId);
        mesh.userData.appearanceCapability = supportedTargets
          ? "gltf-morph-targets"
          : mesh.userData.visualMode === "builtin-rigged"
            ? "skeleton-proportions"
            : "gltf-material-only";
        mesh.userData.visualHeight = 1 + delta("height") * 0.12;
        mesh.userData.gameplayCollider = { radius: 0.48, height: 2.95 };
        return;
      }
      const symmetric = recipe.symmetry || !recipe.advanced;
      const side = (leftId, rightId, wanted) => {
        if (!symmetric) return morph(wanted === "left" ? leftId : rightId);
        return (morph(leftId) + morph(rightId)) / 2;
      };

      const torsoLift = delta("torsoLength") * 0.34 + delta("height") * 0.22;
      const legLift = delta("legLength") * 0.36 + delta("legTorsoRatio") * 0.2;
      const headLift = torsoLift + legLift;
      const shoulder = 0.55 + delta("shoulderWidth") * 0.32;
      const hip = 0.22 + delta("hipWidth") * 0.22;
      const bodyDepth = 0.68 + delta("belly") * 0.22 + delta("bodyMass") * 0.14;
      const torsoWidth = 0.95 + delta("backWidth") * 0.22 + delta("chestWidth") * 0.2 - delta("waist") * 0.08;
      const torsoHeight = 1 + delta("torsoLength") * 0.42 + delta("height") * 0.16;
      parts.torso.scale.set(torsoWidth, torsoHeight, bodyDepth);
      parts.torso.position.y = 1.45 + legLift * 0.72;
      parts.torso.rotation.x = delta("posture") * -0.08;

      const headWidth = 0.92 + delta("cheekboneWidth") * 0.17 + delta("jawWidth") * 0.13 + delta("faceFullness") * 0.12;
      const headHeight = 1.08 + delta("headLength") * 0.22 + delta("foreheadHeight") * 0.1 - delta("faceFullness") * 0.04;
      const headDepth = 0.9 + delta("cheekFullness") * 0.16 + delta("faceFullness") * 0.1;
      parts.head.scale.set(headWidth, headHeight, headDepth);
      parts.head.position.y = 2.52 + headLift;
      parts.faceShadow.position.y = 2.49 + headLift;
      parts.faceShadow.scale.set(headWidth, headHeight * 0.98, headDepth);

      parts.neck.position.y = 2.08 + legLift + torsoLift * 0.45;
      parts.neck.scale.set(
        1 + delta("neckWidth") * 0.5,
        1 + delta("neckLength") * 0.5,
        1 + delta("neckWidth") * 0.36
      );

      const eyeSpacing = 0.15 + delta("eyeSpacing") * 0.11;
      const eyeSize = 1 + delta("eyeSize") * 0.62;
      const eyeDepth = -0.385 - delta("eyeDepth") * 0.055;
      parts.eyes.forEach((eye, index) => {
        const eyeSide = index === 0 ? side("eyeLeft", "eyeRight", "left") : side("eyeLeft", "eyeRight", "right");
        eye.position.set(index === 0 ? -eyeSpacing : eyeSpacing, 2.56 + headLift, eyeDepth);
        eye.scale.set(0.72 * eyeSize * (0.88 + eyeSide * 0.24), 1.15 * eyeSize * (0.86 + morph("upperLid") * 0.16), 0.36);
        eye.userData.baseScaleY = eye.scale.y;
        eye.userData.baseScale = eye.scale.clone();
        eye.rotation.z = (index === 0 ? -1 : 1) * delta("eyeAngle") * 0.28;
        const lid = parts.eyelids?.[index];
        if (lid) {
          lid.position.set(eye.position.x, eye.position.y + 0.05, eye.position.z - 0.016);
          lid.rotation.z = eye.rotation.z;
        }
      });
      const irisScale = 0.78 + morph("irisSize") * 0.34;
      parts.eyes.forEach((eye) => {
        eye.userData.iris?.scale.setScalar(irisScale);
        const pupilScale = 0.7 + morph("pupilSize") * 0.6;
        eye.userData.pupil?.scale.setScalar(pupilScale);
        if (eye.userData.pupil) eye.userData.pupil.userData.baseScale = pupilScale;
        const shine = eye.getObjectByName?.("EyeCatchlight");
        shine?.scale.setScalar(0.7 + morph("eyeReflection") * 0.7);
      });

      parts.nose.position.set(0, 2.43 + headLift, -0.43 - delta("noseProjection") * 0.08);
      parts.nose.scale.set(
        0.58 + morph("noseWing") * 0.34,
        0.78 + morph("noseLength") * 0.42,
        0.62 + morph("noseTip") * 0.32
      );
      parts.mouth.position.set(0, 2.29 + headLift - delta("chinLength") * 0.035, -0.405 - delta("mouthProjection") * 0.04);
      parts.mouth.scale.set(
        0.62 + morph("mouthWidth") * 0.76,
        0.12 + (morph("upperLip") + morph("lowerLip")) * 0.15,
        0.22 + morph("mouthProjection") * 0.08
      );
      const earSize = 0.7 + morph("earSize") * 0.58;
      [["leftEar", -1, "left"], ["rightEar", 1, "right"]].forEach(([partId, direction, wanted]) => {
        const ear = parts[partId];
        const perSide = side("earLeft", "earRight", wanted);
        ear.position.set(direction * (0.415 + delta("earProtrusion") * 0.08), 2.51 + headLift, 0);
        ear.scale.set(0.32 + morph("earProtrusion") * 0.2, earSize * (0.85 + perSide * 0.2), 0.44 + morph("earLobe") * 0.18);
        ear.rotation.z = direction * delta("earAngle") * 0.32;
      });
      parts.leftBrow.position.set(-eyeSpacing, 2.68 + headLift + delta("browHeight") * 0.08, -0.397);
      parts.rightBrow.position.set(eyeSpacing, 2.68 + headLift + delta("browHeight") * 0.08, -0.397);
      parts.leftBrow.scale.set(0.75 + morph("browShape") * 0.5, 0.55 + morph("browThickness"), 1);
      parts.rightBrow.scale.copy(parts.leftBrow.scale);
      parts.leftBrow.rotation.z = -0.08 - delta("browAngle") * 0.34;
      parts.rightBrow.rotation.z = 0.08 + delta("browAngle") * 0.34;

      const armLength = 1 + delta("armLength") * 0.45 + delta("height") * 0.08;
      [["leftArm", -1, "left"], ["rightArm", 1, "right"]].forEach(([partId, direction, wanted]) => {
        const arm = parts[partId];
        const perSide = side("armLeft", "armRight", wanted);
        arm.position.set(direction * shoulder, 1.48 + legLift + torsoLift * 0.45, 0);
        arm.scale.set(0.78 + morph("upperArm") * 0.44, armLength * (0.9 + perSide * 0.2), 0.78 + morph("upperArm") * 0.36);
      });
      [["leftHand", -1, "left"], ["rightHand", 1, "right"]].forEach(([partId, direction, wanted]) => {
        const hand = parts[partId];
        const perSide = side("armLeft", "armRight", wanted);
        hand.position.set(direction * shoulder, 0.95 + legLift + torsoLift * 0.2 - delta("armLength") * 0.22, 0);
        hand.scale.setScalar((0.72 + morph("handSize") * 0.38) * (0.9 + perSide * 0.18));
      });

      const legLength = 1 + delta("legLength") * 0.48 + delta("height") * 0.12 + delta("legTorsoRatio") * 0.18;
      [["leftLeg", -1, "left"], ["rightLeg", 1, "right"]].forEach(([partId, direction, wanted]) => {
        const leg = parts[partId];
        const perSide = side("legLeft", "legRight", wanted);
        leg.position.set(direction * hip, 0.46 + legLift * 0.3, 0);
        leg.scale.set(0.78 + morph("thighSize") * 0.44, legLength * (0.9 + perSide * 0.2), 0.78 + morph("thighSize") * 0.38);
      });
      [["leftFoot", -1, "left"], ["rightFoot", 1, "right"]].forEach(([partId, direction, wanted]) => {
        const foot = parts[partId];
        const perSide = side("legLeft", "legRight", wanted);
        foot.position.set(direction * hip, 0.02, -0.1 - delta("footSize") * 0.07);
        foot.scale.setScalar((0.76 + morph("footSize") * 0.42) * (0.9 + perSide * 0.16));
      });

      parts.coat.position.y = 1.05 + legLift * 0.72;
      parts.coat.scale.set(
        0.88 + morph("hipWidth") * 0.26 + morph("chestSize") * 0.1,
        0.92 + delta("torsoLength") * 0.2,
        0.86 + morph("gluteProjection") * 0.24 + morph("belly") * 0.12
      );
      parts.cape.position.y = 1.5 + legLift + torsoLift * 0.4;
      parts.hair.position.y = 2.67 + headLift;
      parts.hair.scale.set(headWidth, headHeight * 0.96, headDepth);
      parts.halo.position.y = 2.98 + headLift;
      parts.weaponAnchor.position.set(shoulder + 0.03, 1.45 + legLift + torsoLift * 0.42, 0);

      mesh.traverse((object) => {
        const material = object.material;
        if (!material?.color) return;
        if (material.userData?.materialRole === "skin") material.color.set(recipe.skinColor);
        if (material.userData?.materialRole === "hair") material.color.set(recipe.hairColor);
        if (material.userData?.materialRole === "eyes") {
          material.color.set(recipe.eyeColor);
          if ("clearcoat" in material) material.clearcoat = 0.55 + morph("eyeReflection") * 0.45;
        }
      });

      const supportedTargets = this.applyNamedMorphTargets(mesh, recipe);
      mesh.userData.appearance = compactAppearanceRecipe(recipe, characterId);
      mesh.userData.appearanceFingerprint = appearanceFingerprint(recipe, characterId);
      mesh.userData.appearanceCapability = supportedTargets ? "gltf-morph-targets" : "procedural-fallback";
      mesh.userData.visualHeight = 1 + delta("height") * 0.12;
      mesh.userData.gameplayCollider = { radius: 0.48, height: 2.95 };
    }

    applyCorrectiveMorphs(mesh) {
      if (!mesh?.userData?.parts) return;
      const parts = mesh.userData.parts;
      if (!parts.leftArm || !parts.rightArm || !parts.leftLeg || !parts.rightLeg || !parts.torso) return;
      const values = {
        correctiveShoulder: clamp((Math.abs(parts.leftArm.rotation.x) + Math.abs(parts.rightArm.rotation.x)) * 0.45, 0, 1),
        correctiveHip: clamp((Math.abs(parts.leftLeg.rotation.x) + Math.abs(parts.rightLeg.rotation.x)) * 0.4, 0, 1),
        correctiveElbow: clamp(Math.max(Math.abs(parts.leftArm.rotation.z), Math.abs(parts.rightArm.rotation.z)) * 0.6, 0, 1),
        correctiveKnee: clamp(Math.max(Math.abs(parts.leftLeg.rotation.x), Math.abs(parts.rightLeg.rotation.x)) * 0.7, 0, 1),
        correctiveChest: clamp(Math.abs(parts.torso.rotation.z) * 2.5, 0, 1)
      };
      mesh.traverse((object) => {
        const dictionary = object.morphTargetDictionary;
        const influences = object.morphTargetInfluences;
        if (!dictionary || !influences) return;
        Object.entries(values).forEach(([name, value]) => {
          const index = dictionary[name];
          if (Number.isInteger(index) && index < influences.length) influences[index] = value;
        });
      });
      this.applyDigitalHumanMaterials(mesh, recipe, characterId);
      mesh.userData.correctives = values;
    }

    applyRiggedBodyProportions(mesh, recipe) {
      const asset = mesh?.userData?.gltfAsset;
      if (!asset) return;
      const morph = (id) => clamp(recipe.morphs?.[id] ?? 0.5, 0, 1);
      const delta = (id) => morph(id) - 0.5;
      const boneByName = new Map();
      asset.traverse?.((object) => {
        if (!object.isBone) return;
        object.userData ||= {};
        object.userData.hhBaseScale ||= { x: object.scale.x, y: object.scale.y, z: object.scale.z };
        const base = object.userData.hhBaseScale;
        object.scale.set(base.x, base.y, base.z);
        boneByName.set(normalizeBoneName(object.name), object);
      });
      const bone = (...names) => names.map(normalizeBoneName).map((name) => boneByName.get(name)).find(Boolean);
      const setScale = (target, x = 1, y = 1, z = 1) => {
        if (!target) return;
        const base = target.userData.hhBaseScale || { x: 1, y: 1, z: 1 };
        target.scale.set(base.x * x, base.y * y, base.z * z);
      };
      const head = bone("Head", "mixamorigHead");
      const neck = bone("Neck", "mixamorigNeck");
      const chest = bone("Spine2", "mixamorigSpine2", "Chest");
      const spine = bone("Spine", "mixamorigSpine");
      const hips = bone("Hips", "mixamorigHips");
      const leftArm = bone("LeftArm", "mixamorigLeftArm");
      const rightArm = bone("RightArm", "mixamorigRightArm");
      const leftForeArm = bone("LeftForeArm", "mixamorigLeftForeArm");
      const rightForeArm = bone("RightForeArm", "mixamorigRightForeArm");
      const leftUpLeg = bone("LeftUpLeg", "mixamorigLeftUpLeg");
      const rightUpLeg = bone("RightUpLeg", "mixamorigRightUpLeg");
      const leftLeg = bone("LeftLeg", "mixamorigLeftLeg");
      const rightLeg = bone("RightLeg", "mixamorigRightLeg");
      const headWidth = 1 + delta("jawWidth") * 0.16 + delta("faceFullness") * 0.1;
      const headHeight = 1 + delta("headLength") * 0.18 + delta("foreheadHeight") * 0.08;
      const headDepth = 1 + delta("faceFullness") * 0.14 + delta("noseProjection") * 0.05;
      setScale(head, headWidth, headHeight, headDepth);
      setScale(neck, 1 + delta("neckWidth") * 0.22, 1 + delta("neckLength") * 0.2, 1 + delta("neckWidth") * 0.2);
      setScale(chest, 1 + delta("shoulderWidth") * 0.22 + delta("chestWidth") * 0.12, 1 + delta("torsoLength") * 0.12, 1 + delta("chestSize") * 0.16);
      setScale(spine, 1 + delta("waist") * 0.18 + delta("bodyMass") * 0.12, 1 + delta("torsoLength") * 0.18, 1 + delta("belly") * 0.16);
      setScale(hips, 1 + delta("hipWidth") * 0.22, 1 + delta("legTorsoRatio") * -0.08, 1 + delta("gluteProjection") * 0.2);
      const armLength = 1 + delta("armLength") * 0.22;
      const armMass = 1 + delta("upperArm") * 0.18 + delta("muscle") * 0.08;
      setScale(leftArm, armMass, armLength, armMass);
      setScale(rightArm, armMass, armLength, armMass);
      const forearmMass = 1 + delta("forearm") * 0.18;
      setScale(leftForeArm, forearmMass, armLength, forearmMass);
      setScale(rightForeArm, forearmMass, armLength, forearmMass);
      const legLength = 1 + delta("legLength") * 0.24 + delta("height") * 0.1;
      const thighMass = 1 + delta("thighSize") * 0.2 + delta("bodyMass") * 0.08;
      setScale(leftUpLeg, thighMass, legLength, thighMass);
      setScale(rightUpLeg, thighMass, legLength, thighMass);
      const calfMass = 1 + delta("calfSize") * 0.2;
      setScale(leftLeg, calfMass, legLength, calfMass);
      setScale(rightLeg, calfMass, legLength, calfMass);
      const baseAssetScale = asset.userData.hhBaseScale || { x: asset.scale.x, y: asset.scale.y, z: asset.scale.z };
      asset.userData.hhBaseScale ||= { ...baseAssetScale };
      asset.scale.set(
        baseAssetScale.x * (1 + delta("bodyMass") * 0.06),
        baseAssetScale.y * (1 + delta("height") * 0.12),
        baseAssetScale.z * (1 + delta("bodyMass") * 0.06)
      );
      mesh.userData.visualHeight = 1 + delta("height") * 0.12;
    }

    primarySkinnedMesh(root) {
      let primary = null;
      let score = -1;
      root?.traverse?.((object) => {
        if (!object.isSkinnedMesh || !object.skeleton?.bones?.length) return;
        const vertices = Number(object.geometry?.attributes?.position?.count || 0);
        const nextScore = vertices + object.skeleton.bones.length * 100;
        if (nextScore <= score) return;
        primary = object;
        score = nextScore;
      });
      return primary;
    }

    classifyRiggedMaterialRole(object, material) {
      const identity = `${object?.name || ""} ${material?.name || ""}`.toLowerCase();
      if (/gland|tear|wetline/.test(identity)) return "eye-moisture";
      if (/teeth|tooth|gum|tongue/.test(identity)) return "teeth";
      if (/eye|iris|cornea|sclera/.test(identity)) return "eyes";
      if (/hair|brow|lash|beard|groom/.test(identity)) return "hair";
      if (/skin|dermis|face|head|body_nude/.test(identity)) return "skin";
      if (/dds|body|character|human/.test(identity)) return "body-composite";
      if (/visor|glass/.test(identity)) return "eyes";
      return "outfit";
    }

    cloneRiggedMaterial(object, sourceMaterial, profile) {
      const THREE = this.THREE;
      const role = this.classifyRiggedMaterialRole(object, sourceMaterial);
      const material = sourceMaterial.clone();
      material.userData = {
        ...(material.userData || {}),
        materialRole: role,
        baseRoughness: material.roughness,
        baseClearcoat: material.clearcoat || 0,
        baseEmissiveIntensity: material.emissiveIntensity || 0,
        hhOriginalColor: material.color ? `#${material.color.getHexString()}` : "#ffffff"
      };
      material.side = /hair-card/.test(role) ? THREE.DoubleSide : THREE.FrontSide;
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      material.depthTest = true;
      material.envMapIntensity = role === "body-composite" || role === "skin" ? 0.58 : 0.82;
      if (role === "eyes" || role === "eye-moisture") {
        material.color?.set(0xffffff);
        material.roughness = role === "eye-moisture" ? 0.035 : 0.09;
        material.metalness = 0;
        material.envMapIntensity = 1.05;
        if ("clearcoat" in material) material.clearcoat = 1;
        if ("clearcoatRoughness" in material) material.clearcoatRoughness = 0.035;
        if ("ior" in material) material.ior = 1.376;
        if ("specularIntensity" in material) material.specularIntensity = 0.92;
      } else if (role === "teeth") {
        material.color?.set(0xfff8eb);
        material.roughness = 0.32;
        material.metalness = 0;
        if ("clearcoat" in material) material.clearcoat = 0.22;
      } else if (role === "hair") {
        material.roughness = 0.3;
        if ("anisotropy" in material) material.anisotropy = 0.7;
      } else if (/visor|glass/.test(`${object?.name || ""} ${sourceMaterial?.name || ""}`.toLowerCase())) {
        material.color?.set(profile.eyes);
        material.emissive?.set(profile.accent);
        material.emissiveIntensity = Math.max(0.12, material.emissiveIntensity || 0);
      }
      material.needsUpdate = true;
      return material;
    }

    createBuiltInRiggedCharacter(profile, scale = 1) {
      const recipe = normalizeAppearanceRecipe(this.state.appearance?.recipes?.[profile.id], profile.id);
      const fallbackModelId = {
        lyra: "valid-asian-f-1-casual",
        cael: "valid-white-f-2-casual",
        nyx: "valid-black-f-1-casual",
        sol: "valid-hispanic-f-1-milit"
      }[profile.id] || "human-adult-b01";
      const modelId = this.builtInCharacterAssets.has(recipe.baseModel) ? recipe.baseModel : fallbackModelId;
      const source = this.builtInCharacterAssets.get(modelId);
      if (!source?.scene || !this.cloneSkinnedCharacter) return null;
      const assetHasTextureFallback = Number(source.userData?.hhTextureFallbacks || 0) > 0;
      // Missing textures already receive safe PBR colors in the sanitizer and
      // must not replace a valid human silhouette with the primitive proxy.
      // The proxy is reserved for genuinely missing/unrenderable geometry.
      const assetNeedsVisualRecovery = Number(source.userData?.hhRenderableMeshes || 0) < 1;
      const THREE = this.THREE;
      const wrapper = new THREE.Group();
      wrapper.name = `HHHumanRig:${profile.id}`;
      wrapper.scale.setScalar(scale);
      const asset = this.cloneSkinnedCharacter(source.scene);
      const sourceInfo = this.builtInCharacterSources.get(modelId) || {
        provider: source.userData?.hhSourceProvider || "bundled",
        label: source.userData?.hhSourceLabel || "HH bundled GLB",
        url: source.userData?.hhAssetPath || BUILTIN_CHARACTER_ASSETS[modelId]
      };
      asset.name = `${modelId}:${profile.id}`;
      asset.updateMatrixWorld(true);
      asset.traverse?.((object) => {
        if (!object.isSkinnedMesh) return;
        object.computeBoundingBox?.();
        object.computeBoundingSphere?.();
      });
      const box = new THREE.Box3().setFromObject(asset);
      const size = box.getSize(new THREE.Vector3());
      const fitScale = 2.92 / Math.max(0.001, size.y);
      asset.scale.setScalar(fitScale);
      asset.userData ||= {};
      asset.userData.hhBaseScale = { x: fitScale, y: fitScale, z: fitScale };
      asset.updateMatrixWorld(true);
      const fitted = new THREE.Box3().setFromObject(asset);
      const center = fitted.getCenter(new THREE.Vector3());
      asset.position.set(-center.x, -fitted.min.y, -center.z);
      const normalizedFitted = fitted.clone().translate(asset.position);
      const genesisAuthoredBounds = {
        min: normalizedFitted.min.toArray(),
        max: normalizedFitted.max.toArray()
      };
      const heroMeshes = [];
      asset.traverse((object) => {
        if (!object.isMesh && !object.isSkinnedMesh) return;
        heroMeshes.push(object);
        object.castShadow = true;
        object.receiveShadow = true;
        object.userData ||= {};
        object.userData.sharedAsset = true;
        const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
        const materials = sourceMaterials.filter(Boolean).map((sourceMaterial) => this.cloneRiggedMaterial(object, sourceMaterial, profile));
        object.material = Array.isArray(object.material) ? materials : materials[0];
      });
      const animationRoot = this.primarySkinnedMesh(asset);
      // VALID and Mixamo use different rest transforms/bone rolls. V13 never
      // retargets in the browser: Blender bakes clips onto this exact VALID rig
      // first. A partial library is still useful to inspect/build, but it must
      // not drive the visible human until its complete manifest is marked ready;
      // otherwise one mislabeled idle clip can leave the actor bent or T-posed.
      const verifiedOfflineMotion = this.motionLibraryManifest?.rig === "HH_VALID_HUMANOID_V1"
        && this.motionLibraryManifest?.status === "ready";
      const offlineBakedAnimations = sourceInfo.provider === "valid-avatar" && verifiedOfflineMotion
        ? this.motionLibraryAnimations
        : [];
      const modelSpecificBakedMotion = source.userData?.hhMotionSource === "offline-baked-model-specific";
      wrapper.add(asset);
      asset.updateMatrixWorld(true);
      const restPoseGroundedBounds = new THREE.Box3().setFromObject(asset, true);
      const measuredGroundOffset = Number.isFinite(restPoseGroundedBounds.min.y)
        ? clamp(-restPoseGroundedBounds.min.y, 0, 1.2)
        : 0;
      // When a bundled GLB has a missing texture or cannot be decoded, keep a
      // full articulated procedural character instead of collapsing to the
      // tiny crowd proxy. This is the GPU-safe view that guarantees a visible
      // human on weak devices while the original asset remains recoverable.
      const crowdProxy = assetNeedsVisualRecovery
        ? this.createAnimeCharacterMesh(profile, 0.94)
        : this.createCharacterMesh({ body: profile.body, accent: profile.accent, scale: 0.94 });
      crowdProxy.name = `HHHuman3DProxy:${profile.id}`;
      crowdProxy.visible = assetNeedsVisualRecovery;
      crowdProxy.userData.isCharacterLodProxy = true;
      wrapper.add(crowdProxy);
      const rightHandAliases = HH_HUMANOID_SKELETON.rightHand.map(normalizeBoneName);
      const headAliases = HH_HUMANOID_SKELETON.head.map(normalizeBoneName);
      let rightHand = null;
      let headBone = null;
      asset.traverse((object) => {
        if (!rightHand && object.isBone && rightHandAliases.includes(normalizeBoneName(object.name))) rightHand = object;
        if (!headBone && object.isBone && headAliases.includes(normalizeBoneName(object.name))) headBone = object;
      });
      const weaponAnchor = new THREE.Group();
      weaponAnchor.name = "HHWeaponSocket";
      (assetNeedsVisualRecovery ? crowdProxy.userData?.parts?.weaponAnchor : rightHand || wrapper)?.add(weaponAnchor);
      const heroDetails = [];
      let riggedHair = null;
      let riggedAccessory = null;
      if (headBone && modelId === "human-adult-a01") {
        const inverseFit = 1 / Math.max(0.001, fitScale);
        const Physical = THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial;
        const hairMaterial = new Physical({
          color: recipe.hairColor,
          roughness: 0.3,
          metalness: 0.02,
          clearcoat: 0.34,
          sheen: 0.48,
          envMapIntensity: 0.74,
          side: THREE.DoubleSide
        });
        hairMaterial.userData = { materialRole: "hair", baseRoughness: 0.3, baseClearcoat: 0.34, baseEmissiveIntensity: 0 };
        riggedHair = new THREE.Group();
        riggedHair.name = "HHWebHeroHairCards";
        riggedHair.position.y = 0.13 * inverseFit;
        const cap = new THREE.Mesh(
          new THREE.SphereGeometry(0.235 * inverseFit, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62),
          hairMaterial
        );
        cap.scale.set(0.98, 1.02, 1.02);
        cap.userData.heroDetail = true;
        riggedHair.add(cap);
        heroDetails.push(cap);
        const cardMaterial = hairMaterial.clone();
        cardMaterial.alphaMap = this.createCharacterDetailTexture("hair-alpha");
        cardMaterial.transparent = true;
        cardMaterial.alphaTest = 0.32;
        cardMaterial.depthWrite = true;
        cardMaterial.userData = { ...hairMaterial.userData, materialRole: "hair-card" };
        for (let index = 0; index < 16; index += 1) {
          const angle = (index / 16) * Math.PI * 2;
          const card = new THREE.Mesh(
            new THREE.PlaneGeometry(0.105 * inverseFit, (0.31 + (index % 4) * 0.035) * inverseFit, 1, 3),
            cardMaterial
          );
          card.position.set(
            Math.sin(angle) * 0.205 * inverseFit,
            (-0.08 - (index % 3) * 0.018) * inverseFit,
            Math.cos(angle) * 0.205 * inverseFit
          );
          card.rotation.y = angle;
          card.userData.heroDetail = true;
          card.userData.secondaryMotion = 0.012 + (index % 4) * 0.004;
          card.userData.requiresAlpha = true;
          riggedHair.add(card);
          heroDetails.push(card);
        }
        headBone.add(riggedHair);

        riggedAccessory = new THREE.Group();
        riggedAccessory.name = "HHWebHeroAccessories";
        const accessoryMaterial = new Physical({
          color: profile.accent,
          emissive: profile.accent,
          emissiveIntensity: 0.32,
          roughness: 0.18,
          metalness: 0.48,
          clearcoat: 0.74
        });
        accessoryMaterial.userData = { materialRole: "accessory", baseRoughness: 0.18, baseClearcoat: 0.74, baseEmissiveIntensity: 0.32 };
        const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.08 * inverseFit, 0.012 * inverseFit, 8, 20, Math.PI * 1.5), accessoryMaterial);
        cuff.position.set(-0.205 * inverseFit, 0, 0);
        cuff.rotation.y = Math.PI / 2;
        cuff.userData.accessoryId = "ear-cuff";
        const visor = new THREE.Mesh(new THREE.TorusGeometry(0.232 * inverseFit, 0.014 * inverseFit, 8, 32), accessoryMaterial);
        visor.rotation.x = Math.PI / 2;
        visor.position.y = 0.045 * inverseFit;
        visor.userData.accessoryId = "visor";
        const mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.045 * inverseFit, 1), accessoryMaterial);
        mark.position.y = 0.245 * inverseFit;
        mark.userData.accessoryId = "astral-mark";
        riggedAccessory.add(cuff, visor, mark);
        riggedAccessory.visible = recipe.accessory !== "none";
        headBone.add(riggedAccessory);
        heroDetails.push(cuff, visor, mark);
      }
      if (assetNeedsVisualRecovery) {
        heroMeshes.forEach((object) => { object.visible = false; });
        heroDetails.forEach((object) => { object.visible = false; });
        if (riggedHair) riggedHair.visible = false;
        if (riggedAccessory) riggedAccessory.visible = false;
      }
      const useProxy = this.state.settings.characterMode === "portrait";
      heroMeshes.forEach((object) => { object.visible = !useProxy && !assetNeedsVisualRecovery; });
      crowdProxy.visible = useProxy || assetNeedsVisualRecovery;
      const visualMode = assetNeedsVisualRecovery ? "procedural-3d-recovery" : "builtin-rigged";
      const initialTier = useProxy || assetNeedsVisualRecovery ? "impostor" : "hero";
      const activeHeroMeshes = assetNeedsVisualRecovery ? [crowdProxy] : [...heroMeshes, ...heroDetails];
      wrapper.userData = {
        characterId: profile.id,
        visualMode: assetHasTextureFallback && !assetNeedsVisualRecovery ? "builtin-rigged-texture-recovery" : visualMode,
        sourceProvider: assetNeedsVisualRecovery
          ? "HH Articulated PBR Recovery"
          : sourceInfo.label || (modelId === "human-adult-a01" ? "HH Asteria Human Rig" : "HH Vanguard Human Rig"),
        sourceProviderId: sourceInfo.provider,
        sourceAssetPath: sourceInfo.url,
        sourceAuthor: sourceInfo.author || "",
        sourceLicense: sourceInfo.license || "",
        sourcePage: sourceInfo.page || "",
        sourceAttribution: sourceInfo.attribution || "",
        // The source mesh is already normalized so its lowest authored point is
        // y=0. A legacy +1.35 lift made VALID feet float and pushed the camera
        // above the actor; keep one explicit grounding offset instead.
        gameplayVisualLift: 0,
        gameplayGroundOffset: measuredGroundOffset,
        modelTier: initialTier,
        appearanceCapability: "skeleton-proportions",
        gameplayCollider: { radius: 0.48, height: 2.95 },
        gltfAsset: asset,
        animationRoot,
        builtInModelId: modelId,
        builtInAnimations: sourceInfo.provider === "valid-avatar"
          ? (offlineBakedAnimations.length ? offlineBakedAnimations : source.animations || [])
          : sourceInfo.provider === "sketchfab-cc-by" && !modelSpecificBakedMotion
            ? []
          : (source.animations?.length ? source.animations : this.builtInCharacterAssets.get("human-adult-b01")?.animations || []),
        motionSource: modelSpecificBakedMotion
          ? "offline-baked-model-specific"
          : offlineBakedAnimations.length
          ? "offline-baked-v13"
          : sourceInfo.provider === "valid-avatar"
            ? "verified-rest-space-procedural"
            : sourceInfo.provider === "sketchfab-cc-by"
              ? "procedural-humanoid-safe"
            : source.animations?.length
              ? "native"
              : "rest-space-procedural",
        motionProfile: offlineBakedAnimations.length
          ? "verified-baked"
          : modelSpecificBakedMotion
            ? "verified-baked"
          : sourceInfo.provider === "valid-avatar"
            ? "valid-rest-solver"
            : "standard",
        parts: {
          weaponAnchor,
          hair: assetNeedsVisualRecovery ? null : riggedHair,
          accessory: assetNeedsVisualRecovery ? null : riggedAccessory
        },
        lodVariants: {
          hero: activeHeroMeshes,
          near: activeHeroMeshes,
          crowd: [crowdProxy],
          impostor: [crowdProxy],
          heroDetails: assetNeedsVisualRecovery ? [] : heroDetails
        }
      };
      this.applyRiggedBodyProportions(wrapper, recipe);
      this.applyAppearanceToMesh(wrapper, recipe, profile.id);
      // Keep the normalized source bounds captured before the mixer, helper
      // attachments and precise skinned bounds can inflate the camera box.
      wrapper.userData.genesisAuthoredBounds = genesisAuthoredBounds;
      wrapper.userData.appearance = compactAppearanceRecipe(recipe, profile.id);
      wrapper.userData.appearanceFingerprint = appearanceFingerprint(recipe, profile.id);
      this.characterAssetStatus.set(profile.id, wrapper.userData.sourceProvider);
      return wrapper;
    }

    createPhotorealCharacterModel(profile, scale = 1) {
      const rigged = this.createBuiltInRiggedCharacter(profile, scale);
      if (rigged) return rigged;
      const group = this.createAnimeCharacterMesh(profile, scale);
      const wantsRigged = this.state.settings.characterMode !== "portrait";
      const heroMeshes = [];
      const heroDetails = [];
      group.traverse((object) => {
        if (!object.isMesh) return;
        heroMeshes.push(object);
        if (object.userData?.heroDetail || object.userData?.astralOutline || object.material?.userData?.astralOutline) {
          heroDetails.push(object);
        }
      });
      const crowdProxy = this.createCharacterMesh({
        body: profile.body,
        accent: profile.accent,
        scale: 0.96
      });
      crowdProxy.name = `CharacterCrowdLOD:${profile.id}`;
      crowdProxy.visible = false;
      crowdProxy.userData.isCharacterLodProxy = true;
      group.add(crowdProxy);
      const impostor = crowdProxy;
      if (!wantsRigged) heroMeshes.forEach((object) => { object.visible = false; });
      group.userData.visualMode = wantsRigged ? "articulated-pbr-fallback" : "procedural-3d-proxy";
      group.userData.modelTier = wantsRigged ? "hero" : "impostor";
      group.userData.sourceProvider = wantsRigged ? "HH Articulated PBR" : "HH Procedural 3D Proxy";
      group.userData.lodVariants = {
        hero: heroMeshes,
        near: heroMeshes,
        crowd: [crowdProxy],
        impostor: [impostor],
        heroDetails
      };
      return group;
    }

    characterTrackTargetsRoot(track) {
      if (!/\.position$/i.test(String(track?.name || ""))) return false;
      const target = String(track.name)
        .replace(/\.position$/i, "")
        .replace(/^.*[\/\\]/, "")
        .replace(/^.*\[/, "")
        .replace(/\]$/, "");
      const normalized = normalizeBoneName(target);
      const rootAliases = [...HH_HUMANOID_SKELETON.root, ...HH_HUMANOID_SKELETON.hips].map(normalizeBoneName);
      return rootAliases.some((alias) => normalized === alias || normalized.endsWith(alias));
    }

    normalizeCharacterAnimations(animations = []) {
      return animations.map((clip) => {
        const normalizedClip = clip?.clone?.() || clip;
        let strippedTracks = 0;
        normalizedClip?.tracks?.forEach((track) => {
          if (!this.characterTrackTargetsRoot(track) || !track.times?.length || !track.values?.length) return;
          const stride = Math.floor(track.values.length / track.times.length);
          if (stride < 3) return;
          const baseX = track.values[0];
          const baseZ = track.values[2];
          let changed = false;
          for (let offset = 0; offset < track.values.length; offset += stride) {
            if (Math.abs(track.values[offset] - baseX) > 0.0001 || Math.abs(track.values[offset + 2] - baseZ) > 0.0001) changed = true;
            track.values[offset] = baseX;
            track.values[offset + 2] = baseZ;
          }
          if (changed) strippedTracks += 1;
        });
        normalizedClip.userData ||= {};
        normalizedClip.userData.hhInPlaceTracks = strippedTracks;
        return normalizedClip;
      });
    }

    buildCharacterQaReport(scene, animations = [], fileBytes = 0) {
      const report = {
        fileBytes,
        nodes: 0,
        meshes: 0,
        skinnedMeshes: 0,
        triangles: 0,
        bones: 0,
        morphTargets: 0,
        textures: 0,
        maxTextureSize: 0,
        materials: 0,
        animations: animations.length,
        animationSeconds: animations.reduce((total, clip) => total + Number(clip?.duration || 0), 0),
        rootMotionTracks: 0,
        skeletonCoverage: 0,
        lodGroups: 0,
        headVertices: 0,
        faceMorphTargets: 0,
        separateEyeMeshes: 0,
        hairCardMeshes: 0
      };
      const textureSlots = [
        "map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "alphaMap", "emissiveMap",
        "bumpMap", "displacementMap", "lightMap", "envMap", "gradientMap", "matcap",
        "clearcoatMap", "clearcoatNormalMap", "clearcoatRoughnessMap", "sheenColorMap", "sheenRoughnessMap",
        "specularColorMap", "specularIntensityMap", "transmissionMap", "thicknessMap",
        "iridescenceMap", "iridescenceThicknessMap", "anisotropyMap"
      ];
      const textures = new Set();
      const materials = new Set();
      const matchedBones = new Set();
      const faceChannels = new Set();
      animations.forEach((clip) => {
        clip?.tracks?.forEach((track) => {
          if (!this.characterTrackTargetsRoot(track) || !track.times?.length || !track.values?.length) return;
          const stride = Math.floor(track.values.length / track.times.length);
          if (stride < 3) return;
          const baseX = track.values[0];
          const baseZ = track.values[2];
          let movesXZ = false;
          for (let offset = 0; offset < track.values.length && !movesXZ; offset += stride) {
            movesXZ = Math.abs(track.values[offset] - baseX) > 0.0001 || Math.abs(track.values[offset + 2] - baseZ) > 0.0001;
          }
          if (movesXZ) report.rootMotionTracks += 1;
        });
      });
      const skeletonAliases = Object.fromEntries(Object.entries(HH_HUMANOID_SKELETON).map(([slot, aliases]) => [
        slot,
        aliases.map(normalizeBoneName)
      ]));
      scene?.traverse?.((object) => {
        report.nodes += 1;
        if (/^lod[0-3](?:\b|_)/i.test(String(object.name || ""))) report.lodGroups += 1;
        if (object.isBone) {
          report.bones += 1;
          const normalized = normalizeBoneName(object.name);
          Object.entries(skeletonAliases).forEach(([slot, aliases]) => {
            if (aliases.includes(normalized)) matchedBones.add(slot);
          });
        }
        if (!object.isMesh && !object.isSkinnedMesh) return;
        report.meshes += 1;
        if (object.isSkinnedMesh) report.skinnedMeshes += 1;
        const count = object.geometry?.index?.count || object.geometry?.attributes?.position?.count || 0;
        report.triangles += Math.floor(count / 3);
        const vertices = object.geometry?.attributes?.position?.count || 0;
        const identity = `${object.name || ""} ${Array.isArray(object.material) ? object.material.map((material) => material?.name || "").join(" ") : object.material?.name || ""}`.toLowerCase();
        if (/head|face|skin_head|dermis/.test(identity)) report.headVertices += vertices;
        if (/eye|iris|cornea|sclera|tear/.test(identity)) report.separateEyeMeshes += 1;
        if (/hair|groom|brow|lash/.test(identity)) report.hairCardMeshes += 1;
        const morphNames = Object.keys(object.morphTargetDictionary || {});
        report.morphTargets += morphNames.length;
        supportedFacialChannels(object.morphTargetDictionary || {}).forEach((channel) => faceChannels.add(channel));
        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
        objectMaterials.filter(Boolean).forEach((material) => {
          materials.add(material);
          textureSlots.forEach((slot) => {
            const texture = material[slot];
            if (!texture?.isTexture) return;
            textures.add(texture);
            const image = texture.image || texture.source?.data;
            report.maxTextureSize = Math.max(report.maxTextureSize, Number(image?.width || 0), Number(image?.height || 0));
          });
        });
      });
      report.materials = materials.size;
      report.textures = textures.size;
      report.faceMorphTargets = faceChannels.size;
      report.skeletonCoverage = matchedBones.size / Object.keys(HH_HUMANOID_SKELETON).length;
      report.digitalHumanTier = report.headVertices >= 18000 && report.faceMorphTargets >= 52
        ? "web-hero"
        : report.skinnedMeshes && report.bones
          ? "gameplay-rig"
          : "proxy";
      return report;
    }

    registerCharacterRuntime(mesh, profile, runtimeKey = profile.id, role = "hero", animations = []) {
      const normalizedAnimations = this.normalizeCharacterAnimations(animations);
      const runtime = {
        key: runtimeKey,
        mesh,
        profile,
        role,
        source: mesh.userData.sourceProvider || "HH Web Hero",
        motionProfile: mesh.userData.motionProfile || "standard",
        tier: role === "hero" ? "hero" : "near",
        state: "idle",
        previousState: "",
        mixer: null,
        clips: new Map(),
        currentAction: null,
        facialChannels: 0,
        bones: {},
        triangles: 0,
        morphLookup: new Map(),
        lodVariants: mesh.userData?.lodVariants || {},
        qaReport: this.buildCharacterQaReport(mesh, animations),
        savedMorphWeights: new Map(),
        gaitPhase: 0,
        idlePhase: 0,
        motionSpeed: 0,
        motionDirection: 0,
        previousMotionSpeed: 0,
        acceleration: 0,
        yawVelocity: 0,
        blendActions: new Map(),
        blendWeights: new Map(),
        blendSpaceActive: false,
        visualRoot: mesh.userData?.gltfAsset || null,
        visualRootBasePosition: mesh.userData?.gltfAsset?.position?.clone?.() || null,
        footPlants: {
          left: { planted: false, point: null, normal: null, weight: 0 },
          right: { planted: false, point: null, normal: null, weight: 0 }
        },
        layers: {
          locomotion: 0,
          upperBody: 0,
          gaze: 1,
          face: 1,
          breathing: 1,
          hit: 0,
          secondary: 1
        },
        handPoseBones: [],
        handPoseState: "pending",
        allBones: [],
        secondaryBones: [],
        lastLodUpdateAt: 0,
        lastFacialUpdateAt: 0
      };
      runtime.qaReport = { ...runtime.qaReport, ...validateCharacterAsset(runtime.qaReport) };
      const normalizedAliases = Object.fromEntries(Object.entries(HH_HUMANOID_SKELETON).map(([slot, aliases]) => [
        slot,
        aliases.map(normalizeBoneName)
      ]));
      const nativeFaceChannels = new Set();
      mesh.traverse?.((object) => {
        if (object.isBone) {
          runtime.allBones.push(object);
          const boneName = normalizeBoneName(object.name);
          Object.entries(HH_HUMANOID_SKELETON).forEach(([slot, aliases]) => {
            if (!runtime.bones[slot] && normalizedAliases[slot].includes(boneName)) runtime.bones[slot] = object;
          });
          if (/hair|ponytail|braid|cloth|cape|strap|skirt|coat|accessory/.test(boneName)) {
            object.userData ||= {};
            object.userData.hhSecondaryBase ||= {
              x: object.rotation.x,
              y: object.rotation.y,
              z: object.rotation.z
            };
            runtime.secondaryBones.push(object);
          }
          const isFinger = /(?:thumb|index|middle|ring|pinky|little|finger)/.test(boneName);
          const isWrist = normalizedAliases.leftHand.includes(boneName) || normalizedAliases.rightHand.includes(boneName);
          if (isFinger || isWrist) {
            const rawName = String(object.name || "").toLowerCase();
            const digit = /thumb/.test(rawName)
              ? "thumb"
              : /index/.test(rawName)
                ? "index"
                : /middle/.test(rawName)
                  ? "middle"
                  : /ring/.test(rawName)
                    ? "ring"
                    : /pinky|little/.test(rawName)
                      ? "pinky"
                      : "finger";
            runtime.handPoseBones.push({
              bone: object,
              kind: isWrist ? "wrist" : "finger",
              side: /left|(?:^|[._-])l(?:$|[._-])/.test(rawName) ? "left" : "right",
              digit,
              segment: /(?:3|distal|tip)/.test(rawName) ? 3 : /(?:2|intermediate)/.test(rawName) ? 2 : 1
            });
          }
        }
        if (object.isMesh || object.isSkinnedMesh) {
          const count = object.geometry?.index?.count || object.geometry?.attributes?.position?.count || 0;
          runtime.triangles += object.geometry?.index ? Math.floor(count / 3) : Math.floor(count / 3);
          supportedFacialChannels(object.morphTargetDictionary || {}).forEach((channel) => nativeFaceChannels.add(channel));
          if (object.morphTargetDictionary && object.morphTargetInfluences) {
            const lookup = Object.create(null);
            Object.entries(object.morphTargetDictionary).forEach(([name, index]) => {
              lookup[String(name).toLowerCase()] = index;
              lookup[normalizeMorphTargetName(name)] ??= index;
            });
            runtime.morphLookup.set(object, lookup);
          }
          const lodMatch = String(object.name || "").match(/^lod([0-3])(?:\b|_)/i);
          if (lodMatch) {
            const lodTier = ["hero", "near", "crowd", "impostor"][Number(lodMatch[1])];
            runtime.lodVariants[lodTier] ||= [];
            runtime.lodVariants[lodTier].push(object);
          }
        }
      });
      runtime.facialChannels = nativeFaceChannels.size;
      if (normalizedAnimations.length) {
        runtime.animationRoot = mesh.userData?.animationRoot || mesh;
        runtime.mixer = new this.THREE.AnimationMixer(runtime.animationRoot);
        normalizedAnimations.forEach((clip) => runtime.clips.set(String(clip.name || "").toLowerCase(), clip));
      }
      this.captureNaturalRigPose(runtime);
      const restFeet = [runtime.bones.leftFoot, runtime.bones.rightFoot].filter(Boolean);
      runtime.expectedFootHeight = 0.09;
      if (restFeet.length) {
        mesh.updateMatrixWorld(true);
        const restFootY = Math.min(...restFeet.map((foot) => foot.getWorldPosition(new this.THREE.Vector3()).y));
        if (Number.isFinite(restFootY)) {
          runtime.restFootY = restFootY;
          const boneGroundOffset = clamp(runtime.expectedFootHeight - restFootY, 0, 1.4);
          mesh.userData.gameplayGroundOffset = Math.max(Number(mesh.userData.gameplayGroundOffset || 0), boneGroundOffset);
          mesh.userData.groundingSource = "rest-foot-bones";
        }
      }
      mesh.userData.characterRuntime = runtime;
      mesh.userData.lodVariants = runtime.lodVariants;
      this.characterRuntimes.set(runtimeKey, runtime);
      return runtime;
    }

    findCharacterClip(runtime, state) {
      if (!runtime?.clips?.size) return null;
      const aliases = CHARACTER_MOTION_LIBRARY[state] || [state];
      for (const [name, clip] of runtime.clips) {
        if (aliases.some((alias) => name === alias || name.includes(alias))) return clip;
      }
      if (["jump", "land", "dodge", "attack1", "attack2", "attack3", "skill", "ultimate", "hit", "defeated"].includes(state)) {
        return null;
      }
      if (["sprint", "walk", "strafe"].includes(state)) return this.findCharacterClip(runtime, "run");
      if (["fall", "land", "glide"].includes(state)) return this.findCharacterClip(runtime, "jump");
      if (state !== "idle") {
        const idleAliases = CHARACTER_MOTION_LIBRARY.idle;
        for (const [name, clip] of runtime.clips) {
          if (idleAliases.some((alias) => name === alias || name.includes(alias))) return clip;
        }
      }
      return runtime.clips.values().next().value || null;
    }

    playCharacterClip(runtime, state) {
      if (!runtime?.mixer) return false;
      if (runtime.state === state && runtime.currentAction) return true;
      const clip = this.findCharacterClip(runtime, state);
      runtime.previousState = runtime.state;
      runtime.state = state;
      if (!clip) return false;
      const next = runtime.mixer.clipAction(clip);
      if (runtime.currentAction === next) return true;
      const oneShot = ["jump", "land", "dodge", "attack1", "attack2", "attack3", "skill", "ultimate", "hit", "defeated"].includes(state);
      const actionWindowSeconds = this.characterAction?.name === state
        ? Math.max(0.08, this.characterAction.duration / 1000)
        : 0;
      const fittedTimeScale = oneShot && actionWindowSeconds && Number.isFinite(clip.duration)
        ? Math.max(0.05, clip.duration / actionWindowSeconds)
        : 1;
      next.reset();
      next.enabled = true;
      next.setEffectiveTimeScale(fittedTimeScale);
      next.setEffectiveWeight(1);
      if (oneShot) {
        next.setLoop(this.THREE.LoopOnce, 1);
        next.clampWhenFinished = true;
      } else {
        next.setLoop(this.THREE.LoopRepeat, Infinity);
        next.clampWhenFinished = false;
      }
      const locomotionStates = new Set(["idle", "walk", "run", "sprint", "strafe"]);
      const transitionSeconds = state === "dodge" || state.startsWith("attack")
        ? 0.11
        : state === "land"
          ? 0.14
          : locomotionStates.has(state) && locomotionStates.has(runtime.previousState)
            ? 0.18
            : 0.24;
      if (runtime.currentAction) runtime.currentAction.crossFadeTo(next, transitionSeconds, true);
      else next.fadeIn(Math.min(0.16, transitionSeconds));
      next.play();
      runtime.currentAction = next;
      runtime.blendSpaceActive = false;
      runtime.actionTimeScale = fittedTimeScale;
      runtime.transition = {
        from: runtime.previousState,
        to: state,
        startedAt: performance.now(),
        duration: transitionSeconds,
        mode: "inertial-crossfade"
      };
      return true;
    }

    motionBlendPoints(runtime) {
      const declared = this.motionLibraryManifest?.clips || [];
      const fallback = [
        { name: "idle_relaxed", speed: 0, direction: 0, category: "idle" },
        { name: "walk_f", speed: 0.34, direction: 0, category: "locomotion" },
        { name: "run_f", speed: 0.72, direction: 0, category: "locomotion" },
        { name: "sprint_f", speed: 1, direction: 0, category: "locomotion" }
      ];
      const source = declared.some((item) => Number(item.speed) > 0) ? declared : fallback;
      return source.map((item) => ({
        name: String(item.name || "").toLowerCase(),
        speed: clamp(Number(item.speed || 0), 0, 1),
        direction: clamp(Number(item.direction || 0), -180, 180),
        category: String(item.category || "")
      })).filter((item) => runtime?.clips?.has(item.name) && (item.category === "idle" || item.category === "locomotion"));
    }

    updateLocomotionBlendSpace(runtime, speed, directionRadians, dt) {
      if (!runtime?.mixer || runtime.lodSuspended) return false;
      const points = this.motionBlendPoints(runtime);
      if (points.length < 2) return false;
      const direction = this.THREE.MathUtils.radToDeg(directionRadians || 0);
      const angularDistance = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
      const ranked = points.map((point) => {
        const speedDistance = (speed - point.speed) / 0.38;
        const angleDistance = speed < 0.08 || point.speed < 0.08 ? 0 : angularDistance(direction, point.direction) / 82;
        const distance = speedDistance * speedDistance + angleDistance * angleDistance;
        return { ...point, rawWeight: Math.exp(-distance * 2.15) };
      }).sort((a, b) => b.rawWeight - a.rawWeight).slice(0, 4);
      const total = ranked.reduce((sum, item) => sum + item.rawWeight, 0) || 1;
      const targets = new Map(ranked.map((item) => [item.name, item.rawWeight / total]));
      if (!runtime.blendSpaceActive && runtime.currentAction && ![...runtime.blendActions.values()].includes(runtime.currentAction)) {
        runtime.currentAction.fadeOut(0.16);
      }
      runtime.blendSpaceActive = true;
      runtime.idlePhase = Number(runtime.idlePhase || 0) + Math.max(0.001, dt);
      points.forEach((point) => {
        const clip = runtime.clips.get(point.name);
        if (!clip) return;
        let action = runtime.blendActions.get(point.name);
        if (!action) {
          action = runtime.mixer.clipAction(clip);
          action.enabled = true;
          action.setLoop(this.THREE.LoopRepeat, Infinity);
          action.setEffectiveWeight(0);
          action.setEffectiveTimeScale(0);
          action.play();
          runtime.blendActions.set(point.name, action);
          runtime.blendWeights.set(point.name, 0);
        }
        const current = Number(runtime.blendWeights.get(point.name) || 0);
        const target = Number(targets.get(point.name) || 0);
        const next = current + (target - current) * (1 - Math.exp(-Math.max(0.001, dt) * 14));
        runtime.blendWeights.set(point.name, next);
        action.enabled = next > 0.0005;
        action.setEffectiveWeight(next);
        if (action.enabled && Number.isFinite(clip.duration) && clip.duration > 0) {
          const normalizedPhase = ((runtime.gaitPhase || 0) % (Math.PI * 2)) / (Math.PI * 2);
          action.time = point.speed < 0.08
            ? runtime.idlePhase % clip.duration
            : normalizedPhase * clip.duration;
        }
      });
      const dominant = ranked[0];
      runtime.currentAction = runtime.blendActions.get(dominant.name) || runtime.currentAction;
      runtime.state = speed < 0.08 ? "idle" : speed < 0.52 ? "walk" : speed < 0.9 ? "run" : "sprint";
      runtime.blendSpace = {
        speed,
        direction,
        points: ranked.map((item) => ({ name: item.name, weight: Number((item.rawWeight / total).toFixed(3)) })),
        phase: ((runtime.gaitPhase || 0) % (Math.PI * 2)) / (Math.PI * 2),
        mode: "phase-synchronized-rbf"
      };
      return true;
    }

    fadeLocomotionBlend(runtime, dt) {
      runtime?.blendActions?.forEach((action, name) => {
        const current = Number(runtime.blendWeights.get(name) || 0);
        const next = current * Math.exp(-Math.max(0.001, dt) * 18);
        runtime.blendWeights.set(name, next);
        action.setEffectiveWeight(next);
        action.enabled = next > 0.0005;
      });
      if (runtime) runtime.blendSpaceActive = false;
    }

    beginMotionWarp(target, kind, startedAt = performance.now()) {
      const runtime = this.playerMesh?.userData?.characterRuntime;
      if (!runtime?.visualRoot || !runtime.visualRootBasePosition || !target?.position) return false;
      const duration = kind === "ultimate" ? 920 : kind === "skill" ? 680 : 430;
      runtime.motionWarp ||= {};
      runtime.motionWarp.action = {
        target,
        targetId: String(target.userData?.id || target.userData?.type || "target"),
        kind,
        startedAt,
        duration,
        contactPhase: kind === "ultimate" ? 0.42 : kind === "skill" ? 0.36 : 0.33,
        desiredDistance: kind === "ultimate" ? 3.4 : kind === "skill" ? 2.5 : 1.85,
        maxVisualOffset: kind === "ultimate" ? 0.48 : kind === "skill" ? 0.38 : 0.3
      };
      return true;
    }

    applyMotionWarping(runtime, time, dt) {
      if (!runtime?.visualRoot || !runtime.visualRootBasePosition) return;
      runtime.motionWarp ||= {};
      const rootObject = runtime.visualRoot;
      const base = runtime.visualRootBasePosition;
      const action = runtime.motionWarp.action;
      const recoverToBase = () => {
        rootObject.position.lerp(base, 1 - Math.exp(-Math.max(0.001, dt) * 18));
      };
      if (!action?.target?.position || action.target.visible === false || action.target.userData?.defeated) {
        recoverToBase();
        if (action) delete runtime.motionWarp.action;
        return;
      }
      const phase = clamp((time - action.startedAt) / Math.max(1, action.duration), 0, 1);
      if (phase >= 1) {
        recoverToBase();
        if (rootObject.position.distanceToSquared(base) < 0.000004) delete runtime.motionWarp.action;
        return;
      }
      const actorWorld = runtime.mesh.getWorldPosition(new this.THREE.Vector3());
      const targetWorld = action.target.getWorldPosition
        ? action.target.getWorldPosition(new this.THREE.Vector3())
        : action.target.position.clone();
      targetWorld.y = actorWorld.y;
      const direction = targetWorld.sub(actorWorld);
      const distance = direction.length();
      if (distance < 0.0001) {
        recoverToBase();
        return;
      }
      const contact = clamp(action.contactPhase, 0.12, 0.72);
      const rise = clamp(phase / contact, 0, 1);
      const fall = 1 - clamp((phase - contact) / Math.max(0.001, 1 - contact), 0, 1);
      const envelope = (rise * rise * (3 - 2 * rise)) * (fall * fall * (3 - 2 * fall));
      const distanceCorrection = clamp(distance - action.desiredDistance, 0, action.maxVisualOffset) * envelope;
      const worldOffset = direction.normalize().multiplyScalar(distanceCorrection);
      const inverseMeshWorld = runtime.mesh.getWorldQuaternion(new this.THREE.Quaternion()).invert();
      const localOffset = worldOffset.applyQuaternion(inverseMeshWorld);
      const meshScale = runtime.mesh.getWorldScale(new this.THREE.Vector3());
      localOffset.set(
        localOffset.x / Math.max(0.0001, Math.abs(meshScale.x)),
        localOffset.y / Math.max(0.0001, Math.abs(meshScale.y)),
        localOffset.z / Math.max(0.0001, Math.abs(meshScale.z))
      );
      const desired = base.clone().add(localOffset);
      rootObject.position.lerp(desired, 1 - Math.exp(-Math.max(0.001, dt) * 22));
      runtime.motionWarp.phase = phase;
      runtime.motionWarp.contact = contact;
      runtime.motionWarp.visualOffset = Number(distanceCorrection.toFixed(4));
      runtime.motionWarp.hitboxMode = "unchanged-server-authoritative";
    }

    applyAdditiveAnimationLayers(runtime, time, motion, dt) {
      if (!runtime || runtime.lodSuspended) return;
      const THREE = this.THREE;
      const bones = runtime.bones || {};
      const axis = {
        x: new THREE.Vector3(1, 0, 0),
        y: new THREE.Vector3(0, 1, 0),
        z: new THREE.Vector3(0, 0, 1)
      };
      const add = (bone, rotations, weight = 1) => {
        if (!bone || weight <= 0) return;
        const delta = rotations.reduce((quaternion, [name, amount]) => quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis[name], amount)), new THREE.Quaternion());
        const weighted = new THREE.Quaternion().slerp(delta, clamp(weight, 0, 1));
        bone.quaternion.multiply(weighted).normalize();
      };
      const locomotion = ["walk", "run", "sprint", "strafe"].includes(motion);
      const breathing = Math.sin(time * 0.00118) * (motion === "idle" ? 0.012 : 0.004);
      const accelerationLean = clamp(Number(runtime.acceleration || 0) * -0.018, -0.09, 0.09);
      const turnLean = clamp(Number(runtime.yawVelocity || 0) * -0.022, -0.08, 0.08);
      add(bones.spine, [["x", accelerationLean + breathing * 0.24], ["z", turnLean]], 1);
      add(bones.chest, [["x", breathing], ["y", locomotion ? Math.sin(runtime.gaitPhase || 0) * 0.018 : 0], ["z", -turnLean * 0.42]], 1);
      add(bones.head, [["x", -accelerationLean * 0.32], ["z", -turnLean * 0.2]], 1);
      if ((motion === "idle" || motion === "talk") && runtime.relaxedArmOffsets) {
        const postureBlend = (1 - Math.exp(-Math.max(0.001, dt) * 5.5)) * 0.18;
        this.applyCharacterSpaceBoneRotation(runtime, bones.leftUpperArm, runtime.relaxedArmOffsets.left, postureBlend);
        this.applyCharacterSpaceBoneRotation(runtime, bones.rightUpperArm, runtime.relaxedArmOffsets.right, postureBlend);
      }

      const actionPhase = clamp((time - Number(this.characterAction?.startedAt || time)) / Math.max(1, Number(this.characterAction?.duration || 1)), 0, 1);
      const anticipation = Math.sin(clamp(actionPhase / 0.34, 0, 1) * Math.PI * 0.5);
      const recovery = 1 - clamp((actionPhase - 0.58) / 0.42, 0, 1);
      const actionWeight = anticipation * recovery * clamp(Number(this.characterAction?.strength || 0), 0, 1.5);
      if (/^attack/.test(motion) || motion === "skill" || motion === "ultimate") {
        const authoredWeight = this.findCharacterClip(runtime, motion) ? 0.14 : 1;
        const side = motion === "attack2" ? -1 : 1;
        add(bones.chest, [["y", side * 0.16 * actionWeight], ["x", -0.08 * actionWeight]], authoredWeight);
        add(bones.rightShoulder, [["x", -0.5 * actionWeight], ["z", -0.16 * actionWeight]], authoredWeight);
        add(bones.rightUpperArm, [["x", -0.72 * actionWeight], ["y", side * 0.24 * actionWeight]], authoredWeight);
        add(bones.rightForeArm, [["x", -0.34 * actionWeight]], authoredWeight);
        add(bones.leftUpperArm, [["x", -0.18 * actionWeight]], authoredWeight);
        runtime.layers.upperBody = actionWeight;
      } else {
        runtime.layers.upperBody = 0;
      }
      if (motion === "hit") {
        const hit = Math.sin(actionPhase * Math.PI) * clamp(Number(this.characterAction?.strength || 1), 0, 1.4);
        add(bones.spine, [["x", 0.22 * hit], ["z", -0.12 * hit]], 1);
        add(bones.head, [["x", -0.12 * hit], ["y", 0.1 * hit]], 1);
        runtime.layers.hit = hit;
      } else {
        runtime.layers.hit = 0;
      }
      runtime.layers.locomotion = locomotion ? 1 : 0;
      runtime.layers.breathing = motion === "idle" ? 1 : 0.35;
      runtime.layerMode = "additive-post-mixer";
      runtime.layerUpdatedAt = time;
    }

    captureNaturalRigPose(runtime) {
      if (!runtime?.mesh || !Object.keys(runtime.bones || {}).length) return;
      const THREE = this.THREE;
      runtime.mesh.updateMatrixWorld(true);
      const meshWorldQuaternion = runtime.mesh.getWorldQuaternion(new THREE.Quaternion());
      const inverseMeshWorldQuaternion = meshWorldQuaternion.clone().invert();
      const inverseMeshMatrix = runtime.mesh.matrixWorld.clone().invert();
      runtime.rigRest = new Map();
      [...new Set([
        ...(runtime.allBones || []).filter(Boolean),
        ...Object.values(runtime.bones).filter(Boolean),
        ...(runtime.handPoseBones || []).map((entry) => entry.bone).filter(Boolean)
      ])].forEach((bone) => {
        const parentWorld = bone.parent?.getWorldQuaternion?.(new THREE.Quaternion()) || meshWorldQuaternion;
        runtime.rigRest.set(bone, {
          quaternion: bone.quaternion.clone(),
          position: bone.position.clone(),
          parentCharacterQuaternion: inverseMeshWorldQuaternion.clone().multiply(parentWorld)
        });
      });
      const relaxedArmOffset = (upperArm, foreArm) => {
        if (!upperArm || !foreArm) return new THREE.Quaternion();
        const start = upperArm.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverseMeshMatrix);
        const end = foreArm.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverseMeshMatrix);
        const direction = end.sub(start).normalize();
        if (!Number.isFinite(direction.x + direction.y + direction.z)) return new THREE.Quaternion();
        // Keep the authored side and depth while lowering a T-pose into a
        // relaxed A-pose. Models already authored with lowered arms receive
        // only a tiny correction instead of being folded into the torso.
        const downness = direction.dot(new THREE.Vector3(0, -1, 0));
        if (downness > 0.72) return new THREE.Quaternion();
        const side = Math.abs(direction.x) > 0.08 ? Math.sign(direction.x) : 1;
        const desired = new THREE.Vector3(side * 0.22, -0.97, clamp(direction.z, -0.08, 0.08)).normalize();
        return new THREE.Quaternion().setFromUnitVectors(direction, desired);
      };
      runtime.relaxedArmOffsets = {
        left: relaxedArmOffset(runtime.bones.leftUpperArm, runtime.bones.leftForeArm),
        right: relaxedArmOffset(runtime.bones.rightUpperArm, runtime.bones.rightForeArm)
      };
      runtime.rigSolver = "rest-space-quaternion";
    }

    applyNaturalHandPose(runtime, motion = "idle", dt = 0.016) {
      if (!runtime?.handPoseBones?.length) return false;
      if (!runtime.rigRest?.size) this.captureNaturalRigPose(runtime);
      const combat = /^(?:attack|skill|ultimate|parry|dodge|hit)/.test(String(motion || ""));
      const quarantined = Boolean(runtime.motionQuarantined);
      const wristLimit = quarantined ? 0.16 : combat ? 0.72 : 0.2;
      const fingerLimit = quarantined ? 0.14 : combat ? 0.62 : 0.28;
      const response = 1 - Math.exp(-Math.max(0.001, dt) * (quarantined ? 24 : 18));
      let corrected = 0;
      runtime.handPoseBones.forEach(({ bone, kind }) => {
        const rest = runtime.rigRest?.get(bone);
        if (!bone?.quaternion || !rest?.quaternion) return;
        const values = [bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w];
        if (!values.every(Number.isFinite) || bone.quaternion.lengthSq() < 0.000001) {
          bone.quaternion.copy(rest.quaternion);
          corrected += 1;
          return;
        }
        bone.quaternion.normalize();
        const angle = rest.quaternion.angleTo(bone.quaternion);
        const limit = kind === "wrist" ? wristLimit : fingerLimit;
        if (!Number.isFinite(angle) || angle <= limit) return;
        const safe = rest.quaternion.clone()
          .slerp(bone.quaternion, clamp(limit / Math.max(angle, 0.0001), 0, 1))
          .normalize();
        bone.quaternion.slerp(safe, response).normalize();
        corrected += 1;
      });
      runtime.handPoseState = corrected ? "rest-clamped" : "natural";
      runtime.handPoseCorrections = corrected;
      runtime.wristDeviation = runtime.handPoseBones
        .filter((entry) => entry.kind === "wrist")
        .reduce((maximum, entry) => {
          const rest = runtime.rigRest?.get(entry.bone);
          const angle = rest?.quaternion?.angleTo?.(entry.bone.quaternion);
          return Number.isFinite(angle) ? Math.max(maximum, angle) : maximum;
        }, 0);
      return corrected > 0;
    }

    applyCharacterSpaceBoneRotation(runtime, bone, characterOffset, blend) {
      const rest = runtime?.rigRest?.get(bone);
      if (!bone || !rest || !characterOffset) return;
      const parent = rest.parentCharacterQuaternion;
      const localDelta = parent.clone().invert().multiply(characterOffset).multiply(parent);
      const target = localDelta.multiply(rest.quaternion.clone()).normalize();
      bone.quaternion.slerp(target, blend).normalize();
    }

    aimCharacterBoneSegment(runtime, bone, child, characterDirection, weight = 1) {
      const THREE = this.THREE;
      if (!runtime?.mesh || !bone || !child || !characterDirection || weight <= 0) return false;
      runtime.validSolverScratch ||= {
        start: new THREE.Vector3(),
        end: new THREE.Vector3(),
        currentDirection: new THREE.Vector3(),
        desiredWorld: new THREE.Vector3(),
        characterWorld: new THREE.Quaternion(),
        deltaWorld: new THREE.Quaternion(),
        boneWorld: new THREE.Quaternion(),
        parentWorld: new THREE.Quaternion(),
        targetWorld: new THREE.Quaternion(),
        targetLocal: new THREE.Quaternion(),
        directions: Array.from({ length: 8 }, () => new THREE.Vector3())
      };
      const scratch = runtime.validSolverScratch;
      runtime.mesh.updateMatrixWorld(true);
      bone.getWorldPosition(scratch.start);
      child.getWorldPosition(scratch.end);
      const currentDirection = scratch.currentDirection.subVectors(scratch.end, scratch.start);
      if (currentDirection.lengthSq() < 0.000001) return false;
      currentDirection.normalize();
      runtime.mesh.getWorldQuaternion(scratch.characterWorld);
      scratch.desiredWorld.copy(characterDirection).normalize().applyQuaternion(scratch.characterWorld);
      scratch.deltaWorld.setFromUnitVectors(currentDirection, scratch.desiredWorld);
      bone.getWorldQuaternion(scratch.boneWorld);
      scratch.targetWorld.copy(scratch.deltaWorld).multiply(scratch.boneWorld).normalize();
      if (bone.parent?.getWorldQuaternion) bone.parent.getWorldQuaternion(scratch.parentWorld);
      else scratch.parentWorld.copy(scratch.characterWorld);
      scratch.targetLocal.copy(scratch.parentWorld).invert().multiply(scratch.targetWorld).normalize();
      bone.quaternion.slerp(scratch.targetLocal, clamp(weight, 0, 1)).normalize();
      runtime.mesh.updateMatrixWorld(true);
      return true;
    }

    applyVerifiedRestPoseMotion(runtime, time, motion = "idle") {
      if (!runtime?.rigRest?.size || runtime.lodSuspended) return false;
      const THREE = this.THREE;
      runtime.rigRest.forEach((rest, bone) => {
        bone.position.copy(rest.position);
        bone.quaternion.copy(rest.quaternion);
      });
      runtime.mesh.updateMatrixWorld(true);
      const bones = runtime.bones || {};
      runtime.validSolverScratch ||= {
        start: new THREE.Vector3(), end: new THREE.Vector3(), currentDirection: new THREE.Vector3(), desiredWorld: new THREE.Vector3(),
        characterWorld: new THREE.Quaternion(), deltaWorld: new THREE.Quaternion(), boneWorld: new THREE.Quaternion(),
        parentWorld: new THREE.Quaternion(), targetWorld: new THREE.Quaternion(), targetLocal: new THREE.Quaternion(),
        directions: Array.from({ length: 8 }, () => new THREE.Vector3())
      };
      const directions = runtime.validSolverScratch.directions;
      const locomotion = ["walk", "run", "sprint", "strafe"].includes(motion);
      const cadence = motion === "sprint" ? 10.2 : motion === "run" || motion === "strafe" ? 7.8 : 4.9;
      const gait = locomotion ? Math.sin(time * 0.001 * cadence) : 0;
      const stride = locomotion ? gait * (motion === "sprint" ? 0.5 : motion === "run" ? 0.36 : 0.22) : 0;
      const armSwing = locomotion ? -stride * 0.72 : 0;
      const leftUpperArm = directions[0].set(0.18, -0.975, 0.035 + armSwing).normalize();
      const rightUpperArm = directions[1].set(-0.18, -0.975, 0.035 - armSwing).normalize();
      const leftForeArm = directions[2].set(0.07, -0.992, 0.08 + armSwing * 0.24).normalize();
      const rightForeArm = directions[3].set(-0.07, -0.992, 0.08 - armSwing * 0.24).normalize();
      this.aimCharacterBoneSegment(runtime, bones.leftUpperArm, bones.leftForeArm, leftUpperArm, 1);
      this.aimCharacterBoneSegment(runtime, bones.rightUpperArm, bones.rightForeArm, rightUpperArm, 1);
      this.aimCharacterBoneSegment(runtime, bones.leftForeArm, bones.leftHand, leftForeArm, 0.92);
      this.aimCharacterBoneSegment(runtime, bones.rightForeArm, bones.rightHand, rightForeArm, 0.92);

      if (locomotion) {
        const leftThigh = directions[4].set(0.015, -Math.cos(stride), Math.sin(stride)).normalize();
        const rightThigh = directions[5].set(-0.015, -Math.cos(stride), -Math.sin(stride)).normalize();
        const leftKnee = Math.max(0, -gait) * (motion === "sprint" ? 0.42 : 0.28);
        const rightKnee = Math.max(0, gait) * (motion === "sprint" ? 0.42 : 0.28);
        this.aimCharacterBoneSegment(runtime, bones.leftUpLeg, bones.leftLeg, leftThigh, 0.9);
        this.aimCharacterBoneSegment(runtime, bones.rightUpLeg, bones.rightLeg, rightThigh, 0.9);
        this.aimCharacterBoneSegment(runtime, bones.leftLeg, bones.leftFoot, directions[6].set(0, -Math.cos(leftKnee), -Math.sin(leftKnee)), 0.82);
        this.aimCharacterBoneSegment(runtime, bones.rightLeg, bones.rightFoot, directions[7].set(0, -Math.cos(rightKnee), -Math.sin(rightKnee)), 0.82);
      }

      const chestRest = runtime.rigRest.get(bones.chest);
      if (chestRest && bones.chest && motion === "idle") {
        const breath = Math.sin(time * 0.00118) * 0.0014;
        bones.chest.position.copy(chestRest.position).multiplyScalar(1 + breath);
      }
      runtime.mesh.updateMatrixWorld(true);
      runtime.state = motion;
      runtime.motionSource = "verified-rest-space-procedural";
      runtime.proceduralRig = "valid-world-direction-solver";
      return true;
    }

    applyProceduralRigMotion(runtime, time, motion = "idle", dt = 0.016) {
      if (!runtime || runtime.mixer || runtime.lodSuspended) return false;
      const bones = runtime.bones || {};
      const required = [bones.leftUpperArm, bones.rightUpperArm, bones.leftUpLeg, bones.rightUpLeg].filter(Boolean);
      if (required.length < 4) return false;
      if (!runtime.rigRest?.size) this.captureNaturalRigPose(runtime);
      const THREE = this.THREE;
      const blend = 1 - Math.exp(-Math.max(0.001, dt) * (motion === "idle" ? 5.5 : 11.5));
      const axis = {
        x: new THREE.Vector3(1, 0, 0),
        y: new THREE.Vector3(0, 1, 0),
        z: new THREE.Vector3(0, 0, 1)
      };
      const turn = (name, amount) => new THREE.Quaternion().setFromAxisAngle(axis[name], amount);
      const combine = (...rotations) => rotations.filter(Boolean).reduce((result, rotation) => result.multiply(rotation), new THREE.Quaternion());
      const pose = (bone, ...rotations) => this.applyCharacterSpaceBoneRotation(runtime, bone, combine(...rotations), blend);
      const locomotion = ["walk", "run", "sprint", "strafe", "climb", "swim"].includes(motion);
      const cadence = motion === "sprint" ? 10.8 : motion === "run" || motion === "strafe" ? 8.2 : motion === "walk" ? 5.1 : 1.15;
      const gait = Math.sin(time * 0.001 * cadence);
      let stride = locomotion ? gait * (motion === "sprint" ? 0.74 : motion === "walk" ? 0.34 : 0.52) : 0;
      let leftArmSwing = -stride * 0.72;
      let rightArmSwing = stride * 0.72;
      let leftLegSwing = stride;
      let rightLegSwing = -stride;
      let leftKnee = locomotion ? Math.max(0, -gait) * (motion === "sprint" ? 0.82 : 0.56) : 0.035;
      let rightKnee = locomotion ? Math.max(0, gait) * (motion === "sprint" ? 0.82 : 0.56) : 0.035;
      let torsoPitch = motion === "sprint" ? -0.12 : motion === "run" ? -0.055 : 0;
      let torsoRoll = motion === "strafe" ? gait * 0.065 : locomotion ? gait * 0.018 : Math.sin(time * 0.00072) * 0.009;
      let torsoYaw = locomotion ? gait * (motion === "walk" ? 0.055 : 0.038) : Math.sin(time * 0.00047) * 0.006;
      let armRelaxLeft = runtime.relaxedArmOffsets?.left;
      let armRelaxRight = runtime.relaxedArmOffsets?.right;
      let leftForeArmBend = 0.09;
      let rightForeArmBend = 0.09;
      let leftArmYaw = 0;
      let rightArmYaw = 0;
      let leftArmRoll = 0;
      let rightArmRoll = 0;
      const swordCombat = /^(?:attack\d|sword)/.test(motion);
      const rifleCombat = /^rifle/.test(motion);
      const martialCombat = /^(?:punch|kick|martial)/.test(motion);
      if (motion === "jump") {
        leftLegSwing = -0.34; rightLegSwing = 0.18; leftKnee = 0.46; rightKnee = 0.24;
        leftArmSwing = -0.56; rightArmSwing = -0.56; torsoPitch = -0.08;
      } else if (motion === "fall") {
        leftLegSwing = 0.16; rightLegSwing = -0.16; leftKnee = 0.24; rightKnee = 0.24;
        leftArmSwing = 0.16; rightArmSwing = -0.16; torsoPitch = 0.1;
      } else if (motion === "glide") {
        armRelaxLeft = null; armRelaxRight = null;
        leftArmSwing = 0.05; rightArmSwing = -0.05; leftLegSwing = 0.14; rightLegSwing = -0.14;
        torsoPitch = 0.12;
      } else if (motion === "climb") {
        leftArmSwing = gait * 0.82 - 0.52; rightArmSwing = -gait * 0.82 - 0.52;
        leftLegSwing = -gait * 0.42; rightLegSwing = gait * 0.42; leftKnee = Math.max(0, gait) * 0.72; rightKnee = Math.max(0, -gait) * 0.72;
      } else if (motion === "swim") {
        armRelaxLeft = null; armRelaxRight = null;
        leftArmSwing = gait * 1.05; rightArmSwing = -gait * 1.05; leftLegSwing = gait * 0.3; rightLegSwing = -gait * 0.3;
        torsoPitch = 0.34;
      } else if (rifleCombat) {
        armRelaxLeft = null; armRelaxRight = null;
        leftArmSwing = -1.02; rightArmSwing = -1.08;
        leftForeArmBend = 1.06; rightForeArmBend = 0.72;
        leftArmYaw = 0.22; rightArmYaw = -0.12;
        leftArmRoll = -0.12; rightArmRoll = 0.08;
        leftLegSwing = -0.08; rightLegSwing = 0.12; leftKnee = 0.14; rightKnee = 0.08;
        torsoPitch = -0.055;
        torsoYaw = motion === "rifleBurst" || motion === "rifleUltimate" ? Math.sin(time * 0.036) * 0.035 : -0.018;
      } else if (martialCombat) {
        armRelaxLeft = null; armRelaxRight = null;
        leftForeArmBend = 0.82; rightForeArmBend = 0.88;
        leftLegSwing = -0.12; rightLegSwing = 0.18; leftKnee = 0.22; rightKnee = 0.1;
        torsoPitch = -0.08;
        if (motion === "punch1") {
          leftArmSwing = -0.42; rightArmSwing = -1.34; rightArmYaw = -0.16; torsoYaw = -0.18;
        } else if (motion === "punch2") {
          leftArmSwing = -1.3; rightArmSwing = -0.46; leftArmYaw = 0.16; torsoYaw = 0.18;
        } else if (motion === "kick1") {
          leftArmSwing = -0.68; rightArmSwing = -0.64; rightLegSwing = -0.92; rightKnee = 0.18; torsoRoll = -0.16;
        } else {
          leftArmSwing = -1.08; rightArmSwing = -1.12; leftArmYaw = 0.2; rightArmYaw = -0.2;
          torsoPitch = -0.16; torsoRoll = motion === "martialUltimate" ? Math.sin(time * 0.018) * 0.12 : 0.08;
        }
      } else if (swordCombat || motion === "skill") {
        leftArmSwing = motion === "attack2" ? 0.42 : -0.28;
        rightArmSwing = motion === "attack3" || motion === "swordUltimate" ? -1.22 : -0.86;
        leftForeArmBend = 0.32; rightForeArmBend = motion === "swordSkill" ? 0.52 : 0.36;
        leftLegSwing = -0.12; rightLegSwing = 0.18; leftKnee = 0.18; rightKnee = 0.08;
        torsoPitch = -0.1; torsoRoll = motion === "attack2" ? -0.18 : 0.16;
      } else if (motion === "ultimate") {
        leftArmSwing = -1.08; rightArmSwing = -1.08; leftLegSwing = -0.08; rightLegSwing = 0.08; torsoPitch = -0.14;
      } else if (motion === "hit") {
        leftArmSwing = 0.34; rightArmSwing = 0.22; leftKnee = 0.14; rightKnee = 0.14; torsoPitch = 0.24; torsoRoll = -0.12;
      } else if (motion === "defeated") {
        leftArmSwing = 0.72; rightArmSwing = 0.58; leftLegSwing = -0.36; rightLegSwing = 0.3; torsoPitch = 1.15; torsoRoll = 0.22;
      }
      const breathing = Math.sin(time * 0.00125) * (motion === "idle" ? 0.025 : 0.009);
      const shoulderBreath = motion === "idle" ? breathing * 0.36 : 0;
      const shoulderCounter = locomotion ? gait * 0.026 : Math.sin(time * 0.00063) * 0.006;
      pose(bones.leftShoulder, turn("x", shoulderBreath), turn("z", shoulderCounter));
      pose(bones.rightShoulder, turn("x", shoulderBreath), turn("z", -shoulderCounter));
      pose(bones.leftUpperArm, turn("x", leftArmSwing + breathing), turn("y", leftArmYaw), turn("z", leftArmRoll), armRelaxLeft);
      pose(bones.rightUpperArm, turn("x", rightArmSwing - breathing), turn("y", rightArmYaw), turn("z", rightArmRoll), armRelaxRight);
      pose(bones.leftForeArm, turn("x", leftForeArmBend + Math.max(0, -leftArmSwing) * 0.18), turn("z", -0.025));
      pose(bones.rightForeArm, turn("x", rightForeArmBend + Math.max(0, -rightArmSwing) * 0.18), turn("z", 0.025));
      pose(bones.leftUpLeg, turn("x", leftLegSwing));
      pose(bones.rightUpLeg, turn("x", rightLegSwing));
      pose(bones.leftLeg, turn("x", leftKnee));
      pose(bones.rightLeg, turn("x", rightKnee));
      pose(bones.leftFoot, turn("x", locomotion ? -leftLegSwing * 0.22 - leftKnee * 0.16 : 0));
      pose(bones.rightFoot, turn("x", locomotion ? -rightLegSwing * 0.22 - rightKnee * 0.16 : 0));
      pose(bones.hips, turn("y", -torsoYaw * 0.58), turn("z", locomotion ? -gait * 0.028 : 0));
      pose(bones.spine, turn("x", torsoPitch + breathing * 0.22), turn("y", torsoYaw), turn("z", torsoRoll));
      pose(bones.chest, turn("x", breathing * 0.42), turn("y", torsoYaw * 0.32), turn("z", -torsoRoll * 0.42));
      const facePerformance = runtime.mesh.userData?.facePerformance;
      const gazeFollowX = Number(facePerformance?.saccadeX || 0) * 0.72;
      const gazeFollowY = Number(facePerformance?.saccadeY || 0) * 0.48;
      pose(bones.neck, turn("y", Math.sin(time * 0.00053) * 0.018 + gazeFollowX * 0.22));
      pose(
        bones.head,
        turn("y", Math.sin(time * 0.00055) * 0.045 + gazeFollowX),
        turn("x", Math.sin(time * 0.0008) * 0.012 - torsoPitch * 0.14 - gazeFollowY)
      );
      runtime.state = motion;
      runtime.proceduralRig = "rest-space-quaternion";
      return true;
    }

    setCharacterAction(name, duration = 420, strength = 1) {
      const startedAt = performance.now();
      const safeDuration = Math.max(80, Number(duration || 0));
      this.characterAction = {
        name: CHARACTER_MOTION_LIBRARY[name] ? name : "",
        startedAt,
        duration: safeDuration,
        until: startedAt + safeDuration,
        strength: clamp(strength, 0, 2)
      };
    }

    resolveCharacterMotion(input, sprinting, time) {
      if (this.state.player.health <= 0) return "defeated";
      if (this.characterAction.name && time < this.characterAction.until) return this.characterAction.name;
      if (this.characterLandAt && time - this.characterLandAt < 280) return "land";
      if (this.isClimbing) return "climb";
      if (this.isSwimming) return "swim";
      if (this.dodgeUntil && time < this.dodgeUntil) return "dodge";
      if (!this.isGrounded) return this.gliding ? "glide" : this.verticalVelocity > 0.8 ? "jump" : "fall";
      if (input?.active) {
        if (this.lockedTargetId && Math.abs(input.x) > Math.abs(input.z) * 1.25) return "strafe";
        if ((input.magnitude || 1) < 0.56) return "walk";
        return sprinting ? "sprint" : "run";
      }
      return "idle";
    }

    applyFaceBlendshapes(mesh, values = {}) {
      if (!mesh || !this.state.settings.facialAnimation) return 0;
      let applied = 0;
      const runtime = mesh.userData?.characterRuntime;
      mesh.traverse?.((object) => {
        const dictionary = object.morphTargetDictionary;
        const influences = object.morphTargetInfluences;
        if (!dictionary || !influences) return;
        let morphLookup = runtime?.morphLookup?.get(object) || object.userData?.hhMorphLookup;
        if (!morphLookup) {
          morphLookup = Object.create(null);
          Object.entries(dictionary).forEach(([name, index]) => {
            morphLookup[String(name).toLowerCase()] = index;
            morphLookup[normalizeMorphTargetName(name)] ??= index;
          });
          object.userData ||= {};
          object.userData.hhMorphLookup = morphLookup;
          runtime?.morphLookup?.set(object, morphLookup);
        }
        Object.entries(values).forEach(([name, raw]) => {
          const aliases = facialMorphAliases(name);
          const standardIndex = [name, `ARKit_${name}`, `AR_${name}`, name.replace(/left$/i, "_L").replace(/right$/i, "_R")]
            .map((alias) => morphLookup[String(alias).toLowerCase()] ?? morphLookup[normalizeMorphTargetName(alias)])
            .find(Number.isInteger);
          const compound = FACIAL_COMPOUND_ALIASES[name] || [];
          const indices = Number.isInteger(standardIndex)
            ? [standardIndex]
            : compound.length
              ? compound.map((alias) => morphLookup[String(alias).toLowerCase()] ?? morphLookup[normalizeMorphTargetName(alias)]).filter(Number.isInteger)
              : aliases.map((alias) => morphLookup[String(alias).toLowerCase()] ?? morphLookup[normalizeMorphTargetName(alias)]).filter(Number.isInteger).slice(0, 1);
          [...new Set(indices)].forEach((index) => {
            if (index >= influences.length) return;
            influences[index] += (clamp(raw, 0, 1) - influences[index]) * 0.42;
            applied += 1;
          });
        });
      });
      return applied;
    }

    resetCharacterFace(mesh, { morphs = true } = {}) {
      if (!mesh) return;
      const faceChannels = new Set(MEDIAPIPE_FACE_CHANNELS.flatMap((channel) => facialMorphAliases(channel)).map(normalizeMorphTargetName));
      if (morphs) {
        mesh.traverse?.((object) => {
          const dictionary = object.morphTargetDictionary;
          const influences = object.morphTargetInfluences;
          if (!dictionary || !influences) return;
          Object.entries(dictionary).forEach(([name, index]) => {
            const normalized = normalizeMorphTargetName(name);
            if (faceChannels.has(normalized) && Number.isInteger(index) && index < influences.length) influences[index] = 0;
          });
        });
      }
      const parts = mesh.userData?.parts;
      parts?.eyelids?.forEach((lid) => {
        lid.scale.y = lid.userData.baseScaleY || 0.01;
        lid.visible = false;
      });
      parts?.eyes?.forEach((eye) => {
        if (eye.userData.baseScale) eye.scale.copy(eye.userData.baseScale);
        const iris = eye.userData.iris;
        if (iris) {
          iris.position.x = 0;
          iris.position.y = 0;
        }
        const pupil = eye.userData.pupil;
          if (pupil) pupil.scale.setScalar(pupil.userData.baseScale || 1);
      });
      const runtime = mesh.userData?.characterRuntime;
      [runtime?.bones?.jaw, runtime?.bones?.leftEye, runtime?.bones?.rightEye].filter(Boolean).forEach((bone) => {
        const base = bone.userData?.hhFaceBase;
        if (base) bone.rotation.set(base.x, base.y, base.z);
      });
      delete mesh.userData.facePerformance;
    }

    applyBoneFacialFallback(mesh, values = {}, strength = 0.32) {
      const runtime = mesh?.userData?.characterRuntime;
      if (!runtime) return;
      const jaw = runtime.bones?.jaw;
      const leftEye = runtime.bones?.leftEye;
      const rightEye = runtime.bones?.rightEye;
      const dampBone = (bone, targets) => {
        if (!bone) return;
        bone.userData ||= {};
        bone.userData.hhFaceBase ||= { x: bone.rotation.x, y: bone.rotation.y, z: bone.rotation.z };
        const base = bone.userData.hhFaceBase;
        bone.rotation.x += ((base.x + (targets.x || 0)) - bone.rotation.x) * strength;
        bone.rotation.y += ((base.y + (targets.y || 0)) - bone.rotation.y) * strength;
        bone.rotation.z += ((base.z + (targets.z || 0)) - bone.rotation.z) * strength;
      };
      dampBone(jaw, {
        x: clamp((values.jawOpen || 0) - (values.mouthClose || 0) * 0.45, 0, 1) * 0.34,
        y: ((values.jawLeft || 0) - (values.jawRight || 0)) * 0.08
      });
      const lookX = ((values.eyeLookDownLeft || 0) + (values.eyeLookDownRight || 0)
        - (values.eyeLookUpLeft || 0) - (values.eyeLookUpRight || 0)) * 0.18;
      const leftLookY = ((values.eyeLookOutLeft || 0) - (values.eyeLookInLeft || 0)) * 0.16;
      const rightLookY = ((values.eyeLookInRight || 0) - (values.eyeLookOutRight || 0)) * 0.16;
      dampBone(leftEye, { x: lookX, y: leftLookY });
      dampBone(rightEye, { x: lookX, y: rightLookY });
      runtime.faceFallback = {
        driver: runtime.facialChannels ? "native-morph" : jaw || leftEye || rightEye ? "bone-assisted" : "head-rig-only",
        channels: 52,
        updatedAt: performance.now()
      };
    }

    applyProceduralFacialPerformance(mesh, time, motion) {
      if (!mesh || !this.state.settings.facialAnimation) return;
      const parts = mesh.userData?.parts;
      const runtime = mesh.userData?.characterRuntime;
      const updateInterval = 1000 / Math.max(1, runtime?.updateHz || 60);
      if (!this.genesisActive && runtime && time - runtime.lastFacialUpdateAt < updateInterval) return;
      if (runtime) runtime.lastFacialUpdateAt = time;
      const faceState = mesh.userData.facePerformance ||= {
        nextBlinkAt: time + 1800 + Math.random() * 2400,
        blinkStartedAt: 0,
        nextSaccadeAt: time + 500,
        saccadeX: 0,
        saccadeY: 0,
        saccadeTargetX: 0,
        saccadeTargetY: 0,
        blinkEyeDelay: (Math.random() - 0.5) * 14
      };
      const pilotFresh = this.facePilot.status === "running" && time - this.facePilot.lastResultAt < 320;
      const pilot = pilotFresh ? this.facePilot.blendshapes : null;
      const previewFresh = this.facePreview?.values && time < this.facePreview.until;
      const talkVisemeNames = ["A", "E", "O", "MBP", "I", "U", "L"];
      const talkIndex = Math.floor(time / 145);
      const talkPhase = (time % 145) / 145;
      const coarticulationRaw = clamp((talkPhase - 0.58) / 0.42, 0, 1);
      const coarticulation = coarticulationRaw * coarticulationRaw * (3 - 2 * coarticulationRaw);
      const mixChannels = (from = {}, to = {}, amount = 0) => Object.fromEntries(
        [...new Set([...Object.keys(from), ...Object.keys(to)])].map((channel) => [
          channel,
          (Number(from[channel] || 0) * (1 - amount)) + (Number(to[channel] || 0) * amount)
        ])
      );
      const talkViseme = motion === "talk"
        ? mixChannels(
          CHARACTER_VISEMES[talkVisemeNames[talkIndex % talkVisemeNames.length]],
          CHARACTER_VISEMES[talkVisemeNames[(talkIndex + 1) % talkVisemeNames.length]],
          coarticulation
        )
        : null;
      const externalDrivenFace = pilot || (previewFresh ? this.facePreview.values : null);
      const drivenFace = externalDrivenFace || talkViseme;
      const lowHealth = 1 - clamp(this.state.player.health / Math.max(1, this.state.player.maxHealth), 0, 1);
      if (!externalDrivenFace && time >= faceState.nextBlinkAt && !faceState.blinkStartedAt) {
        faceState.blinkStartedAt = time;
        faceState.nextBlinkAt = time + 1900 + Math.random() * 4200;
      }
      const blinkElapsed = faceState.blinkStartedAt ? time - faceState.blinkStartedAt : -1;
      const blinkCurve = (elapsed, delay = 0) => {
        const local = elapsed - delay;
        return local >= 0 && local < 180 ? Math.sin((local / 180) * Math.PI) : 0;
      };
      const blinkLeft = externalDrivenFace ? externalDrivenFace.eyeBlinkLeft || 0 : blinkCurve(blinkElapsed, 0);
      const blinkRight = externalDrivenFace ? externalDrivenFace.eyeBlinkRight || 0 : blinkCurve(blinkElapsed, faceState.blinkEyeDelay || 0);
      if (blinkElapsed >= 180) faceState.blinkStartedAt = 0;
      const smile = drivenFace
        ? ((drivenFace.mouthSmileLeft || 0) + (drivenFace.mouthSmileRight || 0)) * 0.5
        : motion === "idle" ? 0.018 : 0;
      const pain = motion === "hit" || motion === "defeated" ? 0.9 : lowHealth * 0.28;
      const jawOpen = drivenFace?.jawOpen || (["skill", "ultimate"].includes(motion) ? 0.26 : 0);
      if (time >= faceState.nextSaccadeAt) {
        faceState.nextSaccadeAt = time + 420 + Math.random() * 1900;
        faceState.saccadeTargetX = (Math.random() - 0.5) * 0.01;
        faceState.saccadeTargetY = (Math.random() - 0.5) * 0.006;
        if (!externalDrivenFace && !faceState.blinkStartedAt && Math.random() < 0.28) faceState.blinkStartedAt = time;
      }
      if (motion === "talk" && faceState.lastTalkIndex !== talkIndex) {
        if (talkIndex % talkVisemeNames.length === 0 && !faceState.blinkStartedAt) faceState.blinkStartedAt = time;
        faceState.lastTalkIndex = talkIndex;
      }
      // Eyes jump quickly but not instantaneously; the small head follow keeps
      // them alive without the robotic random-teleport look.
      faceState.saccadeX += (faceState.saccadeTargetX - faceState.saccadeX) * 0.24;
      faceState.saccadeY += (faceState.saccadeTargetY - faceState.saccadeY) * 0.2;
      const gazeX = clamp(Math.abs(faceState.saccadeX) * 28, 0, 0.48);
      const gazeY = clamp(Math.abs(faceState.saccadeY) * 34, 0, 0.4);
      const passiveGaze = externalDrivenFace ? {} : {
        eyeLookOutLeft: faceState.saccadeX < 0 ? gazeX : 0,
        eyeLookInRight: faceState.saccadeX < 0 ? gazeX : 0,
        eyeLookInLeft: faceState.saccadeX > 0 ? gazeX : 0,
        eyeLookOutRight: faceState.saccadeX > 0 ? gazeX : 0,
        eyeLookUpLeft: faceState.saccadeY > 0 ? gazeY : 0,
        eyeLookUpRight: faceState.saccadeY > 0 ? gazeY : 0,
        eyeLookDownLeft: faceState.saccadeY < 0 ? gazeY : 0,
        eyeLookDownRight: faceState.saccadeY < 0 ? gazeY : 0
      };
      const neutralFace = Object.fromEntries(MEDIAPIPE_FACE_CHANNELS.map((channel) => [channel, 0]));
      const passiveExpression = {
        eyeBlinkLeft: blinkLeft,
        eyeBlinkRight: blinkRight,
        mouthSmileLeft: smile + 0.006,
        mouthSmileRight: smile,
        cheekSquintLeft: smile * 0.34,
        cheekSquintRight: smile * 0.32,
        mouthDimpleLeft: motion === "idle" ? 0.012 : 0,
        mouthDimpleRight: motion === "idle" ? 0.008 : 0,
        mouthPressLeft: motion === "idle" ? 0.015 : 0,
        mouthPressRight: motion === "idle" ? 0.013 : 0,
        jawOpen,
        browDownLeft: pain,
        browDownRight: pain,
        browInnerUp: motion === "idle" ? 0.025 + Math.sin(time * 0.00046) * 0.018 : 0
      };
      const faceValues = {
        ...neutralFace,
        ...passiveGaze,
        ...passiveExpression,
        ...(drivenFace || {})
      };
      const wrinkleTension = clamp(Math.max(
        faceValues.browDownLeft || 0,
        faceValues.browDownRight || 0,
        faceValues.noseSneerLeft || 0,
        faceValues.noseSneerRight || 0,
        (faceValues.mouthSmileLeft || 0) * 0.55,
        (faceValues.mouthSmileRight || 0) * 0.55
      ), 0, 1);
      faceState.wrinkleTension = Number(faceState.wrinkleTension || 0)
        + (wrinkleTension - Number(faceState.wrinkleTension || 0)) * 0.28;
      this.applyFaceBlendshapes(mesh, faceValues);
      this.applyBoneFacialFallback(mesh, faceValues);
      if (!parts?.eyes || !parts?.mouth) return;
      parts.eyes.forEach((eye, index) => {
        const pilotBlink = index === 0 ? faceValues.eyeBlinkLeft : faceValues.eyeBlinkRight;
        const value = externalDrivenFace ? pilotBlink || 0 : index === 0 ? blinkLeft : blinkRight;
        const lid = parts.eyelids?.[index];
        if (lid && this.state.settings.eyePerformance) {
          lid.scale.y += ((0.01 + value * 0.92) - lid.scale.y) * 0.58;
          lid.visible = value > 0.012;
        }
        const iris = eye.userData.iris;
        if (iris && this.state.settings.eyePerformance) {
          iris.position.x += (faceState.saccadeX - iris.position.x) * 0.18;
          iris.position.y += (faceState.saccadeY - iris.position.y) * 0.18;
        }
        const pupil = eye.userData.pupil;
        if (pupil) {
          const lightLevel = clamp(0.72 + Math.sin(this.state.worldTime / 24 * Math.PI * 2) * 0.22, 0.4, 1);
          const baseScale = pupil.userData.baseScale || 1;
          pupil.scale.setScalar(baseScale * (1.12 - lightLevel * 0.22));
        }
      });
      const baseMouthY = mesh.userData.appearance?.morphs?.lowerLip ? 0.2 : 0.18;
      parts.mouth.scale.y += ((baseMouthY + jawOpen * 0.85 + pain * 0.18) - parts.mouth.scale.y) * 0.35;
      parts.mouth.rotation.z += (((faceValues.mouthSmileRight || smile) - (faceValues.mouthSmileLeft || smile)) * 0.12 - parts.mouth.rotation.z) * 0.25;
      parts.leftBrow.rotation.z += ((-0.08 - pain * 0.22) - parts.leftBrow.rotation.z) * 0.25;
      parts.rightBrow.rotation.z += ((0.08 + pain * 0.22) - parts.rightBrow.rotation.z) * 0.25;
    }

    restoreCharacterMaterialState(mesh, amount = 1) {
      if (!mesh) return;
      mesh.traverse?.((object) => {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => {
          const baseline = material.userData || {};
          if ("roughness" in material && Number.isFinite(baseline.baseRoughness)) {
            material.roughness += (baseline.baseRoughness - material.roughness) * amount;
          }
          if ("clearcoat" in material && Number.isFinite(baseline.baseClearcoat)) {
            material.clearcoat += (baseline.baseClearcoat - material.clearcoat) * amount;
          }
          if ("emissiveIntensity" in material && Number.isFinite(baseline.baseEmissiveIntensity)) {
            material.emissiveIntensity += (baseline.baseEmissiveIntensity - material.emissiveIntensity) * amount;
          }
          if (material.color && baseline.baseColor) {
            material.color.lerp(new this.THREE.Color(baseline.baseColor), amount);
          }
        });
      });
    }

    updateCharacterSurface(mesh, time) {
      if (!mesh || !this.state.settings.surfaceFx || time - this.lastSurfaceUpdateAt < 180) return;
      const precipitation = BIOME_PROFILES[this.currentZone?.id]?.precipitation || "";
      const wet = ["neon-rain", "star-rain"].includes(precipitation) ? 0.62 : this.isSwimming ? 0.9 : 0;
      const snow = precipitation === "snow" ? 0.32 : 0;
      const heat = precipitation === "embers" ? 0.28 : 0;
      const exertion = 1 - clamp(this.state.player.stamina / Math.max(1, this.state.player.maxStamina), 0, 1);
      const injury = 1 - clamp(this.state.player.health / Math.max(1, this.state.player.maxHealth), 0, 1);
      const sweat = clamp(exertion * 0.72 + wet * 0.55, 0, 1);
      const dirt = clamp((this.currentZone?.id === "crimson" ? 0.28 : this.currentZone?.id === "void" ? 0.16 : 0.04) + injury * 0.12, 0, 0.5);
      const burn = clamp(heat * 0.74 + (this.state.player.status?.burn ? 0.5 : 0), 0, 1);
      const blood = clamp(injury * 0.52, 0, 0.58);
      this.restoreCharacterMaterialState(mesh, 0.72);
      mesh.traverse?.((object) => {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => {
          if (!("roughness" in material)) return;
          material.userData ||= {};
          material.userData.baseRoughness ??= material.roughness;
          material.userData.baseClearcoat ??= material.clearcoat || 0;
          material.userData.baseEmissiveIntensity ??= material.emissiveIntensity || 0;
          if (material.normalScale && !material.userData.baseNormalScale) {
            material.userData.baseNormalScale = { x: material.normalScale.x, y: material.normalScale.y };
          }
          material.roughness = clamp(material.userData.baseRoughness - wet * 0.34 + snow * 0.2, 0.08, 1);
          if ("clearcoat" in material) {
            material.clearcoat = Math.max(material.userData.baseClearcoat, material.userData.materialRole === "skin" ? sweat * 0.42 : wet * 0.58);
          }
          if (material.emissive && heat && material.userData.materialRole !== "skin") {
            material.emissiveIntensity = Math.max(material.userData.baseEmissiveIntensity, heat * 0.18);
          }
          if (material.color && material.userData.baseColor) {
            material.color.set(material.userData.baseColor);
            if (material.userData.materialRole === "skin") {
              const tension = clamp(Number(mesh.userData?.facePerformance?.wrinkleTension || 0), 0, 1);
              const baseNormal = material.userData.baseNormalScale;
              if (baseNormal && material.normalScale) {
                material.normalScale.set(baseNormal.x * (1 + tension * 0.42), baseNormal.y * (1 + tension * 0.42));
                material.userData.wrinkleTension = tension;
              }
              material.color.lerp(new this.THREE.Color(0xb7464e), clamp(blood * 0.1 + exertion * 0.035, 0, 0.12));
              if (material.emissive) {
                material.emissive.set(0x7a1f26);
                material.emissiveIntensity = Math.max(material.userData.baseEmissiveIntensity, clamp(exertion * 0.014 + burn * 0.025, 0, 0.04));
              }
            } else if (material.userData.materialRole === "outfit") {
              material.color.lerp(new this.THREE.Color(0x44382f), dirt * 0.22);
              if (snow) material.color.lerp(new this.THREE.Color(0xe8f6ff), snow * 0.16);
            }
          }
        });
      });
      mesh.userData.surfaceState = { wet, snow, heat, sweat, dirt, blood, burn, updatedAt: time };
      this.lastSurfaceUpdateAt = time;
    }

    updateCharacterLod(mesh, distance = 0) {
      if (!mesh) return;
      const isProtectedCharacter = mesh === this.playerMesh || mesh === this.genesisActualModel || mesh === this.genesisFallbackModel;
      const forced = isProtectedCharacter
        ? "near"
        : this.state.settings.characterMode === "portrait"
        ? "impostor"
        : this.state.settings.characterQuality;
      const tier = forced !== "adaptive"
        ? forced
        : distance <= CHARACTER_MODEL_TIERS.hero.distance
          ? "hero"
          : distance <= CHARACTER_MODEL_TIERS.near.distance
            ? "near"
            : distance <= CHARACTER_MODEL_TIERS.crowd.distance
              ? "crowd"
              : "impostor";
      const runtime = mesh.userData.characterRuntime;
      const lowDetailTier = ["crowd", "impostor"].includes(tier);
      if (runtime) {
        runtime.lodSuspended = lowDetailTier;
        runtime.updateHz = CHARACTER_MODEL_TIERS[tier]?.updateHz || 30;
        runtime.faceChannelBudget = CHARACTER_MODEL_TIERS[tier]?.face || 0;
      }
      if (runtime && lowDetailTier) {
        mesh.traverse?.((object) => {
          if (!object.morphTargetInfluences) return;
          if (!runtime.savedMorphWeights.has(object)) runtime.savedMorphWeights.set(object, object.morphTargetInfluences.slice());
          object.morphTargetInfluences.fill(0);
        });
        if (!mesh.userData.lodFaceReset) this.resetCharacterFace(mesh, { morphs: false });
        mesh.userData.lodFaceReset = true;
      } else if (runtime?.savedMorphWeights?.size) {
        runtime.savedMorphWeights.forEach((weights, object) => {
          if (!object.morphTargetInfluences) return;
          weights.forEach((weight, index) => {
            if (index < object.morphTargetInfluences.length) object.morphTargetInfluences[index] = weight;
          });
        });
        runtime.savedMorphWeights.clear();
        mesh.userData.lodFaceReset = false;
      } else if (!lowDetailTier) {
        mesh.userData.lodFaceReset = false;
      }
      if (mesh.userData.modelTier === tier) return;
      const lodVariants = mesh.userData.lodVariants || runtime?.lodVariants || {};
      const allVariants = new Set([
        ...(lodVariants.hero || []),
        ...(lodVariants.near || []),
        ...(lodVariants.crowd || []),
        ...(lodVariants.impostor || [])
      ]);
      allVariants.forEach((object) => { object.visible = false; });
      const target = lodVariants[tier]?.length
        ? lodVariants[tier]
        : tier === "near"
          ? lodVariants.hero || []
          : tier === "crowd"
            ? lodVariants.near || lodVariants.hero || []
            : lodVariants.crowd || lodVariants.hero || [];
      target.forEach((object) => { object.visible = true; });
      (lodVariants.heroDetails || []).forEach((object) => { object.visible = tier === "hero"; });
      (lodVariants.attachments || []).forEach((object) => { object.visible = tier !== "impostor"; });
      mesh.userData.modelTier = tier;
      mesh.traverse?.((object) => {
        if (!object.isMesh && !object.isSkinnedMesh) return;
        object.castShadow = object.visible && !["crowd", "impostor"].includes(tier);
      });
      this.syncCharacterModuleVisibility(mesh, tier);
    }

    syncCharacterModuleVisibility(mesh, tier = mesh?.userData?.modelTier || "hero") {
      const parts = mesh?.userData?.parts;
      const recipe = mesh?.userData?.appearance;
      if (!parts || !recipe) return;
      const detailed = tier === "hero" || tier === "near";
      const pattern = {
        "astral-layered-07": [1, 1, 1, 1, 1, 1],
        "aurora-short-02": [1, 0, 1, 0, 0, 0],
        "void-long-04": [1, 1, 1, 1, 1, 1],
        "solar-braid-03": [1, 0, 0, 1, 0, 1]
      }[recipe.hair] || [1];
      parts.hair?.children?.forEach((child, index) => {
        if (index === 0) {
          child.visible = detailed;
          return;
        }
        child.visible = detailed
          && pattern[(index - 1) % pattern.length] !== 0
          && (!child.userData?.requiresAlpha || Boolean(child.material?.alphaMap));
      });
      if (parts.beard) parts.beard.visible = detailed && recipe.beard !== "none";
      if (parts.accessory) {
        parts.accessory.visible = detailed && recipe.accessory !== "none";
        parts.accessory.children.forEach((child) => {
          child.visible = detailed && child.userData?.accessoryId === recipe.accessory;
        });
      }
    }

    updateSecondaryCharacterMotion(runtime, time, { moving = false, sprinting = false, direction = 0 } = {}) {
      if (!runtime || !this.state.settings.secondaryMotion || runtime.lodSuspended) return;
      const force = sprinting ? 1 : moving ? 0.58 : 0.2;
      runtime.secondaryBones?.forEach((bone, index) => {
        const base = bone.userData?.hhSecondaryBase;
        if (!base) return;
        const lag = Math.sin(time * 0.0025 + index * 0.72) * 0.035 * force;
        bone.rotation.x += ((base.x + force * 0.08 + lag) - bone.rotation.x) * 0.18;
        bone.rotation.y += ((base.y - direction * 0.035 * force) - bone.rotation.y) * 0.14;
        bone.rotation.z += ((base.z + Math.cos(time * 0.0021 + index) * 0.025 * force) - bone.rotation.z) * 0.16;
      });
      runtime.mesh?.userData?.parts?.hair?.children?.forEach((card, index) => {
        if (!card.userData?.secondaryMotion) return;
        card.userData.hhSecondaryRotation ||= { x: card.rotation.x, z: card.rotation.z };
        const base = card.userData.hhSecondaryRotation;
        card.rotation.x = base.x + force * 0.055 + Math.sin(time * 0.0024 + index * 0.6) * card.userData.secondaryMotion * force;
        card.rotation.z = base.z + Math.cos(time * 0.0019 + index * 0.42) * card.userData.secondaryMotion * 0.65;
      });
    }

    footMarkersForMotion(motion = "walk") {
      const markers = this.motionLibraryManifest?.footMarkers || {};
      const family = motion === "sprint" ? "sprint" : motion === "run" || motion === "strafe" ? "run" : "walk";
      return markers[family] || {
        leftFootDown: 0.08,
        leftFootUp: 0.48,
        rightFootDown: 0.55,
        rightFootUp: 0.94
      };
    }

    raycastFootGround(foot) {
      if (!foot || !this.THREE || !this.world) return null;
      const targets = [this.terrainGround, ...this.climbables.map((entry) => entry.object)].filter((object) => object?.visible !== false);
      if (!targets.length) return null;
      this.footRaycaster ||= new this.THREE.Raycaster();
      const footWorld = foot.getWorldPosition(new this.THREE.Vector3());
      const origin = footWorld.clone().add(new this.THREE.Vector3(0, 0.85, 0));
      this.footRaycaster.set(origin, new this.THREE.Vector3(0, -1, 0));
      this.footRaycaster.near = 0;
      this.footRaycaster.far = 2.2;
      const hit = this.footRaycaster.intersectObjects(targets, true)[0];
      if (!hit) return null;
      const normal = hit.face?.normal?.clone?.() || new this.THREE.Vector3(0, 1, 0);
      if (hit.object?.matrixWorld) normal.transformDirection(hit.object.matrixWorld).normalize();
      return { point: hit.point.clone(), normal, footWorld };
    }

    solveTwoBoneFootPlant(runtime, side, target, weight) {
      const bones = runtime?.bones || {};
      const upper = bones[side === "left" ? "leftUpLeg" : "rightUpLeg"];
      const lower = bones[side === "left" ? "leftLeg" : "rightLeg"];
      const foot = bones[side === "left" ? "leftFoot" : "rightFoot"];
      if (!upper || !lower || !foot || !target || weight < 0.01) return false;
      const THREE = this.THREE;
      const limitedTarget = target.clone();
      const currentFoot = foot.getWorldPosition(new THREE.Vector3());
      const displacement = limitedTarget.clone().sub(currentFoot);
      if (displacement.length() > 0.26) limitedTarget.copy(currentFoot).add(displacement.setLength(0.26));
      [lower, upper, lower].forEach((joint) => {
        runtime.mesh.updateMatrixWorld(true);
        const jointWorld = joint.getWorldPosition(new THREE.Vector3());
        const effectorWorld = foot.getWorldPosition(new THREE.Vector3());
        const from = effectorWorld.sub(jointWorld);
        const to = limitedTarget.clone().sub(jointWorld);
        if (from.lengthSq() < 0.000001 || to.lengthSq() < 0.000001) return;
        from.normalize();
        to.normalize();
        const deltaWorld = new THREE.Quaternion().setFromUnitVectors(from, to);
        const angle = 2 * Math.acos(clamp(deltaWorld.w, -1, 1));
        const limited = new THREE.Quaternion().slerp(deltaWorld, angle > 0.16 ? 0.16 / angle : 1);
        const currentWorld = joint.getWorldQuaternion(new THREE.Quaternion());
        const desiredWorld = limited.multiply(currentWorld);
        const parentWorld = joint.parent?.getWorldQuaternion?.(new THREE.Quaternion()) || new THREE.Quaternion();
        const desiredLocal = parentWorld.invert().multiply(desiredWorld).normalize();
        joint.quaternion.slerp(desiredLocal, clamp(weight * 0.72, 0, 1)).normalize();
      });
      return true;
    }

    offsetBoneWorld(bone, worldOffset, weight) {
      if (!bone?.parent || !worldOffset || weight <= 0) return;
      const THREE = this.THREE;
      const parentQuaternion = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      const parentScale = bone.parent.getWorldScale(new THREE.Vector3());
      const local = worldOffset.clone().applyQuaternion(parentQuaternion);
      local.set(
        local.x / Math.max(0.0001, Math.abs(parentScale.x)),
        local.y / Math.max(0.0001, Math.abs(parentScale.y)),
        local.z / Math.max(0.0001, Math.abs(parentScale.z))
      );
      bone.position.lerp(bone.position.clone().add(local), clamp(weight, 0, 1));
    }

    applyFootContactIK(runtime, normalizedPhase, motion = "walk", strength = 1, dt = 0.016) {
      if (!runtime || runtime.lodSuspended || !this.state.settings.naturalMotion) return;
      const markers = this.footMarkersForMotion(motion);
      const phase = ((Number(normalizedPhase || 0) % 1) + 1) % 1;
      const isBetween = (value, start, end) => start <= end ? value >= start && value <= end : value >= start || value <= end;
      const results = [];
      const pelvisOffsets = [];
      [
        ["left", runtime.bones?.leftFoot, runtime.bones?.leftToe, markers.leftFootDown, markers.leftFootUp],
        ["right", runtime.bones?.rightFoot, runtime.bones?.rightToe, markers.rightFootDown, markers.rightFootUp]
      ].forEach(([side, foot, toe, down, up]) => {
        if (!foot) return;
        const ray = this.raycastFootGround(foot);
        const planted = strength > 0.1 && isBetween(phase, Number(down), Number(up));
        const state = runtime.footPlants[side];
        const targetWeight = planted && ray ? strength : 0;
        state.weight += (targetWeight - state.weight) * (1 - Math.exp(-Math.max(0.001, dt) * (planted ? 22 : 14)));
        if (planted && ray && !state.planted) {
          state.point = ray.point.clone();
          state.normal = ray.normal.clone();
        }
        state.planted = planted && Boolean(ray);
        if (state.planted && ray) {
          state.point.y = ray.point.y;
          state.normal.lerp(ray.normal, 0.24).normalize();
          const verticalError = clamp(state.point.y - ray.footWorld.y, -0.18, 0.18);
          pelvisOffsets.push(verticalError);
          this.solveTwoBoneFootPlant(runtime, side, state.point, state.weight);
          runtime.mesh.updateMatrixWorld(true);
          const alignmentWorld = new this.THREE.Quaternion().setFromUnitVectors(new this.THREE.Vector3(0, 1, 0), state.normal);
          const footWorld = foot.getWorldQuaternion(new this.THREE.Quaternion());
          const desiredWorld = alignmentWorld.multiply(footWorld).normalize();
          const parentWorld = foot.parent?.getWorldQuaternion?.(new this.THREE.Quaternion()) || new this.THREE.Quaternion();
          const desiredLocal = parentWorld.invert().multiply(desiredWorld).normalize();
          foot.quaternion.slerp(desiredLocal, clamp(state.weight * 0.34, 0, 0.34)).normalize();
        }
        if (toe) {
          const toePhase = clamp((phase - Number(up) + 0.12) / 0.18, 0, 1);
          toe.rotation.x += Math.sin(toePhase * Math.PI) * 0.12 * (1 - state.weight) * strength;
        }
        results.push(`${side}:${state.planted ? "locked" : ray ? "tracking" : "no-ground"}`);
      });
      if (pelvisOffsets.length && runtime.bones?.hips) {
        const lowest = Math.min(...pelvisOffsets);
        this.offsetBoneWorld(runtime.bones.hips, new this.THREE.Vector3(0, lowest * 0.42, 0), 0.55);
      }
      runtime.ikState = {
        foot: results.join(" · ") || "unavailable",
        solver: "raycast+phase-lock+ccd",
        hand: runtime.bones?.rightHand ? "weapon-socket" : "unavailable",
        lookAt: runtime.bones?.head ? "active" : "unavailable",
        updatedAt: performance.now()
      };
    }

    disposeCharacterObject(object, runtime = object?.userData?.characterRuntime) {
      if (!object) return;
      try {
        runtime?.mixer?.stopAllAction?.();
        runtime?.mixer?.uncacheRoot?.(runtime.mesh || object);
      } catch {}
      const geometries = new Set();
      const materials = new Set();
      const textures = new Set();
      const textureSlots = [
        "map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "alphaMap", "emissiveMap",
        "bumpMap", "displacementMap", "lightMap", "envMap", "gradientMap", "matcap",
        "clearcoatMap", "clearcoatNormalMap", "clearcoatRoughnessMap", "sheenColorMap", "sheenRoughnessMap",
        "specularColorMap", "specularIntensityMap", "transmissionMap", "thicknessMap",
        "iridescenceMap", "iridescenceThicknessMap", "anisotropyMap"
      ];
      object.traverse?.((node) => {
        if (node.geometry && !node.userData?.sharedAsset) geometries.add(node.geometry);
        if (node.skeleton?.boneTexture) textures.add(node.skeleton.boneTexture);
        const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
        nodeMaterials.filter(Boolean).forEach((material) => {
          materials.add(material);
          textureSlots.forEach((slot) => {
            const texture = material[slot];
            if (texture?.isTexture && !texture.userData?.sharedAsset) textures.add(texture);
          });
        });
      });
      geometries.forEach((geometry) => geometry.dispose?.());
      textures.forEach((texture) => {
        try { texture.source?.data?.close?.(); } catch {}
        texture.dispose?.();
      });
      materials.forEach((material) => material.dispose?.());
    }

    async importCharacterGLB(file) {
      if (!file || this.characterImporting) return;
      if (!this.GLTFLoaderClass) return this.toast("GLB Loader chưa sẵn sàng trên trình duyệt này.", "error");
      if (!/\.glb$/i.test(file.name || "")) return this.toast("Hãy chọn một file .glb đã đóng gói texture.", "error");
      if (file.size > CHARACTER_IMPORT_LIMITS.fileBytes) return this.toast("Model vượt 32 MB. Hãy tạo LOD và nén texture trước khi nhập.", "error");
      this.characterImporting = true;
      this.toast("Đang giải nén và kiểm tra skeleton, texture, morph, LOD...");
      let dracoLoader = null;
      let ktx2Loader = null;
      try {
        const buffer = await file.arrayBuffer();
        const loader = new this.GLTFLoaderClass();
        if (this.DRACOLoaderClass) {
          dracoLoader = new this.DRACOLoaderClass();
          dracoLoader.setDecoderPath(new URL("./vendor/addons/libs/draco/gltf/", document.baseURI).href);
          loader.setDRACOLoader(dracoLoader);
        }
        if (this.KTX2LoaderClass && this.renderer) {
          ktx2Loader = new this.KTX2LoaderClass();
          ktx2Loader.setTranscoderPath(new URL("./vendor/addons/libs/basis/", document.baseURI).href);
          ktx2Loader.detectSupport(this.renderer);
          loader.setKTX2Loader(ktx2Loader);
        }
        if (this.MeshoptDecoder) loader.setMeshoptDecoder(this.MeshoptDecoder);
        const gltf = await new Promise((resolve, reject) => loader.parse(buffer, "", resolve, reject));
        const report = this.buildCharacterQaReport(gltf.scene, gltf.animations || [], file.size);
        const validation = validateCharacterAsset(report);
        this.lastCharacterQa = { ...report, ...validation, sourceName: file.name, checkedAt: nowIso() };
        if (!validation.valid) {
          this.disposeCharacterObject(gltf.scene);
          throw new Error(validation.errors.join(" "));
        }
        this.installImportedCharacter(gltf, this.state.roster.activeId, file.name, this.lastCharacterQa);
        const warning = validation.warnings.length ? ` · ${validation.warnings.length} cảnh báo` : "";
        this.toast(`Đã nạp ${file.name} vào Character V${CHARACTER_VISUAL_VERSION} · QA ${validation.score}/100${warning}.`, "success");
        this.renderCurrentPanel();
      } catch (error) {
        this.toast(`Không nạp được GLB: ${error?.message || "file không hợp lệ"}`, "error");
      } finally {
        try { dracoLoader?.dispose?.(); } catch {}
        try { ktx2Loader?.dispose?.(); } catch {}
        this.characterImporting = false;
      }
    }

    installImportedCharacter(gltf, characterId, sourceName = "custom.glb", qaReport = null) {
      const profile = CHARACTERS[characterId] || CHARACTERS.lyra;
      const oldMesh = this.characterMeshes.get(characterId);
      const oldRuntime = this.characterRuntimes.get(characterId);
      if (!oldMesh || !gltf?.scene) throw new Error("GLB không có scene nhân vật.");
      const wrapper = new this.THREE.Group();
      wrapper.name = `WebHeroGLB:${characterId}`;
      const asset = gltf.scene;
      const box = new this.THREE.Box3().setFromObject(asset);
      const size = box.getSize(new this.THREE.Vector3());
      const height = Math.max(0.001, size.y);
      const scale = 2.92 / height;
      asset.scale.setScalar(scale);
      asset.updateMatrixWorld(true);
      const fitted = new this.THREE.Box3().setFromObject(asset);
      const center = fitted.getCenter(new this.THREE.Vector3());
      const fitOffset = new this.THREE.Vector3(-center.x, -fitted.min.y, -center.z);
      asset.position.add(fitOffset);
      const normalizedFitted = fitted.clone().translate(fitOffset);
      const genesisAuthoredBounds = {
        min: normalizedFitted.min.toArray(),
        max: normalizedFitted.max.toArray()
      };
      const importedMeshes = [];
      asset.traverse((object) => {
        if (!object.isMesh && !object.isSkinnedMesh) return;
        importedMeshes.push(object);
        object.castShadow = true;
        object.receiveShadow = true;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => {
          material.envMapIntensity = Math.max(material.envMapIntensity || 0, this.photorealAssets.hdrEnvironment || this.photorealAssets.panorama ? 0.82 : 0.18);
          material.userData ||= {};
          material.userData.baseRoughness = material.roughness;
          material.userData.baseClearcoat = material.clearcoat || 0;
          material.userData.baseEmissiveIntensity = material.emissiveIntensity || 0;
        });
      });
      wrapper.add(asset);
      wrapper.position.copy(oldMesh.position);
      wrapper.rotation.copy(oldMesh.rotation);
      wrapper.visible = oldMesh.visible;
      wrapper.userData = {
        characterId,
        visualMode: "gltf-imported",
        sourceProvider: sourceName,
        modelTier: "",
        appearanceCapability: "gltf-morph-targets",
        gameplayCollider: { radius: 0.48, height: 2.95 },
        gltfAsset: asset,
        qaReport
      };
      const explicitLods = { hero: [], near: [], crowd: [], impostor: [] };
      asset.traverse((object) => {
        const match = String(object.name || "").match(/^lod([0-3])(?:\b|_)/i);
        if (!match) return;
        const tier = ["hero", "near", "crowd", "impostor"][Number(match[1])];
        object.traverse?.((child) => {
          if ((child.isMesh || child.isSkinnedMesh) && !explicitLods[tier].includes(child)) explicitLods[tier].push(child);
        });
      });
      const proxy3d = this.createCharacterMesh({ body: profile.body, accent: profile.accent, scale: 0.94 });
      proxy3d.name = `Imported3DProxy:${profile.id}`;
      proxy3d.visible = false;
      proxy3d.userData.isCharacterLodProxy = true;
      wrapper.add(proxy3d);
      const lodTierOrder = ["hero", "near", "crowd", "impostor"];
      const hasExplicitLods = lodTierOrder.some((tier) => explicitLods[tier].length);
      const nearestExplicitLod = (tier) => {
        if (!hasExplicitLods) return importedMeshes;
        const tierIndex = lodTierOrder.indexOf(tier);
        const nearestTier = lodTierOrder
          .map((candidate, candidateIndex) => ({
            candidate,
            distance: Math.abs(candidateIndex - tierIndex),
            candidateIndex
          }))
          .sort((left, right) => left.distance - right.distance || left.candidateIndex - right.candidateIndex)
          .find(({ candidate }) => explicitLods[candidate].length);
        return nearestTier ? explicitLods[nearestTier.candidate] : importedMeshes;
      };
      wrapper.userData.lodVariants = {
        hero: explicitLods.hero.length ? explicitLods.hero : nearestExplicitLod("hero"),
        near: explicitLods.near.length ? explicitLods.near : nearestExplicitLod("near"),
        crowd: explicitLods.crowd.length ? explicitLods.crowd : nearestExplicitLod("crowd"),
        impostor: explicitLods.impostor.length ? explicitLods.impostor : [proxy3d],
        heroDetails: []
      };
      wrapper.userData.genesisAuthoredBounds = genesisAuthoredBounds;
      this.world.add(wrapper);
      this.world.remove(oldMesh);
      const weaponAnchor = new this.THREE.Group();
      weaponAnchor.name = "HHWeaponSocket";
      const rightHandAliases = HH_HUMANOID_SKELETON.rightHand.map(normalizeBoneName);
      let rightHand = null;
      asset.traverse((object) => {
        if (!rightHand && object.isBone && rightHandAliases.includes(normalizeBoneName(object.name))) rightHand = object;
      });
      (rightHand || wrapper).add(weaponAnchor);
      const weapon = this.createPlayerWeapon(profile);
      weapon.scale.setScalar(rightHand ? 0.62 / Math.max(scale, 0.001) : 1);
      weaponAnchor.add(weapon);
      wrapper.userData.lodVariants.attachments = [weapon];
      wrapper.userData.parts = { weaponAnchor };
      wrapper.userData.weapon = weapon;
      this.characterMeshes.set(characterId, wrapper);
      const runtime = this.registerCharacterRuntime(wrapper, profile, characterId, "hero", gltf.animations || []);
      runtime.qaReport = qaReport || runtime.qaReport;
      this.playCharacterClip(runtime, "idle");
      this.updateCharacterLod(wrapper, 0);
      const qaLabel = qaReport ? ` · QA ${qaReport.score}/100` : "";
      this.characterAssetStatus.set(characterId, `${sourceName} · ${runtime.triangles.toLocaleString("vi-VN")} tris · ${runtime.clips.size} clips · ${runtime.facialChannels} morph${qaLabel}`);
      this.applyAppearanceToMesh(wrapper, this.activeAppearanceRecipe(), characterId);
      if (this.state.roster.activeId === characterId) {
        this.playerMesh = wrapper;
        this.playerWeapon = weapon;
        this.resetGameplayCharacterVisibility("imported-glb");
      }
      if (oldRuntime && oldRuntime !== runtime) this.disposeCharacterObject(oldMesh, oldRuntime);
      this.updateUi(true);
    }

    async toggleFacePilot() {
      if (this.facePilot.status === "running" || this.facePilot.status === "loading") {
        this.stopFacePilot();
        this.toast("Face Pilot đã tắt. Camera đã được giải phóng.", "success");
        this.renderCurrentPanel();
        return;
      }
      if (!root.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        this.facePilot.status = "unsupported";
        this.facePilot.error = "Trình duyệt không hỗ trợ camera an toàn.";
        this.toast(this.facePilot.error, "error");
        this.renderCurrentPanel();
        return;
      }
      this.facePilot.status = "loading";
      this.facePilot.error = "";
      this.renderCurrentPanel();
      try {
        const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.0/vision_bundle.mjs");
        const fileset = await vision.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.0/wasm"
        );
        const faceOptions = {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        };
        let landmarker;
        try {
          landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
            ...faceOptions,
            baseOptions: { ...faceOptions.baseOptions, delegate: "GPU" }
          });
        } catch {
          landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
            ...faceOptions,
            baseOptions: { ...faceOptions.baseOptions, delegate: "CPU" }
          });
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 }, facingMode: "user" },
          audio: false
        });
        const video = document.createElement("video");
        video.className = "har-face-pilot-video";
        video.hidden = true;
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        this.root.appendChild(video);
        await video.play();
        this.facePilot = { status: "running", stream, video, landmarker, frame: 0, blendshapes: {}, error: "", lastVideoTime: -1, lastDetectionAt: 0, lastResultAt: 0 };
        this.updateFacePilotFrame();
        this.toast("Face Pilot đang chạy cục bộ · video không được tải lên máy chủ.", "success");
      } catch (error) {
        this.stopFacePilot();
        this.facePilot.status = "error";
        this.facePilot.error = error?.name === "NotAllowedError"
          ? "Bạn chưa cấp quyền camera."
          : `Không khởi tạo được Face Pilot: ${error?.message || "lỗi không xác định"}`;
        this.toast(this.facePilot.error, "error");
      }
      this.renderCurrentPanel();
    }

    updateFacePilotFrame() {
      if (this.facePilot.status !== "running" || this.destroyed) return;
      const { video, landmarker } = this.facePilot;
      const now = performance.now();
      const detectionInterval = this.state.settings.quality === "cinematic" ? 50 : 66;
      const faceTier = this.playerMesh?.userData?.modelTier || "hero";
      const canDetectFace = this.state.settings.facialAnimation && !["crowd", "impostor"].includes(faceTier);
      if (this.visible && canDetectFace && now - this.facePilot.lastDetectionAt >= detectionInterval && video?.readyState >= 2 && video.currentTime !== this.facePilot.lastVideoTime) {
        this.facePilot.lastDetectionAt = now;
        this.facePilot.lastVideoTime = video.currentTime;
        try {
          const result = landmarker.detectForVideo(video, now);
          const categories = result?.faceBlendshapes?.[0]?.categories || [];
          this.facePilot.blendshapes = Object.fromEntries(
            categories
              .filter((item) => MEDIAPIPE_FACE_CHANNELS.includes(item.categoryName))
              .map((item) => [item.categoryName, clamp(item.score, 0, 1)])
          );
          this.facePilot.lastResultAt = categories.length ? now : 0;
          this.facePilot.frame += 1;
        } catch (error) {
          this.facePilot.error = error?.message || "Face tracking bị gián đoạn.";
        }
      }
      this.facePilot.raf = requestAnimationFrame(() => this.updateFacePilotFrame());
    }

    stopFacePilot() {
      if (this.facePilot.raf) cancelAnimationFrame(this.facePilot.raf);
      try { this.facePilot.landmarker?.close?.(); } catch {}
      this.facePilot.stream?.getTracks?.().forEach((track) => track.stop());
      if (this.facePilot.video) {
        this.facePilot.video.srcObject = null;
        this.facePilot.video.remove();
      }
      this.facePilot = { status: "off", stream: null, video: null, landmarker: null, frame: 0, blendshapes: {}, error: "", lastDetectionAt: 0, lastResultAt: 0 };
    }

    equippedWeaponClass(characterId = this.state.roster.activeId) {
      const weaponId = this.state.loadouts?.[characterId]?.weapon || (characterId === this.state.roster.activeId ? this.state.player.weapon : "starter-blade");
      return ITEMS[weaponId]?.weaponClass || "sword";
    }

    createPlayerWeapon(profile, weaponClass = this.equippedWeaponClass(profile.id)) {
      const THREE = this.THREE;
      const weapon = new THREE.Group();
      weapon.name = `Weapon:${weaponClass}`;
      weapon.userData.weaponClass = weaponClass;
      const weaponSurface = this.state.settings.renderStyle === "anime"
        ? new THREE.MeshToonMaterial({
          color: 0xf2fbff,
          emissive: profile.accent,
          emissiveIntensity: 0.86,
          gradientMap: this.toonGradient
        })
        : new (THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial)({
          color: 0xf2fbff,
          emissive: profile.accent,
          emissiveIntensity: 0.62,
          roughness: 0.16,
          metalness: 0.82,
          clearcoat: 0.7
        });
      const guardMaterial = this.state.settings.renderStyle === "anime"
        ? new THREE.MeshToonMaterial({ color: profile.accent, emissive: profile.accent, emissiveIntensity: 0.55, gradientMap: this.toonGradient })
        : new (THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial)({ color: profile.accent, emissive: profile.accent, emissiveIntensity: 0.34, roughness: 0.22, metalness: 0.72, clearcoat: 0.58 });

      if (weaponClass === "gun") {
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.86), weaponSurface);
        receiver.position.set(0, 0.03, -0.35);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.82, 12), guardMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.05, -0.95);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.42, 0.2), guardMaterial);
        grip.position.set(0, -0.25, -0.18);
        grip.rotation.x = -0.22;
        const sight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.24), guardMaterial);
        sight.position.set(0, 0.18, -0.4);
        weapon.add(receiver, barrel, grip, sight);
        weapon.rotation.set(-0.12, 0, 0.02);
        return weapon;
      }

      if (weaponClass === "unarmed") {
        const gauntlet = new THREE.Mesh(new THREE.DodecahedronGeometry(0.19, 1), weaponSurface);
        gauntlet.scale.set(0.76, 1.18, 0.92);
        const knuckles = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.17), guardMaterial);
        knuckles.position.set(0, -0.08, -0.16);
        weapon.add(gauntlet, knuckles);
        return weapon;
      }

      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, profile.id === "sol" ? 1.75 : 1.52, 0.18),
        weaponSurface
      );
      blade.position.y = 0.45;
      weapon.add(blade);
      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.09, 0.14),
        guardMaterial
      );
      guard.position.y = -0.31;
      weapon.add(guard);
      weapon.rotation.z = -0.28;
      return weapon;
    }

    refreshEquippedWeapon(characterId = this.state.roster.activeId) {
      const mesh = this.characterMeshes.get(characterId);
      const profile = CHARACTERS[characterId];
      const anchor = mesh?.userData?.parts?.weaponAnchor;
      if (!mesh || !profile || !anchor) return;
      const oldWeapon = mesh.userData.weapon;
      if (oldWeapon) {
        anchor.remove(oldWeapon);
        oldWeapon.traverse((object) => {
          object.geometry?.dispose?.();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.filter(Boolean).forEach((material) => material.dispose?.());
        });
      }
      const weapon = this.createPlayerWeapon(profile, this.equippedWeaponClass(characterId));
      anchor.add(weapon);
      mesh.userData.weapon = weapon;
      mesh.userData.lodVariants.attachments = [weapon];
      weapon.visible = mesh.userData.modelTier !== "impostor";
      if (characterId === this.state.roster.activeId) this.playerWeapon = weapon;
    }

    createActors() {
      CHARACTER_ORDER.forEach((id) => {
        const profile = CHARACTERS[id];
        const mesh = this.createPhotorealCharacterModel(profile, 1);
        const weapon = this.createPlayerWeapon(profile);
        mesh.userData.parts.weaponAnchor.add(weapon);
        mesh.userData.lodVariants.attachments = [weapon];
        weapon.visible = mesh.userData.modelTier !== "impostor";
        mesh.userData.weapon = weapon;
        mesh.visible = id === this.state.roster.activeId;
        this.world.add(mesh);
        this.characterMeshes.set(id, mesh);
        this.registerCharacterRuntime(mesh, profile, id, "hero", mesh.userData.builtInAnimations || []);
      });
      this.playerMesh = this.characterMeshes.get(this.state.roster.activeId) || this.characterMeshes.get("lyra");
      this.playerWeapon = this.playerMesh.userData.weapon;
      const activeProfile = CHARACTERS[this.state.roster.activeId] || CHARACTERS.lyra;
      if (!this.state.appearance.creatorCompletedAt) this.state.player.name = activeProfile.name;
      this.state.player.element = activeProfile.element;

      const shadow = new this.THREE.Mesh(
        new this.THREE.CircleGeometry(0.78, 24),
        new this.THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 1.08;
      this.world.add(shadow);
      this.playerShadow = shadow;

      [
        ["aurora-wisp-1", "aurora-wisp", -45, 19],
        ["aurora-wisp-2", "aurora-wisp", -57, 8],
        ["aurora-wisp-3", "aurora-wisp", -61, 29],
        ["forge-hound-1", "forge-hound", 47, 28],
        ["forge-hound-2", "forge-hound", 62, 14],
        ["void-stalker-1", "void-stalker", -7, -56],
        ["void-stalker-2", "void-stalker", 15, -57],
        ["sky-sentinel-1", "sky-sentinel", -116, -43],
        ["sky-sentinel-2", "sky-sentinel", -132, -53],
        ["ocean-siren-1", "ocean-siren", 114, -36],
        ["ocean-siren-2", "ocean-siren", 132, -48],
        ["station-drone-1", "station-drone", -110, 84],
        ["station-drone-2", "station-drone", -128, 96],
        ["abyss-herald-1", "abyss-herald", 115, 88],
        ["abyss-herald-2", "abyss-herald", 134, 100],
        ["nexus-warden", "nexus-warden", 8, -73],
        ["dungeon-stalker-1", "void-stalker", 71, -67],
        ["dungeon-stalker-2", "void-stalker", 81, -64]
      ].forEach(([id, type, x, z]) => this.createEnemy(id, type, x, z));
    }

    createEnemy(id, type, x, z) {
      const THREE = this.THREE;
      const profile = ENEMY_ARCHETYPES[type];
      const scale = profile.boss ? 1.35 : type === "forge-hound" ? 1.15 : 1;
      const group = new THREE.Group();
      const material = this.state.settings.renderStyle === "anime"
        ? new THREE.MeshToonMaterial({
          color: new THREE.Color(profile.color).multiplyScalar(0.42),
          emissive: new THREE.Color(profile.color),
          emissiveIntensity: profile.boss ? 0.34 : 0.22,
          gradientMap: this.toonGradient
        })
        : new (THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial)({
          color: new THREE.Color(profile.color).multiplyScalar(profile.boss ? 0.12 : 0.3),
          emissive: new THREE.Color(profile.color),
          emissiveIntensity: profile.boss ? 0.1 : 0.08,
          roughness: profile.boss ? 0.48 : 0.62,
          metalness: profile.boss ? 0.56 : 0.2,
          clearcoat: profile.boss ? 0.28 : 0.08,
          clearcoatRoughness: 0.44,
          envMapIntensity: this.photorealAssets.hdrEnvironment || this.photorealAssets.panorama ? 0.76 : 0.2
        });
      const bodyGeometry = profile.boss
        ? new THREE.CapsuleGeometry(0.62 * scale, 1.08 * scale, 10, 20)
        : new THREE.IcosahedronGeometry(0.76 * scale, 2);
      const body = new THREE.Mesh(bodyGeometry, material);
      body.position.y = 1.48 * scale;
      body.castShadow = true;
      group.add(body);
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.19 * scale, 12, 8),
        new THREE.MeshStandardMaterial({ color: 0xe8f0f4, emissive: profile.color, emissiveIntensity: profile.boss ? 0.32 : 0.12, roughness: 0.18 })
      );
      eye.position.set(0, 1.68 * scale, 0.78 * scale);
      eye.userData.weakPoint = Boolean(profile.boss);
      if (profile.boss) eye.visible = false;
      group.add(eye);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.18 * scale, 0.055 * scale, 8, 36),
        new THREE.MeshBasicMaterial({ color: profile.color, transparent: true, opacity: profile.boss ? 0.2 : 0.42, depthWrite: false })
      );
      ring.position.y = 1.6 * scale;
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      group.position.set(x, 1.05, z);
      group.userData = {
        type: "enemy",
        id,
        archetype: type,
        name: profile.name,
        health: profile.health,
        maxHealth: profile.health,
        attack: profile.attack,
        baseAttack: profile.attack,
        speed: profile.speed,
        baseSpeed: profile.speed,
        element: profile.element,
        xp: profile.xp,
        drop: profile.drop,
        boss: Boolean(profile.boss),
        bossPhase: 1,
        weakPoint: eye,
        shield: profile.boss ? 320 : 0,
        maxShield: profile.boss ? 320 : 0,
        homeX: x,
        homeZ: z,
        lastAttackAt: 0,
        lastSpecialAt: 0,
        status: {},
        defeated: false,
        respawnAt: 0,
        floatBase: 1.05,
        body,
        ring
      };
      this.world.add(group);
      this.enemies.set(id, group);
      return group;
    }

    positionCharacterInWorld(mesh, x, y, z) {
      if (!mesh?.position) return;
      const lift = Number(mesh.userData?.gameplayGroundOffset ?? mesh.userData?.gameplayVisualLift ?? 0);
      mesh.position.set(x, y + lift, z);
    }

    applyStateToWorld() {
      const player = this.state.player;
      const activeId = CHARACTERS[this.state.roster.activeId] ? this.state.roster.activeId : "lyra";
      const activeProfile = CHARACTERS[activeId];
      this.characterMeshes.forEach((mesh, id) => {
        mesh.visible = id === activeId;
        this.positionCharacterInWorld(mesh, player.x, player.y, player.z);
        mesh.rotation.y = player.rotation;
      });
      this.playerMesh = this.characterMeshes.get(activeId) || this.playerMesh;
      this.playerWeapon = this.playerMesh?.userData?.weapon || this.playerWeapon;
      player.name = activeProfile.name;
      player.element = activeProfile.element;
      this.positionCharacterInWorld(this.playerMesh, player.x, player.y, player.z);
      this.playerMesh.rotation.y = player.rotation;
      this.playerShadow.position.set(player.x, 1.08, player.z);
      this.state.collectedNodes.forEach((id) => {
        const node = this.collectibles.get(id);
        if (node) node.visible = false;
      });
      Object.entries(this.state.defeated || {}).forEach(([id, record]) => {
        const enemy = this.enemies.get(id);
        if (!enemy || !record?.defeated) return;
        enemy.userData.health = 0;
        enemy.userData.defeated = true;
        enemy.userData.respawnAt = Number(record.respawnAt || 0);
        enemy.visible = false;
      });
      Object.keys(this.state.checkpoints).forEach((id) => {
        const portal = this.portals.get(id);
        if (portal) portal.userData.unlocked = Boolean(this.state.checkpoints[id]);
      });
      this.puzzleNodes.forEach((puzzle, id) => {
        const solved = Boolean(this.state.puzzles[id]?.solved);
        puzzle.userData.solved = solved;
        puzzle.children.forEach((child) => {
          if (!child.material) return;
          child.material.emissiveIntensity = solved ? 1.1 : 0.18;
        });
      });
      this.setElement(this.state.player.element, false);
      this.refreshWorldStateVisuals();
      this.updateCamera(true);
    }

    refreshWorldStateVisuals() {
      if (!this.world) return;
      this.world.traverse((object) => {
        const zoneId = object.userData?.zoneId;
        if (!zoneId || !object.material) return;
        const state = this.state.world?.zones?.[zoneId];
        const zone = ZONES.find((item) => item.id === zoneId);
        if (!state || !zone) return;
        const material = Array.isArray(object.material) ? object.material[0] : object.material;
        if (material.emissive && material.emissiveIntensity !== undefined) {
          material.emissive.set(zone.color);
          material.emissiveIntensity = state.restored ? 0.48 : state.discovered ? 0.18 : 0.06;
        }
        if (material.opacity !== undefined && zoneId !== "central") material.opacity = state.restored ? 0.58 : 0.36;
      });
    }

    listen(target, event, handler, options) {
      target?.addEventListener?.(event, handler, options);
      this.cleanup.push(() => target?.removeEventListener?.(event, handler, options));
    }

    bindShellEvents() {
      const cinematicToggle = this.root.querySelector('[data-cinematic-action="toggle"]');
      this.listen(cinematicToggle, "click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.toggleCinematicPlayback();
      });
      this.listen(this.root, "click", (event) => {
        if (event.target.closest("[data-har-cinematics]")) {
          this.openCinematicGallery(this.currentStoryChapter().id, { source: "archive", autoplay: true });
          return;
        }
        const cinematicButton = event.target.closest("[data-cinematic-chapter]");
        const cinematicChapter = cinematicButton?.dataset.cinematicChapter;
        if (cinematicChapter) {
          if (cinematicButton.disabled || !this.isStoryChapterUnlocked(cinematicChapter)) {
            this.toast("Chương này chưa được mở trong tuyến Nexus Echo.", "error");
            return;
          }
          this.playCinematicChapter(cinematicChapter, { autoplay: true });
          return;
        }
        const cinematicAction = event.target.closest("[data-cinematic-action]")?.dataset.cinematicAction;
        if (cinematicAction) {
          if (cinematicAction === "close") this.closeCinematicGallery();
          else if (cinematicAction === "replay") this.playCinematicChapter(this.cinematicSequence.chapterId, { autoplay: true });
          else if (cinematicAction === "toggle") this.toggleCinematicPlayback();
          else if (cinematicAction === "enter") this.closeCinematicGallery({ enterZone: true });
          return;
        }
        const panelActionButton = event.target.closest("[data-panel-action]");
        if (panelActionButton && !panelActionButton.disabled) {
          this.handlePanelAction(panelActionButton.dataset.panelAction, panelActionButton.dataset);
          return;
        }
        const genesisGroup = event.target.closest("[data-genesis-group]");
        if (genesisGroup) {
          this.appearanceGroup = genesisGroup.dataset.genesisGroup;
          const group = APPEARANCE_GROUPS.find((item) => item.id === this.appearanceGroup);
          this.appearanceFocus = group?.focus || "body";
          this.fitGenesisCamera(this.genesisActualModel || this.genesisFallbackModel, this.appearanceFocus);
          this.refreshGenesisCreator();
          return;
        }
        const genesisBase = event.target.closest("[data-genesis-base]");
        if (genesisBase) {
          const value = genesisBase.dataset.genesisBase;
          if (BUILTIN_CHARACTER_ASSETS[value] && value !== this.activeAppearanceRecipe().baseModel) {
            this.updateAppearanceDraft("baseModel", value);
            this.commitAppearanceDraft();
            this.rebuildActiveBuiltInCharacter();
            this.refreshGenesisCreator();
          }
          return;
        }
        const genesisPreset = event.target.closest("[data-genesis-preset]");
        if (genesisPreset) {
          this.applyAppearancePreset(genesisPreset.dataset.genesisPreset);
          this.refreshGenesisCreator();
          return;
        }
        const genesisExpression = event.target.closest("[data-genesis-expression]");
        if (genesisExpression) {
          const recipe = this.activeAppearanceRecipe();
          const before = clone(recipe);
          recipe.expression = CHARACTER_EXPRESSION_PRESETS[genesisExpression.dataset.genesisExpression]
            ? genesisExpression.dataset.genesisExpression
            : "neutral";
          recipe.updatedAt = nowIso();
          this.recordAppearanceChange(before);
          this.setCharacterFacePreview(recipe.expression, recipe.viseme);
          this.refreshGenesisCreator();
          return;
        }
        const genesisViseme = event.target.closest("[data-genesis-viseme]");
        if (genesisViseme) {
          const recipe = this.activeAppearanceRecipe();
          const before = clone(recipe);
          recipe.viseme = CHARACTER_VISEMES[genesisViseme.dataset.genesisViseme]
            ? genesisViseme.dataset.genesisViseme
            : "neutral";
          recipe.updatedAt = nowIso();
          this.recordAppearanceChange(before);
          this.setCharacterFacePreview(recipe.expression, recipe.viseme);
          this.refreshGenesisCreator();
          return;
        }
        const genesisLighting = event.target.closest("[data-genesis-lighting]");
        if (genesisLighting) {
          this.setGenesisLighting(genesisLighting.dataset.genesisLighting);
          this.refreshGenesisCreator();
          return;
        }
        const genesisStudio = event.target.closest("[data-genesis-studio]");
        if (genesisStudio) {
          this.setGenesisStudio(genesisStudio.dataset.genesisStudio);
          return;
        }
        const genesisMotion = event.target.closest("[data-genesis-motion]");
        if (genesisMotion) {
          this.setGenesisMotion(genesisMotion.dataset.genesisMotion);
          this.refreshGenesisCreator();
          return;
        }
        const genesisAction = event.target.closest("[data-genesis-action]")?.dataset.genesisAction;
        if (genesisAction) {
          if (genesisAction === "rotate-left") this.cameraYaw -= 0.34;
          else if (genesisAction === "rotate-right") this.cameraYaw += 0.34;
          else if (genesisAction === "toggle-turntable") {
            this.genesisTurntable = !this.genesisTurntable;
            this.refreshGenesisCreator();
          } else if (genesisAction === "auto-fit") {
            this.autoFitCharacter();
            this.refreshGenesisCreator();
          }
          else if (genesisAction === "focus-body") {
            this.appearanceFocus = "body";
            this.fitGenesisCamera(this.genesisActualModel || this.genesisFallbackModel, "body");
          } else if (genesisAction === "focus-head") {
            this.appearanceFocus = "head";
            this.fitGenesisCamera(this.genesisActualModel || this.genesisFallbackModel, "head");
          } else if (genesisAction === "random") {
            this.randomAppearance();
            this.refreshGenesisCreator();
          } else if (genesisAction === "reset") {
            this.resetAppearance();
            this.refreshGenesisCreator();
          } else if (genesisAction === "undo") {
            this.undoAppearance();
            this.refreshGenesisCreator();
          } else if (genesisAction === "redo") {
            this.redoAppearance();
            this.refreshGenesisCreator();
          } else if (genesisAction === "copy-dna") {
            this.copyCharacterDNA();
          } else if (genesisAction === "apply-dna") {
            this.applyCharacterDNA(this.root.querySelector("[data-genesis-dna]")?.value || "");
          } else if (genesisAction === "save-slot") {
            this.saveAppearancePreset(`${this.state.player.name || "Nhà du hành"} · DNA`);
            this.refreshGenesisCreator();
          } else if (genesisAction === "confirm") {
            this.completeGenesisCreator();
          }
          return;
        }
        const continueButton = event.target.closest("[data-har-continue]");
        if (continueButton) return this.startGame({ fresh: false });
        const newButton = event.target.closest("[data-har-new]");
        if (newButton) return this.startGame({ fresh: true });
        if (event.target.closest("[data-har-retry]")) return this.startGame({ fresh: false });
        if (event.target.closest("[data-har-safe-mode]")) {
          this.forceCompatibility = true;
          return this.startGame({ fresh: false });
        }
        const panelButton = event.target.closest("[data-har-panel]");
        if (panelButton) return this.openPanel(panelButton.dataset.harPanel);
        const teamButton = event.target.closest("[data-character]");
        if (teamButton) return this.switchCharacter(teamButton.dataset.character);
        if (event.target.closest("[data-har-photo]")) return this.togglePhotoMode();
        const photoAction = event.target.closest("[data-photo-action]")?.dataset.photoAction;
        if (photoAction === "close") return this.togglePhotoMode(false);
        if (photoAction === "toggle-ui") {
          this.photoSettings.hideUi = !this.photoSettings.hideUi;
          this.root.classList.toggle("is-photo-clean", this.photoSettings.hideUi);
          return;
        }
        if (photoAction === "capture") return this.capturePhoto();
        if (event.target.closest("[data-har-panel-close]")) return this.closePanel();
        if (event.target.closest("[data-har-fullscreen]")) return this.toggleFullscreen();
        if (event.target.closest("[data-har-pause]")) return this.togglePause();
        const action = event.target.closest("[data-har-action]")?.dataset.harAction;
        if (action) return this.performAction(action);
        const element = event.target.closest("[data-element]")?.dataset.element;
        if (element) return this.setElement(element);
        const touchAction = event.target.closest("[data-touch-action]")?.dataset.touchAction;
        if (touchAction) return this.performAction(touchAction);
      });
      this.listen(this.root, "input", (event) => {
        const genesisMorph = event.target.closest("[data-genesis-morph]");
        if (genesisMorph) {
          const value = Number(genesisMorph.value);
          this.updateAppearanceDraft(genesisMorph.dataset.genesisMorph, value);
          const output = this.root.querySelector(`[data-genesis-output="${genesisMorph.dataset.genesisMorph}"]`);
          if (output) output.textContent = String(Math.round(value * 100));
          return;
        }
        const genesisDecal = event.target.closest("[data-genesis-decal]");
        if (genesisDecal) {
          const value = clamp(Number(genesisDecal.value), 0, 1);
          this.updateAppearanceDetail("decals", genesisDecal.dataset.genesisDecal, value);
          const output = genesisDecal.closest("label")?.querySelector("output");
          if (output) output.textContent = String(Math.round(value * 100));
          return;
        }
        const genesisSurface = event.target.closest("[data-genesis-surface]");
        if (genesisSurface) {
          const value = clamp(Number(genesisSurface.value), 0, 1);
          this.updateAppearanceDetail("surface", genesisSurface.dataset.genesisSurface, value);
          const output = genesisSurface.closest("label")?.querySelector("output");
          if (output) output.textContent = String(Math.round(value * 100));
          return;
        }
        const genesisSetting = event.target.closest("[data-genesis-setting]");
        if (genesisSetting) {
          this.updateAppearanceDraft(genesisSetting.dataset.genesisSetting, genesisSetting.value);
          return;
        }
        if (event.target.matches("[data-genesis-name]")) {
          this.state.player.name = String(event.target.value || "").slice(0, 40);
          return;
        }
        const key = event.target?.dataset?.photoSetting;
        if (!key) return;
        let value = event.target.value;
        if (["fov", "exposure", "time"].includes(key)) value = Number(value);
        this.photoSettings[key] = value;
        if (key === "fov" && this.camera) {
          this.camera.fov = value;
          this.camera.updateProjectionMatrix();
        } else if (key === "exposure" && this.renderer) {
          this.renderer.toneMappingExposure = value / 100;
        } else if (key === "time") {
          this.state.worldTime = value;
          this.updateWorld(0, performance.now());
        } else if (key === "weather") {
          this.updateWeatherAppearance();
        }
      });
      this.listen(this.root, "change", async (event) => {
        const genesisCatalog = event.target.closest("[data-genesis-catalog]");
        if (genesisCatalog) {
          const modelId = String(genesisCatalog.value || "");
          if (/^valid-[a-z0-9-]{3,72}$/.test(modelId) && modelId !== this.activeAppearanceRecipe().baseModel) {
            genesisCatalog.disabled = true;
            this.root.dataset.characterCatalogLoading = "true";
            const status = this.root.querySelector("[data-genesis-status]");
            if (status) status.textContent = "Đang tải model người thật đã chọn...";
            try {
              this.updateAppearanceDraft("baseModel", modelId);
              this.commitAppearanceDraft();
              await this.loadCharacterAssetsFromPipeline();
              this.rebuildActiveBuiltInCharacter();
              this.refreshGenesisCreator();
              const source = this.builtInCharacterSources.get(modelId);
              this.toast(source?.provider === "valid-avatar" ? "Đã tải model người thật vào preview 3D." : "Model mạng chưa sẵn sàng; đang giữ GLB local an toàn.", source?.provider === "valid-avatar" ? "success" : "error");
            } finally {
              this.root.dataset.characterCatalogLoading = "false";
            }
          }
          return;
        }
        if (event.target.matches("[data-genesis-morph], [data-genesis-setting], [data-genesis-decal], [data-genesis-surface]")) {
          this.commitAppearanceDraft();
          this.refreshGenesisCreator();
        }
      });
      this.root.querySelectorAll('[data-cinematic-action="close"], [data-cinematic-action="enter"]').forEach((button) => {
        this.listen(button, "click", (event) => {
          event.stopPropagation();
          this.closeCinematicGallery({ enterZone: button.dataset.cinematicAction === "enter" });
        });
      });
    }

    bindGameEvents() {
      const canvas = this.root.querySelector("[data-har-world]");
      this.listen(root, "keydown", (event) => {
        if (!this.running || this.destroyed) return;
        if (this.genesisActive) return;
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || "")) return;
        if (this.cinematicSequence.active) {
          if (event.code === "Escape") {
            event.preventDefault();
            this.closeCinematicGallery();
          }
          return;
        }
        const handled = [
          "KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
          "Space", "KeyF", "KeyE", "KeyR", "KeyQ", "KeyG", "KeyT", "Tab", "Escape",
          "KeyI", "KeyM", "KeyJ", "KeyK", "KeyP", "KeyC", "KeyO", "Digit1", "Digit2", "Digit3", "Digit4"
        ];
        if (handled.includes(event.code)) event.preventDefault();
        if (event.repeat && !["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) return;
        this.keys.add(event.code);
        const actions = {
          KeyF: "attack",
          KeyE: "skill",
          KeyR: "ultimate",
          KeyQ: "dodge",
          KeyG: "interact",
          KeyT: "interact",
          Space: "jump",
          Tab: "lock"
        };
        if (actions[event.code]) this.performAction(actions[event.code]);
        if (event.code === "Escape") {
          if (this.cinematicSequence.active) this.closeCinematicGallery();
          else if (!this.root.querySelector("[data-har-dialogue]").hidden) this.closeDialogue();
          else if (this.currentPanel) this.closePanel();
          else this.togglePause();
        }
        const panels = { KeyI: "inventory", KeyM: "map", KeyJ: "quests", KeyK: "skills", KeyP: "party" };
        if (panels[event.code]) this.openPanel(panels[event.code]);
        if (event.code === "KeyC") this.openPanel("characters");
        if (event.code === "KeyO") this.togglePhotoMode();
        if (/^Digit[1-4]$/.test(event.code)) this.switchCharacter(CHARACTER_ORDER[Number(event.code.slice(-1)) - 1]);
      });
      this.listen(root, "keyup", (event) => this.keys.delete(event.code));
      this.listen(root, "blur", () => this.keys.clear());
      this.listen(root, "resize", () => this.resize());
      this.listen(document, "visibilitychange", () => {
        this.visible = document.visibilityState !== "hidden";
        if (!this.visible) {
          this.runtime?.pause?.({ gameId: GAME_ID, reason: "hidden-tab" });
          this.saveProgress("Ẩn tab");
        } else if (!this.paused) {
          this.lastFrameAt = performance.now();
          this.runtime?.resume?.({ gameId: GAME_ID });
        }
      });
      this.listen(root, "online", () => {
        this.toast("Đã có mạng. Đang kiểm tra máy chủ realtime...", "success");
        this.initRealtime();
        this.syncCloud(false);
      });
      this.listen(root, "offline", () => {
        this.authoritative = false;
        this.state.party.status = "offline";
        this.state.party.integrity = "local-simulation";
        this.updateConnectionUi();
      });

      this.listen(canvas, "contextmenu", (event) => event.preventDefault());
      this.listen(canvas, "pointerdown", (event) => {
        if (this.genesisActive || event.button === 2 || event.pointerType === "touch") {
          this.draggingCamera = true;
          this.pointerStart = { x: event.clientX, y: event.clientY };
          canvas.setPointerCapture?.(event.pointerId);
        } else if (event.button === 0) {
          this.attack("attack");
        }
      });
      this.listen(canvas, "pointermove", (event) => {
        if (!this.draggingCamera || !this.pointerStart) return;
        const sensitivity = clamp(this.state.settings.cameraSensitivity, 10, 100) / 100;
        this.cameraYaw -= (event.clientX - this.pointerStart.x) * 0.006 * sensitivity;
        const minimumPitch = this.genesisActive ? -0.02 : 0.08;
        const maximumPitch = this.genesisActive ? 0.78 : 0.62;
        this.cameraPitch = clamp(this.cameraPitch + (event.clientY - this.pointerStart.y) * 0.0035 * sensitivity, minimumPitch, maximumPitch);
        this.pointerStart = { x: event.clientX, y: event.clientY };
      });
      const stopCameraDrag = (event) => {
        this.draggingCamera = false;
        this.pointerStart = null;
        try { canvas.releasePointerCapture?.(event.pointerId); } catch {}
      };
      this.listen(canvas, "pointerup", stopCameraDrag);
      this.listen(canvas, "pointercancel", stopCameraDrag);
      this.listen(canvas, "wheel", (event) => {
        event.preventDefault();
        this.cameraDistance = clamp(this.cameraDistance + Math.sign(event.deltaY) * 1.25, this.genesisActive ? 2.6 : 6.5, this.genesisActive ? 12 : 20);
      }, { passive: false });

      this.bindTouchJoystick();
    }

    bindTouchJoystick() {
      const joystick = this.root.querySelector("[data-har-joystick]");
      const nub = joystick?.querySelector("i");
      if (!joystick || !nub) return;
      let pointerId = null;
      const move = (event) => {
        if (pointerId !== event.pointerId) return;
        const rect = joystick.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const radius = rect.width * 0.32;
        const length = Math.hypot(dx, dy) || 1;
        const scale = Math.min(1, radius / length);
        const x = dx * scale;
        const y = dy * scale;
        nub.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
        this.touchMove.x = clamp(x / radius, -1, 1);
        this.touchMove.z = clamp(-y / radius, -1, 1);
      };
      const end = (event) => {
        if (pointerId !== event.pointerId) return;
        pointerId = null;
        this.touchMove = { x: 0, z: 0 };
        nub.style.transform = "translate(-50%, -50%)";
      };
      this.listen(joystick, "pointerdown", (event) => {
        pointerId = event.pointerId;
        joystick.setPointerCapture?.(event.pointerId);
        move(event);
      });
      this.listen(joystick, "pointermove", move);
      this.listen(joystick, "pointerup", end);
      this.listen(joystick, "pointercancel", end);
    }

    performAction(action) {
      if (!this.running || this.paused || this.photoMode || this.destroyed) return;
      if (action === "attack") this.attack("attack");
      else if (action === "skill") this.attack("skill");
      else if (action === "ultimate") this.attack("ultimate");
      else if (action === "dodge") this.dodge();
      else if (action === "jump") this.jumpOrGlide();
      else if (action === "interact") this.interact();
      else if (action === "lock") this.toggleTargetLock();
    }

    switchCharacter(characterId) {
      const profile = CHARACTERS[characterId];
      if (!profile || !this.state.roster.unlocked.includes(characterId)) return;
      if (!this.running || this.photoMode || this.state.player.health <= 0) return;
      const now = performance.now();
      if (now - this.characterSwitchAt < 650 || characterId === this.state.roster.activeId) return;

      const previousId = this.state.roster.activeId;
      const previousMember = this.state.roster.members[previousId];
      if (previousMember) {
        previousMember.health = this.state.player.health;
        previousMember.maxHealth = this.state.player.maxHealth;
        previousMember.ultimate = this.state.player.ultimate;
      }

      const nextMember = this.state.roster.members[characterId] || { health: 100, maxHealth: 100, ultimate: 0, level: 1 };
      this.state.roster.members[characterId] = nextMember;
      this.state.roster.activeId = characterId;
      this.state.player.name = profile.name;
      this.state.player.element = profile.element;
      this.state.player.health = clamp(nextMember.health, 1, nextMember.maxHealth || 100);
      this.state.player.maxHealth = Number(nextMember.maxHealth || 100);
      this.state.player.ultimate = clamp(nextMember.ultimate, 0, 100);
      const loadout = this.state.loadouts?.[characterId];
      if (loadout?.weapon && this.state.inventory[loadout.weapon]?.quantity > 0) this.state.player.weapon = loadout.weapon;

      this.characterMeshes.forEach((mesh, id) => {
        mesh.visible = id === characterId;
        this.positionCharacterInWorld(mesh, this.state.player.x, this.state.player.y, this.state.player.z);
        mesh.rotation.y = this.state.player.rotation;
      });
      this.playerMesh = this.characterMeshes.get(characterId);
      this.refreshEquippedWeapon(characterId);
      this.playerWeapon = this.playerMesh.userData.weapon;
      this.resetGameplayCharacterVisibility("character-switch");
      this.characterSwitchAt = now;
      this.combo = 0;
      this.setCharacterAction("idle", 80, 0);
      this.setElement(profile.element, false);
      this.root.querySelectorAll("[data-character]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.character === characterId);
      });
      this.spawnNova(this.state.player.x, this.state.player.y + 1.2, this.state.player.z, profile.accent);
      this.cameraShake = Math.max(this.cameraShake, 0.2);
      this.sound("collect");
      this.toast(`${profile.name} · ${profile.role}`, "success");
      this.updateUi(true);
    }

    updateCharacterAnimation(dt, time, input, sprinting) {
      const mesh = this.playerMesh;
      if (!mesh) return;
      const parts = mesh.userData?.parts;
      const moving = Boolean(input?.active);
      const targetAnimation = this.resolveCharacterMotion(input, sprinting, time);
      if (targetAnimation !== this.activeAnimation) {
        this.activeAnimation = targetAnimation;
        this.animationBlend = 0;
      }
      this.animationBlend = clamp(this.animationBlend + dt * 8, 0, 1);
      const runtime = mesh.userData.characterRuntime || this.characterRuntimes.get(this.state.roster.activeId);
      this.updateCharacterLod(mesh, 0);
      const lowDetailTier = ["crowd", "impostor"].includes(mesh.userData?.modelTier);
      const cadence = targetAnimation === "sprint"
        ? 11.2
        : targetAnimation === "run" || targetAnimation === "strafe"
          ? 8.1
          : targetAnimation === "walk"
            ? 5.2
            : targetAnimation === "climb"
              ? 4.6
              : 1.15;
      if (runtime) {
        const targetSpeed = moving ? clamp((input?.magnitude || 1) * (sprinting ? 1.18 : 1), 0, 1) : 0;
        const previousSpeed = Number(runtime.motionSpeed || 0);
        runtime.motionSpeed += (targetSpeed - runtime.motionSpeed) * (1 - Math.exp(-dt * 12));
        const targetDirection = Math.atan2(input?.x || 0, input?.z || 1);
        const directionDelta = Math.atan2(Math.sin(targetDirection - runtime.motionDirection), Math.cos(targetDirection - runtime.motionDirection));
        runtime.motionDirection += directionDelta * (1 - Math.exp(-dt * 10));
        runtime.acceleration += (((runtime.motionSpeed - previousSpeed) / Math.max(0.001, dt)) - runtime.acceleration) * (1 - Math.exp(-dt * 8));
        runtime.yawVelocity += ((directionDelta / Math.max(0.001, dt)) - runtime.yawVelocity) * (1 - Math.exp(-dt * 9));
        runtime.gaitPhase = (runtime.gaitPhase + dt * cadence * Math.max(0.18, runtime.motionSpeed)) % (Math.PI * 2);
        runtime.motionWarp ||= {};
        Object.assign(runtime.motionWarp, {
          speed: runtime.motionSpeed,
          direction: runtime.motionDirection,
          acceleration: runtime.acceleration,
          yawVelocity: runtime.yawVelocity,
          target: this.lockedTargetId || "",
          mode: this.lockedTargetId ? "combat-facing" : "locomotion-facing"
        });
      }
      const useVerifiedRestSolver = runtime?.motionProfile === "valid-rest-solver";
      if (useVerifiedRestSolver && !runtime.lodSuspended) {
        this.applyVerifiedRestPoseMotion(runtime, time, targetAnimation);
      } else if (runtime?.mixer && !runtime.lodSuspended) {
        const blendable = ["idle", "walk", "run", "sprint", "strafe"].includes(targetAnimation);
        const blended = blendable && this.updateLocomotionBlendSpace(runtime, runtime.motionSpeed, runtime.motionDirection, dt);
        if (!blended) {
          this.fadeLocomotionBlend(runtime, dt);
          this.playCharacterClip(runtime, targetAnimation);
        }
        runtime.mixer.timeScale = 1;
        runtime.mixer.update(dt);
      } else if (runtime && !runtime.lodSuspended) {
        this.applyProceduralRigMotion(runtime, time, targetAnimation, dt);
      }
      if (runtime && !runtime.lodSuspended && !useVerifiedRestSolver) this.applyAdditiveAnimationLayers(runtime, time, targetAnimation, dt);
      if (runtime && !runtime.lodSuspended && !useVerifiedRestSolver) this.applyMotionWarping(runtime, time, dt);
      if (runtime && !runtime.lodSuspended) this.applyNaturalHandPose(runtime, targetAnimation, dt);
      const gaitPhase = runtime?.gaitPhase ?? time * 0.002;
      const normalizedGaitPhase = ((gaitPhase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2);
      const phase = Math.sin(gaitPhase);
      const previousPhase = this.motionState.gaitPhase;
      this.motionState.gaitPhase = phase;
      if (moving && this.isGrounded && !this.isSwimming && !this.isClimbing && Math.sign(previousPhase) !== Math.sign(phase)) {
        const foot = phase >= 0 ? "left" : "right";
        if (this.motionState.foot !== foot) {
          this.motionState.foot = foot;
          this.emitFootprint(time);
        }
      }

      if (!lowDetailTier && parts?.leftLeg && parts?.rightLeg && parts?.leftArm && parts?.rightArm) {
        const actionPhase = clamp((time - this.characterAction.startedAt) / Math.max(1, this.characterAction.duration), 0, 1);
        const pose = {
          leftLegX: moving ? phase * (targetAnimation === "sprint" ? 0.68 : targetAnimation === "walk" ? 0.34 : 0.46) : Math.sin(time * 0.0015) * 0.018,
          rightLegX: moving ? -phase * (targetAnimation === "sprint" ? 0.68 : targetAnimation === "walk" ? 0.34 : 0.46) : -Math.sin(time * 0.0015) * 0.018,
          leftArmX: moving ? -phase * (targetAnimation === "sprint" ? 0.58 : targetAnimation === "walk" ? 0.3 : 0.38) : Math.sin(time * 0.0012) * 0.025,
          rightArmX: moving ? phase * (targetAnimation === "sprint" ? 0.58 : targetAnimation === "walk" ? 0.3 : 0.38) : -Math.sin(time * 0.0012) * 0.025,
          leftArmZ: -0.06,
          rightArmZ: 0.06,
          torsoX: 0,
          torsoZ: moving ? Math.sin(time * cadence * 0.5) * 0.035 - (input?.x || 0) * 0.045 : Math.sin(time * 0.0013) * 0.014
        };
        if (targetAnimation === "strafe") {
          pose.torsoZ = -input.x * 0.12;
          pose.leftArmX *= 0.58;
          pose.rightArmX *= 0.58;
        } else if (targetAnimation === "jump") {
          pose.leftLegX = -0.42;
          pose.rightLegX = 0.24;
          pose.leftArmX = -0.38;
          pose.rightArmX = -0.38;
          pose.torsoX = -0.12;
        } else if (targetAnimation === "fall" || targetAnimation === "glide") {
          pose.leftLegX = 0.18;
          pose.rightLegX = -0.18;
          pose.leftArmZ = targetAnimation === "glide" ? -1.05 : -0.45;
          pose.rightArmZ = targetAnimation === "glide" ? 1.05 : 0.45;
          pose.torsoX = 0.16;
        } else if (targetAnimation === "swim") {
          pose.leftArmX = Math.sin(time * 0.006) * 1.05;
          pose.rightArmX = Math.sin(time * 0.006 + Math.PI) * 1.05;
          pose.leftLegX = Math.sin(time * 0.008) * 0.34;
          pose.rightLegX = -pose.leftLegX;
          pose.torsoX = Math.PI / 2.8;
        } else if (targetAnimation === "climb") {
          pose.leftArmX = Math.sin(time * 0.009) * 0.85 - 0.7;
          pose.rightArmX = Math.sin(time * 0.009 + Math.PI) * 0.85 - 0.7;
          pose.leftLegX = -pose.rightArmX * 0.58;
          pose.rightLegX = -pose.leftArmX * 0.58;
        } else if (targetAnimation === "dodge") {
          pose.leftLegX = -0.62;
          pose.rightLegX = 0.52;
          pose.leftArmX = 0.72;
          pose.rightArmX = -0.72;
          pose.torsoX = -0.56;
          pose.torsoZ = 0.34;
        } else if (targetAnimation.startsWith("attack") || ["skill", "ultimate"].includes(targetAnimation)) {
          const swing = Math.sin((1 - actionPhase) * Math.PI);
          pose.rightArmX = -0.4 - swing * (targetAnimation === "ultimate" ? 1.4 : 1.05);
          pose.rightArmZ = 0.18 + swing * 0.58;
          pose.leftArmX = targetAnimation === "ultimate" ? -0.72 : -0.18;
          pose.torsoZ = swing * (this.combo % 2 ? -0.3 : 0.3);
        } else if (targetAnimation === "hit") {
          pose.leftArmX = 0.48;
          pose.rightArmX = 0.48;
          pose.torsoX = 0.34;
          pose.torsoZ = -0.18;
        } else if (targetAnimation === "land") {
          pose.leftLegX = -0.24;
          pose.rightLegX = -0.24;
          pose.leftArmX = 0.2;
          pose.rightArmX = 0.2;
          pose.torsoX = 0.22;
        }
        const blend = 1 - Math.pow(0.00045, dt);
        const damp = (object, axis, value) => {
          if (object?.rotation) object.rotation[axis] += (value - object.rotation[axis]) * blend;
        };
        damp(parts.leftLeg, "x", pose.leftLegX);
        damp(parts.rightLeg, "x", pose.rightLegX);
        damp(parts.leftArm, "x", pose.leftArmX);
        damp(parts.rightArm, "x", pose.rightArmX);
        damp(parts.leftArm, "z", pose.leftArmZ);
        damp(parts.rightArm, "z", pose.rightArmZ);
        damp(parts.torso, "x", pose.torsoX);
        damp(parts.torso, "z", pose.torsoZ);
        if (parts.leftFoot && parts.rightFoot) {
          const footLift = moving && this.isGrounded ? Math.max(0, phase) * 0.055 : 0;
          parts.leftFoot.position.y += ((0.02 + footLift) - parts.leftFoot.position.y) * blend;
          parts.rightFoot.position.y += ((0.02 + Math.max(0, -phase) * 0.055) - parts.rightFoot.position.y) * blend;
          parts.leftFoot.rotation.x += ((this.isGrounded ? -pose.leftLegX * 0.18 : 0.18) - parts.leftFoot.rotation.x) * blend;
          parts.rightFoot.rotation.x += ((this.isGrounded ? -pose.rightLegX * 0.18 : 0.18) - parts.rightFoot.rotation.x) * blend;
        }
        if (parts.head) {
          parts.head.rotation.y += ((Math.sin(time * 0.00065) * (moving ? 0.025 : 0.07)) - parts.head.rotation.y) * blend;
          parts.head.rotation.x += ((targetAnimation === "sprint" ? -0.08 : targetAnimation === "hit" ? 0.12 : 0) - parts.head.rotation.x) * blend;
        }
        if (parts.hair) {
          parts.hair.rotation.x = 0.02 + Math.sin(time * 0.003) * (sprinting ? 0.08 : moving ? 0.052 : 0.024);
          parts.hair.children.forEach((lock, index) => {
            if (!lock.userData.secondaryMotion) return;
            lock.rotation.x = Math.sin(time * 0.0024 + index * 0.7) * lock.userData.secondaryMotion * (sprinting ? 2.2 : moving ? 1.35 : 0.65);
          });
        }
        parts.eyes?.forEach((eye, index) => {
          eye.rotation.y = clamp((this.cameraYaw - this.state.player.rotation) * 0.08, -0.16, 0.16);
          eye.rotation.x = Math.sin(time * 0.0008 + index) * 0.018;
        });
        if (parts.cape) parts.cape.rotation.x = (sprinting ? 0.72 : this.gliding ? 0.48 : moving ? 0.32 : 0.12) + Math.sin(time * 0.004) * 0.04;
        if (parts.halo) parts.halo.rotation.z += dt * 0.7;
        if (parts.leftWing && parts.rightWing) {
          parts.leftWing.visible = this.gliding;
          parts.rightWing.visible = this.gliding;
          if (this.gliding) {
            parts.leftWing.rotation.z = -0.28 + Math.sin(time * 0.003) * 0.06;
            parts.rightWing.rotation.z = 0.28 - Math.sin(time * 0.003) * 0.06;
          }
        }
        this.applyCorrectiveMorphs(mesh);
      }
      this.applyFootContactIK(runtime, normalizedGaitPhase, targetAnimation, moving && this.isGrounded ? 1 : 0.12, dt);
      this.updateSecondaryCharacterMotion(runtime, time, {
        moving,
        sprinting,
        direction: runtime?.motionDirection || 0
      });
      if (!lowDetailTier) {
        this.applyProceduralFacialPerformance(mesh, time, targetAnimation);
        this.updateCharacterSurface(mesh, time);
      }
    }

    togglePhotoMode(force) {
      if (!this.running || !this.camera) return;
      const next = typeof force === "boolean" ? force : !this.photoMode;
      this.photoMode = next;
      this.menuPaused = next;
      this.root.classList.toggle("is-photo-mode", next);
      this.root.classList.toggle("is-photo-clean", next && this.photoSettings.hideUi);
      const panel = this.root.querySelector("[data-har-photo-ui]");
      if (panel) panel.hidden = !next;
      if (next) {
        this.photoSettings.time = this.state.worldTime;
        this.photoSettings.fov = this.camera.fov;
        this.photoSettings.exposure = Math.round(this.renderer.toneMappingExposure * 100);
        this.root.querySelector('[data-photo-setting="time"]').value = String(this.photoSettings.time);
        this.root.querySelector('[data-photo-setting="fov"]').value = String(this.photoSettings.fov);
        this.root.querySelector('[data-photo-setting="exposure"]').value = String(this.photoSettings.exposure);
        this.toast("Photo Mode · kéo chuột để chọn góc máy.");
      } else {
        this.cameraFovTarget = CINEMATIC_CAMERA.verticalFovDeg;
        this.camera.fov = CINEMATIC_CAMERA.verticalFovDeg;
        this.camera.updateProjectionMatrix();
        this.renderer.toneMappingExposure = this.state.settings.quality === "cinematic" ? 1.08 : 0.98;
        this.root.classList.remove("is-photo-clean");
      }
    }

    capturePhoto() {
      const canvas = this.renderer?.domElement;
      if (!canvas) return;
      this.renderer.render(this.scene, this.camera);
      canvas.toBlob((blob) => {
        if (!blob) {
          this.toast("Thiết bị không tạo được ảnh PNG.", "error");
          return;
        }
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `hh-astral-realms-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
        anchor.click();
        root.setTimeout(() => URL.revokeObjectURL(url), 1500);
        this.toast("Đã lưu ảnh Photo Mode.", "success");
      }, "image/png");
    }

    frame(time) {
      if (this.destroyed) return;
      const stableFrameInterval = this.forceCompatibility || this.state.settings.quality === "low" ? 1000 / 30 : 0;
      if (stableFrameInterval && this.lastProcessedFrameAt && time - this.lastProcessedFrameAt < stableFrameInterval - 1) {
        this.frameHandle = requestAnimationFrame((next) => this.frame(next));
        return;
      }
      this.lastProcessedFrameAt = time;
      try {
        const dt = Math.min(0.05, Math.max(0.001, (time - this.lastFrameAt) / 1000));
        this.lastFrameAt = time;

        if (this.visible && this.renderer && this.scene && this.camera) {
          if (this.running && !this.paused && !this.menuPaused && time >= this.hitStopUntil) {
            this.pollGamepad();
            this.updatePlayer(dt, time);
            if (!this.authoritative) this.updateEnemies(dt, time);
            this.updateWorld(dt, time);
            this.updateEffects(dt);
            this.updateNearby();
            this.sendRealtimeInput(time);
            this.state.playTime += dt;
            this.state.worldTime = (this.state.worldTime + dt * this.worldHoursPerSecond) % 24;
          }
          if (this.genesisActive) {
            const runtime = this.characterRuntimes.get(this.state.roster.activeId);
            if (runtime?.mixer) {
              this.playCharacterClip(runtime, this.genesisMotion || "idle");
              runtime.mixer.update(dt);
            } else if (runtime) {
              this.applyProceduralRigMotion(runtime, time, this.genesisMotion || "idle", dt);
            }
            this.applyProceduralFacialPerformance(this.playerMesh, time, this.genesisMotion || "idle");
            this.updateSecondaryCharacterMotion(runtime, time, {
              moving: ["walk", "run", "strafe"].includes(this.genesisMotion),
              sprinting: this.genesisMotion === "run",
              direction: this.genesisMotion === "strafe" ? 0.8 : 0
            });
            this.renderGenesisFrame(time, dt);
          } else {
            if (this.cinematicSequence.active) this.updateStoryCinematic(dt, time);
            this.updateCamera(false, dt);
            const renderScene = this.cinematicSequence.active && this.cinematicScene ? this.cinematicScene : this.scene;
            this.renderer.render(renderScene, this.camera);
            if (this.cinematicSequence.active) this.confirmCinematicSubjectFrame(time);
            const characterReport = this.validateGameplayCharacterFrame(time);
            if (this.pendingStartReveal) {
              if (characterReport?.modelReady) this.startRevealFrames += 1;
              const revealElapsed = performance.now() - Number(this.startRevealStartedAt || 0);
              const rendererWarm = this.startRevealFrames >= 4 || (this.startRevealFrames >= 2 && revealElapsed >= 4200);
              if (this.gameplayVisibility?.validated && rendererWarm && revealElapsed >= 900) {
                this.pendingStartReveal = false;
                const start = this.root.querySelector("[data-har-start]");
                if (start) start.hidden = true;
                this.setLoading(100, "Cảnh 3D đã sẵn sàng.");
              }
            }
          }
          this.lastRenderSuccessAt = time;
          this.trackFps(time);
          if (time - this.lastUiAt > 120) {
            this.lastUiAt = time;
            this.updateUi(false);
          }
          if (!this.cinematicSequence.active && time - this.lastMinimapAt > 180) {
            this.lastMinimapAt = time;
            this.renderMinimap();
          }
        }
      } catch (error) {
        this.enterRendererRecovery(error?.message || "Renderer không thể vẽ khung hình.");
        return;
      }
      this.frameHandle = requestAnimationFrame((next) => this.frame(next));
    }

    pollGamepad() {
      const pads = root.navigator?.getGamepads?.() || [];
      const pad = Array.from(pads).find(Boolean);
      if (!pad) {
        this.gamepadMove = { x: 0, z: 0 };
        return;
      }
      this.gamepadMove = {
        x: Math.abs(pad.axes[0] || 0) > 0.16 ? pad.axes[0] : 0,
        z: Math.abs(pad.axes[1] || 0) > 0.16 ? -(pad.axes[1] || 0) : 0
      };
      const current = pad.buttons.map((button) => button.pressed);
      const previous = this.gamepads[pad.index] || [];
      if (current[0] && !previous[0]) this.attack("attack");
      if (current[1] && !previous[1]) this.dodge();
      if (current[2] && !previous[2]) this.attack("skill");
      if (current[3] && !previous[3]) this.jumpOrGlide();
      if (current[4] && !previous[4]) this.interact();
      this.gamepads[pad.index] = current;
      const rightX = Math.abs(pad.axes[2] || 0) > 0.15 ? pad.axes[2] : 0;
      const rightY = Math.abs(pad.axes[3] || 0) > 0.15 ? pad.axes[3] : 0;
      this.cameraYaw -= rightX * 0.045;
      this.cameraPitch = clamp(this.cameraPitch + rightY * 0.025, 0.08, 0.62);
    }

    movementInput() {
      const keyboardX = (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) - (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0);
      const keyboardZ = (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) - (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);
      const gamepad = this.gamepadMove || { x: 0, z: 0 };
      let x = clamp(keyboardX + this.touchMove.x + gamepad.x, -1, 1);
      let z = clamp(keyboardZ + this.touchMove.z + gamepad.z, -1, 1);
      const length = Math.hypot(x, z);
      const magnitude = clamp(length, 0, 1);
      if (length > 0.0001) {
        x /= length;
        z /= length;
      }
      return { x, z, magnitude, active: length > 0.03 };
    }

    updatePlayer(dt, time) {
      const input = this.movementInput();
      const player = this.state.player;
      const character = CHARACTERS[this.state.roster.activeId] || CHARACTERS.lyra;
      const sprinting = (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) && input.active && player.stamina > 0;
      const staminaBonus = Number(this.state.skills.staminaCore || 0) * 10;
      player.maxStamina = 100 + staminaBonus;
      const inAuroraLake = Math.hypot(player.x + 51, player.z - 20) < 12.6 && player.y < 1.8;
      this.isSwimming = inAuroraLake;
      const climbTarget = this.climbables.find((entry) => {
        const distance = Math.hypot(player.x - entry.object.position.x, player.z - entry.object.position.z);
        return distance <= entry.radius + 0.75 && player.y < entry.top;
      });
      this.isClimbing = Boolean(
        climbTarget
        && this.keys.has("Space")
        && player.stamina > 0
        && !this.isSwimming
      );
      const speed = (this.isSwimming ? 3.25 : sprinting ? 8.2 : 5.35) * character.speedScale;
      const forwardX = -Math.sin(this.cameraYaw);
      const forwardZ = -Math.cos(this.cameraYaw);
      const rightX = Math.cos(this.cameraYaw);
      const rightZ = -Math.sin(this.cameraYaw);
      let dx = (forwardX * input.z + rightX * input.x) * speed * input.magnitude * dt;
      let dz = (forwardZ * input.z + rightZ * input.x) * speed * input.magnitude * dt;

      if (this.dodgeUntil && time < this.dodgeUntil) {
        dx *= 2.25;
        dz *= 2.25;
      }

      if (input.active) {
        const nextX = clamp(player.x + dx, -WORLD_LIMIT, WORLD_LIMIT);
        const nextZ = clamp(player.z + dz, -WORLD_LIMIT, WORLD_LIMIT);
        const traveled = Math.hypot(nextX - player.x, nextZ - player.z);
        player.x = nextX;
        player.z = nextZ;
        this.state.stats.distance += traveled;
        const legs = this.playerMesh.userData?.parts;
        this.playerMesh.userData.hasProceduralLegs = Boolean(legs?.leftLeg && legs?.rightLeg);
      }
      const lockedEnemy = this.lockedTargetId ? this.enemies.get(this.lockedTargetId) : null;
      const hasActiveLock = Boolean(lockedEnemy?.visible && !lockedEnemy.userData?.dead);
      if (input.active || hasActiveLock) {
        const targetRotation = hasActiveLock
          ? Math.atan2(lockedEnemy.position.x - player.x, lockedEnemy.position.z - player.z)
          : Math.atan2(dx, dz);
        const yawDelta = Math.atan2(Math.sin(targetRotation - player.rotation), Math.cos(targetRotation - player.rotation));
        player.rotation += yawDelta * (this.state.settings.naturalMotion ? 1 - Math.exp(-dt * 13) : 1);
        this.playerMesh.rotation.y = player.rotation;
      }

      if (this.isClimbing) {
        this.isGrounded = false;
        this.gliding = false;
        this.verticalVelocity = 0;
        player.y = Math.min(climbTarget.top, player.y + dt * 2.8);
        player.stamina = clamp(player.stamina - dt * 18, 0, player.maxStamina);
      } else if (this.isSwimming) {
        this.isGrounded = false;
        this.gliding = false;
        this.verticalVelocity = 0;
        player.y = 1.36 + Math.sin(time * 0.003) * 0.06;
        if (input.active) player.stamina = clamp(player.stamina - dt * 5.5, 0, player.maxStamina);
      } else if (sprinting) player.stamina = clamp(player.stamina - dt * 20, 0, player.maxStamina);
      else if (!this.gliding) player.stamina = clamp(player.stamina + dt * 15, 0, player.maxStamina);

      if (!this.isGrounded && !this.isClimbing && !this.isSwimming) {
        const gravity = this.gliding && player.stamina > 0 ? -5.2 : -18;
        this.verticalVelocity += gravity * dt;
        if (this.gliding) player.stamina = clamp(player.stamina - dt * 11, 0, player.maxStamina);
        if (player.stamina <= 0) this.gliding = false;
        player.y += this.verticalVelocity * dt;
        if (player.y <= 1.08) {
          player.y = 1.08;
          this.verticalVelocity = 0;
          this.isGrounded = true;
          this.gliding = false;
          this.characterLandAt = time;
        }
      }

      this.positionCharacterInWorld(this.playerMesh, player.x, player.y, player.z);
      this.characterMeshes.forEach((mesh, id) => {
        if (id === this.state.roster.activeId) return;
        this.positionCharacterInWorld(mesh, player.x, player.y, player.z);
        mesh.rotation.y = player.rotation;
      });
      this.updateCharacterAnimation(dt, time, input, sprinting);
      this.root.classList.toggle("is-swimming", this.isSwimming);
      this.root.classList.toggle("is-climbing", this.isClimbing);
      this.playerShadow.position.set(player.x, 1.08, player.z);
      this.playerShadow.material.opacity = clamp(0.34 - (player.y - 1.08) * 0.028, 0.08, 0.34);
      const zone = this.zoneAt(player.x, player.z);
      if (zone.id !== this.currentZone.id) {
        this.currentZone = zone;
        const worldZone = this.state.world?.zones?.[zone.id];
        if (worldZone && !worldZone.discovered) {
          worldZone.discovered = true;
          worldZone.updatedAt = nowIso();
          this.state.exploration.mapFog[zone.id] = clamp((this.state.exploration.mapFog[zone.id] || 100) - 15, 0, 100);
          this.recordWorldEvent({ type: "discovery", title: `Đã đặt chân tới ${zone.name}`, detail: "Khu vực được ghi vào world state.", zoneId: zone.id });
          this.refreshWorldStateVisuals();
          this.saveProgress(`Khám phá ${zone.name}`);
        }
        this.toast(`${zone.name} · ${zone.weather}`);
        this.applyBiomeVisualState(zone);
        this.updateWeatherAppearance();
      }
      this.trainingActive = this.trainingSession && Math.hypot(player.x - 17, player.z + 10) < 7;
    }

    updateEnemies(dt, time) {
      const player = this.state.player;
      const activeRadius = this.state.settings.quality === "low" ? 52 : this.state.settings.quality === "medium" ? 72 : 96;
      this.enemies.forEach((enemy) => {
        const data = enemy.userData;
        if (data.defeated) {
          if (data.respawnAt && Date.now() >= data.respawnAt && !(data.boss && this.state.quests.warden?.status === "completed")) {
            data.health = data.maxHealth;
            data.defeated = false;
            data.respawnAt = 0;
            enemy.position.set(data.homeX, data.floatBase, data.homeZ);
            enemy.visible = true;
            delete this.state.defeated[data.id];
          }
          return;
        }

        const streamDistance = Math.hypot(player.x - enemy.position.x, player.z - enemy.position.z);
        if (streamDistance > activeRadius && !data.boss) {
          enemy.visible = false;
          return;
        }
        enemy.visible = true;
        enemy.position.y = data.floatBase + Math.sin(time * 0.002 + data.homeX) * 0.2;
        data.ring.rotation.z += dt * (data.boss ? 0.9 : 1.5);
        const distance = streamDistance;
        if (data.boss) this.updateBossPhase(enemy, distance, time);
        if (distance < (data.boss ? 25 : 14) && player.health > 0) {
          enemy.lookAt(player.x, enemy.position.y, player.z);
          if (distance > 2.1) {
            enemy.position.x += ((player.x - enemy.position.x) / distance) * data.speed * dt;
            enemy.position.z += ((player.z - enemy.position.z) / distance) * data.speed * dt;
          } else if (time - data.lastAttackAt > (data.boss ? 1250 : 900)) {
            data.lastAttackAt = time;
            this.damagePlayer(data.attack, data.name);
          }
        } else {
          const homeDistance = Math.hypot(data.homeX - enemy.position.x, data.homeZ - enemy.position.z);
          if (homeDistance > 0.3) {
            enemy.position.x += ((data.homeX - enemy.position.x) / homeDistance) * dt * 1.2;
            enemy.position.z += ((data.homeZ - enemy.position.z) / homeDistance) * dt * 1.2;
          }
        }
      });
    }

    updateBossPhase(enemy, distance, time) {
      const data = enemy.userData;
      const ratio = data.health / data.maxHealth;
      const nextPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
      if (nextPhase !== data.bossPhase) {
        data.bossPhase = nextPhase;
        data.speed = data.baseSpeed * (nextPhase === 2 ? 1.24 : nextPhase === 3 ? 1.52 : 1);
        data.attack = Math.round(data.baseAttack * (nextPhase === 2 ? 1.25 : nextPhase === 3 ? 1.55 : 1));
        data.weakPoint.visible = nextPhase >= 2;
        this.cinematicTarget = { object: enemy, until: performance.now() + 1250, phase: nextPhase };
        this.cameraShake = Math.max(this.cameraShake, 0.9);
        this.spawnPulse(enemy.position.x, 1.2, enemy.position.z, nextPhase === 2 ? "#ffc565" : "#ff507e", 1.1, 8.5);
        this.spawnElementBurst(enemy.position.x, enemy.position.y + 1.5, enemy.position.z, nextPhase === 2 ? "solar" : "void", 2.4);
        this.root.classList.add("is-world-event");
        root.setTimeout(() => this.root?.classList.remove("is-world-event"), 900);
        this.toast(`Nexus Warden · Phase ${nextPhase}${nextPhase === 2 ? " · Weak Point mở" : nextPhase === 3 ? " · Void Overdrive" : ""}`, "error");
      }

      if (nextPhase >= 2 && time - data.lastSpecialAt > (nextPhase === 3 ? 2600 : 3900)) {
        data.lastSpecialAt = time;
        this.spawnPulse(enemy.position.x, 1.15, enemy.position.z, nextPhase === 3 ? "#ff4f8f" : "#b37aff", 0.9, nextPhase === 3 ? 9.5 : 6.5);
        this.cameraShake = Math.max(this.cameraShake, nextPhase === 3 ? 0.72 : 0.42);
        if (distance < (nextPhase === 3 ? 8.5 : 6.2)) this.damagePlayer(nextPhase === 3 ? 26 : 16, "Nexus shockwave");
      }
    }

    updateWorld(dt, time) {
      if (this.starfield) this.starfield.rotation.y += dt * 0.0025;
      if (this.centralCore) {
        this.centralCore.position.y = this.centralCore.userData.floatBase + Math.sin(time * 0.0015) * 0.32;
        this.centralCore.rotation.y += dt * 0.28;
      }
      this.worldSpinners.forEach((object) => {
        if (object.parent?.visible !== false) object.rotation.z += dt * object.userData.spin;
      });
      this.remotePlayers.forEach((remote) => {
        const target = remote.userData.targetPosition;
        const moving = Boolean(target && remote.position.distanceToSquared(target) > 0.0025);
        if (target) {
          const blend = Math.min(1, dt * 14);
          remote.position.lerp(target, blend);
          if (Number.isFinite(remote.userData.targetRotation)) {
            const delta = Math.atan2(Math.sin(remote.userData.targetRotation - remote.rotation.y), Math.cos(remote.userData.targetRotation - remote.rotation.y));
            remote.rotation.y += delta * blend;
          }
        }
        const playerDistance = Math.hypot(
          this.state.player.x - remote.position.x,
          this.state.player.z - remote.position.z
        );
        this.updateCharacterLod(remote, playerDistance);
        const runtime = remote.userData.characterRuntime || this.characterRuntimes.get(`remote:${remote.userData.id}`);
        if (runtime?.mixer && !runtime.lodSuspended) {
          this.playCharacterClip(runtime, moving ? "run" : "idle");
          runtime.mixer.timeScale = moving ? 0.94 : 1;
          runtime.mixer.update(dt);
        }
        const parts = remote.userData.parts;
        if (!runtime?.lodSuspended && parts?.leftLeg && parts?.rightLeg) {
          const stride = Math.sin(time * 0.012 + remote.position.x * 0.2) * 0.08;
          parts.leftLeg.rotation.x = stride;
          parts.rightLeg.rotation.x = -stride;
        }
      });
      this.collectibles.forEach((node) => {
        if (!node.visible) return;
        node.position.y = node.userData.floatBase + Math.sin(time * 0.002 + node.position.x) * 0.25;
        node.rotation.y += dt * 0.72;
      });
      this.portals.forEach((portal) => {
        portal.rotation.y += dt * 0.08;
      });
      this.updateLivingWorld(dt, time);

      const dayAmount = (Math.sin(((this.state.worldTime - 6) / 24) * Math.PI * 2) + 1) / 2;
      const celestialAngle = (this.state.worldTime / 24) * Math.PI * 2 - Math.PI / 2;
      if (this.sunDisc) this.sunDisc.position.set(Math.cos(celestialAngle) * 150, Math.sin(celestialAngle) * 115, -90);
      if (this.sunCorona && this.sunDisc) {
        this.sunCorona.position.copy(this.sunDisc.position);
        const coronaPulse = 1 + Math.sin(time * 0.0014) * 0.055;
        this.sunCorona.scale.setScalar(coronaPulse);
        this.sunCorona.rotation.y += dt * 0.025;
        this.sunCorona.material.opacity = 0.08 + dayAmount * 0.16;
      }
      if (this.moonDisc) this.moonDisc.position.set(Math.cos(celestialAngle + Math.PI) * 150, Math.sin(celestialAngle + Math.PI) * 110, -82);
      if (this.sunLight) this.sunLight.position.set(
        Math.cos(celestialAngle) * 58,
        Math.max(8, Math.sin(celestialAngle) * 68),
        Math.sin(celestialAngle * 0.7) * 38
      );
      const dayColor = this.frameScratch.dayColor.setRGB(
        0.018 + dayAmount * 0.035,
        0.026 + dayAmount * 0.04,
        0.07 + dayAmount * 0.08
      );
      if (this.scene.background?.isColor) this.scene.background.copy(dayColor);
      const biomeProfile = BIOME_PROFILES[this.currentZone.id] || BIOME_PROFILES.central;
      const biomeFog = this.frameScratch.biomeFog.set(biomeProfile.fog).lerp(dayColor, 0.24 + dayAmount * 0.16);
      this.scene.fog.color.lerp(biomeFog, clamp(dt * 2.6, 0, 1));
      this.scene.fog.density += (biomeProfile.fogDensity - this.scene.fog.density) * clamp(dt * 1.8, 0, 1);
      this.hemisphereLight.intensity = 0.24 + dayAmount * 0.34;
      this.sunLight.intensity = 0.32 + dayAmount * 2.85;
      this.hLight.intensity = 1.6 + (1 - dayAmount) * 2.4;
      if (this.fillLight) this.fillLight.intensity = 0.08 + dayAmount * 0.16;
      if (this.rimLight) this.rimLight.intensity = 0.16 + (1 - dayAmount) * 0.18;
      if (this.skyDome) {
        this.skyDome.material.color.set(dayAmount > 0.4 ? 0x8fa9d8 : 0x524084);
        this.skyDome.material.color.multiplyScalar(0.42 + dayAmount * 0.58);
      }
      if (this.auroraVeil) {
        this.auroraVeil.rotation.z += dt * 0.018;
        this.auroraVeil.material.opacity = (1 - dayAmount) * 0.18 + (this.currentZone.id === "aurora" ? 0.09 : 0.02);
      }
      const environmentInterval = this.state.settings.quality === "low" ? 100 : this.state.settings.quality === "medium" ? 50 : 32;
      const updateEnvironmentDetail = time - this.lastEnvironmentDetailAt >= environmentInterval;
      if (updateEnvironmentDetail) {
        const environmentDt = Math.min(0.12, Math.max(dt, (time - this.lastEnvironmentDetailAt) / 1000 || dt));
        this.lastEnvironmentDetailAt = time;
        this.cloudLayers.forEach((cloud) => {
          cloud.rotation.y += environmentDt * 0.006;
          cloud.position.x += environmentDt * cloud.userData.drift;
          if (cloud.position.x > 115) cloud.position.x = -115;
          cloud.children.forEach((puff, puffIndex) => {
            const baseScale = puff.userData?.cloudBaseScale;
            if (!baseScale) return;
            const phase = puff.userData.cloudPhase || puffIndex;
            const breathe = 1 + Math.sin(time * 0.00065 + phase) * 0.09;
            puff.scale.set(baseScale.x * breathe, baseScale.y * (1 + Math.cos(time * 0.00052 + phase) * 0.12), baseScale.z * breathe);
            puff.rotation.y += environmentDt * (0.006 + puffIndex * 0.0015);
            puff.position.y += Math.sin(time * 0.0007 + phase) * environmentDt * 0.04;
          });
        });
        this.waterSurfaces.forEach((water, index) => {
          if (water.parent?.visible === false) return;
          water.position.y = water.userData.baseY + Math.sin(time * 0.0017 + index) * 0.035;
          water.rotation.z += environmentDt * (water.userData.lava ? 0.035 : -0.012);
          if (!water.userData.lava && water.material.bumpMap) {
            water.material.bumpMap.offset.x = (time * 0.000012) % 1;
            water.material.bumpMap.offset.y = (time * -0.000008) % 1;
          }
          water.material.emissiveIntensity = water.userData.lava
            ? 1.15 + Math.sin(time * 0.003) * 0.25
            : 0.018 + Math.sin(time * 0.0015) * 0.008;
        });
        this.puzzleNodes.forEach((puzzle) => {
          if (puzzle.parent?.visible === false) return;
          const core = puzzle.userData.core;
          core.rotation.y += environmentDt * (puzzle.userData.solved ? 1.5 : 0.45);
          core.position.y = 1.8 + Math.sin(time * 0.002 + puzzle.position.x) * 0.18;
        });
      }
      if (time - this.lastStreamingAt > 550) {
        this.lastStreamingAt = time;
        this.updateWorldStreaming();
      }

      if (this.weatherField) {
        this.weatherField.position.set(this.state.player.x, 0, this.state.player.z);
        const weatherWind = (BIOME_PROFILES[this.currentZone.id]?.wind || 0.35) * (this.currentZone.id === "sky" ? 3.2 : 1.15);
        const fallSpeed = this.currentZone.id === "crimson"
          ? 1.1
          : this.currentZone.id === "sky"
            ? 6.2
            : this.currentZone.id === "abyss"
              ? 0.65
              : 3.2;
        const gpuShader = this.weatherField.material.userData?.gpuShader;
        if (gpuShader) {
          gpuShader.uniforms.hhWeatherTime.value = time * 0.001;
          gpuShader.uniforms.hhWeatherWind.value = weatherWind;
          gpuShader.uniforms.hhWeatherFall.value = fallSpeed;
          return;
        }
        if (time - this.lastWeatherCpuAt < (this.state.settings.quality === "low" ? 66 : 33)) return;
        const weatherDt = Math.min(0.08, Math.max(dt, (time - this.lastWeatherCpuAt) / 1000 || dt));
        this.lastWeatherCpuAt = time;
        const positions = this.weatherField.geometry.attributes.position.array;
        for (let index = 1; index < positions.length; index += 3) {
          positions[index] -= weatherDt * fallSpeed;
          positions[index - 1] += weatherDt * weatherWind * (0.42 + (index % 7) * 0.035);
          positions[index + 1] += weatherDt * Math.sin(time * 0.001 + index) * weatherWind * 0.08;
          if (positions[index - 1] > 27.5) positions[index - 1] = -27.5;
          if (positions[index + 1] > 27.5) positions[index + 1] = -27.5;
          if (positions[index + 1] < -27.5) positions[index + 1] = 27.5;
          if (positions[index] < 1) positions[index] = 18 + Math.random() * 8;
        }
        this.weatherField.geometry.attributes.position.needsUpdate = true;
      }
    }

    indexWorldRuntimeObjects() {
      if (!this.world || !this.THREE) return;
      const worldPosition = new this.THREE.Vector3();
      this.shadowCastersByZone.clear();
      this.worldSpinners = [];
      ZONES.forEach((zone) => this.shadowCastersByZone.set(zone.id, []));
      this.world.traverse((object) => {
        if (object.userData?.spin) this.worldSpinners.push(object);
        if (!object.isMesh || object === this.playerMesh || object.userData?.boss) return;
        object.userData.baseCastShadow = Boolean(object.castShadow);
        if (!object.userData.baseCastShadow) return;
        object.getWorldPosition(worldPosition);
        const explicitZone = object.userData?.zoneId;
        const zone = ZONES.find((entry) => entry.id === explicitZone)
          || ZONES.reduce((nearest, entry) => Math.hypot(worldPosition.x - entry.x, worldPosition.z - entry.z) < Math.hypot(worldPosition.x - nearest.x, worldPosition.z - nearest.z) ? entry : nearest, ZONES[0]);
        this.shadowCastersByZone.get(zone.id)?.push({ object, x: worldPosition.x, z: worldPosition.z });
      });
      this.climbableObjects = this.climbables.map((entry) => entry.object).filter(Boolean);
      this.lastStreamingCell = "";
    }

    updateWorldStreaming({ force = false } = {}) {
      const player = this.state.player;
      const quality = this.state.settings.quality;
      const streamingCell = `${Math.floor(player.x / 12)}:${Math.floor(player.z / 12)}:${quality}:${this.currentZone?.id || "central"}`;
      if (!force && streamingCell === this.lastStreamingCell) return;
      this.lastStreamingCell = streamingCell;
      const visibleRadius = quality === "low" ? 46 : quality === "medium" ? 63 : 86;
      this.streamingGroups.forEach((group, zoneId) => {
        const zone = ZONES.find((entry) => entry.id === zoneId);
        if (!zone) return;
        const distance = Math.hypot(player.x - zone.x, player.z - zone.z);
        group.visible = distance <= visibleRadius || zoneId === this.currentZone.id;
      });
      this.zoneFxGroups.forEach((group, zoneId) => {
        const zone = ZONES.find((entry) => entry.id === zoneId);
        if (!zone) return;
        const distance = Math.hypot(player.x - zone.x, player.z - zone.z);
        group.visible = distance <= visibleRadius * 1.08 || zoneId === this.currentZone.id;
      });
      const shadowRadius = quality === "cinematic" ? 58 : quality === "high" ? 42 : 24;
      const nextShadowCasters = new Set();
      this.shadowCastersByZone.forEach((records, zoneId) => {
        const zone = ZONES.find((entry) => entry.id === zoneId);
        if (!zone || Math.hypot(player.x - zone.x, player.z - zone.z) > shadowRadius + zone.radius) return;
        records.forEach((record) => {
          if (Math.hypot(player.x - record.x, player.z - record.z) <= shadowRadius) nextShadowCasters.add(record.object);
        });
      });
      this.activeShadowCasters.forEach((object) => {
        if (!nextShadowCasters.has(object)) object.castShadow = false;
      });
      nextShadowCasters.forEach((object) => {
        object.castShadow = Boolean(object.userData.baseCastShadow && this.renderer.shadowMap?.enabled);
      });
      this.activeShadowCasters = nextShadowCasters;
    }

    updateWeatherAppearance() {
      if (!this.weatherField) return;
      this.applyBiomeVisualState(this.currentZone);
      const colors = {
        central: 0x72eaff,
        aurora: 0x9effe9,
        crimson: 0xff8a62,
        void: 0xc087ff,
        sky: 0x9ad7ff,
        ocean: 0x4de1ff,
        station: 0xffd36b,
        abyss: 0xff5e9f
      };
      const override = this.photoMode ? this.photoSettings.weather : "auto";
      const mode = override === "auto"
        ? this.currentZone.id
        : ({
          clear: "central",
          aurora: "aurora",
          storm: "void",
          embers: "crimson",
          "quantum-wind": "sky",
          "star-rain": "ocean",
          eclipse: "abyss"
        }[override] || this.currentZone.id);
      this.weatherField.material.color.setHex(colors[mode] || colors.central);
      const density = clamp(this.state.settings.weatherDensity, 0, 100) / 100;
      this.weatherField.material.opacity = override === "clear"
        ? 0.04
        : (mode === "central" ? 0.16 : mode === "aurora" && override === "storm" ? 0.82 : 0.58) * density;
      this.weatherField.material.size = mode === "crimson" || mode === "abyss" ? 0.12 : mode === "aurora" || mode === "ocean" ? 0.095 : 0.07;
    }

    updateEffects(dt) {
      this.effects = this.effects.filter((effect) => {
        effect.life -= dt;
        effect.mesh.scale.multiplyScalar(1 + dt * effect.grow);
        effect.mesh.material.opacity = clamp(effect.life / effect.maxLife, 0, 1) * effect.opacity;
        effect.mesh.rotation.y += dt * 3;
        if (effect.life <= 0) {
          effect.mesh.parent?.remove(effect.mesh);
          effect.mesh.geometry?.dispose?.();
          effect.mesh.material?.dispose?.();
          return false;
        }
        return true;
      });
    }

    zoneAt(x, z) {
      let nearest = ZONES[0];
      let best = Infinity;
      ZONES.forEach((zone) => {
        const distance = Math.hypot(x - zone.x, z - zone.z);
        if (distance < best) {
          best = distance;
          nearest = zone;
        }
      });
      if (Math.hypot(x - 76, z + 66) < 18) {
        return { id: "dungeon", name: "Nexus Depths", weather: "Nhiễu lượng tử", color: "#ff70cf", x: 76, z: -66, radius: 18 };
      }
      return nearest;
    }

    updateCamera(immediate = false, dt = 0.016) {
      if (!this.camera || !this.playerMesh) return;
      const player = this.state.player;
      const cameraOrigin = this.genesisActive || this.currentPanel === "creator"
        ? this.playerMesh.position
        : player;
      const visualLift = this.genesisActive || this.currentPanel === "creator"
        ? 0
        : Number(this.playerMesh.userData?.gameplayGroundOffset ?? this.playerMesh.userData?.gameplayVisualLift ?? 0);
      const originY = cameraOrigin.y + visualLift;
      const horizontal = Math.cos(this.cameraPitch) * this.cameraDistance;
      let desired = this.frameScratch.cameraDesired.set(
        cameraOrigin.x + Math.sin(this.cameraYaw) * horizontal,
        originY + 1.68 + Math.sin(this.cameraPitch) * this.cameraDistance,
        cameraOrigin.z + Math.cos(this.cameraYaw) * horizontal
      );
      const focus = this.frameScratch.cameraFocus.set(cameraOrigin.x, originY + 1.52, cameraOrigin.z);
      if (this.currentPanel === "creator" || this.genesisActive) {
        const focusOffset = this.genesisActive
          ? ({ head: 2.35, upper: 1.78, body: 1.46, lower: 0.76 }[this.appearanceFocus] ?? 1.46)
          : ({ head: 1.1, upper: 0.62, body: 0.88, lower: 0.28 }[this.appearanceFocus] ?? 0.88);
        focus.set(cameraOrigin.x, originY + focusOffset, cameraOrigin.z);
        const creatorDistance = this.genesisActive
          ? clamp(this.cameraDistance, 4.5, 8.5)
          : clamp(this.cameraDistance, 6.5, 12);
        const creatorHorizontal = Math.cos(this.cameraPitch) * creatorDistance;
        desired.set(
          cameraOrigin.x + Math.sin(this.cameraYaw) * creatorHorizontal,
          originY + focusOffset + Math.sin(this.cameraPitch) * creatorDistance,
          cameraOrigin.z + Math.cos(this.cameraYaw) * creatorHorizontal
        );
      }
      desired = this.updateCinematicCamera(desired, focus, dt);
      if (!this.state.settings.reduceEffects && !this.cinematicSequence.active && !this.cinematicTarget && !this.genesisActive && this.currentPanel !== "creator") {
        const cameraTime = performance.now() * 0.001;
        const floatX = Math.sin(cameraTime * 0.37) * 0.0048 + Math.sin(cameraTime * 0.91) * 0.0014;
        const floatY = Math.cos(cameraTime * 0.31) * 0.0032;
        const floatZ = Math.sin(cameraTime * 0.43 + 1.7) * 0.0038;
        desired.x += floatX;
        desired.y += floatY;
        desired.z += floatZ;
        focus.x += Math.sin(cameraTime * 0.29) * 0.0012;
        focus.y += Math.cos(cameraTime * 0.23) * 0.001;
      }
      if (!this.photoMode && !this.genesisActive && !this.cinematicSequence.active && this.currentPanel !== "creator") {
        const colliderObjects = this.climbableObjects;
        if (colliderObjects.length) {
          this.cameraRaycaster ||= new this.THREE.Raycaster();
          const direction = this.frameScratch.cameraDirection.copy(desired).sub(focus);
          const distance = direction.length();
          direction.normalize();
          this.cameraRaycaster.set(focus, direction);
          this.cameraRaycaster.far = distance;
          const hit = this.cameraRaycaster.intersectObjects(colliderObjects, true)[0];
          if (hit && hit.distance < distance) desired.copy(focus).add(direction.multiplyScalar(Math.max(2.2, hit.distance - 0.55)));
        }
      }
      if (this.cameraShake > 0.001 && !this.state.settings.reduceEffects && !this.cinematicSequence.active) {
        const intensity = this.cameraShake * clamp(this.state.settings.cameraShake, 0, 100) / 100 * 0.08;
        desired.x += (Math.random() - 0.5) * intensity;
        desired.y += (Math.random() - 0.5) * intensity * 0.55;
        desired.z += (Math.random() - 0.5) * intensity;
        this.cameraShake = Math.max(0, this.cameraShake - dt * 2.8);
      }
      if (immediate) this.camera.position.copy(desired);
      else this.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
      const locked = !this.cinematicSequence.active && this.lockedTargetId ? this.enemies.get(this.lockedTargetId) : null;
      if (locked?.visible && !locked.userData.defeated && !this.photoMode) {
        const targetFocus = this.frameScratch.cameraTargetFocus.copy(locked.position);
        targetFocus.y += 1.2;
        focus.lerp(targetFocus, 0.38);
      }
      const focusTargetDistance = this.camera.position.distanceTo(focus);
      this.cameraFocusDistance += (focusTargetDistance - this.cameraFocusDistance) * (1 - Math.exp(-Math.max(dt, 0.001) * 4.2));
      this.camera.lookAt(focus);
      if (!this.photoMode) {
        this.cameraFovTarget = this.cinematicSequence.active
          ? CINEMATIC_CAMERA.verticalFovDeg - 1.6 + Math.sin((this.cinematicSequence.progress || 0) * Math.PI) * 2.2
          : this.activeAnimation === "sprint"
            ? CINEMATIC_CAMERA.verticalFovDeg + 2.4
            : this.lockedTargetId
              ? CINEMATIC_CAMERA.verticalFovDeg + 1.2
              : CINEMATIC_CAMERA.verticalFovDeg;
        this.camera.fov += (this.cameraFovTarget - this.camera.fov) * (1 - Math.pow(0.015, dt));
        this.camera.updateProjectionMatrix();
      }
    }

    updateCinematicCamera(desired, focus, dt) {
      if (this.cinematicSequence.active) return this.updateStoryCinematicCamera(desired, focus, dt);
      const cinematic = this.cinematicTarget;
      if (!cinematic || performance.now() >= cinematic.until || !cinematic.object) {
        this.cinematicTarget = null;
        this.root.classList.remove("is-cinematic");
        return desired;
      }
      this.root.classList.add("is-cinematic");
      const targetPosition = cinematic.object.getWorldPosition
        ? cinematic.object.getWorldPosition(this.frameScratch.cameraTargetPosition)
        : this.frameScratch.cameraTargetPosition.copy(cinematic.object.position);
      const progress = clamp((cinematic.until - performance.now()) / 1250, 0, 1);
      const side = cinematic.phase === 3 ? -1 : 1;
      const cinematicPosition = this.frameScratch.cameraCinematicPosition.copy(targetPosition).add(this.frameScratch.cameraDirection.set(6.5 * side, 4.2 + progress * 1.5, 7.2));
      this.frameScratch.cameraTargetFocus.copy(targetPosition).y += 1.4;
      focus.lerp(this.frameScratch.cameraTargetFocus, 0.65);
      return desired.lerp(cinematicPosition, clamp(dt * 7.5, 0, 0.82));
    }

    updateStoryCinematicCamera(desired, focus, dt) {
      const sequence = this.cinematicSequence;
      if (!sequence.active || !this.playerMesh) return desired;
      const scratch = this.cinematicScratch;
      if (!scratch) return desired;
      const cinematic = this.cinematicById(sequence.chapterId);
      const progress = clamp(sequence.progress || 0, 0, 1);
      const actor = scratch.actor.copy(this.playerMesh.position);
      const phase = progress * Math.PI * 2;
      const reveal = progress * progress * (3 - 2 * progress);
      const shot = scratch.shot.set(0, 0, 0);
      let focusHeight = 1.42;
      let openingShot = false;
      switch (cinematic.camera) {
        case "opening-six-shot": {
          openingShot = true;
          if (progress < 0.16) {
            const local = smoothstepRange(progress, 0, 0.16);
            shot.set(-9.2 + local * 2.8, 6.1 - local * 1.25, 11.8 - local * 2.2);
            focusHeight = 1.8;
          } else if (progress < 0.34) {
            const local = smoothstepRange(progress, 0.16, 0.34);
            shot.set(2.25 - local * 0.55, 0.72 + local * 1.55, 4.15 - local * 0.62);
            focusHeight = 0.42 + local * 1.05;
          } else if (progress < 0.5) {
            const local = smoothstepRange(progress, 0.34, 0.5);
            shot.set(1.22 - local * 0.18, 2.05 + local * 0.18, 2.55 - local * 0.24);
            focusHeight = 1.92;
          } else if (progress < 0.7) {
            const local = smoothstepRange(progress, 0.5, 0.7);
            shot.set(-4.8 + local * 2.3, 2.25 + local * 0.35, 6.4 - local * 1.55);
            focusHeight = 1.48;
          } else if (progress < 0.86) {
            const local = smoothstepRange(progress, 0.7, 0.86);
            const angle = -0.58 + local * 0.62;
            shot.set(Math.sin(angle) * 4.3, 2.45 + Math.sin(local * Math.PI) * 0.22, Math.cos(angle) * 4.3);
            focusHeight = 1.78;
          } else {
            const local = smoothstepRange(progress, 0.86, 1);
            shot.set(Math.sin(this.cameraYaw) * (4.8 + local * 5.6), 2.35 + local * 0.72, Math.cos(this.cameraYaw) * (4.8 + local * 5.6));
            focusHeight = 1.52;
          }
          break;
        }
        case "water-sweep":
          shot.set(-6.8 + reveal * 8.5, 2.15 + Math.sin(progress * Math.PI) * 0.75, 6.2 - reveal * 1.7);
          break;
        case "forge-rise":
          shot.set(5.4 - reveal * 1.2, 1.65 + reveal * 4.1, 6.1 - reveal * 0.9);
          break;
        case "gravity-roll":
          shot.set(Math.sin(phase * 0.72) * 6.3, 3.4 + Math.cos(phase) * 0.65, Math.cos(phase * 0.72) * 6.3);
          break;
        case "sky-dive":
          shot.set(-4.5 + reveal * 2.6, 7.2 - reveal * 3.8, 7.4 - reveal * 1.9);
          break;
        case "ocean-glide":
          shot.set(-7.2 + reveal * 10.4, 2.5 + Math.sin(phase * 0.5) * 0.5, 6.8);
          break;
        case "station-track":
          shot.set(5.8 - reveal * 2.2, 2.8, 7.8 - reveal * 2.4);
          break;
        case "abyss-spiral":
          shot.set(Math.sin(phase * 0.82) * (7.5 - reveal * 2), 2.8 + reveal * 2.2, Math.cos(phase * 0.82) * (7.5 - reveal * 2));
          break;
        default:
          shot.set(Math.sin(-0.8 + phase * 0.32) * (7.2 - reveal * 1.1), 3.2 + Math.sin(progress * Math.PI) * 0.55, Math.cos(-0.8 + phase * 0.32) * (7.2 - reveal * 1.1));
          break;
      }
      // Story shots are character-first: retain the regional environment as
      // parallax, but keep the authored human large enough to read eyes, hands
      // and silhouette on both desktop and low-resolution displays.
      if (!openingShot) {
        shot.multiplyScalar(0.38);
        shot.y += 0.48;
      }
      const cinematicPosition = scratch.cinematicPosition.copy(actor).add(shot);
      const targetFocus = scratch.targetFocus.copy(actor);
      targetFocus.y += openingShot ? focusHeight : 1.35 + Math.sin(progress * Math.PI) * 0.12;
      // Frame the hero on the right third so the story copy never hides the
      // model. Looking slightly to the actor's left produces that composition
      // without moving or scaling the gameplay character.
      const forward = scratch.forward.copy(targetFocus).sub(cinematicPosition).normalize();
      const cameraRight = scratch.cameraRight.copy(forward).cross(scratch.worldUp).normalize();
      const canvasAspect = Math.max(0.5, (this.renderer?.domElement?.clientWidth || 16) / Math.max(1, this.renderer?.domElement?.clientHeight || 9));
      const framingOffset = canvasAspect < 1.05 ? 0.08 : canvasAspect < 1.4 ? 0.28 : 0.52;
      targetFocus.addScaledVector(cameraRight, -framingOffset);
      focus.lerp(targetFocus, clamp(dt * 15, 0.35, 1));
      const upTarget = scratch.upTarget.set(0, 1, 0);
      if (cinematic.camera === "gravity-roll") upTarget.set(Math.sin(phase) * 0.075, 1, Math.cos(phase) * 0.035).normalize();
      this.camera.up.lerp(upTarget, 1 - Math.exp(-Math.max(dt, 0.001) * 4.5)).normalize();
      return desired.lerp(cinematicPosition, clamp(dt * 7.8, 0.08, 0.86));
    }

    jumpOrGlide() {
      if (this.isSwimming) {
        this.isSwimming = false;
        this.isGrounded = false;
        this.verticalVelocity = 5.4;
        this.state.player.y += 0.18;
        this.setCharacterAction("jump", 520, 1);
        this.sound("jump");
        return;
      }
      if (this.isClimbing) {
        this.isClimbing = false;
        this.isGrounded = false;
        this.verticalVelocity = 4.6;
        this.state.player.y += 0.14;
        this.setCharacterAction("jump", 480, 0.8);
        return;
      }
      if (this.isGrounded) {
        this.isGrounded = false;
        this.verticalVelocity = 7.2;
        this.gliding = false;
        this.setCharacterAction("jump", 520, 1);
        this.sound("jump");
      } else if (this.verticalVelocity < 2 && this.state.player.stamina > 4) {
        this.gliding = !this.gliding;
        this.toast(this.gliding ? "Đã mở cánh lượn Astral." : "Đã thu cánh lượn.");
      }
    }

    dodge() {
      const now = performance.now();
      if (now - this.lastDodgeAt < 900 || this.state.player.stamina < 18) return;
      this.lastDodgeAt = now;
      this.dodgeUntil = now + 230;
      this.invulnerableUntil = now + 310;
      this.state.player.stamina = clamp(this.state.player.stamina - 18, 0, this.state.player.maxStamina);
      this.setCharacterAction("dodge", 360, 1);
      this.spawnPulse(this.state.player.x, this.state.player.y + 0.6, this.state.player.z, ELEMENTS[this.state.player.element].color, 0.42, 2.8);
      this.sound("dodge");
    }

    toggleTargetLock() {
      if (this.lockedTargetId) {
        this.lockedTargetId = "";
        this.toast("Đã bỏ khóa mục tiêu.");
        return;
      }
      const target = this.findTarget(18);
      if (target) {
        this.lockedTargetId = target.userData.id;
        this.toast(`Đã khóa ${target.userData.name}.`);
      } else {
        this.toast("Không có mục tiêu trong phạm vi.");
      }
    }

    findTarget(range = 4.2) {
      const locked = this.lockedTargetId ? this.enemies.get(this.lockedTargetId) : null;
      if (locked?.visible && !locked.userData.defeated) {
        const distance = Math.hypot(locked.position.x - this.state.player.x, locked.position.z - this.state.player.z);
        if (distance <= range) return locked;
      }
      let winner = null;
      let best = range;
      this.enemies.forEach((enemy) => {
        if (!enemy.visible || enemy.userData.defeated) return;
        const distance = Math.hypot(enemy.position.x - this.state.player.x, enemy.position.z - this.state.player.z);
        if (distance < best) {
          best = distance;
          winner = enemy;
        }
      });
      const training = this.entities.get("training-core");
      if (training) {
        const distance = Math.hypot(training.position.x - this.state.player.x, training.position.z - this.state.player.z);
        if (distance < best) winner = training;
      }
      return winner;
    }

    attack(kind = "attack") {
      if (!this.running || this.paused || this.menuPaused || this.photoMode || this.state.player.health <= 0) return;
      const now = performance.now();
      const weaponClass = this.equippedWeaponClass();
      const combatProfile = WEAPON_COMBAT_PROFILES[weaponClass] || WEAPON_COMBAT_PROFILES.sword;
      const cooldowns = combatProfile.cooldown;
      const last = kind === "attack" ? this.lastAttackAt : kind === "skill" ? this.lastSkillAt : this.lastUltimateAt;
      if (now - last < cooldowns[kind]) return;
      if (kind === "ultimate" && this.state.player.ultimate < 100) {
        this.toast("Tuyệt kỹ chưa đủ năng lượng.");
        return;
      }

      if (kind === "attack") {
        this.lastAttackAt = now;
        this.combo = now <= this.comboUntil ? (this.combo % 3) + 1 : 1;
        this.comboUntil = now + 760;
      } else if (kind === "skill") {
        this.lastSkillAt = now;
      } else {
        this.lastUltimateAt = now;
        this.state.player.ultimate = 0;
      }

      const range = combatProfile.range[kind];
      const target = this.findTarget(range);
      const element = this.state.player.element;
      const characterId = this.state.roster.activeId;
      const rawDamage = kind === "attack"
        ? 22 + this.combo * 7
        : kind === "skill"
          ? 68 + Number(this.state.skills.plasmaDrive || 0) * 9
          : 155;
      const damageBase = Math.round(rawDamage * combatProfile.damage[kind]);
      const motion = kind === "attack"
        ? combatProfile.attacks[Math.max(0, (this.combo || 1) - 1)]
        : kind === "skill"
          ? combatProfile.skillMotion
          : combatProfile.ultimateMotion;
      this.setCharacterAction(
        motion,
        kind === "ultimate" ? 920 : kind === "skill" ? 680 : 430,
        kind === "ultimate" ? 1.5 : 1
      );
      if (weaponClass !== "gun") this.beginMotionWarp(target, kind, now);
      this.swingAnimation(kind, weaponClass);
      this.spawnPulse(this.state.player.x, this.state.player.y + 1.2, this.state.player.z, ELEMENTS[element].color, kind === "ultimate" ? 1.2 : 0.42, kind === "ultimate" ? 8 : 3.2);
      this.spawnElementBurst(
        this.state.player.x,
        this.state.player.y + 1.1,
        this.state.player.z,
        element,
        kind === "ultimate" ? 2.2 : kind === "skill" ? 1.35 : 0.72
      );
      this.sound(kind);
      this.cameraShake = Math.max(this.cameraShake, kind === "ultimate" ? 0.22 : kind === "skill" ? 0.12 : 0.04);
      if (kind === "ultimate") this.cinematicTarget = { object: target || this.playerMesh, until: now + 780, phase: 0 };
      if (kind === "skill" && characterId === "nyx" && target) {
        const distance = Math.hypot(target.position.x - this.state.player.x, target.position.z - this.state.player.z) || 1;
        this.state.player.x = target.position.x - ((target.position.x - this.state.player.x) / distance) * 2.2;
        this.state.player.z = target.position.z - ((target.position.z - this.state.player.z) / distance) * 2.2;
        this.spawnPulse(this.state.player.x, this.state.player.y + 0.6, this.state.player.z, "#bd72ff", 0.55, 3.8);
      }
      if (kind === "ultimate" && characterId === "sol") {
        this.state.player.health = clamp(this.state.player.health + 34, 0, this.state.player.maxHealth);
      }
      if (kind === "skill" && weaponClass === "unarmed") {
        this.invulnerableUntil = Math.max(this.invulnerableUntil, now + 480);
        this.state.player.stamina = clamp(this.state.player.stamina + 14, 0, this.state.player.maxStamina);
      }

      const contactDelay = weaponClass === "gun" ? (kind === "attack" ? 80 : 180) : kind === "ultimate" ? 360 : kind === "skill" ? 235 : 145;
      root.setTimeout(() => {
        if (this.destroyed || !this.running) return;
        if (this.authoritative) {
          this.emitInput({ action: kind, weaponClass, targetId: target?.userData?.id || "", power: 1 });
          return;
        }
        if (!target || target.visible === false || target.userData?.defeated) return;
        const targets = [target];
        if (kind !== "attack") {
          const limit = kind === "ultimate" ? 8 : weaponClass === "gun" ? 3 : weaponClass === "sword" ? 4 : 2;
          this.enemies.forEach((enemy) => {
            if (targets.length >= limit || targets.includes(enemy) || !enemy.visible || enemy.userData.defeated) return;
            const distance = Math.hypot(enemy.position.x - this.state.player.x, enemy.position.z - this.state.player.z);
            if (distance <= range) targets.push(enemy);
          });
        }
        targets.forEach((combatTarget, index) => {
          const distanceAtContact = Math.hypot(combatTarget.position.x - this.state.player.x, combatTarget.position.z - this.state.player.z);
          if (distanceAtContact <= range + 1.2) this.damageTarget(combatTarget, Math.round(damageBase * (index ? 0.72 : 1)), element, kind);
        });
      }, contactDelay);
    }

    swingAnimation(kind, weaponClass = this.equippedWeaponClass()) {
      if (!this.playerWeapon) return;
      if (weaponClass === "gun") {
        this.playerWeapon.position.z = 0.11;
        this.playerWeapon.rotation.x = 0.08;
        root.setTimeout(() => {
          if (!this.playerWeapon) return;
          this.playerWeapon.position.z = 0;
          this.playerWeapon.rotation.x = -0.12;
        }, kind === "ultimate" ? 260 : 95);
        return;
      }
      if (weaponClass === "unarmed") {
        this.playerWeapon.scale.setScalar(kind === "ultimate" ? 1.42 : 1.18);
        root.setTimeout(() => this.playerWeapon?.scale.setScalar(1), kind === "ultimate" ? 300 : 140);
        return;
      }
      const base = kind === "ultimate" ? 1.6 : kind === "skill" ? 1.15 : 0.75;
      this.playerWeapon.rotation.x = -base;
      root.setTimeout(() => {
        if (this.playerWeapon) this.playerWeapon.rotation.x = 0;
      }, kind === "ultimate" ? 340 : 160);
    }

    damageTarget(target, baseDamage, element, kind) {
      if (target.userData.type === "training") {
        this.recordTrainingDamage(baseDamage);
        this.spawnHitEffect(target.position, ELEMENTS[element].color);
        this.hitStopUntil = performance.now() + (kind === "ultimate" ? 95 : kind === "skill" ? 62 : 38);
        this.cameraShake = Math.max(this.cameraShake, kind === "ultimate" ? 1 : kind === "skill" ? 0.48 : 0.25);
        return;
      }
      const data = target.userData;
      if (data.defeated) return;
      const weapon = ITEMS[this.state.player.weapon] || ITEMS["starter-blade"];
      const character = CHARACTERS[this.state.roster.activeId] || CHARACTERS.lyra;
      let damage = (baseDamage + Number(weapon.attack || 0)) * character.attackScale;
      let reaction = null;
      const now = performance.now();
      Object.entries(data.status || {}).forEach(([status, appliedAt]) => {
        if (now - appliedAt > 6000 || status === element) return;
        const key = [status, element].sort().join("+");
        if (ELEMENT_REACTIONS[key]) reaction = ELEMENT_REACTIONS[key];
      });
      if (reaction) {
        damage *= reaction.multiplier;
        if (reaction.heal) this.state.player.health = clamp(this.state.player.health + reaction.heal, 0, this.state.player.maxHealth);
        this.toast(`${reaction.name} · ${Math.round(damage)} sát thương`, "success");
        this.spawnPulse(target.position.x, target.position.y + 1, target.position.z, reaction.color, 0.8, 4.4);
      }
      damage = Math.max(1, Math.round(damage));
      if (data.boss && data.bossPhase >= 2 && data.weakPoint?.visible && kind !== "attack") {
        damage = Math.round(damage * 1.35);
        this.toast(`WEAK POINT · ${damage} sát thương`, "success");
      }
      let absorbed = 0;
      if (data.boss && data.shield > 0) {
        absorbed = Math.min(data.shield, damage);
        data.shield = Math.max(0, data.shield - absorbed);
        damage -= absorbed;
        if (!data.shield) {
          this.spawnNova(target.position.x, target.position.y + 1.5, target.position.z, "#ffd36b");
          this.cameraShake = Math.max(this.cameraShake, 0.75);
          this.toast("Astral Shell đã vỡ · Weak Point chuẩn bị mở!", "success");
        }
      }
      data.status[element] = now;
      data.health = Math.max(0, data.health - damage);
      const dealt = damage + absorbed;
      this.hitStopUntil = performance.now() + (kind === "ultimate" ? 95 : kind === "skill" ? 62 : 38);
      this.cameraShake = Math.max(this.cameraShake, kind === "ultimate" ? 1 : kind === "skill" ? 0.48 : 0.25);
      this.state.stats.totalDamage += dealt;
      this.state.stats.highestHit = Math.max(this.state.stats.highestHit, dealt);
      this.state.player.ultimate = clamp(this.state.player.ultimate + (kind === "attack" ? 8 : 15), 0, 100);
      this.spawnHitEffect(target.position, ELEMENTS[element].color);
      this.spawnElementBurst(target.position.x, target.position.y + 1.1, target.position.z, element, kind === "ultimate" ? 2 : 1);
      if (!data.health) this.defeatEnemy(target);
    }

    recordTrainingDamage(damage) {
      const now = performance.now();
      this.dpsSamples.push({ at: now, damage });
      this.dpsSamples = this.dpsSamples.filter((sample) => now - sample.at <= 5000);
      const total = this.dpsSamples.reduce((sum, sample) => sum + sample.damage, 0);
      const first = this.dpsSamples[0]?.at || now;
      const seconds = Math.max(1, (now - first) / 1000);
      const dps = Math.round(total / seconds);
      const element = this.root.querySelector("[data-har-dps]");
      element.textContent = `Training DPS · ${dps} · Hit ${Math.round(damage)}`;
      element.classList.add("is-active");
    }

    defeatEnemy(enemy) {
      const data = enemy.userData;
      data.defeated = true;
      data.health = 0;
      data.respawnAt = Date.now() + (data.boss ? 120000 : 25000);
      enemy.visible = false;
      this.state.defeated[data.id] = { defeated: true, respawnAt: data.respawnAt, at: nowIso() };
      this.state.stats.enemiesDefeated += 1;
      if (data.boss) this.state.stats.bossDefeated += 1;
      const event = this.state.world?.activeEvent;
      if (event && event.zoneId === this.zoneAt(enemy.position.x, enemy.position.z).id) {
        event.progress = clamp(Number(event.progress || 0) + 1, 0, Number(event.target || 3));
        this.recordWorldEvent({ type: "event-progress", title: `${event.title} · ${event.progress}/${event.target}`, detail: `Đã hạ ${data.name}.`, zoneId: event.zoneId, factionId: event.factionId });
      }
      this.grantXp(data.xp);
      if (data.drop && (!data.boss || this.state.quests.warden?.status !== "completed")) this.addItem(data.drop, 1, `${data.name} rơi vật phẩm`);
      this.progressQuest(data.boss ? "boss" : "defeat", 1, { enemy: data.archetype });
      this.spawnNova(enemy.position.x, enemy.position.y + 1, enemy.position.z, ENEMY_ARCHETYPES[data.archetype].color);
      this.toast(`Đã đánh bại ${data.name} · +${data.xp} XP`, "success");
      this.saveProgress("Chiến thắng");
    }

    damagePlayer(amount, source = "Sinh vật") {
      if (performance.now() < this.invulnerableUntil || this.state.player.health <= 0) return;
      const guard = 1 - Number(this.state.skills.astralGuard || 0) * 0.08;
      const damage = Math.max(1, Math.round(amount * guard));
      this.state.player.health = Math.max(0, this.state.player.health - damage);
      this.invulnerableUntil = performance.now() + 420;
      this.setCharacterAction("hit", 360, clamp(damage / 30, 0.45, 1.4));
      this.spawnPulse(this.state.player.x, this.state.player.y + 1, this.state.player.z, "#ff5e72", 0.35, 2.6);
      if (!this.state.player.health) this.playerDefeated(source);
    }

    playerDefeated(source) {
      this.state.stats.deaths += 1;
      this.setCharacterAction("defeated", 1600, 1);
      this.paused = true;
      this.runtime?.gameover?.({ gameId: GAME_ID, outcome: "defeated", source });
      this.openPanel("defeated");
      this.saveProgress("Bị đánh bại");
    }

    revive() {
      const checkpoint = ZONES.find((zone) => zone.id === this.state.player.checkpoint) || ZONES[0];
      this.state.player.health = this.state.player.maxHealth;
      this.state.player.stamina = this.state.player.maxStamina;
      this.setCharacterAction("idle", 120, 0);
      this.teleport(checkpoint.x, checkpoint.z + 5, checkpoint.name);
      this.paused = false;
      this.closePanel();
      this.runtime?.restart?.({ gameId: GAME_ID, checkpoint: checkpoint.id });
      this.toast(`Đã hồi sinh tại ${checkpoint.name}.`, "success");
    }

    spawnHitEffect(position, color) {
      const mesh = new this.THREE.Mesh(
        new this.THREE.RingGeometry(0.25, 0.58, 28),
        new this.THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: this.THREE.DoubleSide, depthWrite: false })
      );
      mesh.position.copy(position);
      mesh.position.y += 1.3;
      mesh.lookAt(this.camera.position);
      this.scene.add(mesh);
      this.effects.push({ mesh, life: 0.32, maxLife: 0.32, grow: 5, opacity: 0.9 });
    }

    spawnElementBurst(x, y, z, element = "plasma", intensity = 1) {
      if (!this.THREE || this.state.settings.reduceEffects || this.state.settings.vfxLevel === "static") return;
      const THREE = this.THREE;
      const profile = {
        plasma: { color: 0xff68c9, spread: 1.25, vertical: 1.3 },
        cryo: { color: 0x8ee8ff, spread: 0.92, vertical: 1.65 },
        void: { color: 0xb77aff, spread: 1.5, vertical: 0.9 },
        nature: { color: 0x7cf2a8, spread: 1.15, vertical: 1.8 },
        quantum: { color: 0x64efff, spread: 1.7, vertical: 1.15 },
        solar: { color: 0xffd36b, spread: 1.34, vertical: 1.48 }
      }[element] || { color: 0xffffff, spread: 1, vertical: 1 };
      const cinematicMultiplier = this.state.settings.vfxLevel === "cinematic" ? 1.55 : 1;
      const count = Math.max(8, Math.round(18 * intensity * cinematicMultiplier));
      const positions = new Float32Array(count * 3);
      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2 + Math.random() * 0.36;
        const radius = (0.22 + Math.random() * profile.spread) * intensity;
        positions[index * 3] = Math.cos(angle) * radius;
        positions[index * 3 + 1] = (Math.random() - 0.2) * profile.vertical * intensity;
        positions[index * 3 + 2] = Math.sin(angle) * radius;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mesh = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          color: profile.color,
          size: element === "cryo" ? 0.16 : element === "solar" ? 0.24 : 0.2,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.effects.push({ mesh, life: 0.48 + intensity * 0.12, maxLife: 0.48 + intensity * 0.12, grow: 0.9 + intensity * 0.35, opacity: 0.9 });
    }

    spawnPulse(x, y, z, color, life = 0.5, size = 3) {
      if (!this.THREE || this.state.settings.reduceEffects) return;
      const mesh = new this.THREE.Mesh(
        new this.THREE.RingGeometry(0.25, 0.38, 44),
        new this.THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: this.THREE.DoubleSide, depthWrite: false })
      );
      mesh.position.set(x, y, z);
      mesh.rotation.x = -Math.PI / 2;
      mesh.scale.setScalar(size / 3);
      this.scene.add(mesh);
      this.effects.push({ mesh, life, maxLife: life, grow: 2.7, opacity: 0.75 });
    }

    spawnNova(x, y, z, color) {
      this.spawnPulse(x, y, z, color, 0.9, 5.5);
      if (this.state.settings.reduceEffects) return;
      for (let index = 0; index < 4; index += 1) {
        const mesh = new this.THREE.Mesh(
          new this.THREE.TetrahedronGeometry(0.16, 0),
          new this.THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
        );
        mesh.position.set(x + (Math.random() - 0.5) * 1.5, y + Math.random() * 1.4, z + (Math.random() - 0.5) * 1.5);
        this.scene.add(mesh);
        this.effects.push({ mesh, life: 0.65, maxLife: 0.65, grow: 1.2, opacity: 0.85 });
      }
    }

    updateNearby() {
      const player = this.state.player;
      const candidates = [];
      const add = (object, range = 3.5) => {
        if (!object?.visible) return;
        const distance = Math.hypot(object.position.x - player.x, object.position.z - player.z);
        if (distance <= range) candidates.push({ object, distance });
      };
      this.npcs.forEach((npc) => add(npc, 3.6));
      this.collectibles.forEach((node) => add(node, 3.1));
      this.portals.forEach((portal) => add(portal, 4.6));
      this.puzzleNodes.forEach((puzzle) => add(puzzle, 4.2));
      add(this.entities.get("training-core"), 4.4);
      candidates.sort((left, right) => left.distance - right.distance);
      this.nearby = candidates[0]?.object || null;
      const prompt = this.root.querySelector("[data-har-context]");
      if (!this.nearby) {
        prompt.hidden = true;
        return;
      }
      const data = this.nearby.userData;
      const label = data.type === "npc"
        ? `G / T · Nói chuyện với ${data.name}`
        : data.type === "collectible"
          ? `G · Thu thập ${ITEMS[data.itemId]?.name || "vật phẩm"}`
          : data.type === "puzzle"
            ? data.solved
              ? `${data.name} · Đã cộng hưởng`
              : `G · Kích hoạt ${data.name} bằng ${ELEMENTS[data.requiredElement]?.label || "đúng nguyên tố"}`
          : data.type === "training"
            ? "F · Tấn công Training Core để đo DPS"
            : `G · ${data.name}`;
      prompt.textContent = label;
      prompt.hidden = false;
    }

    interact() {
      const target = this.nearby;
      if (!target) {
        this.toast("Không có đối tượng để tương tác.");
        return;
      }
      const data = target.userData;
      if (data.type === "npc") return this.openDialogue(data.id);
      if (data.type === "collectible") return this.collectNode(target);
      if (data.type === "portal") return this.activatePortal(target);
      if (data.type === "puzzle") return this.activatePuzzle(target);
      if (data.type === "training") {
        this.trainingSession = true;
        this.trainingActive = true;
        this.dpsSamples = [];
        this.root.querySelector("[data-har-dps]").classList.add("is-active");
        this.toast("Training Arena đã bắt đầu · tấn công lõi để đo DPS.");
      }
    }

    activatePuzzle(puzzle) {
      const data = puzzle.userData;
      if (data.solved) {
        this.toast(`${data.name} đã được kích hoạt.`);
        return;
      }
      if (this.state.player.element !== data.requiredElement) {
        this.toast(`Cần cộng hưởng ${ELEMENTS[data.requiredElement]?.label || data.requiredElement}. Hãy đổi nhân vật hoặc lõi nguyên tố.`, "error");
        return;
      }
      data.solved = true;
      this.state.puzzles[data.id] = { solved: true, solvedAt: nowIso(), characterId: this.state.roster.activeId };
      puzzle.children.forEach((child) => {
        if (child.material) child.material.emissiveIntensity = 1.15;
      });
      this.spawnNova(puzzle.position.x, puzzle.position.y + 1.5, puzzle.position.z, data.color);
      this.addItem("aurora-shard", 1, `Giải ${data.name}`);
      this.grantXp(70);
      this.toast(`${data.name} đã cộng hưởng · +70 XP`, "success");
      this.saveProgress("Giải elemental puzzle");
    }

    collectNode(node) {
      if (!node.visible || this.state.collectedNodes.includes(node.userData.id)) return;
      node.visible = false;
      this.state.collectedNodes.push(node.userData.id);
      this.addItem(node.userData.itemId, 1, "Thu thập trong thế giới");
      this.progressQuest("collect", 1, { item: node.userData.itemId });
      this.sound("collect");
      this.saveProgress("Thu thập vật phẩm");
    }

    activatePortal(portal) {
      const data = portal.userData;
      if (data.dungeon) {
        this.teleport(76, -60, "Nexus Depths");
        this.toast("Đã vào Bí cảnh Hư Không · co-op tối đa 4 người.");
        return;
      }
      if (data.dungeonExit) {
        this.teleport(0, -56, "Void Garden");
        return;
      }
      const checkpoint = data.checkpoint;
      if (!checkpoint) return;
      const zone = ZONES.find((item) => item.id === checkpoint);
      if (!this.isStoryChapterUnlocked(checkpoint)) {
        const required = this.cinematicById(checkpoint).chapter - 1;
        this.toast(`Cổng cốt truyện đang khóa · hãy hoàn thành Chương ${required}.`, "error");
        return;
      }
      if (!this.state.activatedGates.includes(checkpoint) && checkpoint !== "central") {
        this.state.activatedGates.push(checkpoint);
        this.state.checkpoints[checkpoint] = true;
        portal.userData.unlocked = true;
        this.progressQuest("gate", 1, { checkpoint });
        this.toast(`Đã kích hoạt cổng ${zone?.name || checkpoint}.`, "success");
        this.saveProgress("Kích hoạt cổng");
      } else {
        this.state.player.checkpoint = checkpoint;
        this.toast(`Checkpoint đã đặt tại ${zone?.name || checkpoint}.`);
      }
    }

    openDialogue(npcId) {
      const dialogue = this.root.querySelector("[data-har-dialogue]");
      const name = this.root.querySelector("[data-har-dialogue-name]");
      const role = this.root.querySelector("[data-har-dialogue-role]");
      const text = this.root.querySelector("[data-har-dialogue-text]");
      const choices = this.root.querySelector("[data-har-dialogue-choices]");
      dialogue.hidden = false;
      if (npcId === "luma") {
        name.textContent = "Navigator Luma";
        role.textContent = "H-Central Navigation Corps";
        const active = this.state.quests.awakening?.status === "active";
        const story = this.currentStoryChapter();
        text.textContent = active
          ? "Nax, tín hiệu này mang chữ ký sinh học của chính bạn và được gửi từ 72 giờ trong tương lai. Chúng ta phải xác minh nó trước khi mạng Astral sụp đổ."
          : `Tuyến Nexus Echo đang ở Chương ${story.chapter}: ${story.title}. Mọi dữ kiện phải được kiểm chứng theo đúng thứ tự; không có nhánh thay đổi kết quả.`;
        choices.innerHTML = `
          <button class="har-primary-button" type="button" data-dialogue-action="continue">Tiếp tục</button>
          <button class="har-secondary-button" type="button" data-dialogue-action="ask">Hỏi thêm</button>
          <button class="har-secondary-button" type="button" data-dialogue-action="close">Rời hội thoại</button>`;
      } else {
        name.textContent = "Cael Aurora";
        role.textContent = "Astral Forge";
        text.textContent = "Tôi có thể mở bàn rèn phụ trợ. Việc chế tạo và danh tiếng phe chỉ ảnh hưởng trang bị, giá cửa hàng và hội thoại phụ; chúng không thay đổi Nexus Echo.";
        choices.innerHTML = `
          <button class="har-primary-button" type="button" data-dialogue-action="continue">Tiếp tục</button>
          <button class="har-secondary-button" type="button" data-dialogue-action="ask">Hỏi thêm</button>
          <button class="har-secondary-button" type="button" data-dialogue-action="close">Rời hội thoại</button>`;
      }
      choices.onclick = (event) => {
        const action = event.target.closest("[data-dialogue-action]")?.dataset.dialogueAction;
        if (!action) return;
        if (action === "continue") {
          if (npcId === "luma") {
            this.progressQuest("talk", 1, { npc: "luma" });
            this.closeDialogue();
          } else {
            this.closeDialogue();
            this.openPanel("craft");
          }
        } else if (action === "ask") {
          text.textContent = npcId === "luma"
            ? "Bản ghi Aurora sẽ chứng minh tín hiệu là thật. Sau đó Cael phải rèn Temporal Key, Nyx giải mã Nexus và đội mới có thể tìm con tàu của Nax nguyên bản."
            : "Temporal Key của cốt truyện chỉ được hoàn thiện trong nhiệm vụ chính. Bàn rèn này chỉ tạo vật phẩm gameplay và không thể mở, bỏ qua hay đổi kết thúc chương.";
        } else if (action === "close") this.closeDialogue();
      };
    }

    closeDialogue() {
      this.root.querySelector("[data-har-dialogue]").hidden = true;
    }

    progressQuest(type, amount = 1, meta = {}) {
      const quest = QUESTS.find((item) => {
        const status = this.state.quests[item.id];
        if (status?.status !== "active" || item.type !== type) return false;
        if (item.enemy && item.enemy !== meta.enemy) return false;
        if (item.item && item.item !== meta.item) return false;
        if (item.recipe && item.recipe !== meta.recipe) return false;
        return true;
      });
      if (!quest) return;
      const status = this.state.quests[quest.id];
      status.progress = clamp(status.progress + amount, 0, quest.target);
      if (status.progress >= quest.target) this.completeQuest(quest);
      this.updateUi(true);
    }

    completeQuest(quest) {
      const status = this.state.quests[quest.id];
      if (!status || status.status === "completed") return;
      status.status = "completed";
      status.completedAt = nowIso();
      if (quest.reward?.xp) this.grantXp(quest.reward.xp);
      if (quest.reward?.item) this.addItem(quest.reward.item, quest.reward.amount || 1, `Nhiệm vụ: ${quest.title}`);
      const index = QUESTS.findIndex((item) => item.id === quest.id);
      const next = QUESTS[index + 1];
      if (next && this.state.quests[next.id]?.status === "locked") this.state.quests[next.id].status = "active";
      this.spawnNova(this.state.player.x, this.state.player.y + 1, this.state.player.z, "#78efff");
      this.toast(`Hoàn thành: ${quest.title}`, "success");
      this.dispatchReward({ xp: quest.reward?.xp || 0, questId: quest.id });
      this.recordStoryEvent(`quest:${quest.id}`);
      this.evaluateStoryProgress({ save: false });
      this.saveProgress(`Hoàn thành ${quest.title}`);
    }

    grantXp(amount) {
      if (this.state.player.level >= PLAYER_LEVEL_CAP) {
        this.state.player.level = PLAYER_LEVEL_CAP;
        this.state.player.xp = 0;
        return;
      }
      this.state.player.xp += Math.max(0, Number(amount) || 0);
      let threshold = this.levelThreshold(this.state.player.level);
      while (this.state.player.xp >= threshold && this.state.player.level < PLAYER_LEVEL_CAP) {
        this.state.player.xp -= threshold;
        this.state.player.level += 1;
        this.state.player.skillPoints += 1;
        this.state.player.maxHealth += 8;
        this.state.player.health = this.state.player.maxHealth;
        threshold = this.levelThreshold(this.state.player.level);
        this.toast(`Thăng cấp ${this.state.player.level} · +1 điểm kỹ năng`, "success");
      }
      if (this.state.player.level >= PLAYER_LEVEL_CAP) {
        this.state.player.level = PLAYER_LEVEL_CAP;
        this.state.player.xp = 0;
        this.toast(`Đã đạt cấp tối đa ${PLAYER_LEVEL_CAP} · Mastery vẫn tiếp tục tăng.`, "success");
      }
    }

    levelThreshold(level) {
      return 120 + Math.max(0, Number(level) - 1) * 70;
    }

    addItem(itemId, amount = 1, source = "") {
      if (!ITEMS[itemId]) return false;
      const current = this.state.inventory[itemId] || { quantity: 0, favorite: false, locked: false, acquiredAt: nowIso() };
      current.quantity = Math.max(0, Number(current.quantity || 0) + Math.max(1, Number(amount) || 1));
      current.lastSource = source;
      this.state.inventory[itemId] = current;
      this.toast(`+${amount} ${ITEMS[itemId].name}`, "success");
      return true;
    }

    removeItems(requirements) {
      const enough = Object.entries(requirements).every(([id, amount]) => Number(this.state.inventory[id]?.quantity || 0) >= Number(amount));
      if (!enough) return false;
      Object.entries(requirements).forEach(([id, amount]) => {
        this.state.inventory[id].quantity -= Number(amount);
        if (this.state.inventory[id].quantity <= 0) delete this.state.inventory[id];
      });
      return true;
    }

    craft(recipeId) {
      const recipe = RECIPES.find((item) => item.id === recipeId);
      if (!recipe) return;
      if (!this.removeItems(recipe.requires)) {
        this.toast("Chưa đủ nguyên liệu để chế tạo.", "error");
        return;
      }
      this.addItem(recipe.result, recipe.amount, `Chế tạo: ${recipe.name}`);
      this.state.stats.crafted += 1;
      this.progressQuest("craft", 1, { recipe: recipe.id });
      this.sound("craft");
      this.saveProgress(`Chế tạo ${recipe.name}`);
      this.renderCurrentPanel();
    }

    useItem(itemId) {
      const item = ITEMS[itemId];
      const record = this.state.inventory[itemId];
      if (!item || !record?.quantity || item.type !== "consumable") return;
      if (this.state.player.health >= this.state.player.maxHealth) {
        this.toast("HP đang đầy.");
        return;
      }
      this.state.player.health = clamp(this.state.player.health + Number(item.heal || 0), 0, this.state.player.maxHealth);
      record.quantity -= 1;
      if (record.quantity <= 0) delete this.state.inventory[itemId];
      this.sound("heal");
      this.toast(`Đã dùng ${item.name}.`, "success");
      this.saveProgress("Dùng vật phẩm");
      this.renderCurrentPanel();
    }

    equipItem(itemId) {
      const item = ITEMS[itemId];
      const record = this.state.inventory[itemId];
      if (!item || !record?.quantity || item.type !== "weapon") return;
      this.state.player.weapon = itemId;
      if (this.state.loadouts?.[this.state.roster.activeId]) this.state.loadouts[this.state.roster.activeId].weapon = itemId;
      this.refreshEquippedWeapon();
      const combat = WEAPON_COMBAT_PROFILES[item.weaponClass || "sword"];
      this.toast(`Đã trang bị ${item.name} · mở bộ kỹ năng ${combat.label}.`, "success");
      this.updateUi(true);
      this.saveProgress("Đổi trang bị");
      this.renderCurrentPanel();
    }

    teleport(x, z, label = "điểm đến") {
      this.state.player.x = clamp(x, -WORLD_LIMIT, WORLD_LIMIT);
      this.state.player.z = clamp(z, -WORLD_LIMIT, WORLD_LIMIT);
      this.state.player.y = 1.08;
      this.verticalVelocity = 0;
      this.isGrounded = true;
      this.gliding = false;
      this.positionCharacterInWorld(this.playerMesh, this.state.player.x, this.state.player.y, this.state.player.z);
      this.updateCamera(true);
      this.closePanel();
      this.spawnPulse(this.state.player.x, this.state.player.y + 0.2, this.state.player.z, "#76eaff", 0.8, 5);
      this.toast(`Đã dịch chuyển tới ${label}.`);
      this.saveProgress(`Dịch chuyển ${label}`);
    }

    setElement(elementId, notify = true) {
      if (!ELEMENTS[elementId]) return;
      this.state.player.element = elementId;
      this.root.querySelectorAll("[data-element]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.element === elementId)));
      this.playerWeapon?.traverse?.((object) => {
        if (!object.material) return;
        object.material.emissive?.set?.(ELEMENTS[elementId].color);
        object.material.color?.set?.(ELEMENTS[elementId].color);
      });
      if (notify) this.toast(`Lõi ${ELEMENTS[elementId].label} đã đồng bộ.`);
      this.updateUi(true);
    }

    activeQuest() {
      return QUESTS.find((quest) => this.state.quests[quest.id]?.status === "active") || null;
    }

    updateUi(force = false) {
      if (!this.root || !this.started) return;
      const player = this.state.player;
      const levelTarget = this.levelThreshold(player.level);
      const setWidth = (selector, value) => {
        const element = this.root.querySelector(selector);
        if (element) element.style.setProperty("--value", `${clamp(value, 0, 100)}%`);
      };
      setWidth("[data-har-health]", (player.health / player.maxHealth) * 100);
      setWidth("[data-har-stamina]", (player.stamina / player.maxStamina) * 100);
      setWidth("[data-har-xp]", player.level >= PLAYER_LEVEL_CAP ? 100 : (player.xp / levelTarget) * 100);
      const avatar = this.root.querySelector(".har-avatar");
      avatar?.setAttribute("data-level", String(player.level));
      avatar?.setAttribute("data-character", this.state.roster.activeId);
      if (avatar) avatar.style.setProperty("--portrait-x", `${(CHARACTER_ATLAS_INDEX[this.state.roster.activeId] || 0) * 33.333333}%`);
      this.root.querySelector("[data-har-player-name]").textContent = player.name;
      this.root.querySelector("[data-har-player-meta]").textContent = `Nhà du hành · ${ELEMENTS[player.element].label} · ${Math.round(player.health)}/${player.maxHealth} HP`;
      const weaponClass = this.equippedWeaponClass();
      const combatProfile = WEAPON_COMBAT_PROFILES[weaponClass] || WEAPON_COMBAT_PROFILES.sword;
      const combatLabels = {
        attack: combatProfile.attackName,
        skill: combatProfile.skillName,
        ultimate: combatProfile.ultimateName
      };
      const combatIcons = { attack: combatProfile.icon, skill: "✦", ultimate: "✺" };
      Object.entries(combatLabels).forEach(([action, label]) => {
        const button = this.root.querySelector(`[data-har-action="${action}"]`);
        if (!button) return;
        button.dataset.label = label;
        button.dataset.weaponClass = weaponClass;
        button.title = `${combatProfile.label} · ${label}`;
        button.setAttribute("aria-label", `${combatProfile.label}: ${label}`);
        const icon = button.querySelector("strong");
        if (icon) icon.textContent = combatIcons[action];
      });
      const actionDock = this.root.querySelector(".har-action-dock");
      if (actionDock) actionDock.dataset.weaponClass = weaponClass;
      this.root.querySelectorAll("[data-touch-action]").forEach((button) => {
        const action = button.dataset.touchAction;
        if (!combatLabels[action]) return;
        button.textContent = combatIcons[action];
        button.title = combatLabels[action];
        button.setAttribute("aria-label", combatLabels[action]);
      });
      this.root.querySelector("[data-har-zone]").textContent = this.currentZone.name;
      this.root.querySelector("[data-har-weather]").textContent = this.currentZone.weather;
      const hour = Math.floor(this.state.worldTime);
      const minute = Math.floor((this.state.worldTime % 1) * 60);
      this.root.querySelector("[data-har-time]").textContent = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      this.root.querySelector("[data-har-fps]").textContent = this.fps ? `${this.fps} FPS · scale ${Math.round(this.renderScale * 100)}%` : "Đang đo";
      const rendererMaterialLabel = this.photorealStatus === "hdr-photogrammetry-ready"
        ? "HDR · SCAN PBR"
        : ["ready", "scenic-3d-ready"].includes(this.photorealStatus)
          ? "IBL PBR"
          : "MESH PBR";
      this.root.querySelector("[data-har-renderer]").textContent = `${this.rendererBackend === "webgpu" ? "WEBGPU" : "WEBGL2"} · ${rendererMaterialLabel}`;
      const activeCharacterMesh = this.characterMeshes.get(this.state.roster.activeId);
      const activeCharacterRuntime = this.characterRuntimes.get(this.state.roster.activeId);
      const characterRuntimeLabel = this.root.querySelector("[data-har-character-runtime]");
      if (characterRuntimeLabel) {
        const source = activeCharacterMesh?.userData?.visualMode === "gltf-imported"
          ? "GLB"
          : activeCharacterMesh?.userData?.visualMode === "builtin-rigged"
            ? "RIGGED 3D"
            : "3D PBR";
        characterRuntimeLabel.textContent = `${source} · ${(activeCharacterRuntime?.state || this.activeAnimation || "idle").toUpperCase()}`;
      }
      const worldZone = this.state.world?.zones?.[this.currentZone.id];
      const worldState = this.root.querySelector("[data-har-world-state]");
      if (worldState) worldState.textContent = this.state.world?.activeEvent
        ? "EVENT ACTIVE"
        : worldZone?.restored
          ? "RESTORED"
          : worldZone?.discovered
            ? "DISCOVERED"
            : "UNSCANNED";
      this.root.querySelector("[data-har-minimap-label]").textContent = this.currentZone.name;
      const storyChapter = this.currentStoryChapter();
      const storyComplete = this.state.story?.step === "complete";
      const storyStepLabels = {
        cinematic: "Xem cinematic để mở nhiệm vụ chính",
        mission: storyChapter.objective,
        complete: "Nexus đã được sửa · Echo mới đang chờ"
      };
      this.root.querySelector("[data-har-quest-title]").textContent = storyComplete
        ? "Nexus Echo · Hoàn tất"
        : `Chương ${storyChapter.chapter} · ${storyChapter.title}`;
      this.root.querySelector("[data-har-quest-progress]").textContent = storyStepLabels[this.state.story?.step] || storyChapter.objective;

      const boss = [...this.enemies.values()].find((enemy) => enemy.userData.boss && enemy.visible && !enemy.userData.defeated);
      const bossDistance = boss ? Math.hypot(player.x - boss.position.x, player.z - boss.position.z) : Infinity;
      const bossBar = this.root.querySelector("[data-har-boss]");
      bossBar.hidden = !(boss && bossDistance < 28);
      if (!bossBar.hidden) {
        this.root.querySelector("[data-har-boss-name]").textContent = boss.userData.name;
        this.root.querySelector("[data-har-boss-meter]").style.setProperty("--value", `${(boss.userData.health / boss.userData.maxHealth) * 100}%`);
        this.root.querySelector("[data-har-boss-phase]").textContent = `PHASE ${boss.userData.bossPhase} · ${boss.userData.shield > 0 ? `ASTRAL SHELL ${Math.round(boss.userData.shield)}` : "WEAK POINT OPEN"}`;
      }
      if (!this.trainingActive && (!this.dpsSamples.length || performance.now() - this.dpsSamples.at(-1).at > 8000)) {
        this.root.querySelector("[data-har-dps]").classList.remove("is-active");
      }
      this.updateCooldowns();
      this.updateConnectionUi();
      if (force && this.currentPanel) this.renderCurrentPanel();
    }

    updateCooldowns() {
      const now = performance.now();
      const weaponClass = this.equippedWeaponClass();
      const combatProfile = WEAPON_COMBAT_PROFILES[weaponClass] || WEAPON_COMBAT_PROFILES.sword;
      const values = {
        attack: Math.max(0, combatProfile.cooldown.attack - (now - this.lastAttackAt)),
        skill: Math.max(0, combatProfile.cooldown.skill - (now - this.lastSkillAt)),
        ultimate: this.state.player.ultimate >= 100 ? 0 : Math.max(0, combatProfile.cooldown.ultimate - (now - this.lastUltimateAt)),
        dodge: Math.max(0, 900 - (now - this.lastDodgeAt))
      };
      Object.entries(values).forEach(([id, remaining]) => {
        const element = this.root.querySelector(`[data-cooldown="${id}"]`);
        const button = element?.closest(".har-action");
        if (element) element.textContent = remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : id === "ultimate" ? `${Math.round(this.state.player.ultimate)}%` : "";
        if (button) button.dataset.ready = String(remaining <= 0 && (id !== "ultimate" || this.state.player.ultimate >= 100));
      });
    }

    renderMinimap() {
      const canvas = this.root.querySelector("[data-har-minimap]");
      const context = canvas?.getContext("2d");
      if (!context) return;
      const width = canvas.width;
      const center = width / 2;
      const scale = width / (WORLD_LIMIT * 2 + 24);
      context.clearRect(0, 0, width, width);
      const gradient = context.createRadialGradient(center, center, 4, center, center, center);
      gradient.addColorStop(0, "rgba(20,46,76,.9)");
      gradient.addColorStop(1, "rgba(2,6,18,.96)");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(center, center, center - 2, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(112,225,255,.15)";
      context.lineWidth = 1;
      [0.25, 0.5, 0.75].map((ratio) => WORLD_LIMIT * ratio).forEach((radius) => {
        context.beginPath();
        context.arc(center, center, radius * scale, 0, Math.PI * 2);
        context.stroke();
      });
      const map = (x, z) => [center + x * scale, center + z * scale];
      ZONES.forEach((zone) => {
        const [x, y] = map(zone.x, zone.z);
        context.fillStyle = `${zone.color}22`;
        context.strokeStyle = `${zone.color}88`;
        context.beginPath();
        context.arc(x, y, zone.radius * scale, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        if (this.state.checkpoints[zone.id]) {
          context.fillStyle = zone.color;
          context.fillRect(x - 2, y - 2, 4, 4);
        }
      });
      this.enemies.forEach((enemy) => {
        if (!enemy.visible || enemy.userData.defeated) return;
        const [x, y] = map(enemy.position.x, enemy.position.z);
        context.fillStyle = enemy.userData.boss ? "#ff4f79" : "#ff9278";
        context.beginPath();
        context.arc(x, y, enemy.userData.boss ? 4.2 : 2.4, 0, Math.PI * 2);
        context.fill();
      });
      this.collectibles.forEach((node) => {
        if (!node.visible) return;
        const [x, y] = map(node.position.x, node.position.z);
        context.fillStyle = "#ffdc78";
        context.fillRect(x - 1.5, y - 1.5, 3, 3);
      });
      this.remotePlayers.forEach((remote) => {
        const [x, y] = map(remote.position.x, remote.position.z);
        context.fillStyle = "#ff78d2";
        context.beginPath();
        context.arc(x, y, 3, 0, Math.PI * 2);
        context.fill();
      });
      const [px, py] = map(this.state.player.x, this.state.player.z);
      context.save();
      context.translate(px, py);
      context.rotate(-this.state.player.rotation);
      context.fillStyle = "#ffffff";
      context.shadowColor = "#68eeff";
      context.shadowBlur = 10;
      context.beginPath();
      context.moveTo(0, -6);
      context.lineTo(4.5, 5);
      context.lineTo(0, 3);
      context.lineTo(-4.5, 5);
      context.closePath();
      context.fill();
      context.restore();
      context.strokeStyle = "rgba(109,236,255,.6)";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(center, center, center - 3, 0, Math.PI * 2);
      context.stroke();
    }

    applyAdaptiveQualityTier(tier) {
      const normalizedTier = clamp(tier, 0, RENDER_SCALE_STEPS.length - 1);
      this.renderScaleTier = normalizedTier;
      this.renderScale = RENDER_SCALE_STEPS[normalizedTier];
      this.root.dataset.adaptiveTier = String(normalizedTier);
      this.renderer.setPixelRatio(Math.min(2, (root.devicePixelRatio || 1) * this.renderScale));
      if (this.starfield) this.starfield.material.opacity = [0.62, 0.5, 0.38, 0.28][normalizedTier];
      if (this.weatherField) this.weatherField.visible = normalizedTier < 3 || this.currentZone.id !== "central";
      this.zoneFxGroups.forEach((group) => {
        group.children.forEach((object) => {
          if (!object.userData?.livingParticles) return;
          object.material.opacity = object.userData.baseOpacity * [1, 0.78, 0.54, 0.34][normalizedTier];
        });
      });
      this.lastStreamingCell = "";
      this.updateWorldStreaming({ force: true });
    }

    trackFps() {
      const now = performance.now();
      this.fpsFrames += 1;
      const elapsed = now - this.fpsStartedAt;
      if (elapsed < 1000) return;
      const sampledFps = (this.fpsFrames * 1000) / elapsed;
      this.fps = Math.round(sampledFps);
      this.fpsEma = this.fpsEma > 0 ? this.fpsEma * 0.82 + sampledFps * 0.18 : sampledFps;
      this.fpsFrames = 0;
      this.fpsStartedAt = now;
      if (this.state.settings.quality === "auto" && this.state.settings.dynamicResolution !== false) {
        const lowThreshold = this.forceCompatibility ? 27 : 43;
        const highThreshold = this.forceCompatibility ? 32 : 56;
        if (this.fpsEma < lowThreshold) {
          this.lowFpsWindows += 1;
          this.highFpsWindows = 0;
        } else if (this.fpsEma > highThreshold) {
          this.highFpsWindows += 1;
          this.lowFpsWindows = 0;
        } else {
          this.lowFpsWindows = 0;
          this.highFpsWindows = 0;
        }
        const cooldownElapsed = now - this.lastQualityTransitionAt >= 10000;
        if (cooldownElapsed && this.lowFpsWindows >= 3 && this.renderScaleTier < RENDER_SCALE_STEPS.length - 1) {
          this.applyAdaptiveQualityTier(this.renderScaleTier + 1);
          this.lowFpsWindows = 0;
          this.lastQualityTransitionAt = now;
        } else if (cooldownElapsed && this.highFpsWindows >= 10 && this.renderScaleTier > 0) {
          this.applyAdaptiveQualityTier(this.renderScaleTier - 1);
          this.highFpsWindows = 0;
          this.lastQualityTransitionAt = now;
        }
      }
    }

    resize() {
      if (!this.renderer || !this.camera) return;
      const stage = this.root.querySelector("[data-har-stage]");
      const width = Math.max(1, stage.clientWidth);
      const height = Math.max(1, stage.clientHeight);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      const qualityRatios = { low: 0.58, medium: 0.82, high: 1, cinematic: 1, auto: this.renderScale };
      const ratio = qualityRatios[this.state.settings.quality] ?? 1;
      this.renderer.setPixelRatio(Math.min(2, (root.devicePixelRatio || 1) * ratio));
      this.renderer.setSize(width, height, false);
    }

    openPanel(type) {
      if (!this.started && type !== "settings") return;
      this.currentPanel = type;
      const panel = this.root.querySelector("[data-har-panel-root]");
      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      if (!this.authoritative && !["party", "settings"].includes(type)) this.menuPaused = true;
      this.renderCurrentPanel();
    }

    closePanel() {
      this.currentPanel = "";
      this.menuPaused = false;
      const panel = this.root.querySelector("[data-har-panel-root]");
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
    }

    renderCurrentPanel() {
      if (!this.currentPanel) return;
      const body = this.root.querySelector("[data-har-panel-body]");
      const title = this.root.querySelector("[data-har-panel-title]");
      const kicker = this.root.querySelector("[data-har-panel-kicker]");
      const panel = this.root.querySelector("[data-har-panel-root]");
      const renderers = {
        map: () => this.renderMapPanel(),
        quests: () => this.renderQuestPanel(),
        world: () => this.renderWorldPanel(),
        factions: () => this.renderFactionPanel(),
        companions: () => this.renderCompanionPanel(),
        ship: () => this.renderShipPanel(),
        training: () => this.renderTrainingPanel(),
        codex: () => this.renderCodexPanel(),
        inventory: () => this.renderInventoryPanel(),
        craft: () => this.renderCraftPanel(),
        skills: () => this.renderSkillsPanel(),
        characters: () => this.renderCharactersPanel(),
        creator: () => this.renderCharacterCreatorPanel(),
        party: () => this.renderPartyPanel(),
        settings: () => this.renderSettingsPanel(),
        paused: () => this.renderPausePanel(),
        defeated: () => this.renderDefeatedPanel()
      };
      const meta = {
        map: ["Bản đồ Astral", "Astral Navigation", "#6feeff"],
        quests: ["Nhiệm vụ", "Mission Constellation", "#a986ff"],
        world: ["Thế giới sống", "Persistent World", "#65f1c7"],
        factions: ["Phe phái & danh tiếng", "Faction Observatory", "#ffd36b"],
        companions: ["Đồng đội", "Companion Stories", "#ff78d2"],
        ship: ["Personal Ship", "Horizon H Command", "#6feeff"],
        training: ["Training Arena", "Combat Analytics", "#ff805f"],
        codex: ["Astral Codex", "Lore & Discoveries", "#ae78ff"],
        inventory: ["Kho đồ", "Asset Vault", "#65f2ba"],
        craft: ["Astral Forge", "Crafting Station", "#ffaf67"],
        skills: ["Cây kỹ năng", "Resonance Matrix", "#ff70ce"],
        characters: ["Đội hình Astral", "Character Observatory", "#ff78d2"],
        creator: ["Character Creator", "Appearance Observatory", "#71efff"],
        party: ["Co-op 1–8", "Realtime Shard", "#73eaff"],
        settings: ["Thiết lập", "Graphics & Controls", "#ffd36b"],
        paused: ["Tạm dừng", "Game Paused", "#a78bff"],
        defeated: ["Lõi năng lượng cạn", "Mission Interrupted", "#ff6d78"]
      }[this.currentPanel] || ["Astral Console", "Holographic Console", "#6feeff"];
      title.textContent = meta[0];
      kicker.textContent = meta[1];
      panel.style.setProperty("--panel-accent", meta[2]);
      body.innerHTML = renderers[this.currentPanel]?.() || "<p>Chưa có dữ liệu.</p>";
      this.bindPanelControls();
    }

    renderCharactersPanel() {
      const activeId = this.state.roster.activeId;
      return `
        <div class="har-section har-character-v9-hero"><small>DIGITAL HUMAN CORE · VISUAL V${CHARACTER_VISUAL_VERSION}</small><h3>Character V${CHARACTER_VISUAL_VERSION} · gương mặt, da, mắt, tóc và chuyển động thế hệ mới</h3><p>Nhân vật mặc định vẫn là SkinnedMesh PBR toàn thân. Runtime V${CHARACTER_VISUAL_VERSION} bổ sung driver 52 kênh, viseme, vật liệu da năm lớp, secondary motion và LOD thích ứng; số morph native luôn được báo theo dữ liệu thật của GLB.</p></div>
        <ul class="har-character-list">${CHARACTER_ORDER.map((id, index) => {
          const profile = CHARACTERS[id];
          const member = this.state.roster.members[id] || {};
          const active = id === activeId;
          const runtime = this.characterRuntimes.get(id);
          const asset = this.characterAssetStatus.get(id) || "Web Hero PBR";
          const weaponId = this.state.loadouts?.[id]?.weapon || DEFAULT_CHARACTER_WEAPONS[id] || "starter-blade";
          const weapon = ITEMS[weaponId] || ITEMS["starter-blade"];
          const combat = WEAPON_COMBAT_PROFILES[weapon.weaponClass || "sword"] || WEAPON_COMBAT_PROFILES.sword;
          return `<li class="har-character-card ${active ? "is-active" : ""}" style="--character-color:${profile.accent};--portrait-x:${index * 33.333333}%">
            <div class="har-character-card__avatar"><i aria-hidden="true"></i><strong>${profile.short}</strong><span>${ELEMENTS[profile.element].short}</span></div>
            <div><strong>${escapeHtml(profile.name)}</strong><span>${escapeHtml(profile.role)}</span><small>${escapeHtml(profile.description)}</small><small>Lv.${member.level || 1} · ${Math.round(member.health || 100)}/${member.maxHealth || 100} HP · ${ELEMENTS[profile.element].label}</small><small>${escapeHtml(weapon.name)} · ${escapeHtml(combat.attackName)} / ${escapeHtml(combat.skillName)} / ${escapeHtml(combat.ultimateName)}</small><small>${escapeHtml(asset)} · ${runtime?.state || "idle"}</small></div>
            <button class="har-chip ${active ? "is-active" : ""}" type="button" data-panel-action="switch-character" data-character="${id}">${active ? "Đang dùng" : `Đổi [${index + 1}]`}</button>
          </li>`;
        }).join("")}</ul>
        ${this.characterExternalCandidates.length ? `<div class="har-section"><h3>Sketchfab CC BY · nữ chính được tuyển chọn</h3><p>Miss Galaxy và Game Character Girl đã được kiểm tra license, chuẩn hóa lần lượt 75/136 xương và dùng humanoid solver theo rest pose để tránh vặn tay/chân. Animation retarget không vượt visual QA sẽ không được tải trong gameplay. Các model còn lại chỉ được kích hoạt sau cùng quy trình kiểm định.</p><ul class="har-list">${this.characterExternalCandidates.map((candidate) => {
          const profile = CHARACTERS[candidate.characterId];
          const combat = WEAPON_COMBAT_PROFILES[candidate.weaponClass] || WEAPON_COMBAT_PROFILES.sword;
          return `<li class="har-list-item"><div><strong>${escapeHtml(candidate.label)} → ${escapeHtml(profile.name)}</strong><span>${escapeHtml(candidate.author)} · ${escapeHtml(candidate.license)}</span><small>${escapeHtml(combat.label)} · ${escapeHtml(combat.skillName)} · ${candidate.status === "integrated-local-safe-motion" ? "Đã tích hợp GLB local · animation humanoid an toàn" : candidate.status === "awaiting-authenticated-download" ? "Chờ đăng nhập Sketchfab" : escapeHtml(candidate.status)}</small></div><a class="har-chip" href="${escapeHtml(candidate.page)}" target="_blank" rel="noopener noreferrer">Mở nguồn</a></li>`;
        }).join("")}</ul></div>` : ""}
        <div class="har-section"><h3>Character Pipeline</h3><div class="har-character-pipeline">${CHARACTER_PIPELINE.map((item) => `<div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.role)}</span><small>${escapeHtml(item.id === "three" ? `Runtime V${CHARACTER_VISUAL_VERSION}` : item.state)}</small></div>`).join("")}</div></div>
        <div class="har-section"><h3>Nguồn hình học nhân vật</h3><p>Catalog có ${this.characterPipelineManifest.filter((entry) => entry.url.startsWith("./assets/astral-realms/characters/")).length} GLB local có license và provenance, cùng thư viện VALID mở rộng. Chỉ model đang dùng mới được tải từ pipeline; GLB HH và procedural human luôn giữ vai trò fallback, nên máy yếu hoặc mạng chậm vẫn không có khung hình trống.</p>
          <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="open-character-creator">Mở Character Creator</button></div>
        </div>`;
    }

    activeAppearanceRecipe() {
      const id = this.state.roster.activeId;
      this.state.appearance ||= { recipes: {}, savedPresets: [], lastSavedAt: "" };
      this.state.appearance.recipes[id] ||= defaultAppearanceRecipe(id);
      this.state.appearance.recipes[id] = normalizeAppearanceRecipe(this.state.appearance.recipes[id], id);
      return this.state.appearance.recipes[id];
    }

    renderCharacterCreatorPanel() {
      const id = this.state.roster.activeId;
      const profile = CHARACTERS[id] || CHARACTERS.lyra;
      const recipe = this.activeAppearanceRecipe();
      const group = APPEARANCE_GROUPS.find((item) => item.id === this.appearanceGroup) || APPEARANCE_GROUPS[0];
      const mesh = this.characterMeshes.get(id);
      const runtime = this.characterRuntimes.get(id);
      const qa = runtime?.qaReport || mesh?.userData?.qaReport || this.lastCharacterQa;
      const gltfActive = ["gltf-imported", "builtin-rigged"].includes(mesh?.userData?.visualMode);
      const trulyRigged = Boolean(
        gltfActive
        && qa?.skinnedMeshes
        && Number(qa?.skeletonCoverage || 0) >= 0.55
        && runtime?.bones?.hips
        && runtime?.bones?.head
      );
      const capability = gltfActive
        ? `${this.characterAssetStatus.get(id) || "GLB"} · ${trulyRigged ? "SkinnedMesh hợp lệ" : "không có humanoid rig đầy đủ"}`
        : "HH Articulated PBR · fallback nhẹ, không giả nhận là SkinnedMesh";
      const lodCapability = qa?.lodGroups
        ? `${qa.lodGroups} nhóm GLB`
        : mesh?.userData?.visualMode === "builtin-rigged"
          ? "Human Rig + proxy 3D"
          : "proxy 3D thích ứng";
      const saved = this.state.appearance.savedPresets || [];
      const nativeFaceChannels = Math.min(52, Number(runtime?.facialChannels || 0));
      const bakedMotionCount = this.motionLibraryManifest?.clips?.length || 0;
      const missingMotionCount = this.motionLibraryManifest?.missing?.length || 0;
      const dna = encodeCharacterDNA(recipe, id);
      const modelOptions = [...new Map([
        ...APPEARANCE_ASSETS.baseModels.map((modelId) => [modelId, { modelId, label: modelId }]),
        ...this.characterPipelineManifest
          .filter((entry) => ["valid-avatar", "sketchfab-cc-by"].includes(entry.provider))
          .map((entry) => [entry.modelId, { modelId: entry.modelId, label: entry.label }])
      ]).values()];
      return `
        <div class="har-creator">
          <div class="har-creator__hero">
            <div><small>DIGITAL HUMAN CORE V${CHARACTER_VISUAL_VERSION} · ${escapeHtml(profile.name)}</small><h3>${recipe.style === "human-cinematic" ? "Web Digital Human" : "Anime Realistic"}</h3><p>${escapeHtml(capability)} · collider gameplay giữ cố định để multiplayer công bằng.</p></div>
            <span class="har-chip ${trulyRigged ? "is-active" : ""}">${trulyRigged ? "RIGGED GLB" : gltfActive ? "GLB FALLBACK" : "PBR FALLBACK"}</span>
          </div>
          <div class="har-character-runtime-grid">
            <div><small>Motion</small><strong>${escapeHtml(runtime?.state || this.activeAnimation || "idle")}</strong><span>${runtime?.clips?.size || 0} clip GLB · ${escapeHtml(this.motionLibraryStatus)}</span></div>
            <div><small>Skeleton</small><strong>${runtime ? Object.keys(runtime.bones || {}).length : 0}/${Object.keys(HH_HUMANOID_SKELETON).length}</strong><span>HH slots nhận diện</span></div>
            <div><small>Face</small><strong>52 driver</strong><span>${nativeFaceChannels}/52 native morph · ${runtime?.faceFallback?.driver || "procedural fallback"}</span></div>
            <div><small>LOD</small><strong>${escapeHtml(mesh?.userData?.modelTier || "hero")}</strong><span>${escapeHtml(lodCapability)}</span></div>
          </div>
          <div class="har-section har-digital-human-stack">
            <div><small>HEAD TARGET</small><strong>18–28K</strong><span>GLB nhập vào được đo thực tế; Human Rig tích hợp không giả nhận đủ chuẩn head mesh.</span></div>
            <div><small>SKIN STACK</small><strong>5 lớp</strong><span>micro-normal · roughness · SSS approximation · flush · wetness</span></div>
            <div><small>EYE SYSTEM</small><strong>3 lớp</strong><span>iris · cornea · tear response khi model có mesh tách</span></div>
            <div><small>ANIMATION V13</small><strong>${bakedMotionCount} baked</strong><span>${missingMotionCount} clip chờ asset · blend space · foot lock</span></div>
          </div>
          <div class="har-section har-character-import">
            <div><h3>Nhập GLB nén có kiểm định</h3><p>Hỗ trợ Draco, Meshopt và KTX2. File được giải mã, đo giới hạn GPU và kiểm tra cục bộ trước khi thay nhân vật; không tải lên máy chủ HH.</p><small>Decoder: ${this.characterDecodersReady ? "Draco · Meshopt · KTX2 sẵn sàng" : "GLB cơ bản"} · tối đa ${Math.round(CHARACTER_IMPORT_LIMITS.triangles / 1000)}K triangles</small></div>
            <label class="har-character-file"><span>Chọn GLB ≤ 32 MB</span><input type="file" accept=".glb,model/gltf-binary" data-character-glb></label>
          </div>
          ${qa ? `<div class="har-section har-character-qa"><h3>Character QA · ${Math.round(qa.score ?? 100)}/100 · ${escapeHtml(qa.digitalHumanTier || "gameplay-rig")}</h3><div class="har-character-runtime-grid"><div><small>Geometry</small><strong>${Number(qa.triangles || 0).toLocaleString("vi-VN")}</strong><span>triangles</span></div><div><small>Head</small><strong>${Number(qa.headVertices || 0).toLocaleString("vi-VN")}</strong><span>vertices · mục tiêu 18–28K</span></div><div><small>Face</small><strong>${qa.faceMorphTargets || 0}/52</strong><span>native facial morph</span></div><div><small>Rig</small><strong>${qa.skinnedMeshes || 0}</strong><span>SkinnedMesh · ${qa.bones || 0} bone</span></div><div><small>Eyes/Hair</small><strong>${qa.separateEyeMeshes || 0}/${qa.hairCardMeshes || 0}</strong><span>mesh tách nhận diện</span></div><div><small>Textures</small><strong>${qa.textures || 0}</strong><span>tối đa ${qa.maxTextureSize || 0}px</span></div><div><small>Clips</small><strong>${qa.animations || 0}</strong><span>${Number(qa.animationSeconds || 0).toFixed(1)} giây</span></div><div><small>LOD groups</small><strong>${qa.lodGroups || 0}</strong><span>${qa.lodGroups ? "GLB explicit" : "HH fallback proxy"}</span></div></div>${qa.warnings?.length ? `<p>${qa.warnings.map(escapeHtml).join("<br>")}</p>` : "<p>Không có cảnh báo tương thích.</p>"}</div>` : ""}
          <div class="har-section"><h3>Motion Lab</h3><p>Xem ngay state machine và crossfade trước khi đưa animation vào gameplay.</p><div class="har-motion-grid">
            ${["idle", "walk", "run", "sprint", "jump", "land", "dodge", "attack1", "attack2", "attack3", "skill", "ultimate", "hit"].map((motion) => `<button class="har-chip ${this.activeAnimation === motion ? "is-active" : ""}" type="button" data-panel-action="character-preview-motion" data-motion="${motion}">${motion}</button>`).join("")}
          </div></div>
          <div class="har-section har-face-pilot">
            <div><h3>MediaPipe Face Pilot · 478 landmark / 52 blendshape</h3><p>Chỉ bật sau khi bạn chủ động cấp quyền. Video xử lý trên thiết bị và không được gửi tới backend HH.</p></div>
            <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="toggle-face-pilot">${this.facePilot.status === "running" || this.facePilot.status === "loading" ? "Tắt Face Pilot" : "Bật Face Pilot"}</button><span class="har-chip ${this.facePilot.status === "running" ? "is-active" : ""}">${escapeHtml(this.facePilot.status.toUpperCase())}${this.facePilot.frame ? ` · ${this.facePilot.frame} frames` : ""}</span></div>
            ${this.facePilot.error ? `<small class="har-face-pilot__error">${escapeHtml(this.facePilot.error)}</small>` : ""}
          </div>
          <div class="har-section har-face-performance-lab">
            <div><h3>Expression & Viseme Lab</h3><p>Thử trực tiếp 52 kênh biểu cảm, corrective fallback và khẩu hình A/E/I/O/U/MBP/FV/L/WQ.</p></div>
            <div class="har-performance-row"><span>Biểu cảm</span>${Object.keys(CHARACTER_EXPRESSION_PRESETS).map((name) => `<button class="har-chip ${recipe.expression === name ? "is-active" : ""}" type="button" data-panel-action="character-expression" data-expression="${name}">${name}</button>`).join("")}</div>
            <div class="har-performance-row"><span>Viseme</span>${Object.keys(CHARACTER_VISEMES).map((name) => `<button class="har-chip ${recipe.viseme === name ? "is-active" : ""}" type="button" data-panel-action="character-viseme" data-viseme="${name}">${name}</button>`).join("")}</div>
          </div>
          <div class="har-creator__toolbar">
            <label class="har-field">Web pipeline<select data-appearance-setting="sourceProvider">${CHARACTER_PIPELINE_SOURCES.map((value) => `<option value="${value}" ${recipe.sourceProvider === value ? "selected" : ""}>${value === "auto" ? "Auto: MetaHuman → CC5 → MPFB → GLB" : value}</option>`).join("")}</select></label>
            <label class="har-field">Model nền · ${modelOptions.length} người<select data-appearance-setting="baseModel">${modelOptions.map((item) => `<option value="${escapeHtml(item.modelId)}" ${recipe.baseModel === item.modelId ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></label>
            <label class="har-field">Preset cơ thể<select data-appearance-setting="bodyPreset">${Object.entries(APPEARANCE_PRESETS).map(([value, item]) => `<option value="${value}" ${recipe.bodyPreset === value ? "selected" : ""}>${item.label}</option>`).join("")}</select></label>
            <label class="har-field">Phong cách<select data-appearance-setting="style"><option value="anime-realistic" ${recipe.style === "anime-realistic" ? "selected" : ""}>Anime Realistic</option><option value="human-cinematic" ${recipe.style === "human-cinematic" ? "selected" : ""}>Human Cinematic</option></select></label>
          </div>
          <div class="har-section"><p><strong>Pipeline runtime:</strong> ${escapeHtml(this.builtInCharacterSources.get(recipe.baseModel)?.label || (this.characterPipelineStatus === "configured" ? "Đang tìm asset web-ready" : "Chưa có asset MetaHuman/CC5/MPFB"))}. ${this.characterPipelineStatus === "configured" ? "Asset trong manifest sẽ được QA trước khi dùng." : "Đang dùng GLB HH hoặc procedural fallback; không có khung hình trống."}</p></div>
          <div class="har-creator__options">
            <label><input type="checkbox" data-appearance-setting="symmetry" ${recipe.symmetry ? "checked" : ""}> Chỉnh đối xứng</label>
            <label><input type="checkbox" data-appearance-setting="advanced" ${recipe.advanced ? "checked" : ""}> Chế độ nâng cao trái–phải</label>
            <label class="har-creator__color">Da <input type="color" value="${recipe.skinColor}" data-appearance-setting="skinColor"></label>
            <label class="har-creator__color">Mắt <input type="color" value="${recipe.eyeColor}" data-appearance-setting="eyeColor"></label>
            <label class="har-creator__color">Tóc <input type="color" value="${recipe.hairColor}" data-appearance-setting="hairColor"></label>
          </div>
          <div class="har-creator__modules">
            <label class="har-field">Tóc<select data-appearance-setting="hair">${APPEARANCE_ASSETS.hairs.map((value) => `<option value="${value}" ${recipe.hair === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
            <label class="har-field">Râu<select data-appearance-setting="beard">${APPEARANCE_ASSETS.beards.map((value) => `<option value="${value}" ${recipe.beard === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
            <label class="har-field">Lông mày<select data-appearance-setting="brow">${APPEARANCE_ASSETS.brows.map((value) => `<option value="${value}" ${recipe.brow === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
            <label class="har-field">Makeup<select data-appearance-setting="makeup">${APPEARANCE_ASSETS.makeups.map((value) => `<option value="${value}" ${recipe.makeup === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
            <label class="har-field">Phụ kiện<select data-appearance-setting="accessory">${APPEARANCE_ASSETS.accessories.map((value) => `<option value="${value}" ${recipe.accessory === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
            <label class="har-field">Trang phục<select data-appearance-setting="outfitPrimary">${APPEARANCE_ASSETS.outfits.map((value) => `<option value="${value}" ${recipe.outfit[0] === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
          </div>
          <div class="har-creator__tabs" role="tablist" aria-label="Nhóm ngoại hình">
            ${APPEARANCE_GROUPS.map((item) => `<button type="button" class="${item.id === group.id ? "is-active" : ""}" data-appearance-group="${item.id}" role="tab" aria-selected="${item.id === group.id}">${item.label}</button>`).join("")}
          </div>
          <div class="har-creator__sliders">
            ${group.controls.map(([controlId, label]) => {
              const control = APPEARANCE_CONTROL_MAP[controlId];
              const value = recipe.morphs[controlId] ?? control.defaultValue;
              return `<label class="har-appearance-slider"><span>${escapeHtml(label)}<output data-appearance-output="${controlId}">${Math.round(value * 100)}</output></span><input type="range" min="0" max="1" step="0.01" value="${value}" data-appearance-morph="${controlId}" aria-label="${escapeHtml(label)}"></label>`;
            }).join("")}
          </div>
          <div class="har-creator__surface">
            <fieldset><legend>Chi tiết thật</legend>${Object.entries(recipe.decals).map(([key, value]) => `<label class="har-appearance-slider"><span>${escapeHtml(key)}<output data-appearance-detail-output="decals:${key}">${Math.round(value * 100)}</output></span><input type="range" min="0" max="1" step="0.01" value="${value}" data-appearance-detail="decals" data-detail-key="${key}"></label>`).join("")}</fieldset>
            <fieldset><legend>Digital Skin</legend>${Object.entries(recipe.surface).map(([key, value]) => `<label class="har-appearance-slider"><span>${escapeHtml(key)}<output data-appearance-detail-output="surface:${key}">${Math.round(value * 100)}</output></span><input type="range" min="0" max="1" step="0.01" value="${value}" data-appearance-detail="surface" data-detail-key="${key}"></label>`).join("")}</fieldset>
          </div>
          <div class="har-creator__actions">
            <button class="har-secondary-button" type="button" data-panel-action="appearance-undo" ${this.appearanceHistory.length ? "" : "disabled"}>↶ Hoàn tác</button>
            <button class="har-secondary-button" type="button" data-panel-action="appearance-redo" ${this.appearanceFuture.length ? "" : "disabled"}>↷ Làm lại</button>
            <button class="har-secondary-button" type="button" data-panel-action="appearance-random">Ngẫu nhiên có kiểm soát</button>
            <button class="har-secondary-button" type="button" data-panel-action="appearance-reset">Khôi phục</button>
            <input class="har-creator__name" type="text" maxlength="40" data-appearance-name placeholder="Tên preset">
            <button class="har-primary-button" type="button" data-panel-action="appearance-save">Lưu preset</button>
          </div>
          <div class="har-section har-creator__presets"><h3>Preset đã lưu</h3><div class="har-inline-actions">${saved.length ? saved.slice().reverse().map((preset) => `<button class="har-chip" type="button" data-panel-action="appearance-load-preset" data-preset-id="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</button>`).join("") : "<span>Chưa có preset ngoại hình.</span>"}</div></div>
          <div class="har-section har-character-dna"><div><h3>Character DNA</h3><p>Mã ngoại hình có phiên bản, không chứa email, tài khoản hoặc dữ liệu camera.</p></div><textarea rows="3" spellcheck="false" data-character-dna>${escapeHtml(dna)}</textarea><div class="har-inline-actions"><button class="har-secondary-button" type="button" data-panel-action="character-copy-dna">Sao chép DNA</button><button class="har-primary-button" type="button" data-panel-action="character-apply-dna">Nạp DNA</button></div></div>
          <div class="har-section har-creator__note"><p>Recipe ngoại hình và collider gameplay tách khỏi model. Material/morph chỉ được áp dụng khi asset thực sự hỗ trợ; skeleton, animation và LOD luôn hiển thị theo dữ liệu quét được, không theo tên provider.</p></div>
        </div>`;
    }

    renderWorldPanel() {
      const zoneState = this.state.world?.zones?.[this.currentZone.id] || WORLD_ZONE_DEFAULTS.central;
      const activeEvent = this.state.world?.activeEvent;
      const coreLabels = { stable: "Ổn định", unstable: "Bất ổn", corrupted: "Tha hóa", sealed: "Đang phong ấn", restored: "Đã phục hồi" };
      return `
        <div class="har-section har-system-hero" style="--system-accent:${this.currentZone.color}">
          <small>WORLD MEMORY · ${escapeHtml(this.currentZone.name)}</small>
          <h3>${zoneState.restored ? "Khu vực đang hồi sinh" : "Lõi năng lượng cần được giải phóng"}</h3>
          <p>${escapeHtml(this.currentZone.description)} Mọi thay đổi dưới đây được lưu trong world state và khôi phục sau khi tải lại.</p>
          <div class="har-stat-grid">
            <div><small>Lõi</small><strong>${coreLabels[zoneState.core] || zoneState.core}</strong></div>
            <div><small>Kiểm soát</small><strong>${escapeHtml(FACTIONS.find((faction) => faction.id === zoneState.occupation)?.short || "Tự do")}</strong></div>
            <div><small>Tài nguyên</small><strong>${Math.round(zoneState.resources)}%</strong></div>
            <div><small>Khám phá</small><strong>${zoneState.discovered ? "Đã mở" : "Chưa mở"}</strong></div>
          </div>
        </div>
        <div class="har-section">
          <h3>${activeEvent ? "Sự kiện đang diễn ra" : "Khởi tạo sự kiện thế giới"}</h3>
          ${activeEvent
            ? `<p><strong>${escapeHtml(activeEvent.title)}</strong><br>${escapeHtml(activeEvent.detail)}<br><b>Tiến độ: ${activeEvent.progress || 0}/${activeEvent.target || 3}</b></p>
               <div class="har-progress-row"><div class="har-meter har-meter--xp"><i style="--value:${Math.round(((activeEvent.progress || 0) / (activeEvent.target || 3)) * 100)}%"></i></div><output>${Math.round(((activeEvent.progress || 0) / (activeEvent.target || 3)) * 100)}%</output></div>
               <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="resolve-world-event" ${(activeEvent.progress || 0) >= (activeEvent.target || 3) ? "" : "disabled"}>${(activeEvent.progress || 0) >= (activeEvent.target || 3) ? "Hoàn thành sự kiện" : "Tiếp tục chiến đấu"}</button><button class="har-secondary-button" type="button" data-panel-action="abandon-world-event">Tạm dừng</button></div>`
            : `<p>Không có sự kiện ngẫu nhiên giả. Bạn có thể chủ động mở một nhiệm vụ cứu lõi cho khu vực hiện tại.</p>
               <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="start-zone-event">Gửi đội hỗ trợ tới ${escapeHtml(this.currentZone.name)}</button></div>`}
        </div>
        <ul class="har-list">${ZONES.map((zone) => {
          const record = this.state.world.zones[zone.id];
          return `<li class="har-list-item ${zone.id === this.currentZone.id ? "is-active" : ""}" style="--item-accent:${zone.color}">
            <div><strong>${escapeHtml(zone.name)}</strong><span>${escapeHtml(coreLabels[record?.core] || record?.core || "Chưa đồng bộ")} · ${record?.restored ? "đã phục hồi" : "cần cứu hộ"}</span><small>${record?.discovered ? "Đã khám phá" : "Chưa khám phá"} · tài nguyên ${Math.round(record?.resources || 0)}%</small></div>
            <span class="har-chip">${record?.updatedAt ? new Date(record.updatedAt).toLocaleDateString("vi-VN") : "—"}</span>
          </li>`;
        }).join("")}</ul>
        ${this.state.world.eventLog?.length ? `<div class="har-section"><h3>Timeline hậu quả</h3><p>${this.state.world.eventLog.slice(-5).reverse().map((event) => `<span class="har-event-line"><b>${escapeHtml(event.title)}</b> · ${escapeHtml(event.detail)} <small>${new Date(event.createdAt).toLocaleString("vi-VN")}</small></span>`).join("")}</p></div>` : ""}
      `;
    }

    renderFactionPanel() {
      const activeEvent = this.state.world?.activeEvent;
      return `
        <div class="har-section"><h3>Danh tiếng không khóa nội dung</h3><p>Mỗi phe có reputation riêng. Chọn phe hỗ trợ trong sự kiện hiện tại; phần thưởng, cửa hàng và nhiệm vụ sẽ mở theo rank.</p></div>
        <ul class="har-list">${FACTIONS.map((faction) => {
          const record = this.state.world.factions[faction.id] || { reputation: 0, rank: "Neutral", supportedEvents: 0 };
          const selected = activeEvent?.factionId === faction.id;
          return `<li class="har-list-item ${selected ? "is-active" : ""}" style="--item-accent:${faction.color}">
            <div><strong style="color:${faction.color}">${escapeHtml(faction.name)}</strong><span>${escapeHtml(faction.description)}</span><small>Rank ${escapeHtml(record.rank)} · ${Math.round(record.reputation)} REP · ${record.supportedEvents} sự kiện</small><small>Perk: ${escapeHtml(faction.perk)}</small></div>
            <div class="har-list-item__actions"><button class="har-chip ${selected ? "is-active" : ""}" type="button" data-panel-action="start-faction-event" data-faction="${faction.id}" ${activeEvent ? "disabled" : ""}>${selected ? "Đang hỗ trợ" : "Nhận nhiệm vụ"}</button></div>
          </li>`;
        }).join("")}</ul>
      `;
    }

    renderCompanionPanel() {
      return `
        <div class="har-section"><h3>Companion Stories</h3><p>Mỗi cuộc trò chuyện là một hoạt động được lưu. Bond mở dần ký ức và kỹ năng hỗ trợ ngoài chiến đấu.</p></div>
        <ul class="har-list">${CHARACTER_ORDER.map((id) => {
          const profile = CHARACTERS[id];
          const story = COMPANION_STORIES[id];
          const record = this.state.companions?.[id] || { unlocked: id === "lyra", bond: 0, storyStage: 0 };
          const cooldown = record.lastActivityAt && Date.now() - new Date(record.lastActivityAt).getTime() < 60000;
          return `<li class="har-list-item ${id === this.state.roster.activeId ? "is-active" : ""}" style="--item-accent:${profile.accent}">
            <div><strong>${escapeHtml(profile.name)} · Bond ${record.bond}/10</strong><span>${escapeHtml(story.title)} · ${escapeHtml(story.summary)}</span><small>${record.unlocked ? `Ký ức ${record.storyStage}/5 · Hỗ trợ: ${escapeHtml(story.support)}` : "Chưa mở khóa · bond sẽ bắt đầu khi nhân vật tham gia đội"}</small></div>
            <div class="har-list-item__actions"><button class="har-chip ${record.unlocked ? "is-active" : ""}" type="button" data-panel-action="bond-companion" data-companion="${id}" ${cooldown ? "disabled" : ""}>${cooldown ? "Đang hồi phục" : "Trò chuyện"}</button></div>
          </li>`;
        }).join("")}</ul>
      `;
    }

    renderShipPanel() {
      const ship = this.state.ship;
      return `
        <div class="har-section har-system-hero" style="--system-accent:#6feeff">
          <small>PERSONAL SHIP · HORIZON H</small>
          <h3><input class="har-inline-input" maxlength="32" value="${escapeHtml(ship.name)}" data-ship-name aria-label="Tên tàu"></h3>
          <p>Tàu là căn cứ lưu động: nâng cấp mô-đun, mở expedition và chuẩn bị đội hình trước khi ra vùng nguy hiểm.</p>
          <div class="har-stat-grid"><div><small>Cấp tàu</small><strong>Lv.${ship.level}</strong></div><div><small>Nhiên liệu</small><strong>${Math.round(ship.fuel)}%</strong></div><div><small>Crew</small><strong>${ship.crew.length}/4</strong></div><div><small>Expedition</small><strong>${this.state.stats.expeditions || 0}</strong></div></div>
          <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="launch-expedition" ${ship.fuel < 20 ? "disabled" : ""}>Khởi hành expedition</button><button class="har-secondary-button" type="button" data-panel-action="open-characters">Đổi crew</button></div>
        </div>
        <ul class="har-list">${Object.entries(SHIP_MODULES).map(([id, module]) => {
          const level = ship.modules[id] || 1;
          const requirements = Object.entries(module.cost).map(([itemId, amount]) => `${ITEMS[itemId]?.name || itemId} ${this.state.inventory[itemId]?.quantity || 0}/${amount}`).join(" · ");
          const ready = Object.entries(module.cost).every(([itemId, amount]) => Number(this.state.inventory[itemId]?.quantity || 0) >= amount);
          return `<li class="har-list-item ${level > 1 ? "is-active" : ""}">
            <div><strong>${escapeHtml(module.name)} · Lv.${level}/${module.max}</strong><span>${escapeHtml(module.description)}</span><small>${level >= module.max ? "Đã đạt tối đa" : `Cần ${requirements}`}</small></div>
            <button class="har-chip ${ready && level < module.max ? "is-active" : ""}" type="button" data-panel-action="upgrade-ship" data-module="${id}" ${ready && level < module.max ? "" : "disabled"}>${level >= module.max ? "Tối đa" : "Nâng cấp"}</button>
          </li>`;
        }).join("")}</ul>
      `;
    }

    renderTrainingPanel() {
      const sample = this.dpsSamples.at(-1);
      const dps = this.dpsSamples.length ? Math.round(this.dpsSamples.reduce((sum, item) => sum + item.damage, 0) / Math.max(1, (this.dpsSamples.at(-1).at - this.dpsSamples[0].at) / 1000)) : 0;
      return `
        <div class="har-section har-system-hero" style="--system-accent:#ff805f">
          <small>TRAINING ARENA · SERVER/LOCAL ANALYTICS</small>
          <h3>${this.trainingActive ? "Đang đo sát thương" : "Sẵn sàng kiểm tra build"}</h3>
          <p>Chỉ số lấy từ các hit thật trong phiên hiện tại; không tạo DPS mẫu khi chưa đánh.</p>
          <div class="har-stat-grid"><div><small>DPS hiện tại</small><strong>${dps || 0}</strong></div><div><small>Hit cao nhất</small><strong>${Math.round(this.state.stats.highestHit || 0)}</strong></div><div><small>Tổng damage</small><strong>${Math.round(this.state.stats.totalDamage || 0)}</strong></div><div><small>Perfect dodge</small><strong>${this.state.stats.perfectDodges || 0}</strong></div></div>
          <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="toggle-training">${this.trainingActive ? "Dừng đo" : "Bắt đầu đo tại Training Arena"}</button><button class="har-secondary-button" type="button" data-panel-action="open-skills">Mở build</button></div>
        </div>
        ${sample ? `<div class="har-section"><h3>Hit gần nhất</h3><p>${Math.round(sample.damage)} damage · ${new Date(sample.at).toLocaleTimeString("vi-VN")} · ${escapeHtml(sample.action || "combat")}</p></div>` : `<div class="har-section"><p>Chưa có hit nào trong phiên đo.</p></div>`}
      `;
    }

    renderCodexPanel() {
      const discovered = this.state.exploration?.codex || [];
      const events = this.state.world?.eventLog || [];
      return `
        <div class="har-section"><h3>Astral Codex</h3><p>Nhật ký chỉ ghi những gì người chơi thật sự quét, mở khóa hoặc hoàn thành.</p></div>
        <div class="har-codex-grid">
          ${ZONES.map((zone) => {
            const record = this.state.world.zones[zone.id];
            return `<article class="har-codex-card ${record?.discovered ? "is-found" : ""}" style="--item-accent:${zone.color}"><strong>${escapeHtml(zone.name)}</strong><span>${record?.discovered ? "Đã ghi nhận" : "Chưa quét"}</span><small>${record?.restored ? "Lõi đã phục hồi" : "Lõi chưa ổn định"}</small></article>`;
          }).join("")}
        </div>
        <div class="har-section"><h3>Khám phá đã lưu</h3><p>${discovered.length ? discovered.map((id) => `<span class="har-event-line">${escapeHtml(id)}</span>`).join("") : "Chưa có entry. Hãy mở bản đồ và tương tác với các điểm scan."}</p></div>
        <div class="har-section"><h3>World timeline</h3><p>${events.length ? events.slice(-8).reverse().map((event) => `<span class="har-event-line"><b>${escapeHtml(event.title)}</b> · ${escapeHtml(event.detail)}</span>`).join("") : "Chưa có thay đổi thế giới."}</p></div>
        <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="scan-codex">Quét khu vực hiện tại</button></div>
      `;
    }

    renderMapPanel() {
      return `
        <div class="har-section">
          <h3>Astral Open World</h3>
          <p>Chỉ các cổng đã kích hoạt mới có thể dịch chuyển. Vị trí và checkpoint được lưu thật trong tiến trình.</p>
        </div>
        <ul class="har-list">
          ${ZONES.map((zone) => {
            const storyUnlocked = this.isStoryChapterUnlocked(zone.id);
            const unlocked = Boolean(this.state.checkpoints[zone.id]) && storyUnlocked;
            const current = this.currentZone.id === zone.id;
            return `<li class="har-list-item ${current ? "is-active" : ""}">
              <div><strong style="color:${zone.color}">${escapeHtml(zone.name)}</strong><span>${escapeHtml(zone.description)}</span><small>${escapeHtml(zone.weather)} · ${!storyUnlocked ? `Khóa bởi Chương ${this.cinematicById(zone.id).chapter - 1}` : unlocked ? "Cổng đã kích hoạt" : "Chưa khám phá cổng"}</small></div>
              <div class="har-list-item__actions"><button class="har-chip ${unlocked ? "is-active" : ""}" type="button" data-panel-action="teleport" data-zone="${zone.id}" ${unlocked ? "" : "disabled"}>${current ? "Hiện tại" : "Dịch chuyển"}</button></div>
            </li>`;
          }).join("")}
          <li class="har-list-item ${this.currentZone.id === "dungeon" ? "is-active" : ""}">
            <div><strong style="color:#ff78d2">Nexus Depths</strong><span>Bí cảnh chiến đấu nằm sau cổng Void Garden.</span><small>${this.state.checkpoints.void ? "Vào bằng cổng Bí cảnh" : "Cần mở cổng Void"}</small></div>
            <span class="har-chip">Dungeon</span>
          </li>
        </ul>`;
    }

    renderQuestPanel() {
      return `<ul class="har-list">${QUESTS.map((quest, index) => {
        const status = this.state.quests[quest.id];
        const labels = { locked: "Chưa mở", active: "Đang theo dõi", completed: "Hoàn thành" };
        return `<li class="har-list-item ${status.status === "active" ? "is-active" : ""}">
          <div><strong>${String(index + 1).padStart(2, "0")} · ${escapeHtml(quest.title)}</strong><span>${escapeHtml(quest.description)}</span><small>${labels[status.status]} · ${status.progress}/${quest.target}${status.completedAt ? ` · ${new Date(status.completedAt).toLocaleString("vi-VN")}` : ""}</small>
          ${status.status !== "locked" ? `<div class="har-progress-row"><div class="har-meter har-meter--xp"><i style="--value:${(status.progress / quest.target) * 100}%"></i></div><output>${Math.round((status.progress / quest.target) * 100)}%</output></div>` : ""}</div>
          <span class="har-chip ${status.status === "completed" ? "is-active" : ""}">${labels[status.status]}</span>
        </li>`;
      }).join("")}</ul>`;
    }

    renderInventoryPanel() {
      const filter = this.inventoryFilter || "all";
      const sort = this.inventorySort || "recent";
      let entries = Object.entries(this.state.inventory).filter(([, record]) => Number(record.quantity || 0) > 0);
      if (filter !== "all") entries = entries.filter(([id]) => ITEMS[id]?.type === filter);
      entries.sort((left, right) => {
        if (sort === "name") return ITEMS[left[0]].name.localeCompare(ITEMS[right[0]].name, "vi");
        if (sort === "quantity") return Number(right[1].quantity) - Number(left[1].quantity);
        return new Date(right[1].acquiredAt || 0) - new Date(left[1].acquiredAt || 0);
      });
      return `
        <div class="har-form-row">
          <label class="har-field">Loại<select data-inventory-filter><option value="all">Tất cả</option><option value="weapon">Vũ khí</option><option value="material">Nguyên liệu</option><option value="consumable">Tiêu hao</option></select></label>
          <label class="har-field">Sắp xếp<select data-inventory-sort><option value="recent">Mới nhận</option><option value="name">Tên</option><option value="quantity">Số lượng</option></select></label>
        </div>
        <div class="har-section" style="margin-top:10px"><p>${entries.length ? `${entries.length} loại vật phẩm đang sở hữu.` : "Chưa có vật phẩm phù hợp bộ lọc."}</p></div>
        <ul class="har-list">${entries.map(([id, record]) => {
          const item = ITEMS[id];
          const equipped = this.state.player.weapon === id;
          return `<li class="har-list-item ${equipped ? "is-active" : ""}">
            <div><strong>${record.favorite ? "★ " : ""}${escapeHtml(item.name)} ×${record.quantity}</strong><span>${escapeHtml(item.description)}</span><small>${escapeHtml(item.rarity)} · ${escapeHtml(item.type)}${record.lastSource ? ` · ${escapeHtml(record.lastSource)}` : ""}</small></div>
            <div class="har-list-item__actions">
              <button class="har-chip" type="button" data-panel-action="favorite" data-item="${id}" aria-label="Yêu thích">${record.favorite ? "★" : "☆"}</button>
              <button class="har-chip" type="button" data-panel-action="lock-item" data-item="${id}" aria-label="Khóa">${record.locked ? "Khóa" : "Mở"}</button>
              ${item.type === "weapon" ? `<button class="har-chip ${equipped ? "is-active" : ""}" type="button" data-panel-action="equip" data-item="${id}">${equipped ? "Đang dùng" : "Trang bị"}</button>` : ""}
              ${item.type === "consumable" ? `<button class="har-chip is-active" type="button" data-panel-action="use" data-item="${id}">Dùng</button>` : ""}
            </div>
          </li>`;
        }).join("")}</ul>
        <div class="har-inline-actions"><button class="har-secondary-button" type="button" data-panel-action="open-craft">Mở chế tạo</button></div>`;
    }

    renderCraftPanel() {
      return `
        <div class="har-section"><h3>Chế tạo kiểm tra nguyên liệu thật</h3><p>Vật phẩm chỉ được thêm vào kho sau khi đã trừ đủ nguyên liệu. Toàn bộ thay đổi có autosave.</p></div>
        <ul class="har-list">${RECIPES.map((recipe) => {
          const requirements = Object.entries(recipe.requires);
          const ready = requirements.every(([id, amount]) => Number(this.state.inventory[id]?.quantity || 0) >= amount);
          return `<li class="har-list-item ${ready ? "is-active" : ""}">
            <div><strong>${escapeHtml(recipe.name)}</strong><span>${requirements.map(([id, amount]) => `${ITEMS[id].name} ${this.state.inventory[id]?.quantity || 0}/${amount}`).join(" · ")}</span><small>Kết quả: ${recipe.amount} × ${ITEMS[recipe.result].name}</small></div>
            <button class="har-chip ${ready ? "is-active" : ""}" type="button" data-panel-action="craft" data-recipe="${recipe.id}" ${ready ? "" : "disabled"}>${ready ? "Chế tạo" : "Thiếu vật liệu"}</button>
          </li>`;
        }).join("")}</ul>`;
    }

    renderSkillsPanel() {
      const skills = [
        ["plasmaDrive", "Astral Drive", "Tăng 9 sát thương kỹ năng mỗi cấp.", 3],
        ["astralGuard", "Astral Guard", "Giảm 8% sát thương nhận vào mỗi cấp.", 3],
        ["staminaCore", "Stamina Core", "Tăng 10 stamina tối đa mỗi cấp.", 4]
      ];
      const characterId = this.state.roster.activeId;
      const loadout = this.state.loadouts?.[characterId] || { role: "damage", weapon: "starter-blade", core: "none", relics: [] };
      const weapons = Object.entries(this.state.inventory).filter(([id, record]) => ITEMS[id]?.type === "weapon" && Number(record.quantity || 0) > 0);
      const materials = Object.entries(this.state.inventory).filter(([id, record]) => ITEMS[id]?.type === "material" && Number(record.quantity || 0) > 0);
      return `
        <div class="har-section"><h3>${this.state.player.skillPoints} điểm kỹ năng khả dụng</h3><p>Điểm nhận khi thăng cấp. Nâng cấp tác động trực tiếp vào chiến đấu và được lưu cùng nhân vật.</p></div>
        <div class="har-section"><h3>Build ${escapeHtml(CHARACTERS[characterId]?.name || characterId)}</h3><p>Loadout được lưu theo nhân vật; collider và chỉ số cơ bản vẫn do game/server kiểm soát.</p>
          <div class="har-form-row">
            <label class="har-field">Vai trò<select data-loadout-setting="role"><option value="damage" ${loadout.role === "damage" ? "selected" : ""}>Damage</option><option value="support" ${loadout.role === "support" ? "selected" : ""}>Support</option><option value="control" ${loadout.role === "control" ? "selected" : ""}>Control</option><option value="exploration" ${loadout.role === "exploration" ? "selected" : ""}>Exploration</option></select></label>
            <label class="har-field">Vũ khí<select data-loadout-setting="weapon">${weapons.map(([id]) => `<option value="${id}" ${loadout.weapon === id ? "selected" : ""}>${escapeHtml(ITEMS[id].name)}</option>`).join("") || "<option value=\"\">Chưa có vũ khí</option>"}</select></label>
            <label class="har-field">Astral Core<select data-loadout-setting="core"><option value="none">Không trang bị</option>${materials.map(([id]) => `<option value="${id}" ${loadout.core === id ? "selected" : ""}>${escapeHtml(ITEMS[id].name)}</option>`).join("")}</select></label>
          </div>
          <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="save-loadout">Lưu loadout</button></div>
        </div>
        <ul class="har-list">${skills.map(([id, name, description, max]) => {
          const level = Number(this.state.skills[id] || 0);
          const canUpgrade = this.state.player.skillPoints > 0 && level < max;
          return `<li class="har-list-item ${level ? "is-active" : ""}">
            <div><strong>${name} · ${level}/${max}</strong><span>${description}</span><div class="har-progress-row"><div class="har-meter har-meter--xp"><i style="--value:${(level / max) * 100}%"></i></div><output>Lv.${level}</output></div></div>
            <button class="har-chip ${canUpgrade ? "is-active" : ""}" type="button" data-panel-action="upgrade-skill" data-skill="${id}" ${canUpgrade ? "" : "disabled"}>${level >= max ? "Tối đa" : "+ Nâng"}</button>
          </li>`;
        }).join("")}</ul>`;
    }

    renderPartyPanel() {
      const connected = Boolean(this.socket?.connected);
      const members = this.state.party.members || [];
      const roomCode = this.state.party.roomCode || "";
      const capacity = clamp(this.room?.maxPlayers || this.state.party.capacity || 4, 2, COOP_PLAYER_LIMIT);
      const statusCopy = !navigator.onLine
        ? "Thiết bị đang ngoại tuyến. Game tiếp tục chạy bằng mô phỏng local."
        : this.state.party.status === "reconnecting"
          ? "Đang kết nối lại shard miễn phí. Không hiển thị người chơi giả."
        : !connected
          ? "Realtime server chưa kết nối. Không hiển thị người chơi hoặc phòng giả."
          : roomCode
            ? `${members.length || 1}/${capacity} người · ${this.state.party.integrity === "server-authoritative" ? "chiến đấu do server xác nhận" : "đang chờ snapshot server"}`
            : "Máy chủ sẵn sàng. Tạo phòng co-op 4 người hoặc world event 8 người.";
      return `
        <div class="har-section"><h3>${roomCode ? `Phòng ${escapeHtml(roomCode)}` : "Co-op thử nghiệm"}</h3><p>${escapeHtml(statusCopy)}</p></div>
        ${roomCode ? `
          <ul class="har-list">${members.length ? members.map((member) => `<li class="har-list-item"><div><strong>${escapeHtml(member.user?.name || member.name || "Nhà du hành")}</strong><span>${escapeHtml(member.role || "player")} · ${member.ready ? "Sẵn sàng" : "Trong phòng"}</span></div><span class="har-chip ${member.ready ? "is-active" : ""}">${member.ready ? "Ready" : "Online"}</span></li>`).join("") : '<li class="har-list-item"><div><strong>Bạn đang ở trong phòng</strong><span>Đang chờ dữ liệu presence từ máy chủ.</span></div></li>'}</ul>
          <div class="har-form-row"><label class="har-field" style="grid-column:1/-1">Chat tổ đội<input type="text" maxlength="240" data-party-chat placeholder="Nhập tin nhắn thật cho thành viên phòng"></label></div>
          <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="toggle-ready">${this.state.party.ready ? "Hủy sẵn sàng" : "Sẵn sàng"}</button><button class="har-secondary-button" type="button" data-panel-action="send-chat">Gửi</button><button class="har-secondary-button" type="button" data-panel-action="leave-party">Rời phòng</button></div>
          <div class="har-section" style="margin-top:10px"><h3>Hoạt động phòng</h3><p>${(this.partyMessages || []).length ? (this.partyMessages || []).slice(-6).map((message) => `${escapeHtml(message.user?.name || "HH")}: ${escapeHtml(message.body)}`).join("<br>") : "Chưa có tin nhắn."}</p></div>
        ` : `
          <div class="har-form-row"><label class="har-field" style="grid-column:1/-1">Quy mô shard<select data-party-capacity><option value="4" ${capacity === 4 ? "selected" : ""}>Expedition · 4 người</option><option value="8" ${capacity === 8 ? "selected" : ""}>World Event · 8 người</option></select></label></div>
          <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="match-party" ${connected ? "" : "disabled"}>Ghép nhanh</button><button class="har-secondary-button" type="button" data-panel-action="create-party" ${connected ? "" : "disabled"}>Tạo shard ${capacity} người</button></div>
          <div class="har-form-row"><label class="har-field" style="grid-column:1/-1">Mã phòng<input type="text" maxlength="8" data-party-code placeholder="Ví dụ: H7K2Q9"></label></div>
          <div class="har-inline-actions"><button class="har-secondary-button" type="button" data-panel-action="join-party" ${connected ? "" : "disabled"}>Tham gia phòng</button></div>
        `}
        <div class="har-section" style="margin-top:10px"><p>Shard 4–8 người xác nhận vị trí, tốc độ, nhịp tấn công, HP quái, sát thương và world event trên server. Mức 20–40 người chỉ mở sau khi Redis/PostgreSQL persistence và matchmaking bền vững được cấu hình.</p></div>`;
    }

    refreshCharacterMaterials() {
      const replaceMesh = (oldMesh, profile, scale, metadata = {}) => {
        const parent = oldMesh.parent || this.world;
        const oldRuntime = oldMesh.userData?.characterRuntime;
        const next = this.createPhotorealCharacterModel(profile, scale);
        next.position.copy(oldMesh.position);
        next.rotation.copy(oldMesh.rotation);
        next.visible = oldMesh.visible;
        next.userData = { ...oldMesh.userData, ...next.userData, characterId: profile.id, renderStyle: this.state.settings.renderStyle, ...metadata };
        if (!metadata.remote) {
          const weapon = this.createPlayerWeapon(profile);
          next.userData.parts.weaponAnchor.add(weapon);
          next.userData.lodVariants.attachments = [weapon];
          weapon.visible = next.userData.modelTier !== "impostor";
          next.userData.weapon = weapon;
        }
        parent.add(next);
        parent.remove(oldMesh);
        this.disposeCharacterObject(oldMesh, oldRuntime);
        return next;
      };
      this.characterMeshes.forEach((mesh, id) => {
        const profile = CHARACTERS[id];
        if (profile) {
          if (mesh.userData.visualMode === "gltf-imported") {
            mesh.userData.modelTier = "";
            this.updateCharacterLod(mesh, id === this.state.roster.activeId ? 0 : 4);
            return;
          }
          const next = replaceMesh(mesh, profile, 1);
          this.characterMeshes.set(id, next);
          this.registerCharacterRuntime(next, profile, id, "hero", next.userData.builtInAnimations || []);
          this.characterAssetStatus.set(id, next.userData.visualMode === "photoreal-atlas" ? "HH Photoreal Atlas V2" : "HH Articulated PBR");
        }
      });
      this.remotePlayers.forEach((mesh, id) => {
        const profile = CHARACTERS[mesh.userData.characterId] || CHARACTERS.lyra;
        const next = replaceMesh(mesh, profile, 0.92, { remote: true, id });
        this.remotePlayers.set(id, next);
        this.registerCharacterRuntime(next, profile, `remote:${id}`, "remote", next.userData.builtInAnimations || []);
      });
      this.playerMesh = this.characterMeshes.get(this.state.roster.activeId) || this.characterMeshes.get("lyra");
      this.playerWeapon = this.playerMesh?.userData.weapon || null;
      this.toast(`Đã áp dụng phong cách ${this.state.settings.renderStyle === "anime" ? "Anime Toon" : this.state.settings.renderStyle === "cinematic" ? "Cinematic PBR" : "Realistic PBR"}.`, "success");
    }

    async reloadCharacterPipeline() {
      if (this.characterImporting || !this.GLTFLoaderClass || !this.cloneSkinnedCharacter) {
        this.toast("Character pipeline chưa sẵn sàng; đang dùng fallback an toàn.", "info");
        return;
      }
      this.characterImporting = true;
      try {
        await this.loadCharacterAssetsFromPipeline();
        this.refreshCharacterMaterials();
        this.toast("Đã áp dụng nguồn GLB theo pipeline web; recipe ngoại hình vẫn được giữ riêng.", "success");
      } catch {
        this.toast("Không tải được nguồn GLB tùy chọn; đã giữ asset hiện tại.", "error");
      } finally {
        this.characterImporting = false;
      }
    }

    recordAppearanceChange(beforeRecipe) {
      const id = this.state.roster.activeId;
      const after = appearanceFingerprint(this.activeAppearanceRecipe(), id);
      if (appearanceFingerprint(beforeRecipe, id) === after) return;
      this.appearanceHistory.push(normalizeAppearanceRecipe(beforeRecipe, id));
      this.appearanceHistory = this.appearanceHistory.slice(-30);
      this.appearanceFuture = [];
      this.appearanceDirty = true;
      this.state.appearance.lastSavedAt = nowIso();
      this.saveProgress("Cập nhật ngoại hình");
    }

    updateAppearanceDraft(key, value) {
      const id = this.state.roster.activeId;
      const recipe = this.activeAppearanceRecipe();
      if (!this.appearanceInputStart) this.appearanceInputStart = clone(recipe);
      if (key in recipe.morphs) recipe.morphs[key] = clamp(value, 0, 1);
      else if (["symmetry", "advanced"].includes(key)) recipe[key] = Boolean(value);
      else if (key === "outfitPrimary" && APPEARANCE_ASSETS.outfits.includes(value)) {
        recipe.outfit = [value, ...recipe.outfit.filter((id) => id !== value)].slice(0, 4);
      } else if (["baseModel", "sourceProvider", "bodyPreset", "style", "skinColor", "eyeColor", "hairColor", "hair", "beard", "brow", "makeup", "accessory", "lighting", "expression", "viseme"].includes(key)) recipe[key] = value;
      recipe.updatedAt = nowIso();
      this.applyAppearanceToMesh(this.characterMeshes.get(id), recipe, id);
      this.appearanceDirty = true;
    }

    updateAppearanceDetail(section, key, value) {
      const id = this.state.roster.activeId;
      const recipe = this.activeAppearanceRecipe();
      if (!recipe[section] || !(key in recipe[section])) return;
      if (!this.appearanceInputStart) this.appearanceInputStart = clone(recipe);
      recipe[section][key] = clamp(value, 0, 1);
      recipe.updatedAt = nowIso();
      this.applyAppearanceToMesh(this.characterMeshes.get(id), recipe, id);
      this.appearanceDirty = true;
    }

    commitAppearanceDraft() {
      if (!this.appearanceInputStart) return;
      const before = this.appearanceInputStart;
      this.appearanceInputStart = null;
      this.recordAppearanceChange(before);
    }

    applyAppearancePreset(presetId) {
      const preset = APPEARANCE_PRESETS[presetId];
      if (!preset) return;
      const before = clone(this.activeAppearanceRecipe());
      const recipe = this.activeAppearanceRecipe();
      recipe.bodyPreset = presetId;
      Object.entries(preset.morphs).forEach(([id, value]) => {
        if (id in recipe.morphs) recipe.morphs[id] = value;
      });
      recipe.updatedAt = nowIso();
      this.applyAppearanceToMesh(this.characterMeshes.get(this.state.roster.activeId), recipe, this.state.roster.activeId);
      this.recordAppearanceChange(before);
      this.renderCurrentPanel();
    }

    randomAppearance() {
      const before = clone(this.activeAppearanceRecipe());
      const recipe = this.activeAppearanceRecipe();
      const seed = Math.floor(Math.random() * 0xffffff);
      this.appearanceSeed = seed;
      Object.values(APPEARANCE_CONTROL_MAP).forEach((control, index) => {
        if (control.group === "expression") return;
        const wave = Math.sin(seed * 0.001 + index * 1.73) * 0.5 + 0.5;
        recipe.morphs[control.id] = Number((0.28 + wave * 0.44).toFixed(3));
      });
      recipe.bodyPreset = "balanced";
      recipe.updatedAt = nowIso();
      this.applyAppearanceToMesh(this.characterMeshes.get(this.state.roster.activeId), recipe, this.state.roster.activeId);
      this.recordAppearanceChange(before);
      this.toast("Đã tạo ngoại hình ngẫu nhiên có kiểm soát.", "success");
      this.renderCurrentPanel();
    }

    resetAppearance() {
      const before = clone(this.activeAppearanceRecipe());
      const id = this.state.roster.activeId;
      this.state.appearance.recipes[id] = defaultAppearanceRecipe(id);
      this.applyAppearanceToMesh(this.characterMeshes.get(id), this.state.appearance.recipes[id], id);
      if (before.baseModel !== this.state.appearance.recipes[id].baseModel) this.rebuildActiveBuiltInCharacter();
      this.recordAppearanceChange(before);
      this.renderCurrentPanel();
    }

    undoAppearance() {
      const id = this.state.roster.activeId;
      const previous = this.appearanceHistory.pop();
      if (!previous) return;
      this.appearanceFuture.push(clone(this.activeAppearanceRecipe()));
      this.state.appearance.recipes[id] = normalizeAppearanceRecipe(previous, id);
      this.applyAppearanceToMesh(this.characterMeshes.get(id), this.state.appearance.recipes[id], id);
      if (this.appearanceFuture.at(-1)?.baseModel !== this.state.appearance.recipes[id].baseModel) this.rebuildActiveBuiltInCharacter();
      this.appearanceDirty = true;
      this.saveProgress("Hoàn tác ngoại hình");
      this.renderCurrentPanel();
    }

    redoAppearance() {
      const id = this.state.roster.activeId;
      const next = this.appearanceFuture.pop();
      if (!next) return;
      this.appearanceHistory.push(clone(this.activeAppearanceRecipe()));
      this.state.appearance.recipes[id] = normalizeAppearanceRecipe(next, id);
      this.applyAppearanceToMesh(this.characterMeshes.get(id), this.state.appearance.recipes[id], id);
      if (this.appearanceHistory.at(-1)?.baseModel !== this.state.appearance.recipes[id].baseModel) this.rebuildActiveBuiltInCharacter();
      this.appearanceDirty = true;
      this.saveProgress("Làm lại ngoại hình");
      this.renderCurrentPanel();
    }

    saveAppearancePreset(name = "") {
      const id = this.state.roster.activeId;
      const recipe = clone(this.activeAppearanceRecipe());
      const preset = {
        id: uid("look"),
        name: String(name || `${CHARACTERS[id]?.name || "Nhân vật"} · ${this.state.appearance.savedPresets.length + 1}`).slice(0, 40),
        characterId: id,
        recipe,
        createdAt: nowIso()
      };
      this.state.appearance.savedPresets = [...(this.state.appearance.savedPresets || []), preset].slice(-12);
      this.state.appearance.lastSavedAt = nowIso();
      this.saveProgress("Lưu preset ngoại hình");
      this.toast(`Đã lưu preset “${preset.name}”.`, "success");
      this.renderCurrentPanel();
    }

    loadAppearancePreset(presetId) {
      const preset = (this.state.appearance.savedPresets || []).find((item) => item.id === presetId);
      if (!preset) return;
      const before = clone(this.activeAppearanceRecipe());
      const id = this.state.roster.activeId;
      this.state.appearance.recipes[id] = normalizeAppearanceRecipe(preset.recipe, id);
      this.applyAppearanceToMesh(this.characterMeshes.get(id), this.state.appearance.recipes[id], id);
      if (before.baseModel !== this.state.appearance.recipes[id].baseModel) this.rebuildActiveBuiltInCharacter();
      this.recordAppearanceChange(before);
      this.renderCurrentPanel();
    }

    renderSettingsPanel() {
      const record = this.savedRecord;
      const histories = record?.history || [];
      return `
        <div class="har-section"><h3>Đồ họa và điều khiển</h3><p>Chế độ Auto tự giảm độ phân giải, sao và thời tiết nếu FPS thấp.</p>
          <div class="har-form-row">
            <label class="har-field">Chất lượng<select data-setting="quality"><option value="auto">Tự động theo FPS</option><option value="low">Tiết kiệm</option><option value="medium">Vừa</option><option value="high">Cao</option><option value="cinematic">Điện ảnh</option></select></label>
            <label class="har-field">Renderer<select data-setting="rendererMode"><option value="auto">Auto ổn định · WebGL2</option><option value="webgpu">WebGPU thử nghiệm</option><option value="webgl">WebGL2 bắt buộc</option></select></label>
            <label class="har-field">Model hiển thị<select data-setting="visualStyle"><option value="photoreal">Human Rig + Mesh World PBR</option><option value="hybrid">PBR 3D nhẹ · tùy biến</option><option value="performance">3D hiệu năng</option></select></label>
            <label class="har-field">Character runtime<select data-setting="characterMode"><option value="rigged">Human Rig 3D · Character V${CHARACTER_VISUAL_VERSION}</option><option value="portrait">Proxy 3D PBR · máy yếu</option></select></label>
            <label class="har-field">Character LOD<select data-setting="characterQuality"><option value="adaptive">Thích ứng theo khoảng cách</option><option value="hero">Khóa Hero LOD0</option><option value="near">Khóa LOD1</option><option value="crowd">Khóa LOD2</option></select></label>
            <label class="har-field">Khuôn mặt<select data-setting="facialAnimation"><option value="true">Chớp mắt, cảm xúc và lip-sync</option><option value="false">Tắt facial animation</option></select></label>
            <label class="har-field">Mắt tự nhiên<select data-setting="eyePerformance"><option value="true">Mí mắt, đồng tử và micro-saccade</option><option value="false">Mắt tĩnh</option></select></label>
            <label class="har-field">Chuyển động tự nhiên<select data-setting="naturalMotion"><option value="true">Analog gait · yaw smoothing</option><option value="false">Chuyển động cơ bản</option></select></label>
            <label class="har-field">Digital Human<select data-setting="digitalHumanQuality"><option value="adaptive">Tự động theo FPS</option><option value="performance">Hiệu năng</option><option value="quality">Chất lượng</option><option value="cinematic">Điện ảnh</option></select></label>
            <label class="har-field">Tóc & vải động<select data-setting="secondaryMotion"><option value="true">Spring bone nhẹ</option><option value="false">Tắt secondary motion</option></select></label>
            <label class="har-field">Chi tiết vi mô<select data-setting="microDetail"><option value="true">Da normal/roughness · hair cards</option><option value="false">Vật liệu nhẹ</option></select></label>
            <label class="har-field">Da & trang phục<select data-setting="surfaceFx"><option value="true">Wetness, tuyết và nhiệt</option><option value="false">Vật liệu cố định</option></select></label>
            <label class="har-field">Kết xuất 3D<select data-setting="renderStyle"><option value="realistic">Realistic PBR</option><option value="cinematic">Cinematic PBR</option><option value="anime">Anime Toon</option></select></label>
            <label class="har-field">Mức VFX<select data-setting="vfxLevel"><option value="static">Tĩnh · nhẹ nhất</option><option value="balanced">Cân bằng</option><option value="cinematic">Điện ảnh</option></select></label>
            <label class="har-field">Thế giới sống<select data-setting="livingWorld"><option value="true">Bật NPC, sinh vật và giao thông</option><option value="false">Tắt để tăng FPS</option></select></label>
            <label class="har-field">Dynamic resolution<select data-setting="dynamicResolution"><option value="true">Bật theo FPS</option><option value="false">Khóa độ phân giải</option></select></label>
            <label class="har-field">Âm lượng<input type="range" min="0" max="100" value="${this.state.settings.volume}" data-setting="volume"></label>
            <label class="har-field">Độ nhạy camera<input type="range" min="10" max="100" value="${this.state.settings.cameraSensitivity}" data-setting="cameraSensitivity"></label>
            <label class="har-field">Rung camera<input type="range" min="0" max="100" value="${this.state.settings.cameraShake}" data-setting="cameraShake"></label>
            <label class="har-field">Mật độ thời tiết<input type="range" min="0" max="100" value="${this.state.settings.weatherDensity}" data-setting="weatherDensity"></label>
            <label class="har-field">Hiệu ứng<select data-setting="reduceEffects"><option value="false">Đầy đủ</option><option value="true">Giảm chuyển động</option></select></label>
          </div>
        </div>
        <div class="har-section"><h3>Điều khiển</h3><p>WASD di chuyển · Shift chạy · Space nhảy/lượn · F đánh · Q né · E kỹ năng · R tuyệt kỹ · G/T tương tác · Tab khóa mục tiêu · chuột phải xoay camera.</p></div>
        <div class="har-section"><h3>Lưu tiến trình</h3><p>${record ? `Local v${record.version} · ${new Date(record.updatedAt).toLocaleString("vi-VN")} · ${this.state.cloud.status}` : "Chưa có bản lưu."}</p>
          <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="manual-save">Lưu checkpoint</button><button class="har-secondary-button" type="button" data-panel-action="sync-cloud">Đồng bộ tài khoản</button></div>
        </div>
        <ul class="har-list">${histories.length ? histories.slice().reverse().map((history) => `<li class="har-list-item"><div><strong>Phiên bản ${history.version}</strong><span>${escapeHtml(history.label || "Autosave")} · ${new Date(history.updatedAt).toLocaleString("vi-VN")}</span></div><button class="har-chip" type="button" data-panel-action="restore-save" data-version="${history.version}">Khôi phục</button></li>`).join("") : '<li class="har-list-item"><div><strong>Chưa có lịch sử</strong><span>Ba phiên bản gần nhất sẽ xuất hiện tại đây.</span></div></li>'}</ul>
        ${this.cloudConflict ? `<div class="har-section"><h3>Xung đột cloud save</h3><p>Cloud v${this.cloudConflict.version} mới hơn bản local. Chọn bản muốn giữ.</p><div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="use-cloud">Dùng bản cloud</button><button class="har-secondary-button" type="button" data-panel-action="keep-local">Giữ bản local</button></div></div>` : ""}`;
    }

    renderPausePanel() {
      return `<div class="har-section"><h3>HH Astral Realms đang tạm dừng</h3><p>Thời gian chơi và AI cục bộ không tiếp tục khi tạm dừng hoặc tab bị ẩn.</p></div>
        <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="resume">Tiếp tục</button><button class="har-secondary-button" type="button" data-panel-action="open-inventory">Kho đồ</button><button class="har-secondary-button" type="button" data-panel-action="open-settings">Thiết lập</button><button class="har-secondary-button" type="button" data-panel-action="exit-game">Về Game Center</button></div>`;
    }

    renderDefeatedPanel() {
      return `<div class="har-section"><h3>Nhân vật đã bị đánh bại</h3><p>Không mất vật phẩm. Bạn có thể hồi sinh tại checkpoint ${escapeHtml(ZONES.find((zone) => zone.id === this.state.player.checkpoint)?.name || "H-Central")}.</p></div>
        <div class="har-inline-actions"><button class="har-primary-button" type="button" data-panel-action="revive">Hồi sinh</button><button class="har-secondary-button" type="button" data-panel-action="restore-last">Khôi phục bản lưu</button></div>`;
    }

    bindPanelControls() {
      const body = this.root.querySelector("[data-har-panel-body]");
      body.onclick = (event) => {
        const groupButton = event.target.closest("[data-appearance-group]");
        if (groupButton) {
          this.appearanceGroup = groupButton.dataset.appearanceGroup || "face";
          const group = APPEARANCE_GROUPS.find((item) => item.id === this.appearanceGroup);
          this.appearanceFocus = group?.focus || "";
          this.renderCurrentPanel();
          return;
        }
        const button = event.target.closest("[data-panel-action]");
        if (!button || button.disabled) return;
        event.stopPropagation();
        this.handlePanelAction(button.dataset.panelAction, button.dataset);
      };
      body.oninput = (event) => {
        const morph = event.target.closest("[data-appearance-morph]");
        const setting = event.target.closest("[data-appearance-setting]");
        const detail = event.target.closest("[data-appearance-detail]");
        if (morph) {
          const value = Number(morph.value);
          this.updateAppearanceDraft(morph.dataset.appearanceMorph, value);
          const output = body.querySelector(`[data-appearance-output="${morph.dataset.appearanceMorph}"]`);
          if (output) output.textContent = String(Math.round(value * 100));
        } else if (detail) {
          const value = Number(detail.value);
          const section = detail.dataset.appearanceDetail;
          const key = detail.dataset.detailKey;
          this.updateAppearanceDetail(section, key, value);
          const output = body.querySelector(`[data-appearance-detail-output="${section}:${key}"]`);
          if (output) output.textContent = String(Math.round(value * 100));
        } else if (setting && ["color", "range"].includes(setting.type)) {
          this.updateAppearanceDraft(setting.dataset.appearanceSetting, setting.value);
        }
      };
      body.onchange = (event) => {
        if (event.target.matches("[data-character-glb]")) {
          const file = event.target.files?.[0];
          if (file) this.importCharacterGLB(file);
          event.target.value = "";
        } else if (event.target.matches("[data-inventory-filter]")) {
          this.inventoryFilter = event.target.value;
          this.renderCurrentPanel();
        } else if (event.target.matches("[data-inventory-sort]")) {
          this.inventorySort = event.target.value;
          this.renderCurrentPanel();
        } else if (event.target.matches("[data-appearance-morph]")) {
          this.commitAppearanceDraft();
          this.renderCurrentPanel();
        } else if (event.target.matches("[data-appearance-detail]")) {
          this.commitAppearanceDraft();
          this.renderCurrentPanel();
        } else if (event.target.matches("[data-appearance-setting]")) {
          const setting = event.target.dataset.appearanceSetting;
          const value = setting === "symmetry" || setting === "advanced" ? event.target.checked : event.target.value;
          if (setting === "bodyPreset") {
            this.applyAppearancePreset(value);
          } else {
            this.updateAppearanceDraft(setting, value);
            this.commitAppearanceDraft();
            if (setting === "baseModel" || setting === "sourceProvider") this.reloadCharacterPipeline();
            this.renderCurrentPanel();
          }
        } else if (event.target.matches("[data-ship-name]")) {
          const name = String(event.target.value || "").trim().slice(0, 32);
          if (name) {
            this.state.ship.name = name;
            this.recordWorldEvent({ type: "ship", title: "Đổi tên Personal Ship", detail: `Tàu hiện mang tên ${name}.`, zoneId: "central" });
            this.saveProgress("Đổi tên tàu");
          }
        } else if (event.target.matches("[data-loadout-setting]")) {
          const characterId = this.state.roster.activeId;
          this.state.loadouts[characterId] ||= { role: "damage", weapon: "starter-blade", core: "none", relics: [], updatedAt: nowIso() };
          const key = event.target.dataset.loadoutSetting;
          if (["role", "weapon", "core"].includes(key)) this.state.loadouts[characterId][key] = event.target.value;
          this.state.loadouts[characterId].updatedAt = nowIso();
        } else if (event.target.matches("[data-party-capacity]")) {
          this.state.party.capacity = Number(event.target.value) === 8 ? 8 : 4;
          this.renderCurrentPanel();
        } else if (event.target.matches("[data-setting]")) {
          const key = event.target.dataset.setting;
          let value = event.target.value;
          if (["reduceEffects", "dynamicResolution", "postFx", "livingWorld", "facialAnimation", "surfaceFx", "microDetail", "naturalMotion", "eyePerformance", "secondaryMotion"].includes(key)) value = value === "true";
          if (["volume", "cameraSensitivity", "cameraShake", "weatherDensity"].includes(key)) value = Number(value);
          this.state.settings[key] = value;
          if (key === "quality") {
            this.root.dataset.quality = value;
            if (this.renderer.shadowMap) this.renderer.shadowMap.enabled = value !== "low";
            this.resize();
          }
          if (key === "weatherDensity") this.updateWeatherAppearance();
          if (key === "rendererMode") this.toast("Renderer sẽ áp dụng ở lần mở game kế tiếp.");
          if (key === "renderStyle" || key === "microDetail") this.refreshCharacterMaterials();
          if (key === "facialAnimation" && value === false) {
            this.characterMeshes.forEach((mesh, id) => {
              this.resetCharacterFace(mesh);
              this.applyAppearanceToMesh(mesh, this.state.appearance?.recipes?.[id] || defaultAppearanceRecipe(id), id);
            });
          }
          if (key === "eyePerformance" && value === false) {
            this.characterMeshes.forEach((mesh) => this.resetCharacterFace(mesh, { morphs: false }));
          }
          if (key === "surfaceFx" && value === false) {
            this.characterMeshes.forEach((mesh) => this.restoreCharacterMaterialState(mesh, 1));
          }
          if (key === "characterMode") {
            this.refreshCharacterMaterials();
            this.toast("Character runtime đã chuyển chế độ.", "success");
          }
          if (key === "characterQuality") this.characterMeshes.forEach((mesh) => { mesh.userData.modelTier = ""; });
          if (key === "digitalHumanQuality") {
            const mappedQuality = { performance: "crowd", quality: "near", cinematic: "hero" }[value] || "adaptive";
            this.state.settings.characterQuality = mappedQuality;
            this.characterMeshes.forEach((mesh) => { mesh.userData.modelTier = ""; });
            this.toast("Digital Human quality đã được áp dụng.", "success");
          }
          if (key === "visualStyle") this.toast("Phong cách nhân vật và cảnh quan sẽ áp dụng ở lần mở game kế tiếp.");
          if (key === "vfxLevel") {
            this.root.dataset.vfx = value;
            this.toast("Mức hiệu ứng đã được cập nhật.", "success");
          }
          if (key === "livingWorld") this.toast("Thế giới sống sẽ áp dụng ở lần mở game kế tiếp.");
          if (key === "dynamicResolution") this.dynamicResolution = value ? this.renderScale : 1;
          if (key === "volume" && this.audioMaster) this.audioMaster.gain.value = value / 100 * 0.15;
          this.saveProgress("Thay đổi thiết lập");
        }
      };
      const setSelect = (selector, value) => {
        const element = body.querySelector(selector);
        if (element) element.value = String(value);
      };
      setSelect("[data-inventory-filter]", this.inventoryFilter || "all");
      setSelect("[data-inventory-sort]", this.inventorySort || "recent");
      setSelect('[data-setting="quality"]', this.state.settings.quality);
      setSelect('[data-setting="rendererMode"]', this.state.settings.rendererMode);
      setSelect('[data-setting="renderStyle"]', this.state.settings.renderStyle);
      setSelect('[data-setting="visualStyle"]', this.state.settings.visualStyle);
      setSelect('[data-setting="characterMode"]', this.state.settings.characterMode);
      setSelect('[data-setting="characterQuality"]', this.state.settings.characterQuality);
      setSelect('[data-setting="facialAnimation"]', this.state.settings.facialAnimation);
      setSelect('[data-setting="eyePerformance"]', this.state.settings.eyePerformance);
      setSelect('[data-setting="naturalMotion"]', this.state.settings.naturalMotion);
      setSelect('[data-setting="digitalHumanQuality"]', this.state.settings.digitalHumanQuality);
      setSelect('[data-setting="secondaryMotion"]', this.state.settings.secondaryMotion);
      setSelect('[data-setting="microDetail"]', this.state.settings.microDetail);
      setSelect('[data-setting="surfaceFx"]', this.state.settings.surfaceFx);
      setSelect('[data-setting="vfxLevel"]', this.state.settings.vfxLevel);
      setSelect('[data-setting="livingWorld"]', this.state.settings.livingWorld);
      setSelect('[data-setting="dynamicResolution"]', this.state.settings.dynamicResolution);
      setSelect('[data-setting="reduceEffects"]', this.state.settings.reduceEffects);
    }

    recordWorldEvent({ type = "system", title, detail, zoneId = this.currentZone?.id || "central", factionId = "" } = {}) {
      const event = {
        id: uid("world-event"),
        type: String(type).slice(0, 32),
        title: String(title || "Astral event").slice(0, 120),
        detail: String(detail || "").slice(0, 240),
        zoneId: String(zoneId || "").slice(0, 24),
        factionId: String(factionId || "").slice(0, 40),
        createdAt: nowIso()
      };
      this.state.world.eventLog = [...(this.state.world.eventLog || []), event].slice(-80);
      this.state.world.lastSyncAt = event.createdAt;
      return event;
    }

    startZoneEvent() {
      if (this.state.world.activeEvent) return this.toast("Đang có một sự kiện thế giới cần xử lý.", "error");
      const zone = this.currentZone;
      const zoneState = this.state.world.zones[zone.id];
      if (!zoneState || zone.id === "central") return this.toast("H-Central đã ổn định; hãy tới một khu vực cần cứu hộ.", "error");
      zoneState.discovered = true;
      zoneState.updatedAt = nowIso();
      this.state.world.activeEvent = {
        id: uid("mission"),
        title: `Giải phóng lõi ${zone.name}`,
        detail: `Đánh bại sinh vật tha hóa và khôi phục mạng năng lượng tại ${zone.name}.`,
        zoneId: zone.id,
        factionId: zoneState.occupation,
        progress: 0,
        target: 3,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      };
      this.emitInput({ worldAction: { type: "start", zoneId: zone.id, factionId: zoneState.occupation, title: this.state.world.activeEvent.title, detail: this.state.world.activeEvent.detail } });
      this.recordWorldEvent({ type: "started", title: this.state.world.activeEvent.title, detail: "Người chơi đã chủ động khởi tạo nhiệm vụ cứu lõi.", zoneId: zone.id, factionId: zoneState.occupation });
      this.toast(`Đã mở nhiệm vụ cứu lõi tại ${zone.name}.`, "success");
      this.saveProgress("Khởi tạo world event");
      this.renderCurrentPanel();
    }

    startFactionEvent(factionId) {
      if (!FACTIONS.some((faction) => faction.id === factionId)) return;
      if (this.state.world.activeEvent) return this.toast("Hãy hoàn thành sự kiện hiện tại trước.", "error");
      const faction = FACTIONS.find((item) => item.id === factionId);
      const zoneId = Object.entries(this.state.world.zones).find(([, zone]) => zone.occupation === factionId && !zone.restored)?.[0] || this.currentZone.id;
      this.state.world.activeEvent = {
        id: uid("faction-mission"),
        title: `Chi viện ${faction.name}`,
        detail: `Hoàn thành hoạt động tại ${ZONES.find((zone) => zone.id === zoneId)?.name || "khu vực hiện tại"} để tăng danh tiếng thật.`,
        zoneId,
        factionId,
        progress: 0,
        target: 2,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      };
      this.emitInput({ worldAction: { type: "start", zoneId, factionId, title: this.state.world.activeEvent.title, detail: this.state.world.activeEvent.detail } });
      this.recordWorldEvent({ type: "faction-start", title: this.state.world.activeEvent.title, detail: "Đã đăng ký hỗ trợ phe phái.", zoneId, factionId });
      this.toast(`Đã nhận nhiệm vụ từ ${faction.name}.`, "success");
      this.saveProgress("Nhận faction mission");
      this.renderCurrentPanel();
    }

    resolveWorldEvent() {
      const event = this.state.world.activeEvent;
      if (!event) return;
      if (Number(event.progress || 0) < Number(event.target || 3)) return this.toast(`Cần hoàn thành ${event.target - event.progress} mục tiêu trước.`, "error");
      const zoneState = this.state.world.zones[event.zoneId];
      const faction = this.state.world.factions[event.factionId];
      if (zoneState) {
        zoneState.discovered = true;
        zoneState.resources = clamp(Number(zoneState.resources || 0) + 20, 0, 100);
        zoneState.restored = true;
        zoneState.core = "restored";
        zoneState.updatedAt = nowIso();
        this.state.checkpoints[event.zoneId] = true;
        this.state.player.checkpoint = event.zoneId;
      }
      if (faction) {
        faction.reputation = clamp(Number(faction.reputation || 0) + 100, -1000, 1000);
        faction.rank = reputationRank(faction.reputation);
        faction.supportedEvents = Number(faction.supportedEvents || 0) + 1;
        faction.updatedAt = nowIso();
      }
      this.refreshWorldStateVisuals();
      this.emitInput({ worldAction: { type: "resolve" } });
      this.state.stats.worldEventsCompleted = Number(this.state.stats.worldEventsCompleted || 0) + 1;
      this.state.world.activeEvent = null;
      this.recordStoryEvent(`restored:${event.zoneId}`);
      this.evaluateStoryProgress({ save: false });
      this.recordWorldEvent({ type: "resolved", title: `Đã phục hồi ${ZONES.find((zone) => zone.id === event.zoneId)?.name || "khu vực"}`, detail: `+100 REP cho ${FACTIONS.find((item) => item.id === event.factionId)?.name || "phe hỗ trợ"}.`, zoneId: event.zoneId, factionId: event.factionId });
      this.grantXp(180);
      this.spawnNova(this.state.player.x, this.state.player.y + 1, this.state.player.z, "#65f1c7");
      this.toast("World state đã thay đổi: lõi được phục hồi và checkpoint đã mở.", "success");
      this.saveProgress("Hoàn thành world event");
      this.renderCurrentPanel();
    }

    abandonWorldEvent() {
      if (!this.state.world.activeEvent) return;
      const event = this.state.world.activeEvent;
      this.state.world.activeEvent = null;
      this.emitInput({ worldAction: { type: "pause" } });
      this.recordWorldEvent({ type: "paused", title: event.title, detail: "Sự kiện được tạm dừng; không thay đổi reputation hoặc phần thưởng.", zoneId: event.zoneId, factionId: event.factionId });
      this.saveProgress("Tạm dừng world event");
      this.renderCurrentPanel();
    }

    bondCompanion(id) {
      if (!CHARACTERS[id]) return;
      const record = this.state.companions[id] || (this.state.companions[id] = { unlocked: id === "lyra", bond: 0, storyStage: 0, lastActivityAt: "" });
      if (record.lastActivityAt && Date.now() - new Date(record.lastActivityAt).getTime() < 60000) return this.toast("Đồng đội cần một phút để hồi phục sau cuộc trò chuyện.", "error");
      record.unlocked = true;
      record.bond = clamp(Number(record.bond || 0) + 1, 0, 10);
      record.storyStage = Math.min(5, Math.floor(record.bond / 2));
      record.lastActivityAt = nowIso();
      this.state.progression.mastery[id].bond += 10;
      this.recordWorldEvent({ type: "companion", title: `Ký ức mở: ${COMPANION_STORIES[id].title}`, detail: `${CHARACTERS[id].name} bond ${record.bond}/10.`, zoneId: this.currentZone.id });
      this.toast(`${CHARACTERS[id].name} đã tin tưởng bạn hơn.`, "success");
      this.saveProgress("Tăng bond đồng đội");
      this.renderCurrentPanel();
    }

    upgradeShipModule(moduleId) {
      const module = SHIP_MODULES[moduleId];
      const level = Number(this.state.ship.modules[moduleId] || 1);
      if (!module || level >= module.max) return;
      if (!this.removeItems(module.cost)) return this.toast("Tàu chưa đủ nguyên liệu để nâng cấp.", "error");
      this.state.ship.modules[moduleId] = level + 1;
      this.state.ship.level = Math.max(this.state.ship.level, Math.ceil(Object.values(this.state.ship.modules).reduce((sum, value) => sum + value, 0) / Object.keys(SHIP_MODULES).length));
      this.recordWorldEvent({ type: "ship", title: `Nâng cấp ${module.name}`, detail: `Horizon H đạt module Lv.${level + 1}.`, zoneId: "central" });
      this.toast(`${module.name} đã nâng lên Lv.${level + 1}.`, "success");
      this.saveProgress("Nâng cấp tàu");
      this.renderCurrentPanel();
    }

    launchExpedition() {
      if (this.state.ship.fuel < 20) return this.toast("Tàu không đủ nhiên liệu.", "error");
      if (this.state.ship.lastExpeditionAt && Date.now() - new Date(this.state.ship.lastExpeditionAt).getTime() < 60000) return this.toast("Expedition trước vẫn đang xử lý.", "error");
      const zone = ZONES.find((item) => item.id !== "central" && this.state.checkpoints[item.id]) || ZONES[0];
      this.state.ship.fuel = clamp(this.state.ship.fuel - 20, 0, 100);
      this.state.ship.lastExpeditionAt = nowIso();
      this.state.stats.expeditions = Number(this.state.stats.expeditions || 0) + 1;
      const rewards = ["aurora-shard", "plasma-core", "void-fiber"];
      const reward = rewards[this.state.stats.expeditions % rewards.length];
      this.addItem(reward, 1, `Expedition ${zone.name}`);
      this.recordWorldEvent({ type: "expedition", title: `Expedition hoàn tất tại ${zone.name}`, detail: `Thu được ${ITEMS[reward].name}.`, zoneId: zone.id });
      this.toast(`Expedition hoàn tất · ${ITEMS[reward].name}.`, "success");
      this.saveProgress("Hoàn tất expedition");
      this.renderCurrentPanel();
    }

    toggleTraining() {
      this.trainingSession = !this.trainingSession;
      this.trainingActive = this.trainingSession;
      if (this.trainingSession) {
        this.teleport(17, -10, "Training Arena");
        this.trainingActive = true;
        this.dpsSamples = [];
        this.toast("Training Arena bắt đầu ghi hit thật.", "success");
        this.openPanel("training");
      } else {
        this.trainingActive = false;
        this.toast("Đã dừng đo Training Arena.");
        this.saveProgress("Kết thúc training");
      }
      this.renderCurrentPanel();
    }

    scanCurrentZone() {
      const zone = this.currentZone;
      const id = `zone:${zone.id}:scan`;
      if (this.state.exploration.scans.includes(id)) return this.toast("Khu vực này đã được quét.");
      this.state.exploration.scans.push(id);
      this.state.exploration.codex.push(zone.id);
      this.state.exploration.mapFog[zone.id] = clamp((this.state.exploration.mapFog[zone.id] || 100) - 25, 0, 100);
      this.state.world.zones[zone.id].discovered = true;
      this.recordWorldEvent({ type: "scan", title: `Đã quét ${zone.name}`, detail: "Entry mới được thêm vào Astral Codex.", zoneId: zone.id });
      const scanReward = ["aurora", "sky", "ocean"].includes(zone.id)
        ? "aurora-shard"
        : ["crimson", "station"].includes(zone.id)
          ? "plasma-core"
          : "void-fiber";
      this.addItem(scanReward, 1, "Scan codex");
      this.saveProgress("Quét codex");
      this.renderCurrentPanel();
    }

    saveLoadout() {
      const id = this.state.roster.activeId;
      const loadout = this.state.loadouts?.[id];
      if (!loadout) return;
      loadout.updatedAt = nowIso();
      this.recordWorldEvent({ type: "loadout", title: `Đã lưu build ${CHARACTERS[id]?.name || id}`, detail: `${loadout.role} · ${ITEMS[loadout.weapon]?.name || "chưa có vũ khí"}.`, zoneId: this.currentZone.id });
      this.saveProgress("Lưu loadout");
      this.toast("Build đã được lưu vào hồ sơ nhân vật.", "success");
      this.renderCurrentPanel();
    }

    async handlePanelAction(action, data) {
      if (action === "teleport") {
        const zone = ZONES.find((item) => item.id === data.zone);
        if (zone && !this.isStoryChapterUnlocked(zone.id)) this.toast("Khu vực cốt truyện này chưa được mở.", "error");
        else if (zone && this.state.checkpoints[zone.id]) this.teleport(zone.x, zone.z + 5, zone.name);
      } else if (action === "favorite") {
        const record = this.state.inventory[data.item];
        if (record) record.favorite = !record.favorite;
        this.renderCurrentPanel();
      } else if (action === "lock-item") {
        const record = this.state.inventory[data.item];
        if (record) record.locked = !record.locked;
        this.renderCurrentPanel();
      } else if (action === "equip") this.equipItem(data.item);
      else if (action === "use") this.useItem(data.item);
      else if (action === "open-craft") this.openPanel("craft");
      else if (action === "start-zone-event") this.startZoneEvent();
      else if (action === "start-faction-event") this.startFactionEvent(data.faction);
      else if (action === "resolve-world-event") this.resolveWorldEvent();
      else if (action === "abandon-world-event") this.abandonWorldEvent();
      else if (action === "bond-companion") this.bondCompanion(data.companion);
      else if (action === "upgrade-ship") this.upgradeShipModule(data.module);
      else if (action === "launch-expedition") this.launchExpedition();
      else if (action === "toggle-training") this.toggleTraining();
      else if (action === "scan-codex") this.scanCurrentZone();
      else if (action === "open-characters") this.openPanel("characters");
      else if (action === "open-skills") this.openPanel("skills");
      else if (action === "save-loadout") this.saveLoadout();
      else if (action === "craft") this.craft(data.recipe);
      else if (action === "upgrade-skill") this.upgradeSkill(data.skill);
      else if (action === "switch-character") this.switchCharacter(data.character);
      else if (action === "open-character-creator") this.openPanel("creator");
      else if (action === "character-preview-motion") {
        const motion = CHARACTER_MOTION_LIBRARY[data.motion] ? data.motion : "idle";
        this.setCharacterAction(motion, ["ultimate", "skill"].includes(motion) ? 1100 : 720, 1);
        this.closePanel();
        this.toast(`Motion preview · ${motion}`, "success");
      }
      else if (action === "toggle-face-pilot") await this.toggleFacePilot();
      else if (action === "character-expression") {
        const recipe = this.activeAppearanceRecipe();
        const before = clone(recipe);
        recipe.expression = CHARACTER_EXPRESSION_PRESETS[data.expression] ? data.expression : "neutral";
        recipe.updatedAt = nowIso();
        this.recordAppearanceChange(before);
        this.setCharacterFacePreview(recipe.expression, recipe.viseme);
        this.renderCurrentPanel();
      }
      else if (action === "character-viseme") {
        const recipe = this.activeAppearanceRecipe();
        const before = clone(recipe);
        recipe.viseme = CHARACTER_VISEMES[data.viseme] ? data.viseme : "neutral";
        recipe.updatedAt = nowIso();
        this.recordAppearanceChange(before);
        this.setCharacterFacePreview(recipe.expression, recipe.viseme);
        this.renderCurrentPanel();
      }
      else if (action === "character-copy-dna") await this.copyCharacterDNA();
      else if (action === "character-apply-dna") this.applyCharacterDNA(bodyValue(this.root, "[data-character-dna]"));
      else if (action === "appearance-undo") this.undoAppearance();
      else if (action === "appearance-redo") this.redoAppearance();
      else if (action === "appearance-random") this.randomAppearance();
      else if (action === "appearance-reset") this.resetAppearance();
      else if (action === "appearance-save") this.saveAppearancePreset(bodyValue(this.root, "[data-appearance-name]"));
      else if (action === "appearance-load-preset") this.loadAppearancePreset(data.presetId);
      else if (action === "manual-save") await this.saveProgress("Checkpoint thủ công");
      else if (action === "sync-cloud") await this.syncCloud(true);
      else if (action === "restore-save") await this.restoreLocalVersion(Number(data.version));
      else if (action === "use-cloud") await this.useCloudConflict();
      else if (action === "keep-local") {
        this.cloudConflict = null;
        await this.syncCloud(true, true);
      } else if (action === "create-party") await this.createParty();
      else if (action === "match-party") await this.matchParty();
      else if (action === "join-party") await this.joinParty(bodyValue(this.root, "[data-party-code]"));
      else if (action === "leave-party") await this.leaveParty();
      else if (action === "send-chat") await this.sendPartyChat(bodyValue(this.root, "[data-party-chat]"));
      else if (action === "toggle-ready") await this.togglePartyReady();
      else if (action === "resume") this.togglePause(false);
      else if (action === "open-inventory") this.openPanel("inventory");
      else if (action === "open-settings") this.openPanel("settings");
      else if (action === "exit-game") root.location.hash = "#/entertainment";
      else if (action === "revive") this.revive();
      else if (action === "restore-last") {
        const record = await this.store.load("slot1");
        if (record?.data) {
          this.state = normalizeState(record.data);
          this.applyStateToWorld();
          this.revive();
        }
      }
    }

    upgradeSkill(skillId) {
      const max = { plasmaDrive: 3, astralGuard: 3, staminaCore: 4 }[skillId];
      if (!max || this.state.player.skillPoints <= 0 || Number(this.state.skills[skillId] || 0) >= max) return;
      this.state.skills[skillId] += 1;
      this.state.player.skillPoints -= 1;
      this.toast("Đã nâng kỹ năng.", "success");
      this.saveProgress("Nâng kỹ năng");
      this.renderCurrentPanel();
    }

    togglePause(force) {
      if (!this.running) return;
      const next = typeof force === "boolean" ? force : !this.paused;
      this.paused = next;
      if (next) {
        // Astral owns a richer pause panel with settings, inventory and save
        // controls. Showing the generic Game Runtime pause overlay as well
        // stacks two modal layers and blocks every control in this panel.
        this.saveProgress("Tạm dừng");
        this.openPanel("paused");
      } else {
        // Resume is harmless when the shared runtime never left "running", and
        // is still required after a hidden-tab suspension.
        this.runtime?.resume?.({ gameId: GAME_ID });
        this.closePanel();
        this.lastFrameAt = performance.now();
      }
      const button = this.root.querySelector("[data-har-pause]");
      if (button) {
        button.textContent = next ? "▶" : "Ⅱ";
        button.setAttribute("aria-label", next ? "Tiếp tục" : "Tạm dừng");
      }
    }

    async toggleFullscreen() {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await this.root.requestFullscreen();
        root.setTimeout(() => this.resize(), 50);
      } catch {
        this.toast("Trình duyệt không cho phép toàn màn hình.", "error");
      }
    }

    toast(message, tone = "info") {
      const element = this.root?.querySelector("[data-har-toast]");
      if (!element) return;
      clearTimeout(this.toastTimer);
      element.textContent = String(message || "").slice(0, 220);
      element.dataset.tone = tone;
      element.classList.add("is-visible");
      this.toastTimer = root.setTimeout(() => element.classList.remove("is-visible"), 2600);
    }

    initRuntime() {
      const runtime = root.HHGameRuntime;
      if (!runtime) return;
      try {
        this.runtime = typeof runtime.create === "function"
          ? runtime.create({
            gameId: GAME_ID,
            getState: () => this.snapshot(),
            autosave: false,
            maxPayloadBytes: 240000
          })
          : runtime;
        this.runtime?.register?.({ gameId: GAME_ID, getState: () => this.snapshot() });
      } catch (error) {
        this.runtime = null;
        this.toast(`Game Runtime chưa sẵn sàng: ${error.message || error}`, "error");
      }
    }

    snapshot() {
      const state = clone(this.state);
      state.updatedAt = nowIso();
      state.schemaVersion = SCHEMA_VERSION;
      return state;
    }

    async saveProgress(label = "Autosave") {
      if (this.destroyed || !this.started) return null;
      if (this.savingPromise) return this.savingPromise;
      this.state.updatedAt = nowIso();
      this.savingPromise = this.store.save(this.snapshot(), "slot1", label)
        .then((record) => {
          this.savedRecord = record;
          this.state.saveVersion = record.version;
          this.lastSaveAt = Date.now();
          try {
            this.runtime?.checkpoint?.(this.snapshot(), { slot: "slot-1", label });
          } catch {
            // The dedicated IndexedDB save above is authoritative for local play.
            // A shared runtime checkpoint must never turn a successful save into
            // a visible error for the player.
          }
          return record;
        })
        .catch((error) => {
          this.toast(error.message || "Không lưu được tiến trình.", "error");
          return null;
        })
        .finally(() => {
          this.savingPromise = null;
        });
      return this.savingPromise;
    }

    async restoreLocalVersion(version) {
      try {
        const record = await this.store.restore(version, "slot1");
        this.savedRecord = record;
        this.state = normalizeState(record.data);
        this.applyStateToWorld();
        this.toast(`Đã khôi phục phiên bản ${version}.`, "success");
        this.renderCurrentPanel();
      } catch (error) {
        this.toast(error.message || "Không khôi phục được bản lưu.", "error");
      }
    }

    async cloudRequest(method, query, body) {
      const token = root.HHAuthSession?.token?.() || "";
      if (!token) throw new Error("Bạn cần đăng nhập để dùng cloud save.");
      const base = String(this.options.apiBase || root.HH_REALTIME_URL || location.origin).replace(/\/$/, "");
      const params = new URLSearchParams({ service: "games", ...query });
      const response = await fetch(`${base}/api/social?${params.toString()}`, {
        method,
        credentials: "include",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Cloud save lỗi HTTP ${response.status}.`);
      return payload;
    }

    async syncCloud(manual = false, force = false) {
      if (!root.HHAuthSession?.token?.()) {
        this.state.cloud.status = "local";
        if (manual) this.toast("Chế độ khách chỉ lưu trên thiết bị. Hãy đăng nhập để đồng bộ.", "error");
        return false;
      }
      if (!navigator.onLine) {
        this.state.cloud.status = "offline";
        if (manual) this.toast("Thiết bị đang ngoại tuyến.", "error");
        return false;
      }
      try {
        await this.saveProgress("Trước khi đồng bộ");
        if (!force) {
          const remote = await this.cloudRequest("GET", { resource: "cloud-save", gameId: GAME_ID, slot: "slot1" });
          const remoteItem = remote.item;
          if (remoteItem?.data) {
            const remoteAt = Date.parse(remoteItem.data.updatedAt || remoteItem.updatedAt || 0);
            const localAt = Date.parse(this.state.updatedAt || this.savedRecord?.updatedAt || 0);
            const knownVersion = Number(this.state.cloud.version || 0);
            if (remoteAt > localAt + 1500 && Number(remoteItem.version || 0) > knownVersion) {
              this.cloudConflict = remoteItem;
              this.state.cloud = {
                status: "conflict",
                version: Number(remoteItem.version || 0),
                updatedAt: remoteItem.updatedAt || "",
                error: "Cloud save mới hơn bản local."
              };
              this.toast("Phát hiện xung đột cloud save. Mở Thiết lập để chọn bản.", "error");
              if (manual) this.openPanel("settings");
              return false;
            }
          }
        }
        const payload = await this.cloudRequest("POST", { resource: "cloud-save", gameId: GAME_ID }, {
          slot: "slot1",
          checkpointId: this.state.player.checkpoint,
          checkpointLabel: `Astral Realms · ${this.currentZone.name}`,
          checksum: this.stateChecksum(),
          data: this.snapshot()
        });
        this.state.cloud = {
          status: payload.item?.persistence === false ? "server-memory" : "synced",
          version: Number(payload.item?.version || 0),
          updatedAt: payload.item?.updatedAt || nowIso(),
          error: ""
        };
        this.cloudConflict = null;
        if (manual) this.toast(`Đã đồng bộ cloud v${this.state.cloud.version}.`, "success");
        this.renderCurrentPanel();
        return true;
      } catch (error) {
        this.state.cloud = { ...this.state.cloud, status: "local", error: error.message || "Đồng bộ thất bại" };
        if (manual) this.toast(error.message || "Không đồng bộ được cloud save.", "error");
        return false;
      }
    }

    stateChecksum() {
      const text = JSON.stringify({
        version: this.state.saveVersion,
        player: this.state.player,
        quests: this.state.quests,
        inventory: this.state.inventory,
        world: this.state.world,
        ship: this.state.ship,
        companions: this.state.companions,
        progression: this.state.progression
      });
      let hash = 2166136261;
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return `fnv1a-${(hash >>> 0).toString(16)}`;
    }

    async useCloudConflict() {
      if (!this.cloudConflict?.data) return;
      this.state = normalizeState(this.cloudConflict.data);
      this.state.cloud = {
        status: "synced",
        version: Number(this.cloudConflict.version || 0),
        updatedAt: this.cloudConflict.updatedAt || nowIso(),
        error: ""
      };
      this.cloudConflict = null;
      this.applyStateToWorld();
      await this.saveProgress("Khôi phục từ cloud");
      this.toast("Đã dùng tiến trình cloud.", "success");
      this.closePanel();
    }

    initRealtime() {
      const socket = this.options.socket || root.HHRealtimeSocket || this.socket;
      if (socket) this.attachSocket(socket);
      if (!this.realtimeReadyBound) {
        this.realtimeReadyBound = true;
        this.listen(root, "hh:realtime-ready", (event) => this.attachSocket(event.detail?.socket || root.HHRealtimeSocket));
        this.listen(root, "hh:realtime-offline", () => {
          this.authoritative = false;
          this.state.party.status = navigator.onLine ? "local" : "offline";
          this.state.party.integrity = "local-simulation";
          this.updateConnectionUi();
        });
      }
    }

    attachSocket(socket) {
      if (!socket || (this.socket === socket && this.socketBound)) {
        this.updateConnectionUi();
        return;
      }
      if (this.socket && this.socketBound) this.unbindSocket();
      this.socket = socket;
      this.socketBound = true;
      this.socketHandlers = {
        connect: () => {
          this.state.party.status = this.state.party.roomCode ? "room" : "ready";
          this.updateConnectionUi();
          if (this.state.party.roomCode) this.rejoinPartyAfterReconnect();
        },
        connectError: () => {
          this.authoritative = false;
          this.state.party.status = navigator.onLine ? "reconnecting" : "offline";
          this.state.party.integrity = "local-simulation";
          this.updateConnectionUi();
        },
        disconnect: () => {
          this.authoritative = false;
          this.state.party.status = navigator.onLine ? (this.state.party.roomCode ? "reconnecting" : "local") : "offline";
          this.state.party.integrity = "local-simulation";
          this.updateConnectionUi();
        },
        room: (payload) => {
          if (payload?.code !== this.state.party.roomCode) return;
          this.room = payload;
          this.state.party.capacity = clamp(payload.maxPlayers || this.state.party.capacity || 4, 2, COOP_PLAYER_LIMIT);
          this.state.party.members = Array.isArray(payload.members) ? payload.members.slice(0, this.state.party.capacity) : [];
          this.state.party.status = "room";
          if (this.currentPanel === "party") this.renderCurrentPanel();
        },
        presence: (payload) => {
          if (payload?.room !== this.state.party.roomCode) return;
          this.state.party.members = Array.isArray(payload.members) ? payload.members.slice(0, this.state.party.capacity || COOP_PLAYER_LIMIT) : [];
          if (this.currentPanel === "party") this.renderCurrentPanel();
        },
        chat: (payload) => {
          if (payload?.room !== this.state.party.roomCode) return;
          this.partyMessages ||= [];
          this.partyMessages.push(payload);
          this.partyMessages = this.partyMessages.slice(-50);
          if (this.currentPanel === "party") this.renderCurrentPanel();
          this.toast(`${payload.user?.name || "HH"}: ${payload.body}`);
        },
        ready: (payload) => {
          if (payload?.room !== this.state.party.roomCode) return;
          if (payload.socketId === this.socket?.id) this.state.party.ready = payload.ready === true;
          if (this.currentPanel === "party") this.renderCurrentPanel();
        },
        snapshot: (payload) => this.applyAuthoritativeSnapshot(payload)
      };
      socket.on?.("connect", this.socketHandlers.connect);
      socket.on?.("connect_error", this.socketHandlers.connectError);
      socket.on?.("disconnect", this.socketHandlers.disconnect);
      socket.on?.("game:room", this.socketHandlers.room);
      socket.on?.("game:presence", this.socketHandlers.presence);
      socket.on?.("game:chat", this.socketHandlers.chat);
      socket.on?.("game:ready", this.socketHandlers.ready);
      socket.on?.("astral-realms:snapshot", this.socketHandlers.snapshot);
      this.updateConnectionUi();
    }

    unbindSocket() {
      if (!this.socket || !this.socketHandlers) return;
      this.socket.off?.("connect", this.socketHandlers.connect);
      this.socket.off?.("connect_error", this.socketHandlers.connectError);
      this.socket.off?.("disconnect", this.socketHandlers.disconnect);
      this.socket.off?.("game:room", this.socketHandlers.room);
      this.socket.off?.("game:presence", this.socketHandlers.presence);
      this.socket.off?.("game:chat", this.socketHandlers.chat);
      this.socket.off?.("game:ready", this.socketHandlers.ready);
      this.socket.off?.("astral-realms:snapshot", this.socketHandlers.snapshot);
      this.socketBound = false;
      this.socketHandlers = null;
    }

    emitAck(event, payload, timeout = 8000) {
      return new Promise((resolve, reject) => {
        if (!this.socket?.connected) return reject(new Error("Realtime server chưa kết nối."));
        let settled = false;
        const timer = root.setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error("Máy chủ realtime không phản hồi."));
        }, timeout);
        this.socket.emit(event, payload, (response) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (response?.ok === false) reject(new Error(response.error || "Yêu cầu realtime thất bại."));
          else resolve(response || {});
        });
      });
    }

    async createParty() {
      try {
        const capacity = this.state.party.capacity === 8 ? 8 : 4;
        const response = await this.emitAck("game:room:create", {
          gameId: GAME_ID,
          name: `Astral · ${this.state.player.name}`,
          visibility: "public",
          maxPlayers: capacity,
          settings: { tier: capacity === 8 ? "world-event" : "expedition" },
          gameName: this.state.player.name,
          state: { x: this.state.player.x, z: this.state.player.z, level: this.state.player.level }
        });
        this.acceptRoom(response);
        this.toast(`Đã tạo phòng ${this.state.party.roomCode}.`, "success");
      } catch (error) {
        this.toast(error.message || "Không tạo được phòng.", "error");
      }
    }

    async matchParty() {
      try {
        const capacity = this.state.party.capacity === 8 ? 8 : 4;
        const response = await this.emitAck("game:room:match", {
          gameId: GAME_ID,
          name: capacity === 8 ? "Astral World Event" : "Astral Expedition",
          maxPlayers: capacity,
          settings: { tier: capacity === 8 ? "world-event" : "expedition" },
          gameName: this.state.player.name,
          state: { x: this.state.player.x, z: this.state.player.z, level: this.state.player.level }
        });
        if (response.room?.gameId !== GAME_ID) throw new Error("Matchmaking trả về phòng không hợp lệ.");
        this.acceptRoom(response);
        this.toast(`Đã ghép vào shard ${this.state.party.roomCode}.`, "success");
      } catch (error) {
        this.toast(error.message || "Không ghép được shard phù hợp.", "error");
      }
    }

    async rejoinPartyAfterReconnect() {
      if (this.rejoiningParty || !this.socket?.connected || !this.state.party.roomCode) return;
      this.rejoiningParty = true;
      const code = this.state.party.roomCode;
      try {
        const response = await this.emitAck("game:room:join", {
          code,
          gameName: this.state.player.name,
          state: { x: this.state.player.x, z: this.state.player.z, level: this.state.player.level }
        }, 6000);
        if (response.room?.gameId !== GAME_ID) throw new Error("Phòng đã chuyển sang game khác.");
        this.acceptRoom(response);
        this.toast(`Đã kết nối lại phòng ${code}.`, "success");
      } catch {
        this.state.party.roomCode = "";
        this.state.party.members = [];
        this.state.party.status = "ready";
        this.authoritative = false;
        this.room = null;
        this.updateConnectionUi();
        if (this.currentPanel === "party") this.renderCurrentPanel();
      } finally {
        this.rejoiningParty = false;
      }
    }

    async joinParty(code) {
      if (!code) return this.toast("Hãy nhập mã phòng.", "error");
      try {
        const response = await this.emitAck("game:room:join", {
          code: code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8),
          gameName: this.state.player.name,
          state: { x: this.state.player.x, z: this.state.player.z, level: this.state.player.level }
        });
        if (response.room?.gameId !== GAME_ID) throw new Error("Phòng này không thuộc HH Astral Realms.");
        this.acceptRoom(response);
        this.toast(`Đã tham gia phòng ${this.state.party.roomCode}.`, "success");
      } catch (error) {
        this.toast(error.message || "Không tham gia được phòng.", "error");
      }
    }

    acceptRoom(response) {
      this.room = response.room || {};
      this.state.party.roomCode = String(this.room.code || "").toUpperCase();
      this.state.party.capacity = clamp(this.room.maxPlayers || this.state.party.capacity || 4, 2, COOP_PLAYER_LIMIT);
      this.state.party.members = Array.isArray(this.room.members) ? this.room.members.slice(0, this.state.party.capacity) : [];
      const self = this.state.party.members.find((member) => member.socketId === this.socket?.id || member.id === this.socket?.id);
      this.state.party.ready = self?.ready === true;
      this.state.party.status = "room";
      this.state.party.integrity = "awaiting-server-snapshot";
      this.authoritative = false;
      this.emitInput({ spawn: { x: this.state.player.x, z: this.state.player.z } });
      this.renderCurrentPanel();
      this.updateConnectionUi();
    }

    disposeRemotePlayer(id, mesh = this.remotePlayers.get(id)) {
      if (!mesh) return;
      const runtimeKey = `remote:${id}`;
      const runtime = this.characterRuntimes.get(runtimeKey) || mesh.userData?.characterRuntime;
      mesh.parent?.remove(mesh);
      this.disposeCharacterObject(mesh, runtime);
      this.characterRuntimes.delete(runtimeKey);
      this.remotePlayers.delete(id);
    }

    async leaveParty() {
      try {
        if (this.socket?.connected && this.state.party.roomCode) await this.emitAck("game:room:leave", { code: this.state.party.roomCode });
      } catch {}
      const capacity = this.state.party.capacity === 8 ? 8 : 4;
      this.state.party = { roomCode: "", status: this.socket?.connected ? "ready" : "local", ready: false, capacity, members: [], integrity: "local-simulation" };
      this.authoritative = false;
      this.room = null;
      [...this.remotePlayers.entries()].forEach(([id, mesh]) => this.disposeRemotePlayer(id, mesh));
      this.toast("Đã rời phòng. Tiếp tục bằng mô phỏng local.");
      this.renderCurrentPanel();
    }

    async sendPartyChat(body) {
      if (!body) return;
      try {
        await this.emitAck("game:chat", { body, type: "text" });
        const input = this.root.querySelector("[data-party-chat]");
        if (input) input.value = "";
      } catch (error) {
        this.toast(error.message || "Không gửi được chat.", "error");
      }
    }

    async togglePartyReady() {
      if (!this.socket?.connected || !this.state.party.roomCode) return this.toast("Cần kết nối vào một phòng trước.", "error");
      try {
        const ready = !this.state.party.ready;
        await this.emitAck("game:ready", { ready });
        this.state.party.ready = ready;
        this.renderCurrentPanel();
      } catch (error) {
        this.toast(error.message || "Không cập nhật được trạng thái sẵn sàng.", "error");
      }
    }

    emitInput(extra = {}) {
      if (!this.socket?.connected || !this.state.party.roomCode) return;
      const input = this.movementInput();
      const forwardX = -Math.sin(this.cameraYaw);
      const forwardZ = -Math.cos(this.cameraYaw);
      const rightX = Math.cos(this.cameraYaw);
      const rightZ = -Math.sin(this.cameraYaw);
      const includeAppearance = Boolean(extra.appearance || this.appearanceDirty || extra.spawn);
      const payload = {
        seq: ++this.inputSeq,
        move: {
          x: forwardX * input.z + rightX * input.x,
          z: forwardZ * input.z + rightZ * input.x
        },
        sprint: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
        rotation: this.state.player.rotation,
        element: this.state.player.element,
        characterId: this.state.roster.activeId,
        spawn: { x: this.state.player.x, z: this.state.player.z },
        ...(includeAppearance ? { appearance: compactAppearanceRecipe(this.activeAppearanceRecipe(), this.state.roster.activeId) } : {}),
        ...extra
      };
      this.socket.emit("astral-realms:input", payload);
      if (includeAppearance) this.appearanceDirty = false;
    }

    sendRealtimeInput(time) {
      if (!this.state.party.roomCode || !this.socket?.connected || time - this.lastNetworkAt < 50) return;
      this.lastNetworkAt = time;
      this.emitInput();
    }

    applyAuthoritativeSnapshot(payload) {
      if (!payload || payload.gameId !== GAME_ID || payload.room !== this.state.party.roomCode || payload.integrity !== "server-authoritative") return;
      this.authoritative = true;
      this.state.party.integrity = "server-authoritative";
      this.state.party.status = "playing";
      if (payload.world && typeof payload.world === "object") {
        this.state.world.activeEvent = payload.world.activeEvent || null;
        Object.entries(payload.world.zones || {}).forEach(([id, serverZone]) => {
          if (!this.state.world.zones[id]) return;
          this.state.world.zones[id] = {
            ...this.state.world.zones[id],
            discovered: this.state.world.zones[id].discovered || serverZone.discovered === true,
            restored: this.state.world.zones[id].restored || serverZone.restored === true,
            core: serverZone.restored === true ? "restored" : this.state.world.zones[id].core,
            resources: Math.max(Number(this.state.world.zones[id].resources || 0), Number(serverZone.resources || 0)),
            updatedAt: serverZone.updatedAt || this.state.world.zones[id].updatedAt
          };
          if (serverZone.restored === true) this.state.checkpoints[id] = true;
        });
        const known = new Map((this.state.world.eventLog || []).map((event) => [event.id, event]));
        (payload.world.eventLog || []).forEach((event) => known.set(event.id, event));
        this.state.world.eventLog = [...known.values()].slice(-80);
        this.state.world.lastSyncAt = payload.serverTime || nowIso();
        this.refreshWorldStateVisuals();
      }
      const self = (payload.players || []).find((player) => player.socketId === this.socket?.id);
      if (self) {
        const error = Math.hypot(self.x - this.state.player.x, self.z - this.state.player.z);
        const blend = error > 3 ? 1 : 0.22;
        this.state.player.x += (self.x - this.state.player.x) * blend;
        this.state.player.z += (self.z - this.state.player.z) * blend;
        this.state.player.health = self.health;
        this.state.player.stamina = self.stamina;
        if (CHARACTERS[self.characterId] && self.characterId !== this.state.roster.activeId) this.switchCharacter(self.characterId);
        if (ELEMENTS[self.element] && self.element !== this.state.player.element) this.setElement(self.element, false);
      }
      const activeRemoteIds = new Set();
      (payload.players || []).forEach((player) => {
        if (player.socketId === this.socket?.id) return;
        activeRemoteIds.add(player.socketId);
        let mesh = this.remotePlayers.get(player.socketId);
        const profile = CHARACTERS[player.characterId] || CHARACTERS.lyra;
        if (mesh && mesh.userData.characterId !== profile.id) {
          this.disposeRemotePlayer(player.socketId, mesh);
          mesh = null;
        }
        if (!mesh) {
          mesh = this.createPhotorealCharacterModel(profile, 0.92);
          mesh.userData = { ...mesh.userData, type: "remote-player", id: player.socketId, name: player.name, characterId: profile.id };
          mesh.userData.targetPosition = new this.THREE.Vector3(player.x, 1.08, player.z);
          mesh.userData.targetRotation = player.rotation;
          this.world.add(mesh);
          this.remotePlayers.set(player.socketId, mesh);
          this.registerCharacterRuntime(mesh, profile, `remote:${player.socketId}`, "remote", mesh.userData.builtInAnimations || []);
        }
        if (player.appearance) {
          const remoteAppearance = normalizeAppearanceRecipe(player.appearance, profile.id);
          if (mesh.userData.appearanceFingerprint !== appearanceFingerprint(remoteAppearance, profile.id)) {
            this.applyAppearanceToMesh(mesh, remoteAppearance, profile.id);
          }
        }
        mesh.userData.targetPosition.set(player.x, 1.08, player.z);
        mesh.userData.targetRotation = player.rotation;
      });
      this.remotePlayers.forEach((mesh, id) => {
        if (!activeRemoteIds.has(id)) {
          this.disposeRemotePlayer(id, mesh);
        }
      });
      (payload.enemies || []).forEach((serverEnemy) => {
        const enemy = this.enemies.get(serverEnemy.id);
        if (!enemy) return;
        const wasAlive = enemy.userData.health > 0 && !enemy.userData.defeated;
        enemy.position.x += (serverEnemy.x - enemy.position.x) * 0.4;
        enemy.position.z += (serverEnemy.z - enemy.position.z) * 0.4;
        enemy.userData.health = serverEnemy.health;
        if (serverEnemy.boss) {
          enemy.userData.bossPhase = serverEnemy.bossPhase || enemy.userData.bossPhase;
          enemy.userData.shield = serverEnemy.shield ?? enemy.userData.shield;
          if (enemy.userData.weakPoint) enemy.userData.weakPoint.visible = Boolean(serverEnemy.weakPointOpen);
        }
        if (serverEnemy.defeated && wasAlive) this.defeatEnemy(enemy);
        else if (!serverEnemy.defeated && enemy.userData.defeated) {
          enemy.userData.defeated = false;
          enemy.userData.health = serverEnemy.health;
          enemy.visible = true;
        }
      });
      this.updateConnectionUi();
    }

    updateConnectionUi() {
      const label = this.root?.querySelector("[data-har-server]");
      if (!label) return;
      const state = !navigator.onLine
        ? { text: "OFFLINE", tone: "error" }
        : this.authoritative
          ? { text: `${this.state.party.roomCode} · SERVER`, tone: "online" }
          : this.socket?.connected
            ? { text: this.state.party.roomCode ? `${this.state.party.roomCode} · SYNC` : "REALTIME READY", tone: "ready" }
            : { text: "LOCAL", tone: "local" };
      label.textContent = state.text;
      label.dataset.state = state.tone;
    }

    initAudio() {
      if (!this.state.settings.sound) return;
      try {
        const AudioContext = root.AudioContext || root.webkitAudioContext;
        if (!AudioContext) return;
        this.audio = new AudioContext();
        this.audioMaster = this.audio.createGain();
        this.audioMaster.gain.value = (this.state.settings.volume / 100) * 0.15;
        this.audioMaster.connect(this.audio.destination);
      } catch {
        this.audio = null;
        this.audioMaster = null;
      }
    }

    sound(kind) {
      if (!this.audio || !this.audioMaster || !this.state.settings.sound) return;
      if (this.audio.state === "suspended") this.audio.resume().catch(() => {});
      const presets = {
        attack: [240, 0.08, "sawtooth"],
        skill: [420, 0.18, "sine"],
        ultimate: [130, 0.5, "sawtooth"],
        dodge: [620, 0.07, "triangle"],
        jump: [310, 0.09, "sine"],
        collect: [760, 0.16, "sine"],
        craft: [520, 0.3, "triangle"],
        heal: [660, 0.22, "sine"]
      };
      const [frequency, duration, type] = presets[kind] || [330, 0.1, "sine"];
      const oscillator = this.audio.createOscillator();
      const gain = this.audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, this.audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * 1.35), this.audio.currentTime + duration);
      gain.gain.setValueAtTime(0.001, this.audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.28, this.audio.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audio.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(this.audioMaster);
      oscillator.start();
      oscillator.stop(this.audio.currentTime + duration + 0.02);
    }

    dispatchReward(detail = {}) {
      document.dispatchEvent(new CustomEvent("hh:game-reward", {
        detail: {
          gameId: GAME_ID,
          gameTitle: "HH Astral Realms",
          xp: Math.max(0, Number(detail.xp || 0)),
          score: this.state.stats.totalDamage,
          level: this.state.player.level,
          source: "astral-realms",
          ...detail
        }
      }));
    }

    inspect() {
      const activeCharacterMesh = this.characterMeshes.get(this.state.roster.activeId);
      const activeCharacterRuntime = this.characterRuntimes.get(this.state.roster.activeId);
      return {
        mounted: true,
        gameId: GAME_ID,
        started: this.started,
        running: this.running,
        paused: this.paused,
        zone: this.currentZone?.id || "central",
        fps: this.fps,
        renderer: this.renderer ? this.rendererBackend.toUpperCase() : "not-started",
        visualStyle: this.state.settings.visualStyle,
        vfxLevel: this.state.settings.vfxLevel,
        photorealAssets: this.photorealStatus,
        characterSystem: {
          version: CHARACTER_VISUAL_VERSION,
          mode: this.state.settings.characterMode,
          quality: this.state.settings.characterQuality,
          loaderReady: Boolean(this.GLTFLoaderClass),
          decodersReady: this.characterDecodersReady,
          source: activeCharacterRuntime?.source || activeCharacterMesh?.userData?.sourceProvider || "not-started",
          sourceProviderId: activeCharacterMesh?.userData?.sourceProviderId || "fallback",
          catalogModels: this.characterPipelineManifest.filter((entry) => entry.provider === "valid-avatar").length,
          visualMode: activeCharacterMesh?.userData?.visualMode || "not-started",
          tier: activeCharacterMesh?.userData?.modelTier || "not-started",
          motion: activeCharacterRuntime?.state || this.activeAnimation,
          bones: Object.keys(activeCharacterRuntime?.bones || {}).length,
          clips: activeCharacterRuntime?.clips?.size || 0,
          facialChannels: activeCharacterRuntime?.facialChannels || 0,
          triangles: activeCharacterRuntime?.triangles || 0,
          qa: activeCharacterRuntime?.qaReport || null,
          facePilot: {
            status: this.facePilot.status,
            frames: this.facePilot.frame || 0,
            localOnly: true
          },
          genesisStudio: this.genesisStudioId,
          genesisPreview: this.genesisVisibility?.report || null,
          genesisValidated: Boolean(this.genesisVisibility?.validated)
        },
        livingWorld: {
          enabled: this.state.settings.livingWorld,
          actors: this.livingWorldActors.length,
          biome: this.currentZone?.id || "central",
          footprints: this.footprints.filter((footprint) => footprint.visible).length,
          licensedEnvironment: this.licensedEnvironmentStatus,
          licensedModels: this.licensedEnvironmentAssets.size
        },
        rendererHealth: {
          failures: this.runtimeFailureCount,
          lastFrameAt: this.lastRenderSuccessAt
        },
        diagnostics: {
          modelReady: Boolean(this.characterDiagnostics?.modelReady),
          previewValidated: Boolean(this.characterDiagnostics?.previewValidated),
          visibleFrames: Number(this.characterDiagnostics?.visibleFrames || 0),
          triangles: Number(this.characterDiagnostics?.triangles || activeCharacterRuntime?.triangles || 0),
          bones: Number(this.characterDiagnostics?.bones || Object.values(activeCharacterRuntime?.bones || {}).filter(Boolean).length),
          morphTargets: Number(this.characterDiagnostics?.morphTargets || activeCharacterRuntime?.facialChannels || 0),
          boundingBox: this.characterDiagnostics?.boundingBox || null,
          projectedHeight: Number(this.characterDiagnostics?.projectedHeight || 0),
          feetGroundError: Number(this.characterDiagnostics?.feetGroundError || 0),
          wristDeviation: Number(this.characterDiagnostics?.wristDeviation || activeCharacterRuntime?.wristDeviation || 0),
          armDownness: this.characterDiagnostics?.armDownness || null,
          relaxedIdleArms: this.characterDiagnostics?.relaxedIdleArms !== false,
          motionSource: activeCharacterRuntime?.motionSource || activeCharacterMesh?.userData?.motionSource || "not-started",
          motionQuarantined: activeCharacterRuntime?.motionQuarantined || "",
          renderer: this.rendererBackend,
          fps: this.fps,
          activeLOD: activeCharacterMesh?.userData?.modelTier || "not-started",
          environmentAssets: {
            status: this.licensedEnvironmentStatus,
            loaded: this.licensedEnvironmentAssets.size,
            photoreal: this.photorealStatus
          },
          cinematicChapter: this.cinematicSequence.active ? this.cinematicSequence.chapterId : ""
        },
        authoritative: this.authoritative,
        roomCode: this.state.party.roomCode,
        saveVersion: this.savedRecord?.version || 0,
        player: {
          level: this.state.player.level,
          health: this.state.player.health,
          element: this.state.player.element,
          characterId: this.state.roster.activeId,
          characters: this.state.roster.unlocked.slice(),
          swimming: this.isSwimming,
          climbing: this.isClimbing
        },
        activeQuest: this.activeQuest()?.id || "",
        inventoryCount: Object.keys(this.state.inventory).length,
        world: {
          activeEvent: this.state.world?.activeEvent?.id || "",
          currentZone: this.currentZone?.id || "central",
          restoredZones: Object.values(this.state.world?.zones || {}).filter((zone) => zone.restored).length,
          factionCount: Object.keys(this.state.world?.factions || {}).length
        },
        ship: {
          name: this.state.ship?.name || "Horizon H",
          level: this.state.ship?.level || 1,
          modules: { ...(this.state.ship?.modules || {}) }
        },
        companions: Object.fromEntries(Object.entries(this.state.companions || {}).map(([id, record]) => [id, { bond: record.bond, storyStage: record.storyStage, unlocked: record.unlocked }]))
      };
    }

    async destroy() {
      if (this.destroyed) return;
      this.teardownGenesisPreview({ restorePlayer: true });
      this.restoreGenesisLighting();
      if (this.started) await this.saveProgress("Rời game");
      this.destroyed = true;
      this.running = false;
      cancelAnimationFrame(this.frameHandle);
      clearInterval(this.autosaveTimer);
      clearTimeout(this.toastTimer);
      this.stopFacePilot();
      this.characterRuntimes.forEach((runtime) => runtime.mixer?.stopAllAction?.());
      this.unbindSocket();
      this.cleanup.splice(0).forEach((dispose) => {
        try { dispose(); } catch {}
      });
      this.runtime?.destroy?.({ gameId: GAME_ID });
      if (this.cinematicActorRestore) this.restoreGameplaySceneFromCinematic();
      if (this.scene) this.disposeCharacterObject(this.scene);
      this.disposePhotorealAssets();
      this.disposeBuiltInCharacterAssets();
      this.disposeLicensedEnvironmentAssets();
      Object.values(this.characterDetailTextures || {}).forEach((texture) => texture?.dispose?.());
      this.toonGradient?.dispose?.();
      this.renderer?.dispose?.();
      try { await this.audio?.close?.(); } catch {}
      this.host?.replaceChildren();
    }
  }

  let activeGame = null;

  async function mount(host, options = {}) {
    if (!host) throw new Error("HHAstralRealms.mount cần host element.");
    if (activeGame) await activeGame.destroy();
    activeGame = new AstralRealmsGame(host, options);
    await activeGame.init();
    return activeGame;
  }

  async function unmount() {
    if (!activeGame) return;
    await activeGame.destroy();
    activeGame = null;
  }

  function inspect() {
    if (!activeGame) return { mounted: false, gameId: GAME_ID };
    return activeGame.inspect();
  }

  const api = Object.freeze({
    mount,
    unmount,
    inspect,
    GAME_ID,
    QUESTS,
    RECIPES,
    ELEMENT_REACTIONS,
    CHARACTERS,
    CHARACTER_MODEL_TIERS,
    CHARACTER_IMPORT_LIMITS,
    HH_HUMANOID_SKELETON,
    MEDIAPIPE_FACE_CHANNELS,
    validateCharacterAsset
  });
  root.HHAstralRealms = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
